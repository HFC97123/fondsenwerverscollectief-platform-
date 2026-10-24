# Inklapbare zijkolommen in de chatwerkruimte: Gesprekken links en Projectoverzicht rechts (strook van 36 px met uitklapknop).
# Draait de echte app tegen de nagebootste Supabase; de chat-Edge-Function wordt in de pagina nagebootst (SSE-stream)
# zodat de request-payloads van de chat gecontroleerd kunnen worden.
import subprocess, time, sys, os, re, json
from playwright.sync_api import sync_playwright
os.chdir(os.path.dirname(os.path.abspath(__file__)))
PORT=8784
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


def midden(pg,tid):
    b=pg.get_by_test_id(tid).bounding_box(); return b['x']+b['width']/2, b['y']+b['height']/2
def sleep(pg,tid,naar_x,stappen=12):
    x,y=midden(pg,tid); pg.mouse.move(x,y); pg.mouse.down(); pg.mouse.move(naar_x,y,steps=stappen); pg.mouse.up(); pg.wait_for_timeout(450)
def sleep_delta(pg,tid,dx):
    x,y=midden(pg,tid); sleep(pg,tid,x+dx)
try:
  with sync_playwright() as p:
    b=p.chromium.launch()
    ctx,pg=nieuw(b,DESK,'pro')
    open_rij(pg,'Projectplan Buurtkeuken')
    w=lambda t: pg.get_by_test_id(t).bounding_box()['width']
    dr=pg.locator('.fwk-cw-drie')
    ok('D1 start: sleepgrepen links en rechts aanwezig; GEEN Inklappen-knoppen en geen strook', pg.get_by_test_id('kolom-gesprekken-handvat').is_visible() and pg.get_by_test_id('kolom-project-handvat').is_visible() and pg.get_by_text('Inklappen').count()==0 and pg.locator('[data-testid$="-inklappen"],[data-testid$="-uitklappen"]').count()==0)
    ok('D1b grepen zijn toegankelijk: role=separator, verticaal, focusbaar, Nederlandse naam', pg.get_by_test_id('kolom-gesprekken-handvat').get_attribute('role')=='separator' and pg.get_by_test_id('kolom-gesprekken-handvat').get_attribute('aria-orientation')=='vertical' and pg.get_by_test_id('kolom-gesprekken-handvat').get_attribute('tabindex')=='0' and 'Gesprekken' in pg.get_by_test_id('kolom-gesprekken-handvat').get_attribute('aria-label'))
    l0=w('kolom-gesprekken'); r0=w('kolom-project'); c0=w('kolom-chat')
    # links verbreden
    sleep_delta(pg,'kolom-gesprekken-handvat',+80)
    ok('D2 links naar rechts slepen maakt de kolom breder (~+80 px), chat smaller', 70<=w('kolom-gesprekken')-l0<=90 and w('kolom-chat')<c0-60, f'{l0}->{w("kolom-gesprekken")}')
    ok('D2b keuze onthouden (breedte in localStorage)', int(pg.evaluate("localStorage.getItem('fwk-chat-links-breedte')"))==round(w('kolom-gesprekken')))
    breed_links=w('kolom-gesprekken')
    # smaller maar niet onder het minimum
    sleep_delta(pg,'kolom-gesprekken-handvat',-(breed_links-170))
    ok('D3 naar links slepen tot net boven de inklapgrens: minimaal 200 px, nog open', 196<=w('kolom-gesprekken')<=204 and pg.locator('.fwk-cw-drie').get_attribute('data-links')=='open', str(w('kolom-gesprekken')))
    # helemaal naar links = inklappen
    sleep(pg,'kolom-gesprekken-handvat',5)
    ok('D4 helemaal naar links slepen klapt de kolom in: strook van 36 px met label, chat veel breder', 30<=w('kolom-gesprekken')<=40 and pg.get_by_test_id('kolom-gesprekken-uitklappen').is_visible() and 'Gesprekken' in pg.get_by_test_id('kolom-gesprekken-uitklappen').inner_text() and w('kolom-chat')>c0+150, f'{w("kolom-gesprekken")} {w("kolom-chat")}')
    ok('D4b gespreklijst blijft gemount (alleen verborgen), geen horizontale scroll, onthouden', pg.get_by_test_id('conversations-list').count()==1 and not pg.get_by_test_id('conversations-list').is_visible() and geenhscroll(pg) and pg.evaluate("localStorage.getItem('fwk-chat-links-ingeklapt')")=='1')
    pg.screenshot(path='shots/chat_4_links_ingeklapt.png')
    # klikken op de strook klapt uit
    pg.get_by_test_id('kolom-gesprekken-uitklappen').click(); pg.wait_for_timeout(450)
    ok('D5 klik op de strook klapt uit; lijst zichtbaar; focus op de greep', w('kolom-gesprekken')>190 and pg.get_by_test_id('conversations-list').is_visible() and pg.evaluate("document.activeElement.getAttribute('data-testid')")=='kolom-gesprekken-handvat', str(w('kolom-gesprekken')))
    # inklappen en vanuit de ingeklapte staat terugslepen
    sleep(pg,'kolom-gesprekken-handvat',3)
    sleep_delta(pg,'kolom-gesprekken-handvat',+250)
    ok('D6 vanuit de strook naar rechts slepen klapt uit en volgt de muis (~290 px)', 270<=w('kolom-gesprekken')<=310 and pg.get_by_test_id('conversations-list').is_visible(), str(w('kolom-gesprekken')))
    # maximum
    sleep_delta(pg,'kolom-gesprekken-handvat',+700)
    ok('D7 niet breder dan 480 px', 476<=w('kolom-gesprekken')<=484, str(w('kolom-gesprekken')))
    ok('D7b chat blijft bruikbaar breed genoeg en geen horizontale overflow', w('kolom-chat')>=400 and geenhscroll(pg), str(w('kolom-chat')))
    # rechts
    sleep_delta(pg,'kolom-project-handvat',-60)
    ok('D8 rechterkolom: naar links slepen maakt hem breder (~+60 px)', 50<=w('kolom-project')-r0<=70, f'{r0}->{w("kolom-project")}')
    sleep(pg,'kolom-project-handvat',1435)
    ok('D9 rechterkolom helemaal naar rechts slepen klapt hem in: strook van 36 px met Projectoverzicht', 30<=w('kolom-project')<=40 and pg.get_by_test_id('kolom-project-uitklappen').is_visible() and 'Projectoverzicht' in pg.get_by_test_id('kolom-project-uitklappen').inner_text())
    ok('D9b projectoverzicht blijft gemount, linkerkolom ongewijzigd', pg.get_by_test_id('project-context-panel').count()==1 and not pg.get_by_test_id('project-context-panel').is_visible() and 470<=w('kolom-gesprekken')<=490)
    pg.screenshot(path='shots/chat_4_beide_aangepast.png')
    # chat werkt
    stuur(pg,'Hallo met aangepaste kolommen',1500)
    ok('D10 chat werkt met aangepaste kolommen', 'Dit is het antwoord van de test.' in txt(pg) and len(posts(pg))==1)
    # na herladen onthouden
    pg.reload(); pg.wait_for_timeout(1700)
    ok('D11 na herladen: links ~480 px breed, rechts ingeklapt', 470<=w('kolom-gesprekken')<=490 and pg.get_by_test_id('kolom-project-uitklappen').count()==1)
    # loslaten stopt het slepen
    x,y=midden(pg,'kolom-gesprekken-handvat'); pg.mouse.move(x,y); pg.mouse.down(); pg.mouse.move(x-60,y,steps=6); pg.mouse.up(); pg.wait_for_timeout(400); na=w('kolom-gesprekken'); pg.mouse.move(x-200,y,steps=6); pg.wait_for_timeout(300)
    ok('D12 na loslaten volgt de kolom de muis niet meer; body-selectie en cursor hersteld', abs(w('kolom-gesprekken')-na)<2 and pg.evaluate("document.body.style.userSelect")=='' and pg.evaluate("document.body.style.cursor")=='')
    # toetsenbord
    pg.get_by_test_id('kolom-gesprekken-handvat').focus(); w0=w('kolom-gesprekken')
    pg.keyboard.press('ArrowLeft'); pg.keyboard.press('ArrowLeft'); pg.wait_for_timeout(450)
    ok('D13 toetsenbord: pijltje links maakt de kolom 24 px per druk smaller', 40<=w0-w('kolom-gesprekken')<=56, f'{w0}->{w("kolom-gesprekken")}')
    pg.keyboard.press('Enter'); pg.wait_for_timeout(450)
    ok('D14 Enter op de greep klapt de kolom in; nogmaals uit', 30<=w('kolom-gesprekken')<=40 and pg.evaluate("document.activeElement.getAttribute('data-testid')")=='kolom-gesprekken-handvat')
    pg.keyboard.press('Enter'); pg.wait_for_timeout(450)
    ok('D14b Enter klapt weer uit naar de laatst gekozen breedte', w('kolom-gesprekken')>190)
    ok('D15 geen pageerrors/console errors', not pg.errs and not pg.cons, str(pg.errs+pg.cons))
    ctx.close()

    # zonder project: geen rechtergreep
    ctx,pg=nieuw(b,DESK,'pro')
    ok('D16 zonder project: geen rechterkolom en geen rechtergreep', pg.get_by_test_id('kolom-project').count()==0 and pg.get_by_test_id('kolom-project-handvat').count()==0)
    sleep(pg,'kolom-gesprekken-handvat',4)
    ok('D17 zonder project: links inklappen geeft de chat de ruimte (geen overflow)', 30<=pg.get_by_test_id('kolom-gesprekken').bounding_box()['width']<=40 and pg.get_by_test_id('kolom-chat').bounding_box()['width']>1100 and geenhscroll(pg))
    ctx.close()

    # opgeslagen voorkeur en geblokkeerde opslag
    ctx,pg=nieuw(b,DESK,'pro',init="try{localStorage.setItem('fwk-chat-rechts-ingeklapt','1');localStorage.setItem('fwk-chat-links-breedte','999')}catch(e){}")
    open_rij(pg,'Projectplan Buurtkeuken')
    ok('D18 opgeslagen voorkeur: rechts begint ingeklapt; belachelijke opgeslagen breedte (999) wordt begrensd op 480', pg.get_by_test_id('kolom-project-uitklappen').count()==1 and 476<=pg.get_by_test_id('kolom-gesprekken').bounding_box()['width']<=484)
    ctx.close()
    ctx,pg=nieuw(b,DESK,'pro',init="Object.defineProperty(window,'localStorage',{get(){throw new Error('geblokkeerd')}})")
    open_rij(pg,'Projectplan Buurtkeuken')
    sleep(pg,'kolom-gesprekken-handvat',4)
    ok('D19 localStorage geblokkeerd: slepen en inklappen werken, geen fouten', pg.get_by_test_id('kolom-gesprekken-uitklappen').count()==1 and not pg.errs, str(pg.errs))
    ctx.close()

    # tablet en mobiel
    for naam,vp in [('tablet',TAB),('mobiel',MOB)]:
        ctx,pg=nieuw(b,vp,'pro')
        ok(f'D20 {naam}: geen sleepgrepen of stroken (lade/sheet blijft zoals het was)', pg.locator('[data-testid$="-handvat"],[data-testid$="-uitklappen"]').count()==0 and geenhscroll(pg))
        ctx.close()
    ctx,pg=nieuw(b,DESK,'free')
    ok('D21 Free: geen werkruimte en geen grepen', pg.get_by_test_id('chat-werkruimte').count()==0 and pg.locator('[data-testid$="-handvat"]').count()==0)
    ctx.close()
    b.close()
finally:
    srv.terminate()
f=[r for r in res if not r[1]]
print(f'\n{len(res)-len(f)}/{len(res)} OK')
for n,c,d in f: print('FAIL',n,d)
sys.exit(1 if f else 0)
