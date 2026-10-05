-- Beveiligingsfix: de drie tier-RPC's mogen alleen door de vertrouwde Edge
-- Function (service_role) worden aangeroepen.
--
-- Probleem (bewezen met een terugdraaibare test, 2026-10-05):
--   kompas_subsidieregelingen_voor_tier(p_tier), kompas_funders_voor_tier(p_tier)
--   en kompas_funder_deadlines_voor_tier(p_tier) zijn SECURITY DEFINER en
--   nemen de tier als parameter van de aanroeper over. Ze waren uitvoerbaar
--   door anon en authenticated (de eerste via expliciete grants, de andere
--   twee via de standaard PUBLIC-EXECUTE). Een niet-ingelogde bezoeker of een
--   Free-gebruiker kon zo met p_tier = 'premium' de volledige Premium-
--   kandidaatpool opvragen (o.a. 174 regelingen waarvan 110 met
--   access_tier = 'premium', en 300 funders), buiten RLS en de
--   zichtbaarheidsregels om.
--
-- Oplossing: uitsluitend rechten, geen functiewijziging.
--   - De enige aanroeper in de code is de Edge Function 'subsidie-kompas',
--     via service_role met bewust p_tier = 'premium' om de volledige
--     kandidaatpool voor de server-side matching te krijgen. Die route blijft
--     ongewijzigd werken (service_role houdt EXECUTE).
--   - Er is geen client-aanroeper (geen frontend-code, view, policy of
--     andere functie gebruikt deze RPC's).
--   - Zichtbaarheid per tier voor leden loopt via de views/RLS die op
--     auth.uid() (current_user_has_*_access) leunen en wordt niet geraakt.

revoke all on function public.kompas_subsidieregelingen_voor_tier(text) from public, anon, authenticated;
revoke all on function public.kompas_funders_voor_tier(text) from public, anon, authenticated;
revoke all on function public.kompas_funder_deadlines_voor_tier(text) from public, anon, authenticated;

grant execute on function public.kompas_subsidieregelingen_voor_tier(text) to service_role;
grant execute on function public.kompas_funders_voor_tier(text) to service_role;
grant execute on function public.kompas_funder_deadlines_voor_tier(text) to service_role;
