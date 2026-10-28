// Klein of groot fonds voor de checklist "Stukken voor fondsenwerving" (kolom funders.omvang + RPC's, migratie 20261028072000).
// Automatisch: overheid en EU groot; Pro-bron groot; Premium-bron klein. In Beheer per fonds te overschrijven.
import { supabase } from '../client.js';

// -> { perRegeling: { [schemeId]: 'groot'|'klein'|'onbekend' }, perFonds: { [funderId]: ... } }
export async function haalOmvang({ schemeIds = [], funderIds = [] } = {}) {
  const leeg = { perRegeling: {}, perFonds: {} };
  const s = Array.from(new Set(schemeIds.filter(Boolean))).slice(0, 100);
  const f = Array.from(new Set(funderIds.filter(Boolean))).slice(0, 100);

  if (!supabase || (!s.length && !f.length)) return leeg;

  try {
    const { data, error } = await supabase.rpc('kompas_bron_omvang', { p_scheme_ids: s, p_funder_ids: f });

    if (error) return leeg;

    (data || []).forEach((r) => {
      if (r.bron_type === 'regeling') leeg.perRegeling[r.bron_id] = r.omvang;
      else leeg.perFonds[r.bron_id] = r.omvang;
    });

    return leeg;
  } catch (e) {
    return leeg;
  }
}

export const OMVANG_KEUZES = [
  { value: 'auto', label: 'Automatisch' },
  { value: 'groot', label: 'Groot fonds' },
  { value: 'klein', label: 'Klein fonds' },
];

export async function haalFondsOmvangKeuze(funderId) {
  if (!supabase || !funderId) return { keuze: null, error: 'geen' };

  const { data, error } = await supabase.rpc('admin_fonds_omvang', { p_funder_id: funderId });

  return { keuze: error ? null : data || 'auto', error: error ? error.message : null };
}

export async function zetFondsOmvangKeuze(funderId, keuze) {
  if (!supabase || !funderId) return { ok: false };

  const { error } = await supabase.rpc('admin_zet_fonds_omvang', { p_funder_id: funderId, p_omvang: keuze });

  return { ok: !error, error: error ? error.message : null };
}
