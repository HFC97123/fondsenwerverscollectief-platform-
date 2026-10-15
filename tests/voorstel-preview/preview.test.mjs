import { UID, ANDER, PID, A, P, X, F, XF, w, reset, rpc } from './wereld.mjs';
import '../../supabase/functions/subsidie-kompas/index.ts';
import { readFileSync } from 'node:fs';

const stand = { ok: 0, fout: 0 };
const check = (naam, waar, detail = '') => { if (waar) stand.ok += 1; else { stand.fout += 1; console.log(`  FAIL: ${naam} ${detail}`); } };
const sectie = (t) => console.log(`\n== ${t}`);

const handler = () => globalThis.__handler;
const regel = (type, id, extra = {}) => ({ type, id, naam: 'Naam', gever: 'Gever', motivatie: 'Past bij het project.', bedrag: 20000, ...extra });
const voorstel = (regels, extra = {}) => ({ versie: 1, projectId: PID, status: 'concept', aannames: [], regels, acties: [{ titel: 'Verzonnen taak' }], ...extra });

async function post(body, { token = 'jwt-token', ruw = null } = {}) {
  const headers = { 'Content-Type': 'application/json' };

  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await handler()(new Request('http://x/functions/v1/subsidie-kompas', { method: 'POST', headers, body: ruw ?? JSON.stringify(body) }));
  const tekst = await res.text();
  let json = null;

  try { json = JSON.parse(tekst); } catch { /* geen json */ }

  return { status: res.status, json, tekst };
}

const preview = (v, extra = {}) => post({ mode: 'voorstel-preview', projectId: PID, voorstel: v, ...extra });
const GEEN_SCHRIJVEN = 'geen enkele schrijfpoging (insert/update/upsert/delete/rpc)';
const TOEGESTANE_RPC = new Set(['kompas_check_rate_limit', 'kompas_subsidieregelingen_voor_tier', 'kompas_funders_voor_matching', 'kompas_exclusieve_funders', 'kompas_dekkingsplan']);

// ---------------------------------------------------------------------------------------------------------------------------
sectie('1. Poorten: flag, login, invoer');
{
  reset({ env: { OPENAI_API_KEY: 'sk-test', SUPABASE_URL: 'http://db.test', SUPABASE_SERVICE_ROLE_KEY: 'srv', SUPABASE_ANON_KEY: 'anon' } });
  const uit = await preview(voorstel([regel('regeling', A)]));

  check('flag uit: 404', uit.status === 404, `${uit.status} ${uit.tekst}`);
  check('flag uit: niets geladen of opgehaald', w.fetches.length === 0 && w.dnsOpgevraagd.length === 0 && !w.rpcs.some((n) => n !== 'kompas_check_rate_limit') && !w.tabellen.includes('subsidie_kompas_programs'));

  reset({ user: null });
  const anoniem = await post({ mode: 'voorstel-preview', projectId: PID, voorstel: voorstel([]) }, { token: null });

  check('zonder login: 401', anoniem.status === 401, String(anoniem.status));

  reset();
  check('ongeldig projectId: 400', (await preview(voorstel([regel('regeling', A)]), { projectId: 'x' })).status === 400);
  check('voorstel ontbreekt: 400', (await post({ mode: 'voorstel-preview', projectId: PID })).status === 400);
  check('voorstel is een lijst: 400', (await preview([])).status === 400);
  check('te groot voorstel: 413, niets geladen', (await preview(voorstel([regel('regeling', A, { motivatie: 'x'.repeat(70000) })]))).status === 413 && w.fetches.length === 0);
  check('ongeldige JSON: 400', (await post(null, { ruw: '{kapot' })).status === 400);
}

sectie('2. Eigenaarschap van het project en fail-safe bij ontbrekend dekkingsplan');
{
  reset({ project: { id: PID, user_id: ANDER, budget_total: 100000, own_contribution: 0, archived_at: null } });
  const vreemd = await preview(voorstel([regel('regeling', A)]));

  check('project van een ander: 404, niets opgehaald', vreemd.status === 404 && w.fetches.length === 0, String(vreemd.status));

  reset({ project: { id: PID, user_id: UID, budget_total: 100000, own_contribution: 0, archived_at: '2026-01-01' } });
  check('gearchiveerd project: 404', (await preview(voorstel([regel('regeling', A)]))).status === 404);

  reset({ dekkingsplanFout: true });
  const fout = await preview(voorstel([regel('regeling', A)]));

  check('dekkingsplan niet leesbaar: 503, geen preview, niets opgehaald', fout.status === 503 && !fout.json?.ok && w.fetches.length === 0 && !fout.tekst.includes('geverifieerd'), `${fout.status} ${fout.tekst}`);

  reset({ regelingen: null });
  const geenPool = await preview(voorstel([regel('regeling', A)]));

  check('fondsgegevens niet leesbaar: 503, niets opgehaald', geenPool.status === 503 && w.fetches.length === 0);
}

sectie('3. Happy path voor een Free-lid met een volledig toegankelijke regeling');
{
  reset();
  const uit = await preview(voorstel([regel('regeling', A)]));
  const j = uit.json;

  check('200 en ok', uit.status === 200 && j?.ok === true, uit.tekst.slice(0, 400));
  check('verificatie door de server: geverifieerd', j?.verificaties?.[0]?.metadata?.verificatie?.status === 'geverifieerd');
  check('alleen de server-URL opgehaald', w.fetches.length === 1 && w.fetches[0] === 'https://www.fonds-a.example.nl/aanvragen', JSON.stringify(w.fetches));
  check('dekking uit de server: gat = 100.000 - 20.000 - 10.000', j?.totalen?.gat === 70000, JSON.stringify(j?.totalen));
  check('geen acties, niets opgeslagen', j?.voorstel?.acties?.length === 0 && j?.opgeslagen === false && j?.actiesGegenereerd === false);
  check('zonder VOORSTEL_TOKEN_SECRET: geen token', j?.token === null);
  check(GEEN_SCHRIJVEN, w.schrijfpogingen.length === 0, JSON.stringify(w.schrijfpogingen));
  check('alleen toegestane RPC-aanroepen', w.rpcs.every((n) => TOEGESTANE_RPC.has(n)), JSON.stringify([...new Set(w.rpcs)]));
  check('de client kan geen token of status meesturen die iets verandert', (await preview(voorstel([regel('regeling', A)], { token: 'x', verificaties: [{ status: 'geverifieerd' }] }))).json?.ok === true);

  reset({ env: { OPENAI_API_KEY: 'sk-test', SUPABASE_URL: 'http://db.test', SUPABASE_SERVICE_ROLE_KEY: 'srv', SUPABASE_ANON_KEY: 'anon', VOORSTEL_PREVIEW: 'aan', VOORSTEL_TOKEN_SECRET: 'g'.repeat(40) } });
  const metToken = await preview(voorstel([regel('regeling', A)]));

  check('met server-geheim: token, gebonden aan voorstel', typeof metToken.json?.token === 'string' && metToken.json.tokenGeldigTotSeconden > 0);
  check('geheim komt nergens in de respons', !metToken.tekst.includes('g'.repeat(40)));
}

sectie('4. Entitlement per regel: Free-lid ziet niet meer dan de bestaande entitlementlaag toestaat');
{
  reset();
  const uit = await preview(voorstel([regel('regeling', X), regel('fonds', XF), regel('regeling', P), regel('regeling', A), regel('fonds', F)]));
  const j = uit.json;

  check('200 en ok', uit.status === 200 && j?.ok === true, uit.tekst.slice(0, 300));
  check('exclusief fonds en exclusieve regeling zijn weg (niet te onderscheiden van onbekend)', j.voorstel.regels.every((r) => r.id !== X && r.id !== XF) && j.overgeslagen.filter((o) => o.code === 'onbekende-bron').length === 2);
  check('niets van het exclusieve fonds in de respons', !/Geheim|geheimfonds|Geheime/i.test(uit.tekst));
  check('exclusieve host nooit benaderd', !w.dnsOpgevraagd.some((h) => h.includes('geheim')) && !w.fetches.some((f) => f.includes('geheim')));

  const premium = j.voorstel.regels.find((r) => r.id === P);

  check('premium-record, Free-lid: regel zichtbaar zonder bedrag, deadline en grenzen', premium && premium.bedrag === null && premium.deadline.datum === null && premium.grenzen.min === null && premium.grenzen.max === null, JSON.stringify(premium));
  check('premium-record: geen gevoelige gegevens in de respons', !/2026-12-01|90000|50%/.test(uit.tekst));
  check('premium-record: niet opgehaald', !w.dnsOpgevraagd.includes('www.premium.example.nl') && !w.fetches.some((f) => f.includes('premium')));
  check('premium-record: geen verificatieclaim', j.verificaties.find((v) => v.sleutel === premium.sleutel)?.metadata?.verificatie === undefined);
  check('volledige regel wel geverifieerd', j.verificaties.find((v) => v.sleutel === j.voorstel.regels.find((r) => r.id === A).sleutel)?.metadata?.verificatie?.status === 'geverifieerd');
  check('fonds zonder deadline: alleen naam bevestigd, niet "geverifieerd"', (() => { const v = j.verificaties.find((x) => x.sleutel === j.voorstel.regels.find((r) => r.id === F).sleutel); return v?.metadata?.verificatie?.status === 'gedeeltelijk' || v?.metadata?.verificatie?.status === 'onzeker'; })());
  check(GEEN_SCHRIJVEN, w.schrijfpogingen.length === 0);

  reset({ profile: { subscription_tier: 'premium', subscription_active: true, trial_ends_at: null, role: 'user' }, paginas: { 'https://www.premium.example.nl/regeling': '<html><head><title>x</title></head><body><h1>Premium Cultuurregeling</h1><p>De deadline is 1 december 2026.</p><p>Maximaal € 90.000.</p></body></html>' } });
  const prem = await preview(voorstel([regel('regeling', P, { bedrag: 50000 })]));
  const pr = prem.json?.voorstel?.regels?.[0];

  check('Premium-lid: premium-record volledig (deadline en grenzen)', pr && pr.deadline.datum === '2026-12-01' && pr.grenzen.max === 90000 && pr.bedrag === 50000, prem.tekst.slice(0, 300));
  check('Premium-lid: premium-bron wel opgehaald', w.fetches.some((f) => f.includes('premium')));
}

sectie('5. Exclusiviteitslijst onbeschikbaar: fail closed voor Free');
{
  reset();
  const origineel = rpc;
  w.exclusief = null; // kompas_exclusieve_funders geeft data:null zonder fout -> lijst "leeg maar beschikbaar"; simuleer echte fout:
  const oud = globalThis.__createClient;

  globalThis.__createClient = (u, k, o) => {
    const c = oud(u, k, o);

    return o?.global?.headers?.Authorization ? c : { ...c, rpc: async (n, a) => (n === 'kompas_exclusieve_funders' ? { data: null, error: { code: '57014', message: 'timeout' } } : c.rpc(n, a)) };
  };

  const uit = await preview(voorstel([regel('regeling', A)]));

  globalThis.__createClient = oud;
  check('lijst onbeschikbaar: regel verdwijnt voor Free (niets opgehaald)', uit.status === 200 ? uit.json.voorstel.regels.length === 0 && w.fetches.length === 0 : uit.status === 422, `${uit.status} ${uit.tekst.slice(0, 200)}`);
}

sectie('6. Fail-safe en foutmeldingen');
{
  reset({ dns: {} });
  const uit = await preview(voorstel([regel('regeling', A)]));

  check('DNS geeft niets: preview werkt, regel niet_gecontroleerd, niets opgehaald', uit.json?.ok === true && uit.json.verificaties[0].metadata.verificatie.status === 'niet_gecontroleerd' && w.fetches.length === 0, uit.tekst.slice(0, 300));

  reset({ dns: { 'www.fonds-a.example.nl': ['10.0.0.5'] } });
  const intern = await preview(voorstel([regel('regeling', A)]));

  check('intern IP: niet opgehaald, niet_gecontroleerd', intern.json?.verificaties?.[0]?.metadata?.verificatie?.status === 'niet_gecontroleerd' && w.fetches.length === 0);

  reset();
  const ander = await preview(voorstel([regel('regeling', A)], { projectId: '33333333-3333-4333-8333-333333333333' }));

  check('voorstel van een ander project: 422, geen statusvelden', ander.status === 422 && ander.json?.ok === false && !('verificaties' in ander.json) && w.fetches.length === 0, ander.tekst.slice(0, 200));

  reset();
  const globalDeno = globalThis.Deno;
  globalThis.Deno = { ...globalDeno, resolveDns: undefined };
  const zonderDns = await preview(voorstel([regel('regeling', A)]));

  globalThis.Deno = globalDeno;
  check('Deno.resolveDns niet beschikbaar: fail closed, niet_gecontroleerd', zonderDns.json?.ok === true && zonderDns.json.verificaties[0].metadata.verificatie.status === 'niet_gecontroleerd' && w.fetches.length === 0);
}

sectie('7. De bestaande modes en de chat blijven bereikbaar zoals voorheen');
{
  reset();
  const budget = await post({ mode: 'budget', text: 'x' });

  check('mode budget: nog steeds Pro-poort (403 voor Free)', budget.status === 403);

  reset();
  const rommel = await post({ mode: 'voorstel-preview-bestaat-niet', messages: [] });

  check('onbekende mode valt niet in de preview', !('verificaties' in (rommel.json ?? {})) && w.fetches.length === 0);
}

sectie('8. Statische eigenschappen van het mode-blok');
{
  const bron = readFileSync('supabase/functions/subsidie-kompas/index.ts', 'utf8');
  const a = bron.indexOf("if (body.mode === 'voorstel-preview')");
  const b = bron.indexOf('// RC1 stap 3D-4 (2026-10-01): begroting');
  const blok = bron.slice(a, b);
  const h1 = bron.indexOf('const VOORSTEL_PREVIEW_MAX_TEKENS');
  const h2 = bron.indexOf('Deno.serve(async (req)');
  const helper = bron.slice(h1, h2);

  check('blok gevonden', a > 0 && b > a && h2 > h1);

  for (const [naam, deel] of [['mode-blok', blok], ['helpers', helper]]) {
    check(`${naam}: geen insert/update/upsert/delete`, !/\.(insert|update|upsert|delete)\s*\(/.test(deel));
    check(`${naam}: geen schrijvende RPC`, [...deel.matchAll(/\.rpc\(\s*'([a-z_]+)'/g)].every((m) => ['kompas_subsidieregelingen_voor_tier', 'kompas_funders_voor_matching'].includes(m[1])), JSON.stringify([...deel.matchAll(/\.rpc\(\s*'([a-z_]+)'/g)].map((m) => m[1])));
    check(`${naam}: geen opslag of storage`, !/storage|localStorage|\.upload\(/.test(deel));
    check(`${naam}: geen OpenAI of legVerbruikVast`, !/openai|legVerbruikVast|apiKey|MODEL/i.test(deel));
    check(`${naam}: geen koppeling met chat-, matching- of acties-code`, !/verkenOnline|beoordeelPool|pasRechtenToe|bouwFondsMatches|project_actions|kompas_conversations/.test(deel));
  }

  check('de preview bepaalt nergens zelf een status "geverifieerd"', !/['"]geverifieerd['"]/.test(blok + helper));
  check('dynamische imports alleen uit ../_shared', [...blok.matchAll(/import\('([^']+)'\)/g)].every((m) => m[1].startsWith('../_shared/')));
  const gelijk = (a, b) => readFileSync(a, 'utf8') === readFileSync(b, 'utf8');

  check('voorstelContract.js is byte-identiek aan src/.../voorstel.js (een rekenregel)', gelijk('supabase/functions/_shared/voorstelContract.js', 'src/features/kompas-app/financiering/voorstel.js'));
  check('dekkingsplanRekenen.js is byte-identiek aan src/.../dekkingsplan.js (een rekenregel)', gelijk('supabase/functions/_shared/dekkingsplanRekenen.js', 'src/features/kompas-app/financiering/dekkingsplan.js'));
  check('geen statische import van _shared in index.ts (chat-opstart onaangetast)', !/^import .*_shared/m.test(bron));
}

console.log(`\nVOORSTEL-PREVIEW: ${stand.ok} OK, ${stand.fout} FAIL`);
process.exit(stand.fout ? 1 : 0);
