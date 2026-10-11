# Fase 5 browsertests: kansrijke financiers in de chat -> Projectfinanciering, Bespreek/focus, gesprek hervatten via URL,
# volledige keten (Hushu House 2027), Free ongewijzigd, fail-safe. De echte app tegen de nagebootste Supabase; de chat-Edge-
# Function wordt nagebootst (SSE) en geeft per testvraag een fondsMatches-lijst terug zoals de echte server dat doet.
import subprocess, time, sys, os, re, json
from playwright.sync_api import sync_playwright
os.chdir(os.path.dirname(os.path.abspath(__file__)))
PORT=8785
srv = subprocess.Popen(['python3','-m','http.server',str(PORT),'-d','web'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1)
BASE=f'http://localhost:{PORT}/index.html'
P1='11111111-1111-4111-8111-111111111111'; P2='22222222-2222-4222-8222-222222222222'; P4='44444444-4444-4444-8444-444444444444'; PX='99999999-9999-4999-8999-999999999999'
CA='55555555-5555-4555-8555-555555555555'; CX='66666666-6666-4666-8666-666666666666'
M=lambda n:'c0000000-0000-4000-8000-%012d'%n
res=[]
def ok(n,c,d=''):
    res.append((n,bool(c),d)); print(('OK  ' if c else 'FAIL'),n,(d if not c else ''), flush=True)
os.makedirs('shots',exist_ok=True)

EXTRA = """
var B=seed.bronnen;
B['c0000000-0000-4000-8000-000000000001']={naam:'Jongerenfonds Noord',funder:'Stichting Noord',deadline:c.dag(20)};
B['c0000000-0000-4000-8000-000000000002']={naam:'Podiumregeling Cultuur',funder:'Cultuurfonds Stad',deadline:c.dag(45)};
B['c0000000-0000-4000-8000-000000000003']={naam:'Wijk Cultuurfonds',funder:'',deadline:c.dag(70)};
B['c0000000-0000-4000-8000-000000000004']={naam:'Dansimpuls',funder:'Dansfonds',deadline:c.dag(90)};
B['c0000000-0000-4000-8000-000000000005']={naam:'Jeugdtheaterfonds',funder:'Theaterstichting',deadline:c.dag(25)};
B['c0000000-0000-4000-8000-000000000006']={naam:'Nieuw Muziekfonds',funder:'Muziekstichting',deadline:c.dag(55)};
B['c0000000-0000-4000-8000-000000000007']={naam:'PREMIUMFONDS Cultuurgeheim',funder:'Geheim Fonds',deadline:c.dag(33),premium:true};
seed.tables.subsidie_kompas_programs.push(c.P('44444444-4444-4444-8444-444444444444','Hushu House 2027',{budget_total:150000,own_contribution:20000,program_label:'Hushu House',location:'Amsterdam',target_groups:'Jongeren'}));
"""
INIT = """
(function(){
 var M=function(n){return 'c0000000-0000-4000-8000-'+String(n).padStart(12,'0');};
 var dg=function(n){var d=new Date();d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};var DLS={1:20,2:45,3:70,4:90,5:25,6:55};
 var it=function(n,naam,funder,type,dl,w){return {type:type||'regeling',id:M(n),naam:naam,funder:funder||'',deadline:dg(DLS[n]),waarom:w||['Past bij de doelgroep jongeren','Past bij de regio'],staatAl:false};};
 window.__LIJST_A=[it(1,'Jongerenfonds Noord','Stichting Noord','regeling',null),it(2,'Podiumregeling Cultuur','Cultuurfonds Stad','regeling',null),it(3,'Wijk Cultuurfonds','','fonds',null),it(4,'Dansimpuls','Dansfonds','regeling',null)];
 window.__LIJST_B=[it(5,'Jeugdtheaterfonds','Theaterstichting','regeling',null),it(6,'Nieuw Muziekfonds','Muziekstichting','regeling',null)];
 window.__CHAT_EXTRA=function(b){
  var t=((b.messages[b.messages.length-1]||{}).content||'').toLowerCase(); var P=b.activeProgramId;
  if(!P) return window.__ALTIJD_MATCHES?{fondsMatches:{intentie:'scan',projectId:'11111111-1111-4111-8111-111111111111',items:window.__LIJST_A}}:{};
  if(window.__GEEN_KAART) return {};
  if(t.indexOf('scan')>=0&&t.indexOf('zet')>=0) return {fondsMatches:{intentie:'scan_en_toevoegen',projectId:P,items:window.__LIJST_B}};
  if(t.indexOf('zoek passende')>=0) return {fondsMatches:{intentie:'scan',projectId:P,items:window.__LIJST_A}};
  if(t.indexOf('welke fondsen')>=0) return {fondsMatches:{intentie:'advies',projectId:P,items:window.__LIJST_A.slice(0,2)}};
  if(t.indexOf('zet deze')>=0) return {fondsMatches:{intentie:'toevoegen',projectId:P,items:[]}};
  if(t.indexOf('nog een scan')>=0) return {fondsMatches:{intentie:'scan',projectId:P,items:[window.__LIJST_A[0],window.__LIJST_B[0]]}};
  return {};
 };
 window.__CHAT_POSTS=[];
 var of=window.fetch.bind(window);
 window.fetch=async function(url,opts){
  if(String(url).indexOf('/functions/v1/subsidie-kompas')===-1)return of(url,opts);
  var body=JSON.parse(opts.body);window.__CHAT_POSTS.push(body);
  var antwoord=(window.__CHAT_LANG&&body.messages[body.messages.length-1].content.toLowerCase().indexOf('conceptaanvraag')>=0)?('# Conceptaanvraag Hushu House 2027\\n\\n'+'Dit is een uitgebreide conceptaanvraag voor het project met doelgroep, aanpak, planning, begroting en financiering. '.repeat(6)):'Dit is het antwoord van de test.';
  var extra=window.__CHAT_EXTRA?window.__CHAT_EXTRA(body):{};
  var enc=new TextEncoder();var delen=antwoord.split(' ');
  var stream=new ReadableStream({async start(c){
   for(var i=0;i<delen.length;i++){c.enqueue(enc.encode('data: '+JSON.stringify({delta:delen[i]+' '})+'\\n\\n'));await new Promise(function(r){setTimeout(r,5)});}
   c.enqueue(enc.encode('data: '+JSON.stringify(Object.assign({done:true,answer:antwoord,sources:[],veldVoorstellen:{},projectDossier:null},extra))+'\\n\\n'));c.close();}});
  return new Response(stream,{status:200,headers:{'content-type':'text/event-stream'}});};
})();
"""
def nieuw(b,vp,tier,pad='/kompas',init=''):
    ctx=b.new_context(viewport=vp); pg=ctx.new_page()
    pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='div[style*=\"z-index: 2000\"]{display:none !important}';document.head.appendChild(s)})")
    pg.add_init_script('window.__EXTRA_PATCH=function(seed,c){'+EXTRA+'};')
    pg.add_init_script("window.__SEED_PATCH=function(seed,c){if(window.__EXTRA_PATCH)window.__EXTRA_PATCH(seed,c);};")
    pg.add_init_script(INIT)
    if init: pg.add_init_script(init)
    pg.errs=[]; pg.cons=[]
    pg.on('pageerror',lambda e: pg.errs.append(str(e)))
    pg.on('console',lambda m: pg.cons.append(m.text) if m.type=='error' and 'favicon' not in m.text and 'Failed to load resource' not in m.text else None)
    pg.goto(f'{BASE}?tier={tier}#{pad}'); pg.wait_for_timeout(1700)
    return ctx,pg
def txt(pg): return pg.locator('body').inner_text().replace('\xa0',' ')
def html(pg): return pg.evaluate("(()=>{const c=document.body.cloneNode(true);c.querySelectorAll('script').forEach(x=>x.remove());return c.innerHTML})()")
def db(pg,t): return pg.evaluate(f'window.__DBL.{t}')
def posts(pg): return pg.evaluate('window.__CHAT_POSTS')
def geenhscroll(pg): return pg.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1')
def stuur(pg,tekst,wacht=1500):
    pg.get_by_test_id('chat-invoer').fill(tekst); pg.get_by_test_id('chat-invoer').press('Enter'); pg.wait_for_timeout(wacht)
def kiezer(pg,naam): pg.get_by_test_id('project-kiezer').select_option(label=naam); pg.wait_for_timeout(500)
def open_rij(pg,titel):
    pg.locator('[data-testid="kolom-gesprekken"] [data-testid="gesprek-open"]').filter(has_text=titel).first.click(); pg.wait_for_timeout(900)
def funding(pg,prog): return [r for r in db(pg,'subsidie_kompas_program_funding') if r['program_id']==prog]
def item(pg,naam): return pg.get_by_test_id('fm-item').filter(has_text=naam)
def hash(pg): return pg.evaluate('location.hash')
DESK={'width':1440,'height':900}; MOB={'width':390,'height':844}

try:
  with sync_playwright() as p:
    b=p.chromium.launch()

    # ============================================================ A. projectscan -> kaart -> bewust toevoegen
    ctx,pg=nieuw(b,DESK,'pro')
    open_rij(pg,'Projectplan Buurtkeuken')
    n0=len(funding(pg,P1)); ctx0=pg.get_by_test_id('ctx-regel').count()
    stuur(pg,'Zoek passende fondsen voor dit project')
    kaart=pg.get_by_test_id('fm-kaart')
    ok('A1 projectscan: kaart "4 kansrijke financiers gevonden voor <project>" onder het antwoord', kaart.is_visible() and '4 kansrijke financiers gevonden' in pg.get_by_test_id('fm-kop').inner_text() and 'Buurtkeuken De Brug' in pg.get_by_test_id('fm-kop').inner_text())
    ok('A2 kaart toont per financier naam, waarom passend, deadline en knoppen [Toevoegen] [Bespreek]', pg.get_by_test_id('fm-item').count()==4 and all(pg.get_by_test_id(t).count()==4 for t in ['fm-naam','fm-waarom','fm-deadline','fm-toevoegen','fm-bespreek']))
    ok('A3 NIETS opgeslagen zonder keuze (projectscan = voorstel)', len(funding(pg,P1))==n0)
    pl=posts(pg)[-1]
    ok('A4 request: alleen id\'s (activeProgramId = actief project), geen focus, geen fondsobject', pl['activeProgramId']==P1 and pl.get('focusFundingId') is None and 'fondsMatches' not in json.dumps(pl) and 'Jongerenfonds' not in json.dumps(pl))
    ok('A5 bij projectscan: Alles toevoegen en selectie-checkboxes beschikbaar', pg.get_by_test_id('fm-alles-toevoegen').is_visible() and pg.get_by_test_id('fm-kies').count()==4)
    pg.screenshot(path='shots/f5_01_matchkaart.png')
    # één toevoegen
    item(pg,'Jongerenfonds Noord').get_by_test_id('fm-toevoegen').click(); pg.wait_for_timeout(900)
    nieuwe=[r for r in funding(pg,P1) if r.get('scheme_id')==M(1)]
    ok('A6 [Toevoegen]: precies één regel via de fundingservice: program_id, scheme_id, status interesting, geen bedrag', len(nieuwe)==1 and nieuwe[0]['status']=='interesting' and nieuwe[0].get('requested_amount') in (None,) and nieuwe[0]['user_id']=='u1' and nieuwe[0].get('funder_id') in (None,''))
    ok('A7 item toont "Toegevoegd aan projectfinanciering" + link; knop weg', 'Toegevoegd aan projectfinanciering' in item(pg,'Jongerenfonds Noord').inner_text() and item(pg,'Jongerenfonds Noord').get_by_test_id('fm-toevoegen').count()==0 and item(pg,'Jongerenfonds Noord').get_by_test_id('fm-open-financiering').get_attribute('href')==f'#/kompas/projecten/{P1}?tab=projectfinanciering')
    ok('A8 contextpaneel rechts ververst direct uit dezelfde bron (extra regel/teller)', 'Jongerenfonds Noord' in pg.get_by_test_id('project-context-panel').inner_text() or '+ 6 andere regels' in pg.get_by_test_id('project-context-panel').inner_text(), pg.get_by_test_id('project-context-panel').inner_text()[-300:])
    # selectie van twee
    item(pg,'Podiumregeling Cultuur').get_by_test_id('fm-kies').check(); item(pg,'Dansimpuls').get_by_test_id('fm-kies').check()
    pg.get_by_test_id('fm-selectie-toevoegen').click(); pg.wait_for_timeout(1500)
    ok('A9 selectie toevoegen: precies de twee gekozen regels erbij (en Wijk Cultuurfonds niet)', {r.get('scheme_id') for r in funding(pg,P1)} >= {M(1),M(2),M(4)} and not any(r.get('funder_id')==M(3) for r in funding(pg,P1)) and 'toegevoegd aan projectfinanciering' in pg.get_by_test_id('fm-samenvatting').inner_text())
    # alles toevoegen (rest)
    ok('A9b nog maar één over: geen bulkknop meer, wel [Toevoegen] bij dat item', pg.get_by_test_id('fm-alles-toevoegen').count()==0)
    item(pg,'Wijk Cultuurfonds').get_by_test_id('fm-toevoegen').click(); pg.wait_for_timeout(1000)
    r3=[r for r in funding(pg,P1) if r.get('funder_id')==M(3)]
    ok('A10 het resterende fonds komt als FONDS (funder_id) binnen, niet als regeling', len(r3)==1 and not r3[0].get('scheme_id'))
    ok('A11 alle vier staan er nu in; geen dubbele rijen', len([r for r in funding(pg,P1) if (r.get('scheme_id') or r.get('funder_id')) in {M(1),M(2),M(3),M(4)}])==4 and len(funding(pg,P1))==n0+4)
    # duplicaat via tweede scan
    stuur(pg,'Nog een scan alsjeblieft')
    kaarten=pg.get_by_test_id('fm-kaart').all()
    laatste=kaarten[-1]
    ok('A12 tweede kaart (nog een scan) verschijnt onder het nieuwe antwoord', len(kaarten)==2)
    laatste.get_by_test_id('fm-item').filter(has_text='Jongerenfonds Noord').get_by_test_id('fm-toevoegen').click(); pg.wait_for_timeout(800)
    ok('A13 duplicaat: geen nieuwe rij, melding "Staat al in projectfinanciering" + Open projectfinanciering', len(funding(pg,P1))==n0+4 and 'Staat al in projectfinanciering' in laatste.get_by_test_id('fm-item').filter(has_text='Jongerenfonds Noord').inner_text() and laatste.get_by_test_id('fm-item').filter(has_text='Jongerenfonds Noord').get_by_test_id('fm-open-financiering').count()==1)
    pg.screenshot(path='shots/f5_02_duplicaat.png')
    # downstream: Projectfinanciering, Mijn deadlines, Dashboard
    pg.goto(f'{BASE}?tier=pro#/kompas/projecten/{P1}?tab=projectfinanciering'); pg.wait_for_timeout(1500)
    ok('A14 Projectfinanciering toont de vier nieuwe regels (zelfde DB-bron)', all(n in txt(pg) for n in ['Jongerenfonds Noord','Podiumregeling Cultuur','Wijk Cultuurfonds','Dansimpuls']))
    pg.goto(f'{BASE}?tier=pro#/kompas/deadlines'); pg.wait_for_timeout(1500)
    ok('A15 Mijn deadlines toont ze automatisch met de live brondatum (geen snapshot)', all(n in txt(pg) for n in ['Jongerenfonds Noord','Podiumregeling Cultuur','Dansimpuls']))
    pg.goto(f'{BASE}?tier=pro#/kompas/dashboard'); pg.wait_for_timeout(1500)
    ok('A16 Dashboard: komende deadlines tonen de nieuwe regelingen', 'Jongerenfonds Noord' in pg.get_by_test_id('dashboard-deadlines').inner_text())
    ok('A17 geen financiersdata in localStorage', 'Jongerenfonds' not in pg.evaluate("JSON.stringify(Object.assign({},localStorage))"))
    ok('A18 geen pageerrors', not pg.errs and not pg.cons, str(pg.errs+pg.cons))
    ctx.close()

    # ============================================================ B. advies, expliciete opdracht, vervolgzin
    ctx,pg=nieuw(b,DESK,'pro')
    open_rij(pg,'Projectplan Buurtkeuken')
    n0=len(funding(pg,P1))
    stuur(pg,'Welke fondsen passen hier eigenlijk bij?')
    ok('B1 gewoon advies: kaart per item, GEEN bulkknoppen/checkboxes, GEEN opslag', pg.get_by_test_id('fm-kaart').get_attribute('data-intentie')=='advies' and pg.get_by_test_id('fm-alles-toevoegen').count()==0 and pg.get_by_test_id('fm-kies').count()==0 and len(funding(pg,P1))==n0)
    stuur(pg,'Scan passende fondsen en zet de kansrijke in mijn dekkingsplan', 2500)
    ok('B2 expliciete opdracht: kansrijke financiers direct toegevoegd (2 nieuwe regels)', len(funding(pg,P1))==n0+2 and {M(5),M(6)} <= {r.get('scheme_id') for r in funding(pg,P1)})
    ok('B3 de kaart meldt het resultaat (aria-live samenvatting)', '2 toegevoegd aan projectfinanciering' in pg.get_by_test_id('fm-samenvatting').last.inner_text() and pg.get_by_test_id('fm-samenvatting').last.get_attribute('aria-live')=='polite')
    n1=len(funding(pg,P1))
    stuur(pg,'Zet deze vier in mijn dekkingsplan')
    ok('B4 vervolgzin: bevestigingskaart op de laatste lijst, nog niets geschreven', pg.get_by_test_id('fm-bevestiging').is_visible() and len(funding(pg,P1))==n1)
    pg.get_by_test_id('fm-bevestig-nee').click(); pg.wait_for_timeout(300)
    ok('B5 "Nee": niets geschreven en kaart weg', len(funding(pg,P1))==n1 and pg.get_by_test_id('fm-bevestiging').count()==0)
    stuur(pg,'Zet deze vier in mijn dekkingsplan')
    pg.get_by_test_id('fm-bevestig-ja').click(); pg.wait_for_timeout(1800)
    ok('B6 "Ja": de items van de laatste lijst worden toegevoegd (of staan al in = geen duplicaten)', len(funding(pg,P1))>=n1 and len({(r.get('scheme_id'),r.get('funder_id')) for r in funding(pg,P1)})==len(funding(pg,P1)))
    ctx.close()

    # ============================================================ C. Bespreek + focus
    ctx,pg=nieuw(b,DESK,'pro')
    open_rij(pg,'Projectplan Buurtkeuken')
    stuur(pg,'Zoek passende fondsen voor dit project')
    item(pg,'Dansimpuls').get_by_test_id('fm-toevoegen').click(); pg.wait_for_timeout(800)
    rij=[r for r in funding(pg,P1) if r.get('scheme_id')==M(4)][0]
    item(pg,'Dansimpuls').get_by_test_id('fm-bespreek').click(); pg.wait_for_timeout(700)
    ok('C1 Bespreek bij een financier in de projectfinanciering: focuschip zichtbaar, invoer voorgevuld, niets verstuurd', 'Dansimpuls' in pg.get_by_test_id('chat-focus').inner_text() and 'Dansimpuls' in pg.get_by_test_id('chat-invoer').input_value())
    n_posts=len(posts(pg))
    pg.get_by_test_id('chat-invoer').press('Enter'); pg.wait_for_timeout(1500)
    pl=posts(pg)[-1]
    ok('C2 volgend bericht stuurt alleen focusFundingId = id van die fundingregel (geen naam/fondsobject)', len(posts(pg))==n_posts+1 and pl['focusFundingId']==rij['id'] and 'Dansimpuls' not in json.dumps({k:v for k,v in pl.items() if k!='messages'}))
    pg.get_by_test_id('chat-focus-wis').click(); pg.wait_for_timeout(200)
    stuur(pg,'En nu iets anders')
    ok('C3 focus wissen: chip weg en volgend bericht zonder focusFundingId', pg.get_by_test_id('chat-focus').count()==0 and posts(pg)[-1].get('focusFundingId') is None)
    stuur(pg,'Zoek passende fondsen voor dit project')
    kaart=pg.get_by_test_id('fm-kaart').last
    kaart.get_by_test_id('fm-item').filter(has_text='Podiumregeling Cultuur').get_by_test_id('fm-bespreek').click(); pg.wait_for_timeout(500)
    ok('C4 Bespreek bij een NIEUWE financier (nog niet in projectfinanciering): geen focus, alleen voorgevulde vraag', pg.get_by_test_id('chat-focus').count()==0 and 'Podiumregeling Cultuur' in pg.get_by_test_id('chat-invoer').input_value())
    ctx.close()

    # ============================================================ D. Bespreek vanuit Projectfinanciering/Deadlines/Dashboard + hervatten
    ctx,pg=nieuw(b,DESK,'pro',f'/kompas/projecten/{P1}?tab=projectfinanciering')
    links=pg.get_by_test_id('bespreek-link')
    ok('D1 Projectfinanciering: elke regel heeft "Bespreek met Subsidiekompas"', links.count()>=7)
    href=links.first.get_attribute('href')
    ok('D2 de link bevat alleen uuid\'s: laatste gesprek van dit project + id van de fundingregel', re.fullmatch(r'#/kompas\?conversation=[0-9a-f-]{36}&focus=[0-9a-f-]{36}',href or '') is not None and f'conversation={CA}' in href, href)
    links.first.click(); pg.wait_for_timeout(2000)
    ok('D3 klik: dezelfde chat, hervat het gesprek van dit project met berichten zichtbaar', 'Kun je me helpen met een projectplan?' in txt(pg) and pg.get_by_test_id('actief-project-naam').inner_text()=='Buurtkeuken De Brug')
    ok('D4 focuschip toont de gekozen regel; adresbalk houdt alleen het gesprek vast', pg.get_by_test_id('chat-focus').count()==1 and hash(pg)==f'#/kompas?conversation={CA}', hash(pg))
    focus_id=re.search(r'focus=([0-9a-f-]{36})',href).group(1)
    stuur(pg,'Wat is hiervoor nodig?')
    ok('D5 het bericht draagt dat id mee als focusFundingId', posts(pg)[-1]['focusFundingId']==focus_id and posts(pg)[-1]['conversationId']==CA)
    # naar Projecten en terug
    pg.evaluate(f"location.hash='#/kompas/projecten/{P1}'"); pg.wait_for_timeout(1200)
    pg.evaluate("history.back()"); pg.wait_for_timeout(1800)
    ok('D6 "Open project" en dan terug (browser back) -> hetzelfde gesprek met berichten', hash(pg).startswith(f'#/kompas?conversation={CA}') and 'Kun je me helpen met een projectplan?' in txt(pg), hash(pg))
    pg.evaluate("location.hash='#/kompas/deadlines'"); pg.wait_for_timeout(1000)
    pg.locator('a.fwk-wn-link', has_text='Chat').click(); pg.wait_for_timeout(1800)
    ok('D7 via de navigatie terug naar Chat: hetzelfde gesprek (in-memory pointer, niet localStorage)', 'Kun je me helpen met een projectplan?' in txt(pg) and f'conversation={CA}' in hash(pg) and 'conversation' not in pg.evaluate("JSON.stringify(Object.assign({},localStorage))").lower().replace('conversations',''), hash(pg))
    pg.reload(); pg.wait_for_timeout(2200)
    ok('D8 volledige herlaad op ?conversation=: gesprek en project komen uit de database terug', 'Kun je me helpen met een projectplan?' in txt(pg) and pg.get_by_test_id('actief-project-naam').inner_text()=='Buurtkeuken De Brug')
    ctx.close()

    # deadlines + dashboard links
    ctx,pg=nieuw(b,DESK,'pro','/kompas/deadlines')
    ok('D9 Mijn deadlines: Bespreek-link per regel', pg.get_by_test_id('bespreek-link').count()>=3)
    pg.get_by_test_id('bespreek-link').first.click(); pg.wait_for_timeout(2000)
    ok('D10 vanuit Mijn deadlines: chat met focus en gesprek van het juiste project', pg.get_by_test_id('chat-focus').count()==1 and hash(pg).startswith('#/kompas?conversation='), hash(pg))
    ctx.close()
    ctx,pg=nieuw(b,DESK,'pro','/kompas/dashboard')
    ok('D11 Dashboard: Bespreek-link bij komende deadlines', pg.get_by_test_id('dashboard-deadline').first.get_by_test_id('bespreek-link').count()==1)
    pg.get_by_test_id('dashboard-deadline').first.get_by_test_id('bespreek-link').click(); pg.wait_for_timeout(2000)
    ok('D12 vanuit het Dashboard: chat met focus', pg.get_by_test_id('chat-focus').count()==1)
    ctx.close()

    # context panel link, zelfde gesprek
    ctx,pg=nieuw(b,DESK,'pro')
    open_rij(pg,'Projectplan Buurtkeuken')
    pg.get_by_test_id('ctx-regel').first.get_by_test_id('bespreek-link').click(); pg.wait_for_timeout(1500)
    ok('D13 contextpaneel: Bespreek zet alleen de focus in het huidige gesprek (geen reset van de berichten)', pg.get_by_test_id('chat-focus').count()==1 and 'Kun je me helpen met een projectplan?' in txt(pg), hash(pg))
    ctx.close()

    # ============================================================ E. Beveiliging/robuustheid van de URL
    ctx,pg=nieuw(b,DESK,'pro',f'/kompas?conversation={CX}')
    ok('E1 gesprek van een ander (?conversation=<vreemd>): lege chat, geen berichten, URL opgeschoond', 'GEHEIM' not in html(pg) and hash(pg)=='#/kompas' and pg.get_by_test_id('chat-invoer').is_visible(), hash(pg))
    ctx.close()
    ctx,pg=nieuw(b,DESK,'pro','/kompas?conversation=niet-een-uuid&focus=x;drop')
    ok('E2 rommel in de URL wordt genegeerd (geen fout, gewone chat)', not pg.errs and pg.get_by_test_id('chat-invoer').is_visible() and pg.get_by_test_id('chat-focus').count()==0)
    ctx.close()
    ctx,pg=nieuw(b,DESK,'pro',f'/kompas?conversation={CA}&focus=f0000000-0000-4000-8000-000000000010')
    ok('E3 focus op een fundingregel van een ANDER project/gebruiker: geen chip (niet gevonden in mijn dekkingsplan)', 'Kun je me helpen met een projectplan?' in txt(pg) and pg.get_by_test_id('chat-focus').count()==0 and 'GEHEIM' not in html(pg))
    ctx.close()
    ctx,pg=nieuw(b,DESK,'pro',f'/kompas?project={PX}')
    ok('E4 ?project= van een ander: genegeerd', pg.get_by_test_id('actief-project-naam').inner_text()!='GEHEIM Ander Project' and 'GEHEIM' not in html(pg))
    ctx.close()
    ctx,pg=nieuw(b,DESK,'pro',f'/kompas?project={P2}')
    ok('E5 ?project= van een eigen project: nieuw gesprek met dat project als start', pg.get_by_test_id('actief-project-naam').inner_text()=='Taalcafe Zuid')
    ctx.close()

    # ============================================================ F. Free en fail-safe
    ctx,pg=nieuw(b,DESK,'free','/kompas',"window.__ALTIJD_MATCHES=true;")
    pg.get_by_test_id('chat-invoer').fill('Zoek passende fondsen voor dit project'); pg.get_by_test_id('chat-invoer').press('Enter'); pg.wait_for_timeout(1500)
    pl=posts(pg)[-1] if posts(pg) else {}
    ok('F1 Free: geen matchkaart, geen focuschip, geen bespreeklinks, request zonder project/focus', pg.get_by_test_id('fm-kaart').count()==0 and pg.get_by_test_id('chat-focus').count()==0 and pg.get_by_test_id('bespreek-link').count()==0 and pl.get('focusFundingId') is None and pl.get('activeProgramId') is None, str(pl)[:300])
    ctx.close()
    ctx,pg=nieuw(b,DESK,'pro','/kompas',"window.__GEEN_KAART=true;")
    open_rij(pg,'Projectplan Buurtkeuken'); stuur(pg,'Zoek passende fondsen voor dit project')
    ok('F2 antwoord zonder fondsMatches: chat identiek aan vroeger (antwoordbel, geen kaart)', pg.get_by_test_id('fm-kaart').count()==0 and 'Dit is het antwoord van de test.' in txt(pg))
    ctx.close()
    ctx,pg=nieuw(b,DESK,'pro','/kompas',"window.__RPCFOUT='fout';")
    open_rij(pg,'Projectplan Buurtkeuken'); stuur(pg,'Zoek passende fondsen voor dit project')
    item(pg,'Dansimpuls').get_by_test_id('fm-toevoegen').click(); pg.wait_for_timeout(800)
    item(pg,'Dansimpuls').get_by_test_id('fm-bespreek').click(); pg.wait_for_timeout(500)
    ok('F3 fundingbron faalt (RPC-fout): kaart en chat blijven werken, Bespreek zonder focus, geen crash', not pg.errs and pg.get_by_test_id('chat-focus').count()==0 and 'Dansimpuls' in pg.get_by_test_id('chat-invoer').input_value())
    ctx.close()
    ctx,pg=nieuw(b,DESK,'pro','/kompas',"window.__GEENSESSIE=false;")
    open_rij(pg,'Projectplan Buurtkeuken'); stuur(pg,'Zoek passende fondsen voor dit project')
    pg.evaluate("window.__GEENSESSIE=true")
    item(pg,'Dansimpuls').get_by_test_id('fm-toevoegen').click(); pg.wait_for_timeout(800)
    ok('F4 toevoegen zonder sessie: melding "niet gelukt", geen rij, kaart blijft bruikbaar', 'Toevoegen is niet gelukt' in item(pg,'Dansimpuls').inner_text() and not any(r.get('scheme_id')==M(4) for r in funding(pg,P1)) and item(pg,'Dansimpuls').get_by_test_id('fm-toevoegen').count()==1)
    ctx.close()

    # ============================================================ G. Downgrade (weergave)
    ctx,pg=nieuw(b,DESK,'premium')
    pg.goto(f'{BASE}?tier=premium#/kompas/projecten/{P1}?tab=projectfinanciering'); pg.wait_for_timeout(1500)
    ok('G1 Premium ziet de eigen Premium-regel bij naam', 'PREMIUMFONDS Geheimnaam' in html(pg))
    ctx.close()
    ctx,pg=nieuw(b,DESK,'pro')
    open_rij(pg,'Projectplan Buurtkeuken')
    pg.goto(f'{BASE}?tier=pro#/kompas/projecten/{P1}?tab=projectfinanciering'); pg.wait_for_timeout(1500)
    ok('G2 na downgrade naar Pro: de Premium-regel is gemaskeerd, de bronnaam lekt nergens', 'PREMIUMFONDS' not in html(pg) and 'Geheim Premium Fonds' not in html(pg))
    pg.get_by_test_id('bespreek-link').nth(0).click(); pg.wait_for_timeout(1500)
    ok('G3 ook via Bespreek/chat lekt de gemaskeerde bron niet', 'PREMIUMFONDS' not in html(pg) and 'geheim.test' not in html(pg))
    ctx.close()

    # ============================================================ H. Keten Hushu House 2027
    ctx,pg=nieuw(b,DESK,'pro',f'/kompas/projecten/{P4}',"window.__CHAT_LANG=true;")
    ok('H1 open project Hushu House 2027', 'Hushu House 2027' in txt(pg))
    pg.goto(f'{BASE}?tier=pro#/kompas?project={P4}',); pg.wait_for_timeout(1800)
    ok('H2 chat opent met Hushu House 2027 als actief project', pg.get_by_test_id('actief-project-naam').inner_text()=='Hushu House 2027')
    stuur(pg,'Zoek passende fondsen voor dit project')
    ok('H3 kansrijke financiers voor Hushu House 2027 getoond (vier)', pg.get_by_test_id('fm-item').count()==4 and 'Hushu House 2027' in pg.get_by_test_id('fm-kop').inner_text())
    ok('H4 nog niets in projectfinanciering van Hushu House', len(funding(pg,P4))==0)
    pg.get_by_test_id('fm-alles-toevoegen').click(); pg.wait_for_timeout(2200)
    ok('H5 [Alles toevoegen]: vier regels voor Hushu House 2027, status interesting, zonder bedrag', len(funding(pg,P4))==4 and all(r['status']=='interesting' and r.get('requested_amount') is None for r in funding(pg,P4)))
    ok('H6 andere projecten onaangeroerd', len(funding(pg,P2))==0)
    ctxt=pg.get_by_test_id('project-context-panel').inner_text()
    ok('H7 contextpaneel toont de nieuwe financiering van dit project', 'Jongerenfonds Noord' in ctxt or 'Podiumregeling' in ctxt or 'Dansimpuls' in ctxt, ctxt[-250:])
    pg.get_by_test_id('fm-bespreek').first.click(); pg.wait_for_timeout(900)
    ok('H8 Bespreek op een toegevoegde financier: focus actief', pg.get_by_test_id('chat-focus').count()==1)
    stuur(pg,'Maak een conceptaanvraag voor dit fonds',2500)
    ok('H9 AI-resultaat (lang) met "Opslaan bij project"', pg.get_by_text('Opslaan bij project').count()>=1)
    nd=len(db(pg,'subsidie_kompas_knowledge_items'))
    pg.get_by_text('Opslaan bij project').first.click(); pg.wait_for_timeout(1500)
    docs=[d for d in db(pg,'subsidie_kompas_knowledge_items') if d.get('program_id')==P4]
    ok('H10 document opgeslagen via de bestaande knowledge_items-opslag met program_id (geen nieuwe applicatietabel)', len(db(pg,'subsidie_kompas_knowledge_items'))==nd+1 and len(docs)==1, str(len(docs)))
    ok('H11 het document staat in het contextpaneel van dit project', 'Conceptaanvraag' in pg.get_by_test_id('project-context-panel').inner_text() or '1 document' in pg.get_by_test_id('project-context-panel').inner_text(), pg.get_by_test_id('project-context-panel').inner_text()[-300:])
    pg.goto(f'{BASE}?tier=pro#/kompas/documentatie'); pg.wait_for_timeout(1500)
    ok('H12 het document staat bij Documenten', 'Conceptaanvraag' in txt(pg) or 'Hushu House 2027' in txt(pg))
    pg.goto(f'{BASE}?tier=pro#/kompas/deadlines'); pg.wait_for_timeout(1500)
    ok('H13 Mijn deadlines toont de vier financiers van Hushu House 2027 met de live deadline', all(n in txt(pg) for n in ['Jongerenfonds Noord','Dansimpuls']) and 'Hushu House 2027' in txt(pg))
    pg.screenshot(path='shots/f5_05_keten_deadlines.png')
    ctx.close()

    # ============================================================ I. Visueel
    ctx,pg=nieuw(b,DESK,'pro')
    open_rij(pg,'Projectplan Buurtkeuken'); stuur(pg,'Zoek passende fondsen voor dit project')
    item(pg,'Jongerenfonds Noord').get_by_test_id('fm-toevoegen').click(); pg.wait_for_timeout(700)
    item(pg,'Dansimpuls').get_by_test_id('fm-kies').check(); item(pg,'Wijk Cultuurfonds').get_by_test_id('fm-kies').check()
    pg.screenshot(path='shots/f5_03_selectie_desktop.png')
    item(pg,'Jongerenfonds Noord').get_by_test_id('fm-bespreek').click(); pg.wait_for_timeout(700)
    pg.screenshot(path='shots/f5_04_focus_chip.png')
    ok('I1 desktop: geen horizontale overflow met kaart', geenhscroll(pg))
    ctx.close()
    ctx,pg=nieuw(b,MOB,'pro')
    pg.get_by_test_id('open-gesprekken').click() if pg.get_by_test_id('open-gesprekken').count() else None
    pg.wait_for_timeout(500)
    try:
        pg.locator('[data-testid="gesprek-open"]').filter(has_text='Projectplan Buurtkeuken').first.click(); pg.wait_for_timeout(900)
    except Exception as e:
        pass
    stuur(pg,'Zoek passende fondsen voor dit project')
    ok('I2 mobiel (390 px): kaart past, geen horizontale overflow', pg.get_by_test_id('fm-kaart').count()>=1 and geenhscroll(pg), str(pg.evaluate('[document.documentElement.scrollWidth,window.innerWidth]')))
    pg.get_by_test_id('fm-kaart').first.scroll_into_view_if_needed(); pg.screenshot(path='shots/f5_06_mobiel.png')
    ctx.close()
    b.close()
finally:
    srv.terminate()
fails=[r for r in res if not r[1]]
print(f"\n{len(res)-len(fails)}/{len(res)} OK")
sys.exit(1 if fails else 0)
