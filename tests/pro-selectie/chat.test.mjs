// Pro-selectie door de ECHTE chat-handler: de server bepaalt de korte lijst (niet het taalmodel), het model krijgt alleen die lijst,
// en het antwoord bevat de door de server berekende totalen. Nagebootste database en OpenAI (zie tests/fondsadvies-free/harness.mjs).
//   node tests/pro-selectie/chat.test.mjs
import { world, laadModule, resetWorld, vraag, reg, funder, alleSysteemTeksten, FUNCTIE_PAD, TAXONOMIE } from '../fondsadvies-free/harness.mjs';

const stand = { ok: 0, fout: 0 };
const check = (naam, waar, detail = '') => { if (waar) stand.ok += 1; else { stand.fout += 1; console.log(`  FAIL: ${naam} ${detail}`); } };
const sectie = (t) => console.log(`\n== ${t}`);

const { handler } = await laadModule(FUNCTIE_PAD, 'pro');

const TAX = {
  themas: ['Kinderbescherming', 'Familieversterking', 'Onderwijs', 'Psychosociale ondersteuning', 'Sociaal-maatschappelijk', 'Maatschappij', 'Natuur', 'Sport', 'Ouderen', 'Cultuur'],
  doelgroepen: ['Kinderen', 'Gezinnen', 'Mensen in een kwetsbare positie', 'Ouderen'],
  regios: ['Afrika', 'Azië', 'Europa', 'Zuid-Amerika', 'Wereld / internationaal', 'Landelijk', 'Amsterdam'],
};
const PRO = { user: { id: 'u-pro' }, profile: { subscription_tier: 'pro', subscription_active: true, trial_ends_at: null, role: 'user' }, token: 'tok' };
const FREE = { user: null, profile: null, token: null };
const PREMIUM = { user: { id: 'u-prem' }, profile: { subscription_tier: 'premium', subscription_active: true, trial_ends_at: null, role: 'user' }, token: 'tok' };

const THEMA_KIND = ['Kinderbescherming', 'Familieversterking', 'Onderwijs', 'Psychosociale ondersteuning'];
const r_ = (naam, o) => { const x = reg({ tier: 'free', themas: ['Kinderbescherming', 'Familieversterking'], doelgroepen: ['Kinderen', 'Gezinnen'], regios: ['Afrika'], ...o, naam }); if (o.tekst) x.aanvraagcriteria = o.tekst; return x; };

function fondsen() {
  return [
    r_('Kind en Gezin Afrika', { min: 40000, max: 100000 }), // 70.000, Afrika
    r_('West-Afrika Onderwijsfonds', { themas: ['Onderwijs', 'Kinderbescherming'], doelgroepen: ['Kinderen'], min: 30000, max: 90000, tekst: 'Steunt projecten in West-Afrika.' }), // 60.000
    r_('Global Children Foundation', { themas: ['Kinderbescherming'], doelgroepen: ['Kinderen'], regios: ['Wereld / internationaal'], min: 50000, max: 150000 }), // 100.000
    r_('Gezinsfonds Ontwikkelingslanden', { themas: ['Familieversterking'], doelgroepen: ['Gezinnen'], regios: ['Wereld / internationaal'], min: 20000, max: 60000, tekst: 'Voor projecten in derdewereldlanden.' }), // 40.000
    r_('Kinderfonds zonder bedrag', {}),
    r_('Fonds met alleen een bovengrens', { max: 25000 }),
    r_('Europees Kinderfonds', { regios: ['Europa'], min: 20000, max: 60000 }),
    r_('Kenia en Tanzania Kinderfonds', { min: 20000, max: 60000, tekst: 'Alleen projecten in Kenia en Tanzania.' }),
    r_('Wereldfonds behalve Ghana', { regios: ['Wereld / internationaal'], min: 20000, max: 60000, tekst: 'Geen projecten in Ghana.' }),
    r_('Nederlands Kinderfonds', { regios: ['Landelijk'], min: 20000, max: 60000 }),
    r_('Natuurfonds Afrika', { themas: ['Natuur'], doelgroepen: [], min: 20000, max: 60000 }),
    r_('Sportfonds Afrika', { themas: ['Sport'], doelgroepen: ['Kinderen'], min: 20000, max: 60000 }),
  ];
}

function extractor(extra = {}) {
  return () => ({ themas: THEMA_KIND, kern_themas: THEMA_KIND, doelgroepen: ['Kinderen', 'Gezinnen'], regios: ['Afrika'], locatie: 'Kumasi, Ghana', gevraagd_bedrag: null, totaal_budget: 200000, aanvragertype: 'onbekend', activiteiten: [], doel_termen: ['kinderbescherming'], ...extra });
}

const VRAAG = 'Project "Sterke families, veilige kinderen" in Kumasi, Ghana: kinderbescherming, familieversterking, onderwijs en psychosociale ondersteuning voor 150 kwetsbare gezinnen met ongeveer 450 kinderen van 0 tot 18 jaar. Looptijd 2027, projectbegroting € 200.000. Welke fondsen passen?';

async function run(profiel, { extra = {}, tekst = VRAAG, lijst = fondsen(), modelTekst = 'MODELANTWOORD', tabellen } = {}) {
  resetWorld({ regelingen: lijst, funders: [], extractor: extractor(extra), user: profiel.user, profile: profiel.profile, taxonomie: TAX, modelTekst, extraTabellen: tabellen });
  const r = await vraag(handler, { messages: [{ role: 'user', content: tekst }], kompasMode: 'fondsadvies', token: profiel.token });

  return { r, systeem: alleSysteemTeksten(r.hoofd), antwoord: String(r.json?.answer || '') };
}

const eurNaarGetal = (t) => Number(String(t).replace(/[^\d]/g, ''));
const AFGEVALLEN = ['Europees Kinderfonds', 'Kenia en Tanzania Kinderfonds', 'Wereldfonds behalve Ghana', 'Nederlands Kinderfonds', 'Natuurfonds Afrika', 'Sportfonds Afrika'];

sectie('1. Pro, Kumasi/Ghana, begroting € 200.000: korte lijst door de server');
{
  const { r, systeem, antwoord } = await run(PRO);
  const blok = systeem.slice(systeem.indexOf('PRO-SELECTIE'));
  const m = blok.match(/totaal geschatte bijdragen (€ [\d.]+); dekking (\d+)% van de projectbegroting \(€ 200\.000\)/);
  const totaal = m ? eurNaarGetal(m[1]) : null;

  check('antwoord 200', r.status === 200, String(r.status));
  check('het model krijgt het PRO-SELECTIE-blok met de berekende lijst', systeem.includes('PRO-SELECTIE') && /definitieve, korte lijst/.test(systeem));
  check('de opening noemt begroting, disciplines, werkgebied en doelgroep', /projectbegroting van € 200\.000/.test(blok) && /Kinderbescherming/.test(blok) && /werkgebied: [^;]*Ghana/.test(blok) && /doelgroep: /.test(blok));
  check('de som van de geschatte bijdragen is hoogstens € 240.000 (120%)', totaal !== null && totaal <= 240000, String(totaal));
  check('het maximum van € 240.000 staat in het blok, berekend uit de begroting', /€ 240\.000 \(120% van de begroting/.test(blok));
  check('geografisch passende fondsen met bedrag staan erin (Afrika, West-Afrika, derdewereldlanden)', ['Kind en Gezin Afrika', 'West-Afrika Onderwijsfonds', 'Gezinsfonds Ontwikkelingslanden'].every((n) => blok.includes(n)));
  check('geen enkel afgevallen fonds in het blok of in de modelcontext (Europa, andere landen, uitgesloten Ghana, Nederland, ander thema)', AFGEVALLEN.every((n) => !systeem.includes(n)), AFGEVALLEN.filter((n) => systeem.includes(n)).join());
  check('per fonds: waarom het past, bijdrage, onderbouwing', /Waarom het past: [^\n]*discipline/.test(blok) && /Geschatte bijdrage: € [\d.]+\. Onderbouwing:/.test(blok));
  check('een fonds zonder onderbouwd bedrag telt niet mee en staat als onbekend (alleen bij een tekort)', !blok.includes('Kinderfonds zonder bedrag') || /Geschatte bijdrage: onbekend \(telt NIET mee/.test(blok));
  check('onderaan: totaal, dekkingspercentage en tekort/geen tekort', Boolean(m) && /(resterend tekort € [\d.]+|geen resterend tekort)/.test(blok));
  check('"schattingen, geen toezeggingen" is een opdracht aan het model', /geen toezeggingen/.test(blok));
  check('de algemene regel "toon alle sterke matches" is voor Pro vervangen', !/Toon alle sterke, actuele matches/.test(systeem));
  check('het antwoord bevat het door de server berekende totaal en percentage (ook als het model ze vergeet)', antwoord.includes(m ? m[1] : '#') && antwoord.includes(`${m ? m[2] : '#'}%`), antwoord.slice(-200));
  check('geen uitgebreide lijst: er wordt geen aantal of naam van extra fondsen genoemd', !/\b\d+ (?:andere|extra|overige) (?:fondsen|matches)/i.test(systeem));
}

sectie('2. Aanvragertype speelt geen rol in selectie en ranking (Pro)');
{
  const { systeem } = await run(PRO, { extra: { aanvragertype: 'particulier' } });

  check('ook met aanvragertype "particulier" volgt dezelfde lijst (de aanvrager is geen selectiecriterium)', systeem.includes('PRO-SELECTIE') && systeem.includes('West-Afrika Onderwijsfonds'));
  check('het aanvragertype staat niet in de selectie-uitleg', !/aanvragertype: particulier/.test(systeem.slice(systeem.indexOf('PRO-SELECTIE'))));
}

sectie('3. Andere begroting en ander land: het maximum en de lijst volgen de invoer');
{
  const klein = await run(PRO, { extra: { totaal_budget: 100000 } });
  const bk = klein.systeem.slice(klein.systeem.indexOf('PRO-SELECTIE'));
  const mk = bk.match(/totaal geschatte bijdragen (€ [\d.]+); dekking (\d+)%/);

  check('begroting € 100.000: maximum € 120.000 en totaal daaronder', /€ 120\.000 \(120%/.test(bk) && mk !== null && eurNaarGetal(mk[1]) <= 120000, mk ? mk[1] : 'geen totaal');

  const kenia = await run(PRO, {
    extra: { locatie: 'Nairobi, Kenia', totaal_budget: 150000 },
    tekst: 'Project in Nairobi, Kenia voor kinderbescherming en familieversterking, begroting € 150.000.',
    lijst: [...fondsen(), r_('Oost-Afrika Gezinsfonds', { min: 30000, max: 50000, tekst: 'Projecten in Oost-Afrika.' }), r_('Alleen West-Afrika Kindfonds', { min: 30000, max: 50000, tekst: 'Alleen West-Afrika.' })],
  });
  const bkn = kenia.systeem.slice(kenia.systeem.indexOf('PRO-SELECTIE'));

  check('Kenia: Oost-Afrika-fonds erin, West-Afrika-fonds en Ghana-uitsluiting-logica niet', bkn.includes('Oost-Afrika Gezinsfonds') && !bkn.includes('Alleen West-Afrika Kindfonds') && bkn.includes("Kenia en Tanzania Kinderfonds"));
  check('Kenia: maximum € 180.000 (120% van € 150.000)', /€ 180\.000 \(120%/.test(bkn));
}

sectie('4. Onbekende bijdragen en te weinig geschikte fondsen: eerlijk tekort, geen opvulling');
{
  const weinig = await run(PRO, { lijst: [r_('Enig passend fonds', { min: 20000, max: 40000 }), r_('Fonds zonder bedragen', {}), ...fondsen().filter((f) => /Europees|Nederlands|Natuur|Sport/.test(f.naam))] });
  const b = weinig.systeem.slice(weinig.systeem.indexOf('PRO-SELECTIE'));

  check('slechts één fonds met bedrag: tekort wordt genoemd (totaal € 30.000, tekort € 170.000)', /totaal geschatte bijdragen € 30\.000/.test(b) && /resterend tekort € 170\.000/.test(b), b.slice(-400));
  check('het blok verbiedt opvulling met zwakke matches', /vul de lijst NIET aan met zwakke matches/.test(b));
  check('het fonds zonder bedragen staat als onbekend en telt niet mee', /Fonds zonder bedragen[\s\S]*?Geschatte bijdrage: onbekend \(telt NIET mee/.test(b));
  check('afgevallen fondsen (Europa, Nederland, ander thema) komen er niet in', ['Europees Kinderfonds', 'Nederlands Kinderfonds', 'Natuurfonds Afrika', 'Sportfonds Afrika'].every((n) => !b.includes(n)));

  const leeg = await run(PRO, { lijst: fondsen().filter((f) => /Europees|Nederlands|Natuur|Sport|behalve/.test(f.naam)) });
  const bl = leeg.systeem.slice(leeg.systeem.indexOf('PRO-SELECTIE'));

  check('niets geschikt: eerlijk melden, geen fondsen noemen', /geen fonds dat op discipline, werkgebied en doelgroep samen/.test(bl) && !/Waarom het past/.test(bl));
}

sectie('5. Bedragen uit de databasetekst (bijdrage_toelichting) worden gebruikt, ook zonder min/max');
{
  const lijst = [r_('Fonds met gebruikelijk bedrag', {}), r_('Kind en Gezin Afrika', { min: 40000, max: 100000 })];

  lijst[0].regeling_id = '11111111-1111-4111-8111-111111111111';

  const { systeem } = await run(PRO, { lijst, tabellen: { subsidieregelingen: [{ id: '11111111-1111-4111-8111-111111111111', bijdrage_toelichting: 'Gemiddelde bijdrage ligt rond de € 90.000.', voorwaarden: null, eigen_bijdrage: '10% eigen bijdrage verplicht', cofinanciering: null, begrotingseisen: null }] } });
  const b = systeem.slice(systeem.indexOf('PRO-SELECTIE'));

  check('gebruikelijk bedrag € 90.000 uit de toelichting, met onderbouwing', /Fonds met gebruikelijk bedrag[\s\S]*?Geschatte bijdrage: € 90\.000/.test(b));
  check('relevante voorwaarde (eigen bijdrage) staat erbij', /eigen bijdrage: 10% eigen bijdrage verplicht/.test(b));
}

sectie('6. "Toon meer" breidt de lijst uit; andere abonnementen blijven ongewijzigd');
{
  const kort = await run(PRO);
  const meer = await run(PRO, { tekst: `${VRAAG} Toon me meer fondsen.` });
  const bm = meer.systeem.slice(meer.systeem.indexOf('PRO-SELECTIE'));
  const aantal = (t) => (t.match(/^\d+\. /gm) || []).length;

  check('na "toon meer" staan er minstens evenveel fondsen als in de korte lijst', aantal(bm) >= aantal(kort.systeem.slice(kort.systeem.indexOf('PRO-SELECTIE'))));
  check('de uitgebreide lijst bevat nog steeds nooit een geografisch afgevallen fonds', AFGEVALLEN.every((n) => !bm.includes(n)));

  const free = await run(FREE);
  const prem = await run(PREMIUM);

  check('Free: geen Pro-selectie, bestaande werking', !free.systeem.includes('PRO-SELECTIE'));
  check('Premium: geen Pro-selectie, bestaande werking', !prem.systeem.includes('PRO-SELECTIE'));
}

sectie('7. Publiek Premium-record (bekend fonds op hoger toegangsniveau): noembaar, maar nooit met bedrag');
{
  const verborgen = r_('Publiek Premiumfonds', { tier: 'premium', min: 777000, max: 999000, tekst: 'Gemiddelde bijdrage ligt rond de € 888.000.' });
  const { systeem } = await run(PRO, { extra: { totaal_budget: 2000000 }, lijst: [verborgen, r_('Kind en Gezin Afrika', { min: 40000, max: 100000 })] });
  const b = systeem.slice(systeem.indexOf('PRO-SELECTIE'));

  check('het publieke Premium-fonds mag bij naam genoemd worden', b.includes('Publiek Premiumfonds'));
  check('zijn bedragen worden voor Pro nooit getoond of geschat', !/777\.000|999\.000|888\.000/.test(systeem) && /Publiek Premiumfonds[\s\S]*?Geschatte bijdrage: onbekend[^\n]*niet zichtbaar/.test(b));
}

sectie('8. Gekozen werkgebied (ISO-landcode) is leidend; alleen BEVESTIGDE verfijningen tellen mee');
{
  const PROJECT_ID = 'b0000000-0000-4000-8000-0000000000aa';
  const projectRij = (extra = {}) => ({ id: PROJECT_ID, user_id: 'u-pro', name: 'Sterke families', description: 'Kumasi, scholen en gezinnen.', goals: '', activities: '', location: 'Ghana', target_groups: 'Kinderen, Gezinnen', themes: 'Kinderbescherming, Familieversterking', period_start: '2027-01-01', period_end: '2027-12-31', budget_total: 200000, own_contribution: 0, requested_amount: 200000, archived_at: null, work_area: null, ...extra });
  const lijst = [...fondsen(), r_('Oost-Afrika Gezinsfonds', { min: 30000, max: 50000, tekst: 'Alleen projecten in Oost-Afrika.' })];
  const bevestigd = { landen: ['GH'], verfijningen: [{ geonamesId: 2297172, naam: 'Kumasi', landcode: 'GH', lat: 6.68848, lng: -1.62443 }] };

  async function metProject(rij, extra = {}) {
    resetWorld({ regelingen: lijst, funders: [], extractor: extractor(extra), user: PRO.user, profile: PRO.profile, taxonomie: TAX, modelTekst: 'MODELANTWOORD', extraTabellen: { subsidie_kompas_programs: rij } });
    const res = await handler(new Request('http://x/functions/v1/subsidie-kompas', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PRO.token}` }, body: JSON.stringify({ messages: [{ role: 'user', content: VRAAG }], kompasMode: 'fondsadvies', stream: false, testLabel: 'harnas', activeProgramId: PROJECT_ID }) }));
    const json = await res.json();
    const systeem = alleSysteemTeksten(world.openAi.filter((c) => c.soort === 'responses').at(-1)?.body);

    return { status: res.status, json, systeem, blok: systeem.slice(systeem.indexOf('PRO-SELECTIE')) };
  }

  const zonder = await metProject(projectRij());
  const met = await metProject(projectRij({ work_area: bevestigd }));
  const vreemd = await metProject(projectRij({ work_area: { landen: ['KE'], verfijningen: [{ geonamesId: 184745, naam: 'Nairobi', landcode: 'KE', lat: -1.28, lng: 36.8 }] } }));
  const dubbel = await metProject(projectRij({ work_area: bevestigd }), { locatie: 'Nairobi, Kenia' });
  const alleenPlaats = await metProject(projectRij({ location: 'Kumasi' }));

  check('Pro-selectie draait met het opgeslagen project (status 200, PRO-SELECTIE aanwezig)', [zonder, met, vreemd].every((r) => r.status === 200 && r.systeem.includes('PRO-SELECTIE')), [zonder.status, met.status].join());
  check('zonder opgeslagen verfijning (onbevestigd voorstel): geen "specifieker" en Kumasi staat niet bij het werkgebied', !/specifieker/.test(zonder.blok));
  check('met bevestigde verfijning: "specifieker: Kumasi" staat bij het werkgebied, naast het gekozen land', /werkgebied: [^;]*Ghana[^;]*specifieker: Kumasi/.test(met.blok), met.blok.slice(0, 500));
  check('een opgeslagen plaats buiten het gekozen land (Nairobi bij Ghana) wordt genegeerd', !/Nairobi/.test(vreemd.blok) && !/specifieker/.test(vreemd.blok));
  check('de fondsselectie is identiek met en zonder bevestigde verfijning (een stad verandert het landniveau niet)', JSON.stringify(met.blok.match(/^\d+\. [^\n]+/gm)) === JSON.stringify(zonder.blok.match(/^\d+\. [^\n]+/gm)));
  check('gekozen land (Ghana) is leidend boven een ander land uit het gesprek (Kenia): West-Afrika erin, Oost-Afrika-fonds en Kenia-fonds niet', dubbel.blok.includes('West-Afrika Onderwijsfonds') && !dubbel.blok.includes('Oost-Afrika Gezinsfonds') && !dubbel.blok.includes('Kenia en Tanzania Kinderfonds'));
  check('werkgebied zonder land ("Kumasi"): gedrag blijft zoals voorheen, er wordt geen land verzonnen', alleenPlaats.status === 200 && !/specifieker/.test(alleenPlaats.blok));
}

console.log(`\nchat: ${stand.ok} OK, ${stand.fout} FOUT`);
if (process.env.TOON_BLOK) { const { systeem } = await run(PRO); console.log(systeem.slice(systeem.indexOf("PRO-SELECTIE"))); }
process.exit(stand.fout ? 1 : 0);
