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
    const match = t.filter((r) => zichtbaar(r) && st.f.every(([k, w, s]) => (s === 'in' ? w.includes(r[k]) : r[k] === w)));
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
  functions: { invoke: async () => ({ data: null, error: null }) },
  rpc: async () => ({ data: null, error: null }),
  storage: { from: () => ({ list: async () => ({ data: [], error: null }) }) },
};
export async function query(fn, fb = null) { try { return await fn(supabase); } catch (e) { return { data: fb, error: e }; } }
