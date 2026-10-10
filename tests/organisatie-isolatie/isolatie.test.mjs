import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://fondsenwerverscollectief.nl/kompas', pretendToBeVisual: true });
const g = globalThis;
g.window = dom.window; g.document = dom.window.document;
Object.defineProperty(g, 'navigator', { value: dom.window.navigator, configurable: true });
g.localStorage = dom.window.localStorage; g.sessionStorage = dom.window.sessionStorage;
g.IS_REACT_ACT_ENVIRONMENT = true;
const React = (await import('react')).default;
const { createRoot } = await import('react-dom/client');
const { act } = await import('react-dom/test-utils');
const { KompasProvider, useKompas } = await import(process.env.ORG_TEST_STORE);
const { uitloggen } = await import(process.env.ORG_TEST_PROFILE);

const A = { id: 'user-A' }, B = { id: 'user-B' }, C = { id: 'user-C' };
const probe = { store: null };
function Probe() { probe.store = useKompas(); return React.createElement('div', { id: 'org' }, (probe.store.orgProfile && probe.store.orgProfile.name) || '(leeg)'); }
let setUser;
function App() {
  const [u, su] = React.useState(null);
  setUser = su;
  const id = u ? u.id : null;
  return React.createElement(KompasProvider, { key: id || 'anoniem', userId: id }, React.createElement(Probe));
}
const root = createRoot(document.getElementById('root'));
await act(async () => { root.render(React.createElement(App)); });
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
async function login(u) { g.__USER = u; await act(async () => { setUser(u); await wacht(120); }); }
async function logout() { await act(async () => { await uitloggen(); }); g.__USER = null; await act(async () => { setUser(null); await wacht(60); }); }
const toon = () => document.getElementById('org').textContent;
let ok = 0, fout = 0;
function check(naam, waar, extra = '') { if (waar) ok++; else fout++; console.log(`${waar ? 'OK  ' : 'FAIL'} ${naam}${extra ? ' — ' + extra : ''}`); }
const alleLocal = () => JSON.stringify(Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])));

// Voorgeschiedenis: de situatie waarin het misging. Account A (jouw account) had Rode Kruis in de DB en in de
// gedeelde browseropslag van deze browser.
g.__DB.subsidie_kompas_organizations = [{ id: 'org-A', user_id: 'user-A', organization_name: 'Het Nederlandse Rode Kruis', website_url: 'https://rodekruis.nl/', mission: 'noodhulp' }];
localStorage.setItem('sk-werkomgeving', JSON.stringify({ orgProfile: { name: 'Het Nederlandse Rode Kruis', website: 'https://rodekruis.nl/', mission: 'noodhulp' }, projects: [], conversations: [] }));
sessionStorage.setItem('fwc_vraagbaak_chat_v1', JSON.stringify([{ role: 'user', content: 'vraag van het vorige account' }]));

// 1. Nieuw account (Free/Pro/Premium maakt voor de lege organisatiecontext niets uit: de context komt uit dezelfde bron).
await login(B);
check('1. nieuw account B in dezelfde browser: organisatienaam is leeg', toon() === '(leeg)', toon());
check('1b. orgProfile van B is leeg object', JSON.stringify(probe.store.orgProfile) === '{}', JSON.stringify(probe.store.orgProfile));
check('1c. nergens "Rode Kruis" in de zichtbare staat van B', !/kruis/i.test(JSON.stringify(probe.store.orgProfile)));

// 2. A logt in -> eigen data
await logout();
check('2. uitgelogd: organisatiecontext leeg', toon() === '(leeg)', toon());
check('2b. publieke chatgeschiedenis (sessionStorage) is bij uitloggen gewist', sessionStorage.getItem('fwc_vraagbaak_chat_v1') === null);
await login(A);
check('3. account A ziet zijn eigen Rode Kruis uit de database', /Rode Kruis/.test(toon()), toon());

// 4. A vult zelf iets in, daarna uitloggen, B inloggen
await act(async () => { probe.store.setOrgField('mission', 'noodhulp en armoedebestrijding'); await wacht(1100); });
const rijA = g.__DB.subsidie_kompas_organizations.find((r) => r.user_id === 'user-A');
check('4. wijziging van A is in de database op user_id A bewaard', rijA && /armoede/.test(rijA.mission));
await logout();
await login(B);
check('5. account B na uitloggen van A: leeg', toon() === '(leeg)' && JSON.stringify(probe.store.orgProfile) === '{}', toon());

// 6. B vult andere organisatie in
await act(async () => { probe.store.setOrgField('name', 'Stichting Voorbeeld'); await wacht(1100); });
const rijB = g.__DB.subsidie_kompas_organizations.find((r) => r.user_id === 'user-B');
check('6. B bewaart eigen organisatie onder user B', rijB && rijB.organization_name === 'Stichting Voorbeeld');
check('6b. A\'s rij is niet door B overschreven', g.__DB.subsidie_kompas_organizations.find((r) => r.user_id === 'user-A').organization_name === 'Het Nederlandse Rode Kruis');
await logout();
await login(A);
check('7. opnieuw inloggen als A: Rode Kruis, niet Stichting Voorbeeld', /Rode Kruis/.test(toon()) && !/Voorbeeld/.test(JSON.stringify(probe.store.orgProfile)), toon());
await logout();
await login(C);
check('8. derde nieuw account C: leeg', toon() === '(leeg)');

// Opslag: geen organisatiegegevens in browseropslag
const ls = alleLocal();
const per = Object.keys(localStorage).filter((k) => k.startsWith('sk-werkomgeving:'));
check('9. localStorage bevat per-gebruiker sleutels, geen organisatieprofiel', per.length >= 2 && !per.some((k) => /orgProfile\":\{\"/.test(localStorage.getItem(k)) && /name/.test(localStorage.getItem(k))), per.join(','));
check('9b. "Stichting Voorbeeld" staat nergens in browseropslag', !/Voorbeeld/.test(ls));
check('9c. oude gedeelde sleutel bevat geen organisatieprofiel meer (rest onaangeroerd)', !/Rode Kruis/.test(localStorage.getItem('sk-werkomgeving') || ''), localStorage.getItem('sk-werkomgeving'));
console.log(`\n${ok} OK, ${fout} FAIL`);
process.exit(fout ? 1 : 0);
