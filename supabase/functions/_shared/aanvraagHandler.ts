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
//   - Er wordt niets van de aanvraagtekst bewaard of gelogd. Opgeslagen wordt de uitkomst: eisen, status per eis, korte citaten en verbeteringen.
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
import { tierConfigVoor } from './tierConfig.ts';
import { bouwFeiten, fondsSleutel, MIN_FEITEN, planGereedheid, schrijfPlan, sectiesUitCriteria, STANDAARD_SECTIES, type PlanBron } from './projectplan.ts';

export const MAX_BODY_TEKENS = 600_000;
export const MAX_PAGINAS = 2;
export const MAX_FONDSLABEL = 200;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Modus = 'status' | 'eisen-ophalen' | 'criteria-bewaren' | 'beoordelen' | 'plan-schrijven' | 'plan-gereedheid' | 'aanvragen' | 'aanvraag' | 'begroting-voorstel';

const MODI: readonly Modus[] = ['status', 'eisen-ophalen', 'criteria-bewaren', 'beoordelen', 'plan-schrijven', 'plan-gereedheid', 'aanvragen', 'aanvraag', 'begroting-voorstel'];

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

export interface ProfielRij {
  subscription_tier?: unknown;
  subscription_active?: unknown;
  trial_ends_at?: unknown;
  role?: unknown;
}

export interface GebruikMelding {
  userId: string;
  tier: string;
  actie: 'aanvraag_eisen' | 'aanvraag_beoordeling' | 'aanvraag_plan' | 'aanvraag_begroting';
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
  leesPlanBron(userId: string, projectId: string): Promise<PlanBron | null>; // null = niet te lezen
  slaBeoordelingOp(rij: BeoordelingRij): Promise<string | null>; // id van de nieuwe rij, of null bij mislukken
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

    return { status: 200, body: { ok: true, aanvragen: rijen.map(samenvatAanvraag) } };
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

    const bron = await deps.leesPlanBron(userId, pid);

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
  if (modus === 'begroting-voorstel') {
    const pid = typeof body.projectId === 'string' && UUID_RE.test(body.projectId) ? body.projectId.toLowerCase() : '';

    if (!pid) return fout(400, 'ongeldig', 'Ongeldige aanvraag.');

    const tekst = tekstVeld(body.tekst, MAX_TEKENS_VOORSTEL + 1);

    if (tekst.length > MAX_TEKENS_VOORSTEL) return fout(413, 'te-lang', 'Dit antwoord is te lang om in één keer om te zetten. Vraag de chat om de begroting korter samen te vatten.');
    if (tekst.trim().length < 40) return fout(400, 'geen-tekst', 'In dit antwoord staat nog geen begroting. Vraag de chat om de begroting eerst op te stellen.');

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

    let voorstel: Awaited<ReturnType<typeof maakBegrotingVoorstel>>;

    try {
      voorstel = await maakBegrotingVoorstel({ tekst, roep: deps.roep });
    } catch (e) {
      await deps.rondAf(plekBegroting.id, userId, false).catch(() => undefined);
      throw e;
    }

    const bruikbaar = voorstel.gelukt && voorstel.regels.length > 0;

    await deps.rondAf(plekBegroting.id, userId, bruikbaar).catch(() => undefined);

    await deps.meldGebruik({
      userId,
      tier: tierLabel,
      actie: 'aanvraag_begroting',
      projectId: pid,
      model: deps.modelNaam,
      inputTokens: voorstel.usage.prompt_tokens,
      outputTokens: voorstel.usage.completion_tokens,
      duurMs: Date.now() - start,
      succes: bruikbaar,
    });

    if (!voorstel.gelukt) return fout(502, 'ai-mislukt', 'Het omzetten lukte nu niet. Probeer het later opnieuw; er is niets verbruikt van uw maandruimte.');
    if (!bruikbaar) return fout(422, 'geen-regels', 'In dit antwoord staan geen kostenposten om in de begroting te zetten. Er is niets verbruikt van uw maandruimte.');

    return {
      status: 200,
      body: { ok: true, regels: voorstel.regels, statistiek: voorstel.stat, resterend: Math.max(0, ruimteBegroting.limiet - plekBegroting.gebruikt - 1), limiet: ruimteBegroting.limiet },
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
