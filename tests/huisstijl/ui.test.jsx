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
  check('bewaren zonder iets te kiezen geeft een nette melding en bewaart niets', await wacht(() => $('[data-testid="huisstijl-melding"]')) && /Kies een logo, een naam, een kleur of een lettertype/.test($('[data-testid="huisstijl-melding"]').textContent) && aangeroepen.length === 0);

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

sectie('4. Uit een document halen');
{
  const bewaard = [];
  const lees = async () => ({ logo: PNG, logoBreedte: 96, logoHoogte: 48 });
  const uitDocument = async (f) => (f.name === 'leeg.pdf' ? { fout: 'We vonden geen logo of kleuren in dit bestand.' } : { bron: 'word', kleuren: ['#C8102E', '#1F6FB2', '#00A19A'], logo: { logo: PNG, logoBreedte: 96, logoHoogte: 48 } });
  const kies = async (naam) => {
    const veld = $('[data-testid="huisstijl-document"]');

    await act(async () => {
      Object.defineProperty(veld, 'files', { value: [{ name: naam, type: '', size: 10 }], configurable: true });
      veld.dispatchEvent(new window.Event('change', { bubbles: true }));
    });
  };

  await act(async () => { root.render(<HuisstijlPaneel premium organisatieNaam="Stichting Voorbeeld" laad={async () => null} bewaar={async (h) => { bewaard.push(h); return { ok: true, huisstijl: h }; }} lees={lees} uitDocument={uitDocument} />); });
  await wacht(() => $('[data-testid="huisstijl-premium"]'));
  check('er is een knop om een document te uploaden (Word, Excel, PDF of afbeelding)', !!$('[data-testid="huisstijl-document-kies"]') && /Word, Excel, PDF/.test($('[data-testid="huisstijl-premium"]').textContent) && /\.docx/.test($('[data-testid="huisstijl-document"]').getAttribute('accept')) && /\.pdf/.test($('[data-testid="huisstijl-document"]').getAttribute('accept')));
  check('er wordt niets bewaard of getoond voordat er een bestand is gekozen', !$('[data-testid="huisstijl-gevonden"]') && bewaard.length === 0);

  await kies('brief.docx');
  check('na het lezen staan het logo en de eerste twee kleuren in het voorbeeld', await wacht(() => !!$('[data-testid="huisstijl-voorbeeld-logo"]')) && $('[data-testid="huisstijl-primair"]').value === '#c8102e' && $('[data-testid="huisstijl-accent"]').value === '#1f6fb2');
  check('de melding zegt wat er gevonden is en dat het lid moet controleren en bewaren', /Gevonden: logo en 3 kleuren\. Controleer en bewaar\./.test($('[data-testid="huisstijl-melding"]').textContent));
  check('er is nog niets bewaard', bewaard.length === 0);

  const kleuren = [...document.querySelectorAll('[data-testid="huisstijl-gevonden-kleur"]')];

  check('alle gevonden kleuren staan als keuze', kleuren.length === 3);
  await klik(kleuren[2]);
  check('een kleur aanklikken zet hem als hoofdkleur', $('[data-testid="huisstijl-primair"]').value === '#00a19a');

  await klik($('[data-testid="huisstijl-bewaar"]'));
  check('Huisstijl bewaren bewaart logo en kleuren van het voorstel', await wacht(() => bewaard.length === 1) && bewaard[0].primair === '#00A19A' && bewaard[0].accent === '#1F6FB2' && /^data:image\/png/.test(bewaard[0].logo));

  await kies('leeg.pdf');
  check('een bestand zonder logo of kleuren geeft een korte foutmelding en laat de huisstijl staan', await wacht(() => /geen logo of kleuren/.test($('[data-testid="huisstijl-melding"]').textContent)) && $('[data-testid="huisstijl-primair"]').value === '#00a19a');
  await act(async () => { root.render(<div />); });
}

sectie('5. Lettertype, tekstkleur en voorblad');
{
  const bewaard = [];

  await act(async () => { root.render(<HuisstijlPaneel premium organisatieNaam="Stichting Voorbeeld" laad={async () => null} bewaar={async (h) => { bewaard.push(h); return { ok: true, huisstijl: h }; }} lees={async () => ({ logo: PNG, logoBreedte: 96, logoHoogte: 48 })} />); });
  await wacht(() => $('[data-testid="huisstijl-premium"]'));
  const sel = $('[data-testid="huisstijl-lettertype"]');

  check('lettertype: een korte lijst, standaard Arial', !!sel && [...sel.options].map((o) => o.value).join() === 'Arial,Calibri,Georgia,Times New Roman' && sel.value === 'Arial');
  check('voorblad staat standaard aan en de tekstkleur heeft een startwaarde', $('[data-testid="huisstijl-voorblad"]').checked === true && /^#[0-9a-f]{6}$/.test($('[data-testid="huisstijl-tekst"]').value));
  check('het voorbeeld toont het voorblad (logovak)', /geen logo|logo/.test($('[data-testid="huisstijl-voorbeeld"]').textContent) || !!$('[data-testid="huisstijl-voorbeeld-logo"]'));

  await act(async () => { sel.value = 'Georgia'; sel.dispatchEvent(new window.Event('change', { bubbles: true })); });
  check('het voorbeeld gebruikt het gekozen lettertype', /Georgia/.test($('[data-testid="huisstijl-voorbeeld"]').getAttribute('style')));
  await klik($('[data-testid="huisstijl-voorblad"]'));
  check('voorblad uitzetten haalt het logovak uit het voorbeeld', !/geen logo/.test($('[data-testid="huisstijl-voorbeeld"]').textContent) && !$('[data-testid="huisstijl-voorbeeld-logo"]'));

  await klik($('[data-testid="huisstijl-bewaar"]'));
  check('alleen een ander lettertype en het voorblad uit is genoeg om te bewaren, en wordt zo bewaard', await wacht(() => bewaard.length === 1) && bewaard[0].lettertype === 'Georgia' && bewaard[0].voorblad === false && /^#[0-9A-F]{6}$/.test(bewaard[0].tekst));
  await act(async () => { root.render(<div />); });
}

console.log(`\nhuisstijl-scherm: ${stand.ok} OK, ${stand.fout} FAIL`);
process.exit(stand.fout ? 1 : 0);
