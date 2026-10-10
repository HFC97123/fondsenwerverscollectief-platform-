export const AI_TEKST = `# Projectplan Buurtkeuken De Brug

## 1. Aanleiding
Veel buurtbewoners in Utrecht-Noord eten dagelijks alleen. Dit project brengt hen samen rond een gezamenlijke maaltijd. Café “De Brug” — een plek voor ontmoeting — biedt ruimte voor 40 gasten, inclusief ë, é, ï en een euroteken: €.

### Doelgroep
- Eenzame ouderen (65+)
- Alleenstaande ouders
- Nieuwkomers

## 2. Planning
1. Voorbereiding (jan–mrt 2027)
2. Uitvoering (apr–nov 2027)
3. Evaluatie (dec 2027)

## 3. Begroting
| Kostenpost | Aantal | Bedrag |
|---|---|---|
| Coördinator | 1 | € 24.000 |
| Ingrediënten | 12 | € 9.600,50 |
| Zaalhuur | 10 | € 3.000 |
| Totaal | | € 36.600,50 |

Een slotalinea met genoeg tekst om te controleren dat de regelafbreking en de paginering netjes verlopen. ${'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(30)}
`;

export const PROJECT_A = {
  id: '11111111-1111-4111-8111-111111111111', naam: 'Buurtkeuken De Brug', programma: 'Samen Eten', doelgroep: 'Ouderen, Alleenstaande ouders',
  regio: 'Utrecht-Noord', periodeVan: 'jan 2027', periodeTot: 'dec 2027', partners: 'Wijkcentrum De Kruin',
  omschrijving: 'Wekelijks een warme maaltijd.\n- Koken met vrijwilligers\n- Samen eten',
  doelstellingen: '40 gasten per week bereiken.', activiteiten: 'Koken, eten, spelletjes.', impact: 'Minder eenzaamheid.', planning: 'Q1 voorbereiding, Q2-Q4 uitvoering',
  resultaten: '', begroting: 85000, gevraagd: 35000, eigenBijdrage: 7500,
  eerder: [{ fonds: 'Oranje Fonds', jaar: '2025', bedrag: '€ 10.000', uitkomst: 'Toegekend', reden: '' }, { fonds: 'Fonds X', jaar: '2024', bedrag: '€ 5.000', uitkomst: 'Afgewezen', reden: 'Past niet' }],
  cofin: [{ naam: 'Gemeente Utrecht', bedrag: '€ 15.000', status: 'Toegezegd' }, { naam: 'Lokale ondernemer', bedrag: '€ 2.500', status: 'Verkennend' }],
  regelingen: [{ id: 'r1', naam: 'Buurtbudget Utrecht', funder: 'Gemeente Utrecht', deadline: '2027-03-01', aangevraagd: 8000, plan: 'Aangevraagd' }],
  docs: [{ id: 'd1', naam: 'Projectplan — concept van 1-10-2026', soort: 'Projectplan', versie: 1, gemaakt: '2026-10-01T10:00:00Z', vervangen: false }],
  gearchiveerd: false,
};
export const PROJECT_B = { ...PROJECT_A, id: '22222222-2222-4222-8222-222222222222', naam: 'GEHEIM Ander Project', omschrijving: 'MAG NIET IN EXPORT VAN A' };

export const VELDEN = [
  { s: 'Organisatieprofiel', n: 'name', l: 'Organisatienaam', t: 'text' },
  { s: 'Organisatieprofiel', n: 'rechtsvorm', l: 'Rechtsvorm', t: 'text' },
  { s: 'Organisatieprofiel', n: 'mission', l: 'Missie', t: 'area' },
  { s: 'Werkgebied', n: 'regio', l: 'Werkgebied', t: 'text' },
  { s: 'Werkgebied', n: 'themas', l: 'Disciplines', t: 'chips' },
  { s: 'Werkgebied', n: 'doelgroepen', l: 'Doelgroepen', t: 'chips' },
  { s: 'Organisatiegegevens', n: 'omzet', l: 'Jaarlijkse omzet (€)', t: 'number' },
  { s: 'Organisatiegegevens', n: 'medewerkers', l: 'Aantal medewerkers', t: 'number' },
  { s: 'Contact', n: 'contactpersonen', l: 'Contactpersonen', t: 'contacts' },
  { s: 'Contact', n: 'socials', l: 'Social media', t: 'socials' },
];
export const PROFIEL = { name: 'Stichting Buurtkracht', rechtsvorm: 'Stichting', mission: 'Verbinden van buurtbewoners.\nSamen sterker.', regio: 'Utrecht', themas: ['Welzijn', 'Cultuur'], doelgroepen: ['Ouderen'], omzet: 240000, medewerkers: 4, contactpersonen: [{ naam: 'Aisya', functie: 'Directeur', email: 'a@b.nl', telefoon: '0612345678' }], socials: [{ platform: 'LinkedIn', url: 'https://linkedin.com/x' }] };

export const BERICHTEN = [
  { role: 'user', content: 'Kun je me helpen met een projectplan?', tijd: '2026-10-01T09:15:00Z' },
  { role: 'assistant', content: AI_TEKST, tijd: '2026-10-01T09:15:30Z' },
];
