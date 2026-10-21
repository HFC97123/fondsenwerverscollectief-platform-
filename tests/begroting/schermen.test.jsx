// Documenten › Begroting, in jsdom: regels invullen, totalen, opslaan via het bestaande projectopslaan en het dekkingsplan eronder.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
const g = globalThis;
g.window = dom.window; g.document = dom.window.document;
Object.defineProperty(g, 'navigator', { value: dom.window.navigator, configurable: true });
g.HTMLElement = dom.window.HTMLElement; g.Event = dom.window.Event; g.MouseEvent = dom.window.MouseEvent;
g.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import('react')).default;
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const client = await import('../checkout-frontend/fake-client.js');
const { default: BegrotingTab } = await import('../../src/features/kompas-app/begroting/BegrotingTab.jsx');
const { berekenBegroting, expenseLinesVoorExcel, leesBudgetRegels } = await import('../../src/features/kompas-app/begroting/begrotingModel.js');

const stand = { ok: 0, fout: 0 };
const check = (naam, waar, detail = '') => { if (waar) stand.ok += 1; else { stand.fout += 1; console.log(`  FAIL: ${naam} ${detail}`); } };
const sectie = (t) => console.log(`\n== ${t}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PROJECT = '33333333-3333-4333-8333-333333333333';
const root = createRoot(document.getElementById('root'));
const $ = (sel, van = document) => van.querySelector(sel);
const $$ = (sel, van = document) => [...van.querySelectorAll(sel)];
const tekst = () => document.body.textContent.replace(/\s+/g, ' ');
const knop = (naam) => $$('button, a').find((b) => b.textContent.replace(/\s+/g, ' ').trim().includes(naam) || (b.getAttribute('aria-label') || '').includes(naam));
const klik = async (el) => { await act(async () => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); }); };
const typ = async (el, waarde) => {
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;

  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, waarde);
    el.dispatchEvent(new window.Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  });
};
const wacht = async (fn, ms = 1500) => {
  for (let t = 0; t < ms; t += 15) {
    if (fn()) return true;

    await act(async () => { await sleep(15); });
  }

  return false;
};

const regelMet = (naam, van = document) => $$('[data-testid="bg-regel"]', van).find((r) => $('[data-testid="bg-omschrijving"]', r).value === naam);

const FUNDING = [
  { id: 'f1', program_id: PROJECT, bron_naam: 'Fonds Toegekend', status: 'awarded', requested_amount: 8000, awarded_amount: 7000 },
  { id: 'f2', program_id: PROJECT, bron_naam: 'Fonds Uitstaand', status: 'submitted', requested_amount: 5000, awarded_amount: null },
  { id: 'f3', program_id: PROJECT, bron_naam: 'Fonds Gepland', status: 'preparing', requested_amount: 3000, awarded_amount: null },
  { id: 'f4', program_id: PROJECT, bron_naam: 'Fonds Zonder Bedrag', status: 'interesting', requested_amount: null, awarded_amount: null },
];

async function toon(project, { funding = FUNDING } = {}) {
  client.__reset();
  client.__zetSupabase({ rpc: async () => ({ data: funding, error: null }) });

  const bewaard = [];
  const store = { orgProfile: { name: 'Stichting Samen Spelen' }, saveProject: async (p) => { bewaard.push(p); return PROJECT; } };

  await act(async () => { root.render(<BegrotingTab project={project} projecten={[project]} onKiesProject={() => {}} store={store} />); });
  await wacht(() => $('[data-testid="bg-tab"]'));

  return { bewaard };
}
async function opruimen() { await act(async () => { root.render(<div />); }); }

const BASIS = { id: PROJECT, naam: 'Samen Spelen', begroting: '', eigenBijdrage: 2000, budgetRegels: [] };

// ═════════════════════════════════════════════════════════════════════════════════════════════════
sectie('1. Lege begroting en een eerste regel');
let s;
{
  s = await toon(BASIS);
  check('leeg: uitnodiging om met een kopje te beginnen, totaal 0', !!$('[data-testid="bg-leeg"]') && /Totaal € 0/.test($('[data-testid="bg-totaal"]').textContent));
  check('Opslaan staat uit zolang er niets is gewijzigd', knop('Begroting opslaan').disabled === true);
  check('dekkingsplan zegt: vul eerst de begroting in', /Vul eerst de begroting in/.test(tekst()));

  await typ($('[data-testid="bg-kopje-kies"]'), 'personeel');
  check('een kopje kiezen opent het met één lege regel', !!$('[data-testid="bg-kopje-personeel"]') && $$('[data-testid="bg-regel"]').length === 1);
  check('suggesties staan bij het kopje, zonder bedragen', $$('[data-testid="bg-suggestie"]').some((b) => /Projectleider/.test(b.textContent)));

  await klik($$('[data-testid="bg-suggestie"]').find((b) => /Projectleider/.test(b.textContent)));
  const regel = regelMet('Projectleider');
  check('een suggestie vult omschrijving en eenheid, geen bedrag', $('[data-testid="bg-omschrijving"]', regel).value === 'Projectleider' && $('[data-testid="bg-eenheid"]', regel).value === 'uur' && $('[data-testid="bg-tarief"]', regel).value === '');
  check('de gebruikte suggestie verdwijnt uit de lijst', !$$('[data-testid="bg-suggestie"]').some((b) => /Projectleider/.test(b.textContent)));
  check('Opslaan wordt actief en er staat dat het nog niet is opgeslagen', knop('Begroting opslaan').disabled === false && !!$('[data-testid="bg-niet-opgeslagen"]'));
}

sectie('2. Aantal x tarief, losse bedragen, in natura');
{
  const regel = regelMet('Projectleider');

  await typ($('[data-testid="bg-aantal"]', regel), '100');
  await typ($('[data-testid="bg-tarief"]', regel), '50');
  check('aantal x tarief wordt uitgerekend en getoond', /€ 5\.000/.test($('[data-testid="bg-bedrag-berekend"]', regel).textContent) && /Totaal € 5\.000/.test($('[data-testid="bg-totaal"]').textContent));
  check('subtotaal van het kopje klopt', /€ 5\.000/.test($('[data-testid="bg-sub-personeel"]').textContent));

  await typ($('[data-testid="bg-kopje-kies"]'), 'uitvoering');
  await klik($$('[data-testid="bg-suggestie"]').find((b) => /Voedselpakketten/.test(b.textContent)));
  const pak = regelMet('Voedselpakketten');

  check('regel zonder bedrag: melding dat hij nog niet meetelt, totaal onveranderd', /Nog geen bedrag bij: Voedselpakketten/.test(tekst()) && /Totaal € 5\.000/.test($('[data-testid="bg-totaal"]').textContent));
  await typ($('[data-testid="bg-bedrag"]', pak), '2.500');
  check('los bedrag telt mee', /Totaal € 7\.500/.test($('[data-testid="bg-totaal"]').textContent));

  await klik($('[data-testid="bg-natura"]', pak));
  check('in natura: telt niet mee in het totaal, staat er apart', /Totaal € 5\.000/.test($('[data-testid="bg-totaal"]').textContent) && /In natura \(telt niet mee in het totaal\): € 2\.500/.test(tekst()));
  await klik($('[data-testid="bg-natura"]', pak));

  await klik($('[data-testid="bg-eigen-regel"]', $('[data-testid="bg-kopje-uitvoering"]')));
  const rommel = regelMet('', $('[data-testid="bg-kopje-uitvoering"]'));

  await typ($('[data-testid="bg-omschrijving"]', rommel), 'Kopieerkosten');
  await typ($('[data-testid="bg-bedrag"]', rommel), 'twintig');
  await klik(knop('Begroting opslaan'));
  check('ongeldig bedrag: duidelijke melding, niets bewaard', await wacht(() => $('[data-testid="bg-fout"]')) && /Controleer de bedragen bij "Kopieerkosten"/.test($('[data-testid="bg-fout"]').textContent) && s.bewaard.length === 0);
  await typ($('[data-testid="bg-bedrag"]', rommel), '20');
}

sectie('3. Opslaan: de regels en het totaal gaan via het bestaande projectopslaan');
{
  await klik(knop('Begroting opslaan'));
  check('er is één keer bewaard', await wacht(() => s.bewaard.length === 1));
  const p = s.bewaard[0];

  check('de projectbegroting is het totaal (hele euro\'s) en het te financieren bedrag volgt', p.begroting === 7520 && p.gevraagd === 5520);
  check('de regels staan als getallen op het project', Array.isArray(p.budgetRegels) && p.budgetRegels.length === 3 && p.budgetRegels.every((r) => typeof r.categorie === 'string') && p.budgetRegels.some((r) => r.aantal === 100 && r.tarief === 50));
  check('overige projectvelden blijven ongemoeid', p.naam === 'Samen Spelen' && p.eigenBijdrage === 2000);
  check('na opslaan: bevestiging met het nieuwe totaal en Opslaan weer uit', await wacht(() => $('[data-testid="bg-melding"]')) && /projectbegroting is nu € 7\.520/.test($('[data-testid="bg-melding"]').textContent) && knop('Begroting opslaan').disabled === true);
}

sectie('4. Dekkingsplan onder de begroting');
{
  check('te dekken is de begroting', await wacht(() => /€ 7\.520/.test(($('[data-testid="bg-dek-begroting"]') || { textContent: '' }).textContent)));
  const d = $('[data-testid="bg-dekking"]').textContent.replace(/\s+/g, ' ');

  check('gegeven: eigen bijdrage en het toegekende fonds met het toegekende bedrag', /Eigen bijdrage\s*€ 2\.000/.test(d) && /Fonds Toegekend/.test(d) && /€ 7\.000/.test(d));
  check('uitstaand: het aangevraagde fonds', /Uitstaand\s*Fonds Uitstaand/.test(d) && /€ 5\.000/.test(d));
  check('nog aan te vragen: gepland, en een fonds zonder bedrag zegt "bedrag volgt"', /Fonds Gepland/.test(d) && /Fonds Zonder Bedrag/.test(d) && /bedrag volgt/.test(d) && /Bij 1 geplande financier staat nog geen bedrag/.test(d));
  check('het dekkingsplan sluit: 2.000 + 7.000 + 5.000 + 3.000 is meer dan 7.520', !!$('[data-testid="bg-sluit"]') && /meer dan nodig/.test($('[data-testid="bg-sluit"]').textContent));
  check('de plek om het aan te passen is Projectfinanciering', $('[data-testid="bg-dekking"] a').getAttribute('href').includes(`/kompas/projecten/${PROJECT}?tab=projectfinanciering`));
  await opruimen();

  s = await toon({ ...BASIS, eigenBijdrage: 0, begroting: 20000 }, { funding: [FUNDING[0]] });
  check('nog niet sluitend: het ontbrekende bedrag wordt genoemd', /Nog te dekken/.test(tekst()) && /€ 13\.000/.test($('[data-testid="bg-nog-te-plannen"]').textContent) && !$('[data-testid="bg-sluit"]'));
  check('een bestaande begroting bij Projecten zonder regels wordt genoemd', /Bij Projecten staat nu € 20\.000/.test($('[data-testid="bg-leeg"]').textContent));
  await opruimen();
}

sectie('5. Bestaande regels, wisselen en weg');
{
  const regels = [{ id: 'a1', categorie: 'activa', omschrijving: 'Laptop', aantal: 2, eenheid: 'stuk', tarief: 800, bedrag: null, soort: 'geld', toelichting: '', bron: 'handmatig' }];

  s = await toon({ ...BASIS, begroting: 1600, budgetRegels: regels });
  check('opgeslagen regels staan er weer, met totaal', $('[data-testid="bg-omschrijving"]').value === 'Laptop' && /Totaal € 1\.600/.test($('[data-testid="bg-totaal"]').textContent) && knop('Begroting opslaan').disabled === true);
  await klik($('[data-testid="bg-weg"]'));
  check('regel verwijderen werkt en het totaal volgt', $$('[data-testid="bg-regel"]').length === 0 && /Totaal € 0/.test($('[data-testid="bg-totaal"]').textContent));
  await klik(knop('Begroting opslaan'));
  check('een lege begroting bewaart de regels maar laat de projectbegroting staan', await wacht(() => s.bewaard.length === 1) && s.bewaard[0].begroting === 1600 && s.bewaard[0].budgetRegels.length === 0);
  await opruimen();

  s = await toon(BASIS, { funding: [] });
  await typ($('[data-testid="bg-kopje-kies"]'), 'btw');
  check('bij een kopje zonder suggesties of met één: eigen regel kan altijd', !!$('[data-testid="bg-eigen-regel"]'));
  await opruimen();
}

sectie('6. Excel: dezelfde berekening als de begroting in de chat');
{
  const regels = leesBudgetRegels([
    { categorie: 'personeel', omschrijving: 'Projectleider', aantal: 100, tarief: 50, soort: 'geld' },
    { categorie: 'uitvoering', omschrijving: 'Materiaal', bedrag: 2000, soort: 'geld' },
    { categorie: 'locatie', omschrijving: 'Gratis zaal', bedrag: 500, soort: 'natura' },
  ]);
  const { berekenBudget } = await import('../../src/shared/budget/berekenBudget.js');
  const budget = berekenBudget(expenseLinesVoorExcel(regels), { ...BASIS, begroting: 7000 }, {}, undefined);

  check('totaal kosten in de Excel-berekening = totaal in het scherm', budget.totals.totaalKosten === berekenBegroting(regels).totaalGeld && budget.totals.totaalKosten === 7000);
  check('geen afwijkingen of onbekende regels', budget.waarschuwingen.afwijkendeRegels.length === 0 && budget.waarschuwingen.aantalOnbekendeRegels === 0);

  try {
    const { generateExcelDocument } = await import('../../src/shared/budget/generateExcelDocument.js');
    const blob = await generateExcelDocument({ budget, project: { ...BASIS, begroting: 7000 }, organizationName: 'Stichting Samen Spelen' });

    check('het Excel-bestand wordt gemaakt', blob && (blob.size > 1000 || blob.length > 1000 || blob.byteLength > 1000));
  } catch (e) {
    check('het Excel-bestand wordt gemaakt', false, String(e && e.message));
  }
}

console.log(`\nbegroting-schermen: ${stand.ok} OK, ${stand.fout} FAIL`);
process.exit(stand.fout ? 1 : 0);
