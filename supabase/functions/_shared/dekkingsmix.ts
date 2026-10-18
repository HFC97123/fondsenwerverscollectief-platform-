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
  band?: string | null; // naam van de bandbreedte (bandbreedtes_bijdrage), bijvoorbeeld '€10.000–€25.000'; alleen gebruikt als er geen eigen minimum is
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

export type BedragGrond = 'aandeel-van-gat' | 'rest-tot-doel' | 'fonds-maximum' | 'fonds-minimum' | 'voorzichtig-laag' | 'laagste-bandbreedte' | 'derde-van-maximum';

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
  reserve: MixRegel | null; // de eerste alternatieve financier (= reserves[0]); telt niet mee in som
  reserves: MixRegel[]; // alternatieven voor als een aanvraag wordt afgewezen (hooguit config.alternatieven); tellen niet mee in som
  afgewezen: Array<{ sleutel: string; code: AfwijsCode }>;
  melding: string | null; // eerlijke tekst voor de gebruiker als het doel niet gehaald is
}

const getal = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.round(x) : null);

// Afronding naar beneden op ronde bedragen: geen schijnnauwkeurigheid (€ 19.847 bestaat niet als realistisch voorstel).
function afrondStap(bedrag: number): number {
  return bedrag < 5_000 ? 100 : bedrag < 50_000 ? 500 : 1_000;
}

const euro = (n: number) => `€ ${n.toLocaleString('nl-NL')}`;

// Ondergrens van een bandbreedte uit bandbreedtes_bijdrage ('€10.000–€25.000' -> 10.000; '€1.000.000+' -> 1.000.000). De laagste band begint
// bij € 0: een fonds waar je niets kunt aanvragen bestaat niet, dus daar geldt de bovengrens (€ 5.000) als laagste bedrag.
export function bandOndergrens(naam: unknown): number | null {
  if (typeof naam !== 'string') return null;

  const getallen = Array.from(naam.matchAll(/\d{1,3}(?:\.\d{3})*/g)).map((m) => Number(m[0].replace(/\./g, ''))).filter((n) => Number.isFinite(n));

  if (!getallen.length) return null;

  return getallen[0] > 0 ? getallen[0] : (getallen[1] ?? null);
}

// Realistisch bedrag voor één financier: een VOORZICHTIGE rekenbasis, geen verwachting. Het bereik dat het fonds noemt (aanvragen kan van ... tot ...)
// is informatie voor het lid; het plan rekent met minder, zodat er ruimte blijft voor andere passende financiers.
//   gat          het totale resterende financieringsgat van het project
//   nodig        wat er nog nodig is om het dekkingsdoel te halen (>= 0); een laatste financier hoeft niet meer te dragen dan dat
//   min, max     bijdragegrenzen uit het databaserecord (null = onbekend)
//   bandOnder    ondergrens van de bandbreedte (alleen gebruikt als er geen eigen minimum is)
//   maxAandeel   hoeveel van het totale gat één financier hoogstens draagt (1/3: zo zijn er altijd minstens drie financiers nodig)
// Rekenbasis: minimum + een derde van het bereik ("voorzichtig laag"); alleen een minimum of band: dat laagste bedrag; alleen een maximum: een
// derde daarvan. Daarna: niet meer dan het aandeel van het gat, niet meer dan nodig, binnen het fondsmaximum, minstens het eigen minimum.
export function realistischBedrag(inv: { gat: number; nodig: number; min: unknown; max: unknown; maxAandeel: number; bandOnder?: unknown }): RealistischBedrag {
  const gat = getal(inv.gat);
  const nodig = getal(inv.nodig);
  const min = getal(inv.min);
  const max = getal(inv.max);
  const bandOnder = getal(inv.bandOnder);
  const aandeel = typeof inv.maxAandeel === 'number' && inv.maxAandeel > 0 && inv.maxAandeel <= 1 ? inv.maxAandeel : 0.5;
  const nee = (afwijsCode: NonNullable<RealistischBedrag['afwijsCode']>, uitleg: string): RealistischBedrag => ({ bedrag: null, grond: null, afwijsCode, uitleg, indicatie: true });
  // De ondergrens: het eigen minimum van het fonds, anders de ondergrens van de bandbreedte.
  const laag = min !== null && min > 0 ? min : bandOnder !== null && bandOnder > 0 ? bandOnder : null;
  const uitBand = !(min !== null && min > 0) && laag !== null;

  if (gat === null || gat <= 0) return nee('geen-bedragen-bekend', 'Er is geen financieringsgat om te dekken.');
  if (laag === null && (max === null || max <= 0)) return nee('geen-bedragen-bekend', 'Bij deze financier zijn geen bijdragegrenzen bekend; er wordt geen bedrag geschat.');
  if (min !== null && max !== null && min > max) return nee('ongeldige-grenzen', 'De bijdragegrenzen in de database zijn tegenstrijdig; er wordt geen bedrag geschat.');
  if (laag !== null && laag > gat) return nee('minimum-boven-gat', `${uitBand ? 'De laagste waarde van de bandbreedte' : 'Het minimum'} van deze financier (${euro(laag)}) is hoger dan het hele financieringsgat.`);

  const aandeelBedrag = Math.floor(gat * aandeel);
  const doelRest = nodig === null ? aandeelBedrag : nodig;
  let basis: number;
  let grond: BedragGrond;

  if (laag !== null && max !== null && max > laag) {
    basis = laag + (max - laag) / 3;
    grond = 'voorzichtig-laag';
  } else if (laag !== null) {
    basis = max !== null && max > 0 && max < laag ? max : laag;
    grond = uitBand ? 'laagste-bandbreedte' : 'fonds-minimum';
  } else {
    basis = (max as number) / 3;
    grond = 'derde-van-maximum';
  }

  let bedrag = Math.floor(basis);

  if (bedrag > aandeelBedrag) {
    bedrag = aandeelBedrag;
    grond = 'aandeel-van-gat';
  }

  if (bedrag > doelRest) {
    bedrag = doelRest;
    grond = 'rest-tot-doel';
  }

  if (max !== null && max > 0 && bedrag > max) {
    bedrag = max;
    grond = 'fonds-maximum';
  }

  if (laag !== null && bedrag < laag) {
    bedrag = laag;
    grond = uitBand ? 'laagste-bandbreedte' : 'fonds-minimum';
  }

  // Afronden naar beneden, maar nooit onder de ondergrens en nooit tot 0.
  const stap = afrondStap(bedrag);
  const afgerond = Math.floor(bedrag / stap) * stap;

  bedrag = afgerond > 0 && (laag === null || afgerond >= laag) ? afgerond : bedrag;

  const bereik = laag !== null && max !== null && max > laag ? `${euro(laag)} tot ${euro(max)}` : null;
  const uitleg =
    grond === 'voorzichtig-laag'
      ? `Een voorzichtig bedrag in het laagste deel van wat deze financier noemt (${bereik}); niet het maximum.`
      : grond === 'laagste-bandbreedte'
        ? `Het laagste bedrag van de bandbreedte van deze financier (${euro(laag as number)}); de bandbreedte is een indicatie.`
        : grond === 'derde-van-maximum'
          ? `Alleen een maximum is bekend (${euro(max as number)}); het voorstel is een derde daarvan.`
          : grond === 'fonds-minimum'
            ? `Het minimum van deze financier (${euro(laag as number)}) bepaalt het voorstel.`
            : grond === 'fonds-maximum'
              ? `Het maximum van deze financier (${euro(max as number)}) ligt onder de rekenbasis; het voorstel is dat maximum.`
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

// Breedte van een scoreband bij Premium (rangschikOpBijdrage): kandidaten binnen dezelfde band van 10 punten worden op bijdrage gerangschikt.
const SCOREBAND = 10;

// Selecteert de kleinste sterke mix. `kandidaten` komen uit de engine (al door de entitlementlaag). Volgorde van de invoer is niet
// bepalend: er wordt hier deterministisch op score (aflopend) en naam gesorteerd.
export function selecteerDekkingsmix(inv: { kandidaten: readonly MixKandidaat[]; gat: unknown; config: TierConfig }): MixResultaat {
  const { config } = inv;
  const gat = getal(inv.gat) ?? 0;
  const doelBedrag = Math.ceil(Math.round(gat * config.dekkingsdoel * 100) / 100); // zelfde afronding als toegestaneSom in het contract
  const leeg = (uitkomst: MixUitkomst, melding: string | null = null): MixResultaat => ({ uitkomst, gat, doelBedrag, som: 0, dekking: 0, mix: [], reserve: null, reserves: [], afgewezen: [], melding });

  if (!config.dekkingsplan || config.maxRegelsInMix <= 0) return leeg('niet-beschikbaar');
  if (gat <= 0) return leeg('geen-gat');

  const { geschikt, afgewezen } = filterGeschikt(inv.kandidaten, config);

  if (!geschikt.length) return { ...leeg('geen-kandidaten', MELDING_TE_WEINIG_STERKE_MATCHES), afgewezen };

  if (config.rangschikOpBijdrage) {
    // Premium: de begroting moet sluiten. Eerst de financiers die het beste passen (scoreband van 10 punten) en daarbinnen de hoogste bijdrage
    // (geschat voor het volledige doel, zodat alle kandidaten op dezelfde maat worden gemeten); de rest valt af zodra het doel gehaald is.
    const potentieel = new Map<string, number>();

    for (const k of geschikt) potentieel.set(k.sleutel, realistischBedrag({ gat, nodig: doelBedrag, min: k.min, max: k.max, bandOnder: bandOndergrens(k.band), maxAandeel: config.maxAandeelPerFonds }).bedrag ?? 0);

    geschikt.sort(
      (a, b) =>
        (a.optioneel ? 1 : 0) - (b.optioneel ? 1 : 0) ||
        Math.floor(b.score / SCOREBAND) - Math.floor(a.score / SCOREBAND) ||
        (potentieel.get(b.sleutel) ?? 0) - (potentieel.get(a.sleutel) ?? 0) ||
        b.score - a.score ||
        a.naam.localeCompare(b.naam, 'nl') ||
        a.sleutel.localeCompare(b.sleutel),
    );
  } else {
    geschikt.sort(volgorde);
  }

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
  const inMix = new Set<string>();
  let som = 0;

  for (const k of geschikt) {
    // Doel gehaald: STOP met mixen. De alternatieven worden hierna apart gekozen (ze tellen niet mee).
    if (som >= doelBedrag) break;

    if (mix.length >= config.maxRegelsInMix) {
      afgewezen.push({ sleutel: k.sleutel, code: 'mix-vol' });
      continue;
    }

    const b = realistischBedrag({ gat, nodig: doelBedrag - som, min: k.min, max: k.max, bandOnder: bandOndergrens(k.band), maxAandeel: config.maxAandeelPerFonds });

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
    inMix.add(k.sleutel);
    som += b.bedrag;
  }

  const bereikt = som >= doelBedrag;
  // Alternatieven: de volgende passende financiers, voor als een aanvraag wordt afgewezen. Alleen als het gat gedekt is (anders valt er niets te
  // "reserveren"); ze tellen niet mee in de som. Een optionele serviceclub is nooit een alternatief: ze wordt alleen gebruikt als de andere
  // financiers het doel niet halen.
  const reserves: MixRegel[] = [];

  if (som >= gat) {
    for (const k of geschikt) {
      if (reserves.length >= config.alternatieven) break;
      if (inMix.has(k.sleutel) || k.optioneel) continue;

      const r = realistischBedrag({ gat, nodig: gat, min: k.min, max: k.max, bandOnder: bandOndergrens(k.band), maxAandeel: config.maxAandeelPerFonds });

      if (r.bedrag !== null) reserves.push(regelVan(k, r));
    }
  }

  return {
    uitkomst: bereikt ? 'doel-bereikt' : 'onvoldoende-sterke-matches',
    gat,
    doelBedrag,
    som,
    dekking: stap2(som / gat),
    mix,
    reserve: reserves[0] ?? null,
    reserves,
    afgewezen,
    melding: bereikt ? null : MELDING_TE_WEINIG_STERKE_MATCHES,
  };
}
