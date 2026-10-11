-- Rollback van 20261011104804_project_funding_fase2.sql (staat in supabase/migrations/) (Werkruimte Fase 2).
-- LET OP: dit verwijdert alle projectfinancieringsregels. linked_schemes op subsidie_kompas_programs is
-- in Fase 2 niet aangeraakt en bevat dus nog de oorspronkelijke (legacy) data.
begin;

drop function if exists public.kompas_dekkingsplan(uuid);
drop table if exists public.subsidie_kompas_program_funding;
drop function if exists public.subsidie_kompas_program_funding_voor_insert();
drop function if exists public.subsidie_kompas_program_funding_voor_update();
alter table public.subsidie_kompas_programs drop constraint if exists subsidie_kompas_programs_id_user_id_key;

commit;
