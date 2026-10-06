// Fase 2D: frontend-aansluiting op create-checkout-session (geen echte Stripe).
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/#/kompas/abonneren?intent=PRO',
  pretendToBeVisual: true,
});
const g = globalThis;
g.window = dom.window;
g.document = dom.window.document;
g.localStorage = dom.window.localStorage;
Object.defineProperty(g, 'navigator', { value: dom.window.navigator, configurable: true });
g.HTMLElement = dom.window.HTMLElement;
g.Event = dom.window.Event;
g.MouseEvent = dom.window.MouseEvent;
g.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.scrollTo = () => {};

const ReactMod = await import('react');
const React = ReactMod.default;
const { act } = ReactMod;
const { createRoot } = await import('react-dom/client');
const { readFileSync } = await import('node:fs');
const { join } = await import('node:path');

const client = await import('./fake-client.js');
const fakeApp = await import('./fake-app.js');
const billing = await import('../../src/data/services/billing.js');
const { default: AbonnerenPage, AbonnerenBevestiging } = await import('../../src/features/kompas-marketing/AbonnerenPage.jsx');

const { startCheckout, isStripeCheckoutUrl, navigatie } = billing;
const CHECKOUT_URL = 'https://checkout.stripe.com/c/pay/cs_test_a1B2c3#fidkdWxOYHwnPyd1blpxYHZxWjA0';

let pass = 0;
let fail = 0;
let huidig = '';
const ok = (c, msg) => {
  if (c) pass += 1;
  else {
    fail += 1;
    console.log(`  FAIL [${huidig}]: ${msg}`);
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- helpers ---------------------------------------------------------------
const PROFIEL = { id: '11111111-1111-1111-1111-111111111111', subscription_tier: 'free', subscription_active: false };
const INGELOGD = { isLoggedIn: true, profile: PROFIEL };

function httpFout(status, body) {
  return { data: null, error: { name: 'FunctionsHttpError', message: 'Edge Function returned a non-2xx status code', context: new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }) } };
}

let navigaties = [];
navigatie.naar = (u) => { navigaties.push(u); };

function opnieuw(antwoord, app = INGELOGD) {
  client.__reset();
  navigaties = [];
  dom.window.localStorage.clear();
  client.__zetSupabase(client.maakClient(antwoord));
  fakeApp.__zetApp(app);
}

let root = null;
let container = null;
async function render(element) {
  if (root) await act(async () => root.unmount());
  container = document.createElement('div');
  document.body.innerHTML = '';
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(element));
}
const knop = (tekst) => [...container.querySelectorAll('button')].find((b) => b.textContent.includes(tekst));
const tekst = () => container.textContent;
async function vink() {
  const cb = container.querySelector('input[type=checkbox]');
  await act(async () => { cb.click(); });
}
async function klik(el) {
  await act(async () => { el.click(); });
}
async function wacht() {
  await act(async () => { await sleep(30); });
}

const PRO_NAAR = (plan) => ({ plan, voorwaarden_akkoord: true });
const GOED = () => ({ data: { url: CHECKOUT_URL }, error: null });

// ---- 0. URL-validatie ----------------------------------------------------------
huidig = '0 URL-validatie';
ok(isStripeCheckoutUrl(CHECKOUT_URL), 'echte Checkout-url is geldig');
for (const slecht of [
  'http://checkout.stripe.com/c/pay/x', 'https://evil.example/pay', 'https://checkout.stripe.com.evil.com/x',
  'https://user:pw@checkout.stripe.com/x', 'javascript:alert(1)', 'data:text/html,hi', '//checkout.stripe.com/x',
  'checkout.stripe.com/x', '', null, undefined, 42, {}, 'https://billing.stripe.com/p/session/x', 'https://stripe.com/x',
]) {
  ok(!isStripeCheckoutUrl(slecht), `ongeldig: ${String(slecht)}`);
}

// ---- A. niet ingelogd ------------------------------------------------------------
huidig = 'A niet ingelogd';
opnieuw(GOED, { isLoggedIn: false });
await render(React.createElement(AbonnerenPage));
ok(JSON.parse(dom.window.localStorage.getItem('fc.koopintentie') || '{}').intentie === 'PRO', 'intent PRO bewaard uit de URL');
ok(!container.querySelector('input[type=checkbox]'), 'geen akkoordvinkje voor anonieme bezoeker');
ok(!knop('Doorgaan naar betalen'), 'geen betaalknop voor anonieme bezoeker');
ok(!!knop('Account aanmaken') && !!knop('Inloggen'), 'centrale Collectief-login/registratie getoond');
await klik(knop('Inloggen'));
ok(fakeApp.aanroepen.some((a) => a[0] === 'openAuth'), 'Inloggen opent de bestaande centrale login (app.openAuth)');
await klik(knop('Account aanmaken'));
ok(fakeApp.aanroepen.some((a) => a[0] === 'openRegister'), 'Account aanmaken opent de bestaande centrale registratie');
ok(client.log.invoke.length === 0 && client.log.andere.length === 0, 'GEEN checkout-/Supabase-aanroep vóór login');
ok(navigaties.length === 0, 'geen navigatie');
{
  const r = await startCheckout('PRO', { voorwaardenAkkoord: true });
  // startCheckout zelf kent geen login; zonder sessie weigert de server (401). Hier: aanroep wordt gedaan met zijn eigen auth.
  ok(r && typeof r === 'object', 'startCheckout geeft altijd een uitkomstobject');
  client.__reset(); navigaties = [];
}

// ---- B. ingelogd, geen terms -------------------------------------------------------
huidig = 'B ingelogd zonder terms';
opnieuw(GOED);
await render(React.createElement(AbonnerenBevestiging, { intentie: 'PRO' }));
ok(knop('Doorgaan naar betalen').disabled === true, 'betaalknop uitgeschakeld zonder akkoord');
await klik(knop('Doorgaan naar betalen'));
await wacht();
ok(client.log.invoke.length === 0, 'geen API-call zonder akkoord (knop)');
for (const waarde of [false, undefined, 'true', 1, null]) {
  const r = await startCheckout('PRO', { voorwaardenAkkoord: waarde });
  ok(r.url === null && r.code === 'akkoord_vereist', `startCheckout weigert akkoord=${String(waarde)}`);
}
{
  const r = await startCheckout('PRO');
  ok(r.url === null && r.code === 'akkoord_vereist', 'startCheckout zonder opties weigert');
}
ok(client.log.invoke.length === 0 && navigaties.length === 0, 'geen API-call en geen navigatie zonder akkoord (helper)');

// ---- C/D. PRO en PREMIUM ------------------------------------------------------------
for (const plan of ['PRO', 'PREMIUM']) {
  huidig = `${plan === 'PRO' ? 'C' : 'D'} ${plan} met terms`;
  opnieuw(GOED);
  await render(React.createElement(AbonnerenBevestiging, { intentie: plan }));
  await vink();
  ok(knop('Doorgaan naar betalen').disabled === false, 'knop actief na akkoord');
  await klik(knop('Doorgaan naar betalen'));
  await wacht();
  ok(client.log.invoke.length === 1, `exact één create-checkout-session-call (${client.log.invoke.length})`);
  const c = client.log.invoke[0];
  ok(c && c.naam === 'create-checkout-session', 'juiste functie');
  ok(c && JSON.stringify(c.opties.body) === JSON.stringify(PRO_NAAR(plan)), `body is exact ${JSON.stringify(PRO_NAAR(plan))} (${JSON.stringify(c && c.opties.body)})`);
  ok(c && Object.keys(c.opties).join() === 'body', 'geen extra opties/headers vanuit de frontend');
  ok(navigaties.length === 1 && navigaties[0] === CHECKOUT_URL, 'browser navigeert naar de teruggegeven Checkout-url');
  ok(knop('Bezig met doorsturen') && knop('Bezig met doorsturen').disabled, 'knop blijft vergrendeld tijdens doorsturen');
  ok(tekst().includes('doorgestuurd naar de beveiligde betaalpagina van Stripe'), 'duidelijke laadstatus');
  ok(client.log.andere.length === 0, 'geen enkele andere Supabase-aanroep (geen from/rpc/auth)');
}

// ---- E. dubbelklik --------------------------------------------------------------------
huidig = 'E dubbelklik';
{
  let vrij;
  const traag = new Promise((r) => { vrij = r; });
  opnieuw(async () => { await traag; return GOED(); });
  await render(React.createElement(AbonnerenBevestiging, { intentie: 'PREMIUM' }));
  await vink();
  const b = knop('Doorgaan naar betalen');
  await act(async () => { b.click(); b.click(); b.click(); }); // drie synchrone klikken
  ok(client.log.invoke.length === 1, `maximaal één request bij meerdere klikken (${client.log.invoke.length})`);
  ok(knop('Bezig met doorsturen').disabled, 'knop vergrendeld tijdens lopend verzoek');
  ok(container.querySelector('input[type=checkbox]').disabled, 'vinkje vergrendeld tijdens lopend verzoek');
  await klik(knop('Bezig met doorsturen'));
  ok(client.log.invoke.length === 1, 'klik op vergrendelde knop doet niets');
  await act(async () => { vrij(); await sleep(30); });
  ok(client.log.invoke.length === 1 && navigaties.length === 1, 'na afronden: één call, één navigatie');
}

// ---- F. backendfouten -------------------------------------------------------------------
huidig = 'F backendfout';
{
  let volgende = httpFout(409, { error: 'Er is al een lopend abonnement gekoppeld aan dit account.', code: 'abonnement_bestaat' });
  opnieuw(() => volgende);
  await render(React.createElement(AbonnerenBevestiging, { intentie: 'PRO' }));
  await vink();
  await klik(knop('Doorgaan naar betalen'));
  await wacht();
  const alarm = container.querySelector('[role=alert]');
  ok(!!alarm && alarm.textContent.includes('Er is al een lopend abonnement gekoppeld aan dit account.'), 'servermelding (eigen functie) getoond');
  ok(navigaties.length === 0, 'geen redirect bij fout');
  ok(knop('Doorgaan naar betalen') && knop('Doorgaan naar betalen').disabled === false, 'knop herstelt na fout');
  ok(container.querySelector('input[type=checkbox]').checked && !container.querySelector('input[type=checkbox]').disabled, 'akkoord blijft behouden');
  ok(client.log.andere.length === 0, 'foutpad doet geen andere Supabase-aanroep');

  // opnieuw proberen werkt en wist de oude fout
  volgende = GOED();
  await klik(knop('Doorgaan naar betalen'));
  await wacht();
  ok(client.log.invoke.length === 2 && navigaties.length === 1, 'tweede poging kan opnieuw (2 calls, 1 navigatie)');
  ok(!container.querySelector('[role=alert]'), 'oude fout is gewist bij nieuwe poging');

  // generieke fouten
  for (const [naam, antw, verwacht] of [
    ['502 eigen melding', httpFout(502, { error: 'Kon de betaalpagina niet aanmaken.' }), 'Kon de betaalpagina niet aanmaken.'],
    ['500 zonder body', { data: null, error: { context: new Response('boom', { status: 500 }) } }, 'Het openen van de betaalpagina is niet gelukt'],
    ['netwerkfout', { data: null, error: { name: 'FunctionsFetchError', message: 'Failed to fetch' } }, 'Het openen van de betaalpagina is niet gelukt'],
    ['gateway 403-body zonder error-veld', httpFout(403, { code: 403, message: 'Forbidden' }), 'Het openen van de betaalpagina is niet gelukt'],
  ]) {
    volgende = antw;
    opnieuw(() => volgende);
    await render(React.createElement(AbonnerenBevestiging, { intentie: 'PRO' }));
    await vink();
    await klik(knop('Doorgaan naar betalen'));
    await wacht();
    const a = container.querySelector('[role=alert]');
    ok(!!a && a.textContent.includes(verwacht), `${naam}: begrijpelijke melding`);
    ok(!(a && /message|Forbidden|Failed to fetch|boom/.test(a.textContent)), `${naam}: geen ruwe technische tekst`);
    ok(navigaties.length === 0 && knop('Doorgaan naar betalen') && !knop('Doorgaan naar betalen').disabled, `${naam}: geen redirect, knop hersteld`);
  }

  // exception uit de client zelf
  opnieuw(() => { throw new Error('kapot'); });
  await render(React.createElement(AbonnerenBevestiging, { intentie: 'PRO' }));
  await vink();
  await klik(knop('Doorgaan naar betalen'));
  await wacht();
  ok(!!container.querySelector('[role=alert]') && navigaties.length === 0 && !knop('Doorgaan naar betalen').disabled, 'exception: melding, geen redirect, knop hersteld');

  // sessie verlopen -> centrale login, intent behouden
  opnieuw(() => httpFout(401, { error: 'Niet ingelogd.' }));
  await render(React.createElement(AbonnerenBevestiging, { intentie: 'PREMIUM' }));
  await vink();
  await klik(knop('Doorgaan naar betalen'));
  await wacht();
  ok(container.querySelector('[role=alert]').textContent.includes('Uw sessie is verlopen'), '401: sessie-verlopen-melding');
  ok(fakeApp.aanroepen.filter((a) => a[0] === 'openAuth').length === 1, '401: bestaande centrale login geopend (geen eigen login)');
  ok(JSON.parse(dom.window.localStorage.getItem('fc.koopintentie') || '{}').intentie === 'PREMIUM', '401: PREMIUM-intent bewaard');
  ok(navigaties.length === 0 && client.log.andere.length === 0, '401: geen redirect, geen andere aanroepen');
  const r401 = await startCheckout('PRO', { voorwaardenAkkoord: true });
  ok(r401.code === 'niet_ingelogd' && r401.status === 401, 'helper meldt niet_ingelogd/401');
}

// ---- G. ongeldige of ontbrekende Checkout-url ---------------------------------------------------
huidig = 'G ongeldige url';
for (const [naam, data] of [
  ['url ontbreekt', {}], ['data null', null], ['url leeg', { url: '' }], ['andere host', { url: 'https://evil.example/pay' }],
  ['http', { url: 'http://checkout.stripe.com/c/pay/x' }], ['javascript', { url: 'javascript:alert(1)' }],
  ['lookalike', { url: 'https://checkout.stripe.com.evil.com/x' }], ['url geen string', { url: { href: CHECKOUT_URL } }],
]) {
  opnieuw(() => ({ data, error: null }));
  await render(React.createElement(AbonnerenBevestiging, { intentie: 'PRO' }));
  await vink();
  await klik(knop('Doorgaan naar betalen'));
  await wacht();
  ok(navigaties.length === 0, `${naam}: GEEN redirect`);
  ok(!!container.querySelector('[role=alert]'), `${naam}: veilige foutmelding`);
  ok(!knop('Doorgaan naar betalen').disabled, `${naam}: knop hersteld`);
  ok(client.log.invoke.length === 1, `${naam}: precies één call`);
}

// ---- configuratie ontbreekt (geen Supabase) -------------------------------------------------------
huidig = 'G2 geen configuratie';
client.__reset(); client.__zetSupabase(null); navigaties = [];
{
  const r = await startCheckout('PRO', { voorwaardenAkkoord: true });
  ok(r.url === null && typeof r.error === 'string' && navigaties.length === 0, 'zonder Supabase-config: nette melding, geen redirect');
  const r2 = await startCheckout('ADMIN', { voorwaardenAkkoord: true });
  ok(r2.url === null && r2.code === 'ongeldig_plan', 'onbekend plan wordt lokaal geweigerd');
  for (const plan of ['pro', 'PRO ', 'price_123', undefined, null, { plan: 'PRO' }]) {
    const r3 = await startCheckout(plan, { voorwaardenAkkoord: true });
    ok(r3.url === null, `plan ${JSON.stringify(plan)} geweigerd`);
  }
}

// ---- profiel ontbreekt / probleem: geen betaalknop ----------------------------------------------------
huidig = 'G3 profielstaten';
opnieuw(GOED, { isLoggedIn: true, profile: null, profielProbleem: true });
await render(React.createElement(AbonnerenBevestiging, { intentie: 'PRO' }));
ok(!knop('Doorgaan naar betalen'), 'profielprobleem: geen betaalknop');
opnieuw(GOED, { isLoggedIn: true, profile: null, profielProbleem: false });
await render(React.createElement(AbonnerenBevestiging, { intentie: 'PRO' }));
ok(!knop('Doorgaan naar betalen'), 'profiel nog niet geladen: geen betaalknop');
ok(client.log.invoke.length === 0, 'geen aanroepen in deze staten');

// ---- Server beslist over trial: pagina toont, beslist niet --------------------------------------------------
huidig = 'G4 trial server-side';
opnieuw(GOED);
await render(React.createElement(AbonnerenBevestiging, { intentie: 'PRO' }));
await vink();
await klik(knop('Doorgaan naar betalen'));
await wacht();
{
  const body = client.log.invoke[0].opties.body;
  ok(JSON.stringify(Object.keys(body).sort()) === JSON.stringify(['plan', 'voorwaarden_akkoord']), 'body bevat uitsluitend plan + voorwaarden_akkoord');
  ok(!('trial' in body) && !('trial_period_days' in body) && !('price' in body) && !('priceId' in body) && !('tier' in body) && !('status' in body) && !('user_id' in body) && !('terms_version' in body), 'geen trial/prijs/tier/status/user/terms_version vanuit frontend');
}

// ---- H. geen entitlement-write vanuit de frontend (bronanalyse + runtime) ----------------------------------------------
huidig = 'H geen entitlementwrite';
{
  const root = process.env.REPO_ROOT || join(process.cwd());
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  for (const bestand of ['src/data/services/billing.js', 'src/features/kompas-marketing/AbonnerenPage.jsx']) {
    const code = strip(readFileSync(join(root, bestand), 'utf8'));
    // .delete( van URLSearchParams is geen database-aanroep; databasepaden lopen altijd via .from()/.rpc() (hieronder uitgesloten).
    ok(!/\.(update|upsert|insert)\s*\(/.test(code), `${bestand}: geen .update/.upsert/.insert`);
    ok(!/\.from\s*\(/.test(code) && !/\.rpc\s*\(/.test(code), `${bestand}: geen .from()/.rpc()`);
    ok(!/start_trial|startProefperiode/.test(code), `${bestand}: geen start_trial`);
    ok(!/subscription_(tier|active|status)|trial_(started|ends)_at|stripe_(customer|subscription)_id/.test(code), `${bestand}: raakt geen abonnements-/trialvelden`);
    ok(!/price_[A-Za-z0-9]{6,}|sk_(test|live)_|whsec_|pk_(test|live)_/.test(code), `${bestand}: geen Price-ID's of sleutels`);
    ok(!/localStorage[^;\n]*(tier|premium|pro['"])/i.test(code), `${bestand}: schrijft geen lokale entitlement`);
  }
  // de succes-/annuleer-terugkeer wijzigt nooit rechten
  const bron = strip(readFileSync(join(root, 'src/data/services/billing.js'), 'utf8'));
  ok(/leesCheckoutResultaat/.test(bron), 'terugkeer-helper bestaat (alleen melding)');
}

// ---- I. Free anoniem: routes blijven publiek, de koop-aansluiting blokkeert niets -------------------------------------
huidig = 'I Free anoniem';
{
  const root = process.env.REPO_ROOT || process.cwd();
  const routes = readFileSync(join(root, 'src/app/routes.js'), 'utf8');
  const toegang = (pad) => (routes.match(new RegExp(`pad: '${pad.replace(/\//g, '\\/')}',[^}]*toegang: '(\\w+)'`)) || [])[1];
  ok(toegang('/kompas') === 'publiek', '/kompas (Subsidie Kompas Free) blijft publiek, zonder account');
  ok(toegang('/kompas/deadlines') === 'publiek', '/kompas/deadlines blijft publiek');
  ok(toegang('/kompas/abonneren') === 'publiek', '/kompas/abonneren is publiek (anonieme bezoeker kiest en logt via de centrale login)');
  // Free-gebruik raakt billing nooit: alleen de abonneren-pagina importeert startCheckout.
  const { execSync } = await import('node:child_process');
  const gebruikers = execSync(`grep -rl "startCheckout" src --include=*.js --include=*.jsx || true`, { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean).sort();
  ok(JSON.stringify(gebruikers) === JSON.stringify(['src/data/services/billing.js', 'src/features/kompas-marketing/AbonnerenPage.jsx']), 'startCheckout wordt alleen door de abonneren-pagina gebruikt (' + gebruikers.join(', ') + ')');
}

// ---- K. koopintentie (ongewijzigd) - regressie ---------------------------------------------------------------------------
huidig = 'K koopintentie';
{
  const k = await import('../../src/data/services/koopintentie.js');
  dom.window.localStorage.clear();
  ok(k.isGeldigeIntentie('PRO') && k.isGeldigeIntentie('PREMIUM'), 'PRO en PREMIUM geldig');
  for (const x of ['pro', 'PRO_TRIAL', 'EVIL', '', null, undefined, 'constructor', '__proto__']) ok(!k.isGeldigeIntentie(x), `ongeldig: ${String(x)}`);
  ok(k.bewaarIntentie('PRO') === true && k.leesIntentie() === 'PRO', 'bewaren en lezen');
  ok(k.bewaarIntentie('EVIL') === false && k.leesIntentie() === 'PRO', 'ongeldige code verandert niets');
  ok(k.neemTeAanbiedenIntentie() === 'PRO' && k.neemTeAanbiedenIntentie() === null, 'eenmalig aanbieden');
  dom.window.localStorage.setItem('fc.koopintentie', JSON.stringify({ intentie: 'PRO', ts: Date.now() - 25 * 3600 * 1000, aangeboden: false }));
  ok(k.leesIntentie() === null, 'verloopt na 24 uur');
  k.wisIntentie();
  ok(k.intentieUitHash('#/kompas/abonneren?intent=PREMIUM') === 'PREMIUM' && k.intentieUitHash('#/x?intent=EVIL') === null, 'intent uit hash alleen uit allowlist');
  ok(k.heeftIntentParam('#/x?intent=EVIL') === true && k.heeftIntentParam('#/x') === false, 'heeftIntentParam');
  ok(k.magTerugleiden({ hash: '#/kompas/abonneren?intent=PRO', callbackBijLaden: null }) === false, 'geen terugleiding op de abonneren-pagina zelf');
  ok(k.magTerugleiden({ hash: '#/wachtwoord-instellen', callbackBijLaden: null }) === false, 'geen terugleiding tijdens wachtwoordherstel');
  ok(k.intentieVoorTier('pro') === 'PRO' && k.intentieVoorTier('free') === null, 'intentieVoorTier');
}

console.log(`\nCHECKOUT-FRONTEND: ${pass} geslaagd, ${fail} mislukt`);
process.exit(fail === 0 ? 0 : 1);
