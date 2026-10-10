// src/shared/export/generateStructuredExcel.js
//
// Gestructureerde Excel-export (project, organisatieprofiel, gesprek, en
// documenten zonder begrotingsstructuur): één tabblad per onderdeel, logische
// kolommen, geen tekstblob in één cel, en echte getallen/datums (geen
// tekst) waar de bron die geeft. Gebruikt dezelfde exceljs-bibliotheek en
// dezelfde Subsidie Kompas-kleuren (Document Theme Engine) als de bestaande
// begrotings-Excel (shared/budget/generateExcelDocument.js, die ongewijzigd
// blijft en voor begrotingen blijft gelden).
import ExcelJS from 'exceljs';
import { getDocumentTheme } from '../document-theme/index.js';

const FORMATEN = {
  euro: '€ #,##0.00',
  getal: '#,##0.##',
  procent: '0%',
  datum: 'dd-mm-yyyy',
  datumtijd: 'dd-mm-yyyy hh:mm',
};

const argb = (hex) => `FF${String(hex || '').replace('#', '').trim().toUpperCase()}`;

// Tabbladnamen: maximaal 31 tekens, geen []:*?/\ en uniek.
function tabbladNaam(naam, gebruikt) {
  const basis = String(naam || 'Blad').replace(/[\[\]:*?/\\]/g, ' ').trim().slice(0, 31) || 'Blad';
  let kandidaat = basis;
  let i = 2;

  while (gebruikt.has(kandidaat.toLowerCase())) {
    kandidaat = `${basis.slice(0, 28)} ${i}`;
    i += 1;
  }

  gebruikt.add(kandidaat.toLowerCase());

  return kandidaat;
}

// Bepaalt type en waarde van één cel. 'auto' (tabelcellen uit AI-tekst):
// alleen een cel die ALS GEHEEL een bedrag ("€ 12.500,50") of een getal is
// wordt numeriek - een jaartal als "2026" blijft een getal, "0612345678" of
// "12-3" blijft tekst.
function celWaarde(waarde, type) {
  if (waarde == null || waarde === '') {
    return { value: null, fmt: null };
  }

  if (waarde instanceof Date) {
    return Number.isNaN(waarde.getTime()) ? { value: null, fmt: null } : { value: waarde, fmt: FORMATEN[type === 'datumtijd' ? 'datumtijd' : 'datum'] };
  }

  if (typeof waarde === 'number') {
    return { value: waarde, fmt: FORMATEN[type === 'auto' || !FORMATEN[type] ? 'getal' : type] };
  }

  const s = String(waarde);

  if (type === 'auto') {
    const bedrag = s.trim().match(/^€\s*(-?\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|-?\d+(?:,\d{1,2})?)$/);

    if (bedrag) {
      return { value: Number(bedrag[1].replace(/\./g, '').replace(',', '.')), fmt: FORMATEN.euro };
    }

    if (/^-?(0|[1-9]\d{0,14})(,\d+)?$/.test(s.trim())) {
      return { value: Number(s.trim().replace(',', '.')), fmt: FORMATEN.getal };
    }
  }

  return { value: s, fmt: null };
}

/**
 * @param {Object} model  Exportmodel uit exportModel.js (gebruikt titel, organisatieNaam, sheets)
 * @param {Object} [opties]  { themeName }
 * @returns {Promise<Blob>}
 */
export async function generateStructuredExcel(model, { themeName } = {}) {
  const theme = getDocumentTheme(themeName);
  const kleur = theme.colors;
  const lettertype = theme.fonts.body;
  const wb = new ExcelJS.Workbook();

  wb.creator = 'Subsidie Kompas';
  wb.created = new Date();

  const gebruikt = new Set();
  const rand = { style: 'thin', color: { argb: argb(kleur.gridLine) } };

  (model.sheets || []).forEach((blad) => {
    if (!blad.rijen || !blad.rijen.length) {
      return;
    }

    const ws = wb.addWorksheet(tabbladNaam(blad.naam, gebruikt), { views: [{ showGridLines: false }] });
    const aantal = blad.kolommen.length;

    blad.kolommen.forEach((k, i) => {
      ws.getColumn(i + 1).width = k.breedte || 20;
    });

    // Titelbalk (rij 1) + meta (rij 2), in dezelfde stijl als de begrotings-Excel.
    for (let c = 1; c <= aantal; c += 1) {
      ws.getCell(1, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(kleur.primary) } };
    }

    const titel = ws.getCell(1, 1);

    titel.value = `${model.titel || 'Subsidie Kompas'} – ${blad.naam}`;
    titel.font = { name: lettertype, size: 16, bold: true, color: { argb: argb(kleur.white) } };
    titel.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.getRow(1).height = 28;

    const meta = [model.organisatieNaam ? `Organisatie: ${model.organisatieNaam}` : null, `Exportdatum: ${new Date().toLocaleDateString('nl-NL')}`]
      .filter(Boolean)
      .join('   ·   ');
    const metaCel = ws.getCell(2, 1);

    metaCel.value = meta;
    metaCel.font = { name: lettertype, size: 10, color: { argb: argb(kleur.textSoft) } };
    metaCel.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    const kopRij = 4;

    blad.kolommen.forEach((k, i) => {
      const cel = ws.getCell(kopRij, i + 1);

      cel.value = k.kop;
      cel.font = { name: lettertype, size: 10, bold: true, color: { argb: argb(kleur.tableHeaderText) } };
      cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(kleur.tableHeaderBg) } };
      cel.alignment = { vertical: 'middle', horizontal: ['euro', 'getal', 'procent'].includes(k.type) ? 'right' : 'left', wrapText: true };
      cel.border = { top: rand, bottom: rand, left: rand, right: rand };
    });
    ws.getRow(kopRij).height = 22;

    blad.rijen.forEach((rij, r) => {
      blad.kolommen.forEach((k, i) => {
        const cel = ws.getCell(kopRij + 1 + r, i + 1);
        const type = k.type === 'auto' && rij.type ? rij.type : k.type;
        const { value, fmt } = celWaarde(rij[k.sleutel], type);

        cel.value = value;

        if (fmt) {
          cel.numFmt = fmt;
        }

        const isGetal = typeof value === 'number';

        cel.font = { name: lettertype, size: 10, color: { argb: argb(kleur.text) } };
        cel.alignment = { vertical: 'top', horizontal: isGetal ? 'right' : 'left', wrapText: true };
        cel.border = { top: rand, bottom: rand, left: rand, right: rand };
      });
    });

    ws.views = [{ state: 'frozen', ySplit: kopRij, showGridLines: false }];
    ws.autoFilter = { from: { row: kopRij, column: 1 }, to: { row: kopRij + blad.rijen.length, column: aantal } };
    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  });

  const buffer = await wb.xlsx.writeBuffer();

  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
