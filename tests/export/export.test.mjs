import fs from 'fs';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import { AI_TEKST, PROJECT_A, PROJECT_B, VELDEN, PROFIEL, BERICHTEN } from './fixtures.mjs';
import { bouwDocumentModel, bouwProjectModel, bouwOrganisatieModel, bouwGesprekModel } from '../../src/shared/export/exportModel.js';
import { voerExportUit } from '../../src/shared/export/exportService.js';
import { normalizeDocumentContent } from '../../src/shared/document-theme/normalizeDocumentContent.js';
import { generateWordDocument } from '../../src/shared/document-theme/generateWordDocument.js';
import { bouwBestandsnaam } from '../../src/shared/export/exportBestand.js';

const res = [];
const ok = (n, c, d = '') => { res.push([n, !!c]); console.log(c ? 'OK  ' : 'FAIL', n, d); };

// --- download stub
const downloads = [];
globalThis.document = { createElement: () => ({ click() { downloads.at(-1).geklikt = true; }, set href(v) {}, set download(v) { downloads.push({ naam: v }); } }), body: { appendChild() {}, removeChild() {} } };
let laatsteBlob = null;
globalThis.URL.createObjectURL = (b) => { laatsteBlob = b; return 'blob:x'; };
globalThis.URL.revokeObjectURL = () => {};

const docXml = async (blob) => (await (await JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()))).file('word/document.xml').async('string'));
const tekstUitXml = (x) => [...x.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('|');

const store = { orgProfile: { name: 'Stichting Buurtkracht' } };

// ===== WORD: onveranderd t.o.v. de oorspronkelijke aanroep
const origineel = await generateWordDocument({ title: 'Projectplan', documentType: 'Projectplan', organizationName: store.orgProfile.name, content: normalizeDocumentContent(AI_TEKST) });
const docModel = bouwDocumentModel({ tekst: AI_TEKST, soort: 'Projectplan', organisatieNaam: store.orgProfile.name, projectNaam: PROJECT_A.naam, project: PROJECT_A });
ok('blocks identiek aan normalizeDocumentContent', JSON.stringify(docModel.blocks) === JSON.stringify(normalizeDocumentContent(AI_TEKST).blocks));
const r1 = await voerExportUit({ formaat: 'docx', bouwModel: () => docModel });
const viaService = laatsteBlob;
const t1 = tekstUitXml(await docXml(origineel)).replace(/\d{1,2}-\d{1,2}-\d{4}/g, 'D');
const t2 = tekstUitXml(await docXml(viaService)).replace(/\d{1,2}-\d{1,2}-\d{4}/g, 'D');
ok('Word-inhoud identiek aan oorspronkelijke export', t1 === t2 && t1.length > 500, `${t1.length} tekens`);
ok('Word bestandsnaam', r1.bestandsnaam === 'Buurtkeuken_De_Brug_Projectplan.docx', r1.bestandsnaam);
fs.mkdirSync('tests/export/.build/out', { recursive: true });
fs.writeFileSync('tests/export/.build/out/out_document.docx', Buffer.from(await viaService.arrayBuffer()));

// ===== PDF
try {
  const r2 = await voerExportUit({ formaat: 'pdf', bouwModel: () => docModel });
  const buf = Buffer.from(await laatsteBlob.arrayBuffer());
  fs.writeFileSync('tests/export/.build/out/out_document.pdf', buf);
  ok('PDF gegenereerd', buf.slice(0, 5).toString() === '%PDF-', `${buf.length} bytes ${r2.bestandsnaam}`);
} catch (e) { ok('PDF gegenereerd', false, e.stack); }

// ===== EXCEL document + project + org + gesprek
import { dekkingVanProject } from '../../src/features/kompas-app/financiering/dekkingsplan.js';
// Financieringsregels zoals kompas_dekkingsplan() ze teruggeeft (regelUitRpc-vorm): de enige bron voor de export.
const REGELS = [
  { id: 'f1', bronType: 'financier', bronStatus: 'zichtbaar', naam: 'Gemeente Utrecht', status: 'awarded', awarded: 15000, requested: null },
  { id: 'f2', bronType: 'financier', bronStatus: 'zichtbaar', naam: 'Lokale ondernemer', status: 'interesting', awarded: null, requested: 2500 },
  { id: 'f3', bronType: 'regeling', bronStatus: 'zichtbaar', naam: 'Buurtbudget Utrecht', funder: 'Gemeente Utrecht', deadline: '2027-03-01', status: 'submitted', awarded: null, requested: 8000 },
];
const dekking = dekkingVanProject(PROJECT_A, REGELS);
const projModel = bouwProjectModel(PROJECT_A, { organisatieNaam: store.orgProfile.name, dekking, regels: REGELS });
const orgModel = bouwOrganisatieModel(PROFIEL, VELDEN);
const gesModel = bouwGesprekModel({ titel: 'Projectplan Buurtkeuken', berichten: BERICHTEN, projectNaam: PROJECT_A.naam, organisatieNaam: store.orgProfile.name });
for (const [naam, m] of [['document', docModel], ['project', projModel], ['organisatie', orgModel], ['gesprek', gesModel]]) {
  for (const f of ['xlsx', 'docx', 'pdf']) {
    if (naam === 'document' && f === 'docx') continue;
    const r = await voerExportUit({ formaat: f, bouwModel: () => m });
    const buf = Buffer.from(await laatsteBlob.arrayBuffer());
    fs.writeFileSync(`tests/export/.build/out/out_${naam}.${f}`, buf);
    ok(`${naam} ${f}`, buf.length > 1000, `${r.bestandsnaam} ${buf.length}B`);
  }
}

const lees = async (p) => { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(p); return wb; };
let wb = await lees('tests/export/.build/out/out_project.xlsx');
console.log('project sheets:', wb.worksheets.map((w) => w.name).join(' | '));
const fin = wb.getWorksheet('Financiering');
const finRijen = []; fin.eachRow((r, n) => { if (n >= 5) finRijen.push(r.values.slice(1)); });
console.log(JSON.stringify(finRijen));
ok('Financiering: bedragen numeriek', finRijen.every((r) => typeof r[1] === 'number'));
ok('Financiering: begroting 85000', finRijen[0][1] === 85000);
const finMap = Object.fromEntries(finRijen.map((r) => [r[0], r[1]]));
ok('Financiering: Te financieren = begroting - eigen bijdrage', finMap['Te financieren bedrag'] === 77500, JSON.stringify(finRijen));
ok('Financiering: Toegekend 15000 en Aangevraagd 8000 uit de financieringsregels (zelfde als dashboard)', finMap['Toegekend'] === 15000 && finMap['Aangevraagd'] === 8000, JSON.stringify(finRijen));
ok('Financiering: Nog te financieren = begroting - toegekend - aangevraagd - eigen', finMap['Nog te financieren'] === 85000 - 15000 - 8000 - 7500, JSON.stringify(finRijen));
ok('geen sheet Co-financiers/Eerdere aanvragen meer; wel Cofinanciers', !wb.getWorksheet('Co-financiers') && !wb.getWorksheet('Eerdere aanvragen') && !!wb.getWorksheet('Cofinanciers'));
const cof = wb.getWorksheet('Cofinanciers'); const cofR = []; cof.eachRow((r, n) => { if (n >= 5) cofR.push(r.values.slice(1)); });
ok('Cofinanciers numeriek (toegekend 15000)', typeof cofR[0][2] === 'number' && cofR[0][2] === 15000, JSON.stringify(cofR));
let alleTekst = ''; wb.eachSheet((ws) => ws.eachRow((r) => r.eachCell((c) => { alleTekst += String(c.value) + '\n'; })));
ok('geen data van ander project in project-Excel', !alleTekst.includes('GEHEIM'));
wb = await lees('tests/export/.build/out/out_gesprek.xlsx');
const g = wb.getWorksheet('Gesprek'); const gr = []; g.eachRow((r, n) => { if (n >= 4) gr.push(r.values.slice(1)); });
console.log(JSON.stringify(gr.map((r) => [r[0], r[1] instanceof Date ? r[1].toISOString() : r[1], r[2], r[3], String(r[4]).slice(0, 30)])));
ok('Gesprek: datum is Date, afzender+type', gr[1][1] instanceof Date && gr[1][2] === 'U' && gr[1][3] === 'Vraag' && gr[2][3] === 'Antwoord');
wb = await lees('tests/export/.build/out/out_document.xlsx');
console.log('document sheets:', wb.worksheets.map((w) => w.name).join(' | '));
const tb = wb.getWorksheet('Tabel 1'); const tr = []; tb.eachRow((r, n) => { if (n >= 5) tr.push(r.values.slice(1)); });
console.log(JSON.stringify(tr));
ok('Document-tabel: € 9.600,50 wordt getal', tr[1][2] === 9600.5 && tr[0][1] === 1 && tr[0][2] === 24000);
wb = await lees('tests/export/.build/out/out_organisatie.xlsx');
console.log('org sheets:', wb.worksheets.map((w) => w.name).join(' | '));
const o = wb.getWorksheet('Organisatieprofiel'); const orr = []; o.eachRow((r, n) => { if (n >= 5) orr.push(r.values.slice(1)); });
console.log(JSON.stringify(orr));
ok('Org: omzet numeriek', orr.some((r) => r[1] === 'Jaarlijkse omzet (€)' && r[2] === 240000));

// bestandsnamen
ok('bestandsnaam sanitize', bouwBestandsnaam(['A/B:C*?"<>|  naam', 'Organisatieprofiel'], 'pdf') === 'ABC_naam_Organisatieprofiel.pdf', bouwBestandsnaam(['A/B:C*?"<>|  naam', 'Organisatieprofiel'], 'pdf'));
ok('bestandsnaam leeg', bouwBestandsnaam(['', null], 'xlsx') === 'Subsidie_Kompas.xlsx');
ok('geen uuid in naam', !/[0-9a-f]{8}-[0-9a-f]{4}/.test(downloads.map((d) => d.naam).join()));
console.log(downloads.map((d) => d.naam).join('\n'));
const fails = res.filter((r) => !r[1]);
console.log(`\n${res.length - fails.length}/${res.length} geslaagd`);
process.exit(fails.length ? 1 : 0);
