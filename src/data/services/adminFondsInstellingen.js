// Beheer · twee kleine instellingen per fonds: omvang (groot/klein, voor de checklist stukken) en
// welke contactgegevens verborgen zijn voor leden. Eigen RPC's (beheerder-only). Ontbreekt de RPC, dan is het veld er niet.
import { query } from '../client.js';

export const OMVANG_KEUZES = [
  { value: 'auto', label: 'Automatisch' },
  { value: 'groot', label: 'Groot fonds' },
  { value: 'klein', label: 'Klein fonds' },
];

// -> { waarde, beschikbaar }
export async function haalFondsOmvang(funderId) {
  const res = await query((sb) => sb.rpc('admin_fonds_omvang', { p_funder_id: funderId }), null);

  if (res.error || typeof res.data !== 'string') return { waarde: 'auto', beschikbaar: false };

  return { waarde: res.data, beschikbaar: true };
}

// -> { ok }
export async function zetFondsOmvang(funderId, waarde) {
  const res = await query((sb) => sb.rpc('admin_zet_fonds_omvang', { p_funder_id: funderId, p_omvang: waarde }));

  return { ok: !res.error };
}

// vlaggen: { contactpersoon, email, telefoon } (booleans). -> { ok }
export async function zetFunderPrive(funderId, vlaggen) {
  const res = await query((sb) =>
    sb.rpc('admin_zet_funder_prive', {
      p_funder_id: funderId,
      p_contactpersoon_prive: Boolean(vlaggen.contactpersoon),
      p_email_prive: Boolean(vlaggen.email),
      p_telefoon_prive: Boolean(vlaggen.telefoon),
    }),
  );

  return { ok: !res.error };
}

// Overige kolommen (systeemvelden) van een fonds of regeling. tabel: 'funders' | 'subsidieregelingen'.
// -> { velden, beschikbaar }
export async function haalOverigeVelden(tabel, id) {
  const res = await query((sb) => sb.rpc('admin_get_overige_velden', { p_tabel: tabel, p_id: id }), null);

  if (res.error || !res.data || typeof res.data !== 'object') return { velden: {}, beschikbaar: false };

  return { velden: res.data, beschikbaar: true };
}

// velden: alleen de sleutels die gewijzigd zijn. -> { ok }
export async function zetOverigeVelden(tabel, id, velden) {
  const res = await query((sb) => sb.rpc('admin_zet_overige_velden', { p_tabel: tabel, p_id: id, p_velden: velden }));

  return { ok: !res.error };
}

// Alleen de gewijzigde sleutels (voor opslaan).
export function gewijzigdeVelden(nu, begin) {
  const uit = {};

  Object.keys(nu || {}).forEach((k) => {
    if (JSON.stringify(nu[k] ?? null) !== JSON.stringify((begin || {})[k] ?? null)) uit[k] = nu[k] === '' ? null : nu[k];
  });

  return uit;
}
