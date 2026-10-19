-- Aanvragen per fonds en het algemene projectplan (aanvraag-assistent, Pro/Premium). VOORSTEL, NIET UITGEVOERD. Uitvoering pas na akkoord van Aisya.
--
-- Wat er bij komt: de tabel subsidie_kompas_aanvragen. Per project één algemeen projectplan (soort 'algemeen') en per fonds één aanvraag (soort 'fonds'): de
-- criteria van het fonds, het geschreven plan en de laatste uitkomst. De tekst van een aanvraag die een lid laat beoordelen wordt NIET bewaard.
-- Bouwt voort op subsidie_kompas_aanvraag_beoordelingen (al live sinds 20261019124408): de aanvraag verwijst naar de laatste beoordeling.
--
-- Wie mag wat: schrijven alleen de Edge Function aanvraag-assistent (service_role), na controle van abonnement, project en maandgrens; lezen het lid zelf,
-- alleen eigen rijen (RLS). Eigenaar en project liggen vast (trigger). Maximaal 50 aanvragen per project.
-- De plannen tellen voor de maandgrens via kompas_gebruik_log (actie aanvraag_plan), niet via deze tabel.
-- Terugdraaien: 20261019160000_aanvragen_per_fonds_rollback.sql
begin;

create table if not exists public.subsidie_kompas_aanvragen (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  program_id uuid not null,
  soort text not null check (soort in ('algemeen', 'fonds')),
  fonds_label text not null default '' check (char_length(fonds_label) <= 200),
  fonds_sleutel text not null default '' check (char_length(fonds_sleutel) <= 120), -- genormaliseerde naam: hetzelfde fonds in andere hoofdletters is dezelfde aanvraag
  criteria jsonb not null default '[]'::jsonb check (jsonb_typeof(criteria) = 'array' and pg_column_size(criteria) <= 200000),
  criteria_bron text null check (criteria_bron is null or criteria_bron in ('lid', 'website', 'database', 'combinatie')),
  bronnen jsonb not null default '[]'::jsonb check (jsonb_typeof(bronnen) = 'array' and pg_column_size(bronnen) <= 20000), -- welke bronnen gelezen of niet gelezen zijn
  plan jsonb null check (plan is null or (jsonb_typeof(plan) = 'object' and pg_column_size(plan) <= 400000)),
  plan_bijgewerkt_op timestamptz null,
  laatste_beoordeling_id uuid null references public.subsidie_kompas_aanvraag_beoordelingen (id) on delete set null,
  laatste_uitkomst text null check (laatste_uitkomst is null or laatste_uitkomst in ('klaar-om-in-te-dienen', 'eerst-aanvullen', 'niet-te-beoordelen')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subsidie_kompas_aanvragen_program_fkey
    foreign key (program_id, user_id) references public.subsidie_kompas_programs (id, user_id) on delete cascade,
  constraint subsidie_kompas_aanvragen_soort_sleutel check ((soort = 'algemeen' and fonds_sleutel = '') or (soort = 'fonds' and char_length(fonds_sleutel) >= 2)),
  -- Nodig voor de upsert van de Edge Function: een algemeen plan per project en een aanvraag per fonds per project.
  constraint subsidie_kompas_aanvragen_uniek unique (program_id, soort, fonds_sleutel)
);

create index if not exists subsidie_kompas_aanvragen_user_idx on public.subsidie_kompas_aanvragen (user_id);
create index if not exists subsidie_kompas_aanvragen_program_idx on public.subsidie_kompas_aanvragen (program_id, updated_at desc);
create index if not exists subsidie_kompas_aanvragen_beoordeling_idx on public.subsidie_kompas_aanvragen (laatste_beoordeling_id) where laatste_beoordeling_id is not null;

create or replace function public.subsidie_kompas_aanvragen_voor_schrijven()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.subsidie_kompas_aanvragen a where a.program_id = new.program_id and a.user_id = new.user_id) >= 50 then
      raise exception 'Een project kan maximaal 50 aanvragen hebben' using errcode = '23514';
    end if;

    new.created_at := now();
  else
    if new.user_id <> old.user_id or new.program_id <> old.program_id then
      raise exception 'Eigenaar en project van een aanvraag kunnen niet wijzigen' using errcode = '23514';
    end if;

    new.created_at := old.created_at;
  end if;

  new.updated_at := now();

  return new;
end;
$$;

drop trigger if exists subsidie_kompas_aanvragen_voor_schrijven on public.subsidie_kompas_aanvragen;
create trigger subsidie_kompas_aanvragen_voor_schrijven
  before insert or update on public.subsidie_kompas_aanvragen
  for each row execute function public.subsidie_kompas_aanvragen_voor_schrijven();

alter table public.subsidie_kompas_aanvragen enable row level security;

drop policy if exists "Leden lezen eigen aanvragen" on public.subsidie_kompas_aanvragen;
create policy "Leden lezen eigen aanvragen" on public.subsidie_kompas_aanvragen
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Een lid leest alleen; schrijven en verwijderen gebeurt door de server (verwijderen gaat via het project of het account).
revoke all on table public.subsidie_kompas_aanvragen from public, anon, authenticated;
grant select on table public.subsidie_kompas_aanvragen to authenticated;
grant all on table public.subsidie_kompas_aanvragen to service_role;

comment on table public.subsidie_kompas_aanvragen is 'Aanvraag-assistent: per project het algemene projectplan (soort algemeen) en per fonds een aanvraag (criteria, plan, laatste uitkomst). Alleen de server schrijft; leden lezen eigen rijen. De tekst van een beoordeelde aanvraag wordt niet bewaard.';

commit;
