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
const PF = await import('../../src/data/services/projectFinanciering.js');
const VG = await import('../../src/data/services/voorstelGenereren.js');
const fm = await import('../../src/features/kompas-app/chat/fondsMatches.js');
const { default: FondsMatchKaart } = await import('../../src/features/kompas-app/chat/FondsMatchKaart.jsx');

const stand = { ok: 0, fout: 0 };
const check = (naam, waar, detail = '') => { if (waar) stand.ok += 1; else { stand.fout += 1; console.log(`  FAIL: ${naam} ${detail}`); } };
const sectie = (t) => console.log(`\n== ${t}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const wortel = createRoot(document.getElementById('root'));
const q = (sel) => document.querySelector(sel);
const qa = (sel) => [...document.querySelectorAll(sel)];
const toon = async (el) => { await act(async () => { wortel.render(el); }); };
const weg = async () => { await act(async () => { wortel.render(null); }); };
const klik = async (el) => { await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); await sleep(20); }); };

const U = (n) => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const PID = U(1);
const projecten = [{ id: PID, naam: 'Hushu House', gearchiveerd: false }];
const ruw = {
  intentie: 'advies',
  projectId: PID,
  items: [
    { type: 'regeling', id: U(3), naam: 'Projectsubsidie cultuur', funder: 'Gemeente Amsterdam', deadline: '2026-12-01', waarom: ['a'], staatAl: false },
    { type: 'fonds', id: U(4), naam: 'Fonds Vier', funder: '', deadline: null, waarom: [], staatAl: false },
    { type: 'online', id: 'online-3', naam: 'Buurtfonds Noord', funder: 'Stichting Noord', deadline: '2027-01-15', waarom: [], staatAl: false, url: 'https://noord.example/buurtfonds' },
  ],
};

sectie('1. Validatie van online items');
{
  const l = fm.leesFondsMatches({ ...ruw, items: [...ruw.items, { type: 'online', id: 'x', naam: 'Fout id' }, { type: 'online', id: 'online-9', naam: 'Http', url: 'http://onveilig.example' }] });
  check('online item met geldig id blijft, met https-url', l.items.length === 4 && l.items[2].type === 'online' && l.items[2].url === 'https://noord.example/buurtfonds');
  check('online item met ongeldig id valt weg; http-url wordt null', !l.items.some((i) => i.naam === 'Fout id') && l.items[3].url === null);
}

sectie('2. Per fonds kiezen: Toevoegen, Niet, Toon weer');
{
  PF.__reset();
  VG.opslagLog.length = 0;
  let gewijzigd = 0;
  const bespreek = [];
  const lijst = fm.leesFondsMatches(ruw);

  await toon(<FondsMatchKaart lijst={lijst} berichtId="k1" projectNaam="Hushu House" projecten={projecten} onGewijzigd={() => { gewijzigd += 1; }} onBespreek={(x) => bespreek.push(x)} />);
  check('kaart met drie fondsen en de vraag welke toe te voegen', qa('[data-testid="fm-item"]').length === 3 && /Welke wilt u toevoegen/.test(q('[data-testid="fm-kaart"]').textContent));
  check('nog geen actieplan-vraag vóór er iets is toegevoegd', !q('[data-testid="fm-actievraag"]'));

  await klik(qa('[data-testid="fm-toevoegen"]')[0]);
  check('regeling direct in het dekkingsplan (scheme_id, geen bedrag, status interesting)', PF.staat.regels.length === 1 && PF.staat.regels[0].scheme_id === U(3) && PF.staat.log[0].requested === null && PF.staat.log[0].status === 'interesting');
  check('item gemarkeerd als toegevoegd, knoppen weg, dekkingsplan ververst', qa('[data-testid="fm-item"]')[0].dataset.status === 'toegevoegd' && qa('[data-testid="fm-item"]')[0].querySelector('[data-testid="fm-toevoegen"]') === null && gewijzigd === 1);
  check('nu pas de vraag over het actieplan', !!q('[data-testid="fm-actievraag"]') && /voor dit fonds acties in het actieplan/.test(q('[data-testid="fm-actievraag"]').textContent));

  await klik(qa('[data-testid="fm-niet"]')[0]);
  check('"Niet": fonds uit beeld, niets opgeslagen', qa('[data-testid="fm-item"]').length === 2 && PF.staat.regels.length === 1 && /1 fonds niet toegevoegd/.test(q('[data-testid="fm-overgeslagen"]').textContent));
  await klik(q('[data-testid="fm-toon-weer"]'));
  check('"Toon weer" zet het terug', qa('[data-testid="fm-item"]').length === 3 && !q('[data-testid="fm-overgeslagen"]'));

  const online = qa('[data-testid="fm-item"]').find((li) => li.dataset.type === 'online');
  await klik(online.querySelector('[data-testid="fm-toevoegen"]'));
  const naamRegel = PF.staat.log.find((x) => x.soort === 'naam');
  check('online fonds op naam toegevoegd: "Gever - Regeling", status interesting, deadline en bron als notitie', naamRegel && naamRegel.naam === 'Stichting Noord - Buurtfonds Noord' && naamRegel.status === 'interesting' && naamRegel.deadline === '2027-01-15' && naamRegel.notitie === 'Bron: https://noord.example/buurtfonds' && naamRegel.bedrag === null);
  check('actieplan-vraag telt nu twee fondsen', /voor deze 2 fondsen/.test(q('[data-testid="fm-actievraag"]').textContent));

  await klik(q('[data-testid="fm-acties-ja"]'));
  const call = VG.opslagLog[0];
  check('acties via de server-opslag, modus alleen acties, met regeling en online fonds', call && call.alleenActies === true && call.projectId === PID && JSON.stringify(call.regels) === JSON.stringify([{ type: 'regeling', id: U(3), bedrag: null }]) && JSON.stringify(call.suggesties) === JSON.stringify([{ gever: 'Stichting Noord', naam: 'Buurtfonds Noord', url: 'https://noord.example/buurtfonds' }]), JSON.stringify(call));
  check('uitkomst gemeld met link naar het actieplan; vraag verdwenen', /4 acties toegevoegd aan het actieplan/.test(q('[data-testid="fm-actie-uitkomst"]').textContent) && /kompas\/deadlines\?project=/.test(q('[data-testid="fm-open-actieplan"]').getAttribute('href')) && !q('[data-testid="fm-actievraag"]'));

  const fonds = qa('[data-testid="fm-item"]').find((li) => li.dataset.type === 'fonds');
  await klik(fonds.querySelector('[data-testid="fm-bespreek"]'));
  check('"Meer info" vraagt in de chat verder naar dit fonds', bespreek.length === 1 && bespreek[0].item.naam === 'Fonds Vier');

  await klik(fonds.querySelector('[data-testid="fm-toevoegen"]'));
  check('later toegevoegd fonds krijgt opnieuw de vraag (alleen voor dat fonds)', /voor dit fonds/.test(q('[data-testid="fm-actievraag"]').textContent));
  await klik(q('[data-testid="fm-acties-nee"]'));
  check('"Nu niet": vraag weg, geen extra serveraanroep', !q('[data-testid="fm-actievraag"]') && VG.opslagLog.length === 1);
  await weg();
}

sectie('3. Online fonds dat al op naam in het dekkingsplan staat');
{
  PF.__reset();
  await PF.voegFinancierToe({ projectId: PID, naam: 'Stichting Noord - Buurtfonds Noord', status: 'interesting' });
  const voor = PF.staat.regels.length;
  await toon(<FondsMatchKaart lijst={fm.leesFondsMatches(ruw)} berichtId="k2" projectNaam="Hushu House" projecten={projecten} />);
  const online = qa('[data-testid="fm-item"]').find((li) => li.dataset.type === 'online');
  await klik(online.querySelector('[data-testid="fm-toevoegen"]'));
  check('geen dubbele regel; gemeld als "staat al"', PF.staat.regels.length === voor && qa('[data-testid="fm-item"]').find((li) => li.dataset.type === 'online').dataset.status === 'staat-al');
  check('geen actieplan-vraag voor iets dat er al stond', !q('[data-testid="fm-actievraag"]'));
  await weg();
}

sectie('4. Alles toevoegen en een project dat niet van het lid is');
{
  PF.__reset();
  await toon(<FondsMatchKaart lijst={fm.leesFondsMatches(ruw)} berichtId="k3" projectNaam="Hushu House" projecten={projecten} />);
  await klik(q('[data-testid="fm-alles-toevoegen"]'));
  check('alle drie toegevoegd, één voor één', PF.staat.regels.length === 3 && qa('[data-testid="fm-item"]').every((li) => li.dataset.status === 'toegevoegd'));
  await weg();
  PF.__reset();
  await toon(<FondsMatchKaart lijst={fm.leesFondsMatches(ruw)} berichtId="k4" projectNaam="Ander" projecten={[]} />);
  await klik(qa('[data-testid="fm-toevoegen"]')[2]);
  check('zonder eigen project: niets opgeslagen, melding "niet gelukt"', PF.staat.regels.length === 0 && qa('[data-testid="fm-item"]')[2].dataset.status === 'mislukt');
  await weg();
}

sectie('5. Acties: serverfout');
{
  VG.gedrag.antwoord = { ok: false, reden: 'fout' };
  const res = await fm.maakActiesVoor({ items: [{ type: 'regeling', id: U(3) }], projectId: PID });
  check('fout -> nette melding', res.ok === false && /konden nu niet worden aangemaakt/.test(res.melding));
  check('niets om te plannen -> geen serveraanroep', (await fm.maakActiesVoor({ items: [], projectId: PID })).ok === false);
}

console.log(`\n${stand.ok} geslaagd, ${stand.fout} mislukt`);
process.exit(stand.fout ? 1 : 0);
