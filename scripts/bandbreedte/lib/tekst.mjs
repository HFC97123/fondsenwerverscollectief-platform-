// HTML en PDF omzetten naar platte tekst + links. Puur (de pdf-functie leest alleen de meegegeven bytes).
import { normaliseer } from './bedragen.mjs';

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', euro: '€', eacute: 'é', egrave: 'è', euml: 'ë', iuml: 'ï', ouml: 'ö', uuml: 'ü', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', pound: '£', ccedil: 'ç', aacute: 'á', oacute: 'ó' };

export function decodeEntiteiten(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeChar(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
}
const safeChar = (n) => (Number.isFinite(n) && n > 8 && n < 0x110000 ? String.fromCodePoint(n) : ' ');

export function htmlNaarTekst(html) {
  let s = String(html ?? '');
  s = s.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|noscript|svg|template|iframe)\b[\s\S]*?<\/\1>/gi, ' ');
  s = s.replace(/<\/(td|th)\s*>/gi, ' | ').replace(/<\/(tr|p|div|li|h[1-6]|section|article|br|ul|ol|table|header|footer)\s*>/gi, '\n').replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<[^>]+>/g, ' ');
  s = decodeEntiteiten(s);
  return s
    .split('\n')
    .map((r) => r.replace(/[ \t ]+/g, ' ').replace(/(\|\s*)+$/g, '').trim())
    .filter(Boolean)
    .join('\n');
}

export function titelUitHtml(html) {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(String(html ?? ''));
  return m ? decodeEntiteiten(m[1]).replace(/\s+/g, ' ').trim() : '';
}

export function linksUitHtml(html, basisUrl) {
  const uit = [];
  const gezien = new Set();
  for (const m of String(html ?? '').matchAll(/<a\b[^>]*?href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a\s*>/gi)) {
    const href = decodeEntiteiten((m[2] ?? m[3] ?? m[4] ?? '').trim());
    if (!href || /^(mailto:|tel:|javascript:|#|data:)/i.test(href)) continue;
    let u;
    try {
      u = new URL(href, basisUrl);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(u.protocol)) continue;
    u.hash = '';
    const url = u.toString();
    if (gezien.has(url)) continue;
    gezien.add(url);
    uit.push({ url, tekst: decodeEntiteiten(m[5].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim().slice(0, 160) });
  }
  return uit;
}

// PDF -> tekst met pdf.js (legacy build voor Node). Regelafbreking volgt de PDF zelf zodat een tabelrij een regel blijft.
export async function pdfNaarTekst(bytes, { maxPaginas = 150 } = {}) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, isEvalSupported: false, disableFontFace: true, verbosity: 0 }).promise;
  const n = Math.min(doc.numPages, maxPaginas);
  const paginas = [];
  for (let i = 1; i <= n; i++) {
    const p = await doc.getPage(i);
    const c = await p.getTextContent();
    let regel = '';
    const regels = [];
    for (const it of c.items) {
      if (!('str' in it)) continue;
      regel += (regel && !regel.endsWith(' ') && it.str && !it.str.startsWith(' ') ? ' ' : '') + it.str;
      if (it.hasEOL) {
        regels.push(regel.trim());
        regel = '';
      }
    }
    if (regel.trim()) regels.push(regel.trim());
    paginas.push(regels.filter(Boolean).join('\n'));
  }
  await doc.destroy();
  return { tekst: paginas.join('\n'), paginas: doc.numPages, afgekapt: doc.numPages > maxPaginas };
}

export const platgeslagen = normaliseer;
