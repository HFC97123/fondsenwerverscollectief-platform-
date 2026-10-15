-- UITGEVOERD 11-10-2026 door Claude via Supabase execute_sql (per batch als één statement met CTE's, inhoudelijk identiek aan dit bestand).
-- LET OP: de verwijdering van het Bylandt-dubbelrecord 4858f6e1 is NIET uitgevoerd (wacht op akkoord); die regel staat hieronder uitgecommentarieerd.
-- Deadline-/classificatiereview batch 4, DEEL B: updates + verwijderingen. Uitvoeren in Supabase > SQL Editor. Idempotent. Bronnen bekeken 11-10-2026.
begin;

-- Achmea Impact Fund
update public.subsidieregelingen set deadline_omschrijving='Geen vaste deadline; een one-pager kan doorlopend per e-mail worden ingediend. Alleen voor projecten in Sub-Sahara Afrika.' where id='9aad98e0-c3bd-4a24-808a-c637682f50a8';
-- BeSt: bestuur vergadert 4x/jaar (niet elke 4 weken)
update public.subsidieregelingen set deadline_omschrijving='Doorlopend indienen, minimaal 2 maanden vóór de projectstart. Het bestuur beslist vier keer per jaar.' where id='ce274c27-290b-43f6-a6e6-944a62dc58fd';
-- Dioraphte Podiumkunsten
update public.subsidieregelingen set aanvraaglink='https://dioraphte.nl/podiumkunsten/', deadline_omschrijving='Geen vaste deadline; dien de vooraanvraag minimaal 6 maanden vóór de projectstart in. Volledige aanvraag op uitnodiging.' where id='d19a390d-f754-42eb-9192-b23e589774d0';
-- Dioraphte Sociale initiatieven
update public.subsidieregelingen set aanvraaglink='https://dioraphte.nl/social-nederland/', deadline_omschrijving='Geen vaste deadline; vooraanvraag via het portaal. De behandeling duurt gemiddeld 4 maanden.' where id='c1b2ba81-267c-4150-98a0-922587c67ac3';
-- Fonds 21 Jongeren & Maatschappij
update public.subsidieregelingen set aanvraaglink='https://fonds21.nl/loket/onze-pijlers/jongeren-maatschappij/', bedrag_min=10000, deadline_omschrijving='Jaarrond indienen, minimaal 4 maanden vóór de projectstart (Caribisch deel: 2 maanden). Eerst de Snelcheck doen.' where id='34e22a6b-a84c-4874-aa27-757b0c2e9aa7';
-- Fonds 21 Kunst & Cultuur
update public.subsidieregelingen set aanvraaglink='https://fonds21.nl/loket/onze-pijlers/kunst-cultuur/', bedrag_min=10000, deadline_omschrijving='Jaarrond indienen, minimaal 4 maanden vóór de projectstart (Caribisch deel: 2 maanden).' where id='0aa9c69c-0b97-4240-8592-93452949ccff';
-- Fonds 21 Kunst & Educatie
update public.subsidieregelingen set aanvraaglink='https://fonds21.nl/loket/onze-pijlers/kunst-educatie/', bedrag_min=10000, deadline_omschrijving='Jaarrond indienen, minimaal 4 maanden vóór de projectstart (Caribisch deel: 2 maanden).' where id='abd62f84-5b8e-4fba-8ca4-eb3a92163237';
-- Fonds 21 Kunsteducatie mbo (tijdelijke regeling)
update public.subsidieregelingen set aanvraaglink='https://fonds21.nl/loket/onze-pijlers/tijdelijke-regelingen/kunsteducatie-voor-mboers/', bedrag_max=50000 where id='e6495b23-38f1-433c-a1e8-6b0a639e53dc';
-- Amsterdam gebiedsgebonden kunst/cultuur
update public.subsidieregelingen set deadline_datum=null, aanvraaglink='https://lokaleregelgeving.overheid.nl/CVDR723748', deadline_omschrijving='Verschilt per stadsdeel: vaste termijnen (vóór 1 april en vóór 1 oktober) of doorlopend tot het budget op is. Volgende vaste termijn: vóór 1 april 2027.' where id='c301f9c8-aacf-4a50-92f5-9fbc6a1f13fe';
-- Rotterdam Projectsubsidie cultuur: rondes, niet doorlopend
update public.subsidieregelingen set status='open', deadline_datum='2026-11-01', aanvraaglink='https://www.rotterdam.nl/projectsubsidie-cultuur-aanvragen', deadline_omschrijving='Zes rondes per jaar met sluiting op 1 januari, 1 maart, 1 mei, 1 juli, 1 september en 1 november. Eerstvolgende: 1 november 2026.' where id='f739e389-e8fb-48ca-b092-8b9d20a7eeee';
-- Utrecht Cultuur in de vrije tijd
update public.subsidieregelingen set aanvraaglink='https://loket.digitaal.utrecht.nl/nl/producten/cultuur-in-de-vrije-tijd-subsidie-aanvragen', deadline_omschrijving='Het hele jaar aan te vragen, uiterlijk 6 weken vóór de start van de activiteit; besluit binnen 13 weken.' where id='2ae395cd-0b92-4937-b695-9fc475ce1af5';
-- Haëlla
update public.subsidieregelingen set aanvraaglink='https://haella.nl/stichting/aanvragen/', bedrag_max=4000, deadline_omschrijving='Het hele jaar aan te vragen via het online formulier (max. één keer per jaar); reactie meestal binnen 1 maand.' where id='bcd023a3-337a-468d-b703-f4fcb40852c2';
-- Hofstee
update public.subsidieregelingen set aanvraaglink='https://hofsteestichting.nl/aanvragen/', deadline_omschrijving='Geen vaste deadline; aanvragen per e-mail. Afhandeling duurt 2-3 maanden; max. één aanvraag per kalenderjaar.' where id='6e3a142b-1e03-4e54-860a-065241bdae56';
-- Iona (officiële naam Projectaanvraag)
update public.subsidieregelingen set naam='Projectaanvraag', aanvraaglink='https://iona.nl/aanvragen/projectaanvraag/', deadline_omschrijving='Geen vaste deadline; online indienen vóór de start van het project. Reactie in principe binnen 6 weken.' where id='510c9bae-260e-4741-b4e9-7752d196cb80';
-- Jeugdfonds Sport & Cultuur (bijdrage per kind)
update public.subsidieregelingen set aanvraaglink='https://jeugdfondssportencultuur.nl/voor-wie/voor-ouders/', deadline_omschrijving='Het hele jaar aan te vragen via een Meerkracht (bijv. leerkracht of wijkteam); het fonds betaalt rechtstreeks aan de club. Bijdrage per kind, geen projectsubsidie.' where id='5774d2da-d36b-4c38-ae6f-0e2f2024c798';
-- Kansfonds
update public.subsidieregelingen set aanvraaglink='https://www.kansfonds.nl/aanvragen/', deadline_omschrijving='Geen vaste deadline. Start met een vooraanvraag via Mijn Kansfonds; besluit op de volledige aanvraag na ongeveer 3 maanden.' where id='78f0030a-1d70-4949-b7cb-aefe1a16184f';
-- Katalys Kern met Pit (editie 2027 open)
update public.subsidieregelingen set status='open', deadline_datum='2026-10-31', bedrag_min=1000, bedrag_max=1000, aanvraaglink='https://katalys.nl/kernmetpit', deadline_omschrijving='Inschrijven voor Kern met Pit 2027 kan t/m 31 oktober 2026; start in januari 2027. Jaarlijkse competitie: €1.000 als het plan binnen een jaar lukt.' where id='0843ecc3-9f83-4a2c-82c4-2c59df543ae6';
-- Louisa
update public.subsidieregelingen set aanvraaglink='https://www.louisastichting.nl/steun-aanvragen/', deadline_omschrijving='Geen deadline; dien ruim vóór de start van het project in via het online formulier, samen met een Vrijmetselaarsloge.' where id='98945b51-fbd4-43eb-83ac-74e0e55ba9cc';
-- LSBS particulieren
update public.subsidieregelingen set aanvraaglink='https://lsbs.nl/aanvragen', bedrag_min=25, deadline_omschrijving='Doorlopend; geen deadline. Geen bijdrage met terugwerkende kracht, dus indienen vóór de aanschaf. Alleen voor particulieren met een visuele beperking.' where id='f980d121-0cbb-4856-ac52-b853f42c29fb';
-- Bylandt: €5.000-25.000 strijdig met bron (meeste giften ca. €2.500)
update public.subsidieregelingen set bedrag_min=null, bedrag_max=null, aanvraaglink='https://www.bylandtstichting.nl/aanvraag-indienen/', deadline_omschrijving='Doorlopend indienen via het online systeem; na ontvangst laat de stichting de behandeltermijn weten. De meeste giften liggen rond €2.500.' where id='7d7d5c32-1415-4c78-bbea-460d18a44ab5';
-- Mondriaan Aankopen
update public.subsidieregelingen set deadline_omschrijving='Doorlopend indienen; de behandeling duurt ongeveer 3 maanden en er is geen terugwerkende kracht.' where id='ba364470-39cf-4295-96bd-5a9513daba83';
-- Mondriaan Art Fair International
update public.subsidieregelingen set aanvraaglink='https://www.mondriaanfonds.nl/subsidie-aanvragen/regelingen/art-fair-international/', bedrag_min=1000, bedrag_max=9000, deadline_omschrijving='Beurs op de vaste lijst: uiterlijk 6 weken vóór de opening indienen; andere beurzen: uiterlijk 3 maanden vóór de opening.' where id='82ca4f7d-be32-4d64-a14d-0e7752de4a58';
-- Mondriaan Beschermd Cultuurgoed
update public.subsidieregelingen set aanvraaglink='https://www.mondriaanfonds.nl/subsidie-aanvragen/regelingen/bijdrage-beschermd-cultuurgoed/', deadline_omschrijving='Doorlopend indienen, minstens 3 maanden vóór de start van het project; geen terugwerkende kracht.' where id='9a2f92e4-280e-453f-903d-0eefe43040e9';
-- Mondriaan Collectiemobiliteit
update public.subsidieregelingen set deadline_omschrijving='Doorlopend indienen; de behandeling duurt ongeveer 3 maanden en er is geen terugwerkende kracht.' where id='789d40fc-ce8b-43f0-809b-50a5dbe6fe95';
-- Mondriaan Curator Beschouwer
update public.subsidieregelingen set aanvraaglink='https://www.mondriaanfonds.nl/subsidie-aanvragen/regelingen/curator-beschouwer/', bedrag_max=14880, deadline_omschrijving='Doorlopend indienen; de behandeling duurt ongeveer 3 maanden en er is geen terugwerkende kracht.' where id='694af83e-4b31-4f2f-8b0b-e21d7459b7b4';

-- 'Landelijk' fout bij gemeentelijke regelingen Amsterdam/Rotterdam/Utrecht (juiste regio in deel A toegevoegd)
delete from public.subsidieregeling_regios x using public.regios r where r.id=x.regio_id and r.naam='Landelijk' and x.subsidieregeling_id in ('c301f9c8-aacf-4a50-92f5-9fbc6a1f13fe','f739e389-e8fb-48ca-b092-8b9d20a7eeee','2ae395cd-0b92-4937-b695-9fc475ce1af5');
-- 'Regionaal' stond onterecht naast 'Landelijk' (LSBS particulieren, Mondriaan Aankopen)
delete from public.subsidieregeling_regios x using public.regios r where r.id=x.regio_id and r.naam='Regionaal' and x.subsidieregeling_id in ('f980d121-0cbb-4856-ac52-b853f42c29fb','ba364470-39cf-4295-96bd-5a9513daba83');

-- Op verzoek verwijderd: Huis van de Wijk Rotterdam (alleen 4 aangewezen stichtingen mogen aanvragen). Koppelingen en rondes gaan via ON DELETE CASCADE mee.
delete from public.subsidieregelingen where id='78a984e8-cba7-401f-a39d-f3f659bde19b' and naam='Subsidie Huis van de Wijk';
-- Dubbel record: zelfde regeling van de M.A.O.C. Gravin van Bylandt Stichting (KvK 41149358) staat ook onder 7d7d5c32 (die blijft).
-- NOG NIET UITGEVOERD: delete from public.subsidieregelingen where id='4858f6e1-1435-4c39-a7f4-e8754ea02711' and naam='Reguliere aanvraag';

update public.subsidieregelingen set status_laatst_gecheckt=now() where id in ('0843ecc3-9f83-4a2c-82c4-2c59df543ae6','0aa9c69c-0b97-4240-8592-93452949ccff','2ae395cd-0b92-4937-b695-9fc475ce1af5','34e22a6b-a84c-4874-aa27-757b0c2e9aa7','510c9bae-260e-4741-b4e9-7752d196cb80','5774d2da-d36b-4c38-ae6f-0e2f2024c798','694af83e-4b31-4f2f-8b0b-e21d7459b7b4','6e3a142b-1e03-4e54-860a-065241bdae56','6eca740b-282a-4503-9562-f1d02633ebd1','789d40fc-ce8b-43f0-809b-50a5dbe6fe95','78f0030a-1d70-4949-b7cb-aefe1a16184f','7d7d5c32-1415-4c78-bbea-460d18a44ab5','82ca4f7d-be32-4d64-a14d-0e7752de4a58','905ba616-56db-4542-8dc5-1a35f65b5a16','98945b51-fbd4-43eb-83ac-74e0e55ba9cc','9a2f92e4-280e-453f-903d-0eefe43040e9','9aad98e0-c3bd-4a24-808a-c637682f50a8','abd62f84-5b8e-4fba-8ca4-eb3a92163237','b615da28-d5c7-402c-a69c-37688a5b8125','ba364470-39cf-4295-96bd-5a9513daba83','bcd023a3-337a-468d-b703-f4fcb40852c2','c1b2ba81-267c-4150-98a0-922587c67ac3','c301f9c8-aacf-4a50-92f5-9fbc6a1f13fe','ce274c27-290b-43f6-a6e6-944a62dc58fd','d19a390d-f754-42eb-9192-b23e589774d0','e6495b23-38f1-433c-a1e8-6b0a639e53dc','f739e389-e8fb-48ca-b092-8b9d20a7eeee','f980d121-0cbb-4856-ac52-b853f42c29fb','fdde9267-3388-4a21-b61b-60eabf4a1483');

commit;
