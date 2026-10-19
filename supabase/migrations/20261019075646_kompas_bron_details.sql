-- Fondsinformatie overal compleet: één leesfunctie voor de details van regelingen en fondsen, plus het toegangsniveau in de deadline-views.
-- TOEGEPAST op het live project op 19-10-2026 (live versie 20261019075646) op verzoek van de beheerder. Nooit opnieuw uitvoeren.
--
-- Waarom: het detailpaneel van Deadlines en de uitklapregels van het dekkingsplan lazen de details uit de views subsidieregelingen_deadlines
-- en funder_deadlines. funder_deadlines bevat alleen fondsen MET een actueel datamoment (op 19-10-2026: 1 van de 4288 fondsen), dus bij
-- vrijwel elk fonds in een dekkingsplan bleven werkgebieden, doelgroepen, disciplines, beschrijving en bandbreedte leeg. De regelingen-view
-- gaf bovendien de algemene beschrijving en de aanvraagdetails (beoordelingscriteria, eigen bijdrage, aanvraaglink, ...) niet mee.
--
-- 1. Nieuwe functie kompas_bron_details(scheme_ids, funder_ids): alleen lezen, alleen voor ingelogde leden, hooguit 100 id's per soort.
--    Geeft per regeling/fonds de details terug met PRECIES dezelfde zichtbaarheidsregel als kompas_dekkingsplan (beoordeeld,
--    subsidie_zichtbaar_voor_tier voor het abonnement van het lid, premium_exclusive alleen voor Premium). Wat het lid niet mag zien,
--    komt niet terug. Geen schrijfacties, geen gebruikersgegevens.
-- 2. De views subsidieregelingen_deadlines en funder_deadlines krijgen achteraan één kolom erbij: access_tier (free/pro/premium), zodat de
--    app een Premium-regeling als Premium kan labelen. De rest van de views (toegang, maskering, volgorde) blijft ongewijzigd.
-- 3. funder_deadlines.missie toont de algemene beschrijving van het fonds als die er is (anders de missie), zoals kompas_funders_voor_tier.
--
-- Terugdraaien: supabase/voorstel-niet-uitgevoerd/20261019075646_kompas_bron_details_terugdraaien.sql

create or replace function public.kompas_bron_details(p_scheme_ids uuid[] default '{}'::uuid[], p_funder_ids uuid[] default '{}'::uuid[])
returns table(
  bron_type text, bron_id uuid, naam text, funder_naam text, funder_type text, website text,
  omschrijving text, voorwaarden text, beoordelingscriteria text, type_projecten text, begrotingseisen text, eigen_bijdrage text,
  cofinanciering text, behandeltermijn text, aanvraagprocedure text, aanvraaglink text, bijdrage_toelichting text,
  bedrag_min numeric, bedrag_max numeric, bandbreedte_bijdrage_naam text, status text,
  deadline_datum date, beoordelingsdatum date, beoordelingsperiode text, access_tier text,
  themas_namen text[], doelgroepen_namen text[], werkgebieden_namen text[]
)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_tier text;
  v_schemes uuid[] := (coalesce(p_scheme_ids, '{}'::uuid[]))[1:100];
  v_funders uuid[] := (coalesce(p_funder_ids, '{}'::uuid[]))[1:100];
begin
  if v_uid is null then
    raise exception 'Niet ingelogd' using errcode = '28000';
  end if;

  v_tier := case
    when public.current_user_has_premium_access() then 'premium'
    when public.current_user_has_pro_access() then 'pro'
    else 'free'
  end;

  return query
  select
    'regeling'::text,
    sr.id,
    sr.naam,
    f.naam,
    f.type::text,
    coalesce(nullif(btrim(sr.website), ''), nullif(btrim(sr.aanvraaglink), ''), f.website),
    nullif(btrim(sr.algemene_beschrijving), ''),
    nullif(btrim(sr.voorwaarden), ''),
    nullif(btrim(sr.beoordelingscriteria), ''),
    nullif(btrim(sr.type_projecten), ''),
    nullif(btrim(sr.begrotingseisen), ''),
    nullif(btrim(sr.eigen_bijdrage), ''),
    nullif(btrim(sr.cofinanciering), ''),
    nullif(btrim(sr.behandeltermijn), ''),
    nullif(btrim(sr.aanvraagprocedure), ''),
    nullif(btrim(sr.aanvraaglink), ''),
    nullif(btrim(sr.bijdrage_toelichting), ''),
    sr.bedrag_min,
    sr.bedrag_max,
    bb.naam,
    sr.status::text,
    case when exists (select 1 from public.subsidieregeling_rondes rr where rr.subsidieregeling_id = sr.id)
         then (select vr.sluitingsdatum from public.subsidieregeling_volgende_ronde(sr.id, now()) vr limit 1)
         else sr.deadline_datum end,
    case when exists (select 1 from public.subsidieregeling_rondes rr where rr.subsidieregeling_id = sr.id)
         then (select vr.beoordelingsdatum from public.subsidieregeling_volgende_ronde(sr.id, now()) vr limit 1)
         else null end,
    case when exists (select 1 from public.subsidieregeling_rondes rr where rr.subsidieregeling_id = sr.id)
         then (select vr.beoordelingsperiode from public.subsidieregeling_volgende_ronde(sr.id, now()) vr limit 1)
         else sr.deadline_omschrijving end,
    sr.access_tier::text,
    (select array_agg(t.naam order by t.naam) from public.subsidieregeling_themas st join public.themas t on t.id = st.thema_id where st.subsidieregeling_id = sr.id),
    (select array_agg(d.naam order by d.naam) from public.subsidieregeling_doelgroepen sd join public.doelgroepen d on d.id = sd.doelgroep_id where sd.subsidieregeling_id = sr.id),
    (select array_agg(r.naam order by r.naam) from public.subsidieregeling_regios sw join public.regios r on r.id = sw.regio_id where sw.subsidieregeling_id = sr.id)
  from public.subsidieregelingen sr
  join public.funders f on f.id = sr.funder_id
  left join public.bandbreedtes_bijdrage bb on bb.id = sr.bandbreedte_bijdrage_id
  where sr.id = any(v_schemes)
    and sr.classification_reviewed
    and public.subsidie_zichtbaar_voor_tier(sr.classification_reviewed, sr.access_tier, sr.data_tier, sr.source_type, v_tier)
    and (v_tier = 'premium' or not coalesce((to_jsonb(f) ->> 'premium_exclusive')::boolean, false))

  union all

  select
    'fonds'::text,
    f.id,
    f.naam,
    f.naam,
    f.type::text,
    f.website,
    coalesce(nullif(btrim(f.algemene_beschrijving), ''), nullif(btrim(f.missie), '')),
    nullif(btrim(f.aanvraagcriteria), ''),
    null::text, null::text, null::text, null::text, null::text, null::text, null::text, null::text,
    nullif(btrim(f.bijdrage_toelichting), ''),
    f.bijdrage_min,
    f.bijdrage_max,
    bb.naam,
    null::text,
    (select vd.sluitingsdatum from public.funder_volgende_datamoment(f.id, null, now()) vd limit 1),
    null::date,
    null::text,
    f.access_tier::text,
    (select array_agg(t.naam order by t.naam) from public.funder_themas ft join public.themas t on t.id = ft.thema_id where ft.funder_id = f.id),
    (select array_agg(d.naam order by d.naam) from public.funder_doelgroepen fd join public.doelgroepen d on d.id = fd.doelgroep_id where fd.funder_id = f.id),
    (select array_agg(r.naam order by r.naam) from public.funder_regios fr join public.regios r on r.id = fr.regio_id where fr.funder_id = f.id)
  from public.funders f
  left join public.bandbreedtes_bijdrage bb on bb.id = f.bandbreedte_bijdrage_id
  where f.id = any(v_funders)
    and f.classification_reviewed
    and public.subsidie_zichtbaar_voor_tier(f.classification_reviewed, f.access_tier, f.data_tier, f.source_type, v_tier)
    and (v_tier = 'premium' or not coalesce((to_jsonb(f) ->> 'premium_exclusive')::boolean, false));
end;
$function$;

revoke all on function public.kompas_bron_details(uuid[], uuid[]) from public, anon;
grant execute on function public.kompas_bron_details(uuid[], uuid[]) to authenticated, service_role;

comment on function public.kompas_bron_details(uuid[], uuid[]) is 'Details van regelingen en fondsen (beschrijving, voorwaarden, disciplines, doelgroepen, werkgebieden, bijdrage, deadline) met dezelfde zichtbaarheidsregel als kompas_dekkingsplan. Alleen lezen, alleen ingelogd, hooguit 100 id''s per soort.';

-- Views: access_tier achteraan erbij; funder_deadlines.missie gebruikt de algemene beschrijving als die er is.
do $$
declare
  d text;
begin
  d := pg_get_viewdef('public.subsidieregelingen_deadlines'::regclass, true);
  if position(E'rondes_aantal\n   FROM zichtbaarheid;' in d) = 0 then raise exception 'subsidieregelingen_deadlines: verwacht einde niet gevonden'; end if;
  d := replace(d, E'rondes_aantal\n   FROM zichtbaarheid;', E'rondes_aantal,\n    access_tier::text AS access_tier\n   FROM zichtbaarheid;');
  execute 'create or replace view public.subsidieregelingen_deadlines as ' || d;

  d := pg_get_viewdef('public.funder_deadlines'::regclass, true);
  if position(E'werkgebieden_namen\n   FROM zichtbaarheid;' in d) = 0 then raise exception 'funder_deadlines: verwacht einde niet gevonden'; end if;
  if position(E'f.missie,\n' in d) = 0 then raise exception 'funder_deadlines: f.missie niet gevonden'; end if;
  d := replace(d, E'werkgebieden_namen\n   FROM zichtbaarheid;', E'werkgebieden_namen,\n    access_tier::text AS access_tier\n   FROM zichtbaarheid;');
  d := replace(d, E'f.missie,\n', E'COALESCE(NULLIF(btrim(f.algemene_beschrijving), ''''::text), f.missie) AS missie,\n');
  execute 'create or replace view public.funder_deadlines as ' || d;
end $$;
