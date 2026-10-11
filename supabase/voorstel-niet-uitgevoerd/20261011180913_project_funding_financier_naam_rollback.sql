-- Rollback van 20261011180913_project_funding_financier_naam.sql (NIET automatisch uitgevoerd).
-- Verwijdert uitsluitend de naam-regels (financier_naam is not null) en zet de oorspronkelijke
-- triggers en kompas_dekkingsplan() terug. De legacy-kolom subsidie_kompas_programs.cofinanciers is
-- nooit gewijzigd, dus er gaat geen invoer verloren. Het terugdraaien van de RPC volgt de definitie
-- uit migratie 20261011104804_project_funding_fase2.sql.
--
-- Let op: naam-regels die het lid na de migratie zelf toevoegde, verdwijnen hiermee ook.

delete from public.subsidie_kompas_program_funding where financier_naam is not null;

drop index if exists public.subsidie_kompas_program_funding_unique_naam;
alter table public.subsidie_kompas_program_funding drop constraint if exists subsidie_kompas_program_funding_hoogstens_een_bron_chk;
alter table public.subsidie_kompas_program_funding drop constraint if exists subsidie_kompas_program_funding_naam_chk;
revoke insert (financier_naam), update (financier_naam) on public.subsidie_kompas_program_funding from authenticated;

create or replace function public.subsidie_kompas_program_funding_voor_insert()
returns trigger language plpgsql set search_path to 'public', 'pg_temp' as $function$
begin
  if (new.scheme_id is null) = (new.funder_id is null) then
    raise exception 'Een financieringsregel verwijst naar precies een regeling of een fonds' using errcode = '23514';
  end if;
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$function$;

create or replace function public.subsidie_kompas_program_funding_voor_update()
returns trigger language plpgsql set search_path to 'public', 'pg_temp' as $function$
begin
  if new.id is distinct from old.id or new.user_id is distinct from old.user_id or new.program_id is distinct from old.program_id then
    raise exception 'user_id en program_id van een financieringsregel zijn onveranderlijk' using errcode = '23514';
  end if;
  if new.scheme_id is distinct from old.scheme_id and not (old.scheme_id is not null and new.scheme_id is null) then
    raise exception 'scheme_id van een financieringsregel is onveranderlijk' using errcode = '23514';
  end if;
  if new.funder_id is distinct from old.funder_id and not (old.funder_id is not null and new.funder_id is null) then
    raise exception 'funder_id van een financieringsregel is onveranderlijk' using errcode = '23514';
  end if;
  new.created_at := old.created_at;
  new.updated_at := clock_timestamp();
  return new;
end;
$function$;

-- Daarna de kolom zelf (optioneel; pas uitvoeren als de RPC hieronder is teruggezet):
--   alter table public.subsidie_kompas_program_funding drop column financier_naam;
-- kompas_dekkingsplan(): terugzetten met de functiedefinitie uit 20261011104804_project_funding_fase2.sql.
