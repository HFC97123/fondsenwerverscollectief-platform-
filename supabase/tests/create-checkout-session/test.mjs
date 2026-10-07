import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HIER = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.REPO_ROOT || join(HIER, '../../..');
const OUT = process.env.TEST_OUT || join(ROOT, '_to_delete', 'ccs-test');
let handler;
globalThis.Deno = { serve: (fn) => { handler = fn; }, env: { get: (k) => (globalThis.__env || {})[k] } };
await import(join(OUT, 'handler.mjs'));
const tick = () => new Promise((r) => setImmediate(r));
let pass = 0, fail = 0, current = '';
const ok = (c, n) => { c ? pass++ : fail++; if (!c) console.log('  FAIL [' + current + ']', n); };
const ENV = { STRIPE_SECRET_KEY: 'sk_test_x', APP_BASE_URL: 'https://www.example.nl/', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'srv', STRIPE_PRO_PRICE_ID: 'price_pro', STRIPE_PREMIUM_PRICE_ID: 'price_premium', TERMS_VERSION: '2026-10-05' };
const U1 = { id: 'user-1', email: 'u1@example.com' };

function world(o = {}) {
  const w = { calls: [], customers: {}, subs: [], sessions: [], updates: [], clock: Math.floor(Date.now() / 1000) - 100, seq: 0, o,
    taxSettings: o.taxSettings || { status: 'active', defaults: { tax_behavior: 'exclusive' } },
    prices: { price_pro: { id: 'price_pro', active: true, currency: 'eur', unit_amount: 1200, recurring: { interval: 'month', interval_count: 1 } }, price_premium: { id: 'price_premium', active: true, currency: 'eur', unit_amount: 3900, recurring: { interval: 'month', interval_count: 1 } } },
    profiles: { 'user-1': { id: 'user-1', role: 'member', subscription_tier: 'free', subscription_active: false, subscription_started_at: null, trial_ends_at: null, stripe_customer_id: null, stripe_subscription_id: null, trial_started_at: null, ...(o.profile || {}) } },
    tokens: { tok_u1: U1, tok_u2: { id: 'user-2', email: 'u2@example.com' } } };
  if (o.noProfile) delete w.profiles['user-1'];
  Object.assign(w.prices, o.prices || {});
  const rec = (n, a) => w.calls.push([n, a]);
  const maybeTick = async () => { if (o.interleave) { await tick(); await tick(); } };
  const err = (code, msg) => Object.assign(new Error(msg || code), { code });
  globalThis.__stripe = {
    tax: { settings: { retrieve: async () => { rec('tax.settings.retrieve', null); if (o.fail === 'tax') throw err('api_error'); return w.taxSettings; } } },
    prices: { retrieve: async (id) => { rec('prices.retrieve', id); await maybeTick(); if (o.fail === 'price') throw err('api_error'); if (!w.prices[id]) throw err('resource_missing'); return w.prices[id]; } },
    customers: {
      retrieve: async (id) => { rec('customers.retrieve', id); if (!w.customers[id]) throw err('resource_missing'); return w.customers[id]; },
      create: async (p) => { rec('customers.create', p); await maybeTick(); const id = 'cus_' + (++w.seq); w.customers[id] = { id, ...p }; return w.customers[id]; },
    },
    subscriptions: {
      list: async (p) => { rec('subscriptions.list', p); await maybeTick(); if (o.fail === 'subs') throw err('api_error'); return { data: w.subs.filter((s) => s.customer === p.customer) }; },
      retrieve: async (id) => { rec('subscriptions.retrieve', id); const s = w.subs.find((x) => x.id === id); if (!s) throw err('resource_missing'); return s; },
    },
    checkout: { sessions: {
      list: async (p) => { rec('sessions.list', p); await maybeTick(); return { data: w.sessions.filter((s) => s.customer === p.customer && s.status === p.status) }; },
      create: async (params) => { rec('sessions.create', params); await maybeTick(); if (o.fail === 'create') throw err('api_error'); const id = 'cs_' + (++w.seq); const s = { id, url: o.noUrl ? null : 'https://checkout.stripe.test/' + id, status: 'open', created: ++w.clock, customer: params.customer, metadata: params.metadata, automatic_tax: params.automatic_tax, params }; w.sessions.push(s); return s; },
      expire: async (id) => { rec('sessions.expire', id); const s = w.sessions.find((x) => x.id === id); if (!s || s.status !== 'open') throw err('resource_invalid'); s.status = 'expired'; return s; },
    } },
  };
  const exec = async (q) => {
    if (o.dbError) return { data: null, error: { code: 'XX000', message: 'db' } };
    const id = (q.filters.find((f) => f[1] === 'id') || [])[2];
    const p = w.profiles[id];
    if (!p) return { data: null, error: { code: 'PGRST116', message: 'no rows' } };
    if (q.op === 'update') {
      for (const f of q.filters) if (f[0] === 'is' && p[f[1]] !== null) return { data: null, error: { code: 'PGRST116' } };
      w.updates.push({ id, ...q.obj });
      if (o.lostRace) { p.stripe_customer_id = o.lostRace; return { data: null, error: { code: 'PGRST116' } }; }
      Object.assign(p, q.obj);
      return { data: { stripe_customer_id: p.stripe_customer_id }, error: null };
    }
    return { data: { ...p }, error: null };
  };
  globalThis.__admin = {
    auth: { getUser: async (t) => (w.tokens[t] ? { data: { user: w.tokens[t] }, error: null } : { data: { user: null }, error: { message: 'bad' } }) },
    from: () => { const q = { op: 'select', filters: [] }; const b = { select: () => b, update: (obj) => { q.op = 'update'; q.obj = obj; return b; }, eq: (c, v) => { q.filters.push(['eq', c, v]); return b; }, is: (c, v) => { q.filters.push(['is', c, v]); return b; }, single: () => exec(q) }; return b; },
  };
  globalThis.__env = { ...ENV, ...(o.env || {}) };
  return w;
}
const req = (body, { token = 'tok_u1', method = 'POST', auth = true } = {}) => new Request('https://x/functions/v1/create-checkout-session', { method, headers: { ...(auth && token ? { Authorization: 'Bearer ' + token } : {}), 'Content-Type': 'application/json' }, body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined });
const call = async (body, opts) => { const r = await handler(req(body, opts)); let j = null; try { j = await r.json(); } catch {} return { status: r.status, json: j }; };
const OK = { plan: 'PRO', voorwaarden_akkoord: true };
const created = (w) => w.calls.filter((c) => c[0] === 'sessions.create').map((c) => c[1]);
const stripeCalls = (w) => w.calls.length;
const open = (w) => w.sessions.filter((s) => s.status === 'open').length;
const sc = async (naam, fn) => { current = naam; try { await fn(); } catch (e) { fail++; console.log('  EXC [' + naam + ']', e.stack.split('\n').slice(0, 3).join(' | ')); } };

await sc('algemeen', async () => {
  let w = world(); let r = await handler(new Request('https://x', { method: 'OPTIONS' })); ok(r.status === 200, 'OPTIONS ok');
  r = await handler(new Request('https://x', { method: 'GET' })); ok(r.status === 405, 'GET 405');
  w = world({ env: { STRIPE_SECRET_KEY: '' } }); let x = await call(OK); ok(x.status === 500 && stripeCalls(w) === 0, 'ontbrekende config 500');
  w = world({ env: { STRIPE_PRO_PRICE_ID: '' } }); x = await call(OK); ok(x.status === 500 && created(w).length === 0, 'ontbrekende price-secret 500');
  for (const tv of ['', '2026-10', 'v1', '05-10-2026', '2026-10-05 ', '2026-10-05; drop']) { w = world({ env: { TERMS_VERSION: tv } }); x = await call(OK); ok(x.status === 500 && stripeCalls(w) === 0, 'TERMS_VERSION ' + JSON.stringify(tv) + ' ontbreekt/ongeldig -> 500, geen Checkout'); }
});
await sc('anoniem', async () => {
  let w = world(); let x = await call(OK, { auth: false }); ok(x.status === 401 && stripeCalls(w) === 0, 'geen Authorization -> 401, geen Stripe');
  w = world(); x = await call(OK, { token: 'anon-key-jwt' }); ok(x.status === 401 && stripeCalls(w) === 0, 'anon/ongeldig token -> 401, geen Stripe');
});
await sc('profiel', async () => {
  let w = world({ noProfile: true }); let x = await call(OK); ok(x.status === 403 && x.json.code === 'profiel_ontbreekt' && stripeCalls(w) === 0 && w.updates.length === 0, 'auth zonder profiel -> 403 gecontroleerd, geen Stripe, geen klant, geen schrijfactie');
  w = world({ dbError: true }); x = await call(OK); ok(x.status === 503 && stripeCalls(w) === 0, 'DB-fout -> 503, geen Stripe');
});
await sc('input', async () => {
  for (const bad of ['pro', 'premium', 'FREE', 'ADMIN', 'PRO ', '', null, undefined, ['PRO'], { x: 1 }, 1, true]) {
    const w = world(); const x = await call({ plan: bad, voorwaarden_akkoord: true }); ok(x.status === 400 && stripeCalls(w) === 0, 'ongeldig plan ' + JSON.stringify(bad) + ' geweigerd zonder Stripe');
  }
  let w = world(); let x = await call({ tier: 'pro', voorwaarden_akkoord: true }); ok(x.status === 400, 'oude body {tier} geweigerd');
  w = world(); x = await call('geen json'); ok(x.status === 400, 'ongeldige JSON 400');
  w = world(); x = await call({ plan: 'PRO' }); ok(x.status === 400 && x.json.code === 'akkoord_vereist' && stripeCalls(w) === 0, 'zonder akkoord geweigerd');
  for (const bad of ['true', 1, 'yes', {}, false]) { w = world(); x = await call({ plan: 'PRO', voorwaarden_akkoord: bad }); ok(x.status === 400 && stripeCalls(w) === 0, 'akkoord ' + JSON.stringify(bad) + ' geweigerd'); }
});
await sc('PRO trial', async () => {
  const w = world(); const x = await call(OK); ok(x.status === 200 && /^https:\/\/checkout\.stripe\.test\//.test(x.json.url), '200 + url');
  ok(Object.keys(x.json).join() === 'url', 'respons bevat alleen url');
  const [p] = created(w); ok(created(w).length === 1, 'één sessie');
  ok(p.mode === 'subscription', 'mode subscription');
  ok(p.payment_method_collection === 'always', 'payment_method_collection=always');
  ok(p.subscription_data.trial_period_days === 7, 'trial_period_days=7');
  ok(JSON.stringify(p.subscription_data.trial_settings) === '{"end_behavior":{"missing_payment_method":"cancel"}}', 'trial_settings missing_payment_method=cancel');
  ok(p.line_items.length === 1 && p.line_items[0].price === 'price_pro' && p.line_items[0].quantity === 1, 'price uit server-secret');
  ok(!('trial_end' in p.subscription_data) && !('trial_end' in p), 'geen trial_end-workaround');
  ok(p.customer === 'cus_1' && p.client_reference_id === 'user-1', 'customer en client_reference_id');
  ok(p.success_url === 'https://www.example.nl/#/kompas/account?checkout=success', 'success_url');
  ok(p.cancel_url === 'https://www.example.nl/#/kompas/abonneren?intent=PRO&checkout=cancelled', 'cancel_url');
  ok(p.metadata.supabase_user_id === 'user-1' && p.metadata.plan === 'PRO' && p.metadata.tier === 'pro' && p.metadata.trial_granted === 'true' && p.metadata.trial_days === '7' && p.metadata.terms_accepted === 'true' && /^\d{4}-\d\d-\d\dT/.test(p.metadata.terms_accepted_at), 'metadata');
  ok(JSON.stringify(p.subscription_data.metadata) === JSON.stringify(p.metadata), 'metadata ook op subscription');
  ok(p.metadata.terms_accepted === 'true' && p.metadata.terms_version === '2026-10-05' && /^\d{4}-\d\d-\d\dT/.test(p.metadata.terms_accepted_at), 'terms_accepted + terms_accepted_at (servertijd) + terms_version=2026-10-05');
  ok(!('trial_denied_reason' in p.metadata), 'geen weigeringsreden bij toegekende trial');
  ok(p.automatic_tax && p.automatic_tax.enabled === true, 'Stripe Tax expliciet AAN (automatic_tax.enabled=true)');
  ok(!('allow_promotion_codes' in p) && !('discounts' in p), 'geen promo/discounts');
});
await sc('PREMIUM trial', async () => {
  const w = world(); const x = await call({ plan: 'PREMIUM', voorwaarden_akkoord: true }); const [p] = created(w);
  ok(x.status === 200 && p.subscription_data.trial_period_days === 1, 'trial_period_days=1');
  ok(p.payment_method_collection === 'always' && p.line_items[0].price === 'price_premium', 'always + premium price');
  ok(p.metadata.tier === 'premium' && p.metadata.plan === 'PREMIUM' && p.metadata.trial_days === '1', 'metadata premium');
  ok(p.cancel_url.endsWith('intent=PREMIUM&checkout=cancelled'), 'cancel_url premium');
  ok(!('trial_end' in p.subscription_data), 'geen trial_end');
});
await sc('terms_version', async () => { const w = world({ env: { TERMS_VERSION: '2027-01-15' } }); await call(OK); ok(created(w)[0].metadata.terms_version === '2027-01-15', 'terms_version komt uit server-env, niet uit client'); const w2 = world(); await call({ ...OK, terms_version: '1999-01-01', terms_accepted_at: '1999-01-01T00:00:00Z' }); ok(created(w2)[0].metadata.terms_version === '2026-10-05' && created(w2)[0].metadata.terms_accepted_at.startsWith('20'), 'client kan versie/tijdstip niet opgeven'); ok(!created(w2)[0].metadata.terms_accepted_at.startsWith('1999'), 'servertijd, niet clienttijd'); });
await sc('trial gebruikt (profiel)', async () => {
  for (const plan of ['PRO', 'PREMIUM']) {
    const w = world({ profile: { trial_started_at: '2026-09-01T00:00:00Z' } }); const x = await call({ plan, voorwaarden_akkoord: true }); const [p] = created(w);
    ok(x.status === 200 && !('trial_period_days' in p.subscription_data) && !('trial_settings' in p.subscription_data) && !('payment_method_collection' in p) && !('trial_end' in p.subscription_data), plan + ': geen trial-parameters');
    ok(p.mode === 'subscription' && p.line_items[0].price === (plan === 'PRO' ? 'price_pro' : 'price_premium'), plan + ': normale subscription, juiste price');
    ok(p.metadata.trial_granted === 'false' && p.metadata.trial_days === '0' && p.metadata.trial_denied_reason === 'eerdere_trial', plan + ': metadata trial_granted=false + reden eerdere_trial');
  }
});
await sc('trial gebruikt (Stripe-historie)', async () => {
  let w = world({ profile: { stripe_customer_id: 'cus_old' } }); w.customers.cus_old = { id: 'cus_old' };
  w.subs.push({ id: 'sub_old', customer: 'cus_old', status: 'canceled', trial_start: 1700000000, trial_end: 1700604800 });
  let x = await call(OK); ok(x.status === 200 && !('trial_period_days' in created(w)[0].subscription_data), 'beëindigde trial-sub in Stripe -> geen nieuwe trial (profiel zegt null)');
  ok(created(w)[0].customer === 'cus_old', 'bestaande klant hergebruikt');
  for (const st of ['canceled', 'past_due', 'unpaid']) {
    w = world({ profile: { stripe_customer_id: 'cus_old' } }); w.customers.cus_old = { id: 'cus_old' };
    w.subs.push({ id: 'sub_p', customer: 'cus_old', status: st, trial_start: null, trial_end: null });
    x = await call(st === 'canceled' ? OK : OK); const pp = created(w)[0];
    if (st === 'canceled') ok(x.status === 200 && !('trial_period_days' in pp.subscription_data) && pp.metadata.trial_denied_reason === 'eerder_abonnement' && pp.metadata.trial_granted === 'false', 'eerder (beëindigd) betaald abonnement zonder trial -> GEEN trial, reden eerder_abonnement');
    else ok(x.status === 409, 'status ' + st + ' blokkeert');
  }
  w = world({ profile: { subscription_started_at: '2026-06-01T00:00:00Z' } }); x = await call(OK);
  ok(x.status === 200 && !('trial_period_days' in created(w)[0].subscription_data) && created(w)[0].metadata.trial_denied_reason === 'eerder_abonnement', 'subscription_started_at in profiel (eerder abonnement) -> geen trial');
  w = world({ profile: { stripe_subscription_id: 'sub_gone', stripe_customer_id: 'cus_o2' } }); w.customers.cus_o2 = { id: 'cus_o2' }; x = await call(OK);
  ok(x.status === 200 && !('trial_period_days' in created(w)[0].subscription_data), 'stripe_subscription_id in profiel (ook al onbekend bij Stripe) -> geen trial');
  w = world({ profile: { trial_started_at: '2026-09-01T00:00:00Z' } }); w.subs = []; x = await call({ plan: 'PREMIUM', voorwaarden_akkoord: true });
  ok(!('trial_period_days' in created(w)[0].subscription_data), 'eerdere Pro-trial -> ook geen Premium-trial (één trial per account)');
  w = world({ profile: { subscription_tier: 'pro', subscription_active: false, trial_started_at: '2026-10-04T00:00:00Z', trial_ends_at: new Date(Date.now() + 86400e3).toISOString() } }); x = await call(OK);
  ok(x.status === 200 && !('trial_period_days' in created(w)[0].subscription_data), 'lopende interne trial: mag betalen overstappen, zonder nieuwe trial (niet geblokkeerd)');
  w = world({ profile: { stripe_customer_id: 'cus_old' } }); w.customers.cus_old = { id: 'cus_old' };
  w.subs.push({ id: 'sub_inc', customer: 'cus_old', status: 'incomplete_expired', trial_start: null, trial_end: null });
  x = await call(OK); ok(x.status === 200 && created(w).length === 1, 'incomplete_expired blokkeert niet');
});
await sc('client kan niets forceren', async () => {
  const evil = { plan: 'PRO', voorwaarden_akkoord: true, trial: true, trial_period_days: 30, trial_end: 9999999999, price: 'price_evil', priceId: 'price_evil', price_id: 'price_evil', line_items: [{ price: 'price_evil' }], unit_amount: 1, amount: 1, currency: 'usd', customer: 'cus_evil', customer_id: 'cus_evil', user_id: 'user-2', subscription_data: { trial_period_days: 99 }, metadata: { supabase_user_id: 'user-2', trial_granted: 'true' }, tier: 'premium', mode: 'payment', success_url: 'https://evil.example', payment_method_collection: 'if_required', subscription_active: true, subscription_status: 'active', discounts: [{ coupon: 'FREE' }] };
  let w = world({ profile: { trial_started_at: '2026-09-01T00:00:00Z' } }); let x = await call(evil); let p = created(w)[0];
  ok(x.status === 200 && !('trial_period_days' in p.subscription_data) && !('trial_end' in p.subscription_data) && !('trial_end' in p), 'trial-gebruiker: client kan trial niet forceren');
  ok(p.line_items.length === 1 && p.line_items[0].price === 'price_pro', 'client kan Price ID niet injecteren');
  ok(p.customer === 'cus_1' && p.client_reference_id === 'user-1' && p.metadata.supabase_user_id === 'user-1' && p.metadata.plan === 'PRO' && p.metadata.trial_granted === 'false', 'customer/user/metadata niet uit client');
  ok(p.mode === 'subscription' && p.success_url.startsWith('https://www.example.nl/') && !('discounts' in p), 'mode/success_url niet uit client');
  ok(!w.calls.some((c) => JSON.stringify(c[1] ?? '').includes('cus_evil') || JSON.stringify(c[1] ?? '').includes('price_evil')), 'evil-ids nergens naar Stripe gestuurd');
  w = world(); x = await call({ plan: 'PRO', voorwaarden_akkoord: true, trial: false, trial_period_days: 0, no_trial: true }); p = created(w)[0];
  ok(p.subscription_data.trial_period_days === 7 && p.payment_method_collection === 'always', 'client kan trial ook niet UITzetten of verkorten');
  w = world(); x = await call({ plan: 'PREMIUM', voorwaarden_akkoord: true, trial_period_days: 14 }); ok(created(w)[0].subscription_data.trial_period_days === 1, 'client kan trialduur niet wijzigen (Premium blijft 1)');
});
await sc('bestaand abonnement', async () => {
  for (const st of ['trialing', 'active', 'past_due', 'unpaid', 'paused']) {
    const w = world({ profile: { stripe_customer_id: 'cus_a' } }); w.customers.cus_a = { id: 'cus_a' }; w.subs.push({ id: 'sub_a', customer: 'cus_a', status: st, trial_start: null, trial_end: null });
    const x = await call(OK); ok(x.status === 409 && x.json.code === 'abonnement_bestaat' && created(w).length === 0, 'status ' + st + ' -> 409, geen sessie');
  }
  let w = world({ profile: { stripe_customer_id: 'cus_a', stripe_subscription_id: 'sub_z' } }); w.customers.cus_a = { id: 'cus_a' }; w.subs.push({ id: 'sub_z', customer: 'cus_a', status: 'canceled', trial_start: null, trial_end: null });
  let x = await call(OK); ok(x.status === 200 && !('trial_period_days' in created(w)[0].subscription_data), 'profiel verwijst naar beëindigd abonnement -> opnieuw afsluiten mag (Stripe-status wint), maar zonder trial');
  w = world({ profile: { stripe_customer_id: 'cus_a', stripe_subscription_id: 'sub_missing' } }); w.customers.cus_a = { id: 'cus_a' };
  x = await call(OK); ok(x.status === 200, 'profiel verwijst naar onbekend abonnement (resource_missing) blokkeert niet');
  w = world({ profile: { stripe_customer_id: 'cus_a', stripe_subscription_id: 'sub_other' } }); w.customers.cus_a = { id: 'cus_a' }; w.subs.push({ id: 'sub_other', customer: 'cus_other', status: 'active', trial_start: null, trial_end: null });
  x = await call(OK); ok(x.status === 409 && created(w).length === 0, 'actief abonnement via profiel (andere klant) blokkeert');
  w = world({ profile: { stripe_customer_id: 'cus_a' } }); w.customers.cus_a = { id: 'cus_a' }; w.subs.push({ id: 's1', customer: 'cus_a', status: 'canceled', trial_start: 1, trial_end: 2 }, { id: 's2', customer: 'cus_a', status: 'trialing', trial_start: 1, trial_end: 2 });
  x = await call(OK); ok(x.status === 409, 'tweede (gelijktijdige) trial niet mogelijk: trialing-sub blokkeert');
});
await sc('bestaande actieve toegang', async () => {
  for (const plan of ['PRO', 'PREMIUM']) {
    let w = world({ profile: { role: 'admin' } }); let x = await call({ plan, voorwaarden_akkoord: true });
    ok(x.status === 409 && x.json.code === 'admin_toegang' && stripeCalls(w) === 0 && w.updates.length === 0, 'admin (' + plan + ') -> 409, geen Stripe, geen klant, geen schrijfactie');
    for (const tier of ['pro', 'premium']) {
      w = world({ profile: { subscription_tier: tier, subscription_active: true } }); x = await call({ plan, voorwaarden_akkoord: true });
      ok(x.status === 409 && x.json.code === 'actieve_toegang_bestaat' && stripeCalls(w) === 0 && w.updates.length === 0, 'handmatig/actief ' + tier + ' (kiest ' + plan + ') -> 409, geen Stripe, geen klant');
    }
  }
  let w = world({ profile: { subscription_tier: 'pro', subscription_active: false, subscription_started_at: '2026-01-01T00:00:00Z' } }); let x = await call(OK);
  ok(x.status === 200, 'verlopen/niet-actief abonnement (active=false) blokkeert niet');
  w = world({ profile: { subscription_tier: 'free', subscription_active: false } }); x = await call(OK); ok(x.status === 200 && created(w)[0].subscription_data.trial_period_days === 7, 'Free zonder historie: trial');
  w = world({ profile: { subscription_tier: 'free', subscription_active: true } }); x = await call(OK); ok(x.status === 200, 'active=true met tier free geeft geen Pro/Premium-toegang en blokkeert dus niet');
  w = world({ profile: { role: 'member' } }); x = await call({ ...OK, role: 'admin', subscription_active: true }); ok(x.status === 200, 'client kan blokkade/rol niet beïnvloeden via body');
});
await sc('customer', async () => {
  let w = world(); await call(OK);
  ok(w.calls.filter((c) => c[0] === 'customers.create').length === 1 && w.calls.find((c) => c[0] === 'customers.create')[1].metadata.supabase_user_id === 'user-1', 'nieuwe klant 1x aangemaakt met user-id metadata');
  ok(w.updates.length === 1 && Object.keys(w.updates[0]).sort().join() === 'id,stripe_customer_id', 'enige schrijfactie: stripe_customer_id');
  await call(OK); ok(w.calls.filter((c) => c[0] === 'customers.create').length === 1, 'tweede verzoek hergebruikt klant uit profiel');
  w = world({ profile: { stripe_customer_id: 'cus_ok' } }); w.customers.cus_ok = { id: 'cus_ok' }; await call(OK);
  ok(!w.calls.some((c) => c[0] === 'customers.create') && created(w)[0].customer === 'cus_ok' && w.updates.length === 0, 'bestaande klant hergebruikt, geen create, geen schrijfactie');
  w = world({ profile: { stripe_customer_id: 'cus_gone' } }); await call(OK);
  ok(w.calls.filter((c) => c[0] === 'customers.create').length === 1, 'ongeldige klant-id -> nieuwe aangemaakt');
  w = world({ profile: { stripe_customer_id: 'cus_del' } }); w.customers.cus_del = { id: 'cus_del', deleted: true }; await call(OK);
  ok(w.calls.filter((c) => c[0] === 'customers.create').length === 1, 'verwijderde klant -> nieuwe aangemaakt');
  w = world({ lostRace: 'cus_winner' }); w.customers.cus_winner = { id: 'cus_winner' }; await call(OK);
  ok(created(w)[0].customer === 'cus_winner', 'verloren schrijfrace -> val terug op opgeslagen klant');
});
await sc('geen entitlement', async () => {
  const w = world(); const x = await call(OK);
  const velden = new Set(w.updates.flatMap((u) => Object.keys(u)));
  for (const f of ['subscription_tier', 'subscription_active', 'subscription_status', 'subscription_current_period_end', 'subscription_cancel_at_period_end', 'trial_started_at', 'trial_ends_at', 'stripe_subscription_id', 'subscription_started_at', 'subscription_ends_at', 'role']) ok(!velden.has(f), 'schrijft niet naar ' + f);
  ok(x.status === 200 && Object.keys(x.json).join() === 'url', 'respons alleen url (success geeft geen rechten)');
  ok(w.profiles['user-1'].trial_started_at === null, 'trial_started_at ongewijzigd');
});
await sc('prijscontrole', async () => {
  for (const [naam, patch] of [['bedrag', { unit_amount: 1300 }], ['valuta', { currency: 'usd' }], ['inactief', { active: false }], ['jaarlijks', { recurring: { interval: 'year', interval_count: 1 } }], ['2-maandelijks', { recurring: { interval: 'month', interval_count: 2 } }], ['eenmalig', { recurring: null }]]) {
    const w = world({ prices: { price_pro: { id: 'price_pro', active: true, currency: 'eur', unit_amount: 1200, recurring: { interval: 'month', interval_count: 1 }, ...patch } } });
    const x = await call(OK); ok(x.status === 500 && created(w).length === 0 && !w.calls.some((c) => c[0] === 'customers.create'), 'price met afwijkend ' + naam + ' -> 500, geen klant/sessie');
  }
  const w = world({ prices: { price_premium: { id: 'price_premium', active: true, currency: 'eur', unit_amount: 1200, recurring: { interval: 'month', interval_count: 1 } } } }); const x = await call({ plan: 'PREMIUM', voorwaarden_akkoord: true });
  ok(x.status === 500 && created(w).length === 0, 'verwisselde price-secrets (Premium wijst naar €12) -> 500');
});
await sc('Stripe-fouten', async () => {
  for (const f of ['price', 'subs', 'create']) { const w = world({ fail: f }); const x = await call(OK); ok(x.status === 502 && (f === 'create' || created(w).length === 0), 'Stripe-fout bij ' + f + ' -> 502'); }
  const w = world({ noUrl: true }); const x = await call(OK); ok(x.status === 502, 'sessie zonder url -> 502');
});
await sc('dubbelklik / hergebruik', async () => {
  const w = world(); const a = await call(OK); const b = await call(OK);
  ok(a.status === 200 && b.status === 200 && a.json.url === b.json.url, 'tweede identieke verzoek geeft dezelfde url');
  ok(created(w).length === 1 && open(w) === 1, 'één sessie aangemaakt, één open');
  const c = await call({ plan: 'PREMIUM', voorwaarden_akkoord: true });
  ok(c.status === 200 && c.json.url !== a.json.url && open(w) === 1 && w.sessions[0].status === 'expired', 'ander plan: oude sessie verlopen, precies één open');
  const d = await call(OK);
  ok(d.status === 200 && open(w) === 1 && d.json.url !== a.json.url, 'terug naar PRO: nieuwe sessie, nog steeds één open (geen verlopen url teruggegeven)');
  const w2 = world(); await call(OK); w2.sessions[0].created -= 31 * 60; await call(OK);
  ok(created(w2).length === 2 && w2.sessions[0].status === 'expired' && w2.sessions[1].status === 'open', 'sessie ouder dan 30 min wordt niet hergebruikt maar vervangen');
  const w3 = world({ profile: { trial_started_at: '2026-09-01T00:00:00Z', stripe_customer_id: 'cus_1' } }); w3.customers.cus_1 = { id: 'cus_1' };
  w3.sessions.push({ id: 'cs_pre', url: 'https://old', status: 'open', created: w3.clock - 5, customer: 'cus_1', metadata: { supabase_user_id: 'user-1', plan: 'PRO', trial_granted: 'true' } });
  await call(OK); ok(created(w3).length === 1 && w3.sessions[0].status === 'expired', 'open sessie MET trial wordt niet hergebruikt als trial inmiddels gebruikt is');
});
await sc('gelijktijdige verzoeken', async () => {
  let w = world({ interleave: true }); const [a, b] = await Promise.all([call(OK), call(OK)]);
  ok(open(w) === 1, 'twee gelijktijdige identieke verzoeken: precies één open sessie (open=' + open(w) + ')');
  ok([a, b].every((r) => r.status === 200 || r.status === 409), 'uitkomsten 200/409 (' + a.status + ',' + b.status + ')');
  w = world({ interleave: true, profile: { stripe_customer_id: 'cus_s' } }); w.customers.cus_s = { id: 'cus_s' };
  const rs = await Promise.all([call({ plan: 'PRO', voorwaarden_akkoord: true }), call({ plan: 'PREMIUM', voorwaarden_akkoord: true }), call({ plan: 'PRO', voorwaarden_akkoord: true })]);
  ok(open(w) === 1, 'drie gelijktijdige verzoeken (PRO/PREMIUM/PRO): precies één open sessie (open=' + open(w) + ', statussen ' + rs.map((r) => r.status) + ')');
  let slecht = 0;
  for (let i = 0; i < 50; i++) { w = world({ interleave: true, profile: { stripe_customer_id: 'cus_s' } }); w.customers.cus_s = { id: 'cus_s' }; await Promise.all([call(OK), call({ plan: 'PREMIUM', voorwaarden_akkoord: true }), call(OK), call({ plan: 'PREMIUM', voorwaarden_akkoord: true })]); if (open(w) !== 1) slecht++; }
  ok(slecht === 0, '50 herhalingen met 4 gelijktijdige verzoeken: altijd precies één open sessie (afwijkend: ' + slecht + ')');
});

// ============================================================================
// STRIPE TAX (Sandbox-fase): basisprijs EXCLUSIEF belasting, Stripe berekent.
// ============================================================================
const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const taxCalls = (w) => w.calls.filter((c) => c[0] === 'tax.settings.retrieve').length;

await sc('Tax: parameters op de Checkout Session', async () => {
  for (const [naam, profile, plan] of [
    ['PRO met trial', {}, 'PRO'],
    ['PREMIUM met trial', {}, 'PREMIUM'],
    ['PRO zonder trial (trial gebruikt)', { trial_started_at: '2026-09-01T00:00:00Z' }, 'PRO'],
    ['PREMIUM zonder trial', { trial_started_at: '2026-09-01T00:00:00Z' }, 'PREMIUM'],
    ['bestaande klant', { stripe_customer_id: 'cus_ex' }, 'PRO'],
  ]) {
    const w = world({ profile }); if (profile.stripe_customer_id) w.customers.cus_ex = { id: 'cus_ex' };
    const x = await call({ plan, voorwaarden_akkoord: true }); const [p] = created(w);
    ok(x.status === 200 && created(w).length === 1, naam + ': sessie aangemaakt');
    ok(p.automatic_tax && p.automatic_tax.enabled === true && Object.keys(p.automatic_tax).join() === 'enabled', naam + ': automatic_tax = { enabled: true }');
    ok(p.billing_address_collection === 'required', naam + ': factuuradres wordt altijd gevraagd (billing_address_collection=required)');
    ok(JSON.stringify(p.customer_update) === '{"address":"auto"}', naam + ': klantadres wordt veilig bijgewerkt (customer_update = { address: "auto" }, verder niets)');
    ok(!('customer_email' in p) && !('customer_creation' in p), naam + ': geen customer_email/customer_creation naast bestaande customer');
    ok(!('tax_id_collection' in p) && !('shipping_address_collection' in p), naam + ': geen extra belastingvelden (btw-id/verzending) toegevoegd');
  }
});
await sc('Tax: geen btw in onze code, basisprijs ongewijzigd', async () => {
  const w = world(); await call(OK); const [p] = created(w);
  ok(p.line_items.length === 1 && Object.keys(p.line_items[0]).sort().join() === 'price,quantity', 'line_items: alleen price + quantity (geen price_data, geen tax_rates)');
  ok(!('tax_rates' in p.line_items[0]) && !('default_tax_rates' in p) && !('default_tax_rates' in p.subscription_data) && !('tax_rates' in p.subscription_data), 'geen handmatige tax_rates / default_tax_rates');
  const bron = stripComments(readFileSync(join(ROOT, 'supabase/functions/create-checkout-session/index.ts'), 'utf8'));
  ok(/PRO:\s*\{[^}]*bedragCent:\s*1200\b/.test(bron) && /PREMIUM:\s*\{[^}]*bedragCent:\s*3900\b/.test(bron), 'basisbedragen in de server-config blijven 1200 / 3900 cent (EUR 12 / EUR 39 excl.)');
  ok(!/\b1[.,]?452\b|\b4[.,]?719\b|\b14[.,]52\b|\b47[.,]19\b|\b0[.,]21\b|\b1[.,]21\b|\b21\s*%|btw_?percentage|vat_?rate/i.test(bron), 'geen hardcoded btw-percentage of bedrag incl. btw in de Edge Function');
  // Een Price van EUR 14,52 / 47,19 (= incl. btw) is NIET het verwachte basisbedrag en wordt geweigerd.
  for (const [plan, secret, cent] of [['PRO', 'price_pro', 1452], ['PREMIUM', 'price_premium', 4719]]) {
    const w2 = world({ prices: { [secret]: { id: secret, active: true, currency: 'eur', unit_amount: cent, tax_behavior: 'exclusive', recurring: { interval: 'month', interval_count: 1 } } } });
    const x = await call({ plan, voorwaarden_akkoord: true });
    ok(x.status === 500 && created(w2).length === 0 && !w2.calls.some((c) => c[0] === 'customers.create'), plan + ': Price van EUR ' + (cent / 100) + ' (incl. btw-bedrag) wordt geweigerd; basis blijft ' + (plan === 'PRO' ? '12' : '39'));
  }
});
await sc('Tax: tax_behavior moet EXCLUSIEF zijn (Prices worden nooit aangepast)', async () => {
  const prijs = (tb, extra = {}) => ({ price_pro: { id: 'price_pro', active: true, currency: 'eur', unit_amount: 1200, recurring: { interval: 'month', interval_count: 1 }, ...(tb === undefined ? {} : { tax_behavior: tb }), ...extra } });
  // Price zelf exclusive: geen Tax-settings nodig
  let w = world({ prices: prijs('exclusive'), taxSettings: { status: 'active', defaults: { tax_behavior: 'inclusive' } } }); let x = await call(OK);
  ok(x.status === 200 && created(w).length === 1 && taxCalls(w) === 0, 'Price exclusive -> Checkout (Tax-standaard doet er niet toe)');
  // Price inclusive: weigeren
  w = world({ prices: prijs('inclusive') }); x = await call(OK);
  ok(x.status === 500 && created(w).length === 0 && !w.calls.some((c) => c[0] === 'customers.create') && w.updates.length === 0, 'Price inclusive -> 500, geen klant, geen sessie');
  // unspecified + standaard exclusive: oké
  for (const tb of ['unspecified', undefined, null]) {
    w = world({ prices: prijs(tb) }); x = await call(OK);
    ok(x.status === 200 && created(w).length === 1 && taxCalls(w) === 1, 'Price tax_behavior=' + String(tb) + ' + Tax-standaard exclusive -> Checkout');
  }
  // unspecified + standaard niet-exclusive / leeg / niet actief: weigeren
  for (const [naam, inst] of [
    ['standaard inclusive', { status: 'active', defaults: { tax_behavior: 'inclusive' } }],
    ['standaard automatisch (inferred_by_currency = inclusief voor EUR)', { status: 'active', defaults: { tax_behavior: 'inferred_by_currency' } }],
    ['standaard niet ingesteld (null)', { status: 'active', defaults: { tax_behavior: null } }],
    ['geen defaults', { status: 'active' }],
    ['settings pending (adres ontbreekt)', { status: 'pending', defaults: { tax_behavior: 'exclusive' } }],
  ]) {
    w = world({ taxSettings: inst }); x = await call(OK);
    ok(x.status === 500 && created(w).length === 0 && !w.calls.some((c) => c[0] === 'customers.create') && w.updates.length === 0, 'unspecified + ' + naam + ' -> 500, geen klant, geen sessie');
  }
  // Stripe-fout bij lezen van de Tax-instellingen: geen Checkout (fail-closed)
  w = world({ fail: 'tax' }); x = await call(OK);
  ok(x.status === 502 && created(w).length === 0 && !w.calls.some((c) => c[0] === 'customers.create'), 'Tax-settings onleesbaar -> 502, geen Checkout (fail-closed)');
  // Alleen lezen: nooit een Price of instelling wijzigen
  w = world(); await call(OK);
  ok(w.calls.every((c) => !/\.(update|create)$/.test(c[0]) || ['customers.create', 'sessions.create'].includes(c[0])), 'geen Stripe-schrijfaanroepen behalve klant/sessie (Prices en Tax-settings blijven ongemoeid)');
  // Foutmelding naar de klant lekt geen interne details
  w = world({ prices: prijs('inclusive') }); x = await call(OK);
  ok(JSON.stringify(x.json) === '{"error":"De betaalfunctie is niet goed geconfigureerd."}', 'foutmelding is neutraal');
});
await sc('Tax: trials ongewijzigd (604800 s / 86400 s)', async () => {
  let w = world(); await call(OK); let [p] = created(w);
  ok(p.subscription_data.trial_period_days === 7 && p.subscription_data.trial_period_days * 86400 === 604800, 'PRO: trial_period_days=7 = exact 604800 s');
  ok(p.payment_method_collection === 'always' && JSON.stringify(p.subscription_data.trial_settings) === '{"end_behavior":{"missing_payment_method":"cancel"}}' && !('trial_end' in p.subscription_data), 'PRO: betaalmethode verplicht, geen trial_end-workaround');
  w = world(); await call({ plan: 'PREMIUM', voorwaarden_akkoord: true }); [p] = created(w);
  ok(p.subscription_data.trial_period_days === 1 && p.subscription_data.trial_period_days * 86400 === 86400, 'PREMIUM: trial_period_days=1 = exact 86400 s');
  ok(p.payment_method_collection === 'always' && !('trial_end' in p.subscription_data), 'PREMIUM: betaalmethode verplicht, geen trial_end');
  const bron = stripComments(readFileSync(join(ROOT, 'supabase/functions/create-checkout-session/index.ts'), 'utf8'));
  ok(/PRO:\s*\{[^}]*trialDagen:\s*7\b/.test(bron) && /PREMIUM:\s*\{[^}]*trialDagen:\s*1\b/.test(bron), 'trialconfig in de server-config ongewijzigd (7 / 1 dagen)');
  // eligibility ongewijzigd: gebruikte trial -> geen trial, met Tax aan
  w = world({ profile: { trial_started_at: '2026-09-01T00:00:00Z' } }); await call(OK); [p] = created(w);
  ok(!('trial_period_days' in p.subscription_data) && p.metadata.trial_denied_reason === 'eerdere_trial' && p.automatic_tax.enabled === true, 'eligibility ongewijzigd: eerdere trial -> geen trial (Tax wel aan)');
});
await sc('Tax: beveiliging en duplicate protection blijven intact', async () => {
  let w = world(); let x = await call(OK, { auth: false });
  ok(x.status === 401 && stripeCalls(w) === 0 && taxCalls(w) === 0, 'anoniem -> 401, geen Stripe-aanroep (ook geen Tax-settings)');
  w = world(); x = await call(OK, { token: 'anon-key-jwt' }); ok(x.status === 401 && stripeCalls(w) === 0, 'ongeldig token -> 401');
  w = world(); x = await call({ plan: 'PRO' }); ok(x.status === 400 && stripeCalls(w) === 0, 'zonder voorwaardenakkoord nog steeds geweigerd, geen Stripe');
  // client kan Tax niet beïnvloeden
  w = world(); await call({ ...OK, automatic_tax: { enabled: false }, billing_address_collection: 'auto', customer_update: { address: 'never' }, tax_rates: ['txr_evil'], tax_behavior: 'inclusive' });
  const [p] = created(w);
  ok(p.automatic_tax.enabled === true && p.billing_address_collection === 'required' && p.customer_update.address === 'auto' && !JSON.stringify(p).includes('txr_evil'), 'client kan Tax-parameters niet wijzigen of uitzetten');
  // dubbelklik: hergebruik van de sessie MET Tax
  w = world(); const a = await call(OK); const b = await call(OK);
  ok(a.json.url === b.json.url && created(w).length === 1 && open(w) === 1, 'dubbelklik: dezelfde sessie, precies één open');
  // een open sessie van vóór Stripe Tax wordt niet hergebruikt maar verlopen
  w = world({ profile: { stripe_customer_id: 'cus_1' } }); w.customers.cus_1 = { id: 'cus_1' };
  w.sessions.push({ id: 'cs_oud', url: 'https://oud', status: 'open', created: w.clock - 5, customer: 'cus_1', metadata: { supabase_user_id: 'user-1', plan: 'PRO', trial_granted: 'true' }, automatic_tax: { enabled: false } });
  x = await call(OK);
  ok(x.status === 200 && x.json.url !== 'https://oud' && w.sessions[0].status === 'expired' && open(w) === 1 && created(w)[0].automatic_tax.enabled === true, 'open sessie zonder Tax wordt verlopen; nieuwe sessie heeft Tax');
  // bestaand-abonnement-blokkade ongewijzigd
  w = world({ profile: { stripe_customer_id: 'cus_a' } }); w.customers.cus_a = { id: 'cus_a' }; w.subs.push({ id: 'sub_a', customer: 'cus_a', status: 'active', trial_start: null, trial_end: null });
  x = await call(OK); ok(x.status === 409 && created(w).length === 0, 'lopend abonnement blokkeert nog steeds (409)');
  // invalid Price blijft geblokkeerd
  w = world({ prices: { price_pro: { id: 'price_pro', active: false, currency: 'eur', unit_amount: 1200, tax_behavior: 'exclusive', recurring: { interval: 'month', interval_count: 1 } } } });
  x = await call(OK); ok(x.status === 500 && created(w).length === 0, 'inactieve Price blijft geblokkeerd');
});
await sc('Tax: frontend berekent geen btw', async () => {
  const { readdirSync, statSync } = await import('node:fs');
  const lijst = [];
  const loop = (d) => { for (const n of readdirSync(d)) { const pad = join(d, n); statSync(pad).isDirectory() ? loop(pad) : /\.(jsx?|mjs|ts|tsx)$/.test(n) && lijst.push(pad); } };
  loop(join(ROOT, 'src'));
  ok(lijst.length > 20, 'src gescand (' + lijst.length + ' bestanden)');
  const verdacht = lijst.filter((f) => /\b14[.,]52\b|\b47[.,]19\b|\b1[.]21\b|\b0[.]21\b|\b21\s*%|\*\s*1[.,]21|vatRate|btwPercentage|taxRate/i.test(stripComments(readFileSync(f, 'utf8'))));
  ok(verdacht.length === 0, 'geen btw-percentage/bedrag incl. btw of btw-rekenwerk in src/ (' + verdacht.join(', ') + ')');
  const abonn = readFileSync(join(ROOT, 'src/data/abonnementen.js'), 'utf8');
  ok(/12\b/.test(abonn) && /39\b/.test(abonn), 'websiteprijzen 12 en 39 staan nog in abonnementen.js');
});

console.log(`\nRESULTAAT: ${pass} geslaagd, ${fail} mislukt`); process.exit(fail ? 1 : 0);
