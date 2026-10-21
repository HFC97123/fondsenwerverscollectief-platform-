-- Free na een filter: precies 3 volledig zichtbare regelingen per filter (niet meer 3 per sectie).
-- Keuze van die 3: eerst regelingen waar de gekozen discipline een hoofdfocus is (hooguit 3 disciplines),
-- dan regelingen met een naderende deadline, dan doorlopend, binnenkort, aangekondigd; budget uitgeput achteraan.
-- Pro/Premium: wat voor hun abonnement zichtbaar is blijft zichtbaar (ongewijzigd).
-- Terugdraaien: supabase/voorstel-niet-uitgevoerd/20261021100000_deadlines_drie_vrij_per_filter_terugdraaien.sql

create or replace function public.deadlines_ontgrendeld(
  p_status text[] default null::text[],
  p_thema text default null::text,
  p_regio text default null::text,
  p_type text default null::text,
  p_deadline text default 'alle'::text,
  p_archief boolean default false
)
returns setof subsidieregelingen_deadlines
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  with tier as (
    select case
      when current_user_has_premium_access() then 'premium'
      when current_user_has_pro_access() then 'pro'
      else 'free'
    end as t
  ),
  gef as (
    select b.*
    from subsidieregelingen_deadlines_ruw b
    where (p_archief or coalesce(p_deadline, 'alle') = 'heel_jaar' or coalesce(b.status, 'Open') <> 'Gesloten')
      and (p_status is null or cardinality(p_status) = 0 or b.status = any (p_status))
      and (
        p_thema is null or p_thema = 'alle'
        or p_thema = any (case when coalesce(cardinality(b.themas_namen), 0) > 0 then b.themas_namen else array[b.thema] end)
      )
      and (
        p_regio is null or p_regio = 'alle'
        or p_regio = any (case when coalesce(cardinality(b.werkgebieden_namen), 0) > 0 then b.werkgebieden_namen else array[b.werkgebied] end)
      )
      and (p_type is null or p_type = 'alle' or b.funder_type::text = p_type)
      and case coalesce(p_deadline, 'alle')
        when '30' then b.dagen_resterend_echt is not null and b.dagen_resterend_echt between 0 and 30
        when '90' then b.dagen_resterend_echt is not null and b.dagen_resterend_echt between 0 and 90
        when 'binnenkort' then b.dagen_resterend_echt is not null
          and b.dagen_resterend_echt between 0 and ((current_date + interval '5 months')::date - current_date)
        when 'doorlopend' then b.status = 'Doorlopend'
        when 'heel_jaar' then b.deadline_datum is not null
          and extract(year from b.deadline_datum) = extract(year from current_date)
        else true
      end
  ),
  genummerd as (
    select g.*,
      row_number() over (
        order by
          -- 1. de gekozen discipline is een hoofdfocus (regeling heeft hooguit 3 disciplines)
          case when p_thema is null or p_thema = 'alle' then 0
               when coalesce(cardinality(g.themas_namen), 1) <= 3 then 0 else 1 end,
          -- 2. budget uitgeput / gesloten achteraan
          case when g.status in ('Budget uitgeput', 'Gesloten') then 1 else 0 end,
          -- 3. naderende deadline eerst, dan doorlopend, binnenkort, aangekondigd
          case when g.is_dated_upcoming then 0 when g.is_doorlopend then 1 when g.is_binnenkort then 2
               when g.is_aangekondigd then 3 else 4 end,
          g.deadline_datum nulls last,
          g.naam,
          g.id
      ) as vn
    from gef g
  )
  select
    n.id, n.naam, n.thema, n.data_tier, n.source_type, n.status, n.status_ruw,
    true as volledig_zichtbaar,
    n.deadline_datum,
    n.dagen_resterend_echt as dagen_resterend,
    null::text as deadline_periode,
    n.bedrag_min, n.bedrag_max, n.voorwaarden, n.funder_naam, n.funder_website, n.funder_type,
    n.werkgebied, n.themas_namen, n.doelgroepen_namen, n.werkgebieden_namen, n.bandbreedte_bijdrage_naam,
    n.beoordelingsdatum, n.beoordelingsperiode, n.rondes_aantal,
    n.access_tier::text as access_tier
  from genummerd n
  where n.vn <= public.deadlines_vrije_plekken()
     or subsidie_zichtbaar_voor_tier(n.classification_reviewed, n.access_tier, n.data_tier, n.source_type, (select t from tier));
$function$;
