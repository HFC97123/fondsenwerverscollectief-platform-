// Beheer · Subsidieregelingen / Deadlines. Ingericht als inhoudelijke
// beheeromgeving, zelfde opzet als AdminFunders.jsx: type gever, disciplines,
// doelgroepen, werkgebieden, bandbreedte bijdrage en toegangsniveau staan
// vooraan; technische classificatie (data tier, bron, beoordeeld) staat
// achter "Geavanceerde filters" en onderaan het bewerkscherm.
// Lezen en schrijven gaat uitsluitend via de admin-only RPC's in
// data/services/adminSubsidieregelingen.js.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { css } from '../../shared/lib/css.js';
import {
  REGELING_STATUSSEN,
  bulkCreateSubsidieregelingen,
  bulkUpdateSubsidieregeling,
  classifySubsidieregeling,
  fetchRondes,
  fetchSubsidieregelingen,
  updateSubsidieregeling,
  upsertRonde,
  verwijderRonde,
} from '../../data/services/adminSubsidieregelingen.js';
import {
  ACCESS_TIERS,
  DATA_TIERS,
  FUNDER_TYPES,
  SOURCE_TYPES,
  bulkSetAccessTier,
  bulkSetReviewed,
  fetchFunders,
  setAccessTier,
} from '../../data/services/adminFunders.js';
import { bulkZetKoppelingen, fetchKoppelingen, zetKoppelingen } from '../../data/services/adminClassificaties.js';
import { bulkZetBandbreedte, zetBandbreedte } from '../../data/services/adminBandbreedtes.js';
import { haalBandbreedtesOp, haalClassificatiesOp } from '../../data/services/classificaties.js';
import ClassificatieSelect from '../../shared/ui/ClassificatieSelect.jsx';
import AdminToolbar from './shared/AdminToolbar.jsx';
import AdminFilters from './shared/AdminFilters.jsx';
import AdminDataTable from './shared/AdminDataTable.jsx';
import AdminBulkActionsBar from './shared/AdminBulkActionsBar.jsx';
import AdminAccessTierBulkActie from './shared/AdminAccessTierBulkActie.jsx';
import BulkBewerkModal from './shared/BulkBewerkModal.jsx';
import AdminPagination from './shared/AdminPagination.jsx';
import AdminEditModal from './shared/AdminEditModal.jsx';
import ContributionEditor from './shared/ContributionEditor.jsx';
import {
  badgeStyle,
  inputStyle,
  plainButtonStyle,
  secondaryButtonStyle,
  sectionIntroStyle,
  sectionTitleStyle,
  smallButtonStyle,
  subsectionTitleStyle,
  textareaStyle,
  uploadButtonStyle,
} from './shared/adminStyles.js';

const PAGE_SIZE = 25;

const LEEG_BEWERKING = {
  naam: '',
  type: '',
  aanvraaglink: '',
  bedragMin: '',
  bedragMax: '',
  eigenBijdrage: '',
  cofinanciering: '',
  deadline: '',
  deadlineDatum: '',
  deadlineOmschrijving: '',
  voorwaarden: '',
  beoordelingscriteria: '',
  typeProjecten: '',
  begrotingseisen: '',
  behandeltermijn: '',
  aanvraagprocedure: '',
  status: 'open',
  themas: [],
  doelgroepen: [],
  regios: [],
  accessTier: 'premium',
  bandbreedteBijdrageId: '',
  bijdrageToelichting: '',
  classificationReviewed: false,
  contactpersoon: '',
  contactpersoonFunctie: '',
  email: '',
  telefoon: '',
  algemeenEmail: '',
  algemeenTelefoon: '',
  website: '',
  straat: '',
  huisnummer: '',
  postcode: '',
  plaats: '',
  provincie: '',
  land: '',
  volgendeVergaderdatum: '',
  vergaderfrequentie: '',
  vergaderingToelichting: '',
};

// Leeg formulier voor een aanvraagronde (meerdere sluitingsdata per regeling).
// beoordelingsdatum en beoordelingsperiode zijn allebei optioneel en sluiten
// elkaar niet uit qua invoer — is de exacte datum nog niet bekend, vul dan
// alleen de periode in (bijv. "maart 2027") in plaats van een verzonnen datum.
const LEEG_RONDE = {
  sluitingsdatum: '',
  sluitingstijd: '',
  openVanaf: '',
  beoordelingsdatum: '',
  beoordelingsperiode: '',
  toelichting: '',
  bronUrl: '',
  actief: true,
};

// CSV-kolommen; per veld de namen die we accepteren. Zelfde opzet als de
// oude implementatie, nu gemapt op de echte kolommen.
const KOLOMMEN = {
  naam: ['naam', 'regeling', 'regelingnaam'],
  funder: ['verstrekker', 'funder', 'fonds'],
  thema: ['thema', 'discipline'],
  werkgebied: ['werkgebied', 'regio'],
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

// Compacte weergave van een datum voor de aanvraagrondes-lijst, bijv. "03 aug 2026".
function formatDatumKort(datum) {
  if (!datum) {
    return null;
  }

  const d = new Date(`${datum}T00:00:00`);

  if (Number.isNaN(d.getTime())) {
    return datum;
  }

  return d.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Zelfde compacte select-filter als bij Funders — geen pillenrij bij 80
// disciplines.
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
      {open ? '▾ Geavanceerde filters verbergen' : '▸ Geavanceerde filters (data tier, bron, beoordeeld)'}
    </button>
  );
}

export default function AdminDeadlines({ notify }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fout, setFout] = useState('');

  const [search, setSearch] = useState('');
  const [funderSearch, setFunderSearch] = useState('');
  const [status, setStatus] = useState(null);
  const [type, setType] = useState(null);
  const [thema, setThema] = useState(null);
  const [doelgroep, setDoelgroep] = useState(null);
  const [regio, setRegio] = useState(null);
  const [accessTier, setAccessTierFilter] = useState(null);
  const [bandbreedteBijdrageId, setBandbreedteBijdrageIdFilter] = useState(null);
  const [discoveredBy, setDiscoveredBy] = useState(null);

  const [geavanceerdOpen, setGeavanceerdOpen] = useState(false);
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
  const [classificatieOpties, setClassificatieOpties] = useState({ themas: [], doelgroepen: [], regios: [] });
  const [bandbreedteOpties, setBandbreedteOpties] = useState([]);
  const [koppelingenLaden, setKoppelingenLaden] = useState(false);
  const [bulkAccessTierBezig, setBulkAccessTierBezig] = useState(false);
  // Vervolgopdracht - volwaardige bulk-editor, zelfde opzet als
  // AdminFunders.jsx: AdminAccessTierBulkActie blijft bestaan voor een
  // snelle toegangsniveau-wijziging, "Toegangsniveau" is hieronder óók een
  // veld in de nieuwe, bredere bulk-editor (beide roepen dezelfde
  // bulkSetAccessTier aan — geen dubbele implementatie).
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkBezig, setBulkBezig] = useState(false);
  const [bulkFout, setBulkFout] = useState('');
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

    const res = await fetchSubsidieregelingen({
      search: search.trim() || null,
      funderSearch: funderSearch.trim() || null,
      status,
      type,
      dataTier,
      sourceType,
      classificationReviewed: reviewed,
      accessTier,
      bandbreedteBijdrageId,
      thema,
      doelgroep,
      regio,
      discoveredBy,
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
  }, [
    search,
    funderSearch,
    status,
    type,
    dataTier,
    sourceType,
    reviewed,
    accessTier,
    bandbreedteBijdrageId,
    thema,
    doelgroep,
    regio,
    discoveredBy,
    sortColumn,
    sortDirection,
    page,
  ]);

  useEffect(() => {
    setPage(0);
  }, [search, funderSearch, status, type, dataTier, sourceType, reviewed, accessTier, bandbreedteBijdrageId, thema, doelgroep, regio, discoveredBy]);

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

    const res = await bulkSetAccessTier('subsidieregelingen', selectedIds, waarde);

    setBulkAccessTierBezig(false);

    if (res.error) {
      notify('error', 'Het toegangsniveau kon niet worden bijgewerkt.');

      return;
    }

    setSelectedIds([]);
    notify('success', `Toegangsniveau van ${res.count} regeling(en) gezet op ${waarde}.`);
    laad();
  };

  // Veldenlijst voor de generieke BulkBewerkModal (vervolgopdracht §5) — zelfde
  // opbouw als bulkVelden in AdminFunders.jsx, aangevuld met de twee velden
  // die alleen bij subsidieregelingen bestaan (Status/aanvraagstatus en Type
  // projecten; funders hebben deze niet).
  const bulkVelden = useMemo(
    () => [
      {
        key: 'reviewed',
        label: 'Beoordeeld',
        kind: 'single',
        control: 'select',
        opties: [
          { value: 'true', label: 'Ja' },
          { value: 'false', label: 'Nee' },
        ],
        accessor: (r) => String(!!r.classification_reviewed),
        labelVoorWaarde: (v) => (v === 'true' ? 'Ja' : 'Nee'),
      },
      {
        key: 'accessTier',
        label: 'Toegangsniveau',
        kind: 'single',
        control: 'select',
        opties: ACCESS_TIERS,
        accessor: (r) => r.access_tier || 'premium',
        labelVoorWaarde: (v) => (ACCESS_TIERS.find((t) => t.value === v) || {}).label || v,
      },
      {
        key: 'type',
        label: 'Type gever',
        kind: 'single',
        control: 'select',
        opties: [{ value: '', label: 'Overgenomen van gever' }, ...FUNDER_TYPES],
        accessor: (r) => r.type || '',
        labelVoorWaarde: (v) =>
          v === '' ? 'Overgenomen van gever' : (FUNDER_TYPES.find((t) => t.value === v) || {}).label || v,
      },
      {
        key: 'status',
        label: 'Status',
        kind: 'single',
        control: 'select',
        opties: REGELING_STATUSSEN,
        accessor: (r) => r.status || 'open',
        labelVoorWaarde: (v) => (REGELING_STATUSSEN.find((s) => s.value === v) || {}).label || v,
      },
      {
        key: 'typeProjecten',
        label: 'Type projecten',
        kind: 'single',
        control: 'text',
        accessor: (r) => r.type_projecten || '',
      },
      {
        key: 'dataTier',
        label: 'Data tier',
        kind: 'single',
        control: 'select',
        opties: DATA_TIERS,
        accessor: (r) => r.data_tier || '',
        labelVoorWaarde: (v) => (DATA_TIERS.find((t) => t.value === v) || {}).label || v,
      },
      {
        key: 'bandbreedteBijdrageId',
        label: 'Bandbreedte bijdrage',
        kind: 'single',
        control: 'select',
        opties: [
          { value: '', label: 'Geen bandbreedte' },
          ...bandbreedteOpties.map((b) => ({ value: b.id, label: b.naam })),
        ],
        accessor: (r) => r.bandbreedte_bijdrage_id || '',
        labelVoorWaarde: (v) => (v === '' ? 'Geen bandbreedte' : (bandbreedteOpties.find((b) => b.id === v) || {}).naam || v),
      },
      {
        key: 'vergaderfrequentie',
        label: 'Vergaderfrequentie',
        kind: 'single',
        control: 'text',
        placeholder: 'bijv. 3x per jaar',
        accessor: (r) => r.vergaderfrequentie || '',
      },
      { key: 'themas', label: 'Disciplines', kind: 'classificatie', opties: classificatieOpties.themas },
      { key: 'doelgroepen', label: 'Doelgroepen', kind: 'classificatie', opties: classificatieOpties.doelgroepen },
      { key: 'regios', label: 'Werkgebieden', kind: 'classificatie', opties: classificatieOpties.regios },
    ],
    [classificatieOpties, bandbreedteOpties],
  );

  // Zelfde orchestratie als bulkBewerkingToepassen in AdminFunders.jsx: per
  // groep aangevinkte velden precies één bestaande service-functie, geen
  // request per record (§16).
  const bulkBewerkingToepassen = async (payload) => {
    setBulkBezig(true);
    setBulkFout('');

    const ids = [...selectedIds];
    const mislukt = [];

    if ('reviewed' in payload) {
      const res = await bulkSetReviewed('subsidieregelingen', ids, payload.reviewed === 'true');

      if (res.error) {
        mislukt.push('Beoordeeld');
      }
    }

    if ('accessTier' in payload) {
      const res = await bulkSetAccessTier('subsidieregelingen', ids, payload.accessTier);

      if (res.error) {
        mislukt.push('Toegangsniveau');
      }
    }

    const veldenPatch = {};

    ['type', 'status', 'typeProjecten', 'dataTier', 'vergaderfrequentie'].forEach((k) => {
      if (k in payload) {
        veldenPatch[k] = payload[k];
      }
    });

    if (Object.keys(veldenPatch).length > 0) {
      const res = await bulkUpdateSubsidieregeling(ids, veldenPatch);

      if (res.error) {
        mislukt.push('Type gever / Status / Type projecten / Data tier / Vergaderfrequentie');
      }
    }

    if ('bandbreedteBijdrageId' in payload) {
      const res = await bulkZetBandbreedte('subsidieregelingen', ids, payload.bandbreedteBijdrageId || null);

      if (res.error) {
        mislukt.push('Bandbreedte bijdrage');
      }
    }

    const koppelingenPatch = {};

    ['themas', 'doelgroepen', 'regios'].forEach((k) => {
      if (k in payload) {
        koppelingenPatch[k] = payload[k];
      }
    });

    if (Object.keys(koppelingenPatch).length > 0) {
      const res = await bulkZetKoppelingen('subsidieregelingen', ids, koppelingenPatch);

      if (res.error) {
        mislukt.push('Disciplines / Doelgroepen / Werkgebieden');
      }
    }

    setBulkBezig(false);

    if (mislukt.length > 0) {
      setBulkFout(
        `Niet alle wijzigingen konden worden opgeslagen (mislukt: ${mislukt.join('; ')}). De overige, wél gelukte wijzigingen staan al verwerkt — controleer de gegevens en probeer de mislukte onderdelen opnieuw.`,
      );
      laad();

      return;
    }

    setBulkModalOpen(false);
    setSelectedIds([]);
    notify('success', `${ids.length} regeling(en) bijgewerkt.`);
    laad();
  };

  const openEdit = async (row) => {
    setEditingId(row.id);

    const basis = {
      naam: row.naam || '',
      type: row.type || '',
      aanvraaglink: row.aanvraaglink || '',
      bedragMin: row.bedrag_min ?? '',
      bedragMax: row.bedrag_max ?? '',
      eigenBijdrage: row.eigen_bijdrage || '',
      cofinanciering: row.cofinanciering || '',
      deadline: row.deadline || '',
      deadlineDatum: row.deadline_datum || '',
      deadlineOmschrijving: row.deadline_omschrijving || '',
      voorwaarden: row.voorwaarden || '',
      beoordelingscriteria: row.beoordelingscriteria || '',
      typeProjecten: row.type_projecten || '',
      begrotingseisen: row.begrotingseisen || '',
      behandeltermijn: row.behandeltermijn || '',
      aanvraagprocedure: row.aanvraagprocedure || '',
      status: row.status || 'open',
      themas: [],
      doelgroepen: [],
      regios: [],
      accessTier: row.access_tier || 'premium',
      bandbreedteBijdrageId: row.bandbreedte_bijdrage_id || '',
      bijdrageToelichting: row.bijdrage_toelichting || '',
      classificationReviewed: !!row.classification_reviewed,
      contactpersoon: row.contactpersoon || '',
      contactpersoonFunctie: row.contactpersoon_functie || '',
      email: row.email || '',
      telefoon: row.telefoon || '',
      algemeenEmail: row.algemeen_email || '',
      algemeenTelefoon: row.algemeen_telefoon || '',
      website: row.website || '',
      straat: row.straat || '',
      huisnummer: row.huisnummer || '',
      postcode: row.postcode || '',
      plaats: row.plaats || '',
      provincie: row.provincie || '',
      land: row.land || '',
      volgendeVergaderdatum: row.volgende_vergaderdatum || '',
      vergaderfrequentie: row.vergaderfrequentie || '',
      vergaderingToelichting: row.vergadering_toelichting || '',
    };

    setForm(basis);

    setKoppelingenLaden(true);
    const koppelingen = await fetchKoppelingen('subsidieregelingen', row.id);
    setKoppelingenLaden(false);

    if (koppelingen.error) {
      notify('error', 'De bestaande classificaties van deze regeling konden niet worden geladen.');
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
      // thema/werkgebied worden bewust niet meer meegestuurd: het
      // bewerkscherm kent geen vrije-tekstvelden meer voor deze twee, en de
      // RPC laat het legacy tekstveld ongewijzigd (coalesce) wanneer het
      // ontbreekt. De centrale multi-select hieronder is nu de enige manier
      // om disciplines/werkgebieden te classificeren.
      bedragMin: form.bedragMin === '' ? null : Number(form.bedragMin),
      bedragMax: form.bedragMax === '' ? null : Number(form.bedragMax),
      deadline: form.deadline || null,
      deadlineDatum: form.deadlineDatum || null,
      deadlineOmschrijving: form.deadlineOmschrijving || null,
      voorwaarden: form.voorwaarden || null,
      status: form.status || 'open',
      funderId: row.funder_id,
      aanvraaglink: form.aanvraaglink || null,
      beoordelingscriteria: form.beoordelingscriteria || null,
      typeProjecten: form.typeProjecten || null,
      begrotingseisen: form.begrotingseisen || null,
      eigenBijdrage: form.eigenBijdrage || null,
      cofinanciering: form.cofinanciering || null,
      behandeltermijn: form.behandeltermijn || null,
      aanvraagprocedure: form.aanvraagprocedure || null,
      type: form.type || null,
      bijdrageToelichting: form.bijdrageToelichting || null,
      contactpersoon: form.contactpersoon || null,
      contactpersoonFunctie: form.contactpersoonFunctie || null,
      email: form.email || null,
      telefoon: form.telefoon || null,
      algemeenEmail: form.algemeenEmail || null,
      algemeenTelefoon: form.algemeenTelefoon || null,
      website: form.website || null,
      straat: form.straat || null,
      huisnummer: form.huisnummer || null,
      postcode: form.postcode || null,
      plaats: form.plaats || null,
      provincie: form.provincie || null,
      land: form.land || null,
      volgendeVergaderdatum: form.volgendeVergaderdatum || null,
      vergaderfrequentie: form.vergaderfrequentie || null,
      vergaderingToelichting: form.vergaderingToelichting || null,
    };

    const res = await updateSubsidieregeling(row.id, patch);

    if (res.error) {
      setOpslaan(false);
      notify('error', 'De regeling kon niet worden bijgewerkt.');

      return;
    }

    const koppelRes = await zetKoppelingen('subsidieregelingen', row.id, {
      themas: form.themas,
      doelgroepen: form.doelgroepen,
      regios: form.regios,
    });

    setOpslaan(false);

    if (koppelRes.error) {
      notify('error', 'Regeling bijgewerkt, maar de classificaties konden niet worden opgeslagen.');
      setEditingId(null);
      laad();

      return;
    }

    if (form.accessTier !== (row.access_tier || 'premium')) {
      const tierRes = await setAccessTier('subsidieregelingen', row.id, form.accessTier);

      if (tierRes.error) {
        notify('error', 'Regeling bijgewerkt, maar het toegangsniveau kon niet worden opgeslagen.');
        setEditingId(null);
        laad();

        return;
      }
    }

    if (form.bandbreedteBijdrageId !== (row.bandbreedte_bijdrage_id || '')) {
      const bandbreedteRes = await zetBandbreedte('subsidieregelingen', row.id, form.bandbreedteBijdrageId || null);

      if (bandbreedteRes.error) {
        notify('error', 'Regeling bijgewerkt, maar de bandbreedte bijdrage kon niet worden opgeslagen.');
        setEditingId(null);
        laad();

        return;
      }
    }

    // "Beoordeeld" is een bevestiging, geen herclassificatie: data_tier/
    // source_type gaan ongewijzigd (de bestaande waarden van deze regeling)
    // mee, alleen de reviewed-vlag zelf wijzigt.
    if (form.classificationReviewed !== !!row.classification_reviewed) {
      const reviewRes = await classifySubsidieregeling(row.id, {
        dataTier: row.data_tier,
        sourceType: row.source_type,
        reviewed: form.classificationReviewed,
      });

      if (reviewRes.error) {
        notify('error', 'Regeling bijgewerkt, maar "beoordeeld" kon niet worden opgeslagen.');
        setEditingId(null);
        laad();

        return;
      }
    }

    setEditingId(null);
    initialFormRef.current = null;
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
          werkgebied: val('werkgebied') || null,
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
      {
        key: 'type_gever',
        label: 'Type gever',
        render: (r) => (FUNDER_TYPES.find((t) => t.value === (r.type || r.funder_type)) || {}).label || r.type || r.funder_type || '—',
      },
      { key: 'status', label: 'Status', render: (r) => (REGELING_STATUSSEN.find((s) => s.value === r.status) || {}).label || r.status },
      {
        key: 'deadline_datum',
        label: 'Deadline',
        sortable: true,
        // Zodra een regeling aanvraagrondes heeft (rondes_aantal > 0) is de
        // eerstvolgende ronde de enige bron — zelfde regel als de Timeline en
        // de kompas-RPC, nooit de oude losse velden ernaast tonen.
        render: (r) =>
          (r.rondes_aantal ?? 0) > 0 ? (
            r.volgende_ronde_sluitingsdatum ? (
              <>
                {formatDatumKort(r.volgende_ronde_sluitingsdatum)}
                {r.volgende_ronde_sluitingstijd ? ` · ${String(r.volgende_ronde_sluitingstijd).slice(0, 5)}` : ''}
                <span style={badgeStyle('grijs')}> {r.rondes_aantal} rondes</span>
              </>
            ) : (
              <>
                geen aankomende ronde
                <span style={badgeStyle('grijs')}> {r.rondes_aantal} rondes</span>
              </>
            )
          ) : (
            r.deadline_datum || r.deadline_omschrijving || r.deadline || 'doorlopend'
          ),
      },
      {
        key: 'bedrag',
        label: 'Bedrag',
        render: (r) => (r.bedrag_min || r.bedrag_max ? `${euro(r.bedrag_min)} – ${euro(r.bedrag_max)}` : '—'),
      },
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
        key: 'gescand_door_agent',
        label: 'Gescand door agent',
        render: (r) => <span style={badgeStyle('grijs')}>{r.discovered_by === 'agent' ? 'Ja' : 'Nee'}</span>,
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
      <h2 style={sectionTitleStyle}>Subsidieregelingen &amp; Deadlines</h2>
      <p style={sectionIntroStyle}>
        Inhoudelijk beheer van subsidieregelingen: type gever, disciplines, doelgroepen, werkgebied, bandbreedte
        bijdrage, aanvraagcriteria en toegangsniveau. Technische classificatie staat onder Geavanceerde filters.
      </p>

      <div
        style={css('margin: 22px 0; padding: 18px 20px; border: 1px dashed #BFD4C6; border-radius: 16px; background: #F7FAF8;')}
      >
        <div style={css('margin-bottom: 10px; font-size: 14px; font-weight: 800; color: #2C4A5E;')}>
          Regelingen importeren via CSV
        </div>
        <div style={css('margin-bottom: 14px; font-size: 13.5px; line-height: 1.6; color: #536460;')}>
          Kolommen: naam, verstrekker, discipline, werkgebied, status, deadline, bedrag_min, bedrag_max, voorwaarden.
          De verstrekker moet al als funder in de database bestaan; onbekende verstrekkers worden overgeslagen en
          gemeld.
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

      <AdminToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Zoek op naam…">
        <input
          type="search"
          value={funderSearch}
          onChange={(e) => setFunderSearch(e.target.value)}
          placeholder="Zoek op verstrekker…"
          style={css('min-height: 44px; padding: 11px 14px; border: 1px solid #D5E0D9; border-radius: 12px; font-family: inherit; font-size: 14px; min-width: 200px;')}
        />
      </AdminToolbar>

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
            key: 'discovered_by',
            label: 'Gescand door agent',
            value: discoveredBy,
            onChange: setDiscoveredBy,
            options: [
              { value: null, label: 'Alle' },
              { value: 'agent', label: 'Ja' },
              { value: 'handmatig', label: 'Nee' },
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
          ]}
        />
      ) : null}

      <AdminBulkActionsBar count={selectedIds.length} onClear={() => setSelectedIds([])}>
        <AdminAccessTierBulkActie onApply={bulkToegangsniveauToepassen} bezig={bulkAccessTierBezig} />
        <button type="button" style={smallButtonStyle} onClick={() => setBulkModalOpen(true)}>
          Bulk bewerken…
        </button>
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
          notify={notify}
        />
      ) : null}

      {bulkModalOpen ? (
        <BulkBewerkModal
          titel="Subsidieregelingen bulk bewerken"
          aantal={selectedIds.length}
          rijen={rows.filter((r) => selectedIds.includes(r.id))}
          velden={bulkVelden}
          onCancel={() => {
            setBulkModalOpen(false);
            setBulkFout('');
          }}
          onBevestig={bulkBewerkingToepassen}
          bezig={bulkBezig}
          fout={bulkFout}
        />
      ) : null}
    </section>
  );
}

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

function RegelingBewerkPaneel({ row, form, setForm, onCancel, onSave, opslaan, dirty, classificatieOpties, bandbreedteOpties, koppelingenLaden, notify }) {
  if (!row) {
    return null;
  }

  const set = (veld) => (event) => setForm((f) => ({ ...f, [veld]: event.target.value }));
  const geverTypeLabel = (FUNDER_TYPES.find((t) => t.value === row.funder_type) || {}).label || row.funder_type || 'niet ingevuld';

  return (
    <AdminEditModal title={`${row.naam} bewerken`} onClose={onCancel} onSave={onSave} saving={opslaan} dirty={dirty}>
      <SectieKop>Basisgegevens</SectieKop>
      <VeldGrid>
        <Veld label="Naam" span={2}>
          <input style={inputStyle} value={form.naam} onChange={set('naam')} />
        </Veld>
        <Veld label="Gekoppelde gever (alleen-lezen)">
          <input style={inputStyle} value={row.funder_naam || '—'} disabled />
        </Veld>
        <Veld label="Website / URL regeling" span={2}>
          <input style={inputStyle} value={form.aanvraaglink} onChange={set('aanvraaglink')} placeholder="https://…" />
        </Veld>
      </VeldGrid>

      <SectieKop>Contactpersoon</SectieKop>
      <p style={css('margin: -8px 0 14px; font-size: 12.5px; color: #82918B;')}>
        Indien deze regeling een eigen contactpersoon heeft, afwijkend van de gekoppelde gever hierboven. Leeg
        laten als de contactgegevens van de gever van toepassing zijn.
      </p>
      <VeldGrid>
        <Veld label="Naam">
          <input style={inputStyle} value={form.contactpersoon} onChange={set('contactpersoon')} />
        </Veld>
        <Veld label="Functie">
          <input style={inputStyle} value={form.contactpersoonFunctie} onChange={set('contactpersoonFunctie')} />
        </Veld>
        <Veld label="E-mailadres">
          <input style={inputStyle} type="email" value={form.email} onChange={set('email')} />
        </Veld>
        <Veld label="Telefoonnummer">
          <input style={inputStyle} value={form.telefoon} onChange={set('telefoon')} />
        </Veld>
      </VeldGrid>

      <SectieKop muted>Algemene contactinformatie</SectieKop>
      <VeldGrid>
        <Veld label="Algemeen e-mailadres">
          <input style={inputStyle} type="email" value={form.algemeenEmail} onChange={set('algemeenEmail')} />
        </Veld>
        <Veld label="Algemeen telefoonnummer">
          <input style={inputStyle} value={form.algemeenTelefoon} onChange={set('algemeenTelefoon')} />
        </Veld>
        <Veld label="Website">
          <input style={inputStyle} value={form.website} onChange={set('website')} placeholder="https://…" />
        </Veld>
      </VeldGrid>

      <SectieKop>Adres</SectieKop>
      <VeldGrid>
        <Veld label="Straat" span={2}>
          <input style={inputStyle} value={form.straat} onChange={set('straat')} />
        </Veld>
        <Veld label="Huisnummer">
          <input style={inputStyle} value={form.huisnummer} onChange={set('huisnummer')} />
        </Veld>
        <Veld label="Postcode">
          <input style={inputStyle} value={form.postcode} onChange={set('postcode')} />
        </Veld>
        <Veld label="Plaats">
          <input style={inputStyle} value={form.plaats} onChange={set('plaats')} />
        </Veld>
        <Veld label="Provincie">
          <input style={inputStyle} value={form.provincie} onChange={set('provincie')} />
        </Veld>
        <Veld label="Land">
          <input style={inputStyle} value={form.land} onChange={set('land')} />
        </Veld>
      </VeldGrid>

      <SectieKop>Vergaderdatum</SectieKop>
      <p style={css('margin: -8px 0 14px; font-size: 12.5px; color: #82918B;')}>
        Voor een bestuur/commissie dat specifiek voor deze regeling vergadert, afwijkend van de gever hierboven. Voor
        regelingen met formele aanvraagrondes is "Aanvraagrondes" verderop de bron voor beoordelingsdata — dit veld
        is voor de eerstvolgende vergadering in algemene zin.
      </p>
      <VeldGrid>
        <Veld label="Eerstvolgende vergaderdatum">
          <input style={inputStyle} type="date" value={form.volgendeVergaderdatum} onChange={set('volgendeVergaderdatum')} />
        </Veld>
        <Veld label="Vergaderfrequentie">
          <input style={inputStyle} value={form.vergaderfrequentie} onChange={set('vergaderfrequentie')} placeholder="bijv. 3x per jaar" />
        </Veld>
        <Veld label="Toelichting" span={3}>
          <textarea style={textareaStyle} rows={2} value={form.vergaderingToelichting} onChange={set('vergaderingToelichting')} />
        </Veld>
      </VeldGrid>

      <SectieKop>Classificatie</SectieKop>
      <p style={css('margin: -8px 0 14px; font-size: 12.5px; color: #82918B;')}>
        Dit zijn de centrale categorieën waarop platformbreed gefilterd en gematcht wordt (Admin, publieke
        zoekpagina, AI). Alleen bestaande waarden zijn te kiezen; ontbreekt er een, voeg die eerst toe via
        Beheer → Classificaties.
      </p>
      <VeldGrid>
        <Veld label={`Type gever (leeg = overgenomen van gever: ${geverTypeLabel})`}>
          <select style={inputStyle} value={form.type} onChange={set('type')}>
            <option value="">Overgenomen van gever ({geverTypeLabel})</option>
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
      <p style={css('margin: -8px 0 14px; font-size: 12.5px; color: #82918B;')}>
        Kan afwijken van de bandbreedte/toelichting van de gekoppelde gever hierboven — de waarde van deze regeling
        is dan leidend voor deze regeling.
      </p>
      <ContributionEditor
        bandbreedteId={form.bandbreedteBijdrageId}
        onBandbreedteChange={(waarde) => setForm((f) => ({ ...f, bandbreedteBijdrageId: waarde }))}
        toelichting={form.bijdrageToelichting}
        onToelichtingChange={(waarde) => setForm((f) => ({ ...f, bijdrageToelichting: waarde }))}
        bandbreedteOpties={bandbreedteOpties}
      />
      <div style={css('height: 16px;')} />
      <VeldGrid>
        <Veld label="Eigen bijdrage (indien relevant)">
          <input style={inputStyle} value={form.eigenBijdrage} onChange={set('eigenBijdrage')} placeholder="bijv. minimaal 20%" />
        </Veld>
        <Veld label="Cofinanciering (indien relevant)">
          <input style={inputStyle} value={form.cofinanciering} onChange={set('cofinanciering')} />
        </Veld>
      </VeldGrid>

      <SectieKop>Aanvraag</SectieKop>
      <VeldGrid>
        <Veld label="Aanvraagcriteria (wie mag aanvragen, doelgroep, looptijd, uitsluitingen, geografische eisen, overige voorwaarden)" span={3}>
          <textarea style={textareaStyle} rows={4} value={form.voorwaarden} onChange={set('voorwaarden')} />
        </Veld>
        <Veld label="Beoordelingscriteria" span={2}>
          <textarea style={textareaStyle} rows={3} value={form.beoordelingscriteria} onChange={set('beoordelingscriteria')} />
        </Veld>
        <Veld label="Type projecten">
          <input style={inputStyle} value={form.typeProjecten} onChange={set('typeProjecten')} />
        </Veld>
        <Veld label="Begrotingseisen" span={2}>
          <input style={inputStyle} value={form.begrotingseisen} onChange={set('begrotingseisen')} />
        </Veld>
        <Veld label="Behandeltermijn">
          <input style={inputStyle} value={form.behandeltermijn} onChange={set('behandeltermijn')} placeholder="bijv. 8 weken" />
        </Veld>
        <Veld label="Aanvraagprocedure" span={3}>
          <input style={inputStyle} value={form.aanvraagprocedure} onChange={set('aanvraagprocedure')} />
        </Veld>
      </VeldGrid>

      <SectieKop>Deadlines / openstelling</SectieKop>
      <VeldGrid>
        <Veld label="Status">
          <select style={inputStyle} value={form.status} onChange={set('status')}>
            {REGELING_STATUSSEN.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Veld>
        <Veld label="Deadline (jjjj-mm-dd, leeg = doorlopend)">
          <input style={inputStyle} value={form.deadlineDatum} onChange={set('deadlineDatum')} placeholder="2027-01-15" />
        </Veld>
        <Veld label="Deadline (vrije tekst)">
          <input style={inputStyle} value={form.deadline} onChange={set('deadline')} />
        </Veld>
        <Veld label="Deadline omschrijving">
          <input style={inputStyle} value={form.deadlineOmschrijving} onChange={set('deadlineOmschrijving')} />
        </Veld>
      </VeldGrid>

      <SectieKop>Aanvraagrondes</SectieKop>
      <p style={css('margin: -8px 0 14px; font-size: 12.5px; color: #82918B;')}>
        Voor regelingen met meerdere aanvraagmomenten per jaar (bijv. een bestuur dat 3× per jaar vergadert). Zodra
        hieronder minimaal één ronde bestaat, is de eerstvolgende nog geldige ronde overal (Timeline, filters,
        matching, Subsidie Kompas) de enige bron voor de deadline van deze regeling — de velden hierboven worden dan
        genegeerd. Zonder rondes blijven de velden hierboven gewoon de actieve deadline.
      </p>
      <AanvraagrondesSectie regelingId={row.id} notify={notify} />

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
      <p style={css('margin: -8px 0 14px; font-size: 12.5px; color: #82918B;')}>
        Data tier en bron komen uit de oorspronkelijke classificatie van deze regeling en worden hier niet
        gewijzigd. "Beoordeeld" bepaalt of het toegangsniveau hierboven leidend is voor wat leden te zien
        krijgen — vink dit pas aan nadat u de gegevens van deze regeling heeft nagelopen.
      </p>
      <VeldGrid>
        <Veld label="Data tier">
          <input style={inputStyle} value={row.data_tier || '—'} disabled />
        </Veld>
        <Veld label="Gescand door agent">
          <input style={inputStyle} value={row.discovered_by === 'agent' ? 'Ja' : 'Nee'} disabled />
        </Veld>
      </VeldGrid>
      <label style={css('display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 14px; font-weight: 700; color: #2C4A5E;')}>
        <input
          type="checkbox"
          checked={form.classificationReviewed}
          onChange={(e) => setForm((f) => ({ ...f, classificationReviewed: e.target.checked }))}
        />
        Beoordeeld — toegangsniveau is leidend voor deze regeling
      </label>
    </AdminEditModal>
  );
}

// Beheer van aanvraagrondes (meerdere sluitingsdata per regeling). Eigen,
// kleine deelstaat binnen het bewerkpaneel: laadt/herlaadt onafhankelijk van
// het hoofdformulier van de regeling, zodat toevoegen/bewerken/verwijderen/
// (de)activeren van een ronde niet door de "Opslaan"-knop van de regeling
// hoeft te lopen. Lezen/schrijven uitsluitend via de admin-only RPC's
// (admin_list_rondes / admin_upsert_ronde / admin_verwijder_ronde).
function AanvraagrondesSectie({ regelingId, notify }) {
  const [rondes, setRondes] = useState([]);
  const [laden, setLaden] = useState(true);
  // undefined = geen formulier open, null = nieuwe ronde, anders id = bestaande ronde bewerken
  const [bewerkId, setBewerkId] = useState(undefined);
  const [rondeForm, setRondeForm] = useState(LEEG_RONDE);
  const [opslaanRonde, setOpslaanRonde] = useState(false);

  const laadRondes = async () => {
    setLaden(true);
    const res = await fetchRondes(regelingId);
    setRondes(res.rows || []);
    setLaden(false);
  };

  useEffect(() => {
    laadRondes();
    setBewerkId(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regelingId]);

  const openNieuw = () => {
    setRondeForm(LEEG_RONDE);
    setBewerkId(null);
  };

  const openBewerken = (ronde) => {
    setRondeForm({
      sluitingsdatum: ronde.sluitingsdatum || '',
      sluitingstijd: ronde.sluitingstijd || '',
      openVanaf: ronde.open_vanaf || '',
      beoordelingsdatum: ronde.beoordelingsdatum || '',
      beoordelingsperiode: ronde.beoordelingsperiode || '',
      toelichting: ronde.toelichting || '',
      bronUrl: ronde.bron_url || '',
      actief: ronde.actief,
    });
    setBewerkId(ronde.id);
  };

  const opslaanRondeForm = async () => {
    if (!rondeForm.sluitingsdatum) {
      notify('error', 'Sluitingsdatum is verplicht voor een aanvraagronde.');

      return;
    }

    setOpslaanRonde(true);

    const res = await upsertRonde({
      id: bewerkId || null,
      regelingId,
      sluitingsdatum: rondeForm.sluitingsdatum,
      sluitingstijd: rondeForm.sluitingstijd || null,
      openVanaf: rondeForm.openVanaf || null,
      beoordelingsdatum: rondeForm.beoordelingsdatum || null,
      beoordelingsperiode: rondeForm.beoordelingsperiode || null,
      toelichting: rondeForm.toelichting || null,
      bronUrl: rondeForm.bronUrl || null,
      actief: rondeForm.actief,
    });

    setOpslaanRonde(false);

    if (res.error) {
      notify('error', 'De aanvraagronde kon niet worden opgeslagen.');

      return;
    }

    setBewerkId(undefined);
    notify('success', 'Aanvraagronde opgeslagen.');
    laadRondes();
  };

  const toggleActief = async (ronde) => {
    const res = await upsertRonde({
      id: ronde.id,
      regelingId,
      sluitingsdatum: ronde.sluitingsdatum,
      sluitingstijd: ronde.sluitingstijd,
      openVanaf: ronde.open_vanaf,
      beoordelingsdatum: ronde.beoordelingsdatum,
      beoordelingsperiode: ronde.beoordelingsperiode,
      toelichting: ronde.toelichting,
      bronUrl: ronde.bron_url,
      actief: !ronde.actief,
    });

    if (res.error) {
      notify('error', 'De status van de ronde kon niet worden gewijzigd.');

      return;
    }

    laadRondes();
  };

  const verwijder = async (ronde) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Aanvraagronde van ${formatDatumKort(ronde.sluitingsdatum)} verwijderen? Dit kan niet ongedaan worden gemaakt.`)) {
      return;
    }

    const res = await verwijderRonde(ronde.id);

    if (res.error) {
      notify('error', 'De aanvraagronde kon niet worden verwijderd.');

      return;
    }

    notify('success', 'Aanvraagronde verwijderd.');
    laadRondes();
  };

  return (
    <div style={css('margin-bottom: 6px;')}>
      {laden ? (
        <div style={css('font-size: 13.5px; color: #82918B;')}>Rondes laden…</div>
      ) : rondes.length ? (
        <div style={css('display: grid; gap: 8px; margin-bottom: 12px;')}>
          {rondes.map((ronde) => (
            <RondeRij
              key={ronde.id}
              ronde={ronde}
              onBewerken={() => openBewerken(ronde)}
              onVerwijderen={() => verwijder(ronde)}
              onToggleActief={() => toggleActief(ronde)}
            />
          ))}
        </div>
      ) : (
        <div style={css('margin-bottom: 12px; font-size: 13.5px; color: #82918B;')}>
          Nog geen aanvraagrondes voor deze regeling — de deadline hierboven blijft actief.
        </div>
      )}

      {bewerkId !== undefined ? (
        <RondeFormulier
          form={rondeForm}
          setForm={setRondeForm}
          onSave={opslaanRondeForm}
          onCancel={() => setBewerkId(undefined)}
          opslaan={opslaanRonde}
          nieuw={bewerkId === null}
        />
      ) : (
        <button type="button" style={smallButtonStyle} onClick={openNieuw}>
          + Aanvraagronde toevoegen
        </button>
      )}
    </div>
  );
}

function RondeRij({ ronde, onBewerken, onVerwijderen, onToggleActief }) {
  const beoordeling = ronde.beoordelingsdatum ? formatDatumKort(ronde.beoordelingsdatum) : ronde.beoordelingsperiode || null;

  return (
    <div
      style={css(`
        display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
        padding: 10px 14px; border: 1px solid #E1EAE4; border-radius: 12px;
        background: ${ronde.actief ? '#FFFFFF' : '#F2F2EF'};
        ${!ronde.actief || ronde.is_verstreken ? 'opacity: 0.7;' : ''}
      `)}
    >
      <div>
        <div style={css('font-weight: 800; color: #2C4A5E; font-size: 14px;')}>
          {formatDatumKort(ronde.sluitingsdatum)}
          {ronde.sluitingstijd ? ` · ${String(ronde.sluitingstijd).slice(0, 5)}` : ''}
          {!ronde.actief ? <span style={badgeStyle('grijs')}> Gedeactiveerd</span> : null}
          {ronde.actief && ronde.is_verstreken ? <span style={badgeStyle('grijs')}> Verstreken</span> : null}
        </div>
        {beoordeling ? <div style={css('font-size: 12.5px; color: #536460;')}>Beoordeling: {beoordeling}</div> : null}
      </div>
      <div style={css('display: flex; gap: 8px; flex-shrink: 0;')}>
        <button type="button" style={smallButtonStyle} onClick={onBewerken}>
          Bewerken
        </button>
        <button type="button" style={plainButtonStyle} onClick={onToggleActief}>
          {ronde.actief ? 'Deactiveren' : 'Activeren'}
        </button>
        <button type="button" style={plainButtonStyle} onClick={onVerwijderen}>
          Verwijderen
        </button>
      </div>
    </div>
  );
}

function RondeFormulier({ form, setForm, onSave, onCancel, opslaan, nieuw }) {
  const set = (veld) => (event) => setForm((f) => ({ ...f, [veld]: event.target.value }));

  return (
    <div style={css('margin-top: 4px; padding: 14px 16px; border: 1px dashed #BFD4C6; border-radius: 12px; background: #FFFFFF;')}>
      <div style={css('margin-bottom: 12px; font-size: 13.5px; font-weight: 800; color: #2C4A5E;')}>
        {nieuw ? 'Nieuwe aanvraagronde' : 'Aanvraagronde bewerken'}
      </div>
      <VeldGrid>
        <Veld label="Sluitingsdatum">
          <input style={inputStyle} type="date" value={form.sluitingsdatum} onChange={set('sluitingsdatum')} />
        </Veld>
        <Veld label="Sluitingstijd (leeg = 23:59)">
          <input style={inputStyle} type="time" value={form.sluitingstijd} onChange={set('sluitingstijd')} />
        </Veld>
        <Veld label="Open vanaf (optioneel)">
          <input style={inputStyle} type="date" value={form.openVanaf} onChange={set('openVanaf')} />
        </Veld>
        <Veld label="Beoordelingsdatum (indien exact bekend)">
          <input style={inputStyle} type="date" value={form.beoordelingsdatum} onChange={set('beoordelingsdatum')} />
        </Veld>
        <Veld label="Beoordelingsperiode (indien alleen maand/periode bekend)">
          <input style={inputStyle} value={form.beoordelingsperiode} onChange={set('beoordelingsperiode')} placeholder="bijv. maart 2027" />
        </Veld>
        <Veld label="Toelichting (optioneel)" span={2}>
          <input style={inputStyle} value={form.toelichting} onChange={set('toelichting')} />
        </Veld>
      </VeldGrid>

      <SectieKop muted>Technische status / Bron</SectieKop>
      <VeldGrid>
        <Veld label="Bron / URL (optioneel)" span={2}>
          <input style={inputStyle} value={form.bronUrl} onChange={set('bronUrl')} placeholder="https://…" />
        </Veld>
        <Veld label="Actief">
          <select style={inputStyle} value={form.actief ? '1' : '0'} onChange={(e) => setForm((f) => ({ ...f, actief: e.target.value === '1' }))}>
            <option value="1">Ja</option>
            <option value="0">Nee (tijdelijk gedeactiveerd)</option>
          </select>
        </Veld>
      </VeldGrid>

      <div style={css('margin-top: 16px; display: flex; gap: 12px; flex-wrap: wrap;')}>
        <button type="button" disabled={opslaan} onClick={onSave} style={secondaryButtonStyle}>
          {opslaan ? 'Opslaan…' : 'Opslaan ronde'}
        </button>
        <button type="button" disabled={opslaan} onClick={onCancel} style={plainButtonStyle}>
          Annuleren
        </button>
      </div>
    </div>
  );
}
