-- Herstelbare momentopname van classification_reviewed vóór de beoordelingsronde op basis van werkbestand V5 (17-10-2026).
create table if not exists public.snapshot_beoordeling_20261017 (tabel text not null, id uuid not null, classification_reviewed boolean, access_tier text, gemaakt_op timestamptz not null default now(), primary key (tabel, id));
alter table public.snapshot_beoordeling_20261017 enable row level security;
revoke all on public.snapshot_beoordeling_20261017 from anon, authenticated;
insert into public.snapshot_beoordeling_20261017 (tabel, id, classification_reviewed, access_tier)
select 'funders', id, classification_reviewed, access_tier::text from public.funders
union all select 'subsidieregelingen', id, classification_reviewed, access_tier::text from public.subsidieregelingen
on conflict do nothing;
-- Terugzetten indien nodig:
-- update public.funders f set classification_reviewed = s.classification_reviewed from public.snapshot_beoordeling_20261017 s where s.tabel='funders' and s.id=f.id;
-- update public.subsidieregelingen r set classification_reviewed = s.classification_reviewed from public.snapshot_beoordeling_20261017 s where s.tabel='subsidieregelingen' and s.id=r.id;
