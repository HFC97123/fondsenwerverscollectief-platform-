# Website en zichtbaarheid op de accountpagina van Subsidie Kompas (nep-Supabase van tests/export/browser).
#   node tests/export/browser/build.mjs && python3 tests/ledenlijst/uitest_account.py
import subprocess, time, os
from playwright.sync_api import sync_playwright

HIER = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(HIER, '..', 'export', 'browser', 'web')
srv = subprocess.Popen(['python3', os.path.join(HIER, '..', 'spa_server.py'), '8773', WEB], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
res = []
def ok(n, c, d=''):
    res.append(bool(c)); print(('OK  ' if c else 'FAIL'), n, d, flush=True)

INIT = """
window.__RPCLOG = [];
window.__RPC = async (naam, args) => {
  window.__RPCLOG.push({ naam, args });
  if (naam === 'zet_mijn_ledengegevens') {
    const rij = ((window.__DBL || {}).profiles || []).find((r) => r.id === 'u1');
    if (rij) Object.assign(rij, { website: args.p_website ? 'https://' + args.p_website.replace(/^https?:\\/\\//, '') : null, profiel_zichtbaar: args.p_profiel_zichtbaar, email_zichtbaar: args.p_email_zichtbaar });
  }
  return { data: null, error: null };
};
"""
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        for label, vp in [('desktop', {'width': 1280, 'height': 900}), ('mobiel', {'width': 375, 'height': 812})]:
            pg = b.new_page(viewport=vp); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.add_init_script(INIT)
            pg.goto('http://localhost:8773/index.html?tier=pro#/kompas/account'); pg.wait_for_timeout(2000)
            ok(f'{label}: websiteveld', pg.locator('input[aria-label=Website]').count() == 1)
            ok(f'{label}: schakelaar zichtbaar in ledenlijst (standaard uit)', pg.locator('[data-testid=account-profiel-zichtbaar]').count() == 1 and not pg.is_checked('[data-testid=account-profiel-zichtbaar]'))
            ok(f'{label}: keuze e-mail zichtbaar (standaard uit)', pg.locator('[data-testid=account-email-zichtbaar]').count() == 1 and not pg.is_checked('[data-testid=account-email-zichtbaar]'))
            # (De bestaande knop 'Informatie over mijn organisatie verwijderen' is op 375px al iets te breed; los daarvan.)
            ok(f'{label}: nieuwe velden passen in beeld', pg.evaluate("[...document.querySelectorAll('input[aria-label=Website],[data-testid=account-profiel-zichtbaar],[data-testid=account-email-zichtbaar]')].every(e=>e.getBoundingClientRect().right<=window.innerWidth+1)"))
            if label == 'desktop':
                pg.fill('input[aria-label=Website]', 'www.aisya.eu')
                pg.check('[data-testid=account-profiel-zichtbaar]')
                pg.get_by_role('button', name='Gegevens bewaren').click(); pg.wait_for_timeout(1000)
                log = [x for x in pg.evaluate('window.__RPCLOG') if x['naam'] == 'zet_mijn_ledengegevens']
                a = log[-1]['args'] if log else {}
                ok(f'{label}: bewaard via RPC', a.get('p_website') == 'www.aisya.eu' and a.get('p_profiel_zichtbaar') is True and a.get('p_email_zichtbaar') is False, str(a))
                ok(f'{label}: melding bewaard', 'Uw gegevens zijn bewaard' in pg.inner_text('body'))
                pg.screenshot(path=os.path.join(HIER, 'account_desktop.png'), full_page=True)
            ok(f'{label}: geen pageerrors', not errs, '; '.join(errs)[:200])
            pg.close()
        b.close()
finally:
    srv.terminate()
print(f"\\nRESULTAAT: {sum(res)} OK, {len(res) - sum(res)} FAIL")
