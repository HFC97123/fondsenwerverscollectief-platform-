# Herbouw — definitieve oplevering

Het goedgekeurde ontwerp (`index.html`, leesbare bron
`Het Fondsenwervers Collectief.dc.html`) is de enige bron van waarheid voor de
frontend. Dit bestand zegt wat er staat, wat er getest is, en wat u zelf nog moet
doen.

## Classificatie

**GEVALIDEERD** — daadwerkelijk uitgevoerd en de uitkomst gecontroleerd.
**STATISCH GECONTROLEERD** — de code is gelezen en gemeten, niet uitgevoerd.
**NIET GETEST** — niet uitgevoerd en niet te controleren in deze omgeving.

Er staat niets onder GEVALIDEERD wat ik niet echt heb laten lopen.

---

## GEVALIDEERD

### Frontend gelijk aan het ontwerp

**Alle 38 bestanden in `src/features/` zijn exact gelijk** aan het ontwerp.
Gemeten per bestand: elke kleurwaarde, elke lettergrootte en elke border-radius
komt voor in `Het Fondsenwervers Collectief.dc.html`. Nul afwijkingen.

Verder in de hele codebase: **nul `!important`-declaraties en nul media
queries**, precies als het ontwerp. Responsief gedrag komt van `clamp()` en
`repeat(auto-fit, minmax(...))`, zoals het ontwerp het doet.

### Imports, exports en bereikbaarheid

61 bestanden in `src/`, **alle 61 bereikbaar** vanaf `src/main.jsx`. Elke
relatieve import verwijst naar een bestaand bestand; elke geïmporteerde naam
wordt door het doelbestand geëxporteerd; elk component dat in JSX wordt gebruikt
is geïmporteerd of lokaal gedefinieerd. Geen dood gewicht, geen losse
verwijzingen.

### Twintig routes

Elke route gesimuleerd tegen `matchRoute()`:

| Route | Gebied |
| --- | --- |
| `/` `/actueel` `/artikel` `/vacatures` `/cursussen` `/lidmaatschap` `/contact` `/privacy` `/voorwaarden` `/netwerk` | website |
| `/hoe-het-werkt` `/kompas/faq` | kompas-marketing |
| `/subsidie-kompas` `/kompas` `/kompas/deadlines` `/kompas/organisatie` `/kompas/projecten` `/kompas/documentatie` `/kompas/account` | kompas-app |
| `/beheer` | admin |

`/kompas/faq` (marketing) en `/kompas` (app) bijten elkaar niet: het langste
passende pad wint. `#/artikel/abc` valt op `/artikel` met het id als parameter.
Een onbekend pad valt terug op de homepage. Hash-routering, dus een refresh op
een diepe route kan niet stuklopen.

### Geen dubbele implementaties

`signInWithPassword` en `auth.signOut` stonden in twee providers. Ze staan nu
alleen in `data/services/profile.js`, als `inloggen()` en `uitloggen()`;
`AuthProvider` en `WebsiteProvider` roepen die aan en houden alleen hun eigen
toestand bij. Zelfde voor de profielquery (`haalProfiel()`, met cache) en het
vaststellen van het pakket (`tierVan()`).

`createClient` staat op één plek: `data/client.js`.

---

## STATISCH GECONTROLEERD

### Backendkoppelingen

Aanwezig en aangesloten in de code, niet uitgevoerd tegen een live Supabase:

| Onderdeel | Waar |
| --- | --- |
| Client | `data/client.js`, op `VITE_SUPABASE_URL` en `VITE_SUPABASE_ANON_KEY` |
| Authenticatie | `data/services/profile.js` + `AuthProvider` / `WebsiteProvider` |
| Premiumrechten | `tierVan()`; Pro en Premium alleen bij actief abonnement |
| Chat | `data/services/chat.js` → Edge Function `subsidie-kompas` |
| Deadlines | `data/services/deadlines.js`, joins + realtime |
| Fondsenteller | `data/services/funding.js`, `count: 'exact', head: true` |
| Werkomgeving | `data/services/workspace.js`, met localStorage als terugval |
| Storage | `uploadProjectDocument()`, `bestandsLink()`, pad `<profile_id>/…` |
| Abonnementen | `data/services/billing.js` → `stripe-checkout`, `stripe-portal` |
| Beheer | `data/collections.js` + `features/admin/` |
| RLS | `supabase/migrations/0001`–`0005`, met `is_admin()` en `has_premium()` |
| Edge Function | `supabase/functions/subsidie-kompas/index.ts`, streaming + verbruik |

De Edge Function leest het abonnement uit het profiel, niet uit de aanvraag. De
browser kan zijn eigen pakket dus niet ophogen.

### Wat niet werkt zonder uw stappen

- De migraties zijn **niet uitgevoerd**. Zonder die tabellen rendert alles, maar
  leeg.
- De Edge Function is **niet gedeployed**. De chat valt dan terug op een nette
  foutmelding.
- `stripe-checkout` en `stripe-portal` **bestaan nog niet**. Daarvoor zijn uw
  prijs-id's en webhook-secret nodig. Tot dan toont de accountpagina een melding
  en zet u abonnementen handmatig via Beheer.
- Beheer schrijft naar de tabellen uit `collections.js`; die moeten bestaan.

---

## NIET GETEST

**`npm install`, `npm run dev` en `npm run build`.** Er is geen Node in deze
omgeving. `package-lock.json` bestaat daarom niet — die ontstaat bij uw eerste
`npm install`. Ik heb hem niet verzonnen.

**De visuele controle in de browser.** Ik heb geen enkele pagina gerenderd
gezien. Dat kleuren, lettergroottes en radii exact overeenkomen is een meting op
de code, geen bewijs van de opbouw op het scherm: spacing, uitlijning en
componentposities kan ik niet vergelijken zonder beide versies naast elkaar te
renderen.

**Het responsieve gedrag.** Het breekpunt van 860px staat in `WebsiteProvider`
met een resize-listener, en Deadlines schakelt op 900px. Beide zijn uit het
ontwerp overgenomen, niet in een browser gecontroleerd.

**Elke live backendaanroep.** Supabase, de Edge Function, OpenAI, Stripe en
Storage zijn in deze omgeving niet bereikbaar.

---

## Wijzigingen in deze ronde

### Toegevoegd

| Bestand | Waarom |
| --- | --- |
| `features/kompas-marketing/KompasFaqPage.jsx` | Het ontwerp heeft een eigen FAQ-scherm en de subnavigatie linkte ernaar, maar er was geen route en geen component — die link liep dood |

### Herschreven uit het ontwerp

| Bestand | Van → naar |
| --- | --- |
| `kompas-app/KompasToolPage.jsx` | 2.398 → 599 regels |
| `website/NetwerkPage.jsx` | Collectief, volledig |
| `website/HomePage.jsx` en tien andere website-pagina's | volledig |
| `website/Header.jsx`, `Footer.jsx` | volledig |
| `app.html` | body-reset, link-kleuren, veertien `@keyframes` |

De Kompas-tool: alle elf afwijkende kleurwaarden, vier lettergroottes en vier
radii zijn weg, en de zeventien `!important`-declaraties en twee media queries
zijn verdwenen. De drie panelen (organisatie, projecten, documentatie) staan
weer op de pagina zelf, zoals in het ontwerp, in plaats van als aparte routes;
de bestaande componenten worden inline gerenderd met hun logica intact.

### Verwijderd

| Bestand | Waarom |
| --- | --- |
| `website/AbonnementenPage.jsx` | Komt in het ontwerp niet voor; abonnementen leiden daar naar Hoe het werkt |
| `website/Login.jsx`, `Register.jsx` | Inloggen en aanmelden zitten in `NetwerkPage`, uit het ontwerp |
| `website/Newsletter.jsx` | Nieuwsbrief zit in `Footer`, uit het ontwerp |
| `website/Ledenlijst.jsx` | Ledenlijst zit in `NetwerkPage`, uit het ontwerp |
| `backend-reference/` (45 bestanden) | Vervangers bestaan; nergens naar verwezen |
| 26 schermafbeeldingen, `schema.sql`, `deadlines-handoff.sql` | Verouderd |

### Samengevoegd

- `inloggen()` en `uitloggen()` naar `data/services/profile.js`; twee providers
  gebruiken nu één implementatie.
- De profielquery en `tierVan()` idem, met een cache zodat er één netwerkaanroep
  is in plaats van twee.
- De drie documentatiebestanden (`README.md`, `AUDIT.md`, `HERBOUW.md`) zijn
  teruggebracht tot `README.md` als korte ingang en dit bestand als volledige
  verantwoording.

**Totaal: 89 projectbestanden**, waarvan 61 in `src/`.

---

## Wat u nu moet doen

In deze volgorde. Elke stap is te controleren voordat de volgende begint.

### 1. Installeren en bouwen

```bash
npm install
cp .env.example .env      # vul VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY
npm run dev
npm run build
```

`package-lock.json` verschijnt bij de eerste stap; commit die mee. Komt er bij
de build iets naar boven, stuur de melding.

### 2. Visueel vergelijken

Zet `index.html` (dubbelklikken) naast `npm run dev` en loop de twintig routes
langs op desktop, tablet en telefoon. Let vooral op spacing en uitlijning: dat is
het deel dat ik niet heb kunnen meten. Stuur schermafbeeldingen van wat afwijkt.

### 3. Database

```bash
supabase db push
```

Lees eerst `supabase/migrations/README.md`. Heet een tabel bij u anders, pas dan
de migratie **én** de service in `src/data/services/` aan.

Controleer daarna: een anonieme bezoeker leest gepubliceerde inhoud; een lid ziet
alleen eigen rijen; **een Free-lid krijgt geen premiumregelingen terug uit
`subsidieregelingen_tijdlijn`** — open het netwerktabblad, niet alleen het beeld.
Dat laatste is de test die aantoont dat de paywall meer is dan blur.

### 4. De assistent

```bash
supabase secrets set OPENAI_API_KEY=sk-...
supabase functions deploy subsidie-kompas
```

Daarna werkt de chat, vult Analytics zich met tokengebruik, en is de systeemtekst
beheerbaar onder Beheer → AI-teksten.

### 5. Stripe (kan later)

Twee Edge Functions die `{ url }` teruggeven: `stripe-checkout` en
`stripe-portal`. Niet meegeleverd — daarvoor zijn uw prijs-id's en
webhook-secret nodig.

### 6. Publiceren

**Doe dit als laatste.** Tot dan publiceert Vercel `index.html`, het goedgekeurde
ontwerp, zodat er altijd een werkende site staat. Vervang `vercel.json` door:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "cleanUrls": true,
  "trailingSlash": false,
  "rewrites": [{ "source": "/(.*)", "destination": "/app.html" }]
}
```

Zet `VITE_SUPABASE_URL` en `VITE_SUPABASE_ANON_KEY` als omgevingsvariabelen in
Vercel.

**Upload in een nieuwe, lege repository.** GitHub voegt bij een upload samen: een
oude `index.html` of `package.json` blijft dan staan en Vercel publiceert de
verkeerde versie. Dat is bij eerdere pogingen misgegaan.

---

## Structuur

```
src/
  main.jsx                   entry (via app.html)
  app/                       providers, poort, routering, gebiedsregistratie
  shared/                    tokens, UI-bouwstenen, opmaakhulp
  data/                      client, collections, SCHEMA.md, services
  features/
    website/                 de publieke site van het Collectief
    kompas-marketing/        Hoe het werkt, veelgestelde vragen
    kompas-app/              tool, deadlines, profiel, projecten, documentatie, account
    admin/                   het beheerderspaneel
supabase/
  migrations/                vijf idempotente migraties, nog niet uitgevoerd
  functions/subsidie-kompas/ de assistent, met streaming en verbruik
index.html                   het goedgekeurde ontwerp — dit staat nu live
app.html                     de ingang van de React-app
```

Vier gebieden, strikt gescheiden. `app/areas.js` koppelt elk gebied aan één
ingang, zodat `App.jsx` niets van de binnenkant van een gebied hoeft te weten.

## Openstaand

- **Beheer schrijft naar Supabase** zodra de tabellen bestaan; de formulieren
  zijn aangesloten maar niet tegen een live database getest.
- **Streaming staat klaar** in `askKompasStream()` maar wordt nog niet gebruikt
  door de tool; die roept de niet-streamende variant aan. Omzetten is één
  aanroep, zodra de nieuwe Edge Function staat.
- **Herinneringen per e-mail** vragen een geplande taak (Supabase cron). Het veld
  staat in de database en in de interface; de taak zelf niet.
- **Geen TypeScript**, op uw verzoek. Het project is JavaScript met JSX.

## Huisstijl

Kleuren: `#2C4A5E` donkerblauw, `#4E9A6C` accentgroen, `#A8D5BA` pastelgroen,
`#A9C9DE` pastelblauw, `#F7F9F8` achtergrond, `#2E3A38` basistekst. Fonts:
Newsreader voor koppen, Mulish voor tekst.
