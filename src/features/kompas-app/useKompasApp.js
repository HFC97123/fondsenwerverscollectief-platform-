// Adapter: geeft de Kompas-pagina's de velden die zij verwachten, opgebouwd uit
// AuthProvider en de routering. Zo hoefden de goedgekeurde pagina's niet te
// worden aangeraakt bij het verleggen naar de nieuwe structuur.
import { useAuth } from '../../app/providers/AuthProvider.jsx';
import { useAuthModal } from '../../app/providers/AuthModalProvider.jsx';
import { naar } from '../../app/routes.js';

const TIER_LABEL = { free: 'Free', pro: 'Pro', premium: 'Premium' };

export function useApp() {
  const auth = useAuth();
  const authModal = useAuthModal();

  return {
    subscriptionTier: auth.tier,
    // Voor weergave: Admin overschrijft de pakketnaam (een beheerder heeft
    // volledige toegang, los van welk pakket er toevallig op het profiel
    // staat), verder gewoon Free/Pro/Premium.
    tierLabel: auth.isBeheerder ? 'Admin' : TIER_LABEL[auth.tier] || 'Free',
    isLoggedIn: auth.isIngelogd,
    isAdmin: auth.isBeheerder,
    isFree: auth.isFree,
    isPro: auth.isPro,
    isPremium: auth.isPremium,
    profile: auth.profile,
    naam: auth.naam,

    proefActief: auth.proefActief,
    proefEind: auth.proefEind,
    startProefperiode: auth.startProefperiode,

    canUploadFiles: auth.magUploaden,
    canUseHistory: auth.magGeschiedenis,
    canUseKnowledgeBase: auth.magKennisbank,
    canUsePrivateDatabase: auth.magPrivedatabase,
    canUseOrganizationMemory: auth.magOrganisatiegeheugen,

    // Centrale login/registratie-overlay: werkt vanaf elke Kompas-pagina,
    // ook de publieke (geen verplicht inlogscherm vooraf — dit is uitsluitend
    // voor het moment dat een bezoeker zelf voor Pro/Premium of een
    // persoonlijke functie kiest). requireAuth voert de actie direct uit als
    // de gebruiker al is ingelogd, en anders pas na een geslaagde
    // login/registratie — de gebruiker keert daarna terug naar dezelfde
    // plek, niet naar een andere omgeving.
    openAuth: authModal.openLogin,
    openRegister: authModal.openRegister,
    requireAuth: authModal.requireAuth,

    goAbonnementen: () => naar('/hoe-het-werkt'),
    goHome: () => naar('/'),
    goKompas: () => naar('/kompas'),
    goDeadlines: () => naar('/kompas/deadlines'),
    goOrganisatie: () => naar('/kompas/organisatie'),
    goProjecten: () => naar('/kompas/projecten'),
    goDocumentatie: () => naar('/kompas/documentatie'),
    goAccount: () => naar('/kompas/account'),
    logout: auth.logout,
  };
}
