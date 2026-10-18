// Werkgebied-verfijning, clientkant: landenlijst/ISO-codes in lijn met de server, opslag, en het bevestigingsblokje onder het werkgebiedveld.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
const g = globalThis;
g.window = dom.window; g.document = dom.window.document; g.localStorage = dom.window.localStorage;
Object.defineProperty(g, 'navigator', { value: dom.window.navigator, configurable: true });
g.HTMLElement = dom.window.HTMLElement; g.Event = dom.window.Event; g.MouseEvent = dom.window.MouseEvent;
g.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import('react')).default;
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const client = await import('../checkout-frontend/fake-client.js');
const { readFileSync } = await import('node:fs');
const { join } = await import('node:path');
const C = await import('../../src/shared/werkgebied/werkgebied.js');
const S = await import('../../src/data/services/werkgebied.js');
const { naarKolomPatch } = await import('../../src/data/services/projecten.js');
const { default: WerkgebiedVerfijning } = await import('../../src/features/kompas-app/WerkgebiedVerfijning.jsx');
const { default: NieuwProjectFormulier } = await import('../../src/features/kompas-app/NieuwProjectFormulier.jsx');
const server = await import('../../supabase/functions/_shared/werkgebied.ts');
const { bouwInhoud } = await import('../../scripts/genereer-landen.mjs');

const ROOT = process.env.REPO_ROOT || process.cwd();
const stand = { ok: 0, fout: 0 };
const check = (naam, waar, detail = '') => { if (waar) stand.ok += 1; else { stand.fout += 1; console.log(`  FAIL: ${naam} ${detail}`); } };
const sectie = (t) => console.log(`\n== ${t}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------------------------------------------------------
sectie('1. Landenlijst en ISO-codes: formulier en server gebruiken dezelfde bron');
{
  check('het gegenereerde bestand is actueel (node --experimental-strip-types scripts/genereer-landen.mjs)', readFileSync(join(ROOT, 'src/shared/werkgebied/landen.generated.js'), 'utf8') === bouwInhoud());
  const monsters = ['Ghana', 'Kumasi, Ghana', 'Kumasi', 'Ghana en Kenia', 'Trinidad en Tobago', 'Utrecht en Flevoland', 'West-Afrika', 'Nederland, Aruba', 'Ivory Coast; Cabo Verde', 'Ghana (Kumasi)', 'Landelijk', '', 'Bosnië en Herzegovina, Kosovo', 'Saint Kitts en Nevis en Ghana'];

  check('de clientfunctie geeft dezelfde codes als de serverfunctie', monsters.every((m) => JSON.stringify(C.isoCodesUitWerkgebied(m)) === JSON.stringify(server.isoCodesUitWerkgebied(m))), monsters.filter((m) => JSON.stringify(C.isoCodesUitWerkgebied(m)) !== JSON.stringify(server.isoCodesUitWerkgebied(m))).join('|'));
  check('elke landnaam en schrijfwijze geeft in het formulier zijn eigen code', server.LAND_REGELS.every((r) => r.termen.every((t) => C.isoCodesUitWerkgebied(t)[0] === r.iso)));
  check('de landen staan als suggestie klaar (Nederlands), inclusief Ghana en Nederland', C.LANDNAMEN.includes('Ghana') && C.LANDNAMEN.includes('Nederland') && C.LANDNAMEN.length > 150);
  check('Kumasi alleen levert geen land op', C.isoCodesUitWerkgebied('Kumasi').length === 0);
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('2. Opslag: ISO-landcode van het gekozen werkgebied + alleen bevestigde verfijningen');
{
  const kumasi = { geonamesId: 2297172, naam: 'Kumasi', landcode: 'GH', lat: 6.68848, lng: -1.62443 };
  const basis = { naam: 'Sterke families', regio: 'Ghana', doelgroep: [], discipline: [], begroting: 200000, eigenBijdrage: 0 };
  const p = naarKolomPatch({ ...basis, werkgebied: { landen: ['GH'], verfijningen: [kumasi] } });

  check('werkgebied "Ghana" wordt als ISO-code opgeslagen; het werkgebied zelf blijft ongewijzigd in location', p.location === 'Ghana' && p.work_area.landen.join() === 'GH');
  check('bevestigde verfijning bewaart GeoNames-ID, plaatsnaam, landcode en coördinaten', JSON.stringify(p.work_area.verfijningen) === JSON.stringify([kumasi]));
  check('zonder bevestiging (geen verfijning in het project): alleen het gekozen land', JSON.stringify(naarKolomPatch(basis).work_area) === JSON.stringify({ landen: ['GH'], verfijningen: [] }));
  check('de landen komen uit het gekozen werkgebied, niet uit de opgeslagen lijst (verouderde landen vervallen)', naarKolomPatch({ ...basis, regio: 'Kenia', werkgebied: { landen: ['GH'], verfijningen: [kumasi] } }).work_area.landen.join() === 'KE');
  check('een verfijning buiten het (nieuw) gekozen land vervalt; het werkgebied wordt niet automatisch aangepast', JSON.stringify(naarKolomPatch({ ...basis, regio: 'Kenia', werkgebied: { landen: ['GH'], verfijningen: [kumasi] } }).work_area.verfijningen) === '[]' && naarKolomPatch({ ...basis, regio: 'Kenia', werkgebied: { verfijningen: [kumasi] } }).location === 'Kenia');
  check('andere werkgebieden (Landelijk, Utrecht) schrijven geen work_area: bestaande projecten blijven ongemoeid', !('work_area' in naarKolomPatch({ ...basis, regio: 'Landelijk' })) && !('work_area' in naarKolomPatch({ ...basis, regio: 'Utrecht en Flevoland' })));
  check('een project dat al een waarde had en geen land meer heeft, wordt netjes leeggemaakt', JSON.stringify(naarKolomPatch({ ...basis, regio: 'Landelijk', werkgebied: { landen: ['GH'], verfijningen: [kumasi] } }).work_area) === JSON.stringify({ landen: [], verfijningen: [] }));
  check('ongeldige verfijningen (geen ID, dubbel) worden niet bewaard', C.werkgebiedVoorOpslag('Ghana', [{ naam: 'x', landcode: 'GH' }, kumasi, kumasi]).verfijningen.length === 1);
  check('leesWerkgebied: null blijft null, rommel crasht niet', C.leesWerkgebied(null) === null && C.leesWerkgebied('x') === null && C.leesWerkgebied({ landen: 5 }).landen.length === 0);
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('3. Service: alleen lezen, nooit een fout naar het formulier');
{
  client.__reset();
  client.__zetSupabase(client.maakClient(() => ({ data: { ok: true, suggesties: [{ naam: 'Kumasi', status: 'uniek', kandidaten: [] }] }, error: null })));
  const goed = await S.haalVerfijningsvoorstellen({ tekst: 'Een tekst over Kumasi in het project.', landen: ['GH'] });

  check('stuurt modus werkgebied-verfijning met tekst en landcodes naar de bestaande functie', client.log.invoke.length === 1 && client.log.invoke[0].naam === 'subsidie-kompas' && client.log.invoke[0].opties.body.mode === 'werkgebied-verfijning' && client.log.invoke[0].opties.body.landen[0] === 'GH');
  check('antwoord met voorstellen komt door', goed.ok && goed.suggesties.length === 1);

  client.__reset();
  const geenLand = await S.haalVerfijningsvoorstellen({ tekst: 'Tekst', landen: [] });
  check('zonder gekozen land: geen aanroep', client.log.invoke.length === 0 && geenLand.suggesties.length === 0);

  client.__zetSupabase(client.maakClient(() => ({ data: null, error: new Error('boem') })));
  const fout = await S.haalVerfijningsvoorstellen({ tekst: 'Tekst over Kumasi', landen: ['GH'] });
  check('fout van de server: geen voorstellen, geen uitzondering', fout.ok === false && fout.suggesties.length === 0);

  client.__zetSupabase(client.maakClient(() => { throw new Error('netwerk'); }));
  const gooit = await S.haalVerfijningsvoorstellen({ tekst: 'Tekst over Kumasi', landen: ['GH'] });
  check('netwerkfout: geen voorstellen, geen uitzondering', gooit.ok === false && gooit.suggesties.length === 0);
}

// ---------------------------------------------------------------------------------------------------------------------------
// Component
const root = createRoot(document.getElementById('root'));
const KUMASI = { geonamesId: 2297172, naam: 'Kumasi', landcode: 'GH', landnaam: 'Ghana', regio: 'Ashanti', lat: 6.68848, lng: -1.62443 };
const OMSCHRIJVING = 'We beschermen kinderen en versterken gezinnen met scholen in Kumasi.';
const knoppen = (testid) => [...document.querySelectorAll(`[data-testid="${testid}"]`)];
const klik = async (el) => { await act(async () => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); }); await sleep(5); };
const tekst = () => document.getElementById('root').textContent;

async function toon({ regio = 'Ghana', omschrijving = OMSCHRIJVING, werkgebied = undefined, sleutel = 1, antwoord = [] } = {}) {
  const aanroepen = [];
  const gezet = [];
  const haal = async (a) => { aanroepen.push(a); return { ok: true, suggesties: antwoord }; };
  const ui = (r, w, s) => <WerkgebiedVerfijning regio={r} omschrijving={omschrijving} werkgebied={w} setWerkgebied={(x) => gezet.push(x)} controleSleutel={s} haal={haal} />;

  await act(async () => { root.render(null); });
  await act(async () => { root.render(ui(regio, werkgebied, sleutel)); });
  await sleep(10);

  return { aanroepen, gezet, ui, render: async (r, w, s) => { await act(async () => { root.render(ui(r, w, s)); }); await sleep(10); } };
}

sectie('4. Kumasi / Ghana: de app vraagt, het lid bevestigt');
{
  const t = await toon({ antwoord: [{ naam: 'Kumasi', bewijs: 'scholen in Kumasi', status: 'uniek', kandidaten: [KUMASI] }] });

  check('de vraag staat er: "We herkennen Kumasi in je beschrijving. Wil je Kumasi, Ashanti, Ghana toevoegen als specifieker werkgebied?"', /We herkennen Kumasi in je beschrijving\. Wil je Kumasi, Ashanti, Ghana toevoegen als specifieker werkgebied\?/.test(tekst()), tekst());
  check('de AI wordt gevraagd met het gekozen land (GH)', t.aanroepen.length === 1 && t.aanroepen[0].landen.join() === 'GH');
  check('zonder klik is er niets opgeslagen of gewijzigd', t.gezet.length === 0);

  await klik(knoppen('np-verfijning-ja')[0]);
  check('na "Ja, toevoegen": verfijning met GeoNames-ID, plaats, landcode en coördinaten; de landen blijven het gekozen werkgebied', t.gezet.length === 1 && JSON.stringify(t.gezet[0]) === JSON.stringify({ landen: ['GH'], verfijningen: [{ geonamesId: 2297172, naam: 'Kumasi', landcode: 'GH', lat: 6.68848, lng: -1.62443 }] }), JSON.stringify(t.gezet));
  check('het voorstel is weg na de keuze', knoppen('np-verfijning-uniek').length === 0);
}

sectie('5. "Nee" en bevestigde verfijning zichtbaar/verwijderbaar');
{
  const t = await toon({ antwoord: [{ naam: 'Kumasi', bewijs: 'x', status: 'uniek', kandidaten: [KUMASI] }] });

  await klik(knoppen('np-verfijning-nee')[0]);
  check('"Nee": niets opgeslagen, voorstel verdwijnt', t.gezet.length === 0 && knoppen('np-verfijning-uniek').length === 0);

  const b = await toon({ werkgebied: { landen: ['GH'], verfijningen: [{ geonamesId: 2297172, naam: 'Kumasi', landcode: 'GH', lat: 6.7, lng: -1.6 }] }, sleutel: 0 });

  check('bevestigde verfijning staat als "Specifieker werkgebied: Kumasi (Ghana)"', /Specifieker werkgebied:\s*Kumasi\s*\(Ghana\)/.test(tekst()), tekst());
  await klik(knoppen('np-verfijning-verwijder')[0]);
  check('verwijderen laat het gekozen land staan en haalt alleen de verfijning weg', b.gezet.length === 1 && b.gezet[0].landen.join() === 'GH' && b.gezet[0].verfijningen.length === 0);

  await b.render('Kenia', { landen: ['GH'], verfijningen: [{ geonamesId: 2297172, naam: 'Kumasi', landcode: 'GH' }] }, 0);
  check('werkgebied gewijzigd naar Kenia: een verfijning in Ghana wordt niet meer getoond (en niet automatisch overgezet)', !/Kumasi/.test(tekst()) && b.gezet.length === 1);
}

sectie('6. Dubbelzinnige plaatsnaam: het lid kiest');
{
  const A1 = { geonamesId: 2306001, naam: 'Aboabo', landcode: 'GH', landnaam: 'Ghana', regio: 'Ashanti', lat: 6.71, lng: -1.6 };
  const A2 = { geonamesId: 2306002, naam: 'Aboabo', landcode: 'GH', landnaam: 'Ghana', regio: 'Northern', lat: 9.4, lng: -0.85 };
  const t = await toon({ omschrijving: 'Wijkopbouw in Aboabo met gezinnen en scholen.', antwoord: [{ naam: 'Aboabo', bewijs: 'Wijkopbouw in Aboabo', status: 'kies', kandidaten: [A1, A2] }] });

  check('beide plaatsen worden getoond met hun regio, plus "Geen van deze"', knoppen('np-verfijning-optie').length === 2 && /Aboabo, Ashanti, Ghana/.test(tekst()) && /Aboabo, Northern, Ghana/.test(tekst()) && /Geen van deze/.test(tekst()));
  check('niets is voorgekozen', t.gezet.length === 0);

  await klik(knoppen('np-verfijning-optie')[1]);
  check('de gekozen plaats (Northern) wordt toegevoegd, de andere niet', t.gezet.length === 1 && t.gezet[0].verfijningen.length === 1 && t.gezet[0].verfijningen[0].geonamesId === 2306002);
}

sectie('7. Plaats buiten het gekozen land: controle vragen, niets wijzigen');
{
  const NAIROBI = { geonamesId: 184745, naam: 'Nairobi', landcode: 'KE', landnaam: 'Kenia', regio: 'Nairobi Area', lat: -1.28, lng: 36.8 };
  const t = await toon({ omschrijving: 'Trainingen in Nairobi voor gezinnen en scholen in het project.', antwoord: [{ naam: 'Nairobi', bewijs: 'Trainingen in Nairobi', status: 'buiten-land', kandidaten: [NAIROBI] }] });

  check('melding: Nairobi lijkt in Kenia te liggen; controleer de locatie of het werkgebied', /Nairobi, maar dat lijkt in Kenia te liggen en niet in je gekozen werkgebied\. Controleer de locatie of het werkgebied\./.test(tekst()), tekst());
  check('er is geen knop om de plaats toe te voegen en het werkgebied wordt niet aangepast', knoppen('np-verfijning-ja').length === 0 && knoppen('np-verfijning-optie').length === 0 && t.gezet.length === 0);
  await klik(knoppen('np-verfijning-negeer')[0]);
  check('"Begrepen" sluit de melding zonder iets te wijzigen', knoppen('np-verfijning-buiten').length === 0 && t.gezet.length === 0);
}

sectie('8. Geen plaatsnaam, geen gekozen land, nog niet gecontroleerd: stil en zonder aanroep');
{
  const leeg = await toon({ omschrijving: 'Wij ondersteunen kwetsbare gezinnen met scholing en begeleiding in de komende jaren.', antwoord: [] });
  check('beschrijving zonder plaatsnaam: niets te zien', leeg.aanroepen.length === 1 && document.querySelector('[data-testid="np-verfijning"]').textContent === '');

  const zonderLand = await toon({ regio: 'West-Afrika', antwoord: [{ naam: 'Kumasi', status: 'uniek', kandidaten: [KUMASI] }] });
  check('werkgebied zonder land (West-Afrika): geen aanroep en geen voorstel', zonderLand.aanroepen.length === 0 && !document.querySelector('[data-testid="np-verfijning"]'));

  const nog = await toon({ sleutel: 0, antwoord: [{ naam: 'Kumasi', status: 'uniek', kandidaten: [KUMASI] }] });
  check('nog niet uit het veld gegaan (geen controlemoment): geen aanroep per toetsaanslag', nog.aanroepen.length === 0);

  const kort = await toon({ omschrijving: 'Kumasi', antwoord: [{ naam: 'Kumasi', status: 'uniek', kandidaten: [KUMASI] }] });
  check('te korte tekst: geen aanroep', kort.aanroepen.length === 0);
}

sectie('9. Het formulier: één werkgebiedveld, landen als suggestie, onbevestigd verandert niets');
{
  const velden = { naam: 'Sterke families', regio: 'Ghana', omschrijving: OMSCHRIJVING, doelgroep: [], discipline: [], begroting: '200000', eigenBijdrage: '' };
  const gezet = [];
  await act(async () => { root.render(<NieuwProjectFormulier form={velden} setVeld={(k, v) => gezet.push([k, v])} doelgroepen={[]} themas={[]} regios={['Afrika', 'Landelijk']} onOpslaan={() => {}} onAnnuleer={() => {}} />); });
  await sleep(10);

  const opties = [...document.querySelectorAll('#np-regio-opties option')].map((o) => o.getAttribute('value'));
  check('de bestaande werkgebieden blijven en de landen komen erbij (Ghana, Nederland)', opties.includes('Afrika') && opties.includes('Landelijk') && opties.includes('Ghana') && opties.includes('Nederland'));
  check('er is nog steeds één werkgebiedveld en geen verplicht veld voor stad of plaats', document.querySelectorAll('[data-testid="np-regio"]').length === 1 && !document.querySelector('[data-testid="np-stad"]') && !document.querySelector('[data-testid="np-plaats"]'));
  check('het formulier verandert niets zonder bevestiging', gezet.length === 0);
}

console.log(`\nwerkgebied-verfijning (client): ${stand.ok} OK, ${stand.fout} FOUT`);
process.exit(stand.fout ? 1 : 0);
