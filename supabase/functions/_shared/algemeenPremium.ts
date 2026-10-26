// Algemene Premium-fondsen die in een Premium-voorstel altijd minstens één keer meedoen in de dekking: weinig bekende vermogensfondsen die bij bijna elk
// maatschappelijk project aangevuld kunnen worden (nu 't Trekpaert, Pieter Bastiaan, Cordius en Virtutis Opus). Afspraak (Aisya, 26-10-2026): ze doen
// gewoon mee in de dekking, als elk ander fonds, en Premium heeft er altijd een tussen staan. De lijst groeit in de loop van de tijd: een fonds toevoegen
// is een naam in KENMERKEN hieronder.
//
// ZUIVER: geen database, geen netwerk, geen modelaanroep. Of een fonds past, beslist de bestaande engine (harde voorwaarden, fit, genoeg score): past er
// geen enkel, dan komt er ook geen; nooit een zwakke match toevoegen om de regel te halen.

// Herkenningswoorden (zonder "Stichting" en leestekens): "Stichting 't Trekpaert", "'t Trekpaert" en "Trekpaert" zijn hetzelfde fonds.
const KENMERKEN = ['trekpaert', 'pieter bastiaan', 'cordius', 'virtutis opus'];

const norm = (t: unknown): string =>
  String(t ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function isAlgemeenPremium(naam: unknown): boolean {
  const n = norm(naam);

  return n !== '' && KENMERKEN.some((k) => n === k || n === `stichting ${k}` || n.endsWith(` ${k}`) || n.startsWith(`${k} `));
}

// Hoeveel punten onder de beste mag een fonds scoren om nog in de afwisseling mee te doen.
export const ALGEMEEN_PREMIUM_BAND = 10;

const hash = (t: string): number => {
  let h = 0;

  for (let i = 0; i < t.length; i += 1) h = (h * 31 + t.charCodeAt(i)) >>> 0;

  return h;
};

// De volgorde waarin de algemene fondsen worden geprobeerd: de sterkste, en bij een nagenoeg gelijke score (binnen ALGEMEEN_PREMIUM_BAND punten) wisselt de
// eerste per project af, zodat niet elk project hetzelfde fonds krijgt. De rest volgt op score. Dezelfde invoer geeft altijd dezelfde volgorde.
export function algemeenPremiumVolgorde<T>(lijst: readonly T[], projectId: string, score: (x: T) => number, naam: (x: T) => string): T[] {
  if (!lijst.length) return [];

  const gesorteerd = [...lijst].sort((a, b) => score(b) - score(a) || naam(a).localeCompare(naam(b), 'nl'));
  const top = score(gesorteerd[0]);
  const band = gesorteerd.filter((x) => score(x) >= top - ALGEMEEN_PREMIUM_BAND);
  const eerste = band[hash(String(projectId ?? '')) % band.length];

  return [eerste, ...gesorteerd.filter((x) => x !== eerste)];
}
