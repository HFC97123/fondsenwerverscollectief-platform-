// Abonnementen. Stripe loopt via Edge Functions, nooit via de browser:
// geheime sleutels horen daar niet.
//
// Verwachte functies (nog te zetten):
//   stripe-checkout  { tier } -> { url }        afrekenpagina openen
//   stripe-portal    {}       -> { url }        abonnement beheren of opzeggen
//
// Bestaat een functie nog niet, dan komt er een nette melding terug en gebeurt
// er niets. De frontend blijft werken.
import { supabase } from '../client.js';

const GEEN_KOPPELING =
  'Afrekenen is nog niet beschikbaar. Neem contact op en wij zetten uw abonnement voor u klaar.';

export const TIERS = ['free', 'pro', 'premium'];

export const TIER_LABEL = { free: 'Free', pro: 'Pro', premium: 'Premium' };

async function roepAan(functie, body) {
  if (!supabase) {
    return { url: null, error: GEEN_KOPPELING };
  }

  try {
    const { data, error } = await supabase.functions.invoke(functie, { body: body || {} });

    if (error || !data || !data.url) {
      throw error || new Error('Geen adres ontvangen.');
    }

    return { url: data.url, error: null };
  } catch (e) {
    return { url: null, error: GEEN_KOPPELING };
  }
}

// Start het afrekenen voor Pro of Premium.
export async function startCheckout(tier) {
  const res = await roepAan('stripe-checkout', { tier });

  if (res.url) {
    window.location.href = res.url;
  }

  return res;
}

// Opent het beheerscherm van Stripe: betaalwijze wijzigen, facturen, opzeggen.
export async function openBeheerportaal() {
  const res = await roepAan('stripe-portal');

  if (res.url) {
    window.location.href = res.url;
  }

  return res;
}
