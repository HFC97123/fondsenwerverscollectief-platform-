// Alle Supabase-communicatie voor het beheer van subsidieregelingen/deadlines.
// Lezen via admin_list_subsidieregelingen, schrijven via
// admin_update_subsidieregeling en admin_bulk_create_subsidieregelingen —
// allemaal admin-only RPC's, nooit een rechtstreekse tabel-write.
import { query } from '../client.js';

export const REGELING_STATUSSEN = [
  { value: 'open', label: 'Open' },
  { value: 'binnenkort', label: 'Binnenkort' },
  { value: 'doorlopend', label: 'Doorlopend' },
  { value: 'aangekondigd', label: 'Aangekondigd' },
  { value: 'budget_uitgeput', label: 'Budget uitgeput' },
  { value: 'gesloten', label: 'Gesloten' },
];

// params: { search, funderId, status, dataTier, sourceType,
//           classificationReviewed, sortColumn, sortDirection, page, pageSize }
export async function fetchSubsidieregelingen(params = {}) {
  const {
    search = null,
    funderId = null,
    status = null,
    dataTier = null,
    sourceType = null,
    classificationReviewed = null,
    sortColumn = 'naam',
    sortDirection = 'asc',
    page = 0,
    pageSize = 50,
  } = params;

  const res = await query(
    (sb) =>
      sb.rpc('admin_list_subsidieregelingen', {
        p_regeling_id: null,
        p_funder_id: funderId || null,
        p_search: search || null,
        p_status: status || null,
        p_data_tier: dataTier || null,
        p_source_type: sourceType || null,
        p_classification_reviewed: classificationReviewed,
        p_sort_column: sortColumn,
        p_sort_direction: sortDirection,
        p_limit: pageSize,
        p_offset: page * pageSize,
      }),
    [],
  );

  const rows = res.data || [];
  const total = rows.length ? Number(rows[0].total_count) || rows.length : 0;

  return { rows, total, error: res.error };
}

// patch: { naam, thema, bedragMin, bedragMax, deadline, deadlineDatum,
//          deadlineOmschrijving, voorwaarden, status, funderId }
export async function updateSubsidieregeling(regelingId, patch) {
  const res = await query((sb) =>
    sb.rpc('admin_update_subsidieregeling', {
      p_regeling_id: regelingId,
      p_naam: patch.naam ?? null,
      p_thema: patch.thema ?? null,
      p_bedrag_min: patch.bedragMin ?? null,
      p_bedrag_max: patch.bedragMax ?? null,
      p_deadline: patch.deadline ?? null,
      p_deadline_datum: patch.deadlineDatum ?? null,
      p_deadline_omschrijving: patch.deadlineOmschrijving ?? null,
      p_voorwaarden: patch.voorwaarden ?? null,
      p_status: patch.status ?? null,
      p_funder_id: patch.funderId ?? null,
    }),
  );

  return { error: res.error };
}

// rows: [{ funderId, naam, thema, bedragMin, bedragMax, deadline,
//          deadlineDatum, deadlineOmschrijving, voorwaarden, status,
//          dataTier, sourceType }]
// Eén RPC-aanroep voor de hele CSV-import, in plaats van een aanroep per rij.
export async function bulkCreateSubsidieregelingen(rows) {
  const payload = (rows || []).map((r) => ({
    funder_id: r.funderId,
    naam: r.naam,
    thema: r.thema || null,
    bedrag_min: r.bedragMin ?? null,
    bedrag_max: r.bedragMax ?? null,
    deadline: r.deadline || null,
    deadline_datum: r.deadlineDatum || null,
    deadline_omschrijving: r.deadlineOmschrijving || null,
    voorwaarden: r.voorwaarden || null,
    status: r.status || 'open',
    data_tier: r.dataTier || 'premium',
    source_type: r.sourceType || 'manual_admin',
  }));

  const res = await query((sb) => sb.rpc('admin_bulk_create_subsidieregelingen', { p_rows: payload }), 0);

  return { count: res.data || 0, error: res.error };
}
