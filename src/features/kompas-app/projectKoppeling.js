// Scheiding tussen ORGANISATIE, PROJECT en DOCUMENT/FONDSAANVRAAG, en de
// koppeling tussen het gespreksdossier en het project. Alles hier is puur
// (geen React, geen netwerk) zodat het apart getest kan worden.
//
//   ORGANISATIE  blijvende, institutionele gegevens          -> organisatieprofiel
//   PROJECT      gegevens van precies één project            -> subsidie_kompas_programs
//   DOCUMENT     wensen voor één document of één fonds       -> knowledge_items.document_context
//
// Herkomst per projectveld (project.bronnen, opgeslagen als field_sources):
//   handmatig          door het lid zelf ingevuld in het projectformulier
//   upload             uit een door het lid geüpload document
//   gesprek            het lid zei het zelf in het gesprek (citaat server-side geverifieerd)
//   gesprek-bevestigd  voorstel van Subsidie Kompas dat het lid expliciet bevestigde
//   ai-afgeleid        gereserveerd: afgeleid door AI zonder bevestiging (wordt nooit automatisch opgeslagen)

export const BRON_HANDMATIG = 'handmatig';
export const BRON_GESPREK = 'gesprek';
export const BRON_GESPREK_BEVESTIGD = 'gesprek-bevestigd';

// Dossierveld (server) -> projectveld (frontend). Bewust NIET opgenomen:
// 'documentinstructies' en 'fondsKeuze' - dat is document-/fondsniveau en mag
// het project nooit permanent veranderen.
export const DOSSIER_NAAR_PROJECT = {
  projectnaam: 'naam',
  doelgroep: 'doelgroep',
  probleem: 'omschrijving',
  doel: 'doelstellingen',
  activiteiten: 'activiteiten',
  locatie: 'regio',
  planning: 'planning',
  resultaten: 'resultaten',
  impact: 'impact',
  partners: 'partners',
  begroting: 'begroting',
  schrijfstijl: 'schrijfvoorkeur',
};

export const DOCUMENT_NIVEAU_DOSSIERVELDEN = ['documentinstructies', 'fondsKeuze'];

// Projectvelden waarvan we de herkomst bijhouden.
export const PROJECT_BRONVELDEN = [
  'naam',
  'doelgroep',
  'regio',
  'omschrijving',
  'doelstellingen',
  'activiteiten',
  'planning',
  'impact',
  'partners',
  'resultaten',
  'begroting',
  'gevraagd',
  'eigenBijdrage',
  'periodeVan',
  'periodeTot',
  'schrijfvoorkeur',
];

const INHOUD_DOSSIERVELDEN = [
  'doelgroep',
  'probleem',
  'doel',
  'activiteiten',
  'locatie',
  'planning',
  'resultaten',
  'impact',
  'partners',
  'begroting',
];

// Expliciet verzoek om iets projectmatigs te maken. Een los brainstormbericht
// ("misschien iets met jongeren") valt hier bewust niet onder.
export const PROJECT_SIGNAAL_RE =
  /\b(projectplan|projectvoorstel|projectbeschrijving|begroting|fondsaanvraag|subsidieaanvraag|aanvraagtekst|motivatie|(?:aanvraag|plan)\s+(?:schrijven|maken|opstellen|uitwerken)|schrijf\w*\s+(?:een\s+|de\s+|mijn\s+|ons\s+)?(?:aanvraag|projectplan|plan))\b/i;

const isLeeg = (v) => (Array.isArray(v) ? v.length === 0 : !String(v ?? '').trim());

const STOPWOORDEN = new Set(['het', 'de', 'een', 'project', 'van', 'voor', 'in', 'op', 'en', 'te', 'aan']);

export function normaliseerNaam(naam) {
  return String(naam || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOPWOORDEN.has(w))
    .join(' ')
    .trim();
}

export function gelijkeNaam(a, b) {
  const x = normaliseerNaam(a);
  const y = normaliseerNaam(b);

  if (!x || !y) {
    return false;
  }

  if (x === y) {
    return true;
  }

  const [kort, lang] = x.length <= y.length ? [x, y] : [y, x];

  if (kort.length >= 5 && lang.includes(kort)) {
    return true;
  }

  const wa = new Set(x.split(' '));
  const wb = new Set(y.split(' '));
  const gemeen = [...wa].filter((w) => wb.has(w)).length;
  const totaal = new Set([...wa, ...wb]).size;

  return totaal > 0 && gemeen / totaal >= 0.6;
}

// Bestaande projecten (ook gearchiveerde) met dezelfde of een zeer
// vergelijkbare naam. Nooit stilzwijgend een duplicaat aanmaken.
export function zoekGelijkeProjecten(naam, projecten) {
  return (projecten || []).filter((p) => gelijkeNaam(naam, p.naam));
}

// Eén bedrag uit vrije tekst, alleen als het ondubbelzinnig is ("€ 85.000" of
// "85000 euro" -> "85000"). Meerdere getallen of geen duidelijk bedrag -> null,
// zodat nooit een verkeerd getal in een financieel veld terechtkomt.
export function bedragUitTekst(tekst) {
  const ruw = String(tekst ?? '');
  const treffers = ruw.match(/\d{1,3}(?:[.\s]\d{3})+(?:,\d+)?|\d+(?:,\d+)?/g) || [];
  const bedragen = treffers
    .map((t) => Number(t.replace(/[.\s]/g, '').replace(',', '.')))
    .filter((n) => Number.isFinite(n) && n >= 100);

  return bedragen.length === 1 ? String(Math.round(bedragen[0])) : null;
}

// Zet het gespreksdossier om naar projectvelden + herkomst per veld. Alleen
// velden met een door de server geverifieerde herkomst uit het gesprek
// ('lid' of 'bevestigd'); velden die slechts uit al opgeslagen gegevens
// komen ('profiel') worden niet overgenomen - dat is niets nieuws.
export function dossierNaarProjectVelden(dossier, dossierBronnen) {
  const velden = {};
  const bronnen = {};

  Object.entries(DOSSIER_NAAR_PROJECT).forEach(([dossierVeld, projectVeld]) => {
    const waarde = dossier ? dossier[dossierVeld] : null;

    if (isLeeg(waarde)) {
      return;
    }

    const bronType = (dossierBronnen || {})[dossierVeld];

    // Zonder meegegeven herkomst aannemen dat het uit het gesprek komt is
    // niet toegestaan voor 'profiel'; lid/bevestigd zijn de enige bronnen.
    if (bronType === 'profiel') {
      return;
    }

    const bron = bronType === 'bevestigd' ? BRON_GESPREK_BEVESTIGD : BRON_GESPREK;
    let uitkomst = String(waarde).trim();

    if (projectVeld === 'begroting') {
      const bedrag = bedragUitTekst(uitkomst);

      if (!bedrag) {
        return;
      }

      uitkomst = bedrag;
    }

    velden[projectVeld] = projectVeld === 'doelgroep' ? [uitkomst] : uitkomst;
    bronnen[projectVeld] = bron;
  });

  return { velden, bronnen };
}

const gelijkWaarde = (a, b) => {
  const maak = (v) => (Array.isArray(v) ? v.join(', ') : String(v ?? '')).trim().toLowerCase().replace(/\s+/g, ' ');

  return maak(a) === maak(b);
};

// Wat mag er automatisch in een bestaand project? Alleen lege velden worden
// aangevuld. Een ingevuld veld dat door het lid zelf is ingevuld (handmatig,
// upload of eerder bevestigd) wordt NOOIT stilzwijgend overschreven: een
// afwijkende waarde uit het gesprek komt als conflict terug en wacht op een
// keuze van het lid. Een eerder uit het gesprek overgenomen waarde mag wel
// door een nieuwere uitspraak in het gesprek worden bijgewerkt.
export function bepaalVeldUpdates(project, nieuwe) {
  const vulling = {};
  const bijwerking = {};
  const conflicten = {};
  const bronnen = {};

  Object.entries(nieuwe?.velden || {}).forEach(([veld, waarde]) => {
    const huidig = project ? project[veld] : null;
    const huidigeBron = project?.bronnen?.[veld] || null;
    const nieuweBron = nieuwe.bronnen[veld];

    if (isLeeg(huidig)) {
      vulling[veld] = waarde;
      bronnen[veld] = nieuweBron;

      return;
    }

    if (gelijkWaarde(huidig, waarde)) {
      return;
    }

    if (huidigeBron === BRON_GESPREK) {
      bijwerking[veld] = waarde;
      bronnen[veld] = nieuweBron;

      return;
    }

    conflicten[veld] = { huidig, nieuw: waarde, bron: nieuweBron };
  });

  return { vulling, bijwerking, conflicten, bronnen };
}

export function pasUpdatesToe(project, updates, { metConflicten = false } = {}) {
  const velden = { ...updates.vulling, ...updates.bijwerking };
  const bronnen = { ...(project.bronnen || {}), ...updates.bronnen };

  if (metConflicten) {
    Object.entries(updates.conflicten || {}).forEach(([veld, c]) => {
      velden[veld] = Array.isArray(c.nieuw) ? c.nieuw : Array.isArray(project[veld]) ? [c.nieuw] : c.nieuw;
      bronnen[veld] = c.bron;
    });
  }

  return { ...project, ...velden, bronnen };
}

// Markeert velden die het lid zelf wijzigde in het projectformulier als
// 'handmatig' (en laat de rest van de herkomst ongemoeid).
export function markeerHandmatigeWijzigingen(vorig, nieuw) {
  const bronnen = { ...((nieuw && nieuw.bronnen) || (vorig && vorig.bronnen) || {}) };

  PROJECT_BRONVELDEN.forEach((veld) => {
    const was = vorig ? vorig[veld] : '';
    const is = nieuw ? nieuw[veld] : '';

    if (!gelijkWaarde(was, is)) {
      if (isLeeg(is)) {
        delete bronnen[veld];
      } else {
        bronnen[veld] = BRON_HANDMATIG;
      }
    }
  });

  return bronnen;
}

// De beslissing over wat er met het dossier van een gesprek moet gebeuren.
//   geen       niets doen (te vroeg, of geen duidelijk signaal)
//   bijwerken  er is een actief project: alleen dát project aanvullen
//   aanmaken   duidelijk signaal en geen gelijkende naam: nieuw project
//   kiezen     er bestaat al een (vergelijkbaar) project: het lid kiest
export function bepaalProjectActie({
  dossier,
  berichten,
  gekoppeldProjectId,
  projecten,
  genegeerd = false,
}) {
  if (!dossier || genegeerd) {
    return { actie: 'geen', reden: genegeerd ? 'lid koos eerder voor niet opslaan' : 'geen dossier' };
  }

  // active_program_id is leidend: met een actief project nooit een ander
  // project aanmaken, kiezen of bijwerken.
  if (gekoppeldProjectId) {
    const project = (projecten || []).find((p) => p.id === gekoppeldProjectId && !p.gearchiveerd);

    return project ? { actie: 'bijwerken', projectId: project.id } : { actie: 'geen', reden: 'actief project onbekend' };
  }

  const inhoud = INHOUD_DOSSIERVELDEN.filter((v) => !isLeeg(dossier[v])).length;
  const heeftNaam = !isLeeg(dossier.projectnaam);
  const recenteLidTekst = (berichten || [])
    .filter((m) => m && m.role === 'user')
    .slice(-8)
    .map((m) => String(m.content || ''))
    .join('\n');
  const expliciet = PROJECT_SIGNAAL_RE.test(recenteLidTekst);

  // Duidelijk signaal: een projectnaam plus minstens één inhoudelijk veld, of
  // een expliciet verzoek (projectplan/begroting/aanvraag) met minstens twee.
  const duidelijk = (heeftNaam && inhoud >= 1) || (expliciet && inhoud >= 2);

  if (!duidelijk) {
    return { actie: 'geen', reden: 'geen duidelijk signaal' };
  }

  const naam = heeftNaam ? String(dossier.projectnaam).trim() : 'Nieuw project';
  const gelijk = heeftNaam ? zoekGelijkeProjecten(naam, projecten) : [];

  if (gelijk.length) {
    return { actie: 'kiezen', naam, kandidaten: gelijk.map((p) => ({ id: p.id, naam: p.naam, gearchiveerd: !!p.gearchiveerd })) };
  }

  return { actie: 'aanmaken', naam };
}

// Organisatiebrede voorstellen: laatste vangnet aan de clientkant, naast de
// server. Een genoemde plek is bij een actief project de projectlocatie.
export function filterOrganisatieVoorstel(velden, { projectActief = false } = {}) {
  const uit = {};

  Object.entries(velden || {}).forEach(([k, v]) => {
    if (k === 'regio' && projectActief) {
      return;
    }

    uit[k] = v;
  });

  return uit;
}

// Labels voor de "opgeslagen in project"-melding.
export const PROJECTVELD_LABELS = {
  naam: 'naam',
  doelgroep: 'doelgroep',
  regio: 'projectlocatie',
  omschrijving: 'omschrijving',
  doelstellingen: 'doelstellingen',
  activiteiten: 'activiteiten',
  planning: 'planning',
  impact: 'impact',
  partners: 'partners',
  resultaten: 'resultaten',
  begroting: 'begroting',
  schrijfvoorkeur: 'schrijfvoorkeur',
};

export function veldenOpLijst(velden) {
  return Object.keys(velden || {})
    .map((k) => PROJECTVELD_LABELS[k] || k)
    .join(', ');
}
