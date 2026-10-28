-- Stukken voor fondsenwerving zelf afvinken (opdracht Aisya, 28-10-2026). Alleen een kennisgeving voor het lid zelf
-- ("mijn aanvraag is compleet"); Subsidie Kompas controleert of bewaart de stukken hiermee niet.
-- program_id leeg = organisatiestuk (jaarrekening, ANBI, ...); gevuld = projectstuk (projectplan, begroting, ...).
-- Terugdraaien: drop table public.subsidie_kompas_stukken_afgevinkt;
create table if not exists public.subsidie_kompas_stukken_afgevinkt (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  program_id uuid references public.subsidie_kompas_programs (id) on delete cascade,
  stuk_id text not null check (char_length(stuk_id) between 1 and 60 and stuk_id ~ '^[a-z0-9-]+$'),
  created_at timestamptz not null default now()
);

create unique index if not exists subsidie_kompas_stukken_afgevinkt_uniek
  on public.subsidie_kompas_stukken_afgevinkt (user_id, coalesce(program_id, '00000000-0000-0000-0000-000000000000'::uuid), stuk_id);

alter table public.subsidie_kompas_stukken_afgevinkt enable row level security;

create policy "eigen afgevinkte stukken lezen" on public.subsidie_kompas_stukken_afgevinkt
  for select to authenticated using (user_id = auth.uid());

create policy "eigen stuk afvinken" on public.subsidie_kompas_stukken_afgevinkt
  for insert to authenticated with check (
    user_id = auth.uid()
    and (program_id is null or exists (select 1 from public.subsidie_kompas_programs p where p.id = program_id and p.user_id = auth.uid()))
  );

create policy "eigen vinkje weghalen" on public.subsidie_kompas_stukken_afgevinkt
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.subsidie_kompas_stukken_afgevinkt from anon;
grant select, insert, delete on public.subsidie_kompas_stukken_afgevinkt to authenticated;
