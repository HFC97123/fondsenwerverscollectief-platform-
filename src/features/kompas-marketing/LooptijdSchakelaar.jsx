// Schakelaar voor de looptijd van een Pro- of Premium-abonnement (maand, kwartaal, half jaar, jaar).
// Uitsluitend weergave/keuze in de browser: de gekozen looptijd bepaalt nooit een bedrag. De server
// valideert de looptijd opnieuw en rekent zelf (zie data/abonnementen.js en create-checkout-session).
import React, { useRef } from 'react';
import { css } from '../../shared/lib/css.js';
import { LOOPTIJDEN, LOOPTIJD_INFO } from '../../data/abonnementen.js';

const GROEP = css(
  'display: inline-flex; flex-wrap: wrap; justify-content: center; gap: 2px; padding: 4px; border-radius: 14px; background: #EAF1EE; border: 1px solid #D6E3DD; max-width: 100%;',
);

function knopStijl(actief, uitgeschakeld) {
  return css(`
    cursor: ${uitgeschakeld ? 'default' : 'pointer'};
    box-sizing: border-box;
    flex: 1 1 auto;
    min-height: 40px;
    padding: 8px 16px;
    border: none;
    border-radius: 11px;
    background: ${actief ? '#FFFFFF' : 'transparent'};
    color: ${actief ? '#2C4A5E' : '#4B5C58'};
    box-shadow: ${actief ? '0 1px 4px rgba(44, 74, 94, 0.18)' : 'none'};
    font-family: 'Mulish', sans-serif;
    font-size: 14px;
    font-weight: ${actief ? '800' : '700'};
    white-space: nowrap;
    opacity: ${uitgeschakeld && !actief ? '0.55' : '1'};
  `);
}

export default function LooptijdSchakelaar({ waarde, onChange, uitgeschakeld = false, label = 'Kies hoe lang u vooruit betaalt' }) {
  const knoppen = useRef({});

  const kies = (code) => {
    if (!uitgeschakeld && code !== waarde) {
      onChange(code);
    }
  };

  // Pijltjestoetsen verplaatsen de keuze (zoals bij een gewone radiogroep).
  const bijToets = (e, index) => {
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;

    if (!delta) {
      return;
    }

    e.preventDefault();

    const volgende = LOOPTIJDEN[(index + delta + LOOPTIJDEN.length) % LOOPTIJDEN.length];

    kies(volgende);

    const knop = knoppen.current[volgende];

    if (knop) {
      knop.focus();
    }
  };

  return (
    <div role="radiogroup" aria-label={label} style={GROEP} data-testid="looptijd-schakelaar">
      {LOOPTIJDEN.map((code, index) => {
        const actief = code === waarde;

        return (
          <button
            key={code}
            aria-label={LOOPTIJD_INFO[code].label}
            ref={(el) => {
              knoppen.current[code] = el;
            }}
            type="button"
            role="radio"
            aria-checked={actief}
            tabIndex={actief ? 0 : -1}
            disabled={uitgeschakeld && !actief}
            data-looptijd={code}
            onClick={() => kies(code)}
            onKeyDown={(e) => bijToets(e, index)}
            style={knopStijl(actief, uitgeschakeld)}
          >
            {LOOPTIJD_INFO[code].kort}
          </button>
        );
      })}
    </div>
  );
}
