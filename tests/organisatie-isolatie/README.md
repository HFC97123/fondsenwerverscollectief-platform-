# Isolatietest organisatiegegevens

Bewijst dat organisatiegegevens (o.a. "Het Nederlandse Rode Kruis") nooit van het ene account naar het andere lekken.

Scenario's: nieuw account in een browser waar al een ander account actief was (gedeelde, verouderde browseropslag);
account A vult een organisatie in -> uitloggen -> account B ziet niets en vult een andere organisatie in ->
opnieuw inloggen als A (alleen eigen data) -> derde account C leeg; geen organisatiegegevens in browseropslag.

    npm i --no-save esbuild jsdom
    node tests/organisatie-isolatie/run.mjs

Voor de fix (git stash) falen 9 van de 15 controles; erna slagen alle 15.
