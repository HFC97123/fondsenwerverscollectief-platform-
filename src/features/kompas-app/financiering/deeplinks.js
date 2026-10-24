// Deeplinks naar de projectfinanciering: de ENE plek die het pad bepaalt.
// Gebruikt door Mijn deadlines, de toevoegdialoog (succes en "staat al in"), Dashboard en Projecten.
// Alleen een geldig project-id (uuid) komt in een pad; een ongeldig id valt terug op het projectenoverzicht.
import { isEchtId } from '../../../data/services/projecten.js';
import { chatHref } from '../chat/gesprekUrl.js';
import { stapPad } from '../advies/adviesLinks.js';

export const TAB_PROJECTFINANCIERING = 'projectfinanciering';

// Sinds Subsidieadvies staat de projectfinanciering bij stap 1 (fondsmatching): /kompas/advies/fondsen?project=<id>.
export function projectFinancieringPad(projectId) {
  return isEchtId(projectId) ? stapPad('fondsen', projectId) : '/kompas/projecten';
}

export function projectFinancieringHref(projectId) {
  return `#${projectFinancieringPad(projectId)}`;
}

// FASE5 — "Bespreek met Subsidie Kompas" vanuit Projectfinanciering, Mijn deadlines, Dashboard of het contextpaneel.
// Pure link, geen schrijfactie: de chat opent het laatste bestaande gesprek van DIT project (dezelfde "ene app"),
// of anders een nieuw gesprek met dit project als startpunt. 'focus' is het id van de fundingregel; de chat valideert
// dat server-side. gesprekken: store.conversations ({ id, projectId, tijd }), nieuwste eerst of niet - hier gesorteerd.
export function bespreekHref({ projectId, fundingId = null, gesprekken = [] }) {
  const eigen = (gesprekken || [])
    .filter((g) => g && g.projectId === projectId && isEchtId(String(g.id || '')))
    .sort((a, b) => String(b.tijd || '').localeCompare(String(a.tijd || '')));

  return chatHref({ conversationId: eigen[0] ? eigen[0].id : null, projectId: eigen[0] ? null : projectId, fundingId });
}
