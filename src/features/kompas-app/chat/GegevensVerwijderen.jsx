// "Gegevens verwijderen": de bestaande privacyacties uit de vroegere lade (Eerdere gesprekken), ongewijzigd van
// gedrag - alleen verplaatst naar de gesprekkenkolom en de Gesprekken-sheet. De acties zelf (store.clearConversations,
// store.clearOrgProfile) en hun teksten blijven dezelfde; dit component bevat geen eigen logica.
import React from 'react';
import { css } from '../../../shared/lib/css.js';

const KNOP = css(
  "cursor: pointer; box-sizing: border-box; min-height: 44px; display: inline-flex; align-items: center; padding: 10px 16px; border: 1px solid #E1D3D0; border-radius: 999px; background: #FFFFFF; color: #9E3B2C; font-family: 'Mulish', sans-serif; font-size: 13px; font-weight: 700; text-align: left;",
);

export default function GegevensVerwijderen({ onAlleGesprekken, onOrganisatie, melding, open = false }) {
  return (
    <details data-testid="gegevens-verwijderen" open={open || undefined} style={css('margin-top: 6px; padding-top: 10px; border-top: 1px solid #E1EAE4;')}>
      <summary style={css("cursor: pointer; min-height: 32px; font-family: 'Mulish', sans-serif; font-size: 12.5px; font-weight: 800; color: #7B8985;")}>Gegevens verwijderen</summary>
      <div style={css("margin: 8px 0 12px; font-family: 'Mulish', sans-serif; font-size: 12.5px; line-height: 1.6; color: #536460;")}>
        U bepaalt zelf wat Subsidie Kompas van u bewaart. Verwijderen kan niet worden teruggedraaid; wat u weghaalt gebruikt Subsidie Kompas niet meer in adviezen en aanvragen.
      </div>
      <div style={css('display: flex; flex-direction: column; gap: 8px; align-items: flex-start;')}>
        <button type="button" data-testid="alle-gesprekken-verwijderen" onClick={onAlleGesprekken} style={KNOP}>
          Alle gesprekken verwijderen
        </button>
        <button type="button" data-testid="organisatie-gegevens-verwijderen" onClick={onOrganisatie} style={KNOP}>
          Informatie over mijn organisatie verwijderen
        </button>
      </div>
      {melding && (
        <div
          role="status"
          style={css("margin-top: 10px; padding: 10px 12px; border: 1px solid #BFD4C6; border-radius: 12px; background: #EAF4EE; font-family: 'Mulish', sans-serif; font-size: 13px; font-weight: 700; color: #2F6D47;")}
        >
          {melding}
        </div>
      )}
    </details>
  );
}
