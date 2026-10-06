-- RC1 fase 2C-2 (2026-10-06): databasefundament voor de Stripe-webhook.
--
-- STATUS: lokaal voorbereid, NOG NIET toegepast op Supabase. Bij toepassen
-- wordt het bestand hernoemd naar de live-versie (zelfde werkwijze als
-- 20261005132650_kompas_tier_rpcs_alleen_service_role.sql).
--
-- Uitgangspunten (zie claude/rc1-fase2c-webhook-databasearchitectuur-voorstel.md):
--  * Bestaande profiles-kolommen worden hergebruikt; GEEN nieuwe kolommen en
--    geen tweede status of einddatumlogica. subscription_ends_at blijft
--    ongemoeid. role wordt door niets hieronder gewijzigd.
--  * Alleen service_role, uitsluitend via de SECURITY DEFINER-RPC's
--    hieronder, schrijft de nieuwe tabellen en de Stripe-velden op profiles.
--    authenticated houdt op profiles alleen SELECT.
--  * start_trial, admin_set_subscription, current_user_has_pro/premium_access,
--    de RLS-policies op profiles en alle bestaande toegangslogica blijven
--    ONGEWIJZIGD.
--  * Toegang: de ene centrale mapping stripe_status_geeft_toegang():
--    trialing/active/past_due = toegang; al het andere = geen betaalde
--    toegang. Zodra er geen toegang is wordt subscription_tier teruggezet naar
--    'free' (activeren van de bestaande trial-tak "tier AND trial_ends_at >
--    now()" voor een in de proef geannuleerd abonnement is anders mogelijk,
--    bewezen in de 2C-1 tier-controle). De laatst bekende Stripe-tier blijft
--    bewaard in stripe_webhook_events.detail ('tier_uit_price').
--  * Trialvelden zijn write-once (nooit gewist of herschreven); abonnements-
--    en trialhistorie op profiles blijft na het einde staan.
--  * Retentie stripe_webhook_events: voorlopig 13 maanden NOTEREN; er is
--    bewust nog geen automatische opschoning gebouwd.
--  * Retentie/verwijdering van subscription_terms_acceptances bij
--    accountverwijdering is een juridisch go-livepunt (fase 7).

-- 1. profiles: uniciteit van Stripe-koppelingen + statuscontrole ---------------
create unique index if not exists profiles_stripe_customer_id_uniek
  on public.profiles (stripe_customer_id) where stripe_customer_id is not null;
create unique index if not exists profiles_stripe_subscription_id_uniek
  on public.profiles (stripe_subscription_id) where stripe_subscription_id is not null;

alter table public.profiles
  add constraint profiles_subscription_status_check
  check (subscription_status is null or subscription_status in
    ('trialing','active','past_due','unpaid','canceled','incomplete','incomplete_expired','paused'));

-- 2. Eén centrale status -> toegang-mapping ------------------------------------
create or replace function public.stripe_status_geeft_toegang(p_status text)
returns boolean language sql immutable parallel safe set search_path = ''
as $$ select coalesce(p_status in ('trialing','active','past_due'), false) $$;

-- 3. Idempotentie-/auditlog van webhook-events ---------------------------------
create table public.stripe_webhook_events (
  stripe_event_id    text primary key,
  event_type         text        not null,
  livemode           boolean     not null,
  stripe_created_at  timestamptz not null,
  stripe_object_id   text,
  stripe_customer_id text,
  profile_id         uuid references public.profiles(id) on delete set null,
  status             text        not null default 'processing'
                     check (status in ('processing','processed','ignored','stale','conflict','failed')),
  attempts           integer     not null default 1,
  received_at        timestamptz not null default now(),
  claimed_at         timestamptz not null default now(),
  processed_at       timestamptz,
  snapshot_fetched_at timestamptz,
  detail             jsonb       not null default '{}'::jsonb
);
create index stripe_webhook_events_object_idx
  on public.stripe_webhook_events (stripe_object_id, stripe_created_at desc, snapshot_fetched_at desc)
  where status = 'processed';
create index stripe_webhook_events_open_idx
  on public.stripe_webhook_events (claimed_at) where status in ('processing','failed');

-- 4. Conflicten (dubbele abonnementen, onbekende prijs, profielmismatch, ...) ---
create table public.stripe_billing_conflicts (
  id                          uuid primary key default gen_random_uuid(),
  kind                        text not null check (kind in (
    'onbekende_klant','metadata_wijkt_af','admin_profiel','handmatige_toegang',
    'tweede_abonnement','onbekende_prijs','meerdere_items','onbekende_status',
    'paused_onverwacht','sessie_zonder_profiel')),
  dedupe_key                  text not null,
  stripe_event_id             text references public.stripe_webhook_events(stripe_event_id) on delete set null,
  profile_id                  uuid references public.profiles(id) on delete set null,
  stripe_customer_id          text,
  stripe_subscription_id      text,
  other_stripe_subscription_id text,
  detail                      jsonb not null default '{}'::jsonb,
  created_at                  timestamptz not null default now(),
  last_seen_at                timestamptz not null default now(),
  occurrences                 integer not null default 1,
  resolved_at                 timestamptz,
  resolved_by                 text,
  resolution_note             text
);
create unique index stripe_billing_conflicts_open_uniek
  on public.stripe_billing_conflicts (dedupe_key) where resolved_at is null;

-- 5. Akkoord-historie (append-only audit) -------------------------------------
create table public.subscription_terms_acceptances (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid references public.profiles(id) on delete set null,
  stripe_checkout_session_id text not null unique,
  stripe_customer_id       text not null,
  stripe_subscription_id   text,
  plan                     text not null check (plan in ('PRO','PREMIUM')),
  tier                     text not null check (tier in ('pro','premium')),
  trial_granted            boolean not null,
  terms_version            text not null check (terms_version ~ '^\d{4}-\d{2}-\d{2}$'),
  terms_accepted_at        timestamptz not null,
  stripe_event_id          text,
  recorded_at              timestamptz not null default now()
);
create index subscription_terms_acceptances_user_idx
  on public.subscription_terms_acceptances (user_id, recorded_at desc);

create or replace function public.subscription_terms_acceptances_append_only()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'subscription_terms_acceptances is append-only';
  end if;
  -- toegestaan: uitsluitend het loskoppelen van de gebruiker (FK ON DELETE SET NULL)
  if new.user_id is null and old.user_id is not null
     and (to_jsonb(new) - 'user_id') = (to_jsonb(old) - 'user_id') then
    return new;
  end if;
  raise exception 'subscription_terms_acceptances is append-only';
end $$;
create trigger subscription_terms_acceptances_append_only
  before update or delete on public.subscription_terms_acceptances
  for each row execute function public.subscription_terms_acceptances_append_only();

-- 6. RLS en grants -------------------------------------------------------------
alter table public.stripe_webhook_events          enable row level security;
alter table public.stripe_billing_conflicts       enable row level security;
alter table public.subscription_terms_acceptances enable row level security;

revoke all on public.stripe_webhook_events, public.stripe_billing_conflicts,
              public.subscription_terms_acceptances from public, anon, authenticated, service_role;
grant select on public.stripe_webhook_events, public.stripe_billing_conflicts,
                public.subscription_terms_acceptances to service_role;
grant select on public.stripe_billing_conflicts, public.subscription_terms_acceptances to authenticated;

create policy "Admins lezen conflicten" on public.stripe_billing_conflicts
  for select to authenticated using ((select private.is_admin()));
create policy "Admins lezen akkoorden" on public.subscription_terms_acceptances
  for select to authenticated using ((select private.is_admin()));
create policy "Gebruikers lezen eigen akkoorden" on public.subscription_terms_acceptances
  for select to authenticated using ((select auth.uid()) = user_id);
-- stripe_webhook_events: bewust GEEN policy en GEEN grant aan anon/authenticated.

-- 7. Interne hulpfuncties (niet aanroepbaar via de API) ---------------------------
create or replace function public.stripe_registreer_conflict(
  p_kind text, p_event_id text, p_profile_id uuid, p_customer text,
  p_sub text, p_other_sub text, p_detail jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.stripe_billing_conflicts
    (kind, dedupe_key, stripe_event_id, profile_id, stripe_customer_id,
     stripe_subscription_id, other_stripe_subscription_id, detail)
  values (p_kind,
          p_kind||'|'||coalesce(p_customer,'')||'|'||coalesce(p_sub,'')||'|'||coalesce(p_other_sub,''),
          p_event_id, p_profile_id, p_customer, p_sub, p_other_sub, coalesce(p_detail,'{}'::jsonb))
  on conflict (dedupe_key) where resolved_at is null
  do update set last_seen_at = now(),
                occurrences  = public.stripe_billing_conflicts.occurrences + 1,
                stripe_event_id = excluded.stripe_event_id,
                detail = excluded.detail;
end $$;

create or replace function public.stripe_event_afronden(
  p_event_id text, p_status text, p_profile_id uuid, p_fetched_at timestamptz, p_detail jsonb)
returns void language sql security definer set search_path = public, pg_temp as $$
  update public.stripe_webhook_events
     set status = p_status, profile_id = coalesce(p_profile_id, profile_id),
         processed_at = now(), snapshot_fetched_at = p_fetched_at,
         detail = coalesce(p_detail,'{}'::jsonb)
   where stripe_event_id = p_event_id
$$;

-- 8. RPC 1: event claimen (atomair, idempotent) -------------------------------
-- Resultaat: 'claimed' (verwerk), 'duplicate' (al klaar: antwoord 200),
--            'busy' (loopt nog binnen 2 min: antwoord 503 zodat Stripe herhaalt)
create or replace function public.stripe_claim_event(
  p_event_id text, p_type text, p_livemode boolean, p_created timestamptz,
  p_object_id text, p_customer_id text)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare v_status text;
begin
  insert into public.stripe_webhook_events as e
    (stripe_event_id, event_type, livemode, stripe_created_at, stripe_object_id, stripe_customer_id)
  values (p_event_id, p_type, p_livemode, p_created, p_object_id, p_customer_id)
  on conflict (stripe_event_id) do update
     set attempts = e.attempts + 1, claimed_at = now(), status = 'processing'
   where e.status = 'failed'
      or (e.status = 'processing' and e.claimed_at < now() - interval '2 minutes');
  if found then return 'claimed'; end if;

  select status into v_status from public.stripe_webhook_events where stripe_event_id = p_event_id;
  return case when v_status = 'processing' then 'busy' else 'duplicate' end;
end $$;

-- 9. RPC 2: subscription-snapshot toepassen + event afronden (1 transactie) -----
create or replace function public.stripe_apply_subscription(
  p_event_id text, p_fetched_at timestamptz, p_snapshot jsonb, p_linked_check jsonb default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_ev   public.stripe_webhook_events%rowtype;
  v_p    public.profiles%rowtype;
  v_sub  text := p_snapshot->>'subscription_id';
  v_cust text := p_snapshot->>'customer_id';
  v_stat text := p_snapshot->>'status';
  v_tier text := nullif(p_snapshot->>'tier','');
  v_items integer := coalesce((p_snapshot->>'item_count')::integer, 0);
  v_meta text := nullif(p_snapshot->>'metadata_user_id','');
  v_tstart timestamptz := nullif(p_snapshot->>'trial_start','')::timestamptz;
  v_tend   timestamptz := nullif(p_snapshot->>'trial_end','')::timestamptz;
  v_pend   timestamptz := nullif(p_snapshot->>'current_period_end','')::timestamptz;
  v_start  timestamptz := nullif(p_snapshot->>'start_date','')::timestamptz;
  v_cancel boolean := coalesce((p_snapshot->>'cancel_at_period_end')::boolean, false);
  v_linked_stat text;
  v_status_known boolean;
  v_entitled boolean;
  v_toegang boolean;
  v_linkworthy boolean;
begin
  if v_sub is null or v_cust is null or v_stat is null or p_fetched_at is null then
    raise exception 'onvolledige snapshot';
  end if;

  select * into v_ev from public.stripe_webhook_events where stripe_event_id = p_event_id for update;
  if not found or v_ev.status <> 'processing' then
    return jsonb_build_object('result','niet_geclaimd');
  end if;

  select * into v_p from public.profiles where stripe_customer_id = v_cust for update;
  if not found then
    perform public.stripe_registreer_conflict('onbekende_klant', p_event_id, null, v_cust, v_sub, null,
      jsonb_build_object('status', v_stat));
    perform public.stripe_event_afronden(p_event_id, 'conflict', null, p_fetched_at,
      jsonb_build_object('reden','onbekende_klant'));
    return jsonb_build_object('result','conflict','reden','onbekende_klant');
  end if;

  -- Volgorde: een snapshot die op basis van een OUDER event is opgehaald mag een
  -- nieuwere, al toegepaste stand nooit overschrijven.
  if exists (select 1 from public.stripe_webhook_events e
              where e.stripe_object_id = v_sub and e.status = 'processed'
                and e.event_type like 'customer.subscription.%'
                and e.stripe_event_id <> p_event_id
                and (e.stripe_created_at, coalesce(e.snapshot_fetched_at,'-infinity'::timestamptz))
                    > (v_ev.stripe_created_at, p_fetched_at)) then
    perform public.stripe_event_afronden(p_event_id, 'stale', v_p.id, p_fetched_at,
      jsonb_build_object('reden','nieuwere_stand_al_toegepast'));
    return jsonb_build_object('result','stale','reden','nieuwere_stand_al_toegepast');
  end if;
  -- Eindtoestanden zijn plakkerig: een geannuleerd abonnement herleeft nooit.
  if v_p.stripe_subscription_id = v_sub
     and v_p.subscription_status in ('canceled','incomplete_expired')
     and v_stat not in ('canceled','incomplete_expired') then
    perform public.stripe_event_afronden(p_event_id, 'stale', v_p.id, p_fetched_at,
      jsonb_build_object('reden','eindtoestand_plakkerig'));
    return jsonb_build_object('result','stale','reden','eindtoestand_plakkerig');
  end if;

  -- Metadata is alleen ondersteunend: een afwijking blokkeert, bevestigt nooit.
  if v_meta is not null and v_meta <> v_p.id::text then
    perform public.stripe_registreer_conflict('metadata_wijkt_af', p_event_id, v_p.id, v_cust, v_sub, null,
      jsonb_build_object('status', v_stat));
    perform public.stripe_event_afronden(p_event_id, 'conflict', v_p.id, p_fetched_at,
      jsonb_build_object('reden','metadata_wijkt_af'));
    return jsonb_build_object('result','conflict','reden','metadata_wijkt_af');
  end if;

  if v_p.role = 'admin' then
    perform public.stripe_registreer_conflict('admin_profiel', p_event_id, v_p.id, v_cust, v_sub, null,
      jsonb_build_object('status', v_stat));
    perform public.stripe_event_afronden(p_event_id, 'conflict', v_p.id, p_fetched_at,
      jsonb_build_object('reden','admin_profiel'));
    return jsonb_build_object('result','conflict','reden','admin_profiel');
  end if;

  v_status_known := v_stat in ('trialing','active','past_due','unpaid','canceled','incomplete','incomplete_expired','paused');
  if not v_status_known then
    perform public.stripe_registreer_conflict('onbekende_status', p_event_id, v_p.id, v_cust, v_sub, null,
      jsonb_build_object('status', v_stat));
    perform public.stripe_event_afronden(p_event_id, 'conflict', v_p.id, p_fetched_at,
      jsonb_build_object('reden','onbekende_status'));
    return jsonb_build_object('result','conflict','reden','onbekende_status');
  end if;

  v_entitled  := public.stripe_status_geeft_toegang(v_stat);
  v_linkworthy := v_stat in ('trialing','active','past_due','unpaid','paused')
               or (v_stat = 'canceled' and (v_tstart is not null or v_p.stripe_subscription_id = v_sub));

  if v_p.stripe_subscription_id is distinct from v_sub then
    -- incomplete / incomplete_expired / nooit-actief-geannuleerd: profiel niet aanraken.
    if not v_linkworthy then
      perform public.stripe_event_afronden(p_event_id, 'ignored', v_p.id, p_fetched_at,
        jsonb_build_object('reden','niet_koppelwaardig','status',v_stat));
      return jsonb_build_object('result','ignored','reden','niet_koppelwaardig');
    end if;

    -- Handmatig toegekende toegang (admin_set_subscription, geen Stripe-id): nooit overschrijven.
    if v_p.stripe_subscription_id is null and v_p.subscription_active = true
       and v_p.subscription_tier in ('pro','premium') then
      if v_entitled then
        perform public.stripe_registreer_conflict('handmatige_toegang', p_event_id, v_p.id, v_cust, v_sub, null,
          jsonb_build_object('status', v_stat, 'huidige_tier', v_p.subscription_tier));
        perform public.stripe_event_afronden(p_event_id, 'conflict', v_p.id, p_fetched_at,
          jsonb_build_object('reden','handmatige_toegang'));
        return jsonb_build_object('result','conflict','reden','handmatige_toegang');
      end if;
      perform public.stripe_event_afronden(p_event_id, 'ignored', v_p.id, p_fetched_at,
        jsonb_build_object('reden','handmatige_toegang_ongemoeid'));
      return jsonb_build_object('result','ignored','reden','handmatige_toegang_ongemoeid');
    end if;

    -- Een ander, al eindig abonnement terwijl er al een koppeling bestaat: nooit
    -- een lopende koppeling verdringen en geen ruis-conflict. Alleen de
    -- proefhistorie (write-once) wordt aangevuld als die nog ontbrak.
    if v_p.stripe_subscription_id is not null and v_stat in ('canceled','incomplete_expired') then
      update public.profiles set
        trial_started_at = coalesce(trial_started_at, v_tstart),
        trial_ends_at    = case when trial_started_at is null and v_tstart is not null
                                then v_tend else trial_ends_at end
       where id = v_p.id;
      perform public.stripe_event_afronden(p_event_id, 'ignored', v_p.id, p_fetched_at,
        jsonb_build_object('reden','ander_abonnement_eindig','status',v_stat));
      return jsonb_build_object('result','ignored','reden','ander_abonnement_eindig');
    end if;

    -- Er hangt al een ander, niet-eindig abonnement aan dit profiel?
    if v_p.stripe_subscription_id is not null then
      v_linked_stat := v_p.subscription_status;
      if p_linked_check is not null and p_linked_check->>'subscription_id' = v_p.stripe_subscription_id then
        v_linked_stat := p_linked_check->>'status';       -- echte Stripe-status van het gekoppelde abonnement
      elsif v_linked_stat is null or v_linked_stat not in ('canceled','incomplete_expired') then
        -- opgeslagen status kan achterlopen: laat de webhook de echte status ophalen en opnieuw aanroepen
        return jsonb_build_object('result','linked_check_needed','linked_subscription_id', v_p.stripe_subscription_id);
      end if;
      if v_linked_stat not in ('canceled','incomplete_expired') then
        perform public.stripe_registreer_conflict('tweede_abonnement', p_event_id, v_p.id, v_cust, v_sub,
          v_p.stripe_subscription_id, jsonb_build_object('status', v_stat, 'gekoppelde_status', v_linked_stat));
        perform public.stripe_event_afronden(p_event_id, 'conflict', v_p.id, p_fetched_at,
          jsonb_build_object('reden','tweede_abonnement'));
        return jsonb_build_object('result','conflict','reden','tweede_abonnement');
      end if;
    end if;
  end if;

  -- Prijs -> tier: alleen uit de echte Subscription-Price. Onbekend = geen toegang.
  v_toegang := coalesce(v_entitled and v_tier in ('pro','premium') and v_items = 1, false);
  if v_entitled and not v_toegang then
    perform public.stripe_registreer_conflict(
      case when v_items <> 1 then 'meerdere_items' else 'onbekende_prijs' end,
      p_event_id, v_p.id, v_cust, v_sub, null,
      jsonb_build_object('status', v_stat, 'price_id', p_snapshot->>'price_id', 'items', v_items));
  end if;
  if v_stat = 'paused' then
    perform public.stripe_registreer_conflict('paused_onverwacht', p_event_id, v_p.id, v_cust, v_sub, null,
      jsonb_build_object('status', v_stat));
  end if;

  update public.profiles set
    stripe_subscription_id            = v_sub,
    subscription_status               = v_stat,
    subscription_active               = v_toegang,
    subscription_tier                 = case when v_toegang then v_tier else 'free' end,
    subscription_current_period_end   = v_pend,
    subscription_cancel_at_period_end = v_cancel,
    subscription_started_at           = coalesce(subscription_started_at,
                                          case when v_toegang then coalesce(v_start, now()) end),
    trial_started_at                  = coalesce(trial_started_at, v_tstart),
    trial_ends_at                     = case when trial_started_at is null and v_tstart is not null
                                             then v_tend else trial_ends_at end
   where id = v_p.id;

  perform public.stripe_event_afronden(p_event_id, 'processed', v_p.id, p_fetched_at,
    jsonb_build_object('status', v_stat, 'toegang', v_toegang,
      'tier', case when v_toegang then v_tier else 'free' end,
      'tier_uit_price', v_tier, 'price_id', p_snapshot->>'price_id',
      'trial_seconden', case when v_tstart is not null and v_tend is not null
                             then extract(epoch from (v_tend - v_tstart))::bigint end));
  return jsonb_build_object('result','applied','toegang', v_toegang);
end $$;

-- 10. RPC 3: akkoord vastleggen vanuit checkout.session.completed ----------------
create or replace function public.stripe_record_checkout_completed(
  p_event_id text, p_session jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_ev public.stripe_webhook_events%rowtype;
  v_p  public.profiles%rowtype;
  v_cust text := p_session->>'customer_id';
  v_sid  text := p_session->>'session_id';
begin
  select * into v_ev from public.stripe_webhook_events where stripe_event_id = p_event_id for update;
  if not found or v_ev.status <> 'processing' then
    return jsonb_build_object('result','niet_geclaimd');
  end if;
  select * into v_p from public.profiles where stripe_customer_id = v_cust;
  if not found
     or p_session->>'client_reference_id' is distinct from v_p.id::text
     or p_session->>'metadata_user_id'    is distinct from v_p.id::text
     or p_session->>'terms_accepted'      is distinct from 'true'
     or coalesce(p_session->>'terms_version','') !~ '^\d{4}-\d{2}-\d{2}$'
     or p_session->>'plan' is null or p_session->>'plan' not in ('PRO','PREMIUM')
     or nullif(p_session->>'terms_accepted_at','') is null then
    perform public.stripe_registreer_conflict('sessie_zonder_profiel', p_event_id, v_p.id, v_cust,
      p_session->>'subscription_id', null, jsonb_build_object('session_id', v_sid));
    perform public.stripe_event_afronden(p_event_id, 'conflict', v_p.id, null,
      jsonb_build_object('reden','sessie_niet_te_koppelen'));
    return jsonb_build_object('result','conflict');
  end if;

  insert into public.subscription_terms_acceptances
    (user_id, stripe_checkout_session_id, stripe_customer_id, stripe_subscription_id,
     plan, tier, trial_granted, terms_version, terms_accepted_at, stripe_event_id)
  values (v_p.id, v_sid, v_cust, nullif(p_session->>'subscription_id',''),
     p_session->>'plan', case p_session->>'plan' when 'PRO' then 'pro' else 'premium' end,
     coalesce((p_session->>'trial_granted')::boolean, false),
     p_session->>'terms_version', (p_session->>'terms_accepted_at')::timestamptz, p_event_id)
  on conflict (stripe_checkout_session_id) do nothing;

  perform public.stripe_event_afronden(p_event_id, 'processed', v_p.id, null, jsonb_build_object('akkoord_vastgelegd', true));
  return jsonb_build_object('result','applied');
end $$;

-- 11. RPC 4: mislukte verwerking markeren (Stripe herhaalt dan automatisch) ------
create or replace function public.stripe_mark_event_failed(p_event_id text, p_error text)
returns void language sql security definer set search_path = public, pg_temp as $$
  update public.stripe_webhook_events
     set status = 'failed', detail = jsonb_build_object('fout', left(coalesce(p_error,''), 300))
   where stripe_event_id = p_event_id and status = 'processing'
$$;

comment on table public.stripe_webhook_events is
  'RC1 2C: idempotentie- en auditlog van Stripe-webhookevents (alleen service_role via RPC). Voorgestelde retentie: 13 maanden; nog geen automatische opschoning.';
comment on table public.stripe_billing_conflicts is
  'RC1 2C: geregistreerde billingconflicten (dubbel abonnement, handmatige toegang, onbekende prijs, ...). Nooit automatisch opgelost, geen automatische annulering of refund. Alleen admin leest.';
comment on table public.subscription_terms_acceptances is
  'RC1 2C: append-only akkoordhistorie per Stripe-checkout (terms_version, tijdstip). Retentie/verwijdering bij accountverwijdering = juridisch go-livepunt (fase 7).';

-- 12. Execute-rechten: uitsluitend service_role ------------------------------------
revoke all on function public.stripe_registreer_conflict(text,text,uuid,text,text,text,jsonb),
                       public.stripe_event_afronden(text,text,uuid,timestamptz,jsonb),
                       public.stripe_claim_event(text,text,boolean,timestamptz,text,text),
                       public.stripe_apply_subscription(text,timestamptz,jsonb,jsonb),
                       public.stripe_record_checkout_completed(text,jsonb),
                       public.stripe_mark_event_failed(text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.stripe_claim_event(text,text,boolean,timestamptz,text,text),
                          public.stripe_apply_subscription(text,timestamptz,jsonb,jsonb),
                          public.stripe_record_checkout_completed(text,jsonb),
                          public.stripe_mark_event_failed(text,text)
  to service_role;
-- stripe_status_geeft_toegang is zuiver/immutable en mag voor iedereen leesbaar blijven.
