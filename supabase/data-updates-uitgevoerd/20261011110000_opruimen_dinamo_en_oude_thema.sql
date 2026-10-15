-- UITGEVOERD (11-10-2026) in Supabase; resultaat op 15-10-2026 gecontroleerd: oude term bestaat niet meer, Dinamo heeft alleen Cultuur, Welzijn, Natuur en milieu, Erfgoed.
-- Uitvoeren in Supabase > SQL Editor (project HFC97123's Project).
-- 1) Stichting Dinamo Fonds terug naar de oorspronkelijke classificatie
-- 2) De 4 voor Dinamo aangemaakte, ongebruikte waarden verwijderen
-- 3) De oude gecombineerde term "Vrede, vrijheid en veiligheid" verwijderen (alle koppelingen zijn al omgezet en gearchiveerd)
do $$
declare v_f uuid; v_old uuid; v_n int;
begin
  select id into v_f from public.funders where naam = 'Stichting Dinamo Fonds';
  if v_f is not null then
    delete from public.funder_themas ft using public.themas t
     where ft.funder_id = v_f and t.id = ft.thema_id
       and t.naam not in ('Cultuur','Welzijn','Natuur en milieu','Erfgoed');
    delete from public.funder_doelgroepen where funder_id = v_f;
    delete from public.funder_regios where funder_id = v_f;
  end if;

  delete from public.themas t where t.naam in ('Mentale gezondheid','Digitale weerbaarheid')
    and not exists (select 1 from public.funder_themas x where x.thema_id = t.id)
    and not exists (select 1 from public.subsidieregeling_themas x where x.thema_id = t.id);
  delete from public.doelgroepen d where d.naam in ('Gezinnen','Mensen met mentale gezondheidsproblemen')
    and not exists (select 1 from public.funder_doelgroepen x where x.doelgroep_id = d.id)
    and not exists (select 1 from public.subsidieregeling_doelgroepen x where x.doelgroep_id = d.id);

  select id into v_old from public.themas where naam = 'Vrede, vrijheid en veiligheid';
  if v_old is not null then
    select count(*) into v_n from (
      select subsidieregeling_id rij from public.subsidieregeling_themas where thema_id = v_old
      union all select funder_id from public.funder_themas where thema_id = v_old
    ) x where not exists (select 1 from public.thema_migratie_archief a
                           where a.rij_id = x.rij and a.oude_thema_id = v_old and cardinality(a.nieuwe_themas) > 0);
    if v_n > 0 then raise exception '% koppelingen aan de oude term zijn niet gemigreerd', v_n; end if;
    delete from public.subsidieregeling_themas where thema_id = v_old;
    delete from public.funder_themas where thema_id = v_old;
    delete from public.themas where id = v_old;
  end if;
end $$;
