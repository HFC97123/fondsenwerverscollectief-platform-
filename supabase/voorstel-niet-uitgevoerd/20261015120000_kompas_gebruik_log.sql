-- Interne gebruiks- en kostenmeter (Pro/Premium-positionering, TIER-2). VOORSTEL, NIET UITGEVOERD.
--
-- Eén nieuwe tabel: kompas_gebruik_log = per relevante actie één rij met tellers en een geschatte prijs. UITSLUITEND METEN:
-- geen limieten, geen blokkering, geen melding aan leden. Er komt NOOIT inhoud in (geen prompts, gesprekken, projectdocumenten,
-- zoekopdrachten of URL's); de Edge Function (_shared/gebruikLog.ts) laat alleen de kolommen hieronder door.
--
-- Veiligheid: RLS aan, geen enkele policy voor ingelogde leden (niemand leest of schrijft via de API); alleen service_role (de Edge
-- Function) schrijft. Lezen voor beheer loopt via twee admin-only RPC's (current_user_is_admin()). user_id is bewust GEEN foreign key:
-- een verwijderd account mag het meten niet blokkeren; bij accountverwijdering moeten de rijen van die gebruiker worden verwijderd of
-- geanonimiseerd (juridisch go-livepunt, net als de akkoordhistorie).
-- Retentie: nog niet geautomatiseerd; voorstel 13 maanden.
-- De observatiebudgetten (Pro € 7, Premium € 14) staan NIET hier maar in supabase/functions/_shared/tierConfig.ts (één bron).
-- Rollback: 20261015120000_kompas_gebruik_log_rollback.sql
begin;

create table if not exists public.kompas_gebruik_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid not null,
  tier text not null check (tier in ('free', 'pro', 'premium', 'admin')),
  -- Bewust geen CHECK op de waarden: de lijst staat centraal in de code (ACTIE_TYPES) en moet zonder migratie uit te breiden zijn.
  action_type text not null check (char_length(action_type) between 1 and 40),
  project_id uuid null,
  model text null check (model is null or char_length(model) <= 60),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  web_search_calls integer not null default 0 check (web_search_calls >= 0),
  external_page_fetches integer not null default 0 check (external_page_fetches >= 0),
  verification_pages integer not null default 0 check (verification_pages >= 0),
  cache_hits integer not null default 0 check (cache_hits >= 0),
  duration_ms integer not null default 0 check (duration_ms >= 0),
  estimated_cost_eur numeric(10, 4) null check (estimated_cost_eur is null or estimated_cost_eur >= 0),
  success boolean not null default true
);

create index if not exists kompas_gebruik_log_user_tijd_idx on public.kompas_gebruik_log (user_id, created_at desc);
create index if not exists kompas_gebruik_log_tijd_idx on public.kompas_gebruik_log (created_at desc);

alter table public.kompas_gebruik_log enable row level security;

revoke all on table public.kompas_gebruik_log from public, anon, authenticated;
grant select, insert on table public.kompas_gebruik_log to service_role;
grant usage, select on sequence public.kompas_gebruik_log_id_seq to service_role;

-- Per gebruiker over een periode (standaard: de lopende maand). Alleen beheerders.
create or replace function public.admin_gebruik_per_gebruiker(p_vanaf timestamptz default null, p_tot timestamptz default null)
returns table (
  user_id uuid, email text, tier text, acties bigint, input_tokens bigint, output_tokens bigint,
  web_search_calls bigint, kosten_eur numeric, mislukt bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_vanaf timestamptz := coalesce(p_vanaf, date_trunc('month', now()));
  v_tot timestamptz := coalesce(p_tot, now() + interval '1 second');
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  return query
  select
    g.user_id, p.email, (array_agg(g.tier order by g.created_at desc))[1],
    count(*), coalesce(sum(g.input_tokens), 0), coalesce(sum(g.output_tokens), 0),
    coalesce(sum(g.web_search_calls), 0), coalesce(sum(g.estimated_cost_eur), 0),
    count(*) filter (where not g.success)
  from public.kompas_gebruik_log g
  left join public.profiles p on p.id = g.user_id
  where g.created_at >= v_vanaf and g.created_at < v_tot
  group by g.user_id, p.email
  order by coalesce(sum(g.estimated_cost_eur), 0) desc;
end;
$$;

-- Per tier: aantal gebruikers, totaal, gemiddelde en duurste gebruiker. Alleen beheerders.
create or replace function public.admin_gebruik_per_tier(p_vanaf timestamptz default null, p_tot timestamptz default null)
returns table (tier text, gebruikers bigint, totaal_kosten_eur numeric, gemiddeld_per_gebruiker_eur numeric, hoogste_gebruiker_eur numeric, acties bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_vanaf timestamptz := coalesce(p_vanaf, date_trunc('month', now()));
  v_tot timestamptz := coalesce(p_tot, now() + interval '1 second');
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  return query
  with per_gebruiker as (
    select g.user_id, (array_agg(g.tier order by g.created_at desc))[1] as tier,
           coalesce(sum(g.estimated_cost_eur), 0) as kosten, count(*) as acties
    from public.kompas_gebruik_log g
    where g.created_at >= v_vanaf and g.created_at < v_tot
    group by g.user_id
  )
  select pg.tier, count(*), sum(pg.kosten), round(avg(pg.kosten), 4), max(pg.kosten), sum(pg.acties)::bigint
  from per_gebruiker pg
  group by pg.tier
  order by pg.tier;
end;
$$;

revoke all on function public.admin_gebruik_per_gebruiker(timestamptz, timestamptz) from public, anon;
revoke all on function public.admin_gebruik_per_tier(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_gebruik_per_gebruiker(timestamptz, timestamptz) to authenticated;
grant execute on function public.admin_gebruik_per_tier(timestamptz, timestamptz) to authenticated;

commit;
