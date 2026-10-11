-- Idempotent, alleen inserts; geen nieuwe taxonomiewaarden (alles bestaat al), geen deletes.
create temp table _vsb_map (soort text, canoniek text) on commit drop;
insert into _vsb_map values
 ('thema','Community building'),('thema','Participatie & inclusie'),('thema','Talentontwikkeling'),('thema','Beeldende kunst'),
 ('thema','Theater en podiumkunsten'),('thema','Dans'),('thema','Muziek'),('thema','Amateurkunst'),('thema','Cultuur'),
 ('thema','Kunst'),('thema','Cultuureducatie'),
 ('doelgroep','Jongeren'),('doelgroep','Volwassenen'),('doelgroep','Ouderen'),('doelgroep','Buurtbewoners'),
 ('doelgroep','Gemeenschappen'),('doelgroep','Kunstenaars'),('doelgroep','Mensen in een kwetsbare positie'),
 ('regio','Landelijk');

do $$
declare v_n int;
begin
  select count(*) into v_n from public.subsidieregelingen s join public.funders f on f.id = s.funder_id
   where s.naam = 'Amateurkunstimpuls' and f.naam = 'VSBfonds';
  if v_n <> 1 then raise exception 'Verwacht precies 1 regeling VSBfonds - Amateurkunstimpuls, gevonden: %', v_n; end if;
  select count(*) into v_n from _vsb_map m where
    (m.soort='thema' and not exists (select 1 from public.themas t where lower(trim(t.naam))=lower(trim(m.canoniek)))) or
    (m.soort='doelgroep' and not exists (select 1 from public.doelgroepen d where lower(trim(d.naam))=lower(trim(m.canoniek)))) or
    (m.soort='regio' and not exists (select 1 from public.regios r where lower(trim(r.naam))=lower(trim(m.canoniek))));
  if v_n > 0 then raise exception '% gemapte waarden bestaan niet', v_n; end if;
end $$;

insert into public.subsidieregeling_themas (subsidieregeling_id, thema_id)
select s.id, t.id from public.subsidieregelingen s join public.funders f on f.id = s.funder_id, _vsb_map m
join public.themas t on lower(trim(t.naam)) = lower(trim(m.canoniek))
where s.naam = 'Amateurkunstimpuls' and f.naam = 'VSBfonds' and m.soort = 'thema'
on conflict do nothing;

insert into public.subsidieregeling_doelgroepen (subsidieregeling_id, doelgroep_id)
select s.id, d.id from public.subsidieregelingen s join public.funders f on f.id = s.funder_id, _vsb_map m
join public.doelgroepen d on lower(trim(d.naam)) = lower(trim(m.canoniek))
where s.naam = 'Amateurkunstimpuls' and f.naam = 'VSBfonds' and m.soort = 'doelgroep'
on conflict do nothing;

insert into public.subsidieregeling_regios (subsidieregeling_id, regio_id)
select s.id, r.id from public.subsidieregelingen s join public.funders f on f.id = s.funder_id, _vsb_map m
join public.regios r on lower(trim(r.naam)) = lower(trim(m.canoniek))
where s.naam = 'Amateurkunstimpuls' and f.naam = 'VSBfonds' and m.soort = 'regio'
on conflict do nothing;
