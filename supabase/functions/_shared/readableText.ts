// HTML -> leesbare tekst voor de bronverificatie (Fase B1). Zuiver, lineair, zonder dependency en zonder DOM-parser.
//
// Doel: alleen tekst die een bezoeker daadwerkelijk te zien krijgt, mag als bewijs gelden.
//   * Verwijderd, inclusief inhoud: script, style, noscript, template, svg, iframe, object, embed, canvas, head-metadata,
//     HTML-commentaar, CDATA, doctype en processing instructions.
//   * Verborgen markup (attribuut hidden, aria-hidden="true", style met display:none of visibility:hidden, input type=hidden):
//     het hele element met inhoud valt weg. Verborgen tekst is geen bewijs.
//   * HTML-entiteiten worden precies één keer gedecodeerd (geen dubbele decodering).
//   * Onzichtbare tekens (zero-width, soft hyphen, BOM, bidi-besturing) vallen weg; NBSP en andere spaties worden gewone spaties.
//
// De omzetter voert GEEN JavaScript uit: tekst die pas via scripts in de pagina komt, bestaat voor ons niet.
//
// Prestatie: één pass over de invoer; zoekacties via indexOf; geen geneste kwantoren. De invoer wordt vooraf afgekapt op MAX_INVOER_TEKENS
// (de aanroeper heeft de body al op bytes begrensd).

export const MAX_INVOER_TEKENS = 2_000_000;
export const MAX_UITVOER_TEKENS = 600_000;

const SKIP_MET_INHOUD = new Set(['script', 'style', 'noscript', 'template', 'svg', 'iframe', 'object', 'embed', 'canvas', 'math', 'applet']);
// Elementen waarvan de inhoud letterlijke tekst is (geen geneste tags): zoek gewoon naar de sluittag.
const RAW_TEXT = new Set(['script', 'style']);
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const BLOK = new Set([
  'address', 'article', 'aside', 'blockquote', 'body', 'br', 'caption', 'dd', 'details', 'div', 'dl', 'dt', 'fieldset', 'figcaption',
  'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section',
  'summary', 'table', 'tbody', 'tfoot', 'thead', 'title', 'tr', 'ul', 'option',
]);
const CEL = new Set(['td', 'th']);

const ENTITEITEN: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ensp: ' ', emsp: ' ', thinsp: ' ', copy: '©', reg: '®', trade: '™',
  euro: '€', pound: '£', yen: '¥', cent: '¢', sect: '§', deg: '°', plusmn: '±', times: '×', divide: '÷', middot: '·', bull: '•',
  hellip: '…', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', sbquo: '‚', ldquo: '“', rdquo: '”', bdquo: '„', laquo: '«', raquo: '»',
  shy: '', zwnj: '', zwj: '', lrm: '', rlm: '',
  agrave: 'à', aacute: 'á', acirc: 'â', atilde: 'ã', auml: 'ä', aring: 'å', aelig: 'æ', ccedil: 'ç', egrave: 'è', eacute: 'é',
  ecirc: 'ê', euml: 'ë', igrave: 'ì', iacute: 'í', icirc: 'î', iuml: 'ï', ntilde: 'ñ', ograve: 'ò', oacute: 'ó', ocirc: 'ô',
  otilde: 'õ', ouml: 'ö', oslash: 'ø', ugrave: 'ù', uacute: 'ú', ucirc: 'û', uuml: 'ü', yacute: 'ý', szlig: 'ß',
  Agrave: 'À', Aacute: 'Á', Acirc: 'Â', Auml: 'Ä', Ccedil: 'Ç', Egrave: 'È', Eacute: 'É', Ecirc: 'Ê', Euml: 'Ë', Iacute: 'Í',
  Ouml: 'Ö', Oacute: 'Ó', Uuml: 'Ü', Uacute: 'Ú', Ntilde: 'Ñ',
};

// Tekens die nooit tekst opleveren (onzichtbaar) of als spatie gelden.
const ONZICHTBAAR = /[\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180E\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFE00-\uFE0F\uFEFF\uFFA0]/g;
const SPATIES = /[\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\t\r\f\v]+/g;

// Decodeert HTML-entiteiten precies één keer. Onbekende of ongeldige entiteiten blijven letterlijk staan.
export function decodeEntiteiten(s: string): string {
  if (s.indexOf('&') === -1) return s;

  return s.replace(/&(#[xX][0-9a-fA-F]{1,6}|#[0-9]{1,7}|[A-Za-z][A-Za-z0-9]{1,31});/g, (m, naam: string) => {
    if (naam[0] === '#') {
      const code = naam[1] === 'x' || naam[1] === 'X' ? parseInt(naam.slice(2), 16) : parseInt(naam.slice(1), 10);

      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return m;
      if (code < 32 && code !== 9 && code !== 10 && code !== 13) return ' ';

      return String.fromCodePoint(code);
    }

    const v = ENTITEITEN[naam];

    return v === undefined ? m : v;
  });
}

// Spaties normaliseren, onzichtbare tekens verwijderen, NFC. Regelstructuur blijft (\n), lege regels verdwijnen.
export function normaliseerSpaties(s: string): string {
  const regels = s
    .replace(ONZICHTBAAR, '')
    .replace(SPATIES, ' ')
    .split('\n')
    .map((r) => r.replace(/ {2,}/g, ' ').trim())
    .filter((r) => r !== '');

  return regels.join('\n').normalize('NFC');
}

interface Tag {
  naam: string;
  sluit: boolean;
  zelfsluitend: boolean;
  verborgen: boolean;
  einde: number; // index NA de '>'
}

const MAX_ATTR_SCAN = 4000;

// Leest een tag vanaf `i` (wijst naar '<'). Quote-bewust, zodat '>' in een attribuutwaarde de tag niet beëindigt.
// Werkbudget per document: totaal aantal tekens dat tag-scans mogen lezen. Voorkomt kwadratisch gedrag bij kwaadaardige invoer als
// "<a <a <a ...". Is het budget op, dan stopt de omzetting en valt de rest weg (fail-closed: geen bewijs uit niet-gelezen tekst).
interface Budget {
  werk: number;
  max: number;
}

function leesTag(s: string, i: number, budget: Budget): Tag | null {
  const n = s.length;
  let p = i + 1;
  let sluit = false;

  if (s[p] === '/') {
    sluit = true;
    p++;
  }

  const start = p;

  while (p < n && /[A-Za-z0-9:-]/.test(s[p])) p++;

  if (p === start) return null; // geen tag (bijv. "a < b")

  const naam = s.slice(start, p).toLowerCase();
  let quote = '';
  let attrStart = p;
  let verborgen = false;
  const limiet = Math.min(n, p + MAX_ATTR_SCAN * 4);

  while (p < limiet) {
    const c = s[p];

    if (quote) {
      if (c === quote) quote = '';
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '>') {
      break;
    }

    p++;
  }

  budget.werk += p - i;

  if (p >= limiet || s[p] !== '>') {
    // Onafgesloten of absurd lange tag: behandel de rest als tekst door één teken door te schuiven (aanroeper doet i+1).
    return null;
  }

  if (!sluit) {
    const attrs = s.slice(attrStart, Math.min(p, attrStart + MAX_ATTR_SCAN)).toLowerCase();
    const compact = attrs.replace(/\s+/g, '');

    verborgen =
      /(^|\s)hidden(\s|=|\/|$)/.test(attrs) ||
      compact.includes('aria-hidden="true"') || compact.includes("aria-hidden='true'") || compact.includes('aria-hidden=true') ||
      /style=["']?[^"'>]*(display:none|visibility:hidden)/.test(compact) ||
      (naam === 'input' && /type=["']?hidden/.test(compact));
  }

  const zelfsluitend = !sluit && (s[p - 1] === '/' || VOID.has(naam));

  return { naam, sluit, zelfsluitend, verborgen, einde: p + 1 };
}

// Zoekt het einde van een element dat wordt overgeslagen (met inhoud). Geeft de index na de sluittag, of n als die ontbreekt
// (dan valt de rest van het document weg: fail-closed).
function eindeElement(s: string, lager: string, naam: string, vanaf: number, budget: Budget): number {
  if (RAW_TEXT.has(naam)) {
    const sluit = lager.indexOf('</' + naam, vanaf);

    if (sluit === -1) return s.length;

    const gt = s.indexOf('>', sluit);

    return gt === -1 ? s.length : gt + 1;
  }

  // Genest: tel gelijknamige open- en sluittags. De volgende open- en sluitpositie worden onthouden en alleen opnieuw gezocht
  // wanneer ze zijn verbruikt: lineair, ook bij tienduizenden geneste elementen.
  let diepte = 1;
  let p = vanaf;
  const open = '<' + naam;
  const dicht = '</' + naam;
  let o = lager.indexOf(open, p);
  let c = lager.indexOf(dicht, p);

  while (diepte > 0) {
    if (c === -1) return s.length;

    if (o !== -1 && o < c) {
      if (/[\s>/]/.test(lager[o + open.length] ?? '>')) {
        const t = leesTag(s, o, budget);

        if (t && !t.zelfsluitend) diepte++;

        p = t ? t.einde : o + 1;
      } else {
        p = o + 1;
      }

      o = lager.indexOf(open, p);
      if (c < p) c = lager.indexOf(dicht, p);
    } else {
      const gt = s.indexOf('>', c);

      diepte--;
      p = gt === -1 ? s.length : gt + 1;
      c = lager.indexOf(dicht, p);
      if (o !== -1 && o < p) o = lager.indexOf(open, p);
    }
  }

  return p;
}

export interface LeesbareTekst {
  text: string;
  truncated: boolean;
  verborgenElementen: number;
}

export function extractReadableText(invoer: string, contentType = 'text/html'): LeesbareTekst {
  let s = typeof invoer === 'string' ? invoer : '';
  let truncated = false;

  if (s.length > MAX_INVOER_TEKENS) {
    s = s.slice(0, MAX_INVOER_TEKENS);
    truncated = true;
  }

  const media = String(contentType).split(';')[0].trim().toLowerCase();

  if (media === 'text/plain') {
    const tekst = normaliseerSpaties(s);

    return { text: tekst.length > MAX_UITVOER_TEKENS ? tekst.slice(0, MAX_UITVOER_TEKENS) : tekst, truncated: truncated || tekst.length > MAX_UITVOER_TEKENS, verborgenElementen: 0 };
  }

  const lager = s.toLowerCase();
  const n = s.length;
  const budget: Budget = { werk: 0, max: 8 * n + 200_000 };
  const uit: string[] = [];
  let lengte = 0;
  let i = 0;
  let tekstStart = 0;
  let verborgenElementen = 0;

  const spoel = (tot: number) => {
    if (tot > tekstStart) {
      const stuk = decodeEntiteiten(s.slice(tekstStart, tot));

      uit.push(stuk);
      lengte += stuk.length;
    }
  };

  while (i < n && lengte < MAX_UITVOER_TEKENS * 2 && budget.werk <= budget.max) {
    const lt = s.indexOf('<', i);

    if (lt === -1) break;

    // commentaar, CDATA, doctype, processing instruction
    if (s.startsWith('<!--', lt)) {
      spoel(lt);

      const eind = s.indexOf('-->', lt + 4);

      i = eind === -1 ? n : eind + 3;
      tekstStart = i;
      uit.push(' ');
      continue;
    }

    if (s[lt + 1] === '!' || s[lt + 1] === '?') {
      spoel(lt);

      const gt = s.indexOf('>', lt + 2);

      i = gt === -1 ? n : gt + 1;
      tekstStart = i;
      continue;
    }

    const tag = leesTag(s, lt, budget);

    if (!tag) {
      i = lt + 1; // een losse '<' is gewone tekst
      continue;
    }

    spoel(lt);

    if (!tag.sluit && (SKIP_MET_INHOUD.has(tag.naam) || (tag.verborgen && !tag.zelfsluitend))) {
      if (!SKIP_MET_INHOUD.has(tag.naam)) verborgenElementen++;

      i = tag.zelfsluitend ? tag.einde : eindeElement(s, lager, tag.naam, tag.einde, budget);
      tekstStart = i;
      uit.push(' ');
      continue;
    }

    if (tag.verborgen && tag.zelfsluitend) verborgenElementen++;

    if (BLOK.has(tag.naam)) uit.push('\n');
    else if (CEL.has(tag.naam)) uit.push(' ');

    i = tag.einde;
    tekstStart = i;
  }

  if (budget.werk <= budget.max) spoel(n);
  else truncated = true;

  let tekst = normaliseerSpaties(uit.join(''));
  let afgekapt = truncated;

  if (tekst.length > MAX_UITVOER_TEKENS) {
    tekst = tekst.slice(0, MAX_UITVOER_TEKENS);
    afgekapt = true;
  }

  return { text: tekst, truncated: afgekapt, verborgenElementen };
}
