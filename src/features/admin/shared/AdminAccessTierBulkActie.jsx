// Kleine, herbruikbare bulk-actie: kies een toegangsniveau (Free/Pro/Premium)
// en pas dat in één keer toe op de geselecteerde rijen. Gebruikt door zowel
// Funders als Subsidieregelingen/Deadlines — vandaar hier, niet in één van
// beide schermen zelf.
import React, { useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { ACCESS_TIERS } from '../../../data/services/adminFunders.js';
import { inputStyle, smallButtonStyle } from './adminStyles.js';

export default function AdminAccessTierBulkActie({ onApply, bezig }) {
  const [waarde, setWaarde] = useState('');

  return (
    <span style={css('display: flex; gap: 8px; align-items: center;')}>
      <select
        value={waarde}
        onChange={(event) => setWaarde(event.target.value)}
        style={{ ...inputStyle, minHeight: 36, padding: '7px 10px', width: 'auto' }}
      >
        <option value="">Toegangsniveau…</option>
        {ACCESS_TIERS.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!waarde || bezig}
        style={smallButtonStyle}
        onClick={() => {
          onApply(waarde);
          setWaarde('');
        }}
      >
        {bezig ? 'Bezig…' : 'Toepassen'}
      </button>
    </span>
  );
}
