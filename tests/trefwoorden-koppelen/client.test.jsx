// Slimme herkenning, clientkant: eigen woorden ("Overig"), de knop "Laat Claude meedenken", voorstellen kiezen, opslag en service.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
const g = globalThis;
g.window = dom.window; g.document = dom.window.document; g.localStorage = dom.window.localStorage;
Object.defineProperty(g, 'navigator', { value: dom.window.navigator, configurable: true });
g.HTMLElement = dom.window.HTMLElement; g.Event = dom.window.Event; g.MouseEvent = dom.window.MouseEvent; g.KeyboardEvent = dom.window.KeyboardEvent;
g.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import('react')).default;
const { act, useState } = await import('react');
const { createRoot } = await import('react-dom/client');
const client = await import('../checkout-frontend/fake-client.js');
const E = await import('../../src/features/kompas-app/projectinformatie/eigenTermen.js');
const S = await import('../../src/data/services/trefwoorden.js');
const { naarKolomPatch } = await import('../../src/data/services/projecten.js');
const { default: SlimmeHerkenning } = await import('../../src/features/kompas-app/projectinformatie/SlimmeHerkenning.jsx');
const { default: NieuwProjectFormulier } = await import('../../src/features/kompas-app/NieuwProjectFormulier.jsx');

const stand = { ok: 0, fout: 0 };
const check = (naam, waar, detail = '') => { if (waar) stand.ok += 1; else { stand.fout += 1; console.log(`  FAIL: ${naam} ${detail}`); } };
const sectie = (t) => console.log(`\n== ${t}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const q = (id) => document.querySelector(`[data-testid="${id}"]`);
const qa = (id) => Array.from(document.querySelectorAll(`[data-testid="${id}"]`));
const klik = async (el) => { await act(async () => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); }); await sleep(5); };
const typ = async (el, waarde) => {
  await act(async () => {
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(el, waarde);
    el.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
};
const enter = async (el) => { await act(async () => { el.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); }); await sleep(5); };

const OMSCHRIJVING = 'Naschoolse drumlessen voor kinderen in de wijk, begeleid door oudere vrijwilligers.';

// Een stateful kapstok die zich gedraagt als de projectpagina (setVeld met functionele update).
let huidigForm = null;
const aanroepen = [];
function Kapstok({ start, onDenk }) {
  const [form, setForm] = useState(start);
  huidigForm = form;
  const setVeld = (k, v) => setForm((cur) => ({ ...cur, [k]: v }));

  return <SlimmeHerkenning form={form} setVeld={setVeld} onDenk={onDenk} />;
}
async function toon(start, onDenk) {
  document.body.innerHTML = '<div id="root"></div>';
  const root = createRoot(document.getElementById('root'));
  await act(async () => { root.render(<Kapstok start={start} onDenk={onDenk} />); });

  return root;
}
const denker = (antwoord) => async (inv) => { aanroepen.push(inv); return antwoord; };

// ---------------------------------------------------------------------------------------------------------------------------
sectie('1. Eigen woorden: zuivere functies');
{
  const l = E.voegWoordenToe([], 'drummen, ritme;  Drummen');
  check('woorden toevoegen met komma, dubbelen (hoofdletters) vallen af', l.map((x) => x.woord).join() === 'drummen,ritme');
  check('nieuw woord heeft geen koppelingen', l.every((x) => x.koppelingen.length === 0) && E.zonderKoppeling(l).length === 2);
  const m = E.legKoppeling(l, 'Drummen', 'discipline', 'Muziek');
  check('koppeling vastleggen (hoofdletterongevoelig); andere woorden blijven', m[0].koppelingen[0].naam === 'Muziek' && m[1].koppelingen.length === 0 && E.zonderKoppeling(m).length === 1);
  check('dezelfde koppeling twee keer = één keer; onbekende categorie wordt genegeerd', E.legKoppeling(m, 'drummen', 'discipline', 'Muziek')[0].koppelingen.length === 1 && E.legKoppeling(m, 'drummen', 'budget', 'x')[0].koppelingen.length === 1);
  check('verwijderen', E.verwijderWoord(m, 'DRUMMEN').map((x) => x.woord).join() === 'ritme');
  check('maximaal 12 woorden en te lange woorden vallen af', E.voegWoordenToe([], Array.from({ length: 20 }, (_, i) => `woord ${i}`).join(',')).length === 12 && E.voegWoordenToe([], 'x'.repeat(80)).length === 0);
  check('lezen uit de database: rommel valt af, koppelingen blijven', JSON.stringify(E.leesEigenTermen([{ woord: 'drums', koppelingen: [{ categorie: 'discipline', naam: 'Muziek' }, { categorie: 'raar', naam: 'x' }] }, null, 5, { woord: '' }])) === JSON.stringify([{ woord: 'drums', koppelingen: [{ categorie: 'discipline', naam: 'Muziek' }] }]));
  check('lezen: geen array geeft een lege lijst', E.leesEigenTermen(null).length === 0 && E.leesEigenTermen('x').length === 0);
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('2. Opslag in het project');
{
  const basis = { naam: 'Drumproject', regio: 'Rotterdam', doelgroep: [], discipline: [], begroting: 1000, eigenBijdrage: 0 };
  const p = naarKolomPatch({ ...basis, eigenTermen: [{ woord: 'drummen', koppelingen: [{ categorie: 'discipline', naam: 'Muziek' }] }] });
  check('eigen woorden gaan naar eigen_termen, de gekozen waarden naar themes', Array.isArray(p.eigen_termen) && p.eigen_termen[0].woord === 'drummen' && p.eigen_termen[0].koppelingen[0].naam === 'Muziek');
  check('zonder eigenTermen (kolom bestaat niet) wordt er niets geschreven', !('eigen_termen' in naarKolomPatch(basis)));
  check('lege lijst (woorden verwijderd) maakt de kolom leeg', Array.isArray(naarKolomPatch({ ...basis, eigenTermen: [] }).eigen_termen) && naarKolomPatch({ ...basis, eigenTermen: [] }).eigen_termen.length === 0);
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('3. Service: alleen lezen, nooit een fout naar het formulier');
{
  client.__reset();
  client.__zetSupabase(client.maakClient(() => ({ data: { ok: true, beschikbaar: true, voorstellen: [{ categorie: 'discipline', naam: 'Muziek', bewijs: 'drummen', eigenWoord: 'drummen' }], nietGekoppeld: [] }, error: null })));
  const r = await S.haalTrefwoordVoorstellen({ tekst: OMSCHRIJVING, eigenTermen: [{ woord: 'drummen', koppelingen: [] }], gekozen: { discipline: [], doelgroep: [], regio: [] } });
  const body = client.log.invoke[0]?.opties.body;

  check('stuurt modus trefwoorden-koppelen met tekst, eigen woorden (alleen de woorden) en wat al gekozen is', body?.mode === 'trefwoorden-koppelen' && body.tekst === OMSCHRIJVING && body.eigenTermen.join() === 'drummen' && body.gekozen && client.log.invoke[0].naam === 'subsidie-kompas');
  check('antwoord met voorstellen komt door', r.ok && r.beschikbaar && r.voorstellen.length === 1 && r.reden === null);

  client.__zetSupabase(client.maakClient(() => ({ data: { ok: true, beschikbaar: false, reden: 'daglimiet', voorstellen: [], nietGekoppeld: ['drummen'] }, error: null })));
  const d = await S.haalTrefwoordVoorstellen({ tekst: OMSCHRIJVING, eigenTermen: ['drummen'], gekozen: {} });
  check('daglimiet wordt als reden doorgegeven', d.beschikbaar === false && d.reden === 'daglimiet');

  client.__zetSupabase(client.maakClient(() => ({ data: null, error: { message: 'boem' } })));
  const f = await S.haalTrefwoordVoorstellen({ tekst: OMSCHRIJVING, eigenTermen: ['drummen'], gekozen: {} });
  check('fout van de dienst: geen voorstellen, niet beschikbaar, eigen woorden behouden', f.ok === false && f.beschikbaar === false && f.voorstellen.length === 0 && f.nietGekoppeld.join() === 'drummen');

  client.__zetSupabase(client.maakClient(() => { throw new Error('netwerk'); }));
  const n = await S.haalTrefwoordVoorstellen({ tekst: OMSCHRIJVING, eigenTermen: [], gekozen: {} });
  check('uitzondering wordt opgevangen', n.ok === false && n.voorstellen.length === 0);
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('4. Scherm: eigen woorden toevoegen en laten staan');
{
  await toon({ naam: 'Drumproject', omschrijving: OMSCHRIJVING, discipline: [], doelgroep: [], regio: '' }, denker({ beschikbaar: true, voorstellen: [], reden: null }));
  check('de knop en het Overig-veld staan er', !!q('np-denk-mee') && !!q('np-overig-invoer') && !q('np-overig-lijst'));
  await typ(q('np-overig-invoer'), 'drummen, buurtwerk');
  await klik(q('np-overig-toevoegen'));
  check('twee woorden staan zichtbaar bij het project, veld is leeg', qa('np-overig-woord').length === 2 && q('np-overig-invoer').value === '' && huidigForm.eigenTermen.length === 2);
  check('ze zijn nog niet gekoppeld en zeggen dat ze blijven staan', qa('np-overig-woord')[0].textContent.includes('blijft bij uw project staan'));
  await typ(q('np-overig-invoer'), 'ritme');
  await enter(q('np-overig-invoer'));
  check('Enter voegt toe (en verstuurt het formulier niet)', qa('np-overig-woord').length === 3);
  await klik(qa('np-overig-verwijder')[2]);
  check('woord verwijderen', qa('np-overig-woord').length === 2);
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('5. Scherm: Claude laten meedenken, voorstel kiezen');
{
  aanroepen.length = 0;
  const voorstellen = [
    { categorie: 'discipline', naam: 'Muziek', bewijs: 'drummen', eigenWoord: 'drummen' },
    { categorie: 'doelgroep', naam: 'Kinderen', bewijs: 'Naschoolse drumlessen voor kinderen', eigenWoord: null },
    { categorie: 'regio', naam: 'Rotterdam', bewijs: 'in Rotterdam', eigenWoord: null },
  ];
  await toon({ naam: 'Drumproject', omschrijving: OMSCHRIJVING, eigenTermen: [{ woord: 'drummen', koppelingen: [] }, { woord: 'buurtwerk', koppelingen: [] }], discipline: [], doelgroep: [], regio: 'Amsterdam' }, denker({ beschikbaar: true, voorstellen, reden: null }));
  check('er is nog niets voorgesteld voordat het lid op de knop drukt (nooit automatisch)', aanroepen.length === 0 && !q('np-denk-voorstellen'));
  await klik(q('np-denk-mee'));
  check('na de klik: één aanroep met omschrijving, eigen woorden en wat al gekozen is', aanroepen.length === 1 && aanroepen[0].tekst.includes('drumlessen') && aanroepen[0].eigenTermen.length === 2 && aanroepen[0].gekozen.regio.join() === 'Amsterdam');
  check('drie voorstellen met uitleg waarom', qa('np-denk-kies').length === 3 && q('np-denk-voorstellen').textContent.includes('Uw woord "drummen" hoort hierbij') && q('np-denk-voorstellen').textContent.includes('Uit uw tekst: "Naschoolse drumlessen voor kinderen"'));
  check('niets is toegepast voordat het lid kiest', huidigForm.discipline.length === 0 && huidigForm.doelgroep.length === 0 && huidigForm.regio === 'Amsterdam');

  await klik(qa('np-denk-kies').find((b) => b.dataset.naam === 'Muziek'));
  check('Muziek gekozen: discipline gezet en het eigen woord is gekoppeld, voorstel verdwijnt', huidigForm.discipline.join() === 'Muziek' && huidigForm.eigenTermen[0].koppelingen[0].naam === 'Muziek' && qa('np-denk-kies').length === 2);
  check('het eigen woord blijft zichtbaar, nu met koppeling', qa('np-overig-woord')[0].textContent.includes('→ Muziek') && qa('np-overig-woord')[1].textContent.includes('blijft bij uw project staan'));

  await klik(qa('np-denk-kies').find((b) => b.dataset.naam === 'Rotterdam'));
  check('werkgebied wordt toegevoegd aan wat er stond (Amsterdam blijft)', /Amsterdam/.test(huidigForm.regio) && /Rotterdam/.test(huidigForm.regio));

  await klik(qa('np-denk-negeer')[0]);
  check('een voorstel kan worden weggeklikt zonder iets te kiezen', qa('np-denk-kies').length === 0 && huidigForm.doelgroep.length === 0);
  check('als alles is afgehandeld staat er een rustige melding', !!q('np-denk-niets'));
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('6. Scherm: uitval en grenzen');
{
  await toon({ naam: 'x', omschrijving: 'kort', discipline: [], doelgroep: [], regio: '' }, denker({ beschikbaar: true, voorstellen: [], reden: null }));
  check('te weinig tekst en geen woorden: knop is uit', q('np-denk-mee').disabled === true);
  await typ(q('np-overig-invoer'), 'drummen');
  await klik(q('np-overig-toevoegen'));
  check('met een eigen woord kan Claude wel meedenken', q('np-denk-mee').disabled === false);

  await toon({ naam: 'x', omschrijving: OMSCHRIJVING, eigenTermen: [{ woord: 'drummen', koppelingen: [] }], discipline: [], doelgroep: [], regio: '' }, denker({ beschikbaar: false, voorstellen: [], reden: 'daglimiet' }));
  await klik(q('np-denk-mee'));
  check('daglimiet: nette melding, eigen woord blijft staan', q('np-denk-melding').textContent.includes('vandaag al veel') && qa('np-overig-woord').length === 1);

  await toon({ naam: 'x', omschrijving: OMSCHRIJVING, discipline: [], doelgroep: [], regio: '' }, denker({ beschikbaar: false, voorstellen: [], reden: 'storing' }));
  await klik(q('np-denk-mee'));
  check('storing: nette melding', q('np-denk-melding').textContent.includes('even niet meedenken'));

  await toon({ naam: 'x', omschrijving: OMSCHRIJVING, discipline: ['Muziek'], doelgroep: [], regio: '' }, denker({ beschikbaar: true, reden: null, voorstellen: [{ categorie: 'discipline', naam: 'Muziek', bewijs: 'drumlessen', eigenWoord: null }] }));
  await klik(q('np-denk-mee'));
  check('wat het lid al koos wordt niet nogmaals getoond', qa('np-denk-kies').length === 0 && !!q('np-denk-niets'));
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('7. In het echte projectformulier');
{
  document.body.innerHTML = '<div id="root"></div>';
  const root = createRoot(document.getElementById('root'));
  const velden = { naam: 'Drumproject', omschrijving: OMSCHRIJVING, doelgroep: [], discipline: [], regio: '' };
  await act(async () => { root.render(<NieuwProjectFormulier form={velden} setVeld={() => {}} doelgroepen={['Kinderen']} themas={['Muziek']} regios={['Rotterdam']} onOpslaan={() => {}} onAnnuleer={() => {}} />); });
  check('het blok staat onder de projectomschrijving', !!q('np-slim') && !!q('np-denk-mee') && q('np-omschrijving').compareDocumentPosition(q('np-slim')) & window.Node.DOCUMENT_POSITION_FOLLOWING);
  check('de bestaande lokale herkenning blijft werken', !!q('np-voorstel-doelgroep'));
}

console.log(`\nTREFWOORDEN-KOPPELEN CLIENT: ${stand.ok} OK, ${stand.fout} FOUT`);
process.exit(stand.fout ? 1 : 0);
