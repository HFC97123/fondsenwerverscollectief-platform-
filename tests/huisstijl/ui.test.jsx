// Het paneel Huisstijl voor uw documenten in jsdom: Pro ziet de uitleg, Premium kan een eigen huisstijl kiezen, bewaren en terugzetten.
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
const { default: HuisstijlPaneel } = await import('../../src/features/kompas-app/HuisstijlPaneel.jsx');

const stand = { ok: 0, fout: 0 };
const check = (naam, waar) => { if (waar) stand.ok += 1; else { stand.fout += 1; console.log(`  FAIL: ${naam}`); } };
const sectie = (t) => console.log(`\n== ${t}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const root = createRoot(document.getElementById('root'));
const $ = (sel) => document.querySelector(sel);
const klik = async (el) => { await act(async () => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); }); };
const typ = async (el, waarde) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, waarde);
    el.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
};
const wacht = async (fn, ms = 3000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await act(async () => { await sleep(10); }); } return false; };

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

sectie('1. Pro: uitleg, geen eigen huisstijl');
{
  await act(async () => { root.render(<HuisstijlPaneel premium={false} organisatieNaam="Stichting Voorbeeld" />); });
  check('Pro ziet dat de Subsidie Kompas-huisstijl geldt, met een link naar Premium', !!$('[data-testid="huisstijl-pro"]') && /Subsidie Kompas-huisstijl/.test($('[data-testid="huisstijl-pro"]').textContent) && !!$('[data-testid="huisstijl-premium-link"]'));
  check('Pro ziet geen invoervelden', !$('[data-testid="huisstijl-premium"]') && !$('[data-testid="huisstijl-bewaar"]') && !$('[data-testid="huisstijl-bestand"]'));
  await act(async () => { root.render(<div />); });
}

sectie('2. Premium: kiezen, bewaren en terugzetten');
{
  const aangeroepen = [];
  const bewaar = async (h) => { aangeroepen.push(h); return { ok: true, huisstijl: h }; };
  const lees = async () => ({ logo: PNG, logoBreedte: 96, logoHoogte: 48 });

  await act(async () => { root.render(<HuisstijlPaneel premium organisatieNaam="Stichting Voorbeeld" laad={async () => null} bewaar={bewaar} lees={lees} />); });
  check('zonder opgeslagen huisstijl: Subsidie Kompas-huisstijl als start, voorbeeld toont de naam van de organisatie', await wacht(() => $('[data-testid="huisstijl-premium"]')) && /nu de Subsidie Kompas-huisstijl/.test($('[data-testid="huisstijl-premium"]').textContent) && /Stichting Voorbeeld/.test($('[data-testid="huisstijl-voorbeeld"]').textContent));
  check('de knop Terug naar Subsidie Kompas-huisstijl is er nog niet', !$('[data-testid="huisstijl-terug"]'));

  await klik($('[data-testid="huisstijl-bewaar"]'));
  check('bewaren zonder iets te kiezen geeft een nette melding en bewaart niets', await wacht(() => $('[data-testid="huisstijl-melding"]')) && /Kies een logo, een naam of een kleur/.test($('[data-testid="huisstijl-melding"]').textContent) && aangeroepen.length === 0);

  const bestand = $('[data-testid="huisstijl-bestand"]');
  await act(async () => {
    Object.defineProperty(bestand, 'files', { value: [{ type: 'image/png', size: 1000 }], configurable: true });
    bestand.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  check('na het kiezen van een logo staat het in het voorbeeld', await wacht(() => $('[data-testid="huisstijl-voorbeeld-logo"]')) && $('[data-testid="huisstijl-voorbeeld-logo"]').getAttribute('src') === PNG && !!$('[data-testid="huisstijl-logo-weg"]'));

  await typ($('[data-testid="huisstijl-naam"]'), 'Stichting Eigen Stijl');
  await typ($('[data-testid="huisstijl-primair"]'), '#7a1f3d');
  check('de naam en kleur werken door in het voorbeeld', /Stichting Eigen Stijl/.test($('[data-testid="huisstijl-voorbeeld"]').textContent) && /7A1F3D/i.test($('[data-testid="huisstijl-voorbeeld"]').innerHTML.toUpperCase().replace(/\s+/g, '').replace(/RGB\(122,31,61\)/g, '7A1F3D')));

  await klik($('[data-testid="huisstijl-bewaar"]'));
  check('bewaren stuurt het schone object door (hoofdletters, versie, logo, maten)', await wacht(() => aangeroepen.length === 1) && aangeroepen[0].naam === 'Stichting Eigen Stijl' && aangeroepen[0].primair === '#7A1F3D' && aangeroepen[0].logo === PNG && aangeroepen[0].logoBreedte === 96 && aangeroepen[0].versie === 1);
  check('bevestiging en de knop Terug naar Subsidie Kompas-huisstijl verschijnt', await wacht(() => /is bewaard/.test(($('[data-testid="huisstijl-melding"]') || {}).textContent || '')) && !!$('[data-testid="huisstijl-terug"]'));

  await klik($('[data-testid="huisstijl-terug"]'));
  check('terugzetten bewaart null en toont de Subsidie Kompas-huisstijl weer', await wacht(() => aangeroepen.length === 2 && aangeroepen[1] === null) && !$('[data-testid="huisstijl-terug"]') && !$('[data-testid="huisstijl-voorbeeld-logo"]'));
  await act(async () => { root.render(<div />); });
}

sectie('3. Premium met een opgeslagen huisstijl en fouten');
{
  const opgeslagen = { versie: 1, naam: 'Stichting Bewaard', primair: '#112233', accent: '#445566', logo: PNG, logoBreedte: 96, logoHoogte: 48 };

  await act(async () => { root.render(<HuisstijlPaneel premium laad={async () => opgeslagen} bewaar={async () => ({ ok: false, reden: 'fout' })} lees={async () => ({ fout: 'Kies een PNG- of JPG-bestand.' })} />); });
  check('de opgeslagen huisstijl wordt geladen: naam, logo en de zin dat het uw eigen huisstijl is', await wacht(() => $('[data-testid="huisstijl-naam"]') && $('[data-testid="huisstijl-naam"]').value === 'Stichting Bewaard') && !!$('[data-testid="huisstijl-voorbeeld-logo"]') && /uw eigen huisstijl/.test($('[data-testid="huisstijl-premium"]').textContent) && !!$('[data-testid="huisstijl-terug"]'));

  const bestand = $('[data-testid="huisstijl-bestand"]');
  await act(async () => {
    Object.defineProperty(bestand, 'files', { value: [{ type: 'image/gif', size: 10 }], configurable: true });
    bestand.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  check('een niet-toegestaan bestand geeft een melding en laat het huidige logo staan', await wacht(() => /PNG- of JPG/.test(($('[data-testid="huisstijl-melding"]') || {}).textContent || '')) && !!$('[data-testid="huisstijl-voorbeeld-logo"]'));

  await klik($('[data-testid="huisstijl-bewaar"]'));
  check('mislukt bewaren geeft een foutmelding', await wacht(() => /Bewaren lukte niet/.test(($('[data-testid="huisstijl-melding"]') || {}).textContent || '')));
  await act(async () => { root.render(<div />); });
}

console.log(`\nhuisstijl-scherm: ${stand.ok} OK, ${stand.fout} FAIL`);
process.exit(stand.fout ? 1 : 0);
