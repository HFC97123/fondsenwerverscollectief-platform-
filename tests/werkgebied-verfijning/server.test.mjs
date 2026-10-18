// Werkgebied-verfijning, serverkant: het gekozen werkgebied (ISO-landcodes) is leidend, de AI doet alleen voorstellen met een letterlijk citaat,
// GeoNames controleert binnen het gekozen land, en onbevestigde voorstellen hebben geen invloed op de matching.
// Echte handler; nagebootste AI, database en GeoNames. GeoNames zelf is vanuit de testomgeving niet bereikbaar: de antwoorden hieronder volgen het
// formaat van de searchJSON-dienst (geonames[]: geonameId, name, toponymName, countryCode, adminName1, fcl, lat, lng).
//   node tests/werkgebied-verfijning/server.test.mjs
import { w, resetGenereren } from '../voorstel-genereren/wereld.mjs';
import '../../supabase/functions/subsidie-kompas/index.ts';
import { isoCodesUitWerkgebied, landVoorIso, isGeldigeLandcode, LAND_REGELS, LANDEN } from '../../supabase/functions/_shared/werkgebied.ts';
import { leesAiPlaatsen, leesGeonames, beoordeelPlaats, ontdubbel, normaliseerWerkgebiedOpslag, geonamesZoekUrl } from '../../supabase/functions/_shared/locatieVerfijning.ts';

const stand = { ok: 0, fout: 0 };
const check = (naam, waar, detail = '') => { if (waar) stand.ok += 1; else { stand.fout += 1; console.log(`  FAIL: ${naam} ${detail}`); } };
const sectie = (t) => console.log(`\n== ${t}`);

// ---------------------------------------------------------------------------------------------------------------------------
// Nagebootste GeoNames
const KUMASI_STAD = { geonameId: 2297172, name: 'Kumasi', toponymName: 'Kumasi', asciiName: 'Kumasi', countryCode: 'GH', adminName1: 'Ashanti', fcl: 'P', lat: '6.68848', lng: '-1.62443' };
const KUMASI_DISTRICT = { geonameId: 2297171, name: 'Kumasi', toponymName: 'Kumasi Metropolitan', asciiName: 'Kumasi', countryCode: 'GH', adminName1: 'Ashanti', fcl: 'A', lat: '6.70000', lng: '-1.63000' };
const KUMASI_ELDERS = { geonameId: 9990001, name: 'Kumasi', toponymName: 'Kumasi', asciiName: 'Kumasi', countryCode: 'ID', adminName1: 'Jawa', fcl: 'P', lat: '-7.0', lng: '110.0' };
const ABOABO_1 = { geonameId: 2306001, name: 'Aboabo', toponymName: 'Aboabo', asciiName: 'Aboabo', countryCode: 'GH', adminName1: 'Ashanti', fcl: 'P', lat: '6.71', lng: '-1.60' };
const ABOABO_2 = { geonameId: 2306002, name: 'Aboabo', toponymName: 'Aboabo', asciiName: 'Aboabo', countryCode: 'GH', adminName1: 'Northern', fcl: 'P', lat: '9.40', lng: '-0.85' };
const NAIROBI = { geonameId: 184745, name: 'Nairobi', toponymName: 'Nairobi', asciiName: 'Nairobi', countryCode: 'KE', adminName1: 'Nairobi Area', fcl: 'P', lat: '-1.28333', lng: '36.81667' };
const GEO = {
  kumasi: [KUMASI_STAD, KUMASI_DISTRICT, KUMASI_ELDERS],
  aboabo: [ABOABO_1, ABOABO_2],
  nairobi: [NAIROBI],
};
const geoLog = [];

const basisFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://secure.geonames.org/searchJSON')) {
    const u = new URL(String(url));
    geoLog.push(String(url));
    if (w.geonamesFout) return new Response('nee', { status: w.geonamesFout });
    const q = (u.searchParams.get('q') || '').toLowerCase();
    const landen = u.searchParams.getAll('country');
    const rijen = (GEO[q] || []).filter((r) => !landen.length || landen.includes(r.countryCode));
    return new Response(JSON.stringify({ totalResultsCount: rijen.length, geonames: rijen }), { status: 200 });
  }
  return basisFetch(url, init);
};

async function post(body, { token = 'jwt' } = {}) {
  const res = await globalThis.__handler(new Request('http://x/f', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }));
  const tekst = await res.text();
  let json = null;
  try { json = JSON.parse(tekst); } catch { /* geen json */ }
  return { status: res.status, json, tekst };
}
const ENV = { OPENAI_API_KEY: 'sk-test', SUPABASE_URL: 'http://db.test', SUPABASE_SERVICE_ROLE_KEY: 'srv', SUPABASE_ANON_KEY: 'anon', VOORSTEL_PREVIEW: 'aan', VOORSTEL_GENEREREN: 'aan', GEONAMES_USERNAME: 'tester' };
const wereld = (extra = {}) => { resetGenereren({ env: ENV, ...extra }); geoLog.length = 0; };

const OMSCHRIJVING_KUMASI = 'Wij versterken kwetsbare gezinnen en beschermen kinderen met scholen en psychosociale ondersteuning in Kumasi, de tweede stad van het land.';
const KUMASI_AI = { plaatsen: [{ naam: 'Kumasi', citaat: 'psychosociale ondersteuning in Kumasi, de tweede stad', rol: 'projectlocatie' }] };

// ---------------------------------------------------------------------------------------------------------------------------
sectie('1. Werkgebied als basis: ISO-landcodes uit het gekozen werkgebied');
{
  check('"Ghana" -> GH', JSON.stringify(isoCodesUitWerkgebied('Ghana')) === '["GH"]');
  check('"Kumasi, Ghana" -> GH (de plaats levert zelf niets op)', JSON.stringify(isoCodesUitWerkgebied('Kumasi, Ghana')) === '["GH"]');
  check('"Kumasi" alleen -> geen land (er wordt niets afgeleid)', isoCodesUitWerkgebied('Kumasi').length === 0);
  check('Engelse en oude schrijfwijzen: Ivory Coast, Cabo Verde', JSON.stringify(isoCodesUitWerkgebied('Ivory Coast; Cabo Verde')) === '["CI","CV"]');
  check('meerdere landen met "en": Ghana en Kenia', JSON.stringify(isoCodesUitWerkgebied('Ghana en Kenia')) === '["GH","KE"]');
  check('landnaam met "en" blijft heel: Trinidad en Tobago', JSON.stringify(isoCodesUitWerkgebied('Trinidad en Tobago')) === '["TT"]');
  check('andere soorten werkgebieden blijven bestaan: regio\'s en Nederland', isoCodesUitWerkgebied('West-Afrika').length === 0 && isoCodesUitWerkgebied('Utrecht en Flevoland').length === 0 && JSON.stringify(isoCodesUitWerkgebied('Landelijk, Nederland')) === '["NL"]');
  check('elk land in de tabel heeft een geldige tweeletterige ISO-code', LANDEN.every((l) => /^[A-Z]{2}$/.test(l.iso)) && LANDEN.length > 150);
  check('landVoorIso en isGeldigeLandcode', landVoorIso('GH')?.naam === 'Ghana' && isGeldigeLandcode('nl') && !isGeldigeLandcode('ZZ') && !isGeldigeLandcode(''));
  check('elke naam en elk alias geeft zijn eigen code', LAND_REGELS.every((r) => r.termen.every((t) => isoCodesUitWerkgebied(t)[0] === r.iso)));
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('2. Zuivere stappen: de AI mag alleen voorstellen wat aantoonbaar in de tekst staat');
{
  check('Kumasi met letterlijk citaat: voorstel', leesAiPlaatsen(KUMASI_AI, OMSCHRIJVING_KUMASI).map((p) => p.naam).join() === 'Kumasi');
  check('beschrijving ZONDER plaatsnaam: lege lijst', leesAiPlaatsen({ plaatsen: [] }, 'Wij ondersteunen gezinnen met scholing en begeleiding.').length === 0);
  check('verzonnen plaats (staat niet in de tekst): valt af', leesAiPlaatsen({ plaatsen: [{ naam: 'Accra', citaat: 'activiteiten in Accra', rol: 'projectlocatie' }] }, OMSCHRIJVING_KUMASI).length === 0);
  check('citaat dat niet letterlijk in de tekst staat: valt af', leesAiPlaatsen({ plaatsen: [{ naam: 'Kumasi', citaat: 'we werken in het hart van Kumasi', rol: 'projectlocatie' }] }, OMSCHRIJVING_KUMASI).length === 0);
  check('plaats die niet in het eigen citaat staat: valt af', leesAiPlaatsen({ plaatsen: [{ naam: 'Kumasi', citaat: 'kwetsbare gezinnen en beschermen kinderen', rol: 'projectlocatie' }] }, OMSCHRIJVING_KUMASI).length === 0);
  check('rol "anders" (kantoor, partner, voorbeeld): valt af', leesAiPlaatsen({ plaatsen: [{ naam: 'Amsterdam', citaat: 'ons kantoor in Amsterdam', rol: 'anders' }] }, 'Dit is ons kantoor in Amsterdam. Het project loopt elders.').length === 0);
  check('een land of werelddeel is geen verfijning', leesAiPlaatsen({ plaatsen: [{ naam: 'Ghana', citaat: 'het project in Ghana', rol: 'projectlocatie' }] }, 'Het project in Ghana start in 2027.').length === 0);
  check('dubbelen en rommel worden genegeerd', leesAiPlaatsen({ plaatsen: [KUMASI_AI.plaatsen[0], KUMASI_AI.plaatsen[0], null, 'x', { naam: 5 }] }, OMSCHRIJVING_KUMASI).length === 1 && leesAiPlaatsen('rommel', 'tekst').length === 0);

  const url = geonamesZoekUrl('Kumasi', ['GH', 'KE'], 'tester');
  check('GeoNames-aanroep: naam, gekozen landen als beperking, alleen plaatsen en gebieden', url.includes('q=Kumasi') && url.includes('country=GH') && url.includes('country=KE') && url.includes('featureClass=P') && url.includes('featureClass=A') && url.startsWith('https://secure.geonames.org/searchJSON'));
  check('GeoNames-antwoord: alleen treffers die de gezochte naam dragen', leesGeonames({ geonames: [KUMASI_STAD, { ...KUMASI_STAD, geonameId: 5, name: 'Kumasi Heights', toponymName: 'Kumasi Heights', asciiName: 'Kumasi Heights' }, { ...KUMASI_STAD, geonameId: 6, fcl: 'H' }] }, 'Kumasi').length === 1);
  check('stad en district met dezelfde naam vlakbij elkaar zijn één plaats', ontdubbel(leesGeonames({ geonames: [KUMASI_STAD, KUMASI_DISTRICT] }, 'Kumasi')).length === 1);
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('3. Kumasi / Ghana: een uniek voorstel, met GeoNames-ID, landcode en coördinaten');
{
  wereld({ zoekprofielAi: KUMASI_AI });
  const r = await post({ mode: 'werkgebied-verfijning', tekst: OMSCHRIJVING_KUMASI, landen: ['GH'] });
  const s = r.json?.suggesties?.[0];

  check('antwoord ok met één voorstel', r.status === 200 && r.json?.ok === true && r.json.suggesties.length === 1, r.tekst);
  check('status "uniek" voor Kumasi, Ghana', s?.status === 'uniek' && s.kandidaten.length === 1 && s.naam === 'Kumasi');
  check('GeoNames-ID, plaatsnaam, landcode en coördinaten zijn aanwezig', s?.kandidaten[0].geonamesId === 2297172 && s.kandidaten[0].naam === 'Kumasi' && s.kandidaten[0].landcode === 'GH' && s.kandidaten[0].lat === 6.68848 && s.kandidaten[0].lng === -1.62443 && s.kandidaten[0].landnaam === 'Ghana');
  check('het bewijs (citaat) gaat mee, zodat het lid ziet waarom', s?.bewijs.includes('Kumasi'));
  check('GeoNames is beperkt tot het gekozen land en er is geen tweede (onbeperkte) zoekopdracht nodig', geoLog.length === 1 && geoLog[0].includes('country=GH'));
  check('de server schrijft niets: geen schrijfacties op projecten', w.dbSchrijfLog.length === 0);
  check('de AI krijgt de tekst als DATA en de regels voor citaat en rol', w.chatBodies.length === 1 && /LETTERLIJK/.test(w.chatBodies[0].messages[0].content) && w.chatBodies[0].messages[1].content === OMSCHRIJVING_KUMASI && w.chatBodies[0].temperature === 0);
  check('model is het standaardmodel (geen redeneermodel dat temperature weigert)', !/gpt-5/.test(w.chatBodies[0].model));
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('4. Dubbelzinnige plaatsnaam: het lid kiest');
{
  wereld({ zoekprofielAi: { plaatsen: [{ naam: 'Aboabo', citaat: 'wijkopbouw in Aboabo', rol: 'projectlocatie' }] } });
  const r = await post({ mode: 'werkgebied-verfijning', tekst: 'We doen wijkopbouw in Aboabo met gezinnen en scholen.', landen: ['GH'] });
  const s = r.json?.suggesties?.[0];

  check('status "kies" met beide plaatsen, elk met eigen GeoNames-ID en regio', s?.status === 'kies' && s.kandidaten.length === 2 && new Set(s.kandidaten.map((k) => k.geonamesId)).size === 2 && s.kandidaten.map((k) => k.regio).join() === 'Ashanti,Northern');
  check('niets wordt automatisch gekozen of opgeslagen', w.dbSchrijfLog.length === 0 && r.json.suggesties.length === 1);
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('5. Locatie buiten het gekozen land: vragen om controle, nooit het werkgebied wijzigen');
{
  wereld({ zoekprofielAi: { plaatsen: [{ naam: 'Nairobi', citaat: 'trainingen in Nairobi', rol: 'projectlocatie' }] } });
  const r = await post({ mode: 'werkgebied-verfijning', tekst: 'Het project omvat trainingen in Nairobi voor gezinnen en scholen.', landen: ['GH'] });
  const s = r.json?.suggesties?.[0];

  check('status "buiten-land" met het land waar de plaats werkelijk ligt (Kenia)', s?.status === 'buiten-land' && s.kandidaten[0].landcode === 'KE' && s.kandidaten[0].landnaam === 'Kenia');
  check('eerst binnen het gekozen land gezocht, daarna zonder beperking', geoLog.length === 2 && geoLog[0].includes('country=GH') && !geoLog[1].includes('country='));
  check('het antwoord bevat geen wijziging van het werkgebied', !('werkgebied' in r.json) && !('landen' in r.json) && w.dbSchrijfLog.length === 0);

  // Dezelfde plaatsnaam bestaat ook elders (Kumasi in Indonesië), maar binnen Ghana wordt alleen Ghana getoond.
  wereld({ zoekprofielAi: KUMASI_AI });
  const g = await post({ mode: 'werkgebied-verfijning', tekst: OMSCHRIJVING_KUMASI, landen: ['GH'] });
  check('een gelijknamige plaats in een ander land wordt niet voorgesteld', g.json.suggesties[0].kandidaten.every((k) => k.landcode === 'GH'));
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('6. Beschrijving zonder plaatsnaam, geen gekozen land, uitval van diensten');
{
  wereld({ zoekprofielAi: { plaatsen: [] } });
  const r = await post({ mode: 'werkgebied-verfijning', tekst: 'Wij ondersteunen kwetsbare gezinnen met begeleiding en scholing, nu en de komende jaren.', landen: ['GH'] });
  check('geen plaatsnaam: geen voorstellen en geen GeoNames-aanroep', r.json?.ok === true && r.json.suggesties.length === 0 && geoLog.length === 0);

  wereld({ zoekprofielAi: KUMASI_AI });
  const zonderLand = await post({ mode: 'werkgebied-verfijning', tekst: OMSCHRIJVING_KUMASI, landen: [] });
  check('zonder gekozen land: niets te verfijnen, geen AI-aanroep', zonderLand.json.suggesties.length === 0 && w.chatBodies.length === 0 && geoLog.length === 0);
  const ongeldig = await post({ mode: 'werkgebied-verfijning', tekst: OMSCHRIJVING_KUMASI, landen: ['ZZ', 'xx', 5] });
  check('ongeldige landcodes tellen niet als gekozen land', ongeldig.json.suggesties.length === 0 && w.chatBodies.length === 0);
  const kort = await post({ mode: 'werkgebied-verfijning', tekst: 'Kumasi', landen: ['GH'] });
  check('te korte tekst: geen aanroep', kort.json.suggesties.length === 0 && w.chatBodies.length === 0);
  check('zonder login: 401', (await post({ mode: 'werkgebied-verfijning', tekst: OMSCHRIJVING_KUMASI, landen: ['GH'] }, { token: null })).status === 401);

  wereld({ zoekprofielAi: KUMASI_AI, geonamesFout: 500 });
  const stuk = await post({ mode: 'werkgebied-verfijning', tekst: OMSCHRIJVING_KUMASI, landen: ['GH'] });
  check('GeoNames valt uit: geen voorstel (geen gok op basis van het model), formulier blijft werken', stuk.status === 200 && stuk.json.ok === true && stuk.json.suggesties.length === 0 && stuk.json.beschikbaar === false);

  wereld({ zoekprofielAi: 'fout' });
  const aiFout = await post({ mode: 'werkgebied-verfijning', tekst: OMSCHRIJVING_KUMASI, landen: ['GH'] });
  check('AI valt uit: geen voorstel, geen fout voor het lid', aiFout.status === 200 && aiFout.json.suggesties.length === 0);

  resetGenereren({ env: { ...ENV, GEONAMES_USERNAME: undefined }, zoekprofielAi: KUMASI_AI });
  delete w.env.GEONAMES_USERNAME;
  const zonderGebruiker = await post({ mode: 'werkgebied-verfijning', tekst: OMSCHRIJVING_KUMASI, landen: ['GH'] });
  check('GeoNames niet ingesteld (geheim ontbreekt): geen voorstellen, geen AI-kosten', zonderGebruiker.json.suggesties.length === 0 && zonderGebruiker.json.beschikbaar === false && w.chatBodies.length === 0);
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('7. Opslag en matching: alleen bevestigde verfijningen binnen een gekozen land tellen');
{
  const bevestigd = { landen: ['GH'], verfijningen: [{ geonamesId: 2297172, naam: 'Kumasi', landcode: 'GH', lat: 6.68848, lng: -1.62443 }] };
  const n = normaliseerWerkgebiedOpslag({ ...bevestigd, verfijningen: [...bevestigd.verfijningen, { geonamesId: 184745, naam: 'Nairobi', landcode: 'KE' }, { geonamesId: 'x', naam: 'Kapot', landcode: 'GH' }, { geonamesId: 2297172, naam: 'Dubbel', landcode: 'GH' }, { naam: 'Zonder ID', landcode: 'GH' }] }, ['GH']);

  check('bevestigde plaats binnen het gekozen land blijft, met ID, landcode en coördinaten', n.verfijningen.length === 1 && n.verfijningen[0].geonamesId === 2297172 && n.verfijningen[0].lat === 6.68848 && n.landen.join() === 'GH');
  check('een plaats buiten het gekozen land, zonder ID of dubbel wordt genegeerd', !n.verfijningen.some((v) => v.landcode === 'KE' || v.naam === 'Dubbel' || v.naam === 'Zonder ID'));
  check('zonder opgeslagen waarde: geen verfijningen', normaliseerWerkgebiedOpslag(null, ['GH']).verfijningen.length === 0 && normaliseerWerkgebiedOpslag('rommel', []).landen.length === 0);
}

console.log(`\nwerkgebied-verfijning (server): ${stand.ok} OK, ${stand.fout} FOUT`);
process.exit(stand.fout ? 1 : 0);
