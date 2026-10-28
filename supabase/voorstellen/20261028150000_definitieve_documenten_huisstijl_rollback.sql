-- Terugdraaien van 20261028150000_definitieve_documenten_huisstijl (verwijdert alle definitieve versies en alle eigen huisstijlen). Alleen na akkoord.
begin;
drop trigger if exists subsidie_kompas_definitief_voor_schrijven on public.subsidie_kompas_definitieve_documenten;
drop function if exists public.subsidie_kompas_definitief_voor_schrijven();
drop table if exists public.subsidie_kompas_definitieve_documenten;
alter table public.subsidie_kompas_organizations drop column if exists document_huisstijl;
commit;
