// Adressen zonder hekje (#).
//
// De app kende al haar pagina's als hashpaden: '#/kompas/deadlines', '#/actueel'. Die interne paden blijven bestaan
// (de routetabel, alle links en alle code gebruiken ze), maar de adresbalk toont nu een gewoon adres:
//
//   intern '#/kompas/deadlines'   ->  fondsenwerverscollectief.nl/subsidie-kompas/deadlines
//   intern '#/kompas'             ->  fondsenwerverscollectief.nl/subsidie-kompas
//   intern '#/hoe-het-werkt'      ->  fondsenwerverscollectief.nl/subsidie-kompas/hoe-het-werkt
//   intern '#/actueel'            ->  fondsenwerverscollectief.nl/actueel
//
// Alles van Subsidie Kompas staat onder /subsidie-kompas; de pagina's van het Collectief niet.
//
// Hoe het werkt:
// - huidigeHash() geeft het interne pad van de huidige pagina (zoals window.location.hash vroeger deed).
// - naar() en vervangAdres() zetten een gewoon adres in de adresbalk.
// - Oude links (#/kompas/...) en code die nog `window.location.hash = '#/...'` doet, blijven werken: zo'n adres
//   wordt meteen omgezet naar het nieuwe adres. Daardoor sturen ook bladwijzers en links in oude mails door.
// - Links met href="#/..." krijgen in de pagina vanzelf het nieuwe adres (rechtsklik > kopiëren en 'openen in nieuw
//   tabblad' tonen dus het goede adres) en een klik wordt in de app afgehandeld, zonder de pagina te herladen.
// - Een Supabase-terugkeer (#access_token=..., #error=...) begint nooit met '#/' en wordt dus niet aangeraakt.

export const SK = '/subsidie-kompas';

const venster = () => (typeof window === 'undefined' ? null : window);

function zonderSlashAchter(p) {
  return p.length > 1 ? p.replace(/\/+$/, '') : p;
}

// Intern pad (zonder '#', zonder query) -> publiek pad.
export function publiekPad(intern) {
  const p = zonderSlashAchter(String(intern || '/'));

  if (p === '/kompas' || p === SK) return SK;
  if (p.startsWith('/kompas/')) return SK + p.slice('/kompas'.length);
  if (p.startsWith(`${SK}/`)) return p;
  if (p === '/hoe-het-werkt' || p.startsWith('/hoe-het-werkt/')) return SK + p;

  return p || '/';
}

// Publiek pad -> intern pad. Kent ook de oude padvorm '/kompas/...'.
export function internPad(publiek) {
  let p = zonderSlashAchter(String(publiek || '/'));

  try {
    p = decodeURI(p);
  } catch (e) {
    // laat het pad zoals het is
  }

  if (p === SK) return '/kompas';
  if (p === `${SK}/hoe-het-werkt` || p.startsWith(`${SK}/hoe-het-werkt/`)) return p.slice(SK.length);
  if (p.startsWith(`${SK}/`)) return `/kompas${p.slice(SK.length)}`;

  return p || '/';
}

// '#/kompas/deadlines?x=1' of '/kompas/deadlines?x=1' -> '/subsidie-kompas/deadlines?x=1'
export function publiekeUrl(hashOfPad) {
  const h = String(hashOfPad || '/').replace(/^#/, '') || '/';
  const i = h.indexOf('?');
  const pad = i === -1 ? h : h.slice(0, i);
  const query = i === -1 ? '' : h.slice(i);

  return publiekPad(pad.startsWith('/') ? pad : `/${pad}`) + (query === '?' ? '' : query);
}

function isOudeRoute(hash) {
  return String(hash || '').startsWith('#/');
}

// Het interne pad van de huidige pagina, als hash: '#/kompas/deadlines?x=1'. Vervangt window.location.hash.
export function huidigeHash(win = venster()) {
  if (!win) return '#/';

  const loc = win.location || {};

  // Nog niet omgezet (oude link of net gezet via window.location.hash): die geldt.
  if (isOudeRoute(loc.hash)) return loc.hash;

  if (typeof loc.pathname !== 'string') return '#/';

  return `#${internPad(loc.pathname)}${loc.search || ''}`;
}

function huidigeUrl(win) {
  return `${win.location.pathname}${win.location.search}${win.location.hash}`;
}

function meld(win) {
  let ev;

  try {
    ev = new HashChangeEvent('hashchange');
  } catch (e) {
    ev = new Event('hashchange');
  }

  win.dispatchEvent(ev);
}

// Naar een andere pagina (nieuwe stap in de geschiedenis). Neemt een intern pad ('/kompas/deadlines' of
// '#/kompas/deadlines'). Geeft false als de pagina al open is.
export function naar(pad, win = venster()) {
  if (!win) return false;

  const doel = publiekeUrl(pad);

  if (doel === huidigeUrl(win)) return false;

  win.history.pushState(null, '', doel);
  meld(win);

  return true;
}

// Zelfde pagina, ander adres (bijv. een tab of gesprek-id), zonder nieuwe stap in de geschiedenis en zonder
// paginawissel-melding.
export function vervangAdres(pad, win = venster()) {
  if (!win) return;

  const doel = publiekeUrl(pad);

  if (doel !== huidigeUrl(win)) {
    win.history.replaceState(win.history.state, '', doel);
  }
}

// Zet een oud adres (#/...) om naar het nieuwe, zonder extra stap in de geschiedenis.
function zetOudAdresOm(win) {
  if (isOudeRoute(win.location.hash)) {
    win.history.replaceState(win.history.state, '', publiekeUrl(win.location.hash));

    return true;
  }

  return false;
}

// Een link in de app? Geeft het interne pad terug, anders null.
function internDoel(a, win) {
  const ruw = a.getAttribute('href');

  if (!ruw) return null;
  if (isOudeRoute(ruw)) return ruw;
  if (!ruw.startsWith('/') || ruw.startsWith('//')) return null;

  const url = new URL(ruw, win.location.origin);
  const pad = url.pathname;

  // Bestanden (video, afbeeldingen, downloads) niet: die laat de browser zelf openen.
  if (/^\/(assets|uploads)\//.test(pad) || /\.[a-z0-9]{2,5}$/i.test(pad)) return null;

  return `#${internPad(pad)}${url.search}`;
}

let gestart = false;

// Eén keer bij het laden, vóór de app start.
export function startAdres(win = venster()) {
  if (!win || gestart) return;

  gestart = true;

  // 1. Oude link (#/kompas/...) of oude padvorm (/kompas/...) -> nieuw adres.
  if (!zetOudAdresOm(win)) {
    const pad = win.location.pathname;

    if (pad === '/kompas' || pad.startsWith('/kompas/') || pad === '/hoe-het-werkt') {
      win.history.replaceState(win.history.state, '', publiekeUrl(`${pad}${win.location.search}`) + win.location.hash);
    }
  }

  // 2. Code die nog window.location.hash = '#/...' zet: omzetten. Deze luisteraar staat als eerste, dus de rest van
  //    de app leest via huidigeHash() al het goede pad.
  win.addEventListener('hashchange', () => {
    zetOudAdresOm(win);
  });

  // 3. Terug/vooruit in de browser: dezelfde melding als een paginawissel.
  win.addEventListener('popstate', () => {
    // Bij een hash-wissel volgt de browser zelf nog met 'hashchange'; dan geen tweede melding.
    if (zetOudAdresOm(win)) return;

    meld(win);
  });

  // 4. Klikken op een interne link: in de app afhandelen, niet herladen.
  win.document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;

    if (!a || a.hasAttribute('download')) return;

    const target = a.getAttribute('target');

    if (target && target !== '_self') return;

    const doel = internDoel(a, win);

    if (!doel) return;

    e.preventDefault();

    if (!naar(doel, win)) win.scrollTo(0, 0);
  });

  // 5. href="#/..." in de pagina tonen als het nieuwe adres.
  const herschrijf = (el) => {
    const h = el.getAttribute('href');

    if (isOudeRoute(h)) el.setAttribute('href', publiekeUrl(h));
  };
  const loop = (root) => {
    if (root.nodeType !== 1) return;
    if (root.tagName === 'A') herschrijf(root);
    root.querySelectorAll('a[href^="#/"]').forEach(herschrijf);
  };

  if (typeof win.MutationObserver === 'function') {
    const obs = new win.MutationObserver((lijst) => {
      lijst.forEach((m) => {
        if (m.type === 'attributes') herschrijf(m.target);
        else m.addedNodes.forEach(loop);
      });
    });

    obs.observe(win.document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['href'] });
  }

  // Alleen voor tests en ondersteuning: het interne pad van de huidige pagina opvragen.
  win.__skAdres = { huidigeHash: () => huidigeHash(win) };
}
