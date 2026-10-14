// Acties & deadlines van één project: ÉÉN overzicht van de opgeslagen taken (tabel subsidie_kompas_program_actions) en de
// afgeleide acties (acties.js, berekend uit de stand van het dekkingsplan, niet opgeslagen). Pure functies; geen opslag.
//
// Regels:
//  * Opgeslagen en afgeleid blijven herkenbaar (soort 'taak' of 'afgeleid'); er is geen tweede lijst of tweede opslag.
//  * Dezelfde verplichting komt één keer voor: heeft een financieringsregel een openstaande opgeslagen taak, dan wordt de
//    afgeleide actie van die regel niet óók getoond (de taak erft de fondsdeadline). Een fondsdeadline zonder opgeslagen
//    taak blijft zichtbaar als afgeleide actie; er wordt geen kunstmatige taak voor aangemaakt.
//  * Een taak aan een regel zonder eigen datum ERFT de effectieve deadline van die regel (live, nooit een kopie).
//    Een ingevulde datum is de interne streefdatum; de externe fondsdeadline blijft daarnaast herkenbaar.
//  * Als de fondsdeadline na het voorstel is gewijzigd (bron_deadline_bij_voorstel), wordt dat getoond; de gekozen
//    streefdatum wordt nooit overschreven.
import { dagenTot } from './dekkingsplan.js';
import { leidActiesAf } from './acties.js';
import { actieGroep, ACTIE_GROEPEN, verbergAlOpgeslagen } from './actieplan.js';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const datum = (v) => (v && ISO.test(String(v).slice(0, 10)) ? String(v).slice(0, 10) : '');
const PRIO_RANG = { high: 0, normal: 1, low: 2 };

export const SOORT = { TAAK: 'taak', AFGELEID: 'afgeleid' };
export const DATUM_SOORT = { STREEF: 'streef', EXTERN: 'extern', GEEN: 'geen' };

// De externe deadline van een regel (live): eigen deadline van het lid of de live brondatum, zoals het dekkingsplan die geeft.
const externVan = (regel) => (regel ? datum(regel.deadline) : '');

function taakItem(taak, regel, nu) {
  const streef = datum(taak.deadline);
  const extern = taak.fundingId ? externVan(regel) : '';
  const effectief = streef || extern;
  const bij = datum(taak.bronDeadlineBijVoorstel);
  const gewijzigd = taak.fundingId && bij && extern && bij !== extern ? { van: bij, naar: extern } : null;
  const sleutel = `taak:${taak.id}`;

  return {
    sleutel,
    soort: SOORT.TAAK,
    projectId: taak.projectId,
    regelId: taak.fundingId || null,
    regelNaam: regel && regel.naam ? regel.naam : '',
    titel: taak.titel,
    status: taak.status,
    prioriteit: taak.prioriteit,
    datum: effectief,
    datumSoort: streef ? DATUM_SOORT.STREEF : extern ? DATUM_SOORT.EXTERN : DATUM_SOORT.GEEN,
    streefdatum: streef,
    externeDeadline: extern,
    externeDeadlineGewijzigd: gewijzigd,
    voorgesteld: taak.bron === 'chat',
    // Een voorgestelde taak die het lid na het opslaan zelf heeft gewijzigd (titel, datum, status of notitie).
    aangepastDoorLid: taak.bron === 'chat' && Boolean(taak.gemaakt) && Boolean(taak.bijgewerkt) && new Date(taak.bijgewerkt) - new Date(taak.gemaakt) > 5000,
    taak,
    afgeleid: null,
    dagen: effectief ? dagenTot(effectief, nu) : null,
  };
}

function afgeleidItem(a, nu) {
  const d = datum(a.datum);

  return {
    sleutel: `afgeleid:${a.id}`,
    soort: SOORT.AFGELEID,
    projectId: a.projectId,
    regelId: a.regelId || null,
    regelNaam: a.regelNaam || '',
    titel: a.tekst,
    status: 'todo',
    prioriteit: a.prioriteit === 'hoog' ? 'high' : 'normal',
    datum: d,
    // Een afgeleide datum is altijd de externe deadline of opvolgdatum van de regel, nooit een interne streefdatum.
    datumSoort: d ? DATUM_SOORT.EXTERN : DATUM_SOORT.GEEN,
    streefdatum: '',
    externeDeadline: d,
    externeDeadlineGewijzigd: null,
    voorgesteld: false,
    reden: a.reden || '',
    taak: null,
    afgeleid: a,
    dagen: d ? dagenTot(d, nu) : null,
  };
}

// Alle items van één project, ongegroepeerd en gesorteerd (datum, prioriteit, titel).
export function bouwActiesEnDeadlines({ project, regels, taken, nu }) {
  const lijstRegels = Array.isArray(regels) ? regels : [];
  const lijstTaken = (Array.isArray(taken) ? taken : []).filter((t) => !project || t.projectId === project.id);
  const regelVan = (id) => lijstRegels.find((r) => r.id === id) || null;
  const openMetRegel = new Set(lijstTaken.filter((t) => t.status !== 'done' && t.fundingId).map((t) => t.fundingId));

  const afgeleid = project
    ? verbergAlOpgeslagen(leidActiesAf({ projecten: [project], regelsPerProject: { [project.id]: lijstRegels }, nu }), lijstTaken)
        // Dezelfde verplichting maar één keer: een openstaande taak aan de regel erft de fondsdeadline.
        .filter((a) => !(a.regelId && openMetRegel.has(a.regelId)))
    : [];

  const items = [...lijstTaken.map((t) => taakItem(t, regelVan(t.fundingId), nu)), ...afgeleid.map((a) => afgeleidItem(a, nu))];

  return items.sort(
    (a, b) =>
      String(a.datum || '9999-12-31').localeCompare(String(b.datum || '9999-12-31')) ||
      PRIO_RANG[a.prioriteit] - PRIO_RANG[b.prioriteit] ||
      (a.soort === b.soort ? 0 : a.soort === SOORT.TAAK ? -1 : 1) ||
      a.titel.localeCompare(b.titel, 'nl') ||
      a.sleutel.localeCompare(b.sleutel),
  );
}

// { 'te-laat': [], week: [], maand: [], later: [], zonder: [], klaar: [] }
export function groepeerActiesEnDeadlines(items, nu) {
  const groepen = {};

  ACTIE_GROEPEN.forEach((g) => {
    groepen[g] = [];
  });
  (items || []).forEach((i) => groepen[actieGroep({ status: i.status, deadline: i.datum }, nu)].push(i));

  return groepen;
}

export const telOpen = (items) => (items || []).filter((i) => i.status !== 'done').length;
export const telTeLaat = (items, nu) => (items || []).filter((i) => i.status !== 'done' && i.datum && dagenTot(i.datum, nu) < 0).length;
