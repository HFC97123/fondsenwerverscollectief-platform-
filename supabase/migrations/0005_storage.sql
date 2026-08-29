-- Opslagbuckets.
-- media is openbaar (afbeeldingen op de website); de andere twee zijn privé.

insert into storage.buckets (id, name, public)
  values ('media', 'media', true)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('project-documenten', 'project-documenten', false)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('documentatie', 'documentatie', false)
  on conflict (id) do nothing;

-- media: iedereen leest, beheer schrijft.
drop policy if exists "media openbaar lezen" on storage.objects;
create policy "media openbaar lezen" on storage.objects
  for select using (bucket_id = 'media');
drop policy if exists "media beheer schrijft" on storage.objects;
create policy "media beheer schrijft" on storage.objects
  for all using (bucket_id = 'media' and is_admin())
  with check (bucket_id = 'media' and is_admin());

-- Privébuckets: een lid komt alleen bij bestanden in zijn eigen map.
-- Pad: <profile_id>/<bestandsnaam>
drop policy if exists "eigen projectdocumenten" on storage.objects;
create policy "eigen projectdocumenten" on storage.objects
  for all using (
    bucket_id = 'project-documenten'
    and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'project-documenten'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "eigen documentatie" on storage.objects;
create policy "eigen documentatie" on storage.objects
  for all using (
    bucket_id = 'documentatie'
    and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'documentatie'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
