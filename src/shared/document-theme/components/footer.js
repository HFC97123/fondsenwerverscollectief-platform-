// src/shared/document-theme/components/footer.js
//
// Eén centrale footer: merklabel + documenttype links, paginanummering
// rechts. De brede-breedte-berekening voor de rechtse tab loopt via
// pageSetup.js, zodat een wijziging in de marges van een thema hier niet
// opnieuw uitgerekend hoeft te worden.
import { Footer, Paragraph, TextRun, PageNumber, TabStopType, convertMillimetersToTwip } from 'docx';
import { getUsableWidthMm } from '../pageSetup.js';

function hexZonderHekje(hex) {
  return String(hex || '').replace('#', '');
}

/**
 * @param {import('../documentTheme.js').DocumentTheme} theme
 * @param {{ documentType?: string }} [options] Bijv. "Projectplan" - komt naast het merklabel in de footer te staan
 * @returns {Footer}
 */
export function createFooter(theme, { documentType } = {}) {
  const label = documentType ? `${theme.branding.footerLabel} · ${documentType}` : theme.branding.footerLabel;

  return new Footer({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: convertMillimetersToTwip(getUsableWidthMm(theme)) }],
        children: [
          new TextRun({
            text: label,
            font: theme.fonts.caption,
            size: theme.typography.captionSize,
            color: hexZonderHekje(theme.colors.textSoft),
          }),
          new TextRun({ text: '\t' }),
          new TextRun({
            children: ['Pagina ', PageNumber.CURRENT, ' van ', PageNumber.TOTAL_PAGES],
            font: theme.fonts.caption,
            size: theme.typography.captionSize,
            color: hexZonderHekje(theme.colors.textSoft),
          }),
        ],
      }),
    ],
  });
}
