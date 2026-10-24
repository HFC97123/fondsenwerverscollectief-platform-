# Adressen zonder # (src/app/adres.js): alles van Subsidie Kompas onder /subsidie-kompas, oude #/-links sturen door,
# klikken laadt de pagina niet opnieuw, terug-knop en vernieuwen werken, geen pageerrors.
import subprocess, time, os
from playwright.sync_api import sync_playwright
os.chdir(os.path.dirname(os.path.abspath(__file__)))
srv = subprocess.Popen(['python3', os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../spa_server.py'), '8786', 'web'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
ROOT = 'http://localhost:8786'
P1 = '11111111-1111-4111-8111-111111111111'
res = []
def ok(n, c, d=''):
    res.append(c); print(('OK  ' if c else 'FAIL'), n, ('' if c else d), flush=True)
def pad(pg): return pg.evaluate('location.pathname + location.search + location.hash')
def intern(pg): return pg.evaluate('__skAdres.huidigeHash()')
def popupWeg(pg):
    if pg.locator('[data-testid="deadline-popup-later"]').count(): pg.locator('[data-testid="deadline-popup-later"]').click(); pg.wait_for_timeout(300)
os.makedirs('shots', exist_ok=True)
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={'width': 1300, 'height': 900}); pg = ctx.new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))

        pg.goto(f'{ROOT}/index.html?tier=pro#/kompas/deadlines'); pg.wait_for_timeout(1800); popupWeg(pg)
        ok('1 oude link #/kompas/deadlines -> /subsidie-kompas/deadlines (geen # meer)', pad(pg) == '/subsidie-kompas/deadlines', pad(pg))
        ok('1b de Deadlines-pagina staat open', intern(pg) == '#/kompas/deadlines' and pg.locator('[data-testid="deadlines-segmenten"]').count() > 0)

        hrefs = pg.evaluate("[...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href'))")
        ok('2 geen enkele link in de pagina met #/', not any(h.startswith('#/') for h in hrefs), str([h for h in hrefs if h.startswith('#/')][:5]))
        ok('2b links tonen het nieuwe adres', any(h.startswith('/subsidie-kompas/') for h in hrefs), str(hrefs[:8]))

        pg.evaluate('window.__nietHerladen = 1')
        link = pg.locator('a[href="/subsidie-kompas/projecten"]').first
        ok('3 er is een link naar Projecten', link.count() == 1)
        link.click(); pg.wait_for_timeout(1200)
        ok('3b klik: adres /subsidie-kompas/projecten en Projecten open', pad(pg) == '/subsidie-kompas/projecten' and intern(pg) == '#/kompas/projecten', pad(pg))
        ok('3c klik herlaadt de pagina niet', pg.evaluate('window.__nietHerladen') == 1)

        pg.go_back(); pg.wait_for_timeout(1200)
        ok('4 terug-knop: weer Deadlines', pad(pg) == '/subsidie-kompas/deadlines' and pg.locator('[data-testid="deadlines-segmenten"]').count() > 0, pad(pg))
        pg.go_forward(); pg.wait_for_timeout(1200)
        ok('4b vooruit-knop: weer Projecten', pad(pg) == '/subsidie-kompas/projecten' and intern(pg) == '#/kompas/projecten', pad(pg))

        pg.evaluate(f"location.hash = '#/kompas/projecten/{P1}?tab=documenten'"); pg.wait_for_timeout(1500)
        ok('5 code die nog location.hash zet werkt en geeft het nieuwe adres', pad(pg) == f'/subsidie-kompas/projecten/{P1}?tab=documenten', pad(pg))
        ok('5b projectpagina met tab Documenten open', pg.locator('[data-testid="project-detail-naam"]').count() == 1, pg.inner_text('body')[:300])

        pg.reload(); pg.wait_for_timeout(2000); popupWeg(pg)
        ok('6 vernieuwen op een diep adres: zelfde pagina', pad(pg) == f'/subsidie-kompas/projecten/{P1}?tab=documenten' and pg.locator('[data-testid="project-detail-naam"]').count() == 1, pad(pg))

        pg.goto(f'{ROOT}/subsidie-kompas/dashboard'); pg.wait_for_timeout(1800)
        ok('7 direct openen /subsidie-kompas/dashboard', intern(pg) == '#/kompas/dashboard' and pg.locator('h2').count() > 0, pad(pg))

        pg.goto(f'{ROOT}/index.html#/subsidie-kompas'); pg.wait_for_timeout(1500)
        ok('8 oude link #/subsidie-kompas -> /subsidie-kompas (chat)', pad(pg) == '/subsidie-kompas' and intern(pg) == '#/kompas', pad(pg))
        pg.goto(f'{ROOT}/index.html#/hoe-het-werkt'); pg.wait_for_timeout(1500)
        ok('9 Hoe het werkt -> /subsidie-kompas/hoe-het-werkt', pad(pg) == '/subsidie-kompas/hoe-het-werkt', pad(pg))
        pg.goto(f'{ROOT}/index.html#/kompas/faq'); pg.wait_for_timeout(1500)
        ok('9b FAQ -> /subsidie-kompas/faq', pad(pg) == '/subsidie-kompas/faq', pad(pg))
        pg.goto(f'{ROOT}/index.html#/actueel'); pg.wait_for_timeout(1500)
        ok('10 Collectief-pagina zonder subsidie-kompas: /actueel', pad(pg) == '/actueel', pad(pg))
        pg.goto(f'{ROOT}/kompas/deadlines'); pg.wait_for_timeout(1500)
        ok('11 oude padvorm /kompas/deadlines -> /subsidie-kompas/deadlines', pad(pg) == '/subsidie-kompas/deadlines', pad(pg))

        pg.goto(f'{ROOT}/#access_token=abc&type=recovery&refresh_token=x'); pg.wait_for_timeout(300)
        ok('12 Supabase-terugkeer (#access_token) wordt niet omgezet', 'access_token' in pg.evaluate('location.hash') or pad(pg) in ('/', '/wachtwoord-instellen'), pad(pg))

        pg.screenshot(path='shots/adres.png')
        ok('13 geen pageerrors', not errs, str(errs[:3]))
        b.close()
finally:
    srv.terminate()
print(f'adres-browser: {sum(res)} OK, {len(res) - sum(res)} FAIL')
