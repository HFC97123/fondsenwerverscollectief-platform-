-- Zelfde uitbreiding als funders, nu voor subsidieregelingen: adres/contact
-- (nieuw - regelingen hadden nog helemaal geen contactvelden) en een optionele
-- vergaderdatum-override.

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
  p_status regeling_status_type,
  p_funder_id uuid,
  p_werkgebied text default null,
  p_aanvraaglink text default null,
  p_beoordelingscriteria text default null,
  p_type_projecten text default null,
  p_begrotingseisen text default null,
  p_eigen_bijdrage text default null,
  p_cofinanciering text default null,
  p_behandeltermijn text default null,
  p_aanvraagprocedure text default null,
  p_type funder_type default null,
  p_bijdrage_toelichting text default null,
  p_contactpersoon text default null,
  p_contactpersoon_functie text default null,
  p_email text default null,
  p_telefoon text default null,
  p_algemeen_email text default null,
  p_algemeen_telefoon text default null,
  p_website text default null,
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

  if p_regeling_id is null then
    raise exception 'p_regeling_id is verplicht.';
  end if;

  update public.subsidieregelingen
  set naam = p_naam,
      thema = coalesce(p_thema, thema),
      bedrag_min = p_bedrag_min,
      bedrag_max = p_bedrag_max,
      bijdrage_toelichting = p_bijdrage_toelichting,
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
      contactpersoon = p_contactpersoon,
      contactpersoon_functie = p_contactpersoon_functie,
      email = p_email,
      telefoon = p_telefoon,
      algemeen_email = p_algemeen_email,
      algemeen_telefoon = p_algemeen_telefoon,
      website = p_website,
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
  where id = p_regeling_id;

  if not found then
    raise exception 'Subsidieregeling % niet gevonden.', p_regeling_id;
  end if;
end;
$function$;

drop function if exists public.admin_list_subsidieregelingen(uuid,uuid,text,regeling_status_type,subsidie_data_tier,subsidie_source_type,boolean,text,text,integer,integer,subsidie_access_tier,uuid,text,text,text,funder_type,text,discovered_by_type);

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
  id uuid, funder_id uuid, funder_naam text, funder_type funder_type, naam text, thema text, type funder_type,
  aanvraaglink text, beoordelingscriteria text, type_projecten text, begrotingseisen text,
  eigen_bijdrage text, cofinanciering text, behandeltermijn text, aanvraagprocedure text,
  bedrag_min numeric, bedrag_max numeric,
  deadline text, deadline_datum date, deadline_omschrijving text,
  voorwaarden text, status regeling_status_type,
  discovered_by discovered_by_type, verified boolean, status_laatst_gecheckt timestamp with time zone,
  data_tier subsidie_data_tier, source_type subsidie_source_type, classification_reviewed boolean,
  access_tier subsidie_access_tier,
  bandbreedte_bijdrage_id uuid, bandbreedte_bijdrage_naam text,
  bijdrage_toelichting text,
  contactpersoon text, contactpersoon_functie text, email text, telefoon text,
  algemeen_email text, algemeen_telefoon text, website text,
  straat text, huisnummer text, postcode text, plaats text, provincie text, land text,
  volgende_vergaderdatum date, vergaderfrequentie text, vergadering_toelichting text,
  created_at timestamp with time zone, updated_at timestamp with time zone,
  total_count bigint,
  rondes_aantal bigint,
  volgende_ronde_sluitingsdatum date, volgende_ronde_sluitingstijd time without time zone,
  volgende_ronde_beoordelingsdatum date, volgende_ronde_beoordelingsperiode text
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
            r.bijdrage_toelichting,
            r.contactpersoon, r.contactpersoon_functie, r.email, r.telefoon,
            r.algemeen_email, r.algemeen_telefoon, r.website,
            r.straat, r.huisnummer, r.postcode, r.plaats, r.provincie, r.land,
            r.volgende_vergaderdatum, r.vergaderfrequentie, r.vergadering_toelichting,
            r.created_at, r.updated_at,
            count(*) over() as total_count,
            coalesce(rc.rondes_aantal, 0) as rondes_aantal,
            vr.sluitingsdatum as volgende_ronde_sluitingsdatum,
            vr.sluitingstijd as volgende_ronde_sluitingstijd,
            vr.beoordelingsdatum as volgende_ronde_beoordelingsdatum,
            vr.beoordelingsperiode as volgende_ronde_beoordelingsperiode
     from public.subsidieregelingen r
     join public.funders f on f.id = r.funder_id
     left join public.bandbreedtes_bijdrage bb on bb.id = r.bandbreedte_bijdrage_id
     left join lateral (select count(*) as rondes_aantal from public.subsidieregeling_rondes rr where rr.subsidieregeling_id = r.id) rc on true
     left join lateral public.subsidieregeling_volgende_ronde(r.id, now()) vr(ronde_id, sluitingsdatum, sluitingstijd, sluitingsmoment, open_vanaf, beoordelingsdatum, beoordelingsperiode, toelichting, bron_url) on true
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
             select 1 from public.subsidieregeling_regios sr2 join public.regios rg on rg.id = sr2.regio_id
             where sr2.subsidieregeling_id = r.id and rg.naam = $14))
       and ($15 is null or coalesce(r.type, f.type) = $15)
       and ($16 is null or f.naam ilike ''%%'' || $16 || ''%%'')
       and ($17 is null or r.discovered_by = $17)
     order by r.%I %s nulls last, r.id
     limit $8 offset $9',
    p_sort_column, p_sort_direction
  ) using p_regeling_id, p_funder_id, p_search, p_status, p_data_tier, p_source_type, p_classification_reviewed, p_limit, p_offset, p_access_tier, p_bandbreedte_bijdrage_id, p_thema, p_doelgroep, p_regio, p_type, p_funder_search, p_discovered_by;
end;
$function$;
