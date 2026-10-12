import { readFileSync } from 'node:fs';
import {
  PI_VELDEN, PI_GROEPEN, PI_KEYS, PI_PROJECTBREED, PI_VERSIE, actieveVelden, leesProjectinformatie, schrijfProjectinformatie, voortgang,
  programmaSuggesties, paneelVelden, paneelProjectbreed, schrijfPaneel,
} from '../../src/features/kompas-app/projectinformatie/projectinformatie.js';
import { valideerEnBereidOp } from '../../src/features/kompas-app/projectOpslaan.js';
import { naarKolomPatch } from '../../src/data/services/projecten.js';

let ok = 0; let fail = 0;
const check = (n, c, d = '') => { if (c) { ok += 1; console.log('OK  ', n); } else { fail += 1; console.log('FAIL', n, d); } };
const gelijk = (n, a, b) => check(n, JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} !== ${JSON.stringify(b)}`);

console.log('== 1. Definitie');
gelijk('22 velden', PI_VELDEN.length, 22);
check('sleutels uniek', new Set(PI_KEYS).size === 22);
check('elk veld hoort bij een bestaande groep', PI_VELDEN.every((v) => PI_GROEPEN.some((g) => g.id === v.groep)));
check('opslag is kolom of json', PI_VELDEN.every((v) => v.opslag === 'kolom' || v.opslag === 'json'));
check('kolomvelden noemen een projectveld, jsonvelden niet', PI_VELDEN.every((v) => (v.opslag === 'kolom') === Boolean(v.project)));
gelijk('6 kolomvelden actief in fase 1', actieveVelden().map((v) => v.key), ['doelstelling', 'activiteiten', 'samenwerking', 'impact', 'resultaten', 'planning']);
gelijk('16 jsonvelden gereserveerd voor fase 2', PI_VELDEN.filter((v) => v.opslag === 'json').length, 16);
gelijk('projectbrede instellingen: programma en schrijfvoorkeur', PI_PROJECTBREED.map((v) => v.key), ['programma', 'schrijfvoorkeur']);
check('sleutels zijn stabiel (documentatie in README noemt alle 22)', (() => { const r = readFileSync('src/features/kompas-app/projectinformatie/README.md', 'utf8'); return PI_KEYS.every((k) => r.includes(k)); })());

console.log('\n== 2. Lezen en schrijven zonder verlies');
const project = { id: 'p1', naam: 'X', doelstellingen: 'D', activiteiten: 'A', partners: 'P', impact: 'I', resultaten: 'R', planning: 'PL', programma: 'Prog', schrijfvoorkeur: 'warm', omschrijving: 'O', begroting: 1000, eigenBijdrage: 100, cofin: [{ naam: 'C' }], bronnen: { doelstellingen: 'upload' } };
const l = leesProjectinformatie(project);
gelijk('kolomvelden komen uit de bestaande projectvelden', [l.doelstelling, l.activiteiten, l.samenwerking, l.impact, l.resultaten, l.planning], ['D', 'A', 'P', 'I', 'R', 'PL']);
check('jsonvelden zijn leeg zolang project_info niet bestaat', PI_VELDEN.filter((v) => v.opslag === 'json').every((v) => l[v.key] === ''));
gelijk('round-trip zonder wijziging laat het project identiek', schrijfProjectinformatie(project, l), project);
const w = schrijfProjectinformatie(project, { doelstelling: 'D2' });
gelijk('alleen de genoemde key verandert', [w.doelstellingen, w.activiteiten, w.partners, w.naam, w.omschrijving, w.begroting, w.cofin], ['D2', 'A', 'P', 'X', 'O', 1000, [{ naam: 'C' }]]);
check('onbekende keys worden genegeerd', JSON.stringify(schrijfProjectinformatie(project, { onzin: 'x' })) === JSON.stringify(project));
check('invoerproject wordt niet gemuteerd', project.doelstellingen === 'D');
const metJson = { ...project, projectInfo: { versie: 1, velden: { aanleiding: 'Probleem', risicos: 'R1' } } };
gelijk('jsonvelden worden gelezen uit projectInfo.velden (fase 2)', [leesProjectinformatie(metJson).aanleiding, leesProjectinformatie(metJson).risicos], ['Probleem', 'R1']);
const w2 = schrijfProjectinformatie(metJson, { doelstelling: 'D3' });
gelijk('bestaande jsonvelden blijven bij een kolomwijziging behouden', w2.projectInfo, metJson.projectInfo);
const w3 = schrijfProjectinformatie(metJson, { borging: 'B' });
gelijk('jsonveld schrijven behoudt de andere jsonvelden en zet versie', [w3.projectInfo.versie, w3.projectInfo.velden], [PI_VERSIE, { aanleiding: 'Probleem', risicos: 'R1', borging: 'B' }]);

console.log('\n== 3. Paneel (programma en schrijfvoorkeur)');
gelijk('paneel toont alleen actieve velden', paneelVelden(project).map((v) => v.key), actieveVelden().map((v) => v.key));
gelijk('herkomst per veld uit project.bronnen', paneelVelden(project).find((v) => v.key === 'doelstelling').bron, 'upload');
gelijk('paneelProjectbreed: waarden', paneelProjectbreed(project).map((v) => v.waarde), ['Prog', 'warm']);
const s = schrijfPaneel(project, { programma: 'Nieuw', schrijfvoorkeur: 'zakelijk', planning: 'Q2' });
gelijk('schrijfPaneel zet programma, schrijfvoorkeur en kolomvelden', [s.programma, s.schrijfvoorkeur, s.planning, s.doelstellingen], ['Nieuw', 'zakelijk', 'Q2', 'D']);
gelijk('programmasuggesties: uniek, gesorteerd, zonder leeg', programmaSuggesties([{ programma: 'B' }, { programma: 'a' }, { programma: 'B' }, { programma: '' }, {}]), ['a', 'B']);
gelijk('voortgang: 6 van 6', [voortgang(project).ingevuld, voortgang(project).totaal], [6, 6]);
gelijk('voortgang: leeg project 0 van 6', [voortgang({}).ingevuld, voortgang({}).totaal], [0, 6]);
gelijk('voortgang: spaties tellen niet', voortgang({ doelstellingen: '   ' }).ingevuld, 0);
gelijk('voortgang over alle 22: 6 van 22', [voortgang(project, false).ingevuld, voortgang(project, false).totaal], [6, 22]);

console.log('\n== 4. Opslag naar bestaande databasekolommen (geen schemawijziging)');
const patch = naarKolomPatch({ ...project, periodeVan: '2027-01-01', periodeTot: '2027-12-31' });
gelijk('doelstelling -> goals, activiteiten -> activities, samenwerking -> partners, impact -> impact_description, resultaten -> results, planning -> planning, programma -> program_label, schrijfvoorkeur -> writing_preferences',
  [patch.goals, patch.activities, patch.partners, patch.impact_description, patch.results, patch.planning, patch.program_label, patch.writing_preferences], ['D', 'A', 'P', 'I', 'R', 'PL', 'Prog', 'warm']);
check('geen project_info in de patch (geen databasewijziging in fase 1)', !('project_info' in patch));

console.log('\n== 5. Gedeelde validatie compact formulier');
gelijk('naam verplicht', valideerEnBereidOp({ naam: ' ' }).ok, false);
gelijk('einddatum voor startdatum geweigerd', valideerEnBereidOp({ naam: 'X', periodeVan: '2027-05-01', periodeTot: '2027-01-01' }).ok, false);
gelijk('oude vrije-tekst looptijd blokkeert niet', valideerEnBereidOp({ naam: 'X', periodeVan: 'Q1 2027', periodeTot: '2027-01-01' }).ok, true);
gelijk('ongeldig bedrag geweigerd', valideerEnBereidOp({ naam: 'X', begroting: '12x' }).ok, false);
const v = valideerEnBereidOp({ naam: 'X', begroting: '€ 10.000', eigenBijdrage: '2.500', doelstellingen: 'blijft' });
gelijk('gevraagd = begroting - eigen bijdrage; overige velden blijven', [v.ok, v.project.begroting, v.project.eigenBijdrage, v.project.gevraagd, v.project.doelstellingen], [true, 10000, 2500, 7500, 'blijft']);
gelijk('zonder begroting blijft gevraagd leeg', valideerEnBereidOp({ naam: 'X' }).project.gevraagd, '');

console.log('\n== 6. Matching en financiering ongemoeid');
const lees = (p) => readFileSync(p, 'utf8');
check('projectinformatie.js importeert niets (pure module)', !/^import /m.test(lees('src/features/kompas-app/projectinformatie/projectinformatie.js')));
check('Edge Function en migraties niet verwezen door fase 1', !/supabase/i.test(lees('src/features/kompas-app/projectinformatie/projectinformatie.js').replace(/\/\/.*$/gm, '')));
check('compact formulier gebruikt teFinancieren, geen eigen berekening', /teFinancieren/.test(lees('src/features/kompas-app/projectOpslaan.js')));

console.log(`\n${ok} geslaagd, ${fail} mislukt`);
process.exit(fail ? 1 : 0);
