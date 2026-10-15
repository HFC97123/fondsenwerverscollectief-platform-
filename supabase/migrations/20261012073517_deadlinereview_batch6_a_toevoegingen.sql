-- Deadline-/classificatiereview batch 6, DEEL A: alleen toevoegingen. Bronnen bekeken 12-10-2026. Idempotent. Geen nieuwe taxonomie.
create temp table _b6 (rid uuid, soort text, naam text) on commit drop;
insert into _b6 values
 ('ba84b8c0-d0bc-40db-bc93-ffb79e838edc','r','Caribisch deel van het Koninkrijk'),
 ('3c0d7430-2b70-4927-97e8-bd3b1679c765','r','Caribisch deel van het Koninkrijk'),
 ('fd35ad72-25fb-4ed5-9bfe-288c11297ae9','r','Caribisch deel van het Koninkrijk'),
 ('1203b9b0-5c35-47f1-a04c-4ccb5a2a0f83','r','Caribisch deel van het Koninkrijk'),
 ('4b643b70-af49-4e2c-977e-59c5f76d3436','r','Caribisch deel van het Koninkrijk'),
 ('da678581-5c9c-4e14-b75c-25ea8e45f96a','r','Caribisch deel van het Koninkrijk'),
 ('0b4f7030-66c2-451a-8755-2d1ffb3f7d4e','r','Caribisch deel van het Koninkrijk'),
 ('92d6628a-99f9-44a2-b40a-b5b5219eb8f8','r','Caribisch deel van het Koninkrijk'),
 ('87f41d87-2a32-4771-99cd-1a6bce587b8a','r','Caribisch deel van het Koninkrijk'),
 ('a884d3c2-ef70-4cba-8dd0-0e7dc3df9753','r','Caribisch deel van het Koninkrijk'),
 ('daa46500-bf1f-4562-bed0-9585caf12275','r','Caribisch deel van het Koninkrijk'),
 ('794c612d-b2ec-4a5f-8715-807ca9ea0305','r','Caribisch deel van het Koninkrijk'),
 ('aee40246-3cd8-47f8-9be1-b34d44973e66','r','Caribisch deel van het Koninkrijk'),
 ('198f7d3c-84ed-42ed-bef9-c327afae8f90','r','Caribisch deel van het Koninkrijk'),
 ('3c0d7430-2b70-4927-97e8-bd3b1679c765','d','Kunstenaars'),
 ('fd35ad72-25fb-4ed5-9bfe-288c11297ae9','d','Kunstenaars'),
 ('1203b9b0-5c35-47f1-a04c-4ccb5a2a0f83','d','Kunstenaars'),
 ('4b643b70-af49-4e2c-977e-59c5f76d3436','d','Kunstenaars'),
 ('0b4f7030-66c2-451a-8755-2d1ffb3f7d4e','d','Kunstenaars'),
 ('92d6628a-99f9-44a2-b40a-b5b5219eb8f8','d','Kunstenaars'),
 ('794c612d-b2ec-4a5f-8715-807ca9ea0305','d','Kunstenaars'),
 ('3910d95a-3541-4aae-b193-64acd40bfe61','d','Kunstenaars'),
 ('526fd059-7a35-436f-a4b0-9d94817ab87e','d','Kunstenaars'),
 ('d6668d46-dadd-4d55-b480-ff1636b0fdb0','d','Kunstenaars'),
 ('3910d95a-3541-4aae-b193-64acd40bfe61','t','Talentontwikkeling'),
 ('a884d3c2-ef70-4cba-8dd0-0e7dc3df9753','r','Landelijk'),
 ('ece100da-10e5-42cb-aa41-46382cf21401','t','Medisch onderzoek'),
 ('ece100da-10e5-42cb-aa41-46382cf21401','t','Beurzen'),
 ('ece100da-10e5-42cb-aa41-46382cf21401','t','Opleiding / beroepsontwikkeling'),
 ('ece100da-10e5-42cb-aa41-46382cf21401','r','Landelijk'),
 ('ece100da-10e5-42cb-aa41-46382cf21401','r','Wereld / internationaal'),
 ('bcac4e26-0018-47a5-98d5-0249b4b797de','r','Landelijk'),
 ('6a4b03b9-969b-478b-a22b-3fe381b337f8','r','Friesland'),
 ('bd72dcc7-a72c-49e5-b295-47699a6e7704','t','Natuur'),
 ('57d9f263-c7b6-4e2b-980b-756de670aa0a','r','Zuid-Amerika');
do $$
declare v_n int;
begin
  select count(*) into v_n from _b6 b where
    (b.soort='t' and not exists (select 1 from public.themas x where x.naam=b.naam)) or
    (b.soort='d' and not exists (select 1 from public.doelgroepen x where x.naam=b.naam)) or
    (b.soort='r' and not exists (select 1 from public.regios x where x.naam=b.naam)) or
    not exists (select 1 from public.subsidieregelingen s where s.id=b.rid);
  if v_n > 0 then raise exception '% onbekende waarden of regelingen in batch 6', v_n; end if;
end $$;
insert into public.subsidieregeling_themas (subsidieregeling_id, thema_id)
select b.rid, x.id from _b6 b join public.themas x on x.naam=b.naam where b.soort='t' on conflict do nothing;
insert into public.subsidieregeling_doelgroepen (subsidieregeling_id, doelgroep_id)
select b.rid, x.id from _b6 b join public.doelgroepen x on x.naam=b.naam where b.soort='d' on conflict do nothing;
insert into public.subsidieregeling_regios (subsidieregeling_id, regio_id)
select b.rid, x.id from _b6 b join public.regios x on x.naam=b.naam where b.soort='r' on conflict do nothing;
