// src/shared/document-theme/themes/subsidieKompasTheme.js
//
// Het vaste Subsidie Kompas-thema: de standaardhuisstijl voor Free-gebruikers
// en de standaardkeuze voor Pro/Premium/Admin wanneer geen alternatief is
// gekozen (zie ai_prompts.kompas.system, sectie "HUISSTIJL EN
// BESTANDSKEUZE"). Dit bestand VERZINT geen nieuwe huisstijl: elke waarde
// hieronder komt letterlijk uit een van de twee bestaande, goedgekeurde
// bronnen:
//
//   1. src/shared/tokens.js - "de enige plek waar kleuren, typografie en
//      maten worden vastgelegd" voor de website/app-UI (zie dat bestand en
//      README.md, sectie "Huisstijl").
//   2. ai_prompts.kompas.system ("HUISSTIJL EN BESTANDSKEUZE") en CLAUDE.md
//      ("Subsidie Kompas — huisstijl voor gegenereerde bestanden") - de twee
//      bestaande, tekstuele huisstijlregels specifiek voor GEGENEREERDE
//      BESTANDEN (in tegenstelling tot de live website-UI).
//
// Waar deze twee bronnen elkaar overlappen (donkerblauw #2C4A5E, groen
// #4E9A6C, pastelblauw #A9C9DE, achtergrond #F7F9F8) is er geen keuze nodig.
// Twee kleuren bestaan uitsluitend in de documentspecifieke bron en NIET in
// tokens.js (dat immers geen "invoerveld"- of "rasterlijn"-concept kent in de
// web-UI): #FFF2A6 (invoervelden) en #D8DEDC (rasterlijnen) - 1-op-1
// overgenomen uit kompas.system, niet zelf bedacht.
//
// LETTERTYPE: bewust Arial, NIET de website-fonts (Newsreader/Mulish) uit
// tokens.js. kompas.system schrijft voor gegenereerde documenten expliciet
// "Arial" voor - vrijwel zeker omdat Newsreader/Mulish (Google Fonts) niet
// standaard op elke Windows/Mac-installatie met Word aanwezig zijn, en een
// niet-geïnstalleerd lettertype in een .docx-bestand op de machine van de
// lezer stilletjes op iets anders terugvalt. Dit is dus geen omissie maar
// een al bestaande, bewuste regel uit de system prompt, hier ongewijzigd
// toegepast - geen nieuwe huisstijlkeuze.
import { createDocumentTheme, registerDocumentTheme } from '../documentTheme.js';
import { color as webColor } from '../../tokens.js';

const SUBSIDIE_KOMPAS_COLORS = {
  primary: webColor.donkerblauw,       // #2C4A5E - titels en tabelkoppen
  accent: webColor.groen,              // #4E9A6C - accenten en sectiebalken
  secondary: webColor.pastelblauw,     // #A9C9DE - totalen/samenvattingen
  success: webColor.succes,            // #2F6D47 - hergebruikt voor "sterk"/"voldoende" (aanvraagbeoordeling)
  warning: webColor.waarschuwing,      // #8A5A16 - hergebruikt voor "kwetsbaar"
  danger: webColor.fout,               // #9E3B2C - hergebruikt voor "onvoldoende"
  background: webColor.achtergrond,    // #F7F9F8 - zachte achtergronden
  text: webColor.tekst,                // #2E3A38 - basistekst
  textSoft: webColor.tekstZacht,       // #4B5C58 - secundaire tekst
  tableHeaderBg: webColor.donkerblauw, // #2C4A5E - "donkerblauwe ... tabelkoppen"
  tableHeaderText: '#FFFFFF',
  gridLine: '#D8DEDC',                 // alleen in kompas.system, niet in tokens.js
  inputCell: '#FFF2A6',                // alleen in kompas.system, niet in tokens.js
  hyperlink: webColor.donkerblauw,
  white: '#FFFFFF',
};

const SUBSIDIE_KOMPAS_FONTS = {
  heading: 'Arial',
  body: 'Arial',
  table: 'Arial',
  caption: 'Arial',
};

// Maten in halve punten (docx-eenheid). Dit zijn NIEUWE, print-passende
// waarden - de responsieve px/clamp()-schaal uit tokens.js (bedoeld voor een
// beeldscherm) is niet zinvol te vertalen naar een A4-pagina, dus is hier
// bewust een eigen, gangbare documentschaal gekozen in plaats van een
// oneigenlijke omrekening van schermwaarden.
const SUBSIDIE_KOMPAS_TYPOGRAPHY = {
  heading1Size: 32, // 16pt
  heading2Size: 26, // 13pt
  heading3Size: 22, // 11pt
  bodySize: 22,      // 11pt
  tableSize: 20,     // 10pt
  captionSize: 18,   // 9pt
};

// A4, ruime marges ("ruime witmarges", kompas.system) - 25mm rondom, gelijk
// aan de klassieke Word "Normaal"-marge van 1 inch.
const SUBSIDIE_KOMPAS_LAYOUT = {
  pageWidthMm: 210,
  pageHeightMm: 297,
  marginTopMm: 25,
  marginBottomMm: 25,
  marginLeftMm: 25,
  marginRightMm: 25,
  lineSpacing: 276,            // 1,15 regelafstand (240 = enkele regelafstand)
  paragraphSpacingAfter: 160,  // 8pt na elke alinea
  sectionSpacingBefore: 320,   // 16pt boven elke nieuwe kop/sectie
};

const SUBSIDIE_KOMPAS_BRANDING = {
  organizationName: 'Subsidie Kompas',
  footerLabel: 'Subsidie Kompas',
  // Het al bestaande, overal in de app gebruikte logo (zie o.a.
  // KompasToolPage.jsx, KompasSubnav.jsx, HomePage.jsx) - geen nieuw bestand
  // nodig. CLAUDE.md verwijst naar "Rond logo met transparante
  // achtergrond.png", een bestand dat alleen in de Supabase Storage-bucket
  // "subsidie-kompas-templates" staat (zie analyse-documentgeneratie-
  // huidige-staat.md, 30-09-2026) en niet in deze repository. Voor deze
  // eerste, zuiver front-end fundering wordt daarom het al publiek
  // beschikbare, functioneel identieke logo gebruikt (166x166px, transparante
  // achtergrond, RGBA-PNG); zodra Storage-toegang voor deze stap relevant
  // wordt, is dit één regel om aan te passen.
  logo: {
    path: '/uploads/kompas-logo.png',
    width: 48,
    height: 48,
  },
};

export const SubsidieKompasTheme = createDocumentTheme('subsidieKompas', {
  colors: SUBSIDIE_KOMPAS_COLORS,
  fonts: SUBSIDIE_KOMPAS_FONTS,
  typography: SUBSIDIE_KOMPAS_TYPOGRAPHY,
  layout: SUBSIDIE_KOMPAS_LAYOUT,
  branding: SUBSIDIE_KOMPAS_BRANDING,
});

registerDocumentTheme('subsidieKompas', SubsidieKompasTheme);
