-- Ledenlijst op de Collectief-pagina (alleen voor ingelogde, goedgekeurde leden).
--
-- * profiles krijgt: website, profiel_zichtbaar (staat het lid in de ledenlijst?) en
--   email_zichtbaar (mogen andere leden het e-mailadres zien?). Beide standaard UIT:
--   een lid kiest zelf of het zichtbaar wil zijn.
-- * Organisatie en functie blijven in profile_onboarding (zelfde velden als bij aanmelden
--   en op de accountpagina van Subsidie Kompas).
-- * Schrijven: zet_mijn_ledengegevens (alleen de eigen rij, alleen deze drie kolommen).
-- * Lezen: ledenlijst() geeft alleen leden die zichtbaar willen zijn, en alleen aan
--   goedgekeurde leden. Het e-mailadres alleen als dat lid het zelf aanzet.
-- * Profielfoto's: extra leesregel in storage, uitsluitend voor de huidige foto van een
--   zichtbaar lid, en uitsluitend voor goedgekeurde leden.

alter table public.profiles add column if not exists website text;
alter table public.profiles add column if not exists profiel_zichtbaar boolean not null default false;
alter table public.profiles add column if not exists email_zichtbaar boolean not null default false;

create or replace function public.zet_mijn_ledengegevens(p_website text, p_profiel_zichtbaar boolean, p_email_zichtbaar boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_site text := nullif(btrim(coalesce(p_website, '')), '');
begin
  if v_uid is null then
    raise exception 'Niet ingelogd' using errcode = '28000';
  end if;

  if v_site is not null then
    if v_site !~* '^https?://' then
      v_site := 'https://' || v_site;
    end if;

    if char_length(v_site) > 200 or v_site !~* '^https?://[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(:[0-9]{1,5})?(/[^[:space:]]*)?$' then
      raise exception 'Vul een geldig webadres in, bijvoorbeeld www.mijnwebsite.nl' using errcode = '22023';
    end if;
  end if;

  update public.profiles
     set website = v_site,
         profiel_zichtbaar = coalesce(p_profiel_zichtbaar, false),
         email_zichtbaar = coalesce(p_email_zichtbaar, false)
   where id = v_uid and status = 'approved';

  if not found then
    raise exception 'Profiel niet gevonden of nog niet goedgekeurd' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.ledenlijst()
returns table (
  id uuid,
  naam text,
  rol text,
  member_type text,
  avatar_path text,
  bio text,
  organisatie text,
  functie text,
  website text,
  email text
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null
     or not exists (select 1 from public.profiles me where me.id = auth.uid() and me.status = 'approved') then
    raise exception 'Alleen voor leden' using errcode = '42501';
  end if;

  return query
    select p.id,
           btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')),
           p.role,
           p.member_type,
           p.avatar_path,
           p.bio,
           o.organisatie,
           o.functie,
           p.website,
           case when p.email_zichtbaar then p.email else null end
      from public.profiles p
      left join public.profile_onboarding o on o.user_id = p.id
     where p.status = 'approved'
       and p.profiel_zichtbaar
     order by lower(coalesce(p.first_name, '')), lower(coalesce(p.last_name, ''));
end;
$$;

create or replace function private.mag_profielfoto_zien(p_naam text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select auth.uid() is not null
     and exists (select 1 from public.profiles me where me.id = auth.uid() and me.status = 'approved')
     and exists (
       select 1 from public.profiles p
        where p.avatar_path = p_naam and p.status = 'approved' and p.profiel_zichtbaar
     );
$$;

drop policy if exists "Leden zien profielfoto's van zichtbare leden" on storage.objects;
create policy "Leden zien profielfoto's van zichtbare leden"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'profile-images' and (select private.mag_profielfoto_zien(name)));

revoke all on function public.zet_mijn_ledengegevens(text, boolean, boolean) from public, anon;
revoke all on function public.ledenlijst() from public, anon;
revoke all on function private.mag_profielfoto_zien(text) from public, anon;
grant execute on function public.zet_mijn_ledengegevens(text, boolean, boolean) to authenticated;
grant execute on function public.ledenlijst() to authenticated;
grant execute on function private.mag_profielfoto_zien(text) to authenticated;
