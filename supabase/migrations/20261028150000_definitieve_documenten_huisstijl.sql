-- Projectdocumentatie: concept en definitief (vaste versies van projectplan, begroting, dekkingsplan en het samengevoegde document) en de eigen huisstijl voor Premium.
-- Nog NIET toegepast. Terugdraaien: supabase/voorstellen/20261028150000_definitieve_documenten_huisstijl_rollback.sql (alleen na akkoord).
begin;

-- 1. Een definitieve versie is een vaste kopie ("snapshot") van het concept op het moment van "Maak definitief". Wijzigingen in het concept veranderen haar niet.
create table if not exists public.subsidie_kompas_definitieve_documenten (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  program_id uuid not null,
  soort text not null check (soort in ('projectplan', 'begroting', 'dekkingsplan', 'samengevoegd')),
  naam text not null default '' check (char_length(naam) <= 160),
  versie integer not null default 1 check (versie >= 1 and versie <= 200),
  inhoud jsonb not null check (jsonb_typeof(inhoud) = 'object' and pg_column_size(inhoud) <= 500000),
  created_at timestamptz not null default now(),
  constraint subsidie_kompas_definitief_uniek unique (program_id, soort, versie)
);

create index if not exists subsidie_kompas_definitief_project_idx on public.subsidie_kompas_definitieve_documenten (program_id, soort, versie desc);
create index if not exists subsidie_kompas_definitief_user_idx on public.subsidie_kompas_definitieve_documenten (user_id);

-- Het project moet van het lid zijn en het lid moet Pro of Premium hebben (zelfde regel als de rest van de werkruimte).
create or replace function public.subsidie_kompas_definitief_voor_schrijven()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.subsidie_kompas_programs p where p.id = new.program_id and p.user_id = new.user_id) then
    raise exception 'Dit project hoort niet bij dit lid' using errcode = '42501';
  end if;

  new.created_at := now();

  -- Het versienummer telt per project en soort door; een lid kan het niet zelf kiezen.
  select coalesce(max(d.versie), 0) + 1 into new.versie
  from public.subsidie_kompas_definitieve_documenten d
  where d.program_id = new.program_id and d.soort = new.soort;

  if new.versie > 200 then
    raise exception 'Te veel definitieve versies van dit document' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists subsidie_kompas_definitief_voor_schrijven on public.subsidie_kompas_definitieve_documenten;
create trigger subsidie_kompas_definitief_voor_schrijven
  before insert on public.subsidie_kompas_definitieve_documenten
  for each row execute function public.subsidie_kompas_definitief_voor_schrijven();

alter table public.subsidie_kompas_definitieve_documenten enable row level security;

drop policy if exists "Leden lezen eigen definitieve documenten" on public.subsidie_kompas_definitieve_documenten;
create policy "Leden lezen eigen definitieve documenten" on public.subsidie_kompas_definitieve_documenten
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Pro en Premium maken eigen definitieve documenten" on public.subsidie_kompas_definitieve_documenten;
create policy "Pro en Premium maken eigen definitieve documenten" on public.subsidie_kompas_definitieve_documenten
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.current_user_has_pro_access());

drop policy if exists "Leden verwijderen eigen definitieve documenten" on public.subsidie_kompas_definitieve_documenten;
create policy "Leden verwijderen eigen definitieve documenten" on public.subsidie_kompas_definitieve_documenten
  for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.subsidie_kompas_definitieve_documenten from public, anon, authenticated;
grant select, insert, delete on table public.subsidie_kompas_definitieve_documenten to authenticated;
grant all on table public.subsidie_kompas_definitieve_documenten to service_role;

comment on table public.subsidie_kompas_definitieve_documenten is 'Projectdocumentatie: vaste (definitieve) versies van het projectplan, de begroting en het dekkingsplan, als kopie van het concept op het moment van Maak definitief.';

-- 2. De eigen huisstijl voor documenten (Premium): logo, twee kleuren en de naam op het voorblad. Eén object per organisatie; leeg = de Subsidie Kompas-huisstijl.
alter table public.subsidie_kompas_organizations
  add column if not exists document_huisstijl jsonb null
  check (document_huisstijl is null or (jsonb_typeof(document_huisstijl) = 'object' and pg_column_size(document_huisstijl) <= 300000));

comment on column public.subsidie_kompas_organizations.document_huisstijl is 'Eigen huisstijl voor Word-, PDF- en Excel-export (Premium): { versie, naam, primair, accent, logo (data-URL), logoBreedte, logoHoogte }. Leeg = Subsidie Kompas-huisstijl.';

commit;
