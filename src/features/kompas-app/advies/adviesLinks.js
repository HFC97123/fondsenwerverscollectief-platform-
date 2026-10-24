// Subsidieadvies: de vier lijnen van Subsidie Kompas (Fondsen, Begroting, Deadlines, Indienen) plus een Overzicht.
// Pure functies (geen React, geen netwerk): welke stap hoort bij de huidige hash, en waar een stap naartoe linkt.
// De stappen hergebruiken de bestaande pagina's: Begroting en Indienen staan op /kompas/documentatie, Deadlines op
// /kompas/deadlines en Fondsen en Overzicht op /kompas/advies. Het project reist mee als ?project=<id>.

// Alle paden die onder Subsidieadvies vallen (de hoofdnavigatie markeert Subsidieadvies voor al deze paden).
export const ADVIES_PADEN = ['/kompas/advies', '/kompas/deadlines', '/kompas/documentatie'];

export const STAPPEN = [
  { id: 'overzicht', nr: '★', label: 'Overzicht' },
  { id: 'fondsen', nr: '1', label: 'Fondsmatching' },
  { id: 'begroting', nr: '2', label: 'Begroting' },
  { id: 'deadlines', nr: '3', label: 'Deadlines' },
  { id: 'indienen', nr: '4', label: 'Indienen' },
];

const schoneHash = (hash) => String(hash || '').replace(/^#/, '');

// ?project=<id> uit een hash (leeg als er geen is).
export function leesProjectParam(hash) {
  const m = /[?&]project=([^&]+)/.exec(String(hash || ''));

  return m ? decodeURIComponent(m[1]) : '';
}

// Het deel na /kompas/advies/ (zonder query), bijvoorbeeld 'fondsen'.
export function adviesDeel(hash) {
  const pad = schoneHash(hash).split('?')[0].replace(/\/+$/, '');
  const m = /^\/kompas\/advies\/([a-z]+)$/.exec(pad);

  return m ? m[1] : '';
}

// Welke stap hoort bij dit routepad en deze hash? Onbekend -> null (de balk markeert dan niets).
export function huidigeStap(pad, hash) {
  if (pad === '/kompas/deadlines') {
    return 'deadlines';
  }

  if (pad === '/kompas/documentatie') {
    return /[?&]tab=begroting(&|$)/.test(String(hash || '')) ? 'begroting' : 'indienen';
  }

  if (pad === '/kompas/advies') {
    return adviesDeel(hash) === 'fondsen' ? 'fondsen' : 'overzicht';
  }

  return null;
}

const metProject = (basis, projectId, extra = []) => {
  const delen = [...extra];

  if (projectId) {
    delen.push(`project=${encodeURIComponent(projectId)}`);
  }

  return `${basis}${delen.length ? `?${delen.join('&')}` : ''}`;
};

// Hashpad (zonder #) van een stap.
export function stapPad(stapId, projectId) {
  switch (stapId) {
    case 'fondsen':
      return metProject('/kompas/advies/fondsen', projectId);
    case 'begroting':
      return metProject('/kompas/documentatie', projectId, ['tab=begroting']);
    case 'deadlines':
      return '/kompas/deadlines';
    case 'indienen':
      return metProject('/kompas/documentatie', projectId, ['tab=inhoud']);
    default:
      return metProject('/kompas/advies', projectId);
  }
}

export const stapHref = (stapId, projectId) => `#${stapPad(stapId, projectId)}`;

// Het project voor Subsidieadvies: het project uit de URL als dat bestaat, anders het eerste echte, niet-gearchiveerde project.
export function kiesProjectId(projecten, uitUrl) {
  const lijst = projecten || [];

  if (uitUrl && lijst.some((p) => p && p.id === uitUrl)) {
    return uitUrl;
  }

  return lijst.length ? lijst[0].id : '';
}

// Oude links naar de projectpagina (?tab=projectfinanciering of ?tab=deadlines) wijzen nu naar Subsidieadvies.
// Geeft de nieuwe href terug, of null als er niets door te sturen is.
export function adviesDoorverwijzing(hash, projectId) {
  const m = /[?&]tab=(projectfinanciering|deadlines)(&|$)/.exec(String(hash || ''));

  if (!m) {
    return null;
  }

  return stapHref(m[1] === 'deadlines' ? 'deadlines' : 'fondsen', projectId);
}
