// Fase 5 — frontend-/keten-tests (node): kansrijke financiers -> Projectfinanciering, "staat al", Bespreek-deeplinks,
// gesprek hervatten via de URL, en statische bewaking van "geen tweede bron / geen verborgen schrijfactie".
//   node tests/fase5/frontend.test.mjs   (vanuit de repo-root)
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const uit = mkdtempSync(join(tmpdir(), 'fase5-'));
await build({
  entryPoints: { fondsMatches: 'src/features/kompas-app/chat/fondsMatches.js', gesprekUrl: 'src/features/kompas-app/chat/gesprekUrl.js', deeplinks: 'src/features/kompas-app/financiering/deeplinks.js' },
  outdir: uit, outExtension: { '.js': '.mjs' }, bundle: true, format: 'esm', platform: 'node', logLevel: 'error',
  plugins: [{ name: 'stub', setup(b) { b.onResolve({ filter: /client\.js$/ }, () => ({ path: 'stub', namespace: 'stub' })); b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const supabase = null; export const query = async () => ({ data: null, error: null });', loader: 'js' })); } }],
});
const imp = (n) => import(pathToFileURL(join(uit, `${n}.mjs`)).href);
const fm = await imp('fondsMatches');
const url = await imp('gesprekUrl');
const dl = await imp('deeplinks');

let gefaald = 0;
let aantal = 0;
const check = (naam, ok, detail = '') => {
  aantal += 1;
  if (!ok) gefaald += 1;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${naam}${!ok && detail ? ` -- ${detail}` : ''}`);
};
const lees = (f) => readFileSync(f, 'utf8');
const loop = (d) => (existsSync(d) ? readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? loop(p) : [p]; }) : []);

const U = (n) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const PROJ = U(1);
const ANDER = U(2);
const item = (n, extra = {}) => ({ type: 'regeling', id: U(n), naam: `Regeling ${n}`, funder: 'Fonds X', deadline: '2026-12-01', waarom: ['Past bij jongeren', 'Past bij Amsterdam', 'derde'], staatAl: false, ...extra });
const projecten = [{ id: PROJ, naam: 'Hushu House 2027', gearchiveerd: false }];

// ---- 1. de serverlijst wordt gevalideerd
const ruw = { intentie: 'scan', projectId: PROJ, items: [item(3), item(3), item(4, { type: 'fonds' }), { type: 'x', id: U(5), naam: 'Vreemd' }, { type: 'fonds', id: 'geen-uuid', naam: 'Fout' }, { type: 'fonds', id: U(6), naam: '' }, item(7, { deadline: '1 december' })] };
const lijst = fm.leesFondsMatches(ruw);
check('1a: dubbele, vreemde, id-loze en naamloze items vallen weg', lijst && lijst.items.length === 3 && lijst.items.map((i) => i.id).join() === [U(3), U(4), U(7)].join());
check('1b: ten hoogste twee redenen, deadline alleen als ISO-datum', lijst.items[0].waarom.length === 2 && lijst.items[2].deadline === null && lijst.items[0].deadline === '2026-12-01');
check('1c: zonder geldig projectId of items -> null', fm.leesFondsMatches({ intentie: 'scan', projectId: 'x', items: [item(3)] }) === null && fm.leesFondsMatches({ intentie: 'scan', projectId: PROJ, items: [] }) === null && fm.leesFondsMatches(null) === null);
check('1d: intentie "toevoegen" mag zonder items (verwijst naar de vorige lijst)', fm.leesFondsMatches({ intentie: 'toevoegen', projectId: PROJ, items: [] }).items.length === 0);
const veel = fm.leesFondsMatches({ intentie: 'hack', projectId: PROJ, items: Array.from({ length: 20 }, (_, i) => ({ ...item(1), id: `${String(i + 10).padStart(8, '0')}-1111-4111-8111-111111111111` })) });
check('1f: 20 items worden er 12; intentie hack -> advies', veel.items.length === 12 && veel.intentie === 'advies');
check('1g: een extra, onbekend veld (bijv. een "bedrag" of "premium") gaat niet mee', !('bedrag' in fm.leesFondsMatches({ intentie: 'scan', projectId: PROJ, items: [{ ...item(3), bedrag: 5000, premium: 'x' }] }).items[0]) && !('premium' in fm.leesFondsMatches({ intentie: 'scan', projectId: PROJ, items: [{ ...item(3), premium: 'x' }] }).items[0]));

// ---- 2. toevoegen: één service, geen bedrag, "staat al"
const aanroepen = [];
const nepService = (uitkomst) => async (arg) => { aanroepen.push(arg); const u = typeof uitkomst === 'function' ? uitkomst(arg) : uitkomst; return u; };
const st = {};
const res = await fm.voegItemsToe({
  items: lijst.items, projectId: PROJ, projecten, huidig: {}, onStatus: (k, s) => { st[k] = s; },
  voegToe: nepService((a) => (a.bron.id === U(4) ? { ok: false, reden: 'bestaat-al' } : a.bron.id === U(7) ? { ok: false, reden: 'fout' } : { ok: true, id: 'r' })),
});
check('2a: resultaat telt toegevoegd / staat al / mislukt', res.toegevoegd === 1 && res.staatAl === 1 && res.mislukt === 1);
check('2b: statussen per item: toegevoegd, staat-al (23505), mislukt', st[`regeling:${U(3)}`] === 'toegevoegd' && st[`fonds:${U(4)}`] === 'staat-al' && st[`regeling:${U(7)}`] === 'mislukt');
check('2c: nooit een bedrag meegestuurd (bedragTekst leeg) en alleen {type,id} als bron', aanroepen.every((a) => a.bedragTekst === '' && Object.keys(a.bron).sort().join() === 'id,type' && a.projectId === PROJ));
check('2d: één voor één (geen parallelle inserts)', aanroepen.length === 3);
const aanroepen2 = [];
await fm.voegItemsToe({ items: lijst.items, projectId: PROJ, projecten, huidig: { [`regeling:${U(3)}`]: 'toegevoegd', [`fonds:${U(4)}`]: 'staat-al' }, voegToe: async (a) => { aanroepen2.push(a); return { ok: true }; } });
check('2e: items die al toegevoegd zijn of al in het dekkingsplan staan worden niet nogmaals verstuurd', aanroepen2.length === 1 && aanroepen2[0].bron.id === U(7));
check('2f: beginStatussen respecteert staatAl uit de server', fm.beginStatussen([item(3, { staatAl: true }), item(4)])[`regeling:${U(3)}`] === 'staat-al' && fm.beginStatussen([item(4)])[`regeling:${U(4)}`] === 'klaar');
check('2g: telStatussen/samenvatting', fm.samenvattingTekst({ toegevoegd: 3, staatAl: 1, mislukt: 0 }) === '3 toegevoegd aan projectfinanciering · 1 stond er al in' && fm.kopTekst(4) === '4 kansrijke financiers gevonden' && fm.kopTekst(1) === '1 kansrijke financier gevonden');

// de echte service-keten: ongeldig project / bron wordt geweigerd vóór er een insert gebeurt
const toev = await import(pathToFileURL(join(uit, 'fondsMatches.mjs')).href);
const echt = await toev.voegItemToe({ item: item(3), projectId: ANDER, projecten });
check('2h: via de echte fundingservice: een project dat niet van het lid is wordt geweigerd (mislukt, geen insert)', echt === 'mislukt');

// ---- 3. laatste lijst + kaart voor bericht
const berichten = [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b', fondsMatches: { projectId: ANDER, items: [item(8)] } }, { role: 'assistant', content: 'c', fondsMatches: { projectId: PROJ, items: [item(3), item(4)] } }, { role: 'assistant', content: 'd' }];
check('3a: laatsteLijst neemt de laatste lijst van HETZELFDE project', fm.laatsteLijst(berichten, PROJ).items.length === 2 && fm.laatsteLijst(berichten, ANDER).items[0].id === U(8) && fm.laatsteLijst(berichten, U(9)) === null);
const kaart = fm.kaartVoorBericht({ intentie: 'scan', projectId: PROJ, items: [item(3)] }, berichten, PROJ);
check('3b: kaart alleen voor het actieve project van dit gesprek', kaart && kaart.items.length === 1 && fm.kaartVoorBericht({ intentie: 'scan', projectId: PROJ, items: [item(3)] }, berichten, ANDER) === null && fm.kaartVoorBericht({ intentie: 'scan', projectId: PROJ, items: [item(3)] }, berichten, null) === null);
const vervolg = fm.kaartVoorBericht({ intentie: 'toevoegen', projectId: PROJ, items: [] }, berichten, PROJ);
check('3c: "Zet deze vier in mijn dekkingsplan" -> items van de laatste lijst, met bevestiging (intentie blijft toevoegen)', vervolg && vervolg.intentie === 'toevoegen' && vervolg.items.length === 2 && vervolg.items.every((i) => i.staatAl === false));
check('3d: zonder eerdere lijst geen kaart (nooit blind schrijven)', fm.kaartVoorBericht({ intentie: 'toevoegen', projectId: PROJ, items: [] }, [{ role: 'assistant', content: 'x' }], PROJ) === null);

// ---- 4. focus-id uit het dekkingsplan
const rpcRij = (id, extra) => ({ id, program_id: PROJ, bron_type: 'regeling', bron_status: 'zichtbaar', bron_naam: 'R', funder_naam: 'F', status: 'interesting', ...extra });
const fid = await fm.zoekFundingId(item(3), PROJ, async () => ({ error: null, regels: [rpcRij(U(7), { scheme_id: U(3) }), rpcRij(U(8), { scheme_id: U(5) })] }));
check('4a: zoekFundingId vindt de regel van een regeling', fid === U(7));
check('4b: een fonds wordt via funder_id gevonden', (await fm.zoekFundingId(item(4, { type: 'fonds' }), PROJ, async () => ({ error: null, regels: [rpcRij(U(9), { bron_type: 'fonds', funder_id: U(4) })] }))) === U(9));
check('4c: geen regel / RPC-fout / uitzondering -> null (de chat gaat gewoon door)', (await fm.zoekFundingId(item(3), PROJ, async () => ({ error: null, regels: [] }))) === null && (await fm.zoekFundingId(item(3), PROJ, async () => ({ error: 'fout', regels: null }))) === null && (await fm.zoekFundingId(item(3), PROJ, async () => { throw new Error('x'); })) === null);
check('4d: een gemaskeerde bron (verborgen) heeft geen scheme_id en kan dus niet als focus worden gevonden', (await fm.zoekFundingId(item(3), PROJ, async () => ({ error: null, regels: [rpcRij(U(7), { scheme_id: U(3), bron_status: 'verborgen' })] }))) === null);

// ---- 5. gesprek-URL
check('5a: leesChatUrl accepteert alleen uuid\'s op de chatroute', JSON.stringify(url.leesChatUrl(`#/kompas?conversation=${U(3)}&focus=${U(4)}`)) === JSON.stringify({ conversation: U(3), project: null, focus: U(4) }) && url.leesChatUrl('#/kompas?conversation=1;drop').conversation === null && url.leesChatUrl(`#/kompas/projecten?conversation=${U(3)}`).conversation === null && url.leesChatUrl(`#/kompas?project=${U(1)}`).project === U(1));
check('5b: chatHref bevat alleen uuid\'s; focus zonder gesprek/project valt weg; gesprek gaat voor project', url.chatHref({ conversationId: U(3), projectId: U(1), fundingId: U(4) }) === `#/kompas?conversation=${U(3)}&focus=${U(4)}` && url.chatHref({ fundingId: U(4) }) === '#/kompas' && url.chatHref({ projectId: U(1) }) === `#/kompas?project=${U(1)}` && url.chatHref({ conversationId: 'x y' }) === '#/kompas');
const nepWin = (hash) => { const w = { location: { hash }, history: { state: null, vervangen: [], replaceState(s, t, h) { this.vervangen.push(h); w.location.hash = h; } } }; return w; };
const w1 = nepWin(`#/kompas?conversation=${U(3)}&focus=${U(4)}`);
check('5c: zetChatUrl vervangt de URL (replaceState) en laat alleen het gesprek staan', url.zetChatUrl(U(3), w1) && w1.history.vervangen[0] === `/subsidie-kompas?conversation=${U(3)}` && w1.history.vervangen.length === 1);
const w2 = nepWin('#/kompas/projecten');
check('5d: buiten de chatroute doet zetChatUrl niets', url.zetChatUrl(U(3), w2) === false && w2.history.vervangen.length === 0);
const w3 = nepWin(`#/kompas?conversation=${U(3)}`);
url.wisChatUrl(w3);
check('5e: wisChatUrl brengt de chat terug naar /subsidie-kompas', w3.history.vervangen[0] === '/subsidie-kompas');

// ---- 6. Bespreek-deeplink
const gesprekken = [{ id: U(5), projectId: PROJ, tijd: '2026-10-01T10:00:00Z' }, { id: U(6), projectId: PROJ, tijd: '2026-10-09T10:00:00Z' }, { id: U(7), projectId: ANDER, tijd: '2026-10-10T10:00:00Z' }, { id: 'tmp-1', projectId: PROJ, tijd: '2026-10-11T10:00:00Z' }];
check('6a: Bespreek opent het LAATSTE echte gesprek van dit project (niet van een ander project, geen tijdelijk id)', dl.bespreekHref({ projectId: PROJ, fundingId: U(8), gesprekken }) === `#/kompas?conversation=${U(6)}&focus=${U(8)}`);
check('6b: zonder gesprek: nieuw gesprek met het project als start', dl.bespreekHref({ projectId: U(9), fundingId: U(8), gesprekken }) === `#/kompas?project=${U(9)}&focus=${U(8)}`);
check('6c: de bestaande projectfinancieringlinks zijn ongewijzigd', dl.projectFinancieringHref(PROJ) === `#/kompas/projecten/${PROJ}?tab=projectfinanciering`);

// ---- 7. statische bewaking
const kaartSrc = lees('src/features/kompas-app/chat/FondsMatchKaart.jsx');
const fmSrc = lees('src/features/kompas-app/chat/fondsMatches.js');
const code = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
check('7a: de kaart en fondsMatches schrijven nooit zelf naar de database (geen supabase, geen .from/.insert, geen voegRegelToe)', ![kaartSrc, fmSrc].some((t) => /supabase|\.from\(|\.insert\(|voegRegelToe|werkRegelBij|verwijderRegel/.test(code(t))));
check('7b: toevoegen loopt uitsluitend via voegToeAanProjectfinanciering', /voegToeAanProjectfinanciering/.test(fmSrc) && !/requested|bedragTekst: [^'\s]/.test(code(kaartSrc)));
check('7c: geen browseropslag in de nieuwe chatmodules en pointer niet in st', ![kaartSrc, fmSrc, lees('src/features/kompas-app/chat/gesprekUrl.js')].some((t) => /localStorage|sessionStorage|indexedDB/.test(code(t))) && /laatsteGesprekRef = useRef/.test(lees('src/features/kompas-app/KompasStore.jsx')) && !/laatsteGesprek/.test((lees('src/features/kompas-app/KompasStore.jsx').match(/bewaarWerkomgeving[\s\S]{0,400}/) || [''])[0]));
const tool = lees('src/features/kompas-app/KompasToolPage.jsx');
check('7d: KompasToolPage stuurt alleen een id als focus (focusFundingId) en geen fondsobject', /focusFundingId: hasPlanTools && focus && isEchtId\(gekoppeldProjectId\) \? focus\.fundingId : null/.test(tool) && !/focusFonds|focusObject/.test(tool));
const chatSrc = lees('src/data/services/chat.js');
check('7e: chat.js geeft focusFundingId en fondsMatches alleen door (geen nieuwe logica) in beide aanroepen', (chatSrc.match(/focusFundingId: focusFundingId \|\| null/g) || []).length === 2 && /fondsMatches: data\.fondsMatches \|\| null/.test(chatSrc) && /fondsMatchesUit = deel\.fondsMatches \|\| null/.test(chatSrc));
const edge = lees('supabase/functions/subsidie-kompas/index.ts');
// Sinds 'voorstel-opslaan' (server valideert en bewaart bij een klik op Opslaan) is er in de Edge Function precies EEN schrijfplek voor funding en taken,
// gemarkeerd met VOORSTEL-OPSLAAN-BEGIN/END, en die gebruikt uitsluitend de gebruikers-client (RLS van het lid), nooit de admin-client.
const opslaanBlok = (edge.match(/\/\/ VOORSTEL-OPSLAAN-BEGIN[\s\S]*?\/\/ VOORSTEL-OPSLAAN-END/g) || []);
const edgeZonderOpslaan = edge.replace(/\/\/ VOORSTEL-OPSLAAN-BEGIN[\s\S]*?\/\/ VOORSTEL-OPSLAAN-END/g, '');
check('7f: de Edge Function schrijft buiten het ene opslaan-blok nooit naar subsidie_kompas_program_funding (alleen kompas_dekkingsplan lezen)', opslaanBlok.length === 1 && (!/program_funding/.test(code(edgeZonderOpslaan).replace(/kompas_dekkingsplan/g, '')) || !/\.from\(\s*['"]subsidie_kompas_program_funding/.test(edgeZonderOpslaan)));
// Schrijfacties binnen het opslaan-blok per tabel (ruim 1 regel: de aanroep kan over meerdere regels staan). Toegestaan: funding alleen insert (gebruikers-client); taken insert of
// upsert met ignoreDuplicates (gebruikers-client, sinds ronde 3 voor de databasegarantie); de server-eigen wachtrij subsidie_kompas_actieplan_open alleen via admin (het lid kan er niet in schrijven).
const blokCode = (opslaanBlok[0] || '').replace(/\/\/.*$/gm, '');
const schrijf = [...blokCode.matchAll(/(\w+)\s*\.from\(\s*['"]([a-z_]+)['"]\s*\)([\s\S]{0,160}?)\.(insert|update|upsert|delete)\(/g)].map((m) => ({ client: m[1], tabel: m[2], op: m[4] }));
check('7g: geen insert/update/delete op funding buiten dat blok; binnen het blok alleen via de gebruikers-client, nooit admin', !/subsidie_kompas_program_funding['"]\s*\)\s*\.\s*(insert|update|upsert|delete)/.test(edgeZonderOpslaan) && !/admin\s*\.\s*from\(\s*['"]subsidie_kompas_program_(funding|actions)/.test(edge) && /client\s*\.from\(\s*['"]subsidie_kompas_program_funding['"]\s*\)\s*\.insert/.test(opslaanBlok[0]) && schrijf.filter((x) => x.tabel === 'subsidie_kompas_program_funding').every((x) => x.client === 'client' && x.op === 'insert') && schrijf.filter((x) => x.tabel === 'subsidie_kompas_program_actions').every((x) => x.client === 'client' && (x.op === 'insert' || x.op === 'upsert')) && schrijf.filter((x) => x.tabel === 'subsidie_kompas_actieplan_open').every((x) => x.client === 'admin') && schrijf.every((x) => ['subsidie_kompas_program_funding', 'subsidie_kompas_program_actions', 'subsidie_kompas_actieplan_open'].includes(x.tabel)) && /ignoreDuplicates: true/.test(blokCode));
const dashboardSrc = lees('src/features/kompas-app/dashboard/DashboardPage.jsx');
check('7h: Bespreek-link staat in Projectfinanciering, Mijn deadlines en het contextpaneel; niet bij deadlines op het Dashboard (planningsoverzicht)', ['projectdossier/ProjectfinancieringTab.jsx', 'deadlines/FundingDeadlineRow.jsx', 'chat/ProjectContextPanel.jsx'].every((f) => /<BespreekLink/.test(lees(`src/features/kompas-app/${f}`))) && !/BespreekLink/.test(dashboardSrc) && /onBespreek/.test(dashboardSrc));
check('7i: er is nog steeds maar één plek die in subsidie_kompas_program_funding schrijft (projectFinanciering.js)', loop('src').filter((f) => /\.(js|jsx)$/.test(f) && /from\('subsidie_kompas_program_funding'\)/.test(lees(f))).map((f) => f.replace(/\\/g, '/')).join() === 'src/data/services/projectFinanciering.js');
check('7j: askKompas/askKompasStream blijven de enige chatruntime (geen tweede chat-aanroep in de nieuwe modules)', ![kaartSrc, fmSrc].some((t) => /askKompas|functions\.invoke|\/functions\/v1/.test(code(t))));

console.log(`\n${aantal - gefaald}/${aantal} geslaagd`);
process.exit(gefaald ? 1 : 0);
