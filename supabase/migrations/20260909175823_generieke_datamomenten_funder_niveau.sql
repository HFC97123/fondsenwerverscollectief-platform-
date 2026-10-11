
-- Generaliseert subsidieregeling_rondes van "1 ronde hoort bij precies 1
-- regeling" naar "1 datamoment hoort bij een Funder, en kan aan 0..n
-- subsidieregelingen gekoppeld worden". Tabelnaam blijft ongewijzigd
-- (subsidieregeling_rondes) om de bestaande realtime-subscription
-- (watchDeadlines in deadlines.js), de view subsidieregelingen_deadlines en
-- de RPC kompas_subsidieregelingen_voor_tier niet te hoeven aanraken -
-- allebei blijven ongewijzigd werken omdat subsidieregeling_volgende_ronde()
-- exact dezelfde return-vorm behoudt.

do $$ begin
  create type public.datamoment_type as enum ('aanvraagdeadline', 'vergaderdatum', 'vooraanvraag', 'overig');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.datamoment_status as enum ('gepland', 'verzet', 'geannuleerd');
exception when duplicate_object then null; end $$;

-- 1. Nieuwe kolommen (additief, allemaal nullable of met default zodat
--    bestaande rijen geldig blijven).
alter table public.subsidieregeling_rondes
  add column if not exists funder_id uuid references public.funders(id) on delete cascade,
  add column if not exists type public.datamoment_type not null default 'aanvraagdeadline',
  add column if not exists naam text,
  add column if not exists status public.datamoment_status not null default 'gepland';

-- 2. subsidieregeling_id wordt optioneel: een datamoment kan nu ook zonder
--    directe koppeling bestaan (koppeling loopt dan uitsluitend via de
--    nieuwe junction-tabel hieronder, voor het geval het aan 0 of meerdere
--    regelingen tegelijk hoort).
alter table public.subsidieregeling_rondes
  alter column subsidieregeling_id drop not null;

-- 3. Backfill funder_id voor bestaande rijen vanuit hun regeling.
update public.subsidieregeling_rondes r
set funder_id = sr.funder_id
from public.subsidieregelingen sr
where sr.id = r.subsidieregeling_id
  and r.funder_id is null;

-- 4. Nu funder_id verplicht maken (elk datamoment hoort altijd bij precies
--    één Funder).
alter table public.subsidieregeling_rondes
  alter column funder_id set not null;

-- 5. Many-to-many koppeltabel: één datamoment kan aan meerdere
--    subsidieregelingen gekoppeld zijn, en één regeling kan meerdere
--    datamomenten hebben (zelfde patroon als funder_themas etc: composite
--    PK voorkomt dubbele koppelingen zonder expliciete conflict-target).
create table if not exists public.subsidieregeling_ronde_koppelingen (
  ronde_id uuid not null references public.subsidieregeling_rondes(id) on delete cascade,
  subsidieregeling_id uuid not null references public.subsidieregelingen(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (ronde_id, subsidieregeling_id)
);

alter table public.subsidieregeling_ronde_koppelingen enable row level security;
-- Bewust geen policies: net als subsidieregeling_rondes zelf uitsluitend
-- bereikbaar via SECURITY DEFINER-RPC's (deny-all voor anon/authenticated).

-- 6. Backfill de koppeltabel vanuit de bestaande directe kolom, zodat elke
--    bestaande ronde (incl. BPD Cultuurfonds) meteen ook via de nieuwe,
--    generieke weg vindbaar is.
insert into public.subsidieregeling_ronde_koppelingen (ronde_id, subsidieregeling_id)
select id, subsidieregeling_id from public.subsidieregeling_rondes
where subsidieregeling_id is not null
on conflict do nothing;

create index if not exists idx_ronde_koppelingen_regeling on public.subsidieregeling_ronde_koppelingen (subsidieregeling_id);
create index if not exists idx_rondes_funder on public.subsidieregeling_rondes (funder_id);
