# Analyse en aanpak: voorstel voor dekkingsplan en actieplan (chat en projectpagina) (2026-10-14)

Status: ONDERZOEK EN AANPAK. Er is niets gebouwd voor deze opdracht, geen databasewijziging en geen Edge-deploy. Alles hieronder is gecontroleerd in de actuele code (repository op de Mac, commit `a8c1fbc`) en in de live database (Supabase, alleen lezen). Namen uit eerdere analyses zijn geverifieerd; waar ze afweken is dat vermeld.

## 1. Wat de runtime nu doet (geverifieerd)

### Actief project en toegangscontrole
- De browser stuurt alleen identifiers: `conversationId`, `activeProgramId`, `focusFundingId` (`data/services/chat.js`, regel 49-69 en 116-144). Nooit een project- of financieringsobject.
- `eigenActiefProject()` (index.ts ~1976) leest het project uit `subsidie_kompas_programs` op id EN de geauthenticeerde `user_id`, alleen niet-gearchiveerd. Er is bewust geen terugval op "het eerste project".
- `gesprekProject()` + `laadFundingVoorVerzoek()` (~2389-2470): `conversations.active_program_id` is leidend. Wijkt het gesprek af van het project, dan komt er geen financieringscontext (`fundingcontext_project_wijkt_af_van_gesprek`).
- Alleen Pro/Premium/admin (`magOrganisatiegeheugen`) krijgen projectcontext. Free krijgt geen project, dus de nieuwe flow is per definitie Pro/Premium; Free blijft ongewijzigd.

### Wat het model aan projectgegevens krijgt
- Dertien velden van het project: naam, doelgroep, regio (locatie), omschrijving, doelstellingen, activiteiten, planning (of periode van/tot), impact, partners, resultaten, begroting (`budget_total`), gevraagd (`requested_amount`), eigen bijdrage (`own_contribution`).
- Maximaal 12 projectdocumenten (laatste versie, `extracted_text`), 6.000 tekens per document en 20.000 totaal.
- Organisatieprofiel (apart blok) en de financieringsstand van het project (`buildProjectFundingContext`, bron uitsluitend de RPC `kompas_dekkingsplan`, aangeroepen met de JWT van de gebruiker, fail-safe).
- Er bestaan GEEN gestructureerde kostenposten. Het project heeft één totaalbegroting; kostenposten staan alleen als tekst in documenten (of in een begrotingsdocument via de bestaande mode `budget`). "Relevante kostenposten" kunnen dus alleen uit documenten komen.

### Matching en online onderzoek
- Eén engine voor alle tiers (`freeFondsadvies`, index.ts ~5440-5610), geactiveerd door `heeftFinancieringsIntentie()` (dekkingsplan, financieringsadvies, fondsenscan en projectplan met financiering vallen er al onder). Stappen: criteria uit het gesprek, databasepool (`kompas_funders_voor_matching`), online verkenner (`verkenOnline`, parallel) en resolver (`verwerkWebKandidaten`: koppelt online kandidaten aan databasegevers en regelingen), exclusiviteitscontrole, daarna de centrale entitlementlaag (`applyEntitlementsAndSanitize`) en masking van verborgen namen.
- Een online kandidaat (`WebKandidaat`) heeft: regeling, gever, website, url, status (open/doorlopend/gesloten/onbekend), deadline, bedragMin/Max, thema's, doelgroepen, werkgebieden, samenvatting. Er is GEEN controledatum of bronlijst per kandidaat; wel een bron-URL. De controledatum moet dus bij het genereren worden vastgelegd (nieuw).
- Bij een fondsadviesbeurt krijgt het eindantwoord bewust geen zoektool; het onderzoek is dan al server-side gebeurd.

### Chat naar de browser
- Het antwoord is JSON of SSE (`data: {...}`); de laatste regel bevat `answer`, `sources`, `veldVoorstellen`, `projectDossier` en `fondsMatches` (Fase 5). `fondsMatches` is een gevalideerde, gestructureerde lijst (max. 12 items; alleen databaserecords met een geldig id en volledig toegestaan volgens de entitlementlaag; online kandidaten zonder id worden bewust niet meegegeven).
- Frontend: `chat/fondsMatches.js` (valideren, status), `chat/FondsMatchKaart.jsx` (kaart met selectie, status per regel), in `KompasToolPage.jsx` gekoppeld aan het bericht en alleen getoond als het gesprek aan hetzelfde project gekoppeld is.
- De intentie van het laatste bericht (`bepaalFondsIntentie`: scan, scan_en_toevoegen, toevoegen, advies) bepaalt alleen welke knoppen de browser toont; de AI schrijft nooit naar de database.

### Opslag
- Dekkingsplan: één insert-pad, `voegToeAanProjectfinanciering` (`financiering/toevoegen.js`) voor een regeling of fonds (alleen verwijzing, bedrag en startstatus `interesting`), en `voegFinancierToe` (`data/services/projectFinanciering.js`) voor een financier op naam (`financier_naam`, bedrag, status, eigen deadline, notitie). Duplicaten worden door unieke indexen in de database geweigerd ("staat al"). Wijzigen via `werkRegelBij`; kolomrechten beperken wat het lid mag wijzigen.
- Dekkingsplan rekenen: `financiering/dekkingsplan.js` (`berekenDekking`, `teFinancieren`). Regels in `interesting` of `preparing` met een bedrag tellen als **Gepland**, niet als Aangevraagd of Toegekend. Een voorgesteld bedrag kan dus veilig als `requested_amount` met status `interesting` worden opgeslagen.
- `subsidie_kompas_program_funding` heeft GEEN kolom voor voorstelmetadata (kolommen: id, user_id, program_id, scheme_id, funder_id, requested_amount, awarded_amount, status, eigen_deadline, reminder_enabled, notes, created_at, updated_at, financier_naam). Herkomst, motivatie en voorstelmoment kunnen nu alleen in `notes`.

### Actieplan
- Afgeleid actieplan (`financiering/acties.js`, `leidActiesAf`): bestaat en wordt sinds de bouw van 12 oktober getoond in het blok "Aanbevolen op basis van uw dekkingsplan" onder Projecten, Projectfinanciering. Het stond daarvoor in de code maar niet in het scherm. Op het Dashboard staat het afgeleide actieplan nog NIET; het Dashboard toont deadlines en dekking (`dashboardData.js`: `komendeDeadlines`, `dekkingVanProject`).
- Opgeslagen taken: de tabel `subsidie_kompas_program_actions` bestaat nu LIVE (toegepast op 2026-10-14) met `source` (user of chat) en `proposed_at`. UI: `ActieplanBlok.jsx` (Projectfinanciering) en tab "Actieplan" op Deadlines. Er is nog geen veld dat een externe fondsdeadline onderscheidt van een interne streefdatum, en geen sleutel om herhaald opslaan van dezelfde voorgestelde taak te voorkomen.
- Opmerking: de commits met deze UI (`a6ef900`, `a8c1fbc`) staan lokaal op de Mac en zijn nog niet gepusht.

### Voorstelmetadata en voorstelcontract
- Bestaat niet. Er is geen `financieringsVoorstel`, geen voorstelkaart voor een dekkingsplan, en geen metadata op regels. Het bestaande patroon dat we hergebruiken: aparte server-side mode met projectvalidatie (`mode: 'project-omschrijving'`, index.ts ~5855: projectId uit de browser, gecontroleerd op eigenaar, niet-gearchiveerd, Pro/Premium, schrijft nooit zelf).

### Let op: relatie live tegenover repository (Edge Function)
- De live functie `subsidie-kompas` is versie 92 en wordt als gebundelde, verkleinde bestand teruggegeven (144 KB), de repository heeft de leesbare bron (345 KB). Ik kan de twee dus niet op bestandsinhoud vergelijken. Wel staan dezelfde onderdelen erin (`fondsMatches`, `kompas_dekkingsplan`). Vóór elke deploy: de afgesproken baselinetests (Fase 5, 63 vaste fondsscanvragen; de bekende 9 FAIL zijn van vóór dit werk) en een controle dat de te deployen bron van de repository is afgeleid. Dit is dezelfde les als het incident met v88.

## 2. Wat al werkt, wat ontbreekt

Werkt en wordt hergebruikt: projectvalidatie en toegangscontrole, projectcontext, financieringscontext (RPC), matching en online verkenner met resolver, entitlement en masking, rekenregels (Gepland), opslagroutes met duplicaatbescherming, de kaartopzet en validatie uit Fase 5, de takentabel met actieplan-UI.

Ontbreekt: gedeeld voorstelcontract; een server-side generatiefunctie (aanbevolen bedragen, actieplan, completheidscontrole); uitvraagfase; voorstelkaart en voorstelpreview in de browser; gedeelde opslagroute voor regels én taken in één flow met herhaalbaarheid; metadata (herkomst, motivatie, voorstelmoment, bron, controledatum); onderscheid externe deadline en interne streefdatum; Dashboard- en Mijn deadlines-samenvatting van opgeslagen taken.

## 3. Voorgestelde architectuur

### 3.1 Gedeeld voorstelcontract (versie 1)
Eén JSON-vorm, gevalideerd aan beide kanten (nieuw: `financiering/voorstel.js`, zuiver, getest; server heeft dezelfde validatie in de Edge Function):

- `projectId`, `versie`, `gegenereerdOp`, `status`: `uitvraag` | `concept` | `definitief`.
- `uitvraag`: maximaal drie vragen (veld, essentieel ja/nee, vraagtekst, reden), `tegenstrijdigheden` (waarden uit beide bronnen, gebruiker kiest), `aannames` (alleen bij concept).
- `feiten` (alleen lezen, uit de RPC en het project): begroting, toegekend, aangevraagd, eigen bijdrage, overige dekking, nog te financieren.
- `regels` (maximaal 8): `sleutel`, `type` (regeling of fonds, uit de database, met id) of `online` (zonder id), naam, gever, aanbevolen bedrag, motivatie, projectonderdeel, `deadline` (alleen geverifieerd) of `deadlineStatus: 'te-verifiëren'`, voorwaarden, onzekerheden, `bron` {url, gecontroleerdOp} en `staatAl`.
- `nietToegewezen`: restant dat niet verdeeld is.
- `acties`: `sleutel`, titel, gekoppelde regelsleutel, `deadlineType` (extern of streef), datum, prioriteit, status (altijd `todo` bij voorstel), toelichting.

### 3.2 Generatie: één server-functie, twee ingangen
`bouwFinancieringsvoorstel()` in de Edge Function, aangeroepen door:
1. een nieuwe mode `financieringsvoorstel` (projectknop): `projectId` uit de browser, gevalideerd precies als `project-omschrijving` (eigenaar, niet-gearchiveerd, Pro/Premium, rate limit); en
2. de chatbeurt bij de intentie dekkingsplan, financieringsstrategie of actieplan: gesprek en `active_program_id` blijven leidend, het voorstel gaat mee in de laatste SSE-regel als nieuw veld `financieringsVoorstel` naast `fondsMatches` (bestaande streamstructuur ongewijzigd).

Volgorde in de functie:
1. Project en documenten lezen (`eigenActiefProject`) en bestaande regels (`kompas_dekkingsplan`).
2. Deterministische completheids- en consistentiecontrole (`beoordeelProject()`, zuivere functie): essentieel = omschrijving of doelstellingen, regio, doelgroep. Zonder begroting: wel financiers onderzoeken maar geen bedragen. Tegenstrijdigheden: bijvoorbeeld begroting kleiner dan eigen bijdrage plus toegekend, of een afwijkend bedrag in een begrotingsdocument (via de bestaande documentextractie, dan geen stille keuze). Maximaal drie vragen per ronde; eerdere antwoorden uit het gesprek tellen mee; essentieel ontbreekt = `status: uitvraag`.
3. Matching en online onderzoek: de bestaande engine (`freeFondsadvies`), ongewijzigd, inclusief resolver, entitlementlaag en masking. Kandidaten zonder databaseregeling krijgen de bron-url en de controledatum van dit moment.
4. Bedragen en dekkingsberekening: DETERMINISTISCH in code (gat = begroting min toegekend, aangevraagd, eigen bijdrage en overige dekking; verdeling over de gekozen financiers met respect voor bedragMin/Max van de regeling en een maximumaandeel per financier; rest = "Nog niet toegewezen"). Het taalmodel bepaalt geen bedragen.
5. Tekstvelden (motivatie, projectonderdeel, toelichting): één gestructureerde modelaanroep op de bestaande Responses API met schema; invoer = alleen de gekozen kandidaten uit stap 3 en de projectfeiten; uitvoer wordt gevalideerd; een financier die niet in de invoer zat wordt verworpen. Zo kan het model geen financier, regeling of bedrag verzinnen.
6. Actieplan: deterministische sjablonen terugplannend vanaf geverifieerde deadlines (voorwaarden controleren, begroting aanvullen, vooroverleg, stukken verzamelen, aanvraag voorbereiden en indienen, opvolgen), met een interne streefdatum per taak en de externe deadline apart. Onbekende deadline = taak "Deadline en openstelling verifiëren" en geen datum.
7. Fail-safe: bij elke fout geen voorstelkaart en de chat verloopt als voorheen.

### 3.3 Weergave en opslag (browser)
- Nieuw `financiering/VoorstelKaart.jsx`: één component voor projectpagina en chat (selectie, bedragen aanpassen, taken en streefdatums aanpassen, [Beide opslaan] [Alleen dekkingsplan] [Alleen actieplan], preview "wordt toegevoegd" vóór opslaan, status per onderdeel).
- Nieuw `financiering/voorstelOpslaan.js`: één opslagroute die per regel `voegToeAanProjectfinanciering` (id-regels) of `voegFinancierToe` (online of cofinancier, zie beslispunt 1) en per taak `voegActieToe` gebruikt. Idempotent: duplicaatregels worden door de database herkend, taken krijgen een `voorstel_sleutel` met unieke index per project. Herhaald klikken of een gedeeltelijke fout geeft geen dubbelen; "Opnieuw proberen" verwerkt alleen wat nog ontbreekt. Bestaande regels worden nooit overschreven.
- Projectpagina: knop "Maak dekkingsplan en actieplan" in Projectfinanciering opent de kaart (met de uitvraagfase indien nodig).
- Chat: `chat/` rendert dezelfde kaart onder het bericht (zoals `FondsMatchKaart`), alleen als het gesprek aan dat project hangt. Zonder actief project: projectkeuze via de bestaande `kiesBestaandProject` of, voor een concept, de bestaande projectaanmaakroute daarna; geen opslag zonder gevalideerd doelproject.
- Dashboard en Mijn deadlines: samenvatting van opgeslagen taken (openstaand, te laat, eerstvolgende) met deeplinks naar Projecten, Projectfinanciering; geen eigen rekenlogica, alleen `useActieplan` en bestaande deadlinefuncties.

### 3.4 Datamodel: gerichte uitbreiding (migratie met rollback, pas live na uw akkoord)
1. `subsidie_kompas_program_funding.voorstel jsonb null`: {door, moment, motivatie, onderdeel, bron_url, gecontroleerd_op, versie}. Alleen bij insert zetbaar (kolomrecht), daarna alleen zichtbaar; de interface toont een badge "Voorgesteld" tot het lid de regel zelf wijzigt.
2. `subsidie_kompas_program_actions`: kolom `deadline_type text null check in ('extern','streef')`, kolom `voorstel_sleutel text null` met unieke index `(program_id, voorstel_sleutel) where voorstel_sleutel is not null`. `source = 'chat'` en `proposed_at` bestaan al; ik stel voor `source` uit te breiden met `'voorstel'` (herkomst van de projectknop) of beide als `'chat'` te laten.
3. Status "Ingetrokken" in de statuscontrole van de financiering (staat al op de lijst).
Geen wijziging aan `kompas_dekkingsplan` nodig: het voorstel komt alleen uit extra kolommen op dezelfde rijen. De rekenregels blijven: voorgesteld = Gepland.

## 4. Betrokken bestanden
- Edge Function `supabase/functions/subsidie-kompas/index.ts`: nieuw gemarkeerd blok (zoals FASE5): `beoordeelProject`, `bouwFinancieringsvoorstel`, mode `financieringsvoorstel`, veld `financieringsVoorstel` in de SSE-/JSON-uitvoer, intentie dekkingsplan/actieplan, aanvulling van de systeeminstructie (verwijst naar de kaart, geen "kan geen regels toevoegen" meer, voorstellen zijn geen aanvragen, geen verzonnen deadlines).
- Nieuw: `financiering/voorstel.js`, `VoorstelKaart.jsx`, `voorstelOpslaan.js`, `data/services/voorstel.js` (aanroep mode), tests.
- Aangepast: `data/services/chat.js` (veld doorgeven), `KompasToolPage.jsx` (kaart onder bericht), `ProjectfinancieringTab.jsx` (knop), `ActieplanBlok.jsx` (badge Voorgesteld, extern/streef), `data/services/projectFinanciering.js` en `projectActies.js` (extra velden), `dashboard/dashboardData.js` en `DashboardPage.jsx`, `deadlines/MijnDeadlines.jsx`.
- Migratie: `supabase/voorstel-niet-uitgevoerd/<tijdstempel>_voorstel_metadata.sql` met rollback.

## 5. Fasering (A is dit document)
- A. Actuele runtime onderzoeken: klaar.
- B. Voorstelcontract en `beoordeelProject` (zuiver, getest) + migratievoorstel: geen deploy, geen live wijziging.
- C. Voorstelkaart, preview en opslagroute, getest met nagebootste server (kaart vanaf de projectpagina met voorbeeldvoorstel).
- D. Server-generatie (nieuw blok in index.ts) met mode, tests op de zuivere onderdelen en baselinetest; deploy alleen met uw toestemming.
- E. Chat aansluiten (intentie, veld in uitvoer, kaart in het bericht, systeeminstructie).
- F. Dashboard en Mijn deadlines.

## 6. Controles per fase
Volledig project: geen overbodige vragen. Onvolledig: maximaal drie gerichte vragen, essentieel eerst. Tegenstrijdig: geen stille keuze (gebruiker kiest). Zonder begroting: geen sluitend plan met bedragen. Bestaande financiering: geen duplicaten of overschrijving. Voorstellen tellen als Gepland (nooit Aangevraagd/Toegekend). Onbekende deadline: "te verifiëren" en verificatietaak, nooit een verzonnen datum. Opslaan: dubbel klikken, gedeeltelijke fout en opnieuw proberen. Projecteigenaarschap en niet-gearchiveerd (vreemd of foutief projectId wordt geweigerd). Entitlement en masking op alle kandidaten, bronverwijzingen en opgeslagen metadata (Premium-fonds nooit zichtbaar voor Pro of Free, ook niet na downgrade via opgeslagen metadata). Bestaande chat, Free en documentgeneratie ongewijzigd (baselinetest, Free-regressie). Rate limit en verbruik (de nieuwe modelaanroep wordt vastgelegd zoals de verkenner).

## 7. Risico's en beslispunten
1. Online gevonden financiers zonder databaseregeling: nu bewust niet toevoegbaar in de chat. Voorstel: wel tonen en opslaan als regel op naam (`financier_naam`) met bron-url en controledatum in `voorstel`, alleen voor Pro/Premium en alleen na entitlementcontrole; geen databaseverwijzing. Akkoord?
2. Kostenposten ontbreken als structuur; het voorstel verdeelt projectonderdelen op basis van tekst in omschrijving, activiteiten en documenten. Een structurele kostenpostentabel is een apart besluit.
3. Controledatum en bron per kandidaat bestaan nog niet; het voorstel legt de bron-url vast en de datum van het genereren, niet een onafhankelijke bronverificatie.
4. Tegenstrijdigheid tussen veld en document wordt alleen herkend als een bedrag in documentextractie te herleiden is; anders vraagt het voorstel om bevestiging bij onzekerheid.
5. De live functie is een gebundelde versie 92; vóór deploy de controle van punt "relatie live en repository" hierboven.
6. Migratie en deploy alleen met uw expliciete akkoord.
