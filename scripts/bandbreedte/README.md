# Gatenlijst en bandbreedte-onderzoek

## A. Gatenlijst (nu): zelf aanvullen vanuit je eigen kennis

Een Excel-sheet van alle **goedgekeurde fondsen en regelingen die meedoen aan de AI-matching** (295 fondsen en 251 regelingen, waaronder de gemeentelijke regelingen van Amsterdam, Utrecht, Den Haag en Rotterdam). Per rij: naam, type aanbieder, Pro/Premium, vestigingsplaats, korte omschrijving, disciplines (thema's), doelgroepen, werkgebieden, website, aanvraagcriteria of voorwaarden, aanvraaglink en deadline (regelingen), bijdrage min, max, band en toelichting. **Gele cel = nog leeg.** Kolom "Aantal gaten" telt de gele cellen per rij.

    node scripts/bandbreedte/bandbreedte.mjs gatenlijst --uit ~/Desktop/gatenlijst.xlsx

(De kant-en-klare sheet is ook los opgeleverd; dit commando maakt hem opnieuw uit `data/gatenlijst.json`, een momentopname van de database van 17-10-2026.)

Invullen in Excel:

- Disciplines, doelgroepen en werkgebieden: kies uit het tabblad Keuzelijsten en scheid meerdere met een puntkomma. Een waarde die niet in de lijst staat, wordt bij de import gemeld en overgeslagen.
- Bestaande (witte) waarden mogen ook aangepast worden. Leegmaken of verwijderen wordt genegeerd: de tool wist nooit iets.
- Deadline alleen bij regelingen die open, aangekondigd of binnenkort zijn.
- Pro/Premium wijzigen kan (keuzelijst); dat staat dan als "let op" in de SQL, want het bepaalt wie het ziet.

Terug naar de database:

    node scripts/bandbreedte/bandbreedte.mjs gatenlijst-sql --sheet ~/Desktop/gatenlijst.xlsx

Dit maakt een `.sql`-bestand naast de sheet, met alleen de cellen die je gewijzigd hebt, in één transactie. Nalezen en uitvoeren in de Supabase SQL-editor, of geef de sheet aan mij. Meerwaardige velden worden alleen toegevoegd (koppelingen die al bestaan blijven staan). Vul je min of max in zonder band, dan kiest de import de band zelf.

## B. AI-onderzoek naar bandbreedtes (later, kost geld)

Zoekt per fonds en per regeling welke bedragen ze werkelijk toekennen, en maakt daar een reviewsheet van. **De tool schrijft nooit naar de database.** Jij beslist wat erin komt.

## Wat hij doet

1. Pakt de lijst (`data/records.json`: dezelfde 295 fondsen en 251 regelingen als de gatenlijst, met huidige bedragen en band).
2. Opent de eigen website van het fonds en volgt links met "jaarverslag", "toekenningen", "projecten", "ANBI", "aanvragen". Pagina's én PDF's. Geen website bekend, of bijna niets gevonden? Dan zoekt hij via webzoeken naar adressen (ook artikelen van derden, mits de naam van het fonds erin staat).
3. Het AI-model kopieert uit de ruwe tekst alleen toekenningen met bedrag en regels ("maximaal € …"), elk met een letterlijk citaat.
4. De code controleert elk citaat letterlijk in de brontekst en of het bedrag in dat citaat staat. Totaalbedragen, gemiddelden en begrotingen vallen af. Wat niet klopt, wordt weggegooid.
5. De code rekent: minimaal 5 toekenningen uit de laatste 3 jaar waarover het fonds publiceert. Bij 5 tot 9: laagste en hoogste. Vanaf 10: P10 tot P90 (zodat één uitschieter de bandbreedte niet verpest). Noemt het fonds zelf een minimum of maximum, dan gaat dat voor. Daarna wordt de band uit de bestaande lijst (€0–€5.000 … €1.000.000+) gekozen op het gebruikelijke bedrag.
6. Alles komt in een Excel-sheet met bewijs per rij.

## Voorbereiding (eenmalig)

- Open Terminal in de projectmap. `npm install` als dat nog niet gedaan is (exceljs en pdfjs-dist staan al in het project).
- `export OPENAI_API_KEY=jouw_sleutel` (dezelfde sleutel als in Supabase; blijft op je eigen computer).

## Stap 1: proef op 10 records

    node scripts/bandbreedte/bandbreedte.mjs run --uit scripts/bandbreedte/runs/proef --limit 10 --max-kosten 3
    node scripts/bandbreedte/bandbreedte.mjs sheet --uit scripts/bandbreedte/runs/proef

Open `scripts/bandbreedte/runs/proef/bandbreedte-review.xlsx` en kijk of de citaten kloppen met de werkelijkheid. Handige extra: `--alleen "GAK"` onderzoekt één fonds, `--type fonds` of `--type regeling` beperkt de soort, `--zonder-bedrag` slaat records over die al een bedrag hebben.

## Stap 2: alles

    node scripts/bandbreedte/bandbreedte.mjs run --uit scripts/bandbreedte/runs/eerste --max-kosten 40
    node scripts/bandbreedte/bandbreedte.mjs sheet --uit scripts/bandbreedte/runs/eerste

- Je mag stoppen (Ctrl+C) en later hetzelfde commando opnieuw draaien: klare records worden overgeslagen en opgehaalde pagina's komen uit de cache.
- Er wordt maximaal één verzoek per 1,2 seconde per website gedaan en robots.txt wordt gerespecteerd. Reken op één tot enkele uren.
- Kosten: tijdens de run zie je een lopend bedrag. Mijn inschatting vooraf is grofweg € 15 tot € 45 voor alles met `gpt-4o`; `--model gpt-4o-mini` is veel goedkoper maar minder nauwkeurig. `--max-kosten` stopt de run bij dat bedrag.

## Stap 3: nakijken en aanvullen in de sheet

De sheet staat gesorteerd op zekerheid (hoog bovenaan). Kolommen:

- Wit = berekend door de tool. **Geel = voor jou.**
- **JOUW min / JOUW max / JOUW band**: vul je eigen kennis in. Dat gaat altijd voor en overschrijft ook wat er nu in de database staat.
- **Akkoord**: `ja` om het voorstel over te nemen (alleen als de database nu nog leeg is), `nee` om over te slaan.
- **Toelichting (wordt opgeslagen)**: de tekst die in het veld toelichting komt. Pas gerust aan.
- Er staat niets vooraf op "ja": filter op zekerheid "hoog", controleer een paar rijen en vul dan door.

## Stap 4: naar de database

    node scripts/bandbreedte/bandbreedte.mjs sql --sheet scripts/bandbreedte/runs/eerste/bandbreedte-review.xlsx

Dit maakt een `.sql`-bestand naast de sheet met één `update` per goedgekeurde rij, in één transactie. Lees het na en voer het uit in de Supabase SQL-editor (of geef het aan mij). Fondsen schrijven naar `funders` (`bijdrage_min`, `bijdrage_max`, `bandbreedte_bijdrage_id`, `bijdrage_toelichting`), regelingen naar `subsidieregelingen` (`bedrag_min`, `bedrag_max`, `bandbreedte_bijdrage_id`, `bijdrage_toelichting`). Een voorstel schrijft alleen als min en max in de database leeg zijn.

## Wat je moet weten

- "Niets gevonden" is een normale uitkomst: veel fondsen publiceren geen bedragen per toekenning of werken op uitnodiging.
- Sites die alles met JavaScript opbouwen, PDF's die alleen een scan zijn en pagina's achter een login kan de tool niet lezen.
- Bedragen in dollars of ponden worden omgerekend (0,92 en 1,17); dat staat in de toelichting en is een schatting.
- Het model kopieert alleen; een citaat dat echt op de pagina staat maar onzin beweert, komt wel door de controle. Bij bronnen van derden is de zekerheid daarom nooit "hoog", en jij ziet bij elke rij de bron.
- `data/handmatig.json` bevat de bronnen en uitkomsten van de handmatige proef (GAK, Schipholfonds, Sandals, Cruyff, enzovoort). De bronadressen worden altijd mee onderzocht; de handmatige cijfers worden alleen gebruikt als de tool zelf niets vindt, en staan dan als "HANDMATIG (proef)" in de sheet.

## Tests

    node tests/bandbreedte/test.mjs

## Gatenlijst: aanvullingen (oktober 2026)

- De sheet heeft nu een kolom "Controlepunt (Claude)" en blauwe cellen (= aangevuld of aangepast ten opzichte van de versie van de gebruiker).
- Naamwijzigingen worden herkend via de verborgen kolom "oorspronkelijk naam" en komen als `update … set naam` in de SQL (aanbieder wordt nooit gewijzigd).
- `data/taxonomie.json` heeft een sleutel `nieuw` met voorgestelde doelgroepen/regio's. Alleen de daadwerkelijk gebruikte worden (idempotent, `where not exists`) bovenaan de SQL toegevoegd, om pas na akkoord uit te voeren.
