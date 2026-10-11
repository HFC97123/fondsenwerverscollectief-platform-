-- Fase 1 Classificatiebeheer: koppeltabellen tussen funders/subsidieregelingen
-- en de bestaande centrale classificatietabellen (themas, doelgroepen, regios).
-- Volgt exact het patroon van de al bestaande funder_themas-tabel: composite
-- PK, ON DELETE CASCADE aan beide kanten, alleen-lezen RLS voor authenticated.
-- Schrijven gebeurt straks uitsluitend via SECURITY DEFINER admin-RPC's
-- (zie migratie fase1_classificatie_admin_rpcs). Puur additief: raakt geen
-- bestaande tabellen, kolommen of data.

create table if not exists public.funder_doelgroepen (
  funder_id uuid not null references public.funders(id) on delete cascade,
  doelgroep_id uuid not null references public.doelgroepen(id) on delete cascade,
  primary key (funder_id, doelgroep_id)
);

alter table public.funder_doelgroepen enable row level security;

create policy funder_doelgroepen_read_authenticated
  on public.funder_doelgroepen
  for select
  to authenticated
  using (true);

create table if not exists public.subsidieregeling_themas (
  subsidieregeling_id uuid not null references public.subsidieregelingen(id) on delete cascade,
  thema_id uuid not null references public.themas(id) on delete cascade,
  primary key (subsidieregeling_id, thema_id)
);

alter table public.subsidieregeling_themas enable row level security;

create policy subsidieregeling_themas_read_authenticated
  on public.subsidieregeling_themas
  for select
  to authenticated
  using (true);

create table if not exists public.subsidieregeling_doelgroepen (
  subsidieregeling_id uuid not null references public.subsidieregelingen(id) on delete cascade,
  doelgroep_id uuid not null references public.doelgroepen(id) on delete cascade,
  primary key (subsidieregeling_id, doelgroep_id)
);

alter table public.subsidieregeling_doelgroepen enable row level security;

create policy subsidieregeling_doelgroepen_read_authenticated
  on public.subsidieregeling_doelgroepen
  for select
  to authenticated
  using (true);

create table if not exists public.subsidieregeling_regios (
  subsidieregeling_id uuid not null references public.subsidieregelingen(id) on delete cascade,
  regio_id uuid not null references public.regios(id) on delete cascade,
  primary key (subsidieregeling_id, regio_id)
);

alter table public.subsidieregeling_regios enable row level security;

create policy subsidieregeling_regios_read_authenticated
  on public.subsidieregeling_regios
  for select
  to authenticated
  using (true);
