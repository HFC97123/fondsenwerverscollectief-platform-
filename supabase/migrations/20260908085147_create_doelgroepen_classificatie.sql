-- Centrale doelgroepen-classificatie, zelfde patroon als public.themas/public.regios:
-- één opzoektabel, publiek leesbaar voor ingelogde leden, schrijven voorlopig alleen
-- via migraties/beheer (geen INSERT/UPDATE/DELETE-policy, net als themas/regios).
-- Vervangt de hardgecodeerde CHIP_OPTIES.doelgroepen in OrganisatieprofielPage.jsx als
-- source of truth, zodat organisatieprofiel, projecten en (later) matching dezelfde
-- lijst gebruiken.
create table public.doelgroepen (
  id uuid primary key default gen_random_uuid(),
  naam text not null unique
);

alter table public.doelgroepen enable row level security;

create policy "doelgroepen_read_authenticated" on public.doelgroepen
  for select
  to authenticated
  using (true);

-- Geseed met de huidige 9 waarden uit CHIP_OPTIES.doelgroepen (OrganisatieprofielPage.jsx),
-- ongewijzigd overgenomen zodat er geen bestaande betekenis verschuift.
insert into public.doelgroepen (naam) values
  ('Kinderen'),
  ('Jongeren'),
  ('Ouderen'),
  ('Mensen met een beperking'),
  ('Nieuwkomers/ongedocumenteerden'),
  ('Dieren'),
  ('Mensen in armoede'),
  ('Buurtbewoners'),
  ('Vrijwilligers');
