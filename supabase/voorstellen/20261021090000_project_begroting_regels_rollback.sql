-- Terugdraaien van 20261021090000_project_begroting_regels.sql. Let op: de ingevulde begrotingsregels gaan hiermee verloren.
alter table public.subsidie_kompas_programs drop column if exists budget_lines;
