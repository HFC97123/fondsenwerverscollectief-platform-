// Abonnementen. Stripe loopt via Edge Functions, nooit via de browser:
// geheime sleutels horen daar niet.
//
// Verwachte functies (nog te zetten):
//   create-checkout-session  { plan: 'PRO'|'PREMIUM', voorwaarden_akkoord: true } -> { url }
//                            afrekenpagina openen. De SERVER bepaalt trial ja/nee,
//                            prijs en alle rechten; de client stuurt alleen de keuze.
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

// Start het afrekenen voor Pro of Premium ('PRO' of 'PREMIUM'). Er wordt
// uitsluitend de keuze en het akkoord met de voorwaarden meegestuurd; of er een
// gratis proefperiode is, de prijs en alle rechten bepaalt de server (Stripe).
// Nog niet aangesloten op de abonneren-pagina (volgende fase).
export async function startCheckout(plan, { voorwaardenAkkoord = false } = {}) {
  if (plan !== 'PRO' && plan !== 'PREMIUM') {
    return { url: null, error: GEEN_KOPPELING };
  }

  const res = await roepAan('create-checkout-session', { plan, voorwaarden_akkoord: voorwaardenAkkoord === true });

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

// Uitkomst van de Stripe-terugkeer (success_url/cancel_url bevatten
// ?checkout=success of ?checkout=cancelled na de hash-route). Dit is uitsluitend
// een melding aan de gebruiker: de terugkeer bewijst NIETS over de betaling en
// wijzigt nooit tier of toegang. Alleen die twee waarden worden herkend.
export function leesCheckoutResultaat() {
  try {
    const hash = window.location.hash || '';
    const q = hash.indexOf('?');

    if (q === -1) {
      return null;
    }

    const waarde = new URLSearchParams(hash.slice(q + 1)).get('checkout');

    return waarde === 'success' || waarde === 'cancelled' ? waarde : null;
  } catch (e) {
    return null;
  }
}

// Haalt de checkout-parameter uit de adresbalk, zodat een refresh de melding
// niet opnieuw toont. Gebruikt replaceState: geen navigatie, geen hashchange.
export function wisCheckoutResultaat() {
  try {
    const hash = window.location.hash || '';
    const q = hash.indexOf('?');

    if (q === -1) {
      return;
    }

    const params = new URLSearchParams(hash.slice(q + 1));
    params.delete('checkout');

    const rest = params.toString();
    const nieuweHash = hash.slice(0, q) + (rest ? `?${rest}` : '');

    window.history.replaceState(null, '', window.location.pathname + window.location.search + nieuweHash);
  } catch (e) {
    // melding blijft hooguit zichtbaar bij een refresh; geen verdere gevolgen
  }
}
