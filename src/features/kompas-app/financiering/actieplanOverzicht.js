// Actieplan-overzicht: wat is nu de volgende stap, wat komt daarna en hoe loopt het project? Pure functies (geen React, geen netwerk).
// Invoer zijn de items uit bouwActiesEnDeadlines() (opgeslagen taken en afgeleide acties in één lijst), de projecten en de datum van vandaag.
//
// Regels (Aisya, 26-10-2026):
//  * Bovenaan staat één actie: "nu aan de beurt", met daaronder hooguit drie "hierna". Een uitslag die we afwachten is geen actie
//    en staat dus niet in dat rijtje, wel op de tijdlijn.
//  * Het go/no-go-moment ligt 6 weken vóór de startdatum van het project: dan moet de financiering rond zijn.
//  * Een uitslag die ná het go/no-go-moment valt, krijgt een waarschuwing.
import { dagenTot, formatDatum } from './dekkingsplan.js';

export const GO_NOGO_DAGEN = 42; // 6 weken
export const HIERNA_MAX = 3;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const PRIO_RANG = { high: 0, normal: 1, low: 2 };

export const iso = (v) => (v && ISO.test(String(v).trim().slice(0, 10)) ? String(v).trim().slice(0, 10) : '');

export function plusDagen(isoDatum, n) {
  const d = new Date(`${isoDatum}T00:00:00Z`);

  d.setUTCDate(d.getUTCDate() + n);

  return d.toISOString().slice(0, 10);
}

// De datum van vandaag als ISO-tekst (lokale datum, zoals de rest van het actieplan).
export function vandaagIso(nu) {
  const d = nu instanceof Date ? nu : new Date(nu);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dag = String(d.getDate()).padStart(2, '0');

  return `${d.getFullYear()}-${m}-${dag}`;
}

export const FASE_LABEL = { navragen: 'Contact', indienen: 'Indienen', besluit: 'Uitslag', overig: '' };

// In welke fase van het fonds hoort een actie? Opgeslagen taken kennen de fase van het voorstel (planning_fase); oudere taken en
// afgeleide acties worden herkend aan hun soort of aan de vaste titel.
export function faseVan(item) {
  const fase = item && item.taak && item.taak.fase;

  if (fase === 'navragen' || fase === 'indienen' || fase === 'besluit') return fase;

  const type = item && item.afgeleid && item.afgeleid.type;

  if (type === 'beslissing-afwachten' || type === 'opvolgen') return 'besluit';
  if (type === 'aanvraag-afronden' || type === 'beslis-nu' || type === 'deadline-verstreken') return 'indienen';
  if (type === 'eligibility') return 'navragen';

  const titel = String((item && item.titel) || '');

  if (/^contact opnemen/i.test(titel)) return 'navragen';
  if (/^uitslag van .* verwacht/i.test(titel)) return 'besluit';
  if (/^aanvraag bij .* indienen/i.test(titel)) return 'indienen';

  return 'overig';
}

// Het go/no-go-moment van een project: 6 weken vóór de startdatum. Zonder geldige startdatum is er geen.
export function goNoGoDatum(project) {
  const start = iso(project && project.periodeVan);

  return start ? plusDagen(start, -GO_NOGO_DAGEN) : '';
}

const volgorde = (a, b) =>
  String(a.datum || '9999-12-31').localeCompare(String(b.datum || '9999-12-31')) ||
  (PRIO_RANG[a.prioriteit] ?? 1) - (PRIO_RANG[b.prioriteit] ?? 1) ||
  String(a.titel).localeCompare(String(b.titel), 'nl') ||
  String(a.sleutel).localeCompare(String(b.sleutel));

// { nu: item | null, hierna: item[] }. Items zijn open acties; het go/no-go-moment van elk project in beeld komt als mijlpaal in "hierna".
export function bepaalNuEnHierna({ items, projecten, nu, max = HIERNA_MAX }) {
  const vandaag = vandaagIso(nu);
  const open = (items || []).filter((i) => i.status !== 'done' && faseVan(i) !== 'besluit').sort(volgorde);
  const eerste = open[0] || null;
  const mijlpalen = (projecten || [])
    .map((p) => ({ p, datum: goNoGoDatum(p) }))
    .filter((x) => x.datum && x.datum >= vandaag)
    .map((x) => ({
      sleutel: `gonogo:${x.p.id}`,
      soort: 'mijlpaal',
      projectId: x.p.id,
      titel: 'Go/no-go: is de financiering rond?',
      datum: x.datum,
      dagen: dagenTot(x.datum, nu),
      status: 'todo',
      prioriteit: 'normal',
    }));
  const hierna = [...open.slice(1), ...mijlpalen].sort(volgorde).slice(0, max);

  return { nu: eerste, hierna };
}

// Tijdlijn van één project. Elke baan is een fonds; elk punt een actie of uitslag met een datum.
//   stijl: 'actie' (gewone stap) | 'klaar' (afgerond) | 'uitslag-ok' | 'uitslag-laat' (uitslag ná het go/no-go-moment)
export function bouwTijdlijn({ project, items, nu, fondsVan = (i) => i.regelNaam || '' }) {
  const vandaag = vandaagIso(nu);
  const start = iso(project && project.periodeVan);
  const eind = iso(project && project.periodeTot);
  const gonogo = goNoGoDatum(project);
  const mijn = (items || []).filter((i) => i.projectId === project.id);
  // Een afgeronde actie uit het verleden staat niet meer op de tijdlijn: die begint bij vandaag.
  const metDatum = mijn.filter((i) => iso(i.datum) && !(i.status === 'done' && iso(i.datum) < vandaag));
  const zonderDatum = mijn.filter((i) => !iso(i.datum) && i.status !== 'done').length;
  const banen = new Map();
  const waarschuwingen = [];

  metDatum
    .slice()
    .sort(volgorde)
    .forEach((i) => {
      const fonds = fondsVan(i) || 'Overige acties';
      const fase = faseVan(i);
      const datum = iso(i.datum);
      let stijl = i.status === 'done' ? 'klaar' : 'actie';

      if (fase === 'besluit' && i.status !== 'done' && gonogo) {
        stijl = datum > gonogo ? 'uitslag-laat' : 'uitslag-ok';

        if (stijl === 'uitslag-laat') waarschuwingen.push({ fonds, datum, gonogo });
      }

      if (!banen.has(fonds)) banen.set(fonds, { fonds, punten: [] });

      banen.get(fonds).punten.push({ sleutel: i.sleutel, datum, fase, label: FASE_LABEL[fase] || String(i.titel).slice(0, 18), titel: i.titel, stijl });
    });

  const alleDatums = [vandaag, ...metDatum.map((i) => iso(i.datum)), start, eind, gonogo].filter(Boolean).sort();
  const van = alleDatums[0];
  const tot = plusDagen(alleDatums[alleDatums.length - 1], 7);

  return {
    projectId: project.id,
    naam: project.naam || 'Naamloos project',
    start,
    eind,
    gonogo,
    vandaag,
    van,
    tot,
    banen: Array.from(banen.values()),
    waarschuwingen,
    zonderDatum,
    maanden: maandMarkeringen(van, tot),
  };
}

// Positie (0 tot 100) van een datum op de tijdlijn.
export function positie(tijdlijn, datum) {
  const a = Date.parse(`${tijdlijn.van}T00:00:00Z`);
  const b = Date.parse(`${tijdlijn.tot}T00:00:00Z`);
  const x = Date.parse(`${datum}T00:00:00Z`);

  if (!(b > a)) return 0;

  return Math.max(0, Math.min(100, ((x - a) / (b - a)) * 100));
}

const MND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

// De eerste van elke maand binnen het bereik (de eerste maand alleen als die niet vóór het begin valt).
export function maandMarkeringen(van, tot) {
  const uit = [];
  const d = new Date(`${van}T00:00:00Z`);

  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);

  while (d.toISOString().slice(0, 10) <= tot && uit.length < 40) {
    const datum = d.toISOString().slice(0, 10);

    uit.push({ datum, label: `${MND[d.getUTCMonth()]}${d.getUTCMonth() === 0 ? ` ${d.getUTCFullYear()}` : ''}` });
    d.setUTCMonth(d.getUTCMonth() + 1);
  }

  return uit;
}

// '2 nov' (zonder jaar), voor de labels op de tijdlijn.
export function kortDatum(d) {
  const x = iso(d);

  return x ? `${Number(x.slice(8, 10))} ${MND[Number(x.slice(5, 7)) - 1]}` : '';
}

export function waarschuwingTekst(w) {
  return `De uitslag van ${w.fonds} (${formatDatum(w.datum)}) komt ná uw go/no-go-moment (${formatDatum(w.gonogo)}, 6 weken voor de start). Vraag bij het contact of er een eerdere vergadering is, of zoek een extra fonds.`;
}
