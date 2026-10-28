import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
const g = globalThis;
g.window = dom.window; g.document = dom.window.document;
Object.defineProperty(g, 'navigator', { value: dom.window.navigator, configurable: true });
g.HTMLElement = dom.window.HTMLElement; g.Event = dom.window.Event; g.MouseEvent = dom.window.MouseEvent;
g.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import('react')).default;
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { default: Paneel } = await import('../../src/features/admin/AdminNieuweWoorden.jsx');

let ok = 0; let fout = 0;
const check = (n, w, d = '') => { if (w) ok += 1; else { fout += 1; console.log(`  FAIL: ${n} ${d}`); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const wortel = createRoot(document.getElementById('root'));
const q = (s) => document.querySelector(s);
const qa = (s) => [...document.querySelectorAll(s)];
const klik = async (el) => { await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); await sleep(30); }); };
const typ = async (el, waarde) => { await act(async () => { const set = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set; set.call(el, waarde); el.dispatchEvent(new dom.window.Event('input', { bubbles: true })); await sleep(20); }); };

const db = [
  { id: 'w1', woord: 'noodhulp', aantal_keer: 7, laatst_gezien: '2026-10-25T10:00:00Z', ai_actie: 'synoniem', ai_categorie: 'discipline', ai_naam: 'Armoedebestrijding', ai_toelichting: 'Noodhulp gaat meestal over armoede.', review_status: 'nieuw', aantal_fondsen: 12 },
  { id: 'w2', woord: 'zeevaart', aantal_keer: 1, laatst_gezien: '2026-10-24T10:00:00Z', ai_actie: 'nieuwe_waarde', ai_categorie: 'discipline', ai_naam: 'Maritiem', ai_toelichting: '', review_status: 'nieuw', aantal_fondsen: 0 },
  { id: 'w3', woord: 'asdfgh', aantal_keer: 1, laatst_gezien: '2026-10-23T10:00:00Z', ai_actie: 'afwijzen', ai_categorie: null, ai_naam: null, ai_toelichting: 'Geen woord.', review_status: 'nieuw', aantal_fondsen: 0 },
];
const herkend = [];
const beslist = [];
const diensten = {
  haalEigenTermen: async ({ status }) => ({ rijen: db.filter((r) => r.review_status === status), fout: '' }),
  telEigenTermen: async () => ({ telling: db.reduce((t, r) => ({ ...t, [r.review_status]: (t[r.review_status] || 0) + 1 }), {}), fout: '' }),
  beslisEigenTerm: async ({ id, actie, categorie, naam }) => {
    beslist.push({ id, actie, categorie, naam });
    const r = db.find((x) => x.id === id);

    if (actie === 'afwijzen') r.review_status = 'afgewezen';
    else if (actie === 'terug') r.review_status = 'nieuw';
    else { r.review_status = actie === 'synoniem' ? 'synoniem' : 'toegevoegd'; r.besluit_naam = naam; r.besluit_categorie = categorie; herkend.push({ id: `h-${id}`, categorie, naam, woord: r.woord }); }

    return { ok: true };
  },
  haalHerkenningswoorden: async () => ({ rijen: herkend, fout: '' }),
  verwijderHerkenningswoord: async (id) => { const i = herkend.findIndex((h) => h.id === id); const h = herkend.splice(i, 1)[0]; db.find((r) => `h-${r.id}` === h.id).review_status = 'nieuw'; return { ok: true }; },
  haalBestaandeWaarden: async () => ({ discipline: ['Armoedebestrijding', 'Sport'], doelgroep: ['Jongeren'], regio: ['Amsterdam'] }),
};
const meldingen = [];

await act(async () => { wortel.render(<Paneel diensten={diensten} notify={(t, m) => meldingen.push([t, m])} />); await sleep(120); });
check('teller toont het aantal te beoordelen woorden', q('[data-testid="nieuwe-woorden-aantal"]').textContent === '3 te beoordelen');
check('elk woord staat in de lijst met aantal keer en aantal fondsen dat het noemt', qa('[data-testid="nieuwe-woorden-rij"]').length === 3 && /7× getypt/.test(document.body.textContent) && /12 fondsen noemen dit woord/.test(document.body.textContent));
check('het advies van de AI staat erbij, met toelichting', qa('[data-testid="nieuwe-woorden-advies"]')[0].textContent === 'Advies: synoniem van "Armoedebestrijding" (Discipline)' && /gaat meestal over armoede/.test(document.body.textContent));
check('de naam is voorgevuld met het advies', q('input[aria-label="Naam voor noodhulp"]').value === 'Armoedebestrijding' && q('input[aria-label="Naam voor zeevaart"]').value === 'Maritiem');

const rij = (i) => qa('[data-testid="nieuwe-woorden-rij"]')[i];
const knop = (r, t) => [...r.querySelectorAll('button')].find((b) => b.textContent === t);

check('een bestaande waarde kan alleen als synoniem, niet als nieuwe waarde', knop(rij(0), 'Nieuwe waarde').disabled === true && knop(rij(0), 'Synoniem').disabled === false);
check('een waarde die nog niet bestaat kan alleen als nieuwe waarde', knop(rij(1), 'Nieuwe waarde').disabled === false && knop(rij(1), 'Synoniem').disabled === true);

await klik(knop(rij(0), 'Synoniem'));
check('synoniem vastgelegd met de categorie en naam uit het advies', beslist.length === 1 && beslist[0].actie === 'synoniem' && beslist[0].categorie === 'discipline' && beslist[0].naam === 'Armoedebestrijding');
check('melding voor de beheerder', meldingen[0][0] === 'success' && /"noodhulp" wordt voortaan herkend als Armoedebestrijding/.test(meldingen[0][1]));
check('het woord verdwijnt uit "nieuw" en staat bij de herkenningswoorden', qa('[data-testid="nieuwe-woorden-rij"]').length === 2 && qa('[data-testid="herkenningswoord-rij"]').length === 1 && /noodhulp/.test(q('[data-testid="herkenningswoorden"]').textContent));

await klik(knop(rij(0), 'Nieuwe waarde'));
check('nieuwe waarde vastgelegd', beslist[1].actie === 'nieuwe_waarde' && beslist[1].naam === 'Maritiem' && qa('[data-testid="herkenningswoord-rij"]').length === 2);

await klik(knop(rij(0), 'Afwijzen'));
check('afwijzen vastgelegd en geen herkenningswoord erbij', beslist[2].actie === 'afwijzen' && qa('[data-testid="herkenningswoord-rij"]').length === 2);

await klik(qa('[data-testid="herkenningswoord-rij"] button')[0]);
check('een herkenningswoord intrekken: het woord is weer nieuw', qa('[data-testid="herkenningswoord-rij"]').length === 1 && q('[data-testid="nieuwe-woorden-aantal"]').textContent === '1 te beoordelen');

const pil = qa('button').find((b) => b.textContent.startsWith('Afgewezen ('));
await klik(pil);
check('filter "Afgewezen" toont het afgewezen woord met "Terug naar nieuw"', qa('[data-testid="nieuwe-woorden-rij"]').length === 1 && qa('button').some((b) => b.textContent === 'Terug naar nieuw'));

console.log(`\n${ok} geslaagd, ${fout} mislukt`);
process.exit(fout ? 1 : 0);
