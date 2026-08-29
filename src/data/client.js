import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Zijn de variabelen niet gezet, dan blijft de client null en vallen alle
// services terug op een lege uitkomst. De frontend blijft dan gewoon werken.
export const isConfigured = Boolean(url && anonKey);

export const supabase = isConfigured ? createClient(url, anonKey) : null;

// Elke query loopt hierlangs. Ontbreekt de configuratie of faalt de aanroep,
// dan komt er een vaste uitkomst terug in plaats van een uitzondering.
export async function query(fn, fallback = null) {
  if (!supabase) {
    return { data: fallback, error: null, offline: true };
  }

  try {
    const res = await fn(supabase);

    if (res && res.error) {
      return { data: fallback, error: res.error, offline: false };
    }

    return { data: res && 'data' in res ? res.data : res, error: null, offline: false };
  } catch (e) {
    return { data: fallback, error: e, offline: false };
  }
}
