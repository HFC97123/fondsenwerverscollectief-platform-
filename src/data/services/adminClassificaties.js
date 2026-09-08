// Alle Supabase-communicatie voor het beheren van de centrale
// classificatiewaarden (disciplines/themas, doelgroepen, werkgebieden/regios)
// en voor het koppelen daarvan aan funders/subsidieregelingen. Uitsluitend
// via de admin-only RPC's uit migratie fase1_classificatie_admin_rpcs — nooit
// een rechtstreekse tabel-write, zodat de koppeltabellen en het latere
// classification_audit_log consistent blijven.
import { query } from '../client.js';

// De drie centrale classificatietypes, in de vorm die het
// Classificatiebeheer-scherm en de admin_*_classificatiewaarde-RPC's
// verwachten (p_type). "regios" is de tabelnaam achter "Werkgebieden".
export const CLASSIFICATIE_TYPES = [
  { value: 'themas', label: 'Disciplines' },
  { value: 'doelgroepen', label: 'Doelgroepen' },
  { value: 'regios', label: 'Werkgebieden' },
];

// { rows: [{ id, naam, gebruikt_aantal }], error }
export async function fetchClassificatieLijst(type) {
  const res = await query((sb) => sb.rpc('admin_list_classificaties', { p_type: type }), []);

  return { rows: res.data || [], error: res.error };
}

export async function voegClassificatieToe(type, naam) {
  const res = await query((sb) => sb.rpc('admin_add_classificatiewaarde', { p_type: type, p_naam: naam }));

  return { id: res.data, error: res.error };
}

export async function hernoemClassificatiewaarde(type, id, naam) {
  const res = await query((sb) =>
    sb.rpc('admin_hernoem_classificatiewaarde', { p_type: type, p_id: id, p_naam: naam }),
  );

  return { error: res.error };
}

export async function verwijderClassificatiewaarde(type, id) {
  const res = await query((sb) => sb.rpc('admin_verwijder_classificatiewaarde', { p_type: type, p_id: id }));

  return { error: res.error };
}

// Huidige koppelingen van één funder/subsidieregeling, als namen — klaar om
// rechtstreeks in ClassificatieSelect te tonen. tabel: 'funders' |
// 'subsidieregelingen'.
export async function fetchKoppelingen(tabel, rijId) {
  const res = await query(
    (sb) => sb.rpc('admin_get_classificatie_koppelingen', { p_tabel: tabel, p_rij_id: rijId }),
    [],
  );

  const rij = (res.data || [])[0] || { themas: [], doelgroepen: [], regios: [] };

  return {
    themas: rij.themas || [],
    doelgroepen: rij.doelgroepen || [],
    regios: rij.regios || [],
    error: res.error,
  };
}

// koppelingen: { themas?, doelgroepen?, regios? } — alleen meegegeven velden
// worden vervangen; een weggelaten (undefined) veld blijft ongewijzigd. Namen
// die niet in de centrale lijst voorkomen worden door de RPC genegeerd —
// vandaar dat de bewerkschermen geen vrije tekst aanbieden, alleen bestaande
// waarden (nieuwe waarden gaan via het Classificatiebeheer-scherm).
export async function zetKoppelingen(tabel, rijId, koppelingen = {}) {
  const res = await query((sb) =>
    sb.rpc('admin_set_classificatie_koppelingen', {
      p_tabel: tabel,
      p_rij_id: rijId,
      p_thema_namen: koppelingen.themas ?? null,
      p_doelgroep_namen: koppelingen.doelgroepen ?? null,
      p_regio_namen: koppelingen.regios ?? null,
    }),
  );

  return { error: res.error };
}
