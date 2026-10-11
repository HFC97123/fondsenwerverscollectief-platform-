-- Live DB-test voor de financier_naam-migratie (20261011180913). Draait ALLES in een transactie die met een
-- exception wordt teruggedraaid: er blijft niets staan. Synthetisch project, bestaande eigenaar/organisatie
-- alleen als anker voor de foreign keys. Rapporteert via de foutmelding (RAPPORT ...).
do $test$
declare
  v_uid uuid; v_org uuid; v_uid2 uuid; v_prog uuid := gen_random_uuid(); v_prog2 uuid := gen_random_uuid();
  v_funder uuid; v_funder_naam text;
  rapport text := ''; n int; r record; c jsonb; v_naam text; v_bedrag_txt text; v_bedrag numeric; v_status_txt text; v_status text; v_f uuid; v_aantal int;
  v_tot_toegekend numeric; v_tot_aangevraagd numeric; v_ingevoegd1 int; v_ingevoegd2 int;
  procedure_ok boolean;
  claims text;
begin
  select user_id, organization_id into v_uid, v_org from public.subsidie_kompas_programs order by created_at limit 1;
  select id into v_uid2 from public.profiles where id <> v_uid order by created_at limit 1;
  select f.id, f.naam into v_funder, v_funder_naam from public.funders f
    where f.access_tier::text <> 'premium' and (select count(*) from public.funders g where lower(btrim(g.naam)) = lower(btrim(f.naam))) = 1 and btrim(f.naam) <> '' limit 1;

  insert into public.subsidie_kompas_programs (id, user_id, organization_id, name, budget_total, own_contribution, cofinanciers)
  values (v_prog, v_uid, v_org, 'ZZ DBTEST synthetisch', 420000, 80000,
    jsonb_build_array(
      jsonb_build_object('naam','Test Toegezegd ','bedrag','25000','status','Toegezegd'),
      jsonb_build_object('naam','Test Aangevraagd','bedrag','160.000','status','Aangevraagd'),
      jsonb_build_object('naam','Test Ingediend','bedrag','1000','status','Ingediend'),
      jsonb_build_object('naam','Test Verkennend','bedrag','500','status','Verkennend'),
      jsonb_build_object('naam','Test Afgewezen','bedrag','700','status','Afgewezen'),
      jsonb_build_object('naam','Onzin bedrag','bedrag','veel','status','Toegezegd'),
      jsonb_build_object('naam','','bedrag','','status','Aangevraagd'),
      jsonb_build_object('naam','Onbekende status','bedrag','10','status','Wellicht'),
      jsonb_build_object('naam', coalesce(v_funder_naam,'ZZ geen funder'), 'bedrag','2000','status','Toegekend')));

  -- Migratielogica (exacte kopie van de migratie, beperkt tot het synthetische project), twee keer uitgevoerd.
  for pass in 1..2 loop
    n := 0;
    for c in select e from jsonb_array_elements((select cofinanciers from public.subsidie_kompas_programs where id = v_prog)) as t(e) loop
      v_naam := btrim(coalesce(c ->> 'naam', '')); v_bedrag_txt := btrim(coalesce(c ->> 'bedrag', ''));
      if v_naam = '' and v_bedrag_txt = '' then continue; end if;
      v_bedrag := null;
      if v_bedrag_txt ~ '^[0-9]+$' then v_bedrag := v_bedrag_txt::numeric;
      elsif v_bedrag_txt ~ '^[0-9]{1,3}(\.[0-9]{3})+$' then v_bedrag := replace(v_bedrag_txt, '.', '')::numeric; end if;
      v_status_txt := lower(btrim(coalesce(c ->> 'status', '')));
      v_status := case when v_status_txt in ('toegezegd','toegekend') then 'awarded' when v_status_txt in ('aangevraagd','ingediend','in aanvraag') then 'submitted'
                       when v_status_txt = 'afgewezen' then 'rejected' when v_status_txt = 'verkennend' then 'interesting' else null end;
      if v_naam = '' or v_bedrag is null or v_status is null or v_bedrag >= 1000000000000 then continue; end if;
      select count(*), min(f.id::text)::uuid into v_aantal, v_f from public.funders f where lower(btrim(f.naam)) = lower(v_naam) and f.access_tier::text <> 'premium';
      if v_aantal <> 1 then v_f := null; end if;
      insert into public.subsidie_kompas_program_funding (user_id, program_id, funder_id, financier_naam, status, requested_amount, awarded_amount)
      values (v_uid, v_prog, v_f, case when v_f is null then v_naam else null end, v_status,
              case when v_status = 'awarded' then null else v_bedrag end, case when v_status = 'awarded' then v_bedrag else null end)
      on conflict do nothing;
      get diagnostics v_aantal = row_count; n := n + v_aantal;
    end loop;
    if pass = 1 then v_ingevoegd1 := n; else v_ingevoegd2 := n; end if;
  end loop;

  select count(*) into n from public.subsidie_kompas_program_funding where program_id = v_prog;
  rapport := rapport || format(E'1. eerste run invoegt %s (verwacht 6), tweede run invoegt %s (verwacht 0), totaal rijen %s (verwacht 6): %s\n', v_ingevoegd1, v_ingevoegd2, n, case when v_ingevoegd1 = 6 and v_ingevoegd2 = 0 and n = 6 then 'OK' else 'FAIL' end);

  for r in select financier_naam, funder_id, status, requested_amount, awarded_amount from public.subsidie_kompas_program_funding where program_id = v_prog order by coalesce(financier_naam,'~') loop
    rapport := rapport || format(E'   rij naam=%s funder=%s status=%s req=%s awd=%s\n', r.financier_naam, r.funder_id is not null, r.status, r.requested_amount, r.awarded_amount);
  end loop;
  select count(*) into n from public.subsidie_kompas_program_funding where program_id = v_prog and financier_naam = 'Test Toegezegd' and status = 'awarded' and awarded_amount = 25000 and requested_amount is null;
  rapport := rapport || format(E'2. Toegezegd (naam getrimd) -> awarded 25000: %s\n', case when n = 1 then 'OK' else 'FAIL' end);
  select count(*) into n from public.subsidie_kompas_program_funding where program_id = v_prog and financier_naam = 'Test Aangevraagd' and status = 'submitted' and requested_amount = 160000;
  rapport := rapport || format(E'3. Aangevraagd 160.000 -> submitted 160000: %s\n', case when n = 1 then 'OK' else 'FAIL' end);
  select count(*) into n from public.subsidie_kompas_program_funding where program_id = v_prog and ((financier_naam = 'Test Ingediend' and status = 'submitted') or (financier_naam = 'Test Verkennend' and status = 'interesting') or (financier_naam = 'Test Afgewezen' and status = 'rejected'));
  rapport := rapport || format(E'4. Ingediend->submitted, Verkennend->interesting, Afgewezen->rejected: %s\n', case when n = 3 then 'OK' else 'FAIL' end);
  select count(*) into n from public.subsidie_kompas_program_funding where program_id = v_prog and financier_naam in ('Onzin bedrag','Onbekende status');
  rapport := rapport || format(E'5. onleesbaar bedrag en onbekende status niet gemigreerd (geen gokwerk): %s\n', case when n = 0 then 'OK' else 'FAIL' end);
  if v_funder is not null then
    select count(*) into n from public.subsidie_kompas_program_funding where program_id = v_prog and funder_id = v_funder and financier_naam is null and status = 'awarded' and awarded_amount = 2000;
    rapport := rapport || format(E'6. exacte unieke funder-naam -> funder_id gekoppeld, geen financier_naam: %s\n', case when n = 1 then 'OK' else 'FAIL' end);
  else
    rapport := rapport || E'6. (geen unieke niet-premium funder beschikbaar om koppeling te testen)\n';
  end if;

  -- Als de eigenaar (authenticated): RPC, directe insert en regels.
  claims := json_build_object('sub', v_uid, 'role', 'authenticated')::text;
  perform set_config('request.jwt.claims', claims, true);
  set local role authenticated;

  select coalesce(sum(case when status = 'awarded' then coalesce(awarded_amount, requested_amount, 0) else 0 end),0),
         coalesce(sum(case when status = 'submitted' then coalesce(requested_amount,0) else 0 end),0)
    into v_tot_toegekend, v_tot_aangevraagd from public.kompas_dekkingsplan(v_prog);
  rapport := rapport || format(E'7. RPC-totalen toegekend=%s (verwacht 25000 of 27000 bij funder-koppeling) aangevraagd=%s (verwacht 161000): %s\n', v_tot_toegekend, v_tot_aangevraagd,
     case when v_tot_toegekend in (25000, 27000) and v_tot_aangevraagd = 161000 then 'OK' else 'FAIL' end);
  select count(*) into n from public.kompas_dekkingsplan(v_prog) d where d.bron_type = 'financier' and d.bron_status = 'zichtbaar' and d.bron_naam is not null and d.funder_id is null and d.scheme_id is null;
  rapport := rapport || format(E'8. naam-regels in RPC: bron_type financier, zichtbaar, zonder funder/scheme (%s regels): %s\n', n, case when n >= 5 then 'OK' else 'FAIL' end);

  begin
    insert into public.subsidie_kompas_program_funding (user_id, program_id, financier_naam, status, awarded_amount) values (v_uid, v_prog, 'Nieuwe Stichting', 'awarded', 1234);
    rapport := rapport || E'9. financier_naam zonder funder/scheme insert door authenticated: OK\n';
  exception when others then rapport := rapport || format(E'9. FAIL insert financier_naam: %s\n', sqlerrm);
  end;
  begin
    insert into public.subsidie_kompas_program_funding (user_id, program_id, financier_naam, status) values (v_uid, v_prog, ' nieuwe stichting ', 'interesting');
    rapport := rapport || E'10. FAIL dezelfde naam (andere schrijfwijze) twee keer is toegestaan\n';
  exception when unique_violation then rapport := rapport || E'10. dubbele naam per project geweigerd (unieke index): OK\n';
           when others then rapport := rapport || format(E'10. andere fout %s\n', sqlerrm);
  end;
  if v_funder is not null then
    begin
      insert into public.subsidie_kompas_program_funding (user_id, program_id, funder_id, financier_naam, status) values (v_uid, v_prog, v_funder, 'Extra naam', 'interesting');
      rapport := rapport || E'11. FAIL funder_id en financier_naam samen toegestaan\n';
    exception when check_violation then rapport := rapport || E'11. funder_id + financier_naam samen geweigerd: OK\n';
             when unique_violation then rapport := rapport || E'11. (unique eerder)\n';
             when others then rapport := rapport || format(E'11. andere fout %s\n', sqlerrm);
    end;
  end if;
  begin
    insert into public.subsidie_kompas_program_funding (user_id, program_id, status) values (v_uid, v_prog, 'interesting');
    rapport := rapport || E'12. FAIL regel zonder enige bron toegestaan\n';
  exception when check_violation then rapport := rapport || E'12. regel zonder bron geweigerd: OK\n';
           when others then rapport := rapport || format(E'12. andere fout %s\n', sqlerrm);
  end;
  if v_funder is not null then
    begin
      delete from public.subsidie_kompas_program_funding where program_id = v_prog and funder_id = v_funder;
      insert into public.subsidie_kompas_program_funding (user_id, program_id, funder_id, status, requested_amount) values (v_uid, v_prog, v_funder, 'interesting', 100);
      rapport := rapport || E'13. cataloguus-regel (funder_id) blijft werken: OK\n';
    exception when others then rapport := rapport || format(E'13. FAIL catalogus-regel: %s\n', sqlerrm);
    end;
  end if;

  -- Isolatie: een ander lid.
  if v_uid2 is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', v_uid2, 'role', 'authenticated')::text, true);
    begin
      perform * from public.kompas_dekkingsplan(v_prog);
      rapport := rapport || E'14. FAIL ander lid kan RPC van dit project lezen\n';
    exception when others then rapport := rapport || E'14. ander lid kan dekkingsplan niet lezen (RPC weigert): OK\n';
    end;
    select count(*) into n from public.subsidie_kompas_program_funding where program_id = v_prog;
    rapport := rapport || format(E'15. ander lid ziet %s regels via RLS (verwacht 0): %s\n', n, case when n = 0 then 'OK' else 'FAIL' end);
    begin
      insert into public.subsidie_kompas_program_funding (user_id, program_id, financier_naam, status) values (v_uid2, v_prog, 'Indringer', 'interesting');
      rapport := rapport || E'16. FAIL ander lid kan regel toevoegen aan dit project\n';
    exception when others then rapport := rapport || E'16. ander lid kan geen regel toevoegen aan andermans project: OK\n';
    end;
  end if;

  raise exception E'RAPPORT\n%', rapport;
end
$test$;
