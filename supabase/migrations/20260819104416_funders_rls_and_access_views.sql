-- Lock down direct table access; client access only via the views below
alter table public.funders enable row level security;
alter table public.subsidieregelingen enable row level security;
alter table public.funder_notes enable row level security;
alter table public.prospects enable row level security;
alter table public.themas enable row level security;
alter table public.regios enable row level security;
alter table public.funder_themas enable row level security;
alter table public.funder_regios enable row level security;

-- Themas/regios are just filter vocab, safe to expose to any logged-in member
create policy "themas_read_authenticated" on public.themas for select to authenticated using (true);
create policy "regios_read_authenticated" on public.regios for select to authenticated using (true);
create policy "funder_themas_read_authenticated" on public.funder_themas for select to authenticated using (true);
create policy "funder_regios_read_authenticated" on public.funder_regios for select to authenticated using (true);

-- Helper: does the logged-in user have premium (or active trial) access to the funders database?
create or replace function public.current_user_has_premium_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (
        role = 'admin'
        or (subscription_tier = 'premium' and subscription_active = true)
        or (trial_ends_at is not null and trial_ends_at > now())
      )
  );
$$;

-- Helper: is the logged-in user an admin (Aisya) — sees private contact fields
create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.current_user_has_premium_access() to authenticated;
grant execute on function public.current_user_is_admin() to authenticated;

-- Teaser view: visible to every logged-in member (free/pro), no financial/contact detail
create view public.funders_teaser
with (security_invoker = true) as
select
  f.id,
  f.naam,
  f.type,
  f.missie,
  f.status,
  coalesce(array_agg(distinct t.naam) filter (where t.naam is not null), '{}') as themas,
  coalesce(array_agg(distinct r.naam) filter (where r.naam is not null), '{}') as regios
from public.funders f
left join public.funder_themas ft on ft.funder_id = f.id
left join public.themas t on t.id = ft.thema_id
left join public.funder_regios fr on fr.funder_id = f.id
left join public.regios r on r.id = fr.regio_id
group by f.id;

alter view public.funders_teaser owner to postgres;
grant select on public.funders_teaser to authenticated;

-- Full view: only for premium (or active trial) members; private contact fields masked unless admin
create view public.funders_premium
with (security_invoker = false) as
select
  f.id,
  f.naam,
  f.type,
  f.missie,
  f.bijdrage_min,
  f.bijdrage_max,
  f.jaarbudget,
  f.deadlines,
  case when f.contactpersoon_prive and not public.current_user_is_admin() then null else f.contactpersoon end as contactpersoon,
  case when f.email_prive and not public.current_user_is_admin() then null else f.email end as email,
  case when f.telefoon_prive and not public.current_user_is_admin() then null else f.telefoon end as telefoon,
  f.adres,
  f.website,
  f.status,
  f.enrichment_status,
  f.last_researched_at,
  coalesce(array_agg(distinct t.naam) filter (where t.naam is not null), '{}') as themas,
  coalesce(array_agg(distinct r.naam) filter (where r.naam is not null), '{}') as regios
from public.funders f
left join public.funder_themas ft on ft.funder_id = f.id
left join public.themas t on t.id = ft.thema_id
left join public.funder_regios fr on fr.funder_id = f.id
left join public.regios r on r.id = fr.regio_id
where public.current_user_has_premium_access()
group by f.id;

grant select on public.funders_premium to authenticated;

create view public.subsidieregelingen_premium
with (security_invoker = false) as
select sr.*
from public.subsidieregelingen sr
where public.current_user_has_premium_access();

grant select on public.subsidieregelingen_premium to authenticated;
