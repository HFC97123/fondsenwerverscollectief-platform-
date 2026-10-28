-- Terugdraaien van 20261028120000_project_info.sql. LET OP: de tekst in deze kolom gaat verloren; maak eerst zo nodig een back-up:
--   create table backup_project_info as select id, project_info from public.subsidie_kompas_programs where project_info is not null;
alter table public.subsidie_kompas_programs drop column if exists project_info;
