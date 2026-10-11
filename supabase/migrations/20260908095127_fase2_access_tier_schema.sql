-- Fase 2: expliciet, per-record Free/Pro/Premium-toegangsniveau voor funders
-- én subsidieregelingen — los van de bestaande data_tier (die zijn eigen,
-- herkomstgebaseerde betekenis behoudt: public/premium + de Pro-afleiding
-- via source_type in subsidieregelingen_deadlines). access_tier is een
-- nieuwe, onafhankelijke as die een beheerder per funder ÉN per
-- subsidieregeling apart zet (opdrachtpunt 6): een gever kan Pro zijn
-- terwijl een specifieke regeling Premium is.
--
-- Fail-closed default: bestaande 4487 funders en 124 subsidieregelingen
-- krijgen 'premium' (net als data_tier nu al doet), zodat er geen enkele
-- rij per ongeluk breder zichtbaar wordt dan vandaag. classification_reviewed
-- (bestaande kolom, hergebruikt) blijft het signaal dat een beheerder dit nog
-- moet nalopen. Deze migratie wijzigt bewust NIETS aan de bestaande publieke
-- zichtbaarheidslogica (subsidieregelingen_deadlines/funders_premium/
-- subsidieregelingen_premium blijven op data_tier/source_type draaien) —
-- het overzetten daarvan naar access_tier is een aparte, latere, expliciet
-- goed te keuren stap zodra de eerste beheerdersreview is afgerond.

create type public.subsidie_access_tier as enum ('free', 'pro', 'premium');

alter table public.funders
  add column access_tier public.subsidie_access_tier not null default 'premium';

comment on column public.funders.access_tier is
  'Expliciet, door een beheerder gezet Free/Pro/Premium-toegangsniveau voor dit fonds. Losstaand van data_tier (herkomstgebaseerd) en van de gebruikers-tier (profiles.subscription_tier). Nooit automatisch afgeleid.';

alter table public.subsidieregelingen
  add column access_tier public.subsidie_access_tier not null default 'premium';

comment on column public.subsidieregelingen.access_tier is
  'Expliciet, door een beheerder gezet Free/Pro/Premium-toegangsniveau voor deze regeling. Losstaand van de access_tier van de gekoppelde funder (funder Pro + regeling Premium mag) en van data_tier. Nooit automatisch afgeleid.';

comment on column public.funders.classification_reviewed is
  'Of een beheerder de classificatie van dit fonds (data_tier/source_type én access_tier) handmatig heeft gecontroleerd.';

comment on column public.subsidieregelingen.classification_reviewed is
  'Of een beheerder de classificatie van deze regeling (data_tier/source_type én access_tier) handmatig heeft gecontroleerd.';

alter table public.classification_audit_log
  add column oude_access_tier public.subsidie_access_tier,
  add column nieuwe_access_tier public.subsidie_access_tier;

-- Eén funder/regeling het toegangsniveau geven, met auditregel.
create or replace function public.admin_set_access_tier(
  p_tabel text,
  p_id uuid,
  p_access_tier public.subsidie_access_tier,
  p_reden text default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_oude public.subsidie_access_tier;
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders kunnen het toegangsniveau wijzigen' using errcode = '42501';
  end if;

  if p_tabel = 'funders' then
    select access_tier into v_oude from public.funders where id = p_id;
    update public.funders set access_tier = p_access_tier where id = p_id;
  elsif p_tabel = 'subsidieregelingen' then
    select access_tier into v_oude from public.subsidieregelingen where id = p_id;
    update public.subsidieregelingen set access_tier = p_access_tier where id = p_id;
  else
    raise exception 'Onbekende tabel: %', p_tabel using errcode = '22023';
  end if;

  insert into public.classification_audit_log (tabel, rij_id, gewijzigd_door, oude_access_tier, nieuwe_access_tier, reden)
  values (p_tabel, p_id, auth.uid(), v_oude, p_access_tier, p_reden);
end;
$$;

-- Bulk-variant: zelfde toegangsniveau in één keer voor meerdere rijen,
-- elk met een eigen auditregel (zodat de oude waarde per rij bewaard blijft).
create or replace function public.admin_bulk_set_access_tier(
  p_tabel text,
  p_ids uuid[],
  p_access_tier public.subsidie_access_tier,
  p_reden text default null
)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_id uuid;
  v_oude public.subsidie_access_tier;
  v_aantal integer := 0;
begin
  if not public.current_user_is_admin() then
    raise exception 'Alleen beheerders kunnen het toegangsniveau wijzigen' using errcode = '42501';
  end if;

  if p_tabel not in ('funders', 'subsidieregelingen') then
    raise exception 'Onbekende tabel: %', p_tabel using errcode = '22023';
  end if;

  foreach v_id in array coalesce(p_ids, '{}') loop
    if p_tabel = 'funders' then
      select access_tier into v_oude from public.funders where id = v_id;
      update public.funders set access_tier = p_access_tier where id = v_id;
    else
      select access_tier into v_oude from public.subsidieregelingen where id = v_id;
      update public.subsidieregelingen set access_tier = p_access_tier where id = v_id;
    end if;

    if found then
      insert into public.classification_audit_log (tabel, rij_id, gewijzigd_door, oude_access_tier, nieuwe_access_tier, reden)
      values (p_tabel, v_id, auth.uid(), v_oude, p_access_tier, p_reden);
      v_aantal := v_aantal + 1;
    end if;
  end loop;

  return v_aantal;
end;
$$;

revoke all on function public.admin_set_access_tier(text, uuid, public.subsidie_access_tier, text) from public, anon;
revoke all on function public.admin_bulk_set_access_tier(text, uuid[], public.subsidie_access_tier, text) from public, anon;

grant execute on function public.admin_set_access_tier(text, uuid, public.subsidie_access_tier, text) to authenticated;
grant execute on function public.admin_bulk_set_access_tier(text, uuid[], public.subsidie_access_tier, text) to authenticated;
