-- TOEGEPAST op het live project op 19-10-2026 (live versie 20261019122335; daarna dezelfde dag deze definitieve versie met volgorde op bandbreedte en het financieringsgat). Nooit opnieuw uitvoeren.
-- Premium-teasers voor Pro: in het dekkingsplan van een Pro-lid een paar Premium-fondsen en -regelingen die bij het project passen, ZONDER naam,
-- website, bedrag, deadline of id. Alleen: soort (fonds/regeling), bandbreedte van de bijdrage, de disciplines en doelgroepen die het project
-- ermee deelt, en hoe sterk de match is. Op verzoek van de beheerder (19-10-2026) als upsell naar Premium.
--
-- - Alleen lezen, alleen ingelogd, alleen voor het eigen project, en alleen voor Pro (Premium ziet alles al; Free heeft geen dekkingsplan).
-- - Alleen beoordeelde records die Pro NIET mag zien maar Premium wel (dezelfde subsidie_zichtbaar_voor_tier als overal).
-- - Match: minstens één gedeelde discipline én één gedeelde doelgroep, en het werkgebied mag niet botsen (geen werkgebied, Landelijk,
--   of een werkgebied dat in de locatie of het werkgebied van het project voorkomt), en de bijdrage mag niet boven het financieringsgat
--   van het project beginnen. Volgorde: meeste gedeelde categorieën, dan de grootste bandbreedte. Hooguit 3 teasers; het totaal komt mee.
-- - Geen id's in het antwoord: de browser kan er niets mee opvragen.
-- Terugdraaien: drop function public.kompas_premium_teasers(uuid);

create or replace function public.kompas_premium_teasers(p_program_id uuid)
returns table(volgnummer int, soort text, bandbreedte_bijdrage_naam text, disciplines text[], doelgroepen text[], match text, totaal int)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_tier text;
  v_themas text[];
  v_doelgroepen text[];
  v_plek text;
  v_gat numeric;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd' using errcode = '28000';
  end if;

  select
    array(select btrim(x) from unnest(string_to_array(coalesce(p.themes, ''), ',')) x where btrim(x) <> ''),
    array(select btrim(x) from unnest(string_to_array(coalesce(p.target_groups, ''), ',')) x where btrim(x) <> ''),
    lower(coalesce(p.location, '') || ' ' || coalesce(p.work_area::text, '')),
    case when p.budget_total > 0 then greatest(p.budget_total - coalesce(p.own_contribution, 0), 0) else null end
  into v_themas, v_doelgroepen, v_plek, v_gat
  from public.subsidie_kompas_programs p
  where p.id = p_program_id and p.user_id = v_uid;

  if not found then
    raise exception 'Project niet gevonden' using errcode = '42501';
  end if;

  v_tier := case
    when public.current_user_has_premium_access() then 'premium'
    when public.current_user_has_pro_access() then 'pro'
    else 'free'
  end;

  if v_tier <> 'pro' or coalesce(array_length(v_themas, 1), 0) = 0 or coalesce(array_length(v_doelgroepen, 1), 0) = 0 then
    return;
  end if;

  return query
  with kandidaten as (
    select
      'regeling'::text as k_soort,
      bb.naam as k_band,
      bb.volgorde as k_volgorde,
      bb.bedrag_min as k_min,
      array(select t.naam from public.subsidieregeling_themas st join public.themas t on t.id = st.thema_id where st.subsidieregeling_id = sr.id and t.naam = any(v_themas) order by t.naam) as k_disc,
      array(select d.naam from public.subsidieregeling_doelgroepen sd join public.doelgroepen d on d.id = sd.doelgroep_id where sd.subsidieregeling_id = sr.id and d.naam = any(v_doelgroepen) order by d.naam) as k_dg,
      array(select r.naam from public.subsidieregeling_regios sw join public.regios r on r.id = sw.regio_id where sw.subsidieregeling_id = sr.id) as k_regios
    from public.subsidieregelingen sr
    join public.funders f on f.id = sr.funder_id
    left join public.bandbreedtes_bijdrage bb on bb.id = sr.bandbreedte_bijdrage_id
    where sr.classification_reviewed
      and sr.status::text not in ('gesloten', 'budget_uitgeput')
      and not public.subsidie_zichtbaar_voor_tier(sr.classification_reviewed, sr.access_tier, sr.data_tier, sr.source_type, 'pro')
      and public.subsidie_zichtbaar_voor_tier(sr.classification_reviewed, sr.access_tier, sr.data_tier, sr.source_type, 'premium')
      and not exists (select 1 from public.subsidie_kompas_program_funding pf where pf.program_id = p_program_id and pf.scheme_id = sr.id)

    union all

    select
      'fonds'::text,
      bb.naam,
      bb.volgorde,
      bb.bedrag_min,
      array(select t.naam from public.funder_themas ft join public.themas t on t.id = ft.thema_id where ft.funder_id = f.id and t.naam = any(v_themas) order by t.naam),
      array(select d.naam from public.funder_doelgroepen fd join public.doelgroepen d on d.id = fd.doelgroep_id where fd.funder_id = f.id and d.naam = any(v_doelgroepen) order by d.naam),
      array(select r.naam from public.funder_regios fr join public.regios r on r.id = fr.regio_id where fr.funder_id = f.id)
    from public.funders f
    left join public.bandbreedtes_bijdrage bb on bb.id = f.bandbreedte_bijdrage_id
    where f.classification_reviewed
      and not public.subsidie_zichtbaar_voor_tier(f.classification_reviewed, f.access_tier, f.data_tier, f.source_type, 'pro')
      and public.subsidie_zichtbaar_voor_tier(f.classification_reviewed, f.access_tier, f.data_tier, f.source_type, 'premium')
      and not exists (select 1 from public.subsidie_kompas_program_funding pf where pf.program_id = p_program_id and pf.funder_id = f.id)
  ),
  passend as (
    select
      k.*,
      (cardinality(k.k_regios) = 0
        or exists (select 1 from unnest(k.k_regios) r where lower(r) in ('landelijk', 'nederland') or (length(r) > 2 and v_plek like '%' || lower(r) || '%'))) as k_plek_ok
    from kandidaten k
    where cardinality(k.k_disc) > 0 and cardinality(k.k_dg) > 0
      and (v_gat is null or k.k_min is null or k.k_min <= v_gat)
  ),
  gerangschikt as (
    select
      p.*,
      row_number() over (order by cardinality(p.k_disc) + cardinality(p.k_dg) desc, p.k_volgorde desc nulls last, p.k_soort) as nr,
      count(*) over () as n
    from passend p
    where p.k_plek_ok
  )
  select
    g.nr::int,
    g.k_soort,
    g.k_band,
    g.k_disc,
    g.k_dg,
    case when cardinality(g.k_disc) >= 2 and cardinality(g.k_dg) >= 1 then 'sterk' else 'goed' end,
    g.n::int
  from gerangschikt g
  where g.nr <= 3
  order by g.nr;
end;
$function$;

revoke all on function public.kompas_premium_teasers(uuid) from public, anon;
grant execute on function public.kompas_premium_teasers(uuid) to authenticated, service_role;

comment on function public.kompas_premium_teasers(uuid) is 'Pro: hooguit 3 passende Premium-fondsen/-regelingen voor het eigen project, zonder naam, id, website, bedrag of deadline (alleen soort, bandbreedte, gedeelde disciplines/doelgroepen, match). Upsell naar Premium.';
