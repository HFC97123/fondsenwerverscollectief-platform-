-- Accountarchitectuur: directe toegang na registratie (geen handmatige
-- goedkeuring meer), onboardingvragen (los van accounttoegang), losse
-- productaankopen (los van het SaaS-abonnement), en een veilige RPC om een
-- proefperiode te starten (7 dagen Pro / 24 uur Premium).
--
-- Uitgangspunten:
--  - Toegang tot SubsidieKompas is en blijft nooit afhankelijk van
--    profiles.status; die kolom bleek in de front-end al nergens
--    gatend te zijn (geen route/RLS controleert erop), maar de trigger
--    zette 'm wel op 'pending' en de admin-UI toont "aanvragen ter
--    beoordeling" -- dat moet nu kloppen met de werkelijkheid: direct
--    'approved'.
--  - Nieuwe tabellen krijgen hun eigen RLS + expliciete GRANT aan
--    'authenticated' (RLS alleen is niet genoeg zonder GRANT, zoals
--    migratie 3 in deze repo al vaststelde).
--  - Gevoelige/serverzijde-berekende schrijfacties (proefperiode starten,
--    een aankoop registreren) lopen via SECURITY DEFINER RPC's, nooit via
--    een rechtstreekse tabel-update vanuit de client -- consistent met het
--    bestaande patroon voor admin_set_subscription/_role/_status.

-- 1. Directe toegang: nieuwe accounts krijgen meteen status 'approved'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  insert into public.profiles (
    id,
    first_name,
    last_name,
    email,
    member_type,
    motivation,
    status,
    created_at
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'member_type', ''),
    coalesce(new.raw_user_meta_data ->> 'motivation', ''),
    'approved',
    now()
  );

  return new;
end;
$function$;

-- Bestaande accounts die nog op 'pending' stonden (nooit ergens
-- daadwerkelijk gatend, maar nu ook feitelijk correct): direct goedkeuren.
update public.profiles
set status = 'approved',
    approved_at = coalesce(approved_at, now()),
    approved_by = coalesce(approved_by, 'systeem (automatische directe toegang, geen handmatige beoordeling meer)')
where status = 'pending';

-- 2. Onboarding: bewust een aparte tabel, los van `profiles`. Antwoorden
-- zijn nooit een toegangscriterium en worden door de gebruiker zelf
-- geschreven (profiles zelf heeft bewust geen self-UPDATE-policy).
create table if not exists public.profile_onboarding (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  organisatie text,
  functie text,
  waar_naar_op_zoek text,
  doel text,
  overgeslagen boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profile_onboarding enable row level security;

drop policy if exists "Gebruikers kunnen eigen onboarding aanmaken" on public.profile_onboarding;
create policy "Gebruikers kunnen eigen onboarding aanmaken"
  on public.profile_onboarding for insert
  with check (auth.uid() = user_id);

drop policy if exists "Gebruikers kunnen eigen onboarding bekijken" on public.profile_onboarding;
create policy "Gebruikers kunnen eigen onboarding bekijken"
  on public.profile_onboarding for select
  using (auth.uid() = user_id);

drop policy if exists "Gebruikers kunnen eigen onboarding bijwerken" on public.profile_onboarding;
create policy "Gebruikers kunnen eigen onboarding bijwerken"
  on public.profile_onboarding for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Gebruikers kunnen eigen onboarding verwijderen" on public.profile_onboarding;
create policy "Gebruikers kunnen eigen onboarding verwijderen"
  on public.profile_onboarding for delete
  using (auth.uid() = user_id);

drop policy if exists "Admins kunnen alle onboarding bekijken" on public.profile_onboarding;
create policy "Admins kunnen alle onboarding bekijken"
  on public.profile_onboarding for select
  using (private.is_admin());

grant select, insert, update, delete on public.profile_onboarding to authenticated;

-- 3. Losse productaankopen: technisch volledig los van het SaaS-abonnement
-- (profiles.subscription_tier/_active). Schrijven uitsluitend via de
-- admin-RPC hieronder, zoals bij subscription/rol/status.
create table if not exists public.product_aankopen (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_type text not null check (product_type in ('cursus', 'template', 'download', 'overig')),
  product_naam text not null,
  bedrag numeric,
  bron text not null default 'handmatig' check (bron in ('handmatig', 'stripe')),
  externe_referentie text,
  notities text,
  aangeschaft_op timestamptz not null default now(),
  geregistreerd_door text
);

alter table public.product_aankopen enable row level security;

drop policy if exists "Gebruikers kunnen eigen aankopen bekijken" on public.product_aankopen;
create policy "Gebruikers kunnen eigen aankopen bekijken"
  on public.product_aankopen for select
  using (auth.uid() = user_id);

drop policy if exists "Admins kunnen alle aankopen bekijken" on public.product_aankopen;
create policy "Admins kunnen alle aankopen bekijken"
  on public.product_aankopen for select
  using (private.is_admin());

grant select on public.product_aankopen to authenticated;

create or replace function public.admin_grant_purchase(
  p_user_id uuid,
  p_product_type text,
  p_product_naam text,
  p_bedrag numeric default null,
  p_notities text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_admin_email text;
  v_id uuid;
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  if p_product_type not in ('cursus', 'template', 'download', 'overig') then
    raise exception 'Ongeldig producttype: %', p_product_type;
  end if;

  select email into v_admin_email from public.profiles where id = auth.uid();

  insert into public.product_aankopen (user_id, product_type, product_naam, bedrag, bron, notities, geregistreerd_door)
  values (p_user_id, p_product_type, p_product_naam, p_bedrag, 'handmatig', p_notities, coalesce(v_admin_email, 'admin'))
  returning id into v_id;

  return v_id;
end;
$function$;

grant execute on function public.admin_grant_purchase(uuid, text, text, numeric, text) to authenticated;

-- 4. Proefperiode starten: 7 dagen Pro of 24 uur Premium, uitsluitend voor
-- de ingelogde gebruiker zelf, uitsluitend één keer, nooit voor wie al een
-- actief betaald abonnement of het beheerdersrol heeft. De duur staat vast
-- in de functie (nooit clientzijdig aan te leveren), zodat dit nooit een
-- manier kan worden om zichzelf gratis Pro/Premium toe te kennen buiten de
-- bedoelde, eenmalige proefperiode om.
create or replace function public.start_trial(p_tier text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_profile public.profiles%rowtype;
  v_duration interval;
begin
  if auth.uid() is null then
    raise exception 'U moet ingelogd zijn om een proefperiode te starten.' using errcode = '28000';
  end if;

  if p_tier not in ('pro', 'premium') then
    raise exception 'Ongeldig proefabonnement: %', p_tier;
  end if;

  select * into v_profile from public.profiles where id = auth.uid();

  if not found then
    raise exception 'Profiel niet gevonden.';
  end if;

  if v_profile.role = 'admin' then
    raise exception 'Beheerders hebben al volledige toegang; een proefperiode is niet nodig.';
  end if;

  if v_profile.subscription_active then
    raise exception 'U heeft al een actief betaald abonnement.';
  end if;

  if v_profile.trial_started_at is not null then
    raise exception 'U heeft al eerder een proefperiode gebruikt.';
  end if;

  v_duration := case p_tier when 'premium' then interval '24 hours' else interval '7 days' end;

  update public.profiles
  set subscription_tier = p_tier,
      subscription_active = false,
      trial_started_at = now(),
      trial_ends_at = now() + v_duration
  where id = auth.uid();
end;
$function$;

grant execute on function public.start_trial(text) to authenticated;
