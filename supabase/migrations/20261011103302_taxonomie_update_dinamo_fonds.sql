-- Idempotent; geen deletes. Alleen 4 nieuwe, algemene waarden; de rest hergebruikt bestaande (bredere) categorieën.
create temp table _dinamo_map (soort text, canoniek text) on commit drop;
insert into _dinamo_map values
 ('thema','Welzijn'),('thema','Sociaal-maatschappelijk'),('thema','Community building'),('thema','Community development'),
 ('thema','Jeugd en kinderen'),('thema','Kinderen/jongeren'),('thema','Talentontwikkeling'),('thema','Onderwijs'),('thema','Educatie'),
 ('thema','Training & coaching'),('thema','Arbeidstoeleiding'),('thema','Opleiding / beroepsontwikkeling'),('thema','Vrijwilligers'),
 ('thema','Participatie & inclusie'),('thema','Armoedebestrijding'),('thema','Gezondheid'),('thema','Mentale gezondheid'),
 ('thema','Sport'),('thema','Kunst'),('thema','Cultuur'),('thema','Muziek'),('thema','Dans'),('thema','Digitale weerbaarheid'),
 ('thema','Veiligheid'),('thema','Eenzaamheid'),('thema','Duurzaamheid'),
 ('doelgroep','Kinderen'),('doelgroep','Jongeren'),('doelgroep','Gezinnen'),('doelgroep','Volwassenen'),('doelgroep','Ouderen'),
 ('doelgroep','Buurtbewoners'),('doelgroep','Gemeenschappen'),('doelgroep','Vrijwilligers'),('doelgroep','Mantelzorgers'),
 ('doelgroep','Mensen met afstand tot de arbeidsmarkt'),('doelgroep','Mensen in armoede'),('doelgroep','Mensen in een kwetsbare positie'),
 ('doelgroep','Mensen met mentale gezondheidsproblemen'),('doelgroep','Minderheden'),('doelgroep','Vrouwen en meisjes'),
 ('regio','Amsterdam');

insert into public.themas (naam)
select m.canoniek from _dinamo_map m where m.soort='thema'
  and m.canoniek in ('Mentale gezondheid','Digitale weerbaarheid')
  and not exists (select 1 from public.themas t where lower(trim(t.naam)) = lower(trim(m.canoniek)))
on conflict (naam) do nothing;

insert into public.doelgroepen (naam)
select m.canoniek from _dinamo_map m where m.soort='doelgroep'
  and m.canoniek in ('Gezinnen','Mensen met mentale gezondheidsproblemen')
  and not exists (select 1 from public.doelgroepen d where lower(trim(d.naam)) = lower(trim(m.canoniek)))
on conflict (naam) do nothing;

do $$
declare v_n int;
begin
  select count(*) into v_n from public.funders where naam = 'Stichting Dinamo Fonds';
  if v_n <> 1 then raise exception 'Verwacht precies 1 record Stichting Dinamo Fonds, gevonden: %', v_n; end if;
  -- alle gemapte waarden moeten bestaan (geen stille misser)
  select count(*) into v_n from _dinamo_map m where
    (m.soort='thema' and not exists (select 1 from public.themas t where lower(trim(t.naam))=lower(trim(m.canoniek)))) or
    (m.soort='doelgroep' and not exists (select 1 from public.doelgroepen d where lower(trim(d.naam))=lower(trim(m.canoniek)))) or
    (m.soort='regio' and not exists (select 1 from public.regios r where lower(trim(r.naam))=lower(trim(m.canoniek))));
  if v_n > 0 then raise exception '% gemapte waarden bestaan niet', v_n; end if;
end $$;

insert into public.funder_themas (funder_id, thema_id)
select f.id, t.id from public.funders f, _dinamo_map m join public.themas t on lower(trim(t.naam))=lower(trim(m.canoniek))
where f.naam='Stichting Dinamo Fonds' and m.soort='thema' on conflict do nothing;

insert into public.funder_doelgroepen (funder_id, doelgroep_id)
select f.id, d.id from public.funders f, _dinamo_map m join public.doelgroepen d on lower(trim(d.naam))=lower(trim(m.canoniek))
where f.naam='Stichting Dinamo Fonds' and m.soort='doelgroep' on conflict do nothing;

insert into public.funder_regios (funder_id, regio_id)
select f.id, r.id from public.funders f, _dinamo_map m join public.regios r on lower(trim(r.naam))=lower(trim(m.canoniek))
where f.naam='Stichting Dinamo Fonds' and m.soort='regio' on conflict do nothing;
