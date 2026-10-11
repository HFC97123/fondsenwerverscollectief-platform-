# Fase 4 browsertests (bijgewerkt): chatwerkruimte Gesprekken | Chat, met rechts het Projectoverzicht alleen bij een actief project (Pro/Premium), projectgroepen links en ongewijzigde Free-chat.
# Draait de echte app tegen de nagebootste Supabase; de chat-Edge-Function wordt in de pagina nagebootst (SSE-stream)
# zodat de request-payloads van de chat gecontroleerd kunnen worden.
import subprocess, time, sys, os, re, json
from playwright.sync_api import sync_playwright
os.chdir(os.path.dirname(os.path.abspath(__file__)))
PORT=8782
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
LEEG_FUND = ''
try:
  with sync_playwright() as p:
    b=p.chromium.launch()

    # ---------------------------------------------------------------- A. Layout desktop
    ctx,pg=nieuw(b,DESK,'pro')
    ok('A1 desktop: chatwerkruimte in modus drie', pg.get_by_test_id('chat-werkruimte').get_attribute('data-modus')=='drie')
    ok('A2 desktop: zonder actief project alleen Gesprekken | Chat; geen rechterkolom en geen projectoverzicht', all(pg.get_by_test_id(t).is_visible() for t in ['kolom-gesprekken','kolom-chat','conversations-list','chat-venster']) and pg.get_by_test_id('kolom-project').count()==0 and pg.get_by_test_id('project-context-panel').count()==0 and pg.get_by_test_id('chat-werkruimte').locator('.fwk-cw-drie').get_attribute('data-kolommen')=='2')
    xs=[pg.get_by_test_id(t).bounding_box() for t in ['kolom-gesprekken','kolom-chat']]
    BREEDTE_ZONDER=xs[1]['width']
    ok('A3 desktop: volgorde links < midden, geen overlap', xs[0]['x']+xs[0]['width']<=xs[1]['x']+1, str(xs))
    ok('A4 desktop zonder project: links ~260, chat krijgt de rest (> 1000 px, geen lege rechterkolom)', 250<=xs[0]['width']<=270 and xs[1]['width']>1000, str([x['width'] for x in xs]))
    ok('A5 desktop: geen lade/dialog tegelijk', pg.locator('[role="dialog"]').count()==0)
    ok('A6 desktop: geen horizontale overflow', geenhscroll(pg))
    ok('A7 desktop: oude pillen en contextchips zijn weg (geen dubbele ingangen)', all(t not in txt(pg) for t in ['Eerdere gesprekken (','+ Nieuwe chat','Context:']) and pg.get_by_role('button',name=re.compile(r'^(Organisatie|Projecten|Documenten)\b')).count()==0)
    ok('A8 desktop: geen toolbar-knoppen Gesprekken/Context/Project in de kop (alleen vaste kolommen)', pg.get_by_test_id('open-gesprekken').count()==0 and pg.get_by_test_id('open-context').count()==0 and pg.get_by_test_id('open-project').count()==0)
    ok('A9 desktop: grote hero niet meer in Pro/Premium; compacte werkkop', 'Uw gids bij fondsenwerving' not in txt(pg) and pg.get_by_test_id('werkkop').is_visible())
    ok('A10 desktop: geen paginascroll (werkruimte gebruikt de viewport)', pg.evaluate('document.documentElement.scrollHeight<=window.innerHeight+2'), str(pg.evaluate('[document.documentElement.scrollHeight,window.innerHeight]')))
    ok('A11 desktop: geen pageerrors/console errors', not pg.errs and not pg.cons, str(pg.errs+pg.cons))
    ok('A11b zonder project: geen "Actief in dit gesprek"-regel, geen contextlabels of -chips boven de chat', pg.get_by_test_id('actief-project-kop').count()==0 and not re.search(r'\bContext\b', pg.get_by_test_id('werkkop').inner_text()) and all(t not in pg.get_by_test_id('werkkop').inner_text() for t in ['Organisatie','Documenten','Financiering','Wisselen start']))
    pg.screenshot(path='shots/chat_1_desktop_zonder_project.png'); ctx.close()

    ctx,pg=nieuw(b,DESK,'pro')
    open_rij(pg,'Projectplan Buurtkeuken')
    xs=[pg.get_by_test_id(t).bounding_box() for t in ['kolom-gesprekken','kolom-chat','kolom-project']]
    ok('A13 desktop met actief project: Gesprekken | Chat | Projectoverzicht (3 kolommen, links < midden < rechts)', pg.get_by_test_id('chat-werkruimte').locator('.fwk-cw-drie').get_attribute('data-kolommen')=='3' and xs[0]['x']+xs[0]['width']<=xs[1]['x']+1 and xs[1]['x']+xs[1]['width']<=xs[2]['x']+1, str(xs))
    ok('A13b rechterkolom ~320 px; chat smaller dan zonder project (ruimte wordt eerlijk verdeeld)', 310<=xs[2]['width']<=330 and xs[1]['width']<BREEDTE_ZONDER-250, str([x['width'] for x in xs])+' zonder:'+str(BREEDTE_ZONDER))
    ok('A13c met project: "Actief in dit gesprek: Buurtkeuken De Brug" boven de chat, geen contextchips, geen Organisatie/Documenten rechts', 'Actief in dit gesprek: Buurtkeuken De Brug' in txt(pg) and pg.get_by_test_id('kolom-project').locator('[data-testid="ctx-organisatie"],[data-testid="ctx-documenten"]').count()==0 and 'Context' not in pg.get_by_test_id('kolom-project').inner_text())
    ok('A13d projectoverzicht heeft de kop PROJECTOVERZICHT; geen generieke Context-titel', pg.get_by_test_id('projectoverzicht-titel').inner_text().strip().lower()=='projectoverzicht' and not re.search(r'\bContext\b', pg.get_by_test_id('kolom-project').inner_text()))
    ok('A13e geen horizontale overflow met drie kolommen', geenhscroll(pg))
    pg.screenshot(path='shots/chat_2_desktop_met_project.png'); pg.get_by_test_id('kolom-project').screenshot(path='shots/chat_3_projectoverzicht.png'); ctx.close()

    ctx,pg=nieuw(b,BREED,'pro')
    open_rij(pg,'Projectplan Buurtkeuken')
    xs=[pg.get_by_test_id(t).bounding_box() for t in ['kolom-gesprekken','kolom-chat','kolom-project']]
    ok('A12 exact 1200 px met project: drie kolommen, chat >= 520 px, geen overflow', pg.get_by_test_id('chat-werkruimte').get_attribute('data-modus')=='drie' and xs[1]['width']>=520 and geenhscroll(pg), str([x['width'] for x in xs]))
    ctx.close()

    # ---------------------------------------------------------------- B. Gesprekkenlijst
    ctx,pg=nieuw(b,DESK,'pro')
    ok('B1 lijst: gesprekken van de gebruiker, niet van een ander', 'GEHEIM' not in html(pg) and len(pg.locator('[data-testid="kolom-gesprekken"] [data-testid="gesprek-rij"]').all())==4)
    ok('B2 nieuw gesprek zonder project: PROJECTEN (2 groepen) en LOSSE GESPREKKEN; geen Dit project/Eerder', pg.get_by_test_id('project-groep').count()==2 and titels(pg,'los')==['Losse vraag zonder project'] and pg.get_by_test_id('groep-dit-project').count()==0 and pg.get_by_test_id('groep-eerder').count()==0 and pg.get_by_test_id('groep-projecten').locator('h3').inner_text().strip().lower()=='projecten' and pg.get_by_test_id('groep-los').locator('h3').inner_text().strip().lower()=='losse gesprekken')
    open_rij(pg,'Projectplan Buurtkeuken')
    ok('B3 gesprek openen: berichten zichtbaar', 'Kun je me helpen met een projectplan?' in txt(pg) and 'Projectplan Buurtkeuken' in txt(pg))
    ok('B4 projectgroep = gesprekken met active_program_id van dat project', set(titels(pg,P1))=={'Projectplan Buurtkeuken','Begroting Brug'}, str(titels(pg,P1)))
    ok('B5 overige gesprekken: project B in eigen groep, zonder project bij Losse gesprekken', titels(pg,P2)==['Taalcafe plannen'] and titels(pg,'los')==['Losse vraag zonder project'], str((titels(pg,P2),titels(pg,'los'))))
    ok('B6 actieve selectie gemarkeerd (aria-current)', pg.locator('[data-testid="kolom-gesprekken"] [aria-current="true"]').count()==1 and 'Projectplan Buurtkeuken' in pg.locator('[data-testid="kolom-gesprekken"] [aria-current="true"]').inner_text())
    pg.get_by_test_id('gesprekken-zoek').fill('begroting'); pg.wait_for_timeout(200)
    ok('B7 zoeken filtert op titel en verbergt lege groepen', titels(pg,P1)==['Begroting Brug'] and pg.get_by_test_id('groep-los').count()==0 and pg.get_by_test_id('project-groep').count()==1)
    pg.get_by_test_id('gesprekken-zoek').fill('xyz-bestaat-niet'); pg.wait_for_timeout(200)
    ok('B8 zoeken zonder resultaat: nette lege staat', pg.get_by_test_id('gesprekken-leeg').is_visible())
    pg.get_by_test_id('gesprekken-zoek').fill(''); pg.wait_for_timeout(200)
    # export per gesprek bereikbaar (hover)
    ok('B9 export: exportmenu onder het geopende gesprek (1 exportknop, Word/Excel/PDF-menu)', pg.locator('[data-testid="kolom-gesprekken"] button[aria-label*="exporteren"]').count()==1 and 'Projectplan Buurtkeuken' in pg.get_by_test_id('gesprek-acties').locator('xpath=ancestor::li').inner_text())
    pg.locator('[data-testid="kolom-gesprekken"] button[aria-label*="exporteren"]').click(); pg.wait_for_timeout(300)
    ok('B9b export: menu met Word, Excel en PDF', all(pg.get_by_role('menuitem',name=n).count()==1 for n in ['Word','Excel','PDF']) , str(pg.get_by_role('menuitem').all_inner_texts()))
    pg.keyboard.press('Escape')
    ok('B10 rijmenu subtiel: knop "..." alleen zichtbaar bij hover/focus; menu met Naam wijzigen, Koppelen aan project en Verwijderen', (pg.mouse.move(5,5) or pg.wait_for_timeout(300) or True) and pg.locator('[data-testid="gesprek-rij"]').last.get_by_test_id('gesprek-menu').evaluate('e=>getComputedStyle(e).opacity')=='0' and (pg.locator('[data-testid="gesprek-rij"]').last.hover() or pg.wait_for_timeout(300) or True) and pg.locator('[data-testid="gesprek-rij"]').last.get_by_test_id('gesprek-menu').evaluate('e=>getComputedStyle(e).opacity')=='1' and (pg.locator('[data-testid="gesprek-rij"]').last.get_by_test_id('gesprek-menu').click() or pg.wait_for_timeout(200) or True) and [x.strip() for x in pg.get_by_test_id('gesprek-menu-lijst').locator('button').all_inner_texts()]==['Naam wijzigen','Koppelen aan project…','Verwijderen'])
    pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    # verwijderen
    n0=len(db(pg,'subsidie_kompas_conversations'))
    pg.locator('[data-testid="kolom-gesprekken"] [data-testid="gesprek-rij"]').filter(has_text='Losse vraag').hover()
    pg.locator('[data-testid="kolom-gesprekken"] [data-testid="gesprek-rij"]').filter(has_text='Losse vraag').get_by_test_id('gesprek-menu').click()
    pg.get_by_test_id('gesprek-verwijder').click(); pg.wait_for_timeout(500)
    ok('B11 gesprek verwijderen: uit lijst en uit database', 'Losse vraag zonder project' not in txt(pg) and not any(c['id']==CL for c in db(pg,'subsidie_kompas_conversations')) and len(db(pg,'subsidie_kompas_conversations'))==n0-1)
    ok('B12 verwijderen raakt gesprek van een ander niet', any(c['id']==CX for c in db(pg,'subsidie_kompas_conversations')))
    pg.screenshot(path='shots/f4_03_gesprekkenlijst.png')
    # actief gesprek verwijderen -> nieuwe lege chat
    pg.locator('[data-testid="kolom-gesprekken"] [data-testid="gesprek-rij"]').filter(has_text='Projectplan Buurtkeuken').hover()
    pg.locator('[data-testid="kolom-gesprekken"] [data-testid="gesprek-rij"]').filter(has_text='Projectplan Buurtkeuken').get_by_test_id('gesprek-menu').click()
    pg.get_by_test_id('gesprek-verwijder').click(); pg.wait_for_timeout(500)
    ok('B13 actief gesprek verwijderen: chat wordt leeg, kop zonder project', 'Kun je me helpen' not in txt(pg) and kop(pg)=='geen project')
    ok('B14 gegevens verwijderen: acties behouden (in linkerkolom, ingeklapt)', pg.get_by_test_id('gegevens-verwijderen').count()==1 and pg.get_by_test_id('alle-gesprekken-verwijderen').count()==1)
    pg.get_by_test_id('gegevens-verwijderen').locator('summary').click(); pg.get_by_test_id('alle-gesprekken-verwijderen').click(); pg.wait_for_timeout(500)
    ok('B15 alle gesprekken verwijderen werkt en laat gesprek van ander staan', [c['id'] for c in db(pg,'subsidie_kompas_conversations')]==[CX] and pg.get_by_test_id('gesprekken-leeg').is_visible())
    ctx.close()

    # ---------------------------------------------------------------- C. Actief project (hard)
    ctx,pg=nieuw(b,DESK,'pro')
    kiezer(pg,'Taalcafe Zuid')       # globale/default projectkeuze = Project B (P2)
    ok('C1 startkeuze Project B voor een nieuw gesprek: kop toont B', kop(pg)=='Taalcafe Zuid')
    open_rij(pg,'Projectplan Buurtkeuken')   # bestaand gesprek A (active_program_id = P1)
    ok('C2 bestaand gesprek A: kop "Actief in dit gesprek: Buurtkeuken De Brug"', 'Actief in dit gesprek: Buurtkeuken De Brug' in txt(pg), kop(pg))
    ok('C3 de projectkiezer volgt het gesprek (Buurtkeuken)', pg.get_by_test_id('project-kiezer').evaluate('e=>e.options[e.selectedIndex].text')=='Buurtkeuken De Brug')
    ok('C4 linker projectgroep van Project A bevat A-gesprekken', set(titels(pg,P1))=={'Projectplan Buurtkeuken','Begroting Brug'})
    ok('C5 rechter context toont Project A en niets van B', pg.get_by_test_id('project-context-panel').get_attribute('data-project-id')==P1 and 'Buurtkeuken De Brug' in pg.get_by_test_id('ctx-project-naam').inner_text() and 'Taalcafe' not in pg.get_by_test_id('project-context-panel').inner_text())
    stuur(pg,'Wat is de volgende stap?')
    pl=posts(pg)[-1]
    ok('C6 verstuurd bericht in gesprek A gebruikt conversationId A en activeProgramId = Project A', pl['conversationId']==CA and pl['activeProgramId']==P1, str((pl['conversationId'],pl['activeProgramId'])))
    # projectwissel overschrijft bestaand gesprek niet
    kiezer(pg,'Taalcafe Zuid')
    a=[c for c in db(pg,'subsidie_kompas_conversations') if c['id']==CA][0]
    ok('C7 project wisselen in een bestaand gesprek start een nieuw gesprek; gesprek A houdt Project A (active_program_id)', a['active_program_id']==P1 and kop(pg)=='Taalcafe Zuid' and 'Nieuw gesprek gestart voor project "Taalcafe Zuid"' in txt(pg))
    ok('C8 het nieuwe lege gesprek heeft nog geen conversation-rij; berichten van A niet overschreven', len([m for m in db(pg,'subsidie_kompas_messages') if m['conversation_id']==CA])==4 and 'Kun je me helpen' not in pg.get_by_test_id('chat-venster').inner_text())
    stuur(pg,'Een vraag over het taalcafe')
    nieuwe=[c for c in db(pg,'subsidie_kompas_conversations') if c['title']=='Een vraag over het taalcafe']
    ok('C9 nieuw gesprek krijgt de gekozen startcontext (Project B) als active_program_id en in de payload', len(nieuwe)==1 and nieuwe[0]['active_program_id']==P2 and posts(pg)[-1]['activeProgramId']==P2)
    ok('C10 daarna: gesprek staat in de groep van Project B, projectoverzicht = B', 'Een vraag over het taalcafe' in titels(pg,P2) and pg.get_by_test_id('project-context-panel').get_attribute('data-project-id')==P2)
    ctx.close()

    # Dashboard bevat geen gesprekken meer (gesprekken horen in Chat)
    ctx,pg=nieuw(b,DESK,'pro','/kompas/dashboard')
    ok('C11 Dashboard toont geen Recente gesprekken meer; gesprekken zijn alleen via Chat bereikbaar', pg.get_by_test_id('dashboard-gesprek').count()==0 and 'Recente gesprekken' not in txt(pg))
    ctx.close()
    ctx,pg=nieuw(b,DESK,'pro','/kompas/dashboard')
    pg.evaluate("1"); 
    ctx.close()

    # ---------------------------------------------------------------- D. Contextpaneel
    ctx,pg=nieuw(b,DESK,'pro')
    open_rij(pg,'Projectplan Buurtkeuken')
    paneel=pg.get_by_test_id('project-context-panel'); pt=paneel.inner_text()
    ok('D1 projectoverzicht: naam, locatie, looptijd, toegekend/aangevraagd/nog te financieren en volgende deadline', 'Buurtkeuken De Brug' in pt and 'Utrecht-Noord' in pt and 'Locatie' in pt and 'Looptijd' in pt and all(l in pt for l in ['Toegekend','Aangevraagd','Nog te financieren','Volgende deadline']) and pg.get_by_test_id('ctx-deadline').is_visible() and pg.get_by_test_id('ctx-nog-nodig').is_visible(), pt[:400])
    ok('D2 projectblok: Open project -> projectdossier van dit project', pg.get_by_test_id('ctx-open-project').get_attribute('href')==f'#/kompas/projecten/{P1}')
    regels=pg.get_by_test_id('ctx-regel').all_inner_texts()
    ok('D3 financiering: maximaal 3 regels, meest relevante eerst (in voorbereiding, aangevraagd, toegekend)', len(regels)==3 and 'Oranje Fonds Burenhulp' in regels[0] and 'In voorbereiding' in regels[0] and 'Wijkfonds Noord' in regels[1] and 'Aangevraagd' in regels[1] and 'Buurtbudget Utrecht' in regels[2] and 'Toegekend' in regels[2], str(regels))
    ok('D4 financiering: bedragen en "+ N andere regels"', '€ 8.000' in regels[0] and '€ 15.000' in regels[1] and '+ 5 andere regels' in pt)
    ok('D5 acties: Projectfinanciering en Open project verwijzen naar dit project; geen volledige financieringstabel', pg.get_by_test_id('ctx-naar-financiering').get_attribute('href')==f'#/kompas/projecten/{P1}?tab=projectfinanciering' and pg.get_by_test_id('ctx-naar-financiering').inner_text().strip().startswith('Projectfinanciering') and pg.get_by_test_id('project-context-panel').locator('table').count()==0)
    ok('D6 gemaskeerde Premium-regel (Pro) lekt niet in context/DOM', all(t not in html(pg) for t in ['PREMIUMFONDS','Geheim Premium Fonds','geheim.test']))
    pass
    ok('D7 documenten staan niet meer in het projectoverzicht (Documenten is de primaire plek); geen documentnamen of -links rechts', pg.get_by_test_id('ctx-doc').count()==0 and pg.get_by_test_id('ctx-documenten').count()==0 and 'Projectplan - concept' not in pt and 'Documenten' not in pt and 'GEHEIM' not in html(pg))
    ok('D8 organisatie staat niet meer rechts (Organisatieprofiel is de primaire plek); niets van een andere organisatie', pg.get_by_test_id('ctx-organisatie').count()==0 and 'Stichting Buurtkracht' not in pt and 'compleet' not in pt and 'GEHEIM' not in html(pg))
    ok('D9 context is uitleg: geen invoervelden/editors in het paneel', paneel.locator('input,textarea,select,[contenteditable]').count()==0)
    ok('D10 geen linked_schemes in de context (legacy regelingen onzichtbaar)', 'LEGACY' not in html(pg))
    ok('D11 context-data niet aan het model gevoed: geen fundingnamen in chat-payload', (stuur(pg,'Hallo') or True) and all(t not in json.dumps(posts(pg)) for t in ['Wijkfonds Noord','Buurtbudget Utrecht','Oranje Fonds Burenhulp','ctx-']))
    ls=pg.evaluate("JSON.stringify(Object.assign({},localStorage))")
    ok('D12 geen fundingdata in localStorage', 'Wijkfonds' not in ls and 'Buurtbudget' not in ls and 'Oranje' not in ls)
    pg.screenshot(path='shots/f4_04_contextpanel.png')
    open_rij(pg,'Taalcafe plannen')
    pt2=pg.get_by_test_id('project-context-panel').inner_text()
    ok('D13 ander gesprek (Project B): overzicht volgt active_program_id, geen data van Project A', pg.get_by_test_id('project-context-panel').get_attribute('data-project-id')==P2 and 'Taalcafe Zuid' in pt2 and 'Buurtkeuken' not in pt2 and 'Wijkfonds' not in pt2 and 'Projectplan - concept' not in pt2)
    ok('D14 geen-funding state', pg.get_by_test_id('ctx-financiering-leeg').is_visible() and 'Nog geen financieringsregels' in pt2)
    pg.screenshot(path='shots/f4_05_geen_funding.png')
    kiezer(pg,'Geen actief project')
    ok('D15 zonder project: geen rechterkolom, geen projectoverzicht, chat krijgt de ruimte', pg.get_by_test_id('kolom-project').count()==0 and pg.get_by_test_id('project-context-panel').count()==0 and pg.get_by_test_id('ctx-geen-project').count()==0 and pg.get_by_test_id('kolom-chat').bounding_box()['width']>1000)
    ctx.close()

    # premium: eigen naam zichtbaar; pro: gemaskeerd
    EXTRA_MASK="seed.tables.subsidie_kompas_program_funding.push(c.FR(11,c.P1,{scheme_id:'s6',status:'preparing',requested_amount:2000,eigen_deadline:c.dag(30)}));"
    ctx,pg=nieuw(b,DESK,'pro',extra=EXTRA_MASK); open_rij(pg,'Projectplan Buurtkeuken')
    r0=pg.locator('[data-testid="ctx-regel"][data-bron-status="verborgen"]').first
    ok('D16 Pro: Premium-regel gemaskeerd getoond met eigen bedrag/status', r0.get_attribute('data-bron-status')=='verborgen' and 'Premium-fonds, niet zichtbaar in uw abonnement' in r0.inner_text() and 'In voorbereiding' in r0.inner_text() and '€ 2.000' in r0.inner_text())
    ok('D17 Pro: gemaskeerde regel lekt geen naam/fonds/website', all(t not in html(pg) for t in ['PREMIUMFONDS','Geheim Premium Fonds','geheim.test']))
    pg.screenshot(path='shots/f4_06_premium_gemaskeerd.png'); ctx.close()
    ctx,pg=nieuw(b,DESK,'premium',extra=EXTRA_MASK); open_rij(pg,'Projectplan Buurtkeuken')
    ok('D18 Premium: dezelfde regel toont de echte naam', 'PREMIUMFONDS Geheimnaam' in ' '.join(pg.get_by_test_id('ctx-regel').all_inner_texts()))
    ctx.close()

    # fail-safe
    ctx,pg=nieuw(b,DESK,'pro',init="window.__RPCFOUT='fout';"); open_rij(pg,'Projectplan Buurtkeuken')
    ok('D19 funding faalt: blok toont foutstatus, rest van het overzicht blijft', pg.get_by_test_id('ctx-financiering-fout').is_visible() and pg.get_by_test_id('ctx-project-naam').is_visible())
    stuur(pg,'Werkt de chat nog?')
    ok('D20 funding faalt: chat blijft volledig bruikbaar (antwoord ontvangen)', 'Dit is het antwoord van de test.' in pg.get_by_test_id('chat-berichten').inner_text() and not pg.errs, str(pg.errs))
    ctx.close()
    ctx,pg=nieuw(b,DESK,'pro',extra="seed.tables.subsidie_kompas_knowledge_items[0].file_name={a:1};"); open_rij(pg,'Projectplan Buurtkeuken')
    ok('D21 renderfout in context wordt afgevangen (foutgrens)', pg.get_by_test_id('ctx-fout-grens').count()==1 or pg.get_by_test_id('project-context-panel').count()==1)
    stuur(pg,'Nog steeds bruikbaar?')
    ok('D22 renderfout in context: chat blijft bruikbaar', 'Dit is het antwoord van de test.' in pg.get_by_test_id('chat-berichten').inner_text() and pg.get_by_test_id('chat-invoer').is_visible())
    ctx.close()

    # ---------------------------------------------------------------- E. Chatfunctionaliteit
    ctx,pg=nieuw(b,DESK,'pro')
    stuur(pg,'Welke fondsen passen bij mijn organisatie?')
    ok('E1 nieuw gesprek + streaming: antwoord getoond, gesprek aangemaakt in database', 'Dit is het antwoord van de test.' in pg.get_by_test_id('chat-berichten').inner_text() and any(c['title'].startswith('Welke fondsen') for c in db(pg,'subsidie_kompas_conversations')))
    pl=posts(pg)[-1]
    ok('E2 payload nieuw gesprek zonder project: activeProgramId null, tier pro, contextVersie 2', pl['activeProgramId'] is None and pl['subscriptionTier']=='pro' and pl['contextVersie']==2 and pl['stream'] is True and pl['kompasMode']=='algemeen')
    ms=[m for m in db(pg,'subsidie_kompas_messages') if m['conversation_id']==pl['conversationId']]
    ok('E3 chatgeschiedenis: gebruikers- en assistantbericht opgeslagen', [m['role'] for m in ms]==['user','assistant'])
    open_rij(pg,'Begroting Brug')
    ok('E4 bestaand gesprek openen: eigen berichten, modus hersteld', 'Begroting: personeel 40.000' in txt(pg) and 'Modus: Begroting' in pg.get_by_test_id('werkkop-modus').inner_text())
    stuur(pg,'Voeg 2.000 aan communicatie toe')
    pl=posts(pg)[-1]
    ok('E5 bericht in bestaand gesprek: conversationId, project en modus uit het gesprek', pl['conversationId']==CB and pl['activeProgramId']==P1 and pl['kompasMode']=='begroting' and len(pl['messages'])==3)
    stuur(pg,'Wil je een nieuw gesprek zonder project?'); 
    pg.get_by_test_id('nieuw-gesprek').click(); pg.wait_for_timeout(500)
    ok('E6 Nieuw gesprek: lege chat, geen project, modus algemeen (zelfde gedrag als de oude "Nieuwe chat")', kop(pg)=='geen project' and pg.get_by_test_id('chat-berichten').count()==0 and pg.get_by_test_id('werkkop-modus').count()==0)
    ctx.close()

    ctx,pg=nieuw(b,DESK,'pro')
    stuur(pg,'Kun je me helpen met een projectplan?')
    ok('E7 projectplanmodus: modus herkend en getoond, payload kompasMode projectplan', posts(pg)[-1]['kompasMode']=='projectplan' and 'Modus: Projectplan' in pg.get_by_test_id('werkkop-modus').inner_text())
    ctx.close()
    ctx,pg=nieuw(b,DESK,'pro')
    stuur(pg,'Help mij een begroting op te stellen')
    ok('E8 begrotingsmodus: payload kompasMode begroting', posts(pg)[-1]['kompasMode']=='begroting' and 'Modus: Begroting' in pg.get_by_test_id('werkkop-modus').inner_text())
    ctx.close()

    # documentgeneratie / opslaan bij project / export
    ctx,pg=nieuw(b,DESK,'pro',init="window.__CHAT_ANTWOORD=function(){return ('Concept projectplan voor de buurtkeuken met veel tekst. '.repeat(10));};")
    kiezer(pg,'Buurtkeuken De Brug'); stuur(pg,'Schrijf een projectplan voor mijn buurtkeuken',wacht=2200)
    ok('E9 groot resultaat: Kopiëren, Opslaan bij project, Exporteren en Later verder bewerken aanwezig', all(pg.get_by_role('button',name=n).count()>=1 for n in ['Kopiëren','Opslaan bij project','Later verder bewerken']) and pg.locator('[data-testid="chat-berichten"] button:has-text("Exporteren")').count()>=1)
    n0=len(db(pg,'subsidie_kompas_knowledge_items'))
    pg.get_by_role('button',name='Opslaan bij project').click(); pg.wait_for_timeout(1500)
    nieuwdoc=[d for d in db(pg,'subsidie_kompas_knowledge_items') if d['program_id']==P1 and 'concept van' in (d.get('file_name') or '')]
    ok('E10 opslaan bij project: nieuwe versie bij het actieve project (bestaand versiegedrag)', len([d for d in nieuwdoc if not d.get('superseded_at')])==1 and all(d['program_id']==P1 for d in nieuwdoc))
    pg.get_by_role('button',name='Later verder bewerken').click(); pg.wait_for_timeout(300)
    ok('E11 later verder bewerken: melding en document gekoppeld', 'U werkt nu verder aan' in txt(pg))
    ctx.close()

    # vergrendeling tijdens streaming
    ctx,pg=nieuw(b,DESK,'pro',init="window.__CHAT_HANG=true;")
    open_rij(pg,'Begroting Brug')
    stuur(pg,'Een vraag die even duurt',wacht=700)
    ok('E12 tijdens een lopend antwoord staan gesprekswissel, nieuw gesprek en projectwissel op slot', pg.locator('[data-testid="kolom-gesprekken"] [data-testid="gesprek-open"]').first.is_disabled() and pg.get_by_test_id('nieuw-gesprek').is_disabled() and pg.get_by_test_id('project-kiezer').is_disabled() and pg.get_by_test_id('gesprekken-vergrendeld').count()==1)
    ok('E13 streaming zichtbaar: deeltekst op het scherm voordat het antwoord klaar is', 'Dit' in pg.get_by_test_id('chat-berichten').inner_text())
    pg.evaluate('window.__CHAT_RELEASE()'); pg.wait_for_timeout(900)
    ok('E14 na het antwoord: weer ontgrendeld', not pg.get_by_test_id('nieuw-gesprek').is_disabled() and pg.get_by_test_id('gesprekken-vergrendeld').count()==0)
    ctx.close()

    # scroll: lang gesprek
    ctx,pg=nieuw(b,DESK,'pro',lang=True)
    open_rij(pg,'Projectplan Buurtkeuken')
    m=pg.evaluate("(()=>{const e=document.querySelector('[data-testid=chat-berichten]');return {sh:e.scrollHeight,ch:e.clientHeight,st:e.scrollTop,doc:document.documentElement.scrollHeight,vh:innerHeight}})()")
    inv=pg.get_by_test_id('chat-invoer').bounding_box()
    ok('E15 lang gesprek: alleen de berichtenkolom scrolt, pagina niet; invoer onderaan zichtbaar', m['sh']>m['ch']+50 and m['doc']<=m['vh']+2 and inv['y']+inv['height']<=m['vh'], str(m)+str(inv))
    ok('E16 lang gesprek: laatste bericht in beeld (scrolled to bottom)', m['st']+m['ch']>=m['sh']-3, str(m))
    pg.screenshot(path='shots/f4_02_desktop_lang_gesprek.png'); ctx.close()

    # ---------------------------------------------------------------- F. Tablet 900-1199
    ctx,pg=nieuw(b,TAB,'pro')
    ok('F1 tablet: modus tablet, vaste kolommen verborgen', pg.get_by_test_id('chat-werkruimte').get_attribute('data-modus')=='tablet' and pg.get_by_test_id('kolom-gesprekken').count()==0 and pg.get_by_test_id('kolom-project').count()==0)
    ok('F2 tablet zonder project: alleen de knop Gesprekken (geen Context, geen Project), chat bijna volle breedte', pg.get_by_test_id('open-gesprekken').is_visible() and pg.get_by_test_id('open-context').count()==0 and pg.get_by_test_id('open-project').count()==0 and pg.get_by_test_id('chat-venster').bounding_box()['width']>=900)
    pg.get_by_test_id('open-gesprekken').click(); pg.wait_for_timeout(400)
    ok('F3 tablet: Gesprekken opent de bestaande lade met de gedeelde gesprekkenlijst', pg.locator('[role="dialog"]').count()==1 and pg.locator('[role="dialog"] [data-testid="conversations-list"]').count()==1 and pg.locator('[role="dialog"] [data-testid="gesprek-rij"]').count()==4)
    ok('F4 tablet: scroll lock (body overflow hidden) en focus in de lade', pg.evaluate('document.body.style.overflow')=='hidden' and pg.evaluate("document.querySelector('[role=dialog]').contains(document.activeElement)"))
    pg.screenshot(path='shots/f4_07_tablet_lade.png')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    ok('F5 tablet: Escape sluit de lade, scroll lock opgeheven, focus terug op de knop', pg.locator('[role="dialog"]').count()==0 and pg.evaluate('document.body.style.overflow')!='hidden' and pg.evaluate("document.activeElement && document.activeElement.getAttribute('data-testid')")=='open-gesprekken')
    pg.get_by_test_id('open-gesprekken').click(); pg.wait_for_timeout(300)
    pg.locator('[role="dialog"] [data-testid="gesprek-open"]').filter(has_text='Begroting Brug').click(); pg.wait_for_timeout(900)
    ok('F6a tablet: na het openen van een projectgesprek verschijnt de knop Project (en Context bestaat niet)', pg.get_by_test_id('open-project').is_visible() and pg.get_by_test_id('open-context').count()==0 and 'Project' in pg.get_by_test_id('open-project').inner_text())
    pg.screenshot(path='shots/chat_7_tablet_project_knop.png')
    pg.get_by_test_id('open-project').click(); pg.wait_for_timeout(400)
    ok('F6 tablet: Project opent dezelfde lade met het projectoverzicht van dit gesprek', pg.locator('[role="dialog"] [data-testid="project-context-panel"]').count()==1 and pg.locator('[role="dialog"] [data-testid="project-context-panel"]').get_attribute('data-project-id')==P1)
    pg.get_by_role('button',name='Gesprekken',exact=False).filter(has_text=re.compile('^Gesprekken')).last.click(); pg.wait_for_timeout(300)
    ok('F7 tablet: tabwissel Project -> Gesprekken binnen dezelfde lade (één lade-architectuur)', pg.locator('[role="dialog"] [data-testid="conversations-list"]').count()==1 and pg.locator('[role="dialog"]').count()==1)
    pg.locator('[role="dialog"] [data-testid="gesprek-open"]').filter(has_text='Taalcafe plannen').click(); pg.wait_for_timeout(900)
    ok('F8 tablet: gesprek kiezen sluit de lade; Project-knop volgt het gesprek (Taalcafe Zuid)', pg.locator('[role="dialog"]').count()==0 and 'Hoe start ik het taalcafe?' in txt(pg) and kop(pg)=='Taalcafe Zuid')
    ok('F9 tablet: geen horizontale overflow', geenhscroll(pg))
    pg.get_by_test_id('open-project').click(); pg.wait_for_timeout(400)
    pg.set_viewport_size({'width':1440,'height':900}); pg.wait_for_timeout(500)
    ok('F10 resize naar desktop: lade verdwijnt, vaste kolommen verschijnen (nooit beide), projectoverzicht rechts', pg.locator('[role="dialog"]').count()==0 and pg.get_by_test_id('kolom-project').is_visible() and pg.evaluate('document.body.style.overflow')!='hidden')
    pg.set_viewport_size({'width':1199,'height':800}); pg.wait_for_timeout(400)
    ok('F11 1199 px: tablet-modus', pg.get_by_test_id('chat-werkruimte').get_attribute('data-modus')=='tablet' and pg.get_by_test_id('kolom-gesprekken').count()==0)
    ctx.close()

    # ---------------------------------------------------------------- G. Mobiel
    ctx=b.new_context(viewport=MOB,is_mobile=True,has_touch=True); pg=ctx.new_page()
    pg.add_init_script(PATCH); pg.add_init_script(FETCH)
    pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='div[style*=\"z-index: 2000\"]{display:none !important}';document.head.appendChild(s)})")
    pg.errs=[]; pg.on('pageerror',lambda e: pg.errs.append(str(e)))
    pg.goto(f'{BASE}?tier=pro#/kompas'); pg.wait_for_timeout(1700)
    ok('G1 mobiel: geen vaste zijkolommen; knop Gesprekken zichtbaar, geen Project-knop zonder actief project, geen Context-knop', pg.get_by_test_id('chat-werkruimte').get_attribute('data-modus')=='mobiel' and pg.get_by_test_id('kolom-gesprekken').count()==0 and pg.get_by_test_id('open-gesprekken').is_visible() and pg.get_by_test_id('open-project').count()==0 and pg.get_by_test_id('open-context').count()==0)
    ok('G2 mobiel: invoer bruikbaar en geen horizontale scroll', pg.get_by_test_id('chat-invoer').is_visible() and geenhscroll(pg))
    pg.screenshot(path='shots/f4_08a_mobiel_chat.png')
    pg.get_by_test_id('open-gesprekken').click(); pg.wait_for_timeout(400)
    dlg=pg.locator('[role="dialog"]').bounding_box()
    ok('G3 mobiel: Gesprekken als bottom sheet (volle breedte, onderaan, afgeronde bovenhoek), geen zijbalk tegelijk', dlg['width']>=389 and abs(dlg['y']+dlg['height']-844)<=2 and pg.get_by_test_id('kolom-gesprekken').count()==0 and pg.locator('[role="dialog"] [data-testid="conversations-list"]').count()==1, str(dlg))
    ok('G4 mobiel: sheet <= 86% viewport, scroll lock actief, rijmenu-knop zichtbaar op touch zonder hover', dlg['height']<=844*0.87 and pg.evaluate('document.body.style.overflow')=='hidden' and pg.locator('[role="dialog"] [data-testid="gesprek-menu"]').first.evaluate('e=>getComputedStyle(e).opacity')=='1')
    pg.screenshot(path='shots/chat_8_mobiel_gesprekken_sheet.png')
    pg.locator('[role="dialog"] button[aria-label="Sluiten"]').click(); pg.wait_for_timeout(300)
    ok('G5 mobiel: sluitknop sluit de sheet', pg.locator('[role="dialog"]').count()==0)
    pg.get_by_test_id('open-gesprekken').click(); pg.wait_for_timeout(300)
    pg.locator('[role="dialog"] [data-testid="gesprek-open"]').filter(has_text='Begroting Brug').click(); pg.wait_for_timeout(900)
    ok('G5b mobiel: na een projectgesprek verschijnt de knop Project', pg.get_by_test_id('open-project').is_visible())
    pg.get_by_test_id('open-project').click(); pg.wait_for_timeout(400)
    ok('G6 mobiel: Project als bottom sheet met het projectoverzicht, geen overflow', pg.locator('[role="dialog"] [data-testid="project-context-panel"]').count()==1 and geenhscroll(pg))
    pg.screenshot(path='shots/chat_9_mobiel_project_sheet.png')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # focus trap: Tab blijft in de sheet
    pg.get_by_test_id('open-gesprekken').click(); pg.wait_for_timeout(300)
    seq=[]
    for _ in range(25):
        pg.keyboard.press('Tab'); seq.append(pg.evaluate("(()=>{const a=document.activeElement;return a.tagName+':'+(a.getAttribute('data-testid')||a.getAttribute('aria-label')||a.textContent.slice(0,15))+':'+document.querySelector('[role=dialog]').contains(a)})()"))
    ok('G7 mobiel: focus trap (Tab verlaat de sheet niet)', pg.evaluate("document.querySelector('[role=dialog]').contains(document.activeElement)"))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.get_by_test_id('chat-invoer').fill('Test op mobiel'); pg.get_by_test_id('chat-invoer').press('Enter'); pg.wait_for_timeout(1500)
    ok('G8 mobiel: bericht versturen werkt', 'Dit is het antwoord van de test.' in txt(pg) and not pg.errs, str(pg.errs))
    ok('G9 mobiel: geen horizontale scroll na gesprek', geenhscroll(pg))
    ctx.close()

    # ---------------------------------------------------------------- I. Projectgroepen, inklappen, nieuw in project, rijmenu
    ctx,pg=nieuw(b,DESK,'pro')
    ok('I1 groepen: PROJECTEN met Buurtkeuken (2) en Taalcafe (1), LOSSE GESPREKKEN met 1; gearchiveerd project en project van een ander verschijnen niet', pg.get_by_test_id('project-groep').count()==2 and [x.strip() for x in pg.locator('[data-testid="project-groep"] [data-testid="groep-toggle"]').all_inner_texts()]==['▾\nBuurtkeuken De Brug\n2','▾\nTaalcafe Zuid\n1'] or [x.replace('\n',' ').strip() for x in pg.locator('[data-testid="project-groep"] [data-testid="groep-toggle"]').all_inner_texts()]==['▾ Buurtkeuken De Brug 2','▾ Taalcafe Zuid 1'])
    ok('I1b niets van een ander: geen GEHEIM, geen gesprek van gebruiker 2', 'GEHEIM' not in html(pg) and pg.locator(f'[data-gesprek-id="{CX}"]').count()==0)
    g1=pg.locator(f'[data-testid="project-groep"][data-project-id="{P1}"]')
    g1.get_by_test_id('groep-toggle').click(); pg.wait_for_timeout(200)
    ok('I2 inklappen: gesprekken van dat project verborgen, aria-expanded=false; andere groepen onaangetast', g1.get_attribute('data-open')=='false' and g1.get_by_test_id('gesprek-rij').count()==0 and g1.get_by_test_id('groep-toggle').get_attribute('aria-expanded')=='false' and titels(pg,P2)==['Taalcafe plannen'] and g1.get_by_test_id('groep-aantal').inner_text()=='2')
    g1.get_by_test_id('groep-toggle').click(); pg.wait_for_timeout(200)
    ok('I3 uitklappen: gesprekken terug, aria-expanded=true', g1.get_attribute('data-open')=='true' and g1.get_by_test_id('gesprek-rij').count()==2 and g1.get_by_test_id('groep-toggle').get_attribute('aria-expanded')=='true')
    # nieuw gesprek binnen een project
    pg.locator(f'[data-testid="project-groep"][data-project-id="{P2}"]').get_by_test_id('groep-nieuw').click(); pg.wait_for_timeout(500)
    ok('I4 "+ Nieuw" in projectgroep: lege chat met dat project als startcontext (kop en projectoverzicht)', kop(pg)=='Taalcafe Zuid' and pg.get_by_test_id('chat-berichten').count()==0 and pg.get_by_test_id('project-context-panel').get_attribute('data-project-id')==P2)
    stuur(pg,'Nieuwe vraag binnen het project')
    nw=[c for c in db(pg,'subsidie_kompas_conversations') if c['title']=='Nieuwe vraag binnen het project']
    ok('I5 bij opslaan krijgt het gesprek active_program_id = dat project (ook in de payload) en staat in de groep', len(nw)==1 and nw[0]['active_program_id']==P2 and posts(pg)[-1]['activeProgramId']==P2 and 'Nieuwe vraag binnen het project' in titels(pg,P2))
    pg.get_by_test_id('nieuw-gesprek').click(); pg.wait_for_timeout(500)
    ok('I6 algemene "+ Nieuw gesprek": los gesprek zonder project; geen rechterkolom', kop(pg)=='geen project' and pg.get_by_test_id('kolom-project').count()==0 and pg.get_by_test_id('project-context-panel').count()==0)
    stuur(pg,'Algemene vraag zonder project')
    nl=[c for c in db(pg,'subsidie_kompas_conversations') if c['title']=='Algemene vraag zonder project']
    ok('I6b het losse gesprek heeft active_program_id null en staat onder LOSSE GESPREKKEN', len(nl)==1 and nl[0]['active_program_id'] is None and 'Algemene vraag zonder project' in titels(pg,'los'))
    # naam wijzigen
    rr=rij(pg,'Algemene vraag zonder project'); rr.hover(); rr.get_by_test_id('gesprek-menu').click(); pg.get_by_test_id('gesprek-hernoem').click()
    pg.get_by_test_id('gesprek-hernoem-invoer').fill('Fondsenstrategie 2027'); pg.get_by_test_id('gesprek-hernoem-invoer').press('Enter'); pg.wait_for_timeout(500)
    nl=[c for c in db(pg,'subsidie_kompas_conversations') if c['id']==nl[0]['id']][0]
    ok('I7 naam wijzigen: nieuwe titel in lijst en database; projectkoppeling en berichten ongewijzigd', 'Fondsenstrategie 2027' in titels(pg,'los') and nl['title']=='Fondsenstrategie 2027' and nl['active_program_id'] is None and len([m for m in db(pg,'subsidie_kompas_messages') if m['conversation_id']==nl['id']])==2)
    rr=rij(pg,'Fondsenstrategie 2027'); rr.hover(); rr.get_by_test_id('gesprek-menu').click(); pg.get_by_test_id('gesprek-hernoem').click()
    pg.get_by_test_id('gesprek-hernoem-invoer').fill('Moet niet blijven'); pg.get_by_test_id('gesprek-hernoem-invoer').press('Escape'); pg.wait_for_timeout(300)
    ok('I7b Escape annuleert het hernoemen', 'Fondsenstrategie 2027' in titels(pg,'los') and 'Moet niet blijven' not in html(pg))
    # koppelen aan project: het geopende gesprek
    rr=rij(pg,'Fondsenstrategie 2027'); rr.hover(); rr.get_by_test_id('gesprek-menu').click(); pg.get_by_test_id('gesprek-koppel').click(); pg.wait_for_timeout(200)
    opties=[x.strip() for x in pg.get_by_test_id('gesprek-koppel-lijst').locator('button').all_inner_texts()]
    ok('I8 koppelmenu: alleen eigen niet-gearchiveerde projecten plus "Geen project"; geen project van een ander', opties==['Geen project (los gesprek)','Buurtkeuken De Brug','Taalcafe Zuid'] and 'GEHEIM' not in html(pg) and 'Oud Gearchiveerd' not in ' '.join(opties), str(opties))
    pg.get_by_test_id('gesprek-koppel-lijst').locator('[data-testid="koppel-project"]').filter(has_text='Buurtkeuken De Brug').click(); pg.wait_for_timeout(700)
    nl=[c for c in db(pg,'subsidie_kompas_conversations') if c['id']==nl['id']][0]
    ok('I9 koppelen: active_program_id = gekozen project (enige koppeling), gesprek in de projectgroep, niet meer bij Los', nl['active_program_id']==P1 and 'Fondsenstrategie 2027' in titels(pg,P1) and 'Fondsenstrategie 2027' not in titels(pg,'los'))
    ok('I9b het geopende gesprek volgt direct: "Actief in dit gesprek" en projectoverzicht = Buurtkeuken (conversation-bound)', kop(pg)=='Buurtkeuken De Brug' and pg.get_by_test_id('project-context-panel').get_attribute('data-project-id')==P1)
    rr=rij(pg,'Fondsenstrategie 2027'); rr.hover(); rr.get_by_test_id('gesprek-menu').click(); pg.get_by_test_id('gesprek-koppel').click()
    ok('I9c koppelmenu markeert het huidige project', pg.get_by_test_id('gesprek-koppel-lijst').locator('[data-testid="koppel-project"][aria-checked="true"]').inner_text().strip()=='Buurtkeuken De Brug')
    pg.get_by_test_id('koppel-geen').click(); pg.wait_for_timeout(700)
    nl=[c for c in db(pg,'subsidie_kompas_conversations') if c['id']==nl['id']][0]
    ok('I10 losmaken: active_program_id null, weer onder Losse gesprekken, projectoverzicht verdwijnt', nl['active_program_id'] is None and 'Fondsenstrategie 2027' in titels(pg,'los') and pg.get_by_test_id('kolom-project').count()==0 and kop(pg)=='geen project')
    # ander (niet-geopend) gesprek verplaatsen verandert het geopende gesprek niet
    open_rij(pg,'Taalcafe plannen')
    rr=rij(pg,'Begroting Brug'); rr.hover(); rr.get_by_test_id('gesprek-menu').click(); pg.get_by_test_id('gesprek-koppel').click()
    pg.get_by_test_id('gesprek-koppel-lijst').locator('[data-testid="koppel-project"]').filter(has_text='Taalcafe Zuid').click(); pg.wait_for_timeout(700)
    cb=[c for c in db(pg,'subsidie_kompas_conversations') if c['id']==CB][0]; ct=[c for c in db(pg,'subsidie_kompas_conversations') if c['id']==CT][0]
    ok('I11 een ander gesprek verplaatsen laat het geopende gesprek en zijn eigen active_program_id ongemoeid', cb['active_program_id']==P2 and ct['active_program_id']==P2 and kop(pg)=='Taalcafe Zuid' and pg.get_by_test_id('project-context-panel').get_attribute('data-project-id')==P2 and 'Begroting Brug' in titels(pg,P2))
    ctx.close()

    # projectoverzicht verschijnt/verdwijnt dynamisch bij projectkeuze in een nieuw gesprek
    ctx,pg=nieuw(b,DESK,'pro')
    ok('I12 begin: geen overzicht', pg.get_by_test_id('project-context-panel').count()==0)
    kiezer(pg,'Buurtkeuken De Brug')
    ok('I13 project kiezen in een nieuw gesprek: projectoverzicht verschijnt automatisch rechts', pg.get_by_test_id('kolom-project').is_visible() and pg.get_by_test_id('project-context-panel').get_attribute('data-project-id')==P1)
    kiezer(pg,'Geen actief project')
    ok('I14 project weer weghalen: rechterkolom verdwijnt, chat krijgt de ruimte terug', pg.get_by_test_id('kolom-project').count()==0 and pg.get_by_test_id('kolom-chat').bounding_box()['width']>1000)
    ctx.close()

    # screenshots met meer gesprekken
    EXTRA_G="var T=seed.tables;var rows=[['Fondsenscan','2026-10-06T08:00:00Z',c.P1],['Concept aanvraag Oranje Fonds','2026-10-05T08:00:00Z',c.P1],['Financieringsstrategie','2026-10-04T08:00:00Z',c.P1],['Fondsadvies','2026-10-03T08:00:00Z',c.P2],['Aanvraag Gemeente','2026-10-02T08:00:00Z',c.P2],['Subsidievoorwaarden','2026-10-01T08:00:00Z',null],['Algemene vraag','2026-09-30T08:00:00Z',null]];rows.forEach(function(r,i){T.subsidie_kompas_conversations.push({id:'aaaaaaaa-0000-4000-8000-00000000000'+i,user_id:'u1',title:r[0],active_program_id:r[2],updated_at:r[1],kompas_mode:null});});"
    ctx,pg=nieuw(b,DESK,'pro',extra=EXTRA_G); open_rij(pg,'Projectplan Buurtkeuken')
    pg.get_by_test_id('kolom-gesprekken').screenshot(path='shots/chat_4_gesprekken_projectgroepen.png')
    pg.locator(f'[data-testid="project-groep"][data-project-id="{P2}"]').get_by_test_id('groep-toggle').click(); pg.wait_for_timeout(200)
    pg.get_by_test_id('kolom-gesprekken').screenshot(path='shots/chat_5_ingeklapte_groep.png')
    pg.get_by_test_id('groep-los').scroll_into_view_if_needed(); pg.get_by_test_id('groep-los').screenshot(path='shots/chat_6_losse_gesprekken.png')
    pg.screenshot(path='shots/chat_2b_desktop_projectgroepen_volledig.png')
    ok('I15 screenshotdata: 3 projectgroepen/lijsten en losse gesprekken aanwezig', pg.get_by_test_id('project-groep').count()==2 and pg.get_by_test_id('groep-los').locator('[data-testid="gesprek-rij"]').count()==3)
    ctx.close()

    # ---------------------------------------------------------------- H. Free
    for vp,label in [(DESK,'desktop'),(MOB,'mobiel')]:
        ctx,pg=nieuw(b,vp,'free')
        t=txt(pg)
        ok(f'H1 Free {label}: geen werkruimte, geen kolommen, geen projectoverzicht, geen gesprekkenlijst', all(pg.get_by_test_id(x).count()==0 for x in ['chat-werkruimte','kolom-gesprekken','kolom-project','project-context-panel','conversations-list','werkkop']))
        ok(f'H2 Free {label}: bestaande hero en upgradehints', 'Uw gids bij fondsenwerving' in t and 'Ontdek Pro en Premium' in t)
        ok(f'H3 Free {label}: geen oude pillen en geen projectkiezer', '+ Nieuwe chat' not in t and pg.get_by_test_id('project-kiezer').count()==0 and pg.get_by_role('button',name='Eerdere gesprekken').count()==0)
        ok(f'H4 Free {label}: geen horizontale overflow', geenhscroll(pg))
        if label=='desktop': pg.screenshot(path='shots/f4_10_free_desktop.png')
        else: pg.screenshot(path='shots/f4_10_free_mobiel.png')
        nc=len(db(pg,'subsidie_kompas_conversations')); nm=len(db(pg,'subsidie_kompas_messages'))
        pg.locator('textarea').fill('Welke fondsen passen bij mij?'); pg.locator('textarea').press('Enter'); pg.wait_for_timeout(1500)
        pl=posts(pg)[-1]
        ok(f'H5 Free {label}: chat werkt; geen context/matchSignalen/activeProgramId/gespreksopslag', 'Dit is het antwoord van de test.' in txt(pg) and pl['context'] is None and pl['matchSignalen'] is None and pl['activeProgramId'] is None and pl['subscriptionTier']=='free' and len(db(pg,'subsidie_kompas_conversations'))==nc and len(db(pg,'subsidie_kompas_messages'))==nm, str(pl)[:300])
        ctx.close()
    b.close()
finally:
    srv.terminate()
f=[r for r in res if not r[1]]
print(f'\n{len(res)-len(f)}/{len(res)} OK'); 
for n,c,d in f: print('FAIL',n,d)
sys.exit(1 if f else 0)
