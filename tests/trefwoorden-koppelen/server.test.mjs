// Slimme herkenning ("Laat Claude meedenken"), serverkant. Echte handler; nagebootste AI en database.
//   node tests/trefwoorden-koppelen/run.mjs (vanuit de repo-root)
import { UID, w, resetGenereren } from '../voorstel-genereren/wereld.mjs';
import '../../supabase/functions/subsidie-kompas/index.ts';
import { schoonEigenTermen, leesTrefwoordKoppelingen, herkenEigenTermen, trefwoordSysteem, trefwoordGebruikersbericht, DAGLIMIET_TREFWOORDEN } from '../../supabase/functions/_shared/trefwoordKoppelen.ts';

const stand = { ok: 0, fout: 0 };
const check = (naam, waar, detail = '') => { if (waar) stand.ok += 1; else { stand.fout += 1; console.log(`  FAIL: ${naam} ${detail}`); } };
const sectie = (t) => console.log(`\n== ${t}`);

const TAX = { themas: ['Muziek', 'Cultuur', 'Jeugd en kinderen', 'Natuur', 'Sport'], doelgroepen: ['Jongeren', 'Ouderen'], regios: ['Rotterdam', 'Amsterdam', 'Zuid-Holland', 'Landelijk'] };
const LEEG = { discipline: [], doelgroep: [], regio: [] };
const TEKST = 'Wij organiseren naschoolse drumlessen voor kinderen in de wijk, in Rotterdam, met oudere vrijwilligers.';
const inv = (extra = {}) => ({ tekst: TEKST, eigenTermen: [], gekozen: LEEG, ...extra });

async function post(body, { token = 'jwt' } = {}) {
  const res = await globalThis.__handler(new Request('http://x/f', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }));
  const tekst = await res.text();
  let json = null;
  try { json = JSON.parse(tekst); } catch { /* geen json */ }
  return { status: res.status, json, tekst };
}
const ENV = { OPENAI_API_KEY: 'sk-test', SUPABASE_URL: 'http://db.test', SUPABASE_SERVICE_ROLE_KEY: 'srv', SUPABASE_ANON_KEY: 'anon' };
const wereld = (extra = {}) => resetGenereren({ env: ENV, ...extra });

// ---------------------------------------------------------------------------------------------------------------------------
sectie('1. Eigen woorden schoonmaken');
{
  check('tekst met komma\'s en regels wordt een lijst', JSON.stringify(schoonEigenTermen('drums, ritme;\nbuurtwerk')) === '["drums","ritme","buurtwerk"]');
  check('dubbelen (ook andere hoofdletters) en lege woorden vallen af', schoonEigenTermen(['Drums', 'drums', ' ', '', 'x']).join() === 'Drums');
  check('te lange woorden vallen af', schoonEigenTermen(['a'.repeat(61), 'ok woord']).join() === 'ok woord');
  check('maximaal 12 woorden', schoonEigenTermen(Array.from({ length: 30 }, (_, i) => `woord ${i}`)).length === 12);
  check('rommel geeft een lege lijst', schoonEigenTermen(null).length === 0 && schoonEigenTermen(42).length === 0 && schoonEigenTermen([null, {}, 5]).length === 1);
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('2. Zuivere stap: alleen exacte tabelwaarden met controleerbaar bewijs');
{
  const goed = { koppelingen: [
    { categorie: 'doelgroep', waarde: 'jongeren', citaat: 'naschoolse drumlessen voor kinderen', eigen_woord: '' },
    { categorie: 'discipline', waarde: 'Jeugd en kinderen', citaat: 'drumlessen voor kinderen in de wijk', eigen_woord: '' },
    { categorie: 'werkgebied', waarde: 'Rotterdam', citaat: 'in Rotterdam', eigen_woord: '' },
  ] };
  const u = leesTrefwoordKoppelingen(goed, TAX, inv());
  check('drie voorstellen; hoofdletter-ongevoelig teruggemapt op de canonieke naam', u.voorstellen.map((v) => `${v.categorie}:${v.naam}`).join() === 'doelgroep:Jongeren,discipline:Jeugd en kinderen,regio:Rotterdam');
  check('citaat gaat mee als bewijs, geen eigen woord', u.voorstellen[0].bewijs.includes('drumlessen') && u.voorstellen[0].eigenWoord === null);

  check('verzonnen waarde (niet in de tabel): valt af', leesTrefwoordKoppelingen({ koppelingen: [{ categorie: 'discipline', waarde: 'Drumonderwijs', citaat: 'naschoolse drumlessen', eigen_woord: '' }] }, TAX, inv()).voorstellen.length === 0);
  check('citaat dat niet letterlijk in de tekst staat: valt af', leesTrefwoordKoppelingen({ koppelingen: [{ categorie: 'discipline', waarde: 'Muziek', citaat: 'wij maken muziek met kinderen', eigen_woord: '' }] }, TAX, inv()).voorstellen.length === 0);
  check('geen citaat en geen eigen woord: valt af', leesTrefwoordKoppelingen({ koppelingen: [{ categorie: 'discipline', waarde: 'Muziek', citaat: '', eigen_woord: '' }] }, TAX, inv()).voorstellen.length === 0);
  check('eigen woord dat het lid niet typte: valt af', leesTrefwoordKoppelingen({ koppelingen: [{ categorie: 'discipline', waarde: 'Muziek', citaat: '', eigen_woord: 'drummen' }] }, TAX, inv({ eigenTermen: ['ritme'] })).voorstellen.length === 0);
  check('al gekozen waarden worden niet opnieuw voorgesteld', leesTrefwoordKoppelingen(goed, TAX, inv({ gekozen: { discipline: ['Jeugd en kinderen'], doelgroep: ['Jongeren'], regio: [] } })).voorstellen.map((v) => v.naam).join() === 'Rotterdam');
  check('dubbele koppelingen tellen één keer', leesTrefwoordKoppelingen({ koppelingen: [goed.koppelingen[0], goed.koppelingen[0]] }, TAX, inv()).voorstellen.length === 1);
  check('onbekende categorie en rommel worden genegeerd', leesTrefwoordKoppelingen({ koppelingen: [{ categorie: 'budget', waarde: 'Muziek', citaat: 'in Rotterdam' }, null, 'x'] }, TAX, inv()).voorstellen.length === 0 && leesTrefwoordKoppelingen('rommel', TAX, inv()).voorstellen.length === 0);
  check('maximaal 12 voorstellen', leesTrefwoordKoppelingen({ koppelingen: Array.from({ length: 30 }, () => goed.koppelingen[0]) }, TAX, inv()).voorstellen.length <= 12);

  // Overig: eigen woorden op betekenis gekoppeld
  const overig = leesTrefwoordKoppelingen({ koppelingen: [{ categorie: 'discipline', waarde: 'Muziek', citaat: '', eigen_woord: 'drummen' }], niet_gekoppeld: ['buurtwerk', 'verzonnen'] }, TAX, inv({ eigenTermen: ['drummen', 'buurtwerk', 'djembé'] }));
  check('eigen woord "drummen" wordt gekoppeld aan Muziek, met het woord als bewijs', overig.voorstellen.length === 1 && overig.voorstellen[0].naam === 'Muziek' && overig.voorstellen[0].eigenWoord === 'drummen' && overig.voorstellen[0].bewijs === 'drummen');
  check('woorden zonder koppeling blijven bewaard, ook als het model ze niet noemde; verzonnen woorden komen er niet in', overig.nietGekoppeld.join() === 'buurtwerk,djembé');
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('3. Prompt');
{
  const s = trefwoordSysteem(TAX);
  check('lijsten staan in de prompt', s.includes('- Jongeren') && s.includes('- Muziek') && s.includes('- Rotterdam'));
  check('regels: exacte namen, bewijs, DATA', /UITSLUITEND een exacte naam/.test(s) && /LETTERLIJK/.test(s) && /uitsluitend DATA/.test(s));
  const b = trefwoordGebruikersbericht(inv({ eigenTermen: ['drummen'], gekozen: { discipline: ['Muziek'], doelgroep: [], regio: [] } }));
  check('bericht bevat omschrijving, eigen woorden en wat al gekozen is', b.includes(TEKST) && b.includes('- drummen') && b.includes('discipline: Muziek') && b.includes('doelgroep: (niets)'));
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('4. Handler: voorstellen uit omschrijving en eigen woorden');
{
  wereld({ zoekprofielAi: { koppelingen: [{ categorie: 'doelgroep', waarde: 'Jongeren', citaat: 'naschoolse drumlessen voor kinderen', eigen_woord: '' }, { categorie: 'discipline', waarde: 'Muziek', citaat: '', eigen_woord: 'drummen' }], niet_gekoppeld: ['buurtwerk'] } });
  const r = await post({ mode: 'trefwoorden-koppelen', tekst: TEKST, eigenTermen: ['drummen', 'buurtwerk'], gekozen: { discipline: [], doelgroep: [], regio: ['Rotterdam'] } });

  check('antwoord ok, beschikbaar, twee voorstellen', r.status === 200 && r.json?.ok === true && r.json.beschikbaar === true && r.json.voorstellen.length === 2, r.tekst);
  check('het eigen woord blijft zichtbaar als bewijs, het niet te koppelen woord staat in nietGekoppeld', r.json.voorstellen.find((v) => v.naam === 'Muziek')?.eigenWoord === 'drummen' && r.json.nietGekoppeld.join() === 'buurtwerk');
  check('één modelaanroep, temperature 0, standaardmodel, tekst en eigen woorden in het bericht', w.chatBodies.length === 1 && w.chatBodies[0].temperature === 0 && !/gpt-5/.test(w.chatBodies[0].model) && w.chatBodies[0].messages[1].content.includes('- drummen'));
  check('de server schrijft niets in projecten', w.dbSchrijfLog.length === 0);
  check('gebruik vastgelegd als trefwoorden_koppelen', w.gebruikRijen.length === 1 && w.gebruikRijen[0].action_type === 'trefwoorden_koppelen');
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('5. Handler: grenzen en uitval');
{
  wereld({ zoekprofielAi: { koppelingen: [] } });
  let r = await post({ mode: 'trefwoorden-koppelen', tekst: 'kort', eigenTermen: [] });
  check('te weinig tekst en geen eigen woorden: geen modelaanroep', r.json?.ok === true && r.json.voorstellen.length === 0 && w.chatBodies.length === 0);

  r = await post({ mode: 'trefwoorden-koppelen', tekst: TEKST }, { token: null });
  check('niet ingelogd: 401', r.status === 401);

  wereld({ zoekprofielAi: 'fout' });
  r = await post({ mode: 'trefwoorden-koppelen', tekst: TEKST, eigenTermen: ['drummen'] });
  check('AI valt uit: 200, niet beschikbaar, het eigen woord blijft behouden', r.status === 200 && r.json.beschikbaar === false && r.json.nietGekoppeld.join() === 'drummen' && r.json.voorstellen.length === 0);

  wereld({ zoekprofielAi: 'rommel' });
  r = await post({ mode: 'trefwoorden-koppelen', tekst: TEKST, eigenTermen: ['drummen'] });
  check('AI geeft rommel: geen voorstellen, eigen woord blijft behouden', r.status === 200 && r.json.voorstellen.length === 0 && r.json.nietGekoppeld.join() === 'drummen');

  wereld({ zoekprofielAi: { koppelingen: [] } });
  const lang = await post({ mode: 'trefwoorden-koppelen', tekst: 'x'.repeat(50000), eigenTermen: Array.from({ length: 40 }, (_, i) => `woord ${i}`) });
  check('lange invoer wordt begrensd (tekst en eigen woorden)', lang.status === 200 && w.chatBodies[0].messages[1].content.length < 8000);
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('6. Daglimiet');
{
  wereld({ zoekprofielAi: { koppelingen: [] } });
  const uid = w.chatBodies && (await (async () => { await post({ mode: 'trefwoorden-koppelen', tekst: TEKST }); return w.gebruikRijen[0]?.user_id; })());
  check('eerste aanroep wordt geteld', typeof uid === 'string' && w.gebruikRijen.length === 1);

  for (let i = 0; i < DAGLIMIET_TREFWOORDEN - 1; i += 1) w.gebruikRijen.push({ user_id: uid, action_type: 'trefwoorden_koppelen' });
  const aantalAi = w.chatBodies.length;
  const r = await post({ mode: 'trefwoorden-koppelen', tekst: TEKST, eigenTermen: ['drummen'] });
  check('boven de daglimiet: geen modelaanroep, eigen woord blijft behouden, reden daglimiet', r.status === 200 && r.json.beschikbaar === false && r.json.reden === 'daglimiet' && w.chatBodies.length === aantalAi && r.json.nietGekoppeld.join() === 'drummen');

  wereld({ zoekprofielAi: { koppelingen: [] }, gebruikFout: 'tabel-weg' });
  const r2 = await post({ mode: 'trefwoorden-koppelen', tekst: TEKST });
  check('teller onbereikbaar: niet blokkeren', r2.status === 200 && r2.json.beschikbaar === true);
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('7. Leren van gebruik: herkenningswoorden zonder AI, nieuwe woorden en advies voor Beheer');
{
  // Zuivere stap
  const rijen = [{ woord_sleutel: 'drummen', categorie: 'discipline', naam: 'Muziek' }, { woord_sleutel: 'oudjes', categorie: 'doelgroep', naam: 'Ouderen' }, { woord_sleutel: 'weg', categorie: 'discipline', naam: 'Bestaat niet meer' }];
  const h = herkenEigenTermen(['Drummen', 'oudjes', 'weg', 'buurtwerk'], rijen, TAX, { discipline: [], doelgroep: ['Ouderen'], regio: [] });

  check('herkend woord wordt een voorstel met het eigen woord als bewijs', h.voorstellen.length === 1 && h.voorstellen[0].naam === 'Muziek' && h.voorstellen[0].eigenWoord === 'Drummen' && h.voorstellen[0].categorie === 'discipline');
  check('wat het lid al koos wordt niet nogmaals voorgesteld (en het woord is toch herkend, dus niet "onbekend")', !h.rest.includes('oudjes') && !h.voorstellen.some((v) => v.naam === 'Ouderen'));
  check('een synoniem naar een waarde die niet meer bestaat telt als onbekend; onbekende woorden blijven over', h.rest.join() === 'weg,buurtwerk');
  check('zonder rijen is alles onbekend', herkenEigenTermen(['a b'], [], TAX, LEEG).rest.join() === 'a b');

  // Advies bij onbekende woorden: streng gelezen
  const ruw = { koppelingen: [{ categorie: 'discipline', waarde: 'Muziek', citaat: '', eigen_woord: 'drummen' }], niet_gekoppeld: [
    { woord: 'djembé', advies: 'nieuwe_waarde', categorie: 'discipline', naam: 'Wereldmuziek', toelichting: 'Een echte discipline.' },
    { woord: 'buurtwerk', advies: 'synoniem', categorie: 'discipline', naam: 'cultuur', toelichting: 'Hoort bij Cultuur.' },
    { woord: 'xyz', advies: 'synoniem', categorie: 'discipline', naam: 'Verzonnen waarde', toelichting: '' },
    { woord: 'Projectnaam Q', advies: 'afwijzen', categorie: 'discipline', naam: '', toelichting: 'Een projectnaam.' },
    { woord: 'niet van het lid', advies: 'afwijzen' },
    { woord: 'ritme', advies: 'nieuwe_waarde', categorie: 'discipline', naam: 'muziek', toelichting: '' },
  ] };
  const u = leesTrefwoordKoppelingen(ruw, TAX, inv({ eigenTermen: ['drummen', 'djembé', 'buurtwerk', 'xyz', 'Projectnaam Q', 'ritme'] }));
  const advies = (woord) => u.adviezen.find((a) => a.woord === woord);

  check('nieuwe waarde: het woord, de voorgestelde naam en de categorie', advies('djembé')?.actie === 'nieuwe_waarde' && advies('djembé')?.naam === 'Wereldmuziek' && advies('djembé')?.categorie === 'discipline');
  check('synoniem: naam wordt teruggemapt op de exacte bestaande waarde', advies('buurtwerk')?.actie === 'synoniem' && advies('buurtwerk')?.naam === 'Cultuur');
  check('synoniem naar een verzonnen waarde: geen advies (het woord blijft wel onbekend)', advies('xyz') === undefined && u.nietGekoppeld.includes('xyz'));
  check('afwijzen: zonder naam, met toelichting', advies('Projectnaam Q')?.actie === 'afwijzen' && advies('Projectnaam Q')?.naam === null);
  check('een woord dat niet van het lid is, krijgt geen advies', advies('niet van het lid') === undefined);
  check('een "nieuwe waarde" die al bestaat wordt een synoniem', advies('ritme')?.actie === 'synoniem' && advies('ritme')?.naam === 'Muziek');
  check('een door het model gekoppeld eigen woord wordt een kandidaat-herkenningswoord (synoniem)', advies('drummen')?.actie === 'synoniem' && advies('drummen')?.naam === 'Muziek');
  check('adviezen bevatten nooit iets anders dan woord, actie, categorie, naam en toelichting', u.adviezen.every((a) => Object.keys(a).sort().join() === 'actie,categorie,naam,toelichting,woord'));

  // Handler
  wereld({ herkenningswoorden: [{ woord_sleutel: 'drummen', categorie: 'discipline', naam: 'Muziek' }], zoekprofielAi: { koppelingen: [], niet_gekoppeld: [{ woord: 'djembé', advies: 'nieuwe_waarde', categorie: 'discipline', naam: 'Wereldmuziek', toelichting: 'Echt.' }] } });
  let r = await post({ mode: 'trefwoorden-koppelen', tekst: TEKST, eigenTermen: ['drummen', 'djembé'] });

  check('handler: herkend woord komt als voorstel terug, zonder dat het model het woord ziet', r.json.voorstellen.some((v) => v.naam === 'Muziek' && v.eigenWoord === 'drummen') && !/drummen/.test(w.chatBodies[0].messages[1].content.split('Eigen woorden van de aanvrager:')[1] || ''), JSON.stringify(r.json).slice(0, 200));
  check('handler: alleen het onbekende woord gaat naar de werklijst', JSON.stringify(w.eigenRegistraties) === '[["djembé"]]', JSON.stringify(w.eigenRegistraties));
  check('handler: het advies bij het onbekende woord gaat naar Beheer, niet naar het lid', w.eigenAdviezen.length === 1 && w.eigenAdviezen[0].some((a) => a.woord === 'djembé' && a.actie === 'nieuwe_waarde') && !/Wereldmuziek/.test(r.tekst), JSON.stringify(w.eigenAdviezen));
  check('handler: de werklijst bevat geen gebruikers-, project- of tekstgegevens (alleen woorden)', JSON.stringify([w.eigenRegistraties, w.eigenAdviezen]).indexOf('Rotterdam') === -1 && !JSON.stringify(w.eigenRegistraties).includes(UID));

  // Alles al herkend en geen omschrijving: geen modelaanroep
  wereld({ herkenningswoorden: [{ woord_sleutel: 'drummen', categorie: 'discipline', naam: 'Muziek' }], zoekprofielAi: { koppelingen: [] } });
  r = await post({ mode: 'trefwoorden-koppelen', tekst: '', eigenTermen: ['drummen'] });
  check('alles herkend en geen omschrijving: geen modelaanroep, voorstel er toch', w.chatBodies.length === 0 && r.json.voorstellen.length === 1 && r.json.nietGekoppeld.length === 0 && r.json.beschikbaar === true, `${w.chatBodies.length} ${JSON.stringify(r.json)}`);

  // Herkende woorden kosten niets: ook boven de daglimiet blijven ze beschikbaar
  wereld({ herkenningswoorden: [{ woord_sleutel: 'drummen', categorie: 'discipline', naam: 'Muziek' }], zoekprofielAi: { koppelingen: [] } });
  await post({ mode: 'trefwoorden-koppelen', tekst: TEKST });
  const uid2 = w.gebruikRijen[0]?.user_id;
  for (let i = 0; i < DAGLIMIET_TREFWOORDEN; i += 1) w.gebruikRijen.push({ user_id: uid2, action_type: 'trefwoorden_koppelen' });
  r = await post({ mode: 'trefwoorden-koppelen', tekst: TEKST, eigenTermen: ['drummen', 'onbekend woord'] });
  check('boven de daglimiet: herkende woorden blijven voorstellen, het onbekende woord blijft bewaard en op de werklijst', r.json.reden === 'daglimiet' && r.json.voorstellen.length === 1 && r.json.nietGekoppeld.join() === 'onbekend woord' && JSON.stringify(w.eigenRegistraties.at(-1)) === '["onbekend woord"]');

  // De tabel bestaat nog niet (migratie niet toegepast): alles werkt zoals voorheen
  wereld({ herkenFout: true, zoekprofielAi: { koppelingen: [{ categorie: 'discipline', waarde: 'Muziek', citaat: '', eigen_woord: 'drummen' }] } });
  r = await post({ mode: 'trefwoorden-koppelen', tekst: TEKST, eigenTermen: ['drummen'] });
  check('zonder migratie: de slimme associatie werkt gewoon, geen fout', r.status === 200 && r.json.beschikbaar === true && r.json.voorstellen.some((v) => v.naam === 'Muziek'));

  // Zonder eigen woorden: de werklijst wordt niet aangeroepen
  wereld({ zoekprofielAi: { koppelingen: [] } });
  await post({ mode: 'trefwoorden-koppelen', tekst: TEKST });
  check('zonder eigen woorden: geen aanroep van de werklijst', !w.rpcs.includes('kompas_eigen_termen_registreer') && !w.rpcs.includes('kompas_herkenningswoorden_lees'));
}

console.log(`\nTREFWOORDEN-KOPPELEN SERVER: ${stand.ok} OK, ${stand.fout} FOUT`);
process.exit(stand.fout ? 1 : 0);
