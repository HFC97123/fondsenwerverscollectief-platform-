// Herbruikbare werkbalk boven een beheerlijst: zoekveld links, acties rechts.
// Gebruikt door Funders en Subsidieregelingen/Deadlines; later ook door de
// Classification Workspace en waar logisch andere beheerpagina's.
import React from 'react';
import { css } from '../../../shared/lib/css.js';
import { searchInputStyle } from './adminStyles.js';

export default function AdminToolbar({ search, onSearchChange, searchPlaceholder = 'Zoeken…', children }) {
  return (
    <div
      style={css(`
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        flex-wrap: wrap;
        margin-bottom: 16px;
      `)}
    >
      {typeof onSearchChange === 'function' ? (
        <input
          type="search"
          value={search || ''}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          style={searchInputStyle}
        />
      ) : (
        <span />
      )}

      {children ? (
        <div style={css('display: flex; gap: 10px; flex-wrap: wrap; align-items: center;')}>{children}</div>
      ) : null}
    </div>
  );
}
