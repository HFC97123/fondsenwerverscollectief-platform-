-- CREATE OR REPLACE met alleen nieuwe DEFAULT-parameters aan het einde bleek
-- toch een tweede, overlappende functie-overload te hebben achtergelaten in
-- plaats van de bestaande te vervangen (anders dan verwacht/dan bij eerdere
-- fases). Ruim de oude, kortere signatures expliciet op zodat er nog maar
-- één admin_update_funder / admin_update_subsidieregeling bestaat - anders
-- kan PostgREST bij een RPC-aanroep met de nieuwe velden verward raken tussen
-- de twee overloads.
drop function if exists public.admin_update_funder(uuid,text,funder_type,text,text,text,numeric,numeric,numeric,integer,text,text,text,text);
drop function if exists public.admin_update_subsidieregeling(uuid,text,text,numeric,numeric,text,date,text,text,regeling_status_type,uuid,text,text,text,text,text,text,text,text,text,funder_type,text);
