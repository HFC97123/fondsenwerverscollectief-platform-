-- Veilige, geaggregeerde telling van aangesloten fondsenwervers voor de live
-- teller op de homepage van Het Fondsenwervers Collectief.
-- Geeft uitsluitend één getal terug (geen rijen, geen profielgegevens).
-- Definitie van een aangesloten lid, gelijk aan de rest van de app
-- (AuthProvider.isGoedgekeurd, AdminAnalytics): role = 'member' en
-- status = 'approved'. approved_at is bewust GEEN criterium: accounts met
-- directe toegang krijgen die waarde niet.
-- Bezoekers (anon) mogen public.profiles niet lezen (RLS); deze SECURITY
-- DEFINER-functie is daarom de enige manier om het totaal veilig te publiceren.
create or replace function public.publieke_leden_telling()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint
    from public.profiles
   where role = 'member'
     and status = 'approved';
$$;

comment on function public.publieke_leden_telling() is
  'Totaal aantal aangesloten leden (role = member, status = approved); alleen een getal, geen profielgegevens. Voor de live teller op de homepage.';

revoke all on function public.publieke_leden_telling() from public, anon, authenticated, service_role;
grant execute on function public.publieke_leden_telling() to anon, authenticated;
