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
import { VOORSTEL_VERSIE, isEchteDatum, plantTerug, schaalEnControleer, zelfdeFinancier } from './voorstelContract.js';
import type { ContractUitkomst } from './voorstelContract.js';
import { filterOpEntitlement } from './voorstelVerificatie.ts';
import type { ServerRecord } from './voorstelVerificatie.ts';
import { realistischBedrag, selecteerDekkingsmix } from './dekkingsmix.ts';
import type { MixKandidaat, MixNiveau, MixResultaat } from './dekkingsmix.ts';
import type { TierConfig } from './tierConfig.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
export function projectTekstVoorOnline(p: ProjectVelden): string {
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

  return delen
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
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

// De contractvalidatie draait zonder `bekendeBronnen` van de client: alleen wat de server zelf laadde. Bedragen kunnen daardoor nooit
// buiten de grenzen van het record vallen en nooit het dekkingsdoel overschrijden.
export function bouwVoorstel(inv: GenereerInvoer): GenereerUitkomst {
  const perSleutel = new Map(inv.kandidaten.map((k) => [k.mix.sleutel, k]));
  const mix = selecteerDekkingsmix({ kandidaten: inv.kandidaten.map((k) => k.mix), gat: gatVan(inv.dekking), config: inv.config });
  const regelVan = (m: { sleutel: string; type: 'regeling' | 'fonds'; id: string; naam: string; bedrag: number | null; uitleg: string; onzekerheden: string[] }, reserve: boolean) => {
    const e = perSleutel.get(m.sleutel)?.engine;

    return {
      type: m.type,
      id: m.id,
      naam: m.naam,
      gever: tekst(e?.funderNaam || m.naam, 200),
      bedrag: reserve ? null : m.bedrag,
      motivatie: e ? motivatieVan(e) : '',
      onderdeel: reserve ? 'Reserve: telt niet mee in de dekking' : '',
      onzekerheden: [...m.onzekerheden, ...(e ? zwaktesVan(e) : [])].slice(0, 6),
    };
  };
  const regels = [...mix.mix.map((m) => regelVan(m, false)), ...(mix.reserve ? [regelVan(mix.reserve, true)] : [])];
  const aannames = (inv.aannames ?? []).map((a) => tekst(a, 300)).filter(Boolean).slice(0, 8);
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
    const acties = beperkActies(eerste.voorstel.regels.filter((r) => r.selecteerbaar && r.bedrag != null).flatMap((r) => plantTerug(r, inv.vandaag)));

    if (acties.length) {
      const tweede = schaalEnControleer({ ...gefilterd.raw, acties }, ctx);

      if (tweede.voorstel) gevalideerd = tweede;
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
