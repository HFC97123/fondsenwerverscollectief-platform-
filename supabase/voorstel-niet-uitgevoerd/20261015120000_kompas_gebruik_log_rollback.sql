-- Rollback van 20261015120000_kompas_gebruik_log.sql (verwijdert de meter en alle vastgelegde rijen).
begin;
drop function if exists public.admin_gebruik_per_tier(timestamptz, timestamptz);
drop function if exists public.admin_gebruik_per_gebruiker(timestamptz, timestamptz);
drop table if exists public.kompas_gebruik_log;
commit;
