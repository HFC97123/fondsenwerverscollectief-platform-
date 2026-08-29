# Audit vóór en tijdens de herbouw


Opgesteld 28 augustus 2026, vóór enige wijziging. Doel: vaststellen wat er is,
wat weg kan, wat blijft en wat opnieuw moet — zodat de herbouw met een plan
begint in plaats van met refactoren.

---

## 0. Eerst dit: de kern van het probleem

Het project bevat **twee onafhankelijke implementaties van dezelfde website**:

| | Wat het is | Status |
| --- | --- | --- |
| `Het Fondsenwervers Collectief.dc.html` | 5.740 regels, één bestand. Alle pagina's van het Collectief, de Kompas-marketingpagina, de Kompas-software en het beheerderspaneel. | **Het goedgekeurde ontwerp. Bron van waarheid.** |
| `backend-reference/` | 45 React-bestanden. Deels een hertaling van bovenstaande, deels overgenomen uit de oude GitHub-repo. | Gedeeltelijk verouderd |
| `index.html` | Bovenstaand ontwerpbestand, gebundeld tot één zelfstandig bestand. | Wat nu gepubliceerd wordt |

De React-map is nooit volledig bijgetrokken naar het ontwerp. Daardoor gaf elke
publicatie uit die map een mengsel van oude en nieuwe pagina's. Dat is de reden
dat eerdere uploads niet overeenkwamen met wat was goedgekeurd.

**Consequentie voor de herbouw:** het ontwerpbestand is de referentie voor élke
pagina. Waar de React-code afwijkt, is de React-code fout — niet het ontwerp.

---

## 1. Legacy-code die is aangetroffen

### 1a. Overgenomen uit de oude repo, wijkt af van het goedgekeurde ontwerp

Deze bestanden zijn nooit meegegaan in het ontwerp van deze fase. Ze renderen,
maar ze tonen een oudere versie van de website.

| Bestand | Afwijking |
| --- | --- |
| `pages/HomePage.jsx` | Vast getal 4.480 in plaats van de live teller; oude statistiekblokken; oude Kompas-introductie |
| `pages/ActueelPage.jsx` | Nieuwsoverzicht in oude opzet |
| `pages/ArticlePage.jsx` | Artikelweergave in oude opzet |
| `pages/CursussenPage.jsx` | Cursusaanbod in oude opzet |
| `pages/FellowPage.jsx` | Lidmaatschapspagina in oude opzet |
| `pages/NetwerkPage.jsx` | Ledengedeelte; ledenlijst er losjes ingehangen |
| `pages/OrgPage.jsx` | Organisatiepagina van het Collectief; verwarrende naam naast het Kompas-organisatieprofiel |
| `pages/OrientPage.jsx` | Oriëntatiepagina, komt in het huidige ontwerp niet voor |
| `pages/VacaturesPage.jsx` | Vacatures in oude opzet |
| `pages/AbonnementenPage.jsx` | Prijzen in oude opzet; nieuwe tekst staat in het ontwerpbestand |
| `CollectiefApp.jsx` | Koppelt bovenstaande aan elkaar |
| `state/data.js` | Vaste inhoud die in het ontwerp uit de database of het beheer komt |
| `styles/global.css`, `styles/hovers.css` | Klassegebaseerde CSS naast inline stijlen; twee stijlsystemen door elkaar |

### 1b. Dubbelingen binnen de React-code

| Wat | Waar het dubbel staat |
| --- | --- |
| Chatvenster | `components/Chat.jsx` én opnieuw geschreven binnen `pages/SubsidieKompas.jsx` |
| "Hoe het werkt" | Inline sectie in `pages/SubsidieKompas.jsx` én `pages/HoeHetWerktPage.jsx` |
| Abonnementen | Inline sectie in `pages/SubsidieKompas.jsx` én `pages/AbonnementenPage.jsx` |
| FAQ | 2.000 regels `FAQ_SECTIONS` in `pages/SubsidieKompas.jsx`; hoort in de database, beheerbaar |
| Knoppen, inputs, badges | Los gestyled in elk bestand, plus `components/ui.jsx` dat later is toegevoegd |
| Kleuren en fonts | Als letterlijke waarden op honderden plekken; geen tokenlaag |

### 1c. Structureel

- `pages/SubsidieKompas.jsx` is 2.900 regels en bevat marketingpagina, software,
  chat, FAQ en abonnementen door elkaar. Precies de scheiding die de opdracht
  vraagt, bestaat hier niet.
- Routering zit op twee plekken: hash-routes in `App.jsx` en een
  `page`-toestand in `state/AppContext.jsx`.
- `state/KompasStore.jsx` bewaart in `localStorage` — bedoeld als tijdelijk.

---

## 2. Wat wordt verwijderd

Alles uit 1a en 1b, met één voorwaarde: **een bestand gaat pas weg als de
vervanger uit het ontwerpbestand is gebouwd en gecontroleerd.** Verwijderen en
opbouwen in dezelfde stap, per pagina.

Definitief weg, zonder vervanger:

- `pages/OrientPage.jsx` — komt in het huidige ontwerp niet voor
- `state/data.js` — inhoud hoort in Supabase, beheerbaar via het beheerpaneel
- `styles/global.css` en `styles/hovers.css` — één stijlsysteem, niet twee
- `components/Chat.jsx` — de chat van het ontwerp wordt één component

---

## 3. Backendfunctionaliteit die blijft

Dit is schoon en bruikbaar. Niet aanraken behalve waar de tabel wijzigt.

| Bestand | Wat het doet |
| --- | --- |
| `lib/supabase.js` | De client, op `VITE_SUPABASE_URL` en `VITE_SUPABASE_ANON_KEY`. Geen sleutels in code. |
| `state/AppContext.jsx` | Authenticatie, gebruikersprofielen, abonnementsrechten (`PLAN_PERMISSIONS`), routering |
| `lib/collections.js` | Tabeldefinities en velden voor het beheer: nieuws, blog, video's, templates, agenda, cursussen, masterclasses, vacatures |
| `pages/AdminPage.jsx` | Werkende CRUD op Supabase, media-upload naar een bucket, ledenbeheer, aanvragen goedkeuren, sleutel-waardeschermen voor site-teksten en instellingen |
| `components/AdminSidebar.jsx` | Navigatie van het beheer |
| `lib/useFundingCount.js` | De centrale teller. Eén `count: 'exact', head: true` per tabel, gecached en gedeeld. |
| `components/Login.jsx`, `Register.jsx` | Aangesloten op Supabase-auth |

Nog niet tegen het echte schema geverifieerd, dus met voorbehoud:

- `pages/DeadlinesPage.jsx` — de samengestelde query op
  `subsidieregelingen_tijdlijn` met joins en realtime. De tabellen staan niet in
  `supabase/schema.sql` van deze repo. `supabase/deadlines-handoff.sql`
  beschrijft wat de pagina verwacht.

Werkt nog niet tegen de database:

- `state/KompasStore.jsx` — organisatieprofiel, projecten, documentatie,
  gesprekken en deadlinesbeheer, nu in `localStorage`. Elke actie is een losse
  functie, dus dit is één bestand om om te zetten.

---

## 4. Wat opnieuw wordt opgebouwd

### 4a. Frontend, uit het ontwerpbestand

Per pagina overzetten, ontwerp als referentie:

**Collectief (publiek):** home, nieuws en artikelen, vacatures, community met
vraag en antwoord, ervaringen, bijeenkomsten, blog, cursussen, contact, privacy,
voorwaarden, ledengedeelte met ledenlijst en zichtbaarheidsschuif.

**Kompas-marketingpagina:** hero, wat het doet, de vijf stappen, het
Premium-blok, de drie abonnementen, FAQ.

**Kompas-software:** chat met plan-gates, organisatieprofiel met onboarding en
websiteanalyse, projecten met dekkingsplan en herinneringen, documentatie met
versies, deadlines met filters en detailweergave, account met verwijderopties.

### 4b. Architectuur

```
src/
  app/                    routering, providers
  shared/                 tokens, UI-primitieven, hooks, helpers
  data/                   Supabase-client, queries per domein, types
  features/
    website/              publieke Collectief-pagina's
    kompas-marketing/     de productpagina
    kompas-app/           de software achter de inlog
    admin/                het beheerderspaneel
```

Eén stijlsysteem: tokens voor kleur, typografie, ruimte, radius en schaduw, en
UI-primitieven daarbovenop. Geen letterlijke hexwaarden meer in pagina's.

### 4c. Beheerderspaneel

Wat er is: CRUD op nieuws, blog, video's, templates, agenda, cursussen,
masterclasses, vacatures, media, leden, aanvragen, site-teksten, instellingen.

Wat erbij moet volgens de opdracht: pagina's en navigatie, SEO, prijzen, FAQ's,
testimonials, de subsidie- en fondsendatabase, de premiumdatabase, deadlines,
categorieën, thema's, AI-prompts, AI-startsuggesties, kennisbank, organisaties,
abonnementen, rechten, rollen, proefperiodes, documenttemplates, geüploade en
gegenereerde documenten, analytics, logs, feature flags, configuratie.

Dat vraagt eerst een schema. Zonder de tabellen kan het beheer er niet op
schrijven.

---

## Deel 2 — Subsidie Kompas software ✓ (frontend en opslaglaag)

De zes schermen staan in de nieuwe structuur, ongewijzigd van ontwerp.

```
src/features/kompas-app/
  KompasApp.jsx                ingang: kiest de pagina bij de route
  KompasToolPage.jsx           de tool met chat, geschiedenis, plan-gates
  DeadlinesPage.jsx            filters, detail, realtime, Premium-teaser
  OrganisatieprofielPage.jsx   profiel, onboarding, websiteanalyse
  ProjectenPage.jsx            projecten, dekkingsplan, herinneringen
  DocumentatiePage.jsx         documenten, versies, projectkoppeling
  AccountPage.jsx              profiel, abonnement, verwijderopties
  KompasStore.jsx              staat van de werkomgeving
  KompasSubnav.jsx             subnavigatie
  useKompasApp.js              adapter naar AuthProvider en routering
```

**Pixel-perfect gehouden.** De pagina's zijn verplaatst, niet herschreven. Alleen
de importregels zijn verlegd en de bouwstenen uit `components/ui.jsx` zijn
vervangen door de gelijke uit `shared/ui`. Om dat zonder verschil te laten
verlopen, zijn vier maten in `shared/ui` teruggezet op de waarde uit het
ontwerp: knoptekst en meldingtekst op 14,5px, de introductie onder een
paneelkop op 26px ondermarge, en een sectiekop op 16px. Daarmee is
`components/ui.jsx` overbodig: één set bouwstenen in plaats van twee.

**De opslag loopt nu via één punt.** `KompasStore` schrijft niet meer zelf naar
`localStorage` maar via `data/services/workspace.js`. Dat bestand is straks het
enige dat verandert; geen enkele pagina merkt het verschil.

**De assistent.** `KompasToolPage` roept de bestaande Edge Function
`subsidie-kompas` aan, met de gesprekgeschiedenis in Supabase — die integratie
is niet aangeraakt. Dezelfde aanroep staat als service in
`data/services/chat.js`; in deel 7 gaat de pagina daarlangs.

**Wat hier niet kon.** Streaming antwoorden vragen een wijziging aan de Edge
Function zelf, niet aan de frontend: die moet met
`text/event-stream` gaan antwoorden. Zolang dat niet is aangepast, blijft het
antwoord in één keer komen. Hetzelfde geldt voor AI-verbruik op de accountpagina:
daarvoor moet de functie het tokengebruik per aanroep wegschrijven. Beide staan
in deel 7, met de frontend erop voorbereid.

**Nog niet verwijderd.** `backend-reference/` blijft ongemoeid tot deel 8. De
bestanden die nu zijn vervangen — `components/ui.jsx`, `lib/css.js`,
`lib/useFundingCount.js`, `components/FundingDatabaseCount.jsx`,
`state/KompasStore.jsx` en de zes Kompas-pagina's — gaan in de opruiming van
deel 8, wanneer ook de Collectief-pagina's en het beheer zijn overgezet.

**Gecontroleerd.** Alle 33 bestanden in `src/` gescand: elke relatieve import
bestaat en elke naam die wordt geïmporteerd, wordt door het doelbestand
geëxporteerd.

## Deel 3 — Kompas-marketing ✓

`src/features/kompas-marketing/`: `HoeHetWerktPage.jsx`, `faqContent.jsx`,
`useMarketingContent.js`, `MarketingPages.jsx`.

De 475 regels FAQ zijn uit `KompasToolPage` gehaald (2.903 → 2.430 regels) en
staan nu in `faqContent.jsx`. De pagina leest ze via `useFaqSections()`, die
eerst `kompas_faq` in Supabase probeert en anders de goedgekeurde tekst gebruikt.
Zelfde patroon voor de vijf stappen op Hoe het werkt via `kompas_stappen`.
Beheerbaar zonder code, en een lege tabel maakt de pagina niet leeg.

**Routepaden volgen het ontwerp.** De links in de goedgekeurde frontend wijzen
naar `#/hoe-het-werkt` en `#sk-faq`; ik heb de routetabel daarop aangepast in
plaats van de links te veranderen. `/subsidie-kompas` en `/kompas` wijzen beide
naar de Kompas-pagina, zoals in het ontwerp: tool, abonnementen en FAQ op één
pagina.

## Deel 4 — Website van het Collectief ✓

23 bestanden verplaatst naar `src/features/website/` en `src/features/admin/`:
elf pagina's, header, footer, chat, contactformulier, ledenlijst, login,
registratie, nieuwsbrief, en het beheerpaneel met zijn zijbalk en
deadlinesbeheer.

**Correctie op deze audit.** Sectie 1a noemde `OrientPage.jsx` als verouderd,
"komt in het huidige ontwerp niet voor". Dat was fout: het ontwerp heeft veertien
Collectief-schermen, waaronder "Fondsenwerver worden", "Voor fondsenwervers" en
"Voor organisaties". Alle elf pagina's zijn dus behouden. Ik had dat moeten
controleren tegen de `data-screen-label`-lijst in het ontwerpbestand voordat ik
het opschreef.

**De grote provider is behouden, niet herschreven.** `AppContext` (1.466 regels)
is verplaatst naar `features/website/WebsiteProvider.jsx` met alleen de
importregels verlegd en de naam `AppProvider` → `WebsiteProvider`. Daarin zit de
werkende logica voor de chat, het contactformulier, de aanmelding, het plaatsen
van vacatures, spraakinvoer en het laden van gepubliceerde inhoud. Die
herschrijven zou de frontend in gevaar brengen zonder iets op te lossen.

**Gevolg: er zijn nu twee auth-implementaties.** `app/providers/AuthProvider.jsx`
en de auth-code binnen `WebsiteProvider`. Beide werken tegen dezelfde Supabase,
dus er is geen conflict, maar het is dubbel. Samenvoegen is een taak voor deel 7,
wanneer de backend wordt aangesloten en de gebieden hun sessie via één bron
lezen. Ik voer dat nu niet uit omdat het de website-pagina's raakt die
pixel-perfect moeten blijven.

**Vaste getallen.** `HomePage` had 4.480 als vast getal. Dat is nog niet
vervangen door `<FundingDatabaseCount />` — dat gebeurt in deel 6, samen met de
overige beheerbare teksten van de homepage.

**Projectopzet.** `package.json`, `vite.config.js` en `.env.example` zijn terug.
De React-app bouwt vanaf `app.html`, niet vanaf `index.html`. Zo blijft de
gepubliceerde site het goedgekeurde bestand; `vercel.json` zegt expliciet dat er
geen build wordt uitgevoerd. Dat draait pas om in deel 8.

**Gecontroleerd.** Alle 65 bestanden in `src/`: elke relatieve import bestaat,
elke geïmporteerde naam wordt geëxporteerd, en elk component dat in JSX wordt
gebruikt is geïmporteerd of lokaal gedefinieerd.

## Deel 5 — Databaseschema ✓ (als voorstel, niet uitgevoerd)

`supabase/migrations/` met vijf bestanden en een README. Idempotent
(`if not exists`, en `drop policy` vóór `create policy`), dus opnieuw draaien is
veilig en niets overschrijft bestaande data.

| Bestand | Inhoud |
| --- | --- |
| `0001_bestaand.sql` | De twaalf tabellen die het beheer al gebruikt, plus `is_admin()` en RLS |
| `0002_fondsen.sql` | funders, subsidieregelingen, tijdlijn, themas, regios, koppeltabellen, indexen, `has_premium()`, realtime |
| `0003_werkomgeving.sql` | organisatieprofiel, projecten, dekkingsplan, documentatie, gesprekken, voorkeuren, `ledenlijst`-view |
| `0004_beheer.sql` | FAQ, stappen, pagina's en SEO, AI-prompts, startsuggesties, feature flags, logboek, AI-verbruik |
| `0005_storage.sql` | buckets `media` (openbaar), `project-documenten` en `documentatie` (privé, per lid) |

**Premium wordt in de database gescheiden, niet in de browser.**
`subsidieregelingen.is_premium` plus de policy op de tijdlijn zorgt dat een
Free-bezoeker premiumrijen niet ontvangt. De blur in de frontend is alleen de
zichtbare kant daarvan.

**`dagen_resterend` is een gegenereerde kolom** (`deadline_datum - current_date`),
dus die veroudert niet. De frontend rekent zelf als de kolom ontbreekt.

**Twee correcties op mijn eerste opzet.** `create policy if not exists` bestaat
niet in PostgreSQL — dat is nu `drop policy if exists` gevolgd door
`create policy`. En de instellingentabel heet `site_settings`, niet `settings`:
de bestaande code is de waarheid, niet mijn aanname.

**Niet uitgevoerd.** U draait dit zelf, na vergelijking met het live schema.
Heet een tabel bij u anders, pas dan de migratie én de service in
`src/data/services/` aan — één plek per domein.

## Deel 6 — Beheerpaneel ✓

Uitgebreid van 16 naar 24 onderdelen. De bestaande generieke CRUD is hergebruikt;
alleen twee schermen zijn nieuw geschreven.

Nieuw beheerbaar via de bestaande `collections`-machinerie:
veelgestelde vragen, stappen op Hoe het werkt, AI-startsuggesties, en pagina's
met hun SEO-titel, omschrijving, deelafbeelding en plaats in het menu.

Nieuw via sleutel-waarde: **AI-teksten** (`ai_prompts`, de systeemteksten van de
assistent) en **Onderdelen** (`feature_flags`, een onderdeel aan of uit zonder
code).

Twee nieuwe schermen: `AdminAbonnementen.jsx` — per lid Free, Pro of Premium
zetten en het abonnement aan- of uitzetten, met een teller per pakket; en
`AdminAnalytics.jsx` — leden, gesprekken, vragen en tokengebruik, plus de laatste
beheeracties uit `audit_log`.

`KeyValueSection` kreeg één toevoeging: `valueColumn`, omdat `ai_prompts` de
waarde in `prompt` bewaart en `feature_flags` in `aan`. Booleaanse vlaggen
worden als ja/nee getoond en teruggeschreven als boolean.

**Nog leeg tot deel 7.** Analytics toont nul zolang de Edge Function het
tokengebruik niet naar `ai_verbruik` wegschrijft, en het logboek blijft leeg tot
beheeracties naar `audit_log` worden geschreven. Beide schermen zeggen dat zelf,
in plaats van een leeg vlak te tonen.

**Gecontroleerd.** Alle 67 bestanden: imports, exports en JSX-componenten
kloppen.

## Deel 7 — Backend aangesloten ✓ (frontend klaar, twee dingen wachten op u)

**De Edge Function is herschreven en meegeleverd.**
`supabase/functions/subsidie-kompas/index.ts` antwoordt op twee manieren: in één
keer (zoals nu) en als `text/event-stream` voor een woord-voor-woord antwoord.
Verder:

- Legt per aanroep het tokengebruik vast in `ai_verbruik`, waarmee het scherm
  Analytics zich vult.
- Leest de systeemtekst uit `ai_prompts`, dus die is beheerbaar zonder code.
- **Bepaalt het abonnement uit het profiel, niet uit de aanvraag.** De browser
  kan zijn eigen pakket dus niet ophogen. Dat was in de oude opzet wel mogelijk.

Nodig om dit te laten werken: `supabase functions deploy subsidie-kompas` en
`OPENAI_API_KEY` als secret.

**Streaming in de frontend.** `askKompasStream()` in `data/services/chat.js`
leest de stream en roept `onDelta` per fragment aan. Antwoordt de functie niet
met een stream — bijvoorbeeld omdat de oude versie nog draait — dan valt hij
automatisch terug op `askKompas()`. De gebruiker krijgt dus altijd antwoord,
ongeacht welke versie er staat.

**De werkomgeving schrijft nu naar Supabase.** `data/services/workspace.js` is
uitgebreid met `haalWerkomgevingOp()`, `bewaarOrgProfiel()`,
`bewaarVoorkeuren()`, `bewaarGesprek()` en de verwijderfuncties, plus
`uploadProjectDocument()` en `bestandsLink()` voor Storage — met een pad
`<profile_id>/<bestand>`, precies waar de RLS-policy op staat.

`KompasStore` haalt bij een sessie de werkomgeving uit de database en schrijft
profiel en voorkeuren ontdubbeld terug (900 ms na de laatste toetsaanslag).
Lokale opslag blijft daarnaast bestaan als terugval: zonder verbinding of zonder
inlog werkt de werkomgeving gewoon door.

**Stripe.** `data/services/billing.js` roept twee Edge Functions aan:
`stripe-checkout` en `stripe-portal`. Geheime sleutels blijven server-side. De
accountpagina toont nu het pakket met een knop "Abonnement beheren" (Pro en
Premium) of "Bekijk de abonnementen" (Free). Bestaan de functies nog niet, dan
volgt een nette melding en gebeurt er niets — geen foutmelding in de console,
geen kapotte pagina. De functies zelf schrijf ik niet blind: daarvoor zijn uw
Stripe-prijs-id's en webhook-secret nodig.

**De dubbele auth is opgelost zonder de pagina's te raken.** In plaats van een
van beide providers te herschrijven, is de profielquery verhuisd naar
`data/services/profile.js`: één cache, één aanroep, één regel voor het
vaststellen van het pakket (`tierVan`). `AuthProvider` en `WebsiteProvider`
gebruiken die nu beide. Dat haalt de dubbele netwerkaanroep weg en zorgt dat
Free, Pro en Premium overal op dezelfde manier worden bepaald — zonder één regel
opmaak te veranderen.

Ook opgeruimd: een `console.log('PROFIEL GELADEN:', data)` die het hele profiel
in de console zette.

## Deel 8 — Audit ✓

**Routes.** Negentien routes, elk toegewezen aan een gebied; alle vier gebieden
zijn geregistreerd; elke Kompas-route heeft een pagina. Hash-routering, dus een
refresh op een diepe route kan niet stuklopen — er is geen serverherschrijving
nodig.

**Imports en verwijzingen.** Alle 69 bestanden gescand: elke relatieve import
bestaat, elke geïmporteerde naam wordt geëxporteerd, elk component in JSX is
geïmporteerd of lokaal gedefinieerd. Geen `console.log` meer in de codebase.

**Het laatste vaste getal is weg.** `HomePage` toonde 4.480; dat is nu
`<FundingDatabaseCount />`. Nergens in de codebase staat nog een vast
fondsaantal.

**Responsief.** Alle vaste breedtes zijn `max-width`; de enige echte vaste maat
is een logo van 180px. Rasters gebruiken
`repeat(auto-fit, minmax(min(100%, …), 1fr))`, dus ze vouwen zonder media
queries. Eén breekpunt op 900px voor de wisseling tussen filterkolom en
filterlade.

**Eén bewuste afwijking.** In het goedgekeurde ontwerp staat onder het
chatvenster een knop van 32px hoog, onder de 44px die ik normaal aanhoud. Die
laat ik staan: het ontwerp is vastgesteld, en dit is geen fout maar een keuze.

### Nog niet gedaan, en waarom

**De publicatie staat nog op het statische bestand.** `vercel.json` doet geen
build en publiceert `index.html`, het goedgekeurde ontwerp. Dat blijft zo tot u
de migraties heeft gedraaid en de Edge Functions heeft gezet. Omzetten is één
wijziging in `vercel.json`; die staat beschreven in `HERBOUW.md`.

De reden om dat niet nu te doen: de React-app leunt op tabellen die nog niet
bestaan. Zonder database rendert alles, maar leeg — en dan zou u een lege site
publiceren over een werkende heen. De volgorde is: migraties draaien, functies
zetten, controleren, dan omzetten.

**Wat ik niet kan controleren.** Ik kan `npm run build` hier niet draaien. De
statische controles zijn gedaan; de build zelf moet u één keer uitvoeren. Komt er
iets naar boven, stuur de melding en ik los het op.

## 5. Wat dit realistisch is

Eerlijk over de omvang: dit is geen opdracht van één ronde. Het is een herbouw
van ongeveer veertig schermen, een nieuwe architectuur, een databaseschema van
zo'n vijfentwintig entiteiten en een beheerpaneel daarbovenop. In één keer
opleveren zou betekenen dat ik pagina's snel en onnauwkeurig omzet — precies de
fout die dit project al eens heeft gemaakt.

Voorstel voor de volgorde, elk deel afgerond en controleerbaar voordat het
volgende begint:

1. **Fundament.** Mappenstructuur, tokens, UI-primitieven, routering,
   providers. Nog geen pagina's.
2. **Kompas-software.** Design locked, de meeste waarde, de nieuwste code.
   Chat, organisatieprofiel, projecten, documentatie, deadlines, account.
3. **Kompas-marketingpagina.** Klein, en maakt `SubsidieKompas.jsx` opsplitsbaar.
4. **Collectief, publiek.** Home, nieuws, artikelen, vacatures, community,
   cursussen, contact, juridisch, ledengedeelte.
5. **Databaseschema.** Alle tabellen, relaties, indexen en RLS-policies, als
   migraties. Eerst als voorstel ter controle, niet stilzwijgend uitvoeren.
6. **Beheerpaneel.** Bestaande CRUD behouden, de ontbrekende entiteiten erbij,
   rollen en rechten.
7. **Backend aansluiten.** `KompasStore` naar Supabase, deadlines tegen het
   echte schema, auth aanzetten.
8. **Publicatie.** Vercel, omgevingsvariabelen, build, audit per route en per
   responsieve toestand.

Tot deel 8 klaar is, blijft het huidige `index.html` de bron voor wat bezoekers
zien. Dat is bewust: er staat altijd een werkende, goedgekeurde website online
terwijl de herbouw loopt.

---

## 6. Wat ik van u nodig heb voordat deel 1 begint

1. **Het Supabase-schema**, of toegang tot het project. Zonder de echte
   kolommen en relaties blijven de deadlines-query en het beheer giswerk.
2. **Bevestiging van de volgorde** hierboven, of uw eigen prioriteit.
3. **Een besluit over TypeScript.** De opdracht noemt types; het project is nu
   JavaScript met JSX. Overstappen kan, maar het is een keuze die het beste nu
   valt, niet halverwege.
4. **Duidelijkheid over de chat.** Werkt die tegen een AI-dienst, en zo ja
   welke en via welke Edge Function? Dat bepaalt de opzet van de software.
