// src/shared/budget/generateExcelDocument.js
//
// RC1 stap 3D-4: de centrale, AI-vrije Excel-generator voor begrotingen.
// Ontvangt UITSLUITEND een al berekend en gevalideerd Budget (het resultaat
// van berekenBudget(), zie berekenBudget.js) - doet hier zelf GEEN AI-aanroep
// en GEEN eigen rekenwerk op brontekst. Waar Excel zelf kan rekenen (aantal x
// eenheidsprijs, totalen) staat een echte Excel-formule, geen vooraf
// berekende tekst - zodat het lid na het downloaden gewoon verder kan
// rekenen in het bestand zelf (opdrachtpunt 6).
//
// Huisstijl: uitsluitend de bestaande kleur-/lettertype-/brandingtokens uit
// de Document Theme Engine (geïmporteerd via index.js, de enige toegestane
// ingang - zie dat bestand), NIET de Word-specifieke componenten
// (createSKTable e.d. bouwen docx.js-objecten, technisch incompatibel met
// ExcelJS-cellen). Alle styling hieronder is dus bewust Excel-nativ
// opgebouwd (cell.font/fill/border/alignment/numFmt), met dezelfde kleuren,
// hetzelfde lettertype en dezelfde organisatienaam als de Word-export.
import ExcelJS from 'exceljs';
import { getDocumentTheme } from '../document-theme/index.js';
import { parseEuroDutch } from './berekenBudget.js';

// Kolombreedtes (Excel-"characterwidth"-eenheden, geen mm/px) - ruim genoeg
// voor "Kostenpost"/"Toelichting"/"Opmerking" om leesbaar te blijven zonder
// overdreven breed te worden ("professioneel en rustig").
const BEGROTING_KOLOMBREEDTES = [18, 34, 32, 10, 14, 16, 36];
const DEKKING_KOLOMBREEDTES = [30, 26, 16, 16];

const EURO_FORMAT = '€ #,##0.00';
const AANTAL_FORMAT = '#,##0.##';

function argb(hex) {
  const schoon = String(hex || '').replace('#', '').trim().toUpperCase();

  return `FF${schoon}`;
}

// "personeel" -> "Personeel", "monitoring en evaluatie" -> "Monitoring en
// evaluatie" - uitsluitend de eerste letter, nooit elk woord (dat zou van
// "monitoring en evaluatie" ten onrechte "Monitoring En Evaluatie" maken).
function labelCategorie(categorie) {
  const s = String(categorie || 'overig');

  return s.charAt(0).toUpperCase() + s.slice(1);
}

function veiligeBestandsnaamDeel(s) {
  return String(s || '')
    .replace(/[\\/:*?"<>|]/g, '')
    .trim();
}

// Zelfde bestandsnaamconventie als exporteerAlsWord() (KompasToolPage.jsx),
// maar met een andere prioriteitsvolgorde - expliciet gevraagd in
// opdrachtpunt 12: voor Excel gaat de PROJECTNAAM voor de organisatienaam
// (een begroting hoort per definitie bij één project), terwijl Word
// (generieke documenten als een projectplan) organisatienaam als primaire
// identificatie gebruikt.
export function bepaalExcelBestandsnaam({ project, organizationName } = {}) {
  const projectNaam = veiligeBestandsnaamDeel(project?.naam);

  if (projectNaam) {
    return `Begroting - ${projectNaam}.xlsx`;
  }

  const orgNaam = veiligeBestandsnaamDeel(organizationName);

  if (orgNaam) {
    return `Begroting - ${orgNaam}.xlsx`;
  }

  return 'Subsidie Kompas - Begroting.xlsx';
}

// Titel + metadatablok, identiek opgebouwd voor beide tabbladen (DRY) - toont
// uitsluitend wat daadwerkelijk bekend is (opdrachtpunt 8: "verzin geen
// metadata"). Geeft de eerstvolgende vrije rij terug.
function schrijfTitelEnMetadata(ws, { titel, kleur, lettertype, aantalKolommen, project, organizationName }) {
  const laatsteKolomLetter = ws.getColumn(aantalKolommen).letter;

  ws.mergeCells(`A1:${laatsteKolomLetter}1`);

  const titelCel = ws.getCell('A1');

  titelCel.value = titel;
  titelCel.font = { name: lettertype, size: 18, bold: true, color: { argb: argb(kleur.white) } };
  titelCel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(kleur.primary) } };
  titelCel.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 28;

  let rij = 2;
  const metaRegels = [];

  if (project?.naam) {
    metaRegels.push(`Project: ${project.naam}`);
  }

  if (organizationName) {
    metaRegels.push(`Organisatie: ${organizationName}`);
  }

  metaRegels.push(`Exportdatum: ${new Date().toLocaleDateString('nl-NL')}`);

  metaRegels.forEach((tekst) => {
    ws.mergeCells(`A${rij}:${laatsteKolomLetter}${rij}`);
    const cel = ws.getCell(`A${rij}`);

    cel.value = tekst;
    cel.font = { name: lettertype, size: 10, color: { argb: argb(kleur.textSoft) } };
    cel.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    rij += 1;
  });

  return rij + 1; // één lege rij als witruimte vóór de tabel
}

function stijlHeaderRij(ws, rijNummer, kolommen, { kleur, lettertype }) {
  const rij = ws.getRow(rijNummer);

  kolommen.forEach((label, i) => {
    const cel = rij.getCell(i + 1);

    cel.value = label;
    cel.font = { name: lettertype, size: 10.5, bold: true, color: { argb: argb(kleur.tableHeaderText) } };
    cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(kleur.tableHeaderBg) } };
    cel.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cel.border = {
      top: { style: 'thin', color: { argb: argb(kleur.gridLine) } },
      bottom: { style: 'thin', color: { argb: argb(kleur.gridLine) } },
      left: { style: 'thin', color: { argb: argb(kleur.gridLine) } },
      right: { style: 'thin', color: { argb: argb(kleur.gridLine) } },
    };
  });

  rij.height = 20;
}

function dunneRand(kleur) {
  const stijl = { style: 'thin', color: { argb: argb(kleur.gridLine) } };

  return { top: stijl, bottom: stijl, left: stijl, right: stijl };
}

// Eén kostenregel-opmerking: signaleert - nooit verzwijgt - precies de
// gevallen die berekenBudget() al had gevonden (geen tweede validator, enkel
// dezelfde vlaggen hier zichtbaar maken in de kolom "Opmerking"):
// afwijking (brontekst noemt iets anders dan aantal x tarief), een
// ongeldige regel (bijv. negatief aantal), of een regel zonder enig bruikbaar
// bedrag.
function bouwOpmerking(regel) {
  const delen = [];

  if (regel.ongeldig) {
    delen.push('Ongeldige invoer (bijv. negatief aantal of bedrag) - niet meegeteld in het totaal.');
  }

  if (regel.bron === 'onbekend' && !regel.ongeldig) {
    delen.push('Geen aantal/tarief of bedrag gevonden in de brontekst - niet meegeteld in het totaal.');
  }

  if (regel.afwijking && regel.afwijkingDetail) {
    delen.push(regel.afwijkingDetail);
  }

  return delen.join(' ');
}

async function bouwBegrotingSheet(workbook, { budget, project, organizationName, kleur, lettertype }) {
  const ws = workbook.addWorksheet('Begroting');

  BEGROTING_KOLOMBREEDTES.forEach((breedte, i) => {
    ws.getColumn(i + 1).width = breedte;
  });

  let rij = schrijfTitelEnMetadata(ws, {
    titel: 'Begroting',
    kleur,
    lettertype,
    aantalKolommen: BEGROTING_KOLOMBREEDTES.length,
    project,
    organizationName,
  });

  const headerRij = rij;

  stijlHeaderRij(ws, headerRij, ['Categorie', 'Kostenpost', 'Toelichting', 'Aantal', 'Eenheidsprijs', 'Totaal', 'Opmerking'], {
    kleur,
    lettertype,
  });
  rij += 1;

  // Freeze pane: titel/metadata/header blijven zichtbaar bij scrollen door
  // lange begrotingen ("freeze pane waar nuttig", opdrachtpunt 7).
  ws.views = [{ state: 'frozen', ySplit: headerRij, xSplit: 0 }];

  // Contiguïteit per categorie (opdrachtpunt 3: "correcte regels per
  // categorie") - de VOLGORDE waarin categorieën voor het eerst voorkomen in
  // de brontekst blijft behouden, geen eigen alfabetische of andere sortering
  // verzonnen.
  const categorieVolgorde = [];
  const perCategorie = new Map();

  budget.expenseLines.forEach((regel) => {
    const cat = regel.categorie || 'overig';

    if (!perCategorie.has(cat)) {
      categorieVolgorde.push(cat);
      perCategorie.set(cat, []);
    }

    perCategorie.get(cat).push(regel);
  });

  const eersteDataRij = rij;
  const categorieBereik = new Map(); // cat -> { start, eind }

  categorieVolgorde.forEach((cat) => {
    const startRij = rij;

    perCategorie.get(cat).forEach((regel) => {
      const r = ws.getRow(rij);

      r.getCell(1).value = labelCategorie(regel.categorie);
      r.getCell(2).value = regel.omschrijving || '';
      r.getCell(3).value = regel.toelichting || '';

      if (regel.aantal != null) {
        r.getCell(4).value = regel.aantal;
        r.getCell(4).numFmt = AANTAL_FORMAT;
      }

      if (regel.tarief != null) {
        r.getCell(5).value = regel.tarief;
        r.getCell(5).numFmt = EURO_FORMAT;
      }

      // Totaal (opdrachtpunt 4, de belangrijkste eis): een ECHTE Excel-
      // formule wanneer aantal x tarief de bron is (bron === 'berekend') -
      // nooit het in JS al berekende getal als platte tekst/waarde erin
      // zetten. Een vaste kostenpost (bron === 'vast') krijgt het
      // gevalideerde bedrag als gewoon numeriek getal (er is geen aantal x
      // tarief om een formule van te maken). Een regel zonder bruikbaar
      // bedrag (bron === 'onbekend', of ongeldig) blijft leeg - nooit 0 of
      // verzonnen.
      if (regel.bron === 'berekend') {
        r.getCell(6).value = { formula: `D${rij}*E${rij}` };
      } else if (regel.bron === 'vast' && regel.bedrag != null) {
        r.getCell(6).value = regel.bedrag;
      }

      r.getCell(6).numFmt = EURO_FORMAT;

      const opmerking = bouwOpmerking(regel);

      if (opmerking) {
        r.getCell(7).value = opmerking;
        r.getCell(7).font = { name: lettertype, size: 9, italic: true, color: { argb: argb(kleur.warning) } };
      }

      for (let k = 1; k <= 7; k += 1) {
        const cel = r.getCell(k);

        cel.font = cel.font || { name: lettertype, size: 10.5, color: { argb: argb(kleur.text) } };
        cel.border = dunneRand(kleur);
        cel.alignment = { vertical: 'top', horizontal: k >= 4 && k <= 6 ? 'right' : 'left', wrapText: k === 2 || k === 3 || k === 7 };
      }

      rij += 1;
    });

    categorieBereik.set(cat, { start: startRij, eind: rij - 1 });
  });

  const laatsteDataRij = rij - 1;

  // Geen bruikbare kostenregels: nooit stilzwijgend een leeg of fictief
  // Excelbestand opleveren (opdrachtpunt 10/14/15-test 14) - dit is een
  // laatste, defensieve controle; de eigenlijke blokkade gebeurt al in
  // exporteerAlsExcel() (KompasToolPage.jsx) vóórdat deze functie wordt
  // aangeroepen, op basis van hetzelfde, bestaande validatorresultaat.
  const bruikbareRegels = budget.expenseLines.filter((r) => r.bedrag != null).length;

  if (bruikbareRegels === 0) {
    throw new Error('Geen bruikbare kostenregels gevonden - er kan geen begroting worden geëxporteerd.');
  }

  rij += 1; // lege rij

  // Subtotalen per categorie (opdrachtpunt 5, optioneel maar "simpel en
  // betrouwbaar" hier: een SUM over de eigen, aaneengesloten rijen van die
  // categorie - geen dubbele telling mogelijk omdat elke categorie zijn eigen
  // niet-overlappende rijbereik heeft).
  categorieVolgorde.forEach((cat) => {
    const bereik = categorieBereik.get(cat);
    const r = ws.getRow(rij);

    r.getCell(2).value = `Subtotaal ${labelCategorie(cat)}`;
    r.getCell(6).value = { formula: `SUM(F${bereik.start}:F${bereik.eind})` };
    r.getCell(6).numFmt = EURO_FORMAT;

    for (let k = 1; k <= 7; k += 1) {
      const cel = r.getCell(k);

      cel.font = { name: lettertype, size: 10, italic: true, color: { argb: argb(kleur.textSoft) } };
      cel.alignment = { horizontal: k === 6 ? 'right' : 'left' };
    }

    rij += 1;
  });

  rij += 1; // lege rij

  // TOTAAL PROJECTKOSTEN: telt de RUWE datarij-range (eersteDataRij t/m
  // laatsteDataRij) rechtstreeks op - bewust NIET de subtotaalregels hierboven
  // (die staan immers al buiten dat bereik), zodat er onder geen beding
  // dubbel geteld kan worden.
  const totaalRij = rij;
  const r = ws.getRow(totaalRij);

  r.getCell(2).value = 'TOTAAL PROJECTKOSTEN';
  r.getCell(6).value = { formula: `SUM(F${eersteDataRij}:F${laatsteDataRij})` };
  r.getCell(6).numFmt = EURO_FORMAT;

  for (let k = 1; k <= 7; k += 1) {
    const cel = r.getCell(k);

    cel.font = { name: lettertype, size: 11, bold: true, color: { argb: argb(kleur.white) } };
    cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(kleur.primary) } };
    cel.alignment = { vertical: 'middle', horizontal: k === 6 ? 'right' : 'left' };
  }

  r.height = 20;

  return { totaalProjectkostenRij: totaalRij, sheetNaam: ws.name };
}

async function bouwDekkingsplanSheet(workbook, { budget, project, organizationName, kleur, lettertype, begrotingTotaalRef }) {
  const ws = workbook.addWorksheet('Dekkingsplan');

  DEKKING_KOLOMBREEDTES.forEach((breedte, i) => {
    ws.getColumn(i + 1).width = breedte;
  });

  let rij = schrijfTitelEnMetadata(ws, {
    titel: 'Dekkingsplan',
    kleur,
    lettertype,
    aantalKolommen: DEKKING_KOLOMBREEDTES.length,
    project,
    organizationName,
  });

  const headerRij = rij;

  stijlHeaderRij(ws, headerRij, ['Financieringsbron', 'Type', 'Bedrag', 'Status'], { kleur, lettertype });
  rij += 1;
  ws.views = [{ state: 'frozen', ySplit: headerRij, xSplit: 0 }];

  const schrijfRegel = (financieringsbron, type, bedrag, status, opties = {}) => {
    const r = ws.getRow(rij);

    r.getCell(1).value = financieringsbron;
    r.getCell(2).value = type;

    if (bedrag != null) {
      r.getCell(3).value = bedrag;
      r.getCell(3).numFmt = EURO_FORMAT;
    }

    if (status) {
      r.getCell(4).value = status;
    }

    for (let k = 1; k <= 4; k += 1) {
      const cel = r.getCell(k);

      cel.font = {
        name: lettertype,
        size: 10.5,
        italic: Boolean(opties.italic),
        color: { argb: argb(opties.italic ? kleur.textSoft : kleur.text) },
      };
      cel.border = dunneRand(kleur);
      cel.alignment = { vertical: 'top', horizontal: k === 3 ? 'right' : 'left', wrapText: k === 1 };
    }

    rij += 1;
  };

  // Eigen bijdrage en cofinanciers - uitsluitend de al bestaande,
  // gestructureerde projectfinanciering (project.eigenBijdrage/project.cofin,
  // via budget.projectFinanciering - zie berekenBudget()), nooit een status
  // verzonnen wanneer die er niet is (opdrachtpunt 3).
  const financiering = budget.projectFinanciering || {};
  let heeftFinancieringsregel = false;

  if (financiering.eigenBijdrage != null) {
    schrijfRegel('Eigen bijdrage', 'Eigen bijdrage', financiering.eigenBijdrage, '');
    heeftFinancieringsregel = true;
  }

  (Array.isArray(financiering.cofinanciers) ? financiering.cofinanciers : []).forEach((c) => {
    schrijfRegel(c?.naam || '', 'Cofinanciering', parseEuroDutch(c?.bedrag), c?.status || '');
    heeftFinancieringsregel = true;
  });

  // Aangevraagd bedrag: puur informatief (opdrachtpunt 3: "waar beschikbaar
  // aangevraagd bedrag"), bewust NIET meegeteld in TOTAAL DEKKING hieronder -
  // hetzelfde onderscheid dat berekenBudget() zelf al maakt tussen
  // totals.totaalDekking en het losse totals.gevraagdBedrag.
  if (budget.totals.gevraagdBedrag) {
    if (heeftFinancieringsregel) {
      rij += 1;
    }

    schrijfRegel(
      'Aangevraagd bedrag',
      `Aangevraagd (${budget.totals.gevraagdBedrag.bron === 'gesprek' ? 'uit gesprek' : 'uit project'})`,
      budget.totals.gevraagdBedrag.waarde,
      '',
      { italic: true },
    );

    ws.mergeCells(`A${rij}:D${rij}`);
    const toelichtingCel = ws.getCell(`A${rij}`);

    toelichtingCel.value = 'Ter informatie - telt niet mee in de dekkingssom hieronder.';
    toelichtingCel.font = { name: lettertype, size: 9, italic: true, color: { argb: argb(kleur.textSoft) } };
    rij += 1;
  }

  rij += 1; // lege rij

  // TOTAAL DEKKING: de canonical waarheid rechtstreeks uit berekenBudget()
  // (budget.totals.totaalDekking) - BEWUST als vaste numerieke waarde, geen
  // formule over de zichtbare rijen hierboven. Reden: berekenDekking()
  // (KompasStore.jsx, hergebruikt door berekenBudget()) telt voor "toegekend"/
  // "in aanvraag" ook eerder toegekende financiering en gekoppelde
  // regelingen mee (project.eerder/project.regelingen) die hier bewust GEEN
  // aparte rij krijgen (opdrachtpunt 3 noemt uitsluitend eigen bijdrage,
  // cofinanciers en aangevraagd bedrag als kolominhoud) - een SUM-formule
  // over alleen de hierboven zichtbare rijen zou dan een ONJUIST, te laag
  // bedrag kunnen tonen. Dit is dus geen tweede validator (die logica staat
  // al, ongewijzigd, in berekenDekking()) maar uitsluitend het al bestaande
  // resultaat zichtbaar maken (opdrachtpunt 11: "gebruik het bestaande
  // validator-resultaat").
  const heeftAndereBronnen =
    (Array.isArray(project?.eerder) && project.eerder.length > 0) || (Array.isArray(project?.regelingen) && project.regelingen.length > 0);
  const totaalDekkingRij = rij;
  const rDekking = ws.getRow(totaalDekkingRij);

  rDekking.getCell(1).value = 'TOTAAL DEKKING';
  rDekking.getCell(3).value = budget.totals.totaalDekking;
  rDekking.getCell(3).numFmt = EURO_FORMAT;

  if (heeftAndereBronnen) {
    rDekking.getCell(4).value = 'Incl. eerdere toekenningen/regelingen';
    rDekking.getCell(4).font = { name: lettertype, size: 9, italic: true, color: { argb: argb(kleur.textSoft) } };
  }

  rij += 1;

  // TOTAAL PROJECTKOSTEN: een ECHTE cross-sheet-formule naar de grand total
  // van het Begroting-tabblad (opdrachtpunt 5: "met formules/referenties waar
  // logisch") - dit IS logisch, want die cel bevat zelf al een betrouwbare
  // SUM-formule over de ruwe kostenregels.
  const totaalProjectkostenRij = rij;
  const rKosten = ws.getRow(totaalProjectkostenRij);

  rKosten.getCell(1).value = 'TOTAAL PROJECTKOSTEN';
  rKosten.getCell(3).value = { formula: begrotingTotaalRef };
  rKosten.getCell(3).numFmt = EURO_FORMAT;
  rij += 1;

  // VERSCHIL: rechtstreeks de twee cellen hierboven tegen elkaar afzetten
  // (ECHTE formule, geen los berekend getal) - dit kán nooit uit de pas lopen
  // met budget.totals.verschil, want beide operanden zijn letterlijk dezelfde
  // canonical waarden. "Een begroting die niet sluit mag niet stil als
  // sluitend worden gepresenteerd" (opdrachtpunt 5): kleur en label hieronder
  // maken een tekort nadrukkelijk zichtbaar, nooit verborgen.
  const verschilRij = rij;
  const rVerschil = ws.getRow(verschilRij);

  rVerschil.getCell(1).value = 'VERSCHIL';
  rVerschil.getCell(3).value = { formula: `C${totaalDekkingRij}-C${totaalProjectkostenRij}` };
  rVerschil.getCell(3).numFmt = EURO_FORMAT;

  let statusLabel;
  let statusKleur;

  if (budget.totals.isSluitend) {
    statusLabel = 'Sluitend';
    statusKleur = kleur.success;
  } else if (budget.totals.verschil > 0) {
    statusLabel = `Niet sluitend - tekort van €${budget.totals.verschil.toLocaleString('nl-NL')}`;
    statusKleur = kleur.danger;
  } else {
    statusLabel = `Niet sluitend - overschot van €${Math.abs(budget.totals.verschil).toLocaleString('nl-NL')}`;
    statusKleur = kleur.warning;
  }

  if (budget.totals.isConcept) {
    statusLabel += ' (conceptscenario)';
  }

  rVerschil.getCell(4).value = statusLabel;
  rVerschil.getCell(4).font = { name: lettertype, size: 10.5, bold: true, color: { argb: argb(statusKleur) } };

  [totaalDekkingRij, totaalProjectkostenRij, verschilRij].forEach((rNum) => {
    const r = ws.getRow(rNum);

    for (let k = 1; k <= 4; k += 1) {
      const cel = r.getCell(k);

      cel.font = cel.font || { name: lettertype, size: 11, bold: true, color: { argb: argb(kleur.text) } };
      if (!cel.font.bold) {
        cel.font = { ...cel.font, bold: true };
      }
      cel.alignment = { vertical: 'middle', horizontal: k === 3 ? 'right' : 'left' };
    }

    r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(kleur.background) } };
    r.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(kleur.background) } };
    r.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(kleur.background) } };
    r.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(kleur.background) } };
    r.height = 18;
  });
}

// Centrale, AI-vrije Excel-generator. Ontvangt uitsluitend een al berekend en
// gevalideerd Budget (berekenBudget()) plus de bekende, bestaande
// project-/organisatiegegevens - doet zelf geen AI-aanroep.
export async function generateExcelDocument({ budget, project, organizationName, themeName } = {}) {
  if (!budget || !Array.isArray(budget.expenseLines) || !budget.totals) {
    throw new Error('generateExcelDocument vereist een al berekend budget (zie berekenBudget()).');
  }

  const theme = getDocumentTheme(themeName || 'subsidieKompas');
  const kleur = theme.colors;
  const lettertype = theme.fonts.table || theme.fonts.body || 'Arial';

  const workbook = new ExcelJS.Workbook();

  workbook.creator = organizationName || theme.branding.organizationName;
  workbook.created = new Date();
  workbook.modified = workbook.created;

  const { totaalProjectkostenRij, sheetNaam } = await bouwBegrotingSheet(workbook, {
    budget,
    project,
    organizationName,
    kleur,
    lettertype,
  });

  await bouwDekkingsplanSheet(workbook, {
    budget,
    project,
    organizationName,
    kleur,
    lettertype,
    begrotingTotaalRef: `${sheetNaam}!F${totaalProjectkostenRij}`,
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
