-- NIET UITGEVOERD op de live database. Wacht op een afzonderlijk akkoord van het lid (zie uitrolplan). Vereist migratie C
-- (20261016100000_actieplan_atomair.sql) en dus uitvoeren NA C.
--
-- Migratie D: planningsgegevens bij taken van het actieplan (OPTIONEEL; de Edge Function werkt ook zonder deze migratie, dan staat de
-- herkomst van een datum alleen in de toelichting van de taak).
--   - planning_fase:     in welke fase van de aanvraag de taak valt (navragen, passendheid, adviseur, ..., indienen, ontvangst, ..., vervolg).
--   - datum_herkomst:    'bron' (uit de database van Subsidiekompas), 'berekend' (uit een bekende deadline of termijn), 'aanname' (voorlopige
--                        planningsaanname of eigen streefdatum) of 'handmatig' (het lid paste de datum zelf aan).
--   - datum_bron:        waar de datum vandaan komt, in gewone taal (incl. bron en controledatum).
--   - datum_controle:    wanneer de bron voor het laatst is gecontroleerd, indien bekend.
--   - planning_versie:   teller die ALLEEN de server ophoogt als hij een datum bijwerkt (herplannen).
--   - planning_handmatig: door de database gezet zodra het lid zelf de datum, titel of notitie wijzigt (en niet de server). Herplannen
--                        overschrijft zo'n taak nooit zonder uitdrukkelijke keuze van het lid.
-- Rollback: 20261016120000_actieplan_planning_rollback.sql
begin;

alter table public.subsidie_kompas_program_actions
  add column planning_fase text null,
  add column datum_herkomst text null,
  add column datum_bron text null,
  add column datum_controle date null,
  add column planning_versie integer not null default 1,
  add column planning_handmatig boolean not null default false;

alter table public.subsidie_kompas_program_actions
  add constraint subsidie_kompas_program_actions_herkomst_chk check (datum_herkomst is null or datum_herkomst in ('bron', 'berekend', 'aanname', 'handmatig')),
  add constraint subsidie_kompas_program_actions_fase_chk check (planning_fase is null or char_length(planning_fase) between 1 and 40),
  add constraint subsidie_kompas_program_actions_bron_chk check (datum_bron is null or char_length(datum_bron) <= 400);

comment on column public.subsidie_kompas_program_actions.datum_herkomst is
  'Herkomst van due_date bij taken uit het actieplan: bron | berekend | aanname | handmatig. NULL bij taken zonder planning.';
comment on column public.subsidie_kompas_program_actions.planning_handmatig is
  'Door de database gezet als het lid zelf datum, titel of notitie wijzigde. Herplannen overschrijft dit nooit zonder uitdrukkelijke keuze.';

-- Kolomrechten: bij een insert door de gebruikersclient van de Edge Function en bij een update door de server namens het lid. planning_handmatig
-- is NIET schrijfbaar voor gebruikers: alleen de trigger hieronder zet hem.
grant insert (planning_fase, datum_herkomst, datum_bron, datum_controle) on table public.subsidie_kompas_program_actions to authenticated;
grant update (planning_fase, datum_herkomst, datum_bron, datum_controle, planning_versie) on table public.subsidie_kompas_program_actions to authenticated;

create or replace function public.subsidie_kompas_actions_planning_handmatig()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Een wijziging van datum, titel of notitie ZONDER dat planning_versie omhoog ging is een wijziging van het lid zelf (de server verhoogt de
  -- versie altijd mee als hij herplant).
  if (new.due_date is distinct from old.due_date or new.title is distinct from old.title or new.notes is distinct from old.notes)
     and new.planning_versie is not distinct from old.planning_versie then
    new.planning_handmatig := true;

    if new.due_date is distinct from old.due_date then
      new.datum_herkomst := 'handmatig';
    end if;
  end if;

  return new;
end;
$$;

create trigger subsidie_kompas_program_actions_zz_planning_handmatig
  before update on public.subsidie_kompas_program_actions
  for each row execute function public.subsidie_kompas_actions_planning_handmatig();

-- De wachtrij van nog niet aangemaakte taken (migratie C) bewaart dezelfde planningsgegevens, zodat "Actieplan opnieuw proberen" niets verliest.
alter table public.subsidie_kompas_actieplan_open
  add column planning_fase text null,
  add column datum_herkomst text null,
  add column datum_bron text null,
  add column datum_controle date null;

alter table public.subsidie_kompas_actieplan_open
  add constraint subsidie_kompas_actieplan_open_herkomst_chk check (datum_herkomst is null or datum_herkomst in ('bron', 'berekend', 'aanname'));

notify pgrst, 'reload schema';

commit;
