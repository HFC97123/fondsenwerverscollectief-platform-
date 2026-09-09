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
  bulkSetReviewed,
  bulkUpdateFunder,
  classifyFunder,
  createFunder,
  deleteFunder,
  fetchFunders,
  setAccessTier,
  updateFunder,
} from '../../data/services/adminFunders.js';
// Hergebruikt om, vóór het verwijderen van een fonds, te tonen hoeveel
// gekoppelde subsidieregelingen er ook verdwijnen (§3, "controleer vóór
// verwijderen op relaties") - geen nieuwe telling/RPC nodig, deze bestaat al.
// Datamomenten* / DATAMOMENT_* horen bij de generieke deadline-architectuur
// ("Volgende fase, deel 2"): meerdere aanvraag-/vergaderdata per Funder,
// elk optioneel gekoppeld aan 0..n subsidieregelingen van diezelfde Funder.
import {
  DATAMOMENT_STATUSSEN,
  DATAMOMENT_TYPES,
  fetchFunderDatamomenten,
  fetchSubsidieregelingen,
  upsertFunderDatamoment,
  verwijderFunderDatamoment,
} from '../../data/services/adminSubsidieregelingen.js';
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
  classificationReviewed: false,
  // Vervolgopdracht - contactpersoon (functie erbij, de rest bestond al maar
  // was alleen-lezen) en "algemene" contactgegevens (los van de persoonlijke
  // contactpersoon hierboven).
  contactpersoon: '',
  contactpersoonFunctie: '',
  email: '',
  telefoon: '',
  algemeenEmail: '',
  algemeenTelefoon: '',
  // Vervolgopdracht - gestructureerd adres (naast, niet in plaats van, het
  // oude vrije-tekstveld `adres`, dat alleen-lezen ter referentie blijft).
  straat: '',
  huisnummer: '',
  postcode: '',
  plaats: '',
  provincie: '',
  land: '',
  // Vervolgopdracht - vergaderdatum.
  volgendeVergaderdatum: '',
  vergaderfrequentie: '',
  vergaderingToelichting: '',
};

const LEEG_NIEUW_FONDS = { naam: '', type: '' };

// Vervolgopdracht, prioriteit 2/3 (CRUD): twee kleine, lokale knopstijlen -
// primair voor "Nieuw fonds" (dezelfde donkere kleur als andere primaire
// acties elders in de app), en een duidelijk afwijkende (rode) variant voor
// "Verwijderen", zodat dit nooit met "Bewerken" te verwarren is.
const nieuwFondsKnopStijl = css(`
  cursor: pointer;
  box-sizing: border-box;
  min-height: 42px;
  padding: 10px 20px;
  border: none;
  border-radius: 999px;
  background: #2C4A5E;
  color: #FFFFFF;
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 800;
  white-space: nowrap;
`);

const verwijderKnopStijl = css(`
  cursor: pointer;
  box-sizing: border-box;
  min-height: 32px;
  padding: 6px 12px;
  border: 1px solid #E1D3D0;
  border-radius: 8px;
  background: #FFFFFF;
  color: #9E3B2C;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 700;
`);

function euro(bedrag) {
  if (bedrag == null || bedrag === '') {
    return '—';
  }

  return Number(bedrag).toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

// Compacte weergave van een datum, bijv. "03 aug 2026" — zelfde formattering
// als formatDatumKort() in AdminDeadlines.jsx (aanvraagrondes-lijst).
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

// Leeg formulier voor een funder-breed datamoment (aanvraagdeadline/
// vergaderdatum/vooraanvraag/overig — "Volgende fase, deel 2": generieke
// datamoment-architectuur). regelingIds: welke subsidieregelingen van deze
// Funder dit datamoment delen; leeg = (nog) aan geen enkele regeling gekoppeld.
const LEEG_DATAMOMENT = {
  type: 'aanvraagdeadline',
  naam: '',
  sluitingsdatum: '',
  sluitingstijd: '',
  status: 'gepland',
  toelichting: '',
  bronUrl: '',
  actief: true,
  regelingIds: [],
};

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
  const [editingRow, setEditingRow] = useState(null);
  const [form, setForm] = useState(LEEG_BEWERKING);
  const [opslaan, setOpslaan] = useState(false);
  const [classificatieOpties, setClassificatieOpties] = useState({ themas: [], doelgroepen: [], regios: [] });
  const [bandbreedteOpties, setBandbreedteOpties] = useState([]);
  const [koppelingenLaden, setKoppelingenLaden] = useState(false);
  const [bulkAccessTierBezig, setBulkAccessTierBezig] = useState(false);
  // Vervolgopdracht - volwaardige bulk-editor (meerdere velden in één
  // actie). Vervangt AdminAccessTierBulkActie hierboven niet (die blijft
  // bestaan voor een snelle toegangsniveau-wijziging zonder de modal te
  // openen) - "Toegangsniveau" is hieronder ook gewoon een van de velden in
  // de nieuwe, bredere bulk-editor, beide roepen dezelfde bulkSetAccessTier
  // aan, dus geen dubbele implementatie.
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkBezig, setBulkBezig] = useState(false);
  const [bulkFout, setBulkFout] = useState('');
  // Momentopname van het formulier direct na het volledig laden (incl.
  // classificaties) van de bewerkte rij — vergelijkingsbasis voor de
  // "niet-opgeslagen wijzigingen"-waarschuwing in AdminEditModal.
  const initialFormRef = useRef(null);

  // Vervolgopdracht, prioriteit 2 (CRUD): "Nieuw fonds" is een klein, apart
  // stapje (alleen de twee verplichte velden) dat na opslaan meteen
  // doorschakelt naar hetzelfde bewerkscherm als hierboven - geen tweede,
  // volledige formulierimplementatie.
  const [nieuwFondsOpen, setNieuwFondsOpen] = useState(false);
  const [nieuwFondsForm, setNieuwFondsForm] = useState(LEEG_NIEUW_FONDS);
  const [nieuwFondsBezig, setNieuwFondsBezig] = useState(false);
  const [nieuwFondsFout, setNieuwFondsFout] = useState('');

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

  // Veldenlijst voor de generieke BulkBewerkModal (vervolgopdracht §4).
  // "Actief/inactief" en "aanvraagstatus/open-gesloten" bestaan niet als
  // aparte, gestandaardiseerde velden op funders (alleen het vrije-tekstveld
  // `status`, dat bewust als "technische status" apart staat) - vandaar dat
  // die twee hier niet als bulkveld voorkomen (zie oplevering, punt 11).
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
        // Anders dan bij Subsidieregelingen (waar Type gever leeg mag zijn -
        // "overgenomen van gever") heeft funders.type een harde NOT NULL-
        // constraint in de database (bevestigd tijdens de smoke test: een
        // lege waarde hier laat admin_bulk_update_funder crashen op een
        // 23502 not-null violation) - dus bewust geen "Niet ingevuld"-optie
        // in dit bulkveld.
        key: 'type',
        label: 'Type gever',
        kind: 'single',
        control: 'select',
        opties: FUNDER_TYPES,
        accessor: (r) => r.type || '',
        labelVoorWaarde: (v) => (FUNDER_TYPES.find((t) => t.value === v) || {}).label || v,
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

  // Orchestreert de daadwerkelijke opslag van de bulk-editor: roept per
  // groep aangevinkte velden precies één bestaande service-functie aan (geen
  // request per record — §16) en meldt per groep welke mislukt is, zonder de
  // geslaagde wijzigingen terug te draaien (die staan al in de database).
  const bulkBewerkingToepassen = async (payload) => {
    setBulkBezig(true);
    setBulkFout('');

    const ids = [...selectedIds];
    const mislukt = [];

    if ('reviewed' in payload) {
      const res = await bulkSetReviewed('funders', ids, payload.reviewed === 'true');

      if (res.error) {
        mislukt.push('Beoordeeld');
      }
    }

    if ('accessTier' in payload) {
      const res = await bulkSetAccessTier('funders', ids, payload.accessTier);

      if (res.error) {
        mislukt.push('Toegangsniveau');
      }
    }

    const veldenPatch = {};

    ['type', 'dataTier', 'vergaderfrequentie'].forEach((k) => {
      if (k in payload) {
        veldenPatch[k] = payload[k];
      }
    });

    if (Object.keys(veldenPatch).length > 0) {
      const res = await bulkUpdateFunder(ids, veldenPatch);

      if (res.error) {
        mislukt.push('Type gever / Data tier / Vergaderfrequentie');
      }
    }

    if ('bandbreedteBijdrageId' in payload) {
      const res = await bulkZetBandbreedte('funders', ids, payload.bandbreedteBijdrageId || null);

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
      const res = await bulkZetKoppelingen('funders', ids, koppelingenPatch);

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
    notify('success', `${ids.length} funder(s) bijgewerkt.`);
    laad();
  };

  const openEdit = async (row) => {
    setEditingId(row.id);
    // Losse snapshot van de bewerkte rij zelf, i.p.v. steeds opnieuw
    // rows.find((r) => r.id === editingId) - nodig omdat een net aangemaakt
    // fonds (nieuwFondsOpslaan hieronder) nog niet per se in de huidige
    // gepagineerde/gefilterde `rows` staat.
    setEditingRow(row);

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
      classificationReviewed: !!row.classification_reviewed,
      contactpersoon: row.contactpersoon || '',
      contactpersoonFunctie: row.contactpersoon_functie || '',
      email: row.email || '',
      telefoon: row.telefoon || '',
      algemeenEmail: row.algemeen_email || '',
      algemeenTelefoon: row.algemeen_telefoon || '',
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
      contactpersoon: form.contactpersoon || null,
      contactpersoonFunctie: form.contactpersoonFunctie || null,
      email: form.email || null,
      telefoon: form.telefoon || null,
      algemeenEmail: form.algemeenEmail || null,
      algemeenTelefoon: form.algemeenTelefoon || null,
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
      setEditingRow(null);
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

    // "Beoordeeld" is een bevestiging, geen herclassificatie: data_tier/
    // source_type gaan ongewijzigd (de bestaande waarden van deze funder) mee,
    // alleen de reviewed-vlag zelf wijzigt.
    if (form.classificationReviewed !== !!row.classification_reviewed) {
      const reviewRes = await classifyFunder(row.id, {
        dataTier: row.data_tier,
        sourceType: row.source_type,
        reviewed: form.classificationReviewed,
      });

      if (reviewRes.error) {
        notify('error', 'Funder bijgewerkt, maar "beoordeeld" kon niet worden opgeslagen.');
        setEditingId(null);
        laad();

        return;
      }
    }

    setEditingId(null);
    setEditingRow(null);
    initialFormRef.current = null;
    notify('success', 'Funder bijgewerkt.');
    laad();
  };

  // Vervolgopdracht, prioriteit 2 (CRUD - Create). Alleen naam + type worden
  // hier gevraagd (de twee verplichte velden); na aanmaken schakelt dit
  // meteen door naar hetzelfde bewerkscherm als openEdit hierboven gebruikt,
  // zodat missie/bijdrage/classificaties/contact/adres/vergaderdatum/
  // toegangsniveau in één en hetzelfde formulier worden ingevuld - geen
  // tweede, dubbele veldenset.
  const nieuwFondsOpslaan = async () => {
    if (!nieuwFondsForm.naam.trim() || !nieuwFondsForm.type) {
      setNieuwFondsFout('Naam en type gever zijn beide verplicht.');

      return;
    }

    setNieuwFondsFout('');
    setNieuwFondsBezig(true);

    const res = await createFunder({ naam: nieuwFondsForm.naam.trim(), type: nieuwFondsForm.type });

    setNieuwFondsBezig(false);

    if (res.error || !res.id) {
      setNieuwFondsFout('Het fonds kon niet worden aangemaakt.');

      return;
    }

    setNieuwFondsOpen(false);
    setNieuwFondsForm(LEEG_NIEUW_FONDS);
    notify('success', `"${nieuwFondsForm.naam.trim()}" is aangemaakt.`);
    laad();

    // Direct de zojuist aangemaakte rij ophalen (via dezelfde admin_list_funders
    // die ook de tabel vult, nu gefilterd op p_funder_id) en meteen bewerken -
    // in de gewone tabel/paginering staat hij mogelijk nog niet (andere
    // filters/sortering/pagina), maar dat is voor deze ene rij niet nodig.
    const vers = await fetchFunders({ funderId: res.id, pageSize: 1 });

    if (vers.rows[0]) {
      openEdit(vers.rows[0]);
    }
  };

  // Vervolgopdracht, prioriteit 3 (CRUD - Delete). Geen handmatige
  // relatie-opruiming nodig (on delete cascade regelt subsidieregelingen/
  // classificaties/notities al op databaseniveau), maar de beheerder krijgt
  // wél te zien hoeveel gekoppelde subsidieregelingen ook verdwijnen, zodat
  // dit nooit een verrassing is.
  const verwijderFunder = async (row) => {
    const gekoppeld = await fetchSubsidieregelingen({ funderId: row.id, pageSize: 1 });
    const aantal = gekoppeld.total || 0;
    const extra = aantal > 0 ? ` Dit fonds heeft ${aantal} gekoppelde subsidieregeling(en), die ook worden verwijderd.` : '';

    if (!window.confirm(`Weet u zeker dat u "${row.naam}" wilt verwijderen?${extra}`)) {
      return;
    }

    const res = await deleteFunder(row.id);

    if (res.error) {
      notify('error', 'Het fonds kon niet worden verwijderd.');

      return;
    }

    if (editingId === row.id) {
      setEditingId(null);
      setEditingRow(null);
      initialFormRef.current = null;
    }

    setSelectedIds((cur) => cur.filter((id) => id !== row.id));
    notify('success', `"${row.naam}" is verwijderd.`);
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
      <div style={css('display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap;')}>
        <div>
          <h2 style={sectionTitleStyle}>Funders</h2>
          <p style={sectionIntroStyle}>
            Inhoudelijk beheer van fondsen: type gever, disciplines, doelgroepen, werkgebied, bandbreedte bijdrage en
            toegangsniveau. Technische classificatie (data tier, bron, beoordeeld) staat onder Geavanceerde filters.
          </p>
        </div>
        <button type="button" onClick={() => setNieuwFondsOpen(true)} style={nieuwFondsKnopStijl}>
          + Nieuw fonds
        </button>
      </div>

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
        emptyText="Geen funders gevonden voor deze filters."
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={onSort}
        selectable
        selectedIds={selectedIds}
        onToggleRow={toggleRow}
        onToggleAll={toggleAll}
        actions={(row) => (
          <span style={css('display: flex; gap: 8px;')}>
            <button type="button" style={smallButtonStyle} onClick={() => openEdit(row)}>
              Bewerken
            </button>
            <button type="button" style={verwijderKnopStijl} onClick={() => verwijderFunder(row)}>
              Verwijderen
            </button>
          </span>
        )}
      />

      {!loading && total > 0 ? <AdminPagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} /> : null}

      {editingId ? (
        <FunderBewerkPaneel
          row={editingRow}
          form={form}
          setForm={setForm}
          onCancel={() => {
            setEditingId(null);
            setEditingRow(null);
            initialFormRef.current = null;
          }}
          onSave={() => opslaanBewerking(editingRow)}
          opslaan={opslaan}
          dirty={initialFormRef.current ? JSON.stringify(form) !== JSON.stringify(initialFormRef.current) : false}
          classificatieOpties={classificatieOpties}
          bandbreedteOpties={bandbreedteOpties}
          koppelingenLaden={koppelingenLaden}
          notify={notify}
        />
      ) : null}

      {nieuwFondsOpen ? (
        <NieuwFondsModal
          form={nieuwFondsForm}
          setForm={setNieuwFondsForm}
          onCancel={() => {
            setNieuwFondsOpen(false);
            setNieuwFondsForm(LEEG_NIEUW_FONDS);
            setNieuwFondsFout('');
          }}
          onSave={nieuwFondsOpslaan}
          opslaan={nieuwFondsBezig}
          fout={nieuwFondsFout}
        />
      ) : null}

      {bulkModalOpen ? (
        <BulkBewerkModal
          titel="Funders bulk bewerken"
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

function FunderBewerkPaneel({ row, form, setForm, onCancel, onSave, opslaan, dirty, classificatieOpties, bandbreedteOpties, koppelingenLaden, notify }) {
  if (!row) {
    return null;
  }

  const set = (veld) => (event) => setForm((f) => ({ ...f, [veld]: event.target.value }));

  return (
    <AdminEditModal title={`${row.naam} bewerken`} onClose={onCancel} onSave={onSave} saving={opslaan} dirty={dirty}>
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

      <SectieKop>Contactpersoon</SectieKop>
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
          <input style={inputStyle} type="tel" value={form.telefoon} onChange={set('telefoon')} />
        </Veld>
      </VeldGrid>

      <SectieKop muted>Algemene contactinformatie</SectieKop>
      <VeldGrid>
        <Veld label="Algemeen e-mailadres">
          <input style={inputStyle} type="email" value={form.algemeenEmail} onChange={set('algemeenEmail')} />
        </Veld>
        <Veld label="Algemeen telefoonnummer">
          <input style={inputStyle} type="tel" value={form.algemeenTelefoon} onChange={set('algemeenTelefoon')} />
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
      {row.adres ? (
        <p style={css('margin: -8px 0 14px; font-size: 12.5px; color: #82918B;')}>
          Eerder vrij ingevoerd adres (alleen-lezen, ter referentie): {row.adres}
        </p>
      ) : null}

      <SectieKop>Vergaderdatum</SectieKop>
      <p style={css('margin: -8px 0 14px; font-size: 12.5px; color: #82918B;')}>
        Los tekstveld voor een korte samenvatting (bijv. op de publieke fondspagina). Voor de daadwerkelijke planning
        met meerdere data per jaar: gebruik hieronder de datamomenten-lijst — die koppelt automatisch door naar de
        subsidieregeling(en) van dit fonds, zonder handmatige synchronisatie.
      </p>
      <VeldGrid>
        <Veld label="Eerstvolgende vergaderdatum">
          <input
            style={inputStyle}
            type="date"
            value={form.volgendeVergaderdatum || ''}
            onChange={set('volgendeVergaderdatum')}
          />
        </Veld>
        <Veld label="Vergaderfrequentie">
          <input
            style={inputStyle}
            value={form.vergaderfrequentie}
            onChange={set('vergaderfrequentie')}
            placeholder="bijv. 3x per jaar"
          />
        </Veld>
        <Veld label="Toelichting" span={3}>
          <textarea style={textareaStyle} rows={2} value={form.vergaderingToelichting} onChange={set('vergaderingToelichting')} />
        </Veld>
      </VeldGrid>

      <SectieKop muted>Datamomenten (aanvraagdeadlines / vergaderdata)</SectieKop>
      <p style={css('margin: -8px 0 14px; font-size: 12.5px; color: #82918B;')}>
        Alle bekende toekomstige data voor dit fonds blijven hier bewaard, ook verstreken data. De Deadlines-pagina
        toont per subsidieregeling automatisch alleen de eerstvolgende, nog niet verstreken datum.
      </p>
      <FunderDatamomentenSectie funderId={row.id} notify={notify} />

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
      <p style={css('margin: 4px 0 10px; font-size: 12.5px; color: #82918B;')}>
        "Beoordeeld" bepaalt of het toegangsniveau hierboven leidend is voor wat leden van deze funder te zien
        krijgen. Vink dit pas aan nadat u de gegevens van deze funder heeft nagelopen.
      </p>
      <label style={css('display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 14px; font-weight: 700; color: #2C4A5E;')}>
        <input
          type="checkbox"
          checked={form.classificationReviewed}
          onChange={(e) => setForm((f) => ({ ...f, classificationReviewed: e.target.checked }))}
        />
        Beoordeeld — toegangsniveau is leidend voor deze funder
      </label>
    </AdminEditModal>
  );
}

// Beheer van funder-brede datamomenten (meerdere aanvraagdeadlines/
// vergaderdata per jaar, ongeacht subsidieregeling) — "Volgende fase, deel 2":
// generieke deadline-architectuur. Eigen, kleine deelstaat binnen het
// bewerkpaneel van de Funder, zelfde opzet als AanvraagrondesSectie in
// AdminDeadlines.jsx. Elk datamoment kan aan 0..n subsidieregelingen van deze
// Funder gekoppeld worden; die koppeling bepaalt automatisch (via
// subsidieregeling_volgende_ronde/de deadlines-view) welke datum er als
// eerstvolgende deadline van die regeling verschijnt — geen aparte
// synchronisatiestap. Lezen/schrijven uitsluitend via de admin-only RPC's
// (admin_list_funder_datamomenten / admin_upsert_funder_datamoment /
// admin_verwijder_funder_datamoment).
function FunderDatamomentenSectie({ funderId, notify }) {
  const [datamomenten, setDatamomenten] = useState([]);
  const [regelingen, setRegelingen] = useState([]);
  const [laden, setLaden] = useState(true);
  // undefined = geen formulier open, null = nieuw datamoment, anders id = bestaand datamoment bewerken
  const [bewerkId, setBewerkId] = useState(undefined);
  const [datamomentForm, setDatamomentForm] = useState(LEEG_DATAMOMENT);
  const [opslaanDatamoment, setOpslaanDatamoment] = useState(false);

  const laadAlles = async () => {
    setLaden(true);
    const [datamomentenRes, regelingenRes] = await Promise.all([
      fetchFunderDatamomenten(funderId),
      fetchSubsidieregelingen({ funderId, pageSize: 200, sortColumn: 'naam', sortDirection: 'asc' }),
    ]);
    setDatamomenten(datamomentenRes.rows || []);
    setRegelingen(regelingenRes.rows || []);
    setLaden(false);
  };

  useEffect(() => {
    laadAlles();
    setBewerkId(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funderId]);

  const openNieuw = () => {
    setDatamomentForm(LEEG_DATAMOMENT);
    setBewerkId(null);
  };

  const openBewerken = (datamoment) => {
    setDatamomentForm({
      type: datamoment.type || 'aanvraagdeadline',
      naam: datamoment.naam || '',
      sluitingsdatum: datamoment.sluitingsdatum || '',
      sluitingstijd: datamoment.sluitingstijd || '',
      status: datamoment.status || 'gepland',
      toelichting: datamoment.toelichting || '',
      bronUrl: datamoment.bron_url || '',
      actief: datamoment.actief,
      regelingIds: datamoment.regeling_ids || [],
    });
    setBewerkId(datamoment.id);
  };

  const opslaanDatamomentForm = async () => {
    if (!datamomentForm.sluitingsdatum) {
      notify('error', 'Datum is verplicht voor een datamoment.');

      return;
    }

    setOpslaanDatamoment(true);

    const res = await upsertFunderDatamoment({
      id: bewerkId || null,
      funderId,
      type: datamomentForm.type,
      naam: datamomentForm.naam || null,
      sluitingsdatum: datamomentForm.sluitingsdatum,
      sluitingstijd: datamomentForm.sluitingstijd || null,
      status: datamomentForm.status,
      toelichting: datamomentForm.toelichting || null,
      bronUrl: datamomentForm.bronUrl || null,
      actief: datamomentForm.actief,
      regelingIds: datamomentForm.regelingIds,
    });

    setOpslaanDatamoment(false);

    if (res.error) {
      notify('error', 'Het datamoment kon niet worden opgeslagen.');

      return;
    }

    setBewerkId(undefined);
    notify('success', 'Datamoment opgeslagen.');
    laadAlles();
  };

  const toggleActief = async (datamoment) => {
    const res = await upsertFunderDatamoment({
      id: datamoment.id,
      funderId,
      type: datamoment.type,
      naam: datamoment.naam,
      sluitingsdatum: datamoment.sluitingsdatum,
      sluitingstijd: datamoment.sluitingstijd,
      status: datamoment.status,
      toelichting: datamoment.toelichting,
      bronUrl: datamoment.bron_url,
      actief: !datamoment.actief,
      regelingIds: datamoment.regeling_ids || [],
    });

    if (res.error) {
      notify('error', 'De status van het datamoment kon niet worden gewijzigd.');

      return;
    }

    laadAlles();
  };

  const verwijder = async (datamoment) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Datamoment van ${formatDatumKort(datamoment.sluitingsdatum)} verwijderen? Dit kan niet ongedaan worden gemaakt.`)) {
      return;
    }

    const res = await verwijderFunderDatamoment(datamoment.id);

    if (res.error) {
      notify('error', 'Het datamoment kon niet worden verwijderd.');

      return;
    }

    notify('success', 'Datamoment verwijderd.');
    laadAlles();
  };

  return (
    <div style={css('margin-bottom: 6px;')}>
      {laden ? (
        <div style={css('font-size: 13.5px; color: #82918B;')}>Datamomenten laden…</div>
      ) : datamomenten.length ? (
        <div style={css('display: grid; gap: 8px; margin-bottom: 12px;')}>
          {datamomenten.map((datamoment) => (
            <DatamomentRij
              key={datamoment.id}
              datamoment={datamoment}
              onBewerken={() => openBewerken(datamoment)}
              onVerwijderen={() => verwijder(datamoment)}
              onToggleActief={() => toggleActief(datamoment)}
            />
          ))}
        </div>
      ) : (
        <div style={css('margin-bottom: 12px; font-size: 13.5px; color: #82918B;')}>
          Nog geen datamomenten voor dit fonds.
        </div>
      )}

      {bewerkId !== undefined ? (
        <DatamomentFormulier
          form={datamomentForm}
          setForm={setDatamomentForm}
          onSave={opslaanDatamomentForm}
          onCancel={() => setBewerkId(undefined)}
          opslaan={opslaanDatamoment}
          nieuw={bewerkId === null}
          regelingen={regelingen}
        />
      ) : (
        <button type="button" style={smallButtonStyle} onClick={openNieuw}>
          + Datamoment toevoegen
        </button>
      )}
    </div>
  );
}

function DatamomentRij({ datamoment, onBewerken, onVerwijderen, onToggleActief }) {
  const typeLabel = (DATAMOMENT_TYPES.find((t) => t.value === datamoment.type) || {}).label || datamoment.type;
  const statusLabel = (DATAMOMENT_STATUSSEN.find((s) => s.value === datamoment.status) || {}).label || datamoment.status;
  const statusTone = datamoment.status === 'geannuleerd' ? 'rood' : datamoment.status === 'verzet' ? 'geel' : 'groen';
  const gekoppeld = datamoment.regeling_namen || [];

  return (
    <div
      style={css(`
        display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
        padding: 10px 14px; border: 1px solid #E1EAE4; border-radius: 12px;
        background: ${datamoment.actief ? '#FFFFFF' : '#F2F2EF'};
        ${!datamoment.actief || datamoment.is_verstreken ? 'opacity: 0.7;' : ''}
      `)}
    >
      <div>
        <div style={css('font-weight: 800; color: #2C4A5E; font-size: 14px;')}>
          {formatDatumKort(datamoment.sluitingsdatum)}
          {datamoment.sluitingstijd ? ` · ${String(datamoment.sluitingstijd).slice(0, 5)}` : ''}
          {' · '}
          {typeLabel}
          {datamoment.naam ? ` — ${datamoment.naam}` : ''}
          <span style={badgeStyle(statusTone)}> {statusLabel}</span>
          {!datamoment.actief ? <span style={badgeStyle('grijs')}> Gedeactiveerd</span> : null}
          {datamoment.actief && datamoment.is_verstreken ? <span style={badgeStyle('grijs')}> Verstreken</span> : null}
        </div>
        <div style={css('font-size: 12.5px; color: #536460;')}>
          {gekoppeld.length ? `Gekoppeld aan: ${gekoppeld.join(', ')}` : 'Nog aan geen enkele subsidieregeling gekoppeld'}
        </div>
        {datamoment.toelichting ? <div style={css('font-size: 12.5px; color: #82918B;')}>{datamoment.toelichting}</div> : null}
      </div>
      <div style={css('display: flex; gap: 8px; flex-shrink: 0;')}>
        <button type="button" style={smallButtonStyle} onClick={onBewerken}>
          Bewerken
        </button>
        <button type="button" style={plainButtonStyle} onClick={onToggleActief}>
          {datamoment.actief ? 'Deactiveren' : 'Activeren'}
        </button>
        <button type="button" style={plainButtonStyle} onClick={onVerwijderen}>
          Verwijderen
        </button>
      </div>
    </div>
  );
}

function DatamomentFormulier({ form, setForm, onSave, onCancel, opslaan, nieuw, regelingen }) {
  const set = (veld) => (event) => setForm((f) => ({ ...f, [veld]: event.target.value }));

  const toggleRegeling = (id) => {
    setForm((f) => ({
      ...f,
      regelingIds: f.regelingIds.includes(id) ? f.regelingIds.filter((r) => r !== id) : [...f.regelingIds, id],
    }));
  };

  const selecteerAlles = () => setForm((f) => ({ ...f, regelingIds: regelingen.map((r) => r.id) }));
  const selecteerGeen = () => setForm((f) => ({ ...f, regelingIds: [] }));

  return (
    <div style={css('margin-top: 4px; padding: 14px 16px; border: 1px dashed #BFD4C6; border-radius: 12px; background: #FFFFFF;')}>
      <div style={css('margin-bottom: 12px; font-size: 13.5px; font-weight: 800; color: #2C4A5E;')}>
        {nieuw ? 'Nieuw datamoment' : 'Datamoment bewerken'}
      </div>
      <VeldGrid>
        <Veld label="Type">
          <select style={inputStyle} value={form.type} onChange={set('type')}>
            {DATAMOMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Veld>
        <Veld label="Naam van de aanvraagronde (optioneel)">
          <input style={inputStyle} value={form.naam} onChange={set('naam')} placeholder="bijv. Ronde 1 2027" />
        </Veld>
        <Veld label="Datum">
          <input style={inputStyle} type="date" value={form.sluitingsdatum} onChange={set('sluitingsdatum')} />
        </Veld>
        <Veld label="Tijd (leeg = 23:59)">
          <input style={inputStyle} type="time" value={form.sluitingstijd} onChange={set('sluitingstijd')} />
        </Veld>
        <Veld label="Status">
          <select style={inputStyle} value={form.status} onChange={set('status')}>
            {DATAMOMENT_STATUSSEN.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Veld>
        <Veld label="Toelichting (optioneel)" span={2}>
          <input style={inputStyle} value={form.toelichting} onChange={set('toelichting')} />
        </Veld>
        <Veld label="Bron / URL (optioneel)">
          <input style={inputStyle} value={form.bronUrl} onChange={set('bronUrl')} placeholder="https://…" />
        </Veld>
        <Veld label="Actief">
          <select style={inputStyle} value={form.actief ? '1' : '0'} onChange={(e) => setForm((f) => ({ ...f, actief: e.target.value === '1' }))}>
            <option value="1">Ja</option>
            <option value="0">Nee (tijdelijk gedeactiveerd)</option>
          </select>
        </Veld>
      </VeldGrid>

      <SectieKop muted>Gekoppelde subsidieregelingen</SectieKop>
      <p style={css('margin: -8px 0 10px; font-size: 12.5px; color: #82918B;')}>
        Dit datamoment verschijnt als eerstvolgende deadline op precies de hier aangevinkte subsidieregelingen van dit
        fonds. Meerdere regelingen kunnen dezelfde datum delen.
      </p>
      {regelingen.length ? (
        <>
          <div style={css('display: flex; gap: 10px; margin-bottom: 10px;')}>
            <button type="button" style={plainButtonStyle} onClick={selecteerAlles}>
              Alles selecteren
            </button>
            <button type="button" style={plainButtonStyle} onClick={selecteerGeen}>
              Niets selecteren
            </button>
          </div>
          <div style={css('display: grid; gap: 6px; margin-bottom: 16px;')}>
            {regelingen.map((r) => (
              <label key={r.id} style={css('display: flex; align-items: center; gap: 10px; font-size: 13.5px; color: #2C4A5E; cursor: pointer;')}>
                <input type="checkbox" checked={form.regelingIds.includes(r.id)} onChange={() => toggleRegeling(r.id)} />
                {r.naam}
              </label>
            ))}
          </div>
        </>
      ) : (
        <div style={css('margin-bottom: 16px; font-size: 13px; color: #82918B;')}>
          Dit fonds heeft nog geen subsidieregelingen om aan te koppelen.
        </div>
      )}

      <div style={css('display: flex; gap: 12px; flex-wrap: wrap;')}>
        <button type="button" disabled={opslaan} onClick={onSave} style={secondaryButtonStyle}>
          {opslaan ? 'Opslaan…' : 'Opslaan datamoment'}
        </button>
        <button type="button" disabled={opslaan} onClick={onCancel} style={plainButtonStyle}>
          Annuleren
        </button>
      </div>
    </div>
  );
}

// Vervolgopdracht, prioriteit 2 (CRUD - Create). Hergebruikt AdminEditModal
// (dezelfde modal-schil als FunderBewerkPaneel hierboven) voor een klein
// formulier met alleen de twee verplichte velden - de rest vult de
// beheerder meteen daarna in via FunderBewerkPaneel zelf (zie
// nieuwFondsOpslaan hierboven).
function NieuwFondsModal({ form, setForm, onCancel, onSave, opslaan, fout }) {
  const set = (veld) => (event) => setForm((f) => ({ ...f, [veld]: event.target.value }));

  return (
    <AdminEditModal title="Nieuw fonds" onClose={onCancel} onSave={onSave} saving={opslaan} dirty>
      <p style={css('margin: -4px 0 16px; font-size: 12.5px; color: #82918B;')}>
        Alleen naam en type gever zijn nu verplicht. Missie, bijdrage, contactgegevens, classificaties en
        toegangsniveau vult u direct hierna in, in hetzelfde bewerkscherm als bij een bestaand fonds.
      </p>
      {fout ? (
        <div
          style={css('margin-bottom: 14px; padding: 12px 14px; border-radius: 10px; background: #FFF1EF; color: #A13B2F; font-size: 13px; font-weight: 600;')}
        >
          {fout}
        </div>
      ) : null}
      <VeldGrid>
        <Veld label="Naam" span={2}>
          <input style={inputStyle} value={form.naam} onChange={set('naam')} autoFocus />
        </Veld>
        <Veld label="Type gever">
          <select style={inputStyle} value={form.type} onChange={set('type')}>
            <option value="">Kies een type…</option>
            {FUNDER_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Veld>
      </VeldGrid>
    </AdminEditModal>
  );
}
