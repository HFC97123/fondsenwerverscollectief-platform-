-- Voorstel Dekkingsplan en actieplan (Fase 1): metadata van door Subsidie Kompas voorgestelde regels en taken.
-- VOORSTEL, NIET UITGEVOERD. Live toepassen vereist een afzonderlijk expliciet akkoord.
-- Rollback: 20261014120000_voorstel_metadata_rollback.sql  (SQL-test: supabase/tests/voorstel-metadata/)
--
-- Wat er al is en hergebruikt wordt (niets hiervan wordt vervangen):
--   * subsidie_kompas_program_funding  = enige bron voor geld; kompas_dekkingsplan() blijft ongewijzigd de enige
--     rekenbron. Een voorgesteld bedrag is een gewone regel met status 'interesting' + requested_amount = Gepland.
--   * financier_naam (online gevonden financier zonder cataloguskoppeling) + unieke naam per project.
--   * subsidie_kompas_program_actions (live sinds 20261014095805): source 'chat' = voorgesteld door Subsidie Kompas en
--     door het lid opgeslagen; proposed_at bestaat al.
--
-- Wat er bijkomt (alles additief, geen bestaande rij wordt gewijzigd):
--   1. funding.voorstel jsonb null   herkomst en onderbouwing van een voorgestelde regel: herkomst (regeling / fonds /
--      online), voorgesteld_op, motivatie, onderdeel, bron {url, gecontroleerd_op}, voorwaarden, onzekerheden,
--      deadline {status, datum}. Alleen bij aanmaken te zetten, daarna onveranderlijk (geen UPDATE-recht, trigger).
--      Een online gevonden financier (herkomst 'online') vereist: naam (financier_naam), https-bron-url,
--      controledatum en een Pro- of Premium-abonnement (rechtencheck in de database, naast die in de applicatie).
--      Zo'n financier wordt GEEN fonds in de centrale database: er komt niets in funders of subsidieregelingen.
--   2. status 'withdrawn' (Ingetrokken) in de statuscontrole van de financiering: een voorgestelde regel die het lid
--      niet voortzet, blijft zichtbaar in de historie. Telt in het dekkingsplan nergens mee (net als 'rejected').
--      Bij de rollback wordt Ingetrokken Afgewezen (zie punt 3 hieronder en het rollback-bestand): de bedragen blijven
--      kloppen, maar het onderscheid tussen "door het lid ingetrokken" en "door de financier afgewezen" gaat verloren.
--   3. kompas_voorstel_metadata(p_program_id): nieuwe, aparte RPC die per regel de voorstelmetadata geeft, MASKEERT
--      via kompas_dekkingsplan() (alleen als de bron voor het abonnement zichtbaar is of het een genoemde financier
--      is). kompas_dekkingsplan() zelf wordt niet gewijzigd.
--      Let op bij de rollback: 'withdrawn' (Ingetrokken) kan daarna alleen als 'rejected' (Afgewezen) worden bewaard. Dat is
--      BETEKENISVERLIES (ingetrokken door het lid wordt afgewezen door de financier); zie het rollback-bestand.
--   4. actions.voorstel_sleutel text null (+ unieke index per project waar gevuld): idempotentie. Dezelfde taak uit
--      hetzelfde voorstel kan niet dubbel worden opgeslagen; herhaald klikken of opnieuw proberen geeft 23505, dat de
--      applicatie als "bestaat al" behandelt.
--   5. actions.bron_deadline_bij_voorstel date null: de externe fondsdeadline op het moment van voorstellen. Een taak
--      zonder eigen datum (due_date null) erft de effectieve fondsdeadline van de gekoppelde regel; een ingevulde
--      due_date is de interne streefdatum. Wijkt de actuele fondsdeadline later af van deze waarde, dan toont de
--      interface de wijziging zonder de gekozen streefdatum te overschrijven. Er komt GEEN deadline_type-kolom.
--
-- Geen wijziging aan RLS-beleid, geen nieuwe tabellen, geen data-migratie. Bestaande rijen blijven geldig.
begin;

-- 1. funding.voorstel -----------------------------------------------------------------------------------------
alter table public.subsidie_kompas_program_funding
  add column if not exists voorstel jsonb null;

alter table public.subsidie_kompas_program_funding
  add constraint subsidie_kompas_program_funding_voorstel_chk
  check (
    voorstel is null
    or (
      jsonb_typeof(voorstel) = 'object'
      and octet_length(voorstel::text) <= 8000
      and (voorstel ->> 'versie') = '1'
      and (voorstel ->> 'herkomst') in ('regeling', 'fonds', 'online')
      and (voorstel ->> 'voorgesteld_op') ~ '^\d{4}-\d{2}-\d{2}$'
    )
  );

comment on column public.subsidie_kompas_program_funding.voorstel is
  'Herkomst en onderbouwing van een door Subsidie Kompas voorgestelde regel (versie, herkomst regeling/fonds/online, voorgesteld_op, motivatie, onderdeel, bron {url, gecontroleerd_op}, voorwaarden, onzekerheden, deadline). Alleen bij aanmaken te zetten, daarna onveranderlijk. Bedragen blijven in requested_amount/awarded_amount; de status bepaalt wat meetelt.';

-- 2. status Ingetrokken -------------------------------------------------------------------------------------
alter table public.subsidie_kompas_program_funding
  drop constraint subsidie_kompas_program_funding_status_chk;
alter table public.subsidie_kompas_program_funding
  add constraint subsidie_kompas_program_funding_status_chk
  check (status in ('interesting', 'preparing', 'submitted', 'awarded', 'rejected', 'withdrawn'));

-- Kolomrecht: alleen bij aanmaken.
grant insert (voorstel) on table public.subsidie_kompas_program_funding to authenticated;

-- Triggers (zelfde functies als 20261011180913, plus de voorstelcontrole) ------------------------------------
create or replace function public.subsidie_kompas_program_funding_voor_insert()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  new.financier_naam := nullif(btrim(new.financier_naam), '');

  if num_nonnulls(new.scheme_id, new.funder_id, new.financier_naam) <> 1 then
    raise exception 'Een financieringsregel verwijst naar precies een regeling, een fonds of een genoemde financier'
      using errcode = '23514';
  end if;

  if new.voorstel is not null then
    -- herkomst en bron moeten bij elkaar passen
    if (new.voorstel ->> 'herkomst') = 'regeling' and new.scheme_id is null then
      raise exception 'Voorstel met herkomst regeling vereist een regeling' using errcode = '23514';
    end if;
    if (new.voorstel ->> 'herkomst') = 'fonds' and new.funder_id is null then
      raise exception 'Voorstel met herkomst fonds vereist een fonds' using errcode = '23514';
    end if;
    if (new.voorstel ->> 'herkomst') = 'online' then
      if new.financier_naam is null then
        raise exception 'Een online gevonden financier wordt op naam opgeslagen' using errcode = '23514';
      end if;
      if coalesce(new.voorstel -> 'bron' ->> 'url', '') !~ '^https://[^\s]{4,}$'
         or coalesce(new.voorstel -> 'bron' ->> 'gecontroleerd_op', '') !~ '^\d{4}-\d{2}-\d{2}$' then
        raise exception 'Een online gevonden financier vereist een https-bron-url en een controledatum' using errcode = '23514';
      end if;
      if not (public.current_user_has_pro_access() or public.current_user_has_premium_access()) then
        raise exception 'Online gevonden financiers opslaan vereist Pro of Premium' using errcode = '42501';
      end if;
    end if;
  end if;

  new.created_at := now();
  new.updated_at := now();

  return new;
end;
$function$;

create or replace function public.subsidie_kompas_program_funding_voor_update()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.program_id is distinct from old.program_id then
    raise exception 'user_id en program_id van een financieringsregel zijn onveranderlijk'
      using errcode = '23514';
  end if;

  if new.scheme_id is distinct from old.scheme_id
     and not (old.scheme_id is not null and new.scheme_id is null) then
    raise exception 'scheme_id van een financieringsregel is onveranderlijk' using errcode = '23514';
  end if;

  if new.funder_id is distinct from old.funder_id
     and not (old.funder_id is not null and new.funder_id is null) then
    raise exception 'funder_id van een financieringsregel is onveranderlijk' using errcode = '23514';
  end if;

  if new.voorstel is distinct from old.voorstel then
    raise exception 'De voorstelmetadata van een financieringsregel is onveranderlijk' using errcode = '23514';
  end if;

  -- De naam van een genoemde financier mag worden gecorrigeerd, maar de regel blijft een naam-regel.
  new.financier_naam := case when new.financier_naam is null then null else nullif(btrim(new.financier_naam), '') end;

  if new.financier_naam is distinct from old.financier_naam
     and (old.financier_naam is null or new.financier_naam is null) then
    raise exception 'financier_naam kan alleen worden gewijzigd bij een regel met een genoemde financier'
      using errcode = '23514';
  end if;

  new.created_at := old.created_at;
  new.updated_at := clock_timestamp();

  return new;
end;
$function$;

-- 3. Gemaskeerde voorstelmetadata ----------------------------------------------------------------------------
-- Hergebruikt kompas_dekkingsplan() voor eigenaarschap, abonnement en masking: een regel waarvan de bron voor het
-- abonnement verborgen of verwijderd is, geeft nooit metadata (die kan de naam van die bron bevatten).
create or replace function public.kompas_voorstel_metadata(p_program_id uuid)
returns table (funding_id uuid, voorstel jsonb)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Niet ingelogd' using errcode = '28000';
  end if;

  -- Eigenaarschap expliciet (dezelfde fout voor "niet bestaand" en "van een ander"); niet alleen via de join,
  -- want een lege uitkomst zou de functie kompas_dekkingsplan() anders nooit laten draaien.
  if p_program_id is null or not exists (
    select 1 from public.subsidie_kompas_programs p
    where p.id = p_program_id and p.user_id = auth.uid()
  ) then
    raise exception 'Project niet gevonden' using errcode = '42501';
  end if;

  return query
  select d.id, pf.voorstel
  from public.kompas_dekkingsplan(p_program_id) d
  join public.subsidie_kompas_program_funding pf
    on pf.id = d.id and pf.user_id = auth.uid() and pf.program_id = p_program_id
  where pf.voorstel is not null
    and d.bron_status = 'zichtbaar';
end;
$$;

comment on function public.kompas_voorstel_metadata(uuid) is
  'Voorstel Dekkingsplan en actieplan: voorstelmetadata per financieringsregel van een eigen project, gemaskeerd via kompas_dekkingsplan(). Alleen voor ingelogde gebruikers.';

revoke all on function public.kompas_voorstel_metadata(uuid) from public, anon;
grant execute on function public.kompas_voorstel_metadata(uuid) to authenticated, service_role;

-- 4 en 5. Acties: idempotentiesleutel en fondsdeadline bij het voorstel ----------------------------------------
alter table public.subsidie_kompas_program_actions
  add column if not exists voorstel_sleutel text null,
  add column if not exists bron_deadline_bij_voorstel date null;

alter table public.subsidie_kompas_program_actions
  add constraint subsidie_kompas_program_actions_sleutel_chk
  check (voorstel_sleutel is null or char_length(btrim(voorstel_sleutel)) between 1 and 200);

create unique index subsidie_kompas_program_actions_voorstel_sleutel_uidx
  on public.subsidie_kompas_program_actions (program_id, voorstel_sleutel)
  where voorstel_sleutel is not null;

comment on column public.subsidie_kompas_program_actions.voorstel_sleutel is
  'Stabiele sleutel van een voorgestelde taak (idempotent opslaan: dezelfde taak uit hetzelfde voorstel kan niet dubbel). Null bij een zelf toegevoegde taak.';
comment on column public.subsidie_kompas_program_actions.bron_deadline_bij_voorstel is
  'De externe fondsdeadline op het moment van voorstellen. due_date null = erft de effectieve fondsdeadline van de gekoppelde regel; due_date gevuld = interne streefdatum. Alleen voor het zichtbaar maken van latere wijzigingen van de bron-deadline.';

grant insert (voorstel_sleutel, bron_deadline_bij_voorstel)
  on table public.subsidie_kompas_program_actions to authenticated;

create or replace function public.subsidie_kompas_program_actions_voor_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.program_id is distinct from old.program_id
     or (new.funding_id is distinct from old.funding_id and not (old.funding_id is not null and new.funding_id is null))
     or new.source is distinct from old.source
     or new.proposed_at is distinct from old.proposed_at
     or new.voorstel_sleutel is distinct from old.voorstel_sleutel
     or new.bron_deadline_bij_voorstel is distinct from old.bron_deadline_bij_voorstel then
    raise exception 'id, gebruiker, project, financieringsregel, herkomst, voorstelmoment, voorstelsleutel en voorstel-deadline van een taak zijn onveranderlijk'
      using errcode = '23514';
  end if;

  new.title := btrim(new.title);
  new.created_at := old.created_at;
  new.updated_at := clock_timestamp();
  new.completed_at := case
    when new.status = 'done' and old.status <> 'done' then clock_timestamp()
    when new.status = 'done' then old.completed_at
    else null
  end;

  return new;
end;
$$;

commit;
