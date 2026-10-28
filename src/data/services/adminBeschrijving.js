// Beheer · de algemene beschrijving van een fonds of regeling (de uitgebreide tekst). Staat niet in de lijst-RPC's en heeft daarom een eigen
// lees- en schrijffunctie (beheerder-only, SECURITY DEFINER). Is de migratie nog niet toegepast, dan is het veld er niet (beschikbaar: false).
import { query } from '../client.js';

// tabel: 'funders' | 'subsidieregelingen'. -> { tekst, beschikbaar }
export async function haalAlgemeneBeschrijving(tabel, id) {
  const res = await query((sb) => sb.rpc('admin_get_algemene_beschrijving', { p_tabel: tabel, p_id: id }), null);

  if (res.error) return { tekst: '', beschikbaar: false };

  return { tekst: typeof res.data === 'string' ? res.data : '', beschikbaar: true };
}

// -> { ok, fout }
export async function zetAlgemeneBeschrijving(tabel, id, tekst) {
  const res = await query((sb) => sb.rpc('admin_set_algemene_beschrijving', { p_tabel: tabel, p_id: id, p_tekst: tekst || '' }));

  return { ok: !res.error, fout: res.error ? 'De beschrijving kon niet worden opgeslagen.' : '' };
}
