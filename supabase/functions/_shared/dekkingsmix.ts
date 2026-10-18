// Dekkingsmix: de KLEINSTE sterke combinatie van financiers die het resterende financieringsgat realistisch afdekt, en dan STOP.
// Zuivere functies: geen database, geen netwerk, geen modelaanroep, geen tijd. Alleen invoer -> uitvoer, volledig te testen.
//
// Plaats in de flow (zie rapport 15-10-2026): NA de bestaande keten  projectcriteria -> harde voorwaarden -> fit -> relevantie -> ranking ->
// entitlement,  en VOOR de verificatie van de finalisten. Deze module ziet dus uitsluitend kandidaten die de entitlementlaag al heeft
// gepasseerd, en controleert dat voor de zekerheid nog eens (niveau en access_tier). Ze maakt geen matchbeslissingen: `relevant` en
// `score` komen van de bestaande engine. Premium krijgt hier géén andere kwaliteit dan Pro, alleen een ruimere pool (via de aanroeper) en
// een hoger dekkingsdoel (via TierConfig).
//
// Wat dit NIET doet: geen voorstelregels opslaan, niets naar het voorstelcontract schrijven, geen online zoeken. Het contract
// (voorstelContract.js) schaalt een voorstel nog steeds terug tot maximaal het gat; het dekkingsdoel (Pro 120%, Premium 140%) is hier een
// SELECTIEdoel. Wil het dekkingsplan zelf ook boven het gat uitkomen (omdat afwijzing normaal is), dan moet dat contract bij het
// aansluiten van deze module bewust worden aangepast; dat is nu niet gedaan.
//
// Bedragen zijn geen voorspelling. Er is geen historische toekenningsdata; `realistischBedrag` is een begrensde, voorzichtige heuristiek
// en zegt dat ook (`indicatie: true`). Het maximum van een fonds wordt NOOIT als standaard gebruikt.

import { tierMagRecord } from './tierConfig.ts';
import type { TierConfig } from './tierConfig.ts';
import { OPTIONEEL_TEKST } from './serviceclubs.ts';

export type MixNiveau = 'verborgen' | 'publiek' | 'volledig';

export interface MixKandidaat {
  sleutel: string; // "type:id"
  type: 'regeling' | 'fonds';
  id: string;
  naam: string;
  niveau: MixNiveau; // besluit van de entitlementlaag
  accessTier: unknown; // access_tier van het databaserecord
  relevant: boolean; // door de engine: harde voorwaarden gehaald, passend en actueel
  score: number; // matchscore van de engine, 0-100
  min: number | null;
  max: number | null;
  cofinanciering?: string | null; // tekst; wordt niet doorgerekend maar als onzekerheid meegegeven
  optioneel?: boolean; // serviceclub-vermelding: telt mee in de dekking maar staat helemaal onderaan (zie serviceclubs.ts)
}

export type AfwijsCode =
  | 'dubbel'
  | 'niet-volledig-zichtbaar'
  | 'tier-niet-toegestaan'
  | 'niet-relevant'
  | 'score-te-laag'
  | 'geen-bedragen-bekend'
  | 'ongeldige-grenzen'
  | 'minimum-boven-gat'
  | 'mix-vol'
  | 'boven-doel';

export type BedragGrond = 'aandeel-van-gat' | 'rest-tot-doel' | 'fonds-maximum' | 'fonds-minimum';

export interface RealistischBedrag {
  bedrag: number | null;
  grond: BedragGrond | null;
  afwijsCode: Extract<AfwijsCode, 'geen-bedragen-bekend' | 'ongeldige-grenzen' | 'minimum-boven-gat'> | null;
  uitleg: string;
  indicatie: true; // altijd: dit is een schatting, geen voorspelling
}

export interface MixRegel {
  sleutel: string;
  type: 'regeling' | 'fonds';
  id: string;
  naam: string;
  score: number;
  bedrag: number;
  grond: BedragGrond;
  uitleg: string;
  onzekerheden: string[];
  optioneel?: boolean; // zie MixKandidaat.optioneel
}

export type MixUitkomst = 'bedrag-onbekend' | 'doel-bereikt' | 'onvoldoende-sterke-matches' | 'geen-gat' | 'geen-kandidaten' | 'niet-beschikbaar';

export interface MixResultaat {
  uitkomst: MixUitkomst;
  gat: number;
  doelBedrag: number; // gat x dekkingsdoel, naar boven afgerond
  som: number; // som van de realistische bedragen in de mix (de reserve telt niet mee)
  dekking: number; // som / gat, twee decimalen
  mix: MixRegel[];
  reserve: MixRegel | null; // hooguit één; telt niet mee in som
  afgewezen: Array<{ sleutel: string; code: AfwijsCode }>;
  melding: string | null; // eerlijke tekst voor de gebruiker als het doel niet gehaald is
}

const getal = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.round(x) : null);

// Afronding naar beneden op ronde bedragen: geen schijnnauwkeurigheid (€ 19.847 bestaat niet als realistisch voorstel).
function afrondStap(bedrag: number): number {
  return bedrag < 5_000 ? 100 : bedrag < 50_000 ? 500 : 1_000;
}

const euro = (n: number) => `€ ${n.toLocaleString('nl-NL')}`;

// Realistisch bedrag voor één financier.
//   gat          het totale resterende financieringsgat van het project
//   nodig        wat er nog nodig is om het dekkingsdoel te halen (>= 0); een laatste financier hoeft niet meer te dragen dan dat
//   min, max     bijdragegrenzen uit het databaserecord (null = onbekend)
//   maxAandeel   hoeveel van het totale gat één financier hoogstens draagt (0.5 = de helft)
// Volgorde: aandeel van het gat -> niet meer dan nodig -> binnen het fondsmaximum -> minstens het fondsminimum -> afronden.
// Nooit het fondsmaximum als uitgangspunt: bij maximum €100.000 en gat €40.000 is het voorstel € 20.000, niet € 100.000.
export function realistischBedrag(inv: { gat: number; nodig: number; min: unknown; max: unknown; maxAandeel: number }): RealistischBedrag {
  const gat = getal(inv.gat);
  const nodig = getal(inv.nodig);
  const min = getal(inv.min);
  const max = getal(inv.max);
  const aandeel = typeof inv.maxAandeel === 'number' && inv.maxAandeel > 0 && inv.maxAandeel <= 1 ? inv.maxAandeel : 0.5;
  const nee = (afwijsCode: NonNullable<RealistischBedrag['afwijsCode']>, uitleg: string): RealistischBedrag => ({ bedrag: null, grond: null, afwijsCode, uitleg, indicatie: true });

  if (gat === null || gat <= 0) return nee('geen-bedragen-bekend', 'Er is geen financieringsgat om te dekken.');
  if (min === null && max === null) return nee('geen-bedragen-bekend', 'Bij deze financier zijn geen bijdragegrenzen bekend; er wordt geen bedrag geschat.');
  if (min !== null && max !== null && min > max) return nee('ongeldige-grenzen', 'De bijdragegrenzen in de database zijn tegenstrijdig; er wordt geen bedrag geschat.');
  if (min !== null && min > gat) return nee('minimum-boven-gat', `Het minimum van deze financier (${euro(min)}) is hoger dan het hele financieringsgat.`);

  const aandeelBedrag = Math.floor(gat * aandeel);
  const doelRest = nodig === null ? aandeelBedrag : nodig;
  let grond: BedragGrond = doelRest < aandeelBedrag ? 'rest-tot-doel' : 'aandeel-van-gat';
  let bedrag = Math.min(aandeelBedrag, doelRest);

  if (max !== null && bedrag > max) {
    bedrag = max;
    grond = 'fonds-maximum';
  }

  if (min !== null && bedrag < min) {
    bedrag = min;
    grond = 'fonds-minimum';
  }

  // Afronden naar beneden, maar nooit onder het minimum en nooit tot 0.
  const stap = afrondStap(bedrag);
  const afgerond = Math.floor(bedrag / stap) * stap;

  bedrag = afgerond > 0 && (min === null || afgerond >= min) ? afgerond : bedrag;

  const uitleg =
    grond === 'fonds-maximum'
      ? `Het maximum van deze financier (${euro(max as number)}) ligt onder een evenredig aandeel; het voorstel is dat maximum.`
      : grond === 'fonds-minimum'
        ? `Het minimum van deze financier (${euro(min as number)}) bepaalt het voorstel.`
        : grond === 'rest-tot-doel'
          ? 'Alleen wat nog nodig is om het dekkingsdoel te halen.'
          : `Een voorzichtig aandeel (hoogstens ${Math.round(aandeel * 100)}%) van het financieringsgat; niet het maximum van de financier.`;

  return { bedrag, grond, afwijsCode: null, uitleg, indicatie: true };
}

const stap2 = (n: number) => Math.round(n * 100) / 100;

// Standaardtekst bij elk dekkingsplan: de bedragen zijn een inschatting en geen toezegging of verwachting van de donor.
export const BEDRAG_INDICATIE_TEKST =
  'De genoemde bedragen zijn een inschatting op basis van de gegevens in onze database, geen toezegging. Overleg altijd zelf met de donor of een aanvraag mogelijk is en hoe hoog die mag zijn.';
export const BEDRAG_INDICATIE_TEKST_ZONDER_BEDRAG =
  'Er zijn nog geen bedragen voorgesteld. Overleg altijd zelf met de donor of een aanvraag mogelijk is en hoe hoog die mag zijn.';
// Bij elke regel met een bedrag.
export const BEDRAG_INDICATIE_REGEL = 'Het bedrag is een inschatting (geen historische toekenningsdata): overleg met de donor of een aanvraag mogelijk is en hoe hoog die mag zijn.';

export const MELDING_TE_WEINIG_STERKE_MATCHES =
  'Er zijn te weinig sterke, passende financiers gevonden om het financieringsgat realistisch volledig te dekken. Liever een kleiner plan met goede matches dan zwakke matches toevoegen om een percentage te halen.';

// Wie komt in aanmerking: dezelfde poorten voor de mix met bedragen en voor de lijst zonder bedragen (volledig zichtbaar, tier toegestaan,
// relevant, genoeg score, geen dubbelen). Geeft de geschikte kandidaten (ongesorteerd) en de afgewezen met reden.
export function filterGeschikt(kandidaten: readonly MixKandidaat[], config: TierConfig): { geschikt: MixKandidaat[]; afgewezen: MixResultaat['afgewezen'] } {
  const afgewezen: MixResultaat['afgewezen'] = [];
  const gezien = new Set<string>();
  const geschikt: MixKandidaat[] = [];

  for (const k of kandidaten || []) {
    if (!k || typeof k.sleutel !== 'string') continue;

    const afw = (code: AfwijsCode) => afgewezen.push({ sleutel: k.sleutel, code });

    if (gezien.has(k.sleutel)) {
      afw('dubbel');
      continue;
    }

    gezien.add(k.sleutel);

    // Defence in depth: de entitlementlaag heeft dit al beslist, hier alleen nog eens bevestigen. Publiek niveau heeft geen bedragen
    // en telt nooit mee; verborgen telt nooit mee.
    if (k.niveau !== 'volledig') {
      afw('niet-volledig-zichtbaar');
      continue;
    }

    if (!tierMagRecord(config, k.accessTier)) {
      afw('tier-niet-toegestaan');
      continue;
    }

    if (k.relevant !== true) {
      afw('niet-relevant');
      continue;
    }

    if (!(typeof k.score === 'number' && Number.isFinite(k.score) && k.score >= config.minScore)) {
      afw('score-te-laag');
      continue;
    }

    geschikt.push(k);
  }

  return { geschikt, afgewezen };
}

// Volgorde van de mix: eerst de gewone financiers op score, helemaal onderaan de optionele (serviceclubs), ook als hun score hoger is.
// Binnen elke groep: score aflopend, dan naam, dan sleutel (deterministisch).
export function volgorde(a: MixKandidaat, b: MixKandidaat): number {
  return (a.optioneel ? 1 : 0) - (b.optioneel ? 1 : 0) || b.score - a.score || a.naam.localeCompare(b.naam, 'nl') || a.sleutel.localeCompare(b.sleutel);
}

// Het bedrag van het project is (nog) onbekend: geen mix en geen bedragen, wel de sterkste passende financiers op volgorde van score. Zelfde
// poorten als selecteerDekkingsmix; het aantal is begrensd door de mix-grootte van het abonnement. Nooit een bedrag verzinnen.
export function selecteerZonderBedrag(inv: { kandidaten: readonly MixKandidaat[]; config: TierConfig }): { regels: MixKandidaat[]; afgewezen: MixResultaat['afgewezen'] } {
  if (!inv.config.dekkingsplan || inv.config.maxRegelsInMix <= 0) return { regels: [], afgewezen: [] };

  const { geschikt, afgewezen } = filterGeschikt(inv.kandidaten, inv.config);

  geschikt.sort(volgorde);

  for (const k of geschikt.slice(inv.config.maxRegelsInMix)) afgewezen.push({ sleutel: k.sleutel, code: 'mix-vol' });

  return { regels: geschikt.slice(0, inv.config.maxRegelsInMix), afgewezen };
}

// Selecteert de kleinste sterke mix. `kandidaten` komen uit de engine (al door de entitlementlaag). Volgorde van de invoer is niet
// bepalend: er wordt hier deterministisch op score (aflopend) en naam gesorteerd.
export function selecteerDekkingsmix(inv: { kandidaten: readonly MixKandidaat[]; gat: unknown; config: TierConfig }): MixResultaat {
  const { config } = inv;
  const gat = getal(inv.gat) ?? 0;
  const doelBedrag = Math.ceil(Math.round(gat * config.dekkingsdoel * 100) / 100); // zelfde afronding als toegestaneSom in het contract
  const leeg = (uitkomst: MixUitkomst, melding: string | null = null): MixResultaat => ({ uitkomst, gat, doelBedrag, som: 0, dekking: 0, mix: [], reserve: null, afgewezen: [], melding });

  if (!config.dekkingsplan || config.maxRegelsInMix <= 0) return leeg('niet-beschikbaar');
  if (gat <= 0) return leeg('geen-gat');

  const { geschikt, afgewezen } = filterGeschikt(inv.kandidaten, config);

  if (!geschikt.length) return { ...leeg('geen-kandidaten', MELDING_TE_WEINIG_STERKE_MATCHES), afgewezen };

  geschikt.sort(volgorde);

  const regelVan = (k: MixKandidaat, b: RealistischBedrag): MixRegel => ({
    sleutel: k.sleutel,
    type: k.type,
    id: k.id,
    naam: k.naam,
    score: k.score,
    bedrag: b.bedrag as number,
    grond: b.grond as BedragGrond,
    uitleg: b.uitleg,
    ...(k.optioneel ? { optioneel: true } : {}),
    onzekerheden: [
      ...(k.optioneel ? [OPTIONEEL_TEKST] : []),
      BEDRAG_INDICATIE_REGEL,
      ...(k.cofinanciering ? [`Cofinancieringseis (niet automatisch doorgerekend): ${String(k.cofinanciering).slice(0, 200)}`] : []),
    ],
  });

  const mix: MixRegel[] = [];
  let som = 0;
  let reserve: MixRegel | null = null;

  for (const k of geschikt) {
    // Doel gehaald: STOP met mixen. Alleen nog hooguit één reserve zoeken (telt niet mee).
    if (som >= doelBedrag) {
      // Een optionele serviceclub is nooit reserve: ze wordt alleen gebruikt als de andere financiers het doel niet halen.
      if (k.optioneel) {
        afgewezen.push({ sleutel: k.sleutel, code: 'boven-doel' });
        continue;
      }

      const r = realistischBedrag({ gat, nodig: gat, min: k.min, max: k.max, maxAandeel: config.maxAandeelPerFonds });

      if (r.bedrag !== null) {
        reserve = regelVan(k, r);
        break;
      }

      afgewezen.push({ sleutel: k.sleutel, code: r.afwijsCode as AfwijsCode });
      continue;
    }

    if (mix.length >= config.maxRegelsInMix) {
      afgewezen.push({ sleutel: k.sleutel, code: 'mix-vol' });
      continue;
    }

    const b = realistischBedrag({ gat, nodig: doelBedrag - som, min: k.min, max: k.max, maxAandeel: config.maxAandeelPerFonds });

    if (b.bedrag === null) {
      afgewezen.push({ sleutel: k.sleutel, code: b.afwijsCode as AfwijsCode });
      continue;
    }

    // Een minimum van het fonds mag de mix nooit boven het dekkingsdoel tillen (het contract weigert dat): dan deze overslaan.
    if (som + b.bedrag > doelBedrag) {
      afgewezen.push({ sleutel: k.sleutel, code: 'boven-doel' });
      continue;
    }

    mix.push(regelVan(k, b));
    som += b.bedrag;
  }

  const bereikt = som >= doelBedrag;

  return {
    uitkomst: bereikt ? 'doel-bereikt' : 'onvoldoende-sterke-matches',
    gat,
    doelBedrag,
    som,
    dekking: stap2(som / gat),
    mix,
    // Is het doel niet gehaald, dan is er per definitie niets meer over om als reserve te noemen.
    reserve: bereikt ? reserve : null,
    afgewezen,
    melding: bereikt ? null : MELDING_TE_WEINIG_STERKE_MATCHES,
  };
}
