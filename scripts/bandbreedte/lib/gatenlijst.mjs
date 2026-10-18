// Gatenlijst van de goedgekeurde fondsen en regelingen die meedoen aan de AI-matching: alle categorieën in één sheet,
// gele cellen = nog leeg en aan te vullen. Bestaande waarden staan er wit en mogen ook aangepast worden.
// Alleen wat je wijzigt gaat naar SQL; leeggemaakte cellen worden genegeerd (de tool wist nooit iets in de database).
import ExcelJS from 'exceljs';
import { promises as fs } from 'node:fs';
import { BANDEN, kiesBand } from './rekenen.mjs';
import { KLEUR, UUID, bandId, bandNaam, celGetal, celTekst, sq } from './uitvoer.mjs';
import { normaliseer } from './bedragen.mjs';

const HEADER_RIJ = 8;
export const TYPE_LABEL = {
  vermogensfonds: 'Vermogensfonds',
  gemeente_lokale_overheid: 'Gemeente / lokale overheid',
  corporate_foundation: 'Bedrijfsfonds',
  rijksoverheid: 'Rijksoverheid',
  europese_fondsen: 'Europees fonds',
  service_club: 'Serviceclub',
  religieuze_instelling: 'Religieuze instelling',
};
const TYPE_VOLGORDE = Object.keys(TYPE_LABEL);
const OPEN_STATUS = new Set(['open', 'aangekondigd', 'binnenkort']);

// kind: tekst | getal | keuze | multi | datum.  invul: gele cel als leeg.  info: alleen ter informatie (wordt niet teruggeschreven).
export const KOLOMMEN = [
  { key: 'nr', kop: 'Nr', breedte: 6 },
  { key: 'soort', kop: 'Soort', breedte: 10 },
  { key: 'typeLabel', kop: 'Type aanbieder', breedte: 22 },
  { key: 'naam', kop: 'Naam', breedte: 38 },
  { key: 'aanbieder', kop: 'Aanbieder (bij regeling)', breedte: 26 },
  { key: 'gaten', kop: 'Aantal gaten', breedte: 8 },
  { key: 'tier', kop: 'Pro / Premium', breedte: 11, invul: true, kind: 'keuze' },
  { key: 'plaats', kop: 'Vestigingsplaats', breedte: 18, invul: true, kind: 'tekst' },
  { key: 'omschrijving', kop: 'Korte omschrijving', breedte: 60, invul: true, kind: 'tekst' },
  { key: 'themas', kop: "Disciplines (thema's)", breedte: 34, invul: true, kind: 'multi' },
  { key: 'doelgroepen', kop: 'Doelgroepen', breedte: 34, invul: true, kind: 'multi' },
  { key: 'regios', kop: 'Werkgebieden', breedte: 28, invul: true, kind: 'multi' },
  { key: 'website', kop: 'Website', breedte: 30, invul: true, kind: 'tekst' },
  { key: 'criteria', kop: 'Aanvraagcriteria / voorwaarden', breedte: 44, invul: true, kind: 'tekst' },
  { key: 'aanvraaglink', kop: 'Aanvraaglink (regeling)', breedte: 30, invul: true, kind: 'tekst' },
  { key: 'status', kop: 'Status (regeling)', breedte: 14 },
  { key: 'deadline', kop: 'Deadline (regeling)', breedte: 13, invul: true, kind: 'datum' },
  { key: 'min', kop: 'Bijdrage min (€)', breedte: 13, invul: true, kind: 'getal' },
  { key: 'max', kop: 'Bijdrage max (€)', breedte: 13, invul: true, kind: 'getal' },
  { key: 'band', kop: 'Band', breedte: 19, invul: true, kind: 'keuze' },
  { key: 'toel', kop: 'Toelichting bijdrage', breedte: 44, invul: true, kind: 'tekst' },
  { key: 'missie', kop: 'Missie (ter info)', breedte: 44 },
  { key: 'jaarbudget', kop: 'Jaarbudget (€, ter info)', breedte: 14 },
  { key: 'tip', kop: 'Tip uit onderzoek (niet gecontroleerd)', breedte: 44 },
  { key: 'flag', kop: 'Controlepunt (Claude)', breedte: 44 },
  { key: 'id', kop: 'id (niet wijzigen)', breedte: 38 },
];
const INVUL = KOLOMMEN.filter((k) => k.invul);
const origKey = (k) => 'orig_' + k;

function tipVoor(handmatig, ...namen) {
  const n = namen.filter(Boolean).join(' ').toLowerCase();
  const tips = [];
  for (const v of handmatig.vast ?? []) if (n.includes(v.match)) tips.push(`${v.toelichting}${v.let_op ? ' ' + v.let_op : ''}`);
  for (const t of handmatig.tips ?? []) if (n.includes(t.match)) tips.push(t.tekst);
  return tips.join('\n');
}

const leeg = (v) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
const lijstTekst = (a) => (Array.isArray(a) ? a.join('; ') : '');
const datumTekst = (d) => (d ? String(d).slice(0, 10) : '');

export function bouwRijen({ fondsen, regelingen }, handmatig = {}) {
  const rijen = [];
  for (const f of fondsen) {
    rijen.push({
      soort: 'fonds', type: f.type, typeLabel: TYPE_LABEL[f.type] ?? f.type ?? '', naam: f.naam, aanbieder: '', tier: f.tier ?? '', plaats: f.plaats ?? '', omschrijving: f.omschrijving ?? '',
      themas: lijstTekst(f.themas), doelgroepen: lijstTekst(f.doelgroepen), regios: lijstTekst(f.regios), website: f.website ?? '', criteria: f.criteria ?? '', aanvraaglink: '', status: '', deadline: '',
      min: f.min ?? null, max: f.max ?? null, band: bandNaam(f.band_id), toel: f.toel ?? '', missie: f.missie ?? '', jaarbudget: f.jaarbudget ?? null, tip: tipVoor(handmatig, f.naam), id: f.id,
    });
  }
  for (const r of regelingen) {
    rijen.push({
      soort: 'regeling', type: r.type ?? '', typeLabel: TYPE_LABEL[r.type] ?? r.type ?? '', naam: r.naam, aanbieder: r.aanbieder ?? '', tier: r.tier ?? '', plaats: r.plaats ?? '', omschrijving: r.omschrijving ?? '',
      themas: lijstTekst(r.themas), doelgroepen: lijstTekst(r.doelgroepen), regios: lijstTekst(r.regios), website: r.website ?? '', criteria: r.criteria ?? '', aanvraaglink: r.aanvraaglink ?? '', status: r.status ?? '', deadline: datumTekst(r.deadline),
      min: r.min ?? null, max: r.max ?? null, band: bandNaam(r.band_id), toel: r.toel ?? '', missie: '', jaarbudget: null, tip: tipVoor(handmatig, r.naam, r.aanbieder), id: r.id,
    });
  }
  const tv = (t) => {
    const i = TYPE_VOLGORDE.indexOf(t);
    return i < 0 ? 99 : i;
  };
  rijen.sort((a, b) => (a.soort === 'regeling' ? 0 : 1) - (b.soort === 'regeling' ? 0 : 1) || tv(a.type) - tv(b.type) || a.naam.localeCompare(b.naam, 'nl'));
  rijen.forEach((r, i) => {
    r.nr = i + 1;
    r.gaatKeys = gatenVan(r);
    r.gaten = r.gaatKeys.length;
    for (const k of INVUL) r[origKey(k.key)] = r[k.key];
  });
  return rijen;
}

// Welke gele velden heeft deze rij? Niet van toepassing: aanvraaglink en deadline bij een fonds; deadline bij een regeling die doorlopend of gesloten is.
export function gatenVan(r) {
  const uit = [];
  for (const k of INVUL) {
    if (r.soort === 'fonds' && ['aanvraaglink', 'deadline'].includes(k.key)) continue;
    if (k.key === 'deadline' && !OPEN_STATUS.has(r.status)) continue;
    if (leeg(r[k.key])) uit.push(k.key);
  }
  return uit;
}

export async function schrijfGatenlijst(rijen, pad, { logoPad = null, taxonomie = { themas: [], doelgroepen: [], regios: [] } } = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Subsidie Kompas';
  const ws = wb.addWorksheet('Gatenlijst', { views: [{ state: 'frozen', xSplit: 4, ySplit: HEADER_RIJ }], properties: { tabColor: { argb: KLEUR.groenAccent } } });
  const alle = [...KOLOMMEN, ...INVUL.map((k) => ({ key: origKey(k.key), kop: 'oorspronkelijk ' + k.key, breedte: 10, verberg: true })), { key: 'orig_naam', kop: 'oorspronkelijk naam', breedte: 10, verberg: true }];
  alle.forEach((k, i) => {
    const kol = ws.getColumn(i + 1);
    kol.width = k.breedte;
    if (k.verberg) kol.hidden = true;
  });
  const tel = (f) => rijen.filter(f).length;
  const gat = rijen.reduce((s, r) => s + r.gaten, 0);
  ws.mergeCells('D1:M1');
  ws.getCell('D1').value = 'Subsidie Kompas · Gatenlijst goedgekeurde fondsen en subsidieregelingen';
  ws.getCell('D1').font = { size: 16, bold: true, color: { argb: KLEUR.blauwDonker } };
  ws.mergeCells('D2:M2');
  ws.getCell('D2').value = `Stand ${new Date().toISOString().slice(0, 10)} · alleen wat meedoet aan de AI-matching: ${tel((r) => r.soort === 'fonds')} fondsen en ${tel((r) => r.soort === 'regeling')} subsidieregelingen (waarvan ${tel((r) => r.soort === 'regeling' && r.type === 'gemeente_lokale_overheid')} van gemeenten) · ${gat} gaten`;
  ws.getCell('D2').font = { size: 10, color: { argb: KLEUR.tekst } };
  const legenda = [
    'Gele cellen = nog leeg, door u in te vullen · witte cellen = al in de database (mag u ook aanpassen) · grijze koppen = informatie.',
    "Disciplines, doelgroepen en werkgebieden: kies uit het tabblad Keuzelijsten en scheid meerdere met een puntkomma (bijvoorbeeld: Sport; Welzijn). Zelf een waarde verzinnen werkt niet; de import meldt dat.",
    'Deadline alleen invullen bij regelingen die open, aangekondigd of binnenkort zijn (andere velden zijn niet van toepassing). Kolom "Aantal gaten" telt de gele cellen per rij: sorteer of filter daarop.',
    'Niets gaat automatisch naar de database. Alleen cellen die u wijzigt komen in het importbestand (SQL), dat u eerst kunt nalezen. Verwijderen of leegmaken wordt genegeerd. "Tip uit onderzoek" komt uit een handmatige proef en is niet gecontroleerd.',
    ...(rijen.some((r) => r.gewijzigd?.length || r.geschat?.length) ? [`${rijen.some((r) => r.gewijzigd?.length) ? 'Blauwe cellen = door Claude aangevuld of aangepast ten opzichte van uw versie' : ''}${rijen.some((r) => r.gewijzigd?.length) && rijen.some((r) => r.geschat?.length) ? ' · ' : ''}${rijen.some((r) => r.geschat?.length) ? 'oranje cellen = schatting van Claude, niet gecontroleerd' : ''} · kolom "Controlepunt" noemt wat nog uw aandacht vraagt (bij schattingen ook de zekerheid).`] : []),
  ];
  legenda.forEach((t, i) => {
    ws.mergeCells(`D${3 + i}:Q${3 + i}`);
    const c = ws.getCell(`D${3 + i}`);
    c.value = t;
    c.font = { size: 10, color: { argb: KLEUR.tekst } };
    c.alignment = { wrapText: true, vertical: 'top' };
    ws.getRow(3 + i).height = i === 0 || i === 4 ? 16 : 28;
  });
  if (logoPad) {
    try {
      const id = wb.addImage({ buffer: await fs.readFile(logoPad), extension: 'png' });
      ws.addImage(id, { tl: { col: 0.1, row: 0.1 }, ext: { width: 54, height: 54 } });
    } catch {}
  }
  ws.getRow(1).height = 28;
  alle.forEach((k, i) => {
    const c = ws.getCell(HEADER_RIJ, i + 1);
    c.value = k.kop;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: k.invul ? KLEUR.groenAccent : KLEUR.blauwDonker } };
    c.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
  });
  ws.getRow(HEADER_RIJ).height = 42;
  const bandLijst = `"${BANDEN.map((b) => b.naam).join(',')}"`;
  const wrap = new Set(['flag', 'naam', 'aanbieder', 'omschrijving', 'themas', 'doelgroepen', 'regios', 'website', 'criteria', 'aanvraaglink', 'toel', 'missie', 'tip']);
  const getal = new Set(['min', 'max', 'jaarbudget', origKey('min'), origKey('max')]);
  const geel = { type: 'pattern', pattern: 'solid', fgColor: { argb: KLEUR.geel } };
  const oranje = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD9B3' } };
  const blauw = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E8F3' } };
  const kolomVan = (key) => alle.findIndex((k) => k.key === key) + 1;
  rijen.forEach((r, ri) => {
    const rij = HEADER_RIJ + 1 + ri;
    alle.forEach((k, ci) => {
      const c = ws.getCell(rij, ci + 1);
      const v = r[k.key];
      c.value = v === '' || v === undefined || v === null ? null : v;
      c.font = { size: 10, color: { argb: KLEUR.tekst } };
      c.alignment = { wrapText: wrap.has(k.key), vertical: 'top' };
      if (getal.has(k.key)) c.numFmt = '#,##0';
      if (r.gaatKeys.includes(k.key)) c.fill = geel;
      else if (r.geschat?.includes(k.key)) c.fill = oranje;
      else if (r.gewijzigd?.includes(k.key)) c.fill = blauw;
      else if (ri % 2) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: KLEUR.achtergrond } };
      c.border = { bottom: { style: 'hair', color: { argb: 'FFCCD6D2' } } };
    });
    ws.getCell(rij, kolomVan('band')).dataValidation = { type: 'list', allowBlank: true, formulae: [bandLijst] };
    ws.getCell(rij, kolomVan('tier')).dataValidation = { type: 'list', allowBlank: true, formulae: ['"pro,premium"'] };
  });
  ws.autoFilter = { from: { row: HEADER_RIJ, column: 1 }, to: { row: HEADER_RIJ + rijen.length, column: KOLOMMEN.length } };
  const kl = wb.addWorksheet('Keuzelijsten', { properties: { tabColor: { argb: KLEUR.blauwPastel } } });
  const nieuw = [...(taxonomie.nieuw?.doelgroepen ?? []).map((n) => `Doelgroep: ${n}`), ...(taxonomie.nieuw?.regios ?? []).map((n) => `Werkgebied: ${n}`)];
  const lijsten = [['Disciplines (thema\'s)', taxonomie.themas], ['Doelgroepen', taxonomie.doelgroepen], ['Werkgebieden', taxonomie.regios], ['Band', BANDEN.map((b) => b.naam)], ...(nieuw.length ? [['Voorstel nieuwe keuzes (nog niet in de database)', nieuw]] : [])];
  lijsten.forEach(([kop, namen], i) => {
    kl.getColumn(i + 1).width = 44;
    const h = kl.getCell(1, i + 1);
    h.value = kop;
    h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: KLEUR.blauwDonker } };
    namen.forEach((n, j) => (kl.getCell(j + 2, i + 1).value = n));
  });
  await wb.xlsx.writeFile(pad);
}

const datumUitCel = (c) => {
  const v = c?.value;
  if (v instanceof Date) return new Date(v.getTime() + 12 * 3600 * 1000).toISOString().slice(0, 10);
  const t = celTekst(c);
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : t;
};

export async function leesGatenlijst(pad) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(pad);
  const ws = wb.getWorksheet('Gatenlijst') ?? wb.worksheets[0];
  const kolom = {};
  ws.getRow(HEADER_RIJ).eachCell((c, n) => {
    const kop = celTekst(c);
    const k = KOLOMMEN.find((x) => x.kop === kop);
    if (k) kolom[k.key] = n;
    const o = INVUL.find((x) => 'oorspronkelijk ' + x.key === kop);
    if (o) kolom[origKey(o.key)] = n;
    if (kop === 'oorspronkelijk naam') kolom.orig_naam = n;
  });
  for (const nodig of ['id', 'soort', 'naam', ...INVUL.flatMap((k) => [k.key, origKey(k.key)])]) if (!kolom[nodig]) throw new Error(`Kolom ontbreekt in de sheet: ${nodig}`);
  const waarde = (r, key, kind) => {
    const c = ws.getCell(r, kolom[key]);
    if (kind === 'getal') return celGetal(c);
    if (kind === 'datum') return datumUitCel(c);
    return celTekst(c);
  };
  const rijen = [];
  for (let r = HEADER_RIJ + 1; r <= ws.rowCount; r++) {
    const id = celTekst(ws.getCell(r, kolom.id));
    if (!id) continue;
    const rij = { rij: r, id, soort: celTekst(ws.getCell(r, kolom.soort)), naam: celTekst(ws.getCell(r, kolom.naam)) };
    for (const k of INVUL) {
      rij[k.key] = waarde(r, k.key, k.kind);
      rij[origKey(k.key)] = waarde(r, origKey(k.key), k.kind);
    }
    if (kolom.orig_naam) rij.orig_naam = celTekst(ws.getCell(r, kolom.orig_naam));
    rijen.push(rij);
  }
  return rijen;
}

const splits = (s) => String(s ?? '').split(/[;\n]|,(?!\s)/).map((x) => x.trim()).filter(Boolean);
const TABEL = {
  fonds: { tabel: 'funders', kolommen: { tier: 'access_tier', plaats: 'plaats', omschrijving: 'algemene_beschrijving', website: 'website', criteria: 'aanvraagcriteria', min: 'bijdrage_min', max: 'bijdrage_max', toel: 'bijdrage_toelichting' }, multi: { themas: ['funder_themas', 'funder_id', 'thema_id', 'themas'], doelgroepen: ['funder_doelgroepen', 'funder_id', 'doelgroep_id', 'doelgroepen'], regios: ['funder_regios', 'funder_id', 'regio_id', 'regios'] } },
  regeling: { tabel: 'subsidieregelingen', kolommen: { tier: 'access_tier', plaats: 'plaats', omschrijving: 'algemene_beschrijving', website: 'website', criteria: 'voorwaarden', aanvraaglink: 'aanvraaglink', deadline: 'deadline_datum', min: 'bedrag_min', max: 'bedrag_max', toel: 'bijdrage_toelichting' }, multi: { themas: ['subsidieregeling_themas', 'subsidieregeling_id', 'thema_id', 'themas'], doelgroepen: ['subsidieregeling_doelgroepen', 'subsidieregeling_id', 'doelgroep_id', 'doelgroepen'], regios: ['subsidieregeling_regios', 'subsidieregeling_id', 'regio_id', 'regios'] } },
};
const LIMIET = { omschrijving: 5000, criteria: 8000, toel: 600, plaats: 120, website: 300, aanvraaglink: 600 };

export function maakSql(rijen, taxonomie) {
  const regels = [];
  const problemen = [];
  let aantal = 0;
  let genegeerd = 0;
  const canon = {};
  const nieuwTax = taxonomie.nieuw ?? {};
  const nieuwGebruikt = { doelgroepen: new Set(), regios: new Set() };
  for (const t of ['themas', 'doelgroepen', 'regios']) canon[t] = new Map([...(taxonomie[t] ?? []), ...(nieuwTax[t] ?? [])].map((n) => [normaliseer(n), n]));
  for (const r of rijen) {
    const fout = (f) => problemen.push({ rij: r.rij, naam: r.naam, fout: f });
    const cfg = TABEL[r.soort];
    if (!cfg) { fout(`onbekende soort "${r.soort}"`); continue; }
    if (!UUID.test(r.id)) { fout('ongeldig id'); continue; }
    const sets = [];
    const extra = [];
    let ok = true;
    const gewijzigd = {};
    for (const k of INVUL) {
      if (['aanvraaglink', 'deadline'].includes(k.key) && r.soort === 'fonds') continue;
      if (k.key === 'band') continue;
      const nieuw = r[k.key];
      const oud = r[origKey(k.key)];
      if (k.kind === 'multi') {
        const nu = splits(nieuw);
        const was = splits(oud);
        const wasSet = new Set(was.map(normaliseer));
        const nuSet = new Set(nu.map(normaliseer));
        if ([...wasSet].some((x) => !nuSet.has(x))) genegeerd++;
        const toe = [];
        for (const n of nu) {
          if (wasSet.has(normaliseer(n))) continue;
          const c = canon[k.key].get(normaliseer(n));
          if (!c) { fout(`${k.kop}: "${n}" staat niet in de keuzelijst`); ok = false; } else if (!toe.includes(c)) {
            toe.push(c);
            if ((nieuwTax[k.key] ?? []).includes(c)) nieuwGebruikt[k.key].add(c);
          }
        }
        if (toe.length) {
          const [tab, fk, ck, lookup] = cfg.multi[k.key];
          const namen = toe.map(sq).join(', ');
          extra.push(`insert into public.${tab} (${fk}, ${ck}) select ${sq(r.id)}, l.id from public.${lookup} l where l.naam in (${namen}) and not exists (select 1 from public.${tab} x where x.${fk} = ${sq(r.id)} and x.${ck} = l.id);`);
        }
        continue;
      }
      const leegNu = nieuw === '' || nieuw === null || (typeof nieuw === 'number' && Number.isNaN(nieuw) && false);
      if (leegNu) {
        if (!(oud === '' || oud === null)) genegeerd++;
        continue;
      }
      const gelijk = k.kind === 'getal' ? nieuw === oud : String(nieuw).trim() === String(oud ?? '').trim();
      if (gelijk) continue;
      gewijzigd[k.key] = nieuw;
    }
    const bandNu = r.band;
    const bandOud = r[origKey('band')];
    const bandGewijzigd = bandNu !== '' && bandNu !== bandOud;
    if (bandNu === '' && bandOud !== '') genegeerd++;
    for (const [key, waarde] of Object.entries(gewijzigd)) {
      let v = waarde;
      const kol = cfg.kolommen[key];
      const kind = INVUL.find((x) => x.key === key).kind;
      if (kind === 'getal') {
        if (!Number.isFinite(v)) { fout(`${INVUL.find((x) => x.key === key).kop}: geen getal`); ok = false; continue; }
        if (v < 0) { fout('negatief bedrag'); ok = false; continue; }
        sets.push(`${kol} = ${v}`);
      } else if (key === 'tier') {
        const t = String(v).toLowerCase();
        if (!['pro', 'premium'].includes(t)) { fout(`Pro / Premium: "${v}" is geen geldige keuze`); ok = false; continue; }
        sets.push(`${kol} = ${sq(t)}`);
      } else if (key === 'deadline') {
        const dm = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(String(v).trim());
        if (dm) v = `${dm[3]}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) { fout(`Deadline: "${v}" is geen datum (gebruik jjjj-mm-dd of dd-mm-jjjj)`); ok = false; continue; }
        sets.push(`${kol} = ${sq(v)}`);
      } else {
        let t = String(v).trim();
        if (['website', 'aanvraaglink'].includes(key)) {
          if (!/^https?:\/\//i.test(t)) t = 'https://' + t;
          try {
            const u = new URL(t);
            if (!u.hostname.includes('.')) throw new Error('host');
          } catch { fout(`${key === 'website' ? 'Website' : 'Aanvraaglink'}: "${v}" is geen webadres`); ok = false; continue; }
        }
        if (t.length > (LIMIET[key] ?? 5000)) { fout(`${INVUL.find((x) => x.key === key).kop} is te lang (${t.length} tekens, maximaal ${LIMIET[key] ?? 5000})`); ok = false; continue; }
        sets.push(`${kol} = ${sq(t)}`);
      }
    }
    // naamwijziging (vergeleken met de verborgen kolom "oorspronkelijk naam")
    const naamNu = String(r.naam ?? '').trim();
    if (r.orig_naam && naamNu && naamNu !== String(r.orig_naam).trim()) {
      if (naamNu.length > 250) { fout(`Naam is te lang (${naamNu.length} tekens, maximaal 250)`); ok = false; } else sets.push(`naam = ${sq(naamNu)}`);
    }
    // min/max/band samen controleren en de band bepalen
    const minNu = r.min;
    const maxNu = r.max;
    if (ok && typeof minNu === 'number' && typeof maxNu === 'number' && Number.isFinite(minNu) && Number.isFinite(maxNu) && minNu > maxNu) { fout(`min (${minNu}) is hoger dan max (${maxNu})`); ok = false; }
    if (ok) {
      let bId = null;
      if (bandGewijzigd) {
        bId = bandId(bandNu);
        if (!bId) { fout(`onbekende band "${bandNu}"`); ok = false; }
      } else if ('min' in gewijzigd || 'max' in gewijzigd) {
        const mi = Number.isFinite(minNu) ? minNu : null;
        const ma = Number.isFinite(maxNu) ? maxNu : null;
        const typ = mi != null && ma != null ? (mi + ma) / 2 : ma != null ? ma / 2 : mi;
        bId = kiesBand(typ)?.id ?? null;
      }
      if (bId && ok) sets.push(`bandbreedte_bijdrage_id = ${sq(bId)}`);
    }
    if (!ok) continue;
    if (!sets.length && !extra.length) continue;
    const naamKop = r.orig_naam && r.orig_naam.trim() !== r.naam.trim() ? `${r.orig_naam} → ${r.naam}` : r.naam;
    const kop = `-- ${naamKop.replace(/[\r\n]+/g, ' ')}${gewijzigd.tier ? ' (let op: Pro/Premium gewijzigd)' : ''}`;
    regels.push([kop, ...(sets.length ? [`update public.${cfg.tabel} set ${sets.join(', ')} where id = ${sq(r.id)};`] : []), ...extra].join('\n'));
    aantal++;
  }
  const nieuwSql = [];
  for (const [t, tab] of [['doelgroepen', 'doelgroepen'], ['regios', 'regios']]) {
    const namen = [...nieuwGebruikt[t]];
    if (namen.length) nieuwSql.push(`-- Voorstel nieuwe keuzes in ${tab}: pas toepassen na akkoord\ninsert into public.${tab} (naam) select v.naam from (values ${namen.map((n) => `(${sq(n)})`).join(', ')}) as v(naam) where not exists (select 1 from public.${tab} x where x.naam = v.naam);`);
  }
  const kop = `-- Wijzigingen uit de gatenlijst. ${aantal} records. Nalezen voor het uitvoeren; alles in één transactie.\nbegin;\n${nieuwSql.length ? nieuwSql.join('\n') + '\n' : ''}`;
  return { sql: kop + regels.join('\n') + `\ncommit;\n`, aantal, problemen, genegeerd };
}
