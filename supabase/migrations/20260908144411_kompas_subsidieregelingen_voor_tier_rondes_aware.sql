-- Maakt kompas_subsidieregelingen_voor_tier ronde-aware: deadline_datum wordt
-- voortaan de echte eerstvolgende sluitingsdatum (via subsidieregeling_volgende_ronde,
-- dezelfde centrale functie als de Timeline-view), plus nieuwe kolommen
-- rondes_aantal/sluitingstijd/beoordelingsdatum/beoordelingsperiode_ronde zodat de
-- chatbot exacte rondegegevens kan noemen. deadline_omschrijving blijft ongewijzigd
-- (legacy vrije tekst) - geen dubbele logica, dezelfde functie als overal elders.

drop function public.kompas_subsidieregelingen_voor_tier(text);

create or replace function public.kompas_subsidieregelingen_voor_tier(p_tier text)
returns table(
  regeling_id uuid, naam text, status text, deadline_datum date, deadline_omschrijving text,
  bedrag_min numeric, bedrag_max numeric, bandbreedte_bijdrage_naam text,
  aanvraagcriteria text, beoordelingscriteria text, type_projecten text, begrotingseisen text,
  eigen_bijdrage text, cofinanciering text, behandeltermijn text, aanvraagprocedure text,
  aanvraaglink text, access_tier subsidie_access_tier, type_gever text,
  funder_naam text, funder_website text, funder_missie text, funder_aanvraagcriteria text,
  themas_namen text[], doelgroepen_namen text[], werkgebieden_namen text[],
  rondes_aantal bigint,
  sluitingstijd time,
  beoordelingsdatum date,
  beoordelingsperiode_ronde text
)
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select
    sr.id,
    sr.naam,
    case sr.status
      when 'open' then 'Open'
      when 'binnenkort' then 'Binnenkort'
      when 'doorlopend' then 'Doorlopend'
      when 'aangekondigd' then 'Aangekondigd'
      when 'budget_uitgeput' then 'Budget uitgeput'
      when 'gesloten' then 'Gesloten'
      else null
    end,
    case when coalesce(rc.rondes_aantal, 0) > 0 then vr.sluitingsdatum else sr.deadline_datum end,
    sr.deadline_omschrijving,
    sr.bedrag_min,
    sr.bedrag_max,
    bb.naam,
    sr.voorwaarden,
    sr.beoordelingscriteria,
    sr.type_projecten,
    sr.begrotingseisen,
    sr.eigen_bijdrage,
    sr.cofinanciering,
    sr.behandeltermijn,
    sr.aanvraagprocedure,
    sr.aanvraaglink,
    sr.access_tier,
    coalesce(sr.type::text, f.type::text),
    f.naam,
    f.website,
    f.missie,
    f.aanvraagcriteria,
    (select array_agg(t.naam order by t.naam) from subsidieregeling_themas st join themas t on t.id = st.thema_id where st.subsidieregeling_id = sr.id),
    (select array_agg(d.naam order by d.naam) from subsidieregeling_doelgroepen sd join doelgroepen d on d.id = sd.doelgroep_id where sd.subsidieregeling_id = sr.id),
    (select array_agg(rg.naam order by rg.naam) from subsidieregeling_regios sw join regios rg on rg.id = sw.regio_id where sw.subsidieregeling_id = sr.id),
    coalesce(rc.rondes_aantal, 0),
    case when coalesce(rc.rondes_aantal, 0) > 0 then vr.sluitingstijd else null end,
    case when coalesce(rc.rondes_aantal, 0) > 0 then vr.beoordelingsdatum else null end,
    case when coalesce(rc.rondes_aantal, 0) > 0 then vr.beoordelingsperiode else null end
  from subsidieregelingen sr
  join funders f on f.id = sr.funder_id
  left join bandbreedtes_bijdrage bb on bb.id = sr.bandbreedte_bijdrage_id
  left join lateral (select count(*) as rondes_aantal from subsidieregeling_rondes rr where rr.subsidieregeling_id = sr.id) rc on true
  left join lateral subsidieregeling_volgende_ronde(sr.id, now()) vr(ronde_id, sluitingsdatum, sluitingstijd, sluitingsmoment, open_vanaf, beoordelingsdatum, beoordelingsperiode, toelichting, bron_url) on true
  where sr.status <> 'gesloten'
    and public.subsidie_zichtbaar_voor_tier(sr.classification_reviewed, sr.access_tier, sr.data_tier, sr.source_type, p_tier)
  order by
    case sr.status
      when 'open' then 0
      when 'binnenkort' then 1
      when 'aangekondigd' then 2
      when 'doorlopend' then 3
      else 4
    end,
    (case when coalesce(rc.rondes_aantal, 0) > 0 then vr.sluitingsdatum else sr.deadline_datum end) nulls last
  limit 250;
$function$;

revoke all on function public.kompas_subsidieregelingen_voor_tier(text) from public;
grant execute on function public.kompas_subsidieregelingen_voor_tier(text) to anon, authenticated, service_role;
