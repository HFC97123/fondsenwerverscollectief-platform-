# Browsertests: vereenvoudigd projectformulier, automatische te-financieren berekening, één financiële bron
# (Dashboard = Projecten = Projectdetail = Projectfinanciering), cofinanciers op naam, en het documentvoorstel.
import subprocess, time, sys, os, re, json
from playwright.sync_api import sync_playwright
os.chdir(os.path.dirname(os.path.abspath(__file__)))
srv = subprocess.Popen(['python3','-m','http.server','8781','-d','web'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1)
BASE='http://localhost:8781/index.html'
P1='11111111-1111-4111-8111-111111111111'; P4='44444444-4444-4444-8444-444444444444'; PX='99999999-9999-4999-8999-999999999999'
D1='a0000000-0000-4000-8000-000000000041'; D2='a0000000-0000-4000-8000-000000000042'
res=[]
def ok(n,c,d=''):
    res.append((n,bool(c),d)); print(('OK  ' if c else 'FAIL'),n,(d if not c else ''), flush=True)
os.makedirs('shots',exist_ok=True)
SEED_PATCH = """
window.__SEED_PATCH=function(seed,h){
  var t=seed.tables;
  t.subsidie_kompas_programs.push(h.P('%(P4)s','Fondsenwerving Hulp Na Onderzoek',{budget_total:420000,own_contribution:80000,requested_amount:340000,description:null,
     cofinanciers:[{naam:'LEGACY JSON NAAM',bedrag:'999999',status:'Toegezegd'}]}));
  [['Stichting Hulp Na Onderzoek','awarded',null,25000],['Stichting DOCO','awarded',null,5000],['Gemeente Amsterdam','submitted',160000,null]].forEach(function(x,i){
    t.subsidie_kompas_program_funding.push(h.FR(20+i,'%(P4)s',{financier_naam:x[0],status:x[1],requested_amount:x[2],awarded_amount:x[3]}));});
  t.subsidie_kompas_knowledge_items.push({id:'%(D1)s',program_id:'%(P4)s',file_name:'Projectplan Hulp Na Onderzoek.pdf',title:null,notes:null,extracted_text:'Het project biedt nazorg aan nabestaanden. Voor wie: gezinnen. Resultaat: begeleiding.',doc_type:'Projectplan',version:1,document_context:{},superseded_at:null,created_at:'2026-10-05T10:00:00Z',source_type:'upload'});
  t.subsidie_kompas_knowledge_items.push({id:'%(D2)s',program_id:'%(P4)s',file_name:'Leeg scan.pdf',title:null,notes:null,extracted_text:'',doc_type:'Overig',version:1,document_context:{},superseded_at:null,created_at:'2026-10-06T10:00:00Z',source_type:'upload'});
};
""" % dict(P4=P4,D1=D1,D2=D2)
def nieuw(b,vp,tier,pad,init=None):
    ctx=b.new_context(viewport=vp); pg=ctx.new_page()
    pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='div[style*=\"z-index: 2000\"]{display:none !important}';document.head.appendChild(s)})")
    pg.add_init_script(SEED_PATCH)
    if init: pg.add_init_script(init)
    pg.errs=[]; pg.on('pageerror',lambda e: pg.errs.append(str(e)))
    pg.goto(f'{BASE}?tier={tier}#{pad}'); pg.wait_for_timeout(1600)
    return ctx,pg
def txt(pg): return pg.locator('body').inner_text().replace('\xa0',' ')
def db(pg,tabel): return pg.evaluate(f'window.__DBL["{tabel}"]')
def prog(pg,pid): return pg.evaluate(f'window.__DBL.subsidie_kompas_programs.find(r=>r.id==="{pid}")')
def kpi(pg,naam): return pg.locator(f'[data-testid="detail-kpi"][data-kpi="{naam}"]').inner_text().replace('\xa0',' ').replace('\n',' | ')
def geenhscroll(pg): return pg.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1')
def vul(pg,tid,w):
    l=pg.locator(f'[data-testid="{tid}"]'); l.fill(w)
def waar(pg,tid): return pg.locator(f'[data-testid="{tid}"]').get_attribute('data-waarde')
VERWIJDERD=['Programma of onderdeel','Partners','Doelstellingen','Activiteiten','Beoogde impact','Resultaten','Schrijfvoorkeur','Eerdere','Co-financier','Cofinancier']
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
    # ================= 1. Aanmaakformulier desktop
    ctx,pg=nieuw(b,{'width':1280,'height':1000},'pro','/kompas/projecten')
    pg.get_by_role('button',name='+ Nieuw project').click(); pg.wait_for_timeout(500)
    f=pg.locator('[data-testid="nieuw-project-formulier"]'); ft=f.inner_text().replace('\xa0',' ')
    ok('formulier: gewenste velden zichtbaar', all(x in ft for x in ['Projectnaam','Doelgroep','Looptijd van','Looptijd tot','Projectlocatie','Projectomschrijving','Totale projectbegroting','Eigen bijdrage','Te financieren bedrag']), ft)
    ok('formulier: verwijderde velden niet zichtbaar', not any(x in ft for x in VERWIJDERD), ft)
    ok('formulier: knop "Project aanmaken"', f.get_by_role('button',name='Project aanmaken').count()==1)
    ok('formulier: hulptekst bij omschrijving', 'Heb je al een projectplan of two-pager? Voeg die toe en laat Subsidie Kompas je projectomschrijving aanvullen.' in ft)
    ok('formulier: twee native datumvelden', f.locator('input[type="date"]').count()==2)
    ok('formulier: te financieren is read-only (geen invoerveld) en toont €0 zonder begroting', pg.locator('input[data-testid="np-te-financieren"]').count()==0 and waar(pg,'np-te-financieren')=='0')
    pg.screenshot(path='shots/formulier_1_desktop.png', full_page=True)
    # ================= 2. Automatische berekening
    vul(pg,'np-naam','Testproject Nieuw'); vul(pg,'np-regio','Accra, Ghana'); vul(pg,'np-periode-van','2027-01-15'); vul(pg,'np-periode-tot','2027-12-31')
    vul(pg,'np-omschrijving','Een kort project.'); vul(pg,'np-begroting','420.000'); vul(pg,'np-eigen','80.000')
    ok('berekening: 420.000 - 80.000 = € 340.000', waar(pg,'np-te-financieren')=='340000' and '€ 340.000' in pg.locator('[data-testid="np-te-financieren"]').inner_text().replace('\xa0',' '))
    pg.screenshot(path='shots/formulier_3_berekening.png', full_page=True)
    vul(pg,'np-eigen','500.000')
    ok('berekening: eigen bijdrage hoger dan begroting -> € 0, nooit negatief', waar(pg,'np-te-financieren')=='0' and 'hoger dan de begroting' in txt(pg))
    vul(pg,'np-begroting','12x')
    ok('berekening: ongeldig bedrag -> geen waarde (geen raden)', waar(pg,'np-te-financieren')=='')
    aantal=len(db(pg,'subsidie_kompas_programs'))
    f.get_by_role('button',name='Project aanmaken').click(); pg.wait_for_timeout(600)
    ok('ongeldig bedrag: foutmelding en niets opgeslagen', pg.locator('[data-testid="np-fout"]').count()==1 and len(db(pg,'subsidie_kompas_programs'))==aantal)
    vul(pg,'np-begroting','420.000'); vul(pg,'np-eigen','80.000')
    f.get_by_role('button',name='Project aanmaken').click(); pg.wait_for_timeout(1500)
    h=pg.evaluate('location.hash')
    m=re.match(r'#/kompas/projecten/([0-9a-f-]{36})$',h)
    ok('na aanmaken opent het projectdossier /kompas/projecten/<id>', bool(m), h)
    nid=m.group(1) if m else ''
    ok('projectdossier toont de naam', pg.locator('[data-testid="project-detail-naam"]').inner_text()=='Testproject Nieuw')
    r=prog(pg,nid) or {}
    ok('database: start- en einddatum bewaard', (r.get('period_start'),r.get('period_end'))==('2027-01-15','2027-12-31'), str((r.get('period_start'),r.get('period_end'))))
    ok('database: begroting 420000, eigen bijdrage 80000, requested_amount (te financieren) 340000', (r.get('budget_total'),r.get('own_contribution'),r.get('requested_amount'))==(420000,80000,340000), str(r))
    ok('database: locatie en omschrijving bewaard; niet-gevraagde velden niet gevuld (maar kolommen bestaan nog)', r.get('location')=='Accra, Ghana' and r.get('description')=='Een kort project.' and not r.get('goals') and not r.get('partners'))
    ok('database: previous_grants/cofinanciers/linked_schemes niet meer geschreven', 'cofinanciers' not in r and 'previous_grants' not in r and 'linked_schemes' not in r)
    ok('dossier: looptijd leesbaar uit ISO-datums', '15 jan 2027 – 31 dec 2027' in pg.locator('[data-testid="project-detail-meta"]').inner_text())
    ok('dossier KPI: begroting € 420.000, eigen bijdrage € 80.000, nog te financieren € 340.000', '€ 420.000' in kpi(pg,'Totale begroting') and '€ 80.000' in kpi(pg,'Eigen bijdrage') and '€ 340.000' in kpi(pg,'Nog te financieren'))
    ok('geen paginafouten', not pg.errs, str(pg.errs)); ctx.close()
    # ================= 2b. Mobiel
    ctx,pg=nieuw(b,{'width':390,'height':844},'pro','/kompas/projecten')
    pg.get_by_role('button',name='+ Nieuw project').click(); pg.wait_for_timeout(500)
    ok('mobiel: formulier zonder horizontale scroll', geenhscroll(pg))
    ok('mobiel: velden zichtbaar en bruikbaar', pg.locator('[data-testid="np-naam"]').is_visible() and pg.locator('[data-testid="np-te-financieren"]').count()==1)
    vul(pg,'np-begroting','100.000'); vul(pg,'np-eigen','25.000')
    ok('mobiel: automatische berekening werkt', waar(pg,'np-te-financieren')=='75000')
    pg.screenshot(path='shots/formulier_2_mobiel.png', full_page=True); ctx.close()
    # ================= 3. Eén financiële bron: P4 (€30k toegekend / €160k aangevraagd)
    ctx,pg=nieuw(b,{'width':1280,'height':1000},'pro',f'/kompas/projecten/{P4}')
    k={n:kpi(pg,n) for n in ['Totale begroting','Toegekend','Aangevraagd','Eigen bijdrage','Nog te financieren']}
    ok('detail: Toegekend € 30.000 en Aangevraagd € 160.000', '€ 30.000' in k['Toegekend'] and '€ 160.000' in k['Aangevraagd'], str(k))
    ok('detail: Eigen bijdrage € 80.000 en Nog te financieren € 150.000', '€ 80.000' in k['Eigen bijdrage'] and '€ 150.000' in k['Nog te financieren'], str(k))
    ok('detail: oude JSON-cofinancier telt niet mee en wordt niet getoond', 'LEGACY JSON NAAM' not in txt(pg))
    pg.locator('[data-testid="tab-btn-projectfinanciering"]').click(); pg.wait_for_timeout(800)
    t=txt(pg)
    ok('Projectfinanciering: de drie financiers als regels', all(x in t for x in ['Stichting Hulp Na Onderzoek','Stichting DOCO','Gemeente Amsterdam']))
    ok('Projectfinanciering: label "Cofinancier of andere financiering" en geen "Regeling"-label voor namen', t.count('Cofinancier of andere financiering')>=3)
    ok('Projectfinanciering: oude notitie over niet-meegetelde co-financiers is weg', 'vrije tekst' not in t)
    ok('Projectfinanciering: statussen Toegekend/Aangevraagd', pg.locator('[data-testid="pf-regel"]').filter(has_text='Gemeente Amsterdam').inner_text().count('Aangevraagd')>=1)
    pg.screenshot(path='shots/formulier_4_projectfinanciering.png', full_page=True)
    # Dashboard
    pg.goto(f'{BASE}?tier=pro#/kompas/dashboard'); pg.wait_for_timeout(1800)
    kaart=pg.locator('[data-testid="dashboard-project"]').filter(has_text='Fondsenwerving Hulp Na Onderzoek')
    kt=kaart.inner_text().replace('\xa0',' ')
    ok('Dashboard: zelfde project toont € 30.000 toegekend en € 160.000 aangevraagd', '€ 30.000' in kt and '€ 160.000' in kt and '€ 150.000' in kt, kt)
    pg.screenshot(path='shots/formulier_5_dashboard.png', full_page=True)
    # Projecten
    pg.goto(f'{BASE}?tier=pro#/kompas/projecten'); pg.wait_for_timeout(1800)
    kf=' || '.join(re.sub(r'\s+',' ',x.replace('\xa0',' ')) for x in pg.locator('[data-testid="projecten-kaart-financiering"]').all_inner_texts())
    ok('Projecten: kaart van hetzelfde project toont dezelfde bedragen', 'Toegekend € 30.000 · Aangevraagd € 160.000 · Eigen bijdrage € 80.000 · Nog te financieren € 150.000' in kf, kf)
    ok('Projecten: geen foutmelding bij een gearchiveerd project', 'kon niet worden geladen' not in kf, kf)
    ok('Projecten: kaart noemt geen "eerdere toekenningen"/"co-financiers" meer', 'eerdere toekenning' not in txt(pg) and 'co-financiers' not in txt(pg))
    pg.screenshot(path='shots/formulier_6_projecten_kaart.png', full_page=True)
    # Bewerkformulier P4: geen eerdere/cofin-secties, te-financieren read-only
    kaartP4=pg.locator('div').filter(has_text='Fondsenwerving Hulp Na Onderzoek').filter(has=pg.get_by_role('button',name='Bewerken')).last
    kaartP4.get_by_role('button',name='Bewerken').click(); pg.wait_for_timeout(500)
    bt=txt(pg)
    ok('bewerken: geen "Eerdere fondsen en toekenningen" of "Co-financiers"-sectie; wel "Cofinanciers en andere financiering"-verwijzing', 'Eerdere fondsen' not in bt and 'Co-financiers' not in bt and 'Cofinanciers en andere financiering' in bt)
    ok('bewerken: Te financieren bedrag read-only € 340.000', '€ 340.000' in pg.locator('[data-testid="bewerk-te-financieren"]').inner_text().replace('\xa0',' ') and pg.locator('input[data-testid="bewerk-te-financieren"]').count()==0)
    ok('bewerken: bestaande projectvelden (programma, partners, doelstellingen...) blijven bewerkbaar', all(x in bt for x in ['Programma of onderdeel','Partners','Doelstellingen','Activiteiten','Beoogde impact','Resultaten','Schrijfvoorkeur']))
    ctx.close()
    # ================= 4. Legacy-project bewerken verliest niets
    ctx,pg=nieuw(b,{'width':1280,'height':1000},'pro',f'/kompas/projecten?bewerk={P1}')
    pg.wait_for_timeout(500)
    ok('bewerken P1: oude looptijd-tekst blijft leesbaar in tekstveld met "Kies een datum"', pg.get_by_role('button',name='Kies een datum').count()==2)
    vals_voor=prog(pg,P1)
    pg.get_by_role('button',name='Project opslaan').click(); pg.wait_for_timeout(1200)
    na=prog(pg,P1)
    ok('opslaan P1: cofinanciers/previous_grants/linked_schemes blijven onaangeroerd (geen dataverlies)', json.dumps(na.get('cofinanciers'),sort_keys=True)==json.dumps(vals_voor.get('cofinanciers'),sort_keys=True) and len(na.get('linked_schemes'))==2 and len(na.get('cofinanciers'))==2)
    ok('opslaan P1: requested_amount afgeleid (100.000 - 20.000 = 80.000)', na.get('requested_amount')==80000, str(na.get('requested_amount')))
    ok('opslaan P1: oude looptijd-tekst ongewijzigd bewaard', (na.get('period_start'),na.get('period_end'))==('jan 2027','dec 2027'))
    ctx.close()
    # ================= 5. Cofinancier op naam toevoegen
    ctx,pg=nieuw(b,{'width':1280,'height':1000},'pro',f'/kompas/projecten/{P4}?tab=projectfinanciering')
    pg.locator('[data-testid="pf-financier-open"]').click(); pg.wait_for_timeout(300)
    pg.locator('[data-testid="pf-financier-opslaan"]').click(); pg.wait_for_timeout(300)
    ok('cofinancier: lege naam geeft melding', pg.locator('[data-testid="pf-financier-fout"]').count()==1)
    vul(pg,'pf-financier-naam','Nieuwe Stichting'); vul(pg,'pf-financier-bedrag','10.000'); pg.locator('[data-testid="pf-financier-status"]').select_option('awarded')
    pg.locator('[data-testid="pf-financier-opslaan"]').click(); pg.wait_for_timeout(900)
    rij=[r for r in db(pg,'subsidie_kompas_program_funding') if r.get('financier_naam')=='Nieuwe Stichting']
    ok('cofinancier: opgeslagen als financier_naam zonder scheme/funder, toegekend 10.000', len(rij)==1 and not rij[0].get('scheme_id') and not rij[0].get('funder_id') and rij[0].get('awarded_amount')==10000 and rij[0].get('status')=='awarded', str(rij))
    pg.locator('[data-testid="tab-btn-overzicht"]').click(); pg.wait_for_timeout(300)
    ok('cofinancier: Toegekend wordt € 40.000 in het dossier', '€ 40.000' in kpi(pg,'Toegekend'), kpi(pg,'Toegekend'))
    pg.locator('[data-testid="tab-btn-projectfinanciering"]').click(); pg.wait_for_timeout(400)
    pg.locator('[data-testid="pf-financier-open"]').click(); vul(pg,'pf-financier-naam',' nieuwe stichting '); vul(pg,'pf-financier-bedrag','1'); pg.locator('[data-testid="pf-financier-opslaan"]').click(); pg.wait_for_timeout(700)
    ok('cofinancier: dezelfde naam twee keer wordt geweigerd met melding', 'staat al bij dit project' in txt(pg))
    ctx.close()
    # ================= 6. Document -> voorstel korte omschrijving
    VOORSTEL='Het project biedt nazorg aan nabestaanden. Het richt zich op gezinnen en levert begeleiding op.'
    init="window.__FN=async function(n,body){ if(body.documentId==='%s') return {data:{omschrijving:null,reden:'geen-tekst'},error:null}; return {data:{omschrijving:%s,documentNaam:'Projectplan Hulp Na Onderzoek.pdf'},error:null}; };"%(D2,json.dumps(VOORSTEL))
    ctx,pg=nieuw(b,{'width':1280,'height':1100},'pro',f'/kompas/projecten/{P4}?tab=documenten',init)
    kn=pg.locator('[data-testid="projectgegevens-aanvullen-knop"]')
    ok('document: actie "Projectgegevens aanvullen" per document', kn.count()==2 and 'Projectgegevens aanvullen' in kn.first.inner_text())
    pg.screenshot(path='shots/formulier_7_document_actie.png', full_page=True)
    d1=pg.locator(f'[data-testid="projectgegevens-aanvullen"][data-document-id="{D1}"]')
    d1.locator('[data-testid="projectgegevens-aanvullen-knop"]').click(); pg.wait_for_timeout(700)
    ok('voorstel: titel "Voorstel projectomschrijving" met tekst', 'voorstel projectomschrijving' in txt(pg).lower() and VOORSTEL in txt(pg))
    ok('voorstel: acties Opslaan bij project / Aanpassen / Annuleren', all(d1.get_by_role('button',name=x).count()>=1 for x in ['Opslaan bij project','Aanpassen','Annuleren']))
    ok('voorstel: project is nog NIET gewijzigd', not prog(pg,P4).get('description'))
    log=pg.evaluate("window.__LOG.filter(l=>l.tabel==='functions:subsidie-kompas').map(l=>l.filters[0])")
    ok('aanroep stuurt alleen mode + projectId + documentId (geen documenttekst vanuit de browser)', len(log)==1 and json.loads(log[0])=={'mode':'project-omschrijving','projectId':P4,'documentId':D1}, str(log))
    pg.screenshot(path='shots/formulier_8_voorstel.png', full_page=True)
    d1.get_by_role('button',name='Annuleren').click(); pg.wait_for_timeout(300)
    ok('annuleren: niets opgeslagen', not prog(pg,P4).get('description') and d1.locator('[data-testid="projectgegevens-voorstel"]').count()==0)
    d1.locator('[data-testid="projectgegevens-aanvullen-knop"]').click(); pg.wait_for_timeout(500)
    d1.get_by_role('button',name='Aanpassen').click(); pg.wait_for_timeout(200)
    ta=d1.locator('textarea'); ta.fill(VOORSTEL+' (aangepast)')
    ok('aanpassen: nog niets opgeslagen tijdens bewerken', not prog(pg,P4).get('description'))
    d1.get_by_role('button',name='Opslaan bij project').click(); pg.wait_for_timeout(1000)
    r4=prog(pg,P4)
    ok('opslaan: omschrijving pas na bevestiging bewaard (aangepaste tekst)', r4.get('description')==VOORSTEL+' (aangepast)', str(r4.get('description')))
    ok('opslaan: herkomst "uit een document" en andere velden onveranderd', (r4.get('field_sources') or {}).get('omschrijving')=='upload' and r4.get('budget_total')==420000 and r4.get('goals')=='40 gasten.', str(r4.get('field_sources')))
    ok('opslaan: succesmelding', pg.locator('[data-testid="projectgegevens-opgeslagen"]').count()==1)
    # bestaande omschrijving: niet stil overschrijven
    d1.get_by_role('button',name='Sluiten').click()
    d1.locator('[data-testid="projectgegevens-aanvullen-knop"]').click(); pg.wait_for_timeout(500)
    ok('bestaande omschrijving: huidige tekst zichtbaar naast het voorstel met waarschuwing', d1.locator('[data-testid="projectgegevens-bestaand"]').count()==1 and 'vervangt' in d1.locator('[data-testid="projectgegevens-bestaand"]').inner_text() and 'Opslaan bij project (vervangt huidige)' in d1.inner_text())
    d1.get_by_role('button',name='Annuleren').click(); pg.wait_for_timeout(200)
    ok('bestaande omschrijving blijft staan na annuleren', prog(pg,P4).get('description')==VOORSTEL+' (aangepast)')
    # leeg document
    d2=pg.locator(f'[data-testid="projectgegevens-aanvullen"][data-document-id="{D2}"]')
    d2.locator('[data-testid="projectgegevens-aanvullen-knop"]').click(); pg.wait_for_timeout(600)
    ok('leeg document: vriendelijke melding, niets gewijzigd', 'geen tekst gevonden' in d2.inner_text() and prog(pg,P4).get('description')==VOORSTEL+' (aangepast)')
    ok('geen paginafouten (documentvoorstel)', not pg.errs, str(pg.errs)); ctx.close()
    # onleesbaar / fout
    init2="window.__FN=async function(){ return {data:null,error:{message:'boom'}}; };"
    ctx,pg=nieuw(b,{'width':1280,'height':1000},'pro',f'/kompas/projecten/{P4}?tab=documenten',init2)
    d1=pg.locator(f'[data-testid="projectgegevens-aanvullen"][data-document-id="{D1}"]')
    d1.locator('[data-testid="projectgegevens-aanvullen-knop"]').click(); pg.wait_for_timeout(700)
    ok('fout bij analyseren: vriendelijke melding, geen crash, niets gewijzigd', 'kon niet worden geanalyseerd' in d1.inner_text() and not pg.errs and not prog(pg,P4).get('description'))
    ctx.close()
    # AI zonder bruikbare info
    init3="window.__FN=async function(){ return {data:{omschrijving:null,reden:'te-weinig-informatie'},error:null}; };"
    ctx,pg=nieuw(b,{'width':1280,'height':1000},'pro',f'/kompas/projecten/{P4}?tab=documenten',init3)
    d1=pg.locator(f'[data-testid="projectgegevens-aanvullen"][data-document-id="{D1}"]')
    d1.locator('[data-testid="projectgegevens-aanvullen-knop"]').click(); pg.wait_for_timeout(700)
    ok('te weinig informatie: melding zonder voorstel (AI verzint niets)', 'te weinig informatie' in d1.inner_text() and d1.locator('[data-testid="projectgegevens-voorstel"]').count()==0)
    ctx.close()
    # ================= 7. Isolatie en Free
    ctx,pg=nieuw(b,{'width':1280,'height':900},'pro',f'/kompas/projecten/{PX}')
    ok('ander lid: project van een ander niet bereikbaar', pg.locator('[data-testid="project-niet-gevonden"]').count()==1 and 'GEHEIM' not in txt(pg))
    ctx.close()
    ctx,pg=nieuw(b,{'width':1280,'height':900},'free','/kompas/projecten')
    ok('Free: geen projectformulier en geen financiering', pg.locator('[data-testid="nieuw-project-formulier"]').count()==0 and pg.get_by_role('button',name='+ Nieuw project').count()==0)
    ctx.close()
    b.close()
srv.terminate()
f=[r for r in res if not r[1]]
print(f'\n{len(res)-len(f)}/{len(res)} geslaagd'); 
sys.exit(1 if f else 0)
