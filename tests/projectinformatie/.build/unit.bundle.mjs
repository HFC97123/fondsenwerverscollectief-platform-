import {createRequire} from 'module';const require=createRequire(import.meta.url);

// tests/projectinformatie/unit.test.mjs
import { readFileSync } from "node:fs";

// src/features/kompas-app/projectinformatie/projectinformatie.js
var PI_VERSIE = 1;
var PI_GROEPEN = [
  { id: "aanleiding", label: "Aanleiding en doelgroep" },
  { id: "aanpak", label: "Doel en aanpak" },
  { id: "resultaat", label: "Resultaat en impact" },
  { id: "uitvoering", label: "Uitvoering" },
  { id: "financiering", label: "Financiering" }
];
var PI_VELDEN = [
  // 1. Aanleiding en doelgroep
  { key: "aanleiding", groep: "aanleiding", label: "Aanleiding / probleemstelling", hint: "Wat is het maatschappelijke probleem of de hulpvraag?", opslag: "json" },
  { key: "noodzaak", groep: "aanleiding", label: "Noodzaak", hint: "Waarom is een interventie nodig?", opslag: "json" },
  { key: "doelgroep_uitgebreid", groep: "aanleiding", label: "Doelgroep (uitgebreid)", hint: "Uitgebreide omschrijving van de doelgroep.", opslag: "json" },
  { key: "bereik", groep: "aanleiding", label: "Bereik", hint: "Wie en hoeveel mensen worden bereikt? Vul aantallen alleen in als ze bekend zijn.", opslag: "json" },
  { key: "toegang_doelgroep", groep: "aanleiding", label: "Toegang tot de doelgroep", hint: "Hoe bereikt het project de doelgroep?", opslag: "json" },
  // 2. Doel en aanpak
  { key: "doelstelling", groep: "aanpak", label: "Doelstelling", hint: "Wat wilt u met dit project bereiken?", opslag: "kolom", project: "doelstellingen", rij: 4 },
  { key: "subdoelstellingen", groep: "aanpak", label: "Subdoelstellingen", hint: "Optioneel.", opslag: "json" },
  { key: "activiteiten", groep: "aanpak", label: "Activiteiten", hint: "Welke concrete activiteiten voert u uit?", opslag: "kolom", project: "activiteiten", rij: 4 },
  { key: "werkwijze", groep: "aanpak", label: "Werkwijze / aanpak", hint: "Hoe wordt het project uitgevoerd?", opslag: "json" },
  { key: "samenwerking", groep: "aanpak", label: "Samenwerking / partners", hint: "Welke organisaties zijn betrokken en welke rol hebben zij?", opslag: "kolom", project: "partners", rij: 2 },
  // 3. Resultaat en impact
  { key: "output", groep: "resultaat", label: "Output", hint: "Welke directe producten of prestaties levert het project op?", opslag: "json" },
  { key: "outcome", groep: "resultaat", label: "Outcome", hint: "Welke veranderingen worden bij de doelgroep verwacht?", opslag: "json" },
  { key: "impact", groep: "resultaat", label: "Beoogde impact", hint: "Welk verschil maakt dit project, voor wie?", opslag: "kolom", project: "impact", rij: 4 },
  { key: "resultaten", groep: "resultaat", label: "Resultaten tot nu toe", hint: "Alleen bij een bestaand of lopend project.", opslag: "kolom", project: "resultaten", rij: 4 },
  { key: "monitoring_evaluatie", groep: "resultaat", label: "Monitoring en evaluatie", hint: "Hoe worden voortgang en resultaten gemeten?", opslag: "json" },
  // 4. Uitvoering
  { key: "planning", groep: "uitvoering", label: "Planning", hint: "Belangrijkste fasen, activiteiten en data.", opslag: "kolom", project: "planning", rij: 2 },
  { key: "organisatie_uitvoerbaarheid", groep: "uitvoering", label: "Organisatie en uitvoerbaarheid", hint: "Wie voert het project uit en hoe is de uitvoering georganiseerd?", opslag: "json" },
  { key: "risicos", groep: "uitvoering", label: "Risico\u2019s", hint: "Belangrijkste risico\u2019s en beheersmaatregelen.", opslag: "json" },
  { key: "borging", groep: "uitvoering", label: "Borging / duurzaamheid", hint: "Wat gebeurt er na afloop van de financiering?", opslag: "json" },
  { key: "toegevoegde_waarde", groep: "uitvoering", label: "Toegevoegde waarde van de organisatie", hint: "Waarom is deze organisatie geschikt om het project uit te voeren?", opslag: "json" },
  // 5. Financiering (financieringsbehoefte zelf komt uit Projecten en is alleen-lezen)
  { key: "financieringsbehoefte", groep: "financiering", label: "Financieringsbehoefte (toelichting)", hint: "Waarvoor is aanvullende financiering nodig? Het bedrag zelf komt uit Projecten.", opslag: "json" },
  { key: "begrotingstoelichting", groep: "financiering", label: "Begrotingstoelichting", hint: "Toelichting op de belangrijkste begrotingsposten.", opslag: "json" }
];
var PI_PROJECTBREED = [
  { key: "programma", label: "Programma of onderdeel", hint: "Waar valt het project onder?", project: "programma", opslag: "kolom", rij: 1, suggesties: true },
  { key: "schrijfvoorkeur", label: "Schrijfvoorkeur voor dit project", hint: "Bijvoorbeeld: warm en mensgericht, zakelijk, resultaatgericht. Geldt voor alle teksten van dit project.", project: "schrijfvoorkeur", opslag: "kolom", rij: 2 }
];
var PI_KEYS = PI_VELDEN.map((v2) => v2.key);
var tekst = (w4) => w4 == null ? "" : String(w4);
var piActief = (veld) => veld.opslag === "kolom";
function actieveVelden() {
  return PI_VELDEN.filter(piActief);
}
function leesProjectinformatie(project2) {
  const p = project2 || {};
  const json = p.projectInfo && typeof p.projectInfo === "object" && p.projectInfo.velden && typeof p.projectInfo.velden === "object" ? p.projectInfo.velden : {};
  const uit = {};
  PI_VELDEN.forEach((v2) => {
    uit[v2.key] = v2.opslag === "kolom" ? tekst(p[v2.project]) : tekst(json[v2.key]);
  });
  return uit;
}
function schrijfProjectinformatie(project2, waarden) {
  const p = { ...project2 || {} };
  const json = { ...p.projectInfo && p.projectInfo.velden ? p.projectInfo.velden : {} };
  let jsonGewijzigd = false;
  Object.keys(waarden || {}).forEach((key) => {
    const v2 = PI_VELDEN.find((x) => x.key === key);
    if (!v2) {
      return;
    }
    if (v2.opslag === "kolom") {
      p[v2.project] = tekst(waarden[key]);
    } else if (tekst(waarden[key]) !== tekst(json[key])) {
      json[key] = tekst(waarden[key]);
      jsonGewijzigd = true;
    }
  });
  if (jsonGewijzigd) {
    p.projectInfo = { versie: PI_VERSIE, velden: json };
  }
  return p;
}
function voortgang(project2, alleenActief = true) {
  const waarden = leesProjectinformatie(project2);
  const velden = alleenActief ? actieveVelden() : PI_VELDEN;
  const perGroep = {};
  PI_GROEPEN.forEach((g) => {
    perGroep[g.id] = { ingevuld: 0, totaal: 0 };
  });
  let ingevuld = 0;
  velden.forEach((v2) => {
    const gevuld = tekst(waarden[v2.key]).trim() !== "";
    perGroep[v2.groep].totaal += 1;
    if (gevuld) {
      perGroep[v2.groep].ingevuld += 1;
      ingevuld += 1;
    }
  });
  return { ingevuld, totaal: velden.length, perGroep };
}
function programmaSuggesties(projecten) {
  const gezien = /* @__PURE__ */ new Set();
  (projecten || []).forEach((p) => {
    const w4 = tekst(p && p.programma).trim();
    if (w4) {
      gezien.add(w4);
    }
  });
  return Array.from(gezien).sort((a, b) => a.localeCompare(b, "nl"));
}
function paneelVelden(project2) {
  const waarden = leesProjectinformatie(project2);
  const bronnen = project2 && project2.bronnen || {};
  return actieveVelden().map((v2) => ({ ...v2, waarde: waarden[v2.key], bron: bronnen[v2.project] || "" }));
}
function paneelProjectbreed(project2) {
  const p = project2 || {};
  const bronnen = p.bronnen || {};
  return PI_PROJECTBREED.map((v2) => ({ ...v2, waarde: tekst(p[v2.project]), bron: bronnen[v2.project] || "" }));
}
function schrijfPaneel(project2, waarden) {
  const p = schrijfProjectinformatie(project2, waarden);
  PI_PROJECTBREED.forEach((v2) => {
    if (Object.prototype.hasOwnProperty.call(waarden || {}, v2.key)) {
      p[v2.project] = tekst(waarden[v2.key]);
    }
  });
  return p;
}

// src/features/kompas-app/projectinformatie/trefwoorden.js
var norm = (s2) => String(s2 == null ? "" : s2).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
var DOELGROEP_TERMEN = {
  "burgerinitiatieven rondom gezondheid": ["burgerinitiatie[a-z]*"],
  buurtbewoners: ["buurtbewoner[a-z]*", "wijkbewoner[a-z]*", "bewoners van (?:de|het) (?:buurt|wijk)"],
  "chronisch zieken": ["chronisch zieke[a-z]*", "chronisch ziek"],
  "dak- en thuislozen": ["daklo[a-z]*", "thuislo[a-z]*", "dak- en thuislo[a-z]*"],
  dieren: ["dieren", "huisdier[a-z]*"],
  ervaringsdeskundigen: ["ervaringsdeskundig[a-z]*"],
  gemeenschappen: ["lokale gemeenschap[a-z]*", "gemeenschappen"],
  "jonge makers": ["jonge maker[a-z]*"],
  jongeren: ["jongere[a-z]*", "jongerenwerk", "jongvolwassen[a-z]*", "tiener[a-z]*", "adolescent[a-z]*", "jeugd"],
  kinderen: ["kinderen", "kind", "basisschool[a-z]*", "peuter[a-z]*", "kleuter[a-z]*", "schoolkinderen"],
  kunstenaars: ["kunstenaar[a-z]*", "artiest[a-z]*"],
  mantelzorgers: ["mantelzorg[a-z]*"],
  "mensen in armoede": ["armoede", "minima", "laag inkomen", "lage inkomens?", "arme gezinnen"],
  "mensen in een kwetsbare positie": ["kwetsbare (?:positie|mensen|groepen|inwoners|burgers)"],
  "mensen met afstand tot de arbeidsmarkt": ["afstand tot de arbeidsmarkt", "arbeidsmarktdistantie"],
  "mensen met beperkte toegang tot gezondheidszorg": ["toegang tot (?:de )?(?:gezondheids)?zorg"],
  "mensen met een beperking": ["beperking[a-z]*", "handicap[a-z]*", "gehandicapt[a-z]*"],
  "mensen met een chronische aandoening": ["chronische aandoening[a-z]*", "chronische ziekte[a-z]*"],
  "mensen met een langdurige zorgvraag": ["langdurige zorg[a-z]*"],
  "mensen met een lichamelijke beperking": ["lichamelijke beperking[a-z]*", "rolstoel[a-z]*"],
  minderheden: ["minderheid[a-z]*", "minderheden"],
  "naasten van mensen met een chronische aandoening": ["naasten"],
  "nieuwkomers/ongedocumenteerden": ["nieuwkomer[a-z]*", "ongedocumenteerd[a-z]*", "statushouder[a-z]*", "asielzoeker[a-z]*"],
  ondernemers: ["ondernemer[a-z]*", "zzp[a-z]*"],
  ouderen: ["ouderen", "oudere", "senior[a-z]*", "bejaard[a-z]*", "65[ -]?plus[a-z]*", "80[ -]?plus[a-z]*"],
  patienten: ["patient[a-z]*"],
  "slachtoffers van geweld": ["slachtoffers? van (?:huiselijk )?geweld", "huiselijk geweld"],
  "slachtoffers van noodhulp": ["slachtoffers? van (?:een )?(?:natuurramp|ramp|noodsituatie)[a-z]*"],
  "slachtoffers van oorlog": ["oorlogsslachtoffer[a-z]*", "slachtoffers? van (?:de )?oorlog"],
  vluchtelingen: ["vluchteling[a-z]*", "statushouder[a-z]*", "asielzoeker[a-z]*"],
  volwassenen: ["volwassene[a-z]*"],
  vrijwilligers: ["vrijwilliger[a-z]*"],
  "vrouwen en meisjes": ["vrouwen", "meisjes", "vrouw", "meisje"],
  werklozen: ["werkloze[a-z]*", "werkzoekende[a-z]*", "werkloosheid"],
  "zorgprofessionals (als samenwerkingspartner)": ["zorgprofessional[a-z]*", "zorgverlener[a-z]*", "huisarts[a-z]*", "verpleegkundige[a-z]*"]
};
var THEMA_TERMEN = {
  amateurkunst: ["amateurkunst[a-z]*"],
  arbeidstoeleiding: ["arbeidstoeleiding", "werkervaringsplek[a-z]*", "re-?integratie"],
  "armoede/zelfredzaamheid": ["armoede", "zelfredzaam[a-z]*"],
  armoedebestrijding: ["armoede[a-z]*"],
  "beeldende kunst": ["beeldende kunst", "schilder[a-z]*", "beeldhouw[a-z]*", "tentoonstelling[a-z]*"],
  "circulaire innovatie": ["circulair[a-z]*"],
  "community building": ["gemeenschapsvorming", "community[ -]?building"],
  "community development": ["community[ -]?development", "gemeenschapsontwikkeling"],
  "cultureel erfgoed": ["cultureel erfgoed", "cultuurhistori[a-z]*"],
  cultuur: ["cultuur", "cultureel", "culturele"],
  cultuureducatie: ["cultuureducatie", "kunsteducatie"],
  dans: ["dans", "dansen", "dansers?", "dansles[a-z]*"],
  dieren: ["dieren", "huisdier[a-z]*"],
  dierenwelzijn: ["dierenwelzijn", "dierenleed", "dierenasiel[a-z]*"],
  "diversiteit en inclusie": ["diversiteit", "inclusie", "inclusief", "inclusieve", "inclusiviteit"],
  duurzaamheid: ["duurzaam[a-z]*", "duurzame"],
  "duurzame landbouw": ["duurzame landbouw", "landbouw"],
  educatie: ["educatie", "educatief", "educatieve"],
  eenzaamheid: ["eenzam[a-z]*", "sociaal isolement", "isolement"],
  erfgoed: ["erfgoed"],
  festival: ["festival[a-z]*"],
  film: ["film[a-z]*", "documentaire[a-z]*"],
  fotografie: ["fotografie", "fotograf[a-z]*"],
  gehandicaptenzorg: ["gehandicaptenzorg"],
  gezondheid: ["gezondheid[a-z]*"],
  innovatie: ["innovati[a-z]*"],
  "innovatie in gezondheidszorg": ["zorginnovatie", "innovatie in de (?:gezondheids)?zorg"],
  "internationale samenwerking": ["internationale samenwerking"],
  internationalisering: ["internationalisering"],
  "jeugd en kinderen": ["jeugd", "kinderen", "jongeren"],
  joods: ["joods[a-z]*"],
  journalistiek: ["journalist[a-z]*"],
  kerken: ["kerken", "kerk", "kerkelijk[a-z]*"],
  "kinderen/jongeren": ["kinderen", "jongeren", "jeugd"],
  klimaat: ["klimaat[a-z]*"],
  klimaatinnovatie: ["klimaatinnovatie"],
  kunst: ["kunst", "kunsten", "kunstwerk[a-z]*", "kunstenaar[a-z]*"],
  "kwaliteit van leven": ["kwaliteit van leven", "levenskwaliteit"],
  "kwetsbare doelgroep": [],
  leiderschapsontwikkeling: ["leiderschap[a-z]*"],
  letterkunde: ["letterkunde"],
  "literaire kunsten": ["literair[a-z]*"],
  literatuur: ["literatuur", "literair[a-z]*"],
  maatschappij: [],
  media: ["media"],
  "media en journalistiek": ["journalist[a-z]*"],
  "medisch onderzoek": ["medisch onderzoek", "klinisch onderzoek"],
  mensenrechten: ["mensenrechten"],
  mindervaliden: ["mindervalide[a-z]*", "gehandicapt[a-z]*"],
  mobiliteit: ["mobiliteit", "vervoer"],
  monumentenzorg: ["monument[a-z]*"],
  muziek: ["muziek[a-z]*", "muzikant[a-z]*", "muzikaal", "concert[a-z]*", "koor"],
  natuur: ["natuur", "biodivers[a-z]*"],
  "natuur en milieu": ["natuur", "milieu"],
  "nieuwe media": ["nieuwe media"],
  noodhulp: ["noodhulp", "rampenhulp"],
  ondernemerschap: ["ondernemerschap", "ondernemen"],
  onderwijs: ["onderwijs", "school", "scholen", "leerling[a-z]*", "student[a-z]*"],
  onderzoek: ["onderzoek[a-z]*"],
  ontwikkelingshulp: ["ontwikkelingshulp", "ontwikkelingssamenwerking"],
  "opleiding / beroepsontwikkeling": ["opleiding[a-z]*", "beroepsontwikkeling", "scholing"],
  ouderen: ["ouderen", "senior[a-z]*", "bejaard[a-z]*"],
  "participatie & inclusie": ["participatie", "meedoen"],
  patientondersteuning: ["patientondersteuning", "patientenorganisatie[a-z]*", "lotgenot[a-z]*"],
  podiumkunsten: ["podiumkunst[a-z]*", "podium"],
  preventie: ["preventie", "preventief", "preventieve"],
  rechten: [],
  recreatie: ["recreatie[a-z]*"],
  religie: ["religie", "religieus", "religieuze", "geloofsgemeenschap[a-z]*"],
  restauratie: ["restauratie[a-z]*"],
  "sociaal ondernemerschap": ["sociaal ondernemerschap", "sociale onderneming[a-z]*"],
  "sociaal-cultureel": ["sociaal-cultureel[a-z]*", "sociaal cultureel[a-z]*"],
  "sociaal-maatschappelijk": ["sociaal-maatschappelijk[a-z]*", "sociaal maatschappelijk[a-z]*"],
  "sociale innovatie": ["sociale innovatie"],
  sport: ["sport[a-z]*", "sporten", "voetbal[a-z]*", "beweeg[a-z]*", "beweging"],
  taalvaardigheid: ["taalcafe[a-z]*", "taalles[a-z]*", "taalvaardig[a-z]*", "taalonderwijs", "nt2"],
  talentontwikkeling: ["talentontwikkeling", "talent[a-z]*"],
  technologie: ["technolog[a-z]*"],
  "theater en podiumkunsten": ["theater[a-z]*", "toneel[a-z]*", "voorstelling[a-z]*"],
  toegankelijkheid: ["toegankelijk[a-z]*"],
  toneelkunsten: ["toneelkunst[a-z]*", "toneel"],
  "training & coaching": ["training[a-z]*", "coaching", "coachen"],
  urban: ["urban", "straatcultuur", "hiphop"],
  veiligheid: ["veiligheid", "veilige"],
  verslavingszorg: ["verslaving[a-z]*", "verslaafd[a-z]*"],
  vluchtelingen: ["vluchteling[a-z]*"],
  "vluchtelingen en migranten": ["vluchteling[a-z]*", "migrant[a-z]*", "migratie"],
  vrede: ["vrede", "vredes[a-z]*"],
  vrijheid: ["vrijheid"],
  vrijwilligers: ["vrijwilliger[a-z]*"],
  welzijn: ["welzijn"],
  werkgelegenheidsprojecten: ["werkgelegenheid[a-z]*"],
  wetenschap: ["wetenschap[a-z]*"],
  "wetenschappelijk onderzoek": ["wetenschappelijk[a-z]* onderzoek"],
  "wonen en huisvesting": ["wonen", "woning[a-z]*", "huisvesting", "huurders?"],
  zelfredzaamheid: ["zelfredzaam[a-z]*"],
  zorg: ["zorg", "zorgverlening", "zorginstelling[a-z]*"]
};
var REGIO_ALIASSEN = {
  Landelijk: ["landelijk(?:e)?(?! gebied)", "heel nederland", "door heel nederland", "nationaal", "nationale"],
  Regionaal: ["regionaal", "regionale", "regio"],
  Provinciaal: ["provinciaal", "provinciale", "provincie"],
  "Wereld / internationaal": ["internationaal", "internationale", "wereldwijd", "buitenland"],
  Afrika: ["afrika[a-z]*", "ghana", "kenia", "ethiopie", "oeganda", "senegal", "nigeria", "tanzania", "rwanda", "mali", "kaapverdie", "cabo verde", "marokko", "zuid-afrika", "congo", "burundi", "sierra leone", "somalie", "soedan"],
  "Azi\xEB": ["azie", "azia[a-z]*", "indonesie", "india", "nepal", "china", "vietnam", "thailand", "filipijnen", "bangladesh", "pakistan", "afghanistan", "sri lanka", "cambodja", "myanmar"],
  Europa: ["europa", "europese"],
  "Oost-Europa": ["oost-europa", "oekraine", "polen", "roemenie", "bulgarije", "moldavie", "hongarije"],
  "Midden-Oosten": ["midden-oosten", "syrie", "libanon", "jemen", "irak", "iran", "jordanie", "palestin[a-z]*", "gaza", "israel"],
  "Latijns-Amerika": ["latijns-amerika", "colombia", "peru", "bolivia", "mexico", "guatemala", "honduras", "nicaragua", "ecuador", "chili", "brazilie", "argentinie"],
  "Zuid-Amerika": ["zuid-amerika", "suriname", "guyana", "brazilie", "colombia", "peru", "bolivia", "ecuador", "chili", "argentinie"],
  "Noord-Amerika": ["noord-amerika", "verenigde staten", "canada"],
  "Caribisch gebied": ["caribisch[a-z]*", "bonaire", "saba", "sint eustatius", "statia", "curacao", "aruba", "sint maarten"],
  "Caribisch deel van het Koninkrijk": ["caribisch[a-z]*", "bonaire", "saba", "sint eustatius", "statia", "curacao", "aruba", "sint maarten"],
  "Belgi\xEB": ["belgie", "vlaanderen", "wallonie"],
  "Den Haag": ["den haag", "'s-gravenhage"]
};
var STOP = /* @__PURE__ */ new Set(["mensen", "met", "van", "de", "het", "een", "en", "in", "als", "voor", "op", "bij", "tot", "aan"]);
var esc = (s2) => s2.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
var GEEN_WOORD_VOOR = "(?<![a-z0-9])";
var GEEN_WOORD_NA = "(?![a-z0-9])";
function patronenVoor(naam, map) {
  const sleutel = norm(naam);
  if (Object.prototype.hasOwnProperty.call(map, sleutel)) {
    return map[sleutel];
  }
  return sleutel.split(/\s*[\/,&]\s*|\s+en\s+/).map((d) => d.replace(/\(.*?\)/g, "").trim()).filter((d) => d.length >= 4 && !STOP.has(d)).map((d) => `${esc(d)}[a-z]*`);
}
function zoek(tekstGenormaliseerd, patronen) {
  const gevonden = [];
  let hits = 0;
  patronen.forEach((p) => {
    const re = new RegExp(`${GEEN_WOORD_VOOR}(?:${p})${GEEN_WOORD_NA}`, "g");
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
function suggesties(tekst2, lijst, map, uitsluiten) {
  const t = norm(tekst2);
  const al = new Set((uitsluiten || []).map(norm));
  return (lijst || []).filter((naam) => !al.has(norm(naam))).map((naam) => ({ naam, ...zoek(t, patronenVoor(naam, map)) })).filter((r) => r.hits > 0).sort((a, b) => b.hits - a.hits || a.naam.localeCompare(b.naam, "nl")).map((r) => ({ naam: r.naam, trefwoorden: r.gevonden.slice(0, 3), hits: r.hits }));
}
var FUNCTIEWOORD_NA_LEIDEN = /^\s+(?:tot|van|naar|aan|de|het|een|ze|zij|die|dat|ook|er|je|u)\b/;
function regioSuggesties(tekst2, regios, huidig) {
  const t = norm(tekst2);
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
    if (!alias || naam === "Den Haag") {
      const re = new RegExp(`(?<![\\p{L}\\p{N}])${esc(naam)}(?![\\p{L}\\p{N}])`, "gu");
      let m = re.exec(tekst2);
      while (m) {
        const na = tekst2.slice(m.index + naam.length, m.index + naam.length + 12);
        if (!(naam === "Leiden" && FUNCTIEWOORD_NA_LEIDEN.test(na))) {
          hits += 1;
          if (gevonden.indexOf(naam) === -1) {
            gevonden.push(naam);
          }
        }
        m = re.exec(tekst2);
      }
    }
    if (hits > 0) {
      uit.push({ naam, trefwoorden: gevonden.slice(0, 3), hits });
    }
  });
  return uit.sort((a, b) => b.hits - a.hits || a.naam.localeCompare(b.naam, "nl"));
}
var MAX_VOORSTELLEN = 5;
function stelTrefwoordenVoor({ tekst: tekst2, doelgroepen = [], themas = [], regios = [], gekozen = {} } = {}) {
  const leeg = { doelgroep: [], discipline: [], regio: [] };
  const t = String(tekst2 || "");
  if (t.trim().length < 12) {
    return leeg;
  }
  const lijst = (w4) => Array.isArray(w4) ? w4 : w4 ? [w4] : [];
  return {
    doelgroep: suggesties(t, doelgroepen, DOELGROEP_TERMEN, lijst(gekozen.doelgroep)).slice(0, MAX_VOORSTELLEN),
    discipline: suggesties(t, themas, THEMA_TERMEN, lijst(gekozen.discipline)).slice(0, MAX_VOORSTELLEN),
    regio: regioSuggesties(t, regios, gekozen.regio).slice(0, MAX_VOORSTELLEN)
  };
}
function voegRegioToe(huidig, naam) {
  const h = String(huidig || "").trim();
  if (!h) {
    return naam;
  }
  if (norm(h).indexOf(norm(naam)) !== -1) {
    return h;
  }
  return `${h}, ${naam}`;
}

// src/features/kompas-app/financiering/dekkingsplan.js
function projectBedrag(v2) {
  if (typeof v2 === "number") {
    return Number.isFinite(v2) && v2 > 0 ? v2 : 0;
  }
  const cijfers = String(v2 == null ? "" : v2).replace(/[^0-9]/g, "");
  const n = cijfers ? Number(cijfers) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}
function leesBedragInvoer(tekst2) {
  const s2 = String(tekst2 == null ? "" : tekst2).replace(/\s+/g, "").replace(/^€/, "");
  if (s2 === "") {
    return { ok: true, waarde: null };
  }
  if (!/^(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/.test(s2)) {
    return { ok: false, waarde: null };
  }
  const n = Number(s2.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n < 1e12 ? { ok: true, waarde: n } : { ok: false, waarde: null };
}
function bedragenVoorOpslaan({ begroting, eigenBijdrage }) {
  const b = leesBedragInvoer(typeof begroting === "number" ? String(begroting).replace(".", ",") : begroting);
  const e = leesBedragInvoer(typeof eigenBijdrage === "number" ? String(eigenBijdrage).replace(".", ",") : eigenBijdrage);
  if (!b.ok) return { ok: false, fout: "Vul bij de totale projectbegroting een bedrag in, bijvoorbeeld 85.000." };
  if (!e.ok) return { ok: false, fout: "Vul bij de eigen bijdrage een bedrag in, bijvoorbeeld 7.500." };
  return {
    ok: true,
    begroting: b.waarde == null ? "" : Math.round(b.waarde),
    eigenBijdrage: e.waarde == null ? "" : Math.round(e.waarde),
    fout: ""
  };
}
function teFinancieren(begroting, eigenBijdrage) {
  return Math.max(0, projectBedrag(begroting) - projectBedrag(eigenBijdrage));
}

// src/features/kompas-app/projectOpslaan.js
var ISO_DATUM = /^\d{4}-\d{2}-\d{2}$/;
function valideerEnBereidOp(form) {
  if (!String(form && form.naam || "").trim()) {
    return { ok: false, fout: "Vul in ieder geval de naam van het project in." };
  }
  if (form.periodeVan && form.periodeTot && ISO_DATUM.test(form.periodeVan) && ISO_DATUM.test(form.periodeTot) && form.periodeTot < form.periodeVan) {
    return { ok: false, fout: "De einddatum van de looptijd ligt voor de startdatum." };
  }
  const bedragen = bedragenVoorOpslaan(form);
  if (!bedragen.ok) {
    return { ok: false, fout: bedragen.fout };
  }
  return {
    ok: true,
    project: {
      ...form,
      begroting: bedragen.begroting,
      eigenBijdrage: bedragen.eigenBijdrage,
      gevraagd: bedragen.begroting === "" ? "" : teFinancieren(bedragen.begroting, bedragen.eigenBijdrage)
    }
  };
}

// src/data/services/projecten.js
function doelgroepNaarKolom(waarde) {
  return (Array.isArray(waarde) ? waarde : waarde ? [waarde] : []).join(", ") || null;
}
function getal(v2) {
  if (v2 === "" || v2 == null) {
    return null;
  }
  const cijfers = String(v2).replace(/[^0-9]/g, "");
  return cijfers ? Number(cijfers) : null;
}
function naarKolomPatch(project2) {
  return {
    name: project2.naam || "Naamloos project",
    program_label: project2.programma || null,
    target_groups: doelgroepNaarKolom(project2.doelgroep),
    themes: doelgroepNaarKolom(project2.discipline),
    location: project2.regio || null,
    period_start: project2.periodeVan || null,
    period_end: project2.periodeTot || null,
    description: project2.omschrijving || null,
    goals: project2.doelstellingen || null,
    partners: project2.partners || null,
    results: project2.resultaten || null,
    budget_total: getal(project2.begroting),
    // Te financieren bedrag: ALTIJD afgeleid (begroting min eigen bijdrage, nooit negatief) met de ene
    // gedeelde functie teFinancieren(); een los ingevoerd "gevraagd bedrag" bestaat niet meer. Zonder
    // begroting blijft de kolom leeg.
    requested_amount: getal(project2.begroting) == null ? null : teFinancieren(project2.begroting, project2.eigenBijdrage),
    own_contribution: getal(project2.eigenBijdrage),
    // previous_grants, cofinanciers en linked_schemes worden NIET meer geschreven. Financiering staat in
    // subsidie_kompas_program_funding (de enige actieve bron). De kolommen blijven bestaan met hun
    // bestaande inhoud (legacy/rollback); een update laat ze ongemoeid, dus er gaat niets verloren.
    activities: project2.activiteiten || null,
    impact_description: project2.impact || null,
    planning: project2.planning || null,
    writing_preferences: project2.schrijfvoorkeur || null,
    field_sources: project2.bronnen && typeof project2.bronnen === "object" ? project2.bronnen : {}
  };
}

// tests/projectinformatie/unit.test.mjs
var ok = 0;
var fail = 0;
var check = (n, c, d = "") => {
  if (c) {
    ok += 1;
    console.log("OK  ", n);
  } else {
    fail += 1;
    console.log("FAIL", n, d);
  }
};
var gelijk = (n, a, b) => check(n, JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
console.log("== 1. Definitie");
gelijk("22 velden", PI_VELDEN.length, 22);
check("sleutels uniek", new Set(PI_KEYS).size === 22);
check("elk veld hoort bij een bestaande groep", PI_VELDEN.every((v2) => PI_GROEPEN.some((g) => g.id === v2.groep)));
check("opslag is kolom of json", PI_VELDEN.every((v2) => v2.opslag === "kolom" || v2.opslag === "json"));
check("kolomvelden noemen een projectveld, jsonvelden niet", PI_VELDEN.every((v2) => v2.opslag === "kolom" === Boolean(v2.project)));
gelijk("6 kolomvelden actief in fase 1", actieveVelden().map((v2) => v2.key), ["doelstelling", "activiteiten", "samenwerking", "impact", "resultaten", "planning"]);
gelijk("16 jsonvelden gereserveerd voor fase 2", PI_VELDEN.filter((v2) => v2.opslag === "json").length, 16);
gelijk("projectbrede instellingen: programma en schrijfvoorkeur", PI_PROJECTBREED.map((v2) => v2.key), ["programma", "schrijfvoorkeur"]);
check("sleutels zijn stabiel (documentatie in README noemt alle 22)", (() => {
  const r = readFileSync("src/features/kompas-app/projectinformatie/README.md", "utf8");
  return PI_KEYS.every((k) => r.includes(k));
})());
console.log("\n== 2. Lezen en schrijven zonder verlies");
var project = { id: "p1", naam: "X", doelstellingen: "D", activiteiten: "A", partners: "P", impact: "I", resultaten: "R", planning: "PL", programma: "Prog", schrijfvoorkeur: "warm", omschrijving: "O", begroting: 1e3, eigenBijdrage: 100, cofin: [{ naam: "C" }], bronnen: { doelstellingen: "upload" } };
var l = leesProjectinformatie(project);
gelijk("kolomvelden komen uit de bestaande projectvelden", [l.doelstelling, l.activiteiten, l.samenwerking, l.impact, l.resultaten, l.planning], ["D", "A", "P", "I", "R", "PL"]);
check("jsonvelden zijn leeg zolang project_info niet bestaat", PI_VELDEN.filter((v2) => v2.opslag === "json").every((v2) => l[v2.key] === ""));
gelijk("round-trip zonder wijziging laat het project identiek", schrijfProjectinformatie(project, l), project);
var w = schrijfProjectinformatie(project, { doelstelling: "D2" });
gelijk("alleen de genoemde key verandert", [w.doelstellingen, w.activiteiten, w.partners, w.naam, w.omschrijving, w.begroting, w.cofin], ["D2", "A", "P", "X", "O", 1e3, [{ naam: "C" }]]);
check("onbekende keys worden genegeerd", JSON.stringify(schrijfProjectinformatie(project, { onzin: "x" })) === JSON.stringify(project));
check("invoerproject wordt niet gemuteerd", project.doelstellingen === "D");
var metJson = { ...project, projectInfo: { versie: 1, velden: { aanleiding: "Probleem", risicos: "R1" } } };
gelijk("jsonvelden worden gelezen uit projectInfo.velden (fase 2)", [leesProjectinformatie(metJson).aanleiding, leesProjectinformatie(metJson).risicos], ["Probleem", "R1"]);
var w2 = schrijfProjectinformatie(metJson, { doelstelling: "D3" });
gelijk("bestaande jsonvelden blijven bij een kolomwijziging behouden", w2.projectInfo, metJson.projectInfo);
var w3 = schrijfProjectinformatie(metJson, { borging: "B" });
gelijk("jsonveld schrijven behoudt de andere jsonvelden en zet versie", [w3.projectInfo.versie, w3.projectInfo.velden], [PI_VERSIE, { aanleiding: "Probleem", risicos: "R1", borging: "B" }]);
console.log("\n== 3. Paneel (programma en schrijfvoorkeur)");
gelijk("paneel toont alleen actieve velden", paneelVelden(project).map((v2) => v2.key), actieveVelden().map((v2) => v2.key));
gelijk("herkomst per veld uit project.bronnen", paneelVelden(project).find((v2) => v2.key === "doelstelling").bron, "upload");
gelijk("paneelProjectbreed: waarden", paneelProjectbreed(project).map((v2) => v2.waarde), ["Prog", "warm"]);
var s = schrijfPaneel(project, { programma: "Nieuw", schrijfvoorkeur: "zakelijk", planning: "Q2" });
gelijk("schrijfPaneel zet programma, schrijfvoorkeur en kolomvelden", [s.programma, s.schrijfvoorkeur, s.planning, s.doelstellingen], ["Nieuw", "zakelijk", "Q2", "D"]);
gelijk("programmasuggesties: uniek, gesorteerd, zonder leeg", programmaSuggesties([{ programma: "B" }, { programma: "a" }, { programma: "B" }, { programma: "" }, {}]), ["a", "B"]);
gelijk("voortgang: 6 van 6", [voortgang(project).ingevuld, voortgang(project).totaal], [6, 6]);
gelijk("voortgang: leeg project 0 van 6", [voortgang({}).ingevuld, voortgang({}).totaal], [0, 6]);
gelijk("voortgang: spaties tellen niet", voortgang({ doelstellingen: "   " }).ingevuld, 0);
gelijk("voortgang over alle 22: 6 van 22", [voortgang(project, false).ingevuld, voortgang(project, false).totaal], [6, 22]);
console.log("\n== 4. Opslag naar bestaande databasekolommen (geen schemawijziging)");
var patch = naarKolomPatch({ ...project, periodeVan: "2027-01-01", periodeTot: "2027-12-31" });
gelijk(
  "doelstelling -> goals, activiteiten -> activities, samenwerking -> partners, impact -> impact_description, resultaten -> results, planning -> planning, programma -> program_label, schrijfvoorkeur -> writing_preferences",
  [patch.goals, patch.activities, patch.partners, patch.impact_description, patch.results, patch.planning, patch.program_label, patch.writing_preferences],
  ["D", "A", "P", "I", "R", "PL", "Prog", "warm"]
);
check("geen project_info in de patch (geen databasewijziging in fase 1)", !("project_info" in patch));
console.log("\n== 5. Gedeelde validatie compact formulier");
gelijk("naam verplicht", valideerEnBereidOp({ naam: " " }).ok, false);
gelijk("einddatum voor startdatum geweigerd", valideerEnBereidOp({ naam: "X", periodeVan: "2027-05-01", periodeTot: "2027-01-01" }).ok, false);
gelijk("oude vrije-tekst looptijd blokkeert niet", valideerEnBereidOp({ naam: "X", periodeVan: "Q1 2027", periodeTot: "2027-01-01" }).ok, true);
gelijk("ongeldig bedrag geweigerd", valideerEnBereidOp({ naam: "X", begroting: "12x" }).ok, false);
var v = valideerEnBereidOp({ naam: "X", begroting: "\u20AC 10.000", eigenBijdrage: "2.500", doelstellingen: "blijft" });
gelijk("gevraagd = begroting - eigen bijdrage; overige velden blijven", [v.ok, v.project.begroting, v.project.eigenBijdrage, v.project.gevraagd, v.project.doelstellingen], [true, 1e4, 2500, 7500, "blijft"]);
gelijk("zonder begroting blijft gevraagd leeg", valideerEnBereidOp({ naam: "X" }).project.gevraagd, "");
console.log("\n== 6. Matching en financiering ongemoeid");
var lees = (p) => readFileSync(p, "utf8");
check("projectinformatie.js importeert niets (pure module)", !/^import /m.test(lees("src/features/kompas-app/projectinformatie/projectinformatie.js")));
check("Edge Function en migraties niet verwezen door fase 1", !/supabase/i.test(lees("src/features/kompas-app/projectinformatie/projectinformatie.js").replace(/\/\/.*$/gm, "")));
check("compact formulier gebruikt teFinancieren, geen eigen berekening", /teFinancieren/.test(lees("src/features/kompas-app/projectOpslaan.js")));
console.log("\n== 7. Trefwoorden uit de omschrijving (voorstellen, geen automatische opslag)");
var DG = ["Buurtbewoners", "Jongeren", "Kinderen", "Ouderen", "Vluchtelingen", "Vrijwilligers", "Mensen in armoede", "Dieren"];
var TH = ["Eenzaamheid", "Sport", "Welzijn", "Kunst", "Muziek", "Zorg", "Rechten", "Maatschappij", "Onderwijs", "Taalvaardigheid", "Duurzaamheid", "Opleiding / beroepsontwikkeling"];
var RG = ["Amsterdam", "Utrecht", "Leiden", "Afrika", "Landelijk", "Caribisch gebied", "Caribisch deel van het Koninkrijk", "Den Haag", "Wereld / internationaal", "Rotterdam", "Oost-Europa"];
var voor = (tekst2, gekozen = {}) => stelTrefwoordenVoor({ tekst: tekst2, doelgroepen: DG, themas: TH, regios: RG, gekozen });
var namen = (r) => ({ doelgroep: r.doelgroep.map((x) => x.naam), discipline: r.discipline.map((x) => x.naam), regio: r.regio.map((x) => x.naam) });
var r1 = namen(voor("Wekelijks een warme maaltijd voor eenzame ouderen in Utrecht-Noord, met hulp van vrijwilligers uit de buurt."));
gelijk("eenzame ouderen in Utrecht-Noord", r1, { doelgroep: ["Ouderen", "Vrijwilligers"], discipline: ["Eenzaamheid"], regio: ["Utrecht"] });
var r2 = namen(voor("Taalcaf\xE9 voor vluchtelingen en kinderen in Den Haag en Rotterdam, door heel Nederland uit te rollen."));
gelijk("taalcaf\xE9: doelgroep, thema en meerdere plaatsen", [r2.doelgroep, r2.discipline, r2.regio.includes("Den Haag"), r2.regio.includes("Rotterdam"), r2.regio.includes("Landelijk")], [["Kinderen", "Vluchtelingen"], ["Taalvaardigheid"], true, true, true]);
gelijk("land wordt gekoppeld aan werelddeel (Ghana -> Afrika)", namen(voor("Een waterproject voor dorpen in Ghana en Kenia.")).regio, ["Afrika"]);
gelijk("Caribische eilanden -> beide Caribische werkgebieden", namen(voor("Jongerenwerk op Bonaire en Sint Eustatius voor de jeugd.")).regio.sort(), ["Caribisch deel van het Koninkrijk", "Caribisch gebied"]);
gelijk('"leiden tot" is geen Leiden (hoofdletter vereist)', namen(voor("Dit project gaat leiden tot meer zelfvertrouwen bij de deelnemers.")).regio, []);
gelijk('Leiden als plaats wel, maar niet voor "Leiden van mensen"', [namen(voor("Een project in Leiden voor de wijk.")).regio, namen(voor("Leiden van mensen naar werk is ons doel.")).regio], [["Leiden"], []]);
gelijk('"landelijk gebied" is niet Landelijk', namen(voor("Een dorpshuis in het landelijk gebied van Drenthe.")).regio, []);
gelijk("al gekozen waarden komen niet terug", namen(voor("Eenzame ouderen in Utrecht", { doelgroep: ["Ouderen"], discipline: ["Eenzaamheid"], regio: "Utrecht-Noord" })), { doelgroep: [], discipline: [], regio: [] });
gelijk("lege of korte tekst: geen voorstellen", namen(voor("Ouderen")), { doelgroep: [], discipline: [], regio: [] });
gelijk("thema Rechten en Maatschappij worden nooit automatisch voorgesteld", namen(voor("Wij verdedigen de rechten van de maatschappij in alle opzichten.")).discipline, []);
gelijk("voorstellen komen alleen uit de aangeleverde tabellen", namen(stelTrefwoordenVoor({ tekst: "Eenzame ouderen sporten samen in Utrecht.", doelgroepen: ["Kinderen"], themas: ["Muziek"], regios: ["Amsterdam"] })), { doelgroep: [], discipline: [], regio: [] });
gelijk("trefwoorden die de herkenning veroorzaakten worden meegegeven", voor("Eenzame ouderen hier.").doelgroep[0].trefwoorden, ["ouderen"]);
check(`maximaal ${MAX_VOORSTELLEN} voorstellen per categorie`, Object.values(voor("Kunst, muziek, sport, welzijn, zorg, onderwijs, duurzaam, eenzaam en taalcaf\xE9 voor jongeren, kinderen, ouderen, vrijwilligers en vluchtelingen in Amsterdam, Utrecht, Leiden, Rotterdam en Den Haag.")).every((l2) => l2.length <= MAX_VOORSTELLEN));
gelijk("waarde zonder eigen patronen wordt op de eigen naam herkend (opleiding)", namen(voor("Een opleiding voor jonge mensen die werk zoeken.")).discipline, ["Opleiding / beroepsontwikkeling"]);
gelijk("regio toevoegen: leeg, dubbel en kommalijst", [voegRegioToe("", "Utrecht"), voegRegioToe("Utrecht-Noord", "Utrecht"), voegRegioToe("Amsterdam", "Utrecht")], ["Utrecht", "Utrecht-Noord", "Amsterdam, Utrecht"]);
check("trefwoorden.js importeert niets (pure module) en raakt de database niet", !/^import /m.test(lees("src/features/kompas-app/projectinformatie/trefwoorden.js")) && !/supabase|fetch\(|query\(/.test(lees("src/features/kompas-app/projectinformatie/trefwoorden.js").replace(/\/\/.*$/gm, "")));
console.log(`
${ok} geslaagd, ${fail} mislukt`);
process.exit(fail ? 1 : 0);
