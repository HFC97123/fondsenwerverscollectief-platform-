// Zet de tekstdelen van een PDF-pagina (pdf.js getTextContent().items) om in leesbare tekst. ZUIVER: geen pdf.js, geen netwerk.
//
// Een PDF bewaart tekst vaak als losse stukjes (soms letter voor letter). Alle stukjes met een spatie aan elkaar plakken geeft "S t i c h t i n g".
// Daarom kijken we naar de POSITIE: staat een stukje direct achter het vorige (kleine tussenruimte), dan komt er geen spatie tussen; is er een
// duidelijke ruimte, dan wel; en een nieuwe regel (andere hoogte of een regeleinde) wordt een nieuwe regel.

const RUIMTE_FACTOR = 0.18; // een tussenruimte groter dan dit deel van de letterhoogte telt als spatie
const REGEL_FACTOR = 0.6; // een verschuiving in hoogte groter dan dit deel van de letterhoogte telt als nieuwe regel

export function pdfItemsNaarTekst(items) {
  const lijst = Array.isArray(items) ? items : [];
  let uit = '';
  let vorige = null;

  for (const item of lijst) {
    const s = item && typeof item.str === 'string' ? item.str : '';
    const t = item && Array.isArray(item.transform) ? item.transform : null;

    if (!t) {
      if (s) uit += uit && !/\s$/.test(uit) ? ` ${s}` : s;
      vorige = null;

      continue;
    }

    const x = Number(t[4]);
    const y = Number(t[5]);
    const hoogte = Math.abs(Number(item.height) || Number(t[3]) || 10) || 10;

    if (vorige) {
      const nieuweRegel = Math.abs(y - vorige.y) > hoogte * REGEL_FACTOR;

      if (nieuweRegel) {
        uit += '\n';
      } else {
        const einde = vorige.x + (Number(vorige.breedte) || 0);
        const gat = x - einde;

        if (gat > hoogte * RUIMTE_FACTOR && !/\s$/.test(uit) && !/^\s/.test(s)) uit += ' ';
      }
    }

    uit += s;

    if (item.hasEOL) uit += '\n';

    vorige = { x, y, breedte: item.width };
  }

  return uit.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
}
