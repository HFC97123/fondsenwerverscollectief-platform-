// Ingang van de Subsidie Kompas-software. Kiest de pagina bij de route en
// zet de werkomgeving eromheen.
import React from 'react';
import { useAuth } from '../../app/providers/AuthProvider.jsx';
import { KompasProvider } from './KompasStore.jsx';
import KompasToolPage from './KompasToolPage.jsx';
import DeadlinesPage from './DeadlinesPage.jsx';
import OrganisatieprofielPage from './OrganisatieprofielPage.jsx';
import ProjectenPage from './ProjectenPage.jsx';
import DocumentatiePage from './DocumentatiePage.jsx';
import AccountPage from './AccountPage.jsx';
import DashboardPage from './dashboard/DashboardPage.jsx';
import KompasWerkNav from './KompasWerkNav.jsx';
import { WerkNavContext } from './werkNavContext.js';
import KompasSubnav from '../../shared/ui/KompasSubnav.jsx';

const PAGINAS = {
  '/subsidie-kompas': KompasToolPage,
  '/kompas': KompasToolPage,
  '/kompas/dashboard': DashboardPage,
  '/kompas/deadlines': DeadlinesPage,
  '/kompas/organisatie': OrganisatieprofielPage,
  '/kompas/projecten': ProjectenPage,
  '/kompas/documentatie': DocumentatiePage,
  '/kompas/account': AccountPage,
};

// Pagina's die geen eigen kop hebben (de tool en deadlines tonen de gedeelde kop zelf): zij krijgen
// hier dezelfde Subsidie Kompas-kop, zodat de knop naar de chatbot overal bereikbaar is.
const KOP_VAN_KOMPASAPP = new Set(['/kompas/dashboard', '/kompas/organisatie', '/kompas/projecten', '/kompas/documentatie', '/kompas/account']);

export default function KompasApp({ route }) {
  const Pagina = PAGINAS[route.pad] || KompasToolPage;
  const auth = useAuth();
  const userId = (auth.user && auth.user.id) || null;
  // Pro/Premium (en beheerders) krijgen de werkruimte-navigatie; dezelfde regel als
  // hasPlanTools in KompasToolPage. Free en niet-ingelogde bezoekers houden de
  // bestaande KompasSubnav, ongewijzigd.
  const heeftWerkNav = Boolean(auth.isBeheerder || auth.isPro || auth.isPremium);

  // key={userId}: bij uitloggen/inloggen met een ander account wordt de hele
  // werkomgeving (organisatieprofiel, projecten, gesprekken) opnieuw en leeg
  // opgebouwd. Organisatiegegevens zijn zo altijd gekoppeld aan het user_id
  // van de huidige gebruiker en blijven nooit hangen bij het volgende account.
  return (
    <KompasProvider key={userId || 'anoniem'} userId={userId}>
      <WerkNavContext.Provider value={heeftWerkNav}>
        <div style={{ fontFamily: "'Mulish', sans-serif" }}>
          {heeftWerkNav ? <KompasWerkNav pad={route.pad} /> : KOP_VAN_KOMPASAPP.has(route.pad) && <KompasSubnav toonPlan />}
          <Pagina />
        </div>
      </WerkNavContext.Provider>
    </KompasProvider>
  );
}
