# Projectdocumentatie (in de code: Projectinformatie)

De uitgebreide, inhoudelijke kennislaag bij één project. Beheerd op de pagina Documenten; **Projecten blijft compact**
(naam, doelgroep, discipline, werkgebied, looptijd, omschrijving, begroting) en is de bron voor fondsenmatching en dekkingsplan.

Definitie en logica: `projectinformatie.js` (pure functies, geen database). De UI en later de Edge Function gebruiken dezelfde definitie.

## Structuur (vast, hernoem keys nooit)

22 velden in vijf groepen. Elk veld heeft een vaste `key`:

| Groep | Keys |
| --- | --- |
| aanleiding | `aanleiding`, `noodzaak`, `doelgroep_uitgebreid`, `bereik`, `toegang_doelgroep` |
| aanpak | `doelstelling`, `subdoelstellingen`, `activiteiten`, `werkwijze`, `samenwerking` |
| resultaat | `output`, `outcome`, `impact`, `resultaten`, `monitoring_evaluatie` |
| uitvoering | `planning`, `organisatie_uitvoerbaarheid`, `risicos`, `borging`, `toegevoegde_waarde` |
| financiering | `financieringsbehoefte`, `begrotingstoelichting` |

Daarnaast zijn `programma` (kolom `program_label`) en `schrijfvoorkeur` (kolom `writing_preferences`) projectbrede instellingen.

## Opslag

- **Kolomvelden** (staan al in de database, fase 1): `doelstelling` -> `goals`, `activiteiten` -> `activities`,
  `samenwerking` -> `partners`, `impact` -> `impact_description`, `resultaten` -> `results`, `planning` -> `planning`.
  Deze kolommen blijven de enige bron; ze worden nooit gekopieerd of verplaatst.
- **JSON-velden** (de overige 16, fase 2): kolom `project_info` (jsonb) op `subsidie_kompas_programs`:

  ```json
  { "versie": 1, "velden": { "aanleiding": "…", "bereik": "Nog niet bekend" } }
  ```

  Alleen keys uit de tabel hierboven; waarden zijn tekst; lege velden mogen ontbreken.
- **Herkomst** per veld blijft in `field_sources` (bestaand mechanisme, zelfde veldnamen als de projectvelden; voor jsonvelden de `key`).

## Waarom fase 2 niets hoeft te migreren

`leesProjectinformatie()` voegt kolomvelden en `project_info` samen tot één `{ key: tekst }`; `schrijfProjectinformatie()` schrijft elk veld terug naar zijn
eigen opslag en laat al het andere ongemoeid. Fase 2 voegt alleen de kolom `project_info` en de lees/schrijf-aansluiting in `data/services/projecten.js` toe.

## Wat hoort hier niet

Documentinformatie (financier, regeling, deadline, gevraagd bedrag, criteria, tekenlimieten, positionering) hoort bij het ene document
(`document_context`) en wordt nooit Projectinformatie. Door de AI afgeleide aannames worden pas Projectinformatie nadat het lid bevestigt.
