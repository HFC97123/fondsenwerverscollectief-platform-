-- UITGEVOERD 12-10-2026 door Claude via Supabase execute_sql, na akkoord van Aisya.
-- 1. Correcties naar aanleiding van batch 5
update public.subsidieregelingen set deadline_omschrijving='Klein, besloten fonds zonder openbare aanvraagprocedure. Aanvragen worden behandeld in bestuursvergaderingen; de vergaderdata worden nog opgevraagd.' where id='aefcee00-e877-4a18-941e-d30a6f3e9f70';
update public.subsidieregelingen set aanvraaglink='https://evensfoundation.eu/prizes/arts', deadline_omschrijving='Prijs van €15.000 voor een Europese kunstenaar (beeldende of podiumkunsten). Niet zelf aan te vragen: Europese culturele instellingen worden uitgenodigd kandidaten voor te dragen, daarna kiest een onafhankelijke jury. Tweejaarlijks; de laatste editie was 2023 (uitreiking april 2024). Een volgende editie is nog niet aangekondigd.' where id='91138530-013e-4507-889f-b8e5cc455266';
update public.subsidieregelingen set aanvraaglink='https://www.mondriaanfonds.nl/subsidie-aanvragen/regelingen/kunst-erfgoed-presentatie/', deadline_omschrijving='Doorlopend aan te vragen via het online aanvraagsysteem, vóór de start van het project. Behandeling duurt in principe 3 maanden. Voor non-profit presentatie-instellingen (musea, kunsthallen, archieven); bijdrage max. 40% van de variabele projectkosten, projectbegroting boven €25.000.' where id='49f83312-62fc-4136-8de2-a17186580d98';
insert into public.subsidieregeling_regios (subsidieregeling_id, regio_id) select '49f83312-62fc-4136-8de2-a17186580d98', id from public.regios where naam='Caribisch deel van het Koninkrijk' on conflict do nothing;
-- 2. Dubbele records (akkoord Aisya 12-10-2026)
--    Bylandt: funder-notities eerst overgezet naar het funder-record dat blijft.
update public.funder_notes set funder_id='9cdc8495-b94c-490e-b0e7-de451a6a2051' where funder_id='8e97307e-2e12-497d-b8a0-8802bff1d8bc';
delete from public.subsidieregelingen where id='4858f6e1-1435-4c39-a7f4-e8754ea02711' and naam='Reguliere aanvraag';
delete from public.funders where id='8e97307e-2e12-497d-b8a0-8802bff1d8bc' and not exists (select 1 from public.subsidieregelingen where funder_id='8e97307e-2e12-497d-b8a0-8802bff1d8bc');
--    Kunst Erfgoed Festival = dubbel van Kunst Erfgoed Presentatie (49f83312)
delete from public.subsidieregelingen where id='f0559268-80cf-41dc-925b-0b28e795a98f' and naam='Kunst Erfgoed Festival';
