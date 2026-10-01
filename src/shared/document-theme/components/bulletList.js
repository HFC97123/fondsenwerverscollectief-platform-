// src/shared/document-theme/components/bulletList.js
//
// Opsommingstekst, consistent met de thema-tekststijl van gewone alinea's.
import { Paragraph, TextRun } from 'docx';

function hexZonderHekje(hex) {
  return String(hex || '').replace('#', '');
}

/**
 * @param {string[]} items
 * @param {import('../documentTheme.js').DocumentTheme} theme
 * @returns {Paragraph[]}
 */
export function createBulletList(items, theme) {
  return (items || []).map((item) => new Paragraph({
    bullet: { level: 0 },
    spacing: { after: Math.round(theme.layout.paragraphSpacingAfter / 2), line: theme.layout.lineSpacing },
    children: [
      new TextRun({
        text: item,
        font: theme.fonts.body,
        size: theme.typography.bodySize,
        color: hexZonderHekje(theme.colors.text),
      }),
    ],
  }));
}
