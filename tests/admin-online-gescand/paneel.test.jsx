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
  { id: 'b', gever: 'Fonds Zuid', regeling: null, url: 'javascript:alert(1)', aantal_keer: 1, laatst_gezien: '2026-10-24T10:00:00Z', bron: 'voorstel', koppeling: 'waarschijnlijk', review_status: 'nieuw', werkgebieden: [] },
];
const log = [];
const diensten = {
  haalOnlineGescand: async ({ status }) => ({ rijen: db.filter((r) => r.review_status === status), fout: '' }),
  telOnlineGescand: async () => ({ telling: db.reduce((t, r) => ({ ...t, [r.review_status]: (t[r.review_status] || 0) + 1 }), {}), fout: '' }),
  werkOnlineGescandBij: async ({ id, status }) => { log.push({ id, status }); db.find((r) => r.id === id).review_status = status; return { ok: true }; },
};
const meldingen = [];

await act(async () => { wortel.render(<Paneel diensten={diensten} notify={(m) => meldingen.push(m)} />); await sleep(80); });
check('teller toont het aantal te controleren', q('[data-testid="online-gescand-aantal"]').textContent === '2 te controleren');
check('nieuwe rijen staan in de lijst, meest gevonden eerst (volgorde van de server)', qa('[data-testid="online-gescand-rij"]').length === 2 && qa('[data-testid="online-gescand-rij"]')[0].textContent.includes('Buurtfonds Noord'));
check('alleen veilige links (geen javascript:)', !document.body.innerHTML.includes('javascript:') && !!q('a[href="https://noord.example/b"]'));
check('koppeling zichtbaar', /Niet in database/.test(document.body.textContent) && /Lijkt op bestaande gever/.test(document.body.textContent));

const knop = [...qa('[data-testid="online-gescand-rij"]')[0].querySelectorAll('button')].find((b) => b.textContent === 'Opgenomen');
await klik(knop);
check('status bijwerken via de dienst', log.length === 1 && log[0].id === 'a' && log[0].status === 'opgenomen');
check('rij verdwijnt uit "nieuw" en de teller loopt terug', qa('[data-testid="online-gescand-rij"]').length === 1 && q('[data-testid="online-gescand-aantal"]').textContent === '1 te controleren');
check('melding voor de beheerder', /Buurtfonds Noord" staat nu op Opgenomen/.test(meldingen[0] || ''));

const pil = qa('button').find((b) => b.textContent.startsWith('Opgenomen ('));
await klik(pil);
check('filter "Opgenomen" toont de verwerkte rij met "Terug naar nieuw"', qa('[data-testid="online-gescand-rij"]').length === 1 && qa('button').some((b) => b.textContent === 'Terug naar nieuw'));

console.log(`\n${ok} geslaagd, ${fout} mislukt`);
process.exit(fout ? 1 : 0);
