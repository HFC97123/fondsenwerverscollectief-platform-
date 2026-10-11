-- Database- en beveiligingstests voor subsidie_kompas_program_funding en kompas_dekkingsplan.
-- Draait op een lokale Postgres 16 na schema-stub.sql + de migratie (zie run.mjs).
-- Elke test meldt NOTICE 'OK  <naam>' of 'FAIL <naam>'.
begin;
create schema tt;
grant usage on schema tt to authenticated, anon, service_role;
create function tt.ok(n text, c boolean, d text default '') returns void language plpgsql as $$
begin
  if coalesce(c, false) then raise notice 'OK   %', n; else raise notice 'FAIL % %', n, d; end if;
end $$;
grant execute on function tt.ok(text, boolean, text) to authenticated, anon, service_role;
-- voert sql uit en geeft de SQLSTATE terug (of 'ok')
create function tt.state(q text) returns text language plpgsql as $$
begin execute q; return 'ok'; exception when others then return sqlstate; end $$;
grant execute on function tt.state(text) to authenticated, anon, service_role;
create function tt.n(q text) returns bigint language plpgsql as $$
declare c bigint; begin execute 'with x as (' || q || ') select count(*) from x' into c; return c; end $$;
grant execute on function tt.n(text) to authenticated, anon, service_role;
create function tt.als(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(u::text, ''), true); end $$;
grant execute on function tt.als(uuid) to authenticated, anon, service_role;

-- ===== fixture =====
insert into auth.users(id) values
 ('a0000000-0000-4000-8000-00000000000a'),('b0000000-0000-4000-8000-00000000000b'),
 ('c0000000-0000-4000-8000-0000000000ad'),('d0000000-0000-4000-8000-0000000000e1'),('e0000000-0000-4000-8000-0000000000f2');
insert into public.profiles(id, role, subscription_tier, subscription_active) values
 ('a0000000-0000-4000-8000-00000000000a','member','pro',true),       -- A: Pro
 ('b0000000-0000-4000-8000-00000000000b','member','free',false),      -- B: Free
 ('c0000000-0000-4000-8000-0000000000ad','admin','free',false),       -- admin
 ('d0000000-0000-4000-8000-0000000000e1','member','premium',true),    -- P: Premium
 ('e0000000-0000-4000-8000-0000000000f2','member','pro',true);        -- X: Pro (tweede gebruiker)
insert into public.subsidie_kompas_organizations(id,user_id) values
 ('01000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-00000000000a'),
 ('01000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-00000000000b'),
 ('01000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-0000000000e1');
insert into public.subsidie_kompas_programs(id,user_id,organization_id,name,budget_total) values
 ('11000000-0000-4000-8000-0000000000a1','a0000000-0000-4000-8000-00000000000a','01000000-0000-4000-8000-000000000001','Project A1',100000),
 ('11000000-0000-4000-8000-0000000000a2','a0000000-0000-4000-8000-00000000000a','01000000-0000-4000-8000-000000000001','Project A2',50000),
 ('11000000-0000-4000-8000-0000000000b1','b0000000-0000-4000-8000-00000000000b','01000000-0000-4000-8000-000000000002','Project B1',70000),
 ('11000000-0000-4000-8000-0000000000e1','d0000000-0000-4000-8000-0000000000e1','01000000-0000-4000-8000-000000000003','Project P1',90000);
-- fondsen: F1 gratis, F2 Premium, F3 Pro
insert into public.funders(id,naam,website,access_tier) values
 ('f1000000-0000-4000-8000-000000000001','Gratis Fonds','https://gratis.example','free'),
 ('f2000000-0000-4000-8000-000000000002','Premium Fonds','https://premium.example','premium'),
 ('f3000000-0000-4000-8000-000000000003','Pro Fonds','https://pro.example','pro');
insert into public.subsidieregelingen(id,funder_id,naam,deadline_datum,access_tier) values
 ('51000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','Gratis Regeling','2099-03-01','free'),
 ('52000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000002','Premium Regeling','2099-04-01','premium'),
 ('53000000-0000-4000-8000-000000000003','f3000000-0000-4000-8000-000000000003','Pro Regeling met rondes','2099-05-01','pro'),
 ('54000000-0000-4000-8000-000000000004','f1000000-0000-4000-8000-000000000001','Te verwijderen Regeling','2099-06-01','free');
-- rondes voor regeling 53: een verstreken en twee toekomstige (volgende = 2099-07-15)
insert into public.subsidieregeling_rondes(funder_id,subsidieregeling_id,sluitingsdatum) values
 ('f3000000-0000-4000-8000-000000000003','53000000-0000-4000-8000-000000000003','2000-01-01'),
 ('f3000000-0000-4000-8000-000000000003','53000000-0000-4000-8000-000000000003','2099-09-30'),
 ('f3000000-0000-4000-8000-000000000003','53000000-0000-4000-8000-000000000003','2099-07-15');
-- funder-breed datamoment voor F1
insert into public.subsidieregeling_rondes(funder_id,subsidieregeling_id,type,sluitingsdatum) values
 ('f1000000-0000-4000-8000-000000000001',null,'aanvraagdeadline','2099-08-20');

-- ===== 1. RLS: eigen regels lezen, andermans niet =====
set role postgres;
insert into public.subsidie_kompas_program_funding(id,user_id,program_id,scheme_id,requested_amount,status,notes) values
 ('aa000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-00000000000a','11000000-0000-4000-8000-0000000000a1','51000000-0000-4000-8000-000000000001',30000,'submitted','notitie A'),
 ('bb000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-00000000000b','11000000-0000-4000-8000-0000000000b1','51000000-0000-4000-8000-000000000001',9999,'preparing','GEHEIM van B');

set role authenticated; select tt.als('a0000000-0000-4000-8000-00000000000a');
select tt.ok('1  A leest eigen funding', (select count(*) from public.subsidie_kompas_program_funding where notes='notitie A')=1);
select tt.ok('1  A ziet funding van B niet', (select count(*) from public.subsidie_kompas_program_funding where notes like 'GEHEIM%')=0 and (select count(*) from public.subsidie_kompas_program_funding)=1);

-- ===== 2. geen funding koppelen aan project van B =====
select tt.ok('2a A kan geen regel op project van B maken (user_id=A)',
  tt.state($q$insert into public.subsidie_kompas_program_funding(user_id,program_id,scheme_id) values ('a0000000-0000-4000-8000-00000000000a','11000000-0000-4000-8000-0000000000b1','51000000-0000-4000-8000-000000000001')$q$) <> 'ok');
select tt.ok('2b A kan geen regel als B op project van B maken (user_id=B)',
  tt.state($q$insert into public.subsidie_kompas_program_funding(user_id,program_id,scheme_id) values ('b0000000-0000-4000-8000-00000000000b','11000000-0000-4000-8000-0000000000b1','53000000-0000-4000-8000-000000000003')$q$) <> 'ok');
select tt.ok('2c RLS-violatie (42501) voor user_id van een ander',
  tt.state($q$insert into public.subsidie_kompas_program_funding(user_id,program_id,scheme_id) values ('b0000000-0000-4000-8000-00000000000b','11000000-0000-4000-8000-0000000000b1','53000000-0000-4000-8000-000000000003')$q$) = '42501');
select tt.ok('2d composite FK (23503) bij eigen user_id op project van B',
  tt.state($q$insert into public.subsidie_kompas_program_funding(user_id,program_id,scheme_id) values ('a0000000-0000-4000-8000-00000000000a','11000000-0000-4000-8000-0000000000b1','53000000-0000-4000-8000-000000000003')$q$) in ('23503','42501'));
-- user_id weglaten: default auth.uid()
select tt.ok('2e insert zonder user_id lukt op eigen project',
  tt.state($q$insert into public.subsidie_kompas_program_funding(program_id,scheme_id,requested_amount) values ('11000000-0000-4000-8000-0000000000a1','53000000-0000-4000-8000-000000000003',5000)$q$) = 'ok');
select tt.ok('2e user_id default = auth.uid()',
  (select user_id from public.subsidie_kompas_program_funding where scheme_id='53000000-0000-4000-8000-000000000003') = 'a0000000-0000-4000-8000-00000000000a');

-- ===== 3. onveranderlijke velden =====
select tt.ok('3a A kan user_id niet wijzigen', tt.state($q$update public.subsidie_kompas_program_funding set user_id='b0000000-0000-4000-8000-00000000000b' where id='aa000000-0000-4000-8000-000000000001'$q$) = '42501');
select tt.ok('3b A kan program_id niet wijzigen (naar eigen ander project)', tt.state($q$update public.subsidie_kompas_program_funding set program_id='11000000-0000-4000-8000-0000000000a2' where id='aa000000-0000-4000-8000-000000000001'$q$) = '42501');
select tt.ok('3c A kan program_id niet naar project van B zetten', tt.state($q$update public.subsidie_kompas_program_funding set program_id='11000000-0000-4000-8000-0000000000b1' where id='aa000000-0000-4000-8000-000000000001'$q$) = '42501');
select tt.ok('3d A kan scheme_id niet wijzigen', tt.state($q$update public.subsidie_kompas_program_funding set scheme_id='52000000-0000-4000-8000-000000000002' where id='aa000000-0000-4000-8000-000000000001'$q$) = '42501');
select tt.ok('3e A kan funder_id niet zetten', tt.state($q$update public.subsidie_kompas_program_funding set funder_id='f1000000-0000-4000-8000-000000000001' where id='aa000000-0000-4000-8000-000000000001'$q$) = '42501');
select tt.ok('3f A kan scheme_id niet op NULL zetten', tt.state($q$update public.subsidie_kompas_program_funding set scheme_id=null where id='aa000000-0000-4000-8000-000000000001'$q$) = '42501');
select tt.ok('3g A kan created_at/updated_at niet zetten', tt.state($q$update public.subsidie_kompas_program_funding set created_at='2000-01-01' where id='aa000000-0000-4000-8000-000000000001'$q$) = '42501');
select tt.ok('3h A kan id niet wijzigen', tt.state($q$update public.subsidie_kompas_program_funding set id=gen_random_uuid() where id='aa000000-0000-4000-8000-000000000001'$q$) = '42501');
-- wel wijzigbaar
select tt.ok('3i A kan bedragen, status, deadline, reminder en notitie wijzigen',
  tt.state($q$update public.subsidie_kompas_program_funding set requested_amount=31000, awarded_amount=25000, status='awarded', eigen_deadline='2099-12-01', reminder_enabled=false, notes='nieuw' where id='aa000000-0000-4000-8000-000000000001'$q$) = 'ok');
select tt.ok('3i de wijziging is opgeslagen',
  (select awarded_amount from public.subsidie_kompas_program_funding where id='aa000000-0000-4000-8000-000000000001') = 25000);
select tt.ok('3j updated_at wordt door de database gezet, created_at blijft',
  (select updated_at > created_at from public.subsidie_kompas_program_funding where id='aa000000-0000-4000-8000-000000000001'));

-- zelfde bescherming op triggerniveau (ook als een rol wel UPDATE-recht zou hebben, bv. service_role)
reset role;
set role service_role;
select tt.ok('3k trigger: program_id onveranderlijk ook voor service_role', tt.state($q$update public.subsidie_kompas_program_funding set program_id='11000000-0000-4000-8000-0000000000a2' where id='aa000000-0000-4000-8000-000000000001'$q$) = '23514');
select tt.ok('3l trigger: user_id onveranderlijk ook voor service_role', tt.state($q$update public.subsidie_kompas_program_funding set user_id='b0000000-0000-4000-8000-00000000000b' where id='aa000000-0000-4000-8000-000000000001'$q$) = '23514');
select tt.ok('3m trigger: scheme_id kan niet naar een andere bron', tt.state($q$update public.subsidie_kompas_program_funding set scheme_id='52000000-0000-4000-8000-000000000002' where id='aa000000-0000-4000-8000-000000000001'$q$) = '23514');
select tt.ok('3n trigger: funder_id niet te zetten op een regelingregel (CHECK/trigger)', tt.state($q$update public.subsidie_kompas_program_funding set funder_id='f1000000-0000-4000-8000-000000000001' where id='aa000000-0000-4000-8000-000000000001'$q$) in ('23514'));
reset role;

-- ===== 4. RLS op wijzigen/verwijderen van andermans regel =====
set role authenticated; select tt.als('b0000000-0000-4000-8000-00000000000b');
select tt.ok('4a B kan funding van A niet aanpassen (0 rijen)', tt.n($q$update public.subsidie_kompas_program_funding set notes='GEHACKT' where id='aa000000-0000-4000-8000-000000000001' returning 1$q$)=0);
select tt.ok('4b B kan funding van A niet verwijderen (0 rijen)', tt.n($q$delete from public.subsidie_kompas_program_funding where id='aa000000-0000-4000-8000-000000000001' returning 1$q$)=0);
reset role;
select tt.ok('4c regel van A is ongewijzigd', (select notes from public.subsidie_kompas_program_funding where id='aa000000-0000-4000-8000-000000000001')='nieuw');
set role anon;
select tt.ok('4d anon heeft geen toegang tot de tabel', tt.state('select 1 from public.subsidie_kompas_program_funding') = '42501');
reset role;

-- ===== 5. status/bedragen/bron-constraints =====
set role authenticated; select tt.als('a0000000-0000-4000-8000-00000000000a');
select tt.ok('5a ongeldige status geweigerd', tt.state($q$update public.subsidie_kompas_program_funding set status='gewonnen' where id='aa000000-0000-4000-8000-000000000001'$q$) = '23514');
select tt.ok('5b negatief bedrag geweigerd', tt.state($q$update public.subsidie_kompas_program_funding set requested_amount=-1 where id='aa000000-0000-4000-8000-000000000001'$q$) = '23514');
select tt.ok('5c beide bronnen bij insert geweigerd', tt.state($q$insert into public.subsidie_kompas_program_funding(program_id,scheme_id,funder_id) values ('11000000-0000-4000-8000-0000000000a2','51000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001')$q$) = '23514');
select tt.ok('5d geen bron bij insert geweigerd', tt.state($q$insert into public.subsidie_kompas_program_funding(program_id) values ('11000000-0000-4000-8000-0000000000a2')$q$) = '23514');
select tt.ok('5e te lange notitie geweigerd', tt.state($q$update public.subsidie_kompas_program_funding set notes=repeat('x',4001) where id='aa000000-0000-4000-8000-000000000001'$q$) = '23514');
-- uniciteit
select tt.ok('5f dubbele regeling per project geblokkeerd (23505)', tt.state($q$insert into public.subsidie_kompas_program_funding(program_id,scheme_id) values ('11000000-0000-4000-8000-0000000000a1','51000000-0000-4000-8000-000000000001')$q$) = '23505');
select tt.ok('5g dezelfde regeling in een ander project mag wel', tt.state($q$insert into public.subsidie_kompas_program_funding(program_id,scheme_id) values ('11000000-0000-4000-8000-0000000000a2','51000000-0000-4000-8000-000000000001')$q$) = 'ok');
select tt.ok('5h fonds-regel aanmaken', tt.state($q$insert into public.subsidie_kompas_program_funding(program_id,funder_id,requested_amount) values ('11000000-0000-4000-8000-0000000000a1','f1000000-0000-4000-8000-000000000001',1000)$q$) = 'ok');
select tt.ok('5i dubbel fonds per project geblokkeerd (23505)', tt.state($q$insert into public.subsidie_kompas_program_funding(program_id,funder_id) values ('11000000-0000-4000-8000-0000000000a1','f1000000-0000-4000-8000-000000000001')$q$) = '23505');
select tt.ok('5j regeling en fonds mogen naast elkaar in een project (verschillende sleutels)', tt.state($q$insert into public.subsidie_kompas_program_funding(program_id,funder_id) values ('11000000-0000-4000-8000-0000000000a1','f3000000-0000-4000-8000-000000000003')$q$) = 'ok');
reset role;

-- ===== 6. RPC: toegang =====
set role authenticated; select tt.als('a0000000-0000-4000-8000-00000000000a');
select tt.ok('6a RPC geeft eigen regels (project A1)', (select count(*) from public.kompas_dekkingsplan('11000000-0000-4000-8000-0000000000a1'))=4);
select tt.ok('6b RPC weigert project van B (42501)', tt.state($q$select * from public.kompas_dekkingsplan('11000000-0000-4000-8000-0000000000b1')$q$) = '42501');
select tt.ok('6c RPC: onbekend project geeft dezelfde fout (geen bestaanslek)', tt.state($q$select * from public.kompas_dekkingsplan('99999999-9999-4999-8999-999999999999')$q$) = '42501');
select tt.ok('6d RPC: null project geweigerd', tt.state($q$select * from public.kompas_dekkingsplan(null)$q$) = '42501');
select tt.ok('6e RPC lekt geen regels van andere gebruikers', not exists (select 1 from public.kompas_dekkingsplan('11000000-0000-4000-8000-0000000000a1') x where x.notes like 'GEHEIM%' or x.requested_amount = 9999));
select tt.ok('6f RPC levert alleen regels van het gevraagde project', not exists (select 1 from public.kompas_dekkingsplan('11000000-0000-4000-8000-0000000000a1') x where x.program_id <> '11000000-0000-4000-8000-0000000000a1'));
select tt.als(null);
select tt.ok('6g RPC zonder ingelogde gebruiker geweigerd (28000)', tt.state($q$select * from public.kompas_dekkingsplan('11000000-0000-4000-8000-0000000000a1')$q$) = '28000');
reset role;
set role anon;
select tt.ok('6h anon mag de RPC niet uitvoeren (42501)', tt.state($q$select * from public.kompas_dekkingsplan('11000000-0000-4000-8000-0000000000a1')$q$) = '42501');
reset role;
-- admin ziet projecten van anderen NIET via de RPC (strikt eigenaarschap)
set role authenticated; select tt.als('c0000000-0000-4000-8000-0000000000ad');
select tt.ok('6i ook admin: alleen eigen projecten via de RPC', tt.state($q$select * from public.kompas_dekkingsplan('11000000-0000-4000-8000-0000000000a1')$q$) = '42501');
reset role;

-- ===== 7. maskering per abonnement =====
-- A (Pro) neemt een Premium-regeling en een Premium-fonds op (rechtstreeks als postgres: bestaande data)
insert into public.subsidie_kompas_program_funding(user_id,program_id,scheme_id,requested_amount,awarded_amount,status,eigen_deadline,notes,reminder_enabled) values
 ('a0000000-0000-4000-8000-00000000000a','11000000-0000-4000-8000-0000000000a2','52000000-0000-4000-8000-000000000002',12000,null,'preparing','2099-10-10','mijn notitie premium',true);
insert into public.subsidie_kompas_program_funding(user_id,program_id,funder_id,requested_amount,status) values
 ('a0000000-0000-4000-8000-00000000000a','11000000-0000-4000-8000-0000000000a2','f2000000-0000-4000-8000-000000000002',7000,'interesting');
set role authenticated; select tt.als('a0000000-0000-4000-8000-00000000000a');
create temp table t7 on commit drop as select * from public.kompas_dekkingsplan('11000000-0000-4000-8000-0000000000a2');
select tt.ok('7a Pro: Premium-regeling gemaskeerd (status verborgen)', exists (select 1 from t7 where bron_type='regeling' and bron_status='verborgen'));
select tt.ok('7b Pro: Premium-fonds gemaskeerd (status verborgen)', exists (select 1 from t7 where bron_type='fonds' and bron_status='verborgen'));
select tt.ok('7c gemaskerd: geen naam, fonds, website, systeemdeadline of bron-id',
  not exists (select 1 from t7 where bron_status='verborgen' and (bron_naam is not null or funder_naam is not null or website is not null or systeem_deadline is not null or systeem_deadline_bron is not null or scheme_id is not null or funder_id is not null)));
select tt.ok('7d gemaskerd: eigen bedragen, status, eigen deadline, notitie en reminder blijven zichtbaar',
  exists (select 1 from t7 where bron_type='regeling' and requested_amount=12000 and status='preparing' and eigen_deadline='2099-10-10' and notes='mijn notitie premium' and reminder_enabled and effectieve_deadline='2099-10-10')
  and exists (select 1 from t7 where bron_type='fonds' and requested_amount=7000));
select tt.ok('7e gemaskerd: nergens "Premium Fonds"/"Premium Regeling" in de uitvoer', not exists (select 1 from t7 where t7::text ilike '%Premium Fonds%' or t7::text ilike '%Premium Regeling%' or t7::text ilike '%premium.example%'));
reset role;

-- Premium ziet de bron wel
insert into public.subsidie_kompas_program_funding(user_id,program_id,scheme_id,requested_amount) values
 ('d0000000-0000-4000-8000-0000000000e1','11000000-0000-4000-8000-0000000000e1','52000000-0000-4000-8000-000000000002',20000);
set role authenticated; select tt.als('d0000000-0000-4000-8000-0000000000e1');
select tt.ok('7f Premium: Premium-regeling zichtbaar met naam, fonds, website en systeemdeadline', exists (select 1 from public.kompas_dekkingsplan('11000000-0000-4000-8000-0000000000e1') where bron_status='zichtbaar' and bron_naam='Premium Regeling' and funder_naam='Premium Fonds' and website='https://premium.example' and systeem_deadline='2099-04-01' and systeem_deadline_bron='regeling' and scheme_id is not null));
reset role;

-- ===== 8. downgrade: Premium -> Free =====
update public.profiles set subscription_tier='free', subscription_active=false where id='d0000000-0000-4000-8000-0000000000e1';
set role authenticated; select tt.als('d0000000-0000-4000-8000-0000000000e1');
select tt.ok('8a downgrade: Premium-bron wordt gemaskeerd', exists (select 1 from public.kompas_dekkingsplan('11000000-0000-4000-8000-0000000000e1') where bron_status='verborgen' and bron_naam is null and funder_naam is null and website is null and systeem_deadline is null and scheme_id is null));
select tt.ok('8b downgrade: eigen bedrag blijft zichtbaar', exists (select 1 from public.kompas_dekkingsplan('11000000-0000-4000-8000-0000000000e1') where requested_amount=20000));
select tt.ok('8c downgrade: eigen regel is nog te bewerken (notitie)', tt.state($q$update public.subsidie_kompas_program_funding set notes='na downgrade' where program_id='11000000-0000-4000-8000-0000000000e1'$q$)='ok');
reset role;
-- trial: premium met lopende proefperiode ziet de bron weer
update public.profiles set subscription_tier='premium', subscription_active=false, trial_ends_at = now() + interval '5 days' where id='d0000000-0000-4000-8000-0000000000e1';
set role authenticated; select tt.als('d0000000-0000-4000-8000-0000000000e1');
select tt.ok('8d proefperiode (trial) telt als Premium', exists (select 1 from public.kompas_dekkingsplan('11000000-0000-4000-8000-0000000000e1') where bron_status='zichtbaar'));
reset role;
update public.profiles set trial_ends_at = now() - interval '1 day' where id='d0000000-0000-4000-8000-0000000000e1';
set role authenticated; select tt.als('d0000000-0000-4000-8000-0000000000e1');
select tt.ok('8e verlopen proefperiode: weer gemaskeerd', exists (select 1 from public.kompas_dekkingsplan('11000000-0000-4000-8000-0000000000e1') where bron_status='verborgen'));
reset role;
-- admin met eigen project ziet alles
update public.profiles set role='admin' where id='d0000000-0000-4000-8000-0000000000e1';
set role authenticated; select tt.als('d0000000-0000-4000-8000-0000000000e1');
select tt.ok('8f admin-rol telt als Premium (zichtbaar)', exists (select 1 from public.kompas_dekkingsplan('11000000-0000-4000-8000-0000000000e1') where bron_status='zichtbaar'));
reset role;
update public.profiles set role='member', subscription_tier='free', subscription_active=false where id='d0000000-0000-4000-8000-0000000000e1';

-- Pro-bron voor Free gemaskeerd, voor Pro zichtbaar
insert into public.subsidie_kompas_program_funding(user_id,program_id,scheme_id) values
 ('b0000000-0000-4000-8000-00000000000b','11000000-0000-4000-8000-0000000000b1','53000000-0000-4000-8000-000000000003');
set role authenticated; select tt.als('b0000000-0000-4000-8000-00000000000b');
select tt.ok('8g Free: Pro-regeling gemaskeerd, gratis regeling zichtbaar',
  exists (select 1 from public.kompas_dekkingsplan('11000000-0000-4000-8000-0000000000b1') where bron_naam is null and bron_status='verborgen')
  and exists (select 1 from public.kompas_dekkingsplan('11000000-0000-4000-8000-0000000000b1') where bron_naam='Gratis Regeling' and bron_status='zichtbaar'));
reset role;

-- ===== 9. deadlines: geen snapshot, eigen datum wint =====
set role authenticated; select tt.als('a0000000-0000-4000-8000-00000000000a');
create temp table t9 on commit drop as select * from public.kompas_dekkingsplan('11000000-0000-4000-8000-0000000000a1');
select tt.ok('9a regeling zonder rondes: systeemdeadline = regelingdeadline', exists (select 1 from t9 where bron_naam='Gratis Regeling' and systeem_deadline='2099-03-01' and systeem_deadline_bron='regeling'));
select tt.ok('9b regeling met rondes: eerstvolgende toekomstige ronde (verstreken genegeerd)', exists (select 1 from t9 where bron_naam='Pro Regeling met rondes' and systeem_deadline='2099-07-15' and systeem_deadline_bron='ronde'));
select tt.ok('9c fonds: volgend datamoment van het fonds', exists (select 1 from t9 where bron_type='fonds' and bron_naam='Gratis Fonds' and systeem_deadline='2099-08-20' and systeem_deadline_bron='fonds'));
select tt.ok('9d eigen deadline overschrijft systeemdeadline in effectieve deadline', exists (select 1 from t9 where bron_naam='Gratis Regeling' and eigen_deadline='2099-12-01' and effectieve_deadline='2099-12-01' and systeem_deadline='2099-03-01'));
select tt.ok('9e zonder eigen datum: effectieve deadline = systeemdeadline', exists (select 1 from t9 where bron_naam='Pro Regeling met rondes' and eigen_deadline is null and effectieve_deadline='2099-07-15'));
reset role;
-- geen snapshot: verander de regelingdeadline en de RPC volgt direct
update public.subsidieregelingen set deadline_datum='2099-03-15' where id='51000000-0000-4000-8000-000000000001';
set role authenticated; select tt.als('a0000000-0000-4000-8000-00000000000a');
select tt.ok('9f geen snapshot: gewijzigde regelingdeadline direct zichtbaar', exists (select 1 from public.kompas_dekkingsplan('11000000-0000-4000-8000-0000000000a1') where bron_naam='Gratis Regeling' and systeem_deadline='2099-03-15'));
reset role;
select tt.ok('9g tabel bevat geen naam-, budget- of deadline-snapshotkolommen',
  not exists (select 1 from information_schema.columns where table_name='subsidie_kompas_program_funding' and column_name in ('naam','name','bron_naam','budget','budget_total','deadline','systeem_deadline','funder_naam','website')));

-- ===== 10. bron verwijderd =====
insert into public.subsidie_kompas_program_funding(user_id,program_id,scheme_id,requested_amount,awarded_amount,status,eigen_deadline,notes,reminder_enabled) values
 ('a0000000-0000-4000-8000-00000000000a','11000000-0000-4000-8000-0000000000a1','54000000-0000-4000-8000-000000000004',4000,3500,'awarded','2099-11-11','blijft bestaan',false);
delete from public.subsidieregelingen where id='54000000-0000-4000-8000-000000000004';
select tt.ok('10a regeling verwijderd: fundingregel blijft bestaan met scheme_id NULL', exists (select 1 from public.subsidie_kompas_program_funding where notes='blijft bestaan' and scheme_id is null and funder_id is null));
select tt.ok('10b na verwijderde bron blijven bedragen, status, eigen deadline, notitie en reminder', exists (select 1 from public.subsidie_kompas_program_funding where notes='blijft bestaan' and requested_amount=4000 and awarded_amount=3500 and status='awarded' and eigen_deadline='2099-11-11' and reminder_enabled=false));
set role authenticated; select tt.als('a0000000-0000-4000-8000-00000000000a');
select tt.ok('10c RPC: bron_status verwijderd, bron_type NULL, eigen velden intact', exists (select 1 from public.kompas_dekkingsplan('11000000-0000-4000-8000-0000000000a1') where bron_status='verwijderd' and bron_type is null and bron_naam is null and requested_amount=4000 and effectieve_deadline='2099-11-11'));
select tt.ok('10d regel zonder bron blijft bewerkbaar', tt.state($q$update public.subsidie_kompas_program_funding set notes='nog steeds bewerkbaar', requested_amount=4100 where notes='blijft bestaan'$q$)='ok');
select tt.ok('10e regel zonder bron kan geen nieuwe bron krijgen (scheme_id)', tt.state($q$update public.subsidie_kompas_program_funding set scheme_id='51000000-0000-4000-8000-000000000001' where notes='nog steeds bewerkbaar'$q$) in ('42501','23514'));
reset role;
select tt.ok('10f ook via trigger: bron die weg is komt niet terug', tt.state($q$update public.subsidie_kompas_program_funding set scheme_id='51000000-0000-4000-8000-000000000001' where notes='nog steeds bewerkbaar'$q$) = '23514');
-- fonds verwijderen: cascade naar regelingen -> beide soorten regels blijven
insert into public.funders(id,naam,access_tier) values ('f4000000-0000-4000-8000-000000000004','Tijdelijk Fonds','free');
insert into public.subsidieregelingen(id,funder_id,naam,access_tier) values ('55000000-0000-4000-8000-000000000005','f4000000-0000-4000-8000-000000000004','Regeling van tijdelijk fonds','free');
insert into public.subsidie_kompas_program_funding(user_id,program_id,funder_id,notes,requested_amount) values ('a0000000-0000-4000-8000-00000000000a','11000000-0000-4000-8000-0000000000a2','f4000000-0000-4000-8000-000000000004','fonds-regel',1500);
insert into public.subsidie_kompas_program_funding(user_id,program_id,scheme_id,notes,requested_amount) values ('a0000000-0000-4000-8000-00000000000a','11000000-0000-4000-8000-0000000000a2','55000000-0000-4000-8000-000000000005','regeling-regel',2500);
delete from public.funders where id='f4000000-0000-4000-8000-000000000004';
select tt.ok('10g fonds verwijderd (met cascade op regeling): beide fundingregels blijven bestaan met bedragen', (select count(*) from public.subsidie_kompas_program_funding where notes in ('fonds-regel','regeling-regel') and scheme_id is null and funder_id is null and requested_amount in (1500,2500))=2);

-- ===== 11. cascade bij project/gebruiker =====
insert into public.subsidie_kompas_programs(id,user_id,organization_id,name) values ('11000000-0000-4000-8000-0000000000c1','e0000000-0000-4000-8000-0000000000f2','01000000-0000-4000-8000-000000000001','Project X');
insert into public.subsidie_kompas_program_funding(user_id,program_id,scheme_id) values ('e0000000-0000-4000-8000-0000000000f2','11000000-0000-4000-8000-0000000000c1','51000000-0000-4000-8000-000000000001');
delete from public.subsidie_kompas_programs where id='11000000-0000-4000-8000-0000000000c1';
select tt.ok('11a project verwijderd: bijbehorende fundingregels verdwijnen mee', (select count(*) from public.subsidie_kompas_program_funding where program_id='11000000-0000-4000-8000-0000000000c1')=0);
insert into public.subsidie_kompas_programs(id,user_id,organization_id,name) values ('11000000-0000-4000-8000-0000000000c2','e0000000-0000-4000-8000-0000000000f2','01000000-0000-4000-8000-000000000001','Project X2');
insert into public.subsidie_kompas_program_funding(user_id,program_id,scheme_id) values ('e0000000-0000-4000-8000-0000000000f2','11000000-0000-4000-8000-0000000000c2','51000000-0000-4000-8000-000000000001');
delete from auth.users where id='e0000000-0000-4000-8000-0000000000f2';
select tt.ok('11b gebruiker verwijderd: fundingregels verdwijnen mee', (select count(*) from public.subsidie_kompas_program_funding where user_id='e0000000-0000-4000-8000-0000000000f2')=0);

-- ===== 12. premium_exclusive (voorstel 20261009100000): kolom nog niet aanwezig -> RPC werkt; daarna hard verborgen =====
select tt.ok('12a RPC werkt zonder premium_exclusive-kolom (hierboven bewezen)', true);
alter table public.funders add column premium_exclusive boolean not null default false;
update public.funders set premium_exclusive = true where id='f1000000-0000-4000-8000-000000000001';  -- gratis fonds, maar expliciet exclusief
set role authenticated; select tt.als('a0000000-0000-4000-8000-00000000000a');
select tt.ok('12b exclusief fonds voor Pro verborgen, ook al staat het op access_tier free',
  not exists (select 1 from public.kompas_dekkingsplan('11000000-0000-4000-8000-0000000000a1') where bron_naam in ('Gratis Regeling','Gratis Fonds')) and
  exists (select 1 from public.kompas_dekkingsplan('11000000-0000-4000-8000-0000000000a1') where bron_status='verborgen' and requested_amount=30000 or requested_amount=31000));
reset role;
update public.profiles set subscription_tier='premium', subscription_active=true where id='a0000000-0000-4000-8000-00000000000a';
set role authenticated; select tt.als('a0000000-0000-4000-8000-00000000000a');
select tt.ok('12c exclusief fonds voor Premium zichtbaar', exists (select 1 from public.kompas_dekkingsplan('11000000-0000-4000-8000-0000000000a1') where bron_naam='Gratis Regeling' and bron_status='zichtbaar'));
reset role;
rollback;
