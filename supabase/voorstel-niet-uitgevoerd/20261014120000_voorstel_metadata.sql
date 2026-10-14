-- Voorstel Dekkingsplan en actieplan: server-owned herkomst- en verificatiemetadata (VERSIE 2, gecorrigeerd na de audit van 2026-10-14).
-- VOORSTEL, NIET UITGEVOERD. Live toepassen vereist een afzonderlijk expliciet akkoord.
-- Rollback: 20261014120000_voorstel_metadata_rollback.sql  (SQL-test: supabase/tests/voorstel-metadata/)
--
-- Wat de audit liet zien (versie 1) en wat hier is opgelost:
--   1. LEK: authenticated heeft tabelbreed SELECT op subsidie_kompas_program_funding. De nieuwe kolom `voorstel` was daardoor met een
--      gewone select te lezen, zonder de maskering van de RPC (motivatie van een verborgen Premium-regeling was leesbaar, ook na een
--      downgrade). Nu: tabelbreed SELECT is ingetrokken; authenticated krijgt SELECT per kolom, zonder `voorstel` en zonder de
--      bronverwijzingen scheme_id/funder_id (die de maskering van kompas_dekkingsplan() zouden omzeilen).
--   2. VERTROUWEN: de metadata werd door de client aangeleverd, dus "geverifieerd" bewees niets. Nu: authenticated heeft geen INSERT-,
--      UPDATE- of SELECT-recht op `voorstel`; alleen de server (service_role, Edge Function) kan de kolom bij het aanmaken van een regel
--      zetten, een trigger dwingt dat ook af, en de inhoud moet voldoen aan een strikt schema (kompas_voorstel_geldig).
--   3. DUBBELE WAARHEID: geen tekstkopieën van fonds- of regelinggegevens meer. Naam, bijdragegrenzen, deadline en cofinanciering van
--      een regeling of fonds blijven live in het databaserecord. De metadata bevat alleen (A) gebruikersdata: het door Subsidie Kompas
--      voorgestelde bedrag, (B) verificatiebewijs dat de server zelf heeft vastgelegd, en de herkomst.
--   4. De acties-kolommen voorstel_sleutel en bron_deadline_bij_voorstel krijgen geen clientrecht: de server schrijft de taken van een
--      voorstel zelf (idempotent via de sleutel).
--
-- Wat er al is en hergebruikt wordt (niets hiervan wordt vervangen):
--   * subsidie_kompas_program_funding = enige bron voor geld; kompas_dekkingsplan() blijft ongewijzigd de enige rekenbron. Een
--     voorgesteld bedrag is een gewone regel met status 'interesting' + requested_amount = Gepland.
--   * financier_naam (online gevonden financier zonder cataloguskoppeling) + unieke naam per project.
--   * subsidie_kompas_program_actions (live sinds 20261014095805): source 'chat' = voorgesteld; proposed_at bestaat al.
--
-- Metadata (kolom `voorstel`, versie 2). Alle sleutels buiten deze lijst worden geweigerd:
--   versie 2, server_generated true, herkomst (regeling | fonds | online), voorgesteld_op (datum), voorgesteld_bedrag (getal | null; referentie, telt
--   nergens mee: requested_amount blijft de enige bron voor geld), verificatie (optioneel bij regeling/fonds, verplicht bij online):
--     status        geverifieerd | gedeeltelijk | onzeker | conflict | niet_gecontroleerd
--     gecontroleerd_op, bron_url (https), eind_url (https), pagina_sha256 (vingerafdruk van de opgehaalde tekst)
--     velden        fondsnaam | deadline | bedrag_min | bedrag_max | voorwaarden | cofinanciering | doelgroep | aanvragertype | geografie
--                   elk { status: confirmed | uncertain | conflict | not_checked, waarde? (de ONLINE waarde, max 200), fragment? (citaat, max 300),
--                         fragment_sha256? (vingerafdruk van het citaat), db_waarde? (alleen bij conflict, verplicht: momentopname van de
--                         databasewaarde op het controlemoment, max 200) }
--   db_waarde is uitsluitend AUDITBEWIJS bij een conflict (wat stond er in de database, wat stond er online, welke bron, wanneer). Het is
--   geen tweede waarheid: de app toont de actuele waarde altijd uit het databaserecord en rekent er nooit mee.
--   Samenhang (afgedwongen): 'geverifieerd' vereist bron, controlemoment, vingerafdruk, fondsnaam en deadline bevestigd (deadline met
--   citaat) en geen enkel veld onzeker of in conflict; elk veld in conflict dwingt status 'conflict'; 'niet_gecontroleerd' kent geen
--   bevestigd veld.
--
-- Geen wijziging aan RLS-beleid, geen nieuwe tabellen, geen data-migratie. Bestaande rijen blijven geldig.
begin;

-- 1. Schemacontrole van de metadata ---------------------------------------------------------------------------
create or replace function public.kompas_voorstel_geldig(v jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_temp
as $$
declare
  k text;
  vk text;
  veld jsonb;
  ver jsonb;
  vel jsonb;
  st text;
  n_conflict integer := 0;
  n_onzeker integer := 0;
  n_bevestigd integer := 0;
  datum_re constant text := '^\d{4}-\d{2}-\d{2}(T[0-9:.]+(Z|[+-]\d{2}:\d{2}))?$';
  url_re constant text := '^https://[^\s]{4,}$';
begin
  if v is null then
    return true;
  end if;

  if jsonb_typeof(v) <> 'object' or octet_length(v::text) > 8000 then
    return false;
  end if;

  for k in select jsonb_object_keys(v) loop
    if k not in ('versie', 'server_generated', 'herkomst', 'voorgesteld_op', 'voorgesteld_bedrag', 'verificatie') then
      return false;
    end if;
  end loop;

  if v -> 'versie' is distinct from '2'::jsonb or v -> 'server_generated' is distinct from 'true'::jsonb then
    return false;
  end if;

  if coalesce(v ->> 'herkomst', '') not in ('regeling', 'fonds', 'online') then
    return false;
  end if;

  if coalesce(v ->> 'voorgesteld_op', '') !~ '^\d{4}-\d{2}-\d{2}$' then
    return false;
  end if;

  if v ? 'voorgesteld_bedrag' then
    if jsonb_typeof(v -> 'voorgesteld_bedrag') not in ('number', 'null') then
      return false;
    end if;

    if jsonb_typeof(v -> 'voorgesteld_bedrag') = 'number'
       and not ((v ->> 'voorgesteld_bedrag')::numeric >= 0 and (v ->> 'voorgesteld_bedrag')::numeric < 1000000000000) then
      return false;
    end if;
  end if;

  ver := v -> 'verificatie';

  if ver is null or jsonb_typeof(ver) = 'null' then
    return (v ->> 'herkomst') <> 'online';
  end if;

  if jsonb_typeof(ver) <> 'object' then
    return false;
  end if;

  for k in select jsonb_object_keys(ver) loop
    if k not in ('status', 'gecontroleerd_op', 'bron_url', 'eind_url', 'pagina_sha256', 'velden') then
      return false;
    end if;
  end loop;

  st := ver ->> 'status';

  if coalesce(st, '') not in ('geverifieerd', 'gedeeltelijk', 'onzeker', 'conflict', 'niet_gecontroleerd') then
    return false;
  end if;

  if ver ? 'gecontroleerd_op' and (jsonb_typeof(ver -> 'gecontroleerd_op') <> 'string' or (ver ->> 'gecontroleerd_op') !~ datum_re) then
    return false;
  end if;

  if ver ? 'bron_url' and (jsonb_typeof(ver -> 'bron_url') <> 'string' or (ver ->> 'bron_url') !~ url_re or char_length(ver ->> 'bron_url') > 2000) then
    return false;
  end if;

  if ver ? 'eind_url' and (jsonb_typeof(ver -> 'eind_url') <> 'string' or (ver ->> 'eind_url') !~ url_re or char_length(ver ->> 'eind_url') > 2000) then
    return false;
  end if;

  if ver ? 'pagina_sha256' and (jsonb_typeof(ver -> 'pagina_sha256') <> 'string' or (ver ->> 'pagina_sha256') !~ '^[0-9a-f]{64}$') then
    return false;
  end if;

  vel := coalesce(ver -> 'velden', '{}'::jsonb);

  if jsonb_typeof(vel) <> 'object' then
    return false;
  end if;

  for vk in select jsonb_object_keys(vel) loop
    if vk not in ('fondsnaam', 'deadline', 'bedrag_min', 'bedrag_max', 'voorwaarden', 'cofinanciering', 'doelgroep', 'aanvragertype', 'geografie') then
      return false;
    end if;

    veld := vel -> vk;

    if jsonb_typeof(veld) <> 'object' then
      return false;
    end if;

    for k in select jsonb_object_keys(veld) loop
      if k not in ('status', 'waarde', 'fragment', 'fragment_sha256', 'db_waarde') then
        return false;
      end if;
    end loop;

    if coalesce(veld ->> 'status', '') not in ('confirmed', 'uncertain', 'conflict', 'not_checked') then
      return false;
    end if;

    if veld ? 'waarde' and (jsonb_typeof(veld -> 'waarde') <> 'string' or char_length(veld ->> 'waarde') > 200) then
      return false;
    end if;

    if veld ? 'fragment' and (jsonb_typeof(veld -> 'fragment') <> 'string' or char_length(veld ->> 'fragment') > 300) then
      return false;
    end if;

    if veld ? 'fragment_sha256' and (jsonb_typeof(veld -> 'fragment_sha256') <> 'string' or (veld ->> 'fragment_sha256') !~ '^[0-9a-f]{64}$') then
      return false;
    end if;

    if veld ? 'db_waarde' and (jsonb_typeof(veld -> 'db_waarde') <> 'string' or char_length(veld ->> 'db_waarde') > 200) then
      return false;
    end if;

    -- Conflictbewijs: een conflict zonder herleidbare databasewaarde en onlinewaarde is niet toegestaan; db_waarde hoort nergens anders.
    if veld ->> 'status' = 'conflict' and (not (veld ? 'db_waarde') or not (veld ? 'waarde') or (not (veld ? 'fragment') and not (veld ? 'fragment_sha256'))) then
      return false;
    end if;

    if veld ->> 'status' <> 'conflict' and veld ? 'db_waarde' then
      return false;
    end if;

    if veld ->> 'status' = 'conflict' then n_conflict := n_conflict + 1; end if;
    if veld ->> 'status' = 'uncertain' then n_onzeker := n_onzeker + 1; end if;
    if veld ->> 'status' = 'confirmed' then n_bevestigd := n_bevestigd + 1; end if;
  end loop;

  -- Samenhang tussen de samenvattende status en de velden.
  if n_conflict > 0 and st <> 'conflict' then
    return false;
  end if;

  if st = 'conflict' and n_conflict = 0 then
    return false;
  end if;

  if st in ('geverifieerd', 'gedeeltelijk', 'conflict')
     and (ver -> 'bron_url' is null or ver -> 'gecontroleerd_op' is null or ver -> 'pagina_sha256' is null) then
    return false;
  end if;

  if st = 'niet_gecontroleerd' and n_bevestigd > 0 then
    return false;
  end if;

  if st = 'gedeeltelijk' and (vel -> 'fondsnaam' ->> 'status') is distinct from 'confirmed' then
    return false;
  end if;

  if st = 'geverifieerd' then
    if (vel -> 'fondsnaam' ->> 'status') is distinct from 'confirmed'
       or (vel -> 'deadline' ->> 'status') is distinct from 'confirmed'
       or coalesce(btrim(vel -> 'deadline' ->> 'fragment'), '') = ''
       or n_onzeker > 0 then
      return false;
    end if;
  end if;

  -- Een online gevonden financier heeft een https-bron nodig, tenzij de server hem niet kon controleren.
  if (v ->> 'herkomst') = 'online' and st <> 'niet_gecontroleerd' and ver -> 'bron_url' is null then
    return false;
  end if;

  return true;
end;
$$;

comment on function public.kompas_voorstel_geldig(jsonb) is
  'Schema van funding.voorstel (versie 2): vaste sleutels, statuswaarden, conflictbewijs en samenhang tussen samenvattende status en velden. Zuiver; schrijft niets.';

-- 2. funding.voorstel ----------------------------------------------------------------------------------------
alter table public.subsidie_kompas_program_funding
  add column if not exists voorstel jsonb null;

alter table public.subsidie_kompas_program_funding
  add constraint subsidie_kompas_program_funding_voorstel_chk
  check (voorstel is null or public.kompas_voorstel_geldig(voorstel));

comment on column public.subsidie_kompas_program_funding.voorstel is
  'Server-owned herkomst en verificatiebewijs van een voorgestelde regel (versie 2). Geen brondata: naam, grenzen en deadline van een regeling of fonds blijven live in het record. Alleen door de server (service_role) te zetten, bij het aanmaken, daarna onveranderlijk. Niet leesbaar voor authenticated: alleen via kompas_voorstel_metadata().';

-- 3. status Ingetrokken --------------------------------------------------------------------------------------
alter table public.subsidie_kompas_program_funding
  drop constraint subsidie_kompas_program_funding_status_chk;
alter table public.subsidie_kompas_program_funding
  add constraint subsidie_kompas_program_funding_status_chk
  check (status in ('interesting', 'preparing', 'submitted', 'awarded', 'rejected', 'withdrawn'));

-- 4. Rechten: kolomgewijs lezen zonder `voorstel`; schrijven van `voorstel` alleen door de server --------------
-- (De bestaande INSERT- en UPDATE-kolomrechten bevatten `voorstel` niet en krijgen het hier ook niet.)
-- Ook `scheme_id` en `funder_id` zijn niet meer direct leesbaar: ze identificeren de bron (ook een Premium-bron na een downgrade) en
-- omzeilen de maskering van kompas_dekkingsplan(). De app leest ze nooit rechtstreeks uit de tabel (alleen via die RPC); schrijven
-- (INSERT) blijft ongewijzigd mogelijk en eigen gegevens (bedragen, status, notitie, deadlines, financier_naam) blijven leesbaar.
revoke select on table public.subsidie_kompas_program_funding from authenticated;
grant select (id, user_id, program_id, financier_naam, requested_amount, awarded_amount, status, eigen_deadline, reminder_enabled, notes, created_at, updated_at)
  on table public.subsidie_kompas_program_funding to authenticated;

-- 5. Triggers (zelfde functies als 20261011180913, plus de voorstelcontrole) ------------------------------------
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
    -- Alleen de server mag verificatiemetadata zetten. (authenticated heeft hier al geen kolomrecht op; dit is de tweede laag.)
    if current_user not in ('service_role', 'postgres') then
      raise exception 'Voorstelmetadata wordt alleen door de server gezet' using errcode = '42501';
    end if;

    -- herkomst en bron moeten bij elkaar passen
    if (new.voorstel ->> 'herkomst') = 'regeling' and new.scheme_id is null then
      raise exception 'Voorstel met herkomst regeling vereist een regeling' using errcode = '23514';
    end if;
    if (new.voorstel ->> 'herkomst') = 'fonds' and new.funder_id is null then
      raise exception 'Voorstel met herkomst fonds vereist een fonds' using errcode = '23514';
    end if;
    if (new.voorstel ->> 'herkomst') = 'online' and new.financier_naam is null then
      raise exception 'Een online gevonden financier wordt op naam opgeslagen' using errcode = '23514';
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

-- 6. Gemaskeerde voorstelmetadata ----------------------------------------------------------------------------
-- Het ENIGE leespad voor `voorstel`. Hergebruikt kompas_dekkingsplan() voor eigenaarschap, abonnement en masking: een regel waarvan de
-- bron voor het abonnement verborgen of verwijderd is (ook na een downgrade van Premium naar Pro of Free), geeft nooit iets terug. Het
-- resultaat wordt uit een vaste lijst velden opnieuw opgebouwd en bevat dus nooit meer dan het schema toestaat.
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
  select d.id,
         jsonb_strip_nulls(jsonb_build_object(
           'versie', pf.voorstel -> 'versie',
           'server_generated', pf.voorstel -> 'server_generated',
           'herkomst', pf.voorstel -> 'herkomst',
           'voorgesteld_op', pf.voorstel -> 'voorgesteld_op',
           'voorgesteld_bedrag', pf.voorstel -> 'voorgesteld_bedrag',
           'verificatie', pf.voorstel -> 'verificatie'
         ))
  from public.kompas_dekkingsplan(p_program_id) d
  join public.subsidie_kompas_program_funding pf
    on pf.id = d.id and pf.user_id = auth.uid() and pf.program_id = p_program_id
  where pf.voorstel is not null
    and d.bron_status = 'zichtbaar';
end;
$$;

comment on function public.kompas_voorstel_metadata(uuid) is
  'Voorstel Dekkingsplan en actieplan: het enige leespad voor funding.voorstel, per regel van een eigen project, gemaskeerd via kompas_dekkingsplan(). Alleen voor ingelogde gebruikers.';

revoke all on function public.kompas_voorstel_metadata(uuid) from public, anon;
grant execute on function public.kompas_voorstel_metadata(uuid) to authenticated, service_role;

-- 7. Acties: idempotentiesleutel en fondsdeadline bij het voorstel (alleen door de server te schrijven) --------
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
  'Stabiele sleutel van een voorgestelde taak (idempotent opslaan door de server: dezelfde taak uit hetzelfde voorstel kan niet dubbel). Null bij een zelf toegevoegde taak. Geen clientrecht.';
comment on column public.subsidie_kompas_program_actions.bron_deadline_bij_voorstel is
  'De externe fondsdeadline op het moment van voorstellen (door de server vastgelegd). due_date null = erft de effectieve fondsdeadline van de gekoppelde regel; due_date gevuld = interne streefdatum. Alleen voor het zichtbaar maken van latere wijzigingen van de bron-deadline. Geen clientrecht.';

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
