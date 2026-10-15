-- NIET UITGEVOERD op de live database. Wacht op een afzonderlijk akkoord van het lid (zie rapport).
--
-- Broncontrole per financieringsmogelijkheid per project: wat de SERVER heeft vastgesteld over de controle van de bron.
--   * één rij per (project, soort, id): de laatste controle; een nieuwe controle vervangt de oude (upsert),
--   * geschreven uitsluitend door de Edge Function met de servicerol (mode 'voorstel-controleer' en 'voorstel-opslaan'); het lid kan lezen,
--     niet schrijven (geen insert/update/delete-recht voor authenticated), dus de browser kan een controle niet invullen of vervalsen,
--   * bevat GEEN bedragen en GEEN financieringsstatus: "gecontroleerd" betekent alleen dat de bron is gecontroleerd,
--   * blijft bestaan na verversen en na het opslaan van het dekkingsplan; de interface leest deze tabel naast de financieringsregels.
-- Rollback: 20261015140000_bron_controles_rollback.sql
begin;

create table public.subsidie_kompas_bron_controles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  program_id uuid not null,
  record_type text not null,
  record_id uuid not null,
  status text not null,
  verificatie_status text null,
  reden text null,
  record_versie text not null,
  gecontroleerd_op timestamptz not null default now(),
  constraint subsidie_kompas_bron_controles_program_fkey
    foreign key (program_id, user_id)
    references public.subsidie_kompas_programs (id, user_id) on delete cascade,
  constraint subsidie_kompas_bron_controles_type_chk check (record_type in ('regeling', 'fonds')),
  constraint subsidie_kompas_bron_controles_status_chk check (status in ('gecontroleerd', 'onzeker', 'mislukt', 'verouderd')),
  constraint subsidie_kompas_bron_controles_verificatie_chk
    check (verificatie_status is null or verificatie_status in ('geverifieerd', 'gedeeltelijk', 'onzeker', 'conflict', 'niet_gecontroleerd')),
  constraint subsidie_kompas_bron_controles_reden_chk check (reden is null or char_length(reden) <= 60),
  constraint subsidie_kompas_bron_controles_versie_chk check (char_length(record_versie) = 64),
  constraint subsidie_kompas_bron_controles_uniek unique (program_id, record_type, record_id)
);

comment on table public.subsidie_kompas_bron_controles is
  'Broncontrole per financieringsmogelijkheid per project (laatste controle, door de server vastgelegd). Los van de financieringsstatus; geen bedragen. status verouderd = eerder gecontroleerd maar gegevens veranderd of controle te oud. Schrijven alleen via service_role.';

create index subsidie_kompas_bron_controles_user_idx on public.subsidie_kompas_bron_controles (user_id);
create index subsidie_kompas_bron_controles_program_idx on public.subsidie_kompas_bron_controles (program_id);

alter table public.subsidie_kompas_bron_controles enable row level security;

create policy "Users read own bron controles" on public.subsidie_kompas_bron_controles
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.subsidie_kompas_bron_controles from public, anon, authenticated;
grant select on table public.subsidie_kompas_bron_controles to authenticated;
grant all on table public.subsidie_kompas_bron_controles to service_role;

commit;
