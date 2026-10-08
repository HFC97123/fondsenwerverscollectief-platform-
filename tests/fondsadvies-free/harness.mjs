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

const fakeAdmin = {
  auth: { getUser: async () => ({ data: { user: world.user || null } }) },
  from: (t) => maakBuilder(t),
  rpc: async (naam, args) => {
    world.rpcLog.push({ naam, args });
    if (naam === 'kompas_check_rate_limit') return { data: true, error: null };
    if (naam === 'kompas_subsidieregelingen_voor_tier') return { data: world.regelingen, error: null };
    if (naam === 'kompas_funder_deadlines_voor_tier') return { data: world.deadlines, error: null };
    if (naam === 'kompas_funders_voor_tier') return { data: world.funders, error: null };
    if (naam === 'kompas_funders_voor_matching') return { data: world.fundersVolledig || world.funders, error: null };
    return { data: null, error: null };
  },
};

globalThis.__createClient = () => fakeAdmin;

const envWaarden = { OPENAI_API_KEY: 'sk-test', SUPABASE_URL: 'http://db.test', SUPABASE_SERVICE_ROLE_KEY: 'srv' };
globalThis.Deno = {
  env: { get: (k) => envWaarden[k] },
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
    world.openAi.push({ soort: 'responses', body });
    const modelTekst = world.modelTekst || 'MODELANTWOORD';
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
  const exports = /function selecteerFreeFondsadvies/.test(code)
    ? '\nexport { selecteerFreeFondsadvies, beoordeelKandidaat, isFondsadviesVraag, leesFondsCriteria, criteriaVoldoende, bouwFreeAdviesBlok };\n'
    : '\n';
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
  const res = await handler(new Request('http://x/functions/v1/subsidie-kompas', { method: 'POST', headers, body: JSON.stringify({ messages, kompasMode, stream }) }));
  const json = await res.json();
  const hoofd = world.openAi.filter((c) => c.soort === 'responses');
  return { status: res.status, json, hoofd: hoofd[hoofd.length - 1]?.body, extracties: world.openAi.filter((c) => c.soort === 'chat') };
}

export const TAXONOMIE = {
  themas: ['Armoedebestrijding', 'Armoede/zelfredzaamheid', 'Zelfredzaamheid', 'Participatie & inclusie', 'Sociaal-maatschappelijk', 'Maatschappij', 'Cultuur', 'Kunst', 'Film', 'Muziek', 'Theater en podiumkunsten', 'Literatuur', 'Letterkunde', 'Beeldende kunst', 'Dans', 'Talentontwikkeling', 'Natuur', 'Natuur en milieu', 'Duurzaamheid', 'Ouderen', 'Eenzaamheid', 'Welzijn', 'Dieren', 'Dierenwelzijn', 'Sport', 'Jeugd en kinderen', 'Educatie'],
  doelgroepen: ['Mensen in armoede', 'Mensen in een kwetsbare positie', 'Ouderen', 'Jongeren', 'Dieren', 'Vrouwen en meisjes'],
  regios: ['Amsterdam', 'Den Haag', 'Rotterdam', 'Leiden', 'Utrecht', 'Noord-Holland', 'Zuid-Holland', 'Friesland', 'Landelijk', 'Provinciaal', 'Regionaal', 'Wereld / internationaal', 'Europa'],
};

let teller = 0;
export function reg({ naam, tier, themas = [], doelgroepen = [], regios = ['Landelijk'], status = 'Open', deadline = '2026-12-01', funder, min = null, max = null }) {
  teller += 1;
  return {
    regeling_id: `reg-${teller}`, naam, status, deadline_datum: deadline, deadline_omschrijving: null, bedrag_min: min, bedrag_max: max,
    bandbreedte_bijdrage_naam: null, aanvraagcriteria: `Voorwaarden van ${naam}`, beoordelingscriteria: null, type_projecten: null, begrotingseisen: null,
    eigen_bijdrage: null, cofinanciering: null, behandeltermijn: null, aanvraagprocedure: null, aanvraaglink: `https://voorbeeld.test/${teller}`,
    access_tier: tier, type_gever: 'Fonds', funder_naam: funder || `Funder ${naam}`, funder_website: null, funder_missie: `Missie ${naam}`, funder_aanvraagcriteria: null,
    themas_namen: themas, doelgroepen_namen: doelgroepen, werkgebieden_namen: regios, rondes_aantal: 0, sluitingstijd: null, beoordelingsdatum: null, beoordelingsperiode_ronde: null,
  };
}

export function funder({ naam, tier, themas = [], doelgroepen = [], regios = ['Landelijk'] }) {
  teller += 1;
  return {
    funder_id: `fun-${teller}`, funder_naam: naam, funder_type: 'Vermogensfonds', access_tier: tier, themas_namen: themas, doelgroepen_namen: doelgroepen,
    werkgebieden_namen: regios, bandbreedte_bijdrage_naam: null, bijdrage_min: null, bijdrage_max: null, missie: `Missie ${naam}`, aanvraagcriteria: null, funder_website: `https://fonds.test/${teller}`,
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
