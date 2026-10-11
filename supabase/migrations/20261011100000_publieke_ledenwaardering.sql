-- Gemiddelde ledenwaardering voor de statistiektegel op de homepage.
--
-- publieke_ledenreviews() geeft maximaal 5 rijen terug en kan daarom geen
-- gemiddelde over alle waarderingen leveren. Deze kleine aanvulling rekent het
-- gemiddelde in de database uit, over exact dezelfde populatie als de bestaande
-- publieke weergave: is_approved, is_public en een goedgekeurd lid
-- (profiles.role = 'member', status = 'approved').
--
-- Geeft altijd één rij met uitsluitend twee getallen (gemiddelde, aantal);
-- geen rijen, profile_id's of andere persoonsgegevens. Zonder geldige
-- waarderingen is gemiddelde NULL en aantal 0. Het gemiddelde is niet afgerond;
-- de weergave (één decimaal, komma) gebeurt in de frontend.
--
-- Wijzigt geen tabel, geen data, geen RLS en geen bestaande functie.

create or replace function public.publieke_ledenwaardering()
returns table (
  gemiddelde numeric,
  aantal     integer
)
language sql
stable
security definer
set search_path = public
as $$
  select avg(r.rating)::numeric,
         count(r.rating)::integer
    from public.member_reviews r
    join public.profiles p
      on p.id = r.profile_id
     and p.role = 'member'
     and p.status = 'approved'
   where r.is_approved
     and r.is_public
     and r.rating is not null
     and r.rating >= 1
     and r.rating <= 5;
$$;

comment on function public.publieke_ledenwaardering() is
  'Gemiddelde en aantal van de goedgekeurde, publieke ledenwaarderingen (zelfde populatie als publieke_ledenreviews). Alleen twee getallen; voor de homepage-statistiektegel.';

revoke all on function public.publieke_ledenwaardering() from public, anon, authenticated, service_role;
grant execute on function public.publieke_ledenwaardering() to anon, authenticated;
