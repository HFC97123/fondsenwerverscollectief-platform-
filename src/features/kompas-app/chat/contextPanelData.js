// Afleidingen voor de rechter contextkolom van de chat (Pro/Premium).
// Alleen lezen en samenvatten, en uitsluitend uit de bestaande bronnen:
//   - project: subsidie_kompas_programs (via de store)
//   - financiering: subsidie_kompas_program_funding via kompas_dekkingsplan (reeds gemaskeerd naar het abonnement
//     door regelUitRpc) en dezelfde rekenmodule als Dashboard en projectdossier (financiering/dekkingsplan.js)
//   - documenten: subsidie_kompas_knowledge_items (via project.docs in de store)
//   - organisatie: het organisatieprofiel van de huidige gebruiker (store)
// Er is hier geen eigen berekening, geen linked_schemes, geen opslag en geen payload voor het model.
import { dekkingVanProject, eerstvolgendeDeadline } from '../financiering/dekkingsplan.js';
import { organisatieVolledigheid } from '../dashboard/dashboardData.js';

export const MAX_REGELS = 3;
export const MAX_DOCUMENTEN = 3;

// Volgorde van relevantie voor de chat: wat nu loopt eerst, dan wat al is toegekend, dan ideeën, afgewezen onderaan.
const STATUS_RANG = { preparing: 0, submitted: 1, awarded: 2, interesting: 3, rejected: 4 };

function deadlineSleutel(regel) {
  return regel && regel.deadline ? String(regel.deadline).slice(0, 10) : '9999-12-31';
}

// Top-N relevante financieringsregels. De regels zijn al gemaskeerd (naam, fonds en systeemdeadline van een
// verborgen bron zijn leeg); hier wordt niets extra's opgehaald of onthuld.
export function topFinancieringsregels(regels, max = MAX_REGELS) {
  return (regels || [])
    .filter((r) => r && r.id)
    .slice()
    .sort((a, b) => {
      const ra = STATUS_RANG[a.status] ?? 9;
      const rb = STATUS_RANG[b.status] ?? 9;

      return ra - rb || deadlineSleutel(a).localeCompare(deadlineSleutel(b)) || String(a.naam).localeCompare(String(b.naam), 'nl');
    })
    .slice(0, max);
}

// Documenten van EEN project (nieuwste eerst, vervangen versies tellen niet mee).
export function documentenVanProject(project, max = MAX_DOCUMENTEN) {
  const alle = ((project && project.docs) || [])
    .filter((d) => d && !d.vervangen)
    .map((d) => ({ id: d.id, naam: d.naam || 'Document', soort: d.soort || 'Overig', versie: d.versie || 1, gemaakt: d.gemaakt || null }))
    .sort((a, b) => String(b.gemaakt || '').localeCompare(String(a.gemaakt || '')));

  return { laatste: alle.slice(0, max), totaal: alle.length };
}

// Alles voor het paneel in één keer. fundingStatus: 'laden' | 'klaar' | 'fout' | 'geen-database'.
export function bouwContextPanel({ project, regels, fundingStatus, orgProfile, nu }) {
  const org = organisatieVolledigheid(orgProfile);
  const organisatie = { naam: org.naam, pct: org.pct, ingevuld: org.ingevuld, totaal: org.totaal };

  if (!project) {
    return { project: null, financiering: null, documenten: null, organisatie };
  }

  const klaar = fundingStatus === 'klaar';
  const lijst = klaar ? regels || [] : [];

  return {
    project: {
      id: project.id,
      naam: project.naam || 'Naamloos project',
      meta: [project.regio, [project.periodeVan, project.periodeTot].filter(Boolean).join(' – ')].filter(Boolean).join(' · '),
      dekking: klaar ? dekkingVanProject(project, lijst) : null,
      volgendeDeadline: klaar ? eerstvolgendeDeadline(lijst, nu || new Date()) : null,
    },
    financiering: {
      status: fundingStatus,
      regels: topFinancieringsregels(lijst),
      totaal: lijst.length,
    },
    documenten: documentenVanProject(project),
    organisatie,
  };
}
