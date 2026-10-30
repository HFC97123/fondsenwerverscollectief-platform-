// De eigen huisstijl voor documenten (Premium): een logo, twee kleuren, een tekstkleur, een lettertype uit een korte lijst, de naam op het voorblad en in de voettekst, en het voorblad aan of uit.
// Alles komt uit één klein object (zie normaliseerHuisstijl); het gaat door dezelfde Word-, PDF- en Excel-generatoren als de Subsidie Kompas-huisstijl,
// die voor Pro en als terugval blijft gelden. De marges blijven die van Subsidie Kompas. Het lettertype is er een uit een korte lijst van lettertypen die overal
// aanwezig zijn (een ander lettertype zou op de computer van de lezer kunnen ontbreken en dan stilletjes op iets anders terugvallen); in PDF is dat Helvetica of Times.
// Zuivere functies: geen netwerk, geen opslag.
import { createDocumentTheme } from './documentTheme.js';
import { SubsidieKompasTheme } from './themes/subsidieKompasTheme.js';

export const HUISSTIJL_VERSIE = 1;
export const MAX_HUISSTIJL_NAAM = 80;
export const MAX_LOGO_TEKENS = 250000; // data-URL van het logo (ongeveer 180 KB aan beeld)
export const LOGO_MAX_HOOGTE_PX = 48; // zoals het Subsidie Kompas-logo op het voorblad
export const LOGO_MAX_BREEDTE_PX = 180;

// Lettertypen die op vrijwel elke computer met Word staan, en welk standaard PDF-lettertype erbij hoort.
export const HUISSTIJL_LETTERTYPES = ['Arial', 'Calibri', 'Georgia', 'Times New Roman'];
export const STANDAARD_LETTERTYPE = 'Arial';
const PDF_LETTERTYPE = { Arial: 'Helvetica', Calibri: 'Helvetica', Georgia: 'Times', 'Times New Roman': 'Times' };

export const pdfLettertype = (naam) => PDF_LETTERTYPE[naam] || 'Helvetica';

const HEX = /^#[0-9a-fA-F]{6}$/;
const LOGO = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/;

const hex = (w, terugval) => (typeof w === 'string' && HEX.test(w.trim()) ? w.trim().toUpperCase() : terugval);

// Wat in de database staat of uit het formulier komt -> een schoon object, of null als er niets bruikbaars in zit (dan geldt de Subsidie Kompas-huisstijl).
export function normaliseerHuisstijl(ruw) {
  if (!ruw || typeof ruw !== 'object' || Array.isArray(ruw)) return null;

  const naam = String(ruw.naam == null ? '' : ruw.naam).replace(/\s+/g, ' ').trim().slice(0, MAX_HUISSTIJL_NAAM);
  const logo = typeof ruw.logo === 'string' && ruw.logo.length <= MAX_LOGO_TEKENS && LOGO.test(ruw.logo) ? ruw.logo : '';
  const primair = hex(ruw.primair, '');
  const accent = hex(ruw.accent, '');
  const tekst = hex(ruw.tekst, '');
  const lettertype = HUISSTIJL_LETTERTYPES.includes(ruw.lettertype) ? ruw.lettertype : '';
  const voorblad = ruw.voorblad !== false;

  // Leeg object = geen eigen huisstijl.
  if (!naam && !logo && !primair && !accent && !tekst && !lettertype && voorblad) return null;

  const b = Number(ruw.logoBreedte);
  const h = Number(ruw.logoHoogte);
  const maten = logo && Number.isFinite(b) && Number.isFinite(h) && b > 0 && h > 0 ? pasLogoMaten(b, h) : logo ? { breedte: LOGO_MAX_HOOGTE_PX, hoogte: LOGO_MAX_HOOGTE_PX } : { breedte: 0, hoogte: 0 };

  return {
    versie: HUISSTIJL_VERSIE,
    naam,
    primair: primair || SubsidieKompasTheme.colors.primary,
    accent: accent || SubsidieKompasTheme.colors.accent,
    tekst: tekst || SubsidieKompasTheme.colors.text,
    lettertype: lettertype || STANDAARD_LETTERTYPE,
    voorblad,
    logo,
    logoBreedte: maten.breedte,
    logoHoogte: maten.hoogte,
  };
}

// Houdt de verhouding van het logo en past het in een vak van hoogstens 180 bij 48 px.
export function pasLogoMaten(breedte, hoogte) {
  const f = Math.min(LOGO_MAX_BREEDTE_PX / breedte, LOGO_MAX_HOOGTE_PX / hoogte, 1);

  return { breedte: Math.max(1, Math.round(breedte * f)), hoogte: Math.max(1, Math.round(hoogte * f)) };
}

// Mengt een kleur met wit: 0 = de kleur zelf, 1 = wit. Voor de lichte vlakken (totalen en samenvattingen).
export function mengMetWit(kleur, deel) {
  const k = hex(kleur, '#000000');
  const mix = (i) => Math.round(parseInt(k.slice(1 + i * 2, 3 + i * 2), 16) * (1 - deel) + 255 * deel);

  return `#${[0, 1, 2].map((i) => mix(i).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

// Is de kleur donker genoeg voor witte tekst erop (tabelkoppen)? Anders wordt de tabeltekst donker.
export function isDonker(kleur) {
  const k = hex(kleur, '#000000');
  const l = (0.299 * parseInt(k.slice(1, 3), 16) + 0.587 * parseInt(k.slice(3, 5), 16) + 0.114 * parseInt(k.slice(5, 7), 16)) / 255;

  return l < 0.6;
}

// Het documentthema van deze huisstijl: de Subsidie Kompas-opzet met de kleuren, het logo en de naam van de lid.
export function bouwHuisstijlThema(huisstijl) {
  const h = normaliseerHuisstijl(huisstijl);

  if (!h) return SubsidieKompasTheme;

  const basis = SubsidieKompasTheme;

  return createDocumentTheme('eigen', {
    colors: {
      ...basis.colors,
      primary: h.primair,
      accent: h.accent,
      secondary: mengMetWit(h.primair, 0.78),
      tableHeaderBg: h.primair,
      tableHeaderText: isDonker(h.primair) ? '#FFFFFF' : '#2E3A38',
      hyperlink: h.primair,
      text: h.tekst,
      textSoft: h.tekst === basis.colors.text ? basis.colors.textSoft : mengMetWit(h.tekst, 0.3),
    },
    fonts: { heading: h.lettertype, body: h.lettertype, table: h.lettertype, caption: h.lettertype },
    typography: { ...basis.typography },
    layout: { ...basis.layout },
    branding: {
      organizationName: h.naam || basis.branding.organizationName,
      footerLabel: h.naam || basis.branding.footerLabel,
      logo: h.logo ? { path: h.logo, width: h.logoBreedte, height: h.logoHoogte } : { ...basis.branding.logo },
      voorblad: h.voorblad,
    },
  });
}

// Zonder huisstijl: een rustig, neutraal document in zwart en grijs, zonder logo en zonder naam van Subsidie Kompas. Voor Premium-leden die hun document zonder opmaak willen, bijvoorbeeld om het zelf in hun eigen sjabloon te zetten.
export const NEUTRAAL_KLEUREN = { primair: '#222222', accent: '#6B6B6B' };

export function neutraalThema() {
  const basis = SubsidieKompasTheme;

  return createDocumentTheme('neutraal', {
    colors: {
      ...basis.colors,
      primary: NEUTRAAL_KLEUREN.primair,
      accent: NEUTRAAL_KLEUREN.accent,
      secondary: '#EEEEEE',
      background: '#FFFFFF',
      text: '#222222',
      textSoft: '#555555',
      tableHeaderBg: '#E3E3E3',
      tableHeaderText: '#222222',
      gridLine: '#CCCCCC',
      hyperlink: '#222222',
    },
    fonts: { ...basis.fonts },
    typography: { ...basis.typography },
    layout: { ...basis.layout },
    branding: { organizationName: '', footerLabel: '', logo: { path: '', width: 0, height: 0 } },
  });
}

// De keuzes bij een document: 'standaard' (Subsidie Kompas), 'geen' (neutraal) of 'eigen' (de eigen huisstijl van het lid).
export const HUISSTIJL_KEUZES = ['standaard', 'geen', 'eigen'];

// Pro heeft altijd de Subsidie Kompas-huisstijl; Premium (en beheerders) kiest. Zonder keuze geldt de eigen huisstijl als die er is, anders Subsidie Kompas.
export function themaVoorKeuze({ premium, huisstijl, keuze }) {
  if (!premium) return SubsidieKompasTheme;
  if (keuze === 'geen') return neutraalThema();
  if (keuze === 'standaard') return SubsidieKompasTheme;

  return themaVoorExport({ premium, huisstijl });
}

// Welk thema bij een export hoort: Premium (en beheerders) met een eigen huisstijl krijgt die; iedereen anders de Subsidie Kompas-huisstijl.
export function themaVoorExport({ premium, huisstijl }) {
  return premium && normaliseerHuisstijl(huisstijl) ? bouwHuisstijlThema(huisstijl) : SubsidieKompasTheme;
}
