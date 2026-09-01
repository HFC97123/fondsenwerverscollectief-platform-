
-- Correctie-migratie (nieuw, 2026-09-01) -- GEEN historische reconstructie.
--
-- Doel: uitsluitend zorgen dat een verse, lege omgeving die alle bestanden
-- in supabase/migrations/ in volgorde afspeelt, voor deze onderdelen op
-- hetzelfde schema-eindresultaat uitkomt als de huidige live database.
--
-- Achtergrond: bij het byte-voor-byte controleren van de 19 migraties die
-- Supabase zelf in supabase_migrations.schema_migrations had geregistreerd
-- (2026-09-01), bleek dat de volgende schema-elementen op de live database
-- bestaan maar door GEEN van die 19 migraties worden aangemaakt -- ze zijn
-- dus ooit buiten de migratietracking om toegevoegd, vóór migratie
-- 20260831064231 (add_deadline_classification_and_view), die ze als eerste
-- gebruikt:
--   - het enum-type public.regeling_status_type
--   - subsidieregelingen.status, .deadline_datum, .deadline_omschrijving,
--     .status_laatst_gecheckt (+ de indexen daarop)
--   - funders.prioriteit
--
-- Deze migratie reconstrueert GEEN historische tussenstappen (welke kolom
-- op welk moment is toegevoegd, in welke volgorde, is onbekend) -- ze legt
-- uitsluitend de huidige, geverifieerde eindstaat van deze specifieke
-- elementen vast, met alleen IF NOT EXISTS / conditionele checks. Op de
-- huidige live database is dit bestand daarom een volledige no-op (alles
-- bestaat al exact zo, geverifieerd vóór en na toepassing); op een verse
-- database vult het precies het ontbrekende stuk aan.
--
-- Nadrukkelijk NIET meegenomen: subsidieregelingen.external_relatienummer
-- bestond ooit (migratie 20260819104359) maar is op de live database niet
-- meer aanwezig -- dat wordt hier bewust niet teruggezet.

-- 1. Enum-type, alleen aanmaken als het nog niet bestaat.
do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'regeling_status_type'
  ) then
    create type public.regeling_status_type as enum (
      'open',
      'gesloten',
      'doorlopend',
      'aangekondigd',
      'binnenkort',
      'budget_uitgeput'
    );
  end if;
end
$$;

-- 2. Kolommen op subsidieregelingen, elk afzonderlijk conditioneel.
alter table public.subsidieregelingen
  add column if not exists status public.regeling_status_type not null default 'open';

alter table public.subsidieregelingen
  add column if not exists deadline_datum date;

alter table public.subsidieregelingen
  add column if not exists deadline_omschrijving text;

alter table public.subsidieregelingen
  add column if not exists status_laatst_gecheckt timestamptz;

-- 3. Indexen die bij deze kolommen horen (ook al live aanwezig, ook
-- ontbrekend uit de getrackte migraties).
create index if not exists idx_subsidieregelingen_status
  on public.subsidieregelingen using btree (status);

create index if not exists idx_subsidieregelingen_deadline_datum
  on public.subsidieregelingen using btree (deadline_datum);

-- 4. Kolom op funders.
alter table public.funders
  add column if not exists prioriteit integer not null default 0;
