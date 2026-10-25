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
function vindVermeldingen(tekst3) {
  const n = normaliseer(tekst3);
  const uit = [];
  for (const m of n.matchAll(TERM_RE)) {
    const doel = TERM_DOEL.get(m[0]);
    if (doel) uit.push({ term: m[0], doel, index: m.index ?? 0 });
  }
  return uit;
}
function projectGebied(teksten) {
  const samen = teksten.filter((t) => typeof t === "string" && t.trim()).join(" | ");
  const landen = [];
  const werelddelen = [];
  for (const v of vindVermeldingen(samen)) {
    if (v.doel.t === "land" && !landen.some((l) => l.naam === v.doel.land.naam)) landen.push(v.doel.land);
    if (v.doel.t === "werelddeel" || v.doel.t === "regio") {
      if (!werelddelen.includes(v.doel.naam)) werelddelen.push(v.doel.naam);
    }
  }
  return { landen, werelddelen: landen.length ? [] : werelddelen, bronTekst: samen.slice(0, 200) };
}

// supabase/functions/_shared/serviceclubs.ts
var OPTIONEEL_ONDERDEEL = "Optioneel te onderzoeken";
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
function isServiceclub(row) {
  if (!row || typeof row !== "object") return false;
  const r = row;
  return norm(r.funder_type ?? r.type_gever) === "service_club";
}
function isServiceclubVermelding(row) {
  if (!row || typeof row !== "object") return false;
  const r = row;
  if (norm(r.funder_type ?? r.type_gever) !== "service_club") return false;
  const gebieden = Array.isArray(r.werkgebieden_namen) ? r.werkgebieden_namen : [];
  return gebieden.some((g) => norm(g) === "regionaal");
}
function serviceclubBeoordeling(p) {
  const regios = (p.regios ?? []).map(norm).filter(Boolean);
  const locatie = norm(p.locatieTekst);
  const onderwerp = (p.doelgroepen ?? []).some((d) => DOELGROEPEN_CLUBS.has(norm(d))) || (p.themas ?? []).some((t) => THEMAS_CLUBS.has(norm(t))) || (p.activiteiten ?? []).some((a) => norm(a) === "noodhulp");
  const gebied = projectGebied([p.locatieTekst, ...p.regios ?? []]);
  if (regios.some((r) => BUITENLAND_REGIOS.has(r)) || gebied.landen.length > 0 || gebied.werelddelen.length > 0) return { aanbieden: false, reden: "buitenland", onderwerp };
  const lokaleRegio = regios.some((r) => !GEEN_REGIONAAL.has(r));
  const lokaleLocatie = locatie !== "" && !NEDERLAND_TERMEN.has(locatie);
  if (!lokaleRegio && !lokaleLocatie) return { aanbieden: false, reden: regios.length || locatie ? "niet-regionaal" : "werkgebied-onbekend", onderwerp };
  if (!onderwerp) return { aanbieden: false, reden: "onderwerp", onderwerp };
  return { aanbieden: true, reden: "ok", onderwerp };
}

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
var BEDRAG_INDICATIE_TEKST = "De genoemde bedragen zijn een inschatting op basis van de gegevens in onze database, geen toezegging. Overleg altijd zelf met de donor of een aanvraag mogelijk is en hoe hoog die mag zijn.";
var BEDRAG_INDICATIE_TEKST_ZONDER_BEDRAG = "Er zijn nog geen bedragen voorgesteld. Overleg altijd zelf met de donor of een aanvraag mogelijk is en hoe hoog die mag zijn.";
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
function lokaalVoorrang(lijst2, maxRegels) {
  const cap = Math.max(1, Math.floor(maxRegels / 3));
  const voor = new Set(lijst2.filter((k2) => k2.lokaal === true && !k2.optioneel).slice(0, cap));
  return voor.size ? [...lijst2.filter((k2) => voor.has(k2)), ...lijst2.filter((k2) => !voor.has(k2))] : lijst2;
}
function selecteerZonderBedrag(inv) {
  if (!inv.config.dekkingsplan || inv.config.maxRegelsInMix <= 0) return { regels: [], afgewezen: [] };
  const { geschikt, afgewezen } = filterGeschikt(inv.kandidaten, inv.config);
  geschikt.sort(volgorde);
  geschikt.splice(0, geschikt.length, ...lokaalVoorrang(geschikt, inv.config.maxRegelsInMix));
  for (const k2 of geschikt.slice(inv.config.maxRegelsInMix)) afgewezen.push({ sleutel: k2.sleutel, code: "mix-vol" });
  return { regels: geschikt.slice(0, inv.config.maxRegelsInMix), afgewezen };
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
  let som = 0;
  for (const k2 of geschikt) {
    if (som >= doelBedrag) break;
    if (mix.length >= config.maxRegelsInMix) {
      afgewezen.push({ sleutel: k2.sleutel, code: "mix-vol" });
      continue;
    }
    const b = realistischBedrag({ gat, nodig: doelBedrag - som, min: k2.min, max: k2.max, bandOnder: bandOndergrens(k2.band), maxAandeel: config.maxAandeelPerFonds });
    if (b.bedrag === null) {
      afgewezen.push({ sleutel: k2.sleutel, code: b.afwijsCode });
      continue;
    }
    if (som + b.bedrag > doelBedrag) {
      afgewezen.push({ sleutel: k2.sleutel, code: "boven-doel" });
      continue;
    }
    mix.push(regelVan(k2, b));
    inMix.add(k2.sleutel);
    som += b.bedrag;
  }
  const bereikt = som >= doelBedrag;
  const reserves = [];
  if (som >= gat) {
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
    som,
    dekking: stap2(som / gat),
    mix,
    reserve: reserves[0] ?? null,
    reserves,
    afgewezen,
    melding: bereikt ? null : MELDING_TE_WEINIG_STERKE_MATCHES
  };
}

// supabase/functions/_shared/voorstelContract.js
var VOORSTEL_VERSIE = 1;
var MAX_REGELS = 12;
var MAX_ACTIES = 30;
var VOORSTEL_STATUS = { UITVRAAG: "uitvraag", CONCEPT: "concept", DEFINITIEF: "definitief" };
var BRON_SOORT = { REGELING: "regeling", FONDS: "fonds", ONLINE: "online" };
var DEADLINE_STATUS = { GEVERIFIEERD: "geverifieerd", TE_VERIFIEREN: "te-verifieren" };
var DATUM_TYPE = { STREEF: "streef", EXTERN: "extern" };
var MAX = { naam: 200, motivatie: 600, onderdeel: 200, voorwaarde: 300, onzekerheid: 300, titel: 200, toelichting: 600, sleutel: 120 };
var MAX_LIJST = 6;
var MAX_BEDRAG = 1e12;
var MAX_DEKKINGSDOEL = 1.6;
function toegestaneSom(gat, dekkingsdoel) {
  const f = typeof dekkingsdoel === "number" && Number.isFinite(dekkingsdoel) && dekkingsdoel >= 1 && dekkingsdoel <= MAX_DEKKINGSDOEL ? dekkingsdoel : 1;
  return Math.ceil(Math.round(gat * f * 100) / 100);
}
var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var ISO2 = /^\d{4}-\d{2}-\d{2}$/;
var PRIORITEITEN = ["high", "normal", "low"];
var tekst = (v) => v == null ? "" : String(v);
var kort = (v, max) => tekst(v).trim().slice(0, max);
function isEchteDatum(iso) {
  if (!ISO2.test(tekst(iso))) {
    return false;
  }
  const [j, m, d] = iso.split("-").map(Number);
  const x = new Date(Date.UTC(j, m - 1, d));
  return x.getUTCFullYear() === j && x.getUTCMonth() === m - 1 && x.getUTCDate() === d;
}
function voegDagenToe(iso, dagen) {
  const [j, m, d] = iso.split("-").map(Number);
  const x = new Date(Date.UTC(j, m - 1, d + dagen));
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}-${String(x.getUTCDate()).padStart(2, "0")}`;
}
function contractBedrag(v) {
  if (v == null || v === "" || typeof v === "boolean") {
    return null;
  }
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n >= MAX_BEDRAG) {
    return null;
  }
  return Math.round(n);
}
function veiligeUrl(waarde) {
  const t = kort(waarde, 2e3);
  if (!t) {
    return null;
  }
  try {
    const u = new URL(t);
    const host = u.hostname.toLowerCase();
    if (u.protocol !== "https:" && u.protocol !== "http:" || u.username || u.password) return null;
    if (!host.includes(".") || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return null;
    return u.toString();
  } catch (e) {
    return null;
  }
}
function normaliseerNaam(naam) {
  return tekst(naam).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
var bevatHeleWoorden = (groot, klein) => klein.length > 0 && ` ${groot} `.includes(` ${klein} `);
function zelfdeFinancier(a, b) {
  const x = normaliseerNaam(a);
  const y = normaliseerNaam(b);
  if (!x || !y) {
    return false;
  }
  if (x === y) {
    return true;
  }
  return x.length >= 10 && bevatHeleWoorden(y, x) || y.length >= 10 && bevatHeleWoorden(x, y);
}
function slug(t) {
  return normaliseerNaam(t).replace(/ /g, "-").slice(0, 60);
}
function regelSleutelVan(regel) {
  if (regel.type === BRON_SOORT.ONLINE) return `r:online:${slug(regel.naam)}`;
  return `r:${regel.type}:${regel.id}`;
}
function actieSleutelVan(actie) {
  return `a:${actie.regelSleutel || "project"}:${slug(actie.titel)}`.slice(0, MAX.sleutel);
}
function navragenTitel(naam) {
  return `Contact opnemen met ${naam} over passendheid, aanvraag en behandeltermijn`.slice(0, MAX.titel);
}
var DATUM_HERKOMST = ["bron", "berekend", "aanname"];
var ACTIE_FASES = ["navragen", "passendheid", "adviseur", "contact", "stukken", "schrijven", "review", "indienen", "ontvangst", "vragen", "beoordeling", "besluit", "vervolg"];
var NA_INDIENEN = ["ontvangst", "vragen", "beoordeling", "besluit", "vervolg"];
function verificatieActie(regel, vandaag) {
  return {
    titel: navragenTitel(regel.naam),
    regelSleutel: regel.sleutel,
    financier: regel.naam,
    datum: isEchteDatum(vandaag) ? voegDagenToe(vandaag, 7) : null,
    datumType: DATUM_TYPE.STREEF,
    externeDeadline: null,
    prioriteit: "high",
    toelichting: "Er is nog geen indiendatum bekend. Vraag na of uw project past, wanneer u kunt aanvragen en hoe lang de behandeling duurt.",
    automatisch: true,
    fase: "navragen",
    datumHerkomst: "aanname",
    datumBron: "eigen streefdatum",
    datumControle: null
  };
}
var STOPWOORDEN = /* @__PURE__ */ new Set(["de", "het", "een", "van", "voor", "en", "der", "den", "the", "and", "bij", "met", "op", "in", "te", "aan", "als", "of", "is"]);
var MAANDEN = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
function sigWoorden(t) {
  return normaliseerNaam(t).split(" ").filter((w) => w.length >= 3 && !STOPWOORDEN.has(w));
}
var staatInTekst = (groot, woord) => ` ${groot} `.includes(` ${woord} `);
function bronUrlSleutel(url) {
  try {
    const u = new URL(tekst(url).trim());
    return `${u.hostname.toLowerCase()}${u.pathname.replace(/\/+$/, "")}${u.search}`;
  } catch (e) {
    return "";
  }
}
function datumInFragment(iso, fragment) {
  if (!isEchteDatum(iso) || !tekst(fragment).trim()) return false;
  const [j, m, d] = iso.split("-");
  const dag = String(Number(d));
  const mnd = String(Number(m));
  const naam = MAANDEN[Number(m) - 1];
  const varianten = [`${j} ${m} ${d}`, `${dag} ${mnd} ${j}`, `${d} ${m} ${j}`, `${dag} ${naam} ${j}`, `${d} ${naam} ${j}`, `${dag} ${naam.slice(0, 3)} ${j}`].map((x) => normaliseerNaam(x));
  const norm2 = ` ${normaliseerNaam(fragment)} `;
  return varianten.some((x) => norm2.includes(` ${x} `));
}
function controleerOnlineBron(r, ruweBron, opgehaald) {
  const url = veiligeUrl(ruweBron && ruweBron.url);
  if (!url) return { ok: false, code: "online-zonder-bron" };
  const sleutel = bronUrlSleutel(url);
  const entry = (Array.isArray(opgehaald) ? opgehaald : []).find((e) => e && bronUrlSleutel(e.url) === sleutel && tekst(e.tekst).trim());
  if (!entry) return { ok: false, code: "bron-niet-opgehaald" };
  const gecontroleerdOp = isEchteDatum(tekst(entry.opgehaaldOp).slice(0, 10)) ? tekst(entry.opgehaaldOp).slice(0, 10) : null;
  if (!gecontroleerdOp) return { ok: false, code: "online-zonder-bron" };
  const norm2 = normaliseerNaam(entry.tekst);
  const naamWoorden = sigWoorden(r.naam);
  if (!naamWoorden.length || !naamWoorden.every((w) => staatInTekst(norm2, w))) return { ok: false, code: "bron-bevestigt-financier-niet" };
  const fragmentRuw = kort(ruweBron && ruweBron.fragment, 300);
  const fragmentOk = fragmentRuw && normaliseerNaam(entry.tekst).includes(normaliseerNaam(fragmentRuw));
  const voorwaarden = [];
  const onbevestigd = [];
  lijst(r.voorwaarden, MAX_LIJST, MAX.voorwaarde).forEach((vw) => {
    const w = sigWoorden(vw);
    const gevonden = w.filter((x) => staatInTekst(norm2, x)).length;
    (w.length && gevonden / w.length >= 0.6 ? voorwaarden : onbevestigd).push(vw);
  });
  return {
    ok: true,
    bron: { url, gecontroleerdOp, fragment: fragmentOk ? fragmentRuw : null, soort: "online" },
    fragmentVervallen: Boolean(fragmentRuw) && !fragmentOk,
    voorwaarden,
    onbevestigd
  };
}
function lijst(v, maxItems, maxTekst) {
  return (Array.isArray(v) ? v : []).map((x) => kort(x, maxTekst)).filter(Boolean).slice(0, maxItems);
}
function leesKenmerken(k2) {
  if (!k2 || typeof k2 !== "object") return null;
  const url = veiligeUrl(k2.website);
  return {
    beschrijving: kort(k2.beschrijving, 400) || null,
    doelgroepen: lijst(k2.doelgroepen, 10, 80),
    disciplines: lijst(k2.disciplines, 10, 80),
    werkgebieden: lijst(k2.werkgebieden, 10, 80),
    bandbreedte: kort(k2.bandbreedte, 160) || null,
    website: url && url.startsWith("https://") ? url.slice(0, 500) : null,
    passendheid: k2.passendheid === "aantoonbaar" || k2.passendheid === "mogelijk" ? k2.passendheid : null,
    controleren: lijst(k2.controleren, 6, 220)
  };
}
function leesDeadline(raw, grondslag, vandaag) {
  const d = raw && typeof raw === "object" ? raw : {};
  const gevraagd = isEchteDatum(tekst(d.datum).slice(0, 10)) ? tekst(d.datum).slice(0, 10) : null;
  const waarschuwingen = [];
  const claimde = d.status === DEADLINE_STATUS.GEVERIFIEERD || Boolean(gevraagd);
  const geef = (datum) => ({ deadline: { status: DEADLINE_STATUS.GEVERIFIEERD, datum, verlopen: isEchteDatum(vandaag) ? datum < vandaag : false }, waarschuwingen });
  if (grondslag && grondslag.database !== void 0) {
    if (isEchteDatum(grondslag.database)) {
      if (gevraagd && gevraagd !== grondslag.database) waarschuwingen.push("deadline-afwijkend-van-database");
      return geef(grondslag.database);
    }
  } else if (grondslag && grondslag.fragment && gevraagd && d.status === DEADLINE_STATUS.GEVERIFIEERD && datumInFragment(gevraagd, grondslag.fragment)) {
    return geef(gevraagd);
  }
  if (claimde) waarschuwingen.push("deadline-niet-geverifieerd");
  return { deadline: { status: DEADLINE_STATUS.TE_VERIFIEREN, datum: null, verlopen: false }, waarschuwingen };
}
function binnenGrenzen(bedrag, min, max) {
  if (bedrag == null) return { bedrag: null, gecorrigeerd: false };
  let b = bedrag;
  if (max != null && b > max) b = max;
  if (min != null && b < min) b = min;
  return { bedrag: b, gecorrigeerd: b !== bedrag };
}
function valideerVoorstel(raw, ctx) {
  const c = ctx || {};
  const fouten = [];
  const waarschuwingen = [];
  const fout = (pad, code) => fouten.push({ pad, code });
  const waarschuw = (pad, code) => waarschuwingen.push({ pad, code });
  const vandaag = isEchteDatum(c.vandaag) ? c.vandaag : null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, voorstel: null, fouten: [{ pad: "", code: "geen-object" }], waarschuwingen };
  }
  if (raw.versie !== VOORSTEL_VERSIE) {
    return { ok: false, voorstel: null, fouten: [{ pad: "versie", code: "onbekende-versie" }], waarschuwingen };
  }
  if (!UUID.test(tekst(raw.projectId)) || raw.projectId !== c.projectId) {
    return { ok: false, voorstel: null, fouten: [{ pad: "projectId", code: "ander-project" }], waarschuwingen };
  }
  const status = Object.values(VOORSTEL_STATUS).includes(raw.status) ? raw.status : VOORSTEL_STATUS.CONCEPT;
  const bedragenToegestaan = c.bedragenToegestaan !== false;
  const bestaande = Array.isArray(c.bestaandeRegels) ? c.bestaandeRegels : [];
  const gat = c.dekking && c.dekking.heeftBegroting ? Math.max(0, c.dekking.nogTePlannen || 0) : 0;
  const ruweRegels = Array.isArray(raw.regels) ? raw.regels : [];
  if (ruweRegels.length > MAX_REGELS) waarschuw("regels", "te-veel-regels");
  const regels = [];
  ruweRegels.slice(0, MAX_REGELS).forEach((r, i) => {
    const pad = `regels[${i}]`;
    if (!r || typeof r !== "object") return fout(pad, "geen-object");
    const type = Object.values(BRON_SOORT).includes(r.type) ? r.type : null;
    const naam = kort(r.naam, MAX.naam);
    if (!type) return fout(pad, "onbekend-type");
    if (!naam) return fout(pad, "naam-ontbreekt");
    if (type !== BRON_SOORT.ONLINE && !UUID.test(tekst(r.id))) return fout(pad, "ongeldig-id");
    let bron;
    let grondslag;
    let voorwaarden = lijst(r.voorwaarden, MAX_LIJST, MAX.voorwaarde);
    let onzekerheden = lijst(r.onzekerheden, MAX_LIJST, MAX.onzekerheid);
    let regelNaam = naam;
    let grenzenBron = { min: contractBedrag(r.grenzen && r.grenzen.min), max: contractBedrag(r.grenzen && r.grenzen.max) };
    let gever = kort(r.gever, MAX.naam);
    if (type === BRON_SOORT.ONLINE) {
      const ctl = controleerOnlineBron({ ...r, naam }, r.bron, c.opgehaaldeBronnen);
      if (!ctl.ok) return fout(pad, ctl.code);
      bron = ctl.bron;
      grondslag = { fragment: ctl.bron.fragment };
      voorwaarden = ctl.voorwaarden;
      onzekerheden = [...ctl.onbevestigd.map((x) => kort(`Niet bevestigd in de bron: ${x}`, MAX.onzekerheid)), ...onzekerheden].slice(0, MAX_LIJST);
      if (ctl.fragmentVervallen) waarschuw(pad, "fragment-niet-in-bron");
      if (ctl.onbevestigd.length) waarschuw(pad, "voorwaarde-niet-bevestigd");
    } else {
      const rec = c.bekendeBronnen && Object.prototype.hasOwnProperty.call(c.bekendeBronnen, tekst(r.id).toLowerCase()) ? c.bekendeBronnen[tekst(r.id).toLowerCase()] : null;
      if (!rec) return fout(pad, "onbekende-bron");
      bron = { url: null, gecontroleerdOp: null, soort: "database" };
      grondslag = { database: isEchteDatum(rec.deadline) ? rec.deadline : null };
      regelNaam = kort(rec.naam, MAX.naam) || naam;
      gever = kort(rec.gever, MAX.naam) || gever;
      grenzenBron = { min: contractBedrag(rec.min), max: contractBedrag(rec.max) };
      const cof = kort(rec.cofinanciering, 200);
      if (cof) onzekerheden = [kort(`Cofinancieringseis (niet automatisch gecontroleerd): ${cof}`, MAX.onzekerheid), ...onzekerheden].slice(0, MAX_LIJST);
    }
    const regel = {
      type,
      id: type === BRON_SOORT.ONLINE ? null : tekst(r.id).toLowerCase(),
      naam: regelNaam,
      regeling: kort(r.regeling, MAX.naam),
      gever,
      herkomst: type === BRON_SOORT.ONLINE ? "online" : "database",
      bron,
      motivatie: kort(r.motivatie, MAX.motivatie),
      kenmerken: type === BRON_SOORT.ONLINE ? null : leesKenmerken(r.kenmerken),
      onderdeel: kort(r.onderdeel, MAX.onderdeel),
      voorwaarden,
      onzekerheden,
      staatAl: false,
      selecteerbaar: true
    };
    regel.sleutel = regelSleutelVan(regel);
    const { min, max } = grenzenBron;
    const voorgesteld = bedragenToegestaan ? contractBedrag(r.bedrag) : null;
    if (!bedragenToegestaan && r.bedrag != null && r.bedrag !== "") waarschuw(pad, "bedrag-zonder-begroting");
    const begrensd = binnenGrenzen(voorgesteld, min, max);
    regel.bedrag = begrensd.bedrag;
    regel.grenzen = { min, max };
    regel.bedragGecorrigeerd = begrensd.gecorrigeerd;
    if (begrensd.gecorrigeerd) waarschuw(pad, "bedrag-aangepast-aan-grenzen");
    const dl = leesDeadline(r.deadline, grondslag, vandaag);
    regel.deadline = dl.deadline;
    dl.waarschuwingen.forEach((code) => waarschuw(pad, code));
    regel.staatAl = bestaande.some(
      (b) => type === BRON_SOORT.REGELING ? b.schemeId === regel.id : type === BRON_SOORT.FONDS ? b.funderId === regel.id : zelfdeFinancier(b.financierNaam || b.naam, regel.naam)
    );
    if (regel.staatAl) {
      regel.selecteerbaar = false;
      regel.bedrag = null;
    }
    regel.oorspronkelijkBedrag = regel.bedrag;
    if (regels.some((x) => x.sleutel === regel.sleutel || x.type === BRON_SOORT.ONLINE && regel.type === BRON_SOORT.ONLINE && zelfdeFinancier(x.naam, regel.naam))) {
      waarschuw(pad, "dubbel-in-voorstel");
      return;
    }
    regels.push(regel);
  });
  const som = regels.filter((r) => r.selecteerbaar).reduce((t, r) => t + (r.bedrag || 0), 0);
  if (som > toegestaneSom(gat, c.dekkingsdoel)) fout("regels", "boven-financieringsgat");
  const ruweActies = Array.isArray(raw.acties) ? raw.acties : [];
  const acties = [];
  if (ruweActies.length > MAX_ACTIES) waarschuw("acties", "te-veel-acties");
  ruweActies.slice(0, MAX_ACTIES).forEach((a, i) => {
    const pad = `acties[${i}]`;
    if (!a || typeof a !== "object") return fout(pad, "geen-object");
    const titel = kort(a.titel, MAX.titel);
    if (!titel) return fout(pad, "titel-ontbreekt");
    const regel = a.regelSleutel ? regels.find((r) => r.sleutel === a.regelSleutel) : null;
    if (a.regelSleutel && !regel) waarschuw(pad, "onbekende-regel");
    let datum = isEchteDatum(tekst(a.datum).slice(0, 10)) ? tekst(a.datum).slice(0, 10) : null;
    const extern = regel && regel.deadline.status === DEADLINE_STATUS.GEVERIFIEERD ? regel.deadline.datum : null;
    if (a.datumType === DATUM_TYPE.EXTERN && !extern) {
      datum = null;
      waarschuw(pad, "externe-datum-niet-geverifieerd");
    } else if (a.datumType === DATUM_TYPE.EXTERN && extern) {
      datum = extern;
    }
    const fase = ACTIE_FASES.includes(a.fase) ? a.fase : null;
    if (datum && a.datumType !== DATUM_TYPE.EXTERN) {
      if (vandaag && datum < vandaag) {
        datum = vandaag;
        waarschuw(pad, "streefdatum-verleden");
      }
      if (extern && datum > extern && !NA_INDIENEN.includes(fase)) {
        datum = vandaag && voegDagenToe(extern, -3) < vandaag ? vandaag : voegDagenToe(extern, -3);
        waarschuw(pad, "streefdatum-na-deadline");
      }
    }
    const actie = {
      titel,
      regelSleutel: regel ? regel.sleutel : null,
      financier: kort(a.financier, MAX.naam) || (regel ? regel.naam : ""),
      datum,
      datumType: a.datumType === DATUM_TYPE.EXTERN && extern ? DATUM_TYPE.EXTERN : DATUM_TYPE.STREEF,
      externeDeadline: extern,
      prioriteit: PRIORITEITEN.includes(a.prioriteit) ? a.prioriteit : "normal",
      toelichting: kort(a.toelichting, MAX.toelichting),
      automatisch: a.automatisch === true,
      fase,
      datumHerkomst: datum && DATUM_HERKOMST.includes(a.datumHerkomst) ? a.datumHerkomst : null,
      datumBron: datum ? kort(a.datumBron, 300) || null : null,
      datumControle: datum && isEchteDatum(tekst(a.datumControle).slice(0, 10)) ? tekst(a.datumControle).slice(0, 10) : null
    };
    actie.sleutel = actieSleutelVan(actie);
    if (acties.some((x) => x.sleutel === actie.sleutel)) {
      waarschuw(pad, "dubbele-actie");
      return;
    }
    acties.push(actie);
  });
  regels.filter((r) => r.selecteerbaar && r.deadline.status !== DEADLINE_STATUS.GEVERIFIEERD).forEach((r) => {
    const v = verificatieActie(r, vandaag);
    v.sleutel = actieSleutelVan(v);
    if (!acties.some((x) => x.sleutel === v.sleutel)) acties.push(v);
  });
  const voorstel = {
    versie: VOORSTEL_VERSIE,
    projectId: raw.projectId,
    gegenereerdOp: isEchteDatum(tekst(raw.gegenereerdOp).slice(0, 10)) ? tekst(raw.gegenereerdOp).slice(0, 10) : vandaag,
    status,
    aannames: (Array.isArray(raw.aannames) ? raw.aannames : []).map((x) => kort(x && x.tekst != null ? x.tekst : x, 300)).filter(Boolean).slice(0, 8),
    regels,
    nietToegewezen: Math.max(0, gat - som),
    acties
  };
  return { ok: fouten.length === 0, voorstel, fouten, waarschuwingen };
}
function schaalNaarGat(regels, gat) {
  const lijstRegels = (regels || []).map((r) => ({ ...r }));
  const selecteerbaar = () => lijstRegels.filter((r) => r.selecteerbaar && r.bedrag);
  let som = selecteerbaar().reduce((t, r) => t + r.bedrag, 0);
  if (som <= gat || som === 0) {
    return lijstRegels;
  }
  const factor = gat / som;
  selecteerbaar().forEach((r) => {
    const min = r.grenzen && r.grenzen.min != null ? r.grenzen.min : 0;
    r.bedrag = Math.max(min, Math.floor(r.bedrag * factor));
  });
  som = selecteerbaar().reduce((t, r) => t + r.bedrag, 0);
  while (som > gat && selecteerbaar().length) {
    const kleinste = selecteerbaar().sort((x, y) => x.bedrag - y.bedrag)[0];
    som -= kleinste.bedrag;
    kleinste.bedrag = null;
    kleinste.selecteerbaar = false;
  }
  return lijstRegels;
}
function schaalEnControleer(raw, ctx) {
  const eerste = valideerVoorstel(raw, ctx);
  if (!eerste.voorstel || !eerste.fouten.some((f) => f.code === "boven-financieringsgat")) {
    return { ...eerste, geschaald: false };
  }
  const c = ctx || {};
  const gat = c.dekking && c.dekking.heeftBegroting ? Math.max(0, c.dekking.nogTePlannen || 0) : 0;
  const geschaald = schaalNaarGat(eerste.voorstel.regels, toegestaneSom(gat, c.dekkingsdoel));
  const perSleutel = new Map(geschaald.map((r) => [r.sleutel, r]));
  const ruweRegels = Array.isArray(raw.regels) ? raw.regels : [];
  const nieuweRegels = [];
  const vervallen = [];
  ruweRegels.forEach((r) => {
    const sleutel = r && r.type ? regelSleutelVan({ type: r.type, id: tekst(r.id).toLowerCase(), naam: kort(r.naam, MAX.naam) }) : null;
    const g = sleutel ? perSleutel.get(sleutel) : null;
    if (!g) {
      nieuweRegels.push(r);
      return;
    }
    if (g.selecteerbaar && g.bedrag) nieuweRegels.push({ ...r, bedrag: g.bedrag });
    else if (!g.selecteerbaar && !g.staatAl) vervallen.push(sleutel);
    else nieuweRegels.push(r);
  });
  const tweede = valideerVoorstel({ ...raw, regels: nieuweRegels }, c);
  return {
    ...tweede,
    geschaald: true,
    waarschuwingen: [...tweede.waarschuwingen, { pad: "regels", code: "bedragen-geschaald" }, ...vervallen.map((sl) => ({ pad: sl, code: "regel-vervallen-door-gat" }))]
  };
}

// supabase/functions/_shared/ipRanges.ts
var v6 = (...groepen) => {
  const uit = [];
  for (const g of groepen) uit.push(g >> 8 & 255, g & 255);
  while (uit.length < 16) uit.push(0);
  return uit;
};
var V6_VERBODEN_IN_GLOBAAL = [
  [v6(8193, 0), 23, "ietf-protocol-2001::/23 (o.a. Teredo, benchmarking, ORCHID)"],
  [v6(8193, 3512), 32, "documentatie-2001:db8::/32"],
  [v6(8194), 16, "6to4-2002::/16 (bevat een ingebed IPv4-adres)"],
  [v6(16383), 20, "documentatie-3fff::/20"]
];

// supabase/functions/_shared/voorstelToken.ts
var enc = new TextEncoder();

// supabase/functions/_shared/voorstelVerificatie.ts
var UUID2 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var isObject = (x) => typeof x === "object" && x !== null && !Array.isArray(x);
var sleutelVan = (type, id) => `${type}:${id.toLowerCase()}`;
function filterOpEntitlement(raw, records) {
  const perSleutel = /* @__PURE__ */ new Map();
  for (const r of records) {
    if (!r || typeof r.id !== "string" || !UUID2.test(r.id) || r.type !== "regeling" && r.type !== "fonds") continue;
    perSleutel.set(sleutelVan(r.type, r.id), r);
  }
  const ruwe = Array.isArray(raw.regels) ? raw.regels : [];
  const overgeslagen = [];
  const bruikbaar = [];
  const bekend = {};
  const toegestaan = /* @__PURE__ */ new Map();
  ruwe.slice(0, MAX_REGELS + 4).forEach((r, index) => {
    if (!isObject(r)) {
      overgeslagen.push({ index, code: "geen-object" });
      return;
    }
    if (r.type === "online") {
      overgeslagen.push({ index, code: "online-niet-ondersteund" });
      return;
    }
    const id = typeof r.id === "string" ? r.id.toLowerCase() : "";
    const rec = (r.type === "regeling" || r.type === "fonds") && UUID2.test(id) ? perSleutel.get(sleutelVan(r.type, id)) : void 0;
    if (!rec || rec.niveau !== "volledig") {
      overgeslagen.push({ index, code: "onbekende-bron" });
      return;
    }
    bekend[id] = {
      naam: rec.naam,
      gever: rec.gever ?? "",
      deadline: isEchteDatum(rec.deadline) ? rec.deadline : null,
      min: typeof rec.min === "number" ? rec.min : null,
      max: typeof rec.max === "number" ? rec.max : null,
      cofinanciering: rec.cofinanciering ?? null
    };
    toegestaan.set(id, rec);
    bruikbaar.push(r);
  });
  return { raw: { ...raw, regels: bruikbaar }, overgeslagen, bekend, records: toegestaan };
}

// supabase/functions/_shared/actieplanPlanning.ts
var PLANNING_STANDAARD = {
  voorbereidingsDagen: 42,
  extraVeeleisend: 14,
  maxVoorbereidingsDagen: 120,
  minVoorbereidingsDagen: 14,
  veeleisendVanafBedrag: 5e4,
  beoordelingMaanden: 3,
  besluitMaanden: 2,
  indienenVoorDeadlineDagen: 3
};
function plusDagen(iso, dagen) {
  const d = /* @__PURE__ */ new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dagen);
  return d.toISOString().slice(0, 10);
}
function plusMaanden(iso, maanden) {
  const d = /* @__PURE__ */ new Date(`${iso}T00:00:00Z`);
  const dag = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + maanden);
  const laatste = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dag, laatste));
  return d.toISOString().slice(0, 10);
}
function dagenTussen(van, tot) {
  return Math.round((Date.parse(`${tot}T00:00:00Z`) - Date.parse(`${van}T00:00:00Z`)) / 864e5);
}
var nl = (iso) => `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`;
var echt = (x) => typeof x === "string" && isEchteDatum(x);
var kort2 = (t, max) => String(t ?? "").replace(/\s+/g, " ").trim().slice(0, max);
var RANG = { bron: 0, berekend: 1, aanname: 2 };
var zwakste = (...h) => h.reduce((a, b) => RANG[b] > RANG[a] ? b : a, "bron");
var EENHEID_DAGEN = { dag: 1, dagen: 1, werkdag: 1, werkdagen: 1, week: 7, weken: 7, maand: 30, maanden: 30 };
function leesBehandeltermijn(tekst3) {
  const t = kort2(tekst3, 300);
  if (!t) return null;
  const l = t.toLowerCase();
  if (/vooraanvraag|quickscan|ontvangstbevestiging|reactie binnen|eerste reactie|reageren/.test(l)) return null;
  const treffers = [...l.matchAll(/(\d{1,3})(?:\s*(?:-|–|tot)\s*(\d{1,3}))?\s*(werkdagen|werkdag|dagen|dag|weken|week|maanden|maand)\b/g)];
  if (treffers.length !== 1) return null;
  const [, a, b, eenheid] = treffers[0];
  const hoog = Math.max(Number(a), b ? Number(b) : 0);
  const dagen = hoog * (EENHEID_DAGEN[eenheid] ?? 0);
  if (!(dagen > 0) || dagen > 400) return null;
  return { tekst: t, dagen, basis: /sluiting|deadline|sluitdatum|na de ronde|einde van de ronde/.test(l) ? "sluiting" : "indiening" };
}
function leesVoorlooptijdVergadering(...teksten) {
  for (const x of teksten) {
    const t = kort2(x, 800);
    const m = t.match(/(\d{1,2})\s*(werkdagen|dagen|dag|weken|week|maanden|maand)\s*(?:van tevoren\s*)?(?:v[oó]{1,2}r|voorafgaand aan)\s*(?:de\s*)?(?:bestuurs|commissie)?[- ]?vergadering/i);
    if (m) {
      const dagen = Number(m[1]) * (EENHEID_DAGEN[m[2].toLowerCase()] ?? 0);
      if (dagen > 0 && dagen <= 180) return { dagen, tekst: t.slice(Math.max(0, (m.index ?? 0) - 40), (m.index ?? 0) + m[0].length + 20).trim() };
    }
  }
  return null;
}
function contactToegestaan(tekst3) {
  return !/(geen|niet)\s+(telefonisch\s+|persoonlijk\s+)?(contact|bellen|mailen)|contact\s+(vooraf\s+)?(is\s+)?niet\s+(toegestaan|mogelijk|gewenst)|neem\s+geen\s+contact/i.test(String(tekst3 ?? ""));
}
function voorbereidingDagen(opties, planning) {
  const basis = Math.min(PLANNING_STANDAARD.maxVoorbereidingsDagen, Math.max(PLANNING_STANDAARD.minVoorbereidingsDagen, Math.round(opties.voorbereidingsDagen ?? PLANNING_STANDAARD.voorbereidingsDagen)));
  let extra = 0;
  if (typeof opties.bedrag === "number" && opties.bedrag >= PLANNING_STANDAARD.veeleisendVanafBedrag) extra += PLANNING_STANDAARD.extraVeeleisend;
  if (/\b(cofinanciering|co-financiering|matching|eigen bijdrage verplicht|samenwerkingsverband|meerjarig)\b/i.test(`${planning.cofinanciering ?? ""} ${planning.aanvraagprocedure ?? ""}`)) extra += PLANNING_STANDAARD.extraVeeleisend;
  return Math.min(PLANNING_STANDAARD.maxVoorbereidingsDagen, basis + extra);
}
var GEEN = { datum: null, herkomst: null, bron: null };
function datumZin(d) {
  if (!d.datum || !d.herkomst) return "Nog geen datum: die volgt zodra het aanvraagmoment bekend is.";
  if (d.herkomst === "bron") return `Datum uit bron: ${d.bron}.`;
  if (d.herkomst === "berekend") return `Berekend: ${d.bron}.`;
  return `Voorlopige planningsaanname, geen datum van de financier: ${d.bron}. U kunt de datum aanpassen.`;
}
function planFinancier(naam, planningIn, vandaag, optiesIn = {}) {
  const planning = planningIn ?? {};
  const opties = optiesIn ?? {};
  const P = voorbereidingDagen(opties, planning);
  const controle = echt(planning.gecontroleerdOp) ? planning.gecontroleerdOp : null;
  const bronNaam = planning.bronUrl ? `bron: ${kort2(planning.bronUrl, 120)}` : "bron: database van Subsidiekompas";
  const bronTekst = (wat) => `${wat} (${bronNaam}${controle ? `, gecontroleerd ${nl(controle)}` : ", controledatum onbekend"})`;
  const waarschuwingen = [];
  const aannames = [];
  const status = kort2(planning.status, 40);
  const statusLaag = status.toLowerCase();
  const gesloten = /gesloten|budget uitgeput/.test(statusLaag);
  const vergaderdatum = echt(planning.vergaderdatum) && planning.vergaderdatum >= vandaag ? planning.vergaderdatum : null;
  const voorlooptijd = vergaderdatum ? leesVoorlooptijdVergadering(planning.aanvraagprocedure, planning.vergaderToelichting, planning.behandeltermijn) : null;
  const termijn = leesBehandeltermijn(planning.behandeltermijn) ?? leesBehandeltermijn(planning.beoordelingsperiode);
  const termijnTekst = kort2(planning.behandeltermijn || planning.beoordelingsperiode, 200) || null;
  let deadline = null;
  let deadlineInfo = GEEN;
  if (echt(planning.deadline)) {
    if (planning.deadline >= vandaag) {
      deadline = planning.deadline;
      deadlineInfo = { datum: deadline, herkomst: "bron", bron: bronTekst(`aanvraagdeadline ${nl(deadline)}`) };
    } else if (echt(planning.volgendeRonde) && planning.volgendeRonde >= vandaag) {
      deadline = planning.volgendeRonde;
      deadlineInfo = { datum: deadline, herkomst: "bron", bron: bronTekst(`aanvraagdeadline ${nl(deadline)} (volgende ronde)`) };
      waarschuwingen.push(`De deadline van ${nl(planning.deadline)} is verstreken; het plan gaat uit van de volgende ronde (${nl(deadline)}).`);
    } else {
      waarschuwingen.push(`De deadline van ${nl(planning.deadline)} is verstreken en er is geen latere ronde bekend.`);
    }
  } else if (vergaderdatum && voorlooptijd) {
    const d = plusDagen(vergaderdatum, -voorlooptijd.dagen);
    if (d >= vandaag) {
      deadline = d;
      deadlineInfo = { datum: d, herkomst: "berekend", bron: bronTekst(`bestuursvergadering ${nl(vergaderdatum)} min ${voorlooptijd.dagen} dagen voorlooptijd, volgens de bron: "${kort2(voorlooptijd.tekst, 120)}"`) };
    } else {
      waarschuwingen.push(`De uiterste indiendatum voor de vergadering van ${nl(vergaderdatum)} is al verstreken.`);
    }
  }
  const doorlopend = !deadline && (/doorlopend/.test(statusLaag) || /geen vaste sluitingsdatum|doorlopend in te dienen|doorlopend aanvragen/i.test(String(planning.aanvraagprocedure ?? "")));
  const modus = deadline ? "deadline" : doorlopend ? "doorlopend" : vergaderdatum ? "vergadering" : "onbekend";
  const beschikbaar = deadline ? dagenTussen(vandaag, deadline) : null;
  const kortTijd = beschikbaar != null && beschikbaar < P;
  if (gesloten && !deadline) waarschuwingen.push(`De status van ${naam} is "${status}": dien pas in als de financier bevestigt dat er weer kan worden aangevraagd.`);
  if (kortTijd && beschikbaar != null) waarschuwingen.push(`Voorbereidingstijd kort: nog ${beschikbaar} dagen tot de deadline; standaard is ${P} dagen (6 weken) nodig.`);
  let S = GEEN;
  let T0 = null;
  if (deadline) {
    const voor = Math.min(PLANNING_STANDAARD.indienenVoorDeadlineDagen, Math.max(0, beschikbaar ?? 0));
    const sd2 = plusDagen(deadline, -voor);
    S = { datum: sd2 < vandaag ? vandaag : sd2, herkomst: zwakste("berekend", deadlineInfo.herkomst ?? "bron"), bron: `${PLANNING_STANDAARD.indienenVoorDeadlineDagen} dagen v\xF3\xF3r de ${nl(deadline)}-deadline, als buffer` };
    T0 = deadline && plusDagen(deadline, -P) > vandaag ? plusDagen(deadline, -P) : vandaag;
  } else if (modus === "doorlopend") {
    const sd2 = plusDagen(vandaag, P);
    S = { datum: sd2, herkomst: "aanname", bron: `eigen streefdatum: ${P} dagen voorbereiding vanaf vandaag; de regeling is doorlopend, u kiest zelf het indienmoment` };
    T0 = vandaag;
    aannames.push(`${naam}: doorlopende regeling, indienmoment is een eigen streefdatum (${nl(sd2)}).`);
  }
  const stappen = [];
  const maak = (fase, titel, prioriteit, tekst3, d, extern = null) => {
    stappen.push({
      titel: kort2(titel, 200),
      fase,
      datum: d.datum && d.datum < vandaag ? vandaag : d.datum,
      datumHerkomst: d.datum ? d.herkomst : null,
      datumBron: d.datum ? d.bron : null,
      datumControle: d.datum ? controle : null,
      externeDeadline: extern,
      prioriteit,
      toelichting: kort2(`${tekst3} ${datumZin(d)}`, 600)
    });
  };
  const eigen = (iso, herkomst, bron) => iso ? { datum: iso, herkomst, bron } : GEEN;
  const contactOk = contactToegestaan(planning.aanvraagprocedure);
  const kortZin = kortTijd && beschikbaar != null ? `Voorbereidingstijd kort: nog ${beschikbaar} dagen tot de deadline (standaard ${P}). ` : "";
  if (modus === "deadline" && T0 && deadline) {
    const sd2 = S.datum;
    const span = Math.max(0, dagenTussen(T0, sd2));
    const op = (fractie) => plusDagen(T0, Math.round(span * fractie));
    const afgeleid = (iso, wat) => ({ datum: iso, herkomst: "berekend", bron: `${wat}, teruggerekend vanaf ${deadlineInfo.bron}` });
    const startBron = (iso) => afgeleid(iso, kortTijd ? `start voorbereiding nu, door de korte tijd samengedrukt in ${beschikbaar} dagen` : `start ${P} dagen (6 weken) v\xF3\xF3r de deadline`);
    maak("passendheid", `Passendheid van ${naam} beoordelen`, "high", `${kortZin}Lees de actuele voorwaarden, doelgroep en werkgebied en noteer wat niet past of onduidelijk is.`, startBron(op(0)));
    maak("adviseur", `Subsidieadviseur raadplegen over ${naam}: go/no-go en aanpak`, "high", "Bespreek of de aanvraag kans maakt, hoe u haar het best opbouwt en welke stukken nodig zijn.", startBron(op(0)));
    if (contactOk) {
      maak("contact", `Contact opnemen met ${naam} (vooroverleg of contactpersoon)`, "normal", "Toets uw plan kort bij de financier en vraag naar de behandeltermijn en de werkwijze bij aanvullende vragen.", startBron(op(0)));
    } else {
      maak("contact", `Vragen aan ${naam} alleen via de gepubliceerde kanalen stellen`, "low", "De financier vraagt om geen losse contactopname vooraf; gebruik het portaal of de gepubliceerde route voor vragen.", startBron(op(0)));
    }
    maak("stukken", "Projectstukken verzamelen (begroting, plan, samenwerkingsafspraken)", "normal", "Begroting, projectplan, statuten en eventuele samenwerkings- of cofinancieringsafspraken.", afgeleid(op(0.25), "tussen start en indienen"));
    maak("schrijven", `Aanvraag bij ${naam} schrijven`, "high", "Schrijf de aanvraag langs de beoordelingscriteria van de financier.", afgeleid(op(0.5), "tussen start en indienen"));
    maak("review", `Feedback op de aanvraag voor ${naam} vragen en de tekst controleren`, "normal", "Laat de aanvraag door een collega of adviseur lezen en controleer bedragen, bijlagen en voorwaarden.", afgeleid(op(0.8), "kort voor indienen"));
    maak(
      "indienen",
      `Aanvraag bij ${naam} indienen`,
      "high",
      `Externe deadline van de financier: ${nl(deadline)}${planning.deadlineOmschrijving ? ` (${kort2(planning.deadlineOmschrijving, 120)})` : ""}.${kortTijd && planning.volgendeRonde && echt(planning.volgendeRonde) ? ` Is dit te krap? De volgende ronde sluit op ${nl(planning.volgendeRonde)}.` : ""}`,
      S,
      deadline
    );
  } else {
    const start = eigen(plusDagen(vandaag, 7), "aanname", "eigen streefdatum om dit nu uit te zoeken");
    const reden = modus === "doorlopend" ? "Deze regeling is doorlopend, maar een behandeltermijn en eventuele aanmeldstappen (zoals een quickscan) moeten bevestigd worden." : modus === "vergadering" ? `Er is een bestuursvergadering op ${nl(vergaderdatum)}, maar niet bekend hoe lang vooraf een aanvraag binnen moet zijn.` : gesloten ? `De status is "${status}".` : "Er is geen betrouwbare aanvraagdeadline bekend.";
    maak("navragen", navragenTitel(naam), "high", `${reden} Vraag het aanvraagmoment en de behandeltermijn na bij de financier of lees ze op de website na.${termijnTekst ? ` Volgens onze bron: "${termijnTekst}".` : ""}`, start);
    maak("passendheid", `Passendheid van ${naam} beoordelen`, "high", "Lees de actuele voorwaarden, doelgroep en werkgebied en noteer wat niet past of onduidelijk is.", start);
    maak("adviseur", `Subsidieadviseur raadplegen over ${naam}: go/no-go en aanpak`, "high", "Bespreek of de aanvraag kans maakt en hoe u haar het best opbouwt.", start);
    if (modus === "doorlopend" && T0) {
      const sd2 = S.datum;
      const span = Math.max(0, dagenTussen(T0, sd2));
      const op = (f) => ({ datum: plusDagen(T0, Math.round(span * f)), herkomst: "aanname", bron: S.bron });
      maak("stukken", "Projectstukken verzamelen (begroting, plan, samenwerkingsafspraken)", "normal", "Begroting, projectplan, statuten en eventuele samenwerkings- of cofinancieringsafspraken.", op(0.25));
      maak("schrijven", `Aanvraag bij ${naam} schrijven`, "high", "Schrijf de aanvraag langs de beoordelingscriteria van de financier.", op(0.5));
      maak("review", `Feedback op de aanvraag voor ${naam} vragen en de tekst controleren`, "normal", "Laat de aanvraag door een collega of adviseur lezen.", op(0.8));
      maak("indienen", `Aanvraag bij ${naam} indienen`, "high", "Er is geen deadline: dien in als de aanvraag klaar is en de financier bevestigde dat dit past.", S);
    } else {
      maak("stukken", "Projectstukken verzamelen (begroting, plan, samenwerkingsafspraken)", "normal", "Begroting, projectplan, statuten en eventuele samenwerkings- of cofinancieringsafspraken.", GEEN);
      maak("schrijven", `Aanvraag bij ${naam} schrijven`, "high", "Schrijf de aanvraag zodra het aanvraagmoment bekend is.", GEEN);
      maak("review", `Feedback op de aanvraag voor ${naam} vragen en de tekst controleren`, "normal", "Laat de aanvraag door een collega of adviseur lezen.", GEEN);
      maak("indienen", `Aanvraag bij ${naam} indienen`, "high", "Plan het indienmoment zodra de financier het aanvraagmoment bevestigde.", GEEN);
    }
  }
  const heeftS = Boolean(S.datum);
  const sd = S.datum;
  let besluit = GEEN;
  const beoordelingBekend = echt(planning.beoordelingsdatum) && planning.beoordelingsdatum >= vandaag && (!sd || planning.beoordelingsdatum >= sd) ? planning.beoordelingsdatum : null;
  const vergaderNaIndienen = vergaderdatum && (!sd || vergaderdatum >= sd) ? vergaderdatum : null;
  const beoordelingDatum = beoordelingBekend ?? vergaderNaIndienen;
  const beoordelingInfo = beoordelingBekend ? { datum: beoordelingBekend, herkomst: "bron", bron: bronTekst(`beoordelingsdatum ${nl(beoordelingBekend)}`) } : vergaderNaIndienen ? { datum: vergaderNaIndienen, herkomst: "bron", bron: bronTekst(`bestuursvergadering ${nl(vergaderNaIndienen)}`) } : GEEN;
  if (vergaderdatum && sd && vergaderdatum < sd) waarschuwingen.push(`De bestuursvergadering van ${nl(vergaderdatum)} valt v\xF3\xF3r de geplande indiening en telt daarom niet mee.`);
  if (termijn && heeftS && sd) {
    const basis = termijn.basis === "sluiting" && deadline ? deadline : sd;
    const bd = plusDagen(basis, termijn.dagen);
    const basisHerkomst = termijn.basis === "sluiting" && deadline ? deadlineInfo.herkomst ?? "bron" : S.herkomst ?? "aanname";
    const termijnBron = `behandeltermijn volgens de bron: "${termijn.tekst}" (${termijn.basis === "sluiting" ? "vanaf sluiting van de ronde" : "vanaf indiening"}, bovengrens aangehouden; ${bronNaam}${controle ? `, gecontroleerd ${nl(controle)}` : ""})`;
    const uit = beoordelingDatum && beoordelingDatum > bd ? beoordelingInfo : { datum: bd, herkomst: zwakste("berekend", basisHerkomst), bron: termijnBron };
    besluit = uit;
  } else if (heeftS && sd) {
    const bm = opties.beoordelingMaanden ?? PLANNING_STANDAARD.beoordelingMaanden;
    const dm = opties.besluitMaanden ?? PLANNING_STANDAARD.besluitMaanden;
    const beoordeling = beoordelingDatum ?? plusMaanden(sd, bm);
    const bd = plusMaanden(beoordeling, dm);
    besluit = { datum: bd, herkomst: "aanname", bron: `${beoordelingDatum ? `beoordelingsmoment ${nl(beoordeling)} uit de bron` : `beoordeling \xB1${bm} maanden na indienen`} en besluit \xB1${dm} maanden daarna; er is geen gepubliceerde behandeltermijn gevonden${termijnTekst ? ` (de bron zegt: "${termijnTekst}", dat is niet eenduidig te lezen)` : ""}` };
    aannames.push(`${naam}: besluit \xB1${bm + dm} maanden na indienen is een voorlopige planningsaanname, geen termijn van de financier.`);
  }
  const onbepaald = !heeftS;
  const na = (d, n) => d ? plusDagen(d, n) : null;
  maak("ontvangst", `Ontvangstbevestiging van ${naam} controleren`, "normal", "Controleer of de aanvraag is ontvangen en volledig is bevonden; vraag het na als u niets hoort.", eigen(na(sd, 5), sd ? zwakste("berekend", S.herkomst ?? "berekend") : "aanname", "vijf dagen na de geplande indiening"));
  maak("vragen", `Aanvullende vragen van ${naam} beantwoorden`, "normal", "Houd uw mailbox en het portaal in de gaten en antwoord binnen de gevraagde termijn.", eigen(na(sd, 14), "aanname", "twee weken na de geplande indiening als eigen controlemoment"));
  if (beoordelingDatum && beoordelingInfo.datum) {
    maak("beoordeling", `Beoordelings- of vergadermoment van ${naam} volgen`, "normal", modus === "vergadering" ? "Alleen relevant als de aanvraag ruim voor deze vergadering binnen is; vraag na hoe lang vooraf dat moet." : "Volg de beoordeling en reageer op eventuele vragen.", beoordelingInfo);
  } else if (!termijn && heeftS && sd) {
    const bm = opties.beoordelingMaanden ?? PLANNING_STANDAARD.beoordelingMaanden;
    maak("beoordeling", `Beoordelingsmoment van ${naam} navragen en volgen`, "normal", "Vraag na wanneer de beoordeling plaatsvindt en volg de voortgang.", eigen(plusMaanden(sd, bm), "aanname", `\xB1${bm} maanden na de geplande indiening`));
  } else if (onbepaald) {
    maak("beoordeling", `Beoordelings- of vergadermoment van ${naam} volgen`, "normal", "Volg het beoordelingsmoment zodra het bekend is.", GEEN);
  }
  maak("besluit", `Verwachte beslissing van ${naam} volgen`, "normal", termijn && besluit.datum ? "Volg de beslissing op basis van de gepubliceerde behandeltermijn." : "De verwachte beslisdatum is een inschatting; pas hem aan zodra de financier een termijn noemt.", besluit);
  maak("vervolg", `Vervolgstappen na de beslissing van ${naam} bepalen`, "low", "Bij toekenning: voorwaarden, uitbetaling en rapportage regelen. Bij afwijzing: om feedback vragen en een alternatief kiezen.", eigen(na(besluit.datum, 7), besluit.datum ? zwakste("berekend", besluit.herkomst ?? "aanname") : "aanname", "een week na de verwachte beslissing"));
  return {
    stappen,
    samenvatting: {
      modus,
      voorbereidingsDagen: P,
      beschikbareDagen: beschikbaar,
      voorbereidingKort: kortTijd,
      deadline,
      indiendatum: sd,
      vergaderdatum,
      besluitdatum: besluit.datum,
      besluitHerkomst: besluit.herkomst,
      behandeltermijn: termijn,
      behandeltermijnTekst: termijnTekst,
      aannames,
      waarschuwingen
    }
  };
}

// supabase/functions/_shared/actieplanStappen.ts
var MAX_TITEL = 200;
function plusDagen2(iso, dagen) {
  if (!isEchteDatum(iso)) return null;
  const d = /* @__PURE__ */ new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dagen);
  return d.toISOString().slice(0, 10);
}
function plantRegel(regel, vandaag, opties = {}) {
  const geverifieerd = Boolean(regel.deadline && regel.deadline.status === "geverifieerd" && regel.deadline.datum && isEchteDatum(regel.deadline.datum));
  const planning = { ...opties.planning ?? {}, deadline: geverifieerd ? regel.deadline.datum : null };
  const plan = planFinancier(regel.naam, planning, vandaag, { bedrag: regel.bedrag, ...opties.planningOpties ?? {} });
  const sm = plan.samenvatting;
  const basis = { regelSleutel: regel.sleutel, financier: regel.naam, datumType: "streef", automatisch: true, datumControle: null };
  if (sm.deadline) {
    const ind = plan.stappen.find((s) => s.fase === "indienen");
    const bes = plan.stappen.find((s) => s.fase === "besluit");
    const besluitBekend = Boolean(sm.behandeltermijn || planning.beoordelingsdatum && planning.beoordelingsdatum >= vandaag || planning.vergaderdatum) && Boolean(bes?.datum);
    const besluitDatum = besluitBekend && bes?.datum ? bes.datum : plusMaanden(sm.deadline, 3);
    const acties = [
      {
        ...basis,
        titel: `Aanvraag bij ${regel.naam} indienen`.slice(0, MAX_TITEL),
        datum: sm.deadline,
        externeDeadline: sm.deadline,
        prioriteit: "high",
        toelichting: `Uiterste indiendatum: ${sm.deadline}.`,
        fase: "indienen",
        datumHerkomst: sm.deadline === planning.deadline ? "bron" : ind?.datumHerkomst ?? "berekend",
        datumBron: sm.deadline === planning.deadline ? "sluitingsdatum van de financier" : ind?.datumBron ?? null
      },
      {
        ...basis,
        titel: `Uitslag van ${regel.naam} verwacht`.slice(0, MAX_TITEL),
        datum: besluitDatum,
        externeDeadline: null,
        prioriteit: "normal",
        toelichting: besluitBekend ? "Volgens de behandeltermijn van de financier." : "Binnen ongeveer 3 maanden na indienen.",
        fase: "besluit",
        datumHerkomst: besluitBekend ? bes?.datumHerkomst ?? "berekend" : "aanname",
        datumBron: besluitBekend ? bes?.datumBron ?? null : "ongeveer 3 maanden na indienen"
      }
    ];
    return { acties, samenvatting: sm };
  }
  const datum = plusDagen2(vandaag, 7);
  return {
    acties: [
      {
        ...basis,
        titel: navragenTitel(regel.naam),
        datum,
        externeDeadline: null,
        prioriteit: "high",
        toelichting: "Er is nog geen indiendatum bekend. Vraag na of uw project past, wanneer u kunt aanvragen en hoe lang de behandeling duurt.",
        fase: "navragen",
        datumHerkomst: datum ? "aanname" : null,
        datumBron: datum ? "eigen streefdatum" : null
      }
    ],
    samenvatting: sm
  };
}
function plantActies(regel, vandaag, opties = {}) {
  return plantRegel(regel, vandaag, opties).acties;
}

// supabase/functions/_shared/voorstelGenereren.ts
var MELDING_GEEN_PASSENDE_FINANCIERS = "Er zijn met dit zoekprofiel geen sterke, passende financiers gevonden. Pas het zoekprofiel aan (bijvoorbeeld een extra discipline of werkgebied) en probeer het opnieuw.";
var UUID3 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function planningVan(records, regel) {
  const r = (records ?? []).find((x) => x && x.niveau === "volledig" && x.type === regel.type && String(x.id).toLowerCase() === String(regel.id ?? "").toLowerCase());
  return r?.planning ?? null;
}
var tekst2 = (x, max) => String(x ?? "").replace(/\s+/g, " ").trim().slice(0, max);
var isObject2 = (x) => typeof x === "object" && x !== null && !Array.isArray(x);
var getal2 = (x) => typeof x === "number" && Number.isFinite(x) && x >= 0 ? Math.round(x) : typeof x === "string" && x.trim() !== "" && Number.isFinite(Number(x)) && Number(x) >= 0 ? Math.round(Number(x)) : null;
function kandidaatNaarMix(k2, niveau) {
  const row = k2?.row;
  if (!isObject2(row) || row._extern) return null;
  const regeling = k2.bron === "regeling";
  const id = String(regeling ? row.regeling_id ?? "" : row.funder_id ?? "").toLowerCase();
  if (!UUID3.test(id)) return null;
  const naam = tekst2(regeling ? row.naam : row.funder_naam, 200);
  if (!naam) return null;
  return {
    sleutel: `${regeling ? "regeling" : "fonds"}:${id}`,
    type: regeling ? "regeling" : "fonds",
    id,
    naam,
    niveau,
    accessTier: k2.accessTier,
    relevant: k2.relevant === true,
    score: Number.isFinite(k2.score) ? k2.score : 0,
    min: getal2(row.bedrag_min ?? row.bijdrage_min),
    max: getal2(row.bedrag_max ?? row.bijdrage_max),
    band: tekst2(row.bandbreedte_bijdrage_naam, 60) || null,
    cofinanciering: tekst2(row.cofinanciering, 200) || null,
    // Serviceclub (lokale vermelding of internationaal clubfonds zoals de Rotary Global Grant): telt mee maar staat onderaan, als "optioneel te onderzoeken".
    ...isServiceclub(row) ? { optioneel: true } : {},
    ...k2.geografie?.lokaal === true ? { lokaal: true } : {}
  };
}
function motivatieVan(k2) {
  const waarom = (k2.waarom || []).map((w) => tekst2(w, 160)).filter(Boolean).slice(0, 3);
  return waarom.length ? waarom.join(" \xB7 ").slice(0, 600) : "Past op uw doelgroep, werkgebied en discipline volgens de matching van Subsidiekompas.";
}
function kenmerkenVan(rec, k2) {
  if (!rec || rec.niveau !== "volledig") return null;
  const band = tekst2(rec.bandbreedte, 120);
  const bedragen = rec.min != null || rec.max != null ? [rec.min != null ? `vanaf \u20AC ${rec.min.toLocaleString("nl-NL")}` : "", rec.max != null ? `tot \u20AC ${rec.max.toLocaleString("nl-NL")}` : ""].filter(Boolean).join(" ") : "";
  const bandbreedte = [band, bedragen].filter(Boolean).join(" \xB7 ") || null;
  const lijstVan = (l) => Array.isArray(l) ? l.map((x) => tekst2(x, 80)).filter(Boolean).slice(0, 10) : [];
  return {
    beschrijving: tekst2(rec.omschrijving, 400) || tekst2(rec.aanvraagcriteria, 400) || null,
    doelgroepen: lijstVan(rec.doelgroepen),
    disciplines: lijstVan(rec.themas),
    werkgebieden: lijstVan(rec.werkgebieden),
    bandbreedte,
    website: typeof rec.website === "string" && /^https:\/\//i.test(rec.website) ? rec.website.slice(0, 500) : null,
    passendheid: k2?.passendheid === "aantoonbaar" || k2?.passendheid === "mogelijk" ? k2.passendheid : null,
    controleren: (k2?.controleren ?? []).map((c) => tekst2(c, 220)).filter(Boolean).slice(0, 6)
  };
}
function zwaktesVan(k2) {
  return (k2.zwaktes || []).map((w) => tekst2(w, 280)).filter(Boolean).slice(0, 3);
}
function beperkActies(acties) {
  const stukken = acties.filter((a) => String(a.titel || "").startsWith("Projectstukken verzamelen"));
  const rest = acties.filter((a) => !stukken.includes(a));
  if (!stukken.length) return rest;
  const vroegste = stukken.map((a) => String(a.datum || "")).filter(Boolean).sort()[0] || null;
  return [{ ...stukken[0], regelSleutel: null, financier: "", datum: vroegste, externeDeadline: null }, ...rest];
}
function valideerActiesGegroepeerd(raw, ctx, acties) {
  const groepen = /* @__PURE__ */ new Map();
  for (const a of acties) {
    const k2 = String(a.regelSleutel ?? "");
    groepen.set(k2, [...groepen.get(k2) ?? [], a]);
  }
  const uit = [];
  const gezien = /* @__PURE__ */ new Set();
  for (const groep of groepen.values()) {
    const u = valideerVoorstel({ ...raw, acties: groep }, ctx);
    for (const a of u.voorstel?.acties ?? []) {
      if (String(a.regelSleutel ?? "") !== String(groep[0]?.regelSleutel ?? "")) continue;
      const s = String(a.sleutel);
      if (gezien.has(s)) continue;
      gezien.add(s);
      uit.push(a);
    }
  }
  return uit;
}
function bouwVoorstel(inv) {
  const perSleutel = new Map(inv.kandidaten.map((k2) => [k2.mix.sleutel, k2]));
  const zonder = inv.zonderBedrag === true;
  const lijstZonder = zonder ? selecteerZonderBedrag({ kandidaten: inv.kandidaten.map((k2) => k2.mix), config: inv.config }) : null;
  const mix = lijstZonder ? {
    uitkomst: lijstZonder.regels.length ? "bedrag-onbekend" : "geen-kandidaten",
    gat: 0,
    doelBedrag: 0,
    som: 0,
    dekking: 0,
    mix: lijstZonder.regels.map((k2) => ({
      sleutel: k2.sleutel,
      type: k2.type,
      id: k2.id,
      naam: k2.naam,
      score: k2.score,
      bedrag: null,
      grond: "aandeel-van-gat",
      uitleg: "Het bedrag van dit project is nog onbekend: er is geen bedrag voorgesteld.",
      ...k2.optioneel ? { optioneel: true } : {},
      onzekerheden: [...k2.optioneel ? [OPTIONEEL_TEKST] : [], "Er is nog geen bedrag voorgesteld: de matching op bedrag is beperkt. Controleer de bijdragegrenzen van de financier.", ...k2.cofinanciering ? [`Cofinancieringseis (niet automatisch doorgerekend): ${String(k2.cofinanciering).slice(0, 200)}`] : []]
    })),
    reserve: null,
    reserves: [],
    afgewezen: lijstZonder.afgewezen,
    melding: lijstZonder.regels.length ? null : MELDING_GEEN_PASSENDE_FINANCIERS
  } : selecteerDekkingsmix({ kandidaten: inv.kandidaten.map((k2) => k2.mix), gat: gatVan(inv.dekking), config: inv.config });
  const regelVan = (m, reserve) => {
    const e = perSleutel.get(m.sleutel)?.engine;
    const rec = inv.records.find((r) => r.type === m.type && String(r.id).toLowerCase() === m.id);
    return {
      kenmerken: kenmerkenVan(rec, e),
      type: m.type,
      id: m.id,
      naam: m.naam,
      gever: tekst2(e?.funderNaam || m.naam, 200),
      bedrag: reserve ? null : m.bedrag,
      motivatie: e ? motivatieVan(e) : "",
      onderdeel: reserve ? "Reserve: telt niet mee in de dekking" : m.optioneel ? OPTIONEEL_ONDERDEEL : "",
      onzekerheden: [...m.onzekerheden, ...e ? zwaktesVan(e) : []].slice(0, 6)
    };
  };
  const regels = [...mix.mix.map((m) => regelVan(m, false)), ...(mix.reserves ?? []).map((m) => regelVan(m, true))];
  const aannames = [zonder ? BEDRAG_INDICATIE_TEKST_ZONDER_BEDRAG : BEDRAG_INDICATIE_TEKST, ...inv.aannames ?? []].map((a) => tekst2(a, 300)).filter(Boolean).slice(0, 8);
  const ruw = { versie: VOORSTEL_VERSIE, projectId: inv.projectId, gegenereerdOp: inv.vandaag, status: "concept", aannames, regels, acties: [] };
  const gefilterd = filterOpEntitlement(ruw, inv.records);
  const ctx = {
    projectId: inv.projectId,
    dekking: inv.dekking,
    bestaandeRegels: inv.bestaandeRegels,
    bedragenToegestaan: inv.bedragenToegestaan,
    vandaag: inv.vandaag,
    bekendeBronnen: gefilterd.bekend,
    opgehaaldeBronnen: [],
    dekkingsdoel: inv.config.dekkingsdoel
  };
  const eerste = schaalEnControleer(gefilterd.raw, ctx);
  let gevalideerd = eerste;
  if (eerste.voorstel) {
    const acties = beperkActies(eerste.voorstel.regels.filter((r) => r.selecteerbaar && (zonder || r.bedrag != null)).flatMap((r) => plantActies(r, inv.vandaag, { heeftBedrag: !zonder, planning: planningVan(inv.records, r) })));
    if (acties.length) {
      const gevalideerdeActies = valideerActiesGegroepeerd(gefilterd.raw, ctx, acties);
      gevalideerd = { ...eerste, voorstel: { ...eerste.voorstel, acties: gevalideerdeActies } };
    }
  }
  const reserveSleutels = (mix.reserves ?? []).map((m) => `r:${m.type}:${m.id}`);
  return { mix, ruw, gevalideerd, reserveSleutel: reserveSleutels[0] ?? null, reserveSleutels };
}
function gatVan(dekking) {
  const d = isObject2(dekking) ? dekking : {};
  return d.heeftBegroting === true && typeof d.nogTePlannen === "number" ? Math.max(0, Math.round(d.nogTePlannen)) : 0;
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
var enc2 = new TextEncoder();

// tests/tier/serviceclubs.test.mjs
stand.naam = "serviceclubs";
var PRO2 = tierConfigVoor("pro");
var PREMIUM2 = tierConfigVoor("premium");
var teller = 0;
var k = (naam, score, min, max, extra = {}) => {
  teller += 1;
  const id = `00000000-0000-4000-8000-${String(teller).padStart(12, "0")}`;
  return { sleutel: `fonds:${id}`, type: "fonds", id, naam, niveau: "volledig", accessTier: "pro", relevant: true, score, min, max, ...extra };
};
sectie("1. Welk record is een serviceclub-vermelding");
{
  gelijk("service_club met Regionaal: ja", isServiceclubVermelding({ funder_type: "service_club", werkgebieden_namen: ["Landelijk", "Regionaal"] }), true);
  gelijk("internationaal clubfonds (geen Regionaal): nee", isServiceclubVermelding({ funder_type: "service_club", werkgebieden_namen: ["Wereld / Internationaal"] }), false);
  gelijk("ander type met Regionaal: nee", isServiceclubVermelding({ funder_type: "fonds", werkgebieden_namen: ["Regionaal"] }), false);
  gelijk("type_gever werkt ook", isServiceclubVermelding({ type_gever: "service_club", werkgebieden_namen: ["Regionaal"] }), true);
  gelijk("rommel geeft false", isServiceclubVermelding(null), false);
  gelijk("geen werkgebieden: nee", isServiceclubVermelding({ funder_type: "service_club" }), false);
}
sectie("2. Poort: regionaal, onderwerp, buitenland");
{
  const basis = { themas: [], doelgroepen: ["Kinderen"], regios: ["Utrecht"], locatieTekst: "" };
  const b = (extra) => serviceclubBeoordeling({ ...basis, ...extra });
  gelijk("regionaal + kinderen: aanbieden", b({}).aanbieden, true);
  gelijk("regionaal + vrouwen en meisjes", b({ doelgroepen: ["Vrouwen en meisjes"] }).aanbieden, true);
  gelijk("regionaal + noodhulp (thema)", b({ doelgroepen: [], themas: ["Noodhulp"] }).aanbieden, true);
  gelijk("regionaal + noodhulp (activiteit)", b({ doelgroepen: [], activiteiten: ["noodhulp"] }).aanbieden, true);
  gelijk("plaats in vrije tekst telt als regionaal", b({ regios: [], locatieTekst: "Zutphen" }).aanbieden, true);
  gelijk("landelijk project: niet aanbieden", b({ regios: ["Landelijk"] }).reden, "niet-regionaal");
  gelijk('"heel Nederland": niet aanbieden', b({ regios: [], locatieTekst: "Heel Nederland" }).reden, "niet-regionaal");
  gelijk("geen werkgebied bekend: niet aanbieden", b({ regios: [], locatieTekst: "" }).reden, "werkgebied-onbekend");
  gelijk("regionaal maar niets met kinderen, vrouwen of noodhulp: niet", b({ doelgroepen: ["Ouderen"], themas: ["Cultuur"] }).reden, "onderwerp");
  gelijk("regionaal + armoedebestrijding (thema)", b({ doelgroepen: [], themas: ["Armoedebestrijding"] }).aanbieden, true);
  gelijk("regionaal + zelfredzaamheid (thema)", b({ doelgroepen: [], themas: ["Armoede/zelfredzaamheid"] }).aanbieden, true);
  gelijk("buitenlands project over armoedebestrijding: lokale clubroute niet, onderwerp wel (voor een internationaal clubfonds)", [b({ regios: ["Afrika"], doelgroepen: [], themas: ["Armoedebestrijding"] }).aanbieden, b({ regios: ["Afrika"], doelgroepen: [], themas: ["Armoedebestrijding"] }).onderwerp].join(), "false,true");
  gelijk("buitenland via regio", b({ regios: ["Afrika"] }).reden, "buitenland");
  gelijk("buitenland via locatietekst", b({ regios: [], locatieTekst: "Een school in Kenia" }).reden, "buitenland");
  gelijk("Caribisch deel: buitenland", b({ regios: ["Caribisch deel van het Koninkrijk"] }).reden, "buitenland");
  gelijk("Nederlandse plaats + buitenlandse regio: buitenland wint", b({ regios: ["Utrecht", "Wereld / Internationaal"] }).aanbieden, false);
}
sectie("3. Telt mee in de dekking maar staat helemaal onderaan");
{
  const club = (naam, score) => k(naam, score, 500, 2e3, { optioneel: true });
  const gewoon = k("Gewoon fonds", 60, 1e3, 1e4);
  const hoogClub = club("Soroptimisten", 95);
  const r = selecteerDekkingsmix({ kandidaten: [hoogClub, gewoon], gat: 2e4, config: PREMIUM2 });
  gelijk("gewoon fonds eerst, ook bij lagere score", r.mix[0].naam, "Gewoon fonds");
  gelijk("club staat onderaan", r.mix[r.mix.length - 1].naam, "Soroptimisten");
  check("club is gemarkeerd als optioneel", r.mix[r.mix.length - 1].optioneel === true);
  check("club-onzekerheid begint met de optioneel-tekst", r.mix[r.mix.length - 1].onzekerheden[0] === OPTIONEEL_TEKST);
  check("gewoon fonds is niet optioneel", !r.mix[0].optioneel && !r.mix[0].onzekerheden.includes(OPTIONEEL_TEKST));
  check("club telt mee in de som", r.som === r.mix.reduce((t, x) => t + x.bedrag, 0) && r.mix.some((x) => x.optioneel && x.bedrag > 0));
  const gewone = [k("Groot A", 70, 1e3, 1e5), k("Groot B", 69, 1e3, 1e5), k("Groot C", 68, 1e3, 1e5), k("Groot D", 67, 1e3, 1e5), k("Groot E", 66, 1e3, 1e5)];
  const zonderClub = selecteerDekkingsmix({ kandidaten: gewone, gat: 1e4, config: PRO2 });
  const r2 = selecteerDekkingsmix({ kandidaten: [hoogClub, ...gewone], gat: 1e4, config: PRO2 });
  gelijk("uitgangspunt: gewone fondsen halen het doel alleen", zonderClub.uitkomst, "doel-bereikt");
  check("doel gehaald zonder club: club niet in de mix", !r2.mix.some((x) => x.optioneel), JSON.stringify(r2.mix.map((x) => x.naam)));
  check("club is nooit de reserve", !(r2.reserve && r2.reserve.optioneel));
  const a = selecteerDekkingsmix({ kandidaten: [hoogClub, gewoon], gat: 2e4, config: PREMIUM2 });
  const bb = selecteerDekkingsmix({ kandidaten: [gewoon, hoogClub], gat: 2e4, config: PREMIUM2 });
  gelijk("deterministisch", JSON.stringify(a.mix.map((x) => x.sleutel)), JSON.stringify(bb.mix.map((x) => x.sleutel)));
  const z = selecteerZonderBedrag({ kandidaten: [hoogClub, gewoon], config: PREMIUM2 });
  gelijk("zonder bedrag: club onderaan", z.regels.map((x) => x.naam).join("|"), "Gewoon fonds|Soroptimisten");
}
sectie("4. Het databaserecord wordt optioneel gemarkeerd, de internationale clubfondsen niet");
{
  const uuid = "11111111-1111-4111-8111-111111111111";
  const maak = (row) => kandidaatNaarMix({ bron: "fonds", row: { funder_id: uuid, funder_naam: "Test", ...row }, accessTier: "premium", relevant: true, score: 80 }, "volledig");
  check("Rotary-achtig record: optioneel", maak({ funder_type: "service_club", werkgebieden_namen: ["Landelijk", "Regionaal"] })?.optioneel === true);
  check("internationaal clubfonds (zoals de Rotary Global Grant): ook optioneel, onderaan", maak({ funder_type: "service_club", werkgebieden_namen: ["Wereld / Internationaal"] })?.optioneel === true);
  check("gewoon fonds: niet optioneel", maak({ funder_type: "vermogensfonds", werkgebieden_namen: ["Landelijk"] })?.optioneel !== true);
  check("onderdeeltekst past in het contract (200)", OPTIONEEL_ONDERDEEL.length <= 200 && OPTIONEEL_TEKST.length <= 300, `${OPTIONEEL_TEKST.length}`);
}
sectie("5. In het echte voorstel: onderaan, onderdeel en tekst, bedrag telt mee");
{
  const maak = (id, naam, extra, score, min, max) => {
    const engine = { bron: "funder", row: { funder_id: id, funder_naam: naam, bijdrage_min: min, bijdrage_max: max, ...extra }, naam, funderNaam: naam, accessTier: "premium", relevant: true, score, waarom: [], zwaktes: [] };
    return { mix: kandidaatNaarMix(engine, "volledig"), engine };
  };
  const g = maak("22222222-2222-4222-8222-222222222222", "Gewoon Fonds", { funder_type: "vermogensfonds", werkgebieden_namen: ["Landelijk"] }, 70, 1e3, 8e3);
  const c = maak("33333333-3333-4333-8333-333333333333", "Soroptimisten Nederland", { funder_type: "service_club", werkgebieden_namen: ["Landelijk", "Regionaal"] }, 95, 500, 2e3);
  const records = [g, c].map(({ mix }) => ({ type: mix.type, id: mix.id, niveau: "volledig", naam: mix.naam, gever: mix.naam, min: mix.min, max: mix.max }));
  const u = bouwVoorstel({
    projectId: "44444444-4444-4444-8444-444444444444",
    vandaag: "2026-10-18",
    dekking: { heeftBegroting: true, nogTePlannen: 1e4 },
    bedragenToegestaan: true,
    bestaandeRegels: [],
    config: PREMIUM2,
    kandidaten: [c, g],
    records
  });
  const regels = u.ruw.regels;
  gelijk("gewoon fonds eerst", regels[0].naam, "Gewoon Fonds");
  gelijk("serviceclub laatst", regels[regels.length - 1].naam, "Soroptimisten Nederland");
  gelijk('serviceclub heeft onderdeel "Optioneel te onderzoeken"', regels[regels.length - 1].onderdeel, OPTIONEEL_ONDERDEEL);
  check("serviceclub heeft de uitleg over het zoeken naar een club in de regio", regels[regels.length - 1].onzekerheden.includes(OPTIONEEL_TEKST));
  check("serviceclub heeft een bedrag dat meetelt", typeof regels[regels.length - 1].bedrag === "number" && regels[regels.length - 1].bedrag > 0);
  check("gewoon fonds heeft geen onderdeel", regels[0].onderdeel === "");
  check("voorstel blijft geldig volgens het contract", u.gevalideerd.ok === true, JSON.stringify(u.gevalideerd.fouten?.slice(0, 3)));
  check("indicatietekst staat vooraan in de aannames", u.ruw.aannames[0] === BEDRAG_INDICATIE_TEKST, JSON.stringify(u.ruw.aannames));
  check("de tekst zegt: inschatting en overleg met de donor", /inschatting/.test(BEDRAG_INDICATIE_TEKST) && /overleg altijd zelf met de donor/i.test(BEDRAG_INDICATIE_TEKST));
  check("elke regel met bedrag wijst op overleg met de donor", regels.every((x) => x.onzekerheden.some((t) => /overleg met de donor/i.test(t))));
  check("aanname past in het contract (300 tekens)", BEDRAG_INDICATIE_TEKST.length <= 300 && BEDRAG_INDICATIE_TEKST_ZONDER_BEDRAG.length <= 300);
  const z = bouwVoorstel({ projectId: "44444444-4444-4444-8444-444444444444", vandaag: "2026-10-18", dekking: {}, bedragenToegestaan: false, zonderBedrag: true, bestaandeRegels: [], config: PREMIUM2, kandidaten: [g], records: records.slice(0, 1) });
  check("zonder bedrag: aparte tekst (geen bedragen voorgesteld, wel overleg met de donor)", z.ruw.aannames[0] === BEDRAG_INDICATIE_TEKST_ZONDER_BEDRAG, JSON.stringify(z.ruw.aannames));
}
klaar("serviceclubs");
