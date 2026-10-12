// Voorstellen uit de projectomschrijving onder een classificatieveld: "Voorgesteld uit uw omschrijving: + Ouderen".
// Eén klik neemt een voorstel over, het kruisje verbergt het. Niets wordt automatisch opgeslagen of toegepast.
import React from 'react';
import { css } from '../../../shared/lib/css.js';

export default function TrefwoordVoorstellen({ testid, voorstellen, onKies, onNegeer }) {
  if (!voorstellen || !voorstellen.length) {
    return null;
  }

  return (
    // preventDefault: het veld staat in een <label>; een klik op een voorstel mag het veld erboven niet openen.
    <span data-testid={testid} onClick={(e) => e.preventDefault()} style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; margin-top: 2px;')}>
      <span style={css('font-size: 12.5px; font-weight: 700; color: #7B8985;')}>Voorgesteld uit uw omschrijving:</span>
      {voorstellen.map((v) => (
        <span key={v.naam} style={css('display: inline-flex; align-items: stretch; border: 1px solid #BFD4C6; border-radius: 999px; background: #EAF4EE; overflow: hidden;')}>
          <button
            type="button"
            data-testid={`${testid}-kies`}
            data-naam={v.naam}
            onClick={() => onKies(v.naam)}
            title={`Herkend: ${v.trefwoorden.join(', ')}`}
            style={css("cursor: pointer; min-height: 32px; padding: 4px 6px 4px 12px; border: none; background: none; font-family: 'Mulish', sans-serif; font-size: 13px; font-weight: 800; color: #2F6D47;")}
          >
            + {v.naam}
          </button>
          <button
            type="button"
            data-testid={`${testid}-negeer`}
            aria-label={`${v.naam} niet voorstellen`}
            onClick={() => onNegeer(v.naam)}
            style={css("cursor: pointer; min-width: 32px; min-height: 32px; padding: 0 10px 0 4px; border: none; background: none; font-family: 'Mulish', sans-serif; font-size: 15px; font-weight: 700; line-height: 1; color: #7B8985;")}
          >
            ×
          </button>
        </span>
      ))}
    </span>
  );
}
