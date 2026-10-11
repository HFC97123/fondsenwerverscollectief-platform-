-- Echt werkgebied-veld op subsidieregelingen, ter vervanging van de hardgecodeerde 'Nederland'
-- die tot nu toe in de frontend (src/data/services/deadlines.js) voor elke regeling werd getoond.
-- Bestaande 124 regelingen krijgen 'Landelijk' als startwaarde (zelfde brede, neutrale betekenis
-- als de oude hardcode had); admin kan dit per regeling verfijnen naar een specifieker werkgebied
-- uit de nieuwe regios-lijst.
alter table public.subsidieregelingen
  add column if not exists werkgebied text;

update public.subsidieregelingen
  set werkgebied = 'Landelijk'
  where werkgebied is null;
