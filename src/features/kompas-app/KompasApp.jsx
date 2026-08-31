// Ingang van de Subsidie Kompas-software. Kiest de pagina bij de route en
// zet de werkomgeving eromheen.
import React from 'react';
import { KompasProvider } from './KompasStore.jsx';
import KompasToolPage from './KompasToolPage.jsx';
import DeadlinesPage from './DeadlinesPage.jsx';
import OrganisatieprofielPage from './OrganisatieprofielPage.jsx';
import ProjectenPage from './ProjectenPage.jsx';
import DocumentatiePage from './DocumentatiePage.jsx';
import AccountPage from './AccountPage.jsx';

const PAGINAS = {
  '/subsidie-kompas': KompasToolPage,
  '/kompas': KompasToolPage,
  '/kompas/deadlines': DeadlinesPage,
  '/kompas/organisatie': OrganisatieprofielPage,
  '/kompas/projecten': ProjectenPage,
  '/kompas/documentatie': DocumentatiePage,
  '/kompas/account': AccountPage,
};

export default function KompasApp({ route }) {
  const Pagina = PAGINAS[route.pad] || KompasToolPage;

  return (
    <KompasProvider>
      <div style={{ fontFamily: "'Mulish', sans-serif" }}>
        <Pagina />
      </div>
    </KompasProvider>
  );
}
