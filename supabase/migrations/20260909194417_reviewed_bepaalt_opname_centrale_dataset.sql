
-- Architectuurregel: classification_reviewed bepaalt voortaan of een Funder/Subsidieregeling
-- OVERHAUPT onderdeel wordt van de centrale, publieke dataset (Deadline-overzicht, Timeline,
-- filters, matching, AI/chatbot). access_tier blijft, zoals altijd, uitsluitend bepalend voor
-- HOEVEEL detail een lid van een reviewed record te zien krijgt (subsidie_zichtbaar_voor_tier,
-- ongewijzigd). Geen tweede rechtenmodel: dezelfde functie, dezelfde kolommen, alleen een
-- extra rij-filter op classification_reviewed vóór die functie wordt toegepast.

create or replace view public.subsidieregelingen_deadlines as
with basis as (
  select
    sr.id,
    sr.naam,
    sr.thema,
    sr.werkgebied,
    sr.data_tier,
    sr.source_type,
    sr.classification_reviewed,
    sr.access_tier,
    sr.status::text as status_ruw,
    case sr.status
      when 'open' then 'Open'
      when 'binnenkort' then 'Binnenkort'
      when 'doorlopend' then 'Doorlopend'
      when 'aangekondigd' then 'Aangekondigd'
      when 'budget_uitgeput' then 'Budget uitgeput'
      when 'gesloten' then 'Gesloten'
      else null
    end as status,
    rc.rondes_aantal,
    case when rc.rondes_aantal > 0 then vr.sluitingsdatum else sr.deadline_datum end as deadline_datum,
    case when rc.rondes_aantal > 0 then vr.beoordelingsdatum else null end as beoordelingsdatum,
    case when rc.rondes_aantal > 0 then vr.beoordelingsperiode else sr.deadline_omschrijving end as beoordelingsperiode,
    case when (case when rc.rondes_aantal > 0 then vr.sluitingsdatum else sr.deadline_datum end) is not null
      then (case when rc.rondes_aantal > 0 then vr.sluitingsdatum else sr.deadline_datum end) - current_date
      else null end as dagen_resterend_echt,
    sr.bedrag_min,
    sr.bedrag_max,
    sr.voorwaarden,
    f.naam as funder_naam,
    f.website as funder_website,
    f.type as funder_type,
    (sr.status <> all (array['gesloten','doorlopend','aangekondigd','binnenkort']::regeling_status_type[]))
      and (case when rc.rondes_aantal > 0 then vr.sluitingsdatum else sr.deadline_datum end) is not null
      and (case when rc.rondes_aantal > 0 then vr.sluitingsdatum else sr.deadline_datum end) >= current_date as is_dated_upcoming,
    sr.status = 'doorlopend' as is_doorlopend,
    sr.status = 'aangekondigd' as is_aangekondigd,
    sr.status = 'binnenkort' as is_binnenkort,
    (select array_agg(t.naam order by t.naam) from subsidieregeling_themas st join themas t on t.id = st.thema_id where st.subsidieregeling_id = sr.id) as themas_namen,
    (select array_agg(d.naam order by d.naam) from subsidieregeling_doelgroepen sd join doelgroepen d on d.id = sd.doelgroep_id where sd.subsidieregeling_id = sr.id) as doelgroepen_namen,
    (select array_agg(r.naam order by r.naam) from subsidieregeling_regios sw join regios r on r.id = sw.regio_id where sw.subsidieregeling_id = sr.id) as werkgebieden_namen,
    bb.naam as bandbreedte_bijdrage_naam
  from subsidieregelingen sr
  join funders f on f.id = sr.funder_id
  left join bandbreedtes_bijdrage bb on bb.id = sr.bandbreedte_bijdrage_id
  left join lateral (select count(*) as rondes_aantal from subsidieregeling_rondes rr where rr.subsidieregeling_id = sr.id) rc on true
  left join lateral subsidieregeling_volgende_ronde(sr.id, now()) vr(ronde_id, sluitingsdatum, sluitingstijd, sluitingsmoment, open_vanaf, beoordelingsdatum, beoordelingsperiode, toelichting, bron_url) on true
  where sr.classification_reviewed
), genummerd as (
  select b.*,
    row_number() over (partition by b.is_dated_upcoming order by b.deadline_datum, b.id) as vn_dated,
    row_number() over (partition by b.is_doorlopend order by b.naam, b.id) as vn_doorlopend,
    row_number() over (partition by b.is_aangekondigd order by b.deadline_datum, b.naam, b.id) as vn_aangekondigd,
    row_number() over (partition by b.is_binnenkort order by b.deadline_datum, b.naam, b.id) as vn_binnenkort
  from basis b
), zichtbaarheid as (
  select g.*,
    (g.is_doorlopend and g.vn_doorlopend <= 5)
    or (g.is_aangekondigd and g.vn_aangekondigd <= 5)
    or (g.is_binnenkort and g.vn_binnenkort <= 5)
    or (g.is_dated_upcoming and g.vn_dated <= 5)
    or subsidie_zichtbaar_voor_tier(g.classification_reviewed, g.access_tier, g.data_tier, g.source_type,
         case when current_user_has_premium_access() then 'premium'
              when current_user_has_pro_access() then 'pro'
              else 'free' end) as volledig_zichtbaar
  from genummerd g
)
select
  id, naam, thema, data_tier, source_type, status, status_ruw, volledig_zichtbaar,
  case when volledig_zichtbaar then deadline_datum else null end as deadline_datum,
  case
    when volledig_zichtbaar then dagen_resterend_echt
    when deadline_datum is null then null
    when dagen_resterend_echt < 7 then 0
    when dagen_resterend_echt < 31 then 7
    when dagen_resterend_echt < 91 then 31
    when dagen_resterend_echt < 181 then 91
    else 181
  end as dagen_resterend,
  case
    when volledig_zichtbaar then null
    when deadline_datum is null then 'Doorlopend of onbekend'
    when dagen_resterend_echt < 7 then 'Binnen 1 week'
    when dagen_resterend_echt < 31 then 'Binnen 1 maand'
    when dagen_resterend_echt < 91 then 'Binnen 3 maanden'
    when dagen_resterend_echt < 181 then 'Binnen 6 maanden'
    else 'Later dan 6 maanden'
  end as deadline_periode,
  case when volledig_zichtbaar then bedrag_min else null end as bedrag_min,
  case when volledig_zichtbaar then bedrag_max else null end as bedrag_max,
  case when volledig_zichtbaar then voorwaarden else null end as voorwaarden,
  case when volledig_zichtbaar then funder_naam else null end as funder_naam,
  case when volledig_zichtbaar then funder_website else null end as funder_website,
  funder_type, werkgebied, themas_namen, doelgroepen_namen, werkgebieden_namen,
  case when volledig_zichtbaar then bandbreedte_bijdrage_naam else null end as bandbreedte_bijdrage_naam,
  case when volledig_zichtbaar then beoordelingsdatum else null end as beoordelingsdatum,
  case when volledig_zichtbaar then beoordelingsperiode else null end as beoordelingsperiode,
  rondes_aantal
from zichtbaarheid;

grant select on public.subsidieregelingen_deadlines to anon, authenticated;

create or replace view public.funder_deadlines as
with basis as (
  select
    f.id as funder_id, f.naam as funder_naam, f.type as funder_type, f.website as funder_website,
    f.missie, f.aanvraagcriteria, f.bijdrage_min, f.bijdrage_max, bb.naam as bandbreedte_bijdrage_naam,
    f.data_tier, f.source_type, f.classification_reviewed, f.access_tier,
    vd.datamoment_id, vd.type as datamoment_type, vd.naam as datamoment_naam,
    vd.sluitingsdatum as deadline_datum, vd.sluitingstijd, vd.toelichting, vd.bron_url,
    (vd.sluitingsdatum - current_date) as dagen_resterend_echt,
    (select array_agg(t.naam order by t.naam) from funder_themas ft join themas t on t.id = ft.thema_id where ft.funder_id = f.id) as themas_namen,
    (select array_agg(d.naam order by d.naam) from funder_doelgroepen fd join doelgroepen d on d.id = fd.doelgroep_id where fd.funder_id = f.id) as doelgroepen_namen,
    (select array_agg(r.naam order by r.naam) from funder_regios fr join regios r on r.id = fr.regio_id where fr.funder_id = f.id) as werkgebieden_namen
  from funders f
  cross join lateral funder_volgende_datamoment(f.id, null, now()) vd(datamoment_id, type, naam, sluitingsdatum, sluitingstijd, sluitingsmoment, status, toelichting, bron_url)
  left join bandbreedtes_bijdrage bb on bb.id = f.bandbreedte_bijdrage_id
  where vd.datamoment_id is not null
    and f.classification_reviewed
), zichtbaarheid as (
  select b.*,
    subsidie_zichtbaar_voor_tier(b.classification_reviewed, b.access_tier, b.data_tier, b.source_type,
      case when current_user_has_premium_access() then 'premium'
           when current_user_has_pro_access() then 'pro'
           else 'free' end) as volledig_zichtbaar
  from basis b
)
select
  datamoment_id as id, funder_id, funder_naam, funder_type, datamoment_type, datamoment_naam, data_tier, source_type, volledig_zichtbaar,
  case when volledig_zichtbaar then deadline_datum else null end as deadline_datum,
  case when volledig_zichtbaar then dagen_resterend_echt
       when dagen_resterend_echt < 7 then 0
       when dagen_resterend_echt < 31 then 7
       when dagen_resterend_echt < 91 then 31
       when dagen_resterend_echt < 181 then 91
       else 181 end as dagen_resterend,
  case when volledig_zichtbaar then null
       when dagen_resterend_echt < 7 then 'Binnen 1 week'
       when dagen_resterend_echt < 31 then 'Binnen 1 maand'
       when dagen_resterend_echt < 91 then 'Binnen 3 maanden'
       when dagen_resterend_echt < 181 then 'Binnen 6 maanden'
       else 'Later dan 6 maanden' end as deadline_periode,
  case when volledig_zichtbaar then sluitingstijd else null end as sluitingstijd,
  case when volledig_zichtbaar then toelichting else null end as toelichting,
  case when volledig_zichtbaar then bron_url else null end as bron_url,
  case when volledig_zichtbaar then funder_website else null end as funder_website,
  case when volledig_zichtbaar then missie else null end as missie,
  case when volledig_zichtbaar then aanvraagcriteria else null end as aanvraagcriteria,
  case when volledig_zichtbaar then bijdrage_min else null end as bijdrage_min,
  case when volledig_zichtbaar then bijdrage_max else null end as bijdrage_max,
  case when volledig_zichtbaar then bandbreedte_bijdrage_naam else null end as bandbreedte_bijdrage_naam,
  themas_namen, doelgroepen_namen, werkgebieden_namen
from zichtbaarheid;

grant select on public.funder_deadlines to anon, authenticated;

create or replace function public.kompas_subsidieregelingen_voor_tier(p_tier text)
 returns table(regeling_id uuid, naam text, status text, deadline_datum date, deadline_omschrijving text, bedrag_min numeric, bedrag_max numeric, bandbreedte_bijdrage_naam text, aanvraagcriteria text, beoordelingscriteria text, type_projecten text, begrotingseisen text, eigen_bijdrage text, cofinanciering text, behandeltermijn text, aanvraagprocedure text, aanvraaglink text, access_tier subsidie_access_tier, type_gever text, funder_naam text, funder_website text, funder_missie text, funder_aanvraagcriteria text, themas_namen text[], doelgroepen_namen text[], werkgebieden_namen text[], rondes_aantal bigint, sluitingstijd time without time zone, beoordelingsdatum date, beoordelingsperiode_ronde text)
 language sql stable security definer set search_path to 'public', 'pg_temp'
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
    case when coalesce(rc.rondes_aantal, 0) > 0 then vr.beoordelingsperiode else null end
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

create or replace function public.kompas_funder_deadlines_voor_tier(p_tier text)
 returns table(funder_id uuid, funder_naam text, funder_website text, funder_missie text, funder_aanvraagcriteria text, type_gever text, access_tier subsidie_access_tier, datamoment_type datamoment_type, datamoment_naam text, deadline_datum date, sluitingstijd time without time zone, toelichting text, bron_url text, bijdrage_min numeric, bijdrage_max numeric, bandbreedte_bijdrage_naam text, themas_namen text[], doelgroepen_namen text[], werkgebieden_namen text[])
 language sql stable security definer set search_path to 'public', 'pg_temp'
as $function$
  select
    f.id, f.naam, f.website, f.missie, f.aanvraagcriteria, f.type::text, f.access_tier,
    vd.type, vd.naam, vd.sluitingsdatum, vd.sluitingstijd, vd.toelichting, vd.bron_url,
    f.bijdrage_min, f.bijdrage_max, bb.naam,
    (select array_agg(t.naam order by t.naam) from funder_themas ft join themas t on t.id = ft.thema_id where ft.funder_id = f.id),
    (select array_agg(d.naam order by d.naam) from funder_doelgroepen fd join doelgroepen d on d.id = fd.doelgroep_id where fd.funder_id = f.id),
    (select array_agg(r.naam order by r.naam) from funder_regios fr join regios r on r.id = fr.regio_id where fr.funder_id = f.id)
  from funders f
  join lateral funder_volgende_datamoment(f.id, null, now()) vd(datamoment_id, type, naam, sluitingsdatum, sluitingstijd, sluitingsmoment, status, toelichting, bron_url) on vd.datamoment_id is not null
  left join bandbreedtes_bijdrage bb on bb.id = f.bandbreedte_bijdrage_id
  where f.classification_reviewed
    and public.subsidie_zichtbaar_voor_tier(f.classification_reviewed, f.access_tier, f.data_tier, f.source_type, p_tier)
  order by vd.sluitingsdatum asc
  limit 100;
$function$;

-- Nieuwe RPC: ALLE beoordeelde funders (ongeacht of ze een eigen deadline/datamoment hebben) voor de AI-chatbot,
-- zodat "fondsadvies" ook vermogensfondsen zonder eigen aanvraagronde/vergaderdatum kan noemen (missie, criteria,
-- classificaties, type, bandbreedte). Zelfde tier-regel, geen tweede rechtenmodel.
create or replace function public.kompas_funders_voor_tier(p_tier text)
 returns table(funder_id uuid, funder_naam text, funder_type text, funder_website text, missie text, aanvraagcriteria text, bijdrage_min numeric, bijdrage_max numeric, bandbreedte_bijdrage_naam text, access_tier subsidie_access_tier, themas_namen text[], doelgroepen_namen text[], werkgebieden_namen text[])
 language sql stable security definer set search_path to 'public', 'pg_temp'
as $function$
  select
    f.id, f.naam, f.type::text, f.website, f.missie, f.aanvraagcriteria, f.bijdrage_min, f.bijdrage_max, bb.naam, f.access_tier,
    (select array_agg(t.naam order by t.naam) from funder_themas ft join themas t on t.id = ft.thema_id where ft.funder_id = f.id),
    (select array_agg(d.naam order by d.naam) from funder_doelgroepen fd join doelgroepen d on d.id = fd.doelgroep_id where fd.funder_id = f.id),
    (select array_agg(r.naam order by r.naam) from funder_regios fr join regios r on r.id = fr.regio_id where fr.funder_id = f.id)
  from funders f
  left join bandbreedtes_bijdrage bb on bb.id = f.bandbreedte_bijdrage_id
  where f.classification_reviewed
    and public.subsidie_zichtbaar_voor_tier(f.classification_reviewed, f.access_tier, f.data_tier, f.source_type, p_tier)
  order by f.naam
  limit 300;
$function$;
