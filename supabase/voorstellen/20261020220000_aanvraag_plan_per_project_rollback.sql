-- Terugdraaien van 20261020220000_aanvraag_plan_per_project.sql (de Edge Function moet dan eerst weer de vorige versie zijn).
begin;
drop function if exists public.aanvraag_plan_reserveer(uuid, uuid, integer, timestamptz);
drop function if exists public.aanvraag_plan_stand(uuid, uuid, timestamptz);
drop index if exists public.subsidie_kompas_aanvraag_verbruik_project_idx;
alter table public.subsidie_kompas_aanvraag_verbruik drop column if exists project_id;
commit;
