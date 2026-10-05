// supabase/functions/create-checkout-session/index.ts
//
// RC1 - K1 Payments, fase 8C (2026-10-04): server-side aanmaken van een
// Stripe Checkout Session voor een maandelijks Pro- of Premium-abonnement.
//
// BELANGRIJK - SCOPE VAN DEZE FUNCTIE (zie projectrapport fase 8C):
// Deze functie doet UITSLUITEND het veilig aanmaken van een Stripe Checkout
// Session. Ze schrijft GEEN abonnementstoegang: subscription_tier,
// subscription_active, subscription_status, subscription_current_period_end,
// subscription_cancel_at_period_end en stripe_subscription_id worden hier
// nooit aangeraakt of geschreven. De enige schrijfactie die deze functie mag
// uitvoeren is het eenmalig vastleggen van een nieuw aangemaakte
// stripe_customer_id - zie stap 5 hieronder. Een
// geslaagde redirect naar de success_url bewijst op zichzelf NOOIT dat er is
// betaald; echte toegangsactivatie gebeurt pas in een latere, apart
// geverifieerde webhook-functie (fase 8D) die de betaalstatus rechtstreeks
// van Stripe krijgt (serverzijdige signature-verificatie), nooit van een
// terugkerende browser.
//
// Deze functie raakt de bestaande supabase/functions/subsidie-kompas NIET
// aan en wordt bewust als volledig aparte Edge Function gedeployed (fase
// 8C, punt 2).
//
// Stripe SDK: officieel door Supabase gedocumenteerde, minimale import voor
// de Deno Edge Runtime (geen aparte httpClient-override of import_map
// nodig in de huidige stripe-node-major):
//   https://supabase.com/docs/guides/functions/examples/stripe-webhooks
import Stripe from 'npm:stripe@^22';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Zelfde CORS-conventie als de bestaande subsidie-kompas Edge Function
// (alleen POST + OPTIONS; deze functie kent geen andere methoden).
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

// Server-side prijsallowlist (fase 8C, punt 5): de client kan uitsluitend
// een tiernaam sturen, nooit een Stripe price-id, bedrag of valuta. De
// daadwerkelijke prijs-id's komen UITSLUITEND uit environment-secrets, zodat
// een gemanipuleerd verzoek nooit een ander product/bedrag kan afdwingen.
// Test-mode-only in fase 8C: deze secrets moeten in deze fase Stripe
// TEST-price-id's bevatten, nooit live-id's (zie faserapport, punt 15).
const TIER_PRICE_ENV: Record<'pro' | 'premium', string> = {
  pro: 'STRIPE_PRO_PRICE_ID',
  premium: 'STRIPE_PREMIUM_PRICE_ID',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Methode niet toegestaan.' }, 405);
  }

  // --- Configuratie --------------------------------------------------
  // Ontbreekt een van deze vier: de functie is niet bruikbaar. Geen
  // geheime waarden in foutmelding of logs - alleen welke namen ontbreken,
  // consistent met het bestaande patroon in subsidie-kompas/index.ts voor
  // OPENAI_API_KEY.
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const appBaseUrl = Deno.env.get('APP_BASE_URL');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!stripeSecretKey || !appBaseUrl || !supabaseUrl || !serviceKey) {
    console.error('create-checkout-session: ontbrekende configuratie', {
      hasStripeSecretKey: Boolean(stripeSecretKey),
      hasAppBaseUrl: Boolean(appBaseUrl),
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceKey: Boolean(serviceKey),
    });
    return json({ error: 'De betaalfunctie is niet geconfigureerd.' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceKey);

  // --- 1. Authenticatie (fase 8C, punt 3) ------------------------------
  // user.id komt UITSLUITEND uit de server-side geverifieerde sessie,
  // precies zoals in de bestaande subsidie-kompas Edge Function. Een
  // eventueel user_id-veld in de request-body wordt hieronder bewust nooit
  // gelezen of vertrouwd - er wordt verderop niet eens naar gezocht.
  const authHeader = req.headers.get('Authorization') || '';

  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'Niet ingelogd.' }, 401);
  }

  const { data: userData, error: userError } = await admin.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );
  const user = userData?.user;

  if (userError || !user) {
    return json({ error: 'Niet ingelogd.' }, 401);
  }

  // --- 2. Input (fase 8C, punt 4) ---------------------------------------
  // De client mag een tier meesturen; alleen 'pro' of 'premium' is geldig.
  // Eventuele andere velden (bedrag, valuta, price-id, customer-id,
  // subscription-id, user-id, subscription_active, subscription_status,
  // ...) worden hieronder nergens gelezen en hebben dus hoe dan ook geen
  // enkel effect, ook niet als een client ze toch meestuurt.
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return json({ error: 'Ongeldige aanvraag.' }, 400);
  }

  const tier = (body as { tier?: unknown } | null)?.tier;

  if (tier !== 'pro' && tier !== 'premium') {
    return json({ error: 'Ongeldig abonnementstype.' }, 400);
  }

  const priceEnvName = TIER_PRICE_ENV[tier];
  const priceId = Deno.env.get(priceEnvName);

  if (!priceId) {
    console.error(`create-checkout-session: ontbrekende prijsconfiguratie voor tier "${tier}" (${priceEnvName})`);
    return json({ error: 'De betaalfunctie is niet geconfigureerd.' }, 500);
  }

  const stripe = new Stripe(stripeSecretKey);

  // --- 3. Profiel ophalen (service-role; authenticated heeft zelf geen
  // UPDATE-recht op profiles, zie fase 8A/8B) --------------------------
  const { data: profiel, error: profielError } = await admin
    .from('profiles')
    .select('stripe_customer_id, stripe_subscription_id')
    .eq('id', user.id)
    .single();

  if (profielError || !profiel) {
    console.error('create-checkout-session: profiel niet gevonden', profielError?.message);
    return json({ error: 'Profiel niet gevonden.' }, 500);
  }

  // --- 4. Dubbel-abonnement-bescherming (fase 8C, punt 13) ---------------
  // Minimale, veilige regel: stripe_subscription_id is het enige veld dat
  // ooit aantoonbaar een bestaand, echt Stripe-abonnement vastlegt (zie
  // fase 8A/8B-analyse - vandaag wordt het nog door niets geschreven; dat
  // begint pas met de webhook in fase 8D, dus deze blokkade is op dit
  // moment nog inactief maar wel alvast correct aanwezig). subscription_
  // active alleen wordt hier bewust NIET gebruikt als blokkade: dat veld
  // kan ook true zijn voor een door een beheerder toegekend abonnement
  // zonder enig achterliggend Stripe-abonnement (admin_set_subscription),
  // en zou dan ten onrechte een eerste, legitieme Checkout blokkeren voor
  // iemand die nog nooit via Stripe heeft betaald.
  if (profiel.stripe_subscription_id) {
    return json(
      { error: 'Er is al een actief abonnement gekoppeld aan dit account.' },
      409,
    );
  }

  // --- 5. Stripe Customer: hergebruiken of veilig aanmaken (fase 8C,
  // punt 7) --------------------------------------------------------------
  let customerId: string | null = null;

  if (profiel.stripe_customer_id) {
    try {
      const existing = await stripe.customers.retrieve(profiel.stripe_customer_id);
      const isDeleted = (existing as { deleted?: boolean }).deleted === true;

      if (!isDeleted) {
        customerId = profiel.stripe_customer_id;
      }
    } catch (err) {
      // Bestaande id blijkt niet (meer) geldig bij Stripe - val terug op
      // nieuw aanmaken hieronder. Geen geheime informatie loggen.
      console.error('create-checkout-session: bestaande stripe_customer_id ongeldig bij Stripe', String(err));
    }
  }

  if (!customerId) {
    let created: Stripe.Customer;

    try {
      created = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
    } catch (err) {
      console.error('create-checkout-session: Stripe-fout bij aanmaken customer', String(err));
      return json({ error: 'Kon de betaalpagina niet aanmaken.' }, 502);
    }

    customerId = created.id;

    // Race-veilige schrijfactie: alleen wegschrijven als het veld nog
    // steeds leeg is. Verliest een gelijktijdig verzoek deze race, dan
    // wordt hieronder teruggevallen op de intussen al opgeslagen id, zodat
    // er nooit meer dan één stripe_customer_id per profiel blijvend wordt
    // vastgelegd. De net aangemaakte, dan ongebruikte Stripe Customer
    // blijft in dat zeldzame geval ongebruikt bij Stripe staan - geen
    // toegangsrisico, wel een kleine, bewust geaccepteerde inefficiëntie
    // (zie faserapport, punt 7).
    const { data: updated, error: updateError } = await admin
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id)
      .is('stripe_customer_id', null)
      .select('stripe_customer_id')
      .single();

    if (updateError || !updated) {
      const { data: herlezen } = await admin
        .from('profiles')
        .select('stripe_customer_id')
        .eq('id', user.id)
        .single();

      if (herlezen?.stripe_customer_id) {
        customerId = herlezen.stripe_customer_id;
      }
    }
  }

  // --- 6. Checkout Session (fase 8C, punten 8-9) -------------------------
  // success_url/cancel_url zijn volledig server-side bepaald (nooit uit de
  // request) en wijzen naar de bestaande, echte app-route '/kompas/account'
  // (zie src/app/routes.js). Een geslaagde redirect activeert op zichzelf
  // GEEN toegang - zie de scope-toelichting bovenaan dit bestand.
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appBaseUrl}/#/kompas/account?checkout=success`,
      cancel_url: `${appBaseUrl}/#/kompas/account?checkout=cancelled`,
      // Metadata op zowel de Checkout Session als subscription_data: de
      // latere webhook (fase 8D) moet de gebruiker en het gewenste tier
      // altijd rechtstreeks uit het Stripe-object kunnen afleiden, zonder
      // afhankelijk te zijn van onbetrouwbare clientgegevens.
      metadata: { supabase_user_id: user.id, tier },
      subscription_data: {
        metadata: { supabase_user_id: user.id, tier },
      },
      // Bewust GEEN trial_period_days: de bestaande, niet-Stripe-trial
      // (start_trial, fase 8A/8B) blijft volledig gescheiden van Stripe en
      // wordt door deze functie niet aangeraakt.
    });

    if (!session.url) {
      console.error('create-checkout-session: Stripe gaf geen url terug bij sessie aanmaken');
      return json({ error: 'Kon de betaalpagina niet aanmaken.' }, 502);
    }

    // --- 7. Respons (fase 8C, punt 10) ----------------------------------
    // Uitsluitend de Checkout-url; geen Stripe-geheimen of overige interne
    // informatie.
    return json({ url: session.url });
  } catch (err) {
    console.error('create-checkout-session: Stripe-fout bij sessie aanmaken', String(err));
    return json({ error: 'Kon de betaalpagina niet aanmaken.' }, 502);
  }
});
