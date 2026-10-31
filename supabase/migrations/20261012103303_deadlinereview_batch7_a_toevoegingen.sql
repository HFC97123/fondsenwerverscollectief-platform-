-- Deadline-/classificatiereview batch 7 (laatste), DEEL A: alleen toevoegingen. Bronnen bekeken 12-10-2026. Idempotent. Geen nieuwe taxonomie.
create temp table _b7 (rid uuid, soort text, naam text) on commit drop;
insert into _b7 values
 ('b1d244b0-2646-4faa-8529-4a031f344901','d','Vrijwilligers'),
 ('7243f125-9146-4e18-a7e5-07b03b8f1225','d','Kinderen'),
 ('7243f125-9146-4e18-a7e5-07b03b8f1225','d','Vrouwen en meisjes'),
 ('83c95b8b-48c6-4958-b794-d326c5de8313','r','Midden-Oosten'),
 ('9122f8fc-e795-4bc6-a7bf-4584f0ca383f','d','Mensen in een kwetsbare positie'),
 ('b6b4462e-2896-4ae2-8251-370ed2ad1842','d','Mensen met een beperking'),
 ('b6b4462e-2896-4ae2-8251-370ed2ad1842','r','Landelijk'),
 ('21b658d4-b6fd-437a-b8de-c9f50293b898','d','Mensen met een beperking'),
 ('21b658d4-b6fd-437a-b8de-c9f50293b898','r','Landelijk'),
 ('5d475654-641c-413b-b2d8-ae72bffbe1cb','d','Kinderen'),
 ('09bdb45d-81a9-49c7-9767-4d38f0fb158c','t','Arbeidstoeleiding'),
 ('09bdb45d-81a9-49c7-9767-4d38f0fb158c','d','Mensen met afstand tot de arbeidsmarkt'),
 ('09bdb45d-81a9-49c7-9767-4d38f0fb158c','r','Landelijk'),
 ('f6ba8614-4c80-4de7-b583-dee131a4c0e0','t','Cultuur'),
 ('f6ba8614-4c80-4de7-b583-dee131a4c0e0','t','Sport'),
 ('f6ba8614-4c80-4de7-b583-dee131a4c0e0','t','Natuur en milieu'),
 ('f6ba8614-4c80-4de7-b583-dee131a4c0e0','t','Sociaal-maatschappelijk'),
 ('f6ba8614-4c80-4de7-b583-dee131a4c0e0','t','Religie'),
 ('f6ba8614-4c80-4de7-b583-dee131a4c0e0','r','Noord-Holland'),
 ('f6ba8614-4c80-4de7-b583-dee131a4c0e0','r','Zuid-Holland'),
 ('cbaf44bf-c61e-477d-8d71-2478a5609879','d','Kinderen'),
 ('cbaf44bf-c61e-477d-8d71-2478a5609879','d','Mensen met een beperking'),
 ('cbaf44bf-c61e-477d-8d71-2478a5609879','r','Landelijk'),
 ('924fd648-992e-4726-87dd-9a7972ee236c','t','Welzijn'),
 ('924fd648-992e-4726-87dd-9a7972ee236c','t','Onderwijs'),
 ('924fd648-992e-4726-87dd-9a7972ee236c','t','Gezondheid'),
 ('924fd648-992e-4726-87dd-9a7972ee236c','d','Mensen in een kwetsbare positie'),
 ('924fd648-992e-4726-87dd-9a7972ee236c','r','Landelijk'),
 ('924fd648-992e-4726-87dd-9a7972ee236c','r','Wereld / internationaal'),
 ('c1e9d271-d1ef-4355-9992-3b24136eb973','t','Zelfredzaamheid'),
 ('c1e9d271-d1ef-4355-9992-3b24136eb973','t','Armoedebestrijding'),
 ('c1e9d271-d1ef-4355-9992-3b24136eb973','d','Mensen in armoede'),
 ('c1e9d271-d1ef-4355-9992-3b24136eb973','r','Wereld / internationaal'),
 ('88d56132-5d8c-4585-87b3-29f973d16663','d','Ouderen'),
 ('88d56132-5d8c-4585-87b3-29f973d16663','d','Mensen in armoede'),
 ('88d56132-5d8c-4585-87b3-29f973d16663','r','Landelijk'),
 ('88d56132-5d8c-4585-87b3-29f973d16663','r','Amsterdam'),
 ('7360358e-2933-4fe9-a4d3-fa0bd7e63f2a','d','Mensen in armoede'),
 ('7360358e-2933-4fe9-a4d3-fa0bd7e63f2a','r','Rotterdam'),
 ('48bc8185-3097-4b00-870a-438f10446f91','t','Onderwijs'),
 ('48bc8185-3097-4b00-870a-438f10446f91','t','Cultuureducatie'),
 ('48bc8185-3097-4b00-870a-438f10446f91','r','Landelijk'),
 ('48bc8185-3097-4b00-870a-438f10446f91','r','Wereld / internationaal'),
 ('c2a7eaa8-9bbb-49cb-96ac-807b14ec3ba3','d','Vrijwilligers'),
 ('c2a7eaa8-9bbb-49cb-96ac-807b14ec3ba3','r','Landelijk'),
 ('05c140fe-dd9d-4552-9457-1d5723769a0a','d','Jongeren');
do $$
declare v_n int;
begin
  select count(*) into v_n from _b7 b where
    (b.soort='t' and not exists (select 1 from public.themas x where x.naam=b.naam)) or
    (b.soort='d' and not exists (select 1 from public.doelgroepen x where x.naam=b.naam)) or
    (b.soort='r' and not exists (select 1 from public.regios x where x.naam=b.naam)) or
    not exists (select 1 from public.subsidieregelingen s where s.id=b.rid);
  if v_n > 0 then raise exception '% onbekende waarden of regelingen in batch 7', v_n; end if;
end $$;
insert into public.subsidieregeling_themas (subsidieregeling_id, thema_id)
select b.rid, x.id from _b7 b join public.themas x on x.naam=b.naam where b.soort='t' on conflict do nothing;
insert into public.subsidieregeling_doelgroepen (subsidieregeling_id, doelgroep_id)
select b.rid, x.id from _b7 b join public.doelgroepen x on x.naam=b.naam where b.soort='d' on conflict do nothing;
insert into public.subsidieregeling_regios (subsidieregeling_id, regio_id)
select b.rid, x.id from _b7 b join public.regios x on x.naam=b.naam where b.soort='r' on conflict do nothing;
