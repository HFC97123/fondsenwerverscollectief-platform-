// Testharnas voor subsidie-kompas/index.ts (Deno-edge-function) onder Node.
// Draait de ECHTE handler (Deno.serve) van zowel de originele als de gewijzigde
// versie met een nagebootste database (admin-client) en nagebootste OpenAI.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const require = createRequire(import.meta.url);
// esbuild komt mee met vite (devDependency van het project).
const esbuild = require('esbuild');

export const FUNCTIE_PAD = path.join(repoRoot, 'supabase/functions/subsidie-kompas/index.ts');
// Commit direct VOOR de matchingfix (Fase 2E-afronding): de originele,
// foutieve versie dient als vergelijkingsbasis (root-cause-bewijs en
// byte-identiteit voor Pro/Premium/Admin).
export const BASISLIJN_COMMIT = '2e0447c';

export function leesBasislijn() {
  // Voor omgevingen zonder git-historie: BASISLIJN_BRON wijst naar een bestand met de oude versie.
  if (process.env.BASISLIJN_BRON) return fs.readFileSync(process.env.BASISLIJN_BRON, 'utf8');

  return execFileSync('git', ['show', `${BASISLIJN_COMMIT}:supabase/functions/subsidie-kompas/index.ts`], { cwd: repoRoot, maxBuffer: 20 * 1024 * 1024 }).toString('utf8');
}

export const world = {};

function maakBuilder(tabel) {
  const state = { tabel, filters: {} };
  const resultaat = () => {
    const w = world;
    if (tabel === 'ai_prompts') return { data: w.prompts, error: null };
    if (tabel === 'profiles') return { data: w.profile, error: w.profile ? null : { code: 'PGRST116' } };
    if (tabel === 'themas') return w.taxonomie ? { data: w.taxonomie.themas.map((naam) => ({ naam })), error: null } : { data: null, error: { message: 'x' } };
    if (tabel === 'doelgroepen') return { data: (w.taxonomie?.doelgroepen || []).map((naam) => ({ naam })), error: null };
    if (tabel === 'regios') return { data: (w.taxonomie?.regios || []).map((naam) => ({ naam })), error: null };
    return { data: [], error: null };
  };
  const b = {
    select() { return b; },
    in() { return b; },
    eq() { return b; },
    order() { return b; },
    limit() { return b; },
    single() { return Promise.resolve(resultaat()); },
    maybeSingle() { return Promise.resolve(resultaat()); },
    insert(row) { world.inserts.push({ tabel, row }); return Promise.resolve({ data: null, error: null }); },
    update() { return b; },
    upsert() { return b; },
    then(res, rej) { return Promise.resolve(resultaat()).then(res, rej); },
  };
  return b;
}

// Oude suites (3-tier-model): een record met tier 'premium' stond toen gelijk aan "verborgen voor Free en
// Pro". Zij zetten dit aan zodat 'premium' in hun fixtures nu een EXPLICIET EXCLUSIEF fonds betekent.
// De nieuwe suite (entitlement.test.mjs) laat het uit: daar is Premium alleen een abonnements-/datatier.
export const instellingen = { premiumIsExclusief: false };

function schoon(rij) {
  const { __exclusief, ...rest } = rij;
  return rest;
}

function afgeleideExclusieven() {
  const uit = new Map();
  for (const lijst of [world.regelingen, world.deadlines, world.funders, world.fundersVolledig || []]) {
    for (const r of lijst || []) {
      if (!r.__exclusief) continue;
      const k = r.funder_id;
      const bestaand = uit.get(k) || { funder_id: k, naam: r.funder_naam, website: r.funder_website ?? null, aliassen: [], regeling_namen: [], regeling_links: [] };
      if (r.regeling_id && r.naam) bestaand.regeling_namen.push(r.naam);
      uit.set(k, bestaand);
    }
  }
  return [...uit.values()];
}

const fakeAdmin = {
  auth: { getUser: async () => ({ data: { user: world.user || null } }) },
  from: (t) => maakBuilder(t),
  rpc: async (naam, args) => {
    world.rpcLog.push({ naam, args });
    if (naam === 'kompas_check_rate_limit') return { data: true, error: null };
    if (naam === 'kompas_subsidieregelingen_voor_tier') return { data: world.regelingen.map(schoon), error: null };
    if (naam === 'kompas_funder_deadlines_voor_tier') return { data: world.deadlines.map(schoon), error: null };
    if (naam === 'kompas_funders_voor_tier') return { data: world.funders.map(schoon), error: null };
    if (naam === 'kompas_funders_voor_matching') return { data: (world.fundersVolledig || world.funders).map(schoon), error: null };
    if (naam === 'kompas_exclusieve_funders') {
      if (world.exclusiefFout === 'weg') return { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.kompas_exclusieve_funders without parameters in the schema cache' } };
      if (world.exclusiefFout) return { data: null, error: { code: '57014', message: 'statement timeout' } };
      return { data: [...afgeleideExclusieven(), ...(world.exclusief || [])], error: null };
    }
    return { data: null, error: null };
  },
};

globalThis.__createClient = () => fakeAdmin;

const envWaarden = { OPENAI_API_KEY: 'sk-test', SUPABASE_URL: 'http://db.test', SUPABASE_SERVICE_ROLE_KEY: 'srv' };
globalThis.Deno = {
  env: { get: (k) => (world.env && k in world.env ? world.env[k] : envWaarden[k]) },
  serve: (h) => { globalThis.__laatsteHandler = h; },
};

globalThis.fetch = async (url, init) => {
  const body = JSON.parse(init.body);
  if (String(url).includes('/chat/completions')) {
    world.openAi.push({ soort: 'chat', body });
    if (world.extractorFout) {
      if (world.extractorFout === 'http500') return new Response('boom', { status: 500 });
      throw new Error('netwerk');
    }
    const gebruikers = body.messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n');
    const uit = world.extractor ? world.extractor(gebruikers) : {};
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(uit) } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }), { status: 200 });
  }
  if (String(url).includes('/responses')) {
    // De online verkenner (scout) is een aparte Responses-aanroep met een eigen instructie.
    const eerste = body.input?.[0]?.content;
    if (typeof eerste === 'string' && eerste.startsWith('ONLINE-VERKENNER')) {
      world.openAi.push({ soort: 'scout', body });
      if (world.scoutFout) {
        if (world.scoutFout === 'http500') return new Response('boom', { status: 500 });
        throw new Error('netwerk');
      }
      const uit = typeof world.scout === 'function' ? world.scout(body) : world.scout ?? { kandidaten: [] };
      const tekst = typeof uit === 'string' ? uit : JSON.stringify(uit);
      return new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: tekst }] }], usage: { input_tokens: 5, output_tokens: 7 } }), { status: 200 });
    }
    world.openAi.push({ soort: 'responses', body });
    const modelTekst = typeof world.modelTekst === 'function' ? world.modelTekst(body) : world.modelTekst || 'MODELANTWOORD';
    const antwoordObj = { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: modelTekst }] }], usage: {} };
    if (body.stream === true) {
      const sse = `data: ${JSON.stringify({ type: 'response.output_text.delta', delta: modelTekst })}\n\n` + `data: ${JSON.stringify({ type: 'response.completed', response: antwoordObj })}\n\n`;
      return new Response(sse, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    }
    return new Response(JSON.stringify(antwoordObj), { status: 200 });
  }
  throw new Error('onverwachte fetch ' + url);
};

export async function laadModule(bron, tag) {
  let src = bron.includes('\n') ? bron : fs.readFileSync(bron, 'utf8');
  src = src.replace("import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';", 'const createClient = globalThis.__createClient;');
  const { code } = await esbuild.transform(src, { loader: 'ts', format: 'esm', target: 'es2022' });
  const uit = path.join(os.tmpdir(), `fondsadvies-test-${process.pid}`, `${tag}.mjs`);
  fs.mkdirSync(path.dirname(uit), { recursive: true });
  // Exporteer alleen wat in deze versie bestaat (de oude basislijn kent de nieuwe functies niet).
  const namen = ['applyEntitlementsAndSanitize', 'nieuweEntitlementCtx', 'parseVerkennerUitvoer', 'losWebKandidaatOp', 'bouwDbIndex', 'verwerkWebKandidaten', 'bouwVerborgenNaamLijst', 'verwijderVerborgenIdentiteiten', 'bouwSubsidieregelingTekst', 'bouwFunderAlgemeneTekst', 'bouwFunderDeadlineTekst', 'bouwExterneTekst', 'bouwVerkoopzin', 'selecteerFreeFondsadvies', 'beoordeelKandidaat', 'isFondsadviesVraag', 'leesFondsCriteria', 'criteriaVoldoende', 'bouwFreeAdviesBlok', 'beoordeelPool', 'pasRechtenToe', 'bepaalRechten', 'magZien', 'beoordeelGeografie', 'focusConflict', 'heeftFinancieringsIntentie', 'isZichtbaarVoorTier', 'bouwExclusiviteitIndex', 'exclusiviteitVan', 'bepaalNiveau', 'onderdrukExclusief', 'laadExclusiviteit', 'kenmerkenVan'];
  const aanwezig = namen.filter((n) => new RegExp(`function ${n}\\b`).test(code));
  const exports = aanwezig.length ? `\nexport { ${aanwezig.join(', ')} };\n` : '\n';
  fs.writeFileSync(uit, code + exports);
  const mod = await import(pathToFileURL(uit).href + '?t=' + Date.now());
  return { mod, handler: globalThis.__laatsteHandler };
}

export function resetWorld(opties = {}) {
  Object.keys(world).forEach((k) => delete world[k]);
  Object.assign(world, {
    user: null,
    profile: null,
    prompts: [{ key: 'kompas.system', prompt: 'KOMPAS SYSTEEMPROMPT (test)' }],
    taxonomie: TAXONOMIE,
    regelingen: [],
    deadlines: [],
    funders: [],
    exclusief: [],
    exclusiefFout: null,
    openAi: [],
    inserts: [],
    rpcLog: [],
    extractor: null,
    extractorFout: null,
    ...opties,
  });
}

export async function vraag(handler, { messages, kompasMode = 'fondsadvies', token = null, stream = false }) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const voor = world.inserts.length;
  // testLabel laat de server de interne aantallen (relevant/extra) in de testlog zetten; die lees ik hier
  // terug zodat de tests de interne telling kunnen controleren zonder dat die ooit in een prompt staat.
  const res = await handler(new Request('http://x/functions/v1/subsidie-kompas', { method: 'POST', headers, body: JSON.stringify({ messages, kompasMode, stream, testLabel: 'harnas' }) }));
  const json = await res.json();
  const hoofd = world.openAi.filter((c) => c.soort === 'responses');
  const logs = world.inserts.slice(voor).filter((i) => i.tabel === 'kompas_matching_testlog');
  const tel = logs.length ? logs[logs.length - 1].row.aantallen : null;
  world.laatsteTel = tel;
  return { status: res.status, json, tel, hoofd: hoofd[hoofd.length - 1]?.body, scout: world.openAi.filter((c) => c.soort === 'scout').map((c) => c.body), alleHoofd: hoofd.map((c) => c.body), extracties: world.openAi.filter((c) => c.soort === 'chat') };
}

// Streaming-variant: geeft de ruwe SSE-gebeurtenissen terug (delta's en done).
export async function vraagStream(handler, { messages, kompasMode = 'fondsadvies', token = null }) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await handler(new Request('http://x/functions/v1/subsidie-kompas', { method: 'POST', headers, body: JSON.stringify({ messages, kompasMode, stream: true, testLabel: 'harnas' }) }));
  const tekst = await res.text();
  const events = tekst.split('\n').filter((r) => r.startsWith('data:')).map((r) => JSON.parse(r.slice(5)));
  return { status: res.status, events, deltas: events.filter((e) => e.delta).map((e) => e.delta).join(''), done: events.find((e) => e.done) };
}

export const TAXONOMIE = {
  themas: ['Armoedebestrijding', 'Armoede/zelfredzaamheid', 'Zelfredzaamheid', 'Participatie & inclusie', 'Sociaal-maatschappelijk', 'Maatschappij', 'Cultuur', 'Kunst', 'Film', 'Muziek', 'Theater en podiumkunsten', 'Literatuur', 'Letterkunde', 'Beeldende kunst', 'Dans', 'Talentontwikkeling', 'Natuur', 'Natuur en milieu', 'Duurzaamheid', 'Ouderen', 'Eenzaamheid', 'Welzijn', 'Dieren', 'Dierenwelzijn', 'Sport', 'Jeugd en kinderen', 'Educatie'],
  doelgroepen: ['Mensen in armoede', 'Mensen in een kwetsbare positie', 'Ouderen', 'Jongeren', 'Dieren', 'Vrouwen en meisjes'],
  regios: ['Amsterdam', 'Den Haag', 'Rotterdam', 'Leiden', 'Utrecht', 'Noord-Holland', 'Zuid-Holland', 'Friesland', 'Landelijk', 'Provinciaal', 'Regionaal', 'Wereld / internationaal', 'Europa'],
};

let teller = 0;
export function reg({ naam, tier, themas = [], doelgroepen = [], regios = ['Landelijk'], status = 'Open', deadline = '2026-12-01', funder, min = null, max = null, funderId, funderWebsite = null, funderMissie, exclusief }) {
  teller += 1;
  return {
    ...((exclusief ?? (instellingen.premiumIsExclusief && tier === 'premium')) ? { __exclusief: true } : {}),
    regeling_id: `reg-${teller}`, naam, status, deadline_datum: deadline, deadline_omschrijving: null, bedrag_min: min, bedrag_max: max,
    bandbreedte_bijdrage_naam: null, aanvraagcriteria: `Voorwaarden van ${naam}`, beoordelingscriteria: null, type_projecten: null, begrotingseisen: null,
    eigen_bijdrage: null, cofinanciering: null, behandeltermijn: null, aanvraagprocedure: null, aanvraaglink: `https://voorbeeld.test/${teller}`,
    access_tier: tier, type_gever: 'Fonds', funder_id: funderId ?? `fid-${teller}`, funder_naam: funder || `Funder ${naam}`, funder_website: funderWebsite, funder_missie: funderMissie ?? `Missie ${naam}`, funder_aanvraagcriteria: null,
    themas_namen: themas, doelgroepen_namen: doelgroepen, werkgebieden_namen: regios, rondes_aantal: 0, sluitingstijd: null, beoordelingsdatum: null, beoordelingsperiode_ronde: null,
  };
}

export function funder({ naam, tier, themas = [], doelgroepen = [], regios = ['Landelijk'], website, missie, id, exclusief }) {
  teller += 1;
  return {
    ...((exclusief ?? (instellingen.premiumIsExclusief && tier === 'premium')) ? { __exclusief: true } : {}),
    funder_id: id ?? `fun-${teller}`, funder_naam: naam, funder_type: 'Vermogensfonds', access_tier: tier, themas_namen: themas, doelgroepen_namen: doelgroepen,
    werkgebieden_namen: regios, bandbreedte_bijdrage_naam: null, bijdrage_min: null, bijdrage_max: null, missie: missie ?? `Missie ${naam}`, aanvraagcriteria: null, funder_website: website ?? `https://fonds.test/${teller}`,
  };
}

// Stand-in voor de OpenAI-extractie (de echte kan hier niet worden aangeroepen):
// deterministische trefwoordregels die het gedrag van een correct ingevulde
// extractie nabootsen, in de vorm die het prompt vraagt.
export function standInExtractor(tekst) {
  const t = tekst.toLowerCase();
  const uit = { themas: [], doelgroepen: [], regios: [], locatie: '', gevraagd_bedrag: null };
  if (/armoede|schulden|zelfredzaam|emancipatie/.test(t)) {
    uit.themas.push('Armoedebestrijding', 'Armoede/zelfredzaamheid', 'Zelfredzaamheid', 'Participatie & inclusie', 'Sociaal-maatschappelijk', 'Maatschappij');
    uit.doelgroepen.push('Mensen in armoede', 'Mensen in een kwetsbare positie');
  }
  if (/cultuur|kunst|theater/.test(t)) uit.themas.push('Cultuur', 'Kunst', 'Theater en podiumkunsten');
  if (/natuur|duurzaam/.test(t)) uit.themas.push('Natuur', 'Natuur en milieu', 'Duurzaamheid');
  if (/ouderen|eenzaam/.test(t)) { uit.themas.push('Ouderen', 'Eenzaamheid', 'Welzijn'); uit.doelgroepen.push('Ouderen'); }
  if (/dier/.test(t)) { uit.themas.push('Dieren', 'Dierenwelzijn'); uit.doelgroepen.push('Dieren'); }
  if (/amsterdam/.test(t)) { uit.regios.push('Amsterdam'); uit.locatie = 'Amsterdam'; }
  if (/rotterdam/.test(t)) { uit.regios.push('Rotterdam'); uit.locatie = 'Rotterdam'; }
  if (/friesland/.test(t)) { uit.regios.push('Friesland'); uit.locatie = 'Friesland'; }
  const m = t.match(/€\s?([\d.]+)/);
  if (m) uit.gevraagd_bedrag = Number(m[1].replace(/\./g, ''));
  return uit;
}

export function alleSysteemTeksten(body) {
  return (body?.input || []).filter((m) => m.role === 'developer').map((m) => m.content).join('\n=====\n');
}

// De prompt bevat bewust GEEN aantallen meer (ook geen extra_*_count). Tests die de interne telling
// willen controleren lezen die uit de testlog van de laatste vraag.
export function interneTelling(re) {
  const bron = re.source;
  const t = world.laatsteTel;
  if (!t) return null;
  if (bron.includes('extra_pro_count')) return t.extraPro;
  if (bron.includes('extra_premium_count')) return t.extraPremium;
  if (bron.includes('passende')) return t.relevant;
  return null;
}

// Rij zoals RPC kompas_exclusieve_funders() die teruggeeft (expliciet exclusief fonds).
export function exclusiefFonds({ id, naam, website = null, aliassen = [], regelingen = [], links = [] }) {
  return { funder_id: id, naam, website, aliassen, regeling_namen: regelingen, regeling_links: links };
}

// Bouwt de exclusiviteitsindex uit fixturerijen met __exclusief-markering (zoals de RPC-fake doet).
export function indexVan(M, ...lijsten) {
  const uit = new Map();
  for (const lijst of lijsten) {
    for (const r of lijst || []) {
      if (!r.__exclusief) continue;
      const k = r.funder_id;
      const b = uit.get(k) || { funder_id: k, naam: r.funder_naam, website: r.funder_website ?? null, aliassen: [], regeling_namen: [], regeling_links: [] };
      if (r.regeling_id && r.naam) b.regeling_namen.push(r.naam);
      uit.set(k, b);
    }
  }
  return M.bouwExclusiviteitIndex([...uit.values()]);
}
