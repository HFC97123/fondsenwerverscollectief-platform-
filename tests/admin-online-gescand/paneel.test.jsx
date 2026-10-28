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
const { default: Paneel } = await import('../../src/features/admin/AdminOnlineGescand.jsx');

let ok = 0; let fout = 0;
const check = (n, w, d = '') => { if (w) ok += 1; else { fout += 1; console.log(`  FAIL: ${n} ${d}`); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const wortel = createRoot(document.getElementById('root'));
const q = (s) => document.querySelector(s);
const qa = (s) => [...document.querySelectorAll(s)];
const klik = async (el) => { await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); await sleep(30); }); };

const db = [
  { id: 'a', gever: 'Stichting Noord', regeling: 'Buurtfonds Noord', url: 'https://noord.example/b', aantal_keer: 5, laatst_gezien: '2026-10-25T10:00:00Z', bron: 'chat', koppeling: 'geen', review_status: 'nieuw', deadline: '2027-01-15', bedrag_max: 5000, werkgebieden: ['Amsterdam'] },
  { id: 'c', gever: 'Stichting Eigen Naam', regeling: null, url: null, aantal_keer: 1, laatst_gezien: '2026-10-23T10:00:00Z', bron: 'lid', koppeling: 'geen', review_status: 'nieuw' },
  { id: 'b', gever: 'Fonds Zuid', regeling: null, url: 'javascript:alert(1)', aantal_keer: 1, laatst_gezien: '2026-10-24T10:00:00Z', bron: 'voorstel', koppeling: 'waarschijnlijk', review_status: 'nieuw', werkgebieden: [] },
];
const log = [];
const opgenomen = [];
const diensten = {
  haalOnlineGescand: async ({ status }) => ({ rijen: db.filter((r) => r.review_status === status), fout: '' }),
  telOnlineGescand: async () => ({ telling: db.reduce((t, r) => ({ ...t, [r.review_status]: (t[r.review_status] || 0) + 1 }), {}), fout: '' }),
  werkOnlineGescandBij: async ({ id, status }) => { log.push({ id, status }); db.find((r) => r.id === id).review_status = status; return { ok: true }; },
  neemOnlineGescandOp: async ({ id, type }) => { opgenomen.push({ id, type }); db.find((r) => r.id === id).review_status = 'opgenomen'; return { ok: true, resultaat: { funder_nieuw: true, regeling_nieuw: true } }; },
};
const meldingen = [];

await act(async () => { wortel.render(<Paneel diensten={diensten} notify={(t, m) => meldingen.push(m)} />); await sleep(80); });
check('teller toont het aantal te controleren', q('[data-testid="online-gescand-aantal"]').textContent === '3 te controleren');
check('nieuwe rijen staan in de lijst, meest gevonden eerst (volgorde van de server)', qa('[data-testid="online-gescand-rij"]').length === 3 && qa('[data-testid="online-gescand-rij"]')[0].textContent.includes('Buurtfonds Noord'));
check('alleen veilige links (geen javascript:)', !document.body.innerHTML.includes('javascript:') && !!q('a[href="https://noord.example/b"]'));
check('koppeling zichtbaar', /Niet in database/.test(document.body.textContent) && /Lijkt op bestaande gever/.test(document.body.textContent));

check('de knop "Opnemen in de database" staat bij elke nieuwe rij; een handmatige status "Opgenomen" is er niet meer', qa('[data-testid="online-gescand-opnemen"]').length === 3 && !qa('button').some((b2) => b2.textContent === 'Opgenomen'));
check('een financier die een lid zelf typte, staat als zodanig in de lijst', /typte een lid zelf in/.test(document.body.textContent));

await klik(qa('[data-testid="online-gescand-opnemen"]')[0]);
check('eerst een keuze voor het soort gever, met Annuleren', !!q('[data-testid="online-gescand-opnemen-keuze"]') && !!q('select[aria-label="Soort gever"]') && opgenomen.length === 0);
await act(async () => { const sel = q('select[aria-label="Soort gever"]'); const set = Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value').set; set.call(sel, 'gemeente_lokale_overheid'); sel.dispatchEvent(new dom.window.Event('change', { bubbles: true })); await sleep(20); });
await klik(q('[data-testid="online-gescand-opnemen-bevestig"]'));
check('opnemen via de dienst met het gekozen soort', opgenomen.length === 1 && opgenomen[0].id === 'a' && opgenomen[0].type === 'gemeente_lokale_overheid');
check('rij verdwijnt uit "nieuw" en de teller loopt terug', qa('[data-testid="online-gescand-rij"]').length === 2 && q('[data-testid="online-gescand-aantal"]').textContent === '2 te controleren');
check('melding voor de beheerder: nieuw fonds en regeling, nog niet beoordeeld', /Buurtfonds Noord" is opgenomen \(nieuw: fonds en regeling\), nog niet beoordeeld/.test(meldingen[0] || ''));

const pil = qa('button').find((b) => b.textContent.startsWith('Opgenomen ('));
await klik(pil);
check('filter "Opgenomen" toont de verwerkte rij met "Terug naar nieuw"', qa('[data-testid="online-gescand-rij"]').length === 1 && qa('button').some((b) => b.textContent === 'Terug naar nieuw'));

console.log(`\n${ok} geslaagd, ${fout} mislukt`);
process.exit(fout ? 1 : 0);
