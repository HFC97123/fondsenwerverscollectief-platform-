-- Limieten van de matching-RPC's verhogen zodat alle beoordeelde fondsen en regelingen gelezen worden
-- (op 18-10-2026: 436 regelingen, 348 fondsen, samen 784). Toegepast op het live project op 18-10-2026 op verzoek van de beheerder.
-- Alleen het getal in 'limit' verandert; de rest van de functie (en de rechten: alleen service_role) blijft ongewijzigd.
-- Terugdraaien: dezelfde stap omgekeerd (zie kompas_rpc_limieten_800_terugdraaien.sql).
do $$
declare
  d text;
begin
  d := pg_get_functiondef('public.kompas_subsidieregelingen_voor_tier(text)'::regprocedure);
  if d !~ 'limit 250' then raise exception 'verwachte limiet 250 niet gevonden'; end if;
  execute replace(d, 'limit 250', 'limit 800');

  d := pg_get_functiondef('public.kompas_funder_deadlines_voor_tier(text)'::regprocedure);
  if d !~ 'limit 100' then raise exception 'verwachte limiet 100 niet gevonden'; end if;
  execute replace(d, 'limit 100', 'limit 800');
end $$;
