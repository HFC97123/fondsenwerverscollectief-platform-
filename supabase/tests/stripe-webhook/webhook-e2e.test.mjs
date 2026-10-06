// End-to-end test van de stripe-webhook Edge Function: echte handler-bundle,
// echte Stripe-bibliotheek voor handtekeningen, ECHTE Postgres 16 met de
// definitieve migratie (RPC's draaien dus echt). Alleen Stripe-retrieve is nep.
import pg from 'pg';
import Stripe from 'stripe';

const SECRET = 'whsec_testsecret_lokaal';
const SERVICE_KEY = 'service-role-test-key';
process.env.STRIPE_SECRET_KEY = 'sk_test_lokaal';
process.env.STRIPE_WEBHOOK_SECRET = SECRET;
process.env.SUPABASE_URL = 'http://lokaal';
process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY;
process.env.STRIPE_PRO_PRICE_ID = 'price_pro';
process.env.STRIPE_PREMIUM_PRICE_ID = 'price_premium';

globalThis.Deno = { serve: (h) => { globalThis.__handler = h; }, env: { get: (k) => process.env[k] } };
globalThis.__rpcCalls = []; globalThis.__retrieveCalls = [];
await import('./handler.mjs');
const handler = globalThis.__handler;

const db = new pg.Client({ host: '/var/tmp', port: 5544, user: 'postgres', database: 't' });
await db.connect();
const q = async (sql, v) => (await db.query(sql, v)).rows;
const stripeLib = new Stripe('sk_test_x');

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('ok   ' + m); } else { fail++; console.log('FAIL ' + m); } }

// ---- hulpfuncties -----------------------------------------------------------
const uid = (n) => `00000000-0000-0000-0000-0000000001${String(n).padStart(2, '0')}`;
async function maakProfiel(n, o = {}) {
  await q('insert into auth.users(id) values ($1)', [uid(n)]);
  await q(`insert into public.profiles(id,email,status,role,subscription_tier,subscription_active,stripe_customer_id,trial_started_at,trial_ends_at)
           values ($1,$2,'approved',$3,$4,$5,$6,$7,$8)`,
    [uid(n), `u${n}@x.test`, o.role ?? 'member', o.tier ?? 'free', o.active ?? false, o.cust === undefined ? `cus_${n}` : o.cust, o.ts ?? null, o.te ?? null]);
}
const profiel = async (n) => (await q('select * from public.profiles where id=$1', [uid(n)]))[0];
const ev = async (id) => (await q('select * from public.stripe_webhook_events where stripe_event_id=$1', [id]))[0];
const conflicten = async (kind) => q('select * from public.stripe_billing_conflicts where kind=$1', [kind]);

let T = 1790000000; // Stripe-tijd (seconden)
const subs = {};
globalThis.__fake = { retrieve: async (id) => { if (!(id in subs)) { const e = new Error('No such subscription'); e.code = 'resource_missing'; e.statusCode = 404; throw e; } if (subs[id] instanceof Error) throw subs[id]; return subs[id]; } };

function maakSub(o) {
  const items = o.items ?? [{ price: { id: o.price ?? 'price_premium' }, current_period_end: T + 30 * 86400 }];
  return { id: o.id, customer: o.customer, status: o.status, items: { data: items }, trial_start: o.ts ?? null, trial_end: o.te ?? null,
    start_date: o.start ?? T, cancel_at_period_end: o.cancel ?? false, cancel_at: o.cancel_at ?? null,
    metadata: o.meta === undefined ? {} : o.meta };
}
function payload(type, object, id, created, livemode = false) {
  return JSON.stringify({ id, object: 'event', type, created, livemode, api_version: '2025-09-30.clover', data: { object } });
}
async function post(type, object, id, o = {}) {
  const body = o.body ?? payload(type, object, id, o.created ?? ++T, o.livemode ?? false);
  const headers = {};
  if (o.sig !== false) headers['stripe-signature'] = o.header ?? stripeLib.webhooks.generateTestHeaderString({ payload: body, secret: o.secret ?? SECRET });
  const res = await handler(new Request('http://x/stripe-webhook', { method: o.method ?? 'POST', headers, body: (o.method ?? 'POST') === 'GET' ? undefined : (o.sendBody ?? body) }));
  return { status: res.status, json: await res.json().catch(() => null) };
}
const subEv = (type, s, id, o) => post(type, { id: s.id, customer: s.customer, status: s.status, object: 'subscription', items: s.items }, id, o);
const reset = () => { globalThis.__rpcCalls.length = 0; globalThis.__retrieveCalls.length = 0; };

// effectieve applicatietoegang: database-functies + dezelfde logica als frontend/Edge
function tierVan(p) { const r = p.subscription_tier || 'free'; if (r !== 'pro' && r !== 'premium') return 'free'; const a = p.subscription_active === true; const pa = !a && p.trial_ends_at && new Date(p.trial_ends_at).getTime() > Date.now(); return a || pa ? r : 'free'; }
function effectieveTier(p) { const r = p.subscription_tier; if (r !== 'pro' && r !== 'premium') return 'free'; if (p.subscription_active === true) return r; const e = p.trial_ends_at ? Date.parse(p.trial_ends_at) : NaN; return Number.isFinite(e) && e > Date.now() ? r : 'free'; }
async function toegang(n) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid(n)]);
  const r = (await q('select public.current_user_has_pro_access() pro, public.current_user_has_premium_access() prem'))[0];
  const p = await profiel(n);
  return { dbPro: r.pro, dbPrem: r.prem, fe: tierVan(p), edge: effectieveTier(p) };
}
const isFree = (t) => !t.dbPro && !t.dbPrem && t.fe === 'free' && t.edge === 'free';
const isPremium = (t) => t.dbPro && t.dbPrem && t.fe === 'premium' && t.edge === 'premium';

const nu = () => Math.floor(Date.now() / 1000);

// ================= 1. Transport en handtekening =================
console.log('--- transport/handtekening');
{
  reset();
  let r = await post('x', {}, 'evt_get', { method: 'GET' }); ok(r.status === 405 && !globalThis.__rpcCalls.length, 'GET => 405, niets aangeroepen');
  r = await post('customer.subscription.updated', {}, 'evt_nosig', { sig: false }); ok(r.status === 400 && !globalThis.__rpcCalls.length && !globalThis.__retrieveCalls.length, 'geen handtekening => 400, geen RPC, geen Stripe-call');
  r = await post('customer.subscription.updated', {}, 'evt_bad', { secret: 'whsec_andere' }); ok(r.status === 400 && !globalThis.__rpcCalls.length, 'handtekening met verkeerd geheim => 400, geen RPC');
  const body = payload('customer.subscription.updated', { id: 'sub_t', customer: 'cus_x', status: 'active' }, 'evt_tamper', ++T);
  const header = stripeLib.webhooks.generateTestHeaderString({ payload: body, secret: SECRET });
  r = await post('', {}, 'evt_tamper', { body, header, sendBody: body.replace('active', 'trialing') }); ok(r.status === 400 && !globalThis.__rpcCalls.length, 'gemanipuleerde body => 400, geen RPC');
  r = await post('customer.subscription.updated', { id: 'sub_t', customer: 'cus_x', status: 'active' }, 'evt_live', { livemode: true }); ok(r.status === 200 && r.json.ignored === 'livemode_mismatch' && !globalThis.__rpcCalls.length, 'livemode-event bij testsleutel => genegeerd, geen RPC');
  r = await post('invoice.paid', { id: 'in_1' }, 'evt_inv'); ok(r.status === 200 && r.json.ignored === 'type' && !globalThis.__rpcCalls.length, 'niet-ondersteund eventtype => 200 genegeerd, geen RPC');
  r = await post('checkout.session.completed', { id: 'cs_pay', mode: 'payment', customer: 'cus_x' }, 'evt_pay'); ok(r.status === 200 && r.json.ignored === 'geen_abonnementssessie' && !globalThis.__rpcCalls.length, 'checkout-sessie in payment-modus => genegeerd');
  ok((await q("select count(*)::int c from public.stripe_webhook_events where stripe_event_id in ('evt_get','evt_nosig','evt_bad','evt_tamper','evt_live','evt_inv','evt_pay')"))[0].c === 0, 'niets van bovenstaande is vastgelegd in de database');
  const bewaard = process.env.STRIPE_WEBHOOK_SECRET; delete process.env.STRIPE_WEBHOOK_SECRET;
  r = await post('customer.subscription.updated', {}, 'evt_cfg'); ok(r.status === 500 && !globalThis.__rpcCalls.length, 'ontbrekend webhook-secret => 500, geen verwerking');
  process.env.STRIPE_WEBHOOK_SECRET = bewaard;
  process.env.STRIPE_PREMIUM_PRICE_ID = 'price_pro';
  r = await post('customer.subscription.updated', {}, 'evt_cfg2'); ok(r.status === 500 && !globalThis.__rpcCalls.length, 'twee gelijke price-id\'s in configuratie => 500');
  process.env.STRIPE_PREMIUM_PRICE_ID = 'price_premium';
  ok(!JSON.stringify(r.json).includes(SECRET) && !JSON.stringify(r.json).includes('sk_test'), 'antwoord bevat geen geheimen');
}

// ================= 2. Lifecycle Premium met proef (U1) =================
console.log('--- lifecycle Premium');
await maakProfiel(1);
const S1 = 'sub_u1';
{
  reset();
  const t0 = nu() - 100;
  // event zegt 'active', Stripe zegt 'trialing': de opgehaalde stand wint
  subs[S1] = maakSub({ id: S1, customer: 'cus_1', status: 'trialing', ts: t0, te: t0 + 86400, meta: { supabase_user_id: uid(1) }, price: 'price_premium' });
  let r = await post('customer.subscription.created', { id: S1, customer: 'cus_1', status: 'active', items: { data: [] } }, 'e1_created');
  let p = await profiel(1);
  ok(r.status === 200 && globalThis.__retrieveCalls.includes(S1), 'created: actuele Subscription bij Stripe opgehaald');
  ok(p.subscription_status === 'trialing' && p.subscription_active === true && p.subscription_tier === 'premium', 'trialing => actief, tier premium (event-status genegeerd)');
  ok(+new Date(p.trial_started_at) === t0 * 1000 && +new Date(p.trial_ends_at) === (t0 + 86400) * 1000, 'trial_started/ends_at = echte Stripe trial_start/trial_end');
  ok((await ev('e1_created')).detail.trial_seconden === 86400, 'event legt trial_seconden=86400 vast (acceptatiecriterium Premium)');
  ok(p.stripe_subscription_id === S1 && p.subscription_started_at !== null, 'subscription-id en subscription_started_at gezet');
  ok(+new Date(p.subscription_current_period_end) === subs[S1].items.data[0].current_period_end * 1000, 'current_period_end uit subscription-item gelezen');
  ok(isPremium(await toegang(1)), 'effectieve toegang tijdens proef = Premium (DB + frontend + Edge)');

  // opzeggen tijdens proef: cancel_at_period_end
  subs[S1] = maakSub({ id: S1, customer: 'cus_1', status: 'trialing', ts: t0, te: t0 + 86400, cancel: true, price: 'price_premium' });
  await subEv('customer.subscription.updated', subs[S1], 'e1_cancel');
  p = await profiel(1);
  ok(p.subscription_cancel_at_period_end === true && p.subscription_active === true && isPremium(await toegang(1)), 'cancel_at_period_end=true: vlag gezet, toegang blijft tot einde proef');
  subs[S1] = maakSub({ id: S1, customer: 'cus_1', status: 'trialing', ts: t0, te: t0 + 86400, cancel: false, cancel_at: T + 99999, price: 'price_premium' });
  await subEv('customer.subscription.updated', subs[S1], 'e1_cancelat');
  ok((await profiel(1)).subscription_cancel_at_period_end === true, 'cancel_at (datum) telt ook als geplande opzegging');

  // proef eindigt, eerste betaling: active
  subs[S1] = maakSub({ id: S1, customer: 'cus_1', status: 'active', ts: t0, te: t0 + 86400, price: 'price_premium' });
  await subEv('customer.subscription.updated', subs[S1], 'e1_active');
  p = await profiel(1);
  ok(p.subscription_status === 'active' && p.subscription_active && p.subscription_cancel_at_period_end === false && +new Date(p.trial_ends_at) === (t0 + 86400) * 1000, 'active: status volgt Stripe, proefhistorie blijft');

  subs[S1] = maakSub({ id: S1, customer: 'cus_1', status: 'past_due', ts: t0, te: t0 + 86400, price: 'price_premium' });
  await subEv('customer.subscription.updated', subs[S1], 'e1_pastdue');
  p = await profiel(1);
  ok(p.subscription_status === 'past_due' && p.subscription_active === true && isPremium(await toegang(1)), 'past_due: status past_due opgeslagen, toegang blijft actief');

  subs[S1] = maakSub({ id: S1, customer: 'cus_1', status: 'unpaid', ts: t0, te: t0 + 86400, price: 'price_premium' });
  await subEv('customer.subscription.updated', subs[S1], 'e1_unpaid');
  p = await profiel(1);
  ok(p.subscription_status === 'unpaid' && p.subscription_active === false && p.subscription_tier === 'free' && p.stripe_subscription_id === S1, 'unpaid: geen toegang, tier free, sub-id/historie blijft');
  let t = await toegang(1); ok(isFree(t), 'unpaid: effectieve applicatietoegang is Free (DB + frontend + Edge)');
  ok((await ev('e1_unpaid')).detail.tier_uit_price === 'premium', 'laatst bekende tier staat bewaard in eventdetail');

  // definitief einde: deleted-event, abonnement niet meer op te halen (404) => event-object als eindbron
  delete subs[S1];
  await post('customer.subscription.deleted', { id: S1, customer: 'cus_1', status: 'canceled', object: 'subscription', items: { data: [] } }, 'e1_deleted');
  p = await profiel(1);
  ok(p.subscription_status === 'canceled' && p.subscription_active === false && p.subscription_tier === 'free', 'canceled (deleted + 404 fallback): Free');
  t = await toegang(1); ok(isFree(t), 'canceled Premium: absoluut geen Premium-entitlement (DB + frontend + Edge)');
  ok(p.trial_started_at && p.trial_ends_at && p.subscription_started_at && p.stripe_subscription_id === S1 && p.stripe_customer_id === 'cus_1', 'historie (trial, started_at, sub-id, customer-id) blijft na einde staan');
}

// ================= 3. Annuleren tijdens proef (onmiddellijk) =================
console.log('--- onmiddellijk geannuleerd binnen proef (trial_ends_at nog in de toekomst)');
await maakProfiel(7);
{
  const t0 = nu() - 3600;
  subs.sub_u7 = maakSub({ id: 'sub_u7', customer: 'cus_7', status: 'trialing', ts: t0, te: t0 + 86400, price: 'price_premium' });
  await subEv('customer.subscription.created', subs.sub_u7, 'e7_created');
  ok(isPremium(await toegang(7)), 'U7 in proef: Premium');
  subs.sub_u7 = maakSub({ id: 'sub_u7', customer: 'cus_7', status: 'canceled', ts: t0, te: t0 + 86400, price: 'price_premium' });
  await subEv('customer.subscription.deleted', subs.sub_u7, 'e7_deleted');
  const p = await profiel(7);
  ok(p.subscription_tier === 'free' && new Date(p.trial_ends_at) > new Date(), 'tier free terwijl trial_ends_at nog in de toekomst ligt');
  ok(isFree(await toegang(7)), 'direct geannuleerde proef geeft GEEN Premium-toegang meer (de eerder bewezen kwetsbaarheid is gedicht)');
}

// ================= 4. Pro =================
console.log('--- Pro');
await maakProfiel(8);
{
  const t0 = nu();
  subs.sub_u8 = maakSub({ id: 'sub_u8', customer: 'cus_8', status: 'trialing', ts: t0, te: t0 + 7 * 86400, price: 'price_pro', meta: { supabase_user_id: uid(8) } });
  await subEv('customer.subscription.created', subs.sub_u8, 'e8_created');
  const p = await profiel(8); const tt = await toegang(8);
  ok(p.subscription_tier === 'pro' && p.subscription_active && tt.dbPro && !tt.dbPrem && tt.fe === 'pro', 'Pro-proef: tier pro, geen Premium');
  ok((await ev('e8_created')).detail.trial_seconden === 7 * 86400, 'Pro trial_seconden = 604800');
}

// ================= 5. Idempotentie en volgorde =================
console.log('--- idempotentie / volgorde');
await maakProfiel(9);
{
  const t0 = nu();
  subs.sub_u9 = maakSub({ id: 'sub_u9', customer: 'cus_9', status: 'active', price: 'price_pro' });
  await subEv('customer.subscription.created', subs.sub_u9, 'e9_a', { created: 5000 });
  reset();
  const voor = await profiel(9);
  const r = await subEv('customer.subscription.created', subs.sub_u9, 'e9_a', { created: 5000 });
  ok(r.json.duplicate === true && !globalThis.__retrieveCalls.length, 'duplicate event-id: 200 duplicate, geen nieuwe Stripe-call');
  ok(JSON.stringify(await profiel(9)) === JSON.stringify(voor), 'duplicate wijzigt niets');
  // nieuwer event eerst (canceled), daarna oud event (active)
  subs.sub_u9 = maakSub({ id: 'sub_u9', customer: 'cus_9', status: 'canceled', price: 'price_pro' });
  await subEv('customer.subscription.deleted', subs.sub_u9, 'e9_new', { created: 7000 });
  subs.sub_u9 = maakSub({ id: 'sub_u9', customer: 'cus_9', status: 'active', price: 'price_pro' });
  const r2 = await subEv('customer.subscription.updated', subs.sub_u9, 'e9_old', { created: 6000 });
  const p = await profiel(9);
  ok(r2.json.result === 'stale' && p.subscription_status === 'canceled' && !p.subscription_active, 'out-of-order: ouder event na deleted => stale, canceled blijft');
  const r3 = await subEv('customer.subscription.updated', subs.sub_u9, 'e9_later', { created: 8000 });
  ok(r3.json.result === 'stale' && (await profiel(9)).subscription_status === 'canceled', 'eindtoestand canceled herleeft nooit');
}

console.log('--- volgorde zonder eindtoestand');
await maakProfiel(23);
{
  subs.sub_o = maakSub({ id: 'sub_o', customer: 'cus_23', status: 'active', price: 'price_pro' });
  await subEv('customer.subscription.created', subs.sub_o, 'e23_a', { created: 9000 });
  subs.sub_o = maakSub({ id: 'sub_o', customer: 'cus_23', status: 'past_due', price: 'price_pro' });
  await subEv('customer.subscription.updated', subs.sub_o, 'e23_new', { created: 9500 });
  // vertraagd, ouder event (created 9200) dat nu pas binnenkomt; Stripe-stand van dat moment zou 'active' zijn
  subs.sub_o = maakSub({ id: 'sub_o', customer: 'cus_23', status: 'active', price: 'price_pro' });
  const r = await subEv('customer.subscription.updated', subs.sub_o, 'e23_old', { created: 9200 });
  ok(r.json.result === 'stale' && (await profiel(23)).subscription_status === 'past_due', 'ouder event na nieuwer event (geen eindtoestand): stale, nieuwere status blijft');
  const r2 = await subEv('customer.subscription.updated', subs.sub_o, 'e23_newer', { created: 9800 });
  ok(r2.json.result === 'applied' && (await profiel(23)).subscription_status === 'active', 'nog nieuwer event wordt wel toegepast (herstel)');
}

// ================= 6. Verwerkingsfout, retry, busy =================
console.log('--- fout/retry/busy');
await maakProfiel(10);
{
  subs.sub_u10 = Object.assign(new Error('Stripe tijdelijk niet bereikbaar'), { code: 'api_connection_error' });
  const o = { id: 'sub_u10', customer: 'cus_10', status: 'active', items: { data: [] } };
  let r = await post('customer.subscription.created', o, 'e10_x', { created: 100 });
  ok(r.status === 500 && (await ev('e10_x')).status === 'failed', 'retrieve-fout: 500 en event als failed gemarkeerd');
  ok(!(await profiel(10)).stripe_subscription_id, 'bij fout niets naar profiel geschreven');
  subs.sub_u10 = maakSub({ id: 'sub_u10', customer: 'cus_10', status: 'active', price: 'price_pro' });
  const body = payload('customer.subscription.created', o, 'e10_x', 100);
  r = await post('', {}, 'e10_x', { body });
  const e = await ev('e10_x');
  ok(r.status === 200 && e.status === 'processed' && e.attempts === 2 && (await profiel(10)).subscription_active, 'retry van hetzelfde event: processed, attempts=2');
  await q("insert into public.stripe_webhook_events(stripe_event_id,event_type,livemode,stripe_created_at,stripe_object_id,status) values ('e_busy','customer.subscription.updated',false,now(),'sub_zz','processing')");
  r = await post('customer.subscription.updated', { id: 'sub_zz', customer: 'cus_10', status: 'active', items: { data: [] } }, 'e_busy');
  ok(r.status === 503, 'event dat elders al verwerkt wordt => 503 (Stripe herhaalt later)');
  globalThis.__rpcFail = (n) => n === 'stripe_claim_event';
  r = await post('customer.subscription.updated', { id: 'sub_zz', customer: 'cus_10', status: 'active', items: { data: [] } }, 'e_claimfail');
  globalThis.__rpcFail = null;
  ok(r.status === 500, 'claim-fout => 500 (nooit stil negeren)');
}

// ================= 7. Prijs / klant / metadata =================
console.log('--- prijs, klant, metadata');
await maakProfiel(11); await maakProfiel(12); await maakProfiel(13); await maakProfiel(14);
{
  subs.sub_u11 = maakSub({ id: 'sub_u11', customer: 'cus_11', status: 'active', price: 'price_onbekend' });
  await subEv('customer.subscription.created', subs.sub_u11, 'e11');
  let p = await profiel(11);
  ok(p.subscription_active === false && p.subscription_tier === 'free' && p.subscription_status === 'active' && (await conflicten('onbekende_prijs')).length === 1 && isFree(await toegang(11)), 'onbekende Price: geen toegang (nooit gegokt), conflict geregistreerd');
  subs.sub_u12 = maakSub({ id: 'sub_u12', customer: 'cus_12', status: 'active', items: [{ price: { id: 'price_pro' }, current_period_end: T }, { price: { id: 'price_premium' }, current_period_end: T }] });
  await subEv('customer.subscription.created', subs.sub_u12, 'e12');
  p = await profiel(12);
  ok(!p.subscription_active && p.subscription_tier === 'free' && (await conflicten('meerdere_items')).length === 1, 'twee items: geen toegang, conflict meerdere_items');
  subs.sub_x1 = maakSub({ id: 'sub_x1', customer: 'cus_bestaatniet', status: 'active', price: 'price_pro' });
  const r = await subEv('customer.subscription.created', subs.sub_x1, 'e_cust');
  ok(r.status === 200 && r.json.result === 'conflict' && (await conflicten('onbekende_klant')).length === 1, 'customer zonder profiel: conflict, 200');
  ok((await q("select count(*)::int c from public.profiles where stripe_subscription_id='sub_x1'"))[0].c === 0 && (await q('select count(*)::int c from auth.users'))[0].c === (await q('select count(*)::int c from public.profiles'))[0].c, 'webhook maakt nooit profiel of auth-user aan');
  subs.sub_u13 = maakSub({ id: 'sub_u13', customer: 'cus_13', status: 'active', price: 'price_pro', meta: { supabase_user_id: uid(14) } });
  await subEv('customer.subscription.created', subs.sub_u13, 'e13');
  p = await profiel(13);
  ok(!p.subscription_active && !p.stripe_subscription_id && (await conflicten('metadata_wijkt_af')).length === 1 && isFree(await toegang(13)), 'metadata-user wijkt af van klant-profiel: niets geactiveerd, conflict');
  subs.sub_u14 = maakSub({ id: 'sub_u14', customer: 'cus_14', status: 'active', price: 'price_pro', meta: { supabase_user_id: uid(99) } });
  await subEv('customer.subscription.created', subs.sub_u14, 'e14');
  ok(!(await profiel(14)).subscription_active, 'metadata naar andere (niet-bestaande) user: niets geactiveerd');
}

// ================= 8. Dubbele abonnementen =================
console.log('--- dubbel abonnement');
await maakProfiel(15); await maakProfiel(16);
{
  subs.sub_a = maakSub({ id: 'sub_a', customer: 'cus_15', status: 'active', price: 'price_pro' });
  await subEv('customer.subscription.created', subs.sub_a, 'e15_a');
  subs.sub_a = maakSub({ id: 'sub_a', customer: 'cus_15', status: 'active', price: 'price_pro' });
  subs.sub_b = maakSub({ id: 'sub_b', customer: 'cus_15', status: 'active', price: 'price_premium' });
  reset();
  const r = await subEv('customer.subscription.created', subs.sub_b, 'e15_b');
  const p = await profiel(15);
  ok(r.json.result === 'conflict' && p.stripe_subscription_id === 'sub_a' && p.subscription_tier === 'pro', 'tweede abonnement: eerste blijft leidend, geen extra/andere entitlement');
  ok((await conflicten('tweede_abonnement')).length === 1 && globalThis.__retrieveCalls.includes('sub_a'), 'conflict geregistreerd; gekoppelde status vooraf bij Stripe gecontroleerd');
  ok(!globalThis.__retrieveCalls.some((c) => /cancel|refund/.test(c)), 'geen automatische annulering/refund');
  // oud abonnement bij Stripe al canceled maar nog niet verwerkt => nieuw abonnement mag overnemen
  subs.sub_c = maakSub({ id: 'sub_c', customer: 'cus_16', status: 'active', price: 'price_pro' });
  await subEv('customer.subscription.created', subs.sub_c, 'e16_c');
  subs.sub_c = maakSub({ id: 'sub_c', customer: 'cus_16', status: 'canceled', price: 'price_pro' }); // Stripe: al beëindigd, event nog niet binnen
  subs.sub_d = maakSub({ id: 'sub_d', customer: 'cus_16', status: 'active', price: 'price_premium' });
  const r2 = await subEv('customer.subscription.created', subs.sub_d, 'e16_d');
  const p2 = await profiel(16);
  ok(r2.json.result === 'applied' && p2.stripe_subscription_id === 'sub_d' && p2.subscription_tier === 'premium', 'achterlopende opgeslagen status: echte Stripe-status (canceled) maakt overname mogelijk');
  // oud, eindig abonnement dat later binnenkomt verdringt de lopende koppeling niet
  subs.sub_old = maakSub({ id: 'sub_old', customer: 'cus_16', status: 'canceled', price: 'price_pro' });
  const r3 = await subEv('customer.subscription.deleted', subs.sub_old, 'e16_old');
  ok(r3.json.result === 'ignored' && (await profiel(16)).stripe_subscription_id === 'sub_d', 'oud eindig abonnement verdringt lopende koppeling niet');
}

// ================= 9. incomplete / paused =================
console.log('--- incomplete / paused');
await maakProfiel(17, { tier: 'pro', ts: new Date(Date.now() - 86400e3).toISOString(), te: new Date(Date.now() + 5 * 86400e3).toISOString() }); // lopende interne proef
await maakProfiel(18);
{
  subs.sub_i = maakSub({ id: 'sub_i', customer: 'cus_17', status: 'incomplete', price: 'price_pro' });
  await subEv('customer.subscription.created', subs.sub_i, 'e17_inc');
  let p = await profiel(17); const voor = tierVan(p);
  ok(!p.stripe_subscription_id && !p.subscription_status && p.subscription_tier === 'pro' && voor === 'pro', 'incomplete: profiel en lopende interne proef ongemoeid, niet gekoppeld');
  subs.sub_i = maakSub({ id: 'sub_i', customer: 'cus_17', status: 'incomplete_expired', price: 'price_pro' });
  const r = await subEv('customer.subscription.updated', subs.sub_i, 'e17_exp');
  p = await profiel(17);
  ok(r.json.result === 'ignored' && !p.stripe_subscription_id && p.subscription_tier === 'pro', 'incomplete_expired: genegeerd, trialrecht/historie niet verbruikt');
  subs.sub_p = maakSub({ id: 'sub_p', customer: 'cus_18', status: 'active', price: 'price_pro' });
  await subEv('customer.subscription.created', subs.sub_p, 'e18_a');
  subs.sub_p = maakSub({ id: 'sub_p', customer: 'cus_18', status: 'paused', price: 'price_pro' });
  await subEv('customer.subscription.updated', subs.sub_p, 'e18_paused');
  p = await profiel(18);
  ok(p.subscription_status === 'paused' && !p.subscription_active && p.subscription_tier === 'free' && isFree(await toegang(18)) && (await conflicten('paused_onverwacht')).length === 1, 'paused: geen toegang (Free), conflict paused_onverwacht');
  // betaald abonnement na interne proef, zonder Stripe-proef: interne proefhistorie blijft
  subs.sub_j = maakSub({ id: 'sub_j', customer: 'cus_17', status: 'active', price: 'price_premium' });
  const ts0 = (await profiel(17)).trial_started_at;
  await subEv('customer.subscription.created', subs.sub_j, 'e17_paid');
  p = await profiel(17);
  ok(p.subscription_tier === 'premium' && p.subscription_active && +new Date(p.trial_started_at) === +new Date(ts0), 'betaald na interne proef: trial_started_at ongewijzigd (write-once)');
}

// ================= 10. admin, handmatig lid =================
console.log('--- admin / handmatig');
await maakProfiel(19, { role: 'admin', tier: 'premium', active: true });
await maakProfiel(20, { tier: 'premium', active: true });
{
  subs.sub_adm = maakSub({ id: 'sub_adm', customer: 'cus_19', status: 'canceled', price: 'price_pro' });
  const before = JSON.stringify(await profiel(19));
  await subEv('customer.subscription.deleted', subs.sub_adm, 'e19');
  ok(JSON.stringify(await profiel(19)) === before && (await conflicten('admin_profiel')).length === 1, 'admin: profiel byte-voor-byte ongewijzigd (role/tier/active), conflict');
  ok((await toegang(19)).dbPrem === true, 'admin houdt volledige toegang');
  subs.sub_man = maakSub({ id: 'sub_man', customer: 'cus_20', status: 'active', price: 'price_pro' });
  const b2 = JSON.stringify(await profiel(20));
  await subEv('customer.subscription.created', subs.sub_man, 'e20');
  ok(JSON.stringify(await profiel(20)) === b2 && (await conflicten('handmatige_toegang')).length === 1, 'handmatig lid met actieve toegang wordt niet overschreven, conflict');
  subs.sub_man = maakSub({ id: 'sub_man', customer: 'cus_20', status: 'canceled', price: 'price_pro' });
  await subEv('customer.subscription.deleted', subs.sub_man, 'e20b');
  ok(JSON.stringify(await profiel(20)) === b2, 'handmatig lid: ook een Stripe-annulering laat zijn toegang ongemoeid');
}

// ================= 11. Akkoord-audit =================
console.log('--- terms audit');
await maakProfiel(21);
{
  const sessie = (o = {}) => ({ id: o.id ?? 'cs_1', object: 'checkout.session', mode: 'subscription', customer: 'cus_21', subscription: 'sub_u21', client_reference_id: o.cref ?? uid(21),
    metadata: { supabase_user_id: o.meta ?? uid(21), plan: o.plan ?? 'PREMIUM', tier: 'premium', trial_granted: 'true', terms_accepted: o.acc ?? 'true', terms_accepted_at: '2026-10-06T10:00:00.000Z', terms_version: o.ver ?? '2026-10-05' } });
  let r = await post('checkout.session.completed', sessie(), 'ec_1');
  const rij = (await q('select * from public.subscription_terms_acceptances'))[0];
  ok(r.json.result === 'applied' && rij && rij.user_id === uid(21) && rij.terms_version === '2026-10-05' && rij.plan === 'PREMIUM' && rij.tier === 'premium' && rij.stripe_subscription_id === 'sub_u21' && rij.trial_granted === true && +new Date(rij.terms_accepted_at) === Date.parse('2026-10-06T10:00:00.000Z'), 'akkoord vastgelegd: user, sessie, subscription, versie, tijd');
  ok((await profiel(21)).subscription_active === false, 'checkout.session.completed geeft nooit toegang');
  r = await post('checkout.session.completed', sessie(), 'ec_1', { created: 1 });
  ok(r.json.duplicate === true && (await q('select count(*)::int c from public.subscription_terms_acceptances'))[0].c === 1, 'zelfde event nogmaals: geen tweede akkoordrij');
  const n0 = (await q('select count(*)::int c from public.subscription_terms_acceptances'))[0].c;
  await post('checkout.session.completed', sessie({ id: 'cs_2', cref: uid(5) }), 'ec_2');
  await post('checkout.session.completed', sessie({ id: 'cs_3', meta: uid(5) }), 'ec_3');
  await post('checkout.session.completed', sessie({ id: 'cs_4', acc: 'false' }), 'ec_4');
  await post('checkout.session.completed', sessie({ id: 'cs_5', ver: 'vorige-week' }), 'ec_5');
  await post('checkout.session.completed', sessie({ id: 'cs_6', plan: 'GOUD' }), 'ec_6');
  ok((await q('select count(*)::int c from public.subscription_terms_acceptances'))[0].c === n0 && (await q("select coalesce(sum(occurrences),0)::int s from public.stripe_billing_conflicts where kind='sessie_zonder_profiel'"))[0].s >= 5 && (await q("select count(*)::int c from public.stripe_webhook_events where stripe_event_id in ('ec_2','ec_3','ec_4','ec_5','ec_6') and status='conflict'"))[0].c === 5, 'afwijkende reference/metadata/akkoord/versie/plan: geen akkoordrij, conflicten geregistreerd');
  let fout = null; try { await q("update public.subscription_terms_acceptances set terms_version='2030-01-01'"); } catch (e) { fout = e.message; }
  ok(/append-only/.test(fout || ''), 'akkoordhistorie is niet te wijzigen');
}

// ================= 12. Write-once proefvelden =================
console.log('--- trial write-once');
await maakProfiel(22);
{
  const t0 = nu();
  subs.sub_w1 = maakSub({ id: 'sub_w1', customer: 'cus_22', status: 'trialing', ts: t0, te: t0 + 86400, price: 'price_premium' });
  await subEv('customer.subscription.created', subs.sub_w1, 'e22_a');
  const p1 = await profiel(22);
  subs.sub_w1 = maakSub({ id: 'sub_w1', customer: 'cus_22', status: 'canceled', ts: t0, te: t0 + 86400, price: 'price_premium' });
  await subEv('customer.subscription.deleted', subs.sub_w1, 'e22_b');
  subs.sub_w2 = maakSub({ id: 'sub_w2', customer: 'cus_22', status: 'trialing', ts: t0 + 5000, te: t0 + 5000 + 604800, price: 'price_pro' });
  await subEv('customer.subscription.created', subs.sub_w2, 'e22_c');
  const p2 = await profiel(22);
  ok(+new Date(p2.trial_started_at) === +new Date(p1.trial_started_at) && +new Date(p2.trial_ends_at) === +new Date(p1.trial_ends_at), 'trialvelden worden nooit herschreven door een latere (hypothetische) proef');
  ok(+new Date(p2.subscription_started_at) === +new Date(p1.subscription_started_at), 'subscription_started_at write-once');
}

// ================= 13. Algemene invarianten =================
console.log('--- invarianten');
{
  const rollen = await q("select id, role from public.profiles where role='admin'");
  ok(rollen.length === 1 && rollen[0].id === uid(19), 'role: alleen het admin-profiel is admin; geen enkel event wijzigde een rol');
  ok((await q('select count(*)::int c from public.profiles where subscription_ends_at is not null'))[0].c === 0, 'subscription_ends_at nergens geschreven');
  ok(globalThis.__supabaseKeyUsed === SERVICE_KEY, 'service-role-sleutel alleen intern gebruikt voor de RPC-client');
  const openEvents = await q("select stripe_event_id from public.stripe_webhook_events where status='processing' and stripe_event_id <> 'e_busy'");
  ok(openEvents.length === 0, 'geen event blijft hangen in processing');
  const alleToegang = await q("select id from public.profiles where subscription_active and subscription_tier='free'");
  ok(alleToegang.length === 0, 'nergens actief met tier free');
  const inconsistent = await q("select id from public.profiles where subscription_tier in ('pro','premium') and not subscription_active and stripe_subscription_id is not null");
  ok(inconsistent.length === 0, 'Stripe-beheerde profielen: tier pro/premium <=> actief (geen restant-tier zonder toegang)');
}

console.log(`\nRESULTAAT: ${pass} geslaagd, ${fail} mislukt`);
await db.end();
process.exit(fail ? 1 : 0);
