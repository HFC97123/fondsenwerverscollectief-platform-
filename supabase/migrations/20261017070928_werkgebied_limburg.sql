-- Ontbrekende provincie in de werkgebiedenlijst.
insert into public.regios (naam) select 'Limburg' where not exists (select 1 from public.regios where naam='Limburg');
