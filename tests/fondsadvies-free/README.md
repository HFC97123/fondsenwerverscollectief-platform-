# Tests: fondsmatching (één engine voor Free / Pro / Premium / Admin)

Draait de ECHTE `Deno.serve`-handler van `supabase/functions/subsidie-kompas/index.ts`
onder Node, met een nagebootste database (admin-client + RPC's) en nagebootste
OpenAI-aanroepen. De extractiestap (gpt-4o) is een deterministische stand-in
(`standInExtractor`): bewezen wordt wat er server-side naar het model gaat, niet de kwaliteit
van de echte extractie of van het hoofdmodel.

    node tests/fondsadvies-free/fondsadvies.test.mjs            # root-cause (basislijn 2e0447c via git), top 3, aantallen, tier-gelijkheid, intentie, fail-safe
    node tests/fondsadvies-free/regressie-free-matching.test.mjs # A-D, drempel, actualiteit, echte-data-fouten, verwante thema's, server-verkoopzin
    node tests/fondsadvies-free/eligibility-en-fit.test.mjs      # geografie (eligible/ineligible/unknown), brede termen, focus-aftrek, uitleg
    node tests/fondsadvies-free/rechten-en-modi.test.mjs         # rechtenlaag, geen Premium-uitlek in alle modi, document- vs chatmodus, één engine
    node tests/fondsadvies-free/entitlement.test.mjs             # Premium-exclusief A-I: publiek Premium-fonds vs expliciet exclusief fonds, identiteit, fail closed, observability

De basislijn (commit `2e0447c`, de versie vóór de matchingfix) wordt met `git show` ingeladen;
zonder git-historie wijst `BASISLIJN_BRON=<bestand>` naar een bronbestand (dan falen de vier
`ORIG:`-controles in `fondsadvies.test.mjs`, die juist de fout in de oorspronkelijke versie bewijzen).

## Architectuur die deze tests vastleggen (2026-10-08)

1. Intentie: `heeftFinancieringsIntentie` (fondsadvies-modus, fondsenscan, projectfinanciering,
   financieringsadvies/-strategie, dekkingsplan, projectplan met financiering) - voor elke tier gelijk.
2. `beoordeelPool` (zonder tierkennis): harde eligibility (geografie met status eligible/ineligible/unknown,
   aanvragertype, doelgroepbeperking, openstelling, bedrag, uitsluitingen) -> inhoudelijke fit
   (kern/direct, secundair, breed; breed of verwant telt alleen met een tweede inhoudelijk signaal;
   focus-aftrek alleen bij echte mismatch) -> rangschikken.
3. `pasRechtenToe` / `magZien`: pas daarna de tierrechten (Free top 3 eigen records, Pro free+pro, Premium/Admin alles).
4. Chat: pas na de inhoud de Pro/Free-verkoopzin (server-side). Documentmodi (projectplan, begroting,
   strategie, actieplan, aanvraagbeoordeling): geen verkoopzin, geen aantallen, geen verwijzing naar niet-getoonde fondsen.

## Entitlementmodel "Premium-exclusief" (2026-10-09, vervangt het tier-gebaseerde model van 2026-10-08)

Invariant: Premium is een abonnements-/datatier; `funders.premium_exclusive` is een AFZONDERLIJKE
visibilityclassificatie. Alleen expliciet exclusieve fondsen worden voor Free en Pro verborgen.

- Een fonds dat in de database op Premium staat maar publiek bekend is (Oranje Fonds) is voor Free/Pro NIET verborgen:
  het is vindbaar en noembaar, met alleen publieke gegevens (naam, type, website, aanvraaglink, plus wat online
  publiek gevonden is). Premium/admin krijgen daarnaast de database- en Premium-gegevens.
- Een expliciet exclusief fonds (`premium_exclusive = true`) is voor Free/Pro volledig verborgen via elke bron:
  database, regelingen, funderrecords, online zoeken, eerdere kandidaten. Premium/admin zien het onder de gewone regels.
- `bepaalNiveau()` is de ENIGE plek die beslist: `verborgen` | `publiek` | `volledig`. `onderdrukExclusief()` verwijdert
  exclusieve kandidaten vóór de engine uit de gezamenlijke pool (database + online); `applyEntitlementsAndSanitize()`
  is de definitieve controle bij presentatie. Beslissing op fonds-IDENTITEIT (funder_id, genormaliseerde naam, alias,
  regeling->funder, domein), nooit op de bron van het resultaat.
- De lijst komt uit RPC `kompas_exclusieve_funders()` (database = bron van canonieke identiteit, aliassen en vlag).
  Fail closed voor Free/Pro als de lijst niet te laden is (dan ook geen verkenner en geen databasekandidaten); een
  ontbrekende RPC (migratie nog niet toegepast) betekent "nog niets gemarkeerd".
- De resolver stempelt online kandidaten (`_exclusief`) maar geeft geen toegangsniveau meer door ("Premium in de
  database" betekent niet "verborgen"). Matchingkwaliteit is tier-onafhankelijk: Free/Pro verschillen alleen door de
  exclusieve fondsen en de Free-limiet (top 3).
- De eindaanroep in een fondsadviesbeurt heeft GEEN zoektool; antwoord, stream en bronnen gaan voor niet-Premium door
  een uitvoercontrole op alle namen/aliassen/regelingen/hosts van exclusieve fondsen.
- Prompts bevatten nergens aantallen verborgen fondsen; de verkoopzin is algemeen.
- Tests controleren drie niveaus: ruw kandidaatobject, gesaniteerd object, en ALLE modelinput + volledig HTTP-antwoord.
- Oude suites zetten `instellingen.premiumIsExclusief = true` in de harness: een `premium`-record in hun fixtures is dan
  een EXPLICIET exclusief fonds. `entitlement.test.mjs` laat dat uit en zet exclusiviteit alleen via de lijst.
- Interne tellingen (relevant/extraPro/extraPremium) zijn alleen zichtbaar via `kompas_matching_testlog` (`testLabel`).
