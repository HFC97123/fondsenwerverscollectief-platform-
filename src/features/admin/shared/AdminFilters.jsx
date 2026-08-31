// Herbruikbare filterpillen. Zelfde visuele patroon als de bestaande
// filterpillen in AdminPage.jsx (CollectionSection): actief = groene rand/
// achtergrond, inactief = grijze rand. Eén groep per filterdimensie
// (bijv. data_tier, source_type, classification_reviewed, prioriteit).
import React from 'react';
import { css } from '../../../shared/lib/css.js';
import { filterPillStyle } from './adminStyles.js';

// groups: [{ key, label, options: [{ value, label, count }] , value, onChange }]
export default function AdminFilters({ groups }) {
  if (!groups || !groups.length) {
    return null;
  }

  return (
    <div style={css('display: flex; flex-direction: column; gap: 10px; margin-bottom: 18px;')}>
      {groups.map((group) => (
        <div key={group.key} style={css('display: flex; align-items: center; gap: 10px; flex-wrap: wrap;')}>
          <span
            style={css(`
              font-size: 12px;
              font-weight: 800;
              letter-spacing: 0.04em;
              text-transform: uppercase;
              color: #82918B;
              flex: 0 0 auto;
            `)}
          >
            {group.label}
          </span>

          <span style={css('display: flex; gap: 8px; flex-wrap: wrap;')}>
            {group.options.map((option) => (
              <button
                key={String(option.value)}
                type="button"
                onClick={() => group.onChange(option.value)}
                style={filterPillStyle(group.value === option.value)}
              >
                {option.label}
                {typeof option.count === 'number' ? ` (${option.count})` : ''}
              </button>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}
