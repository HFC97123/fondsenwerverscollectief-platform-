# Spraakinvoer (dicteren) in de chat, met een nagebootste Web Speech API.
# Draait de echte app tegen de nagebootste Supabase; de chat-Edge-Function wordt in de pagina nagebootst (SSE-stream)
# zodat de request-payloads van de chat gecontroleerd kunnen worden.
import subprocess, time, sys, os, re, json
from playwright.sync_api import sync_playwright
os.chdir(os.path.dirname(os.path.abspath(__file__)))
PORT=8786
srv = subprocess.Popen(['python3',__import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)),'../../spa_server.py'), str(PORT), 'web'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1)
BASE=f'http://localhost:{PORT}/index.html'
P1='11111111-1111-4111-8111-111111111111'; P2='22222222-2222-4222-8222-222222222222'; P3='33333333-3333-4333-8333-333333333333'; PX='99999999-9999-4999-8999-999999999999'
CA='55555555-5555-4555-8555-555555555555'   # gesprek A: Projectplan Buurtkeuken (P1)
CL='77777777-7777-4777-8777-777777777777'   # losse vraag zonder project
CB='88888888-8888-4888-8888-888888888888'   # gesprek B: Begroting Brug (P1)
CT='99999999-0000-4999-8999-999999999999'   # gesprek T: Taalcafe-gesprek (P2)
CX='66666666-6666-4666-8666-666666666666'   # gesprek van een ander (nooit zichtbaar)
res=[]
def ok(n,c,d=''):
    res.append((n,bool(c),d)); print(('OK  ' if c else 'FAIL'),n,(d if not c else ''), flush=True)
os.makedirs('shots',exist_ok=True)

PATCH = """
window.__SEED_PATCH=function(seed,c){
 var T=seed.tables;
 T.subsidie_kompas_conversations.push({id:'88888888-8888-4888-8888-888888888888',user_id:'u1',title:'Begroting Brug',active_program_id:c.P1,updated_at:'2026-10-08T09:20:00Z',kompas_mode:'begroting'});
 T.subsidie_kompas_conversations.push({id:'99999999-0000-4999-8999-999999999999',user_id:'u1',title:'Taalcafe plannen',active_program_id:c.P2,updated_at:'2026-10-07T09:20:00Z',kompas_mode:null});
 T.subsidie_kompas_messages.push({conversation_id:'88888888-8888-4888-8888-888888888888',role:'user',content:'Help mij met een begroting',created_at:'2026-10-08T09:15:00Z'});
 T.subsidie_kompas_messages.push({conversation_id:'88888888-8888-4888-8888-888888888888',role:'assistant',content:'Begroting: personeel 40.000, activiteiten 20.000.',created_at:'2026-10-08T09:15:30Z'});
 T.subsidie_kompas_messages.push({conversation_id:'99999999-0000-4999-8999-999999999999',role:'user',content:'Hoe start ik het taalcafe?',created_at:'2026-10-07T09:15:00Z'});
 if(window.__LANG){for(var i=0;i<14;i++){T.subsidie_kompas_messages.push({conversation_id:'55555555-5555-4555-8555-555555555555',role:i%2?'assistant':'user',content:(i%2?'Antwoord '+i+': ':'Vraag '+i+': ')+'Dit is een langere tekst over de aanpak van het project, de doelgroep, de planning en de financiering. '.repeat(i%2?3:1),created_at:'2026-10-10T09:'+String(20+i)+':00Z'});}}
 if(window.__EXTRA_PATCH)window.__EXTRA_PATCH(seed,c);
};
"""
# Edge Function nabootsen: SSE-stream met vertraagde deltas; alle requestbodies worden bewaard.
FETCH = """
window.__CHAT_POSTS=[];
(function(){var of=window.fetch.bind(window);
window.fetch=async function(url,opts){
 if(String(url).indexOf('/functions/v1/subsidie-kompas')===-1)return of(url,opts);
 var body=JSON.parse(opts.body);window.__CHAT_POSTS.push(body);
 var antwoord=window.__CHAT_ANTWOORD?window.__CHAT_ANTWOORD(body):'Dit is het antwoord van de test.';
 var enc=new TextEncoder();var delen=antwoord.split(' ');
 var stream=new ReadableStream({async start(c){
  for(var i=0;i<delen.length;i++){c.enqueue(enc.encode('data: '+JSON.stringify({delta:delen[i]+' '})+'\\n\\n'));
   await new Promise(function(r){setTimeout(r,25)});
   if(window.__CHAT_HANG&&i===1){await new Promise(function(r){window.__CHAT_RELEASE=r;});}}
  c.enqueue(enc.encode('data: '+JSON.stringify({done:true,answer:antwoord,sources:[],veldVoorstellen:{},projectDossier:null})+'\\n\\n'));c.close();}});
 return new Response(stream,{status:200,headers:{'content-type':'text/event-stream'}});};})();
"""
def nieuw(b,vp,tier,pad='/kompas',extra=None,init=None,lang=False):
    ctx=b.new_context(viewport=vp); pg=ctx.new_page()
    pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='div[style*=\"z-index: 2000\"]{display:none !important}';document.head.appendChild(s)})")
    if lang: pg.add_init_script('window.__LANG=true;')
    pg.add_init_script(PATCH); pg.add_init_script(FETCH)
    if extra: pg.add_init_script('window.__EXTRA_PATCH=function(seed,c){'+extra+'};')
    if init: pg.add_init_script(init)
    pg.errs=[]; pg.cons=[]
    pg.on('pageerror',lambda e: pg.errs.append(str(e)))
    pg.on('console',lambda m: pg.cons.append(m.text) if m.type=='error' and 'favicon' not in m.text and 'Failed to load resource' not in m.text else None)
    pg.goto(f'{BASE}?tier={tier}#{pad}'); pg.wait_for_timeout(1700)
    return ctx,pg
def txt(pg): return pg.locator('body').inner_text().replace('\xa0',' ')
def geenhscroll(pg): return pg.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1')
def html(pg): return pg.evaluate("(()=>{const c=document.body.cloneNode(true);c.querySelectorAll('script').forEach(x=>x.remove());return c.innerHTML})()")
def db(pg,t): return pg.evaluate(f'window.__DBL.{t}')
def posts(pg): return pg.evaluate('window.__CHAT_POSTS')
def rij(pg,titel): return pg.locator('[data-testid="gesprek-rij"]').filter(has=pg.get_by_text(titel,exact=True))
def open_rij(pg,titel):
    pg.locator('[data-testid="kolom-gesprekken"] [data-testid="gesprek-open"]').filter(has_text=titel).first.click(); pg.wait_for_timeout(900)
def stuur(pg,tekst,wacht=1200):
    pg.get_by_test_id('chat-invoer').fill(tekst); pg.get_by_test_id('chat-invoer').press('Enter'); pg.wait_for_timeout(wacht)
def kop(pg): return pg.get_by_test_id('actief-project-naam').inner_text() if pg.get_by_test_id('actief-project-naam').count() else 'geen project'
def titels(pg,groep):
    sel = '[data-testid="groep-los"]' if groep=='los' else f'[data-testid="project-groep"][data-project-id="{groep}"]'
    return pg.locator(f'[data-testid="kolom-gesprekken"] {sel} .fwk-cl-titel').all_inner_texts()
def kiezer(pg,naam): pg.get_by_test_id('project-kiezer').select_option(label=naam); pg.wait_for_timeout(500)

DESK={'width':1440,'height':900}; BREED={'width':1200,'height':800}; TAB={'width':1000,'height':800}; MOB={'width':390,'height':844}


FAKE = """
window.__REC=[];
window.SpeechRecognition=function(){var s=this;s.started=false;window.__REC.push(s);
 s.start=function(){if(window.__REC_FAIL){throw new Error('x')}s.started=true;};
 s.stop=function(){if(s.started){s.started=false;setTimeout(function(){s.onend&&s.onend()},10)}};
 s.abort=function(){s.started=false;window.__ABORT=(window.__ABORT||0)+1;};
};
window.__zeg=function(finals,interim){var r=[];finals.forEach(function(t){var x=[{transcript:t}];x.isFinal=true;r.push(x)});if(interim){var y=[{transcript:interim}];y.isFinal=false;r.push(y)}
 var s=window.__REC[window.__REC.length-1];s.onresult({results:r});};
window.__fout=function(code){var s=window.__REC[window.__REC.length-1];s.onerror({error:code});s.started=false;s.onend&&s.onend();};
"""

try:
  with sync_playwright() as p:
    b=p.chromium.launch()
    for tier,naam in [('pro','Pro'),('free','Free')]:
        ctx,pg=nieuw(b,DESK,tier,init=FAKE+("window.__fakeAan=1;"))
        mic=pg.get_by_test_id('chat-microfoon'); ta=pg.get_by_test_id('chat-invoer')
        ok(f'S1 {naam}: microfoonknop naast het invoerveld, niet actief', mic.is_visible() and mic.get_attribute('aria-pressed')=='false' and 'Spreek' in mic.get_attribute('aria-label'))
        ta.fill('Welke fondsen'); mic.click(); pg.wait_for_timeout(200)
        ok(f'S2 {naam}: klik start luisteren (nl-NL, continu, tussentijdse resultaten), melding zichtbaar', pg.evaluate('window.__REC.length')==1 and pg.evaluate('[__REC[0].lang,__REC[0].continuous,__REC[0].interimResults,__REC[0].started]')==['nl-NL',True,True,True] and pg.get_by_test_id('chat-luistert').is_visible() and mic.get_attribute('aria-pressed')=='true')
        pg.evaluate("__zeg([],'passen bij')"); pg.wait_for_timeout(100)
        ok(f'S3 {naam}: tussentijdse tekst verschijnt live achter wat er al stond', ta.input_value()=='Welke fondsen passen bij')
        pg.evaluate("__zeg(['passen bij een taalcafé'],'voor ouderen')"); pg.wait_for_timeout(100)
        ok(f'S4 {naam}: definitief + tussentijds, geen dubbele tekst', ta.input_value()=='Welke fondsen passen bij een taalcafé voor ouderen', ta.input_value())
        ok(f'S5 {naam}: niets automatisch verstuurd', pg.evaluate('window.__CHAT_POSTS.length')==0)
        mic.click(); pg.wait_for_timeout(200)
        ok(f'S6 {naam}: tweede klik stopt; tekst blijft staan; melding weg', ta.input_value()=='Welke fondsen passen bij een taalcafé voor ouderen' and pg.get_by_test_id('chat-luistert').count()==0 and mic.get_attribute('aria-pressed')=='false')
        ta.press('Enter'); pg.wait_for_timeout(1500)
        pl=posts(pg)
        ok(f'S7 {naam}: versturen gaat via de gewone weg; de vraag staat in het verzoek zonder extra velden', len(pl)==1 and 'taalcafé voor ouderen' in json.dumps(pl[0],ensure_ascii=False) and 'Dit is het antwoord van de test.' in txt(pg) and not any('spraak' in k.lower() or 'voice' in k.lower() for k in pl[0].keys()), str(list(pl[0].keys())) if pl else '')
        # opnieuw: handmatig typen tijdens luisteren stopt het luisteren
        mic.click(); pg.wait_for_timeout(150); pg.evaluate("__zeg(['eerste deel'],'')"); 
        ta.press('x'); pg.wait_for_timeout(200)
        ok(f'S8 {naam}: typen tijdens het dicteren stopt het luisteren; getypte tekst blijft', pg.get_by_test_id('chat-luistert').count()==0 and 'x' in ta.input_value() and pg.evaluate('__REC[__REC.length-1].started')==False, ta.input_value())
        # versturen tijdens luisteren stopt eerst
        ta.fill(''); mic.click(); pg.wait_for_timeout(150); pg.evaluate("__zeg(['nog een vraag'],'')"); pg.wait_for_timeout(100); ta.press('Enter'); pg.wait_for_timeout(1500)
        ok(f'S9 {naam}: Verstuur tijdens luisteren stopt de microfoon; invoerveld leeg', pg.get_by_test_id('chat-luistert').count()==0 and ta.input_value()=='' and pg.evaluate('__REC[__REC.length-1].started')==False and len(posts(pg))==2, ta.input_value())
        ok(f'S10 {naam}: geen pageerrors/console errors', not pg.errs and not pg.cons, str(pg.errs+pg.cons))
        if tier=='pro':
            pg.screenshot(path='shots/chat_5_microfoon.png')
        ctx.close()

    # foutmeldingen
    ctx,pg=nieuw(b,DESK,'pro',init=FAKE)
    mic=pg.get_by_test_id('chat-microfoon')
    for code,verw in [('not-allowed','toestemming'),('no-speech','niets gehoord'),('audio-capture','geen microfoon'),('network','niet bereikbaar')]:
        mic.click(); pg.wait_for_timeout(100); pg.evaluate(f"__fout('{code}')"); pg.wait_for_timeout(150)
        t=pg.get_by_test_id('chat-spraakfout').inner_text() if pg.get_by_test_id('chat-spraakfout').count() else ''
        ok(f'S11 fout {code}: Nederlandse melding, luisteren gestopt, chat blijft bruikbaar', verw in t.lower() and mic.get_attribute('aria-pressed')=='false' and pg.get_by_test_id('chat-invoer').is_enabled(), t)
    mic.click(); pg.wait_for_timeout(100)
    ok('S12 opnieuw starten wist de oude foutmelding', pg.get_by_test_id('chat-spraakfout').count()==0)
    # wisselen van pagina laat de microfoon los
    pg.evaluate("location.hash='#/kompas/projecten'"); pg.wait_for_timeout(800)
    ok('S13 pagina verlaten tijdens luisteren: spraakherkenning afgebroken', pg.evaluate('window.__ABORT||0')>=1)
    ctx.close()

    # start mislukt
    ctx,pg=nieuw(b,DESK,'pro',init=FAKE+'window.__REC_FAIL=true;')
    pg.get_by_test_id('chat-microfoon').click(); pg.wait_for_timeout(200)
    ok('S14 start gooit een fout: melding, geen crash, knop niet blijven hangen', pg.get_by_test_id('chat-spraakfout').count()==1 and pg.get_by_test_id('chat-microfoon').get_attribute('aria-pressed')=='false' and not pg.errs, str(pg.errs))
    ctx.close()

    # browser zonder ondersteuning: knop ontbreekt, chat werkt
    ctx,pg=nieuw(b,DESK,'pro',init='delete window.SpeechRecognition; delete window.webkitSpeechRecognition; try{Object.defineProperty(window,"webkitSpeechRecognition",{value:undefined})}catch(e){}')
    ok('S15 zonder spraakherkenning in de browser: geen microfoonknop, chat werkt gewoon', pg.get_by_test_id('chat-microfoon').count()==0 and pg.get_by_test_id('chat-invoer').is_visible() and pg.get_by_test_id('chat-verstuur').is_visible())
    ctx.close()

    # tijdens een lopend antwoord is de knop uitgeschakeld; mobiel past in de breedte
    ctx,pg=nieuw(b,MOB,'pro',init=FAKE)
    ok('S16 mobiel: microfoonknop zichtbaar, geen horizontale overflow', pg.get_by_test_id('chat-microfoon').is_visible() and geenhscroll(pg))
    pg.screenshot(path='shots/chat_6_microfoon_mobiel.png')
    ctx.close()
    b.close()
finally:
    srv.terminate()
f=[r for r in res if not r[1]]
print(f'\n{len(res)-len(f)}/{len(res)} OK')
for n,c,d in f: print('FAIL',n,d)
sys.exit(1 if f else 0)
