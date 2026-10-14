# Fase 2 — Projectfinanciering / Dekkingsplan met startknop en Acties & deadlines (2026-10-14)

Status: afgerond in de repository. Geen live migratie, geen deployment.

## Wat u nu ziet onder ieder project
- Tab **Projectfinanciering / Dekkingsplan** (deeplink `?tab=projectfinanciering` ongewijzigd).
- Bovenaan het blok **Subsidiekompas** met de knop "Maak dekkingsplan en actieplan met Subsidiekompas": altijd zichtbaar, ook bij een leeg dekkingsplan. De knop is uitgeschakeld en er staat duidelijk "nog niet beschikbaar" zolang de volledige flow niet werkt (`voorstelFlow.js`: pas actief als zowel de flow- als de servervlag aan staat; beide staan nu uit). Het blok toont de zes stappen en meldt al wel wat Subsidiekompas nog nodig heeft (doel, uitvoeringsgebied; zonder begroting geen bedragen) volgens dezelfde controle als de latere flow.
- KPI's: begroting, toegekend, aangevraagd, **gepland**, eigen bijdrage, nog te financieren, plus "waarvan nog niet gepland".
- Bestaande financiering werkt ongewijzigd (regels, bedragen, statussen, deadlines, notities).
- **Acties & deadlines** van dit project op dezelfde pagina: opgeslagen taken en afgeleide acties in één lijst, herkenbaar als "Opgeslagen taak" of "Afgeleid uit dekkingsplan". Geen dubbele verplichting: heeft een regel een openstaande taak, dan verdwijnt de afgeleide actie van die regel. Een fondsdeadline zonder taak blijft zichtbaar (geen kunstmatige taak). Een taak aan een regel zonder eigen datum erft de live fondsdeadline; een ingevulde datum is de interne streefdatum en de fondsdeadline blijft daarnaast zichtbaar. Is de fondsdeadline na het voorstel gewijzigd, dan staat dat er, zonder uw streefdatum te overschrijven. "Maak er een taak van" kopieert een fondsdeadline niet meer als eigen datum.

## Verduidelijkingen
1. **Verificatie van financiers en deadlines.** Een https-url en controledatum zijn alleen herkomstgegevens. Het contract controleert nu de inhoud in code (`voorstel.js`):
   - Regeling of fonds uit de database: id, naam, bijdragegrenzen en deadline komen uitsluitend uit het databaserecord dat de server onder het abonnement van het lid ophaalt (`bekendeBronnen`). Een id dat daar niet in staat wordt geweigerd; wat het model over naam, grenzen of deadline zegt telt niet. Zonder die lijst faalt alles dicht.
   - Online financier: de server heeft de pagina echt opgehaald (`opgehaaldeBronnen`: url, paginatekst, ophaalmoment). De url moet daarin voorkomen, de naam van de financier moet in de paginatekst staan, het geciteerde fragment moet letterlijk in de tekst staan, een deadline is alleen "geverifieerd" als de datum in dat fragment staat (gangbare NL-notaties), en een voorwaarde is alleen bevestigd als haar kernwoorden in de tekst staan; anders wordt het een onzekerheid "Niet bevestigd in de bron". De controledatum is het ophaalmoment van de server, niet wat het model opgeeft.
   - Grens: dit is een controle op overeenkomst met de opgehaalde tekst, geen juridisch oordeel. Het lid blijft de aanvraagvoorwaarden bevestigen; de interface toont bron, fragment en onzekerheden. De database kan de inhoud niet nakijken, alleen url, controledatum en Pro/Premium afdwingen. De server die de pagina's ophaalt (bestaande online route) wordt in Fase 4 gebouwd.
2. **Hercontrole na `schaalNaarGat`.** `schaalNaarGat` verlaagt alleen en respecteert minima, maar controleerde niet zelf. Nieuw: `schaalEnControleer()` schaalt en haalt daarna het HELE voorstel opnieuw door `valideerVoorstel` (grenzen uit het record, financieringsgat, dubbelen, bestaande regels, acties, deadlines). Een regel die onder zijn minimum zou komen valt af (waarschuwing `regel-vervallen-door-gat`). Cofinancieringseisen staan in de database alleen als vrije tekst (`cofinanciering`), niet als getal: die rekenen we niet na, maar ze verdwijnen ook niet stil; elke regel met zo'n eis krijgt de onzekerheid "Cofinancieringseis (niet automatisch gecontroleerd): …".
3. **Gebruikerswijzigingen naast de oorspronkelijke metadata.** De metadata is onveranderlijk; wijzigingen staan in de gewone kolommen. De metadata bevat nu `voorgesteld_bedrag` (alleen ter vergelijking, nooit opgeteld). `vergelijkMetVoorstel()` toont voorgesteld versus huidig bedrag en een gewijzigde status (ook Aangevraagd of Ingetrokken). Voor taken wordt "door u aangepast" getoond (nu al). De weergave per financieringsregel volgt in Fase 3, omdat die de metadata-RPC nodig heeft (migratie nog niet live).
4. **Live takentabel.** Die komt uit een eerdere fase (actieplan-projecttaken, rapport 2026-10-12) en is op 2026-10-14 live toegepast nadat ik vroeg "alleen op uw uitdrukkelijke ja" en u antwoordde "ja pas het actieplan maar toe". Dat akkoord gold alleen voor die migratie (`project_actions`, versie 20261014095805). Voor de voorstel-metadata is er geen akkoord; die staat niet live. Het live bestand staat nu ook onder `supabase/migrations/`.

## Rollback: betekenisverlies Ingetrokken naar Afgewezen
Vastgelegd in het migratiebestand, het rollbackbestand en dit rapport. Terugdraaien zet Ingetrokken (door het lid niet voortgezet) om naar Afgewezen (door de financier afgewezen). Bedragen in het dekkingsplan blijven gelijk (beide tellen nergens mee), maar het onderscheid gaat verloren in labels, tellingen en rapportage. Mitigatie: het rollbackscript zet vooraan in de notitie "[Teruggezet: was Ingetrokken door u, niet afgewezen door de financier.]" en meldt het aantal omgezette regels. De rollback is dus niet verliesvrij; getest in de SQL-test.

## Testresultaten
- `tests/voorstel`: 124 geslaagd (bronverificatie, schaalEnControleer, metadata, vergelijking).
- `tests/actieplan`: 20 + 29 geslaagd (samengevoegde acties & deadlines).
- SQL `supabase/tests/voorstel-metadata`: OK 43, FAIL 0, rollback gecontroleerd inclusief notitie-herkomst.
- Nieuwe browsertest `uitest_voorstelstart.py`: 23/23 (tablabel, knop zichtbaar maar uitgeschakeld, ook bij leeg dekkingsplan, KPI's, erfelijke deadline, streefdatum + fondsdeadline, wijzigingsmelding, geen dubbelen, mobiel, Free).
- Regressie browser: uitest 172, fase3 72, fase4 135, fase5 69, formulier 94, inklappen 28, projectinformatie 70, actieplan 31, fase2 99, projectflow 75: allemaal groen. Node: alle suites groen.
- Aangepaste bestaande testverwachtingen: tablabel en de teller/lijstvorm van het actieplan (afgeleide acties staan nu in dezelfde lijst).

## Resterende afhankelijkheden
- Akkoord voor live migratie `20261014120000_voorstel_metadata.sql` (nodig vanaf Fase 3).
- Fase 3: bewerkbare preview en opslag; Fase 4: servergeneratie met ophalen van bronnen; Fase 5: chat; Fase 6: Acties & deadlines over alle projecten en Dashboard.
- Het systeemprompt van de chat staat nu nog op "kan niets toevoegen in Projectfinanciering"; aanpassing in Fase 5, deploy alleen met uw akkoord.
