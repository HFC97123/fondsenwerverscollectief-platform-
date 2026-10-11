// Pure afleidingen voor het Dashboard van de Pro/Premium-werkruimte.
// Geen React, geen netwerk, geen eigen opslag: alles wordt berekend uit de bestaande bronnen
// (projecten, gesprekken, organisatieprofiel) en de projectfinanciering, zodat dit bestand apart
// getest kan worden en er nergens een tweede waarheid ontstaat.
//
// Sinds Fase 2 komt het dekkingsplan uit subsidie_kompas_program_funding (via
// kompas_dekkingsplan) en rekent het Dashboard met EXACT dezelfde module als het projectdossier:
// financiering/dekkingsplan.js. Hier staat dus geen eigen financiële rekenlogica meer.
import { dekkingVanProject, eerstvolgendeDeadline, komendeDeadlines, periodeTekst } from '../financiering/dekkingsplan.js';

export {
  ACTIEVE_STATUSSEN,
  STATUSSEN,
  STATUS_LABEL,
  berekenDekking,
  dagenTekst,
  dagenTot,
  dekkingVanProject,
  eerstvolgendeDeadline,
  formatDatum,
  formatEuro,
  formatTijd,
  isKomendeDeadline,
  komendeDeadlines,
  overigeDekkingVanProject,
  periodeTekst,
  teFinancieren,
} from '../financiering/dekkingsplan.js';

// ---------------------------------------------------------------------------
// Gesprekken, documenten, organisatie
// ---------------------------------------------------------------------------

export function recenteGesprekken(gesprekken, projecten, max = 5) {
  const naamVan = new Map((projecten || []).map((p) => [p.id, p.naam || 'Naamloos project']));

  return (gesprekken || [])
    .filter((g) => g && g.id)
    .slice()
    .sort((a, b) => String(b.tijd || '').localeCompare(String(a.tijd || '')))
    .slice(0, max)
    .map((g) => ({
      id: g.id,
      titel: g.titel || 'Gesprek',
      tijd: g.tijd || null,
      projectId: g.projectId || null,
      projectNaam: g.projectId && naamVan.has(g.projectId) ? naamVan.get(g.projectId) : null,
    }));
}

export function recenteDocumenten(projecten, max = 5) {
  const uit = [];

  (projecten || [])
    .filter((p) => p && !p.gearchiveerd)
    .forEach((p) => {
      (p.docs || [])
        .filter((d) => d && !d.vervangen)
        .forEach((d) => {
          uit.push({
            id: d.id,
            naam: d.naam || 'Document',
            soort: d.soort || 'Overig',
            versie: d.versie || 1,
            gemaakt: d.gemaakt || null,
            projectId: p.id,
            projectNaam: p.naam || 'Naamloos project',
          });
        });
    });

  return uit.sort((a, b) => String(b.gemaakt || '').localeCompare(String(a.gemaakt || ''))).slice(0, max);
}

// De kernvelden van het organisatieprofiel waar matching het meest op leunt.
export const ORGANISATIE_KERNVELDEN = [
  { n: 'name', l: 'Organisatienaam' },
  { n: 'website', l: 'Website' },
  { n: 'rechtsvorm', l: 'Rechtsvorm' },
  { n: 'kvk', l: 'KvK-nummer' },
  { n: 'mission', l: 'Missie' },
  { n: 'regio', l: 'Werkgebied' },
  { n: 'themas', l: 'Disciplines' },
  { n: 'doelgroepen', l: 'Doelgroepen' },
];

const isLeeg = (v) => (Array.isArray(v) ? v.length === 0 : !String(v == null ? '' : v).trim());

export function organisatieVolledigheid(profiel) {
  const p = profiel || {};
  const ontbreekt = ORGANISATIE_KERNVELDEN.filter((v) => isLeeg(p[v.n])).map((v) => v.l);
  const totaal = ORGANISATIE_KERNVELDEN.length;
  const ingevuld = totaal - ontbreekt.length;

  return {
    naam: String(p.name || '').trim(),
    ingevuld,
    totaal,
    pct: Math.round((ingevuld / totaal) * 100),
    ontbreekt,
  };
}

// ---------------------------------------------------------------------------
// Alles voor het Dashboard in één keer.
// funding = { [projectId]: regels[] } uit kompas_dekkingsplan (zie useDekkingsplannen).
// ---------------------------------------------------------------------------

export function bouwDashboard({ projects, funding, conversations, orgProfile, nu }) {
  const actief = (projects || []).filter((p) => p && !p.gearchiveerd);
  const perProject = funding || {};

  return {
    projecten: actief.map((p) => {
      const regels = perProject[p.id] || [];

      return {
        id: p.id,
        naam: p.naam || 'Naamloos project',
        locatie: p.regio || '',
        periode: periodeTekst(p.periodeVan, p.periodeTot),
        dekking: dekkingVanProject(p, regels),
        volgendeDeadline: eerstvolgendeDeadline(regels, nu),
        aantalRegels: regels.length,
      };
    }),
    deadlines: komendeDeadlines(actief, perProject, nu),
    gesprekken: recenteGesprekken(conversations, projects, 5),
    documenten: recenteDocumenten(actief, 5),
    organisatie: organisatieVolledigheid(orgProfile),
  };
}
