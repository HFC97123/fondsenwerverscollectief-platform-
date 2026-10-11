-- Zelfde als de vorige poging, maar werkgebied staat nu als laatste kolom in de finale SELECT
-- (CREATE OR REPLACE VIEW staat geen kolomvolgorde-wijziging van bestaande kolommen toe —
-- nieuwe kolommen mogen alleen aan het einde worden toegevoegd).
CREATE OR REPLACE VIEW public.subsidieregelingen_deadlines AS
 WITH basis AS (
         SELECT sr.id,
            sr.naam,
            sr.thema,
            sr.werkgebied,
            sr.data_tier,
            sr.source_type,
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
            sr.deadline_datum,
                CASE
                    WHEN sr.deadline_datum IS NOT NULL THEN sr.deadline_datum - CURRENT_DATE
                    ELSE NULL::integer
                END AS dagen_resterend_echt,
            sr.bedrag_min,
            sr.bedrag_max,
            sr.voorwaarden,
            f.naam AS funder_naam,
            f.website AS funder_website,
            f.type AS funder_type,
            (sr.status <> ALL (ARRAY['gesloten'::regeling_status_type, 'doorlopend'::regeling_status_type, 'aangekondigd'::regeling_status_type, 'binnenkort'::regeling_status_type])) AND sr.deadline_datum IS NOT NULL AND sr.deadline_datum >= CURRENT_DATE AS is_dated_upcoming,
            sr.status = 'doorlopend'::regeling_status_type AS is_doorlopend,
            sr.status = 'aangekondigd'::regeling_status_type AS is_aangekondigd,
            sr.status = 'binnenkort'::regeling_status_type AS is_binnenkort
           FROM subsidieregelingen sr
             JOIN funders f ON f.id = sr.funder_id
        ), genummerd AS (
         SELECT b.id,
            b.naam,
            b.thema,
            b.werkgebied,
            b.data_tier,
            b.source_type,
            b.status_ruw,
            b.status,
            b.deadline_datum,
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
            g.status_ruw,
            g.status,
            g.deadline_datum,
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
            g.vn_dated,
            g.vn_doorlopend,
            g.vn_aangekondigd,
            g.vn_binnenkort,
            g.is_doorlopend AND g.vn_doorlopend <= 5 OR g.is_aangekondigd AND g.vn_aangekondigd <= 5 OR g.is_binnenkort AND g.vn_binnenkort <= 5 OR g.is_dated_upcoming AND g.vn_dated <= 5 OR g.data_tier = 'public'::subsidie_data_tier AND g.source_type = 'internet_scan'::subsidie_source_type AND current_user_has_pro_access() OR current_user_has_premium_access() AS volledig_zichtbaar
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
    werkgebied
   FROM zichtbaarheid;
