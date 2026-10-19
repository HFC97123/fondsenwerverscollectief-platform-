-- Rollback van 20261019160000_aanvragen_per_fonds.sql. Alleen draaien na akkoord van Aisya. LET OP: dit verwijdert alle opgeslagen aanvragen en plannen.
begin;
drop table if exists public.subsidie_kompas_aanvragen;
drop function if exists public.subsidie_kompas_aanvragen_voor_schrijven();
commit;
