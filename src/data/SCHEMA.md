# Databaseschema — wat de frontend verwacht

Dit is documentatie, geen migratie. Niets hierin is uitgevoerd. Het beschrijft
welke tabellen en relaties de services in `src/data/services/` gebruiken, zodat
u de backend later kunt aansluiten zonder de frontend aan te raken.

Wijkt uw schema af, pas dan alleen de betreffende service aan. Elke service is
één bestand met de query erin; nergens anders in de code staat SQL of een
tabelnaam.

## Uitgangspunt

`src/data/client.js` maakt de Supabase-client uit `VITE_SUPABASE_URL` en
`VITE_SUPABASE_ANON_KEY`. Ontbreken die, dan blijft de client `null` en geeft
elke service een lege uitkomst terug. De frontend rendert dan volledig, met
lege lijsten en een liggend ellipsteken waar een aantal hoort. Er is dus geen
enkele pagina die stukloopt op een ontbrekende database.

---

## In gebruik en werkend

Deze tabellen worden al door het bestaande beheer gebruikt en zijn niet gewijzigd.

| Tabel | Waarvoor |
| --- | --- |
| `profiles` | Gebruikersprofielen, lidmaatschapsstatus, beheerdersrol |
| `news` | Nieuwsberichten |
| `blog` | Blogartikelen |
| `videos` | Videobibliotheek |
| `resources` | Templates en downloads |
| `sessions` | Agenda en bijeenkomsten |
| `courses` | Basiscursus |
| `masterclasses` | Masterclasses |
| `vacancies` | Vacatures |
| `applications` | Aanmeldingen die goedkeuring vragen |
| `site_content` | Sleutel-waarde teksten van de publieke website |
| `settings` | Platforminstellingen |
| Storage bucket | Media-uploads |

---

## Nodig voor Deadlines en de fondsenteller

Gebruikt door `services/deadlines.js` en `services/funding.js`. Deze tabellen
staan niet in de repo; de namen hieronder zijn de aanname.

### `funders`

| Kolom | Type | Opmerking |
| --- | --- | --- |
| `id` | bigint | primaire sleutel |
| `naam` | text | naam van de verstrekker |
| `type` | text | Vermogensfonds, Gemeente, Provincie, Corporate Foundation, Rijksfonds |

Aanname: er is een kolom die aangeeft of een record openbaar mag zijn. De teller
probeert achtereenvolgens `is_active`, `active`, `published` en `status`. Bestaat
geen daarvan, dan telt alles wat de anon-rol mag zien.

### `subsidieregelingen`

| Kolom | Type | Opmerking |
| --- | --- | --- |
| `id` | bigint | primaire sleutel |
| `naam` | text | naam van de regeling |
| `funder_id` | bigint | verwijst naar `funders` |
| `bedrag_min` | numeric | mag leeg zijn |
| `bedrag_max` | numeric | mag leeg zijn |
| `omschrijving` | text | mag leeg zijn |
| `voorwaarden` | text | mag leeg zijn |
| `url` | text | website van de verstrekker, mag leeg zijn |

### `subsidieregelingen_tijdlijn`

De primaire bron van de Deadlines-pagina.

| Kolom | Type | Opmerking |
| --- | --- | --- |
| `id` | bigint | primaire sleutel |
| `regeling_id` | bigint | verwijst naar `subsidieregelingen` |
| `status` | text | Open, Binnenkort, Doorlopend, Aangekondigd, Budget uitgeput, Gesloten |
| `deadline_datum` | date | leeg bij een doorlopende regeling |
| `dagen_resterend` | integer | optioneel; is die leeg, dan rekent de frontend het uit de datum |

Geen gedupliceerde gegevens: naam, bedrag, omschrijving, voorwaarden en
verstrekker komen via de relatie, niet als kopie in deze tabel.

### `themas` en `regios`

| Kolom | Type |
| --- | --- |
| `id` | bigint |
| `naam` | text |

### Koppeltabellen

Alleen nodig als de thema- en regiorelatie nu uitsluitend op funder-niveau
bestaat (`funder_themas`, `funder_regios`). Heeft een regeling al een eigen
relatie, gebruik die dan en pas `SELECT` in `services/deadlines.js` aan.

- `subsidieregeling_themas` — `regeling_id`, `thema_id`
- `subsidieregeling_regios` — `regeling_id`, `regio_id`

### Indexen

Voor sorteren en filteren op deadline:

- `subsidieregelingen_tijdlijn (status)`
- `subsidieregelingen_tijdlijn (deadline_datum)`
- `subsidieregelingen_tijdlijn (status, deadline_datum)`
- `subsidieregelingen_tijdlijn (regeling_id)`

### Realtime

De pagina volgt wijzigingen live. Zet daarvoor replicatie aan op
`subsidieregelingen_tijdlijn` en `subsidieregelingen`.

### Toegang

Free en Pro zien de eerste vijf regelingen volledig. Vanaf de zesde blijven
naam, thema, regio en status leesbaar; bedrag en deadline zijn vervaagd. **Die
blur is presentatie, geen beveiliging.** Lever Free- en Premium-data
server-side gescheiden aan, bijvoorbeeld met een teaser-view voor iedereen en de
volledige tabel alleen voor profielen met een Premium-abonnement. Een voorstel
staat in `supabase/deadlines-handoff.sql`.

---

## Nog niet aangesloten: de werkomgeving

`state/KompasStore` bewaart deze gegevens nu in `localStorage`. Elke actie is een
losse functie, dus dit is één bestand om om te zetten. Voorstel voor de tabellen:

| Tabel | Inhoud | Sleutel |
| --- | --- | --- |
| `organisatieprofielen` | Naam, website, rechtsvorm, missie, werkgebied, thema's, doelgroepen, omzet, financieringsmix, toon | `profile_id` |
| `projecten` | Naam, programma, doelgroep, looptijd, regio, omschrijving, begroting, gevraagd bedrag, eigen bijdrage | `profile_id` |
| `project_aanvragen` | Eerdere fondsen: fonds, jaar, bedrag, uitkomst, toelichting | `project_id` |
| `project_cofinanciers` | Naam, bedrag, status | `project_id` |
| `project_regelingen` | Regelingen in het dekkingsplan: aan te vragen bedrag, status, herinnering | `project_id`, `regeling_id` |
| `project_documenten` | Naam, soort, grootte, opslagpad | `project_id` |
| `documentatie` | Gegenereerde bestanden: naam, soort, versie, grootte, projectkoppeling | `profile_id` |
| `documentatie_versies` | Versienummer, datum, grootte, opslagpad | `document_id` |
| `gesprekken` | Titel, tijdstip, berichten | `profile_id` |
| `ledenzichtbaarheid` | Of een lid in de ledenlijst staat | `profile_id` |
| `herinneringen` | Aantal dagen vooraf, e-mail aan of uit | `profile_id` |

Alles per `profile_id`, dus RLS is eenvoudig: een lid ziet en wijzigt alleen zijn
eigen rijen.

---

## Nog niet aangesloten: de ledenlijst

`features/website` gebruikt nu zes voorbeeldleden. Nodig is een view over
`profiles` die alleen leden teruggeeft die zichtbaar willen zijn, met naam, rol,
korte biografie en labels voor thema en regio. Contactgegevens horen daar niet
in; die deelt een lid zelf.

---

## Nog niet aangesloten: het beheer van Deadlines

`features/admin/AdminDeadlines` schrijft nu naar `localStorage`. De CSV-import
levert per rij: naam, verstrekker, type, regio, thema, status, deadline,
bedrag_min, bedrag_max. Bij aansluiten wordt dat een insert in
`subsidieregelingen` plus een insert in `subsidieregelingen_tijdlijn`, met een
lookup op `funders`, `themas` en `regios` om dubbele records te voorkomen.

---

## De assistent

`services/chat.js` roept de bestaande Edge Function `subsidie-kompas` aan met:

```
{
  messages: [{ role, content }],
  subscriptionTier: 'free' | 'pro' | 'premium',
  permissions: {
    canGenerateFiles, canUploadFiles, canUseKnowledgeBase,
    canUseFundDatabase, canUseOrganizationMemory
  },
  context: string | null
}
```

en verwacht `{ answer, sources }` terug.

`context` is nieuw: de achtergrondtekst uit organisatieprofiel, projecten en het
actieve document, opgebouwd door `buildContext()`. De functie mag dat veld
negeren zolang het daar niet is aangesloten — de aanroep blijft geldig en de
assistent blijft werken.

Voor de uiteindelijke opzet met OpenAI, internetzoeken en de premiumdatabase
verandert er aan de frontend niets: `askKompas()` blijft de enige ingang.
