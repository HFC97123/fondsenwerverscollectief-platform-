// Het actieplan is bestand tegen gelijktijdige verzoeken (databasegarantie) en blijft herstelbaar na verversen (wachtrij die de server bewaart).
//   node tests/voorstel-genereren/run.mjs
import { PID, w, resetGenereren, regeling } from './wereld.mjs';
import '../../supabase/functions/subsidie-kompas/index.ts';

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

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const A1 = id(0xa1);
const A3 = id(0xa3);
const H1 = 'rotterdamsmuziekfonds.example.nl';
const U1 = `https://www.${H1}/aanvragen`;
const GOED = '<html><head><title>x</title></head><body><h1>Rotterdams Muziekfonds</h1><p>Aanvragen kan tot 15 december 2026.</p><p>Maximaal € 60.000 per aanvraag.</p><p>Minimaal € 5.000 per project.</p></body></html>';
const pool = () => ({
  regelingen: [
    regeling({ naam: 'Rotterdams Muziekfonds', gever: 'Gemeente Rotterdam', min: 5000, max: 60000, id: A1 }),
    regeling({ naam: 'Landelijk Muziekpodium', gever: 'Landelijk Podium', min: 1000, max: 25000, regios: ['Landelijk'], id: A3, deadline: null }),
  ],
  funders: [],
  dns: { [`www.${H1}`]: ['93.184.216.34'], 'www.landelijkmuziekpodium.example.nl': ['93.184.216.34'] },
  paginas: { [U1]: GOED },
});
const wereld = (extra = {}) => resetGenereren({ ...pool(), dbActief: true, ...extra });
const opslaan = (regels, extra = {}) => post({ mode: 'voorstel-opslaan', projectId: PID, regels, ...extra });
const herstel = () => post({ mode: 'voorstel-actieplan-herstel', projectId: PID });
const r = (type, rid, bedrag) => ({ type, id: rid, bedrag });
const titels = () => w.db.actions.map((a) => `${a.funding_id}|${a.title.toLowerCase()}`);
const uniek = (lijst) => new Set(lijst).size === lijst.length;

// ---------------------------------------------------------------------------------------------------------------------------
sectie('1. Gelijktijdige verzoeken: de database laat nooit twee dezelfde taken toe');
{
  wereld({ leesVertraging: true });
  await opslaan([r('regeling', A3, 10000)]);
  const n = w.db.actions.length;
  const sleutels = w.db.actions.map((a) => a.voorstel_sleutel);

  check('elke taak krijgt een sleutel (regel + titel)', n >= 5 && sleutels.every((s) => typeof s === 'string' && s.includes('|')), JSON.stringify(sleutels.slice(0, 2)));

  // Alle taken weghalen en dan 6 gelijktijdige verzoeken: alle zes lezen "leeg" vóór er iemand schrijft; de database moet het afvangen.
  w.db.actions.length = 0;
  w.dbSchrijfLog.length = 0;
  const uit = await Promise.all(Array.from({ length: 6 }, () => opslaan([r('regeling', A3, 10000)], { alleenActies: true })));
  const aangemaakt = uit.reduce((s, x) => s + x.json.actieplan.aangemaakt, 0);
  const bestond = uit.reduce((s, x) => s + x.json.actieplan.bestond, 0);

  check('6 gelijktijdige verzoeken: precies één set taken', w.db.actions.length === n && uniek(titels()), `${w.db.actions.length} van ${n}`);
  check('alle zes lazen een lege lijst en probeerden te schrijven (echte race)', w.dbSchrijfLog.filter((l) => l.tabel === 'subsidie_kompas_program_actions').length === 6);
  check('het totaal aangemaakt klopt met de database, de rest meldt "bestond al"', aangemaakt === n && bestond === 5 * n && uit.every((x) => x.json.actieplan.status === 'klaar'), `aangemaakt ${aangemaakt}, bestond ${bestond}`);
  check('geen enkel verzoek faalt door de race', uit.every((x) => x.status === 200 && x.json.actieplan.mislukt === 0 && x.json.actieplan.atomair === true));
  check('wachtrij blijft leeg', w.wachtrij.length === 0);
}
{
  // Een taak die het lid zelf wijzigde (andere titel) wordt niet opnieuw aangemaakt zolang de sleutel bestaat; een zelf toegevoegde taak heeft geen sleutel.
  wereld();
  await opslaan([r('regeling', A3, 10000)]);
  const n = w.db.actions.length;
  w.db.actions[1].title = 'Mijn eigen titel';
  const weer = await opslaan([r('regeling', A3, 10000)], { alleenActies: true });

  check('hernoemde taak komt niet terug (sleutel blijft staan, geen duplicaat)', weer.json.actieplan.aangemaakt === 0 && w.db.actions.length === n, JSON.stringify(weer.json.actieplan));
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('2. Mislukt het actieplan, dan bewaart de server de open taken (blijft na verversen beschikbaar)');
{
  wereld({ dbFout: { actions: { code: 'XX000' } } });
  const eerste = await opslaan([r('regeling', A3, 10000)]);

  check('dekkingsplanregel wel opgeslagen, actieplan mislukt', eerste.status === 200 && w.db.funding.length === 1 && eerste.json.actieplan.status === 'mislukt' && w.db.actions.length === 0);
  check('open taken bewaard door de server (service-client) met de regel erbij', w.wachtrij.length === eerste.json.actieplan.mislukt && w.wachtrij.length >= 5 && w.wachtrij.every((x) => (x.funding_id === w.db.funding[0].id || x.funding_id === null) && x.user_id === w.user.id && x.program_id === PID && x.sleutel.includes('|')));
  check('antwoord meldt dat het bewaard is', eerste.json.actieplan.bewaard === true);

  // "Verversen": alle schermstatus is weg; alleen het project-id gaat naar de server.
  w.dbFout = null;
  const logVoor = w.dbSchrijfLog.length;
  const na = await herstel();

  check('herstel na verversen: server maakt alle open taken aan', na.status === 200 && na.json.ok && na.json.actieplan.status === 'klaar' && na.json.actieplan.aangemaakt === eerste.json.actieplan.mislukt && w.db.actions.length === eerste.json.actieplan.mislukt, JSON.stringify(na.json));
  check('taken zijn gekoppeld aan de regel (het projectstuk-item aan het project), status todo, bron chat, met sleutel', w.db.actions.every((a) => (a.funding_id === w.db.funding[0].id || a.funding_id === null) && a.status === 'todo' && a.source === 'chat' && a.voorstel_sleutel));
  check('wachtrij is leeg na herstel; niets dubbel', w.wachtrij.length === 0 && uniek(titels()) && na.json.openstaand === 0);
  check('herstel schrijft alleen taken (geen nieuwe dekkingsplanregels)', w.db.funding.length === 1 && w.dbSchrijfLog.slice(logVoor).every((l) => l.tabel === 'subsidie_kompas_program_actions'));

  const nogEens = await herstel();
  check('nog een keer herstel: niets te doen, niets dubbel', nogEens.status === 200 && nogEens.json.actieplan.status === 'geen' && w.db.actions.length === eerste.json.actieplan.mislukt);
}
{
  // Deels geslaagd: de rest staat in de wachtrij, de geslaagde taken niet.
  wereld();
  await opslaan([r('regeling', A3, 10000)]);
  const n = w.db.actions.length;
  w.db.actions.length = 0;
  w.db.actions.push(...[]); // alles weg
  w.dbFout = { actions: { code: 'XX000' } };
  const stuk = await opslaan([r('regeling', A3, 10000)], { alleenActies: true });

  check('alleen-acties mislukt: wachtrij gevuld met alle ontbrekende taken', stuk.json.actieplan.status === 'mislukt' && w.wachtrij.length === n);
  w.dbFout = null;
  // Een deel verschijnt via een ander pad (bijv. tweede tabblad) : herstel meldt die als "bestond".
  const twee = await opslaan([r('regeling', A3, 10000)], { alleenActies: true });
  check('in-sessie opnieuw proberen (met de oude route) ruimt de wachtrij ook op', twee.json.actieplan.status === 'klaar' && w.wachtrij.length === 0 && w.db.actions.length === n);
}
{
  // Het lezen van de bestaande taken mislukt: niets schrijven, alles in de wachtrij.
  wereld();
  await opslaan([r('regeling', A3, 10000)]);
  w.db.actions.length = 0;
  w.dbFout = { actionsLezen: true };
  const uit = await opslaan([r('regeling', A3, 10000)], { alleenActies: true });

  check('lezen mislukt: geen blinde schrijf, taken bewaard voor opnieuw proberen', uit.json.actieplan.status === 'mislukt' && w.db.actions.length === 0 && w.wachtrij.length > 0 && uit.json.actieplan.bewaard === true);
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('3. Herstel is server-bewaakt');
{
  wereld({ dbFout: { actions: { code: 'XX000' } } });
  await opslaan([r('regeling', A3, 10000)]);
  w.dbFout = null;

  const geenId = await post({ mode: 'voorstel-actieplan-herstel' });
  check('zonder geldig project-id: 400', geenId.status === 400);

  const anders = await post({ mode: 'voorstel-actieplan-herstel', projectId: id(0x999) });
  check('ander of onbekend project: 404, niets aangemaakt', anders.status === 404 && w.db.actions.length === 0);

  w.profile.subscription_tier = 'free';
  const free = await herstel();
  check('Free: geen herstel (Pro/Premium-functie)', free.status === 403 && w.db.actions.length === 0);
  w.profile.subscription_tier = 'pro';

  w.env.VOORSTEL_GENEREREN = 'uit';
  const uit = await herstel();
  check('vlag uit: 404 en niets geschreven', uit.status === 404 && w.db.actions.length === 0);
  w.env.VOORSTEL_GENEREREN = 'aan';

  // Een andere gebruiker kan de taken van dit project niet laten aanmaken: de wachtrij is per gebruiker.
  const vreemd = w.wachtrij.map((x) => ({ ...x, user_id: id(0xdead) }));
  const eigen = w.wachtrij;
  w.wachtrij = vreemd;
  const niets = await herstel();
  check('rijen van een andere gebruiker worden niet gebruikt', niets.status === 200 && niets.json.actieplan.status === 'geen' && w.db.actions.length === 0);
  w.wachtrij = eigen;

  const echt = await herstel();
  check('eigen open taken wel', echt.json.actieplan.status === 'klaar' && w.db.actions.length > 0);
}
{
  // Niemand kan via de client taken in de wachtrij zetten: het herstel-bericht neemt geen taken aan.
  wereld();
  const poging = await post({ mode: 'voorstel-actieplan-herstel', projectId: PID, taken: [{ titel: 'Verzonnen taak', fundingId: id(1) }], regels: [{ type: 'fonds', id: id(2) }] });
  check('meegestuurde taken worden genegeerd', poging.status === 200 && w.db.actions.length === 0 && w.wachtrij.length === 0);
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('4. Zonder migratie C: veilige terugval, geen paniek');
{
  wereld({ migratieC: false });
  const uit = await opslaan([r('regeling', A3, 10000)]);
  const n = w.db.actions.length;

  check('opslaan werkt gewoon met de oude route; taken zonder sleutel', uit.status === 200 && uit.json.actieplan.status === 'klaar' && n >= 5 && w.db.actions.every((a) => !('voorstel_sleutel' in a)));
  check('antwoord meldt eerlijk dat er geen databasegarantie is (atomair: false)', uit.json.actieplan.atomair === false);
  const weer = await opslaan([r('regeling', A3, 10000)], { alleenActies: true });
  check('sequentieel opnieuw proberen blijft dubbelen voorkomen (controle in code)', weer.json.actieplan.aangemaakt === 0 && w.db.actions.length === n);
}
{
  // Bewijs dat de race-test tanden heeft: zonder de unieke index kan dezelfde gelijktijdige belasting WEL dubbele taken geven.
  wereld({ migratieC: false, leesVertraging: true });
  await opslaan([r('regeling', A3, 10000)]);
  const n = w.db.actions.length;
  w.db.actions.length = 0;
  await Promise.all(Array.from({ length: 6 }, () => opslaan([r('regeling', A3, 10000)], { alleenActies: true })));

  check('zonder migratie C geeft dezelfde gelijktijdige belasting dubbele taken (reden voor de migratie)', w.db.actions.length > n, `${w.db.actions.length} van ${n}`);
}
{
  wereld({ migratieC: false, dbFout: { actions: { code: 'XX000' } } });
  const uit = await opslaan([r('regeling', A3, 10000)]);

  check('mislukte taken zonder wachtrijtabel: dekkingsplan staat, melding "niet bewaard"', uit.status === 200 && w.db.funding.length === 1 && uit.json.actieplan.status === 'mislukt' && uit.json.actieplan.bewaard === false);
  const h = await herstel();
  check('herstel zonder wachtrijtabel: nette 503, geen crash', h.status === 503 && h.json.ok === false);
}
{
  // Wachtrij kan niet schrijven (tabel er wel): opslaan zelf gaat door.
  wereld({ dbFout: { actions: { code: 'XX000' } }, wachtrijFout: 'schrijven' });
  const uit = await opslaan([r('regeling', A3, 10000)]);

  check('wachtrij schrijven mislukt: opslaan geslaagd, bewaard false', uit.status === 200 && w.db.funding.length === 1 && uit.json.actieplan.bewaard === false);
}

console.log(`\nVOORSTEL-ATOMAIR: ${stand.ok} OK, ${stand.fout} FAIL`);
process.exit(stand.fout ? 1 : 0);
