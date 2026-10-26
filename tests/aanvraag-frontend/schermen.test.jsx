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

const { USER, PROJECT, NU, RICHTLIJN, AANVRAAG, FORMULIER, PLANBRON, maakServer } = await import('./nepserver.mjs');

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
      {tab === 'plan' && <ProjectplanTab project={project} projecten={[project]} onKiesProject={() => {}} store={store} assistent={assistent} onNieuweAanvraag={(fonds, website) => { setStart({ fonds, website, nonce: Date.now() }); setTab('aanvragen'); }} onOpenAanvraag={(id) => { setStart({ aanvraagId: id, nonce: Date.now() }); setTab('aanvragen'); }} onNaarProjectinhoud={() => setTab('inhoud')} />}
      {tab === 'aanvragen' && <AanvragenTab project={project} projecten={[project]} onKiesProject={() => {}} store={store} assistent={assistent} start={start} />}
      {tab === 'inhoud' && <div data-testid="inhoud">inhoud</div>}
    </div>
  );
}


// Eén tabblad zoals Documenten het nu toont: het projectplan en de fondsen waar het lid indient op dezelfde pagina.
function HarnasEen({ store }) {
  const assistent = useAanvraagAssistent(true);
  const project = { id: PROJECT, naam: 'Samen Spelen' };

  if (!assistent.klaar) return <div data-testid="laden">laden</div>;
  if (!assistent.beschikbaar) return <div data-testid="geen-assistent">geen</div>;

  return <AanvragenTab metProjectplan project={project} projecten={[project]} onKiesProject={() => {}} store={store} assistent={assistent} onNaarProjectinhoud={() => {}} />;
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
async function toon(server, extraStore = {}) {
  client.__reset();
  client.__zetSupabase(server.supabase);
  await act(async () => { root.render(<Harnas store={{ orgProfile: { name: 'Stichting Samen Spelen' }, ...extraStore }} />); });
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
  check('ruimte: Beoordelingen 0 van 6 en Projectplannen 0 van 1', /Beoordelingen\s*0 van 6/.test(tekst()) && /Projectplannen\s*0 van 1/.test(tekst()));
  check('voortgangsmeter: een volledig project staat op 100% en er is niets dat nog mist', await wacht(() => $('[data-testid="aa-meter-percentage"]')?.textContent === '100%') && !$('[data-testid="aa-meter-mist"]'));
  check('geen woord "eisenlijst" of "privéfonds" en geen "4 bestanden"', !/eisenlijst|privéfonds|4 bestanden/i.test(tekst()));
  check('"Waar we het plan op baseren": drie bronnen', ['Projectgegevens', 'Projectdocumentatie', 'Organisatieprofiel'].every((t) => tekst().includes(t)));
  check('privaatfonds-kaart wordt hier niet getoond, wel de lege plannenlijst', /Nog geen plannen/.test(tekst()));

  await klik(knop('Start algemeen plan'));
  check('eerst een bevestiging: het plan wordt maar één keer geschreven', await wacht(() => $('[data-testid="aa-bevestig-plan"]')) && /één keer/.test($('[data-testid="aa-bevestig-plan"]').textContent) && S.s.gebruik.length === 0);
  await klik(knop('Ja, schrijf het plan'));
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
  check('ruimte ververst: Projectplannen 1 van 1', await wacht(() => /Projectplannen\s*1 van 1/.test(tekst())));
  check('opnieuw schrijven kan niet meer: geen schrijfknop meer, wel "Open het projectplan" en uitleg', !knop('Start algemeen plan') && !!knop('Open het projectplan') && !!$('[data-testid="aa-plan-klaar"]') && !$('[data-testid="aa-meter"]'));

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
  await typ($('[data-testid="aa-site-plan"]'), 'https://www.voorbeeldfonds.nl/aanvragen');
  await klik(knop('Kies fonds en maak criteria'));
  check('gaat naar Nieuwe aanvraag met het fonds al ingevuld', await wacht(() => $('[data-testid="aa-nieuw"]')) && $('[data-testid="aa-fonds"]').value === 'Stichting Voorbeeldfonds');
  check('de website uit het middelste vakje staat al ingevuld in de volgende stap', $('[data-testid="aa-url-0"]').value === 'https://www.voorbeeldfonds.nl/aanvragen');
  await typ($('[data-testid="aa-url-0"]'), '');
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
  check('een versie voor een fonds telt bij de beoordelingen (nog ruimte): schrijven is aan, ook al is het projectplan geschreven', knop('Start schrijven').disabled === false && !/ruimte voor beoordelingen en versies op/.test(tekst()));
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
  const bewaard = [];
  await toon(weinig, { saveProject: async (p) => { bewaard.push(p); weinig.s.opties.planBron = { ...weinig.s.opties.planBron, project: { ...weinig.s.opties.planBron.project, doelstellingen: p.doelstellingen || '' } }; return PROJECT; } });
  check('voortgangsmeter bij weinig informatie: onder 100%, de lijst zegt wat nog mist en waar je het invult', await wacht(() => $('[data-testid="aa-meter-mist"]')) && parseInt($('[data-testid="aa-meter-percentage"]').textContent, 10) < 100 && /Doelgroep/.test($('[data-testid="aa-meter-mist"]').textContent) && /Projectgegevens/.test($('[data-testid="aa-meter-mist"]').textContent));
  check('de schrijfknop is uit tot 100% en er is niets verbruikt', knop('Start algemeen plan').disabled === true && /Beschikbaar bij 100%/.test(tekst()) && weinig.s.gebruik.length === 0);
  check('een ontbrekend onderdeel schuift open om het meteen in te vullen (geen link naar een ander scherm)', $('[data-testid="aa-meter-mist"] a') === null && !!$('[data-testid="aa-mist-doelstelling"]') && !$('[data-testid="aa-invul-doelstelling-form"]'));
  await klik($('[data-testid="aa-mist-doelstelling"]'));
  check('klik opent een invulvak met de vraag en Opslaan staat uit zolang het leeg is', !!$('[data-testid="aa-invul-doelstelling"]') && $('[data-testid="aa-invul-doelstelling-form"] button[type="submit"]').disabled === true);
  const voor = parseInt($('[data-testid="aa-meter-percentage"]').textContent, 10);
  await typ($('[data-testid="aa-invul-doelstelling"]'), 'Kinderen bewegen meer.');
  await klik($('[data-testid="aa-invul-doelstelling-form"] button[type="submit"]'));
  check('opslaan schrijft het veld via het bestaande project-opslaan en sluit het vak', await wacht(() => !$('[data-testid="aa-invul-doelstelling-form"]')) && bewaard.length === 1 && bewaard[0].doelstellingen === 'Kinderen bewegen meer.');
  check('de meter springt bij en het onderdeel staat niet meer in de lijst', await wacht(() => parseInt($('[data-testid="aa-meter-percentage"]').textContent, 10) > voor) && !$('[data-testid="aa-mist-doelstelling"]'));
  await klik($('[data-testid="aa-mist-aanleiding"]'));
  check('ook een veld uit de projectdocumentatie wordt hier ingevuld', !!$('[data-testid="aa-invul-aanleiding"]'));
  await opruimen();
}

sectie('9. Eén tabblad: projectplan en fondsen waar het lid indient');
{
  const een = maakServer();
  client.__reset();
  client.__zetSupabase(een.supabase);
  await act(async () => { root.render(<HarnasEen store={{ orgProfile: { name: 'Stichting Samen Spelen' } }} />); });
  await wacht(() => $('[data-testid="aa-projectplan"]'));
  check('het projectplan en de fondsen staan op dezelfde pagina', !!$('[data-testid="aa-kaart-algemeen"]') && !!$('[data-testid="aa-aanvragen-lijst"]'));
  check('de kaart Fondsbeoordeling en het blok Uw plannen zijn weg: de fondsen staan in één blok', !$('[data-testid="aa-kaart-fonds"]') && !$('[data-testid="aa-plannen"]'));
  check('het blok heet Fondsen waar u indient en zegt dat het lid zelf indient', /Fondsen waar u indient/.test(tekst()) && /U dient zelf in bij het fonds/.test(tekst()));
  check('de maandruimte, de uitleg bij het plan en het privaatfonds staan er één keer op', $$('[data-testid="aa-ruimte"]').length <= 1 && $$('[data-testid="aa-baseren"]').length === 1 && $$('[data-testid="aa-privaatfonds"]').length === 1);
  check('er is één projectkeuze', $$('[data-testid="aa-projectkeuze"]').length === 1);
  await klik(knop('+ Fonds toevoegen'));
  check('+ Fonds toevoegen opent het scherm voor een nieuwe aanvraag', await wacht(() => $('[data-testid="aa-nieuw"]')) && !$('[data-testid="aa-kaart-algemeen"]'));
  await klik(knop('Terug'));
  check('terug brengt het lid naar dezelfde pagina met het plan en de fondsen', await wacht(() => $('[data-testid="aa-aanvragen-lijst"]')) && !!$('[data-testid="aa-kaart-algemeen"]'));
  await opruimen();
}

sectie('10. Bewerken, opslaan en versies');
{
  async function openAanvraagEnSchrijf(server) {
    client.__reset();
    client.__zetSupabase(server.supabase);
    await server.supabase.functions.invoke('aanvraag-assistent', { body: { mode: 'eisen-ophalen', projectId: PROJECT, fondsLabel: 'Stichting Voorbeeldfonds', formulierTekst: `1. Beschrijf uw project. ${RICHTLIJN}` } });
    const rij = [...server.s.tabel.values()].find((x) => x.soort === 'fonds');
    const project = { id: PROJECT, naam: 'Samen Spelen' };

    function HarnasWerk() {
      const assistent = useAanvraagAssistent(true);

      if (!assistent.klaar) return <div>laden</div>;

      return <AanvragenTab project={project} projecten={[project]} onKiesProject={() => {}} store={{ orgProfile: { name: 'Stichting Samen Spelen' } }} assistent={assistent} start={{ aanvraagId: rij.id, nonce: 1 }} />;
    }

    await act(async () => { root.render(<HarnasWerk />); });
    await wacht(() => $('[data-testid="aa-werk"]') && knop('Start schrijven'));
    await klik(knop('Start schrijven'));

    return rij;
  }

  const V = maakServer();
  const rij = await openAanvraagEnSchrijf(V);
  check('na het schrijven opent het bewerkscherm met een tekstvak per onderdeel (1 formuliervraag = 1 onderdeel)', await wacht(() => $('[data-testid="aa-versie-editor"]')) && $$('[data-testid="aa-onderdeel"] textarea').length === 1);
  check('nog niets opgeslagen: staat er eerlijk bij en Opslaan is aan', /Nog geen versie opgeslagen/.test(tekst()) && knop('Opslaan als versie').disabled === false && V.s.versies.size === 0);
  check('het plan staat nog niet als alleen-lezen tekst op het scherm', !$('[data-testid="aa-plan"]'));

  const gebruikVoor = V.s.gebruik.length;
  const eerste = $$('[data-testid="aa-onderdeel"] textarea')[0];
  await typ(eerste, 'Onze eigen tekst over de aanleiding.');
  check('typen toont "Niet opgeslagen" en de tekenteller telt mee', /Niet opgeslagen/.test(tekst()) && /36 tekens/.test($$('[data-testid="aa-onderdeel-telling"]')[0].textContent));
  await klik(knop('Opslaan als versie'));
  check('opslaan maakt versie 1 als concept met de eigen tekst', await wacht(() => V.s.versies.size === 1) && [...V.s.versies.values()][0].status === 'concept' && [...V.s.versies.values()][0].antwoorden[0].tekst === 'Onze eigen tekst over de aanleiding.');
  check('het scherm zegt: alles is opgeslagen, Concept, versie 1', await wacht(() => /Alles is opgeslagen/.test(tekst())) && /Concept · versie 1/.test($('[data-testid="aa-versie-status"]').textContent));
  check('de lijst met versies toont versie 1', await wacht(() => $$('[data-testid="aa-versie-rij"]').length === 1));

  await typ($$('[data-testid="aa-onderdeel"] textarea')[0], 'Tweede tekst.');
  await klik(knop('Opslaan als versie'));
  check('opnieuw opslaan werkt het concept bij: nog steeds 1 versie', await wacht(() => [...V.s.versies.values()][0].antwoorden[0].tekst === 'Tweede tekst.') && V.s.versies.size === 1);

  await typ($$('[data-testid="aa-onderdeel"] textarea')[0], 'Weggooien.');
  await klik(knop('Terug naar opgeslagen'));
  check('Terug naar opgeslagen zet de tekst terug', $$('[data-testid="aa-onderdeel"] textarea')[0].value === 'Tweede tekst.' && /Alles is opgeslagen/.test(tekst()));

  await klik(knop('Maak definitief'));
  check('Maak definitief: de versie en de aanvraag zijn definitief', await wacht(() => rij && V.s.tabel.get(rij.id).status === 'definitief') && [...V.s.versies.values()][0].status === 'definitief' && /Definitief · versie 1/.test($('[data-testid="aa-versie-status"]').textContent));
  check('de definitieve versie heeft geen Verwijderen, wel Terug naar concept en Download voor indienen', !knop('Verwijder versie 1') && !!knop('Terug naar concept') && !!knop('Download voor indienen'));
  check('definitief maken en opslaan kosten geen maandruimte en geen model', V.s.gebruik.length === gebruikVoor);

  await typ($$('[data-testid="aa-onderdeel"] textarea')[0], 'Verder geschreven na definitief.');
  await klik(knop('Opslaan als versie'));
  check('verder schrijven op een definitieve versie maakt een nieuw concept (versie 2) en laat versie 1 ongemoeid', await wacht(() => V.s.versies.size === 2) && [...V.s.versies.values()][0].antwoorden[0].tekst === 'Tweede tekst.' && V.s.tabel.get(rij.id).status === 'concept');
  check('versie 1 blijft de definitieve, versie 2 is het concept', await wacht(() => /Concept · versie 2/.test($('[data-testid="aa-versie-status"]').textContent)) && $$('[data-testid="aa-versie-rij"]').length === 2);

  await typ($$('[data-testid="aa-onderdeel"] textarea')[0], 'Niet bewaard.');
  await klik(knop('Terugzetten'));
  check('terugzetten met niet-opgeslagen tekst vraagt eerst of het mag', await wacht(() => $('[data-testid="aa-versie-vraag-terugzetten"]')));
  await klik(knop('Annuleren'));
  check('annuleren laat de tekst staan', !$('[data-testid="aa-versie-vraag-terugzetten"]') && $$('[data-testid="aa-onderdeel"] textarea')[0].value === 'Niet bewaard.');
  await klik(knop('Terug naar opgeslagen'));
  await klik(knop('Terugzetten'));
  check('terugzetten zonder wijzigingen laadt de oude tekst als nieuwe, nog niet opgeslagen versie', await wacht(() => $$('[data-testid="aa-onderdeel"] textarea')[0].value === 'Tweede tekst.') && /Niet opgeslagen/.test(tekst()) && V.s.versies.size === 2);
  await klik(knop('Opslaan als versie'));
  check('opslaan maakt er versie 3 van; de oude versies zijn niet overschreven', await wacht(() => V.s.versies.size === 3) && [...V.s.versies.values()].map((v) => v.nummer).sort().join() === '1,2,3');

  await klik(knop('Verwijder versie 2'));
  check('verwijderen vraagt eerst om bevestiging', await wacht(() => $('[data-testid="aa-versie-vraag-verwijderen"]')) && V.s.versies.size === 3);
  await klik(knop('Ja, verwijder'));
  check('na bevestigen is versie 2 weg, de andere zijn er nog', await wacht(() => V.s.versies.size === 2) && [...V.s.versies.values()].map((v) => v.nummer).sort().join() === '1,3');

  await klik(knop('Deze versie een naam geven'));
  await typ($('[aria-label="Naam van de versie"]'), 'Voor het bestuur');
  await klik(knop('Bewaar naam'));
  check('een versie hernoemen werkt', await wacht(() => [...V.s.versies.values()].some((v) => v.naam === 'Voor het bestuur')) && /Voor het bestuur/.test(tekst()));

  await typ($$('[data-testid="aa-onderdeel"] textarea')[0], 'Nog niet bewaard.');
  await klik(knop('Terug naar het fonds'));
  check('sluiten met niet-opgeslagen tekst vraagt wat u wilt doen', await wacht(() => $('[data-testid="aa-versie-vraag-sluiten"]')) && !!$('[data-testid="aa-versie-editor"]'));
  await klik(knop('Verder werken'));
  check('verder werken laat u in het scherm', !$('[data-testid="aa-versie-vraag-sluiten"]') && !!$('[data-testid="aa-versie-editor"]'));
  await klik(knop('Terug naar het fonds'));
  await klik(knop('Sluiten zonder opslaan'));
  check('sluiten zonder opslaan brengt u terug naar het fonds', await wacht(() => !$('[data-testid="aa-versie-editor"]') && $('[data-testid="aa-werk"]')));
  check('onderweg is er niets ingediend of beoordeeld: geen model, geen extra beoordelingen', V.s.beoordelingen.size === 0);
  await opruimen();

  // Zonder versies op de server (nog niet uitgerold): het plan blijft zoals voorheen, alleen lezen.
  const Z = maakServer({ zonderVersies: true });
  await openAanvraagEnSchrijf(Z);
  check('zonder versie-opslag toont het scherm het plan zoals voorheen (alleen lezen)', await wacht(() => $('[data-testid="aa-plan"]')) && !$('[data-testid="aa-versie-editor"]') && $$('[data-testid="aa-plan-sectie"]').length === 1);
  await opruimen();
}

sectie('11. Aanvraag indienen: formulier, tekenlimieten, antwoorden per vraag en checklist met stukken');
{
  const docsLid = [
    { naam: 'anbi-beschikking.pdf', soort: 'Overig', gemaakt: new Date().toISOString() },
    { naam: 'jaarrekening-2020.pdf', soort: 'Overig', gemaakt: '2021-02-01T10:00:00Z' },
  ];

  async function openWerk(server, optiesProject = {}) {
    client.__reset();
    client.__zetSupabase(server.supabase);
    await server.supabase.functions.invoke('aanvraag-assistent', { body: { mode: 'eisen-ophalen', projectId: PROJECT, fondsLabel: 'Stichting Voorbeeldfonds', formulierTekst: `1. Beschrijf uw project. ${RICHTLIJN}` } });
    const rij = [...server.s.tabel.values()].find((x) => x.soort === 'fonds');
    const project = { id: PROJECT, naam: 'Samen Spelen', docs: docsLid, ...optiesProject };

    function HarnasFormulier() {
      const assistent = useAanvraagAssistent(true);

      if (!assistent.klaar) return <div>laden</div>;

      return <AanvragenTab project={project} projecten={[project]} onKiesProject={() => {}} store={{ orgProfile: { name: 'Stichting Samen Spelen' } }} assistent={assistent} start={{ aanvraagId: rij.id, nonce: 1 }} />;
    }

    await act(async () => { root.render(<HarnasFormulier />); });
    await wacht(() => $('[data-testid="aa-werk"]'));

    return rij;
  }

  const F = maakServer();
  const rij = await openWerk(F);

  check('het blok voor het formulier staat op het scherm, met de tekenlimiet-attentie', await wacht(() => $('[data-testid="aa-formulier-blok"]')) && /Zonder tekenlimiet kunnen wij u niet helpen/.test($('[data-testid="aa-limiet-attentie"]').textContent));
  check('de attentie noemt dat wij alleen antwoorden schrijven als de limiet is doorgegeven', /Let op: veel fondsen hanteren een tekenlimiet per vraag/.test(tekst()) && /alleen antwoorden voor u schrijven als u die tekenlimiet aan ons doorgeeft/.test(tekst()));
  check('zonder tekst is de knop uit', knop('Maak een vragenlijst en een lijst met stukken').disabled === true);

  await typ($('[data-testid="aa-formulier-tekst"]'), FORMULIER);
  await klik(knop('Maak een vragenlijst en een lijst met stukken'));
  check('het formulier wordt omgezet in een vragenlijst (3 vragen)', await wacht(() => $$('[data-testid="aa-vraag-rij"]').length === 3));
  check('de limiet uit het formulier (1500) staat al bij vraag 1; de andere twee missen hem', $('[aria-label="Tekenlimiet van vraag 1"]').value === '1500' && $('[aria-label="Tekenlimiet van vraag 2"]').value === '' && /Tekenlimiet ontbreekt bij 2 vragen/.test(tekst()));
  check('Bevestigen kan nog niet zolang een limiet ontbreekt', knop('Bevestig de vragenlijst').disabled === true && /Vul bij elke vraag de tekenlimiet in/.test(tekst()));
  check('de lijst met stukken heeft de vier standaardstukken en het stuk uit het formulier', $$('[data-testid="aa-stuk"]').length === 5 && /ANBI-status/.test(tekst()) && /Aanbevelingsbrief van de gemeente/.test(tekst()) && /Uit uw formulier/.test(tekst()));
  check('het lezen van het formulier is bewaard als voorstel (nog niet bevestigd), zonder het bestand', F.s.tabel.get(rij.id).vragen && F.s.tabel.get(rij.id).vragen.bevestigd === false && F.s.tabel.get(rij.id).vragen.lijst.length === 3 && !JSON.stringify(F.s.tabel.get(rij.id)).includes('Bijlagen: een aanbevelingsbrief'));

  await typ($('[aria-label="Tekenlimiet van vraag 2"]'), '1000');
  await klik($('[aria-label="Dit fonds heeft geen limiet voor vraag 3"]'));
  check('met een limiet of "geen limiet" bij elke vraag staat de bevestiging open', await wacht(() => knop('Bevestig de vragenlijst').disabled === false) && /Alle tekenlimieten ingevuld/.test(tekst()));
  await klik(knop('Bevestig de vragenlijst'));
  check('bevestigen bewaart de lijst als bevestigd, met de limieten', await wacht(() => F.s.tabel.get(rij.id).vragen.bevestigd === true) && F.s.tabel.get(rij.id).vragen.lijst.map((v) => `${v.maxTekens}/${v.geenLimiet}`).join() === '1500/false,1000/false,null/true');
  check('daarna toont het blok een samenvatting en de oude schrijfkaart is weg', await wacht(() => $('[data-testid="aa-vragen-samenvatting"]')) && /geen limiet/.test($('[data-testid="aa-vragen-samenvatting"]').textContent) && !$('[data-testid="aa-kaart-schrijven"]') && !!$('[data-testid="aa-kaart-beoordelen"]'));

  await klik(knop('Open uw aanvraag per vraag'));
  check('de aanvraag opent per vraag: 3 antwoordvakken met nummer en nog leeg', await wacht(() => $$('[data-testid="aa-onderdeel"]').length === 3) && $$('[data-testid="aa-onderdeel"] textarea').every((t) => t.value === '') && /1\. Beschrijf de aanleiding/.test(tekst()) && /Nog leeg/.test(tekst()));
  check('de checklist met stukken en "Klaar om in te dienen?" staan ernaast', !!$('[data-testid="aa-versie-stukken"]') && !!$('[data-testid="aa-versie-klaar"]') && /3 vragen hebben nog geen antwoord/.test(tekst()));

  const gebruikVoor = F.s.gebruik.length;
  await klik(knop('Schrijf een concept: Beschrijf de aanleiding'));
  check('Schrijf concept bij vraag 1 vult alleen dat antwoord en slaat het op als versie 1', await wacht(() => F.s.versies.size === 1) && $$('[data-testid="aa-onderdeel"] textarea')[0].value.length > 10 && $$('[data-testid="aa-onderdeel"] textarea')[1].value === '' && $$('[data-testid="aa-onderdeel"] textarea')[2].value === '');
  check('het scherm meldt dat dit als 1 beoordeling telde', await wacht(() => $('[data-testid="aa-versie-melding"]')) && /1 antwoord geschreven en opgeslagen als versie 1/.test(tekst()) && /telde als 1 beoordeling van deze maand/.test(tekst()));
  check('de server onthield het fonds en de maand', F.s.tabel.get(rij.id).schrijf_maand === '2026-10' && F.s.tabel.get(rij.id).schrijf_aantal === 1);

  await klik(knop('Schrijf een concept voor alle lege vragen'));
  check('Schrijf alle lege vragen vult de andere twee', await wacht(() => $$('[data-testid="aa-onderdeel"] textarea').every((t) => t.value.length > 10)));
  check('het tweede keer schrijven voor hetzelfde fonds kost niets extra', await wacht(() => /kostte niets extra/.test(tekst())) && F.s.gebruik.filter((x) => x.actie === 'aanvraag_antwoorden').length === 2 && F.s.tabel.get(rij.id).schrijf_aantal === 3);
  check('alle lege vragen zijn gevuld: de knop voor alle lege vragen is weg', !knop('Schrijf een concept voor alle lege vragen'));
  check('er is niets ingediend: alleen de twee schrijfacties zijn gelogd', F.s.gebruik.length === gebruikVoor + 2 && F.s.beoordelingen.size === 0);

  check('stukken: ANBI-status is herkend in de documentatie, jaarrekening is te oud, de rest is nog nodig', $$('[data-testid="aa-stuk"][data-status="klaar"]').length === 1 && $$('[data-testid="aa-stuk"][data-status="te-oud"]').length === 1 && $$('[data-testid="aa-stuk"][data-status="nodig"]').length === 3 && /In uw projectdocumentatie: anbi-beschikking\.pdf/.test(tekst()));
  check('de tekst bij een te oud bestand vraagt het lid het te controleren', /Controleer of het de nieuwste is/.test(tekst()) && /1 van 5 klaar/.test($('[data-testid="aa-stukken-telling"]').textContent));

  await klik($('[aria-label="Ik heb dit klaar: Statuten"]'));
  check('Statuten afvinken wordt bewaard en telt mee', await wacht(() => (F.s.tabel.get(rij.id).stukken || []).some((x) => x.sleutel === 'statuten' && x.klaar === true)) && /2 van 5 klaar/.test($('[data-testid="aa-stukken-telling"]').textContent));
  await klik(knop('Niet van toepassing: Aanbevelingsbrief'));
  check('een stuk op niet van toepassing zetten haalt het uit de telling', await wacht(() => /2 van 4 klaar/.test($('[data-testid="aa-stukken-telling"]').textContent)) && (F.s.tabel.get(rij.id).stukken || []).some((x) => x.nietVanToepassing === true));
  check('Klaar om in te dienen? toont de stand: antwoorden compleet, stukken ontbreken nog', /Alle 3 vragen hebben een antwoord/.test($('[data-testid="aa-versie-klaar"]').textContent) && /2 stukken ontbreken nog/.test($('[data-testid="aa-versie-klaar"]').textContent) && /Wij dienen nooit iets voor u in/.test($('[data-testid="aa-versie-klaar"]').textContent));

  await typ($$('[data-testid="aa-onderdeel"] textarea')[0], 'x'.repeat(1600));
  check('boven de tekenlimiet: waarschuwing bij het antwoord en in de stand', /Boven de limiet van het fonds, haal 100 tekens weg/.test(tekst()) && /1 antwoord is boven de tekenlimiet/.test($('[data-testid="aa-versie-klaar"]').textContent));

  await klik(knop('Schrijf opnieuw: Beschrijf de aanleiding'));
  check('opnieuw schrijven vraagt eerst om bevestiging', await wacht(() => $('[data-testid="aa-herschrijf-vraag"]')));
  await klik(knop('Ja, schrijf opnieuw'));
  check('na bevestigen staat er een nieuw concept en blijft de tekst van het lid bewaard in een eerdere versie', await wacht(() => $$('[data-testid="aa-onderdeel"] textarea')[0].value.length > 10 && $$('[data-testid="aa-onderdeel"] textarea')[0].value.length < 1600) && [...F.s.versies.values()].some((v) => v.antwoorden.some((a) => a.tekst === 'x'.repeat(1600))));

  await klik(knop('Terug naar het fonds'));
  check('terug op het fondsscherm staat de bevestigde vragenlijst er nog', await wacht(() => $('[data-testid="aa-vragen-samenvatting"]')) && $$('[data-testid="aa-vragen-samenvatting"] li').length === 3);
  await opruimen();

  // Het formulier bevat geen vragen: eerlijke melding, niets bewaard.
  const W = maakServer({ vragenUit: { vragen: [], stukken: [] } });
  const rijW = await openWerk(W);
  await wacht(() => $('[data-testid="aa-formulier-tekst"]'));
  await typ($('[data-testid="aa-formulier-tekst"]'), FORMULIER);
  await klik(knop('Maak een vragenlijst en een lijst met stukken'));
  check('zonder gevonden vragen: een duidelijke melding en geen vragenlijst bewaard', await wacht(() => /Wij vonden geen vragen/.test(tekst())) && !W.s.tabel.get(rijW.id).vragen && $$('[data-testid="aa-vraag-rij"]').length === 0);
  await opruimen();

  // Een server zonder deze functie: het blok verdwijnt en alles werkt zoals voorheen.
  const Z = maakServer({ zonderVragen: true });
  await openWerk(Z);
  check('zonder formulierfunctie op de server verdwijnt het blok en blijft de oude schrijfkaart', await wacht(() => $('[data-testid="aa-kaart-schrijven"]')) && !$('[data-testid="aa-formulier-blok"]'));
  await opruimen();
}

console.log(`\naanvraag-schermen: ${stand.ok} OK, ${stand.fout} FAIL`);
process.exit(stand.fout ? 1 : 0);
