// Stukken voor fondsenwerving die het lid zelf heeft afgevinkt (tabel subsidie_kompas_stukken_afgevinkt).
// Alleen een kennisgeving voor het lid: 'dit stuk heb ik'. programId null = organisatiestuk, anders een projectstuk.
// Lukt de database niet (offline, tabel nog niet aanwezig), dan werkt de checklist gewoon zonder deze vinkjes.
import { supabase } from '../client.js';

export const sleutelAfgevinkt = (programId, stukId) => `${programId || 'org'}:${stukId}`;

async function gebruiker() {
  if (!supabase) return null;

  try {
    const { data } = await supabase.auth.getUser();

    return data?.user?.id || null;
  } catch (e) {
    return null;
  }
}

// -> Set met sleutels 'org:jaarrekening', '<projectId>:begroting', ...
export async function haalAfgevinkt() {
  const userId = await gebruiker();

  if (!userId) return new Set();

  try {
    const { data, error } = await supabase.from('subsidie_kompas_stukken_afgevinkt').select('program_id, stuk_id').eq('user_id', userId);

    if (error) return new Set();

    return new Set((data || []).map((r) => sleutelAfgevinkt(r.program_id, r.stuk_id)));
  } catch (e) {
    return new Set();
  }
}

export async function zetAfgevinkt({ programId = null, stukId, aan }) {
  const userId = await gebruiker();

  if (!userId || !stukId) return { ok: false };

  try {
    if (aan) {
      const { error } = await supabase.from('subsidie_kompas_stukken_afgevinkt').insert({ user_id: userId, program_id: programId || null, stuk_id: stukId });

      // Al afgevinkt (unieke sleutel) telt als gelukt.
      return { ok: !error || error.code === '23505' };
    }

    let q = supabase.from('subsidie_kompas_stukken_afgevinkt').delete().eq('user_id', userId).eq('stuk_id', stukId);

    q = programId ? q.eq('program_id', programId) : q.is('program_id', null);

    const { error } = await q;

    return { ok: !error };
  } catch (e) {
    return { ok: false };
  }
}
