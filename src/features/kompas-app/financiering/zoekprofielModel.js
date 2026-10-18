// Het zoekprofiel dat het lid controleert en bevestigt voordat Subsidie Kompas fondsen zoekt, ZUIVER (geen React, geen netwerk).
// Eén structuur voor beide routes (Projectfinanciering en chat): de server (voorstel-zoekprofiel) levert het profiel, het lid past aan, en het
// bevestigde profiel gaat als `zoekprofiel` terug naar voorstel-genereren / voorstel-aanvullen. De server toetst het daar opnieuw aan de
// databasecategorieën; deze module bepaalt dus nooit wat een fonds is of past, alleen wat het lid ziet, wijzigt en terugstuurt.
//
// Uitgangspunten:
//   - Meervoudig overal: disciplines, werkvelden, doelgroepen en werkgebieden zijn LIJSTEN. Niets wordt stil tot één waarde teruggebracht.
//   - Er is geen aparte werkveld-tabel: werkvelden zijn de overige thema's uit dezelfde lijst als de disciplines (tabel themas). Een thema staat
//     in hooguit één van beide lijsten (discipline = waar het project echt over gaat).
//   - Wat het lid zelf wijzigde staat in `gewijzigd` en wordt nooit overschreven door een opnieuw opgesteld profiel; nieuwe voorstellen van de
//     server komen apart in beeld (`voorstellen`) en het lid kiest zelf.
//   - Het concept (de wijzigingen van het lid) blijft bewaard bij fouten en verversen (browseropslag, per project en route), en verdwijnt pas
//     na het opslaan van het voorstel of een uitdrukkelijke keuze om opnieuw te beginnen.

export const LIJST_VELDEN = [
  { sleutel: 'disciplines', label: 'Disciplines', hulp: 'Waar het project echt over gaat (kies er gerust meer dan één).', bron: 'themas', placeholder: 'Selecteer discipline(s)' },
  { sleutel: 'werkvelden', label: 'Werkvelden en thema’s', hulp: 'Overige thema’s waar het project raakt. Dezelfde lijst als de disciplines.', bron: 'themas', placeholder: 'Selecteer werkveld(en)' },
  { sleutel: 'doelgroepen', label: 'Doelgroepen', hulp: 'Voor wie het project is bedoeld.', bron: 'doelgroepen', placeholder: 'Selecteer doelgroep(en)' },
  { sleutel: 'werkgebieden', label: 'Werkgebieden', hulp: 'Waar het project plaatsvindt (plaats, provincie of landelijk).', bron: 'regios', placeholder: 'Selecteer werkgebied(en)' },
];

export const BRON_LABEL = {
  project: 'uit uw project',
  gesprek: 'uit het gesprek',
  ai: 'aangevuld door Subsidie Kompas',
  gebruiker: 'door u gekozen',
};

export const ONTBREKEND_LABEL = {
  disciplines: 'discipline of werkveld',
  doelgroepen: 'doelgroep',
  werkgebied: 'werkgebied',
  periode: 'looptijd',
  financieringsbehoefte: 'financieringsbehoefte',
  omschrijving: 'omschrijving',
};

export const MAX_TREFWOORDEN = 10;
export const MAX_PER_LIJST = 12; // de server gebruikt hoogstens 12 per lijst; meer wordt gemeld, niet stil weggelaten

const isObject = (x) => typeof x === 'object' && x !== null && !Array.isArray(x);
const lijst = (x) => (Array.isArray(x) ? x : []);
const tekst = (x, max) => String(x == null ? '' : x).replace(/\s+/g, ' ').trim().slice(0, max);
const norm = (t) => String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const BRONNEN = ['project', 'gesprek', 'ai', 'gebruiker'];

const items = (x) =>
  lijst(x)
    .map((i) => (isObject(i) ? { naam: tekst(i.naam, 120), bron: BRONNEN.includes(i.bron) ? i.bron : 'ai' } : { naam: tekst(i, 120), bron: 'gebruiker' }))
    .filter((i) => i.naam);

const uniek = (arr) => {
  const gezien = new Set();

  return arr.filter((i) => {
    const k = norm(i.naam);

    if (gezien.has(k)) return false;

    gezien.add(k);

    return true;
  });
};

// ---------------------------------------------------------------------------------------------------------------------------
// 1. Van serverprofiel naar bewerkbare toestand

export function maakProfielState(profiel, { route = 'project' } = {}) {
  const p = isObject(profiel) ? profiel : {};
  const f = isObject(p.financieringsbehoefte) ? p.financieringsbehoefte : {};
  const per = isObject(p.periode) ? p.periode : {};
  const bronnen = isObject(p.bronnen) ? p.bronnen : {};

  return {
    versie: 1,
    route: p.route === 'chat' || route === 'chat' ? 'chat' : 'project',
    omschrijving: tekst(p.omschrijving, 700),
    trefwoorden: lijst(p.trefwoorden).map((t) => tekst(t, 30).toLowerCase()).filter(Boolean).slice(0, MAX_TREFWOORDEN),
    disciplines: uniek(items(p.disciplines)),
    werkvelden: uniek(items(p.werkvelden)),
    doelgroepen: uniek(items(p.doelgroepen)),
    werkgebieden: uniek(items(p.werkgebieden)),
    locatie: tekst(p.locatie, 80),
    periodeStart: ISO.test(per.start || '') ? per.start : '',
    periodeEind: ISO.test(per.eind || '') ? per.eind : '',
    periodeBron: BRONNEN.includes(per.bron) ? per.bron : null,
    financiering: {
      gat: Number.isFinite(f.gat) && f.gat > 0 ? f.gat : null,
      totaalBudget: Number.isFinite(f.totaalBudget) && f.totaalBudget > 0 ? f.totaalBudget : null,
      eigenBijdrage: Number.isFinite(f.eigenBijdrage) && f.eigenBijdrage > 0 ? f.eigenBijdrage : null,
      bekend: f.bekend === true,
    },
    // Door de server gemelde onzekerheden en gaten; het lid kan een onzekere term koppelen aan een categorie of negeren.
    onzeker: lijst(p.onzeker)
      .filter(isObject)
      .map((o) => ({ soort: tekst(o.soort, 20), term: tekst(o.term, 80), reden: tekst(o.reden, 300) }))
      .filter((o) => o.term)
      .slice(0, 30),
    ontbrekend: lijst(p.ontbrekend).map((x) => tekst(x, 30)).filter(Boolean),
    vragen: lijst(p.vragen).map((x) => tekst(x, 200)).filter(Boolean).slice(0, 3),
    bronnen: { documenten: Number.isInteger(bronnen.documenten) ? bronnen.documenten : 0, gesprek: bronnen.gesprek === true, ai: ['gebruikt', 'niet-beschikbaar', 'mislukt'].includes(bronnen.ai) ? bronnen.ai : 'niet-beschikbaar' },
    // Velden die het lid zelf wijzigde: die overschrijft een opnieuw opgesteld profiel nooit.
    gewijzigd: {},
    // Termen die het lid bewust negeert (onzekere koppelingen).
    genegeerd: [],
    // Nieuwe voorstellen van de server die het lid nog niet overnam (na "opnieuw opstellen").
    voorstellen: {},
  };
}

// ---------------------------------------------------------------------------------------------------------------------------
// 2. Wijzigingen van het lid

const markeer = (state, veld) => ({ ...state.gewijzigd, [veld]: true });

// Zet een lijst op de gekozen namen. Bestaande items houden hun herkomst; nieuwe krijgen "door u gekozen". Een thema staat in hooguit één van
// disciplines en werkvelden (de laatst gewijzigde lijst wint, zodat een gekozen waarde nooit verdwijnt).
export function zetLijst(state, sleutel, namen) {
  const huidig = new Map(state[sleutel].map((i) => [norm(i.naam), i]));
  const nieuw = uniek(lijst(namen).map((n) => tekst(n, 120)).filter(Boolean).map((naam) => huidig.get(norm(naam)) || { naam, bron: 'gebruiker' }));
  let uit = { ...state, [sleutel]: nieuw, gewijzigd: markeer(state, sleutel) };
  const andere = sleutel === 'disciplines' ? 'werkvelden' : sleutel === 'werkvelden' ? 'disciplines' : null;

  if (andere) {
    const gekozen = new Set(nieuw.map((i) => norm(i.naam)));
    const rest = uit[andere].filter((i) => !gekozen.has(norm(i.naam)));

    if (rest.length !== uit[andere].length) uit = { ...uit, [andere]: rest, gewijzigd: { ...uit.gewijzigd, [andere]: true } };
  }

  return uit;
}

export function zetVeld(state, veld, waarde) {
  if (!['omschrijving', 'locatie', 'periodeStart', 'periodeEind'].includes(veld)) return state;

  const max = veld === 'omschrijving' ? 700 : veld === 'locatie' ? 80 : 10;

  return { ...state, [veld]: String(waarde == null ? '' : waarde).slice(0, max), gewijzigd: markeer(state, veld) };
}

// Trefwoorden als tekst met komma's ("hiphop, talentontwikkeling").
export function zetTrefwoorden(state, invoer) {
  const woorden = [];

  for (const w of String(invoer == null ? '' : invoer).split(/[,;\n]/)) {
    const s = tekst(w, 30).toLowerCase();

    if (s && !woorden.includes(s) && woorden.length < MAX_TREFWOORDEN) woorden.push(s);
  }

  return { ...state, trefwoorden: woorden, gewijzigd: markeer(state, 'trefwoorden') };
}

// Een onzekere term koppelen aan een categorie uit de database (lijstsleutel + naam), of negeren.
export function koppelOnzeker(state, term, sleutel, naam) {
  const metTerm = state.onzeker.filter((o) => o.term !== term);
  const basis = { ...state, onzeker: metTerm };

  if (!naam || !LIJST_VELDEN.some((v) => v.sleutel === sleutel)) return basis;

  return zetLijst(basis, sleutel, [...state[sleutel].map((i) => i.naam), naam]);
}

export function negeerOnzeker(state, term) {
  return { ...state, onzeker: state.onzeker.filter((o) => o.term !== term), genegeerd: [...new Set([...state.genegeerd, term])] };
}

// ---------------------------------------------------------------------------------------------------------------------------
// 3. Opnieuw opgesteld profiel samenvoegen zonder de wijzigingen van het lid te overschrijven

const LIJST_SLEUTELS = LIJST_VELDEN.map((v) => v.sleutel);
const VELD_SLEUTELS = ['omschrijving', 'locatie', 'periodeStart', 'periodeEind', 'trefwoorden'];

// huidig: de toestand met de wijzigingen van het lid (bijvoorbeeld uit het concept). nieuw: een vers profiel van de server.
// Een veld dat het lid wijzigde blijft zoals het is; wat de server nu méér voorstelt komt in `voorstellen` (het lid kiest zelf).
// Een veld dat het lid niet wijzigde wordt ververst. -> nieuwe toestand
export function voegSamen(huidig, nieuw) {
  if (!huidig) return nieuw;

  const uit = { ...nieuw, gewijzigd: { ...huidig.gewijzigd }, genegeerd: [...huidig.genegeerd], voorstellen: {} };

  for (const v of VELD_SLEUTELS) {
    if (huidig.gewijzigd[v]) uit[v] = huidig[v];
  }

  for (const s of LIJST_SLEUTELS) {
    if (!huidig.gewijzigd[s]) continue;

    uit[s] = huidig[s];

    const bekend = new Set(huidig[s].map((i) => norm(i.naam)));
    const extra = nieuw[s].filter((i) => !bekend.has(norm(i.naam)));

    if (extra.length) uit.voorstellen[s] = extra;
  }

  // Een discipline en een werkveld mogen niet dubbel voorkomen na het samenvoegen.
  const disc = new Set(uit.disciplines.map((i) => norm(i.naam)));

  uit.werkvelden = uit.werkvelden.filter((i) => !disc.has(norm(i.naam)));
  uit.onzeker = nieuw.onzeker.filter((o) => !huidig.genegeerd.includes(o.term) && !LIJST_SLEUTELS.some((s) => huidig[s].some((i) => norm(i.naam) === norm(o.term))));

  return uit;
}

export function neemVoorstelOver(state, sleutel, naam) {
  const v = state.voorstellen[sleutel] || [];
  const rest = v.filter((i) => norm(i.naam) !== norm(naam));
  const uit = zetLijst(state, sleutel, [...state[sleutel].map((i) => i.naam), naam]);

  return { ...uit, voorstellen: { ...state.voorstellen, [sleutel]: rest } };
}

// ---------------------------------------------------------------------------------------------------------------------------
// 4. Controle voor het bevestigen en het verzoek aan de server

// lijsten: { themas, doelgroepen, regios } uit de classificaties (dezelfde tabellen als de matching), of null als die niet geladen zijn.
// -> { ok, fouten: { [veld]: tekst }, waarschuwingen: [tekst] }. Blokkeert alleen wat de server ook zou weigeren of waarmee zoeken zinloos is.
export function controleerProfiel(state, lijsten = null) {
  const fouten = {};
  const waarschuwingen = [];
  const inhoud = state.disciplines.length + state.werkvelden.length + state.doelgroepen.length;

  if (!inhoud) fouten.algemeen = 'Kies minstens één discipline, werkveld of doelgroep; daarop zoekt Subsidie Kompas financiers.';

  if (lijsten) {
    for (const v of LIJST_VELDEN) {
      const geldig = new Set(lijst(lijsten[v.bron]).map(norm));
      const onbekend = state[v.sleutel].filter((i) => !geldig.has(norm(i.naam)));

      if (onbekend.length) fouten[v.sleutel] = `${onbekend.map((i) => i.naam).join(', ')} ${onbekend.length === 1 ? 'staat' : 'staan'} niet in de lijst van Subsidie Kompas. Kies een waarde uit de lijst of haal het weg.`;
    }
  }

  for (const v of LIJST_VELDEN) {
    if (state[v.sleutel].length > MAX_PER_LIJST) fouten[v.sleutel] = `Kies hoogstens ${MAX_PER_LIJST} waarden; Subsidie Kompas gebruikt er niet meer.`;
  }

  if (state.periodeStart && state.periodeEind && state.periodeEind < state.periodeStart) fouten.periode = 'De einddatum ligt vóór de startdatum.';

  if (state.periodeStart && !ISO.test(state.periodeStart)) fouten.periode = 'Gebruik een geldige startdatum.';

  if (state.periodeEind && !ISO.test(state.periodeEind)) fouten.periode = 'Gebruik een geldige einddatum.';

  if (!state.financiering.bekend) waarschuwingen.push('Het bedrag dat u zoekt is nog niet bekend. U kunt wel zoeken, maar de matching op bedrag is dan beperkt: er worden geen bedragen voorgesteld.');

  if (state.onzeker.length) waarschuwingen.push(`${state.onzeker.length === 1 ? 'Eén term heeft' : `${state.onzeker.length} termen hebben`} geen exacte categorie in de database en tellen niet mee bij het zoeken, tenzij u ze koppelt.`);

  if (!state.werkgebieden.length && !state.locatie) waarschuwingen.push('Er is geen werkgebied bekend: de geografische voorwaarden van financiers worden dan niet getoetst.');

  return { ok: Object.keys(fouten).length === 0, fouten, waarschuwingen };
}

// Het profiel zoals de server het terugkrijgt (voorstel-genereren: veld zoekprofiel). De server toetst opnieuw aan de database en meldt wat afvalt.
export function bouwZoekprofielVerzoek(state) {
  const maakItems = (arr) => arr.map((i) => ({ naam: i.naam, bron: i.bron }));

  return {
    versie: 1,
    route: state.route,
    omschrijving: state.omschrijving,
    trefwoorden: state.trefwoorden,
    disciplines: maakItems(state.disciplines),
    werkvelden: maakItems(state.werkvelden),
    doelgroepen: maakItems(state.doelgroepen),
    werkgebieden: maakItems(state.werkgebieden),
    locatie: state.locatie,
    periode: { start: state.periodeStart || null, eind: state.periodeEind || null },
    financieringsbehoefte: { gat: state.financiering.gat, totaalBudget: state.financiering.totaalBudget, eigenBijdrage: state.financiering.eigenBijdrage, bekend: state.financiering.bekend },
  };
}

// Tekst over de financieringsbehoefte voor in het profiel (nooit opnieuw vragen als die bekend is).
export function financieringTekst(state, formatEuro) {
  const f = state.financiering;
  const eur = typeof formatEuro === 'function' ? formatEuro : (n) => `€ ${n}`;

  if (f.gat) return `Nog te financieren: ${eur(f.gat)}${f.totaalBudget ? ` (totale begroting ${eur(f.totaalBudget)}${f.eigenBijdrage ? `, eigen bijdrage ${eur(f.eigenBijdrage)}` : ''})` : ''}. Dit komt uit uw project en hoeft u niet opnieuw in te vullen.`;
  if (f.totaalBudget) return `Totale begroting ${eur(f.totaalBudget)}; er is geen financieringsgat meer over of het is nog niet bepaald.`;

  return 'Het bedrag dat u bij fondsen zoekt is nog niet bekend. Zoeken kan wel; de matching op bedrag is dan beperkt en er worden geen bedragen voorgesteld.';
}

// Per lijst: wat is van het project, wat van het gesprek, wat door Subsidie Kompas aangevuld en wat door het lid gekozen.
export function bronOverzicht(items) {
  const per = {};

  for (const i of items) per[i.bron] = [...(per[i.bron] || []), i.naam];

  return BRONNEN.filter((b) => per[b]).map((b) => ({ bron: b, label: BRON_LABEL[b], namen: per[b] }));
}

// ---------------------------------------------------------------------------------------------------------------------------
// 5. Concept bewaren (browseropslag, per project en route). Elke aanroep is veilig: opslag mag ontbreken of falen.

const SLEUTEL_VOORVOEGSEL = 'fwk-zoekprofiel-concept';
const CONCEPT_MAX_TEKENS = 20000;

export const conceptSleutel = (projectId, route) => `${SLEUTEL_VOORVOEGSEL}:${route === 'chat' ? 'chat' : 'project'}:${projectId}`;

export function bewaarConcept(opslag, projectId, state) {
  try {
    if (!opslag || !projectId || !state) return false;

    const json = JSON.stringify({ versie: 1, bewaardOp: new Date().toISOString(), state });

    if (json.length > CONCEPT_MAX_TEKENS) return false;

    opslag.setItem(conceptSleutel(projectId, state.route), json);

    return true;
  } catch (e) {
    return false;
  }
}

export function leesConcept(opslag, projectId, route) {
  try {
    if (!opslag || !projectId) return null;

    const ruw = opslag.getItem(conceptSleutel(projectId, route));

    if (!ruw) return null;

    const d = JSON.parse(ruw);

    if (!isObject(d) || d.versie !== 1 || !isObject(d.state)) return null;

    // Alleen de velden die het lid zelf wijzigde (en hun waarden) zijn bruikbaar; de rest wordt opnieuw opgebouwd uit het verse profiel.
    const s = d.state;
    const basis = maakProfielState({}, { route });
    const lijstenUit = Object.fromEntries(LIJST_SLEUTELS.map((k) => [k, uniek(items(s[k])).slice(0, 24)]));

    return {
      ...basis,
      ...lijstenUit,
      omschrijving: tekst(s.omschrijving, 700),
      trefwoorden: lijst(s.trefwoorden).map((t) => tekst(t, 30).toLowerCase()).filter(Boolean).slice(0, MAX_TREFWOORDEN),
      locatie: tekst(s.locatie, 80),
      periodeStart: ISO.test(s.periodeStart || '') ? s.periodeStart : '',
      periodeEind: ISO.test(s.periodeEind || '') ? s.periodeEind : '',
      gewijzigd: isObject(s.gewijzigd) ? Object.fromEntries(Object.entries(s.gewijzigd).filter(([k, v]) => v === true && (LIJST_SLEUTELS.includes(k) || VELD_SLEUTELS.includes(k)))) : {},
      genegeerd: lijst(s.genegeerd).map((t) => tekst(t, 80)).filter(Boolean).slice(0, 30),
      bewaardOp: typeof d.bewaardOp === 'string' ? d.bewaardOp : null,
    };
  } catch (e) {
    return null;
  }
}

export function wisConcept(opslag, projectId, route) {
  try {
    if (opslag && projectId) opslag.removeItem(conceptSleutel(projectId, route));
  } catch (e) {
    // opslag niet beschikbaar: niets te wissen
  }
}

export const heeftWijzigingen = (state) => Object.keys(state.gewijzigd || {}).length > 0;
