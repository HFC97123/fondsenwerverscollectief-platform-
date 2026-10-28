// Beheer · "Nieuwe woorden": woorden die leden zelf typten bij "Overig" en die we nog niet kennen, met het advies van de AI.
// Per woord kiest de beheerder: nieuwe waarde (discipline, doelgroep of werkgebied), synoniem van een bestaande waarde, of afwijzen.
// Een goedgekeurd woord wordt daarna automatisch herkend, zonder AI. Onderaan staan alle goedgekeurde herkenningswoorden, met de mogelijkheid
// ze in te trekken. Alle databasecommunicatie loopt via data/services/adminEigenTermen.js.
import React, { useCallback, useEffect, useState } from 'react';
import { css } from '../../shared/lib/css.js';
import {
  WOORD_CATEGORIEEN,
  WOORD_STATUSSEN,
  beslisEigenTerm,
  haalBestaandeWaarden,
  haalEigenTermen,
  haalHerkenningswoorden,
  telEigenTermen,
  verwijderHerkenningswoord,
} from '../../data/services/adminEigenTermen.js';
import { wisClassificatieCache } from '../../data/services/classificaties.js';
import { badgeStyle, emptyStateStyle, filterPillStyle, inputStyle, panelStyle, searchInputStyle, smallButtonStyle, smallDangerStyle, subsectionTitleStyle, tableStyle, tableWrapStyle, tdStyle, thStyle } from './shared/adminStyles.js';

const DIENSTEN = { haalEigenTermen, telEigenTermen, beslisEigenTerm, haalHerkenningswoorden, verwijderHerkenningswoord, haalBestaandeWaarden };
const labelVan = (cat) => (WOORD_CATEGORIEEN.find((c) => c.value === cat) || {}).label || cat;
const datum = (d) => (d ? new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const kiesCategorie = (c) => (WOORD_CATEGORIEEN.some((x) => x.value === c) ? c : 'discipline');

// Eén woord: het advies van de AI staat voorgevuld; de beheerder past aan en kiest.
function WoordRij({ rij, waarden, bezig, onBeslis }) {
  const [categorie, setCategorie] = useState(kiesCategorie(rij.ai_categorie));
  const [naam, setNaam] = useState(rij.ai_naam || rij.woord);
  const lijstId = `waarden-${rij.id}`;
  const bestaat = (waarden[categorie] || []).some((n) => n.toLowerCase() === naam.trim().toLowerCase());
  const adviesTekst =
    rij.ai_actie === 'synoniem' ? `Advies: synoniem van "${rij.ai_naam}" (${labelVan(rij.ai_categorie)})` : rij.ai_actie === 'nieuwe_waarde' ? `Advies: nieuwe ${labelVan(rij.ai_categorie).toLowerCase()} "${rij.ai_naam}"` : rij.ai_actie === 'afwijzen' ? 'Advies: afwijzen' : 'Nog geen advies';

  return (
    <tr data-testid="nieuwe-woorden-rij">
      <td style={tdStyle}>
        <div style={css('font-weight: 800; color: #2C4A5E;')}>{rij.woord}</div>
        <div style={css('font-size: 12.5px; color: #6D7C77;')}>
          {rij.aantal_keer}× getypt, laatst {datum(rij.laatst_gezien)}
        </div>
        <div style={css('font-size: 12.5px; color: #6D7C77;')}>{rij.aantal_fondsen} fondsen noemen dit woord</div>
      </td>
      <td style={tdStyle}>
        <div style={css('font-size: 13px; color: #3D4B48; font-weight: 700;')} data-testid="nieuwe-woorden-advies">
          {adviesTekst}
        </div>
        {rij.ai_toelichting && <div style={css('font-size: 12.5px; color: #6D7C77; max-width: 360px;')}>{rij.ai_toelichting}</div>}
      </td>
      <td style={tdStyle}>
        {rij.review_status === 'nieuw' ? (
          <div style={css('display: flex; flex-direction: column; gap: 8px; min-width: 260px;')}>
            <div style={css('display: flex; gap: 6px; flex-wrap: wrap;')}>
              {WOORD_CATEGORIEEN.map((c) => (
                <button key={c.value} type="button" onClick={() => setCategorie(c.value)} style={filterPillStyle(categorie === c.value)} aria-pressed={categorie === c.value}>
                  {c.label}
                </button>
              ))}
            </div>
            <input value={naam} onChange={(e) => setNaam(e.target.value)} list={lijstId} aria-label={`Naam voor ${rij.woord}`} placeholder="Naam van de waarde" style={{ ...inputStyle, padding: '8px 10px', fontSize: 14 }} />
            <datalist id={lijstId}>
              {(waarden[categorie] || []).map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <div style={css('display: flex; gap: 6px; flex-wrap: wrap;')}>
              <button type="button" disabled={bezig || !naam.trim() || bestaat} onClick={() => onBeslis(rij, 'nieuwe_waarde', categorie, naam.trim())} style={smallButtonStyle} title={bestaat ? 'Deze waarde bestaat al; kies Synoniem.' : ''}>
                Nieuwe waarde
              </button>
              <button type="button" disabled={bezig || !naam.trim() || !bestaat} onClick={() => onBeslis(rij, 'synoniem', categorie, naam.trim())} style={smallButtonStyle} title={bestaat ? '' : 'Kies een bestaande waarde uit de lijst.'}>
                Synoniem
              </button>
              <button type="button" disabled={bezig} onClick={() => onBeslis(rij, 'afwijzen')} style={smallDangerStyle}>
                Afwijzen
              </button>
            </div>
          </div>
        ) : (
          <div style={css('display: flex; flex-direction: column; gap: 6px;')}>
            <span style={badgeStyle(rij.review_status === 'afgewezen' ? 'grijs' : 'groen')}>
              {rij.review_status === 'afgewezen' ? 'Afgewezen' : `${rij.review_status === 'synoniem' ? 'Synoniem van' : 'Nieuwe waarde'}: ${rij.besluit_naam} (${labelVan(rij.besluit_categorie)})`}
            </span>
            <button type="button" disabled={bezig} onClick={() => onBeslis(rij, 'terug')} style={smallButtonStyle}>
              Terug naar nieuw
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

export default function AdminNieuweWoorden({ notify, diensten = DIENSTEN }) {
  const [status, setStatus] = useState('nieuw');
  const [zoek, setZoek] = useState('');
  const [rijen, setRijen] = useState([]);
  const [telling, setTelling] = useState({});
  const [waarden, setWaarden] = useState({ discipline: [], doelgroep: [], regio: [] });
  const [herkend, setHerkend] = useState([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState('');
  const [bezigId, setBezigId] = useState(null);

  const laad = useCallback(async () => {
    setLaden(true);

    const [lijst, tel, her] = await Promise.all([diensten.haalEigenTermen({ status, zoek }), diensten.telEigenTermen(), diensten.haalHerkenningswoorden()]);

    setRijen(lijst.rijen);
    setTelling(tel.telling);
    setHerkend(her.rijen);
    setFout(lijst.fout || tel.fout || her.fout);
    setLaden(false);
  }, [status, zoek, diensten]);

  useEffect(() => {
    diensten.haalBestaandeWaarden().then(setWaarden);
  }, [diensten]);

  useEffect(() => {
    if (!zoek) {
      laad();

      return undefined;
    }

    const t = setTimeout(laad, 300);

    return () => clearTimeout(t);
  }, [laad, zoek]);

  const beslis = async (rij, actie, categorie = null, naam = null) => {
    setBezigId(rij.id);

    const res = await diensten.beslisEigenTerm({ id: rij.id, actie, categorie, naam });

    setBezigId(null);

    if (!res.ok) {
      if (notify) notify('error', res.fout || 'Opslaan is niet gelukt.');

      return;
    }

    if (notify) {
      notify(
        'success',
        actie === 'afwijzen'
          ? `"${rij.woord}" is afgewezen.`
          : actie === 'terug'
            ? `"${rij.woord}" staat weer op nieuw.`
            : `"${rij.woord}" wordt voortaan herkend als ${naam}.`,
      );
    }

    if (actie === 'nieuwe_waarde') wisClassificatieCache();
    laad();
    diensten.haalBestaandeWaarden().then(setWaarden);
  };

  const intrekken = async (h) => {
    setBezigId(h.id);

    const res = await diensten.verwijderHerkenningswoord(h.id);

    setBezigId(null);

    if (!res.ok) {
      if (notify) notify('error', res.fout || 'Verwijderen is niet gelukt.');

      return;
    }

    if (notify) notify('success', `"${h.woord}" wordt niet meer herkend als ${h.naam}.`);
    laad();
  };

  const aantalNieuw = telling.nieuw || 0;

  return (
    <div data-testid="admin-nieuwe-woorden">
      <div style={{ ...panelStyle, ...(aantalNieuw > 0 ? { border: '1px solid #E9C46A', background: '#FFFBEF' } : {}) }}>
        <h3 style={{ ...subsectionTitleStyle, margin: 0 }}>
          Nieuwe woorden{' '}
          <span data-testid="nieuwe-woorden-aantal" style={badgeStyle(aantalNieuw > 0 ? 'geel' : 'grijs')}>
            {aantalNieuw} te beoordelen
          </span>
        </h3>
        <p style={css('margin: 6px 0 12px; font-size: 13.5px; line-height: 1.55; color: #536460;')}>
          Dit zijn woorden die leden zelf typten bij "Overig" en die we nog niet kenden. Elk woord komt met een advies. Kies een nieuwe waarde, koppel het als synoniem aan een bestaande waarde, of wijs het af. Een goedgekeurd woord wordt daarna automatisch herkend.
        </p>

        <div style={css('display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 12px;')}>
          {WOORD_STATUSSEN.map((s) => (
            <button key={s.value} type="button" onClick={() => setStatus(s.value)} style={filterPillStyle(status === s.value)} aria-pressed={status === s.value}>
              {s.label} ({telling[s.value] || 0})
            </button>
          ))}
          <input value={zoek} onChange={(e) => setZoek(e.target.value)} placeholder="Zoek een woord…" aria-label="Zoek in nieuwe woorden" style={{ ...searchInputStyle, maxWidth: 240, padding: '9px 12px', fontSize: 14 }} />
        </div>

        {fout && (
          <div role="alert" style={css('font-size: 13.5px; color: #A13B2F; margin-bottom: 8px;')}>
            {fout}
          </div>
        )}

        {laden ? (
          <div style={emptyStateStyle}>Laden…</div>
        ) : rijen.length === 0 ? (
          <div style={emptyStateStyle}>Geen woorden met deze status.</div>
        ) : (
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Woord</th>
                  <th style={thStyle}>Advies</th>
                  <th style={thStyle}>Besluit</th>
                </tr>
              </thead>
              <tbody>
                {rijen.map((r) => (
                  <WoordRij key={`${r.id}-${r.review_status}`} rij={r} waarden={waarden} bezig={bezigId === r.id} onBeslis={beslis} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ ...panelStyle, marginTop: 16 }} data-testid="herkenningswoorden">
        <h3 style={{ ...subsectionTitleStyle, margin: 0 }}>Herkenningswoorden ({herkend.length})</h3>
        <p style={css('margin: 6px 0 12px; font-size: 13.5px; line-height: 1.55; color: #536460;')}>Deze woorden worden automatisch herkend, zonder AI. Trekt u een woord in, dan wordt het weer een nieuw woord om te beoordelen.</p>
        {herkend.length === 0 ? (
          <div style={emptyStateStyle}>Nog geen herkenningswoorden.</div>
        ) : (
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Woord</th>
                  <th style={thStyle}>Wordt herkend als</th>
                  <th style={thStyle}>Soort</th>
                  <th style={thStyle} />
                </tr>
              </thead>
              <tbody>
                {herkend.map((h) => (
                  <tr key={h.id} data-testid="herkenningswoord-rij">
                    <td style={tdStyle}>{h.woord}</td>
                    <td style={tdStyle}>{h.naam}</td>
                    <td style={tdStyle}>{labelVan(h.categorie)}</td>
                    <td style={tdStyle}>
                      <button type="button" disabled={bezigId === h.id} onClick={() => intrekken(h)} style={smallDangerStyle}>
                        Intrekken
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
