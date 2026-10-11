-- Ledenprofiel: eigen profielfoto en beschrijving (bio).
--
-- Uitgangspunt: geen tweede profielentiteit. public.profiles is de bestaande
-- profieltabel. Zij had nog geen beschrijving en geen foto, en leden konden hun
-- eigen rij niet wijzigen (authenticated heeft alleen SELECT; alle writes lopen
-- via SECURITY DEFINER-RPC's, zoals admin_set_status). Dit voegt toe:
--
--   * profiles.bio          vrije professionele beschrijving (max. 1200 tekens);
--                           waar iemand werkt, wat iemand doet, welke thema's,
--                           ervaring enz. Geen losse velden daarvoor.
--   * profiles.avatar_path  pad van de profielfoto in de bucket profile-images
--                           (geen URL, geen base64).
--   * zet_mijn_bio(text) en zet_mijn_avatar(text): het lid kan uitsluitend zijn
--     EIGEN rij en uitsluitend deze twee kolommen wijzigen (auth.uid()); er is
--     geen id-parameter. Geen UPDATE-policy of -grant op profiles erbij, dus
--     role, status en abonnement blijven onbereikbaar voor leden.
--   * Storage-bucket profile-images: PRIVÉ (geen publieke URL's; de foto's
--     worden met een tijdelijke signed URL getoond, dus de bestaande zichtbaar-
--     heid van ledenprofielen verandert niet), max. 5 MB, alleen JPEG/PNG/WebP.
--     Pad: <user_id>/avatar-<tijd>-<willekeur>.<jpg|png|webp>.
--     Policies (alleen authenticated): lid leest/verwijdert alleen eigen map en
--     uploadt alleen in eigen map (en alleen als goedgekeurd lid); admins
--     (private.is_admin()) lezen en verwijderen alles. Er is bewust géén
--     UPDATE-policy: een bestand kan niet overschreven worden, een nieuwe foto
--     is een nieuw bestand.
--
-- Wijzigt geen bestaande data, policy of grant. Geen seed- of demodata.

alter table public.profiles
  add column if not exists bio text constraint profiles_bio_lengte check (bio is null or char_length(bio) <= 1200),
  add column if not exists avatar_path text constraint profiles_avatar_path_lengte check (avatar_path is null or char_length(avatar_path) <= 300);

comment on column public.profiles.bio is 'Vrije professionele beschrijving van het lid (max. 1200 tekens), door het lid zelf te wijzigen via zet_mijn_bio().';
comment on column public.profiles.avatar_path is 'Pad van de profielfoto in de private bucket profile-images (<user_id>/avatar-....), via zet_mijn_avatar().';

create or replace function public.zet_mijn_bio(p_bio text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_bio text := nullif(btrim(coalesce(p_bio, ''), E' \t\r\n'), '');
begin
  if v_uid is null then
    raise exception 'Niet ingelogd' using errcode = '28000';
  end if;

  if v_bio is not null and char_length(v_bio) > 1200 then
    raise exception 'De beschrijving mag maximaal 1200 tekens bevatten' using errcode = '22001';
  end if;

  update public.profiles set bio = v_bio where id = v_uid and status = 'approved';

  if not found then
    raise exception 'Profiel niet gevonden of nog niet goedgekeurd' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.zet_mijn_avatar(p_pad text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pad text := nullif(btrim(coalesce(p_pad, '')), '');
begin
  if v_uid is null then
    raise exception 'Niet ingelogd' using errcode = '28000';
  end if;

  if v_pad is not null then
    if v_pad !~ ('^' || v_uid::text || '/avatar-[0-9]{10,}-[a-z0-9]{4,12}\.(jpg|png|webp)$') then
      raise exception 'Ongeldig pad voor profielfoto' using errcode = '42501';
    end if;

    if not exists (select 1 from storage.objects o where o.bucket_id = 'profile-images' and o.name = v_pad) then
      raise exception 'Profielfoto is niet gevonden in de opslag' using errcode = 'P0002';
    end if;
  end if;

  update public.profiles set avatar_path = v_pad where id = v_uid and status = 'approved';

  if not found then
    raise exception 'Profiel niet gevonden of nog niet goedgekeurd' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.zet_mijn_bio(text), public.zet_mijn_avatar(text) from public, anon, authenticated, service_role;
grant execute on function public.zet_mijn_bio(text), public.zet_mijn_avatar(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-images', 'profile-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "Leden en admins lezen profielfoto's" on storage.objects;
create policy "Leden en admins lezen profielfoto's"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'profile-images'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_admin()))
  );

drop policy if exists "Leden uploaden eigen profielfoto" on storage.objects;
create policy "Leden uploaden eigen profielfoto"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'profile-images'
    and name ~ ('^' || (select auth.uid())::text || '/avatar-[0-9]{10,}-[a-z0-9]{4,12}\.(jpg|png|webp)$')
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.status = 'approved')
  );

drop policy if exists "Leden en admins verwijderen profielfoto's" on storage.objects;
create policy "Leden en admins verwijderen profielfoto's"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'profile-images'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_admin()))
  );
