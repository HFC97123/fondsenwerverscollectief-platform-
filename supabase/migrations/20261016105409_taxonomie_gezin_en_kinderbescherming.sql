-- Op verzoek Aisya (16-10-2026): nieuwe disciplines en doelgroep. 'Onderwijs' bestond al; 'Gezondheidszorg' niet toegevoegd (overlap met bestaande 'Gezondheid' en 'Zorg', eerst afstemmen).
insert into public.themas (naam) select x from unnest(array['Kinderbescherming','Familiezorg','Psychosociale ondersteuning','Familieversterking']) x where not exists (select 1 from public.themas t where lower(t.naam)=lower(x));
insert into public.doelgroepen (naam) select 'Gezinnen' where not exists (select 1 from public.doelgroepen where lower(naam)='gezinnen');
