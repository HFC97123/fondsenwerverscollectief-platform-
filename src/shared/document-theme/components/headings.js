// src/shared/document-theme/components/headings.js
//
// Kopfuncties (Heading 1/2/3). Elke kop krijgt zowel een semantisch
// Word-kopniveau (zodat Word's navigatiepaneel en een eventuele
// inhoudsopgave het document correct zien) als expliciete run-opmaak
// (kleur/lettertype/grootte uit het thema) - zo blijft de uitstraling
// identiek aan de huisstijl, ongeacht welke "Kop 1"-stijl de Word-installatie
// van de lezer toevallig standaard gebruikt.
//
// Nummering (bijv. "1.1 Achtergrond") is BEWUST niet als Word-native
// auto-nummering geïmplementeerd: dat vereist een numbering-configuratie op
// het niveau van het hele Document, wat hoort bij de toekomstige Document
// Generator (die het uiteindelijke `docx.Document`-object samenstelt), niet
// bij een op zichzelf staande, herbruikbare component. In plaats daarvan
// accepteert elke functie een optioneel `number`-argument dat als tekst vóór
// de kop wordt geplaatst - vandaag al een genummerde uitstraling, later
// zonder wijziging van de aanroep te vervangen door echte Word-nummering.
import { Paragraph, TextRun, HeadingLevel } from 'docx';

function hexZonderHekje(hex) {
  return String(hex || '').replace('#', '');
}

const TYPOGRAFIE_VELD_PER_NIVEAU = { 1: 'heading1Size', 2: 'heading2Size', 3: 'heading3Size' };
const KOPNIVEAU_PER_NIVEAU = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 };

function buildHeading(level, text, theme, { number } = {}) {
  const volledigeTekst = number ? `${number} ${text}` : text;

  return new Paragraph({
    heading: KOPNIVEAU_PER_NIVEAU[level],
    spacing: { before: theme.layout.sectionSpacingBefore, after: theme.layout.paragraphSpacingAfter },
    children: [
      new TextRun({
        text: volledigeTekst,
        bold: true,
        font: theme.fonts.heading,
        size: theme.typography[TYPOGRAFIE_VELD_PER_NIVEAU[level]],
        color: hexZonderHekje(theme.colors.primary),
      }),
    ],
  });
}

/**
 * @param {string} text
 * @param {import('../documentTheme.js').DocumentTheme} theme
 * @param {{ number?: string }} [options]
 * @returns {Paragraph}
 */
export function createHeading1(text, theme, options) {
  return buildHeading(1, text, theme, options);
}

/** @see createHeading1 */
export function createHeading2(text, theme, options) {
  return buildHeading(2, text, theme, options);
}

/** @see createHeading1 */
export function createHeading3(text, theme, options) {
  return buildHeading(3, text, theme, options);
}
