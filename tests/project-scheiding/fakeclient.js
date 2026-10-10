// Nep-Supabase in het geheugen met RLS-gedrag (rij alleen zichtbaar voor eigen user_id)
// en de foreign-key-acties van de echte database (zie migratie
// project_organisatie_scheiding_waarborgen): documenten en websitebronnen van een
// project gaan mee (CASCADE); gesprekken en berichten verliezen alleen hun projectkoppeling (SET NULL).
export const isConfigured = true;
const db = (globalThis.__DB = globalThis.__DB || {});
let teller = 0;
const uid = () => (globalThis.__USER ? globalThis.__USER.id : null);
const nieuwId = () => `00000000-0000-4000-8000-${String(++teller).padStart(12, '0')}`;
const tabel = (n) => (db[n] = db[n] || []);

const FK = {
  subsidie_kompas_programs: [
    { tabel: 'subsidie_kompas_knowledge_items', kolom: 'program_id', actie: 'cascade' },
    { tabel: 'subsidie_kompas_website_sources', kolom: 'program_id', actie: 'cascade' },
    { tabel: 'subsidie_kompas_conversations', kolom: 'active_program_id', actie: 'setnull' },
    { tabel: 'subsidie_kompas_messages', kolom: 'program_id', actie: 'setnull' },
  ],
};

function maak(n) {
  const st = { op: 'select', f: [], payload: null, ord: null, een: null, conflict: null };
  const zichtbaar = (r) => (r.user_id === undefined ? true : r.user_id === uid());
  const pas = (r, [k, w, soort]) => (soort === 'in' ? w.includes(r[k]) : soort === 'is' ? (r[k] ?? null) === w : r[k] === w);
  const run = () => {
    const t = tabel(n);
    if (st.op === 'insert') {
      const rows = Array.isArray(st.payload) ? st.payload : [st.payload];
      if (rows.some((r) => r.user_id !== uid())) return { data: null, error: { message: 'RLS: insert geweigerd' } };
      const nieuw = rows.map((r) => ({ id: nieuwId(), created_at: new Date(Date.now() + teller).toISOString(), ...r }));
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
    const match = t.filter((r) => zichtbaar(r) && st.f.every((f) => pas(r, f)));
    if (st.op === 'update') { match.forEach((r) => Object.assign(r, st.payload)); return { data: null, error: null }; }
    if (st.op === 'delete') {
      match.forEach((r) => {
        t.splice(t.indexOf(r), 1);
        (FK[n] || []).forEach(({ tabel: kind, kolom, actie }) => {
          const kt = tabel(kind);
          kt.filter((x) => x[kolom] === r.id).forEach((x) => { if (actie === 'cascade') kt.splice(kt.indexOf(x), 1); else x[kolom] = null; });
        });
      });
      return { data: null, error: null };
    }
    let res = match.map((r) => ({ ...r }));
    if (st.ord) res.sort((a, b) => ((a[st.ord.k] || '') < (b[st.ord.k] || '') ? -1 : 1) * (st.ord.asc ? 1 : -1));
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
    is(k, w) { st.f.push([k, w, 'is']); return api; },
    order(k, o) { st.ord = { k, asc: !(o && o.ascending === false) }; return api; },
    maybeSingle() { st.een = 'maybe'; return Promise.resolve(run()); },
    single() { st.een = 'single'; return Promise.resolve(run()); },
    then(a, b) { return Promise.resolve(run()).then(a, b); },
  };
  return api;
}

export const supabase = {
  from: (n) => maak(n),
  auth: { getUser: async () => ({ data: { user: globalThis.__USER || null } }), getSession: async () => ({ data: { session: null } }) },
  functions: { invoke: async () => ({ data: null, error: null }) },
  rpc: async () => ({ data: null, error: null }),
  storage: { from: () => ({}) },
};
export async function query(fn, fb = null) { try { return await fn(supabase); } catch (e) { return { data: fb, error: e }; } }
