// Tests voor de scheiding tussen ELIGIBILITY (mag dit project hier formeel voor in aanmerking komen?)
// en FIT (hoe sterk past het inhoudelijk?), zoals vastgesteld in de productbesluiten van 2026-10-08.
//   node tests/fondsadvies-free/eligibility-en-fit.test.mjs
// Roept de beoordelingsengine rechtstreeks aan (pure functies, geen netwerk): dezelfde code die de handler gebruikt.
import { laadModule, FUNCTIE_PAD, reg, instellingen } from './harness.mjs';
instellingen.premiumIsExclusief = true;

let ok = 0;
let fout = 0;
function check(naam, voorwaarde, detail = '') {
  if (voorwaarde) ok += 1; else { fout += 1; console.log('  FAIL:', naam, detail); }
}
function sectie(t) { console.log('\n== ' + t); }

const { mod: M } = await laadModule(FUNCTIE_PAD, 'eligibility');

const crit = (o) => ({ themas: [], kernThemas: [], doelgroepen: [], regios: [], locatieTekst: '', gevraagdBedrag: null, doelTermen: [], activiteiten: [], ...o });
// Records zijn open (toekomstige deadline), zodat actualiteit geen rol speelt in deze tests.
const rij = (o) => ({ ...reg({ tier: 'free', ...o }), status: 'Open', deadline_datum: '2026-12-01' });
const beoordeel = (c, rows, tier = 'premium') => M.selecteerFreeFondsadvies(rows.map((row) => ({ bron: 'regeling', row })), c, tier, true, 50);
const vind = (sel, naam) => sel.beoordeeld.find((k) => k.naam === naam);

// ---------------------------------------------------------------- Geografie
sectie('Geografie: harde eligibility-regel met status eligible / ineligible / unknown');
{
  const THEATER = ['Cultuur', 'Kunst', 'Theater en podiumkunsten'];
  const adam = crit({ themas: THEATER, kernThemas: ['Theater en podiumkunsten'], regios: ['Amsterdam'], locatieTekst: 'Amsterdam' });
  const sel = beoordeel(adam, [
    rij({ naam: 'Haags cultuurfonds', themas: THEATER, regios: ['Den Haag'] }),
    // maximale inhoudelijke aansluiting: thema + doelgroep + missie/criteria noemen de kern - maar wel Den Haag
    { ...rij({ naam: 'Haags topfonds', themas: ['Theater en podiumkunsten'], doelgroepen: ['Jongeren'], regios: ['Den Haag'] }), funder_missie: 'Wij steunen theater en podiumkunsten voor jongeren', aanvraagcriteria: 'theater podiumkunsten jongeren' },
    rij({ naam: 'Landelijk cultuurfonds', themas: THEATER, regios: ['Landelijk'] }),
    rij({ naam: 'Meerdere regios incl. Amsterdam', themas: ['Theater en podiumkunsten'], regios: ['Amsterdam', 'Rotterdam'] }),
    rij({ naam: 'Meerdere regios zonder Amsterdam', themas: ['Theater en podiumkunsten'], regios: ['Rotterdam', 'Utrecht'] }),
    rij({ naam: 'Provincie Noord-Holland', themas: ['Theater en podiumkunsten'], regios: ['Noord-Holland'] }),
    rij({ naam: 'Provincie Zuid-Holland', themas: ['Theater en podiumkunsten'], regios: ['Zuid-Holland'] }),
    // regio-label in de database is (foutief) Landelijk, maar de naam is Haags (echt productiegeval)
    rij({ naam: 'Subsidie Haagse kunst- en cultuurprojecten', themas: THEATER, regios: ['Landelijk'] }),
    rij({ naam: 'Fonds zonder werkgebied', themas: ['Theater en podiumkunsten'], regios: [] }),
  ]);
  const st = (n) => vind(sel, n);
  check('Den Haag-fonds bij Amsterdam-project: eligibility = ineligible', st('Haags cultuurfonds').eligibility === 'ineligible' && st('Haags cultuurfonds').geografie.status === 'ineligible');
  check('ineligible wordt uitgesloten VÓÓR de rangschikking: niet relevant, niet in aantallen, niet getoond', !st('Haags cultuurfonds').relevant && !sel.getoond.some((k) => k.naam === 'Haags cultuurfonds'));
  check('ineligible wordt nooit gecompenseerd door een sterke thematische score (thema + doelgroep + missie sluiten aan)', st('Haags topfonds').eligibility === 'ineligible' && !st('Haags topfonds').relevant && st('Haags topfonds').themaNiveau === 'kern', `${st('Haags topfonds').themaNiveau}/${st('Haags topfonds').relevant}`);
  check('de uitsluitingsreden is geografisch en noemt de plaats', /Den Haag|regio/.test(st('Haags topfonds').uitsluiting || ''), st('Haags topfonds').uitsluiting);
  check('landelijke regeling voor een regionaal project: eligible en relevant', st('Landelijk cultuurfonds').eligibility === 'eligible' && st('Landelijk cultuurfonds').relevant);
  check('fonds voor meerdere regio\'s waarbinnen de projectregio valt: relevant', st('Meerdere regios incl. Amsterdam').relevant && st('Meerdere regios incl. Amsterdam').geografie.positief);
  check('fonds voor meerdere regio\'s zonder de projectregio: ineligible', st('Meerdere regios zonder Amsterdam').eligibility === 'ineligible' && !st('Meerdere regios zonder Amsterdam').relevant);
  check('provincie waarin de projectplaats ligt: relevant (Noord-Holland voor Amsterdam)', st('Provincie Noord-Holland').relevant);
  check('andere provincie: ineligible (Zuid-Holland voor Amsterdam)', st('Provincie Zuid-Holland').eligibility === 'ineligible' && !st('Provincie Zuid-Holland').relevant);
  check('regio-label "Landelijk" met Haagse naam: toch ineligible (naam/inhoud wijst op Den Haag)', st('Subsidie Haagse kunst- en cultuurprojecten').eligibility === 'ineligible' && !st('Subsidie Haagse kunst- en cultuurprojecten').relevant);
  check('onbekende geografie van het fonds: unknown, wel verder (neutraal), met aandachtspunt, zonder positief regiosignaal', st('Fonds zonder werkgebied').eligibility === 'unknown' && st('Fonds zonder werkgebied').relevant && !st('Fonds zonder werkgebied').geografie.positief && st('Fonds zonder werkgebied').zwaktes.some((z) => /werkgebied|geograf/i.test(z)), st('Fonds zonder werkgebied').zwaktes.join(';'));
  const bonus = st('Meerdere regios incl. Amsterdam').score - st('Landelijk cultuurfonds').score;
  check('een expliciet passend werkgebied scoort hoger dan landelijk; onbekend scoort niet hoger dan landelijk', bonus > 0 && st('Fonds zonder werkgebied').score <= st('Landelijk cultuurfonds').score, `${bonus} / ${st('Fonds zonder werkgebied').score} vs ${st('Landelijk cultuurfonds').score}`);

  // Zelfde Haagse regeling bij een project in Den Haag: eligible (bewijst dat dit geen blinde uitsluiting is)
  const dh = crit({ themas: THEATER, kernThemas: ['Theater en podiumkunsten'], regios: ['Den Haag'], locatieTekst: 'Den Haag' });
  const selDh = beoordeel(dh, [rij({ naam: 'Subsidie Haagse kunst- en cultuurprojecten', themas: THEATER, regios: ['Landelijk'] }), rij({ naam: 'Haags cultuurfonds', themas: THEATER, regios: ['Den Haag'] }), rij({ naam: 'Amsterdams fonds', themas: THEATER, regios: ['Amsterdam'] })]);
  check('Haagse regeling bij een project in Den Haag: eligible en relevant', vind(selDh, 'Subsidie Haagse kunst- en cultuurprojecten').relevant && vind(selDh, 'Haags cultuurfonds').relevant);
  check('Amsterdams fonds bij een project in Den Haag: ineligible', vind(selDh, 'Amsterdams fonds').eligibility === 'ineligible' && !vind(selDh, 'Amsterdams fonds').relevant);

  // Onbekende projectlocatie: neutraal - geen bonus, niet automatisch uitgesloten
  const zonder = crit({ themas: THEATER, kernThemas: ['Theater en podiumkunsten'] });
  const selZ = beoordeel(zonder, [rij({ naam: 'Haags cultuurfonds', themas: ['Theater en podiumkunsten'], regios: ['Den Haag'] }), rij({ naam: 'Landelijk cultuurfonds', themas: ['Theater en podiumkunsten'], regios: ['Landelijk'] })]);
  const hz = vind(selZ, 'Haags cultuurfonds');
  check('projectlocatie onbekend: plaatsgebonden fonds is unknown, niet automatisch uitgesloten', hz.eligibility === 'unknown' && hz.relevant);
  check('projectlocatie onbekend: geen geografische bonus en een aandachtspunt over de locatie', !hz.geografie.positief && hz.zwaktes.some((z) => /projectlocatie|Den Haag/.test(z)) && hz.score <= vind(selZ, 'Landelijk cultuurfonds').score, hz.zwaktes.join(';'));
}

// ---------------------------------------------------------------- Brede termen
sectie('Brede termen: generieke labels zijn nooit voldoende op zichzelf');
{
  const BREED = ['Sociaal-maatschappelijk', 'Welzijn', 'Participatie & inclusie', 'Maatschappij', 'Cultuur'];
  // Het project: armoede (kern); de extractie breidt uit met brede labels, zoals in productie.
  const arm = crit({ themas: ['Armoedebestrijding', 'Zelfredzaamheid', ...BREED], kernThemas: ['Armoedebestrijding', 'Zelfredzaamheid'], doelgroepen: ['Mensen in armoede'], regios: ['Amsterdam'], locatieTekst: 'Amsterdam' });
  const rows = [];
  for (const label of BREED) {
    rows.push(rij({ naam: `Alleen ${label}`, themas: [label], regios: ['Landelijk'] }));
    rows.push(rij({ naam: `${label} met regio`, themas: [label], regios: ['Amsterdam'] }));
    rows.push(rij({ naam: `${label} met doelgroep`, themas: [label], doelgroepen: ['Mensen in armoede'], regios: ['Landelijk'] }));
  }
  const sel = beoordeel(arm, rows);
  for (const label of BREED) {
    check(`"${label}" alleen: geen match`, !vind(sel, `Alleen ${label}`).relevant);
    check(`"${label}" + alleen regio: geen match (regio is geen inhoudelijk signaal)`, !vind(sel, `${label} met regio`).relevant);
  }
  const metDg = BREED.filter((l) => vind(sel, `${l} met doelgroep`).relevant);
  check('brede/indirecte thema\'s tellen WEL mee met een tweede onafhankelijk inhoudelijk signaal (doelgroep van project én fonds)', metDg.length >= 3, metDg.join(','));
  check('"Cultuur" blijft in deze armoede-context zonder inhoudelijk signaal buiten beeld', !vind(sel, 'Cultuur met doelgroep').relevant || vind(sel, 'Cultuur met doelgroep').themaNiveau !== 'kern');
  check('bij een brede match staat "het thema sluit alleen indirect aan" in de aandachtspunten', vind(sel, 'Welzijn met doelgroep').relevant ? vind(sel, 'Welzijn met doelgroep').zwaktes.some((z) => /indirect/.test(z)) : true);

  // Direct matchende thema's wegen zwaar (direct > indirect + doelgroep)
  const sel2 = beoordeel(arm, [rij({ naam: 'Direct armoede', themas: ['Armoedebestrijding'], regios: ['Landelijk'] }), rij({ naam: 'Indirect met doelgroep', themas: ['Welzijn'], doelgroepen: ['Mensen in armoede'], regios: ['Landelijk'] })]);
  check('een direct thema weegt zwaarder dan een indirect thema met doelgroep', vind(sel2, 'Direct armoede').score > vind(sel2, 'Indirect met doelgroep').score, `${vind(sel2, 'Direct armoede').score} vs ${vind(sel2, 'Indirect met doelgroep').score}`);
  check('een direct thema is een match zonder tweede signaal', vind(sel2, 'Direct armoede').relevant);
}

// ---------------------------------------------------------------- Focus
sectie('Focus-aftrek: alleen bij echte inhoudelijke afwijking; een bredere portefeuille is geen straf');
{
  const KUNST = ['Kunst', 'Cultuur', 'Film', 'Muziek', 'Theater en podiumkunsten', 'Literatuur', 'Beeldende kunst', 'Dans'];
  const c = crit({ themas: ['Cultuur', 'Kunst', 'Theater en podiumkunsten'], regios: ['Den Haag'], locatieTekst: 'Den Haag' });
  const sel = beoordeel(c, [
    rij({ naam: 'Brede culturele portefeuille', themas: KUNST, regios: ['Den Haag'] }),
    rij({ naam: 'Smal cultuurfonds', themas: ['Cultuur', 'Kunst'], regios: ['Den Haag'] }),
    rij({ naam: 'Zwaartepunt elders', themas: ['Sport', 'Natuur', 'Educatie', 'Ouderen', 'Jeugd en kinderen', 'Cultuur'], regios: ['Den Haag'] }),
    { ...rij({ naam: 'Sportfonds uitsluitend', themas: ['Sport', 'Theater en podiumkunsten'], regios: ['Den Haag'] }), aanvraagcriteria: 'Dit fonds ondersteunt uitsluitend sportprojecten.' },
    { ...rij({ naam: 'Sportfonds met podium', themas: ['Sport', 'Theater en podiumkunsten'], regios: ['Den Haag'] }), aanvraagcriteria: 'Dit fonds ondersteunt sportprojecten en podiumkunsten.' },
  ]);
  const b = vind(sel, 'Brede culturele portefeuille');
  const s = vind(sel, 'Smal cultuurfonds');
  check('brede portefeuille binnen hetzelfde domein: geen focusconflict', b.focus === 'geen', b.focus);
  check('brede portefeuille binnen hetzelfde domein: relevant (Den Haag-geval: bleef eerder net onder de drempel)', b.relevant, `score ${b.score}`);
  check('brede portefeuille scoort niet lager dan een smal fonds met dezelfde kern', b.score >= s.score - 1, `${b.score} vs ${s.score}`);
  const z = vind(sel, 'Zwaartepunt elders');
  check('zwaartepunt in andere domeinen: focus = sterk en aandachtspunt', z.focus === 'sterk' && z.zwaktes.some((w) => /zwaartepunt/.test(w)), `${z.focus}: ${z.zwaktes.join(';')}`);
  check('sterke mismatch scoort duidelijk lager dan het smalle fonds', z.score < s.score - 10, `${z.score} vs ${s.score}`);
  const e = vind(sel, 'Sportfonds uitsluitend');
  check('zonder expliciete uitsluiting (alleen een bredere portefeuille) wordt hetzelfde fonds niet uitgesloten', vind(sel, 'Sportfonds met podium').relevant, vind(sel, 'Sportfonds met podium').uitsluiting);
  check('fonds dat zich expliciet uitsluitend op een ander domein richt: uitgesloten', !e.relevant && /uitsluitend|ander domein|focus/i.test(e.uitsluiting || ''), `${e.relevant} ${e.uitsluiting}`);
}

// ---------------------------------------------------------------- Uitleg
sectie('Uitleg per fonds: waarom het past en wat de aandachtspunten zijn');
{
  const c = crit({ themas: ['Armoedebestrijding'], kernThemas: ['Armoedebestrijding'], doelgroepen: ['Mensen in armoede'], regios: ['Amsterdam'], locatieTekst: 'Amsterdam', gevraagdBedrag: 45000, activiteiten: ['evenement'] });
  const sel = beoordeel(c, [
    { ...rij({ naam: 'Volledig passend', themas: ['Armoedebestrijding'], doelgroepen: ['Mensen in armoede'], regios: ['Amsterdam'], min: 5000, max: 50000 }), cofinanciering: '25% eigen bijdrage' },
    rij({ naam: 'Indirect en landelijk', themas: ['Welzijn'], doelgroepen: ['Mensen in armoede'], regios: ['Landelijk'] }),
  ]);
  const v = vind(sel, 'Volledig passend');
  check('waarom: noemt thema, werkgebied en doelgroep', v.waarom.some((w) => /thema/.test(w)) && v.waarom.some((w) => /werkgebied/.test(w)) && v.waarom.some((w) => /doelgroep/.test(w)), v.waarom.join(';'));
  check('aandachtspunten: bedrag dicht tegen het maximum, cofinanciering en niet-expliciete activiteit', v.zwaktes.some((z) => /maximum/.test(z)) && v.zwaktes.some((z) => /cofinanciering|eigen bijdrage/.test(z)) && v.zwaktes.some((z) => /activiteit/.test(z)), v.zwaktes.join(';'));
  const i = vind(sel, 'Indirect en landelijk');
  check('indirect thema: aandachtspunt "sluit alleen indirect aan"', i.relevant && i.zwaktes.some((z) => /indirect/.test(z)), i.zwaktes.join(';'));
  check('uitleg bestaat voor elke relevante kandidaat (waarom niet leeg)', sel.relevant.every((k) => k.waarom.length > 0));
}

console.log(`\nRESULTAAT: ${ok} OK, ${fout} FAIL`);
process.exit(fout ? 1 : 0);
