-- Beheer van de werklijst "nieuw gescand door gebruik" (kompas_online_gescand): lezen, tellen en de status bijwerken.
-- Alleen beheerders (current_user_is_admin), via SECURITY DEFINER; de tabel zelf blijft dicht voor anon/authenticated.

create or replace function public.admin_online_gescand_lijst(p_status text default 'nieuw', p_zoek text default null, p_limiet integer default 100)
returns table (
  id uuid, gever text, regeling text, website text, url text, status_online text, deadline date, bedrag_min numeric, bedrag_max numeric,
  samenvatting text, themas text[], doelgroepen text[], werkgebieden text[], koppeling text, bron text, aantal_keer integer,
  eerst_gezien timestamptz, laatst_gezien timestamptz, review_status text, gekoppelde_funder_id uuid, gekoppelde_regeling_id uuid,
  review_notitie text, beoordeeld_op timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  return query
  select g.id, g.gever, g.regeling, g.website, g.url, g.status_online, g.deadline, g.bedrag_min, g.bedrag_max, g.samenvatting, g.themas,
         g.doelgroepen, g.werkgebieden, g.koppeling, g.bron, g.aantal_keer, g.eerst_gezien, g.laatst_gezien, g.review_status,
         g.gekoppelde_funder_id, g.gekoppelde_regeling_id, g.review_notitie, g.beoordeeld_op
  from public.kompas_online_gescand g
  where (p_status is null or p_status = '' or g.review_status = p_status)
    and (p_zoek is null or p_zoek = '' or g.gever ilike '%' || p_zoek || '%' or coalesce(g.regeling, '') ilike '%' || p_zoek || '%')
  order by g.aantal_keer desc, g.laatst_gezien desc
  limit greatest(1, least(coalesce(p_limiet, 100), 500));
end;
$$;

create or replace function public.admin_online_gescand_telling()
returns table (review_status text, aantal bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  return query select g.review_status, count(*) from public.kompas_online_gescand g group by g.review_status;
end;
$$;

create or replace function public.admin_online_gescand_bijwerken(
  p_id uuid,
  p_status text,
  p_notitie text default null,
  p_funder_id uuid default null,
  p_regeling_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders mogen deze actie uitvoeren.' using errcode = '42501';
  end if;

  if p_status not in ('nieuw', 'in_behandeling', 'opgenomen', 'afgewezen', 'dubbel') then
    raise exception 'Ongeldige status.' using errcode = '22023';
  end if;

  update public.kompas_online_gescand
  set review_status = p_status,
      review_notitie = coalesce(p_notitie, review_notitie),
      gekoppelde_funder_id = coalesce(p_funder_id, gekoppelde_funder_id),
      gekoppelde_regeling_id = coalesce(p_regeling_id, gekoppelde_regeling_id),
      beoordeeld_op = case when p_status = 'nieuw' then null else now() end
  where id = p_id;
end;
$$;

revoke all on function public.admin_online_gescand_lijst(text, text, integer) from public, anon;
revoke all on function public.admin_online_gescand_telling() from public, anon;
revoke all on function public.admin_online_gescand_bijwerken(uuid, text, text, uuid, uuid) from public, anon;
grant execute on function public.admin_online_gescand_lijst(text, text, integer) to authenticated;
grant execute on function public.admin_online_gescand_telling() to authenticated;
grant execute on function public.admin_online_gescand_bijwerken(uuid, text, text, uuid, uuid) to authenticated;
