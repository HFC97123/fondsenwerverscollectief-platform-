# Fase 2 Voorstel Dekkingsplan en actieplan: tab Projectfinanciering / Dekkingsplan met startknop van Subsidiekompas
# (zichtbaar, uitgeschakeld zolang de flow niet werkt), Gepland/Nog te plannen en de samengevoegde Acties & deadlines.
import subprocess, time, sys, os, datetime
from playwright.sync_api import sync_playwright
os.chdir(os.path.dirname(os.path.abspath(__file__)))
PORT=8788
srv = subprocess.Popen(['python3','-m','http.server',str(PORT),'-d','web'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1)
BASE=f'http://localhost:{PORT}/index.html'
P1='11111111-1111-4111-8111-111111111111'; P2='22222222-2222-4222-8222-222222222222'
F6='f0000000-0000-4000-8000-000000000006'; F8='f0000000-0000-4000-8000-000000000008'; F3='f0000000-0000-4000-8000-000000000003'
res=[]
def ok(n,c,d=''):
    res.append((n,bool(c),d)); print(('OK  ' if c else 'FAIL'),n,(d if not c else ''), flush=True)
def iso(n): return (datetime.date.today()+datetime.timedelta(days=n)).isoformat()
SEED="""
window.__SEED_PATCH=function(seed,h){
 var T=seed.tables;
 T.subsidie_kompas_program_actions=[
  {id:'ac000000-0000-4000-8000-000000000011',user_id:'u1',program_id:h.P1,funding_id:'%s',title:'Aanvraag indienen',financier_label:null,due_date:null,status:'todo',priority:'high',notes:null,source:'chat',proposed_at:'2026-10-10T10:00:00Z',voorstel_sleutel:'a:r:x:indienen',bron_deadline_bij_voorstel:'2026-11-01',created_at:'2026-10-10T10:00:00Z',updated_at:'2026-10-10T10:00:00Z'},
  {id:'ac000000-0000-4000-8000-000000000012',user_id:'u1',program_id:h.P1,funding_id:'%s',title:'Stukken verzamelen',financier_label:null,due_date:'%s',status:'todo',priority:'normal',notes:null,source:'chat',proposed_at:'2026-10-10T10:00:00Z',voorstel_sleutel:'a:r:y:stukken',bron_deadline_bij_voorstel:'2026-11-01',created_at:'2026-10-10T10:00:00Z',updated_at:'2026-10-12T10:00:00Z'}
 ];
};
""" % (F6, F8, iso(5))
DESK={'width':1280,'height':1100}; MOB={'width':390,'height':844}
def nieuw(b,vp,tier,pad,seed=True):
    ctx=b.new_context(viewport=vp); pg=ctx.new_page()
    pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='div[style*=\"z-index: 2000\"]{display:none !important}';document.head.appendChild(s)})")
    pg.add_init_script(SEED if seed else "window.__SEED_PATCH=function(seed,h){};")
    pg.errs=[]; pg.on('pageerror',lambda e: pg.errs.append(str(e)))
    pg.goto(f'{BASE}?tier={tier}#{pad}'); pg.wait_for_timeout(1700)
    return ctx,pg
def geenhscroll(pg): return pg.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1')
def rijen(pg): return pg.evaluate('window.__DBL.subsidie_kompas_program_actions')
def taak(pg,titel): return pg.locator('[data-testid="ap-taak"]').filter(has_text=titel)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
    ctx,pg=nieuw(b,DESK,'pro',f'/kompas/projecten/{P1}?tab=projectfinanciering')
    tabs=pg.get_by_role('tab').all_inner_texts()
    ok('1 tab heet "Fondsen en dekkingsplan" en de deeplink (?tab=projectfinanciering) werkt', any(t.startswith('Fondsen en dekkingsplan') for t in tabs) and pg.get_by_test_id('tab-projectfinanciering').count()==1, str(tabs))
    knop=pg.get_by_test_id('voorstel-start-knop')
    ok('2 startknop "Maak dekkingsplan en actieplan met Subsidie Kompas" is zichtbaar bij een project met financiering', knop.is_visible() and knop.inner_text()=='Maak dekkingsplan en actieplan met Subsidie Kompas')
    ok('3 knop is uitgeschakeld zolang de flow niet werkt, met duidelijke melding (niet stilletjes dood)', knop.is_disabled() and knop.get_attribute('aria-disabled')=='true' and 'nog niet beschikbaar' in pg.get_by_test_id('voorstel-nog-niet').inner_text().lower())
    ok('4 geen uitleg van de stappen: het systeem doet het gewoon', pg.get_by_test_id('voorstel-stappen').count()==0)
    k=pg.get_by_test_id('pf-kpi').all_inner_texts()
    ok('5 KPI\'s: begroting, toegekend, aangevraagd, gepland, eigen bijdrage, nog te financieren', [x.split('\n')[0] for x in k]==['Totale begroting','Toegekend','Aangevraagd','Gepland','Eigen bijdrage','Nog te financieren'] and '€ 18.000' in k[3], str(k))
    ok('6 "Waarvan nog niet gepland" = begroting - eigen - toegekend - aangevraagd - gepland (€ 17.000)', '17.000' in pg.get_by_test_id('pf-nog-te-plannen').inner_text() and '35.000' in pg.get_by_test_id('pf-samenvatting').inner_text())
    ok('7 bestaande financiering werkt: 8 regels; Acties & deadlines staan op het tabblad Deadlines en acties', pg.get_by_test_id('pf-regel').count()==8 and pg.get_by_test_id('tab-btn-deadlines').count()==1)
    ok('8 doel en uitvoeringsgebied bekend: geen vraag om aan te vullen', pg.get_by_test_id('voorstel-project-controle').count()==0)
    # Acties & deadlines: één lijst
    f6=pg.locator(f'[data-regel-id="{F6}"]').get_by_test_id('pf-regel-naam').inner_text()
    f8=pg.locator(f'[data-regel-id="{F8}"]').get_by_test_id('pf-regel-naam').inner_text()
    f3=pg.locator(f'[data-regel-id="{F3}"]').get_by_test_id('pf-regel-naam').inner_text()
    pg.get_by_test_id('tab-btn-deadlines').click(); pg.wait_for_timeout(700)
    t1=taak(pg,'Aanvraag indienen').inner_text()
    ok('9 taak zonder eigen datum erft de deadline van het fonds (13 nov 2026), herkenbaar als opgeslagen taak', '13 nov 2026' in t1 and 'Deadline van het fonds' in t1 and 'Opgeslagen taak' in t1, t1)
    ok('10 geen dubbele verplichting: voor een regel met een openstaande taak staat geen afgeleide actie', pg.locator('[data-testid="ap-afgeleid-actie"]').filter(has_text=f6).count()==0 and pg.locator('[data-testid="ap-afgeleid-actie"]').filter(has_text=f8).count()==0)
    ok('11 fondsdeadline zonder opgeslagen taak blijft zichtbaar als afgeleide actie (geen kunstmatige taak)', pg.locator('[data-testid="ap-afgeleid-actie"]').count()>=1 and len(rijen(pg))==2)
    t2=taak(pg,'Stukken verzamelen').inner_text()
    ok('12 eigen streefdatum en fondsdeadline blijven allebei herkenbaar', 'Streefdatum' in t2 and 'Fondsdeadline 23 nov 2026' in t2, t2)
    ok('13 gewijzigde fondsdeadline zichtbaar, streefdatum niet overschreven', 'gewijzigd: was 1 nov 2026, nu 23 nov 2026' in t2 and 'streefdatum is niet aangepast' in t2 and rijen(pg)[1]['due_date']==iso(5), t2)
    ok('14 taak zonder streefdatum meldt dat hij de nieuwe fondsdeadline volgt (was 1 nov, nu 13 nov)', 'was 1 nov 2026, nu 13 nov 2026' in t1 and 'volgt de nieuwe deadline' in t1, t1)
    ok('15 voorgestelde taak die het lid heeft aangepast is zo gemarkeerd', 'door u aangepast' in t2 and 'door u aangepast' not in t1, t2)
    # afgeleid -> taak erft de fondsdeadline
    n=len(rijen(pg))
    af=pg.locator('[data-testid="ap-afgeleid-actie"]').filter(has_text=f3)
    heeft=af.count()
    if heeft: af.first.get_by_test_id('ap-maak-taak').click(); pg.wait_for_timeout(500)
    nr=[r for r in rijen(pg)][n:]
    ok('16 "Maak er een taak van" bij een actie met een regel: taak hangt aan de regel en erft de fondsdeadline (geen kopie van de datum als streefdatum)', heeft==1 and len(nr)==1 and nr[0]['funding_id']==F3 and nr[0]['due_date'] is None and nr[0]['financier_label'] is None, str((heeft,nr)))
    ok('16b daarna staat voor die regel geen afgeleide actie meer (zelfde verplichting maar één keer)', pg.locator('[data-testid="ap-afgeleid-actie"]').filter(has_text=f3).count()==0 and taak(pg,'Aanvraag afronden').count()==1)
    ok('17 geen pageerrors; geen horizontale overflow (desktop)', not pg.errs and geenhscroll(pg), str(pg.errs)); ctx.close()
    # leeg dekkingsplan
    ctx,pg=nieuw(b,DESK,'pro',f'/kompas/projecten/{P2}?tab=projectfinanciering')
    ok('18 bij een leeg dekkingsplan is de startknop er ook', pg.get_by_test_id('pf-leeg').count()==1 and pg.get_by_test_id('voorstel-start-knop').is_visible() and pg.get_by_test_id('voorstel-start-knop').is_disabled())
    ok('19 geen pageerrors bij leeg dekkingsplan', not pg.errs, str(pg.errs)); pg.screenshot(path='shots/vs_leeg.png', full_page=True); ctx.close()
    # mobiel
    ctx,pg=nieuw(b,MOB,'pro',f'/kompas/projecten/{P1}?tab=projectfinanciering')
    ok('20 mobiel: knop, melding en acties passen (geen horizontale scroll)', pg.get_by_test_id('voorstel-start-knop').is_visible() and geenhscroll(pg) and not pg.errs, str(pg.errs)); pg.screenshot(path='shots/vs_mobiel.png', full_page=True); ctx.close()
    # migratie nog niet live (kolommen ontbreken): oude rijen zonder voorstelvelden blijven werken
    ctx,pg=nieuw(b,DESK,'pro',f'/kompas/projecten/{P1}?tab=projectfinanciering',seed=False)
    ok('21 zonder takentabel: startknop en dekkingsplan werken, geen pageerrors', pg.get_by_test_id('voorstel-start-knop').count()==1 and pg.get_by_test_id('pf-regel').count()==8 and not pg.errs, str(pg.errs)); ctx.close()
    # Free
    ctx,pg=nieuw(b,DESK,'free',f'/kompas/projecten/{P1}?tab=projectfinanciering')
    ok('22 Free: geen pageerrors op de projectpagina', not pg.errs, str(pg.errs)); ctx.close()
    b.close()
srv.terminate()
n=sum(1 for r in res if r[1]); print(f'\n{n}/{len(res)} OK'); sys.exit(0 if n==len(res) else 1)
