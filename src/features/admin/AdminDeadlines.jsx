// Beheer · Subsidieregelingen / Deadlines.
// Vervangt de oude, lokale (localStorage) implementatie volledig: lezen en
// schrijven gaat nu via de echte tabellen, uitsluitend via de admin-only
// RPC's in data/services/adminSubsidieregelingen.js. Zelfde architectuur
// (zoeken, sorteren, filteren, bulk-selectie) als Funders, zodat de latere
// Classification Workspace op beide pagina's hetzelfde patroon aantreft.
import React, { useEffect, useMemo, useState } from 'react';
import { css } from '../../shared/lib/css.js';
import {
  REGELING_STATUSSEN,
  bulkCreateSubsidieregelingen,
  fetchSubsidieregelingen,
  updateSubsidieregeling,
} from '../../data/services/adminSubsidieregelingen.js';
import { DATA_TIERS, SOURCE_TYPES, fetchFunders } from '../../data/services/adminFunders.js';
import AdminToolbar from './shared/AdminToolbar.jsx';
import AdminFilters from './shared/AdminFilters.jsx';
import AdminDataTable from './shared/AdminDataTable.jsx';
import AdminBulkActionsBar from './shared/AdminBulkActionsBar.jsx';
import AdminPagination from './shared/AdminPagination.jsx';
import {
  badgeStyle,
  inputStyle,
  plainButtonStyle,
  secondaryButtonStyle,
  sectionIntroStyle,
  sectionTitleStyle,
  smallButtonStyle,
  uploadButtonStyle,
} from './shared/adminStyles.js';

const PAGE_SIZE = 25;

const LEEG_BEWERKING = {
  naam: '',
  thema: '',
  bedragMin: '',
  bedragMax: '',
  deadline: '',
  deadlineDatum: '',
  deadlineOmschrijving: '',
  voorwaarden: '',
  status: 'open',
};

// CSV-kolommen; per veld de namen die we accepteren. Zelfde opzet als de
// oude implementatie, nu gemapt op de echte kolommen.
const KOLOMMEN = {
  naam: ['naam', 'regeling', 'regelingnaam'],
  funder: ['verstrekker', 'funder', 'fonds'],
  thema: ['thema'],
  status: ['status'],
  deadlineDatum: ['deadline', 'deadline_datum', 'sluitingsdatum'],
  deadlineOmschrijving: ['deadline_omschrijving', 'omschrijving deadline'],
  bedragMin: ['bedrag_min', 'bedrag vanaf', 'bedragmin'],
  bedragMax: ['bedrag_max', 'bedrag tot', 'bedragmax'],
  voorwaarden: ['voorwaarden'],
};

function euro(bedrag) {
  if (bedrag == null || bedrag === '') {
    return '—';
  }

  return Number(bedrag).toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

export default function AdminDeadlines({ notify }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fout, setFout] = useState('');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(null);
  const [dataTier, setDataTier] = useState(null);
  const [sourceType, setSourceType] = useState(null);
  const [reviewed, setReviewed] = useState(null);

  const [sortColumn, setSortColumn] = useState('naam');
  const [sortDirection, setSortDirection] = useState('asc');
  const [page, setPage] = useState(0);

  const [selectedIds, setSelectedIds] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(LEEG_BEWERKING);
  const [opslaan, setOpslaan] = useState(false);
  const [importBezig, setImportBezig] = useState(false);
  const [importMelding, setImportMelding] = useState('');

  const laad = async () => {
    setLoading(true);
    setFout('');

    const res = await fetchSubsidieregelingen({
      search: search.trim() || null,
      status,
      dataTier,
      sourceType,
      classificationReviewed: reviewed,
      sortColumn,
      sortDirection,
      page,
      pageSize: PAGE_SIZE,
    });

    if (res.error) {
      setFout('De regelingen konden niet worden geladen.');
      setRows([]);
      setTotal(0);
    } else {
      setRows(res.rows);
      setTotal(res.total);
    }

    setLoading(false);
  };

  useEffect(() => {
    laad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, dataTier, sourceType, reviewed, sortColumn, sortDirection, page]);

  useEffect(() => {
    setPage(0);
  }, [search, status, dataTier, sourceType, reviewed]);

  const onSort = (key) => {
    if (sortColumn === key) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(key);
      setSortDirection('asc');
    }
  };

  const toggleRow = (id) => {
    setSelectedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const toggleAll = (aan) => {
    setSelectedIds(aan ? rows.map((r) => r.id) : []);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm({
      naam: row.naam || '',
      thema: row.thema || '',
      bedragMin: row.bedrag_min ?? '',
      bedragMax: row.bedrag_max ?? '',
      deadline: row.deadline || '',
      deadlineDatum: row.deadline_datum || '',
      deadlineOmschrijving: row.deadline_omschrijving || '',
      voorwaarden: row.voorwaarden || '',
      status: row.status || 'open',
    });
  };

  const opslaanBewerking = async (row) => {
    setOpslaan(true);

    const patch = {
      naam: form.naam.trim(),
      thema: form.thema || null,
      bedragMin: form.bedragMin === '' ? null : Number(form.bedragMin),
      bedragMax: form.bedragMax === '' ? null : Number(form.bedragMax),
      deadline: form.deadline || null,
      deadlineDatum: form.deadlineDatum || null,
      deadlineOmschrijving: form.deadlineOmschrijving || null,
      voorwaarden: form.voorwaarden || null,
      status: form.status || 'open',
      funderId: row.funder_id,
    };

    const res = await updateSubsidieregeling(row.id, patch);

    setOpslaan(false);

    if (res.error) {
      notify('error', 'De regeling kon niet worden bijgewerkt.');

      return;
    }

    setEditingId(null);
    notify('success', 'Regeling bijgewerkt.');
    laad();
  };

  // CSV-import: per rij wordt de verstrekker opgezocht op exacte naam (niet
  // hoofdlettergevoelig). Geen match: rij wordt overgeslagen en meegeteld,
  // er wordt bewust geen nieuwe funder aangemaakt vanuit deze import.
  const importeer = (event) => {
    const file = (event.target.files || [])[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();

    reader.onload = async () => {
      setImportBezig(true);
      setImportMelding('');

      const tekst = String(reader.result || '').replace(/\r/g, '');
      const regels = tekst.split('\n').filter((l) => l.trim());

      if (!regels.length) {
        setImportMelding('Het bestand bevat geen regels.');
        setImportBezig(false);

        return;
      }

      const sep = regels[0].indexOf(';') !== -1 ? ';' : ',';
      const kop = regels[0].split(sep).map((h) => h.trim().toLowerCase());
      const index = {};

      Object.keys(KOLOMMEN).forEach((veld) => {
        index[veld] = KOLOMMEN[veld].reduce((gevonden, naam) => (gevonden !== -1 ? gevonden : kop.indexOf(naam)), -1);
      });

      if (index.naam === -1 || index.funder === -1) {
        setImportMelding('Kolom "naam" en/of "verstrekker" niet gevonden in het CSV-bestand.');
        setImportBezig(false);

        return;
      }

      const funderCache = new Map();
      const zoekFunder = async (naam) => {
        const sleutel = naam.trim().toLowerCase();

        if (funderCache.has(sleutel)) {
          return funderCache.get(sleutel);
        }

        const res = await fetchFunders({ search: naam.trim(), page: 0, pageSize: 5 });
        const match =
          (res.rows || []).find((f) => (f.naam || '').trim().toLowerCase() === sleutel) || (res.rows || [])[0] || null;

        funderCache.set(sleutel, match);

        return match;
      };

      const nieuw = [];
      let nietGevonden = 0;
      let overgeslagen = 0;

      for (let i = 1; i < regels.length; i += 1) {
        const cellen = regels[i].split(sep).map((x) => x.trim().replace(/^"|"$/g, ''));
        const val = (veld) => (index[veld] === -1 ? '' : cellen[index[veld]] || '');

        if (!val('naam') || !val('funder')) {
          overgeslagen += 1;
          continue;
        }

        // eslint-disable-next-line no-await-in-loop
        const funder = await zoekFunder(val('funder'));

        if (!funder) {
          nietGevonden += 1;
          continue;
        }

        nieuw.push({
          funderId: funder.id,
          naam: val('naam'),
          thema: val('thema') || null,
          bedragMin: val('bedragMin') ? Number(val('bedragMin').replace(/[^0-9.]/g, '')) : null,
          bedragMax: val('bedragMax') ? Number(val('bedragMax').replace(/[^0-9.]/g, '')) : null,
          deadlineDatum: /^\d{4}-\d{2}-\d{2}$/.test(val('deadlineDatum')) ? val('deadlineDatum') : null,
          deadlineOmschrijving: val('deadlineOmschrijving') || null,
          voorwaarden: val('voorwaarden') || null,
          status: (val('status') || 'open').toLowerCase(),
        });
      }

      if (!nieuw.length) {
        setImportMelding(
          `Geen regelingen geïmporteerd. ${nietGevonden} rij(en) met onbekende verstrekker, ${overgeslagen} rij(en) overgeslagen.`,
        );
        setImportBezig(false);

        return;
      }

      const res = await bulkCreateSubsidieregelingen(nieuw);

      setImportBezig(false);

      if (res.error) {
        setImportMelding('De import is niet gelukt.');

        return;
      }

      setImportMelding(
        `${res.count} regeling(en) geïmporteerd.${nietGevonden ? ` ${nietGevonden} rij(en) met onbekende verstrekker overgeslagen.` : ''}${
          overgeslagen ? ` ${overgeslagen} onvolledige rij(en) overgeslagen.` : ''
        }`,
      );
      laad();
    };

    reader.readAsText(file);
    event.target.value = '';
  };

  const columns = useMemo(
    () => [
      { key: 'naam', label: 'Naam', sortable: true, render: (r) => <strong>{r.naam}</strong> },
      { key: 'funder_naam', label: 'Verstrekker', render: (r) => r.funder_naam || '—' },
      { key: 'status', label: 'Status', render: (r) => (REGELING_STATUSSEN.find((s) => s.value === r.status) || {}).label || r.status },
      {
        key: 'deadline_datum',
        label: 'Deadline',
        sortable: true,
        render: (r) => r.deadline_datum || r.deadline_omschrijving || r.deadline || 'doorlopend',
      },
      {
        key: 'bedrag',
        label: 'Bedrag',
        render: (r) => (r.bedrag_min || r.bedrag_max ? `${euro(r.bedrag_min)} – ${euro(r.bedrag_max)}` : '—'),
      },
      {
        key: 'data_tier',
        label: 'Data tier',
        render: (r) => <span style={badgeStyle(r.data_tier === 'premium' ? 'blauw' : 'groen')}>{r.data_tier || '—'}</span>,
      },
      {
        key: 'classification_reviewed',
        label: 'Beoordeeld',
        render: (r) => (
          <span style={badgeStyle(r.classification_reviewed ? 'groen' : 'geel')}>
            {r.classification_reviewed ? 'Ja' : 'Nee'}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <section>
      <h2 style={sectionTitleStyle}>Subsidieregelingen &amp; Deadlines</h2>
      <p style={sectionIntroStyle}>
        Beheer de subsidieregelingen die op de publieke Deadlines-pagina staan. Classificatie (data tier, bron,
        beoordeeld) verloopt via de Classification Workspace; hier wijzigt u de inhoudelijke gegevens.
      </p>

      <div
        style={css('margin: 22px 0; padding: 18px 20px; border: 1px dashed #BFD4C6; border-radius: 16px; background: #F7FAF8;')}
      >
        <div style={css('margin-bottom: 10px; font-size: 14px; font-weight: 800; color: #2C4A5E;')}>
          Regelingen importeren via CSV
        </div>
        <div style={css('margin-bottom: 14px; font-size: 13.5px; line-height: 1.6; color: #536460;')}>
          Kolommen: naam, verstrekker, thema, status, deadline, bedrag_min, bedrag_max, voorwaarden. De verstrekker
          moet al als funder in de database bestaan; onbekende verstrekkers worden overgeslagen en gemeld.
        </div>
        <label style={uploadButtonStyle}>
          {importBezig ? 'Bezig…' : 'CSV-bestand kiezen'}
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={importeer}
            disabled={importBezig}
            style={css('position: absolute; width: 1px; height: 1px; opacity: 0; overflow: hidden;')}
          />
        </label>
        {importMelding ? (
          <div style={css('margin-top: 12px; font-size: 13.5px; font-weight: 700; color: #2F6D47;')}>{importMelding}</div>
        ) : null}
      </div>

      <AdminToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Zoek op naam…" />

      <AdminFilters
        groups={[
          {
            key: 'status',
            label: 'Status',
            value: status,
            onChange: setStatus,
            options: [{ value: null, label: 'Alle' }, ...REGELING_STATUSSEN],
          },
          {
            key: 'data_tier',
            label: 'Data tier',
            value: dataTier,
            onChange: setDataTier,
            options: [{ value: null, label: 'Alle' }, ...DATA_TIERS],
          },
          {
            key: 'source_type',
            label: 'Bron',
            value: sourceType,
            onChange: setSourceType,
            options: [{ value: null, label: 'Alle' }, ...SOURCE_TYPES],
          },
          {
            key: 'reviewed',
            label: 'Beoordeeld',
            value: reviewed,
            onChange: setReviewed,
            options: [
              { value: null, label: 'Alle' },
              { value: true, label: 'Ja' },
              { value: false, label: 'Nee' },
            ],
          },
        ]}
      />

      <AdminBulkActionsBar count={selectedIds.length} onClear={() => setSelectedIds([])} />

      {fout ? (
        <div style={css('margin-bottom: 16px; padding: 16px 18px; border-radius: 14px; background: #FFF1EF; color: #A13B2F; font-weight: 600;')}>
          {fout}
        </div>
      ) : null}

      <AdminDataTable
        columns={columns}
        rows={rows}
        loading={loading}
        emptyText="Geen regelingen gevonden voor deze filters."
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={onSort}
        selectable
        selectedIds={selectedIds}
        onToggleRow={toggleRow}
        onToggleAll={toggleAll}
        actions={(row) => (
          <button type="button" style={smallButtonStyle} onClick={() => openEdit(row)}>
            Bewerken
          </button>
        )}
      />

      {!loading && total > 0 ? <AdminPagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} /> : null}

      {editingId ? (
        <RegelingBewerkPaneel
          row={rows.find((r) => r.id === editingId)}
          form={form}
          setForm={setForm}
          onCancel={() => setEditingId(null)}
          onSave={() => opslaanBewerking(rows.find((r) => r.id === editingId))}
          opslaan={opslaan}
        />
      ) : null}
    </section>
  );
}

function RegelingBewerkPaneel({ row, form, setForm, onCancel, onSave, opslaan }) {
  if (!row) {
    return null;
  }

  const set = (veld) => (event) => setForm((f) => ({ ...f, [veld]: event.target.value }));

  return (
    <div
      style={css(`
        margin-top: 20px;
        padding: clamp(18px, 2.5vw, 24px);
        border: 1px solid #BFD4C6;
        border-radius: 18px;
        background: #F7FAF8;
      `)}
    >
      <div style={css("margin-bottom: 16px; font-family: 'Newsreader', serif; font-size: 22px; color: #2C4A5E;")}>
        {row.naam} bewerken
      </div>

      <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 16px;')}>
        <label style={css('display: grid; gap: 6px; font-size: 13px; font-weight: 700; color: #2C4A5E; grid-column: span 2;')}>
          Naam
          <input style={inputStyle} value={form.naam} onChange={set('naam')} />
        </label>

        <label style={css('display: grid; gap: 6px; font-size: 13px; font-weight: 700; color: #2C4A5E;')}>
          Thema
          <input style={inputStyle} value={form.thema} onChange={set('thema')} />
        </label>

        <label style={css('display: grid; gap: 6px; font-size: 13px; font-weight: 700; color: #2C4A5E;')}>
          Status
          <select style={inputStyle} value={form.status} onChange={set('status')}>
            {REGELING_STATUSSEN.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label style={css('display: grid; gap: 6px; font-size: 13px; font-weight: 700; color: #2C4A5E;')}>
          Deadline (jjjj-mm-dd, leeg = doorlopend)
          <input style={inputStyle} value={form.deadlineDatum} onChange={set('deadlineDatum')} placeholder="2027-01-15" />
        </label>

        <label style={css('display: grid; gap: 6px; font-size: 13px; font-weight: 700; color: #2C4A5E;')}>
          Deadline (vrije tekst)
          <input style={inputStyle} value={form.deadline} onChange={set('deadline')} />
        </label>

        <label style={css('display: grid; gap: 6px; font-size: 13px; font-weight: 700; color: #2C4A5E;')}>
          Deadline omschrijving
          <input style={inputStyle} value={form.deadlineOmschrijving} onChange={set('deadlineOmschrijving')} />
        </label>

        <label style={css('display: grid; gap: 6px; font-size: 13px; font-weight: 700; color: #2C4A5E;')}>
          Bedrag vanaf
          <input style={inputStyle} type="number" value={form.bedragMin} onChange={set('bedragMin')} />
        </label>

        <label style={css('display: grid; gap: 6px; font-size: 13px; font-weight: 700; color: #2C4A5E;')}>
          Bedrag tot
          <input style={inputStyle} type="number" value={form.bedragMax} onChange={set('bedragMax')} />
        </label>

        <label style={css('display: grid; gap: 6px; font-size: 13px; font-weight: 700; color: #2C4A5E; grid-column: span 2;')}>
          Voorwaarden
          <input style={inputStyle} value={form.voorwaarden} onChange={set('voorwaarden')} />
        </label>
      </div>

      <div style={css('margin-top: 22px; display: flex; gap: 12px; flex-wrap: wrap;')}>
        <button type="button" disabled={opslaan} onClick={onSave} style={secondaryButtonStyle}>
          {opslaan ? 'Opslaan…' : 'Opslaan'}
        </button>
        <button type="button" disabled={opslaan} onClick={onCancel} style={plainButtonStyle}>
          Annuleren
        </button>
      </div>
    </div>
  );
}
