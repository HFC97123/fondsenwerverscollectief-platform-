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

// ═════════════════════════════════════════════════════════════════════════════════════════════════
const BASIS = { id: PROJECT, naam: 'Samen Spelen', begroting: '', eigenBijdrage: 2000, budgetRegels: [] };
const kopje = (id) => $(`[data-testid="bg-kopje-${id}"]`);
const openDetail = async (regel) => { if (!$('[data-testid="bg-detail"]', regel)) await klik($('[data-testid="bg-meer"]', regel)); };

sectie('1. Leeg beginnen: alleen kopjes om uit te kiezen');
let s;
{
  s = await toon(BASIS);
  check('helemaal leeg: geen regels, geen opslaan, geen Excel, totaal 0', $$('[data-testid="bg-regel"]').length === 0 && !knop('Begroting opslaan') && /Totaal € 0/.test($('[data-testid="bg-totaal"]').textContent));
  check('de drie kopjes van Aisya en Overig staan klaar om te kiezen', ['uitvoering', 'activa', 'organisatie', 'overig'].every((k) => $(`[data-testid="bg-kopje-kies-${k}"]`)));
  check('dekkingsplan zegt: vul eerst de begroting in', /Vul eerst de begroting in/.test(tekst()));

  await klik($('[data-testid="bg-kopje-kies-uitvoering"]'));
  check('kopje gekozen: het staat er, de keuze verdwijnt uit de lijst, suggesties staan open', !!kopje('uitvoering') && !$('[data-testid="bg-kopje-kies-uitvoering"]') && !!$('[data-testid="bg-suggesties-uitvoering"]'));
  check('suggesties zijn alleen omschrijvingen: personeel en vrijwilligers horen hier', $$('[data-testid="bg-suggestie"]').some((b) => /Projectleider/.test(b.textContent)) && $$('[data-testid="bg-suggestie"]').some((b) => /Vrijwilligersvergoeding/.test(b.textContent)));

  await klik($$('[data-testid="bg-suggestie"]').find((b) => /Projectleider/.test(b.textContent)));
  const regel = regelMet('Projectleider');
  check('suggestie kiezen geeft één schone regel: omschrijving en bedragveld, geen kolommen', !!regel && $('[data-testid="bg-bedrag"]', regel).value === '' && !$('[data-testid="bg-detail"]', regel) && !$('[data-testid="bg-suggesties-uitvoering"]') && !!$('[data-testid="bg-plus-uitvoering"]'));
  check('Opslaan verschijnt zodra er iets staat', !!knop('Begroting opslaan') && !!$('[data-testid="bg-niet-opgeslagen"]'));

  await klik($('[data-testid="bg-plus-uitvoering"]'));
  check('+ Regel opent de suggesties weer, zonder de al gebruikte', !$$('[data-testid="bg-suggestie"]').some((b) => /Projectleider/.test(b.textContent)) && !!$('[data-testid="bg-eigen-regel"]'));
  await klik($('[data-testid="bg-eigen-regel"]'));
  check('eigen regel: lege regel met de cursor erin', document.activeElement && document.activeElement.getAttribute('data-testid') === 'bg-omschrijving' && document.activeElement.value === '');
  await klik($('[data-testid="bg-weg"]', regelMet('')));

  await klik($('[data-testid="bg-plus-kopje"]'));
  await klik($('[data-testid="bg-kopje-kies-activa"]'));
  await klik($$('[data-testid="bg-suggestie"]').find((b) => /Voedselpakketten/.test(b.textContent)));
  check('Voedselpakketten staat onder Activa en uitrusting', !!regelMet('Voedselpakketten', kopje('activa')));
}

sectie('2. Bedrag, aantal x tarief en in natura achter ⋯');
{
  await typ($('[data-testid="bg-bedrag"]', regelMet('Voedselpakketten')), '2.500');
  check('los bedrag telt mee', /Totaal € 2\.500/.test($('[data-testid="bg-totaal"]').textContent) && /Nog geen bedrag bij: Projectleider/.test(tekst()));

  const pl = regelMet('Projectleider');

  await klik($('[data-testid="bg-meer"]', pl));
  check('⋯ toont aantal, eenheid, tarief en In natura', !!$('[data-testid="bg-aantal"]', pl) && !!$('[data-testid="bg-eenheid"]', pl) && !!$('[data-testid="bg-tarief"]', pl) && !!$('[data-testid="bg-natura"]', pl) && $('[data-testid="bg-eenheid"]', pl).value === 'uur');
  await typ($('[data-testid="bg-aantal"]', pl), '100');
  await typ($('[data-testid="bg-tarief"]', pl), '50');
  check('aantal x tarief wordt uitgerekend, het losse bedragveld maakt plaats voor het resultaat', /€ 5\.000/.test($('[data-testid="bg-bedrag-berekend"]', pl).textContent) && !$('[data-testid="bg-bedrag"]', pl) && /Totaal € 7\.500/.test($('[data-testid="bg-totaal"]').textContent));
  await klik($('[data-testid="bg-meer"]', pl));
  check('⋯ weer dicht: de regel is weer schoon', !$('[data-testid="bg-detail"]', pl));
  check('subtotaal per kopje klopt', /€ 5\.000/.test($('[data-testid="bg-sub-uitvoering"]').textContent) && /€ 2\.500/.test($('[data-testid="bg-sub-activa"]').textContent));

  const pak = regelMet('Voedselpakketten');

  await openDetail(pak);
  await klik($('[data-testid="bg-natura"]', pak));
  check('in natura: telt niet mee, staat er apart', /Totaal € 5\.000/.test($('[data-testid="bg-totaal"]').textContent) && /In natura \(telt niet mee in het totaal\): € 2\.500/.test(tekst()));
  await klik($('[data-testid="bg-meer"]', pak));
  check('met ⋯ dicht blijft in natura zichtbaar als klein label', !!$('[data-testid="bg-natura-label"]', pak));
  await klik($('[data-testid="bg-meer"]', pak));
  await klik($('[data-testid="bg-natura"]', pak));
  check('weer als gewone kostenregel: telt weer mee', /Totaal € 7\.500/.test($('[data-testid="bg-totaal"]').textContent));

  await klik($('[data-testid="bg-plus-organisatie"]') || $('[data-testid="bg-plus-kopje"]'));
  if ($('[data-testid="bg-kopje-kies-organisatie"]')) await klik($('[data-testid="bg-kopje-kies-organisatie"]'));
  await klik($('[data-testid="bg-eigen-regel"]'));
  const rommel = regelMet('', kopje('organisatie'));

  check('communicatie en huisvesting horen bij Organisatiekosten', !!kopje('organisatie'));
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
  check('de regels staan als getallen op het project', Array.isArray(p.budgetRegels) && p.budgetRegels.length === 3 && p.budgetRegels.some((r) => r.categorie === 'activa') && p.budgetRegels.some((r) => r.aantal === 100 && r.tarief === 50));
  check('overige projectvelden blijven ongemoeid', p.naam === 'Samen Spelen' && p.eigenBijdrage === 2000);
  check('na opslaan: bevestiging met het nieuwe totaal en Opslaan weer uit', await wacht(() => $('[data-testid="bg-melding"]')) && /projectbegroting is nu € 7\.520/.test($('[data-testid="bg-melding"]').textContent) && knop('Begroting opslaan').disabled === true);
}

sectie('4. Dekkingsplan: toegekend, uitstaand, in planning, totaal, nog te dekken');
{
  check('geen regel "te dekken": de begroting staat al erboven', await wacht(() => /Toegekend/.test($('[data-testid="bg-dekking"]').textContent)) && !/Te dekken|Gegeven/.test($('[data-testid="bg-dekking"]').textContent));
  const d = $('[data-testid="bg-dekking"]').textContent.replace(/\s+/g, ' ');

  check('begint met Toegekend: eigen bijdrage, dan het toegekende fonds met het toegekende bedrag', /Toegekend\s*Eigen bijdrage\s*€ 2\.000\s*Fonds Toegekend\s*€ 7\.000/.test(d));
  check('dan Uitstaand met het aangevraagde fonds', /Uitstaand\s*Fonds Uitstaand\s*€ 5\.000/.test(d));
  check('dan In planning, en een fonds zonder bedrag zegt "bedrag volgt"', /In planning\s*Fonds Gepland\s*€ 3\.000/.test(d) && /Fonds Zonder Bedrag\s*bedrag volgt/.test(d) && /Bij 1 financier in planning staat nog geen bedrag/.test(d));
  check('onderaan: Totaal en daaronder Nog te dekken', d.search(/Totaal\s*€/) > d.indexOf('In planning') && d.indexOf('Nog te dekken') > d.search(/Totaal\s*€/));
  check('totaal 17.000 = 2.000 + 7.000 + 5.000 + 3.000; nog te dekken € 0; sluitend met het meerdere genoemd', /€ 17\.000/.test($('[data-testid="bg-dek-totaal"]').textContent) && /€ 0/.test($('[data-testid="bg-nog-te-plannen"]').textContent) && /meer dan de begroting/.test($('[data-testid="bg-sluit"]').textContent) && /€ 9\.480/.test($('[data-testid="bg-sluit"]').textContent));
  check('de plek om het aan te passen is Projectfinanciering', $('[data-testid="bg-dekking"] a').getAttribute('href').includes(`/kompas/projecten/${PROJECT}?tab=projectfinanciering`));
  await opruimen();

  s = await toon({ ...BASIS, eigenBijdrage: 0, begroting: 20000 }, { funding: [FUNDING[0]] });
  check('niet sluitend: totaal van de dekking en het nog te dekken bedrag, geen Sluitend', /€ 7\.000/.test($('[data-testid="bg-dek-totaal"]').textContent) && /€ 13\.000/.test($('[data-testid="bg-nog-te-plannen"]').textContent) && !$('[data-testid="bg-sluit"]'));
  check('een bestaande begroting bij Projecten zonder regels wordt kort genoemd', /Bij Projecten staat nu € 20\.000/.test($('[data-testid="bg-leeg"]').textContent));
  await opruimen();
}

sectie('5. Bestaande regels, wisselen en weg');
{
  const regels = [{ id: 'a1', categorie: 'activa', omschrijving: 'Laptop', aantal: 2, eenheid: 'stuk', tarief: 800, bedrag: null, soort: 'geld', toelichting: '', bron: 'handmatig' }];

  s = await toon({ ...BASIS, begroting: 1600, budgetRegels: regels });
  check('opgeslagen regels staan er weer, schoon: alleen omschrijving en bedrag, details dicht', $('[data-testid="bg-omschrijving"]').value === 'Laptop' && /€ 1\.600/.test($('[data-testid="bg-bedrag-berekend"]').textContent) && /Totaal € 1\.600/.test($('[data-testid="bg-totaal"]').textContent) && knop('Begroting opslaan').disabled === true && !$('[data-testid="bg-detail"]'));
  check('met regels staat de kopjeskeuze achter + Kopje', !$('[data-testid="bg-kopjes"]') && !!$('[data-testid="bg-plus-kopje"]'));
  await klik($('[data-testid="bg-weg"]'));
  check('regel verwijderen werkt en het totaal volgt', $$('[data-testid="bg-regel"]').length === 0 && /Totaal € 0/.test($('[data-testid="bg-totaal"]').textContent));
  await klik(knop('Begroting opslaan'));
  check('een lege begroting bewaart de regels maar laat de projectbegroting staan', await wacht(() => s.bewaard.length === 1) && s.bewaard[0].begroting === 1600 && s.bewaard[0].budgetRegels.length === 0);
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
