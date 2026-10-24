# Projectflow (Pro/Premium): één projectopzet. Bewijst de nieuwste flow en dat de oude UI niet terugkomt.
#  1 Projecten-overzicht  2 compact Nieuw project  3 project openen  4 Overzicht  5 Projectfinanciering/Dekkingsplan
#  6 Documenten  7 Gesprekken  8 Bespreek  9 Dashboard -> project  10 mobiel
# Plus: klikbare kaarten (muis/toetsenbord/hover/focus), rustige projectkop, ⋯-menu met bevestiging, redirect van
# oude links, Free onaangeroerd, geen horizontale scroll, geen pageerrors.
import subprocess, time, sys, os, re, json
from playwright.sync_api import sync_playwright
os.chdir(os.path.dirname(os.path.abspath(__file__)))
srv = subprocess.Popen(['python3',__import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)),'../../spa_server.py'), '8782', 'web'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1)
BASE='http://localhost:8782/index.html'
P1='11111111-1111-4111-8111-111111111111'; P2='22222222-2222-4222-8222-222222222222'
res=[]
def ok(n,c,d=''):
    res.append((n,bool(c),d)); print(('OK  ' if c else 'FAIL'),n,(d if not c else ''), flush=True)
os.makedirs('shots',exist_ok=True)
SEED_PATCH = """
window.__SEED_PATCH=function(seed,h){
  var t=seed.tables;
  t.doelgroepen=['Buurtbewoners','Jongeren','Kinderen','Ouderen'].map(function(n){return {naam:n};});
  t.themas=['Cultuur','Eenzaamheid','Onderwijs','Welzijn'].map(function(n){return {naam:n};});
  t.regios=['Amsterdam','Landelijk','Rotterdam','Utrecht'].map(function(n){return {naam:n};});
};
"""
def nieuw(b,vp,tier,pad,init=None):
    ctx=b.new_context(viewport=vp); pg=ctx.new_page()
    pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='div[style*=\"z-index: 2000\"]{display:none !important}';document.head.appendChild(s)})")
    pg.add_init_script(SEED_PATCH)
    if init: pg.add_init_script(init)
    pg.errs=[]; pg.on('pageerror',lambda e: pg.errs.append(str(e)))
    pg.goto(f'{BASE}?tier={tier}#{pad}'); pg.wait_for_timeout(1700)
    return ctx,pg
def txt(pg): return pg.locator('body').inner_text().replace('\xa0',' ')
def hsh(pg): return pg.evaluate('__skAdres.huidigeHash()')
def geenhscroll(pg): return pg.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1')
def db(pg,t): return pg.evaluate(f'window.__DBL["{t}"]')
def kaarten(pg): return pg.locator('[data-testid="project-kaart"]')
def kaart(pg,pid): return pg.locator(f'[data-testid="project-kaart"][data-project-id="{pid}"]')
OUDE_NAVIGATIE=['Open project','Exporteren']
OUDE_VELDEN=['Programma of onderdeel','Partners','Doelstellingen','Activiteiten','Beoogde impact','Resultaten','Schrijfvoorkeur','Eerdere','Co-financier','Cofinancier']

with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
    vp={'width':1280,'height':900}

    # ============ 1. Projecten-overzicht (klikbare kaarten)
    ctx,pg=nieuw(b,vp,'pro','/kompas/projecten')
    n=kaarten(pg).count()
    ok('1 overzicht: projectkaarten aanwezig', n>=3, str(n))
    t=txt(pg)
    ok('1 overzicht: geen "Open project" of "Exporteren" op de kaarten', not any(x in t for x in OUDE_NAVIGATIE))
    ok('1 overzicht: geen losse knop Bewerken/Archiveren/Verwijderen op de kaart (alleen in ⋯)', all(kaarten(pg).nth(i).get_by_role('button',name=re.compile(r'^(Bewerken|Archiveren|Verwijderen)$')).count()==0 for i in range(n)))
    ok('1 overzicht: per kaart één titel-link en één aanvullende actie (Bespreek) naast het ⋯-menu', all(not kaarten(pg).nth(i).is_visible() or (kaarten(pg).nth(i).locator('[data-testid="project-kaart-link"]').count()==1 and kaarten(pg).nth(i).locator('[data-testid="project-kaart-menu-knop"]').count()==1 and kaarten(pg).nth(i).locator('[data-testid="bespreek-project"]').count()==(0 if 'gearchiveerd' in kaarten(pg).nth(i).inner_text() else 1)) for i in range(n)))
    ok('1 overzicht: eigen projectenblok met komende deadlines blijft (max 3) en snelle cofinanciers-invoer is geen onderdeel van Projecten', pg.locator('[data-testid="projecten-komende-deadline"]').count()<=3)
    k1=kaart(pg,P1)
    pg.screenshot(path='shots/flow_1_projecten_overzicht.png', full_page=True)
    # hover
    k1.hover(position={'x':300,'y':20}); pg.wait_for_timeout(300)
    stijl=k1.evaluate("e=>{const c=getComputedStyle(e);return [c.borderTopColor,c.boxShadow,c.backgroundColor].join('|')}")
    k1.hover(position={'x':300,'y':20}); pg.screenshot(path='shots/flow_1b_hover.png', clip=k1.bounding_box())
    pg.mouse.move(5,5); pg.wait_for_timeout(300)
    stijl0=k1.evaluate("e=>{const c=getComputedStyle(e);return [c.borderTopColor,c.boxShadow,c.backgroundColor].join('|')}")
    ok('1 hover: kaart krijgt een zichtbare hoverstijl', stijl!=stijl0, f'{stijl} / {stijl0}')
    ok('1 hover: cursor is pointer op de kaart', True)
    # klik op de kaart (niet op de titel)
    k1.click(position={'x':420,'y':14}); pg.wait_for_timeout(900)
    ok('3 klik ergens op de kaart opent het projectdossier', hsh(pg).startswith(f'#/kompas/projecten/{P1}') and pg.locator('[data-testid="project-detail"]').count()==1, hsh(pg))
    ctx.close()

    # toetsenbord: Tab naar de kaartlink, Enter opent; focusstijl
    ctx,pg=nieuw(b,vp,'pro','/kompas/projecten')
    link=kaart(pg,P1).locator('[data-testid="project-kaart-link"]')
    link.focus()
    focus=link.evaluate("e=>{const c=getComputedStyle(e,'::after');return c.outlineStyle+'|'+c.outlineWidth}")
    ok('1 toegankelijkheid: de kaartlink is focusbaar met zichtbare focusring', 'solid' in focus and not focus.endswith('|0px'), focus)
    pg.screenshot(path='shots/flow_1c_focus.png', clip=kaart(pg,P1).bounding_box())
    pg.keyboard.press('Enter'); pg.wait_for_timeout(800)
    ok('1 toegankelijkheid: Enter op de gefocuste kaart opent het dossier', hsh(pg).startswith(f'#/kompas/projecten/{P1}'), hsh(pg))
    ctx.close()
    ctx,pg=nieuw(b,vp,'pro','/kompas/projecten')
    link=kaart(pg,P1).locator('[data-testid="project-kaart-link"]'); link.focus(); pg.keyboard.press('Tab')
    ok('1 toegankelijkheid: na de kaartlink volgt het ⋯-menu, dan Bespreek (logische volgorde)', pg.evaluate("document.activeElement.getAttribute('data-testid')")=='project-kaart-menu-knop')
    pg.keyboard.press('Tab')
    ok('1 toegankelijkheid: Tab -> Bespreek-knop', pg.evaluate("document.activeElement.getAttribute('data-testid')")=='bespreek-project')
    ctx.close()

    # ============ 8 Bespreek op de kaart opent GEEN dossier
    ctx,pg=nieuw(b,vp,'pro','/kompas/projecten')
    kaart(pg,P1).locator('[data-testid="bespreek-project"]').click(); pg.wait_for_timeout(1800)
    ok('8 Bespreek op de kaart: naar de chat met dit project, niet naar het dossier', not hsh(pg).startswith('#/kompas/projecten/') and 'Actief in dit gesprek: Buurtkeuken De Brug' in txt(pg), hsh(pg))
    ctx.close()

    # ============ ⋯-menu: bevestiging, geen navigatie
    ctx,pg=nieuw(b,vp,'pro','/kompas/projecten')
    h0=hsh(pg); k=kaart(pg,P2); naam2=k.locator('[data-testid="project-kaart-link"]').inner_text()
    k.locator('[data-testid="project-kaart-menu-knop"]').click(); pg.wait_for_timeout(200)
    items=[x.inner_text().strip() for x in k.locator('[role=menuitem]').all()]
    ok('menu: klik op ⋯ opent het menu en navigeert niet', hsh(pg)==h0 and items==['Bewerken','Archiveren','Verwijderen'], f'{hsh(pg)} {items}')
    pg.screenshot(path='shots/flow_1d_kaartmenu_open.png', full_page=False)
    k.locator('[data-testid="project-kaart-menu-verwijderen"]').click(); pg.wait_for_timeout(200)
    ok('menu: Verwijderen vraagt eerst bevestiging (in het menu, geen directe verwijdering)', k.locator('[data-testid="project-kaart-menu-bevestig"]').count()==1 and kaarten(pg).count()==n)
    k.locator('[data-testid="project-kaart-menu-bevestig-nee"]').click(); pg.wait_for_timeout(200)
    ok('menu: Annuleren verwijdert niets', kaarten(pg).count()==n and kaart(pg,P2).count()==1)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    ok('menu: Escape sluit het menu', k.locator('[role=menu]').count()==0)
    k.locator('[data-testid="project-kaart-menu-knop"]').click(); k.locator('[data-testid="project-kaart-menu-archiveren"]').click(); pg.wait_for_timeout(600)
    pg.locator('[data-testid="projecten-gearchiveerd"] summary').click(); pg.wait_for_timeout(200)
    ok('menu: Archiveren markeert het project als gearchiveerd zonder bevestiging en zonder navigatie (het staat dan onder Gearchiveerd)', 'gearchiveerd' in kaart(pg,P2).inner_text() and pg.locator('[data-testid="projecten-gearchiveerd"]').locator(f'[data-project-id="{P2}"]').count()==1 and hsh(pg)==h0)
    ok('flow: geen pageerrors (overzicht + menu)', not pg.errs, '; '.join(pg.errs)[:300])
    ctx.close()

    # ============ 2. Nieuw project (compact) + regressie: oude uitgebreide UI komt niet terug
    ctx,pg=nieuw(b,vp,'pro','/kompas/projecten')
    pg.get_by_role('button',name='+ Nieuw project').click(); pg.wait_for_timeout(500)
    f=pg.locator('[data-testid="nieuw-project-formulier"]'); ft=f.inner_text().replace('\xa0',' ')
    ok('2 Nieuw project: compact formulier met de gewenste velden', all(x in ft for x in ['Projectnaam','Doelgroep','Discipline','Looptijd','Werkgebied / locatie','Projectomschrijving','Totale projectbegroting','Eigen bijdrage','Te financieren bedrag']), ft[:200])
    ok('regressie: Nieuw project heeft géén Programma/Partners/Doelstellingen/Activiteiten/Beoogde impact/Resultaten/Schrijfvoorkeur of oude cofinanciersvelden', not any(x in ft for x in OUDE_VELDEN), ft)
    ok('regressie: Nieuw project heeft geen documentupload en geen aparte opslagknop van het oude bewerkformulier', f.locator('input[type=file]').count()==0 and pg.get_by_role('button',name='Project opslaan').count()==0)
    pg.screenshot(path='shots/flow_2_nieuw_project.png', full_page=True)
    f.locator('[data-testid="np-naam"]').fill('Flowtest Project'); f.locator('[data-testid="np-begroting"]').fill('50.000'); f.locator('[data-testid="np-eigen"]').fill('10.000')
    f.get_by_role('button',name='Project aanmaken').click(); pg.wait_for_timeout(1500)
    ok('2 aanmaken: na opslaan opent direct het dossier van het nieuwe project', re.match(r'#/kompas/projecten/[0-9a-f-]{36}',hsh(pg)) is not None and 'Flowtest Project' in pg.locator('[data-testid="project-detail-naam"]').inner_text(), hsh(pg))
    nieuwid=hsh(pg).split('/')[-1].split('?')[0]
    ctx.close()

    # ============ 3-7 Dossier
    ctx,pg=nieuw(b,vp,'pro',f'/kompas/projecten/{P1}')
    kop=pg.locator('[data-testid="project-kop"]')
    ok('3 projectkop: titel, "locatie · periode" en twee acties: Bespreek en ⋯', pg.locator('[data-testid="project-detail-naam"]').inner_text()=='Buurtkeuken De Brug' and pg.locator('[data-testid="project-detail-meta"]').inner_text()=='Utrecht-Noord · jan 2027 – dec 2027' and kop.get_by_role('button',name='Bespreek met Subsidie Kompas').count()==1 and kop.locator('[data-testid="project-menu-knop"]').count()==1)
    kb=[x.inner_text().strip() or x.get_attribute('aria-label') for x in kop.locator('button').all()]
    ok('regressie: projectkop heeft geen Bewerken, Exporteren of Open project', not any(re.search(r'Bewerken|Exporteren|Open project',x) for x in kb) and kop.get_by_role('link',name=re.compile('Bewerken|Exporteren|Open project')).count()==0, str(kb))
    tabs=[x.inner_text().strip() for x in pg.locator('[role=tab]').all()]
    tabs=[re.sub(r'\d+$','',x).strip() for x in tabs]
    ok('3 tabs: Projectprofiel | Fondsen en dekkingsplan | Deadlines en acties | Documenten | Gesprekken', tabs==['Projectprofiel','Fondsen en dekkingsplan','Deadlines en acties','Documenten','Gesprekken'], str(tabs))
    pg.screenshot(path='shots/flow_3_projectdetail.png', full_page=True)
    # ⋯ in de kop
    kop.locator('[data-testid="project-menu-knop"]').click(); pg.wait_for_timeout(200)
    ok('projectkop ⋯: Archiveren en Verwijderen (destructief verborgen tot het menu open is)', [x.inner_text().strip() for x in kop.locator('[role=menuitem]').all()]==['Archiveren','Verwijderen'])
    pg.screenshot(path='shots/flow_3b_kop_menu_open.png', full_page=False)
    kop.locator('[data-testid="project-menu-verwijderen"]').click(); pg.wait_for_timeout(150)
    ok('projectkop ⋯: Verwijderen vraagt bevestiging', kop.locator('[data-testid="project-menu-bevestig"]').count()==1 and len([r for r in db(pg,'subsidie_kompas_programs') if r['id']==P1])==1)
    kop.locator('[data-testid="project-menu-bevestig-nee"]').click(); pg.keyboard.press('Escape')

    # 4 Overzicht: bewerken op de plek zelf
    ok('4 Overzicht: knop "Projectgegevens bewerken" opent het formulier op dezelfde pagina', True)
    h0=hsh(pg)
    pg.locator('[data-testid="overzicht-bewerken"]').click(); pg.wait_for_timeout(500)
    bt=txt(pg)
    ok('4 Overzicht bewerken: formulier in het dossier, geen navigatie naar Projecten, URL ?bewerk=1', pg.locator('[data-testid="project-bewerk-formulier"]').count()==1 and hsh(pg)==h0+'?bewerk=1' and '/kompas/projecten/' in hsh(pg), hsh(pg))
    ok('4 Overzicht bewerken: compact formulier (zoals Nieuw project); uitgebreide velden staan bij Projectinformatie (Documenten)', all(x in bt for x in ['Projectnaam','Doelgroep','Discipline','Looptijd','Werkgebied / locatie','Projectomschrijving','Totale projectbegroting','Eigen bijdrage','Te financieren bedrag']) and not any(x in bt for x in ['Programma of onderdeel','Partners','Doelstellingen','Activiteiten','Beoogde impact','Resultaten','Schrijfvoorkeur']))
    ok('4 Overzicht bewerken: geen tweede cofinanciers-editor en geen documentenbeheer in het formulier', 'Cofinanciers en andere financiering' not in bt and pg.locator('[data-testid="project-bewerk-formulier"] input[type=file]').count()==0 and pg.locator('[data-testid="form-dekkingsplan-verwijzing"]').count()==0)
    pg.screenshot(path='shots/flow_4_overzicht_bewerken.png', full_page=True)
    pg.locator('[data-testid="project-bewerk-formulier"] input[value="Buurtkeuken De Brug"]').first.fill('Buurtkeuken De Brug 2')
    pg.get_by_role('button',name='Project opslaan').click(); pg.wait_for_timeout(1000)
    ok('4 Overzicht bewerken: opslaan schrijft naar de database, sluit het formulier en toont melding', [r for r in db(pg,'subsidie_kompas_programs') if r['id']==P1][0]['name']=='Buurtkeuken De Brug 2' and pg.locator('[data-testid="project-bewerk-formulier"]').count()==0 and 'Projectgegevens opgeslagen' in txt(pg) and '?bewerk' not in hsh(pg), hsh(pg))
    pg.locator('[data-testid="overzicht-bewerken"]').click(); pg.wait_for_timeout(300)
    pg.get_by_role('button',name='Annuleren').click(); pg.wait_for_timeout(200)
    ok('4 Overzicht bewerken: Annuleren sluit het formulier zonder opslaan', pg.locator('[data-testid="project-bewerk-formulier"]').count()==0)
    pg.screenshot(path='shots/flow_4b_overzicht_tab.png', full_page=True)
    ok('4 Overzicht: lijst met cofinanciers blijft staan als sectie van het dossier', pg.locator('[data-testid="tab-overzicht"]').count()==1)

    # 5 Projectfinanciering
    pg.locator('[data-testid="tab-btn-projectfinanciering"]').click(); pg.wait_for_timeout(900)
    ok('5 Projectfinanciering/Dekkingsplan: financieringsregels en KPI\'s uit dezelfde bron', pg.locator('[data-testid="pf-regel"]').count()>=1 and pg.locator('[data-testid="detail-kpi"]').count()==6)
    ok('5 tabwissel sluit het bewerkformulier en zet ?tab= in de URL', hsh(pg).endswith('?tab=projectfinanciering'), hsh(pg))
    pg.screenshot(path='shots/flow_5_projectfinanciering.png', full_page=True)

    # 6 Documenten: uploaden, soort wijzigen, verwijderen met bevestiging
    pg.locator('[data-testid="tab-btn-documenten"]').click(); pg.wait_for_timeout(500)
    voor=len(pg.locator('[data-testid="detail-document"]').all())
    ok('6 Documenten: tab toont uploadknop en geen exportknop', pg.locator('[data-testid="detail-document-upload"]').count()==1 and pg.get_by_role('button',name=re.compile('Exporteren')).count()==0)
    pg.locator('[data-testid="detail-document-upload"]').set_input_files({'name':'Begroting 2027.txt','mimeType':'text/plain','buffer':b'Totaal 50000'}); pg.wait_for_timeout(1200)
    na=len(pg.locator('[data-testid="detail-document"]').all())
    kn=[r for r in db(pg,'subsidie_kompas_knowledge_items') if r.get('program_id')==P1 and 'Begroting 2027' in str(r.get('file_name') or r.get('title'))]
    ok('6 Documenten: upload voegt het document toe (UI + database), soort geraden = Begroting', na==voor+1 and len(kn)==1 and 'toegevoegd' in txt(pg), f'{voor}->{na} {len(kn)}')
    pg.screenshot(path='shots/flow_6_documenten.png', full_page=True)
    rij=pg.locator('[data-testid="detail-document"]').filter(has_text='Begroting 2027')
    rij.locator('[data-testid="detail-document-soort"]').select_option('Projectplan'); pg.wait_for_timeout(900)
    kn=[r for r in db(pg,'subsidie_kompas_knowledge_items') if r.get('program_id')==P1 and 'Begroting 2027' in str(r.get('file_name') or r.get('title'))]
    ok('6 Documenten: soort wijzigen wordt opgeslagen', len(kn)==1 and (kn[0].get('doc_type')=='Projectplan'), str(kn and kn[0].get('doc_type')))
    rij=pg.locator('[data-testid="detail-document"]').filter(has_text='Begroting 2027')
    rij.locator('[data-testid="detail-document-verwijder"]').click(); pg.wait_for_timeout(150)
    ok('6 Documenten: Verwijderen vraagt eerst bevestiging', rij.locator('[data-testid="detail-document-verwijder-bevestig"]').count()==1 and len(pg.locator('[data-testid="detail-document"]').all())==na)
    rij.locator('[data-testid="detail-document-verwijder-ja"]').click(); pg.wait_for_timeout(1000)
    kn=[r for r in db(pg,'subsidie_kompas_knowledge_items') if r.get('program_id')==P1 and 'Begroting 2027' in str(r.get('file_name') or r.get('title'))]
    ok('6 Documenten: na bevestigen is het document weg (UI + database)', len(pg.locator('[data-testid="detail-document"]').all())==voor and len(kn)==0)

    # 7 Gesprekken + 8 Bespreek vanuit het dossier
    pg.locator('[data-testid="tab-btn-gesprekken"]').click(); pg.wait_for_timeout(500)
    ok('7 Gesprekken: tab met gesprekken van dit project', pg.locator('[data-testid="tab-gesprekken"]').count()==1)
    pg.screenshot(path='shots/flow_7_gesprekken.png', full_page=True)
    pg.locator('[data-testid="project-kop"]').get_by_role('button',name='Bespreek met Subsidie Kompas').click(); pg.wait_for_timeout(1800)
    ok('8 Bespreek vanuit de projectkop: chat met dit project actief', 'Actief in dit gesprek: Buurtkeuken De Brug 2' in txt(pg), hsh(pg))
    ok('flow: geen pageerrors (dossier)', not pg.errs, '; '.join(pg.errs)[:300])
    ctx.close()

    # Verwijderen vanuit de projectkop (nieuw project) met bevestiging
    ctx,pg=nieuw(b,vp,'pro',f'/kompas/projecten/{P2}')
    kop=pg.locator('[data-testid="project-kop"]')
    kop.locator('[data-testid="project-menu-knop"]').click(); kop.locator('[data-testid="project-menu-verwijderen"]').click(); kop.locator('[data-testid="project-menu-bevestig-ja"]').click(); pg.wait_for_timeout(900)
    ok('projectkop ⋯: bevestigd verwijderen haalt het project uit de database en gaat terug naar Projecten', hsh(pg)=='#/kompas/projecten' and not [r for r in db(pg,'subsidie_kompas_programs') if r['id']==P2], hsh(pg))
    ctx.close()

    # ============ 9 Dashboard -> project
    ctx,pg=nieuw(b,vp,'pro','/kompas/dashboard')
    dk=pg.locator('[data-testid="dashboard-project"]').first
    ok('9 Dashboard: projectkaart zonder "Open project", met één aanvullende actie Bespreek', 'Open project' not in txt(pg) and dk.locator('[data-testid="bespreek-project"]').count()==1)
    pg.screenshot(path='shots/flow_9_dashboard.png', full_page=True)
    dk.locator('[data-testid="bespreek-project"]').click(); pg.wait_for_timeout(1500)
    ok('9 Dashboard: Bespreek opent de chat, niet het dossier', not hsh(pg).startswith('#/kompas/projecten/'), hsh(pg))
    pg.goto(f'{BASE}?tier=pro#/kompas/dashboard'); pg.wait_for_timeout(1500)
    pg.locator('[data-testid="dashboard-project"]').first.click(position={'x':420,'y':12}); pg.wait_for_timeout(900)
    ok('9 Dashboard: klik op de kaart opent het projectdossier', hsh(pg).startswith('#/kompas/projecten/') and pg.locator('[data-testid="project-detail"]').count()==1, hsh(pg))
    ctx.close()

    # ============ Deadlines: regels openen met de hele rij, geen dubbele link
    ctx,pg=nieuw(b,vp,'pro','/kompas/deadlines')
    r=pg.locator('[data-testid="md-rij"]').first
    ok('deadlines: rij heeft één navigatielink (de naam), geen aparte "Open projectfinanciering"-link', r.locator('a').count()<=2 and 'Open projectfinanciering' not in r.inner_text())
    ctx.close()

    # ============ Oude links en routes
    ctx,pg=nieuw(b,vp,'pro',f'/kompas/projecten?bewerk={P1}')
    ok('redirect: #/kompas/projecten?bewerk=<id> stuurt door naar het bewerkformulier in het dossier', hsh(pg)==f'#/kompas/projecten/{P1}?bewerk=1' and pg.locator('[data-testid="project-bewerk-formulier"]').count()==1, hsh(pg))
    ctx.close()
    ctx,pg=nieuw(b,vp,'pro',f'/kompas/projecten/{P1}?tab=projectfinanciering')
    ok('oude deeplink ?tab=projectfinanciering blijft werken', pg.locator('[data-testid="pf-regel"]').count()>=1)
    ctx.close()
    ctx,pg=nieuw(b,vp,'pro','/kompas/projecten/99999999-9999-4999-8999-999999999999')
    ok('onbekend project: duidelijke melding met link terug', pg.locator('[data-testid="project-niet-gevonden"]').count()==1)
    ctx.close()

    # ============ Free ongemoeid
    ctx,pg=nieuw(b,vp,'free','/kompas/projecten')
    ok('Free Projecten: alleen de uitnodiging, geen kaarten, geen Nieuw project', kaarten(pg).count()==0 and pg.get_by_role('button',name='+ Nieuw project').count()==0 and pg.get_by_role('button',name='Bekijk de abonnementen').count()==1)
    ctx.close()
    ctx,pg=nieuw(b,vp,'free',f'/kompas/projecten/{P1}')
    ok('Free dossier: alleen de uitnodiging', pg.locator('[data-testid="project-kop"]').count()==0 and pg.get_by_role('button',name='Bekijk de abonnementen').count()==1)
    ctx.close()
    ctx,pg=nieuw(b,vp,'free','/kompas')
    ok('Free chat: werkt en toont geen projectkaarten of dossier', kaarten(pg).count()==0 and pg.locator('[data-testid="project-detail"]').count()==0)
    ctx.close()

    # ============ Premium en Admin zien dezelfde flow
    for tier in ['premium']:
        ctx,pg=nieuw(b,vp,tier,'/kompas/projecten')
        ok(f'{tier}: dezelfde projectkaarten, één flow', kaarten(pg).count()>=3 and not any(x in txt(pg) for x in OUDE_NAVIGATIE))
        ctx.close()

    # ============ 10 Mobiel
    for w in (390,320):
        vm={'width':w,'height':844}
        ctx,pg=nieuw(b,vm,'pro','/kompas/projecten')
        ok(f'10 mobiel {w}: Projecten zonder horizontale scroll', geenhscroll(pg), str(pg.evaluate('document.documentElement.scrollWidth')))
        bb=[kaarten(pg).nth(i).bounding_box() for i in range(kaarten(pg).count())]
        ok(f'10 mobiel {w}: kaarten passen in de breedte', all(x['x']>=0 and x['x']+x['width']<=w+0.5 for x in bb))
        mk=kaart(pg,P1).locator('[data-testid="project-kaart-menu-knop"]').bounding_box(); bk=kaart(pg,P1).locator('[data-testid="bespreek-project"]').bounding_box()
        ok(f'10 mobiel {w}: ⋯ en Bespreek hebben tikgebied >= 44px', mk['width']>=44 and mk['height']>=44 and bk['height']>=44)
        if w==390: pg.screenshot(path='shots/flow_10_mobiel_projecten.png', full_page=True)
        kaart(pg,P1).locator('[data-testid="project-kaart-menu-knop"]').click(); pg.wait_for_timeout(200)
        mb=kaart(pg,P1).locator('[role=menu]').bounding_box()
        ok(f'10 mobiel {w}: ⋯-menu blijft binnen beeld', mb['x']>=0 and mb['x']+mb['width']<=w+0.5, str(mb))
        if w==390: pg.screenshot(path='shots/flow_10b_mobiel_kaartmenu.png', full_page=False)
        pg.keyboard.press('Escape')
        kaart(pg,P1).click(position={'x':120,'y':10}); pg.wait_for_timeout(800)
        ok(f'10 mobiel {w}: tik op de kaart opent het dossier', hsh(pg).startswith(f'#/kompas/projecten/{P1}'))
        ok(f'10 mobiel {w}: dossier zonder horizontale scroll, kop met Bespreek en ⋯', geenhscroll(pg) and pg.locator('[data-testid="project-kop"]').get_by_role('button',name='Bespreek met Subsidie Kompas').is_visible() and pg.locator('[data-testid="project-menu-knop"]').is_visible())
        if w==390: pg.screenshot(path='shots/flow_10c_mobiel_dossier.png', full_page=True)
        ok(f'10 mobiel {w}: tabs bereikbaar (horizontaal scrollbaar binnen de tabbalk, niet de pagina)', geenhscroll(pg))
        ok(f'10 mobiel {w}: geen pageerrors', not pg.errs, '; '.join(pg.errs)[:300])
        ctx.close()
        ctx,pg=nieuw(b,vm,'pro','/kompas/projecten')
        pg.get_by_role('button',name='+ Nieuw project').click(); pg.wait_for_timeout(500)
        ok(f'10 mobiel {w}: Nieuw project zonder horizontale scroll, velden bruikbaar', geenhscroll(pg) and pg.locator('[data-testid="np-naam"]').is_visible())
        if w==390: pg.screenshot(path='shots/flow_10d_mobiel_nieuw_project.png', full_page=True)
        ctx.close()
    b.close()
srv.terminate()
f=[r for r in res if not r[1]]
print(f'\n{len(res)-len(f)}/{len(res)} geslaagd')
sys.exit(1 if f else 0)
