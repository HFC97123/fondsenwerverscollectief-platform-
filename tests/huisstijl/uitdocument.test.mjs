// Huisstijl uit een document halen: kleuren en logo uit Word, Excel, PDF-pagina's en afbeeldingen, zonder AI.
import JSZip from 'jszip';
import { isMerkkleur, kleurenUitOffice, kleurenUitPixels, leesHuisstijlUitBestand, logoVakUitPixels } from '../../src/features/kompas-app/huisstijlUitDocument.js';

const stand = { ok: 0, fout: 0 };
const check = (naam, waar) => { if (waar) stand.ok += 1; else { stand.fout += 1; console.log(`  FAIL: ${naam}`); } };
const sectie = (t) => console.log(`\n== ${t}`);

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');
const groot = Buffer.concat([PNG, Buffer.alloc(3000, 1)]);

sectie('1. Welke kleuren tellen als merkkleur');
check('wit, zwart en grijs niet', !isMerkkleur('FFFFFF') && !isMerkkleur('000000') && !isMerkkleur('808080') && !isMerkkleur('D9D9D9'));
check('een heldere kleur wel', isMerkkleur('C8102E') && isMerkkleur('1F6FB2'));
check('te licht of te donker niet', !isMerkkleur('FFF2F2') && !isMerkkleur('0A0A14'));

sectie('2. Kleuren uit Office-XML: gebruikte kleuren gaan voor het thema');
{
  const doc = '<w:r><w:rPr><w:color w:val="C8102E"/></w:rPr></w:r><w:r><w:rPr><w:color w:val="C8102E"/></w:rPr></w:r><w:shd w:fill="1F6FB2"/><w:color w:val="000000"/><w:shd w:fill="FFFFFF"/>';
  const thema = '<a:accent1><a:srgbClr val="00A19A"/></a:accent1><a:accent2><a:srgbClr val="C9262E"/></a:accent2>';
  const k = kleurenUitOffice({ documentXml: [doc], themaXml: thema });

  check('de meest gebruikte kleur staat vooraan en wit en zwart ontbreken', k[0] === '#C8102E' && k[1] === '#1F6FB2' && !k.includes('#000000') && !k.includes('#FFFFFF'));
  check('kleuren die op elkaar lijken tellen als één', !(k.includes('#C8102E') && k.includes('#C9262E')));
  check('zonder gebruikte kleuren geeft het thema de kleuren', kleurenUitOffice({ documentXml: [''], themaXml: thema })[0] === '#00A19A');
  check('niets gevonden geeft een lege lijst', kleurenUitOffice({ documentXml: [''], themaXml: '' }).length === 0);
}

sectie('3. Kleuren en logovak uit pixels');
{
  const b = 100; const h = 100; const d = new Uint8ClampedArray(b * h * 4).fill(255);
  const zet = (x, y, r, g, bl) => { const i = (y * b + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = bl; d[i + 3] = 255; };

  for (let y = 2; y < 20; y += 1) for (let x = 6; x < 36; x += 1) zet(x, y, 200, 16, 46);
  for (let y = 50; y < 90; y += 1) for (let x = 10; x < 90; x += 1) zet(x, y, 31, 111, 178);

  const k = kleurenUitPixels(d, b, h, 1);

  check('de twee kleuren worden gevonden, de grootste vlak eerst', k.length >= 2 && /^#(1[0-9A-F]|2[0-9A-F])/.test(k[0]) && k.length <= 4);

  const vak = logoVakUitPixels(d, b, h);

  check('het logovak ligt bovenaan en omsluit het gekleurde blok', !!vak && vak.x <= 6 && vak.y <= 2 && vak.b >= 30 && vak.y + vak.h <= 26);
  check('een pagina zonder iets bovenaan geeft geen logo', logoVakUitPixels(new Uint8ClampedArray(b * h * 4).fill(255), b, h) === null);

  const kop = new Uint8ClampedArray(b * h * 4).fill(255);

  for (let x = 2; x < 98; x += 1) for (let y = 5; y < 15; y += 1) { const i = (y * b + x) * 4; kop[i] = 20; kop[i + 1] = 20; kop[i + 2] = 20; }

  check('een kop over de hele breedte is geen logo', logoVakUitPixels(kop, b, h) === null);
}

sectie('4. Een Word-bestand: kleuren uit de tekst, logo uit de koptekst');
{
  const zip = new JSZip();

  zip.file('word/document.xml', '<w:document><w:color w:val="C8102E"/><w:color w:val="C8102E"/><w:shd w:fill="1F6FB2"/></w:document>');
  zip.file('word/styles.xml', '<w:styles/>');
  zip.file('word/theme/theme1.xml', '<a:accent1><a:srgbClr val="00A19A"/></a:accent1>');
  zip.file('word/header1.xml', '<w:hdr/>');
  zip.file('word/_rels/header1.xml.rels', '<Relationships><Relationship Id="rId1" Target="media/logo.png"/></Relationships>');
  zip.file('word/media/logo.png', PNG);
  zip.file('word/media/plaatje.png', groot);

  const bytes = await zip.generateAsync({ type: 'uint8array' });
  const f = new File([bytes], 'brief.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const gelezen = [];
  const r = await leesHuisstijlUitBestand(f, { verkleinLogo: async (bestand) => { gelezen.push(bestand.name); return { logo: 'data:image/png;base64,AAAA', logoBreedte: 10, logoHoogte: 5 }; } });

  check('de kleuren komen uit de tekst en de vlakken', r.bron === 'word' && r.kleuren[0] === '#C8102E' && r.kleuren[1] === '#1F6FB2');
  check('het logo komt uit de koptekst, niet het grootste plaatje', gelezen[0] === 'logo.png' && !!r.logo && r.logo.logoBreedte === 10);
}

sectie('5. Een Excel-bestand zonder afbeeldingen: alleen kleuren; het grootste plaatje als logo zonder koptekst');
{
  const zip = new JSZip();

  zip.file('xl/styles.xml', '<styleSheet><fgColor rgb="FF1F6FB2"/><fgColor rgb="FF1F6FB2"/><fgColor rgb="FFFFFFFF"/></styleSheet>');
  zip.file('xl/theme/theme1.xml', '<a:accent1><a:srgbClr val="00A19A"/></a:accent1>');

  const f1 = new File([await zip.generateAsync({ type: 'uint8array' })], 'begroting.xlsx', { type: '' });
  const r1 = await leesHuisstijlUitBestand(f1, { verkleinLogo: async () => ({ fout: 'x' }) });

  check('Excel geeft kleuren en geen logo', r1.bron === 'excel' && r1.kleuren[0] === '#1F6FB2' && r1.logo === null);

  zip.file('xl/media/image1.png', groot);

  const gelezen = [];
  const r2 = await leesHuisstijlUitBestand(new File([await zip.generateAsync({ type: 'uint8array' })], 'begroting.xlsx', { type: '' }), { verkleinLogo: async (b) => { gelezen.push(b.name); return { logo: 'data:image/png;base64,AAAA', logoBreedte: 10, logoHoogte: 5 }; } });

  check('het grootste plaatje wordt het logo', gelezen[0] === 'image1.png' && !!r2.logo);
}

sectie('6. PDF en afbeelding: kleuren en logo van de eerste pagina');
{
  const b = 100; const h = 100; const d = new Uint8ClampedArray(b * h * 4).fill(255);

  for (let y = 2; y < 20; y += 1) for (let x = 6; x < 36; x += 1) { const i = (y * b + x) * 4; d[i] = 200; d[i + 1] = 16; d[i + 2] = 46; }

  const deps = {
    tekenEerstePagina: async () => ({ canvas: {}, data: d, breedte: b, hoogte: h }),
    knipLogo: async () => new File([PNG], 'logo.png', { type: 'image/png' }),
    verkleinLogo: async () => ({ logo: 'data:image/png;base64,AAAA', logoBreedte: 10, logoHoogte: 5 }),
  };
  const pdf = await leesHuisstijlUitBestand(new File(['x'], 'rapport.pdf', { type: 'application/pdf' }), deps);
  const png = await leesHuisstijlUitBestand(new File(['x'], 'brief.png', { type: 'image/png' }), deps);

  check('PDF geeft kleuren en een logo', pdf.bron === 'pdf' && pdf.kleuren.length >= 1 && !!pdf.logo);
  check('een afbeelding werkt op dezelfde manier', png.bron === 'afbeelding' && !!png.logo);
}

sectie('7. Fouten');
{
  check('een ander bestandstype geeft een melding', /Word-, Excel/.test((await leesHuisstijlUitBestand(new File(['x'], 'a.txt', { type: 'text/plain' }))).fout));
  check('geen bestand geeft een melding', !!(await leesHuisstijlUitBestand(null)).fout);
  check('een kapot Word-bestand geeft een melding, geen fout', /kon niet worden gelezen/.test((await leesHuisstijlUitBestand(new File(['geen zip'], 'x.docx', { type: '' }))).fout));

  const leeg = new JSZip();

  leeg.file('word/document.xml', '<w:document/>');

  const r = await leesHuisstijlUitBestand(new File([await leeg.generateAsync({ type: 'uint8array' })], 'leeg.docx', { type: '' }));

  check('niets gevonden zegt dat eerlijk', /geen logo of kleuren/.test(r.fout));
}

console.log(`\nhuisstijl-uit-document: ${stand.ok} OK, ${stand.fout} FAIL`);
process.exit(stand.fout ? 1 : 0);
