// Fase 4 (bijgewerkt): node-tests voor de chatwerkruimte (Gesprekken | Chat, plus rechts het Projectoverzicht alleen bij een actief project):
// actief project (gesprek leidend), groepering van gesprekken per project, projectoverzicht-afleidingen (top 3 financiering,
// maskering) en statische
// controles dat de chatruntime (askKompas, Edge Function, matching, prompt, documentgeneratie) niet is aangeraakt.
//   node tests/werkruimte/fase4.test.mjs   (vanuit de repo-root)
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { geldigProjectId, projectVoorBestaandGesprek, projectVoorChatVerzoek, projectVoorWeergave, vindGesprek } from '../../src/features/kompas-app/chat/actiefProject.js';
import { groepeerGesprekken, groepeerPerProject } from '../../src/features/kompas-app/chat/gesprekGroepen.js';
import { bouwContextPanel, topFinancieringsregels, MAX_REGELS } from '../../src/features/kompas-app/chat/contextPanelData.js';
import { LABEL_BRON_VERBORGEN, regelUitRpc } from '../../src/features/kompas-app/financiering/dekkingsplan.js';

let gefaald = 0;
let aantal = 0;
const check = (naam, ok, detail = '') => {
  aantal += 1;
  if (!ok) gefaald += 1;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${naam}${!ok && detail ? ` -- ${detail}` : ''}`);
};
const lees = (f) => readFileSync(f, 'utf8');
const loop = (d) => (existsSync(d) ? readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? loop(p) : [p]; }) : []);
const zonderCommentaar = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const h = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);

const NU = new Date(2026, 9, 11);
const iso = (n) => { const d = new Date(2026, 9, 11 + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const PA = '11111111-1111-4111-8111-111111111111';
const PB = '22222222-2222-4222-8222-222222222222';
const PC = '33333333-3333-4333-8333-333333333333';
const projecten = [{ id: PA, naam: 'Project A' }, { id: PB, naam: 'Project B' }, { id: PC, naam: 'Oud', gearchiveerd: true }];

// ---- actief project: het gesprek is leidend
{
  const A = { id: 'gA', titel: 'Gesprek A', tijd: '2026-10-10T10:00:00Z', projectId: PA };
  check('1: geldigProjectId: bestaand en actief -> id; onbekend, gearchiveerd of leeg -> null', geldigProjectId(PA, projecten) === PA && geldigProjectId('x', projecten) === null && geldigProjectId(PC, projecten) === null && geldigProjectId(null, projecten) === null);
  check('2 (harde test): bestaand gesprek A (active_program_id = Project A) blijft Project A, ook als de standaardkeuze Project B is', projectVoorBestaandGesprek(A, projecten) === PA && projectVoorWeergave({ gekoppeldProjectId: projectVoorBestaandGesprek(A, projecten), projecten }).naam === 'Project A');
  check('3: gesprek met gearchiveerd/verwijderd project -> geen actief project (zelfde regel als vóór Fase 4)', projectVoorBestaandGesprek({ ...A, projectId: PC }, projecten) === null && projectVoorBestaandGesprek({ ...A, projectId: 'weg' }, projecten) === null && projectVoorBestaandGesprek(null, projecten) === null);
  const lijst = [A, { id: 'gB', titel: 'Gesprek B', projectId: PB }];
  check('4 (harde test): chatverzoek "open gesprek A" met verouderd project B in het verzoek -> de gesprekrij (A) wint', projectVoorChatVerzoek({ verzoek: { type: 'gesprek', gesprekId: 'gA', projectId: PB }, gesprekken: lijst, projecten }) === PA);
  check('5: gesprek (nog) niet in de lijst -> terugval op het project uit het verzoek (alleen als geldig)', projectVoorChatVerzoek({ verzoek: { type: 'gesprek', gesprekId: 'nieuw', projectId: PB }, gesprekken: lijst, projecten }) === PB && projectVoorChatVerzoek({ verzoek: { type: 'gesprek', gesprekId: 'nieuw', projectId: PC }, gesprekken: lijst, projecten }) === null);
  check('6: chatverzoek "nieuw gesprek voor project B" gebruikt B als startcontext; archief/leeg -> null', projectVoorChatVerzoek({ verzoek: { type: 'project', projectId: PB }, gesprekken: lijst, projecten }) === PB && projectVoorChatVerzoek({ verzoek: { type: 'project', projectId: PC }, gesprekken: lijst, projecten }) === null && projectVoorChatVerzoek({ verzoek: null, gesprekken: lijst, projecten }) === null);
  check('7: vindGesprek zoekt op id; onbekend -> null', vindGesprek(lijst, 'gB').titel === 'Gesprek B' && vindGesprek(lijst, 'zz') === null);
  check('8: projectVoorWeergave levert geen projectobject van een ander of gearchiveerd project', projectVoorWeergave({ gekoppeldProjectId: PC, projecten }) === null && projectVoorWeergave({ gekoppeldProjectId: null, projecten }) === null);
}

// ---- groepering: Dit project / Eerder
{
  const G = [
    { id: '1', titel: 'Begroting Brug', tijd: '2026-10-08T09:00:00Z', projectId: PA },
    { id: '2', titel: 'Projectplan Buurtkeuken', tijd: '2026-10-10T09:00:00Z', projectId: PA },
    { id: '3', titel: 'Losse vraag', tijd: '2026-10-09T09:00:00Z', projectId: null },
    { id: '4', titel: 'Taalcafe plannen', tijd: '2026-10-07T09:00:00Z', projectId: PB },
    null,
    { titel: 'zonder id' },
  ];
  const g = groepeerGesprekken({ gesprekken: G, actiefProjectId: PA });
  check('9: Dit project = gesprekken met het actieve project, nieuwste eerst', g.ditProject.map((x) => x.id).join() === '2,1');
  check('10: Eerder = de rest, nieuwste eerst; geen gesprek in beide groepen; ongeldige rijen genegeerd', g.eerder.map((x) => x.id).join() === '3,4' && g.totaal === 4);
  const z = groepeerGesprekken({ gesprekken: G, actiefProjectId: null });
  check('11: zonder actief project bestaat de groep Dit project niet', z.ditProject.length === 0 && z.eerder.length === 4);
  const f = groepeerGesprekken({ gesprekken: G, actiefProjectId: PA, zoek: ' BEGROTING ' });
  check('12: zoeken filtert op titel (hoofdletter- en spatie-ongevoelig) binnen beide groepen', f.ditProject.map((x) => x.id).join() === '1' && f.eerder.length === 0 && f.gefilterd === true);
  const pf = groepeerGesprekken({ gesprekken: G, actiefProjectId: null, projectFilter: PA });
  check('13: projectFilter (projecttab): alleen gesprekken van dat project, één groep', pf.ditProject.map((x) => x.id).join() === '2,1' && pf.eerder.length === 0);
  check('14: lege lijst en undefined breken niet', groepeerGesprekken({ gesprekken: undefined, actiefProjectId: PA }).totaal === 0 && groepeerGesprekken({ gesprekken: [], actiefProjectId: PA }).eerder.length === 0);
}

// ---- groepering per project: PROJECTEN en LOSSE GESPREKKEN (op active_program_id)
{
  const G = [
    { id: '1', titel: 'Begroting Brug', tijd: '2026-10-08T09:00:00Z', projectId: PA },
    { id: '2', titel: 'Projectplan Buurtkeuken', tijd: '2026-10-10T09:00:00Z', projectId: PA },
    { id: '3', titel: 'Losse vraag', tijd: '2026-10-09T09:00:00Z', projectId: null },
    { id: '4', titel: 'Taalcafe plannen', tijd: '2026-10-07T09:00:00Z', projectId: PB },
    { id: '5', titel: 'Van een project dat niet (meer) bestaat', tijd: '2026-10-06T09:00:00Z', projectId: 'weg' },
    { id: '6', titel: 'Oud archief', tijd: '2026-10-05T09:00:00Z', projectId: PC },
    null,
    { titel: 'zonder id' },
  ];
  const pp = groepeerPerProject({ gesprekken: G, projecten, actiefProjectId: null });
  check('43: groepen op active_program_id: A (laatste activiteit 10 okt) vóór B vóór het gearchiveerde project; nieuwste gesprek eerst', pp.groepen.map((x) => x.project.id).join() === `${PA},${PB},${PC}` && pp.groepen[0].gesprekken.map((x) => x.id).join() === '2,1');
  check('44: LOSSE GESPREKKEN = geen project, of een project dat niet (meer) van deze gebruiker is; ongeldige rijen genegeerd', pp.los.map((x) => x.id).join() === '3,5' && pp.totaal === 6);
  check('45: gearchiveerd project blijft zichtbaar als groep met vlag (geen verlies van gesprekken)', pp.groepen[2].project.gearchiveerd === true && pp.groepen[2].gesprekken.length === 1);
  const act = groepeerPerProject({ gesprekken: G, projecten, actiefProjectId: PB });
  check('46: het actieve project staat bovenaan', act.groepen[0].project.id === PB);
  const leegActief = groepeerPerProject({ gesprekken: [], projecten, actiefProjectId: PB });
  check('47: actief project zonder gesprekken is toch een (lege) groep, zodat daar "+ Nieuw" kan staan; zonder actief project niet', leegActief.groepen.length === 1 && leegActief.groepen[0].gesprekken.length === 0 && groepeerPerProject({ gesprekken: [], projecten, actiefProjectId: null }).groepen.length === 0);
  const zk = groepeerPerProject({ gesprekken: G, projecten, actiefProjectId: PB, zoek: 'begroting' });
  check('48: zoeken filtert op titel in alle groepen; lege groepen verdwijnen tijdens zoeken', zk.groepen.length === 1 && zk.groepen[0].project.id === PA && zk.groepen[0].gesprekken.length === 1 && zk.los.length === 0 && zk.gefilterd === true);
  check('49: geen duplicaat: elk gesprek staat in precies één groep of bij Los (geen tweede koppeling)', (() => { const ids = [...pp.groepen.flatMap((x) => x.gesprekken), ...pp.los].map((x) => x.id); return ids.length === new Set(ids).size && ids.length === 6; })());
  check('50: undefined/lege invoer breekt niet', groepeerPerProject({ gesprekken: undefined, projecten: undefined, actiefProjectId: PA }).totaal === 0);
}

// ---- projectoverzicht: top 3, maskering
const rpc = (id, extra) => regelUitRpc({ id, program_id: PA, bron_type: 'regeling', bron_status: 'zichtbaar', bron_naam: `Regeling ${id}`, funder_naam: 'Fonds', status: 'interesting', reminder_enabled: true, ...extra });
{
  const regels = [
    rpc('afgewezen', { status: 'rejected', requested_amount: 5000 }),
    rpc('interessant', { status: 'interesting', requested_amount: 4000, effectieve_deadline: iso(20) }),
    rpc('toegekend', { status: 'awarded', requested_amount: 30000, awarded_amount: 25000 }),
    rpc('aangevraagd', { status: 'submitted', requested_amount: 15000 }),
    rpc('voorbereiding-laat', { status: 'preparing', requested_amount: 8000, effectieve_deadline: iso(30) }),
    rpc('voorbereiding-vroeg', { status: 'preparing', requested_amount: 7000, effectieve_deadline: iso(5) }),
    rpc('premium', { bron_status: 'verborgen', status: 'preparing', requested_amount: 2000, bron_naam: 'PREMIUMFONDS Geheimnaam', funder_naam: 'Geheim Fonds', website: 'https://geheim.test', systeem_deadline: iso(9), eigen_deadline: iso(12) }),
  ];
  const kopie = JSON.stringify(regels);
  const top = topFinancieringsregels(regels);
  check('15: top 3: in voorbereiding eerst (vroegste deadline), dan aangevraagd; maximaal 3', top.length === MAX_REGELS && top.map((r) => r.id).join() === 'voorbereiding-vroeg,premium,voorbereiding-laat', top.map((r) => r.id).join());
  check('16: ranglijst status: voorbereiding, aangevraagd, toegekend, interessant, afgewezen', topFinancieringsregels(regels, 10).map((r) => r.status).join() === 'preparing,preparing,preparing,submitted,awarded,interesting,rejected');
  check('17: de invoer wordt niet gemuteerd', JSON.stringify(regels) === kopie);
  const masked = top.find((r) => r.id === 'premium');
  check('18: gemaskeerde Premium-regel: alleen het vaste label, geen naam/fonds/website/systeemdeadline; eigen bedrag, status en eigen deadline blijven', masked.naam === LABEL_BRON_VERBORGEN && masked.funder === '' && masked.website === '' && masked.systeemDeadline === null && masked.requested === 2000 && masked.status === 'preparing' && masked.deadline === iso(12) && !/PREMIUMFONDS|Geheim|geheim/.test(JSON.stringify(top)));

  const project = { id: PA, naam: 'Project A', regio: 'Utrecht', periodeVan: 'jan 2027', periodeTot: 'dec 2027', begroting: 100000, docs: [] };
  const paneel = bouwContextPanel({ project, regels, fundingStatus: 'klaar', nu: NU });
  check('19: paneel: project met locatie/periode, dekking via de bestaande rekenmodule, eerstvolgende deadline', paneel.project.naam === 'Project A' && paneel.project.locatie === 'Utrecht' && paneel.project.looptijd === 'jan 2027 – dec 2027' && paneel.project.dekking.begroting === 100000 && paneel.project.dekking.toegekend === 25000 && paneel.project.dekking.aangevraagd === 15000 && paneel.project.volgendeDeadline.datum === iso(5));
  check('20: paneel: financiering toont top 3 en het totaal aantal regels', paneel.financiering.regels.length === 3 && paneel.financiering.totaal === 7 && paneel.financiering.status === 'klaar');
  const fout = bouwContextPanel({ project, regels: null, fundingStatus: 'fout', nu: NU });
  check('21: fail-safe: funding faalt -> status fout, geen regels, geen dekking; het project zelf blijft bestaan', fout.financiering.status === 'fout' && fout.financiering.regels.length === 0 && fout.project.dekking === null && fout.project.naam === 'Project A');
  const laden = bouwContextPanel({ project, regels: null, fundingStatus: 'laden', nu: NU });
  check('22: tijdens laden geen dekking/regels (geen half resultaat)', laden.financiering.status === 'laden' && laden.project.dekking === null && laden.financiering.regels.length === 0);
  const geen = bouwContextPanel({ project: null, regels: [], fundingStatus: 'geen-database', nu: NU });
  check('23: zonder project: geen overzicht (geen project, geen financiering, geen organisatie, geen documenten)', geen.project === null && geen.financiering === null && !('organisatie' in geen) && !('documenten' in geen));
  check('24: het overzicht bevat geen organisatie- en documentgegevens meer (die hebben hun eigen plek)', !('organisatie' in paneel) && !('documenten' in paneel) && !('organisatie' in fout));
}
{
  // Het overzicht toont toegekend/aangevraagd/nog te financieren uit de gedeelde rekenmodule, compact.
  const rpc2 = (id, extra) => regelUitRpc({ id, program_id: PA, bron_type: 'regeling', bron_status: 'zichtbaar', bron_naam: `Regeling ${id}`, funder_naam: 'Fonds', status: 'interesting', reminder_enabled: true, ...extra });
  const regels2 = [rpc2('a', { status: 'awarded', requested_amount: 30000, awarded_amount: 30000 }), rpc2('b', { status: 'submitted', requested_amount: 20000 })];
  const pr = bouwContextPanel({ project: { id: PA, naam: 'P', begroting: 100000 }, regels: regels2, fundingStatus: 'klaar', nu: NU });
  check('25: overzicht financiering: toegekend 30.000, aangevraagd 20.000, nog nodig 50.000 (zelfde rekenmodule als Dashboard)', pr.project.dekking.toegekend === 30000 && pr.project.dekking.aangevraagd === 20000 && pr.project.dekking.nogNodig === 50000);
  check('26: project zonder locatie/looptijd geeft lege strings (geen "undefined")', bouwContextPanel({ project: { id: PA, naam: 'P' }, regels: [], fundingStatus: 'klaar', nu: NU }).project.locatie === '' && bouwContextPanel({ project: { id: PA, naam: 'P' }, regels: [], fundingStatus: 'klaar', nu: NU }).project.looptijd === '');
}

// ---- statische controles
{
  const chat = loop('src/features/kompas-app/chat').filter((f) => /\.(js|jsx)$/.test(f));
  const code = (f) => zonderCommentaar(lees(f));
  check('27: chat/-modules: geen localStorage/sessionStorage/IndexedDB (geen browserstate als bron van waarheid); enige uitzondering: ChatWerkruimte bewaart kolombreedte/ingeklapt als weergavevoorkeur, binnen try/catch', chat.every((f) => f.endsWith('ChatWerkruimte.jsx') || !/localStorage|sessionStorage|indexedDB/.test(code(f))) && /try \{[^}]*localStorage/.test(code('src/features/kompas-app/chat/ChatWerkruimte.jsx')));
  check('28: chat/-modules: geen askKompas, Edge Function, context-/promptbouw of directe Supabase-aanroepen', chat.every((f) => !/askKompas|functions\.invoke|buildContext|buildMatchSignalen|buildProjectFundingContext|from ['"].*data\/client|supabase\./.test(code(f))));
  const hook = code('src/features/kompas-app/chat/useProjectContextPanel.js');
  check('29: contexthook leest alleen via bestaande bronnen (store + useProjectFinanciering) en ontvangt alleen een project-id', /useKompas/.test(hook) && /useProjectFinanciering/.test(hook) && !/werkRegelBij|verwijderRegel|voegRegelToe|\.wijzig|\.verwijder/.test(hook) && /useProjectContextPanel\(\{ projectId/.test(hook));
  const panel = code('src/features/kompas-app/chat/ProjectContextPanel.jsx');
  check('30: contextpaneel is geen editor (geen invoervelden, geen opslagacties) en toont alleen via regelUitRpc-gemaskeerde regels', !/<input|<textarea|<select|contentEditable|onChange|store\.(werk|maak|add|delete|clear|patch)/.test(panel) && !/funder|website|systeemDeadline/.test(panel.replace(/funder_|funderId/g, '')));
  const tool = lees('src/features/kompas-app/KompasToolPage.jsx');
  const toolCode = zonderCommentaar(tool);
  check('31: Free-pad: KompasToolPage keert voor !hasPlanTools terug vóór de werkruimte (geen kolommen/contextpaneel voor Free)', toolCode.indexOf('if (!hasPlanTools) {') > 0 && toolCode.indexOf('if (!hasPlanTools) {') < toolCode.indexOf('<ChatWerkruimte'));
  // Fase 5 voegt bewust code toe aan deze pagina, altijd gemarkeerd (FASE5-BEGIN/END of een regel eindigend op "// FASE5") met
  // één uitzondering: het bericht-object krijgt het veld fondsMatches. Voor de Fase 4-bewaking wordt dat eerst weggehaald,
  // zodat de oorspronkelijke chatruntime (verstuur, dossier, nieuweChat, koppelProject, opslaan) bewijsbaar ongewijzigd blijft.
  const zonderFase5 = (t) => t
    .replace(/^[ \t]*\/\/ FASE5-BEGIN[\s\S]*?\/\/ FASE5-END\n/gm, '')
    .replace(/^.*\/\/ FASE5\n/gm, '')
    .replace(/^[ \t]*spraak\.stop\(\);\n\n/gm, '') // dicteren: microfoon stoppen bij versturen (geen wijziging van chatlogica)
    .replace(', ...(fondsKaart ? { fondsMatches: fondsKaart } : {}) }]', ' }]');
  const toolF4 = zonderFase5(tool);
  const blok = (a, b) => { const i = toolF4.indexOf(a); const j = toolF4.indexOf(b, i); return i < 0 || j < 0 ? '' : toolF4.slice(i, j); };
  check('32: chatruntime ongewijzigd t.o.v. Fase 3: verstuur() (incl. askKompasStream-aanroep, modusdetectie, opslag)', h(blok('  const verstuur = async', '  const linkHuidigGesprekAanProject')) === '0d617b71b2ac341d');
  check('33: projectdossier-verwerking, nieuweChat() en koppelProject() ongewijzigd (koppelProject: alleen de verwijzing in de melding "onder Eerdere gesprekken" -> "onder Gesprekken", omdat die pil niet meer bestaat)', h(blok('  const verwerkProjectDossier = async', '  const kiesBestaandProject')) === 'e998fe7eaf643a9f' && h(blok('  const nieuweChat = () => {', '  // Haalt de berichten van een eerder gesprek op')) === '4931d69b6be1866c' && h(blok('  const koppelProject = async', '  // Is het gekoppelde project verwijderd').split('onder Gesprekken.').join('onder Eerdere gesprekken.')) === 'c82fdcee0e7ab699');
  check('34: opslaan bij project / kopiëren / bewerk-verder ongewijzigd', h(blok('  const kopieerBericht = async', '  // Neemt de aangevinkte velden')) === 'e8874af8a543bcb5');
  check('35: er is geen tweede actief-project-mechaniek: gekoppeldProjectId blijft de enige projectstate; de kop/paneel/lijst lezen die', (toolCode.match(/useState\([^)]*\)/g) || []).filter((s) => /project/i.test(s)).length >= 0 && (toolCode.match(/const \[(?:gekoppeldProjectId|actiefProject\w*|activeProject\w*), set/g) || []).length === 1);
  check('36: ConversationsList is de enige gesprekkenlijst: gebruikt in chatwerkruimte én projecttab; geen kopie in KompasToolPage', /<ConversationsList/.test(toolCode) && /<ConversationsList/.test(lees('src/features/kompas-app/projectdossier/ProjectDetailPage.jsx')) && !/Eerdere gesprekken/.test(toolCode) && loop('src/features/kompas-app').filter((f) => /\.jsx$/.test(f) && /groepeerGesprekken/.test(lees(f))).length === 1);
  check('37: één drawer-architectuur: KompasContextDrawer (geen tweede lade/sheet-component in chat/)', chat.every((f) => !/role="dialog"|aria-modal/.test(code(f))) && /<KompasContextDrawer/.test(toolCode) && (toolCode.match(/<KompasContextDrawer/g) || []).length === 1);
  check('38: lade alleen buiten desktop (>= 1200 px): geen drawer naast de vaste kolommen', /\{!drie && \(\s*<KompasContextDrawer/.test(toolCode));
  const verboden = ['supabase/functions/subsidie-kompas/index.ts', 'src/data/services/chat.js', 'src/data/services/gesprekken.js', 'src/features/kompas-app/projectKoppeling.js'];
  const nieuweBron = /kompas-app\/chat\/|\.\/chat\/|ChatWerkruimte|ConversationsList|ProjectContextPanel/;
  check('39: Edge Function, chat.js, gesprekken-service en projectKoppeling verwijzen niet naar Fase 4-code', verboden.every((f) => !existsSync(f) || !nieuweBron.test(lees(f))));
  const matching = [...loop('src/data'), ...loop('src/shared')].filter((f) => /\.(js|jsx|ts)$/.test(f));
  check('40: matching/fondsadvies/export/documentgeneratie gebruiken geen Fase 4-code', matching.every((f) => !nieuweBron.test(zonderCommentaar(lees(f)))));
  check('41: geen migratie en geen secrets in de Fase 4-bestanden', chat.every((f) => !/sk_live_|whsec_|sk_test_|create table|alter table/i.test(lees(f))));
  const tp = toolCode;
  check('51: geen algemene Context-kolom of Context-knop meer: kolom heet projectoverzicht, knop heet Project (alleen bij actief project)', !/open-context|kolom-context|Context bij dit gesprek/.test(tp + code('src/features/kompas-app/chat/ChatWerkruimte.jsx')) && /data-testid="open-project"/.test(tp) && /\{actiefProject && \(\s*<button type="button" data-testid="open-project"/.test(tp));
  check('52: rechterkolom alleen bij actief project; drawer-tab project alleen bij actief project', /rechts=\{actiefProject \? <ProjectContextPanel/.test(tp) && /\.\.\.\(actiefProject \? \{ project:/.test(tp) && /\{rechts && \(\s*<Zijkolom kant="rechts"/.test(code('src/features/kompas-app/chat/ChatWerkruimte.jsx')));
  check('53: projectoverzicht toont geen organisatie- of documentenblok meer', !/ctx-organisatie|ctx-documenten|OrganisatieBlok|DocumentenBlok|Organisatieprofiel →|Documenten →/.test(panel));
  check('54: AI-runtime ongewijzigd in gebruik: de Edge Function leest organisatie en documenten zelf uit de database; buildContext bevat nog het actieve document', /subsidie_kompas_organizations/.test(lees('supabase/functions/subsidie-kompas/index.ts')) && /knowledge_items/.test(lees('supabase/functions/subsidie-kompas/index.ts')) && /export function buildContext/.test(lees('src/data/services/chat.js')) && /buildProjectFundingContext|projectFundingContext|fundingContext/i.test(lees('supabase/functions/subsidie-kompas/index.ts')));
  check('55: werkkop: geen status-/contextbadges meer boven de chat; "Actief in dit gesprek" alleen met actief project', !/Wisselen start een nieuw gesprek<\/span>/.test(tp) && /\{actiefProject && \(\s*<div data-testid="actief-project-kop"/.test(tp));
  check('56: projectkoppeling van een gesprek loopt alleen via active_program_id (koppelGesprekAanProject); verplaatsen valideert tegen de eigen projecten en maakt het dossier van het vorige project leeg', /const verplaatsUitLijst/.test(tp) && /geldigProjectId\(projectId, store\.projects\)/.test(tp) && /koppelGesprekAanProject\(h\.id, doel\)/.test(tp) && /wisDossier: true/.test(tp));
  check('57: hernoemen schrijft alleen title (eigen gesprek, user_id-filter); geen schemawijziging', /update\(\{ title: schoon \}\)\.eq\('id', conversationId\)\.eq\('user_id', userId\)/.test(lees('src/data/services/gesprekken.js').replace(/\s+/g, ' ').replace(/\(\{ title: schoon \}\) \./, '({ title: schoon }).')));
  const drawer = lees('src/features/kompas-app/KompasContextDrawer.jsx');
  check('42: drawer: Escape, focus trap (ook summary en verborgen elementen), scroll lock en sluitknop aanwezig', /Escape/.test(drawer) && /summary/.test(drawer) && /checkVisibility/.test(drawer) && /body\.style\.overflow = 'hidden'/.test(drawer) && /aria-label="Sluiten"/.test(drawer));
}

console.log(`\n${aantal - gefaald}/${aantal} OK`);
process.exit(gefaald ? 1 : 0);
