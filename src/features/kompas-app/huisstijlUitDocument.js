// Huisstijl uit een document halen: een Word-, Excel-, PowerPoint-, PDF- of afbeeldingsbestand dat het lid normaal gebruikt.
// Er wordt een voorstel gedaan (logo en kleuren); het lid controleert het en bewaart het zelf. Alles gebeurt in de browser, zonder AI en zonder iets te uploaden.
import { verkleinLogo } from '../../data/services/huisstijl.js';

const HEX = /^[0-9A-F]{6}$/;

// ── Kleuren ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

function hsl(hex) {
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  const d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;

  if (d !== 0) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }

  return { h: ((h * 60) + 360) % 360, s, l };
}

// Een bruikbare merkkleur: geen wit, zwart of grijs, en niet te licht of te donker om tekst of lijnen mee te zetten.
export function isMerkkleur(hex) {
  if (!HEX.test(hex)) return false;

  const { s, l } = hsl(hex);

  return s >= 0.25 && l >= 0.12 && l <= 0.8;
}

// Kleuren die dicht bij elkaar liggen tellen als één.
function verschil(a, b) {
  return [0, 2, 4].reduce((som, i) => som + Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)), 0);
}

function kiesTop(tellingen, max = 4) {
  const lijst = Object.entries(tellingen).filter(([hex]) => isMerkkleur(hex)).sort((a, b) => b[1] - a[1]);
  const uit = [];

  for (const [hex] of lijst) {
    if (uit.every((x) => verschil(x, hex) > 90)) uit.push(hex);

    if (uit.length >= max) break;
  }

  return uit.map((h) => `#${h}`);
}

function tel(tellingen, xml, regex, gewicht = 1) {
  for (const m of xml.matchAll(regex)) {
    const hex = (m[1] || '').toUpperCase().slice(-6);

    if (HEX.test(hex)) tellingen[hex] = (tellingen[hex] || 0) + gewicht;
  }
}

// Kleuren uit de XML van een Office-bestand. Kleuren die echt in het document gebruikt zijn (tekst, vlakken, cellen) wegen zwaarder dan de kleuren van het thema.
export function kleurenUitOffice({ documentXml = [], themaXml = '' }) {
  const t = {};

  for (const xml of documentXml) {
    tel(t, xml, /<w:color [^>]*w:val="([0-9A-Fa-f]{6})"/g, 3);
    tel(t, xml, /w:fill="([0-9A-Fa-f]{6})"/g, 3);
    tel(t, xml, /<a:srgbClr val="([0-9A-Fa-f]{6})"/g, 2);
    tel(t, xml, /(?:rgb|fgColor rgb)="([0-9A-Fa-f]{6,8})"/g, 3);
  }

  for (const naam of ['accent1', 'accent2', 'dk2', 'accent3']) {
    const m = new RegExp(`<a:${naam}>\\s*<a:srgbClr val="([0-9A-Fa-f]{6})"`).exec(themaXml);

    if (m) t[m[1].toUpperCase()] = (t[m[1].toUpperCase()] || 0) + 1;
  }

  return kiesTop(t);
}

// Kleuren uit de pixels van een pagina of afbeelding (RGBA, zoals canvas getImageData): de meest voorkomende merkkleuren, met hun echte (gemiddelde) kleur.
export function kleurenUitPixels(data, breedte, hoogte, stap = 2) {
  const t = {};
  const som = {};
  const hex2 = (v) => Math.round(v).toString(16).padStart(2, '0').toUpperCase();

  for (let y = 0; y < hoogte; y += stap) {
    for (let x = 0; x < breedte; x += stap) {
      const i = (y * breedte + x) * 4;

      if (data[i + 3] < 200) continue;

      // Op 16 niveaus per kleur groeperen, zodat randen en schaduwen bij dezelfde kleur tellen.
      const q = (v) => (Math.round(v / 17) * 17).toString(16).padStart(2, '0').toUpperCase();
      const sleutel = `${q(data[i])}${q(data[i + 1])}${q(data[i + 2])}`;

      t[sleutel] = (t[sleutel] || 0) + 1;

      const s = som[sleutel] || (som[sleutel] = [0, 0, 0]);

      s[0] += data[i];
      s[1] += data[i + 1];
      s[2] += data[i + 2];
    }
  }

  const echt = {};

  for (const [sleutel, n] of Object.entries(t)) {
    const s = som[sleutel];

    echt[`${hex2(s[0] / n)}${hex2(s[1] / n)}${hex2(s[2] / n)}`] = n;
  }

  const top = kiesTop(echt, 6);
  const meest = top.length ? echt[top[0].slice(1)] : 0;

  // Kleuren die bijna niet voorkomen zijn randen van letters en logo's, geen huisstijlkleuren.
  return top.filter((k) => echt[k.slice(1)] >= meest * 0.12).slice(0, 4);
}

// Het logo staat meestal bovenaan: het omhullende vak van alles wat niet wit is in de bovenste 22% van de pagina.
export function logoVakUitPixels(data, breedte, hoogte) {
  const rand = Math.floor(hoogte * 0.22);
  let x0 = breedte;
  let x1 = -1;
  let y0 = rand;
  let y1 = -1;

  for (let y = 0; y < rand; y += 1) {
    for (let x = 0; x < breedte; x += 1) {
      const i = (y * breedte + x) * 4;
      const leeg = data[i + 3] < 40 || (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240);

      if (!leeg) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }

  if (x1 < 0) return null;

  const b = x1 - x0 + 1;
  const h = y1 - y0 + 1;

  // Te klein is ruis; te breed is geen logo maar een kop of een lijn.
  if (b < 24 || h < 16 || b > breedte * 0.5) return null;

  return { x: Math.max(0, x0 - 4), y: Math.max(0, y0 - 4), b: Math.min(breedte, b + 8), h: Math.min(hoogte, h + 8) };
}

// ── Bestanden ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const soortVan = (f) => {
  const naam = (f.name || '').toLowerCase();
  const type = f.type || '';

  if (/\.(docx|dotx|docm)$/.test(naam)) return 'word';
  if (/\.(xlsx|xlsm|xltx)$/.test(naam)) return 'excel';
  if (/\.pptx$/.test(naam)) return 'powerpoint';
  if (type === 'application/pdf' || /\.pdf$/.test(naam)) return 'pdf';
  if (/^image\/(png|jpeg)$/.test(type)) return 'afbeelding';

  return null;
};

export const HUISSTIJL_BESTAND_ACCEPT = '.docx,.dotx,.xlsx,.pptx,.pdf,image/png,image/jpeg';

const tekstVan = async (zip, pad) => {
  const f = zip.file(pad);

  return f ? f.async('string') : '';
};

// Het logo uit een Office-bestand: een afbeelding uit een koptekst gaat voor, anders de grootste PNG of JPG die er in zit.
async function logoUitOffice(zip, map) {
  const media = Object.keys(zip.files).filter((n) => n.startsWith(`${map}/media/`) && /\.(png|jpe?g)$/i.test(n));

  if (!media.length) return null;

  const kop = [];

  for (const n of Object.keys(zip.files).filter((x) => /^word\/_rels\/header\d*\.xml\.rels$/.test(x))) {
    const xml = await tekstVan(zip, n);

    for (const m of xml.matchAll(/Target="(?:\.\.\/)?(media\/[^"]+)"/g)) kop.push(`word/${m[1]}`);
  }

  const kandidaten = [...kop.filter((n) => media.includes(n)), ...media];
  const grootte = async (n) => (await zip.file(n).async('uint8array')).length;

  let gekozen = kandidaten[0];

  if (!kop.length) {
    let beste = 0;

    for (const n of media) {
      const g = await grootte(n);

      if (g > beste && g > 1500) {
        beste = g;
        gekozen = n;
      }
    }

    if (!beste) return null;
  }

  const bytes = await zip.file(gekozen).async('uint8array');
  const type = /\.png$/i.test(gekozen) ? 'image/png' : 'image/jpeg';

  return new File([bytes], gekozen.split('/').pop(), { type });
}

// Browser: de eerste pagina van een PDF of een afbeelding op een canvas.
export async function tekenEerstePagina(bestand, soort) {
  const canvas = document.createElement('canvas');

  if (soort === 'afbeelding') {
    const url = URL.createObjectURL(bestand);
    const img = await new Promise((ok, fout) => {
      const i = new Image();

      i.onload = () => ok(i);
      i.onerror = () => fout(new Error('afbeelding'));
      i.src = url;
    });

    const f = Math.min(1, 1200 / Math.max(img.width, img.height));

    canvas.width = Math.round(img.width * f);
    canvas.height = Math.round(img.height * f);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
  } else {
    const { leesPdfPagina } = await import('../../data/services/documentExtractie.js');

    await leesPdfPagina(bestand, canvas);
  }

  const ctx = canvas.getContext('2d');

  return { canvas, data: ctx.getImageData(0, 0, canvas.width, canvas.height).data, breedte: canvas.width, hoogte: canvas.height };
}

function knipLogo(canvas, vak) {
  const uit = document.createElement('canvas');

  uit.width = vak.b;
  uit.height = vak.h;
  uit.getContext('2d').drawImage(canvas, vak.x, vak.y, vak.b, vak.h, 0, 0, vak.b, vak.h);

  return new Promise((ok) => uit.toBlob((blob) => ok(blob ? new File([blob], 'logo.png', { type: 'image/png' }) : null), 'image/png'));
}

/**
 * Een voorstel voor de huisstijl uit een bestand van het lid.
 * @returns {Promise<{ bron: string, kleuren: string[], logo: ({ logo: string, logoBreedte: number, logoHoogte: number } | null) } | { fout: string }>}
 */
export async function leesHuisstijlUitBestand(bestand, deps = {}) {
  const soort = bestand ? soortVan(bestand) : null;

  if (!soort) return { fout: 'Kies een Word-, Excel-, PowerPoint-, PDF- of afbeeldingsbestand (PNG of JPG).' };
  if (bestand.size > 25 * 1024 * 1024) return { fout: 'Dit bestand is te groot (hoogstens 25 MB).' };

  const maakLogo = deps.verkleinLogo || verkleinLogo;

  try {
    let kleuren = [];
    let logoBestand = null;

    if (soort === 'word' || soort === 'excel' || soort === 'powerpoint') {
      const JSZip = deps.JSZip || (await import('jszip')).default;
      const zip = await JSZip.loadAsync(await bestand.arrayBuffer());
      const map = soort === 'word' ? 'word' : soort === 'excel' ? 'xl' : 'ppt';
      const delen = soort === 'word' ? ['word/document.xml', 'word/styles.xml'] : soort === 'excel' ? ['xl/styles.xml'] : ['ppt/slides/slide1.xml', 'ppt/slideMasters/slideMaster1.xml'];
      const documentXml = [];

      for (const d of delen) documentXml.push(await tekstVan(zip, d));

      for (const n of Object.keys(zip.files).filter((x) => /^word\/header\d*\.xml$/.test(x))) documentXml.push(await tekstVan(zip, n));

      kleuren = kleurenUitOffice({ documentXml, themaXml: await tekstVan(zip, `${map}/theme/theme1.xml`) });
      logoBestand = await logoUitOffice(zip, map);
    } else {
      const teken = deps.tekenEerstePagina || tekenEerstePagina;
      const pagina = await teken(bestand, soort);

      kleuren = kleurenUitPixels(pagina.data, pagina.breedte, pagina.hoogte);

      const vak = logoVakUitPixels(pagina.data, pagina.breedte, pagina.hoogte);

      logoBestand = vak ? await (deps.knipLogo || knipLogo)(pagina.canvas, vak) : null;
    }

    let logo = null;

    if (logoBestand) {
      const r = await maakLogo(logoBestand);

      if (!r.fout) logo = r;
    }

    if (!kleuren.length && !logo) return { fout: 'We vonden geen logo of kleuren in dit bestand. Probeer een ander bestand, bijvoorbeeld een brief of rapport met uw logo.' };

    return { bron: soort, kleuren, logo };
  } catch (e) {
    return { fout: 'Dit bestand kon niet worden gelezen. Probeer een ander bestand.' };
  }
}
