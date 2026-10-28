// Afbeeldingen van een aanvraagformulier (screenshot, foto, ingescande pagina) klaarmaken om te laten overtypen.
// De browser verkleint ze eerst (langste zijde 1600 px, JPEG), zodat er weinig data heen gaat; de server bewaart ze niet.
// Alles is injecteerbaar (laad, maakCanvas) zodat het zonder echte browser te testen is.

export const MAX_AFBEELDINGEN = 4;
export const MAX_DATAURL_TEKENS = 850_000; // de server weigert boven 900.000
export const MAX_BRON_BYTES = 15 * 1024 * 1024;
const ALS_AFBEELDING = /^image\/(png|jpeg|webp)$/i;
const ALS_AFBEELDING_NAAM = /\.(png|jpe?g|webp)$/i;

export const isAfbeelding = (f) => Boolean(f) && (ALS_AFBEELDING.test(String(f.type || '')) || (!f.type && ALS_AFBEELDING_NAAM.test(String(f.name || ''))));

function standaardLaad(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('laden'));
    };
    img.src = url;
  });
}

const standaardCanvas = (b, h) => {
  const c = document.createElement('canvas');

  c.width = b;
  c.height = h;

  return c;
};

// Zet een afbeelding (canvas-tekenbaar, met width en height) om naar een JPEG-data-URL binnen de grens.
export function canvasNaarDataUrl(bron, breedte, hoogte, { maakCanvas = standaardCanvas, maxZijde = 1600, maxTekens = MAX_DATAURL_TEKENS } = {}) {
  let schaal = Math.min(1, maxZijde / Math.max(breedte, hoogte, 1));

  for (let ronde = 0; ronde < 6; ronde += 1) {
    const b = Math.max(1, Math.round(breedte * schaal));
    const h = Math.max(1, Math.round(hoogte * schaal));
    const canvas = maakCanvas(b, h);
    const ctx = canvas.getContext('2d');

    if (!ctx) return null;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, b, h);
    ctx.drawImage(bron, 0, 0, b, h);

    for (const kwaliteit of [0.82, 0.7, 0.55]) {
      const url = canvas.toDataURL('image/jpeg', kwaliteit);

      if (url && url.length <= maxTekens && /^data:image\/jpeg;base64,/.test(url)) return url;
    }

    schaal *= 0.75;
  }

  return null;
}

// -> { ok: true, naam, dataUrl } | { ok: false, melding }
export async function verkleinAfbeelding(file, { laad = standaardLaad, maakCanvas = standaardCanvas } = {}) {
  if (!isAfbeelding(file)) return { ok: false, melding: 'Kies een afbeelding als PNG, JPG of WebP.' };
  if (file.size > MAX_BRON_BYTES) return { ok: false, melding: 'Deze afbeelding is te groot (maximaal 15 MB).' };

  try {
    const img = await laad(file);
    const url = canvasNaarDataUrl(img, img.naturalWidth || img.width, img.naturalHeight || img.height, { maakCanvas });

    if (!url) return { ok: false, melding: 'Deze afbeelding kon niet worden verkleind. Probeer een kleinere of een uitsnede met alleen de vragen.' };

    return { ok: true, naam: String(file.name || 'afbeelding').slice(0, 80), dataUrl: url };
  } catch (e) {
    return { ok: false, melding: 'Deze afbeelding kon niet worden gelezen. Controleer of het een PNG, JPG of WebP is.' };
  }
}
