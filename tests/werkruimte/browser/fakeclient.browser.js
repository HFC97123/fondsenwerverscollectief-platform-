// Nep-Supabase voor de browsertest: in-memory, met "RLS" (rijen met user_id zijn alleen voor die gebruiker).
export const isConfigured = true;
const seed = () => window.__SEED;
const me = () => window.__USER;
let teller = 0;
const db = () => (window.__DBL = window.__DBL || JSON.parse(JSON.stringify(seed().tables)));
const tabel = (n) => (db()[n] = db()[n] || []);
window.__LOG = window.__LOG || [];

function maak(n) {
  const st = { op: 'select', f: [], payload: null, ord: null, een: null, conflict: null };
  const zichtbaar = (r) => (r.user_id === undefined ? true : r.user_id === me().id);
  const run = () => {
    if (!(n in seed().tables)) return { data: null, error: { message: `relation ${n} does not exist` } };
    const t = tabel(n);
    window.__LOG.push({ tabel: n, op: st.op, filters: st.f.map(([k, w, s]) => `${k}${s === 'in' ? ' in ' : '='}${JSON.stringify(w)}`) });
    if (st.op === 'insert') {
      const rows = Array.isArray(st.payload) ? st.payload : [st.payload];
      if (n === 'subsidie_kompas_program_funding') {
        const eigen = rows.find((r) => r.user_id !== me().id || !tabel('subsidie_kompas_programs').some((p) => p.id === r.program_id && p.user_id === me().id));
        if (eigen) return { data: null, error: { code: '42501', message: 'new row violates row-level security policy' } };
        const dubbel = rows.find((r) => t.some((x) => x.program_id === r.program_id && ((r.scheme_id && x.scheme_id === r.scheme_id) || (r.funder_id && x.funder_id === r.funder_id))));
        if (dubbel) return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
      }
      const nieuw = rows.map((r) => ({ id: `00000000-0000-4000-8000-${String(++teller).padStart(12, '0')}`, ...r }));
      nieuw.forEach((r) => t.push(r));
      return { data: st.een ? nieuw[0] : nieuw, error: null };
    }
    if (st.op === 'upsert') {
      const keys = (st.conflict || 'id').split(',');
      (Array.isArray(st.payload) ? st.payload : [st.payload]).forEach((r) => {
        const i = t.findIndex((x) => keys.every((k) => x[k] === r[k]));
        if (i === -1) t.push({ ...r }); else Object.assign(t[i], r);
      });
      return { data: null, error: null };
    }
    const match = t.filter((r) => zichtbaar(r) && st.f.every(([k, w, s]) => (s === 'in' ? w.includes(r[k]) : s === 'neq' ? r[k] !== w : r[k] === w)));
    if (st.op === 'update') { match.forEach((r) => Object.assign(r, st.payload)); return { data: null, error: null }; }
    if (st.op === 'delete') { match.forEach((r) => t.splice(t.indexOf(r), 1)); return { data: null, error: null }; }
    let res = match.map((r) => ({ ...r }));
    if (st.ord) res.sort((a, b) => (a[st.ord.k] < b[st.ord.k] ? 1 : -1) * (st.ord.asc ? -1 : 1));
    if (st.een === 'maybe') return { data: res[0] || null, error: null };
    if (st.een === 'single') return res[0] ? { data: res[0], error: null } : { data: null, error: { message: 'geen rij' } };
    return { data: res, error: null };
  };
  const api = {
    select() { return api; }, insert(p) { st.op = 'insert'; st.payload = p; return api; },
    update(p) { st.op = 'update'; st.payload = p; return api; },
    upsert(p, o) { st.op = 'upsert'; st.payload = p; st.conflict = o && o.onConflict; return api; },
    delete() { st.op = 'delete'; return api; },
    neq(k, w) { st.f.push([k, w, 'neq']); return api; }, limit() { return api; },
    eq(k, w) { st.f.push([k, w, 'eq']); return api; }, is(k, w) { st.f.push([k, w, 'eq']); return api; }, in(k, w) { st.f.push([k, w, 'in']); return api; },
    order(k, o) { st.ord = { k, asc: !(o && o.ascending === false) }; return api; },
    maybeSingle() { st.een = 'maybe'; return Promise.resolve(run()); }, single() { st.een = 'single'; return Promise.resolve(run()); },
    then(a, b) { return Promise.resolve(run()).then(a, b); },
  };
  return api;
}

const sessie = () => ({ user: me(), access_token: 'x' });
export const supabase = {
  from: (n) => (window.__PROFILEFOUT && n === 'profiles' ? { select: () => ({ eq: () => ({ single: async () => ({ data: null, error: { message: 'x' } }) }) }) } : maak(n)),
  auth: {
    getUser: async () => ({ data: { user: window.__GEENSESSIE ? null : me() } }),
    getSession: async () => ({ data: { session: sessie() }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null }),
  },
  functions: { invoke: async (n) => { window.__LOG.push({ tabel: `functions:${n}`, op: 'invoke', filters: [] }); return { data: null, error: null }; } },
  rpc: async (naam, args) => {
    window.__LOG.push({ tabel: `rpc:${naam}`, op: 'rpc', filters: [JSON.stringify(args || {})] });
    if (naam !== 'kompas_dekkingsplan') return { data: null, error: null };
    if (window.__RPCFOUT === 'niet-beschikbaar') return { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.kompas_dekkingsplan' } };
    if (window.__RPCFOUT === 'fout') return { data: null, error: { code: 'XX000', message: 'boem' } };
    const prog = tabel('subsidie_kompas_programs').find((p) => p.id === (args || {}).p_program_id);
    if (!window.__USER || !prog || prog.user_id !== me().id) return { data: null, error: { code: '42501', message: 'Project niet gevonden' } };
    // Live-smoke: antwoorden die écht door kompas_dekkingsplan op de live database zijn teruggegeven (zie tests/werkruimte/live-smoke).
    if (window.__LIVE_RPC) return { data: (window.__LIVE_RPC[prog.id] || []).map((x) => ({ ...x })), error: null };
    const premium = ['premium', 'admin'].includes(window.__TIER);
    const B = seed().bronnen || {};
    const rijen = tabel('subsidie_kompas_program_funding').filter((r) => r.program_id === prog.id && r.user_id === me().id);
    const uit = rijen.map((r) => {
      const bron = B[r.scheme_id || r.funder_id] || null;
      const basis = { id: r.id, program_id: r.program_id, scheme_id: null, funder_id: null, bron_type: r.scheme_id ? 'regeling' : r.funder_id ? 'fonds' : null, bron_status: 'zichtbaar', bron_naam: null, funder_naam: null, website: null, systeem_deadline: null, systeem_deadline_bron: null, requested_amount: r.requested_amount ?? null, awarded_amount: r.awarded_amount ?? null, status: r.status, eigen_deadline: r.eigen_deadline || null, effectieve_deadline: r.eigen_deadline || null, reminder_enabled: r.reminder_enabled !== false, notes: r.notes || null, created_at: r.created_at || '2026-10-01T10:00:00Z', updated_at: r.created_at || '2026-10-01T10:00:00Z' };
      if (!r.scheme_id && !r.funder_id) return { ...basis, bron_status: 'verwijderd' };
      if (!bron || (bron.premium && !premium)) return { ...basis, bron_status: 'verborgen' };
      return { ...basis, scheme_id: r.scheme_id, funder_id: r.funder_id, bron_naam: bron.naam, funder_naam: bron.funder || null, website: bron.website || null, systeem_deadline: bron.deadline || null, systeem_deadline_bron: bron.deadline ? (r.funder_id ? 'fonds' : 'regeling') : null, effectieve_deadline: r.eigen_deadline || bron.deadline || null };
    });
    return { data: uit, error: null };
  },
  storage: { from: () => ({ list: async () => ({ data: [], error: null }) }) },
};
export async function query(fn, fb = null) { try { return await fn(supabase); } catch (e) { return { data: fb, error: e }; } }
