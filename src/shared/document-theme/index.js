// src/shared/document-theme/index.js
//
// Publieke ingang van de Document Theme Engine. Een toekomstige Document
// Generator importeert uitsluitend van hier - nooit rechtstreeks uit
// ./themes/*.js of ./components/*.js - zodat de interne bestandsindeling vrij
// kan veranderen zonder consumers te breken.
export {
  createDocumentTheme,
  registerDocumentTheme,
  getDocumentTheme,
  listDocumentThemeNames,
  DEFAULT_DOCUMENT_THEME_NAME,
} from './documentTheme.js';

export { getPageSetup, getUsableWidthMm } from './pageSetup.js';

// Side-effect import: registreert 'subsidieKompas' in het thema-register.
// Toekomstige thema's (bijv. themes/neutralTheme.js, themes/customTheme.js)
// volgen exact hetzelfde patroon: eigen bestand, eigen registerDocumentTheme-
// aanroep, hier met één regel bijgevoegd - de rest van de Theme Engine hoeft
// daarvoor niet te veranderen.
import './themes/subsidieKompasTheme.js';

export { SubsidieKompasTheme } from './themes/subsidieKompasTheme.js';

export {
  createCover,
  createHeading1,
  createHeading2,
  createHeading3,
  createParagraph,
  createBulletList,
  createSKTable,
  createTable,
  createInfoBlock,
  createSection,
  createFooter,
} from './components/index.js';
