-- Bewaarde AI-beoordelingen van fondsen (Pro/Premium, stap 3 van de werkwijze). TOEGEPAST op 2026-10-18 (live versie 20261018091707). Nooit opnieuw uitvoeren.
--
-- Eén nieuwe tabel: per (projectprofiel, fonds) het oordeel van de AI met het letterlijke citaat uit de databasetekst. Doel: dezelfde vraag
-- kost niets extra en een herhaald project wordt sneller beantwoord. De Edge Function werkt ook ZONDER deze tabel (dan wordt elke keer opnieuw
-- beoordeeld); lees- en schrijffouten worden stil genegeerd.
--
-- Wat er in staat: alleen hashes, de sleutel van het fonds, het oordeel (past / twijfel / past_niet), het citaat uit de fondsgegevens en één korte
-- reden. GEEN gebruiker, GEEN projecttekst, GEEN prompt. profiel_hash is een SHA-256 van de gekozen disciplines, doelgroepen en werkgebieden
-- (niet terug te rekenen naar een lid of project). bron_hash is een SHA-256 van de fondstekst die beoordeeld is: verandert de tekst, dan is het
-- bewaarde oordeel vanzelf verlopen. De Edge Function controleert bij het lezen bovendien opnieuw dat het citaat nog in de tekst staat en leest
-- alleen rijen van de laatste 30 dagen.
--
-- Veiligheid: RLS aan, geen enkele policy voor ingelogde leden; alleen service_role (de Edge Function) leest en schrijft.
-- Opruimen: rijen ouder dan 30 dagen worden niet meer gelezen; verwijderen kan handmatig of later met een geplande taak.
-- Rollback: 20261018091707_fonds_beoordelingen_rollback.sql (supabase/voorstel-niet-uitgevoerd)
begin;

create table if not exists public.subsidie_kompas_fonds_beoordelingen (
  profiel_hash text not null check (char_length(profiel_hash) = 64),
  fonds_sleutel text not null check (char_length(fonds_sleutel) between 1 and 300),
  bron_hash text not null check (char_length(bron_hash) = 64),
  oordeel text not null check (oordeel in ('past', 'twijfel', 'past_niet')),
  citaat text not null default '' check (char_length(citaat) <= 200),
  reden text not null default '' check (char_length(reden) <= 200),
  model text null check (model is null or char_length(model) <= 60),
  created_at timestamptz not null default now(),
  primary key (profiel_hash, fonds_sleutel)
);

create index if not exists subsidie_kompas_fonds_beoordelingen_created_idx on public.subsidie_kompas_fonds_beoordelingen (created_at);

alter table public.subsidie_kompas_fonds_beoordelingen enable row level security;
revoke all on table public.subsidie_kompas_fonds_beoordelingen from anon, authenticated;

comment on table public.subsidie_kompas_fonds_beoordelingen is 'Bewaarde AI-beoordelingen van fondsen met citaat (optionele cache van de Edge Function subsidie-kompas). Alleen service_role. Geen gebruikers- of projectinhoud.';

commit;
