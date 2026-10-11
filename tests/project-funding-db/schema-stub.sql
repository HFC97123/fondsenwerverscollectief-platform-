-- Testfixture: minimale nabootsing van de live Supabase-omgeving voor de projectfinanciering-tests.
-- De tier-/zichtbaarheids-/deadlinefuncties zijn woordelijk de LIVE definities (uit pg_proc op
-- 2026-10-11); tabellen bevatten alleen de kolommen die deze functies en de migratie gebruiken.
drop schema if exists public cascade; create schema public;
drop schema if exists auth cascade; create schema auth;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant usage on schema public, auth to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create type subsidie_access_tier as enum ('free','pro','premium');
create type subsidie_data_tier as enum ('public','premium');
create type subsidie_source_type as enum ('internet_scan','manual_admin','premium_database','api_partner','csv_import');
create type regeling_status_type as enum ('open','gesloten','doorlopend','aangekondigd','binnenkort','budget_uitgeput');
create type datamoment_type as enum ('aanvraagdeadline','vergaderdatum','vooraanvraag','overig');
create type datamoment_status as enum ('gepland','verzet','geannuleerd');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'member',
  subscription_tier text not null default 'free',
  subscription_active boolean not null default false,
  trial_ends_at timestamptz
);

create table public.funders (
  id uuid primary key default gen_random_uuid(),
  naam text not null, website text, missie text,
  access_tier subsidie_access_tier not null default 'free',
  data_tier subsidie_data_tier not null default 'public',
  source_type subsidie_source_type not null default 'manual_admin',
  classification_reviewed boolean not null default true
);
create table public.subsidieregelingen (
  id uuid primary key default gen_random_uuid(),
  funder_id uuid not null references public.funders(id) on delete cascade,
  naam text not null, website text,
  deadline_datum date,
  status regeling_status_type not null default 'open',
  access_tier subsidie_access_tier not null default 'free',
  data_tier subsidie_data_tier not null default 'public',
  source_type subsidie_source_type not null default 'manual_admin',
  classification_reviewed boolean not null default true
);
create table public.subsidieregeling_rondes (
  id uuid primary key default gen_random_uuid(),
  funder_id uuid not null references public.funders(id) on delete cascade,
  subsidieregeling_id uuid references public.subsidieregelingen(id) on delete cascade,
  type datamoment_type not null default 'aanvraagdeadline',
  naam text, sluitingsdatum date not null, sluitingstijd time,
  open_vanaf date, beoordelingsdatum date, beoordelingsperiode text, toelichting text, bron_url text,
  actief boolean not null default true,
  status datamoment_status not null default 'gepland'
);
alter table public.funders enable row level security;
alter table public.subsidieregelingen enable row level security;
alter table public.subsidieregeling_rondes enable row level security;
revoke all on public.funders, public.subsidieregelingen, public.subsidieregeling_rondes from anon, authenticated;

-- Live tabel subsidie_kompas_programs (kolommen en policies zoals live)
create table public.subsidie_kompas_organizations (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade);
create table public.subsidie_kompas_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.subsidie_kompas_organizations(id) on delete cascade,
  name text not null, description text, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  location text, period_start text, period_end text,
  budget_total numeric, requested_amount numeric, own_contribution numeric,
  previous_grants jsonb not null default '[]', cofinanciers jsonb not null default '[]', linked_schemes jsonb not null default '[]',
  archived_at timestamptz
);
alter table public.subsidie_kompas_programs enable row level security;
create policy "Users create own programs" on public.subsidie_kompas_programs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users delete own programs" on public.subsidie_kompas_programs for delete to authenticated using ((select auth.uid()) = user_id);
create policy "Users read own programs" on public.subsidie_kompas_programs for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users update own programs" on public.subsidie_kompas_programs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ===== LIVE functiedefinities (woordelijk) =====
CREATE OR REPLACE FUNCTION public.current_user_has_premium_access()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (
        role = 'admin'
        or (subscription_tier = 'premium' and subscription_active = true)
        or (subscription_tier = 'premium' and trial_ends_at is not null and trial_ends_at > now())
      )
  );
$function$;
CREATE OR REPLACE FUNCTION public.current_user_has_pro_access()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (
        role = 'admin'
        or (subscription_tier in ('pro', 'premium') and subscription_active = true)
        or (subscription_tier in ('pro', 'premium') and trial_ends_at is not null and trial_ends_at > now())
      )
  );
$function$;
CREATE OR REPLACE FUNCTION public.subsidie_zichtbaar_voor_tier(p_reviewed boolean, p_access_tier subsidie_access_tier, p_data_tier subsidie_data_tier, p_source_type subsidie_source_type, p_tier text)
 RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public', 'pg_temp'
AS $function$
  select case
    when p_reviewed then
      p_access_tier = 'free'
      or (p_access_tier = 'pro' and p_tier in ('pro', 'premium'))
      or (p_access_tier = 'premium' and p_tier = 'premium')
    else
      (p_data_tier = 'public' and p_source_type = 'internet_scan' and p_tier in ('pro', 'premium'))
      or p_tier = 'premium'
  end;
$function$;
CREATE OR REPLACE FUNCTION public.subsidieregeling_volgende_ronde(p_regeling_id uuid, p_nu timestamp with time zone DEFAULT now())
 RETURNS TABLE(ronde_id uuid, sluitingsdatum date, sluitingstijd time without time zone, sluitingsmoment timestamp with time zone, open_vanaf date, beoordelingsdatum date, beoordelingsperiode text, toelichting text, bron_url text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
  select r.id, r.sluitingsdatum, r.sluitingstijd,
    (r.sluitingsdatum + coalesce(r.sluitingstijd, '23:59:59'::time)) at time zone 'Europe/Amsterdam',
    r.open_vanaf, r.beoordelingsdatum, r.beoordelingsperiode, r.toelichting, r.bron_url
  from public.subsidieregeling_rondes r
  where r.subsidieregeling_id = p_regeling_id
    and r.actief and r.status <> 'geannuleerd'
    and (r.sluitingsdatum + coalesce(r.sluitingstijd, '23:59:59'::time)) at time zone 'Europe/Amsterdam' >= p_nu
  order by (r.sluitingsdatum + coalesce(r.sluitingstijd, '23:59:59'::time)) at time zone 'Europe/Amsterdam' asc
  limit 1;
$function$;
CREATE OR REPLACE FUNCTION public.funder_volgende_datamoment(p_funder_id uuid, p_type datamoment_type DEFAULT NULL::datamoment_type, p_nu timestamp with time zone DEFAULT now())
 RETURNS TABLE(datamoment_id uuid, type datamoment_type, naam text, sluitingsdatum date, sluitingstijd time without time zone, sluitingsmoment timestamp with time zone, status datamoment_status, toelichting text, bron_url text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
  select r.id, r.type, r.naam, r.sluitingsdatum, r.sluitingstijd,
    (r.sluitingsdatum + coalesce(r.sluitingstijd, '23:59:59'::time)) at time zone 'Europe/Amsterdam',
    r.status, r.toelichting, r.bron_url
  from public.subsidieregeling_rondes r
  where r.funder_id = p_funder_id
    and r.subsidieregeling_id is null
    and r.actief and r.status <> 'geannuleerd'
    and (p_type is null or r.type = p_type)
    and (r.sluitingsdatum + coalesce(r.sluitingstijd, '23:59:59'::time)) at time zone 'Europe/Amsterdam' >= p_nu
  order by (r.sluitingsdatum + coalesce(r.sluitingstijd, '23:59:59'::time)) at time zone 'Europe/Amsterdam' asc
  limit 1;
$function$;
