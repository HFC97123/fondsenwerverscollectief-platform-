// tests/tier/tierconfig.test.mjs
import { readFileSync } from "node:fs";

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
function tierMagRecord(config, accessTier) {
  return (accessTier === "free" || accessTier === "pro" || accessTier === "premium") && config.toegestaneAccessTiers.includes(accessTier);
}
function alleTierConfigs() {
  return [CONFIGS.free, CONFIGS.pro, CONFIGS.premium];
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

// tests/tier/tierconfig.test.mjs
stand.naam = "tierconfig";
sectie("1. Welke tier krijgt welke configuratie (fail closed)");
{
  gelijk("pro", tierConfigVoor("pro").tier, "pro");
  gelijk("premium", tierConfigVoor("premium").tier, "premium");
  gelijk("free", tierConfigVoor("free").tier, "free");
  for (const x of [void 0, null, "", "PRO", "Premium", "admin", 0, {}, [], "enterprise"]) {
    check(`onbekende waarde ${JSON.stringify(x)} valt op free`, tierConfigVoor(x).tier === "free");
  }
  check("admin krijgt de Premium-regels", tierConfigVoor("free", true).tier === "premium");
  check("isAdmin moet precies true zijn", tierConfigVoor("free", "true").tier === "free" && tierConfigVoor("pro", 1).tier === "pro");
  check("configuraties zijn bevroren (geen runtime-wijziging)", (() => {
    try {
      "use strict";
      tierConfigVoor("pro").dekkingsdoel = 5;
    } catch {
    }
    return tierConfigVoor("pro").dekkingsdoel === 1.2;
  })());
}
sectie("2. Productregels: Pro ziet geen Premium-records, Premium ziet alles");
{
  const pro = tierConfigVoor("pro");
  const premium = tierConfigVoor("premium");
  const free = tierConfigVoor("free");
  check("Pro: free en pro ja", tierMagRecord(pro, "free") && tierMagRecord(pro, "pro"));
  check("Pro: premium NEE", !tierMagRecord(pro, "premium"));
  check("Premium: alle drie", ["free", "pro", "premium"].every((t) => tierMagRecord(premium, t)));
  check("Free: alleen free en geen dekkingsplan", tierMagRecord(free, "free") && !tierMagRecord(free, "pro") && !tierMagRecord(free, "premium") && free.dekkingsplan === false);
  for (const config of alleTierConfigs()) {
    for (const x of [void 0, null, "", "Premium", "PRO", "gold", 1, {}, ["premium"]]) {
      check(`${config.tier}: onbekende access_tier ${JSON.stringify(x)} is nooit toegestaan`, !tierMagRecord(config, x));
    }
  }
  const sql = (access, tier) => access === "free" || access === "pro" && (tier === "pro" || tier === "premium") || access === "premium" && tier === "premium";
  for (const tier of ["free", "pro", "premium"]) {
    for (const access of ["free", "pro", "premium"]) {
      check(`pariteit met subsidie_zichtbaar_voor_tier: ${tier} x ${access}`, tierMagRecord(tierConfigVoor(tier), access) === sql(access, tier));
    }
  }
}
sectie("3. Pro en Premium verschillen alleen in pool, dekkingsdoel en online ruimte, niet in kwaliteit");
{
  const pro = tierConfigVoor("pro");
  const premium = tierConfigVoor("premium");
  check("dekkingsdoel: Pro 120%, Premium 160%", pro.dekkingsdoel === 1.2 && premium.dekkingsdoel === 1.6);
  check("zelfde minimumscore en zelfde maximaal aandeel per fonds; Pro 6 regels, Premium 9, drie alternatieven en rangschikking op bijdrage alleen bij Premium", pro.minScore === premium.minScore && pro.maxAandeelPerFonds === premium.maxAandeelPerFonds && pro.maxRegelsInMix === 6 && premium.maxRegelsInMix === 9 && pro.alternatieven === 3 && premium.alternatieven === 3 && tierConfigVoor("free").alternatieven === 0 && pro.rangschikOpBijdrage === false && premium.rangschikOpBijdrage === true && tierConfigVoor("free").rangschikOpBijdrage === false);
  check("mixgrootte past binnen het voorstelcontract (MAX_REGELS 12, plus \xE9\xE9n reserve)", pro.maxRegelsInMix + pro.alternatieven <= 12 && premium.maxRegelsInMix + premium.alternatieven <= 12);
  check("observatiebudget: Pro 7, Premium 14, Free geen", pro.maandBudgetObservatieEur === 7 && premium.maandBudgetObservatieEur === 14 && tierConfigVoor("free").maandBudgetObservatieEur === null);
  check("Premium online aanvullen: cap 5 per ronde; Pro heeft dit niet", premium.onlineAanvullen?.maxKandidaten === 5 && pro.onlineAanvullen === null);
  check("Premium online: doorzoeken tot 120% gedekt is: minstens 3 tonen, ori\xEBntatie 6, totaal maximum 10 (boven 6 als er te weinig fondsen zijn)", premium.onlineOrientatie.minTonen === 3 && premium.onlineOrientatie.maxKandidaten === 6 && premium.onlineOrientatie.totaalMax === 10);
  check("Pro heeft geen doorzoeken (vast kort lijstje: geen minTonen/totaalMax)", pro.onlineOrientatie.minTonen === void 0 && pro.onlineOrientatie.totaalMax === void 0);
  check("Premium-hint: alleen Pro", pro.premiumHint === true && premium.premiumHint === false && tierConfigVoor("free").premiumHint === false && tierConfigVoor("pro", true).premiumHint === false);
  check("Pro online ori\xEBntatie is kleiner dan die van Premium", pro.onlineOrientatie.maxKandidaten < premium.onlineOrientatie.maxKandidaten && pro.onlineOrientatie.timeoutMs < premium.onlineOrientatie.timeoutMs);
  check("Premium vult alle ontbrekende kernvelden aan, Pro alleen indien nodig", premium.aanvullenVelden === "alle-ontbrekende" && pro.aanvullenVelden === "indien-nodig");
}
sectie("4. Statisch: \xE9\xE9n bron, geen hardcoded tierlijsten of beveiliging in de configuratie");
{
  const bron = readFileSync("supabase/functions/_shared/tierConfig.ts", "utf8");
  check("geen netwerk, geen database, geen omgeving", !/\bfetch\(|Deno\.|process\.env|createClient|\.from\(|\.rpc\(/.test(bron));
  check("leest geen tier uit een request", !/Request|req\.|body\./.test(bron.replace(/\/\/.*$/gm, "")));
}
klaar("tierconfig");
