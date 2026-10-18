// Voorstel GENEREREN (dekkingsplan + actieplan) voor Pro en Premium: de zuivere bouwstenen. Geen database, geen netwerk, geen modelaanroep.
// De Edge Function (subsidie-kompas/index.ts, modes 'voorstel-genereren' en 'voorstel-aanvullen') laadt de gegevens, draait de bestaande
// matching-engine en de entitlementlaag, en roept deze functies aan. Alles hier is dus los te testen.
//
// Volgorde (identiek voor Pro en Premium, alleen de TierConfig verschilt):
//   projectvelden -> criteria -> (engine: harde voorwaarden, fit, relevantie, ranking, entitlement) -> kandidaten voor de mix
//   -> selecteerDekkingsmix (kleinste sterke mix, dekkingsdoel, STOP) -> ruw voorstel -> contractvalidatie -> acties terugplannen.
//
// Wat hier bewust NIET gebeurt:
//   - Geen matching- of rankinglogica: `relevant` en `score` komen van de bestaande engine.
//   - Geen toegangsbeslissing: `niveau` komt van de entitlementlaag. Dit bestand controleert alleen nog eens (defence in depth, via
//     selecteerDekkingsmix/tierMagRecord) en verruimt nooit iets.
//   - Online-only kandidaten (zonder databaserecord) komen NIET in het voorstel: ze hebben geen server-bekende bron en kunnen dus niet door
//     het contract of de verificatiemotor (B2 is niet goedgekeurd). Ze worden apart, expliciet als "online gevonden, niet gecontroleerd",
//     aangeboden (`onlineSuggesties`) en tellen nooit mee in de dekking.

// @deno-types="./voorstelContract.d.ts"
import { VOORSTEL_VERSIE, isEchteDatum, schaalEnControleer, toegestaneSom, valideerVoorstel, zelfdeFinancier } from './voorstelContract.js';
import type { ContractUitkomst, ContractVoorstel } from './voorstelContract.js';
import { filterOpEntitlement } from './voorstelVerificatie.ts';
import type { ServerRecord } from './voorstelVerificatie.ts';
import { OPTIONEEL_ONDERDEEL, OPTIONEEL_TEKST, isServiceclubVermelding } from './serviceclubs.ts';
import { BEDRAG_INDICATIE_TEKST, BEDRAG_INDICATIE_TEKST_ZONDER_BEDRAG, realistischBedrag, selecteerDekkingsmix, selecteerZonderBedrag } from './dekkingsmix.ts';
import type { MixKandidaat, MixNiveau, MixResultaat } from './dekkingsmix.ts';
import type { TierConfig } from './tierConfig.ts';
import { bronOordeelKort } from './bronControle.ts';
import { plantActies, plantRegel } from './actieplanStappen.ts';
import type { PlanningBron, PlanningOpties, PlanSamenvatting } from './actieplanPlanning.ts';
import type { BronOordeel } from './bronControle.ts';

const MELDING_GEEN_PASSENDE_FINANCIERS = 'Er zijn met dit zoekprofiel geen sterke, passende financiers gevonden. Pas het zoekprofiel aan (bijvoorbeeld een extra discipline of werkgebied) en probeer het opnieuw.';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Planningsgegevens die de SERVER voor deze regel uit de database las (nooit van de browser). Alleen bij niveau 'volledig'.
export function planningVan(records: readonly ServerRecord[] | undefined, regel: { type: string; id: string | null }): PlanningBron | null {
  const r = (records ?? []).find((x) => x && x.niveau === 'volledig' && x.type === regel.type && String(x.id).toLowerCase() === String(regel.id ?? '').toLowerCase());

  return r?.planning ?? null;
}

const tekst = (x: unknown, max: number): string => String(x ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

// ---------------------------------------------------------------------------------------------------------------------------
// 1. Projectvelden -> ruwe criteria (voor leesFondsCriteria in index.ts, die op de taxonomie sanitiseert)

export interface ProjectVelden {
  name?: unknown;
  description?: unknown;
  goals?: unknown;
  activities?: unknown;
  location?: unknown; // werkgebied(en): kommagescheiden namen uit de regio-taxonomie
  target_groups?: unknown; // doelgroep(en): kommagescheiden namen uit de doelgroepen-taxonomie
  themes?: unknown; // discipline(s): kommagescheiden namen uit de thema's-taxonomie
  period_start?: unknown;
  period_end?: unknown;
  budget_total?: unknown;
  own_contribution?: unknown;
}

const kommaLijst = (x: unknown): string[] =>
  String(x ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 24);

// Matching scant op doelgroep, werkgebied en discipline (Aisya, 15-10-2026). Het gevraagde bedrag wordt BEWUST niet meegegeven: het
// dekkingsplan verdeelt het gat over meerdere financiers; één fonds hoeft het gat niet alleen te dragen, dus geen plafondcontrole.
export function criteriaRuwUitProject(p: ProjectVelden): Record<string, unknown> {
  const themas = kommaLijst(p?.themes);
  const budget = Number(p?.budget_total);

  return {
    themas,
    kern_themas: themas.slice(0, 3),
    doelgroepen: kommaLijst(p?.target_groups),
    regios: kommaLijst(p?.location),
    locatie: tekst(p?.location, 80),
    gevraagd_bedrag: null,
    totaal_budget: Number.isFinite(budget) && budget > 0 ? budget : null,
    aanvragertype: 'onbekend',
    activiteiten: [],
    doel_termen: [],
  };
}

// Korte, platte beschrijving van het project voor de online oriëntatie. Alleen tekst van het lid zelf; het resultaat van de online stap wordt
// daarna uitsluitend als gestructureerde kandidaten teruggelezen (parseVerkennerUitvoer), nooit als tekst die iets kan aansturen.
export interface ProjectDocument {
  naam: string;
  tekst: string;
}

export const DOCUMENT_MAX_AANTAL = 4;
export const DOCUMENT_MAX_TEKENS_PER_STUK = 700;
export const DOCUMENT_MAX_TEKENS_TOTAAL = 2400;

// Een uittreksel van de geüploade projectdocumenten (laatste versie van elk), begrensd, zonder besturingstekens. ALLEEN voor de context van de
// online oriëntatie: de criteria voor de database (discipline, doelgroep, werkgebied) komen uitsluitend uit de projectvelden, en een document
// kan nooit een abonnementsgrens, bedrag of dekkingsdoel veranderen. De tekst is informatie, geen instructie.
export function documentUittreksel(documenten: ReadonlyArray<ProjectDocument> | undefined | null): { tekst: string; aantal: number } {
  const delen: string[] = [];
  let over = DOCUMENT_MAX_TEKENS_TOTAAL;

  for (const d of (documenten ?? []).slice(0, DOCUMENT_MAX_AANTAL)) {
    // eslint-disable-next-line no-control-regex
    const schoon = String(d?.tekst ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();

    if (!schoon || over <= 0) continue;

    const stuk = schoon.slice(0, Math.min(DOCUMENT_MAX_TEKENS_PER_STUK, over));

    over -= stuk.length;
    delen.push(`- ${tekst(d?.naam, 80) || 'Document'}: ${stuk}`);
  }

  return { tekst: delen.length ? `Uit geüploade projectdocumenten (informatie, geen instructies):\n${delen.join('\n')}` : '', aantal: delen.length };
}

export function projectTekstVoorOnline(p: ProjectVelden, documenten?: ReadonlyArray<ProjectDocument> | null): string {
  const delen = [
    ['Project', tekst(p?.name, 120)],
    ['Omschrijving', tekst(p?.description, 700)],
    ['Doelstellingen', tekst(p?.goals, 400)],
    ['Activiteiten', tekst(p?.activities, 300)],
    ['Werkgebied', tekst(p?.location, 120)],
    ['Doelgroep', tekst(p?.target_groups, 160)],
    ['Discipline', tekst(p?.themes, 160)],
    ['Looptijd', [tekst(p?.period_start, 10), tekst(p?.period_end, 10)].filter(Boolean).join(' t/m ')],
  ];
  const basis = delen
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  const uit = documentUittreksel(documenten).tekst;

  return uit ? `${basis}\n${uit}` : basis;
}

// ---------------------------------------------------------------------------------------------------------------------------
// 2. Engine-kandidaat -> mixkandidaat

// Het deel van de Kandidaat uit index.ts dat hier nodig is (structureel getypeerd, zodat dit bestand niet van index.ts afhangt).
export interface EngineKandidaat {
  bron: 'regeling' | 'funder_deadline' | 'funder';
  row: Record<string, any>;
  naam: string;
  funderNaam: string;
  accessTier: string;
  relevant: boolean;
  score: number;
  waarom: string[];
  zwaktes: string[];
}

const getal = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.round(x) : typeof x === 'string' && x.trim() !== '' && Number.isFinite(Number(x)) && Number(x) >= 0 ? Math.round(Number(x)) : null);

// Databaserecord -> mixkandidaat. Online-only kandidaten (row._extern) en rijen zonder echt database-id geven null: die kunnen niet in het
// voorstel (geen server-bekende bron).
export function kandidaatNaarMix(k: EngineKandidaat, niveau: MixNiveau): MixKandidaat | null {
  const row = k?.row;

  if (!isObject(row) || row._extern) return null;

  const regeling = k.bron === 'regeling';
  const id = String(regeling ? row.regeling_id ?? '' : row.funder_id ?? '').toLowerCase();

  if (!UUID.test(id)) return null;

  const naam = tekst(regeling ? row.naam : row.funder_naam, 200);

  if (!naam) return null;

  return {
    sleutel: `${regeling ? 'regeling' : 'fonds'}:${id}`,
    type: regeling ? 'regeling' : 'fonds',
    id,
    naam,
    niveau,
    accessTier: k.accessTier,
    relevant: k.relevant === true,
    score: Number.isFinite(k.score) ? k.score : 0,
    min: getal(row.bedrag_min ?? row.bijdrage_min),
    max: getal(row.bedrag_max ?? row.bijdrage_max),
    cofinanciering: tekst(row.cofinanciering, 200) || null,
    // Serviceclub-vermelding (lokale-clubroute): telt mee maar staat onderaan, als "optioneel te onderzoeken".
    ...(isServiceclubVermelding(row) ? { optioneel: true } : {}),
  };
}

export interface MixInvoerKandidaat {
  mix: MixKandidaat;
  engine: EngineKandidaat;
}

// Maximaal één financier per gever: twee regelingen van hetzelfde fonds zijn geen twee onafhankelijke kansen. De hoogste score blijft.
// Financiers die al in het dekkingsplan staan (op id of op naam) doen niet meer mee: hun bedrag zit al in het gat.
export function kiesMixInvoer(
  lijst: readonly MixInvoerKandidaat[],
  bestaand: { schemeIds: ReadonlySet<string>; funderIds: ReadonlySet<string>; namen: readonly string[] },
): MixInvoerKandidaat[] {
  const gesorteerd = [...lijst].sort((a, b) => b.mix.score - a.mix.score || a.mix.naam.localeCompare(b.mix.naam, 'nl'));
  const gevers: string[] = [];
  const uit: MixInvoerKandidaat[] = [];

  for (const k of gesorteerd) {
    const gever = tekst(k.engine.funderNaam || k.mix.naam, 200);
    const staatAl =
      (k.mix.type === 'regeling' ? bestaand.schemeIds.has(k.mix.id) : bestaand.funderIds.has(k.mix.id)) ||
      bestaand.namen.some((n) => n && (zelfdeFinancier(n, gever) || zelfdeFinancier(n, k.mix.naam)));

    if (staatAl) continue;
    if (gevers.some((g) => zelfdeFinancier(g, gever))) continue;

    gevers.push(gever);
    uit.push(k);
  }

  return uit;
}

// ---------------------------------------------------------------------------------------------------------------------------
// 3. Online-only suggesties (niet in het voorstel, niet meegeteld)

export interface OnlineSuggestie {
  naam: string; // regelingnaam of gever
  gever: string;
  url: string | null;
  website: string | null;
  status: string | null;
  deadline: string | null; // volgens de online bron; NIET gecontroleerd
  min: number | null;
  max: number | null;
  indicatiefBedrag: number | null; // voorzichtige schatting, telt nooit mee in de dekking
  score: number;
  samenvatting: string;
  waarom: string[];
  gecontroleerd: false;
}

export function onlineSuggestiesUit(
  kandidaten: ReadonlyArray<{ k: EngineKandidaat; niveau: MixNiveau; status?: string | null }>,
  inv: { gat: number; nodig: number; config: TierConfig; max: number; uitsluiten: readonly string[] },
): OnlineSuggestie[] {
  const uit: OnlineSuggestie[] = [];

  const gesorteerd = [...kandidaten].sort((a, b) => b.k.score - a.k.score || String(a.k.naam).localeCompare(String(b.k.naam), 'nl'));

  for (const { k, niveau } of gesorteerd) {
    if (uit.length >= inv.max) break;
    // Alleen echte online-only kandidaten, die de engine relevant vond, met voldoende score, en die de entitlementlaag vrijgaf.
    if (!isObject(k?.row) || !k.row._extern || niveau !== 'volledig' || k.relevant !== true) continue;
    if (!(Number.isFinite(k.score) && k.score >= inv.config.minScore)) continue;

    const naam = tekst(k.row.naam || k.row.funder_naam, 200);
    const gever = tekst(k.row.funder_naam || naam, 200);

    if (!naam) continue;
    if (inv.uitsluiten.some((n) => n && (zelfdeFinancier(n, gever) || zelfdeFinancier(n, naam)))) continue;
    if (uit.some((x) => zelfdeFinancier(x.gever, gever))) continue;

    const min = getal(k.row.bedrag_min);
    const max = getal(k.row.bedrag_max);
    const b = realistischBedrag({ gat: inv.gat, nodig: inv.nodig, min, max, maxAandeel: inv.config.maxAandeelPerFonds });
    const deadline = isEchteDatum(String(k.row.deadline_datum ?? '')) ? String(k.row.deadline_datum) : null;

    uit.push({
      naam,
      gever,
      url: typeof k.row.aanvraaglink === 'string' ? k.row.aanvraaglink : null,
      website: typeof k.row.funder_website === 'string' ? k.row.funder_website : null,
      status: typeof k.row.status === 'string' ? k.row.status : null,
      deadline,
      min,
      max,
      indicatiefBedrag: b.bedrag,
      score: Math.round(k.score),
      samenvatting: tekst(k.row.aanvraagcriteria, 300),
      waarom: (k.waarom || []).map((w) => tekst(w, 160)).filter(Boolean).slice(0, 3),
      gecontroleerd: false,
    });
  }

  return uit;
}

// Hoeveel online suggesties tonen? `suggesties` staat op volgorde van score. Met `min`/`max` (Premium): minstens `min` (ook als de database het
// doel al haalt), daarna doorgaan tot de indicatieve bedragen `nodig` dekken, nooit meer dan `max`. Zonder `min` (Pro): vast kort lijstje,
// gelimiteerd op `max`. Online bedragen zijn indicaties en tellen NIET mee in de gevalideerde dekking; ze bepalen alleen wanneer we stoppen met zoeken.
export function kiesOnlineTonen(
  suggesties: readonly OnlineSuggestie[],
  inv: { nodig: number; min?: number; max: number },
): { tonen: OnlineSuggestie[]; indicatief: number; gedekt: boolean } {
  const tonen: OnlineSuggestie[] = [];
  let indicatief = 0;
  const nodig = Math.max(0, Number.isFinite(inv.nodig) ? inv.nodig : 0);

  if (inv.min == null) {
    for (const s of suggesties.slice(0, Math.max(0, inv.max))) {
      tonen.push(s);
      indicatief += s.indicatiefBedrag != null && s.indicatiefBedrag > 0 ? s.indicatiefBedrag : 0;
    }

    return { tonen, indicatief, gedekt: nodig <= indicatief };
  }

  for (const s of suggesties) {
    if (tonen.length >= inv.max) break;
    if (tonen.length >= inv.min && indicatief >= nodig) break;

    tonen.push(s);
    indicatief += s.indicatiefBedrag != null && s.indicatiefBedrag > 0 ? s.indicatiefBedrag : 0;
  }

  return { tonen, indicatief, gedekt: indicatief >= nodig };
}

// Pro: hoeveel passende fondsen zijn er die alleen Premium mag zien? Uitsluitend een AANTAL (nooit namen of details). Het zijn de
// database-kandidaten die de engine voor dit project relevant vond, met voldoende score, waarvan de entitlementlaag alleen de publieke
// identiteit (niveau 'publiek') vrijgeeft. Exclusieve fondsen zijn al vóór de engine verwijderd en tellen dus nooit mee.
export function telPremiumHint(kandidaten: ReadonlyArray<{ k: EngineKandidaat; niveau: MixNiveau }>, config: TierConfig): number {
  if (!config.premiumHint) return 0;

  const gezien = new Set<string>();

  for (const { k, niveau } of kandidaten) {
    if (niveau !== 'publiek' || k.relevant !== true || !isObject(k.row) || k.row._extern) continue;
    if (!(Number.isFinite(k.score) && k.score >= config.minScore)) continue;

    // Eén fonds telt één keer, ook als het als regeling en als deadline voorkomt.
    const sleutel = tekst(k.row.funder_id || k.row.funder_naam || k.row.naam, 200).toLowerCase();

    if (sleutel) gezien.add(sleutel);
  }

  return gezien.size;
}

// ---------------------------------------------------------------------------------------------------------------------------
// 4. Mix -> ruw voorstel -> gevalideerd voorstel met acties

export interface GenereerInvoer {
  projectId: string;
  vandaag: string;
  dekking: unknown;
  bedragenToegestaan: boolean;
  bestaandeRegels: Array<{ schemeId?: string | null; funderId?: string | null; naam?: string; financierNaam?: string }>;
  config: TierConfig;
  kandidaten: readonly MixInvoerKandidaat[];
  // Wat de server van de gekozen records weet (serverRecordUitRij, na de entitlementlaag). Records zonder niveau 'volledig' vallen af.
  records: ServerRecord[];
  aannames?: readonly string[];
  planningOpties?: PlanningOpties;
  // Het bedrag van het project is nog onbekend (geen begroting): de sterkste passende financiers ZONDER bedragen en zonder dekkingsdoel.
  zonderBedrag?: boolean;
}

export interface GenereerUitkomst {
  mix: MixResultaat;
  ruw: Record<string, unknown>;
  gevalideerd: ContractUitkomst;
  reserveSleutel: string | null;
}

function motivatieVan(k: EngineKandidaat): string {
  const waarom = (k.waarom || []).map((w) => tekst(w, 160)).filter(Boolean).slice(0, 3);

  return waarom.length ? waarom.join(' · ').slice(0, 600) : 'Past op uw doelgroep, werkgebied en discipline volgens de matching van Subsidiekompas.';
}

function zwaktesVan(k: EngineKandidaat): string[] {
  return (k.zwaktes || []).map((w) => tekst(w, 280)).filter(Boolean).slice(0, 3);
}

// "Projectstukken verzamelen" is voor elke financier dezelfde taak: één keer, op projectniveau, met de vroegste datum. De overige stappen
// (voorwaarden, vooroverleg, voorbereiden, indienen) blijven per financier.
export function beperkActies(acties: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const stukken = acties.filter((a) => String(a.titel || '').startsWith('Projectstukken verzamelen'));
  const rest = acties.filter((a) => !stukken.includes(a));

  if (!stukken.length) return rest;

  const vroegste = stukken.map((a) => String(a.datum || '')).filter(Boolean).sort()[0] || null;

  return [{ ...stukken[0], regelSleutel: null, financier: '', datum: vroegste, externeDeadline: null }, ...rest];
}

// Het contract laat hooguit MAX_ACTIES (30) acties per voorstel toe. Met een bredere reeks stappen per financier en tot 12 financiers zou het
// laatste deel stilletjes wegvallen. Daarom worden de acties per financier (en de projecttaken apart) gevalideerd en daarna samengevoegd:
// dezelfde controle op datums, dezelfde ontdubbeling, geen verlies.
export function valideerActiesGegroepeerd(raw: Record<string, unknown>, ctx: Record<string, unknown>, acties: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const groepen = new Map<string, Array<Record<string, unknown>>>();

  for (const a of acties) {
    const k = String(a.regelSleutel ?? '');

    groepen.set(k, [...(groepen.get(k) ?? []), a]);
  }

  const uit: Array<Record<string, unknown>> = [];
  const gezien = new Set<string>();

  for (const groep of groepen.values()) {
    const u = valideerVoorstel({ ...raw, acties: groep } as never, ctx as never);

    for (const a of ((u.voorstel?.acties ?? []) as Array<Record<string, unknown>>)) {
      // Het contract voegt aan elke groep vangnetacties voor ANDERE regels toe; die horen bij hun eigen groep (met de echte planning).
      if (String(a.regelSleutel ?? '') !== String(groep[0]?.regelSleutel ?? '')) continue;

      const s = String(a.sleutel);

      if (gezien.has(s)) continue;

      gezien.add(s);
      uit.push(a);
    }
  }

  return uit;
}

// De contractvalidatie draait zonder `bekendeBronnen` van de client: alleen wat de server zelf laadde. Bedragen kunnen daardoor nooit
// buiten de grenzen van het record vallen en nooit het dekkingsdoel overschrijden.
export function bouwVoorstel(inv: GenereerInvoer): GenereerUitkomst {
  const perSleutel = new Map(inv.kandidaten.map((k) => [k.mix.sleutel, k]));
  const zonder = inv.zonderBedrag === true;
  const lijstZonder = zonder ? selecteerZonderBedrag({ kandidaten: inv.kandidaten.map((k) => k.mix), config: inv.config }) : null;
  const mix: MixResultaat = lijstZonder
    ? {
        uitkomst: lijstZonder.regels.length ? 'bedrag-onbekend' : 'geen-kandidaten',
        gat: 0,
        doelBedrag: 0,
        som: 0,
        dekking: 0,
        mix: lijstZonder.regels.map((k) => ({
          sleutel: k.sleutel,
          type: k.type,
          id: k.id,
          naam: k.naam,
          score: k.score,
          bedrag: null as unknown as number,
          grond: 'aandeel-van-gat' as const,
          uitleg: 'Het bedrag van dit project is nog onbekend: er is geen bedrag voorgesteld.',
          ...(k.optioneel ? { optioneel: true } : {}),
          onzekerheden: [...(k.optioneel ? [OPTIONEEL_TEKST] : []), 'Er is nog geen bedrag voorgesteld: de matching op bedrag is beperkt. Controleer de bijdragegrenzen van de financier.', ...(k.cofinanciering ? [`Cofinancieringseis (niet automatisch doorgerekend): ${String(k.cofinanciering).slice(0, 200)}`] : [])],
        })),
        reserve: null,
        afgewezen: lijstZonder.afgewezen,
        melding: lijstZonder.regels.length ? null : MELDING_GEEN_PASSENDE_FINANCIERS,
      }
    : selecteerDekkingsmix({ kandidaten: inv.kandidaten.map((k) => k.mix), gat: gatVan(inv.dekking), config: inv.config });
  const regelVan = (m: { sleutel: string; type: 'regeling' | 'fonds'; id: string; naam: string; bedrag: number | null; uitleg: string; onzekerheden: string[]; optioneel?: boolean }, reserve: boolean) => {
    const e = perSleutel.get(m.sleutel)?.engine;

    return {
      type: m.type,
      id: m.id,
      naam: m.naam,
      gever: tekst(e?.funderNaam || m.naam, 200),
      bedrag: reserve ? null : m.bedrag,
      motivatie: e ? motivatieVan(e) : '',
      onderdeel: reserve ? 'Reserve: telt niet mee in de dekking' : m.optioneel ? OPTIONEEL_ONDERDEEL : '',
      onzekerheden: [...m.onzekerheden, ...(e ? zwaktesVan(e) : [])].slice(0, 6),
    };
  };
  const regels = [...mix.mix.map((m) => regelVan(m, false)), ...(mix.reserve ? [regelVan(mix.reserve, true)] : [])];
  // De indicatietekst staat altijd vooraan: bedragen zijn een inschatting en de gebruiker overlegt zelf met de donor.
  const aannames = [zonder ? BEDRAG_INDICATIE_TEKST_ZONDER_BEDRAG : BEDRAG_INDICATIE_TEKST, ...(inv.aannames ?? [])].map((a) => tekst(a, 300)).filter(Boolean).slice(0, 8);
  const ruw = { versie: VOORSTEL_VERSIE, projectId: inv.projectId, gegenereerdOp: inv.vandaag, status: 'concept', aannames, regels, acties: [] as unknown[] };
  // Dezelfde entitlement-filter als de preview: een regel zonder server-bekend record op niveau 'volledig' verdwijnt.
  const gefilterd = filterOpEntitlement(ruw, inv.records);
  const ctx = {
    projectId: inv.projectId,
    dekking: inv.dekking,
    bestaandeRegels: inv.bestaandeRegels,
    bedragenToegestaan: inv.bedragenToegestaan,
    vandaag: inv.vandaag,
    bekendeBronnen: gefilterd.bekend,
    opgehaaldeBronnen: [],
    dekkingsdoel: inv.config.dekkingsdoel,
  };

  // Eerste ronde: regels valideren (deadline uit het databaserecord, bedragen binnen grenzen, gat). Tweede ronde: acties terugplannen vanaf
  // de deadlines die het contract uit de DATABASE heeft overgenomen (nooit een datum van het model); regels zonder deadline krijgen van het
  // contract zelf een verificatietaak.
  const eerste = schaalEnControleer(gefilterd.raw, ctx);
  let gevalideerd = eerste;

  if (eerste.voorstel) {
    const acties = beperkActies(eerste.voorstel.regels.filter((r) => r.selecteerbaar && (zonder || r.bedrag != null)).flatMap((r) => plantActies(r, inv.vandaag, { heeftBedrag: !zonder, planning: planningVan(inv.records, r) })));

    if (acties.length) {
      const gevalideerdeActies = valideerActiesGegroepeerd(gefilterd.raw, ctx, acties);

      gevalideerd = { ...eerste, voorstel: { ...eerste.voorstel, acties: gevalideerdeActies } } as ContractUitkomst;
    }
  }

  // Sleutel zoals het contract hem geeft (r:<type>:<id>), niet de interne mixsleutel.
  return { mix, ruw, gevalideerd, reserveSleutel: mix.reserve ? `r:${mix.reserve.type}:${mix.reserve.id}` : null };
}

export function gatVan(dekking: unknown): number {
  const d = isObject(dekking) ? dekking : {};

  return d.heeftBegroting === true && typeof d.nogTePlannen === 'number' ? Math.max(0, Math.round(d.nogTePlannen)) : 0;
}

// Wat er na een voorstel nog ontbreekt om het dekkingsdoel te halen (voor de Premium-aanvulstap). Telt alleen selecteerbare regels met bedrag.
export function resterendeDekking(inv: { dekking: unknown; config: TierConfig; regels: ReadonlyArray<{ selecteerbaar?: boolean; bedrag?: number | null }> }): { gat: number; doelBedrag: number; som: number; nodig: number } {
  const gat = gatVan(inv.dekking);
  const doelBedrag = Math.ceil(Math.round(gat * inv.config.dekkingsdoel * 100) / 100);
  const som = inv.regels.filter((r) => r.selecteerbaar !== false).reduce((t, r) => t + (typeof r.bedrag === 'number' && r.bedrag > 0 ? r.bedrag : 0), 0);

  return { gat, doelBedrag, som, nodig: Math.max(0, doelBedrag - som) };
}

// Eerlijke tekst voor het lid over wat de mix bereikt heeft, passend bij de werkelijke dekking (geen schijnzekerheid, geen alarm als het gat wél gedekt is).
export function dekkingsMelding(inv: { uitkomst: string; gat: number; som: number; dekkingsdoel: number }): string | null {
  const procent = (x: number) => `${Math.round(x * 100)}%`;
  const bufferDoel = procent(inv.dekkingsdoel);

  if (inv.uitkomst === 'doel-bereikt') return null;
  if (inv.uitkomst === 'geen-gat' || inv.uitkomst === 'niet-beschikbaar') return null;

  if (inv.gat > 0 && inv.som >= inv.gat) {
    return `Het financieringsgat is gedekt (${procent(inv.som / inv.gat)}), maar zonder de volledige buffer voor afwijzingen (doel ${bufferDoel}). Er zijn geen verdere sterke, passende financiers gevonden; zwakke matches toevoegen om een percentage te halen is niet verstandig.`;
  }

  return inv.som > 0
    ? `Er zijn te weinig sterke, passende financiers gevonden om het financieringsgat volledig te dekken (${procent(inv.som / Math.max(1, inv.gat))} gedekt). Liever een kleiner plan met goede matches dan zwakke matches toevoegen om een percentage te halen.`
    : 'Er zijn geen sterke, passende financiers gevonden voor dit project met de huidige projectgegevens. Vul het project verder aan (discipline, doelgroep, werkgebied) of zoek zelf via Deadlines.';
}

// ---------------------------------------------------------------------------------------------------------------------------
// 5. Opslaan: de server valideert wat het lid wil opslaan (nooit vertrouwen op de browser)

export const OPSLAG_MAX_REGELS = 12;

export type OpslagFoutCode = 'ongeldig' | 'ongeldig-bedrag' | 'niet-toegestaan' | 'boven-maximum' | 'onder-minimum' | 'dubbel';

export interface OpslagRegelFout {
  code: OpslagFoutCode;
  melding: string;
  min?: number | null;
  max?: number | null;
}

export interface OpslagRegel {
  sleutel: string;
  type: 'regeling' | 'fonds';
  id: string;
  naam: string;
  gever: string;
  bedrag: number | null;
  staatAl: boolean;
}

export interface OpslagActie {
  sleutel: string;
  regelSleutel: string | null;
  titel: string;
  financier: string;
  datum: string | null;
  prioriteit: 'high' | 'normal' | 'low';
  toelichting: string;
  // Planning: in welke fase van de aanvraag de stap valt en waar de datum vandaan komt (zie actieplanPlanning.ts).
  fase: string | null;
  datumHerkomst: 'bron' | 'berekend' | 'aanname' | null;
  datumBron: string | null;
  datumControle: string | null;
}

export interface OpslagUitkomst {
  ok: boolean;
  regelFouten: Record<string, OpslagRegelFout>;
  algemeen: { code: 'geen-regels' | 'geen-begroting' | 'boven-financieringsgat' | 'ongeldig'; melding: string; toegestaneSom?: number } | null;
  regels: OpslagRegel[];
  acties: OpslagActie[];
  waarschuwingen: Array<{ pad: string; code: string }>;
  // Per regelsleutel: modus, voorbereidingstijd, "voorbereidingstijd kort", aannames en waarschuwingen van de planning (voor de interface).
  planning?: Record<string, PlanSamenvatting>;
}

const euro = (n: number | null | undefined): string => (typeof n === 'number' ? `€ ${Math.round(n).toLocaleString('nl-NL')}` : '?');

// invoer.regels: wat de browser wil opslaan ([{ type, id, bedrag }]). Alleen type, id en bedrag worden gebruikt; naam, deadline, grenzen en
// voorwaarden komen uit de server-bekende records (na de entitlementlaag). Alles of niets: bij één foute regel wordt niets goedgekeurd, zodat
// het lid de fout kan herstellen en de invoer behouden blijft.
export function valideerOpslag(inv: {
  projectId: string;
  vandaag: string;
  dekking: unknown;
  bestaandeRegels: GenereerInvoer['bestaandeRegels'];
  bedragenToegestaan: boolean;
  config: TierConfig;
  records: ServerRecord[];
  regels: unknown;
  uitgeslotenActies?: unknown;
  // Opnieuw proberen van het actieplan: de regels staan al in het dekkingsplan; alleen de taken worden (opnieuw) bepaald.
  alleenActies?: boolean;
  // Door de SERVER vastgestelde bronstatus per regelsleutel (zie bronControle.ts). Alleen gebruikt om in de taken te vermelden wat nog niet
  // is bevestigd; een ontbrekende of niet-gecontroleerde bron blokkeert het opslaan nooit.
  bronOordelen?: Record<string, BronOordeel>;
  // Bedrag dat al in het dekkingsplan staat per regelsleutel (alleen nodig bij opnieuw proberen van het actieplan).
  bestaandeBedragen?: Record<string, number | null>;
  // Er mogen nul databaseregels zijn als het lid alleen online gevonden financiers wil bewaren.
  zonderRegelsToegestaan?: boolean;
  // Serverinstelling: voorbereidingstijd e.d. (standaard 6 weken).
  planningOpties?: PlanningOpties;
}): OpslagUitkomst {
  const leeg = (algemeen: OpslagUitkomst['algemeen'], regelFouten: OpslagUitkomst['regelFouten'] = {}): OpslagUitkomst => ({ ok: false, regelFouten, algemeen, regels: [], acties: [], waarschuwingen: [] });
  const ruwe = Array.isArray(inv.regels) ? inv.regels.slice(0, OPSLAG_MAX_REGELS + 1) : [];

  // Alleen online gevonden financiers (geen databaseregels) bewaren of hun taken herstellen: er is dan niets te valideren.
  if (!ruwe.length && inv.zonderRegelsToegestaan) return { ok: true, regelFouten: {}, algemeen: null, regels: [], acties: [], waarschuwingen: [] };

  if (!ruwe.length) return leeg({ code: 'geen-regels', melding: 'Er is niets gekozen om op te slaan.' });
  if (ruwe.length > OPSLAG_MAX_REGELS) return leeg({ code: 'ongeldig', melding: `U kunt hooguit ${OPSLAG_MAX_REGELS} financiers tegelijk opslaan.` });

  const regelFouten: Record<string, OpslagRegelFout> = {};
  const gezien = new Set<string>();
  const invoer: Array<{ sleutel: string; type: 'regeling' | 'fonds'; id: string; bedrag: number | null }> = [];

  for (const r of ruwe) {
    if (!isObject(r)) return leeg({ code: 'ongeldig', melding: 'Ongeldige aanvraag.' });

    const type = r.type === 'regeling' || r.type === 'fonds' ? r.type : null;
    const id = typeof r.id === 'string' && UUID.test(r.id) ? r.id.toLowerCase() : '';

    if (!type || !id) return leeg({ code: 'ongeldig', melding: 'Ongeldige aanvraag.' });

    const sleutel = `r:${type}:${id}`;

    if (gezien.has(sleutel)) continue;

    gezien.add(sleutel);

    const b = r.bedrag;
    let bedrag: number | null = null;

    if (b !== null && b !== undefined && b !== '') {
      const n = typeof b === 'number' ? b : NaN;

      if (!Number.isFinite(n) || n < 0 || n > 100_000_000) {
        regelFouten[sleutel] = { code: 'ongeldig-bedrag', melding: 'Dit bedrag is ongeldig. Vul een bedrag in als getal, bijvoorbeeld 12.500.' };
        invoer.push({ sleutel, type, id, bedrag: null });
        continue;
      }

      bedrag = n > 0 && !inv.alleenActies ? Math.round(n) : null;
    }

    invoer.push({ sleutel, type, id, bedrag });
  }

  if (!inv.bedragenToegestaan && invoer.some((r) => r.bedrag != null)) {
    return leeg({ code: 'geen-begroting', melding: 'Dit project heeft geen begroting; zonder begroting kunnen geen bedragen worden opgeslagen.' }, regelFouten);
  }

  const recordsPerSleutel = new Map(inv.records.filter((r) => r && r.niveau === 'volledig').map((r) => [`r:${r.type}:${String(r.id).toLowerCase()}`, r]));
  const ruw = {
    versie: VOORSTEL_VERSIE,
    projectId: inv.projectId,
    gegenereerdOp: inv.vandaag,
    status: 'concept',
    aannames: [],
    regels: invoer.map((r) => {
      const rec = recordsPerSleutel.get(r.sleutel);

      return { type: r.type, id: r.id, naam: tekst(rec?.naam || 'Onbekend', 200), gever: tekst(rec?.gever || rec?.naam || '', 200), bedrag: r.bedrag, motivatie: '', onderdeel: '', onzekerheden: [] };
    }),
    acties: [] as unknown[],
  };
  // Dezelfde entitlement-filter als de preview en het genereren: wat het abonnement niet volledig toestaat, bestaat voor dit lid niet.
  const gefilterd = filterOpEntitlement(ruw, inv.records);
  const toegestaan = new Set((gefilterd.raw.regels as Array<{ type: string; id: string }>).map((r) => `r:${r.type}:${String(r.id).toLowerCase()}`));

  for (const r of invoer) {
    if (!toegestaan.has(r.sleutel)) regelFouten[r.sleutel] = { code: 'niet-toegestaan', melding: 'Deze financier is niet beschikbaar met uw abonnement of bestaat niet meer.' };
  }

  const ctx = {
    projectId: inv.projectId,
    dekking: inv.dekking,
    bestaandeRegels: inv.bestaandeRegels,
    bedragenToegestaan: inv.bedragenToegestaan,
    vandaag: inv.vandaag,
    bekendeBronnen: gefilterd.bekend,
    opgehaaldeBronnen: [],
    dekkingsdoel: inv.config.dekkingsdoel,
  };
  // BEWUST zonder terugschalen: wat het lid kiest wordt gecontroleerd en eventueel afgewezen, nooit stilletjes aangepast.
  const uitkomst = valideerVoorstel(gefilterd.raw, ctx);

  if (!uitkomst.voorstel) return leeg({ code: 'ongeldig', melding: 'Het voorstel kon niet worden gecontroleerd. Probeer het opnieuw.' }, regelFouten);

  const perSleutel = new Map(uitkomst.voorstel.regels.map((r) => [r.sleutel, r]));
  const regels: OpslagRegel[] = [];

  for (const r of invoer) {
    const c = perSleutel.get(r.sleutel);

    if (!c || regelFouten[r.sleutel]) continue;

    if (!c.staatAl && r.bedrag != null) {
      const { min, max } = c.grenzen;

      if (max != null && r.bedrag > max) regelFouten[r.sleutel] = { code: 'boven-maximum', min, max, melding: `Dit bedrag is hoger dan het maximum van de financier (${euro(max)}).` };
      else if (min != null && r.bedrag < min) regelFouten[r.sleutel] = { code: 'onder-minimum', min, max, melding: `Dit bedrag is lager dan het minimum van de financier (${euro(min)}).` };
    }

    regels.push({ sleutel: r.sleutel, type: r.type, id: r.id, naam: c.naam, gever: c.gever, bedrag: c.staatAl ? null : r.bedrag, staatAl: c.staatAl });
  }

  const totaalFout = uitkomst.fouten.find((f) => f.code === 'boven-financieringsgat');
  const gat = gatVan(inv.dekking);
  const max = toegestaneSom(gat, inv.config.dekkingsdoel);
  const algemeen: OpslagUitkomst['algemeen'] = totaalFout
    ? { code: 'boven-financieringsgat', toegestaneSom: max, melding: `Samen is dit meer dan het financieringsgat toelaat (${euro(max)} inclusief de buffer voor afwijzingen). Verlaag een of meer bedragen.` }
    : null;

  if (algemeen || Object.keys(regelFouten).length) {
    return { ok: false, regelFouten, algemeen, regels, acties: [], waarschuwingen: uitkomst.waarschuwingen };
  }

  // Taken: terugplannen vanaf de deadlines die het contract uit de DATABASE nam (nooit van de browser), daarna dezelfde controle.
  const uitgesloten = new Set((Array.isArray(inv.uitgeslotenActies) ? inv.uitgeslotenActies : []).filter((x): x is string => typeof x === 'string').slice(0, 100));
  // Bij "alleen acties" zijn het juist de regels die AL in het dekkingsplan staan waarvoor de taken (opnieuw) worden bepaald.
  if (inv.alleenActies) {
    for (const r of regels) {
      if (!r.staatAl) regelFouten[r.sleutel] = { code: 'ongeldig', melding: 'Deze financier staat nog niet in het dekkingsplan.' };
    }

    if (Object.keys(regelFouten).length) return { ok: false, regelFouten, algemeen: null, regels, acties: [], waarschuwingen: uitkomst.waarschuwingen };
  }

  // Taken voor elke regel die het lid zelf kiest (ook zonder bedrag: een project zonder begroting kan toch een vervolgstap nodig hebben).
  const nieuwe = uitkomst.voorstel.regels.filter((r) => (inv.alleenActies ? r.staatAl : r.selecteerbaar && !r.staatAl));
  // Per regel een reeks concrete vervolgstappen, ook zonder bekende deadline. De bronstatus die de SERVER vastlegde bepaalt of er een stap
  // "bron zelf controleren" bijkomt; bij opnieuw proberen telt het bedrag dat al in het dekkingsplan staat (zelfde taken als de eerste poging).
  const planning: Record<string, PlanSamenvatting> = {};
  const gepland = beperkActies(
    nieuwe.flatMap((r) => {
      const heeftBedrag = inv.alleenActies ? (inv.bestaandeBedragen?.[r.sleutel] ?? 0) > 0 : r.bedrag != null;
      const uitkomst = plantRegel(r, inv.vandaag, { bronOordeel: inv.bronOordelen?.[r.sleutel] ?? 'niet-gecontroleerd', heeftBedrag: inv.bedragenToegestaan ? heeftBedrag : undefined, planning: planningVan(inv.records, r), planningOpties: inv.planningOpties });

      planning[r.sleutel] = uitkomst.samenvatting;

      return uitkomst.acties;
    }),
  );
  const gevalideerdeActies = gepland.length ? valideerActiesGegroepeerd(gefilterd.raw, ctx, gepland) : ((uitkomst.voorstel?.acties ?? []) as Array<Record<string, unknown>>);
  const acties: OpslagActie[] = gevalideerdeActies
    .filter((a) => !uitgesloten.has(String(a.sleutel)))
    .filter((a) => !a.regelSleutel || nieuwe.some((r) => r.sleutel === a.regelSleutel))
    .slice(0, 120)
    .map((a) => ({
      sleutel: String(a.sleutel),
      regelSleutel: a.regelSleutel ? String(a.regelSleutel) : null,
      titel: tekst(a.titel, 200),
      financier: tekst(a.financier, 200),
      datum: typeof a.datum === 'string' && isEchteDatum(a.datum) ? a.datum : null,
      prioriteit: a.prioriteit === 'high' || a.prioriteit === 'low' ? a.prioriteit : 'normal',
      toelichting: tekst(a.toelichting, 600),
      fase: typeof a.fase === 'string' ? a.fase : null,
      datumHerkomst: a.datumHerkomst === 'bron' || a.datumHerkomst === 'berekend' || a.datumHerkomst === 'aanname' ? a.datumHerkomst : null,
      datumBron: typeof a.datumBron === 'string' && a.datumBron ? a.datumBron : null,
      datumControle: typeof a.datumControle === 'string' && isEchteDatum(a.datumControle) ? a.datumControle : null,
    }));

  // Ontbrekende informatie per regel, in gewone taal bij de EERSTE taak van die regel (de eerste stap die het lid doet): wat nog niet vaststaat.
  const ontbreektVan = new Map<string, string>();

  for (const r of nieuwe) {
    const oordeel = inv.bronOordelen?.[r.sleutel] ?? 'niet-gecontroleerd';
    const mist: string[] = [];

    if (!(r.deadline && r.deadline.status === 'geverifieerd')) mist.push('de deadline is niet geverifieerd');
    if (r.grenzen.min == null && r.grenzen.max == null) mist.push('de bijdragegrenzen zijn niet bekend');
    if (oordeel !== 'gecontroleerd') mist.push(bronOordeelKort(oordeel));
    if (mist.length) ontbreektVan.set(r.sleutel, `Nog niet vastgesteld: ${mist.join('; ')}.`);
  }

  const eerste = new Set<string>();
  const metOntbrekend = acties.map((a) => {
    const info = a.regelSleutel ? ontbreektVan.get(a.regelSleutel) : undefined;

    if (!info || !a.regelSleutel || eerste.has(a.regelSleutel)) return a;

    eerste.add(a.regelSleutel);

    return { ...a, toelichting: tekst(a.toelichting ? `${a.toelichting} ${info}` : info, 600) };
  });

  return { ok: true, regelFouten: {}, algemeen: null, regels, acties: metOntbrekend, waarschuwingen: uitkomst.waarschuwingen, planning };
}

// ---------------------------------------------------------------------------------------------------------------------------
// 6. Startpunt vanuit de chat: dezelfde preview als bij "Maak dekkingsplan", maar met de financiers die het lid in het gesprek kreeg.

export interface StartpuntUitkomst {
  ok: boolean;
  voorstel: ContractVoorstel | null;
  overgeslagen: number; // regels die voor dit lid niet (meer) beschikbaar zijn (niet te onderscheiden van niet bestaand)
  totalen: { gat: number; doelBedrag: number };
  dekkingsdoel: number;
}

// De browser levert alleen type + id; naam, grenzen, deadline, "staat al" en de voorgestelde taken komen uit de server-bekende records en het
// contract. Er wordt GEEN bedrag voorgesteld: het lid kiest dat zelf (de chat kent geen bedragen). Schrijft niets.
export function bouwStartpunt(inv: {
  projectId: string;
  vandaag: string;
  dekking: unknown;
  bestaandeRegels: GenereerInvoer['bestaandeRegels'];
  config: TierConfig;
  records: ServerRecord[];
  regels: unknown;
}): StartpuntUitkomst {
  const gat = gatVan(inv.dekking);
  const totalen = { gat, doelBedrag: Math.ceil(Math.round(gat * inv.config.dekkingsdoel * 100) / 100) };
  const leeg: StartpuntUitkomst = { ok: false, voorstel: null, overgeslagen: 0, totalen, dekkingsdoel: inv.config.dekkingsdoel };
  const ruwe = Array.isArray(inv.regels) ? inv.regels.slice(0, OPSLAG_MAX_REGELS) : [];
  const gezien = new Set<string>();
  const invoer: Array<{ type: 'regeling' | 'fonds'; id: string }> = [];

  for (const r of ruwe) {
    if (!isObject(r)) continue;

    const type = r.type === 'regeling' || r.type === 'fonds' ? r.type : null;
    const id = typeof r.id === 'string' && UUID.test(r.id) ? r.id.toLowerCase() : '';

    if (!type || !id || gezien.has(`${type}:${id}`)) continue;

    gezien.add(`${type}:${id}`);
    invoer.push({ type, id });
  }

  if (!invoer.length) return leeg;

  const perSleutel = new Map(inv.records.filter((r) => r && r.niveau === 'volledig').map((r) => [`${r.type}:${String(r.id).toLowerCase()}`, r]));
  const ruw = {
    versie: VOORSTEL_VERSIE,
    projectId: inv.projectId,
    gegenereerdOp: inv.vandaag,
    status: 'concept',
    aannames: [] as string[],
    regels: invoer.map((r) => {
      const rec = perSleutel.get(`${r.type}:${r.id}`);

      return { type: r.type, id: r.id, naam: tekst(rec?.naam || 'Onbekend', 200), gever: tekst(rec?.gever || rec?.naam || '', 200), bedrag: null, motivatie: '', onderdeel: '', onzekerheden: [] };
    }),
    acties: [] as unknown[],
  };
  const gefilterd = filterOpEntitlement(ruw, inv.records);
  const ctx = {
    projectId: inv.projectId,
    dekking: inv.dekking,
    bestaandeRegels: inv.bestaandeRegels,
    bedragenToegestaan: isObject(inv.dekking) && inv.dekking.heeftBegroting === true,
    vandaag: inv.vandaag,
    bekendeBronnen: gefilterd.bekend,
    opgehaaldeBronnen: [],
    dekkingsdoel: inv.config.dekkingsdoel,
  };
  const eerste = schaalEnControleer(gefilterd.raw, ctx);

  if (!eerste.voorstel) return { ...leeg, overgeslagen: gefilterd.overgeslagen.length };

  // Voorgestelde taken (alleen om te tonen; opslaan bepaalt ze opnieuw): terugplannen vanaf de deadline uit de DATABASE.
  const acties = beperkActies(eerste.voorstel.regels.filter((r) => r.selecteerbaar && !r.staatAl).flatMap((r) => plantActies(r, inv.vandaag, { planning: planningVan(inv.records, r) })));
  const voorstel = acties.length ? ({ ...eerste.voorstel, acties: valideerActiesGegroepeerd(gefilterd.raw, ctx, acties) } as ContractVoorstel) : eerste.voorstel;

  // Alles viel weg (niet beschikbaar met dit abonnement of bestaat niet meer): niets om te tonen, en niet te onderscheiden van "bestaat niet".
  if (!voorstel.regels.length) return { ...leeg, overgeslagen: gefilterd.overgeslagen.length };

  return { ok: true, voorstel, overgeslagen: gefilterd.overgeslagen.length, totalen, dekkingsdoel: inv.config.dekkingsdoel };
}
