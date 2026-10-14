// Acties & deadlines van één project: opgeslagen taken en afgeleide acties in één overzicht.
import { bouwActiesEnDeadlines, groepeerActiesEnDeadlines, telOpen, telTeLaat, SOORT, DATUM_SOORT } from '../../src/features/kompas-app/financiering/actiesEnDeadlines.js';
import { actieUitRij } from '../../src/features/kompas-app/financiering/actieplan.js';

let ok = 0; let fail = 0;
const check = (n, c, d = '') => { if (c) { ok += 1; console.log('OK  ', n); } else { fail += 1; console.log('FAIL', n, d); } };
const gelijk = (n, a, b) => check(n, JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} !== ${JSON.stringify(b)}`);

const NU = new Date('2026-10-14T10:00:00');
const P = { id: 'p1', naam: 'Buurtmoestuin', begroting: 80000, gearchiveerd: false };
const regel = (o = {}) => ({ id: 'r1', projectId: 'p1', bronType: 'regeling', bronStatus: 'zichtbaar', naam: 'Regeling A', funder: 'Fonds A', requested: 20000, awarded: null, status: 'interesting', eigenDeadline: null, systeemDeadline: '2026-12-01', deadline: '2026-12-01', ...o });
const taak = (o = {}) => ({ id: 't1', projectId: 'p1', fundingId: null, titel: 'Vooroverleg plannen', financier: '', deadline: '', status: 'todo', prioriteit: 'normal', notitie: '', bron: 'user', ...o });
const bouw = (regels, taken) => bouwActiesEnDeadlines({ project: P, regels, taken, nu: NU });

console.log('== één overzicht');
const alleen = bouw([regel()], []);
check('fondsdeadline zonder opgeslagen taak blijft zichtbaar als afgeleide actie (geen kunstmatige taak)', alleen.some((i) => i.soort === SOORT.AFGELEID && i.regelId === 'r1' && i.datum === '2026-12-01' && i.datumSoort === DATUM_SOORT.EXTERN) && !alleen.some((i) => i.soort === SOORT.TAAK));
const metTaak = bouw([regel()], [taak({ fundingId: 'r1', titel: 'Aanvraag indienen' })]);
check('openstaande taak aan de regel: de afgeleide actie van die regel verdwijnt (zelfde verplichting maar één keer)', !metTaak.some((i) => i.soort === SOORT.AFGELEID && i.regelId === 'r1') && metTaak.some((i) => i.soort === SOORT.TAAK));
const klaarTaak = bouw([regel()], [taak({ fundingId: 'r1', status: 'done' })]);
check('afgeronde taak onderdrukt de afgeleide actie niet', klaarTaak.some((i) => i.soort === SOORT.AFGELEID && i.regelId === 'r1'));
check('taak zonder regel laat afgeleide acties van regels staan', bouw([regel()], [taak()]).some((i) => i.soort === SOORT.AFGELEID && i.regelId === 'r1'));
const gelijkeTitel = bouw([], [taak({ titel: 'Vul de projectbegroting in' })]);
check('projectniveau: taak met dezelfde titel onderdrukt de afgeleide actie niet dubbel', gelijkeTitel.filter((i) => i.titel === 'Vul de projectbegroting in').length <= 1);
check('elk item heeft een soort: taak of afgeleid', [...alleen, ...metTaak].every((i) => i.soort === SOORT.TAAK || i.soort === SOORT.AFGELEID));
check('taken van een ander project komen niet mee', bouw([], [taak({ projectId: 'p2' })]).every((i) => i.soort === SOORT.AFGELEID));

console.log('== datums: streefdatum en fondsdeadline');
const erft = bouw([regel()], [taak({ fundingId: 'r1' })]).find((i) => i.soort === SOORT.TAAK);
gelijk('taak zonder datum erft de effectieve fondsdeadline', [erft.datum, erft.datumSoort, erft.streefdatum, erft.externeDeadline], ['2026-12-01', 'extern', '', '2026-12-01']);
const streef = bouw([regel()], [taak({ fundingId: 'r1', deadline: '2026-11-20' })]).find((i) => i.soort === SOORT.TAAK);
gelijk('ingevulde datum = interne streefdatum; fondsdeadline blijft herkenbaar', [streef.datum, streef.datumSoort, streef.streefdatum, streef.externeDeadline], ['2026-11-20', 'streef', '2026-11-20', '2026-12-01']);
const verschoven = bouw([regel({ deadline: '2027-01-15', systeemDeadline: '2027-01-15' })], [taak({ fundingId: 'r1', deadline: '2026-11-20', bronDeadlineBijVoorstel: '2026-12-01' })]).find((i) => i.soort === SOORT.TAAK);
gelijk('gewijzigde fondsdeadline wordt zichtbaar; de gekozen streefdatum blijft', [verschoven.datum, verschoven.externeDeadlineGewijzigd], ['2026-11-20', { van: '2026-12-01', naar: '2027-01-15' }]);
const erftVerschoven = bouw([regel({ deadline: '2027-01-15' })], [taak({ fundingId: 'r1', bronDeadlineBijVoorstel: '2026-12-01' })]).find((i) => i.soort === SOORT.TAAK);
gelijk('taak zonder streefdatum volgt de nieuwe fondsdeadline vanzelf (geen kopie)', [erftVerschoven.datum, erftVerschoven.externeDeadlineGewijzigd.naar], ['2027-01-15', '2027-01-15']);
const geenWijziging = bouw([regel()], [taak({ fundingId: 'r1', bronDeadlineBijVoorstel: '2026-12-01' })]).find((i) => i.soort === SOORT.TAAK);
check('gelijke fondsdeadline: geen wijzigingsmelding', geenWijziging.externeDeadlineGewijzigd === null);
const zonderRegel = bouw([], [taak({ fundingId: 'weg' })]).find((i) => i.soort === SOORT.TAAK);
gelijk('taak waarvan de regel verdwenen is: geen datum verzonnen', [zonderRegel.datum, zonderRegel.datumSoort], ['', 'geen']);
const verborgen = bouw([regel({ bronStatus: 'verborgen', naam: 'Bron niet beschikbaar in uw abonnement', deadline: null })], [taak({ fundingId: 'r1' })]).find((i) => i.soort === SOORT.TAAK);
check('verborgen bron: gemaskeerde naam, geen brondatum', verborgen.datum === '' && /abonnement/.test(verborgen.regelNaam));

console.log('== groepering en tellers');
const g = groepeerActiesEnDeadlines(
  bouw([regel({ deadline: '2026-10-10', systeemDeadline: '2026-10-10' })], [taak({ id: 'a', deadline: '2026-10-16' }), taak({ id: 'b', deadline: '2026-11-30' }), taak({ id: 'c' }), taak({ id: 'd', status: 'done', deadline: '2026-10-01' })]),
  NU,
);
gelijk('groepen: te-laat bevat de verstreken fondsdeadline, week/maand/zonder/klaar kloppen', [g['te-laat'].some((i) => i.soort === SOORT.AFGELEID), g.week.map((i) => i.taak && i.taak.id), g.later.map((i) => i.taak && i.taak.id), g.zonder.some((i) => i.taak && i.taak.id === 'c'), g.klaar.map((i) => i.taak.id)], [true, ['a'], ['b'], true, ['d']]);
const items = bouw([regel({ deadline: '2026-10-10' })], [taak({ deadline: '2026-10-01' }), taak({ id: 'x', status: 'done', deadline: '2026-09-01' })]);
check('telOpen telt geen afgeronde taken; telTeLaat telt alleen open en verstreken', telOpen(items) === items.filter((i) => i.status !== 'done').length && telTeLaat(items, NU) >= 2);
check('invoer wordt niet gewijzigd', (() => { const r = [regel()]; const t = [taak()]; const a = JSON.stringify([r, t]); bouw(r, t); return a === JSON.stringify([r, t]); })());
check('zonder invoer geen fout', bouwActiesEnDeadlines({}).length === 0);

console.log('== databaserij');
const rij = actieUitRij({ id: 'x', program_id: 'p1', title: 'T', status: 'todo', priority: 'normal', voorstel_sleutel: 'a:r:s:t', bron_deadline_bij_voorstel: '2026-12-01', source: 'chat' });
gelijk('rij met voorstelvelden', [rij.voorstelSleutel, rij.bronDeadlineBijVoorstel, rij.bron], ['a:r:s:t', '2026-12-01', 'chat']);
const oud = actieUitRij({ id: 'x', program_id: 'p1', title: 'T' });
gelijk('rij zonder voorstelvelden (migratie nog niet live) blijft geldig', [oud.voorstelSleutel, oud.bronDeadlineBijVoorstel], [null, '']);

console.log(`\n${ok} geslaagd, ${fail} mislukt`);
process.exit(fail ? 1 : 0);
