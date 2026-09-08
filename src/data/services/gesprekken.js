// Gesprekken (Pro/Premium), opgeslagen in subsidie_kompas_conversations +
// subsidie_kompas_messages. Voorheen probeerde workspace.js dit te bewaren in
// een tabel 'gesprekken' die niet bestaat (dood spoor, nooit aangeroepen
// vanuit de UI) - dit bestand vervangt dat spoor met de tabellen die wel
// bestaan en al correcte RLS hebben.
//
// Een gesprek is, in tegenstelling tot het organisatieprofiel/projecten
// (die als geheel worden bewaard/overschreven), een aanvullend logboek: er
// wordt per bericht toegevoegd in plaats van de hele lijst steeds te
// vervangen. De lijst gesprekken zelf wordt licht opgehaald (zonder
// berichten); de berichten van één gesprek worden pas geladen zodra het
// lid dat gesprek daadwerkelijk opent (haalBerichtenOp).
import { supabase } from '../client.js';

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

function naarGesprekVeld(rij) {
  return {
    id: rij.id,
    titel: rij.title || 'Gesprek',
    tijd: rij.updated_at,
    projectId: rij.active_program_id || null,
  };
}

// Geeft een array gesprekken terug (zonder berichten - zie haalBerichtenOp),
// of null zonder sessie/database (dan toont de pagina gewoon geen historie).
export async function haalGesprekkenOp() {
  const userId = await huidigeGebruiker();

  if (!userId || !supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('subsidie_kompas_conversations')
    .select('id, title, active_program_id, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    return null;
  }

  return (data || []).map(naarGesprekVeld);
}

export async function haalBerichtenOp(conversationId) {
  if (!supabase || !conversationId) {
    return [];
  }

  const { data, error } = await supabase
    .from('subsidie_kompas_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    return [];
  }

  return (data || []).map((m) => ({ role: m.role, content: m.content, fromUser: m.role === 'user' }));
}

// Maakt een nieuw gesprek aan - gebeurt op het eerste bericht van een nieuwe
// chat, niet vooraf, zodat er geen lege gesprekken ontstaan die het lid nooit
// echt is begonnen.
export async function maakGesprekAan({ titel, projectId }) {
  const userId = await huidigeGebruiker();

  if (!userId || !supabase) {
    return { id: null, error: 'geen-sessie' };
  }

  const { data, error } = await supabase
    .from('subsidie_kompas_conversations')
    .insert({
      user_id: userId,
      title: (titel || 'Gesprek').slice(0, 120),
      active_program_id: projectId || null,
    })
    .select('id')
    .single();

  return { id: error ? null : data.id, error: error ? error.message : null };
}

// Koppelt (of ontkoppelt met null) een gesprek aan een project - punt 6/7 uit
// het oorspronkelijke verzoek: de AI moet weten welk project bij welk
// gesprek hoort.
export async function koppelGesprekAanProject(conversationId, projectId) {
  if (!supabase || !conversationId) {
    return false;
  }

  const { error } = await supabase
    .from('subsidie_kompas_conversations')
    .update({ active_program_id: projectId || null, updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  return !error;
}

export async function voegBerichtToe({ conversationId, role, content, projectId }) {
  const userId = await huidigeGebruiker();

  if (!userId || !supabase || !conversationId) {
    return false;
  }

  const { error } = await supabase.from('subsidie_kompas_messages').insert({
    conversation_id: conversationId,
    user_id: userId,
    role,
    content,
    program_id: projectId || null,
  });

  if (!error) {
    // Best effort: laat de gesprekkenlijst op volgorde van laatste activiteit
    // staan. Mag falen zonder het bericht zelf ongedaan te maken.
    await supabase
      .from('subsidie_kompas_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);
  }

  return !error;
}

export async function verwijderGesprek(id) {
  const userId = await huidigeGebruiker();

  if (!userId || !supabase) {
    return false;
  }

  // messages.conversation_id staat op ON DELETE CASCADE - berichten hoeven
  // hier niet apart verwijderd te worden.
  const { error } = await supabase.from('subsidie_kompas_conversations').delete().eq('id', id).eq('user_id', userId);

  return !error;
}

export async function verwijderAlleGesprekken() {
  const userId = await huidigeGebruiker();

  if (!userId || !supabase) {
    return false;
  }

  const { error } = await supabase.from('subsidie_kompas_conversations').delete().eq('user_id', userId);

  return !error;
}
