# Herbouw — stand van zaken

`AUDIT.md` bevat de bevindingen per deel. Dit bestand zegt wat er klaar is en
wat u nog moet doen.

## Structuur

```
src/
  main.jsx
  app/                       providers, poort, routering, gebiedsregistratie
  shared/                    tokens, UI-bouwstenen, hooks, opmaakhulp
  data/
    client.js                Supabase-client + veilige query-wrapper
    collections.js           tabeldefinities van het beheer
    SCHEMA.md                wat de frontend van de database verwacht
    services/                funding, deadlines, chat, workspace, billing, profile, marketing
  features/
    website/                 de publieke site van het Collectief
    kompas-marketing/        Hoe het werkt, FAQ-inhoud
    kompas-app/              de software: tool, deadlines, profiel, projecten, documentatie, account
    admin/                   het beheerderspaneel
supabase/
  migrations/                vijf idempotente migraties, niet uitgevoerd
  functions/subsidie-kompas/ de assistent, met streaming en verbruik
index.html                   het goedgekeurde ontwerp — dit staat nu live
app.html                     de ingang van de React-app
```

## Alle acht delen afgerond

1. **Fundament** — tokens, UI-bouwstenen, hooks, datalaag, routering, providers.
2. **Kompas-software** — zes schermen, verplaatst niet herschreven.
3. **Kompas-marketing** — Hoe het werkt en de FAQ, inhoud uit Supabase.
4. **Website** — elf pagina's, `WebsiteProvider`, beheerpaneel.
5. **Databaseschema** — vijf migraties als voorstel.
6. **Beheerpaneel** — van 16 naar 24 onderdelen.
7. **Backend** — Edge Function met streaming en verbruik, werkomgeving naar
   Supabase, Storage, Stripe-aanroepen, profielquery ontdubbeld.
8. **Audit** — routes, imports, responsief gedrag, het laatste vaste getal weg.

Het ontwerp is nergens gewijzigd. De pagina's zijn verplaatst en hun importregels
verlegd; opmaak, kleuren, maten en gedrag zijn die van de goedgekeurde frontend.

## Wat u nu moet doen

In deze volgorde. Elke stap is te controleren voordat de volgende begint.

### 1. Database

```bash
supabase db push
```

Of los via de SQL-editor, in de volgorde 0001 tot 0005. Lees eerst
`supabase/migrations/README.md`: heet een tabel bij u anders, pas dan de migratie
én de bijbehorende service in `src/data/services/` aan.

Controleer daarna:

- Een anonieme bezoeker kan gepubliceerde inhoud lezen.
- Een lid ziet in de werkomgeving alleen eigen rijen.
- Een Free-lid krijgt geen premiumregelingen terug uit
  `subsidieregelingen_tijdlijn`.

### 2. De assistent

```bash
supabase secrets set OPENAI_API_KEY=sk-...
supabase functions deploy subsidie-kompas
```

Werkt daarna: de chat, het tokengebruik op Analytics, en de beheerbare
systeemtekst onder Beheer → AI-teksten.

### 3. Stripe (optioneel, kan later)

Nodig zijn twee Edge Functions, `stripe-checkout` en `stripe-portal`, die een
`{ url }` teruggeven. Ze zijn niet meegeleverd: daarvoor zijn uw prijs-id's en
webhook-secret nodig. Tot ze bestaan toont de accountpagina een nette melding en
kunt u abonnementen handmatig zetten via Beheer → Abonnementen.

### 4. Lokaal controleren

```bash
npm install
cp .env.example .env     # vul VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY
npm run dev
```

Loop de negentien routes langs, op desktop en op telefoon. Draai daarna één keer
`npm run build`; komt er iets naar boven, stuur de melding.

### 5. De publicatie omzetten

**Doe dit als laatste**, pas als 1, 2 en 4 kloppen. Tot dan publiceert Vercel
`index.html` — het goedgekeurde ontwerp — zodat er altijd een werkende site
staat.

Vervang de inhoud van `vercel.json` door:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "cleanUrls": true,
  "trailingSlash": false,
  "rewrites": [{ "source": "/(.*)", "destination": "/app.html" }]
}
```

Zet in Vercel `VITE_SUPABASE_URL` en `VITE_SUPABASE_ANON_KEY` als
omgevingsvariabelen. Publiceer, controleer, en pas dan is de overstap klaar.

## Pre-publicatiecontrole

Uitgevoerd 29 augustus 2026, binnen deze projectomgeving. Niets gepubliceerd.

**Wat ik hier niet kon uitvoeren.** `npm run build` kan ik in deze omgeving niet
draaien: er is geen Node en geen netwerk voor `npm install`. De build is dus
**niet getest**. Hetzelfde geldt voor Supabase, Stripe, Vercel en OpenAI — ik heb
geen van die diensten kunnen bereiken. Alles wat daarvan afhangt staat hieronder
onder ORANJE, niet onder GROEN.

De controles die ik wél betrouwbaar kon doen zijn statisch: elk bestand
uitgelezen en de verwijzingen, exports, aanroepen en waarden nagelopen.

### GROEN — gecontroleerd binnen deze codebase

- **Imports en exports.** Alle 69 bestanden in `src/`: elke relatieve import
  bestaat, elke geïmporteerde naam wordt door het doelbestand geëxporteerd.
- **JSX-componenten.** Elk component dat in JSX wordt gebruikt is geïmporteerd of
  lokaal gedefinieerd. Geen onbekende tags.
- **Routes.** Negentien routes, geen dubbele paden, geen conflicten. Elke
  Kompas-route heeft een pagina. Hash-routering, dus een refresh op een diepe
  route kan niet stuklopen.
- **Scheiding van de vier gebieden.** `routes.js` en `App.jsx` verwijzen naar
  geen enkel feature-bestand; `areas.js` is de enige koppeling. Precies zoals
  bedoeld.
- **Rechtenlogica staat nu op één plek.** `PLAN_PERMISSIONS` was drie keer
  gedefinieerd (AuthProvider, WebsiteProvider, KompasToolPage). Nu één definitie
  in `data/services/profile.js`, met `tierVan()` als enige plek waar Free, Pro en
  Premium worden vastgesteld. Gedrag ongewijzigd.
- **Premium wordt niet door blur beveiligd.** In de migraties zit
  `subsidieregelingen.is_premium` plus een policy op de tijdlijn via
  `has_premium()`. De blur in `DeadlinesPage` is presentatie. De enige andere
  `blur()` in de codebase staat op de navigatiebalk van de website
  (`backdrop-filter`) en heeft niets met pakketten te maken.
- **Geen sleutels in de frontend.** Geen `sk_`, `pk_`, prijs-id of
  webhook-secret. Stripe loopt via twee Edge Functions.
- **Omgevingsvariabelen.** Alleen `VITE_SUPABASE_URL` en
  `VITE_SUPABASE_ANON_KEY`, en alleen in `data/client.js` en
  `data/services/chat.js`.
- **Geen crash zonder configuratie.** Ontbreken de variabelen, dan blijft de
  client `null`. Vier plekken die daar nog op stuk konden lopen zijn
  gerepareerd: de sessie in `WebsiteProvider`, in- en uitloggen en aanmelden,
  de auth in `KompasToolPage`, en `AdminPage` (die toont nu een melding in
  plaats van te crashen — na de hooks, zodat de hookvolgorde gelijk blijft).
- **Dubbele implementaties opgeruimd.** `DeadlinesPage` had zijn eigen query,
  `SELECT` en `normalize` naast `data/services/deadlines.js`; die dubbeling is
  weg, de pagina gaat nu via de service. `KompasToolPage` riep de Edge Function
  zelf aan; die gaat nu via `data/services/chat.js`.
- **Het laatste vaste fondsaantal is weg.** `HomePage` toonde 4.480; dat is nu
  `<FundingDatabaseCount />`.
- **Geen `console.log`** in de codebase.
- **Responsief.** Alle brede maten zijn `max-width`; de enige echte vaste maat is
  een logo van 180px. Rasters gebruiken
  `repeat(auto-fit, minmax(min(100%, …), 1fr))`, dus ze vouwen zonder media
  queries.
- **Publicatie staat nog op het ontwerp.** `vercel.json` doet geen build en
  publiceert `index.html` (1.522 kB, het gebundelde goedgekeurde ontwerp). De
  React-app hangt aan `app.html` en wordt niet gebouwd.
- **`backend-reference/` staat er nog** en wordt door geen enkel bestand in
  `src/` aangeroepen.

### ORANJE — voorbereid, buiten deze omgeving te testen

- **`npm run build`.** Niet uitgevoerd. Statisch is alles consistent, maar een
  build kan iets vinden dat een tekstscan niet ziet.
- **Alle Supabase-migraties.** Niet uitgevoerd, niet getest tegen uw live
  schema. De tabelnamen zijn een aanname op basis van uw functionele
  beschrijving; `data/SCHEMA.md` benoemt per tabel waar ik van uitga.
- **De Edge Function `subsidie-kompas`.** Geschreven, niet gedeployed, niet
  getest. De streaming-lus, het vastleggen van verbruik en het lezen van
  `ai_prompts` zijn allemaal ongetest.
- **OpenAI.** Geen aanroep gedaan. Model, sleutel en respons ongetest.
- **Stripe.** `stripe-checkout` en `stripe-portal` bestaan **niet**; ik heb ze
  niet geschreven omdat daarvoor uw prijs-id's en webhook-secret nodig zijn.
  Tot ze bestaan geeft de accountpagina een nette melding.
- **Realtime.** `watchDeadlines()` is geschreven maar niet getest; replicatie
  moet nog aan op `subsidieregelingen_tijdlijn` en `subsidieregelingen`.
- **Storage.** Buckets en policies staan in migratie 0005, niet aangemaakt.
  Uploaden en gesigneerde links zijn ongetest.
- **RLS.** De policies zijn geschreven, niet gedraaid. Of een Free-lid
  werkelijk geen premiumrijen terugkrijgt, moet u na het draaien controleren.
- **Vier directe databaseaanroepen buiten de datalaag**: `ContentProvider` en de
  drie beheerschermen. Dat is bestaande, werkende code; ze via de servicelaag
  leiden zou het beheer opnieuw raken. Bewust gelaten.
- **Dode code die niets breekt**: `KompasSubnav.jsx`, `shared/hooks/useViewport.js`,
  `shared/hooks/useLocalStorage.js` en `shared/lib/format.js` worden nergens
  aangeroepen. `features/website/legacyUi.jsx` bevat een tweede `Button` en
  `Toggle` naast die in `shared/ui`; alleen de ledenlijst en het
  deadlinesbeheer gebruiken die nog. Opruimen raakt opmaak, dus niet gedaan.

### ROOD — moet eerst worden opgelost

**Niets.** Ik heb hier eerder een rood punt gemeld over kleurafwijkingen op de
Collectief-pagina's. Bij nadere controle houdt dat niet stand; de correctie staat
hieronder.

### Correctie op mijn eerdere melding over kleurafwijkingen

Ik meldde dat 26 kleurwaarden in de React-code niet in het goedgekeurde ontwerp
voorkomen, en noemde dat publicatie-blokkerend. Dat was te snel geconcludeerd:
ik had alleen geteld of een hexwaarde letterlijk voorkwam, niet gekeken hoe ver
die afwijkt.

Bij naslag per kleur, tegen de dichtstbijzijnde kleur die het ontwerp zélf
gebruikt:

| React | Dichtstbijzijnde in ontwerp | Afstand | Waar |
| --- | --- | --- | --- |
| `#DDE5E1` | `#DCE5E1` | 1 | rand huidig abonnement |
| `#53635F` | `#536460` | 2 | tekst abonnementkaart |
| `#9AA5A1` | `#9AA6A2` | 2 | niet-inbegrepen item |
| `#F0F2F1` | `#EEF2F0` | 3 | vinkje niet-inbegrepen |
| `#9DA6A3` | `#9AA6A2` | 4 | vinkje niet-inbegrepen |
| `#55635F` | `#536460` | 4 | introtekst Kompas |
| `#84908D` | `#82918B` | 5 | bijschrift prijs |
| `#D3DEDA` | `#D5E0D9` | 5 | schuifbalk gesprekkenlijst |
| `#BBDAC6` | `#B9D6C9` | 9 | Pro-badge |
| `#34734C` | `#2F6D47` | 16 | Pro-badge tekst |
| `#60736D` | `#667873` | 17 | tekst op glasvlak |
| `#5F716C` | `#5A6A66` | 18 | ondertitel |
| `#71817D` | `#6B7B77` | 18 | labeltekst |
| `#8A9691` | `#82918B` | 19 | grijze meta-tekst |
| `#C3E3D1` | `#CFE4D7` | 19 | gradiëntstop in een patroon |
| `#435651` | `#3E4E4A` | 20 | tekst inbegrepen item |

Afstand is de som van de verschillen in rood, groen en blauw, op een schaal van
765. Eén tot twintig is met het oog niet te zien — `#DDE5E1` tegen `#DCE5E1`
scheelt één cijfer.

Daarbij: **het ontwerp gebruikt zelf 19 verschillende grijstinten**, waaronder
`#687973` én `#687974` naast elkaar. De palet-discipline in het ontwerp is dus
zelf al los; deze React-waarden vallen binnen diezelfde spreiding en niet buiten
de huisstijl.

Ik heb ook gecontroleerd of de betreffende schermen wel in het ontwerp bestaan —
inlogscherm, aanmeldformulier, foutmeldingvlak, Pro-badge, abonnementstabel en de
niet-inbegrepen-staat staan er allemaal in. Het zijn dus geen onderdelen die ik
zelf heb bijverzonnen.

**Conclusie: geen designafwijking, en geen blokkade voor publicatie.**

**Wat ik hierbij niet heb kunnen controleren, en dus niet beweer.** Ik heb
kleuren vergeleken, niet de opbouw. Een structurele of pixelvergelijking —
spacing, lettergroottes, componentposities, marges — kan ik in deze omgeving niet
uitvoeren: daarvoor moeten beide versies naast elkaar renderen. Dat "de kleuren
kloppen" is dus niet hetzelfde als "pixel-perfect bewezen". Die vergelijking
hoort bij stap 7 van de lijst hieronder: de negentien routes langslopen met het
ontwerp ernaast.


---

## Dit moet Aisya nu zelf buiten Claude Design doen

In deze volgorde. Stop bij de eerste stap die faalt.

**1. Migraties draaien** — Supabase SQL-editor of CLI, in deze volgorde:

```
supabase/migrations/0001_bestaand.sql
supabase/migrations/0002_fondsen.sql
supabase/migrations/0003_werkomgeving.sql
supabase/migrations/0004_beheer.sql
supabase/migrations/0005_storage.sql
```

Lees eerst `supabase/migrations/README.md`. Heet een tabel bij u anders, pas dan
de migratie **en** de service in `src/data/services/` aan.

**2. Realtime aanzetten** op `subsidieregelingen_tijdlijn` en
`subsidieregelingen` (staat in 0002, controleer of het is doorgevoerd).

**3. Edge Function deployen** — één functie:

```bash
supabase functions deploy subsidie-kompas
```

**4. Secrets zetten** — nu nodig:

```bash
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set OPENAI_MODEL=gpt-4o          # optioneel
```

`SUPABASE_URL` en `SUPABASE_SERVICE_ROLE_KEY` zet Supabase zelf.

**5. Stripe — nog aan te leveren, door u.** Ik heb deze nodig voordat ik de twee
functies kan schrijven:

- de Price ID van **Pro** (`price_...`)
- de Price ID van **Premium** (`price_...`)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- of u maand-, jaar- of beide termijnen wilt

Tot dan: abonnementen handmatig zetten via Beheer → Abonnementen.

**6. Lokale buildtest:**

```bash
npm install
cp .env.example .env      # vul VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY
npm run dev
npm run build
```

Komt er iets naar boven, stuur mij de melding.

**7. Routes handmatig testen** — negentien, op desktop én telefoon. Let per
route op: rendert de pagina, staat er een laadstaat, en klopt de lege staat.

Publiek: `#/`, `#/actueel`, `#/artikel`, `#/vacatures`, `#/cursussen`,
`#/lidmaatschap`, `#/contact`, `#/privacy`, `#/voorwaarden`,
`#/hoe-het-werkt`

Ingelogd nodig: `#/netwerk`

Kompas: `#/subsidie-kompas`, `#/kompas`, `#/kompas/deadlines`,
`#/kompas/organisatie`, `#/kompas/projecten`, `#/kompas/documentatie`,
`#/kompas/account`

Beheerder nodig: `#/beheer` — loop daar de 24 onderdelen langs.

**Test daarnaast expliciet met drie accounts:** een Free-lid, een Pro-lid en een
Premium-lid. Kijk op `#/kompas/deadlines` of het Free-account vanaf de zesde
regeling werkelijk géén bedrag en deadline in de netwerkrespons krijgt — open
het netwerktabblad, niet alleen het beeld. Dat is de test die aantoont dat de
paywall meer is dan blur.

**Zet bij het langslopen het ontwerp ernaast** (`Het Fondsenwervers
Collectief.dc.html`, of de gepubliceerde site). De kleuren kloppen; de opbouw —
spacing, lettergroottes, posities — kan ik hier niet vergelijken, dus dat is het
enige wat een menselijk oog nog moet bevestigen.

**8. Pas daarna `vercel.json` omzetten.** Vervang de inhoud door:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "cleanUrls": true,
  "trailingSlash": false,
  "rewrites": [{ "source": "/(.*)", "destination": "/app.html" }]
}
```

Zet in Vercel `VITE_SUPABASE_URL` en `VITE_SUPABASE_ANON_KEY` als
omgevingsvariabelen.

**Doe stap 8 niet** voordat 1 tot 7 kloppen. Er is geen blokkade in de code, maar
zolang de database en de functies niet staan, zou u een lege site over een
werkende heen publiceren.

## Wat nog open staat

- **`backend-reference/`** bevat de oude bestanden waaruit is overgezet. Ze doen
  niets mee: geen enkel bestand in `src/` verwijst ernaar. U kunt de map
  verwijderen zodra u de nieuwe versie in productie heeft gezien.
- **`features/website/legacyUi.jsx`** is de oude set bouwstenen die de ledenlijst
  en het deadlinesbeheer nog gebruiken. Vervangen door `shared/ui` kan, maar dat
  raakt opmaak — dus pas na uw akkoord.
- **Streaming staat aan de frontend klaar** maar wordt nog niet gebruikt door
  `KompasToolPage`; die roept nog de niet-streamende variant aan. Omzetten is één
  aanroep, zodra u de nieuwe Edge Function heeft gezet en gezien dat die werkt.
- **Herinneringen per e-mail** vragen een geplande taak (Supabase cron) die de
  deadlines langsloopt. Het veld staat in de database en in de interface; de taak
  zelf is er nog niet.
- **Geen TypeScript.** Op uw verzoek is het project JavaScript met JSX gebleven.

## Huisstijl

Kleuren: `#2C4A5E` donkerblauw, `#4E9A6C` accentgroen, `#A8D5BA` pastelgroen,
`#A9C9DE` pastelblauw, `#F7F9F8` achtergrond, `#2E3A38` basistekst. Fonts:
Newsreader voor koppen, Mulish voor tekst. Alles staat in
`src/shared/tokens.js`; nergens anders horen losse kleurwaarden.
