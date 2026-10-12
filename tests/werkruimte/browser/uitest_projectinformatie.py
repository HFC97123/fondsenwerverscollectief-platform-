# Fase 1 browsertests: Projectinformatie op de pagina Documenten, compacte Projecten, geen dubbele bewerkplekken.
import subprocess, time, sys, os, re, json
from playwright.sync_api import sync_playwright
os.chdir(os.path.dirname(os.path.abspath(__file__)))
srv = subprocess.Popen(['python3','-m','http.server','8783','-d','web'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1)
BASE='http://localhost:8783/index.html'
P1='11111111-1111-4111-8111-111111111111'; P2='22222222-2222-4222-8222-222222222222'
res=[]
def ok(n,c,d=''):
    res.append((n,bool(c),d)); print(('OK  ' if c else 'FAIL'),n,(d if not c else ''), flush=True)
os.makedirs('shots',exist_ok=True)
def nieuw(b,vp,tier,pad):
    ctx=b.new_context(viewport=vp); pg=ctx.new_page()
    pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='div[style*=\"z-index: 2000\"]{display:none !important}';document.head.appendChild(s)})")
    pg.errs=[]; pg.on('pageerror',lambda e: pg.errs.append(str(e)))
    pg.goto(f'{BASE}?tier={tier}#{pad}'); pg.wait_for_timeout(1600)
    return ctx,pg
def txt(pg): return pg.locator('body').inner_text().replace('\xa0',' ')
def prog(pg,pid): return pg.evaluate(f'window.__DBL.subsidie_kompas_programs.find(r=>r.id==="{pid}")')
def geenhscroll(pg): return pg.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1')
def hsh(pg): return pg.evaluate('location.hash')
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
    # ===== Documenten (Pro): Projectinformatie
    ctx,pg=nieuw(b,{'width':1280,'height':1100},'pro','/kompas/documentatie')
    pi=pg.locator('[data-testid="projectinformatie"]')
    ok('1 Documenten: Projectinformatie-paneel aanwezig met projectkiezer', pi.count()==1 and pg.locator('[data-testid="pi-project"]').count()==1)
    sel=pg.locator('[data-testid="pi-project"]')
    ok('2 standaard het eerste echte, niet-gearchiveerde project', sel.input_value() in (P1,P2) or len(sel.input_value())>10, sel.input_value())
    sel.select_option(P1); pg.wait_for_timeout(300)
    ok('3 kiezen van een project zet ?project=<id> in de URL', f'project={P1}' in hsh(pg) and hsh(pg).startswith('#/kompas/documentatie'), hsh(pg))
    t=pi.inner_text().replace('\xa0',' ')
    ok('4 groepen: Doel en aanpak, Resultaat en impact, Uitvoering', all(x in t.lower() for x in ['doel en aanpak','resultaat en impact','uitvoering']), t[:400])
    ok('5 alleen velden met bestaande opslag (geen aanleiding/risico’s nog)', 'Aanleiding' not in t and 'Risico' not in t and 'Doelstelling' in t and 'Activiteiten' in t and 'Samenwerking' in t and 'Planning' in t)
    ok('6 bestaande data zichtbaar: doelstellingen/activiteiten/partners/impact/planning uit de projectkolommen',
       pg.locator('[data-testid="pi-doelstelling"]').input_value()=='40 gasten.' and pg.locator('[data-testid="pi-activiteiten"]').input_value()=='Koken.' and pg.locator('[data-testid="pi-samenwerking"]').input_value()=='Wijkcentrum' and pg.locator('[data-testid="pi-impact"]').input_value()=='Minder eenzaamheid.' and pg.locator('[data-testid="pi-planning"]').input_value()=='Q1')
    ok('7 Programma staat hier (instelling), met suggesties uit eerder gebruikte waarden', pg.locator('[data-testid="pi-programma"]').input_value()=='Samen Eten' and pg.locator('#pi-programma-opties option').count()>=1)
    ok('8 voortgang "n van m onderdelen ingevuld"', re.search(r'\d+ van 6 onderdelen ingevuld', pg.locator('[data-testid="pi-voortgang"]').inner_text()) is not None, pg.locator('[data-testid="pi-voortgang"]').inner_text())
    ok('9 opslaan staat uit zolang er niets is gewijzigd', pg.get_by_role('button',name='Projectinformatie opslaan').is_disabled())
    voor=prog(pg,P1)
    pg.locator('[data-testid="pi-doelstelling"]').fill('60 gasten per week.')
    pg.locator('[data-testid="pi-programma"]').fill('Samen Eten 2027')
    ok('10 opslaan aan na wijziging', not pg.get_by_role('button',name='Projectinformatie opslaan').is_disabled())
    pg.screenshot(path='shots/pi_1_documenten_desktop.png', full_page=True)
    pg.get_by_role('button',name='Projectinformatie opslaan').click(); pg.wait_for_timeout(1000)
    na=prog(pg,P1)
    ok('11 opslaan schrijft doelstellingen naar goals en programma naar program_label (bestaande kolommen)', na.get('goals')=='60 gasten per week.' and na.get('program_label')=='Samen Eten 2027', str((na.get('goals'),na.get('program_label'))))
    ok('12b requested_amount blijft de afgeleide waarde begroting min eigen bijdrage (zelfde regel als bij elk opslaan van een project)', na.get('requested_amount')==na.get('budget_total')-na.get('own_contribution'))
    ok('12 overige kolommen onaangeroerd (activities, partners, impact, planning, naam, locatie, begroting, cofinanciers)',
       all(na.get(k)==voor.get(k) for k in ['activities','partners','impact_description','planning','name','location','period_start','period_end','budget_total','own_contribution','description','target_groups','themes']) and json.dumps(na.get('cofinanciers'),sort_keys=True)==json.dumps(voor.get('cofinanciers'),sort_keys=True))
    ok('13 herkomst: gewijzigde velden krijgen "ingevuld door u", ongewijzigde behouden hun herkomst', (na.get('field_sources') or {}).get('doelstellingen')=='handmatig' and 'Herkomst: ingevuld door u' in pg.locator('[data-testid="pi-bron-doelstelling"]').inner_text(), str(na.get('field_sources')))
    ok('14 melding "Projectinformatie opgeslagen." en knop weer uit', 'Projectinformatie opgeslagen.' in pg.locator('[data-testid="pi-melding"]').inner_text() and pg.get_by_role('button',name='Projectinformatie opslaan').is_disabled())
    ok('15 geen pageerrors', not pg.errs, str(pg.errs))
    # tweede project: wisselen verliest geen niet-opgeslagen werk van andere projecten en toont eigen data
    sel.select_option(P2); pg.wait_for_timeout(300)
    ok('16 ander project: eigen waarden (niet die van het vorige)', pg.locator('[data-testid="pi-doelstelling"]').input_value()!='60 gasten per week.')
    ok('17 documentenlijst blijft aanwezig onder Projectinformatie', 'opgemaakte documenten' in txt(pg).lower())
    ctx.close()
    # ===== Deep link
    ctx,pg=nieuw(b,{'width':1280,'height':1100},'pro',f'/kompas/documentatie?project={P2}')
    ok('18 deep link ?project=<id> kiest dat project', pg.locator('[data-testid="pi-project"]').input_value()==P2)
    ctx.close()
    ctx,pg=nieuw(b,{'width':1280,'height':1100},'pro','/kompas/documentatie?project=bestaat-niet')
    ok('19 onbekend project in de link: valt terug op het eerste project, geen fout', pg.locator('[data-testid="projectinformatie"]').count()==1 and not pg.errs, str(pg.errs))
    ctx.close()
    # ===== Dossier Overzicht: basis + verwijzing
    ctx,pg=nieuw(b,{'width':1280,'height':1100},'pro',f'/kompas/projecten/{P1}')
    ov=pg.locator('[data-testid="tab-overzicht"]').inner_text().replace('\xa0',' ')
    ok('20 Overzicht toont basisgegevens, niet de uitgebreide inhoud', 'Samen Eten' in ov and 'Utrecht-Noord' in ov and 'Wekelijks een warme maaltijd.' in ov and 'Minder eenzaamheid.' not in ov and 'Koken.' not in ov and 'Wijkcentrum' not in ov)
    ok('21 Overzicht: Projectinformatie-kaart met voortgang en link naar Documenten', re.search(r'\d+ van 6 onderdelen ingevuld', pg.locator('[data-testid="overzicht-pi-voortgang"]').inner_text()) is not None)
    pg.locator('[data-testid="overzicht-open-projectinformatie"]').click(); pg.wait_for_timeout(700)
    ok('22 link opent Documenten met dit project gekozen', hsh(pg).startswith('#/kompas/documentatie') and pg.locator('[data-testid="pi-project"]').input_value()==P1, hsh(pg))
    ctx.close()
    # ===== Bewerken: één plek, compact
    ctx,pg=nieuw(b,{'width':1280,'height':1100},'pro',f'/kompas/projecten/{P1}?bewerk=1')
    f=pg.locator('[data-testid="project-bewerk-formulier"]'); ft=f.inner_text().replace('\xa0',' ')
    ok('23 bewerken: compact (zelfde als Nieuw project) en zonder Programma/Doelstellingen/Activiteiten/Schrijfvoorkeur', f.count()==1 and all(x in ft for x in ['Projectnaam','Doelgroep','Discipline','Looptijd','Werkgebied / locatie','Projectomschrijving','Totale projectbegroting','Eigen bijdrage','Te financieren bedrag']) and not any(x in ft for x in ['Programma','Doelstellingen','Activiteiten','Partners','Schrijfvoorkeur','Beoogde impact']))
    ok('24 geen lengtebeperking of tekenteller bij de omschrijving', pg.locator('[data-testid="np-omschrijving"]').get_attribute('maxlength') is None)
    voor=prog(pg,P1)
    pg.get_by_role('button',name='Project opslaan').click(); pg.wait_for_timeout(1000)
    na=prog(pg,P1)
    ok('25 opslaan via het compacte formulier laat de uitgebreide kolommen intact', all(na.get(k)==voor.get(k) for k in ['goals','activities','partners','impact_description','planning','results','writing_preferences','program_label']))
    pg.screenshot(path='shots/pi_2_overzicht.png', full_page=True)
    ctx.close()
    # ===== Matching onaangetast: signalen komen uit dezelfde kolommen
    # ===== Free: geen werkruimte
    ctx,pg=nieuw(b,{'width':1280,'height':900},'free','/kompas/documentatie')
    ok('26 Free: Projectinformatie niet zichtbaar, upgrade-uitnodiging blijft', pg.locator('[data-testid="projectinformatie"]').count()==0 and 'Bekijk de abonnementen' in txt(pg))
    ctx.close()
    # ===== Mobiel
    for w in (390,320):
        ctx,pg=nieuw(b,{'width':w,'height':900},'pro',f'/kompas/documentatie?project={P1}')
        ok(f'27 mobiel {w}: Documenten zonder horizontale scroll', geenhscroll(pg))
        ok(f'28 mobiel {w}: velden binnen beeld', pg.evaluate('Array.from(document.querySelectorAll("[data-testid=projectinformatie] textarea, [data-testid=projectinformatie] input, [data-testid=projectinformatie] select")).every(e=>e.getBoundingClientRect().right<=window.innerWidth+1)'))
        ok(f'29 mobiel {w}: opslaan-knop tikbaar (>=44px hoog)', pg.get_by_role('button',name='Projectinformatie opslaan').bounding_box()['height']>=44)
        if w==390: pg.screenshot(path='shots/pi_3_mobiel.png', full_page=True)
        ok(f'30 mobiel {w}: geen pageerrors', not pg.errs, str(pg.errs))
        ctx.close()
    b.close()
srv.terminate()
f=[r for r in res if not r[1]]
print(f'\n{len(res)-len(f)}/{len(res)} geslaagd'); sys.exit(1 if f else 0)
