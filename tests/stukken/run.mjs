// Stukken voor fondsenwerving: herkennen van een stuk in Documenten (naam of soort) en de leeftijdscheck.
await import('./bouw.mjs');
const { zoekStuk, ORGANISATIE_STUKKEN } = await import('./.build/stukken.mjs');

let ok = 0;
let fout = 0;
const check = (n, c) => { if (c) ok += 1; else { fout += 1; console.log('FAIL:', n); } };
const nu = new Date('2026-10-28T10:00:00Z');
const s = (id) => ORGANISATIE_STUKKEN.find((x) => x.id === id);

check('statuten herkend op naam', zoekStuk(s('statuten'), [{ naam: 'Statuten Stichting X.pdf', soort: '', datum: '2020-01-01' }], nu).status === 'klaar');
check('jaarrekening herkend op soort', zoekStuk(s('jaarrekening'), [{ naam: 'cijfers.pdf', soort: 'Jaarrekening', datum: '2026-05-01' }], nu).status === 'klaar');
check('jaarrekening ouder dan 12 maanden is te oud', zoekStuk(s('jaarrekening'), [{ naam: 'Jaarrekening 2024.pdf', soort: '', datum: '2025-06-01' }], nu).status === 'te-oud');
check('KvK ouder dan 3 maanden is te oud', zoekStuk(s('kvk'), [{ naam: 'Uittreksel KvK.pdf', soort: '', datum: '2026-06-01' }], nu).status === 'te-oud');
check('ontbreekt -> nodig', zoekStuk(s('anbi'), [{ naam: 'Projectplan.pdf', soort: 'Projectplan', datum: '' }], nu).status === 'nodig');
check('IBAN staat in de organisatielijst', Boolean(s('iban')));

console.log(`stukken: ${ok} OK, ${fout} FAIL`);
process.exit(fout ? 1 : 0);
