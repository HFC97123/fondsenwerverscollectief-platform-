# Fase 1 — Voorstelcontract, project lezen en uitvragen, migratievoorstel (2026-10-14)

Status: afgerond in de repository. Niets is live toegepast of gedeployed.

## Wat er is gebouwd
1. `src/features/kompas-app/financiering/voorstel.js` (zuivere module, geen imports; later kopieerbaar naar de Edge Function met een drift-test):
   - `beoordeelProject()` leest project, antwoorden en documentbedragen. Essentieel (doel, uitvoeringsgebied) blokkeert het definitieve voorstel; aanvullend (doelgroep, looptijd) wordt een benoemde aanname; zonder begroting alleen een concept zonder bedragen; tegenstrijdige begrotingen (>1% verschil), eigen bijdrage boven begroting of einddatum voor startdatum geven een gerichte vraag, nooit een stille keuze. Maximaal drie vragen per ronde, blokkerende eerst, de rest in `volgendeRonde`.
   - `valideerVoorstel()` controleert het model-/enginevoorstel: project, versie, maximaal 8 regels, id's van regelingen/fondsen, online financiers alleen met https-bron en controledatum, bedragen binnen bijdragegrenzen en binnen het resterende financieringsgat, dubbeltellingen en bestaande regels (nooit overschrijven), deadlines alleen "geverifieerd" met controleerbare grondslag (anders "te verifiëren" met automatische verificatietaak), interne streefdatums nooit in het verleden of na de externe deadline.
   - `berekenTotalen()`, `schaalNaarGat()`, `plantTerug()`, `regelMetadata()`: een voorgesteld bedrag telt na opslag als Gepland (nooit Aangevraagd/Toegekend), via de bestaande rekenregels van het dekkingsplan.
2. Migratievoorstel (repository, niet live): `supabase/voorstel-niet-uitgevoerd/20261014120000_voorstel_metadata.sql` + `_rollback.sql`.
3. SQL-test op lokale Postgres: `supabase/tests/voorstel-metadata/` (`sh run.sh`).
4. Hygiëne: de live toegepaste takentabel staat nu als `supabase/migrations/20261014095805_project_actions.sql` (live versienummer).

## Het migratievoorstel in het kort (alles additief)
- `funding.voorstel jsonb` — herkomst/onderbouwing (herkomst regeling/fonds/online, bron-url, controledatum, voorwaarden, onzekerheden, deadlinestatus). Alleen bij aanmaken; daarna onveranderlijk. Online financier: naam + https-url + controledatum + Pro/Premium (ook in de database). Komt NIET in `funders`/`subsidieregelingen`.
- Status `withdrawn` (Ingetrokken) in de statuscontrole. Telt nergens mee in het dekkingsplan.
- `kompas_voorstel_metadata(p_program_id)` — aparte RPC, gemaskeerd via `kompas_dekkingsplan()`; `kompas_dekkingsplan()` zelf is NIET gewijzigd.
- `actions.voorstel_sleutel` (+ unieke index per project): idempotent opslaan, herhaald klikken geeft 23505 = "bestaat al".
- `actions.bron_deadline_bij_voorstel`: fondsdeadline op het moment van voorstellen, om latere wijzigingen zichtbaar te maken zonder de gekozen streefdatum te overschrijven. Geen `deadline_type`-kolom: `due_date` leeg = erft de fondsdeadline, `due_date` gevuld = interne streefdatum. Geen uitbreiding van `source` (bestaand `chat` = voorgesteld door Subsidie Kompas).

Gevolgen live: vier kolommen/constraints erbij, twee triggerfuncties vervangen (zelfde gedrag + extra controle), één nieuwe RPC. Geen datamigratie, geen RLS-wijziging, bestaande rijen blijven geldig. Rollback: metadata gaat verloren, `withdrawn` wordt `rejected` (zelfde effect op totalen), regels en taken blijven.

## Testresultaten
- Contracttests `node tests/voorstel/run.mjs`: 93 geslaagd, 0 mislukt (o.a. volledig project geen overbodige vragen; onvolledig gerichte uitvraag; tegenstrijdig geen stille keuze; geen verzonnen deadline; geen dubbele regels; Gepland-rekenregel).
- SQL `sh supabase/tests/voorstel-metadata/run.sh`: OK 43, FAIL 0, rollback gecontroleerd. De test vond één echte fout in mijn eerste versie (de RPC gaf voor andermans project een lege uitkomst in plaats van dezelfde fout) en is hersteld.
- Regressie: `tests/actieplan` 29/29.

## Resterende afhankelijkheden
- Uw akkoord op het migratiebestand voor live toepassen (Fase 3 opslag van metadata en Fase 4/5 hebben het nodig; Fase 2 niet).
- `voorstel.js` moet in Fase 4 naar de Edge Function worden gekopieerd (drift-test) vóór deploy; deploy alleen met uw expliciete akkoord.
- Mac-synchronisatie en commit van de nieuwe bestanden (bridge) en pushen door u.
