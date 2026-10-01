// src/shared/document-theme/documentTheme.js
//
// De "vorm" van een documentthema (kleuren, lettertypes, typografie, layout,
// branding) plus een klein register waarmee een thema onder een naam
// opgezocht kan worden. Dit bestand kent geen enkel concreet thema en geen
// enkele Subsidie Kompas-specifieke waarde - dat hoort in themes/*.js. Zo kan
// een toekomstig NeutralTheme of CustomTheme exact dezelfde vorm gebruiken
// zonder dat hier iets hoeft te veranderen.
//
// Bewust FRAMEWORK- EN BESTANDSFORMAAT-AGNOSTISCH voor kleuren/fonts/layout:
// dit zijn platte gegevens, herbruikbaar door een toekomstige PDF- of
// Excel-generator. Alleen de "component"-bouwstenen in ./components/*.js
// zijn wél aan de `docx`-bibliotheek gekoppeld, omdat dit de eerste
// (en vooralsnog enige) documentgenerator is die wordt ondersteund.

/**
 * @typedef {Object} DocumentThemeColors
 * @property {string} primary        Titels en tabelkoppen (kompas.system: "donkerblauwe titels en tabelkoppen")
 * @property {string} accent         Accenten en sectiebalken (kompas.system: "groene accenten en sectiebalken")
 * @property {string} secondary      Totalen/samenvattingen (kompas.system: "lichtblauwe totalen of samenvattingen")
 * @property {string} success        Positieve beoordeling ("sterk"/"voldoende"), hergebruikt uit shared/tokens.js
 * @property {string} warning        Aandachtspunt, hergebruikt uit shared/tokens.js
 * @property {string} danger         Negatieve beoordeling ("onvoldoende"), hergebruikt uit shared/tokens.js
 * @property {string} background     Zachte achtergrond (kompas.system: "zachte lichtgrijze achtergronden")
 * @property {string} text           Basistekst, hergebruikt uit shared/tokens.js
 * @property {string} textSoft       Zachtere/secundaire tekst, hergebruikt uit shared/tokens.js
 * @property {string} tableHeaderBg  Achtergrond van tabelkoppen
 * @property {string} tableHeaderText Tekstkleur op tabelkoppen
 * @property {string} gridLine       Tabel-/rasterlijnen (kompas.system: "subtiele grijze rasterlijnen")
 * @property {string} inputCell      In te vullen cellen (kompas.system: "lichtgele invoervelden"; CLAUDE.md: "gele cellen = door u in te vullen")
 * @property {string} hyperlink      Kleur voor links in documenten
 * @property {string} white          Zuiver wit, voor tekst op een donkere achtergrond
 */

/**
 * @typedef {Object} DocumentThemeFonts
 * @property {string} heading Lettertype voor koppen
 * @property {string} body    Lettertype voor lopende tekst
 * @property {string} table   Lettertype in tabellen
 * @property {string} caption Lettertype voor bijschriften/kleine tekst
 */

/**
 * @typedef {Object} DocumentThemeTypography
 * Alle maten in halve punten (docx-eenheid: size 24 = 12pt), zoals de
 * `docx`-bibliotheek ze verwacht - dus rechtstreeks bruikbaar in een
 * TextRun zonder eigen omrekening in elke component.
 * @property {number} heading1Size
 * @property {number} heading2Size
 * @property {number} heading3Size
 * @property {number} bodySize
 * @property {number} tableSize
 * @property {number} captionSize
 */

/**
 * @typedef {Object} DocumentThemeLayout
 * @property {number} pageWidthMm
 * @property {number} pageHeightMm
 * @property {number} marginTopMm
 * @property {number} marginBottomMm
 * @property {number} marginLeftMm
 * @property {number} marginRightMm
 * @property {number} lineSpacing            docx `spacing.line`-eenheid (240 = enkele regelafstand)
 * @property {number} paragraphSpacingAfter  docx `spacing.after`-eenheid (twips; 240 = 12pt)
 * @property {number} sectionSpacingBefore   Ruimte boven een nieuwe sectie/kop
 */

/**
 * @typedef {Object} DocumentThemeBranding
 * @property {string} organizationName Standaardnaam op het voorblad wanneer geen organisatie is meegegeven
 * @property {string} footerLabel      Label dat in elke footer terugkomt (bijv. "Subsidie Kompas")
 * @property {{ path: string, width: number, height: number }} logo
 *   Pad naar het logo (publiek bestand, bijv. "/uploads/kompas-logo.png") en de
 *   afmetingen waarmee het in het document geplaatst moet worden. Bewust
 *   alleen een pad + afmetingen, geen ruwe beeldbytes: het inladen van het
 *   bestand (fetch/arrayBuffer) is de verantwoordelijkheid van de toekomstige
 *   Document Generator, niet van de Theme Engine - zo blijft dit bestand
 *   synchroon en zonder netwerkcode, en kan een Premium-generator hier later
 *   simpelweg een ander pad (eigen logo) doorgeven.
 */

/**
 * @typedef {Object} DocumentTheme
 * @property {string} name
 * @property {DocumentThemeColors} colors
 * @property {DocumentThemeFonts} fonts
 * @property {DocumentThemeTypography} typography
 * @property {DocumentThemeLayout} layout
 * @property {DocumentThemeBranding} branding
 */

const REQUIRED_COLOR_KEYS = [
  'primary', 'accent', 'secondary', 'success', 'warning', 'danger',
  'background', 'text', 'textSoft', 'tableHeaderBg', 'tableHeaderText',
  'gridLine', 'inputCell', 'hyperlink', 'white',
];

const REQUIRED_FONT_KEYS = ['heading', 'body', 'table', 'caption'];

const REQUIRED_TYPOGRAPHY_KEYS = [
  'heading1Size', 'heading2Size', 'heading3Size', 'bodySize', 'tableSize', 'captionSize',
];

const REQUIRED_LAYOUT_KEYS = [
  'pageWidthMm', 'pageHeightMm', 'marginTopMm', 'marginBottomMm', 'marginLeftMm',
  'marginRightMm', 'lineSpacing', 'paragraphSpacingAfter', 'sectionSpacingBefore',
];

const REQUIRED_BRANDING_KEYS = ['organizationName', 'footerLabel', 'logo'];

function controleerVelden(object, verplichteSleutels, label) {
  const ontbrekend = verplichteSleutels.filter((sleutel) => !(sleutel in (object || {})));

  if (ontbrekend.length) {
    throw new Error(`DocumentTheme: ${label} mist verplichte veld(en): ${ontbrekend.join(', ')}`);
  }
}

// Bevriest geneste objecten mee, zodat een consumer (bijv. een component die
// per ongeluk `theme.colors.primary = '#000'` doet) nooit per abuis het
// gedeelde thema-object aanpast - alle andere documenten die hetzelfde
// thema-object gebruiken zouden anders stilletjes meeveranderen.
function bevriesDiep(waarde) {
  if (waarde && typeof waarde === 'object' && !Object.isFrozen(waarde)) {
    Object.values(waarde).forEach(bevriesDiep);

    return Object.freeze(waarde);
  }

  return waarde;
}

/**
 * Bouwt en valideert een DocumentTheme. Gooit een duidelijke fout als een
 * verplicht veld ontbreekt, zodat een onvolledig thema nooit stilletjes met
 * `undefined`-waarden in een gegenereerd document terechtkomt.
 *
 * @param {string} name
 * @param {{ colors: DocumentThemeColors, fonts: DocumentThemeFonts, typography: DocumentThemeTypography, layout: DocumentThemeLayout, branding: DocumentThemeBranding }} config
 * @returns {DocumentTheme}
 */
export function createDocumentTheme(name, config) {
  if (!name || typeof name !== 'string') {
    throw new Error('DocumentTheme: een thema moet een naam (string) hebben.');
  }

  const { colors, fonts, typography, layout, branding } = config || {};

  controleerVelden(colors, REQUIRED_COLOR_KEYS, `colors ('${name}')`);
  controleerVelden(fonts, REQUIRED_FONT_KEYS, `fonts ('${name}')`);
  controleerVelden(typography, REQUIRED_TYPOGRAPHY_KEYS, `typography ('${name}')`);
  controleerVelden(layout, REQUIRED_LAYOUT_KEYS, `layout ('${name}')`);
  controleerVelden(branding, REQUIRED_BRANDING_KEYS, `branding ('${name}')`);

  return bevriesDiep({ name, colors, fonts, typography, layout, branding });
}

const themaRegister = new Map();

/**
 * Registreert een thema onder een naam, zodat het later via
 * `getDocumentTheme(naam)` opgezocht kan worden. Wordt aangeroepen door
 * elk bestand in ./themes/*.js zelf (side effect bij import), niet door
 * consumers rechtstreeks.
 *
 * @param {string} name
 * @param {DocumentTheme} theme
 */
export function registerDocumentTheme(name, theme) {
  themaRegister.set(name, theme);
}

export const DEFAULT_DOCUMENT_THEME_NAME = 'subsidieKompas';

/**
 * Zoekt een geregistreerd thema op. Valt terug op het standaardthema
 * (SubsidieKompasTheme) wanneer de gevraagde naam niet bestaat, zodat een
 * documentgenerator nooit crasht op een onbekende of nog niet gebouwde
 * thema-naam (bijv. 'neutral' of 'custom', vóórdat die thema's bestaan).
 *
 * @param {string} [name]
 * @returns {DocumentTheme}
 */
export function getDocumentTheme(name) {
  return themaRegister.get(name) || themaRegister.get(DEFAULT_DOCUMENT_THEME_NAME);
}

/**
 * Namen van alle op dit moment geregistreerde thema's - bruikbaar voor een
 * toekomstige "kies uw huisstijl"-keuzelijst in de UI.
 *
 * @returns {string[]}
 */
export function listDocumentThemeNames() {
  return Array.from(themaRegister.keys());
}
