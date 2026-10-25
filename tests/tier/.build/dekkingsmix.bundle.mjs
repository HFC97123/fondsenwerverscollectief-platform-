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

// supabase/functions/_shared/werkgebied.ts
var TABEL = [
  ["West-Afrika", "Afrika", "Benin;Burkina Faso;Kaapverdi\xEB=Cabo Verde/Cape Verde;Ivoorkust=C\xF4te d'Ivoire/Cote d'Ivoire/Ivory Coast;Gambia;Ghana;Guinee=Guinea-Conakry;Guinee-Bissau=Guinea-Bissau;Liberia;Mali;Mauritani\xEB=Mauritania;Niger;Nigeria;Senegal;Sierra Leone;Togo"],
  ["Oost-Afrika", "Afrika", "Burundi;Comoren=Comoros;Djibouti;Eritrea;Ethiopi\xEB=Ethiopia;Kenia=Kenya;Madagaskar=Madagascar;Malawi;Mauritius;Mozambique;Rwanda;Seychellen=Seychelles;Somali\xEB=Somalia;Zuid-Soedan=South Sudan;Tanzania;Oeganda=Uganda;Zambia;Zimbabwe"],
  ["Centraal-Afrika", "Afrika", "Angola;Kameroen=Cameroon;Centraal-Afrikaanse Republiek=Central African Republic;Tsjaad=Chad;Congo-Brazzaville=Republic of the Congo;Democratische Republiek Congo=DR Congo/DRC/Congo-Kinshasa/Democratic Republic of the Congo;Equatoriaal-Guinea=Equatorial Guinea;Gabon;Sao Tom\xE9 en Principe=Sao Tome and Principe"],
  ["Zuidelijk Afrika", "Afrika", "Botswana;Eswatini=Swaziland;Lesotho;Namibi\xEB=Namibia;Zuid-Afrika=South Africa"],
  ["Noord-Afrika", "Afrika", "Algerije=Algeria;Egypte=Egypt;Libi\xEB=Libya;Marokko=Morocco;Soedan=Sudan;Tunesi\xEB=Tunisia"],
  ["Zuid-Azi\xEB", "Azi\xEB", "Afghanistan;Bangladesh;Bhutan;India;Malediven=Maldives;Nepal;Pakistan;Sri Lanka"],
  ["Zuidoost-Azi\xEB", "Azi\xEB", "Brunei;Cambodja=Cambodia;Indonesi\xEB=Indonesia;Laos;Maleisi\xEB=Malaysia;Myanmar=Birma/Burma;Filipijnen=Philippines;Singapore;Thailand;Oost-Timor=Timor-Leste/East Timor;Vietnam"],
  ["Oost-Azi\xEB", "Azi\xEB", "China;Japan;Mongoli\xEB=Mongolia;Noord-Korea=North Korea;Zuid-Korea=South Korea;Taiwan"],
  ["Centraal-Azi\xEB", "Azi\xEB", "Kazachstan=Kazakhstan;Kirgizi\xEB=Kyrgyzstan/Kirgizstan;Tadzjikistan=Tajikistan;Turkmenistan;Oezbekistan=Uzbekistan"],
  ["Midden-Oosten", "Azi\xEB", "Armeni\xEB=Armenia;Azerbeidzjan=Azerbaijan;Bahrein=Bahrain;Georgi\xEB=Georgia;Irak=Iraq;Iran;Isra\xEBl=Israel;Jordani\xEB=Jordan;Koeweit=Kuwait;Libanon=Lebanon;Oman;Palestina=Palestine/Palestijnse gebieden;Qatar;Saoedi-Arabi\xEB=Saudi Arabia;Syri\xEB=Syria;Turkije=Turkey/T\xFCrkiye;Verenigde Arabische Emiraten=VAE/UAE/United Arab Emirates;Jemen=Yemen"],
  ["West-Europa", "Europa", "Belgi\xEB=Belgium;Duitsland=Germany;Frankrijk=France;Ierland=Ireland;Luxemburg;Oostenrijk=Austria;Zwitserland=Switzerland;Verenigd Koninkrijk=VK/UK/United Kingdom/Engeland/England"],
  ["Noord-Europa", "Europa", "Denemarken=Denmark;Estland=Estonia;Finland;IJsland=Iceland;Letland=Latvia;Litouwen=Lithuania;Noorwegen=Norway;Zweden=Sweden"],
  ["Zuid-Europa", "Europa", "Albani\xEB=Albania;Bosni\xEB en Herzegovina=Bosnia;Griekenland=Greece;Itali\xEB=Italy;Kosovo;Kroati\xEB=Croatia;Malta;Montenegro;Noord-Macedoni\xEB=North Macedonia;Portugal;Servi\xEB=Serbia;Sloveni\xEB=Slovenia;Spanje=Spain;Cyprus"],
  ["Oost-Europa", "Europa", "Belarus=Wit-Rusland;Bulgarije=Bulgaria;Hongarije=Hungary;Moldavi\xEB=Moldova;Oekra\xEFne=Ukraine;Polen=Poland;Roemeni\xEB=Romania;Rusland=Russia;Slowakije=Slovakia;Tsjechi\xEB=Czechia/Czech Republic"],
  ["Noord-Amerika", "Noord-Amerika", "Canada;Verenigde Staten=VS/USA/United States/Amerika"],
  ["Midden-Amerika", "Midden-Amerika", "Belize;Costa Rica;El Salvador;Guatemala;Honduras;Mexico;Nicaragua;Panama"],
  ["Caribisch gebied", "Caribisch gebied", "Antigua en Barbuda;Bahama's=Bahamas;Barbados;Cuba;Dominica;Dominicaanse Republiek=Dominican Republic;Grenada;Ha\xEFti=Haiti;Jamaica;Saint Kitts en Nevis;Saint Lucia;Saint Vincent en de Grenadines;Trinidad en Tobago=Trinidad and Tobago"],
  ["Zuid-Amerika", "Zuid-Amerika", "Argentini\xEB=Argentina;Bolivia;Brazili\xEB=Brazil;Chili=Chile;Colombia;Ecuador;Guyana;Paraguay;Peru;Suriname;Uruguay;Venezuela"],
  ["Oceani\xEB", "Oceani\xEB", "Australi\xEB=Australia;Nieuw-Zeeland=New Zealand;Fiji;Papoea-Nieuw-Guinea=Papua New Guinea;Samoa;Tonga;Vanuatu;Salomonseilanden=Solomon Islands;Kiribati;Micronesi\xEB=Micronesia;Tuvalu"]
];
var KONINKRIJK = "Aruba;Cura\xE7ao=Curacao;Sint Maarten;Bonaire;Sint Eustatius;Saba";
var LDC = ["Afghanistan", "Angola", "Bangladesh", "Benin", "Burkina Faso", "Burundi", "Cambodja", "Centraal-Afrikaanse Republiek", "Tsjaad", "Comoren", "Democratische Republiek Congo", "Djibouti", "Eritrea", "Ethiopi\xEB", "Gambia", "Guinee", "Guinee-Bissau", "Ha\xEFti", "Kiribati", "Laos", "Lesotho", "Liberia", "Madagaskar", "Malawi", "Mali", "Mauritani\xEB", "Mozambique", "Myanmar", "Nepal", "Niger", "Rwanda", "Sao Tom\xE9 en Principe", "Senegal", "Sierra Leone", "Salomonseilanden", "Somali\xEB", "Zuid-Soedan", "Soedan", "Oost-Timor", "Togo", "Tuvalu", "Oeganda", "Tanzania", "Jemen", "Zambia"];
var GEEN_ONTWIKKELINGSLAND = ["Belgi\xEB", "Duitsland", "Frankrijk", "Ierland", "Luxemburg", "Oostenrijk", "Zwitserland", "Verenigd Koninkrijk", "Denemarken", "Estland", "Finland", "IJsland", "Letland", "Litouwen", "Noorwegen", "Zweden", "Griekenland", "Itali\xEB", "Kroati\xEB", "Malta", "Portugal", "Sloveni\xEB", "Spanje", "Cyprus", "Bulgarije", "Hongarije", "Polen", "Roemeni\xEB", "Rusland", "Slowakije", "Tsjechi\xEB", "Canada", "Verenigde Staten", "Japan", "Zuid-Korea", "Taiwan", "Singapore", "Brunei", "Isra\xEBl", "Qatar", "Koeweit", "Saoedi-Arabi\xEB", "Verenigde Arabische Emiraten", "Bahrein", "Oman", "Australi\xEB", "Nieuw-Zeeland", "Chili", "Uruguay", "Bahama's", "Barbados", "Trinidad en Tobago", "Antigua en Barbuda", "Saint Kitts en Nevis", "Seychellen"];
var ISO = {
  "Benin": "BJ",
  "Burkina Faso": "BF",
  "Kaapverdi\xEB": "CV",
  "Ivoorkust": "CI",
  "Gambia": "GM",
  "Ghana": "GH",
  "Guinee": "GN",
  "Guinee-Bissau": "GW",
  "Liberia": "LR",
  "Mali": "ML",
  "Mauritani\xEB": "MR",
  "Niger": "NE",
  "Nigeria": "NG",
  "Senegal": "SN",
  "Sierra Leone": "SL",
  "Togo": "TG",
  "Burundi": "BI",
  "Comoren": "KM",
  "Djibouti": "DJ",
  "Eritrea": "ER",
  "Ethiopi\xEB": "ET",
  "Kenia": "KE",
  "Madagaskar": "MG",
  "Malawi": "MW",
  "Mauritius": "MU",
  "Mozambique": "MZ",
  "Rwanda": "RW",
  "Seychellen": "SC",
  "Somali\xEB": "SO",
  "Zuid-Soedan": "SS",
  "Tanzania": "TZ",
  "Oeganda": "UG",
  "Zambia": "ZM",
  "Zimbabwe": "ZW",
  "Angola": "AO",
  "Kameroen": "CM",
  "Centraal-Afrikaanse Republiek": "CF",
  "Tsjaad": "TD",
  "Congo-Brazzaville": "CG",
  "Democratische Republiek Congo": "CD",
  "Equatoriaal-Guinea": "GQ",
  "Gabon": "GA",
  "Sao Tom\xE9 en Principe": "ST",
  "Botswana": "BW",
  "Eswatini": "SZ",
  "Lesotho": "LS",
  "Namibi\xEB": "NA",
  "Zuid-Afrika": "ZA",
  "Algerije": "DZ",
  "Egypte": "EG",
  "Libi\xEB": "LY",
  "Marokko": "MA",
  "Soedan": "SD",
  "Tunesi\xEB": "TN",
  "Afghanistan": "AF",
  "Bangladesh": "BD",
  "Bhutan": "BT",
  "India": "IN",
  "Malediven": "MV",
  "Nepal": "NP",
  "Pakistan": "PK",
  "Sri Lanka": "LK",
  "Brunei": "BN",
  "Cambodja": "KH",
  "Indonesi\xEB": "ID",
  "Laos": "LA",
  "Maleisi\xEB": "MY",
  "Myanmar": "MM",
  "Filipijnen": "PH",
  "Singapore": "SG",
  "Thailand": "TH",
  "Oost-Timor": "TL",
  "Vietnam": "VN",
  "China": "CN",
  "Japan": "JP",
  "Mongoli\xEB": "MN",
  "Noord-Korea": "KP",
  "Zuid-Korea": "KR",
  "Taiwan": "TW",
  "Kazachstan": "KZ",
  "Kirgizi\xEB": "KG",
  "Tadzjikistan": "TJ",
  "Turkmenistan": "TM",
  "Oezbekistan": "UZ",
  "Armeni\xEB": "AM",
  "Azerbeidzjan": "AZ",
  "Bahrein": "BH",
  "Georgi\xEB": "GE",
  "Irak": "IQ",
  "Iran": "IR",
  "Isra\xEBl": "IL",
  "Jordani\xEB": "JO",
  "Koeweit": "KW",
  "Libanon": "LB",
  "Oman": "OM",
  "Palestina": "PS",
  "Qatar": "QA",
  "Saoedi-Arabi\xEB": "SA",
  "Syri\xEB": "SY",
  "Turkije": "TR",
  "Verenigde Arabische Emiraten": "AE",
  "Jemen": "YE",
  "Belgi\xEB": "BE",
  "Duitsland": "DE",
  "Frankrijk": "FR",
  "Ierland": "IE",
  "Luxemburg": "LU",
  "Oostenrijk": "AT",
  "Zwitserland": "CH",
  "Verenigd Koninkrijk": "GB",
  "Denemarken": "DK",
  "Estland": "EE",
  "Finland": "FI",
  "IJsland": "IS",
  "Letland": "LV",
  "Litouwen": "LT",
  "Noorwegen": "NO",
  "Zweden": "SE",
  "Albani\xEB": "AL",
  "Bosni\xEB en Herzegovina": "BA",
  "Griekenland": "GR",
  "Itali\xEB": "IT",
  "Kosovo": "XK",
  "Kroati\xEB": "HR",
  "Malta": "MT",
  "Montenegro": "ME",
  "Noord-Macedoni\xEB": "MK",
  "Portugal": "PT",
  "Servi\xEB": "RS",
  "Sloveni\xEB": "SI",
  "Spanje": "ES",
  "Cyprus": "CY",
  "Belarus": "BY",
  "Bulgarije": "BG",
  "Hongarije": "HU",
  "Moldavi\xEB": "MD",
  "Oekra\xEFne": "UA",
  "Polen": "PL",
  "Roemeni\xEB": "RO",
  "Rusland": "RU",
  "Slowakije": "SK",
  "Tsjechi\xEB": "CZ",
  "Canada": "CA",
  "Verenigde Staten": "US",
  "Belize": "BZ",
  "Costa Rica": "CR",
  "El Salvador": "SV",
  "Guatemala": "GT",
  "Honduras": "HN",
  "Mexico": "MX",
  "Nicaragua": "NI",
  "Panama": "PA",
  "Antigua en Barbuda": "AG",
  "Bahama's": "BS",
  "Barbados": "BB",
  "Cuba": "CU",
  "Dominica": "DM",
  "Dominicaanse Republiek": "DO",
  "Grenada": "GD",
  "Ha\xEFti": "HT",
  "Jamaica": "JM",
  "Saint Kitts en Nevis": "KN",
  "Saint Lucia": "LC",
  "Saint Vincent en de Grenadines": "VC",
  "Trinidad en Tobago": "TT",
  "Argentini\xEB": "AR",
  "Bolivia": "BO",
  "Brazili\xEB": "BR",
  "Chili": "CL",
  "Colombia": "CO",
  "Ecuador": "EC",
  "Guyana": "GY",
  "Paraguay": "PY",
  "Peru": "PE",
  "Suriname": "SR",
  "Uruguay": "UY",
  "Venezuela": "VE",
  "Australi\xEB": "AU",
  "Nieuw-Zeeland": "NZ",
  "Fiji": "FJ",
  "Papoea-Nieuw-Guinea": "PG",
  "Samoa": "WS",
  "Tonga": "TO",
  "Vanuatu": "VU",
  "Salomonseilanden": "SB",
  "Kiribati": "KI",
  "Micronesi\xEB": "FM",
  "Tuvalu": "TV",
  "Aruba": "AW",
  "Cura\xE7ao": "CW",
  "Sint Maarten": "SX",
  "Bonaire": "BQ",
  "Sint Eustatius": "BQ",
  "Saba": "BQ"
};
function normaliseer(t) {
  return String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’`´]/g, "'").toLowerCase().replace(/\s+/g, " ").trim();
}
var SUBSAHARA_UITZONDERING_NIET = /* @__PURE__ */ new Set(["noord-afrika"]);
var SUBSAHARA_TOEVOEGING = /* @__PURE__ */ new Set(["soedan"]);
var LANDEN = [];
var LAND_TERMEN = /* @__PURE__ */ new Map();
var LAND_REGELS = [];
function voegLandToe(spec, werelddeel, regio, koninkrijk = false) {
  const [naam, aliasTekst] = spec.split("=");
  const sleutel = normaliseer(naam);
  const land = {
    naam: naam.trim(),
    iso: ISO[naam.trim()] ?? "",
    werelddeel,
    regio,
    subSahara: werelddeel === "Afrika" && (!SUBSAHARA_UITZONDERING_NIET.has(normaliseer(regio)) || SUBSAHARA_TOEVOEGING.has(sleutel)),
    ldc: false,
    ontwikkelingsland: !koninkrijk,
    koninkrijk
  };
  LANDEN.push(land);
  LAND_TERMEN.set(sleutel, land);
  const termen = [sleutel];
  for (const a of (aliasTekst || "").split("/")) {
    if (a.trim()) {
      LAND_TERMEN.set(normaliseer(a), land);
      termen.push(normaliseer(a));
    }
  }
  LAND_REGELS.push({ naam: land.naam, iso: land.iso, termen });
}
for (const [regio, werelddeel, landen] of TABEL) for (const spec of landen.split(";")) voegLandToe(spec, werelddeel, regio);
for (const spec of KONINKRIJK.split(";")) voegLandToe(spec, "Caribisch gebied", "Caribisch gebied", true);
for (const l of LANDEN) {
  l.ldc = LDC.some((n) => normaliseer(n) === normaliseer(l.naam));
  if (GEEN_ONTWIKKELINGSLAND.some((n) => normaliseer(n) === normaliseer(l.naam))) l.ontwikkelingsland = false;
}
var TERMEN = [];
var voeg = (termen, doel) => termen.forEach((t) => TERMEN.push([normaliseer(t), doel]));
for (const [term, land] of LAND_TERMEN) TERMEN.push([term, { t: "land", land }]);
var regioDoel = (sleutel) => ({ t: "regio", naam: sleutel });
var werelddeelDoel = (sleutel) => ({ t: "werelddeel", naam: sleutel });
voeg(["west-afrika", "west afrika", "west africa", "west-africa", "westelijk afrika"], regioDoel("west-afrika"));
voeg(["oost-afrika", "oost afrika", "east africa", "east-africa"], regioDoel("oost-afrika"));
voeg(["centraal-afrika", "centraal afrika", "central africa", "midden-afrika"], regioDoel("centraal-afrika"));
voeg(["zuidelijk afrika", "zuidelijk-afrika", "southern africa", "zuid-afrikaanse regio"], regioDoel("zuidelijk afrika"));
voeg(["noord-afrika", "noord afrika", "north africa"], regioDoel("noord-afrika"));
voeg(["oost- en zuidelijk afrika", "eastern and southern africa"], regioDoel("oost- en zuidelijk afrika"));
voeg(["zuid-azie", "zuid azie", "south asia"], regioDoel("zuid-azie"));
voeg(["zuidoost-azie", "zuidoost azie", "south-east asia", "southeast asia", "south east asia"], regioDoel("zuidoost-azie"));
voeg(["oost-azie", "oost azie", "east asia"], regioDoel("oost-azie"));
voeg(["centraal-azie", "centraal azie", "central asia"], regioDoel("centraal-azie"));
voeg(["midden-oosten", "middle east", "mena"], regioDoel("midden-oosten"));
voeg(["west-europa", "western europe"], regioDoel("west-europa"));
voeg(["noord-europa", "northern europe"], regioDoel("noord-europa"));
voeg(["zuid-europa", "southern europe"], regioDoel("zuid-europa"));
voeg(["oost-europa", "eastern europe", "oost europa"], regioDoel("oost-europa"));
voeg(["midden-amerika", "central america"], regioDoel("midden-amerika"));
voeg(["zuid-amerika", "south america"], regioDoel("zuid-amerika"));
voeg(["noord-amerika", "north america"], regioDoel("noord-amerika"));
voeg(["caribisch gebied", "caribbean", "caraiben", "caribische regio"], regioDoel("caribisch gebied"));
voeg(["latijns-amerika", "latijns amerika", "latin america", "latin-america"], regioDoel("latijns-amerika"));
voeg(["oceanie", "oceania"], regioDoel("oceanie"));
voeg(["afrika", "africa", "afrikaanse landen", "afrikaans continent"], werelddeelDoel("afrika"));
voeg(["azie", "asia", "aziatische landen"], werelddeelDoel("azie"));
voeg(["europa", "europe", "europese landen"], werelddeelDoel("europa"));
voeg(
  [
    "ontwikkelingslanden",
    "ontwikkelingsland",
    "landen in ontwikkeling",
    "ontwikkelingslanden",
    "developing countries",
    "developing country",
    "derdewereldlanden",
    "derdewereldland",
    "derde wereld",
    "derde-wereld",
    "derde wereldlanden",
    "derde-wereldlanden",
    "derde wereldland",
    "low- and middle-income countries",
    "low and middle income countries",
    "lage- en middeninkomenslanden",
    "lage inkomenslanden",
    "lagere inkomenslanden",
    "lmic",
    "lmics",
    "global south",
    "zuidelijk halfrond",
    "het zuiden",
    "dac-landen",
    "dac landen",
    "dac-lijst",
    "dac list",
    "dac-list",
    "oda-landen",
    "oda landen",
    "oda-gerechtigde landen",
    "oda eligible",
    "oesco-dac",
    "oeso-dac",
    "zuidelijke landen",
    "arme landen",
    "derde wereld landen"
  ],
  { t: "klasse", klasse: "ontwikkelingslanden" }
);
voeg(["minst ontwikkelde landen", "least developed countries", "least developed", "ldc", "ldcs", "minst ontwikkelde"], { t: "klasse", klasse: "ldc" });
voeg(["sub-sahara", "sub sahara", "sub-saharan", "sub saharan", "subsahara", "sub-sahara afrika", "sub-saharaans", "sub-saharan africa", "ten zuiden van de sahara", "zuidelijk van de sahara"], { t: "klasse", klasse: "subsahara" });
voeg(
  ["wereldwijd", "wereld / internationaal", "wereld/internationaal", "internationaal", "worldwide", "global", "globaal", "overal ter wereld", "over de hele wereld", "buitenland", "alle landen", "ieder land", "elk land", "international", "internationale projecten", "in het buitenland"],
  { t: "wereld" }
);
voeg(["nederland", "landelijk", "binnen nederland", "the netherlands", "netherlands", "holland"], { t: "nl" });
voeg(["caribisch deel van het koninkrijk", "caribisch nederland", "caribische delen van het koninkrijk", "caribische koninkrijksdelen"], { t: "koninkrijk" });
var TERMEN_OP_LENGTE = [...TERMEN].sort((a, b) => b[0].length - a[0].length);
var TERM_DOEL = /* @__PURE__ */ new Map();
for (const [t, d] of TERMEN_OP_LENGTE) if (!TERM_DOEL.has(t)) TERM_DOEL.set(t, d);
var esc = (s) => s.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&");
var TERM_RE = new RegExp(`(?<![a-z0-9])(?:${[...TERM_DOEL.keys()].map(esc).join("|")})(?![a-z0-9])`, "g");

// supabase/functions/_shared/serviceclubs.ts
var OPTIONEEL_TEKST = "Optioneel te onderzoeken: een serviceclub (zoals Rotary, Lions of Kiwanis) is een wereldwijd netwerk met per land een landelijk hoofdorgaan en per regio veel zelfstandige clubs. Neem contact op met de club in uw regio die bij uw project past; elke club beslist zelf.";
var norm = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
var DOELGROEPEN_CLUBS = new Set(["kinderen", "vrouwen en meisjes", "gezinnen"].map(norm));
var THEMAS_CLUBS = new Set(["jeugd en kinderen", "noodhulp", "armoedebestrijding", "armoede/zelfredzaamheid", "zelfredzaamheid"].map(norm));
var GEEN_REGIONAAL = new Set(
  ["landelijk", "europa", "oost-europa", "wereld / internationaal", "afrika", "azie", "latijns-amerika", "zuid-amerika", "noord-amerika", "midden-oosten", "caribisch gebied", "caribisch deel van het koninkrijk", "belgie", "luxemburg", "brazilie"].map(norm)
);
var BUITENLAND_REGIOS = new Set(
  ["europa", "oost-europa", "wereld / internationaal", "afrika", "azie", "latijns-amerika", "zuid-amerika", "noord-amerika", "midden-oosten", "caribisch gebied", "caribisch deel van het koninkrijk", "belgie", "luxemburg", "brazilie"].map(norm)
);
var NEDERLAND_TERMEN = new Set(["nederland", "heel nederland", "landelijk", "in heel nederland", "door heel nederland"].map(norm));

// supabase/functions/_shared/dekkingsmix.ts
var getal = (x) => typeof x === "number" && Number.isFinite(x) && x >= 0 ? Math.round(x) : null;
function afrondStap(bedrag) {
  return bedrag < 5e3 ? 100 : bedrag < 5e4 ? 500 : 1e3;
}
var euro = (n) => `\u20AC ${n.toLocaleString("nl-NL")}`;
function bandOndergrens(naam) {
  if (typeof naam !== "string") return null;
  const getallen = Array.from(naam.matchAll(/\d{1,3}(?:\.\d{3})*/g)).map((m) => Number(m[0].replace(/\./g, ""))).filter((n) => Number.isFinite(n));
  if (!getallen.length) return null;
  return getallen[0] > 0 ? getallen[0] : getallen[1] ?? null;
}
function realistischBedrag(inv) {
  const gat = getal(inv.gat);
  const nodig = getal(inv.nodig);
  const min = getal(inv.min);
  const max = getal(inv.max);
  const bandOnder = getal(inv.bandOnder);
  const aandeel = typeof inv.maxAandeel === "number" && inv.maxAandeel > 0 && inv.maxAandeel <= 1 ? inv.maxAandeel : 0.5;
  const nee = (afwijsCode, uitleg2) => ({ bedrag: null, grond: null, afwijsCode, uitleg: uitleg2, indicatie: true });
  const laag = min !== null && min > 0 ? min : bandOnder !== null && bandOnder > 0 ? bandOnder : null;
  const uitBand = !(min !== null && min > 0) && laag !== null;
  if (gat === null || gat <= 0) return nee("geen-bedragen-bekend", "Er is geen financieringsgat om te dekken.");
  if (laag === null && (max === null || max <= 0)) return nee("geen-bedragen-bekend", "Bij deze financier zijn geen bijdragegrenzen bekend; er wordt geen bedrag geschat.");
  if (min !== null && max !== null && min > max) return nee("ongeldige-grenzen", "De bijdragegrenzen in de database zijn tegenstrijdig; er wordt geen bedrag geschat.");
  if (laag !== null && laag > gat) return nee("minimum-boven-gat", `${uitBand ? "De laagste waarde van de bandbreedte" : "Het minimum"} van deze financier (${euro(laag)}) is hoger dan het hele financieringsgat.`);
  const aandeelBedrag = Math.floor(gat * aandeel);
  const doelRest = nodig === null ? aandeelBedrag : nodig;
  let basis;
  let grond;
  if (laag !== null && max !== null && max > laag) {
    basis = laag + (max - laag) / 3;
    grond = "voorzichtig-laag";
  } else if (laag !== null) {
    basis = max !== null && max > 0 && max < laag ? max : laag;
    grond = uitBand ? "laagste-bandbreedte" : "fonds-minimum";
  } else {
    basis = max / 3;
    grond = "derde-van-maximum";
  }
  let bedrag = Math.floor(basis);
  if (bedrag > aandeelBedrag) {
    bedrag = aandeelBedrag;
    grond = "aandeel-van-gat";
  }
  if (bedrag > doelRest) {
    bedrag = doelRest;
    grond = "rest-tot-doel";
  }
  if (max !== null && max > 0 && bedrag > max) {
    bedrag = max;
    grond = "fonds-maximum";
  }
  if (laag !== null && bedrag < laag) {
    bedrag = laag;
    grond = uitBand ? "laagste-bandbreedte" : "fonds-minimum";
  }
  const stap = afrondStap(bedrag);
  const afgerond = Math.floor(bedrag / stap) * stap;
  bedrag = afgerond > 0 && (laag === null || afgerond >= laag) ? afgerond : bedrag;
  const bereik = laag !== null && max !== null && max > laag ? `${euro(laag)} tot ${euro(max)}` : null;
  const uitleg = grond === "voorzichtig-laag" ? `Een voorzichtig bedrag in het laagste deel van wat deze financier noemt (${bereik}); niet het maximum.` : grond === "laagste-bandbreedte" ? `Het laagste bedrag van de bandbreedte van deze financier (${euro(laag)}); de bandbreedte is een indicatie.` : grond === "derde-van-maximum" ? `Alleen een maximum is bekend (${euro(max)}); het voorstel is een derde daarvan.` : grond === "fonds-minimum" ? `Het minimum van deze financier (${euro(laag)}) bepaalt het voorstel.` : grond === "fonds-maximum" ? `Het maximum van deze financier (${euro(max)}) ligt onder de rekenbasis; het voorstel is dat maximum.` : grond === "rest-tot-doel" ? "Alleen wat nog nodig is om het dekkingsdoel te halen." : `Een voorzichtig aandeel (hoogstens ${Math.round(aandeel * 100)}%) van het financieringsgat; niet het maximum van de financier.`;
  return { bedrag, grond, afwijsCode: null, uitleg, indicatie: true };
}
var stap2 = (n) => Math.round(n * 100) / 100;
var BEDRAG_INDICATIE_REGEL = "Het bedrag is een inschatting (geen historische toekenningsdata): overleg met de donor of een aanvraag mogelijk is en hoe hoog die mag zijn.";
var MELDING_TE_WEINIG_STERKE_MATCHES = "Er zijn te weinig sterke, passende financiers gevonden om het financieringsgat realistisch volledig te dekken. Liever een kleiner plan met goede matches dan zwakke matches toevoegen om een percentage te halen.";
function filterGeschikt(kandidaten, config) {
  const afgewezen = [];
  const gezien = /* @__PURE__ */ new Set();
  const geschikt = [];
  for (const k2 of kandidaten || []) {
    if (!k2 || typeof k2.sleutel !== "string") continue;
    const afw = (code) => afgewezen.push({ sleutel: k2.sleutel, code });
    if (gezien.has(k2.sleutel)) {
      afw("dubbel");
      continue;
    }
    gezien.add(k2.sleutel);
    if (k2.niveau !== "volledig") {
      afw("niet-volledig-zichtbaar");
      continue;
    }
    if (!tierMagRecord(config, k2.accessTier)) {
      afw("tier-niet-toegestaan");
      continue;
    }
    if (k2.relevant !== true) {
      afw("niet-relevant");
      continue;
    }
    if (!(typeof k2.score === "number" && Number.isFinite(k2.score) && k2.score >= config.minScore)) {
      afw("score-te-laag");
      continue;
    }
    geschikt.push(k2);
  }
  return { geschikt, afgewezen };
}
function volgorde(a, b) {
  return (a.optioneel ? 1 : 0) - (b.optioneel ? 1 : 0) || b.score - a.score || a.naam.localeCompare(b.naam, "nl") || a.sleutel.localeCompare(b.sleutel);
}
function lokaalVoorrang(lijst, maxRegels) {
  const cap = Math.max(1, Math.floor(maxRegels / 3));
  const voor = new Set(lijst.filter((k2) => k2.lokaal === true && !k2.optioneel).slice(0, cap));
  return voor.size ? [...lijst.filter((k2) => voor.has(k2)), ...lijst.filter((k2) => !voor.has(k2))] : lijst;
}
var SCOREBAND = 10;
function selecteerDekkingsmix(inv) {
  const { config } = inv;
  const gat = getal(inv.gat) ?? 0;
  const doelBedrag = Math.ceil(Math.round(gat * config.dekkingsdoel * 100) / 100);
  const leeg = (uitkomst, melding = null) => ({ uitkomst, gat, doelBedrag, som: 0, dekking: 0, mix: [], reserve: null, reserves: [], afgewezen: [], melding });
  if (!config.dekkingsplan || config.maxRegelsInMix <= 0) return leeg("niet-beschikbaar");
  if (gat <= 0) return leeg("geen-gat");
  const { geschikt, afgewezen } = filterGeschikt(inv.kandidaten, config);
  if (!geschikt.length) return { ...leeg("geen-kandidaten", MELDING_TE_WEINIG_STERKE_MATCHES), afgewezen };
  if (config.rangschikOpBijdrage) {
    const potentieel = /* @__PURE__ */ new Map();
    for (const k2 of geschikt) potentieel.set(k2.sleutel, realistischBedrag({ gat, nodig: doelBedrag, min: k2.min, max: k2.max, bandOnder: bandOndergrens(k2.band), maxAandeel: config.maxAandeelPerFonds }).bedrag ?? 0);
    geschikt.sort(
      (a, b) => (a.optioneel ? 1 : 0) - (b.optioneel ? 1 : 0) || Math.floor(b.score / SCOREBAND) - Math.floor(a.score / SCOREBAND) || (potentieel.get(b.sleutel) ?? 0) - (potentieel.get(a.sleutel) ?? 0) || b.score - a.score || a.naam.localeCompare(b.naam, "nl") || a.sleutel.localeCompare(b.sleutel)
    );
  } else {
    geschikt.sort(volgorde);
  }
  geschikt.splice(0, geschikt.length, ...lokaalVoorrang(geschikt, config.maxRegelsInMix));
  const regelVan = (k2, b) => ({
    sleutel: k2.sleutel,
    type: k2.type,
    id: k2.id,
    naam: k2.naam,
    score: k2.score,
    bedrag: b.bedrag,
    grond: b.grond,
    uitleg: b.uitleg,
    ...k2.optioneel ? { optioneel: true } : {},
    onzekerheden: [
      ...k2.optioneel ? [OPTIONEEL_TEKST] : [],
      BEDRAG_INDICATIE_REGEL,
      ...k2.cofinanciering ? [`Cofinancieringseis (niet automatisch doorgerekend): ${String(k2.cofinanciering).slice(0, 200)}`] : []
    ]
  });
  const mix = [];
  const inMix = /* @__PURE__ */ new Set();
  let som2 = 0;
  for (const k2 of geschikt) {
    if (som2 >= doelBedrag) break;
    if (mix.length >= config.maxRegelsInMix) {
      afgewezen.push({ sleutel: k2.sleutel, code: "mix-vol" });
      continue;
    }
    const b = realistischBedrag({ gat, nodig: doelBedrag - som2, min: k2.min, max: k2.max, bandOnder: bandOndergrens(k2.band), maxAandeel: config.maxAandeelPerFonds });
    if (b.bedrag === null) {
      afgewezen.push({ sleutel: k2.sleutel, code: b.afwijsCode });
      continue;
    }
    if (som2 + b.bedrag > doelBedrag) {
      afgewezen.push({ sleutel: k2.sleutel, code: "boven-doel" });
      continue;
    }
    mix.push(regelVan(k2, b));
    inMix.add(k2.sleutel);
    som2 += b.bedrag;
  }
  const bereikt = som2 >= doelBedrag;
  const reserves = [];
  if (som2 >= gat) {
    for (const k2 of geschikt) {
      if (reserves.length >= config.alternatieven) break;
      if (inMix.has(k2.sleutel) || k2.optioneel) continue;
      const r = realistischBedrag({ gat, nodig: gat, min: k2.min, max: k2.max, bandOnder: bandOndergrens(k2.band), maxAandeel: config.maxAandeelPerFonds });
      if (r.bedrag !== null) reserves.push(regelVan(k2, r));
    }
  }
  return {
    uitkomst: bereikt ? "doel-bereikt" : "onvoldoende-sterke-matches",
    gat,
    doelBedrag,
    som: som2,
    dekking: stap2(som2 / gat),
    mix,
    reserve: reserves[0] ?? null,
    reserves,
    afgewezen,
    melding: bereikt ? null : MELDING_TE_WEINIG_STERKE_MATCHES
  };
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

// tests/tier/dekkingsmix.test.mjs
stand.naam = "dekkingsmix";
var PRO2 = tierConfigVoor("pro");
var PREMIUM2 = tierConfigVoor("premium");
var teller = 0;
var k = (naam, score, min, max, extra = {}) => {
  teller += 1;
  const id = `00000000-0000-4000-8000-${String(teller).padStart(12, "0")}`;
  return { sleutel: `regeling:${id}`, type: "regeling", id, naam, niveau: "volledig", accessTier: "pro", relevant: true, score, min, max, ...extra };
};
var som = (r) => r.mix.reduce((t, x) => t + x.bedrag, 0);
sectie("1. Realistisch bedrag: voorzichtig, nooit het maximum als standaard");
{
  const AANDEEL = 1 / 3;
  const rb = (inv) => realistischBedrag({ maxAandeel: AANDEEL, bandOnder: null, ...inv });
  check("alleen een maximum van \u20AC 100.000, gat \u20AC 40.000: een derde van het gat, afgerond (\u20AC 13.000)", rb({ gat: 4e4, nodig: 48e3, min: null, max: 1e5 }).bedrag === 13e3 && rb({ gat: 4e4, nodig: 48e3, min: null, max: 1e5 }).grond === "aandeel-van-gat");
  check("het is altijd een indicatie", rb({ gat: 4e4, nodig: 48e3, min: null, max: 1e5 }).indicatie === true);
  gelijk("alleen een klein maximum: een derde daarvan", rb({ gat: 4e4, nodig: 48e3, min: null, max: 1e4 }).bedrag, 3300);
  gelijk("minimum en maximum: minimum plus een derde van het bereik (\u20AC 5.000 tot \u20AC 50.000 = \u20AC 20.000)", rb({ gat: 12e4, nodig: 144e3, min: 5e3, max: 5e4 }).bedrag, 2e4);
  gelijk("grond voorzichtig-laag", rb({ gat: 12e4, nodig: 144e3, min: 5e3, max: 5e4 }).grond, "voorzichtig-laag");
  gelijk("alleen een minimum: dat minimum (ook boven een derde van het gat)", rb({ gat: 4e4, nodig: 48e3, min: 25e3, max: null }).bedrag, 25e3);
  gelijk("alleen een bandbreedte: de laagste waarde van de band", rb({ gat: 4e4, nodig: 48e3, min: null, max: null, bandOnder: 1e4 }).bedrag, 1e4);
  gelijk("grond laagste-bandbreedte", rb({ gat: 4e4, nodig: 48e3, min: null, max: null, bandOnder: 1e4 }).grond, "laagste-bandbreedte");
  gelijk("een eigen minimum gaat voor de band", rb({ gat: 4e4, nodig: 48e3, min: 7e3, max: null, bandOnder: 1e4 }).bedrag, 7e3);
  gelijk("laatste financier hoeft niet meer te dragen dan nodig", rb({ gat: 4e4, nodig: 4e3, min: null, max: 1e5 }).bedrag, 4e3);
  gelijk("nodig-grond", rb({ gat: 4e4, nodig: 4e3, min: null, max: 1e5 }).grond, "rest-tot-doel");
  gelijk("afronding < 5.000 op honderden", rb({ gat: 7777, nodig: 7777, min: null, max: 1e5 }).bedrag, 2500);
  gelijk("afronden gaat nooit onder het minimum", rb({ gat: 4e4, nodig: 48e3, min: 20250, max: 9e4 }).bedrag >= 20250, true);
  check("de rekenbasis ligt onder het bereik dat het lid ziet: nooit het maximum", rb({ gat: 12e4, nodig: 144e3, min: 2e4, max: 7e4 }).bedrag < 7e4);
  gelijk("bandOndergrens: \u20AC5.000\u2013\u20AC10.000", bandOndergrens("\u20AC5.000\u2013\u20AC10.000"), 5e3);
  gelijk("bandOndergrens: laagste band begint bij \u20AC 0, dus \u20AC 5.000", bandOndergrens("\u20AC0\u2013\u20AC5.000"), 5e3);
  gelijk("bandOndergrens: \u20AC10.000\u2013\u20AC25.000", bandOndergrens("\u20AC10.000\u2013\u20AC25.000"), 1e4);
  gelijk("bandOndergrens: \u20AC500.000\u2013\u20AC1.000.000", bandOndergrens("\u20AC500.000\u2013\u20AC1.000.000"), 5e5);
  gelijk("bandOndergrens: \u20AC1.000.000+", bandOndergrens("\u20AC1.000.000+"), 1e6);
  gelijk("bandOndergrens: geen band of rommel", [bandOndergrens(null), bandOndergrens(void 0), bandOndergrens("onbekend"), bandOndergrens(5)].join(), ",,,");
  for (const [naam, inv, code] of [
    ["geen grenzen bekend", { gat: 4e4, nodig: 44e3, min: null, max: null }, "geen-bedragen-bekend"],
    ["minimum boven het hele gat", { gat: 4e4, nodig: 44e3, min: 6e4, max: 9e4 }, "minimum-boven-gat"],
    ["minimum groter dan maximum (data-fout)", { gat: 4e4, nodig: 44e3, min: 9e4, max: 1e4 }, "ongeldige-grenzen"],
    ["geen gat", { gat: 0, nodig: 0, min: 1e3, max: 5e3 }, "geen-bedragen-bekend"],
    ["gat NaN", { gat: NaN, nodig: 1, min: 1e3, max: 5e3 }, "geen-bedragen-bekend"]
  ]) {
    const r = realistischBedrag({ ...inv, maxAandeel: 0.5 });
    check(`geen bedrag: ${naam}`, r.bedrag === null && r.afwijsCode === code, JSON.stringify(r));
  }
  for (const rommel of ["abc", -5, NaN, Infinity, {}, [], "5000"]) {
    const r = realistischBedrag({ gat: 4e4, nodig: 44e3, min: rommel, max: rommel, maxAandeel: 0.5 });
    check(`ongeldige grens ${JSON.stringify(rommel)} wordt als onbekend behandeld`, r.bedrag === null, JSON.stringify(r));
  }
  check("maxAandeel buiten bereik valt terug op 0,5", realistischBedrag({ gat: 4e4, nodig: 44e3, min: null, max: 1e5, maxAandeel: 7 }).bedrag === 2e4);
}
sectie("2. Voorbeeld: gat \u20AC 40.000 met bereiken, een band en alternatieven");
{
  const A = k("Fonds A", 90, 5e3, 25e3);
  const B = k("Fonds B", 85, 5e3, 15e3);
  const C = k("Fonds C", 80, 1e4, 4e4);
  const D = k("Fonds D", 75, 5e3, 2e4);
  const E = k("Fonds E", 70, null, null, { band: "\u20AC5.000\u2013\u20AC10.000" });
  const F = k("Fonds F", 65, null, 9e3);
  const G = k("Fonds G", 60, 5e3, 1e4);
  const H = k("Fonds H", 58, 5e3, 1e4);
  const I = k("Fonds I", 55, 5e3, 1e4);
  const J = k("Fonds J", 52, 5e3, 1e4);
  const alle = [A, B, C, D, E, F, G, H, I, J];
  const r = selecteerDekkingsmix({ kandidaten: alle, gat: 4e4, config: PRO2 });
  check("Pro: doelbedrag is 120% = \u20AC 48.000", r.doelBedrag === 48e3);
  check("Pro: doel bereikt met A tot en met F (de laatste krijgt alleen het restant)", r.uitkomst === "doel-bereikt" && r.mix.map((x) => x.naam).join() === "Fonds A,Fonds B,Fonds C,Fonds D,Fonds E,Fonds F", JSON.stringify(r.mix.map((x) => [x.naam, x.bedrag])));
  check("Pro: bedragen zijn voorzichtig (A \u20AC 11.500, B \u20AC 8.000, E laagste band \u20AC 5.000)", r.mix[0].bedrag === 11500 && r.mix[1].bedrag === 8e3 && r.mix[4].bedrag === 5e3 && r.mix[4].grond === "laagste-bandbreedte");
  check("Pro: geen enkel fonds draagt meer dan een derde van het gat", r.mix.every((x) => x.bedrag <= Math.floor(4e4 / 3)));
  check("Pro: som haalt het doel, en stopt daar", som(r) >= 48e3 && som(r) === r.som && r.dekking >= 1.2);
  check("Pro: drie alternatieven (G, H, I), J niet meer", r.reserves.map((x) => x.naam).join() === "Fonds G,Fonds H,Fonds I" && r.reserve.naam === "Fonds G");
  check("de alternatieven tellen niet mee in de som en staan niet in de mix", r.som === som(r) && r.reserves.every((x) => !r.mix.some((m) => m.sleutel === x.sleutel)));
  check("minimaal drie regels nodig om een gat te dichten (geen fonds draagt meer dan een derde)", selecteerDekkingsmix({ kandidaten: [k("Groot 1", 95, 5e3, 5e5), k("Groot 2", 94, 5e3, 5e5)], gat: 4e4, config: PRO2 }).mix.length === 2 && selecteerDekkingsmix({ kandidaten: [k("Groot 1", 95, 5e3, 5e5), k("Groot 2", 94, 5e3, 5e5)], gat: 4e4, config: PRO2 }).som < 4e4);
  const p = selecteerDekkingsmix({ kandidaten: alle, gat: 4e4, config: PREMIUM2 });
  check("Premium: doelbedrag is 160% = \u20AC 64.000", p.doelBedrag === 64e3);
  check("Premium: beste scoreband eerst (A), binnen een band de hoogste bijdrage eerst (C v\xF3\xF3r B)", p.mix.slice(0, 3).map((x) => x.naam).join() === "Fonds A,Fonds C,Fonds B", p.mix.map((x) => x.naam).join());
  check("Premium: meer regels en een hoger totaal dan Pro", p.mix.length > r.mix.length && p.som > r.som && p.mix.length <= PREMIUM2.maxRegelsInMix, p.mix.length + " " + p.som);
  check("Premium: het gat is gedekt, en er staan alternatieven bij", p.som >= 4e4 && p.reserves.length >= 1);
  check("Pro blijft puur op score (A, B, C): geen rangschikking op bijdrage", r.mix.slice(0, 3).map((x) => x.naam).join() === "Fonds A,Fonds B,Fonds C");
}
sectie("3. Kwaliteit boven dekking: nooit een zwakke match toevoegen om een percentage te halen");
{
  const sterk = k("Sterk", 90, null, 15e3);
  const zwak = k("Zwak", 30, null, 5e4);
  const niet = k("Niet relevant", 99, null, 5e4, { relevant: false });
  const r = selecteerDekkingsmix({ kandidaten: [sterk, zwak, niet], gat: 4e4, config: PRO2 });
  check("onvoldoende: eerlijke uitkomst, niet opgevuld", r.uitkomst === "onvoldoende-sterke-matches" && r.mix.length === 1 && r.mix[0].naam === "Sterk");
  check("de zwakke en de niet-relevante staan niet in de mix", !r.mix.some((x) => x.naam === "Zwak" || x.naam === "Niet relevant"));
  check("afwijzing met reden", r.afgewezen.some((x) => x.sleutel === zwak.sleutel && x.code === "score-te-laag") && r.afgewezen.some((x) => x.sleutel === niet.sleutel && x.code === "niet-relevant"));
  check("eerlijke melding aan de gebruiker", r.melding === MELDING_TE_WEINIG_STERKE_MATCHES && /te weinig sterke/.test(r.melding));
  check("geen reserve als het doel niet gehaald is", r.reserve === null);
  check("een score precies op de ondergrens telt mee, daaronder niet", selecteerDekkingsmix({ kandidaten: [k("Grens", PRO2.minScore, null, 15e3)], gat: 1e4, config: PRO2 }).mix.length === 1 && selecteerDekkingsmix({ kandidaten: [k("Net eronder", PRO2.minScore - 0.1, null, 15e3)], gat: 1e4, config: PRO2 }).mix.length === 0);
}
sectie("4. Entitlement: Pro krijgt nooit een Premium-record, ook niet als een bovenliggende stap zich vergist");
{
  const eigen = k("Pro-fonds", 80, null, 3e4, { accessTier: "pro" });
  const vrij = k("Vrij fonds", 78, null, 3e4, { accessTier: "free" });
  const prem = k("Premium-fonds", 99, null, 3e4, { accessTier: "premium" });
  const publiek = k("Publiek niveau", 99, null, 3e4, { niveau: "publiek", accessTier: "premium" });
  const verborgen = k("Verborgen", 99, null, 3e4, { niveau: "verborgen", accessTier: "pro" });
  const onbekend = k("Onbekende tier", 99, null, 3e4, { accessTier: "platina" });
  const geen = k("Geen tier", 99, null, 3e4, { accessTier: void 0 });
  const r = selecteerDekkingsmix({ kandidaten: [prem, publiek, verborgen, onbekend, geen, eigen, vrij], gat: 4e4, config: PRO2 });
  check("Pro: alleen eigen en vrije records in de mix", r.mix.map((x) => x.naam).sort().join() === "Pro-fonds,Vrij fonds", JSON.stringify(r.mix.map((x) => x.naam)));
  check("Pro: Premium-record (zelfs met niveau volledig) geweigerd als tier-niet-toegestaan", r.afgewezen.some((x) => x.sleutel === prem.sleutel && x.code === "tier-niet-toegestaan"));
  check("Pro: publiek en verborgen tellen nooit mee", r.afgewezen.some((x) => x.sleutel === publiek.sleutel && x.code === "niet-volledig-zichtbaar") && r.afgewezen.some((x) => x.sleutel === verborgen.sleutel && x.code === "niet-volledig-zichtbaar"));
  check("onbekende of ontbrekende access_tier: geweigerd", r.afgewezen.some((x) => x.sleutel === onbekend.sleutel && x.code === "tier-niet-toegestaan") && r.afgewezen.some((x) => x.sleutel === geen.sleutel && x.code === "tier-niet-toegestaan"));
  check("Premium-record staat nergens in de uitvoer", !JSON.stringify({ mix: r.mix, reserve: r.reserve }).includes("Premium-fonds"));
  const p = selecteerDekkingsmix({ kandidaten: [prem, eigen, vrij], gat: 4e4, config: PREMIUM2 });
  check("Premium: het Premium-record mag wel (en staat bovenaan door de score)", p.mix[0]?.naam === "Premium-fonds");
  check("Premium: publiek en verborgen blijven ook voor Premium buiten de mix", selecteerDekkingsmix({ kandidaten: [publiek, verborgen], gat: 4e4, config: PREMIUM2 }).mix.length === 0);
  const free = selecteerDekkingsmix({ kandidaten: [vrij], gat: 4e4, config: tierConfigVoor("free") });
  check("Free: geen dekkingsplan", free.uitkomst === "niet-beschikbaar" && free.mix.length === 0);
}
sectie("5. Randgevallen");
{
  gelijk("geen gat", selecteerDekkingsmix({ kandidaten: [k("X", 90, null, 1e3)], gat: 0, config: PRO2 }).uitkomst, "geen-gat");
  gelijk("gat is rommel", selecteerDekkingsmix({ kandidaten: [k("X", 90, null, 1e3)], gat: "veel", config: PRO2 }).uitkomst, "geen-gat");
  gelijk("geen kandidaten", selecteerDekkingsmix({ kandidaten: [], gat: 4e4, config: PRO2 }).uitkomst, "geen-kandidaten");
  check("geen kandidaten: eerlijke melding", selecteerDekkingsmix({ kandidaten: [], gat: 4e4, config: PRO2 }).melding === MELDING_TE_WEINIG_STERKE_MATCHES);
  check("undefined of null als kandidaten gooit niet", selecteerDekkingsmix({ kandidaten: void 0, gat: 4e4, config: PRO2 }).uitkomst === "geen-kandidaten" && selecteerDekkingsmix({ kandidaten: [null, void 0, {}], gat: 4e4, config: PRO2 }).uitkomst === "geen-kandidaten");
  const dubbel = k("Dubbel", 80, null, 3e4);
  const r = selecteerDekkingsmix({ kandidaten: [dubbel, { ...dubbel }], gat: 4e4, config: PRO2 });
  check("dezelfde sleutel tweemaal: \xE9\xE9n keer geteld", r.mix.length === 1 && r.afgewezen.some((x) => x.code === "dubbel"));
  check("kandidaat zonder bruikbare bijdragegrenzen telt niet mee", selecteerDekkingsmix({ kandidaten: [k("Zonder", 90, null, null), k("Met", 80, null, 3e4)], gat: 4e4, config: PRO2 }).mix.map((x) => x.naam).join() === "Met");
  check("minimum boven het gat telt niet mee", selecteerDekkingsmix({ kandidaten: [k("Te groot", 90, 1e5, 2e5), k("Past", 80, null, 3e4)], gat: 4e4, config: PRO2 }).mix.map((x) => x.naam).join() === "Past");
  check("cofinancieringstekst wordt onzekerheid, geen rekensom", selecteerDekkingsmix({ kandidaten: [k("Cof", 90, null, 3e4, { cofinanciering: "50% eigen bijdrage vereist" })], gat: 4e4, config: PRO2 }).mix[0].onzekerheden.some((o) => /Cofinancieringseis/.test(o) && /50%/.test(o)));
  check("elke regel noemt dat het een schatting is", selecteerDekkingsmix({ kandidaten: [k("S", 90, null, 3e4)], gat: 4e4, config: PRO2 }).mix[0].onzekerheden[0].includes("schatting"));
  const veel = Array.from({ length: 30 }, (_, i) => k(`Klein ${String(i).padStart(2, "0")}`, 90 - i, null, 500));
  const v = selecteerDekkingsmix({ kandidaten: veel, gat: 1e5, config: PRO2 });
  check("mixgrootte begrensd; daarna eerlijk onvoldoende", v.mix.length === PRO2.maxRegelsInMix && v.uitkomst === "onvoldoende-sterke-matches" && v.afgewezen.some((x) => x.code === "mix-vol"));
}
sectie("6. Deterministisch en onafhankelijk van de invoervolgorde");
{
  const lijst = Array.from({ length: 12 }, (_, i) => k(`Fonds ${String(i).padStart(2, "0")}`, 95 - i * 2, i % 3 === 0 ? 1e3 : null, 5e3 + i * 3e3));
  const basis = JSON.stringify(selecteerDekkingsmix({ kandidaten: lijst, gat: 6e4, config: PREMIUM2 }));
  let rng = 12345;
  const rand = () => (rng = (rng * 1664525 + 1013904223) % 4294967296) / 4294967296;
  for (let i = 0; i < 25; i++) {
    const schud = [...lijst].sort(() => rand() - 0.5);
    check(`schudden ${i}: identiek resultaat`, JSON.stringify(selecteerDekkingsmix({ kandidaten: schud, gat: 6e4, config: PREMIUM2 })) === basis);
  }
  check("invoer wordt niet gemuteerd", JSON.stringify(lijst) === JSON.stringify(lijst.map((x) => ({ ...x }))) && lijst.every((x, i) => i === 0 || lijst[i - 1].score >= x.score));
}
sectie("7. Eigenschappen over 3000 willekeurige gevallen");
{
  let rng = 987654321;
  const rand = () => (rng = (rng * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const pick = (a) => a[Math.floor(rand() * a.length)];
  let fouten = 0;
  for (let n = 0; n < 3e3; n++) {
    const config = pick([PRO2, PREMIUM2]);
    const gat = Math.round(rand() * 4e5) + (rand() < 0.1 ? 0 : 1e3);
    const kand = Array.from(
      { length: Math.floor(rand() * 14) },
      (_, i) => k(`F${n}-${i}`, Math.round(rand() * 100), rand() < 0.4 ? Math.round(rand() * 6e4) : null, rand() < 0.8 ? Math.round(rand() * 25e4) : null, {
        accessTier: pick(["free", "pro", "premium", "premium", "x"]),
        niveau: pick(["volledig", "volledig", "volledig", "publiek", "verborgen"]),
        relevant: rand() < 0.85
      })
    );
    const r = selecteerDekkingsmix({ kandidaten: kand, gat, config });
    const sleutels = r.mix.map((x) => x.sleutel);
    const byKey = new Map(kand.map((x) => [x.sleutel, x]));
    const slecht = [];
    if (new Set(sleutels).size !== sleutels.length) slecht.push("dubbel");
    if (r.reserves.some((x) => sleutels.includes(x.sleutel))) slecht.push("reserve in mix");
    if (r.reserves.length > config.alternatieven) slecht.push("te veel alternatieven");
    if (r.reserves.length && r.som < gat) slecht.push("alternatieven zonder gedekt gat");
    if (r.mix.length > config.maxRegelsInMix) slecht.push("mix te groot");
    if (r.som !== som(r)) slecht.push("som klopt niet");
    if (r.uitkomst === "doel-bereikt" && r.som < r.doelBedrag) slecht.push("doel niet gehaald maar bereikt");
    if (r.uitkomst === "onvoldoende-sterke-matches" && r.som >= r.doelBedrag) slecht.push("onvoldoende maar toch genoeg");
    if (r.uitkomst === "doel-bereikt" && r.mix.length > 1 && r.som - r.mix[r.mix.length - 1].bedrag >= r.doelBedrag) slecht.push("niet gestopt zodra het doel gehaald was");
    for (const x of [...r.mix, ...r.reserves]) {
      const bron = byKey.get(x.sleutel);
      if (!bron) {
        slecht.push("onbekende regel");
        continue;
      }
      if (bron.niveau !== "volledig" || !config.toegestaneAccessTiers.includes(bron.accessTier) || !bron.relevant || bron.score < config.minScore) slecht.push("niet toegestaan");
      if (!(x.bedrag > 0) || !Number.isInteger(x.bedrag)) slecht.push("bedrag ongeldig");
      if (bron.max !== null && x.bedrag > bron.max) slecht.push("boven maximum");
      if (bron.min !== null && x.bedrag < bron.min) slecht.push("onder minimum");
      if (x.bedrag > gat) slecht.push("bedrag boven het hele gat");
      if (x.bedrag > Math.max(Math.floor(gat / 3), bron.min ?? 0)) slecht.push("meer dan een derde van het gat");
    }
    if (slecht.length) {
      fouten += 1;
      if (fouten < 4) console.log("  FAIL voorbeeld", n, slecht.join(", "), JSON.stringify({ gat, config: config.tier }));
    }
  }
  check("geen enkele schending van de eigenschappen", fouten === 0, `${fouten} gevallen`);
}
sectie("Premium: de begroting sluitend maken met de beste en hoogste bijdragen (project \u20AC 700.000)");
{
  const groot = Array.from({ length: 6 }, (_, i) => k(`Groot ${i}`, 82 + i % 3, 5e4, 45e4));
  const klein = Array.from({ length: 10 }, (_, i) => k(`Klein ${i}`, 88 - i % 3, 5e3, 3e4));
  const alles = [...klein, ...groot];
  const prem = selecteerDekkingsmix({ kandidaten: alles, gat: 7e5, config: PREMIUM2 });
  const pro = selecteerDekkingsmix({ kandidaten: alles, gat: 7e5, config: PRO2 });
  check("Premium: doelbedrag 160% = \u20AC 1.120.000", prem.doelBedrag === 112e4);
  check("Premium: de begroting sluit (minstens 100%), met de hoogste bijdragen voorop", prem.som >= 7e5 && prem.mix.slice(0, 6).every((x) => x.naam.startsWith("Groot")), prem.som + " " + prem.mix.map((x) => x.naam).join());
  check("Premium: nooit meer dan 9 regels, plus drie alternatieven die niet meetellen", prem.mix.length <= PREMIUM2.maxRegelsInMix && prem.reserves.length <= 3 && prem.som === som(prem));
  check("Pro: dezelfde kandidaten, maximaal 6 regels", pro.mix.length <= 6);
  const top = k("Topmatch klein", 95, 5e3, 1e4);
  const matig = k("Matige match groot", 62, 2e4, 5e5);
  const band = selecteerDekkingsmix({ kandidaten: [matig, top], gat: 1e5, config: PREMIUM2 });
  check("Scoreband gaat voor bijdrage: topmatch eerst, matige match daarna", band.mix[0].naam === "Topmatch klein" && band.mix[1].naam === "Matige match groot");
  check("Premium met te weinig sterke matches: eerlijk onvoldoende, niets opvullen", selecteerDekkingsmix({ kandidaten: [k("Enige", 80, null, 1e4)], gat: 7e5, config: PREMIUM2 }).uitkomst === "onvoldoende-sterke-matches");
  check("Rangschikking is deterministisch bij gelijke score en bijdrage (op naam)", selecteerDekkingsmix({ kandidaten: [k("B-fonds", 80, 5e3, 1e4), k("A-fonds", 80, 5e3, 1e4)], gat: 2e4, config: PREMIUM2 }).mix[0].naam === "A-fonds");
  const klein2 = [k("Fonds 70a", 90, 2e4, 7e4), k("Fonds 70b", 89, 2e4, 7e4), k("Fonds 40", 80, 1e4, 4e4), k("Fonds 25", 78, 1e4, 25e3), k("Fonds 30", 76, 1e4, 3e4), k("Fonds 20", 74, 5e3, 2e4), k("Fonds 25b", 72, 1e4, 25e3)];
  const kl = selecteerDekkingsmix({ kandidaten: klein2, gat: 12e4, config: PRO2 });
  check("Project \u20AC 120.000: twee fondsen van \u20AC 70.000 verdringen de rest niet (minstens 5 fondsen in het plan)", kl.mix.length >= 5 && kl.mix.every((x) => x.bedrag < 4e4), kl.mix.map((x) => x.naam + ":" + x.bedrag).join(" "));
}
klaar("dekkingsmix");
