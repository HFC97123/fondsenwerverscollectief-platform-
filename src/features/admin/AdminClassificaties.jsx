// Beheer · Classificaties. Eén centrale plek om de classificatielijsten
// (disciplines/themas, doelgroepen, werkgebieden/regios, bandbreedte
// bijdrage) te beheren die funders, subsidieregelingen, het
// organisatieprofiel en straks de AI-tools allemaal delen. Toevoegen/
// hernoemen/verwijderen hier is de enige manier om een classificatiewaarde
// te wijzigen — nergens anders in de beheerconsole staat een los,
// hardgecodeerd lijstje.
//
// "Gebruikt" toont hoeveel funders + subsidieregelingen een waarde op dit
// moment gekoppeld hebben. Verwijderen van een waarde die nog in gebruik is
// laat die koppelingen automatisch vervallen (ON DELETE CASCADE/SET NULL) —
// vandaar de dubbele-klik-bevestiging in plaats van een stil "Verwijderen".
//
// Bandbreedte bijdrage heeft, anders dan de drie simpele naam-lijsten
// hierboven, ook een bedrag_min/bedrag_max/volgorde — dat past niet in de
// generieke admin_list_classificaties-familie (id + naam), dus deze tab
// heeft zijn eigen datastroom (adminBandbreedtes.js) en een eigen
// bewerkformulier, maar dezelfde look, dubbele-klik-bevestiging en
// dezelfde plek in de navigatie.
import React, { useEffect, useMemo, useState } from 'react';
import { css } from '../../shared/lib/css.js';
import {
  CLASSIFICATIE_TYPES,
  fetchClassificatieLijst,
  hernoemClassificatiewaarde,
  verwijderClassificatiewaarde,
  voegClassificatieToe,
} from '../../data/services/adminClassificaties.js';
import {
  fetchBandbreedteLijst,
  verwijderBandbreedte,
  voegBandbreedteToe,
  werkBandbreedteBij,
} from '../../data/services/adminBandbreedtes.js';
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

const TABS = [...CLASSIFICATIE_TYPES, { value: 'bandbreedtes', label: 'Bandbreedte bijdrage' }];

export default function AdminClassificaties({ notify }) {
  const [type, setType] = useState(TABS[0].value);

  return (
    <section>
      <h2 style={sectionTitleStyle}>Classificaties</h2>
      <p style={sectionIntroStyle}>
        De centrale disciplines, doelgroepen, werkgebieden en bandbreedte bijdrage die funders, subsidieregelingen
        en het organisatieprofiel allemaal delen. Wijzigingen hier zijn direct overal zichtbaar — er bestaat geen
        aparte lijst per pagina.
      </p>

      <div style={css('height: 18px;')} />

      <div style={css('display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px;')}>
        {TABS.map((t) => (
          <button key={t.value} type="button" onClick={() => setType(t.value)} style={filterPillStyle(type === t.value)}>
            {t.label}
          </button>
        ))}
      </div>

      {type === 'bandbreedtes' ? (
        <AdminBandbreedtes notify={notify} />
      ) : (
        <AdminClassificatieLijst type={type} notify={notify} />
      )}
    </section>
  );
}

function AdminClassificatieLijst({ type, notify }) {
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
    <>
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
    </>
  );
}

const LEEG_BANDBREEDTE = { naam: '', bedragMin: '', bedragMax: '', volgorde: '' };

function AdminBandbreedtes({ notify }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [nieuw, setNieuw] = useState(LEEG_BANDBREEDTE);
  const [toevoegen, setToevoegen] = useState(false);

  const [bewerkId, setBewerkId] = useState(null);
  const [bewerkForm, setBewerkForm] = useState(LEEG_BANDBREEDTE);
  const [bezigId, setBezigId] = useState(null);
  const [bevestigId, setBevestigId] = useState(null);

  const laad = async () => {
    setLoading(true);

    const res = await fetchBandbreedteLijst();

    if (res.error) {
      notify('error', 'De bandbreedtes konden niet worden geladen.');
      setRows([]);
    } else {
      setRows(res.rows);
    }

    setLoading(false);
  };

  useEffect(() => {
    laad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toevoegenVerwerken = async (event) => {
    event.preventDefault();

    const naam = nieuw.naam.trim();

    if (!naam || nieuw.bedragMin === '') {
      return;
    }

    setToevoegen(true);

    const res = await voegBandbreedteToe({
      naam,
      bedragMin: Number(nieuw.bedragMin),
      bedragMax: nieuw.bedragMax === '' ? null : Number(nieuw.bedragMax),
      volgorde: nieuw.volgorde === '' ? null : Number(nieuw.volgorde),
    });

    setToevoegen(false);

    if (res.error) {
      notify('error', res.error.code === '23505' ? 'Deze naam of volgorde bestaat al.' : 'Toevoegen is niet gelukt.');

      return;
    }

    setNieuw(LEEG_BANDBREEDTE);
    wisClassificatieCache();
    notify('success', `"${naam}" toegevoegd aan bandbreedte bijdrage.`);
    laad();
  };

  const startBewerken = (row) => {
    setBewerkId(row.id);
    setBewerkForm({
      naam: row.naam,
      bedragMin: row.bedrag_min ?? '',
      bedragMax: row.bedrag_max ?? '',
      volgorde: row.volgorde ?? '',
    });
    setBevestigId(null);
  };

  const bewerkenVerwerken = async (row) => {
    const naam = bewerkForm.naam.trim();

    if (!naam || bewerkForm.bedragMin === '') {
      return;
    }

    setBezigId(row.id);

    const res = await werkBandbreedteBij(row.id, {
      naam,
      bedragMin: Number(bewerkForm.bedragMin),
      bedragMax: bewerkForm.bedragMax === '' ? null : Number(bewerkForm.bedragMax),
      volgorde: bewerkForm.volgorde === '' ? null : Number(bewerkForm.volgorde),
    });

    setBezigId(null);

    if (res.error) {
      notify('error', res.error.code === '23505' ? 'Deze naam of volgorde bestaat al.' : 'Opslaan is niet gelukt.');

      return;
    }

    setBewerkId(null);
    wisClassificatieCache();
    notify('success', 'Bandbreedte bijgewerkt.');
    laad();
  };

  const verwijderenVerwerken = async (row) => {
    if (bevestigId !== row.id) {
      setBevestigId(row.id);

      return;
    }

    setBezigId(row.id);

    const res = await verwijderBandbreedte(row.id);

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
          bewerkId === row.id ? (
            <input
              style={{ ...inputStyle, minWidth: 160 }}
              value={bewerkForm.naam}
              autoFocus
              onChange={(event) => setBewerkForm((f) => ({ ...f, naam: event.target.value }))}
            />
          ) : (
            <strong>{row.naam}</strong>
          ),
      },
      {
        key: 'bedrag_min',
        label: 'Bedrag vanaf',
        width: 130,
        render: (row) =>
          bewerkId === row.id ? (
            <input
              style={{ ...inputStyle, minWidth: 110 }}
              type="number"
              value={bewerkForm.bedragMin}
              onChange={(event) => setBewerkForm((f) => ({ ...f, bedragMin: event.target.value }))}
            />
          ) : (
            Number(row.bedrag_min).toLocaleString('nl-NL')
          ),
      },
      {
        key: 'bedrag_max',
        label: 'Bedrag tot',
        width: 130,
        render: (row) =>
          bewerkId === row.id ? (
            <input
              style={{ ...inputStyle, minWidth: 110 }}
              type="number"
              placeholder="(open einde)"
              value={bewerkForm.bedragMax}
              onChange={(event) => setBewerkForm((f) => ({ ...f, bedragMax: event.target.value }))}
            />
          ) : row.bedrag_max == null ? (
            'en hoger'
          ) : (
            Number(row.bedrag_max).toLocaleString('nl-NL')
          ),
      },
      {
        key: 'volgorde',
        label: 'Volgorde',
        width: 100,
        render: (row) =>
          bewerkId === row.id ? (
            <input
              style={{ ...inputStyle, minWidth: 70 }}
              type="number"
              value={bewerkForm.volgorde}
              onChange={(event) => setBewerkForm((f) => ({ ...f, volgorde: event.target.value }))}
            />
          ) : (
            row.volgorde
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
    [bewerkId, bewerkForm],
  );

  return (
    <>
      <p style={css('margin: 0 0 14px; font-size: 12.5px; color: #82918B;')}>
        Vaste, door u aan te passen bedragscategorieën. "Bedrag tot" leeg laten = open einde (alleen zinvol voor de
        hoogste categorie). Wijzigingen zijn direct overal zichtbaar — filters, admin en matching lezen deze lijst
        rechtstreeks uit de database.
      </p>

      <form
        onSubmit={toevoegenVerwerken}
        style={css('display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 18px;')}
      >
        <label style={css('display: grid; gap: 4px; font-size: 12px; font-weight: 700; color: #2C4A5E;')}>
          Naam
          <input
            style={inputStyle}
            value={nieuw.naam}
            onChange={(event) => setNieuw((f) => ({ ...f, naam: event.target.value }))}
            placeholder="€0–€5.000"
          />
        </label>
        <label style={css('display: grid; gap: 4px; font-size: 12px; font-weight: 700; color: #2C4A5E;')}>
          Bedrag vanaf
          <input
            style={{ ...inputStyle, maxWidth: 120 }}
            type="number"
            value={nieuw.bedragMin}
            onChange={(event) => setNieuw((f) => ({ ...f, bedragMin: event.target.value }))}
          />
        </label>
        <label style={css('display: grid; gap: 4px; font-size: 12px; font-weight: 700; color: #2C4A5E;')}>
          Bedrag tot
          <input
            style={{ ...inputStyle, maxWidth: 120 }}
            type="number"
            placeholder="(open einde)"
            value={nieuw.bedragMax}
            onChange={(event) => setNieuw((f) => ({ ...f, bedragMax: event.target.value }))}
          />
        </label>
        <label style={css('display: grid; gap: 4px; font-size: 12px; font-weight: 700; color: #2C4A5E;')}>
          Volgorde
          <input
            style={{ ...inputStyle, maxWidth: 90 }}
            type="number"
            placeholder="auto"
            value={nieuw.volgorde}
            onChange={(event) => setNieuw((f) => ({ ...f, volgorde: event.target.value }))}
          />
        </label>
        <button type="submit" disabled={toevoegen || !nieuw.naam.trim() || nieuw.bedragMin === ''} style={primaryButtonNoMarginStyle}>
          {toevoegen ? 'Bezig…' : 'Toevoegen'}
        </button>
      </form>

      <AdminDataTable
        columns={columns}
        rows={rows}
        loading={loading}
        emptyText="Nog geen bandbreedtes."
        actions={(row) =>
          bewerkId === row.id ? (
            <span style={css('display: flex; gap: 8px;')}>
              <button type="button" disabled={bezigId === row.id} style={smallButtonStyle} onClick={() => bewerkenVerwerken(row)}>
                Opslaan
              </button>
              <button type="button" disabled={bezigId === row.id} style={plainButtonStyle} onClick={() => setBewerkId(null)}>
                Annuleren
              </button>
            </span>
          ) : (
            <span style={css('display: flex; gap: 8px;')}>
              <button type="button" style={smallButtonStyle} onClick={() => startBewerken(row)}>
                Bewerken
              </button>
              <button
                type="button"
                disabled={bezigId === row.id}
                style={smallDangerStyle}
                onClick={() => verwijderenVerwerken(row)}
              >
                {bevestigId === row.id
                  ? `Zeker weten${Number(row.gebruikt_aantal) > 0 ? ` (${row.gebruikt_aantal} koppelingen worden losgemaakt)` : ''}?`
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
    </>
  );
}
