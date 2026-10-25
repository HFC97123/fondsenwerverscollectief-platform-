// Tekst uit een begrotingsbestand (Excel .xlsx, Word .docx of PDF) halen, in de browser. Het bestand verlaat de browser niet; alleen de tekst gaat (op verzoek van het lid) naar de server.
// Rijen blijven rijen: de cellen van een rij staan achter elkaar, gescheiden door " | ". exceljs en mammoth worden pas geladen als iemand een bestand kiest.
export const MAX_BEGROTING_BYTES = 5 * 1024 * 1024;
export const MAX_BEGROTING_TEKENS = 60000; // gelijk aan de grens van de server

const celTekst = (w) => {
  if (w === null || w === undefined) return '';

  if (w instanceof Date) return Number.isNaN(w.getTime()) ? '' : `${String(w.getDate()).padStart(2, '0')}-${String(w.getMonth() + 1).padStart(2, '0')}-${w.getFullYear()}`;

  if (typeof w === 'object') {
    if (w.result !== undefined && w.result !== null) return celTekst(w.result); // formule: de uitkomst
    if (w.text !== undefined && w.text !== null) return String(w.text); // koppeling
    if (Array.isArray(w.richText)) return w.richText.map((x) => x.text).join('');
    if (w.error) return '';

    return '';
  }

  return String(w).trim();
};

async function leesExcel(bestand) {
  const mod = await import('exceljs');
  const ExcelJS = mod.default || mod;
  const wb = new ExcelJS.Workbook();

  await wb.xlsx.load(await bestand.arrayBuffer());

  const delen = [];

  wb.eachSheet((blad) => {
    if (blad.state && blad.state !== 'visible') return; // verborgen bladen horen niet bij wat het lid ziet

    const rijen = [];

    blad.eachRow((rij) => {
      const cellen = [];

      rij.eachCell({ includeEmpty: false }, (cel) => {
        const t = celTekst(cel.value);

        if (t !== '') cellen.push(t);
      });

      if (cellen.length) rijen.push(cellen.join(' | '));
    });

    if (rijen.length) delen.push(`${blad.name}\n${rijen.join('\n')}`);
  });

  return delen.join('\n\n');
}

async function leesWord(bestand) {
  const mod = await import('mammoth');
  const mammoth = typeof mod.convertToHtml === 'function' ? mod : mod.default;
  const buffer = await bestand.arrayBuffer();
  // In de browser leest mammoth een arrayBuffer; de versie voor Node (tests) wil een buffer.
  const converteer = async (methode) => {
    try {
      return await mammoth[methode]({ arrayBuffer: buffer });
    } catch (e) {
      if (typeof Buffer === 'undefined') throw e;

      return mammoth[methode]({ buffer: Buffer.from(buffer) });
    }
  };

  // Tabellen blijven rijen (een begroting staat meestal in een tabel). Zonder DOMParser vallen we terug op platte tekst.
  if (typeof DOMParser === 'function') {
    const { value } = await converteer('convertToHtml');
    const doc = new DOMParser().parseFromString(`<body>${value}</body>`, 'text/html');
    const regels = [];
    const tekst = (el) => String(el.textContent || '').replace(/\s+/g, ' ').trim();

    const loop = (knoop) => {
      for (const el of Array.from(knoop.children)) {
        const tag = el.tagName.toLowerCase();

        if (tag === 'table') {
          for (const tr of Array.from(el.querySelectorAll('tr'))) {
            const cellen = Array.from(tr.children).map(tekst).filter(Boolean);

            if (cellen.length) regels.push(cellen.join(' | '));
          }
        } else if (tag === 'ul' || tag === 'ol') {
          for (const li of Array.from(el.children)) {
            const t = tekst(li);

            if (t) regels.push(t);
          }
        } else {
          const t = tekst(el);

          if (t) regels.push(t);
        }
      }
    };

    loop(doc.body);

    return regels.join('\n');
  }

  const { value } = await converteer('extractRawText');

  return String(value || '');
}

// PDF: de tekst per pagina, in leesvolgorde (pdf.js). Een PDF die alleen uit een afbeelding bestaat (scan) geeft geen tekst.
async function leesPdf(bestand) {
  const { leesPdfTekst } = await import('../../../data/services/documentExtractie.js');

  return leesPdfTekst(bestand, MAX_BEGROTING_TEKENS + 1);
}

export async function leesBegrotingBestand(bestand) {
  if (!bestand || typeof bestand.arrayBuffer !== 'function') return { ok: false, melding: 'Dit bestand kon niet worden gelezen.' };

  const naam = String(bestand.name || '');

  if (/\.xls$/i.test(naam) || /\.doc$/i.test(naam)) return { ok: false, melding: 'Dit is een ouder bestandstype. Sla het op als .xlsx (Excel) of .docx (Word) en probeer het opnieuw.' };
  if (!/\.(xlsx|docx|pdf)$/i.test(naam)) return { ok: false, melding: 'Kies een Excel-bestand (.xlsx), een Word-bestand (.docx) of een PDF-bestand.' };
  if (bestand.size > MAX_BEGROTING_BYTES) return { ok: false, melding: 'Dit bestand is te groot (maximaal 5 MB). Bewaar alleen het blad of het deel met de begroting in een nieuw bestand.' };

  try {
    const tekst = (/\.xlsx$/i.test(naam) ? await leesExcel(bestand) : /\.pdf$/i.test(naam) ? await leesPdf(bestand) : await leesWord(bestand)).replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();

    if (tekst.length < 40) return { ok: false, melding: 'In dit bestand staat geen tekst die we kunnen lezen. Staat de begroting in een afbeelding of is de PDF een scan? Upload dan een bestand met de begroting als tekst.' };
    if (tekst.length > MAX_BEGROTING_TEKENS) return { ok: false, melding: 'Dit bestand is te groot om in één keer te lezen. Bewaar alleen het blad of het deel met de begroting in een nieuw bestand.' };

    return { ok: true, tekst };
  } catch (e) {
    return { ok: false, melding: 'Dit bestand kon niet worden gelezen. Controleer of het een Excel- (.xlsx), Word- (.docx) of PDF-bestand is.' };
  }
}
