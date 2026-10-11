// Fase 2: node-tests voor de rekenmodule (financiering/dekkingsplan.js), de regel-afleiding uit
// kompas_dekkingsplan (maskering, verwijderde bron, deadlines) en statische controles dat de
// verboden onderdelen (askKompas, Edge Function, matching, documentgeneratie) niet zijn aangeraakt
// en dat linked_schemes niet meer wordt geschreven.
//   node tests/werkruimte/dekkingsplan.test.mjs   (vanuit de repo-root)
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  LABEL_BRON_VERBORGEN,
  LABEL_BRON_VERWIJDERD,
  STATUSSEN,
  STATUS_LABEL,
  aantalNietMeegetelleCofinanciers,
  bedragVoorInvoer,
  berekenDekking,
  deadlineVergelijking,
  dekkingVanProject,
  eerstvolgendeDeadline,
  formatEuro,
  komendeDeadlines,
  leesBedragInvoer,
  overigeDekkingVanProject,
  pasWijzigingToe,
  patchVoorDatabase,
  projectBedrag,
  regelBedrag,
  regelUitRpc,
} from '../../src/features/kompas-app/financiering/dekkingsplan.js';
import { bouwDashboard } from '../../src/features/kompas-app/dashboard/dashboardData.js';

let ok = 0;
let fail = 0;
const check = (naam, cond, extra = '') => {
  if (cond) ok += 1;
  else {
    fail += 1;
    console.log('FAIL:', naam, extra);
  }
};
const gelijk = (naam, a, b) => check(naam, JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
const NU = new Date(2026, 9, 11, 10, 0, 0);

const rg = (status, requested, awarded = null, extra = {}) => ({ status, requested, awarded, ...extra });

// ---------- constanten ----------
gelijk('vijf statussen', STATUSSEN, ['interesting', 'preparing', 'submitted', 'awarded', 'rejected']);
gelijk('statuslabels Nederlands', STATUSSEN.map((s) => STATUS_LABEL[s]), ['Interessant', 'In voorbereiding', 'Aangevraagd', 'Toegekend', 'Afgewezen']);
gelijk('label verborgen bron', LABEL_BRON_VERBORGEN, 'Premium-fonds, niet zichtbaar in uw abonnement');
gelijk('label verwijderde bron', LABEL_BRON_VERWIJDERD, 'Bron niet meer beschikbaar');

// ---------- bedragen ----------
gelijk('projectBedrag: getal/tekst/leeg/ongeldig', [projectBedrag(85000), projectBedrag('€ 85.000'), projectBedrag(''), projectBedrag(null), projectBedrag(-5), projectBedrag('abc'), projectBedrag(NaN)], [85000, 85000, 0, 0, 0, 0, 0]);
gelijk('regelBedrag: numeric uit DB, leeg/ongeldig = null', [regelBedrag(1500.5), regelBedrag('1500'), regelBedrag(''), regelBedrag(null), regelBedrag(-1), regelBedrag('x')], [1500.5, 1500, null, null, null, null]);
gelijk('invoer: leeg = geen bedrag', leesBedragInvoer(''), { ok: true, waarde: null });
gelijk('invoer: 12500 / 12.500 / € 12.500', [leesBedragInvoer('12500').waarde, leesBedragInvoer('12.500').waarde, leesBedragInvoer('€ 12.500').waarde], [12500, 12500, 12500]);
gelijk('invoer: decimalen met komma', [leesBedragInvoer('12.500,50').waarde, leesBedragInvoer('12500,5').waarde], [12500.5, 12500.5]);
check('invoer: onzin is ongeldig (geen raden)', ['abc', '12abc', '-5', '1,2,3', '12.50.0x', '1e5'].every((x) => leesBedragInvoer(x).ok === false));
gelijk('bedragVoorInvoer rondreis', [bedragVoorInvoer(null), bedragVoorInvoer(12500), leesBedragInvoer(bedragVoorInvoer(12500)).waarde], ['', '12.500', 12500]);
gelijk('formatEuro', formatEuro(12500), '€ 12.500');

// ---------- Test 12: project zonder financiering werkt ----------
{
  const d = dekkingVanProject({ id: 'p', begroting: 50000 }, []);
  gelijk('12: zonder regels: alles 0, nog te financieren = begroting', [d.toegekend, d.aangevraagd, d.overige, d.nogNodig], [0, 0, 0, 50000]);
  const u = dekkingVanProject({ id: 'p', begroting: 50000 }, undefined);
  gelijk('12: regels undefined werkt', u.nogNodig, 50000);
  const n = dekkingVanProject(null, null);
  check('12: null project en null regels crashen niet, geen NaN', Object.values(n).every((x) => typeof x !== 'number' || Number.isFinite(x)) && n.nogNodig === 0);
}
// ---------- Test 13: begroting zonder financiering ----------
{
  const d = dekkingVanProject({ id: 'p', begroting: '€ 80.000', eigenBijdrage: 0 }, []);
  check('13: begroting zonder financiering: heeftBegroting, nog = begroting, niet volledig gedekt', d.heeftBegroting && d.nogNodig === 80000 && !d.volledigGedekt);
  check('13: balk is volledig "nog te financieren"', d.segmenten.nogNodig === 100 && d.segmenten.toegekend === 0);
}
// ---------- Test 14: awarded_amount-terugval ----------
{
  gelijk('14: awarded leeg -> requested', berekenDekking({ begroting: 1000, regels: [rg('awarded', 400, null)] }).toegekend, 400);
  gelijk('14: awarded gevuld wint', berekenDekking({ begroting: 1000, regels: [rg('awarded', 400, 250)] }).toegekend, 250);
  gelijk('14: awarded 0 is een bewust bedrag (telt 0)', berekenDekking({ begroting: 1000, regels: [rg('awarded', 400, 0)] }).toegekend, 0);
  gelijk('14: beide leeg -> 0', berekenDekking({ begroting: 1000, regels: [rg('awarded', null, null)] }).toegekend, 0);
  gelijk('14: ongeldige tekst telt als leeg', berekenDekking({ begroting: 1000, regels: [rg('awarded', 400, 'x')] }).toegekend, 400);
  gelijk('14: alleen awarded telt als toegekend', berekenDekking({ begroting: 1000, regels: [rg('interesting', 1), rg('preparing', 1), rg('submitted', 1), rg('rejected', 1)] }).toegekend, 0);
  gelijk('14: submitted telt requested (niet awarded)', berekenDekking({ begroting: 1000, regels: [rg('submitted', 300, 999)] }).aangevraagd, 300);
}
// ---------- Test 15: nooit negatief ----------
{
  const d = berekenDekking({ begroting: 1000, regels: [rg('awarded', 900), rg('submitted', 900)], overige: 500 });
  check('15: nog te financieren nooit negatief', d.nogNodig === 0);
  check('15: segmenten nooit negatief en sommeren tot ≤ 100', Object.values(d.segmenten).every((x) => x >= 0) && Object.values(d.segmenten).reduce((a, b) => a + b, 0) <= 100.01);
  check('15: geen NaN bij begroting 0', Object.values(berekenDekking({ begroting: 0, regels: [rg('awarded', 5)], overige: 1 }).segmenten).every((x) => x === 0));
}
// ---------- Test 16: Volledig gedekt ----------
{
  check('16: gedekt tot op het bedrag = volledig gedekt', berekenDekking({ begroting: 1000, regels: [rg('awarded', 600), rg('submitted', 400)] }).volledigGedekt === true);
  check('16: 1 euro tekort = niet volledig gedekt', berekenDekking({ begroting: 1000, regels: [rg('awarded', 600), rg('submitted', 399)] }).volledigGedekt === false);
  check('16: zonder begroting nooit "volledig gedekt"', berekenDekking({ begroting: 0, regels: [rg('awarded', 5)] }).volledigGedekt === false);
}
// ---------- Overige dekking: alleen betrouwbaar kwantitatief ----------
{
  const p = { eigenBijdrage: '€ 10.000', cofin: [{ naam: 'Gemeente', bedrag: '€ 5.000 of meer', status: 'Toegezegd' }, { naam: 'Bank', bedrag: '', status: 'Aangevraagd' }, { naam: '', bedrag: '' }] };
  gelijk('overige = alleen eigen bijdrage; geen tekstparsing van co-financiers', overigeDekkingVanProject(p), 10000);
  gelijk('niet-meegeteld aantal co-financiers (lege rij telt niet)', aantalNietMeegetelleCofinanciers(p), 2);
  gelijk('geen eigen bijdrage -> 0', overigeDekkingVanProject({ cofin: [{ naam: 'X', bedrag: '9999' }] }), 0);
}
// ---------- Test 17: Dashboard = dossier ----------
{
  const project = { id: 'p1', naam: 'P', begroting: 100000, eigenBijdrage: 10000, cofin: [] };
  const regels = [rg('awarded', 30000), rg('submitted', 20000, null)].map((r, i) => ({ id: `r${i}`, naam: `R${i}`, funder: '', deadline: null, reminder: true, ...r }));
  const dossier = dekkingVanProject(project, regels);
  const dash = bouwDashboard({ projects: [project], funding: { p1: regels }, conversations: [], orgProfile: {}, nu: NU }).projecten[0].dekking;
  gelijk('17: Dashboard-totalen identiek aan dossier-totalen (zelfde functie, zelfde bron)', dash, dossier);
}

// ---------- Test 20/21: regel uit RPC: maskering, verwijderde bron, deadlines zonder snapshot ----------
{
  const basis = { id: 'f1', program_id: 'p1', requested_amount: '2000', awarded_amount: null, status: 'interesting', eigen_deadline: null, reminder_enabled: true, notes: 'Eigen notitie', created_at: '2026-10-01T10:00:00Z' };
  const zicht = regelUitRpc({ ...basis, bron_type: 'regeling', bron_status: 'zichtbaar', scheme_id: 's1', bron_naam: 'Buurtbudget', funder_naam: 'Gemeente', website: 'https://x.nl', systeem_deadline: '2026-11-15', systeem_deadline_bron: 'regeling', effectieve_deadline: '2026-11-15' });
  gelijk('zichtbaar: naam, funder, website, systeemdeadline', [zicht.naam, zicht.funder, zicht.website, zicht.systeemDeadline, zicht.deadline], ['Buurtbudget', 'Gemeente', 'https://x.nl', '2026-11-15', '2026-11-15']);
  gelijk('bedragen komen als getal (numeric uit DB als tekst)', [zicht.requested, zicht.awarded], [2000, null]);

  // Test 8/9 (frontend-kant): verborgen bron lekt niets, eigen velden blijven
  const verborgen = regelUitRpc({ ...basis, bron_type: 'regeling', bron_status: 'verborgen', scheme_id: 'MAG-NIET', funder_id: 'MAG-NIET', bron_naam: 'GEHEIM', funder_naam: 'GEHEIM', website: 'https://geheim.nl', systeem_deadline: '2026-12-01', systeem_deadline_bron: 'regeling', effectieve_deadline: '2026-12-01', eigen_deadline: '2026-11-12' });
  gelijk('verborgen: Premium-label als naam', verborgen.naam, LABEL_BRON_VERBORGEN);
  check('verborgen: geen id, funder, website of systeemdeadline, ook niet als de server ze (foutief) meestuurt', !verborgen.schemeId && !verborgen.funderId && verborgen.funder === '' && verborgen.website === '' && verborgen.systeemDeadline === null && verborgen.systeemDeadlineBron === null);
  check('verborgen: JSON bevat de geheime waarden nergens', !JSON.stringify(verborgen).includes('GEHEIM') && !JSON.stringify(verborgen).includes('MAG-NIET') && !JSON.stringify(verborgen).includes('2026-12-01'));
  check('verborgen: eigen bedragen, status, eigen deadline, herinnering en notitie blijven', verborgen.requested === 2000 && verborgen.status === 'interesting' && verborgen.eigenDeadline === '2026-11-12' && verborgen.reminder === true && verborgen.notitie === 'Eigen notitie');
  gelijk('verborgen: deadline = eigen datum', verborgen.deadline, '2026-11-12');
  check('verborgen: geen vergelijking "Uw datum/Regeling" (systeemdatum onbekend)', deadlineVergelijking(verborgen) === null);

  // Test 21: verwijderde bron
  const weg = regelUitRpc({ ...basis, bron_type: null, bron_status: 'verwijderd' });
  check('21: verwijderde bron: label "Bron niet meer beschikbaar", eigen gegevens blijven', weg.naam === 'Bron niet meer beschikbaar' && weg.bronStatus === 'verwijderd' && weg.requested === 2000 && weg.notitie === 'Eigen notitie');

  // Test 20: eigen deadline overschrijft, geen snapshot
  const met = regelUitRpc({ ...basis, bron_status: 'zichtbaar', bron_naam: 'R', systeem_deadline: '2026-11-15', systeem_deadline_bron: 'regeling', eigen_deadline: '2026-11-12', effectieve_deadline: '2026-11-12' });
  gelijk('20: eigen deadline wint van brondatum', met.deadline, '2026-11-12');
  gelijk('20: vergelijking toont beide datums', deadlineVergelijking(met), { eigen: '12 november', systeem: '15 november', bronLabel: 'Regeling' });
  const zonder = regelUitRpc({ ...basis, bron_status: 'zichtbaar', bron_naam: 'R', systeem_deadline: '2026-11-20', systeem_deadline_bron: 'ronde', eigen_deadline: null, effectieve_deadline: '2026-11-20' });
  gelijk('20: zonder eigen datum volgt de live brondatum (regeling gewijzigd = zichtbaar zonder migratie)', [zonder.deadline, deadlineVergelijking(zonder)], ['2026-11-20', null]);
  check('20: gelijke datums geven geen vergelijking', deadlineVergelijking({ eigenDeadline: '2026-11-15', systeemDeadline: '2026-11-15' }) === null);
  gelijk('20: pasWijzigingToe: eigen datum wissen valt terug op de brondatum', pasWijzigingToe(met, { eigenDeadline: null }).deadline, '2026-11-15');
  gelijk('20: pasWijzigingToe: eigen datum zetten wint', pasWijzigingToe(zonder, { eigenDeadline: '2026-11-18' }).deadline, '2026-11-18');
  check('regel heeft geen kopieën van naam/budget/deadline-snapshot in het schrijfpad', Object.keys(patchVoorDatabase({ naam: 'X', budget: 1, deadline: '2026-01-01', program_id: 'p', scheme_id: 's', user_id: 'u' })).length === 0);
}
{
  gelijk('onbekende status valt terug op interesting', regelUitRpc({ id: 'x', status: 'raar' }).status, 'interesting');
  gelijk('ontbrekende reminder = aan', regelUitRpc({ id: 'x' }).reminder, true);
  gelijk('regelUitRpc(null) crasht niet', regelUitRpc(null).bronStatus, 'zichtbaar');
}
// ---------- patchVoorDatabase ----------
{
  gelijk('patch: alleen toegestane velden, databasenamen', patchVoorDatabase({ requested: 100, awarded: '200', status: 'awarded', eigenDeadline: '2026-11-12', reminder: false, notitie: ' hoi ' }), { requested_amount: 100, awarded_amount: 200, status: 'awarded', eigen_deadline: '2026-11-12', reminder_enabled: false, notes: ' hoi ' });
  gelijk('patch: ongeldige status wordt genegeerd', patchVoorDatabase({ status: 'hack' }), {});
  gelijk('patch: lege notitie en lege datum worden null', patchVoorDatabase({ notitie: '   ', eigenDeadline: '' }), { notes: null, eigen_deadline: null });
  gelijk('patch: bedrag leeg = null', patchVoorDatabase({ requested: '' }), { requested_amount: null });
  check('patch: notitie max 4000 tekens', patchVoorDatabase({ notitie: 'x'.repeat(5000) }).notes.length === 4000);
}
// ---------- deadlines over regels ----------
{
  const regels = [
    { id: 'a', naam: 'A', status: 'interesting', deadline: '2026-10-11', reminder: true },
    { id: 'b', naam: 'B', status: 'preparing', deadline: '2026-12-01', reminder: false },
    { id: 'c', naam: 'C', status: 'submitted', deadline: '2026-10-20' },
    { id: 'd', naam: 'D', status: 'interesting', deadline: '2026-10-01' },
    { id: 'e', naam: 'E', status: 'interesting', deadline: null },
  ];
  gelijk('eerstvolgende = vandaag telt mee, aangevraagd/verstreken/zonder datum niet', eerstvolgendeDeadline(regels, NU).naam, 'A');
  const kd = komendeDeadlines([{ id: 'p1', naam: 'P' }], { p1: regels }, NU);
  gelijk('komende deadlines: A en B, gesorteerd', kd.map((x) => x.naam), ['A', 'B']);
  gelijk('komende deadlines: herinnering-vlag meegegeven', kd.map((x) => x.reminder), [true, false]);
}

// ---------- statische controles ----------
const lees = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const loop = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? loop(p) : [p]; });
{
  const projecten = lees('src/data/services/projecten.js');
  const patch = projecten.slice(projecten.indexOf('function naarKolomPatch'), projecten.indexOf('function naarDocVeld'));
  check('18: linked_schemes wordt niet meer geschreven (geen sleutel in naarKolomPatch)', !/^\s*linked_schemes\s*:/m.test(patch));
  check('18: linked_schemes-kolom wordt nog wel gelezen (legacy/rollback)', /rij\.linked_schemes/.test(projecten));
  check('18: geen enkele insert/update/upsert-payload bevat linked_schemes', !/^\s*linked_schemes\s*:/m.test(projecten.replace(/\/\/.*$/gm, '')));

  const store = lees('src/features/kompas-app/KompasStore.jsx');
  check('18: de tijdelijke insert addRegelingToProject (Fase 2) bestaat niet meer; toevoegen loopt via financiering/toevoegen.js', !/addRegelingToProject|voegRegelToe/.test(store.replace(/\/\/.*$/gm, '')) && /voegRegelToe/.test(lees('src/features/kompas-app/financiering/toevoegen.js')));

  // Test 19: Overzicht gebruikt alleen projectgegevens
  const detail = lees('src/features/kompas-app/projectdossier/ProjectDetailPage.jsx');
  const overzicht = detail.slice(detail.indexOf('function OverzichtTab'), detail.indexOf('function DocumentenTab'));
  check('19: Overzicht-tab gebruikt geen financieringsdata (geen financiering/regels/RPC)', !/financiering|regels|dekking|rpc/i.test(overzicht));
  check('19: Overzicht leest uit de projectprop (subsidie_kompas_programs via de store)', /project\.omschrijving/.test(overzicht));
  check('dossier: geen hoofdmenu-item en route valt onder Projecten', !/Projectdossier/.test(lees('src/features/kompas-app/KompasWerkNav.jsx')));
  check('dossier: tabs Overzicht, Projectfinanciering, Documenten, Gesprekken', ['overzicht', 'projectfinanciering', 'documenten', 'gesprekken'].every((t) => detail.includes(`id: '${t}'`)));
  check('dossier: Free ziet geen financiering (hook krijgt null zonder plan)', /useProjectFinanciering\(project && paid \? projectId : null\)/.test(detail));
  check('dossier: Bespreek met Subsidiekompas gebruikt alleen de chatverzoek-handoff', /store\.zetChatVerzoek/.test(detail) && !/askKompas|functions\.invoke/.test(detail));

  const dash = lees('src/features/kompas-app/dashboard/DashboardPage.jsx');
  check('dashboard: Free haalt geen dekkingsplannen op (lege id-lijst)', /paid \? \(store\.projects/.test(dash));

  const svc = lees('src/data/services/projectFinanciering.js');
  check('service: leest alleen via kompas_dekkingsplan, nooit rechtstreeks uit funders/regelingen/rondes', /rpc\('kompas_dekkingsplan'/.test(svc) && !/from\('(funders|subsidieregelingen|subsidieregeling_rondes|funder_datamomenten)'\)/.test(svc.replace(/\/\/.*$/gm, '')));
  check('service: schrijft alleen naar subsidie_kompas_program_funding', (svc.match(/\.from\('([^']+)'\)/g) || []).every((m) => m.includes('subsidie_kompas_program_funding')));
  check('service: geen kopie van naam/budget/deadline in de insert', !/(naam|name|budget|deadline)\s*:/.test(svc.slice(svc.indexOf('.insert('), svc.indexOf('.select(\'id\')'))));

  // Test 22-26: verboden onderdelen niet aangeraakt (geen verwijzing naar de nieuwe bron)
  const nieuweBron = /kompas_dekkingsplan|program_funding|financiering\/dekkingsplan|services\/projectFinanciering|useProjectFinanciering/;
  const zonderCommentaar = (t) => t.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const verboden = [
    'supabase/functions/subsidie-kompas/index.ts',
    'src/features/kompas-app/KompasToolPage.jsx',
    'src/features/kompas-app/useKompasApp.js',
  ];
  // Fase 5 koppelt de chat bewust aan de fundingbron, maar uitsluitend binnen met FASE5-BEGIN/FASE5-END gemarkeerde
  // blokken; daarbuiten (en in useKompasApp.js) blijft elke verwijzing verboden.
  const zonderFase5 = (t) => t.replace(/\/\/ FASE5-BEGIN[\s\S]*?\/\/ FASE5-END/g, '').replace(/\{\/\* FASE5-BEGIN[\s\S]*?FASE5-END \*\/\}/g, '');
  verboden.forEach((f) => check(`22: ${f} verwijst buiten de FASE5-blokken niet naar de nieuwe fundingbron (askKompas/chat/Edge Function ongewijzigd)`, !nieuweBron.test(zonderFase5(lees(f)))));
  const bestanden = [...loop('src/data'), ...loop('src/shared')].filter((f) => /\.(js|jsx|ts)$/.test(f) && !f.endsWith('projectFinanciering.js'));
  const raak = bestanden.filter((f) => nieuweBron.test(zonderCommentaar(readFileSync(f, 'utf8'))));
  check('23: geen enkele matching-/fondsadvies-/export-/documentgeneratiecode gebruikt de nieuwe fundingbron ', raak.length === 0, raak.join(', '));
  const migraties = loop('supabase/migrations').filter((f) => f.endsWith('.sql'));
  const metFunding = migraties.filter((f) => /create table[^;]*subsidie_kompas_program_funding/i.test(readFileSync(f, 'utf8')));
  check('24: de migratie staat precies één keer in supabase/migrations onder de live versie (20261011104804), niet meer als voorstel; rollback apart', metFunding.length === 1 && metFunding[0].endsWith('20261011104804_project_funding_fase2.sql') && !existsSync('supabase/voorstel-niet-uitgevoerd/20261011130000_project_funding.sql') && existsSync('supabase/voorstel-niet-uitgevoerd/20261011104804_project_funding_fase2_rollback.sql'));
  check('25: Edge Function subsidie-kompas houdt verify_jwt=false', !/subsidie-kompas[\s\S]{0,200}verify_jwt\s*=\s*true/.test(existsSync('supabase/config.toml') ? readFileSync('supabase/config.toml', 'utf8') : ''));
  check('26: geen secrets of Stripe-sleutels in de nieuwe bestanden', ['src/features/kompas-app/financiering', 'src/features/kompas-app/projectdossier'].flatMap(loop).every((f) => !/sk_live_|whsec_|sk_test_/.test(readFileSync(f, 'utf8'))));
}

console.log(`${ok} geslaagd, ${fail} mislukt`);
process.exit(fail ? 1 : 0);
