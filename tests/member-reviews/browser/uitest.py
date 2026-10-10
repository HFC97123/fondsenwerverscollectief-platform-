# Layouttest ledenreviews: desktop, tablet, mobiel. Draait tegen de gebouwde web/-map.
#   node tests/member-reviews/browser/build.mjs && python3 tests/member-reviews/browser/uitest.py
import http.server, json, os, socketserver, sys, threading
from playwright.sync_api import sync_playwright

HIER = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(HIER, 'web')
CHROMIUM = os.environ.get('CHROMIUM', '/opt/pw-browsers/chromium')

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=WEB, **k)
    def log_message(self, *a): pass

srv = socketserver.TCPServer(('127.0.0.1', 0), H)
port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()

ok = fail = 0
def check(naam, cond, extra=''):
    global ok, fail
    if cond: ok += 1
    else: fail += 1; print('FAIL:', naam, extra)

def rij(rating=5, tekst=None, naam=None, functie=None):
    return {'rating': rating, 'review_text': tekst, 'display_name': naam, 'display_role': functie}

LANG = 'Een heel lang citaat dat over meerdere regels loopt en toch netjes binnen de kaart moet blijven staan zonder te overlopen. ' * 2
SCEN = {
    'alleen-ratings': [rij() for _ in range(5)],
    'gemengd': [rij(5, 'Heel fijn platform.', 'Sanne de Vries', 'Fondsenwerver'), rij(), rij(4.5, LANG, 'Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'Functie'), rij(), rij()],
    'zeven-uit-rpc': [rij() for _ in range(7)],
    'leeg': [],
}
MATEN = {'desktop': (1280, 900), 'laptop-klein': (1000, 800), 'tablet': (820, 1000), 'mobiel': (390, 800), 'mobiel-klein': (320, 700)}

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROMIUM, args=['--no-sandbox'])
    for sn, data in SCEN.items():
        for mn, (w, h) in MATEN.items():
            pg = b.new_page(viewport={'width': w, 'height': h})
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.add_init_script(f'window.__REVIEWS = {json.dumps(data)};')
            pg.goto(f'http://127.0.0.1:{port}/index.html')
            pg.wait_for_timeout(300)
            n = pg.locator('li').count()
            tag = f'{sn}/{mn}'
            check(f'{tag}: aantal kaarten', n == min(len(data), 5), n)
            check(f'{tag}: geen JS-fouten', not errs, errs)
            check(f'{tag}: geen horizontale overflow', pg.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth'))
            if n:
                kaarten = pg.evaluate("[...document.querySelectorAll('li')].map(e=>{const r=e.getBoundingClientRect();return [r.left,r.right,r.top,r.width]})")
                check(f'{tag}: kaarten binnen scherm', all(k[0] >= -0.5 and k[1] <= w + 0.5 for k in kaarten), kaarten)
                rijen = sorted({round(k[2]) for k in kaarten})
                if sn == 'alleen-ratings':
                    verw = {'desktop': 1, 'laptop-klein': 2, 'tablet': 2, 'mobiel': 5, 'mobiel-klein': 5}[mn]
                    check(f'{tag}: rijen = {verw}', len(rijen) == verw, rijen)
                    if mn in ('desktop', 'tablet'):
                        check(f'{tag}: alle kaarten even breed', len({round(k[3]) for k in kaarten}) == 1, kaarten)
                tekst = pg.inner_text('body')
                check(f'{tag}: standaardnaam zonder naam', ('Lid van het Collectief' in tekst) == (any(not (r['display_name']) for r in data[:5])))
                check(f'{tag}: sterren aanwezig', pg.locator('li [aria-label^="Waardering"]').count() == n)
            else:
                check(f'{tag}: niets gerenderd', pg.inner_html('#root > div').strip() == '')
            if sn == 'gemengd' and mn == 'desktop':
                t = pg.inner_text('body')
                check('rating 4,5 met komma', '4,5' in t and '5,0' in t, t[:200])
                check('citaat getoond', 'Heel fijn platform.' in t)
                pg.screenshot(path=os.path.join(HIER, 'gemengd-desktop.png'))
            if sn == 'alleen-ratings':
                pg.screenshot(path=os.path.join(HIER, f'alleen-ratings-{mn}.png'))
            if sn == 'zeven-uit-rpc' and mn == 'desktop':
                check('RPC aangeroepen met limiet 5', pg.evaluate('window.__RPC') == {'naam': 'publieke_ledenreviews', 'args': {'p_limit': 5}}, pg.evaluate('window.__RPC'))
            pg.close()
    # fout in RPC: niets tonen
    pg = b.new_page(viewport={'width': 1280, 'height': 900})
    pg.add_init_script("window.__REVIEWS = 'fout';")
    pg.goto(f'http://127.0.0.1:{port}/index.html'); pg.wait_for_timeout(300)
    check('RPC-fout: niets gerenderd', pg.locator('li').count() == 0)
    b.close()

print(f'\nRESULTAAT: {ok} OK, {fail} FAIL')
sys.exit(1 if fail else 0)
