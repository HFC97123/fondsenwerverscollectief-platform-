-- Fase 2: projecten echt bewaren op de al bestaande, tot nu toe ongebruikte
-- tabel subsidie_kompas_programs (RLS/GRANT stonden al goed, zie migratie
-- 20260822091429). Het huidige Projecten-scherm (localStorage-only) gebruikt
-- een aantal velden die deze tabel nog niet had; die kolommen worden hier
-- toegevoegd. Drie onderdelen zijn per project een lijstje (eerdere
-- toekenningen, co-financiers, gekoppelde regelingen in het dekkingsplan) -
-- net als bij contactpersonen/social_media in fase 1 bewaard als jsonb op
-- het project zelf, in plaats van aparte tabellen: dat dekt de huidige
-- schermlogica al bijna 1-op-1 en voorkomt onnodig migratiewerk.
--
-- name/description/target_groups/goals bestonden al en dekken
-- naam/omschrijving/doelgroep/doelstellingen.

alter table public.subsidie_kompas_programs
  add column if not exists program_label text,
  add column if not exists location text,
  add column if not exists period_start text,
  add column if not exists period_end text,
  add column if not exists budget_total numeric,
  add column if not exists requested_amount numeric,
  add column if not exists own_contribution numeric,
  add column if not exists partners text,
  add column if not exists results text,
  add column if not exists previous_grants jsonb not null default '[]'::jsonb,
  add column if not exists cofinanciers jsonb not null default '[]'::jsonb,
  add column if not exists linked_schemes jsonb not null default '[]'::jsonb;
