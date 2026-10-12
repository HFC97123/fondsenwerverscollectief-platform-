# Inklapbare zijkolommen in de chatwerkruimte: Gesprekken links en Projectoverzicht rechts (strook van 36 px met uitklapknop).
# Draait de echte app tegen de nagebootste Supabase; de chat-Edge-Function wordt in de pagina nagebootst (SSE-stream)
# zodat de request-payloads van de chat gecontroleerd kunnen worden.
import subprocess, time, sys, os, re, json
from playwright.sync_api import sync_playwright
os.chdir(os.path.dirname(os.path.abspath(__file__)))
PORT=8784
srv = subprocess.Popen(['python3','-m','http.server',str(PORT),'-d','web'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
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

LEEG=''
try:
  with sync_playwright() as p:
    b=p.chromium.launch()
    ctx,pg=nieuw(b,DESK,'pro')
    open_rij(pg,'Projectplan Buurtkeuken')
    w=lambda t: pg.get_by_test_id(t).bounding_box()['width']
    dr=pg.locator('.fwk-cw-drie')
    ok('K1 start: beide kolommen open, beide inklapknoppen zichtbaar, geen uitklapstrook', pg.get_by_test_id('kolom-gesprekken-inklappen').is_visible() and pg.get_by_test_id('kolom-project-inklappen').is_visible() and pg.get_by_test_id('kolom-gesprekken-uitklappen').count()==0 and dr.get_attribute('data-links')=='open' and dr.get_attribute('data-rechts')=='open')
    breed0=w('kolom-chat'); links0=w('kolom-gesprekken'); rechts0=w('kolom-project')
    pg.get_by_test_id('kolom-gesprekken-inklappen').click(); pg.wait_for_timeout(500)
    ok('K2 links inklappen: strook van 36 px blijft zichtbaar met uitklapknop (aria-expanded=false, label Gesprekken)', 30<=w('kolom-gesprekken')<=40 and pg.get_by_test_id('kolom-gesprekken-uitklappen').is_visible() and pg.get_by_test_id('kolom-gesprekken-uitklappen').get_attribute('aria-expanded')=='false' and 'Gesprekken' in pg.get_by_test_id('kolom-gesprekken-uitklappen').inner_text(), str(w('kolom-gesprekken')))
    ok('K3 gespreklijst verborgen maar nog aanwezig (inhoud blijft bestaan)', not pg.get_by_test_id('conversations-list').is_visible() and pg.get_by_test_id('conversations-list').count()==1)
    ok('K4 chat wordt breder; projectoverzicht ongewijzigd', w('kolom-chat')>breed0+150 and abs(w('kolom-project')-rechts0)<2, f'{breed0}->{w("kolom-chat")}')
    ok('K5 focus staat na het inklappen op de uitklapknop', pg.evaluate("document.activeElement && document.activeElement.getAttribute('data-testid')")=='kolom-gesprekken-uitklappen')
    ok('K6 keuze onthouden in localStorage', pg.evaluate("localStorage.getItem('fwk-chat-links-ingeklapt')")=='1')
    ok('K7 geen horizontale overflow na inklappen', geenhscroll(pg))
    pg.get_by_test_id('kolom-project-inklappen').click(); pg.wait_for_timeout(500)
    ok('K8 rechts ook inklappen: strook 36 px met Projectoverzicht-knop, chat nog breder', 30<=w('kolom-project')<=40 and pg.get_by_test_id('kolom-project-uitklappen').is_visible() and 'Projectoverzicht' in pg.get_by_test_id('kolom-project-uitklappen').inner_text() and w('kolom-chat')>breed0+350, str(w('kolom-chat')))
    ok('K8b projectoverzicht blijft gemount, alleen verborgen', pg.get_by_test_id('project-context-panel').count()==1 and not pg.get_by_test_id('project-context-panel').is_visible())
    pg.screenshot(path='shots/chat_4_beide_ingeklapt.png')
    # de chat blijft bruikbaar
    stuur(pg,'Hallo met ingeklapte kolommen',1500)
    ok('K9 chat werkt met ingeklapte kolommen', 'Dit is het antwoord van de test.' in txt(pg) and len(posts(pg))==1)
    ctx2=ctx
    # onthouden na herladen
    pg.reload(); pg.wait_for_timeout(1700)
    ok('K10 na herladen blijven beide kolommen ingeklapt', pg.get_by_test_id('kolom-gesprekken-uitklappen').count()==1 and pg.locator('.fwk-cw-drie').get_attribute('data-links')=='dicht')
    pg.get_by_test_id('kolom-gesprekken-uitklappen').click(); pg.wait_for_timeout(500)
    ok('K11 links weer uitklappen: oorspronkelijke breedte terug, lijst zichtbaar, focus op inklapknop', abs(w('kolom-gesprekken')-links0)<2 and pg.get_by_test_id('conversations-list').is_visible() and pg.evaluate("document.activeElement.getAttribute('data-testid')")=='kolom-gesprekken-inklappen' and pg.evaluate("localStorage.getItem('fwk-chat-links-ingeklapt')")=='0')
    pg.keyboard.press('Tab'); pg.keyboard.press('Shift+Tab')
    pg.get_by_test_id('kolom-project-uitklappen').focus(); pg.keyboard.press('Enter'); pg.wait_for_timeout(500)
    ok('K12 rechts uitklappen met het toetsenbord (Enter)', abs(w('kolom-project')-rechts0)<2 and pg.get_by_test_id('project-context-panel').is_visible())
    ok('K13 geen pageerrors/console errors', not pg.errs and not pg.cons, str(pg.errs+pg.cons))
    ctx.close()

    # zonder project: geen rechterkolom, links kan nog wel inklappen
    ctx,pg=nieuw(b,DESK,'pro')
    ok('K14 zonder project: geen rechterkolom en geen rechter inklapknop', pg.get_by_test_id('kolom-project').count()==0 and pg.get_by_test_id('kolom-project-inklappen').count()==0)
    pg.get_by_test_id('kolom-gesprekken-inklappen').click(); pg.wait_for_timeout(500)
    ok('K15 zonder project: links inklappen geeft de chat de ruimte (geen overflow)', 30<=pg.get_by_test_id('kolom-gesprekken').bounding_box()['width']<=40 and pg.get_by_test_id('kolom-chat').bounding_box()['width']>1100 and geenhscroll(pg))
    ctx.close()

    # onthouden voorkeur uit eerder bezoek (rechts), localStorage geblokkeerd werkt ook
    ctx,pg=nieuw(b,DESK,'pro',init="try{localStorage.setItem('fwk-chat-rechts-ingeklapt','1')}catch(e){}")
    open_rij(pg,'Projectplan Buurtkeuken')
    ok('K16 opgeslagen voorkeur: rechts begint ingeklapt', pg.get_by_test_id('kolom-project-uitklappen').count()==1)
    ctx.close()
    ctx,pg=nieuw(b,DESK,'pro',init="Object.defineProperty(window,'localStorage',{get(){throw new Error('geblokkeerd')}})")
    open_rij(pg,'Projectplan Buurtkeuken')
    pg.get_by_test_id('kolom-gesprekken-inklappen').click(); pg.wait_for_timeout(400)
    ok('K17 localStorage geblokkeerd: inklappen werkt gewoon, geen fouten', pg.get_by_test_id('kolom-gesprekken-uitklappen').count()==1 and not pg.errs, str(pg.errs))
    ctx.close()

    # tablet en mobiel: geen vaste kolommen, dus ook geen inklapknoppen
    for naam,vp in [('tablet',TAB),('mobiel',MOB)]:
        ctx,pg=nieuw(b,vp,'pro')
        ok(f'K18 {naam}: geen inklapknoppen of stroken (lade/sheet blijft zoals het was)', pg.locator('[data-testid$="-inklappen"],[data-testid$="-uitklappen"]').count()==0 and geenhscroll(pg))
        ctx.close()

    # Free: ongewijzigd
    ctx,pg=nieuw(b,DESK,'free')
    ok('K19 Free: geen werkruimte en geen inklapknoppen', pg.get_by_test_id('chat-werkruimte').count()==0 and pg.locator('[data-testid$="-inklappen"]').count()==0)
    ctx.close()
    b.close()
finally:
    srv.terminate()
f=[r for r in res if not r[1]]
print(f'\n{len(res)-len(f)}/{len(res)} OK')
for n,c,d in f: print('FAIL',n,d)
sys.exit(1 if f else 0)
