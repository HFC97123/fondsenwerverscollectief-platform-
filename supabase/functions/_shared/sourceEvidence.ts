// Deterministische bronverificatie (Fase B1): fondsnaam, deadline, bedragen en de vergelijking database <-> web.
//
// STATUS: voorbereiding, door niets geïmporteerd. Geen netwerk, geen AI, geen schatting: elke uitkomst volgt uit letterlijke
// tekstvergelijking op de leesbare paginatekst. Bij twijfel is het resultaat 'uncertain' of 'not_checked', nooit 'confirmed'.
//
// Wat WEL is toegestaan bij het vergelijken van een citaat met de pagina (en niets anders):
//   * HTML-entiteiten in het citaat één keer decoderen;
//   * witruimte normaliseren (spaties, tabs, regeleinden, NBSP, onzichtbare tekens) en Unicode NFC;
// Niet toegestaan: hoofdletterongevoelig zoeken (voor citaten), leestekens/aanhalingstekens gelijktrekken, "ongeveer gelijk",
// synoniemen, vertalen of een model laten oordelen. Namen worden hoofdletterongevoelig maar verder letterlijk vergeleken.
//
// Welke velden kunnen 'confirmed' worden? fondsnaam, deadline, bedrag_min, bedrag_max. De overige velden (voorwaarden,
// cofinanciering, doelgroep, aanvragertype, geografie) vragen om begrip van de tekst ("niet voor jongeren"); dat is niet
// deterministisch te verifiëren. Ze worden hier hoogstens 'uncertain' (citaat staat wel op de pagina) of 'not_checked'.
import { decodeEntiteiten, normaliseerSpaties } from './readableText.ts';
import type { SafeFetchOk } from './safeFetch.ts';
import type { VeldNaam, VeldStatus } from './voorstelMetadata.ts';

// ---------------------------------------------------------------------------------------------------------------------------
// Basis

export async function sha256Hex(tekst: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(tekst));

  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Alle witruimte (ook regeleinden) naar één spatie. Géén entiteiten decoderen: de paginatekst is al gedecodeerd.
export function platgeslagen(tekst: string): string {
  return normaliseerSpaties(tekst).replace(/\s+/g, ' ').trim();
}

// Een citaat zoals het van buiten komt (model of gebruiker): entiteiten één keer decoderen, daarna dezelfde normalisatie.
export function normaliseerCitaat(citaat: string): string {
  return platgeslagen(decodeEntiteiten(String(citaat ?? '')));
}

export interface BronPagina {
  bronUrl: string;
  eindUrl: string;
  hostnaam: string;
  tekst: string; // leesbare tekst (met regelstructuur)
  plat: string; // dezelfde tekst, één spatie tussen alles
  paginaSha256: string; // sha256 van `plat`: de vingerafdruk die in de metadata komt
}

export async function maakBronPagina(opgehaald: SafeFetchOk, leesbaar: string): Promise<BronPagina> {
  const plat = platgeslagen(leesbaar);

  return {
    bronUrl: opgehaald.bronUrl,
    eindUrl: opgehaald.eindUrl,
    hostnaam: opgehaald.hostnaam,
    tekst: leesbaar,
    plat,
    paginaSha256: await sha256Hex(plat),
  };
}

// ---------------------------------------------------------------------------------------------------------------------------
// Resultaattypen

export interface VeldOordeel {
  veld: VeldNaam;
  status: VeldStatus;
  // Machineleesbare reden (intern; niet voor eindgebruikers)
  reden: string;
  waarde?: string; // de ONLINE waarde (alleen als bewezen of als claim relevant is)
  fragment?: string;
  fragment_sha256?: string;
}

export interface VeldClaim {
  waarde: string | number; // de waarde die het voorstel claimt (deadline: YYYY-MM-DD, bedragen: euro's)
  fragment?: string; // letterlijk citaat uit de bron dat de claim zou moeten bewijzen
  db?: string | number | null; // de huidige waarde uit het databaserecord (voor de vergelijking)
}

export interface FinancierIdentiteit {
  naam: string;
  aliassen?: string[]; // ALLEEN door de server bekende aliassen (nooit door een model verzonnen)
  domeinen?: string[]; // ALLEEN door de server bekende domeinen (website uit het databaserecord)
}

export interface NaamOordeel {
  gevonden: boolean;
  via: 'naam' | 'alias' | null;
  generiek: boolean;
  domeinMatch: boolean;
  reden: string; // 'ok' of 'financier_not_found' | 'naam_te_generiek_zonder_domeinbewijs' | 'naam_ontbreekt'
  variant?: string;
  fragment?: string;
  fragment_sha256?: string;
}

const MAX_FRAGMENT = 300;
const MIN_FRAGMENT = 12;

// ---------------------------------------------------------------------------------------------------------------------------
// Fondsnaam

// Woorden die op zichzelf geen fonds identificeren. Bestaat een naam alleen uit zulke woorden ("Fonds voor Cultuur"), dan is het
// woord "cultuur" ergens op de pagina geen bewijs. Zo'n naam kan alleen bevestigd worden met domeinbewijs (server-bekend domein).
const GENERIEK = new Set([
  'fonds', 'fondsen', 'stichting', 'vereniging', 'voor', 'van', 'de', 'het', 'een', 'en', 'der', 'den', 'ten', 'te', 'in', 'op',
  'subsidie', 'subsidies', 'regeling', 'regelingen', 'gemeente', 'provincie', 'nederland', 'nederlands', 'nederlandse', 'nationaal',
  'nationale', 'landelijk', 'landelijke', 'lokaal', 'lokale', 'cultuur', 'culturele', 'kunst', 'sport', 'zorg', 'sociaal', 'sociale',
  'welzijn', 'onderwijs', 'jeugd', 'natuur', 'milieu', 'duurzaamheid', 'innovatie', 'programma', 'project', 'projecten', 'algemeen',
  'algemene', 'initiatieven', 'initiatief', 'buurt', 'wijk', 'talent', 'ontwikkeling', 'fund', 'foundation', 'trust', 'for', 'the',
  'of', 'and', 'arts', 'culture', 'education',
]);

function tokens(s: string): string[] {
  return s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

export function isGeneriekeNaam(naam: string): boolean {
  const t = tokens(naam);

  return t.length === 0 || t.every((w) => GENERIEK.has(w));
}

const isLetterOfCijfer = (c: string | undefined): boolean => c !== undefined && /[\p{L}\p{N}]/u.test(c);

function zoekFrase(plat: string, platLager: string, frase: string): { begin: number; eind: number } | null {
  let van = 0;

  for (;;) {
    const i = platLager.indexOf(frase, van);

    if (i === -1) return null;

    const voor = i > 0 ? platLager[i - 1] : undefined;
    const na = platLager[i + frase.length];

    if (!isLetterOfCijfer(voor) && !isLetterOfCijfer(na)) return { begin: i, eind: i + frase.length };

    van = i + 1;
  }
}

function hostPast(host: string, domeinen: string[] | undefined): boolean {
  const h = host.toLowerCase().replace(/^www\./, '');

  return (domeinen ?? []).some((d) => {
    const dom = String(d).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

    return dom !== '' && (h === dom || h.endsWith('.' + dom));
  });
}

export async function controleerFinancier(pagina: BronPagina, financier: FinancierIdentiteit): Promise<NaamOordeel> {
  const kandidaten: Array<{ tekst: string; via: 'naam' | 'alias' }> = [];

  if (typeof financier?.naam === 'string' && financier.naam.trim() !== '') kandidaten.push({ tekst: platgeslagen(financier.naam), via: 'naam' });

  for (const a of financier?.aliassen ?? []) {
    if (typeof a === 'string' && a.trim() !== '') kandidaten.push({ tekst: platgeslagen(a), via: 'alias' });
  }

  const leeg: NaamOordeel = { gevonden: false, via: null, generiek: false, domeinMatch: false, reden: 'naam_ontbreekt' };

  if (kandidaten.length === 0) return leeg;

  const platLager = pagina.plat.toLowerCase();
  const domeinMatch = hostPast(pagina.hostnaam, financier.domeinen) || hostPast(new URL(pagina.eindUrl).hostname, financier.domeinen);
  let besteReden = 'financier_not_found';
  let generiek = false;

  for (const k of kandidaten) {
    if (k.tekst.length < 4) continue;

    const gen = isGeneriekeNaam(k.tekst);
    const m = zoekFrase(pagina.plat, platLager, k.tekst.toLowerCase());

    if (!m) continue;

    if (gen && !domeinMatch) {
      generiek = true;
      besteReden = 'naam_te_generiek_zonder_domeinbewijs';
      continue;
    }

    const links = Math.max(0, m.begin - 80);
    const rechts = Math.min(pagina.plat.length, m.eind + 80);
    const fragment = pagina.plat.slice(links, rechts).trim().slice(0, 200);

    return {
      gevonden: true,
      via: k.via,
      generiek: gen,
      domeinMatch,
      reden: 'ok',
      variant: pagina.plat.slice(m.begin, m.eind),
      fragment,
      fragment_sha256: await sha256Hex(fragment),
    };
  }

  return { ...leeg, generiek, domeinMatch, reden: besteReden };
}

// ---------------------------------------------------------------------------------------------------------------------------
// Datums

const MAANDEN: Record<string, number> = {
  januari: 1, jan: 1, februari: 2, feb: 2, maart: 3, mrt: 3, april: 4, apr: 4, mei: 5, juni: 6, jun: 6, juli: 7, jul: 7,
  augustus: 8, aug: 8, september: 9, sep: 9, sept: 9, oktober: 10, okt: 10, november: 11, nov: 11, december: 12, dec: 12,
};

export interface GevondenDatum {
  iso: string | null; // null als het jaar ontbreekt of de datum niet bestaat
  heeftJaar: boolean;
}

export interface DatumMetPositie extends GevondenDatum {
  begin: number;
  eind: number;
}

function echteDatum(j: number, m: number, d: number): string | null {
  if (!(j >= 1900 && j <= 2200 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;

  const dt = new Date(Date.UTC(j, m - 1, d));

  if (dt.getUTCFullYear() !== j || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;

  return `${String(j).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Kern: zoekt alle datums in `tekst` (alleen de eerste `cap` tekens) en geeft ook de plek. De posities gelden voor `tekst` zelf, mits het
// kleine-lettersen van de tekst de lengte niet verandert (zeldzame Unicode-tekens); wie posities gebruikt, controleert dat zelf.
export function vindDatumsMetPositie(tekst: string, cap: number, max = Number.POSITIVE_INFINITY): DatumMetPositie[] {
  const kort = tekst.slice(0, cap);
  const t = kort.toLowerCase();
  const uit: DatumMetPositie[] = [];
  const bezet: Array<[number, number]> = [];
  const vrij = (a: number, b: number) => !bezet.some(([x, y]) => a < y && b > x);
  const voegToe = (a: number, b: number, d: GevondenDatum) => {
    if (uit.length < max && vrij(a, b)) {
      bezet.push([a, b]);
      uit.push({ ...d, begin: a, eind: b });
    }
  };

  for (const m of t.matchAll(/(?<![\d])(\d{4})-(\d{2})-(\d{2})(?![\d])/g)) {
    voegToe(m.index!, m.index! + m[0].length, { iso: echteDatum(+m[1], +m[2], +m[3]), heeftJaar: true });
  }

  for (const m of t.matchAll(/(?<![\d])(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?![\d])/g)) {
    voegToe(m.index!, m.index! + m[0].length, { iso: echteDatum(+m[3], +m[2], +m[1]), heeftJaar: true });
  }

  const maandNamen = Object.keys(MAANDEN).sort((a, b) => b.length - a.length).join('|');
  const tekstueel = new RegExp(`(?<![\\d])(\\d{1,2})(?:e|ste|de)?\\s*(${maandNamen})\\.?(?:\\s*(\\d{4}))?(?![\\p{L}\\d])`, 'gu');

  for (const m of t.matchAll(tekstueel)) {
    const maand = MAANDEN[m[2]];
    const jaar = m[3] ? +m[3] : null;

    voegToe(m.index!, m.index! + m[0].length, { iso: jaar ? echteDatum(jaar, maand, +m[1]) : null, heeftJaar: jaar !== null });
  }

  return uit;
}

// Zoekt alle datums in een (korte, maximaal 1000 tekens) tekst. Ondersteund: 2026-11-12, 12-11-2026, 12/11/2026, 12.11.2026,
// 12 november 2026, 12 nov. 2026, 1e november 2026, en zonder jaar ("12 november"; dat telt als gevonden maar niet bewijsbaar).
export function vindDatums(tekst: string): GevondenDatum[] {
  return vindDatumsMetPositie(tekst, 1000).map(({ iso, heeftJaar }) => ({ iso, heeftJaar }));
}

export const DEADLINE_CONTEXT = ['deadline', 'uiterlijk', 'tot en met', 't/m', 'tot ', 'sluit', 'sluiting', 'sluitingsdatum', 'indienen', 'ingediend', 'inleveren', 'aanvragen', 'aanvraag', 'uiterste', 'vóór ', 'closing date', 'closes'];
export const VOORBEHOUD = [
  'naar verwachting', 'verwachte', 'verwacht ', 'voorlopig', 'mogelijk', 'indicatief', 'streefdatum', 'ongeveer', 'circa', 'later bekend',
  'nog niet bekend', 'nader te bepalen', 'nog te bepalen', 'n.t.b', 'wordt bekendgemaakt', 'volgt later', 'volgt nog', 'onder voorbehoud',
  'vermoedelijk', 'waarschijnlijk', 'kan wijzigen',
];

export const bevatEen = (tekst: string, lijst: string[]): boolean => {
  const t = tekst.toLowerCase();

  return lijst.some((w) => t.includes(w));
};

// ---------------------------------------------------------------------------------------------------------------------------
// Bedragen (euro's)

// Herkent "€ 25.000", "€25.000,-", "25.000 euro", "EUR 25000", "€ 25.000,50". Alleen op korte fragmenten toegepast.
export interface BedragMetPositie {
  waarde: number;
  begin: number;
  eind: number;
}

export function vindBedragenMetPositie(tekst: string, cap: number, max = Number.POSITIVE_INFINITY): BedragMetPositie[] {
  const t = tekst.slice(0, cap).toLowerCase();
  const uit: BedragMetPositie[] = [];
  const getal = '(\\d{1,3}(?:[. ]\\d{3})+|\\d+)(?:,(\\d{1,2}|-))?';
  const reeksen = [new RegExp(`(?:€|eur(?:o)?)\\s*${getal}`, 'g'), new RegExp(`${getal}\\s*(?:€|euro\\b|eur\\b)`, 'g')];
  const bezet: Array<[number, number]> = [];

  for (const re of reeksen) {
    for (const m of t.matchAll(re)) {
      if (uit.length >= max) return uit;

      const a = m.index!;
      const b = a + m[0].length;

      if (bezet.some(([x, y]) => a < y && b > x)) continue;

      bezet.push([a, b]);

      const heel = Number(m[1].replace(/[. ]/g, ''));
      const cent = m[2] && m[2] !== '-' ? Number(m[2].padEnd(2, '0')) / 100 : 0;

      if (Number.isFinite(heel)) uit.push({ waarde: heel + cent, begin: a, eind: b });
    }
  }

  return uit;
}

export function vindBedragen(tekst: string): number[] {
  return vindBedragenMetPositie(tekst, 1000).map((x) => x.waarde);
}

export const MAX_CONTEXT = ['maximaal', 'maximum', 'max.', 'max ', 'tot ', 'hoogstens', 'niet meer dan', 'ten hoogste', 'bedraagt', 'bijdrage'];
export const MIN_CONTEXT = ['minimaal', 'minimum', 'min.', 'min ', 'vanaf', 'ten minste', 'tenminste', 'niet minder dan', 'laagste', 'bedraagt'];

// ---------------------------------------------------------------------------------------------------------------------------
// Citaat zoeken

interface Citaatzoek {
  ok: boolean;
  reden: string;
  status: VeldStatus; // bij !ok
  norm?: string;
  hash?: string;
}

async function zoekCitaat(pagina: BronPagina, fragment: string | undefined): Promise<Citaatzoek> {
  if (typeof fragment !== 'string' || fragment.trim() === '') return { ok: false, status: 'not_checked', reden: 'geen_fragment' };

  const norm = normaliseerCitaat(fragment);

  if (norm.length < MIN_FRAGMENT) return { ok: false, status: 'uncertain', reden: 'fragment_te_kort' };
  if (norm.length > MAX_FRAGMENT) return { ok: false, status: 'uncertain', reden: 'fragment_te_lang' };
  if (!pagina.plat.includes(norm)) return { ok: false, status: 'uncertain', reden: 'fragment_not_found' };

  return { ok: true, status: 'confirmed', reden: 'ok', norm, hash: await sha256Hex(norm) };
}

// ---------------------------------------------------------------------------------------------------------------------------
// Veldoordelen

async function beoordeelDeadline(pagina: BronPagina, claim: VeldClaim): Promise<VeldOordeel> {
  const basis: VeldOordeel = { veld: 'deadline', status: 'uncertain', reden: '' };
  const gevraagd = String(claim.waarde ?? '');

  if (!/^\d{4}-\d{2}-\d{2}$/.test(gevraagd) || !echteDatum(+gevraagd.slice(0, 4), +gevraagd.slice(5, 7), +gevraagd.slice(8, 10))) {
    return { ...basis, status: 'not_checked', reden: 'ongeldige_claimdatum' };
  }

  const z = await zoekCitaat(pagina, claim.fragment);

  if (!z.ok) return { ...basis, status: z.status, reden: z.reden, waarde: gevraagd };

  const gevonden = vindDatums(z.norm!);
  const metFragment = { waarde: gevraagd, fragment: z.norm, fragment_sha256: z.hash };

  if (gevonden.length === 0) return { ...basis, ...metFragment, reden: 'geen_datum_in_fragment' };
  if (gevonden.some((d) => !d.heeftJaar || d.iso === null)) return { ...basis, ...metFragment, reden: 'datum_zonder_jaar_of_ongeldig' };

  const uniek = new Set(gevonden.map((d) => d.iso));

  if (uniek.size > 1) return { ...basis, ...metFragment, reden: 'meerdere_datums_in_fragment' };
  if (!uniek.has(gevraagd)) return { ...basis, ...metFragment, reden: 'andere_datum_in_fragment', waarde: [...uniek][0] as string };
  if (bevatEen(z.norm!, VOORBEHOUD)) return { ...basis, ...metFragment, reden: 'voorbehoud_in_fragment' };
  if (!bevatEen(z.norm!, DEADLINE_CONTEXT)) return { ...basis, ...metFragment, reden: 'geen_deadlinecontext_in_fragment' };

  return { veld: 'deadline', status: 'confirmed', reden: 'ok', ...metFragment };
}

async function beoordeelBedrag(pagina: BronPagina, veld: 'bedrag_min' | 'bedrag_max', claim: VeldClaim): Promise<VeldOordeel> {
  const basis: VeldOordeel = { veld, status: 'uncertain', reden: '' };
  const gevraagd = Number(claim.waarde);

  if (!Number.isFinite(gevraagd) || gevraagd < 0) return { ...basis, status: 'not_checked', reden: 'ongeldige_claimwaarde' };

  const z = await zoekCitaat(pagina, claim.fragment);
  const waarde = String(gevraagd);

  if (!z.ok) return { ...basis, status: z.status, reden: z.reden, waarde };

  const gevonden = [...new Set(vindBedragen(z.norm!))];
  const metFragment = { waarde, fragment: z.norm, fragment_sha256: z.hash };

  if (gevonden.length === 0) return { ...basis, ...metFragment, reden: 'geen_bedrag_in_fragment' };
  if (gevonden.length > 1) return { ...basis, ...metFragment, reden: 'meerdere_bedragen_in_fragment' };
  if (gevonden[0] !== gevraagd) return { ...basis, ...metFragment, reden: 'ander_bedrag_in_fragment', waarde: String(gevonden[0]) };
  if (!bevatEen(z.norm!, veld === 'bedrag_max' ? MAX_CONTEXT : MIN_CONTEXT)) return { ...basis, ...metFragment, reden: 'geen_bedragcontext_in_fragment' };
  if (bevatEen(z.norm!, VOORBEHOUD)) return { ...basis, ...metFragment, reden: 'voorbehoud_in_fragment' };

  return { veld, status: 'confirmed', reden: 'ok', ...metFragment };
}

// Voorwaarden, cofinanciering, doelgroep, aanvragertype, geografie: nooit automatisch bevestigd.
async function beoordeelKwalitatief(pagina: BronPagina, veld: VeldNaam, claim: VeldClaim): Promise<VeldOordeel> {
  const waarde = String(claim.waarde ?? '').slice(0, 200);
  const z = await zoekCitaat(pagina, claim.fragment);

  if (!z.ok) return { veld, status: z.status, reden: z.reden, ...(waarde ? { waarde } : {}) };

  // Het citaat staat wel op de pagina, maar of het de claim (inclusief ontkenningen en uitzonderingen) bewijst, kan alleen een mens
  // of een begripsmodel beoordelen. Dat is bewust niet deterministisch, dus: onzeker.
  return { veld, status: 'uncertain', reden: 'inhoudelijke_beoordeling_niet_deterministisch', ...(waarde ? { waarde } : {}), fragment: z.norm, fragment_sha256: z.hash };
}

export type ClaimsPerVeld = Partial<Record<Exclude<VeldNaam, 'fondsnaam'>, VeldClaim>>;

export interface BewijsUitkomst {
  financier: NaamOordeel;
  velden: Partial<Record<VeldNaam, VeldOordeel>>;
}

// Controleert de claims van een voorstel tegen de (reeds opgehaalde en tot tekst omgezette) bronpagina.
// Volgorde die altijd geldt: eerst de financier. Is die niet bevestigd, dan kan GEEN ander veld 'confirmed' worden (de pagina gaat dan
// niet aantoonbaar over deze financier), ook niet als het citaat letterlijk op de pagina staat.
export async function verifySourceEvidence(pagina: BronPagina, financier: FinancierIdentiteit, claims: ClaimsPerVeld): Promise<BewijsUitkomst> {
  const naam = await controleerFinancier(pagina, financier);
  const velden: Partial<Record<VeldNaam, VeldOordeel>> = {};

  velden.fondsnaam = naam.gevonden
    ? { veld: 'fondsnaam', status: 'confirmed', reden: 'ok', waarde: (naam.variant ?? '').slice(0, 200), fragment: naam.fragment, fragment_sha256: naam.fragment_sha256 }
    : { veld: 'fondsnaam', status: 'uncertain', reden: naam.reden === 'naam_ontbreekt' ? 'naam_ontbreekt' : naam.reden };

  for (const sleutel of Object.keys(claims) as Array<keyof ClaimsPerVeld>) {
    const claim = claims[sleutel];

    if (!claim) continue;

    let oordeel: VeldOordeel;

    if (sleutel === 'deadline') oordeel = await beoordeelDeadline(pagina, claim);
    else if (sleutel === 'bedrag_min' || sleutel === 'bedrag_max') oordeel = await beoordeelBedrag(pagina, sleutel, claim);
    else oordeel = await beoordeelKwalitatief(pagina, sleutel, claim);

    if (oordeel.status === 'confirmed' && !naam.gevonden) {
      oordeel = { ...oordeel, status: 'uncertain', reden: 'financier_not_found' };
    }

    velden[sleutel] = oordeel;
  }

  return { financier: naam, velden };
}

// ---------------------------------------------------------------------------------------------------------------------------
// Database <-> web

export interface VeldVergelijking extends VeldOordeel {
  db_waarde?: string; // alleen bij status conflict (momentopname van de live databasewaarde)
}

function normaliseerDbWaarde(veld: VeldNaam, v: unknown): string | null {
  if (v === null || v === undefined) return null;

  if (veld === 'deadline') {
    const s = String(v).trim().slice(0, 10);

    return /^\d{4}-\d{2}-\d{2}$/.test(s) && echteDatum(+s.slice(0, 4), +s.slice(5, 7), +s.slice(8, 10)) ? s : null;
  }

  if (veld === 'bedrag_min' || veld === 'bedrag_max') {
    if (typeof v === 'string' && v.trim() === '') return null;

    const n = Number(v);

    return Number.isFinite(n) && n >= 0 ? String(n) : null;
  }

  const s = platgeslagen(String(v));

  return s === '' ? null : s.slice(0, 200);
}

// Vergelijkt per veld de live databasewaarde met wat de bron aantoont. Past NOOIT iets aan in de database en kiest NOOIT de
// "nieuwste" waarde: het resultaat zegt alleen wat er staat, waar, en wanneer (bron en tijdstip staan bij het verificatieblok).
//   * bewezen online waarde == databasewaarde            -> confirmed
//   * bewezen online waarde != databasewaarde            -> conflict (beide waarden + citaat + hash)
//   * bewezen online waarde, database leeg               -> confirmed (er is niets om mee te botsen; de database blijft ongemoeid)
//   * online waarde niet bewezen                         -> uncertain (ook als hij afwijkt: een onbewezen claim is geen conflict)
//   * geen online claim of geen citaat                   -> not_checked
// Kwalitatieve velden kunnen niet in conflict komen: zonder deterministische interpretatie blijft het 'uncertain'.
export function compareDatabaseAndWeb(veld: VeldNaam, databaseWaarde: unknown, web: VeldOordeel): VeldVergelijking {
  const db = normaliseerDbWaarde(veld, databaseWaarde);
  const deterministisch = veld === 'deadline' || veld === 'bedrag_min' || veld === 'bedrag_max';

  if (web.status === 'not_checked') return { ...web };

  if (!deterministisch || web.status !== 'confirmed') {
    const afwijkend = deterministisch && db !== null && web.waarde !== undefined && web.waarde !== db;

    return { ...web, reden: afwijkend && web.status === 'uncertain' ? `${web.reden}|afwijkend_van_database_niet_bewezen` : web.reden };
  }

  if (db === null) return { ...web, reden: 'ok|database_leeg' };
  if (db === web.waarde) return { ...web, reden: 'ok|gelijk_aan_database' };

  return { ...web, status: 'conflict', reden: 'afwijkend_van_database_bewezen', db_waarde: db };
}
