# Migraties

Deze map bevat **uitsluitend migraties die daadwerkelijk op de live
Supabase-database zijn toegepast**, in dezelfde volgorde en met dezelfde
inhoud als geregistreerd in `supabase_migrations.schema_migrations` van het
project. Elk bestand heet `<version>_<naam>.sql`, waarbij `<version>` exact
de timestamp-versie is waarmee de migratie in de database bekend staat —
dat garandeert dat alfabetisch sorteren (`ls`, `supabase migration list`)
automatisch de juiste chronologische toepassingsvolgorde oplevert.

Bestanden 1-19 zijn op 2026-09-01 rechtstreeks uit
`supabase_migrations.schema_migrations` gehaald en woordelijk (byte-voor-byte)
overgenomen — niet uit het geheugen gereconstrueerd. Ze zijn dus een exacte,
gecontroleerde afspiegeling van de live database op dat moment. Bestand 20 is
geen historische reconstructie maar een nieuwe, idempotente correctie-migratie
(zie "Reproduceerbaarheid" hieronder) die een schemahiaat dicht dat bij die
controle aan het licht kwam.

| # | Bestand | Wat het doet |
| --- | --- | --- |
| 1 | `20260819104359_create_funders_schema.sql` | Basisschema: enums, tabellen `funders`/`subsidieregelingen`/koppeltabellen. |
| 2 | `20260819104416_funders_rls_and_access_views.sql` | RLS aan op de basistabellen; toegang uitsluitend via views. |
| 3 | `20260822091429_grant_authenticated_subsidie_kompas_tables.sql` | Herstelt ontbrekende GRANT-rechten voor `authenticated` op de subsidie_kompas_*-tabellen (RLS alleen is niet genoeg zonder GRANT). |
| 4 | `20260823092328_tighten_premium_access_trial_check.sql` | Verscherpt de proefperiode-check binnen de Premium-toegangsfunctie. |
| 5 | `20260831064231_add_deadline_classification_and_view.sql` | Voegt `data_tier`/`source_type`-classificatie toe en introduceert de eerste versie van de deadline-view. |
| 6 | `20260831090059_add_funders_classification_and_backfill.sql` | Zelfde classificatie als stap 5, nu voor `funders`, met backfill. |
| 7 | `20260831090510_add_classification_audit_log_and_admin_rpcs.sql` | Audit-log + admin-RPC's voor de classificatie van funders en subsidieregelingen. |
| 8 | `20260831095559_drop_subsidieregelingen_source_type_default.sql` | Verwijdert de tijdelijke default op `source_type` nu de enrich-job dit expliciet meestuurt. |
| 9 | `20260831114652_admin_console_fase2_rpcs.sql` | Fase 2 beheerconsole: nieuwe admin-only read/write RPC's, puur additief. |
| 10 | `20260831115224_fix_admin_list_subsidieregelingen_discovered_by_type.sql` | Correctie: `discovered_by` gebruikte het verkeerde enum-type in de eerste RPC-versie. |
| 11 | `20260831120000_admin_only_audit_log_read_access.sql` | Sluit een te brede SELECT-grant op het audit-log af; lezen voortaan alleen via admin-only RPC. |
| 12 | `20260831120357_admin_list_funders_add_prioriteit_filter.sql` | Voegt een optioneel prioriteit-filter toe aan de admin-funderslijst-RPC. |
| 13 | `20260831120412_drop_old_admin_list_funders_overload.sql` | Ruimt de oude functie-overload op na de parameter-uitbreiding van stap 12. |
| 14 | `20260831120856_admin_set_status_store_email_not_uuid.sql` | Correctie: `approved_by` moet het e-mailadres van de beheerder zijn, niet diens UUID. |
| 15 | `20260831205145_public_funding_totals_rpc.sql` | Veilige, geaggregeerde totaaltellers voor de publieke website/marketing. |
| 16 | `20260901070925_fix_deadline_tijdlijn_chronologische_sortering.sql` | Deadline-tijdlijn: chronologisch sorteren i.p.v. status-eerst; Doorlopend krijgt een eigen eerste-vijf-telling. |
| 17 | `20260901073353_deadline_tijdlijn_eigen_eerste_vijf_per_filtercategorie.sql` | Eigen, onafhankelijke eerste-vijf-telling voor Aangekondigd en Binnenkort. |
| 18 | `20260901171021_deadline_alle_eigen_pool_los_van_aangekondigd_binnenkort.sql` | Sluit Aangekondigd/Binnenkort uit van de "Alle"-telling, zodat die pool niet langer wordt gedeeld. |
| 19 | `20260901173135_deadline_free_eerste_vijf_tier_onafhankelijk.sql` | Maakt de eerste-vijf-regel tier-onafhankelijk: `data_tier` bepaalt niet meer of één van de eerste 5 kaarten per categorie zichtbaar is voor Free. |
| 20 | `20260901184701_backfill_missing_regeling_status_schema_elements.sql` | Correctie-migratie (nieuw, geen historische reconstructie): voegt het enum-type `regeling_status_type`, de kolommen `subsidieregelingen.status`/`.deadline_datum`/`.deadline_omschrijving`/`.status_laatst_gecheckt` (+ bijbehorende indexen) en `funders.prioriteit` idempotent toe — schema-elementen die live al bestonden maar door geen van migraties 1-19 werden aangemaakt. |

Migraties 1-15 zijn achteraf (2026-09-01) toegevoegd om de repository in lijn
te brengen met de live database; ze waren al vóór dit traject toegepast.
Migraties 16-19 zijn in dit traject zelf ontwikkeld en toegepast — zie
`claude/voorstel-deadline-tijdlijn-sortering.md` in het Claude-project voor
de volledige analyse per ronde. Migratie 20 is eveneens in dit traject
ontwikkeld, maar dicht een ouder, tot dan toe ongetrackt schemahiaat (zie
`claude/status-migraties-git-sync.md`).

## Verhouding tot `supabase/voorstel-niet-uitgevoerd/`

De map die vroeger hier stond (`0001_bestaand.sql` t/m `0005_storage.sql`)
is verplaatst naar `supabase/voorstel-niet-uitgevoerd/`. Die vijf bestanden
zijn **nooit** de bron van het huidige schema geweest — ze zijn een los,
nooit uitgevoerd voorstel dat toevallig in dezelfde map stond. Ze bleven in
deze map staan zou de illusie wekken dat een nieuwe omgeving die alle
bestanden hier afspeelt (`supabase db push` / `supabase migration up`) de
live database reproduceert; dat is alleen waar voor de 20 bestanden
hierboven. Zie de README in die map voor de status van het voorstel zelf.

## Reproduceerbaarheid

Een nieuwe, lege Supabase-/Postgres-omgeving die uitsluitend de 20 bestanden
in deze map in oplopende volgorde afspeelt, komt overeen met de live
database-structuur van dit project op 2026-09-01 (voor zover de migraties
zelf gaan — puur data-inhoud van tabellen valt hier vanzelfsprekend buiten,
dit zijn schemamigraties). Dit is gecontroleerd door elk bestand
byte-voor-byte te vergelijken met wat Supabase zelf in
`supabase_migrations.schema_migrations` heeft geregistreerd, en door te
verifiëren dat er geen dubbele versienummers of bestandsnamen zijn en dat de
alfabetische bestandsvolgorde exact overeenkomt met de chronologische
toepassingsvolgorde. Een volledige "koude" replay tegen een vers, leeg
Postgres-cluster is niet apart uitgevoerd in deze sessie (dat vereist ook
een Supabase-platformlaag — `auth`-schema, extensies, rollen — die niet via
deze migraties zelf wordt opgezet); wie dat wil verifiëren kan
`supabase db reset` gebruiken tegen een lokaal Supabase-project.

Bij het byte-voor-byte controleren van migraties 1-19 tegen het live schema
bleek dat het enum-type `regeling_status_type`, vier kolommen op
`subsidieregelingen` (`status`, `deadline_datum`, `deadline_omschrijving`,
`status_laatst_gecheckt`, + de indexen `idx_subsidieregelingen_status` en
`idx_subsidieregelingen_deadline_datum`) en de kolom `funders.prioriteit` wel
live bestonden, maar door geen van die 19 migraties werden aangemaakt — ze
zijn ooit buiten de migratietracking om toegevoegd, vóór migratie 5
(`add_deadline_classification_and_view`), die ze als eerste gebruikt.
Migratie 20 dicht dit hiaat idempotent (`IF NOT EXISTS`/conditionele
`ADD COLUMN`/`CREATE INDEX`), zonder de bijbehorende historische
tussenstappen te reconstrueren — die zijn onbekend en niet nodig voor het
eindresultaat. Op de live database was migratie 20 bij toepassing een
volledige no-op (alles bestond al exact zo); dit is na toepassing bevestigd
door het schema opnieuw te introspecteren (`information_schema.columns`,
`pg_indexes`, `pg_enum`) en te controleren dat er niets is veranderd.
Bewust niet teruggezet: `funders.external_relatienummer`
(aangemaakt in migratie 1) bestaat op de live database niet meer en komt
in migratie 20 dan ook nergens voor. (De koptekst-commentaar ín migratie 20
zelf noemt per abuis `subsidieregelingen.external_relatienummer` in plaats
van `funders.external_relatienummer` — een woordelijke vergissing in een
inerte SQL-comment, zonder functioneel effect: geen enkele instructie in het
bestand raakt `external_relatienummer` op welke tabel dan ook. Omdat het
bestand al live is toegepast en byte-voor-byte overeenkomt met wat Supabase
heeft geregistreerd, is dit bewust niet gecorrigeerd in het bestand zelf.)
