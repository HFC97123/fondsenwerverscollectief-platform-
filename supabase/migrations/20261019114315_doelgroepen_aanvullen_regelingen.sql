-- TOEGEPAST op het live project op 19-10-2026 (live versie 20261019114315). Nooit opnieuw uitvoeren.
-- Doelgroepen voor 64 beoordeelde regelingen die er nog geen hadden, plus disciplines voor het Aanmoedigingsfonds.
-- Op verzoek van de beheerder (19-10-2026), na bespreking van de voorstellen per regeling. Alleen toevoegen; niets wordt verwijderd.
-- Elke regel wordt gezocht op naam van de verstrekker + naam van de regeling; ontbreekt er één, dan stopt de migratie.
do $$
declare
  v_ontbrekend int;
begin
  create temp table dg_invoer(funder text, regeling text, doelgroep text) on commit drop;
  insert into dg_invoer values
  ('Aanmoedigingsfonds','Aanvraag voorjaarsronde 2027','Mensen in een kwetsbare positie'),
  ('Aanmoedigingsfonds','Aanvraag voorjaarsronde 2027','Nieuwkomers/ongedocumenteerden'),
  ('Amsterdams Fonds voor de Kunst','Beeldende Kunst in de Openbare Ruimte (BKOR)','Kunstenaars'),
  ('Amsterdams Fonds voor de Kunst','Beeldende Kunst in de Openbare Ruimte (BKOR)','Makers'),
  ('Amsterdams Fonds voor de Kunst','Regeling Ontwikkeling 2025-2028','Culturele instellingen'),
  ('Amsterdams Fonds voor de Kunst','Regeling Ontwikkeling 2025-2028','Makers'),
  ('Amsterdams Fonds voor de Kunst','Stipendium','Kunstenaars'),
  ('Amsterdams Fonds voor de Kunst','Stipendium','Jonge makers'),
  ('Amsterdams Fonds voor de Kunst','Tweejarige subsidies Cultuurmakers 2027-2028','Makers'),
  ('Amsterdams Fonds voor de Kunst','Tweejarige subsidies Cultuurmakers 2027-2028','Culturele instellingen'),
  ('Amsterdams Fonds voor de Kunst','Vierjarige subsidies 2025-2028','Culturele instellingen'),
  ('Bartimeus Fonds','Open Call Kleine en Middelgrote Musea','Musea'),
  ('Bartimeus Fonds','Open Call Kleine en Middelgrote Musea','Blinden en slechtzienden'),
  ('Central Project Management Agency','EU4Belarus SALT — Fellowships aan EU hoger-onderwijs-/onderzoeksinst.','Studenten'),
  ('Central Project Management Agency','EU4Belarus SALT — Fellowships aan EU hoger-onderwijs-/onderzoeksinst.','Onderzoekers'),
  ('Dutch Caribbean Nature Alliance (DCNA)','Key Habitats Program','Natuurbeheerders'),
  ('Evens Foundation','Evens Arts Prize','Kunstenaars'),
  ('Evens Foundation','Strategic Microgrants','Makers'),
  ('Fonds Podiumkunsten','Internationale coproducties','Podiumkunstorganisaties'),
  ('Fonds Podiumkunsten','Meerjarige festivalsubsidies 2025-2028','Podiumkunstorganisaties'),
  ('Fonds Podiumkunsten','Meerjarige productiesubsidies 2025-2028','Podiumkunstorganisaties'),
  ('Fonds Podiumkunsten','Opdracht compositie of libretto','Makers'),
  ('Fonds Podiumkunsten','Opdracht compositie of libretto','Kunstenaars'),
  ('Fonds Podiumkunsten','Podiumregeling','Podiumkunstorganisaties'),
  ('Fonds Podiumkunsten','Productiesubsidie','Makers'),
  ('Fonds Podiumkunsten','Productiesubsidie','Podiumkunstorganisaties'),
  ('Fonds Podiumkunsten','Programma en Presentatiebijdrage','Podiumkunstorganisaties'),
  ('Fonds Podiumkunsten','Programma internationale promotie','Podiumkunstorganisaties'),
  ('Fonds Podiumkunsten','Programma internationale promotie','Makers'),
  ('Fonds Podiumkunsten','Programmering festival popmuziek','Podiumkunstorganisaties'),
  ('Fonds Podiumkunsten','Reeks opdrachten compositie of libretto','Makers'),
  ('Fonds Podiumkunsten','Reeks opdrachten compositie of libretto','Kunstenaars'),
  ('Fonds voor Cultuurparticipatie','Co-creatie – Instellingen: Groeien','Culturele instellingen'),
  ('Fonds voor Cultuurparticipatie','Co-creatie – Instellingen: Groeien','Gemeenschappen'),
  ('Fonds voor Cultuurparticipatie','Co-creatie – Samen werken aan cultuur (2025-2028)','Culturele instellingen'),
  ('Fonds voor Cultuurparticipatie','Co-creatie – Samen werken aan cultuur (2025-2028)','Gemeenschappen'),
  ('Fonds voor Cultuurparticipatie','Talentontwikkeling (2025-2028)','Jonge makers'),
  ('Fonds voor Cultuurparticipatie','Talentontwikkeling (2025-2028)','Culturele instellingen'),
  ('Gemeente Amsterdam','Evenementenfonds 2027','Buurtbewoners'),
  ('Gemeente Amsterdam','Evenementenfonds 2027','Gemeenschappen'),
  ('Gemeente Amsterdam','Jaarprogramma''s culturele instellingen Oost','Culturele instellingen'),
  ('Gemeente Amsterdam','Jaarprogramma''s culturele instellingen Oost','Buurtbewoners'),
  ('Gemeente Amsterdam','Jaarprogramma''s culturele instellingen Zuid','Culturele instellingen'),
  ('Gemeente Amsterdam','Jaarprogramma''s culturele instellingen Zuid','Buurtbewoners'),
  ('Gemeente Amsterdam','Kunst en Cultuur Amsterdam 750 jaar (Vrijdenkersfestival)','Makers'),
  ('Gemeente Amsterdam','Kunst en Cultuur Amsterdam 750 jaar (Vrijdenkersfestival)','Culturele instellingen'),
  ('Gemeente Amsterdam','Sportverenigingsaccommodaties Buitensport Amsterdam','Sportverenigingen'),
  ('Gemeente Amsterdam','Subsidieregeling allianties inclusiviteit en antidiscriminatie 2026-2027','Minderheden'),
  ('Gemeente Amsterdam','Subsidieregeling allianties inclusiviteit en antidiscriminatie 2026-2027','Gemeenschappen'),
  ('Gemeente Den Haag','Investeringssubsidie accommodaties sportverenigingen','Sportverenigingen'),
  ('Gemeente Den Haag','Subsidie grote publieksevenementen','Culturele instellingen'),
  ('Gemeente Den Haag','Subsidie Haags sportinitiatief','Sportverenigingen'),
  ('Gemeente Den Haag','Subsidie Haags sportinitiatief','Buurtbewoners'),
  ('Gemeente Den Haag','Subsidie meerjarenbeleidsplan kunst en cultuur 2027–2028 categorie A','Culturele instellingen'),
  ('Gemeente Den Haag','Subsidie meerjarenbeleidsplan kunst en cultuur 2027–2028 categorie A','Podiumkunstorganisaties'),
  ('Gemeente Den Haag','Subsidieregeling sociale initiatieven in de wijk','Buurtbewoners'),
  ('Gemeente Den Haag','Subsidieregeling sociale initiatieven in de wijk','Mensen in een kwetsbare positie'),
  ('Gemeente Rotterdam','Jaarlijkse subsidie Cultuurplan 2025-2028','Culturele instellingen'),
  ('Gemeente Rotterdam','Subsidie Combinatiefuncties sport (Brede regeling combinatiefuncties Rotterdam – Sport)','Sportverenigingen'),
  ('Gemeente Rotterdam','Subsidie Combinatiefuncties sport (Brede regeling combinatiefuncties Rotterdam – Sport)','Kinderen'),
  ('Gemeente Rotterdam','Subsidie Combinatiefuncties sport (Brede regeling combinatiefuncties Rotterdam – Sport)','Jongeren'),
  ('Gemeente Rotterdam','Subsidie Cultuurcoach','Scholen en onderwijsinstellingen'),
  ('Gemeente Rotterdam','Subsidie Cultuurcoach','Kinderen'),
  ('Gemeente Utrecht','Activiteiten erfgoed','Erfgoedinstellingen'),
  ('Gemeente Utrecht','Activiteiten erfgoed','Vrijwilligers'),
  ('Gemeente Utrecht','Amateurkunst','Vrijwilligers'),
  ('Gemeente Utrecht','Amateurkunst','Gemeenschappen'),
  ('Gemeente Utrecht','Cultuurnota ''Kleur bekennen'' – 2-jarige subsidie 2027-2028','Culturele instellingen'),
  ('Gemeente Utrecht','Cultuurnota ''Kleur bekennen'' – 2-jarige subsidie 2027-2028','Makers'),
  ('Laméris Foundation','Schenkingsaanvraag','Erfgoedinstellingen'),
  ('Laméris Foundation','Schenkingsaanvraag','Dieren'),
  ('Mondriaan Fonds','Regeling Interdisciplinair (Organisatie)','Culturele instellingen'),
  ('Mondriaan Fonds','Regeling Interdisciplinair (Organisatie)','Kunstenaars'),
  ('Mondriaan Fonds','Regeling Restauratie Mobiel Erfgoed','Erfgoedinstellingen'),
  ('Mondriaan Fonds','Regeling Voucher Co-creatie','Erfgoedinstellingen'),
  ('Mondriaan Fonds','Regeling Voucher Co-creatie','Gemeenschappen'),
  ('Mondriaan Fonds','Subsidieregeling Erfgoed Innovatie','Erfgoedinstellingen'),
  ('Mondriaan Fonds','Subsidieregeling Erfgoed Innovatie','Erfgoedprofessionals'),
  ('Nederlands Filmfonds','Studio Caribe','Makers'),
  ('Nederlands Filmfonds','Studio Caribe','Jonge makers'),
  ('Nederlands Filmfonds','Subsidieregeling Filmfestival','Culturele instellingen'),
  ('Nederlands Letterenfonds','Literaire programma''s / Leesbevordering','Culturele instellingen'),
  ('Nederlands Letterenfonds','Schwob','Uitgevers'),
  ('Postcode Loterij','Eenmalige schenking Nationale Postcode Loterij','Gemeenschappen'),
  ('Postcode Loterij','Eenmalige schenking Nationale Postcode Loterij','Mensen in een kwetsbare positie'),
  ('Postcode Loterij','Eenmalige schenking Nationale Postcode Loterij','Natuurbeheerders'),
  ('Prins Bernhard Cultuurfonds','Open Call Architectuur en Bouwkunst','Makers'),
  ('Prins Bernhard Cultuurfonds','Open Call Cultuurparticipatie Zuid-Holland','Culturele instellingen'),
  ('Prins Bernhard Cultuurfonds','Open Call Cultuurparticipatie Zuid-Holland','Vrijwilligers'),
  ('Prins Bernhard Cultuurfonds','Open Call Internationale Studiebeurzen','Studenten'),
  ('Prins Bernhard Cultuurfonds','Open Call Internationale Studiebeurzen','Jonge makers'),
  ('Prins Bernhard Cultuurfonds','Regeling Conservatoren Stipendium','Erfgoedprofessionals'),
  ('Prins Bernhard Cultuurfonds','Regeling Conservatoren Stipendium','Curatoren'),
  ('Prins Bernhard Cultuurfonds','Schoolpleinen van de Toekomst','Scholen en onderwijsinstellingen'),
  ('Prins Bernhard Cultuurfonds','Schoolpleinen van de Toekomst','Kinderen'),
  ('Rijksdienst voor het Cultureel Erfgoed – Caribisch Nederland','Pilot monumentale woonhuizen Caribisch Nederland','Gemeenschappen'),
  ('Rijksdienst voor het Cultureel Erfgoed – Caribisch Nederland','Pilot monumentale woonhuizen Caribisch Nederland','Erfgoedprofessionals'),
  ('Sandals Foundation','Sandals Foundation Project Grants (Curaçao)','Gemeenschappen'),
  ('Sandals Foundation','Sandals Foundation Project Grants (Curaçao)','Kinderen'),
  ('Save Our Seas Foundation','Small Grant','Onderzoekers'),
  ('Save Our Seas Foundation','Small Grant','Natuurbeheerders'),
  ('Stichting Dioraphte','Wetenschap & Onderzoek','Onderzoekers'),
  ('Stichting Dioraphte','Wetenschap & Onderzoek','Patiënten'),
  ('Stimuleringsfonds Creatieve Industrie','Regeling Activiteitenprogramma''s creatieve industrie','Culturele instellingen'),
  ('Stimuleringsfonds Creatieve Industrie','Regeling Activiteitenprogramma''s creatieve industrie','Makers'),
  ('Stimuleringsfonds Creatieve Industrie','Regeling Festivals creatieve industrie','Culturele instellingen'),
  ('Stimuleringsfonds Creatieve Industrie','Startregeling creatieve industrie – Vormgeving','Jonge makers'),
  ('VFonds','Onze Democratie','Jongeren'),
  ('VFonds','Onze Democratie','Gemeenschappen');

  select count(*) into v_ontbrekend from dg_invoer i
  where not exists (select 1 from subsidieregelingen s join funders f on f.id = s.funder_id where f.naam = i.funder and s.naam = i.regeling and s.classification_reviewed)
     or not exists (select 1 from doelgroepen d where d.naam = i.doelgroep);
  if v_ontbrekend > 0 then raise exception 'doelgroepen: % regels niet gevonden', v_ontbrekend; end if;

  insert into subsidieregeling_doelgroepen (subsidieregeling_id, doelgroep_id)
  select distinct s.id, d.id
  from dg_invoer i
  join funders f on f.naam = i.funder
  join subsidieregelingen s on s.funder_id = f.id and s.naam = i.regeling and s.classification_reviewed
  join doelgroepen d on d.naam = i.doelgroep
  where not exists (select 1 from subsidieregeling_doelgroepen x where x.subsidieregeling_id = s.id and x.doelgroep_id = d.id);

  insert into subsidieregeling_themas (subsidieregeling_id, thema_id)
  select s.id, t.id
  from subsidieregelingen s join funders f on f.id = s.funder_id
  join themas t on t.naam in ('Noodhulp', 'Gezondheid', 'Sociaal-maatschappelijk')
  where f.naam = 'Aanmoedigingsfonds' and s.naam = 'Aanvraag voorjaarsronde 2027'
    and not exists (select 1 from subsidieregeling_themas x where x.subsidieregeling_id = s.id and x.thema_id = t.id);
end $$;
