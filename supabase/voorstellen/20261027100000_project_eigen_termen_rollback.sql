-- Terugdraaien van 20261027100000_project_eigen_termen.sql. Alleen na akkoord: de eigen woorden van leden gaan hiermee verloren.
begin;

alter table public.subsidie_kompas_programs drop column if exists eigen_termen;

commit;
