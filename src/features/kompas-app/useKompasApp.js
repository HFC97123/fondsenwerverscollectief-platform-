// Adapter: geeft de Kompas-pagina's de velden die zij verwachten, opgebouwd uit
// AuthProvider en de routering. Zo hoefden de goedgekeurde pagina's niet te
// worden aangeraakt bij het verleggen naar de nieuwe structuur.
import { useAuth } from '../../app/providers/AuthProvider.jsx';
import { naar } from '../../app/routes.js';

export function useApp() {
  const auth = useAuth();

  return {
    subscriptionTier: auth.tier,
    isLoggedIn: auth.isIngelogd,
    profile: auth.profile,
    naam: auth.naam,

    canUploadFiles: auth.magUploaden,
    canUseHistory: auth.magGeschiedenis,
    canUseKnowledgeBase: auth.magKennisbank,
    canUsePrivateDatabase: auth.magPrivedatabase,
    canUseOrganizationMemory: auth.magOrganisatiegeheugen,

    goAbonnementen: () => naar('/kompas#sk-abonnementen'),
    goKompas: () => naar('/kompas'),
    goDeadlines: () => naar('/kompas/deadlines'),
    goOrganisatie: () => naar('/kompas/organisatie'),
    goProjecten: () => naar('/kompas/projecten'),
    goDocumentatie: () => naar('/kompas/documentatie'),
    goAccount: () => naar('/kompas/account'),
    logout: auth.logout,
  };
}
