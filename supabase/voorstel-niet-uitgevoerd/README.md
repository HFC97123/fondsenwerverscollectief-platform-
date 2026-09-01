# Voorstel, niet uitgevoerd

Deze vijf bestanden stonden oorspronkelijk in `supabase/migrations/`, maar
zijn **nooit** de bron van het huidige databaseschema geweest — de live
Supabase-database is via een andere weg opgebouwd (zie de echte,
toegepaste migraties in `supabase/migrations/`, te beginnen bij
`20260819104359_create_funders_schema.sql`). Ze zijn hierheen verplaatst op
2026-09-01 om te voorkomen dat `supabase/migrations/` de indruk wekt dat
alle bestanden daar de live database reproduceren.

Elke migratie hier is idempotent (`if not exists`), dus uitvoeren is in
principe veilig en overschrijft niets bestaands — maar controleer eerst of
de tabellen/kolommen die deze bestanden willen aanmaken niet al onder een
andere naam bestaan (zie hieronder), want dat is voor een deel al het geval.

| Bestand | Inhoud |
| --- | --- |
| `0001_bestaand.sql` | Documenteert de tabellen die het beheer al gebruikt. Verandert niets aan bestaande kolommen. |
| `0002_fondsen.sql` | funders, subsidieregelingen, tijdlijn, themas, regios, koppeltabellen, indexen, RLS, realtime |
| `0003_werkomgeving.sql` | organisatieprofiel, projecten, documentatie, gesprekken, herinneringen |
| `0004_beheer.sql` | FAQ, stappen, pagina-inhoud, SEO, feature flags, logboek, AI-verbruik |
| `0005_storage.sql` | buckets voor media, projectdocumenten en gegenereerde documenten |

## Voordat u draait

Bestaat een tabel al onder een andere naam, pas dan de naam in de migratie aan
én in de bijbehorende service in `src/data/services/`. Dat is één plek per
domein; verzin geen nieuwe namen in de frontend.

Controleer na het draaien of `select` als anonieme bezoeker werkt op de
publieke tabellen, en of een lid alleen zijn eigen rijen in de werkomgeving
ziet.
