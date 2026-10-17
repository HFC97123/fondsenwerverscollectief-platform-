-- UITGEVOERD 17-10-2026 via execute_sql: 230 rode fondsen verwijderd (back-up in public.backup_verwijderd_20261017).
-- Veiligheidschecks: alleen onbeoordeelde fondsen zonder regelingen en zonder projectkoppeling.
with del as (delete from public.funders f using public.backup_verwijderd_20261017 b where b.tabel='funders' and b.id=f.id and not f.classification_reviewed and not exists (select 1 from public.subsidieregelingen s where s.funder_id=f.id) and not exists (select 1 from public.subsidie_kompas_program_funding p where p.funder_id=f.id) returning f.id)
select count(*) from del;
