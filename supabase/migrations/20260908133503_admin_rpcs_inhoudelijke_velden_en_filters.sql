-- Fase 3: admin_list_funders/admin_list_subsidieregelingen uitbreiden met de
-- nieuwe inhoudelijke velden (output) en met discipline/doelgroep/werkgebied/
-- type-gever/gever-naam/"gescand door agent"-filters (input), zodat de
-- overzichten net zo goed doorzoekbaar worden als het bewerkscherm al is.
-- Outputkolommen wijzigen -> DROP FUNCTION vereist (Postgres staat geen
-- CREATE OR REPLACE toe bij een gewijzigde RETURNS TABLE-vorm), daarna
-- opnieuw aanmaken met identiek gedrag plus de toevoegingen. Bestaande
-- aanroepers blijven werken: alle nieuwe parameters zijn optioneel en
-- achteraan toegevoegd.

drop function if exists public.admin_list_funders(uuid, text, funder_type, text, subsidie_data_tier, subsidie_source_type, boolean, text, text, integer, integer, integer, subsidie_access_tier, uuid);

create function public.admin_list_funders(
  p_funder_id uuid default null,
  p_search text default null,
  p_type funder_type default null,
  p_status text default null,
  p_data_tier subsidie_data_tier default null,
  p_source_type subsidie_source_type default null,
  p_classification_reviewed boolean default null,
  p_sort_column text default 'naam',
  p_sort_direction text default 'asc',
  p_limit integer default 50,
  p_offset integer default 0,
  p_prioriteit_min integer default null,
  p_access_tier subsidie_access_tier default null,
  p_bandbreedte_bijdrage_id uuid default null,
  p_thema text default null,
  p_doelgroep text default null,
  p_regio text default null,
  p_gescand_door_agent boolean default null
)
returns table(
  id uuid, naam text, type funder_type, status text, website text, missie text,
  aanvraagcriteria text,
  bijdrage_min numeric, bijdrage_max numeric, jaarbudget numeric, prioriteit integer,
  bron text, research_source text,
  contactpersoon text, contactpersoon_prive boolean, email text, email_prive boolean,
  telefoon text, telefoon_prive boolean, adres text,
  enrichment_status enrichment_status_type, last_researched_at timestamptz,
  data_tier subsidie_data_tier, source_type subsidie_source_type, classification_reviewed boolean,
  access_tier subsidie_access_tier,
  bandbreedte_bijdrage_id uuid, bandbreedte_bijdrage_naam text,
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
            f.aanvraagcriteria,
            f.bijdrage_min, f.bijdrage_max, f.jaarbudget, f.prioriteit,
            f.bron, f.research_source,
            f.contactpersoon, f.contactpersoon_prive, f.email, f.email_prive,
            f.telefoon, f.telefoon_prive, f.adres,
            f.enrichment_status, f.last_researched_at,
            f.data_tier, f.source_type, f.classification_reviewed,
            f.access_tier,
            f.bandbreedte_bijdrage_id, bb.naam as bandbreedte_bijdrage_naam,
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

-- admin_list_subsidieregelingen: zelfde behandeling.
drop function if exists public.admin_list_subsidieregelingen(uuid, uuid, text, regeling_status_type, subsidie_data_tier, subsidie_source_type, boolean, text, text, integer, integer, subsidie_access_tier, uuid);

create function public.admin_list_subsidieregelingen(
  p_regeling_id uuid default null,
  p_funder_id uuid default null,
  p_search text default null,
  p_status regeling_status_type default null,
  p_data_tier subsidie_data_tier default null,
  p_source_type subsidie_source_type default null,
  p_classification_reviewed boolean default null,
  p_sort_column text default 'naam',
  p_sort_direction text default 'asc',
  p_limit integer default 50,
  p_offset integer default 0,
  p_access_tier subsidie_access_tier default null,
  p_bandbreedte_bijdrage_id uuid default null,
  p_thema text default null,
  p_doelgroep text default null,
  p_regio text default null,
  p_type funder_type default null,
  p_funder_search text default null,
  p_discovered_by discovered_by_type default null
)
returns table(
  id uuid, funder_id uuid, funder_naam text, funder_type funder_type, naam text, thema text,
  type funder_type,
  aanvraaglink text, beoordelingscriteria text, type_projecten text, begrotingseisen text,
  eigen_bijdrage text, cofinanciering text, behandeltermijn text, aanvraagprocedure text,
  bedrag_min numeric, bedrag_max numeric, deadline text, deadline_datum date, deadline_omschrijving text,
  voorwaarden text, status regeling_status_type, discovered_by discovered_by_type, verified boolean,
  status_laatst_gecheckt timestamptz,
  data_tier subsidie_data_tier, source_type subsidie_source_type, classification_reviewed boolean,
  access_tier subsidie_access_tier,
  bandbreedte_bijdrage_id uuid, bandbreedte_bijdrage_naam text,
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
    'select r.id, r.funder_id, f.naam as funder_naam, f.type as funder_type, r.naam, r.thema,
            r.type,
            r.aanvraaglink, r.beoordelingscriteria, r.type_projecten, r.begrotingseisen,
            r.eigen_bijdrage, r.cofinanciering, r.behandeltermijn, r.aanvraagprocedure,
            r.bedrag_min, r.bedrag_max,
            r.deadline, r.deadline_datum, r.deadline_omschrijving,
            r.voorwaarden, r.status,
            r.discovered_by, r.verified, r.status_laatst_gecheckt,
            r.data_tier, r.source_type, r.classification_reviewed,
            r.access_tier,
            r.bandbreedte_bijdrage_id, bb.naam as bandbreedte_bijdrage_naam,
            r.created_at, r.updated_at,
            count(*) over() as total_count
     from public.subsidieregelingen r
     join public.funders f on f.id = r.funder_id
     left join public.bandbreedtes_bijdrage bb on bb.id = r.bandbreedte_bijdrage_id
     where ($1 is null or r.id = $1)
       and ($2 is null or r.funder_id = $2)
       and ($3 is null or r.naam ilike ''%%'' || $3 || ''%%'')
       and ($4 is null or r.status = $4)
       and ($5 is null or r.data_tier = $5)
       and ($6 is null or r.source_type = $6)
       and ($7 is null or r.classification_reviewed = $7)
       and ($10 is null or r.access_tier = $10)
       and ($11 is null or r.bandbreedte_bijdrage_id = $11)
       and ($12 is null or exists (
             select 1 from public.subsidieregeling_themas st join public.themas t on t.id = st.thema_id
             where st.subsidieregeling_id = r.id and t.naam = $12))
       and ($13 is null or exists (
             select 1 from public.subsidieregeling_doelgroepen sd join public.doelgroepen d on d.id = sd.doelgroep_id
             where sd.subsidieregeling_id = r.id and d.naam = $13))
       and ($14 is null or exists (
             select 1 from public.subsidieregeling_regios sr join public.regios rg on rg.id = sr.regio_id
             where sr.subsidieregeling_id = r.id and rg.naam = $14))
       and ($15 is null or coalesce(r.type, f.type) = $15)
       and ($16 is null or f.naam ilike ''%%'' || $16 || ''%%'')
       and ($17 is null or r.discovered_by = $17)
     order by r.%I %s nulls last, r.id
     limit $8 offset $9',
    p_sort_column, p_sort_direction
  ) using p_regeling_id, p_funder_id, p_search, p_status, p_data_tier, p_source_type, p_classification_reviewed, p_limit, p_offset, p_access_tier, p_bandbreedte_bijdrage_id, p_thema, p_doelgroep, p_regio, p_type, p_funder_search, p_discovered_by;
end;
$function$;

revoke all on function public.admin_list_subsidieregelingen(uuid, uuid, text, regeling_status_type, subsidie_data_tier, subsidie_source_type, boolean, text, text, integer, integer, subsidie_access_tier, uuid, text, text, text, funder_type, text, discovered_by_type) from public;
grant execute on function public.admin_list_subsidieregelingen(uuid, uuid, text, regeling_status_type, subsidie_data_tier, subsidie_source_type, boolean, text, text, integer, integer, subsidie_access_tier, uuid, text, text, text, funder_type, text, discovered_by_type) to authenticated;

-- admin_update_funder: output/signature van UPDATE-vorm wijzigt niet (blijft
-- void), dus CREATE OR REPLACE volstaat hier wel.
create or replace function public.admin_update_funder(
  p_funder_id uuid, p_naam text, p_type funder_type, p_status text, p_website text, p_missie text,
  p_bijdrage_min numeric, p_bijdrage_max numeric, p_jaarbudget numeric, p_prioriteit integer,
  p_bron text, p_research_source text,
  p_aanvraagcriteria text default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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
      aanvraagcriteria = p_aanvraagcriteria,
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
$function$;

-- admin_update_subsidieregeling: de oude 11-parameter-overload (zonder
-- p_werkgebied) is sinds de vorige fase een dode, ongebruikte kopie - de
-- frontend roept altijd de 12-parameter-versie aan. Opruimen om dubbele
-- overloads te voorkomen, daarna de resterende versie uitbreiden.
drop function if exists public.admin_update_subsidieregeling(uuid, text, text, numeric, numeric, text, date, text, text, regeling_status_type, uuid);

create or replace function public.admin_update_subsidieregeling(
  p_regeling_id uuid, p_naam text, p_thema text, p_bedrag_min numeric, p_bedrag_max numeric,
  p_deadline text, p_deadline_datum date, p_deadline_omschrijving text, p_voorwaarden text,
  p_status regeling_status_type, p_funder_id uuid, p_werkgebied text default null,
  p_aanvraaglink text default null, p_beoordelingscriteria text default null,
  p_type_projecten text default null, p_begrotingseisen text default null,
  p_eigen_bijdrage text default null, p_cofinanciering text default null,
  p_behandeltermijn text default null, p_aanvraagprocedure text default null,
  p_type funder_type default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  if p_regeling_id is null then
    raise exception 'p_regeling_id is verplicht.';
  end if;

  update public.subsidieregelingen
  set naam = p_naam,
      thema = coalesce(p_thema, thema),
      bedrag_min = p_bedrag_min,
      bedrag_max = p_bedrag_max,
      deadline = p_deadline,
      deadline_datum = p_deadline_datum,
      deadline_omschrijving = p_deadline_omschrijving,
      voorwaarden = p_voorwaarden,
      status = p_status,
      funder_id = p_funder_id,
      werkgebied = coalesce(p_werkgebied, werkgebied),
      aanvraaglink = p_aanvraaglink,
      beoordelingscriteria = p_beoordelingscriteria,
      type_projecten = p_type_projecten,
      begrotingseisen = p_begrotingseisen,
      eigen_bijdrage = p_eigen_bijdrage,
      cofinanciering = p_cofinanciering,
      behandeltermijn = p_behandeltermijn,
      aanvraagprocedure = p_aanvraagprocedure,
      type = p_type,
      updated_at = now()
  where id = p_regeling_id;

  if not found then
    raise exception 'Subsidieregeling % niet gevonden.', p_regeling_id;
  end if;
end;
$function$;
