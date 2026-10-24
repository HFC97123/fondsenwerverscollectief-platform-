// Tests voor Collie, de hulpknop in de werkomgeving (vaste vragen en rondleiding, geen AI en geen netwerk).
//   node tests/hulp/hulp.test.mjs   (vanuit de repo-root)
import { readFileSync } from 'node:fs';
import { PADEN_ZONDER_HULP, RONDLEIDING, TOON_RONDLEIDING, VRAGEN, openingsTekst, toonHulp, voorgesteldeVragen, vraagMetId } from '../../src/features/kompas-app/hulp/hulpContent.js';

let ok = 0;
let fail = 0;
const check = (naam, cond, extra = '') => {
  if (cond) ok += 1;
  else {
    fail += 1;
    console.log('FAIL:', naam, extra);
  }
};
const lees = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

const ids = VRAGEN.map((v) => v.id);
check('vragen: unieke id\'s', new Set(ids).size === ids.length);
check('vragen: elke vraag heeft tekst en een antwoord', VRAGEN.every((v) => v.vraag && v.antwoord));
check('rondleiding: onderdelen met titel en tekst', RONDLEIDING.length >= 6 && RONDLEIDING.every((r) => r.titel && r.tekst));

const links = [...VRAGEN.flatMap((v) => v.links || []), ...RONDLEIDING.map((r) => r.link).filter(Boolean)];
check('rondleiding staat voor nu uit en de knop hangt aan de schakelaar', TOON_RONDLEIDING === false && /TOON_RONDLEIDING && \(/.test(lees('src/features/kompas-app/hulp/KompasHulp.jsx')));
check('links: alleen hashlinks in de app of mailto', links.every((l) => /^(#\/|mailto:)/.test(l.href) && l.tekst));
check('links: geen verwijzing naar de oude menunaam of een niet-bestaande route', links.every((l) => !/#\/kompas\/(deadlines\/|advies\/(begroting|indienen))/.test(l.href)));

['/kompas/dashboard', '/kompas/advies', '/kompas/deadlines', '/kompas/documentatie', '/kompas/projecten', '/kompas/organisatie', '/kompas/account', '/onbekend'].forEach((pad) => {
  const v = voorgesteldeVragen(pad);

  check(`voorstellen ${pad}: drie bestaande vragen`, v.length === 3 && v.every((x) => vraagMetId(x.id)));
  check(`opening ${pad}: begint bij Collie`, /Ik ben Collie/.test(openingsTekst(pad)));
});

check('geen Collie in de Chat zelf, wel op de andere pagina\'s', PADEN_ZONDER_HULP.every((p) => !toonHulp(p)) && toonHulp('/kompas/dashboard') && toonHulp('/kompas/advies'));
check('"u" en geen "je" in de teksten', VRAGEN.every((v) => !/\b(je|jij|jouw)\b/i.test(`${v.vraag} ${v.antwoord}`)));
check('geen streepjes als gedachtestreep in de teksten', VRAGEN.every((v) => !/ — /.test(`${v.vraag} ${v.antwoord}`)));

const comp = lees('src/features/kompas-app/hulp/KompasHulp.jsx');
check('Collie: geen netwerk, geen AI, geen opslag', !/supabase|fetch\(|functions\.invoke|askKompas|window\.claude|localStorage|sessionStorage|indexedDB/.test(comp));
const app = lees('src/features/kompas-app/KompasApp.jsx');
check('KompasApp: alleen in de werkruimte (Pro/Premium)', /\{heeftWerkNav && <KompasHulp pad=\{route\.pad\} \/>\}/.test(app));

console.log(`${ok} geslaagd, ${fail} mislukt`);
process.exit(fail ? 1 : 0);
