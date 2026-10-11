-- PREMIUM-EXCLUSIEF (voorstel, NIET toegepast; pas toe na review).
--
-- Productregel: "Premium" (access_tier) is een abonnements-/datatier. "Premium exclusief" is een
-- aparte visibilityclassificatie: alleen expliciet exclusieve fondsen worden voor Free en Pro
-- volledig verborgen. Alle bestaande fondsen krijgen premium_exclusive = false; er wordt niets
-- automatisch gemarkeerd.
--
-- 1. funders.premium_exclusive (default false) en funders.aliassen (bekende andere namen).
-- 2. kompas_subsidieregelingen_voor_tier: alleen kolom funder_id ACHTERAAN toegevoegd (zodat een
--    regeling aan haar funder en dus aan de exclusiviteit gekoppeld kan worden). Filter,
--    volgorde, limiet en rechten ongewijzigd.
-- 3. kompas_exclusieve_funders(): ALLE exclusieve fondsen (ook onbeoordeelde, ook zonder regeling),
--    met naam, website, aliassen, regelingnamen en aanvraaglinks, alleen voor service_role.
--    Dit is de bron voor de centrale suppressielaag in de edge function.
-- 4. admin_set_funder_exclusiviteit / admin_get_funder_exclusiviteit: beheer vanuit de admin-UI,
--    met auditregel in classification_audit_log.
-- Rollback: supabase/voorstel-niet-uitgevoerd/20261009100000_funders_premium_exclusive_rollback.sql  (verplaats dit bestand naar supabase/migrations/ zodra de toepassing is goedgekeurd)
begin;

alter table public.funders
  add column if not exists premium_exclusive boolean not null default false,
  add column if not exists aliassen text[] not null default '{}';

comment on column public.funders.premium_exclusive is
  'true = expliciet exclusief fonds: volledig verborgen voor Free en Pro (via elke bron). false (default) = publiek fonds, ook als access_tier = premium.';
comment on column public.funders.aliassen is
  'Bekende alternatieve namen/spellingen van dit fonds, gebruikt voor identiteitsherkenning (o.a. bij exclusieve fondsen).';

drop function if exists public.kompas_subsidieregelingen_voor_tier(text);

create function public.kompas_subsidieregelingen_voor_tier(p_tier text)
 returns table(
   regeling_id uuid, naam text, status text, deadline_datum date, deadline_omschrijving text,
   bedrag_min numeric, bedrag_max numeric, bandbreedte_bijdrage_naam text, aanvraagcriteria text,
   beoordelingscriteria text, type_projecten text, begrotingseisen text, eigen_bijdrage text,
   cofinanciering text, behandeltermijn text, aanvraagprocedure text, aanvraaglink text,
   access_tier subsidie_access_tier, type_gever text, funder_naam text, funder_website text,
   funder_missie text, funder_aanvraagcriteria text, themas_namen text[], doelgroepen_namen text[],
   werkgebieden_namen text[], rondes_aantal bigint, sluitingstijd time without time zone,
   beoordelingsdatum date, beoordelingsperiode_ronde text,
   funder_id uuid
 )
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select
    sr.id, sr.naam,
    case sr.status
      when 'open' then 'Open' when 'binnenkort' then 'Binnenkort' when 'doorlopend' then 'Doorlopend'
      when 'aangekondigd' then 'Aangekondigd' when 'budget_uitgeput' then 'Budget uitgeput' when 'gesloten' then 'Gesloten'
      else null end,
    case when coalesce(rc.rondes_aantal, 0) > 0 then vr.sluitingsdatum else sr.deadline_datum end,
    sr.deadline_omschrijving, sr.bedrag_min, sr.bedrag_max, bb.naam, sr.voorwaarden, sr.beoordelingscriteria,
    sr.type_projecten, sr.begrotingseisen, sr.eigen_bijdrage, sr.cofinanciering, sr.behandeltermijn,
    sr.aanvraagprocedure, sr.aanvraaglink, sr.access_tier, coalesce(sr.type::text, f.type::text),
    f.naam, f.website, f.missie, f.aanvraagcriteria,
    (select array_agg(t.naam order by t.naam) from subsidieregeling_themas st join themas t on t.id = st.thema_id where st.subsidieregeling_id = sr.id),
    (select array_agg(d.naam order by d.naam) from subsidieregeling_doelgroepen sd join doelgroepen d on d.id = sd.doelgroep_id where sd.subsidieregeling_id = sr.id),
    (select array_agg(rg.naam order by rg.naam) from subsidieregeling_regios sw join regios rg on rg.id = sw.regio_id where sw.subsidieregeling_id = sr.id),
    coalesce(rc.rondes_aantal, 0),
    case when coalesce(rc.rondes_aantal, 0) > 0 then vr.sluitingstijd else null end,
    case when coalesce(rc.rondes_aantal, 0) > 0 then vr.beoordelingsdatum else null end,
    case when coalesce(rc.rondes_aantal, 0) > 0 then vr.beoordelingsperiode else null end,
    f.id
  from subsidieregelingen sr
  join funders f on f.id = sr.funder_id
  left join bandbreedtes_bijdrage bb on bb.id = sr.bandbreedte_bijdrage_id
  left join lateral (select count(*) as rondes_aantal from subsidieregeling_rondes rr where rr.subsidieregeling_id = sr.id) rc on true
  left join lateral subsidieregeling_volgende_ronde(sr.id, now()) vr(ronde_id, sluitingsdatum, sluitingstijd, sluitingsmoment, open_vanaf, beoordelingsdatum, beoordelingsperiode, toelichting, bron_url) on true
  where sr.status <> 'gesloten'
    and sr.classification_reviewed
    and public.subsidie_zichtbaar_voor_tier(sr.classification_reviewed, sr.access_tier, sr.data_tier, sr.source_type, p_tier)
  order by
    case sr.status when 'open' then 0 when 'binnenkort' then 1 when 'aangekondigd' then 2 when 'doorlopend' then 3 else 4 end,
    (case when coalesce(rc.rondes_aantal, 0) > 0 then vr.sluitingsdatum else sr.deadline_datum end) nulls last
  limit 250;
$function$;

revoke all on function public.kompas_subsidieregelingen_voor_tier(text) from public;
revoke all on function public.kompas_subsidieregelingen_voor_tier(text) from anon, authenticated;
grant execute on function public.kompas_subsidieregelingen_voor_tier(text) to service_role;

create or replace function public.kompas_exclusieve_funders()
 returns table(funder_id uuid, naam text, website text, aliassen text[], regeling_namen text[], regeling_links text[])
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select
    f.id, f.naam, f.website, f.aliassen,
    (select array_agg(sr.naam) from subsidieregelingen sr where sr.funder_id = f.id),
    (select array_agg(sr.aanvraaglink) from subsidieregelingen sr where sr.funder_id = f.id and sr.aanvraaglink is not null)
  from funders f
  where f.premium_exclusive;
$function$;

revoke all on function public.kompas_exclusieve_funders() from public;
revoke all on function public.kompas_exclusieve_funders() from anon, authenticated;
grant execute on function public.kompas_exclusieve_funders() to service_role;

create or replace function public.admin_set_funder_exclusiviteit(
  p_funder_id uuid, p_premium_exclusive boolean, p_aliassen text[] default null, p_reden text default null)
 returns void
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_oud boolean;
  v_schoon text[];
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen de exclusiviteit van een fonds wijzigen.' using errcode = '42501';
  end if;

  select premium_exclusive into v_oud from public.funders where id = p_funder_id for update;

  if not found then
    raise exception 'Fonds niet gevonden: %', p_funder_id;
  end if;

  if p_aliassen is not null then
    select coalesce(array_agg(a order by a), '{}') into v_schoon
    from (select distinct left(btrim(x), 200) as a from unnest(p_aliassen) x where btrim(coalesce(x, '')) <> '' limit 20) s;
  end if;

  update public.funders
     set premium_exclusive = coalesce(p_premium_exclusive, premium_exclusive),
         aliassen = coalesce(v_schoon, aliassen),
         updated_at = now()
   where id = p_funder_id;

  insert into public.classification_audit_log (tabel, rij_id, gewijzigd_door, reden)
  values ('funders', p_funder_id, auth.uid(),
          'premium_exclusive: ' || v_oud::text || ' -> ' || coalesce(p_premium_exclusive, v_oud)::text
          || coalesce(' (' || p_reden || ')', ''));
end;
$function$;

create or replace function public.admin_get_funder_exclusiviteit(p_funder_ids uuid[])
 returns table(funder_id uuid, premium_exclusive boolean, aliassen text[])
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  return query select f.id, f.premium_exclusive, f.aliassen from public.funders f where f.id = any(p_funder_ids);
end;
$function$;

revoke all on function public.admin_set_funder_exclusiviteit(uuid, boolean, text[], text) from public, anon;
revoke all on function public.admin_get_funder_exclusiviteit(uuid[]) from public, anon;
grant execute on function public.admin_set_funder_exclusiviteit(uuid, boolean, text[], text) to authenticated, service_role;
grant execute on function public.admin_get_funder_exclusiviteit(uuid[]) to authenticated, service_role;

commit;
