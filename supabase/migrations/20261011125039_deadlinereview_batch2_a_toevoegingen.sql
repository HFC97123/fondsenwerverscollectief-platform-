-- Deadline-/classificatiereview batch 2 (30 regelingen open/doorlopend zonder toekomstige datum), DEEL A: alleen toevoegingen. Bronnen bekeken 11-10-2026.
insert into public.regios (naam)
select 'Schiermonnikoog' where not exists (select 1 from public.regios r where lower(trim(r.naam))='schiermonnikoog')
on conflict (naam) do nothing;

create temp table _b2 (rid uuid, soort text, naam text) on commit drop;
insert into _b2 values
 ('6a24b05a-3f83-447f-a104-ebc2360e0534','d','Kunstenaars'),('6a24b05a-3f83-447f-a104-ebc2360e0534','r','Amsterdam'),
 ('89f64fd4-fedb-4cfa-8e95-90dc717ff37b','r','Amsterdam'),
 ('035e22ba-5025-41ed-8fb7-f1bbf3f9092b','r','Amsterdam'),
 ('b5c311fe-495f-4774-b807-9b8479c072ff','d','Kunstenaars'),('b5c311fe-495f-4774-b807-9b8479c072ff','r','Amsterdam'),
 ('b71a3771-595f-4e2f-a592-3e3cd340381c','r','Amsterdam'),
 ('5e82f286-f7cb-4d36-aad1-d7c6d7c252dd','r','Drenthe'),
 ('8d485eef-4a6b-4d38-ab7f-2bf40e1e8f7f','r','Europa'),
 ('3731df51-c602-484d-9b93-653d90382e27','r','Landelijk'),
 ('740ea244-59fd-4202-8252-272c9c8875b5','d','Gemeenschappen'),('740ea244-59fd-4202-8252-272c9c8875b5','r','Landelijk'),
 ('45941258-4f67-4aac-ab10-62bc47f925b4','r','Landelijk'),
 ('b98f373c-5e12-4731-b3ba-d0eb2663a68c','d','Kunstenaars'),('b98f373c-5e12-4731-b3ba-d0eb2663a68c','d','Jonge makers'),
 ('ba20b09e-b299-4e0e-ad3d-eb8abbd7d698','t','Opleiding / beroepsontwikkeling'),('ba20b09e-b299-4e0e-ad3d-eb8abbd7d698','d','Kunstenaars'),
 ('858e1714-2d35-43e3-90f6-001ea496065a','d','Kunstenaars'),('858e1714-2d35-43e3-90f6-001ea496065a','r','Caribisch deel van het Koninkrijk'),
 ('6f733414-a56f-465c-822b-fad8140ab45c','d','Kunstenaars'),
 ('197aaf18-3c3d-4698-9835-5dcb1fcdbb92','r','Caribisch deel van het Koninkrijk'),
 ('2b5d9200-b0e6-4ba5-8a2c-8af79b0d602a','r','Caribisch deel van het Koninkrijk'),
 ('a45180d4-ecbe-4df4-9ebb-6dc109580763','t','Talentontwikkeling'),('a45180d4-ecbe-4df4-9ebb-6dc109580763','d','Kunstenaars'),('a45180d4-ecbe-4df4-9ebb-6dc109580763','r','Caribisch deel van het Koninkrijk'),
 ('e245c806-6c4f-499f-8228-5009421a81b4','t','Nieuwe media'),('e245c806-6c4f-499f-8228-5009421a81b4','d','Kunstenaars'),('e245c806-6c4f-499f-8228-5009421a81b4','r','Caribisch deel van het Koninkrijk'),
 ('27910578-f101-4ecf-8eb0-1222b82fed5e','d','Kunstenaars'),('27910578-f101-4ecf-8eb0-1222b82fed5e','r','Caribisch deel van het Koninkrijk'),
 ('b2fe8cca-db1e-4644-a764-ad68d4d7fc67','d','Kunstenaars'),
 ('56de5502-29c8-4370-a538-a2eb79ab9224','d','Kunstenaars'),
 ('b6049cfd-0635-4ec9-9eab-f8b697f9557a','t','Community building'),('b6049cfd-0635-4ec9-9eab-f8b697f9557a','d','Jongeren'),('b6049cfd-0635-4ec9-9eab-f8b697f9557a','d','Gemeenschappen'),('b6049cfd-0635-4ec9-9eab-f8b697f9557a','d','Minderheden'),('b6049cfd-0635-4ec9-9eab-f8b697f9557a','r','Caribisch deel van het Koninkrijk'),
 ('da83e10e-9eea-4d97-ad80-c109309c5f31','r','Schiermonnikoog');

do $$
declare v_n int;
begin
  select count(*) into v_n from _b2 b where
    (b.soort='t' and not exists (select 1 from public.themas x where x.naam=b.naam)) or
    (b.soort='d' and not exists (select 1 from public.doelgroepen x where x.naam=b.naam)) or
    (b.soort='r' and not exists (select 1 from public.regios x where x.naam=b.naam)) or
    not exists (select 1 from public.subsidieregelingen s where s.id=b.rid);
  if v_n > 0 then raise exception '% onbekende waarden of regelingen in batch 2', v_n; end if;
end $$;

insert into public.subsidieregeling_themas (subsidieregeling_id, thema_id)
select b.rid, x.id from _b2 b join public.themas x on x.naam=b.naam where b.soort='t' on conflict do nothing;
insert into public.subsidieregeling_doelgroepen (subsidieregeling_id, doelgroep_id)
select b.rid, x.id from _b2 b join public.doelgroepen x on x.naam=b.naam where b.soort='d' on conflict do nothing;
insert into public.subsidieregeling_regios (subsidieregeling_id, regio_id)
select b.rid, x.id from _b2 b join public.regios x on x.naam=b.naam where b.soort='r' on conflict do nothing;
