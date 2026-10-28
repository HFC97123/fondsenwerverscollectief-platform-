# Actieplan, lijst 'Deze week' kort en zonder dubbelingen (oktober 2026): één regel per actie, fondsnaam één keer, dezelfde uitleg één keer
# boven de groep, hoge prioriteit als stip, knoppen achter ⋯. Draait de echte app tegen de nagebootste Supabase.
import subprocess, time, os, json, datetime
from playwright.sync_api import sync_playwright
os.chdir(os.path.dirname(os.path.abspath(__file__)))
PORT = 8795
srv = subprocess.Popen(['python3', os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../spa_server.py'), str(PORT), 'web'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
res = []
def ok(n, c, d=''):
    res.append(c); print(('OK  ' if c else 'FAIL'), n, ('' if c else d), flush=True)
def iso(n): return (datetime.date.today() + datetime.timedelta(days=n)).isoformat()
P1 = '11111111-1111-4111-8111-111111111111'
N = 'Er is nog geen indiendatum bekend. Vraag na of uw project past, wanneer u kunt aanvragen en hoe lang de behandeling duurt.'
F = ["P.W. Janssen's Friesche Stichting", 'Sint Jacobs Godshuis', 'Stichting Aviom']
rows = [dict(id=f'ac000000-0000-4000-8000-00000000000{k}', user_id='u1', program_id=P1, funding_id=None, title=f'Kansrijkheid en indiendatum of vergaderdatum toetsen met {f}', financier_label=f, due_date=iso(4), status='todo', priority='high', notes=N, source='chat', proposed_at='2026-10-20T10:00:00Z', created_at='2026-10-20T10:00:00Z') for k, f in enumerate(F)]
rows.append(dict(id='ac000000-0000-4000-8000-000000000010', user_id='u1', program_id=P1, funding_id=None, title='Contact opnemen met Dokter Izak Wessel Stichting over passendheid, aanvraag en behandeltermijn', financier_label='Dokter Izak Wessel Stichting', due_date=iso(5), status='todo', priority='high', notes=N, source='chat', proposed_at='2026-10-20T10:00:00Z', created_at='2026-10-20T10:00:00Z'))
rows.append(dict(id='ac000000-0000-4000-8000-000000000011', user_id='u1', program_id=P1, funding_id=None, title='Begroting laten controleren', financier_label=None, due_date=iso(6), status='todo', priority='normal', notes='Vóór de eerste aanvraag', source='user', proposed_at=None, created_at='2026-10-20T10:00:00Z'))
PATCH = 'window.__SEED_PATCH=function(seed,h){seed.tables.subsidie_kompas_program_actions=%s;};' % json.dumps(rows)
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        for vp in ({'width': 1280, 'height': 1000}, {'width': 390, 'height': 844}):
            pg = b.new_page(viewport=vp); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='div[style*=\"z-index: 2000\"]{display:none !important}';document.head.appendChild(s)})")
            pg.add_init_script(PATCH)
            pg.goto(f'http://localhost:{PORT}/index.html?tier=pro#/kompas/deadlines'); pg.wait_for_timeout(1500)
            if pg.locator('[data-testid="deadline-popup-later"]').count(): pg.locator('[data-testid="deadline-popup-later"]').first.click(); pg.wait_for_timeout(300)
            pg.get_by_role('tab', name='Actieplan', exact=True).click(); pg.wait_for_timeout(1200)
            g = pg.locator('[data-testid="ap-groep-week"]'); w = vp['width']
            tekst = g.inner_text().replace('\xa0', ' ')
            ok(f'{w}: 1 Deze week toont 5 acties als regels', g.locator('[data-testid="ap-taak"]').count() == 5)
            ok(f'{w}: 2 de fondsnaam staat één keer per regel', all(g.locator('[data-testid="ap-taak"]').nth(k).inner_text().count(f) == 1 for k, f in enumerate(F)), tekst[:400])
            ok(f'{w}: 3 beide vaste voorstellen heten hetzelfde (geen "Contact opnemen" ernaast)', tekst.count('Kansrijkheid en indiendatum en/of vergaderdatum toetsen') == 4 and 'Contact opnemen' not in tekst and ' met Stichting Aviom' not in tekst, tekst[:600])
            ok(f'{w}: 4 dezelfde uitleg staat één keer boven de groep', tekst.count('Er is nog geen indiendatum bekend') == 1 and g.get_by_test_id('ap-gedeelde-notitie').count() == 1 and 'Bij 4 acties' in tekst)
            ok(f'{w}: 5 een eigen notitie blijft bij de eigen regel', 'Vóór de eerste aanvraag' in g.locator('[data-testid="ap-taak"]').filter(has_text='Begroting laten controleren').inner_text())
            ok(f'{w}: 6 hoge prioriteit is een stip, geen woord "Hoog"; normaal toont niets', g.get_by_test_id('ap-prio-hoog').count() == 4 and 'Hoog' not in tekst and 'Normaal' not in tekst)
            ok(f'{w}: 7 geen statuskeuze en geen losse Bewerken/Verwijderen-knoppen in de regel', g.get_by_test_id('ap-status').count() == 0 and g.get_by_test_id('ap-bewerk').count() == 0 and 'voorgesteld door' not in tekst.lower())
            ok(f'{w}: 8 geen horizontale scroll', pg.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'))
            if w == 1280:
                r = g.locator('[data-testid="ap-taak"]').first
                r.get_by_test_id('ap-menu').click(); pg.wait_for_timeout(200)
                ok('9 ⋯ toont herkomst, Bezig, Bewerken en Verwijderen', 'Voorgesteld door Subsidie Kompas' in r.inner_text() and r.get_by_test_id('ap-zet-bezig').count() == 1 and r.get_by_test_id('ap-bewerk').count() == 1 and r.get_by_test_id('ap-verwijder').count() == 1)
                r.get_by_test_id('ap-zet-bezig').click(); pg.wait_for_timeout(500)
                db = lambda i: next((x for x in pg.evaluate('window.__DBL.subsidie_kompas_program_actions') if x['id'] == i), None)
                ok('10 "Ik ben hiermee bezig" zet de status op bezig en toont het label', db(rows[0]['id'])['status'] == 'doing' and g.get_by_test_id('ap-status-bezig').count() == 1)
                g.locator('[data-testid="ap-taak"]').filter(has_text='Sint Jacobs').get_by_test_id('ap-klaar').click(); pg.wait_for_timeout(600)
                ok('11 vinkje zet de actie op klaar', db(rows[1]['id'])['status'] == 'done')
                t = pg.locator('[data-testid="ap-taak"]').filter(has_text='Stichting Aviom')
                t.get_by_test_id('ap-menu').click(); t.get_by_test_id('ap-bewerk').click(); pg.wait_for_timeout(300)
                ok('12 Bewerken opent het formulier', pg.get_by_test_id('ap-titel').count() == 1)
                pg.get_by_role('button', name='Annuleren').first.click(); pg.wait_for_timeout(200)
                t = pg.locator('[data-testid="ap-taak"]').filter(has_text='Begroting laten controleren')
                t.get_by_test_id('ap-menu').click(); t.get_by_test_id('ap-verwijder').click(); t.get_by_test_id('ap-verwijder-ja').click(); pg.wait_for_timeout(600)
                ok('13 Verwijderen (met bevestiging) haalt de actie weg', db(rows[4]['id']) is None and pg.locator('[data-testid="ap-taak"]').filter(has_text='Begroting laten controleren').count() == 0)
            ok(f'{w}: 14 geen pageerrors', not errs, str(errs[:2]))
            pg.close()
        b.close()
finally:
    srv.terminate()
print(f'actieplan-kort: {sum(res)} OK, {len(res) - sum(res)} FAIL')
