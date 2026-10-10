# Echte app in Chromium (vereist: node tests/export/browser/build.mjs).
import subprocess, time, sys, os
from playwright.sync_api import sync_playwright
HIER = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(HIER, '..', 'export', 'browser', 'web')
srv = subprocess.Popen(['python3', '-m', 'http.server', '8771', '-d', WEB], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
BASE = 'http://localhost:8771/index.html'
res = []
def ok(n, c, d=''):
    res.append(bool(c)); print(('OK  ' if c else 'FAIL'), n, d, flush=True)

HIDE = "document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='div[style*=\"z-index: 2000\"]{display:none !important}';document.head.appendChild(s)})"
VERBODEN = ['Leden van het Collectief', 'Zoek op naam, expertise of regio', 'zichtbaar voor andere leden', 'Wilt u zichtbaar zijn', 'Nog geen leden zichtbaar', 'Dit bent u']
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
        for label, vp in [('desktop', {'width': 1280, 'height': 900}), ('mobiel', {'width': 375, 'height': 812})]:
            for anon in (False, True):
                ctx = b.new_context(viewport=vp); pg = ctx.new_page(); errs = []
                pg.on('pageerror', lambda e: errs.append(str(e)))
                pg.add_init_script(HIDE)
                if anon: pg.add_init_script('window.__GEENSESSIE = true;')
                pg.goto(f'{BASE}?tier=pro#/netwerk'); pg.wait_for_timeout(1500)
                tekst = pg.inner_text('body'); tag = f'{label}/{"bezoeker" if anon else "lid"}'
                ok(f'{tag}: /netwerk laadt', 'Collectief' in tekst or 'Ledengedeelte' in tekst or len(tekst) > 200)
                for v in VERBODEN:
                    ok(f'{tag}: geen "{v}"', v not in tekst)
                ok(f'{tag}: geen zoekveld voor leden', pg.locator('input[placeholder*="expertise"]').count() == 0)
                ok(f'{tag}: geen role=switch (zichtbaarheidsschakelaar)', pg.locator('[role="switch"]').count() == 0)
                ok(f'{tag}: geen horizontale scroll', pg.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'))
                ok(f'{tag}: geen pageerrors', not errs, '; '.join(errs)[:200])
                if not anon:
                    ok(f'{tag}: eigen profiel zichtbaar (Over mij + Uitloggen)', 'over mij' in tekst.lower() and 'Uitloggen' in tekst)
                    ok(f'{tag}: overige community aanwezig (Praktijkgidsen, Vraag & antwoord)', 'Praktijkgidsen' in tekst and ('Vraag' in tekst))
                    pg.screenshot(path=os.path.join(HIER, f'netwerk_{label}.png'), full_page=True)
                if label == 'mobiel' and not anon:
                    # mobiel menu staat in de Header van de homepage
                    pg.goto(f'{BASE}?tier=pro#/'); pg.wait_for_timeout(1200)
                    pg.locator('[aria-label="Menu"]').click(); pg.wait_for_timeout(300)
                    m = pg.inner_text('body')
                    ok(f'{tag}: mobiel menu zonder ledenoverzicht', not any(w in m.lower() for w in ['ledenlijst', 'alle leden', 'smoelenboek', 'communityleden']))
                ctx.close()
            # oude/niet-bestaande leden-URL's: geen halve lege pagina
            for pad in ['/leden', '/members', '/netwerk/leden']:
                ctx = b.new_context(viewport=vp); pg = ctx.new_page()
                pg.add_init_script(HIDE)
                pg.goto(f'{BASE}?tier=pro#{pad}'); pg.wait_for_timeout(1000)
                t = pg.inner_text('body')
                ok(f'{label}: {pad} toont geen ledenlijst', not any(v in t for v in VERBODEN))
                ctx.close()
        b.close()
finally:
    srv.terminate()
print(f'\nRESULTAAT: {sum(res)} OK, {len(res)-sum(res)} FAIL'); sys.exit(0 if all(res) else 1)
