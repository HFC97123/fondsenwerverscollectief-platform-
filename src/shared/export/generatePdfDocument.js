// src/shared/export/generatePdfDocument.js
//
// Echte PDF (tekst, koppen, tabellen, paginanummers - geen schermafbeelding),
// opgebouwd uit EXACT dezelfde `content.blocks` (normalizeDocumentContent) en
// hetzelfde Document Theme (kleuren, lettertype, maten, marges, logo, footer)
// als generateWordDocument(). Zelfde signatuur als generateWordDocument, zodat
// Word en PDF één gedeeld invoermodel hebben en een toekomstig (Premium-)thema
// via `themeName` automatisch in beide formaten doorwerkt.
//
// Bibliotheek: pdfmake (client-side, geen server nodig). Wordt pas bij de
// eerste PDF-export geladen (dynamic import), zodat de rest van de app niet
// zwaarder wordt. Lettertype: Helvetica (standaard PDF-lettertype, metrisch
// gelijk aan het Arial van het Word-thema; niets in te sluiten).
import { getDocumentTheme } from '../document-theme/index.js';

const PT_PER_MM = 72 / 25.4;
const PT_PER_PX = 0.75;

// Helvetica (WinAnsi) kent Latin-1 plus een handvol leestekens. Alles daarbuiten
// wordt eerst zonder accent benaderd (ş -> s), anders een '?', zodat een
// vreemd teken nooit de hele PDF laat mislukken.
const WINANSI_EXTRA = '€‘’‚“”„•–—…™†‡‰‹›ŒœŠšŸŽžƒˆ˜';
const LOS_TE_MAPPEN = { ł: 'l', Ł: 'L', đ: 'd', Đ: 'D', ı: 'i', İ: 'I', '→': '->', '←': '<-', '✓': 'v', '✔': 'v', '≥': '>=', '≤': '<=' };

export function maakPdfVeilig(invoer) {
  return Array.from(String(invoer == null ? '' : invoer).replace(/ /g, ' '))
    .map((ch) => {
      const code = ch.codePointAt(0);

      if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || code === 0x0a || code === 0x09 || WINANSI_EXTRA.includes(ch)) {
        return ch;
      }

      if (LOS_TE_MAPPEN[ch]) {
        return LOS_TE_MAPPEN[ch];
      }

      const zonderAccent = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');

      return zonderAccent && zonderAccent !== ch && /^[\x20-\x7e\xa0-\xff]+$/.test(zonderAccent) ? zonderAccent : code < 0x20 ? '' : '?';
    })
    .join('');
}

async function laadLogoDataUrl(theme) {
  try {
    if (typeof fetch !== 'function' || !theme?.branding?.logo?.path) {
      return null;
    }

    const respons = await fetch(theme.branding.logo.path);

    if (!respons.ok) {
      return null;
    }

    const bytes = new Uint8Array(await respons.arrayBuffer());
    let binair = '';

    for (let i = 0; i < bytes.length; i += 0x8000) {
      binair += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }

    return `data:image/png;base64,${btoa(binair)}`;
  } catch (_) {
    return null;
  }
}

// Kolombreedtes: evenredig met de (afgekapte) langste celinhoud, met een
// minimum, zodat korte kolommen (jaar, bedrag) niet even breed worden als
// een toelichting. Alleen voor PDF; Word laat dit aan Word zelf over.
function kolomBreedtes(headers, rows) {
  const gewichten = headers.map((h, i) => {
    const cellen = [String(h || ''), ...rows.map((r) => String(r[i] == null ? '' : r[i]))];
    const langste = Math.max(String(h || '').length * 0.8, ...cellen.map((c) => c.length));
    // Het langste woord moet altijd op één regel passen (geen "Aangevraagd" -> "Aangevraag/d").
    const langsteWoord = Math.max(...cellen.map((c) => Math.max(0, ...c.split(/\s+/).map((w) => w.length))));

    return Math.max(Math.min(60, Math.max(8, langste)), Math.min(24, langsteWoord * 1.25 + 3));
  });
  const totaal = gewichten.reduce((a, b) => a + b, 0);

  return gewichten.map((g) => `${((g / totaal) * 100).toFixed(2)}%`);
}

/**
 * @param {Object} opties  Zelfde velden als generateWordDocument
 * @returns {Promise<Blob>}
 */
export async function generatePdfDocument({ title, organizationName, documentType, content, themeName } = {}) {
  const theme = getDocumentTheme(themeName);
  const { colors, layout, typography } = theme;
  const marge = layout.marginLeftMm * PT_PER_MM;
  const veilig = maakPdfVeilig;
  const lineHeight = layout.lineSpacing / 240;
  const naPt = layout.paragraphSpacingAfter / 20;
  const voorPt = layout.sectionSpacingBefore / 20;
  const font = 'Helvetica';
  const koppen = { 1: typography.heading1Size / 2, 2: typography.heading2Size / 2, 3: typography.heading3Size / 2 };
  const basis = typography.bodySize / 2;

  const [pdfMakeModule, fontModule, logo] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/standard-fonts/Helvetica.js'),
    laadLogoDataUrl(theme),
  ]);
  const pdfMake = pdfMakeModule.default || pdfMakeModule;
  const fontContainer = fontModule.default || fontModule;

  pdfMake.addFontContainer(fontContainer);

  // ---- voorblad (zelfde onderdelen en volgorde als createCover)
  const inhoud = [];

  if (logo) {
    inhoud.push({
      image: logo,
      width: theme.branding.logo.width * PT_PER_PX,
      height: theme.branding.logo.height * PT_PER_PX,
      margin: [0, 0, 0, voorPt],
    });
  }

  inhoud.push({
    text: veilig(title || theme.branding.organizationName),
    bold: true,
    fontSize: (typography.heading1Size + 8) / 2,
    color: colors.primary,
    margin: [0, 36, 0, naPt],
  });

  [
    ['Organisatie', organizationName || null],
    ['Datum', new Date().toLocaleDateString('nl-NL')],
    ['Versie', '1.0'],
  ]
    .filter(([, waarde]) => waarde)
    .forEach(([label, waarde]) => {
      inhoud.push({
        text: [
          { text: `${label}: `, bold: true, color: colors.textSoft },
          { text: veilig(waarde), color: colors.text },
        ],
        fontSize: basis,
        margin: [0, 0, 0, 4],
      });
    });

  // ---- inhoud (1-op-1 dezelfde blocks als de Word-export)
  (content?.blocks || []).forEach((blok) => {
    switch (blok.type) {
      case 'heading':
        inhoud.push({
          text: veilig(blok.text),
          bold: true,
          fontSize: koppen[blok.level] || koppen[2],
          color: colors.primary,
          margin: [0, voorPt, 0, naPt],
          headlineLevel: blok.level,
        });
        break;

      case 'bullets':
        inhoud.push({
          ul: (blok.items || []).map((item) => ({ text: veilig(item), margin: [0, 0, 0, naPt / 2] })),
          markerColor: colors.accent,
          margin: [0, 0, 0, naPt / 2],
        });
        break;

      case 'numbered':
        (blok.items || []).forEach((item) => {
          inhoud.push({ text: veilig(`${item.nummer}. ${item.tekst}`), margin: [0, 0, 0, naPt] });
        });
        break;

      case 'table': {
        const kop = (blok.headers || []).map((h) => ({
          text: veilig(h),
          bold: true,
          color: colors.tableHeaderText,
          fillColor: colors.tableHeaderBg,
          fontSize: typography.tableSize / 2,
        }));
        const rijen = (blok.rows || []).map((r) =>
          r.map((c) => ({ text: veilig(c), fontSize: typography.tableSize / 2, color: colors.text })),
        );

        inhoud.push({
          table: {
            headerRows: 1,
            dontBreakRows: true,
            widths: kolomBreedtes(blok.headers || [], blok.rows || []),
            body: [kop, ...rijen],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => colors.gridLine,
            vLineColor: () => colors.gridLine,
            paddingLeft: () => 6,
            paddingRight: () => 6,
            paddingTop: () => 4,
            paddingBottom: () => 4,
          },
          margin: [0, 0, 0, naPt],
        });
        break;
      }

      case 'paragraph':
      default:
        inhoud.push({ text: veilig(blok.text), margin: [0, 0, 0, naPt] });
        break;
    }
  });

  const voetLabel = documentType ? `${theme.branding.footerLabel} · ${documentType}` : theme.branding.footerLabel;

  const definitie = {
    info: { title: veilig(title || ''), author: theme.branding.organizationName, creator: theme.branding.organizationName },
    pageSize: 'A4',
    pageMargins: [marge, layout.marginTopMm * PT_PER_MM, marge, layout.marginBottomMm * PT_PER_MM],
    defaultStyle: { font, fontSize: basis, lineHeight, color: colors.text },
    content: inhoud,
    footer: (huidige, totaal) => ({
      margin: [marge, 18, marge, 0],
      columns: [
        { text: veilig(voetLabel), fontSize: typography.captionSize / 2, color: colors.textSoft },
        { text: `Pagina ${huidige} van ${totaal}`, alignment: 'right', fontSize: typography.captionSize / 2, color: colors.textSoft },
      ],
    }),
    // Een kop mag nooit alleen onderaan een pagina blijven staan.
    pageBreakBefore: (huidig, volgende) => huidig.headlineLevel != null && volgende.length === 0,
  };

  return pdfMake.createPdf(definitie).getBlob();
}
