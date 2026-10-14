-- Rollback van 20261014120000_voorstel_metadata.sql (NIET automatisch uitgevoerd).
--
-- Gevolgen:
--   * funding.voorstel (server-owned herkomst en verificatiebewijs van voorgestelde regels) wordt verwijderd. De regels zelf, hun
--     bedragen, status en notities blijven bestaan; alleen de metadata (voorgesteld bedrag, bron-url, controlemoment,
--     vingerafdruk, status per veld) gaat verloren. De schemacontrolefunctie kompas_voorstel_geldig() verdwijnt mee.
--   * Het tabelbrede SELECT-recht van authenticated op subsidie_kompas_program_funding wordt hersteld (de kolomgewijze rechten
--     zonder `voorstel` waren een onderdeel van de lekfix). Dat is veilig zolang de kolom `voorstel` hier is verwijderd.
--   * BETEKENISVERLIES: regels met status 'withdrawn' (Ingetrokken: door het lid zelf niet voortgezet) worden 'rejected'
--     (Afgewezen: door de financier afgewezen). De status kent na de rollback het onderscheid niet meer, dus een ingetrokken
--     regel lijkt dan op een afwijzing (labels, tellingen en elk rapport dat afwijzingen telt). Voor de bedragen in het
--     dekkingsplan maakt het geen verschil: beide tellen nergens mee. Om de herkomst niet te verliezen zet dit script
--     vooraan in de notitie van elke omgezette regel: "[Teruggezet: was Ingetrokken door u, niet afgewezen door de financier.]"
--     (de notitie wordt zo nodig aan het einde ingekort tot de limiet van 4000 tekens). Het aantal omgezette regels komt als
--     melding (NOTICE) in de uitvoer. De rollback is dus niet verliesvrij; wie dat niet wil, draait hem niet.
--   * actions.voorstel_sleutel en actions.bron_deadline_bij_voorstel worden verwijderd. De taken blijven bestaan; herhaald
--     opslaan van een voorstel is dan niet meer idempotent (de serverroute die voorstellen opslaat moet vooraf zijn teruggezet).
--   * kompas_voorstel_metadata() verdwijnt. kompas_dekkingsplan() was nooit gewijzigd.
-- Terugzetten van de applicatiecode (voorstelkaart en serverroute voor opslaan) hoort vóór deze rollback.
begin;

drop function if exists public.kompas_voorstel_metadata(uuid);

-- Triggers terug naar de stand van 20261011180913 (funding) en 20261012120000/20261014095805 (acties).
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
     or new.proposed_at is distinct from old.proposed_at then
    raise exception 'id, gebruiker, project, financieringsregel, herkomst en voorstelmoment van een taak zijn onveranderlijk'
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

-- Acties
drop index if exists public.subsidie_kompas_program_actions_voorstel_sleutel_uidx;
alter table public.subsidie_kompas_program_actions drop constraint if exists subsidie_kompas_program_actions_sleutel_chk;
alter table public.subsidie_kompas_program_actions drop column if exists voorstel_sleutel;
alter table public.subsidie_kompas_program_actions drop column if exists bron_deadline_bij_voorstel;

-- Funding: status en metadata
do $$
declare
  v_aantal integer;
begin
  update public.subsidie_kompas_program_funding
     set status = 'rejected',
         notes = left('[Teruggezet: was Ingetrokken door u, niet afgewezen door de financier.]' || coalesce(E'\n' || notes, ''), 4000)
   where status = 'withdrawn';
  get diagnostics v_aantal = row_count;
  raise notice 'Rollback: % regel(s) met status Ingetrokken zijn Afgewezen geworden (herkomst vooraan in de notitie vastgelegd).', v_aantal;
end $$;
alter table public.subsidie_kompas_program_funding drop constraint subsidie_kompas_program_funding_status_chk;
alter table public.subsidie_kompas_program_funding
  add constraint subsidie_kompas_program_funding_status_chk
  check (status in ('interesting', 'preparing', 'submitted', 'awarded', 'rejected'));

alter table public.subsidie_kompas_program_funding drop constraint if exists subsidie_kompas_program_funding_voorstel_chk;
alter table public.subsidie_kompas_program_funding drop column if exists voorstel;
drop function if exists public.kompas_voorstel_geldig(jsonb);

-- Rechten terug naar de stand van 20261011104804: tabelbreed SELECT voor authenticated.
revoke select (id, user_id, program_id, scheme_id, funder_id, financier_naam, requested_amount, awarded_amount, status, eigen_deadline, reminder_enabled, notes, created_at, updated_at)
  on table public.subsidie_kompas_program_funding from authenticated;
grant select on table public.subsidie_kompas_program_funding to authenticated;

commit;
