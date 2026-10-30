-- Beheer: per fonds aangeven of contactpersoon, e-mail en telefoon verborgen zijn voor leden (opdracht Aisya, 30-10-2026).
-- Alleen beheerders. Leden zien een verborgen veld als leeg (zie de ledenweergave van funders).
-- Terugdraaien: drop function public.admin_zet_funder_prive(uuid, boolean, boolean, boolean);
create or replace function public.admin_zet_funder_prive(
  p_funder_id uuid, p_contactpersoon_prive boolean, p_email_prive boolean, p_telefoon_prive boolean
) returns void language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders kunnen dit wijzigen' using errcode = '42501';
  end if;

  update public.funders
  set contactpersoon_prive = coalesce(p_contactpersoon_prive, contactpersoon_prive),
      email_prive = coalesce(p_email_prive, email_prive),
      telefoon_prive = coalesce(p_telefoon_prive, telefoon_prive),
      updated_at = now()
  where id = p_funder_id;

  if not found then
    raise exception 'Fonds niet gevonden' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_zet_funder_prive(uuid, boolean, boolean, boolean) from public, anon;
grant execute on function public.admin_zet_funder_prive(uuid, boolean, boolean, boolean) to authenticated;

-- Beheer: de overige kolommen van fondsen en regelingen (systeemvelden) lezen en zetten, zodat elke kolom te bewerken is.
-- Fonds: enrichment_status, last_researched_at, adres (oud vrij veld), data_tier, source_type.
-- Regeling: discovered_by, verified, status_laatst_gecheckt, data_tier, source_type.
-- Terugdraaien: drop function public.admin_get_overige_velden(text, uuid); drop function public.admin_zet_overige_velden(text, uuid, jsonb);
create or replace function public.admin_get_overige_velden(p_tabel text, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare r jsonb;
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders' using errcode = '42501';
  end if;

  if p_tabel = 'funders' then
    select jsonb_build_object('enrichment_status', enrichment_status::text, 'last_researched_at', last_researched_at,
      'adres', adres, 'data_tier', data_tier::text, 'source_type', source_type::text)
    into r from public.funders where id = p_id;
  elsif p_tabel = 'subsidieregelingen' then
    select jsonb_build_object('discovered_by', discovered_by::text, 'verified', verified, 'status_laatst_gecheckt', status_laatst_gecheckt,
      'data_tier', data_tier::text, 'source_type', source_type::text)
    into r from public.subsidieregelingen where id = p_id;
  else
    raise exception 'Onbekende tabel' using errcode = '22023';
  end if;

  return r;
end;
$$;

create or replace function public.admin_zet_overige_velden(p_tabel text, p_id uuid, p_velden jsonb)
returns void language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders kunnen dit wijzigen' using errcode = '42501';
  end if;

  if p_tabel = 'funders' then
    update public.funders set
      enrichment_status = case when p_velden ? 'enrichment_status' then (p_velden->>'enrichment_status')::enrichment_status_type else enrichment_status end,
      last_researched_at = case when p_velden ? 'last_researched_at' then (p_velden->>'last_researched_at')::timestamptz else last_researched_at end,
      adres = case when p_velden ? 'adres' then nullif(p_velden->>'adres', '') else adres end,
      data_tier = case when p_velden ? 'data_tier' then (p_velden->>'data_tier')::subsidie_data_tier else data_tier end,
      source_type = case when p_velden ? 'source_type' then (p_velden->>'source_type')::subsidie_source_type else source_type end,
      updated_at = now()
    where id = p_id;
  elsif p_tabel = 'subsidieregelingen' then
    update public.subsidieregelingen set
      discovered_by = case when p_velden ? 'discovered_by' then (p_velden->>'discovered_by')::discovered_by_type else discovered_by end,
      verified = case when p_velden ? 'verified' then coalesce((p_velden->>'verified')::boolean, false) else verified end,
      status_laatst_gecheckt = case when p_velden ? 'status_laatst_gecheckt' then (p_velden->>'status_laatst_gecheckt')::timestamptz else status_laatst_gecheckt end,
      data_tier = case when p_velden ? 'data_tier' then (p_velden->>'data_tier')::subsidie_data_tier else data_tier end,
      source_type = case when p_velden ? 'source_type' then (p_velden->>'source_type')::subsidie_source_type else source_type end,
      updated_at = now()
    where id = p_id;
  else
    raise exception 'Onbekende tabel' using errcode = '22023';
  end if;

  if not found then
    raise exception 'Rij niet gevonden' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_get_overige_velden(text, uuid) from public, anon;
revoke all on function public.admin_zet_overige_velden(text, uuid, jsonb) from public, anon;
grant execute on function public.admin_get_overige_velden(text, uuid) to authenticated;
grant execute on function public.admin_zet_overige_velden(text, uuid, jsonb) to authenticated;
