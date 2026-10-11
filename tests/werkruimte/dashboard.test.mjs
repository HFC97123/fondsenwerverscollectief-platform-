// Node-tests voor het Dashboard van de werkruimte (Fase 1, bijgewerkt voor Fase 2): rekenregels via de gedeelde module,
// afleidingen en statische controles op navigatie, route, Free-gedrag en "geen eigen opslag".
// De rekenmodule zelf en het dossier worden uitgebreid getest in dekkingsplan.test.mjs.
//   node tests/werkruimte/run.mjs   (vanuit de repo-root)
import { readFileSync } from 'node:fs';
import {
  ACTIEVE_STATUSSEN,
  berekenDekking,
  bouwDashboard,
  dagenTekst,
  dagenTot,
  dekkingVanProject,
  eerstvolgendeDeadline,
  formatDatum,
  formatTijd,
  komendeDeadlines,
  organisatieVolledigheid,
  overigeDekkingVanProject,
  recenteDocumenten,
  recenteGesprekken,
} from '../../src/features/kompas-app/dashboard/dashboardData.js';

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

const NU = new Date(2026, 9, 11, 10, 0, 0); // 11 okt 2026, lokale tijd

// ---------- rekenregels: het voorbeeld uit de opdracht ----------
const regel = (status, requested, awarded = null, extra = {}) => ({ status, requested, awarded, ...extra });
{
  const d = berekenDekking({ begroting: 100000, regels: [regel('awarded', 30000), regel('submitted', 20000)], overige: 0 });
  gelijk('voorbeeld: toegekend 30k', d.toegekend, 30000);
  gelijk('voorbeeld: aangevraagd 20k', d.aangevraagd, 20000);
  gelijk('voorbeeld: nog te financieren 50k', d.nogNodig, 50000);
  gelijk('voorbeeld: segmenten 30/20/0/50', [d.segmenten.toegekend, d.segmenten.aangevraagd, d.segmenten.overige, d.segmenten.nogNodig], [30, 20, 0, 50]);
  check('voorbeeld: niet volledig gedekt', d.volledigGedekt === false);
}
{
  const d = berekenDekking({ begroting: 100000, regels: [regel('awarded', 30000, 25000)], overige: 0 });
  gelijk('toegekend gebruikt awarded_amount als die er is', d.toegekend, 25000);
  const f = berekenDekking({ begroting: 100000, regels: [regel('awarded', 30000, null)], overige: 0 });
  gelijk('toegekend valt terug op gevraagd bedrag', f.toegekend, 30000);
  const l = berekenDekking({ begroting: 100000, regels: [regel('awarded', 30000, '')], overige: 0 });
  gelijk('lege awarded-tekst = terugval op gevraagd', l.toegekend, 30000);
}
{
  const d = berekenDekking({
    begroting: 100000,
    regels: [regel('interesting', 10000), regel('preparing', 20000), regel('rejected', 40000), regel('submitted', 5000)],
    overige: 0,
  });
  gelijk('alleen submitted telt als aangevraagd', d.aangevraagd, 5000);
  gelijk('interesting/preparing/rejected tellen niet mee', d.toegekend, 0);
  gelijk('nog te financieren zonder niet-meetellende regels', d.nogNodig, 95000);
}
{
  const d = berekenDekking({ begroting: 100000, regels: [regel('awarded', 90000), regel('submitted', 30000)], overige: 0 });
  gelijk('overdekking: nooit negatief', d.nogNodig, 0);
  check('overdekking: volledig gedekt', d.volledigGedekt === true);
  const som = d.segmenten.toegekend + d.segmenten.aangevraagd + d.segmenten.overige + d.segmenten.nogNodig;
  check('overdekking: balk past binnen 100%', som <= 100.01 && som >= 99.9, String(som));
  check('overdekking: geen negatief segment', Object.values(d.segmenten).every((x) => x >= 0));
}
{
  const d = berekenDekking({ begroting: 0, regels: [regel('awarded', 5000)], overige: 1000 });
  check('geen begroting: heeftBegroting false', d.heeftBegroting === false);
  gelijk('geen begroting: nog nodig 0, geen NaN', d.nogNodig, 0);
  check('geen begroting: segmenten 0', Object.values(d.segmenten).every((x) => x === 0));
  check('geen begroting: niet volledig gedekt', d.volledigGedekt === false);
  const leeg = berekenDekking({ begroting: '', regels: undefined, overige: undefined });
  gelijk('leeg: alles 0', [leeg.toegekend, leeg.aangevraagd, leeg.overige, leeg.nogNodig], [0, 0, 0, 0]);
}
{
  const d = berekenDekking({ begroting: 100000, regels: [regel('awarded', 30000), regel('submitted', 20000)], overige: 15000 });
  gelijk('overige dekking wordt van nog-nodig afgetrokken', d.nogNodig, 35000);
  gelijk('overige dekking apart getoond', d.overige, 15000);
}

// ---------- project + dekkingsplan (bron: subsidie_kompas_program_funding) ----------
const rg = (id, naam, status, requested, deadline, extra = {}) => ({ id, naam, funder: `Fonds ${naam}`, status, requested, awarded: null, deadline, reminder: true, ...extra });
const REGELS_P1 = [
  rg('r1', 'Regeling A', 'awarded', 30000, '2026-10-01'),
  rg('r2', 'Regeling B', 'submitted', 20000, '2026-11-20'),
  rg('r3', 'Regeling C', 'preparing', null, '2026-11-12', { reminder: false }),
  rg('r4', 'Regeling D', 'rejected', 99999, '2026-12-01'),
];
const project = (extra = {}) => ({
  id: 'p1',
  naam: 'Buurtkeuken De Brug',
  regio: 'Utrecht-Noord',
  periodeVan: 'jan 2027',
  periodeTot: 'dec 2027',
  begroting: '€ 100.000',
  eigenBijdrage: '€ 10.000',
  eerder: [{ naam: 'Oud', bedrag: '50000', uitkomst: 'Toegekend' }],
  cofin: [
    { naam: 'Gemeente', bedrag: '5000', status: 'Toegezegd' },
    { naam: 'Bank', bedrag: '9000', status: 'Aangevraagd' },
  ],
  // Legacy-kolom: wordt niet meer gelezen voor financiering (moet de uitkomst niet beïnvloeden).
  regelingen: [{ id: 'l1', naam: 'LEGACY', plan: 'Toegekend', aangevraagd: '99999', deadline: '2026-10-15' }],
  docs: [],
  gearchiveerd: false,
  ...extra,
});
{
  gelijk('overige dekking = alleen eigen bijdrage (co-financiers met tekstbedragen en eerdere subsidies tellen niet)', overigeDekkingVanProject(project()), 10000);
  const d = dekkingVanProject(project(), REGELS_P1);
  gelijk('dekking toegekend/aangevraagd/overige/nog', [d.toegekend, d.aangevraagd, d.overige, d.nogNodig], [30000, 20000, 10000, 40000]);
  gelijk('legacy linked_schemes (project.regelingen) beïnvloedt de dekking niet', dekkingVanProject(project(), []).toegekend, 0);
  gelijk('project zonder regels werkt', dekkingVanProject(project(), undefined).nogNodig, 90000);
  gelijk('project zonder alles werkt', dekkingVanProject({ id: 'x' }).nogNodig, 0);
  gelijk('geen cofinNietMeegeteld meer: cofinanciers staan als regels in program_funding', dekkingVanProject(project(), REGELS_P1).cofinNietMeegeteld, undefined);
}

// ---------- deadlines ----------
gelijk('dagenTot: vandaag', dagenTot('2026-10-11', NU), 0);
gelijk('dagenTot: morgen, ook laat op de dag', dagenTot('2026-10-12', new Date(2026, 9, 11, 23, 59)), 1);
gelijk('dagenTot: gisteren', dagenTot('2026-10-10', NU), -1);
check('dagenTot: ongeldig -> null', dagenTot('31-12-2026', NU) === null && dagenTot('', NU) === null && dagenTot(null, NU) === null && dagenTot('2026-02-31', NU) === null);
gelijk('datumnotatie', formatDatum('2026-11-12'), '12 nov 2026');
gelijk('dagentekst', [dagenTekst(0), dagenTekst(1), dagenTekst(5), dagenTekst(-2), dagenTekst(null)], ['vandaag', 'morgen', 'over 5 dagen', 'verstreken', '']);
gelijk('actieve statussen', ACTIEVE_STATUSSEN, ['interesting', 'preparing']);
{
  const kd = komendeDeadlines([project()], { p1: REGELS_P1 }, NU);
  gelijk('komend: alleen actieve regel met toekomstige deadline', kd.map((x) => x.naam), ['Regeling C']);
  check('komend: verstreken deadline (Regeling A) niet getoond', !kd.some((x) => x.naam === 'Regeling A'));
  check('komend: aangevraagde regel niet getoond', !kd.some((x) => x.naam === 'Regeling B'));
  check('komend: afgewezen regel niet getoond', !kd.some((x) => x.naam === 'Regeling D'));
  gelijk('komend: dagen en projectnaam', [kd[0].dagen, kd[0].projectNaam, kd[0].status], [32, 'Buurtkeuken De Brug', 'preparing']);
}
{
  const p2 = project({
    id: 'p2',
    naam: 'Tweede',
  });
  const REGELS_P2 = [
    rg('a', 'Vandaag open', 'interesting', 1, '2026-10-11'),
    rg('b', 'Kapotte datum', 'interesting', 1, '31-12-2026'),
    rg('c', 'Geen datum', 'interesting', 1, null),
    rg('d', 'Later', 'preparing', 1, '2027-01-05'),
  ];
  const archief = project({ id: 'p3', naam: 'Archief', gearchiveerd: true });
  const FUND = { p1: REGELS_P1, p2: REGELS_P2, p3: [rg('z', 'Archief regeling', 'interesting', 1, '2026-10-20')] };
  const kd = komendeDeadlines([project(), p2, archief], FUND, NU);
  gelijk('komend: gesorteerd, vandaag telt, kapotte/ontbrekende datum niet, archief niet', kd.map((x) => x.naam), ['Vandaag open', 'Regeling C', 'Later']);
  gelijk('komend: max wordt gerespecteerd', komendeDeadlines([project(), p2], FUND, NU, 1).length, 1);
  const ed = eerstvolgendeDeadline(REGELS_P1, NU);
  gelijk('eerstvolgende deadline van project', [ed.datum, ed.naam, ed.dagen], ['2026-11-12', 'Regeling C', 32]);
  gelijk('geen komende deadline -> null', eerstvolgendeDeadline([rg('o', 'Oud', 'interesting', 1, '2026-01-01')], NU), null);
}

// ---------- gesprekken ----------
{
  const projecten = [project(), project({ id: 'p2', naam: 'Tweede' })];
  const g = [
    { id: 'g1', titel: 'Oud gesprek', tijd: '2026-10-01T10:00:00Z', projectId: 'p1' },
    { id: 'g2', titel: 'Nieuw gesprek', tijd: '2026-10-10T10:00:00Z', projectId: 'p2' },
    { id: 'g3', titel: '', tijd: '2026-10-05T10:00:00Z', projectId: null },
    { id: 'g4', titel: 'Weggegooid project', tijd: '2026-10-02T10:00:00Z', projectId: 'bestaat-niet' },
  ];
  const r = recenteGesprekken(g, projecten, 3);
  gelijk('gesprekken: nieuwste eerst, max 3', r.map((x) => x.id), ['g2', 'g3', 'g4']);
  gelijk('gesprekken: projectnaam, geen project, onbekend project', [r[0].projectNaam, r[1].projectNaam, r[2].projectNaam], ['Tweede', null, null]);
  gelijk('gesprekken: lege titel krijgt standaardnaam', r[1].titel, 'Gesprek');
  gelijk('gesprekken: lege lijst/null', [recenteGesprekken([], [], 5).length, recenteGesprekken(null, null, 5).length], [0, 0]);
}

// ---------- documenten ----------
{
  const projecten = [
    project({ docs: [{ id: 'd1', naam: 'Projectplan', soort: 'Projectplan', versie: 2, gemaakt: '2026-10-09T10:00:00Z', vervangen: false }, { id: 'd0', naam: 'Projectplan v1', soort: 'Projectplan', versie: 1, gemaakt: '2026-10-01T10:00:00Z', vervangen: true }] }),
    project({ id: 'p2', naam: 'Tweede', docs: [{ id: 'd2', naam: 'Begroting', soort: 'Begroting', versie: 1, gemaakt: '2026-10-10T10:00:00Z', vervangen: false }] }),
    project({ id: 'p3', naam: 'Archief', gearchiveerd: true, docs: [{ id: 'd3', naam: 'Archiefdoc', soort: 'Overig', gemaakt: '2026-10-11T10:00:00Z' }] }),
  ];
  const r = recenteDocumenten(projecten, 5);
  gelijk('documenten: nieuwste eerst, vervangen en gearchiveerd niet', r.map((x) => x.id), ['d2', 'd1']);
  gelijk('documenten: projectnaam en soort', [r[0].projectNaam, r[0].soort], ['Tweede', 'Begroting']);
}

// ---------- organisatie ----------
{
  const leeg = organisatieVolledigheid({});
  gelijk('organisatie: leeg profiel 0%', [leeg.pct, leeg.ingevuld, leeg.naam], [0, 0, '']);
  const deel = organisatieVolledigheid({ name: ' Stichting X ', mission: 'Missie', themas: ['Welzijn'], doelgroepen: [], website: '   ' });
  gelijk('organisatie: gedeeltelijk (spaties en lege arrays tellen niet)', [deel.ingevuld, deel.pct, deel.naam], [3, 38, 'Stichting X']);
  check('organisatie: ontbrekende velden benoemd', deel.ontbreekt.includes('Website') && deel.ontbreekt.includes('Doelgroepen'));
  const vol = organisatieVolledigheid({ name: 'A', website: 'a.nl', rechtsvorm: 'Stichting', kvk: '1', mission: 'm', regio: 'r', themas: ['t'], doelgroepen: ['d'] });
  gelijk('organisatie: compleet 100%', vol.pct, 100);
  gelijk('organisatie: null-profiel crasht niet', organisatieVolledigheid(null).pct, 0);
}

// ---------- tijd ----------
gelijk('tijd: vandaag', formatTijd(new Date(2026, 9, 11, 8, 0).toISOString(), NU), 'Vandaag');
gelijk('tijd: gisteren', formatTijd(new Date(2026, 9, 10, 23, 0).toISOString(), NU), 'Gisteren');
gelijk('tijd: eerder dit jaar', formatTijd(new Date(2026, 8, 3, 12, 0).toISOString(), NU), '3 sep');
gelijk('tijd: ander jaar', formatTijd(new Date(2025, 11, 24, 12, 0).toISOString(), NU), '24 dec 2025');
gelijk('tijd: ongeldig/leeg', [formatTijd('', NU), formatTijd('geen-datum', NU), formatTijd(null, NU)], ['', '', '']);

// ---------- bouwDashboard ----------
{
  const d = bouwDashboard({
    projects: [project(), project({ id: 'p2', naam: 'Zonder financiering', regelingen: [], begroting: '', eigenBijdrage: '', cofin: [] }), project({ id: 'p3', naam: 'Archief', gearchiveerd: true })],
    funding: { p1: REGELS_P1 },
    conversations: [],
    orgProfile: {},
    nu: NU,
  });
  gelijk('dashboard: gearchiveerd project niet getoond', d.projecten.map((p) => p.id), ['p1', 'p2']);
  gelijk('dashboard: project zonder funding werkt', [d.projecten[1].aantalRegels, d.projecten[1].volgendeDeadline, d.projecten[1].dekking.heeftBegroting], [0, null, false]);
  gelijk('dashboard: dekking identiek aan dekkingVanProject (één rekenmodule)', d.projecten[0].dekking, dekkingVanProject(project(), REGELS_P1));
  gelijk('dashboard: periode en locatie', [d.projecten[0].periode, d.projecten[0].locatie], ['jan 2027 – dec 2027', 'Utrecht-Noord']);
  check('dashboard: leeg alles crasht niet', (() => { try { bouwDashboard({}); bouwDashboard({ projects: null, conversations: null, orgProfile: null }); return true; } catch (e) { return false; } })());
}

// ---------- statische controles op de code ----------
const lees = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
{
  const routes = lees('src/app/routes.js');
  check('route: /kompas/dashboard bestaat voor leden', /pad: '\/kompas\/dashboard',\s*area: AREA\.app,\s*titel: 'Dashboard',\s*toegang: 'lid'/.test(routes));
  check('route: chat blijft /kompas (landingsplek ongewijzigd)', /pad: '\/kompas', area: AREA\.app, titel: 'Subsidie Kompas', toegang: 'publiek'/.test(routes));

  const app = lees('src/features/kompas-app/KompasApp.jsx');
  check('KompasApp: dashboardroute geregistreerd', app.includes("'/kompas/dashboard': DashboardPage"));
  check('KompasApp: werknav alleen voor beheerder/Pro/Premium', /heeftWerkNav = Boolean\(auth\.isBeheerder \|\| auth\.isPro \|\| auth\.isPremium\)/.test(app));
  check('KompasApp: Free houdt de bestaande KompasSubnav', app.includes('KOP_VAN_KOMPASAPP.has(route.pad) && <KompasSubnav toonPlan />'));
  check('KompasApp: KompasProvider key=userId blijft', app.includes('key={userId || \'anoniem\'}'));

  const subnav = lees('src/shared/ui/KompasSubnav.jsx');
  check('KompasSubnav: verbergt zich alleen via WerkNavContext', subnav.includes('useContext(WerkNavContext)') && /if \(werkNavActief\) \{\s*return null;/.test(subnav));
  check('KompasSubnav: bestaande items ongewijzigd', ['Hoe het werkt', 'Deadlines', 'FAQ', 'Terug naar'].every((t) => subnav.includes(t)));
  gelijk('context standaard false', /createContext\(false\)/.test(lees('src/features/kompas-app/werkNavContext.js')), true);

  const nav = lees('src/features/kompas-app/KompasWerkNav.jsx');
  const volgorde = [...nav.matchAll(/key: '(\w+)', label: '([^']+)'/g)].map((m) => m[2]);
  gelijk('werknav: definitieve volgorde', volgorde, ['Dashboard', 'Chat', 'Projecten', 'Deadlines', 'Documenten']);
  check('werknav: Organisatiemenu met profiel, account, abonnement, uitloggen', ['Organisatieprofiel', 'Account', 'Abonnement', 'Uitloggen'].every((t) => nav.includes(`>${t}</`)));
  check('werknav: projectdossier is geen hoofdmenu-item', !/label: 'Projectdossier'/.test(nav));

  const dash = lees('src/features/kompas-app/dashboard/DashboardPage.jsx');
  check('dashboard: geen eigen opslag of netwerk', !/supabase|localStorage|sessionStorage|fetch\(|indexedDB|\.from\(/.test(dash));
  check('dashboard: geen AI-aanroep', !/askKompas|askKompasStream|functions\.invoke/.test(dash));
  check('dashboard: alleen leesacties op de store (geen save/delete)', !/store\.(saveProject|deleteProject|archiveProject|werkProjectBij|setOrgField|verwijderGesprek)/.test(dash));
  const data = lees('src/features/kompas-app/dashboard/dashboardData.js');
  check('dashboardData: puur (alleen de gedeelde rekenmodule als import)', (data.match(/^\s*import\s/gm) || []).length === 1 && data.includes("from '../financiering/dekkingsplan.js'"));
  check('dashboardData: geen eigen financiële rekenlogica meer (geen reduce/sommen)', !/reduce\(|\+= |Math\.max/.test(data));

  const store = lees('src/features/kompas-app/KompasStore.jsx');
  check('store: chatverzoek is een ref (geen opslag) en wordt eenmalig overgenomen', /chatVerzoekRef = useRef\(null\)/.test(store) && /neemChatVerzoek: \(\) => \{[\s\S]*?chatVerzoekRef\.current = null;/.test(store));
  const tool = lees('src/features/kompas-app/KompasToolPage.jsx');
  check('chat: overdracht alleen voor Pro/Premium en via bestaande handlers', /store\.neemChatVerzoek[\s\S]{0,400}!hasPlanTools[\s\S]{0,700}openGesprek\(\{ id: verzoek\.gesprekId[\s\S]{0,200}koppelProject\(projectId\)/.test(tool));
  check('chat: askKompas-aanroep ongewijzigd aanwezig', tool.includes('activeProgramId: hasPlanTools && isEchtId(gekoppeldProjectId) ? gekoppeldProjectId : null'));
}

console.log(`${ok} geslaagd, ${fail} mislukt`);
process.exit(fail ? 1 : 0);
