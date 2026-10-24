// Mijn Subsidie Kompas: de tweede balk met Projecten en Organisatie (wie u bent en wat u doet). Beide pagina's bestaan al;
// deze balk verbindt ze alleen. Geen eigen opslag.
import React from 'react';
import { css } from '../../../shared/lib/css.js';

export const MIJN_STAPPEN = [
  { id: 'projecten', label: 'Projecten', pad: '/kompas/projecten' },
  { id: 'organisatie', label: 'Organisatie', pad: '/kompas/organisatie' },
];

export default function MijnSubnav({ pad }) {
  return (
    <div data-testid="mijn-subnav" style={css('border-bottom: 1px solid #E1EAE4; background: #FFFFFF;')}>
      <nav aria-label="Mijn Subsidie Kompas" style={css('max-width: 1120px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 24px); display: flex; gap: 22px;')}>
        {MIJN_STAPPEN.map((s) => {
          const actief = pad === s.pad;

          return (
            <a
              key={s.id}
              data-testid={`mijn-stap-${s.id}`}
              href={`#${s.pad}`}
              aria-current={actief ? 'page' : undefined}
              style={css(
                `padding: 11px 0; font-family: 'Mulish', sans-serif; font-size: 14.5px; font-weight: 800; text-decoration: none; color: ${actief ? '#2C4A5E' : '#7B8985'}; border-bottom: 2px solid ${actief ? '#4E9A6C' : 'transparent'};`,
              )}
            >
              {s.label}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
