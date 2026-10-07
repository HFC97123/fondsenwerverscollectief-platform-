-- Test voor 20261007120000_production_readiness_rechten_opschonen.sql
-- Draait op een wegwerp-Postgres met nagebootste rechten (Supabase-standaard:
-- anon/authenticated hebben alles op public-tabellen; functies zijn standaard
-- uitvoerbaar voor PUBLIC). Niets raakt een live omgeving.
\set ON_ERROR_STOP on
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
drop schema if exists public cascade; create schema public;
grant usage on schema public to anon, authenticated, service_role;
create schema if not exists t; drop table if exists t.res; create table t.res(ok boolean, naam text);
create or replace function t.ok(c boolean, n text) returns void language plpgsql as $f$ begin insert into t.res values (coalesce(c,false), n); if not coalesce(c,false) then raise warning 'FAIL: %', n; else raise notice 'ok  %', n; end if; end $f$;

create table public.profiles (id uuid primary key, subscription_tier text, trial_started_at timestamptz, trial_ends_at timestamptz);
create table public.product_aankopen (id uuid primary key);
create table public.funders (id uuid primary key);
grant all on public.profiles, public.product_aankopen, public.funders to anon, authenticated, service_role;

insert into public.profiles values ('00000000-0000-0000-0000-000000000001','free', now() - interval '2 days', now() + interval '5 days');

create function public.start_trial(p_tier text) returns void language sql security definer as $$ select 1 $$;
create function public.admin_oud_a() returns int language sql security definer as $$ select 1 $$;
create function public.admin_oud_b(p uuid, q text) returns int language sql security definer as $$ select 1 $$;
create function public.admin_nieuw_a() returns int language sql security definer as $$ select 1 $$;
revoke execute on function public.admin_nieuw_a() from public, anon; grant execute on function public.admin_nieuw_a() to authenticated;
create function public.publieke_fondsen_telling() returns int language sql security definer as $$ select 1 $$;
create function public.current_user_has_pro_access() returns boolean language sql security definer as $$ select false $$;
create function public.stripe_apply_subscription(p text) returns int language sql security definer as $$ select 1 $$;
revoke execute on function public.stripe_apply_subscription(text) from public; grant execute on function public.stripe_apply_subscription(text) to service_role;

-- VOOR de migratie: de te dichten gaten bestaan (anders test deze test niets)
select t.ok(has_function_privilege('anon','public.start_trial(text)','EXECUTE'), 'voor: anon kan start_trial uitvoeren');
select t.ok(has_function_privilege('authenticated','public.start_trial(text)','EXECUTE'), 'voor: authenticated kan start_trial uitvoeren');
select t.ok(has_table_privilege('authenticated','public.profiles','TRUNCATE'), 'voor: authenticated heeft TRUNCATE op profiles');
select t.ok(has_table_privilege('anon','public.product_aankopen','TRUNCATE'), 'voor: anon heeft TRUNCATE op product_aankopen');
select t.ok(has_function_privilege('anon','public.admin_oud_a()','EXECUTE'), 'voor: anon kan oude admin-functie uitvoeren');

\ir ../../migrations/20261007120000_production_readiness_rechten_opschonen.sql
-- tweede keer: idempotent
\ir ../../migrations/20261007120000_production_readiness_rechten_opschonen.sql

-- NA de migratie
select t.ok(not has_function_privilege('anon','public.start_trial(text)','EXECUTE'), 'na: anon kan start_trial niet meer uitvoeren');
select t.ok(not has_function_privilege('authenticated','public.start_trial(text)','EXECUTE'), 'na: authenticated kan start_trial niet meer uitvoeren');
select t.ok(not has_function_privilege('public','public.start_trial(text)','EXECUTE'), 'na: PUBLIC kan start_trial niet meer uitvoeren');
select t.ok(to_regprocedure('public.start_trial(text)') is not null, 'na: start_trial bestaat nog (niet verwijderd)');

select t.ok(not has_table_privilege('authenticated','public.profiles','TRUNCATE'), 'na: authenticated geen TRUNCATE op profiles');
select t.ok(not has_table_privilege('anon','public.profiles','TRUNCATE'), 'na: anon geen TRUNCATE op profiles');
select t.ok(not has_table_privilege('authenticated','public.product_aankopen','TRUNCATE'), 'na: authenticated geen TRUNCATE op product_aankopen');
select t.ok(not has_table_privilege('anon','public.product_aankopen','TRUNCATE'), 'na: anon geen TRUNCATE op product_aankopen');
select t.ok(not has_table_privilege('authenticated','public.profiles','TRIGGER') and not has_table_privilege('authenticated','public.profiles','REFERENCES'), 'na: geen TRIGGER/REFERENCES op profiles voor authenticated');
select t.ok(has_table_privilege('authenticated','public.profiles','SELECT') and has_table_privilege('authenticated','public.profiles','INSERT') and has_table_privilege('authenticated','public.profiles','UPDATE') and has_table_privilege('authenticated','public.profiles','DELETE'), 'na: SELECT/INSERT/UPDATE/DELETE op profiles voor authenticated ongewijzigd');
select t.ok(has_table_privilege('anon','public.product_aankopen','SELECT'), 'na: anon-SELECT op product_aankopen ongewijzigd (RLS bepaalt)');
select t.ok(has_table_privilege('service_role','public.profiles','TRUNCATE'), 'na: service_role ongewijzigd');
select t.ok(has_table_privilege('authenticated','public.funders','TRUNCATE'), 'na: andere tabellen bewust ongemoeid (funders)');

select t.ok(not has_function_privilege('anon','public.admin_oud_a()','EXECUTE') and not has_function_privilege('anon','public.admin_oud_b(uuid,text)','EXECUTE'), 'na: anon kan oude admin-functies niet meer uitvoeren');
select t.ok(not has_function_privilege('public','public.admin_oud_a()','EXECUTE'), 'na: PUBLIC kan oude admin-functie niet meer uitvoeren');
select t.ok(has_function_privilege('authenticated','public.admin_oud_a()','EXECUTE') and has_function_privilege('authenticated','public.admin_oud_b(uuid,text)','EXECUTE'), 'na: authenticated (adminconsole) behoudt oude admin-functies');
select t.ok(has_function_privilege('service_role','public.admin_oud_a()','EXECUTE'), 'na: service_role behoudt oude admin-functies (ongewijzigd)');
select t.ok(not has_function_privilege('anon','public.admin_nieuw_a()','EXECUTE') and has_function_privilege('authenticated','public.admin_nieuw_a()','EXECUTE') and not has_function_privilege('service_role','public.admin_nieuw_a()','EXECUTE'), 'na: nieuwe admin-functie ongewijzigd (alleen authenticated)');

select t.ok(has_function_privilege('anon','public.publieke_fondsen_telling()','EXECUTE'), 'na: publieke_fondsen_telling blijft voor anon (publieke teller)');
select t.ok(has_function_privilege('anon','public.current_user_has_pro_access()','EXECUTE'), 'na: current_user_has_pro_access ongemoeid (RLS-policies)');
select t.ok(has_function_privilege('service_role','public.stripe_apply_subscription(text)','EXECUTE') and not has_function_privilege('authenticated','public.stripe_apply_subscription(text)','EXECUTE'), 'na: Stripe-RPC blijft service-role-only');

-- Data onaangetast: trialhistorie blijft staan
select t.ok((select count(*) from public.profiles where trial_started_at is not null and trial_ends_at is not null)=1, 'na: trialhistorie op profiles onaangetast');

select case when count(*) filter (where not ok)=0 then 'ALLE_TESTS_GESLAAGD ('||count(*)||' checks)' else 'FOUTEN: '||count(*) filter (where not ok) end from t.res;
