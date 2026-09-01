// Onboardinginformatie en losse productaankopen. Bewust twee losse
// servicebestanden-achtige exports in één klein bestand, en bewust los van
// profile.js/AuthProvider: dit zijn beide dingen die NOOIT bepalen of iemand
// toegang krijgt, alleen extra informatie op en over het account.
import { supabase } from '../client.js';

const ONBOARDING_FIELDS = 'user_id, organisatie, functie, waar_naar_op_zoek, doel, overgeslagen, created_at, updated_at';

// Onboardingantwoorden van de ingelogde gebruiker ophalen. Bestaan ze nog
// niet (nooit ingevuld, ook niet overgeslagen), dan komt er null terug —
// dat blokkeert nergens iets, het is puur informatief.
export async function haalOnboarding(userId) {
  if (!userId || !supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('profile_onboarding')
      .select(ONBOARDING_FIELDS)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  } catch (e) {
    return null;
  }
}

// Onboardingantwoorden bewaren (of overslaan). Upsert: bij een tweede keer
// invullen (bijvoorbeeld later alsnog vanaf de accountpagina) wordt het
// bestaande antwoord bijgewerkt in plaats van een dubbele rij aan te maken.
export async function bewaarOnboarding(userId, antwoorden) {
  if (!userId || !supabase) {
    return { fout: 'Nu niet beschikbaar.' };
  }

  try {
    const { error } = await supabase.from('profile_onboarding').upsert({
      user_id: userId,
      organisatie: (antwoorden && antwoorden.organisatie) || null,
      functie: (antwoorden && antwoorden.functie) || null,
      waar_naar_op_zoek: (antwoorden && antwoorden.waarNaarOpZoek) || null,
      doel: (antwoorden && antwoorden.doel) || null,
      overgeslagen: Boolean(antwoorden && antwoorden.overgeslagen),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      throw error;
    }

    return { fout: null };
  } catch (e) {
    return { fout: String((e && e.message) || 'De gegevens konden niet worden bewaard.') };
  }
}

// Losse, eenmalige productaankopen (cursussen, templates, downloads) —
// technisch volledig los van het SaaS-abonnement. Schrijven gebeurt
// uitsluitend door een beheerder via de admin_grant_purchase-RPC; hier
// alleen lezen, voor de accountpagina van de gebruiker zelf.
export async function haalAankopen(userId) {
  if (!userId || !supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('product_aankopen')
      .select('id, product_type, product_naam, bedrag, aangeschaft_op')
      .eq('user_id', userId)
      .order('aangeschaft_op', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  } catch (e) {
    return [];
  }
}
