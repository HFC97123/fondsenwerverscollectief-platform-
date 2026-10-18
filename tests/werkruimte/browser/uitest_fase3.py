# Fase 3 browsertests: Deadlines (Mijn deadlines / Alle regelingen), toevoegen aan projectfinanciering, duplicaten,
# funder-brede regels, entitlement, reminders, deeplinks. Draait de echte app tegen de nagebootste Supabase.
import subprocess, time, sys, os, re
from playwright.sync_api import sync_playwright
os.chdir(os.path.dirname(os.path.abspath(__file__)))
PORT=8781
srv = subprocess.Popen(['python3','-m','http.server',str(PORT),'-d','web'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1)
BASE=f'http://localhost:{PORT}/index.html'
P1='11111111-1111-4111-8111-111111111111'; P2='22222222-2222-4222-8222-222222222222'; P3='33333333-3333-4333-8333-333333333333'; PX='99999999-9999-4999-8999-999999999999'
S_NIEUW='b0000000-0000-4000-8000-000000000001'; S_TWEE='b0000000-0000-4000-8000-000000000002'; S_PREM='b0000000-0000-4000-8000-000000000003'
FD_ID='d0000000-0000-4000-8000-000000000001'; FUNDER='e0000000-0000-4000-8000-000000000001'
FD_PREM='d0000000-0000-4000-8000-000000000002'; FUNDER_PREM='e0000000-0000-4000-8000-000000000002'
res=[]
def ok(n,c,d=''):
    res.append((n,bool(c),d)); print(('OK  ' if c else 'FAIL'),n,(d if not c else ''), flush=True)
os.makedirs('shots',exist_ok=True)

# Extra seed: zichtbare regelingen en fondsen, plus vergrendelde (Premium) rijen zoals de view ze aan een Pro-lid teruggeeft.
PATCH = """
window.__SEED_PATCH=function(seed,c){
 var dag=c.dag;
 var rij=function(id,naam,funder,dl,extra){return Object.assign({id:id,naam:naam,thema:'Welzijn',werkgebied:'Landelijk',data_tier:'open',source_type:'officieel',status:'Open',status_ruw:'open',volledig_zichtbaar:true,deadline_datum:dl,dagen_resterend:dl?Math.round((new Date(dl+'T00:00:00')-new Date(new Date().toDateString()))/86400000):null,deadline_periode:null,bedrag_min:1000,bedrag_max:20000,voorwaarden:'Voorwaarden.',funder_naam:funder,funder_website:'https://x.test',funder_type:'Fonds',themas_namen:[],doelgroepen_namen:[],werkgebieden_namen:[],bandbreedte_bijdrage_naam:null,beoordelingsdatum:null,beoordelingsperiode:null,rondes_aantal:0},extra||{});};
 var T=seed.tables;
 T.subsidieregelingen_deadlines.push(rij('b0000000-0000-4000-8000-000000000002','Tweede Testregeling','Fonds Twee',dag(20)));
 T.subsidieregelingen_deadlines.push(rij('b0000000-0000-4000-8000-000000000003','PREMIUMREGELING Slot',null,null,{volledig_zichtbaar:false,dagen_resterend:33,data_tier:'premium',bedrag_min:null,bedrag_max:null,voorwaarden:null,funder_website:null,funder_type:null}));
 var fr=function(id,fid,naam,dl,vz){return {id:id,funder_id:fid,funder_naam:naam,funder_type:'Fonds',datamoment_type:'ronde',datamoment_naam:'Ronde 2',data_tier:vz?'open':'premium',source_type:'officieel',volledig_zichtbaar:vz,deadline_datum:vz?dl:null,dagen_resterend:vz&&dl?Math.round((new Date(dl+'T00:00:00')-new Date(new Date().toDateString()))/86400000):34,deadline_periode:null,sluitingstijd:null,toelichting:vz?'Toelichting.':null,bron_url:null,funder_website:vz?'https://fonds.test':null,missie:vz?'Missie van het fonds.':null,aanvraagcriteria:null,bijdrage_min:null,bijdrage_max:null,bandbreedte_bijdrage_naam:null,themas_namen:[],doelgroepen_namen:[],werkgebieden_namen:[]};};
 T.funder_deadlines.push(fr('d0000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000001','Testfonds Breed',dag(25),true));
 T.funder_deadlines.push(fr('d0000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000002','GEHEIMFONDS Premium',null,false));
 seed.bronnen['b0000000-0000-4000-8000-000000000002']={naam:'Tweede Testregeling',funder:'Fonds Twee',deadline:dag(20)};
 seed.bronnen['e0000000-0000-4000-8000-000000000001']={naam:'Testfonds Breed',funder:'Testfonds Breed',website:'https://fonds.test',deadline:dag(25)};
 seed.bronnen['b0000000-0000-4000-8000-000000000003']={naam:'PREMIUMREGELING Slot',funder:'Geheim Premium Fonds',website:'https://geheim.test',deadline:dag(33),premium:true};
 if(window.__EXTRA_PATCH)window.__EXTRA_PATCH(seed,c);
};
"""
def nieuw(b,vp,tier,pad,extra=None,init=None):
    ctx=b.new_context(viewport=vp); pg=ctx.new_page()
    pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='div[style*=\"z-index: 2000\"]{display:none !important}';document.head.appendChild(s)})")
    pg.add_init_script(PATCH)
    if extra: pg.add_init_script('window.__EXTRA_PATCH=function(seed,c){'+extra+'};')
    if init: pg.add_init_script(init)
    pg.errs=[]; pg.cons=[]
    pg.on('pageerror',lambda e: pg.errs.append(str(e)))
    pg.on('console',lambda m: pg.cons.append(m.text) if m.type=='error' and 'favicon' not in m.text and 'Failed to load resource' not in m.text else None)
    pg.goto(f'{BASE}?tier={tier}#{pad}'); pg.wait_for_timeout(1700)
    return ctx,pg
def txt(pg): return pg.locator('body').inner_text().replace('\xa0',' ')
def geenhscroll(pg): return pg.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1')
def fund(pg,prog=None):
    q='window.__DBL.subsidie_kompas_program_funding'
    return pg.evaluate(q+(f'.filter(r=>r.program_id==="{prog}")' if prog else ''))
def rij(pg,naam): return pg.locator('[data-testid="md-rij"]').filter(has=pg.locator(f'[data-testid="md-open"]:text-is("{naam}")'))
def namen(pg,groep): return pg.locator(f'[data-testid="md-groep-{groep}"] [data-testid="md-naam"]').all_inner_texts()
def html(pg): return pg.evaluate("(()=>{const c=document.body.cloneNode(true);c.querySelectorAll('script').forEach(x=>x.remove());return c.innerHTML})()")
def log(pg): return pg.evaluate('window.__LOG')
def open_alle(pg):
    pg.get_by_test_id('segment-alle').click(); pg.wait_for_timeout(500)
def open_detail(pg,naam):
    pg.get_by_text(naam).first.click(); pg.wait_for_timeout(400)
def voeg_toe(pg,project,bedrag=None):
    pg.get_by_test_id('detail-toevoegen').click(); pg.wait_for_timeout(300)
    if project: pg.get_by_test_id('add-project').select_option(label=project); pg.wait_for_timeout(500)
    if bedrag is not None: pg.get_by_test_id('add-bedrag').fill(bedrag)

with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
    vp={'width':1280,'height':900}

    # ================= Mijn deadlines (Pro, bureaublad)
    ctx,pg=nieuw(b,vp,'pro','/kompas/deadlines')
    seg=pg.get_by_test_id('deadlines-segmenten')
    ok('segmenten: Mijn deadlines, Actieplan en Alle regelingen, Mijn deadlines standaard', seg.locator('[role=tab]').all_inner_texts()==['Mijn deadlines','Actieplan','Alle regelingen'] and pg.get_by_test_id('segment-mijn').get_attribute('aria-selected')=='true')
    ok('Mijn deadlines: marktoverzicht (zoekveld/filters) niet zichtbaar in dit segment', pg.get_by_placeholder('Zoek in subsidieregelingen…').count()==0)
    t=txt(pg)
    ok('1: toont alleen eigen financieringsregels (8 van P1; andermans, gearchiveerd project en legacy niet)', pg.locator('[data-testid="md-rij"]').count()==8 and 'GEHEIM' not in t and 'GEARCHIVEERDE' not in t and 'LEGACY' not in t, str(pg.locator('[data-testid="md-rij"]').count()))
    komend=namen(pg,'komend')
    ok('2: sortering komend = eerstvolgende deadline eerst (Oranje -> eigen datum +30 -> eigen datum +40)', komend==['Oranje Fonds Burenhulp','Premium-fonds, niet zichtbaar in uw abonnement','Overschreven Regeling'], str(komend))
    groepen=[e.get_attribute('data-testid') for e in pg.locator('[data-testid^="md-groep-"]').all()]
    ok('2: groepvolgorde komend -> verstreken/afgehandeld -> zonder deadline', groepen==['md-groep-komend','md-groep-eerder','md-groep-zonder'], str(groepen))
    ok('2: verstreken/afgehandeld nieuwste datum eerst', namen(pg,'eerder')==['Afgewezen Regeling','Buurtbudget Utrecht','Wijkfonds Noord','Verstreken Regeling'], str(namen(pg,'eerder')))
    r8=rij(pg,'Overschreven Regeling')
    ok('3: eigen deadline wint van brondatum; beide getoond (Uw datum / Regeling)', 'Uw datum:' in r8.locator('[data-testid="md-deadline"]').inner_text() and 'Regeling:' in r8.locator('[data-testid="md-deadline"]').inner_text(), r8.locator('[data-testid="md-deadline"]').inner_text())
    ok('3: eigen deadline staat in de database, brondatum niet gekopieerd', fund(pg,P1)[7].get('eigen_deadline') and 'deadline' not in fund(pg,P1)[7])
    r6=rij(pg,'Premium-fonds, niet zichtbaar in uw abonnement')
    ok('15: Premium-bron niet via Mijn deadlines: alleen gemaskeerd label met eigen datum, geen naam/website/brondatum', r6.count()==1 and 'PREMIUMFONDS' not in t and 'Geheim Premium' not in t and not pg.evaluate("[...document.querySelectorAll('a')].some(a=>a.href.includes('geheim.test'))") and 'Regeling:' not in r6.inner_text() and 'Uw datum' not in r6.inner_text(), r6.inner_text())
    zonder=namen(pg,'zonder')
    ok('6: regel zonder deadline staat onderaan, gelabeld "Geen deadline bekend"', zonder==['Bron niet meer beschikbaar'] and 'Geen deadline bekend' in rij(pg,'Bron niet meer beschikbaar').inner_text())
    ok('22: verwijderde bron blijft veilig zichtbaar (alleen label, eigen status en bedrag)', 'Gevraagd € 1.000' in rij(pg,'Bron niet meer beschikbaar').inner_text() and 'Interessant' in rij(pg,'Bron niet meer beschikbaar').inner_text())
    r3=rij(pg,'Oranje Fonds Burenhulp')
    ok('rij: project, fonds/regeling, status, bedrag, herinnering en deeplink aanwezig', 'Buurtkeuken De Brug' in r3.inner_text() and 'Oranje Fonds' in r3.inner_text() and 'In voorbereiding' in r3.inner_text() and 'Gevraagd € 8.000' in r3.inner_text() and r3.get_by_test_id('herinnering-knop').count()==1 and r3.get_by_test_id('md-open').count()==1)
    ok('rij: geen CRM-look (geen tabel, geen invoervelden in de lijst)', pg.locator('[data-testid="mijn-deadlines"] table, [data-testid="mijn-deadlines"] input, [data-testid="mijn-deadlines"] select').count()==0)
    pg.screenshot(path='shots/f3_desktop_mijn_deadlines.png', full_page=True)
    ok('geen horizontale scroll (bureaublad)', geenhscroll(pg))

    # --- 23 reminder
    n0=len([l for l in log(pg) if l['tabel'].startswith('functions:')])
    knop=r3.get_by_test_id('herinnering-knop')
    ok('23: herinnering staat aan', knop.get_attribute('data-aan')=='ja' and 'Herinnering aan' in knop.inner_text())
    knop.click(); pg.wait_for_timeout(500)
    ok('23: herinnering uit na klik (UI en database)', rij(pg,'Oranje Fonds Burenhulp').get_by_test_id('herinnering-knop').get_attribute('data-aan')=='nee' and 'Herinnering uit' in rij(pg,'Oranje Fonds Burenhulp').inner_text() and [r for r in fund(pg,P1) if r['scheme_id']=='s3'][0]['reminder_enabled']==False)
    nieuwlog=log(pg)
    ok('23: geen externe notificatie (geen functions.invoke, geen andere tabel dan funding-update)', len([l for l in nieuwlog if l['tabel'].startswith('functions:')])==n0 and all(l['tabel'] in ('subsidie_kompas_program_funding',) or l['op'] in ('select','rpc') for l in nieuwlog if l['op'] not in ('select','rpc') and not l['tabel'].startswith('profiles')) , str([l for l in nieuwlog if l['op'] not in ('select','rpc')]))
    rij(pg,'Oranje Fonds Burenhulp').get_by_test_id('herinnering-knop').click(); pg.wait_for_timeout(400)
    ok('23: herinnering weer aan', [r for r in fund(pg,P1) if r['scheme_id']=='s3'][0]['reminder_enabled']==True)

    # --- 18 deeplink
    rij(pg,'Oranje Fonds Burenhulp').get_by_test_id('md-open').click(); pg.wait_for_timeout(1500)
    ok('18: deeplink opent het juiste project op de tab Projectfinanciering', pg.evaluate('location.hash')==f'#/kompas/projecten/{P1}?tab=projectfinanciering' and pg.locator('[data-testid="tab-btn-projectfinanciering"]').get_attribute('aria-selected')=='true' and pg.locator('[data-testid="project-detail-naam"]').inner_text()=='Buurtkeuken De Brug', pg.evaluate('location.hash'))
    # 19 dashboard = projectdetail
    detail_nog=pg.locator('[data-testid="detail-kpi"][data-kpi="Nog te financieren"]').inner_text().replace('\xa0',' ')
    detail_aang=pg.locator('[data-testid="detail-kpi"][data-kpi="Aangevraagd"]').inner_text().replace('\xa0',' ')
    pg.evaluate("location.hash='#/kompas/dashboard'"); pg.wait_for_timeout(1500)
    dash=txt(pg)
    ok('19: Dashboard toont dezelfde totalen als het projectdossier (€ 35.000 nog te financieren, € 15.000 aangevraagd)', '35.000' in detail_nog and '35.000' in dash and '15.000' in detail_aang and '15.000' in dash)
    ok('Dashboard: deadlinerij linkt naar de projectfinanciering (zelfde deeplink)', pg.locator('[data-testid="dashboard-deadline-link"]').first.get_attribute('href')==f'#/kompas/projecten/{P1}?tab=projectfinanciering')
    ok('geen pageerrors / console errors (Mijn deadlines)', not pg.errs and not pg.cons, '; '.join(pg.errs+pg.cons)[:300])
    ctx.close()

    # ================= 4: regeling-deadline blijft live (geen snapshot)
    ctx,pg=nieuw(b,vp,'pro','/kompas/deadlines')
    voor=rij(pg,'Oranje Fonds Burenhulp').get_by_test_id('md-deadline').inner_text()
    pg.evaluate("window.__SEED.bronnen.s3.deadline=window.__SEED_DAG(5)")
    pg.evaluate("location.hash='#/kompas/dashboard'"); pg.wait_for_timeout(600)
    pg.evaluate("location.hash='#/kompas/deadlines'"); pg.wait_for_timeout(1500)
    na=rij(pg,'Oranje Fonds Burenhulp').get_by_test_id('md-deadline').inner_text()
    ok('4: brondatum van de regeling blijft live (verandert mee, niet opgeslagen)', voor!=na and 'over 5 dagen' in na and 'deadline' not in [k for k in fund(pg,P1)[2].keys()] , f'{voor!r} -> {na!r}')
    ctx.close()

    # ================= Alle regelingen + toevoegen (regeling)
    ctx,pg=nieuw(b,vp,'pro','/kompas/deadlines')
    open_alle(pg)
    ok('Alle regelingen: marktoverzicht intact (zoekveld, filters, kaarten)', pg.get_by_placeholder('Zoek in subsidieregelingen…').count()==1 and 'Nieuwe Testregeling' in txt(pg) and 'Testfonds Breed' in txt(pg))
    ok('Alle regelingen: kaarten zelf onveranderd (geen extra knoppen op de kaart)', pg.locator('[data-testid="detail-toevoegen"]').count()==0)
    open_detail(pg,'Nieuwe Testregeling')
    ok('Alle regelingen: contextuele acties in de detailkaart', pg.get_by_test_id('detail-toevoegen').inner_text()=='Opnemen in een project' and pg.get_by_test_id('detail-bespreek').inner_text()=='Bespreek met Subsidie Kompas')
    pg.get_by_test_id('detail-toevoegen').click(); pg.wait_for_timeout(300)
    opties=pg.get_by_test_id('add-project').locator('option').all_inner_texts()
    ok('9: gearchiveerd project niet kiesbaar', 'Oud Gearchiveerd Project' not in opties, str(opties))
    ok('8: andermans project niet kiesbaar (alleen eigen actieve projecten)', not any('GEHEIM' in o for o in opties) and sorted(o for o in opties if o and not o.startswith('Kies'))==['Buurtkeuken De Brug','Taalcafe Zuid'], str(opties))
    ok('add-dialoog: compact (één project-keuze, bedrag optioneel, twee knoppen)', pg.get_by_test_id('add-dialoog').locator('select').count()==1 and pg.get_by_test_id('add-dialoog').locator('input').count()==1 and 'optioneel' in pg.get_by_test_id('add-dialoog').inner_text() and pg.get_by_test_id('add-opslaan').is_disabled())
    ok('add-dialoog: toont de bronnaam', 'Nieuwe Testregeling' in pg.get_by_test_id('add-bron').inner_text())
    pg.screenshot(path='shots/f3_desktop_dialoog.png')
    pg.get_by_test_id('add-project').select_option(label='Taalcafe Zuid'); pg.wait_for_timeout(400)
    pg.get_by_test_id('add-bedrag').fill('12.500')
    pg.get_by_test_id('add-opslaan').click(); pg.wait_for_timeout(700)
    r=fund(pg,P2)
    ok('7: toevoegen aan eigen project: verwijzing + gevraagd bedrag + startstatus Interessant', len(r)==1 and r[0]['scheme_id']==S_NIEUW and r[0]['funder_id'] is None and r[0]['requested_amount']==12500 and r[0]['status']=='interesting' and r[0]['user_id']=='u1' and r[0]['program_id']==P2, str(r))
    ok('7: succesmelding met project en link "Open projectfinanciering"', 'staat nu in de projectfinanciering van Taalcafe Zuid' in pg.get_by_test_id('add-succes').inner_text() and pg.get_by_test_id('open-projectfinanciering').get_attribute('href')==f'#/kompas/projecten/{P2}?tab=projectfinanciering')
    ok('7: geen kopie van naam/deadline/bedragen van de bron in de rij', set(r[0].keys())<={'id','user_id','program_id','scheme_id','funder_id','requested_amount','status'}, str(r[0].keys()))
    # 10/12 dubbel (frontend-precheck)
    pg.get_by_role('button',name='Sluiten').last.click(); pg.wait_for_timeout(200)
    pg.get_by_test_id('detail-toevoegen').click(); pg.wait_for_timeout(300)
    pg.get_by_test_id('add-project').select_option(label='Taalcafe Zuid'); pg.wait_for_timeout(600)
    d=pg.get_by_test_id('add-dialoog').inner_text()
    ok('10: dubbele regeling -> "Staat al in projectfinanciering" + actie "Open projectfinanciering"', 'Staat al in projectfinanciering' in d and pg.get_by_test_id('open-projectfinanciering').count()==1 and pg.get_by_test_id('add-opslaan').count()==0)
    ok('12: geen technische foutmelding', not re.search(r'23505|duplicate|violates|constraint|postgres|42501', d, re.I), d)
    ok('10: nog steeds één regel in de database', len(fund(pg,P2))==1)
    pg.get_by_test_id('open-projectfinanciering').click(); pg.wait_for_timeout(1500)
    ok('18: "Open projectfinanciering" vanuit de dialoog opent de tab van het juiste project', pg.evaluate('location.hash')==f'#/kompas/projecten/{P2}?tab=projectfinanciering' and pg.locator('[data-testid="pf-regel"]').count()==1)
    ok('geen pageerrors / console errors (toevoegen)', not pg.errs and not pg.cons, '; '.join(pg.errs+pg.cons)[:300])
    ctx.close()

    # ================= Race: de database blokkeert, de UI toont dezelfde vriendelijke melding
    ctx,pg=nieuw(b,vp,'pro','/kompas/deadlines')
    open_alle(pg); open_detail(pg,'Tweede Testregeling'); voeg_toe(pg,'Taalcafe Zuid')
    ok('race: voorcontrole ziet nog niets', pg.get_by_test_id('add-bestaat-al').count()==0 and pg.get_by_test_id('add-opslaan').is_enabled())
    pg.evaluate(f'window.__DBL.subsidie_kompas_program_funding.push({{id:"f0000000-0000-4000-8000-000000000099",user_id:"u1",program_id:"{P2}",scheme_id:"{S_TWEE}",funder_id:null,requested_amount:null,awarded_amount:null,status:"interesting",eigen_deadline:null,reminder_enabled:true,notes:null}})')
    pg.get_by_test_id('add-opslaan').click(); pg.wait_for_timeout(700)
    d=pg.get_by_test_id('add-dialoog').inner_text()
    ok('10/12: race -> database weigert (23505), UI toont vriendelijk "Staat al in projectfinanciering", geen technische tekst', 'Staat al in projectfinanciering' in d and not re.search(r'23505|duplicate|violates|constraint', d, re.I) and len(fund(pg,P2))==1, d)
    ctx.close()

    # ================= Funder-brede regel (13, 5, 11)
    ctx,pg=nieuw(b,vp,'pro','/kompas/deadlines')
    open_alle(pg); open_detail(pg,'Testfonds Breed')
    ok('13: fondskaart heeft dezelfde acties', pg.get_by_test_id('detail-toevoegen').count()==1 and pg.get_by_test_id('detail-bespreek').count()==1)
    voeg_toe(pg,'Taalcafe Zuid')
    ok('13: dialoog benoemt een fonds (geen verzonnen regeling)', 'Fonds toevoegen aan projectfinanciering' in pg.get_by_test_id('add-dialoog').inner_text() and 'Testfonds Breed' in pg.get_by_test_id('add-bron').inner_text())
    pg.get_by_test_id('add-opslaan').click(); pg.wait_for_timeout(700)
    r=fund(pg,P2)
    ok('13: fonds-brede regel: funder_id gevuld, scheme_id leeg, geen gekopieerde naam', len(r)==1 and r[0]['funder_id']==FUNDER and r[0]['scheme_id'] is None and r[0]['requested_amount'] is None and 'naam' not in r[0], str(r))
    pg.get_by_role('button',name='Sluiten').last.click(); pg.wait_for_timeout(200)
    pg.get_by_test_id('detail-toevoegen').click(); pg.wait_for_timeout(300)
    pg.get_by_test_id('add-project').select_option(label='Taalcafe Zuid'); pg.wait_for_timeout(600)
    ok('11: dubbel fonds -> "Staat al in projectfinanciering"', 'Staat al in projectfinanciering' in pg.get_by_test_id('add-dialoog').inner_text() and len(fund(pg,P2))==1)
    pg.get_by_role('button',name='Annuleren').click(); pg.wait_for_timeout(200)
    pg.get_by_role('button',name='Sluiten').first.click(); pg.wait_for_timeout(200)
    pg.get_by_test_id('segment-mijn').click(); pg.wait_for_timeout(1500)
    rf=rij(pg,'Testfonds Breed')
    ok('5: fondsdatum (funder_deadlines/bron) komt live in Mijn deadlines, gelabeld "Datum van het fonds"', rf.count()==1 and rf.get_by_test_id('md-project').inner_text()=='Taalcafe Zuid' and 'over 25 dagen' in rf.get_by_test_id('md-deadline').inner_text() and 'Fonds' in rf.inner_text(), rf.inner_text() if rf.count() else 'geen rij')
    ok('5: fondsregel in groep komend', 'Testfonds Breed' in namen(pg,'komend'))
    ctx.close()

    # ================= 14, 16, 17: entitlement, Free, Bespreek
    ctx,pg=nieuw(b,vp,'pro','/kompas/deadlines')
    open_alle(pg)
    t=txt(pg)
    ok('14: vergrendelde regeling/fonds: geen verstrekker, website of deadline in de lijst (Pro)', 'Geheim Premium Fonds' not in t and 'geheim.test' not in html(pg))
    pg.get_by_text('PREMIUMREGELING Slot').first.click(); pg.wait_for_timeout(400)
    t=txt(pg)
    ok('14: vergrendelde rij opent de upgradekaart; geen toevoeg-actie, geen dialoog', pg.get_by_test_id('detail-toevoegen').count()==0 and pg.get_by_test_id('add-dialoog').count()==0 and 'Geïnteresseerd in deze subsidieregeling?' in t)
    ok('14: geen Premium-gegevens in de upgradekaart', 'Geheim Premium Fonds' not in t and 'geheim.test' not in html(pg))
    pg.get_by_role('button',name='Sluiten').last.click(); pg.wait_for_timeout(200)
    pg.get_by_text('GEHEIMFONDS Premium').first.click(); pg.wait_for_timeout(300)
    ok('14: vergrendeld fonds: geen toevoeg-actie', pg.get_by_test_id('detail-toevoegen').count()==0 and pg.get_by_test_id('add-dialoog').count()==0)
    pg.get_by_role('button',name='Sluiten').last.click(); pg.wait_for_timeout(200)
    # 17 Bespreek
    open_detail(pg,'Nieuwe Testregeling')
    voor=len(log(pg))
    pg.get_by_test_id('detail-bespreek').click(); pg.wait_for_timeout(1500)
    na=log(pg)[voor:]
    ls=pg.evaluate("JSON.stringify(Object.assign({}, localStorage))")
    ok('17: Bespreek met Subsidie Kompas gaat alleen naar de bestaande Chat (/kompas)', pg.evaluate('location.hash')=='#/kompas', pg.evaluate('location.hash'))
    ok('17: geen fondsgegevens in chatverzoek, opslag of database (geen insert, geen bron-id in localStorage)', not [l for l in na if l['op'] in ('insert','update','upsert','delete')] and S_NIEUW not in ls and 'Nieuwe Testregeling' not in ls, ls[:200])
    ok('17: chat start zonder gekoppeld project of fondscontext', 'Nieuwe Testregeling' not in txt(pg))
    ctx.close()

    # Free
    ctx,pg=nieuw(b,vp,'free','/kompas/deadlines')
    ok('16: Free ziet geen segmenten en direct het marktoverzicht', pg.get_by_test_id('deadlines-segmenten').count()==0 and pg.get_by_placeholder('Zoek in subsidieregelingen…').count()==1)
    ok('16: Free: geen dekkingsplan-RPC of fundingtabel aangeroepen', not [l for l in log(pg) if l['tabel']=='rpc:kompas_dekkingsplan' or l['tabel']=='subsidie_kompas_program_funding'])
    open_detail(pg,'Nieuwe Testregeling')
    t=txt(pg)
    ok('16: Free: detailkaart ongewijzigd (uitleg + abonnementen, geen toevoeg- of bespreekknop)', 'Opnemen in een project' in t and 'Bekijk de abonnementen' in t and pg.get_by_test_id('detail-toevoegen').count()==0 and pg.get_by_test_id('detail-bespreek').count()==0)
    pg.screenshot(path='shots/f3_free_detail.png')
    pg.get_by_role('button',name='Sluiten').last.click(); pg.wait_for_timeout(200)
    pg.get_by_text('Testfonds Breed').first.click(); pg.wait_for_timeout(300)
    ok('16: Free: fondskaart zonder projectsectie (zoals voorheen)', 'Opnemen in een project' not in txt(pg) and pg.get_by_test_id('detail-toevoegen').count()==0)
    ok('16: Free: geen pageerrors', not pg.errs and not pg.cons, '; '.join(pg.errs+pg.cons)[:200])
    ctx.close()

    # Premium: zelfde segmenten, premium bron wel zichtbaar in eigen overzicht
    ctx,pg=nieuw(b,vp,'premium','/kompas/deadlines')
    t=txt(pg)
    ok('Premium: Mijn deadlines toont de Premium-bron met naam (eigen rechten)', 'PREMIUMFONDS Geheimnaam' in t and 'Premium-fonds, niet zichtbaar' not in t)
    open_alle(pg)
    ok('Premium: Alle regelingen toont het premium fonds/regeling volledig, met acties', 'PREMIUMREGELING Slot' in txt(pg))
    ctx.close()

    # ================= 20/21: project zonder deadlines / zonder financiering
    ctx,pg=nieuw(b,vp,'pro','/kompas/deadlines',extra="seed.tables.subsidie_kompas_program_funding=[];")
    ok('21: projecten zonder financiering: rustige lege staat met doorverwijzing', pg.get_by_test_id('md-leeg').count()==1 and 'Nog geen regelingen in uw projecten' in txt(pg) and pg.locator('[data-testid="md-rij"]').count()==0)
    pg.get_by_role('button',name='Bekijk alle regelingen').click(); pg.wait_for_timeout(500)
    ok('21: lege staat leidt naar Alle regelingen', pg.get_by_placeholder('Zoek in subsidieregelingen…').count()==1)
    ok('21: geen pageerrors', not pg.errs and not pg.cons, '; '.join(pg.errs+pg.cons)[:200])
    ctx.close()
    ctx,pg=nieuw(b,vp,'pro','/kompas/deadlines',extra="seed.tables.subsidie_kompas_program_funding=[c.FR(1,c.P1,{status:'interesting',requested_amount:500}),c.FR(2,c.P1,{status:'preparing'})];")
    ok('20: project zonder enige deadline: alles onder "Zonder deadline", geen fout', pg.locator('[data-testid="md-groep-komend"]').count()==0 and pg.locator('[data-testid="md-groep-zonder"] [data-testid="md-rij"]').count()==2 and not pg.errs, str(pg.errs))
    ctx.close()
    ctx,pg=nieuw(b,vp,'pro','/kompas/deadlines',extra="seed.tables.subsidie_kompas_programs=seed.tables.subsidie_kompas_programs.filter(function(x){return x.id!==c.P1&&x.id!==c.P2&&x.id!==c.P3;});")
    ok('21: lid zonder eigen actief project: uitleg met link naar Projecten', pg.get_by_test_id('md-geen-projecten').count()==1)
    ctx.close()
    ctx,pg=nieuw(b,vp,'pro','/kompas/deadlines',extra="seed.tables.subsidie_kompas_program_funding.forEach(function(r){if(r.id.endsWith('07'))r.eigen_deadline=c.dag(12);});")
    ok('22: verwijderde bron met eigen deadline staat in "Komende deadlines" met datum', 'Bron niet meer beschikbaar' in namen(pg,'komend') and 'over 12 dagen' in rij(pg,'Bron niet meer beschikbaar').get_by_test_id('md-deadline').inner_text(), str(namen(pg,'komend')))
    ctx.close()

    # ================= Mobiel
    vm={'width':375,'height':812}
    ctx,pg=nieuw(b,vm,'pro','/kompas/deadlines')
    ok('mobiel Mijn deadlines: geen horizontale scroll', geenhscroll(pg), str(pg.evaluate('document.documentElement.scrollWidth')))
    bb=[x.bounding_box() for x in pg.locator('[data-testid="md-rij"]').all()]
    ok('mobiel: rijen passen in de breedte als kaarten', bb and all(x['x']>=0 and x['x']+x['width']<=375.5 for x in bb))
    r3=rij(pg,'Oranje Fonds Burenhulp')
    kb=r3.get_by_test_id('herinnering-knop').bounding_box(); ob=r3.bounding_box()
    midden=pg.evaluate("(el)=>{const r=el.getBoundingClientRect();const x=r.left+r.width*0.5, y=r.top+r.height*0.5;const e=document.elementFromPoint(x,y);return e&&e.getAttribute('data-testid')}", r3.element_handle())
    ok('mobiel: herinnering bereikbaar (tap >= 44px) en de hele kaart is het tikgebied naar de projectfinanciering (>= 44px, binnen beeld)', kb['height']>=44 and ob['height']>=44 and kb['x']+kb['width']<=375 and ob['x']+ob['width']<=375 and midden=='md-open', str(midden))
    pg.screenshot(path='shots/f3_mobile_mijn_deadlines.png', full_page=True)
    open_alle(pg); open_detail(pg,'Nieuwe Testregeling')
    ok('mobiel: detailkaart geen horizontale scroll', geenhscroll(pg))
    pg.get_by_test_id('detail-toevoegen').click(); pg.wait_for_timeout(300)
    db=pg.get_by_test_id('add-dialoog').bounding_box()
    ok('mobiel: dialoog binnen beeld, onderaan als sheet', db['x']>=0 and db['x']+db['width']<=375.5 and db['y']+db['height']<=812.5 and geenhscroll(pg), str(db))
    pg.screenshot(path='shots/f3_mobile_dialoog.png')
    ok('mobiel: geen pageerrors', not pg.errs and not pg.cons, '; '.join(pg.errs+pg.cons)[:200])
    ctx.close()
    b.close()
srv.terminate()
f=[r for r in res if not r[1]]
print(f'\n{len(res)-len(f)}/{len(res)} geslaagd')
sys.exit(1 if f else 0)
