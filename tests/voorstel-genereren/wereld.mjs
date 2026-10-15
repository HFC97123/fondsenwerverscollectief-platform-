// Nagebootste wereld voor de tests van 'voorstel-genereren' en 'voorstel-aanvullen': bouwt voort op de wereld van de preview-tests
// (database, DNS, Deno) en voegt de taxonomie, de funder-deadline-RPC en een nagebootste OpenAI-webverkenner toe.
import { UID, PID, w, reset as basisReset, rpc as basisRpc, admin as basisAdmin } from '../voorstel-preview/wereld.mjs';

export { UID, PID, w };

export const TAXONOMIE = {
  themas: ['Muziek', 'Cultuur', 'Jeugd en kinderen', 'Natuur', 'Sport'],
  doelgroepen: ['Jongeren', 'Ouderen'],
  regios: ['Rotterdam', 'Amsterdam', 'Zuid-Holland', 'Landelijk'],
};

let teller = 0;
const uuid = () => {
  teller += 1;

  return `00000000-0000-4000-8000-${String(teller).padStart(12, '0')}`;
};

export function regeling({ naam, tier = 'free', gever, themas = ['Muziek', 'Cultuur'], doelgroepen = ['Jongeren'], regios = ['Rotterdam'], min = 5000, max = 40000, deadline = '2026-12-15', id, funderId, cofinanciering = null }) {
  return {
    regeling_id: id ?? uuid(), naam, status: 'Open', deadline_datum: deadline, deadline_omschrijving: null, bedrag_min: min, bedrag_max: max, bandbreedte_bijdrage_naam: null,
    aanvraagcriteria: `Voorwaarden van ${naam}`, beoordelingscriteria: null, type_projecten: null, begrotingseisen: null, eigen_bijdrage: null, cofinanciering, behandeltermijn: null,
    aanvraagprocedure: null, aanvraaglink: `https://www.${naam.toLowerCase().replace(/[^a-z]+/g, '')}.example.nl/aanvragen`, access_tier: tier, type_gever: 'Fonds',
    funder_id: funderId ?? uuid(), funder_naam: gever ?? `Gever van ${naam}`, funder_website: `https://www.${naam.toLowerCase().replace(/[^a-z]+/g, '')}.example.nl/`, funder_missie: `Missie ${naam}`,
    funder_aanvraagcriteria: null, themas_namen: themas, doelgroepen_namen: doelgroepen, werkgebieden_namen: regios, rondes_aantal: 0, sluitingstijd: null,
  };
}

export function fonds({ naam, tier = 'free', themas = ['Muziek', 'Cultuur'], doelgroepen = ['Jongeren'], regios = ['Rotterdam'], min = 2000, max = 20000, id }) {
  return {
    funder_id: id ?? uuid(), funder_naam: naam, funder_type: 'Vermogensfonds', access_tier: tier, themas_namen: themas, doelgroepen_namen: doelgroepen, werkgebieden_namen: regios,
    bandbreedte_bijdrage_naam: null, bijdrage_min: min, bijdrage_max: max, missie: `Missie ${naam}`, aanvraagcriteria: null, funder_website: `https://www.${naam.toLowerCase().replace(/[^a-z]+/g, '')}.example.nl/`,
  };
}

export const projectRij = (extra = {}) => ({
  id: PID, user_id: UID, name: 'Rotterdam Beats', description: 'Een muziekproject voor jongeren in Rotterdam.', goals: 'Talentontwikkeling', activities: 'Workshops en optredens',
  location: 'Rotterdam', target_groups: 'Jongeren', themes: 'Muziek, Cultuur', period_start: '2026-11-01', period_end: '2027-06-30', budget_total: 100000, own_contribution: 20000, archived_at: null, ...extra,
});

export function resetGenereren(extra = {}) {
  basisReset({
    env: { OPENAI_API_KEY: 'sk-test', SUPABASE_URL: 'http://db.test', SUPABASE_SERVICE_ROLE_KEY: 'srv', SUPABASE_ANON_KEY: 'anon', VOORSTEL_PREVIEW: 'aan', VOORSTEL_GENEREREN: 'aan' },
    profile: { subscription_tier: 'pro', subscription_active: true, trial_ends_at: null, role: 'user' },
    project: projectRij(),
    regelingen: [],
    funders: [],
    deadlines: [],
    exclusief: [],
    online: [],
    onlineStatus: 'completed',
    openaiBodies: [],
    openaiAantal: 0,
    ...extra,
  });
}

const taxonomieRijen = { themas: TAXONOMIE.themas, doelgroepen: TAXONOMIE.doelgroepen, regios: TAXONOMIE.regios };

const from = (tabel) => {
  if (taxonomieRijen[tabel]) {
    const b = { select() { return b; }, then(res, rej) { w.tabellen.push(tabel); return Promise.resolve({ data: taxonomieRijen[tabel].map((naam) => ({ naam })), error: null }).then(res, rej); } };

    return b;
  }

  return basisAdmin.from(tabel);
};

const rpc = async (naam, args) => {
  if (naam === 'kompas_exclusieve_funders' && w.exclusiefFout) {
    w.rpcs.push(naam);

    return { data: null, error: { code: 'XX000', message: 'kapot' } };
  }

  if (naam === 'kompas_funder_deadlines_voor_tier') {
    w.rpcs.push(naam);

    return { data: w.deadlines, error: null };
  }

  return basisRpc(naam, args);
};

const admin = { auth: basisAdmin.auth, from, rpc };
const gebruikersClient = { rpc };

globalThis.__createClient = (_url, _key, opties) => (opties?.global?.headers?.Authorization ? gebruikersClient : admin);

const basisFetch = globalThis.fetch;

globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://api.openai.com/v1/responses')) {
    w.openaiAantal += 1;
    w.openaiBodies.push(JSON.parse(init.body));

    if (w.onlineStatus === 'fout') return new Response('boem', { status: 500 });

    const body = { status: 'completed', output: [{ type: 'web_search_call' }, { type: 'web_search_call' }, { type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ kandidaten: w.online }) }] }], usage: { input_tokens: 4000, output_tokens: 900 } };

    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  }

  return basisFetch(url, init);
};

export const online = (o) => ({ regeling: null, gever: 'Onbekend Online Fonds', website: 'https://www.onlinefonds.example.nl/', url: 'https://www.onlinefonds.example.nl/aanvragen', status: 'open', deadline: '2027-01-15', bedragMin: 5000, bedragMax: 30000, themas: ['Muziek', 'Cultuur'], doelgroepen: ['Jongeren'], werkgebieden: ['Rotterdam'], samenvatting: 'Steunt muziekprojecten voor jongeren in Rotterdam.', ...o });
