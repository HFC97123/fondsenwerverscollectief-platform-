// Breder actieplan (ook zonder bekende deadline), online suggesties met beoordelingsroute en fundingId voor "Bespreek met Subsidiekompas".
//   node tests/voorstel-genereren/run.mjs
import { PID, w, resetGenereren, regeling, fonds } from './wereld.mjs';
import '../../supabase/functions/subsidie-kompas/index.ts';
import { readFileSync } from 'node:fs';

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
const MAGER = '<html><head><title>x</title></head><body><h1>Rotterdams Muziekfonds</h1><p>Welkom bij ons fonds.</p></body></html>';
const vandaag = new Date().toISOString().slice(0, 10);

const pool = (extra = []) => ({
  regelingen: [
    regeling({ naam: 'Rotterdams Muziekfonds', gever: 'Gemeente Rotterdam', min: 5000, max: 60000, id: A1 }),
    regeling({ naam: 'Landelijk Muziekpodium', gever: 'Landelijk Podium', min: 1000, max: 25000, regios: ['Landelijk'], id: A3, deadline: null }),
    ...extra,
  ],
  funders: [fonds({ naam: 'Fonds Voorbeeld', min: 1000, max: 15000, id: id(0xf1) })],
  dns: { [`www.${H1}`]: ['93.184.216.34'], 'www.landelijkmuziekpodium.example.nl': ['93.184.216.34'] },
  paginas: { [U1]: GOED },
});
const wereld = (extra = {}) => resetGenereren({ ...pool(), dbActief: true, ...extra });
const opslaan = (regels, extra = {}) => post({ mode: 'voorstel-opslaan', projectId: PID, regels, ...extra });
const r = (type, rid, bedrag) => ({ type, id: rid, bedrag });
const fundingVan = (schemeId) => w.db.funding.find((f) => f.scheme_id === schemeId);
const takenVan = (f) => w.db.actions.filter((t) => t.funding_id === f.id);

// ---------------------------------------------------------------------------------------------------------------------------
sectie('1. Regel zonder bekende deadline: concrete eigen stappen, geen verzonnen externe deadline');
{
  wereld();
  const uit = await opslaan([r('regeling', A3, 10000)]);
  const f = fundingVan(A3);
  const t = takenVan(f);
  const alle = w.db.actions;

  check('opgeslagen en actieplan klaar', uit.status === 200 && uit.json.actieplan.status === 'klaar' && t.length >= 5 && alle.length === t.length + 1, JSON.stringify(uit.json?.actieplan));
  check('meer dan alleen een verificatietaak: voorwaarden, contact, stukken, planning', ['verifiëren', 'Voorwaarden', 'Contact opnemen', 'Projectstukken', 'Aanvraagplanning'].every((k) => alle.some((x) => x.title.includes(k))), alle.map((x) => x.title).join(' | '));
  check('elke stap heeft een datum vanaf vandaag en is een eigen streefdatum', alle.every((x) => x.due_date && x.due_date >= vandaag && /Eigen streefdatum/.test(x.notes || '')));
  check('geen enkele stap doet alsof er een deadline van de financier is', t.every((x) => !/deadline van de financier is/i.test(x.notes || '')));
  check('stappen zijn gekoppeld aan de regel', t.every((x) => x.funding_id === f.id));
  check('bron niet gecontroleerd: stap "bron zelf controleren"', t.some((x) => /Bron van .* zelf controleren/.test(x.title)));
  const retry = await opslaan([r('regeling', A3, 10000)], { alleenActies: true });
  check('opnieuw proberen: dezelfde titels, geen dubbelen', retry.json.actieplan.aangemaakt === 0 && w.db.actions.length === alle.length);
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('2. Regel zonder grenzen en zonder bedrag: eigen stappen voor wat ontbreekt');
{
  const zonderGrenzen = regeling({ naam: 'Grenzeloos Fonds', gever: 'Grenzeloos', min: null, max: null, id: id(0xa4), deadline: null });
  wereld({ ...pool([zonderGrenzen]) });
  await opslaan([r('regeling', id(0xa4), null)]);
  const t = takenVan(fundingVan(id(0xa4)) || {});
  check('grenzen onbekend: stap "Bijdragegrenzen navragen"', t.some((x) => /Bijdragegrenzen van Grenzeloos Fonds navragen/.test(x.title)), t.map((x) => x.title).join(' | '));
  check('geen bedrag gekozen: stap "Aan te vragen bedrag bepalen"', t.some((x) => /bedrag bij Grenzeloos Fonds bepalen/.test(x.title)));
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('3. Regel met geverifieerde deadline blijft terugplannen; veel regels verliezen geen stappen');
{
  wereld();
  await opslaan([r('regeling', A1, 30000)]);
  const t = takenVan(fundingVan(A1));
  check('geverifieerde deadline: alle datums voor of op de deadline', t.length >= 4 && t.every((x) => x.due_date <= '2026-12-15'));

  const veel = Array.from({ length: 8 }, (_, i) => regeling({ naam: `Regeling ${i + 1}`, gever: `Gever ${i + 1}`, min: 1000, max: 20000, id: id(0x100 + i), deadline: i % 2 ? null : '2026-12-15' }));
  wereld({ ...pool(veel) });
  const uit = await opslaan(veel.map((x) => r('regeling', x.regeling_id, 5000)));
  const per = veel.map((x) => takenVan(fundingVan(x.regeling_id) || {}).length);
  check('8 regels (het maximum) opgeslagen, elke regel heeft zijn eigen stappen (geen verlies door het maximum)', uit.status === 200 && w.db.funding.length === 8 && per.every((n) => n >= 4), JSON.stringify(per));
  check('actieplan klaar met het werkelijke aantal', uit.json.actieplan.status === 'klaar' && uit.json.actieplan.aangemaakt === w.db.actions.length);
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('4. Online suggestie: bruikbare beoordelingsroute, onzekere status behouden, fundingId voor het gesprek');
{
  wereld();
  const sug = [{ gever: 'Online Fonds BV', naam: 'Kleine Regeling', url: 'https://www.online.example.nl/aanvragen' }, { gever: 'Tweede Online Stichting', naam: '' }];
  const uit = await opslaan([r('regeling', A1, 20000)], { suggesties: sug });
  const op = w.db.funding.filter((f) => f.financier_naam);
  const taken = (f) => takenVan(f);

  check('suggesties opgeslagen als Interessant, zonder bedrag, "nog niet gecontroleerd"', op.length === 2 && op.every((f) => f.status === 'interesting' && f.requested_amount === null && /nog niet gecontroleerd/.test(f.notes)));
  check('elke suggestie krijgt 3 stappen: beoordelen, voorwaarden nagaan, beslissen', op.every((f) => taken(f).length === 3) && taken(op[0]).some((x) => /beoordelen/.test(x.title)) && taken(op[0]).some((x) => /Voorwaarden, deadline en bijdrage/.test(x.title)) && taken(op[0]).some((x) => /Beslissen of/.test(x.title)));
  check('stappen noemen de financier en de bron, geen deadline of bedrag verzonnen', taken(op[0]).every((x) => x.title.includes('Online Fonds BV - Kleine Regeling') && /Eigen streefdatum/.test(x.notes || '')) && /online\.example\.nl/.test(taken(op[0])[0].notes));
  check('datums zijn eigen streefdata vanaf vandaag', op.every((f) => taken(f).every((x) => x.due_date >= vandaag)));
  check('antwoord bevat fundingId voor regels en suggesties (voor Bespreek met Subsidiekompas)', uit.json.regels.every((x) => /^[0-9a-f-]{36}$/.test(x.fundingId || '')) && uit.json.suggesties.every((x) => /^[0-9a-f-]{36}$/.test(x.fundingId || '')), JSON.stringify(uit.json.suggesties));
  check('fundingId in het antwoord is de echte rij', uit.json.suggesties[0].fundingId === op[0].id && uit.json.regels[0].fundingId === fundingVan(A1).id);
  check('suggestie krijgt nooit een broncontrole-rij of "gecontroleerd"', w.bron.length === 0 && op.every((f) => !/gecontroleerd door/i.test(f.notes)));
}
{
  // Mislukken van de taken voor suggesties: opnieuw proberen met alleen acties levert de stappen zonder dubbele suggestie of dubbele taken.
  wereld({ dbFout: { actions: { code: 'XX000' } } });
  const sug = [{ gever: 'Online Fonds BV', naam: 'Kleine Regeling', url: 'https://www.online.example.nl/aanvragen' }];
  const eerste = await opslaan([r('regeling', A1, 20000)], { suggesties: sug });
  check('taken mislukt: regel en suggestie wel opgeslagen, actieplan mislukt', eerste.json.actieplan.status === 'mislukt' && w.db.funding.length === 2 && w.db.actions.length === 0);
  w.dbFout = null;
  const retry = await opslaan([r('regeling', A1, 20000)], { suggesties: sug, alleenActies: true });
  const n = w.db.actions.length;
  const sugRij = w.db.funding.find((f) => f.financier_naam);
  check('opnieuw alleen acties: stappen voor regel én suggestie, geen nieuwe financieringsrijen', retry.json.actieplan.status === 'klaar' && w.db.funding.length === 2 && takenVan(sugRij).length === 3 && takenVan(fundingVan(A1)).length >= 4);
  const nog = await opslaan([r('regeling', A1, 20000)], { suggesties: sug, alleenActies: true });
  check('nog een keer: niets dubbel', nog.json.actieplan.aangemaakt === 0 && w.db.actions.length === n && w.db.funding.length === 2);
  const zonderSug = await opslaan([r('regeling', A1, 20000)], { alleenActies: true });
  check('alleen acties zonder suggesties meegestuurd: geen suggestietaken verzonnen', zonderSug.status === 200 && w.db.actions.length === n);
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('5. Statische eigenschappen');
{
  const stappen = readFileSync('supabase/functions/_shared/actieplanStappen.ts', 'utf8');
  check('actieplanStappen is zuiver: geen netwerk of database', !/fetch\(|createClient|\.from\(/.test(stappen));
  check('eigen streefdatum wordt nooit als externe deadline gemarkeerd', /externeDeadline: null/.test(stappen) && /datumType: 'streef'/.test(stappen));
}

console.log(`\nVOORSTEL-ACTIEPLAN: ${stand.ok} OK, ${stand.fout} FAIL`);
process.exit(stand.fout ? 1 : 0);
