// Bedragen uit tekst halen en vergelijken. Puur, zonder netwerk.

export const KOERS_NAAR_EUR = { EUR: 1, USD: 0.92, GBP: 1.17 }; // grove omrekening; staat in de toelichting als er is omgerekend

const MULT = { miljoen: 1e6, mln: 1e6, million: 1e6, m: 1e6, duizend: 1e3, k: 1e3 };

export function normaliseer(s) {
  return String(s ?? '')
    .normalize('NFKC')
    .replace(/[­​‌‍﻿]/g, '')
    .replace(/[   ]/g, ' ')
    .replace(/[‘’‚`´]/g, "'")
    .replace(/[“”„«»]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// "15.000" -> 15000, "1,380" -> 1380, "12,5" -> 12.5, "4.576.000,-" -> 4576000. null als het geen getal is.
export function parseGetal(ruw) {
  let s = String(ruw ?? '').trim().replace(/[,.]\s?[-–—]+$/, '').replace(/\s/g, '');
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s);
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ''));
  if (/^\d+[.,]\d{1,2}$/.test(s)) return Number(s.replace(',', '.'));
  if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(s)) return Number(s.replace(/\./g, '').replace(',', '.'));
  if (/^\d{1,3}(,\d{3})+\.\d{1,2}$/.test(s)) return Number(s.replace(/,/g, ''));
  return null;
}

const VALUTA_VOOR = '(€|EUR|US\\$|USD|\\$|£|GBP)';
const MULT_RE = '(miljoen|mln|million|duizend|k|m)';
const NUM = '(\\d(?:[\\d.,]*\\d)?(?:,\\s?[-–—])?)';
const RE_VOOR = new RegExp(`${VALUTA_VOOR}\\s?${NUM}(?:\\s?${MULT_RE}(?![a-zA-Z]))?`, 'gi');
const RE_NA = new RegExp(`${NUM}\\s?${MULT_RE}?\\s?(euro|EUR)(?![a-zA-Z])`, 'gi');

function valutaVan(sym) {
  const s = sym.toLowerCase();
  if (s === '€' || s === 'eur' || s === 'euro') return 'EUR';
  if (s === '£' || s === 'gbp') return 'GBP';
  return 'USD';
}

// Alle geldbedragen in een tekst: [{ waarde, valuta, tekst, index }]. Percentages en jaartallen zonder valutateken tellen niet mee.
export function vindBedragen(tekst) {
  const uit = [];
  const t = String(tekst ?? '');
  for (const m of t.matchAll(RE_VOOR)) {
    const basis = parseGetal(m[2]);
    if (basis == null) continue;
    const mult = m[3] ? MULT[m[3].toLowerCase()] ?? 1 : 1;
    uit.push({ waarde: Math.round(basis * mult * 100) / 100, valuta: valutaVan(m[1]), tekst: m[0], index: m.index });
  }
  for (const m of t.matchAll(RE_NA)) {
    const basis = parseGetal(m[1]);
    if (basis == null) continue;
    const mult = m[2] ? MULT[m[2].toLowerCase()] ?? 1 : 1;
    uit.push({ waarde: Math.round(basis * mult * 100) / 100, valuta: 'EUR', tekst: m[0], index: m.index });
  }
  return uit;
}

export function vindPercentages(tekst) {
  return [...String(tekst ?? '').matchAll(/(\d{1,3}(?:[.,]\d+)?)\s?(?:%|procent)/gi)].map((m) => Number(m[1].replace(',', '.')));
}

export function naarEuro(waarde, valuta) {
  const k = KOERS_NAAR_EUR[valuta];
  return k == null ? null : Math.round(waarde * k);
}

// Kwantiel met lineaire interpolatie op een gesorteerde lijst.
export function kwantiel(gesorteerd, p) {
  if (!gesorteerd.length) return null;
  if (gesorteerd.length === 1) return gesorteerd[0];
  const pos = (gesorteerd.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return gesorteerd[lo] + (gesorteerd[hi] - gesorteerd[lo]) * (pos - lo);
}

// Afronden op een "mooi" getal: omlaag voor een ondergrens, omhoog voor een bovengrens. 1.380 -> 1.300 / 1.400, 15.000 -> 15.000, 696.127 -> 700.000.
export function rondAf(x, richting) {
  if (x == null || !Number.isFinite(x) || x <= 0) return x == null ? null : 0;
  const stap = 10 ** Math.max(0, Math.floor(Math.log10(x)) - 1);
  const f = x / stap;
  return (richting === 'omlaag' ? Math.floor(f + 1e-9) : Math.ceil(f - 1e-9)) * stap;
}
