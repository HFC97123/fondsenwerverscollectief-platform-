-- CREATE OR REPLACE vervangt een functie alleen als de parametertype-lijst
-- exact gelijk blijft; nieuwe (defaulted) parameters toevoegen maakt Postgres
-- dus altijd een TWEEDE overload aan in plaats van de bestaande te vervangen
-- - precies het probleem dat de vorige migratie voor admin_list_* al met een
-- expliciete DROP vermeed, maar hier bij admin_update_funder/
-- admin_update_subsidieregeling per ongeluk opnieuw is ontstaan. Opruimen:
-- de oude, kortere overloads verwijderen zodat elke functie weer één
-- eenduidige, actuele versie heeft.
drop function if exists public.admin_update_funder(uuid, text, funder_type, text, text, text, numeric, numeric, numeric, integer, text, text);
drop function if exists public.admin_update_subsidieregeling(uuid, text, text, numeric, numeric, text, date, text, text, regeling_status_type, uuid, text);
