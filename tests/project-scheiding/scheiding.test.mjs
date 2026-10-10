// Tests voor de scheiding ORGANISATIE <-> PROJECT <-> DOCUMENT/FONDSAANVRAAG.
// Wordt gestart via run.mjs (dat de code bundelt met een nep-database).
// Dekt de testscenario's A t/m F uit de opdracht, plus duplicaten, herkomst,
// documentversies en referentiele integriteit.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://fondsenwerverscollectief.nl/kompas', pretendToBeVisual: true });
const g = globalThis;
g.window = dom.window;
g.document = dom.window.document;
Object.defineProperty(g, 'navigator', { value: dom.window.navigator, configurable: true });
g.localStorage = dom.window.localStorage;
g.sessionStorage = dom.window.sessionStorage;
g.IS_REACT_ACT_ENVIRONMENT = true;

const out = process.env.PS_OUT;
const React = (await import('react')).default;
const { createRoot } = await import('react-dom/client');
const { act } = await import('react-dom/test-utils');
const P = await import(`${out}/projecten.mjs`);
const K = await import(`${out}/koppeling.mjs`);
const C = await import(`${out}/chat.mjs`);
const G = await import(`${out}/gesprekken.mjs`);
const { KompasProvider, useKompas } = await import(`${out}/store.mjs`);

const U1 = { id: '11111111-1111-4111-8111-111111111111' };
const U2 = { id: '22222222-2222-4222-8222-222222222222' };
let ok = 0;
let fout = 0;
const check = (naam, waar, extra = '') => {
  if (waar) ok++; else fout++;
  console.log(`${waar ? 'OK  ' : 'FAIL'} ${naam}${!waar && extra ? ' — ' + extra : ''}`);
};
const wacht = (ms) => new Promise((r) => setTimeout(r, ms));
const tabel = (n) => (g.__DB[n] = g.__DB[n] || []);
const isUuid = (x) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(x));
const heleStaat = () => JSON.stringify(g.__DB);

// =====================================================================
// 1. Pure logica (projectKoppeling.js)
// =====================================================================
const bestaand = [
  { id: 'pr-1', naam: 'Buurtmoestuin Noord', gearchiveerd: false },
  { id: 'pr-2', naam: 'Schoolproject Ghana', gearchiveerd: true },
];
const lid = (t) => ({ role: 'user', content: t });

// 1. Alleen bij een duidelijk signaal een project aanmaken
let b = K.bepaalProjectActie({ dossier: { doelgroep: 'jongeren', activiteiten: 'workshops' }, berichten: [lid('Ik denk na over iets met jongeren, misschien workshops.')], projecten: [] });
check('S1a. losse brainstorm (geen naam, geen verzoek) maakt geen project', b.actie === 'geen', JSON.stringify(b));
b = K.bepaalProjectActie({ dossier: { doelgroep: 'jongeren' }, berichten: [lid('Schrijf een projectplan voor jongeren')], projecten: [] });
check('S1b. expliciet projectplan-verzoek maar maar 1 inhoudsveld en geen naam: nog geen project', b.actie === 'geen', JSON.stringify(b));
b = K.bepaalProjectActie({ dossier: { doelgroep: 'jongeren', activiteiten: 'workshops' }, berichten: [lid('Schrijf een projectplan voor jongeren met workshops')], projecten: [] });
check('S1c. expliciet projectplan-verzoek + 2 inhoudsvelden: aanmaken', b.actie === 'aanmaken' && b.naam === 'Nieuw project', JSON.stringify(b));
b = K.bepaalProjectActie({ dossier: { projectnaam: 'Jongerenlab Zuid', doelgroep: 'jongeren' }, berichten: [lid('Het heet Jongerenlab Zuid, voor jongeren.')], projecten: [] });
check('S1d. projectnaam + 1 inhoudsveld: aanmaken', b.actie === 'aanmaken' && b.naam === 'Jongerenlab Zuid', JSON.stringify(b));
b = K.bepaalProjectActie({ dossier: { projectnaam: 'Jongerenlab Zuid' }, berichten: [lid('Het heet Jongerenlab Zuid')], projecten: [] });
check('S1e. alleen een naam zonder inhoud: niets', b.actie === 'geen');

// 2. Geen duplicaten
b = K.bepaalProjectActie({ dossier: { projectnaam: 'Buurtmoestuin Noord', doelgroep: 'ouderen' }, berichten: [lid('Buurtmoestuin Noord, voor ouderen.')], projecten: bestaand });
check('S2a. zelfde naam bestaat al: keuze, niet stil aanmaken', b.actie === 'kiezen' && b.kandidaten[0].id === 'pr-1', JSON.stringify(b));
b = K.bepaalProjectActie({ dossier: { projectnaam: 'De buurtmoestuin Noord project', doelgroep: 'ouderen' }, berichten: [lid('x')], projecten: bestaand });
check('S2b. zeer vergelijkbare naam: keuze', b.actie === 'kiezen', JSON.stringify(b));
b = K.bepaalProjectActie({ dossier: { projectnaam: 'Schoolproject Ghana', doelgroep: 'kinderen' }, berichten: [lid('x')], projecten: bestaand });
check('S2c. gelijkende naam bij een gearchiveerd project telt ook (met terugzetten-optie)', b.actie === 'kiezen' && b.kandidaten[0].gearchiveerd === true);
b = K.bepaalProjectActie({ dossier: { projectnaam: 'Buurtmoestuin Noord', doelgroep: 'ouderen' }, berichten: [lid('x')], gekoppeldProjectId: 'pr-1', projecten: bestaand });
check('S2d. met actief project: alleen bijwerken van dat project', b.actie === 'bijwerken' && b.projectId === 'pr-1');
b = K.bepaalProjectActie({ dossier: { projectnaam: 'Totaal ander project', doelgroep: 'dieren', activiteiten: 'x' }, berichten: [lid('Schrijf een projectplan')], gekoppeldProjectId: 'pr-1', projecten: bestaand });
check('S2e. active_program_id is leidend: nooit een ander project aanmaken terwijl er een actief is', b.actie === 'bijwerken' && b.projectId === 'pr-1');
b = K.bepaalProjectActie({ dossier: { doelgroep: 'a', activiteiten: 'b' }, berichten: [lid('Schrijf een projectplan')], gekoppeldProjectId: 'pr-2', projecten: bestaand });
check('S2f. actief project is gearchiveerd/onbekend: niets doen, niet terugvallen', b.actie === 'geen');
b = K.bepaalProjectActie({ dossier: { projectnaam: 'Nieuw ding', doelgroep: 'a' }, berichten: [lid('x')], projecten: [], genegeerd: true });
check('S2g. lid koos "niet opslaan": niet opnieuw vragen', b.actie === 'geen');

// 5/6. Niveaus: document- en fondsniveau komen nooit in het project
const dos = { projectnaam: 'P', doelgroep: '450 kinderen in Ghana', schrijfstijl: 'warm en mensgericht', documentinstructies: 'maximaal 2 pagina\'s', fondsKeuze: 'Fonds X', begroting: '€ 85.000' };
const m = K.dossierNaarProjectVelden(dos, { doelgroep: 'lid', schrijfstijl: 'bevestigd', begroting: 'lid', projectnaam: 'lid' });
check('S5a. documentinstructies komen niet in het project', !JSON.stringify(m.velden).includes('pagina'));
check('S5b. fondsKeuze komt niet in het project', !JSON.stringify(m.velden).includes('Fonds X'));
check('S6a. schrijfstijl wordt projectbrede schrijfvoorkeur', m.velden.schrijfvoorkeur === 'warm en mensgericht');
check('S5c. doelgroep van het project is een projectveld', JSON.stringify(m.velden.doelgroep) === '["450 kinderen in Ghana"]');
check('S7a. herkomst per veld: lid -> gesprek, bevestigd -> gesprek-bevestigd', m.bronnen.doelgroep === 'gesprek' && m.bronnen.schrijfvoorkeur === 'gesprek-bevestigd');
check('S7b. bedrag uit tekst wordt veilig een getal ("€ 85.000" -> 85000)', m.velden.begroting === '85000');
const amb = K.dossierNaarProjectVelden({ begroting: 'tussen 50.000 en 90.000 euro' }, { begroting: 'lid' });
check('S7c. ambigu bedrag wordt niet gegokt', !('begroting' in amb.velden));
const prof = K.dossierNaarProjectVelden({ doelgroep: 'kinderen' }, { doelgroep: 'profiel' });
check('S7d. gegevens die alleen uit het profiel komen worden niet als nieuw overgenomen', !('doelgroep' in prof.velden));

// Conflict / overschrijven
const proj = { id: 'pr-9', doelgroep: ['ouderen'], regio: 'Utrecht', activiteiten: '', bronnen: { doelgroep: 'handmatig', regio: 'gesprek' } };
const upd = K.bepaalVeldUpdates(proj, { velden: { doelgroep: ['kinderen'], regio: 'Rotterdam', activiteiten: 'lessen', impact: 'meer' }, bronnen: { doelgroep: 'gesprek', regio: 'gesprek', activiteiten: 'gesprek', impact: 'gesprek-bevestigd' } });
check('S7e. handmatig ingevuld veld wordt NIET stil overschreven (conflict)', 'doelgroep' in upd.conflicten && !('doelgroep' in upd.vulling) && !('doelgroep' in upd.bijwerking));
check('S7f. leeg veld wordt aangevuld', upd.vulling.activiteiten === 'lessen' && upd.vulling.impact === 'meer');
check('S7g. eerder uit het gesprek overgenomen veld mag door nieuwere uitspraak worden bijgewerkt', upd.bijwerking.regio === 'Rotterdam');
const toegepast = K.pasUpdatesToe(proj, upd);
check('S7h. toepassen zonder conflicten laat handmatig veld ongemoeid + zet herkomst', JSON.stringify(toegepast.doelgroep) === '["ouderen"]' && toegepast.bronnen.activiteiten === 'gesprek' && toegepast.bronnen.impact === 'gesprek-bevestigd' && toegepast.bronnen.doelgroep === 'handmatig');
const metConflict = K.pasUpdatesToe(proj, upd, { metConflicten: true });
check('S7i. na keuze van het lid wordt het conflict wel overgenomen', JSON.stringify(metConflict.doelgroep) === '["kinderen"]');
const hand = K.markeerHandmatigeWijzigingen({ naam: 'A', regio: 'x', bronnen: { regio: 'gesprek' } }, { naam: 'A', regio: 'y', omschrijving: 'nieuw', bronnen: { regio: 'gesprek' } });
check('S7j. wijziging in het formulier wordt herkomst "handmatig"', hand.regio === 'handmatig' && hand.omschrijving === 'handmatig' && !hand.naam);
const org = K.filterOrganisatieVoorstel({ rechtsvorm: 'stichting', regio: 'Accra' }, { projectActief: true });
check('F1. organisatievoorstel: bij actief project geen regio (projectlocatie) in het organisatieprofiel', 'rechtsvorm' in org && !('regio' in org));

// =====================================================================
// 2. Chat-context en matchcriteria (A, B, C)
// =====================================================================
const projA = { id: 'pa', naam: 'Schoolproject Ghana', doelgroep: ['450 kinderen in Ghana'], regio: 'Accra', gevraagd: '€ 50.000', gearchiveerd: false, docs: [{ naam: 'Plan A', soort: 'Projectplan', tekst: 'GEHEIM-A' }] };
const projB = { id: 'pb', naam: 'Buurtmoestuin Noord', doelgroep: ['ouderen'], regio: 'Utrecht', gevraagd: '€ 12.000', gearchiveerd: false, docs: [{ naam: 'Plan B', soort: 'Projectplan', tekst: 'GEHEIM-B' }] };
const orgP = { name: 'Stichting X', themas: ['Onderwijs'], doelgroepen: ['Algemeen'], regio: 'Nederland' };
const ctxB = C.buildContext({ orgProfile: orgP, projects: [projA, projB], activeDoc: null, linkedProjectId: 'pb' });
check('A1. chat in project B: de context bevat niets van project A (of van enig project)', ctxB === null || (!/Ghana|GEHEIM-A|Schoolproject/.test(ctxB)), String(ctxB));
const ctxDoc = C.buildContext({ projects: [projA, projB], activeDoc: { naam: 'Plan A', soort: 'Projectplan', projectId: 'pa' }, linkedProjectId: 'pb' });
check('A2. document van project A als actief document terwijl B actief is: niet meegestuurd', ctxDoc === null);
check('A3. context bevat geen organisatieprofiel en geen documenttekst (server leest die zelf)', !/Stichting X|GEHEIM/.test(String(C.buildContext({ orgProfile: orgP, projects: [projA], activeDoc: { naam: 'Plan A', soort: 'Projectplan', projectId: 'pa' }, linkedProjectId: 'pa' }))));
const msB = C.buildMatchSignalen({ orgProfile: orgP, projects: [projA, projB], linkedProjectId: 'pb' });
check('B1. project B actief: matchcriteria komen uit B (bedrag, locatie, doelgroep)', msB.gevraagdBedrag === 12000 && msB.werkgebied === 'Utrecht' && JSON.stringify(msB.doelgroepen) === '["ouderen"]', JSON.stringify(msB));
check('B2. project B actief: niets van project A in de matchcriteria', !JSON.stringify(msB).includes('Ghana') && msB.gevraagdBedrag !== 50000);
const msA = C.buildMatchSignalen({ orgProfile: orgP, projects: [projA, projB], linkedProjectId: 'pa' });
check('B3. project A actief: criteria uit A', msA.gevraagdBedrag === 50000 && msA.werkgebied === 'Accra');
const msGeen = C.buildMatchSignalen({ orgProfile: orgP, projects: [projA, projB], linkedProjectId: null });
check('C1. geen actief project: geen projectcriteria (bedrag, projectlocatie, projectdoelgroep)', msGeen.gevraagdBedrag === null && msGeen.werkgebied === 'Nederland' && !JSON.stringify(msGeen).includes('Ghana'), JSON.stringify(msGeen));
check('C2. geen terugval op het eerste project van de gebruiker', msGeen.gevraagdBedrag !== 50000 && !JSON.stringify(msGeen).includes('450'));
const msArch = C.buildMatchSignalen({ orgProfile: orgP, projects: [{ ...projA, gearchiveerd: true }], linkedProjectId: 'pa' });
check('C3. gearchiveerd project telt niet mee in matching', msArch.gevraagdBedrag === null);

// =====================================================================
// 3. Services met nep-database (projecten.js)
// =====================================================================
g.__USER = U1;
const tel = (t, f) => tabel(t).filter(f).length;

// Eerste organisatie (bestaand profiel van U1) - mag nooit door projecten worden aangepast
tabel('subsidie_kompas_organizations').push({ id: 'org-U1', user_id: U1.id, organization_name: 'Stichting Voorbeeld', legal_form: 'stichting', mission: 'onderwijs voor kinderen', working_area: 'Nederland' });
const orgVoor = JSON.stringify(tabel('subsidie_kompas_organizations').find((o) => o.user_id === U1.id));

const nieuwA = await P.bewaarProject({ id: 'p1788000000000', naam: 'Schoolproject Ghana', regio: 'Accra', doelgroep: ['450 kinderen in Ghana'], activiteiten: 'lesmateriaal', bronnen: { regio: 'gesprek' }, docs: [] });
check('P1. een nieuw project uit het formulier (tijdelijk, geen uuid) wordt echt aangemaakt', isUuid(nieuwA.id) && tel('subsidie_kompas_programs', (r) => r.id === nieuwA.id) === 1, JSON.stringify(nieuwA));
const rijA = tabel('subsidie_kompas_programs').find((r) => r.id === nieuwA.id);
check('P2. nieuwe projectvelden en herkomst worden opgeslagen (activiteiten, bronnen)', rijA.activities === 'lesmateriaal' && rijA.field_sources.regio === 'gesprek');
check('P3. een project bestaat voor de bestaande organisatie en wijzigt het organisatieprofiel niet', rijA.organization_id === 'org-U1' && JSON.stringify(tabel('subsidie_kompas_organizations').find((o) => o.user_id === U1.id)) === orgVoor);

const nieuwB = await P.bewaarProject({ id: null, naam: 'Buurtmoestuin Noord', regio: 'Utrecht', docs: [] });
const baseB = { id: nieuwB.id, naam: 'Buurtmoestuin Noord', regio: 'Utrecht' };
// documenten: eerste generatie
const baseA = { id: nieuwA.id, naam: 'Schoolproject Ghana', regio: 'Accra', doelgroep: ['450 kinderen in Ghana'], activiteiten: 'lesmateriaal', bronnen: { regio: 'gesprek' } };
const metDoc = await P.bewaarProject({ ...baseA, docs: [{ naam: 'Projectplan — concept 1', soort: 'Projectplan', tekst: 'versie een', context: { fonds: 'Fonds X' }, bron: 'generated' }] });
const docIds = metDoc.docs.map((d) => d.id);
check('D1. nieuw document krijgt een echt id en versie 1', metDoc.docs.length === 1 && isUuid(docIds[0]) && metDoc.docs[0].versie === 1);
// opnieuw opslaan van hetzelfde (zoals het projectformulier doet): geen duplicaten, geen vervanging
await P.bewaarProject({ ...baseA, docs: metDoc.docs });
check('D2. opnieuw opslaan maakt geen duplicaat en vervangt niets', tel('subsidie_kompas_knowledge_items', (r) => r.program_id === nieuwA.id) === 1);
// tweede generatie, zelfde soort + zelfde fonds
const tweede = await P.bewaarProject({ ...baseA, docs: metDoc.docs.concat([{ naam: 'Projectplan — concept 2', soort: 'Projectplan', tekst: 'versie twee', context: { fonds: 'Fonds X' }, bron: 'generated' }]) });
const docsA = tabel('subsidie_kompas_knowledge_items').filter((r) => r.program_id === nieuwA.id);
check('D3. nieuwe generatie wordt versie 2 NAAST versie 1 (vorige blijft bestaan)', docsA.length === 2 && docsA.map((d) => d.version).sort().join() === '1,2');
check('D4. de vorige versie is gemarkeerd als vervangen, maar niet verwijderd of overschreven', docsA.find((d) => d.version === 1).superseded_at && docsA.find((d) => d.version === 1).extracted_text === 'versie een' && !docsA.find((d) => d.version === 2).superseded_at);
const ander = await P.bewaarProject({ ...baseA, docs: tweede.docs.concat([{ naam: 'Projectplan voor Fonds Y', soort: 'Projectplan', tekst: 'ander fonds', context: { fonds: 'Fonds Y' }, bron: 'generated' }]) });
check('D5. ander fonds = eigen versielijn (versie 1), de versies voor Fonds X blijven staan', ander.docs.find((d) => d.naam === 'Projectplan voor Fonds Y').versie === 1 && tel('subsidie_kompas_knowledge_items', (r) => r.program_id === nieuwA.id) === 3);
// verouderde clientlijst: leeg
await P.bewaarProject({ ...baseA, docs: [] });
check('D6. een verouderde/lege documentlijst verwijdert niets (alleen expliciete verwijdering)', tel('subsidie_kompas_knowledge_items', (r) => r.program_id === nieuwA.id) === 3);
const teWeg = ander.docs.find((d) => d.naam === 'Projectplan voor Fonds Y').id;
await P.bewaarProject({ ...baseA, docs: [], verwijderdeDocIds: [teWeg] });
check('D7. expliciet verwijderde document gaat weg, de rest blijft', tel('subsidie_kompas_knowledge_items', (r) => r.program_id === nieuwA.id) === 2 && tel('subsidie_kompas_knowledge_items', (r) => r.id === teWeg) === 0);

// E: twee projecten van dezelfde gebruiker blijven gescheiden
await P.bewaarProject({ ...baseB, docs: [{ naam: 'Plan moestuin', soort: 'Projectplan', tekst: 'tekst B', context: {}, bron: 'generated' }] });
const lijst = await P.haalProjectenOp();
const pa = lijst.find((p) => p.id === nieuwA.id);
const pb = lijst.find((p) => p.id === nieuwB.id);
check('E1. documenten van project A en B zijn gescheiden', pa.docs.every((d) => !/tekst B|moestuin/.test(d.tekst + d.naam)) && pb.docs.length === 1 && pb.docs[0].tekst === 'tekst B');
check('E2. versienummers tellen per project (B begint op versie 1 terwijl A op 2 staat)', pb.docs[0].versie === 1 && Math.max(...pa.docs.map((d) => d.versie)) === 2);
check('E3. velden van A en B zijn niet vermengd', pa.regio === 'Accra' && pb.regio === 'Utrecht' && pa.activiteiten === 'lesmateriaal' && pb.activiteiten === '');

// Gesprekken en berichten gekoppeld aan project
const gA = await G.maakGesprekAan({ titel: 'chat A', projectId: nieuwA.id, kompasMode: 'projectplan' });
const gB = await G.maakGesprekAan({ titel: 'chat B', projectId: nieuwB.id, kompasMode: 'projectplan' });
await G.voegBerichtToe({ conversationId: gA.id, role: 'user', content: 'hallo A', projectId: nieuwA.id });
await G.voegBerichtToe({ conversationId: gB.id, role: 'user', content: 'hallo B', projectId: nieuwB.id });
check('E4. berichten zijn aan hun project gekoppeld (program_id)', tel('subsidie_kompas_messages', (r) => r.conversation_id === gA.id && r.program_id === nieuwA.id) === 1);
await G.bijwerkenGesprekModusEnDossier({ conversationId: gA.id, projectDossier: { doelgroep: 'x' } });
await G.bijwerkenGesprekModusEnDossier({ conversationId: gA.id, wisDossier: true });
check('A4. bij wisselen van project wordt het gespreksdossier gewist (geen carry-over)', tabel('subsidie_kompas_conversations').find((c) => c.id === gA.id).project_dossier === null);

// Archiveren
await P.archiveerProject(nieuwA.id, true);
const naArch = (await P.haalProjectenOp()).find((p) => p.id === nieuwA.id);
check('R1. archiveren: project blijft bestaan met alle documenten, is gemarkeerd', naArch.gearchiveerd === true && naArch.docs.length === 2);
check('R2. archiveren: gesprekken verliezen hun actieve project (geen verwijzing naar archief)', tabel('subsidie_kompas_conversations').find((c) => c.id === gA.id).active_program_id === null);
await P.archiveerProject(nieuwA.id, false);

// RLS: een andere gebruiker kan niets van U1 verwijderen
g.__USER = U2;
const weg2 = await P.verwijderProject(nieuwA.id);
g.__USER = U1;
check('R3. andere gebruiker kan project van U1 niet verwijderen', tel('subsidie_kompas_programs', (r) => r.id === nieuwA.id) === 1);

// Verwijderen: integriteit
const docsBvoor = tel('subsidie_kompas_knowledge_items', (r) => r.program_id === nieuwB.id);
await P.verwijderProject(nieuwA.id);
check('R4. verwijderen: alle documenten van het project gaan mee (geen wezen)', tel('subsidie_kompas_knowledge_items', (r) => r.program_id === nieuwA.id) === 0);
check('R5. verwijderen: documenten van het andere project blijven onaangeroerd', tel('subsidie_kompas_knowledge_items', (r) => r.program_id === nieuwB.id) === docsBvoor && docsBvoor === 1);
check('R6. verwijderen: gesprek en berichten blijven bestaan, zonder projectkoppeling', tabel('subsidie_kompas_conversations').some((c) => c.id === gA.id && c.active_program_id === null) && tel('subsidie_kompas_messages', (r) => r.conversation_id === gA.id && r.program_id === null) === 1);
const programIds = new Set(tabel('subsidie_kompas_programs').map((p) => p.id));
const wezen = tabel('subsidie_kompas_knowledge_items').filter((d) => d.program_id && !programIds.has(d.program_id)).length + tabel('subsidie_kompas_messages').filter((m) => m.program_id && !programIds.has(m.program_id)).length + tabel('subsidie_kompas_conversations').filter((c) => c.active_program_id && !programIds.has(c.active_program_id)).length;
check('R7. na verwijderen verwijst nergens meer iets naar het verwijderde project', wezen === 0, String(wezen));

// =====================================================================
// 4. Store (React) - nieuw project uit gesprek, accountwissel, organisatie ongemoeid
// =====================================================================
const probe = { store: null };
function Probe() { probe.store = useKompas(); return React.createElement('div', { id: 'n' }, String((probe.store.projects || []).length)); }
let setUser;
function App() {
  const [u, su] = React.useState(null);
  setUser = su;

  return React.createElement(KompasProvider, { key: u ? u.id : 'anoniem', userId: u ? u.id : null }, React.createElement(Probe));
}
const root = createRoot(document.getElementById('root'));
await act(async () => { root.render(React.createElement(App)); });
async function login(u) { g.__USER = u; await act(async () => { setUser(u); await wacht(150); }); }
async function logout() { g.__USER = null; await act(async () => { setUser(null); await wacht(80); }); }

await login(U1);
const orgNa = () => JSON.stringify(tabel('subsidie_kompas_organizations').find((o) => o.user_id === U1.id));
check('T1. ingelogd als U1: ziet alleen het eigen (resterende) project', probe.store.projects.length === 1 && probe.store.projects[0].naam === 'Buurtmoestuin Noord');

let nieuwId = null;
await act(async () => {
  nieuwId = await probe.store.maakProject({
    naam: 'Jongerenlab Zuid',
    velden: { doelgroep: ['jongeren 12-18'], activiteiten: 'workshops', schrijfvoorkeur: 'zakelijk' },
    bronnen: { doelgroep: 'gesprek', activiteiten: 'gesprek', schrijfvoorkeur: 'gesprek-bevestigd' },
  });
  await wacht(50);
});
check('T2. project uit gesprek: echt uuid, in database, in store met definitief id', isUuid(nieuwId) && probe.store.projects.some((p) => p.id === nieuwId) && tel('subsidie_kompas_programs', (r) => r.id === nieuwId) === 1);
const rijN = tabel('subsidie_kompas_programs').find((r) => r.id === nieuwId);
check('T3. herkomst per veld is vastgelegd; AI-voorstellen zonder bevestiging zijn niet als bevestigd gemarkeerd', rijN.field_sources.doelgroep === 'gesprek' && rijN.field_sources.schrijfvoorkeur === 'gesprek-bevestigd');
check('F2. Premium-organisatiegeheugen: projectinfo uit het gesprek landt in het project en het organisatieprofiel is ongewijzigd', orgNa() === orgVoor && !/jongeren|workshops|zakelijk/.test(orgNa()));
check('F3. schrijfvoorkeur staat op projectniveau, niet in het organisatieprofiel', rijN.writing_preferences === 'zakelijk' && !/zakelijk/.test(orgNa()));

await act(async () => {
  probe.store.addGeneratedDocToProject(nieuwId, { naam: 'Projectplan voor Fonds X', soort: 'Projectplan', grootte: '', tekst: 'eerste tekst', context: { fonds: 'Fonds X' } });
  await wacht(60);
});
await act(async () => {
  probe.store.addGeneratedDocToProject(nieuwId, { naam: 'Projectplan voor Fonds X (2)', soort: 'Projectplan', grootte: '', tekst: 'tweede tekst', context: { fonds: 'Fonds X' } });
  await wacht(60);
});
const docsN = tabel('subsidie_kompas_knowledge_items').filter((d) => d.program_id === nieuwId);
check('T4. twee generaties via de store: twee versies, de eerste niet overschreven', docsN.length === 2 && docsN.some((d) => d.extracted_text === 'eerste tekst') && docsN.map((d) => d.version).sort().join() === '1,2');
const inStore = probe.store.projects.find((p) => p.id === nieuwId);
check('T5. documenten in de store hebben definitieve id\'s (geen dubbel opslaan bij volgende save)', inStore.docs.length === 2 && inStore.docs.every((d) => isUuid(d.id)));
await act(async () => { await probe.store.saveProject(inStore); await wacht(60); });
check('T6. formulier opnieuw opslaan: nog steeds 2 documenten, geen duplicaten', tel('subsidie_kompas_knowledge_items', (r) => r.program_id === nieuwId) === 2);

// formulier: nieuw project met tijdelijk id (de fout die projecten nooit bewaarde)
let formId = null;
await act(async () => {
  formId = await probe.store.saveProject({ ...probe.store.projects[0], id: 'p1788999999999', naam: 'Formulierproject', docs: [], bronnen: {} });
  await wacht(60);
});
check('T7. nieuw project via het formulier (id p<tijd>) komt nu echt in de database', isUuid(formId) && tel('subsidie_kompas_programs', (r) => r.id === formId && r.name === 'Formulierproject') === 1);
check('T8. handmatig ingevulde velden krijgen herkomst "handmatig"', tabel('subsidie_kompas_programs').find((r) => r.id === formId).field_sources.naam === 'handmatig');

// D: uitloggen A -> account B ziet niets van A
await logout();
check('D1. uitgelogd: geen projecten in de staat', probe.store.projects.length === 0);
tabel('subsidie_kompas_organizations').push({ id: 'org-U2', user_id: U2.id, organization_name: 'Andere Stichting' });
await login(U2);
check('D2. ander account B: geen projecten, geen documenten en geen context van A', probe.store.projects.length === 0, JSON.stringify(probe.store.projects.map((p) => p.naam)));
check('D3. ander account B: niets van A in browseropslag-staat', !/Jongerenlab|Buurtmoestuin|Formulier/.test(JSON.stringify(probe.store.projects) + JSON.stringify(probe.store.orgProfile)));
let idB = null;
await act(async () => { idB = await probe.store.maakProject({ naam: 'Project van B', velden: { doelgroep: ['dieren'] }, bronnen: { doelgroep: 'gesprek' } }); await wacht(40); });
check('D4. B maakt een eigen project: onder user B, A\'s projecten onaangeroerd', tabel('subsidie_kompas_programs').find((r) => r.id === idB).user_id === U2.id && tel('subsidie_kompas_programs', (r) => r.user_id === U1.id) === 3);
await logout();
await login(U1);
check('D5. terug als A: eigen projecten, niets van B', probe.store.projects.length === 3 && !probe.store.projects.some((p) => p.naam === 'Project van B'));

console.log(`\n${ok} OK, ${fout} FAIL`);
process.exit(fout ? 1 : 0);
