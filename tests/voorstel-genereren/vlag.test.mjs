// Servervlag met testerslijst: 'aan' = alle Pro/Premium, 'testers' = alleen VOORSTEL_TESTERS, alles anders = uit (404), faalt dicht.
// Echte handler, nagebootste AI en database.
import { PID, UID, w, resetGenereren, regeling, projectRij } from './wereld.mjs';
import '../../supabase/functions/subsidie-kompas/index.ts';

const stand = { ok: 0, fout: 0 };
const check = (naam, waar, detail = '') => { if (waar) stand.ok += 1; else { stand.fout += 1; console.log(`  FAIL: ${naam} ${detail}`); } };
const sectie = (t) => console.log(`\n== ${t}`);
const ANDER = '11111111-2222-4333-8444-555555555555';

async function post(body) {
  const res = await globalThis.__handler(new Request('http://x/f', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer jwt' }, body: JSON.stringify(body) }));
  const tekst = await res.text();
  let json = null;

  try { json = JSON.parse(tekst); } catch { /* geen json */ }

  return { status: res.status, json, tekst };
}

const PRO = { subscription_tier: 'pro', subscription_active: true, trial_ends_at: null, role: 'user' };
const wereld = (env = {}) => {
  resetGenereren({ regelingen: [regeling({ naam: 'Rotterdams Muziekfonds', gever: 'Gemeente Rotterdam', min: 5000, max: 60000, id: '00000000-0000-4000-8000-0000000000a1' })], funders: [], exclusief: [], profile: PRO, dbActief: true });
  Object.assign(w.env, env);
};
const MODI = [
  ['voorstel-zoekprofiel', { projectId: PID }],
  ['voorstel-genereren', { projectId: PID }],
  ['voorstel-aanvullen', { projectId: PID, voorstel: { regels: [] }, getoond: [] }],
  ['voorstel-opslaan', { projectId: PID, regels: [] }],
  ['voorstel-startpunt', { projectId: PID, regels: [] }],
  ['voorstel-actieplan-herstel', { projectId: PID }],
  ['voorstel-actieplan-herplan', { projectId: PID }],
  ['voorstel-controleer', { projectId: PID, type: 'regeling', id: '00000000-0000-4000-8000-0000000000a1' }],
  ['voorstel-preview', { projectId: PID, voorstel: { regels: [] } }],
];
const nietBeschikbaar = (r) => r.status === 404 && /nog niet beschikbaar/i.test(r.tekst);

sectie('1. Vlagwaarden en testerslijst via de handler (faalt dicht)');
const zoek = async (env) => { wereld(env); return post({ mode: 'voorstel-zoekprofiel', projectId: PID }); };
const open_ = (r) => r.status === 200;
const dicht = (r) => nietBeschikbaar(r);
check('aan + geldige gebruiker: open', open_(await zoek({ VOORSTEL_GENEREREN: 'aan' })));
check('testers + gebruiker in lijst: open', open_(await zoek({ VOORSTEL_GENEREREN: 'testers', VOORSTEL_TESTERS: UID })));
check('testers + hoofdletters en spaties in lijst: open', open_(await zoek({ VOORSTEL_GENEREREN: 'testers', VOORSTEL_TESTERS: ` ${UID.toUpperCase()} , ${ANDER}` })));
check('testers + andere gebruiker: dicht', dicht(await zoek({ VOORSTEL_GENEREREN: 'testers', VOORSTEL_TESTERS: ANDER })));
check('testers + lege lijst: dicht', dicht(await zoek({ VOORSTEL_GENEREREN: 'testers', VOORSTEL_TESTERS: '' })));
check('testers + lijst met onzin (iedereen, *, true): dicht', dicht(await zoek({ VOORSTEL_GENEREREN: 'testers', VOORSTEL_TESTERS: 'iedereen,*,true,all' })));
check('testers + lijst met deel van een id: dicht', dicht(await zoek({ VOORSTEL_GENEREREN: 'testers', VOORSTEL_TESTERS: UID.slice(0, 20) })));
check('typefouten in de vlag (Aan, true, 1, "aan "): dicht', (await Promise.all(['Aan', 'AAN', 'true', '1', 'aan ', 'tester'].map((v) => zoek({ VOORSTEL_GENEREREN: v, VOORSTEL_TESTERS: UID })))).every(dicht));
check('lijst zonder vlag-waarde "testers" doet niets: dicht', dicht(await zoek({ VOORSTEL_GENEREREN: undefined, VOORSTEL_TESTERS: UID })));
check('lijst met 60 id\'s: alleen de eerste 25 tellen', dicht(await zoek({ VOORSTEL_GENEREREN: 'testers', VOORSTEL_TESTERS: [...Array.from({ length: 25 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`), UID].join(',') })));

sectie('2. Handler: vlag UIT geeft op alle negen modi 404');
for (const uit of [undefined, '', 'uit', 'ja']) {
  wereld({ VOORSTEL_GENEREREN: uit, VOORSTEL_PREVIEW: uit, VOORSTEL_TESTERS: UID });
  const alles = await Promise.all(MODI.map(([mode, extra]) => post({ mode, ...extra })));
  check(`vlag ${JSON.stringify(uit)}: alle modi 404`, alles.every(nietBeschikbaar), alles.map((r) => r.status).join(','));
}

sectie('3. Handler: vlag "testers" met de testgebruiker in de lijst');
wereld({ VOORSTEL_GENEREREN: 'testers', VOORSTEL_PREVIEW: 'testers', VOORSTEL_TESTERS: `${ANDER},${UID}` });
{
  const alles = await Promise.all(MODI.map(([mode, extra]) => post({ mode, ...extra })));
  check('geen enkele modus geeft nog "niet beschikbaar"', alles.every((r) => !nietBeschikbaar(r)), alles.map((r) => r.status).join(','));
  const profiel = await post({ mode: 'voorstel-zoekprofiel', projectId: PID });
  check('zoekprofiel werkt voor de tester', profiel.status === 200 && profiel.json && profiel.json.profiel, String(profiel.status));
}

sectie('4. Handler: vlag "testers" maar ANDERE gebruiker (bestaand lid) = 404, ook met Pro');
wereld({ VOORSTEL_GENEREREN: 'testers', VOORSTEL_PREVIEW: 'testers', VOORSTEL_TESTERS: ANDER });
{
  const alles = await Promise.all(MODI.map(([mode, extra]) => post({ mode, ...extra })));
  check('alle negen modi 404 voor een lid dat niet in de lijst staat', alles.every(nietBeschikbaar), alles.map((r) => r.status).join(','));
  const geenAiAanroep = w.openaiAantal === 0;
  check('en er is geen AI-aanroep gedaan (geen kosten)', geenAiAanroep, String(w.openaiAantal));
}

sectie('5. Handler: "testers" zonder lijst = niemand; "aan" = iedereen zoals voorheen');
wereld({ VOORSTEL_GENEREREN: 'testers', VOORSTEL_PREVIEW: 'testers' });
{
  const r = await post({ mode: 'voorstel-zoekprofiel', projectId: PID });
  check('zonder VOORSTEL_TESTERS: 404', nietBeschikbaar(r));
}

wereld({ VOORSTEL_GENEREREN: 'aan', VOORSTEL_PREVIEW: 'aan' });
{
  const r = await post({ mode: 'voorstel-zoekprofiel', projectId: PID });
  check('vlag aan: werkt zonder lijst', r.status === 200);
}

sectie('6. Bestaande chat blijft ongemoeid door de vlag');
wereld({ VOORSTEL_GENEREREN: undefined, VOORSTEL_PREVIEW: undefined });
{
  const r = await post({ mode: 'voorstel-zoekprofiel-bestaat-niet', projectId: PID });
  check('onbekende modus raakt de vlag niet (geen 404 "nog niet beschikbaar")', !nietBeschikbaar(r), String(r.status));
}

console.log(`\nvlag: ${stand.ok} OK, ${stand.fout} FOUT`);
process.exit(stand.fout ? 1 : 0);
