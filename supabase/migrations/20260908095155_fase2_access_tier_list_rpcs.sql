-- admin_list_funders / admin_list_subsidieregelingen krijgen er de nieuwe
-- access_tier-kolom bij (zowel in de output als als filterparameter). Output
-- kolommen wijzigen kan niet via CREATE OR REPLACE — vandaar eerst DROP met
-- de exacte bestaande signatuur, dan opnieuw aanmaken met alle bestaande
-- gedrag ongewijzigd plus de nieuwe kolom/parameter.

drop function public.admin_list_funders(uuid, text, public.funder_type, text, public.subsidie_data_tier, public.subsidie_source_type, boolean, text, text, integer, integer, integer);

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
  p_limit integer default 50,
  p_offset integer default 0,
  p_prioriteit_min integer default null,
  p_access_tier public.subsidie_access_tier default null
)
returns table (
  id uuid, naam text, type public.funder_type, status text, website text, missie text,
  bijdrage_min numeric, bijdrage_max numeric, jaarbudget numeric, prioriteit integer,
  bron text, research_source text,
  contactpersoon text, contactpersoon_prive boolean, email text, email_prive boolean,
  telefoon text, telefoon_prive boolean, adres text,
  enrichment_status public.enrichment_status_type, last_researched_at timestamptz,
  data_tier public.subsidie_data_tier, source_type public.subsidie_source_type, classification_reviewed boolean,
  access_tier public.subsidie_access_tier,
  created_at timestamptz, updated_at timestamptz, total_count bigint
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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
            f.access_tier,
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
       and ($10 is null or f.prioriteit >= $10)
       and ($11 is null or f.access_tier = $11)
     order by %I %s nulls last, f.id
     limit $8 offset $9',
    p_sort_column, p_sort_direction
  ) using p_funder_id, p_search, p_type, p_status, p_data_tier, p_source_type, p_classification_reviewed, p_limit, p_offset, p_prioriteit_min, p_access_tier;
end;
$function$;

revoke all on function public.admin_list_funders(uuid, text, public.funder_type, text, public.subsidie_data_tier, public.subsidie_source_type, boolean, text, text, integer, integer, integer, public.subsidie_access_tier) from public, anon;
grant execute on function public.admin_list_funders(uuid, text, public.funder_type, text, public.subsidie_data_tier, public.subsidie_source_type, boolean, text, text, integer, integer, integer, public.subsidie_access_tier) to authenticated;

drop function public.admin_list_subsidieregelingen(uuid, uuid, text, public.regeling_status_type, public.subsidie_data_tier, public.subsidie_source_type, boolean, text, text, integer, integer);

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
  p_limit integer default 50,
  p_offset integer default 0,
  p_access_tier public.subsidie_access_tier default null
)
returns table (
  id uuid, funder_id uuid, funder_naam text, naam text, thema text,
  bedrag_min numeric, bedrag_max numeric,
  deadline text, deadline_datum date, deadline_omschrijving text,
  voorwaarden text, status public.regeling_status_type,
  discovered_by public.discovered_by_type, verified boolean, status_laatst_gecheckt timestamptz,
  data_tier public.subsidie_data_tier, source_type public.subsidie_source_type, classification_reviewed boolean,
  access_tier public.subsidie_access_tier,
  created_at timestamptz, updated_at timestamptz, total_count bigint
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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
            r.access_tier,
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
       and ($10 is null or r.access_tier = $10)
     order by r.%I %s nulls last, r.id
     limit $8 offset $9',
    p_sort_column, p_sort_direction
  ) using p_regeling_id, p_funder_id, p_search, p_status, p_data_tier, p_source_type, p_classification_reviewed, p_limit, p_offset, p_access_tier;
end;
$function$;

revoke all on function public.admin_list_subsidieregelingen(uuid, uuid, text, public.regeling_status_type, public.subsidie_data_tier, public.subsidie_source_type, boolean, text, text, integer, integer, public.subsidie_access_tier) from public, anon;
grant execute on function public.admin_list_subsidieregelingen(uuid, uuid, text, public.regeling_status_type, public.subsidie_data_tier, public.subsidie_source_type, boolean, text, text, integer, integer, public.subsidie_access_tier) to authenticated;
