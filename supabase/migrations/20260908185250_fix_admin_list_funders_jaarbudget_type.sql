-- Correctie: de zojuist uitgevoerde recreate van admin_list_funders had per
-- abuis "jaarbudget integer" in RETURNS TABLE staan i.p.v. het originele
-- "jaarbudget numeric" (de kolom funders.jaarbudget zelf is en blijft
-- numeric — dit was puur een tikfout in de functiedefinitie, geen
-- databasewijziging). Ongecorrigeerd zou elk jaarbudget met decimalen
-- stilzwijgend worden afgekapt naar een geheel getal in de admin. Drop +
-- recreate met exact dezelfde logica als de vorige migratie, alleen dit
-- ene type gecorrigeerd.
drop function public.admin_list_funders(uuid, text, funder_type, text, subsidie_data_tier, subsidie_source_type, boolean, text, text, integer, integer, integer, subsidie_access_tier, uuid, text, text, text, boolean);

create function public.admin_list_funders(
  p_funder_id uuid default null::uuid,
  p_search text default null::text,
  p_type funder_type default null::funder_type,
  p_status text default null::text,
  p_data_tier subsidie_data_tier default null::subsidie_data_tier,
  p_source_type subsidie_source_type default null::subsidie_source_type,
  p_classification_reviewed boolean default null::boolean,
  p_sort_column text default 'naam'::text,
  p_sort_direction text default 'asc'::text,
  p_limit integer default 50,
  p_offset integer default 0,
  p_prioriteit_min integer default null::integer,
  p_access_tier subsidie_access_tier default null::subsidie_access_tier,
  p_bandbreedte_bijdrage_id uuid default null::uuid,
  p_thema text default null::text,
  p_doelgroep text default null::text,
  p_regio text default null::text,
  p_gescand_door_agent boolean default null::boolean
)
returns table(id uuid, naam text, type funder_type, status text, website text, missie text, aanvraagcriteria text, bijdrage_min numeric, bijdrage_max numeric, jaarbudget numeric, prioriteit integer, bron text, research_source text, contactpersoon text, contactpersoon_prive boolean, email text, email_prive boolean, telefoon text, telefoon_prive boolean, adres text, enrichment_status enrichment_status_type, last_researched_at timestamp with time zone, data_tier subsidie_data_tier, source_type subsidie_source_type, classification_reviewed boolean, access_tier subsidie_access_tier, bandbreedte_bijdrage_id uuid, bandbreedte_bijdrage_naam text, bijdrage_toelichting text, created_at timestamp with time zone, updated_at timestamp with time zone, total_count bigint)
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
            f.aanvraagcriteria,
            f.bijdrage_min, f.bijdrage_max, f.jaarbudget, f.prioriteit,
            f.bron, f.research_source,
            f.contactpersoon, f.contactpersoon_prive, f.email, f.email_prive,
            f.telefoon, f.telefoon_prive, f.adres,
            f.enrichment_status, f.last_researched_at,
            f.data_tier, f.source_type, f.classification_reviewed,
            f.access_tier,
            f.bandbreedte_bijdrage_id, bb.naam as bandbreedte_bijdrage_naam,
            f.bijdrage_toelichting,
            f.created_at, f.updated_at,
            count(*) over() as total_count
     from public.funders f
     left join public.bandbreedtes_bijdrage bb on bb.id = f.bandbreedte_bijdrage_id
     where ($1 is null or f.id = $1)
       and ($2 is null or f.naam ilike ''%%'' || $2 || ''%%'')
       and ($3 is null or f.type = $3)
       and ($4 is null or f.status = $4)
       and ($5 is null or f.data_tier = $5)
       and ($6 is null or f.source_type = $6)
       and ($7 is null or f.classification_reviewed = $7)
       and ($10 is null or f.prioriteit >= $10)
       and ($11 is null or f.access_tier = $11)
       and ($12 is null or f.bandbreedte_bijdrage_id = $12)
       and ($13 is null or exists (
             select 1 from public.funder_themas ft join public.themas t on t.id = ft.thema_id
             where ft.funder_id = f.id and t.naam = $13))
       and ($14 is null or exists (
             select 1 from public.funder_doelgroepen fd join public.doelgroepen d on d.id = fd.doelgroep_id
             where fd.funder_id = f.id and d.naam = $14))
       and ($15 is null or exists (
             select 1 from public.funder_regios fr join public.regios r on r.id = fr.regio_id
             where fr.funder_id = f.id and r.naam = $15))
       and ($16 is null or ($16 = true and f.source_type = ''internet_scan'') or ($16 = false and f.source_type <> ''internet_scan''))
     order by %I %s nulls last, f.id
     limit $8 offset $9',
    p_sort_column, p_sort_direction
  ) using p_funder_id, p_search, p_type, p_status, p_data_tier, p_source_type, p_classification_reviewed, p_limit, p_offset, p_prioriteit_min, p_access_tier, p_bandbreedte_bijdrage_id, p_thema, p_doelgroep, p_regio, p_gescand_door_agent;
end;
$function$;

revoke all on function public.admin_list_funders(uuid, text, funder_type, text, subsidie_data_tier, subsidie_source_type, boolean, text, text, integer, integer, integer, subsidie_access_tier, uuid, text, text, text, boolean) from public;
grant execute on function public.admin_list_funders(uuid, text, funder_type, text, subsidie_data_tier, subsidie_source_type, boolean, text, text, integer, integer, integer, subsidie_access_tier, uuid, text, text, text, boolean) to authenticated;
