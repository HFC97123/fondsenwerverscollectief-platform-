-- UITGEVOERD 11-10-2026 door Claude via Supabase execute_sql (per batch als één statement met CTE's, inhoudelijk identiek aan dit bestand).
-- Deadline-/classificatiereview batch 2 (30 regelingen open/doorlopend zonder toekomstige datum), DEEL B: updates + verwijderen van aantoonbaar foute koppelingen.
-- Uitvoeren in Supabase > SQL Editor. Idempotent. Bronnen bekeken 11-10-2026 (zie batchrapport).
-- Bedragen uit de eigen database blijven staan, behalve waar de bron aantoonbaar iets anders zegt.
begin;

-- AFK Projectsubsidies: was open, max 17.500 (cat. 4 heeft geen maximum)
update public.subsidieregelingen set status='doorlopend', bedrag_max=null, deadline_omschrijving='Het hele jaar indienen. Categorie 1-2: maandelijkse loting om een behandelplek; categorie 3-4: op volgorde van binnenkomst tot het halfjaarlijkse plafond bereikt is.' where id='6a24b05a-3f83-447f-a104-ebc2360e0534';
-- AFK Cultuurcoach: was open
update public.subsidieregelingen set status='gesloten', deadline_omschrijving='Eenmalige indienperiode (november 2024) voor de subsidieperiode juli 2025 t/m december 2028. Geen nieuwe ronde aangekondigd.' where id='89f64fd4-fedb-4cfa-8e95-90dc717ff37b';
-- AFK Ontwikkeling: was open
update public.subsidieregelingen set status='gesloten', bedrag_max=125000, deadline_omschrijving='De ronde van 2026 is gesloten. Volgens de regeling is in 2027 nog een aanvraag mogelijk voor activiteiten in 2028; data nog niet gepubliceerd.' where id='035e22ba-5025-41ed-8fb7-f1bbf3f9092b';
-- AFK Werkruimte: was open
update public.subsidieregelingen set status='gesloten', deadline_omschrijving='Eén aanvraagronde per jaar. De ronde voor 2027 liep van 29 september t/m 1 oktober 2026 en is gesloten; daarna bepaalt loting de volgorde.' where id='b5c311fe-495f-4774-b807-9b8479c072ff';
-- AFK Cultuurmakers: was open, oude slug 2025-2026
update public.subsidieregelingen set status='gesloten', aanvraaglink='https://www.amsterdamsfondsvoordekunst.nl/aanvragen/tweejarige-subsidies-cultuurmakers-2027-2028/', deadline_omschrijving='Aanvragen voor 2027-2028 moesten vóór 30 september 2026, 16:00 uur binnen zijn. Een volgende ronde is niet aangekondigd.' where id='b71a3771-595f-4e2f-a592-3e3cd340381c';
-- EU4Belarus: was open, deadline verlopen
update public.subsidieregelingen set status='gesloten', deadline_omschrijving='De call 2026 sloot op 21 september 2026, 13:00 uur (Vilnius). Een nieuwe call is niet aangekondigd.' where id='8d485eef-4a6b-4d38-ab7f-2bf40e1e8f7f';
-- FCP Co-creatie: recordtekst zegt doorlopend t/m 31-8-2028 (bron niet leesbaar)
update public.subsidieregelingen set status='doorlopend' where id='740ea244-59fd-4202-8252-272c9c8875b5';
-- FCP Talentontwikkeling: was open, deadline 30-9 verlopen
update public.subsidieregelingen set status='gesloten', deadline_omschrijving='Twee indienperiodes per jaar (maart en september). De septemberronde van 2026 is gesloten.' where id='45941258-4f67-4aac-ab10-62bc47f925b4';
-- FPK Concoursen
update public.subsidieregelingen set status='gesloten', aanvraaglink='https://fondspodiumkunsten.nl/subsidies/internationale-concoursen-2025-2028', bedrag_max=40000, deadline_omschrijving='Gesloten. Er was één aanvraagmoment voor de periode 2025-2028; binnen deze periode is geen nieuwe ronde aangekondigd.' where id='b98f373c-5e12-4731-b3ba-d0eb2663a68c';
-- FPK Coproducties: was 24-9 (moet 23-9)
update public.subsidieregelingen set status='gesloten', deadline_datum='2026-09-23', deadline_omschrijving='Vier rondes per jaar. Alle rondes van 2026 zijn gesloten (laatste deadline 23 september 2026). Fonds Podiumkunsten publiceert de deadlines voor 2027 in november 2026.' where id='a73fa8b6-21ee-4b9f-9ab5-fb4ccb23ef77';
-- FPK Werkreis
update public.subsidieregelingen set status='doorlopend', aanvraaglink='https://fondspodiumkunsten.nl/subsidies/internationale-werkreis-voor-individuen', bedrag_max=4000, deadline_omschrijving='Doorlopend open zolang er budget is. Aanvragen vanaf 16 weken en uiterlijk 4 weken vóór de eerste activiteit.' where id='ba20b09e-b299-4e0e-ad3d-eb8abbd7d698';
-- FPK Investeringsregeling
update public.subsidieregelingen set status='doorlopend', aanvraaglink='https://fondspodiumkunsten.nl/subsidies/investeringsregeling-vrije-producties', bedrag_max=500000, deadline_omschrijving='Doorlopend open zolang er budget is. De première valt tussen 6 maanden en 2 jaar na de aanvraag.' where id='b855f26b-b00d-4d6e-b3fb-27d0b88a72b8';
-- FPK Snelloket: geen rondes; €6.000 was Europa-plafond, geen minimum
update public.subsidieregelingen set status='doorlopend', deadline_datum=null, bedrag_min=null, aanvraaglink='https://fondspodiumkunsten.nl/subsidies/snelloket', deadline_omschrijving='Doorlopend open zolang er budget is. Aanvragen tussen 4 maanden en 1 maand vóór het eerste optreden in het buitenland; max. €6.000 binnen Europa, €10.000 daarbuiten.' where id='858e1714-2d35-43e3-90f6-001ea496065a';
-- FPK Ontwikkelbeurs: in herziening
update public.subsidieregelingen set status='gesloten', aanvraaglink='https://fondspodiumkunsten.nl/subsidies/ontwikkelbeurs-muziekauteur', deadline_omschrijving='Nu niet aan te vragen; de regeling wordt per 1 januari 2027 herzien. Fonds Podiumkunsten publiceert de rondes voor 2027 naar verwachting in november 2026.' where id='6f733414-a56f-465c-822b-fad8140ab45c';
-- FPK Opdracht compositie: in herziening
update public.subsidieregelingen set status='gesloten', aanvraaglink='https://fondspodiumkunsten.nl/subsidies/opdracht-compositie-of-libretto', deadline_omschrijving='Nu niet aan te vragen; de regeling wordt per 1 januari 2027 herzien. De rondes voor 2027 worden naar verwachting in november 2026 gepubliceerd.' where id='30c51a4d-9351-4d5b-a052-67cfa884a51c';
-- FPK Podiumregeling
update public.subsidieregelingen set status='gesloten', aanvraaglink='https://fondspodiumkunsten.nl/subsidies/podiumregeling', deadline_omschrijving='Gesloten. Aanvragen voor de periode juli 2025 t/m juni 2029 moesten uiterlijk 2 oktober 2024 binnen zijn.' where id='197aaf18-3c3d-4698-9835-5dcb1fcdbb92';
-- FPK Productiesubsidie
update public.subsidieregelingen set status='gesloten', aanvraaglink='https://fondspodiumkunsten.nl/subsidies/productiesubsidie', bedrag_max=105000, deadline_omschrijving='Meerdere rondes per jaar. De rondes van 2026 zijn gesloten; Fonds Podiumkunsten publiceert de deadlines voor 2027 in november 2026.' where id='2f1e4ecc-66da-4f74-9df1-e38db1ce0d7c';
-- FPK Programma- en presentatiebijdrage
update public.subsidieregelingen set status='gesloten', aanvraaglink='https://fondspodiumkunsten.nl/subsidies/programma-en-presentatiebijdrage', bedrag_max=10000, deadline_omschrijving='In 2026 niet aan te vragen. De huidige subsidieperiode loopt van juli 2026 t/m juni 2028.' where id='2b5d9200-b0e6-4ba5-8a2c-8af79b0d602a';
-- FPK Internationale promotie: '4 rondes/24-9' hoorde bij andere regeling
update public.subsidieregelingen set status='gesloten', deadline_datum=null, deadline_omschrijving='Eén ronde per jaar in twee fasen. In 2026 liep fase 1 van 7 april t/m 20 mei; fase 2 (op uitnodiging) sloot 26 augustus. De ronde van 2027 is nog niet bekendgemaakt.' where id='cbb50dac-60e8-4aaa-96f6-9e37cb798ff9';
-- FPK Urban: loket gesloten
update public.subsidieregelingen set status='budget_uitgeput', aanvraaglink='https://fondspodiumkunsten.nl/subsidies/programma-urban-projecten', deadline_omschrijving='Doorlopend aan te vragen zolang er budget is. Voor 2026 is het loket gesloten; heropening is nog niet aangekondigd.' where id='a45180d4-ecbe-4df4-9ebb-6dc109580763';
-- FPK Reeks opdrachten
update public.subsidieregelingen set status='gesloten', aanvraaglink='https://fondspodiumkunsten.nl/subsidies/reeks-opdrachten-compositie-of-libretto', bedrag_max=100000, deadline_omschrijving='De regeling opent eens per twee jaar. Volgens het fonds opent de volgende ronde in het voorjaar van 2027, voor plannen in 2028-2029; de exacte datum is nog niet bekend.' where id='e41ea7ba-9917-456c-9a6f-71c619a39daa';
-- Regeling Interdisciplinair: penvoerder Mondriaan Fonds
update public.subsidieregelingen set status='gesloten', deadline_datum='2026-10-01', aanvraaglink='https://www.mondriaanfonds.nl/en/apply-for-a-grant/grants/interdisciplinary/', deadline_omschrijving='Twee rondes per jaar; aanvragen via het Mondriaan Fonds namens zes rijkscultuurfondsen. De ronde van 1 oktober 2026 is gesloten; de volgende datum is nog niet bekend.' where id='e245c806-6c4f-499f-8228-5009421a81b4';
-- FPK Muziekhubs
update public.subsidieregelingen set status='doorlopend', aanvraaglink='https://fondspodiumkunsten.nl/subsidies/regeling-voor-muziekhubs-caribisch-deel-van-het-koninkrijk', bedrag_max=40000, deadline_omschrijving='Het hele jaar aan te vragen zolang er budget is.' where id='27910578-f101-4ecf-8eb0-1222b82fed5e';
-- FPK Slecht Weer Fonds
update public.subsidieregelingen set status='doorlopend', aanvraaglink='https://fondspodiumkunsten.nl/subsidies/slecht-weer-fonds', deadline_omschrijving='Geen deadline; aanvragen kan wanneer een festival een tekort heeft door onvoorziene weersomstandigheden.' where id='953082f4-f5e5-4fed-9fb0-1f5dc31dea91';
-- FPK Upstream: Music
update public.subsidieregelingen set status='budget_uitgeput', aanvraaglink='https://fondspodiumkunsten.nl/subsidies/upstream-music', deadline_omschrijving='Doorlopend aan te vragen zolang er budget is. Het budget voor 2026 is op; medio november 2026 maakt het fonds bekend wanneer de regeling weer opengaat.' where id='b2fe8cca-db1e-4644-a764-ad68d4d7fc67';
-- FPK Werkbijdrage theatertekst
update public.subsidieregelingen set status='gesloten', aanvraaglink='https://fondspodiumkunsten.nl/subsidies/werkbijdrage-theatertekst', deadline_omschrijving='Eén aanvraagronde per jaar (samen met het Nederlands Letterenfonds). De datum van de volgende ronde is nog niet bekendgemaakt.' where id='56de5502-29c8-4370-a538-a2eb79ab9224';
-- Fonds21 Power of Community: eenmalige pilot
update public.subsidieregelingen set status='gesloten', aanvraaglink='https://fonds21.nl/loket/onze-pijlers/jongeren-maatschappij/power-of-community/', deadline_omschrijving='Gesloten. De deadline was 20 september 2026, 23:59 uur. Een nieuwe ronde is niet aangekondigd.' where id='b6049cfd-0635-4ec9-9eab-f8b697f9557a';
-- Schiermonnikoog: ASV 2025 vervallen per 2-5-2026
update public.subsidieregelingen set status='doorlopend', naam='Algemene Subsidieverordening Schiermonnikoog 2026', aanvraaglink='https://lokaleregelgeving.overheid.nl/CVDR761250', deadline_omschrijving='Jaarsubsidie: uiterlijk 1 september van het jaar vóór het subsidiejaar. Eenmalige subsidie: uiterlijk 8 weken vóór de start van de activiteit.' where id='da83e10e-9eea-4d97-ad80-c109309c5f31';

-- Werkgebied 'Landelijk' was fout bij 4 AFK-regelingen (Amsterdam), Muziekhubs (Caribisch deel) en Schiermonnikoog; vervanging is in deel A al toegevoegd
delete from public.subsidieregeling_regios x using public.regios r
 where r.id = x.regio_id and r.naam = 'Landelijk' and x.subsidieregeling_id in ('6a24b05a-3f83-447f-a104-ebc2360e0534','035e22ba-5025-41ed-8fb7-f1bbf3f9092b','b5c311fe-495f-4774-b807-9b8479c072ff','b71a3771-595f-4e2f-a592-3e3cd340381c','27910578-f101-4ecf-8eb0-1222b82fed5e','da83e10e-9eea-4d97-ad80-c109309c5f31');

-- Controledatum voor de hele batch (30 regelingen)
update public.subsidieregelingen set status_laatst_gecheckt=now() where id in ('6a24b05a-3f83-447f-a104-ebc2360e0534','89f64fd4-fedb-4cfa-8e95-90dc717ff37b','035e22ba-5025-41ed-8fb7-f1bbf3f9092b','b5c311fe-495f-4774-b807-9b8479c072ff','b71a3771-595f-4e2f-a592-3e3cd340381c','5e82f286-f7cb-4d36-aad1-d7c6d7c252dd','8d485eef-4a6b-4d38-ab7f-2bf40e1e8f7f','3731df51-c602-484d-9b93-653d90382e27','740ea244-59fd-4202-8252-272c9c8875b5','45941258-4f67-4aac-ab10-62bc47f925b4','b98f373c-5e12-4731-b3ba-d0eb2663a68c','a73fa8b6-21ee-4b9f-9ab5-fb4ccb23ef77','ba20b09e-b299-4e0e-ad3d-eb8abbd7d698','b855f26b-b00d-4d6e-b3fb-27d0b88a72b8','858e1714-2d35-43e3-90f6-001ea496065a','6f733414-a56f-465c-822b-fad8140ab45c','30c51a4d-9351-4d5b-a052-67cfa884a51c','197aaf18-3c3d-4698-9835-5dcb1fcdbb92','2f1e4ecc-66da-4f74-9df1-e38db1ce0d7c','2b5d9200-b0e6-4ba5-8a2c-8af79b0d602a','cbb50dac-60e8-4aaa-96f6-9e37cb798ff9','a45180d4-ecbe-4df4-9ebb-6dc109580763','e41ea7ba-9917-456c-9a6f-71c619a39daa','e245c806-6c4f-499f-8228-5009421a81b4','27910578-f101-4ecf-8eb0-1222b82fed5e','953082f4-f5e5-4fed-9fb0-1f5dc31dea91','b2fe8cca-db1e-4644-a764-ad68d4d7fc67','56de5502-29c8-4370-a538-a2eb79ab9224','b6049cfd-0635-4ec9-9eab-f8b697f9557a','da83e10e-9eea-4d97-ad80-c109309c5f31');

commit;
