# Browsertest van de statistiektegel "gemiddelde waardering door leden" op de homepage,
# tegen de echte app met een nagebootste Supabase (fakeclient.js).
#   node tests/member-reviews/browser/build.mjs && python3 tests/member-reviews/browser/uitest.py
import os, socketserver, http.server, sys, threading
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
BASE = f'http://127.0.0.1:{port}/index.html'

ok = fail = 0
def check(naam, cond, extra=''):
    global ok, fail
    if cond: ok += 1
    else: fail += 1; print('FAIL:', naam, extra)

L_FONDSEN = 'fondsen en regelingen in de database'
L_LEDEN = 'fondsenwervers aangesloten'
L_VIDEO = "video's in de bibliotheek"
L_WAARD = 'gemiddelde waardering door leden'

def rpc(waardering):
    return {'publieke_ledenwaardering': waardering, 'publieke_leden_telling': 31,
            'publieke_fondsen_telling': {'funders_totaal': 4000, 'regelingen_totaal': 693}}

W = lambda g, a: [{'gemiddelde': g, 'aantal': a}]
SCEN = [
    ('huidig 5,0 (31 ratings)', W('5.0000000000000000', 31), '5,0'),
    ('5,0 / 5,0 / 4,0 -> 4,7', W('4.6666666666666667', 3), '4,7'),
    ('4,84 -> 4,8', W('4.8400000000000000', 25), '4,8'),
    ('4,85 -> 4,9', W('4.8500000000000000', 20), '4,9'),
    ('4,3', W('4.2951', 10), '4,3'),
    ('5,0 / null / 4,0 (DB negeert null) -> 4,5', W('4.5', 2), '4,5'),
    ('gemiddelde als getal', W(4.2, 5), '4,2'),
    ('geen ratings (NULL, 0)', W(None, 0), '—'),
    ('lege uitkomst []', [], '—'),
    ('lege string', W('', 0), '—'),
    ('0 mag nooit', W(0, 0), '—'),
    ('onzin (NaN-tekst)', W('abc', 3), '—'),
    ('buiten bereik (7)', W(7, 3), '—'),
    ('RPC-fout', 'fout', '—'),
    ('RPC ontbreekt (null)', None, '—'),
]
MATEN = {'desktop': (1280, 900), 'laptop-klein': (1000, 800), 'tablet': (820, 1000), 'mobiel': (390, 800), 'mobiel-klein': (320, 700)}

JS_TILES = """([lf, ll, lv, lw]) => {
  const vind = (l) => [...document.querySelectorAll('div')].find((d) => d.children.length === 0 && d.textContent.trim() === l);
  const out = {};
  [['fondsen', lf], ['leden', ll], ['video', lv], ['waard', lw]].forEach(([k, l]) => {
    const lab = vind(l); if (!lab) { out[k] = null; return; }
    const tile = lab.parentElement, big = tile.firstElementChild, r = tile.getBoundingClientRect(), cs = getComputedStyle(big), ts = getComputedStyle(tile);
    out[k] = { tekst: big.textContent.trim(), top: r.top + scrollY, left: r.left, right: r.right, hoogte: r.height, breedte: r.width,
      fs: cs.fontSize, ff: cs.fontFamily, fw: cs.fontWeight, kleur: cs.color, mb: cs.marginBottom,
      bg: ts.backgroundColor, rad: ts.borderRadius, pad: ts.padding, lab_fs: getComputedStyle(lab).fontSize, lab_kleur: getComputedStyle(lab).color };
  });
  const blok = vind(lf).parentElement.parentElement.parentElement; // groene blok
  const nieuws = document.getElementById('nieuws');
  out.blok_onder = blok.getBoundingClientRect().bottom + scrollY;
  out.nieuws_top = nieuws ? nieuws.getBoundingClientRect().top + scrollY : null;
  out.overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;
  return out;
}"""

def open_home(b, data, w=1280, h=900):
    pg = b.new_page(viewport={'width': w, 'height': h})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script('window.__RPC = ' + __import__('json').dumps(rpc(data)) + ';')
    pg.goto(BASE); pg.wait_for_timeout(900)
    return pg, errs

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROMIUM, args=['--no-sandbox'])

    # --- 1. Gemiddelde, null, geen ratings (desktop)
    for naam, data, verwacht in SCEN:
        pg, errs = open_home(b, data)
        t = pg.evaluate(JS_TILES, [L_FONDSEN, L_LEDEN, L_VIDEO, L_WAARD])
        check(f'{naam}: tegel 4 = {verwacht}', t['waard'] and t['waard']['tekst'] == verwacht, t['waard'])
        body = pg.inner_text('body')
        for slecht in ['NaN', 'undefined', '0,0', 'null']:
            check(f'{naam}: geen "{slecht}" in tegel', slecht not in (t['waard'] or {}).get('tekst', ''))
        check(f'{naam}: geen JS-fouten', not errs, errs)
        check(f'{naam}: precies één BINNENKORT (alleen video-tegel)', body.upper().count('BINNENKORT') == 1 and 'BINNENKORT' in (t['video']['tekst'] + pg.evaluate("(l)=>[...document.querySelectorAll('div')].find(d=>d.children.length===0&&d.textContent.trim()===l).parentElement.innerText", L_VIDEO)).upper())
        pg.close()

    # --- 2. Layout/regressie per schermmaat (huidige situatie)
    for mn, (w, h) in MATEN.items():
        pg, errs = open_home(b, W('5.0000000000000000', 31), w, h)
        t = pg.evaluate(JS_TILES, [L_FONDSEN, L_LEDEN, L_VIDEO, L_WAARD])
        tag = f'huidig/{mn}'
        wa, le, fo, vi = t['waard'], t['leden'], t['fondsen'], t['video']
        check(f'{tag}: vier tegels aanwezig', all([wa, le, fo, vi]), t)
        check(f'{tag}: tegel 4 toont 5,0', wa['tekst'] == '5,0', wa)
        check(f'{tag}: ledenaantal onveranderd (31)', le['tekst'] == '31', le)
        check(f'{tag}: fondsenteller werkt (4.693)', fo['tekst'] == '4.693', fo)
        check(f'{tag}: videotegel ongewijzigd (Binnenkort, geen getal)', 'BINNENKORT' in pg.evaluate("(l)=>[...document.querySelectorAll('div')].find(d=>d.children.length===0&&d.textContent.trim()===l).parentElement.innerText.toUpperCase()", L_VIDEO))
        # zelfde typografie als de andere grote cijfers
        for k in ('fs', 'ff', 'fw', 'kleur', 'mb'):
            check(f'{tag}: cijfer {k} gelijk aan tegel 2', wa[k] == le[k] == fo[k], (wa[k], le[k]))
        for k in ('bg', 'rad', 'pad', 'lab_fs', 'lab_kleur'):
            check(f'{tag}: tegel {k} gelijk aan tegel 2', wa[k] == le[k], (wa[k], le[k]))
        check(f'{tag}: cijfer 32px / 700', wa['fs'] == '32px' and wa['fw'] == '700', wa)
        check(f'{tag}: geen horizontale overflow', not t['overflow'])
        # volgorde en rijen
        if mn == 'desktop':
            tops = {round(x['top']) for x in (fo, le, vi, wa)}
            check(f'{tag}: vier tegels naast elkaar', len(tops) == 1, tops)
            check(f'{tag}: volgorde 1-2-3-4', fo['left'] < le['left'] < vi['left'] < wa['left'])
            check(f'{tag}: gelijke tegelhoogte', len({round(x['hoogte']) for x in (fo, le, vi, wa)}) == 1, [x['hoogte'] for x in (fo, le, vi, wa)])
            check(f'{tag}: gelijke tegelbreedte', len({round(x['breedte']) for x in (fo, le, vi, wa)}) == 1)
        if mn == 'mobiel':
            check(f'{tag}: tegels onder elkaar binnen scherm', all(x['left'] >= 0 and x['right'] <= w for x in (fo, le, vi, wa)))
        # geen lege ruimte: groene blok -> nieuws = alleen de bestaande 76px
        gat = t['nieuws_top'] - t['blok_onder']
        check(f'{tag}: geen extra witruimte onder tegels (76px)', abs(gat - 76) <= 1, gat)
        # reviewsectie is weg
        body = pg.inner_text('body')
        check(f'{tag}: titel reviewsectie weg', 'Wat leden van het Collectief vinden' not in body)
        check(f'{tag}: "Lid van het Collectief" weg', 'Lid van het Collectief' not in body)
        check(f'{tag}: geen sterren', '★' not in body and pg.locator('[aria-label^="Waardering"]').count() == 0)
        check(f'{tag}: geen label WAARDERING', pg.evaluate("[...document.querySelectorAll('div')].filter(d=>d.children.length===0&&/^waardering$/i.test(d.textContent.trim())).length") == 0)
        check(f'{tag}: geen reviewkaarten (li met rating)', pg.locator('li').filter(has_text='Waardering').count() == 0)
        check(f'{tag}: geen JS-fouten', not errs, errs)
        pg.screenshot(path=os.path.join(HIER, f'home-{mn}.png'), full_page=False)
        pg.close()

    # --- 3. Eén databasecall en geen oude review-RPC
    pg, errs = open_home(b, W('5.0000000000000000', 31))
    log = pg.evaluate('window.__RPCLOG')
    namen = [x['naam'] for x in log]
    check('publieke_ledenwaardering precies 1x aangeroepen', namen.count('publieke_ledenwaardering') == 1, namen)
    check('publieke_ledenreviews niet meer aangeroepen (geen reviewkaarten)', 'publieke_ledenreviews' not in namen, namen)
    check('geen directe tabelquery op member_reviews', not any('member_reviews' in str(x) for x in log))
    check('RPC zonder argumenten (geen limiet nodig)', next(x for x in log if x['naam'] == 'publieke_ledenwaardering')['args'] is None)
    # wegnavigeren en terug: gecachet, geen tweede call
    pg.evaluate("location.hash = '#/netwerk'"); pg.wait_for_timeout(500)
    pg.evaluate("location.hash = '#/'"); pg.wait_for_timeout(700)
    namen = [x['naam'] for x in pg.evaluate('window.__RPCLOG')]
    check('na navigatie nog steeds 1 call (cache)', namen.count('publieke_ledenwaardering') == 1, namen)
    check('tegel 4 nog steeds 5,0 na navigatie', pg.evaluate(JS_TILES, [L_FONDSEN, L_LEDEN, L_VIDEO, L_WAARD])['waard']['tekst'] == '5,0')
    pg.close()
    b.close()

print(f'\nRESULTAAT: {ok} OK, {fail} FAIL')
sys.exit(1 if fail else 0)
