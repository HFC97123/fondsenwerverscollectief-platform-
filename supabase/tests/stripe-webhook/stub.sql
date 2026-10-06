do $$ begin if not exists (select 1 from pg_roles where rolname=$q$anon$q$) then create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; end if; end $$;
create schema auth; create schema private;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create function private.is_admin() returns boolean language plpgsql stable security definer as $$ begin return exists(select 1 from public.profiles where id=auth.uid() and role='admin'); end $$;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 first_name text, last_name text, email text, member_type text, motivation text,
 status text not null default 'pending', created_at timestamptz not null default now(),
 approved_at timestamptz, approved_by text,
 role text not null default 'member' check (role in ('member','admin')),
 subscription_tier text default 'free', subscription_active boolean default false,
 trial_started_at timestamptz, trial_ends_at timestamptz,
 stripe_customer_id text, stripe_subscription_id text,
 subscription_started_at timestamptz, subscription_ends_at timestamptz,
 subscription_status text, subscription_current_period_end timestamptz,
 subscription_cancel_at_period_end boolean not null default false);
grant usage on schema public, private, auth to anon, authenticated, service_role;
grant select on public.profiles to authenticated; grant all on public.profiles to service_role;
grant execute on function private.is_admin() to authenticated;
