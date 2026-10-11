
-- Fase B van de deadline-architectuur: een datamoment is óf funder-breed
-- (subsidieregeling_id is null) óf regeling-specifiek (subsidieregeling_id
-- gevuld) - nooit beide, nooit many-to-many. Dit vervangt de eerdere
-- expliciete-koppeling-aan-meerdere-regelingen-opzet (subsidieregeling_ronde_koppelingen),
-- op uitdrukkelijk verzoek van het lid. Zie architectuuroverzicht voor de
-- volledige toelichting.

-- 1) funder_volgende_datamoment: bugfix - moet uitsluitend funder-brede
-- datamomenten meenemen (subsidieregeling_id is null), nooit een
-- regeling-specifiek datamoment van dezelfde funder.
CREATE OR REPLACE FUNCTION public.funder_volgende_datamoment(p_funder_id uuid, p_type datamoment_type DEFAULT NULL::datamoment_type, p_nu timestamp with time zone DEFAULT now())
 RETURNS TABLE(datamoment_id uuid, type datamoment_type, naam text, sluitingsdatum date, sluitingstijd time without time zone, sluitingsmoment timestamp with time zone, status datamoment_status, toelichting text, bron_url text)
 LANGUAGE sql STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

-- 2) subsidieregeling_volgende_ronde: terug naar een rechtstreeks filter op
-- subsidieregeling_id (geen junction meer).
CREATE OR REPLACE FUNCTION public.subsidieregeling_volgende_ronde(p_regeling_id uuid, p_nu timestamp with time zone DEFAULT now())
 RETURNS TABLE(ronde_id uuid, sluitingsdatum date, sluitingstijd time without time zone, sluitingsmoment timestamp with time zone, open_vanaf date, beoordelingsdatum date, beoordelingsperiode text, toelichting text, bron_url text)
 LANGUAGE sql STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

-- 3) admin_upsert_ronde: niet langer in de junction schrijven/lezen; rechtstreeks
-- op (id, subsidieregeling_id) controleren. Signatuur (aantal/typen argumenten)
-- blijft ongewijzigd, dus geen DROP FUNCTION nodig.
CREATE OR REPLACE FUNCTION public.admin_upsert_ronde(p_ronde_id uuid, p_regeling_id uuid, p_sluitingsdatum date, p_sluitingstijd time without time zone, p_open_vanaf date, p_beoordelingsdatum date, p_beoordelingsperiode text, p_toelichting text, p_bron_url text, p_actief boolean, p_type datamoment_type DEFAULT 'aanvraagdeadline'::datamoment_type, p_naam text DEFAULT NULL::text, p_status datamoment_status DEFAULT 'gepland'::datamoment_status)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_id uuid;
  v_funder_id uuid;
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  if p_regeling_id is null or p_sluitingsdatum is null then
    raise exception 'Regeling en sluitingsdatum zijn verplicht.' using errcode = '22004';
  end if;

  select funder_id into v_funder_id from public.subsidieregelingen where id = p_regeling_id;

  if v_funder_id is null then
    raise exception 'Regeling niet gevonden.' using errcode = 'P0002';
  end if;

  if p_ronde_id is null then
    insert into public.subsidieregeling_rondes (
      funder_id, subsidieregeling_id, sluitingsdatum, sluitingstijd, open_vanaf,
      beoordelingsdatum, beoordelingsperiode, toelichting, bron_url, actief, type, naam, status
    ) values (
      v_funder_id, p_regeling_id, p_sluitingsdatum, p_sluitingstijd, p_open_vanaf,
      p_beoordelingsdatum, p_beoordelingsperiode, p_toelichting, p_bron_url, coalesce(p_actief, true),
      coalesce(p_type, 'aanvraagdeadline'), p_naam, coalesce(p_status, 'gepland')
    )
    returning id into v_id;
  else
    if not exists (
      select 1 from public.subsidieregeling_rondes
      where id = p_ronde_id and subsidieregeling_id = p_regeling_id
    ) then
      raise exception 'Ronde niet gevonden.' using errcode = 'P0002';
    end if;

    update public.subsidieregeling_rondes
    set
      sluitingsdatum = p_sluitingsdatum,
      sluitingstijd = p_sluitingstijd,
      open_vanaf = p_open_vanaf,
      beoordelingsdatum = p_beoordelingsdatum,
      beoordelingsperiode = p_beoordelingsperiode,
      toelichting = p_toelichting,
      bron_url = p_bron_url,
      actief = coalesce(p_actief, actief),
      type = coalesce(p_type, type),
      naam = coalesce(p_naam, naam),
      status = coalesce(p_status, status),
      updated_at = now()
    where id = p_ronde_id
    returning id into v_id;
  end if;

  return v_id;
end;
$function$;
