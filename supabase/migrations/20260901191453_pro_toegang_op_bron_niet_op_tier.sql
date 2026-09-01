
-- Ronde 6: Free/Pro/Premium mogen niet langer op één hoop worden gegooid.
-- Tot nu toe kreeg Pro (current_user_has_pro_access()) volledige zichtbaarheid
-- op basis van uitsluitend data_tier = 'public'. Dat conflateert twee
-- losstaande dingen: de toegangstier van een regeling (data_tier) en de
-- bron waar hij vandaan komt (source_type). Pro hoort specifiek toegang te
-- hebben tot de online gescande subsidieregelingen/mentions (source_type =
-- 'internet_scan'), niet tot "alles wat toevallig public-tier is" in het
-- algemeen — en zeker niet tot data_tier = 'premium'-inhoud, ook niet als
-- die ooit via een ander source_type zou binnenkomen.
--
-- De Pro-voorwaarde is daarom aangescherpt tot BEIDE checks tegelijk:
-- data_tier = 'public' (toegangstier) EN source_type = 'internet_scan'
-- (bron). Op de huidige live data verandert dit niets aan de zichtbare
-- resultaten (alle 3 public-tier regelingen zijn nu al internet_scan, en
-- alle 120 premium-tier regelingen zijn premium_database) — het is een
-- correctheids-/toekomstbestendigheidsfix, geen gedragswijziging op de
-- huidige dataset.
--
-- Alle overige logica (eerste-vijf-per-categorie voor Free, tier-onafhankelijk;
-- Premium ziet via current_user_has_premium_access() nog steeds altijd alles;
-- sortering, filtering, kolommen) is ongewijzigd t.o.v. de vorige versie.

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
    (sr.status <> ALL (ARRAY['gesloten', 'doorlopend', 'aangekondigd', 'binnenkort']::regeling_status_type[]))
      AND sr.deadline_datum IS NOT NULL AND sr.deadline_datum >= CURRENT_DATE AS is_dated_upcoming,
    sr.status = 'doorlopend' AS is_doorlopend,
    sr.status = 'aangekondigd' AS is_aangekondigd,
    sr.status = 'binnenkort' AS is_binnenkort
  FROM subsidieregelingen sr
  JOIN funders f ON f.id = sr.funder_id
),
genummerd AS (
  SELECT
    b.*,
    row_number() OVER (PARTITION BY b.is_dated_upcoming ORDER BY b.deadline_datum, b.id) AS vn_dated,
    row_number() OVER (PARTITION BY b.is_doorlopend ORDER BY b.naam, b.id) AS vn_doorlopend,
    row_number() OVER (PARTITION BY b.is_aangekondigd ORDER BY b.deadline_datum, b.naam, b.id) AS vn_aangekondigd,
    row_number() OVER (PARTITION BY b.is_binnenkort ORDER BY b.deadline_datum, b.naam, b.id) AS vn_binnenkort
  FROM basis b
),
zichtbaarheid AS (
  SELECT
    g.*,
    (
      (g.is_doorlopend AND g.vn_doorlopend <= 5)
      OR (g.is_aangekondigd AND g.vn_aangekondigd <= 5)
      OR (g.is_binnenkort AND g.vn_binnenkort <= 5)
      OR (g.is_dated_upcoming AND g.vn_dated <= 5)
      OR (g.data_tier = 'public' AND g.source_type = 'internet_scan' AND current_user_has_pro_access())
      OR current_user_has_premium_access()
    ) AS volledig_zichtbaar
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
