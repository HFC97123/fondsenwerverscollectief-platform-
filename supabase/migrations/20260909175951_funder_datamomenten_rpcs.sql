
-- Beheer van datamomenten op Funder-niveau: kan aan 0..n subsidieregelingen
-- van diezelfde Funder gekoppeld worden. Dit is de nieuwe, primaire ingang
-- voor gedeelde vergaderdata/aanvraagdeadlines die voor meerdere regelingen
-- tegelijk gelden - de bestaande admin_upsert_ronde (regeling-niveau) blijft
-- daarnaast bestaan voor het "snel één ronde voor deze ene regeling"-geval.

create or replace function public.admin_list_funder_datamomenten(p_funder_id uuid)
returns table(
  id uuid, type public.datamoment_type, naam text, sluitingsdatum date, sluitingstijd time,
  status public.datamoment_status, toelichting text, bron_url text, actief boolean,
  is_verstreken boolean, regeling_ids uuid[], regeling_namen text[],
  created_at timestamptz, updated_at timestamptz
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
      r.id, r.type, r.naam, r.sluitingsdatum, r.sluitingstijd, r.status, r.toelichting, r.bron_url, r.actief,
      (r.sluitingsdatum + coalesce(r.sluitingstijd, '23:59:59'::time)) at time zone 'Europe/Amsterdam' < now() as is_verstreken,
      (
        select array_agg(k.subsidieregeling_id order by sr.naam)
        from public.subsidieregeling_ronde_koppelingen k
        join public.subsidieregelingen sr on sr.id = k.subsidieregeling_id
        where k.ronde_id = r.id
      ) as regeling_ids,
      (
        select array_agg(sr.naam order by sr.naam)
        from public.subsidieregeling_ronde_koppelingen k
        join public.subsidieregelingen sr on sr.id = k.subsidieregeling_id
        where k.ronde_id = r.id
      ) as regeling_namen,
      r.created_at, r.updated_at
    from public.subsidieregeling_rondes r
    where r.funder_id = p_funder_id
    order by r.sluitingsdatum, r.sluitingstijd nulls last, r.id;
end;
$$;

-- p_regeling_ids: welke subsidieregelingen van déze Funder dit datamoment nu
-- moet raken. Vervangt bij een update de volledige koppelingset in één
-- transactie (verwijderen wat niet meer gekozen is, toevoegen wat nieuw is,
-- ON CONFLICT DO NOTHING voorkomt dubbele koppelingen). IDs die niet bij
-- p_funder_id horen worden genegeerd (voorkomt per ongeluk aan een andere
-- Funder's regeling koppelen).
create or replace function public.admin_upsert_funder_datamoment(
  p_datamoment_id uuid, p_funder_id uuid, p_type public.datamoment_type, p_naam text,
  p_sluitingsdatum date, p_sluitingstijd time, p_status public.datamoment_status,
  p_toelichting text, p_bron_url text, p_actief boolean, p_regeling_ids uuid[]
)
returns uuid
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_id uuid;
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  if p_funder_id is null or p_sluitingsdatum is null or p_type is null then
    raise exception 'Funder, datum en type zijn verplicht.' using errcode = '22004';
  end if;

  if not exists (select 1 from public.funders where id = p_funder_id) then
    raise exception 'Fonds niet gevonden.' using errcode = 'P0002';
  end if;

  if p_datamoment_id is null then
    insert into public.subsidieregeling_rondes (
      funder_id, subsidieregeling_id, type, naam, sluitingsdatum, sluitingstijd, status, toelichting, bron_url, actief
    ) values (
      p_funder_id, null, p_type, p_naam, p_sluitingsdatum, p_sluitingstijd, coalesce(p_status, 'gepland'), p_toelichting, p_bron_url, coalesce(p_actief, true)
    )
    returning id into v_id;
  else
    if not exists (select 1 from public.subsidieregeling_rondes where id = p_datamoment_id and funder_id = p_funder_id) then
      raise exception 'Datamoment niet gevonden.' using errcode = 'P0002';
    end if;

    update public.subsidieregeling_rondes
    set
      type = p_type,
      naam = p_naam,
      sluitingsdatum = p_sluitingsdatum,
      sluitingstijd = p_sluitingstijd,
      status = coalesce(p_status, status),
      toelichting = p_toelichting,
      bron_url = p_bron_url,
      actief = coalesce(p_actief, actief),
      updated_at = now()
    where id = p_datamoment_id
    returning id into v_id;
  end if;

  -- Koppelingset volledig vervangen door wat is meegegeven (leeg = geen
  -- koppeling aan een specifieke regeling; het datamoment blijft dan wel
  -- gewoon bewaard op Funder-niveau).
  delete from public.subsidieregeling_ronde_koppelingen
  where ronde_id = v_id;

  insert into public.subsidieregeling_ronde_koppelingen (ronde_id, subsidieregeling_id)
  select v_id, sr.id
  from unnest(coalesce(p_regeling_ids, array[]::uuid[])) as gekozen(id)
  join public.subsidieregelingen sr on sr.id = gekozen.id and sr.funder_id = p_funder_id
  on conflict do nothing;

  return v_id;
end;
$$;

create or replace function public.admin_verwijder_funder_datamoment(p_datamoment_id uuid)
returns void
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  delete from public.subsidieregeling_rondes where id = p_datamoment_id;
end;
$$;
