
-- Ronde 5: nieuwe functionele regel — voor Free geldt binnen elke
-- deadlinecategorie (Alle/Aangekondigd/Binnenkort/Doorlopend) een eigen,
-- puur positionele eerste-vijf (na filtering + sortering), ONGEACHT
-- data_tier. Een premium-tier regeling die op plek 1-5 van zijn categorie
-- staat, moet voor Free dus ook volledig zichtbaar zijn; plek 6 en verder
-- is altijd gelockt, ook als die toevallig public-tier is.
--
-- Wijziging t.o.v. ronde 4: de vier row_number()-partities (vn_dated,
-- vn_doorlopend, vn_aangekondigd, vn_binnenkort) waren gepartitioneerd op
-- (data_tier = 'public' AND is_X) — premium-tier regelingen kregen dus
-- nooit een positie in diezelfde telling en konden nooit via de
-- eerste-vijf-regel ontgrendeld worden. De partitie is nu simpelweg is_X
-- (zonder data_tier), zodat public- en premium-tier regelingen samen op
-- volgorde worden genummerd binnen hun categorie — exact zoals het
-- voorbeeld in de opdracht vraagt.
--
-- De zichtbaarheidsformule is samengevoegd tot één centrale uitdrukking
-- (geen aparte CASE meer per data_tier): eerste-vijf-in-categorie OF
-- (public-tier met Pro-toegang, ongewijzigd) OF Premium/Admin-toegang
-- (nu expliciet tier-onafhankelijk, dus Premium ziet ook altijd alles,
-- ook buiten de eerste vijf). Sortering, filtering, kolommen en de
-- Pro/Premium-toegangsfuncties zelf zijn ongewijzigd.

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
    -- Alleen precies de statussen die de frontend ook onder "Alle" toont.
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
    -- Geen data_tier meer in de partitie: public en premium tellen samen mee.
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
      OR (g.data_tier = 'public' AND current_user_has_pro_access())
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
