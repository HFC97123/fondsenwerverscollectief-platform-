// src/shared/document-theme/components/section.js
//
// Let op de naamgeving: dit is een INHOUDELIJKE sectie (een kop met
// bijbehorende inhoud, met consistente tussenruimte) - iets anders dan een
// docx.js "Section" (een layout-eenheid op het niveau van
// `Document({ sections: [...] })`, met een eigen paginaformaat/marges/
// kop- en voettekst, zie pageSetup.js). Verwar de twee niet: createSection()
// hieronder levert gewone Paragraph/Table-elementen die *binnen* één
// docx.js-sectie thuishoren.
import { createHeading1, createHeading2, createHeading3 } from './headings.js';

const KOP_PER_NIVEAU = { 1: createHeading1, 2: createHeading2, 3: createHeading3 };

/**
 * @param {Object} config
 * @param {string} config.heading
 * @param {1|2|3} [config.level]     Standaard 2 (courante sectiekop binnen een document dat al een titelblad heeft)
 * @param {string} [config.number]   Optioneel kopnummer, zie headings.js
 * @param {(import('docx').Paragraph|import('docx').Table)[]} [config.children]
 * @param {import('../documentTheme.js').DocumentTheme} theme
 * @returns {(import('docx').Paragraph|import('docx').Table)[]}
 */
export function createSection({ heading, level = 2, number, children = [] }, theme) {
  const maakKop = KOP_PER_NIVEAU[level] || createHeading2;

  return [maakKop(heading, theme, { number }), ...children];
}
