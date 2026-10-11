-- Free-fondsmatching: de bestaande kompas_funders_voor_tier() geeft maximaal 300 fondsen terug,
-- alfabetisch (van 1561 beoordeelde fondsen), waardoor de matching en de telling van passende
-- database-matches een alfabetisch afgeknipt deel van de database zien. Deze functie geeft
-- dezelfde kolommen terug, zonder limiet, en alleen fondsen met minstens een classificatie
-- (thema, doelgroep of regio) - een fonds zonder enige classificatie kan niet aantoonbaar passen.
-- Uitsluitend voor service_role (zoals de andere kompas_*_voor_tier-functies). Wijzigt niets
-- aan bestaande functies. Toegepast op productie op 2026-10-08 (migratie "kompas_funders_voor_matching").
create or replace function public.kompas_funders_voor_matching(p_tier text)
returns table(
  funder_id uuid, funder_naam text, funder_type text, funder_website text, missie text,
  aanvraagcriteria text, bijdrage_min numeric, bijdrage_max numeric, bandbreedte_bijdrage_naam text,
  access_tier subsidie_access_tier, themas_namen text[], doelgroepen_namen text[], werkgebieden_namen text[]
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
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
    and (
      exists (select 1 from funder_themas x where x.funder_id = f.id)
      or exists (select 1 from funder_doelgroepen x where x.funder_id = f.id)
      or exists (select 1 from funder_regios x where x.funder_id = f.id)
    )
  order by f.naam;
$function$;

revoke all on function public.kompas_funders_voor_matching(text) from public, anon, authenticated;
grant execute on function public.kompas_funders_voor_matching(text) to service_role;
