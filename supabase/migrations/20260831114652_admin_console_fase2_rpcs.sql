-- ============================================================
-- FASE 2: Beheerconsole — admin-only read/write RPC's
-- Puur additief: nieuwe functies, geen kolom-/tabelwijziging.
-- Patroon exact zoals stap 2 (admin_classify_*): SECURITY DEFINER,
-- current_user_is_admin() als eerste check, EXECUTE alleen aan authenticated.
-- ============================================================

-- ------------------------------------------------------------
-- 1. LEZEN: funders
-- ------------------------------------------------------------
create or replace function public.admin_list_funders(
  p_funder_id uuid default null,
  p_search text default null,
  p_type public.funder_type default null,
  p_status text default null,
  p_data_tier public.subsidie_data_tier default null,
  p_source_type public.subsidie_source_type default null,
  p_classification_reviewed boolean default null,
  p_sort_column text default 'naam',
  p_sort_direction text default 'asc',
  p_limit int default 50,
  p_offset int default 0
) returns table (
  id uuid, naam text, type public.funder_type, status text, website text, missie text,
  bijdrage_min numeric, bijdrage_max numeric, jaarbudget numeric, prioriteit int,
  bron text, research_source text,
  contactpersoon text, contactpersoon_prive boolean, email text, email_prive boolean,
  telefoon text, telefoon_prive boolean, adres text,
  enrichment_status public.enrichment_status_type, last_researched_at timestamptz,
  data_tier public.subsidie_data_tier, source_type public.subsidie_source_type, classification_reviewed boolean,
  created_at timestamptz, updated_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  if p_sort_column is null or p_sort_column <> all (array['naam','prioriteit','jaarbudget','created_at','updated_at','status']) then
    p_sort_column := 'naam';
  end if;
  if p_sort_direction is null or lower(p_sort_direction) not in ('asc','desc') then
    p_sort_direction := 'asc';
  end if;
  p_limit := least(greatest(coalesce(p_limit, 50), 1), 200);
  p_offset := greatest(coalesce(p_offset, 0), 0);

  return query execute format(
    'select f.id, f.naam, f.type, f.status, f.website, f.missie,
            f.bijdrage_min, f.bijdrage_max, f.jaarbudget, f.prioriteit,
            f.bron, f.research_source,
            f.contactpersoon, f.contactpersoon_prive, f.email, f.email_prive,
            f.telefoon, f.telefoon_prive, f.adres,
            f.enrichment_status, f.last_researched_at,
            f.data_tier, f.source_type, f.classification_reviewed,
            f.created_at, f.updated_at,
            count(*) over() as total_count
     from public.funders f
     where ($1 is null or f.id = $1)
       and ($2 is null or f.naam ilike ''%%'' || $2 || ''%%'')
       and ($3 is null or f.type = $3)
       and ($4 is null or f.status = $4)
       and ($5 is null or f.data_tier = $5)
       and ($6 is null or f.source_type = $6)
       and ($7 is null or f.classification_reviewed = $7)
     order by %I %s nulls last, f.id
     limit $8 offset $9',
    p_sort_column, p_sort_direction
  ) using p_funder_id, p_search, p_type, p_status, p_data_tier, p_source_type, p_classification_reviewed, p_limit, p_offset;
end;
$$;

revoke all on function public.admin_list_funders(uuid, text, public.funder_type, text, public.subsidie_data_tier, public.subsidie_source_type, boolean, text, text, int, int) from public;
grant execute on function public.admin_list_funders(uuid, text, public.funder_type, text, public.subsidie_data_tier, public.subsidie_source_type, boolean, text, text, int, int) to authenticated;

-- ------------------------------------------------------------
-- 2. LEZEN: subsidieregelingen
-- ------------------------------------------------------------
create or replace function public.admin_list_subsidieregelingen(
  p_regeling_id uuid default null,
  p_funder_id uuid default null,
  p_search text default null,
  p_status public.regeling_status_type default null,
  p_data_tier public.subsidie_data_tier default null,
  p_source_type public.subsidie_source_type default null,
  p_classification_reviewed boolean default null,
  p_sort_column text default 'naam',
  p_sort_direction text default 'asc',
  p_limit int default 50,
  p_offset int default 0
) returns table (
  id uuid, funder_id uuid, funder_naam text, naam text, thema text,
  bedrag_min numeric, bedrag_max numeric,
  deadline text, deadline_datum date, deadline_omschrijving text,
  voorwaarden text, status public.regeling_status_type,
  discovered_by public.subsidie_source_type, verified boolean, status_laatst_gecheckt timestamptz,
  data_tier public.subsidie_data_tier, source_type public.subsidie_source_type, classification_reviewed boolean,
  created_at timestamptz, updated_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  if p_sort_column is null or p_sort_column <> all (array['naam','deadline_datum','bedrag_min','bedrag_max','created_at','updated_at','status']) then
    p_sort_column := 'naam';
  end if;
  if p_sort_direction is null or lower(p_sort_direction) not in ('asc','desc') then
    p_sort_direction := 'asc';
  end if;
  p_limit := least(greatest(coalesce(p_limit, 50), 1), 200);
  p_offset := greatest(coalesce(p_offset, 0), 0);

  return query execute format(
    'select r.id, r.funder_id, f.naam as funder_naam, r.naam, r.thema,
            r.bedrag_min, r.bedrag_max,
            r.deadline, r.deadline_datum, r.deadline_omschrijving,
            r.voorwaarden, r.status,
            r.discovered_by, r.verified, r.status_laatst_gecheckt,
            r.data_tier, r.source_type, r.classification_reviewed,
            r.created_at, r.updated_at,
            count(*) over() as total_count
     from public.subsidieregelingen r
     join public.funders f on f.id = r.funder_id
     where ($1 is null or r.id = $1)
       and ($2 is null or r.funder_id = $2)
       and ($3 is null or r.naam ilike ''%%'' || $3 || ''%%'')
       and ($4 is null or r.status = $4)
       and ($5 is null or r.data_tier = $5)
       and ($6 is null or r.source_type = $6)
       and ($7 is null or r.classification_reviewed = $7)
     order by r.%I %s nulls last, r.id
     limit $8 offset $9',
    p_sort_column, p_sort_direction
  ) using p_regeling_id, p_funder_id, p_search, p_status, p_data_tier, p_source_type, p_classification_reviewed, p_limit, p_offset;
end;
$$;

revoke all on function public.admin_list_subsidieregelingen(uuid, uuid, text, public.regeling_status_type, public.subsidie_data_tier, public.subsidie_source_type, boolean, text, text, int, int) from public;
grant execute on function public.admin_list_subsidieregelingen(uuid, uuid, text, public.regeling_status_type, public.subsidie_data_tier, public.subsidie_source_type, boolean, text, text, int, int) to authenticated;

-- ------------------------------------------------------------
-- 3. DASHBOARD-TELLERS
-- ------------------------------------------------------------
create or replace function public.admin_dashboard_counts()
returns table (
  funders_total bigint, funders_public bigint, funders_premium bigint, funders_unreviewed bigint,
  regelingen_total bigint, regelingen_public bigint, regelingen_premium bigint, regelingen_unreviewed bigint,
  users_free bigint, users_pro bigint, users_premium bigint, users_admin bigint,
  applications_pending bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  return query
  select
    (select count(*) from public.funders),
    (select count(*) from public.funders where data_tier = 'public'),
    (select count(*) from public.funders where data_tier = 'premium'),
    (select count(*) from public.funders where classification_reviewed = false),
    (select count(*) from public.subsidieregelingen),
    (select count(*) from public.subsidieregelingen where data_tier = 'public'),
    (select count(*) from public.subsidieregelingen where data_tier = 'premium'),
    (select count(*) from public.subsidieregelingen where classification_reviewed = false),
    (select count(*) from public.profiles where role <> 'admin' and (subscription_tier is null or subscription_tier not in ('pro','premium') or subscription_active is not true)),
    (select count(*) from public.profiles where role <> 'admin' and subscription_tier = 'pro' and subscription_active = true),
    (select count(*) from public.profiles where role <> 'admin' and subscription_tier = 'premium' and subscription_active = true),
    (select count(*) from public.profiles where role = 'admin'),
    (select count(*) from public.profiles where status = 'pending');
end;
$$;

revoke all on function public.admin_dashboard_counts() from public;
grant execute on function public.admin_dashboard_counts() to authenticated;

-- ------------------------------------------------------------
-- 4. SCHRIJVEN: funders — algemene velden (nooit classificatie, nooit contactgegevens)
-- ------------------------------------------------------------
create or replace function public.admin_update_funder(
  p_funder_id uuid,
  p_naam text,
  p_type public.funder_type,
  p_status text,
  p_website text,
  p_missie text,
  p_bijdrage_min numeric,
  p_bijdrage_max numeric,
  p_jaarbudget numeric,
  p_prioriteit int,
  p_bron text,
  p_research_source text
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  if p_funder_id is null then
    raise exception 'p_funder_id is verplicht.';
  end if;

  update public.funders
  set naam = p_naam,
      type = p_type,
      status = p_status,
      website = p_website,
      missie = p_missie,
      bijdrage_min = p_bijdrage_min,
      bijdrage_max = p_bijdrage_max,
      jaarbudget = p_jaarbudget,
      prioriteit = p_prioriteit,
      bron = p_bron,
      research_source = p_research_source,
      updated_at = now()
  where id = p_funder_id;

  if not found then
    raise exception 'Funder % niet gevonden.', p_funder_id;
  end if;
end;
$$;

revoke all on function public.admin_update_funder(uuid, text, public.funder_type, text, text, text, numeric, numeric, numeric, int, text, text) from public;
grant execute on function public.admin_update_funder(uuid, text, public.funder_type, text, text, text, numeric, numeric, numeric, int, text, text) to authenticated;

-- ------------------------------------------------------------
-- 5. SCHRIJVEN: subsidieregelingen — algemene velden + aanmaken (nooit classificatie)
-- ------------------------------------------------------------
create or replace function public.admin_update_subsidieregeling(
  p_regeling_id uuid,
  p_naam text,
  p_thema text,
  p_bedrag_min numeric,
  p_bedrag_max numeric,
  p_deadline text,
  p_deadline_datum date,
  p_deadline_omschrijving text,
  p_voorwaarden text,
  p_status public.regeling_status_type,
  p_funder_id uuid
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  if p_regeling_id is null then
    raise exception 'p_regeling_id is verplicht.';
  end if;

  update public.subsidieregelingen
  set naam = p_naam,
      thema = p_thema,
      bedrag_min = p_bedrag_min,
      bedrag_max = p_bedrag_max,
      deadline = p_deadline,
      deadline_datum = p_deadline_datum,
      deadline_omschrijving = p_deadline_omschrijving,
      voorwaarden = p_voorwaarden,
      status = p_status,
      funder_id = p_funder_id,
      updated_at = now()
  where id = p_regeling_id;

  if not found then
    raise exception 'Subsidieregeling % niet gevonden.', p_regeling_id;
  end if;
end;
$$;

revoke all on function public.admin_update_subsidieregeling(uuid, text, text, numeric, numeric, text, date, text, text, public.regeling_status_type, uuid) from public;
grant execute on function public.admin_update_subsidieregeling(uuid, text, text, numeric, numeric, text, date, text, text, public.regeling_status_type, uuid) to authenticated;

create or replace function public.admin_bulk_create_subsidieregelingen(
  p_rows jsonb
) returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row jsonb;
  v_count int := 0;
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows moet een JSON-array zijn.';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    if v_row ->> 'funder_id' is null or v_row ->> 'naam' is null then
      continue;
    end if;

    insert into public.subsidieregelingen (
      funder_id, naam, thema, bedrag_min, bedrag_max,
      deadline, deadline_datum, deadline_omschrijving, voorwaarden, status,
      data_tier, source_type, classification_reviewed
    ) values (
      (v_row ->> 'funder_id')::uuid,
      v_row ->> 'naam',
      v_row ->> 'thema',
      nullif(v_row ->> 'bedrag_min', '')::numeric,
      nullif(v_row ->> 'bedrag_max', '')::numeric,
      v_row ->> 'deadline',
      nullif(v_row ->> 'deadline_datum', '')::date,
      v_row ->> 'deadline_omschrijving',
      v_row ->> 'voorwaarden',
      coalesce((v_row ->> 'status')::public.regeling_status_type, 'open'),
      coalesce((v_row ->> 'data_tier')::public.subsidie_data_tier, 'premium'),
      coalesce((v_row ->> 'source_type')::public.subsidie_source_type, 'manual_admin'),
      false
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.admin_bulk_create_subsidieregelingen(jsonb) from public;
grant execute on function public.admin_bulk_create_subsidieregelingen(jsonb) to authenticated;

-- ------------------------------------------------------------
-- 6. SCHRIJVEN: profiles — vervangt de brede client-side UPDATE
-- ------------------------------------------------------------
create or replace function public.admin_set_subscription(
  p_user_id uuid,
  p_tier text,
  p_active boolean
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  if p_tier not in ('free', 'pro', 'premium') then
    raise exception 'Ongeldig abonnement: %', p_tier;
  end if;

  update public.profiles
  set subscription_tier = p_tier,
      subscription_active = coalesce(p_active, false),
      subscription_started_at = case
        when p_tier <> 'free' and coalesce(p_active, false) = true and subscription_started_at is null
          then now()
        when p_tier = 'free' then null
        else subscription_started_at
      end
  where id = p_user_id;

  if not found then
    raise exception 'Gebruiker % niet gevonden.', p_user_id;
  end if;
end;
$$;

revoke all on function public.admin_set_subscription(uuid, text, boolean) from public;
grant execute on function public.admin_set_subscription(uuid, text, boolean) to authenticated;

create or replace function public.admin_set_role(
  p_user_id uuid,
  p_role text
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  if p_role not in ('member', 'admin') then
    raise exception 'Ongeldige rol: %', p_role;
  end if;

  if p_user_id = auth.uid() and p_role <> 'admin' then
    raise exception 'U kunt uw eigen beheerdersrol niet intrekken.';
  end if;

  update public.profiles
  set role = p_role
  where id = p_user_id;

  if not found then
    raise exception 'Gebruiker % niet gevonden.', p_user_id;
  end if;
end;
$$;

revoke all on function public.admin_set_role(uuid, text) from public;
grant execute on function public.admin_set_role(uuid, text) to authenticated;

create or replace function public.admin_set_status(
  p_user_id uuid,
  p_status text
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  if p_status not in ('pending', 'approved', 'rejected') then
    raise exception 'Ongeldige status: %', p_status;
  end if;

  update public.profiles
  set status = p_status,
      approved_at = case when p_status = 'approved' then now() else null end,
      approved_by = case when p_status = 'approved' then coalesce(auth.uid()::text, 'admin') else approved_by end
  where id = p_user_id;

  if not found then
    raise exception 'Gebruiker % niet gevonden.', p_user_id;
  end if;
end;
$$;

revoke all on function public.admin_set_status(uuid, text) from public;
grant execute on function public.admin_set_status(uuid, text) to authenticated;
