-- Terugdraaien van 20261019075646_kompas_bron_details (NIET uitvoeren tenzij de beheerder daarom vraagt).
-- 1. De leesfunctie kompas_bron_details verdwijnt (de app valt dan terug op de views en toont minder details).
-- 2. De views krijgen hun vorige vorm terug: zonder de kolom access_tier en met f.missie in funder_deadlines.
--    Een kolom kan niet met CREATE OR REPLACE VIEW verdwijnen, dus de views worden opnieuw aangemaakt met dezelfde rechten.
begin;

drop function if exists public.kompas_bron_details(uuid[], uuid[]);

do $$
declare
  d text;
begin
  d := pg_get_viewdef('public.subsidieregelingen_deadlines'::regclass, true);
  d := replace(d, E'rondes_aantal,\n    access_tier\n   FROM zichtbaarheid;', E'rondes_aantal\n   FROM zichtbaarheid;');
  d := replace(d, E'rondes_aantal,\n    access_tier::text AS access_tier\n   FROM zichtbaarheid;', E'rondes_aantal\n   FROM zichtbaarheid;');
  execute 'drop view public.subsidieregelingen_deadlines';
  execute 'create view public.subsidieregelingen_deadlines as ' || d;

  d := pg_get_viewdef('public.funder_deadlines'::regclass, true);
  d := regexp_replace(d, E',\\n    access_tier(::text AS access_tier)?\\n   FROM zichtbaarheid;', E'\n   FROM zichtbaarheid;');
  d := regexp_replace(d, 'COALESCE\(NULLIF\(btrim\(f\.algemene_beschrijving\), ''''::text\), f\.missie\) AS missie', 'f.missie');
  execute 'drop view public.funder_deadlines';
  execute 'create view public.funder_deadlines as ' || d;
end $$;

grant select on public.subsidieregelingen_deadlines, public.funder_deadlines to anon, authenticated;
grant all on public.subsidieregelingen_deadlines, public.funder_deadlines to service_role;

commit;
