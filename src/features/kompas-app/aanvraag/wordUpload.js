// Tekst uit een Word-bestand (.docx) halen, in de browser. Het bestand verlaat de browser niet; alleen de tekst gaat (op verzoek van het lid) mee.
// mammoth wordt pas geladen als iemand een bestand kiest.
export const MAX_WORD_BYTES = 5 * 1024 * 1024;

export async function leesWordBestand(bestand) {
  if (!bestand || typeof bestand.arrayBuffer !== 'function') return { ok: false, melding: 'Dit bestand kon niet worden gelezen.' };

  if (!/\.docx$/i.test(String(bestand.name || ''))) return { ok: false, melding: 'Kies een Word-bestand (.docx). Een ouder .doc-bestand kunt u opslaan als .docx.' };
  if (bestand.size > MAX_WORD_BYTES) return { ok: false, melding: 'Dit bestand is te groot (maximaal 5 MB). Kopieer alleen de vragen of de aanvraagtekst naar een nieuw bestand.' };

  try {
    const mod = await import('mammoth');
    const mammoth = typeof mod.extractRawText === 'function' ? mod : mod.default;
    const { value } = await mammoth.extractRawText({ arrayBuffer: await bestand.arrayBuffer() });
    const tekst = String(value || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();

    if (!tekst) return { ok: false, melding: 'In dit bestand staat geen tekst die we kunnen lezen. Staat de tekst in een afbeelding? Plak hem dan in het tekstvak.' };

    return { ok: true, tekst };
  } catch (e) {
    return { ok: false, melding: 'Dit bestand kon niet worden gelezen. Controleer of het een Word-bestand (.docx) is, of plak de tekst.' };
  }
}
