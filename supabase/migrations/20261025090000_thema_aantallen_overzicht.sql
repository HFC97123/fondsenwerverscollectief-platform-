-- Overzicht, kaart 1: per thema van het project het aantal fondsen in de database dat dat thema heeft, voor het abonnement van het lid.
-- Alleen aantallen, geen fondsgegevens. De zichtbaarheid is dezelfde als bij de fondsmatching (nagekeken fondsen, per abonnement).
-- Fondsen die al in het plan van dit project staan tellen niet mee. Twee dubbele thema's tellen als één: 'Kinderen/jongeren' bij 'Jeugd en kinderen',
-- 'Armoede/zelfredzaamheid' bij 'Zelfredzaamheid'. Het abonnement wordt hier in de database bepaald, nooit door de browser.
create or replace function public.kompas_thema_aantallen(p_program_id uuid)
returns table(thema text, aantal integer)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_tier text;
  v_themas text[];
begin
  if v_uid is null then
    raise exception 'Niet ingelogd' using errcode = '28000';
  end if;

  select array(select distinct case btrim(x) when 'Kinderen/jongeren' then 'Jeugd en kinderen' when 'Armoede/zelfredzaamheid' then 'Zelfredzaamheid' else btrim(x) end
               from unnest(string_to_array(coalesce(p.themes, ''), ',')) x where btrim(x) <> '')
  into v_themas
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

  if v_tier = 'free' or coalesce(array_length(v_themas, 1), 0) = 0 then
    return;
  end if;

  return query
  select vt.naam::text, count(distinct f.id)::int
  from unnest(v_themas) as vt(naam)
  join public.themas t
    on case t.naam when 'Kinderen/jongeren' then 'Jeugd en kinderen' when 'Armoede/zelfredzaamheid' then 'Zelfredzaamheid' else t.naam end = vt.naam
  join public.funder_themas ft on ft.thema_id = t.id
  join public.funders f on f.id = ft.funder_id
  where f.classification_reviewed
    and public.subsidie_zichtbaar_voor_tier(f.classification_reviewed, f.access_tier, f.data_tier, f.source_type, v_tier)
    and not exists (select 1 from public.subsidie_kompas_program_funding pf where pf.program_id = p_program_id and pf.funder_id = f.id)
  group by vt.naam
  having count(distinct f.id) > 0
  order by count(distinct f.id) desc, vt.naam;
end;
$function$;

revoke all on function public.kompas_thema_aantallen(uuid) from public, anon;
grant execute on function public.kompas_thema_aantallen(uuid) to authenticated;
