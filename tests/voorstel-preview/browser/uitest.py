# Browsertest van de compacte, read-only voorstelpreview (Fase C). De fixture komt uit de echte servercode (maak-fixture.mjs).
import subprocess, time, os
from playwright.sync_api import sync_playwright
os.chdir(os.path.dirname(os.path.abspath(__file__)))
srv = subprocess.Popen(['python3',__import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)),'../../spa_server.py'), '8791', 'web'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1)
BASE='http://localhost:8791/index.html'
res=[]
def ok(n,c,d=''):
    res.append((n,bool(c),d)); print(('OK  ' if c else 'FAIL'),n,(d if not c else ''), flush=True)
os.makedirs('shots',exist_ok=True)
NAMEN=['Rotterdams Jongerencultuurfonds','Wijkinitiatievenfonds Zuid','Cultuurimpuls Rotterdam','Buurtbudget Delfshaven','Fonds Premium Voorbeeld','Stichting Voorbeeld Fonds Zuid']
def regel(pg,naam):
    return pg.locator('[data-testid="voorstel-regel"]').filter(has=pg.locator(f'[data-testid="financieringsregel-titel"]:text-is("{naam}")'))
def kop(pg,naam): return regel(pg,naam).locator('[data-testid="voorstel-regel-kop"]')
def open_(pg,naam):
    if kop(pg,naam).get_attribute('aria-expanded')!='true': kop(pg,naam).click()
def tekst(el): return el.inner_text().replace('\xa0',' ')
try:
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
    for naam,vp in (('desktop',{'width':1100,'height':900}),('mobiel',{'width':390,'height':800})):
        ctx=b.new_context(viewport=vp); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e))); calls=[]
        pg.on('request',lambda r: calls.append((r.method,r.url)))
        pg.goto(BASE+'#mix'); pg.wait_for_selector('[data-testid="voorstel-preview"]'); pg.wait_for_timeout(300)
        ok(f'{naam}: geen JS-fouten', not errs, str(errs))
        t=tekst(pg.locator('body'))
        ok(f'{naam}: expliciet niet opgeslagen', pg.locator('[data-testid="voorstel-niet-opgeslagen"]').count()==1 and 'niets opgeslagen' in t)
        ok(f'{naam}: 6 regels, online regel niet getoond, melding aanwezig', pg.locator('[data-testid="voorstel-regel"]').count()==6 and pg.locator('[data-testid="voorstel-overgeslagen"]').count()==1)
        # --- standaard ingeklapt
        ok(f'{naam}: alle regels standaard ingeklapt (aria-expanded=false)', all(kop(pg,n).get_attribute('aria-expanded')=='false' for n in NAMEN))
        ok(f'{naam}: geen detailpaneel zichtbaar', pg.locator('[data-testid="financieringsregel-details"]:visible').count()==0 and pg.locator('[data-testid="voorstel-regel-detail"]').count()==0)
        ok(f'{naam}: geen verificatieblok, bronlink of motivatie in de DOM zolang dicht', pg.locator('[data-testid="verificatieblok"]').count()==0 and pg.locator('[data-testid="verificatie-bron"]').count()==0 and 'Waarom past dit' not in t)
        # --- compacte kop: naam, bedrag, status, deadline
        k=regel(pg,NAMEN[0]).locator('[data-testid="voorstel-regel-kop"]')
        kt=tekst(k)
        ok(f'{naam}: kop toont naam, bedrag, status en deadline', 'Rotterdams Jongerencultuurfonds' in kt and '€ 20.000' in kt and 'Geverifieerd' in kt and 'deadline 12 nov 2026' in kt, kt)
        ok(f'{naam}: kop heeft geen details (geen grenzen, motivatie, bron)', 'Bijdrage' not in kt and 'Past bij' not in kt and 'https://' not in kt)
        sts={n: regel(pg,n).locator('[data-testid="financieringsregel-status"]').get_attribute('data-status') for n in NAMEN}
        ok(f'{naam}: status per kop: geverifieerd, conflict, onzeker, niet gecontroleerd, niet gecontroleerd, gedeeltelijk', list(sts.values())==['geverifieerd','conflict','onzeker','niet_gecontroleerd','niet_gecontroleerd','gedeeltelijk'], str(sts))
        ok(f'{naam}: kop van de basisgegevens-regel zonder bedrag en zonder deadline', 'Geen bedrag' in tekst(kop(pg,NAMEN[4])) and 'deadline' not in tekst(kop(pg,NAMEN[4])))
        ok(f'{naam}: kop-knop is een echte button met aria-controls naar een region', kop(pg,NAMEN[0]).evaluate('e=>e.tagName')=='BUTTON' and regel(pg,NAMEN[0]).locator('[role="region"]').count()==1 and kop(pg,NAMEN[0]).get_attribute('aria-controls')==regel(pg,NAMEN[0]).locator('[role="region"]').get_attribute('id'))
        ok(f'{naam}: elke kop minstens 44px hoog (aanraakdoel)', all(kop(pg,n).bounding_box()['height']>=44 for n in NAMEN))
        ok(f'{naam}: compacte lijst: 6 regels samen minder dan 6 x 110px hoog', pg.locator('[data-testid="voorstel-regels"]').bounding_box()['height']<6*110, str(pg.locator('[data-testid="voorstel-regels"]').bounding_box()['height']))
        pg.screenshot(path=f'shots/preview_{naam}_ingeklapt.png', full_page=True)
        # --- klikken op de regel
        kop(pg,NAMEN[0]).click(); pg.wait_for_timeout(100)
        ok(f'{naam}: klik klapt open (aria-expanded=true, data-open=ja)', kop(pg,NAMEN[0]).get_attribute('aria-expanded')=='true' and regel(pg,NAMEN[0]).get_attribute('data-open')=='ja')
        g=regel(pg,NAMEN[0]); d=tekst(g.locator('[data-testid="financieringsregel-details"]'))
        ok(f'{naam}: details: fonds/gever, regeling, bedrag, grenzen, deadline', all(x in d for x in ['Fonds / gever','Gemeente Rotterdam','Regeling','Rotterdams Jongerencultuurfonds','Voorgesteld bedrag','€ 20.000','Bijdragegrenzen','€ 5.000 – € 25.000','12 nov 2026 (volgens onze database)']), d[:400])
        ok(f'{naam}: details: doelgroep, werkgebied, type aanvrager, voorwaarden, cofinanciering', all(x in d for x in ['Doelgroep','Werkgebied','Type aanvrager','Voorwaarden','Cofinanciering']))
        ok(f'{naam}: details: motivatie en verificatie per veld', 'waarom past dit bij uw project' in d.lower() and g.locator('[data-testid="verificatie-veld"]').count()>=4 and g.locator('[data-testid="verificatieblok"]').get_attribute('data-status')=='geverifieerd')
        ok(f'{naam}: details: bron en gecontroleerd op', g.locator('[data-testid="verificatie-bron"]').get_attribute('href').startswith('https://') and 'Gecontroleerd op 2026-10-14' in d)
        ok(f'{naam}: de andere regels blijven dicht', all(kop(pg,n).get_attribute('aria-expanded')=='false' for n in NAMEN[1:]))
        # --- onafhankelijk, geen accordion
        kop(pg,NAMEN[1]).click(); kop(pg,NAMEN[5]).click(); pg.wait_for_timeout(100)
        opn=[kop(pg,n).get_attribute('aria-expanded') for n in NAMEN]
        ok(f'{naam}: meerdere regels tegelijk open (geen accordion)', opn==['true','true','false','false','false','true'], str(opn))
        c=tekst(regel(pg,NAMEN[1]).locator('[data-testid="financieringsregel-details"]'))
        ok(f'{naam}: conflict in details met beide waarden en advies', '2026-12-15' in c and '2026-12-01' in c and 'Controleer de actuele gegevens' in c)
        o=regel(pg,NAMEN[5])
        ok(f'{naam}: gedeeltelijk: niet bevestigde velden niet als bevestigd', o.locator('[data-testid="verificatie-veld"][data-veld="Deadline"]').get_attribute('data-status')!='confirmed')
        kop(pg,NAMEN[0]).click(); pg.wait_for_timeout(100)
        ok(f'{naam}: weer dichtklikken verbergt alleen die regel', kop(pg,NAMEN[0]).get_attribute('aria-expanded')=='false' and kop(pg,NAMEN[1]).get_attribute('aria-expanded')=='true' and regel(pg,NAMEN[0]).locator('[data-testid="voorstel-regel-detail"]').count()==0)
        pg.screenshot(path=f'shots/preview_{naam}_deels_open.png', full_page=True)
        # --- toetsenbord
        kop(pg,NAMEN[2]).focus(); pg.keyboard.press('Enter'); pg.wait_for_timeout(100)
        ok(f'{naam}: Enter klapt open', kop(pg,NAMEN[2]).get_attribute('aria-expanded')=='true')
        pg.keyboard.press('Space'); pg.wait_for_timeout(100)
        ok(f'{naam}: spatie klapt dicht', kop(pg,NAMEN[2]).get_attribute('aria-expanded')=='false')
        kop(pg,NAMEN[0]).focus(); pg.keyboard.press('Tab'); 
        ok(f'{naam}: Tab gaat naar de volgende regel (dichte details zijn niet focusbaar)', pg.evaluate('document.activeElement && document.activeElement.getAttribute("data-testid")')=='voorstel-regel-kop' and pg.evaluate('document.activeElement.textContent').startswith('Wijkinitiatievenfonds'))
        # --- basisgegevens-regel
        open_(pg,NAMEN[4]); pbl=tekst(regel(pg,NAMEN[4]))
        ok(f'{naam}: basisgegevens: melding, geen deadline- of grenzenwaarde', 'basisgegevens' in pbl and 'Geen deadline bekend' in pbl and 'Bijdragegrenzen' not in pbl)
        # --- read-only en netwerk
        ok(f'{naam}: alleen de kopknoppen zijn knoppen; geen invoervelden of formulieren', pg.locator('button').count()==6 and pg.locator('button:not([aria-expanded])').count()==0 and pg.locator('input, textarea, select, form').count()==0)
        for n in NAMEN: open_(pg,n)
        ok(f'{naam}: nergens "Geverifieerd door" bij een niet geverifieerde regel', all('Geverifieerd door' not in tekst(regel(pg,n)) for n in NAMEN[1:]))
        ok(f'{naam}: geen netwerkverzoeken behalve pagina en fixture', all(u.endswith(('index.html','bundle.js','fixture.json','favicon.ico')) or u.startswith('data:') for _,u in calls), str(calls))
        ok(f'{naam}: geen horizontaal scrollen (ook alles open)', pg.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'))
        pg.screenshot(path=f'shots/preview_{naam}_alles_open.png', full_page=True)
        ctx.close()
    # fout en leeg
    for sc in ('fout','leeg'):
        ctx=b.new_context(viewport={'width':900,'height':500}); pg=ctx.new_page(); pg.goto(BASE+'#'+sc); pg.wait_for_selector('[data-testid="voorstel-preview"]')
        t=pg.locator('body').inner_text()
        ok(f'{sc}: alleen een melding, geen statusbadge, geen regels', pg.locator('[data-testid="voorstel-preview"]').get_attribute('data-toestand')=='fout' and pg.locator('[data-testid="financieringsregel-status"]').count()==0 and pg.locator('[data-testid="voorstel-regel"]').count()==0 and 'niets opgeslagen' in t.lower() and 'geverifieerd' not in t.lower())
        pg.screenshot(path=f'shots/preview_{sc}.png'); ctx.close()
    # vervalste metadata -> overal niet gecontroleerd
    ctx=b.new_context(viewport={'width':1000,'height':900}); pg=ctx.new_page(); pg.goto(BASE+'#vervalst'); pg.wait_for_selector('[data-testid="voorstel-regel"]')
    sts=pg.locator('[data-testid="financieringsregel-status"]').evaluate_all('els=>els.map(e=>e.dataset.status)')
    ok('vervalste metadata: elke regel niet gecontroleerd', len(sts)==6 and set(sts)=={'niet_gecontroleerd'}, str(sts))
    ok('vervalste metadata: nergens "Geverifieerd" of "Conflict"', 'Geverifieerd' not in pg.locator('body').inner_text() and 'Conflict' not in pg.locator('body').inner_text())
    ctx.close(); b.close()
finally:
    srv.terminate()
f=[r for r in res if not r[1]]
print(f'\nBROWSER: {len(res)-len(f)} OK, {len(f)} FAIL')
raise SystemExit(1 if f else 0)
