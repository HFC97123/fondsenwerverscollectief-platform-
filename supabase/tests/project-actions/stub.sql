create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
grant usage on schema public to public;
create schema auth; 
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon, service_role; grant execute on function auth.uid() to authenticated;
create table public.subsidie_kompas_programs (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), naam text, constraint p_id_user unique (id, user_id));
grant select on public.subsidie_kompas_programs to authenticated;
create table public.funders (id uuid primary key default gen_random_uuid());
create table public.subsidieregelingen (id uuid primary key default gen_random_uuid());
create table public.subsidie_kompas_program_funding (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  program_id uuid not null, scheme_id uuid null, funder_id uuid null, financier_naam text null, status text not null default 'interesting',
  constraint f_program_fkey foreign key (program_id, user_id) references public.subsidie_kompas_programs (id, user_id) on delete cascade);
grant all on public.subsidie_kompas_program_funding to service_role;
grant select, delete on public.subsidie_kompas_program_funding to authenticated;
alter table public.subsidie_kompas_program_funding enable row level security;
create policy r on public.subsidie_kompas_program_funding for select to authenticated using ((select auth.uid()) = user_id);
create policy d on public.subsidie_kompas_program_funding for delete to authenticated using ((select auth.uid()) = user_id);
