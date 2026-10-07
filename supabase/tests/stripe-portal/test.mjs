// Tests voor de Edge Function stripe-portal (Stripe Customer Portal).
// Alles is gemockt: er is geen netwerk, geen echte Stripe- of Supabase-sleutel.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.REPO_ROOT || join(HIER, '../../..');
const OUT = process.env.TEST_OUT || join(ROOT, '_to_delete', 'portal-test');
let handler;
globalThis.Deno = { serve: (fn) => { handler = fn; }, env: { get: (k) => (globalThis.__env || {})[k] } };
await import(join(OUT, 'handler.mjs'));

let pass = 0, fail = 0, current = '';
const ok = (c, n) => { c ? pass++ : fail++; if (!c) console.log('  FAIL [' + current + ']', n); };
const sc = async (naam, fn) => { current = naam; try { await fn(); } catch (e) { fail++; console.log('  EXC [' + naam + ']', e.stack.split('\n').slice(0, 3).join(' | ')); } };
const ENV = { STRIPE_SECRET_KEY: 'sk_test_GEHEIM', APP_BASE_URL: 'https://www.example.nl/', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'srv' };
const PORTAL_URL = 'https://billing.stripe.com/p/session/test_abc123';

function world(o = {}) {
  const w = { calls: [], writes: [], reads: [], o,
    profiles: {
      'user-1': { id: 'user-1', stripe_customer_id: 'cus_own1', subscription_tier: 'pro', subscription_active: true, subscription_status: 'active', trial_ends_at: null },
      'user-2': { id: 'user-2', stripe_customer_id: 'cus_own2', subscription_tier: 'premium', subscription_active: true, subscription_status: 'trialing', trial_ends_at: null },
      'user-3': { id: 'user-3', stripe_customer_id: null, subscription_tier: 'free', subscription_active: false, subscription_status: null, trial_ends_at: null },
    },
    tokens: { tok_u1: { id: 'user-1', email: 'a@x.nl' }, tok_u2: { id: 'user-2', email: 'b@x.nl' }, tok_u3: { id: 'user-3', email: 'c@x.nl' }, tok_u4: { id: 'user-4', email: 'd@x.nl' } } };
  Object.assign(w.profiles, o.profiles || {});
  const rec = (n, a) => w.calls.push([n, a]);
  globalThis.__stripe = {
    billingPortal: { sessions: { create: async (p) => {
      rec('billingPortal.sessions.create', p);
      if (o.stripeError) throw Object.assign(new Error(o.stripeError), { code: 'api_error' });
      return { id: 'bps_1', url: 'url' in o ? o.url : PORTAL_URL, customer: p.customer };
    } } },
    // alles hieronder hoort deze functie NOOIT aan te roepen
    customers: { create: async () => { rec('customers.create'); throw new Error('ONVERWACHT'); }, retrieve: async () => { rec('customers.retrieve'); throw new Error('ONVERWACHT'); } },
    subscriptions: { update: async () => { rec('subscriptions.update'); throw new Error('ONVERWACHT'); }, cancel: async () => { rec('subscriptions.cancel'); throw new Error('ONVERWACHT'); } },
    checkout: { sessions: { create: async () => { rec('checkout.sessions.create'); throw new Error('ONVERWACHT'); } } },
  };
  globalThis.__admin = {
    auth: { getUser: async (t) => (w.tokens[t] ? { data: { user: w.tokens[t] }, error: null } : { data: { user: null }, error: { message: 'bad' } }) },
    rpc: () => { w.writes.push('rpc'); throw new Error('ONVERWACHT: rpc'); },
    from: (tabel) => {
      const q = { tabel, filters: [], cols: null };
      const b = {
        select: (c) => { q.cols = c; return b; },
        eq: (c, v) => { q.filters.push([c, v]); return b; },
        update: () => { w.writes.push(tabel + '.update'); throw new Error('ONVERWACHT: update'); },
        insert: () => { w.writes.push(tabel + '.insert'); throw new Error('ONVERWACHT: insert'); },
        upsert: () => { w.writes.push(tabel + '.upsert'); throw new Error('ONVERWACHT: upsert'); },
        delete: () => { w.writes.push(tabel + '.delete'); throw new Error('ONVERWACHT: delete'); },
        single: async () => {
          w.reads.push({ tabel, cols: q.cols, filters: q.filters });
          if (o.dbError) return { data: null, error: { code: 'XX000', message: 'db' } };
          const id = (q.filters.find((f) => f[0] === 'id') || [])[1];
          const p = tabel === 'profiles' ? w.profiles[id] : null;
          return p ? { data: { ...p }, error: null } : { data: null, error: { code: 'PGRST116', message: 'no rows' } };
        },
      };
      return b;
    },
  };
  globalThis.__env = { ...ENV, ...(o.env || {}) };
  return w;
}
const req = (body, { token = 'tok_u1', method = 'POST', auth = true, raw } = {}) => new Request('https://x/functions/v1/stripe-portal', {
  method, headers: { ...(auth && token ? { Authorization: 'Bearer ' + token } : {}), 'Content-Type': 'application/json' },
  body: method === 'POST' ? (raw !== undefined ? raw : JSON.stringify(body ?? {})) : undefined,
});
const call = async (body, opts) => { const r = await handler(req(body, opts)); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {} return { status: r.status, json: j, text: t }; };
const portalCalls = (w) => w.calls.filter((c) => c[0] === 'billingPortal.sessions.create');
const snap = (w) => JSON.stringify(w.profiles);

await sc('algemeen', async () => {
  let w = world(); let r = await handler(new Request('https://x', { method: 'OPTIONS' })); ok(r.status === 200, 'OPTIONS ok');
  r = await handler(new Request('https://x', { method: 'GET' })); ok(r.status === 405, 'GET 405');
  for (const naam of ['STRIPE_SECRET_KEY', 'APP_BASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
    w = world({ env: { [naam]: '' } }); const x = await call({}); ok(x.status === 500 && w.calls.length === 0 && w.reads.length === 0, 'ontbrekende ' + naam + ' -> 500, geen Stripe, geen DB');
  }
});
await sc('niet ingelogd -> 401', async () => {
  let w = world(); let x = await call({}, { auth: false });
  ok(x.status === 401 && w.calls.length === 0 && w.reads.length === 0, 'geen Authorization -> 401, geen Stripe, geen DB-lezing');
  w = world(); x = await call({}, { token: 'anon-key-jwt' }); ok(x.status === 401 && w.calls.length === 0 && w.reads.length === 0, 'anon/ongeldig token -> 401');
  w = world(); x = await handler(new Request('https://x', { method: 'POST', headers: { Authorization: 'Basic abc' }, body: '{}' })); ok(x.status === 401 && w.calls.length === 0, 'geen Bearer -> 401');
  w = world(); x = await call({ customer: 'cus_own1' }, { auth: false }); ok(x.status === 401 && portalCalls(w).length === 0, 'klant-id meesturen zonder login helpt niet');
});
await sc('profiel', async () => {
  let w = world(); let x = await call({}, { token: 'tok_u4' });
  ok(x.status === 403 && x.json.code === 'profiel_ontbreekt' && w.calls.length === 0, 'ingelogd zonder profiel -> 403, geen Portal, geen Stripe');
  w = world({ dbError: true }); x = await call({}); ok(x.status === 503 && w.calls.length === 0, 'DB-fout -> 503, geen Portal');
});
await sc('geen stripe_customer_id -> geen Portal', async () => {
  let w = world(); const voor = snap(w); let x = await call({}, { token: 'tok_u3' });
  ok(x.status === 409 && x.json.code === 'geen_klant' && typeof x.json.error === 'string', 'nette functionele fout (409 geen_klant)');
  ok(w.calls.length === 0, 'geen enkele Stripe-aanroep (geen Portal, geen klant aangemaakt)');
  ok(w.writes.length === 0 && snap(w) === voor, 'geen schrijfactie');
  for (const slecht of ['', '   ', 'sub_123', 'cus_', 'cus_a b', "cus_x'; drop table profiles;--", 'CUS_abc', 12345]) {
    w = world({ profiles: { 'user-3': { id: 'user-3', stripe_customer_id: slecht } } }); x = await call({}, { token: 'tok_u3' });
    ok(x.status === 409 && w.calls.length === 0, 'onbruikbare klant-id ' + JSON.stringify(slecht) + ' -> 409, geen Stripe');
  }
});
await sc('eigen klant -> Portal Session', async () => {
  const w = world(); const x = await call({});
  ok(x.status === 200 && x.json.url === PORTAL_URL && Object.keys(x.json).join() === 'url', '200 met uitsluitend { url }');
  ok(portalCalls(w).length === 1, 'precies één Portal Session aangemaakt');
  const p = portalCalls(w)[0][1];
  ok(p.customer === 'cus_own1', 'klant-id komt uit het eigen profiel (cus_own1)');
  ok(p.return_url === 'https://www.example.nl/#/kompas/account', 'return_url = accountpagina (slash van APP_BASE_URL netjes verwijderd)');
  ok(Object.keys(p).sort().join() === 'customer,locale,return_url' && p.locale === 'nl', 'alleen customer, return_url, locale (geen configuration/flow_data)');
  ok(!/localhost|127\.0\.0\.1/.test(p.return_url), 'return_url bevat geen localhost');
  ok(w.reads.length === 1 && w.reads[0].tabel === 'profiles' && w.reads[0].cols === 'id, stripe_customer_id' && JSON.stringify(w.reads[0].filters) === '[["id","user-1"]]', 'profiel gelezen: alleen id + stripe_customer_id, gefilterd op de ingelogde user-id');
  ok(!x.text.includes('sk_test') && !x.text.includes('cus_own1') && !x.text.includes('srv'), 'respons bevat geen geheimen of klant-id');
  const w2 = world({ env: { APP_BASE_URL: 'https://www.fondsenwerverscollectief.nl///' } }); await call({});
  ok(portalCalls(w2)[0][1].return_url === 'https://www.fondsenwerverscollectief.nl/#/kompas/account', 'canonieke productie-URL -> correcte return_url');
});
await sc('wisselende gebruikers: altijd de EIGEN klant', async () => {
  const w = world(); await call({}, { token: 'tok_u1' }); await call({}, { token: 'tok_u2' });
  const klanten = portalCalls(w).map((c) => c[1].customer);
  ok(klanten.join() === 'cus_own1,cus_own2', 'user-1 -> cus_own1, user-2 -> cus_own2 (nooit verwisseld)');
});
await sc('frontend kan geen andere klant injecteren', async () => {
  const evil = { customer: 'cus_evil', customer_id: 'cus_evil', stripe_customer_id: 'cus_evil', customerId: 'cus_evil', user_id: 'user-2', userId: 'user-2', id: 'user-2', return_url: 'https://evil.example/x', returnUrl: 'https://evil.example/x', configuration: 'bpc_evil', flow_data: { type: 'subscription_cancel' }, locale: 'xx', url: 'https://evil.example' };
  let w = world(); let x = await call(evil);
  ok(x.status === 200 && portalCalls(w)[0][1].customer === 'cus_own1', 'body met evil klant-id/user-id -> eigen klant (cus_own1)');
  ok(!JSON.stringify(w.calls).includes('evil') && !JSON.stringify(w.calls).includes('bpc_') && !JSON.stringify(w.reads).includes('user-2'), 'niets uit de body bereikt Stripe of de database');
  ok(portalCalls(w)[0][1].return_url.startsWith('https://www.example.nl/'), 'return_url niet uit body');
  w = world(); x = await call(null, { raw: 'dit is geen json {{{' }); ok(x.status === 200, 'ongeldige/ontbrekende body maakt niets uit: body wordt nooit gelezen');
  w = world(); x = await handler(new Request('https://x', { method: 'POST', headers: { Authorization: 'Bearer tok_u1' } })); ok(x.status === 200, 'POST helemaal zonder body werkt');
  w = world(); x = await call(evil, { token: 'tok_u3' }); ok(x.status === 409 && w.calls.length === 0, 'gebruiker zonder eigen klant kan er ook geen "lenen" via de body');
  w = world(); x = await call({ customer: 'cus_own2' }, { token: 'tok_u3' }); ok(x.status === 409 && w.calls.length === 0, 'klant-id van een ander meesturen geeft geen Portal');
  const bron = readFileSync(join(ROOT, 'supabase/functions/stripe-portal/index.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  ok(!/\breq\.(json|text|formData|arrayBuffer|blob|body)\b/.test(bron), 'bronscan: de request-body wordt nergens gelezen (alleen req.method en req.headers)');
});
await sc('geen entitlement-/tier-/subscription-writes', async () => {
  const w = world(); const voor = snap(w);
  await call({}); await call({}, { token: 'tok_u2' }); await call({}, { token: 'tok_u3' });
  ok(w.writes.length === 0, 'geen enkele update/insert/upsert/delete/rpc');
  ok(snap(w) === voor, 'alle profielen ongewijzigd (tier, active, status, trial)');
  ok(!w.calls.some((c) => /subscriptions\.|customers\.|checkout\./.test(c[0])), 'Stripe: geen subscription-, klant- of checkout-aanroepen');
  const bron = readFileSync(join(ROOT, 'supabase/functions/stripe-portal/index.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  ok(!/\.(update|insert|upsert|delete)\s*\(|\.rpc\s*\(/.test(bron), 'bronscan: geen .update/.insert/.upsert/.delete/.rpc');
  ok(!/subscription_(tier|active|status|current_period_end|cancel_at_period_end)|trial_(started|ends)_at|stripe_subscription_id|role/.test(bron), 'bronscan: raakt geen abonnements-/toegangsvelden');
  ok((bron.match(/\.from\(/g) || []).length === 1 && /\.from\('profiles'\)\s*\.select\('id, stripe_customer_id'\)/.test(bron.replace(/\s+/g, ' ').replace(/\) \./g, ').')), 'bronscan: precies één lezing van profiles (id, stripe_customer_id)');
});
await sc('Stripe-fouten worden veilig afgehandeld', async () => {
  let w = world({ stripeError: 'No such customer: cus_own1; key sk_test_GEHEIM' }); let x = await call({});
  ok(x.status === 502 && typeof x.json.error === 'string' && !x.text.includes('sk_test') && !x.text.includes('cus_own1') && !x.text.includes('No such customer'), 'Stripe-fout -> 502 met neutrale melding, geen lek van sleutel/klant/Stripe-tekst');
  ok(w.writes.length === 0, 'Stripe-fout leidt niet tot schrijfacties');
  w = world({ stripeError: 'The customer portal has not been configured' }); x = await call({}); ok(x.status === 502 && w.writes.length === 0, 'niet-geconfigureerd portal (Dashboard) -> 502, niets gewijzigd');
  for (const url of [undefined, null, '', 'https://evil.example/p/x', 'http://billing.stripe.com/p/x', 'https://billing.stripe.com.evil.com/x', 'https://user:pw@billing.stripe.com/x', 'javascript:alert(1)', 'https://checkout.stripe.com/c/pay/x', 42]) {
    w = world({ url }); x = await call({});
    ok(x.status === 502 && !x.text.includes('evil') && !('url' in (x.json || {})), 'ongeldige Portal-url ' + String(url) + ' -> 502, niet doorgegeven');
  }
});
await sc('dubbelklik / duplicate requests', async () => {
  let w = world(); const voor = snap(w);
  const [a, b, c] = await Promise.all([call({}), call({}), call({})]);
  ok([a, b, c].every((r) => r.status === 200 && r.json.url === PORTAL_URL), 'drie gelijktijdige verzoeken: alle drie 200 met een Portal-url');
  ok(w.writes.length === 0 && snap(w) === voor, 'geen schrijfactie en profiel ongewijzigd: geen entitlement-probleem');
  ok(portalCalls(w).every((c) => c[1].customer === 'cus_own1'), 'alle sessies voor dezelfde eigen klant');
  w = world(); await call({}); const x = await call({}); ok(x.status === 200 && w.writes.length === 0, 'opeenvolgende verzoeken: nog steeds geen writes');
});
await sc('Portal geeft of ontneemt geen rechten (alleen Stripe/webhook)', async () => {
  const w = world(); const voor = snap(w);
  await call({}, { token: 'tok_u1' }); await call({}, { token: 'tok_u2' });
  ok(JSON.parse(snap(w))['user-1'].subscription_tier === 'pro' && JSON.parse(snap(w))['user-2'].subscription_tier === 'premium', 'tier blijft gelijk na het openen van de Portal');
  ok(snap(w) === voor, 'ook geen subscription_status/trial-wijziging; de geverifieerde webhook blijft de enige bron van waarheid');
});

console.log(`\nSTRIPE-PORTAL: ${pass} geslaagd, ${fail} mislukt`); process.exit(fail ? 1 : 0);
