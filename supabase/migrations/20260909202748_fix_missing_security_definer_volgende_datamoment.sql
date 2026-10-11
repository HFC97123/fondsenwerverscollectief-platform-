
create or replace function public.subsidieregeling_volgende_ronde(p_regeling_id uuid, p_nu timestamp with time zone default now())
 returns table(ronde_id uuid, sluitingsdatum date, sluitingstijd time without time zone, sluitingsmoment timestamp with time zone, open_vanaf date, beoordelingsdatum date, beoordelingsperiode text, toelichting text, bron_url text)
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select r.id, r.sluitingsdatum, r.sluitingstijd,
    (r.sluitingsdatum + coalesce(r.sluitingstijd, '23:59:59'::time)) at time zone 'Europe/Amsterdam',
    r.open_vanaf, r.beoordelingsdatum, r.beoordelingsperiode, r.toelichting, r.bron_url
  from public.subsidieregeling_rondes r
  where r.subsidieregeling_id = p_regeling_id
    and r.actief and r.status <> 'geannuleerd'
    and (r.sluitingsdatum + coalesce(r.sluitingstijd, '23:59:59'::time)) at time zone 'Europe/Amsterdam' >= p_nu
  order by (r.sluitingsdatum + coalesce(r.sluitingstijd, '23:59:59'::time)) at time zone 'Europe/Amsterdam' asc
  limit 1;
$function$;

create or replace function public.funder_volgende_datamoment(p_funder_id uuid, p_type datamoment_type default null::datamoment_type, p_nu timestamp with time zone default now())
 returns table(datamoment_id uuid, type datamoment_type, naam text, sluitingsdatum date, sluitingstijd time without time zone, sluitingsmoment timestamp with time zone, status datamoment_status, toelichting text, bron_url text)
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select r.id, r.type, r.naam, r.sluitingsdatum, r.sluitingstijd,
    (r.sluitingsdatum + coalesce(r.sluitingstijd, '23:59:59'::time)) at time zone 'Europe/Amsterdam',
    r.status, r.toelichting, r.bron_url
  from public.subsidieregeling_rondes r
  where r.funder_id = p_funder_id
    and r.subsidieregeling_id is null
    and r.actief and r.status <> 'geannuleerd'
    and (p_type is null or r.type = p_type)
    and (r.sluitingsdatum + coalesce(r.sluitingstijd, '23:59:59'::time)) at time zone 'Europe/Amsterdam' >= p_nu
  order by (r.sluitingsdatum + coalesce(r.sluitingstijd, '23:59:59'::time)) at time zone 'Europe/Amsterdam' asc
  limit 1;
$function$;
