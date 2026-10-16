-- Terugdraaien van migratie D (20261016120000_actieplan_planning.sql). De Edge Function valt daarna terug op planning in de toelichting.
begin;

drop trigger if exists subsidie_kompas_program_actions_zz_planning_handmatig on public.subsidie_kompas_program_actions;
drop function if exists public.subsidie_kompas_actions_planning_handmatig();

alter table public.subsidie_kompas_actieplan_open
  drop constraint if exists subsidie_kompas_actieplan_open_herkomst_chk,
  drop column if exists planning_fase,
  drop column if exists datum_herkomst,
  drop column if exists datum_bron,
  drop column if exists datum_controle;

alter table public.subsidie_kompas_program_actions
  drop constraint if exists subsidie_kompas_program_actions_herkomst_chk,
  drop constraint if exists subsidie_kompas_program_actions_fase_chk,
  drop constraint if exists subsidie_kompas_program_actions_bron_chk,
  drop column if exists planning_fase,
  drop column if exists datum_herkomst,
  drop column if exists datum_bron,
  drop column if exists datum_controle,
  drop column if exists planning_versie,
  drop column if exists planning_handmatig;

notify pgrst, 'reload schema';

commit;
