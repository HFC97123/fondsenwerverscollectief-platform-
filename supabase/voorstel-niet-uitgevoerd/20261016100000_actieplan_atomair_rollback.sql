-- Rollback van 20261016100000_actieplan_atomair.sql. Zet eerst de vlaggen VOORSTEL_GENEREREN en VOORSTEL_PREVIEW uit (de Edge Function valt zonder
-- deze migratie terug op de oude, niet-atomaire ontdubbeling, maar opslaan hoort dan niet meer open te staan).
-- Verwijdert alleen de wachtrij, de unieke index en de sleutelkolom. Taken, financieringsregels en broncontroles blijven.
begin;
drop table if exists public.subsidie_kompas_actieplan_open;
drop index if exists public.subsidie_kompas_program_actions_voorstel_uniek;
alter table public.subsidie_kompas_program_actions drop constraint if exists subsidie_kompas_program_actions_sleutel_chk;
alter table public.subsidie_kompas_program_actions drop column if exists voorstel_sleutel;
notify pgrst, 'reload schema';
commit;
