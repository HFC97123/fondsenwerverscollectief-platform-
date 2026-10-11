// Nep-Supabase voor de browsertest van de beheertabellen. In-memory + localStorage
// (zodat een refresh de data behoudt) en een nabootsing van de database-regels:
//   * videos/resources/sessions/blog_posts: bezoekers en leden zien alleen
//     status 'published'; alleen een beheerder (profiel role 'admin') ziet
//     concepten en mag schrijven (RLS);
//   * trigger: updated_at altijd, published_at alleen invullen als leeg,
//     leeg bij concept;
//   * title niet leeg, session_date verplicht, status draft|published.
export const isConfigured = true;
const BEHEER = ['videos', 'resources', 'sessions', 'blog_posts'];
const seed = () => window.__SEED;
const me = () => window.__USER;
const isAdmin = () => !window.__GEENSESSIE && (seed().tables.profiles || []).some((p) => p.id === me().id && p.role === 'admin');
let teller = 0;
const KEY = 'fakedb-beheer';
const db = () => {
  if (window.__DBL) return window.__DBL;
  let d = null;
  try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { d = null; }
  window.__DBL = d || JSON.parse(JSON.stringify(seed().tables));
  BEHEER.forEach((t) => { window.__DBL[t] = window.__DBL[t] || []; });
  return window.__DBL;
};
const bewaar = () => { try { localStorage.setItem(KEY, JSON.stringify(window.__DBL)); } catch (e) { /* */ } };
const tabel = (n) => (db()[n] = db()[n] || []);
window.__LOG = window.__LOG || [];

const trigger = (n, nieuw, oud) => {
  const now = new Date().toISOString();
  nieuw.updated_at = now;
  if (nieuw.status === 'published') {
    nieuw.published_at = (oud && oud.status === 'published' && oud.published_at) ? oud.published_at : (nieuw.published_at || now);
  } else nieuw.published_at = null;
};
const valideer = (n, r) => {
  if (r.status !== undefined && !['draft', 'published'].includes(r.status)) return 'check status';
  if (r.title !== undefined && !String(r.title || '').trim()) return 'check title';
  if (n === 'sessions' && 'session_date' in r && !r.session_date) return 'not null session_date';
  return null;
};

function maak(n) {
  const st = { op: 'select', f: [], payload: null, ord: [], een: null, conflict: null };
  const run = () => {
    if (!(n in db())) return { data: null, error: { message: `relation ${n} does not exist` } };
    const t = tabel(n);
    const beheerTabel = BEHEER.includes(n);
    window.__LOG.push({ tabel: n, op: st.op });
    const zichtbaar = (r) => {
      if (beheerTabel) return isAdmin() || r.status === 'published';
      return r.user_id === undefined ? true : (!window.__GEENSESSIE && r.user_id === me().id);
    };
    if (st.op !== 'select' && beheerTabel && !isAdmin()) return { data: null, error: { message: 'new row violates row-level security policy' } };
    if (st.op === 'insert') {
      const rows = Array.isArray(st.payload) ? st.payload : [st.payload];
      for (const r of rows) { const e = beheerTabel ? valideer(n, r) : null; if (e) return { data: null, error: { message: e } }; }
      const nieuw = rows.map((r) => { const o = { id: `00000000-0000-4000-8000-${String(++teller).padStart(12, '0')}`, status: 'draft', published_at: null, created_at: new Date().toISOString(), ...r }; if (beheerTabel) trigger(n, o, null); return o; });
      nieuw.forEach((r) => t.push(r)); bewaar();
      return { data: st.een ? nieuw[0] : nieuw, error: null };
    }
    if (st.op === 'upsert') {
      const keys = (st.conflict || 'id').split(',');
      (Array.isArray(st.payload) ? st.payload : [st.payload]).forEach((r) => {
        const i = t.findIndex((x) => keys.every((k) => x[k] === r[k]));
        if (i === -1) t.push({ ...r }); else Object.assign(t[i], r);
      }); bewaar();
      return { data: null, error: null };
    }
    const match = t.filter((r) => zichtbaar(r) && st.f.every(([k, w, s]) => (s === 'in' ? w.includes(r[k]) : r[k] === w)));
    if (st.op === 'update') {
      for (const r of match) { const e = beheerTabel ? valideer(n, st.payload) : null; if (e) return { data: null, error: { message: e } }; }
      match.forEach((r) => { const oud = { ...r }; Object.assign(r, st.payload); if (beheerTabel) trigger(n, r, oud); }); bewaar();
      return { data: null, error: null };
    }
    if (st.op === 'delete') { match.forEach((r) => t.splice(t.indexOf(r), 1)); bewaar(); return { data: null, error: null }; }
    const res = match.map((r) => ({ ...r }));
    res.sort((a, b) => {
      for (const o of st.ord) {
        const x = a[o.k], y = b[o.k];
        if (x === y) continue;
        if (x === null || x === undefined) return 1;
        if (y === null || y === undefined) return -1;
        return (x < y ? -1 : 1) * (o.asc ? 1 : -1);
      }
      return 0;
    });
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
    order(k, o) { st.ord.push({ k, asc: !(o && o.ascending === false) }); return api; },
    maybeSingle() { st.een = 'maybe'; return Promise.resolve(run()); }, single() { st.een = 'single'; return Promise.resolve(run()); },
    then(a, b) { return Promise.resolve(run()).then(a, b); },
  };
  return api;
}

const sessie = () => ({ user: me(), access_token: 'x' });
export const supabase = {
  from: (n) => maak(n),
  auth: {
    getUser: async () => ({ data: { user: window.__GEENSESSIE ? null : me() } }),
    getSession: async () => ({ data: { session: window.__GEENSESSIE ? null : sessie() }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null }),
  },
  functions: { invoke: async () => ({ data: null, error: null }) },
  rpc: async () => ({ data: null, error: null }),
  storage: { from: () => ({ list: async () => ({ data: [], error: null }) }) },
};
export async function query(fn, fb = null) { try { return await fn(supabase); } catch (e) { return { data: fb, error: e }; } }
