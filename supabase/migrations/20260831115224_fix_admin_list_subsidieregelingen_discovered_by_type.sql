
-- Correctie: discovered_by is een legacy kolom van het type public.discovered_by_type
-- ('handmatig'/'agent'), niet public.subsidie_source_type zoals abusievelijk
-- gedeclareerd in de eerste versie van deze functie. source_type (de nieuwe
-- classificatiekolom) staat er al apart naast en blijft ongewijzigd.
drop function if exists public.admin_list_subsidieregelingen(uuid, uuid, text, public.regeling_status_type, public.subsidie_data_tier, public.subsidie_source_type, boolean, text, text, int, int);

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
  discovered_by public.discovered_by_type, verified boolean, status_laatst_gecheckt timestamptz,
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
