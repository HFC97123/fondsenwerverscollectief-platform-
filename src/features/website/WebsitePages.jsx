// De publieke website van Het Fondsenwervers Collectief.
// De pagina's tonen zichzelf op basis van de vlaggen uit WebsiteProvider; de
// opbouw is die van het goedgekeurde ontwerp en is niet gewijzigd.
import React from 'react';
import { WebsiteProvider } from './WebsiteProvider.jsx';
import Header from './Header.jsx';
import Footer from './Footer.jsx';
import Chat from './Chat.jsx';
import ContactForm from './ContactForm.jsx';
import HomePage from './HomePage.jsx';
import ActueelPage from './ActueelPage.jsx';
import ArticlePage from './ArticlePage.jsx';
import NetwerkPage from './NetwerkPage.jsx';
import FellowPage from './FellowPage.jsx';
import OrgPage from './OrgPage.jsx';
import OrientPage from './OrientPage.jsx';
import CursussenPage from './CursussenPage.jsx';
import VacaturesPage from './VacaturesPage.jsx';
import JuridischePaginas from './JuridischePaginas.jsx';

export default function WebsitePages() {
  return (
    <WebsiteProvider>
      <div
        id="top"
        style={{
          fontFamily: "'Mulish', sans-serif",
          color: '#2E3A38',
          background: '#F7F9F8',
          minHeight: '100vh',
        }}
      >
        <Header />

        <HomePage />
        <ActueelPage />
        <ArticlePage />
        <NetwerkPage />
        <FellowPage />
        <OrgPage />
        <OrientPage />
        <CursussenPage />
        <VacaturesPage />
        <JuridischePaginas />

        <ContactForm />
        <Footer />
        <Chat />
      </div>
    </WebsiteProvider>
  );
}
