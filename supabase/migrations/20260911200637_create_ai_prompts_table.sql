-- ai_prompts: beheerbare systeemtekst voor de Subsidie Kompas-assistent.
-- De Edge Function subsidie-kompas (systeemtekst()) leest hier al uit sinds
-- versie 38 (met try/catch-fallback op de hardcoded constanten in index.ts
-- als deze tabel leeg is of niet bestaat) - dit is de eerste keer dat de
-- tabel daadwerkelijk wordt aangemaakt.
create table if not exists public.ai_prompts (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  prompt text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

comment on table public.ai_prompts is 'Beheerbare systeemtekst-overrides voor de Subsidie Kompas-assistent (Edge Function subsidie-kompas, functie systeemtekst()). Sleutels: kompas.system, kompas.premium_addendum, kompas.aanvraagbeoordeling_addendum, kompas.projectplan_addendum, kompas.begroting_addendum, kompas.strategie_addendum. Ontbreekt een sleutel, dan valt de functie terug op de hardcoded tekst in index.ts.';

-- RLS aan, bewust geen policies: alleen de service-role key (die de Edge
-- Function gebruikt) en beheer via Supabase/migraties kunnen dit lezen of
-- wijzigen. Geen enkele client-rol (anon/authenticated) mag hier ooit direct
-- bij kunnen - dit bepaalt wat de AI tegen alle leden zegt.
alter table public.ai_prompts enable row level security;

create or replace function public.ai_prompts_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_ai_prompts_updated_at on public.ai_prompts;
create trigger trg_ai_prompts_updated_at
  before update on public.ai_prompts
  for each row execute function public.ai_prompts_set_updated_at();
