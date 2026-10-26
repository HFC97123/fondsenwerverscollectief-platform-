// In welke provincie ligt een Nederlandse plaats? Een vaste, deterministische lijst (geen AI, geen netwerk): alle gemeenten plus bekende woonplaatsen en
// stadsdelen die naar hun gemeente verwijzen. Wordt gebruikt om een project in bijvoorbeeld Zaandam of Almere aan fondsen voor Noord-Holland resp. Flevoland
// te koppelen, en om de AI-beoordeling te vertellen dat "Amsterdam" in Noord-Holland ligt.
//
// Regels:
//   - De provincienamen zijn precies die van onze werkgebieden (Noord-Holland, Zuid-Holland, ...), zodat ze direct met de fondsgegevens vergeleken kunnen worden.
//   - Een naam die in meer dan één provincie voorkomt (Bergen, Hengelo, Beek, Rijswijk) wordt NIET geraden: dan is de plaats "vaag" en krijgt ze geen provincie.
//   - Een korte naam die ook een gewoon woord is (Best, Echt, Stein, ...) telt alleen mee als hij met een hoofdletter is geschreven.
//   - De lijst staat in de code (gemeenten naar de indeling van 2026); een woonplaats die er niet in staat, wordt gewoon niet herkend en niet geraden.

export const PROVINCIES = ['Drenthe', 'Flevoland', 'Friesland', 'Gelderland', 'Groningen', 'Limburg', 'Noord-Brabant', 'Noord-Holland', 'Overijssel', 'Utrecht', 'Zeeland', 'Zuid-Holland'] as const;
export type Provincie = (typeof PROVINCIES)[number];

// gemeenten per provincie
const GEMEENTEN: Record<Provincie, string[]> = {
  Drenthe: ['Aa en Hunze', 'Assen', 'Borger-Odoorn', 'Coevorden', 'De Wolden', 'Emmen', 'Hoogeveen', 'Meppel', 'Midden-Drenthe', 'Noordenveld', 'Tynaarlo', 'Westerveld'],
  Flevoland: ['Almere', 'Dronten', 'Lelystad', 'Noordoostpolder', 'Urk', 'Zeewolde'],
  Friesland: ['Achtkarspelen', 'Ameland', 'De Fryske Marren', 'Dantumadiel', 'Harlingen', 'Heerenveen', 'Leeuwarden', 'Noardeast-Fryslân', 'Ooststellingwerf', 'Opsterland', 'Schiermonnikoog', 'Smallingerland', 'Súdwest-Fryslân', 'Terschelling', 'Tytsjerksteradiel', 'Vlieland', 'Waadhoeke', 'Weststellingwerf'],
  Gelderland: ['Aalten', 'Apeldoorn', 'Arnhem', 'Barneveld', 'Berg en Dal', 'Berkelland', 'Beuningen', 'Bronckhorst', 'Brummen', 'Buren', 'Culemborg', 'Doesburg', 'Doetinchem', 'Druten', 'Duiven', 'Ede', 'Elburg', 'Epe', 'Ermelo', 'Harderwijk', 'Hattem', 'Heerde', 'Heumen', 'Lingewaard', 'Lochem', 'Maasdriel', 'Montferland', 'Neder-Betuwe', 'Nijkerk', 'Nijmegen', 'Nunspeet', 'Oldebroek', 'Oost Gelre', 'Oude IJsselstreek', 'Overbetuwe', 'Putten', 'Renkum', 'Rheden', 'Rozendaal', 'Scherpenzeel', 'Tiel', 'Voorst', 'Wageningen', 'West Betuwe', 'West Maas en Waal', 'Westervoort', 'Wijchen', 'Winterswijk', 'Zaltbommel', 'Zevenaar', 'Zutphen'],
  Groningen: ['Eemsdelta', 'Groningen', 'Het Hogeland', 'Midden-Groningen', 'Oldambt', 'Pekela', 'Stadskanaal', 'Veendam', 'Westerkwartier', 'Westerwolde'],
  Limburg: ['Beekdaelen', 'Beesel', 'Brunssum', 'Echt-Susteren', 'Eijsden-Margraten', 'Gennep', 'Gulpen-Wittem', 'Heerlen', 'Horst aan de Maas', 'Kerkrade', 'Landgraaf', 'Leudal', 'Maasgouw', 'Maastricht', 'Meerssen', 'Mook en Middelaar', 'Nederweert', 'Peel en Maas', 'Roerdalen', 'Roermond', 'Simpelveld', 'Sittard-Geleen', 'Stein', 'Vaals', 'Valkenburg aan de Geul', 'Venlo', 'Venray', 'Voerendaal', 'Weert'],
  'Noord-Brabant': ['Alphen-Chaam', 'Altena', 'Asten', 'Baarle-Nassau', 'Bergeijk', 'Bergen op Zoom', 'Bernheze', 'Best', 'Bladel', 'Boekel', 'Boxtel', 'Breda', 'Cranendonck', 'Deurne', 'Dongen', 'Drimmelen', 'Eersel', 'Eindhoven', 'Etten-Leur', 'Geertruidenberg', 'Geldrop-Mierlo', 'Gemert-Bakel', 'Gilze en Rijen', 'Goirle', 'Halderberge', 'Heeze-Leende', 'Helmond', "'s-Hertogenbosch", 'Heusden', 'Hilvarenbeek', 'Laarbeek', 'Land van Cuijk', 'Loon op Zand', 'Maashorst', 'Meierijstad', 'Moerdijk', 'Nuenen', 'Oirschot', 'Oisterwijk', 'Oosterhout', 'Oss', 'Reusel-De Mierden', 'Roosendaal', 'Rucphen', 'Sint-Michielsgestel', 'Someren', 'Son en Breugel', 'Steenbergen', 'Tilburg', 'Valkenswaard', 'Veldhoven', 'Vught', 'Waalre', 'Waalwijk', 'Woensdrecht', 'Zundert'],
  'Noord-Holland': ['Aalsmeer', 'Alkmaar', 'Amstelveen', 'Amsterdam', 'Beverwijk', 'Blaricum', 'Bloemendaal', 'Castricum', 'Den Helder', 'Diemen', 'Dijk en Waard', 'Drechterland', 'Edam-Volendam', 'Enkhuizen', 'Gooise Meren', 'Haarlem', 'Haarlemmermeer', 'Heemskerk', 'Heemstede', 'Heiloo', 'Hilversum', 'Hollands Kroon', 'Hoorn', 'Huizen', 'Koggenland', 'Landsmeer', 'Laren', 'Medemblik', 'Oostzaan', 'Opmeer', 'Ouder-Amstel', 'Purmerend', 'Schagen', 'Stede Broec', 'Texel', 'Uitgeest', 'Uithoorn', 'Velsen', 'Waterland', 'Wijdemeren', 'Wormerland', 'Zaanstad', 'Zandvoort'],
  Overijssel: ['Almelo', 'Borne', 'Dalfsen', 'Deventer', 'Dinkelland', 'Enschede', 'Haaksbergen', 'Hardenberg', 'Hellendoorn', 'Hof van Twente', 'Kampen', 'Losser', 'Oldenzaal', 'Olst-Wijhe', 'Ommen', 'Raalte', 'Rijssen-Holten', 'Staphorst', 'Steenwijkerland', 'Tubbergen', 'Twenterand', 'Wierden', 'Zwartewaterland', 'Zwolle'],
  Utrecht: ['Amersfoort', 'Baarn', 'Bunnik', 'Bunschoten', 'De Bilt', 'De Ronde Venen', 'Eemnes', 'Houten', 'IJsselstein', 'Leusden', 'Lopik', 'Montfoort', 'Nieuwegein', 'Oudewater', 'Rhenen', 'Soest', 'Stichtse Vecht', 'Utrecht', 'Utrechtse Heuvelrug', 'Veenendaal', 'Vijfheerenlanden', 'Wijk bij Duurstede', 'Woerden', 'Woudenberg', 'Zeist'],
  Zeeland: ['Borsele', 'Goes', 'Hulst', 'Kapelle', 'Middelburg', 'Noord-Beveland', 'Reimerswaal', 'Schouwen-Duiveland', 'Sluis', 'Terneuzen', 'Tholen', 'Veere', 'Vlissingen'],
  'Zuid-Holland': ['Albrandswaard', 'Alblasserdam', 'Alphen aan den Rijn', 'Barendrecht', 'Bodegraven-Reeuwijk', 'Capelle aan den IJssel', 'Delft', 'Dordrecht', 'Goeree-Overflakkee', 'Gorinchem', 'Gouda', 'Den Haag', 'Hardinxveld-Giessendam', 'Hendrik-Ido-Ambacht', 'Hillegom', 'Hoeksche Waard', 'Kaag en Braassem', 'Katwijk', 'Krimpen aan den IJssel', 'Krimpenerwaard', 'Lansingerland', 'Leiden', 'Leiderdorp', 'Leidschendam-Voorburg', 'Lisse', 'Maassluis', 'Midden-Delfland', 'Molenlanden', 'Nieuwkoop', 'Nissewaard', 'Noordwijk', 'Oegstgeest', 'Papendrecht', 'Pijnacker-Nootdorp', 'Ridderkerk', 'Rijswijk', 'Rotterdam', 'Schiedam', 'Sliedrecht', 'Teylingen', 'Vlaardingen', 'Voorschoten', 'Voorne aan Zee', 'Waddinxveen', 'Wassenaar', 'Westland', 'Zoetermeer', 'Zoeterwoude', 'Zuidplas', 'Zwijndrecht'],
};

// bekende woonplaatsen, stadsdelen en andere schrijfwijzen -> gemeente ("alias>gemeente")
const ALIASSEN: string[] = [
  // Noord-Holland
  'Zaandam>Zaanstad', 'Zaandijk>Zaanstad', 'Koog aan de Zaan>Zaanstad', 'Wormerveer>Zaanstad', 'Krommenie>Zaanstad', 'Assendelft>Zaanstad', 'Westzaan>Zaanstad',
  'Amsterdam-Noord>Amsterdam', 'Amsterdam Noord>Amsterdam', 'Amsterdam-Zuid>Amsterdam', 'Amsterdam Zuid>Amsterdam', 'Amsterdam-Oost>Amsterdam', 'Amsterdam Oost>Amsterdam', 'Amsterdam-West>Amsterdam', 'Amsterdam West>Amsterdam', 'Amsterdam-Zuidoost>Amsterdam', 'Amsterdam Zuidoost>Amsterdam', 'Zuidoost>Amsterdam', 'Bijlmer>Amsterdam', 'Amsterdam Nieuw-West>Amsterdam', 'Nieuw-West>Amsterdam', 'IJburg>Amsterdam', 'Weesp>Amsterdam', 'Sloterdijk>Amsterdam',
  'Hoofddorp>Haarlemmermeer', 'Nieuw-Vennep>Haarlemmermeer', 'Badhoevedorp>Haarlemmermeer', 'Schiphol>Haarlemmermeer', 'Abcoude>De Ronde Venen', 'Mijdrecht>De Ronde Venen', 'Vinkeveen>De Ronde Venen',
  'IJmuiden>Velsen', 'Santpoort>Velsen', 'Velserbroek>Velsen', 'Volendam>Edam-Volendam', 'Edam>Edam-Volendam', 'Monnickendam>Waterland', 'Marken>Waterland', 'Broek in Waterland>Waterland',
  'Bussum>Gooise Meren', 'Naarden>Gooise Meren', 'Muiden>Gooise Meren', 'Nederhorst den Berg>Wijdemeren', 'Loosdrecht>Wijdemeren', 'Kortenhoef>Wijdemeren',
  'Alkmaar>Alkmaar', 'Heerhugowaard>Dijk en Waard', 'Langedijk>Dijk en Waard', 'Broek op Langedijk>Dijk en Waard', 'Julianadorp>Den Helder', 'Den Burg>Texel', 'Anna Paulowna>Hollands Kroon', 'Wieringerwerf>Hollands Kroon', 'Middenmeer>Hollands Kroon',
  'Bergen aan Zee>Bergen (NH)', 'Egmond aan Zee>Bergen (NH)', 'Egmond>Bergen (NH)', 'Zuid-Scharwoude>Dijk en Waard',
  // Zuid-Holland
  "'s-Gravenhage>Den Haag", 'Scheveningen>Den Haag', 'Loosduinen>Den Haag', 'Kijkduin>Den Haag', 'Leidschendam>Leidschendam-Voorburg', 'Voorburg>Leidschendam-Voorburg', 'Stompwijk>Leidschendam-Voorburg',
  'Hoek van Holland>Rotterdam', 'Kralingen>Rotterdam', 'Hillegersberg>Rotterdam', 'Overschie>Rotterdam', 'Delfshaven>Rotterdam', 'Feijenoord>Rotterdam', 'IJsselmonde>Rotterdam', 'Charlois>Rotterdam', 'Prins Alexander>Rotterdam', 'Pernis>Rotterdam', 'Rotterdam-Zuid>Rotterdam', 'Rotterdam Zuid>Rotterdam', 'Rotterdam-Noord>Rotterdam', 'Rotterdam Noord>Rotterdam', 'Hoogvliet>Rotterdam',
  'Spijkenisse>Nissewaard', 'Hellevoetsluis>Voorne aan Zee', 'Brielle>Voorne aan Zee', 'Rockanje>Voorne aan Zee', 'Oostvoorne>Voorne aan Zee', 'Heenvliet>Voorne aan Zee',
  'Katwijk aan Zee>Katwijk', 'Rijnsburg>Katwijk', 'Valkenburg>Katwijk', 'Noordwijkerhout>Noordwijk', 'Sassenheim>Teylingen', 'Voorhout>Teylingen', 'Warmond>Teylingen', 'Alphen>Alphen aan den Rijn', 'Gouda>Gouda', 'Reeuwijk>Bodegraven-Reeuwijk', 'Bodegraven>Bodegraven-Reeuwijk',
  'Westland>Westland', 'Naaldwijk>Westland', 'Monster>Westland', "'s-Gravenzande>Westland", 'Wateringen>Westland', 'Pijnacker>Pijnacker-Nootdorp', 'Nootdorp>Pijnacker-Nootdorp', 'Berkel en Rodenrijs>Lansingerland', 'Bergschenhoek>Lansingerland', 'Bleiswijk>Lansingerland',
  'Capelle>Capelle aan den IJssel', 'Krimpen>Krimpen aan den IJssel', 'Ouddorp>Goeree-Overflakkee', 'Middelharnis>Goeree-Overflakkee', 'Zierikzee>Schouwen-Duiveland',
  // Utrecht
  'Maarssen>Stichtse Vecht', 'Breukelen>Stichtse Vecht', 'Loenen aan de Vecht>Stichtse Vecht', 'Driebergen>Utrechtse Heuvelrug', 'Doorn>Utrechtse Heuvelrug', 'Leersum>Utrechtse Heuvelrug', 'Amerongen>Utrechtse Heuvelrug', 'Bilthoven>De Bilt', 'Maartensdijk>De Bilt', 'Den Dolder>Zeist', 'Bosch en Duin>Zeist', 'Vleuten>Utrecht', 'Leidsche Rijn>Utrecht', 'Overvecht>Utrecht', 'Kanaleneiland>Utrecht', 'Lunetten>Utrecht', 'Zuilen>Utrecht', 'De Meern>Utrecht', 'Vianen>Vijfheerenlanden', 'Leerdam>Vijfheerenlanden', 'Everdingen>Vijfheerenlanden', 'Harmelen>Woerden', 'Kamerik>Woerden', 'Vinkeveen>De Ronde Venen',
  // Flevoland
  'Almere Stad>Almere', 'Almere Haven>Almere', 'Almere Buiten>Almere', 'Almere Poort>Almere', 'Almere Hout>Almere', 'Almere Pampus>Almere', 'Emmeloord>Noordoostpolder', 'Biddinghuizen>Dronten', 'Swifterbant>Dronten',
  // Gelderland
  'Lent>Nijmegen', 'Dukenburg>Nijmegen', 'Arnhem-Zuid>Arnhem', 'Velp>Rheden', 'Dieren>Rheden', 'Rheden>Rheden', 'Oosterbeek>Renkum', 'Doorwerth>Renkum', 'Bennekom>Ede', 'Lunteren>Ede', 'Otterlo>Ede', 'Bemmel>Lingewaard', 'Huissen>Lingewaard', 'Gendt>Lingewaard', 'Elst>Overbetuwe', 'Zetten>Overbetuwe', 'Heteren>Overbetuwe', 'Ewijk>Beuningen', 'Winssen>Beuningen', 'Groesbeek>Berg en Dal', 'Beek-Ubbergen>Berg en Dal', 'Kekerdom>Berg en Dal', 'Lichtenvoorde>Oost Gelre', 'Groenlo>Oost Gelre', 'Eibergen>Berkelland', 'Neede>Berkelland', 'Ruurlo>Bronckhorst', 'Hengelo (Gld)>Bronckhorst', 'Vorden>Bronckhorst', 'Zelhem>Bronckhorst', 'Terborg>Oude IJsselstreek', 'Ulft>Oude IJsselstreek', 'Gaanderen>Doetinchem', 'Wehl>Doetinchem',
  // Overijssel
  'Rijssen>Rijssen-Holten', 'Holten>Rijssen-Holten', 'Vriezenveen>Twenterand', 'Vroomshoop>Twenterand', 'Nijverdal>Hellendoorn', 'Hellendoorn>Hellendoorn', 'Genemuiden>Zwartewaterland', 'Hasselt>Zwartewaterland', 'Zwartsluis>Zwartewaterland', 'IJsselmuiden>Kampen', 'Wijhe>Olst-Wijhe', 'Olst>Olst-Wijhe', 'Steenwijk>Steenwijkerland', 'Giethoorn>Steenwijkerland', 'Denekamp>Dinkelland', 'Weerselo>Dinkelland', 'Delden>Hof van Twente', 'Goor>Hof van Twente', 'Diepenheim>Hof van Twente', 'Ommen>Ommen', 'Emmeloord>Noordoostpolder',
  // Friesland
  'Sneek>Súdwest-Fryslân', 'Bolsward>Súdwest-Fryslân', 'Workum>Súdwest-Fryslân', 'Joure>De Fryske Marren', 'Lemmer>De Fryske Marren', 'Drachten>Smallingerland', 'Surhuisterveen>Achtkarspelen', 'Burgum>Tytsjerksteradiel', 'Dokkum>Noardeast-Fryslân', 'Franeker>Waadhoeke', 'Berlikum>Waadhoeke', 'Wolvega>Weststellingwerf', 'Oosterwolde>Ooststellingwerf', 'Gorredijk>Opsterland', 'Leeuwarden>Leeuwarden',
  // Groningen
  'Delfzijl>Eemsdelta', 'Appingedam>Eemsdelta', 'Winsum>Het Hogeland', 'Bedum>Het Hogeland', 'Uithuizen>Het Hogeland', 'Hoogezand>Midden-Groningen', 'Sappemeer>Midden-Groningen', 'Winschoten>Oldambt', 'Scheemda>Oldambt', 'Leek>Westerkwartier', 'Zuidhorn>Westerkwartier', 'Ter Apel>Westerwolde', 'Vlagtwedde>Westerwolde', 'Haren>Groningen',
  // Drenthe
  'Zuidlaren>Tynaarlo', 'Vries>Tynaarlo', 'Roden>Noordenveld', 'Norg>Noordenveld', 'Beilen>Midden-Drenthe', 'Westerbork>Midden-Drenthe', 'Zuidwolde>De Wolden', 'Ruinen>De Wolden', 'Klazienaveen>Emmen', 'Erica>Emmen', 'Odoorn>Borger-Odoorn', 'Borger>Borger-Odoorn', 'Gieten>Aa en Hunze', 'Rolde>Aa en Hunze', 'Dwingeloo>Westerveld', 'Diever>Westerveld',
  // Limburg
  'Sittard>Sittard-Geleen', 'Geleen>Sittard-Geleen', 'Born>Sittard-Geleen', 'Susteren>Echt-Susteren', 'Echt>Echt-Susteren', 'Margraten>Eijsden-Margraten', 'Eijsden>Eijsden-Margraten', 'Wittem>Gulpen-Wittem', 'Gulpen>Gulpen-Wittem', 'Valkenburg>Valkenburg aan de Geul', 'Heerlen>Heerlen', 'Hoensbroek>Heerlen', 'Nieuwenhagen>Landgraaf', 'Schaesberg>Landgraaf', 'Kerkrade>Kerkrade', 'Horst>Horst aan de Maas', 'Sevenum>Horst aan de Maas', 'Helden>Peel en Maas', 'Panningen>Peel en Maas', 'Baexem>Leudal', 'Heythuysen>Leudal', 'Thorn>Maasgouw', 'Maasbracht>Maasgouw', 'Schinnen>Beekdaelen', 'Nuth>Beekdaelen', 'Munstergeleen>Sittard-Geleen',
  // Noord-Brabant
  'Den Bosch>\'s-Hertogenbosch', "'s Hertogenbosch>'s-Hertogenbosch", 'Den Bosch>\'s-Hertogenbosch', 'Rosmalen>\'s-Hertogenbosch', 'Nuenen, Gerwen en Nederwetten>Nuenen', 'Eindhoven>Eindhoven', 'Woensel>Eindhoven', 'Strijp>Eindhoven', 'Geldrop>Geldrop-Mierlo', 'Mierlo>Geldrop-Mierlo', 'Mierlo-Hout>Helmond', 'Veghel>Meierijstad', 'Schijndel>Meierijstad', 'Sint-Oedenrode>Meierijstad', 'Uden>Maashorst', 'Veghel>Meierijstad', 'Cuijk>Land van Cuijk', 'Boxmeer>Land van Cuijk', 'Grave>Land van Cuijk', 'Sint Anthonis>Land van Cuijk', 'Mill>Land van Cuijk', 'Gemert>Gemert-Bakel', 'Bakel>Gemert-Bakel', 'Heeze>Heeze-Leende', 'Leende>Heeze-Leende', 'Reusel>Reusel-De Mierden', 'Hoogeloon>Bladel', 'Dongen>Dongen', 'Raamsdonksveer>Geertruidenberg', 'Made>Drimmelen', 'Oudenbosch>Halderberge', 'Hoeven>Halderberge', 'Wouw>Roosendaal', 'Etten>Etten-Leur', 'Leur>Etten-Leur', 'Prinsenbeek>Breda', 'Teteringen>Breda', 'Ulvenhout>Breda', 'Udenhout>Tilburg', 'Berkel-Enschot>Tilburg', 'Berkel Enschot>Tilburg', 'Loon op Zand>Loon op Zand', 'Kaatsheuvel>Loon op Zand', 'Waspik>Waalwijk', 'Sint-Michielsgestel>Sint-Michielsgestel', 'Gestel>Sint-Michielsgestel', 'Haaren>Oisterwijk', 'Esch>Haaren',
  // Zeeland
  'Middelburg>Middelburg', 'Vlissingen>Vlissingen', 'Hulst>Hulst', 'Axel>Terneuzen', 'Sas van Gent>Terneuzen', 'Oostburg>Sluis', 'Cadzand>Sluis', 'Veere>Veere', 'Domburg>Veere', 'Yerseke>Reimerswaal', 'Kruiningen>Reimerswaal', 'Zierikzee>Schouwen-Duiveland', 'Renesse>Schouwen-Duiveland', 'Zoutelande>Veere', 'Westkapelle>Veere',
];

// namen die in meer dan één provincie voorkomen (als gemeente of als bekende woonplaats): nooit raden
const AMBIGU = new Set(['bergen', 'hengelo', 'beek', 'rijswijk', 'valkenburg', 'esch', 'haren', 'hasselt', 'born', 'leur', 'mill', 'oosterwolde', 'zuidwolde', 'laren', 'elst', 'velp', 'oosterhout', 'nederhorst', 'ommen']);

// korte namen die ook een gewoon woord zijn: alleen met hoofdletter
const GEWOON_WOORD = new Set(['best', 'echt', 'stein', 'putten', 'sluis', 'borne', 'leek', 'goes', 'made', 'hoeven', 'rolde', 'norg', 'urk', 'buren', 'houten', 'huizen', 'leiden', 'hoorn', 'kapelle', 'weert', 'mook', 'grave', 'borger', 'ruinen', 'roden', 'vries', 'doorn', 'thorn', 'horst', 'wouw', 'axel', 'monster', 'zuilen', 'marken', 'erica', 'lent', 'losser', 'tiel', 'wijk', 'asten', 'dijk', 'vaals', 'delft', 'ede', 'epe', 'oss']);

const norm = (t: unknown): string =>
  String(t ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`´]/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export interface PlaatsInfo {
  plaats: string; // zoals in de lijst (de gemeente of de bekende woonplaats)
  gemeente: string;
  provincie: Provincie;
}

const INDEX = new Map<string, PlaatsInfo>();
const MAX_WOORDEN = 4;

function voegToe(naam: string, gemeente: string, provincie: Provincie, weergave: string = naam) {
  const sleutel = norm(naam);

  if (!sleutel || AMBIGU.has(sleutel) || INDEX.has(sleutel)) return;

  INDEX.set(sleutel, { plaats: weergave, gemeente, provincie });
}

const GEMEENTE_PROVINCIE = new Map<string, Provincie>();

for (const p of PROVINCIES) {
  for (const g of GEMEENTEN[p]) {
    GEMEENTE_PROVINCIE.set(norm(g), p);
    voegToe(g, g, p);
  }
}

// Schrijfwijzen van gemeenten die anders geschreven worden dan in de lijst.
const SCHRIJFWIJZEN: Record<string, string> = { "'s-gravenhage": 'Den Haag', 'den bosch': "'s-Hertogenbosch", 's hertogenbosch': "'s-Hertogenbosch", 'nuenen gerwen en nederwetten': 'Nuenen', 'nuenen c a': 'Nuenen', 'groningen stad': 'Groningen' };

for (const [alias, gemeente] of Object.entries(SCHRIJFWIJZEN)) {
  const p = GEMEENTE_PROVINCIE.get(norm(gemeente));

  if (p) voegToe(alias, gemeente, p, gemeente);
}

for (const regel of ALIASSEN) {
  const [alias, doel] = regel.split('>');
  const p = GEMEENTE_PROVINCIE.get(norm(doel));

  if (p) voegToe(alias, doel, p);
}

// Alle plaatsen die in de tekst staan (langste naam eerst, elke tekstplek maar één keer), elk met gemeente en provincie. De naam van een provincie zelf
// ("Noord-Holland") wordt hier niet als plaats geteld. Een dubbelzinnige naam (Bergen) geeft niets terug maar wordt in `vaag` gemeld.
export function plaatsenUitTekst(tekst: unknown): { gevonden: PlaatsInfo[]; vaag: string[] } {
  const ruw = String(tekst ?? '');
  const woorden = norm(ruw).split(' ').filter(Boolean);
  const origineel = ruw.replace(/[^\p{L}\p{N}' -]+/gu, ' ').split(/[\s-]+/).filter(Boolean);
  const gevonden: PlaatsInfo[] = [];
  const vaag: string[] = [];
  const gebruikt = new Array(woorden.length).fill(false);

  for (let n = Math.min(MAX_WOORDEN, woorden.length); n >= 1; n -= 1) {
    for (let i = 0; i + n <= woorden.length; i += 1) {
      if (gebruikt.slice(i, i + n).some(Boolean)) continue;

      const sleutel = woorden.slice(i, i + n).join(' ');

      if (AMBIGU.has(sleutel)) {
        if (!vaag.includes(sleutel)) vaag.push(sleutel);
        for (let k = i; k < i + n; k += 1) gebruikt[k] = true;
        continue;
      }

      const info = INDEX.get(sleutel);

      if (!info) continue;

      // een gewoon woord telt alleen met hoofdletter (de tekst "Best" ja, "het is best leuk" nee)
      if (GEWOON_WOORD.has(sleutel) && !/^\p{Lu}/u.test(origineel[i] ?? '')) continue;

      for (let k = i; k < i + n; k += 1) gebruikt[k] = true;
      if (!gevonden.some((g) => g.gemeente === info.gemeente)) gevonden.push(info);
    }
  }

  return { gevonden, vaag };
}

// De provincies (zonder dubbelen) van de plaatsen in een tekst.
export function provinciesUitTekst(tekst: unknown): Provincie[] {
  return Array.from(new Set(plaatsenUitTekst(tekst).gevonden.map((g) => g.provincie)));
}

// De provincie bij één naam (een werkgebied of een plaats): de naam van een provincie zelf, anders de provincie van de plaats; of null.
export function provincieVanNaam(naam: unknown): Provincie | null {
  const n = norm(naam);
  const eigen = PROVINCIES.find((p) => norm(p) === n);

  if (eigen) return eigen;

  return plaatsenUitTekst(naam).gevonden[0]?.provincie ?? null;
}

// Eén zin per plaats voor de AI: "Zaandam (gemeente Zaanstad) ligt in de provincie Noord-Holland".
export function ligtInZinnen(teksten: unknown[]): string[] {
  const zinnen: string[] = [];

  for (const t of teksten) {
    for (const g of plaatsenUitTekst(t).gevonden) {
      // "Utrecht ligt in de provincie Utrecht" zegt de AI niets nieuws
      if (norm(g.plaats) === norm(g.provincie)) continue;

      const zin = norm(g.plaats) === norm(g.gemeente) ? `${g.plaats} ligt in de provincie ${g.provincie}` : `${g.plaats} (gemeente ${g.gemeente}) ligt in de provincie ${g.provincie}`;

      if (!zinnen.includes(zin)) zinnen.push(zin);
    }
  }

  return zinnen.slice(0, 4);
}

export const AANTAL_PLAATSEN = INDEX.size;
