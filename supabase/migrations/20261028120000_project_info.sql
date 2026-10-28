-- Uitgebreide projectdocumentatie (aanleiding, noodzaak, bereik, werkwijze, output, outcome, monitoring, organisatie, risico's, borging, toegevoegde waarde,
-- financieringsbehoefte, begrotingstoelichting, enzovoort) bij een project. Vorm: { "versie": 1, "velden": { "<sleutel>": "<tekst>" } }; alleen de vaste sleutels
-- uit src/features/kompas-app/projectinformatie/projectinformatie.js. De overige onderdelen (doelstelling, activiteiten, samenwerking, impact, resultaten,
-- planning) blijven in hun eigen kolommen staan en worden niet verplaatst. De bestaande RLS op de tabel geldt ook voor deze kolom.
-- Nodig voor: het projectdossier invullen uit een document, en voor de projectplan-schrijver (die dit veld al leest en zonder de kolom met minder gegevens werkt).
-- Terugdraaien: supabase/voorstellen/20261028120000_project_info_rollback.sql (alleen na akkoord).
begin;

alter table public.subsidie_kompas_programs
  add column if not exists project_info jsonb null
    check (project_info is null or (jsonb_typeof(project_info) = 'object' and pg_column_size(project_info) <= 200000));

commit;
