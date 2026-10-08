// Regressietests Free-fondsmatching (A-D + drempel/actualiteit/tellingen).
//   node tests/fondsadvies-free/regressie-free-matching.test.mjs
// Draait de ECHTE Deno.serve-handler met nagebootste database en OpenAI (zie harness.mjs).
// De extractiestap is een deterministische stand-in; wat bewezen wordt is wat er server-side
// naar het model gaat (welke records, welke aantallen, welke instructies).
import { world, laadModule, resetWorld, vraag, reg, funder, alleSysteemTeksten, TAXONOMIE, FUNCTIE_PAD } from './harness.mjs';

let ok = 0;
let fout = 0;
function check(naam, voorwaarde, detail = '') {
  if (voorwaarde) ok += 1; else { fout += 1; console.log('  FAIL:', naam, detail); }
}
function sectie(t) { console.log('\n== ' + t); }

const { handler } = await laadModule(FUNCTIE_PAD, 'regressie');

const LIT = 'Literatuur Caribe';
const HAAGS = 'Subsidie Haagse kunst- en cultuurprojecten';

// Extractor-stand-in met locatie-/themaregels voor deze testset.
function extractor(tekst) {
  const t = tekst.toLowerCase();
  const uit = { themas: [], doelgroepen: [], regios: [], locatie: '', gevraagd_bedrag: null };
  if (/armoede|zelfredzaam|participatie/.test(t)) {
    uit.themas.push('Armoedebestrijding', 'Armoede/zelfredzaamheid', 'Zelfredzaamheid', 'Participatie & inclusie', 'Sociaal-maatschappelijk', 'Maatschappij');
    uit.doelgroepen.push('Mensen in armoede', 'Mensen in een kwetsbare positie');
  }
  if (/kunst|cultuur/.test(t)) uit.themas.push('Cultuur', 'Kunst');
  if (/literatuur|boek|schrijvers/.test(t)) uit.themas.push('Literatuur', 'Letterkunde');
  if (/dierenwelzijn/.test(t)) { uit.themas.push('Dierenwelzijn'); uit.doelgroepen.push('Dieren'); }
  if (/amsterdam/.test(t)) { uit.regios.push('Amsterdam'); uit.locatie = 'Amsterdam'; }
  if (/den haag/.test(t)) { uit.regios.push('Den Haag'); uit.locatie = 'Den Haag'; }
  if (/caribisch nederland|bonaire/.test(t)) uit.locatie = 'Bonaire, Caribisch Nederland'; // niet in regio-taxonomie
  return uit;
}

// De twee records exact zoals ze nu in de database staan (premium, Haagse = Den Haag, verlopen)
// en in de OUDE toestand (free, Haagse onterecht Landelijk): beide mogen nooit ten onrechte verschijnen.
const lit = (o = {}) => reg({ naam: LIT, tier: 'premium', status: 'binnenkort', deadline: '2026-09-07', themas: ['Talentontwikkeling', 'Literatuur', 'Letterkunde'], regios: ['Landelijk'], ...o });
const haags = (o = {}) => reg({ naam: HAAGS, tier: 'premium', status: 'binnenkort', deadline: '2026-09-15', themas: ['Kunst', 'Cultuur'], regios: ['Den Haag'], ...o });

const blokVan = (body) => alleSysteemTeksten(body).split('\n=====\n').find((t) => t.startsWith('FONDSADVIES-BEOORDELING')) || '';
const getal = (blok, re) => { const m = blok.match(re); return m ? Number(m[1]) : null; };
const msg = (c) => [{ role: 'user', content: c }];

async function freeVraag(regelingen, tekst, extra = {}) {
  resetWorld({ regelingen, extractor, ...extra });
  const r = await vraag(handler, { messages: msg(tekst) });
  return { r, t: alleSysteemTeksten(r.hoofd), blok: blokVan(r.hoofd) };
}

const armoedeRegelingen = () => [
  reg({ naam: 'Amsterdams Armoedefonds', tier: 'free', themas: ['Armoedebestrijding', 'Zelfredzaamheid'], doelgroepen: ['Mensen in armoede'], regios: ['Amsterdam'] }),
  reg({ naam: 'Landelijke Zelfredzaamheidsimpuls', tier: 'pro', themas: ['Zelfredzaamheid'], doelgroepen: ['Mensen in armoede'], regios: ['Landelijk'] }),
  reg({ naam: 'Participatiefonds Premium', tier: 'premium', themas: ['Participatie & inclusie'], regios: ['Noord-Holland'] }),
  ...Array.from({ length: 300 }, (_, i) => reg({ naam: `Irrelevant ${i}`, tier: i % 2 ? 'premium' : 'pro', themas: ['Sport'], regios: ['Landelijk'] })),
];

// ------------------------------------------------------------------ TEST A
sectie('Test A: armoede / zelfredzaamheid / participatie in Amsterdam');
const A_TEKST = 'Welke fondsen passen bij ons project over armoedebestrijding, financiële zelfredzaamheid en participatie in Amsterdam?';
for (const [label, stray] of [
  ['huidige databasetoestand (premium, verlopen)', [lit(), haags()]],
  ['OUDE toestand (free, Haagse als Landelijk) - mag nooit terugkeren', [lit({ tier: 'free' }), haags({ tier: 'free', regios: ['Landelijk'] })]],
  ['zelfs als de deadlines in de toekomst liggen en tier free', [lit({ tier: 'free', deadline: '2026-12-01', status: 'open' }), haags({ tier: 'free', deadline: '2026-12-01', status: 'open', regios: ['Landelijk'] })]],
]) {
  const { r, t, blok } = await freeVraag([...stray, ...armoedeRegelingen()], A_TEKST);
  check(`A [${label}]: HTTP 200`, r.status === 200);
  check(`A [${label}]: Literatuur Caribe niet in modelcontext`, !t.includes(LIT));
  check(`A [${label}]: Haagse regeling niet in modelcontext`, !t.includes(HAAGS) && !/Haagse kunst/.test(t));
  check(`A [${label}]: ook niet als negatieve match ("niet passend") genoemd`, !/Literatuur Caribe|Haagse kunst/i.test(t));
}
{
  const { t, blok } = await freeVraag([lit(), haags(), ...armoedeRegelingen()], A_TEKST);
  check('A: Free ziet de Free-record (Amsterdams Armoedefonds) volledig', t.includes('Amsterdams Armoedefonds'));
  check('A: Pro/Premium-records niet bij naam', !t.includes('Landelijke Zelfredzaamheidsimpuls') && !t.includes('Participatiefonds Premium'));
  check('A: extra_pro_count = 1 en extra_premium_count = 1 (alleen echte matches)', getal(blok, /extra_pro_count = (\d+)/) === 1 && getal(blok, /extra_premium_count = (\d+)/) === 1, blok.match(/DATABASE-UITKOMST[^\n]*/)?.[0]);
  check('A: de 300 irrelevante records tellen nergens mee (geen getal > 10 als telling)', !/\b(\d{2,})\b[^.\n]{0,40}(mogelijk passende|in Premium|in totaal)/.test(t));
  check('A: totaal passend in database = 3', getal(blok, /(\d+) passende regeling\(en\)/) === 3);
}

// ------------------------------------------------------------------ TEST B
sectie('Test B: kunstproject in Den Haag');
const B_TEKST = 'Welke fondsen passen bij ons kunstproject in Den Haag?';
{
  const huidig = await freeVraag([lit(), haags(), ...armoedeRegelingen()], B_TEKST);
  check('B huidige DB-toestand (verlopen deadline, premium): Haagse regeling NIET getoond', !huidig.t.includes(HAAGS));
  check('B huidige DB-toestand: verlopen regeling telt niet mee in extra_premium_count', getal(huidig.blok, /extra_premium_count = (\d+)/) === 0, huidig.blok.match(/DATABASE-UITKOMST[^\n]*/)?.[0]);

  const actueelFree = await freeVraag([haags({ tier: 'free', status: 'open', deadline: '2026-12-15' }), lit({ tier: 'free', status: 'open', deadline: '2026-12-15' }), ...armoedeRegelingen()], B_TEKST);
  check('B actueel + Free + Den Haag: Haagse regeling WEL getoond', actueelFree.t.includes(HAAGS));
  check('B: Literatuur Caribe (ander thema én plaats) niet getoond', !actueelFree.t.includes(LIT));

  const actueelPremium = await freeVraag([haags({ tier: 'premium', status: 'open', deadline: '2026-12-15' }), ...armoedeRegelingen()], B_TEKST);
  check('B actueel maar Premium: niet bij naam, wel geteld als extra_premium_count = 1', !actueelPremium.t.includes(HAAGS) && getal(actueelPremium.blok, /extra_premium_count = (\d+)/) === 1);

  const anderePlaats = await freeVraag([haags({ tier: 'free', status: 'open', deadline: '2026-12-15' }), ...armoedeRegelingen()], 'Welke fondsen passen bij ons kunstproject in Amsterdam?');
  check('B: dezelfde regeling bij een kunstproject in Amsterdam niet getoond', !anderePlaats.t.includes(HAAGS));

  const zonderLocatie = await freeVraag([haags({ tier: 'free', status: 'open', deadline: '2026-12-15' }), ...armoedeRegelingen()], 'Welke fondsen passen bij ons kunstproject?');
  check('B: zonder projectlocatie wordt een plaatsgebonden regeling niet getoond (niet aantoonbaar passend)', !zonderLocatie.t.includes(HAAGS));
}

// ------------------------------------------------------------------ TEST C
sectie('Test C: literatuurproject in Caribisch Nederland');
const C_TEKST = 'Welke fondsen passen bij ons literatuurproject voor schrijvers in Caribisch Nederland?';
{
  const actueel = await freeVraag([lit({ tier: 'free', status: 'open', deadline: '2026-12-15' }), haags({ tier: 'free', status: 'open', deadline: '2026-12-15' }), ...armoedeRegelingen()], C_TEKST);
  check('C actueel + Free: Literatuur Caribe WEL getoond', actueel.t.includes(LIT));
  check('C: Haagse regeling niet getoond', !actueel.t.includes(HAAGS));

  const verlopen = await freeVraag([lit({ tier: 'free' }), ...armoedeRegelingen()], C_TEKST);
  check('C verlopen deadline (huidige DB-toestand): NIET getoond', !verlopen.t.includes(LIT));

  const premium = await freeVraag([lit({ tier: 'premium', status: 'open', deadline: '2026-12-15' }), ...armoedeRegelingen()], C_TEKST);
  check('C Premium + actueel: niet bij naam, wel extra_premium_count = 1', !premium.t.includes(LIT) && getal(premium.blok, /extra_premium_count = (\d+)/) === 1);

  const amsterdam = await freeVraag([lit({ tier: 'free', status: 'open', deadline: '2026-12-15' }), ...armoedeRegelingen()], 'Welke fondsen passen bij ons literatuurproject voor schrijvers in Amsterdam?');
  check('C: hetzelfde literatuurproject in Amsterdam krijgt Literatuur Caribe niet (Caribisch gericht)', !amsterdam.t.includes(LIT));
}

// ------------------------------------------------------------------ TEST D
sectie('Test D: zeer niche project met één sterke match');
{
  const regelingen = [
    reg({ naam: 'Dierenwelzijn Nieuwland Fonds', tier: 'free', themas: ['Dierenwelzijn'], doelgroepen: ['Dieren'], regios: ['Landelijk'] }),
    lit({ tier: 'free' }), haags({ tier: 'free', regios: ['Landelijk'] }),
    ...Array.from({ length: 400 }, (_, i) => reg({ naam: `Premium vulling ${i}`, tier: 'premium', themas: ['Sport', 'Natuur'], regios: ['Landelijk'] })),
  ];
  const { t, blok } = await freeVraag(regelingen, 'Welke fondsen passen bij ons project voor dierenwelzijn?');
  check('D: precies 1 volledig getoond', (t.match(/Matchscore met dit lid/g) || []).length === 1 && t.includes('Dierenwelzijn Nieuwland Fonds'));
  check('D: geen opvulling met strays of vulling', !t.includes(LIT) && !t.includes(HAAGS) && !t.includes('Premium vulling'));
  check('D: extra_pro_count = 0 en extra_premium_count = 0', getal(blok, /extra_pro_count = (\d+)/) === 0 && getal(blok, /extra_premium_count = (\d+)/) === 0);
  check('D: blok verbiedt beweren van extra matches in Pro/Premium', /GEEN extra passende mogelijkheden binnen Pro of Premium/.test(blok));
  check('D: blok verbiedt aanvullen tot drie', /toon er dan 1 of 2 en vul NOOIT aan/.test(blok));
  check('D: geen fictieve "honderden" in de prompt (geen getal van 3+ cijfers als telling)', !/\b\d{3,}\b[^.\n]{0,30}(passende|mogelijk|regelingen|fondsen)/.test(blok));
}

// ------------------------------------------------------------------ Aanvullend
sectie('Aanvullend: drempel, actualiteit, nul matches, geen ruwe tellingen');
{
  // drempel: breed fonds met 1 van 10 themas = score < 65
  const breed = reg({ naam: 'Breed Algemeen Fonds', tier: 'free', themas: ['Sport', 'Natuur', 'Educatie', 'Jeugd en kinderen', 'Dans', 'Muziek', 'Film', 'Ouderen', 'Welzijn', 'Zelfredzaamheid'], regios: ['Landelijk'] });
  const { t, blok } = await freeVraag([breed], A_TEKST);
  check('Drempel: match onder 65 telt niet (niet getoond, niet geteld)', !t.includes('Breed Algemeen Fonds') && getal(blok, /(\d+) passende regeling\(en\)/) === 0);
  check('Drempel: blok noemt de ondergrens 65 en bandbreedtes', /SCORE-ONDERGRENS: .*65 of hoger \(80-100 = zeer kansrijk, 65-79 = kansrijk\)/.test(blok));
  check('Nul matches: blok bevat de verplichte zin', /Op basis van uw huidige projectinformatie heb ik nog geen drie fondsen gevonden die ik met voldoende vertrouwen zou aanraden\./.test(blok));
  check('Geen negatieve matches: blok verbiedt "niet passend"-vermeldingen', /Toon nooit een fonds als "niet passend"/.test(blok));

  // actualiteit: gesloten zonder ronde -> uit; gesloten met toekomstige ronde -> blijft; doorlopend met oude datum -> blijft
  const gesloten = reg({ naam: 'Gesloten Armoedefonds', tier: 'free', status: 'gesloten', deadline: null, themas: ['Armoedebestrijding'], doelgroepen: ['Mensen in armoede'], regios: ['Landelijk'] });
  const metRonde = reg({ naam: 'Gesloten Maar Nieuwe Ronde', tier: 'free', status: 'gesloten', deadline: '2027-02-01', themas: ['Armoedebestrijding'], doelgroepen: ['Mensen in armoede'], regios: ['Landelijk'] });
  const doorlopend = reg({ naam: 'Doorlopend Armoedefonds', tier: 'free', status: 'doorlopend', deadline: '2025-01-01', themas: ['Armoedebestrijding'], doelgroepen: ['Mensen in armoede'], regios: ['Landelijk'] });
  const verlopen = reg({ naam: 'Verlopen Armoedefonds', tier: 'free', status: 'open', deadline: '2026-03-01', themas: ['Armoedebestrijding'], doelgroepen: ['Mensen in armoede'], regios: ['Landelijk'] });
  const act = await freeVraag([gesloten, metRonde, doorlopend, verlopen], A_TEKST);
  check('Actualiteit: gesloten zonder ronde niet', !act.t.includes('Gesloten Armoedefonds'));
  check('Actualiteit: verlopen deadline niet', !act.t.includes('Verlopen Armoedefonds'));
  check('Actualiteit: gesloten met aankomende ronde wel', act.t.includes('Gesloten Maar Nieuwe Ronde'));
  check('Actualiteit: doorlopend wel', act.t.includes('Doorlopend Armoedefonds'));

  // funder-deadlines: verlopen datum uit, toekomst in
  const dl = (naam, datum) => ({ funder_id: `d-${naam}`, funder_naam: naam, funder_website: null, funder_missie: null, funder_aanvraagcriteria: null, type_gever: 'Fonds', access_tier: 'free', datamoment_type: 'deadline', datamoment_naam: 'ronde', deadline_datum: datum, sluitingstijd: null, toelichting: null, bron_url: null, bijdrage_min: null, bijdrage_max: null, bandbreedte_bijdrage_naam: null, themas_namen: ['Armoedebestrijding'], doelgroepen_namen: ['Mensen in armoede'], werkgebieden_namen: ['Landelijk'] });
  resetWorld({ regelingen: [], deadlines: [dl('Oud Deadlinefonds', '2026-01-01'), dl('Nieuw Deadlinefonds', '2026-12-31')], extractor });
  const rd = await vraag(handler, { messages: msg(A_TEKST) });
  const td = alleSysteemTeksten(rd.hoofd);
  check('Actualiteit funder-deadline: verlopen niet, toekomstig wel', !td.includes('Oud Deadlinefonds') && td.includes('Nieuw Deadlinefonds'));

  // geen ruwe recordtellingen voor Free buiten het advies-pad
  resetWorld({ regelingen: armoedeRegelingen(), extractor });
  const alg = await vraag(handler, { messages: msg('Wat is een ANBI-status?'), kompasMode: 'algemeen' });
  const ta = alleSysteemTeksten(alg.hoofd);
  check('Niet-fondsadvies (Free): geen ruwe aantallen verborgen records ("N in totaal")', !/\d+ in totaal/.test(ta));
  // en ook voor Pro
  resetWorld({ regelingen: armoedeRegelingen(), extractor, user: { id: 'u-pro' }, profile: { subscription_tier: 'pro', subscription_active: true, trial_ends_at: null, role: 'user' } });
  const pro = await vraag(handler, { messages: msg(A_TEKST), token: 'tok' });
  check('Pro: geen ruwe aantallen verborgen records ("N in totaal, waarvan M Premium")', !/\d+ in totaal/.test(alleSysteemTeksten(pro.hoofd)));
}

// ------------------------------------------------------------------ Echte-data-fouten (replay productie 2026-10-08)
sectie('Echte-data-fouten: regionaal gebonden regelingen met label "Landelijk", afgekapte funderpool, bijkomende thema\'s');
{
  const arm = { themas: ['Armoedebestrijding'], doelgroepen: ['Mensen in armoede'], regios: ['Landelijk'] };
  const regelingen = [
    reg({ naam: 'Algemene Subsidieverordening Schiermonnikoog 2025', tier: 'premium', status: 'open', deadline: null, funder: 'GEM SCHIERMONNIKOOG', ...arm }),
    reg({ naam: 'Buurtcultuurfonds Noord-Brabant', tier: 'pro', status: 'open', deadline: null, ...arm }),
    { ...reg({ naam: 'Lokale Hulp', tier: 'premium', status: 'open', deadline: null, ...arm }), aanvraagcriteria: 'Alleen voor organisaties die werkzaam zijn binnen de gemeente Zwolle.' },
    reg({ naam: 'Landelijk Armoedefonds', tier: 'premium', status: 'open', deadline: null, ...arm }),
    reg({ naam: 'Vrijwilligersprijs', tier: 'premium', status: 'open', deadline: null, themas: ['Maatschappij', 'Sociaal-maatschappelijk'], regios: ['Landelijk'] }),
  ];
  const extractorKern = (t) => ({ ...extractor(t), kern_themas: ['Armoedebestrijding', 'Zelfredzaamheid'] });
  resetWorld({ regelingen, extractor: extractorKern });
  const r = await vraag(handler, { messages: msg(A_TEKST) });
  const blok = blokVan(r.hoofd);
  // 2026-10-08: thema's mogen ruimer worden geïnterpreteerd (associaties): een fonds met alleen
  // paraplu-thema's uit het sociaal domein (Vrijwilligersprijs: Maatschappij/Sociaal-maatschappelijk) telt nu mee
  // voor een armoedeproject. Plaatsgebonden fondsen blijven uitgesloten.
  check('Echt: "Landelijk Armoedefonds" + paraplu-fonds (Vrijwilligersprijs) tellen; Schiermonnikoog, Noord-Brabant en Zwolle-tekst vallen af', getal(blok, /extra_premium_count = (\d+)/) === 2 && getal(blok, /extra_pro_count = (\d+)/) === 0, blok.match(/DATABASE-UITKOMST[^\n]*/)?.[0]);
  check('Echt: totaal passend = 2', getal(blok, /(\d+) passende regeling\(en\)/) === 2);

  // Zelfde plaatsgebonden regelingen bij een project in die plaats: wel passend
  resetWorld({ regelingen: [regelingen[0], regelingen[2]], extractor: (t) => ({ themas: ['Armoedebestrijding'], kern_themas: ['Armoedebestrijding'], doelgroepen: ['Mensen in armoede'], regios: [], locatie: 'Zwolle', gevraagd_bedrag: null }) });
  const rz = await vraag(handler, { messages: msg('Welke fondsen passen bij ons armoedeproject in Zwolle?') });
  const bz = blokVan(rz.hoofd);
  check('Echt: project in Zwolle -> de Zwolle-gebonden regeling telt wel, Schiermonnikoog niet', getal(bz, /extra_premium_count = (\d+)/) === 1, bz.match(/DATABASE-UITKOMST[^\n]*/)?.[0]);

  // Afgekapte funderpool: standaard-RPC levert 300, de matching-RPC alle
  const veel = Array.from({ length: 400 }, (_, i) => funder({ naam: `A-fonds ${String(i).padStart(3, '0')}`, tier: 'premium', themas: ['Sport'], regios: ['Landelijk'] }));
  const laat = funder({ naam: 'Zorgvuldig Armoedefonds', tier: 'premium', themas: ['Armoedebestrijding'], doelgroepen: ['Mensen in armoede'], regios: ['Landelijk'] });
  resetWorld({ regelingen: [], funders: veel.slice(0, 300), extractor: extractorKern });
  world.fundersVolledig = [...veel, laat];
  const rp = await vraag(handler, { messages: msg(A_TEKST) });
  check('Echt: een passend fonds buiten de eerste 300 (alfabetisch) wordt toch geteld', getal(blokVan(rp.hoofd), /extra_premium_count = (\d+)/) === 1, blokVan(rp.hoofd).match(/DATABASE-UITKOMST[^\n]*/)?.[0]);

  // Alleen bijkomende thema's: zonder kern_themas blijft het oude gedrag (alle themas = kern)
  resetWorld({ regelingen: [regelingen[4]], extractor });
  const rk = await vraag(handler, { messages: msg(A_TEKST) });
  check('Echt: zonder kern_themas uit de extractie geldt het oude gedrag (fail-safe, geen crash)', rk.status === 200);

  // Doelgroep-only criteria: een fonds zonder doelgroepen mag niet puur op regio matchen
  const dg = (t) => ({ themas: [], doelgroepen: ['Mensen in armoede'], regios: ['Amsterdam'], locatie: 'Amsterdam', gevraagd_bedrag: null });
  resetWorld({ regelingen: [reg({ naam: 'Regio-only Fonds', tier: 'premium', status: 'open', deadline: null, themas: [], doelgroepen: [], regios: ['Amsterdam'] })], extractor: dg });
  const rd2 = await vraag(handler, { messages: msg('Welke fondsen passen bij een project voor mensen in armoede in Amsterdam?') });
  check('Echt: fonds zonder doelgroep/thema telt niet mee op alleen regio', getal(blokVan(rd2.hoofd), /(\d+) passende regeling\(en\)/) === 0);
}


// ------------------------------------------------------------------ Verwante thema's (2026-10-08)
sectie('Verwante thema\'s: associaties tellen mee, onverwante thema\'s niet');
{
  const kernArm = (t) => ({ themas: ['Armoedebestrijding'], kern_themas: ['Armoedebestrijding'], doelgroepen: [], regios: [], locatie: '', gevraagd_bedrag: null });
  const regelingen = [
    reg({ naam: 'Sociaal Domein Fonds', tier: 'premium', status: 'open', deadline: null, themas: ['Sociaal-maatschappelijk'], regios: ['Landelijk'] }),
    reg({ naam: 'Welzijnsfonds', tier: 'pro', status: 'open', deadline: null, themas: ['Welzijn'], regios: ['Landelijk'] }),
    reg({ naam: 'Noodhulpfonds', tier: 'premium', status: 'open', deadline: null, themas: ['Noodhulp'], regios: ['Landelijk'] }),
    reg({ naam: 'Cultuurpodium Fonds', tier: 'premium', status: 'open', deadline: null, themas: ['Podiumkunsten'], regios: ['Landelijk'] }),
    reg({ naam: 'Sportfonds', tier: 'pro', status: 'open', deadline: null, themas: ['Sport'], regios: ['Landelijk'] }),
  ];
  resetWorld({ regelingen, extractor: kernArm });
  const r = await vraag(handler, { messages: msg('Welke fondsen passen bij ons armoedeproject?') });
  const blok = blokVan(r.hoofd);
  check('Verwant: sociaal-maatschappelijk, welzijn en noodhulp tellen mee voor een armoede-kernthema (1 Pro + 2 Premium)', getal(blok, /extra_pro_count = (\d+)/) === 1 && getal(blok, /extra_premium_count = (\d+)/) === 2, blok.match(/DATABASE-UITKOMST[^\n]*/)?.[0]);
  check('Verwant: podiumkunsten en sport tellen NIET mee voor armoede', getal(blok, /(\d+) passende regeling\(en\)/) === 3);

  // paraplu-kernthema (bv. "Maatschappij") staat open voor specifieke sociale thema's
  const kernMaatschappij = () => ({ themas: ['Maatschappij'], kern_themas: ['Maatschappij'], doelgroepen: [], regios: [], locatie: '', gevraagd_bedrag: null });
  resetWorld({ regelingen: [reg({ naam: 'Eenzaamheidsfonds', tier: 'premium', status: 'open', deadline: null, themas: ['Eenzaamheid'], regios: ['Landelijk'] }), reg({ naam: 'Sportfonds', tier: 'pro', status: 'open', deadline: null, themas: ['Sport'], regios: ['Landelijk'] })], extractor: kernMaatschappij });
  const rm = await vraag(handler, { messages: msg('Welke fondsen passen bij een maatschappelijk project?') });
  const bm = blokVan(rm.hoofd);
  check('Verwant: kernthema Maatschappij -> Eenzaamheid telt mee, Sport niet', getal(bm, /(\d+) passende regeling\(en\)/) === 1 && getal(bm, /extra_premium_count = (\d+)/) === 1);
}

// ------------------------------------------------------------------ Aanvullende zin: server-side en zonder dubbeltelling (2026-10-08)
sectie('Aanvullende Pro/Premium-zin: door de server toegevoegd, zonder dubbeltelling');
{
  const kernArm = () => ({ themas: ['Armoedebestrijding'], kern_themas: ['Armoedebestrijding'], doelgroepen: [], regios: [], locatie: '', gevraagd_bedrag: null });
  const regs = () => [
    reg({ naam: 'Kansfonds Regeling', tier: 'premium', status: 'open', deadline: null, themas: ['Armoedebestrijding'], regios: ['Landelijk'], funder: 'Kansfonds' }),
    reg({ naam: 'Rabo Regeling', tier: 'premium', status: 'open', deadline: null, themas: ['Armoedebestrijding'], regios: ['Landelijk'], funder: 'Rabobank Foundation' }),
    reg({ naam: 'VSB Regeling', tier: 'pro', status: 'open', deadline: null, themas: ['Armoedebestrijding'], regios: ['Landelijk'], funder: 'Stichting VSBfonds' }),
  ];
  const zinVan = (a) => (a.match(/Daarnaast zijn er in onze database[^\n]*/g) || []);

  // 1. geen dubbeltelling: het model noemt zelf al Kansfonds (en "VSBfonds" zonder "Stichting")
  resetWorld({ regelingen: regs(), extractor: kernArm, modelTekst: 'Mijn advies: 1. Kansfonds, 2. VSBfonds, 3. Oranje Fonds.' });
  const r1 = await vraag(handler, { messages: msg('Welke fondsen passen bij armoede?') });
  const a1 = r1.json.answer;
  check('Zin: aantallen na aftrek van door het model genoemde fondsen (1 Premium: Rabobank Foundation; Pro: 0)', zinVan(a1).length === 1 && /nog 1 relevante fonds of regeling uitsluitend beschikbaar binnen Premium/.test(a1) && !/binnen Pro\b/.test(zinVan(a1)[0]), a1);
  check('Zin: verborgen fondsen worden niet bij naam genoemd door de server', !a1.includes('Rabobank'));

  // 2. niets genoemd -> alle echte matches; het getal in de zin klopt met de server-telling
  resetWorld({ regelingen: regs(), extractor: kernArm, modelTekst: 'Mijn advies: 1. Oranje Fonds.' });
  const r2 = await vraag(handler, { messages: msg('Welke fondsen passen bij armoede?') });
  check('Zin: 1 Pro + 2 Premium, correct enkelvoud/meervoud', /nog 1 relevante fonds of regeling beschikbaar binnen Pro en nog 2 relevante fondsen en regelingen uitsluitend beschikbaar binnen Premium/.test(r2.json.answer), r2.json.answer);

  // 3. alles al genoemd -> geen zin
  resetWorld({ regelingen: regs(), extractor: kernArm, modelTekst: 'Kansfonds, Rabobank Foundation en VSBfonds passen.' });
  const r3 = await vraag(handler, { messages: msg('Welke fondsen passen bij armoede?') });
  check('Zin: alles al genoemd -> geen zin over extra mogelijkheden', zinVan(r3.json.answer).length === 0, r3.json.answer);

  // 4. een door het model zelf geschreven zin met een eigen getal wordt vervangen
  resetWorld({ regelingen: regs(), extractor: kernArm, modelTekst: 'Advies: Oranje Fonds. Daarnaast zijn er in onze database nog 99 relevante fondsen en regelingen beschikbaar binnen Premium. De volledige details zijn beschikbaar binnen Premium.' });
  const r4 = await vraag(handler, { messages: msg('Welke fondsen passen bij armoede?') });
  check('Zin: eigen getal van het model (99) wordt vervangen door de server-telling', !r4.json.answer.includes('99') && zinVan(r4.json.answer).length === 1, r4.json.answer);

  // 5. geen matches -> niets gezegd; Pro-gebruiker -> server voegt niets toe
  resetWorld({ regelingen: [reg({ naam: 'Sportfonds', tier: 'pro', status: 'open', deadline: null, themas: ['Sport'], regios: ['Landelijk'] })], extractor: kernArm, modelTekst: 'Geen match.' });
  const r5 = await vraag(handler, { messages: msg('Welke fondsen passen bij armoede?') });
  check('Zin: nul echte matches -> niets over Pro/Premium', zinVan(r5.json.answer).length === 0 && r5.json.answer === 'Geen match.');
  resetWorld({ regelingen: regs(), extractor: kernArm, modelTekst: 'Pro-antwoord.', user: { id: 'u-pro' }, profile: { subscription_tier: 'pro', subscription_active: true, trial_ends_at: null, role: 'user' } });
  const r6 = await vraag(handler, { messages: msg('Welke fondsen passen bij armoede?'), token: 'tok' });
  check('Zin: Pro-gebruiker krijgt geen server-zin (ongewijzigd antwoord)', r6.json.answer === 'Pro-antwoord.', r6.json.answer);

  // 6. streaming: delta + final done bevatten dezelfde, gecorrigeerde zin
  resetWorld({ regelingen: regs(), extractor: kernArm, modelTekst: 'Advies: Kansfonds.' });
  const res = await handler(new Request('http://x/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: msg('Welke fondsen passen bij armoede?'), kompasMode: 'fondsadvies', stream: true }) }));
  const sse = await res.text();
  const events = sse.split('\n').filter((l) => l.startsWith('data:')).map((l) => JSON.parse(l.slice(5)));
  const done = events.find((e) => e.done);
  const gestreamd = events.filter((e) => typeof e.delta === 'string').map((e) => e.delta).join('');
  check('Stream: done.answer bevat de server-zin met 1 Pro en 1 Premium (Kansfonds al genoemd)', done && /nog 1 relevante fonds of regeling beschikbaar binnen Pro en nog 1 relevante fonds of regeling uitsluitend beschikbaar binnen Premium/.test(done.answer), done?.answer);
  check('Stream: de gestreamde tekst eindigt met dezelfde zin als done.answer', done && gestreamd === done.answer, gestreamd);
}

console.log(`\nRESULTAAT: ${ok} OK, ${fout} FAIL`);
process.exit(fout ? 1 : 0);
