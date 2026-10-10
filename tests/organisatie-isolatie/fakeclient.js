// Nep-Supabase in het geheugen, met RLS-gedrag: elke rij heeft user_id en is alleen voor die gebruiker zichtbaar.
export const isConfigured = true;
const db = (globalThis.__DB = globalThis.__DB || {});
let teller = 0;
const uid = () => (globalThis.__USER ? globalThis.__USER.id : null);

function tabel(n) { return (db[n] = db[n] || []); }

function maak(n) {
  const st = { op: 'select', f: [], payload: null, ret: false, ord: null, een: null, conflict: null };
  const zichtbaar = (r) => (r.user_id === undefined ? true : r.user_id === uid());
  const run = () => {
    const t = tabel(n);
    if (st.op === 'insert') {
      const rows = (Array.isArray(st.payload) ? st.payload : [st.payload]);
      if (rows.some((r) => r.user_id !== uid())) return { data: null, error: { message: 'RLS: insert geweigerd' } };
      const nieuw = rows.map((r) => ({ id: `${n}-${++teller}`, ...r }));
      nieuw.forEach((r) => t.push(r));
      return { data: st.een ? nieuw[0] : nieuw, error: null };
    }
    if (st.op === 'upsert') {
      const keys = (st.conflict || 'id').split(',');
      (Array.isArray(st.payload) ? st.payload : [st.payload]).forEach((r) => {
        if (r.user_id !== uid()) return;
        const i = t.findIndex((x) => keys.every((k) => x[k] === r[k]));
        if (i === -1) t.push({ ...r }); else Object.assign(t[i], r);
      });
      return { data: null, error: null };
    }
    const match = t.filter((r) => zichtbaar(r) && st.f.every(([k, w, soort]) => (soort === 'in' ? w.includes(r[k]) : r[k] === w)));
    if (st.op === 'update') { match.forEach((r) => Object.assign(r, st.payload)); return { data: null, error: null }; }
    if (st.op === 'delete') { match.forEach((r) => t.splice(t.indexOf(r), 1)); return { data: null, error: null }; }
    let res = match.map((r) => ({ ...r }));
    if (st.ord) res.sort((a, b) => (a[st.ord.k] < b[st.ord.k] ? 1 : -1) * (st.ord.asc ? -1 : 1));
    if (st.een === 'maybe') return { data: res[0] || null, error: null };
    if (st.een === 'single') return res[0] ? { data: res[0], error: null } : { data: null, error: { message: 'geen rij' } };
    return { data: res, error: null };
  };
  const api = {
    select() { return api; },
    insert(p) { st.op = 'insert'; st.payload = p; return api; },
    update(p) { st.op = 'update'; st.payload = p; return api; },
    upsert(p, o) { st.op = 'upsert'; st.payload = p; st.conflict = o && o.onConflict; return api; },
    delete() { st.op = 'delete'; return api; },
    eq(k, w) { st.f.push([k, w, 'eq']); return api; },
    in(k, w) { st.f.push([k, w, 'in']); return api; },
    order(k, o) { st.ord = { k, asc: !(o && o.ascending === false) }; return api; },
    maybeSingle() { st.een = 'maybe'; return Promise.resolve(run()); },
    single() { st.een = 'single'; return Promise.resolve(run()); },
    then(a, b) { return Promise.resolve(run()).then(a, b); },
  };
  return api;
}

export const supabase = {
  from: (n) => maak(n),
  auth: { getUser: async () => ({ data: { user: globalThis.__USER || null } }) },
  functions: { invoke: async () => ({ data: null, error: null }) },
  rpc: async () => ({ data: null, error: null }),
  storage: { from: () => ({}) },
};
export async function query(fn, fb = null) { try { return await fn(supabase); } catch (e) { return { data: fb, error: e }; } }
