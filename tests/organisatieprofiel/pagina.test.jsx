import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
const g = globalThis;
g.window = dom.window; g.document = dom.window.document;
Object.defineProperty(g, 'navigator', { value: dom.window.navigator, configurable: true });
g.HTMLElement = dom.window.HTMLElement; g.Event = dom.window.Event;
g.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import('react')).default;
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const S = await import('./fakes/store.jsx');
const D = await import('./fakes/services.js');
const { default: Pagina } = await import('../../src/features/kompas-app/OrganisatieprofielPage.jsx');

let ok = 0; let fout = 0;
const check = (n, w, d = '') => { if (w) ok += 1; else { fout += 1; console.log(`  FAIL: ${n} ${d}`); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const wortel = createRoot(document.getElementById('root'));
const q = (s) => document.querySelector(s);
const upload = async (bestanden) => {
  const input = q('input[type="file"]');
  Object.defineProperty(input, 'files', { value: bestanden, configurable: true });
  await act(async () => { input.dispatchEvent(new dom.window.Event('change', { bubbles: true })); await sleep(50); });
};
const waarde = (label) => [...document.querySelectorAll('label')].find((l) => l.textContent.startsWith(label))?.querySelector('input')?.value;

await act(async () => { wortel.render(<S.TestStore begin={{ name: 'Stichting Eigen Naam' }}><Pagina /></S.TestStore>); await sleep(20); });

const tekst = document.body.textContent;
check('de vaste uitleg "Welke documenten?" staat niet meer op de pagina', !/Welke documenten\?/.test(tekst.replace(/Welke documenten kunt u uploaden\?/g, '')));
const tips = document.querySelectorAll('[data-testid="org-doctip"]');
check('pop-up bij "Relevante documenten" en bij de uploadknop', tips.length === 2);
check('pop-up noemt beleidsplan, jaarverslag, ANBI-beschikking en statuten', ['Beleidsplan', 'Jaarverslag', 'ANBI-beschikking', 'Statuten'].every((x) => tips[0].textContent.includes(x)) && /automatisch/.test(tips[0].textContent));
const css = [...document.querySelectorAll('style')].map((s) => s.textContent).join('\n');
check('pop-up verschijnt pas bij aanwijzen of focus', /\.fwk-doctip \.fwk-doctip-pop \{ display: none;/.test(css) && /\.fwk-doctip:hover \.fwk-doctip-pop, \.fwk-doctip:focus-within \.fwk-doctip-pop \{ display: block; \}/.test(css));

await upload([{ name: 'Beleidsplan 2026.pdf', type: 'application/pdf', __tekst: 'Beleidsplan tekst ...' }]);
check('na uploaden leest de AI het document meteen', D.aanroepen.length === 1 && D.aanroepen[0].fileName === 'Beleidsplan 2026.pdf');
check('lege velden automatisch ingevuld met herkomst document', S.log.overnemen.length === 1 && S.log.overnemen[0].type === 'document' && Object.keys(S.log.overnemen[0].velden).sort().join() === 'kvk,mission' && waarde('KvK-nummer') === '12345678', JSON.stringify(S.log.overnemen));
check('een zelf ingevulde naam wordt niet overschreven', waarde('Organisatienaam') === 'Stichting Eigen Naam');
check('afwijkende naam wordt als voorstel getoond (niet aangevinkt)', /wijkt af van wat er nu staat/.test(document.body.textContent) && [...document.querySelectorAll('input[type="checkbox"]')].every((c) => !c.checked));
check('melding bij de documenten', /Uit "Beleidsplan 2026\.pdf" ingevuld: .*kvk-nummer/.test(q('[data-testid="org-doc-melding"]').textContent), q('[data-testid="org-doc-melding"]')?.textContent);

await upload([{ name: 'scan.pdf', type: 'application/pdf', __tekst: '' }]);
check('zonder leesbare tekst: geen AI-aanroep, nette melding', D.aanroepen.length === 1 && /geen tekst/.test(q('[data-testid="org-doc-melding"]').textContent));

console.log(`\n${ok} geslaagd, ${fout} mislukt`);
process.exit(fout ? 1 : 0);
