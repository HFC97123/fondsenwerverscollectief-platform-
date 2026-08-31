// De Subsidie Kompas-navigatiebalk: Subsidie Kompas (branding), Hoe het
// werkt, Deadlines en FAQ. Letterlijk uit het goedgekeurde ontwerp — was tot
// nu toe alleen inline aanwezig op KompasToolPage.jsx en KompasFaqPage.jsx;
// dit bestand maakt hem herbruikbaar voor de pagina's waar hij ontbrak
// (HoeHetWerktPage.jsx, DeadlinesPage.jsx), zonder de al werkende pagina's
// aan te raken.
import React from 'react';
import { css } from '../lib/css.js';
import { useApp } from '../../features/kompas-app/useKompasApp.js';

const linkStijl = css('font-size: 14.5px; font-weight: 700; color: #2C4A5E; white-space: nowrap;');
const actiefStijl = css('font-size: 14.5px; font-weight: 700; color: #4E9A6C; white-space: nowrap;');

// actief: 'werkt' | 'deadlines' | 'faq' — de huidige pagina komt als platte,
// groene tekst te staan in plaats van als link, exact zoals in het ontwerp.
// terugNaarKompas: op de marketingpagina's gaat de terugknop naar de
// Subsidie Kompas-tool (net als in het ontwerp); alleen de tool zelf gaat
// terug naar de website-home.
export default function KompasSubnav({ actief, terugNaarKompas = true, maxWidth = '1120px', toonPlan = false }) {
  const app = useApp();
  const tier = app.subscriptionTier || 'free';
  const planLabel = { free: 'Free', pro: 'Pro', premium: 'Premium' }[tier];

  const item = (key, label, href) =>
    actief === key ? (
      <span style={actiefStijl}>{label}</span>
    ) : (
      <a href={href} style={linkStijl}>
        {label}
      </a>
    );

  return (
    <div style={css('position: relative; z-index: 1; border-bottom: 1px solid #E1EAE4; background: rgba(247,249,248,0.94);')}>
      <div
        style={css(
          `max-width: ${maxWidth}; margin: 0 auto; padding: 14px clamp(16px, 4vw, 24px); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;`,
        )}
      >
        <div
          onClick={terugNaarKompas ? app.goKompas : app.goHome}
          style={css('cursor: pointer; color: #2C4A5E; font-size: 15px; font-weight: 700;')}
        >
          ← Terug naar {terugNaarKompas ? 'Subsidie Kompas' : 'Het Fondsenwervers Collectief'}
        </div>

        <div style={css('display: flex; align-items: center; flex-wrap: wrap; gap: 8px 22px; margin-left: auto;')}>
          {item('werkt', 'Hoe het werkt', '#/hoe-het-werkt')}
          {item('deadlines', 'Deadlines', '#/kompas/deadlines')}
          {item('faq', 'FAQ', '#/kompas/faq')}
        </div>

        <div style={css('display: flex; align-items: center; gap: 12px;')}>
          {toonPlan && (
            <span style={css('padding: 5px 13px; border-radius: 999px; background: #EAF4EE; color: #2F6D47; font-size: 12px; font-weight: 800;')}>
              {planLabel}
            </span>
          )}
          <span style={css('display: flex; align-items: center; gap: 10px;')}>
            <img
              src="/uploads/kompas-logo.png"
              alt="Subsidie Kompas"
              style={css('width: 30px; height: 30px; border-radius: 50%; object-fit: contain; display: block;')}
            />
            <span style={css("font-family: 'Newsreader', serif; font-size: 18px; font-weight: 600; color: #2C4A5E;")}>Subsidie Kompas</span>
          </span>
        </div>
      </div>
    </div>
  );
}
