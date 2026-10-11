-- Fase 1 van het organisatiegeheugen (Pro/Premium): bouwt voort op de al
-- bestaande, maar tot nu toe volledig ongebruikte tabel subsidie_kompas_organizations
-- (RLS en GRANT stonden al goed, zie migratie 20260822091429).
--
-- 1) Ontbrekende velden uit het gevraagde "Organisatie"-tabblad toevoegen.
-- 2) Een aparte herkomsttabel: per veld vastleggen of de waarde handmatig,
--    via de website, via een document, of tijdens een gesprek is verkregen
--    (transparantie-eis). Een aparte tabel i.p.v. een kolom per veld, zodat
--    nieuwe velden er later zonder schema-wijziging bij kunnen.
-- 3) subsidie_kompas_organization_profiles laten vervallen: 0 rijen, geen
--    enkele koppeling vanuit programs/work_areas/knowledge_items/website_sources
--    (die wijzen allemaal naar organizations), en nergens in de app gebruikt.
--    Rollback: de kolommen stonden hierboven; de tabel zelf is niet meer
--    terug te halen na deze migratie behalve via een puntherstel van Supabase.

alter table public.subsidie_kompas_organizations
  add column if not exists working_area text,
  add column if not exists province text,
  add column if not exists annual_revenue numeric,
  add column if not exists staff_count integer,
  add column if not exists volunteer_count integer,
  add column if not exists contact_persons jsonb not null default '[]'::jsonb,
  add column if not exists social_media jsonb not null default '[]'::jsonb,
  add column if not exists financing_mix text;

create table if not exists public.subsidie_kompas_organization_field_sources (
  user_id uuid not null,
  organization_id uuid not null references public.subsidie_kompas_organizations(id) on delete cascade,
  field_name text not null,
  source_type text not null check (source_type in ('handmatig', 'website', 'document', 'gesprek')),
  source_ref text,
  updated_at timestamptz not null default now(),
  primary key (organization_id, field_name)
);

alter table public.subsidie_kompas_organization_field_sources enable row level security;

create policy "Users read own field sources" on public.subsidie_kompas_organization_field_sources
  for select using ((select auth.uid()) = user_id);
create policy "Users create own field sources" on public.subsidie_kompas_organization_field_sources
  for insert with check ((select auth.uid()) = user_id);
create policy "Users update own field sources" on public.subsidie_kompas_organization_field_sources
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own field sources" on public.subsidie_kompas_organization_field_sources
  for delete using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.subsidie_kompas_organization_field_sources to authenticated;

drop table if exists public.subsidie_kompas_organization_profiles;
