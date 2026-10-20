-- Aanvraag-assistent: één eigen, atomaire maandteller (nog NIET toegepast op het live project; wordt toegepast na akkoord van Aisya).
--
-- Waarom: de maandgrens werd eerder gelezen vóór de AI-aanroep en pas daarna weggeschreven (twee verzoeken tegelijk kwamen er allebei door), de
-- beoordelingsteller zat in een tabel die met het project verdwijnt (project verwijderen = teller op nul) en de plan- en criteriateller leunde op
-- kompas_gebruik_log, een tabel die alleen meet en fouten stilletjes negeert.
--
-- Hoe nu: elk verzoek reserveert eerst één plek in deze tabel, in één database-stap met een slot per gebruiker (aanvraag_verbruik_reserveer).
-- Na de AI-aanroep wordt de reservering afgerond (telt mee) of als mislukt gemarkeerd (telt niet mee voor de maandgrens). Een reservering die
-- na 10 minuten nog open staat (de functie is dan gecrasht) telt niet meer mee. Veel mislukte pogingen kort achter elkaar (10 per uur) worden geweigerd.
-- De tabel hangt aan het account, niet aan een project: een project verwijderen laat de teller ongemoeid.
--
-- Wie mag wat: alleen de Edge Function (service_role). Leden hebben geen toegang tot de tabel en de functies.
-- Terugdraaien: supabase/voorstellen/20261020210000_aanvraag_verbruik_atomair_rollback.sql
begin;

create table if not exists public.subsidie_kompas_aanvraag_verbruik (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  soort text not null check (soort in ('eisen', 'beoordelingen', 'plannen')),
  status text not null default 'gereserveerd' check (status in ('gereserveerd', 'afgerond', 'mislukt')),
  created_at timestamptz not null default now(),
  afgerond_op timestamptz null
);

create index if not exists subsidie_kompas_aanvraag_verbruik_user_idx on public.subsidie_kompas_aanvraag_verbruik (user_id, soort, created_at desc);

alter table public.subsidie_kompas_aanvraag_verbruik enable row level security;

-- Geen policies: alleen service_role (die RLS omzeilt) komt erbij.
revoke all on table public.subsidie_kompas_aanvraag_verbruik from public, anon, authenticated;
grant all on table public.subsidie_kompas_aanvraag_verbruik to service_role;

comment on table public.subsidie_kompas_aanvraag_verbruik is
  'Aanvraag-assistent: de maandteller per lid (eisen ophalen, beoordelingen, plannen). Reserveren en afronden alleen via de functies aanvraag_verbruik_*; los van projecten, dus een project verwijderen wist de teller niet.';

-- Aantal dat deze maand meetelt: afgerond, of een verse reservering (jonger dan 10 minuten).
create or replace function public.aanvraag_verbruik_tel(p_user uuid, p_soort text, p_sinds timestamptz)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::integer
  from public.subsidie_kompas_aanvraag_verbruik v
  where v.user_id = p_user
    and v.soort = p_soort
    and v.created_at >= p_sinds
    and (v.status = 'afgerond' or (v.status = 'gereserveerd' and v.created_at > now() - interval '10 minutes'));
$$;

-- Controleert de grens en reserveert in één stap. Twee gelijktijdige verzoeken van dezelfde gebruiker wachten op elkaar (slot per gebruiker).
create or replace function public.aanvraag_verbruik_reserveer(p_user uuid, p_soort text, p_limiet integer, p_sinds timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_gebruikt integer;
  v_mislukt integer;
  v_id uuid;
begin
  if p_user is null or p_soort not in ('eisen', 'beoordelingen', 'plannen') or p_limiet is null or p_limiet < 0 or p_sinds is null then
    raise exception 'Ongeldige invoer' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('aanvraag_verbruik:' || p_user::text, 0));

  v_gebruikt := public.aanvraag_verbruik_tel(p_user, p_soort, p_sinds);

  if v_gebruikt >= p_limiet then
    return jsonb_build_object('ok', false, 'reden', 'maand-op', 'gebruikt', v_gebruikt);
  end if;

  select count(*)::integer into v_mislukt
  from public.subsidie_kompas_aanvraag_verbruik v
  where v.user_id = p_user and v.status = 'mislukt' and v.created_at > now() - interval '1 hour';

  if v_mislukt >= 10 then
    return jsonb_build_object('ok', false, 'reden', 'te-veel-mislukt', 'gebruikt', v_gebruikt);
  end if;

  insert into public.subsidie_kompas_aanvraag_verbruik (user_id, soort) values (p_user, p_soort) returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'gebruikt', v_gebruikt);
end;
$$;

-- Rondt een reservering af: gelukt = telt mee, mislukt = telt niet mee voor de maandgrens. Een eigen of al afgeronde reservering verandert niet.
create or replace function public.aanvraag_verbruik_rond_af(p_id uuid, p_user uuid, p_succes boolean)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.subsidie_kompas_aanvraag_verbruik
  set status = case when p_succes then 'afgerond' else 'mislukt' end, afgerond_op = now()
  where id = p_id and user_id = p_user and status = 'gereserveerd';
$$;

revoke all on function public.aanvraag_verbruik_tel(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.aanvraag_verbruik_reserveer(uuid, text, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.aanvraag_verbruik_rond_af(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.aanvraag_verbruik_tel(uuid, text, timestamptz) to service_role;
grant execute on function public.aanvraag_verbruik_reserveer(uuid, text, integer, timestamptz) to service_role;
grant execute on function public.aanvraag_verbruik_rond_af(uuid, uuid, boolean) to service_role;

commit;
