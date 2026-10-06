// Browser-e2e fase 2D: geen echte Stripe/Supabase. Alle externe hosts zijn gemockt;
// checkout.stripe.com is een lokale stubpagina (er wordt nooit echt afgerekend).
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

// Gebruik: DIST=<map met mock-build> [PLAYWRIGHT=<pad naar playwright>] [CHROMIUM=<pad>] node tests/checkout-frontend/e2e-browser.mjs
// Bouw eerst met: VITE_SUPABASE_URL=https://mock.supabase.test VITE_SUPABASE_ANON_KEY=mock-anon-key npx vite build --outDir <map> --emptyOutDir
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
const DIST = process.env.DIST;
if (!DIST) { console.error('DIST ontbreekt'); process.exit(2); }
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = join(DIST, p);
  if (existsSync(f) && !f.endsWith('/')) { res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f)); }
  else { res.writeHead(404); res.end(); }
}).listen(4174);
const ORIGIN = 'http://localhost:4174';
const CHECKOUT_URL = 'https://checkout.stripe.com/c/pay/cs_test_MOCK#frag';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (sub) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
const USER = { id: '11111111-1111-1111-1111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'test@example.com', email_confirmed_at: '2026-10-05T10:00:00Z', app_metadata: { provider: 'email' }, user_metadata: { first_name: 'Test', last_name: 'Gebruiker' }, identities: [{ id: 'x' }], created_at: '2026-10-05T10:00:00Z' };
const PROFILE = { id: USER.id, first_name: 'Test', last_name: 'Gebruiker', email: 'test@example.com', member_type: 'zzp', status: 'approved', role: 'member', subscription_tier: 'free', subscription_active: false, trial_started_at: null, trial_ends_at: null, stripe_customer_id: null, stripe_subscription_id: null };

let results = [], current = null;
const ok = (c, msg) => { results.push([c, current + ': ' + msg]); if (!c) console.log('  FAIL:', msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ctxMake(browser, state) {
  const context = await browser.newContext();
  const log = [];          // alle Supabase-requests (methode + pad)
  const fn = [];           // create-checkout-session-requests
  const stripe = [];       // bezoeken aan het gemockte checkout.stripe.com
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  await context.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (u.origin === ORIGIN) return route.fallback();
    const m = route.request().method();
    if (u.hostname === 'checkout.stripe.com') { stripe.push(u.href); return route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>STRIPE-CHECKOUT-MOCK</body></html>' }); }
    if (u.hostname === 'mock.supabase.test') {
      log.push(`${m} ${u.pathname}${u.search}`);
      const j = (o, s = 200) => route.fulfill({ status: s, contentType: 'application/json', headers: cors, body: JSON.stringify(o) });
      if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      const p = u.pathname;
      if (p === '/functions/v1/create-checkout-session') {
        fn.push({ method: m, auth: route.request().headers()['authorization'] || '', body: route.request().postData() || '' });
        if (state.vertraging) await sleep(state.vertraging);
        const h = state.handler ? state.handler(fn.length) : state.metFout409 && state.fase !== 2 ? { status: 409, body: { error: 'Er is al een lopend abonnement gekoppeld aan dit account.', code: 'abonnement_bestaat' } } : { status: 200, body: { url: CHECKOUT_URL } };
        return j(h.body, h.status);
      }
      if (p === '/auth/v1/signup') return j({ id: USER.id, email: 'nieuw@example.com', identities: [{ id: 'i' }], created_at: USER.created_at, user_metadata: {}, app_metadata: {}, aud: 'authenticated' });
      if (p === '/auth/v1/token') return j({ access_token: jwt(USER.id), refresh_token: 'r1', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: USER });
      if (p === '/auth/v1/user') return j(USER);
      if (p === '/auth/v1/logout') return route.fulfill({ status: 204, headers: cors });
      if (p === '/auth/v1/recover') return j({});
      if (p === '/rest/v1/profiles') {
        const acc = route.request().headers()['accept'] || '';
        // state.pro = de (nagebootste) Stripe-webhook heeft het abonnement vastgelegd
        const prof = state.pro ? { ...PROFILE, subscription_tier: 'pro', subscription_active: true, subscription_status: 'trialing', stripe_customer_id: 'cus_mock', stripe_subscription_id: 'sub_mock', trial_started_at: '2026-10-06T18:00:51Z', trial_ends_at: '2099-10-13T18:00:51Z' } : PROFILE;
        if (state.pro) state.proGelezen = (state.proGelezen || 0) + 1;
        return acc.includes('vnd.pgrst.object') ? j(prof) : j([prof]);
      }
      if (p.startsWith('/rest/v1/')) return j([]);
      return j({});
    }
    return route.abort();
  });
  return { context, log, fn, stripe, state };
}

const hashOf = (page) => page.evaluate(() => window.location.hash);
const store = (page) => page.evaluate(() => window.localStorage.getItem('fc.koopintentie'));
async function inloggenViaModal(page) {
  await page.getByPlaceholder('naam@organisatie.nl').fill('test@example.com');
  await page.getByPlaceholder('••••••••').fill('wachtwoord123');
  await page.locator('button', { hasText: /^Inloggen$/ }).last().click();
}
// Veiligheidsregels voor ELKE scenario: nooit start_trial, nooit een schrijfactie op profiles,
// nooit een tweede soort entitlement-pad.
const SCHRIJF = (log) => log.filter((l) => /^(POST|PATCH|PUT|DELETE) \/rest\/v1\/(profiles|stripe|subscription)/.test(l) || /rpc\/(start_trial|admin_set_subscription|stripe_)/.test(l));

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });

async function scenario(naam, fn, state = {}) {
  current = naam;
  console.log('>>', naam);
  const c = await ctxMake(browser, state);
  const page = await c.context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  try { await fn(page, c); } catch (e) { ok(false, 'uitzondering: ' + String(e).slice(0, 300)); }
  ok(SCHRIJF(c.log).length === 0, 'geen start_trial en geen schrijfactie op profiles/entitlement (' + JSON.stringify(SCHRIJF(c.log)) + ')');
  ok(errors.length === 0, 'geen pagina-fouten ' + errors.join('|'));
  await c.context.close();
}

async function naarBevestiging(page, code, cta) {
  await page.goto(ORIGIN + '/#/hoe-het-werkt');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: cta }).click();
  await sleep(300);
  await page.getByRole('button', { name: 'Inloggen', exact: true }).first().click();
  await inloggenViaModal(page);
  await page.waitForSelector('input[type=checkbox]');
}

// A. Free anoniem
await scenario('A Free anoniem blijft werken', async (page, c) => {
  await page.goto(ORIGIN + '/#/kompas');
  await page.waitForLoadState('networkidle'); await sleep(800);
  ok((await page.locator('body').innerText()).length > 200, 'Kompas toont inhoud zonder login');
  ok(!(await page.locator('[aria-label="Sluiten"]').isVisible().catch(() => false)), 'geen login-overlay');
  ok((await hashOf(page)) === '#/kompas', 'URL blijft #/kompas');
  ok(c.fn.length === 0 && c.stripe.length === 0, 'geen checkout-aanroep, geen Stripe');
  ok(c.log.every((l) => !l.includes('/auth/v1/token')), 'geen inlogpoging');
});

// B. niet ingelogd: intent blijft, geen checkout
await scenario('B niet ingelogd', async (page, c) => {
  await page.goto(ORIGIN + '/#/hoe-het-werkt'); await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Start 7 dagen gratis' }).click(); await sleep(400);
  ok((await hashOf(page)) === '#/kompas/abonneren?intent=PRO', 'URL = abonneren?intent=PRO');
  ok(JSON.parse(await store(page)).intentie === 'PRO', 'intent bewaard');
  ok(!(await page.locator('input[type=checkbox]').count()) && !(await page.getByRole('button', { name: 'Doorgaan naar betalen' }).count()), 'geen vinkje en geen betaalknop');
  await page.getByRole('button', { name: 'Inloggen', exact: true }).first().click();
  ok(await page.getByPlaceholder('naam@organisatie.nl').isVisible(), 'centrale Collectief-login geopend');
  ok(c.fn.length === 0, 'geen create-checkout-session-aanroep vóór auth');
});

// C/D. PRO en PREMIUM: volledige flow tot de Stripe-redirect
for (const [code, cta] of [['PRO', 'Start 7 dagen gratis'], ['PREMIUM', 'Probeer Premium 24 uur']]) {
  await scenario(`C ${code}: login -> akkoord -> Stripe-redirect`, async (page, c) => {
    await naarBevestiging(page, code, cta);
    ok((await hashOf(page)) === `#/kompas/abonneren?intent=${code}`, 'op de bevestigingsstap');
    ok(await page.getByRole('button', { name: 'Doorgaan naar betalen' }).isDisabled(), 'knop uit zonder akkoord');
    ok(c.fn.length === 0, 'login start niets (geen checkout-call)');
    await page.getByRole('button', { name: 'Doorgaan naar betalen' }).click({ force: true });
    await sleep(300);
    ok(c.fn.length === 0, 'klik zonder akkoord: geen API-call');
    await page.locator('input[type=checkbox]').check();
    await page.getByRole('button', { name: 'Doorgaan naar betalen' }).click();
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 8000 });
    ok(page.url() === CHECKOUT_URL, 'browser staat op de door de server teruggegeven Checkout-url');
    ok(c.fn.length === 1, 'exact één create-checkout-session-call (' + c.fn.length + ')');
    ok(c.fn[0] && JSON.stringify(JSON.parse(c.fn[0].body)) === JSON.stringify({ plan: code, voorwaarden_akkoord: true }), 'body exact {plan, voorwaarden_akkoord:true}: ' + (c.fn[0] && c.fn[0].body));
    ok(c.fn[0] && c.fn[0].auth.startsWith('Bearer ') && c.fn[0].auth !== 'Bearer mock-anon-key' && c.fn[0].auth.split('.').length === 3, 'sessie-JWT van de ingelogde gebruiker meegestuurd (niet de anon-key)');
    ok(c.stripe.length === 1, 'alleen de gemockte Checkout-pagina bezocht');
  });
}

// E. dubbelklik
await scenario('E dubbelklik', async (page, c) => {
  await naarBevestiging(page, 'PRO', 'Start 7 dagen gratis');
  await page.locator('input[type=checkbox]').check();
  await page.getByRole('button', { name: 'Doorgaan naar betalen' }).dblclick();
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 8000 });
  ok(c.fn.length === 1, 'dubbelklik veroorzaakt exact één request (' + c.fn.length + ')');
}, { vertraging: 500 });

// F. backendfout
await scenario('F backendfout 409 en herstel', async (page, c) => {
  await naarBevestiging(page, 'PRO', 'Start 7 dagen gratis');
  await page.locator('input[type=checkbox]').check();
  await page.getByRole('button', { name: 'Doorgaan naar betalen' }).click();
  await page.getByRole('alert').waitFor();
  const t = await page.getByRole('alert').innerText();
  ok(t.includes('Er is al een lopend abonnement gekoppeld aan dit account.'), 'begrijpelijke melding: ' + t);
  ok((await hashOf(page)) === '#/kompas/abonneren?intent=PRO' && page.url().startsWith(ORIGIN), 'gebruiker blijft op /kompas/abonneren');
  ok(c.stripe.length === 0, 'geen redirect naar Stripe');
  ok(await page.getByRole('button', { name: 'Doorgaan naar betalen' }).isEnabled(), 'knop weer bruikbaar');
  ok(JSON.parse(await store(page)).intentie === 'PRO', 'intent behouden');
  c.state.fase = 2;
  await page.getByRole('button', { name: 'Doorgaan naar betalen' }).click();
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 8000 });
  ok(c.fn.length === 2, 'tweede poging na herstel werkt (2 calls)');
}, { metFout409: true });

// G. ongeldige Checkout-url
await scenario('G ongeldige url wordt nooit geopend', async (page, c) => {
  await naarBevestiging(page, 'PREMIUM', 'Probeer Premium 24 uur');
  await page.locator('input[type=checkbox]').check();
  await page.getByRole('button', { name: 'Doorgaan naar betalen' }).click();
  await page.getByRole('alert').waitFor();
  await sleep(500);
  ok(page.url().startsWith(ORIGIN) && c.stripe.length === 0, 'geen navigatie weg van de pagina (' + page.url() + ')');
  ok(await page.getByRole('button', { name: 'Doorgaan naar betalen' }).isEnabled(), 'knop hersteld');
}, { handler: () => ({ status: 200, body: { url: 'https://evil.example/pay' } }) });

// H. 401: terug naar de centrale login, keuze behouden
await scenario('H sessie verlopen (401) -> centrale login', async (page, c) => {
  await naarBevestiging(page, 'PRO', 'Start 7 dagen gratis');
  await page.locator('input[type=checkbox]').check();
  await page.getByRole('button', { name: 'Doorgaan naar betalen' }).click();
  await page.getByRole('alert').waitFor();
  ok((await page.getByRole('alert').innerText()).includes('Uw sessie is verlopen'), 'melding over verlopen sessie');
  await page.getByPlaceholder('naam@organisatie.nl').waitFor({ timeout: 4000 });
  ok(true, 'bestaande Collectief-loginoverlay geopend (geen eigen login)');
  ok(JSON.parse(await store(page)).intentie === 'PRO', 'PRO-intent bewaard');
  ok(c.stripe.length === 0, 'geen redirect');
}, { handler: () => ({ status: 401, body: { error: 'Niet ingelogd.' } }) });

// I. cancel en success zijn alleen meldingen
await scenario('I checkout=cancelled', async (page, c) => {
  await page.goto(ORIGIN + '/#/kompas/abonneren?intent=PREMIUM&checkout=cancelled'); await page.waitForLoadState('networkidle'); await sleep(600);
  const t = await page.locator('body').innerText();
  ok(t.includes('De betaling is niet afgerond. Er is niets in rekening gebracht en er is niets geactiveerd.'), 'melding bij annuleren');
  ok(t.includes('24 uur gratis') && t.includes('€39 per maand excl. btw'), 'bevestigingsflow voor PREMIUM blijft bereikbaar');
  ok(c.fn.length === 0, 'terugkeer start geen nieuwe checkout');
});
await scenario('J checkout=success geeft geen rechten', async (page, c) => {
  await naarBevestiging(page, 'PRO', 'Start 7 dagen gratis');
  await page.evaluate(() => { window.location.hash = '#/kompas/account?checkout=success'; }); await sleep(900);
  const t = await page.locator('body').innerText();
  ok(t.includes('wordt door Stripe verwerkt') && t.includes('Er is nog niets geactiveerd'), 'neutrale succes-melding');
  ok(!/Pro-abonnement actief|Premium-abonnement actief/.test(t), 'geen rechten uit de redirect');
  ok(c.fn.length === 0, 'geen extra checkout');
});

// K. success, maar de webhook komt later dan de terugkeer: de melding volgt het PROFIEL
await scenario('K success: webhook later dan de terugkeer', async (page, c) => {
  await naarBevestiging(page, 'PRO', 'Start 7 dagen gratis');
  ok(JSON.parse(await store(page)).intentie === 'PRO', 'PRO-intent bewaard vóór de betaling');
  await page.evaluate(() => { window.location.hash = '#/kompas/account?checkout=success'; }); await sleep(900);
  let t = await page.locator('body').innerText();
  ok(t.includes('wordt door Stripe verwerkt') && t.includes('Er is nog niets geactiveerd'), 'webhook nog niet binnen: neutrale verwerkingsmelding');
  ok(!t.includes('abonnement is actief'), 'geen succes uit de redirect alleen');
  ok(JSON.parse(await store(page)).intentie === 'PRO', 'intent blijft staan zolang het profiel niets toont');
  c.state.pro = true; // de webhook heeft het abonnement vastgelegd
  await page.waitForFunction(() => document.body.innerText.includes('Uw Pro-abonnement is actief.'), null, { timeout: 15000 });
  t = await page.locator('body').innerText();
  ok(!t.includes('Er is nog niets geactiveerd') && !t.includes('wordt door Stripe verwerkt'), 'tegenstrijdige verwerkingsmelding is verdwenen');
  ok(/membership\s*pro/i.test(t), 'Membership toont Pro (uit het profiel)');
  ok(await store(page) === null, 'koopintentie opgeruimd zodra het profiel Pro bevestigt');
  const gelezen = c.state.proGelezen;
  await sleep(4000);
  ok(c.state.proGelezen === gelezen, 'na bevestiging stopt het opnieuw lezen van het profiel');
  ok(c.fn.length === 0 && c.stripe.length === 0, 'geen extra checkout');
});
await scenario('L success: webhook al verwerkt bij het laden', async (page, c) => {
  await naarBevestiging(page, 'PRO', 'Start 7 dagen gratis');
  c.state.pro = true;
  await page.goto(ORIGIN + '/?terugkeer=1#/kompas/account?checkout=success'); await page.waitForLoadState('networkidle'); await sleep(1200);
  const t = await page.locator('body').innerText();
  ok(t.includes('Uw Pro-abonnement is actief.'), 'directe, juiste succesmelding');
  ok(!t.includes('Er is nog niets geactiveerd') && !t.includes('wordt door Stripe verwerkt'), 'geen tegenstrijdige verwerkingsmelding');
  ok(/membership\s*pro/i.test(t), 'Membership toont Pro');
  ok(await store(page) === null, 'koopintentie opgeruimd');
  ok(!(await hashOf(page)).includes('checkout='), 'checkout-parameter uit de adresbalk gehaald');
});
await scenario('M success zonder account-bevestiging: geen toegang uit de redirect', async (page, c) => {
  await naarBevestiging(page, 'PRO', 'Start 7 dagen gratis');
  await page.goto(ORIGIN + '/?terugkeer=2#/kompas/account?checkout=success'); await page.waitForLoadState('networkidle'); await sleep(1200);
  const t = await page.locator('body').innerText();
  ok(t.includes('Er is nog niets geactiveerd') && !t.includes('abonnement is actief'), 'profiel free: alleen de verwerkingsmelding');
  ok(/membership\s*free/i.test(t), 'Membership blijft Free zolang het profiel dat zegt');
  ok(JSON.parse(await store(page)).intentie === 'PRO', 'intent niet opgeruimd door de redirect alleen');
});
// N. cancel: terugkeer is veilig, intent blijft, opnieuw proberen werkt
await scenario('N cancel: intent blijft en opnieuw proberen werkt', async (page, c) => {
  await naarBevestiging(page, 'PRO', 'Start 7 dagen gratis');
  await page.goto(ORIGIN + '/?terugkeer=3#/kompas/abonneren?intent=PRO&checkout=cancelled'); await page.waitForLoadState('networkidle'); await sleep(1200);
  const t = await page.locator('body').innerText();
  ok(t.includes('De betaling is niet afgerond. Er is niets in rekening gebracht en er is niets geactiveerd.'), 'cancel-melding');
  ok(JSON.parse(await store(page)).intentie === 'PRO', 'PRO-intent blijft beschikbaar');
  ok(c.fn.length === 0, 'terugkeer start geen nieuwe checkout');
  ok(!(await hashOf(page)).includes('checkout='), 'cancel-parameter uit de adresbalk gehaald');
  await page.locator('input[type=checkbox]').check();
  await page.getByRole('button', { name: 'Doorgaan naar betalen' }).click();
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 8000 });
  ok(c.fn.length === 1 && JSON.stringify(JSON.parse(c.fn[0].body)) === JSON.stringify({ plan: 'PRO', voorwaarden_akkoord: true }), 'opnieuw proberen: exact één aanroep met alleen plan + akkoord');
  ok(c.state.pro !== true, 'geen tierwijziging door cancel of opnieuw proberen');
});

const mislukt = results.filter((r) => !r[0]);
console.log(`\nBROWSER-E2E 2D: ${results.length - mislukt.length}/${results.length} checks geslaagd`);
for (const m of mislukt) console.log('MISLUKT:', m[1]);
await browser.close(); server.close();
process.exit(mislukt.length ? 1 : 0);
