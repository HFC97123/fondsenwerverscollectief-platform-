// Testharnas Fase 5: draait de ECHTE Deno.serve-handler van subsidie-kompas met
//  - de nagebootste OpenAI en rechtendatabase uit tests/fondsadvies-free/harness.mjs, en
//  - een kleine in-memory database voor projecten, gesprekken en Projectfinanciering,
//  - een nagebootste kompas_dekkingsplan() die ALLEEN werkt met de JWT van de gebruiker
//    (auth.uid()), net als de echte database-functie.
// Er is geen netwerk, geen echte Supabase en geen echte OpenAI.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as H from '../fondsadvies-free/harness.mjs';

export * from '../fondsadvies-free/harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, '../..');

// Basislijn = de Edge Function zoals die na Fase 4 was (commit 3635713).
export const FASE4_COMMIT = '3635713';
export const FASE4_SHA256 = '7d530d6897faccc8308331e7c26db0e5c11916102cfda80a29f2870ea9405650';

import { execFileSync } from 'node:child_process';

// Bron van de Edge Function zoals die na Fase 4 was. Zonder git (cloudomgeving): FASE4_BRON=<pad naar bestand>.
export function fase4Bron() {
  if (process.env.FASE4_BRON) return fs.readFileSync(process.env.FASE4_BRON, 'utf8');

  return execFileSync('git', ['show', `${FASE4_COMMIT}:supabase/functions/subsidie-kompas/index.ts`], { cwd: repoRoot, maxBuffer: 20 * 1024 * 1024 }).toString('utf8');
}

export const sha = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');

let uuidTeller = 0;
export function resetUuid() {
  uuidTeller = 0;
}

export function uuid() {
  uuidTeller += 1;
  const hex = uuidTeller.toString(16).padStart(12, '0');

  return `00000000-0000-4000-8000-${hex}`;
}

export const db = { subsidie_kompas_programs: [], subsidie_kompas_conversations: [], subsidie_kompas_program_funding: [], subsidie_kompas_knowledge_items: [] };
export const fouten = [];

const originalConsoleError = console.error;
console.error = (...a) => {
  fouten.push(a.map(String).join(' '));
};
export function herstelConsole() {
  console.error = originalConsoleError;
}

const origAdmin = globalThis.__createClient();

function tabelBuilder(naam) {
  const f = [];
  let beperk = null;
  const b = {
    select() { return b; },
    eq(k, v) { f.push((r) => r[k] === v); return b; },
    is(k, v) { f.push((r) => (v === null ? r[k] == null : r[k] === v)); return b; },
    in(k, vs) { f.push((r) => vs.includes(r[k])); return b; },
    order() { return b; },
    limit(n) { beperk = n; return b; },
    rijen() {
      let uit = db[naam].filter((r) => f.every((fn) => fn(r)));

      if (beperk != null) uit = uit.slice(0, beperk);

      return uit;
    },
    single() { const u = b.rijen(); return Promise.resolve(u.length ? { data: u[0], error: null } : { data: null, error: { code: 'PGRST116' } }); },
    maybeSingle() { const u = b.rijen(); return Promise.resolve({ data: u[0] || null, error: null }); },
    insert(row) { world().inserts.push({ tabel: naam, row }); return Promise.resolve({ data: null, error: null }); },
    update() { return b; },
    upsert() { return b; },
    then(res, rej) { return Promise.resolve({ data: b.rijen(), error: null }).then(res, rej); },
  };

  return b;
}

const world = () => H.world;

function uidVanToken(token) {
  const t = (H.world.tokens || {})[token];

  return t || (H.world.user && H.world.user.id) || null;
}

function huidigeTier(profiel) {
  const ruw = profiel?.subscription_tier;

  if (ruw !== 'pro' && ruw !== 'premium') return 'free';
  if (profiel?.subscription_active === true) return ruw;

  const eind = typeof profiel?.trial_ends_at === 'string' ? Date.parse(profiel.trial_ends_at) : NaN;

  return Number.isFinite(eind) && eind > Date.now() ? ruw : 'free';
}

const TIER_RANG = { free: 0, pro: 1, premium: 2 };
const magTier = (toegang, tier) => TIER_RANG[toegang] != null && TIER_RANG[toegang] <= TIER_RANG[tier];

function bronVan(rij) {
  const w = H.world;

  if (rij.scheme_id) {
    const r = (w.regelingen || []).find((x) => x.regeling_id === rij.scheme_id);

    return r ? { type: 'regeling', naam: r.naam, funder: r.funder_naam, website: r.funder_website, deadline: r.deadline_datum, toegang: r.access_tier, exclusief: Boolean(r.__exclusief) } : null;
  }

  if (rij.funder_id) {
    const lijsten = [...(w.fundersVolledig || []), ...(w.funders || []), ...(w.deadlines || [])];
    const f = lijsten.find((x) => x.funder_id === rij.funder_id);

    return f ? { type: 'fonds', naam: f.funder_naam, funder: f.funder_naam, website: f.funder_website, deadline: f.deadline_datum || null, toegang: f.access_tier, exclusief: Boolean(f.__exclusief) } : null;
  }

  return null;
}

// Nabootsing van public.kompas_dekkingsplan(p_program_id): auth.uid() uit de JWT, projecteigenaar,
// bronnen gemaskeerd naar het abonnement, effectieve deadline = eigen datum of live brondatum.
export function emuleerDekkingsplan(uid, programId) {
  world().rpcLog.push({ naam: 'kompas_dekkingsplan', args: { p_program_id: programId }, uid });

  if (H.world.dekkingsplanFout) return { data: null, error: { code: H.world.dekkingsplanFout, message: 'fout' } };
  if (!uid) return { data: null, error: { code: '28000', message: 'Niet ingelogd' } };
  if (!programId || !db.subsidie_kompas_programs.some((p) => p.id === programId && p.user_id === uid)) return { data: null, error: { code: '42501', message: 'Project niet gevonden' } };

  const tier = huidigeTier(H.world.profielVan ? H.world.profielVan(uid) : H.world.profile);
  const rijen = db.subsidie_kompas_program_funding
    .filter((r) => r.program_id === programId && r.user_id === uid)
    .map((r) => {
      const bron = bronVan(r);
      const zichtbaar = Boolean(bron) && magTier(bron.toegang, tier) && (tier === 'premium' || !bron.exclusief);
      const sys = zichtbaar ? bron.deadline || null : null;

      return {
        id: r.id,
        program_id: r.program_id,
        bron_type: r.scheme_id ? 'regeling' : r.funder_id ? 'fonds' : null,
        bron_status: !r.scheme_id && !r.funder_id ? 'verwijderd' : zichtbaar ? 'zichtbaar' : 'verborgen',
        scheme_id: zichtbaar ? r.scheme_id : null,
        funder_id: zichtbaar ? r.funder_id : null,
        bron_naam: zichtbaar ? bron.naam : null,
        funder_naam: zichtbaar ? bron.funder : null,
        website: zichtbaar ? bron.website : null,
        systeem_deadline: sys,
        systeem_deadline_bron: sys ? (bron.type === 'regeling' ? 'regeling' : 'fonds') : null,
        requested_amount: r.requested_amount ?? null,
        awarded_amount: r.awarded_amount ?? null,
        status: r.status || 'interesting',
        eigen_deadline: r.eigen_deadline || null,
        effectieve_deadline: r.eigen_deadline || sys,
        reminder_enabled: r.reminder_enabled !== false,
        notes: r.notes || null,
        created_at: r.created_at || '2026-10-01T00:00:00Z',
        updated_at: r.created_at || '2026-10-01T00:00:00Z',
      };
    })
    .sort((a, b) => String(a.effectieve_deadline || '9999').localeCompare(String(b.effectieve_deadline || '9999')) || a.id.localeCompare(b.id));

  return { data: rijen, error: null };
}

function gebruikersClient(auth) {
  const token = String(auth).replace(/^Bearer /, '');
  const uid = uidVanToken(token);

  return {
    rpc: async (naam, args) => {
      if (naam === 'kompas_dekkingsplan') return emuleerDekkingsplan(uid, args?.p_program_id);

      return { data: null, error: { code: 'PGRST202', message: 'onbekende functie' } };
    },
    from: (t) => origAdmin.from(t),
  };
}

const admin5 = {
  auth: origAdmin.auth,
  from: (t) => (db[t] ? tabelBuilder(t) : origAdmin.from(t)),
  rpc: async (naam, args) => {
    if (naam === 'kompas_dekkingsplan') {
      // De service-role-client heeft geen auth.uid(): net als in de echte database.
      return emuleerDekkingsplan(null, args?.p_program_id);
    }

    return origAdmin.rpc(naam, args);
  },
};

globalThis.__createClient = (url, key, opts) => {
  const auth = opts?.global?.headers?.Authorization;

  H.world.clientLog = H.world.clientLog || [];
  H.world.clientLog.push({ metJwt: Boolean(auth), key });

  // Testschakelaar: een RPC die nooit antwoordt (blijft hangen).
  if (auth && H.world.dekkingsplanHang) return { rpc: () => new Promise(() => {}), from: (t) => origAdmin.from(t) };

  return auth ? gebruikersClient(auth) : admin5;
};

export function resetWorld5(opties = {}) {
  H.resetWorld({
    env: { SUPABASE_ANON_KEY: 'anon-test' },
    tokens: {},
    clientLog: [],
    ...opties,
  });
  Object.keys(db).forEach((k) => { db[k].length = 0; });
  fouten.length = 0;
  H.world.extractor = opties.extractor || extractorHushu;
}

// Deterministische stand-in voor de criteria-extractie (zie fondsadvies-free/harness.mjs).
export function extractorHushu(tekst) {
  const t = tekst.toLowerCase();
  const uit = { themas: [], doelgroepen: [], regios: [], locatie: '', gevraagd_bedrag: null };

  if (/cultuur|dans|podium|talent|hushu/.test(t)) uit.themas.push('Cultuur', 'Talentontwikkeling', 'Dans');
  if (/jongeren|jeugd/.test(t)) uit.doelgroepen.push('Jongeren');
  if (/rotterdam/.test(t)) { uit.regios.push('Rotterdam'); uit.locatie = 'Rotterdam'; }
  if (/amsterdam/.test(t)) { uit.regios.push('Amsterdam'); uit.locatie = 'Amsterdam'; }
  if (/armoede/.test(t)) uit.themas.push('Armoedebestrijding', 'Zelfredzaamheid');

  const m = t.match(/€\s?([\d.]+)/);

  if (m) uit.gevraagd_bedrag = Number(m[1].replace(/\./g, ''));

  return uit;
}

// ---------------------------------------------------------------------------
// Fixtures: Hushu House 2027 en een kleine fondsendatabase.
// ---------------------------------------------------------------------------
export const GEBRUIKER_A = { id: uuid() };
export const GEBRUIKER_B = { id: uuid() };

export function maakProject({ id = uuid(), user = GEBRUIKER_A.id, naam = 'Hushu House 2027', ...rest } = {}) {
  const rij = {
    id,
    user_id: user,
    name: naam,
    target_groups: 'jongeren',
    location: 'Rotterdam',
    description: 'Cultureel huis voor jonge makers in Rotterdam met dans en talentontwikkeling.',
    goals: 'Talent ontwikkelen',
    activities: 'Workshops en voorstellingen',
    planning: '2027',
    impact_description: 'Meer jongeren in cultuur',
    partners: 'Dansschool',
    results: '300 deelnemers',
    budget_total: 100000,
    requested_amount: 40000,
    own_contribution: 10000,
    writing_preferences: '',
    archived_at: null,
    ...rest,
  };

  db.subsidie_kompas_programs.push(rij);

  return rij;
}

export function maakGesprek({ id = uuid(), user = GEBRUIKER_A.id, programId = null } = {}) {
  const rij = { id, user_id: user, active_program_id: programId, title: 'Gesprek', updated_at: '2026-10-11T10:00:00Z' };

  db.subsidie_kompas_conversations.push(rij);

  return rij;
}

export function maakFundingRegel({ user = GEBRUIKER_A.id, programId, schemeId = null, funderId = null, ...rest }) {
  const rij = { id: uuid(), user_id: user, program_id: programId, scheme_id: schemeId, funder_id: funderId, requested_amount: null, awarded_amount: null, status: 'interesting', eigen_deadline: null, reminder_enabled: true, notes: null, created_at: '2026-10-05T00:00:00Z', ...rest };

  db.subsidie_kompas_program_funding.push(rij);

  return rij;
}

export function fondsenDatabase() {
  const metId = (o, extra = {}) => ({ ...o, regeling_id: uuid(), ...extra });
  const R = {
    jongeren: metId(H.reg({ naam: 'Rotterdams Jongerencultuurfonds', tier: 'pro', themas: ['Cultuur', 'Talentontwikkeling'], doelgroepen: ['Jongeren'], regios: ['Rotterdam'], deadline: '2026-11-12', funder: 'Gemeente Rotterdam', funderId: uuid() })),
    dans: metId(H.reg({ naam: 'Dansimpuls Nederland', tier: 'free', themas: ['Dans', 'Cultuur'], doelgroepen: ['Jongeren'], regios: ['Landelijk'], deadline: '2026-12-01', funder: 'Stichting Dans Nederland', funderId: uuid() })),
    premium: metId(H.reg({ naam: 'Talentprogramma Premium', tier: 'premium', themas: ['Talentontwikkeling', 'Cultuur'], doelgroepen: ['Jongeren'], regios: ['Landelijk'], deadline: '2026-12-15', funder: 'Exclusief Talentfonds', funderId: uuid(), exclusief: true })),
    amsterdam: metId(H.reg({ naam: 'Amsterdamse Cultuurregeling', tier: 'free', themas: ['Cultuur'], regios: ['Amsterdam'], deadline: '2026-11-30', funder: 'Gemeente Amsterdam', funderId: uuid() })),
  };
  const F = {
    podium: H.funder({ naam: 'Fonds Podiumkunsten', tier: 'pro', themas: ['Cultuur', 'Theater en podiumkunsten'], doelgroepen: ['Jongeren'], regios: ['Landelijk'], id: uuid() }),
    jeugd: H.funder({ naam: 'Jeugd en Talent Fonds', tier: 'free', themas: ['Talentontwikkeling', 'Cultuur'], doelgroepen: ['Jongeren'], regios: ['Landelijk'], id: uuid() }),
  };
  const ruis = Array.from({ length: 30 }, (_, i) => metId(H.reg({ naam: `Irrelevant ${i}`, tier: i % 2 ? 'premium' : 'pro', themas: ['Sport'], regios: ['Landelijk'], funderId: uuid() })));

  return { R, F, regelingen: [...Object.values(R), ...ruis], funders: Object.values(F) };
}

export function profiel(tier, extra = {}) {
  return { subscription_tier: tier, subscription_active: tier !== 'free', trial_ends_at: null, role: 'user', ...extra };
}

export const JWT = { A: 'jwt-user-a', B: 'jwt-user-b' };

export function zetGebruiker(user, tier = 'pro', token = JWT.A) {
  H.world.user = user;
  H.world.profile = profiel(tier);
  H.world.tokens = { ...(H.world.tokens || {}), [token]: user.id };
}

// Een chatverzoek zoals chat.js het stuurt (maar met alleen identifiers voor project/gesprek).
export async function vraag5(handler, { messages, kompasMode = 'algemeen', token = JWT.A, activeProgramId = null, conversationId = null, focusFundingId, stream = false, extra = {} }) {
  const headers = { 'Content-Type': 'application/json' };

  if (token) headers.Authorization = `Bearer ${token}`;

  const body = { messages, kompasMode, stream, activeProgramId, conversationId, contextVersie: 2, testLabel: 'harnas', ...extra };

  if (focusFundingId !== undefined) body.focusFundingId = focusFundingId;

  const voor = H.world.openAi.length;
  const res = await handler(new Request('http://x/functions/v1/subsidie-kompas', { method: 'POST', headers, body: JSON.stringify(body) }));
  let json = null;
  let events = [];

  if (stream) {
    const tekst = await res.text();

    events = tekst.split('\n').filter((r) => r.startsWith('data:')).map((r) => JSON.parse(r.slice(5)));
    json = events.find((e) => e.done) || events.find((e) => e.error) || null;
  } else {
    json = await res.json();
  }

  const hoofdAanroepen = H.world.openAi.slice(voor).filter((c) => c.soort === 'responses');
  const hoofd = hoofdAanroepen[hoofdAanroepen.length - 1]?.body;
  const input = (hoofd?.input || []).map((m) => ({ role: m.role, content: String(m.content) }));

  return { status: res.status, json, events, hoofd, input, developer: input.filter((m) => m.role === 'developer').map((m) => m.content) };
}

export const FUNDING_KOP = 'FINANCIERING VAN DIT PROJECT';
export const fundingBlok = (r) => r.developer.find((t) => t.startsWith(FUNDING_KOP)) || '';
