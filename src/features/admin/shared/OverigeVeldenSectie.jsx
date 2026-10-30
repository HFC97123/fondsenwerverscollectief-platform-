// Beheer · de overige kolommen van een fonds of regeling (systeemvelden), zodat elke kolom te bewerken is.
// form.overig = { sleutel: waarde }, form.overigBeschikbaar = false als de database dit nog niet kent.
import React from 'react';
import { css } from '../../../shared/lib/css.js';
import { inputStyle, subsectionTitleStyle } from './adminStyles.js';

const DATA_TIER = [{ value: 'public', label: 'Public' }, { value: 'premium', label: 'Premium' }];
const BRON = [
  { value: 'internet_scan', label: 'Internetscan' },
  { value: 'manual_admin', label: 'Handmatig (beheer)' },
  { value: 'premium_database', label: 'Premium-database' },
  { value: 'api_partner', label: 'API-partner' },
  { value: 'csv_import', label: 'CSV-import' },
];

export const OVERIGE_VELDEN = {
  funders: [
    { sleutel: 'enrichment_status', label: 'Verrijkingsstatus', soort: 'keuze', opties: [{ value: 'nieuw', label: 'Nieuw' }, { value: 'in_onderzoek', label: 'In onderzoek' }, { value: 'deels_verrijkt', label: 'Deels verrijkt' }, { value: 'compleet', label: 'Compleet' }] },
    { sleutel: 'last_researched_at', label: 'Laatst onderzocht', soort: 'datum' },
    { sleutel: 'data_tier', label: 'Datalaag', soort: 'keuze', opties: DATA_TIER },
    { sleutel: 'source_type', label: 'Bron van de gegevens', soort: 'keuze', opties: BRON },
    { sleutel: 'adres', label: 'Adres (oud vrij veld)', soort: 'tekst' },
  ],
  subsidieregelingen: [
    { sleutel: 'discovered_by', label: 'Gevonden door', soort: 'keuze', opties: [{ value: 'handmatig', label: 'Handmatig' }, { value: 'agent', label: 'Agent' }] },
    { sleutel: 'verified', label: 'Geverifieerd', soort: 'ja-nee' },
    { sleutel: 'status_laatst_gecheckt', label: 'Status laatst gecontroleerd', soort: 'datum' },
    { sleutel: 'data_tier', label: 'Datalaag', soort: 'keuze', opties: DATA_TIER },
    { sleutel: 'source_type', label: 'Bron van de gegevens', soort: 'keuze', opties: BRON },
  ],
};

export default function OverigeVeldenSectie({ tabel, form, setForm }) {
  if (!form.overigBeschikbaar) return null;

  const velden = OVERIGE_VELDEN[tabel] || [];
  const zet = (sleutel, waarde) => setForm((f) => ({ ...f, overig: { ...f.overig, [sleutel]: waarde } }));

  return (
    <div data-testid="admin-overige-velden">
      <div style={css('margin: 26px 0 14px; padding-top: 10px; border-top: 1px solid #E1EAE4;')}>
        <div style={subsectionTitleStyle}>Overige gegevens</div>
      </div>
      <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 16px;')}>
        {velden.map((v) => {
          const waarde = form.overig?.[v.sleutel];
          const tid = `admin-overig-${v.sleutel}`;

          if (v.soort === 'ja-nee') {
            return (
              <label key={v.sleutel} style={css('display: flex; gap: 8px; align-items: center; font-size: 13px; font-weight: 700; color: #2C4A5E;')}>
                <input type="checkbox" checked={Boolean(waarde)} onChange={(e) => zet(v.sleutel, e.target.checked)} data-testid={tid} />
                {v.label}
              </label>
            );
          }

          return (
            <label key={v.sleutel} style={css('display: grid; gap: 6px; font-size: 13px; font-weight: 700; color: #2C4A5E;')}>
              {v.label}
              {v.soort === 'keuze' ? (
                <select style={inputStyle} value={waarde || ''} onChange={(e) => zet(v.sleutel, e.target.value)} data-testid={tid}>
                  {v.opties.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : v.soort === 'datum' ? (
                <input style={inputStyle} type="date" value={waarde ? String(waarde).slice(0, 10) : ''} onChange={(e) => zet(v.sleutel, e.target.value || null)} data-testid={tid} />
              ) : (
                <input style={inputStyle} value={waarde || ''} onChange={(e) => zet(v.sleutel, e.target.value)} data-testid={tid} />
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}
