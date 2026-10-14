-- Actieplan per project (Werkruimte: Chat naar dekkingsplan en actieplan, Fase B). TOEGEPAST op de live database op 2026-10-14
-- als migratie project_actions (versie 20261014095805) na akkoord van het lid. Bestandsnaam = live migratieversie.
--
-- Eén nieuwe tabel: subsidie_kompas_program_actions = de opgeslagen taken van het actieplan van een project
-- (actie, financier, deadline, status, prioriteit, notitie). Het dekkingsplan blijft de enige bron voor geld
-- (subsidie_kompas_program_funding); deze tabel bevat GEEN bedragen en kopieert geen namen of deadlines van
-- fondsen of regelingen. Een taak kan optioneel naar een financieringsregel verwijzen (funding_id); verdwijnt
-- die regel, dan blijft de taak bestaan. Hangt een taak aan een regel, dan wordt de naam van de financier NIET bij de taak
-- bewaard (de interface toont de live, naar abonnement gemaskeerde naam van de regel); financier_label is alleen vrije
-- tekst van het lid voor een financier die niet in het dekkingsplan staat.
-- De afgeleide acties (financiering/acties.js: berekend uit de stand van het dekkingsplan, zonder opslag) blijven
-- bestaan en worden naast deze taken getoond.
--
-- Veiligheid: RLS alleen eigen rijen en alleen op een eigen project; authenticated mag alleen de velden wijzigen die
-- van het lid zijn; user_id en program_id zijn onveranderlijk; een taak kan alleen naar een regel van hetzelfde
-- project en dezelfde gebruiker verwijzen; maximaal 200 taken per project.
-- Rollback: supabase/voorstel-niet-uitgevoerd/20261012120000_project_actions_rollback.sql
begin;

create table public.subsidie_kompas_program_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  program_id uuid not null,
  funding_id uuid null references public.subsidie_kompas_program_funding (id) on delete set null,
  title text not null,
  financier_label text null,
  due_date date null,
  status text not null default 'todo',
  priority text not null default 'normal',
  notes text null,
  source text not null default 'user',
  proposed_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subsidie_kompas_program_actions_program_fkey
    foreign key (program_id, user_id)
    references public.subsidie_kompas_programs (id, user_id) on delete cascade,
  constraint subsidie_kompas_program_actions_title_chk
    check (char_length(btrim(title)) between 1 and 200),
  constraint subsidie_kompas_program_actions_financier_chk
    check (financier_label is null or char_length(financier_label) <= 200),
  constraint subsidie_kompas_program_actions_status_chk
    check (status in ('todo', 'doing', 'done')),
  constraint subsidie_kompas_program_actions_priority_chk
    check (priority in ('high', 'normal', 'low')),
  constraint subsidie_kompas_program_actions_source_chk
    check (source in ('user', 'chat')),
  constraint subsidie_kompas_program_actions_notes_chk
    check (notes is null or char_length(notes) <= 4000)
);

comment on table public.subsidie_kompas_program_actions is
  'Actieplan per project: opgeslagen taken (actie, financier, deadline, status, prioriteit, notitie). Bevat geen bedragen; het dekkingsplan (subsidie_kompas_program_funding) blijft de enige bron voor geld. source = user (zelf toegevoegd) of chat (voorgesteld door Subsidie Kompas en door het lid opgeslagen).';

create index subsidie_kompas_program_actions_user_idx on public.subsidie_kompas_program_actions (user_id);
create index subsidie_kompas_program_actions_program_idx on public.subsidie_kompas_program_actions (program_id);
create index subsidie_kompas_program_actions_funding_idx on public.subsidie_kompas_program_actions (funding_id) where funding_id is not null;

-- Triggers
create or replace function public.subsidie_kompas_program_actions_voor_insert()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.funding_id is not null and not exists (
    select 1 from public.subsidie_kompas_program_funding f
    where f.id = new.funding_id and f.program_id = new.program_id and f.user_id = new.user_id
  ) then
    raise exception 'Een taak kan alleen naar een financieringsregel van hetzelfde project verwijzen'
      using errcode = '23514';
  end if;

  if (select count(*) from public.subsidie_kompas_program_actions a
      where a.program_id = new.program_id and a.user_id = new.user_id) >= 200 then
    raise exception 'Een project kan maximaal 200 taken hebben' using errcode = '23514';
  end if;

  new.title := btrim(new.title);
  new.created_at := now();
  new.updated_at := now();
  new.completed_at := case when new.status = 'done' then now() else null end;

  return new;
end;
$$;

create trigger subsidie_kompas_program_actions_voor_insert
  before insert on public.subsidie_kompas_program_actions
  for each row execute function public.subsidie_kompas_program_actions_voor_insert();

create or replace function public.subsidie_kompas_program_actions_voor_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.program_id is distinct from old.program_id
     or (new.funding_id is distinct from old.funding_id and not (old.funding_id is not null and new.funding_id is null))
     or new.source is distinct from old.source
     or new.proposed_at is distinct from old.proposed_at then
    raise exception 'id, gebruiker, project, financieringsregel, herkomst en voorstelmoment van een taak zijn onveranderlijk'
      using errcode = '23514';
  end if;

  new.title := btrim(new.title);
  new.created_at := old.created_at;
  new.updated_at := clock_timestamp();
  new.completed_at := case
    when new.status = 'done' and old.status <> 'done' then clock_timestamp()
    when new.status = 'done' then old.completed_at
    else null
  end;

  return new;
end;
$$;

create trigger subsidie_kompas_program_actions_voor_update
  before update on public.subsidie_kompas_program_actions
  for each row execute function public.subsidie_kompas_program_actions_voor_update();

-- RLS: alleen eigen taken, en schrijven alleen op een eigen project.
alter table public.subsidie_kompas_program_actions enable row level security;

create policy "Users read own actions" on public.subsidie_kompas_program_actions
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users create own actions" on public.subsidie_kompas_program_actions
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.subsidie_kompas_programs p
      where p.id = program_id and p.user_id = (select auth.uid())
    )
  );

create policy "Users update own actions" on public.subsidie_kompas_program_actions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.subsidie_kompas_programs p
      where p.id = program_id and p.user_id = (select auth.uid())
    )
  );

create policy "Users delete own actions" on public.subsidie_kompas_program_actions
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Rechten: geen anon; authenticated mag alleen de velden wijzigen die van het lid zijn.
revoke all on table public.subsidie_kompas_program_actions from public, anon, authenticated;
grant select, delete on table public.subsidie_kompas_program_actions to authenticated;
grant insert (user_id, program_id, funding_id, title, financier_label, due_date, status, priority, notes, source, proposed_at)
  on table public.subsidie_kompas_program_actions to authenticated;
grant update (title, financier_label, due_date, status, priority, notes, funding_id)
  on table public.subsidie_kompas_program_actions to authenticated;
grant all on table public.subsidie_kompas_program_actions to service_role;

commit;
