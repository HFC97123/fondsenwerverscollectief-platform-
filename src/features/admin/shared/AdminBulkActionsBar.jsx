// Toont het aantal geselecteerde rijen zodra bulk-selectie actief is.
// Nu alleen "selectie wissen"; dit is bewust de plek waar de latere
// Classification Workspace bulk-acties (bijv. "markeer als beoordeeld")
// aan toevoegt, zonder de architectuur van Funders/Subsidieregelingen te
// hoeven wijzigen.
import React from 'react';
import { css } from '../../../shared/lib/css.js';
import { bulkBarStyle, plainButtonStyle } from './adminStyles.js';

export default function AdminBulkActionsBar({ count, onClear, children }) {
  if (!count) {
    return null;
  }

  return (
    <div style={bulkBarStyle}>
      <span style={css('font-size: 13.5px; font-weight: 800; color: #2F6D47;')}>
        {count} {count === 1 ? 'item' : "item's"} geselecteerd
      </span>

      <span style={css('display: flex; gap: 10px; flex-wrap: wrap; align-items: center;')}>
        {children}
        <button type="button" onClick={onClear} style={plainButtonStyle}>
          Selectie wissen
        </button>
      </span>
    </div>
  );
}
