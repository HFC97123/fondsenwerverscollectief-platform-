// Nep-Supabase voor de browsertest van het ledenprofiel (foto + bio). Hergebruikt de
// nagebootste client van de beheertabellen en voegt toe:
//   * profiles: het eigen profiel uit window.__SEED, aangevuld met bio/avatar_path (localStorage);
//   * storage 'profile-images': upload/remove/createSignedUrl met dezelfde regels als de database
//     (pad <uid>/avatar-<tijd>-<willekeur>.<jpg|png|webp>, alleen eigen map, alleen goedgekeurd lid);
//   * RPC's zet_mijn_avatar / zet_mijn_bio met dezelfde validatie als de SQL-functies.
// window.__FAIL = 'upload' | 'rpc' | 'bio' | 'remove' laat die stap falen; window.__KAPOT = true geeft
// een onleesbare afbeelding terug; alle aanroepen staan in window.__SBLOG.
import { supabase as basis } from '../../beheer-tabellen/fakeclient.js';

export const isConfigured = true;
const KEY = 'fakeprofiel';
const log = (x) => { (window.__SBLOG = window.__SBLOG || []).push(x); };
const lees = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || { profiel: {}, objecten: {} }; } catch (e) { return { profiel: {}, objecten: {} }; } };
const bewaar = (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* */ } };
const me = () => window.__USER;
const eigenSeed = () => ((window.__SEED.tables.profiles || []).find((p) => me() && p.id === me().id) || null);
const goedgekeurd = () => { const p = eigenSeed(); return !!p && p.status === 'approved'; };
const fout = (m) => ({ data: null, error: new Error(m) });
const patroon = () => new RegExp('^' + me().id + '/avatar-[0-9]{10,}-[a-z0-9]{4,12}\\.(jpg|png|webp)$');
const naarDataUrl = (file) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file); });

function profielQuery() {
  const st = { f: [] };
  const run = () => {
    const seed = eigenSeed();
    const rij = seed ? { ...seed, bio: null, avatar_path: null, ...(lees().profiel[seed.id] || {}) } : null;
    const hit = rij && st.f.every(([k, w]) => rij[k] === w);
    return { data: hit ? rij : null, error: hit ? null : { message: 'geen rij' } };
  };
  const api = {
    select() { return api; }, eq(k, w) { st.f.push([k, w]); return api; }, order() { return api; },
    single() { return Promise.resolve(run()); }, maybeSingle() { return Promise.resolve(run()); },
    then(a, b) { const r = run(); return Promise.resolve({ data: r.data ? [r.data] : [], error: null }).then(a, b); },
  };
  return api;
}

export const supabase = {
  ...basis,
  from: (n) => (n === 'profiles' ? profielQuery() : basis.from(n)),
  storage: {
    from: (bucket) => ({
      upload: async (pad, file, opties) => {
        log({ op: 'upload', bucket, pad, type: opties && opties.contentType, upsert: opties && opties.upsert, grootte: file.size });
        if (window.__FAIL === 'upload') return fout('upload mislukt');
        if (bucket !== 'profile-images' || !me() || !goedgekeurd() || !patroon().test(pad)) return fout('new row violates row-level security policy');
        const d = lees();
        if (d.objecten[pad]) return fout('The resource already exists');
        d.objecten[pad] = await naarDataUrl(file);
        bewaar(d);
        return { data: { path: pad }, error: null };
      },
      remove: async (paden) => {
        log({ op: 'remove', bucket, paden });
        if (window.__FAIL === 'remove') throw new Error('remove mislukt');
        const d = lees();
        paden.forEach((p) => { if (me() && p.startsWith(me().id + '/')) delete d.objecten[p]; });
        bewaar(d);
        return { data: paden, error: null };
      },
      createSignedUrl: async (pad, sec) => {
        log({ op: 'signed', pad, sec });
        const d = lees();
        if (!me() || !pad.startsWith(me().id + '/') || !d.objecten[pad]) return fout('niet gevonden');
        return { data: { signedUrl: window.__KAPOT ? 'data:image/png;base64,AAAA' : d.objecten[pad] }, error: null };
      },
    }),
  },
  rpc: async (naam, args) => {
    log({ op: 'rpc', naam, args });
    const d = lees();
    const id = me() && me().id;
    if (naam === 'zet_mijn_avatar') {
      if (window.__FAIL === 'rpc') return fout('rpc mislukt');
      if (!id) return fout('Niet ingelogd');
      const pad = args.p_pad;
      if (pad !== null) {
        if (!patroon().test(pad)) return fout('Ongeldig pad voor profielfoto');
        if (!d.objecten[pad]) return fout('Profielfoto is niet gevonden in de opslag');
      }
      if (!goedgekeurd()) return fout('Profiel niet gevonden of nog niet goedgekeurd');
      d.profiel[id] = { ...(d.profiel[id] || {}), avatar_path: pad };
      bewaar(d);
      return { data: null, error: null };
    }
    if (naam === 'zet_mijn_bio') {
      if (window.__FAIL === 'bio') return fout('bio mislukt');
      if (!id) return fout('Niet ingelogd');
      const bio = (args.p_bio || '').replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '') || null;
      if (bio && bio.length > 2000) return fout('De beschrijving mag maximaal 2000 tekens bevatten');
      if (!goedgekeurd()) return fout('Profiel niet gevonden of nog niet goedgekeurd');
      d.profiel[id] = { ...(d.profiel[id] || {}), bio };
      bewaar(d);
      return { data: null, error: null };
    }
    return { data: null, error: null };
  },
};

export async function query(fn, fb = null) {
  try { const res = await fn(supabase); return res && res.error ? { data: fb, error: res.error } : res; } catch (e) { return { data: fb, error: e }; }
}
