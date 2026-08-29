// Design tokens, letterlijk overgenomen uit het goedgekeurde ontwerp.
// Dit is de enige plek waar kleuren, typografie en maten worden vastgelegd.
// Gebruik nergens anders losse hexwaarden.

export const color = {
  // Primair
  donkerblauw: '#2C4A5E',
  groen: '#4E9A6C',
  groenDonker: '#43855D',
  pastelgroen: '#A8D5BA',
  pastelblauw: '#A9C9DE',

  // Vlakken
  achtergrond: '#F7F9F8',
  wit: '#FFFFFF',
  vlakGroen: '#EAF4EE',
  vlakBlauw: '#EAF1F6',
  vlakGrijs: '#F2F6F4',

  // Tekst
  tekst: '#2E3A38',
  tekstZacht: '#4B5C58',
  tekstGrijs: '#687974',
  tekstLicht: '#7B8985',
  tekstOpDonker: '#EAF1F5',
  tekstOpDonkerZacht: '#C9DAE4',
  tekstOpDonkerAccent: '#A9C9DE',
  label: '#9AA6A2',

  // Lijnen
  lijn: '#E1EAE4',
  lijnZacht: '#E4EBE7',
  lijnInput: '#D5E0D9',
  lijnBlauw: '#D6E3E9',
  lijnGroen: '#D5E6DB',
  lijnGroenSterk: '#BFD4C6',

  // Betekenis
  succes: '#2F6D47',
  fout: '#9E3B2C',
  foutVlak: '#FDF6F5',
  foutLijn: '#EDD3CE',
  waarschuwing: '#8A5A16',
  waarschuwingVlak: '#FBF1E3',
  waarschuwingLijn: '#EEDCC0',
};

// Statusbadges van subsidieregelingen. Vast, want ze horen bij de betekenis.
export const statusStyle = {
  Open: { bg: '#EAF4EE', color: '#2F6D47', border: '#CFE4D7' },
  Binnenkort: { bg: '#EAF1F6', color: '#2C4A5E', border: '#CFDFEA' },
  Doorlopend: { bg: '#F1EDF7', color: '#584277', border: '#DED4EC' },
  Aangekondigd: { bg: '#EEF1F0', color: '#5A6A66', border: '#DDE4E1' },
  'Budget uitgeput': { bg: '#FBF1E3', color: '#8A5A16', border: '#EEDCC0' },
  Gesloten: { bg: '#F9ECEA', color: '#9E3B2C', border: '#EDD3CE' },
};

export const font = {
  kop: "'Newsreader', serif",
  tekst: "'Mulish', sans-serif",
};

// Vloeiende maten uit het ontwerp; clamp houdt mobiel en desktop in één waarde.
export const type = {
  hero: 'clamp(30px, 5vw, 46px)',
  paginaKop: 'clamp(27px, 4.2vw, 38px)',
  paneelKop: 'clamp(26px, 3.6vw, 34px)',
  sectieKop: 'clamp(22px, 2.8vw, 28px)',
  blokKop: '21px',
  leadGroot: '18px',
  lead: '17.5px',
  body: '16px',
  bodyKlein: '15px',
  knop: '14.5px',
  klein: '14px',
  kleiner: '13.5px',
  micro: '12.5px',
  label: '11px',
};

export const space = {
  xs: '6px',
  s: '10px',
  m: '14px',
  l: '18px',
  xl: '22px',
  xxl: '30px',
  sectie: 'clamp(34px, 5vw, 64px)',
  paginaX: 'clamp(16px, 4vw, 24px)',
  paneel: 'clamp(22px, 3.4vw, 40px)',
};

export const radius = {
  s: '9px',
  m: '12px',
  l: '14px',
  xl: '16px',
  xxl: '20px',
  paneel: '26px',
  pil: '999px',
  rond: '50%',
};

export const shadow = {
  knop: '0 1px 3px rgba(44,74,94,0.25)',
  paneel: '0 6px 20px rgba(44,74,94,0.3)',
  overlay: 'rgba(44,74,94,0.34)',
  overlayZacht: 'rgba(44,74,94,0.32)',
};

// Eén breekpunt: onder 900px is de layout mobiel/tablet.
export const breakpoint = {
  mobiel: 900,
  smal: 640,
  breed: 1100,
};

export const maxWidth = {
  pagina: '1180px',
  tekst: '720px',
  lead: '680px',
  chat: '850px',
};

// Raakvlak van 44px voor elke klikbare zone.
export const tap = '44px';
