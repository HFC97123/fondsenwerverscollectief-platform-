# Actieplan per project: opgeslagen taken (subsidie_kompas_program_actions) onder het project en op Deadlines, plus de afgeleide
# aanbevelingen. Draait de echte app tegen de nagebootste Supabase.
import subprocess, time, sys, os, re, json, datetime
from playwright.sync_api import sync_playwright
os.chdir(os.path.dirname(os.path.abspath(__file__)))
PORT=8787
srv = subprocess.Popen(['python3','-m','http.server',str(PORT),'-d','web'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1)
BASE=f'http://localhost:{PORT}/index.html'
P1='11111111-1111-4111-8111-111111111111'; P2='22222222-2222-4222-8222-222222222222'; P3='33333333-3333-4333-8333-333333333333'; PX='99999999-9999-4999-8999-999999999999'
A1='ac000000-0000-4000-8000-000000000001'; A2='ac000000-0000-4000-8000-000000000002'; A3='ac000000-0000-4000-8000-000000000003'; AX='ac000000-0000-4000-8000-0000000000ff'
res=[]
def ok(n,c,d=''):
    res.append((n,bool(c),d)); print(('OK  ' if c else 'FAIL'),n,(d if not c else ''), flush=True)
os.makedirs('shots',exist_ok=True)
def iso(n): return (datetime.date.today()+datetime.timedelta(days=n)).isoformat()
def seed(tabel=True):
    if not tabel: return "window.__SEED_PATCH=function(seed,h){};"
    return """
window.__SEED_PATCH=function(seed,h){
 var T=seed.tables;
 T.subsidie_kompas_program_actions=[
  {id:'%s',user_id:'u1',program_id:h.P1,funding_id:null,title:'Begroting controleren',financier_label:null,due_date:'%s',status:'todo',priority:'high',notes:'Check de posten',source:'chat',proposed_at:'2026-10-10T10:00:00Z',created_at:'2026-10-10T10:00:00Z'},
  {id:'%s',user_id:'u1',program_id:h.P1,funding_id:null,title:'Bijlagen verzamelen',financier_label:'Wijkfonds Noord',due_date:'%s',status:'done',priority:'normal',notes:null,source:'user',proposed_at:null,created_at:'2026-10-09T10:00:00Z'},
  {id:'%s',user_id:'u1',program_id:h.P2,funding_id:null,title:'Taalcafe: eerste financier zoeken',financier_label:null,due_date:null,status:'todo',priority:'low',notes:null,source:'user',proposed_at:null,created_at:'2026-10-09T11:00:00Z'},
  {id:'%s',user_id:'u2',program_id:h.PX,funding_id:null,title:'GEHEIM taak van ander',financier_label:null,due_date:null,status:'todo',priority:'high',notes:'MAG NIET',source:'user',proposed_at:null,created_at:'2026-10-09T12:00:00Z'}];
};
""" % (A1, iso(-3), A2, iso(-1), A3, AX)
def nieuw(b,vp,tier,pad,tabel=True):
    ctx=b.new_context(viewport=vp); pg=ctx.new_page()
    pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='div[style*=\"z-index: 2000\"]{display:none !important}';document.head.appendChild(s)})")
    pg.add_init_script(seed(tabel))
    pg.errs=[]; pg.on('pageerror',lambda e: pg.errs.append(str(e)))
    pg.goto(f'{BASE}?tier={tier}#{pad}'); pg.wait_for_timeout(1700)
    return ctx,pg
def txt(pg): return pg.locator('body').inner_text().replace('\xa0',' ')
def geenhscroll(pg): return pg.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1')
def tab(pg): return pg.get_by_test_id('pf-acties')
def rijen(pg,t=None): return pg.evaluate('window.__DBL.subsidie_kompas_program_actions')
def rij(pg,i): return next((r for r in rijen(pg) if r['id']==i),None)
def seg(pg): return pg.get_by_role('tab',name='Actieplan',exact=True)
def taak(pg,titel): return pg.locator('[data-testid="ap-taak"]').filter(has_text=titel)
DESK={'width':1280,'height':1100}; MOB={'width':390,'height':844}
PAD=f'/kompas/projecten/{P1}?tab=deadlines'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
    ctx,pg=nieuw(b,DESK,'pro',PAD)
    ap=pg.locator('[data-testid="actieplan"]')
    ok('A1 in het project (tab Deadlines en acties) staat het blok Acties & deadlines', ap.count()==1 and ap.get_attribute('data-project-id')==P1 and 'acties & deadlines' in ap.inner_text().lower())
    ok('A2 opgeslagen taak "Begroting controleren" staat onder Te laat (deadline 3 dagen geleden), met hoge prioriteit en herkomst Subsidie Kompas', pg.locator('[data-testid="ap-groep-te-laat"]').count()==1 and taak(pg,'Begroting controleren').count()==1 and 'Hoog' in taak(pg,'Begroting controleren').inner_text() and 'voorgesteld door Subsidie Kompas' in taak(pg,'Begroting controleren').inner_text())
    def open_n(pg): return pg.locator('[data-testid="ap-taak"]:not([data-status="done"])').count()+pg.locator('[data-testid="ap-afgeleid-actie"]').count()
    ok('A3 afgeronde taak onder Afgerond; teller telt alle open items (opgeslagen taken en afgeleide acties), geen afgeronde', pg.locator('[data-testid="ap-groep-klaar"] [data-testid="ap-taak"]').count()==1 and f'({open_n(pg)} open)' in pg.get_by_test_id('ap-teller').inner_text().lower() and pg.locator('[data-testid="ap-taak"]:not([data-status="done"])').count()==1, pg.get_by_test_id('ap-teller').inner_text())
    ok('A4 taken van een ander project of een andere gebruiker zijn niet zichtbaar', 'GEHEIM' not in txt(pg) and 'Taalcafe: eerste financier' not in ap.inner_text())
    ok('A5 afgeleide acties staan in dezelfde lijst, herkenbaar als "Afgeleid uit dekkingsplan" (niet opgeslagen); opgeslagen taken als "Opgeslagen taak"', pg.get_by_test_id('ap-afgeleid').count()==0 and pg.locator('[data-testid="ap-afgeleid-actie"][data-soort="afgeleid"]').count()>=1 and pg.locator('[data-testid="ap-afgeleid-actie"]').first.get_by_test_id('ap-soort').inner_text()=='Afgeleid uit dekkingsplan' and pg.locator('[data-testid="ap-taak"]').first.get_by_test_id('ap-soort').inner_text()=='Opgeslagen taak' and len(rijen(pg))==4)
    pg.screenshot(path='shots/ap_1_project.png', full_page=True)
    # toevoegen
    pg.get_by_test_id('ap-toevoegen-open').click()
    pg.get_by_test_id('ap-opslaan').click(); pg.wait_for_timeout(200)
    ok('B1 lege actie wordt geweigerd met een Nederlandse melding; niets opgeslagen', 'Vul in wat er moet gebeuren' in pg.get_by_test_id('ap-fout').inner_text() and len(rijen(pg))==4)
    pg.get_by_test_id('ap-titel').fill('Vooroverleg plannen'); pg.get_by_test_id('ap-financier').fill('Gemeente Utrecht'); pg.get_by_test_id('ap-deadline').fill(iso(5)); pg.get_by_test_id('ap-prioriteit').select_option('high'); pg.get_by_test_id('ap-notitie').fill('Bel de contactpersoon')
    pg.get_by_test_id('ap-opslaan').click(); pg.wait_for_timeout(500)
    nieuw_rij=[r for r in rijen(pg) if r['title']=='Vooroverleg plannen']
    ok('B2 opslaan: rij in de database met juiste gebruiker, project, status todo, prioriteit, deadline, herkomst user', len(nieuw_rij)==1 and nieuw_rij[0]['user_id']=='u1' and nieuw_rij[0]['program_id']==P1 and nieuw_rij[0]['status']=='todo' and nieuw_rij[0]['priority']=='high' and nieuw_rij[0]['due_date']==iso(5) and nieuw_rij[0]['source']=='user' and nieuw_rij[0]['financier_label']=='Gemeente Utrecht' and nieuw_rij[0]['notes']=='Bel de contactpersoon', str(nieuw_rij))
    ok('B3 de taak staat direct onder Deze week; formulier is dicht; teller 2 open', taak(pg,'Vooroverleg plannen').count()==1 and pg.locator('[data-testid="ap-groep-week"] [data-testid="ap-taak"]').count()==1 and pg.get_by_test_id('ap-form').count()==0 and f'({open_n(pg)} open)' in pg.get_by_test_id('ap-teller').inner_text().lower() and pg.locator('[data-testid="ap-taak"]:not([data-status="done"])').count()==2)
    pg.get_by_test_id('ap-toevoegen-open').click(); pg.get_by_test_id('ap-titel').fill('X'); pg.get_by_test_id('ap-deadline').evaluate("e=>{e.value='';}")
    pg.get_by_test_id('ap-titel').fill('Y'*201); 
    ok('B4 titel is begrensd op 200 tekens (invoerveld)', len(pg.get_by_test_id('ap-titel').input_value())<=200)
    pg.get_by_test_id('ap-annuleer').click(); pg.wait_for_timeout(100)
    # klaar, heropenen, status
    t=taak(pg,'Vooroverleg plannen')
    t.get_by_test_id('ap-klaar').check(); pg.wait_for_timeout(400)
    r=[r for r in rijen(pg) if r['title']=='Vooroverleg plannen'][0]
    ok('C1 afvinken zet status done en de taak verhuist naar Afgerond', r['status']=='done' and pg.locator('[data-testid="ap-groep-klaar"] [data-testid="ap-taak"]').filter(has_text='Vooroverleg plannen').count()==1)
    taak(pg,'Vooroverleg plannen').get_by_test_id('ap-klaar').uncheck(); pg.wait_for_timeout(400)
    ok('C2 weer openen zet status todo', [r for r in rijen(pg) if r['title']=='Vooroverleg plannen'][0]['status']=='todo' and pg.locator('[data-testid="ap-groep-week"] [data-testid="ap-taak"]').filter(has_text='Vooroverleg plannen').count()==1)
    taak(pg,'Vooroverleg plannen').get_by_test_id('ap-status').select_option('doing'); pg.wait_for_timeout(400)
    ok('C3 status Bezig via de keuzelijst', [r for r in rijen(pg) if r['title']=='Vooroverleg plannen'][0]['status']=='doing')
    # bewerken
    taak(pg,'Vooroverleg plannen').get_by_test_id('ap-bewerk').click()
    pg.get_by_test_id('ap-titel').fill('Vooroverleg met Gemeente Utrecht'); pg.get_by_test_id('ap-deadline').fill(iso(45)); pg.get_by_test_id('ap-opslaan').click(); pg.wait_for_timeout(500)
    r=[r for r in rijen(pg) if r['title']=='Vooroverleg met Gemeente Utrecht']
    ok('C4 bewerken: titel en deadline gewijzigd; taak verhuist naar Later; status blijft Bezig', len(r)==1 and r[0]['due_date']==iso(45) and r[0]['status']=='doing' and pg.locator('[data-testid="ap-groep-later"] [data-testid="ap-taak"]').filter(has_text='Vooroverleg met Gemeente Utrecht').count()==1)
    # verwijderen
    taak(pg,'Vooroverleg met Gemeente Utrecht').get_by_test_id('ap-verwijder').click()
    ok('C5 verwijderen vraagt eerst bevestiging; nog niet verwijderd', taak(pg,'Vooroverleg met Gemeente Utrecht').get_by_test_id('ap-verwijder-ja').count()==1 and len(rijen(pg))==5)
    taak(pg,'Vooroverleg met Gemeente Utrecht').get_by_test_id('ap-verwijder-ja').click(); pg.wait_for_timeout(400)
    ok('C6 bevestigd: rij verwijderd uit de database en uit het scherm', len(rijen(pg))==4 and taak(pg,'Vooroverleg met Gemeente Utrecht').count()==0)
    # afgeleid -> taak
    n0=pg.locator('[data-testid="ap-afgeleid-actie"]').count()
    eerste=pg.locator('[data-testid="ap-afgeleid-actie"]').first; tekst=eerste.locator('div').first.inner_text().split('\n')[0]
    eerste.get_by_test_id('ap-maak-taak').click(); pg.wait_for_timeout(500)
    nr=[r for r in rijen(pg) if r['title']==tekst]
    ok('D1 "Maak er een taak van": nieuwe opgeslagen taak met dezelfde titel, project en (indien van toepassing) financieringsregel', len(nr)==1 and nr[0]['program_id']==P1 and nr[0]['source']=='user' and nr[0]['status']=='todo', str((tekst,nr)))
    fid=nr[0]['funding_id'] if nr else None
    ok('D1b een taak met een financieringsregel bewaart alleen funding_id, geen kopie van de naam (geen fondsnaam in de taak na een downgrade)', (fid is None) or (nr[0]['financier_label'] is None and fid in [r['id'] for r in pg.evaluate("window.__DBL.subsidie_kompas_program_funding")]), str(nr))
    ok('D2 de afgeleide aanbeveling verdwijnt zodra er een openstaande taak voor is (geen dubbele)', pg.locator('[data-testid="ap-afgeleid-actie"]').count()==n0-1 and taak(pg,tekst).count()>=1, f'{n0}->{pg.locator("[data-testid=ap-afgeleid-actie]").count()}')
    ok('D3 het dekkingsplan zelf is niet aangeraakt (geen enkele fundingregel gewijzigd of toegevoegd)', pg.evaluate("window.__DBL.subsidie_kompas_program_funding.length")==10)
    ok('E0 geen pageerrors in het project', not pg.errs, str(pg.errs)); ctx.close()

    # Deadlines: tab Actieplan
    ctx,pg=nieuw(b,DESK,'pro','/kompas/deadlines')
    seg(pg).click()
    pg.wait_for_timeout(1000)
    ov=pg.get_by_test_id('actieplan-overzicht')
    ok('F1 Deadlines heeft een tab Actieplan (naast Mijn deadlines en Alle regelingen)', ov.count()==1 and 'Mijn deadlines' in txt(pg) and 'Alle regelingen' in txt(pg))
    namen=pg.get_by_test_id('ap-project-naam').all_inner_texts()
    ok('F2 per actief project een blok; gearchiveerd en andermans project ontbreken; geen taken van anderen', 'Buurtkeuken De Brug' in namen and 'Taalcafe Zuid' in namen and 'Oud Gearchiveerd Project' not in namen and 'GEHEIM Ander Project' not in namen and 'GEHEIM' not in txt(pg), str(namen))
    blok2=pg.locator('[data-testid="ap-project"]').filter(has_text='Taalcafe Zuid')
    ok('F3 taak van Taalcafe staat bij Taalcafe (Zonder deadline); taak van Buurtkeuken bij Buurtkeuken', blok2.locator('[data-testid="ap-groep-zonder"]').count()==1 and 'Taalcafe: eerste financier zoeken' in blok2.inner_text() and 'Begroting controleren' not in blok2.inner_text())
    blok2.get_by_test_id('ap-toevoegen-open').click(); blok2.get_by_test_id('ap-titel').fill('Begroting Taalcafe afronden'); blok2.get_by_test_id('ap-opslaan').click(); pg.wait_for_timeout(500)
    nr=[r for r in rijen(pg) if r['title']=='Begroting Taalcafe afronden']
    ok('F4 toevoegen vanuit Deadlines: rij hoort bij het juiste project', len(nr)==1 and nr[0]['program_id']==P2 and nr[0]['user_id']=='u1')
    ok('F5 link naar projectfinanciering per project', pg.locator('[data-testid="ap-project"] a:has-text("Open projectfinanciering")').count()==2)
    pg.screenshot(path='shots/ap_2_deadlines.png', full_page=True)
    ok('F6 geen horizontale overflow (desktop) en geen pageerrors', geenhscroll(pg) and not pg.errs, str(pg.errs)); ctx.close()

    # mobiel
    ctx,pg=nieuw(b,MOB,'pro',PAD)
    ok('G1 mobiel: actieplan onder het project past (geen horizontale scroll)', pg.get_by_test_id('actieplan').count()==1 and geenhscroll(pg))
    pg.get_by_test_id('ap-toevoegen-open').click(); pg.wait_for_timeout(200)
    ok('G2 mobiel: formulier past', pg.get_by_test_id('ap-form').is_visible() and geenhscroll(pg))
    pg.screenshot(path='shots/ap_3_mobiel.png', full_page=True); ctx.close()

    # migratie nog niet toegepast
    ctx,pg=nieuw(b,DESK,'pro',PAD,tabel=False)
    ok('H1 zonder tabel: nette melding, geen "+ Actie toevoegen", geen pageerrors, afgeleide aanbevelingen werken, rest van de tab werkt', pg.get_by_test_id('ap-niet-beschikbaar').count()==1 and pg.get_by_test_id('ap-toevoegen-open').count()==0 and pg.locator('[data-testid="ap-afgeleid-actie"]').count()>=1 and pg.get_by_test_id('ap-maak-taak').count()==0 and tab(pg).count()==1 and not pg.errs, str(pg.errs))
    ctx.close()
    ctx,pg=nieuw(b,DESK,'pro','/kompas/deadlines',tabel=False)
    seg(pg).click(); pg.wait_for_timeout(900)
    ok('H2 zonder tabel op Deadlines: melding, geen crash', pg.get_by_test_id('ap-niet-beschikbaar').count()>=1 and not pg.errs, str(pg.errs)); ctx.close()

    # Free
    ctx,pg=nieuw(b,DESK,'free','/kompas/deadlines')
    ok('I1 Free: geen tab Actieplan en geen actieplan-blok', seg(pg).count()==0 and pg.get_by_test_id('actieplan-overzicht').count()==0 and not pg.errs, str(pg.errs)); ctx.close()
    b.close()
srv.terminate()
f=[r for r in res if not r[1]]
print(f'\n{len(res)-len(f)}/{len(res)} OK')
for n,c,d in f: print('FAIL',n,d)
sys.exit(1 if f else 0)
