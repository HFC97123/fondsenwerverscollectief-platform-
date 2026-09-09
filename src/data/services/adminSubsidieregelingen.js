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

// params: { search, funderId, funderSearch, status, dataTier, sourceType,
//           classificationReviewed, accessTier, bandbreedteBijdrageId, thema,
//           doelgroep, regio, type, discoveredBy, sortColumn, sortDirection,
//           page, pageSize }
export async function fetchSubsidieregelingen(params = {}) {
  const {
    search = null,
    funderId = null,
    funderSearch = null,
    status = null,
    dataTier = null,
    sourceType = null,
    classificationReviewed = null,
    accessTier = null,
    bandbreedteBijdrageId = null,
    thema = null,
    doelgroep = null,
    regio = null,
    type = null,
    discoveredBy = null,
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
        p_access_tier: accessTier || null,
        p_bandbreedte_bijdrage_id: bandbreedteBijdrageId || null,
        p_thema: thema || null,
        p_doelgroep: doelgroep || null,
        p_regio: regio || null,
        p_type: type || null,
        p_funder_search: funderSearch || null,
        p_discovered_by: discoveredBy || null,
      }),
    [],
  );

  const rows = res.data || [];
  const total = rows.length ? Number(rows[0].total_count) || rows.length : 0;

  return { rows, total, error: res.error };
}

// patch: { naam, thema, werkgebied, bedragMin, bedragMax, bijdrageToelichting,
//          deadline, deadlineDatum, deadlineOmschrijving, voorwaarden, status,
//          funderId, aanvraaglink, beoordelingscriteria, typeProjecten,
//          begrotingseisen, eigenBijdrage, cofinanciering, behandeltermijn,
//          aanvraagprocedure, type, contactpersoon, contactpersoonFunctie,
//          email, telefoon, algemeenEmail, algemeenTelefoon, website, straat,
//          huisnummer, postcode, plaats, provincie, land,
//          volgendeVergaderdatum, vergaderfrequentie, vergaderingToelichting }
// Contactgegevens/adres/vergaderdatum zijn nieuw voor subsidieregelingen (die
// hadden nog geen enkel contactveld) - vervolgopdracht, punt 1 en 4.
export async function updateSubsidieregeling(regelingId, patch) {
  const res = await query((sb) =>
    sb.rpc('admin_update_subsidieregeling', {
      p_regeling_id: regelingId,
      p_naam: patch.naam ?? null,
      p_thema: patch.thema ?? null,
      p_werkgebied: patch.werkgebied ?? null,
      p_bedrag_min: patch.bedragMin ?? null,
      p_bedrag_max: patch.bedragMax ?? null,
      p_deadline: patch.deadline ?? null,
      p_deadline_datum: patch.deadlineDatum ?? null,
      p_deadline_omschrijving: patch.deadlineOmschrijving ?? null,
      p_voorwaarden: patch.voorwaarden ?? null,
      p_status: patch.status ?? null,
      p_funder_id: patch.funderId ?? null,
      p_aanvraaglink: patch.aanvraaglink ?? null,
      p_beoordelingscriteria: patch.beoordelingscriteria ?? null,
      p_type_projecten: patch.typeProjecten ?? null,
      p_begrotingseisen: patch.begrotingseisen ?? null,
      p_eigen_bijdrage: patch.eigenBijdrage ?? null,
      p_cofinanciering: patch.cofinanciering ?? null,
      p_behandeltermijn: patch.behandeltermijn ?? null,
      p_aanvraagprocedure: patch.aanvraagprocedure ?? null,
      p_type: patch.type ?? null,
      p_bijdrage_toelichting: patch.bijdrageToelichting ?? null,
      p_contactpersoon: patch.contactpersoon ?? null,
      p_contactpersoon_functie: patch.contactpersoonFunctie ?? null,
      p_email: patch.email ?? null,
      p_telefoon: patch.telefoon ?? null,
      p_algemeen_email: patch.algemeenEmail ?? null,
      p_algemeen_telefoon: patch.algemeenTelefoon ?? null,
      p_website: patch.website ?? null,
      p_straat: patch.straat ?? null,
      p_huisnummer: patch.huisnummer ?? null,
      p_postcode: patch.postcode ?? null,
      p_plaats: patch.plaats ?? null,
      p_provincie: patch.provincie ?? null,
      p_land: patch.land ?? null,
      p_volgende_vergaderdatum: patch.volgendeVergaderdatum ?? null,
      p_vergaderfrequentie: patch.vergaderfrequentie ?? null,
      p_vergadering_toelichting: patch.vergaderingToelichting ?? null,
    }),
  );

  return { error: res.error };
}

// Bulk-bijwerken van losse, enkelvoudige regelingsvelden (Type, Status,
// Type projecten, Data tier, Vergaderfrequentie) uit de nieuwe bulk-editor —
// zelfde `*Actief`-vlagpatroon als bulkUpdateFunder() in adminFunders.js: een
// veld wijzigt alleen wanneer de sleutel in `velden` voorkomt, ongeacht of de
// waarde zelf null is (Type mag bewust terug naar "overgenomen van gever" =
// null gezet worden).
export async function bulkUpdateSubsidieregeling(regelingIds, velden = {}) {
  const res = await query(
    (sb) =>
      sb.rpc('admin_bulk_update_subsidieregeling', {
        p_regeling_ids: regelingIds,
        p_type_actief: 'type' in velden,
        p_type: velden.type ?? null,
        p_status_actief: 'status' in velden,
        p_status: velden.status ?? null,
        p_type_projecten_actief: 'typeProjecten' in velden,
        p_type_projecten: velden.typeProjecten ?? null,
        p_data_tier_actief: 'dataTier' in velden,
        p_data_tier: velden.dataTier ?? null,
        p_vergaderfrequentie_actief: 'vergaderfrequentie' in velden,
        p_vergaderfrequentie: velden.vergaderfrequentie ?? null,
      }),
    0,
  );

  return { count: res.data || 0, error: res.error };
}

// Markeert (of ontmarkeert) een subsidieregeling als "beoordeeld"
// (classification_reviewed) — zelfde schakelaar en zelfde bevestigings-
// patroon als classifyFunder() in adminFunders.js: de bestaande data_tier/
// source_type van deze regeling gaan ongewijzigd mee, dit is geen
// herclassificatie maar een bevestiging.
export async function classifySubsidieregeling(regelingId, { dataTier, sourceType, reviewed, reden = null }) {
  const res = await query((sb) =>
    sb.rpc('admin_classify_subsidieregeling', {
      p_regeling_id: regelingId,
      p_data_tier: dataTier,
      p_source_type: sourceType,
      p_reviewed: reviewed,
      p_reden: reden,
    }),
  );

  return { error: res.error };
}

// Aanvraagrondes (meerdere sluitingsdata per subsidieregeling — "Volgende fase":
// meerdere aanvraagrondes). Eén regeling heeft 0..n rondes. Zolang er 0 rondes
// bestaan blijft de legacy deadline/deadlineDatum/deadlineOmschrijving hierboven
// de actieve bron (compatibiliteitslaag in de subsidieregelingen_deadlines-view en
// in admin_list_subsidieregelingen/kompas_subsidieregelingen_voor_tier); zodra er
// 1+ rondes bestaan is de eerstvolgende, nog geldige ronde de enige bron voor de
// deadline van die regeling — nooit tegelijk beide.
export async function fetchRondes(regelingId) {
  const res = await query((sb) => sb.rpc('admin_list_rondes', { p_regeling_id: regelingId }), []);
  return { rows: res.data || [], error: res.error };
}

// ronde: { id (leeg = nieuwe ronde), regelingId, sluitingsdatum, sluitingstijd,
//          openVanaf, beoordelingsdatum, beoordelingsperiode, toelichting,
//          bronUrl, actief }
export async function upsertRonde(ronde) {
  const res = await query((sb) =>
    sb.rpc('admin_upsert_ronde', {
      p_ronde_id: ronde.id || null,
      p_regeling_id: ronde.regelingId,
      p_sluitingsdatum: ronde.sluitingsdatum || null,
      p_sluitingstijd: ronde.sluitingstijd || null,
      p_open_vanaf: ronde.openVanaf || null,
      p_beoordelingsdatum: ronde.beoordelingsdatum || null,
      p_beoordelingsperiode: ronde.beoordelingsperiode || null,
      p_toelichting: ronde.toelichting || null,
      p_bron_url: ronde.bronUrl || null,
      p_actief: ronde.actief ?? true,
    }),
  );
  return { id: res.data || null, error: res.error };
}

export async function verwijderRonde(rondeId) {
  const res = await query((sb) => sb.rpc('admin_verwijder_ronde', { p_ronde_id: rondeId }));
  return { error: res.error };
}

// rows: [{ funderId, naam, thema, werkgebied, bedragMin, bedragMax, deadline,
//          deadlineDatum, deadlineOmschrijving, voorwaarden, status,
//          dataTier, sourceType }]
// Eén RPC-aanroep voor de hele CSV-import, in plaats van een aanroep per rij.
export async function bulkCreateSubsidieregelingen(rows) {
  const payload = (rows || []).map((r) => ({
    funder_id: r.funderId,
    naam: r.naam,
    thema: r.thema || null,
    werkgebied: r.werkgebied || null,
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
