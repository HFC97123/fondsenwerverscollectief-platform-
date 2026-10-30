-- Samenvoeging per fondsaanvraag (projectplan, begroting en dekkingsplan afgestemd op één fonds) is alleen voor Premium (opdracht Aisya, 30-10-2026).
-- De gewone samenvoeging van het project blijft voor Pro en Premium. Een samenvoeging met een fonds erin ('fonds' in de inhoud) vraagt Premium.
-- Terugdraaien: zet de policy terug op: with check (user_id = (select auth.uid()) and public.current_user_has_pro_access())
drop policy if exists "Pro en Premium maken eigen definitieve documenten" on public.subsidie_kompas_definitieve_documenten;
create policy "Pro en Premium maken eigen definitieve documenten" on public.subsidie_kompas_definitieve_documenten
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.current_user_has_pro_access()
    and (not (soort = 'samengevoegd' and inhoud ? 'fonds') or public.current_user_has_premium_access())
  );
