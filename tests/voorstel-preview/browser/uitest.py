# Browsertest van de read-only voorstelpreview (Fase C). De fixture komt uit de echte servercode (maak-fixture.mjs).
import subprocess, time, os
from playwright.sync_api import sync_playwright
os.chdir(os.path.dirname(os.path.abspath(__file__)))
srv = subprocess.Popen(['python3','-m','http.server','8791','-d','web'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1)
BASE='http://localhost:8791/index.html'
res=[]
def ok(n,c,d=''):
    res.append((n,bool(c),d)); print(('OK  ' if c else 'FAIL'),n,(d if not c else ''), flush=True)
os.makedirs('shots',exist_ok=True)
def blok(pg,naam):
    return pg.locator('[data-testid="voorstel-regel"]').filter(has=pg.locator(f'[data-testid="voorstel-regel-naam"]:text-is("{naam}")'))
try:
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
    for naam,vp in (('desktop',{'width':1100,'height':900}),('mobiel',{'width':390,'height':800})):
        ctx=b.new_context(viewport=vp); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e))); calls=[]
        pg.on('request',lambda r: calls.append((r.method,r.url)))
        pg.goto(BASE+'#mix'); pg.wait_for_selector('[data-testid="voorstel-preview"]'); pg.wait_for_timeout(300)
        t=pg.locator('body').inner_text().replace('\xa0',' ')
        ok(f'{naam}: geen JS-fouten', not errs, str(errs))
        ok(f'{naam}: expliciet niet opgeslagen', pg.locator('[data-testid="voorstel-niet-opgeslagen"]').count()==1 and 'niets opgeslagen' in t)
        ok(f'{naam}: 6 regels (online regel niet getoond)', pg.locator('[data-testid="voorstel-regel"]').count()==6, str(pg.locator('[data-testid="voorstel-regel"]').count()))
        ok(f'{naam}: melding over niet getoonde regel', pg.locator('[data-testid="voorstel-overgeslagen"]').count()==1)
        st=lambda n: blok(pg,n).locator('[data-testid="verificatie-status"]').get_attribute('data-status')
        ok(f'{naam}: geverifieerd', st('Rotterdams Jongerencultuurfonds')=='geverifieerd')
        ok(f'{naam}: conflict', st('Wijkinitiatievenfonds Zuid')=='conflict')
        ok(f'{naam}: onzeker', st('Cultuurimpuls Rotterdam')=='onzeker')
        ok(f'{naam}: niet gecontroleerd (404)', st('Buurtbudget Delfshaven')=='niet_gecontroleerd')
        ok(f'{naam}: niet gecontroleerd (alleen basisgegevens)', st('Fonds Premium Voorbeeld')=='niet_gecontroleerd')
        ok(f'{naam}: gedeeltelijk geverifieerd', st('Stichting Voorbeeld Fonds Zuid')=='gedeeltelijk')
        g=blok(pg,'Rotterdams Jongerencultuurfonds')
        ok(f'{naam}: velden per regel: Fondsnaam, Deadline, bijdragen bevestigd', all(g.locator(f'[data-testid="verificatie-veld"][data-veld="{v}"]').get_attribute('data-status')=='confirmed' for v in ['Fondsnaam','Deadline','Minimale bijdrage','Maximale bijdrage']))
        ok(f'{naam}: bronlink https, noopener', g.locator('[data-testid="verificatie-bron"]').get_attribute('href').startswith('https://') and 'noopener' in g.locator('[data-testid="verificatie-bron"]').get_attribute('rel'))
        c=blok(pg,'Wijkinitiatievenfonds Zuid')
        ctext=c.locator('[data-testid="verificatie-conflict"]').inner_text()
        ok(f'{naam}: conflict toont beide waarden en advies', '2026-12-15' in ctext and '2026-12-01' in ctext and 'Controleer de actuele gegevens' in ctext, ctext)
        o=blok(pg,'Cultuurimpuls Rotterdam')
        ok(f'{naam}: onzeker: deadline niet als bevestigd', o.locator('[data-testid="verificatie-veld"][data-veld="Deadline"]').get_attribute('data-status')!='confirmed')
        pbl=blok(pg,'Fonds Premium Voorbeeld')
        ok(f'{naam}: basisgegevens: geen bedrag, geen deadline, melding', 'Geen bedrag voorgesteld' in pbl.inner_text() and 'Deadline volgens onze database' not in pbl.inner_text() and 'basisgegevens' in pbl.inner_text())
        ok(f'{naam}: geen knoppen, geen invoervelden (read-only)', pg.locator('button, input, textarea, select, form').count()==0)
        ok(f'{naam}: nergens "Geverifieerd" bij een niet geverifieerde regel', all('Geverifieerd door' not in blok(pg,n).inner_text() for n in ['Wijkinitiatievenfonds Zuid','Cultuurimpuls Rotterdam','Buurtbudget Delfshaven','Fonds Premium Voorbeeld','Stichting Voorbeeld Fonds Zuid']))
        ok(f'{naam}: geen netwerkverzoeken behalve pagina en fixture', all(u.endswith(('index.html','bundle.js','fixture.json','favicon.ico')) or u.startswith('data:') for _,u in calls), str(calls))
        ok(f'{naam}: geen horizontaal scrollen', pg.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'))
        pg.screenshot(path=f'shots/preview_{naam}.png', full_page=True)
        if naam=='desktop':
            for n,f in (('geverifieerd','Rotterdams Jongerencultuurfonds'),('conflict','Wijkinitiatievenfonds Zuid')):
                blok(pg,f).screenshot(path=f'shots/regel_{n}.png')
        ctx.close()
    # fout en leeg
    for sc in ('fout','leeg'):
        ctx=b.new_context(viewport={'width':900,'height':500}); pg=ctx.new_page(); pg.goto(BASE+'#'+sc); pg.wait_for_selector('[data-testid="voorstel-preview"]')
        t=pg.locator('body').inner_text()
        ok(f'{sc}: alleen een melding, geen statusbadge, geen regels', pg.locator('[data-testid="voorstel-preview"]').get_attribute('data-toestand')=='fout' and pg.locator('[data-testid="verificatie-status"]').count()==0 and pg.locator('[data-testid="voorstel-regel"]').count()==0 and 'niets opgeslagen' in t.lower() and 'geverifieerd' not in t.lower())
        pg.screenshot(path=f'shots/preview_{sc}.png'); ctx.close()
    # vervalste metadata (server_generated false) -> overal niet gecontroleerd
    ctx=b.new_context(viewport={'width':1000,'height':900}); pg=ctx.new_page(); pg.goto(BASE+'#vervalst'); pg.wait_for_selector('[data-testid="voorstel-regel"]')
    sts=pg.locator('[data-testid="verificatie-status"]').evaluate_all('els=>els.map(e=>e.dataset.status)')
    ok('vervalste metadata: elke regel niet gecontroleerd', len(sts)==6 and set(sts)=={'niet_gecontroleerd'}, str(sts))
    ok('vervalste metadata: nergens "Geverifieerd" of "Conflict"', 'Geverifieerd door' not in pg.locator('body').inner_text())
    ctx.close(); b.close()
finally:
    srv.terminate()
f=[r for r in res if not r[1]]
print(f'\nBROWSER: {len(res)-len(f)} OK, {len(f)} FAIL')
raise SystemExit(1 if f else 0)
