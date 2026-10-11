// Deeplinks naar de projectfinanciering: de ENE plek die het pad bepaalt.
// Gebruikt door Mijn deadlines, de toevoegdialoog (succes en "staat al in"), Dashboard en Projecten.
// Alleen een geldig project-id (uuid) komt in een pad; een ongeldig id valt terug op het projectenoverzicht.
import { isEchtId } from '../../../data/services/projecten.js';

export const TAB_PROJECTFINANCIERING = 'projectfinanciering';

export function projectFinancieringPad(projectId) {
  return isEchtId(projectId) ? `/kompas/projecten/${projectId}?tab=${TAB_PROJECTFINANCIERING}` : '/kompas/projecten';
}

export function projectFinancieringHref(projectId) {
  return `#${projectFinancieringPad(projectId)}`;
}
