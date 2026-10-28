import JSZip from 'jszip';
import { check, gelijk, sectie, klaar } from '../verificatie/hulp.mjs';
import * as client from '../checkout-frontend/fake-client.js';
import { DEFINITIEF_SOORTEN, haalDefinitieveDocumenten, haalDefinitiefDocument, maakDefinitief, verwijderDefinitief } from '../../src/data/services/definitieveDocumenten.js';
import { DEFINITIEF_NAAM, begrotingMomentopname, definitieveDocsVoorLijst, definitiefSoortVan, planMomentopname } from '../../src/features/kompas-app/aanvraag/aanvraagModel.js';
import { maakBegrotingExcel } from '../../src/features/kompas-app/begroting/begrotingExport.js';
import { bouwHuisstijlThema } from '../../src/shared/document-theme/huisstijl.js';
import { nieuweRegel } from '../../src/features/kompas-app/begroting/begrotingModel.js';
import { neutraalThema, themaVoorKeuze, themaVoorExport } from '../../src/shared/document-theme/huisstijl.js';
import { SubsidieKompasTheme } from '../../src/shared/document-theme/index.js';
import { generateWordDocument } from '../../src/shared/document-theme/generateWordDocument.js';
import { generatePdfDocument } from '../../src/shared/export/generatePdfDocument.js';
import { SAMENGEVOEGD_NAAM, begrotingBlokken, bouwSamengevoegdModel, dekkingsplanBlokken, samengevoegdMomentopname } from '../../src/features/kompas-app/aanvraag/samengevoegd.js';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

sectie('1. Het model: wat definitief kan worden en hoe de regels heten');
{
  gelijk('alleen plan, begroting en dekkingsplan kunnen definitief; een concept voor een fonds niet', [definitiefSoortVan({ gegenereerd: 'plan' }), definitiefSoortVan({ gegenereerd: 'begroting' }), definitiefSoortVan({ gegenereerd: 'dekking' }), definitiefSoortVan({ gegenereerd: 'fonds' }), definitiefSoortVan(null)], ['projectplan', 'begroting', 'dekkingsplan', null, null]);
  const rijen = [
    { id: 'a', projectId: 'p1', soort: 'projectplan', versie: 2, gemaakt: '2026-10-28T10:00:00Z' },
    { id: 'b', projectId: 'p1', soort: 'dekkingsplan', versie: 1, gemaakt: '2026-10-27T10:00:00Z' },
    { id: 'c', projectId: 'weg', soort: 'begroting', versie: 1, gemaakt: '' },
    { id: 'd', projectId: 'p1', soort: 'onzin', versie: 1, gemaakt: '' },
  ];
  const l = definitieveDocsVoorLijst(rijen, [{ id: 'p1', naam: 'Samen Spelen' }]);

  check('rijen van onbekende projecten of soorten vallen weg', l.length === 2);
  check('de naam is Projectplan en Dekkingsplan, zonder Concept, en de regel is definitief', l[0].naam === 'Projectplan' && l[1].naam === 'Dekkingsplan' && l.every((x) => x.definitief && !x.concept && x.gegenereerd === 'definitief'));
  check('soort voor het filter, versie, datum en projectnaam kloppen', l[0].soort === 'Projectplan' && l[1].soort === 'Concept-dekkingsplan' && l[0].versie === 2 && l[0].datum === '2026-10-28T10:00:00Z' && l[0].projectNaam === 'Samen Spelen' && l[0].id === 'def-a');
  gelijk('de namen op het scherm', DEFINITIEF_NAAM, { projectplan: 'Projectplan', begroting: 'Begroting', dekkingsplan: 'Dekkingsplan', samengevoegd: 'Projectplan met begroting en dekkingsplan' });
  const m = begrotingMomentopname({ soort: 'begroting', project: { id: 'p1', naam: 'X', docs: [{ tekst: 'groot' }], budgetRegels: [] }, finRegels: [{ id: 1 }] });
  check('de kopie van een begroting bevat het project zonder zijn documenten en de financieringsregels', m.type === 'begroting' && m.project.id === 'p1' && !('docs' in m.project) && m.finRegels.length === 1);
  check('de kopie van een plan bevat het plan en de projectnaam', planMomentopname({ plan: { secties: [] }, projectNaam: 'X' }).plan.secties.length === 0);
}

sectie('2. De opslag');
{
  const rijen = [];
  let n = 0;
  let sessie = 'u1';
  let fout = null;
  const keten = (st) => {
    const q = {
      select: () => q,
      insert: (r) => { st.insert = r; return q; },
      delete: () => { st.del = true; return q; },
      eq: (k, v) => { st.f.push([k, v]); return q; },
      in: (k, v) => { st.f.push([k, v, true]); return q; },
      order: async () => ({ data: rijen.filter((r) => st.f.every(([k, v, i]) => (i ? v.includes(r[k]) : r[k] === v))), error: null }),
      single: async () => { if (fout) return { data: null, error: fout }; const r = { ...st.insert, id: `d${++n}`, versie: n, created_at: 'nu' }; rijen.push(r); return { data: { id: r.id, versie: r.versie }, error: null }; },
      maybeSingle: async () => ({ data: rijen.find((r) => st.f.every(([k, v]) => r[k] === v)) || null, error: null }),
      then: (ok) => { for (const r of rijen.filter((x) => st.f.every(([k, v]) => x[k] === v))) rijen.splice(rijen.indexOf(r), 1); return Promise.resolve({ error: null }).then(ok); },
    };

    return q;
  };

  client.__zetSupabase({ auth: { getUser: async () => ({ data: { user: sessie ? { id: sessie } : null } }) }, from: () => keten({ f: [] }) });

  gelijk('de soorten', DEFINITIEF_SOORTEN, ['projectplan', 'begroting', 'dekkingsplan', 'samengevoegd']);
  check('onbekende soort of lege inhoud wordt geweigerd, zonder iets te schrijven', (await maakDefinitief({ projectId: 'p1', soort: 'brief', inhoud: {} })).reden === 'ongeldig' && (await maakDefinitief({ projectId: 'p1', soort: 'begroting', inhoud: null })).reden === 'ongeldig' && (await maakDefinitief({ projectId: '', soort: 'begroting', inhoud: {} })).reden === 'ongeldig' && rijen.length === 0);
  const r = await maakDefinitief({ projectId: 'p1', soort: 'projectplan', naam: 'x'.repeat(300), inhoud: { type: 'projectplan', plan: { secties: [] } } });

  check('bewaren geeft id en versie en schrijft het eigen user_id, met een ingekorte naam', r.ok && r.id === 'd1' && rijen[0].user_id === 'u1' && rijen[0].naam.length === 160);
  const lijst = await haalDefinitieveDocumenten(['p1', 'p2', '']);

  check('de lijst heeft geen inhoud, wel projectId en versie', lijst.length === 1 && lijst[0].projectId === 'p1' && !('inhoud' in lijst[0]));
  check('één document komt met zijn inhoud terug', (await haalDefinitiefDocument('d1')).inhoud.type === 'projectplan' && (await haalDefinitiefDocument('nietbestaand')) === null);
  fout = { code: '42501' };
  check('de database weigert (geen Pro/Premium) -> niet-toegestaan', (await maakDefinitief({ projectId: 'p1', soort: 'begroting', inhoud: { a: 1 } })).reden === 'niet-toegestaan');
  fout = { code: 'XX' };
  check('een andere fout -> fout', (await maakDefinitief({ projectId: 'p1', soort: 'begroting', inhoud: { a: 1 } })).reden === 'fout');
  fout = null;
  check('verwijderen haalt alleen dat document weg', (await verwijderDefinitief('d1')).ok === true && rijen.length === 0);
  client.__zetSupabase({ auth: { getUser: async () => ({ data: { user: null } }) }, from: () => keten({ f: [] }) });
  check('zonder sessie: lege lijst, geen document, geen bewaren', (await haalDefinitieveDocumenten(['p1'])).length === 0 && (await haalDefinitiefDocument('d1')) === null && (await maakDefinitief({ projectId: 'p1', soort: 'begroting', inhoud: { a: 1 } })).reden === 'geen-sessie');
}

sectie('3. De Excel van begroting en dekkingsplan, in de huisstijl');
{
  const regels = [nieuweRegel('', { omschrijving: 'Coördinator', aantal: '10', eenheid: 'uur', tarief: '50' }), nieuweRegel('', { omschrijving: 'Materiaal', bedrag: '300' })];
  const project = { id: 'p1', naam: 'Samen Spelen', budgetRegels: regels.map((r) => ({ ...r })) };
  const fin = [{ id: 'f1', naam: 'Fonds Test', status: 'submitted', requested: 400, awarded: null }];
  const sk = await maakBegrotingExcel({ project, finRegels: fin, organisatieNaam: 'Stichting' });

  check('een Excel-bestand met de bestandsnaam van het project', sk.bestandsnaam === 'Begroting - Samen Spelen.xlsx' && sk.blob.size > 2000);
  const eigen = bouwHuisstijlThema({ naam: 'Eigen Stichting', primair: '#7a1f3d', accent: '#d98a00', logo: PNG, logoBreedte: 100, logoHoogte: 25 });
  const ei = await maakBegrotingExcel({ project, finRegels: fin, organisatieNaam: 'Stichting', theme: eigen });
  const stijl = async (b) => { const z = await JSZip.loadAsync(Buffer.from(await b.arrayBuffer())); return (await z.file('xl/styles.xml').async('string')); };

  check('Subsidie Kompas-huisstijl: de Kompas-kleur staat in de opmaak', /2C4A5E/i.test(await stijl(sk.blob)));
  check('eigen huisstijl: de eigen kleur staat in de opmaak en de Kompas-kleur niet', /7A1F3D/i.test(await stijl(ei.blob)) && !/2C4A5E/i.test(await stijl(ei.blob)));
  const zonderFin = await maakBegrotingExcel({ project, finRegels: null });

  check('zonder financieringsregels lukt de begroting ook', zonderFin.blob.size > 2000);
}

sectie('4. Eén samengevoegd document: projectplan met begroting en dekkingsplan als bijlagen');
{
  const plan = { secties: [
    { id: 'a', titel: 'Aanleiding', tekst: 'In de wijk zijn weinig plekken om veilig te spelen.', vraag: 'Waarom dit project?', status: 'geschreven', aantalAanvullen: 0 },
    { id: 'b', titel: 'Doelgroep', tekst: 'Kinderen van 6 tot 12 jaar. [aanvullen: aantal kinderen]', vraag: 'Voor wie?', status: 'aanvullen', aantalAanvullen: 1 },
  ] };
  const regels = [nieuweRegel('uitvoering', { omschrijving: 'Coördinator', aantal: '10', eenheid: 'uur', tarief: '50' }), nieuweRegel('activa', { omschrijving: 'Materiaal', bedrag: '300', schatting: true }), nieuweRegel('activa', { omschrijving: 'Verzekering' })];
  const project = { id: 'p1', naam: 'Samen Spelen', eigenBijdrage: '200', budgetRegels: regels.map((r) => ({ ...r })), docs: [{ tekst: 'groot' }] };
  const fin = [{ id: 'f1', naam: 'Fonds Test', status: 'submitted', requested: 400, awarded: null }, { id: 'f2', naam: 'Stichting Twee', status: 'awarded', requested: 100, awarded: 100 }];
  const m = samengevoegdMomentopname({ plan, project, finRegels: fin, projectNaam: 'Samen Spelen' });

  check('de momentopname bevat plan, project zonder documenten en financieringsregels', m.type === 'samengevoegd' && m.plan.secties.length === 2 && !('docs' in m.project) && m.finRegels.length === 2 && m.projectNaam === 'Samen Spelen');
  gelijk('de naam op het scherm', SAMENGEVOEGD_NAAM, 'Projectplan met begroting en dekkingsplan');
  check('het is een definitief soort dat de lijst herkent', DEFINITIEF_SOORTEN.includes('samengevoegd') && definitieveDocsVoorLijst([{ id: 'x', projectId: 'p1', soort: 'samengevoegd', versie: 1, gemaakt: '' }], [{ id: 'p1', naam: 'Samen Spelen' }])[0].naam === SAMENGEVOEGD_NAAM);

  const model = bouwSamengevoegdModel({ inhoud: m, organisatieNaam: 'Stichting' });
  const koppen = model.blocks.filter((b) => b.type === 'heading' && b.level === 1).map((b) => b.text);
  const teksten = JSON.stringify(model.blocks);

  check('eerst het plan, daarna Bijlage 1: Begroting en Bijlage 2: Dekkingsplan, in die volgorde', koppen.length >= 3 && koppen.indexOf('Bijlage 1: Begroting') > 0 && koppen.indexOf('Bijlage 2: Dekkingsplan') > koppen.indexOf('Bijlage 1: Begroting'));
  check('de aanleiding en de doelgroep uit het plan staan erin, inclusief de [aanvullen]-markering', /veilig te spelen/.test(teksten) && /\[aanvullen: aantal kinderen\]/.test(teksten));
  check('elke bijlage begint op een nieuwe pagina', model.blocks.filter((b) => b.type === 'pagebreak').length === 2 && model.blocks[model.blocks.findIndex((b) => b.text === 'Bijlage 1: Begroting') - 1].type === 'pagebreak' && model.blocks[model.blocks.findIndex((b) => b.text === 'Bijlage 2: Dekkingsplan') - 1].type === 'pagebreak');
  const bg = begrotingBlokken(project);
  const tabellen = bg.filter((b) => b.type === 'table');

  check('de begroting heeft een tabel per kopje met subtotaal en een totaaltabel', tabellen.length === 3 && tabellen[0].rows.at(-1)[0] === 'Subtotaal');
  check('uur x tarief = bedrag: 10 x 50 = € 500', tabellen[0].rows[0][4] === '€ 500');
  check('een schatting wordt zo genoemd en een regel zonder bedrag is "nog in te vullen"', /Materiaal \(schatting\)/.test(JSON.stringify(tabellen[1])) && /nog in te vullen/.test(JSON.stringify(tabellen[1])));
  check('totaal, eigen bijdrage en te financieren kloppen: 800, 200, 600', JSON.stringify(tabellen[2].rows) === JSON.stringify([['Totale kosten', '€ 800'], ['Eigen bijdrage', '€ 200'], ['Te financieren', '€ 600']]));
  check('het aantal schattingen wordt gemeld', bg.some((b) => b.type === 'paragraph' && /een bedrag is nog een schatting/.test(b.text)));
  const dk = dekkingsplanBlokken(project, fin);

  check('het dekkingsplan toont het overzicht en per fonds de status, aangevraagd en toegekend', dk.filter((b) => b.type === 'table').length === 2 && /Fonds Test/.test(JSON.stringify(dk)) && /Aangevraagd/.test(JSON.stringify(dk)) && /Toegekend/.test(JSON.stringify(dk)));
  check('de bedragen in het dekkingsplan passen bij de begroting (800)', /€ 800/.test(JSON.stringify(dk[1])));
  check('zonder begroting en zonder fondsen: eerlijke zinnen, geen lege tabellen', begrotingBlokken({ budgetRegels: [] }).some((b) => /nog geen begrotingsregels/.test(b.text || '')) && dekkingsplanBlokken({ budgetRegels: [] }, []).some((b) => /nog geen fondsen/.test(b.text || '')));
  check('zonder plan krijgt het document alleen de bijlagen en breekt niets', bouwSamengevoegdModel({ inhoud: { ...m, plan: null } }).blocks.some((b) => b.text === 'Bijlage 1: Begroting'));
  check('de bestandsnaam bevat het project en het soort document', /Samen Spelen/.test(model.bestandsDelen.join(' ')) && /Projectplan met begroting en dekkingsplan/.test(model.bestandsDelen.join(' ')));

  // Huisstijl: Pro altijd Subsidie Kompas; Premium kiest
  const eigen = { naam: 'Eigen Stichting', primair: '#7a1f3d', accent: '#d98a00', logo: PNG, logoBreedte: 100, logoHoogte: 25 };

  check('Pro: altijd de Subsidie Kompas-huisstijl, wat er ook gekozen is', ['geen', 'eigen', 'standaard', undefined].every((k) => themaVoorKeuze({ premium: false, huisstijl: eigen, keuze: k }) === SubsidieKompasTheme));
  check('Premium kiest "Subsidie Kompas": die huisstijl, ook met een eigen huisstijl', themaVoorKeuze({ premium: true, huisstijl: eigen, keuze: 'standaard' }) === SubsidieKompasTheme);
  check('Premium kiest "geen huisstijl": het neutrale thema zonder logo en zonder Subsidie Kompas', (() => { const t = themaVoorKeuze({ premium: true, huisstijl: eigen, keuze: 'geen' }); return t.name === 'neutraal' && t.branding.logo.path === '' && t.branding.footerLabel === '' && t.branding.organizationName === '' && !/2C4A5E|4E9A6C/i.test(JSON.stringify(t.colors)); })());
  check('Premium kiest "eigen": de eigen kleuren en naam', (() => { const t = themaVoorKeuze({ premium: true, huisstijl: eigen, keuze: 'eigen' }); return t.colors.primary === '#7A1F3D' && t.branding.footerLabel === 'Eigen Stichting'; })());
  check('Premium kiest "eigen" zonder eigen huisstijl: terug naar Subsidie Kompas', themaVoorKeuze({ premium: true, huisstijl: null, keuze: 'eigen' }) === SubsidieKompasTheme);
  check('zonder keuze: zoals voorheen (eigen als die er is)', themaVoorKeuze({ premium: true, huisstijl: eigen }).colors.primary === themaVoorExport({ premium: true, huisstijl: eigen }).colors.primary);
  check('het neutrale thema is bevroren en geldig (alle verplichte velden)', Object.isFrozen(neutraalThema()) && neutraalThema().fonts.body === 'Arial');

  // Echte bestanden
  const xml = async (blob) => (await JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()))).file('word/document.xml').async('string');
  const voet = async (blob) => { const z = await JSZip.loadAsync(Buffer.from(await blob.arrayBuffer())); const f = Object.keys(z.files).find((n) => /word\/footer\d*\.xml$/.test(n)); return f ? z.file(f).async('string') : ''; };
  const kern = (thema) => ({ title: model.titel, documentType: model.documentType, organizationName: model.organisatieNaam, content: { blocks: model.blocks }, ...(thema ? { theme: thema } : {}) });
  const wSk = await generateWordDocument(kern(SubsidieKompasTheme));
  const wGeen = await generateWordDocument(kern(neutraalThema()));
  const wEigen = await generateWordDocument(kern(themaVoorKeuze({ premium: true, huisstijl: eigen, keuze: 'eigen' })));

  check('Word: de bijlagen en het plan staan in één bestand, met paginawissels', (async () => 1) && /Bijlage 1: Begroting/.test(await xml(wSk)) && /Bijlage 2: Dekkingsplan/.test(await xml(wSk)) && /veilig te spelen/.test(await xml(wSk)) && (await xml(wSk)).split('w:type="page"').length - 1 >= 2);
  check('Word met Subsidie Kompas: de Kompas-kleur en de naam in de voettekst', /2C4A5E/i.test(await xml(wSk)) && /Subsidie Kompas/.test(await voet(wSk)));
  check('Word zonder huisstijl: geen Kompas-kleuren, geen Subsidie Kompas in de voettekst, wel het documenttype', !/2C4A5E|4E9A6C/i.test(await xml(wGeen)) && !/Subsidie Kompas/.test(await voet(wGeen)) && /Projectplan met bijlagen/.test(await voet(wGeen)));
  check('Word in eigen huisstijl: de eigen kleur en naam', /7A1F3D/i.test(await xml(wEigen)) && /Eigen Stichting/.test(await voet(wEigen)));
  check('de drie Word-bestanden verschillen', new Set([await xml(wSk), await xml(wGeen), await xml(wEigen)]).size === 3);

  const pdf = await generatePdfDocument(kern(SubsidieKompasTheme));
  const pdfGeen = await generatePdfDocument(kern(neutraalThema()));
  const bytes = Buffer.from(await pdf.arrayBuffer()).toString('latin1');
  const paginas = (b) => (b.match(/\/Type\s*\/Page[^s]/g) || []).length;

  check('PDF: een echt PDF-bestand met meerdere pagina’s (plan en bijlagen)', bytes.startsWith('%PDF') && paginas(bytes) >= 3, `pagina's: ${paginas(bytes)}`);
  check('PDF zonder huisstijl lukt ook en is geen kopie van die met huisstijl', Buffer.from(await pdfGeen.arrayBuffer()).toString('latin1').startsWith('%PDF') && pdfGeen.size !== pdf.size);
}

klaar('definitief');
