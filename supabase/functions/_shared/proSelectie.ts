// Pro-fondsselectie: een KORTE lijst, bepaald in de applicatie (niet door een taalmodel). Zuivere functies: geen database, geen netwerk, geen modelaanroep.
//
// Plaats in de keten: NA de bestaande engine (projectcriteria -> harde voorwaarden -> fit -> relevantie -> entitlement) en VOOR de presentatie in de chat.
// De engine blijft beslissen wat in aanmerking komt; deze module
//   1. beoordeelt per fonds discipline, doelgroep en werkgebied SAMEN (één veld alleen is onvoldoende; ontbrekende informatie is onzeker, geen match),
//      met geografie op landniveau (zie werkgebied.ts); het aanvragertype speelt hier geen rol;
//   2. schat per fonds een realistische bijdrage uit de beschikbare gegevens (gebruikelijk bedrag uit de toelichting, of de bandbreedte min-max, begrensd
//      door een genoemd percentage van de projectkosten); zonder onderbouwing GEEN bedrag, nooit een verzonnen bedrag;
//   3. bouwt een gerichte lijst: sterkste matches eerst, stop zodra de projectbegroting potentieel gedekt is, en nooit boven het maximum van 120% van de
//      begroting (een buffer, geen doel). Een fonds waarvan de schatting het maximum zou overschrijden wordt niet toegevoegd; een schatting wordt nooit
//      kunstmatig verlaagd om te passen. Fondsen zonder onderbouwde schatting tellen niet mee voor de berekende dekking;
//   4. geeft eerlijk het resterende tekort als er te weinig geschikte fondsen zijn, zonder te vullen met zwakke matches.
// Er staan geen landen, thema's of bedragen in deze module: alles volgt uit de invoer.

import type { WerkgebiedOordeel, Sterkte } from './werkgebied.ts';
import type { FondsOordeel } from './fondsBeoordeling.ts';
import { algemeenPremiumVolgorde, isAlgemeenPremium } from './algemeenPremium.ts';

export const PRO_MAX_FACTOR = 1.2; // bovengrens van de som van de geschatte bijdragen, als aandeel van de projectbegroting
export const PRO_DEKKINGSDOEL = 1.0; // genoeg potentiële dekking: de lijst stopt zodra de som de begroting haalt
export const PRO_LIJST_DOEL = 1.2; // de chatlijst voor Pro gaat door tot 120% van de financieringsbehoefte (buffer voor afwijzingen) en niet verder
export const PREMIUM_DEKKINGSDOEL = 1.6; // Premium plant een ruimere buffer (afwijzingen en lagere toekenningen): de lijst gaat door tot 160% en blijft daar ook onder
export const PREMIUM_MAX_FACTOR = 1.6; // bovengrens van de som voor Premium (Pro: 120%)
export const TWIJFEL_AFTREK = 10; // sterkte-aftrek bij een AI-oordeel "twijfel": zekere fondsen gaan voor, maar het fonds valt niet af
export const NET_NIET_MAX = 5; // maximaal aantal "net niet"-fondsen in de uitleg (alleen Premium)
export const PRO_STERK = 80; // sterkte vanaf waar een fonds zonder bedrag nog voor onderzoek wordt genoemd (alleen bij een tekort)
export const PRO_ZONDER_BEGROTING_MAX = 6; // zonder begroting is er geen dekking te berekenen: alleen de sterkste matches, begrensd

export interface ProKandidaat {
  sleutel: string;
  naam: string;
  funderNaam: string;
  bron: string;
  score: number; // engine-score 0-100
  themaNiveau: string; // kern | secundair | breed | geen | geen-criterium
  disciplines: string[]; // overlappende thema's
  doelgroepPositief: boolean;
  doelgroepBekend: boolean; // heeft het fonds doelgroepgegevens?
  doelgroepen: string[]; // overlappende doelgroepen
  werkgebied: WerkgebiedOordeel | null; // landoordeel; null = geen buitenlands project, dan geldt de engine
  engineGeoStatus: 'eligible' | 'ineligible' | 'unknown';
  engineGeoPositief: boolean;
  engineGeoLabel: string | null;
  min: number | null;
  max: number | null;
  toelichtingen: string[]; // vrije tekst over bedragen (bijdrage_toelichting, aanvraagcriteria, voorwaarden...)
  eigenBijdrage: string | null;
  cofinanciering: string | null;
  begrotingseisen: string | null;
  zwaktes: string[];
  bedragenVerborgen?: boolean; // publiek-niveau record: bijdragegegevens zijn voor dit lid niet zichtbaar, dus nooit geschat of getoond
}

export interface Schatting {
  bedrag: number | null;
  grond: 'typisch-bedrag' | 'bandbreedte' | null;
  onderbouwing: string; // altijd gevuld: waarom dit bedrag, of waarom er geen bedrag is
  voorbehoud: string[];
}

export interface ProRegel {
  sleutel: string;
  naam: string;
  funderNaam: string;
  bron: string;
  sterkte: number; // 0-100, gezamenlijke beoordeling
  disciplineTekst: string;
  werkgebiedTekst: string;
  doelgroepTekst: string;
  schatting: number | null;
  telt: boolean; // telt mee in de berekende dekking
  onderbouwing: string;
  voorwaarden: string[];
  onzekerheden: string[];
  bewijs: { oordeel: 'past' | 'twijfel'; citaat: string; reden: string } | null; // AI-oordeel met letterlijk citaat uit de database (alleen als gecontroleerd)
}

export interface NetNiet {
  sleutel: string;
  naam: string;
  funderNaam: string;
  reden: string;
  citaat: string; // letterlijk uit de databasetekst van het fonds
}

export interface ProResultaat {
  uitkomst: 'voldoende' | 'tekort' | 'zonder-begroting' | 'geen-geschikt';
  begroting: number | null; // basis voor doel, maximum en dekking: de financieringsbehoefte als die bekend is, anders de projectbegroting
  basis?: 'behoefte' | 'begroting';
  maximum: number | null; // bovengrens van de som: 120% van de begroting (Pro) of 140% (Premium)
  regels: ProRegel[];
  totaal: number; // som van onderbouwde schattingen in de lijst
  dekkingPercentage: number | null; // totaal / begroting, hele procenten
  tekort: number; // begroting - totaal, nooit negatief
  overgeslagen: Array<{ sleutel: string; naam: string; reden: string }>;
  nietGeschikt: number; // door de gezamenlijke beoordeling afgevallen
  extraGeschikt: number; // geschikt, maar buiten de korte lijst gebleven (alleen op verzoek te tonen)
  uitgebreid: boolean;
  netNiet: NetNiet[]; // door de AI-beoordeling (met citaat) afgevallen fondsen die verder goed aansloten, sterkste eerst
  aiActief: boolean; // is de AI-beoordeling in deze selectie meegenomen?
}

const euro = (n: number) => `€ ${Math.round(n).toLocaleString('nl-NL')}`;
export const formatEuro = euro;

const norm = (t: unknown) =>
  String(t ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

function afrondStap(b: number): number {
  return b < 5_000 ? 100 : b < 50_000 ? 500 : 1_000;
}

const naarBeneden = (b: number) => {
  const s = afrondStap(b);

  return Math.floor(b / s) * s;
};

// --------------------------------------------------------------------------------------------------------------------------------
// Bedragen in vrije tekst. Alleen euro's: andere valuta's worden niet omgerekend of verzonnen.
function bedragenInZin(zin: string): number[] {
  const uit: number[] = [];
  const re = /(?:€|eur\.?|euro)\s*([0-9]{1,3}(?:[.\s][0-9]{3})+(?:,[0-9]{1,2})?|[0-9]+(?:,[0-9]{1,2})?)(?:,-)?\s*(miljoen|mln|duizend|k)?(?![a-z0-9])|([0-9]{1,3}(?:\.[0-9]{3})+|[0-9]+)\s*euro/gi;

  for (const m of zin.matchAll(re)) {
    const ruw = (m[1] ?? m[3] ?? '').replace(/[.\s]/g, '').replace(',', '.');
    let n = Number(ruw);
    const eenheid = (m[2] || '').toLowerCase();

    if (!Number.isFinite(n) || n <= 0) continue;
    if (eenheid === 'miljoen' || eenheid === 'mln') n *= 1_000_000;
    else if (eenheid === 'duizend' || eenheid === 'k') n *= 1_000;

    uit.push(Math.round(n));
  }

  return uit;
}

const TYPISCH_CUE = /\b(?:gemiddeld(?:e)?|doorgaans|meestal|gebruikelijk(?:e)?|gewoonlijk|veelal|ongeveer|circa|rond|typisch(?:e)?|toegekende bedragen|eerste aanvragen|in de regel)\b/i;
const TYPISCH_NEGATIEF = /\b(?:maximaal|maximum|hoogstens|ten hoogste|tot ?maximaal|niet meer dan)\b/i;

// Een gebruikelijk bedrag uit de toelichting: één bedrag in een zin met "gemiddeld/doorgaans/rond..." of het midden van een genoemd bereik.
export function gebruikelijkBedrag(teksten: string[]): { bedrag: number; zin: string } | null {
  for (const t of teksten) {
    for (const zin of String(t || '').split(/\.(?=\s|$)|[;\n]/)) {
      if (!TYPISCH_CUE.test(zin)) continue;

      const b = bedragenInZin(zin);

      if (!b.length) continue;
      if (b.length === 1 && TYPISCH_NEGATIEF.test(zin) && !/(?:gemiddeld|doorgaans|rond|ongeveer|circa|gebruikelijk)/i.test(zin)) continue;

      const laag = Math.min(...b);
      const hoog = Math.max(...b);

      return { bedrag: b.length === 1 ? b[0] : Math.round((laag + hoog) / 2), zin: zin.trim().slice(0, 160) };
    }
  }

  return null;
}

// "maximaal 50% van de projectkosten" -> 0.5
export function percentageVanKosten(teksten: string[]): number | null {
  const n = norm(teksten.filter(Boolean).join(' . '));
  const m = n.match(/(?:maximaal|max\.?|hoogstens|ten hoogste|tot)\s*(\d{1,3})\s*%\s*(?:van|v\.d\.)\s*(?:de\s*)?(?:totale\s*|gehele\s*|subsidiabele\s*|begrote\s*)?(?:project)?(?:kosten|begroting|projectbegroting|projectkosten)/);

  if (!m) return null;

  const p = Number(m[1]);

  return p > 0 && p <= 100 ? p / 100 : null;
}

// --------------------------------------------------------------------------------------------------------------------------------
// Schatting van de bijdrage van één fonds. Nooit het maximum als uitgangspunt; nooit een bedrag zonder onderbouwing; nooit lager gemaakt om in een
// totaalmaximum te passen (alleen de eigen grenzen van het fonds en de projectbegroting begrenzen).
export function schatBijdrage(inv: { min: number | null; max: number | null; teksten: string[]; begroting: number | null }): Schatting {
  const min = typeof inv.min === 'number' && inv.min > 0 ? inv.min : null;
  const max = typeof inv.max === 'number' && inv.max > 0 ? inv.max : null;
  const begroting = typeof inv.begroting === 'number' && inv.begroting > 0 ? inv.begroting : null;
  const pct = percentageVanKosten(inv.teksten);
  const voorbehoud: string[] = [];
  const nee = (onderbouwing: string): Schatting => ({ bedrag: null, grond: null, onderbouwing, voorbehoud });

  if (min !== null && max !== null && min > max) return nee('De bijdragegrenzen in de gegevens zijn tegenstrijdig; er wordt geen bedrag geschat.');

  const grenzen = [max, pct !== null && begroting !== null ? Math.floor(pct * begroting) : null, begroting].filter((x): x is number => typeof x === 'number');
  const effMax = grenzen.length ? Math.min(...grenzen) : null;

  if (pct !== null && begroting !== null) voorbehoud.push(`maximaal ${Math.round(pct * 100)}% van de projectkosten (${euro(Math.floor(pct * begroting))})`);
  if (min !== null && effMax !== null && min > effMax) return nee(`Het minimum van dit fonds (${euro(min)}) ligt boven wat het fonds voor dit project kan bijdragen (${euro(effMax)}); er wordt geen bedrag geschat.`);

  const typisch = gebruikelijkBedrag(inv.teksten);

  if (typisch) {
    let b = typisch.bedrag;

    if (min !== null && b < min) b = min;
    if (effMax !== null && b > effMax) b = effMax;

    return { bedrag: b, grond: 'typisch-bedrag', onderbouwing: `Gebruikelijk bedrag volgens de gegevens van het fonds (${euro(typisch.bedrag)}${b !== typisch.bedrag ? `, begrensd tot ${euro(b)}` : ''}).`, voorbehoud };
  }

  if (min !== null && max !== null) {
    const hoog = effMax as number;
    const midden = (min + hoog) / 2;
    const b = Math.max(min, naarBeneden(midden));

    return { bedrag: b, grond: 'bandbreedte', onderbouwing: `Midden van de bekende bandbreedte ${euro(min)} tot ${euro(max)}${hoog < max ? ` (begrensd tot ${euro(hoog)})` : ''}; geen toekenninggegevens, dus een schatting.`, voorbehoud };
  }

  if (max !== null) return nee(`Alleen een bovengrens is bekend (maximaal ${euro(max)}); een gebruikelijk bedrag is niet bekend, dus er wordt geen bedrag geschat.`);
  if (min !== null) return nee(`Alleen een ondergrens is bekend (vanaf ${euro(min)}); een gebruikelijk bedrag is niet bekend, dus er wordt geen bedrag geschat.`);

  return nee('Bij dit fonds zijn geen bedragen bekend; er wordt geen bedrag geschat.');
}

// --------------------------------------------------------------------------------------------------------------------------------
// Gezamenlijke inhoudelijke beoordeling.
const WERK_SCORE: Record<Sterkte, number> = { land: 100, regio: 95, klasse: 90, werelddeel: 85, wereld: 65 };

export interface Beoordeling {
  geschikt: boolean;
  reden: string | null; // bij niet geschikt
  sterkte: number;
  positief: number;
  discipline: number;
  doelgroep: number | null;
  werkgebied: number | null;
  onzekerheden: string[];
}

export function beoordeelGezamenlijk(k: ProKandidaat): Beoordeling {
  const onzekerheden: string[] = [];
  const discipline = k.themaNiveau === 'kern' ? 100 : k.themaNiveau === 'secundair' ? 70 : k.themaNiveau === 'breed' ? 40 : 0;
  const doelgroep = k.doelgroepPositief ? 100 : null;
  let werkgebied: number | null = null;

  if (k.werkgebied) {
    if (k.werkgebied.status === 'ineligible') {
      return { geschikt: false, reden: k.werkgebied.reden || 'werkgebied sluit niet aan', sterkte: 0, positief: 0, discipline, doelgroep, werkgebied: 0, onzekerheden };
    }

    werkgebied = k.werkgebied.status === 'eligible' && k.werkgebied.sterkte ? WERK_SCORE[k.werkgebied.sterkte] : null;
  } else if (k.engineGeoStatus === 'ineligible') {
    return { geschikt: false, reden: 'werkgebied sluit niet aan', sterkte: 0, positief: 0, discipline, doelgroep, werkgebied: 0, onzekerheden };
  } else if (k.engineGeoStatus === 'eligible') {
    werkgebied = k.engineGeoPositief ? 95 : 70;
  }

  if (werkgebied === null) onzekerheden.push(k.werkgebied?.notitie || 'het werkgebied van het fonds is niet vast te stellen voor dit project');
  if (doelgroep === null) onzekerheden.push(k.doelgroepBekend ? 'de doelgroep sluit niet expliciet aan' : 'de doelgroep van het fonds is niet bekend');
  if (k.themaNiveau === 'secundair') onzekerheden.push('het thema sluit aan via een verwant thema');
  if (k.themaNiveau === 'breed') onzekerheden.push('alleen een breed thema sluit aan');

  const positief = (discipline >= 70 ? 1 : 0) + (doelgroep === 100 ? 1 : 0) + (werkgebied !== null && werkgebied >= 65 ? 1 : 0);
  const gezamenlijk = 0.35 * discipline + 0.3 * (doelgroep ?? 50) + 0.35 * (werkgebied ?? 50);
  const sterkte = Math.round(Math.min(100, 0.7 * gezamenlijk + 0.3 * Math.min(100, k.score)));

  if (positief < 2) {
    return { geschikt: false, reden: 'onvoldoende gezamenlijke aansluiting: minder dan twee van discipline, werkgebied en doelgroep zijn aantoonbaar', sterkte, positief, discipline, doelgroep, werkgebied, onzekerheden };
  }

  return { geschikt: true, reden: null, sterkte, positief, discipline, doelgroep, werkgebied, onzekerheden };
}

// --------------------------------------------------------------------------------------------------------------------------------
function voorwaardenVan(k: ProKandidaat, schatting: Schatting): string[] {
  const uit = [...schatting.voorbehoud];
  const knip = (t: string) => t.replace(/\s+/g, ' ').trim().slice(0, 140);
  const heeft = (t: string | null) => Boolean(t && t.trim() && !/^(geen|nee|n\.?v\.?t\.?)\b/i.test(t.trim()));

  if (heeft(k.cofinanciering)) uit.push(`cofinanciering: ${knip(k.cofinanciering as string)}`);
  if (heeft(k.eigenBijdrage)) uit.push(`eigen bijdrage: ${knip(k.eigenBijdrage as string)}`);
  if (heeft(k.begrotingseisen)) uit.push(`begrotingseisen: ${knip(k.begrotingseisen as string)}`);

  return uit.slice(0, 4);
}

function regelVan(k: ProKandidaat, b: Beoordeling, s: Schatting, o: FondsOordeel | null = null): ProRegel {
  const onzekerheden = [...b.onzekerheden, ...k.zwaktes.filter((z) => !b.onzekerheden.includes(z))].slice(0, 4);
  const werkTekst = k.werkgebied && k.werkgebied.status === 'eligible' ? k.werkgebied.reden || 'werkgebied sluit aan' : k.engineGeoStatus === 'eligible' ? (k.engineGeoLabel ? `${k.engineGeoLabel}: werkgebied sluit aan` : 'werkgebied sluit aan') : 'werkgebied niet vastgesteld';

  return {
    sleutel: k.sleutel,
    naam: k.naam,
    funderNaam: k.funderNaam,
    bron: k.bron,
    sterkte: b.sterkte,
    disciplineTekst: b.discipline >= 70 ? `discipline sluit aan${k.disciplines.length ? ` (${k.disciplines.slice(0, 3).join(', ')})` : ''}` : b.discipline > 0 ? `discipline sluit gedeeltelijk aan${k.disciplines.length ? ` (${k.disciplines.slice(0, 3).join(', ')})` : ''}` : 'discipline niet vastgesteld',
    werkgebiedTekst: werkTekst,
    doelgroepTekst: b.doelgroep === 100 ? `doelgroep sluit aan${k.doelgroepen.length ? ` (${k.doelgroepen.slice(0, 3).join(', ')})` : ''}` : 'doelgroep niet vastgesteld',
    schatting: s.bedrag,
    telt: s.bedrag !== null,
    onderbouwing: s.onderbouwing,
    voorwaarden: voorwaardenVan(k, s),
    onzekerheden,
    bewijs: o && o.oordeel !== 'past_niet' ? { oordeel: o.oordeel, citaat: o.citaat, reden: o.reden } : null,
  };
}

// De korte lijst. Optioneel met AI-oordelen (fondsBeoordeling.ts): alleen een gecontroleerd "past_niet" haalt een fonds uit de lijst (en zet het in de
// "net niet"-lijst), "twijfel" zet een kanttekening en een kleine sterkte-aftrek. De AI voegt nooit een fonds toe; alle bedragen en totalen blijven hier berekend.
export function selecteerProLijst(inv: {
  kandidaten: readonly ProKandidaat[];
  begroting: number | null;
  // Nog te financieren bedrag (begroting min eigen bijdrage, toegekend en aangevraagd). Is het bekend, dan is dit de basis voor doel, maximum en
  // dekking; de begroting blijft de basis voor het schatten van een bijdrage ("maximaal x% van de projectkosten").
  behoefte?: number | null;
  uitgebreid?: boolean;
  oordelen?: ReadonlyMap<string, FondsOordeel> | null;
  aiActief?: boolean; // de AI-beoordeling heeft gedraaid: fondsen zonder geldig oordeel krijgen een kanttekening
  dekkingsdoel?: number; // stopt de lijst zodra de som dit aandeel van de begroting haalt (Pro 1,0; Premium 1,4)
  maxFactor?: number; // bovengrens als aandeel van de begroting (Pro 1,2; Premium 1,4)
  algemeenPremium?: { seed: string }; // alleen Premium: zorg dat er een algemeen Premium-fonds in de lijst staat; seed laat de keuze per project afwisselen
}): ProResultaat {
  const projectBegroting = typeof inv.begroting === 'number' && inv.begroting > 0 ? Math.round(inv.begroting) : null;
  const behoefte = typeof inv.behoefte === 'number' && inv.behoefte > 0 ? Math.round(inv.behoefte) : null;
  const begroting = behoefte ?? projectBegroting; // basis voor doel, maximum en dekking
  const basis: 'behoefte' | 'begroting' = behoefte !== null ? 'behoefte' : 'begroting';
  const factor = typeof inv.maxFactor === 'number' && inv.maxFactor >= PRO_MAX_FACTOR && inv.maxFactor <= 2 ? inv.maxFactor : PRO_MAX_FACTOR;
  const maximum = begroting !== null ? Math.round(begroting * factor) : null;
  const uitgebreid = inv.uitgebreid === true;
  const aiActief = inv.aiActief === true;
  const doel = typeof inv.dekkingsdoel === 'number' && inv.dekkingsdoel >= PRO_DEKKINGSDOEL && inv.dekkingsdoel <= factor ? inv.dekkingsdoel : PRO_DEKKINGSDOEL;
  const gezien = new Set<string>();
  let nietGeschikt = 0;
  const geschikt: Array<{ k: ProKandidaat; b: Beoordeling; s: Schatting; o: FondsOordeel | null }> = [];
  const netNietAlle: Array<NetNiet & { sterkte: number }> = [];

  for (const k of inv.kandidaten || []) {
    if (!k || gezien.has(k.sleutel)) continue;

    gezien.add(k.sleutel);

    let b = beoordeelGezamenlijk(k);

    if (!b.geschikt) {
      nietGeschikt += 1;
      continue;
    }

    const o = inv.oordelen?.get(k.sleutel) ?? null;

    if (o?.oordeel === 'past_niet') {
      nietGeschikt += 1;
      netNietAlle.push({ sleutel: k.sleutel, naam: k.naam, funderNaam: k.funderNaam, reden: o.reden || 'zie het citaat', citaat: o.citaat, sterkte: b.sterkte });
      continue;
    }

    if (o?.oordeel === 'twijfel') {
      b = { ...b, sterkte: Math.max(0, b.sterkte - TWIJFEL_AFTREK), onzekerheden: [...b.onzekerheden, `de brontekst is onduidelijk${o.reden && o.reden !== 'zie het citaat' ? `: ${o.reden}` : ''}`] };
    } else if (!o && aiActief) {
      b = { ...b, onzekerheden: [...b.onzekerheden, 'niet gecontroleerd door de AI-beoordeling'] };
    }

    geschikt.push({
      k,
      b,
      o,
      s: k.bedragenVerborgen
        ? { bedrag: null, grond: null, onderbouwing: 'De bijdragegegevens van dit fonds zijn in uw abonnement niet zichtbaar; er wordt geen bedrag geschat.', voorbehoud: [] }
        : schatBijdrage({ min: k.min, max: k.max, teksten: k.toelichtingen, begroting: projectBegroting }),
    });
  }

  geschikt.sort((a, b) => b.b.sterkte - a.b.sterkte || b.k.score - a.k.score || a.k.naam.localeCompare(b.k.naam, 'nl') || a.k.sleutel.localeCompare(b.k.sleutel));
  netNietAlle.sort((a, b) => b.sterkte - a.sterkte || a.naam.localeCompare(b.naam, 'nl') || a.sleutel.localeCompare(b.sleutel));

  const netNiet: NetNiet[] = netNietAlle.slice(0, NET_NIET_MAX).map(({ sterkte: _s, ...rest }) => rest);
  const maak = (g: { k: ProKandidaat; b: Beoordeling; s: Schatting; o: FondsOordeel | null }) => regelVan(g.k, g.b, g.s, g.o);
  const leeg: ProResultaat = { uitkomst: 'geen-geschikt', begroting, basis, maximum, regels: [], totaal: 0, dekkingPercentage: begroting !== null ? 0 : null, tekort: begroting ?? 0, overgeslagen: [], nietGeschikt, extraGeschikt: 0, uitgebreid, netNiet, aiActief };

  if (!geschikt.length) return leeg;

  // Uitgebreid (het lid vraagt om méér): alle geschikte fondsen op volgorde, nog steeds met de berekende totalen.
  if (uitgebreid) {
    const regels = geschikt.map(maak);
    const totaal = regels.reduce((t, r) => t + (r.telt ? (r.schatting as number) : 0), 0);

    return { ...leeg, uitkomst: begroting === null ? 'zonder-begroting' : totaal >= begroting * PRO_DEKKINGSDOEL ? 'voldoende' : 'tekort', regels, totaal, dekkingPercentage: begroting !== null ? Math.round((totaal / begroting) * 100) : null, tekort: begroting !== null ? Math.max(0, begroting - totaal) : 0 };
  }

  if (begroting === null) {
    const regels = geschikt.filter((g) => g.b.sterkte >= PRO_STERK).slice(0, PRO_ZONDER_BEGROTING_MAX).map(maak);

    return { ...leeg, uitkomst: 'zonder-begroting', regels: regels.length ? regels : geschikt.slice(0, 3).map(maak), extraGeschikt: Math.max(0, geschikt.length - Math.max(regels.length, 3)), tekort: 0 };
  }

  // 1. Fondsen mét onderbouwde schatting, sterkste eerst, tot het dekkingsdoel gehaald is en nooit boven het maximum.
  const kiesRonde = (lijst: typeof geschikt) => {
    const uit = { regels: [] as ProRegel[], overgeslagen: [] as ProResultaat['overgeslagen'], gekozen: new Set<string>(), totaal: 0 };

    for (const g of lijst) {
      if (g.s.bedrag === null) continue;
      if (uit.totaal >= begroting * doel) break;

      if (uit.totaal + g.s.bedrag > (maximum as number)) {
        uit.overgeslagen.push({ sleutel: g.k.sleutel, naam: g.k.naam, reden: `zou de som boven het maximum van ${euro(maximum as number)} brengen (schatting ${euro(g.s.bedrag)})` });
        continue;
      }

      uit.regels.push(maak(g));
      uit.gekozen.add(g.k.sleutel);
      uit.totaal += g.s.bedrag;
    }

    return uit;
  };

  let ronde = kiesRonde(geschikt);

  // Premium: staat er geen algemeen Premium-fonds in de lijst (zie algemeenPremium.ts), dan krijgt het best passende er één vooraan met zijn gewone geschatte bedrag.
  // Lukt dat niet (geen bedrag, of het past niet onder het maximum), dan het volgende; past geen enkel, dan blijft de lijst zoals ze was.
  if (inv.algemeenPremium && !geschikt.some((g) => ronde.gekozen.has(g.k.sleutel) && isAlgemeenPremium(g.k.naam))) {
    for (const keuze of algemeenPremiumVolgorde(geschikt.filter((g) => isAlgemeenPremium(g.k.naam) && g.s.bedrag !== null), inv.algemeenPremium.seed, (g) => g.b.sterkte, (g) => g.k.naam)) {
      const nieuw = kiesRonde([keuze, ...geschikt.filter((g) => g !== keuze)]);

      if (nieuw.gekozen.has(keuze.k.sleutel)) {
        ronde = nieuw;
        break;
      }
    }
  }

  const { regels, overgeslagen, gekozen } = ronde;
  let totaal = ronde.totaal;

  // 2. Blijft er een tekort, dan nog de STERKE fondsen zonder bedrag, om te onderzoeken. Ze tellen niet mee in de berekende dekking.
  if (totaal < begroting * PRO_DEKKINGSDOEL) {
    for (const g of geschikt) {
      if (gekozen.has(g.k.sleutel) || g.s.bedrag !== null || g.b.sterkte < PRO_STERK) continue;

      regels.push(maak(g));
      gekozen.add(g.k.sleutel);
    }
  }

  const extraGeschikt = geschikt.filter((g) => !gekozen.has(g.k.sleutel)).length;
  const tekort = Math.max(0, begroting - totaal);

  return {
    uitkomst: totaal >= begroting * PRO_DEKKINGSDOEL ? 'voldoende' : regels.length ? 'tekort' : 'geen-geschikt',
    begroting,
    basis,
    maximum,
    regels,
    totaal,
    dekkingPercentage: Math.round((totaal / begroting) * 100),
    tekort,
    overgeslagen,
    nietGeschikt,
    extraGeschikt,
    uitgebreid,
    netNiet,
    aiActief,
  };
}

// --------------------------------------------------------------------------------------------------------------------------------
// Wat het taalmodel in de chat mag presenteren: de server levert de feiten en de volgorde; het model schrijft er geen bedragen of fondsen bij.
export interface ProProjectUitleg {
  begroting: number | null;
  behoefte?: number | null;
  disciplines: string[];
  werkgebieden: string[];
  doelgroepen: string[];
}

export function proPresentatieBlok(res: ProResultaat, project: ProProjectUitleg, opties: { tier?: 'pro' | 'premium' } = {}): string {
  const premium = opties.tier === 'premium';
  const lijst = (l: string[]) => (l.length ? l.join(', ') : 'niet vastgesteld');
  const r: string[] = [];

  r.push(`${premium ? 'PREMIUM' : 'PRO'}-SELECTIE (server-side berekend; dit is de definitieve, korte lijst. Presenteer UITSLUITEND deze fondsen, in deze volgorde, en neem alle bedragen, totalen en percentages LETTERLIJK over. Voeg geen fondsen, bedragen of berekeningen toe en wijzig niets.)`);
  r.push(`Achtergrond voor de opening (niet opsommen; hooguit één korte zin, bijvoorbeeld "Hier zou ik me eerst op richten:"): de selectie is gebaseerd op een projectbegroting van ${project.begroting !== null ? euro(project.begroting) : 'een nog onbekend bedrag'}${typeof project.behoefte === 'number' && project.behoefte > 0 ? ` en een financieringsbehoefte van ${euro(project.behoefte)}` : ''}, disciplines: ${lijst(project.disciplines)}; werkgebied: ${lijst(project.werkgebieden)}; doelgroep: ${lijst(project.doelgroepen)}.`);

  if (!res.regels.length) {
    r.push('Er is geen fonds dat op discipline, werkgebied en doelgroep samen voldoende aansluit. Zeg dat eerlijk, noem geen fondsen en stel een gerichte vraag om het project scherper te krijgen.');

    return r.join('\n');
  }

  r.push('Vorm: kort en beknopt, in etappes. Opening: één korte zin. Per fonds één regel met alleen de naam en de geschatte bijdrage. De uitleg, voorwaarden, citaten en onzekerheden hieronder zijn achtergrond: geef ze pas als het lid naar een fonds vraagt. Sluit af met het totaal (één regel) en één korte zin dat het schattingen zijn.');
  res.regels.forEach((x, i) => {
    r.push(
      [
        `${i + 1}. ${x.naam}${x.funderNaam && x.funderNaam !== x.naam ? ` (${x.funderNaam})` : ''}`,
        `   Waarom het past: ${x.disciplineTekst}; ${x.werkgebiedTekst}; ${x.doelgroepTekst}.`,
        x.schatting !== null ? `   Geschatte bijdrage: ${euro(x.schatting)}. Onderbouwing: ${x.onderbouwing}` : `   Geschatte bijdrage: onbekend (telt NIET mee in de berekende dekking). ${x.onderbouwing}`,
        x.voorwaarden.length ? `   Relevante voorwaarden: ${x.voorwaarden.join('; ')}.` : null,
        x.bewijs && x.bewijs.citaat ? `   Bevestigd in de bron (letterlijk citaat uit de database; een bedrag of percentage daarin is een voorwaarde van het fonds en geen schatting): "${x.bewijs.citaat}"` : null,
        x.onzekerheden.length ? `   Onzeker: ${x.onzekerheden.join('; ')}.` : null,
      ]
        .filter(Boolean)
        .join('\n'),
    );
  });

  if (res.begroting !== null) {
    const basisNaam = res.basis === 'behoefte' ? 'financieringsbehoefte' : 'projectbegroting';

    r.push(`Onderaan (neem letterlijk over): totaal geschatte bijdragen ${euro(res.totaal)}; dekking ${res.dekkingPercentage}% van de ${basisNaam} (${euro(res.begroting)}); ${res.tekort > 0 ? `resterend tekort ${euro(res.tekort)}` : 'geen resterend tekort'}.`);
    r.push(`Intern, nooit noemen: het maximum voor de som van de schattingen is ${euro(res.maximum as number)} (${Math.round(((res.maximum as number) / res.begroting) * 100)}% van de ${res.basis === 'behoefte' ? 'behoefte' : 'begroting'}, een buffer en geen doel). Noem dit maximum, dit percentage en de manier waarop de lijst is samengesteld nooit in het antwoord.`);
  } else {
    r.push('Onderaan: de financieringsbehoefte is niet bekend, dus er is geen dekking berekend. Vraag in één zin hoeveel er nog gefinancierd moet worden.');
  }

  r.push('Zeg onderaan in één korte zin dat dit schattingen zijn en geen toezeggingen.');

  if (res.uitkomst === 'tekort') r.push('Er zijn te weinig geschikte fondsen met een onderbouwde schatting om de begroting volledig te dekken. Noem het resterende tekort en vul de lijst NIET aan met zwakke matches.');
  if (res.overgeslagen.length) r.push(`Niet opgenomen omdat de som dan boven het maximum uitkomt: ${res.overgeslagen.map((o) => o.naam).join(', ')}. Noem ze niet.`);
  if (premium && res.netNiet.length) {
    r.push(`Net niet (achtergrond: noem deze alleen als het lid vraagt waarom een fonds ontbreekt of om alternatieven; het zijn GEEN aanbevelingen, geef er geen bedragen bij en tel ze niet mee):\n${res.netNiet.map((n) => `- ${n.naam}${n.funderNaam && n.funderNaam !== n.naam ? ` (${n.funderNaam})` : ''}: ${n.reden}${n.citaat ? ` Bron (letterlijk): "${n.citaat}"` : ''}`).join('\n')}`);
  }

  if (!res.uitgebreid && res.extraGeschikt > 0) r.push('Er zijn mogelijk nog andere geschikte fondsen. Noem geen aantal en geen namen; als het lid om meer vraagt, wordt de lijst uitgebreid.');

  return r.join('\n');
}
