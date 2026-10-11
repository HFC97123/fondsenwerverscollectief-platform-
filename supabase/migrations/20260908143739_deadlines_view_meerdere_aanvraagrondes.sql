-- Timeline (subsidieregelingen_deadlines) gebruikt voortaan de eerstvolgende
-- aanvraagronde als een regeling er heeft (subsidieregeling_volgende_ronde);
-- heeft een regeling nog geen enkele ronde (rondes_aantal = 0), dan blijven
-- de bestaande sr.deadline_datum/sr.deadline_omschrijving-kolommen precies
-- zoals voorheen de bron (compatibiliteitslaag, zoals gevraagd) — geen
-- van de ~123 al bestaande regelingen zonder rondes verandert dus van
-- gedrag. Kolomvolgorde van de bestaande kolommen blijft identiek; alleen
-- beoordelingsdatum/beoordelingsperiode/rondes_aantal zijn nieuw toegevoegd
-- aan het eind (CREATE OR REPLACE VIEW toestaan, want geen bestaande kolom
-- verwijderd/hertypeerd) — bestaande consumenten (deadlines.js) hoeven dus
-- niet meteen te wijzigen, maar kunnen de nieuwe velden gebruiken.
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
    case
      when (case when rc.rondes_aantal > 0 then vr.sluitingsdatum else sr.deadline_datum end) is not null
      then (case when rc.rondes_aantal > 0 then vr.sluitingsdatum else sr.deadline_datum end) - current_date
      else null
    end as dagen_resterend_echt,
    sr.bedrag_min,
    sr.bedrag_max,
    sr.voorwaarden,
    f.naam as funder_naam,
    f.website as funder_website,
    f.type as funder_type,
    (sr.status <> all (array['gesloten','doorlopend','aangekondigd','binnenkort']::regeling_status_type[]))
      and (case when rc.rondes_aantal > 0 then vr.sluitingsdatum else sr.deadline_datum end) is not null
      and (case when rc.rondes_aantal > 0 then vr.sluitingsdatum else sr.deadline_datum end) >= current_date
      as is_dated_upcoming,
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
  left join lateral subsidieregeling_volgende_ronde(sr.id, now()) vr on true
),
genummerd as (
  select
    b.*,
    row_number() over (partition by b.is_dated_upcoming order by b.deadline_datum, b.id) as vn_dated,
    row_number() over (partition by b.is_doorlopend order by b.naam, b.id) as vn_doorlopend,
    row_number() over (partition by b.is_aangekondigd order by b.deadline_datum, b.naam, b.id) as vn_aangekondigd,
    row_number() over (partition by b.is_binnenkort order by b.deadline_datum, b.naam, b.id) as vn_binnenkort
  from basis b
),
zichtbaarheid as (
  select
    g.*,
    (g.is_doorlopend and g.vn_doorlopend <= 5)
      or (g.is_aangekondigd and g.vn_aangekondigd <= 5)
      or (g.is_binnenkort and g.vn_binnenkort <= 5)
      or (g.is_dated_upcoming and g.vn_dated <= 5)
      or public.subsidie_zichtbaar_voor_tier(
           g.classification_reviewed,
           g.access_tier,
           g.data_tier,
           g.source_type,
           case
             when current_user_has_premium_access() then 'premium'
             when current_user_has_pro_access() then 'pro'
             else 'free'
           end
         ) as volledig_zichtbaar
  from genummerd g
)
select
  id,
  naam,
  thema,
  data_tier,
  source_type,
  status,
  status_ruw,
  volledig_zichtbaar,
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
  funder_type,
  werkgebied,
  themas_namen,
  doelgroepen_namen,
  werkgebieden_namen,
  case when volledig_zichtbaar then bandbreedte_bijdrage_naam else null end as bandbreedte_bijdrage_naam,
  case when volledig_zichtbaar then beoordelingsdatum else null end as beoordelingsdatum,
  case when volledig_zichtbaar then beoordelingsperiode else null end as beoordelingsperiode,
  rondes_aantal
from zichtbaarheid;
