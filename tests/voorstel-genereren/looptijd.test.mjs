// Looptijd van het project tegenover de rondes van de financier: de start wordt meegewogen (geen harde eis), een beslissing na het EINDE van het project
// laat de financier buiten de dekking (maar wel zichtbaar als "past inhoudelijk"), onbekend is nooit een uitsluiting. Dezelfde regels voor elk project.
import { PID, w, resetGenereren, regeling, fonds, projectRij } from './wereld.mjs';
import '../../supabase/functions/subsidie-kompas/index.ts';
import { leesProjectdatum as L } from '../../supabase/functions/_shared/voorstelGenereren.ts';

const stand = { ok: 0, fout: 0 };
const check = (naam, waar, detail = '') => { if (waar) stand.ok += 1; else { stand.fout += 1; console.log(`  FAIL: ${naam} ${detail}`); } };
const sectie = (t) => console.log(`\n== ${t}`);

async function post(body) {
  const res = await globalThis.__handler(new Request('http://x/f', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer jwt' }, body: JSON.stringify(body) }));
  const tekst = await res.text();
  let json = null;

  try { json = JSON.parse(tekst); } catch { /* geen json */ }

  return { status: res.status, json, tekst };
}

const PREMIUM = { subscription_tier: 'premium', subscription_active: true, trial_ends_at: null, role: 'user' };
const PRO = { subscription_tier: 'pro', subscription_active: true, trial_ends_at: null, role: 'user' };
const dag = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const nl = (iso) => `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`;
const I = (n) => `00000000-0000-4000-8000-0000000002${String(n).padStart(2, '0')}`;
const START = dag(60);
const EINDE = dag(300);

async function draai({ regelingen = [], funders = [], profile = PREMIUM, project = {}, vergaderingen = [] } = {}) {
  resetGenereren({ profile, regelingen, funders, project: projectRij({ period_start: START, period_end: EINDE, budget_total: 3000000, own_contribution: 0, ...project }) });
  w.planning.funders = vergaderingen.filter((v) => v.soort === 'funder').map((v) => ({ id: v.id, volgende_vergaderdatum: v.datum }));
  w.planning.regelingen = vergaderingen.filter((v) => v.soort === 'regeling').map((v) => ({ id: v.id, volgende_vergaderdatum: v.datum }));
  const r = await post({ mode: 'voorstel-genereren', projectId: PID });
  const regels = [...(r.json?.voorstel?.regels || [])];

  return { r, regels, namen: regels.map((x) => x.naam), per: (n) => regels.find((x) => x.naam === n), na: r.json?.naAfloop || [] };
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('1. Regelingen: voor de start, tijdens de looptijd, na het einde');
{
  const { r, namen, per, na } = await draai({
    regelingen: [
      regeling({ naam: 'Regeling Vroeg', gever: 'Gever Vroeg', deadline: dag(30), id: I(1) }),
      regeling({ naam: 'Regeling Tijdens', gever: 'Gever Tijdens', deadline: dag(120), id: I(2) }),
      regeling({ naam: 'Regeling Te Laat', gever: 'Gever Te Laat', deadline: dag(400), id: I(3) }),
    ],
  });

  check('het voorstel wordt gemaakt', r.status === 200 && r.json.ok === true, r.tekst.slice(0, 200));
  check('deadline vóór de start: in de dekking', namen.includes('Regeling Vroeg'), JSON.stringify(namen));
  check('deadline tijdens de looptijd: geen harde eis, telt gewoon mee', namen.includes('Regeling Tijdens'), JSON.stringify(namen));
  check('tijdens de looptijd: aantekening dat de beslissing na de start valt', per('Regeling Tijdens')?.kenmerken?.controleren?.some((c) => /na de start van het project/.test(c)), JSON.stringify(per('Regeling Tijdens')?.kenmerken));
  check('vóór de start: geen looptijdaantekening', !(per('Regeling Vroeg')?.kenmerken?.controleren || []).some((c) => /start van het project|looptijd/.test(c)), JSON.stringify(per('Regeling Vroeg')?.kenmerken));
  check('deadline na het einde: NIET in de dekking', !namen.includes('Regeling Te Laat'), JSON.stringify(namen));
  check('deadline na het einde: wel apart getoond als passend', na.length === 1 && na[0].naam === 'Regeling Te Laat', JSON.stringify(na));
  check('de uitleg gebruikt de afgesproken woorden', /doet niet meer mee in de dekking, maar zou eventueel wel passend zijn geweest/.test(na[0]?.uitleg || '') && /past inhoudelijk, maar doordat het project dan al afgelopen is/.test(na[0]?.uitleg || '') && /komt u niet in aanmerking/.test(na[0]?.uitleg || ''), na[0]?.uitleg);
  check('de uitleg noemt deadline en einde van het project', (na[0]?.uitleg || '').includes(nl(dag(400))) && (na[0]?.uitleg || '').includes(nl(EINDE)), na[0]?.uitleg);
  check('na afloop heeft datums en soort', na[0]?.moment === dag(400) && na[0]?.momentSoort === 'deadline' && na[0]?.projectEinde === EINDE);
  check('na afloop heeft kenmerken uit de database (geen verzinsel)', !!na[0]?.kenmerken && Array.isArray(na[0].kenmerken.doelgroepen), JSON.stringify(na[0]?.kenmerken));
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('2. Fondsen: onbekend is nooit een uitsluiting; de bestuursvergadering telt niet, alleen de deadline om in te dienen');
{
  const { namen, per, na } = await draai({
    funders: [
      fonds({ naam: 'Fonds Zonder Ronde', id: I(11) }),
      fonds({ naam: 'Fonds Vergadert Na Einde', id: I(12) }),
    ],
    vergaderingen: [{ soort: 'funder', id: I(12), datum: dag(500) }],
  });

  check('fonds zonder bekende deadline doet gewoon mee', namen.includes('Fonds Zonder Ronde'), JSON.stringify(namen));
  check('... met de aantekening de volgende ronde na te vragen', per('Fonds Zonder Ronde')?.kenmerken?.controleren?.some((c) => /geen aankomende deadline/.test(c) && /vraag na wanneer/.test(c)), JSON.stringify(per('Fonds Zonder Ronde')?.kenmerken));
  check('een bestuursvergadering na het einde sluit niet uit (daar valt alleen het besluit, indienen kan eerder)', namen.includes('Fonds Vergadert Na Einde') && na.length === 0, JSON.stringify({ namen, na }));
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('3. Een regeling met deadline binnen de looptijd en vergadering na het einde telt gewoon mee');
{
  const { namen, na } = await draai({
    regelingen: [regeling({ naam: 'Regeling Deadline Goed Vergadering Laat', gever: 'Gever X', deadline: dag(100), id: I(21) })],
    vergaderingen: [{ soort: 'regeling', id: I(21), datum: dag(450) }],
  });

  check('deadline binnen de looptijd: in de dekking, ook als het besluit later valt', namen.includes('Regeling Deadline Goed Vergadering Laat') && na.length === 0, JSON.stringify({ namen, na }));
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('4. Zonder looptijd bij het project wordt er niet getoetst');
{
  const { namen, per, na } = await draai({
    project: { period_start: null, period_end: null },
    regelingen: [regeling({ naam: 'Regeling Te Laat', gever: 'Gever Te Laat', deadline: dag(400), id: I(31) })],
    funders: [fonds({ naam: 'Fonds Zonder Ronde', id: I(32) })],
  });

  check('geen looptijd: ook een late deadline doet mee', namen.includes('Regeling Te Laat') && na.length === 0, JSON.stringify({ namen, na }));
  check('geen looptijd: geen looptijdaantekening bij fonds zonder ronde', !(per('Fonds Zonder Ronde')?.kenmerken?.controleren || []).some((c) => /aankomende ronde/.test(c)));
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('5. Alleen einddatum: nog steeds uitsluiting in de dekking na het einde');
{
  const { namen, na } = await draai({
    project: { period_start: null, period_end: EINDE },
    regelingen: [regeling({ naam: 'Regeling Binnen', gever: 'Gever Binnen', deadline: dag(100), id: I(41) }), regeling({ naam: 'Regeling Buiten', gever: 'Gever Buiten', deadline: dag(400), id: I(42) })],
  });

  check('binnen het einde: mee; na het einde: buiten de dekking', namen.includes('Regeling Binnen') && !namen.includes('Regeling Buiten') && na.some((x) => x.naam === 'Regeling Buiten'), JSON.stringify({ namen, na }));
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('6. Rechten: wat het lid niet mag zien komt niet in de lijst');
{
  const { namen, na } = await draai({
    profile: PRO,
    regelingen: [regeling({ naam: 'Premium Regeling Te Laat', tier: 'premium', gever: 'Gever P', deadline: dag(400), id: I(51) }), regeling({ naam: 'Pro Regeling Te Laat', tier: 'pro', gever: 'Gever Q', deadline: dag(400), id: I(52) })],
  });

  check('Pro ziet een regeling die alleen Premium mag zien niet in de lijst na afloop', !na.some((x) => x.naam === 'Premium Regeling Te Laat'), JSON.stringify(na));
  check('Pro ziet wel de eigen regeling in de lijst na afloop', na.some((x) => x.naam === 'Pro Regeling Te Laat'), JSON.stringify({ namen, na }));
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('7. Een gesloten regeling zonder nieuwe ronde blijft gesloten (regelingen verlopen)');
{
  const { namen, na } = await draai({
    regelingen: [regeling({ naam: 'Regeling Voorbij', gever: 'Gever Voorbij', deadline: dag(-20), extra: { status: 'gesloten' }, id: I(61) })],
  });

  check('verstreken regeling doet niet mee en staat niet als "passend na afloop"', !namen.includes('Regeling Voorbij') && !na.some((x) => x.naam === 'Regeling Voorbij'), JSON.stringify({ namen, na }));
}

sectie('8. Looptijd als vrije tekst (zoals bij oudere projecten)');
{
  check('ISO-datum blijft ISO', L('2027-01-01') === '2027-01-01' && L('2027-01-01T00:00:00Z') === '2027-01-01');
  check('"1 januari 2027" en "31 december 2027 " (met spatie)', L('1 januari 2027') === '2027-01-01' && L('31 december 2027 ', true) === '2027-12-31');
  check('dd-mm-jjjj en dd/mm/jjjj', L('01-08-2027') === '2027-08-01' && L('31/12/2027', true) === '2027-12-31');
  check('maand + jaar: start = eerste dag, einde = laatste dag', L('augustus 2027') === '2027-08-01' && L('februari 2028', true) === '2028-02-29' && L('mei 2028', true) === '2028-05-31');
  check('alleen jaartal: start = 1 januari, einde = 31 december', L('2027') === '2027-01-01' && L('2027', true) === '2027-12-31');
  check('korte maand', L('1 jan 2027') === '2027-01-01' && L('sep 2027', true) === '2027-09-30');
  check('onleesbaar of onmogelijk blijft null (geen verzinsel)', L('binnenkort') === null && L('') === null && L(null) === null && L('31 februari 2027') === null && L('1 januari') === null && L('2027-13-01') === null);

  const { r, namen, na } = await draai({
    project: { period_start: '1 januari 2027', period_end: '31 december 2027 ' },
    regelingen: [regeling({ naam: 'Regeling Binnen', gever: 'Gever Binnen', deadline: '2026-12-20', id: I(71) }), regeling({ naam: 'Regeling 2028', gever: 'Gever 2028', deadline: '2028-02-01', id: I(72) })],
  });

  check('vrije tekst als looptijd wordt gelezen en getoetst', namen.includes('Regeling Binnen') && !namen.includes('Regeling 2028') && na.some((x) => x.naam === 'Regeling 2028' && x.projectEinde === '2027-12-31'), JSON.stringify({ namen, na }));

  const { r: r2, namen: namen2, na: na2 } = await draai({
    project: { period_start: 'binnenkort', period_end: null },
    regelingen: [regeling({ naam: 'Regeling 2028', gever: 'Gever 2028', deadline: '2028-02-01', id: I(73) })],
  });

  check('onleesbare startdatum: niet getoetst en gemeld bij de aannames', namen2.includes('Regeling 2028') && na2.length === 0 && (r2.json?.voorstel?.aannames || []).some((a) => /startdatum/.test(a) && /niet als datum te lezen/.test(a)), JSON.stringify(r2.json?.voorstel?.aannames));
  check('geen looptijd ingevuld: aanname dat er niet is getoetst', await (async () => { const x = await draai({ project: { period_start: null, period_end: null }, regelingen: [regeling({ naam: 'R', gever: 'G', id: I(74) })] }); return (x.r.json?.voorstel?.aannames || []).some((a) => /looptijd van het project is niet ingevuld/.test(a)); })());
}

console.log(`\nlooptijd: ${stand.ok} OK, ${stand.fout} FOUT`);
process.exit(stand.fout ? 1 : 0);
