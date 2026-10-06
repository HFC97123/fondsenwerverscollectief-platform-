// supabase/functions/stripe-webhook/index.ts
//
// RC1 - fase 2C (2026-10-06): ontvangt Stripe-webhookevents en synchroniseert
// de abonnementsstatus naar public.profiles. Dit is de ENIGE plek die
// Stripe-abonnementstoegang schrijft (create-checkout-session schrijft nooit
// toegang; de browser nooit).
//
// DEPLOY (later, na akkoord): deze functie krijgt GEEN Supabase-gebruikers-JWT
// van Stripe, dus uitsluitend deze functie wordt zo gedeployed:
//   supabase functions deploy stripe-webhook --no-verify-jwt
// De Stripe-handtekening (STRIPE_WEBHOOK_SECRET) vervangt de JWT-controle en is
// hieronder de allereerste handeling.
//
// VEILIGHEIDSREGELS
//  - Handtekeningverificatie op de RUWE body vóór alles; zonder geldige
//    handtekening wordt niets gelezen, geclaimd of geschreven.
//  - Metadata is nooit een bron van rechten. Toegang volgt uit de echte,
//    zojuist bij Stripe opgehaalde Subscription (status + Price).
//  - Tier komt UITSLUITEND uit de echte Subscription-Price via een allowlist
//    (STRIPE_PRO_PRICE_ID -> pro, STRIPE_PREMIUM_PRICE_ID -> premium). Een
//    onbekende Price geeft nooit toegang (conflict in de database).
//  - De koppeling Stripe Customer <-> profiel loopt via profiles.
//    stripe_customer_id (door create-checkout-session race-safe gezet). De
//    webhook maakt nooit een auth-user of profiel aan en wijzigt role nooit.
//  - Service-role wordt uitsluitend intern gebruikt, voor de service-role-only
//    RPC's (claim/apply/record/mark_failed); alle beslislogica (mapping,
//    volgorde, conflicten) zit in die RPC's, in één transactie.
//  - Events buiten volgorde: nooit de status uit het event schrijven; altijd
//    de actuele Subscription ophalen en de RPC bewaakt de volgorde.
//  - Geen automatisch annuleren/refunden/kiezen bij dubbele abonnementen.
//
// MINIMALE EVENTSET (andere typen: 200 zonder verwerking):
//   checkout.session.completed  - alleen akkoord-audit/koppeling, geen toegang
//   customer.subscription.created / .updated / .deleted
//
// Antwoordbeleid: 200 = klaar (ook bij duplicaat, genegeerd of geregistreerd
// conflict: daarvan wordt het opnieuw proberen niets beter); 503 = event wordt
// elders al verwerkt (Stripe probeert opnieuw); 500 = tijdelijke fout (event
// wordt als failed gemarkeerd, Stripe probeert opnieuw); 400 = ongeldige
// handtekening/aanvraag.
import Stripe from 'npm:stripe@^22';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const VERWERKTE_TYPES = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
]);

function antwoord(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function idVan(waarde: unknown): string | null {
  if (typeof waarde === 'string' && waarde) return waarde;
  if (waarde && typeof waarde === 'object' && typeof (waarde as { id?: unknown }).id === 'string') {
    return (waarde as { id: string }).id;
  }
  return null;
}

function isoVanUnix(waarde: unknown): string | null {
  return typeof waarde === 'number' && Number.isFinite(waarde)
    ? new Date(waarde * 1000).toISOString()
    : null;
}

function isNietGevonden(fout: unknown): boolean {
  const f = fout as { code?: unknown; statusCode?: unknown } | null;
  return f?.code === 'resource_missing' || f?.statusCode === 404;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return antwoord({ error: 'Methode niet toegestaan.' }, 405);
  }

  // --- Configuratie ---------------------------------------------------
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const proPriceId = Deno.env.get('STRIPE_PRO_PRICE_ID');
  const premiumPriceId = Deno.env.get('STRIPE_PREMIUM_PRICE_ID');

  if (!stripeSecretKey || !webhookSecret || !supabaseUrl || !serviceKey || !proPriceId || !premiumPriceId || proPriceId === premiumPriceId) {
    console.error('[stripe-webhook] ontbrekende of ongeldige configuratie', {
      hasStripeSecretKey: Boolean(stripeSecretKey),
      hasWebhookSecret: Boolean(webhookSecret),
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceKey: Boolean(serviceKey),
      hasProPrice: Boolean(proPriceId),
      hasPremiumPrice: Boolean(premiumPriceId),
      pricesVerschillen: proPriceId !== premiumPriceId,
    });
    return antwoord({ error: 'Niet geconfigureerd.' }, 500);
  }

  // Price -> tier allowlist: de ENIGE manier waarop een tier kan ontstaan.
  const tierVoorPrice = new Map<string, 'pro' | 'premium'>([
    [proPriceId, 'pro'],
    [premiumPriceId, 'premium'],
  ]);

  // --- 1. Handtekening (ruwe body) -------------------------------------
  const handtekening = req.headers.get('stripe-signature');

  if (!handtekening) {
    return antwoord({ error: 'Handtekening ontbreekt.' }, 400);
  }

  const stripe = new Stripe(stripeSecretKey);
  const ruweBody = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(ruweBody, handtekening, webhookSecret);
  } catch {
    // Geen details naar buiten en niets verder lezen of schrijven.
    console.error('[stripe-webhook] ongeldige handtekening');
    return antwoord({ error: 'Ongeldige handtekening.' }, 400);
  }

  // Een test-event met een live key (of andersom) is een configuratiefout:
  // nooit verwerken, wel melden. 200 zodat Stripe niet blijft herhalen.
  const keyIsLive = stripeSecretKey.startsWith('sk_live_') || stripeSecretKey.startsWith('rk_live_');

  if (event.livemode !== keyIsLive) {
    console.error('[stripe-webhook] livemode wijkt af van sleutelmodus', { eventId: event.id, eventLivemode: event.livemode, keyIsLive });
    return antwoord({ ignored: 'livemode_mismatch' });
  }

  if (!VERWERKTE_TYPES.has(event.type)) {
    return antwoord({ ignored: 'type' });
  }

  // --- 2. Eventgegevens bepalen ------------------------------------------
  // deno-lint-ignore no-explicit-any
  const object = event.data.object as any;
  const objectId = idVan(object?.id);
  const klantId = idVan(object?.customer);

  if (event.type === 'checkout.session.completed' && object?.mode !== 'subscription') {
    return antwoord({ ignored: 'geen_abonnementssessie' });
  }

  if (!objectId) {
    console.error('[stripe-webhook] event zonder object-id', { eventId: event.id, type: event.type });
    return antwoord({ ignored: 'zonder_object' });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  // --- 3. Atomaire claim (idempotentie) ------------------------------------
  const { data: claim, error: claimFout } = await admin.rpc('stripe_claim_event', {
    p_event_id: event.id,
    p_type: event.type,
    p_livemode: event.livemode,
    p_created: new Date(event.created * 1000).toISOString(),
    p_object_id: objectId,
    p_customer_id: klantId,
  });

  if (claimFout) {
    console.error('[stripe-webhook] claim mislukt', { eventId: event.id, code: claimFout.code ?? 'onbekend' });
    return antwoord({ error: 'Tijdelijke fout.' }, 500);
  }

  if (claim === 'duplicate') {
    return antwoord({ duplicate: true });
  }

  if (claim === 'busy') {
    return antwoord({ busy: true }, 503);
  }

  if (claim !== 'claimed') {
    console.error('[stripe-webhook] onverwacht claim-resultaat', { eventId: event.id });
    return antwoord({ error: 'Tijdelijke fout.' }, 500);
  }

  // --- 4. Verwerken -----------------------------------------------------------
  try {
    let resultaat: { result?: string; reden?: string } | null = null;

    if (event.type === 'checkout.session.completed') {
      // Alleen audit/koppeling van het akkoord; nooit toegang.
      const m = (object.metadata ?? {}) as Record<string, string | undefined>;
      const geldigeTijd = typeof m.terms_accepted_at === 'string' && !Number.isNaN(Date.parse(m.terms_accepted_at));
      const { data, error } = await admin.rpc('stripe_record_checkout_completed', {
        p_event_id: event.id,
        p_session: {
          session_id: objectId,
          customer_id: klantId,
          subscription_id: idVan(object.subscription),
          client_reference_id: typeof object.client_reference_id === 'string' ? object.client_reference_id : null,
          metadata_user_id: m.supabase_user_id ?? null,
          terms_accepted: m.terms_accepted ?? null,
          terms_accepted_at: geldigeTijd ? new Date(m.terms_accepted_at as string).toISOString() : null,
          terms_version: m.terms_version ?? null,
          plan: m.plan ?? null,
          trial_granted: m.trial_granted === 'true',
        },
      });

      if (error) throw new Error(`record_checkout:${error.code ?? 'onbekend'}`);
      resultaat = data;
    } else {
      // Subscription-event: ALTIJD de actuele stand bij Stripe ophalen. Het
      // tijdstip waarop het ophalen begint is de volgordesleutel in de RPC.
      const opgehaaldOp = new Date().toISOString();
      // deno-lint-ignore no-explicit-any
      let sub: any;

      try {
        sub = await stripe.subscriptions.retrieve(objectId);
      } catch (fout) {
        // Een definitief verwijderd abonnement kan niet meer op te halen zijn:
        // alleen dan is het (bij Stripe uitgegeven) deleted-event zelf de
        // bron voor de eindstatus. Voor alle andere events: fout -> retry.
        if (event.type === 'customer.subscription.deleted' && isNietGevonden(fout)) {
          sub = { ...object, status: 'canceled' };
        } else {
          throw fout;
        }
      }

      const items = Array.isArray(sub?.items?.data) ? sub.items.data : [];
      const eersteItem = items[0];
      const priceId = idVan(eersteItem?.price);
      const tier = items.length === 1 && priceId ? (tierVoorPrice.get(priceId) ?? null) : null;
      // Bij recente Stripe API-versies staat current_period_end op het item,
      // bij oudere op de subscription.
      const periodeEinde = isoVanUnix(eersteItem?.current_period_end ?? sub?.current_period_end);

      const snapshot = {
        subscription_id: idVan(sub?.id) ?? objectId,
        customer_id: idVan(sub?.customer) ?? klantId,
        status: typeof sub?.status === 'string' ? sub.status : null,
        price_id: priceId,
        tier,
        item_count: items.length,
        trial_start: isoVanUnix(sub?.trial_start),
        trial_end: isoVanUnix(sub?.trial_end),
        current_period_end: periodeEinde,
        start_date: isoVanUnix(sub?.start_date),
        cancel_at_period_end: sub?.cancel_at_period_end === true || sub?.cancel_at != null,
        // Alleen ondersteunend; de RPC gebruikt dit nooit om iets te activeren.
        metadata_user_id: sub?.metadata?.supabase_user_id ?? null,
      };

      let { data, error } = await admin.rpc('stripe_apply_subscription', {
        p_event_id: event.id,
        p_fetched_at: opgehaaldOp,
        p_snapshot: snapshot,
        p_linked_check: null,
      });

      if (error) throw new Error(`apply:${error.code ?? 'onbekend'}`);

      if (data?.result === 'linked_check_needed') {
        // Opgeslagen status van het al gekoppelde abonnement kan achterlopen:
        // eerst de echte Stripe-status ophalen voor een tweede-abonnement-oordeel.
        const gekoppeldId = String(data.linked_subscription_id);
        let gekoppeldeStatus: string;

        try {
          const gekoppeld = await stripe.subscriptions.retrieve(gekoppeldId);
          gekoppeldeStatus = gekoppeld.status;
        } catch (fout) {
          if (!isNietGevonden(fout)) throw fout;
          gekoppeldeStatus = 'canceled';
        }

        ({ data, error } = await admin.rpc('stripe_apply_subscription', {
          p_event_id: event.id,
          p_fetched_at: opgehaaldOp,
          p_snapshot: snapshot,
          p_linked_check: { subscription_id: gekoppeldId, status: gekoppeldeStatus },
        }));

        if (error) throw new Error(`apply2:${error.code ?? 'onbekend'}`);
      }

      resultaat = data;
    }

    if (resultaat?.result === 'conflict') {
      // Alleen id's en reden (geen persoonsgegevens). Hier kan later een
      // melding aan gehangen worden; de details staan in stripe_billing_conflicts.
      console.error('[stripe-webhook] CONFLICT geregistreerd', {
        eventId: event.id,
        type: event.type,
        reden: resultaat.reden ?? 'onbekend',
        objectId,
        klantId,
      });
    } else {
      console.log('[stripe-webhook] verwerkt', { eventId: event.id, type: event.type, result: resultaat?.result ?? 'onbekend' });
    }

    return antwoord({ ok: true, result: resultaat?.result ?? null });
  } catch (fout) {
    const bericht = fout instanceof Error ? fout.message : 'onbekend';
    console.error('[stripe-webhook] verwerking mislukt', { eventId: event.id, type: event.type, fout: bericht.slice(0, 120) });

    // Best effort: markeren zodat Stripe's nieuwe poging meteen kan claimen.
    await admin.rpc('stripe_mark_event_failed', { p_event_id: event.id, p_error: bericht.slice(0, 300) });

    return antwoord({ error: 'Tijdelijke fout.' }, 500);
  }
});
