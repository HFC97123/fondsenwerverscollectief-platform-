// Tests voor de centrale rechtenlaag en de modi: één inhoudelijke engine voor Free/Pro/Premium/Admin,
// rangschikking vóór tierrechten, geen uitlek van Premium-fondsen naar Free/Pro in welke modus dan ook
// (chat, fondsenscan, financieringsadvies, projectplan, dekkingsplan/begroting, strategie), en de Pro-verkoopzin
// uitsluitend onderaan een chatantwoord.
//   node tests/fondsadvies-free/rechten-en-modi.test.mjs
import { world, laadModule, resetWorld, vraag, reg, funder, standInExtractor, alleSysteemTeksten, FUNCTIE_PAD, instellingen, indexVan } from './harness.mjs';
instellingen.premiumIsExclusief = true;

let ok = 0;
let fout = 0;
function check(naam, voorwaarde, detail = '') {
  if (voorwaarde) ok += 1; else { fout += 1; console.log('  FAIL:', naam, detail); }
}
function sectie(t) { console.log('\n== ' + t); }

const { mod: M, handler } = await laadModule(FUNCTIE_PAD, 'rechten');

// ---------------------------------------------------------------- Eigenschappen op de engine (seeded, deterministisch)
sectie('Engine: eigenschappen over een gerandomiseerd corpus (rangschikking vóór rechten, tier verandert alleen de zichtbaarheid)');
{
  let seed = 20261008;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const kies = (a) => a[Math.floor(rnd() * a.length)];
  const THEMAS = ['Armoedebestrijding', 'Zelfredzaamheid', 'Participatie & inclusie', 'Sociaal-maatschappelijk', 'Maatschappij', 'Cultuur', 'Kunst', 'Sport', 'Natuur', 'Ouderen', 'Eenzaamheid', 'Welzijn', 'Educatie', 'Jeugd en kinderen'];
  const REGIOS = ['Amsterdam', 'Den Haag', 'Rotterdam', 'Utrecht', 'Noord-Holland', 'Zuid-Holland', 'Landelijk'];
  const TIERS = ['free', 'pro', 'premium'];
  const alle = Array.from({ length: 240 }, (_, i) => ({
    bron: 'regeling',
    row: {
      ...reg({
        naam: `Corpus ${i}`, tier: kies(TIERS), status: 'Open', deadline: '2026-12-31',
        themas: Array.from({ length: 1 + Math.floor(rnd() * 4) }, () => kies(THEMAS)),
        doelgroepen: rnd() < 0.4 ? ['Mensen in armoede'] : [],
        regios: rnd() < 0.15 ? [] : [kies(REGIOS)],
      }),
      deadline_datum: '2026-12-31',
    },
  }));
  const idx = indexVan(M, alle.map((a) => a.row));
  const criteria = { themas: ['Armoedebestrijding', 'Zelfredzaamheid', 'Participatie & inclusie', 'Sociaal-maatschappelijk', 'Maatschappij'], kernThemas: ['Armoedebestrijding', 'Zelfredzaamheid'], doelgroepen: ['Mensen in armoede'], regios: ['Amsterdam'], locatieTekst: 'Amsterdam', gevraagdBedrag: null };
  const perTier = {};
  for (const [naam, tier, admin] of [['free', 'free', false], ['pro', 'pro', false], ['premium', 'premium', false], ['admin', 'free', true]]) {
    perTier[naam] = M.selecteerFreeFondsadvies(alle, criteria, tier, admin, undefined, '2026-10-08', idx);
  }
  const ids = (sel) => sel.relevant.map((k) => k.row.regeling_id).join(',');
  const zonderExcl = (sel) => sel.relevant.filter((k) => !k.row.__exclusief).map((k) => k.row.regeling_id).join(',');
  const uitsl = (sel) => sel.beoordeeld.filter((k) => !k.row.__exclusief).map((k) => `${k.row.regeling_id}:${k.eligibility}:${k.relevant}:${k.score}:${k.uitsluiting}`).join('|');
  check('corpus bevat voldoende relevante én uitgesloten kandidaten (anders bewijst de test niets)', perTier.free.relevant.length >= 10 && perTier.free.beoordeeld.length - perTier.free.relevant.length >= 50, `${perTier.free.relevant.length}/${perTier.free.beoordeeld.length}`);
  check('relevante set + volgorde identiek voor free en pro; premium/admin zien dezelfde set plus alleen de exclusieve fondsen', ids(perTier.free) === ids(perTier.pro) && zonderExcl(perTier.premium) === ids(perTier.free) && ids(perTier.premium) === ids(perTier.admin) && perTier.premium.relevant.some((k) => k.row.__exclusief));
  check('eligibility, score en uitsluitingsreden per gedeelde kandidaat identiek voor elke tier', uitsl(perTier.free) === uitsl(perTier.pro) && uitsl(perTier.pro) === uitsl(perTier.premium) && uitsl(perTier.premium) === uitsl(perTier.admin));
  check('aantalPassendTotaal: Free = Pro, Premium = Admin (meer, door de exclusieve fondsen)', perTier.free.aantalPassendTotaal === perTier.pro.aantalPassendTotaal && perTier.premium.aantalPassendTotaal === perTier.admin.aantalPassendTotaal && perTier.premium.aantalPassendTotaal > perTier.free.aantalPassendTotaal);
  check('de relevante lijst is aflopend gesorteerd op score (rangschikking onafhankelijk van tier)', perTier.free.relevant.every((k, i, a) => i === 0 || a[i - 1].score >= k.score));
  const geo = perTier.free.beoordeeld.filter((k) => k.eligibility === 'ineligible');
  check('elke ineligible kandidaat is uitgesloten, ongeacht score (geen compensatie door thema)', geo.length > 0 && geo.every((k) => !k.relevant));
  check('Free: maximaal 3 en nooit een exclusief fonds', perTier.free.getoond.length <= 3 && perTier.free.getoond.every((k) => !k.row.__exclusief));
  check('Free: getoond = de eerste 3 van de gedeelde ranking', perTier.free.getoond.map((k) => k.row.regeling_id).join() === perTier.free.relevant.slice(0, 3).map((k) => k.row.regeling_id).join());
  check('Pro: nooit een exclusief fonds getoond; wel free- en pro-records', perTier.pro.getoond.every((k) => !k.row.__exclusief) && perTier.pro.getoond.some((k) => k.accessTier === 'pro') && perTier.pro.getoond.some((k) => k.accessTier === 'free'));
  check('Premium en Admin: getoond bevat de top van de globale ranking', perTier.premium.getoond.map((k) => k.row.regeling_id).join() === perTier.premium.relevant.slice(0, perTier.premium.getoond.length).map((k) => k.row.regeling_id).join() && perTier.premium.getoond.length > 3 && perTier.admin.getoond.map((k) => k.row.regeling_id).join() === perTier.premium.getoond.map((k) => k.row.regeling_id).join());
  const hidden = (sel) => sel.verborgen.length;
  check('verborgen telt alleen echte relevante matches buiten de Free-top 3 (Pro: niets; exclusieve fondsen bestaan niet voor Free/Pro)', perTier.pro.verborgen.length === 0 && perTier.free.verborgen.every((k) => k.relevant && !k.row.__exclusief));
  check('extraPro/extraPremium komen overeen met de verborgen records', ['free', 'pro', 'premium'].every((n) => perTier[n].extraPro === perTier[n].verborgen.filter((k) => k.accessTier !== 'premium').length && perTier[n].extraPremium === perTier[n].verborgen.filter((k) => k.accessTier === 'premium').length));
  check('Premium: niets verborgen', hidden(perTier.premium) === 0 && hidden(perTier.admin) === 0);
  // rechten zijn één predicaat
  const rPro = M.bepaalRechten('pro', false);
  check('magZien: fail closed bij onbekend toegangsniveau', M.magZien(rPro, 'onbekend') === false && M.magZien(rPro, undefined) === false && M.magZien(rPro, 'premium') === false && M.magZien(rPro, 'pro') === true && M.magZien(rPro, 'free') === true);
  check('magZien: Free ziet alleen free; Premium ziet alles; Admin ziet alles', M.magZien(M.bepaalRechten('free', false), 'pro') === false && M.magZien(M.bepaalRechten('free', false), 'free') === true && M.magZien(M.bepaalRechten('premium', false), 'premium') === true && M.magZien(M.bepaalRechten('free', true), 'premium') === true);
  check('beoordeelPool kent geen tier: zelfde pool voor elke rechtenset', (() => { const pool = M.beoordeelPool(alle, criteria, '2026-10-08'); return ['free', 'pro', 'premium'].every((t) => ids({ relevant: pool.relevant }) === ids(M.pasRechtenToe(pool, M.bepaalRechten(t, false)).relevant ? pool : pool)); })());
}

// ---------------------------------------------------------------- Handler: modi x tiers
sectie('Handler: geen Premium-uitlek naar Free/Pro in welke modus dan ook; engine actief bij financieringsintentie');
const PREMIUM_NAAM = 'P1 Premium Armoedefonds Amsterdam';
const PRO_NAAM = 'P2 Pro Armoedefonds Landelijk';
const FREE_NAAM = 'F1 Armoede Impuls Amsterdam';
const PREMIUM_FUNDER = 'Geheim Premium Vermogensfonds';
function corpus() {
  return {
    regelingen: [
      reg({ naam: FREE_NAAM, tier: 'free', themas: ['Armoedebestrijding', 'Zelfredzaamheid'], doelgroepen: ['Mensen in armoede'], regios: ['Amsterdam'] }),
      reg({ naam: PRO_NAAM, tier: 'pro', themas: ['Armoedebestrijding'], doelgroepen: ['Mensen in armoede'], regios: ['Landelijk'] }),
      reg({ naam: PREMIUM_NAAM, tier: 'premium', themas: ['Armoedebestrijding', 'Zelfredzaamheid'], doelgroepen: ['Mensen in armoede'], regios: ['Amsterdam'], funder: 'Premium Funder BV' }),
      reg({ naam: 'Haags Armoedefonds', tier: 'premium', themas: ['Armoedebestrijding'], doelgroepen: ['Mensen in armoede'], regios: ['Den Haag'] }),
      reg({ naam: 'Irrelevant Sport', tier: 'free', themas: ['Sport'], regios: ['Landelijk'] }),
      reg({ naam: 'Irrelevant Natuur', tier: 'pro', themas: ['Natuur'], regios: ['Landelijk'] }),
    ],
    funders: [
      funder({ naam: PREMIUM_FUNDER, tier: 'premium', themas: ['Armoedebestrijding', 'Zelfredzaamheid'], doelgroepen: ['Mensen in armoede'], regios: ['Landelijk'] }),
    ],
  };
}
const PROFIEL = {
  Free: { user: null, profile: null, token: null },
  Pro: { user: { id: 'u-pro' }, profile: { subscription_tier: 'pro', subscription_active: true, trial_ends_at: null, role: 'user' }, token: 'tok' },
  Premium: { user: { id: 'u-prem' }, profile: { subscription_tier: 'premium', subscription_active: true, trial_ends_at: null, role: 'user' }, token: 'tok' },
};
const PROJECT = 'ons armoedebestrijdingsproject in Amsterdam (financiële zelfredzaamheid van mensen met schulden)';
const MODI = [
  ['fondsadvies', `Welke fondsen passen bij ${PROJECT}?`, false],
  ['algemeen', `Doe een fondsenscan voor ${PROJECT}`, false],
  ['algemeen', `Ik wil een projectfinancieringsadvies voor ${PROJECT}`, false],
  ['strategie', `Maak een financieringsstrategie voor ${PROJECT}`, true],
  ['begroting', `Maak een dekkingsplan bij de begroting van ${PROJECT}`, true],
  ['projectplan', `Schrijf het projectplan voor ${PROJECT}, inclusief een financieringsparagraaf met mogelijke fondsen`, true],
];
const MODEL_TEKST = 'Hier is mijn antwoord met inhoud.';
const uitkomsten = {};
for (const [mode, tekst, doc] of MODI) {
  for (const [tierNaam, p] of Object.entries(PROFIEL)) {
    const c = corpus();
    resetWorld({ regelingen: c.regelingen, funders: c.funders, extractor: standInExtractor, user: p.user, profile: p.profile, modelTekst: MODEL_TEKST });
    const r = await vraag(handler, { messages: [{ role: 'user', content: tekst }], kompasMode: mode, token: p.token });
    const t = alleSysteemTeksten(r.hoofd);
    const blok = t.split('\n=====\n').find((x) => x.startsWith('FONDSADVIES-BEOORDELING')) || '';
    const sleutel = `${tierNaam}|${mode}|${tekst.slice(0, 30)}`;
    uitkomsten[sleutel] = { t, blok, answer: r.json.answer, extracties: r.extracties.length };
    const lab = `${tierNaam} / ${mode} / "${tekst.slice(0, 32)}…"`;
    // In projectplan-modus bestaat al een eigen dossier-extractie (ongewijzigd); die telt hier niet mee.
    const criteriaExtracties = r.extracties.filter((e) => !JSON.stringify(e.body).includes('compact Projectdossier'));
    check(`${lab}: HTTP 200 en precies één criteria-extractie (engine actief via financieringsintentie)`, r.status === 200 && criteriaExtracties.length === 1, `${r.status}/${criteriaExtracties.length}`);
    check(`${lab}: FONDSADVIES-BEOORDELING-blok aanwezig`, Boolean(blok));
    check(`${lab}: ongefilterde/irrelevante records en het Haagse fonds (ineligible) staan nergens in de context`, !/Irrelevant Sport|Irrelevant Natuur|Haags Armoedefonds/.test(t));
    if (tierNaam !== 'Premium') {
      check(`${lab}: Premium-fonds, Premium-funder en hun gegevens lekken nergens`, !t.includes(PREMIUM_NAAM) && !t.includes(PREMIUM_FUNDER) && !t.includes('Premium Funder BV') && !/Missie P1|Voorwaarden van P1|Missie Geheim/.test(t));
      check(`${lab}: ook niet in het antwoord aan de gebruiker`, !String(r.json.answer).includes(PREMIUM_NAAM) && !String(r.json.answer).includes(PREMIUM_FUNDER));
    } else {
      check(`${lab}: Premium ziet het Premium-fonds wel`, t.includes(PREMIUM_NAAM) && t.includes(PREMIUM_FUNDER));
    }
    check(`${lab}: het Pro-fonds (niet exclusief) is voor iedereen vindbaar; Free krijgt alleen publieke identiteit, Pro/Premium de volledige gegevens`, t.includes(PRO_NAAM) && (tierNaam === 'Free' ? !t.includes(`Voorwaarden van ${PRO_NAAM}`) : t.includes(`Voorwaarden van ${PRO_NAAM}`)));
    check(`${lab}: eigen Free-fonds altijd zichtbaar`, t.includes(FREE_NAAM));
    if (doc) {
      check(`${lab}: documentmodus - GEEN verkoopzin en geen aanvulling: antwoord = modeluitvoer`, r.json.answer === MODEL_TEKST, r.json.answer);
      check(`${lab}: documentmodus - blok bevat de DOCUMENTMODUS-regels en geen aantallen/verborgen-tellingen`, /DOCUMENTMODUS/.test(blok) && !/extra_(pro|premium)_count/.test(blok) && !/\d+ actuele passende/.test(blok), blok.match(/DATABASE-UITKOMST[^\n]*/)?.[0]);
      check(`${lab}: documentmodus - blok verbiedt verwijzing naar andere abonnementen`, /nooit naar andere abonnementen/.test(blok));
    } else if (tierNaam === 'Pro') {
      check(`${lab}: Pro-chat - verkoopzin staat helemaal onderaan, na de inhoud, en noemt geen fondsnamen`, String(r.json.answer).startsWith(MODEL_TEKST) && /exclusieve fondsendatabase\.$/.test(String(r.json.answer).trim()) && !/Geheim|Premium Funder|P1/.test(r.json.answer), r.json.answer);
    }
  }
}

// ---------------------------------------------------------------- Dezelfde engine per modus
sectie('Dezelfde engine: voor elke modus en tier dezelfde beoordeelde set (volgorde Free ⊂ Pro ⊂ Premium)');
{
  const volgorde = (u) => [FREE_NAAM, PRO_NAAM, PREMIUM_NAAM].map((n) => [n, u.t.indexOf(n)]).filter(([, i]) => i >= 0).sort((a, b) => a[1] - b[1]).map(([n]) => n);
  for (const [mode, tekst] of MODI) {
    const sl = (tier) => `${tier}|${mode}|${tekst.slice(0, 30)}`;
    const free = volgorde(uitkomsten[sl('Free')]);
    const pro = volgorde(uitkomsten[sl('Pro')]);
    const prem = volgorde(uitkomsten[sl('Premium')]);
    check(`${mode} / "${tekst.slice(0, 28)}…": de volgorde van wat Free ziet komt overeen met die van Pro en Premium`, JSON.stringify(free) === JSON.stringify(pro.filter((n) => free.includes(n))) && JSON.stringify(free) === JSON.stringify(prem.filter((n) => free.includes(n))), `${free} | ${pro} | ${prem}`);
  }
}

// ---------------------------------------------------------------- Niet-financieringsvragen
sectie('Zonder financieringsintentie draait de engine niet (geen extractie, geen database-context uit de pool)');
{
  const gewoon = [['algemeen', 'Wat is een ANBI-status en wat moet ik daarvoor regelen?'], ['begroting', 'Zet de posten van deze begroting op alfabetische volgorde.'], ['aanvraagbeoordeling', 'Beoordeel mijn aanvraagtekst op duidelijkheid.']];
  for (const [mode, tekst] of gewoon) {
    for (const [tierNaam, p] of Object.entries(PROFIEL)) {
      const c = corpus();
      resetWorld({ regelingen: c.regelingen, funders: c.funders, extractor: standInExtractor, user: p.user, profile: p.profile, modelTekst: MODEL_TEKST });
      const r = await vraag(handler, { messages: [{ role: 'user', content: tekst }], kompasMode: mode, token: p.token });
      const t = alleSysteemTeksten(r.hoofd);
      check(`${tierNaam} / ${mode}: geen extractie en geen beoordelingsblok`, r.extracties.length === 0 && !t.split('\n=====\n').some((x) => x.startsWith('FONDSADVIES-BEOORDELING')));
      check(`${tierNaam} / ${mode}: geen verkoopzin toegevoegd`, r.json.answer === MODEL_TEKST, r.json.answer);
      if (tierNaam !== 'Premium') check(`${tierNaam} / ${mode}: nog steeds geen Premium-record in de context`, !t.includes(PREMIUM_NAAM) && !t.includes(PREMIUM_FUNDER));
    }
  }
}

// ---------------------------------------------------------------- Fail-closed: extractie mislukt in documentmodus
sectie('Fail-safe in documentmodus: mislukte extractie -> geen databasefondsen, geen ruwe matching');
{
  for (const [tierNaam, p] of Object.entries(PROFIEL)) {
    const c = corpus();
    resetWorld({ regelingen: c.regelingen, funders: c.funders, extractorFout: 'http500', user: p.user, profile: p.profile, modelTekst: MODEL_TEKST });
    const r = await vraag(handler, { messages: [{ role: 'user', content: MODI[3][1] }], kompasMode: 'strategie', token: p.token });
    const t = alleSysteemTeksten(r.hoofd);
    check(`${tierNaam} / strategie met falende extractie: HTTP 200 en geen enkel databasefonds in de context`, r.status === 200 && !t.includes(PREMIUM_NAAM) && !t.includes(FREE_NAAM) && !t.includes(PRO_NAAM) && !t.includes(PREMIUM_FUNDER));
  }
}

console.log(`\nRESULTAAT: ${ok} OK, ${fout} FAIL`);
process.exit(fout ? 1 : 0);
