// Deterministische bronverificatie: fondsnaam, deadline (A-E), bedragen, kwalitatieve velden en database <-> web. Geen netwerk, geen AI.
import { extractReadableText } from '../../supabase/functions/_shared/readableText.ts';
import {
  maakBronPagina, controleerFinancier, verifySourceEvidence, compareDatabaseAndWeb, vindDatums, vindBedragen, isGeneriekeNaam, normaliseerCitaat, platgeslagen, sha256Hex,
} from '../../supabase/functions/_shared/sourceEvidence.ts';
import { check, gelijk, sectie, klaar, stand, html } from './hulp.mjs';

stand.naam = 'bewijs';

async function bron(body, host = 'www.fonds-a.example.nl') {
  const url = `https://${host}/aanvragen`;
  const l = extractReadableText(html(body));

  return maakBronPagina({ ok: true, bronUrl: url, eindUrl: url, hostnaam: host, httpStatus: 200, contentType: 'text/html', tekst: '', bytes: 1, redirects: 0, duurMs: 1, dnsGepind: false }, l.text);
}

const FONDS = { naam: 'Rotterdams Jongerencultuurfonds' };
const PAG = '<h1>Rotterdams Jongerencultuurfonds</h1><p>Aanvragen kan tot 12 november 2026.</p><p>Maximaal &euro; 25.000 per aanvraag.</p><p>Minimaal &euro; 5.000 per project.</p>';

sectie('1. Fondsnaam (conservatief)');
{
  const p = await bron(PAG);
  let n = await controleerFinancier(p, FONDS);
  check('naam komt letterlijk voor: gevonden, met fragment en hash', n.gevonden && n.via === 'naam' && n.fragment.includes('Rotterdams Jongerencultuurfonds') && /^[0-9a-f]{64}$/.test(n.fragment_sha256));

  n = await controleerFinancier(await bron('<p>Welkom bij ROTTERDAMS JONGERENCULTUURFONDS, voor jongeren.</p>'), FONDS);
  check('hoofdletterongevoelig voor namen', n.gevonden === true);

  n = await controleerFinancier(await bron('<p>Het Jongerencultuurfonds van de stad.</p>'), FONDS);
  check('alleen een deel van de naam: niet gevonden', n.gevonden === false && n.reden === 'financier_not_found');

  n = await controleerFinancier(await bron('<p>Dit is een fonds. Rotterdams is een stad. Cultuur voor jongeren.</p>'), FONDS);
  check('losse woorden verspreid over de pagina: niet gevonden', n.gevonden === false);

  n = await controleerFinancier(await bron('<p>Rotterdams Jongerencultuurfondsen en meer</p>'), FONDS);
  check('woordgrens: "…fondsen" is niet "…fonds"', n.gevonden === false);

  n = await controleerFinancier(await bron('<p>NieuwRotterdams Jongerencultuurfonds</p>'), FONDS);
  check('woordgrens aan de voorkant', n.gevonden === false);

  n = await controleerFinancier(await bron('<p>Geen naam hier</p><script>var n="Rotterdams Jongerencultuurfonds"</script><div hidden>Rotterdams Jongerencultuurfonds</div><!-- Rotterdams Jongerencultuurfonds -->'), FONDS);
  check('naam alleen in script, verborgen element of commentaar: niet gevonden', n.gevonden === false);

  n = await controleerFinancier(await bron('<p>Rotterdams&nbsp;&nbsp;Jongerencultuurfonds</p>'), FONDS);
  check('NBSP/extra witruimte in de paginatekst: wel gevonden (alleen witruimte-normalisatie)', n.gevonden === true);

  n = await controleerFinancier(p, { naam: '' });
  check('lege naam: niet gevonden', n.gevonden === false && n.reden === 'naam_ontbreekt');

  n = await controleerFinancier(await bron('<p>abc</p>'), { naam: 'abc' });
  check('naam korter dan 4 tekens wordt nooit gebruikt', n.gevonden === false);

  // Generieke namen
  gelijk('generiek: "Fonds voor Cultuur"', [isGeneriekeNaam('Fonds voor Cultuur'), isGeneriekeNaam('Stichting Sport en Zorg'), isGeneriekeNaam('Oranje Fonds'), isGeneriekeNaam('Rotterdams Jongerencultuurfonds'), isGeneriekeNaam('Dansimpuls Nederland')], [true, true, false, false, false]);

  const gen = await bron('<h1>Fonds voor Cultuur</h1><p>Informatie over cultuur.</p>', 'www.ergens-anders.nl');
  n = await controleerFinancier(gen, { naam: 'Fonds voor Cultuur' });
  check('generieke naam zonder domeinbewijs: NIET bevestigd, ook al staat de frase er', n.gevonden === false && n.reden === 'naam_te_generiek_zonder_domeinbewijs');

  n = await controleerFinancier(await bron('<p>Het woord cultuur staat hier, en ook fonds, maar niet de frase.</p>'), { naam: 'Fonds voor Cultuur' });
  check('"cultuur" ergens op de pagina bevestigt "Fonds voor Cultuur" niet', n.gevonden === false);

  n = await controleerFinancier(await bron('<h1>Fonds voor Cultuur</h1>', 'www.fondsvoorcultuur.example.nl'), { naam: 'Fonds voor Cultuur', domeinen: ['fondsvoorcultuur.example.nl'] });
  check('generieke naam MET server-bekend domein: bevestigd', n.gevonden === true && n.domeinMatch === true);

  n = await controleerFinancier(await bron('<h1>Fonds voor Cultuur</h1>', 'fondsvoorcultuur.example.nl.evil.example.com'), { naam: 'Fonds voor Cultuur', domeinen: ['fondsvoorcultuur.example.nl'] });
  check('domein-lookalike (domein als subdomein van een ander domein): geen match', n.gevonden === false);

  n = await controleerFinancier(await bron('<h1>Fonds voor Cultuur</h1>', 'notfondsvoorcultuur.example.nl'), { naam: 'Fonds voor Cultuur', domeinen: ['fondsvoorcultuur.example.nl'] });
  check('domein-achtervoegsel zonder punt: geen match', n.gevonden === false);

  // Aliassen: alleen server-bekend
  const alias = await bron('<h1>RJCF informatie</h1><p>Het Jongerenfonds Rotterdam helpt jongeren.</p>');
  n = await controleerFinancier(alias, { naam: 'Rotterdams Jongerencultuurfonds', aliassen: ['Jongerenfonds Rotterdam'] });
  check('server-bekende alias: bevestigd, via alias', n.gevonden === true && n.via === 'alias', JSON.stringify(n));
  n = await controleerFinancier(alias, { naam: 'Rotterdams Jongerencultuurfonds' });
  check('zonder aliassen geen bevestiging via een "bijna gelijke" naam', n.gevonden === false);
  n = await controleerFinancier(alias, { naam: 'Rotterdams Jongerencultuurfonds', aliassen: ['RJCF'] });
  check('alias van 4 tekens (afkorting) werkt als hij letterlijk voorkomt', n.gevonden === true);
}

sectie('2. Deadline: de afgesproken bewijsregel (A t/m E)');
{
  const D = (datum, fragment, db) => ({ deadline: { waarde: datum, fragment, db } });
  const run = async (body, claims, financier = FONDS, host) => verifySourceEvidence(await bron(body, host), financier, claims);

  // A
  let u = await run(PAG, D('2026-11-12', 'Aanvragen kan tot 12 november 2026.'));
  gelijk('A: bron zegt "Aanvragen kan tot 12 november 2026." en het voorstel 12 november 2026 -> confirmed', [u.velden.deadline.status, u.velden.deadline.reden], ['confirmed', 'ok']);
  check('  met fragment, hash en waarde', u.velden.deadline.fragment === 'Aanvragen kan tot 12 november 2026.' && /^[0-9a-f]{64}$/.test(u.velden.deadline.fragment_sha256) && u.velden.deadline.waarde === '2026-11-12');
  check('  fondsnaam is dan ook bevestigd', u.velden.fondsnaam.status === 'confirmed');

  // B
  u = await run('<h1>Rotterdams Jongerencultuurfonds</h1><p>Wij steunen jongeren in Rotterdam.</p>', D('2026-11-12', 'Wij steunen jongeren in Rotterdam.'));
  check('B: bron bevat het fonds maar geen deadline -> nooit confirmed', u.velden.deadline.status === 'uncertain' && u.velden.deadline.reden === 'geen_datum_in_fragment');
  u = await run('<h1>Rotterdams Jongerencultuurfonds</h1>', { deadline: { waarde: '2026-11-12' } });
  check('B2: geen fragment aangeleverd -> not_checked', u.velden.deadline.status === 'not_checked' && u.velden.deadline.reden === 'geen_fragment');

  // C
  u = await run('<h1>Rotterdams Jongerencultuurfonds</h1><p>Aanvragen kan tot 12 november 2026.</p><p>Wij steunen jongeren.</p>', D('2026-11-12', 'Wij steunen jongeren in de wijk, elk jaar opnieuw.'));
  check('C: datum staat elders op de pagina, maar niet in het (niet-bestaande) bewijsfragment -> niet confirmed', u.velden.deadline.status === 'uncertain' && u.velden.deadline.reden === 'fragment_not_found');
  u = await run('<h1>Rotterdams Jongerencultuurfonds</h1><p>Aanvragen kan tot 12 november 2026.</p><p>Wij steunen jongeren in Rotterdam.</p>', D('2026-11-12', 'Wij steunen jongeren in Rotterdam.'));
  check('C2: fragment bestaat wel maar bevat de datum niet -> niet confirmed', u.velden.deadline.status === 'uncertain' && u.velden.deadline.reden === 'geen_datum_in_fragment');

  // D
  u = await run('<h1>Rotterdams Jongerencultuurfonds</h1><p>De volgende ronde wordt later bekendgemaakt.</p>', D('2026-11-12', 'De volgende ronde wordt later bekendgemaakt.'));
  check('D: "Volgende ronde wordt later bekendgemaakt" -> geen datum afgeleid', u.velden.deadline.status === 'uncertain' && u.velden.deadline.reden === 'geen_datum_in_fragment');
  u = await run('<h1>Rotterdams Jongerencultuurfonds</h1><p>De volgende ronde wordt later bekendgemaakt, vermoedelijk tot 12 november 2026.</p>', D('2026-11-12', 'De volgende ronde wordt later bekendgemaakt, vermoedelijk tot 12 november 2026.'));
  check('D2: vage formulering met toch een datum -> voorbehoud, niet confirmed', u.velden.deadline.status === 'uncertain' && u.velden.deadline.reden === 'voorbehoud_in_fragment');

  // E
  const meer = '<h1>Rotterdams Jongerencultuurfonds</h1><p>Eerste ronde: aanvragen tot 12 november 2026. Tweede ronde: aanvragen tot 15 maart 2027.</p>';
  u = await run(meer, D('2026-11-12', 'Eerste ronde: aanvragen tot 12 november 2026. Tweede ronde: aanvragen tot 15 maart 2027.'));
  check('E: meerdere deadlines in het fragment -> geen willekeurige keuze', u.velden.deadline.status === 'uncertain' && u.velden.deadline.reden === 'meerdere_datums_in_fragment');
  u = await run('<h1>Rotterdams Jongerencultuurfonds</h1><p>Eerste ronde: aanvragen tot 12 november 2026.</p><p>Tweede ronde: aanvragen tot 15 maart 2027.</p>', D('2026-11-12', 'Eerste ronde: aanvragen tot 12 november 2026.'));
  check('E2: meerdere deadlines op de pagina, fragment bevat er precies één en die klopt -> confirmed voor die ronde', u.velden.deadline.status === 'confirmed');

  // Overige regels
  const dl = (fragment, datum = '2026-11-12') => run(`<h1>Rotterdams Jongerencultuurfonds</h1><p>${fragment}</p>`, D(datum, fragment));
  for (const [fr, naam] of [
    ['De deadline is 12-11-2026 voor alle aanvragen.', 'dd-mm-jjjj'], ['Uiterlijk 12/11/2026 indienen via het portaal.', 'dd/mm/jjjj'], ['Aanvragen kan tot 12.11.2026 via het portaal.', 'dd.mm.jjjj'],
    ['Deadline voor aanvragen: 2026-11-12 (middernacht).', 'ISO'], ['Indienen kan tot en met 12 nov. 2026 via het portaal.', 'afgekorte maand'], ['Aanvragen sluit op 12 november 2026 om 17:00.', 'met tijd'],
    ['Uiterlijk 12 november 2026 aanvragen indienen.', 'uiterlijk'], ['Sluitingsdatum voor aanvragen: 12 november 2026', 'sluitingsdatum'],
  ]) {
    const x = await dl(fr);
    check(`datumnotatie ${naam}: confirmed`, x.velden.deadline.status === 'confirmed', `${x.velden.deadline.reden}`);
  }

  let x = await dl('Aanvragen kan tot 12 november (het jaar volgt nog).');
  check('datum zonder jaar: niet confirmed', x.velden.deadline.status === 'uncertain');
  x = await dl('Aanvragen kan tot 31 november 2026 inclusief.');
  check('onbestaande datum (31 november): niet confirmed', x.velden.deadline.status === 'uncertain' && x.velden.deadline.reden === 'datum_zonder_jaar_of_ongeldig');
  x = await dl('Aanvragen kan tot 15 november 2026 inclusief.');
  check('fragment noemt een andere datum dan het voorstel: niet confirmed, de online datum wordt vastgelegd', x.velden.deadline.status === 'uncertain' && x.velden.deadline.reden === 'andere_datum_in_fragment' && x.velden.deadline.waarde === '2026-11-15');
  x = await dl('Het jaarlijkse evenement vindt plaats op 12 november 2026.');
  check('datum zonder deadlinecontext (evenement): niet confirmed', x.velden.deadline.status === 'uncertain' && x.velden.deadline.reden === 'geen_deadlinecontext_in_fragment');
  x = await dl('Naar verwachting kunt u aanvragen tot 12 november 2026.');
  check('"naar verwachting": niet confirmed', x.velden.deadline.reden === 'voorbehoud_in_fragment');
  x = await dl('Streefdatum voor aanvragen is 12 november 2026 indienen.');
  check('"streefdatum": niet confirmed', x.velden.deadline.reden === 'voorbehoud_in_fragment');
  x = await dl('12-11-2026');
  check('te kort fragment (onder 12 tekens): niet confirmed', x.velden.deadline.status === 'uncertain' && x.velden.deadline.reden === 'fragment_te_kort');

  u = await run(PAG, D('2026-11-12', 'aanvragen kan tot 12 november 2026.'));
  check('citaat is hoofdlettergevoelig: "aanvragen" != "Aanvragen" -> niet confirmed', u.velden.deadline.status === 'uncertain' && u.velden.deadline.reden === 'fragment_not_found');
  u = await run(PAG, D('2026-11-12', 'Aanvragen kan tot 12 november 2026'));
  check('citaat zonder slotpunt is een deelstring: toegestaan', u.velden.deadline.status === 'confirmed');
  u = await run(PAG, D('2026-11-12', 'Aanvragen&nbsp;kan   tot\n12 november 2026.'));
  check('citaat met entiteiten en andere witruimte: wel confirmed (toegestane normalisatie)', u.velden.deadline.status === 'confirmed');
  u = await run(PAG, D('2026-11-12', 'Aanvragen mag tot 12 november 2026.'));
  check('één woord anders ("mag" i.p.v. "kan"): niet confirmed (geen "ongeveer gelijk")', u.velden.deadline.status === 'uncertain');
  u = await run(PAG, D('2026-11-12', 'Aanvragen kan tot ' + String.fromCharCode(49, 50) + ' november 2026.'.replace('2026', '2026')));
  check('letterlijke ASCII-variant van het citaat: confirmed', u.velden.deadline.status === 'confirmed');
  u = await run(PAG, D('2026-11-12', 'x'.repeat(301)));
  check('citaat langer dan 300 tekens: niet confirmed', u.velden.deadline.reden === 'fragment_te_lang');
  u = await run(PAG, D('12 november 2026', 'Aanvragen kan tot 12 november 2026.'));
  check('claimdatum niet in ISO-vorm: not_checked (de server levert ISO)', u.velden.deadline.status === 'not_checked' && u.velden.deadline.reden === 'ongeldige_claimdatum');
  u = await run(PAG, D('2026-02-30', 'Aanvragen kan tot 12 november 2026.'));
  check('onbestaande claimdatum: not_checked', u.velden.deadline.status === 'not_checked');

  // Script/style/verborgen tekst is nooit bewijs
  u = await run('<h1>Rotterdams Jongerencultuurfonds</h1><script>var t="Aanvragen kan tot 12 november 2026.";</script><style>p::after{content:"Aanvragen kan tot 12 november 2026."}</style><div hidden>Aanvragen kan tot 12 november 2026.</div>', D('2026-11-12', 'Aanvragen kan tot 12 november 2026.'));
  check('citaat alleen in script/style/verborgen markup: niet confirmed', u.velden.deadline.status === 'uncertain' && u.velden.deadline.reden === 'fragment_not_found');

  // Financier eerst
  u = await run('<h1>Een ander fonds</h1><p>Aanvragen kan tot 12 november 2026.</p>', D('2026-11-12', 'Aanvragen kan tot 12 november 2026.'));
  check('fragment klopt letterlijk maar de financier staat niet op de pagina: deadline NIET confirmed', u.velden.fondsnaam.status === 'uncertain' && u.velden.deadline.status === 'uncertain' && u.velden.deadline.reden === 'financier_not_found');

  // Client-side gerenderde pagina
  u = await run('<div id="root"></div><script>document.getElementById("root").innerHTML="Rotterdams Jongerencultuurfonds: aanvragen tot 12 november 2026."</script><noscript>Zet JavaScript aan</noscript>', D('2026-11-12', 'Rotterdams Jongerencultuurfonds: aanvragen tot 12 november 2026.'));
  check('door JavaScript gerenderde inhoud bestaat niet voor ons: onzeker, niets geraden', u.financier.gevonden === false && u.velden.deadline.status === 'uncertain');
}

sectie('3. Bedragen en kwalitatieve velden');
{
  const run = async (body, claims) => verifySourceEvidence(await bron(body), FONDS, claims);

  let u = await run(PAG, { bedrag_max: { waarde: 25000, fragment: 'Maximaal € 25.000 per aanvraag.' }, bedrag_min: { waarde: 5000, fragment: 'Minimaal € 5.000 per project.' } });
  check('maximum en minimum bevestigd', u.velden.bedrag_max.status === 'confirmed' && u.velden.bedrag_min.status === 'confirmed', JSON.stringify(u.velden));

  gelijk('bedragen herkennen', [vindBedragen('€ 25.000'), vindBedragen('€25.000,-'), vindBedragen('25.000 euro'), vindBedragen('EUR 25000'), vindBedragen('€ 1.250,50'), vindBedragen('geen bedrag 2026')], [[25000], [25000], [25000], [25000], [1250.5], []]);

  u = await run('<h1>Rotterdams Jongerencultuurfonds</h1><p>Maximaal € 25.000 per aanvraag.</p>', { bedrag_max: { waarde: 20000, fragment: 'Maximaal € 25.000 per aanvraag.' } });
  check('ander bedrag in het fragment: niet confirmed', u.velden.bedrag_max.status === 'uncertain' && u.velden.bedrag_max.reden === 'ander_bedrag_in_fragment');
  u = await run('<h1>Rotterdams Jongerencultuurfonds</h1><p>Tussen € 5.000 en maximaal € 25.000 per aanvraag.</p>', { bedrag_max: { waarde: 25000, fragment: 'Tussen € 5.000 en maximaal € 25.000 per aanvraag.' } });
  check('twee bedragen in het fragment: geen willekeurige keuze', u.velden.bedrag_max.reden === 'meerdere_bedragen_in_fragment' && u.velden.bedrag_max.status === 'uncertain');
  u = await run('<h1>Rotterdams Jongerencultuurfonds</h1><p>De organisatie heeft € 25.000 ontvangen vorig jaar.</p>', { bedrag_max: { waarde: 25000, fragment: 'De organisatie heeft € 25.000 ontvangen vorig jaar.' } });
  check('bedrag zonder maximum-context: niet confirmed', u.velden.bedrag_max.reden === 'geen_bedragcontext_in_fragment');
  u = await run('<h1>Rotterdams Jongerencultuurfonds</h1><p>Minimaal € 25.000 per aanvraag.</p>', { bedrag_max: { waarde: 25000, fragment: 'Minimaal € 25.000 per aanvraag.' } });
  check('minimum-formulering als maximum geclaimd: niet confirmed', u.velden.bedrag_max.status === 'uncertain');
  u = await run('<h1>Rotterdams Jongerencultuurfonds</h1><p>Maximaal ongeveer € 25.000 per aanvraag.</p>', { bedrag_max: { waarde: 25000, fragment: 'Maximaal ongeveer € 25.000 per aanvraag.' } });
  check('"ongeveer": niet confirmed', u.velden.bedrag_max.reden === 'voorbehoud_in_fragment');
  u = await run(PAG, { bedrag_max: { waarde: -5, fragment: 'Maximaal € 25.000 per aanvraag.' } });
  check('negatieve claim: not_checked', u.velden.bedrag_max.status === 'not_checked');

  // Kwalitatieve velden: nooit confirmed
  for (const veld of ['voorwaarden', 'cofinanciering', 'doelgroep', 'aanvragertype', 'geografie']) {
    u = await run('<h1>Rotterdams Jongerencultuurfonds</h1><p>Wij ondersteunen jongeren tussen 12 en 27 jaar in Rotterdam.</p>', { [veld]: { waarde: 'jongeren 12-27', fragment: 'Wij ondersteunen jongeren tussen 12 en 27 jaar in Rotterdam.' } });
    check(`${veld}: citaat aanwezig maar nooit automatisch confirmed`, u.velden[veld].status === 'uncertain' && u.velden[veld].reden === 'inhoudelijke_beoordeling_niet_deterministisch');
    u = await run('<h1>Rotterdams Jongerencultuurfonds</h1><p>Iets anders.</p>', { [veld]: { waarde: 'x', fragment: 'Wij ondersteunen jongeren tussen 12 en 27 jaar.' } });
    check(`${veld}: citaat niet op de pagina -> uncertain`, u.velden[veld].status === 'uncertain' && u.velden[veld].reden === 'fragment_not_found');
    u = await run(PAG, { [veld]: { waarde: 'x' } });
    check(`${veld}: geen citaat -> not_checked`, u.velden[veld].status === 'not_checked');
  }
  u = await run(PAG, { doelgroep: { waarde: 'niet voor jongeren', fragment: 'Aanvragen kan tot 12 november 2026.' } });
  check('ontkenning ("niet voor jongeren") kan niet door een citaat bevestigd worden', u.velden.doelgroep.status !== 'confirmed');
}

sectie('4. Database <-> web per veld (nooit overschrijven, nooit "nieuwste" kiezen)');
{
  const ev = async (db, claimDatum = '2026-11-15', fragment = 'Aanvragen kan tot 15 november 2026.') => {
    const p = await bron(`<h1>Rotterdams Jongerencultuurfonds</h1><p>${fragment}</p>`);
    const u = await verifySourceEvidence(p, FONDS, { deadline: { waarde: claimDatum, fragment, db } });

    return compareDatabaseAndWeb('deadline', db, u.velden.deadline);
  };

  let v = await ev('2026-11-12');
  gelijk('database 2026-11-12, web (bewezen) 2026-11-15 -> conflict met alle bewijs', [v.status, v.db_waarde, v.waarde, v.fragment, /^[0-9a-f]{64}$/.test(v.fragment_sha256), v.reden], ['conflict', '2026-11-12', '2026-11-15', 'Aanvragen kan tot 15 november 2026.', true, 'afwijkend_van_database_bewezen']);

  v = await ev('2026-11-15');
  check('gelijk aan de database en bewezen -> confirmed', v.status === 'confirmed' && v.db_waarde === undefined && v.reden === 'ok|gelijk_aan_database');

  v = await ev('2026-11-12T00:00:00+00:00');
  check('databasewaarde als tijdstempel wordt op datum vergeleken (verschil -> conflict)', v.status === 'conflict' && v.db_waarde === '2026-11-12');

  v = await ev(null);
  check('database leeg, web bewezen -> confirmed (database blijft ongemoeid)', v.status === 'confirmed' && v.reden === 'ok|database_leeg' && v.db_waarde === undefined);
  v = await ev(undefined);
  check('database undefined: idem', v.status === 'confirmed');
  v = await ev('');
  check('database lege tekst: idem', v.status === 'confirmed');

  v = await ev('2026-11-12', '2026-11-15', 'Wij steunen jongeren in Rotterdam.');
  check('database gevuld, web zonder bewijs (geen datum in citaat) -> uncertain, geen conflict', v.status === 'uncertain' && v.db_waarde === undefined);

  v = await ev('2026-11-12', '2026-11-15', 'Dit citaat staat niet op de pagina.');
  check('afwijkende maar onbewezen claim -> uncertain (|afwijkend_van_database_niet_bewezen), geen conflict', v.status === 'uncertain');

  const p = await bron(PAG);
  const zonderClaim = compareDatabaseAndWeb('deadline', '2026-11-12', { veld: 'deadline', status: 'not_checked', reden: 'geen_fragment' });
  check('database gevuld, geen online claim -> not_checked', zonderClaim.status === 'not_checked');

  const bedrag = async (db) => {
    const u = await verifySourceEvidence(p, FONDS, { bedrag_max: { waarde: 25000, fragment: 'Maximaal € 25.000 per aanvraag.' } });

    return compareDatabaseAndWeb('bedrag_max', db, u.velden.bedrag_max);
  };
  check('bedrag: gelijk -> confirmed', (await bedrag(25000)).status === 'confirmed' && (await bedrag('25000')).status === 'confirmed');
  const bc = await bedrag(20000);
  gelijk('bedrag: database 20000, web 25000 (bewezen) -> conflict', [bc.status, bc.db_waarde, bc.waarde], ['conflict', '20000', '25000']);
  check('bedrag: database leeg -> confirmed', (await bedrag(null)).status === 'confirmed');

  const kw = compareDatabaseAndWeb('doelgroep', 'Jongeren 12-30', { veld: 'doelgroep', status: 'uncertain', reden: 'x', waarde: 'Jongeren 12-27' });
  check('kwalitatief veld komt nooit in conflict', kw.status === 'uncertain' && kw.db_waarde === undefined);

  const naam = compareDatabaseAndWeb('fondsnaam', 'Rotterdams Jongerencultuurfonds', { veld: 'fondsnaam', status: 'confirmed', reden: 'ok', waarde: 'Rotterdams Jongerencultuurfonds' });
  check('fondsnaam: ongewijzigd doorgegeven, geen conflictbegrip', naam.status === 'confirmed' && naam.db_waarde === undefined);

  const invoer = { veld: 'deadline', status: 'confirmed', reden: 'ok', waarde: '2026-11-15', fragment: 'f' };
  const kopie = JSON.stringify(invoer);
  compareDatabaseAndWeb('deadline', '2026-11-12', invoer);
  check('de invoer wordt niet gewijzigd', JSON.stringify(invoer) === kopie);
}

sectie('5. Hulpfuncties');
{
  gelijk('platgeslagen', platgeslagen('  a \n\t b  '), 'a b');
  gelijk('citaat: entiteiten één keer', normaliseerCitaat('Fonds &amp;amp; Co'), 'Fonds &amp; Co');
  check('sha256 klopt met bekende waarde', (await sha256Hex('abc')) === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  gelijk('datums', vindDatums('1 maart 2026 en 2026-03-02 en 3-3-2026').map((d) => d.iso).sort(), ['2026-03-01', '2026-03-02', '2026-03-03']);
  gelijk('datum zonder jaar', vindDatums('tot 5 mei').map((d) => [d.iso, d.heeftJaar]), [[null, false]]);
  gelijk('"5 meiden" is geen datum', vindDatums('5 meiden').length, 0);
  gelijk('1e en 2de', vindDatums('1e juni 2026 en 2de juli 2026').map((d) => d.iso), ['2026-06-01', '2026-07-02']);
}

klaar('BEWIJS');
