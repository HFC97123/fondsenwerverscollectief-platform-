// Tekst uit geüploade documenten halen, client-side. Voor platte tekst
// (.txt/.md/.csv) bestond dit al (zie ProjectenPage.jsx); hier komt daar
// ondersteuning voor .docx (mammoth) en .pdf (pdfjs-dist) bij, nodig voor
// organisatiedocumenten zoals beleidsplannen en jaarverslagen (meestal PDF).
//
// Alles gebeurt in de browser: het bestand verlaat de browser pas ná deze
// stap, als tekst, richting Supabase Storage/de Edge Function. mammoth en
// pdfjs-dist worden dynamisch geïmporteerd zodat ze niet in elke pagina's
// bundel terechtkomen, alleen waar een document wordt geüpload.
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

const MAX_TEKENS = 20000;

let pdfjsLibPromise = null;

async function pdfjsLib() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import('pdfjs-dist').then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = pdfjsWorker;

      return mod;
    });
  }

  return pdfjsLibPromise;
}

function leesAlsTekst(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => resolve('');
    reader.readAsText(file);
  });
}

async function leesDocx(file) {
  try {
    const mammoth = await import('mammoth');
    const buffer = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer: buffer });

    return value || '';
  } catch (e) {
    return '';
  }
}

async function leesPdf(file) {
  try {
    const lib = await pdfjsLib();
    const buffer = await file.arrayBuffer();
    const doc = await lib.getDocument({ data: buffer }).promise;

    let tekst = '';

    for (let i = 1; i <= doc.numPages && tekst.length < MAX_TEKENS; i += 1) {
      const pagina = await doc.getPage(i);
      const inhoud = await pagina.getTextContent();

      tekst += `${inhoud.items.map((item) => item.str || '').join(' ')}\n\n`;
    }

    return tekst;
  } catch (e) {
    return '';
  }
}

const ALS_TEKST = /^text\/|\.(txt|md|csv)$/i;
const ALS_DOCX = /\.docx$/i;
const ALS_PDF = /application\/pdf|\.pdf$/i;

// Geeft altijd een string terug (nooit een uitzondering); leeg als het
// bestandstype niet ondersteund wordt (bijv. afbeeldingen) of het uitlezen
// mislukt - de upload zelf gaat in dat geval gewoon door, alleen zonder
// tekst om te laten analyseren.
export async function extraheerTekst(file) {
  const kenmerk = `${file.type || ''} ${file.name || ''}`;
  let tekst = '';

  if (ALS_DOCX.test(file.name || '')) {
    tekst = await leesDocx(file);
  } else if (ALS_PDF.test(kenmerk)) {
    tekst = await leesPdf(file);
  } else if (ALS_TEKST.test(kenmerk)) {
    tekst = await leesAlsTekst(file);
  }

  return tekst.slice(0, MAX_TEKENS);
}
