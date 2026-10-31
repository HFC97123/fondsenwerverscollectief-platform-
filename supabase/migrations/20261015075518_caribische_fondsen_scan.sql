-- Caribische fondsen: scan 14-10-2026 (op verzoek Aisya). Alleen toevoegingen; idempotent (bestaande funders/regelingen op naam worden overgeslagen).
-- Bronnen per funder in kolom bron; status en deadlines bekeken op 14-10-2026. Bedragen in USD/AWG/NAf staan alleen in de omschrijving.
create temp table _f (k text, naam text, type text, website text, missie text, land text, plaats text, bron text) on commit drop;
insert into _f values
 ('reda','Reda Sosial (Stichting Fonds voor Sociale Ontwikkeling en Economische Bedrijvigheid)','vermogensfonds','https://www.redasosial.com/','Sociaal fonds op Curaçao: armoedebestrijding, zorg en welzijn, vorming en educatie, wijkvoorzieningen en zelfredzaamheid van NGO-projecten.','Curaçao','Willemstad','https://www.redasosial.com/financiering/'),
 ('cede','CEDE Aruba (Centro pa Desaroyo di Aruba)','vermogensfonds','https://cedearuba.odoo.com/','Ontwikkelingsfonds op Aruba voor kwetsbare groepen, wijkontwikkeling, jeugd en vrijwilligerswerk; lokale partner van Samenwerkende Fondsen Cariben.','Aruba','Oranjestad','https://cedearuba.odoo.com/programs'),
 ('smdf','St. Maarten Development Fund (SMDF)','vermogensfonds','https://smdf.sx/','Fonds op Sint Maarten voor kleinschalige sociale projecten voor kwetsbare groepen en wijkverbetering.','Sint Maarten','Philipsburg','https://www.npowersxm.com/grants/st-maarten-development-fund'),
 ('btc','Be The Change Foundation SXM','vermogensfonds','https://www.facebook.com/bethechangesxm','Ledengefinancierde stichting op Sint Maarten die jaarlijks Spotlight Project Grants geeft aan lokale non-profits.','Sint Maarten',null,'https://www.npowersxm.com/grants/be-the-change-foundation'),
 ('aaa','Aruba Airport Authority – Wings of Hope','corporate_foundation','https://www.airportaruba.com/donation','Donatieprogramma van de luchthaven van Aruba voor lokale non-profitprojecten met duurzame impact (SDG-thema''s).','Aruba',null,'https://www.airportaruba.com/storage/app/media/PDF/DonationsPolicy-2025.pdf'),
 ('setar','Setar N.V. – Sponsoring','corporate_foundation','https://sponsor.portal.setar.aw','Sponsoring door telecombedrijf Setar voor culturele, educatieve, sociale en sportactiviteiten op Aruba.','Aruba',null,'https://sponsor.portal.setar.aw'),
 ('cbcs','Centrale Bank van Curaçao en Sint Maarten – Donaties en sponsoring','corporate_foundation','https://exch.centralbank.cw/about-the-bank/corporate-social-responsibility','MVO-donaties aan non-profits op Curaçao en Sint Maarten: jeugd, onderwijs, innovatie, gezondheid en economie.','Curaçao','Willemstad','https://exch.centralbank.cw/about-the-bank/corporate-social-responsibility'),
 ('pjia','Princess Juliana International Airport (SXM) – Sponsorships','corporate_foundation','https://www.sxmairport.com/community-events/sponsorships','Sponsoring en donaties van de luchthaven van Sint Maarten voor onderwijs, zorg, milieu, gemeenschap en cultuur.','Sint Maarten',null,'https://www.sxmairport.com/community-events/sponsorships'),
 ('marr','Aruba Marriott Care Foundation','corporate_foundation',null,'Medewerkersstichting van het Aruba Marriott (sinds 1999) die lokale stichtingen steunt met goederen, renovaties en vrijwilligers. Geen subsidiefonds.','Aruba',null,'https://english.24ora.com/aruba-marriott-complex-supports-community-renovation-project/'),
 ('monu','Stichting Monumentenfonds Curaçao','vermogensfonds','http://www.monumentenfonds.org/','Subsidies en zachte leningen voor restauratie van monumenten op Curaçao.','Curaçao','Willemstad','https://dutchculture.nl/location/cura%C3%A7ao-monuments-fund-foundation'),
 ('szw','Ministerie van SZW – Uitvoering van Beleid (Caribisch deel)','rijksoverheid','https://www.uitvoeringvanbeleidszw.nl/','Subsidieregeling maatschappelijke initiatieven trans-Atlantisch slavernijverleden voor het Caribisch deel van het Koninkrijk.','Nederland',null,'https://www.uitvoeringvanbeleidszw.nl/subsidies-en-regelingen/subsidieregeling-maatschappelijke-initiatieven-trans-atlantisch-slavernijverleden-voor-het-caribisch-deel-van-het-koninkrijk'),
 ('best','BESTLIFE2030 (EU / IUCN)','europese_fondsen','https://bestlife2030.org/','EU-subsidieprogramma (uitgevoerd door IUCN) voor biodiversiteit en klimaatadaptatie in ultraperifere regio''s en overzeese gebieden, waaronder de zes Caribische eilanden van het Koninkrijk.',null,null,'https://bestlife2030.org/applicants/'),
 ('dcna','Dutch Caribbean Nature Alliance (DCNA)','vermogensfonds','https://dcnanature.org/','Regionaal natuurnetwerk voor de zes eilanden; verdeelt o.a. via het Key Habitats Program middelen voor natuurherstel aan lokale natuur-ngo''s.','Bonaire',null,'https://dcnanature.org/keyhabitatsprogram'),
 ('rvo','RVO – Praktijkleren Caribisch Nederland','rijksoverheid','https://www.rvo.nl/subsidies-financiering/praktijkleren/caribisch-nederland','Vergoeding voor erkende leerbedrijven op Bonaire, Sint Eustatius en Saba die praktijk- of werkleerplaatsen begeleiden.','Nederland',null,'https://www.rvo.nl/subsidies-financiering/praktijkleren/caribisch-nederland'),
 ('rce','Rijksdienst voor het Cultureel Erfgoed – Caribisch Nederland','rijksoverheid','https://www.cultureelerfgoed.nl/onderwerpen/s/subsidieregeling-monumenten-caribisch-nederland','Subsidie voor onderhoud van monumentale woonhuizen op Bonaire, Sint Eustatius en Saba (pilot 2026).','Nederland',null,'https://www.cultureelerfgoed.nl/onderwerpen/s/subsidieregeling-monumenten-caribisch-nederland'),
 ('statia','Openbaar Lichaam Sint Eustatius','gemeente_lokale_overheid','https://www.statiagovernment.com/','Eigen subsidies van het openbaar lichaam Sint Eustatius (taaksubsidies en evenementensubsidies) voor non-profits op het eiland.','Sint Eustatius','Oranjestad','https://lokaleregelgeving.overheid.nl/CVDR741443'),
 ('mama','Mama Cash','vermogensfonds','https://www.mamacash.org/','Internationaal feministisch fonds; het Spark Fund steunt zelfgeleide groepen van vrouwen, meisjes, trans en intersekse personen in Nederland en op de zes Caribische eilanden.','Nederland','Amsterdam','https://www.mamacash.org/funds/spark-fund/'),
 ('unesco','UNESCO Participation Programme (via nationale commissies Aruba, Curaçao, Sint Maarten)','europese_fondsen','https://www.unesco.org/en/participation-programme','Tweejaarlijks UNESCO-programma voor projecten in onderwijs, wetenschap, cultuur en communicatie; aanvragen via de nationale UNESCO-commissie van het eiland.',null,null,'https://www.gobierno.aw/en/call-for-applications-for-financial-support-for-projects-under-the-unesco-participation-programme'),
 ('mbz','Mohamed bin Zayed Species Conservation Fund','vermogensfonds','https://www.speciesconservation.org/','Internationaal fonds voor veldprojecten ter bescherming van bedreigde soorten, wereldwijd (ook de Caribische eilanden).','Verenigde Arabische Emiraten','Abu Dhabi','https://www.speciesconservation.org/biodiversity-nature-people/conservation-philanthropy/grants/'),
 ('sos','Save Our Seas Foundation','vermogensfonds','https://saveourseas.com/','Internationaal fonds voor onderzoek, bescherming en educatie rond bedreigde mariene megafauna (vooral haaien en roggen).','Zwitserland','Genève','https://saveourseas.com/grants/'),
 ('rotary','The Rotary Foundation (Districten 7030/7020)','service_club','https://www.rotary.org/en/our-programs/grants','District- en Global Grants voor projecten van Rotaryclubs; ngo''s werken via een lokale club (Aruba, Bonaire, Curaçao: District 7030; Sint Maarten: District 7020).','Verenigde Staten','Evanston','https://rotarygi.org/sitepage/grants'),
 ('kiwanis','Kiwanis Children''s Fund','service_club','https://www.kiwanis.org/childrensfund/','Internationaal fonds dat Kiwanisclubs steunt bij projecten voor kinderen (gezondheid, onderwijs, jongerenleiderschap); alleen via een lokale club.','Verenigde Staten','Indianapolis','https://www.kiwaniskids.org/news/explore-grants-for-club-projects/'),
 ('lcif','Lions Clubs International Foundation (LCIF)','service_club','https://www.lionsclubs.org/en/start-our-approach/grant-types','Subsidies voor humanitaire projecten en noodhulp van Lionsclubs; ngo''s werken via een lokale club.','Verenigde Staten','Oak Brook','https://lionsclubs.org/hi/node/13216'),
 ('sandals','Sandals Foundation','corporate_foundation','https://www.sandalsfoundation.org/','Bedrijfsfonds van Sandals Resorts; op de Nederlandse eilanden alleen voor Curaçao: onderwijs, natuur, gemeenschap, economische zelfstandigheid en rampenparaatheid.','Jamaica','Montego Bay','https://sandalsfoundation.org/news/sandals-foundation-2027-project-guidelines-and-selection-criteria');
create temp table _ex (k text, id uuid) on commit drop;
insert into _ex values
 ('sfc','ef3ebf3b-30d1-4a75-8d10-196a00d88115'),
 ('ccg','566d1768-da20-44b3-be67-d8ef8308d7aa'),
 ('ssfs','50691cdc-0ed3-4c49-b742-6032d0f70f72');
create temp table _r (k text, naam text, status text, dd date, omschr text, link text, bmin numeric, bmax numeric) on commit drop;
insert into _r values
 ('sfc','Projectaanvraag Samenwerkende Fondsen Cariben (micro/macro)','doorlopend',null,'Het hele jaar aan te vragen via de lokale adviseur op het eigen eiland; de Nederlandse fondsen (Oranje Fonds, Kinderpostzegels, Kansfonds) besluiten. Doorlooptijd 1-2 maanden (micro) of 4-6 maanden (macro). Voor sociaal-maatschappelijke projecten van stichtingen en verenigingen.','https://www.samenwerkendefondsencariben.org/aanvragen/aanvraag',null,null),
 ('ccg','Projectaanvraag Cultuurfonds Caribisch Gebied','open','2026-11-24','Rondes via bestuursvergaderingen: dagelijks bestuur (tot NAf 10.000) meestal de 4e dinsdag van de maand, algemeen bestuur (NAf 10.000-25.000) 4x per jaar; geen vergaderingen in juli en december. Vooraanvraag via my CCG vóór de deadline in de vergaderagenda. Eerstvolgende vergadering dagelijks bestuur: 24 november 2026 (vooraanvraagdeadline is al verstreken).','https://cultuurfondscaribischgebied.com/vergaderagenda/',null,null),
 ('ccg','Reisbeurs Cultuurfonds Caribisch Gebied','doorlopend',null,'Reisbeurs voor professionalisering (max. €2.500) of internationale promotie (max. €5.000); eens per 2 jaar per persoon of organisatie.','https://cultuurfondscaribischgebied.com/criteria-subsidieaanvraag/',null,5000),
 ('reda','Financieringsverzoek NGO-projecten','doorlopend',null,'Doorlopend aan te vragen met het projectindieningsformat (per e-mail of post). Het bestuur besluit na voorbereiding door een beleidsmedewerker. Laat zien hoe het project zichzelf na de financiering bedruipt.','https://www.redasosial.com/financieringsverzoek/',null,null),
 ('cede','Micro- en wijkgrants (Ban Biba Bario)','doorlopend',null,'Doorlopend via het grantee-portal voor grassroots-initiatieven en wijkverbetering op Aruba; tot AWG 15.000, besluit binnen ca. 2 weken.','https://portal.cedearuba.org',null,null),
 ('cede','Macro- en meerjarige projectgrants','doorlopend',null,'Doorlopend via het grantee-portal voor grotere en meerjarige projecten voor kwetsbare groepen op Aruba; vanaf AWG 15.000, besluit binnen ca. 3 maanden.','https://portal.cedearuba.org',null,null),
 ('smdf','Incidental Grants','gesloten',null,'Kleinschalige projecten voor kwetsbare groepen op Sint Maarten. Volgens NPOwer SXM jaarlijkse ronde met deadline eind oktober; laatst bevestigde oproep 2021, dus eerst navragen (info@smdf.sx).','https://smdf.sx/',null,null),
 ('btc','Spotlight Project Grants','aangekondigd',null,'Jaarlijkse ronde voor lokale non-profits met KvK-nummer op Sint Maarten; volgens NPOwer SXM deadline eind november (niet officieel bevestigd).','https://www.npowersxm.com/grants/be-the-change-foundation',null,null),
 ('aaa','Wings of Hope donaties','doorlopend',null,'Doorlopend en alleen online aan te vragen, minimaal 4 weken vóór uitvoering; maandelijkse beoordeling. Voor KvK-geregistreerde non-profits op Aruba; niet voor religieuze, politieke of commerciële organisaties.','https://www.airportaruba.com/donation',null,null),
 ('setar','Setar sponsoring','doorlopend',null,'Doorlopend via het sponsorportal, minimaal 1 maand vóór de activiteit; max. 1 sponsoring per organisatie per jaar. Bijdrage in geld (overboeking), merchandise of diensten.','https://sponsor.portal.setar.aw',null,null),
 ('cbcs','Donaties en sponsoring CBCS','doorlopend',null,'Doorlopend per e-mail (info@centralbank.cw), minimaal 30 dagen vóór het evenement; verwerking ca. 3 weken. Voor non-profits geregistreerd op Curaçao of Sint Maarten.','https://exch.centralbank.cw/about-the-bank/corporate-social-responsibility',null,null),
 ('pjia','SXM Airport sponsorships','doorlopend',null,'Doorlopend via het online formulier, minimaal 8 weken vooraf; jaar- en partnerschapsverzoeken vóór eind november van het voorgaande jaar.','https://www.sxmairport.com/community-events/sponsorships',null,null),
 ('marr','Ondersteuning lokale stichtingen (in natura)','doorlopend',null,'Geen formele aanvraagprocedure of rondes: steun in goederen, renovaties en vrijwilligers. Organisaties kunnen contact opnemen met de HR-afdeling van het Aruba Marriott.',null,null,null),
 ('monu','Restauratiesubsidie en lening monumenten','doorlopend',null,'Subsidies en zachte leningen voor eigenaren van monumenten op Curaçao (ook stichtingen); neem contact op met het fonds voor de voorwaarden.','http://www.monumentenfonds.org/',null,null),
 ('szw','Slavernijverleden Caribisch deel – categorie 1 (professionalisering)','binnenkort','2027-01-12','Aanvraagperiode 2 november 2026 (09.00 CET) t/m 12 januari 2027 (17.00 CET) via het UVB-portaal. Max. USD 10.000 voor professionalisering van organisaties ten behoeve van nazaten van tot slaaf gemaakten.','https://www.uitvoeringvanbeleidszw.nl/subsidies-en-regelingen/subsidieregeling-maatschappelijke-initiatieven-trans-atlantisch-slavernijverleden-voor-het-caribisch-deel-van-het-koninkrijk',null,null),
 ('szw','Slavernijverleden Caribisch deel – categorie 3 en 4 (middelgrote en grote initiatieven)','aangekondigd','2027-06-01','Volgende aanvraagperiode 1 april t/m 1 juni 2027. Categorie 3: USD 25.000-125.000; categorie 4: USD 125.000-500.000.','https://www.uitvoeringvanbeleidszw.nl/subsidies-en-regelingen/subsidieregeling-maatschappelijke-initiatieven-trans-atlantisch-slavernijverleden-voor-het-caribisch-deel-van-het-koninkrijk',null,null),
 ('best','BESTLIFE2030 – oproep biodiversiteit','open','2026-12-08','Derde oproep geopend in oktober 2026; concept note vóór 8 december 2026, 14.00 CET (bron: fundsforNGOs; controleer in de Guidelines for Applicants). Vorige oproep: tot €100.000 per project.','https://bestlife2030.org/applicants/',null,100000),
 ('dcna','Key Habitats Program','gesloten',null,'Ronde 2026 (3 maart t/m 13 april 2026) is gesloten; nieuwe Call for Proposals verwacht in 2027. USD 56.000-168.000 per project voor praktische natuurherstelprojecten van natuur-ngo''s op de zes eilanden.','https://dcnanature.org/keyhabitatsprogram',null,null),
 ('rvo','Praktijkleren Caribisch Nederland','gesloten','2027-09-17','Jaarlijks tijdvak; volgende: 1 t/m 17 september 2027. Max. €2.800 per gerealiseerde praktijk- of werkleerplaats (uitbetaald in USD).','https://www.rvo.nl/subsidies-financiering/praktijkleren/caribisch-nederland',null,2800),
 ('rce','Pilot monumentale woonhuizen Caribisch Nederland','gesloten',null,'Eenmalig tijdvak 1 t/m 30 september 2026 (gesloten); besluit uiterlijk eind februari 2027. Subsidie tot USD 100.000 voor onderhoud van monumentale woonhuizen; een vervolg is niet bekend.','https://www.cultureelerfgoed.nl/onderwerpen/s/subsidieregeling-monumenten-caribisch-nederland',null,null),
 ('statia','Taaksubsidie Sint Eustatius','doorlopend','2027-04-01','Jaarlijkse subsidie voor een erkende taak; aanvragen uiterlijk 1 april vóór het begrotingsjaar (1 april 2027 voor 2028).','https://lokaleregelgeving.overheid.nl/CVDR741443',null,null),
 ('statia','Evenementensubsidie Sint Eustatius','doorlopend',null,'Doorlopend aan te vragen, minimaal 6 weken vóór het evenement.','https://lokaleregelgeving.overheid.nl/CVDR741443',null,null),
 ('mama','Spark Fund','gesloten',null,'Jaarlijkse ronde; 2026 liep van 20 augustus t/m 20 september (gesloten). €5.000-12.000 voor zelfgeleide groepen, ook informeel en zonder registratie; volgende ronde naar verwachting augustus 2027.','https://www.mamacash.org/funds/spark-fund/',5000,12000),
 ('unesco','Participation Programme 2026-2027','gesloten',null,'Tweejaarlijkse cyclus via de nationale UNESCO-commissie (Aruba: deadline 5 februari 2026, verlopen); volgende cyclus 2028-2029. Tot USD 26.000 per project.','https://www.gobierno.aw/en/call-for-applications-for-financial-support-for-projects-under-the-unesco-participation-programme',null,null),
 ('mbz','Species Conservation Grant','open','2026-10-15','Drie rondes per jaar; lopende ronde sluit 15 oktober 2026, daarna januari 2027 (deadline 31 januari) en mei 2027. Tot ca. USD 25.000 per veldproject voor bedreigde soorten.','https://application.speciesconservation.org',null,null),
 ('sos','Small Grant','gesloten',null,'Jaarlijkse ronde, 2026 gesloten; heropent medio mei 2027. Tot USD 10.000 voor onderzoek, bescherming en educatie rond haaien en roggen.','https://saveourseas.com/grants/',null,null),
 ('rotary','Global Grant','doorlopend',null,'Doorlopend via een gekwalificeerde Rotaryclub met internationale partnerclub; projectbudget vanaf USD 30.000. District grants (D7030) jaarlijks met deadline 30 september.','https://www.rotary.org/en/our-programs/grants',null,null),
 ('kiwanis','Club Grant','open','2026-11-01','Letter of inquiry vóór 1 november of 1 april (jaarlijkse cyclus); alleen via een lokale Kiwanisclub. Microgrants USD 250-1.000 van 1 oktober t/m 1 juli.','https://www.kiwaniskids.org/news/explore-grants-for-club-projects/',null,null),
 ('lcif','District and Club Community Impact Grant','doorlopend',null,'Doorlopend, minimaal 90 dagen vóór de projectstart; alleen via een lokale Lionsclub. Daarnaast emergency grants tot USD 10.000 na rampen.','https://lionsclubs.org/hi/node/13216',null,null),
 ('sandals','Sandals Foundation Project Grants (Curaçao)','gesloten',null,'Jaarlijkse ronde in twee fasen; concepten voor 2027 konden tot 27 juli 2026. Alleen Curaçao. Small tot USD 20.000, Medium USD 20.000-50.000, Strategic USD 50.000-80.000. Volgende ronde vermoedelijk medio 2027.','https://sandalsfoundation.org/news/sandals-foundation-2027-project-guidelines-and-selection-criteria',null,null);
create temp table _rx (fnaam text, naam text, status text, dd date, omschr text, link text, bmin numeric, bmax numeric) on commit drop;
insert into _rx values
 ('Fonds voor Cultuurparticipatie','Cultuureducatie Caribisch deel van het Koninkrijk (Aruba, Curaçao, Sint Maarten)','open','2026-12-09','Verkenningen (€5.000-15.000) en projecten (€15.000-50.000) met scholen; indienen t/m 9 december 2026, 13.00 uur, op volgorde van binnenkomst zolang er budget per eiland is.','https://cultuurparticipatie.nl/subsidie-aanvragen/146/cultuureducatie-voor-het-caribisch-deel-van-het-koninkrijk-2025-2028-aruba-curacao-en-sint-maarten',5000,50000),
 ('Nederlands Filmfonds','Studio Caribe','gesloten',null,'Jaarlijkse ronde voor makers op de zes eilanden (min. 1 jaar woonachtig); ronde 2026 sloot 5 mei 2026. Ontwikkeling max. €10.000, productie max. €65.000. Volgende ronde naar verwachting voorjaar 2027.','https://www.filmfonds.nl/en/funding/fund/studio-caribe',null,65000);
create temp table _c (k text, soort text, naam text) on commit drop;
insert into _c values
 ('sfc','t','Armoedebestrijding'),
 ('sfc','t','Sociaal-maatschappelijk'),
 ('sfc','t','Jeugd en kinderen'),
 ('sfc','t','Welzijn'),
 ('sfc','d','Kinderen'),
 ('sfc','d','Jongeren'),
 ('sfc','d','Ouderen'),
 ('sfc','d','Mensen in een kwetsbare positie'),
 ('sfc','r','Caribisch deel van het Koninkrijk'),
 ('ssfs','r','Caribisch deel van het Koninkrijk'),
 ('ccg','t','Cultuur'),
 ('ccg','t','Kunst'),
 ('ccg','t','Cultureel erfgoed'),
 ('ccg','t','Natuur'),
 ('ccg','t','Cultuureducatie'),
 ('ccg','t','Monumentenzorg'),
 ('ccg','d','Kunstenaars'),
 ('ccg','r','Caribisch deel van het Koninkrijk'),
 ('reda','t','Armoedebestrijding'),
 ('reda','t','Welzijn'),
 ('reda','t','Educatie'),
 ('reda','t','Zelfredzaamheid'),
 ('reda','t','Sociaal-maatschappelijk'),
 ('reda','d','Mensen in armoede'),
 ('reda','d','Buurtbewoners'),
 ('reda','r','Caribisch deel van het Koninkrijk'),
 ('cede','t','Sociaal-maatschappelijk'),
 ('cede','t','Community building'),
 ('cede','t','Jeugd en kinderen'),
 ('cede','t','Vrijwilligers'),
 ('cede','d','Mensen in een kwetsbare positie'),
 ('cede','d','Buurtbewoners'),
 ('cede','d','Kinderen'),
 ('cede','d','Jongeren'),
 ('cede','r','Caribisch deel van het Koninkrijk'),
 ('smdf','t','Sociaal-maatschappelijk'),
 ('smdf','t','Armoedebestrijding'),
 ('smdf','d','Mensen in een kwetsbare positie'),
 ('smdf','r','Caribisch deel van het Koninkrijk'),
 ('btc','t','Sociaal-maatschappelijk'),
 ('btc','t','Vrijwilligers'),
 ('btc','r','Caribisch deel van het Koninkrijk'),
 ('aaa','t','Sociaal-maatschappelijk'),
 ('aaa','t','Duurzaamheid'),
 ('aaa','t','Onderwijs'),
 ('aaa','t','Gezondheid'),
 ('aaa','d','Mensen in een kwetsbare positie'),
 ('aaa','r','Caribisch deel van het Koninkrijk'),
 ('setar','t','Cultuur'),
 ('setar','t','Onderwijs'),
 ('setar','t','Sport'),
 ('setar','t','Sociaal-maatschappelijk'),
 ('setar','r','Caribisch deel van het Koninkrijk'),
 ('cbcs','t','Onderwijs'),
 ('cbcs','t','Sport'),
 ('cbcs','t','Innovatie'),
 ('cbcs','t','Gezondheid'),
 ('cbcs','d','Jongeren'),
 ('cbcs','r','Caribisch deel van het Koninkrijk'),
 ('pjia','t','Onderwijs'),
 ('pjia','t','Gezondheid'),
 ('pjia','t','Natuur en milieu'),
 ('pjia','t','Cultuur'),
 ('pjia','r','Caribisch deel van het Koninkrijk'),
 ('marr','t','Welzijn'),
 ('marr','t','Zorg'),
 ('marr','d','Ouderen'),
 ('marr','d','Mensen met een beperking'),
 ('marr','r','Caribisch deel van het Koninkrijk'),
 ('monu','t','Monumentenzorg'),
 ('monu','t','Restauratie'),
 ('monu','t','Cultureel erfgoed'),
 ('monu','r','Caribisch deel van het Koninkrijk'),
 ('szw','t','Cultureel erfgoed'),
 ('szw','t','Educatie'),
 ('szw','t','Diversiteit en inclusie'),
 ('szw','d','Gemeenschappen'),
 ('szw','r','Caribisch deel van het Koninkrijk'),
 ('best','t','Natuur'),
 ('best','t','Klimaat'),
 ('best','t','Natuur en milieu'),
 ('best','r','Caribisch deel van het Koninkrijk'),
 ('dcna','t','Natuur'),
 ('dcna','t','Natuur en milieu'),
 ('dcna','r','Caribisch deel van het Koninkrijk'),
 ('rvo','t','Onderwijs'),
 ('rvo','t','Opleiding / beroepsontwikkeling'),
 ('rvo','t','Arbeidstoeleiding'),
 ('rvo','d','Jongeren'),
 ('rvo','r','Caribisch deel van het Koninkrijk'),
 ('rce','t','Monumentenzorg'),
 ('rce','t','Cultureel erfgoed'),
 ('rce','r','Caribisch deel van het Koninkrijk'),
 ('statia','t','Sociaal-maatschappelijk'),
 ('statia','t','Cultuur'),
 ('statia','r','Caribisch deel van het Koninkrijk'),
 ('mama','t','Mensenrechten'),
 ('mama','t','Diversiteit en inclusie'),
 ('mama','d','Vrouwen en meisjes'),
 ('mama','r','Landelijk'),
 ('mama','r','Caribisch deel van het Koninkrijk'),
 ('unesco','t','Onderwijs'),
 ('unesco','t','Wetenschap'),
 ('unesco','t','Cultuur'),
 ('unesco','d','Jongeren'),
 ('unesco','r','Caribisch deel van het Koninkrijk'),
 ('mbz','t','Natuur'),
 ('mbz','t','Dieren'),
 ('mbz','r','Caribisch deel van het Koninkrijk'),
 ('mbz','r','Wereld / internationaal'),
 ('sos','t','Natuur'),
 ('sos','t','Dieren'),
 ('sos','t','Onderzoek'),
 ('sos','r','Caribisch deel van het Koninkrijk'),
 ('sos','r','Wereld / internationaal'),
 ('rotary','t','Gezondheid'),
 ('rotary','t','Onderwijs'),
 ('rotary','t','Vrede'),
 ('rotary','t','Natuur en milieu'),
 ('rotary','r','Caribisch deel van het Koninkrijk'),
 ('rotary','r','Wereld / internationaal'),
 ('kiwanis','t','Jeugd en kinderen'),
 ('kiwanis','t','Gezondheid'),
 ('kiwanis','t','Onderwijs'),
 ('kiwanis','d','Kinderen'),
 ('kiwanis','r','Caribisch deel van het Koninkrijk'),
 ('kiwanis','r','Wereld / internationaal'),
 ('lcif','t','Gezondheid'),
 ('lcif','t','Noodhulp'),
 ('lcif','t','Sociaal-maatschappelijk'),
 ('lcif','r','Caribisch deel van het Koninkrijk'),
 ('lcif','r','Wereld / internationaal'),
 ('sandals','t','Onderwijs'),
 ('sandals','t','Natuur en milieu'),
 ('sandals','t','Sociaal-maatschappelijk'),
 ('sandals','r','Caribisch deel van het Koninkrijk');

do $$ declare v int; begin
  select count(*) into v from _c c where (c.soort='t' and not exists (select 1 from public.themas x where x.naam=c.naam)) or (c.soort='d' and not exists (select 1 from public.doelgroepen x where x.naam=c.naam)) or (c.soort='r' and not exists (select 1 from public.regios x where x.naam=c.naam));
  if v>0 then raise exception '% onbekende taxonomiewaarden', v; end if;
  select count(*) into v from _ex e where not exists (select 1 from public.funders f where f.id=e.id);
  if v>0 then raise exception 'bestaande funder niet gevonden'; end if;
  select count(*) into v from _rx x where (select count(*) from public.funders f where f.naam=x.fnaam)<>1;
  if v>0 then raise exception 'funder voor extra regeling niet eenduidig'; end if;
end $$;

insert into public.funders (naam, type, website, missie, land, plaats, bron, research_source, source_type, enrichment_status, status, last_researched_at)
select f.naam, f.type::funder_type, f.website, f.missie, f.land, f.plaats, f.bron, 'Scan Caribische fondsen 14-10-2026 (Claude)', 'internet_scan', 'deels_verrijkt', 'actief', now()
from _f f where not exists (select 1 from public.funders x where lower(x.naam)=lower(f.naam));

create temp table _fid on commit drop as
select f.k, x.id from _f f join public.funders x on lower(x.naam)=lower(f.naam)
union all select k, id from _ex;

insert into public.subsidieregelingen (funder_id, naam, status, deadline_datum, deadline_omschrijving, aanvraaglink, bedrag_min, bedrag_max, source_type, discovered_by, status_laatst_gecheckt, werkgebied)
select i.id, r.naam, r.status::regeling_status_type, r.dd, r.omschr, r.link, r.bmin, r.bmax, 'internet_scan', 'agent', now(), 'Caribisch deel van het Koninkrijk'
from _r r join _fid i on i.k=r.k
where not exists (select 1 from public.subsidieregelingen s where s.funder_id=i.id and lower(s.naam)=lower(r.naam));

insert into public.subsidieregelingen (funder_id, naam, status, deadline_datum, deadline_omschrijving, aanvraaglink, bedrag_min, bedrag_max, source_type, discovered_by, status_laatst_gecheckt, werkgebied)
select f.id, x.naam, x.status::regeling_status_type, x.dd, x.omschr, x.link, x.bmin, x.bmax, 'internet_scan', 'agent', now(), 'Caribisch deel van het Koninkrijk'
from _rx x join public.funders f on f.naam=x.fnaam
where not exists (select 1 from public.subsidieregelingen s where s.funder_id=f.id and lower(s.naam)=lower(x.naam));

-- classificatie op funder-niveau
insert into public.funder_themas (funder_id, thema_id) select i.id, t.id from _c c join _fid i on i.k=c.k join public.themas t on t.naam=c.naam where c.soort='t' on conflict do nothing;
insert into public.funder_doelgroepen (funder_id, doelgroep_id) select i.id, d.id from _c c join _fid i on i.k=c.k join public.doelgroepen d on d.naam=c.naam where c.soort='d' on conflict do nothing;
insert into public.funder_regios (funder_id, regio_id) select i.id, r.id from _c c join _fid i on i.k=c.k join public.regios r on r.naam=c.naam where c.soort='r' on conflict do nothing;
-- classificatie op regeling-niveau (nieuwe regelingen van deze funders)
insert into public.subsidieregeling_themas (subsidieregeling_id, thema_id) select s.id, t.id from _c c join _fid i on i.k=c.k join public.subsidieregelingen s on s.funder_id=i.id and s.naam in (select naam from _r where k=c.k) join public.themas t on t.naam=c.naam where c.soort='t' on conflict do nothing;
insert into public.subsidieregeling_doelgroepen (subsidieregeling_id, doelgroep_id) select s.id, d.id from _c c join _fid i on i.k=c.k join public.subsidieregelingen s on s.funder_id=i.id and s.naam in (select naam from _r where k=c.k) join public.doelgroepen d on d.naam=c.naam where c.soort='d' on conflict do nothing;
insert into public.subsidieregeling_regios (subsidieregeling_id, regio_id) select s.id, r.id from _c c join _fid i on i.k=c.k join public.subsidieregelingen s on s.funder_id=i.id and s.naam in (select naam from _r where k=c.k) join public.regios r on r.naam=c.naam where c.soort='r' on conflict do nothing;
-- extra regelingen bij bestaande NL-fondsen: werkgebied Caribisch deel + thema
insert into public.subsidieregeling_regios (subsidieregeling_id, regio_id) select s.id, r.id from _rx x join public.funders f on f.naam=x.fnaam join public.subsidieregelingen s on s.funder_id=f.id and s.naam=x.naam join public.regios r on r.naam='Caribisch deel van het Koninkrijk' on conflict do nothing;
insert into public.subsidieregeling_themas (subsidieregeling_id, thema_id) select s.id, t.id from _rx x join public.funders f on f.naam=x.fnaam join public.subsidieregelingen s on s.funder_id=f.id and s.naam=x.naam join public.themas t on t.naam = case when x.fnaam='Nederlands Filmfonds' then 'Film' else 'Cultuureducatie' end on conflict do nothing;
