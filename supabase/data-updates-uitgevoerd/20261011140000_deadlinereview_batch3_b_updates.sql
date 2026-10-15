-- UITGEVOERD 11-10-2026 door Claude via Supabase execute_sql (per batch als één statement met CTE's, inhoudelijk identiek aan dit bestand).
-- Deadline-/classificatiereview batch 3, DEEL B: updates + verwijderen van aantoonbaar foute koppelingen.
-- Uitvoeren in Supabase > SQL Editor. Idempotent. Bronnen bekeken 11-10-2026 (zie rapport).
begin;

-- CO2-compensatiefonds Wagenborg (fonds van Wagenborg Passagiersdiensten)
update public.subsidieregelingen set deadline_datum='2026-10-23', aanvraaglink='https://www.wpd.nl/co2compensatiefonds', deadline_omschrijving='Aanvragen t/m 23 oktober 2026 via het formulier van Wagenborg; uitslag in december 2026. Alleen voor projecten op Ameland of Schiermonnikoog.' where id='a277bd6d-0756-4474-a831-002f2d5dcc3f';
-- IMF: regeling van Provincie Fryslân (funderkoppeling Gemeente Schiermonnikoog is fout, niet gewijzigd)
update public.subsidieregelingen set status='gesloten', naam='Iepen Mienskipsfûns (IMF)', aanvraaglink='https://www.fryslan.frl/imfaanvragen', bedrag_max=50000, deadline_omschrijving='De tweede ronde van 2026 sloot op 8 oktober 2026. Volgens de provincie loopt de volgende ronde van 15 maart t/m 8 april 2027.' where id='145fbfbb-32b2-4c7c-bac0-9955881c1365';
-- Den Haag inclusief samenleven: €5.000 was maximum voor particulieren, geen minimum
update public.subsidieregelingen set status='gesloten', bedrag_min=null, aanvraaglink='https://www.denhaag.nl/nl/subsidies/subsidie-inclusief-samenleven-aanvragen/', deadline_omschrijving='Momenteel niet aan te vragen; de regeling voor 2027 wordt herzien. Projectsubsidie minimaal 12 weken vóór de start aanvragen.' where id='2eb898c7-d1cf-4e24-8e7b-88f1c3b5c5b8';
-- Den Haag Samen sociaal en vitaal
update public.subsidieregelingen set status='aangekondigd', deadline_datum=null, bedrag_max=15000, aanvraaglink='https://www.denhaag.nl/nl/subsidies/subsidie-samen-sociaal-en-vitaal-aanvragen/', deadline_omschrijving='Gesloten voor 2026. Vanaf 5 januari 2027 kunnen projecten tot €15.000 worden aangevraagd, zolang er budget is.' where id='4ddc51b5-ff16-4d00-9500-6ffe226ee309';
-- Rotterdam Huis van de Wijk: gesloten kring aanvragers
update public.subsidieregelingen set status='gesloten', aanvraaglink='https://www.rotterdam.nl/subsidie-huis-van-de-wijk-aanvragen', deadline_omschrijving='Jaarlijks vóór 1 oktober, voor het volgende jaar. Alleen voor vier aangewezen stichtingen met een Huis van de Wijk in zelfbeheer.' where id='78a984e8-cba7-401f-a39d-f3f659bde19b';
-- Utrecht Amateurkunst
update public.subsidieregelingen set status='gesloten', bedrag_max=3300, aanvraaglink='https://loket.digitaal.utrecht.nl/nl/producten/amateurkunst-subsidie-aanvragen', deadline_omschrijving='Jaarlijks aanvragen vanaf juli, uiterlijk vóór 1 oktober 17:00 uur. De ronde van 2026 is gesloten.' where id='6ebda98d-2fb2-4165-ad26-9fc894e72a2d';
-- Utrecht Broedplaats
update public.subsidieregelingen set status='doorlopend', aanvraaglink='https://loket.digitaal.utrecht.nl/nl/producten/culturele-broedplaats-maakplek-subsidie-aanvragen-gemeente', deadline_omschrijving='Doorlopend aanvragen, vóór de start van de activiteiten; besluit binnen 13 weken.' where id='bdbe26b1-bf39-4c57-a2f4-c5e1b4c20bc1';
-- Utrecht Projectsubsidie cultuur: vaste data in nadere regel
update public.subsidieregelingen set deadline_datum='2027-02-05', aanvraaglink='https://loket.digitaal.utrecht.nl/nl/producten/projectsubsidie-cultuur-aanvragen', deadline_omschrijving='Drie rondes per jaar: 5 februari, 25 mei en 25 september (17:00 uur). Volgende deadline: 5 februari 2027.' where id='2a25042e-50c5-459a-ae7f-286dc6724ac7';
-- Muller Studiebeurs
update public.subsidieregelingen set deadline_datum='2026-11-01', aanvraaglink='https://www.mullerfonds.nl/studiebeurs.php', deadline_omschrijving='Master/PhD: uiterlijk 1 november 2026 (start jan/feb 2027) of 31 maart 2027 (start sep/okt 2027). Stage of onderzoek: doorlopend, minimaal 3 maanden vóór vertrek.' where id='dcb372f0-d7c3-4d31-88ff-974ee1e1fd19';
-- Janivo
update public.subsidieregelingen set status='gesloten', aanvraaglink='https://www.janivostichting.nl/wetenschappelijk-medisch-onderzoek/', deadline_omschrijving='De ronde van 2026 is gesloten (18 september 2026); toekenning in december.' where id='63b169df-92bb-4357-ad76-f583e7b95a87';
-- Laméris
update public.subsidieregelingen set status='gesloten', aanvraaglink='https://stichtinglamerisfoundation.nl/schenking-aanvragen', deadline_omschrijving='Indienen uiterlijk 2 weken vóór een bestuursvergadering. De vergaderingen van 2026 zijn geweest; de data voor 2027 zijn nog niet bekend.' where id='8b7d5f83-5cb5-4181-9fcf-604a70873a05';
-- Mondriaan Erfgoed Innovatie
update public.subsidieregelingen set status='gesloten', deadline_omschrijving='Twee indienmomenten per jaar (in 2026: 26 maart en 17 september, 16:00 uur). De data voor 2027 zijn nog niet bekend.' where id='e0675b1b-9c0e-47d5-a0ad-9700aeb50895';
-- Interdisciplinair Individu
update public.subsidieregelingen set status='gesloten', bedrag_min=24900, bedrag_max=24900, aanvraaglink='https://www.mondriaanfonds.nl/subsidie-aanvragen/regelingen/interdisciplinair/', deadline_omschrijving='Twee indienmomenten per jaar; de laatste was 1 oktober 2026 (16:00 uur). De data voor 2027 zijn nog niet bekend.' where id='5d540610-ff3a-4ddc-8653-68b32971a6a2';
-- Interdisciplinair Organisatie
update public.subsidieregelingen set status='gesloten', bedrag_min=12500, bedrag_max=50000, aanvraaglink='https://www.mondriaanfonds.nl/subsidie-aanvragen/regelingen/interdisciplinair/', deadline_omschrijving='Twee indienmomenten per jaar; de laatste was 1 oktober 2026 (16:00 uur). De data voor 2027 zijn nog niet bekend.' where id='5f398d46-8a59-4885-b364-a7c973ee610b';
-- Mondriaan Residency (naam aangepast naar officiële naam)
update public.subsidieregelingen set status='gesloten', naam='Residency', aanvraaglink='https://www.mondriaanfonds.nl/subsidie-aanvragen/regelingen/residency/', deadline_omschrijving='Eén deadline per jaar, eind augustus, voor werkperiodes in het jaar daarop. De laatste was 27 augustus 2026.' where id='abe03f74-c7cb-443a-899a-153dcc4e7128';
-- Filmfonds Filmfestival
update public.subsidieregelingen set status='gesloten', bedrag_max=70000, aanvraaglink='https://www.filmfonds.nl/subsidies/subsidie/filmfestival', deadline_omschrijving='Drie rondes per jaar (in 2026: 3 februari, 12 mei en 6 oktober, 17:00 uur). De data voor 2027 zijn nog niet bekend.' where id='85302b50-f06e-4980-943a-ae0743c658c0';
-- Letterenfonds makers van boeken: €11.000-55.000 fout, vaste bedragen €15.000-40.000
update public.subsidieregelingen set status='gesloten', bedrag_min=15000, bedrag_max=40000, aanvraaglink='https://www.letterenfonds.nl/subsidies/projectsubsidies-voor-makers-van-boeken', deadline_omschrijving='Meerdere rondes per jaar (in 2026: 15 januari, 2 maart, 15 april en 1 september). De data voor 2027 zijn nog niet bekend.' where id='793861e8-3e74-4cb3-88bc-29a79c4be9b7';
-- Letterenfonds Schwob
update public.subsidieregelingen set status='gesloten', bedrag_max=7000, aanvraaglink='https://www.letterenfonds.nl/subsidies/schwob', deadline_omschrijving='Twee rondes per jaar (in 2026: 5 februari en 5 september); alleen voor uitgeverijen. De data voor 2027 zijn nog niet bekend.' where id='0b90eae2-42f7-43d5-a140-2308467e95de';
-- Buurtcultuurfonds Noord-Brabant
update public.subsidieregelingen set deadline_datum='2026-11-02', bedrag_max=10000, aanvraaglink='https://www.cultuurfonds.nl/fondsen/buurtcultuurfonds-provincie-noord-brabant', deadline_omschrijving='Volgende deadline 2 november 2026. In 2027: 1 februari, 19 april, 19 juli en 2 november.' where id='46ff6224-12fa-48b3-a0bf-1037b20333ba';
-- Buurtnatuur- en Buurtwaterfonds Noord-Brabant
update public.subsidieregelingen set deadline_datum='2026-11-02', bedrag_max=10000, aanvraaglink='https://www.cultuurfonds.nl/fondsen/buurtnatuur-en-buurtwaterfonds-noord-brabant', deadline_omschrijving='Volgende deadline 2 november 2026 (zolang er budget is). In 2027: 1 februari, 19 april, 19 juli en 2 november.' where id='de04d0f0-4c8f-404f-ab20-4ebba7c7db6b';
-- Fonds ZOZ onderzoek (ZOZ Academy)
update public.subsidieregelingen set deadline_datum='2026-10-15', bedrag_max=5000, aanvraaglink='https://www.cultuurfonds.nl/zoz-academy', deadline_omschrijving='Deadlines 2026: 15 oktober, 15 november en 1 december (23:59 uur). Eerst de Quickscan invullen, uiterlijk 10 werkdagen vóór de deadline.' where id='76216145-f596-4974-ab03-e63e1f605da1';
-- Open Call Cultuurparticipatie Zuid-Holland
update public.subsidieregelingen set status='gesloten', bedrag_min=1000, bedrag_max=15000, aanvraaglink='https://www.cultuurfonds.nl/aanvragen/open-call-cultuurparticipatie', deadline_omschrijving='De open call 2025-2026 is gesloten (laatste deadline 1 september 2026). Een vervolg is nog niet bekend.' where id='b372fa96-ad72-4100-942f-a3eb6a37bac7';
-- Schoolpleinen van de Toekomst (provinciale regeling Noord-Brabant)
update public.subsidieregelingen set status='budget_uitgeput', deadline_datum='2026-11-02', bedrag_max=10000, aanvraaglink='https://www.brabant.nl/loket/producten-diensten/buurtfonds-schoolpleinen-toekomst/', deadline_omschrijving='Aanvraagperiode 2026 (1 april t/m 2 november) staat formeel open, maar het budget voor 2026 is op.' where id='0433e8de-7872-4d33-9276-326a7050d903';
-- Armoedefonds
update public.subsidieregelingen set status='gesloten', deadline_omschrijving='Twee aanvraagrondes per jaar. De najaarsronde 2026 sloot op 18 september 2026.' where id='9e6341dd-942c-485d-80a2-44984de312ee';
-- FNO Klein Geluk (rondenummer uit naam)
update public.subsidieregelingen set status='aangekondigd', naam='Klein Geluk – Materialen, dagbesteding en evenementen', bedrag_max=20000, deadline_omschrijving='Call 9 is gesloten. De tiende call opent begin 2027; de exacte data zijn nog niet bekend.' where id='04250edf-b56d-4f38-9d75-eec45a9aa83b';
-- SGK Samen Dansen
update public.subsidieregelingen set status='gesloten', bedrag_min=1000, bedrag_max=1000, aanvraaglink='https://gehandicaptekind.nl/financiele-steun-voor-dansscholen', deadline_omschrijving='De ronde van 2026 (15 mei t/m 15 september) is gesloten. Een nieuwe ronde is nog niet aangekondigd.' where id='2c953c6e-ad0c-4a00-808e-1e0a85ae0475';
-- SGK Samen Opgroeien
update public.subsidieregelingen set status='gesloten', bedrag_min=1000, bedrag_max=10000, aanvraaglink='https://gehandicaptekind.nl/aanvraag-samen-opgroeien', deadline_omschrijving='De ronde van 2026 (vanaf februari, zolang er budget was, uiterlijk 1 oktober) is gesloten.' where id='7d609e58-11ce-43a5-9fed-a22f0f880d8e';
-- SGK Sociale inclusie op school
update public.subsidieregelingen set status='gesloten', bedrag_max=10000, aanvraaglink='https://gehandicaptekind.nl/financiele-bijdrage-voor-sociale-inclusie-in-het-onderwijs', deadline_omschrijving='De vooraanvraag voor schooljaar 2026-2027 sloot op 2 oktober 2026; alleen uitgenodigde aanvragers dienen een volledige aanvraag in.' where id='b68ac57e-50a5-44cf-a266-077147165404';
-- Van Rees-Klatte: '1 september' staat niet in bron
update public.subsidieregelingen set status='doorlopend', deadline_datum=null, aanvraaglink='https://www.vanreesklatte.nl/#aanvraag-donatie', deadline_omschrijving='Doorlopend: dien een vooraanvraag in via de website; reactie binnen 10 werkdagen. Voorkeur voor Den Haag en omgeving.' where id='6096f8a7-66c1-4ca3-a91a-ed29b654d555';
-- Stimuleringsfonds Festivals
update public.subsidieregelingen set status='gesloten', deadline_datum='2026-09-23', bedrag_max=85000, aanvraaglink='https://www.stimuleringsfonds.nl/subsidies/regeling-festivals-creatieve-industrie-2025-2028', deadline_omschrijving='Eén ronde per jaar. De ronde voor festivals in 2027 sloot op 23 september 2026.' where id='ac1f1e1a-8266-4ab6-a862-ff2ae6928161';

-- 12 gemeentelijke/provinciale regelingen stonden op 'Landelijk' (juiste regio is in deel A toegevoegd)
delete from public.subsidieregeling_regios x using public.regios r where r.id = x.regio_id and r.naam = 'Landelijk' and x.subsidieregeling_id in ('a277bd6d-0756-4474-a831-002f2d5dcc3f','145fbfbb-32b2-4c7c-bac0-9955881c1365','2eb898c7-d1cf-4e24-8e7b-88f1c3b5c5b8','4ddc51b5-ff16-4d00-9500-6ffe226ee309','78a984e8-cba7-401f-a39d-f3f659bde19b','6ebda98d-2fb2-4165-ad26-9fc894e72a2d','bdbe26b1-bf39-4c57-a2f4-c5e1b4c20bc1','2a25042e-50c5-459a-ae7f-286dc6724ac7','46ff6224-12fa-48b3-a0bf-1037b20333ba','de04d0f0-4c8f-404f-ab20-4ebba7c7db6b','b372fa96-ad72-4100-942f-a3eb6a37bac7','0433e8de-7872-4d33-9276-326a7050d903');

update public.subsidieregelingen set status_laatst_gecheckt=now() where id in ('a277bd6d-0756-4474-a831-002f2d5dcc3f','145fbfbb-32b2-4c7c-bac0-9955881c1365','2eb898c7-d1cf-4e24-8e7b-88f1c3b5c5b8','4ddc51b5-ff16-4d00-9500-6ffe226ee309','78a984e8-cba7-401f-a39d-f3f659bde19b','6ebda98d-2fb2-4165-ad26-9fc894e72a2d','bdbe26b1-bf39-4c57-a2f4-c5e1b4c20bc1','2a25042e-50c5-459a-ae7f-286dc6724ac7','dcb372f0-d7c3-4d31-88ff-974ee1e1fd19','63b169df-92bb-4357-ad76-f583e7b95a87','8b7d5f83-5cb5-4181-9fcf-604a70873a05','e0675b1b-9c0e-47d5-a0ad-9700aeb50895','5d540610-ff3a-4ddc-8653-68b32971a6a2','5f398d46-8a59-4885-b364-a7c973ee610b','abe03f74-c7cb-443a-899a-153dcc4e7128','85302b50-f06e-4980-943a-ae0743c658c0','793861e8-3e74-4cb3-88bc-29a79c4be9b7','0b90eae2-42f7-43d5-a140-2308467e95de','46ff6224-12fa-48b3-a0bf-1037b20333ba','de04d0f0-4c8f-404f-ab20-4ebba7c7db6b','76216145-f596-4974-ab03-e63e1f605da1','b372fa96-ad72-4100-942f-a3eb6a37bac7','0433e8de-7872-4d33-9276-326a7050d903','9e6341dd-942c-485d-80a2-44984de312ee','04250edf-b56d-4f38-9d75-eec45a9aa83b','2c953c6e-ad0c-4a00-808e-1e0a85ae0475','7d609e58-11ce-43a5-9fed-a22f0f880d8e','b68ac57e-50a5-44cf-a266-077147165404','6096f8a7-66c1-4ca3-a91a-ed29b654d555','ac1f1e1a-8266-4ab6-a862-ff2ae6928161');

commit;
