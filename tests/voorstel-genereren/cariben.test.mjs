// Cariben en eilanden: een project in het Caribische deel van het Koninkrijk, de koppeling van de vrije locatie aan de werkgebieden in de database,
// de verwante doelgroepen en de kenmerken per voorstelregel. Dezelfde regels voor elk project (geen uitzonderingen op een projectnaam).
import { PID, w, TAXONOMIE, resetGenereren, fonds, projectRij } from './wereld.mjs';
import '../../supabase/functions/subsidie-kompas/index.ts';
import { koppelLocatie } from '../../supabase/functions/_shared/locatie.ts';

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

const genereer = () => post({ mode: 'voorstel-genereren', projectId: PID });
const PREMIUM = { subscription_tier: 'premium', subscription_active: true, trial_ends_at: null, role: 'user' };

// Taxonomie zoals in de echte database (in place aanpassen: de wereld leest deze arrays).
TAXONOMIE.themas.splice(0, TAXONOMIE.themas.length, 'Onderwijs', 'Jeugd en kinderen', 'Muziek', 'Cultuur');
TAXONOMIE.doelgroepen.splice(0, TAXONOMIE.doelgroepen.length, 'Kinderen', 'Jongeren', 'Gezinnen', 'Scholen en onderwijsinstellingen', 'Ouderen');
TAXONOMIE.regios.splice(0, TAXONOMIE.regios.length, 'Caribisch deel van het Koninkrijk', 'Caribisch gebied', 'Afrika', 'Wereld / internationaal', 'Landelijk', 'Zuid-Holland', 'Rotterdam', 'Amsterdam', 'Utrecht', 'Flevoland');

const T = ['Onderwijs', 'Jeugd en kinderen'];
const I = (n) => `00000000-0000-4000-8000-0000000001${String(n).padStart(2, '0')}`;
const FONDSEN = () => [
  fonds({ naam: 'Caribisch Kinderfonds', themas: T, doelgroepen: ['Kinderen'], regios: ['Caribisch deel van het Koninkrijk'], id: I(1) }),
  fonds({ naam: 'Nationaal Onderwijsfonds', themas: T, doelgroepen: ['Kinderen'], regios: ['Landelijk'], id: I(2) }),
  fonds({ naam: 'Stichting Zuid-Hollandse Scholen', themas: T, doelgroepen: ['Kinderen'], regios: ['Zuid-Holland'], id: I(3) }),
  fonds({ naam: 'Wereldwijd Educatiefonds', themas: T, doelgroepen: ['Kinderen'], regios: ['Wereld / internationaal'], id: I(4) }),
  fonds({ naam: 'Afrika Onderwijsfonds', themas: T, doelgroepen: ['Kinderen'], regios: ['Afrika'], id: I(5) }),
  fonds({ naam: 'Stichting Aruba Kinderen', themas: T, doelgroepen: ['Kinderen'], regios: ['Caribisch deel van het Koninkrijk'], id: I(6) }),
  fonds({ naam: 'Schoolfonds Cariben', themas: T, doelgroepen: ['Scholen en onderwijsinstellingen'], regios: ['Caribisch gebied'], id: I(7) }),
  fonds({ naam: 'Ouderenfonds Caribisch', themas: T, doelgroepen: ['Ouderen'], regios: ['Caribisch deel van het Koninkrijk'], id: I(8) }),
  fonds({ naam: 'Stichting Bonaire Jeugd', themas: T, doelgroepen: ['Kinderen'], regios: ['Caribisch deel van het Koninkrijk'], id: I(9) }),
];
// Een groot gat: elk fonds draagt maar een klein deel (de bedragen zijn niet het onderwerp van deze test), zodat alle passende fondsen in het voorstel komen.
const zonderLocatie = { budget_total: 3000000, own_contribution: 0 };

async function draai(location, extra = {}) {
  resetGenereren({ funders: FONDSEN(), profile: PREMIUM, project: projectRij({ name: 'Project X', location, themes: 'Onderwijs, Jeugd en kinderen', target_groups: 'Kinderen', description: 'Kinderen helpen met naar school gaan.', ...zonderLocatie, ...extra }) });
  const r = await genereer();
  const regels = [...(r.json?.voorstel?.regels || [])];

  return { r, regels, namen: regels.map((x) => x.naam), per: (n) => regels.find((x) => x.naam === n) };
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('1. Locatie -> werkgebieden (zuiver)');
{
  const regios = TAXONOMIE.regios;
  const k = (t) => koppelLocatie(t, regios);

  check('"Cariben" is vaag: beide Caribische werkgebieden, eiland onbekend', k('Cariben').vaag === true && k('Cariben').regios.includes('Caribisch gebied') && k('Cariben').regios.includes('Caribisch deel van het Koninkrijk') && k('Cariben').eilanden.length === 0);
  check('"Curaçao" -> Caribisch deel van het Koninkrijk + eiland, niet vaag', k('Curaçao').regios.join() === 'Caribisch deel van het Koninkrijk' && k('Curaçao').eilanden.join() === 'Curaçao' && k('Curaçao').vaag === false);
  check('"Sint Maarten en Saba" -> twee eilanden', k('Sint Maarten en Saba').eilanden.join() === 'Sint Maarten,Saba');
  check('"Caribisch Nederland" -> de drie openbare lichamen, niet Aruba/Curaçao/Sint Maarten', k('Caribisch Nederland').eilanden.join() === 'Bonaire,Sint Eustatius,Saba');
  check('"Utrecht en Flevoland" -> beide provincies/plaatsen', k('Utrecht en Flevoland').regios.sort().join() === 'Flevoland,Utrecht');
  check('"Nederland" of "Landelijk" wordt nooit een Caribisch werkgebied', !k('Landelijk').regios.some((r) => /carib/i.test(r)));
  check('onbekende plaats blijft onbekend (geen verzinsel)', k('Atlantis').regios.length === 0 && k('Atlantis').nietGekoppeld.length > 0);
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('2. Project "Cariben" (eiland onbekend): voorzichtig, niets verzinnen');
{
  const { r, namen, per } = await draai('Cariben');

  check('het voorstel wordt gemaakt', r.status === 200 && r.json.ok === true, r.tekst.slice(0, 200));
  check('Caribisch werkgebied + doelgroep Kinderen: aantoonbaar passend', namen.includes('Caribisch Kinderfonds') && per('Caribisch Kinderfonds')?.kenmerken?.passendheid === 'aantoonbaar', JSON.stringify(namen));
  check('landelijk fonds: mogelijk passend, met controlepunt over de eilanden', namen.includes('Nationaal Onderwijsfonds') && per('Nationaal Onderwijsfonds').kenmerken.passendheid === 'mogelijk' && per('Nationaal Onderwijsfonds').kenmerken.controleren.some((c) => /Caribisch/.test(c)), JSON.stringify(per('Nationaal Onderwijsfonds')?.kenmerken));
  check('wereldwijd fonds: mogelijk passend (controleren), niet uitgesloten', namen.includes('Wereldwijd Educatiefonds') && per('Wereldwijd Educatiefonds').kenmerken.passendheid === 'mogelijk');
  check('fonds voor Zuid-Holland valt af', !namen.includes('Stichting Zuid-Hollandse Scholen'));
  check('fonds voor Afrika valt af', !namen.includes('Afrika Onderwijsfonds'));
  check('fonds voor Aruba: mogelijk passend; het eiland van het project moet nog worden vastgelegd', namen.includes('Stichting Aruba Kinderen') && per('Stichting Aruba Kinderen').kenmerken.passendheid === 'mogelijk' && per('Stichting Aruba Kinderen').kenmerken.controleren.some((c) => /Aruba/.test(c)), JSON.stringify(per('Stichting Aruba Kinderen')?.kenmerken));
  check('verwante doelgroep (scholen bij kinderen) valt niet af, maar staat als te controleren', namen.includes('Schoolfonds Cariben') && per('Schoolfonds Cariben').kenmerken.controleren.some((c) => /indirect/.test(c)), JSON.stringify(per('Schoolfonds Cariben')?.kenmerken));
  check('fonds voor ouderen valt af (doelgroep sluit nergens aan)', !namen.includes('Ouderenfonds Caribisch'));
  check('de vaagheid van de locatie staat in de aannames', (r.json.voorstel?.aannames || []).some((a) => /welk eiland|eiland of in welk land/.test(a)), JSON.stringify(r.json.voorstel?.aannames));
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('3. Project op Bonaire: fondsen van een ander eiland vallen af');
{
  const { namen, per } = await draai('Bonaire');

  check('fonds voor Bonaire past aantoonbaar', namen.includes('Stichting Bonaire Jeugd') && per('Stichting Bonaire Jeugd').kenmerken.passendheid === 'aantoonbaar', JSON.stringify(namen));
  check('fonds voor Aruba valt af', !namen.includes('Stichting Aruba Kinderen'));
  check('Caribisch-breed fonds past nog steeds', namen.includes('Caribisch Kinderfonds'));
}

sectie('4. Project in Rotterdam: Caribische fondsen vallen af, landelijke blijven');
{
  const { namen } = await draai('Rotterdam');

  check('Caribisch fonds valt af voor een project in Rotterdam', !namen.includes('Caribisch Kinderfonds') && !namen.includes('Stichting Bonaire Jeugd') && !namen.includes('Stichting Aruba Kinderen'), JSON.stringify(namen));
  check('landelijk fonds blijft', namen.includes('Nationaal Onderwijsfonds'));
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('5. Kenmerken per regel: uit de database, "nog niet bekend" blijft leeg');
{
  const { per } = await draai('Cariben');
  const k = per('Caribisch Kinderfonds')?.kenmerken;

  check('doelgroepen, disciplines en werkgebieden komen uit de database', Array.isArray(k?.doelgroepen) && k.doelgroepen.join() === 'Kinderen' && k.disciplines.join() === 'Onderwijs,Jeugd en kinderen' && k.werkgebieden.join() === 'Caribisch deel van het Koninkrijk', JSON.stringify(k));
  check('bandbreedte uit de database, officiële link is https', /2\.000|2000/.test(k?.bandbreedte || '') && /^https:\/\//.test(k?.website || ''), JSON.stringify(k));
  check('beschrijving ontbreekt niet stilzwijgend: gevuld uit de missie', typeof k?.beschrijving === 'string' && k.beschrijving.length > 0, JSON.stringify(k));
}

console.log(`\ncariben: ${stand.ok} OK, ${stand.fout} FOUT`);
process.exit(stand.fout ? 1 : 0);
