// Projectinformatie: de uitgebreide, inhoudelijke kennislaag bij één project (beheerd op de pagina Documenten).
// Projecten zelf blijft compact (matching en financiering); alles wat nodig is om hoogwaardige fondsenwervende
// documenten te schrijven staat hier. Pure logica, geen React en geen database: de UI en later de Edge Function
// lezen dezelfde definitie.
//
// OPSLAG (vaste, gedocumenteerde structuur; zie README.md in deze map)
//   - 'kolom': het veld staat al in een bestaande projectkolom (bijvoorbeeld doelstelling -> goals). Die kolommen
//     blijven de enige bron voor die velden; er wordt niets gekopieerd of gemigreerd.
//   - 'json' : het veld komt in de kolom project_info (jsonb) zodra die bestaat (fase 2):
//         { "versie": 1, "velden": { "<key>": "<tekst>" } }
//     Alleen de keys uit PI_VELDEN zijn toegestaan; de waarde is altijd tekst.
// Fase 1 toont uitsluitend velden met opslag 'kolom' (actief: true); de 'json'-velden staan al in de definitie
// zodat fase 2 alleen de kolom en de opslagfunctie hoeft toe te voegen, zonder bestaande data opnieuw te migreren.

export const PI_VERSIE = 1;

export const PI_GROEPEN = [
  { id: 'aanleiding', label: 'Aanleiding en doelgroep' },
  { id: 'aanpak', label: 'Doel en aanpak' },
  { id: 'resultaat', label: 'Resultaat en impact' },
  { id: 'uitvoering', label: 'Uitvoering' },
  { id: 'financiering', label: 'Financiering' },
];

// key = vaste sleutel (nooit hernoemen); project = naam van het bestaande projectveld bij opslag 'kolom'.
export const PI_VELDEN = [
  // 1. Aanleiding en doelgroep
  { key: 'aanleiding', groep: 'aanleiding', label: 'Aanleiding / probleemstelling', hint: 'Wat is het maatschappelijke probleem of de hulpvraag?', opslag: 'json' },
  { key: 'noodzaak', groep: 'aanleiding', label: 'Noodzaak', hint: 'Waarom is een interventie nodig?', opslag: 'json' },
  { key: 'doelgroep_uitgebreid', groep: 'aanleiding', label: 'Doelgroep (uitgebreid)', hint: 'Uitgebreide omschrijving van de doelgroep.', opslag: 'json' },
  { key: 'bereik', groep: 'aanleiding', label: 'Bereik', hint: 'Wie en hoeveel mensen worden bereikt? Vul aantallen alleen in als ze bekend zijn.', opslag: 'json' },
  { key: 'toegang_doelgroep', groep: 'aanleiding', label: 'Toegang tot de doelgroep', hint: 'Hoe bereikt het project de doelgroep?', opslag: 'json' },
  // 2. Doel en aanpak
  { key: 'doelstelling', groep: 'aanpak', label: 'Doelstelling', hint: 'Wat wilt u met dit project bereiken?', opslag: 'kolom', project: 'doelstellingen', rij: 4 },
  { key: 'subdoelstellingen', groep: 'aanpak', label: 'Subdoelstellingen', hint: 'Optioneel.', opslag: 'json' },
  { key: 'activiteiten', groep: 'aanpak', label: 'Activiteiten', hint: 'Welke concrete activiteiten voert u uit?', opslag: 'kolom', project: 'activiteiten', rij: 4 },
  { key: 'werkwijze', groep: 'aanpak', label: 'Werkwijze / aanpak', hint: 'Hoe wordt het project uitgevoerd?', opslag: 'json' },
  { key: 'samenwerking', groep: 'aanpak', label: 'Samenwerking / partners', hint: 'Welke organisaties zijn betrokken en welke rol hebben zij?', opslag: 'kolom', project: 'partners', rij: 2 },
  // 3. Resultaat en impact
  { key: 'output', groep: 'resultaat', label: 'Output', hint: 'Welke directe producten of prestaties levert het project op?', opslag: 'json' },
  { key: 'outcome', groep: 'resultaat', label: 'Outcome', hint: 'Welke veranderingen worden bij de doelgroep verwacht?', opslag: 'json' },
  { key: 'impact', groep: 'resultaat', label: 'Beoogde impact', hint: 'Welk verschil maakt dit project, voor wie?', opslag: 'kolom', project: 'impact', rij: 4 },
  { key: 'resultaten', groep: 'resultaat', label: 'Resultaten tot nu toe', hint: 'Alleen bij een bestaand of lopend project.', opslag: 'kolom', project: 'resultaten', rij: 4 },
  { key: 'monitoring_evaluatie', groep: 'resultaat', label: 'Monitoring en evaluatie', hint: 'Hoe worden voortgang en resultaten gemeten?', opslag: 'json' },
  // 4. Uitvoering
  { key: 'planning', groep: 'uitvoering', label: 'Planning', hint: 'Belangrijkste fasen, activiteiten en data.', opslag: 'kolom', project: 'planning', rij: 2 },
  { key: 'organisatie_uitvoerbaarheid', groep: 'uitvoering', label: 'Organisatie en uitvoerbaarheid', hint: 'Wie voert het project uit en hoe is de uitvoering georganiseerd?', opslag: 'json' },
  { key: 'risicos', groep: 'uitvoering', label: 'Risico’s', hint: 'Belangrijkste risico’s en beheersmaatregelen.', opslag: 'json' },
  { key: 'borging', groep: 'uitvoering', label: 'Borging / duurzaamheid', hint: 'Wat gebeurt er na afloop van de financiering?', opslag: 'json' },
  { key: 'toegevoegde_waarde', groep: 'uitvoering', label: 'Toegevoegde waarde van de organisatie', hint: 'Waarom is deze organisatie geschikt om het project uit te voeren?', opslag: 'json' },
  // 5. Financiering (financieringsbehoefte zelf komt uit Projecten en is alleen-lezen)
  { key: 'financieringsbehoefte', groep: 'financiering', label: 'Financieringsbehoefte (toelichting)', hint: 'Waarvoor is aanvullende financiering nodig? Het bedrag zelf komt uit Projecten.', opslag: 'json' },
  { key: 'begrotingstoelichting', groep: 'financiering', label: 'Begrotingstoelichting', hint: 'Toelichting op de belangrijkste begrotingsposten.', opslag: 'json' },
];

// Projectbrede instellingen die bij Projectinformatie horen maar geen inhoudsveld van de 22 zijn.
export const PI_PROJECTBREED = [
  { key: 'programma', label: 'Programma of onderdeel', hint: 'Waar valt het project onder?', project: 'programma', opslag: 'kolom', rij: 1, suggesties: true },
  { key: 'schrijfvoorkeur', label: 'Schrijfvoorkeur voor dit project', hint: 'Bijvoorbeeld: warm en mensgericht, zakelijk, resultaatgericht. Geldt voor alle teksten van dit project.', project: 'schrijfvoorkeur', opslag: 'kolom', rij: 2 },
];

export const PI_KEYS = PI_VELDEN.map((v) => v.key);

const tekst = (w) => (w == null ? '' : String(w));

// Is dit veld in de huidige fase bewerkbaar? Alleen velden met een bestaande kolom; de rest volgt in fase 2.
export const piActief = (veld) => veld.opslag === 'kolom';

// Zonder project: de velden met een bestaande kolom. Met een project waarvan de kolom project_info bestaat (project.projectInfo is dan een object, ook
// een leeg), zijn alle 22 onderdelen bewerkbaar. Bestaat de kolom nog niet (undefined), dan blijft alles zoals het was.
export const heeftProjectInfo = (project) => Boolean(project) && project.projectInfo !== undefined && project.projectInfo !== null;

export function actieveVelden(project) {
  return heeftProjectInfo(project) ? PI_VELDEN : PI_VELDEN.filter(piActief);
}

// Leest alle Projectinformatie van een project als { key: tekst }: kolomvelden uit de bestaande projectvelden,
// jsonvelden uit project.projectInfo.velden (komt in fase 2 uit de kolom project_info; nu nog leeg).
export function leesProjectinformatie(project) {
  const p = project || {};
  const json = p.projectInfo && typeof p.projectInfo === 'object' && p.projectInfo.velden && typeof p.projectInfo.velden === 'object' ? p.projectInfo.velden : {};
  const uit = {};

  PI_VELDEN.forEach((v) => {
    uit[v.key] = v.opslag === 'kolom' ? tekst(p[v.project]) : tekst(json[v.key]);
  });

  return uit;
}

// Zet gewijzigde waarden { key: tekst } terug op een project. Raakt alleen de genoemde keys: andere velden,
// ook onbekende of nog niet getoonde jsonvelden, blijven exact zoals ze waren (geen dataverlies tussen fasen).
export function schrijfProjectinformatie(project, waarden) {
  const p = { ...(project || {}) };
  const json = { ...(p.projectInfo && p.projectInfo.velden ? p.projectInfo.velden : {}) };
  let jsonGewijzigd = false;

  Object.keys(waarden || {}).forEach((key) => {
    const v = PI_VELDEN.find((x) => x.key === key);

    if (!v) {
      return;
    }

    if (v.opslag === 'kolom') {
      p[v.project] = tekst(waarden[key]);
    } else if (tekst(waarden[key]) !== tekst(json[key])) {
      // Alleen een echte wijziging maakt project_info aan of past het aan; een ongewijzigd (leeg) veld niet.
      json[key] = tekst(waarden[key]);
      jsonGewijzigd = true;
    }
  });

  if (jsonGewijzigd) {
    p.projectInfo = { versie: PI_VERSIE, velden: json };
  }

  return p;
}

// Voortgang over de velden die nu bewerkbaar zijn: { ingevuld, totaal, perGroep: { [groep]: { ingevuld, totaal } } }.
export function voortgang(project, alleenActief = true) {
  const waarden = leesProjectinformatie(project);
  const velden = alleenActief ? actieveVelden(project) : PI_VELDEN;
  const perGroep = {};

  PI_GROEPEN.forEach((g) => {
    perGroep[g.id] = { ingevuld: 0, totaal: 0 };
  });

  let ingevuld = 0;

  velden.forEach((v) => {
    const gevuld = tekst(waarden[v.key]).trim() !== '';

    perGroep[v.groep].totaal += 1;

    if (gevuld) {
      perGroep[v.groep].ingevuld += 1;
      ingevuld += 1;
    }
  });

  return { ingevuld, totaal: velden.length, perGroep };
}

// Herkomst van een veld (project.bronnen[<projectveld>]), voor weergave naast het veld.
export const BRON_LABELS = {
  handmatig: 'ingevuld door u',
  upload: 'uit een document',
  gesprek: 'uit het gesprek',
  'gesprek-bevestigd': 'door u bevestigd in het gesprek',
  'ai-afgeleid': 'afgeleid door AI, niet bevestigd',
};

// Unieke, eerder gebruikte programmawaarden (vrije tekst met suggesties; geen beheerde lijst), alfabetisch.
export function programmaSuggesties(projecten) {
  const gezien = new Set();

  (projecten || []).forEach((p) => {
    const w = tekst(p && p.programma).trim();

    if (w) {
      gezien.add(w);
    }
  });

  return Array.from(gezien).sort((a, b) => a.localeCompare(b, 'nl'));
}

// De velden die het paneel toont, met de waarde uit het project: 22-veldenlijst (alleen actief) plus projectbrede
// instellingen. Eén lijst met { key, groep, label, hint, rij, project, waarde, bron }.
export function paneelVelden(project) {
  const waarden = leesProjectinformatie(project);
  const bronnen = (project && project.bronnen) || {};

  return actieveVelden(project).map((v) => ({ ...v, waarde: waarden[v.key], bron: bronnen[v.project || v.key] || '' }));
}

export function paneelProjectbreed(project) {
  const p = project || {};
  const bronnen = p.bronnen || {};

  return PI_PROJECTBREED.map((v) => ({ ...v, waarde: tekst(p[v.project]), bron: bronnen[v.project] || '' }));
}

// Schrijft de waarden van het paneel terug: { key: tekst } voor de 22 velden plus programma en schrijfvoorkeur.
export function schrijfPaneel(project, waarden) {
  const p = schrijfProjectinformatie(project, waarden);

  PI_PROJECTBREED.forEach((v) => {
    if (Object.prototype.hasOwnProperty.call(waarden || {}, v.key)) {
      p[v.project] = tekst(waarden[v.key]);
    }
  });

  return p;
}

// Kolom project_info (jsonb): { versie, velden: { <key>: <tekst> } }. Alleen bekende sleutels en tekst; rommel valt af.
export const MAX_PI_VELD_TEKENS = 8000;

export function leesProjectInfo(raw) {
  const velden = raw && typeof raw === 'object' && raw.velden && typeof raw.velden === 'object' ? raw.velden : {};
  const uit = {};

  PI_VELDEN.forEach((v) => {
    if (v.opslag !== 'json') return;

    const t = typeof velden[v.key] === 'string' ? velden[v.key].slice(0, MAX_PI_VELD_TEKENS) : '';

    if (t.trim() !== '') uit[v.key] = t;
  });

  return { versie: PI_VERSIE, velden: uit };
}

// Wat naar de database gaat: dezelfde schoonmaak (lege velden worden niet bewaard).
export const projectInfoVoorOpslag = (info) => leesProjectInfo(info);
