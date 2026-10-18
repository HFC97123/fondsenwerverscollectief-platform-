// Werkgebied in het projectformulier: landen als ISO-landcode en bevestigde verfijningen (GeoNames). Geen React, geen database, geen netwerk.
// De landenlijst is GEGENEREERD uit de Edge Function (supabase/functions/_shared/werkgebied.ts), zodat server en formulier dezelfde landen,
// schrijfwijzen en codes gebruiken; isoCodesUitWerkgebied() hieronder volgt dezelfde regels als de serverversie (de tests vergelijken ze).
import { LAND_REGELS } from './landen.generated.js';

export const MAX_VERFIJNINGEN = 10;

const TERM_NAAR_LAND = new Map();

for (const l of LAND_REGELS) for (const t of l.termen) TERM_NAAR_LAND.set(t, l);

// Landnamen (Nederlands) voor de suggesties in het werkgebiedveld, naast de bestaande werkgebieden uit de tabel regios.
export const LANDNAMEN = LAND_REGELS.map((l) => l.naam).sort((a, b) => a.localeCompare(b, 'nl'));

export function normaliseer(t) {
  return String(t == null ? '' : t)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`´]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function codeVoor(stuk) {
  const sleutel = normaliseer(String(stuk).replace(/\(.*?\)/g, ' '));

  return sleutel ? (TERM_NAAR_LAND.get(sleutel) || {}).iso : undefined;
}

// De landen in het werkgebiedveld ("Kumasi, Ghana" -> ["GH"]). Alleen exacte landnamen tellen; een plaats levert nooit een land op.
export function isoCodesUitWerkgebied(tekst) {
  const uit = [];

  for (const stuk of String(tekst == null ? '' : tekst).split(/[,;|\n]/)) {
    const delen = codeVoor(stuk) ? [stuk] : stuk.split(/\s+en\s+|\s+and\s+/i);

    for (const deel of delen) {
      const c = codeVoor(deel);

      if (c && !uit.includes(c)) uit.push(c);
    }
  }

  return uit;
}

export function landNaamVoorIso(code) {
  const l = LAND_REGELS.find((x) => x.iso === String(code || '').toUpperCase());

  return l ? l.naam : String(code || '');
}

const getal = (v) => {
  const n = typeof v === 'number' ? v : Number(String(v == null ? '' : v).trim());

  return String(v == null ? '' : v).trim() !== '' && Number.isFinite(n) ? n : null;
};

// Leest de opgeslagen kolom work_area (of null) tot een nette vorm; gooit nooit.
export function leesWerkgebied(ruw) {
  if (!ruw || typeof ruw !== 'object') return null;

  return {
    landen: Array.isArray(ruw.landen) ? ruw.landen.map((c) => String(c).toUpperCase()) : [],
    verfijningen: Array.isArray(ruw.verfijningen) ? ruw.verfijningen : [],
  };
}

// Wat er wordt opgeslagen: de landen uit het gekozen werkgebied en de bevestigde verfijningen die binnen een gekozen land vallen. Verandert het lid het
// werkgebied zodat een verfijning er niet meer bij hoort (bijvoorbeeld Ghana weg), dan vervalt die verfijning; het werkgebied wordt nooit aangepast.
export function werkgebiedVoorOpslag(regioTekst, verfijningen) {
  const landen = isoCodesUitWerkgebied(regioTekst);
  const uit = [];

  for (const v of Array.isArray(verfijningen) ? verfijningen : []) {
    const id = Number(v && v.geonamesId);
    const landcode = String((v && v.landcode) || '').toUpperCase();
    const naam = String((v && v.naam) || '').replace(/\s+/g, ' ').trim();

    if (!Number.isInteger(id) || id <= 0 || !naam || !landen.includes(landcode) || uit.some((x) => x.geonamesId === id)) continue;

    uit.push({ geonamesId: id, naam, landcode, lat: getal(v.lat), lng: getal(v.lng) });
    if (uit.length >= MAX_VERFIJNINGEN) break;
  }

  return { landen, verfijningen: uit };
}
