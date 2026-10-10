// Regressietests Free-fondsmatching (A-D + drempel/actualiteit/tellingen).
//   node tests/fondsadvies-free/regressie-free-matching.test.mjs
// Draait de ECHTE Deno.serve-handler met nagebootste database en OpenAI (zie harness.mjs).
// De extractiestap is een deterministische stand-in; wat bewezen wordt is wat er server-side
// naar het model gaat (welke records, welke aantallen, welke instructies).
import { world, laadModule, resetWorld, vraag, reg, funder, alleSysteemTeksten, TAXONOMIE, FUNCTIE_PAD, interneTelling, vraagStream, instellingen } from './harness.mjs';
instellingen.premiumIsExclusief = true;

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
const getal = (blok, re) => interneTelling(re);
const msg = (c) => [{ role: 'user', content: c }];
// Gesloten maar inhoudelijk passende records staan uitsluitend in de aparte sectie
// "Interessant voor een volgende ronde" (nooit als actuele match, nooit in aantallen).
const GESLOTEN_SECTIE = /INTERESSANT VOOR EEN VOLGENDE RONDE[\s\S]*?(?=\n=====\n|$)/;
const actueelDeel = (t) => t.replace(GESLOTEN_SECTIE, '');
const geslotenDeel = (t) => (t.match(GESLOTEN_SECTIE) || [''])[0];
const totaalPassend = (blok) => getal(blok, /(\d+) (?:actuele )?passende regeling\(en\)/);

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
  check('A: het exclusieve Premium-record niet bij naam; het niet-exclusieve Pro-record wel (publiek, zonder criteria)', !t.includes('Participatiefonds Premium') && t.includes('Landelijke Zelfredzaamheidsimpuls') && !/Voorwaarden van Landelijke/.test(t));
  // Participatiefonds Premium sluit alleen via het brede label "Participatie & inclusie" aan (plus een
  // andere regio): zonder tweede inhoudelijk signaal geen match. Free toont de 2 echte matches; er blijft niets over.
  check('A: extra_pro_count = 0 en extra_premium_count = 0 (beide echte matches binnen de Free-top 3; breed label alleen telt niet)', getal(blok, /extra_pro_count = (\d+)/) === 0 && getal(blok, /extra_premium_count = (\d+)/) === 0, blok.match(/DATABASE-UITKOMST[^\n]*/)?.[0]);
  check('A: de 300 irrelevante records tellen nergens mee (geen getal > 10 als telling)', !/\b(\d{2,})\b[^.\n]{0,40}(mogelijk passende|in Premium|in totaal)/.test(t));
  check('A: totaal passend in database = 2', totaalPassend(blok) === 2);
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
  check('B actueel maar exclusief: niet bij naam en nergens geteld', !actueelPremium.t.includes(HAAGS) && getal(actueelPremium.blok, /extra_premium_count = (\d+)/) === 0);

  const anderePlaats = await freeVraag([haags({ tier: 'free', status: 'open', deadline: '2026-12-15' }), ...armoedeRegelingen()], 'Welke fondsen passen bij ons kunstproject in Amsterdam?');
  check('B: dezelfde regeling bij een kunstproject in Amsterdam niet getoond', !anderePlaats.t.includes(HAAGS));

  const zonderLocatie = await freeVraag([haags({ tier: 'free', status: 'open', deadline: '2026-12-15' }), ...armoedeRegelingen()], 'Welke fondsen passen bij ons kunstproject?');
  // Productbesluit: onbekende projectlocatie is neutraal (geen bonus, geen automatische uitsluiting);
  // het onbekende gegeven wordt als aandachtspunt gemeld in plaats van het fonds te verbergen.
  check('B: zonder projectlocatie is geografie onbekend: regeling niet uitgesloten maar met aandachtspunt over de locatie', zonderLocatie.t.includes(HAAGS) && /Aandachtspunten van deze match: [^\n]*(locatie|geografi)/i.test(zonderLocatie.t), zonderLocatie.t.match(/Aandachtspunten van deze match[^\n]*/)?.[0]);
}

// ------------------------------------------------------------------ TEST C
sectie('Test C: literatuurproject in Caribisch Nederland');
const C_TEKST = 'Welke fondsen passen bij ons literatuurproject voor schrijvers in Caribisch Nederland?';
{
  const actueel = await freeVraag([lit({ tier: 'free', status: 'open', deadline: '2026-12-15' }), haags({ tier: 'free', status: 'open', deadline: '2026-12-15' }), ...armoedeRegelingen()], C_TEKST);
  check('C actueel + Free: Literatuur Caribe WEL getoond', actueel.t.includes(LIT));
  check('C: Haagse regeling niet getoond', !actueel.t.includes(HAAGS));

  const verlopen = await freeVraag([lit({ tier: 'free' }), ...armoedeRegelingen()], C_TEKST);
  check('C verlopen deadline (huidige DB-toestand): NIET als actuele match, wel in de aparte sectie "Interessant voor een volgende ronde"', !actueelDeel(verlopen.t).includes(LIT) && geslotenDeel(verlopen.t).includes(LIT));
  check('C verlopen deadline: telt niet mee in aantallen', totaalPassend(verlopen.blok) === 0);

  const premium = await freeVraag([lit({ tier: 'premium', status: 'open', deadline: '2026-12-15' }), ...armoedeRegelingen()], C_TEKST);
  check('C exclusief + actueel: niet bij naam en nergens geteld', !premium.t.includes(LIT) && getal(premium.blok, /extra_premium_count = (\d+)/) === 0);

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
  check('D: blok verbiedt aantallen en verwijzingen naar andere mogelijkheden', /AANTALLEN EN ANDERE MOGELIJKHEDEN: noem geen aantallen/.test(blok) && !/extra_(pro|premium)_count/.test(blok));
  check('D: blok verbiedt aanvullen tot drie', /toon er dan 1 of 2 en vul NOOIT aan/.test(blok));
  check('D: geen fictieve "honderden" in de prompt (geen getal van 3+ cijfers als telling)', !/\b\d{3,}\b[^.\n]{0,30}(passende|mogelijk|regelingen|fondsen)/.test(blok));
}

// ------------------------------------------------------------------ Aanvullend
sectie('Aanvullend: drempel, actualiteit, nul matches, geen ruwe tellingen');
{
  // drempel: breed fonds met 1 van 10 themas = score < 65
  const breed = reg({ naam: 'Breed Algemeen Fonds', tier: 'free', themas: ['Sport', 'Natuur', 'Educatie', 'Jeugd en kinderen', 'Dans', 'Muziek', 'Film', 'Ouderen', 'Welzijn', 'Zelfredzaamheid'], regios: ['Landelijk'] });
  const { t, blok } = await freeVraag([breed], A_TEKST);
  check('Drempel: match onder 65 telt niet (niet getoond, niet geteld)', !t.includes('Breed Algemeen Fonds') && totaalPassend(blok) === 0);
  check('Drempel: blok noemt de ondergrens 65 en bandbreedtes', /SCORE-ONDERGRENS: .*65 of hoger \(80-100 = sterke aansluiting, 65-79 = goede aansluiting\)/.test(blok) && /NOOIT een kans op toekenning/.test(blok));
  check('Nul matches: blok bevat de verplichte zin', /Op basis van uw huidige projectinformatie heb ik nog geen drie fondsen gevonden die ik met voldoende vertrouwen zou aanraden\./.test(blok));
  check('Geen negatieve matches: blok verbiedt "niet passend"-vermeldingen', /Noem NOOIT een fonds of regeling die je zelf als niet passend beoordeelt/.test(blok));

  // actualiteit: gesloten zonder ronde -> uit; gesloten met toekomstige ronde -> blijft; doorlopend met oude datum -> blijft
  const gesloten = reg({ naam: 'Gesloten Armoedefonds', tier: 'free', status: 'gesloten', deadline: null, themas: ['Armoedebestrijding'], doelgroepen: ['Mensen in armoede'], regios: ['Landelijk'] });
  const metRonde = reg({ naam: 'Gesloten Maar Nieuwe Ronde', tier: 'free', status: 'gesloten', deadline: '2027-02-01', themas: ['Armoedebestrijding'], doelgroepen: ['Mensen in armoede'], regios: ['Landelijk'] });
  const doorlopend = reg({ naam: 'Doorlopend Armoedefonds', tier: 'free', status: 'doorlopend', deadline: '2025-01-01', themas: ['Armoedebestrijding'], doelgroepen: ['Mensen in armoede'], regios: ['Landelijk'] });
  const verlopen = reg({ naam: 'Verlopen Armoedefonds', tier: 'free', status: 'open', deadline: '2026-03-01', themas: ['Armoedebestrijding'], doelgroepen: ['Mensen in armoede'], regios: ['Landelijk'] });
  const act = await freeVraag([gesloten, metRonde, doorlopend, verlopen], A_TEKST);
  check('Actualiteit: gesloten zonder ronde niet als actuele match (hooguit in de aparte sectie)', !actueelDeel(act.t).includes('Gesloten Armoedefonds'));
  check('Actualiteit: verlopen deadline niet als actuele match, wel in de aparte sectie met de concrete deadline', !actueelDeel(act.t).includes('Verlopen Armoedefonds') && /Verlopen Armoedefonds[^\n]*2026-03-01 is verstreken/.test(geslotenDeel(act.t)));
  check('Actualiteit: gesloten met aankomende ronde wel', actueelDeel(act.t).includes('Gesloten Maar Nieuwe Ronde'));
  check('Actualiteit: doorlopend wel', actueelDeel(act.t).includes('Doorlopend Armoedefonds'));
  check('Actualiteit: gesloten/verlopen records tellen nooit mee in de aantallen (totaal = 2: aankomende ronde + doorlopend)', totaalPassend(act.blok) === 2, String(totaalPassend(act.blok)));

  // funder-deadlines: verlopen datum uit, toekomst in
  const dl = (naam, datum) => ({ funder_id: `d-${naam}`, funder_naam: naam, funder_website: null, funder_missie: null, funder_aanvraagcriteria: null, type_gever: 'Fonds', access_tier: 'free', datamoment_type: 'deadline', datamoment_naam: 'ronde', deadline_datum: datum, sluitingstijd: null, toelichting: null, bron_url: null, bijdrage_min: null, bijdrage_max: null, bandbreedte_bijdrage_naam: null, themas_namen: ['Armoedebestrijding'], doelgroepen_namen: ['Mensen in armoede'], werkgebieden_namen: ['Landelijk'] });
  resetWorld({ regelingen: [], deadlines: [dl('Oud Deadlinefonds', '2026-01-01'), dl('Nieuw Deadlinefonds', '2026-12-31')], extractor });
  const rd = await vraag(handler, { messages: msg(A_TEKST) });
  const td = alleSysteemTeksten(rd.hoofd);
  check('Actualiteit funder-deadline: verlopen niet als actueel (hooguit in de aparte sectie), toekomstig wel', !actueelDeel(td).includes('Oud Deadlinefonds') && actueelDeel(td).includes('Nieuw Deadlinefonds'));

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
// Vanaf hier is 'premium' in de fixtures GEEN exclusiviteit meer maar gewoon een datatier: de tests gaan over
// matchingkwaliteit en tellen wat de engine als passend beoordeelt.
instellingen.premiumIsExclusief = false;
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
  // Brede/algemene labels (Vrijwilligersprijs: Maatschappij/Sociaal-maatschappelijk) zijn nooit genoeg op zichzelf;
  // plaatsgebonden fondsen (Schiermonnikoog, Noord-Brabant, Zwolle-tekst) zijn geografisch uitgesloten.
  const tekstEcht = alleSysteemTeksten(r.hoofd);
  check('Echt: alleen "Landelijk Armoedefonds" telt; Vrijwilligersprijs (breed label), Schiermonnikoog, Noord-Brabant en Zwolle-tekst vallen af', totaalPassend(blok) === 1 && tekstEcht.includes('Landelijk Armoedefonds') && !/Vrijwilligersprijs|Schiermonnikoog|Noord-Brabant|Lokale Hulp/.test(tekstEcht), blok.match(/DATABASE-UITKOMST[^\n]*/)?.[0]);
  check('Echt: totaal passend = 1', totaalPassend(blok) === 1);

  // Zelfde plaatsgebonden regelingen bij een project in die plaats: wel passend
  resetWorld({ regelingen: [regelingen[0], regelingen[2]], extractor: (t) => ({ themas: ['Armoedebestrijding'], kern_themas: ['Armoedebestrijding'], doelgroepen: ['Mensen in armoede'], regios: [], locatie: 'Zwolle', gevraagd_bedrag: null }) });
  const rz = await vraag(handler, { messages: msg('Welke fondsen passen bij ons armoedeproject in Zwolle?') });
  const bz = blokVan(rz.hoofd);
  const tz = alleSysteemTeksten(rz.hoofd);
  check('Echt: project in Zwolle -> de Zwolle-gebonden regeling telt wel, Schiermonnikoog niet', totaalPassend(bz) === 1 && tz.includes('Lokale Hulp') && !/Schiermonnikoog/.test(tz), bz.match(/DATABASE-UITKOMST[^\n]*/)?.[0]);

  // Afgekapte funderpool: standaard-RPC levert 300, de matching-RPC alle
  const veel = Array.from({ length: 400 }, (_, i) => funder({ naam: `A-fonds ${String(i).padStart(3, '0')}`, tier: 'premium', themas: ['Sport'], regios: ['Landelijk'] }));
  const laat = funder({ naam: 'Zorgvuldig Armoedefonds', tier: 'premium', themas: ['Armoedebestrijding'], doelgroepen: ['Mensen in armoede'], regios: ['Landelijk'] });
  resetWorld({ regelingen: [], funders: veel.slice(0, 300), extractor: extractorKern });
  world.fundersVolledig = [...veel, laat];
  const rp = await vraag(handler, { messages: msg(A_TEKST) });
  check('Echt: een passend fonds buiten de eerste 300 (alfabetisch) wordt toch geteld en getoond', totaalPassend(blokVan(rp.hoofd)) === 1 && alleSysteemTeksten(rp.hoofd).includes('Zorgvuldig Armoedefonds'), blokVan(rp.hoofd).match(/DATABASE-UITKOMST[^\n]*/)?.[0]);

  // Alleen bijkomende thema's: zonder kern_themas blijft het oude gedrag (alle themas = kern)
  resetWorld({ regelingen: [regelingen[4]], extractor });
  const rk = await vraag(handler, { messages: msg(A_TEKST) });
  check('Echt: zonder kern_themas uit de extractie geldt het oude gedrag (fail-safe, geen crash)', rk.status === 200);

  // Doelgroep-only criteria: een fonds zonder doelgroepen mag niet puur op regio matchen
  const dg = (t) => ({ themas: [], doelgroepen: ['Mensen in armoede'], regios: ['Amsterdam'], locatie: 'Amsterdam', gevraagd_bedrag: null });
  resetWorld({ regelingen: [reg({ naam: 'Regio-only Fonds', tier: 'premium', status: 'open', deadline: null, themas: [], doelgroepen: [], regios: ['Amsterdam'] })], extractor: dg });
  const rd2 = await vraag(handler, { messages: msg('Welke fondsen passen bij een project voor mensen in armoede in Amsterdam?') });
  check('Echt: fonds zonder doelgroep/thema telt niet mee op alleen regio', totaalPassend(blokVan(rd2.hoofd)) === 0);
}


// ------------------------------------------------------------------ Verwante thema's (2026-10-08)
sectie('Verwante thema\'s: ruim en semantisch, maar alleen met bewijs (tweede inhoudelijk signaal)');
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
  check('Verwant: Noodhulp is een directe synoniem-aansluiting op armoede (telt); Sociaal-maatschappelijk en Welzijn alleen zijn te breed', totaalPassend(blok) === 1 && alleSysteemTeksten(r.hoofd).includes('Noodhulpfonds') && !/Sociaal Domein Fonds|Welzijnsfonds/.test(alleSysteemTeksten(r.hoofd)), blok.match(/DATABASE-UITKOMST[^\n]*/)?.[0]);
  check('Verwant: podiumkunsten en sport tellen niet mee voor armoede', !/Cultuurpodium|Sportfonds/.test(alleSysteemTeksten(r.hoofd)));

  // Mét een tweede, onafhankelijk inhoudelijk signaal (doelgroep van project én fonds) telt een breed/verwant thema wel
  const kernArmDg = () => ({ themas: ['Armoedebestrijding'], kern_themas: ['Armoedebestrijding'], doelgroepen: ['Mensen in armoede'], regios: [], locatie: '', gevraagd_bedrag: null });
  resetWorld({ regelingen: [
    reg({ naam: 'Sociaal Domein Fonds', tier: 'premium', status: 'open', deadline: null, themas: ['Sociaal-maatschappelijk'], regios: ['Landelijk'] }),
    reg({ naam: 'Sociaal met Doelgroep', tier: 'pro', status: 'open', deadline: null, themas: ['Sociaal-maatschappelijk'], doelgroepen: ['Mensen in armoede'], regios: ['Landelijk'] }),
    reg({ naam: 'Welzijn met Doelgroep', tier: 'pro', status: 'open', deadline: null, themas: ['Welzijn'], doelgroepen: ['Mensen in armoede'], regios: ['Landelijk'] }),
  ], extractor: kernArmDg });
  const rd = await vraag(handler, { messages: msg('Welke fondsen passen bij ons armoedeproject voor mensen in armoede?') });
  const bd = blokVan(rd.hoofd);
  const td2 = alleSysteemTeksten(rd.hoofd);
  check('Verwant: breed/verwant thema + overeenkomstige doelgroep telt wel (2), zonder doelgroep (Sociaal Domein Fonds) niet', totaalPassend(bd) === 2 && td2.includes('Sociaal met Doelgroep') && td2.includes('Welzijn met Doelgroep') && !td2.includes('Sociaal Domein Fonds'), bd.match(/DATABASE-UITKOMST[^\n]*/)?.[0]);

  // Paraplu-kernthema ("Maatschappij") met een specifiek sociaal thema: indirect, dus zonder tweede signaal niet
  const kernMaatschappij = () => ({ themas: ['Maatschappij'], kern_themas: ['Maatschappij'], doelgroepen: [], regios: [], locatie: '', gevraagd_bedrag: null });
  resetWorld({ regelingen: [reg({ naam: 'Eenzaamheidsfonds', tier: 'premium', status: 'open', deadline: null, themas: ['Eenzaamheid'], regios: ['Landelijk'] }), reg({ naam: 'Sportfonds', tier: 'pro', status: 'open', deadline: null, themas: ['Sport'], regios: ['Landelijk'] })], extractor: kernMaatschappij });
  const rm = await vraag(handler, { messages: msg('Welke fondsen passen bij een maatschappelijk project?') });
  check('Verwant: kernthema Maatschappij -> alleen "Eenzaamheid" is indirect en dus (zonder tweede signaal) niet genoeg; Sport ook niet', totaalPassend(blokVan(rm.hoofd)) === 0);
}

// ------------------------------------------------------------------ Algemene verkoopzin: server-side, zonder aantallen of namen (2026-10-08)
sectie('Algemene slotzin: door de server toegevoegd, nooit afhankelijk van wat er verborgen is');
{
  const kernArm = () => ({ themas: ['Armoedebestrijding'], kern_themas: ['Armoedebestrijding'], doelgroepen: [], regios: [], locatie: '', gevraagd_bedrag: null });
  const regs = () => [
    reg({ naam: 'Kansfonds Regeling', tier: 'premium', status: 'open', deadline: null, themas: ['Armoedebestrijding'], regios: ['Landelijk'], funder: 'Kansfonds' }),
    reg({ naam: 'Rabo Regeling', tier: 'premium', status: 'open', deadline: null, themas: ['Armoedebestrijding'], regios: ['Landelijk'], funder: 'Rabobank Foundation' }),
    reg({ naam: 'VSB Regeling', tier: 'pro', status: 'open', deadline: null, themas: ['Armoedebestrijding'], regios: ['Landelijk'], funder: 'Stichting VSBfonds' }),
  ];
  const PRO = { user: { id: 'u-pro' }, profile: { subscription_tier: 'pro', subscription_active: true, trial_ends_at: null, role: 'user' } };
  const PREMIUM = { user: { id: 'u-prem' }, profile: { subscription_tier: 'premium', subscription_active: true, trial_ends_at: null, role: 'user' } };
  const telZinnen = (a) => (a.match(/Met (?:Pro of Premium|Premium) krijgt u daarnaast toegang/g) || []).length;

  // 1. Free: één algemene zin, geen aantallen, geen namen van verborgen records
  resetWorld({ regelingen: regs(), extractor: kernArm, modelTekst: 'Mijn advies: Oranje Fonds.' });
  const r1 = await vraag(handler, { messages: msg('Welke fondsen passen bij armoede?') });
  const a1 = r1.json.answer;
  check('Zin Free: precies één algemene zin onderaan, geen cijfers, geen namen', telZinnen(a1) === 1 && a1.startsWith('Mijn advies: Oranje Fonds.') && /uitgebreidere fondsendatabase\.$/.test(a1.trim()) && !/\d/.test(a1.slice('Mijn advies: Oranje Fonds.'.length)) && !/Kansfonds|Rabo|VSB/.test(a1), a1);

  // 2. een door het model zelf geschreven aantallenzin wordt verwijderd
  resetWorld({ regelingen: regs(), extractor: kernArm, modelTekst: 'Advies: Oranje Fonds. Daarnaast zijn er in onze database nog 99 relevante fondsen en regelingen beschikbaar binnen Premium. De volledige details zijn beschikbaar binnen Premium.' });
  const r2 = await vraag(handler, { messages: msg('Welke fondsen passen bij armoede?') });
  check('Zin: eigen aantallenzin van het model (99) wordt verwijderd en vervangen door de algemene zin', !r2.json.answer.includes('99') && !/Daarnaast zijn er in onze database/.test(r2.json.answer) && telZinnen(r2.json.answer) === 1, r2.json.answer);

  // 3. Pro: alleen over Premium, onderaan, zonder namen of aantallen
  resetWorld({ regelingen: regs(), extractor: kernArm, modelTekst: 'Pro-antwoord.', ...PRO });
  const r3 = await vraag(handler, { messages: msg('Welke fondsen passen bij armoede?'), token: 'tok' });
  const a3 = r3.json.answer;
  check('Zin Pro: exact "Met Premium krijgt u daarnaast toegang tot de exclusieve fondsendatabase." onderaan', a3 === 'Pro-antwoord.\n\nMet Premium krijgt u daarnaast toegang tot de exclusieve fondsendatabase.', a3);

  // 4. dezelfde zin ongeacht wat er verborgen is: geen enkele match -> dezelfde zin als met 2 verborgen Premium-matches
  resetWorld({ regelingen: [reg({ naam: 'Sportfonds', tier: 'pro', status: 'open', deadline: null, themas: ['Sport'], regios: ['Landelijk'] })], extractor: kernArm, modelTekst: 'Pro-antwoord.', ...PRO });
  const r4 = await vraag(handler, { messages: msg('Welke fondsen passen bij armoede?'), token: 'tok' });
  check('Zin Pro: identiek bij 0 matches en bij verborgen Premium-matches (geeft niets prijs)', r4.json.answer === a3, r4.json.answer);

  // 5. Premium: geen verkoopzin
  resetWorld({ regelingen: regs(), extractor: kernArm, modelTekst: 'Premium-antwoord.', ...PREMIUM });
  const r5 = await vraag(handler, { messages: msg('Welke fondsen passen bij armoede?'), token: 'tok' });
  check('Zin Premium: geen verkoopzin', r5.json.answer === 'Premium-antwoord.', r5.json.answer);

  // 6. vraagt het antwoord om meer informatie, dan geen verkoopzin
  resetWorld({ regelingen: regs(), extractor: kernArm, modelTekst: 'Kunt u meer vertellen over de doelgroep?', ...PRO });
  const r6 = await vraag(handler, { messages: msg('Welke fondsen passen bij armoede?'), token: 'tok' });
  check('Zin: geen verkoopzin als het antwoord alleen om meer projectinformatie vraagt', telZinnen(r6.json.answer) === 0, r6.json.answer);

  // 7. streaming: delta + done.answer bevatten dezelfde zin
  resetWorld({ regelingen: regs(), extractor: kernArm, modelTekst: 'Advies: Oranje Fonds.' });
  const st = await vraagStream(handler, { messages: msg('Welke fondsen passen bij armoede?') });
  check('Stream: done.answer bevat de algemene slotzin en de gestreamde tekst is gelijk aan done.answer', st.done && telZinnen(st.done.answer) === 1 && st.deltas === st.done.answer, st.done?.answer);
}

console.log(`\nRESULTAAT: ${ok} OK, ${fout} FAIL`);
process.exit(fout ? 1 : 0);
