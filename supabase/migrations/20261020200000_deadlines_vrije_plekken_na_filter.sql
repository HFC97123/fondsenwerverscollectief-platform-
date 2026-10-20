-- Deadlines: het aantal vrij zichtbare regelingen per categorie (nu 3) is op één plek vastgelegd en wordt
-- bepaald NA het filteren (thema, werkgebied, type, status, deadline-pil).
-- Reeds toegepast op de live database (migraties "deadlines_eerste_vijf_na_filter" en
-- "deadlines_vrije_plekken_een_bron"); dit bestand is de samengevoegde, herhaalbare versie.
--
-- Wijzigen van het aantal = alleen deadlines_vrije_plekken() aanpassen.

create or replace function public.deadlines_vrije_plekken()
returns integer
language sql
stable
set search_path = public, pg_temp
as $$ select 3 $$;

grant execute on function public.deadlines_vrije_plekken() to anon, authenticated, service_role;

-- De bestaande views gebruiken de centrale waarde (vervangt de vaste "<= 3"/"<= 5" in de view-definitie).
do $$
declare
  v_def text;
  v_naam text;
begin
  foreach v_naam in array array['subsidieregelingen_deadlines', 'funder_deadlines']
  loop
    v_def := pg_get_viewdef(('public.' || v_naam)::regclass, true);
    v_def := replace(replace(v_def, '<= 3', '<= public.deadlines_vrije_plekken()'), '<= 5', '<= public.deadlines_vrije_plekken()');
    execute format('create or replace view public.%I as %s', v_naam, v_def);
  end loop;
end
$$;

-- Interne, ruwe weergave (geen masker, geen zichtbaarheid): afgeleid van de basis-CTE van de view hierboven.
-- NIET leesbaar voor anon/authenticated; alleen de security-definer-functie hieronder gebruikt hem.
do $$
declare
  v_def text;
  v_pos int;
begin
  v_def := pg_get_viewdef('public.subsidieregelingen_deadlines'::regclass, true);
  v_pos := position('), genummerd AS (' in v_def);

  if v_pos = 0 then
    raise exception 'basis-CTE niet gevonden in subsidieregelingen_deadlines';
  end if;

  execute 'create or replace view public.subsidieregelingen_deadlines_ruw as '
    || substring(v_def from 1 for v_pos) || ' select * from basis';
end
$$;

revoke all on public.subsidieregelingen_deadlines_ruw from public, anon, authenticated;

-- Geeft UITSLUITEND rijen terug die voor de ingelogde gebruiker volledig zichtbaar zijn: de eerste vrije plekken per
-- categorie binnen de gefilterde set, of wat het abonnement sowieso toegang toe geeft.
create or replace function public.deadlines_ontgrendeld(
  p_status text[] default null,
  p_thema text default null,
  p_regio text default null,
  p_type text default null,
  p_deadline text default 'alle',
  p_archief boolean default false
)
returns setof public.subsidieregelingen_deadlines
language sql
stable
security definer
set search_path = public, pg_temp
as $$
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
      row_number() over (partition by g.is_dated_upcoming order by g.deadline_datum, g.id) as vn_dated,
      row_number() over (partition by g.is_doorlopend order by g.naam, g.id) as vn_doorlopend,
      row_number() over (partition by g.is_aangekondigd order by g.deadline_datum, g.naam, g.id) as vn_aangekondigd,
      row_number() over (partition by g.is_binnenkort order by g.deadline_datum, g.naam, g.id) as vn_binnenkort
    from gef g
  )
  select
    n.id, n.naam, n.thema, n.data_tier, n.source_type, n.status, n.status_ruw,
    true as volledig_zichtbaar,
    n.deadline_datum,
    n.dagen_resterend_echt as dagen_resterend,
    null::text as deadline_periode,
    n.bedrag_min, n.bedrag_max, n.voorwaarden, n.funder_naam, n.funder_website, n.funder_type,
    n.werkgebied, n.themas_namen, n.doelgroepen_namen, n.werkgebieden_namen,
    n.bandbreedte_bijdrage_naam, n.beoordelingsdatum, n.beoordelingsperiode, n.rondes_aantal,
    n.access_tier::text as access_tier
  from genummerd n
  where (n.is_doorlopend and n.vn_doorlopend <= public.deadlines_vrije_plekken())
     or (n.is_aangekondigd and n.vn_aangekondigd <= public.deadlines_vrije_plekken())
     or (n.is_binnenkort and n.vn_binnenkort <= public.deadlines_vrije_plekken())
     or (n.is_dated_upcoming and n.vn_dated <= public.deadlines_vrije_plekken())
     or subsidie_zichtbaar_voor_tier(
          n.classification_reviewed, n.access_tier, n.data_tier, n.source_type, (select t from tier)
        );
$$;

revoke all on function public.deadlines_ontgrendeld(text[], text, text, text, text, boolean) from public, anon;
grant execute on function public.deadlines_ontgrendeld(text[], text, text, text, text, boolean) to authenticated, service_role;
