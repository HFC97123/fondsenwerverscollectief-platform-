// Beheer · Funders. Bewust nu al opgezet als basis voor de latere
// Classification Workspace: zoeken, sorteren, filteren (data_tier,
// source_type, classification_reviewed, prioriteit) en bulk-selectie zijn er
// al; de daadwerkelijke classificatie-workflow (review-wachtrij, groeperen
// per bron, bulk-classificeren) komt pas in die volgende stap.
// Alle databasecommunicatie loopt via data/services/adminFunders.js.
import React, { useEffect, useMemo, useState } from 'react';
import { css } from '../../shared/lib/css.js';
import {
  DATA_TIERS,
  FUNDER_TYPES,
  PRIORITEIT_BUCKETS,
  SOURCE_TYPES,
  fetchFunders,
  updateFunder,
} from '../../data/services/adminFunders.js';
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
} from './shared/adminStyles.js';

const PAGE_SIZE = 25;

const LEEG_BEWERKING = {
  naam: '',
  type: '',
  status: '',
  website: '',
  missie: '',
  bijdrageMin: '',
  bijdrageMax: '',
  jaarbudget: '',
  prioriteit: '',
  bron: '',
  researchSource: '',
};

function euro(bedrag) {
  if (bedrag == null || bedrag === '') {
    return '—';
  }

  return Number(bedrag).toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

export default function AdminFunders({ notify }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fout, setFout] = useState('');

  const [search, setSearch] = useState('');
  const [dataTier, setDataTier] = useState(null);
  const [sourceType, setSourceType] = useState(null);
  const [reviewed, setReviewed] = useState(null);
  const [prioriteitMin, setPrioriteitMin] = useState(null);

  const [sortColumn, setSortColumn] = useState('naam');
  const [sortDirection, setSortDirection] = useState('asc');
  const [page, setPage] = useState(0);

  const [selectedIds, setSelectedIds] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(LEEG_BEWERKING);
  const [opslaan, setOpslaan] = useState(false);

  const laad = async () => {
    setLoading(true);
    setFout('');

    const res = await fetchFunders({
      search: search.trim() || null,
      dataTier,
      sourceType,
      classificationReviewed: reviewed,
      prioriteitMin,
      sortColumn,
      sortDirection,
      page,
      pageSize: PAGE_SIZE,
    });

    if (res.error) {
      setFout('De funders konden niet worden geladen.');
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
  }, [search, dataTier, sourceType, reviewed, prioriteitMin, sortColumn, sortDirection, page]);

  useEffect(() => {
    setPage(0);
  }, [search, dataTier, sourceType, reviewed, prioriteitMin]);

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
      type: row.type || '',
      status: row.status || '',
      website: row.website || '',
      missie: row.missie || '',
      bijdrageMin: row.bijdrage_min ?? '',
      bijdrageMax: row.bijdrage_max ?? '',
      jaarbudget: row.jaarbudget ?? '',
      prioriteit: row.prioriteit ?? '',
      bron: row.bron || '',
      researchSource: row.research_source || '',
    });
  };

  const opslaanBewerking = async (row) => {
    setOpslaan(true);

    const patch = {
      naam: form.naam.trim(),
      type: form.type || null,
      status: form.status || null,
      website: form.website || null,
      missie: form.missie || null,
      bijdrageMin: form.bijdrageMin === '' ? null : Number(form.bijdrageMin),
      bijdrageMax: form.bijdrageMax === '' ? null : Number(form.bijdrageMax),
      jaarbudget: form.jaarbudget === '' ? null : Number(form.jaarbudget),
      prioriteit: form.prioriteit === '' ? null : Number(form.prioriteit),
      bron: form.bron || null,
      researchSource: form.researchSource || null,
    };

    const res = await updateFunder(row.id, patch);

    setOpslaan(false);

    if (res.error) {
      notify('error', 'De funder kon niet worden bijgewerkt.');

      return;
    }

    setEditingId(null);
    notify('success', 'Funder bijgewerkt.');
    laad();
  };

  const columns = useMemo(
    () => [
      { key: 'naam', label: 'Naam', sortable: true, render: (r) => <strong>{r.naam}</strong> },
      { key: 'type', label: 'Type', render: (r) => (FUNDER_TYPES.find((t) => t.value === r.type) || {}).label || r.type || '—' },
      { key: 'status', label: 'Status', render: (r) => r.status || '—' },
      {
        key: 'data_tier',
        label: 'Data tier',
        render: (r) => <span style={badgeStyle(r.data_tier === 'premium' ? 'blauw' : 'groen')}>{r.data_tier || '—'}</span>,
      },
      {
        key: 'source_type',
        label: 'Bron',
        render: (r) => (SOURCE_TYPES.find((s) => s.value === r.source_type) || {}).label || r.source_type || '—',
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
      { key: 'prioriteit', label: 'Prioriteit', sortable: true, render: (r) => (r.prioriteit ?? '—') },
      {
        key: 'bijdrage',
        label: 'Bijdrage',
        render: (r) => (r.bijdrage_min || r.bijdrage_max ? `${euro(r.bijdrage_min)} – ${euro(r.bijdrage_max)}` : '—'),
      },
      { key: 'contact', label: 'Contact', render: (r) => r.contactpersoon || r.email || '—' },
    ],
    [],
  );

  return (
    <section>
      <h2 style={sectionTitleStyle}>Funders</h2>
      <p style={sectionIntroStyle}>
        Zoek, sorteer en filter de funders in de database. Bewerken raakt nooit de classificatie (data tier, bron,
        beoordeeld) — dat blijft voorbehouden aan de Classification Workspace.
      </p>

      <div style={css('height: 22px;')} />

      <AdminToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Zoek op naam…" />

      <AdminFilters
        groups={[
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
          {
            key: 'prioriteit',
            label: 'Prioriteit',
            value: prioriteitMin,
            onChange: setPrioriteitMin,
            options: PRIORITEIT_BUCKETS,
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
        emptyText="Geen funders gevonden voor deze filters."
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
        <FunderBewerkPaneel
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

function FunderBewerkPaneel({ row, form, setForm, onCancel, onSave, opslaan }) {
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

      <div
        style={css('margin-bottom: 16px; padding: 14px 16px; border: 1px solid #E1EAE4; border-radius: 12px; background: #FFFFFF; font-size: 13px; color: #536460; line-height: 1.7;')}
      >
        <strong style={css('color: #2C4A5E;')}>Contactgegevens (alleen-lezen):</strong>{' '}
        {row.contactpersoon || '—'} · {row.email || 'geen e-mail'} · {row.telefoon || 'geen telefoon'} ·{' '}
        {row.adres || 'geen adres'}
      </div>

      <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 16px;')}>
        <label style={css('display: grid; gap: 6px; font-size: 13px; font-weight: 700; color: #2C4A5E;')}>
          Naam
          <input style={inputStyle} value={form.naam} onChange={set('naam')} />
        </label>

        <label style={css('display: grid; gap: 6px; font-size: 13px; font-weight: 700; color: #2C4A5E;')}>
          Type
          <select style={inputStyle} value={form.type} onChange={set('type')}>
            <option value="">Niet ingevuld</option>
            {FUNDER_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label style={css('display: grid; gap: 6px; font-size: 13px; font-weight: 700; color: #2C4A5E;')}>
          Status
          <input style={inputStyle} value={form.status} onChange={set('status')} />
        </label>

        <label style={css('display: grid; gap: 6px; font-size: 13px; font-weight: 700; color: #2C4A5E;')}>
          Website
          <input style={inputStyle} value={form.website} onChange={set('website')} />
        </label>

        <label style={css('display: grid; gap: 6px; font-size: 13px; font-weight: 700; color: #2C4A5E;')}>
          Prioriteit (0–10)
          <input style={inputStyle} type="number" value={form.prioriteit} onChange={set('prioriteit')} />
        </label>

        <label style={css('display: grid; gap: 6px; font-size: 13px; font-weight: 700; color: #2C4A5E;')}>
          Bijdrage vanaf
          <input style={inputStyle} type="number" value={form.bijdrageMin} onChange={set('bijdrageMin')} />
        </label>

        <label style={css('display: grid; gap: 6px; font-size: 13px; font-weight: 700; color: #2C4A5E;')}>
          Bijdrage tot
          <input style={inputStyle} type="number" value={form.bijdrageMax} onChange={set('bijdrageMax')} />
        </label>

        <label style={css('display: grid; gap: 6px; font-size: 13px; font-weight: 700; color: #2C4A5E;')}>
          Jaarbudget
          <input style={inputStyle} type="number" value={form.jaarbudget} onChange={set('jaarbudget')} />
        </label>

        <label style={css('display: grid; gap: 6px; font-size: 13px; font-weight: 700; color: #2C4A5E; grid-column: span 2;')}>
          Missie
          <input style={inputStyle} value={form.missie} onChange={set('missie')} />
        </label>

        <label style={css('display: grid; gap: 6px; font-size: 13px; font-weight: 700; color: #2C4A5E;')}>
          Bron
          <input style={inputStyle} value={form.bron} onChange={set('bron')} />
        </label>

        <label style={css('display: grid; gap: 6px; font-size: 13px; font-weight: 700; color: #2C4A5E;')}>
          Research source
          <input style={inputStyle} value={form.researchSource} onChange={set('researchSource')} />
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
