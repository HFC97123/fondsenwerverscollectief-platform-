// Alle Supabase-communicatie voor het beheer van funders loopt via dit
// bestand — geen rechtstreekse supabase-calls in componenten. Lezen en
// schrijven gaat uitsluitend via de admin-only RPC's admin_list_funders en
// admin_update_funder (SECURITY DEFINER, beheerder-only).
import { query } from '../client.js';

export const FUNDER_TYPES = [
  { value: 'vermogensfonds', label: 'Vermogensfonds' },
  { value: 'gemeente_lokale_overheid', label: 'Gemeente / lokale overheid' },
  { value: 'rijksoverheid', label: 'Rijksoverheid' },
  { value: 'europese_fondsen', label: 'Europese fondsen' },
  { value: 'service_club', label: 'Service club' },
  { value: 'religieuze_instelling', label: 'Religieuze instelling' },
  { value: 'corporate_foundation', label: 'Corporate foundation' },
];

export const DATA_TIERS = [
  { value: 'public', label: 'Public' },
  { value: 'premium', label: 'Premium' },
];

export const SOURCE_TYPES = [
  { value: 'internet_scan', label: 'Internet scan' },
  { value: 'manual_admin', label: 'Handmatig (beheer)' },
  { value: 'premium_database', label: 'Premium database' },
  { value: 'api_partner', label: 'API-partner' },
  { value: 'csv_import', label: 'CSV-import' },
];

// Het nieuwe, expliciete toegangsniveau (fase 2) — losstaand van DATA_TIERS
// hierboven (dat blijft de herkomstgebaseerde public/premium-as). Een
// beheerder zet dit per funder ÉN apart per subsidieregeling; nooit
// automatisch afgeleid.
export const ACCESS_TIERS = [
  { value: 'free', label: 'Free' },
  { value: 'pro', label: 'Pro' },
  { value: 'premium', label: 'Premium' },
];

// Simpele drempel-buckets voor de prioriteitsfilter (server-side >=).
export const PRIORITEIT_BUCKETS = [
  { value: null, label: 'Alle prioriteiten' },
  { value: 7, label: 'Hoog (7+)' },
  { value: 4, label: 'Gemiddeld (4+)' },
];

// params: { search, type, status, dataTier, sourceType, classificationReviewed,
//           accessTier, prioriteitMin, bandbreedteBijdrageId, sortColumn,
//           sortDirection, page, pageSize }
export async function fetchFunders(params = {}) {
  const {
    search = null,
    type = null,
    status = null,
    dataTier = null,
    sourceType = null,
    classificationReviewed = null,
    accessTier = null,
    prioriteitMin = null,
    bandbreedteBijdrageId = null,
    sortColumn = 'naam',
    sortDirection = 'asc',
    page = 0,
    pageSize = 50,
  } = params;

  const res = await query(
    (sb) =>
      sb.rpc('admin_list_funders', {
        p_funder_id: null,
        p_search: search || null,
        p_type: type || null,
        p_status: status || null,
        p_data_tier: dataTier || null,
        p_source_type: sourceType || null,
        p_classification_reviewed: classificationReviewed,
        p_sort_column: sortColumn,
        p_sort_direction: sortDirection,
        p_limit: pageSize,
        p_offset: page * pageSize,
        p_prioriteit_min: prioriteitMin,
        p_access_tier: accessTier || null,
        p_bandbreedte_bijdrage_id: bandbreedteBijdrageId || null,
      }),
    [],
  );

  const rows = res.data || [];
  const total = rows.length ? Number(rows[0].total_count) || rows.length : 0;

  return { rows, total, error: res.error };
}

// patch: { naam, type, status, website, missie, bijdrageMin, bijdrageMax,
//          jaarbudget, prioriteit, bron, researchSource }
// Bewust NOOIT data_tier/source_type/classification_reviewed (die horen bij
// de classificatie-RPC's van stap 2) en NOOIT contactgegevens (die blijven
// alleen-lezen totdat er een apart, expliciet goedgekeurd schrijfpad komt).
export async function updateFunder(funderId, patch) {
  const res = await query((sb) =>
    sb.rpc('admin_update_funder', {
      p_funder_id: funderId,
      p_naam: patch.naam ?? null,
      p_type: patch.type ?? null,
      p_status: patch.status ?? null,
      p_website: patch.website ?? null,
      p_missie: patch.missie ?? null,
      p_bijdrage_min: patch.bijdrageMin ?? null,
      p_bijdrage_max: patch.bijdrageMax ?? null,
      p_jaarbudget: patch.jaarbudget ?? null,
      p_prioriteit: patch.prioriteit ?? null,
      p_bron: patch.bron ?? null,
      p_research_source: patch.researchSource ?? null,
    }),
  );

  return { error: res.error };
}

// Eén funder of subsidieregeling een expliciet toegangsniveau geven.
// tabel: 'funders' | 'subsidieregelingen'. Elke wijziging komt in
// classification_audit_log terecht (RPC admin_set_access_tier).
export async function setAccessTier(tabel, id, accessTier, reden = null) {
  const res = await query((sb) =>
    sb.rpc('admin_set_access_tier', { p_tabel: tabel, p_id: id, p_access_tier: accessTier, p_reden: reden }),
  );

  return { error: res.error };
}

// Zelfde toegangsniveau in één keer voor meerdere rijen (bulk-actie).
export async function bulkSetAccessTier(tabel, ids, accessTier, reden = null) {
  const res = await query(
    (sb) =>
      sb.rpc('admin_bulk_set_access_tier', { p_tabel: tabel, p_ids: ids, p_access_tier: accessTier, p_reden: reden }),
    0,
  );

  return { count: res.data || 0, error: res.error };
}
