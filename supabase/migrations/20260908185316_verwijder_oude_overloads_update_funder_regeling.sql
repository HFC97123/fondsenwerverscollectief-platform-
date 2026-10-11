-- CREATE OR REPLACE met een extra parameter maakt in Postgres een nieuwe
-- OVERLOAD aan in plaats van de bestaande functie te vervangen (overloads
-- worden op naam + parameterlijst onderscheiden). Na de vorige twee
-- migraties bestonden er dus tijdelijk twee versies naast elkaar van zowel
-- admin_update_funder (13 vs. 14 argumenten) als
-- admin_update_subsidieregeling (21 vs. 22 argumenten) — dat is nooit de
-- bedoeling geweest en kan tot verwarrende call-ambiguïteit leiden. Dit
-- verwijdert uitsluitend de oude, overbodige overloads; de nieuwe versies
-- (met het optionele p_bijdrage_toelichting-argument, DEFAULT NULL) blijven
-- ongewijzigd bestaan en zijn 100% backwards compatible met bestaande
-- aanroepen.
drop function public.admin_update_funder(uuid, text, funder_type, text, text, text, numeric, numeric, numeric, integer, text, text, text);

drop function public.admin_update_subsidieregeling(uuid, text, text, numeric, numeric, text, date, text, text, regeling_status_type, uuid, text, text, text, text, text, text, text, text, text, funder_type);
