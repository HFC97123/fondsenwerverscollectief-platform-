-- Beheertabellen voor de publieke contentomgeving van Het Fondsenwervers
-- Collectief: video's, templates/praktijkgidsen (resources), agenda (sessions)
-- en blog/kennisdeling (blog_posts).
--
-- De beheeromgeving (src/data/collections.js + AdminPage.jsx) kent deze
-- tabellen al en verwacht exact deze kolommen; de website leest ze via
-- loadContent() met .eq('status','published'). Tot nu toe bestonden de tabellen
-- niet in productie. Deze migratie voegt ze toe.
--
-- Wat deze migratie WEL doet
--   * 4 nieuwe tabellen, uuid-id's (zelfde stijl als news_articles).
--   * status 'draft' | 'published' (check-constraint), standaard 'draft'.
--   * RLS aan. Bezoekers (anon + ingelogd): alleen SELECT op status =
--     'published'. Schrijven (INSERT/UPDATE/DELETE) en het lezen van concepten:
--     uitsluitend beheerders via (select private.is_admin()) - hetzelfde
--     patroon als public.member_reviews.
--   * Expliciete GRANTs: anon alleen SELECT; authenticated SELECT/INSERT/UPDATE/
--     DELETE (RLS bepaalt wat mag). Geen TRUNCATE/REFERENCES/TRIGGER.
--   * Trigger (public.beheer_inhoud_set_publicatie): zet updated_at; vult
--     published_at alleen als die leeg is (blijft behouden bij bewerken van een
--     gepubliceerd item); leegt published_at bij status 'draft'.
--   * Indexen voor de publieke sortering.
--
-- Wat deze migratie NIET doet
--   * Geen seed- of demodata. Geen bestaande tabellen of records gewijzigd.
--   * Raakt news_articles, vacancies en alle Subsidiekompas-tabellen niet aan.
--   * Maakt geen storage-bucket aan.

-- 1. Gedeelde triggerfunctie ----------------------------------------------------
create or replace function public.beheer_inhoud_set_publicatie()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();

  if new.status = 'published' then
    if tg_op = 'UPDATE' and old.status = 'published' and old.published_at is not null then
      new.published_at := old.published_at;
    else
      new.published_at := coalesce(new.published_at, now());
    end if;
  else
    new.published_at := null;
  end if;

  return new;
end;
$$;

revoke all on function public.beheer_inhoud_set_publicatie() from public, anon, authenticated;

-- 2. Tabellen ------------------------------------------------------------------
create table if not exists public.videos (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(btrim(title)) > 0),
  description  text,
  duration     text,
  level        text,
  url          text,
  sort_order   integer not null default 0,
  status       text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.resources (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(btrim(title)) > 0),
  type         text,
  format       text,
  description  text,
  file_url     text,
  sort_order   integer not null default 0,
  status       text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.sessions (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(btrim(title)) > 0),
  session_date date not null,
  session_time text,
  host         text,
  mode         text,
  signup_url   text,
  status       text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.blog_posts (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(btrim(title)) > 0),
  tag          text,
  excerpt      text,
  content      text,
  author       text,
  author_role  text,
  status       text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.videos     is 'Video''s voor de oriëntatiepagina; beheerd via de adminomgeving. Publiek alleen status = published.';
comment on table public.resources  is 'Templates/praktijkgidsen/tools voor het ledengedeelte; beheerd via de adminomgeving. Publiek alleen status = published.';
comment on table public.sessions   is 'Agenda/bijeenkomsten; beheerd via de adminomgeving. Publiek alleen status = published.';
comment on table public.blog_posts is 'Blog/kennisdeling; beheerd via de adminomgeving. Publiek alleen status = published.';

-- 3. Triggers ------------------------------------------------------------------
drop trigger if exists videos_set_publicatie on public.videos;
create trigger videos_set_publicatie
  before insert or update on public.videos
  for each row execute function public.beheer_inhoud_set_publicatie();

drop trigger if exists resources_set_publicatie on public.resources;
create trigger resources_set_publicatie
  before insert or update on public.resources
  for each row execute function public.beheer_inhoud_set_publicatie();

drop trigger if exists sessions_set_publicatie on public.sessions;
create trigger sessions_set_publicatie
  before insert or update on public.sessions
  for each row execute function public.beheer_inhoud_set_publicatie();

drop trigger if exists blog_posts_set_publicatie on public.blog_posts;
create trigger blog_posts_set_publicatie
  before insert or update on public.blog_posts
  for each row execute function public.beheer_inhoud_set_publicatie();

-- 4. Indexen (publieke sortering) -----------------------------------------------
create index if not exists videos_status_sort_idx     on public.videos (status, sort_order, published_at desc);
create index if not exists resources_status_sort_idx  on public.resources (status, sort_order, title);
create index if not exists sessions_status_datum_idx  on public.sessions (status, session_date, session_time);
create index if not exists blog_posts_status_pub_idx  on public.blog_posts (status, published_at desc);

-- 5. Rechten en RLS ---------------------------------------------------------------
alter table public.videos     enable row level security;
alter table public.resources  enable row level security;
alter table public.sessions   enable row level security;
alter table public.blog_posts enable row level security;

revoke all on table public.videos, public.resources, public.sessions, public.blog_posts
  from anon, authenticated;
grant select on table public.videos, public.resources, public.sessions, public.blog_posts to anon;
grant select, insert, update, delete
  on table public.videos, public.resources, public.sessions, public.blog_posts to authenticated;

-- videos
drop policy if exists "Iedereen leest gepubliceerde videos" on public.videos;
create policy "Iedereen leest gepubliceerde videos"
  on public.videos for select to anon, authenticated
  using (status = 'published');
drop policy if exists "Admins beheren videos" on public.videos;
create policy "Admins beheren videos"
  on public.videos for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- resources
drop policy if exists "Iedereen leest gepubliceerde resources" on public.resources;
create policy "Iedereen leest gepubliceerde resources"
  on public.resources for select to anon, authenticated
  using (status = 'published');
drop policy if exists "Admins beheren resources" on public.resources;
create policy "Admins beheren resources"
  on public.resources for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- sessions
drop policy if exists "Iedereen leest gepubliceerde sessies" on public.sessions;
create policy "Iedereen leest gepubliceerde sessies"
  on public.sessions for select to anon, authenticated
  using (status = 'published');
drop policy if exists "Admins beheren sessies" on public.sessions;
create policy "Admins beheren sessies"
  on public.sessions for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- blog_posts
drop policy if exists "Iedereen leest gepubliceerde blogposts" on public.blog_posts;
create policy "Iedereen leest gepubliceerde blogposts"
  on public.blog_posts for select to anon, authenticated
  using (status = 'published');
drop policy if exists "Admins beheren blogposts" on public.blog_posts;
create policy "Admins beheren blogposts"
  on public.blog_posts for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
