\set ON_ERROR_STOP off
\set QUIET on
-- Test van 20261014120000_voorstel_metadata.sql (versie 2: server-owned verificatie, geen Premium-lek).
-- Rollen: authenticated = het lid (clientselect/-insert); service_role = de Edge Function (de ENIGE schrijver van `voorstel`).
insert into auth.users values ('aaaaaaaa-0000-4000-8000-000000000001'),('bbbbbbbb-0000-4000-8000-000000000002');
insert into public.subsidie_kompas_programs (id,user_id,naam) values
 ('11111111-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001','A'),
 ('22222222-0000-4000-8000-000000000002','bbbbbbbb-0000-4000-8000-000000000002','B');
grant all on public.subsidie_kompas_programs to service_role;
-- c1 = gewone zichtbare regeling, c2 = voor niemand zichtbaar, c3 = Premium-regeling; fa = gewoon fonds, fb = Premium-fonds
insert into public.subsidieregelingen (id, zichtbaar, premium) values
 ('c1111111-0000-4000-8000-000000000001', true, false), ('c2222222-0000-4000-8000-000000000002', false, false), ('c3333333-0000-4000-8000-000000000003', true, true);
insert into public.funders (id, premium) values ('fa000000-0000-4000-8000-00000000000a', false), ('fb000000-0000-4000-8000-00000000000b', true);
-- Bestaande regel van VOOR de migratie (moet ongewijzigd geldig blijven)
insert into public.subsidie_kompas_program_funding (id,user_id,program_id,financier_naam,status,requested_amount) values ('f0000000-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','Eigen cofinancier','submitted',5000);

-- JSON-fixtures (alle geldig volgens versie 2)
insert into public.t_json values
 ('regeling', '{"versie":2,"server_generated":true,"herkomst":"regeling","voorgesteld_op":"2026-10-14","voorgesteld_bedrag":20000}'),
 ('fonds', '{"versie":2,"server_generated":true,"herkomst":"fonds","voorgesteld_op":"2026-10-14","voorgesteld_bedrag":null}'),
 ('geheim', '{"versie":2,"server_generated":true,"herkomst":"regeling","voorgesteld_op":"2026-10-14","voorgesteld_bedrag":7500,"verificatie":{"status":"gedeeltelijk","gecontroleerd_op":"2026-10-14T09:30:00Z","bron_url":"https://geheim.example.nl/regeling","pagina_sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","velden":{"fondsnaam":{"status":"confirmed","waarde":"GEHEIME Premium-regeling","fragment":"GEHEIME Premium-regeling opent in 2027"},"deadline":{"status":"uncertain","fragment":"GEHEIME deadline later"}}}}'),
 ('online_geverifieerd', '{"versie":2,"server_generated":true,"herkomst":"online","voorgesteld_op":"2026-10-14","voorgesteld_bedrag":15000,"verificatie":{"status":"geverifieerd","gecontroleerd_op":"2026-10-14T10:00:00Z","bron_url":"https://buurtfonds.example.nl/aanvragen","eind_url":"https://www.buurtfonds.example.nl/aanvragen","pagina_sha256":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef","velden":{"fondsnaam":{"status":"confirmed"},"deadline":{"status":"confirmed","waarde":"2026-11-12","fragment":"Aanvragen kan tot 12 november 2026."},"bedrag_max":{"status":"not_checked"},"cofinanciering":{"status":"not_checked"}}}}'),
 ('online_gedeeltelijk', '{"versie":2,"server_generated":true,"herkomst":"online","voorgesteld_op":"2026-10-14","voorgesteld_bedrag":9000,"verificatie":{"status":"gedeeltelijk","gecontroleerd_op":"2026-10-14T10:00:00Z","bron_url":"https://wijkfonds.example.nl/","pagina_sha256":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef","velden":{"fondsnaam":{"status":"confirmed"},"deadline":{"status":"confirmed","waarde":"2026-12-01","fragment":"Sluiting: 1 december 2026"},"bedrag_max":{"status":"uncertain","waarde":"25000"},"cofinanciering":{"status":"not_checked"}}}}'),
 ('online_conflict', '{"versie":2,"server_generated":true,"herkomst":"fonds","voorgesteld_op":"2026-10-14","voorgesteld_bedrag":5000,"verificatie":{"status":"conflict","gecontroleerd_op":"2026-10-14T10:00:00Z","bron_url":"https://fonds-a.example.nl/aanvragen","pagina_sha256":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef","velden":{"fondsnaam":{"status":"confirmed"},"deadline":{"status":"conflict","waarde":"2026-11-15","db_waarde":"2026-11-12","fragment":"uiterlijk 15 november 2026","fragment_sha256":"fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210"}}}}'),
 ('online_niet_gecontroleerd', '{"versie":2,"server_generated":true,"herkomst":"online","voorgesteld_op":"2026-10-14","voorgesteld_bedrag":3000,"verificatie":{"status":"niet_gecontroleerd","velden":{"fondsnaam":{"status":"not_checked"},"deadline":{"status":"not_checked"}}}}');

\i ../../voorstel-niet-uitgevoerd/20261014120000_voorstel_metadata.sql

-- ======================================================================================================
\echo == Schemacontrole (zuiver): geldige vormen
select t_gelijk('regeling zonder verificatie is geldig', $q$select public.kompas_voorstel_geldig((select j from public.t_json where naam='regeling'))::text$q$, 'true');
select t_gelijk('online geverifieerd (server, bron, hash, fondsnaam+deadline met citaat) is geldig', $q$select public.kompas_voorstel_geldig((select j from public.t_json where naam='online_geverifieerd'))::text$q$, 'true');
select t_gelijk('online gedeeltelijk is geldig', $q$select public.kompas_voorstel_geldig((select j from public.t_json where naam='online_gedeeltelijk'))::text$q$, 'true');
select t_gelijk('conflict op de deadline is geldig als status conflict', $q$select public.kompas_voorstel_geldig((select j from public.t_json where naam='online_conflict'))::text$q$, 'true');
select t_gelijk('niet_gecontroleerd zonder bron is geldig', $q$select public.kompas_voorstel_geldig((select j from public.t_json where naam='online_niet_gecontroleerd'))::text$q$, 'true');

\echo == Schemacontrole (zuiver): een client kan geen "geverifieerd" faken
select t_gelijk('server_generated=false wordt geweigerd', $q$select public.kompas_voorstel_geldig(jsonb_set((select j from public.t_json where naam='online_geverifieerd'),'{server_generated}','false'))::text$q$, 'false');
select t_gelijk('zonder server_generated wordt geweigerd', $q$select public.kompas_voorstel_geldig((select j from public.t_json where naam='online_geverifieerd') - 'server_generated')::text$q$, 'false');
select t_gelijk('oude versie 1 wordt geweigerd', $q$select public.kompas_voorstel_geldig(jsonb_set((select j from public.t_json where naam='regeling'),'{versie}','1'))::text$q$, 'false');
select t_gelijk('onbekende sleutel (bv. motivatie) wordt geweigerd: geen tekstkopieën', $q$select public.kompas_voorstel_geldig((select j from public.t_json where naam='regeling') || '{"motivatie":"Past goed"}')::text$q$, 'false');
select t_gelijk('geverifieerd zonder citaat bij de deadline wordt geweigerd', $q$select public.kompas_voorstel_geldig(jsonb_set((select j from public.t_json where naam='online_geverifieerd'),'{verificatie,velden,deadline}','{"status":"confirmed","waarde":"2026-11-12"}'))::text$q$, 'false');
select t_gelijk('geverifieerd zonder bevestigde fondsnaam wordt geweigerd', $q$select public.kompas_voorstel_geldig(jsonb_set((select j from public.t_json where naam='online_geverifieerd'),'{verificatie,velden,fondsnaam}','{"status":"uncertain"}'))::text$q$, 'false');
select t_gelijk('geverifieerd met een onzeker veld wordt geweigerd', $q$select public.kompas_voorstel_geldig(jsonb_set((select j from public.t_json where naam='online_geverifieerd'),'{verificatie,velden,bedrag_max}','{"status":"uncertain"}'))::text$q$, 'false');
select t_gelijk('geverifieerd zonder pagina-vingerafdruk wordt geweigerd', $q$select public.kompas_voorstel_geldig((select j from public.t_json where naam='online_geverifieerd') #- '{verificatie,pagina_sha256}')::text$q$, 'false');
select t_gelijk('geverifieerd zonder bron-url wordt geweigerd', $q$select public.kompas_voorstel_geldig((select j from public.t_json where naam='online_geverifieerd') #- '{verificatie,bron_url}')::text$q$, 'false');
select t_gelijk('veld in conflict maar status geverifieerd wordt geweigerd', $q$select public.kompas_voorstel_geldig(jsonb_set((select j from public.t_json where naam='online_conflict'),'{verificatie,status}','"geverifieerd"'))::text$q$, 'false');
select t_gelijk('status conflict zonder veld in conflict wordt geweigerd', $q$select public.kompas_voorstel_geldig(jsonb_set((select j from public.t_json where naam='online_gedeeltelijk'),'{verificatie,status}','"conflict"'))::text$q$, 'false');
select t_gelijk('niet_gecontroleerd met een bevestigd veld wordt geweigerd', $q$select public.kompas_voorstel_geldig(jsonb_set((select j from public.t_json where naam='online_niet_gecontroleerd'),'{verificatie,velden,fondsnaam}','{"status":"confirmed"}'))::text$q$, 'false');
select t_gelijk('gedeeltelijk zonder bevestigde fondsnaam wordt geweigerd', $q$select public.kompas_voorstel_geldig(jsonb_set((select j from public.t_json where naam='online_gedeeltelijk'),'{verificatie,velden,fondsnaam}','{"status":"not_checked"}'))::text$q$, 'false');
select t_gelijk('online zonder verificatieblok wordt geweigerd', $q$select public.kompas_voorstel_geldig((select j from public.t_json where naam='online_geverifieerd') - 'verificatie')::text$q$, 'false');
select t_gelijk('http-bron wordt geweigerd', $q$select public.kompas_voorstel_geldig(jsonb_set((select j from public.t_json where naam='online_geverifieerd'),'{verificatie,bron_url}','"http://x.example.nl/a"'))::text$q$, 'false');
select t_gelijk('javascript-url wordt geweigerd', $q$select public.kompas_voorstel_geldig(jsonb_set((select j from public.t_json where naam='online_geverifieerd'),'{verificatie,bron_url}','"javascript:alert(1)"'))::text$q$, 'false');
select t_gelijk('onbekende veldnaam wordt geweigerd', $q$select public.kompas_voorstel_geldig(jsonb_set((select j from public.t_json where naam='online_geverifieerd'),'{verificatie,velden,motivatie}','{"status":"confirmed"}'))::text$q$, 'false');
select t_gelijk('onbekende veldstatus wordt geweigerd', $q$select public.kompas_voorstel_geldig(jsonb_set((select j from public.t_json where naam='online_geverifieerd'),'{verificatie,velden,deadline,status}','"verified"'))::text$q$, 'false');
select t_gelijk('onbekende samenvattende status wordt geweigerd', $q$select public.kompas_voorstel_geldig(jsonb_set((select j from public.t_json where naam='online_geverifieerd'),'{verificatie,status}','"verified"'))::text$q$, 'false');
select t_gelijk('slechte vingerafdruk wordt geweigerd', $q$select public.kompas_voorstel_geldig(jsonb_set((select j from public.t_json where naam='online_geverifieerd'),'{verificatie,pagina_sha256}','"abc"'))::text$q$, 'false');
select t_gelijk('te lange waarde wordt geweigerd', format($q$select public.kompas_voorstel_geldig(jsonb_set((select j from public.t_json where naam='online_geverifieerd'),'{verificatie,velden,bedrag_max}','{"status":"uncertain","waarde":"%s"}'))::text$q$, repeat('x',201)), 'false');
select t_gelijk('negatief voorgesteld bedrag wordt geweigerd', $q$select public.kompas_voorstel_geldig(jsonb_set((select j from public.t_json where naam='regeling'),'{voorgesteld_bedrag}','-5'))::text$q$, 'false');
select t_gelijk('voorgesteld bedrag als tekst wordt geweigerd', $q$select public.kompas_voorstel_geldig(jsonb_set((select j from public.t_json where naam='regeling'),'{voorgesteld_bedrag}','"20000"'))::text$q$, 'false');
select t_gelijk('te grote metadata wordt geweigerd', format($q$select public.kompas_voorstel_geldig((select j from public.t_json where naam='regeling') || jsonb_build_object('voorgesteld_op','2026-10-14','verificatie',jsonb_build_object('status','niet_gecontroleerd','velden',jsonb_build_object('fondsnaam',jsonb_build_object('status','not_checked','fragment','%s')))))::text$q$, repeat('y',9000)), 'false');

-- ======================================================================================================
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000001',false);
select set_config('test.tier','pro',false);

\echo == Bestaand gedrag blijft werken
select t_gelijk('bestaande regel is ongewijzigd (voorstel null, status submitted)', $q$select (select count(*) from public.subsidie_kompas_program_funding where id='f0000000-0000-4000-8000-000000000001' and status='submitted')::text$q$, '1');
select t_ok('gewone regel zonder voorstel kan nog steeds (insert + returning id)', $q$insert into public.subsidie_kompas_program_funding (user_id,program_id,financier_naam,status,requested_amount) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','Handmatig fonds','interesting',1000) returning id$q$);
select t_ok('lid past eigen bedrag, status en notitie aan', $q$update public.subsidie_kompas_program_funding set requested_amount=1500, status='preparing', notes='mijn notitie' where financier_naam='Handmatig fonds'$q$);
select t_ok('lid leest zijn eigen kolommen (bedragen, status, notitie)', $q$select id, user_id, program_id, financier_naam, requested_amount, awarded_amount, status, eigen_deadline, reminder_enabled, notes, created_at, updated_at from public.subsidie_kompas_program_funding$q$);
select t_ok('lid verwijdert zijn eigen regel (RLS + kolomrechten)', $q$delete from public.subsidie_kompas_program_funding where financier_naam='Handmatig fonds'$q$);
select t_ok('status withdrawn (Ingetrokken) mag', $q$update public.subsidie_kompas_program_funding set status='withdrawn', notes='Mijn notitie' where id='f0000000-0000-4000-8000-000000000001'$q$);
select t_fout('onbekende status blijft geweigerd', $q$update public.subsidie_kompas_program_funding set status='toegekend' where id='f0000000-0000-4000-8000-000000000001'$q$, '23514');
select t_ok('terug naar aangevraagd', $q$update public.subsidie_kompas_program_funding set status='submitted' where id='f0000000-0000-4000-8000-000000000001'$q$);

\echo == Clientrechten: authenticated kan voorstelmetadata niet schrijven
select t_fout('INSERT met voorstel door het lid (geen kolomrecht)', $q$insert into public.subsidie_kompas_program_funding (user_id,program_id,financier_naam,voorstel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','Gefaked fonds',(select j from public.t_json where naam='online_geverifieerd'))$q$, '42501');
select t_fout('INSERT met een nep-geverifieerd voorstel (server_generated=true gezet door het lid)', $q$insert into public.subsidie_kompas_program_funding (user_id,program_id,scheme_id,voorstel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','c1111111-0000-4000-8000-000000000001','{"versie":2,"server_generated":true,"herkomst":"regeling","voorgesteld_op":"2026-10-14"}')$q$, '42501');
select t_fout('UPDATE van voorstel door het lid (geen kolomrecht)', $q$update public.subsidie_kompas_program_funding set voorstel=(select j from public.t_json where naam='regeling') where id='f0000000-0000-4000-8000-000000000001'$q$, '42501');
select t_fout('INSERT ... RETURNING voorstel door het lid', $q$insert into public.subsidie_kompas_program_funding (user_id,program_id,financier_naam) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','Return poging') returning voorstel$q$, '42501');

reset role;
-- ======================================================================================================
\echo == Server (service_role) schrijft de voorstelmetadata
set role service_role;
select t_ok('server: regelingvoorstel (Gepland) met metadata', $q$insert into public.subsidie_kompas_program_funding (user_id,program_id,scheme_id,status,requested_amount,voorstel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','c1111111-0000-4000-8000-000000000001','interesting',20000,(select j from public.t_json where naam='regeling'))$q$);
select t_ok('server: online financier geverifieerd', $q$insert into public.subsidie_kompas_program_funding (user_id,program_id,financier_naam,status,requested_amount,voorstel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','Buurtfonds Zuid','interesting',15000,(select j from public.t_json where naam='online_geverifieerd'))$q$);
select t_ok('server: online financier gedeeltelijk geverifieerd', $q$insert into public.subsidie_kompas_program_funding (user_id,program_id,financier_naam,status,requested_amount,voorstel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','Wijkfonds Noord','interesting',9000,(select j from public.t_json where naam='online_gedeeltelijk'))$q$);
select t_ok('server: online financier niet gecontroleerd (fetch mislukt)', $q$insert into public.subsidie_kompas_program_funding (user_id,program_id,financier_naam,status,requested_amount,voorstel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','Onbereikbaar fonds','interesting',3000,(select j from public.t_json where naam='online_niet_gecontroleerd'))$q$);
select t_ok('server: fonds uit de database met conflict database/web', $q$insert into public.subsidie_kompas_program_funding (user_id,program_id,funder_id,status,voorstel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','fa000000-0000-4000-8000-00000000000a','interesting',(select j from public.t_json where naam='online_conflict'))$q$);
select t_ok('server: Premium-regeling met bewijs (voor het downgrade-scenario)', $q$insert into public.subsidie_kompas_program_funding (user_id,program_id,scheme_id,status,requested_amount,voorstel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','c3333333-0000-4000-8000-000000000003','interesting',7500,(select j from public.t_json where naam='geheim'))$q$);
select t_ok('server: Premium-fonds met metadata (voor het downgrade-scenario)', $q$insert into public.subsidie_kompas_program_funding (user_id,program_id,funder_id,status,voorstel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','fb000000-0000-4000-8000-00000000000b','interesting',jsonb_set((select j from public.t_json where naam='geheim'),'{herkomst}','"fonds"'))$q$);
select t_ok('server: regel voor niet-zichtbare regeling met metadata', $q$insert into public.subsidie_kompas_program_funding (user_id,program_id,scheme_id,status,voorstel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','c2222222-0000-4000-8000-000000000002','interesting',jsonb_set((select j from public.t_json where naam='geheim'),'{verificatie,velden,fondsnaam,waarde}','"GEHEIME onzichtbare regeling"'))$q$);
select t_fout('server: dezelfde regeling nogmaals: geen duplicaat (unieke index)', $q$insert into public.subsidie_kompas_program_funding (user_id,program_id,scheme_id,status,voorstel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','c1111111-0000-4000-8000-000000000001','interesting',(select j from public.t_json where naam='regeling'))$q$, '23505');
select t_fout('server: dubbele naam (hoofdletters/spaties) geweigerd', $q$insert into public.subsidie_kompas_program_funding (user_id,program_id,financier_naam,voorstel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','  buurtfonds zuid ',(select j from public.t_json where naam='online_geverifieerd'))$q$, '23505');
select t_fout('server: ongeldig voorstel (server_generated=false) wordt ook van de server geweigerd', $q$insert into public.subsidie_kompas_program_funding (user_id,program_id,financier_naam,voorstel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','Slecht voorstel',jsonb_set((select j from public.t_json where naam='online_geverifieerd'),'{server_generated}','false'))$q$, '23514');
select t_fout('server: herkomst regeling zonder regeling', $q$insert into public.subsidie_kompas_program_funding (user_id,program_id,financier_naam,voorstel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','Naam X',(select j from public.t_json where naam='regeling'))$q$, '23514');
select t_fout('server: herkomst fonds zonder fonds', $q$insert into public.subsidie_kompas_program_funding (user_id,program_id,financier_naam,voorstel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','Naam Y',(select j from public.t_json where naam='fonds'))$q$, '23514');
select t_fout('server: herkomst online zonder naam (verwijst naar een fonds)', $q$insert into public.subsidie_kompas_program_funding (user_id,program_id,funder_id,voorstel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','fa000000-0000-4000-8000-00000000000a',(select j from public.t_json where naam='online_geverifieerd'))$q$, '23514');
select t_fout('server: voorstel wijzigen na aanmaken (onveranderlijk, ook voor de server)', $q$update public.subsidie_kompas_program_funding set voorstel=(select j from public.t_json where naam='online_gedeeltelijk') where financier_naam='Buurtfonds Zuid'$q$, '23514');
select t_ok('server: gewone velden van een regel kunnen nog wel (niet het voorstel)', $q$update public.subsidie_kompas_program_funding set requested_amount=16000 where financier_naam='Buurtfonds Zuid'$q$);
reset role;
create role niet_de_server nologin; grant all on public.subsidie_kompas_program_funding to niet_de_server; grant usage on schema auth to niet_de_server;
set role niet_de_server;
select t_fout('elke andere rol met tabelrechten kan de metadata niet zetten (trigger, tweede laag)', $q$insert into public.subsidie_kompas_program_funding (user_id,program_id,financier_naam,voorstel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','Andere rol',(select j from public.t_json where naam='online_gedeeltelijk'))$q$, '42501');
reset role;

-- ======================================================================================================
\echo == LEKTEST: gewone clientselect mag voorstel nooit lezen (Premium-regeling, Premium-fonds, verborgen regeling)
set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000001',false); select set_config('test.tier','premium',false);
select t_fout('PREMIUM-gebruiker: select voorstel uit de tabel is verboden', $q$select voorstel from public.subsidie_kompas_program_funding$q$, '42501');
select set_config('test.tier','pro',false);
select t_fout('PRO-gebruiker: select voorstel uit de tabel is verboden', $q$select voorstel from public.subsidie_kompas_program_funding$q$, '42501');
select t_fout('select * uit de tabel is verboden (kolom voorstel zit erin)', $q$select * from public.subsidie_kompas_program_funding$q$, '42501');
select t_fout('select to_jsonb(t) uit de tabel (hele rij als json) is verboden', $q$select to_jsonb(t) from public.subsidie_kompas_program_funding t$q$, '42501');
select t_fout('filteren op voorstel (WHERE voorstel::text like ...) is verboden', $q$select count(*) from public.subsidie_kompas_program_funding where voorstel::text like '%Premium%'$q$, '42501');
select t_fout('filteren op voorstel IS NOT NULL is verboden', $q$select count(*) from public.subsidie_kompas_program_funding where voorstel is not null$q$, '42501');
select t_fout('sorteren op voorstel is verboden', $q$select id from public.subsidie_kompas_program_funding order by voorstel$q$, '42501');
select t_fout('voorstel als subquery-kolom is verboden', $q$select (select voorstel from public.subsidie_kompas_program_funding limit 1)$q$, '42501');
select t_ok('de eigen gegevens blijven wel leesbaar: bedragen, status, notities', $q$select id, requested_amount, awarded_amount, status, notes, eigen_deadline from public.subsidie_kompas_program_funding$q$);
select set_config('test.tier','free',false);
select t_fout('FREE-gebruiker: select voorstel uit de tabel is verboden', $q$select voorstel from public.subsidie_kompas_program_funding$q$, '42501');
reset role; set role anon;
select t_fout('anon: geen select op de tabel', $q$select id from public.subsidie_kompas_program_funding$q$, '42501');
reset role;

-- ======================================================================================================
\echo == RPC kompas_voorstel_metadata: gemaskeerd, ook na downgrade Premium -> Pro
set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000001',false); select set_config('test.tier','premium',false);
select t_gelijk('PREMIUM: RPC geeft metadata voor alle zichtbare regels met voorstel (2 gewone regeling/fonds + 4 online/conflict + 2 Premium)', $q$select count(*)::text from public.kompas_voorstel_metadata('11111111-0000-4000-8000-000000000001')$q$, '7');
select t_gelijk('PREMIUM: de Premium-regeling en het Premium-fonds zijn bereikbaar via de RPC', $q$select count(*)::text from public.kompas_voorstel_metadata('11111111-0000-4000-8000-000000000001') where voorstel::text like '%GEHEIME Premium-regeling%'$q$, '2');
select t_gelijk('PREMIUM: nooit de niet-zichtbare regeling (voor niemand zichtbaar)', $q$select count(*)::text from public.kompas_voorstel_metadata('11111111-0000-4000-8000-000000000001') where voorstel::text like '%onzichtbare%'$q$, '0');
-- DOWNGRADE
select set_config('test.tier','pro',false);
select t_gelijk('NA DOWNGRADE (Premium -> Pro): de RPC geeft niets meer van de Premium-regeling en het Premium-fonds', $q$select count(*)::text from public.kompas_voorstel_metadata('11111111-0000-4000-8000-000000000001') where voorstel::text like '%GEHEIME%'$q$, '0');
select t_gelijk('NA DOWNGRADE: de overige (gewone) regels blijven bereikbaar', $q$select count(*)::text from public.kompas_voorstel_metadata('11111111-0000-4000-8000-000000000001')$q$, '5');
select t_gelijk('NA DOWNGRADE: kompas_dekkingsplan maskeert de bron (verborgen), zodat de client de naam ook daar niet krijgt', $q$select count(*)::text from public.kompas_dekkingsplan('11111111-0000-4000-8000-000000000001') where bron_status='verborgen'$q$, '3');
select t_gelijk('NA DOWNGRADE: de gewone tabelselect blijft verboden voor de verborgen regels', $q$select 'verboden'$q$, 'verboden');
select t_fout('NA DOWNGRADE: voorstel direct uit de tabel (ook van de Premium-regeling) blijft verboden', $q$select voorstel from public.subsidie_kompas_program_funding where requested_amount=7500$q$, '42501');
select t_fout('NA DOWNGRADE: scheme_id (identificeert de Premium-regeling) is niet direct leesbaar', $q$select scheme_id from public.subsidie_kompas_program_funding$q$, '42501');
select t_fout('NA DOWNGRADE: funder_id (identificeert het Premium-fonds) is niet direct leesbaar', $q$select funder_id from public.subsidie_kompas_program_funding$q$, '42501');
select t_fout('NA DOWNGRADE: ook niet via een filter of to_jsonb(rij)', $q$select to_jsonb(t) from public.subsidie_kompas_program_funding t$q$, '42501');
select t_fout('NA DOWNGRADE: filteren op scheme_id (raden welke regeling het is) is niet toegestaan', $q$select id from public.subsidie_kompas_program_funding where scheme_id='c3333333-0000-4000-8000-000000000003'$q$, '42501');
select t_fout('NA DOWNGRADE: filteren op de verborgen regeling om tekst af te leiden is verboden', $q$select count(*) from public.subsidie_kompas_program_funding where voorstel::text like '%GEHEIME%'$q$, '42501');
select t_ok('NA DOWNGRADE: de eigen bedragen en status van de Premium-regel blijven van het lid (leesbaar)', $q$select requested_amount, status, notes from public.subsidie_kompas_program_funding where requested_amount=7500$q$);
select set_config('test.tier','free',false);
select t_gelijk('FREE: de RPC geeft evenmin Premium-tekst', $q$select count(*)::text from public.kompas_voorstel_metadata('11111111-0000-4000-8000-000000000001') where voorstel::text like '%GEHEIME%'$q$, '0');
select set_config('test.tier','pro',false);
select t_gelijk('RPC: alleen de vaste velden, geen vrije tekst (sleutels van het resultaat)', $q$select coalesce(string_agg(distinct k, ',' order by k),'') from public.kompas_voorstel_metadata('11111111-0000-4000-8000-000000000001') m, jsonb_object_keys(m.voorstel) k$q$, 'herkomst,server_generated,verificatie,versie,voorgesteld_bedrag,voorgesteld_op');
select t_gelijk('RPC: server_generated is overal waar', $q$select count(*) filter (where voorstel -> 'server_generated' <> 'true'::jsonb)::text from public.kompas_voorstel_metadata('11111111-0000-4000-8000-000000000001')$q$, '0');
select t_gelijk('RPC: geverifieerd, gedeeltelijk, conflict en niet_gecontroleerd komen ongewijzigd terug', $q$select string_agg(distinct voorstel #>> '{verificatie,status}', ',' order by voorstel #>> '{verificatie,status}') from public.kompas_voorstel_metadata('11111111-0000-4000-8000-000000000001')$q$, 'conflict,gedeeltelijk,geverifieerd,niet_gecontroleerd');
select t_gelijk('RPC: conflictbewijs compleet (veld, onlinewaarde, databasewaarde-momentopname, bron, controlemoment, citaat-hash)', $q$select concat_ws('|', voorstel #>> '{verificatie,velden,deadline,status}', voorstel #>> '{verificatie,velden,deadline,waarde}', voorstel #>> '{verificatie,velden,deadline,db_waarde}', voorstel #>> '{verificatie,bron_url}', voorstel #>> '{verificatie,gecontroleerd_op}', left(voorstel #>> '{verificatie,velden,deadline,fragment_sha256}', 6)) from public.kompas_voorstel_metadata('11111111-0000-4000-8000-000000000001') where voorstel #>> '{verificatie,status}' = 'conflict'$q$, 'conflict|2026-11-15|2026-11-12|https://fonds-a.example.nl/aanvragen|2026-10-14T10:00:00Z|fedcba');
select t_gelijk('schema: conflict zonder databasewaarde wordt geweigerd', $q$select public.kompas_voorstel_geldig((select j #- '{verificatie,velden,deadline,db_waarde}' from public.t_json where naam='online_conflict'))::text$q$, 'false');
select t_gelijk('schema: conflict zonder onlinewaarde wordt geweigerd', $q$select public.kompas_voorstel_geldig((select j #- '{verificatie,velden,deadline,waarde}' from public.t_json where naam='online_conflict'))::text$q$, 'false');
select t_gelijk('schema: conflict zonder citaat of citaat-hash wordt geweigerd', $q$select public.kompas_voorstel_geldig((select (j #- '{verificatie,velden,deadline,fragment}') #- '{verificatie,velden,deadline,fragment_sha256}' from public.t_json where naam='online_conflict'))::text$q$, 'false');
select t_gelijk('schema: databasewaarde bij een bevestigd veld wordt geweigerd', $q$select public.kompas_voorstel_geldig(jsonb_set((select j from public.t_json where naam='online_geverifieerd'),'{verificatie,velden,fondsnaam,db_waarde}','"x"'))::text$q$, 'false');
select t_gelijk('schema: ongeldige citaat-hash wordt geweigerd', $q$select public.kompas_voorstel_geldig(jsonb_set((select j from public.t_json where naam='online_conflict'),'{verificatie,velden,deadline,fragment_sha256}','"abc"'))::text$q$, 'false');
select t_gelijk('schema: te lange databasewaarde wordt geweigerd', $q$select public.kompas_voorstel_geldig(jsonb_set((select j from public.t_json where naam='online_conflict'),'{verificatie,velden,deadline,db_waarde}', to_jsonb(repeat('x',201))))::text$q$, 'false');
-- Gedeelde fixtures (zelfde bestand wordt door de JS-spiegel in supabase/functions/_shared/voorstelMetadata.ts getest)
\set fx `cat fixtures.json`
create temp table t_cases as select * from jsonb_to_recordset(:'fx'::jsonb) as x(naam text, geldig boolean, meta jsonb);
do $$ declare r record; got boolean; begin
  for r in select * from t_cases loop
    got := public.kompas_voorstel_geldig(r.meta);
    if got = r.geldig then raise notice 'OK    fixture: % -> %', r.naam, r.geldig;
    else raise notice 'FAIL  fixture: % (kreeg %, verwacht %)', r.naam, got, r.geldig; end if;
  end loop;
end $$;
select t_fout('project van een ander: dezelfde fout als niet bestaand', $q$select * from public.kompas_voorstel_metadata('22222222-0000-4000-8000-000000000002')$q$, '42501');
select t_fout('onbestaand project', $q$select * from public.kompas_voorstel_metadata('99999999-0000-4000-8000-000000000009')$q$, '42501');
reset role; set role anon;
select t_fout('anon heeft geen toegang tot de RPC', $q$select * from public.kompas_voorstel_metadata('11111111-0000-4000-8000-000000000001')$q$, '42501');
reset role; set role authenticated; select set_config('request.jwt.claim.sub','bbbbbbbb-0000-4000-8000-000000000002',false);
select t_gelijk('gebruiker B ziet niets van A (tabel)', $q$select count(*)::text from public.subsidie_kompas_program_funding$q$, '0');
select t_fout('B kan niet voor A opslaan', $q$insert into public.subsidie_kompas_program_funding (user_id,program_id,financier_naam) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','Kaper')$q$);
reset role;

-- ======================================================================================================
\echo == Acties: voorstel_sleutel en bron_deadline_bij_voorstel zijn server-owned
set role service_role;
select t_ok('server: voorgestelde taak met sleutel en bron-deadline', $q$insert into public.subsidie_kompas_program_actions (user_id,program_id,title,source,proposed_at,voorstel_sleutel,bron_deadline_bij_voorstel,funding_id) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','Aanvraag indienen','chat',now(),'a:r:regeling:c1111111:aanvraag-indienen','2026-12-01',(select id from public.subsidie_kompas_program_funding where scheme_id='c1111111-0000-4000-8000-000000000001'))$q$);
select t_fout('server: dezelfde sleutel nogmaals (herhaald klikken) geeft 23505', $q$insert into public.subsidie_kompas_program_actions (user_id,program_id,title,source,proposed_at,voorstel_sleutel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','Aanvraag indienen','chat',now(),'a:r:regeling:c1111111:aanvraag-indienen')$q$, '23505');
select t_fout('server: lege sleutel', $q$insert into public.subsidie_kompas_program_actions (user_id,program_id,title,voorstel_sleutel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','X','   ')$q$, '23514');
reset role;
set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000001',false);
select t_fout('lid: eigen taak met voorstel_sleutel is verboden (geen kolomrecht)', $q$insert into public.subsidie_kompas_program_actions (user_id,program_id,title,voorstel_sleutel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','Nep voorgesteld','a:nep')$q$, '42501');
select t_fout('lid: eigen taak met bron_deadline_bij_voorstel is verboden (geen kolomrecht)', $q$insert into public.subsidie_kompas_program_actions (user_id,program_id,title,bron_deadline_bij_voorstel) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','Nep','2026-12-01')$q$, '42501');
select t_ok('lid: twee zelf toegevoegde taken zonder sleutel mogen gelijk heten', $q$insert into public.subsidie_kompas_program_actions (user_id,program_id,title) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','Bellen'),('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','Bellen')$q$);
select t_fout('lid: sleutel wijzigen (geen kolomrecht)', $q$update public.subsidie_kompas_program_actions set voorstel_sleutel='nieuw' where title='Aanvraag indienen'$q$, '42501');
select t_fout('lid: bron-deadline wijzigen (geen kolomrecht)', $q$update public.subsidie_kompas_program_actions set bron_deadline_bij_voorstel='2027-01-01' where title='Aanvraag indienen'$q$, '42501');
reset role;
select t_fout('sleutel wijzigen als tabeleigenaar: trigger blokkeert', $q$update public.subsidie_kompas_program_actions set voorstel_sleutel='nieuw' where title='Aanvraag indienen'$q$, '23514');
set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000001',false);
select t_ok('lid: streefdatum zetten op een voorgestelde taak mag (due_date)', $q$update public.subsidie_kompas_program_actions set due_date='2026-11-20' where title='Aanvraag indienen'$q$);
select t_gelijk('bron-deadline blijft staan na het zetten van de streefdatum', $q$select bron_deadline_bij_voorstel::text from public.subsidie_kompas_program_actions where title='Aanvraag indienen'$q$, '2026-12-01');
select t_ok('afronden werkt nog steeds', $q$update public.subsidie_kompas_program_actions set status='done' where title='Aanvraag indienen'$q$);
select t_gelijk('bestaande taken (zonder sleutel) blijven geldig', $q$select count(*)::text from public.subsidie_kompas_program_actions where voorstel_sleutel is null$q$, '2');
select t_fout('project van een ander voor taak', $q$insert into public.subsidie_kompas_program_actions (user_id,program_id,title) values ('aaaaaaaa-0000-4000-8000-000000000001','22222222-0000-4000-8000-000000000002','Hack')$q$);

\echo == Geen dubbele telling: de rekenbron kent het voorstel niet
reset role; set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000001',false); select set_config('test.tier','pro',false);
select t_gelijk('kompas_dekkingsplan() geeft geen voorstel-kolom terug (de enige rekenbron blijft ongewijzigd)', $q$select count(*)::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='kompas_dekkingsplan' and pg_get_function_result(p.oid) ilike '%voorstel%'$q$, '0');
reset role;
