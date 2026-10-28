-- Klein of groot fonds voor de checklist "Stukken voor fondsenwerving" (opdracht Aisya, 28-10-2026).
-- Automatisch: overheid en EU groot; Pro-bron groot; Premium-bron klein. Per fonds te overschrijven in Beheer (groot/klein).
-- Terugdraaien: drop function public.kompas_bron_omvang(uuid[], uuid[]); drop function public.admin_fonds_omvang(uuid);
--               drop function public.admin_zet_fonds_omvang(uuid, text); alter table public.funders drop column omvang;
alter table public.funders add column if not exists omvang text not null default 'auto' check (omvang in ('auto', 'groot', 'klein'));

comment on column public.funders.omvang is 'Checklist stukken: auto (overheid/EU of Pro = groot, Premium = klein) of handmatig groot/klein via Beheer.';

-- Beheer: huidige keuze lezen en zetten.
create or replace function public.admin_fonds_omvang(p_funder_id uuid)
returns text language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders' using errcode = '42501';
  end if;

  return (select omvang from public.funders where id = p_funder_id);
end;
$$;

create or replace function public.admin_zet_fonds_omvang(p_funder_id uuid, p_omvang text)
returns void language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders kunnen dit wijzigen' using errcode = '42501';
  end if;

  if p_omvang not in ('auto', 'groot', 'klein') then
    raise exception 'Ongeldige keuze' using errcode = '22023';
  end if;

  update public.funders set omvang = p_omvang where id = p_funder_id;
end;
$$;

-- Leden: per bron in hun dekkingsplan 'groot' of 'klein' (alleen dit label, verder niets).
create or replace function public.kompas_bron_omvang(p_scheme_ids uuid[], p_funder_ids uuid[])
returns table (bron_type text, bron_id uuid, omvang text)
language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  with bron as (
    select 'regeling'::text as bron_type, s.id as bron_id, f.omvang as keuze, f.type::text as soort, s.access_tier::text as tier
    from public.subsidieregelingen s join public.funders f on f.id = s.funder_id
    where s.id = any (coalesce(p_scheme_ids, '{}')) and s.classification_reviewed
    union all
    select 'fonds', f.id, f.omvang, f.type::text, f.access_tier::text
    from public.funders f
    where f.id = any (coalesce(p_funder_ids, '{}')) and f.classification_reviewed
  )
  select b.bron_type, b.bron_id,
    case
      when b.keuze in ('groot', 'klein') then b.keuze
      when b.soort in ('gemeente_lokale_overheid', 'rijksoverheid', 'europese_fondsen') then 'groot'
      when b.tier = 'premium' then 'klein'
      when b.tier in ('pro', 'free') then 'groot'
      else 'onbekend'
    end
  from bron b
  where auth.uid() is not null
  limit 200;
$$;

revoke all on function public.admin_fonds_omvang(uuid) from public, anon;
revoke all on function public.admin_zet_fonds_omvang(uuid, text) from public, anon;
revoke all on function public.kompas_bron_omvang(uuid[], uuid[]) from public, anon;
grant execute on function public.admin_fonds_omvang(uuid) to authenticated;
grant execute on function public.admin_zet_fonds_omvang(uuid, text) to authenticated;
grant execute on function public.kompas_bron_omvang(uuid[], uuid[]) to authenticated;

-- Opdracht Aisya: deze twee werken regionaal en vragen weinig.
update public.funders set omvang = 'klein' where naam in ('Rabobank Coöperatiefonds en Stimuleringsfonds', 'ANWB Fonds');
