-- Meerdere aanvraagrondes/sluitingsdata per subsidieregeling (bijv. fondsen
-- waarvan het bestuur 3-6x per jaar vergadert, elk met een eigen
-- sluitingsdatum). Eén subsidieregeling kan 0..n rondes hebben:
--   0 rondes  -> ongewijzigd gedrag, de bestaande sr.deadline_datum/
--                sr.deadline_omschrijving/sr.deadline blijven de bron
--                (compatibiliteitslaag, geen bestaande regeling breekt).
--   1..n rondes -> de rondes worden de bron van waarheid voor déze regeling;
--                de oude kolommen op subsidieregelingen blijven ongewijzigd
--                in de database staan (geen dataverlies), maar worden voor
--                een regeling met rondes niet meer gelezen.
-- Verlopen rondes worden nooit verwijderd (historie blijft bewaard); een
-- ronde kan wel handmatig verwijderd of tijdelijk gedeactiveerd worden door
-- een beheerder (admin_verwijder_ronde / admin_upsert_ronde met p_actief=false).
create table public.subsidieregeling_rondes (
  id uuid primary key default gen_random_uuid(),
  subsidieregeling_id uuid not null references public.subsidieregelingen(id) on delete cascade,
  sluitingsdatum date not null,
  sluitingstijd time without time zone,
  open_vanaf date,
  beoordelingsdatum date,
  beoordelingsperiode text,
  toelichting text,
  bron_url text,
  actief boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.subsidieregeling_rondes is
  'Aanvraagrondes/sluitingsdata per subsidieregeling. 0 rijen voor een regeling = doorlopend of de oude single-deadline kolommen op subsidieregelingen gelden nog; 1+ rijen = deze rondes zijn leidend voor die regeling. Nooit automatisch verwijderd, alleen door een beheerder.';
comment on column public.subsidieregeling_rondes.sluitingstijd is 'Tijdstip waarop de ronde sluit, Europe/Amsterdam wandkloktijd. Leeg = einde van de dag (23:59:59) wordt aangehouden bij de eerstvolgende-ronde-berekening.';
comment on column public.subsidieregeling_rondes.beoordelingsdatum is 'Exacte beoordelingsdatum, indien bekend. Vult beoordelingsperiode aan/vervangt die niet automatisch.';
comment on column public.subsidieregeling_rondes.beoordelingsperiode is 'Vrije tekst voor wanneer alleen een periode bekend is (bijv. "maart 2027"), i.p.v. een fictieve exacte datum te verzinnen.';
comment on column public.subsidieregeling_rondes.actief is 'Tijdelijk uitzetten zonder te verwijderen; een inactieve ronde telt niet mee in de eerstvolgende-ronde-berekening.';

create index subsidieregeling_rondes_regeling_sluiting_idx
  on public.subsidieregeling_rondes (subsidieregeling_id, sluitingsdatum);

-- Zelfde patroon als funders/subsidieregelingen: RLS aan, geen policies —
-- alleen leesbaar via de (SECURITY DEFINER) view/functies en beschrijfbaar
-- via de admin-only RPC's hieronder.
alter table public.subsidieregeling_rondes enable row level security;
