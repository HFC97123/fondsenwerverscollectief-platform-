-- Deadline-/classificatiereview batch 3 (30 regelingen open/doorlopend zonder toekomstige datum), DEEL A: alleen toevoegingen. Bronnen bekeken 11-10-2026. Idempotent.
insert into public.regios (naam)
select 'Ameland' where not exists (select 1 from public.regios r where lower(trim(r.naam))='ameland')
on conflict (naam) do nothing;

create temp table _b3 (rid uuid, soort text, naam text) on commit drop;
insert into _b3 values
 ('a277bd6d-0756-4474-a831-002f2d5dcc3f','t','Klimaat'),
 ('a277bd6d-0756-4474-a831-002f2d5dcc3f','r','Schiermonnikoog'),
 ('a277bd6d-0756-4474-a831-002f2d5dcc3f','r','Ameland'),
 ('145fbfbb-32b2-4c7c-bac0-9955881c1365','d','Buurtbewoners'),
 ('145fbfbb-32b2-4c7c-bac0-9955881c1365','d','Gemeenschappen'),
 ('145fbfbb-32b2-4c7c-bac0-9955881c1365','r','Friesland'),
 ('2eb898c7-d1cf-4e24-8e7b-88f1c3b5c5b8','d','Vrouwen en meisjes'),
 ('2eb898c7-d1cf-4e24-8e7b-88f1c3b5c5b8','d','Minderheden'),
 ('2eb898c7-d1cf-4e24-8e7b-88f1c3b5c5b8','d','Gemeenschappen'),
 ('2eb898c7-d1cf-4e24-8e7b-88f1c3b5c5b8','r','Den Haag'),
 ('4ddc51b5-ff16-4d00-9500-6ffe226ee309','d','Ouderen'),
 ('4ddc51b5-ff16-4d00-9500-6ffe226ee309','d','Mantelzorgers'),
 ('4ddc51b5-ff16-4d00-9500-6ffe226ee309','d','Mensen in een kwetsbare positie'),
 ('4ddc51b5-ff16-4d00-9500-6ffe226ee309','r','Den Haag'),
 ('78a984e8-cba7-401f-a39d-f3f659bde19b','t','Preventie'),
 ('78a984e8-cba7-401f-a39d-f3f659bde19b','d','Buurtbewoners'),
 ('78a984e8-cba7-401f-a39d-f3f659bde19b','r','Rotterdam'),
 ('6ebda98d-2fb2-4165-ad26-9fc894e72a2d','r','Utrecht'),
 ('bdbe26b1-bf39-4c57-a2f4-c5e1b4c20bc1','d','Kunstenaars'),
 ('bdbe26b1-bf39-4c57-a2f4-c5e1b4c20bc1','r','Utrecht'),
 ('2a25042e-50c5-459a-ae7f-286dc6724ac7','d','Kunstenaars'),
 ('2a25042e-50c5-459a-ae7f-286dc6724ac7','r','Utrecht'),
 ('dcb372f0-d7c3-4d31-88ff-974ee1e1fd19','t','Beurzen'),
 ('dcb372f0-d7c3-4d31-88ff-974ee1e1fd19','t','Onderwijs'),
 ('dcb372f0-d7c3-4d31-88ff-974ee1e1fd19','t','Internationalisering'),
 ('dcb372f0-d7c3-4d31-88ff-974ee1e1fd19','d','Jongeren'),
 ('dcb372f0-d7c3-4d31-88ff-974ee1e1fd19','r','Landelijk'),
 ('dcb372f0-d7c3-4d31-88ff-974ee1e1fd19','r','Wereld / internationaal'),
 ('63b169df-92bb-4357-ad76-f583e7b95a87','t','Medisch onderzoek'),
 ('63b169df-92bb-4357-ad76-f583e7b95a87','d','Kinderen'),
 ('63b169df-92bb-4357-ad76-f583e7b95a87','d','Jongeren'),
 ('63b169df-92bb-4357-ad76-f583e7b95a87','d','Patiënten'),
 ('63b169df-92bb-4357-ad76-f583e7b95a87','r','Landelijk'),
 ('8b7d5f83-5cb5-4181-9fcf-604a70873a05','r','Landelijk'),
 ('e0675b1b-9c0e-47d5-a0ad-9700aeb50895','r','Caribisch deel van het Koninkrijk'),
 ('5d540610-ff3a-4ddc-8653-68b32971a6a2','t','Nieuwe media'),
 ('5d540610-ff3a-4ddc-8653-68b32971a6a2','d','Kunstenaars'),
 ('5d540610-ff3a-4ddc-8653-68b32971a6a2','r','Caribisch deel van het Koninkrijk'),
 ('5f398d46-8a59-4885-b364-a7c973ee610b','t','Nieuwe media'),
 ('5f398d46-8a59-4885-b364-a7c973ee610b','r','Caribisch deel van het Koninkrijk'),
 ('abe03f74-c7cb-443a-899a-153dcc4e7128','t','Internationalisering'),
 ('abe03f74-c7cb-443a-899a-153dcc4e7128','d','Kunstenaars'),
 ('abe03f74-c7cb-443a-899a-153dcc4e7128','r','Caribisch deel van het Koninkrijk'),
 ('abe03f74-c7cb-443a-899a-153dcc4e7128','r','Wereld / internationaal'),
 ('85302b50-f06e-4980-943a-ae0743c658c0','r','Caribisch deel van het Koninkrijk'),
 ('793861e8-3e74-4cb3-88bc-29a79c4be9b7','d','Kunstenaars'),
 ('793861e8-3e74-4cb3-88bc-29a79c4be9b7','r','Caribisch deel van het Koninkrijk'),
 ('46ff6224-12fa-48b3-a0bf-1037b20333ba','t','Community building'),
 ('46ff6224-12fa-48b3-a0bf-1037b20333ba','d','Buurtbewoners'),
 ('46ff6224-12fa-48b3-a0bf-1037b20333ba','r','Noord-Brabant'),
 ('de04d0f0-4c8f-404f-ab20-4ebba7c7db6b','t','Klimaat'),
 ('de04d0f0-4c8f-404f-ab20-4ebba7c7db6b','d','Buurtbewoners'),
 ('de04d0f0-4c8f-404f-ab20-4ebba7c7db6b','r','Noord-Brabant'),
 ('76216145-f596-4974-ab03-e63e1f605da1','t','Onderzoek'),
 ('76216145-f596-4974-ab03-e63e1f605da1','d','Kunstenaars'),
 ('b372fa96-ad72-4100-942f-a3eb6a37bac7','t','Amateurkunst'),
 ('b372fa96-ad72-4100-942f-a3eb6a37bac7','r','Zuid-Holland'),
 ('0433e8de-7872-4d33-9276-326a7050d903','t','Klimaat'),
 ('0433e8de-7872-4d33-9276-326a7050d903','r','Noord-Brabant'),
 ('9e6341dd-942c-485d-80a2-44984de312ee','d','Mensen in armoede'),
 ('04250edf-b56d-4f38-9d75-eec45a9aa83b','d','Mensen met een beperking'),
 ('04250edf-b56d-4f38-9d75-eec45a9aa83b','d','Mensen met een chronische aandoening'),
 ('2c953c6e-ad0c-4a00-808e-1e0a85ae0475','t','Jeugd en kinderen'),
 ('2c953c6e-ad0c-4a00-808e-1e0a85ae0475','d','Kinderen'),
 ('2c953c6e-ad0c-4a00-808e-1e0a85ae0475','d','Mensen met een beperking'),
 ('7d609e58-11ce-43a5-9fed-a22f0f880d8e','d','Kinderen'),
 ('7d609e58-11ce-43a5-9fed-a22f0f880d8e','d','Mensen met een beperking'),
 ('7d609e58-11ce-43a5-9fed-a22f0f880d8e','r','Landelijk'),
 ('b68ac57e-50a5-44cf-a266-077147165404','d','Kinderen'),
 ('b68ac57e-50a5-44cf-a266-077147165404','d','Mensen met een beperking'),
 ('6096f8a7-66c1-4ca3-a91a-ed29b654d555','t','Zorg'),
 ('6096f8a7-66c1-4ca3-a91a-ed29b654d555','t','Kunst'),
 ('6096f8a7-66c1-4ca3-a91a-ed29b654d555','t','Educatie'),
 ('6096f8a7-66c1-4ca3-a91a-ed29b654d555','r','Den Haag'),
 ('ac1f1e1a-8266-4ab6-a862-ff2ae6928161','t','Nieuwe media'),
 ('ac1f1e1a-8266-4ab6-a862-ff2ae6928161','r','Caribisch deel van het Koninkrijk');

do $$
declare v_n int;
begin
  select count(*) into v_n from _b3 b where
    (b.soort='t' and not exists (select 1 from public.themas x where x.naam=b.naam)) or
    (b.soort='d' and not exists (select 1 from public.doelgroepen x where x.naam=b.naam)) or
    (b.soort='r' and not exists (select 1 from public.regios x where x.naam=b.naam)) or
    not exists (select 1 from public.subsidieregelingen s where s.id=b.rid);
  if v_n > 0 then raise exception '% onbekende waarden of regelingen in batch 3', v_n; end if;
end $$;

insert into public.subsidieregeling_themas (subsidieregeling_id, thema_id)
select b.rid, x.id from _b3 b join public.themas x on x.naam=b.naam where b.soort='t' on conflict do nothing;
insert into public.subsidieregeling_doelgroepen (subsidieregeling_id, doelgroep_id)
select b.rid, x.id from _b3 b join public.doelgroepen x on x.naam=b.naam where b.soort='d' on conflict do nothing;
insert into public.subsidieregeling_regios (subsidieregeling_id, regio_id)
select b.rid, x.id from _b3 b join public.regios x on x.naam=b.naam where b.soort='r' on conflict do nothing;
