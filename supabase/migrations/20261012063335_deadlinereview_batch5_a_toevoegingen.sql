-- Deadline-/classificatiereview batch 5, DEEL A: alleen toevoegingen. Bronnen bekeken 11-10-2026. Idempotent. Geen nieuwe taxonomie.
create temp table _b5 (rid uuid, soort text, naam text) on commit drop;
insert into _b5 values
 ('d2427c20-c922-472c-ae94-624805ab0f6b','r','Amsterdam'),
 ('f4f141ed-3329-4158-9afd-c6849157800d','r','Amsterdam'),
 ('37683f60-01a6-43d2-8bd3-d1a63e2a1e7e','r','Amsterdam'),
 ('37683f60-01a6-43d2-8bd3-d1a63e2a1e7e','d','Kunstenaars'),
 ('ac952c9b-2657-4f96-92ac-5aefa2f70189','r','Amsterdam'),
 ('7ff5a44b-a06c-405e-8ce8-dd436214471e','r','Amsterdam'),
 ('8a578b5e-2622-416f-85b3-d5ff0fc33fa3','r','Oost-Europa'),
 ('8a578b5e-2622-416f-85b3-d5ff0fc33fa3','d','Slachtoffers van geweld'),
 ('5421f913-cdbc-43c6-8a3d-f90b23fb10b8','r','Afrika'),
 ('5421f913-cdbc-43c6-8a3d-f90b23fb10b8','d','Jongeren'),
 ('5421f913-cdbc-43c6-8a3d-f90b23fb10b8','d','Vrouwen en meisjes'),
 ('21141928-ea0f-46e9-bd7e-89310b181840','t','Medisch onderzoek'),
 ('21141928-ea0f-46e9-bd7e-89310b181840','r','Wereld / internationaal'),
 ('b541e308-00cb-4704-a45f-916c9db5021a','d','Mensen met een beperking'),
 ('e5bb63ff-c7ad-460d-a99f-93a51701d4a0','r','Europa'),
 ('ad5a7b25-3542-4048-924f-4b75047f2d9a','r','Europa'),
 ('9baeece1-f36e-4f38-a1a5-6b05c94e358d','r','Europa'),
 ('9baeece1-f36e-4f38-a1a5-6b05c94e358d','d','Kunstenaars'),
 ('6ebb2458-15bc-415e-9c99-74a2769ac3fc','r','Europa'),
 ('6ebb2458-15bc-415e-9c99-74a2769ac3fc','d','Kunstenaars'),
 ('6d1d8cf7-63fb-426c-bc53-056293e82430','r','Europa'),
 ('6d1d8cf7-63fb-426c-bc53-056293e82430','d','Kunstenaars'),
 ('9f902c94-3c6d-4840-b62d-25b821aee632','r','Europa'),
 ('9f902c94-3c6d-4840-b62d-25b821aee632','d','Kunstenaars'),
 ('4941b152-9be2-48ae-965e-3a5e1d1b707c','r','Amsterdam'),
 ('8297a776-398a-4bd0-b004-d050cefcd012','r','Den Haag'),
 ('e53670a8-24a2-423c-99a9-c45a2fccef5a','r','Rotterdam'),
 ('75ef55c8-b5e9-4a0a-9b4f-35707eeddb37','r','Rotterdam');

do $$
declare v_n int;
begin
  select count(*) into v_n from _b5 b where
    (b.soort='t' and not exists (select 1 from public.themas x where x.naam=b.naam)) or
    (b.soort='d' and not exists (select 1 from public.doelgroepen x where x.naam=b.naam)) or
    (b.soort='r' and not exists (select 1 from public.regios x where x.naam=b.naam)) or
    not exists (select 1 from public.subsidieregelingen s where s.id=b.rid);
  if v_n > 0 then raise exception '% onbekende waarden of regelingen in batch 5', v_n; end if;
end $$;

insert into public.subsidieregeling_themas (subsidieregeling_id, thema_id)
select b.rid, x.id from _b5 b join public.themas x on x.naam=b.naam where b.soort='t' on conflict do nothing;
insert into public.subsidieregeling_doelgroepen (subsidieregeling_id, doelgroep_id)
select b.rid, x.id from _b5 b join public.doelgroepen x on x.naam=b.naam where b.soort='d' on conflict do nothing;
insert into public.subsidieregeling_regios (subsidieregeling_id, regio_id)
select b.rid, x.id from _b5 b join public.regios x on x.naam=b.naam where b.soort='r' on conflict do nothing;
