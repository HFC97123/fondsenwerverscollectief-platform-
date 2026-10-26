// Inhoud van Collie, de hulpknop rechtsonder in de werkomgeving van Subsidie Kompas (Pro/Premium).
// Pure gegevens en afleidingen, geen React, geen netwerk, geen AI: veelgestelde vragen en een rondleiding.
// Teksten zijn bewust kort en verwijzen met een link naar de plek waar het gebeurt.

export const HULP_CONTACT_EMAIL = 'info@fondsenwerverscollectief.nl';

// De rondleiding staat voor nu uit (de inhoud blijft bewaard). Zet op true om de knop en de rondleiding weer te tonen.
export const TOON_RONDLEIDING = false;

// Rondleiding: de onderdelen van Subsidie Kompas in de volgorde waarin u ze gebruikt.
export const RONDLEIDING = [
  {
    id: 'dashboard',
    titel: 'Dashboard',
    tekst: 'Uw startpagina. U ziet de stand van zaken van al uw projecten: wat nu aandacht vraagt, hoeveel nog gefinancierd moet worden en welke deadlines eraan komen.',
    link: { href: '#/kompas/dashboard', tekst: 'Naar het dashboard' },
  },
  {
    id: 'projecten',
    titel: 'Projecten',
    tekst: 'Alles begint bij een project. Leg uw projectgegevens, looptijd en begroting vast. Daar rekent Subsidie Kompas op bij het zoeken naar fondsen. U vindt Projecten in het menu rechtsboven onder Mijn Subsidie Kompas.',
    link: { href: '#/kompas/projecten', tekst: 'Naar Projecten' },
  },
  {
    id: 'fondsmatching',
    titel: 'Stap 1 · Fondsmatching',
    tekst: 'Subsidie Kompas zoekt fondsen en regelingen die bij uw project passen en zet ze in uw plan, met bedrag, voorwaarden en deadline.',
    link: { href: '#/kompas/advies/fondsen', tekst: 'Naar de fondsmatching' },
  },
  {
    id: 'begroting',
    titel: 'Stap 2 · Begroting',
    tekst: 'Uw begroting per subcategorie, met de financiers die hem dekken. De balk laat zien hoeveel is toegekend, aangevraagd en nog te dekken.',
    link: { href: '#/kompas/documentatie?tab=begroting', tekst: 'Naar begroting en dekkingsplan' },
  },
  {
    id: 'actieplan',
    titel: 'Stap 3 · Actieplan',
    tekst: 'Per fonds de acties en de deadlines, met herinneringen. Zo besteedt u uw tijd aan schrijven en niet aan bijhouden.',
    link: { href: '#/kompas/deadlines', tekst: 'Naar het actieplan' },
  },
  {
    id: 'indienen',
    titel: 'Stap 4 · Indienen',
    tekst: 'Maak een projectplan op maat, laat uw aanvraag per fonds beoordelen voordat u indient en vul het projectdossier aan.',
    link: { href: '#/kompas/documentatie', tekst: 'Naar indienen' },
  },
  {
    id: 'chat',
    titel: 'Chat',
    tekst: 'Stel vragen aan Subsidie Kompas over fondsen, uw project of een aanvraag. U kunt een project aan het gesprek koppelen.',
    link: { href: '#/kompas', tekst: 'Naar de chat' },
  },
  {
    id: 'menu',
    titel: 'Mijn Subsidie Kompas',
    tekst: 'Het menu rechtsboven: Projecten, Organisatie, Account, Abonnement en Uitloggen. Bij Organisatie staat het profiel van uw organisatie.',
    link: null,
  },
];

// Veelgestelde vragen. links: [{ href, tekst }]
export const VRAGEN = [
  {
    id: 'waar-beginnen',
    vraag: 'Waar begin ik?',
    antwoord: 'Maak eerst een project aan met uw projectgegevens en begroting. Ga daarna naar Subsidieadvies en start de fondsmatching. De vier stappen daar leiden u verder: fondsen vinden, begroting dekken, actieplan volgen en indienen.',
    links: [{ href: '#/kompas/projecten?nieuw=1', tekst: 'Project aanmaken' }, { href: '#/kompas/advies', tekst: 'Naar Subsidieadvies' }],
  },
  {
    id: 'dashboard',
    vraag: 'Wat zie ik op het dashboard?',
    antwoord: 'Bovenaan vier tegels: uw actieve projecten, het bedrag dat nog gefinancierd moet worden, het aantal open acties en de eerstvolgende deadline. Daaronder staan de acties waar u nu mee aan de slag kunt en uw projecten met de stand van de dekking en het projectdossier.',
    links: [{ href: '#/kompas/dashboard', tekst: 'Naar het dashboard' }],
  },
  {
    id: 'nieuw-project',
    vraag: 'Hoe maak ik een nieuw project aan?',
    antwoord: 'Kies + Nieuw project op het dashboard, of ga via het menu rechtsboven naar Projecten. Vul in elk geval discipline, doelgroep, werkgebied, looptijd en begroting in. Daar rekent de fondsmatching op.',
    links: [{ href: '#/kompas/projecten?nieuw=1', tekst: 'Nieuw project' }],
  },
  {
    id: 'wissel-project',
    vraag: 'Hoe wissel ik van project?',
    antwoord: 'Bij Subsidieadvies staat linksboven in de balk een keuzelijst met uw projecten. Kies daar het project waar u mee werkt, dan volgen alle vier de stappen dat project.',
    links: [{ href: '#/kompas/advies', tekst: 'Naar Subsidieadvies' }],
  },
  {
    id: 'fondsen-vinden',
    vraag: 'Hoe vind ik passende fondsen?',
    antwoord: 'Open Subsidieadvies › Fondsmatching, controleer de projectgegevens en kies Maak dekkingsplan en actieplan met Subsidie Kompas. Staat er na afloop nog een bedrag open, dan verschijnt de knop Zoek fondsen voor de resterende bedrag. Die zoekt alleen verder als u erop drukt.',
    links: [{ href: '#/kompas/advies/fondsen', tekst: 'Naar de fondsmatching' }],
  },
  {
    id: 'begroting-invullen',
    vraag: 'Hoe vul ik mijn begroting in?',
    antwoord: 'Bij Subsidieadvies › Begroting vult u de begroting per subcategorie in. Daaronder staat het dekkingsplan met de financiers die de begroting dekken. U kunt de begroting ook als Excel downloaden.',
    links: [{ href: '#/kompas/documentatie?tab=begroting', tekst: 'Naar begroting en dekkingsplan' }],
  },
  {
    id: 'dekking-balk',
    vraag: 'Wat betekent de balk met de dekking?',
    antwoord: 'De balk laat zien hoe uw begroting is gedekt: donkergroen is toegekend, blauw is aangevraagd, lichtgroen is eigen bijdrage. Wat overblijft is nog te financieren. Het Overzicht en het dashboard laten ook het percentage zien dat gedekt is.',
    links: [{ href: '#/kompas/advies', tekst: 'Naar het Overzicht' }],
  },
  {
    id: 'deadlines',
    vraag: 'Waar vind ik mijn acties en deadlines?',
    antwoord: 'Bij Subsidieadvies › Actieplan. Per fonds ziet u wat u moet doen, en voor fondsen met een deadline wanneer de aanvraag erin moet en wanneer de uitslag verwacht wordt. Op het dashboard staan de acties die nu aan de beurt zijn.',
    links: [{ href: '#/kompas/deadlines', tekst: 'Naar het actieplan' }],
  },
  {
    id: 'herinnering',
    vraag: 'Wanneer krijg ik een herinnering?',
    antwoord: 'Bij een concrete datum, zoals een deadline of een verwachte uitslag, krijgt u ruim twee weken van tevoren een melding en nog een keer vlak voor de datum. U kunt de herinnering per fonds uitzetten.',
    links: [{ href: '#/kompas/deadlines', tekst: 'Naar het actieplan' }],
  },
  {
    id: 'projectdossier',
    vraag: 'Wat is het projectdossier en waarom vul ik het in?',
    antwoord: 'Het projectdossier bevat de uitgebreide informatie over uw project. Hoe completer het is, hoe beter het projectplan op maat en de beoordeling per fonds worden. De groene balk laat zien hoeveel u al heeft ingevuld.',
    links: [{ href: '#/kompas/documentatie?tab=inhoud', tekst: 'Naar het projectdossier' }],
  },
  {
    id: 'projectplan',
    vraag: 'Hoe krijg ik een projectplan of een beoordeling?',
    antwoord: 'Ga naar Subsidieadvies › Indienen. Vul eerst het projectdossier aan. Daarna kunt u onder Projectplan en Fondsen indienen een plan op maat van het fonds laten maken en uw aanvraag laten beoordelen voordat u indient.',
    links: [{ href: '#/kompas/documentatie', tekst: 'Naar indienen' }],
  },
  {
    id: 'organisatie',
    vraag: 'Wat vul ik in bij Organisatie?',
    antwoord: 'Het profiel van uw organisatie of praktijk, zoals naam, doelstelling en werkgebied. Subsidie Kompas gebruikt het bij het zoeken naar fondsen en bij projectplannen. U vindt het in het menu rechtsboven.',
    links: [{ href: '#/kompas/organisatie', tekst: 'Naar Organisatie' }],
  },
  {
    id: 'account',
    vraag: 'Waar vind ik mijn account en abonnement?',
    antwoord: 'In het menu rechtsboven, onder Mijn Subsidie Kompas. Daar staan Account, Abonnement en Uitloggen.',
    links: [{ href: '#/kompas/account', tekst: 'Naar Account' }, { href: '#/hoe-het-werkt', tekst: 'Abonnement' }],
  },
  {
    id: 'contact',
    vraag: 'Ik kom er niet uit. Met wie kan ik praten?',
    antwoord: `Stuur ons gerust een bericht via ${HULP_CONTACT_EMAIL}. Beschrijf kort waar u mee bezig was en op welke pagina u zat, dan helpen we u verder.`,
    links: [{ href: `mailto:${HULP_CONTACT_EMAIL}`, tekst: 'Mail ons' }],
  },
];

// Welke vragen worden bovenaan voorgesteld, per pagina.
const VOORSTEL_PER_PAD = {
  '/kompas/dashboard': ['dashboard', 'waar-beginnen', 'deadlines'],
  '/kompas/advies': ['fondsen-vinden', 'dekking-balk', 'wissel-project'],
  '/kompas/deadlines': ['deadlines', 'herinnering', 'wissel-project'],
  '/kompas/documentatie': ['begroting-invullen', 'projectdossier', 'projectplan'],
  '/kompas/projecten': ['nieuw-project', 'waar-beginnen', 'fondsen-vinden'],
  '/kompas/organisatie': ['organisatie', 'account', 'contact'],
  '/kompas/account': ['account', 'contact', 'waar-beginnen'],
};

const STANDAARD_VOORSTEL = ['waar-beginnen', 'fondsen-vinden', 'contact'];

export const vraagMetId = (id) => VRAGEN.find((v) => v.id === id) || null;

// Voorgestelde vragen voor deze pagina (altijd bestaande vragen).
export function voorgesteldeVragen(pad) {
  return (VOORSTEL_PER_PAD[pad] || STANDAARD_VOORSTEL).map(vraagMetId).filter(Boolean);
}

// Pagina's waar Collie niet staat: in de Chat zelf zit Subsidie Kompas al.
export const PADEN_ZONDER_HULP = ['/kompas', '/subsidie-kompas'];

export const toonHulp = (pad) => PADEN_ZONDER_HULP.indexOf(pad) === -1;

// De openingsregel in Collie, passend bij de pagina.
export function openingsTekst(pad) {
  switch (pad) {
    case '/kompas/dashboard':
      return 'Hoi! Ik ben Collie. Dit is uw dashboard, de stand van zaken van al uw projecten. Waar kan ik u mee helpen?';
    case '/kompas/advies':
      return 'Hoi! Ik ben Collie. Subsidieadvies loopt in vier stappen: fondsen vinden, begroting dekken, actieplan volgen en indienen. Waar kan ik u mee helpen?';
    case '/kompas/deadlines':
      return 'Hoi! Ik ben Collie. Hier staat uw actieplan met de deadlines per fonds. Waar kan ik u mee helpen?';
    case '/kompas/documentatie':
      return 'Hoi! Ik ben Collie. Hier werkt u aan de begroting en aan uw aanvraag. Waar kan ik u mee helpen?';
    case '/kompas/projecten':
      return 'Hoi! Ik ben Collie. Hier beheert u uw projecten. Waar kan ik u mee helpen?';
    default:
      return 'Hoi! Ik ben Collie. Ik help u graag op weg in Subsidie Kompas. Waar kan ik u mee helpen?';
  }
}
