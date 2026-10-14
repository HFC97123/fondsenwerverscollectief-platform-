// Actieplan (Pro/Premium): de opgeslagen taken van een project, in subsidie_kompas_program_actions. Geen bedragen, geen
// kopie van fondsgegevens (zie financiering/actieplan.js voor de logica). Schrijven loopt rechtstreeks op de tabel
// (RLS, triggers en kolomrechten dwingen af wat mag). Is de migratie nog niet toegepast, dan geeft elke functie
// 'niet-beschikbaar' en blijft de rest van de app gewoon werken.
import { supabase } from '../client.js';
import { isEchtId } from './projecten.js';
import { actieUitRij, patchVoorActie, valideerActie } from '../../features/kompas-app/financiering/actieplan.js';

const TABEL = 'subsidie_kompas_program_actions';

async function huidigeGebruiker() {
  if (!supabase) {
    return null;
  }

  try {
    const { data } = await supabase.auth.getUser();

    return data?.user?.id || null;
  } catch (e) {
    return null;
  }
}

function isNietBeschikbaar(error) {
  const t = `${error?.code || ''} ${error?.message || ''}`;

  return /PGRST205|42P01|does not exist|schema cache|Could not find/i.test(t);
}

// -> { acties: object[] | null, error: null | 'geen-sessie' | 'niet-beschikbaar' | 'fout' }
export async function haalActies(projectIds) {
  const ids = (projectIds || []).filter(isEchtId);

  if (!supabase || !ids.length) {
    return { acties: null, error: 'geen-sessie' };
  }

  try {
    const { data, error } = await supabase.from(TABEL).select('*').in('program_id', ids).order('created_at', { ascending: true });

    if (error) {
      return { acties: null, error: isNietBeschikbaar(error) ? 'niet-beschikbaar' : 'fout' };
    }

    return { acties: (Array.isArray(data) ? data : []).map(actieUitRij), error: null };
  } catch (e) {
    return { acties: null, error: 'fout' };
  }
}

// invoer: { projectId, titel, financier, deadline, prioriteit, notitie, fundingId, bron: 'user' | 'chat' }
// -> { ok: true, actie } | { ok: false, reden: 'ongeldig' | 'geen-sessie' | 'niet-beschikbaar' | 'fout', fout? }
export async function voegActieToe(invoer) {
  const userId = await huidigeGebruiker();

  if (!userId || !supabase) {
    return { ok: false, reden: 'geen-sessie' };
  }

  const geldig = valideerActie(invoer);

  if (!isEchtId(invoer.projectId) || !geldig.ok) {
    return { ok: false, reden: 'ongeldig', fout: geldig.ok ? '' : geldig.fout };
  }

  const w = geldig.waarde;
  const vanChat = invoer.bron === 'chat';
  const { data, error } = await supabase
    .from(TABEL)
    .insert({
      user_id: userId,
      program_id: invoer.projectId,
      funding_id: isEchtId(invoer.fundingId) ? invoer.fundingId : null,
      title: w.titel,
      financier_label: w.financier || null,
      due_date: w.deadline || null,
      priority: w.prioriteit,
      notes: w.notitie || null,
      status: 'todo',
      source: vanChat ? 'chat' : 'user',
      proposed_at: vanChat ? new Date().toISOString() : null,
    })
    .select('*')
    .single();

  if (error) {
    return { ok: false, reden: isNietBeschikbaar(error) ? 'niet-beschikbaar' : 'fout' };
  }

  return { ok: true, actie: actieUitRij(data) };
}

export async function werkActieBij(id, wijziging) {
  const userId = await huidigeGebruiker();
  const patch = patchVoorActie(wijziging);

  if (!userId || !supabase || !isEchtId(id) || !Object.keys(patch).length) {
    return { ok: false };
  }

  const { error } = await supabase.from(TABEL).update(patch).eq('id', id).eq('user_id', userId);

  return { ok: !error };
}

export async function verwijderActie(id) {
  const userId = await huidigeGebruiker();

  if (!userId || !supabase || !isEchtId(id)) {
    return { ok: false };
  }

  const { error } = await supabase.from(TABEL).delete().eq('id', id).eq('user_id', userId);

  return { ok: !error };
}
