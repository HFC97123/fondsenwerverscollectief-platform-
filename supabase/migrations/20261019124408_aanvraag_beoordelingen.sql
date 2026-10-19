-- TOEGEPAST op het live project op 19-10-2026 (live versie 20261019124408). Nooit opnieuw uitvoeren.
-- Aanvraag-assistent: bewaarde beoordelingen per lid en per project. Op verzoek van de beheerder (19-10-2026).
--
-- Wat er in staat: de UITKOMST van een beoordeling (eisenlijst, oordeel per eis met korte citaten en verbeteringen, eindoordeel, telling), het model en
-- het tokenverbruik. NIET de aanvraagtekst zelf (die wordt nergens bewaard). De tabel is ook de maandteller voor de grenzen in tierConfig.ts.
--
-- Wie mag wat:
--   - Schrijven: alleen de Edge Function aanvraag-assistent (service_role), na de controle van abonnement, project en maandgrens.
--   - Lezen: het lid zelf, alleen de eigen rijen (RLS). Leden kunnen niets toevoegen, wijzigen of verwijderen: de tabel is ook de maandteller,
--     dus verwijderen zou de grens omzeilen. Verwijderen gaat via het project (cascade) of het account.
--   - Een beoordeling hoort bij een eigen project van hetzelfde lid; wordt het project of het account verwijderd, dan gaan de beoordelingen mee.
-- Terugdraaien: drop table public.subsidie_kompas_aanvraag_beoordelingen;
create table if not exists public.subsidie_kompas_aanvraag_beoordelingen (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  program_id uuid not null,
  fonds_label text not null default '' check (char_length(fonds_label) <= 200),
  eisen_bron text not null check (eisen_bron in ('lid', 'website', 'database', 'combinatie')),
  eisen jsonb not null check (jsonb_typeof(eisen) = 'array' and pg_column_size(eisen) <= 200000),
  resultaat jsonb not null check (jsonb_typeof(resultaat) = 'object' and pg_column_size(resultaat) <= 400000),
  uitkomst text not null check (uitkomst in ('klaar-om-in-te-dienen', 'eerst-aanvullen', 'niet-te-beoordelen')),
  statistiek jsonb null check (statistiek is null or pg_column_size(statistiek) <= 20000),
  model text null check (model is null or char_length(model) <= 60),
  tokens_in integer not null default 0 check (tokens_in >= 0),
  tokens_uit integer not null default 0 check (tokens_uit >= 0),
  created_at timestamptz not null default now(),
  constraint subsidie_kompas_aanvraag_beoordelingen_program_fkey
    foreign key (program_id, user_id) references public.subsidie_kompas_programs (id, user_id) on delete cascade
);

create index if not exists subsidie_kompas_aanvraag_beoordelingen_user_idx on public.subsidie_kompas_aanvraag_beoordelingen (user_id, created_at desc);
create index if not exists subsidie_kompas_aanvraag_beoordelingen_program_idx on public.subsidie_kompas_aanvraag_beoordelingen (program_id, created_at desc);

alter table public.subsidie_kompas_aanvraag_beoordelingen enable row level security;

revoke all on table public.subsidie_kompas_aanvraag_beoordelingen from anon, authenticated;
grant select on table public.subsidie_kompas_aanvraag_beoordelingen to authenticated;
grant all on table public.subsidie_kompas_aanvraag_beoordelingen to service_role;

create policy "Leden lezen eigen aanvraagbeoordelingen"
  on public.subsidie_kompas_aanvraag_beoordelingen for select to authenticated
  using (user_id = auth.uid());

comment on table public.subsidie_kompas_aanvraag_beoordelingen is
  'Aanvraag-assistent: uitkomst van een beoordeling per lid en project (eisen, oordeel per eis, eindoordeel, verbruik). Geen aanvraagtekst. Schrijven alleen via de Edge Function (service_role); leden lezen alleen eigen rijen. Ook de maandteller voor de grenzen per abonnement.';
