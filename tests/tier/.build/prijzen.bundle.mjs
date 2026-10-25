// tests/tier/prijzen.test.mjs
import { readFileSync } from "node:fs";

// src/data/abonnementen.js
var LOOPTIJDEN = ["MAAND", "HALFJAAR", "JAAR"];
var LOOPTIJD_INFO = {
  MAAND: { code: "MAAND", maanden: 1, label: "Maandelijks", kort: "Maand", periode: "per maand", duur: "1 maand" },
  HALFJAAR: { code: "HALFJAAR", maanden: 6, label: "Per half jaar", kort: "Half jaar", periode: "per half jaar", duur: "6 maanden" },
  JAAR: { code: "JAAR", maanden: 12, label: "Per jaar", kort: "Jaar", periode: "per jaar", duur: "12 maanden" }
};
var PRIJS_PER_MAAND_CENT = {
  pro: { MAAND: 4e3, HALFJAAR: 3500, JAAR: 3200 },
  premium: { MAAND: 7500, HALFJAAR: 6500, JAAR: 6e3 }
};
function isGeldigeLooptijd(code) {
  return typeof code === "string" && Object.prototype.hasOwnProperty.call(LOOPTIJD_INFO, code);
}
function geldig(tier, looptijd) {
  return (tier === "pro" || tier === "premium") && isGeldigeLooptijd(looptijd);
}
function formatEuro(cent) {
  const n = Number(cent);
  if (!Number.isFinite(n)) {
    return "";
  }
  const euro = n / 100;
  return `\u20AC${Number.isInteger(euro) ? String(euro) : euro.toFixed(2).replace(".", ",")}`;
}
function prijsPerMaandCent(tier, looptijd) {
  return geldig(tier, looptijd) ? PRIJS_PER_MAAND_CENT[tier][looptijd] : null;
}
function maandPrijsCent(tier) {
  return prijsPerMaandCent(tier, "MAAND");
}
function totaalCent(tier, looptijd) {
  return geldig(tier, looptijd) ? PRIJS_PER_MAAND_CENT[tier][looptijd] * LOOPTIJD_INFO[looptijd].maanden : null;
}
function besparingCent(tier, looptijd) {
  return geldig(tier, looptijd) ? PRIJS_PER_MAAND_CENT[tier].MAAND * LOOPTIJD_INFO[looptijd].maanden - totaalCent(tier, looptijd) : null;
}
function besparingPercentage(tier, looptijd) {
  if (!geldig(tier, looptijd)) {
    return null;
  }
  const maand = PRIJS_PER_MAAND_CENT[tier].MAAND;
  return Math.floor((maand - PRIJS_PER_MAAND_CENT[tier][looptijd]) / maand * 100);
}
function proefMogelijk(looptijd) {
  return LOOPTIJDEN.includes(looptijd);
}
function prijsInfo(tier, looptijd) {
  if (!geldig(tier, looptijd)) {
    return null;
  }
  const info = LOOPTIJD_INFO[looptijd];
  const vooruit = looptijd !== "MAAND";
  return {
    tier,
    looptijd,
    label: info.label,
    periode: info.periode,
    duur: info.duur,
    maanden: info.maanden,
    vooruit,
    perMaand: formatEuro(prijsPerMaandCent(tier, looptijd)),
    totaal: formatEuro(totaalCent(tier, looptijd)),
    maandPrijs: formatEuro(maandPrijsCent(tier)),
    besparing: vooruit ? formatEuro(besparingCent(tier, looptijd)) : "",
    besparingPercentage: vooruit ? besparingPercentage(tier, looptijd) : 0,
    proef: proefMogelijk(looptijd)
  };
}
var ABONNEMENTEN = {
  pro: {
    tier: "pro",
    naam: "Pro",
    prijsTekst: `${formatEuro(maandPrijsCent("pro"))} per maand`,
    proefDuur: "7 dagen",
    kenmerken: [
      "Fondsmatching met passende fondsen en regelingen",
      "Sluitende begroting, dekkingsplan en actieplan per project",
      "1 projectplan genereren per maand",
      "6 aanvragen beoordelen per maand"
    ]
  },
  premium: {
    tier: "premium",
    naam: "Premium",
    prijsTekst: `${formatEuro(maandPrijsCent("premium"))} per maand`,
    proefDuur: "24 uur",
    // 'fondsendatabase' is een plaatshouder: de website zet hier het aantal fondsen in.
    kenmerken: [
      "Alles uit Pro",
      "fondsendatabase",
      "3 projectplannen genereren per maand",
      "10 aanvragen beoordelen per maand"
    ]
  }
};

// tests/verificatie/hulp.mjs
var stand = { ok: 0, fout: 0, naam: "" };
var check = (naam, waar, detail = "") => {
  if (waar) stand.ok += 1;
  else {
    stand.fout += 1;
    console.log(`  FAIL: ${stand.naam}: ${naam} ${detail}`);
  }
};
var sectie = (t) => console.log(`
== ${t}`);
var klaar = (naam) => {
  console.log(`
${naam}: ${stand.ok} OK, ${stand.fout} FAIL`);
  process.exit(stand.fout ? 1 : 0);
};
var enc = new TextEncoder();

// tests/tier/prijzen.test.mjs
stand.naam = "prijzen";
var lees = (p) => readFileSync(p, "utf8");
var hoeHet = lees("src/features/kompas-marketing/HoeHetWerktPage.jsx");
var faq = lees("src/features/kompas-marketing/faqContent.jsx");
var checkout = lees("supabase/functions/create-checkout-session/index.ts");
sectie("1. Weergave");
{
  check("abonnementen.js: Pro \u20AC40, Premium \u20AC75 per maand", ABONNEMENTEN.pro.prijsTekst === "\u20AC40 per maand" && ABONNEMENTEN.premium.prijsTekst === "\u20AC75 per maand");
  check("proefperioden ongewijzigd (7 dagen / 24 uur)", ABONNEMENTEN.pro.proefDuur === "7 dagen" && ABONNEMENTEN.premium.proefDuur === "24 uur");
  check("plannenoverzicht: \u20AC0 vast, Pro en Premium uit de prijsconfiguratie (geen eigen bedragen in de pagina)", /prijs: '€0'/.test(hoeHet) && !/prijs: '€\d+'(?!.*€0)/.test(hoeHet.replace(/prijs: '€0'/, "")) && /prijsInfo\(plan\.tier, looptijd\)/.test(hoeHet));
  check("FAQ: prijzen uit de configuratie, vraag over de Premium-prijs en over vooruitbetalen", faq.includes("prijsInfo") && faq.includes("Pro (${MAAND_PRO} per maand)") && faq.includes("Premium (${MAAND_PREMIUM} per maand)") && faq.includes("Kan ik korting krijgen door vooruit te betalen?"));
  check("de maandprijzen in de FAQ-bron zijn \u20AC40 en \u20AC75", prijsInfo("pro", "MAAND").perMaand === "\u20AC40" && prijsInfo("premium", "MAAND").perMaand === "\u20AC75");
  check("geen vaste oude bedragen (\u20AC35 / \u20AC70) meer als maandprijs in FAQ en plannenoverzicht", !/per maand\)?'?[^\n]*€(35|70)\b/.test(faq) && !/prijs: '€(35|70)'/.test(hoeHet));
}
sectie("2. Geen oude prijzen meer in de code");
{
  const bestanden = ["src/data/abonnementen.js", "src/features/kompas-marketing/HoeHetWerktPage.jsx", "src/features/kompas-marketing/faqContent.jsx", "src/features/kompas-marketing/AbonnerenPage.jsx", "src/features/website/JuridischePaginas.jsx", "src/features/kompas-app/AccountPage.jsx", "supabase/functions/create-checkout-session/index.ts", "supabase/functions/stripe-webhook/index.ts"];
  for (const b of bestanden) {
    const t = lees(b);
    check(`${b}: geen \u20AC12 of \u20AC39 meer`, !/€ ?(12|39)(?![\d.,])/.test(t) && !/\bEUR (12|39)\b/.test(t) && !/bedragCent: (1200|3900)\b/.test(t));
  }
}
sectie("3. Serverkant van de checkout");
{
  check("checkout verwacht 4000 en 7500 cent (de maandprijs)", /PRO: \{[^}]*bedragCent: 4000/.test(checkout) && /PREMIUM: \{[^}]*bedragCent: 7500/.test(checkout));
  check("checkout weigert vooruitbetalen (fail closed) zolang de server dat niet kent", /looptijd_niet_beschikbaar/.test(checkout) && /invoer\.looptijd !== 'MAAND'/.test(checkout));
  check("de looptijd bepaalt in de checkout geen bedrag (alleen MAAND wordt afgerekend)", !/KWARTAAL.*bedragCent|bedragCent.*KWARTAAL/.test(checkout));
  check("checkout vergelijkt het Stripe-bedrag nog steeds met die verwachting (verkeerde prijs = geen checkout)", /price\.unit_amount !== planConfig\.bedragCent/.test(checkout));
  check("de client kan nog steeds geen bedrag of price-id sturen", /bedragCent/.test(checkout) && !/body\.(bedrag|price|amount)/i.test(checkout));
  check("weergave en server zijn gelijk (\u20AC40 = 4000, \u20AC75 = 7500)", ABONNEMENTEN.pro.prijsTekst.startsWith("\u20AC40") && ABONNEMENTEN.premium.prijsTekst.startsWith("\u20AC75"));
  check("alle vier de looptijden hebben een prijs voor beide tiers", LOOPTIJDEN.every((l) => prijsInfo("pro", l) && prijsInfo("premium", l)));
}
klaar("prijzen");
