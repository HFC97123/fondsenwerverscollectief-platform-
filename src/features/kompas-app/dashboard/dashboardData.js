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
// Begroeting en datum bovenaan het Dashboard
// ---------------------------------------------------------------------------

const WEEKDAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const MAANDEN_LANG = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const MAANDEN_KORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

// Goedemorgen (05:00-11:59), goedemiddag (12:00-17:59), anders goedenavond; naar de lokale tijd van de gebruiker.
export function groet(nu) {
  const uur = (nu || new Date()).getHours();

  if (uur >= 5 && uur < 12) return 'Goedemorgen';
  if (uur >= 12 && uur < 18) return 'Goedemiddag';

  return 'Goedenavond';
}

// De voornaam uit de weergavenaam van het lid; een e-mailadres of lege naam geeft ''.
export function eersteNaam(naam) {
  const eerste = String(naam || '').trim().split(/\s+/)[0] || '';

  return eerste.indexOf('@') === -1 ? eerste : '';
}

// 'maandag 24 oktober'
export function datumVolledig(nu) {
  const d = nu || new Date();

  return `${WEEKDAGEN[d.getDay()]} ${d.getDate()} ${MAANDEN_LANG[d.getMonth()]}`;
}

// Een ISO-datum (YYYY-MM-DD) als { dag: '2', maand: 'nov' }; leeg als de datum niet te lezen is.
export function dagEnMaand(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));

  return m ? { dag: String(Number(m[3])), maand: MAANDEN_KORT[Number(m[2]) - 1] || '' } : { dag: '', maand: '' };
}

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
  { n: 'mission', l: 'Doelstelling' },
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
