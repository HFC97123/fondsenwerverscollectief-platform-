-- Op verzoek Aisya (16-10-2026). Kinderbescherming en Onderwijs bestonden al; Familieondersteuning en Psychosociale zorg niet apart toegevoegd (overlap met Familiezorg/Familieversterking en Psychosociale ondersteuning).
insert into public.themas (naam) select 'Economische zelfstandigheid' where not exists (select 1 from public.themas where lower(naam)='economische zelfstandigheid');
