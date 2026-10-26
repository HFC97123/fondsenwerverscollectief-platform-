-- Terugdraaien van 20261026140000_aanvraag_versies (verwijdert alle bewaarde versies en vragenlijsten). Alleen na akkoord.
begin;
alter table public.subsidie_kompas_aanvragen drop constraint if exists subsidie_kompas_aanvragen_definitief_fkey;
drop table if exists public.subsidie_kompas_aanvraag_versies;
drop function if exists public.subsidie_kompas_versies_voor_schrijven();
drop index if exists public.subsidie_kompas_aanvragen_definitief_idx;
drop index if exists public.subsidie_kompas_aanvragen_id_user_uniek;
alter table public.subsidie_kompas_aanvragen drop column if exists definitieve_versie_id, drop column if exists schrijf_aantal, drop column if exists schrijf_maand, drop column if exists stukken, drop column if exists vragen, drop column if exists status;
commit;
