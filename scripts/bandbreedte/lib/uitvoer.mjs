// Reviewsheet (xlsx, huisstijl Subsidie Kompas) en SQL uit de goedgekeurde sheet. De tool zelf schrijft NIET naar de database.
import ExcelJS from 'exceljs';
import { promises as fs } from 'node:fs';
import { BANDEN, kiesBand } from './rekenen.mjs';

export const KLEUR = { groenPastel: 'FFA8D5BA', groenAccent: 'FF4E9A6C', blauwPastel: 'FFA9C9DE', blauwDonker: 'FF2C4A5E', achtergrond: 'FFF7F9F8', tekst: 'FF2E3A38', geel: 'FFFFF2B3' };
const HEADER_RIJ = 8;

export const KOLOMMEN = [
  { key: 'nr', kop: 'Nr', breedte: 5 },
  { key: 'type', kop: 'Soort', breedte: 10 },
  { key: 'naam', kop: 'Naam', breedte: 34 },
  { key: 'tier', kop: 'Tier', breedte: 9 },
  { key: 'zekerheid', kop: 'Zekerheid', breedte: 11 },
  { key: 'basis', kop: 'Basis', breedte: 18 },
  { key: 'huidigMin', kop: 'Nu in database: min', breedte: 13 },
  { key: 'huidigMax', kop: 'Nu in database: max', breedte: 13 },
  { key: 'huidigBand', kop: 'Nu in database: band', breedte: 18 },
  { key: 'voorstelMin', kop: 'Voorstel min (€)', breedte: 13 },
  { key: 'voorstelMax', kop: 'Voorstel max (€)', breedte: 13 },
  { key: 'voorstelBand', kop: 'Voorstel band', breedte: 18 },
  { key: 'n', kop: 'Aantal toekenningen', breedte: 11 },
  { key: 'periode', kop: 'Periode', breedte: 10 },
  { key: 'mediaan', kop: 'Gebruikelijk (mediaan, €)', breedte: 13 },
  { key: 'bewijs', kop: 'Bewijs (letterlijke citaten)', breedte: 70 },
  { key: 'bronnen', kop: 'Bronnen', breedte: 50 },
  { key: 'opmerking', kop: 'Opmerking', breedte: 44 },
  { key: 'jouwMin', kop: 'JOUW min (€)', breedte: 13, geel: true },
  { key: 'jouwMax', kop: 'JOUW max (€)', breedte: 13, geel: true },
  { key: 'jouwBand', kop: 'JOUW band', breedte: 18, geel: true },
  { key: 'akkoord', kop: 'Akkoord (ja/nee)', breedte: 11, geel: true },
  { key: 'toelichting', kop: 'Toelichting (wordt opgeslagen)', breedte: 60, geel: true },
  { key: 'id', kop: 'id (niet wijzigen)', breedte: 38 },
];

export const bandNaam = (id) => BANDEN.find((b) => b.id === id)?.naam ?? '';
export const bandId = (naam) => BANDEN.find((b) => b.naam === naam)?.id ?? null;
const host = (u) => {
  try {
    const x = new URL(u);
    return x.hostname.replace(/^www\./, '') + (x.pathname.length > 1 ? x.pathname : '');
  } catch {
    return u;
  }
};
const kort = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

function bewijsTekst(res) {
  const regels = [];
  for (const i of res.items.filter((x) => x.soort !== 'toekenning').slice(0, 4)) regels.push(`[${i.soort.replace('regel_', 'regel ')}] "${kort(i.citaat, 220)}" (${host(i.bronUrl)})`);
  const toek = res.items.filter((x) => x.soort === 'toekenning' && x.bedragEur != null).sort((a, b) => a.bedragEur - b.bedragEur);
  if (toek.length) {
    const kies = [...new Set([toek[0], toek[Math.floor(toek.length / 2)], toek[toek.length - 1]])];
    for (const i of kies) regels.push(`[toekenning${i.jaar ? ' ' + i.jaar : ''}] "${kort(i.citaat, 220)}" (${host(i.bronUrl)})`);
  }
  return regels.join('\n');
}

export function bouwRijen(resultaten, records, handmatig = { vast: [] }) {
  const perId = new Map(resultaten.map((r) => [r.id, r]));
  const rijen = [];
  for (const rec of records) {
    const res = perId.get(rec.id);
    if (!res) continue;
    const vast = (handmatig.vast ?? []).find((v) => rec.naam.toLowerCase().includes(v.match));
    let vMin = res.voorstel.min;
    let vMax = res.voorstel.max;
    let band = res.voorstel.band;
    let basis = res.basis;
    let zekerheid = res.zekerheid;
    let toelichting = res.toelichting ?? '';
    const opm = [...(res.opmerkingen ?? [])];
    if (res.documenten.length && !res.documenten.some((d) => d.ok)) opm.push('Geen enkele pagina kon worden opgehaald.');
    else if (!res.items.length && res.documenten.some((d) => d.ok)) opm.push('Pagina\'s gelezen, maar geen bedragen gevonden.');
    if (res.afgekeurdAantal) opm.push(`${res.afgekeurdAantal} door het model genoemde bedragen zijn door de controle afgekeurd.`);
    if (!res.documenten.length) opm.push('Geen website bekend en niets gevonden via webzoeken.');
    if (vast) {
      if (basis === 'GEEN') {
        vMin = vast.min;
        vMax = vast.max;
        band = kiesBand(vast.mediaan ?? (vast.min != null && vast.max != null ? (vast.min + vast.max) / 2 : vast.max != null ? vast.max / 2 : null));
        basis = vast.basis;
        zekerheid = 'midden';
        toelichting = vast.toelichting;
        if (vast.bron) opm.push(`Handmatige proef: ${vast.bron}`);
      } else opm.push(`Handmatige proef gaf: ${vast.toelichting}`);
      if (vast.let_op) opm.push(vast.let_op);
    }
    rijen.push({
      type: rec.type === 'regeling' ? 'regeling' : 'fonds',
      naam: rec.naam,
      tier: rec.tier,
      zekerheid,
      basis,
      huidigMin: rec.min,
      huidigMax: rec.max,
      huidigBand: bandNaam(rec.band_id),
      voorstelMin: vMin,
      voorstelMax: vMax,
      voorstelBand: band?.naam ?? '',
      n: res.feit?.n ?? 0,
      periode: res.feit ? (res.feit.van === res.feit.tot ? String(res.feit.tot) : `${res.feit.van}–${res.feit.tot}`) : '',
      mediaan: res.feit ? Math.round(res.feit.mediaan) : vast?.mediaan ?? null,
      bewijs: bewijsTekst(res),
      bronnen: res.bronnen.map((b) => `${b.eigen ? 'eigen' : 'derde'}: ${b.url}`).join('\n'),
      opmerking: opm.join('\n'),
      toelichting,
      id: rec.id,
    });
  }
  const gewicht = { hoog: 0, midden: 1, laag: 2, geen: 3 };
  rijen.sort((a, b) => (gewicht[a.zekerheid] ?? 3) - (gewicht[b.zekerheid] ?? 3) || a.naam.localeCompare(b.naam, 'nl'));
  rijen.forEach((r, i) => (r.nr = i + 1));
  return rijen;
}

export async function schrijfSheet(rijen, pad, { logoPad = null, titel = 'Bandbreedte-review fondsen en regelingen' } = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Subsidie Kompas';
  const ws = wb.addWorksheet('Reviewlijst', { views: [{ state: 'frozen', xSplit: 3, ySplit: HEADER_RIJ }], properties: { tabColor: { argb: KLEUR.groenAccent } } });
  KOLOMMEN.forEach((k, i) => (ws.getColumn(i + 1).width = k.breedte));
  ws.mergeCells('C1:L1');
  ws.getCell('C1').value = `Subsidie Kompas · ${titel}`;
  ws.getCell('C1').font = { name: 'Calibri', size: 16, bold: true, color: { argb: KLEUR.blauwDonker } };
  ws.mergeCells('C2:L2');
  ws.getCell('C2').value = `Gemaakt op ${new Date().toISOString().slice(0, 10)} · ${rijen.length} records`;
  ws.getCell('C2').font = { size: 10, color: { argb: KLEUR.tekst } };
  const legenda = [
    'Gele cellen = door u in te vullen · witte cellen = berekend door de tool, niet handmatig wijzigen.',
    'Akkoord = ja: het voorstel wordt na import opgeslagen (alleen als er nu niets in de database staat). Vult u JOUW min/max/band in, dan geldt uw eigen waarde en wordt die ook opgeslagen als er al iets stond.',
    'Basis: REGEL = het fonds noemt het zelf (letterlijk citaat). FEITELIJK = berekend uit gepubliceerde toekenningen (minimaal 5, laatste 3 jaar; bij 10 of meer P10–P90, anders laagste–hoogste). HANDMATIG = uit de proef, niet door de tool gecontroleerd.',
    'De tool schrijft niets naar de database. Alleen rijen met akkoord worden in het importbestand (SQL) gezet, dat u eerst kunt nalezen.',
  ];
  legenda.forEach((t, i) => {
    ws.mergeCells(`C${3 + i}:V${3 + i}`);
    const c = ws.getCell(`C${3 + i}`);
    c.value = t;
    c.font = { size: 10, color: { argb: KLEUR.tekst } };
    c.alignment = { wrapText: true, vertical: 'top' };
    ws.getRow(3 + i).height = i === 1 || i === 2 ? 30 : 16;
  });
  if (logoPad) {
    try {
      const id = wb.addImage({ buffer: await fs.readFile(logoPad), extension: 'png' });
      ws.addImage(id, { tl: { col: 0.1, row: 0.1 }, ext: { width: 54, height: 54 } });
    } catch {}
  }
  ws.getRow(1).height = 28;
  KOLOMMEN.forEach((k, i) => {
    const c = ws.getCell(HEADER_RIJ, i + 1);
    c.value = k.kop;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: k.geel ? KLEUR.groenAccent : KLEUR.blauwDonker } };
    c.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
  });
  ws.getRow(HEADER_RIJ).height = 42;
  const bandLijst = `"${BANDEN.map((b) => b.naam).join(',')}"`;
  rijen.forEach((r, ri) => {
    const rij = HEADER_RIJ + 1 + ri;
    KOLOMMEN.forEach((k, ci) => {
      const c = ws.getCell(rij, ci + 1);
      const v = r[k.key];
      c.value = v === '' || v === undefined ? null : v;
      c.font = { size: 10, color: { argb: KLEUR.tekst } };
      c.alignment = { wrapText: ['bewijs', 'bronnen', 'opmerking', 'toelichting', 'naam'].includes(k.key), vertical: 'top' };
      c.fill = k.geel ? { type: 'pattern', pattern: 'solid', fgColor: { argb: KLEUR.geel } } : ri % 2 ? { type: 'pattern', pattern: 'solid', fgColor: { argb: KLEUR.achtergrond } } : undefined;
      if (['huidigMin', 'huidigMax', 'voorstelMin', 'voorstelMax', 'mediaan', 'jouwMin', 'jouwMax'].includes(k.key)) c.numFmt = '#,##0';
      c.border = { bottom: { style: 'hair', color: { argb: 'FFCCD6D2' } } };
    });
    ws.getCell(rij, KOLOMMEN.findIndex((k) => k.key === 'jouwBand') + 1).dataValidation = { type: 'list', allowBlank: true, formulae: [bandLijst] };
    ws.getCell(rij, KOLOMMEN.findIndex((k) => k.key === 'akkoord') + 1).dataValidation = { type: 'list', allowBlank: true, formulae: ['"ja,nee"'] };
    const z = ws.getCell(rij, KOLOMMEN.findIndex((k) => k.key === 'zekerheid') + 1);
    z.font = { size: 10, bold: true, color: { argb: r.zekerheid === 'hoog' ? KLEUR.groenAccent : r.zekerheid === 'midden' ? 'FF9A6B00' : 'FF7A8A86' } };
  });
  ws.autoFilter = { from: { row: HEADER_RIJ, column: 1 }, to: { row: HEADER_RIJ + rijen.length, column: KOLOMMEN.length } };
  await wb.xlsx.writeFile(pad);
}

export const celTekst = (c) => {
  const v = c?.value;
  if (v == null) return '';
  if (typeof v === 'object') return String(v.text ?? v.result ?? (v.richText ? v.richText.map((x) => x.text).join('') : '')).trim();
  return String(v).trim();
};
export const celGetal = (c) => {
  const t = celTekst(c).replace(/[€\s]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

export async function leesSheet(pad) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(pad);
  const ws = wb.getWorksheet('Reviewlijst') ?? wb.worksheets[0];
  const kolom = {};
  ws.getRow(HEADER_RIJ).eachCell((c, n) => {
    const k = KOLOMMEN.find((x) => x.kop === celTekst(c));
    if (k) kolom[k.key] = n;
  });
  for (const nodig of ['id', 'akkoord', 'jouwMin', 'jouwMax', 'voorstelMin', 'voorstelMax', 'toelichting']) if (!kolom[nodig]) throw new Error(`Kolom ontbreekt in de sheet: ${nodig}`);
  const rijen = [];
  for (let r = HEADER_RIJ + 1; r <= ws.rowCount; r++) {
    const g = (k) => ws.getCell(r, kolom[k]);
    const id = celTekst(g('id'));
    if (!id) continue;
    rijen.push({
      rij: r,
      id,
      type: celTekst(g('type')),
      naam: celTekst(g('naam')),
      akkoord: celTekst(g('akkoord')).toLowerCase(),
      jouwMin: celGetal(g('jouwMin')),
      jouwMax: celGetal(g('jouwMax')),
      jouwBand: celTekst(g('jouwBand')),
      voorstelMin: celGetal(g('voorstelMin')),
      voorstelMax: celGetal(g('voorstelMax')),
      voorstelBand: celTekst(g('voorstelBand')),
      huidigMin: celGetal(g('huidigMin')),
      huidigMax: celGetal(g('huidigMax')),
      toelichting: celTekst(g('toelichting')),
    });
  }
  return rijen;
}

export const sq = (s) => `'${String(s).replace(/'/g, "''")}'`;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Maakt de SQL. Regels: akkoord 'ja' of eigen waarden ingevuld (en niet 'nee') telt mee. Eigen waarden gaan altijd voor en overschrijven;
// een voorstel schrijft alleen als de database voor dat veld nu leeg is.
export function maakSql(rijen) {
  const regels = [];
  const problemen = [];
  let aantal = 0;
  for (const r of rijen) {
    if (r.akkoord === 'nee') continue;
    const eigen = r.jouwMin != null || r.jouwMax != null || r.jouwBand !== '';
    if (!(r.akkoord === 'ja' || eigen)) continue;
    if (!UUID.test(r.id)) { problemen.push({ rij: r.rij, naam: r.naam, fout: 'ongeldig id' }); continue; }
    if ([r.jouwMin, r.jouwMax, r.voorstelMin, r.voorstelMax].some((x) => Number.isNaN(x))) { problemen.push({ rij: r.rij, naam: r.naam, fout: 'een bedrag is geen getal' }); continue; }
    const regeling = r.type === 'regeling';
    const tabel = regeling ? 'subsidieregelingen' : 'funders';
    const cMin = regeling ? 'bedrag_min' : 'bijdrage_min';
    const cMax = regeling ? 'bedrag_max' : 'bijdrage_max';
    const sets = [];
    const guards = [];
    const eigenMin = r.jouwMin != null;
    const eigenMax = r.jouwMax != null;
    const eigenWaarde = eigenMin || eigenMax || r.jouwBand !== '';
    const min = eigenMin ? r.jouwMin : r.voorstelMin;
    const max = eigenMax ? r.jouwMax : r.voorstelMax;
    if (min != null && max != null && min > max) { problemen.push({ rij: r.rij, naam: r.naam, fout: `min (${min}) is hoger dan max (${max})` }); continue; }
    if ((min ?? 0) < 0 || (max ?? 0) < 0) { problemen.push({ rij: r.rij, naam: r.naam, fout: 'negatief bedrag' }); continue; }
    if (!eigenMin && !eigenMax) {
      // Puur voorstel: schrijft alleen als de database voor min en max nu leeg is (nooit bestaande bedragen overschrijven).
      if (min != null) sets.push(`${cMin} = ${min}`);
      if (max != null) sets.push(`${cMax} = ${max}`);
      if (min != null || max != null) guards.push(`${cMin} is null`, `${cMax} is null`);
    } else {
      // Eigen waarde: geldt altijd. Een veld dat u niet invulde, vult het voorstel alleen aan als het in de database leeg is.
      if (eigenMin) sets.push(`${cMin} = ${min}`);
      else if (min != null) sets.push(`${cMin} = coalesce(${cMin}, ${min})`);
      if (eigenMax) sets.push(`${cMax} = ${max}`);
      else if (max != null) sets.push(`${cMax} = coalesce(${cMax}, ${max})`);
    }
    let bId = null;
    if (r.jouwBand) {
      bId = bandId(r.jouwBand);
      if (!bId) { problemen.push({ rij: r.rij, naam: r.naam, fout: `onbekende band "${r.jouwBand}"` }); continue; }
    } else if (eigenMin || eigenMax) {
      const typ = min != null && max != null ? (min + max) / 2 : max != null ? max / 2 : min;
      bId = kiesBand(typ)?.id ?? null;
    } else if (r.voorstelBand && (min != null || max != null)) {
      bId = bandId(r.voorstelBand);
      if (!bId) { problemen.push({ rij: r.rij, naam: r.naam, fout: `onbekende band "${r.voorstelBand}"` }); continue; }
    }
    if (bId) sets.push(`bandbreedte_bijdrage_id = ${sq(bId)}`);
    if (r.toelichting) {
      if (sets.length || eigenWaarde) sets.push(`bijdrage_toelichting = ${sq(r.toelichting.slice(0, 600))}`);
      else {
        sets.push(`bijdrage_toelichting = ${sq(r.toelichting.slice(0, 600))}`);
        guards.push('bijdrage_toelichting is null');
      }
    }
    if (!sets.length) continue;
    const where = [`id = ${sq(r.id)}`, ...guards].join(' and ');
    regels.push(`-- ${r.naam}\nupdate public.${tabel} set ${sets.join(', ')} where ${where};`);
    aantal++;
  }
  const kop = `-- Bandbreedtes uit de reviewsheet. ${aantal} updates. Nalezen voor het uitvoeren; alles in één transactie.\nbegin;\n`;
  return { sql: kop + regels.join('\n') + `\ncommit;\n`, aantal, problemen };
}
