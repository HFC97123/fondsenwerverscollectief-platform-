// Definitieve documenten (Pro/Premium): een vaste kopie van het concept projectplan, de begroting of het dekkingsplan, gemaakt met "Maak definitief".
// Wijzigingen in het concept veranderen de definitieve versie niet. Opslag: subsidie_kompas_definitieve_documenten (RLS: het lid ziet en maakt alleen eigen rijen;
// de database telt het versienummer per project en soort).
import { supabase } from '../client.js';

const TABEL = 'subsidie_kompas_definitieve_documenten';
export const DEFINITIEF_SOORTEN = ['projectplan', 'begroting', 'dekkingsplan', 'samengevoegd'];

async function huidigeGebruiker() {
  if (!supabase) return null;

  try {
    const { data } = await supabase.auth.getUser();

    return data?.user?.id || null;
  } catch (e) {
    return null;
  }
}

const naarRij = (r) => ({ id: r.id, projectId: r.program_id, soort: r.soort, naam: r.naam || '', versie: Number(r.versie) || 1, gemaakt: r.created_at || '' });

// De lijst (zonder de inhoud, die is groot) van de definitieve documenten van deze projecten, nieuwste eerst. Zonder sessie of tabel: een lege lijst.
export async function haalDefinitieveDocumenten(projectIds) {
  const ids = (Array.isArray(projectIds) ? projectIds : []).filter((x) => typeof x === 'string' && x);
  const userId = await huidigeGebruiker();

  if (!userId || !supabase || !ids.length) return [];

  try {
    const { data, error } = await supabase.from(TABEL).select('id, program_id, soort, naam, versie, created_at').eq('user_id', userId).in('program_id', ids).order('created_at', { ascending: false });

    return error || !Array.isArray(data) ? [] : data.map(naarRij);
  } catch (e) {
    return [];
  }
}

// Eén definitief document met zijn inhoud (voor openen en exporteren), of null.
export async function haalDefinitiefDocument(id) {
  const userId = await huidigeGebruiker();

  if (!userId || !supabase || !id) return null;

  try {
    const { data, error } = await supabase.from(TABEL).select('id, program_id, soort, naam, versie, inhoud, created_at').eq('user_id', userId).eq('id', id).maybeSingle();

    return error || !data ? null : { ...naarRij(data), inhoud: data.inhoud || {} };
  } catch (e) {
    return null;
  }
}

// -> { ok: true, id, versie } | { ok: false, reden: 'geen-sessie' | 'ongeldig' | 'niet-toegestaan' | 'fout' }
export async function maakDefinitief({ projectId, soort, naam, inhoud }) {
  const userId = await huidigeGebruiker();

  if (!userId || !supabase) return { ok: false, reden: 'geen-sessie' };
  if (!projectId || !DEFINITIEF_SOORTEN.includes(soort) || !inhoud || typeof inhoud !== 'object') return { ok: false, reden: 'ongeldig' };

  try {
    const { data, error } = await supabase.from(TABEL).insert({ user_id: userId, program_id: projectId, soort, naam: String(naam || '').slice(0, 160), inhoud }).select('id, versie').single();

    if (error || !data) return { ok: false, reden: error && (error.code === '42501' || error.code === 'PGRST301') ? 'niet-toegestaan' : 'fout' };

    return { ok: true, id: data.id, versie: Number(data.versie) || 1 };
  } catch (e) {
    return { ok: false, reden: 'fout' };
  }
}

export async function verwijderDefinitief(id) {
  const userId = await huidigeGebruiker();

  if (!userId || !supabase || !id) return { ok: false };

  try {
    const { error } = await supabase.from(TABEL).delete().eq('user_id', userId).eq('id', id);

    return { ok: !error };
  } catch (e) {
    return { ok: false };
  }
}
