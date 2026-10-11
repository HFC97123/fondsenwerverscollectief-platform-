
-- Funder-brede datamomenten (geen regelingkoppeling): automatisch in het
-- Deadline-overzicht/de Timeline, zelfde architectuur als
-- subsidieregelingen_deadlines (view leest rechtstreeks uit de database,
-- past dezelfde centrale subsidie_zichtbaar_voor_tier()-regel toe op de
-- eigen access_tier/data_tier/source_type/classification_reviewed van de
-- Funder - geen tweede rechtenmodel). De funder-naam is hier de "titel" van
-- de kaart (er is geen aparte regelingnaam) en blijft daarom, net als naam
-- bij subsidieregelingen_deadlines, altijd zichtbaar; overige details
-- (toelichting, website, missie, bijdrage, exacte datum) volgen dezelfde
-- blur/upsell-maskering als bij regeling-specifieke deadlines.
CREATE VIEW public.funder_deadlines AS
WITH basis AS (
  SELECT
    f.id AS funder_id,
    f.naam AS funder_naam,
    f.type AS funder_type,
    f.website AS funder_website,
    f.missie,
    f.aanvraagcriteria,
    f.bijdrage_min,
    f.bijdrage_max,
    bb.naam AS bandbreedte_bijdrage_naam,
    f.data_tier,
    f.source_type,
    f.classification_reviewed,
    f.access_tier,
    vd.datamoment_id,
    vd.type AS datamoment_type,
    vd.naam AS datamoment_naam,
    vd.sluitingsdatum AS deadline_datum,
    vd.sluitingstijd,
    vd.toelichting,
    vd.bron_url,
    (vd.sluitingsdatum - CURRENT_DATE) AS dagen_resterend_echt,
    ( SELECT array_agg(t.naam ORDER BY t.naam) FROM funder_themas ft JOIN themas t ON t.id = ft.thema_id WHERE ft.funder_id = f.id) AS themas_namen,
    ( SELECT array_agg(d.naam ORDER BY d.naam) FROM funder_doelgroepen fd JOIN doelgroepen d ON d.id = fd.doelgroep_id WHERE fd.funder_id = f.id) AS doelgroepen_namen,
    ( SELECT array_agg(r.naam ORDER BY r.naam) FROM funder_regios fr JOIN regios r ON r.id = fr.regio_id WHERE fr.funder_id = f.id) AS werkgebieden_namen
  FROM funders f
  CROSS JOIN LATERAL funder_volgende_datamoment(f.id, NULL, now()) vd(datamoment_id, type, naam, sluitingsdatum, sluitingstijd, sluitingsmoment, status, toelichting, bron_url)
  LEFT JOIN bandbreedtes_bijdrage bb ON bb.id = f.bandbreedte_bijdrage_id
  WHERE vd.datamoment_id IS NOT NULL
), zichtbaarheid AS (
  SELECT b.*,
    subsidie_zichtbaar_voor_tier(b.classification_reviewed, b.access_tier, b.data_tier, b.source_type,
      CASE
        WHEN current_user_has_premium_access() THEN 'premium'::text
        WHEN current_user_has_pro_access() THEN 'pro'::text
        ELSE 'free'::text
      END) AS volledig_zichtbaar
  FROM basis b
)
SELECT
  datamoment_id AS id,
  funder_id,
  funder_naam,
  funder_type,
  datamoment_type,
  datamoment_naam,
  data_tier,
  source_type,
  volledig_zichtbaar,
  CASE WHEN volledig_zichtbaar THEN deadline_datum ELSE NULL::date END AS deadline_datum,
  CASE
    WHEN volledig_zichtbaar THEN dagen_resterend_echt
    WHEN dagen_resterend_echt < 7 THEN 0
    WHEN dagen_resterend_echt < 31 THEN 7
    WHEN dagen_resterend_echt < 91 THEN 31
    WHEN dagen_resterend_echt < 181 THEN 91
    ELSE 181
  END AS dagen_resterend,
  CASE
    WHEN volledig_zichtbaar THEN NULL::text
    WHEN dagen_resterend_echt < 7 THEN 'Binnen 1 week'::text
    WHEN dagen_resterend_echt < 31 THEN 'Binnen 1 maand'::text
    WHEN dagen_resterend_echt < 91 THEN 'Binnen 3 maanden'::text
    WHEN dagen_resterend_echt < 181 THEN 'Binnen 6 maanden'::text
    ELSE 'Later dan 6 maanden'::text
  END AS deadline_periode,
  CASE WHEN volledig_zichtbaar THEN sluitingstijd ELSE NULL::time END AS sluitingstijd,
  CASE WHEN volledig_zichtbaar THEN toelichting ELSE NULL::text END AS toelichting,
  CASE WHEN volledig_zichtbaar THEN bron_url ELSE NULL::text END AS bron_url,
  CASE WHEN volledig_zichtbaar THEN funder_website ELSE NULL::text END AS funder_website,
  CASE WHEN volledig_zichtbaar THEN missie ELSE NULL::text END AS missie,
  CASE WHEN volledig_zichtbaar THEN aanvraagcriteria ELSE NULL::text END AS aanvraagcriteria,
  CASE WHEN volledig_zichtbaar THEN bijdrage_min ELSE NULL::numeric END AS bijdrage_min,
  CASE WHEN volledig_zichtbaar THEN bijdrage_max ELSE NULL::numeric END AS bijdrage_max,
  CASE WHEN volledig_zichtbaar THEN bandbreedte_bijdrage_naam ELSE NULL::text END AS bandbreedte_bijdrage_naam,
  themas_namen,
  doelgroepen_namen,
  werkgebieden_namen
FROM zichtbaarheid;

GRANT SELECT ON public.funder_deadlines TO anon, authenticated;
