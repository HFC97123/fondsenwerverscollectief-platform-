-- Nieuwe, privé Storage-bucket voor organisatieprofiel-documenten (fase 3:
-- documenten uploaden en laten uitlezen). Bestandspad-conventie:
-- {user_id}/{timestamp}-{bestandsnaam}, zodat de RLS-policies hieronder de
-- eerste mapnaam als eigenaarscheck kunnen gebruiken (hetzelfde patroon als
-- Supabase's eigen voorbeelden; er was geen bestaand policy-patroon voor een
-- per-gebruiker privé bucket in dit project om op aan te sluiten — de drie
-- bestaande privé buckets (images, course-files, course-videos) zijn alleen
-- voor beheerders, en subsidie-kompas-generated/-templates hebben helemaal
-- geen policy op storage.objects, dus worden kennelijk alleen server-side
-- (service role) benaderd).
insert into storage.buckets (id, name, public)
values ('subsidie-kompas-organisatie-docs', 'subsidie-kompas-organisatie-docs', false)
on conflict (id) do nothing;

create policy "Leden beheren eigen organisatiedocumenten"
on storage.objects
for all
using (
  bucket_id = 'subsidie-kompas-organisatie-docs'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'subsidie-kompas-organisatie-docs'
  and (storage.foldername(name))[1] = auth.uid()::text
);
