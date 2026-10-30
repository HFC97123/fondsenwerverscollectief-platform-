# Browsertest van het ledenprofiel (profielfoto + bio) op de Netwerk-pagina, tegen de echte app met een
# nagebootste Supabase (fakeclient.js).
#   node tests/ledenprofiel/browser/build.mjs && python3 tests/ledenprofiel/browser/uitest.py
import io, os, re, socketserver, http.server, sys, threading
from PIL import Image
from playwright.sync_api import sync_playwright

HIER = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(HIER, 'web')
CHROMIUM = os.environ.get('CHROMIUM', '/opt/pw-browsers/chromium')
UID = '53570dd6-9b3e-4541-b2b1-80c9800c6695'
OBJ = "Object.keys(JSON.parse(localStorage.getItem('fakeprofiel')).objecten)"


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


def img(fmt, size, kleur):
    im = Image.new('RGB', size, kleur)
    for x in range(size[0] // 2, size[0]):  # rechterhelft wit: uitsnede-controle (cover)
        for y in range(size[1]): im.putpixel((x, y), (255, 255, 255))
    b = io.BytesIO(); im.save(b, fmt); return b.getvalue()


JPEG = img('JPEG', (300, 200), (200, 40, 40))
PNG = img('PNG', (200, 300), (40, 40, 200))
WEBP = img('WEBP', (240, 240), (40, 160, 40))


def bestand(naam, mime, data): return {'name': naam, 'mimeType': mime, 'buffer': data}


BIO = ('Werkzaam als zelfstandig fondsenwerver voor culturele en maatschappelijke organisaties.\n\n'
       'Eerder relatiemanager vermogensfondsen bij Stichting Voorbeeld en supervisor binnen een grote goededoelenorganisatie. '
       'Ik doe tijdelijke fondsenwervingsopdrachten, schrijf subsidieaanvragen en adviseer over corporate partnerships. '
       'Thema’s: cultuur, welzijn, jeugd en zorg.\n\n') * 2
BIO = BIO.strip()


def nieuw(b, wie='lid', w=1280, h=900, init=''):
    ctx = b.new_context(viewport={'width': w, 'height': h})
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    if init: pg.add_init_script(init)
    pg.goto(f'{BASE}?wie={wie}#/netwerk'); pg.wait_for_timeout(1200)
    return ctx, pg, errs


def laad(pg):
    pg.reload(); pg.wait_for_timeout(1200)


def log(pg): return pg.evaluate('window.__SBLOG || []')
def knop(pg, naam): return pg.get_by_role('button', name=naam, exact=True)
def kies(pg, f): pg.set_input_files('input[aria-label="Profielfoto kiezen"]', f); pg.wait_for_timeout(400)
def kaart_tekst(pg): return pg.locator('#account').inner_text()
def bio_veld(pg): return pg.get_by_label('Over mij', exact=True)
def objecten(pg): return pg.evaluate(OBJ)


def staat(pg):
    return pg.evaluate("""() => { const a = document.querySelector('#account [data-avatar]'); if (!a) return null;
      const i = a.querySelector('img'); const r = a.getBoundingClientRect(); const cs = getComputedStyle(a);
      return { soort: a.getAttribute('data-avatar'), src: i ? i.getAttribute('src') : null, w: Math.round(r.width), h: Math.round(r.height),
        rad: cs.borderRadius, fit: i ? getComputedStyle(i).objectFit : null, nat: i ? [i.naturalWidth, i.naturalHeight] : null,
        tekst: a.innerText.trim(), overflow: cs.overflow }; }""")


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROMIUM, args=['--no-sandbox'])

    # ============ 1. Lid zonder foto: fallback + knoppen
    ctx, pg, errs = nieuw(b)
    s = staat(pg)
    check('zonder foto: initialen als fallback (SD)', s and s['soort'] == 'initialen' and s['tekst'] == 'SD', s)
    check('zonder foto: geen <img>, dus geen broken image', pg.locator('#account [data-avatar] img').count() == 0)
    check('zonder foto: knop "Foto toevoegen"', knop(pg, 'Foto toevoegen').count() == 1 and knop(pg, 'Foto wijzigen').count() == 0 and knop(pg, 'Foto verwijderen').count() == 0)
    check('zonder foto: bestandstypen en 5 MB alleen als tooltip, geen vaste tekst', 'JPG of PNG' not in kaart_tekst(pg) and knop(pg, 'Foto toevoegen').get_attribute('title') == 'JPG of PNG')
    check('naam en "Lid van het Collectief" nog zichtbaar', 'Sanne de Vries' in kaart_tekst(pg) and 'Lid van het Collectief' in kaart_tekst(pg))
    check('zonder foto: ronde 120px cirkel', s['w'] == 120 and s['h'] == 120 and s['rad'] in ('50%', '60px'), s)
    check('bestand-invoer accepteert alleen jpeg/png/webp', pg.get_attribute('input[aria-label="Profielfoto kiezen"]', 'accept') == 'image/jpeg,image/png,image/webp')
    check('geen nep-bio meer ("Fondsenwerver met hart")', 'Fondsenwerver met hart' not in kaart_tekst(pg))
    check('lege bio: uitleg-hint zonder losse velden', 'waar u werkt en wat u doet' in kaart_tekst(pg) and pg.locator('[data-profiel-bio-leeg]').count() == 1)
    check('geen JS-fouten (start)', not errs, errs)

    # ============ 2. Upload JPEG: eerst voorbeeld, daarna opslaan
    kies(pg, bestand('mijn foto.JPG', 'image/jpeg', JPEG))
    s = staat(pg)
    check('keuze: voorbeeld direct zichtbaar (blob:)', s['soort'] == 'foto' and (s['src'] or '').startswith('blob:'), s)
    check('keuze: nog NIETS geüpload', not [x for x in log(pg) if x['op'] in ('upload', 'rpc')])
    check('keuze: knoppen "Foto opslaan" en "Annuleren"', knop(pg, 'Foto opslaan').count() == 1 and knop(pg, 'Annuleren').count() == 1 and 'Zo ziet uw nieuwe foto eruit' in kaart_tekst(pg))
    knop(pg, 'Annuleren').click(); pg.wait_for_timeout(300)
    check('annuleren: terug naar initialen en nog niets geüpload', staat(pg)['soort'] == 'initialen' and not [x for x in log(pg) if x['op'] == 'upload'])

    kies(pg, bestand('mijn foto.JPG', 'image/jpeg', JPEG))
    knop(pg, 'Foto opslaan').click(); pg.wait_for_timeout(1200)
    l = log(pg)
    up = [x for x in l if x['op'] == 'upload']
    rpc = [x for x in l if x['op'] == 'rpc' and x['naam'] == 'zet_mijn_avatar']
    check('upload: 1 upload naar bucket profile-images', len(up) == 1 and up[0]['bucket'] == 'profile-images', up)
    check('upload: pad <uid>/avatar-<tijd>-<willekeur>.jpg (bestandsnaam niet gebruikt)', up and re.match('^' + UID + r'/avatar-\d{10,}-[a-z0-9]{4,12}\.jpg$', up[0]['pad']), up)
    check('upload: content-type image/jpeg en geen upsert', up and up[0]['type'] == 'image/jpeg' and up[0]['upsert'] is False)
    check('upload: RPC zet_mijn_avatar met hetzelfde pad', len(rpc) == 1 and up and rpc[0]['args']['p_pad'] == up[0]['pad'])
    s = staat(pg)
    check('na opslaan: foto zichtbaar (geen blob meer)', s['soort'] == 'foto' and (s['src'] or '').startswith('data:image/jpeg'), (s['src'] or '')[:30])
    check('na opslaan: img laadt echt (naturalWidth 300x200)', s['nat'] == [300, 200], s['nat'])
    check('na opslaan: object-fit cover, 120x120, rond', s['fit'] == 'cover' and s['w'] == 120 and s['h'] == 120 and s['rad'] in ('50%', '60px') and s['overflow'] == 'hidden', s)
    check('na opslaan: melding en knoppen wijzigen/verwijderen', 'Uw foto is opgeslagen' in kaart_tekst(pg) and knop(pg, 'Foto wijzigen').count() == 1 and knop(pg, 'Foto verwijderen').count() == 1 and knop(pg, 'Foto toevoegen').count() == 0)
    check('na opslaan: initialen niet meer zichtbaar', 'SD' not in s['tekst'])
    first_pad = up[0]['pad']

    # ============ 3. Opnieuw laden: foto blijft
    laad(pg)
    s = staat(pg)
    check('na herladen: dezelfde foto terug op het eigen profiel', s['soort'] == 'foto' and (s['src'] or '').startswith('data:image/jpeg') and s['nat'] == [300, 200], s)
    check('na herladen: nog maar 1 foto in de opslag', len(objecten(pg)) == 1)

    # ============ 4. Wijzigen (vervangen) met PNG
    pg.evaluate('window.__SBLOG = []')
    knop(pg, 'Foto wijzigen').click()
    kies(pg, bestand('nieuw.png', 'image/png', PNG))
    check('wijzigen: voorbeeld toont de nieuwe foto, oude nog niet weg', staat(pg)['src'].startswith('blob:') and first_pad in objecten(pg))
    knop(pg, 'Foto opslaan').click(); pg.wait_for_timeout(1200)
    l = log(pg)
    up = [x for x in l if x['op'] == 'upload']
    rm = [x for x in l if x['op'] == 'remove']
    check('wijzigen: nieuw pad (.png), niet hetzelfde als eerst (geen overschrijven)', len(up) == 1 and up[0]['pad'] != first_pad and up[0]['pad'].endswith('.png'), up)
    check('wijzigen: oude foto daarna opgeruimd', len(rm) == 1 and rm[0]['paden'] == [first_pad], rm)
    check('wijzigen: volgorde upload -> rpc -> remove', [x['op'] for x in l if x['op'] in ('upload', 'rpc', 'remove')] == ['upload', 'rpc', 'remove'])
    s = staat(pg)
    check('wijzigen: nieuwe foto direct zichtbaar (PNG 200x300)', s['src'].startswith('data:image/png') and s['nat'] == [200, 300], s)
    check('wijzigen: portretfoto ook rond en 120x120 (cover)', s['w'] == 120 and s['h'] == 120 and s['fit'] == 'cover')
    check('wijzigen: opslag bevat alleen de nieuwe foto', objecten(pg) == [up[0]['pad']])
    laad(pg)
    check('wijzigen: na herladen nog steeds de nieuwe foto', staat(pg)['src'].startswith('data:image/png'))

    # ============ 5. Verwijderen
    pg.evaluate('window.__SBLOG = []')
    knop(pg, 'Foto verwijderen').click(); pg.wait_for_timeout(1000)
    l = log(pg)
    check('verwijderen: RPC met null en daarna bestand verwijderd', [x['op'] for x in l if x['op'] in ('rpc', 'remove')] == ['rpc', 'remove'] and [x for x in l if x['op'] == 'rpc'][0]['args']['p_pad'] is None)
    s = staat(pg)
    check('verwijderen: fallback (initialen) verschijnt, geen img', s['soort'] == 'initialen' and s['tekst'] == 'SD' and pg.locator('#account [data-avatar] img').count() == 0, s)
    check('verwijderen: knop "Foto toevoegen" terug, melding getoond', knop(pg, 'Foto toevoegen').count() == 1 and 'Uw foto is verwijderd' in kaart_tekst(pg))
    check('verwijderen: opslag leeg', objecten(pg) == [])
    laad(pg)
    check('verwijderen: na herladen blijft fallback', staat(pg)['soort'] == 'initialen')

    # ============ 6. WebP + afwijzingen
    kies(pg, bestand('x.webp', 'image/webp', WEBP))
    knop(pg, 'Foto opslaan').click(); pg.wait_for_timeout(1000)
    s = staat(pg)
    check('WebP werkt', s['soort'] == 'foto' and s['src'].startswith('data:image/webp') and s['nat'] == [240, 240], s)
    pg.evaluate('window.__SBLOG = []')
    huidige = s['src']
    afwijzingen = [
        ('GIF', bestand('a.gif', 'image/gif', b'GIF89a' + b'0' * 50), 'bestandstype'),
        ('SVG', bestand('a.svg', 'image/svg+xml', b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'bestandstype'),
        ('PDF', bestand('a.pdf', 'application/pdf', b'%PDF-1.4 ' + b'0' * 50), 'bestandstype'),
        ('PDF als .jpg', bestand('echt.jpg', 'application/pdf', b'%PDF-1.4 ' + b'0' * 50), 'bestandstype'),
        ('tekst', bestand('a.txt', 'text/plain', b'hallo'), 'bestandstype'),
        ('te groot (5 MB + 1)', bestand('groot.png', 'image/png', b'\x89PNG' + b'0' * (5 * 1024 * 1024 + 1 - 4)), 'te groot'),
        ('leeg', bestand('leeg.png', 'image/png', b''), 'leeg'),
    ]
    for naam, f, woord in afwijzingen:
        kies(pg, f)
        alert = pg.locator('#account [role=alert]')
        check(f'afwijzing {naam}: duidelijke foutmelding ({woord})', alert.count() == 1 and woord in alert.inner_text(), alert.all_inner_texts())
        check(f'afwijzing {naam}: geen voorbeeld/opslaan-knop en huidige foto ongewijzigd', knop(pg, 'Foto opslaan').count() == 0 and staat(pg)['src'] == huidige)
    check('afwijzingen: niets geüpload en geen RPC', not [x for x in log(pg) if x['op'] in ('upload', 'rpc')], log(pg))
    kies(pg, bestand('ok.png', 'image/png', PNG))
    check('na een afwijzing: geldige foto werkt weer en de fout verdwijnt', knop(pg, 'Foto opslaan').count() == 1 and pg.locator('#account [role=alert]').count() == 0)
    knop(pg, 'Annuleren').click()
    kies(pg, bestand('grens.png', 'image/png', b'\x89PNG' + b'0' * (5 * 1024 * 1024 - 4)))
    check('precies 5 MB wordt geaccepteerd (voorbeeld verschijnt)', knop(pg, 'Foto opslaan').count() == 1)
    knop(pg, 'Annuleren').click()
    ctx.close()

    # ============ 7. Mislukte upload / RPC
    ctx, pg, errs = nieuw(b, init="window.__FAIL = 'upload';")
    kies(pg, bestand('a.jpg', 'image/jpeg', JPEG)); knop(pg, 'Foto opslaan').click(); pg.wait_for_timeout(900)
    check('upload mislukt: foutmelding getoond', 'De foto kon niet worden opgeslagen' in kaart_tekst(pg) and pg.locator('#account [role=alert]').count() == 1)
    knop(pg, 'Annuleren').click(); pg.wait_for_timeout(300)
    check('upload mislukt: profiel blijft zonder foto, geen RPC', staat(pg)['soort'] == 'initialen' and not [x for x in log(pg) if x['op'] == 'rpc'])
    ctx.close()
    ctx, pg, errs = nieuw(b, init="window.__FAIL = 'rpc';")
    kies(pg, bestand('a.jpg', 'image/jpeg', JPEG)); knop(pg, 'Foto opslaan').click(); pg.wait_for_timeout(900)
    check('RPC mislukt: foutmelding en geüpload bestand weer opgeruimd', 'De foto kon niet worden opgeslagen' in kaart_tekst(pg) and objecten(pg) == [])
    ctx.close()

    # ============ 8. Onleesbare afbeelding -> fallback, geen broken image
    ctx, pg, errs = nieuw(b)
    kies(pg, bestand('a.jpg', 'image/jpeg', JPEG)); knop(pg, 'Foto opslaan').click(); pg.wait_for_timeout(900)
    pg.add_init_script("window.__KAPOT = true;"); laad(pg)
    s = staat(pg)
    check('onleesbare afbeelding: terug naar initialen, geen kapotte img', s['soort'] == 'initialen' and s['tekst'] == 'SD' and pg.locator('#account [data-avatar] img').count() == 0, s)
    check('onleesbare afbeelding: pagina werkt gewoon (knop wijzigen aanwezig)', knop(pg, 'Foto wijzigen').count() == 1)
    ctx.close()

    # ============ 9. Beschrijving (bio)
    ctx, pg, errs = nieuw(b)
    knop(pg, 'Beschrijving toevoegen').click()
    check('bio: tekstveld met teller en limiet 2000', bio_veld(pg).get_attribute('maxlength') == '2000' and '0 / 2000 tekens' in kaart_tekst(pg))
    bio_veld(pg).fill(BIO)
    check('bio: teller telt mee', f'{len(BIO)} / 2000 tekens' in kaart_tekst(pg) and len(BIO) > 500, len(BIO))
    knop(pg, 'Opslaan').click(); pg.wait_for_timeout(900)
    bio_el = pg.locator('[data-profiel-bio]')
    check('bio: opgeslagen en weergegeven (volledige tekst)', bio_el.count() == 1 and bio_el.inner_text().replace('\r', '') == BIO, bio_el.inner_text()[:80] if bio_el.count() else '')
    check('bio: alinea-wit behouden (pre-line)', pg.evaluate("getComputedStyle(document.querySelector('[data-profiel-bio]')).whiteSpace") == 'pre-line' and '\n\n' in bio_el.inner_text())
    check('bio: melding en knop "Beschrijving bewerken"', 'Uw beschrijving is opgeslagen' in kaart_tekst(pg) and knop(pg, 'Beschrijving bewerken').count() == 1)
    rb = [x for x in log(pg) if x['op'] == 'rpc' and x['naam'] == 'zet_mijn_bio']
    check('bio: RPC zet_mijn_bio zonder id-parameter', len(rb) == 1 and list(rb[0]['args'].keys()) == ['p_bio'])
    laad(pg)
    check('bio: na herladen nog aanwezig', pg.locator('[data-profiel-bio]').inner_text().replace('\r', '') == BIO)
    knop(pg, 'Beschrijving bewerken').click()
    check('bio bewerken: bestaande tekst staat in het veld', bio_veld(pg).input_value() == BIO)
    bio_veld(pg).fill('Iets anders')
    knop(pg, 'Annuleren').click()
    check('bio annuleren: oude tekst blijft', pg.locator('[data-profiel-bio]').inner_text().replace('\r', '') == BIO)
    knop(pg, 'Beschrijving bewerken').click()
    bio_veld(pg).fill('x' * 2100)
    knop(pg, 'Opslaan').click(); pg.wait_for_timeout(500)
    check('bio te lang: foutmelding, niet opgeslagen', pg.locator('#account [role=alert]').count() == 1 and 'maximaal 2000' in pg.locator('#account [role=alert]').inner_text())
    knop(pg, 'Annuleren').click()
    knop(pg, 'Beschrijving bewerken').click()
    bio_veld(pg).fill('y' * 2000)
    knop(pg, 'Opslaan').click(); pg.wait_for_timeout(700)
    check('bio van precies 2000 tekens wordt opgeslagen', pg.locator('[data-profiel-bio]').count() == 1 and len(pg.locator('[data-profiel-bio]').inner_text()) == 2000)
    knop(pg, 'Beschrijving bewerken').click()
    bio_veld(pg).fill('   ')
    knop(pg, 'Opslaan').click(); pg.wait_for_timeout(700)
    check('bio leegmaken: hint terug, geen lege alinea', pg.locator('[data-profiel-bio]').count() == 0 and pg.locator('[data-profiel-bio-leeg]').count() == 1 and knop(pg, 'Beschrijving toevoegen').count() == 1)
    knop(pg, 'Beschrijving toevoegen').click()
    bio_veld(pg).fill('<b>vet</b> <script>window.__X=1</script> & co')
    knop(pg, 'Opslaan').click(); pg.wait_for_timeout(700)
    check('bio: HTML wordt als platte tekst getoond (geen injectie)', pg.locator('[data-profiel-bio]').inner_text() == '<b>vet</b> <script>window.__X=1</script> & co' and pg.evaluate('window.__X') is None and pg.locator('[data-profiel-bio] b').count() == 0)
    pg.evaluate("window.__FAIL = 'bio'")
    knop(pg, 'Beschrijving bewerken').click(); bio_veld(pg).fill('nieuw'); knop(pg, 'Opslaan').click(); pg.wait_for_timeout(500)
    check('bio opslaan mislukt: foutmelding, tekst blijft in het veld', 'De beschrijving kon niet worden opgeslagen' in kaart_tekst(pg) and bio_veld(pg).input_value() == 'nieuw')
    check('geen JS-fouten (bio)', not errs, errs)
    ctx.close()

    # ============ 10. Rechten in de UI: wachtend lid en bezoeker
    ctx, pg, errs = nieuw(b, wie='wacht')
    check('niet-goedgekeurd lid: kaart zichtbaar maar zonder foto-/bio-knoppen', pg.locator('#account [data-avatar]').count() == 1 and knop(pg, 'Foto toevoegen').count() == 0 and pg.locator('input[type=file]').count() == 0 and knop(pg, 'Beschrijving toevoegen').count() == 0)
    check('niet-goedgekeurd lid: uitleg dat het na goedkeuring kan', 'Zodra uw lidmaatschap is goedgekeurd' in kaart_tekst(pg) and staat(pg)['tekst'] == 'SD')
    ctx.close()
    ctx, pg, errs = nieuw(b, wie='bezoeker')
    check('bezoeker: geen profielkaart, geen bestand-invoer, geen foto-knoppen', pg.locator('#account [data-avatar]').count() == 0 and pg.locator('input[type=file]').count() == 0 and knop(pg, 'Foto toevoegen').count() == 0)
    check('bezoeker: geen storage- of RPC-verkeer voor profielen', not [x for x in log(pg) if x['op'] in ('upload', 'rpc', 'signed')])
    check('bezoeker: geen JS-fouten', not errs, errs)
    ctx.close()

    # ============ 11. Weergave desktop/mobiel + regressie + screenshots
    for naam, w, h in (('desktop', 1280, 1000), ('tablet', 820, 1000), ('mobiel', 390, 900), ('mobiel-klein', 320, 800)):
        ctx, pg, errs = nieuw(b, w=w, h=h)
        kies(pg, bestand('a.jpg', 'image/jpeg', JPEG)); knop(pg, 'Foto opslaan').click(); pg.wait_for_timeout(800)
        knop(pg, 'Beschrijving toevoegen').click(); bio_veld(pg).fill(BIO); knop(pg, 'Opslaan').click(); pg.wait_for_timeout(700)
        m = pg.evaluate("""() => { const k = document.querySelector('#account > div'); const r = k.getBoundingClientRect();
          const knoppen = [...k.querySelectorAll('button')].map(b => { const x = b.getBoundingClientRect(); return [x.left, x.right]; });
          return { kr: r.right, kl: r.left, knoppen, scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth }; }""")
        s = staat(pg)
        check(f'{naam}: foto 120x120 rond met cover', s['w'] == 120 and s['h'] == 120 and s['fit'] == 'cover' and s['soort'] == 'foto', s)
        check(f'{naam}: profielkaart en knoppen binnen het scherm', m['kr'] <= w + 0.5 and m['kl'] >= -0.5 and all(a >= -0.5 and bb <= w + 0.5 for a, bb in m['knoppen']), m)
        if w >= 360:
            check(f'{naam}: geen horizontale scroll', m['scrollW'] <= m['clientW'], m)
        t = pg.inner_text('body')
        check(f'{naam}: overige profielkaartdelen en pagina intact', 'Mijn opgeslagen artikelen' in t and 'Mijn activiteiten' in t and 'Uitloggen' in t and 'Praktijkgidsen' in t)
        check(f'{naam}: bio volledig zichtbaar', pg.locator('[data-profiel-bio]').inner_text().replace('\r', '') == BIO)
        check(f'{naam}: geen JS-fouten', not errs, errs)
        pg.locator('#account').screenshot(path=os.path.join(HIER, f'profiel-{naam}.png'))
        ctx.close()
    b.close()

print(f'\nRESULTAAT: {ok} OK, {fail} FAIL')
sys.exit(1 if fail else 0)
