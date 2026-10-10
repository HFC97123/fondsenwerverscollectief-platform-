// De Subsidie Kompas-navigatiebalk: terugknop, Hoe het werkt, Deadlines, FAQ en rechtsboven de
// vaste "Subsidie Kompas"-knop. Letterlijk uit het goedgekeurde ontwerp - dit is de ENE gedeelde
// kop voor het hele Subsidie Kompas-gebied (tool, deadlines, FAQ, hoe het werkt, abonneren,
// wachtwoord instellen en de werkomgevingspagina's organisatie/projecten/documenten/account).
// Gebruik deze component op elke nieuwe Subsidie Kompas-pagina i.p.v. een eigen kopie van de kop.
//
// De knop rechtsboven ("Subsidie Kompas", logo + naam) is de vaste Home-knop van het gebied: hij
// brengt de gebruiker altijd terug naar de hoofdroute van de chatbot (#/kompas, zie
// HOOFDROUTE_CHATBOT hieronder en routes.js) en gebruikt daarvoor de bestaande hash-navigatie
// (app.goKompas -> naar('/kompas')): geen paginaherlading.
import React from 'react';
import { css } from '../lib/css.js';
import { useApp } from '../../features/kompas-app/useKompasApp.js';

const linkStijl = css('font-size: 14.5px; font-weight: 700; color: #2C4A5E; white-space: nowrap;');
const actiefStijl = css('font-size: 14.5px; font-weight: 700; color: #4E9A6C; white-space: nowrap;');

const TIER_LABEL = { free: 'Free', pro: 'Pro', premium: 'Premium' };

// Dezelfde route als goKompas in useKompasApp.js en de chatbot-route in routes.js (/subsidie-kompas
// is een alias die dezelfde pagina toont).
const HOOFDROUTE_CHATBOT = '#/kompas';

// Opmaak en gedrag op kleine schermen. Inline stijlen blijven de bron voor desktop; deze regels
// werken alleen op smalle schermen: terugknop en Subsidie Kompas-knop delen de bovenste regel (knop
// rechts), de overige navigatie komt eronder.
const NAV_CSS = `
.fwk-subnav-home { transition: background-color .15s ease, border-color .15s ease; }
.fwk-subnav-home:hover { background: #EAF4EE !important; border-color: #A8D5BA !important; }
.fwk-subnav-home:focus-visible { outline: 2px solid #4E9A6C; outline-offset: 2px; }
.fwk-subnav-terug-kort { display: none; }
@media (max-width: 760px) {
  .fwk-subnav-terug { order: 1; flex: 1 1 0 !important; min-width: 0; }
  .fwk-subnav-terug-lang { display: none; }
  .fwk-subnav-terug-kort { display: inline; }
  .fwk-subnav-home { order: 2; margin-left: auto; }
  .fwk-subnav-nav { order: 3; flex-basis: 100%; margin-left: 0 !important; }
  .fwk-subnav-plan { order: 4; }
}
`;

// actief: 'werkt' | 'deadlines' | 'faq' - de huidige pagina komt als platte,
// groene tekst te staan in plaats van als link, exact zoals in het ontwerp.
// terugNaarKompas: op de marketingpagina's gaat de terugknop naar de
// Subsidie Kompas-tool (net als in het ontwerp); alleen de tool zelf gaat
// terug naar de website-home.
export default function KompasSubnav({ actief, terugNaarKompas = true, maxWidth = '1120px', toonPlan = false }) {
  const app = useApp();
  const tier = app.subscriptionTier || 'free';
  // Compacte statusindicator: naam + abonnement, uitsluitend zichtbaar
  // zolang er echt iets Pro/Premium (of Admin) te tonen is - zie
  // toonPlanLabel hieronder.
  const tierLabel = app.isAdmin ? 'Admin' : TIER_LABEL[tier] || 'Free';
  // Zichtbaar zodra er echt iets te tonen is: Admin (bestaand gedrag), of een
  // account met een actief Subsidie Kompas Pro/Premium-abonnement. Een
  // FWC-account zonder actief abonnement gedraagt zich hier zichtbaar als
  // Free, dus zonder badge - net als een anonieme bezoeker.
  const toonPlanLabel = app.isAdmin || tier === 'pro' || tier === 'premium';
  const planLabel = `${app.naam || 'Mijn account'} · ${tierLabel}`;

  const item = (key, label, href) =>
    actief === key ? (
      <span style={actiefStijl}>{label}</span>
    ) : (
      <a href={href} style={linkStijl}>
        {label}
      </a>
    );

  // Klik op de Subsidie Kompas-knop: client-side naar de chatbot. Staat de gebruiker al op de
  // chatbotpagina, dan blijft de route gelijk en scrollen we alleen naar boven.
  const naarChatbot = (event) => {
    event.preventDefault();

    const hash = window.location.hash || '';

    if (hash === HOOFDROUTE_CHATBOT || hash === '#/subsidie-kompas') {
      window.scrollTo(0, 0);

      return;
    }

    app.goKompas();
  };

  return (
    <div style={css('position: relative; z-index: 1; border-bottom: 1px solid #E1EAE4; background: rgba(247,249,248,0.94);')}>
      <style>{NAV_CSS}</style>
      <div
        style={css(
          `max-width: ${maxWidth}; margin: 0 auto; padding: 14px clamp(16px, 4vw, 24px); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;`,
        )}
      >
        <div
          className="fwk-subnav-terug"
          onClick={terugNaarKompas ? app.goKompas : app.goHome}
          style={css('cursor: pointer; color: #2C4A5E; font-size: 15px; font-weight: 700;')}
        >
          <span className="fwk-subnav-terug-lang">← Terug naar {terugNaarKompas ? 'Subsidie Kompas' : 'Het Fondsenwervers Collectief'}</span>
          <span className="fwk-subnav-terug-kort">← Terug</span>
        </div>

        <div className="fwk-subnav-nav" style={css('display: flex; align-items: center; flex-wrap: wrap; gap: 8px 22px; margin-left: auto;')}>
          {item('werkt', 'Hoe het werkt', '#/hoe-het-werkt')}
          {item('deadlines', 'Deadlines', '#/kompas/deadlines')}
          {item('faq', 'FAQ', '#/kompas/faq')}
        </div>

        {toonPlan && toonPlanLabel && (
          <span
            className="fwk-subnav-plan"
            title={`Je bent ingelogd als: ${planLabel}`}
            style={css('padding: 5px 13px; border-radius: 999px; background: #EAF4EE; color: #2F6D47; font-size: 12px; font-weight: 800;')}
          >
            {planLabel}
          </span>
        )}

        <a
          className="fwk-subnav-home"
          href={HOOFDROUTE_CHATBOT}
          onClick={naarChatbot}
          title="Terug naar de Subsidie Kompas-chatbot"
          style={css(
            'display: inline-flex; align-items: center; gap: 10px; min-height: 42px; padding: 4px 16px 4px 6px; border: 1px solid #CFE0D6; border-radius: 999px; background: #FFFFFF; text-decoration: none; cursor: pointer; box-sizing: border-box;',
          )}
        >
          <img
            src="/uploads/kompas-logo.png"
            alt=""
            style={css('width: 30px; height: 30px; border-radius: 50%; object-fit: contain; display: block;')}
          />
          <span style={css("font-family: 'Newsreader', serif; font-size: 18px; font-weight: 600; color: #2C4A5E; white-space: nowrap;")}>Subsidie Kompas</span>
        </a>
      </div>
    </div>
  );
}
