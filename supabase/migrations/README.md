# Migraties

Voorstel, niet uitgevoerd. Elke migratie is idempotent (`if not exists`), dus
opnieuw draaien is veilig, en niets overschrijft bestaande tabellen of data.

Uitvoeren, in deze volgorde:

```bash
supabase db push
```

Of los, via de SQL-editor in Supabase.

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
