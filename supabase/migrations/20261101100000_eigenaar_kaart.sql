-- De eigenaar van het Collectief staat altijd zichtbaar op de Collectief-pagina, ook voor bezoekers die niet inloggen (opdracht Aisya, 1-11-2026).
-- Eigenaar = het oudste goedgekeurde beheerdersprofiel. Alleen naam, foto, beschrijving, website, organisatie en functie worden gedeeld; geen e-mailadres.
-- Terugdraaien: drop policy "Iedereen ziet de foto van de eigenaar" on storage.objects;
--               drop function public.collectief_eigenaar(); drop function public.is_eigenaar_foto(text);

create or replace function public.collectief_eigenaar()
returns table (naam text, avatar_path text, bio text, website text, organisatie text, functie text)
language sql stable security definer set search_path to 'public' as $$
  select btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), p.avatar_path, p.bio, p.website, o.organisatie, o.functie
    from public.profiles p
    left join public.profile_onboarding o on o.user_id = p.id
   where p.role = 'admin' and p.status = 'approved'
   order by p.created_at
   limit 1;
$$;

-- Alleen de foto van de eigenaar mag ook zonder inloggen worden gezien.
create or replace function public.is_eigenaar_foto(p_naam text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select p_naam is not null and p_naam = (
    select p.avatar_path from public.profiles p where p.role = 'admin' and p.status = 'approved' order by p.created_at limit 1
  );
$$;

drop policy if exists "Iedereen ziet de foto van de eigenaar" on storage.objects;
create policy "Iedereen ziet de foto van de eigenaar"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'profile-images' and public.is_eigenaar_foto(name));

revoke all on function public.collectief_eigenaar() from public;
revoke all on function public.is_eigenaar_foto(text) from public;
grant execute on function public.collectief_eigenaar() to anon, authenticated;
grant execute on function public.is_eigenaar_foto(text) to anon, authenticated;
