# Echte app in Chromium (vereist: node tests/export/browser/build.mjs).
# Controleert lege staten, gevulde staat via beheerrijen, en dat vacatures/nieuws/Kompas blijven werken.
import subprocess, time, sys, os, json, re
from playwright.sync_api import sync_playwright
HIER = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(HIER, '..', 'export', 'browser', 'web')
srv = subprocess.Popen(['python3', __import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)),'../spa_server.py'), '8772', WEB], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
BASE = 'http://localhost:8772/index.html'
res = []
def ok(n, c, d=''):
    res.append(bool(c)); print(('OK  ' if c else 'FAIL'), n, d, flush=True)
HIDE = "document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='div[style*=\"z-index: 2000\"]{display:none !important}';document.head.appendChild(s)})"
DEMO = ['Projectplan sjabloon', 'Wat doet een fondsenwerver eigenlijk', 'Wat we leerden van vijf afgewezen aanvragen', 'Intervisie: lastige casussen bespreken']
LEEG = 'Er is momenteel nog geen content beschikbaar.'
ORIG = open(os.path.join(WEB, 'index.html'), encoding='utf-8').read()
def inject(extra):
    # Voeg extra tabellen (beheerinhoud) toe aan de nep-database.
    assert '})();\n</script>' in ORIG
    return ORIG.replace('})();\n</script>', 'Object.assign(window.__SEED.tables, ' + json.dumps(extra) + ');})();\n</script>', 1)
GEVULD = {
  'videos': [{'id': 'v1', 'title': 'ADMIN-VIDEO Testtitel', 'description': 'beheer', 'duration': '1:00', 'level': 'Beginner', 'url': '', 'status': 'published', 'sort_order': 1}],
  'resources': [{'id': 'r1', 'title': 'ADMIN-TOOL Testtool', 'description': 'beheer', 'type': 'Sjabloon', 'status': 'published'}],
  'sessions': [{'id': 's1', 'title': 'ADMIN-SESSIE Test', 'status': 'published', 'date': '2027-01-01'}],
  'blog_posts': [{'id': 'b1', 'title': 'ADMIN-BLOG Test', 'excerpt': 'beheer', 'status': 'published'}],
}
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium', args=['--no-sandbox'])
        for label, vp in [('desktop', {'width': 1280, 'height': 900}), ('mobiel', {'width': 375, 'height': 812})]:
            for staat, extra in [('leeg', {}), ('gevuld', GEVULD)]:
                ctx = b.new_context(viewport=vp)
                body = inject(extra)
                ctx.route(re.compile(r'index\.html'), lambda r, q=None, body=body: r.fulfill(status=200, content_type='text/html', body=body))
                pg = ctx.new_page(); errs = []
                pg.on('pageerror', lambda e: errs.append(str(e)))
                pg.add_init_script(HIDE)
                tag = f'{label}/{staat}'
                # Ledengedeelte (ingelogd)
                pg.goto(f'{BASE}?tier=pro#/netwerk'); pg.wait_for_timeout(1500)
                t = pg.inner_text('body')
                ok(f'{tag}: /netwerk laadt', len(t) > 200)
                for d in DEMO: ok(f'{tag}: /netwerk geen "{d}"', d not in t)
                if staat == 'leeg':
                    ok(f'{tag}: /netwerk toont lege staat', LEEG in t or 'Er is momenteel nog geen' in t)
                    ok(f'{tag}: /netwerk geen "Mijn opgeslagen artikelen"-voorbeelditems', 'Wat doet een fondsenwerver' not in t)
                else:
                    ok(f'{tag}: beheer-tool zichtbaar', 'ADMIN-TOOL Testtool' in t)
                # Reload: demo komt niet terug
                pg.reload(); pg.wait_for_timeout(1500)
                t2 = pg.inner_text('body')
                for d in DEMO: ok(f'{tag}: na refresh geen "{d}"', d not in t2)
                # Oriëntatiepagina (video's)
                pg.goto(f'{BASE}?tier=pro#/lidmaatschap'); pg.wait_for_timeout(1500)
                t3 = pg.inner_text('body')
                if staat == 'leeg':
                    ok(f'{tag}: video-lege-staat', LEEG in t3, t3[:80].replace('\n', ' '))
                else:
                    ok(f'{tag}: beheer-video zichtbaar', 'ADMIN-VIDEO Testtitel' in t3)
                # Vacatures blijven (code-fallback, onveranderd)
                pg.goto(f'{BASE}?tier=pro#/vacatures'); pg.wait_for_timeout(1200)
                tv = pg.inner_text('body')
                ok(f'{tag}: vacatures tonen items', 'Vacature' in tv and len(tv) > 500, str(len(tv)))
                # Nieuws uit Subsidieland
                pg.goto(f'{BASE}?tier=pro#/actueel'); pg.wait_for_timeout(1200)
                tn = pg.inner_text('body')
                ok(f'{tag}: Nieuws uit Subsidieland toont items', 'ubsidieland' in tn and len(tn) > 500, str(len(tn)))
                # Kompas-marketing onaangeroerd
                pg.goto(f'{BASE}?tier=pro#/hoe-het-werkt'); pg.wait_for_timeout(1200)
                ok(f'{tag}: Kompas hoe-het-werkt laadt', len(pg.inner_text('body')) > 300)
                for pad in ['/netwerk', '/lidmaatschap', '/vacatures', '/actueel']:
                    pg.goto(f'{BASE}?tier=pro#{pad}'); pg.wait_for_timeout(700)
                    ok(f'{tag}: {pad} geen horizontale scroll', pg.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'))
                ok(f'{tag}: geen pageerrors', not errs, '; '.join(errs)[:200])
                if label == 'desktop':
                    pg.goto(f'{BASE}?tier=pro#/netwerk'); pg.wait_for_timeout(1000)
                    pg.screenshot(path=os.path.join(HIER, f'netwerk_{staat}.png'), full_page=True)
                ctx.close()
        b.close()
finally:
    srv.terminate()
print(f'\nRESULTAAT: {sum(res)} OK, {len(res)-sum(res)} FAIL'); sys.exit(0 if all(res) else 1)
