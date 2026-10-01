// src/shared/document-theme/components/table.js
//
// Eén centrale tabel-builder voor alle documenten. De naam createSKTable()
// is letterlijk zoals gevraagd, maar de functie zelf is niet hardgecodeerd
// aan de Subsidie Kompas-huisstijl: alle styling komt uit het meegegeven
// `theme`, dus dezelfde functie werkt straks ongewijzigd met een toekomstig
// NeutralTheme of CustomTheme. Geen enkel toekomstig document zou een eigen,
// losse `new Table(...)` moeten bouwen - alles loopt via deze ene functie.
import {
  Table, TableRow, TableCell, Paragraph, TextRun,
  WidthType, BorderStyle, ShadingType, VerticalAlign, AlignmentType,
} from 'docx';

function hexZonderHekje(hex) {
  return String(hex || '').replace('#', '');
}

const UITLIJNING = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
};

function cellRand(theme) {
  const stijl = { style: BorderStyle.SINGLE, size: 4, color: hexZonderHekje(theme.colors.gridLine) };

  return { top: stijl, bottom: stijl, left: stijl, right: stijl };
}

function maakCel(tekst, { header, theme, breedtePercentage, align = 'left' }) {
  return new TableCell({
    width: breedtePercentage ? { size: breedtePercentage, type: WidthType.PERCENTAGE } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    shading: header
      ? { type: ShadingType.CLEAR, fill: hexZonderHekje(theme.colors.tableHeaderBg) }
      : undefined,
    borders: cellRand(theme),
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [
      new Paragraph({
        alignment: UITLIJNING[align] || AlignmentType.LEFT,
        children: [
          new TextRun({
            text: tekst == null ? '' : String(tekst),
            bold: !!header,
            font: theme.fonts.table,
            size: theme.typography.tableSize,
            color: hexZonderHekje(header ? theme.colors.tableHeaderText : theme.colors.text),
          }),
        ],
      }),
    ],
  });
}

/**
 * @param {Object} config
 * @param {string[]} [config.headers]                       Kopregel (optioneel - een tabel zonder kop is ook toegestaan)
 * @param {(string|number)[][]} config.rows                  Databodyrijen
 * @param {number[]} [config.columnWidthsPercent]            Kolombreedtes als percentages (horen op te tellen tot 100); zonder opgave verdeelt Word de kolommen gelijk
 * @param {('left'|'center'|'right')[]} [config.columnAlign] Uitlijning per kolom
 * @param {import('../documentTheme.js').DocumentTheme} config.theme
 * @returns {Table}
 */
export function createSKTable({ headers, rows, columnWidthsPercent, columnAlign, theme }) {
  const kolomAantal = (headers && headers.length) || (rows && rows[0] && rows[0].length) || 0;
  const uitlijningPerKolom = columnAlign || new Array(kolomAantal).fill('left');
  const breedtePerKolom = columnWidthsPercent || null;

  const koprij = headers
    ? new TableRow({
      tableHeader: true,
      children: headers.map((tekst, i) => maakCel(tekst, {
        header: true,
        theme,
        breedtePercentage: breedtePerKolom ? breedtePerKolom[i] : undefined,
        align: uitlijningPerKolom[i],
      })),
    })
    : null;

  const dataRijen = (rows || []).map((rij) => new TableRow({
    children: rij.map((tekst, i) => maakCel(tekst, {
      header: false,
      theme,
      breedtePercentage: breedtePerKolom ? breedtePerKolom[i] : undefined,
      align: uitlijningPerKolom[i],
    })),
  }));

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: koprij ? [koprij, ...dataRijen] : dataRijen,
  });
}

// Alias voor het geval een toekomstige generator de generieke naam verwacht
// in plaats van de Subsidie-Kompas-achtige naam - beide verwijzen naar
// precies dezelfde, thema-aangedreven implementatie.
export const createTable = createSKTable;
