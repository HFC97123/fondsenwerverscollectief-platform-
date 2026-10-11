-- Eén centrale regel: gegeven een regeling en een moment (default nu), wat
-- is de eerstvolgende nog geldige (actieve, niet-verstreken) aanvraagronde?
-- Gebruikt door zowel de Timeline-view als de admin-lijst en de chatbot-RPC
-- — geen tweede keer dezelfde datum/tijd-logica bouwen. Sluitingstijd wordt
-- als Europe/Amsterdam-wandkloktijd geïnterpreteerd (consistent met hoe
-- Nederlandse fondsen hun sluitingstijden publiceren); ontbreekt de tijd,
-- dan geldt einde van de dag. "Nog geldig" = sluitingsmoment >= p_nu, dus
-- 12:00:00 zelf telt nog mee, 12:00:01 niet meer.
create or replace function public.subsidieregeling_volgende_ronde(
  p_regeling_id uuid,
  p_nu timestamptz default now()
) returns table (
  ronde_id uuid,
  sluitingsdatum date,
  sluitingstijd time,
  sluitingsmoment timestamptz,
  open_vanaf date,
  beoordelingsdatum date,
  beoordelingsperiode text,
  toelichting text,
  bron_url text
)
language sql
stable
set search_path to 'public', 'pg_temp'
as $$
  select
    r.id,
    r.sluitingsdatum,
    r.sluitingstijd,
    (r.sluitingsdatum + coalesce(r.sluitingstijd, '23:59:59'::time)) at time zone 'Europe/Amsterdam',
    r.open_vanaf,
    r.beoordelingsdatum,
    r.beoordelingsperiode,
    r.toelichting,
    r.bron_url
  from public.subsidieregeling_rondes r
  where r.subsidieregeling_id = p_regeling_id
    and r.actief
    and (r.sluitingsdatum + coalesce(r.sluitingstijd, '23:59:59'::time)) at time zone 'Europe/Amsterdam' >= p_nu
  order by (r.sluitingsdatum + coalesce(r.sluitingstijd, '23:59:59'::time)) at time zone 'Europe/Amsterdam' asc
  limit 1;
$$;

comment on function public.subsidieregeling_volgende_ronde(uuid, timestamptz) is
  'Eerstvolgende nog geldige aanvraagronde van een regeling op moment p_nu (default now()), of geen rij als er geen (toekomstige, actieve) ronde is. Europe/Amsterdam-wandkloktijd; sluitingsmoment zelf telt nog als geldig.';

-- Puur een leeswaarheid over reeds-publieke datumvelden; nodig zodat de
-- consumentenview (die als de aanroepende rol draait voor functie-aanroepen,
-- ook al leest de view zelf de onderliggende tabellen met view-owner-rechten)
-- deze functie mag aanroepen.
revoke all on function public.subsidieregeling_volgende_ronde(uuid, timestamptz) from public;
grant execute on function public.subsidieregeling_volgende_ronde(uuid, timestamptz) to anon, authenticated, service_role;
