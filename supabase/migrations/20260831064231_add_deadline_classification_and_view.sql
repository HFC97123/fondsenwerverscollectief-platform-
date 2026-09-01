-- 1. Enums voor dataclassificatie (additief; geen wijziging aan bestaande enums)
create type public.subsidie_data_tier as enum ('public', 'premium');
create type public.subsidie_source_type as enum ('internet_scan', 'manual_admin', 'premium_database', 'api_partner', 'csv_import');

-- 2. Kolommen op subsidieregelingen (additief; bestaande kolommen blijven ongewijzigd)
alter table public.subsidieregelingen
  add column data_tier public.subsidie_data_tier not null default 'premium',
  add column source_type public.subsidie_source_type not null default 'premium_database',
  add column classification_reviewed boolean not null default false;

comment on column public.subsidieregelingen.data_tier is
  'Toegangsniveau: public = zichtbaar voor Free/Pro/Premium/Admin, premium = alleen Premium/Admin. Bepaalt WIE de regeling mag zien.';
comment on column public.subsidieregelingen.source_type is
  'Herkomst van de regeling: internet_scan, manual_admin, premium_database, api_partner of csv_import. Bepaalt WAAR de regeling vandaan komt, los van data_tier.';
comment on column public.subsidieregelingen.classification_reviewed is
  'Of een beheerder data_tier/source_type voor deze regeling handmatig heeft gecontroleerd. Default false; bestaande regelingen staan hiermee gemarkeerd als nog niet beoordeeld.';

-- 3. Helper: Pro-toegang (of hoger). Analoog aan de bestaande current_user_has_premium_access().
create or replace function public.current_user_has_pro_access()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (
        role = 'admin'
        or (subscription_tier in ('pro', 'premium') and subscription_active = true)
        or (subscription_tier in ('pro', 'premium') and trial_ends_at is not null and trial_ends_at > now())
      )
  );
$$;

comment on function public.current_user_has_pro_access() is
  'True voor Admin en voor Pro/Premium-abonnees met actief abonnement of geldige proefperiode. Ontgrendelt de volledige publieke tijdlijn (niet beperkt tot 5) in subsidieregelingen_deadlines.';

-- 4. View: subsidieregelingen_deadlines — toegangsgecontroleerde bron voor de Deadlines-pagina
create or replace view public.subsidieregelingen_deadlines as
with basis as (
  select
    sr.id,
    sr.naam,
    sr.thema,
    sr.data_tier,
    sr.source_type,
    sr.status::text as status_ruw,
    case sr.status
      when 'open' then 'Open'
      when 'binnenkort' then 'Binnenkort'
      when 'doorlopend' then 'Doorlopend'
      when 'aangekondigd' then 'Aangekondigd'
      when 'budget_uitgeput' then 'Budget uitgeput'
      when 'gesloten' then 'Gesloten'
    end as status,
    case sr.status
      when 'open' then 0
      when 'binnenkort' then 1
      when 'doorlopend' then 2
      when 'aangekondigd' then 3
      when 'budget_uitgeput' then 4
      when 'gesloten' then 5
      else 6
    end as status_rang,
    sr.deadline_datum,
    case when sr.deadline_datum is not null then (sr.deadline_datum - current_date) else null end as dagen_resterend_echt,
    sr.bedrag_min,
    sr.bedrag_max,
    sr.voorwaarden,
    f.naam as funder_naam,
    f.website as funder_website,
    f.type as funder_type,
    (sr.status <> 'gesloten' and (sr.deadline_datum is null or sr.deadline_datum >= current_date)) as is_upcoming
  from public.subsidieregelingen sr
  join public.funders f on f.id = sr.funder_id
),
genummerd as (
  select
    b.*,
    row_number() over (
      partition by (b.data_tier = 'public' and b.is_upcoming)
      order by b.status_rang, b.deadline_datum asc nulls last, b.id
    ) as volgnummer_publiek_actueel
  from basis b
),
zichtbaarheid as (
  select
    g.*,
    case
      when g.data_tier = 'public' then
        (g.is_upcoming and g.volgnummer_publiek_actueel <= 5)
        or public.current_user_has_pro_access()
      else
        public.current_user_has_premium_access()
    end as volledig_zichtbaar
  from genummerd g
)
select
  z.id,
  z.naam,
  z.thema,
  z.data_tier,
  z.source_type,
  z.status,
  z.status_ruw,
  z.volledig_zichtbaar,
  case when z.volledig_zichtbaar then z.deadline_datum else null end as deadline_datum,
  case
    when z.volledig_zichtbaar then z.dagen_resterend_echt
    when z.deadline_datum is null then null
    when z.dagen_resterend_echt < 7 then 0
    when z.dagen_resterend_echt < 31 then 7
    when z.dagen_resterend_echt < 91 then 31
    when z.dagen_resterend_echt < 181 then 91
    else 181
  end as dagen_resterend,
  case
    when z.volledig_zichtbaar then null
    when z.deadline_datum is null then 'Doorlopend of onbekend'
    when z.dagen_resterend_echt < 7 then 'Binnen 1 week'
    when z.dagen_resterend_echt < 31 then 'Binnen 1 maand'
    when z.dagen_resterend_echt < 91 then 'Binnen 3 maanden'
    when z.dagen_resterend_echt < 181 then 'Binnen 6 maanden'
    else 'Later dan 6 maanden'
  end as deadline_periode,
  case when z.volledig_zichtbaar then z.bedrag_min else null end as bedrag_min,
  case when z.volledig_zichtbaar then z.bedrag_max else null end as bedrag_max,
  case when z.volledig_zichtbaar then z.voorwaarden else null end as voorwaarden,
  case when z.volledig_zichtbaar then z.funder_naam else null end as funder_naam,
  case when z.volledig_zichtbaar then z.funder_website else null end as funder_website,
  z.funder_type
from zichtbaarheid z;

comment on view public.subsidieregelingen_deadlines is
  'Toegangsgecontroleerde tijdlijn voor de Deadlines-pagina. Redactie (bedrag/voorwaarden/exacte deadline/funder-naam en -website) gebeurt hier server-side per rij, op basis van data_tier en de aanroepende gebruiker (current_user_has_pro_access/current_user_has_premium_access). De frontend ontvangt nooit ongeredigeerde premium- of buiten-top-5-velden voor gebruikers zonder recht daarop.';

-- 5. Leesrechten op de view (zelfde patroon als funders_premium/subsidieregelingen_premium)
grant select on public.subsidieregelingen_deadlines to anon, authenticated;
