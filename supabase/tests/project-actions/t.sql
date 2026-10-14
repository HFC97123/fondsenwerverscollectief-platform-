\set ON_ERROR_STOP off
insert into auth.users values ('aaaaaaaa-0000-4000-8000-000000000001'),('bbbbbbbb-0000-4000-8000-000000000002');
insert into public.subsidie_kompas_programs (id,user_id,naam) values ('11111111-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001','A-project'),('22222222-0000-4000-8000-000000000002','bbbbbbbb-0000-4000-8000-000000000002','B-project'),('33333333-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000001','A-project2');
insert into public.subsidie_kompas_program_funding (id,user_id,program_id,financier_naam) values ('f1111111-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','Fonds A'),('f3333333-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000001','33333333-0000-4000-8000-000000000003','Fonds P2');
set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000001',false);
\echo T1 insert eigen taak (verwacht OK)
insert into public.subsidie_kompas_program_actions (user_id,program_id,title,due_date,priority,funding_id,financier_label) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','  Vooroverleg plannen ','2026-10-25','high','f1111111-0000-4000-8000-000000000001','Fonds A') returning title,status,priority,completed_at is null as geen_klaar;
\echo T2 insert op project van ander (verwacht FOUT)
insert into public.subsidie_kompas_program_actions (user_id,program_id,title) values ('aaaaaaaa-0000-4000-8000-000000000001','22222222-0000-4000-8000-000000000002','Hack');
\echo T3 insert als andere user_id (verwacht FOUT)
insert into public.subsidie_kompas_program_actions (user_id,program_id,title) values ('bbbbbbbb-0000-4000-8000-000000000002','22222222-0000-4000-8000-000000000002','Hack2');
\echo T4 funding_id van ander project (verwacht FOUT)
insert into public.subsidie_kompas_program_actions (user_id,program_id,title,funding_id) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','X','f3333333-0000-4000-8000-000000000003');
\echo T5 lege titel (verwacht FOUT) en ongeldige status/prioriteit (verwacht FOUT x2)
insert into public.subsidie_kompas_program_actions (user_id,program_id,title) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','   ');
insert into public.subsidie_kompas_program_actions (user_id,program_id,title,status) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','S','klaar');
insert into public.subsidie_kompas_program_actions (user_id,program_id,title,priority) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','P','urgent');
\echo T6 afronden zet completed_at; heropenen wist het (verwacht true, daarna true)
update public.subsidie_kompas_program_actions set status='done' where title='Vooroverleg plannen' returning completed_at is not null as klaar_gezet;
update public.subsidie_kompas_program_actions set status='todo' where title='Vooroverleg plannen' returning completed_at is null as wiskt;
\echo T7 immutabele velden: program_id, source (verwacht FOUT x2 - kolomrechten of trigger)
update public.subsidie_kompas_program_actions set program_id='33333333-0000-4000-8000-000000000003' where title='Vooroverleg plannen';
update public.subsidie_kompas_program_actions set source='chat' where title='Vooroverleg plannen';
\echo T8 titel en notitie wijzigen (verwacht OK)
update public.subsidie_kompas_program_actions set title=' Vooroverleg met Fonds A ', notes='Bel de contactpersoon' where title='Vooroverleg plannen' returning title;
\echo T9 chat-taak met proposed_at (verwacht OK)
insert into public.subsidie_kompas_program_actions (user_id,program_id,title,source,proposed_at) values ('aaaaaaaa-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001','Begroting controleren','chat',now()) returning source;
\echo T10 gebruiker B ziet geen taken van A (verwacht 0) en kan niet wijzigen/verwijderen (0 rijen)
reset role; set role authenticated; select set_config('request.jwt.claim.sub','bbbbbbbb-0000-4000-8000-000000000002',false);
select count(*) as zichtbaar_voor_b from public.subsidie_kompas_program_actions;
update public.subsidie_kompas_program_actions set title='gekaapt';
delete from public.subsidie_kompas_program_actions;
\echo T11 anon: geen toegang (verwacht FOUT)
reset role; set role anon; select count(*) from public.subsidie_kompas_program_actions;
\echo T12 funding verwijderd: taak blijft, funding_id null (verwacht 2 taken, funding null)
reset role; delete from public.subsidie_kompas_program_funding where id='f1111111-0000-4000-8000-000000000001';
select title, funding_id is null as losgekoppeld from public.subsidie_kompas_program_actions order by title;
\echo T13 project verwijderd: taken verdwijnen (verwacht 0)
delete from public.subsidie_kompas_programs where id='11111111-0000-4000-8000-000000000001';
select count(*) as rest from public.subsidie_kompas_program_actions;
\echo T14 maximum 200 taken per project
insert into public.subsidie_kompas_program_actions (user_id,program_id,title) select 'aaaaaaaa-0000-4000-8000-000000000001','33333333-0000-4000-8000-000000000003','t'||g from generate_series(1,200) g;
insert into public.subsidie_kompas_program_actions (user_id,program_id,title) values ('aaaaaaaa-0000-4000-8000-000000000001','33333333-0000-4000-8000-000000000003','nr 201');
