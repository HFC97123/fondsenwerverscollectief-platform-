-- UITGEVOERD 11-10-2026 door Claude via Supabase execute_sql (per batch als één statement met CTE's, inhoudelijk identiek aan dit bestand).
-- Deadline-/classificatiereview batch 1, DEEL B: updates en het verwijderen van aantoonbaar foute koppelingen.
-- Uitvoeren in Supabase > SQL Editor. Idempotent (opnieuw draaien verandert niets).
-- Bronnen bekeken 11-10-2026; per regeling staat de officiële bron in het batchrapport.
-- Bedragen uit de eigen (Excel-)database blijven staan, behalve bij BPD (min > max, aantoonbaar fout).
begin;

-- 1. Feitelijke velden (alleen waar de officiële bron het bevestigt)
update public.subsidieregelingen set aanvraaglink='https://www.filmfonds.nl/subsidies/subsidie/realisering-speelfilm-en-lange-animatiefilm' where id='fccfe4a6-fc96-495e-a079-fe129180072e';
update public.subsidieregelingen set aanvraaglink='https://orlandagoban.nl/aanvraag-donatieformulier/' where id='e3afdb6f-a2dd-41a4-8b4a-d6c5490512ae';
-- Onze Democratie: was "binnenkort / 15-10-2026 / twee rondes per jaar" -> bron: doorlopend t/m €50k, vaste deadlines vanaf €50k
update public.subsidieregelingen set status='doorlopend', deadline_datum='2027-01-14', aanvraaglink='https://www.vfonds.nl/aanvraag-doen/democratie/onze-democratie',
  deadline_omschrijving='Aanvragen tot €50.000: het hele jaar door. Vanaf €50.000 vaste deadlines: 14 januari, 18 maart, 17 juni en 30 september 2027. Indienen minimaal 3 maanden vóór de start van het project.'
  where id='d830eedc-90e5-4b1f-aa85-0fda6cccb5fc';
update public.subsidieregelingen set deadline_datum='2026-10-28',
  deadline_omschrijving='Najaarsronde sluit 28 oktober 2026, 18:00 uur. Volgende rondes: 21 april 2027 en 13 oktober 2027 (18:00 uur).'
  where id='443e43c8-7d38-456b-a0e8-56ae5d159f0e';
-- Klauterkooi: was "aangekondigd / 31-10" -> bron: open, indienen vóór 31 oktober
update public.subsidieregelingen set status='open', deadline_datum='2026-10-30', deadline_omschrijving='Aanvraag indienen vóór 31 oktober 2026 via het aanvraagportaal.' where id='5470d589-2d3d-48a1-b833-54a8a82d743c';
update public.subsidieregelingen set status='open' where id='ee50c277-b2c4-4b58-b755-def72c657265';
update public.subsidieregelingen set deadline_omschrijving='Aanvragen kan t/m 30 november 2026; aanvragen worden doorlopend beoordeeld. In de komende 2,5 jaar volgen meer aanvraagrondes.' where id='bdc35e0f-3b63-42b3-89a8-597c65a2ef19';
-- ADPP: was "binnenkort / 10-12-2026 (GESCHAT)" -> geen officiële call
update public.subsidieregelingen set status='gesloten', deadline_datum=null, aanvraaglink='https://www.arabculturefund.org/Programs/17',
  deadline_omschrijving='Vorige oproep liep van 10 oktober t/m 10 december 2025. Een nieuwe oproep is nog niet gepubliceerd.' where id='d7e63c2b-402e-4b68-b9ec-e1fc983f9f45';
-- Karl Kahane: was "binnenkort / 11-12-2026 (GESCHAT)" -> fundingpagina: geen nieuwe, ongevraagde aanvragen
update public.subsidieregelingen set status='gesloten', deadline_datum=null,
  deadline_omschrijving='Momenteel worden geen nieuwe, ongevraagde aanvragen in behandeling genomen; de cyclus voorjaar/zomer 2026 stond alleen open voor bestaande partners op uitnodiging.' where id='8bdad673-21f3-4c20-8b9f-e30821b815c2';
update public.subsidieregelingen set deadline_omschrijving='Ronde 5: 19 september t/m 31 oktober 2026 (uitslag 16 november). Ronde 6: 1 november t/m 14 december 2026 (uitslag 6 januari 2027).' where id='d1d4b5b1-1f60-4a4e-bfc7-62d75c35713c';
-- Impulssubsidie cultuur Utrecht: was "doorlopend / 31-12-2026" -> loket: budget 2026 op, weer vanaf 1-1-2027
update public.subsidieregelingen set status='budget_uitgeput', deadline_datum=null, aanvraaglink='https://loket.digitaal.utrecht.nl/nl/producten/impulssubsidie-cultuur-aanvragen',
  deadline_omschrijving='Het budget voor 2026 is op. Nieuwe aanvragen zijn weer mogelijk vanaf 1 januari 2027.' where id='79654d05-8820-457b-bceb-252687be9672';
update public.subsidieregelingen set aanvraaglink='https://www.denhaag.nl/nl/subsidies/subsidie-makersregeling-aanvragen/' where id='b022f4ad-241c-4d44-bdc0-98d899ac7ac5';
update public.subsidieregelingen set aanvraaglink='https://loket.digitaal.utrecht.nl/nl/products/vrijwillige-inzet-voor-elkaar-subsidie-aanvragen' where id='8bd2b373-c2ec-400a-94d8-f42b9acf6d58';
update public.subsidieregelingen set aanvraaglink='https://www.denhaag.nl/nl/subsidies/subsidie-muurschildering-aanvragen/' where id='f3db2057-e027-4e0b-953b-712cedfe0c05';
-- Prince Claus (4x): geschatte datums waren niet officieel -> null; geen open call
update public.subsidieregelingen set status='gesloten', deadline_datum=null,
  deadline_omschrijving='De open call voor de Seed Awards 2026 is gesloten (deadline was 8 januari 2026). Een nieuwe call is nog niet aangekondigd.' where id='0e7e7ede-b201-402d-b497-bf813aa6e847';
update public.subsidieregelingen set status='gesloten', deadline_datum=null,
  deadline_omschrijving='Er is momenteel geen open call; een nieuwe call is nog niet aangekondigd.' where id in ('556fc1a8-ca7e-4dc2-969a-953ddf514895','a6732788-d9ce-4546-87ba-8c0032e80152','db69a666-cb49-4733-b225-e8f5a16d8ce2');
update public.subsidieregelingen set aanvraaglink='https://lsbs.nl/aanvragen',
  deadline_omschrijving='Aanvragen voor buitenlandse projecten worden eenmaal per jaar behandeld; deadline 15 januari, besluit in februari/maart.' where id='bbc53946-9b6e-4bde-a1f5-615971fc1af7';
update public.subsidieregelingen set aanvraaglink='https://www.nldoet.nl/financiele-bijdrage',
  deadline_omschrijving='Financiële bijdrage aanvragen van 2 november 2026 t/m 31 januari 2027 (zolang er budget is), voor NLdoet op 19 en 20 maart 2027.' where id='3dac1ac7-6260-469d-a654-f2e131d102a1';
-- BPD: was bedrag_min 250000 > bedrag_max 100000 (fout) -> reglement 2025-2026: geen minimum, richtlijn max €70.000 excl. btw
update public.subsidieregelingen set deadline_datum='2026-12-01', bedrag_min=null, bedrag_max=70000,
  deadline_omschrijving='Indienen tot 1 december 2026, 12:00 uur (beoordeling 17 maart 2027). Daarna: 1 april 2027, 12:00 uur (beoordeling 8 juli 2027).' where id='a6101b87-71cf-4a0b-8803-f1454a2f972a';

-- 2. Geschatte (niet-officiële) rondes buiten gebruik zetten: niet verwijderd, wel gemarkeerd
update public.subsidieregeling_rondes
   set actief=false,
       toelichting='GEDEACTIVEERD 11-10-2026 (deadlinereview batch 1): sluitingsdatum was een schatting, geen officiële datum. ' || coalesce(toelichting,'')
 where id in ('42fdf7c4-682a-40ec-a0b2-6bf77d69e4d8','d6d7a81a-6e25-42ab-9697-082b64c9b1c0','7d483ec9-9b5f-4aef-b952-7a9e94e74c72','415c9f4e-09f7-4a76-b859-4cd42809fa66','b63c722e-e3ab-4383-9269-39bb6cd05bfd','54a0f474-9f60-43fe-82a1-ff1d4c52860d')
   and actief;

-- 3. Aantoonbaar foute werkgebieden verwijderen (vervanging is in deel A al toegevoegd)
--    gemeentelijke regelingen stonden op "Landelijk"; Prince Claus "Zuid-Amerika" -> Latijns-Amerika;
--    ADPP/Karl Kahane "Azië" -> Midden-Oosten; Dinamo Fonds "Regionaal" (landelijk fonds).
delete from public.subsidieregeling_regios x using public.regios r
 where r.id = x.regio_id and (
   (r.naam='Landelijk'   and x.subsidieregeling_id in ('79654d05-8820-457b-bceb-252687be9672','b022f4ad-241c-4d44-bdc0-98d899ac7ac5','8bd2b373-c2ec-400a-94d8-f42b9acf6d58','f3db2057-e027-4e0b-953b-712cedfe0c05')) or
   (r.naam='Zuid-Amerika' and x.subsidieregeling_id in ('0e7e7ede-b201-402d-b497-bf813aa6e847','a6732788-d9ce-4546-87ba-8c0032e80152','db69a666-cb49-4733-b225-e8f5a16d8ce2')) or
   (r.naam='Azië'        and x.subsidieregeling_id in ('d7e63c2b-402e-4b68-b9ec-e1fc983f9f45','8bdad673-21f3-4c20-8b9f-e30821b815c2')) or
   (r.naam='Regionaal'   and x.subsidieregeling_id = 'b9a8d9ea-60b2-4453-bcca-21810ce6e049'));

-- 4. Controledatum voor de hele batch (27 regelingen)
update public.subsidieregelingen set status_laatst_gecheckt=now() where id in (
 'fccfe4a6-fc96-495e-a079-fe129180072e','e3afdb6f-a2dd-41a4-8b4a-d6c5490512ae','c6973445-6b87-41b9-bc83-1f004841fb3c','d830eedc-90e5-4b1f-aa85-0fda6cccb5fc','a96ff2f5-0180-44c3-96f4-445cb79fa45b','8b2afe1e-c747-4be2-ac68-6317abb45e04','443e43c8-7d38-456b-a0e8-56ae5d159f0e','5470d589-2d3d-48a1-b833-54a8a82d743c','ee50c277-b2c4-4b58-b755-def72c657265','73639383-acad-4e00-8c97-141ea3592989','bdc35e0f-3b63-42b3-89a8-597c65a2ef19','d7e63c2b-402e-4b68-b9ec-e1fc983f9f45','8bdad673-21f3-4c20-8b9f-e30821b815c2','d1d4b5b1-1f60-4a4e-bfc7-62d75c35713c','79654d05-8820-457b-bceb-252687be9672','b022f4ad-241c-4d44-bdc0-98d899ac7ac5','8bd2b373-c2ec-400a-94d8-f42b9acf6d58','f3db2057-e027-4e0b-953b-712cedfe0c05','0e7e7ede-b201-402d-b497-bf813aa6e847','bbc53946-9b6e-4bde-a1f5-615971fc1af7','556fc1a8-ca7e-4dc2-969a-953ddf514895','3dac1ac7-6260-469d-a654-f2e131d102a1','a6732788-d9ce-4546-87ba-8c0032e80152','3ca1e7de-3bcc-4792-980a-ebadd6c85fff','b9a8d9ea-60b2-4453-bcca-21810ce6e049','db69a666-cb49-4733-b225-e8f5a16d8ce2','a6101b87-71cf-4a0b-8803-f1454a2f972a');

commit;
