-- Project-niveau: schrijfvoorkeur, planning, herkomst per veld, archivering
alter table public.subsidie_kompas_programs
  add column if not exists writing_preferences text,
  add column if not exists planning text,
  add column if not exists field_sources jsonb not null default '{}'::jsonb,
  add column if not exists archived_at timestamptz;

-- Document-niveau: type, versie, documentspecifieke context (fonds, instructies), vervanging
alter table public.subsidie_kompas_knowledge_items
  add column if not exists doc_type text,
  add column if not exists version integer not null default 1,
  add column if not exists document_context jsonb not null default '{}'::jsonb,
  add column if not exists superseded_at timestamptz;

create index if not exists subsidie_kompas_knowledge_items_program_idx
  on public.subsidie_kompas_knowledge_items (program_id, doc_type, version);
create index if not exists subsidie_kompas_messages_program_idx
  on public.subsidie_kompas_messages (program_id);

-- Referentiele integriteit: project-documenten en project-websitebronnen verdwijnen mee met het project
-- (geen wezen). Gesprekken en berichten blijven bestaan; hun projectkoppeling wordt NULL (SET NULL blijft).
alter table public.subsidie_kompas_knowledge_items
  drop constraint if exists subsidie_kompas_knowledge_items_program_id_fkey,
  add constraint subsidie_kompas_knowledge_items_program_id_fkey
    foreign key (program_id) references public.subsidie_kompas_programs(id) on delete cascade;
alter table public.subsidie_kompas_website_sources
  drop constraint if exists subsidie_kompas_website_sources_program_id_fkey,
  add constraint subsidie_kompas_website_sources_program_id_fkey
    foreign key (program_id) references public.subsidie_kompas_programs(id) on delete cascade;
