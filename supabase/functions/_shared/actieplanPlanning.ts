// Planningsmotor van het actieplan: per financier een praktisch plan (voorbereiden, indienen, opvolgen), ook als gegevens ontbreken.
// ZUIVER: geen database, geen netwerk, geen klok (vandaag wordt meegegeven).
//
// Vaste uitgangspunten (opdracht Aisya, 16-10-2026):
//   - Drie soorten datums blijven gescheiden: aanvraagdeadline (uiterste indienmoment), bestuursvergadering (beslismoment) en besluitdatum.
//     Een indiendatum wordt NOOIT uit een vergadering afgeleid, tenzij de bron zelf een voorlooptijd noemt ("4 weken voor de vergadering").
//   - Elke datum draagt zijn herkomst: 'bron' (staat zo in onze database), 'berekend' (uit een bekende deadline/termijn) of 'aanname'
//     (voorlopige planningsaanname of eigen streefdatum, GEEN datum van de financier). Een datum is nooit sterker dan zijn zwakste invoer.
//   - Voorbereiding start standaard 6 weken (42 dagen) vóór de deadline, langer bij een veeleisende aanvraag; is er minder tijd, dan wordt het
//     plan samengedrukt en gemeld als "voorbereidingstijd kort". Geen enkele actie ligt in het verleden.
//   - Opvolging: een gepubliceerde behandeltermijn (alleen als hij ondubbelzinnig te lezen is) gaat voor; ontbreekt die, dan geldt een
//     voorlopige aanname: beoordeling ±3 maanden na indienen, besluit ±2 maanden daarna. Die aanname komt er niet bij als een gepubliceerde
//     termijn het hele traject tot het besluit al dekt.
//   - Zonder betrouwbare deadline: geen verzonnen kalenderdata. Het plan begint met "Aanvraagmoment en behandeltermijn navragen".
import { isEchteDatum, navragenTitel } from './voorstelContract.js';

export type Herkomst = 'bron' | 'berekend' | 'aanname';
export type PlanModus = 'deadline' | 'doorlopend' | 'vergadering' | 'onbekend';
export type PlanFase =
  | 'navragen'
  | 'passendheid'
  | 'adviseur'
  | 'contact'
  | 'stukken'
  | 'schrijven'
  | 'review'
  | 'indienen'
  | 'ontvangst'
  | 'vragen'
  | 'beoordeling'
  | 'besluit'
  | 'vervolg';

// Wat de database over het plannen van één financier weet (alleen bij toegangsniveau 'volledig'; de server vult dit, nooit de browser).
export interface PlanningBron {
  status?: string | null; // Open / Doorlopend / Gesloten / Binnenkort / Aangekondigd / Budget uitgeput
  deadline?: string | null; // aanvraagdeadline van de eerstvolgende ronde
  deadlineOmschrijving?: string | null;
  volgendeRonde?: string | null; // sluitingsdatum van de ronde NA deadline (bekende volgende ronde)
  rondesAantal?: number | null;
  beoordelingsdatum?: string | null; // beoordelings-/besluitmoment van de ronde, als gepubliceerd
  beoordelingsperiode?: string | null;
  behandeltermijn?: string | null; // vrije tekst uit de bron
  aanvraagprocedure?: string | null;
  vergaderdatum?: string | null; // eerstvolgende bestuursvergadering, als gepubliceerd
  vergaderfrequentie?: string | null;
  vergaderToelichting?: string | null;
  bronUrl?: string | null;
  gecontroleerdOp?: string | null; // wanneer de database deze gegevens voor het laatst controleerde (YYYY-MM-DD)
  cofinanciering?: string | null;
}

export interface PlanningOpties {
  voorbereidingsDagen?: number; // standaard 42; begrensd op 14..120
  bedrag?: number | null; // gekozen aanvraagbedrag (zwaardere aanvraag = langere voorbereiding)
  beoordelingMaanden?: number; // aanname beoordeling na indienen (standaard 3)
  besluitMaanden?: number; // aanname besluit na beoordeling (standaard 2)
}

export const PLANNING_STANDAARD = {
  voorbereidingsDagen: 42,
  extraVeeleisend: 14,
  maxVoorbereidingsDagen: 120,
  minVoorbereidingsDagen: 14,
  veeleisendVanafBedrag: 50000,
  beoordelingMaanden: 3,
  besluitMaanden: 2,
  indienenVoorDeadlineDagen: 3,
} as const;

export interface PlanStap {
  titel: string;
  fase: PlanFase;
  datum: string | null;
  datumHerkomst: Herkomst | null;
  datumBron: string | null; // waar de datum vandaan komt, in gewone taal
  datumControle: string | null; // wanneer de bron voor het laatst is gecontroleerd (indien bekend)
  externeDeadline: string | null;
  prioriteit: 'high' | 'normal' | 'low';
  toelichting: string;
}

export interface PlanSamenvatting {
  modus: PlanModus;
  voorbereidingsDagen: number;
  beschikbareDagen: number | null;
  voorbereidingKort: boolean;
  deadline: string | null;
  indiendatum: string | null;
  vergaderdatum: string | null;
  besluitdatum: string | null;
  besluitHerkomst: Herkomst | null;
  behandeltermijn: { tekst: string; dagen: number; basis: 'indiening' | 'sluiting' } | null;
  behandeltermijnTekst: string | null; // zoals de bron het schrijft (ook als wij hem niet kunnen lezen)
  aannames: string[];
  waarschuwingen: string[];
}

export interface PlanUitkomst {
  stappen: PlanStap[];
  samenvatting: PlanSamenvatting;
}

// ------------------------------------------------------------------------------------------------------------------------------
// Datums

export function plusDagen(iso: string, dagen: number): string {
  const d = new Date(`${iso}T00:00:00Z`);

  d.setUTCDate(d.getUTCDate() + dagen);

  return d.toISOString().slice(0, 10);
}

export function plusMaanden(iso: string, maanden: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const dag = d.getUTCDate();

  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + maanden);

  const laatste = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();

  d.setUTCDate(Math.min(dag, laatste));

  return d.toISOString().slice(0, 10);
}

export function dagenTussen(van: string, tot: string): number {
  return Math.round((Date.parse(`${tot}T00:00:00Z`) - Date.parse(`${van}T00:00:00Z`)) / 86400000);
}

const nl = (iso: string): string => `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`;
const echt = (x: unknown): x is string => typeof x === 'string' && isEchteDatum(x);
const kort = (t: unknown, max: number): string => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const RANG: Record<Herkomst, number> = { bron: 0, berekend: 1, aanname: 2 };
const zwakste = (...h: Herkomst[]): Herkomst => h.reduce<Herkomst>((a, b) => (RANG[b] > RANG[a] ? b : a), 'bron');

// ------------------------------------------------------------------------------------------------------------------------------
// Behandeltermijn lezen. BEWUST streng: alleen als de bron precies één termijn noemt die over het besluit gaat. Alles wat dubbelzinnig is
// ("2 maanden (klein); 3-4 maanden (groot)", "reactie binnen 5 werkdagen na vooraanvraag", "enkele maanden") blijft vrije tekst en
// leidt NIET tot een berekende datum; dan geldt de voorlopige aanname en staat de brontekst erbij.
const EENHEID_DAGEN: Record<string, number> = { dag: 1, dagen: 1, werkdag: 1, werkdagen: 1, week: 7, weken: 7, maand: 30, maanden: 30 };

export function leesBehandeltermijn(tekst: unknown): { tekst: string; dagen: number; basis: 'indiening' | 'sluiting' } | null {
  const t = kort(tekst, 300);

  if (!t) return null;

  const l = t.toLowerCase();

  if (/vooraanvraag|quickscan|ontvangstbevestiging|reactie binnen|eerste reactie|reageren/.test(l)) return null;

  const treffers = [...l.matchAll(/(\d{1,3})(?:\s*(?:-|–|tot)\s*(\d{1,3}))?\s*(werkdagen|werkdag|dagen|dag|weken|week|maanden|maand)\b/g)];

  if (treffers.length !== 1) return null;

  const [, a, b, eenheid] = treffers[0];
  const hoog = Math.max(Number(a), b ? Number(b) : 0);
  const dagen = hoog * (EENHEID_DAGEN[eenheid] ?? 0);

  if (!(dagen > 0) || dagen > 400) return null;

  // Rekent de bron vanaf de sluiting van de ronde of vanaf de indiening? Zonder aanwijzing: vanaf indiening (de voorzichtige keuze).
  return { tekst: t, dagen, basis: /sluiting|deadline|sluitdatum|na de ronde|einde van de ronde/.test(l) ? 'sluiting' : 'indiening' };
}

// Noemt de bron een voorlooptijd vóór de vergadering ("aanvragen uiterlijk 4 weken voor de bestuursvergadering")? Dan mag de indiendatum
// daaruit berekend worden; zonder zo'n zin niet.
export function leesVoorlooptijdVergadering(...teksten: unknown[]): { dagen: number; tekst: string } | null {
  for (const x of teksten) {
    const t = kort(x, 800);
    const m = t.match(/(\d{1,2})\s*(werkdagen|dagen|dag|weken|week|maanden|maand)\s*(?:van tevoren\s*)?(?:v[oó]{1,2}r|voorafgaand aan)\s*(?:de\s*)?(?:bestuurs|commissie)?[- ]?vergadering/i);

    if (m) {
      const dagen = Number(m[1]) * (EENHEID_DAGEN[m[2].toLowerCase()] ?? 0);

      if (dagen > 0 && dagen <= 180) return { dagen, tekst: t.slice(Math.max(0, (m.index ?? 0) - 40), (m.index ?? 0) + m[0].length + 20).trim() };
    }
  }

  return null;
}

// Staat in de aanvraagprocedure dat contact vooraf niet gewenst/mogelijk is? Dan zetten wij geen "bel het fonds"-stap in het plan.
function contactToegestaan(tekst: unknown): boolean {
  return !/(geen|niet)\s+(telefonisch\s+|persoonlijk\s+)?(contact|bellen|mailen)|contact\s+(vooraf\s+)?(is\s+)?niet\s+(toegestaan|mogelijk|gewenst)|neem\s+geen\s+contact/i.test(String(tekst ?? ''));
}

function voorbereidingDagen(opties: PlanningOpties, planning: PlanningBron): number {
  const basis = Math.min(PLANNING_STANDAARD.maxVoorbereidingsDagen, Math.max(PLANNING_STANDAARD.minVoorbereidingsDagen, Math.round(opties.voorbereidingsDagen ?? PLANNING_STANDAARD.voorbereidingsDagen)));
  let extra = 0;

  if (typeof opties.bedrag === 'number' && opties.bedrag >= PLANNING_STANDAARD.veeleisendVanafBedrag) extra += PLANNING_STANDAARD.extraVeeleisend;
  if (/\b(cofinanciering|co-financiering|matching|eigen bijdrage verplicht|samenwerkingsverband|meerjarig)\b/i.test(`${planning.cofinanciering ?? ''} ${planning.aanvraagprocedure ?? ''}`)) extra += PLANNING_STANDAARD.extraVeeleisend;

  return Math.min(PLANNING_STANDAARD.maxVoorbereidingsDagen, basis + extra);
}

// ------------------------------------------------------------------------------------------------------------------------------

interface DatumInfo {
  datum: string | null;
  herkomst: Herkomst | null;
  bron: string | null;
}

const GEEN: DatumInfo = { datum: null, herkomst: null, bron: null };

function datumZin(d: DatumInfo): string {
  if (!d.datum || !d.herkomst) return 'Nog geen datum: die volgt zodra het aanvraagmoment bekend is.';
  if (d.herkomst === 'bron') return `Datum uit bron: ${d.bron}.`;
  if (d.herkomst === 'berekend') return `Berekend: ${d.bron}.`;

  return `Voorlopige planningsaanname, geen datum van de financier: ${d.bron}. U kunt de datum aanpassen.`;
}

export function planFinancier(naam: string, planningIn: PlanningBron | null | undefined, vandaag: string, optiesIn: PlanningOpties = {}): PlanUitkomst {
  const planning: PlanningBron = planningIn ?? {};
  const opties = optiesIn ?? {};
  const P = voorbereidingDagen(opties, planning);
  const controle = echt(planning.gecontroleerdOp) ? planning.gecontroleerdOp : null;
  const bronNaam = planning.bronUrl ? `bron: ${kort(planning.bronUrl, 120)}` : 'bron: database van Subsidiekompas';
  const bronTekst = (wat: string): string => `${wat} (${bronNaam}${controle ? `, gecontroleerd ${nl(controle)}` : ', controledatum onbekend'})`;
  const waarschuwingen: string[] = [];
  const aannames: string[] = [];
  const status = kort(planning.status, 40);
  const statusLaag = status.toLowerCase();
  const gesloten = /gesloten|budget uitgeput/.test(statusLaag);
  const vergaderdatum = echt(planning.vergaderdatum) && planning.vergaderdatum >= vandaag ? planning.vergaderdatum : null;
  const voorlooptijd = vergaderdatum ? leesVoorlooptijdVergadering(planning.aanvraagprocedure, planning.vergaderToelichting, planning.behandeltermijn) : null;
  const termijn = leesBehandeltermijn(planning.behandeltermijn) ?? leesBehandeltermijn(planning.beoordelingsperiode);
  const termijnTekst = kort(planning.behandeltermijn || planning.beoordelingsperiode, 200) || null;

  // --- Welke deadline? Alleen een toekomstige aanvraagdeadline uit de database of een uit de bron berekende voorlooptijd. ---
  let deadline: string | null = null;
  let deadlineInfo: DatumInfo = GEEN;

  if (echt(planning.deadline)) {
    if (planning.deadline >= vandaag) {
      deadline = planning.deadline;
      deadlineInfo = { datum: deadline, herkomst: 'bron', bron: bronTekst(`aanvraagdeadline ${nl(deadline)}`) };
    } else if (echt(planning.volgendeRonde) && planning.volgendeRonde >= vandaag) {
      deadline = planning.volgendeRonde;
      deadlineInfo = { datum: deadline, herkomst: 'bron', bron: bronTekst(`aanvraagdeadline ${nl(deadline)} (volgende ronde)`) };
      waarschuwingen.push(`De deadline van ${nl(planning.deadline)} is verstreken; het plan gaat uit van de volgende ronde (${nl(deadline)}).`);
    } else {
      waarschuwingen.push(`De deadline van ${nl(planning.deadline)} is verstreken en er is geen latere ronde bekend.`);
    }
  } else if (vergaderdatum && voorlooptijd) {
    const d = plusDagen(vergaderdatum, -voorlooptijd.dagen);

    if (d >= vandaag) {
      deadline = d;
      deadlineInfo = { datum: d, herkomst: 'berekend', bron: bronTekst(`bestuursvergadering ${nl(vergaderdatum)} min ${voorlooptijd.dagen} dagen voorlooptijd, volgens de bron: "${kort(voorlooptijd.tekst, 120)}"`) };
    } else {
      waarschuwingen.push(`De uiterste indiendatum voor de vergadering van ${nl(vergaderdatum)} is al verstreken.`);
    }
  }

  const doorlopend = !deadline && (/doorlopend/.test(statusLaag) || /geen vaste sluitingsdatum|doorlopend in te dienen|doorlopend aanvragen/i.test(String(planning.aanvraagprocedure ?? '')));
  const modus: PlanModus = deadline ? 'deadline' : doorlopend ? 'doorlopend' : vergaderdatum ? 'vergadering' : 'onbekend';
  const beschikbaar = deadline ? dagenTussen(vandaag, deadline) : null;
  const kortTijd = beschikbaar != null && beschikbaar < P;

  if (gesloten && !deadline) waarschuwingen.push(`De status van ${naam} is "${status}": dien pas in als de financier bevestigt dat er weer kan worden aangevraagd.`);
  if (kortTijd && beschikbaar != null) waarschuwingen.push(`Voorbereidingstijd kort: nog ${beschikbaar} dagen tot de deadline; standaard is ${P} dagen (6 weken) nodig.`);

  // --- Indiendatum (S) en startpunt van de voorbereiding (T0) ---
  let S: DatumInfo = GEEN;
  let T0: string | null = null;

  if (deadline) {
    const voor = Math.min(PLANNING_STANDAARD.indienenVoorDeadlineDagen, Math.max(0, (beschikbaar ?? 0)));
    const sd = plusDagen(deadline, -voor);

    S = { datum: sd < vandaag ? vandaag : sd, herkomst: zwakste('berekend', deadlineInfo.herkomst ?? 'bron'), bron: `${PLANNING_STANDAARD.indienenVoorDeadlineDagen} dagen vóór de ${nl(deadline)}-deadline, als buffer` };
    T0 = deadline && plusDagen(deadline, -P) > vandaag ? plusDagen(deadline, -P) : vandaag;
  } else if (modus === 'doorlopend') {
    const sd = plusDagen(vandaag, P);

    S = { datum: sd, herkomst: 'aanname', bron: `eigen streefdatum: ${P} dagen voorbereiding vanaf vandaag; de regeling is doorlopend, u kiest zelf het indienmoment` };
    T0 = vandaag;
    aannames.push(`${naam}: doorlopende regeling, indienmoment is een eigen streefdatum (${nl(sd)}).`);
  }

  // --- Opvolging: ontvangst, vragen, beoordeling, besluit, vervolg ---
  const stappen: PlanStap[] = [];
  const maak = (fase: PlanFase, titel: string, prioriteit: PlanStap['prioriteit'], tekst: string, d: DatumInfo, extern: string | null = null): void => {
    stappen.push({
      titel: kort(titel, 200),
      fase,
      datum: d.datum && d.datum < vandaag ? vandaag : d.datum,
      datumHerkomst: d.datum ? d.herkomst : null,
      datumBron: d.datum ? d.bron : null,
      datumControle: d.datum ? controle : null,
      externeDeadline: extern,
      prioriteit,
      toelichting: kort(`${tekst} ${datumZin(d)}`, 600),
    });
  };
  const eigen = (iso: string | null, herkomst: Herkomst, bron: string): DatumInfo => (iso ? { datum: iso, herkomst, bron } : GEEN);

  // Voorbereiding
  const contactOk = contactToegestaan(planning.aanvraagprocedure);
  const kortZin = kortTijd && beschikbaar != null ? `Voorbereidingstijd kort: nog ${beschikbaar} dagen tot de deadline (standaard ${P}). ` : '';

  if (modus === 'deadline' && T0 && deadline) {
    const sd = S.datum as string;
    const span = Math.max(0, dagenTussen(T0, sd));
    const op = (fractie: number): string => plusDagen(T0 as string, Math.round(span * fractie));
    const afgeleid = (iso: string, wat: string): DatumInfo => ({ datum: iso, herkomst: 'berekend', bron: `${wat}, teruggerekend vanaf ${deadlineInfo.bron}` });
    const startBron = (iso: string): DatumInfo => afgeleid(iso, kortTijd ? `start voorbereiding nu, door de korte tijd samengedrukt in ${beschikbaar} dagen` : `start ${P} dagen (6 weken) vóór de deadline`);

    maak('passendheid', `Passendheid van ${naam} beoordelen`, 'high', `${kortZin}Lees de actuele voorwaarden, doelgroep en werkgebied en noteer wat niet past of onduidelijk is.`, startBron(op(0)));
    maak('adviseur', `Subsidieadviseur raadplegen over ${naam}: go/no-go en aanpak`, 'high', 'Bespreek of de aanvraag kans maakt, hoe u haar het best opbouwt en welke stukken nodig zijn.', startBron(op(0)));

    if (contactOk) {
      maak('contact', `Contact opnemen met ${naam} (vooroverleg of contactpersoon)`, 'normal', 'Toets uw plan kort bij de financier en vraag naar de behandeltermijn en de werkwijze bij aanvullende vragen.', startBron(op(0)));
    } else {
      maak('contact', `Vragen aan ${naam} alleen via de gepubliceerde kanalen stellen`, 'low', 'De financier vraagt om geen losse contactopname vooraf; gebruik het portaal of de gepubliceerde route voor vragen.', startBron(op(0)));
    }

    maak('stukken', 'Projectstukken verzamelen (begroting, plan, samenwerkingsafspraken)', 'normal', 'Begroting, projectplan, statuten en eventuele samenwerkings- of cofinancieringsafspraken.', afgeleid(op(0.25), 'tussen start en indienen'));
    maak('schrijven', `Aanvraag bij ${naam} schrijven`, 'high', 'Schrijf de aanvraag langs de beoordelingscriteria van de financier.', afgeleid(op(0.5), 'tussen start en indienen'));
    maak('review', `Feedback op de aanvraag voor ${naam} vragen en de tekst controleren`, 'normal', 'Laat de aanvraag door een collega of adviseur lezen en controleer bedragen, bijlagen en voorwaarden.', afgeleid(op(0.8), 'kort voor indienen'));
    maak(
      'indienen',
      `Aanvraag bij ${naam} indienen`,
      'high',
      `Externe deadline van de financier: ${nl(deadline)}${planning.deadlineOmschrijving ? ` (${kort(planning.deadlineOmschrijving, 120)})` : ''}.${kortTijd && planning.volgendeRonde && echt(planning.volgendeRonde) ? ` Is dit te krap? De volgende ronde sluit op ${nl(planning.volgendeRonde)}.` : ''}`,
      S,
      deadline,
    );
  } else {
    // Zonder betrouwbare deadline begint het plan met navragen. Alleen eigen startacties krijgen een (als aanname gelabelde) datum.
    const start = eigen(plusDagen(vandaag, 7), 'aanname', 'eigen streefdatum om dit nu uit te zoeken');
    const reden =
      modus === 'doorlopend'
        ? 'Deze regeling is doorlopend, maar een behandeltermijn en eventuele aanmeldstappen (zoals een quickscan) moeten bevestigd worden.'
        : modus === 'vergadering'
          ? `Er is een bestuursvergadering op ${nl(vergaderdatum as string)}, maar niet bekend hoe lang vooraf een aanvraag binnen moet zijn.`
          : gesloten
            ? `De status is "${status}".`
            : 'Er is geen betrouwbare aanvraagdeadline bekend.';

    maak('navragen', navragenTitel(naam), 'high', `${reden} Toets met de financier of uw project past en kansrijk is, en wanneer u kunt indienen (indiendatum, vergaderdatum of indientermijn).${termijnTekst ? ` Volgens onze bron: "${termijnTekst}".` : ''}`, start);
    maak('passendheid', `Passendheid van ${naam} beoordelen`, 'high', 'Lees de actuele voorwaarden, doelgroep en werkgebied en noteer wat niet past of onduidelijk is.', start);
    maak('adviseur', `Subsidieadviseur raadplegen over ${naam}: go/no-go en aanpak`, 'high', 'Bespreek of de aanvraag kans maakt en hoe u haar het best opbouwt.', start);

    if (modus === 'doorlopend' && T0) {
      const sd = S.datum as string;
      const span = Math.max(0, dagenTussen(T0, sd));
      const op = (f: number): DatumInfo => ({ datum: plusDagen(T0 as string, Math.round(span * f)), herkomst: 'aanname', bron: S.bron });

      maak('stukken', 'Projectstukken verzamelen (begroting, plan, samenwerkingsafspraken)', 'normal', 'Begroting, projectplan, statuten en eventuele samenwerkings- of cofinancieringsafspraken.', op(0.25));
      maak('schrijven', `Aanvraag bij ${naam} schrijven`, 'high', 'Schrijf de aanvraag langs de beoordelingscriteria van de financier.', op(0.5));
      maak('review', `Feedback op de aanvraag voor ${naam} vragen en de tekst controleren`, 'normal', 'Laat de aanvraag door een collega of adviseur lezen.', op(0.8));
      maak('indienen', `Aanvraag bij ${naam} indienen`, 'high', 'Er is geen deadline: dien in als de aanvraag klaar is en de financier bevestigde dat dit past.', S);
    } else {
      maak('stukken', 'Projectstukken verzamelen (begroting, plan, samenwerkingsafspraken)', 'normal', 'Begroting, projectplan, statuten en eventuele samenwerkings- of cofinancieringsafspraken.', GEEN);
      maak('schrijven', `Aanvraag bij ${naam} schrijven`, 'high', 'Schrijf de aanvraag zodra het aanvraagmoment bekend is.', GEEN);
      maak('review', `Feedback op de aanvraag voor ${naam} vragen en de tekst controleren`, 'normal', 'Laat de aanvraag door een collega of adviseur lezen.', GEEN);
      maak('indienen', `Aanvraag bij ${naam} indienen`, 'high', 'Plan het indienmoment zodra de financier het aanvraagmoment bevestigde.', GEEN);
    }
  }

  // Opvolging
  const heeftS = Boolean(S.datum);
  const sd = S.datum;
  let besluit: DatumInfo = GEEN;
  const beoordelingBekend = echt(planning.beoordelingsdatum) && planning.beoordelingsdatum >= vandaag && (!sd || planning.beoordelingsdatum >= sd) ? planning.beoordelingsdatum : null;
  const vergaderNaIndienen = vergaderdatum && (!sd || vergaderdatum >= sd) ? vergaderdatum : null;
  const beoordelingDatum = beoordelingBekend ?? vergaderNaIndienen;
  const beoordelingInfo: DatumInfo = beoordelingBekend
    ? { datum: beoordelingBekend, herkomst: 'bron', bron: bronTekst(`beoordelingsdatum ${nl(beoordelingBekend)}`) }
    : vergaderNaIndienen
      ? { datum: vergaderNaIndienen, herkomst: 'bron', bron: bronTekst(`bestuursvergadering ${nl(vergaderNaIndienen)}`) }
      : GEEN;

  if (vergaderdatum && sd && vergaderdatum < sd) waarschuwingen.push(`De bestuursvergadering van ${nl(vergaderdatum)} valt vóór de geplande indiening en telt daarom niet mee.`);

  // Besluitdatum
  if (termijn && heeftS && sd) {
    const basis = termijn.basis === 'sluiting' && deadline ? deadline : sd;
    const bd = plusDagen(basis, termijn.dagen);
    const basisHerkomst = termijn.basis === 'sluiting' && deadline ? (deadlineInfo.herkomst ?? 'bron') : S.herkomst ?? 'aanname';
    const termijnBron = `behandeltermijn volgens de bron: "${termijn.tekst}" (${termijn.basis === 'sluiting' ? 'vanaf sluiting van de ronde' : 'vanaf indiening'}, bovengrens aangehouden; ${bronNaam}${controle ? `, gecontroleerd ${nl(controle)}` : ''})`;
    const uit = beoordelingDatum && beoordelingDatum > bd ? beoordelingInfo : { datum: bd, herkomst: zwakste('berekend', basisHerkomst), bron: termijnBron };

    besluit = uit;
  } else if (heeftS && sd) {
    // Geen leesbare termijn: voorlopige aanname. Beoordeling ±3 maanden na indienen (of het bekende beoordelingsmoment), besluit ±2 maanden later.
    const bm = opties.beoordelingMaanden ?? PLANNING_STANDAARD.beoordelingMaanden;
    const dm = opties.besluitMaanden ?? PLANNING_STANDAARD.besluitMaanden;
    const beoordeling = beoordelingDatum ?? plusMaanden(sd, bm);
    const bd = plusMaanden(beoordeling, dm);

    besluit = { datum: bd, herkomst: 'aanname', bron: `${beoordelingDatum ? `beoordelingsmoment ${nl(beoordeling)} uit de bron` : `beoordeling ±${bm} maanden na indienen`} en besluit ±${dm} maanden daarna; er is geen gepubliceerde behandeltermijn gevonden${termijnTekst ? ` (de bron zegt: "${termijnTekst}", dat is niet eenduidig te lezen)` : ''}` };
    aannames.push(`${naam}: besluit ±${bm + dm} maanden na indienen is een voorlopige planningsaanname, geen termijn van de financier.`);
  }

  const onbepaald = !heeftS;
  const na = (d: string | null, n: number): string | null => (d ? plusDagen(d, n) : null);

  maak('ontvangst', `Ontvangstbevestiging van ${naam} controleren`, 'normal', 'Controleer of de aanvraag is ontvangen en volledig is bevonden; vraag het na als u niets hoort.', eigen(na(sd, 5), sd ? zwakste('berekend', S.herkomst ?? 'berekend') : 'aanname', 'vijf dagen na de geplande indiening'));
  maak('vragen', `Aanvullende vragen van ${naam} beantwoorden`, 'normal', 'Houd uw mailbox en het portaal in de gaten en antwoord binnen de gevraagde termijn.', eigen(na(sd, 14), 'aanname', 'twee weken na de geplande indiening als eigen controlemoment'));

  if (beoordelingDatum && beoordelingInfo.datum) {
    maak('beoordeling', `Beoordelings- of vergadermoment van ${naam} volgen`, 'normal', modus === 'vergadering' ? 'Alleen relevant als de aanvraag ruim voor deze vergadering binnen is; vraag na hoe lang vooraf dat moet.' : 'Volg de beoordeling en reageer op eventuele vragen.', beoordelingInfo);
  } else if (!termijn && heeftS && sd) {
    const bm = opties.beoordelingMaanden ?? PLANNING_STANDAARD.beoordelingMaanden;

    maak('beoordeling', `Beoordelingsmoment van ${naam} navragen en volgen`, 'normal', 'Vraag na wanneer de beoordeling plaatsvindt en volg de voortgang.', eigen(plusMaanden(sd, bm), 'aanname', `±${bm} maanden na de geplande indiening`));
  } else if (onbepaald) {
    maak('beoordeling', `Beoordelings- of vergadermoment van ${naam} volgen`, 'normal', 'Volg het beoordelingsmoment zodra het bekend is.', GEEN);
  }

  maak('besluit', `Verwachte beslissing van ${naam} volgen`, 'normal', termijn && besluit.datum ? 'Volg de beslissing op basis van de gepubliceerde behandeltermijn.' : 'De verwachte beslisdatum is een inschatting; pas hem aan zodra de financier een termijn noemt.', besluit);
  maak('vervolg', `Vervolgstappen na de beslissing van ${naam} bepalen`, 'low', 'Bij toekenning: voorwaarden, uitbetaling en rapportage regelen. Bij afwijzing: om feedback vragen en een alternatief kiezen.', eigen(na(besluit.datum, 7), besluit.datum ? zwakste('berekend', besluit.herkomst ?? 'aanname') : 'aanname', 'een week na de verwachte beslissing'));

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
      waarschuwingen,
    },
  };
}
