// supabase/functions/create-checkout-session/index.ts
//
// RC1 - K1 Payments, fase 8C (2026-10-04), aangepast in fase 2B (2026-10-05):
// server-side aanmaken van een Stripe Checkout Session voor een maandelijks
// Pro- of Premium-abonnement, nu met een optionele gratis Stripe-trial.
//
// DEFINITIEF MODEL (alles wordt door de SERVER bepaald, nooit door de client):
//  - alle bedragen zijn EXCLUSIEF btw; Stripe Tax is niet ingeschakeld
//    (automatic_tax staat expliciet uit) en wordt alleen na apart akkoord
//    ingeschakeld;
//  - PRO     EUR 12 per maand excl. btw, trial 7 dagen als nog beschikbaar;
//  - PREMIUM EUR 39 per maand excl. btw, trial 1 dag (beoogd exact 24 uur) als
//            nog beschikbaar;
//  - trial uitsluitend voor een account dat NOOIT eerder een trial EN nooit
//    een Pro/Premium-abonnement had (Stripe-historie + profiel);
//  - bestaande actieve Pro/Premium-toegang (admin of handmatig toegekend)
//    blokkeert Checkout;
//  - trial beschikbaar  -> Checkout MET trial: betaalmethode verplicht
//                          (payment_method_collection=always), EUR 0 bij start,
//                          Stripe int na afloop automatisch de eerste maand en
//                          verlengt daarna maandelijks tot opzegging;
//  - trial al gebruikt  -> Checkout ZONDER trial: direct het normale
//                          maandelijkse abonnement.
//  Het automatische gedrag NA de trial (eerste betaling, verlenging,
//  beëindiging bij opzeggen tijdens de trial) wordt volledig door de Stripe
//  Subscription lifecycle bepaald. Er is hier geen eigen timer of
//  Supabase-trigger die na 7 dagen/24 uur zelf iets activeert.
//
// De client stuurt UITSLUITEND { plan: 'PRO' | 'PREMIUM', voorwaarden_akkoord:
// true }. Trial ja/nee, trialduur, Price ID, prijs, status en toegang worden
// nooit uit het verzoek gelezen.
//
// BELANGRIJK - SCOPE VAN DEZE FUNCTIE:
// Deze functie doet UITSLUITEND het veilig aanmaken van een Stripe Checkout
// Session. Ze schrijft GEEN abonnementstoegang: subscription_tier,
// subscription_active, subscription_status, subscription_current_period_end,
// subscription_cancel_at_period_end, trial_started_at, trial_ends_at en
// stripe_subscription_id worden hier nooit geschreven. De enige schrijfactie
// is het eenmalig vastleggen van een nieuw aangemaakte stripe_customer_id. Een
// geslaagde redirect naar de success_url bewijst op zichzelf NOOIT dat er is
// betaald of dat er een abonnement is; echte toegangsactivatie gebeurt pas in
// de latere, geverifieerde webhook-functie (fase 2C) die de status
// rechtstreeks van Stripe krijgt (signature-verificatie), nooit van een
// terugkerende browser.
//
// Deze functie raakt de bestaande supabase/functions/subsidie-kompas NIET aan.
//
// Stripe SDK: officieel door Supabase gedocumenteerde, minimale import voor
// de Deno Edge Runtime:
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

// Server-side planconfiguratie. De client kan uitsluitend 'PRO' of 'PREMIUM'
// sturen, nooit een Stripe price-id, bedrag, valuta of trialduur. De
// daadwerkelijke price-id's komen UITSLUITEND uit environment-secrets; hun
// bedrag/valuta/interval wordt bij elk verzoek tegen deze verwachting
// gecontroleerd, zodat een verwisselde of foute secret nooit een verkeerd
// bedrag kan afrekenen. Bedragen zijn het basisbedrag EXCLUSIEF btw (er is
// geen Stripe Tax ingeschakeld; fiscaal beleid is nog open).
// Test-mode: deze secrets bevatten in de testfase Stripe TEST-price-id's.
type Plan = 'PRO' | 'PREMIUM';

const PLANNEN: Record<Plan, { tier: 'pro' | 'premium'; priceEnv: string; bedragCent: number; trialDagen: number }> = {
  PRO: { tier: 'pro', priceEnv: 'STRIPE_PRO_PRICE_ID', bedragCent: 1200, trialDagen: 7 },
  // trial_period_days=1 is de normale Stripe-trial. ACCEPTATIECRITERIUM voor
  // de Sandbox-test: trial_end - trial_start moet exact 86.400 s zijn. Klopt
  // dat niet: STOPPEN en eerst een alternatief ontwerpen, geen workaround.
  PREMIUM: { tier: 'premium', priceEnv: 'STRIPE_PREMIUM_PRICE_ID', bedragCent: 3900, trialDagen: 1 },
};

// Stripe-statussen waarin er al een lopend abonnement is: dan geen tweede
// Checkout (voorkomt dubbele abonnementen en twee gelijktijdige trials).
const LOPENDE_STATUSSEN = new Set(['trialing', 'active', 'past_due', 'unpaid', 'paused']);

// Een nog openstaande Checkout-sessie van dezelfde keuze wordt hergebruikt
// (dubbelklik/refresh) zolang hij niet ouder is dan dit aantal seconden.
const HERGEBRUIK_SECONDEN = 30 * 60;

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
  // Versie van de Algemene Voorwaarden waarmee de gebruiker akkoord gaat
  // (datum van ingang, YYYY-MM-DD, bijv. 2026-10-05). Verplicht: zonder
  // versie kan het akkoord later niet worden gereconstrueerd, dus geen Checkout.
  const termsVersion = Deno.env.get('TERMS_VERSION');

  if (!stripeSecretKey || !appBaseUrl || !supabaseUrl || !serviceKey || !termsVersion || !/^\d{4}-\d{2}-\d{2}$/.test(termsVersion)) {
    console.error('create-checkout-session: ontbrekende configuratie', {
      hasStripeSecretKey: Boolean(stripeSecretKey),
      hasAppBaseUrl: Boolean(appBaseUrl),
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceKey: Boolean(serviceKey),
      hasValidTermsVersion: Boolean(termsVersion && /^\d{4}-\d{2}-\d{2}$/.test(termsVersion)),
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

  // --- 2. Input -----------------------------------------------------------
  // De client mag UITSLUITEND meesturen: welk abonnement ('PRO' of 'PREMIUM')
  // en dat de gebruiker de voorwaarden heeft aangevinkt. Alle andere velden
  // (trial, trial_period_days, price/priceId, bedrag, valuta, customer-id,
  // subscription-id, user-id, status, ...) worden nergens gelezen en hebben
  // dus hoe dan ook geen enkel effect, ook niet als een client ze meestuurt.
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return json({ error: 'Ongeldige aanvraag.' }, 400);
  }

  const invoer = (body ?? {}) as { plan?: unknown; voorwaarden_akkoord?: unknown };

  if (invoer.plan !== 'PRO' && invoer.plan !== 'PREMIUM') {
    return json({ error: 'Ongeldig abonnementstype.' }, 400);
  }

  const plan: Plan = invoer.plan;
  const planConfig = PLANNEN[plan];

  // Het vinkje op de abonneren-pagina is verplicht; de server dwingt het af
  // zodat het niet door een eigen verzoek te omzeilen is.
  if (invoer.voorwaarden_akkoord !== true) {
    return json({ error: 'Ga akkoord met de voorwaarden om verder te gaan.', code: 'akkoord_vereist' }, 400);
  }

  const priceId = Deno.env.get(planConfig.priceEnv);

  if (!priceId) {
    console.error(`create-checkout-session: ontbrekende prijsconfiguratie voor plan "${plan}" (${planConfig.priceEnv})`);
    return json({ error: 'De betaalfunctie is niet geconfigureerd.' }, 500);
  }

  const stripe = new Stripe(stripeSecretKey);

  // --- 3. Profiel (service-role; authenticated heeft zelf geen UPDATE) ----
  // Een geauthenticeerde user ZONDER profiel is een gecontroleerde fout: geen
  // Checkout, geen klant, niets. (Zelfde patroon als de profiel-guard in
  // subsidie-kompas.)
  const { data: profiel, error: profielError } = await admin
    .from('profiles')
    .select('id, role, subscription_tier, subscription_active, subscription_started_at, stripe_customer_id, stripe_subscription_id, trial_started_at')
    .eq('id', user.id)
    .single();

  if (profielError || !profiel) {
    console.error('create-checkout-session: profiel ontbreekt of onleesbaar', profielError?.code ?? 'onbekend');

    return json(
      profielError?.code === 'PGRST116'
        ? { error: 'Uw account is niet volledig ingericht. Er kan nu geen abonnement worden afgesloten. Neem contact met ons op.', code: 'profiel_ontbreekt' }
        : { error: 'Uw profielgegevens konden niet worden geladen. Probeer het later opnieuw.', code: 'profiel_onleesbaar' },
      profielError?.code === 'PGRST116' ? 403 : 503,
    );
  }

  // --- 3b. Bestaande actieve toegang -------------------------------------------
  // Wie al volledige of actieve Pro/Premium-toegang heeft die niet via deze
  // Stripe-flow wordt betaald, mag hier geen (tweede) betaald abonnement
  // afsluiten: een admin (behoudt zijn volledige toegang) en een gebruiker met
  // een actief Pro/Premium-abonnement zonder Stripe (bijv. handmatig
  // toegekend, subscription_active=true). Dezelfde regel als de rest van de app
  // (admin OF tier+active). Een lopende interne proefperiode (trial_ends_at)
  // blokkeert bewust NIET: die gebruiker mag wel overstappen op betalen.
  // Een Stripe-gekoppeld lopend abonnement wordt hieronder op de werkelijke
  // Stripe-status gecontroleerd.
  if (profiel.role === 'admin') {
    return json(
      { error: 'Beheerders hebben al volledige toegang; een abonnement is niet nodig.', code: 'admin_toegang' },
      409,
    );
  }

  if (profiel.subscription_active === true && (profiel.subscription_tier === 'pro' || profiel.subscription_tier === 'premium')) {
    return json(
      { error: 'U heeft al actieve Pro- of Premium-toegang. Neem contact met ons op als u wilt wijzigen.', code: 'actieve_toegang_bestaat' },
      409,
    );
  }

  // --- 4. Prijscontrole -------------------------------------------------------
  // De geconfigureerde Price moet precies het verwachte basisbedrag, EUR en een
  // maandelijks interval hebben en actief zijn.
  try {
    const price = await stripe.prices.retrieve(priceId);

    if (
      !price.active ||
      price.currency !== 'eur' ||
      price.unit_amount !== planConfig.bedragCent ||
      price.recurring?.interval !== 'month' ||
      (price.recurring?.interval_count ?? 1) !== 1
    ) {
      console.error(`create-checkout-session: Price voor plan "${plan}" wijkt af van de verwachting (bedrag/valuta/interval/actief)`);

      return json({ error: 'De betaalfunctie is niet goed geconfigureerd.' }, 500);
    }

    // Alleen voor de Sandbox-/livegang-controle van de btw-instelling: hoe is
    // dit Price technisch geconfigureerd? (Geen geheimen; wijzigt niets.)
    console.info('create-checkout-session: price-config', { plan, tax_behavior: price.tax_behavior ?? 'onbekend', livemode: price.livemode });
  } catch (err) {
    console.error('create-checkout-session: Stripe-fout bij controleren price', String(err));

    return json({ error: 'Kon de betaalpagina niet aanmaken.' }, 502);
  }

  // --- 5. Stripe Customer: hergebruiken of veilig aanmaken ----------------
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
    // wordt teruggevallen op de intussen al opgeslagen id, zodat er nooit
    // meer dan één stripe_customer_id per profiel blijvend wordt vastgelegd.
    // De dan ongebruikte Stripe Customer blijft ongebruikt bij Stripe staan:
    // geen toegangsrisico, wel een kleine, bewust geaccepteerde inefficiëntie.
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

  // --- 6. Stripe-historie: lopend abonnement? trial al gebruikt? ---------------
  // Stripe is de bron van waarheid. We lezen ALLE abonnementen van deze
  // klant (ook beëindigde) en het eventueel in het profiel vastgelegde
  // abonnement. Lukt het lezen niet, dan geen Checkout (liever geen betaalpagina
  // dan een mogelijk dubbel abonnement of een ten onrechte toegekende trial).
  // deno-lint-ignore no-explicit-any
  let abonnementen: any[] = [];

  try {
    const lijst = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 });

    abonnementen = [...lijst.data];

    if (profiel.stripe_subscription_id && !abonnementen.some((a) => a.id === profiel.stripe_subscription_id)) {
      try {
        abonnementen.push(await stripe.subscriptions.retrieve(profiel.stripe_subscription_id));
      } catch (err) {
        // Een in het profiel vastgelegd abonnement dat Stripe niet (meer) kent
        // blokkeert niets; elke andere fout wel.
        if ((err as { code?: string })?.code !== 'resource_missing') {
          throw err;
        }
      }
    }
  } catch (err) {
    console.error('create-checkout-session: Stripe-fout bij lezen abonnementen', String(err));

    return json({ error: 'Kon de betaalpagina niet aanmaken.' }, 502);
  }

  // Dubbel-abonnement-bescherming op de WERKELIJKE Stripe-status. Het veld
  // subscription_active in het profiel wordt bewust niet gebruikt: dat kan ook
  // true zijn voor een handmatig toegekend abonnement zonder Stripe.
  if (abonnementen.some((a) => LOPENDE_STATUSSEN.has(a.status))) {
    return json(
      { error: 'Er is al een lopend abonnement gekoppeld aan dit account.', code: 'abonnement_bestaat' },
      409,
    );
  }

  // --- 7. Server bepaalt het trialrecht ---------------------------------------
  // Een gratis trial is uitsluitend voor een account dat NOOIT (a) een Pro- of
  // Premium-trial heeft gehad EN (b) een Pro- of Premium-abonnement heeft gehad.
  // Eerder trial -> geen trial. Eerder abonnement -> geen trial. Nieuwe klant
  // -> maximaal één trial. Alles server-side, de client heeft geen invloed.
  //  (a) trial gebruikt: trial_started_at in het profiel (gezet door de oude
  //      interne trial en straks ook door de webhook) OF een abonnement in de
  //      Stripe-historie van deze klant dat een trial heeft gehad;
  //  (b) eerder abonnement: stripe_subscription_id of subscription_started_at
  //      in het profiel (ook een eerder handmatig toegekend abonnement), OF
  //      een abonnement in de Stripe-historie dat ooit echt is gestart (elke
  //      status behalve incomplete/incomplete_expired: die zijn nooit gestart).
  const NOOIT_GESTART = new Set(['incomplete', 'incomplete_expired']);
  const eerderTrial =
    Boolean(profiel.trial_started_at) || abonnementen.some((a) => a.trial_start != null || a.trial_end != null);
  const eerderAbonnement =
    Boolean(profiel.stripe_subscription_id) ||
    Boolean(profiel.subscription_started_at) ||
    abonnementen.some((a) => !NOOIT_GESTART.has(a.status));
  const metTrial = !eerderTrial && !eerderAbonnement;
  const trialWeigering = eerderTrial ? 'eerdere_trial' : 'eerder_abonnement';

  // --- 8. Open Checkout-sessies: hergebruiken of opruimen ----------------------
  // Maximaal één open sessie per klant. Dezelfde keuze binnen het
  // hergebruikvenster (dubbelklik, refresh) krijgt dezelfde sessie terug; elke
  // andere open sessie wordt verlopen, zodat er geen tweede (trial)sessie
  // naast kan worden afgerond.
  const nu = Math.floor(Date.now() / 1000);
  // deno-lint-ignore no-explicit-any
  let open: any[] = [];

  try {
    open = (await stripe.checkout.sessions.list({ customer: customerId, status: 'open', limit: 100 })).data;
  } catch (err) {
    console.error('create-checkout-session: Stripe-fout bij lezen open sessies', String(err));

    return json({ error: 'Kon de betaalpagina niet aanmaken.' }, 502);
  }

  const hergebruik = open.find(
    (s) =>
      s.url &&
      s.metadata?.supabase_user_id === user.id &&
      s.metadata?.plan === plan &&
      s.metadata?.trial_granted === String(metTrial) &&
      nu - s.created < HERGEBRUIK_SECONDEN,
  );

  const verloopSessie = async (id: string) => {
    try {
      await stripe.checkout.sessions.expire(id);
    } catch (err) {
      // Reeds verlopen of net afgerond: niets te doen.
      console.error('create-checkout-session: sessie niet te verlopen', String(err));
    }
  };

  for (const s of open) {
    if (!hergebruik || s.id !== hergebruik.id) {
      await verloopSessie(s.id);
    }
  }

  if (hergebruik) {
    return json({ url: hergebruik.url });
  }

  // --- 9. Checkout Session ---------------------------------------------------------
  // success_url/cancel_url zijn volledig server-side bepaald (nooit uit het
  // verzoek). Success: de accountpagina met een neutrale melding "wordt door
  // Stripe verwerkt"; de redirect geeft zelf GEEN toegang. Cancel: terug naar
  // de abonneren-pagina, niets geactiveerd.
  const basis = appBaseUrl.replace(/\/+$/, '');

  // Veilige, later controleerbare metadata. Geen juridische teksten: alleen
  // dát (terms_accepted), wanneer (terms_accepted_at, servertijd) en met welke
  // versie van de voorwaarden (terms_version) het vinkje is gezet. Daarmee is
  // later te reconstrueren welke versie iemand heeft geaccepteerd, zodra de
  // historische voorwaardenteksten per versie worden bewaard (komt in een
  // latere fase; de versie-string is daarvoor de sleutel).
  // De webhook (fase 2C) leest hieruit de gebruiker, het plan en of de server
  // een trial heeft toegekend; het blijft verder Stripe die de status bepaalt.
  const metadata: Record<string, string> = {
    supabase_user_id: user.id,
    plan,
    tier: planConfig.tier,
    trial_granted: String(metTrial),
    trial_days: String(metTrial ? planConfig.trialDagen : 0),
    terms_accepted: 'true',
    terms_accepted_at: new Date().toISOString(),
    terms_version: termsVersion,
    checkout_flow: 'abonneren-v1',
  };

  if (!metTrial) {
    metadata.trial_denied_reason = trialWeigering;
  }

  // deno-lint-ignore no-explicit-any
  const params: any = {
    mode: 'subscription',
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${basis}/#/kompas/account?checkout=success`,
    cancel_url: `${basis}/#/kompas/abonneren?intent=${plan}&checkout=cancelled`,
    locale: 'nl',
    // Prijzen zijn exclusief btw; Stripe Tax is niet ingeschakeld en wordt
    // alleen na apart akkoord aangezet.
    automatic_tax: { enabled: false },
    metadata,
    subscription_data: { metadata },
  };

  if (metTrial) {
    // Gratis trial via de normale Stripe subscription-trial. Betaalmethode is
    // verplicht (EUR 0 bij start); zonder betaalmethode geen trial. Na afloop
    // int Stripe automatisch de eerste maand en verlengt maandelijks tot
    // opzegging; opzeggen tijdens de trial voorkomt de eerste betaling.
    params.payment_method_collection = 'always';
    params.subscription_data.trial_period_days = planConfig.trialDagen;
    params.subscription_data.trial_settings = { end_behavior: { missing_payment_method: 'cancel' } };
  }
  // Zonder trial: geen trial_period_days; Stripe int direct de eerste maand.

  try {
    const session = await stripe.checkout.sessions.create(params);

    if (!session.url) {
      console.error('create-checkout-session: Stripe gaf geen url terug bij sessie aanmaken');
      return json({ error: 'Kon de betaalpagina niet aanmaken.' }, 502);
    }

    // Gelijktijdige verzoeken: houd na het aanmaken precies één open sessie
    // over, deterministisch de nieuwste (created, daarna id). Het verzoek
    // waarvan de sessie niet de nieuwste is, ruimt zijn eigen sessie op.
    try {
      const nuOpen = (await stripe.checkout.sessions.list({ customer: customerId, status: 'open', limit: 100 })).data;
      const gesorteerd = [...nuOpen].sort((a, b) => b.created - a.created || (a.id < b.id ? 1 : -1));
      const nieuwste = gesorteerd[0];

      if (nieuwste && nieuwste.id !== session.id) {
        await verloopSessie(session.id);

        for (const s of gesorteerd) {
          if (s.id !== nieuwste.id && s.id !== session.id) {
            await verloopSessie(s.id);
          }
        }

        return json(
          { error: 'Er is zojuist een andere betaalaanvraag gestart. Probeer het opnieuw.', code: 'gelijktijdig' },
          409,
        );
      }

      for (const s of gesorteerd.slice(1)) {
        await verloopSessie(s.id);
      }
    } catch (err) {
      // De sessie bestaat al en geeft op zichzelf geen toegang; alleen loggen.
      console.error('create-checkout-session: opruimen gelijktijdige sessies mislukt', String(err));
    }

    // --- 10. Respons ----------------------------------------------------------
    // Uitsluitend de Checkout-url; geen Stripe-geheimen of overige interne
    // informatie, en geen enkel recht.
    return json({ url: session.url });
  } catch (err) {
    console.error('create-checkout-session: Stripe-fout bij sessie aanmaken', String(err));
    return json({ error: 'Kon de betaalpagina niet aanmaken.' }, 502);
  }
});
