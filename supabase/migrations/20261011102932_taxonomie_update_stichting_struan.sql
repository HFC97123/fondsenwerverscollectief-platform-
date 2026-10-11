-- Idempotent: nieuwe waarden alleen als (case-insensitief) nog niet aanwezig; koppelingen via ON CONFLICT DO NOTHING; geen deletes.
create temp table _struan_map (soort text, gevraagd text, canoniek text) on commit drop;
insert into _struan_map values
 -- disciplines
 ('thema','Sociaal ondernemerschap','Sociaal ondernemerschap'),
 ('thema','Ondernemerschap','Ondernemerschap'),
 ('thema','Training & coaching','Training & coaching'),
 ('thema','Opleiding / beroepsontwikkeling','Opleiding / beroepsontwikkeling'),
 ('thema','Leiderschapsontwikkeling','Leiderschapsontwikkeling'),
 ('thema','Community development','Community development'),
 ('thema','Community building','Community building'),
 ('thema','Arbeidstoeleiding','Arbeidstoeleiding'),
 ('thema','Werkgelegenheidsprojecten','Werkgelegenheidsprojecten'),
 ('thema','Circulaire innovatie','Circulaire innovatie'),
 ('thema','Duurzame landbouw','Duurzame landbouw'),
 ('thema','Klimaatinnovatie','Klimaatinnovatie'),
 ('thema','Klimaat','Klimaat'),
 ('thema','Kunst','Kunst'),
 ('thema','Muziek','Muziek'),
 ('thema','Cultuur','Cultuur'),
 ('thema','Medisch onderzoek','Medisch onderzoek'),
 ('thema','Zorgverlening / gezondheidsprojecten','Zorg'),
 ('thema','Zorgverlening / gezondheidsprojecten','Gezondheid'),
 ('thema','Innovatie in gezondheidszorg','Innovatie in gezondheidszorg'),
 -- doelgroepen
 ('doelgroep','Jonge makers','Jonge makers'),
 ('doelgroep','Kunstenaars','Kunstenaars'),
 ('doelgroep','Ondernemers','Ondernemers'),
 ('doelgroep','Vrouwen / meisjes','Vrouwen en meisjes'),
 ('doelgroep','Jongeren','Jongeren'),
 ('doelgroep','Mensen met afstand tot de arbeidsmarkt','Mensen met afstand tot de arbeidsmarkt'),
 ('doelgroep','Mensen met een beperking','Mensen met een beperking'),
 ('doelgroep','Sociaaleconomisch kwetsbare groepen','Mensen in een kwetsbare positie'),
 ('doelgroep','Lokale gemeenschappen / buurtbewoners','Gemeenschappen'),
 ('doelgroep','Lokale gemeenschappen / buurtbewoners','Buurtbewoners'),
 ('doelgroep','Mensen met beperkte toegang tot gezondheidszorg','Mensen met beperkte toegang tot gezondheidszorg'),
 -- werkgebied (alleen geografisch)
 ('regio','Internationaal / wereldwijd','Wereld / internationaal');

-- ontbrekende centrale waarden toevoegen (case-/spatie-ongevoelige existence check)
insert into public.themas (naam)
select distinct m.canoniek from _struan_map m
where m.soort='thema' and not exists (select 1 from public.themas t where lower(trim(t.naam)) = lower(trim(m.canoniek)))
on conflict (naam) do nothing;

insert into public.doelgroepen (naam)
select distinct m.canoniek from _struan_map m
where m.soort='doelgroep' and not exists (select 1 from public.doelgroepen d where lower(trim(d.naam)) = lower(trim(m.canoniek)))
on conflict (naam) do nothing;
-- regio's: bewust geen inserts (alleen bestaande geografische waarde gebruiken)

-- koppelen aan het bestaande record Stichting Struan (exact één record vereist)
do $$
declare v_n int;
begin
  select count(*) into v_n from public.funders where naam = 'Stichting Struan';
  if v_n <> 1 then raise exception 'Verwacht precies 1 record Stichting Struan, gevonden: %', v_n; end if;
end $$;

insert into public.funder_themas (funder_id, thema_id)
select f.id, t.id from public.funders f, _struan_map m
join public.themas t on lower(trim(t.naam)) = lower(trim(m.canoniek))
where f.naam='Stichting Struan' and m.soort='thema'
on conflict do nothing;

insert into public.funder_doelgroepen (funder_id, doelgroep_id)
select f.id, d.id from public.funders f, _struan_map m
join public.doelgroepen d on lower(trim(d.naam)) = lower(trim(m.canoniek))
where f.naam='Stichting Struan' and m.soort='doelgroep'
on conflict do nothing;

insert into public.funder_regios (funder_id, regio_id)
select f.id, r.id from public.funders f, _struan_map m
join public.regios r on lower(trim(r.naam)) = lower(trim(m.canoniek))
where f.naam='Stichting Struan' and m.soort='regio'
on conflict do nothing;
