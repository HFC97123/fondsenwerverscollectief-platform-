// De schermen van de aanvraag-assistent, in jsdom, tegen de ECHTE serverregels (aanvraagHandler.ts) met een nagebootst model en een geheugendatabase.
// Zo controleren we ook de aansluiting tussen scherm, service en server: veldnamen, foutmeldingen, maandruimte en wat wel en niet bewaard wordt.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
const g = globalThis;
g.window = dom.window; g.document = dom.window.document;
Object.defineProperty(g, 'navigator', { value: dom.window.navigator, configurable: true });
g.HTMLElement = dom.window.HTMLElement; g.Event = dom.window.Event; g.MouseEvent = dom.window.MouseEvent;
g.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import('react')).default;
const { act, useState } = await import('react');
const { createRoot } = await import('react-dom/client');
const client = await import('../checkout-frontend/fake-client.js');
const { useAanvraagAssistent } = await import('../../src/features/kompas-app/aanvraag/useAanvraagAssistent.js');
const { default: ProjectplanTab } = await import('../../src/features/kompas-app/aanvraag/ProjectplanTab.jsx');
const { default: AanvragenTab } = await import('../../src/features/kompas-app/aanvraag/AanvragenTab.jsx');

const stand = { ok: 0, fout: 0 };
const check = (naam, waar, detail = '') => { if (waar) stand.ok += 1; else { stand.fout += 1; console.log(`  FAIL: ${naam} ${detail}`); } };
const sectie = (t) => console.log(`\n== ${t}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { USER, PROJECT, NU, RICHTLIJN, AANVRAAG, PLANBRON, maakServer } = await import('./nepserver.mjs');

// ── Een kleine pagina zoals Documenten: tabs, maandstatus en doorsturen van Projectplan naar Aanvragen ──────────────────────────────────
function Harnas({ store }) {
  const assistent = useAanvraagAssistent(true);
  const [tab, setTab] = useState('plan');
  const [start, setStart] = useState(null);
  const project = { id: PROJECT, naam: 'Samen Spelen' };

  if (!assistent.klaar) return <div data-testid="laden">laden</div>;
  if (!assistent.beschikbaar) return <div data-testid="geen-assistent">geen</div>;

  return (
    <div>
      <nav>
        <button type="button" data-testid="tab-plan" onClick={() => setTab('plan')}>Projectplan</button>
        <button type="button" data-testid="tab-aanvragen" onClick={() => setTab('aanvragen')}>Aanvragen</button>
        <button type="button" data-testid="tab-inhoud" onClick={() => setTab('inhoud')}>Projectinhoud</button>
      </nav>
      {tab === 'plan' && <ProjectplanTab project={project} projecten={[project]} onKiesProject={() => {}} store={store} assistent={assistent} onNieuweAanvraag={(fonds) => { setStart({ fonds, nonce: Date.now() }); setTab('aanvragen'); }} onOpenAanvraag={(id) => { setStart({ aanvraagId: id, nonce: Date.now() }); setTab('aanvragen'); }} onNaarProjectinhoud={() => setTab('inhoud')} />}
      {tab === 'aanvragen' && <AanvragenTab project={project} projecten={[project]} onKiesProject={() => {}} store={store} assistent={assistent} start={start} />}
      {tab === 'inhoud' && <div data-testid="inhoud">inhoud</div>}
    </div>
  );
}

// ── Hulpjes ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const root = createRoot(document.getElementById('root'));
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const tekst = () => document.body.textContent.replace(/\s+/g, ' ');
const knop = (naam) => $$('button, a').find((b) => b.textContent.replace(/\s+/g, ' ').trim().includes(naam) || (b.getAttribute('aria-label') || '').includes(naam));
const klik = async (el) => { await act(async () => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); }); };
const typ = async (el, waarde) => {
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;

  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, waarde);
    el.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
};
const wacht = async (fn, ms = 4000) => {
  const t0 = Date.now();

  while (Date.now() - t0 < ms) {
    if (fn()) return true;

    await act(async () => { await sleep(15); });
  }

  return false;
};
async function toon(server) {
  client.__reset();
  client.__zetSupabase(server.supabase);
  await act(async () => { root.render(<Harnas store={{ orgProfile: { name: 'Stichting Samen Spelen' } }} />); });
  await wacht(() => $('[data-testid="aa-projectplan"]') || $('[data-testid="geen-assistent"]'));
}
async function opruimen() { await act(async () => { root.render(<div />); }); }

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
sectie('1. Zonder de functie of zonder Pro/Premium verandert er niets');
{
  const uit = maakServer({ vlag: false });
  await toon(uit);
  check('functie uit (404): geen tabbladen en geen schermen', $('[data-testid="geen-assistent"]') && !$('[data-testid="tab-plan"]'));
  await opruimen();

  const free = maakServer({ tier: 'free' });
  await toon(free);
  check('Free (403): geen schermen', $('[data-testid="geen-assistent"]') && !$('[data-testid="tab-plan"]'));
  await opruimen();
}

sectie('2. Projectplan: algemeen plan schrijven');
const S = maakServer();
{
  await toon(S);
  check('Projectplan-scherm met beide keuzes', $('[data-testid="aa-kaart-algemeen"]') && $('[data-testid="aa-kaart-fonds"]'));
  check('ruimte: Beoordelingen 0 van 6 en Plannen schrijven 0 van 1', /Beoordelingen\s*0 van 6/.test(tekst()) && /Plannen schrijven\s*0 van 1/.test(tekst()));
  check('geen woord "eisenlijst" of "privéfonds" en geen "4 bestanden"', !/eisenlijst|privéfonds|4 bestanden/i.test(tekst()));
  check('"Waar we het plan op baseren": drie bronnen', ['Projectgegevens', 'Projectdocumentatie', 'Organisatieprofiel'].every((t) => tekst().includes(t)));
  check('privaatfonds-kaart wordt hier niet getoond, wel de lege plannenlijst', /Nog geen plannen/.test(tekst()));

  await klik(knop('Start algemeen plan'));
  check('tijdens het schrijven: voortgangsmelding en knop uit', await wacht(() => $('[data-testid="aa-bezig"]') || $('[data-testid="aa-plan"]')));
  check('plan wordt getoond met 8 onderdelen of minder (alleen onderdelen met feiten krijgen tekst)', await wacht(() => $('[data-testid="aa-plan"]')) && $$('[data-testid="aa-plan-sectie"]').length === 8);
  check('het verzonnen getal 4500 staat nergens', !tekst().includes('4500'));
  check('[aanvullen]-markering is zichtbaar en er is een vraag aan het lid', $$('mark.fwk-aa-markering').length > 0 && /Hoeveel kinderen doen mee/.test(tekst()));
  check('elk onderdeel noemt waarop het rust', /Projectgegevens/.test(tekst()));
  check('exportmenu en kopieerknoppen aanwezig', !!knop('Plan exporteren') && !!knop('Kopieer de tekst van'));
  check('het plan is opgeslagen als algemeen plan zonder fonds', [...S.s.tabel.values()].length === 1 && [...S.s.tabel.values()][0].soort === 'algemeen');
  check('gebruik gelogd als aanvraag_plan', S.s.gebruik.some((x) => x.actie === 'aanvraag_plan' && x.succes));

  await klik(knop('Sluiten'));
  check('na sluiten: terug op Projectplan, plan staat in "Uw plannen"', await wacht(() => $('[data-testid="aa-rij-algemeen"]')));
  check('ruimte ververst: Plannen schrijven 1 van 1', await wacht(() => /Plannen schrijven\s*1 van 1/.test(tekst())));
  check('de knop voor een nieuw plan is uit: maand op', knop('Start algemeen plan')?.disabled === true && /ruimte voor plannen op/.test(tekst()));

  await klik($('[data-testid="aa-rij-algemeen"] button'));
  check('het opgeslagen plan opent opnieuw', await wacht(() => $('[data-testid="aa-plan"]')) && $$('[data-testid="aa-plan-sectie"]').length === 8);
  await klik(knop('Sluiten'));
}

sectie('3. Nieuwe aanvraag: criteria ophalen uit geplakte formuliervragen');
{
  await wacht(() => $('[data-testid="aa-projectplan"]'));
  const fondsVeld = $('[data-testid="aa-fonds-plan"]');
  check('"Kies fonds" is uit zolang er geen fondsnaam staat', knop('Kies fonds en maak criteria').disabled === true);
  await typ(fondsVeld, 'Stichting Voorbeeldfonds');
  await klik(knop('Kies fonds en maak criteria'));
  check('gaat naar Nieuwe aanvraag met het fonds al ingevuld', await wacht(() => $('[data-testid="aa-nieuw"]')) && $('[data-testid="aa-fonds"]').value === 'Stichting Voorbeeldfonds');
  check('stappen zichtbaar, geen "eisen" in de teksten', $('[data-testid="aa-stappen"]') && !/\beisen\b|eisenlijst/i.test(tekst()));
  check('privaatfonds-kaart met mailknop naar het Collectief', ($('[data-testid="aa-mail-collectief"]') || { href: '' }).href.startsWith('mailto:info@fondsenwerverscollectief.nl') && /privaatfonds of familiefonds/.test(tekst()));
  check('Criteria ophalen is uit zolang er geen bron is', knop('Criteria ophalen').disabled === true);

  await klik(knop('Vragen plakken'));
  await typ($('[data-testid="aa-formulier"]'), `1. Beschrijf uw project. ${RICHTLIJN}`);
  check('met geplakte vragen kan het wel', knop('Criteria ophalen').disabled === false);
  await klik(knop('Criteria ophalen'));
  check('criteria verschijnen', await wacht(() => $('[data-testid="aa-werk"]') && $$('[data-testid="aa-eis"]').length > 0));
  check('2 criteria uit de bron met bronstuk; verzonnen criteria bestaan niet', $$('[data-testid="aa-eis"]').length === 2);
  check('bij elk criterium: soort, bron en zekerheid', /Verplicht/.test(tekst()) && /Uw formulier/.test(tekst()) && /Zeker: hoog/.test(tekst()));
  check('"Wat we hebben gelezen": de formuliervragen', /Uw formuliervragen/.test(tekst()));
  check('de aanvraag is bewaard met criteria, fonds en bron', (() => { const r = [...S.s.tabel.values()].find((x) => x.soort === 'fonds'); return r && r.fonds_label === 'Stichting Voorbeeldfonds' && r.criteria.length === 2; })());
  check('criteria-ophalen telt niet in de zichtbare ruimte', !/criteria ophalen|criterialijst/i.test(($('[data-testid="aa-ruimte"]') || { textContent: '' }).textContent));
}

sectie('4. Criteria aanpassen en bewaren');
{
  await klik(knop('Weghalen'));
  check('weghalen haalt het criterium uit de lijst', $$('[data-testid="aa-eis"]').length === 1 && !!$('[data-testid="aa-gewijzigd"]'));
  await typ($('[data-testid="aa-nieuw-criterium"]'), 'De aanvraag noemt de eigen bijdrage');
  await klik(knop('+ Toevoegen'));
  check('een eigen criterium komt erbij (bron: uw formulier)', $$('[data-testid="aa-eis"]').length === 2 && /De aanvraag noemt de eigen bijdrage/.test(tekst()));
  await klik(knop('Wijzigingen bewaren'));
  check('bewaard op de server', await wacht(() => !$('[data-testid="aa-gewijzigd"]')));
  const r = [...S.s.tabel.values()].find((x) => x.soort === 'fonds');
  check('opgeslagen lijst bevat het eigen criterium en niet het weggehaalde', r.criteria.length === 2 && r.criteria.some((c) => c.tekst === 'De aanvraag noemt de eigen bijdrage') && !r.criteria.some((c) => c.tekst === 'Een projectbegroting'));

  await klik(knop('Aanpassen'));
  const veld = $('[data-testid="aa-eis-bewerk"] textarea');
  await typ(veld, 'Een sluitende begroting');
  await klik(knop('Opslaan'));
  check('aanpassen werkt de tekst bij en markeert de lijst als gewijzigd', /Een sluitende begroting/.test(tekst()) && !!$('[data-testid="aa-gewijzigd"]'));
  await klik(knop('Wijzigingen bewaren'));
  await wacht(() => !$('[data-testid="aa-gewijzigd"]'));
}

sectie('5. Beoordeel mijn aanvraag');
{
  check('Beoordeel is uit zolang er geen tekst is', knop('Beoordeel mijn aanvraag').disabled === true);
  await typ($('[data-testid="aa-aanvraagtekst"]'), 'Te kort.');
  check('te korte tekst: uitleg en knop uit', /te kort/i.test(tekst()) && knop('Beoordeel mijn aanvraag').disabled === true);
  await typ($('[data-testid="aa-aanvraagtekst"]'), AANVRAAG);
  check('tekenteller toont het maximum van de server', /van 60\.000 tekens/.test($('[data-testid="aa-teken-telling"]').textContent));
  await klik(knop('Beoordeel mijn aanvraag'));
  check('resultaat verschijnt', await wacht(() => $('[data-testid="aa-beoordeling"]')));
  check('uitkomst door de server: "Eerst aanvullen"; geen score of percentage', /Eerst aanvullen/.test($('[data-testid="aa-uitkomst"]').textContent) && !/\d+\s?%|score|kans/i.test($('[data-testid="aa-beoordeling"]').textContent));
  check('tellingen: gedekt en ontbreekt', /Gedekt\s*1/.test(tekst()) && /Ontbreekt\s*1/.test(tekst()));
  check('gedekt criterium toont het citaat uit de eigen tekst', /In uw tekst/.test(tekst()) && /start in januari 2027 en loopt twaalf maanden/.test(tekst()));
  check('ontbrekend criterium: wat het fonds vraagt en hoe te verbeteren', /Het fonds vraagt/.test(tekst()) && /Voeg de begroting zelf toe/.test(tekst()));
  check('"Pak dit eerst aan" noemt het ontbrekende criterium', /Pak dit eerst aan/.test(tekst()));
  check('u beslist zelf: duidelijke zin aanwezig', /U beslist zelf/.test(tekst()));
  check('de aanvraagtekst is nergens bewaard', !JSON.stringify([...S.s.tabel.values()]).includes('Samen Spelen start in januari') && !JSON.stringify([...S.s.beoordelingen.values()]).includes('Onze aanpak bestaat uit wekelijkse'));
  check('de aanvraag onthoudt de uitkomst', [...S.s.tabel.values()].find((x) => x.soort === 'fonds').laatste_uitkomst === 'eerst-aanvullen');
  await klik(knop('Sluiten'));
  check('ruimte ververst: Beoordelingen 1 van 6', await wacht(() => /Beoordelingen\s*1 van 6/.test(tekst())));
  await klik(knop('Laatste beoordeling bekijken'));
  check('een eerdere beoordeling is opnieuw te zien', await wacht(() => $('[data-testid="aa-beoordeling"]')) && /Eerst aanvullen/.test(tekst()));
  await klik(knop('Sluiten'));
}

sectie('6. Versie voor dit fonds schrijven');
{
  check('uit 1 formuliervraag... het aantal onderdelen staat in de uitleg', /formuliervragen worden|1 vraag; die wordt 1 onderdeel|standaardonderdelen/.test(tekst()));
  const voor = S.s.gebruik.filter((x) => x.actie === 'aanvraag_plan').length;
  check('Pro heeft 1 plan per maand en dat is al gebruikt: schrijven is uit met uitleg', knop('Start schrijven').disabled === true && /ruimte voor plannen op/.test(tekst()));
  check('er is geen extra plan geschreven', voor === 1);
}

sectie('7. Overzicht van aanvragen');
{
  await klik(knop('Alle aanvragen'));
  check('terug naar het overzicht met het fonds', await wacht(() => $('[data-testid="aa-rij-aanvraag"]')) && /Stichting Voorbeeldfonds/.test(tekst()));
  check('kenmerken: criteria klaar en de laatste beoordeling', /Criteria klaar/.test(tekst()) && /Beoordeeld: eerst aanvullen/.test(tekst()) && /Nog niets geschreven/.test(tekst()));
  check('het algemene plan staat niet in de lijst van fondsen', $$('[data-testid="aa-rij-aanvraag"]').length === 1);
  check('privaatfonds-kaart staat ook hier', !!$('[data-testid="aa-privaatfonds"]'));
  await klik($('[data-testid="aa-rij-aanvraag"] button'));
  check('openen laadt de aanvraag met de bewaarde criteria', await wacht(() => $$('[data-testid="aa-eis"]').length === 2));
  await opruimen();
}

sectie('8. Fouten worden eerlijk getoond');
{
  const kapot = maakServer({ pagina: { ok: false, reden: 'niet-bereikbaar' } });
  await toon(kapot);
  await klik(knop('Aanvragen'));
  await wacht(() => $('[data-testid="aa-aanvragen"]'));
  check('lege lijst met uitnodiging', /Nog geen aanvragen/.test(tekst()));
  await klik(knop('+ Nieuwe aanvraag'));
  await wacht(() => $('[data-testid="aa-nieuw"]'));
  await typ($('[data-testid="aa-fonds"]'), 'Fonds Weg');
  await typ($('[data-testid="aa-url-0"]'), 'weg.example/aanvragen');
  await klik(knop('Criteria ophalen'));
  check('website onleesbaar: de melding legt uit wat te doen (plakken)', await wacht(() => $('[data-testid="aa-nieuw-fout"]')) && /plak/i.test($('[data-testid="aa-nieuw-fout"]').textContent));
  check('er is niets bewaard en je blijft op hetzelfde scherm', kapot.s.tabel.size === 0 && !!$('[data-testid="aa-nieuw"]'));
  await typ($('[data-testid="aa-url-0"]'), 'kapot adres');
  check('een ongeldig adres alleen: Criteria ophalen blijft uit', knop('Criteria ophalen').disabled === true);
  await opruimen();

  const weinig = maakServer({ planBron: { project: { naam: 'Samen Spelen' }, info: {}, organisatie: {} } });
  await toon(weinig);
  await klik(knop('Start algemeen plan'));
  check('te weinig informatie: uitleg met link naar de projectinhoud, niets verbruikt', await wacht(() => $('[data-testid="aa-plan-fout"]')) && /te weinig/i.test(tekst()) && !!knop('Naar de projectinhoud') && weinig.s.gebruik.length === 0);
  await klik(knop('Naar de projectinhoud'));
  check('de link brengt u naar de projectinhoud', !!$('[data-testid="inhoud"]'));
  await opruimen();
}

console.log(`\naanvraag-schermen: ${stand.ok} OK, ${stand.fout} FAIL`);
process.exit(stand.fout ? 1 : 0);
