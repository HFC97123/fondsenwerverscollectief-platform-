-- Stap 2 van de goedgekeurde deployvolgorde (zie status-developer-guide.md):
-- audit-log + admin-RPC's voor funders EN subsidieregelingen, inclusief
-- bulkvarianten. Puur additief: geen bestaande grants/policies/objecten
-- worden gewijzigd. Autorisatie loopt uitsluitend via current_user_is_admin()
-- (role='admin' op profiles), nooit via subscription_tier.

-- 1. Audit-log tabel -------------------------------------------------------
create table public.classification_audit_log (
  id uuid primary key default gen_random_uuid(),
  tabel text not null check (tabel in ('funders', 'subsidieregelingen')),
  rij_id uuid not null,
  gewijzigd_door uuid references auth.users(id),
  oude_data_tier public.subsidie_data_tier,
  nieuwe_data_tier public.subsidie_data_tier,
  oude_source_type public.subsidie_source_type,
  nieuwe_source_type public.subsidie_source_type,
  reden text,
  gewijzigd_op timestamptz not null default now()
);

comment on table public.classification_audit_log is
  'Auditlog van elke handmatige classificatiewijziging op funders/subsidieregelingen. Schrijven gebeurt uitsluitend intern vanuit de admin_classify_*/admin_bulk_classify_*-functies (SECURITY DEFINER); er bestaat geen INSERT/UPDATE/DELETE-policy.';

alter table public.classification_audit_log enable row level security;

create policy "alleen_admin_leest_audit" on public.classification_audit_log
  for select
  using (public.current_user_is_admin());

-- Geen INSERT/UPDATE/DELETE-policy: RLS blokkeert dit voor anon/authenticated
-- volledig; de SECURITY DEFINER-functies hieronder schrijven als functie-
-- eigenaar en omzeilen RLS op de gebruikelijke, bedoelde manier.
revoke all on public.classification_audit_log from public, anon, authenticated;
grant select on public.classification_audit_log to authenticated; -- RLS beperkt dit alsnog tot admins

-- 2. Enkelvoudige admin-RPC's ----------------------------------------------
create or replace function public.admin_classify_funder(
  p_funder_id uuid,
  p_data_tier public.subsidie_data_tier,
  p_source_type public.subsidie_source_type,
  p_reviewed boolean default true,
  p_reden text default null
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_oud record;
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen classificaties wijzigen.' using errcode = '42501';
  end if;

  select data_tier, source_type into v_oud
  from public.funders
  where id = p_funder_id
  for update;

  if not found then
    raise exception 'Fonds niet gevonden: %', p_funder_id;
  end if;

  update public.funders
     set data_tier = p_data_tier,
         source_type = p_source_type,
         classification_reviewed = p_reviewed
   where id = p_funder_id;

  insert into public.classification_audit_log
    (tabel, rij_id, gewijzigd_door, oude_data_tier, nieuwe_data_tier, oude_source_type, nieuwe_source_type, reden)
  values
    ('funders', p_funder_id, auth.uid(), v_oud.data_tier, p_data_tier, v_oud.source_type, p_source_type, p_reden);
end;
$$;

create or replace function public.admin_classify_subsidieregeling(
  p_regeling_id uuid,
  p_data_tier public.subsidie_data_tier,
  p_source_type public.subsidie_source_type,
  p_reviewed boolean default true,
  p_reden text default null
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_oud record;
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen classificaties wijzigen.' using errcode = '42501';
  end if;

  select data_tier, source_type into v_oud
  from public.subsidieregelingen
  where id = p_regeling_id
  for update;

  if not found then
    raise exception 'Subsidieregeling niet gevonden: %', p_regeling_id;
  end if;

  update public.subsidieregelingen
     set data_tier = p_data_tier,
         source_type = p_source_type,
         classification_reviewed = p_reviewed
   where id = p_regeling_id;

  insert into public.classification_audit_log
    (tabel, rij_id, gewijzigd_door, oude_data_tier, nieuwe_data_tier, oude_source_type, nieuwe_source_type, reden)
  values
    ('subsidieregelingen', p_regeling_id, auth.uid(), v_oud.data_tier, p_data_tier, v_oud.source_type, p_source_type, p_reden);
end;
$$;

-- 3. Bulkvarianten -----------------------------------------------------------
-- Set-based: één UPDATE...RETURNING gevolgd door één INSERT...SELECT, zodat
-- exact één auditregel per daadwerkelijk gewijzigde rij ontstaat. Niet-
-- bestaande id's in de array worden stilzwijgend overgeslagen (geen fout),
-- consistent met een bulkoperatie.
create or replace function public.admin_bulk_classify_funders(
  p_funder_ids uuid[],
  p_data_tier public.subsidie_data_tier,
  p_source_type public.subsidie_source_type,
  p_reviewed boolean default true,
  p_reden text default null
) returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_aantal integer;
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen classificaties wijzigen.' using errcode = '42501';
  end if;

  with te_wijzigen as (
    select id, data_tier, source_type
    from public.funders
    where id = any (p_funder_ids)
    for update
  ),
  bijgewerkt as (
    update public.funders f
       set data_tier = p_data_tier,
           source_type = p_source_type,
           classification_reviewed = p_reviewed
      from te_wijzigen
     where f.id = te_wijzigen.id
    returning f.id, te_wijzigen.data_tier as oude_data_tier, te_wijzigen.source_type as oude_source_type
  )
  insert into public.classification_audit_log
    (tabel, rij_id, gewijzigd_door, oude_data_tier, nieuwe_data_tier, oude_source_type, nieuwe_source_type, reden)
  select 'funders', bijgewerkt.id, auth.uid(), bijgewerkt.oude_data_tier, p_data_tier, bijgewerkt.oude_source_type, p_source_type, p_reden
  from bijgewerkt;

  get diagnostics v_aantal = row_count;
  return v_aantal;
end;
$$;

create or replace function public.admin_bulk_classify_subsidieregelingen(
  p_regeling_ids uuid[],
  p_data_tier public.subsidie_data_tier,
  p_source_type public.subsidie_source_type,
  p_reviewed boolean default true,
  p_reden text default null
) returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_aantal integer;
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen classificaties wijzigen.' using errcode = '42501';
  end if;

  with te_wijzigen as (
    select id, data_tier, source_type
    from public.subsidieregelingen
    where id = any (p_regeling_ids)
    for update
  ),
  bijgewerkt as (
    update public.subsidieregelingen s
       set data_tier = p_data_tier,
           source_type = p_source_type,
           classification_reviewed = p_reviewed
      from te_wijzigen
     where s.id = te_wijzigen.id
    returning s.id, te_wijzigen.data_tier as oude_data_tier, te_wijzigen.source_type as oude_source_type
  )
  insert into public.classification_audit_log
    (tabel, rij_id, gewijzigd_door, oude_data_tier, nieuwe_data_tier, oude_source_type, nieuwe_source_type, reden)
  select 'subsidieregelingen', bijgewerkt.id, auth.uid(), bijgewerkt.oude_data_tier, p_data_tier, bijgewerkt.oude_source_type, p_source_type, p_reden
  from bijgewerkt;

  get diagnostics v_aantal = row_count;
  return v_aantal;
end;
$$;

-- 4. Rechten op de vier functies: nooit anon, alleen authenticated ----------
-- (de admin-check binnen elke functie is de echte poort, zoals bij de
-- bestaande current_user_has_premium_access()-achtige functies.)
revoke all on function public.admin_classify_funder(uuid, public.subsidie_data_tier, public.subsidie_source_type, boolean, text) from public, anon;
grant execute on function public.admin_classify_funder(uuid, public.subsidie_data_tier, public.subsidie_source_type, boolean, text) to authenticated;

revoke all on function public.admin_classify_subsidieregeling(uuid, public.subsidie_data_tier, public.subsidie_source_type, boolean, text) from public, anon;
grant execute on function public.admin_classify_subsidieregeling(uuid, public.subsidie_data_tier, public.subsidie_source_type, boolean, text) to authenticated;

revoke all on function public.admin_bulk_classify_funders(uuid[], public.subsidie_data_tier, public.subsidie_source_type, boolean, text) from public, anon;
grant execute on function public.admin_bulk_classify_funders(uuid[], public.subsidie_data_tier, public.subsidie_source_type, boolean, text) to authenticated;

revoke all on function public.admin_bulk_classify_subsidieregelingen(uuid[], public.subsidie_data_tier, public.subsidie_source_type, boolean, text) from public, anon;
grant execute on function public.admin_bulk_classify_subsidieregelingen(uuid[], public.subsidie_data_tier, public.subsidie_source_type, boolean, text) to authenticated;
