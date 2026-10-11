
-- 1) subsidieregelingen_deadlines: rondes_aantal rechtstreeks tellen op
-- subsidieregeling_rondes.subsidieregeling_id in plaats van via de
-- (te verwijderen) koppeltabel.
CREATE OR REPLACE VIEW public.subsidieregelingen_deadlines AS
 WITH basis AS (
         SELECT sr.id,
            sr.naam,
            sr.thema,
            sr.werkgebied,
            sr.data_tier,
            sr.source_type,
            sr.classification_reviewed,
            sr.access_tier,
            sr.status::text AS status_ruw,
                CASE sr.status
                    WHEN 'open'::regeling_status_type THEN 'Open'::text
                    WHEN 'binnenkort'::regeling_status_type THEN 'Binnenkort'::text
                    WHEN 'doorlopend'::regeling_status_type THEN 'Doorlopend'::text
                    WHEN 'aangekondigd'::regeling_status_type THEN 'Aangekondigd'::text
                    WHEN 'budget_uitgeput'::regeling_status_type THEN 'Budget uitgeput'::text
                    WHEN 'gesloten'::regeling_status_type THEN 'Gesloten'::text
                    ELSE NULL::text
                END AS status,
            rc.rondes_aantal,
                CASE
                    WHEN rc.rondes_aantal > 0 THEN vr.sluitingsdatum
                    ELSE sr.deadline_datum
                END AS deadline_datum,
                CASE
                    WHEN rc.rondes_aantal > 0 THEN vr.beoordelingsdatum
                    ELSE NULL::date
                END AS beoordelingsdatum,
                CASE
                    WHEN rc.rondes_aantal > 0 THEN vr.beoordelingsperiode
                    ELSE sr.deadline_omschrijving
                END AS beoordelingsperiode,
                CASE
                    WHEN
                    CASE
                        WHEN rc.rondes_aantal > 0 THEN vr.sluitingsdatum
                        ELSE sr.deadline_datum
                    END IS NOT NULL THEN
                    CASE
                        WHEN rc.rondes_aantal > 0 THEN vr.sluitingsdatum
                        ELSE sr.deadline_datum
                    END - CURRENT_DATE
                    ELSE NULL::integer
                END AS dagen_resterend_echt,
            sr.bedrag_min,
            sr.bedrag_max,
            sr.voorwaarden,
            f.naam AS funder_naam,
            f.website AS funder_website,
            f.type AS funder_type,
            (sr.status <> ALL (ARRAY['gesloten'::regeling_status_type, 'doorlopend'::regeling_status_type, 'aangekondigd'::regeling_status_type, 'binnenkort'::regeling_status_type])) AND
                CASE
                    WHEN rc.rondes_aantal > 0 THEN vr.sluitingsdatum
                    ELSE sr.deadline_datum
                END IS NOT NULL AND
                CASE
                    WHEN rc.rondes_aantal > 0 THEN vr.sluitingsdatum
                    ELSE sr.deadline_datum
                END >= CURRENT_DATE AS is_dated_upcoming,
            sr.status = 'doorlopend'::regeling_status_type AS is_doorlopend,
            sr.status = 'aangekondigd'::regeling_status_type AS is_aangekondigd,
            sr.status = 'binnenkort'::regeling_status_type AS is_binnenkort,
            ( SELECT array_agg(t.naam ORDER BY t.naam) AS array_agg
                   FROM subsidieregeling_themas st
                     JOIN themas t ON t.id = st.thema_id
                  WHERE st.subsidieregeling_id = sr.id) AS themas_namen,
            ( SELECT array_agg(d.naam ORDER BY d.naam) AS array_agg
                   FROM subsidieregeling_doelgroepen sd
                     JOIN doelgroepen d ON d.id = sd.doelgroep_id
                  WHERE sd.subsidieregeling_id = sr.id) AS doelgroepen_namen,
            ( SELECT array_agg(r.naam ORDER BY r.naam) AS array_agg
                   FROM subsidieregeling_regios sw
                     JOIN regios r ON r.id = sw.regio_id
                  WHERE sw.subsidieregeling_id = sr.id) AS werkgebieden_namen,
            bb.naam AS bandbreedte_bijdrage_naam
           FROM subsidieregelingen sr
             JOIN funders f ON f.id = sr.funder_id
             LEFT JOIN bandbreedtes_bijdrage bb ON bb.id = sr.bandbreedte_bijdrage_id
             LEFT JOIN LATERAL ( SELECT count(*) AS rondes_aantal
                   FROM subsidieregeling_rondes rr
                  WHERE rr.subsidieregeling_id = sr.id) rc ON true
             LEFT JOIN LATERAL subsidieregeling_volgende_ronde(sr.id, now()) vr(ronde_id, sluitingsdatum, sluitingstijd, sluitingsmoment, open_vanaf, beoordelingsdatum, beoordelingsperiode, toelichting, bron_url) ON true
        ), genummerd AS (
         SELECT b.id,
            b.naam,
            b.thema,
            b.werkgebied,
            b.data_tier,
            b.source_type,
            b.classification_reviewed,
            b.access_tier,
            b.status_ruw,
            b.status,
            b.rondes_aantal,
            b.deadline_datum,
            b.beoordelingsdatum,
            b.beoordelingsperiode,
            b.dagen_resterend_echt,
            b.bedrag_min,
            b.bedrag_max,
            b.voorwaarden,
            b.funder_naam,
            b.funder_website,
            b.funder_type,
            b.is_dated_upcoming,
            b.is_doorlopend,
            b.is_aangekondigd,
            b.is_binnenkort,
            b.themas_namen,
            b.doelgroepen_namen,
            b.werkgebieden_namen,
            b.bandbreedte_bijdrage_naam,
            row_number() OVER (PARTITION BY b.is_dated_upcoming ORDER BY b.deadline_datum, b.id) AS vn_dated,
            row_number() OVER (PARTITION BY b.is_doorlopend ORDER BY b.naam, b.id) AS vn_doorlopend,
            row_number() OVER (PARTITION BY b.is_aangekondigd ORDER BY b.deadline_datum, b.naam, b.id) AS vn_aangekondigd,
            row_number() OVER (PARTITION BY b.is_binnenkort ORDER BY b.deadline_datum, b.naam, b.id) AS vn_binnenkort
           FROM basis b
        ), zichtbaarheid AS (
         SELECT g.id,
            g.naam,
            g.thema,
            g.werkgebied,
            g.data_tier,
            g.source_type,
            g.classification_reviewed,
            g.access_tier,
            g.status_ruw,
            g.status,
            g.rondes_aantal,
            g.deadline_datum,
            g.beoordelingsdatum,
            g.beoordelingsperiode,
            g.dagen_resterend_echt,
            g.bedrag_min,
            g.bedrag_max,
            g.voorwaarden,
            g.funder_naam,
            g.funder_website,
            g.funder_type,
            g.is_dated_upcoming,
            g.is_doorlopend,
            g.is_aangekondigd,
            g.is_binnenkort,
            g.themas_namen,
            g.doelgroepen_namen,
            g.werkgebieden_namen,
            g.bandbreedte_bijdrage_naam,
            g.vn_dated,
            g.vn_doorlopend,
            g.vn_aangekondigd,
            g.vn_binnenkort,
            g.is_doorlopend AND g.vn_doorlopend <= 5 OR g.is_aangekondigd AND g.vn_aangekondigd <= 5 OR g.is_binnenkort AND g.vn_binnenkort <= 5 OR g.is_dated_upcoming AND g.vn_dated <= 5 OR subsidie_zichtbaar_voor_tier(g.classification_reviewed, g.access_tier, g.data_tier, g.source_type,
                CASE
                    WHEN current_user_has_premium_access() THEN 'premium'::text
                    WHEN current_user_has_pro_access() THEN 'pro'::text
                    ELSE 'free'::text
                END) AS volledig_zichtbaar
           FROM genummerd g
        )
 SELECT id,
    naam,
    thema,
    data_tier,
    source_type,
    status,
    status_ruw,
    volledig_zichtbaar,
        CASE
            WHEN volledig_zichtbaar THEN deadline_datum
            ELSE NULL::date
        END AS deadline_datum,
        CASE
            WHEN volledig_zichtbaar THEN dagen_resterend_echt
            WHEN deadline_datum IS NULL THEN NULL::integer
            WHEN dagen_resterend_echt < 7 THEN 0
            WHEN dagen_resterend_echt < 31 THEN 7
            WHEN dagen_resterend_echt < 91 THEN 31
            WHEN dagen_resterend_echt < 181 THEN 91
            ELSE 181
        END AS dagen_resterend,
        CASE
            WHEN volledig_zichtbaar THEN NULL::text
            WHEN deadline_datum IS NULL THEN 'Doorlopend of onbekend'::text
            WHEN dagen_resterend_echt < 7 THEN 'Binnen 1 week'::text
            WHEN dagen_resterend_echt < 31 THEN 'Binnen 1 maand'::text
            WHEN dagen_resterend_echt < 91 THEN 'Binnen 3 maanden'::text
            WHEN dagen_resterend_echt < 181 THEN 'Binnen 6 maanden'::text
            ELSE 'Later dan 6 maanden'::text
        END AS deadline_periode,
        CASE
            WHEN volledig_zichtbaar THEN bedrag_min
            ELSE NULL::numeric
        END AS bedrag_min,
        CASE
            WHEN volledig_zichtbaar THEN bedrag_max
            ELSE NULL::numeric
        END AS bedrag_max,
        CASE
            WHEN volledig_zichtbaar THEN voorwaarden
            ELSE NULL::text
        END AS voorwaarden,
        CASE
            WHEN volledig_zichtbaar THEN funder_naam
            ELSE NULL::text
        END AS funder_naam,
        CASE
            WHEN volledig_zichtbaar THEN funder_website
            ELSE NULL::text
        END AS funder_website,
    funder_type,
    werkgebied,
    themas_namen,
    doelgroepen_namen,
    werkgebieden_namen,
        CASE
            WHEN volledig_zichtbaar THEN bandbreedte_bijdrage_naam
            ELSE NULL::text
        END AS bandbreedte_bijdrage_naam,
        CASE
            WHEN volledig_zichtbaar THEN beoordelingsdatum
            ELSE NULL::date
        END AS beoordelingsdatum,
        CASE
            WHEN volledig_zichtbaar THEN beoordelingsperiode
            ELSE NULL::text
        END AS beoordelingsperiode,
    rondes_aantal
   FROM zichtbaarheid;

-- 2) kompas_subsidieregelingen_voor_tier: zelfde rondes_aantal-telling
-- rechtstreeks op subsidieregeling_rondes.
CREATE OR REPLACE FUNCTION public.kompas_subsidieregelingen_voor_tier(p_tier text)
 RETURNS TABLE(regeling_id uuid, naam text, status text, deadline_datum date, deadline_omschrijving text, bedrag_min numeric, bedrag_max numeric, bandbreedte_bijdrage_naam text, aanvraagcriteria text, beoordelingscriteria text, type_projecten text, begrotingseisen text, eigen_bijdrage text, cofinanciering text, behandeltermijn text, aanvraagprocedure text, aanvraaglink text, access_tier subsidie_access_tier, type_gever text, funder_naam text, funder_website text, funder_missie text, funder_aanvraagcriteria text, themas_namen text[], doelgroepen_namen text[], werkgebieden_namen text[], rondes_aantal bigint, sluitingstijd time without time zone, beoordelingsdatum date, beoordelingsperiode_ronde text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

-- 3) admin_list_rondes: gedeeld_met_namen vervalt.
DROP FUNCTION public.admin_list_rondes(uuid);

CREATE FUNCTION public.admin_list_rondes(p_regeling_id uuid)
 RETURNS TABLE(id uuid, subsidieregeling_id uuid, sluitingsdatum date, sluitingstijd time without time zone, open_vanaf date, beoordelingsdatum date, beoordelingsperiode text, toelichting text, bron_url text, actief boolean, type datamoment_type, naam text, status datamoment_status, is_verstreken boolean, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  return query
    select
      r.id, r.subsidieregeling_id, r.sluitingsdatum, r.sluitingstijd, r.open_vanaf,
      r.beoordelingsdatum, r.beoordelingsperiode, r.toelichting, r.bron_url, r.actief,
      r.type, r.naam, r.status,
      (r.sluitingsdatum + coalesce(r.sluitingstijd, '23:59:59'::time)) at time zone 'Europe/Amsterdam' < now() as is_verstreken,
      r.created_at, r.updated_at
    from public.subsidieregeling_rondes r
    where r.subsidieregeling_id = p_regeling_id
    order by r.sluitingsdatum, r.sluitingstijd nulls last, r.id;
end;
$function$;

-- 4) admin_list_funder_datamomenten: regeling_ids/regeling_namen vervallen;
-- toont uitsluitend funder-brede datamomenten.
DROP FUNCTION public.admin_list_funder_datamomenten(uuid);

CREATE FUNCTION public.admin_list_funder_datamomenten(p_funder_id uuid)
 RETURNS TABLE(id uuid, type datamoment_type, naam text, sluitingsdatum date, sluitingstijd time without time zone, status datamoment_status, toelichting text, bron_url text, actief boolean, is_verstreken boolean, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  return query
    select
      r.id, r.type, r.naam, r.sluitingsdatum, r.sluitingstijd, r.status, r.toelichting, r.bron_url, r.actief,
      (r.sluitingsdatum + coalesce(r.sluitingstijd, '23:59:59'::time)) at time zone 'Europe/Amsterdam' < now() as is_verstreken,
      r.created_at, r.updated_at
    from public.subsidieregeling_rondes r
    where r.funder_id = p_funder_id
      and r.subsidieregeling_id is null
    order by r.sluitingsdatum, r.sluitingstijd nulls last, r.id;
end;
$function$;

-- 5) admin_upsert_funder_datamoment: p_regeling_ids vervalt.
DROP FUNCTION public.admin_upsert_funder_datamoment(uuid, uuid, datamoment_type, text, date, time without time zone, datamoment_status, text, text, boolean, uuid[]);

CREATE FUNCTION public.admin_upsert_funder_datamoment(p_datamoment_id uuid, p_funder_id uuid, p_type datamoment_type, p_naam text, p_sluitingsdatum date, p_sluitingstijd time without time zone, p_status datamoment_status, p_toelichting text, p_bron_url text, p_actief boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_id uuid;
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  if p_funder_id is null or p_sluitingsdatum is null or p_type is null then
    raise exception 'Funder, datum en type zijn verplicht.' using errcode = '22004';
  end if;

  if not exists (select 1 from public.funders where id = p_funder_id) then
    raise exception 'Fonds niet gevonden.' using errcode = 'P0002';
  end if;

  if p_datamoment_id is null then
    insert into public.subsidieregeling_rondes (
      funder_id, subsidieregeling_id, type, naam, sluitingsdatum, sluitingstijd, status, toelichting, bron_url, actief
    ) values (
      p_funder_id, null, p_type, p_naam, p_sluitingsdatum, p_sluitingstijd, coalesce(p_status, 'gepland'), p_toelichting, p_bron_url, coalesce(p_actief, true)
    )
    returning id into v_id;
  else
    if not exists (select 1 from public.subsidieregeling_rondes where id = p_datamoment_id and funder_id = p_funder_id and subsidieregeling_id is null) then
      raise exception 'Datamoment niet gevonden.' using errcode = 'P0002';
    end if;

    update public.subsidieregeling_rondes
    set
      type = p_type,
      naam = p_naam,
      sluitingsdatum = p_sluitingsdatum,
      sluitingstijd = p_sluitingstijd,
      status = coalesce(p_status, status),
      toelichting = p_toelichting,
      bron_url = p_bron_url,
      actief = coalesce(p_actief, actief),
      updated_at = now()
    where id = p_datamoment_id
    returning id into v_id;
  end if;

  return v_id;
end;
$function$;

-- 6) Nu pas de koppeltabel zelf verwijderen - alle afhankelijkheden zijn
-- hierboven al verlegd naar de rechtstreekse subsidieregeling_id-kolom.
DROP TABLE public.subsidieregeling_ronde_koppelingen;
