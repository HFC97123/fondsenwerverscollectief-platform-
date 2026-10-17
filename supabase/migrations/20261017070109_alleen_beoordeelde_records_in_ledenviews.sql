-- Onbeoordeelde fondsen/regelingen nooit zichtbaar voor leden via de oude directe views (ongeacht abonnement). Beheer blijft alles zien.
create or replace view public.funders_premium with (security_invoker=false) as
 SELECT f.id, f.naam, f.type, f.missie, f.bijdrage_min, f.bijdrage_max, f.jaarbudget, f.deadlines,
    CASE WHEN f.contactpersoon_prive AND NOT current_user_is_admin() THEN NULL::text ELSE f.contactpersoon END AS contactpersoon,
    CASE WHEN f.email_prive AND NOT current_user_is_admin() THEN NULL::text ELSE f.email END AS email,
    CASE WHEN f.telefoon_prive AND NOT current_user_is_admin() THEN NULL::text ELSE f.telefoon END AS telefoon,
    f.adres, f.website, f.status, f.enrichment_status, f.last_researched_at,
    COALESCE(array_agg(DISTINCT t.naam) FILTER (WHERE t.naam IS NOT NULL), '{}'::text[]) AS themas,
    COALESCE(array_agg(DISTINCT r.naam) FILTER (WHERE r.naam IS NOT NULL), '{}'::text[]) AS regios
   FROM funders f
     LEFT JOIN funder_themas ft ON ft.funder_id = f.id LEFT JOIN themas t ON t.id = ft.thema_id
     LEFT JOIN funder_regios fr ON fr.funder_id = f.id LEFT JOIN regios r ON r.id = fr.regio_id
  WHERE current_user_has_premium_access() AND (f.classification_reviewed OR current_user_is_admin())
  GROUP BY f.id;
create or replace view public.funders_teaser with (security_invoker=true) as
 SELECT f.id, f.naam, f.type, f.missie, f.status,
    COALESCE(array_agg(DISTINCT t.naam) FILTER (WHERE t.naam IS NOT NULL), '{}'::text[]) AS themas,
    COALESCE(array_agg(DISTINCT r.naam) FILTER (WHERE r.naam IS NOT NULL), '{}'::text[]) AS regios
   FROM funders f
     LEFT JOIN funder_themas ft ON ft.funder_id = f.id LEFT JOIN themas t ON t.id = ft.thema_id
     LEFT JOIN funder_regios fr ON fr.funder_id = f.id LEFT JOIN regios r ON r.id = fr.regio_id
  WHERE f.classification_reviewed OR current_user_is_admin()
  GROUP BY f.id;
create or replace view public.subsidieregelingen_premium with (security_invoker=false) as
 SELECT id, funder_id, naam, thema, bedrag_min, bedrag_max, deadline, voorwaarden, discovered_by, verified, created_at, updated_at
   FROM subsidieregelingen sr
  WHERE current_user_has_premium_access() AND (sr.classification_reviewed OR current_user_is_admin());
