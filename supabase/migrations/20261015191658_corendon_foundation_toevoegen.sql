-- Corendon Foundation toegevoegd (15-10-2026, op verzoek Aisya). Caribisch werkgebied onbevestigd; zie deadline_omschrijving.
-- Uitgevoerd via apply_migration 'corendon_foundation_toevoegen'. Alleen toevoegingen, idempotent.
insert into public.funders (naam, type, website, missie, land, bron, research_source, source_type, enrichment_status, status, last_researched_at)
select 'Corendon Foundation','corporate_foundation','https://www.corendonfoundation.com/nl/','Bedrijfsfonds van Corendon dat samen met lokale partners projecten steunt voor kansengelijkheid (onderwijs, talentontwikkeling, gemeenschappen, cultuur en noodhulp) op bestemmingen waar Corendon actief is. Of de Caribische eilanden (o.a. Curaçao) in aanmerking komen is niet officieel bevestigd.','Nederland','https://nieuws.corendon.nl/foundation','Scan Caribische fondsen 15-10-2026 (Claude)','internet_scan','deels_verrijkt','actief',now()
where not exists (select 1 from public.funders where lower(naam)='corendon foundation');

insert into public.subsidieregelingen (funder_id, naam, status, deadline_omschrijving, aanvraaglink, source_type, discovered_by, status_laatst_gecheckt, werkgebied)
select f.id,'Projectvoorstel Corendon Foundation','doorlopend','Projectvoorstellen kunnen het hele jaar worden ingediend; het bestuur toetst aan vaste criteria. Steun loopt altijd via een betrouwbare lokale partner. Let op: niet bevestigd of Curaçao/Aruba/Bonaire in aanmerking komen; criteria en bedragen nog controleren op de website of via 023 751 06 08.','https://www.corendonfoundation.com/nl/','internet_scan','agent',now(),'Caribisch deel van het Koninkrijk (onbevestigd)'
from public.funders f where lower(f.naam)='corendon foundation'
and not exists (select 1 from public.subsidieregelingen s where s.funder_id=f.id);

insert into public.funder_themas (funder_id, thema_id) select f.id, t.id from public.funders f, public.themas t where lower(f.naam)='corendon foundation' and t.naam in ('Onderwijs','Sociaal-maatschappelijk','Noodhulp','Cultuur') on conflict do nothing;
insert into public.funder_regios (funder_id, regio_id) select f.id, r.id from public.funders f, public.regios r where lower(f.naam)='corendon foundation' and r.naam in ('Caribisch deel van het Koninkrijk','Wereld / internationaal') on conflict do nothing;
insert into public.subsidieregeling_themas (subsidieregeling_id, thema_id) select s.id, t.id from public.subsidieregelingen s join public.funders f on f.id=s.funder_id, public.themas t where lower(f.naam)='corendon foundation' and t.naam in ('Onderwijs','Sociaal-maatschappelijk','Noodhulp','Cultuur') on conflict do nothing;
insert into public.subsidieregeling_regios (subsidieregeling_id, regio_id) select s.id, r.id from public.subsidieregelingen s join public.funders f on f.id=s.funder_id, public.regios r where lower(f.naam)='corendon foundation' and r.naam in ('Caribisch deel van het Koninkrijk','Wereld / internationaal') on conflict do nothing;
