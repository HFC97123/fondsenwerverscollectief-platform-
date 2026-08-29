import React from 'react';
import FundingDatabaseCount from '../../shared/ui/FundingDatabaseCount.jsx';

// Goedgekeurde tekst van de veelgestelde vragen.
// Dit is de standaard: staat er inhoud in Supabase (tabel kompas_faq), dan gaat
// die voor. Zie data/services/marketing.js.
export const FAQ_SECTIONS = [
  {
    title: 'Algemeen',
    items: [
      {
        q: 'Wat doet Subsidie Kompas?',
        blocks: [
          'Subsidie Kompas helpt u aan projectfinanciering. U vraagt om een fondsenscan, laat een aanvraag beoordelen, werkt een fondsenwervende strategie uit of verbetert uw projectplan. U krijgt antwoord in gesprek, met concrete vervolgstappen.',
        ],
      },
      {
        q: 'Bij wie kan ik terecht met een vraag?',
        blocks: [
          'Neem contact op via de contactpagina van Het Fondsenwervers Collectief. Leden kunnen hun vraag ook in het netwerk stellen bij vakgenoten.',
        ],
      },
    ],
  },
  {
    title: 'Abonnementen',
    items: [
      {
        q: 'Wat is het verschil tussen Free, Pro en Premium?',
        blocks: [
          'Subsidie Kompas is beschikbaar in drie abonnementen, zodat u kunt kiezen welke ondersteuning het beste aansluit bij uw organisatie.',
          'Free (€0 per maand)',
          'Free biedt toegang tot de AI-chat van Subsidie Kompas en actuele internetinformatie. U kunt onder andere:',
          {
            list: [
              'AI-chat gebruiken;',
              'actuele subsidieregelingen en fondsen zoeken via internet;',
              'een eerste fondsenscan uitvoeren;',
              'matchchecks uitvoeren;',
              'projectplannen laten beoordelen;',
              'subsidieadviezen ontvangen;',
              'SMART-doelen opstellen;',
              'begrotingen beoordelen;',
              'feedback krijgen op subsidieaanvragen;',
              'fondsenwervende strategieën laten uitwerken.',
            ],
          },
          'Free bevat geen documentgenerator, exports, chatgeschiedenis, kennisbank of organisatiegeheugen.',
          'Pro (€12 per maand)',
          'Pro bevat alle functies van Free, aangevuld met professionele documentfunctionaliteiten en personalisatie.',
          'Daarnaast kunt u:',
          {
            list: [
              'gesprekken opslaan en later hervatten;',
              'Word-documenten genereren;',
              'PDF-documenten genereren;',
              'Excel-bestanden exporteren;',
              'professionele subsidieadviezen genereren;',
              'complete projectplannen en fondsenscans laten schrijven;',
              'documenten uploaden;',
              'uw eigen organisatienaam en logo gebruiken;',
              'uw eigen Word-sjablonen gebruiken;',
              'kleuren en basis-huisstijl toepassen;',
              'persoonlijke schrijfvoorkeuren instellen.',
            ],
          },
          'Pro is ontwikkeld voor organisaties die regelmatig subsidieaanvragen schrijven.',
          'Premium (€39 per maand)',
          'Premium bevat alle functies van Pro én uw eigen persoonlijke AI-fondsenwerver.',
          'Naast actuele internetinformatie gebruikt Premium ook:',
          {
            list: [
              'de exclusieve Subsidie Kompas-fondsendatabase;',
              'uw organisatieprofiel;',
              'uw kennisbank;',
              'uw organisatiegeheugen;',
              'eerdere gesprekken;',
              'eerder geschreven subsidieaanvragen;',
              'eerder gegenereerde documenten;',
              'uw eigen schrijfstijl (tone of voice);',
              'uw eigen Word-, Excel- en PowerPoint-sjablonen.',
            ],
          },
          'Hierdoor leert Premium uw organisatie steeds beter kennen en worden adviezen steeds persoonlijker en consistenter.',
          'Premium ondersteunt onder andere bij:',
          {
            list: [
              'geavanceerde fondsselecties;',
              'strategische analyses;',
              'meerjarige fondsenwervende strategieën;',
              'Excel-planningen;',
              'complexe subsidietrajecten.',
            ],
          },
          'Premium is ontwikkeld voor organisaties die structureel fondsen werven.',
        ],
      },
      {
        q: 'Is Premium slimmer dan Free?',
        blocks: [
          'Ja.',
          'Free baseert adviezen op actuele internetinformatie en de informatie die u tijdens het gesprek verstrekt.',
          'Premium gebruikt daarnaast meerdere aanvullende informatiebronnen, waaronder:',
          {
            list: [
              'de exclusieve Subsidie Kompas-fondsendatabase;',
              'uw organisatieprofiel;',
              'uw kennisbank;',
              'eerdere gesprekken;',
              'eerder gegenereerde documenten;',
              'uw schrijfstijl;',
              'uw eigen uploads.',
            ],
          },
          'Daardoor worden adviezen specifieker, consistenter en beter afgestemd op uw organisatie.',
        ],
      },
      {
        q: 'Waarom kost Premium €39 per maand?',
        blocks: [
          'Premium is meer dan een AI-chatbot.',
          'Premium functioneert als een persoonlijke AI-fondsenwerver die uw organisatie leert kennen. Het systeem analyseert uw organisatie, gebruikt een uitgebreide exclusieve fondsendatabase, onthoudt relevante context en ondersteunt gedurende het volledige fondsenwervingsproces: van strategie en fondsselectie tot projectplannen, begrotingen en subsidieaanvragen.',
        ],
      },
      {
        q: 'Kan ik op ieder moment upgraden?',
        blocks: [
          'Ja.',
          'U kunt uw abonnement op ieder moment upgraden. De nieuwe functionaliteiten worden direct beschikbaar.',
        ],
      },
      {
        q: 'Kan ik downgraden?',
        blocks: [
          'Ja.',
          'Wanneer u uw abonnement wijzigt naar een lager abonnement, blijft uw huidige abonnement actief tot het einde van de reeds betaalde abonnementsperiode. Daarna wordt uw nieuwe abonnement automatisch geactiveerd.',
        ],
      },
      {
        q: 'Is er een proefperiode?',
        blocks: [
          'Ja.',
          {
            list: [
              'Pro kunt u 7 dagen gratis uitproberen.',
              'Premium kunt u 24 uur gratis uitproberen.',
            ],
          },
          'Na afloop van de proefperiode wordt het abonnement automatisch omgezet naar een betaald abonnement, tenzij u vóór het einde van de proefperiode opzegt.',
          'De abonnementskosten worden maandelijks vooraf geïncasseerd. Uw abonnement wordt iedere maand automatisch verlengd op de datum waarop u oorspronkelijk bent gestart. U kunt uw abonnement op ieder moment opzeggen. De opzegging gaat in aan het einde van de reeds betaalde abonnementsperiode.',
        ],
      },
    ],
  },
  {
    title: 'AI en betrouwbaarheid',
    items: [
      {
        q: 'Zijn de antwoorden altijd juist?',
        blocks: [
          'Subsidie Kompas gebruikt kunstmatige intelligentie om u te ondersteunen bij fondsenwerving, subsidiematching en projectontwikkeling.',
          'Hoewel wij streven naar zo correct mogelijke informatie, kunnen AI-antwoorden onvolledig, verouderd of onjuist zijn.',
          'De informatie uit de exclusieve Subsidie Kompas-fondsendatabase wordt zorgvuldig onderhouden en gecontroleerd. Toch adviseren wij u altijd de meest recente voorwaarden op de website van de betreffende subsidieverstrekker of het fonds te raadplegen voordat u een aanvraag indient.',
          'Subsidie Kompas ondersteunt u als deskundig adviseur en gids bij fondsenwerving. Omdat uitsluitend het fonds of de subsidieverstrekker beslist over een toekenning, kan nooit garantie op financiering worden gegeven.',
        ],
      },
      {
        q: 'Garandeert Subsidie Kompas subsidie of fondsen?',
        blocks: [
          'Nee.',
          'Subsidie Kompas ondersteunt u bij het vinden van passende financieringsmogelijkheden, het schrijven van sterke aanvragen en het ontwikkelen van een effectieve fondsenwervingsstrategie.',
          'Een positieve match of een goed advies betekent nooit dat een subsidie of fonds wordt toegekend.',
          'Uitsluitend het fonds of de subsidieverstrekker beslist over de uiteindelijke toekenning.',
        ],
      },
      {
        q: 'Kan ik met één druk op de knop subsidie aanvragen?',
        blocks: [
          'Nee.',
          'Subsidie Kompas ondersteunt u onder andere bij:',
          {
            list: [
              'onderzoek;',
              'fondsselectie;',
              'matching;',
              'strategie;',
              'projectontwikkeling;',
              'begrotingen;',
              'subsidieaanvragen;',
              'fondsenwervende plannen.',
            ],
          },
          'De uiteindelijke aanvraag wordt altijd door uw organisatie ingediend en blijft uw eigen verantwoordelijkheid.',
        ],
      },
      {
        q: 'Waarom adviseert Premium soms andere fondsen dan Free?',
        blocks: [
          'Premium beschikt over de exclusieve Subsidie Kompas-fondsendatabase.',
          'Deze database bevat aanvullende fondsen en subsidieverstrekkers die niet altijd via openbare internetbronnen eenvoudig te vinden zijn.',
          'Daardoor kan Premium financieringsmogelijkheden signaleren die binnen Free niet beschikbaar zijn.',
        ],
      },
    ],
  },
  {
    title: 'Fondsendatabase',
    items: [
      {
        q: 'Hoe actueel is de fondsendatabase?',
        blocks: [
          'Onze fondsendatabase wordt continu onderhouden en uitgebreid.',
          'Nieuwe fondsen worden toegevoegd, bestaande gegevens worden gecontroleerd en gewijzigde voorwaarden worden verwerkt zodra deze beschikbaar zijn.',
          'Ondanks deze inspanning kunnen voorwaarden, deadlines of contactgegevens tussentijds wijzigen. Controleer daarom altijd de officiële website van de betreffende financier voordat u een aanvraag indient.',
        ],
      },
      {
        q: 'Zijn alle fondsen opgenomen?',
        blocks: [
          <>
            De database bevat op dit moment <FundingDatabaseCount /> fondsen en regelingen.
          </>,
          'Nee, dat is niet alles. Niet alle fondsen publiceren hun regelingen openbaar. Daarnaast ontstaan voortdurend nieuwe fondsen en wijzigen bestaande subsidieregelingen regelmatig.',
          'Wij blijven de database voortdurend uitbreiden.',
        ],
      },
      {
        q: 'Waarom zie ik sommige fondsen niet?',
        blocks: [
          'Dat kan verschillende oorzaken hebben.',
          'Een fonds kan:',
          {
            list: [
              'niet aansluiten bij uw organisatie;',
              'niet passen bij uw project;',
              'tijdelijk gesloten zijn;',
              'verlopen zijn;',
              'uitsluitend beschikbaar zijn binnen Premium.',
            ],
          },
        ],
      },
      {
        q: 'Hoe werkt de exclusieve fondsendatabase?',
        blocks: [
          'Premium combineert actuele internetinformatie met de exclusieve Subsidie Kompas-fondsendatabase.',
          'Daardoor zoekt Premium niet alleen binnen openbare informatie, maar ook binnen zorgvuldig opgebouwde kennis over fondsen en subsidieverstrekkers en andere financieringsmogelijkheden.',
        ],
      },
      {
        q: 'Waar komt de fondsendatabase vandaan?',
        blocks: [
          'De database is samengesteld uit openbare bronnen, eigen onderzoek en voortdurend onderhoud door Subsidie Kompas.',
          'De database wordt continu uitgebreid en geactualiseerd.',
        ],
      },
      {
        q: 'Waarom is deze uitgebreider dan internet?',
        blocks: [
          'Veel fondsen zijn online moeilijk vindbaar of verspreiden informatie via verschillende bronnen.',
          'De fondsendatabase brengt deze informatie samen, structureert deze en koppelt deze aan relevante organisaties, doelgroepen, thema’s en regio’s.',
        ],
      },
      {
        q: 'Hoe vaak wordt de database bijgewerkt?',
        blocks: [
          'Doorlopend.',
          'Nieuwe fondsen, gewijzigde voorwaarden en nieuwe subsidieregelingen worden regelmatig verwerkt.',
        ],
      },
    ],
  },
  {
    title: 'Documenten',
    items: [
      {
        q: 'Van wie zijn de documenten die ik genereer?',
        blocks: [
          'Alle documenten die u met Subsidie Kompas genereert zijn van uw organisatie.',
          'U blijft verantwoordelijk voor de inhoud voordat u deze gebruikt of indient.',
        ],
      },
      {
        q: 'Mag ik AI-teksten letterlijk gebruiken?',
        blocks: [
          'Ja.',
          'Wij adviseren echter altijd de documenten zorgvuldig te controleren en waar nodig aan te passen aan de specifieke situatie van uw organisatie en project.',
        ],
      },
      {
        q: 'Kan ik mijn eigen huisstijl gebruiken?',
        blocks: [
          'Ja.',
          'Vanaf Pro kunt u uw eigen organisatienaam, logo, kleuren en huisstijl toepassen.',
          'Premium ondersteunt daarnaast ook eigen Word-, Excel- en PowerPoint-sjablonen.',
        ],
      },
    ],
  },
  {
    title: 'Organisatiegegevens',
    items: [
      {
        q: 'Worden mijn documenten gebruikt om andere gebruikers te trainen?',
        blocks: [
          'Nee.',
          'Uw documenten, gesprekken en organisatiegegevens worden uitsluitend gebruikt om uw eigen Subsidie Kompas-omgeving beter te laten functioneren.',
          'Uw gegevens worden niet gebruikt om antwoorden voor andere gebruikers te genereren.',
        ],
      },
      {
        q: 'Kan ik mijn gegevens verwijderen?',
        blocks: [
          'Ja.',
          'U kunt op ieder moment verzoeken uw account en bijbehorende gegevens te laten verwijderen overeenkomstig onze privacyverklaring.',
        ],
      },
      {
        q: 'Kan ik gesprekken terugvinden?',
        blocks: [
          'Free bewaart geen chatgeschiedenis.',
          'Binnen Pro en Premium worden gesprekken opgeslagen, zodat u projecten eenvoudig kunt hervatten.',
        ],
      },
      {
        q: 'Leert Premium mijn organisatie kennen?',
        blocks: [
          'Ja.',
          'Premium bouwt een organisatieprofiel op waarin relevante informatie over uw organisatie wordt opgeslagen.',
          'Hierdoor hoeft u informatie niet steeds opnieuw in te voeren.',
        ],
      },
      {
        q: 'Hoe bepaalt Premium welke fondsen relevant zijn?',
        blocks: [
          'Premium kijkt niet alleen naar uw project.',
          'Ook wordt gekeken naar onder andere:',
          {
            list: [
              'organisatie;',
              'missie;',
              'doelgroep;',
              'regio;',
              'thema;',
              'project;',
              'begroting;',
              'eerdere aanvragen;',
              'eerdere gesprekken;',
              'organisatieprofiel.',
            ],
          },
          'Hierdoor worden matches steeds nauwkeuriger.',
        ],
      },
      {
        q: 'Werkt Premium ook met eerdere subsidieaanvragen?',
        blocks: [
          'Ja.',
          'Wanneer u eerdere aanvragen uploadt, kan Premium deze gebruiken als context voor nieuwe documenten en adviezen.',
        ],
      },
      {
        q: 'Kan Premium mijn schrijfstijl overnemen?',
        blocks: [
          'Ja.',
          'Premium kan uw schrijfstijl herkennen en toekomstige documenten daarop laten aansluiten.',
        ],
      },
      {
        q: 'Kan Premium meerdere projecten beheren?',
        blocks: [
          'Ja.',
          'Premium ondersteunt meerdere projecten tegelijkertijd en houdt de context van ieder project gescheiden.',
        ],
      },
      {
        q: 'Hoe werkt het organisatiegeheugen?',
        blocks: [
          'Het organisatiegeheugen slaat relevante informatie op over uw organisatie, zodat Subsidie Kompas deze informatie niet telkens opnieuw hoeft te vragen.',
          'Hierdoor worden gesprekken efficiënter en documenten consistenter.',
        ],
      },
      {
        q: 'Wat gebeurt er als mijn organisatie verandert?',
        blocks: [
          'U kunt uw organisatieprofiel op ieder moment aanpassen.',
          'Nieuwe informatie wordt automatisch meegenomen in toekomstige adviezen.',
        ],
      },
      {
        q: 'Kan ik meerdere collega’s toevoegen?',
        blocks: ['Deze functionaliteit wordt op een later moment beschikbaar.'],
      },
    ],
  },
  {
    title: 'Betaling',
    items: [
      {
        q: 'Hoe werkt de betaling?',
        blocks: [
          'Abonnementen worden maandelijks vooruitbetaald.',
          'Uw abonnement wordt iedere maand automatisch verlengd op dezelfde datum waarop u bent gestart.',
        ],
      },
      {
        q: 'Kan ik opzeggen?',
        blocks: [
          'Ja.',
          'U kunt uw abonnement op ieder moment opzeggen.',
          'Uw abonnement blijft actief tot het einde van de reeds betaalde abonnementsperiode.',
          'Daarna wordt het abonnement automatisch beëindigd.',
        ],
      },
      {
        q: 'Krijg ik geld terug?',
        blocks: [
          'Nee.',
          'Na afloop van de gratis proefperiode wordt uw abonnement automatisch omgezet naar een betaald abonnement.',
          'Reeds betaalde abonnementskosten worden niet gerestitueerd.',
          'Wij adviseren daarom om vóór het einde van de proefperiode op te zeggen wanneer u geen gebruik wilt maken van het betaalde abonnement.',
        ],
      },
    ],
  },
  {
    title: 'Disclaimers',
    items: [
      {
        q: 'Geen juridisch, fiscaal of financieel advies',
        blocks: [
          'Subsidie Kompas ondersteunt u als deskundig adviseur en gids bij fondsenwerving.',
          'Subsidie Kompas verstrekt geen juridisch, fiscaal of financieel advies.',
          'Omdat uitsluitend het fonds of de subsidieverstrekker beslist over een toekenning, kan geen garantie op financiering worden gegeven.',
        ],
      },
      {
        q: 'Geen garantie op financiering',
        blocks: [
          'Het gebruik van Subsidie Kompas kan bijdragen aan betere subsidieaanvragen en sterkere fondsenwerving, maar geeft nooit garantie op subsidie, sponsoring of andere financiering.',
        ],
      },
      {
        q: 'AI kan fouten maken',
        blocks: [
          'Hoewel de AI voortdurend wordt verbeterd, kunnen AI-antwoorden fouten bevatten.',
          'De informatie uit de exclusieve Subsidie Kompas-fondsendatabase wordt zorgvuldig onderhouden, maar controleer bij belangrijke aanvragen altijd de actuele voorwaarden van de betreffende subsidieverstrekker.',
        ],
      },
      {
        q: 'Externe informatie',
        blocks: [
          'Subsidie Kompas maakt gebruik van externe informatie, onder andere van externe websites zoals die van fondsen, overheden, gemeenten en subsidieverstrekkers, en van andere openbare informatiebronnen.',
          'Wij zijn niet verantwoordelijk voor wijzigingen op websites van fondsen, overheden of subsidieverstrekkers.',
        ],
      },
      {
        q: 'Eigen verantwoordelijkheid',
        blocks: [
          'De gebruiker blijft verantwoordelijk voor:',
          {
            list: [
              'de juistheid van ingediende documenten;',
              'de juistheid van verstrekte informatie;',
              'het tijdig en correct uitvoeren van monitoring en evaluatie na een toekenning, inclusief de verantwoording aan de verstrekker;',
              'naleving van subsidievoorwaarden;',
              'het tijdig indienen van aanvragen.',
            ],
          },
        ],
      },
      {
        q: 'Beschikbaarheid',
        blocks: [
          'Wij streven naar een zo hoog mogelijke beschikbaarheid van Subsidie Kompas.',
          'Onderhoud, updates of technische storingen kunnen er echter toe leiden dat de dienstverlening tijdelijk niet beschikbaar is. Hieraan kunnen geen rechten worden ontleend.',
        ],
      },
    ],
  },
];
