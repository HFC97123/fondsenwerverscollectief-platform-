-- Minimale nabootsing van het Supabase-schema voor de test van 20261014120000_voorstel_metadata.sql
-- (staat van de database NA 20261011180913 en 20261014095805). Raakt nooit de live database.
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
grant usage on schema public to public;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon, service_role; grant execute on function auth.uid() to authenticated;

create table public.subsidie_kompas_programs (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), naam text, constraint p_id_user unique (id, user_id));
grant select on public.subsidie_kompas_programs to authenticated;
-- premium = alleen zichtbaar voor Premium (nabootsing van de tier-zichtbaarheid van de echte kompas_dekkingsplan); zichtbaar=false = voor niemand zichtbaar.
create table public.funders (id uuid primary key default gen_random_uuid(), premium boolean not null default false);
create table public.subsidieregelingen (id uuid primary key default gen_random_uuid(), zichtbaar boolean not null default true, premium boolean not null default false);

-- Abonnement per test te kiezen met: select set_config('test.tier','pro'|'premium'|'free',false)
create function public.current_user_has_pro_access() returns boolean language sql stable security definer as $$ select current_setting('test.tier', true) in ('pro','premium') $$;
create function public.current_user_has_premium_access() returns boolean language sql stable security definer as $$ select current_setting('test.tier', true) = 'premium' $$;
grant execute on function public.current_user_has_pro_access(), public.current_user_has_premium_access() to authenticated, anon;

create table public.subsidie_kompas_program_funding (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  program_id uuid not null,
  scheme_id uuid null references public.subsidieregelingen (id) on delete set null,
  funder_id uuid null references public.funders (id) on delete set null,
  requested_amount numeric null, awarded_amount numeric null,
  status text not null default 'interesting',
  eigen_deadline date null, reminder_enabled boolean not null default true, notes text null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  financier_naam text,
  constraint subsidie_kompas_program_funding_program_fkey foreign key (program_id, user_id) references public.subsidie_kompas_programs (id, user_id) on delete cascade,
  constraint subsidie_kompas_program_funding_status_chk check (status in ('interesting', 'preparing', 'submitted', 'awarded', 'rejected')),
  constraint subsidie_kompas_program_funding_niet_beide_bronnen_chk check (scheme_id is null or funder_id is null),
  constraint subsidie_kompas_program_funding_hoogstens_een_bron_chk check (num_nonnulls(scheme_id, funder_id, financier_naam) <= 1),
  constraint subsidie_kompas_program_funding_naam_chk check (financier_naam is null or char_length(btrim(financier_naam)) between 1 and 200)
);
create unique index subsidie_kompas_program_funding_unique_scheme on public.subsidie_kompas_program_funding (program_id, scheme_id) where scheme_id is not null;
create unique index subsidie_kompas_program_funding_unique_funder on public.subsidie_kompas_program_funding (program_id, funder_id) where funder_id is not null;
create unique index subsidie_kompas_program_funding_unique_naam on public.subsidie_kompas_program_funding (program_id, lower(btrim(financier_naam))) where financier_naam is not null;
create or replace function public.subsidie_kompas_program_funding_voor_insert()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  new.financier_naam := nullif(btrim(new.financier_naam), '');

  if num_nonnulls(new.scheme_id, new.funder_id, new.financier_naam) <> 1 then
    raise exception 'Een financieringsregel verwijst naar precies een regeling, een fonds of een genoemde financier'
      using errcode = '23514';
  end if;

  new.created_at := now();
  new.updated_at := now();

  return new;
end;
$function$;

create or replace function public.subsidie_kompas_program_funding_voor_update()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.program_id is distinct from old.program_id then
    raise exception 'user_id en program_id van een financieringsregel zijn onveranderlijk'
      using errcode = '23514';
  end if;

  if new.scheme_id is distinct from old.scheme_id
     and not (old.scheme_id is not null and new.scheme_id is null) then
    raise exception 'scheme_id van een financieringsregel is onveranderlijk' using errcode = '23514';
  end if;

  if new.funder_id is distinct from old.funder_id
     and not (old.funder_id is not null and new.funder_id is null) then
    raise exception 'funder_id van een financieringsregel is onveranderlijk' using errcode = '23514';
  end if;

  -- De naam van een genoemde financier mag worden gecorrigeerd, maar de regel blijft een naam-regel.
  new.financier_naam := case when new.financier_naam is null then null else nullif(btrim(new.financier_naam), '') end;

  if new.financier_naam is distinct from old.financier_naam
     and (old.financier_naam is null or new.financier_naam is null) then
    raise exception 'financier_naam kan alleen worden gewijzigd bij een regel met een genoemde financier'
      using errcode = '23514';
  end if;

  new.created_at := old.created_at;
  new.updated_at := clock_timestamp();

  return new;
end;
$function$;


create trigger subsidie_kompas_program_funding_voor_insert before insert on public.subsidie_kompas_program_funding for each row execute function public.subsidie_kompas_program_funding_voor_insert();
create trigger subsidie_kompas_program_funding_voor_update before update on public.subsidie_kompas_program_funding for each row execute function public.subsidie_kompas_program_funding_voor_update();
alter table public.subsidie_kompas_program_funding enable row level security;
create policy r on public.subsidie_kompas_program_funding for select to authenticated using ((select auth.uid()) = user_id);
create policy i on public.subsidie_kompas_program_funding for insert to authenticated with check ((select auth.uid()) = user_id and exists (select 1 from public.subsidie_kompas_programs p where p.id = program_id and p.user_id = (select auth.uid())));
create policy u on public.subsidie_kompas_program_funding for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy d on public.subsidie_kompas_program_funding for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on table public.subsidie_kompas_program_funding from public, anon, authenticated;
grant select, delete on table public.subsidie_kompas_program_funding to authenticated;
grant insert (user_id, program_id, scheme_id, funder_id, requested_amount, awarded_amount, status, eigen_deadline, reminder_enabled, notes, financier_naam) on table public.subsidie_kompas_program_funding to authenticated;
grant update (requested_amount, awarded_amount, status, eigen_deadline, reminder_enabled, notes, financier_naam) on table public.subsidie_kompas_program_funding to authenticated;
grant all on table public.subsidie_kompas_program_funding to service_role;

-- Nagebootste kompas_dekkingsplan(): zelfde eigenaarschapscontrole en bron_status-semantiek als de echte, met zichtbaarheid per abonnement
-- (test.tier): een Premium-regeling of -fonds is alleen zichtbaar voor Premium; de echte masking-regels zijn hier niet het onderwerp.
create function public.kompas_dekkingsplan(p_program_id uuid)
returns table (id uuid, program_id uuid, bron_status text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Niet ingelogd' using errcode = '28000'; end if;
  if p_program_id is null or not exists (select 1 from public.subsidie_kompas_programs p where p.id = p_program_id and p.user_id = auth.uid()) then
    raise exception 'Project niet gevonden' using errcode = '42501';
  end if;
  return query
  select pf.id, pf.program_id,
    case when pf.financier_naam is not null then 'zichtbaar'
         when pf.scheme_id is null and pf.funder_id is null then 'verwijderd'
         when pf.scheme_id is not null and (select s.zichtbaar and (not s.premium or public.current_user_has_premium_access()) from public.subsidieregelingen s where s.id = pf.scheme_id) then 'zichtbaar'
         when pf.funder_id is not null and (select (not f.premium) or public.current_user_has_premium_access() from public.funders f where f.id = pf.funder_id) then 'zichtbaar'
         else 'verborgen' end
  from public.subsidie_kompas_program_funding pf where pf.program_id = p_program_id and pf.user_id = auth.uid();
end $$;
revoke all on function public.kompas_dekkingsplan(uuid) from public, anon;
grant execute on function public.kompas_dekkingsplan(uuid) to authenticated, service_role;

-- Testhulpen (draaien met de rechten van de huidige rol)
create function public.t_ok(label text, stmt text) returns void language plpgsql as $$
begin execute stmt; raise notice 'OK    %', label;
exception when others then raise notice 'FAIL  % (onverwachte fout: %)', label, sqlerrm; end $$;
create function public.t_fout(label text, stmt text, verwacht_code text default null) returns void language plpgsql as $$
begin execute stmt; raise notice 'FAIL  % (had moeten falen)', label;
exception when others then
  if verwacht_code is null or sqlstate = verwacht_code then raise notice 'OK    % [%]', label, sqlstate;
  else raise notice 'FAIL  % (sqlstate % i.p.v. %: %)', label, sqlstate, verwacht_code, sqlerrm; end if; end $$;
create function public.t_gelijk(label text, q text, verwacht text) returns void language plpgsql as $$
declare v text;
begin execute q into v;
  if v is not distinct from verwacht then raise notice 'OK    %', label; else raise notice 'FAIL  % (kreeg %, verwacht %)', label, v, verwacht; end if; end $$;

-- Vaste testgegevens (JSON-fixtures), leesbaar voor de testrollen
create table public.t_json (naam text primary key, j jsonb not null);
grant select on public.t_json to authenticated, service_role, anon;
