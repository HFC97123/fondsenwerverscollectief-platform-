\set ON_ERROR_STOP off
\set QUIET on
insert into auth.users values ('aaaaaaaa-0000-4000-8000-000000000001'),('bbbbbbbb-0000-4000-8000-000000000002');
insert into public.subsidie_kompas_programs (id,user_id,naam) values
 ('11111111-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001','A'),
 ('22222222-0000-4000-8000-000000000002','bbbbbbbb-0000-4000-8000-000000000002','B');
insert into public.subsidieregelingen (id, zichtbaar) values ('c1111111-0000-4000-8000-000000000001', true), ('c2222222-0000-4000-8000-000000000002', false);
-- Bestaande regels van VOOR de migratie (moeten ongewijzigd geldig blijven)
insert into public.subsidie_kompas_program_funding (id,user_id,program_id,financier_naam,status,requested_amount) values ('f0000000-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','Eigen cofinancier','submitted',5000);

\i ../../voorstel-niet-uitgevoerd/20261014120000_voorstel_metadata.sql

set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000001',false);
select set_config('test.tier','pro',false);

\echo == Bestaand gedrag
select t_gelijk('bestaande regel is ongewijzigd (voorstel null, status submitted)', $q$select (voorstel is null)::text||status from public.subsidie_kompas_program_funding where id='f0000000-0000-4000-8000-000000000001'$q$, 'truesubmitted');
select t_ok('gewone regel zonder voorstel kan nog steeds', $q$insert into public.subsidie_kompas_program_funding (user_id,program_id,financier_naam,status,requested_amount) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','Handmatig fonds','interesting',1000)$q$);

\echo == Voorstel op een regeling (herkomst regeling)
select t_ok('regelingvoorstel met metadata wordt opgeslagen', $q$insert into public.subsidie_kompas_program_funding (user_id,program_id,scheme_id,status,requested_amount,voorstel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','c1111111-0000-4000-8000-000000000001','interesting',20000,'{"versie":1,"herkomst":"regeling","voorgesteld_op":"2026-10-14","motivatie":"Past bij het project"}')$q$);
select t_fout('herkomst regeling zonder regeling wordt geweigerd', $q$insert into public.subsidie_kompas_program_funding (user_id,program_id,financier_naam,voorstel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','Naam X','{"versie":1,"herkomst":"regeling","voorgesteld_op":"2026-10-14"}')$q$, '23514');
select t_fout('dezelfde regeling nogmaals: geen duplicaat (unieke index)', $q$insert into public.subsidie_kompas_program_funding (user_id,program_id,scheme_id,status,voorstel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','c1111111-0000-4000-8000-000000000001','interesting','{"versie":1,"herkomst":"regeling","voorgesteld_op":"2026-10-14"}')$q$, '23505');

\echo == Online gevonden financier
select t_ok('online financier met https-bron, controledatum en Pro wordt opgeslagen', $q$insert into public.subsidie_kompas_program_funding (user_id,program_id,financier_naam,status,requested_amount,voorstel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','Buurtfonds Zuid','interesting',15000,'{"versie":1,"herkomst":"online","voorgesteld_op":"2026-10-14","bron":{"url":"https://buurtfonds.example.nl/aanvragen","gecontroleerd_op":"2026-10-14"},"voorwaarden":["Alleen ANBI"],"onzekerheden":["Cofinanciering onbekend"],"deadline":{"status":"te-verifieren","datum":null}}')$q$);
select t_fout('online financier: dubbele naam (hoofdletters/spaties) wordt geweigerd', $q$insert into public.subsidie_kompas_program_funding (user_id,program_id,financier_naam,voorstel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','  buurtfonds zuid ','{"versie":1,"herkomst":"online","voorgesteld_op":"2026-10-14","bron":{"url":"https://x.example.nl/a","gecontroleerd_op":"2026-10-14"}}')$q$, '23505');
select t_fout('online zonder bron-url', $q$insert into public.subsidie_kompas_program_funding (user_id,program_id,financier_naam,voorstel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','Zonder bron','{"versie":1,"herkomst":"online","voorgesteld_op":"2026-10-14","bron":{"gecontroleerd_op":"2026-10-14"}}')$q$, '23514');
select t_fout('online met http-url (geen https)', $q$insert into public.subsidie_kompas_program_funding (user_id,program_id,financier_naam,voorstel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','Http fonds','{"versie":1,"herkomst":"online","voorgesteld_op":"2026-10-14","bron":{"url":"http://x.example.nl/a","gecontroleerd_op":"2026-10-14"}}')$q$, '23514');
select t_fout('online met javascript-url', $q$insert into public.subsidie_kompas_program_funding (user_id,program_id,financier_naam,voorstel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','Js fonds','{"versie":1,"herkomst":"online","voorgesteld_op":"2026-10-14","bron":{"url":"javascript:alert(1)","gecontroleerd_op":"2026-10-14"}}')$q$, '23514');
select t_fout('online zonder controledatum', $q$insert into public.subsidie_kompas_program_funding (user_id,program_id,financier_naam,voorstel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','Zonder datum','{"versie":1,"herkomst":"online","voorgesteld_op":"2026-10-14","bron":{"url":"https://x.example.nl/a"}}')$q$, '23514');
select t_fout('online zonder naam (verwijst naar een fonds)', $q$insert into public.subsidie_kompas_program_funding (user_id,program_id,scheme_id,voorstel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','c2222222-0000-4000-8000-000000000002','{"versie":1,"herkomst":"online","voorgesteld_op":"2026-10-14","bron":{"url":"https://x.example.nl/a","gecontroleerd_op":"2026-10-14"}}')$q$, '23514');
select set_config('test.tier','free',false);
select t_fout('online financier opslaan zonder Pro/Premium (Free) wordt geweigerd', $q$insert into public.subsidie_kompas_program_funding (user_id,program_id,financier_naam,voorstel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','Free poging','{"versie":1,"herkomst":"online","voorgesteld_op":"2026-10-14","bron":{"url":"https://x.example.nl/a","gecontroleerd_op":"2026-10-14"}}')$q$, '42501');
select set_config('test.tier','premium',false);
select t_ok('online financier met Premium', $q$insert into public.subsidie_kompas_program_funding (user_id,program_id,financier_naam,voorstel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','Premium vondst','{"versie":1,"herkomst":"online","voorgesteld_op":"2026-10-14","bron":{"url":"https://x.example.nl/a","gecontroleerd_op":"2026-10-14"}}')$q$);
select set_config('test.tier','pro',false);

\echo == Vorm van de metadata
select t_fout('voorstel is geen object', $q$insert into public.subsidie_kompas_program_funding (user_id,program_id,financier_naam,voorstel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','Array','[1]')$q$, '23514');
select t_fout('onbekende versie', $q$insert into public.subsidie_kompas_program_funding (user_id,program_id,financier_naam,voorstel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','V2','{"versie":2,"herkomst":"online","voorgesteld_op":"2026-10-14"}')$q$, '23514');
select t_fout('onbekende herkomst', $q$insert into public.subsidie_kompas_program_funding (user_id,program_id,financier_naam,voorstel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','Hk','{"versie":1,"herkomst":"model","voorgesteld_op":"2026-10-14"}')$q$, '23514');
select t_fout('te grote metadata (> 8000 tekens)', format($q$insert into public.subsidie_kompas_program_funding (user_id,program_id,financier_naam,voorstel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','Groot','{"versie":1,"herkomst":"online","voorgesteld_op":"2026-10-14","bron":{"url":"https://x.example.nl/a","gecontroleerd_op":"2026-10-14"},"motivatie":"%s"}')$q$, repeat('x', 8100)), '23514');

\echo == Onveranderlijk en rechten
select t_fout('voorstel wijzigen via UPDATE (geen kolomrecht)', $q$update public.subsidie_kompas_program_funding set voorstel='{"versie":1,"herkomst":"online","voorgesteld_op":"2026-10-14"}' where financier_naam='Buurtfonds Zuid'$q$, '42501');
reset role;
select t_fout('voorstel wijzigen als eigenaar van de tabel: trigger blokkeert', $q$update public.subsidie_kompas_program_funding set voorstel=null where financier_naam='Buurtfonds Zuid'$q$, '23514');
set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000001',false);

\echo == Status Ingetrokken
select t_ok('status withdrawn mag', $q$update public.subsidie_kompas_program_funding set status='withdrawn', notes='Mijn notitie' where financier_naam='Buurtfonds Zuid'$q$);
select t_fout('onbekende status blijft geweigerd', $q$update public.subsidie_kompas_program_funding set status='toegekend' where financier_naam='Buurtfonds Zuid'$q$, '23514');
select t_ok('lid past eigen bedrag nog steeds aan', $q$update public.subsidie_kompas_program_funding set requested_amount=12000 where financier_naam='Buurtfonds Zuid'$q$);

\echo == Metadata-RPC: eigenaar, maskering, andere gebruiker
insert into public.subsidie_kompas_program_funding (user_id,program_id,scheme_id,status,voorstel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','c2222222-0000-4000-8000-000000000002','interesting','{"versie":1,"herkomst":"regeling","voorgesteld_op":"2026-10-14","motivatie":"Geheime Premium-regeling past goed"}');
select t_gelijk('metadata voor zichtbare bronnen (regeling + genoemde financiers), verborgen bron niet', $q$select count(*)::text from public.kompas_voorstel_metadata('11111111-0000-4000-8000-000000000001')$q$, '3');
select t_gelijk('verborgen bron geeft geen metadata (geen lek van de motivatie)', $q$select count(*)::text from public.kompas_voorstel_metadata('11111111-0000-4000-8000-000000000001') where voorstel::text like '%Premium-regeling%'$q$, '0');
select t_gelijk('regel zonder voorstel komt niet voor', $q$select count(*)::text from public.kompas_voorstel_metadata('11111111-0000-4000-8000-000000000001') m join public.subsidie_kompas_program_funding f on f.id=m.funding_id where f.voorstel is null$q$, '0');
select t_fout('project van een ander: dezelfde fout als niet bestaand', $q$select * from public.kompas_voorstel_metadata('22222222-0000-4000-8000-000000000002')$q$, '42501');
select t_fout('onbestaand project', $q$select * from public.kompas_voorstel_metadata('99999999-0000-4000-8000-000000000009')$q$, '42501');
reset role; set role anon;
select t_fout('anon heeft geen toegang tot de RPC', $q$select * from public.kompas_voorstel_metadata('11111111-0000-4000-8000-000000000001')$q$, '42501');
reset role; set role authenticated; select set_config('request.jwt.claim.sub','bbbbbbbb-0000-4000-8000-000000000002',false);
select t_gelijk('gebruiker B ziet niets van A', $q$select count(*)::text from public.subsidie_kompas_program_funding$q$, '0');
select t_fout('B kan niet voor A opslaan', $q$insert into public.subsidie_kompas_program_funding (user_id,program_id,financier_naam,voorstel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','Kaper','{"versie":1,"herkomst":"online","voorgesteld_op":"2026-10-14","bron":{"url":"https://x.example.nl/a","gecontroleerd_op":"2026-10-14"}}')$q$);

\echo == Acties: voorstel_sleutel en bron_deadline_bij_voorstel
reset role; set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000001',false);
select t_ok('voorgestelde taak met sleutel en bron-deadline', $q$insert into public.subsidie_kompas_program_actions (user_id,program_id,title,source,proposed_at,voorstel_sleutel,bron_deadline_bij_voorstel,funding_id) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','Aanvraag indienen','chat',now(),'a:r:regeling:c1111111:aanvraag-indienen','2026-12-01',(select id from public.subsidie_kompas_program_funding where scheme_id='c1111111-0000-4000-8000-000000000001'))$q$);
select t_fout('dezelfde sleutel nogmaals (herhaald klikken) geeft 23505', $q$insert into public.subsidie_kompas_program_actions (user_id,program_id,title,source,proposed_at,voorstel_sleutel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','Aanvraag indienen','chat',now(),'a:r:regeling:c1111111:aanvraag-indienen')$q$, '23505');
select t_ok('twee zelf toegevoegde taken zonder sleutel mogen gelijk heten', $q$insert into public.subsidie_kompas_program_actions (user_id,program_id,title) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','Bellen'),('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','Bellen')$q$);
select t_fout('lege sleutel', $q$insert into public.subsidie_kompas_program_actions (user_id,program_id,title,voorstel_sleutel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','X','   ')$q$, '23514');
select t_fout('sleutel wijzigen (geen kolomrecht)', $q$update public.subsidie_kompas_program_actions set voorstel_sleutel='nieuw' where title='Aanvraag indienen'$q$, '42501');
select t_fout('bron-deadline wijzigen (geen kolomrecht)', $q$update public.subsidie_kompas_program_actions set bron_deadline_bij_voorstel='2027-01-01' where title='Aanvraag indienen'$q$, '42501');
reset role;
select t_fout('sleutel wijzigen als tabeleigenaar: trigger blokkeert', $q$update public.subsidie_kompas_program_actions set voorstel_sleutel='nieuw' where title='Aanvraag indienen'$q$, '23514');
set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000001',false);
select t_ok('streefdatum zetten op een voorgestelde taak mag (due_date)', $q$update public.subsidie_kompas_program_actions set due_date='2026-11-20' where title='Aanvraag indienen'$q$);
select t_gelijk('bron-deadline blijft staan na het zetten van de streefdatum', $q$select bron_deadline_bij_voorstel::text from public.subsidie_kompas_program_actions where title='Aanvraag indienen'$q$, '2026-12-01');
select t_ok('afronden werkt nog steeds', $q$update public.subsidie_kompas_program_actions set status='done' where title='Aanvraag indienen'$q$);
select t_gelijk('bestaande taken (zonder sleutel) blijven geldig', $q$select count(*)::text from public.subsidie_kompas_program_actions where voorstel_sleutel is null$q$, '2');

\echo == Bestaande rechten onaangetast
select t_fout('project_id van een ander voor taak', $q$insert into public.subsidie_kompas_program_actions (user_id,program_id,title) values ('aaaaaaaa-0000-4000-8000-000000000001','22222222-0000-4000-8000-000000000002','Hack')$q$);
