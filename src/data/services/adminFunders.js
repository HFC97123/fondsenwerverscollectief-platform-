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

// params: { funderId, search, type, status, dataTier, sourceType,
//           classificationReviewed, accessTier, prioriteitMin,
//           bandbreedteBijdrageId, thema, doelgroep, regio, gescandDoorAgent,
//           sortColumn, sortDirection, page, pageSize }
// funderId: haalt (via dezelfde admin_list_funders) precies één funder op -
// gebruikt na createFunder() om de zojuist aangemaakte rij meteen te openen
// zonder een aparte "haal één funder op"-RPC te hoeven bouwen.
export async function fetchFunders(params = {}) {
  const {
    funderId = null,
    search = null,
    type = null,
    status = null,
    dataTier = null,
    sourceType = null,
    classificationReviewed = null,
    accessTier = null,
    prioriteitMin = null,
    bandbreedteBijdrageId = null,
    thema = null,
    doelgroep = null,
    regio = null,
    gescandDoorAgent = null,
    sortColumn = 'naam',
    sortDirection = 'asc',
    page = 0,
    pageSize = 50,
  } = params;

  const res = await query(
    (sb) =>
      sb.rpc('admin_list_funders', {
        p_funder_id: funderId || null,
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
        p_thema: thema || null,
        p_doelgroep: doelgroep || null,
        p_regio: regio || null,
        p_gescand_door_agent: gescandDoorAgent,
      }),
    [],
  );

  const rows = res.data || [];
  const total = rows.length ? Number(rows[0].total_count) || rows.length : 0;

  return { rows, total, error: res.error };
}

// patch: { naam, type, status, website, missie, aanvraagcriteria, bijdrageMin,
//          bijdrageMax, bijdrageToelichting, jaarbudget, prioriteit, bron,
//          researchSource, contactpersoon, contactpersoonFunctie, email,
//          telefoon, algemeenEmail, algemeenTelefoon, straat, huisnummer,
//          postcode, plaats, provincie, land, volgendeVergaderdatum,
//          vergaderfrequentie, vergaderingToelichting }
// Bewust NOOIT data_tier/source_type/classification_reviewed (die horen bij
// de classificatie-RPC's van stap 2). Contactgegevens/adres/vergaderdatum
// waren tot nu toe bewust alleen-lezen ("totdat er een apart, expliciet
// goedgekeurd schrijfpad komt") - dat pad is er nu, expliciet gevraagd.
// De oude, vrije-tekst `adres`-kolom blijft bewust ongewijzigd (niet hier
// opgenomen): de nieuwe, gestructureerde adresvelden zijn nu de ene bron.
export async function updateFunder(funderId, patch) {
  const res = await query((sb) =>
    sb.rpc('admin_update_funder', {
      p_funder_id: funderId,
      p_naam: patch.naam ?? null,
      p_type: patch.type ?? null,
      p_status: patch.status ?? null,
      p_website: patch.website ?? null,
      p_missie: patch.missie ?? null,
      p_aanvraagcriteria: patch.aanvraagcriteria ?? null,
      p_bijdrage_min: patch.bijdrageMin ?? null,
      p_bijdrage_max: patch.bijdrageMax ?? null,
      p_jaarbudget: patch.jaarbudget ?? null,
      p_prioriteit: patch.prioriteit ?? null,
      p_bron: patch.bron ?? null,
      p_research_source: patch.researchSource ?? null,
      p_bijdrage_toelichting: patch.bijdrageToelichting ?? null,
      p_contactpersoon: patch.contactpersoon ?? null,
      p_contactpersoon_functie: patch.contactpersoonFunctie ?? null,
      p_email: patch.email ?? null,
      p_telefoon: patch.telefoon ?? null,
      p_algemeen_email: patch.algemeenEmail ?? null,
      p_algemeen_telefoon: patch.algemeenTelefoon ?? null,
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

// Nieuw fonds aanmaken (prioriteit 2, CRUD). Alleen naam + type zijn
// verplicht (dezelfde twee NOT NULL-kolommen als de database zelf al
// afdwingt) - alles overig vult de beheerder direct daarna in via hetzelfde
// bewerkscherm (updateFunder hierboven), geen tweede formulier.
export async function createFunder({ naam, type }) {
  const res = await query((sb) => sb.rpc('admin_create_funder', { p_naam: naam, p_type: type }));

  return { id: res.data || null, error: res.error };
}

// Fonds verwijderen. Gekoppelde subsidieregelingen/classificaties/notities
// worden door de database zelf opgeruimd (on delete cascade, geverifieerd
// vóór het bouwen van deze functie) - geen aparte opruimstappen hier nodig.
export async function deleteFunder(funderId) {
  const res = await query((sb) => sb.rpc('admin_delete_funder', { p_funder_id: funderId }));

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

// Volwaardige bulk-editor (vervolgopdracht): "Beoordeeld" in één keer voor
// meerdere rijen, zonder — zoals admin_bulk_classify_funders/
// -subsidieregelingen dat wél zouden doen — ook data_tier/source_type
// geforceerd gelijk te trekken voor de hele selectie. Gebruikt dezelfde
// onderliggende kolom (classification_reviewed) als de individuele
// "Beoordeeld"-schakelaar hierboven — geen tweede statusveld. Generiek over
// beide tabellen, zelfde p_tabel-patroon als bulkSetAccessTier hierboven.
export async function bulkSetReviewed(tabel, ids, reviewed) {
  const res = await query((sb) => sb.rpc('admin_bulk_set_reviewed', { p_tabel: tabel, p_ids: ids, p_reviewed: reviewed }), 0);

  return { count: res.data || 0, error: res.error };
}

// Bulk-bijwerken van losse, enkelvoudige funder-velden (Type gever, Data
// tier, Vergaderfrequentie) uit de nieuwe bulk-editor.
// velden: alleen de sleutels die de beheerder in de bulk-editor heeft
// aangevinkt worden meegegeven — 'type' in velden bepaalt of het veld
// "actief" is, niet of de waarde zelf null is. Dit is bewust een expliciete
// vlag per veld i.p.v. "null = niet gekozen": Type gever mag ook naar een
// lege waarde gezet worden, dus null moet daar een geldige, actieve keuze
// kunnen zijn.
export async function bulkUpdateFunder(funderIds, velden = {}) {
  const res = await query(
    (sb) =>
      sb.rpc('admin_bulk_update_funder', {
        p_funder_ids: funderIds,
        p_type_actief: 'type' in velden,
        p_type: velden.type ?? null,
        p_data_tier_actief: 'dataTier' in velden,
        p_data_tier: velden.dataTier ?? null,
        p_vergaderfrequentie_actief: 'vergaderfrequentie' in velden,
        p_vergaderfrequentie: velden.vergaderfrequentie ?? null,
      }),
    0,
  );

  return { count: res.data || 0, error: res.error };
}

// Markeert (of ontmarkeert) een funder als "beoordeeld" (classification_reviewed) —
// dit is de schakelaar die bepaalt of het toegangsniveau (access_tier)
// hierboven leidend is voor wat leden te zien krijgen, of dat de oudere
// data_tier/source_type-heuristiek nog geldt (zie subsidie_zichtbaar_voor_tier
// in het architectuuroverzicht). admin_classify_funder vereist ook data_tier
// en source_type; hier worden bewust de bestaande waarden van deze funder
// ongewijzigd meegestuurd — dit is een bevestiging dat de huidige
// classificatie is nagelopen, geen herclassificatie.
export async function classifyFunder(funderId, { dataTier, sourceType, reviewed, reden = null }) {
  const res = await query((sb) =>
    sb.rpc('admin_classify_funder', {
      p_funder_id: funderId,
      p_data_tier: dataTier,
      p_source_type: sourceType,
      p_reviewed: reviewed,
      p_reden: reden,
    }),
  );

  return { error: res.error };
}
