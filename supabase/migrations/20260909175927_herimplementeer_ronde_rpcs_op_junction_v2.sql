
drop function if exists public.admin_list_rondes(uuid);

create or replace function public.subsidieregeling_volgende_ronde(p_regeling_id uuid, p_nu timestamptz default now())
returns table(ronde_id uuid, sluitingsdatum date, sluitingstijd time, sluitingsmoment timestamptz, open_vanaf date, beoordelingsdatum date, beoordelingsperiode text, toelichting text, bron_url text)
language sql stable
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
  join public.subsidieregeling_ronde_koppelingen k on k.ronde_id = r.id
  where k.subsidieregeling_id = p_regeling_id
    and r.actief
    and r.status <> 'geannuleerd'
    and (r.sluitingsdatum + coalesce(r.sluitingstijd, '23:59:59'::time)) at time zone 'Europe/Amsterdam' >= p_nu
  order by (r.sluitingsdatum + coalesce(r.sluitingstijd, '23:59:59'::time)) at time zone 'Europe/Amsterdam' asc
  limit 1;
$$;

create or replace function public.funder_volgende_datamoment(p_funder_id uuid, p_type public.datamoment_type default null, p_nu timestamptz default now())
returns table(datamoment_id uuid, type public.datamoment_type, naam text, sluitingsdatum date, sluitingstijd time, sluitingsmoment timestamptz, status public.datamoment_status, toelichting text, bron_url text)
language sql stable
set search_path to 'public', 'pg_temp'
as $$
  select
    r.id, r.type, r.naam,
    r.sluitingsdatum, r.sluitingstijd,
    (r.sluitingsdatum + coalesce(r.sluitingstijd, '23:59:59'::time)) at time zone 'Europe/Amsterdam',
    r.status, r.toelichting, r.bron_url
  from public.subsidieregeling_rondes r
  where r.funder_id = p_funder_id
    and r.actief
    and r.status <> 'geannuleerd'
    and (p_type is null or r.type = p_type)
    and (r.sluitingsdatum + coalesce(r.sluitingstijd, '23:59:59'::time)) at time zone 'Europe/Amsterdam' >= p_nu
  order by (r.sluitingsdatum + coalesce(r.sluitingstijd, '23:59:59'::time)) at time zone 'Europe/Amsterdam' asc
  limit 1;
$$;

create or replace function public.admin_list_rondes(p_regeling_id uuid)
returns table(
  id uuid, subsidieregeling_id uuid, sluitingsdatum date, sluitingstijd time, open_vanaf date,
  beoordelingsdatum date, beoordelingsperiode text, toelichting text, bron_url text, actief boolean,
  type public.datamoment_type, naam text, status public.datamoment_status,
  is_verstreken boolean, gedeeld_met_namen text[], created_at timestamptz, updated_at timestamptz
)
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  return query
    select
      r.id, r.subsidieregeling_id, r.sluitingsdatum, r.sluitingstijd, r.open_vanaf,
      r.beoordelingsdatum, r.beoordelingsperiode, r.toelichting, r.bron_url, r.actief,
      r.type, r.naam, r.status,
      (r.sluitingsdatum + coalesce(r.sluitingstijd, '23:59:59'::time)) at time zone 'Europe/Amsterdam' < now() as is_verstreken,
      (
        select array_agg(sr2.naam order by sr2.naam)
        from public.subsidieregeling_ronde_koppelingen k2
        join public.subsidieregelingen sr2 on sr2.id = k2.subsidieregeling_id
        where k2.ronde_id = r.id and k2.subsidieregeling_id <> p_regeling_id
      ) as gedeeld_met_namen,
      r.created_at, r.updated_at
    from public.subsidieregeling_rondes r
    join public.subsidieregeling_ronde_koppelingen k on k.ronde_id = r.id
    where k.subsidieregeling_id = p_regeling_id
    order by r.sluitingsdatum, r.sluitingstijd nulls last, r.id;
end;
$$;

create or replace function public.admin_upsert_ronde(
  p_ronde_id uuid, p_regeling_id uuid, p_sluitingsdatum date, p_sluitingstijd time,
  p_open_vanaf date, p_beoordelingsdatum date, p_beoordelingsperiode text, p_toelichting text,
  p_bron_url text, p_actief boolean,
  p_type public.datamoment_type default 'aanvraagdeadline', p_naam text default null,
  p_status public.datamoment_status default 'gepland'
)
returns uuid
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
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

    insert into public.subsidieregeling_ronde_koppelingen (ronde_id, subsidieregeling_id)
    values (v_id, p_regeling_id)
    on conflict do nothing;
  else
    if not exists (
      select 1 from public.subsidieregeling_ronde_koppelingen
      where ronde_id = p_ronde_id and subsidieregeling_id = p_regeling_id
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
$$;
