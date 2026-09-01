// Het profiel van het ingelogde lid, één keer opgehaald en gedeeld.
// AuthProvider en WebsiteProvider vragen het beide op; deze cache voorkomt dat
// dat twee aanroepen worden.
import { supabase } from '../client.js';

export const PROFILE_FIELDS = `
  id, first_name, last_name, email, member_type, motivation, status, role,
  created_at, approved_at, approved_by, subscription_tier, subscription_active,
  trial_started_at, trial_ends_at, subscription_started_at, subscription_ends_at,
  stripe_customer_id, stripe_subscription_id
`;

// Wat elk pakket mag. Eén definitie voor de hele app; nergens anders een kopie.
export const PLAN_PERMISSIONS = {
  free: {
    history: false,
    word: false,
    pdf: false,
    excel: false,
    uploads: false,
    knowledgeBase: false,
    privateDatabase: false,
    organizationMemory: false,
    customBranding: false,
  },
  pro: {
    history: true,
    word: true,
    pdf: true,
    excel: true,
    uploads: true,
    knowledgeBase: false,
    privateDatabase: false,
    organizationMemory: false,
    customBranding: true,
  },
  premium: {
    history: true,
    word: true,
    pdf: true,
    excel: true,
    uploads: true,
    knowledgeBase: true,
    privateDatabase: true,
    organizationMemory: true,
    customBranding: true,
  },
};

export function rechtenVan(tier) {
  return PLAN_PERMISSIONS[tier] || PLAN_PERMISSIONS.free;
}

const cache = new Map();
const pending = new Map();

export async function haalProfiel(userId, { vers = false } = {}) {
  if (!userId || !supabase) {
    return null;
  }

  if (!vers && cache.has(userId)) {
    return cache.get(userId);
  }

  if (pending.has(userId)) {
    return pending.get(userId);
  }

  const belofte = (async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(PROFILE_FIELDS)
        .eq('id', userId)
        .single();

      if (error) {
        throw error;
      }

      cache.set(userId, data);

      return data;
    } catch (e) {
      return null;
    } finally {
      pending.delete(userId);
    }
  })();

  pending.set(userId, belofte);

  return belofte;
}

export function wisProfielCache(userId) {
  if (userId) {
    cache.delete(userId);
  } else {
    cache.clear();
  }
}

// Bepaalt het pakket uit het profiel. Pro en Premium gelden bij een actief
// (betaald) abonnement OF een nog lopende proefperiode — één regel, op één
// plek, en exact dezelfde voorwaarde als current_user_has_pro_access() /
// current_user_has_premium_access() in de database. Zonder deze
// trial-check zou een gebruiker met een lopende proefperiode aan de
// serverkant (RLS/views) al wel Pro/Premium-content krijgen, maar in de
// front-end nog als Free worden getoond — precies het soort losse,
// afwijkende check dat we willen voorkomen.
export function tierVan(profiel) {
  const ruw = (profiel && profiel.subscription_tier) || 'free';

  if (ruw !== 'pro' && ruw !== 'premium') {
    return 'free';
  }

  const actief = profiel && profiel.subscription_active === true;

  return actief || proefActiefVan(profiel) ? ruw : 'free';
}

// Is er een lopende (nog niet verstreken) proefperiode? Een actief betaald
// abonnement telt hier niet als "proef" (dan is de proefperiode al
// overgegaan in een echt abonnement, of nooit relevant geweest).
export function proefActiefVan(profiel) {
  if (!profiel || profiel.subscription_active === true) {
    return false;
  }

  const eind = profiel.trial_ends_at;

  return Boolean(eind) && new Date(eind).getTime() > Date.now();
}

/* ---- Aanmelden en afmelden ----
   Eén implementatie, gedeeld door AuthProvider en WebsiteProvider. Die twee
   houden elk hun eigen toestand bij, maar de aanroep naar Supabase staat hier. */

export async function inloggen(email, wachtwoord) {
  if (!supabase) {
    return { data: null, fout: 'Inloggen is nu niet beschikbaar.' };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(email || '')
        .trim()
        .toLowerCase(),
      password: wachtwoord,
    });

    if (error) {
      throw error;
    }

    return { data, fout: null };
  } catch (e) {
    const melding = String((e && e.message) || '');

    return {
      data: null,
      fout: melding.toLowerCase().includes('invalid login')
        ? 'Dit e-mailadres of wachtwoord is niet juist.'
        : 'Inloggen is niet gelukt. Probeer het opnieuw.',
    };
  }
}

// Proefperiode starten (7 dagen Pro / 24 uur Premium). De duur en de
// eenmaligheid worden uitsluitend server-side afgedwongen (RPC
// start_trial, SECURITY DEFINER) — de client levert alleen het gewenste
// pakket aan, nooit een duur of geldigheid.
export async function startProefperiode(tier) {
  if (!supabase) {
    return { fout: 'Nu niet beschikbaar.' };
  }

  try {
    const { error } = await supabase.rpc('start_trial', { p_tier: tier });

    if (error) {
      throw error;
    }

    wisProfielCache();

    return { fout: null };
  } catch (e) {
    return { fout: String((e && e.message) || 'De proefperiode kon niet worden gestart.') };
  }
}

export async function uitloggen() {
  wisProfielCache();

  if (!supabase) {
    return;
  }

  try {
    await supabase.auth.signOut();
  } catch (e) {
    // de sessie is lokaal alsnog leeg
  }
}

