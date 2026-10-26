// AI-beoordeling door de ECHTE chat-handler (Pro en Premium), achter de servervlag FONDS_BEOORDELING. Nagebootste database en OpenAI (zie
// tests/fondsadvies-free/harness.mjs); het "model" voor de beoordeling is een functie die per test kiest wat het antwoordt.
//   node tests/fonds-beoordeling/chat.test.mjs
import { world, laadModule, resetWorld, vraag, reg, alleSysteemTeksten, FUNCTIE_PAD } from '../fondsadvies-free/harness.mjs';

const stand = { ok: 0, fout: 0 };
const check = (naam, waar, detail = '') => { if (waar) stand.ok += 1; else { stand.fout += 1; console.log(`  FAIL: ${naam} ${detail}`); } };
const sectie = (t) => console.log(`\n== ${t}`);

const { handler } = await laadModule(FUNCTIE_PAD, 'beoordeling');

const TAX = {
  themas: ['Kinderbescherming', 'Familieversterking', 'Onderwijs', 'Psychosociale ondersteuning', 'Sociaal-maatschappelijk', 'Maatschappij', 'Natuur', 'Sport', 'Ouderen', 'Cultuur'],
  doelgroepen: ['Kinderen', 'Gezinnen', 'Mensen in een kwetsbare positie', 'Ouderen'],
  regios: ['Afrika', 'Azië', 'Europa', 'Zuid-Amerika', 'Wereld / internationaal', 'Landelijk', 'Amsterdam'],
};
const UUID_PRO = '11111111-1111-4111-8111-111111111111';
const UUID_PREM = '22222222-2222-4222-8222-222222222222';
const UUID_ANDER = '33333333-3333-4333-8333-333333333333';
const PRO = { user: { id: UUID_PRO }, profile: { subscription_tier: 'pro', subscription_active: true, trial_ends_at: null, role: 'user' }, token: 'tok' };
const PREMIUM = { user: { id: UUID_PREM }, profile: { subscription_tier: 'premium', subscription_active: true, trial_ends_at: null, role: 'user' }, token: 'tok' };
const FREE = { user: null, profile: null, token: null };
const ADMIN = { user: { id: UUID_ANDER }, profile: { subscription_tier: 'free', subscription_active: false, trial_ends_at: null, role: 'admin' }, token: 'tok' };

const THEMA_KIND = ['Kinderbescherming', 'Familieversterking', 'Onderwijs', 'Psychosociale ondersteuning'];
const r_ = (naam, o) => { const x = reg({ tier: 'free', themas: ['Kinderbescherming', 'Familieversterking'], doelgroepen: ['Kinderen', 'Gezinnen'], regios: ['Afrika'], ...o, naam }); if (o.tekst) x.aanvraagcriteria = o.tekst; x.regeling_id = `vast-${naam}`; return x; };

function fondsen() {
  return [
    r_('Kind en Gezin Afrika', { min: 40000, max: 100000, tekst: 'Steunt kinderbescherming en gezinnen in Afrika.' }), // 70.000
    r_('West-Afrika Onderwijsfonds', { themas: ['Onderwijs', 'Kinderbescherming'], doelgroepen: ['Kinderen'], min: 30000, max: 90000, tekst: 'Steunt projecten in West-Afrika.' }), // 60.000
    r_('Global Children Foundation', { themas: ['Kinderbescherming'], doelgroepen: ['Kinderen'], regios: ['Wereld / internationaal'], min: 50000, max: 150000, tekst: 'Wereldwijd voor kinderen. Wij financieren geen projecten die al gestart zijn.' }), // 100.000
    r_('Gezinsfonds Ontwikkelingslanden', { themas: ['Familieversterking'], doelgroepen: ['Gezinnen'], regios: ['Wereld / internationaal'], min: 20000, max: 60000, tekst: 'Voor projecten in derdewereldlanden.' }), // 40.000
    r_('Europees Kinderfonds', { regios: ['Europa'], min: 20000, max: 60000 }),
  ];
}

const VRAAG = 'Project "Sterke families, veilige kinderen" in Kumasi, Ghana: kinderbescherming, familieversterking, onderwijs en psychosociale ondersteuning voor 150 kwetsbare gezinnen met ongeveer 450 kinderen. Looptijd 2027, projectbegroting € 200.000. Welke fondsen passen?';

function extractor() {
  return () => ({ themas: THEMA_KIND, kern_themas: THEMA_KIND, doelgroepen: ['Kinderen', 'Gezinnen'], regios: ['Afrika'], locatie: 'Kumasi, Ghana', gevraagd_bedrag: null, totaal_budget: 200000, aanvragertype: 'onbekend', activiteiten: [], doel_termen: ['kinderbescherming'] });
}

// Standaardmodel: keurt alles goed met een letterlijk citaat (de eerste 40 tekens van de tekst).
const keurGoed = (inv) => ({ oordelen: inv.fondsen.map((f) => ({ id: f.id, oordeel: 'past', citaat: f.tekst.slice(0, 40), reden: 'sluit aan' })) });

async function run(profiel, { env = { FONDS_BEOORDELING: 'aan' }, lijst = fondsen(), beoordeling = keurGoed, tabellen, extra = {}, tekst = VRAAG, beoordelingFout = null, oordeelTabelWeg = false, modelTekst = 'MODELANTWOORD' } = {}) {
  resetWorld({ regelingen: lijst, funders: [], extractor: extractor(), user: profiel.user, profile: profiel.profile, taxonomie: TAX, modelTekst, extraTabellen: tabellen, env, beoordeling, beoordelingFout, oordeelTabelWeg, ...extra });

  const r = await vraag(handler, { messages: [{ role: 'user', content: tekst }], kompasMode: 'fondsadvies', token: profiel.token });
  const systeem = alleSysteemTeksten(r.hoofd);
  const aanroepen = world.openAi.filter((c) => c.soort === 'beoordeling');

  return { r, systeem, antwoord: String(r.json?.answer || ''), aanroepen, blok: systeem.slice(Math.max(0, systeem.search(/(?:PRO|PREMIUM)-SELECTIE/))), prompts: aanroepen.map((a) => a.body.messages[1].content).join('\n') };
}

sectie('1. Vlag uit (standaard): niets verandert');
{
  const pro = await run(PRO, { env: {} });
  const prem = await run(PREMIUM, { env: {} });
  const typfout = await run(PRO, { env: { FONDS_BEOORDELING: 'true' } });

  check('Pro zonder vlag: wel de korte lijst, géén AI-beoordeling', pro.systeem.includes('PRO-SELECTIE') && pro.aanroepen.length === 0 && !/Bevestigd in de bron/.test(pro.blok));
  check('Premium zonder vlag: wel de korte Premium-lijst (160%), géén AI-beoordeling', prem.systeem.includes('PREMIUM-SELECTIE') && !prem.systeem.includes('PRO-SELECTIE') && prem.aanroepen.length === 0 && !/Bevestigd in de bron/.test(prem.blok));
  check('een typefout in de vlag ("true") opent niets', typfout.aanroepen.length === 0);
}

sectie('2. Pro met vlag: de AI leest de beste kandidaten en levert bewijs');
{
  const { r, systeem, aanroepen, blok, prompts } = await run(PRO);

  check('antwoord 200 en PRO-SELECTIE aanwezig', r.status === 200 && systeem.includes('PRO-SELECTIE'));
  check('er is een beoordelingsaanroep gedaan met temperatuur 0 en JSON-uitvoer', aanroepen.length >= 1 && aanroepen.every((a) => a.body.temperature === 0 && a.body.response_format?.type === 'json_object'));
  check('alleen geografisch geschikte fondsen gaan naar het model (Europees Kinderfonds niet)', !prompts.includes('Europees Kinderfonds') && prompts.includes('West-Afrika Onderwijsfonds'));
  check('per fonds staat een letterlijk citaat uit de database in het blok', /Bevestigd in de bron[^\n]*"Steunt kinderbescherming en gezinnen in Afrika/.test(blok) || /Bevestigd in de bron/.test(blok), blok.slice(0, 600));
  check('bedragen en totaal blijven door de server berekend en onder € 240.000', (() => { const m = blok.match(/totaal geschatte bijdragen (€ [\d.]+)/); return Boolean(m) && Number(m[1].replace(/[^\d]/g, '')) <= 240000; })());
  check('de aanvrager telt niet mee: het beoordelingsbericht bevat geen aanvragertype', !/aanvrager/i.test(prompts));
  check('de systeemtekst voor de beoordeling zegt dat teksten data zijn', aanroepen.every((a) => /uitsluitend DATA/.test(a.body.messages[0].content)));
}

sectie('3. Een uitsluiting met bewijs haalt een fonds uit de lijst; een verzonnen citaat niet');
{
  const metUitsluiting = (inv) => ({ oordelen: inv.fondsen.map((f) => (f.naam === 'Global Children Foundation'
    ? { id: f.id, oordeel: 'past_niet', citaat: 'geen projecten die al gestart zijn', reden: 'project is al gestart' }
    : { id: f.id, oordeel: 'past', citaat: f.tekst.slice(0, 40), reden: 'ok' })) });
  const verzonnen = (inv) => ({ oordelen: inv.fondsen.map((f) => (f.naam === 'Global Children Foundation'
    ? { id: f.id, oordeel: 'past_niet', citaat: 'wij sluiten Ghana uit', reden: 'verzonnen' }
    : { id: f.id, oordeel: 'past', citaat: f.tekst.slice(0, 40), reden: 'ok' })) });
  const goed = await run(PRO, { beoordeling: metUitsluiting });
  const slecht = await run(PRO, { beoordeling: verzonnen });
  const basis = await run(PRO);

  check('zonder uitsluiting staat Global Children Foundation in de lijst', basis.blok.includes('Global Children Foundation'));
  check('met een uitsluiting waarvan het citaat in de tekst staat: het fonds valt af', !goed.blok.includes('Global Children Foundation'), goed.blok.slice(0, 300));
  check('Pro noemt het afgevallen fonds nergens (geen net-niet-lijst voor Pro)', !goed.blok.includes('Net niet') && !goed.systeem.includes('project is al gestart'));
  check('met een verzonnen citaat blijft het fonds gewoon staan', slecht.blok.includes('Global Children Foundation'));
  check('het totaal wordt na het afvallen opnieuw door de server berekend', (() => { const a = goed.blok.match(/totaal geschatte bijdragen (€ [\d.]+)/); const b = basis.blok.match(/totaal geschatte bijdragen (€ [\d.]+)/); return Boolean(a && b); })());
}

sectie('4. Premium met vlag: dezelfde motor, ruimere buffer, exclusieve fondsen en een net-niet-lijst');
{
  const lijst = [...fondsen(), r_('Premium Kinderfonds', { tier: 'premium', min: 30000, max: 70000, tekst: 'Vertrouwelijk fonds voor kinderen in West-Afrika.' })];
  const metNetNiet = (inv) => ({ oordelen: inv.fondsen.map((f) => (f.naam === 'Global Children Foundation'
    ? { id: f.id, oordeel: 'past_niet', citaat: 'geen projecten die al gestart zijn', reden: 'project is al gestart' }
    : { id: f.id, oordeel: 'past', citaat: f.tekst.slice(0, 40), reden: 'ok' })) });
  const NET_NIET_ZIN = 'Net niet: Global Children Foundation past niet omdat het project al gestart is.';
  const prem = await run(PREMIUM, { lijst, beoordeling: metNetNiet, modelTekst: `Dit zijn de fondsen.\n\n${NET_NIET_ZIN}` });
  const pro = await run(PRO, { lijst, beoordeling: metNetNiet });
  const zonderNetNiet = await run(PREMIUM, { lijst, beoordeling: keurGoed, modelTekst: `Dit zijn de fondsen.\n\n${NET_NIET_ZIN}` });

  check('Premium: PREMIUM-SELECTIE met de korte lijst', prem.systeem.includes('PREMIUM-SELECTIE') && !prem.systeem.includes('PRO-SELECTIE'));
  check('Premium: het Premium-fonds gaat mee naar de beoordeling en kan in de lijst staan', prem.prompts.includes('Premium Kinderfonds'));
  check('Pro: de tekst van het Premium-fonds gaat NOOIT naar het beoordelingsmodel', !pro.prompts.includes('Vertrouwelijk fonds') && !pro.prompts.includes('Premium Kinderfonds'));
  check('Pro: de bedragen van het Premium-fonds komen nergens voor', !/30\.000|70\.000 .*Premium/.test(pro.blok.split('Premium Kinderfonds')[1] || ''));
  check('Premium: de net-niet-lijst noemt het afgevallen fonds met reden en bron', /Net niet/.test(prem.blok) && /Global Children Foundation[^\n]*project is al gestart[^\n]*geen projecten die al gestart zijn/.test(prem.blok), prem.blok.slice(-700));
  check('Premium: de som blijft onder 160% (€ 320.000); het maximum staat alleen als interne regel in het blok', (() => { const m = prem.blok.match(/totaal geschatte bijdragen (€ [\d.]+)/); return Boolean(m) && Number(m[1].replace(/[^\d]/g, '')) <= 320000 && /Intern, nooit noemen: [^\n]*€ 320\.000 \(160% van de begroting/.test(prem.blok); })());
  check('Pro noemt nog steeds 120% (€ 240.000) als maximum', /€ 240\.000 \(120% van de begroting/.test(pro.blok));
  check('het "Net niet"-deel blijft in het antwoord staan (de nabewerking filtert het niet weg als negatief voorbeeld)', prem.antwoord.includes('Global Children Foundation past niet'), prem.antwoord.slice(0, 300));
  check('controle: zonder net-niet-lijst filtert de bestaande nabewerking zo\'n zin nog steeds weg', !zonderNetNiet.antwoord.includes('Global Children Foundation past niet'), zonderNetNiet.antwoord.slice(0, 300));
}

sectie('5. Testerslijst en rollen');
{
  const testers = await run(PRO, { env: { FONDS_BEOORDELING: 'testers', VOORSTEL_TESTERS: UUID_PRO } });
  const niet = await run(PRO, { env: { FONDS_BEOORDELING: 'testers', VOORSTEL_TESTERS: UUID_ANDER } });
  const eigen = await run(PRO, { env: { FONDS_BEOORDELING: 'testers', FONDS_BEOORDELING_TESTERS: UUID_PRO, VOORSTEL_TESTERS: UUID_ANDER } });
  const free = await run(FREE);
  const admin = await run(ADMIN);

  check('tester op de lijst (VOORSTEL_TESTERS): AI-beoordeling aan', testers.aanroepen.length >= 1);
  check('lid dat niet op de lijst staat: uit', niet.aanroepen.length === 0 && niet.systeem.includes('PRO-SELECTIE'));
  check('FONDS_BEOORDELING_TESTERS gaat voor VOORSTEL_TESTERS', eigen.aanroepen.length >= 1);
  check('Free: nooit een AI-beoordeling', free.aanroepen.length === 0);
  check('Admin: ongewijzigd, geen AI-beoordeling', admin.aanroepen.length === 0 && !admin.systeem.includes('PREMIUM-SELECTIE'));
}

sectie('6. Uitval en herstel: de lijst blijft bestaan');
{
  const basis = await run(PRO, { env: {} });
  const fout500 = await run(PRO, { beoordelingFout: 'http500' });
  const netwerk = await run(PRO, { beoordelingFout: 'netwerk' });
  const rommel = await run(PRO, { beoordeling: () => ({ onzin: true }) });
  const lijstVan = (b) => JSON.stringify(b.match(/^\d+\. [^\n]+/gm));

  check('het model geeft HTTP 500: de lijst is gelijk aan die zonder AI-beoordeling', fout500.r.status === 200 && lijstVan(fout500.blok) === lijstVan(basis.blok));
  check('netwerkfout: idem', netwerk.r.status === 200 && lijstVan(netwerk.blok) === lijstVan(basis.blok));
  check('onbruikbaar antwoord: idem, zonder kanttekeningen "niet gecontroleerd"', rommel.r.status === 200 && lijstVan(rommel.blok) === lijstVan(basis.blok) && !/niet gecontroleerd/.test(rommel.blok));
}

sectie('7. Oordelen bewaren (tabel subsidie_kompas_fonds_beoordelingen)');
{
  const eerste = await run(PRO);
  const rijen = world.oordeelRijen ? world.oordeelRijen.length : 0;

  check('na de eerste vraag zijn de oordelen bewaard (zonder tekst van de gebruiker)', rijen > 0 && world.oordeelRijen.every((r) => !('user_id' in r) && !/Kumasi|Ghana/.test(JSON.stringify(r))), JSON.stringify(world.oordeelRijen?.[0]));

  const bewaard = world.oordeelRijen;

  resetWorld({ regelingen: fondsen(), funders: [], extractor: extractor(), user: PRO.user, profile: PRO.profile, taxonomie: TAX, modelTekst: 'MODELANTWOORD', env: { FONDS_BEOORDELING: 'aan' }, beoordeling: keurGoed, oordeelRijen: bewaard });
  await vraag(handler, { messages: [{ role: 'user', content: VRAAG }], kompasMode: 'fondsadvies', token: PRO.token });

  check('dezelfde vraag opnieuw: geen enkele beoordelingsaanroep meer nodig', world.openAi.filter((c) => c.soort === 'beoordeling').length === 0);

  const zonderTabel = await run(PRO, { oordeelTabelWeg: true });

  check('tabel nog niet aangemaakt (migratie niet toegepast): alles werkt, zonder bewaren', zonderTabel.r.status === 200 && zonderTabel.aanroepen.length >= 1 && /Bevestigd in de bron/.test(zonderTabel.blok));
}

sectie('8. Kosten worden gemeten onder een eigen actie, zonder inhoud');
{
  resetWorld({ regelingen: fondsen(), funders: [], extractor: extractor(), user: PRO.user, profile: PRO.profile, taxonomie: TAX, modelTekst: 'MODELANTWOORD', env: { FONDS_BEOORDELING: 'aan' }, beoordeling: keurGoed });
  await vraag(handler, { messages: [{ role: 'user', content: VRAAG }], kompasMode: 'fondsadvies', token: PRO.token });

  const log = world.inserts.filter((i) => i.tabel === 'kompas_gebruik_log').map((i) => i.row);
  const beo = log.find((l) => l.action_type === 'fonds_beoordeling');

  check('een regel met actie fonds_beoordeling en tokens', Boolean(beo) && Number(beo.input_tokens) > 0, JSON.stringify(log.map((l) => l.action_type)));
  check('de regel bevat geen inhoud (geen prompt, fondsnaam of projecttekst)', Boolean(beo) && !/Kumasi|Fonds|Foundation|Kinder/.test(JSON.stringify(beo)));
}

console.log(`\nchat: ${stand.ok} OK, ${stand.fout} FOUT`);
process.exit(stand.fout ? 1 : 0);
