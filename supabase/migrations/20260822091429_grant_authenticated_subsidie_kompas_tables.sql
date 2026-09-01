-- Doel: herstel de ontbrekende Postgres GRANT-rechten voor de rol
-- `authenticated` op de subsidie_kompas_*-tabellen. RLS-policies op deze
-- tabellen zijn al correct (elke policy beperkt tot auth.uid() = user_id),
-- maar zonder de onderliggende GRANT wijst Postgres het verzoek al af
-- vóórdat RLS wordt geëvalueerd ("permission denied for table ..."),
-- wat de organisatiegeheugen-functionaliteit van de chatbot volledig
-- blokkeerde (conversaties/berichten/organisaties konden niet worden
-- gelezen of geschreven door ingelogde gebruikers).
--
-- Risico: laag. Dit voegt geen nieuwe toegang toe die de bestaande
-- RLS-policies niet al toestaan — het maakt alleen mogelijk dat die
-- policies daadwerkelijk worden geëvalueerd. `anon` blijft bewust
-- ongewijzigd (deze functionaliteit vereist inloggen).
-- Rollback: REVOKE SELECT, INSERT, UPDATE, DELETE ON <tabel> FROM authenticated;

grant select, insert, update, delete on public.subsidie_kompas_conversations to authenticated;
grant select, insert, update, delete on public.subsidie_kompas_messages to authenticated;
grant select, insert, update, delete on public.subsidie_kompas_organizations to authenticated;
grant select, insert, update, delete on public.subsidie_kompas_organization_profiles to authenticated;
grant select, insert, update, delete on public.subsidie_kompas_programs to authenticated;
grant select, insert, update, delete on public.subsidie_kompas_work_areas to authenticated;
grant select, insert, update, delete on public.subsidie_kompas_website_sources to authenticated;
grant select, insert, update, delete on public.subsidie_kompas_knowledge_items to authenticated;
