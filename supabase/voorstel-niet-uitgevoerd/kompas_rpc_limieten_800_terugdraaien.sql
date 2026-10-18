-- Terugdraaien van 20261018140000_kompas_rpc_limieten_800.sql: limieten weer op 250 (regelingen) en 100 (fondsen met deadline).
do $$
declare
  d text;
begin
  d := pg_get_functiondef('public.kompas_subsidieregelingen_voor_tier(text)'::regprocedure);
  execute replace(d, 'limit 800', 'limit 250');

  d := pg_get_functiondef('public.kompas_funder_deadlines_voor_tier(text)'::regprocedure);
  execute replace(d, 'limit 800', 'limit 100');
end $$;
