// supabase/functions/stripe-portal/index.ts
//
// RC1 - Stripe Customer Portal (Sandbox-fase, 2026-10-07):
// server-side aanmaken van een Stripe Billing Portal Session, zodat een
// ingelogde gebruiker via de knop "Abonnement beheren" zijn abonnement bij
// Stripe kan beheren (betaalmethode, facturen, opzeggen).
//
// WAT DEZE FUNCTIE DOET:
//  - controleert de ingelogde gebruiker (server-side geverifieerde sessie);
//  - leest de stripe_customer_id UITSLUITEND uit het eigen profiel van die
//    gebruiker in de database (service-role, filter op user.id);
//  - maakt daarmee een Billing Portal Session aan met een vaste, server-side
//    return_url naar de accountpagina;
//  - geeft uitsluitend de (gevalideerde) Portal-url terug.
//
// WAT DEZE FUNCTIE NOOIT DOET:
//  - de request-body wordt NOOIT gelezen: een klant-id, return_url, user-id of
//    welk veld dan ook uit de browser heeft dus geen enkel effect;
//  - GEEN schrijfacties op de database (geen tier, toegang, status,
//    subscription-id, klant-id, trial: niets). Alleen een select op profiles;
//  - de redirect naar de Portal geeft of ontneemt GEEN rechten. Opzeggen,
//    wijzigen en betalingen worden door Stripe afgehandeld; de geverifieerde
//    stripe-webhook (customer.subscription.updated/deleted) blijft de enige
//    bron van waarheid voor toegang. Bij "opzeggen aan het einde van de
//    periode" blijft de toegang bestaan zolang Stripe de status trialing,
//    active of past_due meldt.
//
// Benodigde configuratie in Stripe (door de beheerder, per omgeving Sandbox of
// Live): Instellingen > Billing > Customer portal (standaardconfiguratie
// opslaan, opzeggen aanzetten). Zonder die configuratie weigert Stripe de
// sessie en geeft deze functie een nette 502.
//
// Secrets (alleen namen; waarden staan uitsluitend in de Supabase-secrets):
// STRIPE_SECRET_KEY, APP_BASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
//
// Deploy met verify_jwt=true (zoals create-checkout-session); de functie
// controleert de sessie daarnaast zelf via auth.getUser.
import Stripe from 'npm:stripe@^22';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// De enige host waarop een Stripe Billing Portal Session staat.
const PORTAL_HOST = 'billing.stripe.com';

function isVeiligePortalUrl(waarde: unknown): waarde is string {
  if (typeof waarde !== 'string') {
    return false;
  }

  try {
    const u = new URL(waarde);

    return u.protocol === 'https:' && u.hostname === PORTAL_HOST && !u.username && !u.password;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Methode niet toegestaan.' }, 405);
  }

  // --- Configuratie (alleen welke namen ontbreken wordt gelogd) -----------
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const appBaseUrl = Deno.env.get('APP_BASE_URL');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!stripeSecretKey || !appBaseUrl || !supabaseUrl || !serviceKey) {
    console.error('stripe-portal: ontbrekende configuratie', {
      hasStripeSecretKey: Boolean(stripeSecretKey),
      hasAppBaseUrl: Boolean(appBaseUrl),
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceKey: Boolean(serviceKey),
    });

    return json({ error: 'Het beheerscherm is niet geconfigureerd.' }, 500);
  }

  // --- 1. Authenticatie ---------------------------------------------------
  // user.id komt UITSLUITEND uit de server-side geverifieerde sessie.
  const authHeader = req.headers.get('Authorization') || '';

  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'Niet ingelogd.' }, 401);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: userData, error: userError } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
  const user = userData?.user;

  if (userError || !user) {
    return json({ error: 'Niet ingelogd.' }, 401);
  }

  // --- 2. Eigen profiel: de klant-id komt UITSLUITEND hieruit -------------
  // Bewust geen req.json(): niets uit het verzoek wordt gebruikt.
  const { data: profiel, error: profielError } = await admin
    .from('profiles')
    .select('id, stripe_customer_id')
    .eq('id', user.id)
    .single();

  if (profielError || !profiel) {
    console.error('stripe-portal: profiel ontbreekt of onleesbaar', profielError?.code ?? 'onbekend');

    return json(
      profielError?.code === 'PGRST116'
        ? { error: 'Uw account is niet volledig ingericht. Neem contact met ons op.', code: 'profiel_ontbreekt' }
        : { error: 'Uw profielgegevens konden niet worden geladen. Probeer het later opnieuw.', code: 'profiel_onleesbaar' },
      profielError?.code === 'PGRST116' ? 403 : 503,
    );
  }

  const klantId = typeof profiel.stripe_customer_id === 'string' ? profiel.stripe_customer_id : '';

  if (!/^cus_[A-Za-z0-9]+$/.test(klantId)) {
    // Geen (bruikbare) Stripe-klant: nog nooit afgerekend. Geen Portal, geen
    // Stripe-aanroep, geen klant aanmaken.
    return json(
      { error: 'Er is nog geen abonnement gekoppeld aan dit account, dus er valt niets te beheren.', code: 'geen_klant' },
      409,
    );
  }

  // --- 3. Billing Portal Session --------------------------------------------
  // return_url is volledig server-side bepaald: de accountpagina.
  const basis = appBaseUrl.replace(/\/+$/, '');

  try {
    const stripe = new Stripe(stripeSecretKey);
    const sessie = await stripe.billingPortal.sessions.create({
      customer: klantId,
      return_url: `${basis}/#/kompas/account`,
      locale: 'nl',
    });

    if (!isVeiligePortalUrl(sessie?.url)) {
      console.error('stripe-portal: Stripe gaf geen geldige portal-url terug');

      return json({ error: 'Het beheerscherm kon niet worden geopend. Probeer het later opnieuw.' }, 502);
    }

    // Uitsluitend de url; geen Stripe-geheimen of overige interne informatie.
    return json({ url: sessie.url });
  } catch (err) {
    console.error('stripe-portal: Stripe-fout bij aanmaken portal-sessie', String(err));

    return json({ error: 'Het beheerscherm kon niet worden geopend. Probeer het later opnieuw.' }, 502);
  }
});
