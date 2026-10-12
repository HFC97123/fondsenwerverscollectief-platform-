// Actieplan: wat moet er nu gebeuren? Volledig AFGELEID uit de stand van het dekkingsplan; er is geen takentabel,
// geen opslag en geen AI bij het bepalen van de acties. Een actie verdwijnt omdat de status van een regel
// verandert, niet omdat iemand iets afvinkt.
//
// Pure functies (geen React, geen netwerk). Invoer is dezelfde als die van mijnDeadlines():
//   projecten        = store.projects
//   regelsPerProject = { [projectId]: regelUitRpc[] } (kompas_dekkingsplan, al gemaskeerd naar het abonnement)
// Dit bestand wordt gebruikt door de Deadlines-pagina, het Dashboard en de kolom "Volgende stap" in het project.
import { ACTIEVE_STATUSSEN, dagenTekst, dagenTot, dekkingVanProject, formatEuro } from './dekkingsplan.js';

// De drempels (in dagen). Eén plek, één keer getest.
export const DREMPEL_WEEK = 7; // Deze week: deadline binnen 7 dagen (of verstreken)
export const DREMPEL_HOOG = 14; // Prioriteit hoog: deadline binnen 14 dagen (of verstreken)
export const DREMPEL_MAAND = 30; // Deze maand: 8 t/m 30 dagen; daarna Later
// Een beslissing van een financier komt meestal binnen ongeveer deze periode. Alleen een TEKST: zonder
// indieningsdatum rekenen we hier niets mee uit.
export const BESLISTERMIJN_MAANDEN = 4;

export const PERIODEN = ['week', 'maand', 'later'];
export const PERIODE_LABEL = { week: 'Deze week', maand: 'Deze maand', later: 'Later' };
export const PRIORITEIT_LABEL = { hoog: 'Hoog', normaal: 'Normaal' };

// Vaste codes voor "Bespreek met Subsidie Kompas". De Chat kent per code een vaste openingsvraag; er gaat nooit
// vrije tekst in een adres. Een onbekende code wordt genegeerd.
export const VRAAG_CODES = ['aanvraag-afronden', 'eligibility', 'opvolgen', 'gat-dekken', 'nieuwe-ronde'];

export const ACTIE_TYPES = [
  'deadline-verstreken',
  'beslis-nu',
  'aanvraag-afronden',
  'eligibility',
  'deadline-instellen',
  'opvolgen',
  'beslissing-afwachten',
  'bedrag-toegekend-invullen',
  'begroting-invullen',
  'eerste-financier',
  'gat-dekken',
];

const PERIODE_RANG = { week: 0, maand: 1, later: 2 };
const PRIORITEIT_RANG = { hoog: 0, normaal: 1 };

// De periode volgt uit het aantal dagen tot de datum; zonder datum is het Later.
export function periodeVoorDagen(dagen) {
  if (dagen == null) return 'later';
  if (dagen <= DREMPEL_WEEK) return 'week'; // ook verstreken (negatief)
  if (dagen <= DREMPEL_MAAND) return 'maand';

  return 'later';
}

// Een eigen opvolgdatum bij Aangevraagd (de interne datum waarop het lid een beslissing verwacht of wil opvolgen).
// Bewust apart van isKomendeDeadline(), die alleen actieve regels telt: Dashboard en Deadlines veranderen hierdoor niet.
export function opvolgDatum(regel) {
  if (!regel || regel.status !== 'submitted' || !regel.eigenDeadline) return null;

  const iso = String(regel.eigenDeadline).slice(0, 10);

  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

function maakActie(basis, extra) {
  return {
    id: `${basis.regelId || basis.projectId}:${extra.type}`,
    projectId: basis.projectId,
    projectNaam: basis.projectNaam,
    regelId: basis.regelId || null,
    regelNaam: basis.regelNaam || '',
    bronType: basis.bronType || null,
    datum: null,
    dagen: null,
    reden: '',
    hint: '',
    vraag: null,
    ...extra,
  };
}

function dagenReden(dagen, label = 'deadline') {
  if (dagen == null) return '';

  return dagen < 0 ? `${label} verstreken` : `${label} ${dagenTekst(dagen)}`;
}

// Eén actie voor één regel (de belangrijkste), of null als er voor deze regel niets te doen is.
export function actieVoorRegel(regel, project, nu) {
  if (!regel || regel.status === 'rejected') return null;

  const basis = { projectId: project.id, projectNaam: project.naam || 'Naamloos project', regelId: regel.id, regelNaam: regel.naam || '', bronType: regel.bronType };

  if (regel.status === 'awarded') {
    // Alleen als zowel het toegekende als het aangevraagde bedrag ontbreekt; anders telt het aangevraagde bedrag al mee.
    if (regel.awarded == null && regel.requested == null) {
      return maakActie(basis, { type: 'bedrag-toegekend-invullen', tekst: 'Vul het toegekende bedrag in', reden: 'zonder bedrag telt deze toekenning niet mee', prioriteit: 'normaal', periode: 'later' });
    }

    return null;
  }

  if (regel.status === 'submitted') {
    const datum = opvolgDatum(regel);
    const dagen = datum ? dagenTot(datum, nu) : null;

    if (dagen != null && dagen <= DREMPEL_HOOG) {
      return maakActie(basis, { type: 'opvolgen', tekst: 'Opvolgen: beslissing verwacht', reden: dagenReden(dagen, 'opvolgdatum'), datum, dagen, prioriteit: 'hoog', periode: periodeVoorDagen(dagen), vraag: 'opvolgen' });
    }

    if (dagen != null) {
      return maakActie(basis, { type: 'beslissing-afwachten', tekst: 'Beslissing afwachten', reden: dagenReden(dagen, 'opvolgdatum'), datum, dagen, prioriteit: 'normaal', periode: periodeVoorDagen(dagen), vraag: 'opvolgen' });
    }

    return maakActie(basis, {
      type: 'beslissing-afwachten',
      tekst: 'Beslissing afwachten',
      reden: `meestal binnen circa ${BESLISTERMIJN_MAANDEN} maanden`,
      prioriteit: 'normaal',
      periode: 'later',
      vraag: 'opvolgen',
    });
  }

  // interesting of preparing: de effectieve deadline (eigen datum of live brondatum) is leidend.
  const datum = regel.deadline ? String(regel.deadline).slice(0, 10) : null;
  const dagen = datum ? dagenTot(datum, nu) : null;
  const hint = regel.requested == null ? 'Bedrag ontbreekt' : '';
  const voorbereiden = regel.status === 'preparing';

  if (dagen != null && dagen < 0) {
    return maakActie(basis, { type: 'deadline-verstreken', tekst: 'Deadline verstreken: kies een nieuwe ronde of pas de status aan', reden: dagenReden(dagen), datum, dagen, hint, prioriteit: 'hoog', periode: 'week', vraag: 'nieuwe-ronde' });
  }

  if (dagen != null && dagen <= DREMPEL_HOOG) {
    return maakActie(basis, {
      type: voorbereiden ? 'aanvraag-afronden' : 'beslis-nu',
      tekst: voorbereiden ? 'Aanvraag afronden' : 'Beslis nu of u aanvraagt',
      reden: dagenReden(dagen),
      datum,
      dagen,
      hint,
      prioriteit: 'hoog',
      periode: periodeVoorDagen(dagen),
      vraag: voorbereiden ? 'aanvraag-afronden' : 'eligibility',
    });
  }

  if (dagen != null) {
    return maakActie(basis, {
      type: voorbereiden ? 'aanvraag-afronden' : 'eligibility',
      tekst: voorbereiden ? 'Aanvraag afronden' : 'Controleer of u in aanmerking komt en bepaal het bedrag',
      reden: dagenReden(dagen),
      datum,
      dagen,
      hint,
      prioriteit: 'normaal',
      periode: periodeVoorDagen(dagen),
      vraag: voorbereiden ? 'aanvraag-afronden' : 'eligibility',
    });
  }

  // Zonder deadline: Later.
  if (voorbereiden) {
    return maakActie(basis, { type: 'deadline-instellen', tekst: 'Stel een deadline in', reden: 'zonder deadline kunt u niet plannen', hint, prioriteit: 'normaal', periode: 'later', vraag: 'aanvraag-afronden' });
  }

  return maakActie(basis, { type: 'eligibility', tekst: 'Controleer of u in aanmerking komt en bepaal het bedrag', reden: 'geen deadline bekend', hint, prioriteit: 'normaal', periode: 'later', vraag: 'eligibility' });
}

// Acties op projectniveau: begroting ontbreekt, nog geen financiers, of nog een gat te dekken.
export function actiesVoorProject(project, regels, nu) {
  const lijst = Array.isArray(regels) ? regels.filter(Boolean) : [];
  const dekking = dekkingVanProject(project, lijst);
  const basis = { projectId: project.id, projectNaam: project.naam || 'Naamloos project' };
  const uit = [];

  if (!dekking.heeftBegroting) {
    // Hoog, maar zonder datum: Deze maand zodat het niet onder "Later" verdwijnt.
    uit.push(maakActie(basis, { type: 'begroting-invullen', tekst: 'Vul de projectbegroting in', reden: 'zonder begroting kan de dekking niet worden berekend', prioriteit: 'hoog', periode: 'maand' }));
  }

  if (lijst.length === 0) {
    uit.push(maakActie(basis, { type: 'eerste-financier', tekst: 'Voeg uw eerste financier toe', reden: 'er staat nog geen financiering in dit project', prioriteit: 'normaal', periode: 'later', vraag: 'gat-dekken' }));
  } else if (dekking.heeftBegroting && dekking.nogTePlannen > 0) {
    uit.push(
      maakActie(basis, {
        type: 'gat-dekken',
        tekst: `Nog ${formatEuro(dekking.nogTePlannen)} te plannen: zoek een aanvullende financier`,
        reden: 'de begroting is nog niet volledig gedekt',
        prioriteit: 'normaal',
        periode: 'later',
        vraag: 'gat-dekken',
      }),
    );
  }

  return uit;
}

// Sortering: periode, prioriteit, datum (eerst), naam.
export function sorteerActies(acties) {
  return (acties || []).slice().sort(
    (a, b) =>
      PERIODE_RANG[a.periode] - PERIODE_RANG[b.periode] ||
      PRIORITEIT_RANG[a.prioriteit] - PRIORITEIT_RANG[b.prioriteit] ||
      String(a.datum || '9999-12-31').localeCompare(String(b.datum || '9999-12-31')) ||
      `${a.projectNaam} ${a.regelNaam}`.localeCompare(`${b.projectNaam} ${b.regelNaam}`, 'nl') ||
      String(a.id).localeCompare(String(b.id)),
  );
}

// DE afleiding. Gearchiveerde projecten tellen niet mee (zoals bij mijnDeadlines).
export function leidActiesAf({ projecten, regelsPerProject, nu }) {
  const uit = [];

  (projecten || [])
    .filter((p) => p && !p.gearchiveerd)
    .forEach((p) => {
      const regels = (regelsPerProject && regelsPerProject[p.id]) || [];

      regels.forEach((r) => {
        const a = actieVoorRegel(r, p, nu);

        if (a) uit.push(a);
      });
      actiesVoorProject(p, regels, nu).forEach((a) => uit.push(a));
    });

  return sorteerActies(uit);
}

// { week: [], maand: [], later: [] }
export function groepeerPerPeriode(acties) {
  const groepen = { week: [], maand: [], later: [] };

  (acties || []).forEach((a) => {
    if (groepen[a.periode]) groepen[a.periode].push(a);
  });

  return groepen;
}

export function filterOpProject(acties, projectId) {
  return projectId ? (acties || []).filter((a) => a.projectId === projectId) : acties || [];
}

// De kolom "Volgende stap" in het project: { [regelId]: actie }.
export function volgendeStapPerRegel(acties) {
  const kaart = {};

  (acties || []).forEach((a) => {
    if (a.regelId && !kaart[a.regelId]) kaart[a.regelId] = a;
  });

  return kaart;
}

// Het Dashboard: de eerste n acties van dezelfde lijst.
export function actiesVoorDashboard(acties, max = 5) {
  return (acties || []).slice(0, max);
}

export function telActies(acties) {
  const lijst = acties || [];

  return { totaal: lijst.length, hoog: lijst.filter((a) => a.prioriteit === 'hoog').length };
}

// Is dit een regel in een actieve status? (hulp voor de Deadlines-pagina)
export const isActieveRegel = (regel) => Boolean(regel) && ACTIEVE_STATUSSEN.indexOf(regel.status) !== -1;
