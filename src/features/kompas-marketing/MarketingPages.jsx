// Ingang van de Subsidie Kompas-marketing.
import React from 'react';
import HoeHetWerktPage from './HoeHetWerktPage.jsx';
import KompasFaqPage from './KompasFaqPage.jsx';
import WachtwoordInstellenPage from './WachtwoordInstellenPage.jsx';

const PAGINAS = {
  '/hoe-het-werkt': HoeHetWerktPage,
  '/kompas/faq': KompasFaqPage,
  '/wachtwoord-instellen': WachtwoordInstellenPage,
};

export default function MarketingPages({ route }) {
  const Pagina = PAGINAS[route.pad] || HoeHetWerktPage;

  return (
    <div style={{ fontFamily: "'Mulish', sans-serif" }}>
      <Pagina />
    </div>
  );
}
