// Beheer · Classificaties. Eén centrale plek om de drie classificatielijsten
// (disciplines/themas, doelgroepen, werkgebieden/regios) te beheren die
// funders, subsidieregelingen, het organisatieprofiel en straks de
// AI-tools allemaal delen. Toevoegen/hernoemen/verwijderen hier is de enige
// manier om een classificatiewaarde te wijzigen — nergens anders in de
// beheerconsole staat een los, hardgecodeerd lijstje.
//
// "Gebruikt" toont hoeveel funders + subsidieregelingen een waarde op dit
// moment gekoppeld hebben. Verwijderen van een waarde die nog in gebruik is
// laat die koppelingen automatisch vervallen (ON DELETE CASCADE) — vandaar de
// dubbele-klik-bevestiging in plaats van een stil "Verwijderen".
import React, { useEffect, useMemo, useState } from 'react';
import { css } from '../../shared/lib/css.js';
import {
  CLASSIFICATIE_TYPES,
  fetchClassificatieLijst,
  hernoemClassificatiewaarde,
  verwijderClassificatiewaarde,
  voegClassificatieToe,
} from '../../data/services/adminClassificaties.js';
import { wisClassificatieCache } from '../../data/services/classificaties.js';
import AdminToolbar from './shared/AdminToolbar.jsx';
import AdminDataTable from './shared/AdminDataTable.jsx';
import {
  badgeStyle,
  filterPillStyle,
  inputStyle,
  plainButtonStyle,
  primaryButtonNoMarginStyle,
  sectionIntroStyle,
  sectionTitleStyle,
  smallButtonStyle,
  smallDangerStyle,
} from './shared/adminStyles.js';

export default function AdminClassificaties({ notify }) {
  const [type, setType] = useState(CLASSIFICATIE_TYPES[0].value);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [nieuweNaam, setNieuweNaam] = useState('');
  const [toevoegen, setToevoegen] = useState(false);

  const [hernoemId, setHernoemId] = useState(null);
  const [hernoemNaam, setHernoemNaam] = useState('');
  const [bezigId, setBezigId] = useState(null);
  const [bevestigId, setBevestigId] = useState(null);

  const laad = async () => {
    setLoading(true);

    const res = await fetchClassificatieLijst(type);

    if (res.error) {
      notify('error', 'De classificaties konden niet worden geladen.');
      setRows([]);
    } else {
      setRows(res.rows);
    }

    setLoading(false);
  };

  useEffect(() => {
    laad();
    setSearch('');
    setBevestigId(null);
    setHernoemId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const label = (CLASSIFICATIE_TYPES.find((t) => t.value === type) || {}).label || type;

  const gefilterd = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return rows;
    }

    return rows.filter((r) => r.naam.toLowerCase().includes(term));
  }, [rows, search]);

  const toevoegenVerwerken = async (event) => {
    event.preventDefault();

    const naam = nieuweNaam.trim();

    if (!naam) {
      return;
    }

    setToevoegen(true);

    const res = await voegClassificatieToe(type, naam);

    setToevoegen(false);

    if (res.error) {
      notify('error', res.error.code === '23505' ? 'Deze waarde bestaat al.' : 'Toevoegen is niet gelukt.');

      return;
    }

    setNieuweNaam('');
    wisClassificatieCache();
    notify('success', `"${naam}" toegevoegd aan ${label.toLowerCase()}.`);
    laad();
  };

  const startHernoemen = (row) => {
    setHernoemId(row.id);
    setHernoemNaam(row.naam);
    setBevestigId(null);
  };

  const hernoemenVerwerken = async (row) => {
    const naam = hernoemNaam.trim();

    if (!naam || naam === row.naam) {
      setHernoemId(null);

      return;
    }

    setBezigId(row.id);

    const res = await hernoemClassificatiewaarde(type, row.id, naam);

    setBezigId(null);

    if (res.error) {
      notify('error', res.error.code === '23505' ? 'Deze waarde bestaat al.' : 'Hernoemen is niet gelukt.');

      return;
    }

    setHernoemId(null);
    wisClassificatieCache();
    notify('success', 'Waarde hernoemd.');
    laad();
  };

  const verwijderenVerwerken = async (row) => {
    if (bevestigId !== row.id) {
      setBevestigId(row.id);

      return;
    }

    setBezigId(row.id);

    const res = await verwijderClassificatiewaarde(type, row.id);

    setBezigId(null);
    setBevestigId(null);

    if (res.error) {
      notify('error', 'Verwijderen is niet gelukt.');

      return;
    }

    wisClassificatieCache();
    notify('success', `"${row.naam}" verwijderd.`);
    laad();
  };

  const columns = useMemo(
    () => [
      {
        key: 'naam',
        label: 'Naam',
        render: (row) =>
          hernoemId === row.id ? (
            <span style={css('display: flex; gap: 8px; align-items: center;')}>
              <input
                style={{ ...inputStyle, minWidth: 180 }}
                value={hernoemNaam}
                autoFocus
                onChange={(event) => setHernoemNaam(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    hernoemenVerwerken(row);
                  }
                  if (event.key === 'Escape') {
                    setHernoemId(null);
                  }
                }}
              />
            </span>
          ) : (
            <strong>{row.naam}</strong>
          ),
      },
      {
        key: 'gebruikt_aantal',
        label: 'Gebruikt',
        width: 120,
        render: (row) => (
          <span style={badgeStyle(Number(row.gebruikt_aantal) > 0 ? 'groen' : 'grijs')}>
            {row.gebruikt_aantal} {Number(row.gebruikt_aantal) === 1 ? 'koppeling' : 'koppelingen'}
          </span>
        ),
      },
    ],
    [hernoemId, hernoemNaam],
  );

  return (
    <section>
      <h2 style={sectionTitleStyle}>Classificaties</h2>
      <p style={sectionIntroStyle}>
        De centrale disciplines, doelgroepen en werkgebieden die funders, subsidieregelingen en het
        organisatieprofiel allemaal delen. Wijzigingen hier zijn direct overal zichtbaar — er bestaat geen aparte
        lijst per pagina.
      </p>

      <div style={css('height: 18px;')} />

      <div style={css('display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px;')}>
        {CLASSIFICATIE_TYPES.map((t) => (
          <button key={t.value} type="button" onClick={() => setType(t.value)} style={filterPillStyle(type === t.value)}>
            {t.label}
          </button>
        ))}
      </div>

      <AdminToolbar search={search} onSearchChange={setSearch} searchPlaceholder={`Zoek in ${label.toLowerCase()}…`}>
        <form onSubmit={toevoegenVerwerken} style={css('display: flex; gap: 8px; align-items: center;')}>
          <input
            style={inputStyle}
            value={nieuweNaam}
            onChange={(event) => setNieuweNaam(event.target.value)}
            placeholder={`Nieuwe waarde…`}
          />
          <button type="submit" disabled={toevoegen || !nieuweNaam.trim()} style={primaryButtonNoMarginStyle}>
            {toevoegen ? 'Bezig…' : 'Toevoegen'}
          </button>
        </form>
      </AdminToolbar>

      <AdminDataTable
        columns={columns}
        rows={gefilterd}
        loading={loading}
        emptyText={search ? 'Niets gevonden voor deze zoekterm.' : `Nog geen ${label.toLowerCase()}.`}
        actions={(row) =>
          hernoemId === row.id ? (
            <span style={css('display: flex; gap: 8px;')}>
              <button type="button" disabled={bezigId === row.id} style={smallButtonStyle} onClick={() => hernoemenVerwerken(row)}>
                Opslaan
              </button>
              <button type="button" disabled={bezigId === row.id} style={plainButtonStyle} onClick={() => setHernoemId(null)}>
                Annuleren
              </button>
            </span>
          ) : (
            <span style={css('display: flex; gap: 8px;')}>
              <button type="button" style={smallButtonStyle} onClick={() => startHernoemen(row)}>
                Hernoemen
              </button>
              <button
                type="button"
                disabled={bezigId === row.id}
                style={smallDangerStyle}
                onClick={() => verwijderenVerwerken(row)}
              >
                {bevestigId === row.id
                  ? `Zeker weten${Number(row.gebruikt_aantal) > 0 ? ` (${row.gebruikt_aantal} koppelingen vervallen)` : ''}?`
                  : 'Verwijderen'}
              </button>
              {bevestigId === row.id ? (
                <button type="button" style={plainButtonStyle} onClick={() => setBevestigId(null)}>
                  Annuleren
                </button>
              ) : null}
            </span>
          )
        }
      />
    </section>
  );
}
