-- De 3 vrije plekken (Free, en na een filter) gaan alleen naar Pro-bronnen, nooit naar een Premium-bron (opdracht Aisya,
-- 28-10-2026). Was: de eerste 3 van alles, zodat Free soms een Premium-regeling volledig zag. Toegepast via apply_migration
-- (vrije_plekken_alleen_pro). Past subsidieregelingen_deadlines, funder_deadlines en deadlines_ontgrendeld aan.
do $$
declare
  v text;
  w text;
  k text;
begin
  v := pg_get_viewdef('public.subsidieregelingen_deadlines'::regclass);
  w := v;
  foreach k in array array['is_dated_upcoming', 'is_doorlopend', 'is_aangekondigd', 'is_binnenkort'] loop
    w := replace(w, format('PARTITION BY b.%s ORDER', k), format('PARTITION BY b.%s, (b.access_tier::text = ''premium''::text) ORDER', k));
  end loop;
  foreach k in array array['doorlopend', 'aangekondigd', 'binnenkort', 'dated'] loop
    w := replace(w, format('(g.is_%s AND (g.vn_%s <= deadlines_vrije_plekken()))', case k when 'dated' then 'dated_upcoming' else k end, k),
                    format('(g.access_tier::text <> ''premium''::text AND g.is_%s AND (g.vn_%s <= deadlines_vrije_plekken()))', case k when 'dated' then 'dated_upcoming' else k end, k));
  end loop;
  execute 'create or replace view public.subsidieregelingen_deadlines as ' || w;

  v := pg_get_viewdef('public.funder_deadlines'::regclass);
  w := replace(v, 'row_number() OVER (ORDER BY b.deadline_datum, b.funder_id) AS vn', 'row_number() OVER (PARTITION BY (b.access_tier::text = ''premium''::text) ORDER BY b.deadline_datum, b.funder_id) AS vn');
  w := replace(w, '((g.vn <= deadlines_vrije_plekken())', '((g.access_tier::text <> ''premium''::text AND g.vn <= deadlines_vrije_plekken())');
  execute 'create or replace view public.funder_deadlines as ' || w;

  v := pg_get_functiondef('public.deadlines_ontgrendeld'::regproc);
  w := replace(v, E'row_number() over (\n        order by', E'row_number() over (\n        partition by (g.access_tier::text = ''premium'')\n        order by');
  w := replace(w, 'where n.vn <= public.deadlines_vrije_plekken()', 'where (n.access_tier::text <> ''premium'' and n.vn <= public.deadlines_vrije_plekken())');
  execute w;
end $$;
