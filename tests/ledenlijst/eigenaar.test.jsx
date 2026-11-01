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
const client = await import('./fake-client.mjs');
const { default: EigenaarKaart } = await import('../../src/features/website/EigenaarKaart.jsx');

let ok = 0; let fout = 0;
const check = (n, w) => { if (w) ok += 1; else { fout += 1; console.log(`  FAIL: ${n}`); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const q = (s) => document.querySelector(s);
const wortel = createRoot(document.getElementById('root'));
const LANG = 'Welkom bij het Collectief. '.repeat(30);

// zonder rij: er staat niets
client.zet({ data: [], error: null });
await act(async () => { wortel.render(<EigenaarKaart />); await sleep(40); });
check('geen eigenaar bekend: geen lege kaart', !q('[data-testid="eigenaar-kaart"]'));

// met rij, zonder sessie (bezoeker): kaart zichtbaar
client.zet({ data: [{ naam: 'Aisya van der Vaart', avatar_path: 'x/foto.jpg', bio: LANG, website: 'https://aisya.eu', organisatie: null, functie: null }], error: null });
await act(async () => { wortel.render(<EigenaarKaart key="2" />); await sleep(60); });
const kaart = q('[data-testid="eigenaar-kaart"]');
check('de kaart staat er, ook zonder inloggen', !!kaart);
check('naam en "Eigenaar van het Collectief"', /Aisya van der Vaart/.test(kaart.textContent) && /Eigenaar van het Collectief/.test(kaart.textContent));
check('lange tekst is ingekort met Lees meer', /…/.test(kaart.textContent) && !!q('[data-testid="eigenaar-meer"]'));
await act(async () => { q('[data-testid="eigenaar-meer"]').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); await sleep(20); });
check('Lees meer toont alles', !/…/.test(q('[data-testid="eigenaar-kaart"]').textContent) && /Minder/.test(q('[data-testid="eigenaar-kaart"]').textContent));
check('website als veilige link', q('[data-testid="eigenaar-kaart"] a').getAttribute('href') === 'https://aisya.eu' && q('[data-testid="eigenaar-kaart"] a').getAttribute('rel') === 'noopener noreferrer' && q('[data-testid="eigenaar-kaart"] a').textContent === 'aisya.eu');
check('de RPC wordt zonder gegevens van de bezoeker aangeroepen', client.log.some((x) => x.naam === 'collectief_eigenaar' && x.args === undefined));
check('er wordt geen e-mailadres getoond', !/@/.test(q('[data-testid="eigenaar-kaart"]').textContent));

// onveilig webadres wordt geen link
client.zet({ data: [{ naam: 'Aisya', avatar_path: null, bio: 'Kort.', website: 'javascript:alert(1)' }], error: null });
await act(async () => { wortel.render(<EigenaarKaart key="3" />); await sleep(60); });
check('javascript:-adres wordt geen link', !q('[data-testid="eigenaar-kaart"] a'));
check('zonder foto: initialen', q('[data-avatar]').getAttribute('data-avatar') === 'initialen');

// fout van de server: niets tonen
client.zet({ data: null, error: { message: 'nee' } });
await act(async () => { wortel.render(<EigenaarKaart key="4" />); await sleep(60); });
check('bij een fout geen kaart en geen crash', !q('[data-testid="eigenaar-kaart"]'));

console.log(`eigenaar-kaart: ${ok} OK, ${fout} FAIL`);
process.exit(fout ? 1 : 0);
