// src/shared/document-theme/components/paragraph.js
//
// Standaard lichaamstekst-alinea, altijd via het thema gestyled - nergens in
// een documentgenerator hoort een los `new Paragraph(...)` met een eigen,
// hardgecodeerde fontnaam of kleur te staan; alles loopt via deze functie.
import { Paragraph, TextRun, AlignmentType } from 'docx';

function hexZonderHekje(hex) {
  return String(hex || '').replace('#', '');
}

const UITLIJNING = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};

/**
 * @param {string} text
 * @param {import('../documentTheme.js').DocumentTheme} theme
 * @param {{ bold?: boolean, italic?: boolean, color?: string, align?: 'left'|'center'|'right'|'justify' }} [options]
 * @returns {Paragraph}
 */
export function createParagraph(text, theme, options = {}) {
  const { bold = false, italic = false, color, align = 'left' } = options;

  return new Paragraph({
    alignment: UITLIJNING[align] || AlignmentType.LEFT,
    spacing: { after: theme.layout.paragraphSpacingAfter, line: theme.layout.lineSpacing },
    children: [
      new TextRun({
        text,
        bold,
        italics: italic,
        font: theme.fonts.body,
        size: theme.typography.bodySize,
        color: hexZonderHekje(color || theme.colors.text),
      }),
    ],
  });
}
