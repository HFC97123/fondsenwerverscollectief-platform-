// Herbruikbare paginering onder een AdminDataTable.
import React from 'react';
import { css } from '../../../shared/lib/css.js';
import { paginationStyle, smallButtonStyle } from './adminStyles.js';

export default function AdminPagination({ page, pageSize, total, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize));
  const van = total ? page * pageSize + 1 : 0;
  const tot = Math.min(total || 0, (page + 1) * pageSize);

  return (
    <div style={paginationStyle}>
      <span style={css('font-size: 13px; color: #82918B; font-weight: 600;')}>
        {total ? `${van}–${tot} van ${total}` : 'Geen resultaten'}
      </span>

      <span style={css('display: flex; gap: 8px; align-items: center;')}>
        <button
          type="button"
          disabled={page <= 0}
          onClick={() => onPageChange(page - 1)}
          style={{ ...smallButtonStyle, opacity: page <= 0 ? 0.5 : 1, cursor: page <= 0 ? 'default' : 'pointer' }}
        >
          Vorige
        </button>
        <span style={css('font-size: 13px; font-weight: 700; color: #536460;')}>
          Pagina {page + 1} van {totalPages}
        </span>
        <button
          type="button"
          disabled={page + 1 >= totalPages}
          onClick={() => onPageChange(page + 1)}
          style={{
            ...smallButtonStyle,
            opacity: page + 1 >= totalPages ? 0.5 : 1,
            cursor: page + 1 >= totalPages ? 'default' : 'pointer',
          }}
        >
          Volgende
        </button>
      </span>
    </div>
  );
}
