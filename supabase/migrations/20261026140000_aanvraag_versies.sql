-- Aanvraag-assistent stap 2 en 3: bewaarde versies, concept/definitief, vragenlijst met tekenlimieten, checklist met stukken en de teller voor 'één beoordeling per fonds'.
-- Toegepast op 2026-10-26 via de SQL Editor. Terugdraaien: supabase/voorstellen/20261026140000_aanvraag_versies_rollback.sql (alleen na akkoord).
begin;

alter table public.subsidie_kompas_aanvragen
  add column if not exists status text not null default 'concept' check (status in ('concept', 'definitief')),
  add column if not exists vragen jsonb null check (vragen is null or (jsonb_typeof(vragen) = 'object' and pg_column_size(vragen) <= 100000)),
  add column if not exists stukken jsonb null check (stukken is null or (jsonb_typeof(stukken) = 'array' and pg_column_size(stukken) <= 100000)),
  add column if not exists schrijf_maand text null check (schrijf_maand is null or schrijf_maand ~ '^[0-9]{4}-[0-9]{2}$'),
  add column if not exists schrijf_aantal integer not null default 0 check (schrijf_aantal >= 0 and schrijf_aantal <= 1000),
  add column if not exists definitieve_versie_id uuid null;

create unique index if not exists subsidie_kompas_aanvragen_id_user_uniek on public.subsidie_kompas_aanvragen (id, user_id);

create table if not exists public.subsidie_kompas_aanvraag_versies (
  id uuid primary key default gen_random_uuid(),
  aanvraag_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  nummer integer not null check (nummer >= 1),
  naam text not null default '' check (char_length(naam) <= 120),
  status text not null default 'concept' check (status in ('concept', 'definitief')),
  herkomst text not null default 'lid' check (herkomst in ('ai', 'lid')),
  antwoorden jsonb not null default '[]'::jsonb check (jsonb_typeof(antwoorden) = 'array' and pg_column_size(antwoorden) <= 200000),
  beoordeling_id uuid null references public.subsidie_kompas_aanvraag_beoordelingen (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subsidie_kompas_versies_aanvraag_fkey
    foreign key (aanvraag_id, user_id) references public.subsidie_kompas_aanvragen (id, user_id) on delete cascade,
  constraint subsidie_kompas_versies_uniek unique (aanvraag_id, nummer)
);

create index if not exists subsidie_kompas_versies_aanvraag_idx on public.subsidie_kompas_aanvraag_versies (aanvraag_id, nummer desc);
create index if not exists subsidie_kompas_versies_user_idx on public.subsidie_kompas_aanvraag_versies (user_id);
create index if not exists subsidie_kompas_versies_beoordeling_idx on public.subsidie_kompas_aanvraag_versies (beoordeling_id) where beoordeling_id is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'subsidie_kompas_aanvragen_definitief_fkey') then
    alter table public.subsidie_kompas_aanvragen
      add constraint subsidie_kompas_aanvragen_definitief_fkey
      foreign key (definitieve_versie_id) references public.subsidie_kompas_aanvraag_versies (id) on delete set null;
  end if;
end $$;

create index if not exists subsidie_kompas_aanvragen_definitief_idx on public.subsidie_kompas_aanvragen (definitieve_versie_id) where definitieve_versie_id is not null;

create or replace function public.subsidie_kompas_versies_voor_schrijven()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.subsidie_kompas_aanvraag_versies v where v.aanvraag_id = new.aanvraag_id) >= 20 then
      raise exception 'Een aanvraag kan maximaal 20 versies hebben' using errcode = '23514';
    end if;

    new.created_at := now();
  else
    if new.user_id <> old.user_id or new.aanvraag_id <> old.aanvraag_id or new.nummer <> old.nummer then
      raise exception 'Eigenaar, aanvraag en nummer van een versie kunnen niet wijzigen' using errcode = '23514';
    end if;

    new.created_at := old.created_at;
  end if;

  new.updated_at := now();

  return new;
end;
$$;

drop trigger if exists subsidie_kompas_versies_voor_schrijven on public.subsidie_kompas_aanvraag_versies;
create trigger subsidie_kompas_versies_voor_schrijven
  before insert or update on public.subsidie_kompas_aanvraag_versies
  for each row execute function public.subsidie_kompas_versies_voor_schrijven();

alter table public.subsidie_kompas_aanvraag_versies enable row level security;

drop policy if exists "Leden lezen eigen versies" on public.subsidie_kompas_aanvraag_versies;
create policy "Leden lezen eigen versies" on public.subsidie_kompas_aanvraag_versies
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.subsidie_kompas_aanvraag_versies from public, anon, authenticated;
grant select on table public.subsidie_kompas_aanvraag_versies to authenticated;
grant all on table public.subsidie_kompas_aanvraag_versies to service_role;

comment on table public.subsidie_kompas_aanvraag_versies is 'Aanvraag-assistent: bewaarde versies (concept of definitief) van het plan of de antwoorden van het lid. Alleen de server schrijft; leden lezen eigen rijen.';

commit;
