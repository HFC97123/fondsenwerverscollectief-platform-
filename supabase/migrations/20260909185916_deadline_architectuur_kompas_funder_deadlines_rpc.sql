
-- AI-chatbotcontext (Subsidie Kompas): funder-brede deadlines, met exact
-- dezelfde tier-regel (subsidie_zichtbaar_voor_tier) en hetzelfde patroon als
-- kompas_subsidieregelingen_voor_tier - een eigen sibling-RPC in plaats van
-- die RPC's kolomvorm te wijzigen (funder-brede data heeft geen
-- regelingspecifieke velden zoals begrotingseisen/aanvraagprocedure). tier
-- komt in de Edge Function net als bij kompas_subsidieregelingen_voor_tier
-- uitsluitend server-side uit profiles.subscription_tier.
CREATE FUNCTION public.kompas_funder_deadlines_voor_tier(p_tier text)
 RETURNS TABLE(
   funder_id uuid,
   funder_naam text,
   funder_website text,
   funder_missie text,
   funder_aanvraagcriteria text,
   type_gever text,
   access_tier subsidie_access_tier,
   datamoment_type datamoment_type,
   datamoment_naam text,
   deadline_datum date,
   sluitingstijd time without time zone,
   toelichting text,
   bron_url text,
   bijdrage_min numeric,
   bijdrage_max numeric,
   bandbreedte_bijdrage_naam text,
   themas_namen text[],
   doelgroepen_namen text[],
   werkgebieden_namen text[]
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select
    f.id,
    f.naam,
    f.website,
    f.missie,
    f.aanvraagcriteria,
    f.type::text,
    f.access_tier,
    vd.type,
    vd.naam,
    vd.sluitingsdatum,
    vd.sluitingstijd,
    vd.toelichting,
    vd.bron_url,
    f.bijdrage_min,
    f.bijdrage_max,
    bb.naam,
    (select array_agg(t.naam order by t.naam) from funder_themas ft join themas t on t.id = ft.thema_id where ft.funder_id = f.id),
    (select array_agg(d.naam order by d.naam) from funder_doelgroepen fd join doelgroepen d on d.id = fd.doelgroep_id where fd.funder_id = f.id),
    (select array_agg(r.naam order by r.naam) from funder_regios fr join regios r on r.id = fr.regio_id where fr.funder_id = f.id)
  from funders f
  join lateral funder_volgende_datamoment(f.id, null, now()) vd(datamoment_id, type, naam, sluitingsdatum, sluitingstijd, sluitingsmoment, status, toelichting, bron_url) on vd.datamoment_id is not null
  left join bandbreedtes_bijdrage bb on bb.id = f.bandbreedte_bijdrage_id
  where public.subsidie_zichtbaar_voor_tier(f.classification_reviewed, f.access_tier, f.data_tier, f.source_type, p_tier)
  order by vd.sluitingsdatum asc
  limit 100;
$function$;
