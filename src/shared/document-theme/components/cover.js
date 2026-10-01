// src/shared/document-theme/components/cover.js
//
// Bouwt de voorblad-inhoud (logo, titel, subtitel, project, organisatie,
// opgesteld door, datum, versie) volgens de huisstijl. Geeft een array
// Paragraph-elementen terug (geen los `Document`-object): de toekomstige
// Document Generator plaatst dit als eerste blok in het document, eventueel
// gevolgd door een pagina-einde (`PageBreak`) - dat pagina-eindebeheer hoort
// bij de generator, niet bij deze op zichzelf staande component.
import { Paragraph, TextRun, ImageRun, AlignmentType } from 'docx';

function hexZonderHekje(hex) {
  return String(hex || '').replace('#', '');
}

/**
 * @typedef {Object} CoverImage
 * @property {ArrayBuffer|Uint8Array|Buffer} data Ruwe beeldbytes (PNG)
 * @property {number} [width]  Weergavebreedte in px; standaard theme.branding.logo.width
 * @property {number} [height] Weergavehoogte in px; standaard theme.branding.logo.height
 */

/**
 * @param {import('../documentTheme.js').DocumentTheme} theme
 * @param {Object} meta
 * @param {string} meta.title
 * @param {string} [meta.subtitle]
 * @param {string} [meta.projectName]
 * @param {string} [meta.organizationName]  Standaard: theme.branding.organizationName
 * @param {string} [meta.preparedBy]
 * @param {string} [meta.date]              Standaard: vandaag, in nl-NL-notatie
 * @param {string} [meta.version]           Standaard: "1.0"
 * @param {CoverImage} [meta.logoImage]     Optioneel: als de aanroeper de logobytes al heeft ingeladen. Zonder dit veld verschijnt het voorblad zonder logo-afbeelding (geen harde fout) - zie de toelichting in documentTheme.js bij `branding.logo`.
 * @returns {Paragraph[]}
 */
export function createCover(theme, meta = {}) {
  const {
    title,
    subtitle,
    projectName,
    organizationName = theme.branding.organizationName,
    preparedBy,
    date = new Date().toLocaleDateString('nl-NL'),
    version = '1.0',
    logoImage,
  } = meta;

  const regels = [];

  if (logoImage && logoImage.data) {
    regels.push(new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: theme.layout.sectionSpacingBefore },
      children: [
        new ImageRun({
          type: 'png',
          data: logoImage.data,
          transformation: {
            width: logoImage.width || theme.branding.logo.width,
            height: logoImage.height || theme.branding.logo.height,
          },
        }),
      ],
    }));
  }

  regels.push(new Paragraph({
    spacing: { before: 720, after: theme.layout.paragraphSpacingAfter },
    children: [
      new TextRun({
        text: title || '',
        bold: true,
        font: theme.fonts.heading,
        size: theme.typography.heading1Size + 8,
        color: hexZonderHekje(theme.colors.primary),
      }),
    ],
  }));

  if (subtitle) {
    regels.push(new Paragraph({
      spacing: { after: theme.layout.sectionSpacingBefore },
      children: [
        new TextRun({
          text: subtitle,
          font: theme.fonts.heading,
          size: theme.typography.heading3Size,
          color: hexZonderHekje(theme.colors.accent),
        }),
      ],
    }));
  }

  const metaRegels = [
    ['Project', projectName],
    ['Organisatie', organizationName],
    ['Opgesteld door', preparedBy],
    ['Datum', date],
    ['Versie', version],
  ].filter(([, waarde]) => waarde);

  metaRegels.forEach(([label, waarde]) => {
    regels.push(new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: `${label}: `,
          bold: true,
          font: theme.fonts.body,
          size: theme.typography.bodySize,
          color: hexZonderHekje(theme.colors.textSoft),
        }),
        new TextRun({
          text: String(waarde),
          font: theme.fonts.body,
          size: theme.typography.bodySize,
          color: hexZonderHekje(theme.colors.text),
        }),
      ],
    }));
  });

  return regels;
}
