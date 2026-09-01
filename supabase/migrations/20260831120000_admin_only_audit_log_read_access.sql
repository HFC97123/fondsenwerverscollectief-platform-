
-- classification_audit_log had een brede SELECT-grant aan authenticated (alle
-- ingelogde leden, niet alleen beheerders) — dat is dezelfde categorie
-- probleem als bij funders/subsidieregelingen, alleen dan al opgelost.
-- Vervang door dezelfde admin-only RPC-architectuur: grant intrekken,
-- lezen alleen via een SECURITY DEFINER-functie die current_user_is_admin() afdwingt.
revoke select on public.classification_audit_log from authenticated;

create or replace function public.admin_list_audit_log(
  p_tabel text default null,
  p_limit int default 50,
  p_offset int default 0
) returns table (
  id uuid, tabel text, rij_id uuid,
  gewijzigd_door uuid, gewijzigd_door_email text,
  oude_data_tier public.subsidie_data_tier, nieuwe_data_tier public.subsidie_data_tier,
  oude_source_type public.subsidie_source_type, nieuwe_source_type public.subsidie_source_type,
  reden text, gewijzigd_op timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  p_limit := least(greatest(coalesce(p_limit, 50), 1), 200);
  p_offset := greatest(coalesce(p_offset, 0), 0);

  return query
  select
    a.id, a.tabel, a.rij_id,
    a.gewijzigd_door, p.email as gewijzigd_door_email,
    a.oude_data_tier, a.nieuwe_data_tier,
    a.oude_source_type, a.nieuwe_source_type,
    a.reden, a.gewijzigd_op,
    count(*) over() as total_count
  from public.classification_audit_log a
  left join public.profiles p on p.id = a.gewijzigd_door
  where p_tabel is null or a.tabel = p_tabel
  order by a.gewijzigd_op desc
  limit p_limit offset p_offset;
end;
$$;

revoke all on function public.admin_list_audit_log(text, int, int) from public;
grant execute on function public.admin_list_audit_log(text, int, int) to authenticated;
