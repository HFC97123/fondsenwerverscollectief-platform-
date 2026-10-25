// tests/tier/gebruik.test.mjs
import { readFileSync } from "node:fs";

// supabase/functions/_shared/gebruikLog.ts
var ACTIE_TYPES = [
  "chat",
  "fonds_scan_database",
  // criteria afleiden en databasematching rond een fondsvraag
  "fonds_scan_web",
  // online oriëntatie / verkenner
  "fonds_beoordeling",
  // AI-beoordeling met bewijs van de beste kandidaten (Pro en Premium)
  "proposal_preview",
  "source_verification",
  "document_generation",
  "project_advice",
  "document_analyse",
  "website_analyse",
  "aanvraag_eisen",
  // aanvraag-assistent: eisenlijst uit website en tekst van het lid
  "aanvraag_beoordeling",
  // aanvraag-assistent: aanvraag beoordelen tegen de eisen
  "aanvraag_plan",
  // aanvraag-assistent: projectplan schrijven uit projectgegevens en documentatie
  "aanvraag_begroting",
  // aanvraag-assistent: het chatantwoord over de begroting omzetten in begrotingsregels
  "aanvraag_begroting_upload"
  // aanvraag-assistent: een geüpload begrotingsbestand omzetten in begrotingsregels
];
var TIERS = ["free", "pro", "premium", "admin"];
var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var GEBRUIK_TABEL = "kompas_gebruik_log";
var GEBRUIK_MAX_WACHT_MS = 1500;
var PRIJZEN = {
  gecontroleerdOp: "2026-10-15",
  // Ruwe omrekening dollar -> euro voor de schatting. Periodiek bijstellen; een schatting is geen boekhouding.
  usdNaarEur: 0.92,
  modellen: {
    "gpt-5.5": { inUsd: 5, gecachedInUsd: 0.5, uitUsd: 30 },
    "gpt-4o": { inUsd: 2.5, gecachedInUsd: 1.25, uitUsd: 10 }
  },
  webZoekenUsdPer1000Aanroepen: 10
};
function prijsVoorModel(model) {
  const m = typeof model === "string" ? model.trim().toLowerCase() : "";
  const sleutel = Object.keys(PRIJZEN.modellen).sort((a, b) => b.length - a.length).find((k) => m === k || m.startsWith(`${k}-`));
  return sleutel ? PRIJZEN.modellen[sleutel] : null;
}
var heel = (x, max = 2e9) => typeof x === "number" && Number.isFinite(x) && x > 0 ? Math.min(Math.round(x), max) : 0;
function schatKosten(inv) {
  const web = heel(inv.webZoekAanroepen) * (PRIJZEN.webZoekenUsdPer1000Aanroepen / 1e3);
  const input = heel(inv.inputTokens);
  const output = heel(inv.outputTokens);
  const prijs = prijsVoorModel(inv.model);
  if (!prijs) return input === 0 && output === 0 ? Math.round(web * PRIJZEN.usdNaarEur * 1e4) / 1e4 : null;
  const gecacht = Math.min(heel(inv.gecachedeInputTokens), input);
  const usd = ((input - gecacht) * prijs.inUsd + gecacht * prijs.gecachedInUsd + output * prijs.uitUsd) / 1e6 + web;
  return Math.round(usd * PRIJZEN.usdNaarEur * 1e4) / 1e4;
}
function tokensUitUsage(usage) {
  const u = typeof usage === "object" && usage !== null ? usage : {};
  return {
    input: heel(u.input_tokens ?? u.prompt_tokens),
    output: heel(u.output_tokens ?? u.completion_tokens),
    gecachte: heel(u.input_tokens_details?.cached_tokens ?? u.prompt_tokens_details?.cached_tokens)
  };
}
function bouwGebruikRij(inv) {
  const userId = typeof inv?.userId === "string" && UUID.test(inv.userId) ? inv.userId.toLowerCase() : null;
  const tier = TIERS.find((t) => t === inv?.tier);
  const actie = ACTIE_TYPES.find((a) => a === inv?.actie);
  if (!userId || !tier || !actie) return null;
  const model = typeof inv.model === "string" && inv.model.trim() ? inv.model.trim().slice(0, 60) : null;
  const webZoek = heel(inv.webZoekAanroepen, 1e4);
  const kostenGegeven = typeof inv.kostenEur === "number" && Number.isFinite(inv.kostenEur) && inv.kostenEur >= 0 ? Math.round(inv.kostenEur * 1e4) / 1e4 : null;
  return {
    user_id: userId,
    tier,
    action_type: actie,
    project_id: typeof inv.projectId === "string" && UUID.test(inv.projectId) ? inv.projectId.toLowerCase() : null,
    model,
    input_tokens: heel(inv.inputTokens),
    output_tokens: heel(inv.outputTokens),
    web_search_calls: webZoek,
    external_page_fetches: heel(inv.externePaginas, 1e4),
    verification_pages: heel(inv.verificatiePaginas, 1e4),
    cache_hits: heel(inv.cacheHits, 1e4),
    duration_ms: heel(inv.duurMs, 36e5),
    estimated_cost_eur: kostenGegeven ?? schatKosten({ model, inputTokens: inv.inputTokens, outputTokens: inv.outputTokens, gecachedeInputTokens: inv.gecachedeInputTokens, webZoekAanroepen: webZoek }),
    success: inv.succes !== false
  };
}
async function legGebruik(admin, inv) {
  try {
    const rij = bouwGebruikRij(inv);
    if (!rij || !admin || typeof admin.from !== "function") return false;
    let timer;
    const verlopen = new Promise((klaar2) => {
      timer = setTimeout(() => klaar2({ error: { code: "timeout" } }), GEBRUIK_MAX_WACHT_MS);
    });
    const uitkomst = await Promise.race([Promise.resolve(admin.from(GEBRUIK_TABEL).insert(rij)), verlopen]);
    clearTimeout(timer);
    const error = uitkomst?.error;
    if (error) {
      console.error("[subsidie-kompas] gebruik_vastleggen_mislukt");
      return false;
    }
    return true;
  } catch (_) {
    console.error("[subsidie-kompas] gebruik_vastleggen_fout");
    return false;
  }
}

// supabase/functions/_shared/tierConfig.ts
var PRO = {
  tier: "pro",
  dekkingsplan: true,
  toegestaneAccessTiers: ["free", "pro"],
  dekkingsdoel: 1.2,
  maxAandeelPerFonds: 1 / 3,
  minScore: 50,
  maxRegelsInMix: 6,
  alternatieven: 3,
  rangschikOpBijdrage: false,
  onlineOrientatie: { maxKandidaten: 2, maxZoekopdrachten: 2, timeoutMs: 4e4 },
  onlineAanvullen: null,
  aanvullenVelden: "indien-nodig",
  premiumHint: true,
  beoordeling: { maxKandidaten: 25, dekkingsdoelLijst: 1, maxFactorLijst: 1.2, netNietLijst: false },
  maandBudgetObservatieEur: 7,
  aanvraagAssistent: {
    beoordelingenPerMaand: 6,
    projectplannen: 1,
    eisenOphalenPerMaand: 12,
    maxEisen: 40,
    maxAanvraagTekens: 6e4,
    maxRichtlijnTekens: 4e4,
    rijkeEditor: false,
    aiPaneel: false,
    paneelActiesPerMaand: 0,
    dekkingsoverzicht: false,
    commissieblik: false
  }
};
var PREMIUM = {
  tier: "premium",
  dekkingsplan: true,
  toegestaneAccessTiers: ["free", "pro", "premium"],
  dekkingsdoel: 1.6,
  maxAandeelPerFonds: 1 / 3,
  minScore: 50,
  maxRegelsInMix: 9,
  alternatieven: 3,
  rangschikOpBijdrage: true,
  onlineOrientatie: { maxKandidaten: 6, maxZoekopdrachten: 6, timeoutMs: 6e4, minTonen: 3, totaalMax: 10 },
  onlineAanvullen: { maxKandidaten: 5 },
  aanvullenVelden: "alle-ontbrekende",
  premiumHint: false,
  beoordeling: { maxKandidaten: 40, dekkingsdoelLijst: 1.4, maxFactorLijst: 1.4, netNietLijst: true },
  maandBudgetObservatieEur: 14,
  // Beoordelingen per maand = per project x aantal projecten: 10 per project, 3 projecten met een plan, dus 30 (Aisya, 21 oktober 2026). Elke aanvraag per fonds
  // krijgt de actuele begroting en het actuele dekkingsplan mee. Voor nu verder hetzelfde als Pro. De uitbreidingen (rijke editor, AI-paneel, dekkingsoverzicht, commissieblik) staan
  // uit tot ze gebouwd zijn.
  aanvraagAssistent: {
    beoordelingenPerMaand: 30,
    projectplannen: 3,
    eisenOphalenPerMaand: 40,
    maxEisen: 40,
    maxAanvraagTekens: 6e4,
    maxRichtlijnTekens: 4e4,
    rijkeEditor: false,
    aiPaneel: false,
    paneelActiesPerMaand: 0,
    dekkingsoverzicht: false,
    commissieblik: false
  }
};
var FREE = {
  tier: "free",
  dekkingsplan: false,
  toegestaneAccessTiers: ["free"],
  dekkingsdoel: 1,
  maxAandeelPerFonds: 0.5,
  minScore: 50,
  maxRegelsInMix: 0,
  alternatieven: 0,
  rangschikOpBijdrage: false,
  onlineOrientatie: null,
  onlineAanvullen: null,
  aanvullenVelden: "geen",
  premiumHint: false,
  beoordeling: null,
  maandBudgetObservatieEur: null,
  aanvraagAssistent: null
};
function diepBevroren(o) {
  if (o && typeof o === "object") {
    for (const v of Object.values(o)) diepBevroren(v);
    Object.freeze(o);
  }
  return o;
}
var CONFIGS = Object.freeze({ free: diepBevroren(FREE), pro: diepBevroren(PRO), premium: diepBevroren(PREMIUM) });
function tierConfigVoor(tier, isAdmin = false) {
  if (isAdmin === true) return CONFIGS.premium;
  return tier === "pro" ? CONFIGS.pro : tier === "premium" ? CONFIGS.premium : CONFIGS.free;
}

// tests/verificatie/hulp.mjs
var stand = { ok: 0, fout: 0, naam: "" };
var check = (naam, waar, detail = "") => {
  if (waar) stand.ok += 1;
  else {
    stand.fout += 1;
    console.log(`  FAIL: ${stand.naam}: ${naam} ${detail}`);
  }
};
var gelijk = (naam, kreeg, verwacht) => {
  const a = JSON.stringify(kreeg);
  const b = JSON.stringify(verwacht);
  check(naam, a === b, `
    kreeg    ${a}
    verwacht ${b}`);
};
var sectie = (t) => console.log(`
== ${t}`);
var klaar = (naam) => {
  console.log(`
${naam}: ${stand.ok} OK, ${stand.fout} FAIL`);
  process.exit(stand.fout ? 1 : 0);
};
var enc = new TextEncoder();

// tests/tier/gebruik.test.mjs
stand.naam = "gebruik";
var U = "11111111-1111-4111-8111-111111111111";
var P = "22222222-2222-4222-8222-222222222222";
var BASIS = { userId: U, tier: "pro", actie: "chat" };
sectie("1. Kostenschatting: \xE9\xE9n prijslijst, bekende uitkomsten");
{
  const r = PRIJZEN.usdNaarEur;
  gelijk("1 miljoen in + 100.000 uit op gpt-5.5 = $ 5 + $ 3", schatKosten({ model: "gpt-5.5", inputTokens: 1e6, outputTokens: 1e5 }), Math.round(8 * r * 1e4) / 1e4);
  gelijk("gecachte invoer wordt goedkoper gerekend", schatKosten({ model: "gpt-5.5", inputTokens: 1e6, gecachedeInputTokens: 1e6 }), Math.round(0.5 * r * 1e4) / 1e4);
  gelijk("gecachte tokens kunnen niet groter zijn dan de invoer", schatKosten({ model: "gpt-5.5", inputTokens: 1e3, gecachedeInputTokens: 99999 }), schatKosten({ model: "gpt-5.5", inputTokens: 1e3, gecachedeInputTokens: 1e3 }));
  gelijk("1.000 webzoekacties = $ 10", schatKosten({ model: "gpt-5.5", webZoekAanroepen: 1e3 }), Math.round(10 * r * 1e4) / 1e4);
  gelijk("gpt-4o", schatKosten({ model: "gpt-4o", inputTokens: 1e6, outputTokens: 1e6 }), Math.round(12.5 * r * 1e4) / 1e4);
  gelijk("datumsuffix valt op het basismodel", schatKosten({ model: "gpt-5.5-2026-08-01", inputTokens: 1e6 }), schatKosten({ model: "gpt-5.5", inputTokens: 1e6 }));
  check("onbekend model met tokens: null, geen verzonnen bedrag", schatKosten({ model: "gpt-9000", inputTokens: 5e3 }) === null && schatKosten({ model: null, outputTokens: 5 }) === null);
  check("onbekend model zonder tokens maar met webzoekacties: alleen de zoekprijs", schatKosten({ model: "nieuw-model", webZoekAanroepen: 100 }) === Math.round(1 * r * 1e4) / 1e4);
  check("rommel telt als 0", schatKosten({ model: "gpt-5.5", inputTokens: -5, outputTokens: NaN, webZoekAanroepen: "veel" }) === 0);
  check("prijslijst heeft een controledatum en een bron", /^\d{4}-\d{2}-\d{2}$/.test(PRIJZEN.gecontroleerdOp) && PRIJZEN.usdNaarEur > 0.5 && PRIJZEN.usdNaarEur < 1.5);
}
sectie("2. Tokens uit beide soorten usage-objecten");
{
  gelijk("Chat Completions", tokensUitUsage({ prompt_tokens: 120, completion_tokens: 30 }), { input: 120, output: 30, gecachte: 0 });
  gelijk("Responses API met cache", tokensUitUsage({ input_tokens: 500, output_tokens: 70, input_tokens_details: { cached_tokens: 200 } }), { input: 500, output: 70, gecachte: 200 });
  gelijk("null en rommel", [tokensUitUsage(null), tokensUitUsage("x"), tokensUitUsage({ input_tokens: "abc" })], [{ input: 0, output: 0, gecachte: 0 }, { input: 0, output: 0, gecachte: 0 }, { input: 0, output: 0, gecachte: 0 }]);
}
sectie("3. Rij: alleen toegestane velden, nooit inhoud");
{
  const rij = bouwGebruikRij({ ...BASIS, projectId: P, model: "gpt-5.5", inputTokens: 1e3, outputTokens: 200, webZoekAanroepen: 3, externePaginas: 2, verificatiePaginas: 2, cacheHits: 1, duurMs: 4321, succes: true });
  gelijk("exacte kolommen", Object.keys(rij).sort(), ["action_type", "cache_hits", "duration_ms", "estimated_cost_eur", "external_page_fetches", "input_tokens", "model", "output_tokens", "project_id", "success", "tier", "user_id", "verification_pages", "web_search_calls"]);
  check("waarden", rij.user_id === U && rij.tier === "pro" && rij.action_type === "chat" && rij.project_id === P && rij.input_tokens === 1e3 && rij.web_search_calls === 3 && rij.duration_ms === 4321 && rij.success === true);
  check("kosten worden geschat uit model, tokens en zoekacties", rij.estimated_cost_eur === schatKosten({ model: "gpt-5.5", inputTokens: 1e3, outputTokens: 200, webZoekAanroepen: 3 }) && rij.estimated_cost_eur > 0);
  const geheim = bouwGebruikRij({ ...BASIS, prompt: "GEHEIME PROMPT", content: "chattekst", url: "https://x.example/", zoekopdracht: "fonds voor jongeren", documenten: ["a.pdf"], email: "a@b.nl", bericht: { role: "user" } });
  check("extra velden (prompt, tekst, url, zoekopdracht, e-mail) vallen af", !/GEHEIME|chattekst|example|jongeren|a\.pdf|a@b|role/.test(JSON.stringify(geheim)));
  check("model wordt afgekapt op 60 tekens", bouwGebruikRij({ ...BASIS, model: "m".repeat(500) }).model.length === 60);
  check("ontbrekende velden worden 0 of null, success standaard waar", (() => {
    const r = bouwGebruikRij(BASIS);
    return r.input_tokens === 0 && r.model === null && r.project_id === null && r.estimated_cost_eur === 0 && r.success === true;
  })());
  check("succes false blijft false", bouwGebruikRij({ ...BASIS, succes: false }).success === false);
  check("negatieve, NaN en gigantische tellers worden begrensd", (() => {
    const r = bouwGebruikRij({ ...BASIS, inputTokens: -1, outputTokens: NaN, webZoekAanroepen: 1e12, duurMs: Infinity });
    return r.input_tokens === 0 && r.output_tokens === 0 && r.web_search_calls === 1e4 && r.duration_ms === 0;
  })());
  check("ongeldig project-id wordt null", bouwGebruikRij({ ...BASIS, projectId: "niet-een-uuid" }).project_id === null);
  check("hoofdletters in uuid worden klein", bouwGebruikRij({ ...BASIS, userId: U.toUpperCase() }).user_id === U);
  for (const [naam, inv] of [
    ["geen gebruiker", { ...BASIS, userId: null }],
    ["ongeldige gebruiker", { ...BASIS, userId: "x" }],
    ["onbekende tier", { ...BASIS, tier: "enterprise" }],
    ["tier in hoofdletters", { ...BASIS, tier: "PRO" }],
    ["onbekende actie", { ...BASIS, actie: "iets_anders" }],
    ["geen invoer", null],
    ["leeg", {}]
  ]) check(`ongeldig: ${naam} geeft geen rij`, bouwGebruikRij(inv) === null);
  check("alle actietypen uit de wens zijn aanwezig", ["chat", "fonds_scan_database", "fonds_scan_web", "proposal_preview", "source_verification", "document_generation", "project_advice"].every((a) => ACTIE_TYPES.includes(a)));
  check("elk actietype levert een rij", ACTIE_TYPES.every((a) => bouwGebruikRij({ ...BASIS, actie: a })?.action_type === a));
  check("tier admin is toegestaan", bouwGebruikRij({ ...BASIS, tier: "admin" })?.tier === "admin");
}
sectie("4. Wegschrijven faalt altijd stil");
{
  const opgeslagen = [];
  const goed = { from: (t) => ({ insert: async (r) => {
    opgeslagen.push([t, r]);
    return { error: null };
  } }) };
  check("schrijft naar de juiste tabel", await legGebruik(goed, BASIS) === true && opgeslagen[0][0] === GEBRUIK_TABEL && opgeslagen[0][1].user_id === U);
  check("ongeldige invoer: niets geschreven, geen fout", await legGebruik(goed, { ...BASIS, tier: "x" }) === false && opgeslagen.length === 1);
  const origineel = console.error;
  const logs = [];
  console.error = (...a) => logs.push(a.join(" "));
  const slecht = [
    { from: () => ({ insert: async () => ({ error: { message: 'relation "kompas_gebruik_log" does not exist', code: "42P01" } }) }) },
    { from: () => ({ insert: async () => {
      throw new Error("netwerk geheim");
    } }) },
    { from: () => {
      throw new Error("kapot");
    } },
    null,
    void 0,
    {},
    { from: 5 }
  ];
  for (const [i, a] of slecht.entries()) check(`foutscenario ${i}: geeft false, gooit niet`, await legGebruik(a, BASIS).catch(() => "GOOIDE") === false);
  console.error = origineel;
  check("logregels bevatten geen foutdetails of gebruikersgegevens", logs.every((l) => /^\[subsidie-kompas\] gebruik_vastleggen_(mislukt|fout)$/.test(l)) && !logs.join().includes(U) && !logs.join().includes("geheim"));
}
sectie("5. Statische contracten: wiring, privacy en migratie");
{
  const index = readFileSync("supabase/functions/subsidie-kompas/index.ts", "utf8");
  const log = readFileSync("supabase/functions/_shared/gebruikLog.ts", "utf8");
  const sql = readFileSync("supabase/voorstel-niet-uitgevoerd/20261015120000_kompas_gebruik_log.sql", "utf8");
  const rollback = readFileSync("supabase/voorstel-niet-uitgevoerd/20261015120000_kompas_gebruik_log_rollback.sql", "utf8");
  const nietZonderCommentaar = (t) => t.replace(/\/\/.*$/gm, "").replace(/^\s*--.*$/gm, "");
  check("index.ts laadt gebruikLog alleen dynamisch (opstart verandert niet)", /await import\('\.\.\/_shared\/gebruikLog\.ts'\)/.test(index) && !/^import .*gebruikLog/m.test(index));
  check("alle bestaande verbruikspunten melden ook aan de meter (9 + 3 van het genereren van een voorstel + 1 van de broncontrole + 1 van het zoekprofiel + 1 van de werkgebiedverfijning + 1 van de AI-beoordeling)", (index.match(/await meldGebruik\(admin,/g) || []).length === 16, String((index.match(/await meldGebruik\(admin,/g) || []).length));
  check("de bestaande legVerbruikVast-aanroepen zijn ongewijzigd aanwezig", (index.match(/await legVerbruikVast\(admin,/g) || []).length === 8);
  check("de meter wordt nooit afgewacht met een foutpad (alleen binnen meldGebruik met try/catch)", /async function meldGebruik[\s\S]*?try \{[\s\S]*?\} catch \(_\) \{/.test(index));
  check("geen enkele meldGebruik-aanroep geeft tekst, bericht of url mee", !/meldGebruik\(admin, \{[^}]*(berichten|tekst|prompt|content|url|query|text)/.test(index));
  check("gebruikLog heeft geen netwerk en leest geen omgeving", !/\bfetch\(|Deno\.|process\.env/.test(nietZonderCommentaar(log)));
  check("gebruikLog schrijft naar precies \xE9\xE9n tabel", (nietZonderCommentaar(log).match(/\.from\(/g) || []).length === 1 && log.includes("'kompas_gebruik_log'"));
  check("migratie: RLS aan en alle rechten voor leden ingetrokken", /enable row level security/.test(sql) && /revoke all on table public\.kompas_gebruik_log from public, anon, authenticated/.test(sql));
  check("migratie: geen enkele policy", !/create policy/i.test(sql));
  check("migratie: alleen service_role mag schrijven en lezen", /grant select, insert on table public\.kompas_gebruik_log to service_role/.test(sql) && !/grant [^;]*(update|delete)[^;]*kompas_gebruik_log/i.test(sql));
  check("migratie: beide admin-RPC's eisen current_user_is_admin()", (nietZonderCommentaar(sql).match(/current_user_is_admin\(\)/g) || []).length === 2 && (nietZonderCommentaar(sql).match(/security definer/g) || []).length === 2 && (nietZonderCommentaar(sql).match(/set search_path = public, pg_temp/g) || []).length === 2);
  check("migratie: geen kolom voor inhoud (prompt, tekst, url, bericht, query)", !/\b(prompt|content|tekst|message|url|query|body)\b[^,\n]*(text|jsonb|varchar)/i.test(sql.replace(/--.*$/gm, "")));
  check("migratie: observatiebudgetten staan niet in SQL (\xE9\xE9n bron: tierConfig)", !/\b(7|14)(\.0+)?\b[^\n]*(budget|pro|premium)|(budget|pro|premium)[^\n]*\b(7|14)(\.0+)?\b/i.test(sql.replace(/--.*$/gm, "")));
  check("migratie: actietypen niet vastgezet in een CHECK (centraal uitbreidbaar)", !/action_type[^\n]*\bin \(/i.test(sql.replace(/--.*$/gm, "")));
  check("migratie staat bij de niet-uitgevoerde voorstellen, niet in migrations/", !readFileSync("supabase/migrations/README.md", "utf8").includes("kompas_gebruik_log"));
  check("rollback verwijdert tabel en functies", /drop table if exists public\.kompas_gebruik_log/.test(rollback) && (rollback.match(/drop function if exists/g) || []).length === 2);
  check("observatiebudgetten Pro 7 en Premium 14 komen uit tierConfig", tierConfigVoor("pro").maandBudgetObservatieEur === 7 && tierConfigVoor("premium").maandBudgetObservatieEur === 14);
  check("niets in de code gebruikt het budget om te blokkeren of af te remmen", !/maandBudgetObservatieEur/.test(nietZonderCommentaar(index)) && !/maandBudgetObservatieEur/.test(nietZonderCommentaar(log)));
}
klaar("gebruik");
