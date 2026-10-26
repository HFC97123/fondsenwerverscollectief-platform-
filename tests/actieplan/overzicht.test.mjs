// Actieplan-overzicht: nu aan de beurt, hierna, tijdlijn en go/no-go.
import { kortDatum, faseVan, goNoGoDatum, bepaalNuEnHierna, bouwTijdlijn, positie, maandMarkeringen, plusDagen, vandaagIso, waarschuwingTekst, GO_NOGO_DAGEN } from '../../src/features/kompas-app/financiering/actieplanOverzicht.js';
import { actieUitRij } from '../../src/features/kompas-app/financiering/actieplan.js';

let ok = 0; let fail = 0;
const check = (n, c, d = '') => { if (c) { ok += 1; console.log('OK  ', n); } else { fail += 1; console.log('FAIL', n, d); } };
const gelijk = (n, a, b) => check(n, JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} !== ${JSON.stringify(b)}`);

const NU = new Date('2026-10-26T10:00:00');
const P = { id: 'p1', naam: 'Kinderkunst Zaandam', periodeVan: '2027-05-01', periodeTot: '2027-06-14' };
let teller = 0;
const item = (o = {}) => { teller += 1; return { sleutel: `t${teller}`, soort: 'taak', projectId: 'p1', regelNaam: '', titel: 'Actie', status: 'todo', prioriteit: 'normal', datum: '', taak: { fase: '' }, afgeleid: null, ...o }; };
const contact = (fonds, datum, o = {}) => item({ titel: `Contact opnemen met ${fonds} over passendheid`, regelNaam: fonds, datum, prioriteit: 'high', taak: { fase: 'navragen' }, ...o });
const indienen = (fonds, datum, o = {}) => item({ titel: `Aanvraag bij ${fonds} indienen`, regelNaam: fonds, datum, prioriteit: 'high', taak: { fase: 'indienen' }, ...o });
const uitslag = (fonds, datum, o = {}) => item({ titel: `Uitslag van ${fonds} verwacht`, regelNaam: fonds, datum, taak: { fase: 'besluit' }, ...o });

console.log('== datums');
check('6 weken is 42 dagen', GO_NOGO_DAGEN === 42);
check('go/no-go ligt 6 weken voor de start (1 mei 2027 geeft 20 maart 2027)', goNoGoDatum(P) === '2027-03-20', goNoGoDatum(P));
check('zonder startdatum geen go/no-go', goNoGoDatum({ id: 'x', periodeVan: '' }) === '' && goNoGoDatum({ id: 'x', periodeVan: 'Q1 2027' }) === '');
check('kortDatum: dag en maand zonder jaar', kortDatum('2026-11-02') === '2 nov' && kortDatum('') === '');
check('plusDagen over een maandgrens', plusDagen('2026-10-30', 3) === '2026-11-02');
check('vandaagIso is de lokale datum', vandaagIso(NU) === '2026-10-26');

console.log('== fase herkennen');
check('fase uit de opgeslagen taak', faseVan(contact('A', '2026-11-02')) === 'navragen' && faseVan(indienen('A', '2026-12-01')) === 'indienen' && faseVan(uitslag('A', '2027-03-01')) === 'besluit');
check('oudere taak zonder fase: herkend aan de titel', faseVan(item({ titel: 'Contact opnemen met Fonds B over passendheid, aanvraag en behandeltermijn' })) === 'navragen' && faseVan(item({ titel: 'Uitslag van Fonds B verwacht' })) === 'besluit' && faseVan(item({ titel: 'Aanvraag bij Fonds B indienen' })) === 'indienen');
check('eigen taak zonder herkenning is overig', faseVan(item({ titel: 'Begroting laten nakijken' })) === 'overig');
check('afgeleide acties: soort bepaalt de fase', faseVan(item({ soort: 'afgeleid', taak: null, afgeleid: { type: 'beslissing-afwachten' } })) === 'besluit' && faseVan(item({ soort: 'afgeleid', taak: null, afgeleid: { type: 'aanvraag-afronden' } })) === 'indienen' && faseVan(item({ soort: 'afgeleid', taak: null, afgeleid: { type: 'eligibility' } })) === 'navragen');
check('de fase uit de database komt mee in de taak', actieUitRij({ id: 'a', program_id: 'p', title: 't', planning_fase: 'indienen' }).fase === 'indienen' && actieUitRij({ id: 'a', program_id: 'p', title: 't' }).fase === '');

console.log('== nu aan de beurt en hierna');
const lijst = [
  indienen('Cultuurfonds', '2026-12-01'),
  contact('Zaanstad', '2026-11-02'),
  contact('Cultuurfonds', '2026-11-02', { prioriteit: 'normal' }),
  uitslag('Cultuurfonds', '2027-04-01'),
  contact('Pieter Bastiaan', '2026-11-09'),
  item({ titel: 'Klaar', datum: '2026-10-20', status: 'done' }),
];
const r = bepaalNuEnHierna({ items: lijst, projecten: [P], nu: NU });
check('nu: de eerstvolgende open actie op datum, hoogste prioriteit eerst', r.nu && r.nu.titel.includes('Zaanstad'), r.nu && r.nu.titel);
check('afgeronde acties tellen niet mee', !r.nu || r.nu.status !== 'done');
check('hierna: hooguit drie', r.hierna.length === 3, String(r.hierna.length));
check('een uitslag die we afwachten staat niet in nu of hierna', ![r.nu, ...r.hierna].some((i) => i && /^Uitslag van/.test(i.titel)));
gelijk('hierna op datum', r.hierna.map((i) => i.datum), ['2026-11-02', '2026-11-09', '2026-12-01']);
const ruim = bepaalNuEnHierna({ items: [contact('A', '2027-02-01')], projecten: [P], nu: NU });
check('go/no-go komt als mijlpaal in hierna, met de datum', ruim.hierna.some((i) => i.soort === 'mijlpaal' && i.datum === '2027-03-20'));
check('de mijlpaal is nooit "nu"', ruim.nu && ruim.nu.soort !== 'mijlpaal');
check('een go/no-go in het verleden telt niet meer mee', !bepaalNuEnHierna({ items: [], projecten: [{ ...P, periodeVan: '2026-11-01' }], nu: NU }).hierna.some((i) => i.soort === 'mijlpaal'));
const leeg = bepaalNuEnHierna({ items: [uitslag('A', '2027-01-01')], projecten: [], nu: NU });
check('alleen een afwachtende uitslag: niets aan de beurt', leeg.nu === null && leeg.hierna.length === 0);
check('acties zonder datum komen na acties met een datum', bepaalNuEnHierna({ items: [item({ titel: 'Zonder datum' }), contact('A', '2026-11-05')], projecten: [], nu: NU }).nu.titel.includes('A'));

console.log('== tijdlijn');
const tl = bouwTijdlijn({ project: P, items: lijst.concat([item({ projectId: 'p2', regelNaam: 'Ander', datum: '2026-11-01' })]), nu: NU });
check('een baan per fonds, andere projecten niet', tl.banen.length === 3 && !tl.banen.some((b) => b.fonds === 'Ander'), tl.banen.map((b) => b.fonds).join(','));
const cf = tl.banen.find((b) => b.fonds === 'Cultuurfonds');
gelijk('punten van een fonds op datum met hun label', cf.punten.map((p) => [p.label, p.datum]), [['Contact', '2026-11-02'], ['Indienen', '2026-12-01'], ['Uitslag', '2027-04-01']]);
check('uitslag na het go/no-go-moment is te laat', cf.punten[2].stijl === 'uitslag-laat');
check('er is één waarschuwing, met naam en datums', tl.waarschuwingen.length === 1 && tl.waarschuwingen[0].fonds === 'Cultuurfonds' && tl.waarschuwingen[0].gonogo === '2027-03-20');
check('waarschuwingtekst noemt fonds en beide data', /Cultuurfonds/.test(waarschuwingTekst(tl.waarschuwingen[0])) && /1 apr/.test(waarschuwingTekst(tl.waarschuwingen[0])) && /20 mrt/.test(waarschuwingTekst(tl.waarschuwingen[0])));
const tl2 = bouwTijdlijn({ project: P, items: [uitslag('Zaanstad', '2027-02-15')], nu: NU });
check('uitslag vóór het go/no-go is op tijd, zonder waarschuwing', tl2.banen[0].punten[0].stijl === 'uitslag-ok' && tl2.waarschuwingen.length === 0);
const tl3 = bouwTijdlijn({ project: { id: 'p1', naam: 'Zonder start' }, items: [uitslag('Zaanstad', '2027-02-15'), contact('Zaanstad', '2026-11-02')], nu: NU });
check('zonder startdatum: geen go/no-go, geen waarschuwing, gewone stijl', tl3.gonogo === '' && tl3.waarschuwingen.length === 0 && tl3.banen[0].punten.every((p) => p.stijl === 'actie'));
check('afgeronde actie krijgt stijl klaar', bouwTijdlijn({ project: P, items: [contact('A', '2026-11-02', { status: 'done' })], nu: NU }).banen[0].punten[0].stijl === 'klaar');
check('een afgeronde actie uit het verleden staat niet op de tijdlijn', bouwTijdlijn({ project: P, items: [contact('A', '2026-10-20', { status: 'done' }), contact('B', '2026-11-02')], nu: NU }).banen.length === 1);
check('acties zonder datum worden geteld, niet getekend', bouwTijdlijn({ project: P, items: [item({ titel: 'Los' }), contact('A', '2026-11-02')], nu: NU }).zonderDatum === 1);
check('het bereik loopt van vandaag tot na de laatste datum', tl.van === '2026-10-26' && tl.tot === plusDagen('2027-06-14', 7), `${tl.van} ${tl.tot}`);
check('positie: begin 0, eind 100, tussenin ertussen', positie(tl, tl.van) === 0 && positie(tl, tl.tot) === 100 && positie(tl, '2027-03-20') > positie(tl, '2026-12-01'));
check('positie buiten het bereik wordt afgekapt', positie(tl, '2020-01-01') === 0 && positie(tl, '2035-01-01') === 100);
gelijk('maanden: de eerste van elke maand binnen het bereik', maandMarkeringen('2026-10-26', '2027-01-10').map((m) => m.label), ['nov', 'dec', 'jan 2027']);

console.log(`\n${ok} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
