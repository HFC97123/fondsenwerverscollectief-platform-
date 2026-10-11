-- Vervolgopdracht: beheerdersconsole afmaken (vergaderdatum, adres/contact
-- editable maken, volledige CRUD voor Funders). Uitsluitend uitbreidingen van
-- bestaande, al beheerde admin-RPC's (zelfde SECURITY DEFINER + admin-check
-- patroon als admin_update_funder/admin_bulk_create_subsidieregelingen) plus
-- twee nieuwe RPC's (create/delete funder) - geen nieuwe schrijfpatronen.

-- 1) admin_update_funder: contactgegevens/adres/vergaderdatum waren tot nu toe
--    bewust alleen-lezen ("totdat er een apart, expliciet goedgekeurd
--    schrijfpad komt" - zie adminFunders.js). Dat pad is er nu, expliciet
--    gevraagd door de gebruiker. Bestaande 14 parameters ongewijzigd; nieuwe
--    velden als extra parameters met DEFAULT NULL aan het einde (zelfde manier
--    waarop aanvraagcriteria/bijdrage_toelichting eerder al zijn toegevoegd).
create or replace function public.admin_update_funder(
  p_funder_id uuid,
  p_naam text,
  p_type funder_type,
  p_status text,
  p_website text,
  p_missie text,
  p_bijdrage_min numeric,
  p_bijdrage_max numeric,
  p_jaarbudget numeric,
  p_prioriteit integer,
  p_bron text,
  p_research_source text,
  p_aanvraagcriteria text default null,
  p_bijdrage_toelichting text default null,
  p_contactpersoon text default null,
  p_contactpersoon_functie text default null,
  p_email text default null,
  p_telefoon text default null,
  p_algemeen_email text default null,
  p_algemeen_telefoon text default null,
  p_straat text default null,
  p_huisnummer text default null,
  p_postcode text default null,
  p_plaats text default null,
  p_provincie text default null,
  p_land text default null,
  p_volgende_vergaderdatum date default null,
  p_vergaderfrequentie text default null,
  p_vergadering_toelichting text default null
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
      bijdrage_toelichting = p_bijdrage_toelichting,
      jaarbudget = p_jaarbudget,
      prioriteit = p_prioriteit,
      bron = p_bron,
      research_source = p_research_source,
      contactpersoon = p_contactpersoon,
      contactpersoon_functie = p_contactpersoon_functie,
      email = p_email,
      telefoon = p_telefoon,
      algemeen_email = p_algemeen_email,
      algemeen_telefoon = p_algemeen_telefoon,
      straat = p_straat,
      huisnummer = p_huisnummer,
      postcode = p_postcode,
      plaats = p_plaats,
      provincie = p_provincie,
      land = p_land,
      volgende_vergaderdatum = p_volgende_vergaderdatum,
      vergaderfrequentie = p_vergaderfrequentie,
      vergadering_toelichting = p_vergadering_toelichting,
      updated_at = now()
  where id = p_funder_id;

  if not found then
    raise exception 'Funder % niet gevonden.', p_funder_id;
  end if;
end;
$function$;

-- 2) admin_list_funders: return-type wijzigt (nieuwe kolommen) - moet eerst
--    expliciet gedropt worden voordat de uitgebreide versie kan worden
--    aangemaakt (CREATE OR REPLACE staat geen gewijzigd returns table toe).
drop function if exists public.admin_list_funders(uuid,text,funder_type,text,subsidie_data_tier,subsidie_source_type,boolean,text,text,integer,integer,integer,subsidie_access_tier,uuid,text,text,text,boolean);

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
  id uuid, naam text, type funder_type, status text, website text, missie text, aanvraagcriteria text,
  bijdrage_min numeric, bijdrage_max numeric, jaarbudget numeric, prioriteit integer, bron text, research_source text,
  contactpersoon text, contactpersoon_functie text, contactpersoon_prive boolean,
  email text, email_prive boolean, telefoon text, telefoon_prive boolean,
  algemeen_email text, algemeen_telefoon text,
  adres text, straat text, huisnummer text, postcode text, plaats text, provincie text, land text,
  volgende_vergaderdatum date, vergaderfrequentie text, vergadering_toelichting text,
  enrichment_status enrichment_status_type, last_researched_at timestamp with time zone,
  data_tier subsidie_data_tier, source_type subsidie_source_type, classification_reviewed boolean,
  access_tier subsidie_access_tier, bandbreedte_bijdrage_id uuid, bandbreedte_bijdrage_naam text,
  bijdrage_toelichting text, created_at timestamp with time zone, updated_at timestamp with time zone,
  total_count bigint
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
            f.contactpersoon, f.contactpersoon_functie, f.contactpersoon_prive, f.email, f.email_prive,
            f.telefoon, f.telefoon_prive, f.algemeen_email, f.algemeen_telefoon,
            f.adres, f.straat, f.huisnummer, f.postcode, f.plaats, f.provincie, f.land,
            f.volgende_vergaderdatum, f.vergaderfrequentie, f.vergadering_toelichting,
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

-- 3) admin_create_funder: nieuw. Alleen de twee NOT NULL-velden zijn verplicht
--    (naam, type) - alles overig vult de beheerder direct daarna in via
--    hetzelfde bewerkscherm (admin_update_funder hierboven), dus geen
--    duplicatie van het hele veldenformulier in een tweede RPC.
create or replace function public.admin_create_funder(p_naam text, p_type funder_type)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_id uuid;
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  if p_naam is null or trim(p_naam) = '' then
    raise exception 'Naam is verplicht.';
  end if;
  if p_type is null then
    raise exception 'Type gever is verplicht.';
  end if;

  insert into public.funders (naam, type, source_type)
  values (trim(p_naam), p_type, 'manual_admin')
  returning id into v_id;

  return v_id;
end;
$function$;

-- 4) admin_delete_funder: nieuw. Geen handmatige opruiming van gekoppelde
--    rijen nodig - funder_themas/funder_doelgroepen/funder_regios/funder_notes/
--    subsidieregelingen (en via die laatste weer subsidieregeling_themas/
--    doelgroepen/regios/rondes) hebben allemaal al `on delete cascade` naar
--    funders.id (geverifieerd vóór deze migratie) - dus geen orphan records,
--    geen kapotte foreign keys. classification_audit_log-rijen voor deze
--    funder blijven bewust bestaan (append-only audit trail, geen foreign key
--    daarheen - net zo bedoeld als bij elk ander audit log).
create or replace function public.admin_delete_funder(p_funder_id uuid)
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

  delete from public.funders where id = p_funder_id;

  if not found then
    raise exception 'Funder % niet gevonden.', p_funder_id;
  end if;
end;
$function$;
