// Beheer · "Nieuw gescand door gebruik": fondsen en regelingen die Subsidie Kompas online vond voor leden en die nog niet (bevestigd) in de
// database staan. Staat bovenaan het Funders-overzicht als herinnering voor de maandelijkse aanvulronde: laat de agent ze controleren en
// aanvullen, neem ze op als funder of regeling en zet de status hier op "Opgenomen" (of "Afgewezen"/"Dubbel").
// Alle databasecommunicatie loopt via data/services/adminOnlineGescand.js.
import React, { useCallback, useEffect, useState } from 'react';
import { css } from '../../shared/lib/css.js';
import { GESCAND_STATUSSEN, haalOnlineGescand, neemOnlineGescandOp, telOnlineGescand, werkOnlineGescandBij } from '../../data/services/adminOnlineGescand.js';
import { FUNDER_TYPES } from '../../data/services/adminFunders.js';
import {
  badgeStyle,
  emptyStateStyle,
  filterPillStyle,
  panelStyle,
  searchInputStyle,
  smallButtonStyle,
  smallDangerStyle,
  subsectionTitleStyle,
  tableStyle,
  tableWrapStyle,
  tdStyle,
  thStyle,
} from './shared/adminStyles.js';

const euro = (n) => (n == null ? null : `€ ${Math.round(Number(n)).toLocaleString('nl-NL')}`);
const datum = (d) => (d ? new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const veiligeLink = (u) => (/^https?:\/\//i.test(String(u || '')) ? u : null);

const VOLGENDE = [
  { status: 'in_behandeling', label: 'In behandeling', stijl: smallButtonStyle },
  { status: 'opgenomen', label: 'Opgenomen', stijl: smallButtonStyle },
  { status: 'dubbel', label: 'Dubbel', stijl: smallButtonStyle },
  { status: 'afgewezen', label: 'Afwijzen', stijl: smallDangerStyle },
];

export default function AdminOnlineGescand({ notify, diensten = { haalOnlineGescand, telOnlineGescand, werkOnlineGescandBij, neemOnlineGescandOp } }) {
  const [status, setStatus] = useState('nieuw');
  const [zoek, setZoek] = useState('');
  const [rijen, setRijen] = useState([]);
  const [telling, setTelling] = useState({});
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState('');
  const [open, setOpen] = useState(true);
  const [bezigId, setBezigId] = useState(null);
  const [opnemenId, setOpnemenId] = useState(null);
  const [opnemenType, setOpnemenType] = useState('vermogensfonds');

  const laad = useCallback(async () => {
    setLaden(true);

    const [lijst, tel] = await Promise.all([diensten.haalOnlineGescand({ status, zoek }), diensten.telOnlineGescand()]);

    setRijen(lijst.rijen);
    setTelling(tel.telling);
    setFout(lijst.fout || tel.fout);
    setLaden(false);
  }, [status, zoek, diensten]);

  useEffect(() => {
    if (!zoek) {
      laad();

      return undefined;
    }

    const t = setTimeout(laad, 300);

    return () => clearTimeout(t);
  }, [laad, zoek]);

  const zet = async (rij, nieuweStatus) => {
    setBezigId(rij.id);

    const res = await diensten.werkOnlineGescandBij({ id: rij.id, status: nieuweStatus });

    setBezigId(null);

    if (!res.ok) {
      if (notify) notify('error', res.fout || 'Bijwerken is niet gelukt.');

      return;
    }

    if (notify) notify('success', `"${rij.regeling || rij.gever}" staat nu op ${(GESCAND_STATUSSEN.find((s) => s.value === nieuweStatus) || {}).label || nieuweStatus}.`);
    laad();
  };

  // Opnemen in de database: de gever en/of regeling wordt aangemaakt als NIET beoordeeld, zodat u ze nog kunt nalopen en aanvullen.
  const neemOp = async (rij) => {
    setBezigId(rij.id);

    const res = await diensten.neemOnlineGescandOp({ id: rij.id, type: opnemenType });

    setBezigId(null);

    if (!res.ok) {
      if (notify) notify('error', res.fout || 'Opnemen is niet gelukt.');

      return;
    }

    setOpnemenId(null);

    const nieuw = [res.resultaat && res.resultaat.funder_nieuw ? 'fonds' : null, res.resultaat && res.resultaat.regeling_nieuw ? 'regeling' : null].filter(Boolean);

    if (notify) {
      notify('success', nieuw.length ? `"${rij.regeling || rij.gever}" is opgenomen (nieuw: ${nieuw.join(' en ')}), nog niet beoordeeld.` : `"${rij.regeling || rij.gever}" stond al in de database; de rij is op Opgenomen gezet.`);
    }

    laad();
  };

  const aantalNieuw = telling.nieuw || 0;

  return (
    <div data-testid="admin-online-gescand">
      <div style={{ ...panelStyle, ...(aantalNieuw > 0 ? { border: '1px solid #E9C46A', background: '#FFFBEF' } : {}) }}>
        <div style={css('display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;')}>
          <div style={css('min-width: 0;')}>
            <h3 style={{ ...subsectionTitleStyle, margin: 0 }}>
              Nieuw gescand door gebruik{' '}
              <span data-testid="online-gescand-aantal" style={badgeStyle(aantalNieuw > 0 ? 'geel' : 'grijs')}>
                {aantalNieuw} te controleren
              </span>
            </h3>
            <p style={css('margin: 6px 0 0; font-size: 13.5px; line-height: 1.55; color: #536460;')}>
              {aantalNieuw > 0
                ? 'Deze fondsen en regelingen zijn online gevonden voor leden en staan nog niet in de database. Laat ze in de maandelijkse ronde door de agent controleren en aanvullen, neem ze op en zet ze daarna op "Opgenomen".'
                : 'Er wachten geen nieuw gescande fondsen op controle.'}
            </p>
          </div>
          <button type="button" onClick={() => setOpen((v) => !v)} style={smallButtonStyle} aria-expanded={open}>
            {open ? 'Inklappen' : 'Bekijken'}
          </button>
        </div>

        {open && (
          <div style={css('margin-top: 14px; display: flex; flex-direction: column; gap: 12px;')}>
            <div style={css('display: flex; gap: 8px; flex-wrap: wrap; align-items: center;')}>
              {GESCAND_STATUSSEN.map((s) => (
                <button key={s.value} type="button" onClick={() => setStatus(s.value)} style={filterPillStyle(status === s.value)} aria-pressed={status === s.value}>
                  {s.label} ({telling[s.value] || 0})
                </button>
              ))}
              <input value={zoek} onChange={(e) => setZoek(e.target.value)} placeholder="Zoek op gever of regeling…" aria-label="Zoek in nieuw gescand" style={{ ...searchInputStyle, maxWidth: 280, padding: '9px 12px', fontSize: 14 }} />
            </div>

            {fout && <div role="alert" style={css('font-size: 13.5px; color: #A13B2F;')}>{fout}</div>}

            {laden ? (
              <div style={emptyStateStyle}>Laden…</div>
            ) : rijen.length === 0 ? (
              <div style={emptyStateStyle}>Geen fondsen met deze status.</div>
            ) : (
              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Fonds of regeling</th>
                      <th style={thStyle}>Gevonden</th>
                      <th style={thStyle}>Online gegevens</th>
                      <th style={thStyle}>Database</th>
                      <th style={thStyle}>Actie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rijen.map((r) => {
                      const link = veiligeLink(r.url) || veiligeLink(r.website);

                      return (
                        <tr key={r.id} data-testid="online-gescand-rij">
                          <td style={tdStyle}>
                            <div style={css('font-weight: 800; color: #2C4A5E;')}>{r.regeling || r.gever}</div>
                            {r.regeling && <div style={css('font-size: 12.5px; color: #536460;')}>{r.gever}</div>}
                            {link && (
                              <a href={link} target="_blank" rel="noopener noreferrer nofollow" style={css('font-size: 12.5px; color: #4E9A6C; font-weight: 700; word-break: break-all;')}>
                                {link.replace(/^https?:\/\//, '').slice(0, 60)}
                              </a>
                            )}
                            {r.samenvatting && <div style={css('margin-top: 4px; font-size: 12.5px; color: #6D7C77; max-width: 420px;')}>{r.samenvatting.slice(0, 220)}{r.samenvatting.length > 220 ? '…' : ''}</div>}
                          </td>
                          <td style={tdStyle}>
                            <div style={css('font-weight: 700;')}>{r.aantal_keer}×</div>
                            <div style={css('font-size: 12.5px; color: #6D7C77;')}>laatst {datum(r.laatst_gezien)}</div>
                            <div style={css('font-size: 12.5px; color: #6D7C77;')}>{r.bron === 'lid' ? 'typte een lid zelf in' : `via ${r.bron === 'voorstel' ? 'dekkingsplanvoorstel' : 'chat'}`}</div>
                          </td>
                          <td style={tdStyle}>
                            <div style={css('font-size: 12.5px; color: #536460; display: flex; flex-direction: column; gap: 2px;')}>
                              {r.status_online && <span>Status: {r.status_online}</span>}
                              {r.deadline && <span>Deadline: {datum(r.deadline)}</span>}
                              {(r.bedrag_min != null || r.bedrag_max != null) && <span>Bedrag: {[euro(r.bedrag_min), euro(r.bedrag_max)].filter(Boolean).join(' – ')}</span>}
                              {r.werkgebieden && r.werkgebieden.length > 0 && <span>Werkgebied: {r.werkgebieden.slice(0, 3).join(', ')}</span>}
                            </div>
                          </td>
                          <td style={tdStyle}>
                            <span style={badgeStyle(r.koppeling === 'waarschijnlijk' ? 'blauw' : 'geel')}>
                              {r.koppeling === 'waarschijnlijk' ? 'Lijkt op bestaande gever' : 'Niet in database'}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            <div style={css('display: flex; gap: 6px; flex-wrap: wrap;')}>
                              {r.review_status !== 'opgenomen' && opnemenId !== r.id && (
                                <button type="button" disabled={bezigId === r.id} onClick={() => { setOpnemenId(r.id); setOpnemenType('vermogensfonds'); }} style={smallButtonStyle} data-testid="online-gescand-opnemen">
                                  Opnemen in de database
                                </button>
                              )}
                              {opnemenId === r.id && (
                                <span style={css('display: flex; gap: 6px; flex-wrap: wrap; align-items: center;')} data-testid="online-gescand-opnemen-keuze">
                                  <select value={opnemenType} onChange={(e) => setOpnemenType(e.target.value)} aria-label="Soort gever" style={css('padding: 6px 8px; font-size: 13px; border-radius: 8px; border: 1px solid #D5DEDB;')}>
                                    {FUNDER_TYPES.map((t) => (
                                      <option key={t.value} value={t.value}>
                                        {t.label}
                                      </option>
                                    ))}
                                  </select>
                                  <button type="button" disabled={bezigId === r.id} onClick={() => neemOp(r)} style={smallButtonStyle} data-testid="online-gescand-opnemen-bevestig">
                                    Opnemen
                                  </button>
                                  <button type="button" onClick={() => setOpnemenId(null)} style={smallButtonStyle}>
                                    Annuleren
                                  </button>
                                </span>
                              )}
                              {VOLGENDE.filter((v) => v.status !== r.review_status && v.status !== 'opgenomen').map((v) => (
                                <button key={v.status} type="button" disabled={bezigId === r.id} onClick={() => zet(r, v.status)} style={v.stijl}>
                                  {v.label}
                                </button>
                              ))}
                              {r.review_status !== 'nieuw' && (
                                <button type="button" disabled={bezigId === r.id} onClick={() => zet(r, 'nieuw')} style={smallButtonStyle}>
                                  Terug naar nieuw
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
      <div style={css('height: 22px;')} />
    </div>
  );
}
