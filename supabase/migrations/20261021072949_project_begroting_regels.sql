-- Projectbegroting per regel (Documenten › Begroting). Eén jsonb-kolom op het project: { "versie": 1, "regels": [ ... ] }.
-- Het totaal van de kosten wordt door de app in budget_total gezet (bestaande kolom), zodat matching, dekkingsplan en
-- projectplan niets hoeven te wijzigen. Geen nieuwe tabel, geen nieuwe RLS: de kolom valt onder het bestaande beleid van de tabel.
-- De app leest en schrijft deze kolom alleen als hij bestaat (select *), dus de frontend kan voor of na deze migratie live.
alter table public.subsidie_kompas_programs add column if not exists budget_lines jsonb;
-- Toegepast op het live project op 2026-10-21 (versie 20261021072949).
