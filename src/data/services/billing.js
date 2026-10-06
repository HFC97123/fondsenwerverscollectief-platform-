// Abonnementen. Stripe loopt via Edge Functions, nooit via de browser:
// geheime sleutels horen daar niet.
//
// Functies:
//   create-checkout-session  { plan: 'PRO'|'PREMIUM', voorwaarden_akkoord: true } -> { url }
//                            afrekenpagina openen. De SERVER bepaalt trial ja/nee,
//                            prijs en alle rechten; de client stuurt alleen de keuze.
//                            (aangesloten op de abonneren-pagina via startCheckout)
//   stripe-portal    {}       -> { url }        abonnement beheren of opzeggen
//                            (nog te zetten)
//
// Bestaat een functie nog niet, dan komt er een nette melding terug en gebeurt
// er niets. De frontend blijft werken.
import { supabase } from '../client.js';

const GEEN_KOPPELING =
  'Afrekenen is nog niet beschikbaar. Neem contact op en wij zetten uw abonnement voor u klaar.';

const CHECKOUT_FOUT =
  'Het openen van de betaalpagina is niet gelukt. Er is niets in rekening gebracht en uw account is niet gewijzigd. Probeer het zo opnieuw.';

const SESSIE_VERLOPEN =
  'Uw sessie is verlopen. Log opnieuw in om verder te gaan; uw keuze is onthouden. Er is niets in rekening gebracht.';

const AKKOORD_VEREIST = 'Ga akkoord met de voorwaarden om verder te gaan.';

// De enige host waar een Stripe Checkout Session staat. Een adres dat hier niet
// aan voldoet wordt nooit geopend, hoe het ook is binnengekomen.
const STRIPE_CHECKOUT_HOST = 'checkout.stripe.com';

// Navigatie naar Stripe in één kleine, vervangbare stap (tests onderscheppen
// die; in de browser is dit een gewone paginanavigatie).
export const navigatie = {
  naar(url) {
    window.location.assign(url);
  },
};

// Alleen een https-adres op checkout.stripe.com, zonder ingebedde inloggegevens.
export function isStripeCheckoutUrl(waarde) {
  if (typeof waarde !== 'string') {
    return false;
  }

  try {
    const u = new URL(waarde);

    return u.protocol === 'https:' && u.hostname === STRIPE_CHECKOUT_HOST && !u.username && !u.password;
  } catch (e) {
    return false;
  }
}

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

// Leest status, code en (eigen, Nederlandstalige) melding uit een mislukte
// Edge Function-aanroep. Een melding wordt alleen overgenomen als de body van
// onze eigen functie komt ({ error: string }); gateway-berichten niet.
async function leesFunctieFout(error) {
  const respons = error && error.context;
  const status = respons && typeof respons.status === 'number' ? respons.status : null;
  let body = null;

  try {
    if (respons && typeof respons.json === 'function') {
      body = await respons.json();
    }
  } catch (e) {
    body = null;
  }

  return {
    status,
    code: body && typeof body.code === 'string' ? body.code : null,
    melding: body && typeof body.error === 'string' ? body.error.slice(0, 300) : null,
  };
}

// Start het afrekenen voor Pro of Premium ('PRO' of 'PREMIUM'). Er wordt
// uitsluitend de keuze en het akkoord met de voorwaarden meegestuurd; of er een
// gratis proefperiode is, de prijs en alle rechten bepaalt de server (Stripe).
// Zonder akkoord gebeurt er niets: geen aanroep, geen Checkout.
//
// Uitkomst: { url, error, code, status }. Bij succes is `url` het adres van de
// Stripe Checkout Session (alleen na validatie) en is de browser al onderweg
// ernaartoe. Dit schrijft nooit tier, toegang of proefgegevens.
export async function startCheckout(plan, { voorwaardenAkkoord = false } = {}) {
  const fout = (error, code, status = null) => ({ url: null, error, code, status });

  if (plan !== 'PRO' && plan !== 'PREMIUM') {
    return fout(CHECKOUT_FOUT, 'ongeldig_plan');
  }

  if (voorwaardenAkkoord !== true) {
    return fout(AKKOORD_VEREIST, 'akkoord_vereist');
  }

  if (!supabase) {
    return fout(GEEN_KOPPELING, 'niet_geconfigureerd');
  }

  let data = null;
  let error = null;

  try {
    ({ data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: { plan, voorwaarden_akkoord: true },
    }));
  } catch (e) {
    error = e || new Error('Aanroep mislukt.');
  }

  if (error) {
    const { status, code, melding } = await leesFunctieFout(error);

    if (status === 401) {
      return fout(SESSIE_VERLOPEN, 'niet_ingelogd', 401);
    }

    return fout(melding || CHECKOUT_FOUT, code || 'checkout_mislukt', status);
  }

  const url = data && data.url;

  if (!isStripeCheckoutUrl(url)) {
    return fout(CHECKOUT_FOUT, 'ongeldige_url');
  }

  navigatie.naar(url);

  return { url, error: null, code: null, status: 200 };
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
