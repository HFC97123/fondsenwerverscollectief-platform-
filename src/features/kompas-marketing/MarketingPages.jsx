// Ingang van de Subsidie Kompas-marketing.
import React from 'react';
import HoeHetWerktPage from './HoeHetWerktPage.jsx';
import KompasFaqPage from './KompasFaqPage.jsx';

const PAGINAS = {
  '/hoe-het-werkt': HoeHetWerktPage,
  '/kompas/faq': KompasFaqPage,
};

export default function MarketingPages({ route }) {
  const Pagina = PAGINAS[route.pad] || HoeHetWerktPage;

  return (
    <div style={{ fontFamily: "'Mulish', sans-serif" }}>
      <Pagina />
    </div>
  );
}
