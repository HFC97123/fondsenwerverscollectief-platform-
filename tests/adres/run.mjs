// Adressen zonder # (src/app/adres.js): omzetting intern <-> publiek, oude links, huidigeHash, naar en vervangAdres.
import { publiekPad, internPad, publiekeUrl, huidigeHash, naar, vervangAdres } from '../../src/app/adres.js';

let ok = 0;
let fout = 0;
const check = (naam, waar) => {
  if (waar) ok += 1;
  else {
    fout += 1;
    console.log('FAIL:', naam);
  }
};

// intern -> publiek
check('chat', publiekPad('/kompas') === '/subsidie-kompas' && publiekPad('/subsidie-kompas') === '/subsidie-kompas');
check('app-pagina', publiekPad('/kompas/deadlines') === '/subsidie-kompas/deadlines');
check('project', publiekPad('/kompas/projecten/abc') === '/subsidie-kompas/projecten/abc');
check('abonneren en faq onder subsidie-kompas', publiekPad('/kompas/abonneren') === '/subsidie-kompas/abonneren' && publiekPad('/kompas/faq') === '/subsidie-kompas/faq');
check('hoe het werkt onder subsidie-kompas', publiekPad('/hoe-het-werkt') === '/subsidie-kompas/hoe-het-werkt');
check('collectief-pagina blijft', publiekPad('/actueel') === '/actueel' && publiekPad('/') === '/' && publiekPad('/artikel/12') === '/artikel/12' && publiekPad('/beheer') === '/beheer');
check('slash achteraan weg', publiekPad('/kompas/deadlines/') === '/subsidie-kompas/deadlines');

// publiek -> intern
check('terug: chat', internPad('/subsidie-kompas') === '/kompas' && internPad('/subsidie-kompas/') === '/kompas');
check('terug: app-pagina', internPad('/subsidie-kompas/deadlines') === '/kompas/deadlines');
check('terug: hoe het werkt', internPad('/subsidie-kompas/hoe-het-werkt') === '/hoe-het-werkt');
check('terug: collectief', internPad('/actueel') === '/actueel' && internPad('/') === '/');
check('heen en terug voor elke route', ['/', '/actueel', '/kompas', '/kompas/dashboard', '/kompas/projecten/x', '/hoe-het-werkt', '/kompas/abonneren', '/wachtwoord-instellen', '/beheer'].every((p) => internPad(publiekPad(p)) === p));

// urls met query
check('query blijft', publiekeUrl('#/kompas?conversation=1&focus=2') === '/subsidie-kompas?conversation=1&focus=2');
check('zonder #', publiekeUrl('/kompas/projecten/9?tab=documenten') === '/subsidie-kompas/projecten/9?tab=documenten');
check('lege query weg', publiekeUrl('#/kompas/deadlines?') === '/subsidie-kompas/deadlines');

// nep-venster
const nepWin = (pathname, search = '', hash = '') => {
  const w = {
    location: { pathname, search, hash },
    events: [],
    history: {
      state: null,
      stappen: [],
      zet(url) {
        const u = new URL(url, 'https://x.nl');
        w.location.pathname = u.pathname;
        w.location.search = u.search;
        w.location.hash = u.hash;
      },
      pushState(s, t, url) { this.stappen.push(['push', url]); this.zet(url); },
      replaceState(s, t, url) { this.stappen.push(['replace', url]); this.zet(url); },
    },
    dispatchEvent(e) { w.events.push(e.type); },
  };

  return w;
};

check('huidigeHash leest het pad', huidigeHash(nepWin('/subsidie-kompas/projecten/9', '?tab=documenten')) === '#/kompas/projecten/9?tab=documenten');
check('huidigeHash: oude link telt nog tot hij is omgezet', huidigeHash(nepWin('/subsidie-kompas', '', '#/kompas/deadlines')) === '#/kompas/deadlines');
check('huidigeHash: Supabase-terugkeer verstoort de route niet', huidigeHash(nepWin('/', '', '#access_token=abc&type=recovery')) === '#/');

const w = nepWin('/subsidie-kompas');
check('naar: nieuwe stap + melding', naar('/kompas/deadlines', w) === true && w.history.stappen[0][0] === 'push' && w.location.pathname === '/subsidie-kompas/deadlines' && w.events[0] === 'hashchange');
check('naar dezelfde pagina: niets', naar('#/kompas/deadlines', w) === false && w.history.stappen.length === 1);
vervangAdres('#/kompas/deadlines?status=Open', w);
check('vervangAdres: geen nieuwe stap, geen melding', w.history.stappen[1][0] === 'replace' && w.location.search === '?status=Open' && w.events.length === 1);

console.log(`adres: ${ok} OK, ${fout} FAIL`);
process.exit(fout ? 1 : 0);
