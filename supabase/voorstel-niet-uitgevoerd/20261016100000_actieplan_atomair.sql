-- NIET UITGEVOERD op de live database. Wacht op een afzonderlijk akkoord van het lid (zie uitrolplan).
--
-- Migratie C: het actieplan wordt bestand tegen gelijktijdige verzoeken en tegen verversen.
--   1. subsidie_kompas_program_actions.voorstel_sleutel (nullable) + UNIEKE index (program_id, voorstel_sleutel):
--      de database zelf weigert een tweede taak met dezelfde sleutel (financieringsregel + titel). De Edge Function schrijft met
--      INSERT ... ON CONFLICT DO NOTHING, dus twee gelijktijdige verzoeken (dubbelklik, twee tabbladen, automatische herhaling) kunnen
--      nooit dezelfde taak twee keer aanmaken. Bestaande taken en taken die het lid zelf toevoegt hebben geen sleutel (NULL): NULL's tellen
--      in een unieke index niet als gelijk, dus er verandert niets aan bestaande rijen of aan handmatig toevoegen.
--      De index is bewust NIET partieel: PostgREST kan een ON CONFLICT alleen op een gewone unieke index laten wijzen.
--   2. subsidie_kompas_actieplan_open: de taken van het actieplan die (nog) niet zijn aangemaakt, door de SERVER bewaard. Zo blijft
--      "Actieplan opnieuw proberen" beschikbaar na verversen, uit een ander tabblad of op een ander apparaat. Het lid kan lezen, niet
--      schrijven (alleen service_role); de rij verdwijnt zodra de taak bestaat.
-- Rollback: 20261016100000_actieplan_atomair_rollback.sql
begin;

alter table public.subsidie_kompas_program_actions
  add column voorstel_sleutel text null;

alter table public.subsidie_kompas_program_actions
  add constraint subsidie_kompas_program_actions_sleutel_chk
  check (voorstel_sleutel is null or char_length(voorstel_sleutel) between 1 and 400);

create unique index subsidie_kompas_program_actions_voorstel_uniek
  on public.subsidie_kompas_program_actions (program_id, voorstel_sleutel);

comment on column public.subsidie_kompas_program_actions.voorstel_sleutel is
  'Door de server gezet bij taken uit het actieplan van Subsidiekompas: <funding_id of leeg>|<titel in kleine letters>. Uniek per project. NULL bij taken die het lid zelf toevoegt.';

-- Kolomrechten: het lid mag de sleutel bij een insert meegeven (de Edge Function schrijft met de gebruikersclient), maar nooit wijzigen.
grant insert (voorstel_sleutel) on table public.subsidie_kompas_program_actions to authenticated;

-- Wachtrij met nog niet aangemaakte taken ---------------------------------------------------------------------------------------------
create table public.subsidie_kompas_actieplan_open (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  program_id uuid not null,
  funding_id uuid null references public.subsidie_kompas_program_funding (id) on delete cascade,
  sleutel text not null,
  title text not null,
  financier_label text null,
  due_date date null,
  priority text not null default 'normal',
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subsidie_kompas_actieplan_open_program_fkey
    foreign key (program_id, user_id)
    references public.subsidie_kompas_programs (id, user_id) on delete cascade,
  constraint subsidie_kompas_actieplan_open_title_chk check (char_length(btrim(title)) between 1 and 200),
  constraint subsidie_kompas_actieplan_open_sleutel_chk check (char_length(sleutel) between 1 and 400),
  constraint subsidie_kompas_actieplan_open_financier_chk check (financier_label is null or char_length(financier_label) <= 200),
  constraint subsidie_kompas_actieplan_open_priority_chk check (priority in ('high', 'normal', 'low')),
  constraint subsidie_kompas_actieplan_open_notes_chk check (notes is null or char_length(notes) <= 4000),
  constraint subsidie_kompas_actieplan_open_uniek unique (program_id, sleutel)
);

comment on table public.subsidie_kompas_actieplan_open is
  'Taken van het actieplan van Subsidiekompas die nog niet in subsidie_kompas_program_actions staan (opslaan gedeeltelijk mislukt). Door de server bewaard zodat opnieuw proberen blijft bestaan na verversen. Schrijven alleen via service_role; geen bedragen.';

create index subsidie_kompas_actieplan_open_user_idx on public.subsidie_kompas_actieplan_open (user_id);
create index subsidie_kompas_actieplan_open_program_idx on public.subsidie_kompas_actieplan_open (program_id);
create index subsidie_kompas_actieplan_open_funding_idx on public.subsidie_kompas_actieplan_open (funding_id) where funding_id is not null;

alter table public.subsidie_kompas_actieplan_open enable row level security;

create policy "Users read own open actieplan" on public.subsidie_kompas_actieplan_open
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.subsidie_kompas_actieplan_open from public, anon, authenticated;
grant select on table public.subsidie_kompas_actieplan_open to authenticated;
grant all on table public.subsidie_kompas_actieplan_open to service_role;

notify pgrst, 'reload schema';

commit;
