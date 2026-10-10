-- Ledenwaarderingen (ratings/reviews) voor de homepage van Het Fondsenwervers
-- Collectief.
--
-- Structuur:
--   * public.member_reviews: één waardering per lid (profile_id uniek).
--     rating 1,0 - 5,0; review_text optioneel; display_name/display_role zijn
--     UITSLUITEND bedoeld voor publieke weergave en blijven leeg tot er
--     toestemming is om ze te tonen. Nieuwe rijen zijn standaard NIET
--     goedgekeurd en NIET publiek.
--   * RLS aan, geen enkele policy voor bezoekers/leden; alleen admins
--     (private.is_admin(), zelfde patroon als public.profiles) en de
--     service role/dashboard kunnen rijen lezen en beheren.
--   * public.publieke_ledenreviews(p_limit): SECURITY DEFINER, zelfde patroon
--     als publieke_leden_telling(). Geeft maximaal 5 goedgekeurde, publieke
--     waarderingen terug, uitsluitend rating, reviewtekst, weergavenaam en
--     -functie. Geen profile_id, e-mailadres of overige profielgegevens.
--
-- Deze migratie voegt GEEN waarderingen toe (geen automatische 5.0 voor
-- nieuwe leden en ook geen backfill).

create table if not exists public.member_reviews (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  rating       numeric(2,1) not null check (rating >= 1.0 and rating <= 5.0),
  review_text  text check (review_text is null or char_length(review_text) <= 600),
  display_name text check (display_name is null or char_length(display_name) <= 80),
  display_role text check (display_role is null or char_length(display_role) <= 120),
  is_approved  boolean not null default false,
  is_public    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint member_reviews_profile_uniek unique (profile_id)
);

comment on table public.member_reviews is
  'Waardering (rating, optioneel reviewtekst) per lid. Publiek zichtbaar alleen als is_approved én is_public, via publieke_ledenreviews().';

create or replace function public.member_reviews_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists member_reviews_set_updated_at on public.member_reviews;
create trigger member_reviews_set_updated_at
  before update on public.member_reviews
  for each row execute function public.member_reviews_set_updated_at();

alter table public.member_reviews enable row level security;

revoke all on table public.member_reviews from anon, authenticated;
grant select, insert, update, delete on table public.member_reviews to authenticated;

drop policy if exists "Admins beheren ledenreviews" on public.member_reviews;
create policy "Admins beheren ledenreviews"
  on public.member_reviews
  for all
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create or replace function public.publieke_ledenreviews(p_limit integer default 5)
returns table (
  rating       numeric,
  review_text  text,
  display_name text,
  display_role text
)
language sql
stable
security definer
set search_path = public
as $$
  select r.rating, r.review_text, r.display_name, r.display_role
    from public.member_reviews r
    join public.profiles p
      on p.id = r.profile_id
     and p.role = 'member'
     and p.status = 'approved'
   where r.is_approved
     and r.is_public
   order by (r.review_text is not null and r.review_text <> '') desc,
            r.created_at desc,
            r.id
   limit least(greatest(coalesce(p_limit, 5), 1), 5);
$$;

comment on function public.publieke_ledenreviews(integer) is
  'Maximaal 5 goedgekeurde, publieke ledenwaarderingen (rating, tekst, weergavenaam/-functie). Geen profile_id, e-mail of andere profielgegevens. Voor de homepage.';

revoke all on function public.publieke_ledenreviews(integer) from public, anon, authenticated, service_role;
grant execute on function public.publieke_ledenreviews(integer) to anon, authenticated;
