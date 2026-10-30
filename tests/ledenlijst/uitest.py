# Ledenlijst in de echte app (Chromium), tegen de nep-Supabase van tests/export/browser.
#   node tests/export/browser/build.mjs && python3 tests/ledenlijst/uitest.py
import subprocess, time, os, json
from playwright.sync_api import sync_playwright

HIER = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(HIER, '..', 'export', 'browser', 'web')
srv = subprocess.Popen(['python3', os.path.join(HIER, '..', 'spa_server.py'), '8772', WEB], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
BASE = 'http://localhost:8772/index.html'
res = []
def ok(n, c, d=''):
    res.append(bool(c)); print(('OK  ' if c else 'FAIL'), n, d, flush=True)

HIDE = "document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='div[style*=\"z-index: 2000\"]{display:none !important}';document.head.appendChild(s)})"

LEDEN = [
  {'id': 'u2', 'naam': 'Anna de Vries', 'rol': 'member', 'member_type': 'zzp', 'avatar_path': None, 'bio': 'Zelfstandig fondsenwerver voor cultuur. ' * 12,
   'organisatie': 'Eigen bureau', 'functie': 'Fondsenwerver', 'website': 'https://www.annadevries.nl', 'email': 'anna@voorbeeld.nl'},
  {'id': 'u3', 'naam': 'Bram Jansen', 'rol': 'member', 'member_type': 'org', 'avatar_path': None, 'bio': None,
   'organisatie': 'Stichting Buurt', 'functie': None, 'website': 'javascript:alert(1)', 'email': None},
]

INIT = """
(() => {
  const LEDEN = %s;
  window.__RPCLOG = [];
  window.__RPC = async (naam, args) => {
    window.__RPCLOG.push({ naam, args });
    if (naam === 'ledenlijst') return { data: LEDEN, error: null };
    if (naam === 'zet_mijn_ledengegevens') {
      const p = (window.__DBL || {}).profiles;
      const rij = p && p.find((r) => r.id === 'u1');
      let site = args.p_website;
      if (site && !/^https?:\\/\\//i.test(site)) site = 'https://' + site;
      if (rij) Object.assign(rij, { website: site, profiel_zichtbaar: args.p_profiel_zichtbaar, email_zichtbaar: args.p_email_zichtbaar });
      return { data: null, error: null };
    }
    return { data: null, error: null };
  };
  let seed;
  Object.defineProperty(window, '__SEED', {
    configurable: true,
    get: () => seed,
    set: (v) => { v.tables.profile_onboarding = [{ user_id: 'u1', organisatie: 'Stichting Buurtkracht', functie: 'Directeur', waar_naar_op_zoek: null, doel: 'leren', overgeslagen: false }]; seed = v; },
  });
})();
""" % json.dumps(LEDEN)

try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        for label, vp in [('desktop', {'width': 1280, 'height': 900}), ('mobiel', {'width': 375, 'height': 812})]:
            # lid
            ctx = b.new_context(viewport=vp); pg = ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.add_init_script(HIDE); pg.add_init_script(INIT)
            pg.goto(f'{BASE}?tier=pro#/netwerk'); pg.wait_for_timeout(1800)
            tag = f'{label}/lid'
            ok(f'{tag}: ledenlijst getoond', pg.locator('[data-testid=ledenlijst]').count() == 1)
            ok(f'{tag}: 2 kaarten', pg.locator('[data-testid=lid-kaart]').count() == 2)
            t = pg.inner_text('[data-testid=ledenlijst]')
            ok(f'{tag}: naam, functie · organisatie', 'Anna de Vries' in t and 'Fondsenwerver · Eigen bureau' in t)
            ok(f'{tag}: e-mail alleen als meegegeven', 'anna@voorbeeld.nl' in t)
            ok(f'{tag}: lange bio ingekort met Lees meer', 'Lees meer' in t)
            ok(f'{tag}: website als link', pg.locator('[data-testid=ledenlijst] a[href="https://www.annadevries.nl"]').count() == 1)
            ok(f'{tag}: javascript-link niet getoond', pg.locator('[data-testid=ledenlijst] a[href^="javascript"]').count() == 0 and 'javascript' not in t)
            ok(f'{tag}: schakelaar staat uit', pg.locator('[data-testid=profiel-zichtbaar]').get_attribute('aria-checked') == 'false')
            ok(f'{tag}: oproep om zichtbaar te worden', 'Zichtbaar in de ledenlijst' in t)
            g = pg.inner_text('[data-testid=leden-gegevens]')
            ok(f'{tag}: eigen gegevens (organisatie, functie)', 'Stichting Buurtkracht' in g and 'Directeur' in g)
            ok(f'{tag}: e-mail standaard alleen voor u', 'alleen voor u' in g)
            ok(f'{tag}: geen horizontale scroll', pg.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1'))
            if label == 'desktop':
                pg.click('[data-testid=profiel-zichtbaar]'); pg.wait_for_timeout(800)
                ok(f'{tag}: schakelaar aan na klik', pg.locator('[data-testid=profiel-zichtbaar]').get_attribute('aria-checked') == 'true')
                log = pg.evaluate('window.__RPCLOG.filter(x=>x.naam==="zet_mijn_ledengegevens")')
                ok(f'{tag}: schakelaar bewaart via RPC', log and log[-1]['args']['p_profiel_zichtbaar'] is True)
                pg.click('[data-testid=leden-gegevens-bewerken]')
                pg.fill('[data-testid=leden-website]', 'www.mijnsite.nl')
                pg.check('[data-testid=leden-email-zichtbaar]')
                pg.get_by_role('button', name='Opslaan').last.click(); pg.wait_for_timeout(900)
                log = pg.evaluate('window.__RPCLOG.filter(x=>x.naam==="zet_mijn_ledengegevens")')
                a = log[-1]['args']
                ok(f'{tag}: gegevens opgeslagen (website, e-mail aan, zichtbaar blijft aan)', a['p_website'] == 'www.mijnsite.nl' and a['p_email_zichtbaar'] is True and a['p_profiel_zichtbaar'] is True, json.dumps(a))
                g = pg.inner_text('[data-testid=leden-gegevens]')
                ok(f'{tag}: na opslaan website en "zichtbaar voor leden"', 'mijnsite.nl' in g and 'zichtbaar voor leden' in g)
                pg.screenshot(path=os.path.join(HIER, 'ledenlijst_desktop.png'), full_page=True)
            else:
                pg.screenshot(path=os.path.join(HIER, 'ledenlijst_mobiel.png'), full_page=True)
            ok(f'{tag}: geen pageerrors', not errs, '; '.join(errs)[:200])
            ctx.close()

            # bezoeker
            ctx = b.new_context(viewport=vp); pg = ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.add_init_script(HIDE); pg.add_init_script(INIT); pg.add_init_script('window.__GEENSESSIE = true;')
            pg.goto(f'{BASE}?tier=pro#/netwerk'); pg.wait_for_timeout(1500)
            tag = f'{label}/bezoeker'
            ok(f'{tag}: geen ledenlijst', pg.locator('[data-testid=ledenlijst]').count() == 0 and 'Anna de Vries' not in pg.inner_text('body'))
            ok(f'{tag}: geen schakelaar', pg.locator('[role=switch]').count() == 0)
            ok(f'{tag}: ledenlijst-RPC niet aangeroepen', not any(x['naam'] == 'ledenlijst' for x in pg.evaluate('window.__RPCLOG')))
            ok(f'{tag}: geen pageerrors', not errs, '; '.join(errs)[:200])
            ctx.close()
        b.close()
finally:
    srv.terminate()

print(f"\nRESULTAAT: {sum(res)} OK, {len(res) - sum(res)} FAIL")
