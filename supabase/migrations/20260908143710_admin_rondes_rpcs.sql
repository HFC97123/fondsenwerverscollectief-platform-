-- Admin-only CRUD voor aanvraagrondes, zelfde SECURITY DEFINER +
-- current_user_is_admin()-patroon als alle andere admin-RPC's in dit project.
create or replace function public.admin_list_rondes(p_regeling_id uuid)
returns table (
  id uuid,
  subsidieregeling_id uuid,
  sluitingsdatum date,
  sluitingstijd time,
  open_vanaf date,
  beoordelingsdatum date,
  beoordelingsperiode text,
  toelichting text,
  bron_url text,
  actief boolean,
  is_verstreken boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
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
      (r.sluitingsdatum + coalesce(r.sluitingstijd, '23:59:59'::time)) at time zone 'Europe/Amsterdam' < now() as is_verstreken,
      r.created_at, r.updated_at
    from public.subsidieregeling_rondes r
    where r.subsidieregeling_id = p_regeling_id
    order by r.sluitingsdatum, r.sluitingstijd nulls last, r.id;
end;
$$;

revoke all on function public.admin_list_rondes(uuid) from public;
grant execute on function public.admin_list_rondes(uuid) to authenticated;

-- p_ronde_id null = nieuwe ronde aanmaken; anders bestaande bijwerken.
create or replace function public.admin_upsert_ronde(
  p_ronde_id uuid,
  p_regeling_id uuid,
  p_sluitingsdatum date,
  p_sluitingstijd time,
  p_open_vanaf date,
  p_beoordelingsdatum date,
  p_beoordelingsperiode text,
  p_toelichting text,
  p_bron_url text,
  p_actief boolean
) returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_id uuid;
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  if p_regeling_id is null or p_sluitingsdatum is null then
    raise exception 'Regeling en sluitingsdatum zijn verplicht.' using errcode = '22004';
  end if;

  if p_ronde_id is null then
    insert into public.subsidieregeling_rondes (
      subsidieregeling_id, sluitingsdatum, sluitingstijd, open_vanaf,
      beoordelingsdatum, beoordelingsperiode, toelichting, bron_url, actief
    ) values (
      p_regeling_id, p_sluitingsdatum, p_sluitingstijd, p_open_vanaf,
      p_beoordelingsdatum, p_beoordelingsperiode, p_toelichting, p_bron_url, coalesce(p_actief, true)
    )
    returning id into v_id;
  else
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
      updated_at = now()
    where id = p_ronde_id and subsidieregeling_id = p_regeling_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Ronde niet gevonden.' using errcode = 'P0002';
    end if;
  end if;

  return v_id;
end;
$$;

revoke all on function public.admin_upsert_ronde(uuid, uuid, date, time, date, date, text, text, text, boolean) from public;
grant execute on function public.admin_upsert_ronde(uuid, uuid, date, time, date, date, text, text, text, boolean) to authenticated;

create or replace function public.admin_verwijder_ronde(p_ronde_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  delete from public.subsidieregeling_rondes where id = p_ronde_id;
end;
$$;

revoke all on function public.admin_verwijder_ronde(uuid) from public;
grant execute on function public.admin_verwijder_ronde(uuid) to authenticated;
