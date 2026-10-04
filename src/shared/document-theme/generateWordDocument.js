// src/shared/document-theme/generateWordDocument.js
//
// RC1 stap 3B: de ene, centrale "Document Generator" waarnaar de bestaande
// bouwstenen (cover.js, headings.js, paragraph.js, bulletList.js, table.js,
// footer.js, pageSetup.js, documentTheme.js) al vooruitwezen in hun eigen
// commentaar (zie bijv. cover.js: "de toekomstige Document Generator plaatst
// dit als eerste blok"). Dit bestand bouwt GEEN eigen huisstijl, kleuren,
// fonts of marges - het roept uitsluitend de bestaande, hierboven genoemde
// componenten aan en voegt ze samen tot één `docx.Document`, en is de enige
// plek in de hele codebase die `new Document(...)` en `Packer.toBlob()`
// aanroept.
//
// Bewust GEEN tweede documentmodel: de content komt binnen als de platte
// `blocks`-array van `normalizeDocumentContent()` (zie dat bestand) en wordt
// hier 1-op-1 omgezet naar de bestaande component-aanroepen - geen nieuwe
// opmaakregels, geen nieuwe kleuren/marges/fonts.
// Importeert uitsluitend uit de eigen './index.js' (de publieke ingang van de
// Theme Engine) - nooit rechtstreeks uit documentTheme.js/pageSetup.js/
// components/*.js, exact zoals index.js's eigen commentaar voorschrijft: "Een
// toekomstige Document Generator importeert uitsluitend van hier - nooit
// rechtstreeks uit ./themes/*.js of ./components/*.js". Dit is bovendien
// functioneel noodzakelijk: index.js bevat de side-effect import die
// 'subsidieKompas' in het thema-register zet (themes/subsidieKompasTheme.js);
// zonder die ene import zou getDocumentTheme() niets gevonden hebben.
import { Document, Packer } from 'docx';
import {
  getDocumentTheme,
  getPageSetup,
  createCover,
  createHeading1,
  createHeading2,
  createHeading3,
  createParagraph,
  createBulletList,
  createSKTable,
  createFooter,
} from './index.js';

const KOP_PER_NIVEAU = { 1: createHeading1, 2: createHeading2, 3: createHeading3 };

function blokNaarElementen(blok, theme) {
  switch (blok.type) {
    case 'heading': {
      const maakKop = KOP_PER_NIVEAU[blok.level] || createHeading2;

      return [maakKop(blok.text, theme)];
    }

    case 'bullets':
      return createBulletList(blok.items, theme);

    case 'numbered':
      // De Theme Engine kent (bewust, zie headings.js) geen echte, native
      // Word-automatische nummering - exact dezelfde beredenering als daar:
      // het nummer wordt als platte tekst vóór de regel gezet, met het
      // oorspronkelijke, door de AI gegeven nummer (nooit zelf hernummerd).
      // Geen nieuw opsommingscomponent nodig, geen tweede stijlsysteem.
      return blok.items.map((item) => createParagraph(`${item.nummer}. ${item.tekst}`, theme));

    case 'table':
      return [
        createSKTable({
          headers: blok.headers,
          rows: blok.rows,
          theme,
        }),
      ];

    case 'paragraph':
    default:
      return [createParagraph(blok.text, theme)];
  }
}

// Best-effort: het al publiek beschikbare Subsidie Kompas-logo (zie
// themes/subsidieKompasTheme.js - hetzelfde bestand als KompasToolPage.jsx/
// KompasSubnav.jsx/HomePage.jsx al gebruiken) inladen als ruwe PNG-bytes, voor
// `createCover({ logoImage })`. Faalt dit (geen `fetch` beschikbaar, bestand
// niet bereikbaar, netwerkfout), dan geeft deze functie `null` terug - de
// cover rendert dan gewoon zonder logo-afbeelding, exact zoals `cover.js` daar
// zelf al expliciet rekening mee houdt ("Zonder dit veld verschijnt het
// voorblad zonder logo-afbeelding (geen harde fout)"). Dit mag de
// documentgeneratie dus nooit laten mislukken.
async function laadLogoAfbeelding(theme) {
  try {
    if (typeof fetch !== 'function' || !theme?.branding?.logo?.path) {
      return null;
    }

    const respons = await fetch(theme.branding.logo.path);

    if (!respons.ok) {
      return null;
    }

    const data = await respons.arrayBuffer();

    return { data, width: theme.branding.logo.width, height: theme.branding.logo.height };
  } catch (_) {
    return null;
  }
}

/**
 * Bouwt een echt `.docx`-bestand (OOXML, via de `docx`-bibliotheek) uit
 * genormaliseerde documentinhoud, met de bestaande Subsidie Kompas Document
 * Theme Engine. Dit is de enige functie in de codebase die `new Document(...)`
 * en `Packer.toBlob()` aanroept.
 *
 * Bevat UITSLUITEND wat expliciet is meegegeven: geen verzonnen organisatie-
 * naam, projectnaam of opsteller - ontbrekende metadata wordt gewoon
 * weggelaten (zie createCover: een meta-regel zonder waarde verschijnt niet).
 *
 * @param {Object} opties
 * @param {string} [opties.title]            Documenttitel op het voorblad (bijv. de documentsoort, "Projectplan")
 * @param {string|null} [opties.organizationName] Naam van de organisatie van het lid, alleen als die daadwerkelijk bekend is - geef expliciet `null` mee (niet `undefined`) om de regel te laten vervallen in plaats van op de thema-standaardwaarde terug te vallen
 * @param {string} [opties.documentType]     Label voor de footer (bijv. "Projectplan") - zie createFooter
 * @param {{ blocks: Array<Object> }} opties.content  Resultaat van normalizeDocumentContent()
 * @param {string} [opties.themeName]        Thema-naam (standaard: het vaste Subsidie Kompas-thema)
 * @returns {Promise<Blob>}
 */
export async function generateWordDocument({ title, organizationName, documentType, content, themeName } = {}) {
  const theme = getDocumentTheme(themeName);
  const logoImage = await laadLogoAfbeelding(theme);

  const coverElementen = createCover(theme, {
    title: title || theme.branding.organizationName,
    // Expliciet `null` (niet weglaten/`undefined`): createCover valt anders
    // terug op theme.branding.organizationName ("Subsidie Kompas") als
    // schijnbare organisatienaam van het lid, wat een verzonnen gegeven zou
    // zijn als het lid geen organisatieprofiel heeft ingevuld.
    organizationName: organizationName || null,
    logoImage,
  });

  const inhoudElementen = (content?.blocks || []).flatMap((blok) => blokNaarElementen(blok, theme));

  const document = new Document({
    sections: [
      {
        properties: { page: getPageSetup(theme) },
        footers: { default: createFooter(theme, { documentType }) },
        children: [...coverElementen, ...inhoudElementen],
      },
    ],
  });

  return Packer.toBlob(document);
}
