// Beheer · Funders. Ingericht als inhoudelijke beheeromgeving: de
// belangrijkste velden voor dagelijks beheer (type gever, disciplines,
// doelgroepen, werkgebieden, bandbreedte bijdrage, toegangsniveau) staan
// vooraan in zowel het overzicht als het bewerkscherm; technische
// classificatie (data tier, bron, beoordeeld, research source) staat nog wel
// gewoon in de admin, maar bewust achter "Geavanceerde filters" en onderaan
// het bewerkscherm - niet omdat het onbelangrijk is, maar omdat het geen
// dagelijkse beheertaak is.
// Alle databasecommunicatie loopt via data/services/adminFunders.js.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { css } from '../../shared/lib/css.js';
import {
  ACCESS_TIERS,
  DATA_TIERS,
  FUNDER_TYPES,
  PRIORITEIT_BUCKETS,
  SOURCE_TYPES,
  bulkSetAccessTier,
  fetchFunders,
  setAccessTier,
  updateFunder,
} from '../../data/services/adminFunders.js';
import { fetchKoppelingen, zetKoppelingen } from '../../data/services/adminClassificaties.js';
import { zetBandbreedte } from '../../data/services/adminBandbreedtes.js';
import { haalBandbreedtesOp, haalClassificatiesOp } from '../../data/services/classificaties.js';
import ClassificatieSelect from '../../shared/ui/ClassificatieSelect.jsx';
import AdminToolbar from './shared/AdminToolbar.jsx';
import AdminFilters from './shared/AdminFilters.jsx';
import AdminDataTable from './shared/AdminDataTable.jsx';
import AdminBulkActionsBar from './shared/AdminBulkActionsBar.jsx';
import AdminAccessTierBulkActie from './shared/AdminAccessTierBulkActie.jsx';
import AdminPagination from './shared/AdminPagination.jsx';
import AdminEditModal from './shared/AdminEditModal.jsx';
import ContributionEditor from './shared/ContributionEditor.jsx';
import {
  badgeStyle,
  inputStyle,
  sectionIntroStyle,
  sectionTitleStyle,
  smallButtonStyle,
  subsectionTitleStyle,
  textareaStyle,
} from './shared/adminStyles.js';

const PAGE_SIZE = 25;

const LEEG_BEWERKING = {
  naam: '',
  type: '',
  status: '',
  website: '',
  missie: '',
  aanvraagcriteria: '',
  bijdrageMin: '',
  bijdrageMax: '',
  jaarbudget: '',
  prioriteit: '',
  bron: '',
  researchSource: '',
  themas: [],
  doelgroepen: [],
  regios: [],
  accessTier: 'premium',
  bandbreedteBijdrageId: '',
  bijdrageToelichting: '',
};

function euro(bedrag) {
  if (bedrag == null || bedrag === '') {
    return '—';
  }

  return Number(bedrag).toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

// Eén klein, compact select-veld voor een classificatiefilter (discipline/
// doelgroep/werkgebied) in de werkbalk. Bewust geen AdminFilters-pillen: bij
// 80 disciplines zou dat de hele filterbalk vullen - exact het probleem
// waarvoor ClassificatieSelect destijds is gebouwd in de bewerkschermen.
function FilterSelect({ label, value, onChange, opties }) {
  return (
    <label style={css('display: grid; gap: 4px; font-size: 12px; font-weight: 800; color: #82918B; text-transform: uppercase; letter-spacing: 0.03em;')}>
      {label}
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        style={css('min-height: 40px; padding: 8px 10px; border: 1px solid #D5E0D9; border-radius: 10px; background: #FFFFFF; font-family: inherit; font-size: 13.5px; color: #2E3A38;')}
      >
        <option value="">Alle</option>
        {opties.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function GeavanceerdeFiltersToggle({ open, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={css('margin: 2px 0 12px; padding: 0; border: none; background: none; font-family: inherit; font-size: 13px; font-weight: 700; color: #2F6D47; cursor: pointer;')}
    >
      {open ? '▾ Geavanceerde filters verbergen' : '▸ Geavanceerde filters (data tier, bron, beoordeeld, prioriteit)'}
    </button>
  );
}

export default function AdminFunders({ notify }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fout, setFout] = useState('');

  const [search, setSearch] = useState('');
  const [type, setType] = useState(null);
  const [thema, setThema] = useState(null);
  const [doelgroep, setDoelgroep] = useState(null);
  const [regio, setRegio] = useState(null);
  const [accessTier, setAccessTierFilter] = useState(null);
  const [bandbreedteBijdrageId, setBandbreedteBijdrageIdFilter] = useState(null);
  const [gescandDoorAgent, setGescandDoorAgent] = useState(null);

  const [geavanceerdOpen, setGeavanceerdOpen] = useState(false);
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
  const [classificatieOpties, setClassificatieOpties] = useState({ themas: [], doelgroepen: [], regios: [] });
  const [bandbreedteOpties, setBandbreedteOpties] = useState([]);
  const [koppelingenLaden, setKoppelingenLaden] = useState(false);
  const [bulkAccessTierBezig, setBulkAccessTierBezig] = useState(false);
  // Momentopname van het formulier direct na het volledig laden (incl.
  // classificaties) van de bewerkte rij — vergelijkingsbasis voor de
  // "niet-opgeslagen wijzigingen"-waarschuwing in AdminEditModal.
  const initialFormRef = useRef(null);

  useEffect(() => {
    haalClassificatiesOp().then((res) => {
      setClassificatieOpties(res);

      if (res.error) {
        notify('error', 'Disciplines/doelgroepen/werkgebieden konden niet worden geladen. Ververs de pagina om het opnieuw te proberen.');
      }
    });
    haalBandbreedtesOp().then((res) => {
      setBandbreedteOpties(res.rows);

      if (res.error) {
        notify('error', 'De bandbreedtes bijdrage konden niet worden geladen. Ververs de pagina om het opnieuw te proberen.');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const laad = async () => {
    setLoading(true);
    setFout('');

    const res = await fetchFunders({
      search: search.trim() || null,
      type,
      dataTier,
      sourceType,
      classificationReviewed: reviewed,
      accessTier,
      prioriteitMin,
      bandbreedteBijdrageId,
      thema,
      doelgroep,
      regio,
      gescandDoorAgent,
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
  }, [search, type, dataTier, sourceType, reviewed, accessTier, prioriteitMin, bandbreedteBijdrageId, thema, doelgroep, regio, gescandDoorAgent, sortColumn, sortDirection, page]);

  useEffect(() => {
    setPage(0);
  }, [search, type, dataTier, sourceType, reviewed, accessTier, prioriteitMin, bandbreedteBijdrageId, thema, doelgroep, regio, gescandDoorAgent]);

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

  const bulkToegangsniveauToepassen = async (waarde) => {
    setBulkAccessTierBezig(true);

    const res = await bulkSetAccessTier('funders', selectedIds, waarde);

    setBulkAccessTierBezig(false);

    if (res.error) {
      notify('error', 'Het toegangsniveau kon niet worden bijgewerkt.');

      return;
    }

    setSelectedIds([]);
    notify('success', `Toegangsniveau van ${res.count} funder(s) gezet op ${waarde}.`);
    laad();
  };

  const openEdit = async (row) => {
    setEditingId(row.id);

    const basis = {
      naam: row.naam || '',
      type: row.type || '',
      status: row.status || '',
      website: row.website || '',
      missie: row.missie || '',
      aanvraagcriteria: row.aanvraagcriteria || '',
      bijdrageMin: row.bijdrage_min ?? '',
      bijdrageMax: row.bijdrage_max ?? '',
      jaarbudget: row.jaarbudget ?? '',
      prioriteit: row.prioriteit ?? '',
      bron: row.bron || '',
      researchSource: row.research_source || '',
      themas: [],
      doelgroepen: [],
      regios: [],
      accessTier: row.access_tier || 'premium',
      bandbreedteBijdrageId: row.bandbreedte_bijdrage_id || '',
      bijdrageToelichting: row.bijdrage_toelichting || '',
    };

    setForm(basis);

    setKoppelingenLaden(true);
    const koppelingen = await fetchKoppelingen('funders', row.id);
    setKoppelingenLaden(false);

    if (koppelingen.error) {
      notify('error', 'De bestaande classificaties van deze funder konden niet worden geladen.');
    }

    const volledig = {
      ...basis,
      themas: koppelingen.themas,
      doelgroepen: koppelingen.doelgroepen,
      regios: koppelingen.regios,
    };

    setForm(volledig);
    // Pas ná het volledig laden (incl. classificaties) is dit de echte
    // uitgangssituatie — anders zou het inladen van de koppelingen zelf al
    // als "wijziging" tellen voor de niet-opgeslagen-wijzigingen-check.
    initialFormRef.current = volledig;
  };

  const opslaanBewerking = async (row) => {
    setOpslaan(true);

    const patch = {
      naam: form.naam.trim(),
      type: form.type || null,
      status: form.status || null,
      website: form.website || null,
      missie: form.missie || null,
      aanvraagcriteria: form.aanvraagcriteria || null,
      bijdrageMin: form.bijdrageMin === '' ? null : Number(form.bijdrageMin),
      bijdrageMax: form.bijdrageMax === '' ? null : Number(form.bijdrageMax),
      jaarbudget: form.jaarbudget === '' ? null : Number(form.jaarbudget),
      prioriteit: form.prioriteit === '' ? null : Number(form.prioriteit),
      bron: form.bron || null,
      researchSource: form.researchSource || null,
      bijdrageToelichting: form.bijdrageToelichting || null,
    };

    const res = await updateFunder(row.id, patch);

    if (res.error) {
      setOpslaan(false);
      notify('error', 'De funder kon niet worden bijgewerkt.');

      return;
    }

    const koppelRes = await zetKoppelingen('funders', row.id, {
      themas: form.themas,
      doelgroepen: form.doelgroepen,
      regios: form.regios,
    });

    setOpslaan(false);

    if (koppelRes.error) {
      notify('error', 'Funder bijgewerkt, maar de classificaties konden niet worden opgeslagen.');
      setEditingId(null);
      laad();

      return;
    }

    if (form.accessTier !== (row.access_tier || 'premium')) {
      const tierRes = await setAccessTier('funders', row.id, form.accessTier);

      if (tierRes.error) {
        notify('error', 'Funder bijgewerkt, maar het toegangsniveau kon niet worden opgeslagen.');
        setEditingId(null);
        laad();

        return;
      }
    }

    if (form.bandbreedteBijdrageId !== (row.bandbreedte_bijdrage_id || '')) {
      const bandbreedteRes = await zetBandbreedte('funders', row.id, form.bandbreedteBijdrageId || null);

      if (bandbreedteRes.error) {
        notify('error', 'Funder bijgewerkt, maar de bandbreedte bijdrage kon niet worden opgeslagen.');
        setEditingId(null);
        laad();

        return;
      }
    }

    setEditingId(null);
    initialFormRef.current = null;
    notify('success', 'Funder bijgewerkt.');
    laad();
  };

  const columns = useMemo(
    () => [
      { key: 'naam', label: 'Naam', sortable: true, render: (r) => <strong>{r.naam}</strong> },
      { key: 'type', label: 'Type gever', render: (r) => (FUNDER_TYPES.find((t) => t.value === r.type) || {}).label || r.type || '—' },
      {
        key: 'access_tier',
        label: 'Toegangsniveau',
        render: (r) => (
          <span style={badgeStyle(r.access_tier === 'premium' ? 'blauw' : r.access_tier === 'pro' ? 'geel' : 'groen')}>
            {(ACCESS_TIERS.find((t) => t.value === r.access_tier) || {}).label || r.access_tier || '—'}
          </span>
        ),
      },
      {
        key: 'bandbreedte_bijdrage',
        label: 'Bandbreedte bijdrage',
        render: (r) => r.bandbreedte_bijdrage_naam || '—',
      },
      {
        key: 'bijdrage',
        label: 'Bijdrage',
        render: (r) => (r.bijdrage_min || r.bijdrage_max ? `${euro(r.bijdrage_min)} – ${euro(r.bijdrage_max)}` : '—'),
      },
      { key: 'contact', label: 'Contact', render: (r) => r.contactpersoon || r.email || '—' },
      { key: 'prioriteit', label: 'Prioriteit', sortable: true, render: (r) => (r.prioriteit ?? '—') },
      {
        key: 'gescand_door_agent',
        label: 'Gescand door agent',
        render: (r) => <span style={badgeStyle('grijs')}>{r.source_type === 'internet_scan' ? 'Ja' : 'Nee'}</span>,
      },
      {
        key: 'classification_reviewed',
        label: 'Beoordeeld',
        render: (r) => <span style={badgeStyle('grijs')}>{r.classification_reviewed ? 'Ja' : 'Nee'}</span>,
      },
      {
        key: 'data_tier',
        label: 'Data tier',
        render: (r) => <span style={badgeStyle('grijs')}>{r.data_tier || '—'}</span>,
      },
    ],
    [],
  );

  return (
    <section>
      <h2 style={sectionTitleStyle}>Funders</h2>
      <p style={sectionIntroStyle}>
        Inhoudelijk beheer van fondsen: type gever, disciplines, doelgroepen, werkgebied, bandbreedte bijdrage en
        toegangsniveau. Technische classificatie (data tier, bron, beoordeeld) staat onder Geavanceerde filters.
      </p>

      <div style={css('height: 22px;')} />

      <AdminToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Zoek op naam…" />

      <AdminFilters
        groups={[
          {
            key: 'type',
            label: 'Type gever',
            value: type,
            onChange: setType,
            options: [{ value: null, label: 'Alle' }, ...FUNDER_TYPES],
          },
          {
            key: 'access_tier',
            label: 'Toegangsniveau',
            value: accessTier,
            onChange: setAccessTierFilter,
            options: [{ value: null, label: 'Alle' }, ...ACCESS_TIERS],
          },
          {
            key: 'bandbreedte_bijdrage',
            label: 'Bandbreedte bijdrage',
            value: bandbreedteBijdrageId,
            onChange: setBandbreedteBijdrageIdFilter,
            options: [
              { value: null, label: 'Alle' },
              ...bandbreedteOpties.map((b) => ({ value: b.id, label: b.naam })),
            ],
          },
          {
            key: 'gescand_door_agent',
            label: 'Gescand door agent',
            value: gescandDoorAgent,
            onChange: setGescandDoorAgent,
            options: [
              { value: null, label: 'Alle' },
              { value: true, label: 'Ja' },
              { value: false, label: 'Nee' },
            ],
          },
        ]}
      />

      <div style={css('display: flex; gap: 14px; flex-wrap: wrap; margin: 0 0 16px;')}>
        <FilterSelect label="Discipline" value={thema} onChange={setThema} opties={classificatieOpties.themas} />
        <FilterSelect label="Doelgroep" value={doelgroep} onChange={setDoelgroep} opties={classificatieOpties.doelgroepen} />
        <FilterSelect label="Werkgebied" value={regio} onChange={setRegio} opties={classificatieOpties.regios} />
      </div>

      <GeavanceerdeFiltersToggle open={geavanceerdOpen} onToggle={() => setGeavanceerdOpen((o) => !o)} />

      {geavanceerdOpen ? (
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
      ) : null}

      <AdminBulkActionsBar count={selectedIds.length} onClear={() => setSelectedIds([])}>
        <AdminAccessTierBulkActie onApply={bulkToegangsniveauToepassen} bezig={bulkAccessTierBezig} />
      </AdminBulkActionsBar>

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
          onCancel={() => {
            setEditingId(null);
            initialFormRef.current = null;
          }}
          onSave={() => opslaanBewerking(rows.find((r) => r.id === editingId))}
          opslaan={opslaan}
          dirty={initialFormRef.current ? JSON.stringify(form) !== JSON.stringify(initialFormRef.current) : false}
          classificatieOpties={classificatieOpties}
          bandbreedteOpties={bandbreedteOpties}
          koppelingenLaden={koppelingenLaden}
        />
      ) : null}
    </section>
  );
}

// Grid met 2-4 velden per rij, met een korte titel erboven. Zelfde
// grid-template-columns als voorheen - alleen nu opgeknipt in duidelijk
// gelabelde secties in plaats van één lange, ongesorteerde lijst.
function VeldGrid({ children }) {
  return <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 16px;')}>{children}</div>;
}

function Veld({ label, span, children }) {
  return (
    <label
      style={css(`display: grid; gap: 6px; font-size: 13px; font-weight: 700; color: #2C4A5E; ${span ? `grid-column: span ${span};` : ''}`)}
    >
      {label}
      {children}
    </label>
  );
}

function SectieKop({ children, muted }) {
  return (
    <div style={css(`margin: 26px 0 14px; ${muted ? '' : 'padding-top: 10px; border-top: 1px solid #E1EAE4;'}`)}>
      <div style={muted ? css('font-size: 12px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; color: #82918B;') : subsectionTitleStyle}>
        {children}
      </div>
    </div>
  );
}

function FunderBewerkPaneel({ row, form, setForm, onCancel, onSave, opslaan, dirty, classificatieOpties, bandbreedteOpties, koppelingenLaden }) {
  if (!row) {
    return null;
  }

  const set = (veld) => (event) => setForm((f) => ({ ...f, [veld]: event.target.value }));

  return (
    <AdminEditModal title={`${row.naam} bewerken`} onClose={onCancel} onSave={onSave} saving={opslaan} dirty={dirty}>
      <div
        style={css('margin-bottom: 6px; padding: 14px 16px; border: 1px solid #E1EAE4; border-radius: 12px; background: #F7FAF8; font-size: 13px; color: #536460; line-height: 1.7;')}
      >
        <strong style={css('color: #2C4A5E;')}>Contactgegevens (alleen-lezen):</strong>{' '}
        {row.contactpersoon || '—'} · {row.email || 'geen e-mail'} · {row.telefoon || 'geen telefoon'} ·{' '}
        {row.adres || 'geen adres'}
      </div>

      <SectieKop>Basisgegevens</SectieKop>
      <VeldGrid>
        <Veld label="Naam" span={2}>
          <input style={inputStyle} value={form.naam} onChange={set('naam')} />
        </Veld>
        <Veld label="Website">
          <input style={inputStyle} value={form.website} onChange={set('website')} />
        </Veld>
        <Veld label="Missie / korte omschrijving" span={3}>
          <input style={inputStyle} value={form.missie} onChange={set('missie')} />
        </Veld>
      </VeldGrid>

      <SectieKop>Classificatie</SectieKop>
      <p style={css('margin: -8px 0 14px; font-size: 12.5px; color: #82918B;')}>
        Alleen bestaande waarden zijn te kiezen. Ontbreekt een waarde? Voeg die eerst toe via Beheer →
        Classificaties.
      </p>
      <VeldGrid>
        <Veld label="Type gever">
          <select style={inputStyle} value={form.type} onChange={set('type')}>
            <option value="">Niet ingevuld</option>
            {FUNDER_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Veld>
        <Veld label="Disciplines">
          <ClassificatieSelect
            opties={classificatieOpties.themas}
            waarde={form.themas}
            onChange={(waarde) => setForm((f) => ({ ...f, themas: waarde }))}
            placeholder={koppelingenLaden ? 'Laden…' : 'Disciplines selecteren…'}
            ariaLabel="Disciplines"
          />
        </Veld>
        <Veld label="Doelgroepen">
          <ClassificatieSelect
            opties={classificatieOpties.doelgroepen}
            waarde={form.doelgroepen}
            onChange={(waarde) => setForm((f) => ({ ...f, doelgroepen: waarde }))}
            placeholder={koppelingenLaden ? 'Laden…' : 'Doelgroepen selecteren…'}
            ariaLabel="Doelgroepen"
          />
        </Veld>
        <Veld label="Werkgebieden">
          <ClassificatieSelect
            opties={classificatieOpties.regios}
            waarde={form.regios}
            onChange={(waarde) => setForm((f) => ({ ...f, regios: waarde }))}
            placeholder={koppelingenLaden ? 'Laden…' : 'Werkgebieden selecteren…'}
            ariaLabel="Werkgebieden"
          />
        </Veld>
      </VeldGrid>

      <SectieKop>Bijdrage</SectieKop>
      <ContributionEditor
        bandbreedteId={form.bandbreedteBijdrageId}
        onBandbreedteChange={(waarde) => setForm((f) => ({ ...f, bandbreedteBijdrageId: waarde }))}
        toelichting={form.bijdrageToelichting}
        onToelichtingChange={(waarde) => setForm((f) => ({ ...f, bijdrageToelichting: waarde }))}
        bandbreedteOpties={bandbreedteOpties}
      />
      <div style={css('height: 16px;')} />
      <VeldGrid>
        <Veld label="Jaarbudget">
          <input style={inputStyle} type="number" value={form.jaarbudget} onChange={set('jaarbudget')} />
        </Veld>
      </VeldGrid>

      <SectieKop>Aanvraag</SectieKop>
      <VeldGrid>
        <Veld label="Aanvraagcriteria (wie mag aanvragen, rechtsvorm, omvang, looptijd, eigen bijdrage, cofinanciering, uitsluitingen, overige voorwaarden)" span={3}>
          <textarea style={textareaStyle} rows={4} value={form.aanvraagcriteria} onChange={set('aanvraagcriteria')} />
        </Veld>
      </VeldGrid>

      <SectieKop>Toegang</SectieKop>
      <VeldGrid>
        <Veld label="Toegangsniveau">
          <select style={inputStyle} value={form.accessTier} onChange={set('accessTier')}>
            {ACCESS_TIERS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Veld>
      </VeldGrid>

      <SectieKop muted>Technische status</SectieKop>
      <VeldGrid>
        <Veld label="Status">
          <input style={inputStyle} value={form.status} onChange={set('status')} />
        </Veld>
        <Veld label="Prioriteit (0–10)">
          <input style={inputStyle} type="number" value={form.prioriteit} onChange={set('prioriteit')} />
        </Veld>
        <Veld label="Bron">
          <input style={inputStyle} value={form.bron} onChange={set('bron')} />
        </Veld>
        <Veld label="Research source">
          <input style={inputStyle} value={form.researchSource} onChange={set('researchSource')} />
        </Veld>
      </VeldGrid>
    </AdminEditModal>
  );
}
