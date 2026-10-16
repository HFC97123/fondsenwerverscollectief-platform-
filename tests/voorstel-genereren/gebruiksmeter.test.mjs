// De gebruiksmeter (tabel kompas_gebruik_log, optionele migratie) mag het voorstel nooit raken: ontbrekende tabel, fout of trage database.
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

const A1 = '00000000-0000-4000-8000-0000000000a1';
const H1 = 'rotterdamsmuziekfonds.example.nl';
const U1 = `https://www.${H1}/aanvragen`;
const GOED = '<html><head><title>x</title></head><body><h1>Rotterdams Muziekfonds</h1><p>Aanvragen kan tot 15 december 2026.</p><p>Maximaal € 60.000 per aanvraag.</p><p>Minimaal € 5.000 per project.</p></body></html>';
const wereld = (extra = {}) =>
  resetGenereren({
    regelingen: [regeling({ naam: 'Rotterdams Muziekfonds', gever: 'Gemeente Rotterdam', min: 5000, max: 60000, id: A1 })],
    funders: [],
    dns: { [`www.${H1}`]: ['93.184.216.34'] },
    paginas: { [U1]: GOED },
    dbActief: true,
    ...extra,
  });
const controleer = async () => {
  const t0 = Date.now();
  const res = await post({ mode: 'voorstel-controleer', projectId: PID, type: 'regeling', id: A1 });

  return { ...res, ms: Date.now() - t0 };
};
const kern = (x) => JSON.stringify({ s: x.status, c: x.json?.controle?.status, v: x.json?.controle?.verificatieStatus, b: x.json?.controle?.bewaard });

// Verwachte fouten van de meter staan in de console; leg ze vast om te controleren dat er geen inhoud in zit.
const logs = [];
const origError = console.error;

console.error = (...a) => { logs.push(a.map(String).join(' ')); };

sectie('1. Basis: met de tabel wordt precies één telrij zonder inhoud vastgelegd');
const basis = await (async () => {
  wereld();
  const x = await controleer();

  check('controle werkt', x.status === 200 && x.json.controle.status === 'gecontroleerd');
  check('één rij, alleen tellers en gegevens van het lid (geen inhoud)', w.gebruikRijen.length === 1 && w.gebruikRijen[0].action_type === 'proposal_preview' && !/pagina|Rotterdams Muziekfonds|http/i.test(JSON.stringify(w.gebruikRijen[0])), JSON.stringify(w.gebruikRijen));

  return x;
})();

sectie('2. Tabel bestaat niet (optionele migratie niet toegepast): voorstel werkt identiek');
{
  logs.length = 0;
  wereld({ gebruikFout: 'tabel-weg' });
  const x = await controleer();

  check('zelfde antwoord als met tabel', kern(x) === kern(basis), kern(x));
  check('controle zelf bewaard, niets anders beschadigd', w.bron.length === 1 && w.gebruikRijen.length === 0);
  check('geen merkbare vertraging', x.ms < 1000, `${x.ms} ms`);
  check('alleen een vaste, inhoudsloze logregel', logs.length === 1 && /gebruik_vastleggen_mislukt/.test(logs[0]) && !/PGRST|schema cache|kompas_gebruik_log|Rotterdams/.test(logs[0]), JSON.stringify(logs));

  // Opslaan en genereren raken de meter niet of vallen er niet over.
  const uit = await post({ mode: 'voorstel-opslaan', projectId: PID, regels: [{ type: 'regeling', id: A1, bedrag: 20000 }] });

  check('opslaan met ontbrekende meter-tabel: gewoon geslaagd', uit.status === 200 && uit.json.regels[0].status === 'opgeslagen' && uit.json.actieplan.status === 'klaar');
}

sectie('3. De meter gooit een fout of hangt: het antwoord blijft gewoon, begrensd in tijd');
{
  logs.length = 0;
  wereld({ gebruikFout: 'gooit' });
  const x = await controleer();

  check('database gooit een fout: zelfde antwoord, geen 500', kern(x) === kern(basis), kern(x));

  logs.length = 0;
  wereld({ gebruikFout: 'hangt' });
  const y = await controleer();

  check('database antwoordt niet: zelfde antwoord, geen 500', kern(y) === kern(basis), kern(y));
  check('wachttijd van de meter is begrensd (< 3 s)', y.ms < 3000, `${y.ms} ms`);
  check('het lid merkt er niets van: de meter komt niet in het antwoord voor', !/kompas_gebruik_log|gebruiksmeter|vastleggen_mislukt/i.test(y.tekst));
}

console.error = origError;
console.log(`\nVOORSTEL-GEBRUIKSMETER: ${stand.ok} OK, ${stand.fout} FAIL`);
process.exit(stand.fout ? 1 : 0);
