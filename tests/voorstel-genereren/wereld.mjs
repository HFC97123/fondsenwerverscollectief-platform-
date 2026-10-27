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

export function regeling({ naam, tier = 'free', gever, themas = ['Muziek', 'Cultuur'], doelgroepen = ['Jongeren'], regios = ['Rotterdam'], min = 5000, max = 40000, deadline = '2026-12-15', id, funderId, cofinanciering = null, extra = {} }) {
  return {
    regeling_id: id ?? uuid(), naam, status: 'Open', deadline_datum: deadline, deadline_omschrijving: null, bedrag_min: min, bedrag_max: max, bandbreedte_bijdrage_naam: null,
    aanvraagcriteria: `Voorwaarden van ${naam}`, beoordelingscriteria: null, type_projecten: null, begrotingseisen: null, eigen_bijdrage: null, cofinanciering, behandeltermijn: null,
    aanvraagprocedure: null, aanvraaglink: `https://www.${naam.toLowerCase().replace(/[^a-z]+/g, '')}.example.nl/aanvragen`, access_tier: tier, type_gever: 'Fonds',
    funder_id: funderId ?? uuid(), funder_naam: gever ?? `Gever van ${naam}`, funder_website: `https://www.${naam.toLowerCase().replace(/[^a-z]+/g, '')}.example.nl/`, funder_missie: `Missie ${naam}`,
    funder_aanvraagcriteria: null, themas_namen: themas, doelgroepen_namen: doelgroepen, werkgebieden_namen: regios, rondes_aantal: 0, sluitingstijd: null,
    beoordelingsdatum: null, beoordelingsperiode_ronde: null,
    ...extra,
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
    chatBodies: [], // aanroepen van chat/completions (zoekprofiel-extractie)
    zoekprofielAi: null, // object = JSON-antwoord van het model | 'fout' = HTTP 500 | 'rommel' = onleesbaar antwoord
    db: { funding: [], actions: [] },
    dbActief: false,
    dbFout: null,
    dbSchrijfLog: [],
    bron: [],
    bronFout: null,
    bronSchrijfLog: [],
    gebruikFout: null, // 'tabel-weg' (kompas_gebruik_log bestaat niet: PGRST205) | 'gooit' | 'hangt'
    migratieD: true, // planningskolommen op taken en wachtrij (datum_herkomst e.d.) + trigger planning_handmatig
    migratieC: true, // kolom voorstel_sleutel + unieke index (program_id, voorstel_sleutel) + wachtrijtabel aanwezig
    wachtrij: [],
    wachtrijFout: null, // 'schrijven' | 'tabel-weg'
    wachtrijLog: [],
    planning: { regelingen: [], rondes: [], funders: [] }, // aanvullende planningstabellen (vergaderdata, rondes) voor verrijkPlanning
    planningFout: null, // true: lezen van die tabellen mislukt
    leesVertraging: false, // true: elke leesactie op taken wacht een macrotaak, zodat gelijktijdige verzoeken allebei lezen vóór er iemand schrijft
    documenten: [],
    ...extra,
  });
}

const taxonomieRijen = { themas: TAXONOMIE.themas, doelgroepen: TAXONOMIE.doelgroepen, regios: TAXONOMIE.regios };

const from = (tabel) => {
  if (taxonomieRijen[tabel]) {
    const b = { select() { return b; }, then(res, rej) { w.tabellen.push(tabel); return Promise.resolve({ data: taxonomieRijen[tabel].map((naam) => ({ naam })), error: null }).then(res, rej); } };

    return b;
  }

  if (tabel === 'subsidieregelingen' || tabel === 'subsidieregeling_rondes' || tabel === 'funders') {
    const f = { in: {}, gte: {}, notnull: [] };
    const b = {
      select() { return b; },
      in(k, v) { f.in[k] = v; return b; },
      gte(k, v) { f.gte[k] = v; return b; },
      not(k, op, v) { if (op === 'is' && v === null) f.notnull.push(k); return b; },
      order() { return b; },
      then(ok, nok) {
        w.tabellen.push(tabel);
        if (w.planningFout) return Promise.resolve({ data: null, error: { code: 'XX000', message: 'boem' } }).then(ok, nok);
        const bron = tabel === 'subsidieregelingen' ? w.planning.regelingen : tabel === 'funders' ? w.planning.funders : w.planning.rondes;
        const rijen = bron.filter((x) => Object.entries(f.in).every(([k, v]) => v.includes(x[k]))).filter((x) => Object.entries(f.gte).every(([k, v]) => String(x[k]) >= v)).filter((x) => f.notnull.every((k) => x[k] != null));
        return Promise.resolve({ data: rijen, error: null }).then(ok, nok);
      },
    };
    return b;
  }

  if (tabel === 'subsidie_kompas_bron_controles') return bronFrom();
  if (tabel === 'subsidie_kompas_actieplan_open') return wachtrijFrom();
  if (tabel === 'kompas_gebruik_log') {
    return {
      // Tellen voor de daglimiet (select met count): filtert op eq-velden; het datumfilter (gte) is in de test niet nodig, alle rijen zijn van vandaag.
      select() {
        const f = {};
        const t = { eq(k, v) { f[k] = v; return t; }, gte() { return t; }, then(ok, nok) { if (w.gebruikFout === 'tabel-weg') return Promise.resolve({ count: null, error: { code: 'PGRST205' } }).then(ok, nok); return Promise.resolve({ count: w.gebruikRijen.filter((r) => Object.entries(f).every(([k, v]) => r[k] === v)).length, error: null }).then(ok, nok); } };

        return t;
      },
      insert(rij) {
        if (w.gebruikFout === 'gooit') throw new Error('boem');
        if (w.gebruikFout === 'hangt') return new Promise(() => {});
        if (w.gebruikFout === 'tabel-weg') return Promise.resolve({ error: { code: 'PGRST205', message: "Could not find the table 'public.kompas_gebruik_log' in the schema cache" } });

        w.gebruikRijen.push(rij);

        return Promise.resolve({ error: null });
      },
    };
  }

  if (tabel === 'subsidie_kompas_knowledge_items') {
    const f = {};
    const d = { select() { return d; }, eq(k, v) { f[k] = v; return d; }, is() { return d; }, order() { return d; }, limit() { return d; }, then(ok, nok) { w.tabellen.push(tabel); return Promise.resolve({ data: (w.documenten || []).filter((x) => !f.program_id || x.program_id === f.program_id), error: null }).then(ok, nok); } };

    return d;
  }

  return basisAdmin.from(tabel);
};

// In-memory tabel subsidie_kompas_bron_controles voor de ADMIN-client (de server schrijft; het lid leest via RLS). Unieke sleutel zoals in de migratie.
// w.bron = rijen; w.bronFout = 'tabel-weg' (migratie niet toegepast: elke aanroep geeft 42P01) | 'schrijven' (alleen schrijven mislukt); w.bronSchrijfLog.
function bronFrom() {
  const filters = {};
  let op = 'select';
  let lading = null;
  const b = {
    select() { return b; },
    eq(k, v) { filters[k] = v; return b; },
    limit() { return b; },
    upsert(rij) { op = 'upsert'; lading = rij; return b; },
    update(rij) { op = 'update'; lading = rij; return b; },
    then(ok, nok) {
      if (w.bronFout === 'tabel-weg') return Promise.resolve({ data: null, error: { code: '42P01', message: 'relation does not exist' } }).then(ok, nok);

      if (op === 'select') return Promise.resolve({ data: w.bron.filter((r) => Object.entries(filters).every(([k, v]) => r[k] === v)).map((r) => ({ ...r })), error: null }).then(ok, nok);

      w.bronSchrijfLog.push({ op, lading });

      if (w.bronFout === 'schrijven') return Promise.resolve({ error: { code: 'XX000' } }).then(ok, nok);

      if (op === 'upsert') {
        const i = w.bron.findIndex((r) => r.program_id === lading.program_id && r.record_type === lading.record_type && r.record_id === lading.record_id);

        if (i >= 0) w.bron[i] = { ...w.bron[i], ...lading };
        else w.bron.push({ ...lading });
      } else {
        w.bron.filter((r) => Object.entries(filters).every(([k, v]) => r[k] === v)).forEach((r) => Object.assign(r, lading));
      }

      return Promise.resolve({ error: null }).then(ok, nok);
    },
  };

  return b;
}


// In-memory wachtrij subsidie_kompas_actieplan_open voor de ADMIN-client. Unieke sleutel (program_id, sleutel) zoals in migratie C.
function wachtrijFrom() {
  const filters = {};
  let inSleutels = null;
  let op = 'select';
  let lading = null;
  const b = {
    select() { return b; },
    eq(k, v) { filters[k] = v; return b; },
    in(k, v) { inSleutels = { k, v }; return b; },
    limit() { return b; },
    upsert(rijen) { op = 'upsert'; lading = Array.isArray(rijen) ? rijen : [rijen]; return b; },
    delete() { op = 'delete'; return b; },
    then(ok, nok) {
      if (!w.migratieC || w.wachtrijFout === 'tabel-weg') return Promise.resolve({ data: null, error: { code: '42P01', message: 'relation does not exist' } }).then(ok, nok);

      const past = (r) => Object.entries(filters).every(([k, v]) => r[k] === v) && (!inSleutels || inSleutels.v.includes(r[inSleutels.k]));

      if (op === 'select') return Promise.resolve({ data: w.wachtrij.filter(past).map((r) => ({ ...r })), error: null }).then(ok, nok);

      w.wachtrijLog.push({ op, lading, filters: { ...filters } });

      if (w.wachtrijFout === 'schrijven') return Promise.resolve({ error: { code: 'XX000' } }).then(ok, nok);

      if (op === 'upsert') {
        if (!w.migratieD && lading.some((r) => 'datum_herkomst' in r)) return Promise.resolve({ error: { code: 'PGRST204', message: "Could not find the 'datum_herkomst' column" } }).then(ok, nok);

        for (const r of lading) {
          const i = w.wachtrij.findIndex((x) => x.program_id === r.program_id && x.sleutel === r.sleutel);

          if (i >= 0) w.wachtrij[i] = { ...w.wachtrij[i], ...r };
          else w.wachtrij.push({ ...r });
        }
      } else {
        w.wachtrij = w.wachtrij.filter((r) => !past(r));
      }

      return Promise.resolve({ error: null }).then(ok, nok);
    },
  };

  return b;
}

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

// In-memory database voor het OPSLAAN (alleen via de gebruikersclient, met de JWT van het lid): twee tabellen met de unieke regels van de echte database.
// w.db = { funding: [], actions: [] }; w.dbFout = { funding?: {code}, actions?: {code}, actionsLezen?: true } om fouten te simuleren;
// w.dbSchrijfLog = elke schrijfpoging { tabel, rij(en) }.

const PLANNING_KOLOMMEN = ['planning_fase', 'datum_herkomst', 'datum_bron', 'datum_controle'];
const heeftPlanning = (r) => PLANNING_KOLOMMEN.some((k) => k in r);

// Wat een LID zelf doet met een taak (zoals de browser): met migratie D zet de trigger planning_handmatig; zonder D alleen updated_at.
// w.gebruikerWijzigt(id, { due_date: '2027-01-05' })
export function gebruikerWijzigt(id, patch) {
  const a = w.db.actions.find((x) => x.id === id);

  if (!a) throw new Error(`taak ${id} bestaat niet`);

  const stuurt = 'planning_versie' in patch;

  if (w.migratieD && !stuurt && ('due_date' in patch || 'title' in patch || 'notes' in patch)) {
    a.planning_handmatig = true;
    if ('due_date' in patch && patch.due_date !== a.due_date) a.datum_herkomst = 'handmatig';
  }

  Object.assign(a, patch);
  a.updated_at = new Date(Date.parse(a.proposed_at || new Date().toISOString()) + 60000).toISOString();
}

function gebruikersFrom(tabel) {
  const filters = {};
  let kolommen = null;
  let patch = null;
  const b = {
    select(k) { kolommen = k ?? null; return b; },
    eq(k, v) { filters[k] = v; return b; },
    limit() { return b; },
    update(p) { patch = p; return b; },
    upsert(rij, opties = {}) {
      const rijen = Array.isArray(rij) ? rij : [rij];

      w.dbSchrijfLog.push({ tabel, rijen, upsert: true });

      const fout = w.dbFout?.actions;
      const gemaakt = [];
      let error = null;

      if (fout) error = fout;
      else if (tabel !== 'subsidie_kompas_program_actions') error = { code: 'XX000' };
      else if (!w.migratieC) error = { code: 'PGRST204', message: "Could not find the 'voorstel_sleutel' column" };
      else if (!w.migratieD && rijen.some(heeftPlanning)) error = { code: 'PGRST204', message: "Could not find the 'datum_herkomst' column" };
      else if (rijen.some((r) => !r.user_id || r.user_id !== w.user?.id)) error = { code: '42501', message: 'rls' };
      else {
        // Eén statement: ON CONFLICT (program_id, voorstel_sleutel) DO NOTHING. Sleutels die al bestaan (ook van een gelijktijdig verzoek) worden overgeslagen.
        for (const r of rijen) {
          const dubbel = w.db.actions.some((a) => a.program_id === r.program_id && a.voorstel_sleutel && a.voorstel_sleutel === r.voorstel_sleutel);

          if (dubbel) {
            if (opties.ignoreDuplicates !== true) { error = { code: '23505', message: 'dubbel' }; break; }
            continue;
          }

          const nieuwRij = { id: `a0000000-0000-4000-8000-${String(w.db.actions.length + 1).padStart(12, '0')}`, ...r };

          w.db.actions.push(nieuwRij);
          gemaakt.push({ voorstel_sleutel: r.voorstel_sleutel });
        }
      }

      const res = { data: error ? null : gemaakt, error };

      return { select() { return Promise.resolve(res); } };
    },
    insert(rij) {
      const rijen = Array.isArray(rij) ? rij : [rij];

      w.dbSchrijfLog.push({ tabel, rijen });

      const fout = w.dbFout?.[tabel === 'subsidie_kompas_program_funding' ? 'funding' : 'actions'];
      const probeer = () => {
        if (fout) return { error: fout, data: null };

        for (const r of rijen) {
          if (!r.user_id || r.user_id !== w.user?.id) return { error: { code: '42501', message: 'rls' }, data: null };
          if (tabel === 'subsidie_kompas_program_actions' && 'voorstel_sleutel' in r && !w.migratieC) return { error: { code: 'PGRST204', message: 'kolom bestaat niet' }, data: null };
          if (tabel === 'subsidie_kompas_program_actions' && heeftPlanning(r) && !w.migratieD) return { error: { code: 'PGRST204', message: 'kolom bestaat niet' }, data: null };
          if (tabel === 'subsidie_kompas_program_actions' && r.voorstel_sleutel && w.db.actions.some((a) => a.program_id === r.program_id && a.voorstel_sleutel === r.voorstel_sleutel)) return { error: { code: '23505', message: 'dubbel' }, data: null };

          if (tabel === 'subsidie_kompas_program_funding') {
            const dubbel = w.db.funding.some((f) => f.program_id === r.program_id && ((r.scheme_id && f.scheme_id === r.scheme_id) || (r.funder_id && f.funder_id === r.funder_id) || (r.financier_naam && f.financier_naam && f.financier_naam.toLowerCase() === r.financier_naam.toLowerCase())));

            if (dubbel) return { error: { code: '23505', message: 'dubbel' }, data: null };
          }
        }

        const nieuw = rijen.map((r) => ({ id: `${tabel === 'subsidie_kompas_program_funding' ? 'f' : 'a'}0000000-0000-4000-8000-${String(w.db[tabel === 'subsidie_kompas_program_funding' ? 'funding' : 'actions'].length + 1).padStart(12, '0')}`, ...r }));

        w.db[tabel === 'subsidie_kompas_program_funding' ? 'funding' : 'actions'].push(...nieuw);

        return { error: null, data: nieuw[0] };
      };
      const res = probeer();

      return { select() { return { single: async () => res }; }, then(ok, nok) { return Promise.resolve({ error: res.error }).then(ok, nok); } };
    },
    then(ok, nok) {
      if (patch && tabel === 'subsidie_kompas_program_actions') {
        w.dbSchrijfLog.push({ tabel, update: patch, filters: { ...filters } });

        if (w.dbFout?.update) return Promise.resolve({ error: w.dbFout.update }).then(ok, nok);
        if (!w.migratieD && Object.keys(patch).some((k) => PLANNING_KOLOMMEN.includes(k) || k === 'planning_versie')) return Promise.resolve({ error: { code: 'PGRST204', message: 'kolom bestaat niet' } }).then(ok, nok);

        const rij = w.db.actions.find((a) => a.id === filters.id && a.program_id === filters.program_id);

        if (!rij) return Promise.resolve({ error: null }).then(ok, nok);

        // Server-update: planning_versie gaat omhoog, dus de trigger zet planning_handmatig niet.
        Object.assign(rij, patch);

        return Promise.resolve({ error: null }).then(ok, nok);
      }

      if (tabel === 'subsidie_kompas_program_actions') {
        if (w.dbFout?.actionsLezen) return Promise.resolve({ data: null, error: { code: 'XX000' } }).then(ok, nok);

        const lees = () => ({ data: w.db.actions.filter((a) => a.program_id === filters.program_id).map((a) => (kolommen === '*' ? { ...a } : { title: a.title, funding_id: a.funding_id })), error: null });

        // Het antwoord is een momentopname: een gelijktijdig verzoek ziet de taken van de ander pas als die al zijn geschreven.
        if (w.leesVertraging) { const stand = lees(); return new Promise((r) => setTimeout(r, 5)).then(() => stand).then(ok, nok); }

        return Promise.resolve(lees()).then(ok, nok);
      }

      return Promise.resolve({ data: [], error: null }).then(ok, nok);
    },
  };

  return b;
}

const dekkingsplanUitDb = () =>
  w.db.funding.map((f) => ({
    id: f.id, bron_status: 'zichtbaar', bron_type: f.scheme_id ? 'regeling' : f.funder_id ? 'fonds' : null, scheme_id: f.scheme_id ?? null, funder_id: f.funder_id ?? null,
    bron_naam: f.financier_naam ?? w.naamVanBron?.[f.scheme_id || f.funder_id] ?? 'Bron', funder_naam: f.financier_naam ?? '', status: f.status, requested_amount: f.requested_amount ?? null, awarded_amount: null, eigen_deadline: null, effectieve_deadline: null,
  }));

const rpcMetDb = async (naam, args) => {
  if (naam === 'kompas_dekkingsplan' && w.dbActief) {
    w.rpcs.push(naam);

    return { data: dekkingsplanUitDb(), error: null };
  }

  return rpc(naam, args);
};

const admin = { auth: basisAdmin.auth, from, rpc };
const gebruikersClient = { rpc: rpcMetDb, from: gebruikersFrom };

globalThis.__createClient = (_url, _key, opties) => (opties?.global?.headers?.Authorization ? gebruikersClient : admin);

const basisFetch = globalThis.fetch;

globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://api.openai.com/v1/chat/completions')) {
    w.chatBodies.push(JSON.parse(init.body));

    if (w.zoekprofielAi === 'fout' || w.zoekprofielAi == null) return new Response('boem', { status: 500 });

    const inhoud = w.zoekprofielAi === 'rommel' ? 'dit is geen json' : JSON.stringify(w.zoekprofielAi);

    return new Response(JSON.stringify({ choices: [{ message: { content: inhoud } }], usage: { prompt_tokens: 1200, completion_tokens: 200 } }), { status: 200, headers: { 'content-type': 'application/json' } });
  }

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
