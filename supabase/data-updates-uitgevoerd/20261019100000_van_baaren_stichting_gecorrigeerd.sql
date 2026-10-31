-- 19-10-2026: Van Baaren Stichting (Utrecht) gecorrigeerd op basis van vanbaarenstichting.nl en opgave HFC.
-- Bestaande classificatie (kunst/erfgoed) klopte niet met de officiële doelstelling (maatschappelijke initiatieven voor ouderen, jeugd en kansarmen; gezondheid en armoede).
update public.funders set
  website = 'https://vanbaarenstichting.nl/',
  plaats = 'Utrecht',
  missie = 'Ontwikkelen en ondersteunen van maatschappelijke initiatieven voor ouderen, jeugd en kansarmen, met nadruk op hulp bij gezondheid en armoede.',
  algemene_beschrijving = 'De Van Baaren Stichting is een lokaal fonds in Utrecht, in 1956 opgericht door Lambertus en Josephina van Baaren. De stichting ontwikkelt en ondersteunt maatschappelijke en maatschappelijk-culturele initiatieven in Utrecht voor ouderen, jeugd en kansarmen. Het accent ligt op hulp bij gezondheid en armoedebestrijding. Organisaties kunnen via een quickscan en de aanvraagpagina op de website een gift aanvragen.',
  bijdrage_min = 5000,
  bijdrage_max = 10000,
  bijdrage_toelichting = 'Bandbreedte €5.000–€10.000 opgegeven door Het Fondsenwervers Collectief (19-10-2026); niet gepubliceerd op de website.',
  bandbreedte_bijdrage_id = (select id from public.bandbreedtes_bijdrage where bedrag_min = 5000 and bedrag_max = 10000),
  algemeen_email = coalesce(nullif(algemeen_email,''), 'secretariaat@vanbaarenstichting.nl'),
  classification_reviewed = true,
  research_source = coalesce(research_source,'') || case when coalesce(research_source,'')='' then '' else ' | ' end || 'Gecorrigeerd 19-10-2026 (Claude): vanbaarenstichting.nl + opgave HFC',
  last_researched_at = now()
where id = 'a3100435-a77c-435c-95cb-1a941002d515';
delete from public.funder_themas where funder_id = 'a3100435-a77c-435c-95cb-1a941002d515' and thema_id in (select id from public.themas where naam in ('Kunst','Cultureel erfgoed'));
delete from public.funder_doelgroepen where funder_id = 'a3100435-a77c-435c-95cb-1a941002d515' and doelgroep_id in (select id from public.doelgroepen where naam in ('Culturele instellingen','Erfgoedinstellingen'));
insert into public.funder_themas (funder_id, thema_id) select 'a3100435-a77c-435c-95cb-1a941002d515', id from public.themas where naam in ('Armoedebestrijding','Gezondheid','Ouderen','Jeugd en kinderen','Sociaal-maatschappelijk','Sociaal-cultureel') on conflict do nothing;
insert into public.funder_doelgroepen (funder_id, doelgroep_id) select 'a3100435-a77c-435c-95cb-1a941002d515', id from public.doelgroepen where naam in ('Ouderen','Jongeren','Kinderen','Mensen in armoede','Mensen in een kwetsbare positie') on conflict do nothing;
insert into public.funder_regios (funder_id, regio_id) select 'a3100435-a77c-435c-95cb-1a941002d515', id from public.regios where naam = 'Utrecht' on conflict do nothing;
