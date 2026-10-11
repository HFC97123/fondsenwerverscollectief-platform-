-- Deadline-/classificatiereview batch 1, deel A: alleen toevoegingen (geen updates/deletes). Bronnen bekeken 11-10-2026.
insert into public.regios (naam)
select v.naam from (values ('Caribisch deel van het Koninkrijk'),('Caribisch gebied'),('Midden-Oosten'),('Latijns-Amerika'),('Oost-Europa'),('Deventer')) v(naam)
where not exists (select 1 from public.regios r where lower(trim(r.naam)) = lower(trim(v.naam)))
on conflict (naam) do nothing;

create temp table _b1 (rid uuid, soort text, naam text) on commit drop;
insert into _b1 values
 ('443e43c8-7d38-456b-a0e8-56ae5d159f0e','t','Innovatie in gezondheidszorg'),
 ('73639383-acad-4e00-8c97-141ea3592989','t','Klimaat'),('73639383-acad-4e00-8c97-141ea3592989','t','Circulaire innovatie'),('73639383-acad-4e00-8c97-141ea3592989','t','Community development'),('73639383-acad-4e00-8c97-141ea3592989','t','Ondernemerschap'),('73639383-acad-4e00-8c97-141ea3592989','t','Leiderschapsontwikkeling'),('73639383-acad-4e00-8c97-141ea3592989','t','Gezondheid'),
 ('d1d4b5b1-1f60-4a4e-bfc7-62d75c35713c','t','Veiligheid'),
 ('b022f4ad-241c-4d44-bdc0-98d899ac7ac5','t','Theater en podiumkunsten'),('b022f4ad-241c-4d44-bdc0-98d899ac7ac5','t','Dans'),
 ('3ca1e7de-3bcc-4792-980a-ebadd6c85fff','t','Ontwikkelingshulp'),('3ca1e7de-3bcc-4792-980a-ebadd6c85fff','t','Armoedebestrijding'),('3ca1e7de-3bcc-4792-980a-ebadd6c85fff','t','Onderwijs'),('3ca1e7de-3bcc-4792-980a-ebadd6c85fff','t','Medisch onderzoek'),('3ca1e7de-3bcc-4792-980a-ebadd6c85fff','t','Noodhulp'),('3ca1e7de-3bcc-4792-980a-ebadd6c85fff','t','Dierenwelzijn'),
 ('b9a8d9ea-60b2-4453-bcca-21810ce6e049','t','Dierenwelzijn'),('b9a8d9ea-60b2-4453-bcca-21810ce6e049','t','Monumentenzorg'),
 ('db69a666-cb49-4733-b225-e8f5a16d8ce2','t','Klimaat'),
 ('a6101b87-71cf-4a0b-8803-f1454a2f972a','t','Beeldende kunst'),('a6101b87-71cf-4a0b-8803-f1454a2f972a','t','Architectuur'),('a6101b87-71cf-4a0b-8803-f1454a2f972a','t','Vormgeving'),
 ('a96ff2f5-0180-44c3-96f4-445cb79fa45b','d','Kinderen'),('a96ff2f5-0180-44c3-96f4-445cb79fa45b','d','Mensen met een beperking'),
 ('5470d589-2d3d-48a1-b833-54a8a82d743c','d','Kinderen'),('5470d589-2d3d-48a1-b833-54a8a82d743c','d','Mensen met een beperking'),
 ('ee50c277-b2c4-4b58-b755-def72c657265','d','Kinderen'),('ee50c277-b2c4-4b58-b755-def72c657265','d','Mensen met een beperking'),
 ('bdc35e0f-3b63-42b3-89a8-597c65a2ef19','d','Kinderen'),('bdc35e0f-3b63-42b3-89a8-597c65a2ef19','d','Mensen met een beperking'),
 ('443e43c8-7d38-456b-a0e8-56ae5d159f0e','d','Mensen met een chronische aandoening'),('443e43c8-7d38-456b-a0e8-56ae5d159f0e','d','Naasten van mensen met een chronische aandoening'),('443e43c8-7d38-456b-a0e8-56ae5d159f0e','d','Ervaringsdeskundigen'),
 ('73639383-acad-4e00-8c97-141ea3592989','d','Vrouwen en meisjes'),('73639383-acad-4e00-8c97-141ea3592989','d','Gemeenschappen'),
 ('d7e63c2b-402e-4b68-b9ec-e1fc983f9f45','d','Kunstenaars'),
 ('d1d4b5b1-1f60-4a4e-bfc7-62d75c35713c','d','Buurtbewoners'),('d1d4b5b1-1f60-4a4e-bfc7-62d75c35713c','d','Gemeenschappen'),
 ('79654d05-8820-457b-bceb-252687be9672','d','Kunstenaars'),
 ('b022f4ad-241c-4d44-bdc0-98d899ac7ac5','d','Kunstenaars'),
 ('8bd2b373-c2ec-400a-94d8-f42b9acf6d58','d','Vrijwilligers'),('8bd2b373-c2ec-400a-94d8-f42b9acf6d58','d','Buurtbewoners'),
 ('f3db2057-e027-4e0b-953b-712cedfe0c05','d','Buurtbewoners'),('f3db2057-e027-4e0b-953b-712cedfe0c05','d','Kunstenaars'),
 ('0e7e7ede-b201-402d-b497-bf813aa6e847','d','Kunstenaars'),('0e7e7ede-b201-402d-b497-bf813aa6e847','d','Jonge makers'),
 ('556fc1a8-ca7e-4dc2-969a-953ddf514895','d','Kunstenaars'),
 ('a6732788-d9ce-4546-87ba-8c0032e80152','d','Kunstenaars'),
 ('db69a666-cb49-4733-b225-e8f5a16d8ce2','d','Kunstenaars'),
 ('3dac1ac7-6260-469d-a654-f2e131d102a1','d','Vrijwilligers'),
 ('3ca1e7de-3bcc-4792-980a-ebadd6c85fff','d','Mensen in armoede'),('3ca1e7de-3bcc-4792-980a-ebadd6c85fff','d','Slachtoffers van noodhulp'),
 ('b9a8d9ea-60b2-4453-bcca-21810ce6e049','d','Dieren'),
 ('c6973445-6b87-41b9-bc83-1f004841fb3c','r','Caribisch deel van het Koninkrijk'),
 ('a96ff2f5-0180-44c3-96f4-445cb79fa45b','r','Landelijk'),('443e43c8-7d38-456b-a0e8-56ae5d159f0e','r','Landelijk'),('5470d589-2d3d-48a1-b833-54a8a82d743c','r','Landelijk'),('ee50c277-b2c4-4b58-b755-def72c657265','r','Landelijk'),
 ('3dac1ac7-6260-469d-a654-f2e131d102a1','r','Landelijk'),('a6101b87-71cf-4a0b-8803-f1454a2f972a','r','Landelijk'),('73639383-acad-4e00-8c97-141ea3592989','r','Landelijk'),('d1d4b5b1-1f60-4a4e-bfc7-62d75c35713c','r','Landelijk'),
 ('bdc35e0f-3b63-42b3-89a8-597c65a2ef19','r','Deventer'),
 ('d7e63c2b-402e-4b68-b9ec-e1fc983f9f45','r','Midden-Oosten'),('8bdad673-21f3-4c20-8b9f-e30821b815c2','r','Midden-Oosten'),
 ('79654d05-8820-457b-bceb-252687be9672','r','Utrecht'),('8bd2b373-c2ec-400a-94d8-f42b9acf6d58','r','Utrecht'),
 ('b022f4ad-241c-4d44-bdc0-98d899ac7ac5','r','Den Haag'),('f3db2057-e027-4e0b-953b-712cedfe0c05','r','Den Haag'),
 ('0e7e7ede-b201-402d-b497-bf813aa6e847','r','Latijns-Amerika'),('0e7e7ede-b201-402d-b497-bf813aa6e847','r','Caribisch gebied'),('0e7e7ede-b201-402d-b497-bf813aa6e847','r','Oost-Europa'),
 ('a6732788-d9ce-4546-87ba-8c0032e80152','r','Latijns-Amerika'),('a6732788-d9ce-4546-87ba-8c0032e80152','r','Caribisch gebied'),('a6732788-d9ce-4546-87ba-8c0032e80152','r','Oost-Europa'),
 ('db69a666-cb49-4733-b225-e8f5a16d8ce2','r','Latijns-Amerika'),('db69a666-cb49-4733-b225-e8f5a16d8ce2','r','Caribisch gebied'),('db69a666-cb49-4733-b225-e8f5a16d8ce2','r','Oost-Europa'),
 ('3ca1e7de-3bcc-4792-980a-ebadd6c85fff','r','Landelijk'),('3ca1e7de-3bcc-4792-980a-ebadd6c85fff','r','Afrika'),('3ca1e7de-3bcc-4792-980a-ebadd6c85fff','r','Azië'),
 ('b9a8d9ea-60b2-4453-bcca-21810ce6e049','r','Caribisch deel van het Koninkrijk');

do $$
declare v_n int;
begin
  select count(*) into v_n from _b1 b where
    (b.soort='t' and not exists (select 1 from public.themas x where x.naam=b.naam)) or
    (b.soort='d' and not exists (select 1 from public.doelgroepen x where x.naam=b.naam)) or
    (b.soort='r' and not exists (select 1 from public.regios x where x.naam=b.naam)) or
    not exists (select 1 from public.subsidieregelingen s where s.id=b.rid);
  if v_n > 0 then raise exception '% onbekende waarden of regelingen in batch 1', v_n; end if;
end $$;

insert into public.subsidieregeling_themas (subsidieregeling_id, thema_id)
select b.rid, x.id from _b1 b join public.themas x on x.naam=b.naam where b.soort='t' on conflict do nothing;
insert into public.subsidieregeling_doelgroepen (subsidieregeling_id, doelgroep_id)
select b.rid, x.id from _b1 b join public.doelgroepen x on x.naam=b.naam where b.soort='d' on conflict do nothing;
insert into public.subsidieregeling_regios (subsidieregeling_id, regio_id)
select b.rid, x.id from _b1 b join public.regios x on x.naam=b.naam where b.soort='r' on conflict do nothing;
