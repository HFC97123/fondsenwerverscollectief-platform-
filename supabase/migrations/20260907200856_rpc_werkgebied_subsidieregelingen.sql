-- p_werkgebied heeft een default zodat bestaande aanroepen (zonder dit argument) blijven werken
-- totdat de frontend is bijgewerkt om het mee te sturen.
CREATE OR REPLACE FUNCTION public.admin_update_subsidieregeling(
  p_regeling_id uuid,
  p_naam text,
  p_thema text,
  p_bedrag_min numeric,
  p_bedrag_max numeric,
  p_deadline text,
  p_deadline_datum date,
  p_deadline_omschrijving text,
  p_voorwaarden text,
  p_status regeling_status_type,
  p_funder_id uuid,
  p_werkgebied text DEFAULT NULL
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  if p_regeling_id is null then
    raise exception 'p_regeling_id is verplicht.';
  end if;

  update public.subsidieregelingen
  set naam = p_naam,
      thema = p_thema,
      bedrag_min = p_bedrag_min,
      bedrag_max = p_bedrag_max,
      deadline = p_deadline,
      deadline_datum = p_deadline_datum,
      deadline_omschrijving = p_deadline_omschrijving,
      voorwaarden = p_voorwaarden,
      status = p_status,
      funder_id = p_funder_id,
      werkgebied = coalesce(p_werkgebied, werkgebied),
      updated_at = now()
  where id = p_regeling_id;

  if not found then
    raise exception 'Subsidieregeling % niet gevonden.', p_regeling_id;
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_bulk_create_subsidieregelingen(p_rows jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_row jsonb;
  v_count int := 0;
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows moet een JSON-array zijn.';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    if v_row ->> 'funder_id' is null or v_row ->> 'naam' is null then
      continue;
    end if;

    insert into public.subsidieregelingen (
      funder_id, naam, thema, werkgebied, bedrag_min, bedrag_max,
      deadline, deadline_datum, deadline_omschrijving, voorwaarden, status,
      data_tier, source_type, classification_reviewed
    ) values (
      (v_row ->> 'funder_id')::uuid,
      v_row ->> 'naam',
      v_row ->> 'thema',
      coalesce(v_row ->> 'werkgebied', 'Landelijk'),
      nullif(v_row ->> 'bedrag_min', '')::numeric,
      nullif(v_row ->> 'bedrag_max', '')::numeric,
      v_row ->> 'deadline',
      nullif(v_row ->> 'deadline_datum', '')::date,
      v_row ->> 'deadline_omschrijving',
      v_row ->> 'voorwaarden',
      coalesce((v_row ->> 'status')::public.regeling_status_type, 'open'),
      coalesce((v_row ->> 'data_tier')::public.subsidie_data_tier, 'premium'),
      coalesce((v_row ->> 'source_type')::public.subsidie_source_type, 'manual_admin'),
      false
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$function$;
