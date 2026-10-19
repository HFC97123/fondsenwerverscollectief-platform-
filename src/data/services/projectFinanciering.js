// Projectfinanciering (Pro/Premium): de financieringsregels van een project, opgeslagen in
// subsidie_kompas_program_funding. Dit is de ENIGE bron voor regels, statussen, bedragen,
// eigen deadlines, herinneringen en notities. Projectgegevens blijven in subsidie_kompas_programs
// (projecten.js); er wordt hier niets van een project, fonds of regeling gekopieerd.
//
// Lezen loopt uitsluitend via de database-functie kompas_dekkingsplan(p_program_id): die controleert
// het projecteigenaarschap en maskeert bronnen die buiten het abonnement vallen. Schrijven gaat
// rechtstreeks op de tabel (RLS + triggers + column-grants dwingen af wat mag).
import { supabase } from '../client.js';
import { isEchtId } from './projecten.js';

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

// De migratie is mogelijk nog niet toegepast: dat is een andere melding dan een gewone fout.
function isNietBeschikbaar(error) {
  const tekst = `${error?.code || ''} ${error?.message || ''}`;

  return /PGRST202|PGRST204|PGRST205|42883|42703|42P01|does not exist|schema cache|Could not find/i.test(tekst);
}

// Fout van een insert -> reden voor de interface. 23505 = bestaat al (unieke index); 42501 = geen recht (RLS of abonnement);
// 23514 = de database wijst de invoer af; ontbrekende kolom of functie = de voorstel-migratie is nog niet toegepast.
function redenVoorInsertFout(error) {
  if (error?.code === '23505') return 'bestaat-al';
  if (error?.code === '42501') return 'niet-toegestaan';
  if (error?.code === '23514') return 'ongeldig';
  if (isNietBeschikbaar(error)) return 'niet-beschikbaar';

  return 'fout';
}

// Voorstelmetadata per financieringsregel van een eigen project (gemaskeerd naar het abonnement door de database).
// ALLEEN LEZEN. De client schrijft nooit voorstelmetadata: de kolom is voor `authenticated` niet te lezen of te schrijven en wordt
// uitsluitend door de server gezet (Optie B, server-owned verificatie).
// Bestaat de RPC nog niet (migratie niet toegepast), dan is dat 'niet-beschikbaar' en werkt de rest gewoon.
// -> { meta: { [fundingId]: object } | null, error: null | 'geen-sessie' | 'niet-beschikbaar' | 'fout' }
export async function haalVoorstelMetadata(projectId) {
  if (!supabase || !isEchtId(projectId)) {
    return { meta: null, error: 'geen-sessie' };
  }

  try {
    const { data, error } = await supabase.rpc('kompas_voorstel_metadata', { p_program_id: projectId });

    if (error) {
      return { meta: null, error: isNietBeschikbaar(error) ? 'niet-beschikbaar' : 'fout' };
    }

    const meta = {};

    (Array.isArray(data) ? data : []).forEach((r) => {
      if (r && r.funding_id && r.voorstel && typeof r.voorstel === 'object') meta[r.funding_id] = r.voorstel;
    });

    return { meta, error: null };
  } catch (e) {
    return { meta: null, error: 'fout' };
  }
}

// -> { regels: Rij[] | null, error: null | 'geen-sessie' | 'niet-beschikbaar' | 'fout' }
export async function haalDekkingsplan(projectId) {
  if (!supabase || !isEchtId(projectId)) {
    return { regels: null, error: 'geen-sessie' };
  }

  try {
    const { data, error } = await supabase.rpc('kompas_dekkingsplan', { p_program_id: projectId });

    if (error) {
      return { regels: null, error: isNietBeschikbaar(error) ? 'niet-beschikbaar' : 'fout' };
    }

    return { regels: Array.isArray(data) ? data : [], error: null };
  } catch (e) {
    return { regels: null, error: 'fout' };
  }
}

// Voegt één regel toe: óf een regeling (schemeId) óf een fonds (funderId).
// -> { ok: true, id } | { ok: false, reden: 'bestaat-al' | 'geen-sessie' | 'ongeldig' | 'fout' }
export async function voegRegelToe({ projectId, schemeId = null, funderId = null, requested = null, status = 'interesting' }) {
  const userId = await huidigeGebruiker();

  if (!userId || !supabase) {
    return { ok: false, reden: 'geen-sessie' };
  }

  if (!isEchtId(projectId) || (!!schemeId === !!funderId)) {
    return { ok: false, reden: 'ongeldig' };
  }

  const { data, error } = await supabase
    .from('subsidie_kompas_program_funding')
    .insert({
      user_id: userId,
      program_id: projectId,
      scheme_id: schemeId || null,
      funder_id: funderId || null,
      requested_amount: requested,
      status,
    })
    .select('id')
    .single();

  if (error) {
    return { ok: false, reden: redenVoorInsertFout(error) };
  }

  return { ok: true, id: data?.id || null };
}

// Voegt een cofinancier of andere financiering toe op naam (financier_naam), zonder verwijzing naar
// een fonds of regeling uit de catalogus. Bij status 'awarded' staat het bedrag in awarded_amount,
// anders in requested_amount. Dezelfde naam twee keer in één project kan niet (unieke index).
// -> { ok: true, id } | { ok: false, reden: 'bestaat-al' | 'geen-sessie' | 'ongeldig' | 'fout' }
export async function voegFinancierToe({ projectId, naam, bedrag = null, status = 'submitted', deadline = null, notitie = '' }) {
  const userId = await huidigeGebruiker();

  if (!userId || !supabase) {
    return { ok: false, reden: 'geen-sessie' };
  }

  const schoon = String(naam == null ? '' : naam).trim();

  if (!isEchtId(projectId) || !schoon || schoon.length > 200 || ['interesting', 'preparing', 'submitted', 'awarded', 'rejected'].indexOf(status) === -1) {
    return { ok: false, reden: 'ongeldig' };
  }

  const { data, error } = await supabase
    .from('subsidie_kompas_program_funding')
    .insert({
      user_id: userId,
      program_id: projectId,
      financier_naam: schoon,
      requested_amount: status === 'awarded' ? null : bedrag,
      awarded_amount: status === 'awarded' ? bedrag : null,
      status,
      // Eigen deadline alleen waar die logisch is (niet bij Toegekend/Afgewezen) en alleen als echte datum.
      eigen_deadline: ['interesting', 'preparing', 'submitted'].indexOf(status) !== -1 && /^\d{4}-\d{2}-\d{2}$/.test(String(deadline || '')) ? deadline : null,
      notes: String(notitie || '').trim().slice(0, 4000) || null,
    })
    .select('id')
    .single();

  if (error) {
    return { ok: false, reden: redenVoorInsertFout(error) };
  }

  return { ok: true, id: data?.id || null };
}

// Wijzigt de velden die van het lid zijn (zie patchVoorDatabase in financiering/dekkingsplan.js).
export async function werkRegelBij(regelId, databasePatch) {
  const userId = await huidigeGebruiker();

  if (!userId || !supabase || !isEchtId(regelId)) {
    return { ok: false };
  }

  const { error } = await supabase.from('subsidie_kompas_program_funding').update(databasePatch).eq('id', regelId).eq('user_id', userId);

  return { ok: !error };
}

export async function verwijderRegel(regelId) {
  const userId = await huidigeGebruiker();

  if (!userId || !supabase || !isEchtId(regelId)) {
    return { ok: false };
  }

  // Taken die Subsidie Kompas bij dit fonds in het actieplan zette en nog open staan, gaan mee weg. Zelf toegevoegde taken en afgeronde
  // taken blijven staan (de database koppelt ze dan los van het fonds). Lukt dit niet, dan gaat het verwijderen van de regel gewoon door.
  await supabase
    .from('subsidie_kompas_program_actions')
    .delete()
    .eq('funding_id', regelId)
    .eq('user_id', userId)
    .eq('source', 'chat')
    .neq('status', 'done');

  const { error } = await supabase.from('subsidie_kompas_program_funding').delete().eq('id', regelId).eq('user_id', userId);

  return { ok: !error };
}
