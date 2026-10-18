// Geografische geschiktheid op LANDNIVEAU voor fondsmatching. Zuivere functies: geen database, geen netwerk, geen modelaanroep.
//
// Waarom: de fondsdatabase labelt werkgebieden grof (Afrika, Wereld / internationaal) en de rest staat in vrije tekst ("alleen projecten in Sub-Sahara
// Afrika", "ontwikkelingslanden", "derdewereldlanden"). Een project in Kumasi, Ghana moet daarom gekoppeld worden aan fondsen die Ghana noemen, maar ook
// aan fondsen voor West-Afrika, Sub-Sahara Afrika, Afrika, ontwikkelingslanden of wereldwijd, en NIET aan fondsen die Ghana uitsluiten of die alleen
// andere landen/regio's noemen.
//
// Regels (in deze volgorde):
//   1. Een uitsluiting van het land (of van een regio/klasse waar het land onder valt) gaat altijd voor.
//   2. Beperkt het fonds zich in de tekst ("alleen", "uitsluitend", "beperkt tot") tot bepaalde landen of regio's en valt het land daar niet onder: niet geschikt.
//   3. Noemt het fonds het land, een regio, een werelddeel, een klasse (ontwikkelingslanden, minst ontwikkelde landen, Sub-Sahara, ook oudere termen als
//      derdewereldlanden) of "wereldwijd" waar het land onder valt: geschikt, met de sterkte van de aansluiting.
//   4. Zijn er wel werkgebiedlabels maar dekt geen enkel label het land: niet geschikt. Zijn er geen labels en geen aanwijzingen in de tekst: ONZEKER
//      (nooit een bevestigde match).
// Het land van het project komt uit de projectlocatie; niets hier is op één land, thema of bedrag afgestemd: de landen- en regiotabel is een algemene
// referentie. De indeling in ontwikkelingslanden is een benadering van de OESO-DAC-lijst en wordt nooit als enig bewijs voor een uitsluiting gebruikt.

export type Werkdeel = 'Afrika' | 'Azië' | 'Europa' | 'Noord-Amerika' | 'Midden-Amerika' | 'Zuid-Amerika' | 'Caribisch gebied' | 'Oceanië';

export interface LandInfo {
  naam: string;
  iso: string; // ISO 3166-1 alpha-2
  werelddeel: Werkdeel;
  regio: string; // subregio, bijvoorbeeld West-Afrika
  subSahara: boolean;
  ldc: boolean;
  ontwikkelingsland: boolean;
  koninkrijk: boolean; // Caribisch deel van het Koninkrijk der Nederlanden
}

// Per subregio: werelddeel | landen, gescheiden door ";" . "Naam=alias1/alias2" voegt alternatieve schrijfwijzen toe (Nederlands en Engels).
const TABEL: Array<[string, Werkdeel, string]> = [
  ['West-Afrika', 'Afrika', 'Benin;Burkina Faso;Kaapverdië=Cabo Verde/Cape Verde;Ivoorkust=Côte d\'Ivoire/Cote d\'Ivoire/Ivory Coast;Gambia;Ghana;Guinee=Guinea-Conakry;Guinee-Bissau=Guinea-Bissau;Liberia;Mali;Mauritanië=Mauritania;Niger;Nigeria;Senegal;Sierra Leone;Togo'],
  ['Oost-Afrika', 'Afrika', 'Burundi;Comoren=Comoros;Djibouti;Eritrea;Ethiopië=Ethiopia;Kenia=Kenya;Madagaskar=Madagascar;Malawi;Mauritius;Mozambique;Rwanda;Seychellen=Seychelles;Somalië=Somalia;Zuid-Soedan=South Sudan;Tanzania;Oeganda=Uganda;Zambia;Zimbabwe'],
  ['Centraal-Afrika', 'Afrika', 'Angola;Kameroen=Cameroon;Centraal-Afrikaanse Republiek=Central African Republic;Tsjaad=Chad;Congo-Brazzaville=Republic of the Congo;Democratische Republiek Congo=DR Congo/DRC/Congo-Kinshasa/Democratic Republic of the Congo;Equatoriaal-Guinea=Equatorial Guinea;Gabon;Sao Tomé en Principe=Sao Tome and Principe'],
  ['Zuidelijk Afrika', 'Afrika', 'Botswana;Eswatini=Swaziland;Lesotho;Namibië=Namibia;Zuid-Afrika=South Africa'],
  ['Noord-Afrika', 'Afrika', 'Algerije=Algeria;Egypte=Egypt;Libië=Libya;Marokko=Morocco;Soedan=Sudan;Tunesië=Tunisia'],
  ['Zuid-Azië', 'Azië', 'Afghanistan;Bangladesh;Bhutan;India;Malediven=Maldives;Nepal;Pakistan;Sri Lanka'],
  ['Zuidoost-Azië', 'Azië', 'Brunei;Cambodja=Cambodia;Indonesië=Indonesia;Laos;Maleisië=Malaysia;Myanmar=Birma/Burma;Filipijnen=Philippines;Singapore;Thailand;Oost-Timor=Timor-Leste/East Timor;Vietnam'],
  ['Oost-Azië', 'Azië', 'China;Japan;Mongolië=Mongolia;Noord-Korea=North Korea;Zuid-Korea=South Korea;Taiwan'],
  ['Centraal-Azië', 'Azië', 'Kazachstan=Kazakhstan;Kirgizië=Kyrgyzstan/Kirgizstan;Tadzjikistan=Tajikistan;Turkmenistan;Oezbekistan=Uzbekistan'],
  ['Midden-Oosten', 'Azië', 'Armenië=Armenia;Azerbeidzjan=Azerbaijan;Bahrein=Bahrain;Georgië=Georgia;Irak=Iraq;Iran;Israël=Israel;Jordanië=Jordan;Koeweit=Kuwait;Libanon=Lebanon;Oman;Palestina=Palestine/Palestijnse gebieden;Qatar;Saoedi-Arabië=Saudi Arabia;Syrië=Syria;Turkije=Turkey/Türkiye;Verenigde Arabische Emiraten=VAE/UAE/United Arab Emirates;Jemen=Yemen'],
  ['West-Europa', 'Europa', 'België=Belgium;Duitsland=Germany;Frankrijk=France;Ierland=Ireland;Luxemburg;Oostenrijk=Austria;Zwitserland=Switzerland;Verenigd Koninkrijk=VK/UK/United Kingdom/Engeland/England'],
  ['Noord-Europa', 'Europa', 'Denemarken=Denmark;Estland=Estonia;Finland;IJsland=Iceland;Letland=Latvia;Litouwen=Lithuania;Noorwegen=Norway;Zweden=Sweden'],
  ['Zuid-Europa', 'Europa', 'Albanië=Albania;Bosnië en Herzegovina=Bosnia;Griekenland=Greece;Italië=Italy;Kosovo;Kroatië=Croatia;Malta;Montenegro;Noord-Macedonië=North Macedonia;Portugal;Servië=Serbia;Slovenië=Slovenia;Spanje=Spain;Cyprus'],
  ['Oost-Europa', 'Europa', 'Belarus=Wit-Rusland;Bulgarije=Bulgaria;Hongarije=Hungary;Moldavië=Moldova;Oekraïne=Ukraine;Polen=Poland;Roemenië=Romania;Rusland=Russia;Slowakije=Slovakia;Tsjechië=Czechia/Czech Republic'],
  ['Noord-Amerika', 'Noord-Amerika', 'Canada;Verenigde Staten=VS/USA/United States/Amerika'],
  ['Midden-Amerika', 'Midden-Amerika', 'Belize;Costa Rica;El Salvador;Guatemala;Honduras;Mexico;Nicaragua;Panama'],
  ['Caribisch gebied', 'Caribisch gebied', 'Antigua en Barbuda;Bahama\'s=Bahamas;Barbados;Cuba;Dominica;Dominicaanse Republiek=Dominican Republic;Grenada;Haïti=Haiti;Jamaica;Saint Kitts en Nevis;Saint Lucia;Saint Vincent en de Grenadines;Trinidad en Tobago=Trinidad and Tobago'],
  ['Zuid-Amerika', 'Zuid-Amerika', 'Argentinië=Argentina;Bolivia;Brazilië=Brazil;Chili=Chile;Colombia;Ecuador;Guyana;Paraguay;Peru;Suriname;Uruguay;Venezuela'],
  ['Oceanië', 'Oceanië', 'Australië=Australia;Nieuw-Zeeland=New Zealand;Fiji;Papoea-Nieuw-Guinea=Papua New Guinea;Samoa;Tonga;Vanuatu;Salomonseilanden=Solomon Islands;Kiribati;Micronesië=Micronesia;Tuvalu'],
];

// Caribisch deel van het Koninkrijk: eigen werkgebiedlabel in de database; geen ontwikkelingsland.
const KONINKRIJK = 'Aruba;Curaçao=Curacao;Sint Maarten;Bonaire;Sint Eustatius;Saba';

// Minst ontwikkelde landen (VN-lijst); een benadering, bedoeld voor "minst ontwikkelde landen"/LDC in fondsteksten.
const LDC = ['Afghanistan', 'Angola', 'Bangladesh', 'Benin', 'Burkina Faso', 'Burundi', 'Cambodja', 'Centraal-Afrikaanse Republiek', 'Tsjaad', 'Comoren', 'Democratische Republiek Congo', 'Djibouti', 'Eritrea', 'Ethiopië', 'Gambia', 'Guinee', 'Guinee-Bissau', 'Haïti', 'Kiribati', 'Laos', 'Lesotho', 'Liberia', 'Madagaskar', 'Malawi', 'Mali', 'Mauritanië', 'Mozambique', 'Myanmar', 'Nepal', 'Niger', 'Rwanda', 'Sao Tomé en Principe', 'Senegal', 'Sierra Leone', 'Salomonseilanden', 'Somalië', 'Zuid-Soedan', 'Soedan', 'Oost-Timor', 'Togo', 'Tuvalu', 'Oeganda', 'Tanzania', 'Jemen', 'Zambia'];

// Landen die NIET als ontwikkelingsland (ODA-gerechtigd) gelden: hoge inkomenslanden en OESO-landen. Benadering van de DAC-lijst.
const GEEN_ONTWIKKELINGSLAND = ['België', 'Duitsland', 'Frankrijk', 'Ierland', 'Luxemburg', 'Oostenrijk', 'Zwitserland', 'Verenigd Koninkrijk', 'Denemarken', 'Estland', 'Finland', 'IJsland', 'Letland', 'Litouwen', 'Noorwegen', 'Zweden', 'Griekenland', 'Italië', 'Kroatië', 'Malta', 'Portugal', 'Slovenië', 'Spanje', 'Cyprus', 'Bulgarije', 'Hongarije', 'Polen', 'Roemenië', 'Rusland', 'Slowakije', 'Tsjechië', 'Canada', 'Verenigde Staten', 'Japan', 'Zuid-Korea', 'Taiwan', 'Singapore', 'Brunei', 'Israël', 'Qatar', 'Koeweit', 'Saoedi-Arabië', 'Verenigde Arabische Emiraten', 'Bahrein', 'Oman', 'Australië', 'Nieuw-Zeeland', 'Chili', 'Uruguay', 'Bahama\'s', 'Barbados', 'Trinidad en Tobago', 'Antigua en Barbuda', 'Saint Kitts en Nevis', 'Seychellen'];


// ISO 3166-1 alpha-2 per land (sleutel = weergavenaam in de tabel hierboven). Kosovo heeft geen officiële code; XK is de gangbare (ook door GeoNames gebruikte) code.
const ISO: Record<string, string> = {
  'Benin': 'BJ', 'Burkina Faso': 'BF', 'Kaapverdië': 'CV', 'Ivoorkust': 'CI', 'Gambia': 'GM', 'Ghana': 'GH', 'Guinee': 'GN', 'Guinee-Bissau': 'GW', 'Liberia': 'LR', 'Mali': 'ML', 'Mauritanië': 'MR', 'Niger': 'NE', 'Nigeria': 'NG', 'Senegal': 'SN', 'Sierra Leone': 'SL', 'Togo': 'TG',
  'Burundi': 'BI', 'Comoren': 'KM', 'Djibouti': 'DJ', 'Eritrea': 'ER', 'Ethiopië': 'ET', 'Kenia': 'KE', 'Madagaskar': 'MG', 'Malawi': 'MW', 'Mauritius': 'MU', 'Mozambique': 'MZ', 'Rwanda': 'RW', 'Seychellen': 'SC', 'Somalië': 'SO', 'Zuid-Soedan': 'SS', 'Tanzania': 'TZ', 'Oeganda': 'UG', 'Zambia': 'ZM', 'Zimbabwe': 'ZW',
  'Angola': 'AO', 'Kameroen': 'CM', 'Centraal-Afrikaanse Republiek': 'CF', 'Tsjaad': 'TD', 'Congo-Brazzaville': 'CG', 'Democratische Republiek Congo': 'CD', 'Equatoriaal-Guinea': 'GQ', 'Gabon': 'GA', 'Sao Tomé en Principe': 'ST',
  'Botswana': 'BW', 'Eswatini': 'SZ', 'Lesotho': 'LS', 'Namibië': 'NA', 'Zuid-Afrika': 'ZA',
  'Algerije': 'DZ', 'Egypte': 'EG', 'Libië': 'LY', 'Marokko': 'MA', 'Soedan': 'SD', 'Tunesië': 'TN',
  'Afghanistan': 'AF', 'Bangladesh': 'BD', 'Bhutan': 'BT', 'India': 'IN', 'Malediven': 'MV', 'Nepal': 'NP', 'Pakistan': 'PK', 'Sri Lanka': 'LK',
  'Brunei': 'BN', 'Cambodja': 'KH', 'Indonesië': 'ID', 'Laos': 'LA', 'Maleisië': 'MY', 'Myanmar': 'MM', 'Filipijnen': 'PH', 'Singapore': 'SG', 'Thailand': 'TH', 'Oost-Timor': 'TL', 'Vietnam': 'VN',
  'China': 'CN', 'Japan': 'JP', 'Mongolië': 'MN', 'Noord-Korea': 'KP', 'Zuid-Korea': 'KR', 'Taiwan': 'TW',
  'Kazachstan': 'KZ', 'Kirgizië': 'KG', 'Tadzjikistan': 'TJ', 'Turkmenistan': 'TM', 'Oezbekistan': 'UZ',
  'Armenië': 'AM', 'Azerbeidzjan': 'AZ', 'Bahrein': 'BH', 'Georgië': 'GE', 'Irak': 'IQ', 'Iran': 'IR', 'Israël': 'IL', 'Jordanië': 'JO', 'Koeweit': 'KW', 'Libanon': 'LB', 'Oman': 'OM', 'Palestina': 'PS', 'Qatar': 'QA', 'Saoedi-Arabië': 'SA', 'Syrië': 'SY', 'Turkije': 'TR', 'Verenigde Arabische Emiraten': 'AE', 'Jemen': 'YE',
  'België': 'BE', 'Duitsland': 'DE', 'Frankrijk': 'FR', 'Ierland': 'IE', 'Luxemburg': 'LU', 'Oostenrijk': 'AT', 'Zwitserland': 'CH', 'Verenigd Koninkrijk': 'GB',
  'Denemarken': 'DK', 'Estland': 'EE', 'Finland': 'FI', 'IJsland': 'IS', 'Letland': 'LV', 'Litouwen': 'LT', 'Noorwegen': 'NO', 'Zweden': 'SE',
  'Albanië': 'AL', 'Bosnië en Herzegovina': 'BA', 'Griekenland': 'GR', 'Italië': 'IT', 'Kosovo': 'XK', 'Kroatië': 'HR', 'Malta': 'MT', 'Montenegro': 'ME', 'Noord-Macedonië': 'MK', 'Portugal': 'PT', 'Servië': 'RS', 'Slovenië': 'SI', 'Spanje': 'ES', 'Cyprus': 'CY',
  'Belarus': 'BY', 'Bulgarije': 'BG', 'Hongarije': 'HU', 'Moldavië': 'MD', 'Oekraïne': 'UA', 'Polen': 'PL', 'Roemenië': 'RO', 'Rusland': 'RU', 'Slowakije': 'SK', 'Tsjechië': 'CZ',
  'Canada': 'CA', 'Verenigde Staten': 'US',
  'Belize': 'BZ', 'Costa Rica': 'CR', 'El Salvador': 'SV', 'Guatemala': 'GT', 'Honduras': 'HN', 'Mexico': 'MX', 'Nicaragua': 'NI', 'Panama': 'PA',
  'Antigua en Barbuda': 'AG', "Bahama's": 'BS', 'Barbados': 'BB', 'Cuba': 'CU', 'Dominica': 'DM', 'Dominicaanse Republiek': 'DO', 'Grenada': 'GD', 'Haïti': 'HT', 'Jamaica': 'JM', 'Saint Kitts en Nevis': 'KN', 'Saint Lucia': 'LC', 'Saint Vincent en de Grenadines': 'VC', 'Trinidad en Tobago': 'TT',
  'Argentinië': 'AR', 'Bolivia': 'BO', 'Brazilië': 'BR', 'Chili': 'CL', 'Colombia': 'CO', 'Ecuador': 'EC', 'Guyana': 'GY', 'Paraguay': 'PY', 'Peru': 'PE', 'Suriname': 'SR', 'Uruguay': 'UY', 'Venezuela': 'VE',
  'Australië': 'AU', 'Nieuw-Zeeland': 'NZ', 'Fiji': 'FJ', 'Papoea-Nieuw-Guinea': 'PG', 'Samoa': 'WS', 'Tonga': 'TO', 'Vanuatu': 'VU', 'Salomonseilanden': 'SB', 'Kiribati': 'KI', 'Micronesië': 'FM', 'Tuvalu': 'TV',
  'Aruba': 'AW', 'Curaçao': 'CW', 'Sint Maarten': 'SX', 'Bonaire': 'BQ', 'Sint Eustatius': 'BQ', 'Saba': 'BQ',
};

export function normaliseer(t: unknown): string {
  return String(t ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`´]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const SUBSAHARA_UITZONDERING_NIET = new Set(['noord-afrika']); // Soedan telt volgens de Wereldbank wel als Sub-Sahara
const SUBSAHARA_TOEVOEGING = new Set(['soedan']);

export const LANDEN: LandInfo[] = [];
const LAND_TERMEN = new Map<string, LandInfo>(); // genormaliseerde term -> land
export const LAND_REGELS: Array<{ naam: string; iso: string; termen: string[] }> = []; // voor de gegenereerde clientlijst

function voegLandToe(spec: string, werelddeel: Werkdeel, regio: string, koninkrijk = false) {
  const [naam, aliasTekst] = spec.split('=');
  const sleutel = normaliseer(naam);
  const land: LandInfo = {
    naam: naam.trim(),
    iso: ISO[naam.trim()] ?? '',
    werelddeel,
    regio,
    subSahara: werelddeel === 'Afrika' && (!SUBSAHARA_UITZONDERING_NIET.has(normaliseer(regio)) || SUBSAHARA_TOEVOEGING.has(sleutel)),
    ldc: false,
    ontwikkelingsland: !koninkrijk,
    koninkrijk,
  };

  LANDEN.push(land);
  LAND_TERMEN.set(sleutel, land);

  const termen = [sleutel];

  for (const a of (aliasTekst || '').split('/')) {
    if (a.trim()) {
      LAND_TERMEN.set(normaliseer(a), land);
      termen.push(normaliseer(a));
    }
  }

  LAND_REGELS.push({ naam: land.naam, iso: land.iso, termen });
}

for (const [regio, werelddeel, landen] of TABEL) for (const spec of landen.split(';')) voegLandToe(spec, werelddeel, regio);
for (const spec of KONINKRIJK.split(';')) voegLandToe(spec, 'Caribisch gebied', 'Caribisch gebied', true);

for (const l of LANDEN) {
  l.ldc = LDC.some((n) => normaliseer(n) === normaliseer(l.naam));
  if (GEEN_ONTWIKKELINGSLAND.some((n) => normaliseer(n) === normaliseer(l.naam))) l.ontwikkelingsland = false;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Doelen: waar een tekst of label naar kan verwijzen.
export type Doel =
  | { t: 'land'; land: LandInfo }
  | { t: 'regio'; naam: string } // subregio of regio-groep, bijvoorbeeld West-Afrika, Latijns-Amerika
  | { t: 'werelddeel'; naam: string }
  | { t: 'klasse'; klasse: 'ontwikkelingslanden' | 'ldc' | 'subsahara' }
  | { t: 'wereld' }
  | { t: 'nl' }
  | { t: 'koninkrijk' };

const REGIO_GROEPEN: Record<string, (l: LandInfo) => boolean> = {
  'west-afrika': (l) => l.regio === 'West-Afrika',
  'oost-afrika': (l) => l.regio === 'Oost-Afrika',
  'centraal-afrika': (l) => l.regio === 'Centraal-Afrika',
  'zuidelijk afrika': (l) => l.regio === 'Zuidelijk Afrika',
  'noord-afrika': (l) => l.regio === 'Noord-Afrika',
  'zuid-azie': (l) => l.regio === 'Zuid-Azië',
  'zuidoost-azie': (l) => l.regio === 'Zuidoost-Azië',
  'oost-azie': (l) => l.regio === 'Oost-Azië',
  'centraal-azie': (l) => l.regio === 'Centraal-Azië',
  'midden-oosten': (l) => l.regio === 'Midden-Oosten' || l.naam === 'Egypte',
  'west-europa': (l) => l.regio === 'West-Europa',
  'noord-europa': (l) => l.regio === 'Noord-Europa',
  'zuid-europa': (l) => l.regio === 'Zuid-Europa',
  'oost-europa': (l) => l.regio === 'Oost-Europa',
  'midden-amerika': (l) => l.regio === 'Midden-Amerika',
  'zuid-amerika': (l) => l.regio === 'Zuid-Amerika',
  'noord-amerika': (l) => l.regio === 'Noord-Amerika',
  'caribisch gebied': (l) => l.regio === 'Caribisch gebied',
  'latijns-amerika': (l) => ['Midden-Amerika', 'Zuid-Amerika', 'Caribisch gebied'].includes(l.regio) && !l.koninkrijk,
  amerika: (l) => ['Midden-Amerika', 'Zuid-Amerika', 'Noord-Amerika', 'Caribisch gebied'].includes(l.regio),
  oceanie: (l) => l.werelddeel === 'Oceanië',
  'oost- en zuidelijk afrika': (l) => ['Oost-Afrika', 'Zuidelijk Afrika'].includes(l.regio),
};

const WERELDDEEL_GROEPEN: Record<string, (l: LandInfo) => boolean> = {
  afrika: (l) => l.werelddeel === 'Afrika',
  azie: (l) => l.werelddeel === 'Azië',
  europa: (l) => l.werelddeel === 'Europa',
};

// Termen -> doel. Genormaliseerd (kleine letters, zonder accenten).
const TERMEN: Array<[string, Doel]> = [];
const voeg = (termen: string[], doel: Doel) => termen.forEach((t) => TERMEN.push([normaliseer(t), doel]));

for (const [term, land] of LAND_TERMEN) TERMEN.push([term, { t: 'land', land }]);

const regioDoel = (sleutel: string): Doel => ({ t: 'regio', naam: sleutel });
const werelddeelDoel = (sleutel: string): Doel => ({ t: 'werelddeel', naam: sleutel });

voeg(['west-afrika', 'west afrika', 'west africa', 'west-africa', 'westelijk afrika'], regioDoel('west-afrika'));
voeg(['oost-afrika', 'oost afrika', 'east africa', 'east-africa'], regioDoel('oost-afrika'));
voeg(['centraal-afrika', 'centraal afrika', 'central africa', 'midden-afrika'], regioDoel('centraal-afrika'));
voeg(['zuidelijk afrika', 'zuidelijk-afrika', 'southern africa', 'zuid-afrikaanse regio'], regioDoel('zuidelijk afrika'));
voeg(['noord-afrika', 'noord afrika', 'north africa'], regioDoel('noord-afrika'));
voeg(['oost- en zuidelijk afrika', 'eastern and southern africa'], regioDoel('oost- en zuidelijk afrika'));
voeg(['zuid-azie', 'zuid azie', 'south asia'], regioDoel('zuid-azie'));
voeg(['zuidoost-azie', 'zuidoost azie', 'south-east asia', 'southeast asia', 'south east asia'], regioDoel('zuidoost-azie'));
voeg(['oost-azie', 'oost azie', 'east asia'], regioDoel('oost-azie'));
voeg(['centraal-azie', 'centraal azie', 'central asia'], regioDoel('centraal-azie'));
voeg(['midden-oosten', 'middle east', 'mena'], regioDoel('midden-oosten'));
voeg(['west-europa', 'western europe'], regioDoel('west-europa'));
voeg(['noord-europa', 'northern europe'], regioDoel('noord-europa'));
voeg(['zuid-europa', 'southern europe'], regioDoel('zuid-europa'));
voeg(['oost-europa', 'eastern europe', 'oost europa'], regioDoel('oost-europa'));
voeg(['midden-amerika', 'central america'], regioDoel('midden-amerika'));
voeg(['zuid-amerika', 'south america'], regioDoel('zuid-amerika'));
voeg(['noord-amerika', 'north america'], regioDoel('noord-amerika'));
voeg(['caribisch gebied', 'caribbean', 'caraiben', 'caribische regio'], regioDoel('caribisch gebied'));
voeg(['latijns-amerika', 'latijns amerika', 'latin america', 'latin-america'], regioDoel('latijns-amerika'));
voeg(['oceanie', 'oceania'], regioDoel('oceanie'));
voeg(['afrika', 'africa', 'afrikaanse landen', 'afrikaans continent'], werelddeelDoel('afrika'));
voeg(['azie', 'asia', 'aziatische landen'], werelddeelDoel('azie'));
voeg(['europa', 'europe', 'europese landen'], werelddeelDoel('europa'));
voeg(
  [
    'ontwikkelingslanden', 'ontwikkelingsland', 'landen in ontwikkeling', 'ontwikkelingslanden', 'developing countries', 'developing country', 'derdewereldlanden', 'derdewereldland',
    'derde wereld', 'derde-wereld', 'derde wereldlanden', 'derde-wereldlanden', 'derde wereldland', 'low- and middle-income countries', 'low and middle income countries',
    'lage- en middeninkomenslanden', 'lage inkomenslanden', 'lagere inkomenslanden', 'lmic', 'lmics', 'global south', 'zuidelijk halfrond', 'het zuiden', 'dac-landen', 'dac landen',
    'dac-lijst', 'dac list', 'dac-list', 'oda-landen', 'oda landen', 'oda-gerechtigde landen', 'oda eligible', 'oesco-dac', 'oeso-dac', 'zuidelijke landen', 'arme landen', 'derde wereld landen',
  ],
  { t: 'klasse', klasse: 'ontwikkelingslanden' },
);
voeg(['minst ontwikkelde landen', 'least developed countries', 'least developed', 'ldc', 'ldcs', 'minst ontwikkelde'], { t: 'klasse', klasse: 'ldc' });
voeg(['sub-sahara', 'sub sahara', 'sub-saharan', 'sub saharan', 'subsahara', 'sub-sahara afrika', 'sub-saharaans', 'sub-saharan africa', 'ten zuiden van de sahara', 'zuidelijk van de sahara'], { t: 'klasse', klasse: 'subsahara' });
voeg(
  ['wereldwijd', 'wereld / internationaal', 'wereld/internationaal', 'internationaal', 'worldwide', 'global', 'globaal', 'overal ter wereld', 'over de hele wereld', 'buitenland', 'alle landen', 'ieder land', 'elk land', 'international', 'internationale projecten', 'in het buitenland'],
  { t: 'wereld' },
);
voeg(['nederland', 'landelijk', 'binnen nederland', 'the netherlands', 'netherlands', 'holland'], { t: 'nl' });
voeg(['caribisch deel van het koninkrijk', 'caribisch nederland', 'caribische delen van het koninkrijk', 'caribische koninkrijksdelen'], { t: 'koninkrijk' });

// Langste termen eerst, zodat "Guinee-Bissau" vóór "Guinee" en "Zuid-Soedan" vóór "Soedan" wordt gevonden.
const TERMEN_OP_LENGTE = [...TERMEN].sort((a, b) => b[0].length - a[0].length);
const TERM_DOEL = new Map<string, Doel>();

for (const [t, d] of TERMEN_OP_LENGTE) if (!TERM_DOEL.has(t)) TERM_DOEL.set(t, d);

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
// Woordgrenzen die ook met streepjes werken: voor en na mag geen letter of cijfer staan.
const TERM_RE = new RegExp(`(?<![a-z0-9])(?:${[...TERM_DOEL.keys()].map(esc).join('|')})(?![a-z0-9])`, 'g');

export interface Vermelding {
  term: string;
  doel: Doel;
  index: number;
}

// Alle verwijzingen in een tekst, op volgorde. De tekst wordt hier genormaliseerd; `index` verwijst naar de genormaliseerde tekst.
export function vindVermeldingen(tekst: string): Vermelding[] {
  const n = normaliseer(tekst);
  const uit: Vermelding[] = [];

  for (const m of n.matchAll(TERM_RE)) {
    const doel = TERM_DOEL.get(m[0]);

    if (doel) uit.push({ term: m[0], doel, index: m.index ?? 0 });
  }

  return uit;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Valt dit land onder dit doel?
export type Sterkte = 'land' | 'regio' | 'klasse' | 'werelddeel' | 'wereld';

export function dekt(doel: Doel, land: LandInfo): Sterkte | null {
  switch (doel.t) {
    case 'land':
      return doel.land.naam === land.naam ? 'land' : null;
    case 'regio':
      return REGIO_GROEPEN[doel.naam]?.(land) ? 'regio' : null;
    case 'werelddeel':
      return WERELDDEEL_GROEPEN[doel.naam]?.(land) ? 'werelddeel' : null;
    case 'klasse':
      if (doel.klasse === 'ontwikkelingslanden') return land.ontwikkelingsland ? 'klasse' : null;
      if (doel.klasse === 'ldc') return land.ldc ? 'klasse' : null;

      return land.subSahara ? 'regio' : null;
    case 'wereld':
      return 'wereld';
    case 'koninkrijk':
      return land.koninkrijk ? 'regio' : null;
    case 'nl':
      return null;
  }
}

// Werkdeel-niveau (alleen een werelddeel/regio bekend, geen land): dekt het doel dit werelddeel? null = niet te zeggen.
export function dektWerelddeel(doel: Doel, werelddeel: string): boolean {
  const w = normaliseer(werelddeel);

  if (doel.t === 'wereld') return true;
  if (doel.t === 'werelddeel') return doel.naam === w || (w === 'azie' && doel.naam === 'azie');
  if (doel.t === 'regio') return REGIO_GROEPEN[doel.naam] ? LANDEN.some((l) => normaliseer(l.werelddeel) === w && REGIO_GROEPEN[doel.naam](l)) : false;

  return false;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Projectzijde: welke landen noemt de projectlocatie? Alleen landen buiten Nederland (Nederland zelf blijft bij de bestaande beoordeling).
export interface ProjectGebied {
  landen: LandInfo[];
  werelddelen: string[]; // alleen gevuld als er geen land is te herkennen
  bronTekst: string;
}

export function projectGebied(teksten: Array<string | null | undefined>): ProjectGebied {
  const samen = teksten.filter((t) => typeof t === 'string' && t.trim()).join(' | ');
  const landen: LandInfo[] = [];
  const werelddelen: string[] = [];

  for (const v of vindVermeldingen(samen)) {
    if (v.doel.t === 'land' && !landen.some((l) => l.naam === (v.doel as any).land.naam)) landen.push((v.doel as any).land);
    if (v.doel.t === 'werelddeel' || v.doel.t === 'regio') if (!werelddelen.includes((v.doel as any).naam)) werelddelen.push((v.doel as any).naam);
  }

  return { landen, werelddelen: landen.length ? [] : werelddelen, bronTekst: samen.slice(0, 200) };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Fondszijde.
export interface WerkgebiedOordeel {
  status: 'eligible' | 'ineligible' | 'unknown';
  sterkte: Sterkte | null;
  reden: string | null; // bij eligible: waarom het past; bij ineligible: waarom niet
  notitie: string | null; // bij unknown: wat er onzeker is
}

const UITSLUIT_CUE = /\b(?:niet(?! alleen| uitsluitend| enkel| beperkt)|geen|behalve|uitgezonderd|met uitzondering van|exclusief|uitgesloten|uitsluiting|excluding|except|excluded|not eligible|not(?! only))\b/;
// Tussen de uitsluitingswoord en de plaats mag geen ander onderwerp staan ("geen exploitatiekosten voor projecten in Afrika" sluit Afrika niet uit).
const ANDER_ONDERWERP = /(?:kosten|exploitatie|personeel|salaris|overhead|bouw|individu|particulier|commerciel|winst|politiek|religieu)/;
const BEPERK_CUE = /\b(?:alleen|uitsluitend|enkel|beperkt tot|beperkt zich tot|voorbehouden aan|exclusively|only|limited to|restricted to|uitsluitend gericht op|alleen gericht op)\b/;
const AANVRAGER_CUE = /\b(?:aanvrager|aanvragers|gevestigd|statutair|zetel|organisatie die|organisaties die|ingeschreven|lid van|medewerkers|werknemers|anbi|cbf|kvk|rechtsvorm|stichting|vereniging|ngo die|nederlandse ngo|nederlandse organisatie|vestigingsplaats)\b/;
const BOVEN_CUE = /\b(?:buiten nederland)\b/;

function zinnenVan(n: string): Array<{ tekst: string; begin: number }> {
  const uit: Array<{ tekst: string; begin: number }> = [];
  let begin = 0;

  for (const m of n.matchAll(/[.;!?\n]+\s*/g)) {
    const einde = (m.index ?? 0) + m[0].length;

    uit.push({ tekst: n.slice(begin, m.index ?? 0), begin });
    begin = einde;
  }

  uit.push({ tekst: n.slice(begin), begin });

  return uit.filter((z) => z.tekst.trim());
}

const WEERGAVE: Record<string, string> = {
  'west-afrika': 'West-Afrika', 'oost-afrika': 'Oost-Afrika', 'centraal-afrika': 'Centraal-Afrika', 'zuidelijk afrika': 'Zuidelijk Afrika', 'noord-afrika': 'Noord-Afrika',
  'oost- en zuidelijk afrika': 'Oost- en Zuidelijk Afrika', 'zuid-azie': 'Zuid-Azië', 'zuidoost-azie': 'Zuidoost-Azië', 'oost-azie': 'Oost-Azië', 'centraal-azie': 'Centraal-Azië',
  'midden-oosten': 'Midden-Oosten', 'west-europa': 'West-Europa', 'noord-europa': 'Noord-Europa', 'zuid-europa': 'Zuid-Europa', 'oost-europa': 'Oost-Europa',
  'midden-amerika': 'Midden-Amerika', 'zuid-amerika': 'Zuid-Amerika', 'noord-amerika': 'Noord-Amerika', 'caribisch gebied': 'Caribisch gebied', 'latijns-amerika': 'Latijns-Amerika',
  amerika: 'Amerika', oceanie: 'Oceanië', afrika: 'Afrika', azie: 'Azië', europa: 'Europa',
};

const mooi = (doel: Doel, term: string): string => {
  if (doel.t === 'land') return doel.land.naam;
  if (doel.t === 'regio' || doel.t === 'werelddeel') return WEERGAVE[doel.naam] ?? term;
  if (doel.t === 'klasse') return doel.klasse === 'subsahara' ? 'Sub-Sahara Afrika' : term;
  if (doel.t === 'koninkrijk') return 'Caribisch deel van het Koninkrijk';
  if (doel.t === 'wereld') return 'wereldwijd';

  return term;
};

const RANG: Record<Sterkte, number> = { land: 5, regio: 4, klasse: 3, werelddeel: 2, wereld: 1 };

// `labels`: de werkgebieden uit de database (structuur); `teksten`: vrije tekst van het fonds/de regeling (criteria, missie, voorwaarden...).
export function beoordeelFondsVoorLand(land: LandInfo, labels: string[], teksten: Array<string | null | undefined>): WerkgebiedOordeel {
  const labelVermeldingen = (labels || []).flatMap((l) => vindVermeldingen(l));
  const heeftLabels = (labels || []).some((l) => String(l || '').trim());
  const tekst = teksten.filter((t) => typeof t === 'string' && t.trim()).join(' . ');
  const n = normaliseer(tekst);
  const zinnen = zinnenVan(n);

  const uitgesloten: Array<{ term: string; zin: string }> = [];
  const beperkingen: Array<{ doelen: Vermelding[]; zin: string }> = [];
  const tekstInclusie: Vermelding[] = [];

  for (const z of zinnen) {
    const verm = vindVermeldingen(z.tekst);

    if (!verm.length) continue;

    const uitCue = z.tekst.match(UITSLUIT_CUE);
    const beperkCue = z.tekst.match(BEPERK_CUE);
    const toegelaten = (v: Vermelding) => v.doel.t !== 'nl';

    for (const v of verm) {
      // Een uitsluiting gaat voor: dichtbij het uitsluitingswoord, zonder ander onderwerp ertussen.
      if (uitCue && (uitCue.index ?? 0) < v.index && v.index - (uitCue.index ?? 0) <= 90 && !ANDER_ONDERWERP.test(z.tekst.slice(uitCue.index ?? 0, v.index))) {
        uitgesloten.push({ term: mooi(v.doel, v.term), zin: z.tekst.trim().slice(0, 140) });
        continue;
      }

      tekstInclusie.push(v);
    }

    if (beperkCue && !AANVRAGER_CUE.test(z.tekst) && !BOVEN_CUE.test(z.tekst)) {
      const doelen = verm.filter((v) => toegelaten(v) && (beperkCue.index ?? 0) < v.index && !uitgesloten.some((u) => u.term === mooi(v.doel, v.term)));

      if (doelen.length) beperkingen.push({ doelen, zin: z.tekst.trim().slice(0, 140) });
    }
  }

  // 1. Uitsluiting gaat altijd voor.
  for (const u of uitgesloten) {
    const doel = vindVermeldingen(u.term)[0]?.doel;

    if (doel && doel.t !== 'wereld' && dekt(doel, land)) {
      return { status: 'ineligible', sterkte: null, reden: `${land.naam} is uitgesloten (${u.term})`, notitie: null };
    }
  }

  // 2. Beperking tot andere landen/regio's.
  for (const b of beperkingen) {
    const dekkend = b.doelen.filter((v) => dekt(v.doel, land));

    if (!dekkend.length) {
      const genoemd = Array.from(new Set(b.doelen.map((v) => mooi(v.doel, v.term)))).slice(0, 4).join(', ');

      return { status: 'ineligible', sterkte: null, reden: `beperkt tot ${genoemd}; ${land.naam} valt daar niet onder`, notitie: null };
    }
  }

  // 3. Inclusie: een label of tekstverwijzing waar het land onder valt. De sterkste aansluiting telt.
  let beste: { sterkte: Sterkte; reden: string } | null = null;
  const kijk = (v: Vermelding, bron: string) => {
    const s = dekt(v.doel, land);

    if (!s) return;
    if (!beste || RANG[s] > RANG[beste.sterkte]) {
      const naam = mooi(v.doel, v.term);

      beste = {
        sterkte: s,
        reden:
          s === 'land'
            ? `${land.naam} wordt genoemd (${bron})`
            : s === 'wereld'
              ? 'werkgebied wereldwijd/internationaal'
              : s === 'klasse'
                ? `${land.naam} valt onder ${naam}`
                : `${land.naam} valt onder ${naam}`,
      };
    }
  };

  for (const v of labelVermeldingen) kijk(v, 'werkgebied');
  for (const v of tekstInclusie) kijk(v, 'voorwaarden');

  if (beste) return { status: 'eligible', sterkte: (beste as any).sterkte, reden: (beste as any).reden, notitie: null };

  // 4. Wel een werkgebied, maar geen enkel deel dekt het land.
  const heeftBruikbaarLabel = labelVermeldingen.length > 0;

  if (heeftLabels && heeftBruikbaarLabel) {
    const genoemd = Array.from(new Set(labelVermeldingen.map((v) => mooi(v.doel, v.term)))).slice(0, 4).join(', ');

    return { status: 'ineligible', sterkte: null, reden: `werkgebied (${genoemd}) omvat ${land.naam} niet`, notitie: null };
  }

  return { status: 'unknown', sterkte: null, reden: null, notitie: `het werkgebied van het fonds is niet vast te stellen voor ${land.naam}` };
}

// Meerdere projectlanden: geschikt als het fonds minstens één land dekt; alleen uitgesloten als het fonds álle landen uitsluit.
export function beoordeelFondsVoorProject(gebied: ProjectGebied, labels: string[], teksten: Array<string | null | undefined>): WerkgebiedOordeel | null {
  if (gebied.landen.length) {
    const alle = gebied.landen.map((l) => beoordeelFondsVoorLand(l, labels, teksten));
    const eligible = alle.filter((o) => o.status === 'eligible').sort((a, b) => RANG[b.sterkte as Sterkte] - RANG[a.sterkte as Sterkte]);

    if (eligible.length) return eligible[0];
    if (alle.every((o) => o.status === 'ineligible')) return alle[0];

    return alle.find((o) => o.status === 'unknown') || alle[0];
  }

  if (gebied.werelddelen.length) {
    const verm = (labels || []).flatMap((l) => vindVermeldingen(l)).concat(vindVermeldingen(teksten.filter(Boolean).join(' . ')));

    if (verm.some((v) => v.doel.t === 'wereld' || gebied.werelddelen.some((w) => dektWerelddeel(v.doel, w)))) {
      return { status: 'eligible', sterkte: 'werelddeel', reden: `werkgebied omvat ${gebied.werelddelen.join(', ')}`, notitie: null };
    }

    return (labels || []).some((l) => String(l || '').trim())
      ? { status: 'ineligible', sterkte: null, reden: 'werkgebied van het fonds omvat het werkgebied van het project niet', notitie: null }
      : { status: 'unknown', sterkte: null, reden: null, notitie: 'het werkgebied van het fonds is niet bekend' };
  }

  return null; // geen buitenlands project herkend: de bestaande beoordeling blijft leidend
}

// ---------------------------------------------------------------------------------------------------------------------------------
// ISO-landcodes van het door het lid GEKOZEN werkgebied. Het werkgebied is één vrij veld met kommagescheiden namen (landen, regio's, steden); een
// naam telt alleen als gekozen land wanneer hij (na normaliseren) exact een landnaam of bekende schrijfwijze is. Verder wordt niets afgeleid:
// "Kumasi" levert hier geen land op. Nederland krijgt NL (het is geen buitenlands project en staat dus niet in de landentabel).
const NEDERLAND_TERMEN = new Set(['nederland', 'the netherlands', 'netherlands', 'holland']);

export function isoCodesUitWerkgebied(tekst: unknown): string[] {
  const uit: string[] = [];
  const code = (stuk: string): string | undefined => {
    const sleutel = normaliseer(stuk.replace(/\(.*?\)/g, ' '));

    if (!sleutel) return undefined;

    return NEDERLAND_TERMEN.has(sleutel) ? 'NL' : LAND_TERMEN.get(sleutel)?.iso || undefined;
  };

  for (const stuk of String(tekst ?? '').split(/[,;|\n]/)) {
    // Eerst het hele stuk ("Trinidad en Tobago"); pas als dat geen land is, splitsen op "en" ("Ghana en Kenia").
    const delen = code(stuk) ? [stuk] : stuk.split(/\s+en\s+|\s+and\s+/i);

    for (const deel of delen) {
      const c = code(deel);

      if (c && !uit.includes(c)) uit.push(c);
    }
  }

  return uit;
}

export function landVoorIso(code: unknown): LandInfo | null {
  const c = String(code ?? '').trim().toUpperCase();

  return LANDEN.find((l) => l.iso === c) ?? null;
}

export function isGeldigeLandcode(code: unknown): boolean {
  const c = String(code ?? '').trim().toUpperCase();

  return c === 'NL' || LANDEN.some((l) => l.iso === c);
}

// Weergavenaam voor een landcode ("GH" -> "Ghana"); onbekende codes komen ongewijzigd terug.
export function landNaamVoorIso(code: unknown): string {
  const c = String(code ?? '').trim().toUpperCase();

  return c === 'NL' ? 'Nederland' : landVoorIso(c)?.naam ?? c;
}
