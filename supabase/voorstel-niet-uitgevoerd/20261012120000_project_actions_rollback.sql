-- Rollback van 20261012120000_project_actions.sql (Actieplan per project). LET OP: verwijdert alle opgeslagen taken.
begin;

drop table if exists public.subsidie_kompas_program_actions;
drop function if exists public.subsidie_kompas_program_actions_voor_insert();
drop function if exists public.subsidie_kompas_program_actions_voor_update();

commit;
