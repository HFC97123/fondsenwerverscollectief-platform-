-- Enums
create type funder_type as enum (
  'vermogensfonds',
  'gemeente_lokale_overheid',
  'rijksoverheid',
  'europese_fondsen',
  'service_club',
  'religieuze_instelling'
);

create type enrichment_status_type as enum (
  'nieuw',
  'in_onderzoek',
  'deels_verrijkt',
  'compleet'
);

create type discovered_by_type as enum ('handmatig', 'agent');

-- Core funders table
create table public.funders (
  id uuid primary key default gen_random_uuid(),
  naam text not null,
  type funder_type not null,
  missie text,
  bijdrage_min numeric,
  bijdrage_max numeric,
  jaarbudget numeric,
  deadlines text,
  contactpersoon text,
  contactpersoon_prive boolean not null default true,
  email text,
  email_prive boolean not null default true,
  telefoon text,
  telefoon_prive boolean not null default true,
  adres text,
  website text,
  status text not null default 'actief',
  enrichment_status enrichment_status_type not null default 'nieuw',
  last_researched_at timestamptz,
  research_source text,
  bron text,
  external_relatienummer text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index funders_type_idx on public.funders(type);
create index funders_enrichment_status_idx on public.funders(enrichment_status);
create unique index funders_external_relatienummer_idx on public.funders(external_relatienummer) where external_relatienummer is not null;
create index funders_naam_idx on public.funders using gin (naam gin_trgm_ops);

-- Themes and regions (lookup tables for structured matching)
create table public.themas (
  id uuid primary key default gen_random_uuid(),
  naam text not null unique
);

create table public.regios (
  id uuid primary key default gen_random_uuid(),
  naam text not null unique
);

create table public.funder_themas (
  funder_id uuid not null references public.funders(id) on delete cascade,
  thema_id uuid not null references public.themas(id) on delete cascade,
  primary key (funder_id, thema_id)
);

create table public.funder_regios (
  funder_id uuid not null references public.funders(id) on delete cascade,
  regio_id uuid not null references public.regios(id) on delete cascade,
  primary key (funder_id, regio_id)
);

-- Subsidieregelingen (child records for funders with multiple schemes, e.g. gemeenten, rijksoverheid, EU)
create table public.subsidieregelingen (
  id uuid primary key default gen_random_uuid(),
  funder_id uuid not null references public.funders(id) on delete cascade,
  naam text not null,
  thema text,
  bedrag_min numeric,
  bedrag_max numeric,
  deadline text,
  voorwaarden text,
  discovered_by discovered_by_type not null default 'handmatig',
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subsidieregelingen_funder_id_idx on public.subsidieregelingen(funder_id);

-- Free-text notes/history per funder
create table public.funder_notes (
  id uuid primary key default gen_random_uuid(),
  funder_id uuid not null references public.funders(id) on delete cascade,
  note text not null,
  created_by text,
  created_at timestamptz not null default now()
);

create index funder_notes_funder_id_idx on public.funder_notes(funder_id);

-- Prospects / network (people & companies, separate from institutional funders)
create table public.prospects (
  id uuid primary key default gen_random_uuid(),
  naam text not null,
  bedrijf text,
  aanknopingspunt text,
  status text,
  contactgegevens text,
  created_at timestamptz not null default now()
);
