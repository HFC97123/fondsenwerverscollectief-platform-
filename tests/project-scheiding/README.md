# Tests: scheiding organisatie / project / document-fondsaanvraag

Drie niveaus, strikt gescheiden:

1. ORGANISATIE: wie wij zijn (rechtsvorm, ANBI, vestigingsplaats, missie)
2. PROJECT: wat wij willen financieren (doelgroep, projectlocatie, aantallen, looptijd, begroting)
3. DOCUMENT / FONDSAANVRAAG: wensen voor één document of één fonds (versies, `document_context`)

## Frontend (nep-database met RLS en foreign keys, praat nooit met Supabase)

    npm i --no-save esbuild jsdom
    node tests/project-scheiding/run.mjs

Dekt o.a. de testscenario's A t/m F (chat in project B gebruikt niets van A; matching alleen
met het actieve project; zonder actief project geen projectcriteria; uitloggen A -> B ziet niets;
twee projecten van dezelfde gebruiker blijven gescheiden; Premium-geheugen promoveert geen
projectinformatie naar organisatiebreed), plus signaalregels voor automatisch aanmaken,
duplicaatcontrole, herkomst per veld (geen stille overschrijving), documentversies (nooit stil
vervangen) en referentiële integriteit bij archiveren/verwijderen.

## Server (de echte `Deno.serve`-handler onder Node, nagebootste database en OpenAI)

    node tests/project-scheiding-server/handler.test.mjs
    SERVER_BRON=/pad/naar/index.ts node tests/project-scheiding-server/handler.test.mjs

Zolang `supabase/functions/subsidie-kompas/index.ts` de project-scheiding (v87) nog niet bevat, slaat deze test zichzelf over
(exit 0). Geef met `SERVER_BRON` de v87-bron mee om hem toch te draaien.

Controleert dat organisatie en actief project uitsluitend server-side uit de database komen
(via geauthenticeerde user_id en `activeProgramId`), dat client-aangeleverde `project`/`orgProfile`
genegeerd worden, dat Free ongewijzigd blijft en dat het organisatievoorstel alleen blijvende
organisatiegegevens bevat.

Niet bewezen door deze tests: de kwaliteit van de echte modelextractie en een volledige flow met
een echt ingelogd account.
