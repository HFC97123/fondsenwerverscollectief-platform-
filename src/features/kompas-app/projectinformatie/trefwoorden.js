// Trefwoorden uit de projectomschrijving -> voorstellen voor Doelgroep, Discipline en Werkgebied.
// Pure logica (geen React, geen database, geen AI-aanroep): draait in de browser, op de achtergrond terwijl het lid
// typt. De voorstellen zijn altijd waarden uit de bestaande tabellen doelgroepen, themas en regios (dezelfde lijsten
// als de matching); er wordt nooit een nieuwe waarde bedacht. Een voorstel wordt NIET opgeslagen: het lid kiest het
// zelf met één klik. Zo komt er niets in de matching terecht dat het lid niet heeft bevestigd.
//
// Werking: elke waarde uit een tabel heeft herkenningspatronen (synoniemen en woordstammen, hieronder). Waarden die
// hier niet staan worden herkend op hun eigen naam. Een lege lijst betekent: nooit automatisch voorstellen.
// Plaatsnamen worden alleen herkend met een hoofdletter (zodat "leiden tot" geen Leiden is).

const norm = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Patronen op genormaliseerde tekst (kleine letters, zonder accenten). Achtervoegsels expliciet met [a-z]*.
export const DOELGROEP_TERMEN = {
  'burgerinitiatieven rondom gezondheid': ['burgerinitiatie[a-z]*'],
  buurtbewoners: ['buurtbewoner[a-z]*', 'wijkbewoner[a-z]*', 'bewoners van (?:de|het) (?:buurt|wijk)'],
  'chronisch zieken': ['chronisch zieke[a-z]*', 'chronisch ziek'],
  'dak- en thuislozen': ['daklo[a-z]*', 'thuislo[a-z]*', 'dak- en thuislo[a-z]*'],
  dieren: ['dieren', 'huisdier[a-z]*'],
  ervaringsdeskundigen: ['ervaringsdeskundig[a-z]*'],
  gemeenschappen: ['lokale gemeenschap[a-z]*', 'gemeenschappen'],
  'jonge makers': ['jonge maker[a-z]*'],
  jongeren: ['jongere[a-z]*', 'jongerenwerk', 'jongvolwassen[a-z]*', 'tiener[a-z]*', 'adolescent[a-z]*', 'jeugd'],
  kinderen: ['kinderen', 'kind', 'basisschool[a-z]*', 'peuter[a-z]*', 'kleuter[a-z]*', 'schoolkinderen'],
  kunstenaars: ['kunstenaar[a-z]*', 'artiest[a-z]*'],
  mantelzorgers: ['mantelzorg[a-z]*'],
  'mensen in armoede': ['armoede', 'minima', 'laag inkomen', 'lage inkomens?', 'arme gezinnen'],
  'mensen in een kwetsbare positie': ['kwetsbare (?:positie|mensen|groepen|inwoners|burgers)'],
  'mensen met afstand tot de arbeidsmarkt': ['afstand tot de arbeidsmarkt', 'arbeidsmarktdistantie'],
  'mensen met beperkte toegang tot gezondheidszorg': ['toegang tot (?:de )?(?:gezondheids)?zorg'],
  'mensen met een beperking': ['beperking[a-z]*', 'handicap[a-z]*', 'gehandicapt[a-z]*'],
  'mensen met een chronische aandoening': ['chronische aandoening[a-z]*', 'chronische ziekte[a-z]*'],
  'mensen met een langdurige zorgvraag': ['langdurige zorg[a-z]*'],
  'mensen met een lichamelijke beperking': ['lichamelijke beperking[a-z]*', 'rolstoel[a-z]*'],
  minderheden: ['minderheid[a-z]*', 'minderheden'],
  'naasten van mensen met een chronische aandoening': ['naasten'],
  'nieuwkomers/ongedocumenteerden': ['nieuwkomer[a-z]*', 'ongedocumenteerd[a-z]*', 'statushouder[a-z]*', 'asielzoeker[a-z]*'],
  ondernemers: ['ondernemer[a-z]*', 'zzp[a-z]*'],
  ouderen: ['ouderen', 'oudere', 'senior[a-z]*', 'bejaard[a-z]*', '65[ -]?plus[a-z]*', '80[ -]?plus[a-z]*'],
  patienten: ['patient[a-z]*'],
  'slachtoffers van geweld': ['slachtoffers? van (?:huiselijk )?geweld', 'huiselijk geweld'],
  'slachtoffers van noodhulp': ['slachtoffers? van (?:een )?(?:natuurramp|ramp|noodsituatie)[a-z]*'],
  'slachtoffers van oorlog': ['oorlogsslachtoffer[a-z]*', 'slachtoffers? van (?:de )?oorlog'],
  vluchtelingen: ['vluchteling[a-z]*', 'statushouder[a-z]*', 'asielzoeker[a-z]*'],
  volwassenen: ['volwassene[a-z]*'],
  vrijwilligers: ['vrijwilliger[a-z]*'],
  'vrouwen en meisjes': ['vrouwen', 'meisjes', 'vrouw', 'meisje'],
  werklozen: ['werkloze[a-z]*', 'werkzoekende[a-z]*', 'werkloosheid'],
  'zorgprofessionals (als samenwerkingspartner)': ['zorgprofessional[a-z]*', 'zorgverlener[a-z]*', 'huisarts[a-z]*', 'verpleegkundige[a-z]*'],
};

export const THEMA_TERMEN = {
  amateurkunst: ['amateurkunst[a-z]*'],
  arbeidstoeleiding: ['arbeidstoeleiding', 'werkervaringsplek[a-z]*', 're-?integratie'],
  'armoede/zelfredzaamheid': ['armoede', 'zelfredzaam[a-z]*'],
  armoedebestrijding: ['armoede[a-z]*'],
  'beeldende kunst': ['beeldende kunst', 'schilder[a-z]*', 'beeldhouw[a-z]*', 'tentoonstelling[a-z]*'],
  'circulaire innovatie': ['circulair[a-z]*'],
  'community building': ['gemeenschapsvorming', 'community[ -]?building'],
  'community development': ['community[ -]?development', 'gemeenschapsontwikkeling'],
  'cultureel erfgoed': ['cultureel erfgoed', 'cultuurhistori[a-z]*'],
  cultuur: ['cultuur', 'cultureel', 'culturele'],
  cultuureducatie: ['cultuureducatie', 'kunsteducatie'],
  dans: ['dans', 'dansen', 'dansers?', 'dansles[a-z]*'],
  dieren: ['dieren', 'huisdier[a-z]*'],
  dierenwelzijn: ['dierenwelzijn', 'dierenleed', 'dierenasiel[a-z]*'],
  'diversiteit en inclusie': ['diversiteit', 'inclusie', 'inclusief', 'inclusieve', 'inclusiviteit'],
  duurzaamheid: ['duurzaam[a-z]*', 'duurzame'],
  'duurzame landbouw': ['duurzame landbouw', 'landbouw'],
  educatie: ['educatie', 'educatief', 'educatieve'],
  eenzaamheid: ['eenzam[a-z]*', 'sociaal isolement', 'isolement'],
  erfgoed: ['erfgoed'],
  festival: ['festival[a-z]*'],
  film: ['film[a-z]*', 'documentaire[a-z]*'],
  fotografie: ['fotografie', 'fotograf[a-z]*'],
  gehandicaptenzorg: ['gehandicaptenzorg'],
  gezondheid: ['gezondheid[a-z]*'],
  innovatie: ['innovati[a-z]*'],
  'innovatie in gezondheidszorg': ['zorginnovatie', 'innovatie in de (?:gezondheids)?zorg'],
  'internationale samenwerking': ['internationale samenwerking'],
  internationalisering: ['internationalisering'],
  'jeugd en kinderen': ['jeugd', 'kinderen', 'jongeren'],
  joods: ['joods[a-z]*'],
  journalistiek: ['journalist[a-z]*'],
  kerken: ['kerken', 'kerk', 'kerkelijk[a-z]*'],
  'kinderen/jongeren': ['kinderen', 'jongeren', 'jeugd'],
  klimaat: ['klimaat[a-z]*'],
  klimaatinnovatie: ['klimaatinnovatie'],
  kunst: ['kunst', 'kunsten', 'kunstwerk[a-z]*', 'kunstenaar[a-z]*'],
  'kwaliteit van leven': ['kwaliteit van leven', 'levenskwaliteit'],
  'kwetsbare doelgroep': [],
  leiderschapsontwikkeling: ['leiderschap[a-z]*'],
  letterkunde: ['letterkunde'],
  'literaire kunsten': ['literair[a-z]*'],
  literatuur: ['literatuur', 'literair[a-z]*'],
  maatschappij: [],
  media: ['media'],
  'media en journalistiek': ['journalist[a-z]*'],
  'medisch onderzoek': ['medisch onderzoek', 'klinisch onderzoek'],
  mensenrechten: ['mensenrechten'],
  mindervaliden: ['mindervalide[a-z]*', 'gehandicapt[a-z]*'],
  mobiliteit: ['mobiliteit', 'vervoer'],
  monumentenzorg: ['monument[a-z]*'],
  muziek: ['muziek[a-z]*', 'muzikant[a-z]*', 'muzikaal', 'concert[a-z]*', 'koor'],
  natuur: ['natuur', 'biodivers[a-z]*'],
  'natuur en milieu': ['natuur', 'milieu'],
  'nieuwe media': ['nieuwe media'],
  noodhulp: ['noodhulp', 'rampenhulp'],
  ondernemerschap: ['ondernemerschap', 'ondernemen'],
  onderwijs: ['onderwijs', 'school', 'scholen', 'leerling[a-z]*', 'student[a-z]*'],
  onderzoek: ['onderzoek[a-z]*'],
  ontwikkelingshulp: ['ontwikkelingshulp', 'ontwikkelingssamenwerking'],
  'opleiding / beroepsontwikkeling': ['opleiding[a-z]*', 'beroepsontwikkeling', 'scholing'],
  ouderen: ['ouderen', 'senior[a-z]*', 'bejaard[a-z]*'],
  'participatie & inclusie': ['participatie', 'meedoen'],
  patientondersteuning: ['patientondersteuning', 'patientenorganisatie[a-z]*', 'lotgenot[a-z]*'],
  podiumkunsten: ['podiumkunst[a-z]*', 'podium'],
  preventie: ['preventie', 'preventief', 'preventieve'],
  rechten: [],
  recreatie: ['recreatie[a-z]*'],
  religie: ['religie', 'religieus', 'religieuze', 'geloofsgemeenschap[a-z]*'],
  restauratie: ['restauratie[a-z]*'],
  'sociaal ondernemerschap': ['sociaal ondernemerschap', 'sociale onderneming[a-z]*'],
  'sociaal-cultureel': ['sociaal-cultureel[a-z]*', 'sociaal cultureel[a-z]*'],
  'sociaal-maatschappelijk': ['sociaal-maatschappelijk[a-z]*', 'sociaal maatschappelijk[a-z]*'],
  'sociale innovatie': ['sociale innovatie'],
  sport: ['sport[a-z]*', 'sporten', 'voetbal[a-z]*', 'beweeg[a-z]*', 'beweging'],
  taalvaardigheid: ['taalcafe[a-z]*', 'taalles[a-z]*', 'taalvaardig[a-z]*', 'taalonderwijs', 'nt2'],
  talentontwikkeling: ['talentontwikkeling', 'talent[a-z]*'],
  technologie: ['technolog[a-z]*'],
  'theater en podiumkunsten': ['theater[a-z]*', 'toneel[a-z]*', 'voorstelling[a-z]*'],
  toegankelijkheid: ['toegankelijk[a-z]*'],
  toneelkunsten: ['toneelkunst[a-z]*', 'toneel'],
  'training & coaching': ['training[a-z]*', 'coaching', 'coachen'],
  urban: ['urban', 'straatcultuur', 'hiphop'],
  veiligheid: ['veiligheid', 'veilige'],
  verslavingszorg: ['verslaving[a-z]*', 'verslaafd[a-z]*'],
  vluchtelingen: ['vluchteling[a-z]*'],
  'vluchtelingen en migranten': ['vluchteling[a-z]*', 'migrant[a-z]*', 'migratie'],
  vrede: ['vrede', 'vredes[a-z]*'],
  vrijheid: ['vrijheid'],
  vrijwilligers: ['vrijwilliger[a-z]*'],
  welzijn: ['welzijn'],
  werkgelegenheidsprojecten: ['werkgelegenheid[a-z]*'],
  wetenschap: ['wetenschap[a-z]*'],
  'wetenschappelijk onderzoek': ['wetenschappelijk[a-z]* onderzoek'],
  'wonen en huisvesting': ['wonen', 'woning[a-z]*', 'huisvesting', 'huurders?'],
  zelfredzaamheid: ['zelfredzaam[a-z]*'],
  zorg: ['zorg', 'zorgverlening', 'zorginstelling[a-z]*'],
};

// Werkgebieden: algemene schaalwoorden en landen/gebieden die bij een waarde uit de tabel regios horen.
// Plaatsnamen die als waarde in regios staan worden apart herkend (met hoofdletter).
export const REGIO_ALIASSEN = {
  Landelijk: ['landelijk(?:e)?(?! gebied)', 'heel nederland', 'door heel nederland', 'nationaal', 'nationale'],
  Regionaal: ['regionaal', 'regionale', 'regio'],
  Provinciaal: ['provinciaal', 'provinciale', 'provincie'],
  'Wereld / internationaal': ['internationaal', 'internationale', 'wereldwijd', 'buitenland'],
  Afrika: ['afrika[a-z]*', 'ghana', 'kenia', 'ethiopie', 'oeganda', 'senegal', 'nigeria', 'tanzania', 'rwanda', 'mali', 'kaapverdie', 'cabo verde', 'marokko', 'zuid-afrika', 'congo', 'burundi', 'sierra leone', 'somalie', 'soedan'],
  'Azië': ['azie', 'azia[a-z]*', 'indonesie', 'india', 'nepal', 'china', 'vietnam', 'thailand', 'filipijnen', 'bangladesh', 'pakistan', 'afghanistan', 'sri lanka', 'cambodja', 'myanmar'],
  Europa: ['europa', 'europese'],
  'Oost-Europa': ['oost-europa', 'oekraine', 'polen', 'roemenie', 'bulgarije', 'moldavie', 'hongarije'],
  'Midden-Oosten': ['midden-oosten', 'syrie', 'libanon', 'jemen', 'irak', 'iran', 'jordanie', 'palestin[a-z]*', 'gaza', 'israel'],
  'Latijns-Amerika': ['latijns-amerika', 'colombia', 'peru', 'bolivia', 'mexico', 'guatemala', 'honduras', 'nicaragua', 'ecuador', 'chili', 'brazilie', 'argentinie'],
  'Zuid-Amerika': ['zuid-amerika', 'suriname', 'guyana', 'brazilie', 'colombia', 'peru', 'bolivia', 'ecuador', 'chili', 'argentinie'],
  'Noord-Amerika': ['noord-amerika', 'verenigde staten', 'canada'],
  'Caribisch gebied': ['caribisch[a-z]*', 'bonaire', 'saba', 'sint eustatius', 'statia', 'curacao', 'aruba', 'sint maarten'],
  'Caribisch deel van het Koninkrijk': ['caribisch[a-z]*', 'bonaire', 'saba', 'sint eustatius', 'statia', 'curacao', 'aruba', 'sint maarten'],
  'België': ['belgie', 'vlaanderen', 'wallonie'],
  'Den Haag': ["den haag", "'s-gravenhage"],
};

const STOP = new Set(['mensen', 'met', 'van', 'de', 'het', 'een', 'en', 'in', 'als', 'voor', 'op', 'bij', 'tot', 'aan']);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const GEEN_WOORD_VOOR = '(?<![a-z0-9])';
const GEEN_WOORD_NA = '(?![a-z0-9])';

// Patronen voor een tabelwaarde: expliciet uit de map, anders uit de eigen naam (delen gescheiden door / , & of "en").
function patronenVoor(naam, map) {
  const sleutel = norm(naam);

  if (Object.prototype.hasOwnProperty.call(map, sleutel)) {
    return map[sleutel];
  }

  return sleutel
    .split(/\s*[\/,&]\s*|\s+en\s+/)
    .map((d) => d.replace(/\(.*?\)/g, '').trim())
    .filter((d) => d.length >= 4 && !STOP.has(d))
    .map((d) => `${esc(d)}[a-z]*`);
}

function zoek(tekstGenormaliseerd, patronen) {
  const gevonden = [];
  let hits = 0;

  patronen.forEach((p) => {
    const re = new RegExp(`${GEEN_WOORD_VOOR}(?:${p})${GEEN_WOORD_NA}`, 'g');
    let m = re.exec(tekstGenormaliseerd);

    while (m) {
      hits += 1;

      if (gevonden.indexOf(m[0]) === -1) {
        gevonden.push(m[0]);
      }

      m = re.exec(tekstGenormaliseerd);
    }
  });

  return { hits, gevonden };
}

function suggesties(tekst, lijst, map, uitsluiten) {
  const t = norm(tekst);
  const al = new Set((uitsluiten || []).map(norm));

  return (lijst || [])
    .filter((naam) => !al.has(norm(naam)))
    .map((naam) => ({ naam, ...zoek(t, patronenVoor(naam, map)) }))
    .filter((r) => r.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.naam.localeCompare(b.naam, 'nl'))
    .map((r) => ({ naam: r.naam, trefwoorden: r.gevonden.slice(0, 3), hits: r.hits }));
}

const FUNCTIEWOORD_NA_LEIDEN = /^\s+(?:tot|van|naar|aan|de|het|een|ze|zij|die|dat|ook|er|je|u)\b/;

// Plaatsnamen en gebieden uit de tabel regios, in de oorspronkelijke tekst (hoofdletter vereist voor plaatsnamen).
function regioSuggesties(tekst, regios, huidig) {
  const t = norm(tekst);
  const huidigNorm = norm(huidig);
  const uit = [];

  (regios || []).forEach((naam) => {
    if (huidigNorm && huidigNorm.indexOf(norm(naam)) !== -1) {
      return;
    }

    const alias = REGIO_ALIASSEN[naam];
    const gevonden = [];
    let hits = 0;

    if (alias) {
      const r = zoek(t, alias);

      hits += r.hits;
      r.gevonden.forEach((g) => gevonden.push(g));
    }

    // Plaatsnaam zelf, met hoofdletter, ook als deel van een samenstelling met streepje (Utrecht-Noord).
    if (!alias || naam === 'Den Haag') {
      const re = new RegExp(`(?<![\\p{L}\\p{N}])${esc(naam)}(?![\\p{L}\\p{N}])`, 'gu');
      let m = re.exec(tekst);

      while (m) {
        const na = tekst.slice(m.index + naam.length, m.index + naam.length + 12);

        if (!(naam === 'Leiden' && FUNCTIEWOORD_NA_LEIDEN.test(na))) {
          hits += 1;

          if (gevonden.indexOf(naam) === -1) {
            gevonden.push(naam);
          }
        }

        m = re.exec(tekst);
      }
    }

    if (hits > 0) {
      uit.push({ naam, trefwoorden: gevonden.slice(0, 3), hits });
    }
  });

  return uit.sort((a, b) => b.hits - a.hits || a.naam.localeCompare(b.naam, 'nl'));
}

export const MAX_VOORSTELLEN = 5;

// Hoofdfunctie. invoer: { tekst, doelgroepen, themas, regios (de tabellijsten), gekozen: { doelgroep, discipline, regio } }.
// Geeft { doelgroep, discipline, regio } met per categorie maximaal MAX_VOORSTELLEN { naam, trefwoorden, hits };
// al gekozen waarden komen niet terug. Lege of te korte tekst geeft lege lijsten.
export function stelTrefwoordenVoor({ tekst, doelgroepen = [], themas = [], regios = [], gekozen = {} } = {}) {
  const leeg = { doelgroep: [], discipline: [], regio: [] };
  const t = String(tekst || '');

  if (t.trim().length < 12) {
    return leeg;
  }

  const lijst = (w) => (Array.isArray(w) ? w : w ? [w] : []);

  return {
    doelgroep: suggesties(t, doelgroepen, DOELGROEP_TERMEN, lijst(gekozen.doelgroep)).slice(0, MAX_VOORSTELLEN),
    discipline: suggesties(t, themas, THEMA_TERMEN, lijst(gekozen.discipline)).slice(0, MAX_VOORSTELLEN),
    regio: regioSuggesties(t, regios, gekozen.regio).slice(0, MAX_VOORSTELLEN),
  };
}

// Een regio is een vrij tekstveld: een voorstel wordt toegevoegd met een komma, nooit dubbel.
export function voegRegioToe(huidig, naam) {
  const h = String(huidig || '').trim();

  if (!h) {
    return naam;
  }

  if (norm(h).indexOf(norm(naam)) !== -1) {
    return h;
  }

  return `${h}, ${naam}`;
}
