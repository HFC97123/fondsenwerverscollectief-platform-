// Organisatiedocumenten (Pro/Premium): beleidsplan, jaarverslag, projectplan,
// meerjarenstrategie, begroting, impactrapport, evaluaties. Dit is een ander
// concept dan de documenten per project (zie projecten.js) of de door de AI
// gegenereerde documenten op de Documentatie-pagina - deze horen bij de
// organisatie als geheel (organization_id gezet, program_id leeg) en worden
// gebruikt om het organisatieprofiel aan te vullen (na goedkeuring, zie
// organisatieprofiel.js's bewaarOrganisatieVelden met sourceType 'document').
//
// Bestanden zelf staan in de privé Storage-bucket
// 'subsidie-kompas-organisatie-docs', per gebruiker in een eigen map
// ({user_id}/...) - zie de RLS-policy op storage.objects.
import { supabase } from '../client.js';

const BUCKET = 'subsidie-kompas-organisatie-docs';

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

// Zelfde patroon als in projecten.js: een document hangt verplicht aan een
// organisatie; is er nog geen organisatieprofiel, dan wordt er een naamloze
// organisatie aangemaakt zodat het eerste document toch bewaard kan worden.
async function huidigeOfNieuweOrganisatie(userId) {
  const { data: bestaand } = await supabase
    .from('subsidie_kompas_organizations')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (bestaand?.id) {
    return bestaand.id;
  }

  const { data: nieuw, error } = await supabase
    .from('subsidie_kompas_organizations')
    .insert({ user_id: userId, organization_name: 'Naamloze organisatie' })
    .select('id')
    .single();

  return error ? null : nieuw.id;
}

function naarDocVeld(rij) {
  return {
    id: rij.id,
    naam: rij.file_name || rij.title || 'Document',
    soort: rij.notes || 'Overig',
    mimeType: rij.mime_type || '',
    pad: rij.storage_path || '',
    tekst: rij.extracted_text || '',
    aangemaakt: rij.created_at,
  };
}

// Geeft een array documenten terug, of null zonder sessie/database (dan
// toont de pagina gewoon geen lijst - er is hier geen localStorage-alternatief
// voor echte bestanden).
export async function haalOrganisatieDocumentenOp() {
  const userId = await huidigeGebruiker();

  if (!userId || !supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('subsidie_kompas_knowledge_items')
    .select('id, file_name, title, notes, mime_type, storage_path, extracted_text, created_at')
    .eq('user_id', userId)
    .is('program_id', null)
    .order('created_at', { ascending: false });

  if (error) {
    return null;
  }

  return (data || []).map(naarDocVeld);
}

// Upload + registratie in één stap. 'soort' is de door de gebruiker gekozen
// documentsoort (beleidsplan, jaarverslag, ...), 'tekst' is de client-side
// geëxtraheerde inhoud (zie documentExtractie.js), gebruikt voor de
// AI-analyse en later voor de chat-achtergrond.
export async function uploadOrganisatieDocument({ file, soort, tekst }) {
  const userId = await huidigeGebruiker();

  if (!userId || !supabase) {
    return { id: null, error: 'geen-sessie' };
  }

  const organizationId = await huidigeOfNieuweOrganisatie(userId);

  if (!organizationId) {
    return { id: null, error: 'kon-organisatie-niet-aanmaken' };
  }

  const pad = `${userId}/${Date.now()}-${file.name}`;

  const { error: uploadFout } = await supabase.storage.from(BUCKET).upload(pad, file, { upsert: false });

  if (uploadFout) {
    return { id: null, error: uploadFout.message };
  }

  const { data: rij, error: dbFout } = await supabase
    .from('subsidie_kompas_knowledge_items')
    .insert({
      user_id: userId,
      organization_id: organizationId,
      program_id: null,
      title: file.name,
      file_name: file.name,
      mime_type: file.type || null,
      storage_path: pad,
      notes: soort || null,
      extracted_text: tekst || null,
      source_type: 'upload',
      status: 'ready',
    })
    .select('id')
    .single();

  if (dbFout) {
    await supabase.storage.from(BUCKET).remove([pad]);

    return { id: null, error: dbFout.message };
  }

  return { id: rij.id, pad, error: null };
}

export async function verwijderOrganisatieDocument(id, pad) {
  const userId = await huidigeGebruiker();

  if (!userId || !supabase) {
    return false;
  }

  if (pad) {
    await supabase.storage.from(BUCKET).remove([pad]);
  }

  const { error } = await supabase
    .from('subsidie_kompas_knowledge_items')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  return !error;
}
