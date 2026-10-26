-- 26-10-2026 (op verzoek HFC): dubbel record 'Stichting gezondheidszorg Spaarneland' samengevoegd in 'Fonds SGS' (naam Fonds SGS blijft). Backup in backup_verwijderd_20261017.
insert into public.backup_verwijderd_20261017 (tabel,id,data) select 'funders', f.id, to_jsonb(f) || jsonb_build_object('samengevoegd_in','8b480bc5-7fa8-4607-a96e-1841a0b020fd','datum','2026-10-26') from public.funders f where f.id='3ed855c7-982f-4a95-8ded-0be0d676b7a8';
update public.funders s set
  website = coalesce(nullif(s.website,''), o.website),
  bijdrage_min = coalesce(s.bijdrage_min, o.bijdrage_min),
  bijdrage_max = coalesce(s.bijdrage_max, o.bijdrage_max),
  bijdrage_toelichting = coalesce(nullif(s.bijdrage_toelichting,''), o.bijdrage_toelichting),
  deadlines = coalesce(nullif(s.deadlines,''), o.deadlines),
  bandbreedte_bijdrage_id = coalesce(s.bandbreedte_bijdrage_id, o.bandbreedte_bijdrage_id),
  enrichment_status = 'compleet',
  bron = concat_ws(' | ', nullif(s.bron,''), nullif(o.bron,'')),
  research_source = concat_ws(' | ', nullif(o.research_source,''), nullif(s.research_source,''), 'Samengevoegd met dubbel record Stichting gezondheidszorg Spaarneland, 26-10-2026 (Claude)'),
  updated_at = now()
from public.funders o where s.id='8b480bc5-7fa8-4607-a96e-1841a0b020fd' and o.id='3ed855c7-982f-4a95-8ded-0be0d676b7a8';
update public.funder_notes set funder_id='8b480bc5-7fa8-4607-a96e-1841a0b020fd' where funder_id='3ed855c7-982f-4a95-8ded-0be0d676b7a8';
insert into public.funder_themas (funder_id, thema_id) select '8b480bc5-7fa8-4607-a96e-1841a0b020fd', thema_id from public.funder_themas where funder_id='3ed855c7-982f-4a95-8ded-0be0d676b7a8' on conflict do nothing;
delete from public.funders where id='3ed855c7-982f-4a95-8ded-0be0d676b7a8' and not exists (select 1 from public.subsidieregelingen where funder_id='3ed855c7-982f-4a95-8ded-0be0d676b7a8');
