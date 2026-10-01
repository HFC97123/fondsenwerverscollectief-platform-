// src/shared/document-theme/components/infoBlock.js
//
// Een informatie-/legendablok (bijv. "gele cellen = door u in te vullen ·
// witte cellen = berekend, niet handmatig wijzigen", zie CLAUDE.md) als
// afgebakend, gekleurd vak. docx.js kent geen "gearceerde alinea met rand"
// als primitief; de gangbare, betrouwbare manier om zo'n vak te maken is een
// 1x1-tabel met arcering en rand - vandaar dat dit dezelfde celopbouw als
// table.js hergebruikt (geen tweede, losse implementatie van randen/arcering).
import { Table, TableRow, TableCell, Paragraph, TextRun, WidthType, BorderStyle, ShadingType } from 'docx';

function hexZonderHekje(hex) {
  return String(hex || '').replace('#', '');
}

const VARIANT_KLEUR = {
  neutral: (theme) => theme.colors.background,
  input: (theme) => theme.colors.inputCell,
  success: (theme) => theme.colors.success,
  warning: (theme) => theme.colors.warning,
};

/**
 * @param {string|string[]} content Eén tekstregel, of meerdere regels als losse alinea's binnen hetzelfde vak
 * @param {import('../documentTheme.js').DocumentTheme} theme
 * @param {{ variant?: 'neutral'|'input'|'success'|'warning' }} [options]
 * @returns {Table}
 */
export function createInfoBlock(content, theme, { variant = 'neutral' } = {}) {
  const regels = Array.isArray(content) ? content : [content];
  const achtergrond = (VARIANT_KLEUR[variant] || VARIANT_KLEUR.neutral)(theme);
  const rand = { style: BorderStyle.SINGLE, size: 4, color: hexZonderHekje(theme.colors.gridLine) };

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: hexZonderHekje(achtergrond) },
            borders: { top: rand, bottom: rand, left: rand, right: rand },
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            children: regels.map((regel) => new Paragraph({
              children: [
                new TextRun({
                  text: regel,
                  font: theme.fonts.body,
                  size: theme.typography.captionSize,
                  color: hexZonderHekje(theme.colors.text),
                }),
              ],
            })),
          }),
        ],
      }),
    ],
  });
}
