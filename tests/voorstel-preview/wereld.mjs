// Nagebootste wereld voor de voorstel-preview-tests: database, DNS, webserver en Deno-API.
// ---------------------------------------------------------------------------------------------------------------------------
// Nagebootste wereld
export const UID = '11111111-1111-4111-8111-111111111111';
export const ANDER = '99999999-9999-4999-8999-999999999999';
export const PID = '22222222-2222-4222-8222-222222222222';
export const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; // regeling, free-toegankelijk
export const P = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'; // regeling, premium-record, niet exclusief
export const X = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'; // regeling van een exclusief fonds
export const F = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'; // fonds, free
export const XF = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'; // exclusief fonds
const BESTAAND = '12121212-1212-4212-8212-121212121212';

const PAGINA_A = '<!doctype html><html><head><title>Aanvragen</title></head><body><h1>Rotterdams Jongerencultuurfonds</h1><p>Aanvragen kan tot 12 november 2026.</p><p>Maximaal € 25.000 per aanvraag.</p><p>Minimaal € 5.000 per project.</p></body></html>';

export const w = {};
export function reset(extra = {}) {
  Object.keys(w).forEach((k) => delete w[k]);
  Object.assign(w, {
    env: { OPENAI_API_KEY: 'sk-test', SUPABASE_URL: 'http://db.test', SUPABASE_SERVICE_ROLE_KEY: 'srv', SUPABASE_ANON_KEY: 'anon', VOORSTEL_PREVIEW: 'aan' },
    user: { id: UID },
    profile: { subscription_tier: 'free', subscription_active: false, trial_ends_at: null, role: 'user' },
    project: { id: PID, user_id: UID, budget_total: 100000, own_contribution: 20000, archived_at: null },
    dekkingsplan: [{ id: BESTAAND, bron_status: 'zichtbaar', bron_type: 'regeling', scheme_id: '77777777-7777-4777-8777-777777777777', funder_id: null, bron_naam: 'Bestaande regeling', funder_naam: 'Gever', status: 'preparing', requested_amount: 10000, awarded_amount: null, eigen_deadline: null, effectieve_deadline: null }],
    dekkingsplanFout: false,
    regelingen: [
      { regeling_id: A, naam: 'Rotterdams Jongerencultuurfonds', funder_id: 'f0000000-0000-4000-8000-00000000000a', funder_naam: 'Gemeente Rotterdam', funder_website: 'https://www.rotterdam.example.nl/', aanvraaglink: 'https://www.fonds-a.example.nl/aanvragen', deadline_datum: '2026-11-12', bedrag_min: 5000, bedrag_max: 25000, cofinanciering: null, access_tier: 'free' },
      { regeling_id: P, naam: 'Premium Cultuurregeling', funder_id: 'f0000000-0000-4000-8000-00000000000b', funder_naam: 'Premium Gever', funder_website: 'https://www.premium.example.nl/', aanvraaglink: 'https://www.premium.example.nl/regeling', deadline_datum: '2026-12-01', bedrag_min: 1000, bedrag_max: 90000, cofinanciering: '50%', access_tier: 'premium' },
      { regeling_id: X, naam: 'Geheime Regeling', funder_id: XF, funder_naam: 'Geheim Exclusief Fonds', funder_website: 'https://www.geheimfonds.nl/', aanvraaglink: 'https://www.geheimfonds.nl/regeling', deadline_datum: '2026-12-31', bedrag_min: 1, bedrag_max: 2, cofinanciering: null, access_tier: 'free' },
    ],
    funders: [
      { funder_id: F, funder_naam: 'Fonds Voorbeeld', funder_website: 'https://www.fonds-f.example.nl/', bijdrage_min: 500, bijdrage_max: 8000, access_tier: 'free' },
      { funder_id: XF, funder_naam: 'Geheim Exclusief Fonds', funder_website: 'https://www.geheimfonds.nl/', bijdrage_min: 10, bijdrage_max: 20, access_tier: 'free' },
    ],
    exclusief: [{ funder_id: XF, naam: 'Geheim Exclusief Fonds', website: 'https://www.geheimfonds.nl/', aliassen: [], regeling_namen: ['Geheime Regeling'], regeling_links: [] }],
    dns: { 'www.fonds-a.example.nl': ['93.184.216.34'], 'www.fonds-f.example.nl': ['93.184.216.34'], 'www.premium.example.nl': ['93.184.216.34'], 'www.geheimfonds.nl': ['93.184.216.34'] },
    paginas: { 'https://www.fonds-a.example.nl/aanvragen': PAGINA_A, 'https://www.fonds-f.example.nl/': '<html><head><title>x</title></head><body><h1>Fonds Voorbeeld</h1><p>Wij steunen projecten in Rotterdam.</p></body></html>' },
    schrijfpogingen: [], gebruikRijen: [], rpcs: [], fetches: [], dnsOpgevraagd: [], tabellen: [],
    ...extra,
  });
}

const builder = (tabel) => {
  const filters = {};
  const b = {
    select() { return b; },
    eq(k, v) { filters[k] = v; return b; },
    is(k, v) { filters[k] = v; return b; },
    in() { return b; }, order() { return b; }, limit() { return b; },
    single: async () => (tabel === 'profiles' ? { data: w.profile, error: w.profile ? null : { code: 'PGRST116' } } : { data: null, error: null }),
    maybeSingle: async () => {
      w.tabellen.push(tabel);
      if (tabel === 'subsidie_kompas_programs') return { data: w.project && filters.id === w.project.id && filters.user_id === w.project.user_id && filters.archived_at === null && w.project.archived_at === null ? w.project : null, error: null };
      return { data: null, error: null };
    },
    // De interne kostenmeter is de ENIGE toegestane insert: alleen tellers, geen inhoud. Wordt apart bijgehouden en getoetst.
    insert(r) {
      if (tabel === 'kompas_gebruik_log') w.gebruikRijen.push(r);
      else w.schrijfpogingen.push({ tabel, soort: 'insert', r });

      return Promise.resolve({ data: null, error: null });
    },
    update(r) { w.schrijfpogingen.push({ tabel, soort: 'update', r }); return b; },
    upsert(r) { w.schrijfpogingen.push({ tabel, soort: 'upsert', r }); return b; },
    delete() { w.schrijfpogingen.push({ tabel, soort: 'delete' }); return b; },
    then(res, rej) { w.tabellen.push(tabel); return Promise.resolve({ data: [], error: null }).then(res, rej); },
  };
  return b;
};

export const rpc = async (naam, args) => {
  w.rpcs.push(naam);
  if (naam === 'kompas_check_rate_limit') return { data: true, error: null };
  if (naam === 'kompas_subsidieregelingen_voor_tier') return { data: w.regelingen, error: null };
  if (naam === 'kompas_funders_voor_matching') return { data: w.funders, error: null };
  if (naam === 'kompas_exclusieve_funders') return { data: w.exclusief, error: null };
  if (naam === 'kompas_dekkingsplan') return w.dekkingsplanFout ? { data: null, error: { message: 'x' } } : { data: w.dekkingsplan, error: null };
  w.schrijfpogingen.push({ tabel: null, soort: 'rpc', naam, args });
  return { data: null, error: null };
};

export const admin = { auth: { getUser: async () => ({ data: { user: w.user } }) }, from: builder, rpc };
const gebruikersClient = { rpc };

globalThis.__createClient = (_url, _key, opties) => (opties?.global?.headers?.Authorization ? gebruikersClient : admin);
globalThis.Deno = {
  env: { get: (k) => w.env?.[k] },
  serve: (h) => { globalThis.__handler = h; },
  resolveDns: async (host, soort) => { w.dnsOpgevraagd.push(host); return soort === 'A' ? w.dns[host] ?? [] : []; },
};
globalThis.fetch = async (url) => {
  w.fetches.push(String(url));
  const tekst = w.paginas[String(url)];

  if (tekst === undefined) return new Response('niet gevonden', { status: 404, headers: { 'content-type': 'text/plain' } });

  return new Response(tekst, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
};


export const PAGINA = PAGINA_A;
