-- PROJECTFINANCIERING (Werkruimte Fase 2) - voorstel, NIET toegepast op de live database.
-- Verplaats dit bestand naar supabase/migrations/ zodra de toepassing is goedgekeurd.
-- Rollback: supabase/voorstel-niet-uitgevoerd/20261011130000_project_funding_rollback.sql
--
-- Eén nieuwe tabel: subsidie_kompas_program_funding = de ENIGE bron voor financieringsregels,
-- aanvraagstatussen, aangevraagde/toegekende bedragen, eigen deadlines, herinneringen en notities
-- van een project. Projectgegevens blijven in subsidie_kompas_programs; er worden GEEN namen,
-- budgetten of deadlines gekopieerd (single source of truth).
--
-- Ontwerp in het kort
--  * Een regel verwijst naar óf een regeling (scheme_id) óf een fonds (funder_id), nooit naar beide.
--    CHECK: niet beide gevuld. "Precies één" bij het aanmaken wordt afgedwongen door een
--    BEFORE INSERT-trigger. De CHECK staat bewust ook "beide leeg" toe: verdwijnt de bron
--    (ON DELETE SET NULL), dan blijft de regel geldig met bedragen, status, eigen deadline,
--    herinnering en notitie; de UI toont dan "Bron niet meer beschikbaar".
--  * Projectisolatie: composite FK (program_id, user_id) -> subsidie_kompas_programs (id, user_id),
--    plus RLS die projecteigenaarschap afdwingt (niet alleen een meegestuurde user_id).
--  * Onveranderlijk na insert: user_id, program_id, scheme_id en funder_id (trigger + column-level
--    UPDATE-grants). Enige toegestane wijziging: scheme_id/funder_id van gevuld naar NULL, en
--    alleen via de FK-actie ON DELETE SET NULL (clients hebben geen UPDATE-recht op die kolommen).
--  * Eén regeling en één fonds per project (partiële unique indexes). Geen ronde_id in V1.
--  * kompas_dekkingsplan(p_program_id): SECURITY DEFINER, controleert auth.uid() en projecteigenaar,
--    bepaalt de tier uit de bestaande functies (current_user_has_premium/pro_access), masker bronnen
--    met de bestaande subsidie_zichtbaar_voor_tier en hergebruikt de bestaande deadlinefuncties
--    (subsidieregeling_volgende_ronde, funder_volgende_datamoment). Geen tweede deadline-engine.
begin;

-- 1. Composite sleutel op programs, nodig voor de composite FK. id is al de PK, dus dit voegt
--    geen nieuwe beperking toe; het maakt (id, user_id) alleen referentieel bruikbaar.
alter table public.subsidie_kompas_programs
  add constraint subsidie_kompas_programs_id_user_id_key unique (id, user_id);

-- 2. De tabel
create table public.subsidie_kompas_program_funding (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  program_id uuid not null,
  scheme_id uuid null references public.subsidieregelingen (id) on delete set null,
  funder_id uuid null references public.funders (id) on delete set null,
  requested_amount numeric null,
  awarded_amount numeric null,
  status text not null default 'interesting',
  eigen_deadline date null,
  reminder_enabled boolean not null default true,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subsidie_kompas_program_funding_program_fkey
    foreign key (program_id, user_id)
    references public.subsidie_kompas_programs (id, user_id) on delete cascade,
  constraint subsidie_kompas_program_funding_status_chk
    check (status in ('interesting', 'preparing', 'submitted', 'awarded', 'rejected')),
  constraint subsidie_kompas_program_funding_niet_beide_bronnen_chk
    check (scheme_id is null or funder_id is null),
  constraint subsidie_kompas_program_funding_requested_chk
    check (requested_amount is null or (requested_amount >= 0 and requested_amount < 1000000000000)),
  constraint subsidie_kompas_program_funding_awarded_chk
    check (awarded_amount is null or (awarded_amount >= 0 and awarded_amount < 1000000000000)),
  constraint subsidie_kompas_program_funding_notes_chk
    check (notes is null or char_length(notes) <= 4000)
);

comment on table public.subsidie_kompas_program_funding is
  'Projectfinanciering (Werkruimte Fase 2): enige bron voor financieringsregels, status, bedragen, eigen deadline, herinnering en notitie per project. Verwijst naar een regeling OF een fonds (nooit beide); na verwijdering van de bron blijft de regel bestaan met beide NULL. Geen kopie van namen, budgetten of deadlines.';

-- 3. Uniciteit en indexen
create unique index subsidie_kompas_program_funding_unique_scheme
  on public.subsidie_kompas_program_funding (program_id, scheme_id) where scheme_id is not null;
create unique index subsidie_kompas_program_funding_unique_funder
  on public.subsidie_kompas_program_funding (program_id, funder_id) where funder_id is not null;
create index subsidie_kompas_program_funding_user_idx
  on public.subsidie_kompas_program_funding (user_id);
create index subsidie_kompas_program_funding_program_idx
  on public.subsidie_kompas_program_funding (program_id);
create index subsidie_kompas_program_funding_scheme_idx
  on public.subsidie_kompas_program_funding (scheme_id) where scheme_id is not null;
create index subsidie_kompas_program_funding_funder_idx
  on public.subsidie_kompas_program_funding (funder_id) where funder_id is not null;

-- 4. Triggers
create or replace function public.subsidie_kompas_program_funding_voor_insert()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- Bij het aanmaken precies één bron. (De CHECK staat "beide leeg" toe voor regels waarvan de
  -- bron later verdween; een NIEUWE regel zonder bron is nooit zinvol.)
  if (new.scheme_id is null) = (new.funder_id is null) then
    raise exception 'Een financieringsregel verwijst naar precies een regeling of een fonds'
      using errcode = '23514';
  end if;

  new.created_at := now();
  new.updated_at := now();

  return new;
end;
$$;

create trigger subsidie_kompas_program_funding_voor_insert
  before insert on public.subsidie_kompas_program_funding
  for each row execute function public.subsidie_kompas_program_funding_voor_insert();

create or replace function public.subsidie_kompas_program_funding_voor_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.program_id is distinct from old.program_id then
    raise exception 'user_id en program_id van een financieringsregel zijn onveranderlijk'
      using errcode = '23514';
  end if;

  -- scheme_id/funder_id: alleen gevuld -> NULL (bron verwijderd, ON DELETE SET NULL). Nooit een
  -- andere bron, en een bron die weg is komt niet terug.
  if new.scheme_id is distinct from old.scheme_id
     and not (old.scheme_id is not null and new.scheme_id is null) then
    raise exception 'scheme_id van een financieringsregel is onveranderlijk' using errcode = '23514';
  end if;

  if new.funder_id is distinct from old.funder_id
     and not (old.funder_id is not null and new.funder_id is null) then
    raise exception 'funder_id van een financieringsregel is onveranderlijk' using errcode = '23514';
  end if;

  new.created_at := old.created_at;
  new.updated_at := clock_timestamp();

  return new;
end;
$$;

create trigger subsidie_kompas_program_funding_voor_update
  before update on public.subsidie_kompas_program_funding
  for each row execute function public.subsidie_kompas_program_funding_voor_update();

-- 5. RLS: alleen eigen regels, en schrijven alleen op een eigen project.
alter table public.subsidie_kompas_program_funding enable row level security;

create policy "Users read own funding" on public.subsidie_kompas_program_funding
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users create own funding" on public.subsidie_kompas_program_funding
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.subsidie_kompas_programs p
      where p.id = program_id and p.user_id = (select auth.uid())
    )
  );

create policy "Users update own funding" on public.subsidie_kompas_program_funding
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.subsidie_kompas_programs p
      where p.id = program_id and p.user_id = (select auth.uid())
    )
  );

create policy "Users delete own funding" on public.subsidie_kompas_program_funding
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 6. Rechten: geen anon; authenticated mag alleen de velden wijzigen die van het lid zijn.
revoke all on table public.subsidie_kompas_program_funding from public, anon, authenticated;
grant select, delete on table public.subsidie_kompas_program_funding to authenticated;
grant insert (user_id, program_id, scheme_id, funder_id, requested_amount, awarded_amount, status, eigen_deadline, reminder_enabled, notes)
  on table public.subsidie_kompas_program_funding to authenticated;
grant update (requested_amount, awarded_amount, status, eigen_deadline, reminder_enabled, notes)
  on table public.subsidie_kompas_program_funding to authenticated;
grant all on table public.subsidie_kompas_program_funding to service_role;

-- 7. RPC: het dekkingsplan van één eigen project, met bronnen gemaskeerd naar het abonnement.
--    SECURITY DEFINER omzeilt RLS bewust NIET: de functie controleert zelf auth.uid() en het
--    projecteigenaarschap, leest uitsluitend de regels van dat project en geeft alleen
--    veilige velden terug. "Niet bestaand" en "van een ander" geven dezelfde fout.
--
--    bron_status: 'zichtbaar'  = het lid mag de bron zien (naam, website, deadline worden getoond)
--                 'verborgen'  = bron bestaat maar valt buiten het abonnement (alleen eigen velden)
--                 'verwijderd' = bron bestaat niet meer (scheme_id en funder_id zijn NULL)
--    Zichtbaarheid = bestaande subsidie_zichtbaar_voor_tier op de bron zelf, ZONDER de
--    "eerste drie"-teasers van de Deadlines-views (die horen bij het ontdekken, niet bij een
--    regel die het lid al in zijn dekkingsplan heeft). Zodra funders.premium_exclusive bestaat
--    (voorstel 20261009100000), is een exclusief fonds voor niet-Premium altijd verborgen; tot
--    die tijd leest de functie die kolom via to_jsonb() zonder er hard van af te hangen.
--    De deadline van het systeem is dezelfde als in subsidieregelingen_deadlines en
--    funder_deadlines (eerstvolgende ronde of regelingdeadline; volgend datamoment van het fonds).
create or replace function public.kompas_dekkingsplan(p_program_id uuid)
returns table (
  id uuid,
  program_id uuid,
  bron_type text,
  bron_status text,
  scheme_id uuid,
  funder_id uuid,
  bron_naam text,
  funder_naam text,
  website text,
  systeem_deadline date,
  systeem_deadline_bron text,
  requested_amount numeric,
  awarded_amount numeric,
  status text,
  eigen_deadline date,
  effectieve_deadline date,
  reminder_enabled boolean,
  notes text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_tier text;
begin
  if v_uid is null then
    raise exception 'Niet ingelogd' using errcode = '28000';
  end if;

  if p_program_id is null or not exists (
    select 1 from public.subsidie_kompas_programs p
    where p.id = p_program_id and p.user_id = v_uid
  ) then
    raise exception 'Project niet gevonden' using errcode = '42501';
  end if;

  v_tier := case
    when public.current_user_has_premium_access() then 'premium'
    when public.current_user_has_pro_access() then 'pro'
    else 'free'
  end;

  return query
  with basis as (
    select
      pf.*,
      sr.id as sr_id, sr.naam as sr_naam, sr.website as sr_website, sr.deadline_datum as sr_deadline,
      fs.naam as fs_naam, fs.website as fs_website,
      f.id as f_id, f.naam as f_naam, f.website as f_website,
      -- bron zichtbaar voor deze tier?
      case
        when sr.id is not null then
          sr.classification_reviewed
          and public.subsidie_zichtbaar_voor_tier(sr.classification_reviewed, sr.access_tier, sr.data_tier, sr.source_type, v_tier)
          and (v_tier = 'premium' or not coalesce((to_jsonb(fs) ->> 'premium_exclusive')::boolean, false))
        when f.id is not null then
          f.classification_reviewed
          and public.subsidie_zichtbaar_voor_tier(f.classification_reviewed, f.access_tier, f.data_tier, f.source_type, v_tier)
          and (v_tier = 'premium' or not coalesce((to_jsonb(f) ->> 'premium_exclusive')::boolean, false))
        else false
      end as zichtbaar
    from public.subsidie_kompas_program_funding pf
    left join public.subsidieregelingen sr on sr.id = pf.scheme_id
    left join public.funders fs on fs.id = sr.funder_id
    left join public.funders f on f.id = pf.funder_id
    where pf.program_id = p_program_id
      and pf.user_id = v_uid
  ),
  met_deadline as (
    select
      b.*,
      case when b.zichtbaar and b.sr_id is not null then
        case when exists (select 1 from public.subsidieregeling_rondes rr where rr.subsidieregeling_id = b.sr_id)
             then (select vr.sluitingsdatum from public.subsidieregeling_volgende_ronde(b.sr_id, now()) vr limit 1)
             else b.sr_deadline end
      when b.zichtbaar and b.f_id is not null then
        (select vd.sluitingsdatum from public.funder_volgende_datamoment(b.f_id, null, now()) vd limit 1)
      else null end as sys_deadline,
      case when b.zichtbaar and b.sr_id is not null then
        case when exists (select 1 from public.subsidieregeling_rondes rr where rr.subsidieregeling_id = b.sr_id)
             then 'ronde' else 'regeling' end
      when b.zichtbaar and b.f_id is not null then 'fonds'
      else null end as sys_bron
    from basis b
  )
  select
    m.id,
    m.program_id,
    case when m.scheme_id is not null then 'regeling'
         when m.funder_id is not null then 'fonds'
         else null end,
    case when m.scheme_id is null and m.funder_id is null then 'verwijderd'
         when m.zichtbaar then 'zichtbaar'
         else 'verborgen' end,
    case when m.zichtbaar then m.scheme_id else null end,
    case when m.zichtbaar then m.funder_id else null end,
    case when not m.zichtbaar then null
         when m.sr_id is not null then m.sr_naam
         else m.f_naam end,
    case when not m.zichtbaar then null
         when m.sr_id is not null then m.fs_naam
         else m.f_naam end,
    case when not m.zichtbaar then null
         when m.sr_id is not null then coalesce(m.sr_website, m.fs_website)
         else m.f_website end,
    m.sys_deadline,
    m.sys_bron,
    m.requested_amount,
    m.awarded_amount,
    m.status,
    m.eigen_deadline,
    coalesce(m.eigen_deadline, m.sys_deadline),
    m.reminder_enabled,
    m.notes,
    m.created_at,
    m.updated_at
  from met_deadline m
  order by coalesce(m.eigen_deadline, m.sys_deadline) nulls last, m.created_at, m.id;
end;
$$;

comment on function public.kompas_dekkingsplan(uuid) is
  'Werkruimte Fase 2: dekkingsplan (financieringsregels) van een eigen project, bronnen gemaskeerd naar het abonnement. Alleen voor ingelogde gebruikers; project moet van auth.uid() zijn.';

revoke all on function public.kompas_dekkingsplan(uuid) from public, anon;
grant execute on function public.kompas_dekkingsplan(uuid) to authenticated, service_role;

commit;
