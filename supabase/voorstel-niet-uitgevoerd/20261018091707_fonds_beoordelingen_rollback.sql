-- Rollback van 20261016150000_fonds_beoordelingen.sql. De Edge Function werkt zonder deze tabel (er wordt dan niet bewaard).
begin;
drop table if exists public.subsidie_kompas_fonds_beoordelingen;
commit;
