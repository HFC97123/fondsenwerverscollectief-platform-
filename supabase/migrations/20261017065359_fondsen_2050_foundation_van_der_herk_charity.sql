-- Twee groene fondsen uit werkbestand V5 zonder ID; alleen toevoegen als ze ontbreken.
insert into public.funders (naam, type, research_source, source_type, enrichment_status, status, bron)
select x, 'vermogensfonds', 'Werkbestand vermogensfondsen V5, 17-10-2026: door Aisya als gevend fonds aangemerkt', 'manual_admin', 'nieuw', 'actief', 'werkbestand_vermogensfondsen_V5.xlsx'
from unnest(array['2050 Foundation','Van der Herk Charity']) x
where not exists (select 1 from public.funders f where lower(f.naam) = lower(x) or lower(f.naam) = lower('Stichting '||x));
