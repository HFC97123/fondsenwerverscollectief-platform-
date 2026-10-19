// Het langzaam draaiende kompas met zwevende euro-tekens op de achtergrond (uit het oorspronkelijke ontwerp).
// Alleen versiering: onzichtbaar voor hulpsoftware, geen klikken, en met "beweging verminderen" in het systeem staat alles stil.
// Wordt in een omhullend element met `position: relative; overflow: hidden` geplaatst en vult dat element.
import React from 'react';
import { css } from '../../shared/lib/css.js';

const KEYFRAMES = `
@keyframes sk-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes sk-spin-rev { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
@keyframes sk-euro-a { 0% { transform: translateY(20px) rotate(-8deg); opacity: 0; } 14% { opacity: 0.4; } 86% { opacity: 0.4; } 100% { transform: translateY(-120px) rotate(8deg); opacity: 0; } }
@keyframes sk-euro-b { 0% { transform: translateY(30px) rotate(6deg); opacity: 0; } 16% { opacity: 0.4; } 84% { opacity: 0.4; } 100% { transform: translateY(-140px) rotate(-6deg); opacity: 0; } }
@keyframes sk-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-16px); } }
@media (prefers-reduced-motion: reduce) { .fwk-kb, .fwk-kb * { animation: none !important; } }
`;

// Positie, grootte, kleur en tempo van de zes euro-tekens (zoals in het ontwerp, hier aan de rechterkant zodat ze niet achter de tekst zweven).
const EUROS = [
  { links: '54%', boven: '62%', grootte: 46, kleur: '#4E9A6C', naam: 'sk-euro-a', duur: '22s', vertraging: '0s' },
  { links: '90%', boven: '40%', grootte: 30, kleur: '#A9C9DE', naam: 'sk-euro-b', duur: '26s', vertraging: '3s' },
  { links: '70%', boven: '20%', grootte: 38, kleur: '#4E9A6C', naam: 'sk-euro-a', duur: '25s', vertraging: '6s' },
  { links: '58%', boven: '78%', grootte: 26, kleur: '#A9C9DE', naam: 'sk-euro-b', duur: '23s', vertraging: '4.4s' },
  { links: '84%', boven: '30%', grootte: 34, kleur: '#4E9A6C', naam: 'sk-euro-a', duur: '28s', vertraging: '8s' },
  { links: '95%', boven: '66%', grootte: 42, kleur: '#A9C9DE', naam: 'sk-euro-b', duur: '24s', vertraging: '1.6s' },
];

export default function KompasAchtergrond() {
  return (
    <div className="fwk-kb" style={css('position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden;')} aria-hidden="true">
      <style>{KEYFRAMES}</style>

      <div
        style={css(
          'position: absolute; right: -6vw; top: 24px; width: clamp(300px, 52vw, 600px); height: clamp(300px, 52vw, 600px); animation: sk-float 20s ease-in-out infinite;',
        )}
      >
        <svg viewBox="0 0 200 200" width="100%" height="100%" style={{ opacity: 0.1 }}>
          <circle cx="100" cy="100" r="92" fill="none" stroke="#2C4A5E" strokeWidth="1.4" strokeDasharray="3 6" strokeLinecap="round" />
          <circle cx="100" cy="100" r="72" fill="none" stroke="#2C4A5E" strokeWidth="1" strokeDasharray="2 7" strokeLinecap="round" />
          <g style={{ transformBox: 'view-box', transformOrigin: '100px 100px', animation: 'sk-spin-rev 100s linear infinite' }}>
            <line x1="100" y1="8" x2="100" y2="22" stroke="#2C4A5E" strokeWidth="2" strokeLinecap="round" />
            <line x1="192" y1="100" x2="178" y2="100" stroke="#2C4A5E" strokeWidth="2" strokeLinecap="round" />
            <line x1="100" y1="192" x2="100" y2="178" stroke="#2C4A5E" strokeWidth="2" strokeLinecap="round" />
            <line x1="8" y1="100" x2="22" y2="100" stroke="#2C4A5E" strokeWidth="2" strokeLinecap="round" />
          </g>
          <g style={{ transformBox: 'view-box', transformOrigin: '100px 100px', animation: 'sk-spin 44s linear infinite' }}>
            <polygon points="100,32 109,100 100,108 91,100" fill="#4E9A6C" />
            <polygon points="100,168 109,100 100,92 91,100" fill="#A9C9DE" />
            <circle cx="100" cy="100" r="5" fill="#2C4A5E" />
          </g>
        </svg>
      </div>

      {EUROS.map((e, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: e.links,
            top: e.boven,
            fontFamily: "'Newsreader', serif",
            fontSize: `${e.grootte}px`,
            fontWeight: 600,
            color: e.kleur,
            opacity: 0,
            animation: `${e.naam} ${e.duur} ease-in-out infinite ${e.vertraging}`,
          }}
        >
          €
        </div>
      ))}
    </div>
  );
}
