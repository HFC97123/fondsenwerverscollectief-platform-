-- De eerste 5 (was 3) per categorie zijn voor iedereen volledig zichtbaar, ongeacht Pro/Premium-tier van de regeling.
-- Pro en Premium behouden hun eigen toegang erbovenop (subsidie_zichtbaar_voor_tier ongewijzigd).
-- Reeds toegepast op de live database (migratie "deadlines_eerste_vijf_altijd_zichtbaar").
do $$
declare
  v_def text;
  v_naam text;
begin
  foreach v_naam in array array['subsidieregelingen_deadlines', 'funder_deadlines']
  loop
    v_def := pg_get_viewdef(('public.' || v_naam)::regclass, true);

    if position('<= 3' in v_def) = 0 then
      raise exception 'view % bevat geen "<= 3"; niets aangepast', v_naam;
    end if;

    v_def := replace(v_def, '<= 3', '<= 5');
    execute format('create or replace view public.%I as %s', v_naam, v_def);
  end loop;
end
$$;
