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

// Bepaalt het pakket uit het profiel. Pro en Premium gelden alleen bij een
// actief abonnement — één regel, op één plek.
export function tierVan(profiel) {
  const ruw = (profiel && profiel.subscription_tier) || 'free';
  const actief = profiel && profiel.subscription_active === true;

  return (ruw === 'pro' || ruw === 'premium') && actief ? ruw : 'free';
}
