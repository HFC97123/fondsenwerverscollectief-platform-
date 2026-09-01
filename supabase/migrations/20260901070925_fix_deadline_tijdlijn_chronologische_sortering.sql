-- Herstelt de deadline-tijdlijn: chronologisch sorteren (deadline_datum ASC)
-- in plaats van status-eerst, en een aparte, onafhankelijke "eerste 5"-telling
-- voor doorlopende regelingen zodat Free niet via het Doorlopend-filter de
-- volledige publieke dataset kan omzeilen. Geen wijziging aan tabellen, RLS,
-- of de Pro/Premium-toegangsfuncties.
CREATE OR REPLACE VIEW public.subsidieregelingen_deadlines AS
WITH basis AS (
  SELECT
    sr.id,
    sr.naam,
    sr.thema,
    sr.data_tier,
    sr.source_type,
    sr.status::text AS status_ruw,
    CASE sr.status
      WHEN 'open' THEN 'Open'
      WHEN 'binnenkort' THEN 'Binnenkort'
      WHEN 'doorlopend' THEN 'Doorlopend'
      WHEN 'aangekondigd' THEN 'Aangekondigd'
      WHEN 'budget_uitgeput' THEN 'Budget uitgeput'
      WHEN 'gesloten' THEN 'Gesloten'
      ELSE NULL
    END AS status,
    sr.deadline_datum,
    CASE WHEN sr.deadline_datum IS NOT NULL THEN sr.deadline_datum - CURRENT_DATE ELSE NULL END AS dagen_resterend_echt,
    sr.bedrag_min,
    sr.bedrag_max,
    sr.voorwaarden,
    f.naam AS funder_naam,
    f.website AS funder_website,
    f.type AS funder_type,
    -- Hoofd-tijdlijn: concrete, toekomstige deadline; niet gesloten, niet
    -- doorlopend. Status bepaalt niet langer de volgorde of de telling.
    (sr.status NOT IN ('gesloten', 'doorlopend')
      AND sr.deadline_datum IS NOT NULL
      AND sr.deadline_datum >= CURRENT_DATE) AS is_dated_upcoming,
    (sr.status = 'doorlopend') AS is_doorlopend
  FROM subsidieregelingen sr
  JOIN funders f ON f.id = sr.funder_id
),
genummerd AS (
  SELECT
    b.id, b.naam, b.thema, b.data_tier, b.source_type, b.status_ruw, b.status,
    b.deadline_datum, b.dagen_resterend_echt, b.bedrag_min, b.bedrag_max,
    b.voorwaarden, b.funder_naam, b.funder_website, b.funder_type,
    b.is_dated_upcoming, b.is_doorlopend,
    -- Onafhankelijke telling #1: eerstvolgende concrete deadlines, puur op datum.
    row_number() OVER (
      PARTITION BY (b.data_tier = 'public' AND b.is_dated_upcoming)
      ORDER BY b.deadline_datum ASC, b.id
    ) AS volgnummer_publiek_dated,
    -- Onafhankelijke telling #2: doorlopende regelingen, los van telling #1.
    row_number() OVER (
      PARTITION BY (b.data_tier = 'public' AND b.is_doorlopend)
      ORDER BY b.naam ASC, b.id
    ) AS volgnummer_publiek_doorlopend
  FROM basis b
),
zichtbaarheid AS (
  SELECT
    g.id, g.naam, g.thema, g.data_tier, g.source_type, g.status_ruw, g.status,
    g.deadline_datum, g.dagen_resterend_echt, g.bedrag_min, g.bedrag_max,
    g.voorwaarden, g.funder_naam, g.funder_website, g.funder_type,
    CASE
      WHEN g.data_tier = 'public' AND g.is_doorlopend
        THEN (g.volgnummer_publiek_doorlopend <= 5) OR current_user_has_pro_access()
      WHEN g.data_tier = 'public'
        THEN (g.is_dated_upcoming AND g.volgnummer_publiek_dated <= 5) OR current_user_has_pro_access()
      ELSE current_user_has_premium_access()
    END AS volledig_zichtbaar
  FROM genummerd g
)
SELECT
  id,
  naam,
  thema,
  data_tier,
  source_type,
  status,
  status_ruw,
  volledig_zichtbaar,
  CASE WHEN volledig_zichtbaar THEN deadline_datum ELSE NULL END AS deadline_datum,
  CASE
    WHEN volledig_zichtbaar THEN dagen_resterend_echt
    WHEN deadline_datum IS NULL THEN NULL
    WHEN dagen_resterend_echt < 7 THEN 0
    WHEN dagen_resterend_echt < 31 THEN 7
    WHEN dagen_resterend_echt < 91 THEN 31
    WHEN dagen_resterend_echt < 181 THEN 91
    ELSE 181
  END AS dagen_resterend,
  CASE
    WHEN volledig_zichtbaar THEN NULL
    WHEN deadline_datum IS NULL THEN 'Doorlopend of onbekend'
    WHEN dagen_resterend_echt < 7 THEN 'Binnen 1 week'
    WHEN dagen_resterend_echt < 31 THEN 'Binnen 1 maand'
    WHEN dagen_resterend_echt < 91 THEN 'Binnen 3 maanden'
    WHEN dagen_resterend_echt < 181 THEN 'Binnen 6 maanden'
    ELSE 'Later dan 6 maanden'
  END AS deadline_periode,
  CASE WHEN volledig_zichtbaar THEN bedrag_min ELSE NULL END AS bedrag_min,
  CASE WHEN volledig_zichtbaar THEN bedrag_max ELSE NULL END AS bedrag_max,
  CASE WHEN volledig_zichtbaar THEN voorwaarden ELSE NULL END AS voorwaarden,
  CASE WHEN volledig_zichtbaar THEN funder_naam ELSE NULL END AS funder_naam,
  CASE WHEN volledig_zichtbaar THEN funder_website ELSE NULL END AS funder_website,
  funder_type
FROM zichtbaarheid;
