// Locatie van een project -> werkgebieden uit de database (tabel regios). ZUIVER: geen database, geen netwerk, geen taalmodel.
//
// Het veld "Werkgebied / locatie" van een project is vrije tekst ("Cariben", "Amsterdam Zuidoost", "Utrecht en Flevoland"), terwijl fondsen
// en regelingen aan een vaste lijst werkgebieden hangen. Zonder koppeling telt de locatie niet mee in de matching. Deze module legt de
// koppeling, voorzichtig en uitlegbaar:
//   - een werkgebied uit de lijst dat als geheel woord in de tekst staat (accent- en hoofdletteronafhankelijk), plus één tikfout bij lange namen;
//   - Caribische termen: een eiland van het Koninkrijk (Aruba, Curaçao, Sint Maarten, Bonaire, Sint Eustatius, Saba) wijst naar "Caribisch deel van
//     het Koninkrijk" en onthoudt het eiland; een algemene term ("Cariben", "Caribisch gebied", "Caribbean", "Antillen") is VAAG: dan worden de
//     Caribische werkgebieden gekoppeld en moet het lid het eiland nog aangeven.
// Niets wordt verzonnen: wat niet te koppelen is blijft in de uitkomst staan als "nietGekoppeld".

export const REGIO_KONINKRIJK = 'Caribisch deel van het Koninkrijk';
export const REGIO_CARIBISCH_GEBIED = 'Caribisch gebied';

export type Eiland = 'Aruba' | 'Curaçao' | 'Sint Maarten' | 'Bonaire' | 'Sint Eustatius' | 'Saba';

// Caribisch Nederland = de drie openbare lichamen (BES). Aruba, Curaçao en Sint Maarten zijn zelfstandige landen binnen het Koninkrijk.
export const CARIBISCH_NEDERLAND: readonly Eiland[] = ['Bonaire', 'Sint Eustatius', 'Saba'];

export const EILANDEN: ReadonlyArray<{ naam: Eiland; re: RegExp }> = [
  { naam: 'Aruba', re: /\baruba\b/ },
  { naam: 'Curaçao', re: /\bcura[cç]ao\b|\bcuracao\b/ },
  { naam: 'Sint Maarten', re: /\b(?:sint|st\.?|saint)[ -]?maarten\b|\bsxm\b/ },
  { naam: 'Bonaire', re: /\bbonaire\b/ },
  { naam: 'Sint Eustatius', re: /\b(?:sint|st\.?|saint)[ -]?eustatius\b|\bstatia\b/ },
  { naam: 'Saba', re: /\bsaba\b/ },
];

const CARIBISCH_NEDERLAND_RE = /\bcaribisch(?:e)? nederland\b|\bbes[- ]eilanden\b/;
const ABC_RE = /\babc[- ]eilanden\b/;
// Algemene Caribische termen: te onbepaald om een eiland af te leiden.
const CARIBISCH_ALGEMEEN_RE = /\bcarib\w*|\bcaraib\w*|\bantillen\b|\bwest-?indi\w*\b/;

export const normLocatie = (t: unknown): string =>
  String(t ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

function afstandMax1(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;

  let i = 0;
  let j = 0;
  let verschillen = 0;

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }

    verschillen += 1;

    if (verschillen > 1) return false;
    if (a.length > b.length) i += 1;
    else if (b.length > a.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }

  return verschillen + (a.length - i) + (b.length - j) <= 1;
}

export interface LocatieKoppeling {
  // Gekoppelde werkgebieden (canonieke namen uit de lijst).
  regios: string[];
  // Eilanden die uit de tekst volgen (leeg = onbekend).
  eilanden: Eiland[];
  // Caribische locatie zonder eiland: het lid moet nog aangeven welk eiland of land.
  vaag: boolean;
  // Uitleg per koppeling, voor de gebruiker.
  uitleg: string[];
  // Delen van de tekst die niet aan een werkgebied te koppelen waren (alleen informatief).
  nietGekoppeld: string[];
}

export function koppelLocatie(tekst: unknown, regios: readonly string[]): LocatieKoppeling {
  const uit: LocatieKoppeling = { regios: [], eilanden: [], vaag: false, uitleg: [], nietGekoppeld: [] };
  const t = normLocatie(tekst);

  if (!t) return uit;

  const lijst = new Map(regios.map((r) => [normLocatie(r), r] as const));
  const voeg = (naam: string, reden: string) => {
    if (!lijst.has(normLocatie(naam))) return;

    const canoniek = lijst.get(normLocatie(naam)) as string;

    if (!uit.regios.includes(canoniek)) {
      uit.regios.push(canoniek);
      uit.uitleg.push(reden);
    }
  };

  // 1. Eilanden van het Koninkrijk.
  for (const e of EILANDEN) {
    if (e.re.test(t) && !uit.eilanden.includes(e.naam)) uit.eilanden.push(e.naam);
  }

  if (CARIBISCH_NEDERLAND_RE.test(t)) for (const e of CARIBISCH_NEDERLAND) if (!uit.eilanden.includes(e)) uit.eilanden.push(e);
  if (ABC_RE.test(t)) for (const e of ['Aruba', 'Curaçao', 'Bonaire'] as Eiland[]) if (!uit.eilanden.includes(e)) uit.eilanden.push(e);

  if (uit.eilanden.length) voeg(REGIO_KONINKRIJK, `${uit.eilanden.join(', ')} hoort bij ${REGIO_KONINKRIJK}`);

  // 2. Exacte werkgebieden uit de lijst als geheel woord (langste eerst, zodat "Noord-Holland" niet ook "Holland" geeft).
  const gesorteerd = [...lijst.keys()].sort((a, b) => b.length - a.length);
  let rest = ` ${t} `;

  for (const sleutel of gesorteerd) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${sleutel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[ -]')}(?![\\p{L}\\p{N}])`, 'u');

    if (re.test(rest)) {
      voeg(lijst.get(sleutel) as string, `"${lijst.get(sleutel)}" staat in de locatie`);
      rest = rest.replace(re, ' ');
    }
  }

  // 3. Algemene Caribische term zonder eiland: vaag. Koppel beide Caribische werkgebieden, maar vraag om het eiland.
  const algemeen = CARIBISCH_ALGEMEEN_RE.test(t) && !CARIBISCH_NEDERLAND_RE.test(t);

  if (algemeen && !uit.eilanden.length) {
    uit.vaag = true;

    // Staat er al een Caribisch werkgebied letterlijk in de tekst, dan is dat de keuze van het lid; anders koppelen we beide.
    if (!uit.regios.some((r) => r === REGIO_KONINKRIJK || r === REGIO_CARIBISCH_GEBIED)) {
      voeg(REGIO_CARIBISCH_GEBIED, `"${String(tekst).trim().slice(0, 40)}" is een algemene Caribische locatie`);
      voeg(REGIO_KONINKRIJK, `"${String(tekst).trim().slice(0, 40)}" is een algemene Caribische locatie`);
    }
  }

  // 4. Eén tikfout bij een naam van minstens 7 letters (bijvoorbeeld "Rotterdm"). Alleen op losse woorden die nog niet gekoppeld zijn.
  const woorden = rest.split(/[^\p{L}-]+/u).filter((w) => w.length >= 7);

  for (const w of woorden) {
    for (const sleutel of lijst.keys()) {
      if (sleutel.length >= 7 && !sleutel.includes(' ') && afstandMax1(w, sleutel)) voeg(lijst.get(sleutel) as string, `"${w}" lijkt op "${lijst.get(sleutel)}"`);
    }
  }

  // Wat overblijft (zonder voegwoorden) is niet gekoppeld.
  const over = rest
    .split(/[,;/]|\ben\b|\bof\b/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 3 && !uit.regios.some((r) => normLocatie(r).includes(x)));

  uit.nietGekoppeld = uit.regios.length || uit.eilanden.length ? [] : over.slice(0, 4);

  return uit;
}

// Zijn er eilanden bekend die in dit werkgebied van een fonds/regeling genoemd worden? Alleen op NAAM en gever (betrouwbaar); een
// beschrijving mag soms meerdere eilanden noemen en wordt hier niet gebruikt.
export function eilandenInTekst(...teksten: unknown[]): Eiland[] {
  const t = normLocatie(teksten.filter(Boolean).join(' . '));
  const uit: Eiland[] = [];

  for (const e of EILANDEN) if (e.re.test(t) && !uit.includes(e.naam)) uit.push(e.naam);
  if (CARIBISCH_NEDERLAND_RE.test(t)) for (const e of CARIBISCH_NEDERLAND) if (!uit.includes(e)) uit.push(e);

  return uit;
}
