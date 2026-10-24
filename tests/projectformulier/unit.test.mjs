import { readFileSync } from 'node:fs';
import {
  teFinancieren, bedragenVoorOpslaan, periodeTekst, berekenDekking, dekkingVanProject, regelUitRpc, mijnDeadlines, projectBedrag,
} from '../../src/features/kompas-app/financiering/dekkingsplan.js';
import { bouwDashboard } from '../../src/features/kompas-app/dashboard/dashboardData.js';
import { naarKolomPatch } from '../../src/data/services/projecten.js';
import { bouwProjectModel } from '../../src/shared/export/exportModel.js';
import { berekenBudget } from '../../src/shared/budget/berekenBudget.js';
import { cofinanciersVoorBegroting } from '../../src/features/kompas-app/financiering/exportFinanciering.js';
import { STATUS_LABEL } from '../../src/features/kompas-app/financiering/dekkingsplan.js';
import { NIEUW_PROJECT_VELDEN, OMSCHRIJVING_HULPTEKST, teFinancierenUitFormulier } from '../../src/features/kompas-app/NieuwProjectFormulier.jsx';
import { deadlineVeldBij } from '../../src/features/kompas-app/financiering/dekkingsplan.js';
import { buildMatchSignalen } from '../../src/data/services/chat.js';
import { meldingVoorReden, MELDING_GEEN_TEKST, MELDING_TE_WEINIG } from '../../src/features/kompas-app/projectdossier/ProjectgegevensAanvullen.jsx';

let ok = 0; let fail = 0;
const check = (n, c, d = '') => { if (c) { ok += 1; console.log('OK  ', n); } else { fail += 1; console.log('FAIL', n, d); } };
const gelijk = (n, a, b) => check(n, JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
const lees = (p) => readFileSync(p, 'utf8');
const zonderCommentaar = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ============================================================ 1. Te financieren bedrag
console.log('\n== 1. Automatische berekening te financieren bedrag');
gelijk('420.000 - 80.000 = 340.000', teFinancieren(420000, 80000), 340000);
gelijk('tekstinvoer "€ 85.000" - "€ 7.500" = 77.500', teFinancieren('€ 85.000', '€ 7.500'), 77500);
gelijk('eigen bijdrage hoger dan begroting -> 0 (nooit negatief)', teFinancieren(10000, 25000), 0);
gelijk('geen eigen bijdrage -> hele begroting', teFinancieren(50000, ''), 50000);
gelijk('geen begroting -> 0', teFinancieren('', 5000), 0);
gelijk('ongeldige invoer -> 0', teFinancieren('abc', undefined), 0);
gelijk('formulier: 420000/80000 -> 340000', teFinancierenUitFormulier({ begroting: '420.000', eigenBijdrage: '80.000' }), 340000);
gelijk('formulier: ongeldig bedrag -> null (geen raden)', teFinancierenUitFormulier({ begroting: '12x', eigenBijdrage: '' }), null);
gelijk('formulier: leeg -> 0', teFinancierenUitFormulier({ begroting: '', eigenBijdrage: '' }), 0);
gelijk('opslaan: geldige bedragen', bedragenVoorOpslaan({ begroting: '€ 420.000', eigenBijdrage: '80.000' }), { ok: true, begroting: 420000, eigenBijdrage: 80000, fout: '' });
gelijk('opslaan: leeg is toegestaan', bedragenVoorOpslaan({ begroting: '', eigenBijdrage: '' }).ok, true);
gelijk('opslaan: ongeldig bedrag wordt geweigerd', bedragenVoorOpslaan({ begroting: '12,5x', eigenBijdrage: '' }).ok, false);
gelijk('opslaan: 12.500,50 wordt afgerond op hele euro', bedragenVoorOpslaan({ begroting: '12.500,50', eigenBijdrage: '' }).begroting, 12501);
gelijk('opslaan: numerieke waarde uit de database blijft gelijk', bedragenVoorOpslaan({ begroting: 420000, eigenBijdrage: 80000 }).begroting, 420000);

// ============================================================ 2. Opslag
console.log('\n== 2. Opslag (naarKolomPatch)');
const nieuw = { naam: 'Mijn project', programma: '', doelgroep: ['Ouderen'], regio: 'Accra, Ghana', periodeVan: '2027-01-15', periodeTot: '2027-12-31', omschrijving: 'Kort.', begroting: 420000, eigenBijdrage: 80000, gevraagd: 340000, eerder: [{ x: 1 }], cofin: [{ naam: 'X' }], regelingen: [{ naam: 'Y' }], bronnen: {} };
const patch = naarKolomPatch(nieuw);
gelijk('begin- en einddatum worden als ISO-datum bewaard', [patch.period_start, patch.period_end], ['2027-01-15', '2027-12-31']);
gelijk('begroting en eigen bijdrage bewaard', [patch.budget_total, patch.own_contribution], [420000, 80000]);
gelijk('requested_amount = begroting - eigen bijdrage (afgeleid)', patch.requested_amount, 340000);
gelijk('een los ingevuld gevraagd bedrag wordt genegeerd (afgeleid wint)', naarKolomPatch({ ...nieuw, gevraagd: 999999 }).requested_amount, 340000);
gelijk('eigen bijdrage > begroting -> requested_amount 0, nooit negatief', naarKolomPatch({ ...nieuw, begroting: 10000, eigenBijdrage: 25000 }).requested_amount, 0);
gelijk('zonder begroting blijft requested_amount leeg', naarKolomPatch({ ...nieuw, begroting: '', eigenBijdrage: '' }).requested_amount, null);
check('previous_grants, cofinanciers en linked_schemes worden niet meer geschreven (geen dataverlies: kolommen blijven onaangeroerd)', !('previous_grants' in patch) && !('cofinanciers' in patch) && !('linked_schemes' in patch));
['program_label', 'goals', 'partners', 'results', 'activities', 'impact_description', 'writing_preferences', 'planning', 'target_groups', 'location', 'description'].forEach((k) =>
  check(`databasekolom ${k} blijft bestaan in de opslag (niet verwijderd)`, k in patch));
const projectenSrc = lees('src/data/services/projecten.js');
['program_label', 'goals', 'partners', 'results', 'activities', 'impact_description', 'writing_preferences'].forEach((k) => check(`veld ${k} wordt nog gelezen`, projectenSrc.includes(`rij.${k}`)));

// ============================================================ 3. Aanmaakformulier
console.log('\n== 3. Aanmaakformulier (alleen gewenste velden)');
const formSrc = lees('src/features/kompas-app/NieuwProjectFormulier.jsx');
gelijk('velden in volgorde', NIEUW_PROJECT_VELDEN, ['naam', 'doelgroep', 'discipline', 'periodeVan', 'periodeTot', 'regio', 'omschrijving', 'begroting', 'eigenBijdrage']);
['Projectnaam', 'Doelgroep', 'Discipline', 'Looptijd', 'Startdatum', 'Einddatum', 'Werkgebied / locatie', 'Projectomschrijving', 'Totale projectbegroting', 'Eigen bijdrage', 'Te financieren bedrag', 'Project aanmaken'].forEach((l) =>
  check(`formulier toont "${l}"`, formSrc.includes(l)));
['Programma of onderdeel', 'Partners', 'Doelstellingen', 'Activiteiten', 'Beoogde impact', 'Resultaten', 'Schrijfvoorkeur', 'Eerdere', 'Co-financier', 'Cofinancier'].forEach((l) =>
  check(`formulier toont "${l}" NIET`, !zonderCommentaar(formSrc).includes(l)));
gelijk('hulptekst bij omschrijving exact', OMSCHRIJVING_HULPTEKST, 'Heb je al een projectplan of two-pager? Voeg die toe en laat Subsidie Kompas je projectomschrijving aanvullen.');
check('twee native datumvelden (type="date" via DatumInvoer: np-periode-van en np-periode-tot), geen datepicker-bibliotheek', /type="date"/.test(formSrc) && /testid="np-periode-van"/.test(formSrc) && /testid="np-periode-tot"/.test(formSrc) && !/datepicker|flatpickr|react-datepicker/i.test(formSrc));
check('te financieren is read-only (geen input)', /data-testid="np-te-financieren"[\s\S]{0,200}<div|<div[\s\S]{0,80}np-te-financieren/.test(formSrc) && !/<input[^>]*np-te-financieren/.test(formSrc));
check('formulier gebruikt teFinancieren uit de gedeelde module (geen eigen formule)', /teFinancieren/.test(formSrc) && !/begroting\s*-\s*eigen/i.test(zonderCommentaar(formSrc)));
const pagina = lees('src/features/kompas-app/ProjectenPage.jsx');
const bewerk = lees('src/features/kompas-app/projectdossier/ProjectBewerkFormulier.jsx');
check('na aanmaken: redirect naar /kompas/projecten/<id>', /window\.location\.hash = `#\/kompas\/projecten\/\$\{id\}`/.test(pagina));
check('Nieuw project opent het lichte formulier (nieuw: true)', /nieuw: true/.test(pagina) && /form && form\.nieuw/.test(pagina));
check('bewerkformulier: geen sectie Eerdere fondsen/Co-financiers meer', !/Eerdere fondsen en toekenningen|<SectionHeading>Co-financiers|COFIN_STATUSSEN|UITKOMSTEN/.test(bewerk));
check('bewerkformulier: geen tweede cofinanciers-editor (cofinanciers staan in Projectfinanciering)', !/Cofinanciers en andere financiering|<SectionHeading/.test(bewerk) && !/BEWERK_VELDEN|VELDEN = \[/.test(pagina));
check('bewerkformulier: hetzelfde compacte formulier (modus bewerk), niet meer de uitgebreide velden', /NieuwProjectFormulier/.test(bewerk) && /modus="bewerk"/.test(bewerk) && !/doelstellingen|activiteiten|schrijfvoorkeur|partners/.test(zonderCommentaar(bewerk)));
check('uitgebreide projectvelden zijn niet verdwenen: ze zijn Projectinformatie op de pagina Documenten (zelfde kolommen)', ['doelstellingen', 'activiteiten', 'partners', 'impact', 'resultaten', 'planning', 'schrijfvoorkeur', 'programma'].every((n) => lees('src/features/kompas-app/projectinformatie/projectinformatie.js').includes(`project: '${n}'`)));
check('aanmaken en bewerken gebruiken dezelfde validatie (valideerEnBereidOp)', /valideerEnBereidOp/.test(pagina) && /valideerEnBereidOp/.test(bewerk));
check('bewerkformulier: geen los "Gevraagd bedrag"-veld meer', !/n: 'gevraagd'/.test(bewerk));

// ============================================================ 4. Eén financiële waarheid
console.log('\n== 4. Eén financiële bron (€30k toegekend / €160k aangevraagd)');
const project = { id: 'p-1', naam: 'Fondsenwerving', begroting: 420000, eigenBijdrage: 80000, gevraagd: 340000,
  cofin: [{ naam: 'LEGACY JSON', bedrag: '999999', status: 'Toegezegd' }], eerder: [{ fonds: 'OUD', bedrag: '77777', uitkomst: 'Toegekend' }], regelingen: [{ naam: 'LEGACY', plan: 'Toegekend', aangevraagd: '55555' }], docs: [], gearchiveerd: false, periodeVan: '2027-01-01', periodeTot: '2027-12-31' };
const rpc = (id, naam, status, req, awd) => regelUitRpc({ id, program_id: 'p-1', bron_type: 'financier', bron_status: 'zichtbaar', bron_naam: naam, status, requested_amount: req, awarded_amount: awd });
const REGELS = [rpc('r1', 'Stichting Hulp Na Onderzoek', 'awarded', null, 25000), rpc('r2', 'Stichting DOCO', 'awarded', null, 5000), rpc('r3', 'Gemeente Amsterdam', 'submitted', 160000, null)];
const d = dekkingVanProject(project, REGELS);
gelijk('Toegekend 30.000 en Aangevraagd 160.000 zichtbaar', [d.toegekend, d.aangevraagd], [30000, 160000]);
gelijk('Eigen bijdrage 80.000; Nog te financieren = 420.000 - 30.000 - 160.000 - 80.000 = 150.000', [d.overige, d.nogNodig], [80000, 150000]);
check('het oude JSON-veld (cofin/eerder/regelingen) telt NIET mee: geen dubbele telling', d.toegekend === 30000 && d.aangevraagd === 160000);
gelijk('naam-regel heeft bronType financier en is zichtbaar', [REGELS[0].bronType, REGELS[0].bronStatus, REGELS[0].naam], ['financier', 'zichtbaar', 'Stichting Hulp Na Onderzoek']);
const dash = bouwDashboard({ projects: [project], funding: { 'p-1': REGELS }, conversations: [], orgProfile: {}, nu: new Date('2026-10-12') });
gelijk('Dashboard = Projectfinanciering (zelfde dekking-object)', dash.projecten[0].dekking, d);
gelijk('Projecten-kaart/Projectdetail gebruiken dezelfde functie -> identieke waarden', dekkingVanProject(project, REGELS), dash.projecten[0].dekking);
gelijk('project zonder financieringsregels werkt', dekkingVanProject(project, []).nogNodig, 340000);
gelijk('project zonder regels (undefined) werkt', dekkingVanProject(project, undefined).toegekend, 0);
const vol = berekenDekking({ begroting: 420000, overige: 80000, regels: [...REGELS, rpc('r4', 'Fonds Z', 'awarded', null, 150000)] });
gelijk('volledig gedekt: nog te financieren = 0 en vlag volledigGedekt', [vol.nogNodig, vol.volledigGedekt], [0, true]);
gelijk('overdekking wordt nooit negatief', berekenDekking({ begroting: 1000, overige: 0, regels: [rpc('r5', 'Z', 'awarded', null, 5000)] }).nogNodig, 0);
gelijk('afgewezen en interessante regels tellen niet mee', berekenDekking({ begroting: 1000, overige: 0, regels: [rpc('a', 'A', 'rejected', 500, null), rpc('b', 'B', 'interesting', 400, null)] }).aangevraagd, 0);
check('geen linked_schemes-terugval en geen vrije-tekst-parsing van bedragen in de rekenmodule', !/linked_schemes|parseFloat|cofin/i.test(zonderCommentaar(lees('src/features/kompas-app/financiering/dekkingsplan.js'))));
const mijn = mijnDeadlines([project], { 'p-1': REGELS }, new Date('2026-10-12'));
gelijk('Mijn deadlines toont geen naam-regels zonder deadline', mijn.totaal, 0);
gelijk('statussen in labels: awarded=Toegekend, submitted=Aangevraagd', [STATUS_LABEL.awarded, STATUS_LABEL.submitted], ['Toegekend', 'Aangevraagd']);
gelijk('looptijd ISO wordt leesbaar getoond', periodeTekst('2027-01-15', '2027-12-31'), '15 jan 2027 – 31 dec 2027');
gelijk('oude vrije tekst blijft ongewijzigd leesbaar', periodeTekst('jan 2027', 'dec 2027'), 'jan 2027 – dec 2027');
gelijk('projectBedrag is numeriek', projectBedrag('€ 1.000'), 1000);

// ============================================================ 5. Legacy-lezers
console.log('\n== 5. Oude bron niet meer gebruikt');
const leesBestanden = ['src/features/kompas-app/ProjectenPage.jsx', 'src/features/kompas-app/projectdossier/ProjectDetailPage.jsx', 'src/features/kompas-app/projectdossier/ProjectfinancieringTab.jsx',
  'src/features/kompas-app/dashboard/DashboardPage.jsx', 'src/features/kompas-app/dashboard/dashboardData.js', 'src/features/kompas-app/exportBronnen.js', 'src/shared/export/exportModel.js',
  'src/shared/budget/berekenBudget.js', 'src/shared/budget/generateExcelDocument.js', 'src/features/kompas-app/chat/contextPanelData.js'];
leesBestanden.forEach((f) => check(`${f} leest p.cofin/p.eerder/p.regelingen/legacy berekenDekking niet`, !/\.cofin\b|\.eerder\b|\.regelingen\b|KompasStore\.jsx'.*berekenDekking|berekenDekking\(project/.test(zonderCommentaar(lees(f)).replace(/import \{[^}]*\} from '\.\/KompasStore\.jsx';/g, ''))));
check('legacy berekenDekking is uit KompasStore verwijderd', !/export function berekenDekking/.test(lees('src/features/kompas-app/KompasStore.jsx')));

// ============================================================ 6. Exports en begroting
console.log('\n== 6. Exports uit dezelfde bron');
const model = bouwProjectModel(project, { organisatieNaam: 'Org', dekking: d, regels: REGELS });
const tekstVanModel = JSON.stringify(model);
check('export bevat de drie financiers', ['Stichting Hulp Na Onderzoek', 'Stichting DOCO', 'Gemeente Amsterdam'].every((n) => tekstVanModel.includes(n)));
check('export bevat het oude JSON-veld NIET (LEGACY JSON/OUD/LEGACY)', !/LEGACY JSON|"OUD"|LEGACY"/.test(tekstVanModel));
const finSheet = model.sheets.find((s) => s.name === 'Financiering' || s.naam === 'Financiering');
const rijen = finSheet ? (finSheet.rows || finSheet.rijen || []) : [];
const waarde = (k) => (rijen.find((r) => r.onderdeel === k) || {}).bedrag;
gelijk('Excel: Toegekend/Aangevraagd/Nog te financieren = app', [waarde('Toegekend'), waarde('Aangevraagd'), waarde('Nog te financieren')], [30000, 160000, 150000]);
gelijk('Excel: Te financieren bedrag 340.000', waarde('Te financieren bedrag'), 340000);
const budget = berekenBudget([{ description: 'Kosten', quantity: 1, unitPrice: 100 }], project, {}, { regels: REGELS, dekking: d });
gelijk('begroting: totaalDekking = toegekend + aangevraagd + eigen bijdrage (270.000)', budget.totals.totaalDekking, 270000);
gelijk('begroting: financiers uit de financieringsregels', budget.projectFinanciering.cofinanciers.map((c) => [c.naam, c.bedrag, c.status]), [['Stichting Hulp Na Onderzoek', 25000, 'Toegekend'], ['Stichting DOCO', 5000, 'Toegekend'], ['Gemeente Amsterdam', 160000, 'Aangevraagd']]);
gelijk('begroting: legacy cofin-JSON wordt genegeerd', budget.projectFinanciering.cofinanciers.some((c) => /LEGACY/.test(c.naam)), false);
gelijk('cofinanciersVoorBegroting slaat afgewezen/interessante regels over', cofinanciersVoorBegroting([rpc('a', 'A', 'rejected', 5, null), rpc('b', 'B', 'awarded', null, 7)], STATUS_LABEL).length, 1);

// ============================================================ 7. Documentvoorstel
console.log('\n== 7. Document -> voorstel projectomschrijving');
const edge = lees('supabase/functions/subsidie-kompas/index.ts');
const modeBlok = edge.slice(edge.indexOf("if (body.mode === 'project-omschrijving')"), edge.indexOf("if (body.mode === 'website')"));
check('Edge: mode project-omschrijving bestaat', modeBlok.length > 500);
check('Edge: project wordt gelezen op id EN eigen user_id', /from\('subsidie_kompas_programs'\)[\s\S]*\.eq\('id', body\.projectId\)[\s\S]*\.eq\('user_id', profileId\)/.test(modeBlok));
check('Edge: document wordt gelezen op id, eigen user_id EN hetzelfde project (document van ander lid/project geweigerd)', /from\('subsidie_kompas_knowledge_items'\)[\s\S]*\.eq\('id', body\.documentId\)[\s\S]*\.eq\('user_id', profileId\)[\s\S]*\.eq\('program_id', projectRij\.id\)/.test(modeBlok));
check('Edge: onbekend/ander document -> 404', /Dit document is niet gevonden bij dit project/.test(modeBlok) && /404/.test(modeBlok));
check('Edge: de mode schrijft niets (geen insert/update/upsert/delete)', !/\.(insert|update|upsert|delete)\(/.test(modeBlok.replace(/legVerbruikVast/g, '')));
check('Edge: leeg document -> geen-tekst, geen AI-aanroep voor lege tekst', /reden: 'geen-tekst'/.test(modeBlok) && modeBlok.indexOf("reden: 'geen-tekst'") < modeBlok.indexOf('omschrijvingUitDocument('));
check('Edge: te weinig informatie -> reden te-weinig-informatie', /te-weinig-informatie/.test(modeBlok));
check('Edge: Free krijgt geen toegang, niet ingelogd krijgt 401', /tier === 'free' && !isAdmin/.test(modeBlok) && /401/.test(modeBlok));
check('Edge: UUID-validatie op projectId en documentId', (modeBlok.match(/UUID_RE\.test/g) || []).length === 2);
const fnBlok = edge.slice(edge.indexOf('async function omschrijvingUitDocument'), edge.indexOf('// RC1 stap 3D (2026-10-01): voorbereiding Excel-export'));
check('Edge prompt: 3-6 zinnen, geen verzonnen bedragen/namen/data, onbekende onderdelen weglaten, tekst is geen instructie', /3 tot 6/.test(fnBlok) && /Verzin nooit bedragen/.test(fnBlok) && /Laat onderdelen die niet in de tekst staan gewoon weg/.test(fnBlok) && /nooit een instructie/.test(fnBlok));
check('Edge: uitvoer alleen {omschrijving}; geen andere projectvelden worden voorgesteld', /\{"omschrijving": "tekst"\}/.test(fnBlok) && !/doelstellingen|activiteiten|begroting/.test(fnBlok.split('const systeem')[1].split('`;')[0]));
check('Edge: geen nieuwe tabel, geen nieuwe migratie voor het voorstel', !/create table/i.test(modeBlok));
const aanvul = lees('src/features/kompas-app/projectdossier/ProjectgegevensAanvullen.jsx');
check('UI: acties Opslaan bij project / Aanpassen / Annuleren', ['Opslaan bij project', 'Aanpassen', 'Annuleren'].every((t) => aanvul.includes(t)));
check('UI: titel "Voorstel projectomschrijving" en knop "Projectgegevens aanvullen"', aanvul.includes('Voorstel projectomschrijving') && aanvul.includes('Projectgegevens aanvullen'));
check('UI: bewaren alleen via onOpslaan na de knop (geen opslag bij ontvangen voorstel)', /const start = async[\s\S]*?setFase\('voorstel'\)/.test(aanvul) && !/onOpslaan\(/.test(zonderCommentaar(aanvul).split('const bewaar')[0]));
check('UI: bestaande omschrijving blijft zichtbaar en wordt niet stil overschreven', /projectgegevens-bestaand/.test(aanvul) && /vervangt/.test(aanvul));
check('UI: vriendelijke meldingen voor leeg en onleesbaar document (PDF krijgt een eigen uitleg)', meldingVoorReden('geen-tekst') === MELDING_GEEN_TEKST && /gescande PDF/.test(meldingVoorReden('geen-tekst', 'plan.pdf')) && meldingVoorReden('te-weinig-informatie') === MELDING_TE_WEINIG && MELDING_GEEN_TEKST.length > 20);
const detail = lees('src/features/kompas-app/projectdossier/ProjectDetailPage.jsx');
check('Documenten-tab: actie per eigen document met echte id (isEchtId)', /ProjectgegevensAanvullen/.test(detail) && /isEchtId\(d\.id\)/.test(detail));
check('opslaan via bestaande store-route werkProjectBij met herkomst "upload" (uit een document), alleen omschrijving', /werkProjectBij\(project\.id, \{ vulling: \{\}, bijwerking: \{ omschrijving: tekst \}, bronnen: \{ omschrijving: 'upload' \}/.test(detail));
check('chat.js: aanroep stelProjectOmschrijvingVoor stuurt alleen twee id\'s', /body: \{ mode: 'project-omschrijving', projectId, documentId \}/.test(lees('src/data/services/chat.js')));

// ============================================================ 4. Discipline, werkgebied en looptijd (taxonomie = matching)
console.log('\n== 4. Doelgroep, discipline, werkgebied en looptijd');
const patchD = naarKolomPatch({ ...nieuw, discipline: ['Sport', 'Welzijn'] });
gelijk('discipline wordt bewaard in de bestaande kolom themes (kommagescheiden, geen nieuwe kolom)', patchD.themes, 'Sport, Welzijn');
gelijk('geen discipline -> themes leeg (geen dataverlies, kolom bestond al)', naarKolomPatch(nieuw).themes, null);
check('projecten.js leest discipline terug uit themes', /discipline: doelgroepUitKolom\(rij\.themes\)/.test(projectenSrc));
check('Doelgroep en Discipline: geen vrije-tekstinvoer (geen metAnders) in het aanmaakformulier', !/metAnders/.test(zonderCommentaar(formSrc)));
check('Discipline gebruikt de lijst themas, Doelgroep de lijst doelgroepen (opties via props, geen eigen lijsten)', /opties=\{themas\}/.test(formSrc) && /opties=\{doelgroepen\}/.test(formSrc) && !/const\s+(THEMAS|DOELGROEPEN|DISCIPLINES)\s*=/.test(formSrc));
check('pagina haalt themas/doelgroepen/regios uit haalClassificatiesOp (één bron voor matching en project)', /setThemas\(lijst\.themas/.test(pagina) && /setRegios\(lijst\.regios/.test(pagina) && /themas=\{themas\}/.test(pagina));
check('Werkgebied / locatie: bestaande regio-waarden als suggesties (datalist), bestaande kolom location', /list="np-regio-opties"/.test(formSrc) && /location: project\.regio/.test(projectenSrc));
check('Looptijd: twee native datumvelden Startdatum en Einddatum, opslag in period_start/period_end', /label="Startdatum"/.test(formSrc) && /label="Einddatum"/.test(formSrc) && /period_start: project\.periodeVan/.test(projectenSrc));
check('bewerkformulier: Discipline en Werkgebied / locatie (uit het gedeelde formulier), geen metAnders', /Discipline/.test(formSrc) && /Werkgebied \/ locatie/.test(formSrc) && !/metAnders/.test(bewerk) && /themas=\{lijsten\.themas\}/.test(bewerk));
check('bestaande looptijd als vrije tekst blijft zichtbaar en laadbaar (DatumInvoer, Kies een datum)', /ISO_DATUM\.test\(v\)/.test(formSrc) && /Kies een datum/.test(formSrc));
const sig = buildMatchSignalen({ orgProfile: { themas: ['Cultuur'], doelgroepen: ['Jongeren'], regio: 'Utrecht' }, projects: [{ id: 'p1', discipline: ['Sport'], doelgroep: ['Ouderen'], regio: 'Rotterdam', gevraagd: 50000 }], linkedProjectId: 'p1' });
gelijk('matchsignalen: project-discipline, -doelgroep en -werkgebied zijn leidend (exacte taxonomiewaarden)', [sig.themas, sig.doelgroepen, sig.werkgebied], [['Sport'], ['Ouderen'], 'Rotterdam']);
gelijk('matchsignalen: zonder project-discipline blijven de themas van het organisatieprofiel gelden', buildMatchSignalen({ orgProfile: { themas: ['Cultuur'] }, projects: [{ id: 'p1', discipline: [] }], linkedProjectId: 'p1' }).themas, ['Cultuur']);
gelijk('matchsignalen: zonder actief project geen projectcriterium', buildMatchSignalen({ orgProfile: { themas: ['Cultuur'] }, projects: [{ id: 'p1', discipline: ['Sport'] }], linkedProjectId: null }).themas, ['Cultuur']);

// ============================================================ 5. Snelle financieringsinvoer
console.log('\n== 5. Snelle financiering in het projectoverzicht (zelfde fundingtabel)');
gelijk('deadline: Interessant -> standaard', deadlineVeldBij('interesting'), 'standaard');
gelijk('deadline: In voorbereiding -> standaard', deadlineVeldBij('preparing'), 'standaard');
gelijk('deadline: Aangevraagd -> optioneel', deadlineVeldBij('submitted'), 'optioneel');
gelijk('deadline: Toegekend -> geen', deadlineVeldBij('awarded'), 'geen');
gelijk('deadline: Afgewezen -> geen', deadlineVeldBij('rejected'), 'geen');
const finSrc = zonderCommentaar(lees('src/data/services/projectFinanciering.js'));
const insertBlok = finSrc.slice(finSrc.indexOf('export async function voegFinancierToe'), finSrc.indexOf('export async function werkRegelBij'));
check('voegFinancierToe schrijft alleen naar subsidie_kompas_program_funding (geen tweede structuur)', (insertBlok.match(/\.from\('([a-z_]+)'\)/g) || []).join() === ".from('subsidie_kompas_program_funding')");
check('financier op naam: financier_naam, geen scheme_id/funder_id (geen fuzzy koppeling)', /financier_naam: schoon/.test(insertBlok) && !/scheme_id|funder_id/.test(insertBlok));
check('eigen deadline alleen bij Interessant/In voorbereiding/Aangevraagd en alleen als echte datum', /\['interesting', 'preparing', 'submitted'\]\.indexOf\(status\)/.test(insertBlok) && /\\d\{4\}-\\d\{2\}-\\d\{2\}/.test(insertBlok));
const pfSrc = lees('src/features/kompas-app/projectdossier/ProjectfinancieringTab.jsx');
check('Financier snel toevoegen staat bij Fondsen en dekkingsplan (één plek, dezelfde financiering); het projectprofiel herhaalt dat niet', /<FinancierFormulier\s+projectId=\{project.id\}/.test(pfSrc) && !/CofinanciersSectie/.test(detail));
check('per financieringsregel: Bespreek met Subsidie Kompas (focus = fundingId)', /<BespreekLink projectId=\{regel.projectId\} fundingId=\{regel.id\}/.test(pfSrc));
const tabSrc = lees('src/features/kompas-app/projectdossier/ProjectfinancieringTab.jsx');
check('Projectfinanciering gebruikt hetzelfde formulier (één implementatie)', /FinancierFormulier/.test(tabSrc) && !/function FinancierToevoegen/.test(tabSrc));

console.log(`\n${ok} geslaagd, ${fail} mislukt`);
process.exit(fail ? 1 : 0);
