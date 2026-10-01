// src/shared/document-theme/pageSetup.js
//
// Zet de layout-instellingen van een thema om naar de `page`-eigenschap die
// `docx` verwacht op `Document({ sections: [{ properties: { page } }] })`.
// Dit is de enige plek die paginaformaat/marges naar docx-eenheden (twips)
// omrekent - een toekomstige Document Generator hoeft zelf nooit een
// millimeter-naar-twip-berekening te doen of te dupliceren.
import { convertMillimetersToTwip } from 'docx';

/**
 * @param {import('./documentTheme.js').DocumentTheme} theme
 * @returns {{ size: { width: number, height: number }, margin: { top: number, bottom: number, left: number, right: number } }}
 */
export function getPageSetup(theme) {
  const { pageWidthMm, pageHeightMm, marginTopMm, marginBottomMm, marginLeftMm, marginRightMm } = theme.layout;

  return {
    size: {
      width: convertMillimetersToTwip(pageWidthMm),
      height: convertMillimetersToTwip(pageHeightMm),
    },
    margin: {
      top: convertMillimetersToTwip(marginTopMm),
      bottom: convertMillimetersToTwip(marginBottomMm),
      left: convertMillimetersToTwip(marginLeftMm),
      right: convertMillimetersToTwip(marginRightMm),
    },
  };
}

/**
 * Bruikbare breedte van de pagina (paginabreedte min linker- en
 * rechtermarge) in millimeters - handig voor componenten die iets rechts
 * moeten uitlijnen (bijv. de paginanummering in de footer).
 *
 * @param {import('./documentTheme.js').DocumentTheme} theme
 * @returns {number}
 */
export function getUsableWidthMm(theme) {
  return theme.layout.pageWidthMm - theme.layout.marginLeftMm - theme.layout.marginRightMm;
}
