-- Veilige, geaggregeerde telling van fondsen en subsidieregelingen voor de
-- live tellers op de publieke website en Subsidie Kompas-marketing.
-- Geeft uitsluitend twee totalen terug (geen rijen, geen premium-inhoud);
-- anon/authenticated hebben geen directe SELECT-rechten op funders/
-- subsidieregelingen (bewust, zie RLS), dus deze SECURITY DEFINER-functie
-- is de enige manier om er veilig een totaalaantal uit te lezen.
create or replace function public.publieke_fondsen_telling()
returns table (funders_totaal bigint, regelingen_totaal bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.funders)::bigint as funders_totaal,
    (select count(*) from public.subsidieregelingen)::bigint as regelingen_totaal;
$$;

comment on function public.publieke_fondsen_telling() is
  'Totaal aantal fondsen en subsidieregelingen (geen rijen, geen premium-inhoud) voor de live tellers op de publieke website en Subsidie Kompas-marketing.';

grant execute on function public.publieke_fondsen_telling() to anon, authenticated;
