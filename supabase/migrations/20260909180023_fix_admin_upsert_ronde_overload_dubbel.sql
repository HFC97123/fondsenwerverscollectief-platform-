
-- CREATE OR REPLACE met nieuwe trailing DEFAULT-parameters vervangt een
-- functie niet in-place als de arity verschilt van de oude versie - dat zet
-- een tweede, overlappende overload naast de oude (zelfde patroon als eerder
-- geconstateerd bij admin_update_funder/admin_update_subsidieregeling in de
-- "Beheerderconsole afmaken"-fase). Expliciet de oude 10-parameter-signature
-- droppen zodat er nog maar 1 versie van admin_upsert_ronde bestaat.
drop function if exists public.admin_upsert_ronde(uuid, uuid, date, time, date, date, text, text, text, boolean);

select oid::regprocedure from pg_proc where proname = 'admin_upsert_ronde';
