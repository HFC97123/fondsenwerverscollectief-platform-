-- RC1 stap 7 (7C - BE2): minimale, atomische server-side rate limiter voor
-- de subsidie-kompas Edge Function. Alleen voor ingelogde gebruikers (zie
-- rapportage RC1 stap 7 voor waarom anonieme/IP-gebaseerde limitering in
-- deze stap niet is geïmplementeerd). Eén kleine tabel (één rij per profiel,
-- geen groei per verzoek) + één atomische SECURITY DEFINER-functie. Geen
-- persoonsgegevens buiten profile_id zelf, geen berichtinhoud, geen prompts.

create table if not exists public.subsidie_kompas_rate_limits (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  window_start timestamptz not null default now(),
  request_count integer not null default 0,
  updated_at timestamptz not null default now()
);

comment on table public.subsidie_kompas_rate_limits is
  'RC1 stap 7 (BE2): per-profiel telraam voor de minimale server-side rate limiter van de subsidie-kompas Edge Function. Eén rij per gebruiker die ooit een aanvraag deed (geen groei per verzoek, geen berichtinhoud). Uitsluitend gelezen/geschreven via kompas_check_rate_limit(); geen directe client-toegang (geen RLS-policy, geen GRANT aan anon/authenticated).';

alter table public.subsidie_kompas_rate_limits enable row level security;
-- Bewust GEEN policies: alleen de service-role (de Edge Function, via
-- SECURITY DEFINER hieronder) mag deze tabel aanraken - zelfde patroon als
-- classification_audit_log.

create or replace function public.kompas_check_rate_limit(
  p_profile_id uuid,
  p_max_requests integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nieuwe_telling integer;
begin
  insert into public.subsidie_kompas_rate_limits (profile_id, window_start, request_count, updated_at)
  values (p_profile_id, now(), 1, now())
  on conflict (profile_id) do update set
    window_start = case
      when subsidie_kompas_rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
      then now()
      else subsidie_kompas_rate_limits.window_start
    end,
    request_count = case
      when subsidie_kompas_rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
      then 1
      else subsidie_kompas_rate_limits.request_count + 1
    end,
    updated_at = now()
  returning request_count into v_nieuwe_telling;

  return v_nieuwe_telling <= p_max_requests;
end;
$$;

revoke all on function public.kompas_check_rate_limit(uuid, integer, integer) from public;
revoke all on function public.kompas_check_rate_limit(uuid, integer, integer) from anon;
revoke all on function public.kompas_check_rate_limit(uuid, integer, integer) from authenticated;
grant execute on function public.kompas_check_rate_limit(uuid, integer, integer) to service_role;

revoke all on public.subsidie_kompas_rate_limits from anon;
revoke all on public.subsidie_kompas_rate_limits from authenticated;
grant select, insert, update on public.subsidie_kompas_rate_limits to service_role;
