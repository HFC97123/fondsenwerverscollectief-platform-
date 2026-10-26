// Verwerking van een verzoek aan de Edge Function `aanvraag-assistent`. Alle toegang tot de buitenwereld (database, OpenAI, websites, klok) komt via `deps`
// binnen, zodat dit bestand zonder netwerk en zonder database te testen is. De Edge Function (aanvraag-assistent/index.ts) maakt de echte `deps`.
//
// Regels die hier gelden:
//   - De server bepaalt de gebruiker en het abonnement (uit het token en het profiel), nooit de client.
//   - Standaard AAN voor Pro en Premium. Alleen met AANVRAAG_ASSISTENT=uit is de functie voor iedereen uit (noodrem; er is geen testersfase).
//   - Free heeft geen toegang. Pro en Premium krijgen de grenzen uit tierConfig.ts (aanvraagAssistent).
//   - Kan een maandtelling niet worden gelezen, dan weigert de server (fail closed): een grens die niet te controleren is, is geen grens.
//   - Het algemene projectplan wordt één keer per project geschreven (deps.planReserveer); het aantal projecten per rollend jaar hangt af van het abonnement.
//     Het plan wordt pas geschreven als de projectinformatie volledig is (voortgangsmeter, planGereedheid). Teksten voor een fonds tellen bij de beoordelingen.
//   - De maandgrens is atomair: vlak vóór de AI-aanroep reserveert de server een plek (deps.reserveer, één database-stap met een slot per gebruiker) en rondt die
//     daarna af (deps.rondAf). Zo komen twee gelijktijdige verzoeken er niet allebei door, en een mislukte aanroep telt niet mee. De teller hangt aan het account.
//   - Een beoordeling zonder één geldig oordeel (modelstoring) wordt niet opgeslagen en telt niet mee voor de maandgrens.
//   - De tekst die het lid ter beoordeling aanbiedt, wordt niet bewaard of gelogd. Opgeslagen wordt de uitkomst: eisen, status per eis, korte citaten en verbeteringen.
//   - Uitzondering (Aisya, 26-10-2026): de versies die het lid zelf bewaart (concept of definitief) worden bewaard in subsidie_kompas_aanvraag_versies. Alleen het lid zelf
//     leest ze; ze verdwijnen met de aanvraag, het project of het account. Opslaan en versiebeheer kosten geen maandruimte; maximaal 20 versies per aanvraag.
//   - Het aanvraagformulier (Word, PDF of geplakt) wordt nooit bewaard: alleen de vragen met hun tekenlimiet en de lijst met stukken. Zonder tekenlimiet per vraag (of de
//     keuze "dit fonds heeft geen limiet") bevestigt de server de lijst niet en schrijft hij geen antwoorden. Alle antwoorden voor één fonds tellen samen als één beoordeling
//     van de maand; opnieuw schrijven binnen dat fonds in dezelfde maand kost niets extra (met een bovengrens).
import {
  beoordeelAanvraag,
  berekenUitkomst,
  controleerInvoer,
  eisenBronLabel,
  eisenlijstBeperkt,
  haalEisenOp,
  maandRuimte,
  maandStartIso,
  schoneClientEisen,
  UITKOMST_TEKST,
  wijstOpInlog,
  type BronTekst,
  type EisenBronLabel,
  type ModelAanroep,
} from './aanvraagAssistent.ts';
import { maakBegrotingVoorstel, MAX_TEKENS_VOORSTEL } from './begrotingVoorstel.ts';
import { sluitNaToevoegen } from './begrotingSluit.ts';
import { leesBegrotingUpload, MAX_TEKENS_UPLOAD, MIN_TEKENS_UPLOAD } from './begrotingUpload.ts';
import {
  bouwVragenBericht,
  leesVragen,
  maandSleutel,
  MAX_FORMULIER_TEKENS,
  MAX_HERSCHRIJVEN_PER_MAAND,
  MAX_VRAGEN,
  normaliseer,
  schoneStukken,
  schoneVragen,
  sectiesUitVragen,
  standaardStukken,
  VRAGEN_SYSTEEM,
  type Stuk,
  type VragenLijst,
  type VragenUitkomst,
} from './aanvraagVragen.ts';
import { tierConfigVoor } from './tierConfig.ts';
import { bouwFeiten, fondsSleutel, MIN_FEITEN, planGereedheid, schrijfPlan, sectiesUitCriteria, STANDAARD_SECTIES, type PlanBron } from './projectplan.ts';

export const MAX_BODY_TEKENS = 600_000;
export const MAX_PAGINAS = 2;
export const MAX_FONDSLABEL = 200;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Modus = 'status' | 'eisen-ophalen' | 'criteria-bewaren' | 'beoordelen' | 'plan-schrijven' | 'plan-gereedheid' | 'aanvragen' | 'aanvraag' | 'begroting-voorstel' | 'begroting-upload' | 'versies' | 'versie' | 'versie-bewaren' | 'versie-wijzigen' | 'versie-verwijderen' | 'vragen' | 'vragen-lezen' | 'vragen-bewaren' | 'antwoorden-schrijven';

const MODI: readonly Modus[] = ['status', 'eisen-ophalen', 'criteria-bewaren', 'beoordelen', 'plan-schrijven', 'plan-gereedheid', 'aanvragen', 'aanvraag', 'begroting-voorstel', 'begroting-upload', 'versies', 'versie', 'versie-bewaren', 'versie-wijzigen', 'versie-verwijderen', 'vragen', 'vragen-lezen', 'vragen-bewaren', 'antwoorden-schrijven'];

// Het algemene projectplan telt per rollend jaar (aantal verschillende projecten); een verwijderd project geeft zijn plek niet terug.
export const PLAN_VENSTER_MAANDEN = 12;

export function planStartIso(nu: Date): string {
  const d = new Date(nu.getTime());

  d.setUTCMonth(d.getUTCMonth() - PLAN_VENSTER_MAANDEN);

  return d.toISOString();
}

// Eén aanvraag = alles wat bij één fonds (of het algemene plan) van één project hoort: criteria, plan en laatste uitkomst.
export interface AanvraagRij {
  id: string;
  program_id: string;
  soort: 'algemeen' | 'fonds';
  fonds_label: string;
  criteria: unknown[];
  criteria_bron: string | null;
  bronnen: unknown[];
  plan: unknown | null;
  plan_bijgewerkt_op: string | null;
  laatste_beoordeling_id: string | null;
  laatste_uitkomst: string | null;
  created_at: string;
  updated_at: string;
}

// Wat de server schrijft. Alleen de meegegeven velden worden gewijzigd (de rest blijft staan); sleutel = (project, soort, fonds_sleutel).
export interface AanvraagSchrijf {
  user_id: string;
  program_id: string;
  soort: 'algemeen' | 'fonds';
  fonds_label: string;
  fonds_sleutel: string;
  criteria?: unknown[];
  criteria_bron?: string | null;
  bronnen?: unknown[];
  plan?: unknown;
  plan_bijgewerkt_op?: string;
  laatste_beoordeling_id?: string | null;
  laatste_uitkomst?: string | null;
}

// Een bewaarde versie van het plan of van de antwoorden van het lid. antwoorden = lijst van onderdelen { id, titel, tekst }.
export interface VersieRij {
  id: string;
  aanvraag_id: string;
  nummer: number;
  naam: string;
  status: 'concept' | 'definitief';
  herkomst: 'ai' | 'lid';
  antwoorden?: unknown[]; // ontbreekt in de lijst (die is licht)
  beoordeling_id: string | null;
  created_at: string;
  updated_at: string;
}

// De stand van een aanvraag voor het versiebeheer.
export interface VersieStand {
  id: string;
  soort: 'algemeen' | 'fonds';
  status: 'concept' | 'definitief';
  definitieve_versie_id: string | null;
}

// De vragen van het formulier en de lijst met stukken (checklist) van één aanvraag, plus de teller waarmee "alle antwoorden voor één fonds = één beoordeling" werkt.
export interface VragenStand {
  id: string;
  program_id: string;
  soort: 'algemeen' | 'fonds';
  fonds_label: string;
  criteria: unknown[];
  vragen: VragenLijst | null;
  stukken: Stuk[] | null;
  schrijf_maand: string | null; // 'JJJJ-MM' van de maand waarin dit fonds al als beoordeling is meegeteld
  schrijf_aantal: number; // aantal antwoorden dat in die maand al is geschreven
}

export const MAX_VERSIES = 20;
export const MAX_ONDERDELEN = 60;
export const MAX_ONDERDEEL_TEKENS = 20_000;
export const MAX_TOTAAL_TEKENS = 50_000;
export const MAX_VERSIENAAM = 120;
const ONDERDEEL_ID_RE = /^[A-Za-z0-9_.-]{1,80}$/;

export interface Onderdeel {
  id: string | null;
  titel: string;
  tekst: string;
}

// Maakt van wat de client stuurt een veilige lijst onderdelen. Geen geldige lijst = null.
export function schoneOnderdelen(invoer: unknown, maxTotaal: number = MAX_TOTAAL_TEKENS): Onderdeel[] | null {
  if (!Array.isArray(invoer) || invoer.length < 1 || invoer.length > MAX_ONDERDELEN) return null;

  const uit: Onderdeel[] = [];
  const gezien = new Set<string>();
  let totaal = 0;

  for (const item of invoer) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;

    const ruwId = (item as any).id;
    const id = ruwId === null || ruwId === undefined || ruwId === '' ? null : typeof ruwId === 'string' && ONDERDEEL_ID_RE.test(ruwId) ? ruwId : undefined;

    if (id === undefined) return null;
    if (id !== null) {
      if (gezien.has(id)) return null;
      gezien.add(id);
    }

    const titel = tekstVeld((item as any).titel, 300).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
    const tekstRuw = (item as any).tekst;

    if (typeof tekstRuw !== 'string' || tekstRuw.length > MAX_ONDERDEEL_TEKENS) return null;

    const tekst = tekstVeld(tekstRuw, MAX_ONDERDEEL_TEKENS).replace(/\r\n?/g, '\n');

    totaal += tekst.length + titel.length;

    if (totaal > maxTotaal) return null;

    uit.push({ id, titel, tekst });
  }

  return uit;
}

const heeftInhoud = (o: Onderdeel[]) => o.some((x) => x.tekst.trim().length > 0);

export interface ProfielRij {
  subscription_tier?: unknown;
  subscription_active?: unknown;
  trial_ends_at?: unknown;
  role?: unknown;
}

export interface GebruikMelding {
  userId: string;
  tier: string;
  actie: 'aanvraag_eisen' | 'aanvraag_beoordeling' | 'aanvraag_plan' | 'aanvraag_begroting' | 'aanvraag_vragen' | 'aanvraag_antwoorden';
  projectId?: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  externePaginas?: number;
  duurMs: number;
  succes: boolean;
}

export interface BeoordelingRij {
  user_id: string;
  program_id: string;
  fonds_label: string;
  eisen_bron: EisenBronLabel;
  eisen: unknown;
  resultaat: unknown;
  uitkomst: string;
  statistiek: unknown;
  model: string;
  tokens_in: number;
  tokens_uit: number;
}

export type Verbruikssoort = 'beoordelingen' | 'eisen' | 'plannen';

export type Reservering = { ok: true; id: string; gebruikt: number } | { ok: false; reden: 'maand-op' | 'te-veel-mislukt' | 'storing'; gebruikt?: number };

export type PlanReservering = { ok: true; id: string; gebruikt: number } | { ok: false; reden: 'al-geschreven' | 'plan-limiet' | 'te-veel-mislukt' | 'storing'; gebruikt?: number };

export interface PlanStand {
  gebruikt: number; // verschillende projecten met een geschreven plan in het rollende jaar
  projectKlaar: boolean; // is het plan van dit project al geschreven?
}

export type PaginaUitkomst = { ok: true; tekst: string } | { ok: false; reden: 'niet-bereikbaar' | 'niet-toegestaan' | 'niet-leesbaar' };

export interface HandlerDeps {
  modelNaam: string;
  nu(): Date;
  vlagAan(userId: string): boolean;
  userUitToken(token: string): Promise<{ id: string } | null>;
  leesProfiel(userId: string): Promise<{ profiel: ProfielRij | null; storing: boolean }>;
  rateLimitOk(userId: string): Promise<boolean>; // fail-open hoort in de implementatie: misbruikbeveiliging breekt nooit een gewoon verzoek
  projectIsVanGebruiker(projectId: string, userId: string): Promise<boolean | null>; // null = storing
  telRijen(userId: string, soort: Verbruikssoort, sindsIso: string): Promise<number | null>; // null = niet te lezen
  reserveer(userId: string, soort: Verbruikssoort, limiet: number, sindsIso: string): Promise<Reservering>; // atomair: controleert de maandgrens en reserveert in één stap
  planStand(userId: string, projectId: string | null, sindsIso: string): Promise<PlanStand | null>; // null = niet te lezen
  planReserveer(userId: string, projectId: string, limiet: number, sindsIso: string): Promise<PlanReservering>; // atomair: één keer per project en een grens op het aantal projecten
  rondAf(reserveringId: string, userId: string, succes: boolean): Promise<void>; // gelukt = telt mee, mislukt = telt niet mee; gooit nooit
  lijstAanvragen(userId: string, projectId: string): Promise<AanvraagRij[] | null>; // null = storing
  leesAanvraag(userId: string, id: string): Promise<AanvraagRij | null | 'storing'>; // null = niet gevonden (of van iemand anders)
  bewaarAanvraag(rij: AanvraagSchrijf): Promise<string | null>; // id, of null bij mislukken
  leesPlanBron(userId: string, projectId: string, token?: string): Promise<PlanBron | null>; // null = niet te lezen
  // De begroting die er al staat, de eigen bijdrage en het dekkingsplan zoals het lid het ziet (zelfde functie als het scherm). null = niet te lezen: dan blijft de sluitcontrole weg.
  leesBegrotingStand?(userId: string, projectId: string, token: string): Promise<{ regels: unknown; eigenBijdrage: unknown; financiering: unknown[] | null } | null>;
  slaBeoordelingOp(rij: BeoordelingRij): Promise<string | null>; // id van de nieuwe rij, of null bij mislukken
  // Versiebeheer (alleen gefilterd op de gebruiker uit het token). Optioneel: ontbreekt een functie, dan antwoordt de server dat versies tijdelijk niet beschikbaar zijn.
  leesVersieStand?(userId: string, aanvraagId: string): Promise<VersieStand | null | 'storing'>; // null = niet gevonden (of van iemand anders)
  lijstVersies?(userId: string, aanvraagId: string): Promise<VersieRij[] | null>; // zonder antwoorden; nieuwste eerst; null = storing
  leesVersie?(userId: string, versieId: string): Promise<VersieRij | null | 'storing'>;
  maakVersie?(rij: { user_id: string; aanvraag_id: string; naam: string; status: 'concept' | 'definitief'; herkomst: 'ai' | 'lid'; antwoorden: Onderdeel[] }): Promise<VersieRij | null>; // kent het volgende nummer toe; null bij mislukken
  werkVersieBij?(userId: string, versieId: string, velden: { naam?: string; antwoorden?: Onderdeel[]; status?: 'concept' | 'definitief' }): Promise<boolean>;
  verwijderVersie?(userId: string, versieId: string): Promise<boolean>;
  zetAanvraagStatus?(userId: string, aanvraagId: string, velden: { status: 'concept' | 'definitief'; definitieve_versie_id?: string | null }): Promise<boolean>;
  // Formulier: vragen en stukken. Optioneel: ontbreekt een functie, dan antwoordt de server dat het tijdelijk niet beschikbaar is.
  leesVragenStand?(userId: string, aanvraagId: string): Promise<VragenStand | null | 'storing'>; // null = niet gevonden (of van iemand anders)
  bewaarVragenStukken?(userId: string, aanvraagId: string, velden: { vragen?: VragenLijst; stukken?: Stuk[]; schrijf_maand?: string; schrijf_aantal?: number }): Promise<boolean>;
  lijstVoortgang?(userId: string, aanvraagIds: string[]): Promise<Record<string, AanvraagVoortgang> | null>; // null = niet te lezen (bijvoorbeeld de migratie is er nog niet): dan blijft de kaart zoals voorheen
  haalPagina(url: string): Promise<PaginaUitkomst>;
  roep: ModelAanroep;
  meldGebruik(melding: GebruikMelding): Promise<void>; // gooit nooit
}

export interface HandlerVerzoek {
  method: string;
  authorization: string;
  bodyText: string;
}

export interface HandlerAntwoord {
  status: number;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
}

const fout = (status: number, reden: string, error: string, extra: Record<string, unknown> = {}): HandlerAntwoord => ({ status, body: { ok: false, reden, error, ...extra } });

// Antwoord als reserveren niet lukt om een andere reden dan een volle maand (die heeft per onderdeel eigen tekst).
const reserveerWeigering = (reden: 'te-veel-mislukt' | 'storing'): HandlerAntwoord =>
  reden === 'te-veel-mislukt'
    ? { status: 429, body: { ok: false, reden: 'te-veel-mislukt', error: 'Er zijn kort achter elkaar meerdere pogingen mislukt. Probeer het over een uur opnieuw of neem contact op met Het Fondsenwervers Collectief.' }, headers: { 'Retry-After': '3600' } }
    : fout(503, 'telling', 'De aanvraag-assistent is tijdelijk niet beschikbaar. Probeer het later opnieuw.');

// Zelfde regel als effectieveTier() in subsidie-kompas/index.ts (actief abonnement of lopende proefperiode, anders Free).
export function effectieveTier(profiel: ProfielRij | null | undefined, nu: Date): 'free' | 'pro' | 'premium' {
  const ruw = profiel?.subscription_tier;

  if (ruw !== 'pro' && ruw !== 'premium') return 'free';
  if (profiel?.subscription_active === true) return ruw;

  const eind = typeof profiel?.trial_ends_at === 'string' ? Date.parse(profiel.trial_ends_at) : NaN;

  return Number.isFinite(eind) && eind > nu.getTime() ? ruw : 'free';
}

// Vlag: standaard AAN (voor iedereen die ingelogd is; wie mag gebruiken bepaalt het abonnement). Alleen AANVRAAG_ASSISTENT=uit zet de functie uit (noodrem).
export function aanvraagVlagAan(vlag: string | undefined | null, gebruikerId: string | null | undefined): boolean {
  if (typeof gebruikerId !== 'string' || !UUID_RE.test(gebruikerId)) return false;

  const waarde = typeof vlag === 'string' ? vlag.trim().replace(/^["']+|["']+$/g, '').trim().toLowerCase() : '';

  return waarde !== 'uit';
}

const tekstVeld = (x: unknown, max: number): string => (typeof x === 'string' ? x.replace(/\u0000/g, '').slice(0, max) : '');

// Wat de lijst met aanvragen laat zien: geen inhoud van criteria of plan, alleen waar het lid aan toe is.
// Hoever een aanvraag per vraag is: voor de kaart per fonds in Indienen. Alleen tellingen en de lijst met stukken, nooit de teksten van de antwoorden.
export interface AanvraagVoortgang {
  status: 'concept' | 'definitief';
  aantalVragen: number;
  vragenBevestigd: boolean;
  aantalAntwoorden: number; // vragen met een antwoord in de nieuwste versie
  stukken: Stuk[];
}

export function samenvatAanvraag(r: AanvraagRij) {
  const plan = r.plan && typeof r.plan === 'object' ? (r.plan as any) : null;

  return {
    id: r.id,
    projectId: r.program_id,
    soort: r.soort,
    fondsLabel: r.fonds_label,
    aantalCriteria: Array.isArray(r.criteria) ? r.criteria.length : 0,
    criteriaBron: r.criteria_bron,
    heeftPlan: Boolean(plan && Array.isArray(plan.secties) && plan.secties.length),
    planBijgewerkt: r.plan_bijgewerkt_op,
    laatsteBeoordelingId: r.laatste_beoordeling_id,
    laatsteUitkomst: r.laatste_uitkomst,
    aangemaakt: r.created_at,
    bijgewerkt: r.updated_at,
  };
}

export async function verwerk(verzoek: HandlerVerzoek, deps: HandlerDeps): Promise<HandlerAntwoord> {
  const start = Date.now();

  if (verzoek.method !== 'POST') return fout(405, 'methode', 'Ongeldige aanvraag.');

  // 1. Wie vraagt dit?
  const token = verzoek.authorization.startsWith('Bearer ') ? verzoek.authorization.slice(7).trim() : '';
  const user = token ? await deps.userUitToken(token) : null;

  if (!user?.id || !UUID_RE.test(user.id)) return fout(401, 'inloggen', 'Log in om de aanvraag-assistent te gebruiken.');

  const userId = user.id.toLowerCase();

  // 2. Vlag: standaard uit. Een onbeschikbare functie verraadt niets over het abonnement.
  if (!deps.vlagAan(userId)) return fout(404, 'niet-beschikbaar', 'Deze functie is nog niet beschikbaar.');

  // 3. Abonnement, uitsluitend uit het profiel.
  const { profiel, storing } = await deps.leesProfiel(userId);

  if (!profiel) return fout(storing ? 503 : 403, 'profiel', 'Uw account is niet volledig ingericht. Probeer het later opnieuw of neem contact op met Het Fondsenwervers Collectief.');

  const isAdmin = profiel.role === 'admin';
  const tier = effectieveTier(profiel, deps.nu());
  const config = tierConfigVoor(tier, isAdmin).aanvraagAssistent;

  if (!config) return fout(403, 'geen-toegang', 'De aanvraag-assistent is er voor Pro en Premium.');

  // 4. Verzoek lezen.
  if (verzoek.bodyText.length > MAX_BODY_TEKENS) return fout(413, 'te-groot', 'Het verzoek is te groot.');

  let body: any;

  try {
    body = JSON.parse(verzoek.bodyText);
  } catch (_e) {
    return fout(400, 'ongeldig', 'Ongeldige aanvraag.');
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) return fout(400, 'ongeldig', 'Ongeldige aanvraag.');

  const modus = body.mode as Modus;

  if (!MODI.includes(modus)) return fout(400, 'ongeldig', 'Ongeldige aanvraag.');

  // 5. Misbruikbeveiliging.
  if (!(await deps.rateLimitOk(userId))) return { status: 429, body: { ok: false, reden: 'te-snel', error: 'U verstuurt te veel verzoeken kort achter elkaar. Wacht even en probeer het opnieuw.' }, headers: { 'Retry-After': '60' } };

  const sinds = maandStartIso(deps.nu());
  const tierLabel = isAdmin ? 'admin' : tier;

  // ── status ────────────────────────────────────────────────────────────────────────────────────────────────
  if (modus === 'status') {
    const [beoordelingen, eisen, planStand] = await Promise.all([deps.telRijen(userId, 'beoordelingen', sinds), deps.telRijen(userId, 'eisen', sinds), deps.planStand(userId, null, planStartIso(deps.nu()))]);

    return {
      status: 200,
      body: {
        ok: true,
        tier: tierLabel,
        beoordelingen: { limiet: config.beoordelingenPerMaand, gebruikt: beoordelingen, resterend: beoordelingen === null ? null : maandRuimte(config, 'beoordeling', beoordelingen).resterend },
        plannen: { limiet: config.projectplannen, gebruikt: planStand === null ? null : planStand.gebruikt, resterend: planStand === null ? null : maandRuimte(config, 'plan', planStand.gebruikt).resterend, periodeMaanden: PLAN_VENSTER_MAANDEN },
        criteriaOphalen: { limiet: config.eisenOphalenPerMaand, gebruikt: eisen },
        maxEisen: config.maxEisen,
        maxAanvraagTekens: config.maxAanvraagTekens,
        uitbreidingen: { rijkeEditor: config.rijkeEditor, aiPaneel: config.aiPaneel, dekkingsoverzicht: config.dekkingsoverzicht, commissieblik: config.commissieblik },
      },
    };
  }

  // ── aanvragen (lijst per project) en aanvraag (één) ──────────────────────────────────────────────────────
  if (modus === 'aanvragen') {
    const pid = typeof body.projectId === 'string' && UUID_RE.test(body.projectId) ? body.projectId.toLowerCase() : '';

    if (!pid) return fout(400, 'ongeldig', 'Ongeldige aanvraag.');

    const check = await deps.projectIsVanGebruiker(pid, userId);

    if (check === null) return fout(503, 'project', 'De aanvraag-assistent is tijdelijk niet beschikbaar. Probeer het later opnieuw.');
    if (check !== true) return fout(404, 'project', 'Dit project is niet gevonden.');

    const rijen = await deps.lijstAanvragen(userId, pid);

    if (rijen === null) return fout(503, 'opslag', 'De aanvragen konden nu niet worden opgehaald. Probeer het later opnieuw.');

    // Per aanvraag hoever het lid is (vragenlijst, antwoorden, stukken). Lukt dat niet, dan krijgt het lid de lijst zonder voortgang.
    const voortgang = deps.lijstVoortgang && rijen.length ? await deps.lijstVoortgang(userId, rijen.map((r) => r.id)).catch(() => null) : null;

    return { status: 200, body: { ok: true, aanvragen: rijen.map((r) => ({ ...samenvatAanvraag(r), ...(voortgang && voortgang[r.id] ? { voortgang: voortgang[r.id] } : {}) })) } };
  }

  if (modus === 'aanvraag') {
    const id = typeof body.aanvraagId === 'string' && UUID_RE.test(body.aanvraagId) ? body.aanvraagId.toLowerCase() : '';

    if (!id) return fout(400, 'ongeldig', 'Ongeldige aanvraag.');

    const rij = await deps.leesAanvraag(userId, id);

    if (rij === 'storing') return fout(503, 'opslag', 'De aanvraag kon nu niet worden opgehaald. Probeer het later opnieuw.');
    if (!rij) return fout(404, 'aanvraag', 'Deze aanvraag is niet gevonden.');

    return { status: 200, body: { ok: true, aanvraag: { ...samenvatAanvraag(rij), criteria: rij.criteria, bronnen: rij.bronnen, plan: rij.plan } } };
  }

  // ── criteria-bewaren (het lid heeft de lijst aangepast) ──────────────────────────────────────────────────
  if (modus === 'criteria-bewaren') {
    const id = typeof body.aanvraagId === 'string' && UUID_RE.test(body.aanvraagId) ? body.aanvraagId.toLowerCase() : '';

    if (!id) return fout(400, 'ongeldig', 'Ongeldige aanvraag.');

    const rij = await deps.leesAanvraag(userId, id);

    if (rij === 'storing') return fout(503, 'opslag', 'De criteria konden nu niet worden bewaard. Probeer het later opnieuw.');
    if (!rij || rij.soort !== 'fonds') return fout(404, 'aanvraag', 'Deze aanvraag is niet gevonden.');

    const { eisen: schoon } = schoneClientEisen(body.criteria, config.maxEisen);
    const bewaard = await deps.bewaarAanvraag({
      user_id: userId,
      program_id: rij.program_id,
      soort: 'fonds',
      fonds_label: rij.fonds_label,
      fonds_sleutel: fondsSleutel(rij.fonds_label),
      criteria: schoon,
      criteria_bron: eisenBronLabel(schoon),
    });

    if (!bewaard) return fout(503, 'opslag', 'De criteria konden nu niet worden bewaard. Probeer het later opnieuw.');

    return { status: 200, body: { ok: true, aanvraagId: bewaard, criteria: schoon } };
  }

  // ── versies: bewaren, ophalen, definitief maken, verwijderen (geen maandruimte) ────────────────────────────
  if (modus === 'versies' || modus === 'versie' || modus === 'versie-bewaren' || modus === 'versie-wijzigen' || modus === 'versie-verwijderen') {
    if (!deps.leesVersieStand || !deps.lijstVersies || !deps.leesVersie || !deps.maakVersie || !deps.werkVersieBij || !deps.verwijderVersie || !deps.zetAanvraagStatus) {
      return fout(503, 'versies', 'Versies zijn tijdelijk niet beschikbaar. Probeer het later opnieuw.');
    }

    const NIET_BESCHIKBAAR = fout(503, 'opslag', 'De versies zijn nu niet beschikbaar. Probeer het later opnieuw.');
    const samenvatVersie = (v: VersieRij) => ({ id: v.id, aanvraagId: v.aanvraag_id, nummer: v.nummer, naam: v.naam, status: v.status, herkomst: v.herkomst, heeftBeoordeling: Boolean(v.beoordeling_id), gemaakt: v.created_at, bijgewerkt: v.updated_at });
    const idVan = (x: unknown) => (typeof x === 'string' && UUID_RE.test(x) ? x.toLowerCase() : '');

    // Alles wat per versie gebeurt, begint bij de versie en de aanvraag waar hij bij hoort.
    const laadVersie = async (versieId: string) => {
      const versie = await deps.leesVersie!(userId, versieId);

      if (versie === 'storing') return { antwoord: NIET_BESCHIKBAAR } as const;
      if (!versie) return { antwoord: fout(404, 'versie', 'Deze versie is niet gevonden.') } as const;

      const stand = await deps.leesVersieStand!(userId, versie.aanvraag_id);

      if (stand === 'storing') return { antwoord: NIET_BESCHIKBAAR } as const;
      if (!stand) return { antwoord: fout(404, 'versie', 'Deze versie is niet gevonden.') } as const;

      return { versie, stand } as const;
    };

    if (modus === 'versies') {
      const aanvraagId = idVan(body.aanvraagId);

      if (!aanvraagId) return fout(400, 'ongeldig', 'Ongeldige aanvraag.');

      const stand = await deps.leesVersieStand(userId, aanvraagId);

      if (stand === 'storing') return NIET_BESCHIKBAAR;
      if (!stand) return fout(404, 'aanvraag', 'Deze aanvraag is niet gevonden.');

      const lijst = await deps.lijstVersies(userId, aanvraagId);

      if (lijst === null) return NIET_BESCHIKBAAR;

      return { status: 200, body: { ok: true, aanvraagId, aanvraagStatus: stand.status, definitieveVersieId: stand.definitieve_versie_id, maxVersies: MAX_VERSIES, versies: lijst.map(samenvatVersie) } };
    }

    if (modus === 'versie') {
      const versieId = idVan(body.versieId);

      if (!versieId) return fout(400, 'ongeldig', 'Ongeldige aanvraag.');

      const g = await laadVersie(versieId);

      if ('antwoord' in g) return g.antwoord;

      return { status: 200, body: { ok: true, versie: { ...samenvatVersie(g.versie), antwoorden: Array.isArray(g.versie.antwoorden) ? g.versie.antwoorden : [] }, aanvraagStatus: g.stand.status, definitieveVersieId: g.stand.definitieve_versie_id } };
    }

    if (modus === 'versie-bewaren') {
      const aanvraagId = idVan(body.aanvraagId);
      const versieId = body.versieId === undefined || body.versieId === null || body.versieId === '' ? '' : idVan(body.versieId);

      if (!aanvraagId || (body.versieId && !versieId)) return fout(400, 'ongeldig', 'Ongeldige aanvraag.');

      const onderdelen = schoneOnderdelen(body.antwoorden, Math.min(config.maxAanvraagTekens, MAX_TOTAAL_TEKENS));

      if (!onderdelen) return fout(400, 'ongeldig-antwoorden', 'De tekst kon niet worden bewaard: te veel of te lange onderdelen.');

      const naam = tekstVeld(body.naam, MAX_VERSIENAAM).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
      const stand = await deps.leesVersieStand(userId, aanvraagId);

      if (stand === 'storing') return NIET_BESCHIKBAAR;
      if (!stand) return fout(404, 'aanvraag', 'Deze aanvraag is niet gevonden.');

      let basis: VersieRij | null = null;

      if (versieId) {
        const v = await deps.leesVersie(userId, versieId);

        if (v === 'storing') return NIET_BESCHIKBAAR;
        if (!v || v.aanvraag_id !== aanvraagId) return fout(404, 'versie', 'Deze versie is niet gevonden.');

        basis = v;
      }

      // Een concept wordt op zijn plaats bijgewerkt; een definitieve versie blijft zoals hij is en er komt een nieuw concept naast.
      if (basis && basis.status === 'concept') {
        const gelukt = await deps.werkVersieBij(userId, basis.id, { antwoorden: onderdelen, ...(naam ? { naam } : {}) });

        if (!gelukt) return NIET_BESCHIKBAAR;

        return { status: 200, body: { ok: true, versie: { ...samenvatVersie({ ...basis, naam: naam || basis.naam, updated_at: deps.nu().toISOString() }) }, nieuw: false } };
      }

      const lijst = await deps.lijstVersies(userId, aanvraagId);

      if (lijst === null) return NIET_BESCHIKBAAR;

      // Is het maximum bereikt, dan gaat het oudste concept weg dat niet de definitieve versie is. Zijn er alleen definitieve versies, dan stopt het hier.
      if (lijst.length >= MAX_VERSIES) {
        const weg = [...lijst].filter((v) => v.status === 'concept' && v.id !== stand.definitieve_versie_id && v.id !== (basis ? basis.id : '')).sort((a, b) => a.nummer - b.nummer)[0];

        if (!weg) return fout(409, 'versies-vol', `Er zijn al ${MAX_VERSIES} versies en die zijn allemaal definitief. Verwijder eerst een oude versie.`);
        if (!(await deps.verwijderVersie(userId, weg.id))) return NIET_BESCHIKBAAR;
      }

      const nieuw = await deps.maakVersie({ user_id: userId, aanvraag_id: aanvraagId, naam, status: 'concept', herkomst: 'lid', antwoorden: onderdelen });

      if (!nieuw) return NIET_BESCHIKBAAR;

      // Wie verder werkt na een definitieve versie, is weer bezig met een concept.
      if (stand.status === 'definitief') await deps.zetAanvraagStatus(userId, aanvraagId, { status: 'concept' });

      return { status: 200, body: { ok: true, versie: samenvatVersie(nieuw), nieuw: true } };
    }

    if (modus === 'versie-wijzigen') {
      const versieId = idVan(body.versieId);
      const actie = body.actie;

      if (!versieId || !['hernoem', 'definitief', 'concept'].includes(actie)) return fout(400, 'ongeldig', 'Ongeldige aanvraag.');

      const g = await laadVersie(versieId);

      if ('antwoord' in g) return g.antwoord;

      const { versie, stand } = g;

      if (actie === 'hernoem') {
        const naam = tekstVeld(body.naam, MAX_VERSIENAAM).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();

        if (!naam) return fout(400, 'ongeldig', 'Geef de versie een naam.');
        if (!(await deps.werkVersieBij(userId, versie.id, { naam }))) return NIET_BESCHIKBAAR;

        return { status: 200, body: { ok: true, versie: samenvatVersie({ ...versie, naam }) } };
      }

      if (actie === 'definitief') {
        const volledig = await deps.leesVersie(userId, versie.id);

        if (volledig === 'storing' || !volledig) return NIET_BESCHIKBAAR;

        const onderdelen = schoneOnderdelen(volledig.antwoorden, MAX_TOTAAL_TEKENS * 2);

        if (!onderdelen || !heeftInhoud(onderdelen)) return fout(400, 'leeg', 'Een lege versie kan niet definitief worden. Schrijf eerst de tekst.');

        if (!(await deps.werkVersieBij(userId, versie.id, { status: 'definitief' }))) return NIET_BESCHIKBAAR;
        if (!(await deps.zetAanvraagStatus(userId, versie.aanvraag_id, { status: 'definitief', definitieve_versie_id: versie.id }))) return NIET_BESCHIKBAAR;

        return { status: 200, body: { ok: true, versie: samenvatVersie({ ...versie, status: 'definitief' }), aanvraagStatus: 'definitief', definitieveVersieId: versie.id } };
      }

      // Terug naar concept: de definitieve versie blijft bewaard; wie verder schrijft, maakt een nieuwe versie.
      if (!(await deps.zetAanvraagStatus(userId, versie.aanvraag_id, { status: 'concept' }))) return NIET_BESCHIKBAAR;

      return { status: 200, body: { ok: true, versie: samenvatVersie(versie), aanvraagStatus: 'concept', definitieveVersieId: stand.definitieve_versie_id } };
    }

    // versie-verwijderen
    const versieId = idVan(body.versieId);

    if (!versieId) return fout(400, 'ongeldig', 'Ongeldige aanvraag.');

    const g = await laadVersie(versieId);

    if ('antwoord' in g) return g.antwoord;
    if (g.stand.definitieve_versie_id === g.versie.id) return fout(409, 'definitief', 'De definitieve versie kunt u niet verwijderen. Maak eerst een andere versie definitief.');
    if (!(await deps.verwijderVersie(userId, g.versie.id))) return NIET_BESCHIKBAAR;

    return { status: 200, body: { ok: true, verwijderd: g.versie.id } };
  }

  // ── formulier: vragen en stukken, en antwoorden schrijven ──────────────────────────────────────────────────
  if (modus === 'vragen' || modus === 'vragen-lezen' || modus === 'vragen-bewaren' || modus === 'antwoorden-schrijven') {
    if (!deps.leesVragenStand || !deps.bewaarVragenStukken) return fout(503, 'vragen', 'Het formulier en de stukken zijn tijdelijk niet beschikbaar. Probeer het later opnieuw.');

    const NIET_BESCHIKBAAR = fout(503, 'opslag', 'Dit is nu niet beschikbaar. Probeer het later opnieuw.');
    const idVan = (x: unknown) => (typeof x === 'string' && UUID_RE.test(x) ? x.toLowerCase() : '');
    const aanvraagId = idVan(body.aanvraagId);

    if (!aanvraagId) return fout(400, 'ongeldig', 'Ongeldige aanvraag.');

    const stand = await deps.leesVragenStand(userId, aanvraagId);

    if (stand === 'storing') return NIET_BESCHIKBAAR;
    if (!stand || stand.soort !== 'fonds') return fout(404, 'aanvraag', 'Deze aanvraag is niet gevonden.');

    if (modus === 'vragen') {
      return { status: 200, body: { ok: true, aanvraagId, vragen: stand.vragen, stukken: stand.stukken && stand.stukken.length ? stand.stukken : standaardStukken() } };
    }

    if (modus === 'vragen-bewaren') {
      const velden: { vragen?: VragenLijst; stukken?: Stuk[] } = {};

      if (body.vragen !== undefined) {
        const bevestig = body.bevestig === true;
        const vragen = schoneVragen(body.vragen, bevestig);

        if (!vragen) {
          return bevestig && Array.isArray(body.vragen) && schoneVragen(body.vragen, false)
            ? fout(400, 'limiet', 'Vul bij elke vraag de tekenlimiet in, of geef aan dat dit fonds geen limiet heeft. Zonder tekenlimiet kunnen wij geen antwoord voor u schrijven.')
            : fout(400, 'ongeldig', 'De vragenlijst klopt niet. Controleer de vragen en probeer het opnieuw.');
        }

        velden.vragen = vragen;
      }

      if (body.stukken !== undefined) {
        const stukken = schoneStukken(body.stukken);

        if (!stukken) return fout(400, 'ongeldig', 'De lijst met stukken klopt niet. Controleer de lijst en probeer het opnieuw.');

        velden.stukken = stukken;
      }

      if (velden.vragen === undefined && velden.stukken === undefined) return fout(400, 'ongeldig', 'Ongeldige aanvraag.');
      if (!(await deps.bewaarVragenStukken(userId, aanvraagId, velden))) return NIET_BESCHIKBAAR;

      return { status: 200, body: { ok: true, aanvraagId, vragen: velden.vragen ?? stand.vragen, stukken: velden.stukken ?? (stand.stukken && stand.stukken.length ? stand.stukken : standaardStukken()) } };
    }

    // Beide modi hieronder gebruiken het model en horen bij een project van het lid.
    const pid = idVan(body.projectId);

    if (!pid) return fout(400, 'ongeldig', 'Ongeldige aanvraag.');
    if (stand.program_id !== pid) return fout(404, 'aanvraag', 'Deze aanvraag is niet gevonden.');

    const check = await deps.projectIsVanGebruiker(pid, userId);

    if (check === null) return fout(503, 'project', 'De aanvraag-assistent is tijdelijk niet beschikbaar. Probeer het later opnieuw.');
    if (check !== true) return fout(404, 'project', 'Dit project is niet gevonden.');

    // ── vragen-lezen: het formulier (Word, PDF of geplakt) omzetten in een vragenlijst en een lijst met stukken ─────────────
    if (modus === 'vragen-lezen') {
      const formulier = tekstVeld(body.formulierTekst, MAX_FORMULIER_TEKENS + 1).trim();

      if (formulier.length > MAX_FORMULIER_TEKENS) return fout(413, 'richtlijn-te-lang', 'De tekst van het formulier is te lang. Plak alleen de vragen.');
      if (formulier.length < 20) return fout(400, 'geen-bron', 'Plak de vragen van het formulier of voeg het bestand toe.');

      const gebruikt = await deps.telRijen(userId, 'eisen', sinds);

      if (gebruikt === null) return fout(503, 'telling', 'De aanvraag-assistent is tijdelijk niet beschikbaar. Probeer het later opnieuw.');
      if (gebruikt >= config.eisenOphalenPerMaand) return fout(429, 'maand-op', 'U heeft deze maand het maximum aantal formulieren en criterialijsten gelezen. Volgende maand is er weer ruimte.', { limiet: config.eisenOphalenPerMaand });

      const plek = await deps.reserveer(userId, 'eisen', config.eisenOphalenPerMaand, sinds);

      if (!plek.ok) {
        if (plek.reden === 'maand-op') return fout(429, 'maand-op', 'U heeft deze maand het maximum aantal formulieren en criterialijsten gelezen. Volgende maand is er weer ruimte.', { limiet: config.eisenOphalenPerMaand });

        return reserveerWeigering(plek.reden);
      }

      let uitkomst: VragenUitkomst | null = null;
      let usage = { prompt_tokens: 0, completion_tokens: 0 };

      try {
        const antwoord = await deps.roep(VRAGEN_SYSTEEM, bouwVragenBericht(formulier));

        if (antwoord) {
          usage = { prompt_tokens: Number(antwoord.usage?.prompt_tokens ?? 0) || 0, completion_tokens: Number(antwoord.usage?.completion_tokens ?? 0) || 0 };

          try {
            uitkomst = leesVragen(JSON.parse(antwoord.inhoud || '{}'), formulier);
          } catch (_e) {
            uitkomst = null;
          }
        }
      } catch (e) {
        await deps.rondAf(plek.id, userId, false).catch(() => undefined);
        throw e;
      }

      const gelukt = Boolean(uitkomst && uitkomst.vragen.length > 0);

      await deps.rondAf(plek.id, userId, gelukt).catch(() => undefined);
      await deps.meldGebruik({ userId, tier: tierLabel, actie: 'aanvraag_vragen', projectId: pid, model: deps.modelNaam, inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens, duurMs: Date.now() - start, succes: gelukt });

      if (!uitkomst) return fout(502, 'ai-mislukt', 'Het formulier kon nu niet worden gelezen. Probeer het later opnieuw; er is niets verbruikt van uw maandruimte.');
      if (!uitkomst.vragen.length) return fout(422, 'geen-vragen', 'Wij vonden geen vragen in deze tekst. Controleer of u de vragen van het formulier heeft geplakt, of voeg ze zelf toe.', { statistiek: uitkomst.stat });

      // Stukken die het lid al had blijven staan; nieuwe uit dit formulier komen erbij.
      const bestaand = stand.stukken && stand.stukken.length ? stand.stukken : [];
      let stukken: Stuk[] = uitkomst.stukken;

      if (bestaand.length) {
        const sleutels = new Set(bestaand.map((s) => normaliseer(s.tekst)));
        const erbij = uitkomst.stukken.filter((s) => !sleutels.has(normaliseer(s.tekst)) && !(s.sleutel && bestaand.some((b) => b.sleutel === s.sleutel)));

        stukken = schoneStukken([...bestaand, ...erbij.map((s, i) => ({ ...s, id: `s${bestaand.length + i + 1}` }))]) ?? bestaand;
      }

      const vragen: VragenLijst = { bevestigd: false, lijst: uitkomst.vragen };
      const opgeslagen = await deps.bewaarVragenStukken(userId, aanvraagId, { vragen, stukken });

      return { status: 200, body: { ok: true, aanvraagId, opgeslagen, vragen, stukken, statistiek: uitkomst.stat, resterend: Math.max(0, config.eisenOphalenPerMaand - plek.gebruikt - 1) } };
    }

    // ── antwoorden-schrijven: per vraag een concept uit projectgegevens, documentatie, begroting en dekkingsplan ──────────────
    if (!stand.vragen || !stand.vragen.bevestigd || !stand.vragen.lijst.length) {
      return fout(409, 'vragen-niet-bevestigd', 'Bevestig eerst de vragenlijst en de tekenlimieten. Zonder tekenlimiet kunnen wij geen antwoord voor u schrijven.');
    }

    const gevraagd = Array.isArray(body.vraagIds) ? (body.vraagIds as unknown[]).filter((x): x is string => typeof x === 'string' && /^v\d{1,3}$/.test(x)).slice(0, MAX_VRAGEN) : [];
    const bekend = new Set(stand.vragen.lijst.map((v) => v.id));

    if (gevraagd.some((x) => !bekend.has(x))) return fout(400, 'ongeldig', 'Ongeldige aanvraag.');

    const defs = sectiesUitVragen(stand.vragen.lijst, gevraagd.length ? Array.from(new Set(gevraagd)) : undefined);

    if (!defs.length) return fout(400, 'ongeldig', 'Ongeldige aanvraag.');

    // Alle antwoorden voor één fonds tellen samen als één beoordeling van de maand, ook als een antwoord later opnieuw wordt geschreven.
    const maand = maandSleutel(deps.nu());
    const gratis = stand.schrijf_maand === maand;
    const eerder = gratis ? stand.schrijf_aantal : 0;
    const maandOp = () =>
      fout(
        429,
        'maand-op',
        tier === 'pro' && !isAdmin
          ? `U heeft deze maand al ${config.beoordelingenPerMaand} keer een aanvraag laten beoordelen of schrijven. Volgende maand is er weer ruimte; met Premium kunt u er meer per maand doen.`
          : `U heeft deze maand al ${config.beoordelingenPerMaand} keer een aanvraag laten beoordelen of schrijven. Volgende maand is er weer ruimte.`,
        { limiet: config.beoordelingenPerMaand, resterend: 0 },
      );

    if (gratis && eerder + defs.length > MAX_HERSCHRIJVEN_PER_MAAND) {
      return fout(429, 'herschrijven-op', 'U heeft dit fonds deze maand al heel vaak laten schrijven. Werk de antwoorden zelf verder bij, of probeer het volgende maand opnieuw.', { limiet: MAX_HERSCHRIJVEN_PER_MAAND });
    }

    if (!gratis) {
      const gebruiktFonds = await deps.telRijen(userId, 'beoordelingen', sinds);

      if (gebruiktFonds === null) return fout(503, 'telling', 'De aanvraag-assistent is tijdelijk niet beschikbaar. Probeer het later opnieuw.');
      if (!maandRuimte(config, 'beoordeling', gebruiktFonds).toegestaan) return maandOp();
    }

    const bron = await deps.leesPlanBron(userId, pid, token);

    if (!bron) return fout(503, 'project', 'Uw projectgegevens konden nu niet worden gelezen. Probeer het later opnieuw.');

    const feiten = bouwFeiten(bron);

    if (feiten.length < MIN_FEITEN) {
      return fout(422, 'te-weinig-info', 'Er staat nog te weinig in uw projectgegevens en projectdocumentatie om antwoorden op te baseren. Vul eerst de aanleiding, de doelgroep, de doelstelling en de activiteiten in.', { aantalFeiten: feiten.length });
    }

    const { aandachtspunten } = sectiesUitCriteria(Array.isArray(stand.criteria) ? (stand.criteria as any[]) : []);
    const plek = gratis ? null : await deps.reserveer(userId, 'beoordelingen', config.beoordelingenPerMaand, sinds);

    if (plek && !plek.ok) return plek.reden === 'maand-op' ? maandOp() : reserveerWeigering(plek.reden);

    let geschreven: Awaited<ReturnType<typeof schrijfPlan>>;

    try {
      geschreven = await schrijfPlan({ secties: defs, feiten, aandachtspunten, roep: deps.roep });
    } catch (e) {
      if (plek && plek.ok) await deps.rondAf(plek.id, userId, false).catch(() => undefined);
      throw e;
    }

    const gelukt = geschreven.modelAangeroepen && geschreven.stat.secties - geschreven.stat.zonderFeiten - geschreven.stat.mislukt > 0;

    if (plek && plek.ok) await deps.rondAf(plek.id, userId, gelukt).catch(() => undefined);

    await deps.meldGebruik({ userId, tier: tierLabel, actie: 'aanvraag_antwoorden', projectId: pid, model: deps.modelNaam, inputTokens: geschreven.usage.prompt_tokens, outputTokens: geschreven.usage.completion_tokens, duurMs: Date.now() - start, succes: gelukt });

    if (!gelukt) return fout(502, 'ai-mislukt', 'De antwoorden zijn nu niet gelukt. Probeer het later opnieuw; er is niets verbruikt van uw maandruimte.', { statistiek: geschreven.stat });

    // Onthoud dat dit fonds deze maand al is meegeteld. Lukt dat niet, dan krijgt het lid de antwoorden toch.
    await deps.bewaarVragenStukken(userId, aanvraagId, { schrijf_maand: maand, schrijf_aantal: eerder + defs.length }).catch(() => false);

    return {
      status: 200,
      body: {
        ok: true,
        aanvraagId,
        antwoorden: geschreven.secties.map((s) => ({ id: s.id, titel: s.titel, tekst: s.tekst, status: s.status, vragen: s.vragen, aantalAanvullen: s.aantalAanvullen, herkomst: s.herkomst, ...(s.maxTekens ? { maxTekens: s.maxTekens, overLimiet: Boolean(s.overLimiet) } : {}) })),
        statistiek: geschreven.stat,
        telde: !gratis,
        resterend: plek && plek.ok ? Math.max(0, config.beoordelingenPerMaand - plek.gebruikt - 1) : null,
        limiet: config.beoordelingenPerMaand,
      },
    };
  }

  // ── eisen-ophalen ─────────────────────────────────────────────────────────────────────────────────────────
  if (modus === 'eisen-ophalen') {
    const gebruikt = await deps.telRijen(userId, 'eisen', sinds);

    if (gebruikt === null) return fout(503, 'telling', 'De aanvraag-assistent is tijdelijk niet beschikbaar. Probeer het later opnieuw.');

    if (gebruikt >= config.eisenOphalenPerMaand) {
      return fout(429, 'maand-op', 'U heeft deze maand het maximum aantal criterialijsten opgehaald. Volgende maand is er weer ruimte.', { limiet: config.eisenOphalenPerMaand });
    }

    const projectId = typeof body.projectId === 'string' && UUID_RE.test(body.projectId) ? body.projectId.toLowerCase() : null;
    const formulier = tekstVeld(body.formulierTekst, config.maxRichtlijnTekens + 1).trim();
    const richtlijn = tekstVeld(body.richtlijnTekst, config.maxRichtlijnTekens + 1).trim();
    const urls = (Array.isArray(body.websiteUrls) ? body.websiteUrls : []).filter((u: unknown) => typeof u === 'string' && u.trim()).slice(0, MAX_PAGINAS) as string[];

    if (formulier.length > config.maxRichtlijnTekens || richtlijn.length > config.maxRichtlijnTekens) return fout(413, 'richtlijn-te-lang', 'De tekst van het formulier of de richtlijn is te lang. Plak alleen de vragen en criteria.');
    if (!formulier && !richtlijn && !urls.length) return fout(400, 'geen-bron', 'Geef een website of plak de vragen en richtlijnen van het fonds.');

    if (projectId && (await deps.projectIsVanGebruiker(projectId, userId)) !== true) return fout(404, 'project', 'Dit project is niet gevonden.');

    const fondsLabelOphalen = tekstVeld(body.fondsLabel, MAX_FONDSLABEL).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();

    const bronnen: BronTekst[] = [];
    const bronStatus: Array<{ type: 'lid' | 'website'; gelezen: boolean; reden?: string }> = [];
    let paginasGelezen = 0;

    // Het formulier van het lid gaat voor de website.
    if (formulier) {
      bronnen.push({ type: 'lid', tekst: formulier });
      bronStatus.push({ type: 'lid', gelezen: true });
    }

    if (richtlijn) {
      bronnen.push({ type: 'lid', tekst: richtlijn });
      bronStatus.push({ type: 'lid', gelezen: true });
    }

    const paginas = await Promise.all(urls.map((u) => deps.haalPagina(u).catch(() => ({ ok: false, reden: 'niet-bereikbaar' }) as PaginaUitkomst)));

    for (const p of paginas) {
      if (p.ok && p.tekst.trim()) {
        paginasGelezen += 1;
        bronnen.push({ type: 'website', tekst: p.tekst });
        bronStatus.push({ type: 'website', gelezen: true });
      } else {
        bronStatus.push({ type: 'website', gelezen: false, reden: p.ok ? 'niet-leesbaar' : p.reden });
      }
    }

    // Een pagina die niet gelezen kon worden wordt gemeld, nooit stilzwijgend overgeslagen.
    if (!bronnen.length) return fout(422, 'geen-bron-gelezen', 'De website kon niet worden gelezen. Kopieer de vragen en criteria van het fonds naar een tekstvak of Word-bestand en plak ze hier.', { bronnen: bronStatus, inlogSignaal: false });

    // Atomair reserveren vlak vóór de modelaanroep (de eerste controle hierboven is alleen om onnodig ophalen te sparen).
    const plekEisen = await deps.reserveer(userId, 'eisen', config.eisenOphalenPerMaand, sinds);

    if (!plekEisen.ok) {
      if (plekEisen.reden === 'maand-op') return fout(429, 'maand-op', 'U heeft deze maand het maximum aantal criterialijsten opgehaald. Volgende maand is er weer ruimte.', { limiet: config.eisenOphalenPerMaand });

      return reserveerWeigering(plekEisen.reden);
    }

    let uitkomst: Awaited<ReturnType<typeof haalEisenOp>>;

    try {
      uitkomst = await haalEisenOp({ bronnen, roep: deps.roep, maxEisen: config.maxEisen, maxTekensPerBron: config.maxRichtlijnTekens });
    } catch (e) {
      await deps.rondAf(plekEisen.id, userId, false).catch(() => undefined);
      throw e;
    }

    await deps.rondAf(plekEisen.id, userId, uitkomst.gelukt).catch(() => undefined);

    await deps.meldGebruik({
      userId,
      tier: tierLabel,
      actie: 'aanvraag_eisen',
      projectId,
      model: deps.modelNaam,
      inputTokens: uitkomst.usage.prompt_tokens,
      outputTokens: uitkomst.usage.completion_tokens,
      externePaginas: paginasGelezen,
      duurMs: Date.now() - start,
      succes: uitkomst.gelukt,
    });

    if (!uitkomst.gelukt) return fout(502, 'ai-mislukt', 'De criteria konden nu niet worden opgehaald. Probeer het later opnieuw; er is niets verbruikt van uw maandruimte.');

    // Een signaal, geen zekerheid: woorden als inloggen of portaal in de aangeleverde tekst of de adressen.
    const inlogSignaal = wijstOpInlog(...bronnen.map((b) => b.tekst.slice(0, 20_000)), ...urls);

    // Met een project en een fondsnaam bewaren we de criteria bij de aanvraag voor dit fonds (en maken die zo nodig aan). Mislukt dat, dan krijgt het lid
    // de criteria toch; ze moeten dan opnieuw worden opgehaald om ze later terug te vinden.
    const aanvraagId =
      projectId && fondsLabelOphalen.length >= 2
        ? await deps.bewaarAanvraag({
            user_id: userId,
            program_id: projectId,
            soort: 'fonds',
            fonds_label: fondsLabelOphalen,
            fonds_sleutel: fondsSleutel(fondsLabelOphalen),
            criteria: uitkomst.eisen,
            criteria_bron: uitkomst.eisenBron,
            bronnen: bronStatus,
          })
        : null;

    return {
      status: 200,
      body: {
        ok: true,
        aanvraagId,
        opgeslagen: aanvraagId !== null,
        eisen: uitkomst.eisen,
        eisenBron: uitkomst.eisenBron,
        beperkteLijst: eisenlijstBeperkt(uitkomst.eisen),
        inlogSignaal,
        bronnen: bronStatus,
        statistiek: uitkomst.stat,
        resterend: Math.max(0, config.eisenOphalenPerMaand - plekEisen.gebruikt - 1),
      },
    };
  }

  // ── plan-schrijven ────────────────────────────────────────────────────────────────────────────────────────
  // ── plan-gereedheid (voortgangsmeter voor het algemene projectplan) ──────────────────────────────────────
  if (modus === 'plan-gereedheid') {
    const pid = typeof body.projectId === 'string' && UUID_RE.test(body.projectId) ? body.projectId.toLowerCase() : '';

    if (!pid) return fout(400, 'ongeldig', 'Ongeldige aanvraag.');

    const check = await deps.projectIsVanGebruiker(pid, userId);

    if (check === null) return fout(503, 'project', 'De aanvraag-assistent is tijdelijk niet beschikbaar. Probeer het later opnieuw.');
    if (check !== true) return fout(404, 'project', 'Dit project is niet gevonden.');

    const bron = await deps.leesPlanBron(userId, pid);

    if (!bron) return fout(503, 'project', 'Uw projectgegevens konden nu niet worden gelezen. Probeer het later opnieuw.');

    const stand = await deps.planStand(userId, pid, planStartIso(deps.nu()));

    return {
      status: 200,
      body: {
        ok: true,
        gereedheid: planGereedheid(bouwFeiten(bron)),
        projectKlaar: stand === null ? null : stand.projectKlaar,
        plannen: { limiet: config.projectplannen, gebruikt: stand === null ? null : stand.gebruikt, resterend: stand === null ? null : Math.max(0, config.projectplannen - stand.gebruikt), periodeMaanden: PLAN_VENSTER_MAANDEN },
      },
    };
  }

  // ── plan-schrijven ────────────────────────────────────────────────────────────────────────────────────────
  if (modus === 'plan-schrijven') {
    const pid = typeof body.projectId === 'string' && UUID_RE.test(body.projectId) ? body.projectId.toLowerCase() : '';

    if (!pid) return fout(400, 'ongeldig', 'Ongeldige aanvraag.');

    const aanvraagIdPlan = typeof body.aanvraagId === 'string' && body.aanvraagId ? (UUID_RE.test(body.aanvraagId) ? body.aanvraagId.toLowerCase() : '?') : '';

    if (aanvraagIdPlan === '?') return fout(400, 'ongeldig', 'Ongeldige aanvraag.');

    const check = await deps.projectIsVanGebruiker(pid, userId);

    if (check === null) return fout(503, 'project', 'De aanvraag-assistent is tijdelijk niet beschikbaar. Probeer het later opnieuw.');
    if (check !== true) return fout(404, 'project', 'Dit project is niet gevonden.');

    // Twee soorten. Een versie voor een fonds telt bij de beoordelingen van de maand. Het algemene projectplan wordt één keer per project geschreven;
    // het aantal verschillende projecten per rollend jaar hangt af van het abonnement.
    const fondsVersie = Boolean(aanvraagIdPlan);
    const sindsPlan = planStartIso(deps.nu());
    const fondsMaandOp = () =>
      fout(
        429,
        'maand-op',
        tier === 'pro' && !isAdmin
          ? `U heeft deze maand al ${config.beoordelingenPerMaand} keer een aanvraag laten beoordelen of schrijven. Volgende maand is er weer ruimte; met Premium kunt u er meer per maand doen.`
          : `U heeft deze maand al ${config.beoordelingenPerMaand} keer een aanvraag laten beoordelen of schrijven. Volgende maand is er weer ruimte.`,
        { limiet: config.beoordelingenPerMaand, resterend: 0 },
      );
    const planAlGeschreven = () => fout(409, 'al-geschreven', 'Het projectplan van dit project is al geschreven. Kopieer of download het en werk het zelf verder bij; opnieuw laten schrijven kan niet.');
    const planLimiet = () =>
      fout(
        429,
        'plan-limiet',
        tier === 'pro' && !isAdmin
          ? 'Met Pro laat u voor één project een projectplan schrijven, en dat is al gebeurd. Voor meer projecten heeft u Premium nodig.'
          : `U heeft het maximum van ${config.projectplannen} projecten met een geschreven plan bereikt.`,
        { limiet: config.projectplannen, resterend: 0 },
      );

    if (fondsVersie) {
      const gebruiktFonds = await deps.telRijen(userId, 'beoordelingen', sinds);

      if (gebruiktFonds === null) return fout(503, 'telling', 'De aanvraag-assistent is tijdelijk niet beschikbaar. Probeer het later opnieuw.');
      if (!maandRuimte(config, 'beoordeling', gebruiktFonds).toegestaan) return fondsMaandOp();
    } else {
      const stand = await deps.planStand(userId, pid, sindsPlan);

      if (!stand) return fout(503, 'telling', 'De aanvraag-assistent is tijdelijk niet beschikbaar. Probeer het later opnieuw.');
      if (stand.projectKlaar) return planAlGeschreven();
      if (stand.gebruikt >= config.projectplannen) return planLimiet();
    }

    // Een plan voor een fonds hoort bij een bestaande aanvraag van dit lid en dit project; zonder aanvraag is het het algemene plan van het project.
    let rij: AanvraagRij | null = null;

    if (aanvraagIdPlan) {
      const gelezen = await deps.leesAanvraag(userId, aanvraagIdPlan);

      if (gelezen === 'storing') return fout(503, 'opslag', 'De aanvraag-assistent is tijdelijk niet beschikbaar. Probeer het later opnieuw.');
      if (!gelezen || gelezen.program_id !== pid || gelezen.soort !== 'fonds') return fout(404, 'aanvraag', 'Deze aanvraag is niet gevonden.');

      rij = gelezen;
    }

    const bron = await deps.leesPlanBron(userId, pid, token);

    if (!bron) return fout(503, 'project', 'Uw projectgegevens konden nu niet worden gelezen. Probeer het later opnieuw.');

    const feiten = bouwFeiten(bron);

    if (feiten.length < MIN_FEITEN) {
      return fout(422, 'te-weinig-info', 'Er staat nog te weinig in uw projectgegevens en projectdocumentatie om een plan op te baseren. Vul eerst de aanleiding, de doelgroep, de doelstelling en de activiteiten in.', { aantalFeiten: feiten.length });
    }

    // Het algemene plan wordt maar één keer geschreven: pas als alle kernvelden zijn ingevuld.
    if (!fondsVersie) {
      const g = planGereedheid(feiten);

      if (!g.klaar) {
        return fout(422, 'onvolledig', 'Het plan kan pas worden geschreven als de projectinformatie volledig is. Het wordt maar één keer per project geschreven, dus we wachten tot alles erin staat.', { gereedheid: g });
      }
    }

    const { secties: defs, aandachtspunten, uitFormulier } = rij ? sectiesUitCriteria(rij.criteria as any[]) : { secties: STANDAARD_SECTIES.map((d) => ({ ...d })), aandachtspunten: [] as string[], uitFormulier: false };
    // Atomair reserveren vlak vóór de modelaanroep.
    const plekPlan = fondsVersie ? await deps.reserveer(userId, 'beoordelingen', config.beoordelingenPerMaand, sinds) : await deps.planReserveer(userId, pid, config.projectplannen, sindsPlan);

    if (!plekPlan.ok) {
      if (plekPlan.reden === 'maand-op') return fondsMaandOp();
      if (plekPlan.reden === 'al-geschreven') return planAlGeschreven();
      if (plekPlan.reden === 'plan-limiet') return planLimiet();

      return reserveerWeigering(plekPlan.reden);
    }

    let geschreven: Awaited<ReturnType<typeof schrijfPlan>>;

    try {
      geschreven = await schrijfPlan({ secties: defs, feiten, aandachtspunten, roep: deps.roep });
    } catch (e) {
      await deps.rondAf(plekPlan.id, userId, false).catch(() => undefined);
      throw e;
    }

    const nuIso = deps.nu().toISOString();
    // Gelukt = minstens één onderdeel dat het model echt heeft behandeld is goed teruggekomen (onderdelen zonder feiten tellen niet mee).
    // Het algemene plan wordt maar één keer geschreven: een plan met een mislukt onderdeel telt niet (het lid mag het opnieuw proberen).
    const gelukt = geschreven.modelAangeroepen && geschreven.stat.secties - geschreven.stat.zonderFeiten - geschreven.stat.mislukt > 0 && (fondsVersie || geschreven.stat.mislukt === 0);

    await deps.rondAf(plekPlan.id, userId, gelukt && geschreven.modelAangeroepen).catch(() => undefined);

    await deps.meldGebruik({
      userId,
      tier: tierLabel,
      actie: 'aanvraag_plan',
      projectId: pid,
      model: deps.modelNaam,
      inputTokens: geschreven.usage.prompt_tokens,
      outputTokens: geschreven.usage.completion_tokens,
      duurMs: Date.now() - start,
      succes: gelukt && geschreven.modelAangeroepen,
    });

    // Geen enkel onderdeel gelukt = storing: niet opslaan en niet meetellen. (Alleen onderdelen zonder feiten tellen niet als een plan.)
    if (!gelukt || !geschreven.modelAangeroepen) return fout(502, 'ai-mislukt', fondsVersie ? 'Het plan is nu niet gelukt. Probeer het later opnieuw; er is niets verbruikt van uw maandruimte.' : 'Het plan is nu niet gelukt. Probeer het zo opnieuw; uw plek voor een projectplan is niet verbruikt.', { statistiek: geschreven.stat });

    const plan = { versie: 1, soort: rij ? 'fonds' : 'algemeen', gemaakt: nuIso, uitFormulier, secties: geschreven.secties, statistiek: geschreven.stat };
    const planRij = {
      user_id: userId,
      program_id: pid,
      soort: (rij ? 'fonds' : 'algemeen') as 'fonds' | 'algemeen',
      fonds_label: rij ? rij.fonds_label : '',
      fonds_sleutel: rij ? fondsSleutel(rij.fonds_label) : '',
      plan,
      plan_bijgewerkt_op: nuIso,
    };
    // Het algemene plan wordt maar één keer geschreven: lukt het bewaren niet, probeer het dan nog één keer voordat het lid zonder plan blijft.
    let opgeslagenId = await deps.bewaarAanvraag(planRij);

    if (opgeslagenId === null && !fondsVersie) opgeslagenId = await deps.bewaarAanvraag(planRij);

    return {
      status: 200,
      body: { ok: true, aanvraagId: opgeslagenId ?? rij?.id ?? null, opgeslagen: opgeslagenId !== null, projectKlaar: !fondsVersie, plan, resterend: Math.max(0, (fondsVersie ? config.beoordelingenPerMaand : config.projectplannen) - plekPlan.gebruikt - 1), limiet: fondsVersie ? config.beoordelingenPerMaand : config.projectplannen },
    };
  }

  // ── begroting-voorstel (het chatantwoord over de begroting omzetten in regels; telt als één beoordeling) ───────────────────────────────────────
  if (modus === 'begroting-voorstel' || modus === 'begroting-upload') {
    const upload = modus === 'begroting-upload';
    const pid = typeof body.projectId === 'string' && UUID_RE.test(body.projectId) ? body.projectId.toLowerCase() : '';

    if (!pid) return fout(400, 'ongeldig', 'Ongeldige aanvraag.');

    const maxTekens = upload ? MAX_TEKENS_UPLOAD : MAX_TEKENS_VOORSTEL;
    const tekst = tekstVeld(body.tekst, maxTekens + 1);

    if (tekst.length > maxTekens) {
      return fout(
        413,
        'te-lang',
        upload
          ? 'Dit bestand is te groot om in één keer te lezen. Bewaar alleen het blad of het deel met de begroting in een nieuw bestand.'
          : 'Dit antwoord is te lang om in één keer om te zetten. Vraag de chat om de begroting korter samen te vatten.',
      );
    }

    if (tekst.trim().length < (upload ? MIN_TEKENS_UPLOAD : 40)) {
      return fout(
        400,
        'geen-tekst',
        upload ? 'In dit bestand staat geen tekst die we kunnen lezen. Staat de begroting in een afbeelding? Upload dan een Excel- of Word-bestand met de begroting als tekst.' : 'In dit antwoord staat nog geen begroting. Vraag de chat om de begroting eerst op te stellen.',
      );
    }

    const projectBegroting = await deps.projectIsVanGebruiker(pid, userId);

    if (projectBegroting === null) return fout(503, 'project', 'De aanvraag-assistent is tijdelijk niet beschikbaar. Probeer het later opnieuw.');
    if (projectBegroting !== true) return fout(404, 'project', 'Dit project is niet gevonden.');

    const gebruiktBegroting = await deps.telRijen(userId, 'beoordelingen', sinds);

    if (gebruiktBegroting === null) return fout(503, 'telling', 'De aanvraag-assistent is tijdelijk niet beschikbaar. Probeer het later opnieuw.');

    const ruimteBegroting = maandRuimte(config, 'beoordeling', gebruiktBegroting);
    const begrotingMaandOp = () =>
      fout(
        429,
        'maand-op',
        tier === 'pro' && !isAdmin
          ? `U heeft deze maand al ${ruimteBegroting.limiet} keer een aanvraag of begroting laten maken. Volgende maand is er weer ruimte; met Premium kunt u er meer per maand doen.`
          : `U heeft deze maand al ${ruimteBegroting.limiet} keer een aanvraag of begroting laten maken. Volgende maand is er weer ruimte.`,
        { limiet: ruimteBegroting.limiet, resterend: 0 },
      );

    if (!ruimteBegroting.toegestaan) return begrotingMaandOp();

    const plekBegroting = await deps.reserveer(userId, 'beoordelingen', config.beoordelingenPerMaand, sinds);

    if (!plekBegroting.ok) return plekBegroting.reden === 'maand-op' ? begrotingMaandOp() : reserveerWeigering(plekBegroting.reden);

    let voorstel: { regels: any[]; stat?: unknown; controle?: unknown; usage: { prompt_tokens: number; completion_tokens: number }; gelukt: boolean };

    try {
      voorstel = upload ? await leesBegrotingUpload({ tekst, roep: deps.roep }) : await maakBegrotingVoorstel({ tekst, roep: deps.roep });
    } catch (e) {
      await deps.rondAf(plekBegroting.id, userId, false).catch(() => undefined);
      throw e;
    }

    const bruikbaar = voorstel.gelukt && voorstel.regels.length > 0;

    await deps.rondAf(plekBegroting.id, userId, bruikbaar).catch(() => undefined);

    await deps.meldGebruik({
      userId,
      tier: tierLabel,
      actie: upload ? 'aanvraag_begroting_upload' : 'aanvraag_begroting',
      projectId: pid,
      model: deps.modelNaam,
      inputTokens: voorstel.usage.prompt_tokens,
      outputTokens: voorstel.usage.completion_tokens,
      duurMs: Date.now() - start,
      succes: bruikbaar,
    });

    if (!voorstel.gelukt) return fout(502, 'ai-mislukt', `${upload ? 'Het lezen van het bestand' : 'Het omzetten'} lukte nu niet. Probeer het later opnieuw; er is niets verbruikt van uw maandruimte.`);
    if (!bruikbaar) {
      return fout(
        422,
        'geen-regels',
        `${upload ? 'In dit bestand staan geen kostenposten om in de begroting te zetten.' : 'In dit antwoord staan geen kostenposten om in de begroting te zetten.'} Er is niets verbruikt van uw maandruimte.`,
      );
    }

    const resterendBegroting = Math.max(0, ruimteBegroting.limiet - plekBegroting.gebruikt - 1);

    // Sluit de begroting met het dekkingsplan? Alleen een melding; het lukt of het blijft weg (nooit een fout voor het lid).
    let sluit: ReturnType<typeof sluitNaToevoegen> | null = null;

    try {
      const stand = deps.leesBegrotingStand ? await deps.leesBegrotingStand(userId, pid, token) : null;

      if (stand && stand.financiering) sluit = sluitNaToevoegen({ bestaand: stand.regels, nieuw: voorstel.regels, eigenBijdrage: stand.eigenBijdrage, financiering: stand.financiering });
    } catch (_e) {
      sluit = null;
    }

    // Bij een upload gaat de controle (sommen, afwijkingen) mee; het kopje uit het bestand blijft op de server.
    if (upload) {
      return {
        status: 200,
        body: { ok: true, regels: voorstel.regels.map(({ sectie: _sectie, ...rest }: any) => rest), controle: voorstel.controle, sluit, resterend: resterendBegroting, limiet: ruimteBegroting.limiet },
      };
    }

    return {
      status: 200,
      body: { ok: true, regels: voorstel.regels, statistiek: voorstel.stat, sluit, resterend: resterendBegroting, limiet: ruimteBegroting.limiet },
    };
  }

  // ── beoordelen ────────────────────────────────────────────────────────────────────────────────────────────
  const projectId = typeof body.projectId === 'string' && UUID_RE.test(body.projectId) ? body.projectId.toLowerCase() : '';

  if (!projectId) return fout(400, 'ongeldig', 'Ongeldige aanvraag.');

  const aanvraag = tekstVeld(body.aanvraagTekst, config.maxAanvraagTekens + 1);
  const invoer = controleerInvoer({ aanvraag }, config);

  if (!invoer.ok) {
    const melding = { 'te-kort': 'De aanvraag is te kort om te beoordelen. Plak de volledige tekst.', 'aanvraag-te-lang': 'De aanvraag is te lang om in één keer te beoordelen. Beoordeel haar in delen, bijvoorbeeld per hoofdstuk.', 'richtlijn-te-lang': 'De tekst is te lang.' }[invoer.reden];

    return fout(413, invoer.reden, melding);
  }

  const { eisen, afgewezen } = schoneClientEisen(body.eisen, config.maxEisen);
  const aanvraagIdBeoordeling = typeof body.aanvraagId === 'string' && UUID_RE.test(body.aanvraagId) ? body.aanvraagId.toLowerCase() : '';

  if (!eisen.length) return fout(400, 'geen-eisen', 'Er zijn geen criteria om tegen te beoordelen. Haal eerst de criteria op.', { afgewezen });

  const projectCheck = await deps.projectIsVanGebruiker(projectId, userId);

  if (projectCheck === null) return fout(503, 'project', 'De aanvraag-assistent is tijdelijk niet beschikbaar. Probeer het later opnieuw.');
  if (projectCheck !== true) return fout(404, 'project', 'Dit project is niet gevonden.');

  const gebruikt = await deps.telRijen(userId, 'beoordelingen', sinds);

  if (gebruikt === null) return fout(503, 'telling', 'De aanvraag-assistent is tijdelijk niet beschikbaar. Probeer het later opnieuw.');

  const ruimte = maandRuimte(config, 'beoordeling', gebruikt);

  const beoordelingMaandOp = () =>
    fout(
      429,
      'maand-op',
      tier === 'pro' && !isAdmin
        ? `U heeft deze maand al ${ruimte.limiet} aanvragen laten beoordelen. Volgende maand is er weer ruimte; met Premium kunt u er meer per maand beoordelen.`
        : `U heeft deze maand al ${ruimte.limiet} aanvragen laten beoordelen. Volgende maand is er weer ruimte.`,
      { limiet: ruimte.limiet, resterend: 0 },
    );

  if (!ruimte.toegestaan) return beoordelingMaandOp();

  // Hoort de beoordeling bij een bestaande aanvraag? Dan moet die van dit lid en dit project zijn.
  let aanvraagRij: AanvraagRij | null = null;

  if (aanvraagIdBeoordeling) {
    const gelezen = await deps.leesAanvraag(userId, aanvraagIdBeoordeling);

    if (gelezen === 'storing') return fout(503, 'opslag', 'De aanvraag-assistent is tijdelijk niet beschikbaar. Probeer het later opnieuw.');
    if (!gelezen || gelezen.program_id !== projectId || gelezen.soort !== 'fonds') return fout(404, 'aanvraag', 'Deze aanvraag is niet gevonden.');

    aanvraagRij = gelezen;
  }

  const fondsLabel = (aanvraagRij?.fonds_label || tekstVeld(body.fondsLabel, MAX_FONDSLABEL)).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
  // Atomair reserveren vlak vóór de modelaanroep.
  const plekBeoordeling = await deps.reserveer(userId, 'beoordelingen', config.beoordelingenPerMaand, sinds);

  if (!plekBeoordeling.ok) return plekBeoordeling.reden === 'maand-op' ? beoordelingMaandOp() : reserveerWeigering(plekBeoordeling.reden);

  let uitkomst: Awaited<ReturnType<typeof beoordeelAanvraag>>;

  try {
    uitkomst = await beoordeelAanvraag({ aanvraag, eisen, roep: deps.roep });
  } catch (e) {
    await deps.rondAf(plekBeoordeling.id, userId, false).catch(() => undefined);
    throw e;
  }

  const geldig = uitkomst.stat.geldig > 0;

  await deps.rondAf(plekBeoordeling.id, userId, geldig).catch(() => undefined);

  await deps.meldGebruik({
    userId,
    tier: tierLabel,
    actie: 'aanvraag_beoordeling',
    projectId,
    model: deps.modelNaam,
    inputTokens: uitkomst.usage.prompt_tokens,
    outputTokens: uitkomst.usage.completion_tokens,
    duurMs: Date.now() - start,
    succes: geldig,
  });

  // Geen enkel geldig oordeel = storing of onbruikbaar modelantwoord: niet opslaan en niet meetellen.
  if (!geldig) return fout(502, 'ai-mislukt', 'De beoordeling is nu niet gelukt. Probeer het later opnieuw; er is niets verbruikt van uw maandruimte.', { statistiek: uitkomst.stat });

  const { uitkomst: eindUitkomst, punten } = berekenUitkomst(eisen, uitkomst.resultaten);
  const eisenBron = eisenBronLabel(eisen) ?? 'lid';
  const id = await deps.slaBeoordelingOp({
    user_id: userId,
    program_id: projectId,
    fonds_label: fondsLabel,
    eisen_bron: eisenBron,
    eisen,
    resultaat: { resultaten: uitkomst.resultaten, punten },
    uitkomst: eindUitkomst,
    statistiek: uitkomst.stat,
    model: deps.modelNaam,
    tokens_in: uitkomst.usage.prompt_tokens,
    tokens_uit: uitkomst.usage.completion_tokens,
  });

  // De aanvraag onthoudt de laatste uitkomst (de beoordeling zelf staat in zijn eigen tabel). Mislukken is niet erg: de beoordeling is dan wel opgeslagen.
  if (aanvraagRij && id) {
    await deps.bewaarAanvraag({
      user_id: userId,
      program_id: projectId,
      soort: 'fonds',
      fonds_label: aanvraagRij.fonds_label,
      fonds_sleutel: fondsSleutel(aanvraagRij.fonds_label),
      laatste_beoordeling_id: id,
      laatste_uitkomst: eindUitkomst,
    }).catch(() => null);
  }

  return {
    status: 200,
    body: {
      ok: true,
      beoordelingId: id,
      aanvraagId: aanvraagRij?.id ?? null,
      opgeslagen: id !== null,
      uitkomst: eindUitkomst,
      uitkomstTekst: UITKOMST_TEKST[eindUitkomst],
      punten,
      eisen,
      resultaten: uitkomst.resultaten,
      statistiek: uitkomst.stat,
      resterend: Math.max(0, ruimte.limiet - plekBeoordeling.gebruikt - 1),
      limiet: ruimte.limiet,
    },
  };
}
