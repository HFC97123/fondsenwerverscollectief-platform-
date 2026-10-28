-- Lek gedicht (28-10-2026): een vergrendelde regel (volledig_zichtbaar = false) stuurde de echte naam van de regeling
-- (subsidieregelingen_deadlines.naam) en van het fonds/datamoment (funder_deadlines.funder_naam, datamoment_naam, funder_id)
-- mee naar de browser; die werd pas op het scherm in puntjes veranderd. Nu geeft de database daar NULL.
-- Discipline, doelgroep en werkgebied blijven zichtbaar. Toegepast via apply_migration (deadlines_naam_niet_meesturen_bij_vergrendeld).
do $$
declare
  v text;
  w text;
begin
  v := pg_get_viewdef('public.subsidieregelingen_deadlines'::regclass);
  w := replace(v, E' SELECT id,\n    naam,', E' SELECT id,\n        CASE\n            WHEN volledig_zichtbaar THEN naam\n            ELSE NULL::text\n        END AS naam,');
  if w = v then
    raise exception 'subsidieregelingen_deadlines: naam niet gevonden';
  end if;
  execute 'create or replace view public.subsidieregelingen_deadlines as ' || w;

  v := pg_get_viewdef('public.funder_deadlines'::regclass);
  w := replace(v, E' SELECT datamoment_id AS id,\n    funder_id,\n    funder_naam,', E' SELECT datamoment_id AS id,\n        CASE\n            WHEN volledig_zichtbaar THEN funder_id\n            ELSE NULL::uuid\n        END AS funder_id,\n        CASE\n            WHEN volledig_zichtbaar THEN funder_naam\n            ELSE NULL::text\n        END AS funder_naam,');
  w := replace(w, E'    datamoment_naam,\n    data_tier,', E'        CASE\n            WHEN volledig_zichtbaar THEN datamoment_naam\n            ELSE NULL::text\n        END AS datamoment_naam,\n    data_tier,');
  if position('THEN funder_naam' in w) = 0 or position('THEN datamoment_naam' in w) = 0 then
    raise exception 'funder_deadlines: kolommen niet gevonden';
  end if;
  execute 'create or replace view public.funder_deadlines as ' || w;
end $$;
