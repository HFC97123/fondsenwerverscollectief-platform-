import JSZip from 'jszip';
import { check, gelijk, sectie, klaar } from '../verificatie/hulp.mjs';
import { HUISSTIJL_VERSIE, bouwHuisstijlThema, isDonker, mengMetWit, normaliseerHuisstijl, pasLogoMaten, themaVoorExport } from '../../src/shared/document-theme/huisstijl.js';
import { SubsidieKompasTheme } from '../../src/shared/document-theme/index.js';
import { generateWordDocument } from '../../src/shared/document-theme/generateWordDocument.js';
import { generatePdfDocument } from '../../src/shared/export/generatePdfDocument.js';
import { generateStructuredExcel } from '../../src/shared/export/generateStructuredExcel.js';
import { bouwDocumentModel } from '../../src/shared/export/exportModel.js';
import * as client from '../checkout-frontend/fake-client.js';
import { bewaarHuisstijl, haalHuisstijl, verkleinLogo } from '../../src/data/services/huisstijl.js';

// Een echt, klein PNG-logo (1x1 rood) als data-URL.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
const H = { naam: 'Stichting Voorbeeld', primair: '#7a1f3d', accent: '#d98a00', logo: PNG, logoBreedte: 400, logoHoogte: 100 };

sectie('1. Schoonmaken van de huisstijl');
{
  gelijk('niets bruikbaars -> null (dus de Subsidie Kompas-huisstijl)', [normaliseerHuisstijl(null), normaliseerHuisstijl({}), normaliseerHuisstijl([]), normaliseerHuisstijl({ primair: 'rood', logo: 'http://x/y.png' })], [null, null, null, null]);
  const n = normaliseerHuisstijl(H);
  check('kleuren worden hoofdletters, versie staat erin', n.primair === '#7A1F3D' && n.accent === '#D98A00' && n.versie === HUISSTIJL_VERSIE && n.naam === 'Stichting Voorbeeld');
  check('het logo wordt in een vak van 180 bij 48 px gezet met behoud van de verhouding', n.logoBreedte === 180 && n.logoHoogte === 45, `${n.logoBreedte}x${n.logoHoogte}`);
  gelijk('pasLogoMaten: een klein logo wordt niet vergroot', pasLogoMaten(40, 20), { breedte: 40, hoogte: 20 });
  check('alleen een naam is al een huisstijl; de kleuren vallen terug op Subsidie Kompas', (() => { const x = normaliseerHuisstijl({ naam: 'Alleen naam' }); return x.primair === SubsidieKompasTheme.colors.primary && x.accent === SubsidieKompasTheme.colors.accent && x.logo === ''; })());
  check('een logo dat geen PNG- of JPG-data-URL is, of te groot, valt weg', normaliseerHuisstijl({ naam: 'x', logo: 'data:image/svg+xml;base64,AAAA' }).logo === '' && normaliseerHuisstijl({ naam: 'x', logo: `data:image/png;base64,${'A'.repeat(260000)}` }).logo === '');
  check('de naam wordt ingekort en schoongemaakt', normaliseerHuisstijl({ naam: `  ${'a'.repeat(200)}  ` }).naam.length === 80);
  check('kleurhulpen: wit mengen en donker/licht', mengMetWit('#000000', 1) === '#FFFFFF' && mengMetWit('#2C4A5E', 0) === '#2C4A5E' && isDonker('#2C4A5E') && !isDonker('#FFF2A6'));
}

sectie('2. Het thema');
{
  const t = bouwHuisstijlThema(H);
  check('de kleuren, de naam en het logo komen uit de huisstijl', t.colors.primary === '#7A1F3D' && t.colors.accent === '#D98A00' && t.colors.tableHeaderBg === '#7A1F3D' && t.branding.organizationName === 'Stichting Voorbeeld' && t.branding.footerLabel === 'Stichting Voorbeeld' && t.branding.logo.path === PNG);
  check('lettertype, maten en marges blijven die van Subsidie Kompas', t.fonts.body === 'Arial' && t.layout.marginLeftMm === 25 && t.typography.bodySize === 22);
  check('het thema is bevroren en het Subsidie Kompas-thema is niet aangepast', Object.isFrozen(t.colors) && SubsidieKompasTheme.colors.primary === '#2C4A5E' && SubsidieKompasTheme.branding.footerLabel === 'Subsidie Kompas');
  check('zonder huisstijl: het Subsidie Kompas-thema zelf', bouwHuisstijlThema(null) === SubsidieKompasTheme);
  check('Pro krijgt altijd de Subsidie Kompas-huisstijl, ook met een eigen huisstijl in de database', themaVoorExport({ premium: false, huisstijl: H }) === SubsidieKompasTheme);
  check('Premium met een eigen huisstijl krijgt die; zonder eigen huisstijl de Subsidie Kompas-huisstijl', themaVoorExport({ premium: true, huisstijl: H }).name === 'eigen' && themaVoorExport({ premium: true, huisstijl: null }) === SubsidieKompasTheme);
}

sectie('3. Word, PDF en Excel met de eigen huisstijl');
{
  const model = bouwDocumentModel({ tekst: '# Projectplan\n\n## Aanleiding\n\nKinderen in Rotterdam-Zuid sporten te weinig.\n\n- punt een\n- punt twee', soort: 'Projectplan', organisatieNaam: 'Stichting Voorbeeld', projectNaam: 'Samen Spelen', titel: 'Projectplan Samen Spelen' });
  const kern = { title: model.titel, documentType: model.documentType, organizationName: 'Stichting Voorbeeld', content: { blocks: model.blocks } };
  const eigen = bouwHuisstijlThema(H);

  const woordEigen = await generateWordDocument({ ...kern, theme: eigen });
  const woordStandaard = await generateWordDocument({ ...kern });
  const zipEigen = await JSZip.loadAsync(await woordEigen.arrayBuffer());
  const zipStd = await JSZip.loadAsync(await woordStandaard.arrayBuffer());
  const xmlEigen = (await Promise.all(Object.keys(zipEigen.files).filter((f) => /^word\/(document|footer\d*)\.xml$/.test(f)).map((f) => zipEigen.file(f).async('string')))).join('');
  const xmlStd = await zipStd.file('word/document.xml').async('string');
  const mediaEigen = Object.keys(zipEigen.files).filter((f) => f.startsWith('word/media/'));

  check('Word: de eigen kleur staat in het document en niet de Subsidie Kompas-kleur', xmlEigen.includes('7A1F3D') && !xmlEigen.includes('2C4A5E'));
  check('Word: zonder eigen thema blijft het Subsidie Kompas-blauw', xmlStd.includes('2C4A5E') && !xmlStd.includes('7A1F3D'));
  check('Word: de naam staat in de voettekst en het logo is ingesloten', xmlEigen.includes('Stichting Voorbeeld') && mediaEigen.length >= 1, mediaEigen.join(','));

  const pdf = Buffer.from(await (await generatePdfDocument({ ...kern, theme: eigen })).arrayBuffer());

  check('PDF: een geldig PDF-bestand met de eigen huisstijl', pdf.subarray(0, 5).toString() === '%PDF-' && pdf.length > 1000);

  const exModel = { titel: 'Test', bestandsDelen: ['Test'], sheets: [{ naam: 'Overzicht', kolommen: [{ kop: 'Onderdeel', sleutel: 'onderdeel', breedte: 20 }], rijen: [{ onderdeel: 'x' }] }], themeName: undefined };
  const xl = await generateStructuredExcel(bouwDocumentModel({ tekst: '# T\n\n## A\n\ntekst', soort: 'Projectplan' }), { theme: eigen });
  const zipX = await JSZip.loadAsync(await xl.arrayBuffer());
  const stijlen = await zipX.file('xl/styles.xml').async('string');

  check('Excel: de kleuren van de eigen huisstijl staan in de opmaak', /7A1F3D/i.test(stijlen) && !/2C4A5E/i.test(stijlen), stijlen.slice(0, 80));
}

sectie('4. Opslag');
{
  const rij = { id: 'o1', user_id: 'u1', document_huisstijl: null };
  let laatste = null;
  const sup = {
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: () => {
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => ({ data: rij.id ? { id: rij.id, document_huisstijl: rij.document_huisstijl } : null, error: null }),
        update: (w) => { laatste = w; Object.assign(rij, w); return q; },
        insert: async (w) => { laatste = w; rij.id = 'nieuw'; Object.assign(rij, w); return { error: null }; },
        then: (ok) => ok({ error: null }),
      };

      return q;
    },
  };

  client.__reset();
  client.__zetSupabase(sup);

  check('nog geen huisstijl: null', (await haalHuisstijl()) === null);
  const r = await bewaarHuisstijl(H);
  check('bewaren schrijft het schone object naar de organisatie', r.ok && laatste.document_huisstijl.primair === '#7A1F3D' && laatste.document_huisstijl.logo === PNG);
  const g = await haalHuisstijl();
  check('teruglezen geeft dezelfde huisstijl', g && g.naam === 'Stichting Voorbeeld' && g.accent === '#D98A00');
  check('een ongeldige huisstijl wordt geweigerd', (await bewaarHuisstijl({ primair: 'nee' })).reden === 'ongeldig');
  const w = await bewaarHuisstijl(null);
  check('terug naar de Subsidie Kompas-huisstijl wist het object', w.ok && laatste.document_huisstijl === null && (await haalHuisstijl()) === null);

  client.__zetSupabase(null);
  check('zonder sessie: niets te lezen, bewaren meldt geen-sessie', (await haalHuisstijl()) === null && (await bewaarHuisstijl(H)).reden === 'geen-sessie');
}

sectie('5. Logo verkleinen');
{
  const bestand = (type, size = 1000) => ({ type, size });
  const naarUrl = async () => PNG;
  const Afb = class { set src(v) { this.width = 1200; this.height = 600; setTimeout(() => this.onload(), 0); } };
  const canvas = () => ({ width: 0, height: 0, getContext: () => ({ drawImage() {} }), toDataURL() { return PNG; } });

  check('een ander bestandstype wordt geweigerd', (await verkleinLogo(bestand('image/svg+xml'), { Afbeelding: Afb, maakCanvas: canvas, leesAlsUrl: naarUrl })).fout.includes('PNG'));
  check('een te groot bestand wordt geweigerd', (await verkleinLogo(bestand('image/png', 6 * 1024 * 1024), { Afbeelding: Afb, maakCanvas: canvas, leesAlsUrl: naarUrl })).fout.includes('te groot'));
  const ok = await verkleinLogo(bestand('image/png'), { Afbeelding: Afb, maakCanvas: canvas, leesAlsUrl: naarUrl });
  check('een logo van 1200 bij 600 wordt 600 bij 300 -> in het voorblad 96 bij 48', ok.logo === PNG && ok.logoBreedte === 96 && ok.logoHoogte === 48, JSON.stringify(ok));
  check('een afbeelding die niet te laden is geeft een nette melding', (await verkleinLogo(bestand('image/png'), { Afbeelding: class { set src(v) { setTimeout(() => this.onerror(), 0); } }, maakCanvas: canvas, leesAlsUrl: naarUrl })).fout.includes('gelezen'));
}

klaar('huisstijl');
