import { readFileSync } from 'node:fs';
import { kansrijkheid } from '../../src/features/kompas-app/financiering/kansrijkheid.js';
import { berekenDekking, dekkingVanProject, regelUitRpc, isKomendeDeadline } from '../../src/features/kompas-app/financiering/dekkingsplan.js';
import {
  leidActiesAf, actieVoorRegel, actiesVoorProject, opvolgDatum, periodeVoorDagen, groepeerPerPeriode, filterOpProject,
  volgendeStapPerRegel, actiesVoorDashboard, telActies, sorteerActies, ACTIE_TYPES, VRAAG_CODES,
  DREMPEL_WEEK, DREMPEL_HOOG, DREMPEL_MAAND, BESLISTERMIJN_MAANDEN,
} from '../../src/features/kompas-app/financiering/acties.js';

let ok = 0; let fail = 0;
const check = (n, c, d = '') => { if (c) { ok += 1; console.log('OK  ', n); } else { fail += 1; console.log('FAIL', n, d); } };
const gelijk = (n, a, b) => check(n, JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} !== ${JSON.stringify(b)}`);

const NU = new Date(2026, 9, 12); // 12 oktober 2026 (lokale tijd)
const dag = (n) => { const d = new Date(2026, 9, 12 + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
let teller = 0;
const regel = (o) => { teller += 1; return { id: `r${teller}`, naam: `Regel ${teller}`, bronType: 'regeling', status: 'interesting', requested: 10000, awarded: null, deadline: null, eigenDeadline: null, ...o }; };
const project = (o = {}) => ({ id: 'p1', naam: 'Buurtcentrum', begroting: 200000, eigenBijdrage: 20000, gearchiveerd: false, ...o });

// ============================================================ 1. Rekenvoorbeeld uit de opdracht
console.log('\n== 1. Dekkingsplan: het voorbeeld uit de opdracht');
const voorbeeld = [
  regel({ status: 'awarded', awarded: 30000, requested: 30000 }),
  regel({ status: 'submitted', requested: 70000 }),
  regel({ status: 'preparing', requested: 50000 }),
  regel({ status: 'interesting', requested: 30000 }),
  regel({ status: 'rejected', requested: 99999 }),
];
const d = dekkingVanProject(project(), voorbeeld);
gelijk('toegekend 30.000', d.toegekend, 30000);
gelijk('aangevraagd 70.000', d.aangevraagd, 70000);
gelijk('eigen bijdrage 20.000', d.overige, 20000);
gelijk('gepland 80.000 (50.000 + 30.000; afgewezen telt niet)', d.gepland, 80000);
gelijk('nog te plannen 0', d.nogTePlannen, 0);
gelijk('100% ingevuld', d.pctIngevuld, 100);
gelijk('15% daadwerkelijk toegekend (30.000 / 200.000)', d.pctToegekend, 15);
gelijk('plan volledig', d.planVolledig, true);
gelijk('geen overdekking', d.overgedekt, 0);
gelijk('nog te financieren (bestaand begrip) blijft 80.000 = gepland + nog te plannen', d.nogNodig, 80000);

console.log('\n== 2. Bestaande waarden blijven ongewijzigd');
const oud = dekkingVanProject(project(), voorbeeld.slice(0, 2));
gelijk('segmenten.toegekend onveranderd (15)', oud.segmenten.toegekend, 15);
gelijk('segmenten.aangevraagd onveranderd (35)', oud.segmenten.aangevraagd, 35);
gelijk('segmenten.nogNodig onveranderd (40)', oud.segmenten.nogNodig, 40);
gelijk('nogNodig onveranderd (80.000)', oud.nogNodig, 80000);
gelijk('volledigGedekt onveranderd (false: geplande regels tellen niet mee)', dekkingVanProject(project(), voorbeeld).volledigGedekt, false);

console.log('\n== 3. Randgevallen van de berekening');
const gat = dekkingVanProject(project(), [regel({ status: 'submitted', requested: 70000 })]);
gelijk('gat: gepland 0, nog te plannen 110.000', [gat.gepland, gat.nogTePlannen], [0, 110000]);
gelijk('gat: % ingevuld = (20.000 + 70.000) / 200.000 = 45', gat.pctIngevuld, 45);
const over = dekkingVanProject(project(), [regel({ status: 'awarded', awarded: 250000 })]);
gelijk('overdekking: nog te plannen 0', over.nogTePlannen, 0);
gelijk('overdekking: 70.000 te veel', over.overgedekt, 70000);
gelijk('overdekking: % ingevuld maximaal 100', over.pctIngevuld, 100);
gelijk('overdekking: planSegmenten tellen op tot 100', Math.round(Object.values(over.planSegmenten).reduce((t, x) => t + x, 0)), 100);
const zonderBedrag = dekkingVanProject(project(), [regel({ status: 'preparing', requested: null })]);
gelijk('gepland zonder bedrag telt 0', zonderBedrag.gepland, 0);
gelijk('en wordt geteld voor de hint', zonderBedrag.geplandZonderBedrag, 1);
const geenBegroting = dekkingVanProject(project({ begroting: '' }), voorbeeld);
gelijk('geen begroting: percentages 0', [geenBegroting.pctIngevuld, geenBegroting.pctToegekend], [0, 0]);
gelijk('geen begroting: nog te plannen 0, geen overdekking', [geenBegroting.nogTePlannen, geenBegroting.overgedekt], [0, 0]);
gelijk('geen regels: alles 0', (({ gepland, nogTePlannen }) => [gepland, nogTePlannen])(dekkingVanProject(project(), [])), [0, 180000]);
const bijna = dekkingVanProject(project({ eigenBijdrage: 0 }), [regel({ status: 'submitted', requested: 199000 })]);
gelijk('99,5% wordt niet als 100% getoond zolang er iets ontbreekt', bijna.pctIngevuld, 99);
const klein = dekkingVanProject(project({ begroting: 1000000, eigenBijdrage: 0 }), [regel({ status: 'awarded', awarded: 1000 })]);
gelijk('0,1% toegekend wordt minimaal 1%', klein.pctToegekend, 1);
gelijk('lege invoer crasht niet', berekenDekking({ begroting: undefined, regels: undefined, overige: undefined }).nogTePlannen, 0);

// ============================================================ 4. Drempels
console.log('\n== 4. Drempels');
gelijk('drempels 7 / 14 / 30', [DREMPEL_WEEK, DREMPEL_HOOG, DREMPEL_MAAND], [7, 14, 30]);
gelijk('beslistermijn: circa 4 maanden', BESLISTERMIJN_MAANDEN, 4);
[[-5, 'week'], [0, 'week'], [6, 'week'], [7, 'week'], [8, 'maand'], [14, 'maand'], [15, 'maand'], [30, 'maand'], [31, 'later'], [null, 'later']].forEach(([n, p]) => gelijk(`periode bij ${n} dagen = ${p}`, periodeVoorDagen(n), p));

console.log('\n== 5. Actieregels per status');
const p = project();
const act = (o) => actieVoorRegel(regel(o), p, NU);
let a = act({ status: 'interesting', deadline: dag(10) });
gelijk('interesting, 10 dagen: Beslis nu, hoog, Deze maand', [a.type, a.prioriteit, a.periode], ['beslis-nu', 'hoog', 'maand']);
a = act({ status: 'interesting', deadline: dag(14) });
gelijk('interesting, 14 dagen: nog hoog', [a.type, a.prioriteit], ['beslis-nu', 'hoog']);
a = act({ status: 'interesting', deadline: dag(15) });
gelijk('interesting, 15 dagen: eligibility, normaal', [a.type, a.prioriteit, a.periode], ['eligibility', 'normaal', 'maand']);
a = act({ status: 'interesting', deadline: dag(40) });
gelijk('interesting, 40 dagen: Later', [a.type, a.periode], ['eligibility', 'later']);
a = act({ status: 'interesting', deadline: null });
gelijk('interesting zonder deadline: eligibility, Later', [a.type, a.periode, a.prioriteit], ['eligibility', 'later', 'normaal']);
a = act({ status: 'preparing', deadline: dag(5) });
gelijk('preparing, 5 dagen: aanvraag afronden, hoog, Deze week', [a.type, a.prioriteit, a.periode], ['aanvraag-afronden', 'hoog', 'week']);
a = act({ status: 'preparing', deadline: dag(13) });
gelijk('preparing, 13 dagen: hoog, Deze maand', [a.prioriteit, a.periode], ['hoog', 'maand']);
a = act({ status: 'preparing', deadline: dag(20) });
gelijk('preparing, 20 dagen: normaal, Deze maand', [a.prioriteit, a.periode], ['normaal', 'maand']);
a = act({ status: 'preparing', deadline: null });
gelijk('preparing zonder deadline: Stel een deadline in, Later', [a.type, a.periode], ['deadline-instellen', 'later']);
a = act({ status: 'preparing', deadline: dag(-1) });
gelijk('preparing, verstreken: hoog, Deze week', [a.type, a.prioriteit, a.periode], ['deadline-verstreken', 'hoog', 'week']);
a = act({ status: 'interesting', deadline: dag(-30) });
gelijk('interesting, verstreken: ook deadline-verstreken', a.type, 'deadline-verstreken');
a = act({ status: 'interesting', deadline: dag(0) });
gelijk('deadline vandaag: hoog, Deze week', [a.prioriteit, a.periode], ['hoog', 'week']);
a = act({ status: 'preparing', deadline: dag(9), requested: null });
gelijk('bedrag ontbreekt: hint op dezelfde actie (geen tweede actie)', [a.type, a.hint], ['aanvraag-afronden', 'Bedrag ontbreekt']);
a = act({ status: 'preparing', deadline: dag(9) });
gelijk('bedrag aanwezig: geen hint', a.hint, '');
gelijk('afgewezen: geen actie', act({ status: 'rejected', deadline: dag(2) }), null);
gelijk('toegekend met bedrag: geen aanvraagactie', act({ status: 'awarded', awarded: 5000 }), null);
gelijk('toegekend zonder awarded maar met aangevraagd bedrag: geen actie (telt al mee)', act({ status: 'awarded', awarded: null, requested: 5000 }), null);
a = act({ status: 'awarded', awarded: null, requested: null });
gelijk('toegekend zonder enig bedrag: bedrag invullen', a.type, 'bedrag-toegekend-invullen');

console.log('\n== 6. Aangevraagd: opvolgen en beslissing afwachten');
a = act({ status: 'submitted', eigenDeadline: null, deadline: null });
gelijk('zonder datum: beslissing afwachten, Later, normaal', [a.type, a.periode, a.prioriteit], ['beslissing-afwachten', 'later', 'normaal']);
check('zonder datum: tekst noemt circa 4 maanden en verzint geen datum', a.reden === 'meestal binnen circa 4 maanden' && a.datum === null && a.dagen === null, JSON.stringify(a));
a = act({ status: 'submitted', eigenDeadline: dag(10), deadline: dag(10) });
gelijk('eigen datum over 10 dagen: opvolgen, hoog', [a.type, a.prioriteit, a.periode], ['opvolgen', 'hoog', 'maand']);
a = act({ status: 'submitted', eigenDeadline: dag(-3), deadline: dag(-3) });
gelijk('eigen datum verstreken: opvolgen, hoog, Deze week', [a.type, a.prioriteit, a.periode], ['opvolgen', 'hoog', 'week']);
a = act({ status: 'submitted', eigenDeadline: dag(60), deadline: dag(60) });
gelijk('eigen datum over 60 dagen: afwachten, normaal, Later', [a.type, a.prioriteit, a.periode], ['beslissing-afwachten', 'normaal', 'later']);
gelijk('opvolgDatum leest alleen een eigen datum bij Aangevraagd', [opvolgDatum(regel({ status: 'submitted', eigenDeadline: '2026-11-01' })), opvolgDatum(regel({ status: 'preparing', eigenDeadline: '2026-11-01' })), opvolgDatum(regel({ status: 'submitted', eigenDeadline: 'morgen' }))], ['2026-11-01', null, null]);
gelijk('isKomendeDeadline blijft onveranderd: Aangevraagd telt niet als komende deadline', isKomendeDeadline(regel({ status: 'submitted', deadline: dag(5) }), NU), false);

console.log('\n== 7. Acties op projectniveau');
let pa = actiesVoorProject(project({ begroting: '' }), [regel({ status: 'awarded', awarded: 1 })], NU);
gelijk('geen begroting: Vul de begroting in, hoog, Deze maand', pa.map((x) => [x.type, x.prioriteit, x.periode]), [['begroting-invullen', 'hoog', 'maand']]);
pa = actiesVoorProject(project(), [], NU);
gelijk('geen financiers: eerste financier toevoegen (geen gat-actie erbij)', pa.map((x) => x.type), ['eerste-financier']);
pa = actiesVoorProject(project(), [regel({ status: 'submitted', requested: 70000 })], NU);
gelijk('gat: Nog €... te plannen', pa.map((x) => x.type), ['gat-dekken']);
check('gat: bedrag staat in de tekst', /110\.000/.test(pa[0].tekst), pa[0].tekst);
pa = actiesVoorProject(project(), voorbeeld, NU);
gelijk('volledig gepland: geen projectactie', pa, []);
pa = actiesVoorProject(project({ begroting: '' }), [], NU);
gelijk('geen begroting en geen financiers: beide acties', pa.map((x) => x.type).sort(), ['begroting-invullen', 'eerste-financier']);

console.log('\n== 8. De lijst: sortering, groepen, filter, dashboard');
const p2 = project({ id: 'p2', naam: 'Jeugdwerk' });
const lijst = leidActiesAf({
  projecten: [p, p2, project({ id: 'p3', naam: 'Oud', gearchiveerd: true })],
  regelsPerProject: {
    p1: [
      regel({ id: 'a1', naam: 'Provincie', status: 'preparing', deadline: dag(13) }),
      regel({ id: 'a2', naam: 'Stichting X', status: 'interesting', deadline: dag(35) }),
      regel({ id: 'a3', naam: 'Gemeente', status: 'submitted', requested: 70000 }),
      regel({ id: 'a4', naam: 'Fonds Y', status: 'rejected' }),
      regel({ id: 'a5', naam: 'Fonds W', status: 'awarded', awarded: 30000 }),
    ],
    p2: [],
    p3: [regel({ id: 'z1', naam: 'Gearchiveerd', status: 'preparing', deadline: dag(2) })],
  },
  nu: NU,
});
check('gearchiveerde projecten tellen niet mee', !lijst.some((x) => x.projectId === 'p3'));
check('afgewezen en toegekende regels leveren geen actie', !lijst.some((x) => x.regelId === 'a4' || x.regelId === 'a5'));
gelijk('volgorde: Deze maand (hoog) eerst, dan Later met datum, dan zonder datum', lijst.map((x) => x.id), ['a1:aanvraag-afronden', 'a2:eligibility', 'p1:gat-dekken', 'a3:beslissing-afwachten', 'p2:eerste-financier']);
gelijk('eerste actie is Provincie (Deze maand, hoog)', [lijst[0].id, lijst[0].periode, lijst[0].prioriteit], ['a1:aanvraag-afronden', 'maand', 'hoog']);
const groepen = groepeerPerPeriode(lijst);
gelijk('geen acties Deze week', groepen.week.length, 0);
gelijk('Deze maand: 1', groepen.maand.length, 1);
check('Later bevat de rest, ook zonder datum', groepen.later.length === lijst.length - 1, String(groepen.later.length));
gelijk('filter op project p2', filterOpProject(lijst, 'p2').map((x) => x.type), ['eerste-financier']);
gelijk('filter zonder project geeft alles', filterOpProject(lijst, null).length, lijst.length);
gelijk('volgende stap per regel (Provincie)', volgendeStapPerRegel(lijst).a1.tekst, 'Aanvraag afronden');
check('volgende stap kent geen projectacties', Object.keys(volgendeStapPerRegel(lijst)).every((k) => k.startsWith('a')));
gelijk('dashboard: eerste 3', actiesVoorDashboard(lijst, 3).map((x) => x.id), lijst.slice(0, 3).map((x) => x.id));
gelijk('dashboard: standaard maximaal 5', actiesVoorDashboard(lijst).length <= 5, true);
gelijk('tellers', telActies(lijst), { totaal: lijst.length, hoog: 1 });
check('elke actie heeft een bekend type en een stabiel uniek id', lijst.every((x) => ACTIE_TYPES.indexOf(x.type) !== -1) && new Set(lijst.map((x) => x.id)).size === lijst.length);
check('vraagcodes zijn vaste codes (geen vrije tekst)', lijst.every((x) => x.vraag === null || VRAAG_CODES.indexOf(x.vraag) !== -1));
check('leeg en ongeldige invoer crasht niet', leidActiesAf({}).length === 0 && sorteerActies(null).length === 0 && actieVoorRegel(null, p, NU) === null);
const kRegels = [regel({ id: 'k1', naam: 'K', status: 'preparing', deadline: dag(3) })];
const uitkomst = () => JSON.stringify(leidActiesAf({ projecten: [p], regelsPerProject: { p1: kRegels }, nu: NU }));
gelijk('deterministisch: twee keer dezelfde uitkomst', uitkomst(), uitkomst());

console.log('\n== 9. Premium-bronnen lekken niet');
const verborgen = regelUitRpc({ id: 'v1', program_id: 'p1', bron_status: 'verborgen', bron_naam: 'GEHEIM FONDS', status: 'preparing', eigen_deadline: dag(4), requested_amount: 1000 });
const lek = leidActiesAf({ projecten: [p], regelsPerProject: { p1: [verborgen] }, nu: NU });
check('actie bestaat voor de verborgen bron', lek.length >= 1 && lek[0].regelId === 'v1');
check('naam van de verborgen bron staat nergens in de actie', !JSON.stringify(lek).includes('GEHEIM'));

console.log('\n== 10. Bron: pure module, geen netwerk of opslag, geen AI');
const bron = readFileSync('src/features/kompas-app/financiering/acties.js', 'utf8').replace(/\/\/.*$/gm, '');
check('geen fetch, supabase of storage in acties.js', !/fetch\(|supabase|localStorage|sessionStorage|XMLHttpRequest/.test(bron));
check('geen React-import', !/from 'react'/.test(bron));
check('importeert alleen uit dekkingsplan.js', (bron.match(/from '([^']+)'/g) || []).every((x) => x.includes('./dekkingsplan.js')));


// ============================================================ 11. "Waarom het past": een fonds uit de lijst van het project is nooit negatief
console.log('\n== 11. Waarom het past: vergelijking met het project, positief bij een fonds uit de lijst');
{
  const fonds = { themasNamen: ['Kunst en cultuur'], doelgroepenNamen: ['Kinderen en jongeren'], werkgebiedenNamen: ['Noord-Holland'], status: 'Open' };
  const proj = { discipline: ['Kunst en cultuur'], doelgroep: ['Kinderen en jongeren'], regio: 'Zaandam', gevraagd: '20000' };
  const profielAnders = { themes: ['Sport'], region: 'Groningen' };
  const k = kansrijkheid(fonds, profielAnders, [proj], { aanbevolen: true, project: proj });

  check('het project telt, niet het organisatieprofiel: goede match ondanks een ander profiel', k.label === 'Goede match' && /disciplines Kunst en cultuur sluiten aan bij uw project/.test(k.tekst) && !/profiel/.test(k.tekst));
  check('de doelgroep van het project wordt ook genoemd', /doelgroepen Kinderen en jongeren sluiten aan/.test(k.tekst));
  check('een ander werkgebied (Zaandam tegenover Noord-Holland) wordt niet als afwijkend gemeld', !/wijkt af/.test(k.tekst));

  const anders = kansrijkheid({ themasNamen: ['Sport'], werkgebiedenNamen: ['Limburg'], status: 'Open' }, {}, [proj], { aanbevolen: true, project: proj });

  check('sluit niets aan: nooit "niet passend", wel de uitleg dat het uit de matching komt', anders.label === 'Past bij uw project' && !/niet passend|sluiten niet aan|wijkt af/i.test(anders.label + anders.tekst));

  const uitgeput = kansrijkheid({ ...fonds, status: 'Budget uitgeput', bedragMax: 5000 }, {}, [proj], { aanbevolen: true, project: proj });

  check('echte aandachtspunten blijven onder "Let op", zonder negatief label', uitgeput.label === 'Goede match' && /Let op: het budget is voor deze ronde uitgeput, uw gevraagde bedrag ligt boven het maximum/.test(uitgeput.tekst));

  const oud = kansrijkheid({ themasNamen: ['Sport'], werkgebiedenNamen: ['Limburg'] }, { themes: ['Kunst'], region: 'Zaandam' }, []);

  check('zonder opties werkt het oude gedrag voor de deadlinepagina nog', ['Waarschijnlijk niet passend', 'Mogelijk passend', 'Goede match'].includes(oud.label) && /uw profiel/.test(oud.tekst));
}

console.log(`\n${ok} OK, ${fail} FOUT`);
process.exit(fail ? 1 : 0);
