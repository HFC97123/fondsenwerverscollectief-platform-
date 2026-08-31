// Herbruikbare admintabel: kolommen, sortering, bulk-selectie en een
// acties-kolom. Gebouwd met dezelfde kleuren/fonts/radius als de rest van
// de beheerconsole (zie adminStyles.js) — geen nieuw ontwerp.
// Gebruikt door Funders en Subsidieregelingen/Deadlines; de vorm is bewust
// generiek zodat de latere Classification Workspace hier direct op verder kan.
import React from 'react';
import { css } from '../../../shared/lib/css.js';
import {
  emptyStateStyle,
  tableStyle,
  tableWrapStyle,
  tdStyle,
  thSortableStyle,
  thStyle,
} from './adminStyles.js';

// columns: [{ key, label, sortable, render(row), width }]
export default function AdminDataTable({
  columns,
  rows,
  rowKey = (row) => row.id,
  sortColumn,
  sortDirection = 'asc',
  onSort,
  selectable = false,
  selectedIds = [],
  onToggleRow,
  onToggleAll,
  actions,
  loading = false,
  emptyText = 'Geen resultaten.',
}) {
  const alleGeselecteerd = selectable && rows.length > 0 && rows.every((row) => selectedIds.includes(rowKey(row)));

  if (loading) {
    return <div style={emptyStateStyle}>Gegevens laden…</div>;
  }

  if (!rows.length) {
    return <div style={emptyStateStyle}>{emptyText}</div>;
  }

  return (
    <div style={tableWrapStyle}>
      <table style={tableStyle}>
        <thead>
          <tr>
            {selectable ? (
              <th style={{ ...thStyle, width: 36 }}>
                <input
                  type="checkbox"
                  checked={alleGeselecteerd}
                  onChange={() => onToggleAll && onToggleAll(!alleGeselecteerd)}
                  aria-label="Alles selecteren"
                />
              </th>
            ) : null}

            {columns.map((col) => (
              <th key={col.key} style={{ ...thStyle, width: col.width }}>
                {col.sortable ? (
                  <button
                    type="button"
                    style={thSortableStyle}
                    onClick={() => onSort && onSort(col.key)}
                  >
                    {col.label}
                    {sortColumn === col.key ? (
                      <span aria-hidden="true">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                    ) : null}
                  </button>
                ) : (
                  col.label
                )}
              </th>
            ))}

            {actions ? <th style={{ ...thStyle, width: 1 }}>&nbsp;</th> : null}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => {
            const id = rowKey(row);
            const geselecteerd = selectable && selectedIds.includes(id);

            return (
              <tr key={id} style={geselecteerd ? css('background: #F7FAF8;') : undefined}>
                {selectable ? (
                  <td style={tdStyle}>
                    <input
                      type="checkbox"
                      checked={geselecteerd}
                      onChange={() => onToggleRow && onToggleRow(id)}
                      aria-label="Selecteer rij"
                    />
                  </td>
                ) : null}

                {columns.map((col) => (
                  <td key={col.key} style={tdStyle}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}

                {actions ? <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{actions(row)}</td> : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
