// Routetabel. Eén plek waar paden, titels en toegang staan.
// De vier gebieden blijven gescheiden: website, kompas-marketing, kompas-app, admin.

export const AREA = {
  website: 'website',
  marketing: 'kompas-marketing',
  app: 'kompas-app',
  admin: 'admin',
};

// pad: het hashpad zonder '#'. Het eerste segment bepaalt de route.
// toegang: 'publiek' | 'lid' | 'beheerder'
export const routes = [
  { pad: '/', area: AREA.website, titel: 'Het Fondsenwervers Collectief', toegang: 'publiek' },
  { pad: '/actueel', area: AREA.website, titel: 'Actueel', toegang: 'publiek' },
  { pad: '/artikel', area: AREA.website, titel: 'Artikel', toegang: 'publiek' },
  { pad: '/vacatures', area: AREA.website, titel: 'Vacatures', toegang: 'publiek' },
  { pad: '/cursussen', area: AREA.website, titel: 'Cursussen', toegang: 'publiek' },
  { pad: '/lidmaatschap', area: AREA.website, titel: 'Lidmaatschap', toegang: 'publiek' },
  { pad: '/contact', area: AREA.website, titel: 'Contact', toegang: 'publiek' },
  { pad: '/privacy', area: AREA.website, titel: 'Privacyverklaring', toegang: 'publiek' },
  { pad: '/voorwaarden', area: AREA.website, titel: 'Algemene voorwaarden', toegang: 'publiek' },
  { pad: '/netwerk', area: AREA.website, titel: 'Ledengedeelte', toegang: 'lid' },

  // De paden volgen de links in het goedgekeurde ontwerp.
  { pad: '/hoe-het-werkt', area: AREA.marketing, titel: 'Hoe het werkt', toegang: 'publiek' },
  { pad: '/kompas/faq', area: AREA.marketing, titel: 'Veelgestelde vragen', toegang: 'publiek' },

  // De Kompas-pagina van het ontwerp: de tool met de drie panelen.
  { pad: '/subsidie-kompas', area: AREA.app, titel: 'Subsidie Kompas', toegang: 'publiek' },
  { pad: '/kompas', area: AREA.app, titel: 'Subsidie Kompas', toegang: 'publiek' },
  { pad: '/kompas/deadlines', area: AREA.app, titel: 'Deadlines', toegang: 'publiek' },
  { pad: '/kompas/organisatie', area: AREA.app, titel: 'Organisatieprofiel', toegang: 'lid' },
  { pad: '/kompas/projecten', area: AREA.app, titel: 'Projecten', toegang: 'lid' },
  { pad: '/kompas/documentatie', area: AREA.app, titel: 'Documentatie', toegang: 'lid' },
  { pad: '/kompas/account', area: AREA.app, titel: 'Account', toegang: 'lid' },

  { pad: '/beheer', area: AREA.admin, titel: 'Beheer', toegang: 'beheerder' },
];

const STANDAARD = routes[0];

// Zoekt de route bij een hash. Het langste passende pad wint, zodat
// /kompas/deadlines voor /kompas gaat.
export function matchRoute(hash) {
  const pad = String(hash || '').replace(/^#/, '').split('?')[0] || '/';
  const opgeschoond = pad.length > 1 ? pad.replace(/\/+$/, '') : pad;

  const treffers = routes
    .filter((r) => opgeschoond === r.pad || opgeschoond.startsWith(`${r.pad}/`))
    .sort((a, b) => b.pad.length - a.pad.length);

  return treffers[0] || STANDAARD;
}

// Het deel van de hash na het routepad, bijvoorbeeld een artikel-id.
export function routeParam(hash, route) {
  const pad = String(hash || '').replace(/^#/, '').split('?')[0] || '/';
  const rest = pad.slice(route.pad.length).replace(/^\//, '');

  return rest || null;
}

export function naar(pad) {
  window.location.hash = pad.startsWith('#') ? pad : `#${pad}`;
}
