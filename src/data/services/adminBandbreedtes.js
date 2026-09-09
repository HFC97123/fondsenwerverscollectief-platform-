// Alle Supabase-communicatie voor het beheren van de centrale
// bandbreedte-bijdrage-lookup (bandbreedtes_bijdrage) en voor het koppelen
// daarvan aan funders/subsidieregelingen. Uitsluitend via de admin-only
// RPC's uit migratie bandbreedte_bijdrage_lookup — nooit een rechtstreekse
// tabel-write. Zelfde opzet als adminClassificaties.js, maar met de extra
// gestructureerde velden (bedrag_min/bedrag_max/volgorde) die de generieke
// admin_list_classificaties-familie niet ondersteunt.
import { query } from '../client.js';

// { rows: [{ id, naam, bedrag_min, bedrag_max, volgorde, gebruikt_aantal }], error }
export async function fetchBandbreedteLijst() {
  const res = await query((sb) => sb.rpc('admin_list_bandbreedtes'), []);

  return { rows: res.data || [], error: res.error };
}

export async function voegBandbreedteToe({ naam, bedragMin, bedragMax = null, volgorde = null }) {
  const res = await query((sb) =>
    sb.rpc('admin_add_bandbreedte', {
      p_naam: naam,
      p_bedrag_min: bedragMin,
      p_bedrag_max: bedragMax,
      p_volgorde: volgorde,
    }),
  );

  return { id: res.data, error: res.error };
}

export async function werkBandbreedteBij(id, { naam, bedragMin, bedragMax = null, volgorde = null }) {
  const res = await query((sb) =>
    sb.rpc('admin_update_bandbreedte', {
      p_id: id,
      p_naam: naam,
      p_bedrag_min: bedragMin,
      p_bedrag_max: bedragMax,
      p_volgorde: volgorde,
    }),
  );

  return { error: res.error };
}

export async function verwijderBandbreedte(id) {
  const res = await query((sb) => sb.rpc('admin_verwijder_bandbreedte', { p_id: id }));

  return { error: res.error };
}

// Zet (of wist, met bandbreedteId = null) de gekoppelde bandbreedte van één
// funder/subsidieregeling. tabel: 'funders' | 'subsidieregelingen'.
export async function zetBandbreedte(tabel, rijId, bandbreedteId) {
  const res = await query((sb) =>
    sb.rpc('admin_set_bandbreedte', { p_tabel: tabel, p_id: rijId, p_bandbreedte_id: bandbreedteId }),
  );

  return { error: res.error };
}

// Zelfde, maar dan voor meerdere rijen tegelijk (bulk-editor). bandbreedteId
// mag hier bewust ook null zijn ("geen bandbreedte") — deze functie wordt
// alleen aangeroepen wanneer de beheerder dit veld expliciet aanvinkt in de
// bulk-editor, dus null is hier altijd een actieve keuze, geen "niet
// gewijzigd".
export async function bulkZetBandbreedte(tabel, ids, bandbreedteId) {
  const res = await query(
    (sb) => sb.rpc('admin_bulk_set_bandbreedte', { p_tabel: tabel, p_ids: ids, p_bandbreedte_id: bandbreedteId }),
    0,
  );

  return { count: res.data || 0, error: res.error };
}
