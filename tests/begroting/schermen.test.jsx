// Documenten › Begroting, in jsdom: regels invullen, totalen, opslaan via het bestaande projectopslaan en het dekkingsplan eronder.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
const g = globalThis;
g.window = dom.window; g.document = dom.window.document;
Object.defineProperty(g, 'navigator', { value: dom.window.navigator, configurable: true });
g.DOMParser = dom.window.DOMParser; g.HTMLElement = dom.window.HTMLElement; g.Event = dom.window.Event; g.MouseEvent = dom.window.MouseEvent;
g.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import('react')).default;
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const client = await import('../checkout-frontend/fake-client.js');
const { default: BegrotingTab } = await import('../../src/features/kompas-app/begroting/BegrotingTab.jsx');
const { berekenBegroting, expenseLinesVoorExcel, leesBudgetRegels } = await import('../../src/features/kompas-app/begroting/begrotingModel.js');
const { default: BegrotingVoorstelDialoog } = await import('../../src/features/kompas-app/begroting/BegrotingVoorstelDialoog.jsx');
const { leesChatStart, chatStartHref, leesChatUrl } = await import('../../src/features/kompas-app/chat/gesprekUrl.js');
const { maakServer } = await import('../aanvraag-frontend/nepserver.mjs');
const { leesBegrotingBestand } = await import('../../src/features/kompas-app/begroting/begrotingBestand.js');

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
  check('helemaal leeg: geen regels, geen opslaan, geen Excel, nog geen totaal', $$('[data-testid="bg-regel"]').length === 0 && !knop('Begroting opslaan') && !$('[data-testid="bg-totaal"]'));
  check('de vier vaste kopjes staan klaar om te kiezen, plus eigen kopje en zonder kopje', ['uitvoering', 'activa', 'communicatie', 'organisatie'].every((k) => $(`[data-testid="bg-kopje-kies-${k}"]`)) && !!$('[data-testid="bg-kopje-eigen"]') && !!$('[data-testid="bg-kopje-geen"]'));
  check('dekkingsplan zegt: vul eerst de begroting in', /Vul eerst de begroting in/.test(tekst()));

  await klik($('[data-testid="bg-kopje-kies-uitvoering"]'));
  check('kopje gekozen: het staat er, de keuze verdwijnt uit de lijst, suggesties staan open', !!kopje('uitvoering') && !$('[data-testid="bg-kopje-kies-uitvoering"]') && !!$('[data-testid="bg-suggesties-uitvoering"]'));
  check('suggesties zijn alleen omschrijvingen: personeel en vrijwilligers horen hier', $$('[data-testid="bg-suggestie"]').some((b) => /Projectleider/.test(b.textContent)) && $$('[data-testid="bg-suggestie"]').some((b) => /Vrijwilligersvergoeding/.test(b.textContent)));

  await klik($$('[data-testid="bg-suggestie"]').find((b) => /Projectleider/.test(b.textContent)));
  const regel = regelMet('Projectleider');
  check('suggestie kiezen geeft één schone regel: omschrijving en bedragveld, geen kolommen', !!regel && $('[data-testid="bg-bedrag"]', regel).value === '' && !$('[data-testid="bg-detail"]', regel) && !$('[data-testid="bg-suggesties-uitvoering"]') && !!$('[data-testid="bg-plus-uitvoering"]'));
  check('de plusknop is alleen een + (met een toegankelijke naam) en de kopjes staan boven de regels', $('[data-testid="bg-plus-uitvoering"]').textContent.trim() === '+' && $('[data-testid="bg-plus-uitvoering"]').getAttribute('aria-label') === 'Regel toevoegen' && !!($('[data-testid="bg-kopjes"]').compareDocumentPosition($('[data-testid="bg-regel"]')) & 4));
  check('na een suggestie staat de cursor meteen in het bedragveld', document.activeElement === $('[data-testid="bg-bedrag"]', regel));
  await act(async () => { $('[data-testid="bg-bedrag"]', regel).dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
  check('Enter in het bedrag opent de suggesties voor de volgende regel van hetzelfde kopje', !!$('[data-testid="bg-suggesties-uitvoering"]'));
  check('de keuzes onder een kopje heten + Zelf invullen en boven staat Kies een subcategorie met een kale + voor een eigen kopje', /\+ Zelf invullen/.test($('[data-testid="bg-eigen-regel"]').textContent) && /Kies een subcategorie/.test($('[data-testid="bg-kopjes"]').textContent) && $('[data-testid="bg-kopje-eigen"]').textContent.trim() === '+');
  check('onder het laatste kopje met regels staat Opslaan en volgende subcategorie; er wordt niets automatisch gekozen', /Opslaan en volgende subcategorie/.test(($('[data-testid="bg-volgende-kop"]') || { textContent: '' }).textContent) && !$('[data-testid="bg-volgende-keuze"]'));
  check('Opslaan verschijnt zodra er iets staat', !!knop('Begroting opslaan') && !!$('[data-testid="bg-niet-opgeslagen"]'));

  if ($('[data-testid="bg-plus-uitvoering"]')) await klik($('[data-testid="bg-plus-uitvoering"]'));
  check('+ Regel opent de suggesties weer, zonder de al gebruikte', !$$('[data-testid="bg-suggestie"]').some((b) => /Projectleider/.test(b.textContent)) && !!$('[data-testid="bg-eigen-regel"]'));
  await klik($('[data-testid="bg-eigen-regel"]'));
  check('eigen regel: lege regel met de cursor erin', document.activeElement && document.activeElement.getAttribute('data-testid') === 'bg-omschrijving' && document.activeElement.value === '');
  await klik($('[data-testid="bg-weg"]', regelMet('')));

  await klik($('[data-testid="bg-kopje-kies-activa"]'));
  await klik($$('[data-testid="bg-suggestie"]').find((b) => /Voedselpakketten/.test(b.textContent)));
  check('Voedselpakketten staat onder Activa en uitrusting', !!regelMet('Voedselpakketten', kopje('activa')));
}

sectie('2. Bedrag, aantal x tarief achter ⋯ (geen in natura)');
{
  await typ($('[data-testid="bg-bedrag"]', regelMet('Voedselpakketten')), '2.500');
  check('los bedrag telt mee', /Totaal € 2\.500/.test($('[data-testid="bg-totaal"]').textContent) && /Nog geen bedrag bij: Projectleider/.test(tekst()));

  const pl = regelMet('Projectleider');

  await klik($('[data-testid="bg-meer"]', pl));
  check('⋯ toont aantal, eenheid en tarief, en geen In natura', !!$('[data-testid="bg-aantal"]', pl) && !!$('[data-testid="bg-eenheid"]', pl) && !!$('[data-testid="bg-tarief"]', pl) && !$('[data-testid="bg-natura"]', pl) && !/natura/i.test($('[data-testid="bg-tab"]').textContent) && $('[data-testid="bg-eenheid"]', pl).value === 'uur');
  await typ($('[data-testid="bg-aantal"]', pl), '100');
  await typ($('[data-testid="bg-tarief"]', pl), '50');
  check('aantal x tarief wordt uitgerekend, het losse bedragveld maakt plaats voor het resultaat', /€ 5\.000/.test($('[data-testid="bg-bedrag-berekend"]', pl).textContent) && !$('[data-testid="bg-bedrag"]', pl) && /Totaal € 7\.500/.test($('[data-testid="bg-totaal"]').textContent));
  await klik($('[data-testid="bg-meer"]', pl));
  check('⋯ weer dicht: de regel is weer schoon', !$('[data-testid="bg-detail"]', pl));
  check('subtotaal per kopje klopt', /€ 5\.000/.test($('[data-testid="bg-sub-uitvoering"]').textContent) && /€ 2\.500/.test($('[data-testid="bg-sub-activa"]').textContent));

  await klik($('[data-testid="bg-kopje-kies-organisatie"]'));
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
  check('onderaan: Totaal, daaronder Reeds gedekt en Overdekking (bij te veel dekking)', d.search(/Totaal\s*€/) > d.indexOf('In planning') && d.indexOf('Reeds gedekt') > d.search(/Totaal\s*€/) && d.indexOf('Overdekking') > d.indexOf('Reeds gedekt'));
  check('te veel gedekt: totaal 17.000, daaronder Reeds gedekt (de begroting) en Overdekking 9.480, geen Nog te dekken en geen Sluitend', /€ 17\.000/.test($('[data-testid="bg-dek-totaal"]').textContent) && /€ 7\.520/.test($('[data-testid="bg-reeds-gedekt"]').textContent) && /€ 9\.480/.test($('[data-testid="bg-overdekking"]').textContent) && !$('[data-testid="bg-nog-te-plannen"]') && !$('[data-testid="bg-sluit"]'));
  check('bovenaan een dekkingsbalk vóór de begroting, met toegekend, eigen bijdrage, uitstaand, in planning en de overdekking', !!$('[data-testid="bg-balk"]') && !!($('[data-testid="bg-balk"]').compareDocumentPosition($('[data-testid="bg-begroting"]')) & 4) && /€ 7\.000 toegekend/.test($('[data-testid="bg-balk-toegekend"]').textContent) && /€ 2\.000 eigen bijdrage/.test($('[data-testid="bg-balk-eigen"]').textContent) && /€ 5\.000 uitstaand/.test($('[data-testid="bg-balk-uitstaand"]').textContent) && /€ 3\.000 in planning/.test($('[data-testid="bg-balk-planning"]').textContent) && /€ 9\.480 overdekking/.test($('[data-testid="bg-balk-over"]').textContent) && !$('[data-testid="bg-balk-nog"]') && $$('[data-testid="bg-balk"] [data-seg]').length === 4);
  check('de plek om het aan te passen is Projectfinanciering', $('[data-testid="bg-dekking"] a').getAttribute('href').includes(`/kompas/projecten/${PROJECT}?tab=projectfinanciering`));
  await opruimen();

  s = await toon({ ...BASIS, eigenBijdrage: 0, begroting: 20000 }, { funding: [FUNDING[0]] });
  check('de balk zegt bij te weinig dekking hoeveel er nog te dekken is, en laat het toegekende deel zien', /€ 13\.000 nog te dekken/.test($('[data-testid="bg-balk-nog"]').textContent) && !$('[data-testid="bg-balk-over"]') && /€ 7\.000 toegekend/.test($('[data-testid="bg-balk-toegekend"]').textContent) && !$('[data-testid="bg-balk-uitstaand"]'));
  check('niet sluitend: totaal van de dekking en het nog te dekken bedrag, geen Sluitend', /€ 7\.000/.test($('[data-testid="bg-dek-totaal"]').textContent) && /€ 13\.000/.test($('[data-testid="bg-nog-te-plannen"]').textContent) && !$('[data-testid="bg-sluit"]'));
  await opruimen();
  s = await toon({ ...BASIS, eigenBijdrage: 0, begroting: 7000 }, { funding: [FUNDING[0]] });
  check('de balk zegt bij precies genoeg: volledig gedekt', /volledig gedekt/.test($('[data-testid="bg-balk-sluitend"]').textContent) && !$('[data-testid="bg-balk-nog"]') && !$('[data-testid="bg-balk-over"]'));
  check('precies genoeg: Nog te dekken € 0 en Sluitend, geen Reeds gedekt of Overdekking', /€ 0/.test($('[data-testid="bg-nog-te-plannen"]').textContent) && !!$('[data-testid="bg-sluit"]') && !$('[data-testid="bg-overdekking"]') && !$('[data-testid="bg-reeds-gedekt"]'));
  await opruimen();
  s = await toon({ ...BASIS, eigenBijdrage: 0, begroting: 20000 }, { funding: [FUNDING[0]] });
  await opruimen();
  // Zonder de financiers in planning is er nog iets te dekken (7.000 + 5.000 = 12.000 van 14.000); mét planning (3.000) is het 15.000: overdekking 1.000.
  s = await toon({ ...BASIS, eigenBijdrage: 0, begroting: 14000 }, { funding: [FUNDING[0], FUNDING[1], FUNDING[2]] });
  check('de overdekking ontstaat door de financiers in planning: dan Reeds gedekt en Overdekking, geen Nog te dekken', /€ 15\.000/.test($('[data-testid="bg-dek-totaal"]').textContent) && /€ 14\.000/.test($('[data-testid="bg-reeds-gedekt"]').textContent) && /€ 1\.000/.test($('[data-testid="bg-overdekking"]').textContent) && !$('[data-testid="bg-nog-te-plannen"]'));
  await opruimen();
  // Met planning er nog steeds te weinig: 15.000 van 20.000.
  s = await toon({ ...BASIS, eigenBijdrage: 0, begroting: 20000 }, { funding: [FUNDING[0], FUNDING[1], FUNDING[2]] });
  check('ook met de financiers in planning te weinig: Nog te dekken 5.000, geen Overdekking', /€ 15\.000/.test($('[data-testid="bg-dek-totaal"]').textContent) && /€ 5\.000/.test($('[data-testid="bg-nog-te-plannen"]').textContent) && !$('[data-testid="bg-overdekking"]') && !$('[data-testid="bg-sluit"]'));
  await opruimen();
  s = await toon({ ...BASIS, eigenBijdrage: 0, begroting: 20000 }, { funding: [FUNDING[0]] });
  check('een bestaande begroting bij Projecten zonder regels wordt kort genoemd', /Bij Projecten staat nu € 20\.000/.test($('[data-testid="bg-leeg"]').textContent));
  await opruimen();
}

sectie('5. Bestaande regels, wisselen en weg');
{
  const regels = [{ id: 'a1', categorie: 'activa', omschrijving: 'Laptop', aantal: 2, eenheid: 'stuk', tarief: 800, bedrag: null, soort: 'geld', toelichting: '', bron: 'handmatig' }];

  s = await toon({ ...BASIS, begroting: 1600, budgetRegels: regels });
  check('opgeslagen regels staan er weer, schoon: alleen omschrijving en bedrag, details dicht', $('[data-testid="bg-omschrijving"]').value === 'Laptop' && /€ 1\.600/.test($('[data-testid="bg-bedrag-berekend"]').textContent) && /Totaal € 1\.600/.test($('[data-testid="bg-totaal"]').textContent) && knop('Begroting opslaan').disabled === true && !$('[data-testid="bg-detail"]'));
  check('met regels blijven de voorgestelde kopjes altijd zichtbaar als suggesties, met een kruisje erachter', !!$('[data-testid="bg-kopje-kies-uitvoering"]') && !$('[data-testid="bg-kopje-kies-activa"]') && !!$('[data-testid="bg-kopje-sug-weg-uitvoering"]'));
  await klik($('[data-testid="bg-kopje-sug-weg-uitvoering"]'));
  check('suggestie met het kruisje weggeklikt: weg uit de lijst, er komt geen kopje bij', !$('[data-testid="bg-kopje-kies-uitvoering"]') && !kopje('uitvoering'));
  await klik($('[data-testid="bg-weg"]'));
  check('regel verwijderen werkt en het totaal verdwijnt met de laatste regel', $$('[data-testid="bg-regel"]').length === 0 && !$('[data-testid="bg-totaal"]'));
  await klik(knop('Begroting opslaan'));
  check('een lege begroting bewaart de regels maar laat de projectbegroting staan', await wacht(() => s.bewaard.length === 1) && s.bewaard[0].begroting === 1600 && s.bewaard[0].budgetRegels.length === 0);
  await opruimen();
}

sectie('6. Excel: dezelfde berekening als de begroting in de chat');
{
  const regels = leesBudgetRegels([
    { categorie: 'personeel', omschrijving: 'Projectleider', aantal: 100, tarief: 50, soort: 'geld' },
    { categorie: 'uitvoering', omschrijving: 'Materiaal', bedrag: 2000, soort: 'geld' },
  ]);
  const { berekenBudget } = await import('../../src/shared/budget/berekenBudget.js');
  const budget = berekenBudget(expenseLinesVoorExcel(regels), { ...BASIS, begroting: 7000 }, {}, undefined);

  check('totaal kosten in de Excel-berekening = totaal in het scherm', budget.totals.totaalKosten === berekenBegroting(regels).totaalGeld && budget.totals.totaalKosten === 7000);
  check('geen afwijkingen of onbekende regels', budget.waarschuwingen.afwijkendeRegels.length === 0 && budget.waarschuwingen.aantalOnbekendeRegels === 0);

  // Alle financiers uit het dekkingsplan (Projectfinanciering) komen in de Excel: toegekend, aangevraagd en in planning, met eigen bijdrage.
  const { regelUitRpc, dekkingVanProject } = await import('../../src/features/kompas-app/financiering/dekkingsplan.js');
  const fregels = FUNDING.map(regelUitRpc);
  const pr = { ...BASIS, begroting: 7000, eigenBijdrage: 2000 };
  const zonder = berekenBudget(expenseLinesVoorExcel(regels), pr, {}, { regels: fregels, dekking: dekkingVanProject(pr, fregels) });
  const met = berekenBudget(expenseLinesVoorExcel(regels), pr, {}, { regels: fregels, dekking: dekkingVanProject(pr, fregels), metPlanning: true });

  check('zonder planning (chat en andere exports) verandert er niets: alleen toegekend en aangevraagd', zonder.projectFinanciering.cofinanciers.map((c) => c.naam).join() === 'Fonds Toegekend,Fonds Uitstaand' && zonder.totals.totaalDekking === 14000);
  check('met planning (begrotingstab): toegekend, uitstaand, in planning, in die volgorde, status In planning', met.projectFinanciering.cofinanciers.map((c) => `${c.naam}:${c.bedrag}:${c.status}`).join() === 'Fonds Toegekend:7000:Toegekend,Fonds Uitstaand:5000:Aangevraagd,Fonds Gepland:3000:In planning');
  check('het totaal van de dekking in de Excel is gelijk aan het totaal op het scherm (eigen bijdrage + alle financiers met bedrag)', met.totals.totaalDekking === 17000 && met.totals.totaalDekking === dekkingVanProject(pr, fregels).gedektMetPlan);

  try {
    const { generateExcelDocument } = await import('../../src/shared/budget/generateExcelDocument.js');
    const blob = await generateExcelDocument({ budget, project: { ...BASIS, begroting: 7000 }, organizationName: 'Stichting Samen Spelen' });

    check('het Excel-bestand wordt gemaakt', blob && (blob.size > 1000 || blob.length > 1000 || blob.byteLength > 1000));
  } catch (e) {
    check('het Excel-bestand wordt gemaakt', false, String(e && e.message));
  }
}

sectie('7. Uitleg per kopje, verslepen, kopje weghalen en eigen kopje');
{
  const R = (id, categorie, omschrijving, bedrag) => ({ id, categorie, omschrijving, aantal: null, eenheid: '', tarief: null, bedrag, soort: 'geld', toelichting: '', bron: 'handmatig' });
  const volgorde = () => $$('section.fwk-bg-sec').map((x) => x.getAttribute('data-testid').replace('bg-kopje-', ''));
  const namen = (van = document) => $$('[data-testid="bg-omschrijving"]', van).map((i) => i.value);
  const openKopjes = async () => {};
  const sleepGebeurtenis = async (el, type, { y = 0, top = 0, hoogte = 40 } = {}) => {
    const ev = new window.Event(type, { bubbles: true, cancelable: true });

    ev.dataTransfer = { effectAllowed: '', setData() {}, setDragImage() {} };
    Object.defineProperty(ev, 'clientY', { value: y });
    el.getBoundingClientRect = () => ({ top, height: hoogte, bottom: top + hoogte, left: 0, right: 100, width: 100 });
    await act(async () => { el.dispatchEvent(ev); });
  };
  const sleep = async (greep, doel, plek = 'voor') => {
    await sleepGebeurtenis(greep, 'dragstart');
    await sleepGebeurtenis(doel, 'dragover', { y: plek === 'voor' ? 5 : 35 });
    await sleepGebeurtenis(doel, 'drop', { y: plek === 'voor' ? 5 : 35 });
    await sleepGebeurtenis(greep, 'dragend');
  };

  s = await toon({ ...BASIS, begroting: 1000, budgetRegels: [R('a1', 'uitvoering', 'Projectleider', 100), R('a2', 'uitvoering', 'Coördinator', 200), R('b1', 'activa', 'Laptop', 300), R('c1', 'communicatie', 'Flyers', 400)] });

  check('vier kopjes in de volgorde van de lijst, communicatie is een apart kopje', volgorde().join() === 'uitvoering,activa,communicatie');

  const wrap = $('[data-testid="bg-kopje-kies-organisatie"]').parentElement;

  check('geen uitleg zolang je er niet overheen gaat', !$('[data-testid="bg-tip-uitvoering"]') && !$('[data-testid="bg-tip-organisatie"]'));
  await act(async () => { $('[data-testid="bg-toelichting-uitvoering"]').dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true })); });
  check('overheen gaan toont een paar bullets bij Projectuitvoering', !!$('[data-testid="bg-tip-uitvoering"]') && $$('[data-testid="bg-tip-uitvoering"] li').length === 2 && /mankracht/.test($('[data-testid="bg-tip-uitvoering"]').textContent) && /trainen/.test($('[data-testid="bg-tip-uitvoering"]').textContent));
  await act(async () => { $('[data-testid="bg-toelichting-uitvoering"]').dispatchEvent(new window.MouseEvent('mouseout', { bubbles: true })); });
  check('weg met de muis: uitleg verdwijnt', !$('[data-testid="bg-tip-uitvoering"]'));
  await klik($('[data-testid="bg-info-activa"]'));
  check('klikken op ⓘ (aanraking) toont de uitleg van Activa en uitrusting en klikken sluit weer', /uitrusting/.test(($('[data-testid="bg-tip-activa"]') || { textContent: '' }).textContent) && /materialen/.test($('[data-testid="bg-tip-activa"]').textContent));
  await klik($('[data-testid="bg-info-activa"]'));
  check('tweede klik sluit de uitleg', !$('[data-testid="bg-tip-activa"]'));
  await act(async () => { wrap.dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true })); });
  check('ook de keuzeknop voor een nog niet gekozen kopje legt uit: fondsenwerving en 6% tot 12,5%', /fondsenwerving/.test(($('[data-testid="bg-tip-organisatie"]') || { textContent: '' }).textContent) && /6% en 12,5%/.test($('[data-testid="bg-tip-organisatie"]').textContent));
  await act(async () => { wrap.dispatchEvent(new window.MouseEvent('mouseout', { bubbles: true })); });
  await klik($('[data-testid="bg-kopje-kies-organisatie"]'));
  check('Organisatiekosten gekozen: staat er nu als kopje', !!kopje('organisatie') && volgorde().join() === 'uitvoering,activa,communicatie,organisatie');
  await klik($('[data-testid="bg-kopje-weg-organisatie"]'));
  check('leeg kopje weghalen kan, het is meteen weg', !kopje('organisatie'));

  // pijltjes (aanraking en toetsenbord)
  await klik($('[data-testid="bg-kopje-omlaag-uitvoering"]'));
  check('kopje ▼: Projectuitvoering staat nu onder Activa', volgorde().join() === 'activa,uitvoering,communicatie');
  await klik($('[data-testid="bg-kopje-omhoog-uitvoering"]'));
  check('kopje ▲ zet het terug; bovenste kopje kan niet omhoog', volgorde().join() === 'uitvoering,activa,communicatie' && $('[data-testid="bg-kopje-omhoog-uitvoering"]').disabled === true);
  const ca = regelMet('Coördinator');
  await openDetail(ca);
  await klik($('[data-testid="bg-regel-omhoog"]', ca));
  check('regel ↑ binnen het kopje', namen(kopje('uitvoering')).join() === 'Coördinator,Projectleider');

  // verslepen
  await sleep($('[data-testid="bg-greep"]', regelMet('Laptop')), regelMet('Coördinator'), 'voor');
  check('regel slepen naar een ander kopje: Laptop staat nu onder Projectuitvoering, vóór Coördinator', namen(kopje('uitvoering')).join() === 'Laptop,Coördinator,Projectleider' && !kopje('activa'));
  check('het subtotaal en het totaal volgen', /€ 600/.test($('[data-testid="bg-sub-uitvoering"]').textContent) && /Totaal € 1\.000/.test($('[data-testid="bg-totaal"]').textContent));
  await sleep($('[data-testid="bg-greep"]', regelMet('Projectleider')), regelMet('Flyers'), 'na');
  check('regel slepen naar achter een regel in een ander kopje', namen(kopje('communicatie')).join() === 'Flyers,Projectleider');
  await sleep($('[data-testid="bg-greep"]', regelMet('Flyers')), kopje('uitvoering'), 'voor');
  check('regel loslaten op een kopje zet hem onderaan dat kopje', namen(kopje('uitvoering')).join() === 'Laptop,Coördinator,Flyers');
  await sleep($('[data-testid="bg-kopje-greep-communicatie"]'), kopje('uitvoering'), 'voor');
  check('heel kopje slepen: Communicatiekosten komt vóór Projectuitvoering', volgorde().join() === 'communicatie,uitvoering');
  await sleep($('[data-testid="bg-kopje-greep-communicatie"]'), kopje('uitvoering'), 'na');
  check('en weer erachter', volgorde().join() === 'uitvoering,communicatie');
  await sleepGebeurtenis($('[data-testid="bg-greep"]', regelMet('Laptop')), 'dragstart');
  await sleepGebeurtenis($('[data-testid="bg-greep"]', regelMet('Laptop')), 'dragend');
  check('slepen afbreken verandert niets', namen().join() === 'Laptop,Coördinator,Flyers,Projectleider');

  // kopje weghalen: de regels blijven
  await klik($('[data-testid="bg-kopje-weg-communicatie"]'));
  check('✕ bij een kopje: kopje weg, de regel blijft staan zonder kopje, het totaal blijft gelijk', !kopje('communicatie') && !!kopje('zonder') && namen(kopje('zonder')).join() === 'Projectleider' && /Totaal € 1\.000/.test($('[data-testid="bg-totaal"]').textContent));
  check('de regels zonder kopje hebben geen kopregel, wel een + Regel', !$('[data-testid="bg-kop-zonder"]') && !!$('[data-testid="bg-plus-zonder"]'));
  await klik($('[data-testid="bg-plus-zonder"]'));
  check('+ Regel bij regels zonder kopje geeft meteen een lege regel (geen suggesties)', namen(kopje('zonder')).length === 2 && !$('[data-testid="bg-suggesties-zonder"]'));
  await klik($('[data-testid="bg-weg"]', regelMet('', kopje('zonder'))));

  // eigen kopje
  await openKopjes();
  await klik($('[data-testid="bg-kopje-eigen"]'));
  check('Toevoegen is uit zolang er geen naam is', knop('Subcategorie toevoegen').disabled === true);
  await typ($('[data-testid="bg-eigen-naam"]'), 'Locatie en huisvesting');
  await klik(knop('Subcategorie toevoegen')); await wacht(() => true);
  check('eigen kopje staat er met de eigen naam, zonder uitleg-knop, met algemene suggesties', !!kopje('eigen-locatie-en-huisvesting') && $('[data-testid="bg-kop-eigen-locatie-en-huisvesting"]').textContent === 'Locatie en huisvesting' && !$('[data-testid="bg-info-eigen-locatie-en-huisvesting"]') && $$('[data-testid="bg-suggestie"]').some((b) => /Onvoorzien/.test(b.textContent)));
  await klik($('[data-testid="bg-eigen-regel"]'));
  await typ($('[data-testid="bg-omschrijving"]', regelMet('', kopje('eigen-locatie-en-huisvesting'))), 'Zaalhuur');
  await typ($('[data-testid="bg-bedrag"]', regelMet('Zaalhuur')), '250');
  check('regel onder het eigen kopje telt mee', /Totaal € 1\.250/.test($('[data-testid="bg-totaal"]').textContent) && /€ 250/.test($('[data-testid="bg-sub-eigen-locatie-en-huisvesting"]').textContent));
  await openKopjes();
  await klik($('[data-testid="bg-kopje-eigen"]'));
  await typ($('[data-testid="bg-eigen-naam"]'), 'locatie en huisvesting');
  await klik(knop('Subcategorie toevoegen')); await wacht(() => true);
  check('dezelfde naam nog eens geeft geen tweede kopje', volgorde().filter((v) => v.startsWith('eigen')).length === 1);

  // opslaan: volgorde, zonder kopje en eigen kopje blijven bewaard
  await klik(knop('Begroting opslaan'));
  check('opgeslagen', await wacht(() => s.bewaard.length === 1));
  const o = s.bewaard[0].budgetRegels;
  check('de volgorde en de kopjes zijn bewaard: eigen kopje en zonder kopje inbegrepen', o.map((x) => `${x.omschrijving}:${x.categorie}`).join() === 'Laptop:uitvoering,Coördinator:uitvoering,Flyers:uitvoering,Projectleider:,Zaalhuur:eigen:Locatie en huisvesting');
  await opruimen();

  // helemaal zonder kopjes beginnen
  s = await toon(BASIS);
  await klik($('[data-testid="bg-kopje-geen"]'));
  check('Zonder kopje: alleen een rij regels, geen enkel kopje', !!kopje('zonder') && volgorde().join() === 'zonder' && !$('h3'));
  await typ($('[data-testid="bg-omschrijving"]'), 'Alles samen');
  await typ($('[data-testid="bg-bedrag"]'), '900');
  check('en het totaal telt gewoon mee', /Totaal € 900/.test($('[data-testid="bg-totaal"]').textContent));
  await klik(knop('Begroting opslaan'));
  check('bewaard zonder kopje', await wacht(() => s.bewaard.length === 1) && s.bewaard[0].begroting === 900 && s.bewaard[0].budgetRegels[0].categorie === '');
  await opruimen();
}

sectie('8. Schatting, doorklik naar de chat en het voorstel uit de chat');
{
  const R = (id, categorie, omschrijving, extra = {}) => ({ id, categorie, omschrijving, aantal: null, eenheid: '', tarief: null, bedrag: null, soort: 'geld', schatting: false, toelichting: '', bron: 'handmatig', ...extra });

  // De tab: schatting zichtbaar, bevestigen, en zelf een bedrag invullen haalt de markering weg.
  s = await toon({ ...BASIS, begroting: 3500, budgetRegels: [R('a', 'activa', 'Voedselpakketten', { bedrag: 2500, schatting: true, bron: 'ai' }), R('b', 'activa', 'Laptop', { bedrag: 1000 })] });
  check('een regel met een schatting toont het label en onder de regels staat het deel dat nog schatting is', $$('[data-testid="bg-schatting"]').length === 1 && /Waarvan € 2\.500 nog een schatting \(1 regel\)/.test($('[data-testid="bg-schatting-totaal"]').textContent) && /Totaal € 3\.500/.test($('[data-testid="bg-totaal"]').textContent));
  await typ($('[data-testid="bg-bedrag"]', regelMet('Voedselpakketten')), '2.700');
  check('zelf het bedrag aanpassen haalt de schatting weg en het totaal volgt', !$('[data-testid="bg-schatting"]') && !$('[data-testid="bg-schatting-totaal"]') && /Totaal € 3\.700/.test($('[data-testid="bg-totaal"]').textContent));
  await klik(knop('Begroting opslaan'));
  check('opgeslagen zonder schatting', await wacht(() => s.bewaard.length === 1) && s.bewaard[0].budgetRegels.every((r) => r.schatting === false));
  await opruimen();

  s = await toon({ ...BASIS, begroting: 2500, budgetRegels: [R('a', 'activa', 'Voedselpakketten', { bedrag: 2500, schatting: true, bron: 'ai' })] });
  await klik($('[data-testid="bg-schatting"]'));
  check('Klikken op schatting bevestigt het bedrag; het totaal blijft', !$('[data-testid="bg-schatting"]') && /Totaal € 2\.500/.test($('[data-testid="bg-totaal"]').textContent));
  check('de Excel krijgt (schatting) achter een regel die nog schatting is', expenseLinesVoorExcel([R('a', 'activa', 'Voedselpakketten', { bedrag: 2500, schatting: true })])[0].description === 'Voedselpakketten (schatting)');
  check('de knop naar de chat staat in de tab en gaat naar een nieuw gesprek voor dit project met de vaste code', $('[data-testid="bg-chat"]').getAttribute('href') === `#/kompas?project=${PROJECT}&start=begroting`);
  await opruimen();

  // Het adres: alleen een vaste code en een geldig project.
  check('adressen voor de chat: alleen codes uit de lijst en geldige uuid\'s', chatStartHref({ projectId: PROJECT, start: 'begroting' }) === `#/kompas?project=${PROJECT}&start=begroting` && chatStartHref({ projectId: PROJECT, start: '<script>' }) === '#/kompas' && chatStartHref({ projectId: 'x', start: 'begroting' }) === '#/kompas');
  check('de chat leest de code terug, en onbekende codes of andere paden niet; het gewone gespreksadres is ongewijzigd', leesChatStart(`#/kompas?project=${PROJECT}&start=begroting`) === 'begroting' && leesChatStart(`#/kompas?project=${PROJECT}&start=iets`) === null && leesChatStart(`#/kompas/projecten?start=begroting`) === null && JSON.stringify(leesChatUrl(`#/kompas?project=${PROJECT}&start=begroting`)) === JSON.stringify({ conversation: null, project: PROJECT, focus: null }));

  // Het voorstel uit de chat, tegen de echte serverregels met een nagebootst model.
  const CHAT = 'Hier is een voorstel voor uw begroting. Projectleider: 120 uur x 45 euro. Voedselpakketten ongeveer 2.500 euro (schatting). Zaalhuur is gratis van de buurtvereniging. Flyers: bedrag nog onbekend.';
  const toonDialoog = async (project, serverOpties = {}) => {
    const srv = maakServer(serverOpties);
    const bewaard = [];
    let gesloten = 0;
    const store = { saveProject: async (p) => { bewaard.push(p); return PROJECT; } };

    client.__zetSupabase(srv.supabase);
    await act(async () => { root.render(<BegrotingVoorstelDialoog project={project} tekst={CHAT} store={store} onSluit={() => { gesloten += 1; }} />); });

    return { srv, bewaard, gesloten: () => gesloten };
  };

  let d = await toonDialoog({ ...BASIS, naam: 'Samen Spelen', begroting: 0, budgetRegels: [] });
  check('eerst uitleg en bevestiging; er is nog niets naar de server gegaan en het telt als één beoordeling', /telt als één beoordeling/.test($('[data-testid="bv-uitleg"]').textContent) && d.srv.s.aanroepen.length === 0);
  await klik(knop('Maak het voorbeeld van de begroting'));
  check('het voorbeeld verschijnt', await wacht(() => $('[data-testid="bv-voorbeeld"]')));
  const regelsTekst = $$('[data-testid="bv-regel"]').map((r) => r.textContent.replace(/\s+/g, ' '));
  check('drie regels, aantal x tarief is door het scherm uitgerekend (120 x 45 = 5.400), een regel zonder bedrag zegt bedrag volgt', regelsTekst.length === 3 && regelsTekst.some((t) => /Projectleider\s*€ 5\.400/.test(t)) && regelsTekst.some((t) => /Flyers\s*bedrag volgt/.test(t)));
  check('een schatting is herkenbaar en er staat geen in natura bij', $$('[data-testid="bv-schatting"]').length === 1 && regelsTekst.some((t) => /Voedselpakketten\s*schatting\s*€ 2\.500/.test(t)) && !regelsTekst.some((t) => /natura/.test(t)));
  check('totaal 5.400 + 2.500 = 7.900, waarvan 2.500 schatting', /Totaal € 7\.900/.test($('[data-testid="bv-totaal"]').textContent) && /waarvan € 2\.500 nog een schatting/.test($('[data-testid="bv-totaal"]').textContent));
  check('het voorbeeld meldt of de begroting met het dekkingsplan sluit: 7.900 tegen een dekking van 14.000', /€ 6\.100 hoger dan de begroting van € 7\.900/.test($('[data-testid="bv-sluit"]')?.textContent || ''), $('[data-testid="bv-sluit"]')?.textContent);
  check('zonder bestaande begroting geen keuze toevoegen of vervangen; resterende ruimte zichtbaar', !$('[data-testid="bv-toevoegen"]') && /Nog 5 beoordelingen over/.test($('[data-testid="bv-resterend"]').textContent));
  check('de server heeft het voorstel gemeld met de maandruimte (niets bewaard)', d.srv.s.aanroepen.some((a) => a[1] === 'begroting-voorstel') && d.bewaard.length === 0);
  await klik(knop('Zet de regels in mijn begroting'));
  check('opgeslagen via de bestaande opslag: bron ai, schatting bewaard, kopjes en totaal', await wacht(() => d.bewaard.length === 1) && d.bewaard[0].begroting === 7900 && d.bewaard[0].budgetRegels.length === 3 && d.bewaard[0].budgetRegels.every((r) => r.bron === 'ai') && d.bewaard[0].budgetRegels.filter((r) => r.schatting).length === 1);
  check('daarna: bevestiging met link naar de begroting van dit project', await wacht(() => $('[data-testid="bv-klaar"]')) && $('[data-testid="bv-naar-begroting"]').getAttribute('href') === `#/kompas/documentatie?project=${PROJECT}&tab=begroting` && /€ 7\.900/.test($('[data-testid="bv-klaar"]').textContent));
  await opruimen();

  const bestaand = [{ id: 'z1', categorie: 'activa', omschrijving: 'Laptop', aantal: null, eenheid: '', tarief: null, bedrag: 1000, soort: 'geld', schatting: false, toelichting: '', bron: 'handmatig' }];

  d = await toonDialoog({ ...BASIS, naam: 'Samen Spelen', begroting: 1000, budgetRegels: bestaand }, { standRegels: bestaand });
  await klik(knop('Maak het voorbeeld van de begroting'));
  await wacht(() => $('[data-testid="bv-voorbeeld"]'));
  check('de controle volgt de keuze: toevoegen 8.900 (5.100 te veel), vervangen 7.900 (6.100 te veel)', /begroting van € 8\.900/.test($('[data-testid="bv-sluit"]').textContent) && (await klik($('[data-testid="bv-vervangen"]')), /begroting van € 7\.900/.test($('[data-testid="bv-sluit"]').textContent)));
  await klik($('[data-testid="bv-toevoegen"]'));
  check('met een bestaande begroting kiest het lid: toevoegen (standaard) of vervangen', $('[data-testid="bv-toevoegen"]').checked === true && !!$('[data-testid="bv-vervangen"]'));
  await klik(knop('Zet de regels in mijn begroting'));
  check('toevoegen: de laptop blijft en het voorstel komt erbij (4 regels, totaal 8.900)', await wacht(() => d.bewaard.length === 1) && d.bewaard[0].budgetRegels.length === 4 && d.bewaard[0].budgetRegels.some((r) => r.omschrijving === 'Laptop' && r.bron === 'handmatig') && d.bewaard[0].begroting === 8900);
  await opruimen();

  d = await toonDialoog({ ...BASIS, naam: 'Samen Spelen', begroting: 1000, budgetRegels: bestaand }, { standRegels: bestaand });
  await klik(knop('Maak het voorbeeld van de begroting'));
  await wacht(() => $('[data-testid="bv-voorbeeld"]'));
  await klik($('[data-testid="bv-vervangen"]'));
  await klik(knop('Zet de regels in mijn begroting'));
  check('vervangen: alleen het voorstel (3 regels), de laptop is weg', await wacht(() => d.bewaard.length === 1) && d.bewaard[0].budgetRegels.length === 3 && !d.bewaard[0].budgetRegels.some((r) => r.omschrijving === 'Laptop'));
  await opruimen();

  d = await toonDialoog({ ...BASIS, naam: 'Samen Spelen', budgetRegels: [] }, {});
  for (let i = 0; i < 6; i += 1) d.srv.s.beoordelingen.set(`b${i}`, { id: `b${i}` });
  await klik(knop('Maak het voorbeeld van de begroting'));
  check('maand op: duidelijke melding, terug naar het begin, niets bewaard', await wacht(() => $('[data-testid="bv-fout"]')) && /deze maand al 6/.test($('[data-testid="bv-fout"]').textContent) && !!knop('Maak het voorbeeld van de begroting') && d.bewaard.length === 0);
  await opruimen();
}

sectie('9. Een begroting uploaden (Excel): direct opgeslagen met label, afwijkingen gemeld, ongedaan maken');
{
  const { default: ExcelJS } = await import('exceljs');
  const R = (id, categorie, omschrijving, extra = {}) => ({ id, categorie, omschrijving, aantal: null, eenheid: '', tarief: null, bedrag: null, soort: 'geld', schatting: false, toelichting: '', bron: 'handmatig', ...extra });

  const wb = new ExcelJS.Workbook();
  const blad = wb.addWorksheet('Begroting 2027');

  [['Begroting 2027'], ['Uitvoering'], ['Projectleider', 100, 'uur', 50, 5000], ['Training vrijwilligers', 2000], ['Activa'], ['Materiaal', 10, 'stuk', 25, 300], ['Totaal', 9000]].forEach((r) => blad.addRow(r));
  blad.addRow(['Formule', { formula: 'A1', result: 42 }]);
  wb.addWorksheet('Verborgen').state = 'hidden';
  wb.getWorksheet('Verborgen').addRow(['Geheim blad dat niet meegaat', 1]);

  const buffer = await wb.xlsx.writeBuffer();
  const bestand = (naam = 'begroting.xlsx', inhoud = buffer) => ({ name: naam, size: inhoud.byteLength ?? 10, arrayBuffer: async () => inhoud });
  const kiesBestand = async (f) => {
    const input = $('[data-testid="bg-upload-bestand"]');

    Object.defineProperty(input, 'files', { value: [f], configurable: true });
    await act(async () => { input.dispatchEvent(new window.Event('change', { bubbles: true })); });
  };
  const toonUpload = async (project, serverOpties = {}) => {
    const srv = maakServer(serverOpties);
    const bewaard = [];
    const store = { orgProfile: { name: 'Stichting Samen Spelen' }, saveProject: async (p) => { bewaard.push(p); return PROJECT; } };

    client.__reset();
    client.__zetSupabase({ ...srv.supabase, rpc: async () => ({ data: FUNDING, error: null }) });
    await act(async () => { root.render(<BegrotingTab project={project} projecten={[project]} onKiesProject={() => {}} store={store} />); });
    await wacht(() => $('[data-testid="bg-tab"]'));

    return { srv, bewaard };
  };

  let u = await toonUpload({ ...BASIS, begroting: 0, budgetRegels: [] });
  check('de uploadknop staat er, zonder extra uitleg eronder', !!$('[data-testid="bg-upload-knop"]') && !/meldt wat niet klopt/.test(tekst()) && u.srv.s.aanroepen.length === 0);
  await kiesBestand(bestand());
  check('na het kiezen staat het resultaat er, direct opgeslagen (geen tussenstap)', await wacht(() => $('[data-testid="bg-upload-resultaat"]')) && u.bewaard.length === 1);
  check('de tekst die naar de server ging houdt rijen en cellen (" | "), formules als uitkomst, geen verborgen blad', /Projectleider \| 100 \| uur \| 50 \| 5000\nTraining vrijwilligers \| 2000/.test(u.srv.s.laatsteUpload || '') && /Formule \| 42/.test(u.srv.s.laatsteUpload) && !/Geheim blad/.test(u.srv.s.laatsteUpload));
  check('vier regels, in de opslag bron upload met de bestandsnaam, en geen "uit upload" meer bij elke regel', $$('[data-testid="bg-regel"]').length === 4 && !$('[data-testid="bg-upload-label"]') && !/uit upload/.test($('[data-testid="bg-tab"]').textContent) && u.bewaard[0].budgetRegels.length === 4 && u.bewaard[0].budgetRegels.every((r) => r.bron === 'upload' && r.bronNaam === 'begroting.xlsx'), JSON.stringify(u.bewaard[0].budgetRegels.map((r) => r.bronNaam)));
  check('elke regel uit de upload heeft een stipje bij het bedrag; de pop-up staat dicht', $$('[data-testid="bg-herkomst-stip"]').length === 4 && !$('[data-testid="bg-herkomst"]'));
  const cel = $$('[data-testid="bg-bedragcel"]')[0];
  await act(async () => { cel.dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true })); });
  const pop = $('[data-testid="bg-herkomst"]');
  const rijLabels = pop ? Array.from(pop.querySelectorAll('dt')).map((x) => x.textContent) : [];
  check('muis over het bedrag: pop-up met rijen Herkomst en Berekening, in vaste volgorde', !!pop && rijLabels[0] === 'Herkomst' && rijLabels[1] === 'Berekening' && /Geüpload bestand: begroting\.xlsx/.test(pop.textContent) && /100 uur × € 50 = € 5\.000/.test(pop.textContent), pop?.textContent);
  await act(async () => { cel.dispatchEvent(new window.MouseEvent('mouseout', { bubbles: true })); });
  check('muis weg: pop-up dicht', !$('[data-testid="bg-herkomst"]'));
  await act(async () => { cel.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
  await klik($$('[data-testid="bg-herkomst-stip"]')[0]);
  check('tikken op het stipje houdt de pop-up open (voor touch), tikken nogmaals sluit', !!$('[data-testid="bg-herkomst"]'));
  await klik($$('[data-testid="bg-herkomst-stip"]')[0]);
  check('nogmaals tikken sluit', !$('[data-testid="bg-herkomst"]'));
  check('het projecttotaal volgt: 5.000 + 2.000 + 300 = 7.300', u.bewaard[0].begroting === 7300 && /Totaal € 7\.300/.test($('[data-testid="bg-totaal"]').textContent));
  const meld = $$('[data-testid="bg-upload-waarschuwing"]').map((x) => x.textContent);
  check('afwijkingen staan er: regel die niet klopt, subtotaal, totaal en regel zonder bedrag', meld.length === 4 && meld.some((m) => /aantal × tarief is € 250/.test(m)) && meld.some((m) => /subtotaal van “Activa”/.test(m)) && meld.some((m) => /totaal in het bestand is € 9\.000/.test(m)) && meld.some((m) => /geen bedrag/.test(m)));
  check('de regel die niet klopt houdt het bedrag uit het bestand en een Let op', u.bewaard[0].budgetRegels.find((r) => r.omschrijving === 'Materiaal').bedrag === 300 && /Let op/.test(u.bewaard[0].budgetRegels.find((r) => r.omschrijving === 'Materiaal').toelichting));
  check('resterende ruimte: nog 5 van 6', /Nog 5 beoordelingen over/.test($('[data-testid="bg-upload-resterend"]').textContent));
  check('de server heeft het bestand gemeld als begroting-upload', u.srv.s.aanroepen.some((a) => a[1] === 'begroting-upload'));
  check('het groene blok meldt ook of de begroting met het dekkingsplan sluit (de server vergeleek 7.300 met de dekking)', !!$('[data-testid="bg-upload-sluit"]') && /Begroting en dekkingsplan/.test($('[data-testid="bg-upload-sluit"]').textContent) && /€ 7\.300/.test($('[data-testid="bg-upload-sluit"]').textContent), $('[data-testid="bg-upload-sluit"]')?.textContent);

  await klik(knop('Upload ongedaan maken'));
  check('ongedaan maken: de vorige (lege) stand wordt weer opgeslagen en de regels zijn weg', await wacht(() => u.bewaard.length === 2) && u.bewaard[1].budgetRegels.length === 0 && $$('[data-testid="bg-regel"]').length === 0 && !$('[data-testid="bg-upload-resultaat"]'));
  await opruimen();

  // Met een bestaande begroting wordt toegevoegd en blijft wat er stond.
  u = await toonUpload({ ...BASIS, begroting: 1000, budgetRegels: [R('z1', 'activa', 'Laptop', { bedrag: 1000 })] });
  await kiesBestand(bestand());
  await wacht(() => $('[data-testid="bg-upload-resultaat"]'));
  check('toegevoegd aan wat er stond: laptop blijft (5 regels), totaal 8.300, alleen de nieuwe hebben een stipje (de laptop zelf getypt, dus geen pop-up)', u.bewaard[0].budgetRegels.length === 5 && u.bewaard[0].budgetRegels.some((r) => r.omschrijving === 'Laptop' && r.bron === 'handmatig' && r.bronNaam === '') && u.bewaard[0].begroting === 8300 && $$('[data-testid="bg-herkomst-stip"]').length === 4 && $$('[data-testid="bg-regel"]').length === 5);
  await klik(knop('Upload ongedaan maken'));
  check('ongedaan maken zet de laptop-stand en de oude projectbegroting terug', await wacht(() => u.bewaard.length === 2) && u.bewaard[1].budgetRegels.length === 1 && u.bewaard[1].begroting === 1000);
  await opruimen();

  // Fouten
  u = await toonUpload({ ...BASIS, budgetRegels: [] });
  await kiesBestand(bestand('begroting.pdf'));
  check('een pdf wordt vriendelijk geweigerd, zonder servercontact', /Excel-bestand \(\.xlsx\) of een Word-bestand/.test($('[data-testid="bg-fout"]')?.textContent || '') && u.srv.s.aanroepen.length === 0 && u.bewaard.length === 0);
  await kiesBestand(bestand('oud.xls'));
  check('een oud .xls zegt: opslaan als .xlsx', /ouder bestandstype/.test($('[data-testid="bg-fout"]')?.textContent || ''));
  await kiesBestand(bestand('kapot.xlsx', new ArrayBuffer(20)));
  check('een kapot bestand geeft een duidelijke melding, niets bewaard', await wacht(() => /kon niet worden gelezen/.test($('[data-testid="bg-fout"]')?.textContent || '')) && u.bewaard.length === 0);
  await kiesBestand({ name: 'groot.xlsx', size: 6 * 1024 * 1024, arrayBuffer: async () => buffer });
  check('een te groot bestand wordt geweigerd', /te groot \(maximaal 5 MB\)/.test($('[data-testid="bg-fout"]')?.textContent || ''));
  await opruimen();

  u = await toonUpload({ ...BASIS, budgetRegels: [] });
  for (let i = 0; i < 6; i += 1) u.srv.s.beoordelingen.set(`b${i}`, { id: `b${i}` });
  await kiesBestand(bestand());
  check('maand op: duidelijke melding, niets bewaard, knop weer beschikbaar', await wacht(() => /deze maand al 6/.test($('[data-testid="bg-fout"]')?.textContent || '')) && u.bewaard.length === 0 && !$('[data-testid="bg-upload-knop"]').disabled);
  await opruimen();
}

sectie('9b. Een Word-bestand lezen: tabellen blijven rijen');
{
  const { Document, Packer, Paragraph, Table, TableRow, TableCell } = await import('docx');
  const cel = (x) => new TableCell({ children: [new Paragraph(String(x))] });
  const doc = new Document({ sections: [{ children: [
    new Paragraph('Begroting Samen Spelen 2027'),
    new Table({ rows: [['Post', 'Aantal', 'Tarief', 'Bedrag'], ['Projectleider', '100 uur', '50', '5.000'], ['Materiaal', '10', '25', '250']].map((r) => new TableRow({ children: r.map(cel) })) }),
    new Paragraph('Totaal 5.250'),
  ] }] });
  const buf = await Packer.toBuffer(doc);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const res = await leesBegrotingBestand({ name: 'begroting.docx', size: ab.byteLength, arrayBuffer: async () => ab });

  check('een Word-bestand wordt gelezen; elke tabelrij is één regel met " | " tussen de cellen', res.ok && /Begroting Samen Spelen 2027\nPost \| Aantal \| Tarief \| Bedrag\nProjectleider \| 100 uur \| 50 \| 5\.000\nMateriaal \| 10 \| 25 \| 250\nTotaal 5\.250/.test(res.tekst), JSON.stringify(res).slice(0, 300));
  const leeg = await leesBegrotingBestand({ name: 'leeg.docx', size: 10, arrayBuffer: async () => ab.slice(0, 10) });
  check('een kapot Word-bestand geeft een melding, geen fout', leeg.ok === false && /kon niet worden gelezen/.test(leeg.melding));
}

sectie('10. Opslaan en dan zelf de volgende subcategorie kiezen');
{
  s = await toon({ ...BASIS, begroting: 0, budgetRegels: [] });
  await klik($('[data-testid="bg-kopje-kies-uitvoering"]'));
  await klik($$('[data-testid="bg-suggestie"]').find((b) => /Projectleider/.test(b.textContent)));
  await typ($('[data-testid="bg-bedrag"]'), '5000');
  await klik($('[data-testid="bg-volgende-kop"]'));
  check('Opslaan en volgende subcategorie slaat op en toont daarna de keuze, zonder zelf een subcategorie te kiezen', await wacht(() => s.bewaard.length === 1) && !!(await wacht(() => $('[data-testid="bg-volgende-keuze"]'))) && !kopje('activa') && !$('[data-testid="bg-volgende-kop"]'));
  check('de keuze toont de nog niet gebruikte subcategorieën en een + voor een eigen subcategorie', ['activa', 'communicatie', 'organisatie'].every((k) => !!$(`[data-testid="bg-volgende-kies-${k}"]`)) && !$('[data-testid="bg-volgende-kies-uitvoering"]') && !!$('[data-testid="bg-volgende-eigen"]'));
  await klik($('[data-testid="bg-volgende-kies-communicatie"]'));
  check('de gekozen subcategorie komt erbij met de suggesties open en de keuze verdwijnt', !!kopje('communicatie') && !!$('[data-testid="bg-suggesties-communicatie"]') && !$('[data-testid="bg-volgende-keuze"]'));
  await opruimen();
  s = await toon({ ...BASIS, begroting: 0, budgetRegels: [] });
  await klik($('[data-testid="bg-kopje-kies-uitvoering"]'));
  await klik($$('[data-testid="bg-suggestie"]').find((b) => /Projectleider/.test(b.textContent)));
  await typ($('[data-testid="bg-bedrag"]'), '5000');
  await klik($('[data-testid="bg-volgende-kop"]'));
  await wacht(() => $('[data-testid="bg-volgende-keuze"]'));
  check('je kunt ook zonder subcategorie door: een budgetregel zonder subcategorie komt er los bij', /Budgetregel zonder subcategorie/.test($('[data-testid="bg-volgende-geen"]').textContent));
  await klik($('[data-testid="bg-volgende-geen"]'));
  check('die regel staat los (zonder kopregel) en de keuze is weg', !!kopje('zonder') && !$('[data-testid="bg-kop-zonder"]') && !$('[data-testid="bg-volgende-keuze"]'));
}

console.log(`\nbegroting-schermen: ${stand.ok} OK, ${stand.fout} FAIL`);
process.exit(stand.fout ? 1 : 0);
