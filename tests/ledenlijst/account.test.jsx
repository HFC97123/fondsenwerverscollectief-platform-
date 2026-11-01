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
const { default: AccountKaart } = await import('../../src/features/website/AccountKaart.jsx');

let ok = 0; let fout = 0;
const check = (n, w) => { if (w) ok += 1; else { fout += 1; console.log(`  FAIL: ${n}`); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const q = (s) => document.querySelector(s);
const klik = (el) => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
const wortel = createRoot(document.getElementById('root'));

client.zetOnboarding({ data: { functie: 'Zelfstandig fondsenwerver', organisatie: 'Stichting Voorbeeld' }, error: null });
let uitgelogd = 0;
const profile = { id: 'u1', role: 'member', member_type: 'zzp', bio: 'Mijn verhaal', avatar_path: null };
await act(async () => {
  wortel.render(<AccountKaart profile={profile} profileFullName="Jan Jansen" profileInitials="JJ" isApproved vernieuwProfiel={() => {}} logout={() => { uitgelogd += 1; }} />);
  await sleep(60);
});

const kaart = q('[data-testid="account-kaart"]');
check('de kaart staat er', !!kaart);
check('ingeklapt: "Ingelogd als" en naam', /Ingelogd als/.test(kaart.textContent) && /Jan Jansen/.test(kaart.textContent));
check('ingeklapt: functie en organisatie onder de naam', /Zelfstandig fondsenwerver/.test(q('[data-testid="account-regel"]').textContent) && /Stichting Voorbeeld/.test(q('[data-testid="account-regel"]').textContent));
check('ingeklapt: foto (initialen) staat er', !!q('[data-avatar]'));
check('ingeklapt: geen profielonderdelen', !q('[data-testid="account-uitgeklapt"]') && !/Over mij/.test(kaart.textContent) && !/Mijn opgeslagen artikelen/.test(kaart.textContent));
check('knop om uit te klappen', /Mijn profiel/.test(q('[data-testid="account-uitklap"]').textContent) && q('[data-testid="account-uitklap"]').getAttribute('aria-expanded') === 'false');

await act(async () => { klik(q('[data-testid="account-uitklap"]')); await sleep(60); });
check('uitgeklapt: profiel zichtbaar', !!q('[data-testid="account-uitgeklapt"]') && /Over mij/.test(q('[data-testid="account-kaart"]').textContent));
check('uitgeklapt: knop wordt inklappen', /Inklappen/.test(q('[data-testid="account-uitklap"]').textContent) && q('[data-testid="account-uitklap"]').getAttribute('aria-expanded') === 'true');

await act(async () => { klik(q('[data-testid="account-uitklap"]')); await sleep(30); });
check('weer ingeklapt', !q('[data-testid="account-uitgeklapt"]'));

await act(async () => { klik(q('[data-testid="account-uitloggen"]')); await sleep(10); });
check('uitloggen werkt vanuit de balk', uitgelogd === 1);

// zonder onboarding-gegevens: alleen de soort
client.zetOnboarding({ data: null, error: null });
await act(async () => {
  wortel.render(<AccountKaart key="2" profile={{ ...profile, role: 'admin' }} profileFullName="Aisya" profileInitials="A" isApproved vernieuwProfiel={() => {}} logout={() => {}} />);
  await sleep(60);
});
check('eigenaar zonder organisatie: alleen de rol', q('[data-testid="account-regel"]').textContent === 'Eigenaar van het Collectief');

console.log(`account-kaart: ${ok} OK, ${fout} FAIL`);
process.exit(fout ? 1 : 0);
