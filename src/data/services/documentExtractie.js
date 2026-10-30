// Tekst uit geüploade documenten halen, client-side. Voor platte tekst
// (.txt/.md/.csv) bestond dit al (zie ProjectenPage.jsx); hier komt daar
// ondersteuning voor .docx (mammoth) en .pdf (pdfjs-dist) bij, nodig voor
// organisatiedocumenten zoals beleidsplannen en jaarverslagen (meestal PDF).
//
// Alles gebeurt in de browser: het bestand verlaat de browser pas ná deze
// stap, als tekst, richting Supabase Storage/de Edge Function. mammoth en
// pdfjs-dist worden dynamisch geïmporteerd zodat ze niet in elke pagina's
// bundel terechtkomen, alleen waar een document wordt geüpload.
import { pdfItemsNaarTekst } from './pdfTekst.js';
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
    const mod = await import('mammoth');
    // CommonJS-pakket: afhankelijk van de bundler zit de API op de namespace of op default.
    const mammoth = typeof mod.extractRawText === 'function' ? mod : mod.default;
    const buffer = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer: buffer });

    return value || '';
  } catch (e) {
    return '';
  }
}

async function leesPdf(file, max = MAX_TEKENS) {
  try {
    const lib = await pdfjsLib();
    const buffer = await file.arrayBuffer();
    const doc = await lib.getDocument({ data: buffer }).promise;

    let tekst = '';

    for (let i = 1; i <= doc.numPages && tekst.length < max; i += 1) {
      const pagina = await doc.getPage(i);
      const inhoud = await pagina.getTextContent();

      tekst += `${pdfItemsNaarTekst(inhoud.items)}\n\n`;
    }

    return tekst;
  } catch (e) {
    return '';
  }
}

// Voor wie meer tekst uit een PDF nodig heeft dan de standaardgrens (bijvoorbeeld een begroting).
export const leesPdfTekst = (file, max = MAX_TEKENS) => leesPdf(file, max);

// Een PDF zonder selecteerbare tekst (een scan): de eerste pagina's als afbeeldingen (JPEG-data-URL's), om te laten overtypen. -> { ok, paginas } met de dataUrl's.
export async function leesPdfAlsAfbeeldingen(file, { max = 4, canvasNaarDataUrl, maakCanvas } = {}) {
  try {
    const lib = await pdfjsLib();
    const doc = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
    const uit = [];

    for (let i = 1; i <= Math.min(doc.numPages, max); i += 1) {
      const pagina = await doc.getPage(i);
      const vp = pagina.getViewport({ scale: 1.6 });
      const canvas = maakCanvas ? maakCanvas(Math.ceil(vp.width), Math.ceil(vp.height)) : Object.assign(document.createElement('canvas'), { width: Math.ceil(vp.width), height: Math.ceil(vp.height) });

      await pagina.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;

      const url = canvasNaarDataUrl(canvas, canvas.width, canvas.height, maakCanvas ? { maakCanvas } : {});

      if (url) uit.push(url);
    }

    return { ok: uit.length > 0, paginas: uit, totaal: doc.numPages };
  } catch (e) {
    return { ok: false, paginas: [], totaal: 0 };
  }
}

// De eerste pagina van een PDF op een bestaand canvas (voor het uitlezen van logo en kleuren).
export async function leesPdfPagina(file, canvas, schaal = 1.4) {
  const lib = await pdfjsLib();
  const doc = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
  const pagina = await doc.getPage(1);
  const vp = pagina.getViewport({ scale: schaal });

  canvas.width = Math.ceil(vp.width);
  canvas.height = Math.ceil(vp.height);

  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await pagina.render({ canvasContext: ctx, viewport: vp }).promise;
}

// Excel (.xlsx): per werkblad de rijen als tekst, cellen gescheiden door " | ". Formules worden als hun uitkomst gelezen.
async function leesXlsx(file) {
  try {
    const mod = await import('exceljs');
    const ExcelJS = mod.default || mod;
    const wb = new ExcelJS.Workbook();

    await wb.xlsx.load(await file.arrayBuffer());

    let tekst = '';

    wb.eachSheet((blad) => {
      tekst += `${blad.name}\n`;
      blad.eachRow((rij) => {
        const cellen = [];

        rij.eachCell({ includeEmpty: false }, (cel) => {
          const w = cel.value;
          const v = w && typeof w === 'object' ? (w.result != null ? w.result : w.text != null ? w.text : w.richText ? w.richText.map((x) => x.text).join('') : '') : w;

          if (v !== '' && v != null) {
            cellen.push(String(v));
          }
        });

        if (cellen.length) {
          tekst += `${cellen.join(' | ')}\n`;
        }
      });
      tekst += '\n';
    });

    return tekst;
  } catch (e) {
    return '';
  }
}

const ALS_XLSX = /\.xlsx$/i;
const ALS_TEKST = /^text\/|\.(txt|md|csv)$/i;
const ALS_DOCX = /\.docx$/i;
const ALS_PDF = /application\/pdf|\.pdf$/i;

// Geeft altijd een string terug (nooit een uitzondering); leeg als het
// bestandstype niet ondersteund wordt (bijv. afbeeldingen) of het uitlezen
// mislukt - de upload zelf gaat in dat geval gewoon door, alleen zonder
// tekst om te laten analyseren.
export async function extraheerTekst(file, max = MAX_TEKENS) {
  const kenmerk = `${file.type || ''} ${file.name || ''}`;
  let tekst = '';

  if (ALS_DOCX.test(file.name || '')) {
    tekst = await leesDocx(file);
  } else if (ALS_XLSX.test(file.name || '')) {
    tekst = await leesXlsx(file);
  } else if (ALS_PDF.test(kenmerk)) {
    tekst = await leesPdf(file, max);
  } else if (ALS_TEKST.test(kenmerk)) {
    tekst = await leesAlsTekst(file);
  }

  return tekst.slice(0, max);
}
