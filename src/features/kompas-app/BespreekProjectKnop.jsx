// "Bespreek met Subsidie Kompas" op een projectkaart: de ene aanvullende actie naast de kaartklik. Rustig van
// vorm (tekstlink-stijl, geen tweede grote knop). Alleen navigatie: geeft het project door aan de Chat via de
// bestaande onBespreek-functie van de pagina. Ligt boven de klikbare kaart (fwk-kk-boven), dus een klik hierop
// activeert nooit ook de kaartnavigatie.
import React from 'react';
import { css } from '../../shared/lib/css.js';

export default function BespreekProjectKnop({ onClick, naam = '' }) {
  return (
    <button
      type="button"
      className="fwk-kk-boven fwk-bespreek"
      data-testid="bespreek-project"
      aria-label={naam ? `Bespreek met Subsidie Kompas: ${naam}` : 'Bespreek met Subsidie Kompas'}
      onClick={onClick}
      style={css("cursor: pointer; display: inline-flex; align-items: center; align-self: flex-start; min-height: 44px; padding: 0 2px; border: none; background: none; font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 800; color: #2C4A5E;")}
    >
      Bespreek met Subsidie Kompas →
    </button>
  );
}
