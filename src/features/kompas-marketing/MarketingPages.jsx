// Ingang van de Subsidie Kompas-marketing.
import React from 'react';
import HoeHetWerktPage from './HoeHetWerktPage.jsx';

const PAGINAS = {
  '/hoe-het-werkt': HoeHetWerktPage,
};

export default function MarketingPages({ route }) {
  const Pagina = PAGINAS[route.pad] || HoeHetWerktPage;

  return <Pagina />;
}
