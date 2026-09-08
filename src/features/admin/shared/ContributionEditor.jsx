// Gedeeld "Bijdrage"-veld voor Funders en Subsidieregelingen (Beheer-UX-
// consolidatie): één gestructureerde bandbreedte (uit de centrale
// bandbreedtes_bijdrage-lijst) plus een optionele vrije toelichting (bijv.
// "Min. €3.000", "Tot 50% van de projectkosten"). Vervangt de eerdere twee
// gelijkwaardige, verwarrende velden "Bedrag" (bijdrage_min/bijdrage_max
// resp. bedrag_min/bedrag_max, vrij intypen) en "Bandbreedte bijdrage" (losse
// select) door één duidelijke categorie: de bandbreedte is de primaire
// classificatie, de toelichting is de nuance.
//
// bijdrage_min/bijdrage_max (funders) resp. bedrag_min/bedrag_max
// (subsidieregelingen) blijven onder water precies bestaan zoals ze al
// deden — dit component toont en bewerkt ze bewust niet (geen automatische
// tekst-naar-bedrag-parsing, die kan fouten opleveren), zodat een beheerder
// niet hetzelfde bedrag drie keer hoeft in te voeren. De aanroepende pagina
// stuurt de bestaande min/max-waarden ongewijzigd mee bij het opslaan.
import React from 'react';
import { css } from '../../../shared/lib/css.js';
import { inputStyle } from './adminStyles.js';

export default function ContributionEditor({
  bandbreedteId,
  onBandbreedteChange,
  toelichting,
  onToelichtingChange,
  bandbreedteOpties,
  toelichtingPlaceholder = 'bijv. "Min. €3.000", "Maximaal 50% van de projectkosten"',
}) {
  return (
    <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 16px;')}>
      <label style={css('display: grid; gap: 6px; font-size: 13px; font-weight: 700; color: #2C4A5E;')}>
        Bandbreedte
        <select
          style={inputStyle}
          value={bandbreedteId || ''}
          onChange={(e) => onBandbreedteChange(e.target.value)}
        >
          <option value="">Niet ingedeeld</option>
          {(bandbreedteOpties || []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.naam}
            </option>
          ))}
        </select>
      </label>
      <label
        style={css(
          'display: grid; gap: 6px; font-size: 13px; font-weight: 700; color: #2C4A5E; grid-column: span 2;',
        )}
      >
        Bijdrage toelichting (optioneel)
        <input
          style={inputStyle}
          value={toelichting || ''}
          onChange={(e) => onToelichtingChange(e.target.value)}
          placeholder={toelichtingPlaceholder}
        />
      </label>
    </div>
  );
}
