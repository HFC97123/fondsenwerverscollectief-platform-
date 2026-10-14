// Afleidingen voor het Projectoverzicht rechts van de chat (Pro/Premium), alleen bij een actief project.
// Alleen lezen en samenvatten, en uitsluitend uit de bestaande bronnen:
//   - project: subsidie_kompas_programs (via de store)
//   - financiering: subsidie_kompas_program_funding via kompas_dekkingsplan (reeds gemaskeerd naar het abonnement
//     door regelUitRpc) en dezelfde rekenmodule als Dashboard en projectdossier (financiering/dekkingsplan.js)
// Documenten en organisatie staan hier bewust NIET meer: die hebben hun primaire plek in Documenten en
// Organisatieprofiel. De AI-runtime (Edge Function, buildContext) leest ze nog steeds zelf; dit overzicht is
// uitsluitend weergave en stuurt niets naar het model.
import { dekkingVanProject, eerstvolgendeDeadline, periodeTekst } from '../financiering/dekkingsplan.js';

export const MAX_REGELS = 3;

// Volgorde van relevantie voor de chat: wat nu loopt eerst, dan wat al is toegekend, dan ideeën, afgewezen onderaan.
const STATUS_RANG = { preparing: 0, submitted: 1, awarded: 2, interesting: 3, rejected: 4, withdrawn: 5 };

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

// Alles voor het paneel in één keer. fundingStatus: 'laden' | 'klaar' | 'fout' | 'geen-database'.
export function bouwContextPanel({ project, regels, fundingStatus, nu }) {
  if (!project) {
    return { project: null, financiering: null };
  }

  const klaar = fundingStatus === 'klaar';
  const lijst = klaar ? regels || [] : [];

  return {
    project: {
      id: project.id,
      naam: project.naam || 'Naamloos project',
      locatie: project.regio || '',
      looptijd: periodeTekst(project.periodeVan, project.periodeTot),
      dekking: klaar ? dekkingVanProject(project, lijst) : null,
      volgendeDeadline: klaar ? eerstvolgendeDeadline(lijst, nu || new Date()) : null,
    },
    financiering: {
      status: fundingStatus,
      regels: topFinancieringsregels(lijst),
      totaal: lijst.length,
    },
  };
}
