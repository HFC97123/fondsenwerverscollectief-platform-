// Pro-selectie: de zuivere rekenmodules (geografie op landniveau, bijdrageschatting, korte lijst met maximum van 120%).
//   node tests/pro-selectie/rekenen.test.mjs
import { projectGebied, beoordeelFondsVoorProject, vindVermeldingen, LANDEN } from '../../supabase/functions/_shared/werkgebied.ts';
import { schatBijdrage, selecteerProLijst, beoordeelGezamenlijk, gebruikelijkBedrag, percentageVanKosten, proPresentatieBlok, PRO_MAX_FACTOR } from '../../supabase/functions/_shared/proSelectie.ts';

const stand = { ok: 0, fout: 0 };
const check = (naam, waar, detail = '') => { if (waar) stand.ok += 1; else { stand.fout += 1; console.log(`  FAIL: ${naam} ${detail}`); } };
const sectie = (t) => console.log(`\n== ${t}`);

const geo = (plaats, labels, teksten = []) => beoordeelFondsVoorProject(projectGebied([plaats]), labels, teksten);

sectie('1. Geografie op landniveau: Kumasi, Ghana');
{
  const g = projectGebied(['Kumasi, Ghana']);

  check('het land Ghana wordt herkend uit "Kumasi, Ghana"', g.landen.length === 1 && g.landen[0].naam === 'Ghana' && g.landen[0].regio === 'West-Afrika' && g.landen[0].subSahara);
  check('Ghana zelf genoemd: geschikt, sterkte land', geo('Kumasi, Ghana', [], ['Ondersteunt projecten in Ghana en Senegal']).sterkte === 'land');
  check('West-Afrika: geschikt', geo('Kumasi, Ghana', ['Afrika'], ['Gericht op West-Afrika']).status === 'eligible' && geo('Kumasi, Ghana', [], ['Gericht op West-Afrika']).sterkte === 'regio');
  check('Sub-Sahara Afrika (ook "alleen"): geschikt', geo('Kumasi, Ghana', ['Afrika'], ['Alleen mogelijk voor projecten in Sub-Sahara Afrika.']).status === 'eligible');
  check('Afrika als label: geschikt, sterkte werelddeel', geo('Kumasi, Ghana', ['Afrika']).sterkte === 'werelddeel');
  check('ontwikkelingslanden: geschikt omdat Ghana daaronder valt', geo('Kumasi, Ghana', [], ['Voor projecten in ontwikkelingslanden']).sterkte === 'klasse');
  check('oudere term derdewereldlanden: geschikt', geo('Kumasi, Ghana', [], ['Steun aan projecten in derdewereldlanden']).status === 'eligible');
  check('"derde wereld" en "global south": geschikt', ['de derde wereld', 'het global south', 'Landen in ontwikkeling'].every((t) => geo('Kumasi, Ghana', [], [t]).status === 'eligible'));
  check('internationaal/wereldwijd: geschikt, zwakste sterkte', geo('Kumasi, Ghana', ['Wereld / internationaal']).sterkte === 'wereld' && geo('Kumasi, Ghana', [], ['wereldwijd actief']).status === 'eligible');
  check('minst ontwikkelde landen: Ghana valt daar NIET onder', geo('Kumasi, Ghana', ['Afrika'], ['Alleen voor minst ontwikkelde landen']).status === 'ineligible');
  check('alleen Europa: niet geschikt', geo('Kumasi, Ghana', ['Europa']).status === 'ineligible');
  check('alleen Nederland/landelijk: niet geschikt voor een project in Ghana', geo('Kumasi, Ghana', ['Landelijk']).status === 'ineligible');
  check('beperkt tot andere landen: niet geschikt', geo('Kumasi, Ghana', ['Afrika'], ['Alleen projecten in Kenia en Tanzania']).status === 'ineligible');
  check('beperkt tot andere regio: niet geschikt', geo('Kumasi, Ghana', ['Afrika'], ['Uitsluitend gericht op Oost-Afrika']).status === 'ineligible');
}

sectie('2. Uitsluitingen gaan altijd voor');
{
  check('"geen projecten in Ghana" bij wereldwijd: niet geschikt', geo('Kumasi, Ghana', ['Wereld / internationaal'], ['Geen projecten in Ghana']).status === 'ineligible');
  check('uitsluiting van de regio (niet voor West-Afrika): niet geschikt, ondanks label Afrika', geo('Kumasi, Ghana', ['Afrika'], ['Niet voor projecten in West-Afrika']).status === 'ineligible');
  check('"behalve Ghana" bij ontwikkelingslanden: uitsluiting wint', geo('Kumasi, Ghana', [], ['Ontwikkelingslanden, behalve Ghana']).status === 'ineligible');
  check('uitsluiting van een ander land raakt Ghana niet', geo('Kumasi, Ghana', ['Afrika'], ['Geen projecten in Nigeria']).status === 'eligible');
  check('"niet alleen in Afrika" is geen uitsluiting', geo('Kumasi, Ghana', ['Afrika'], ['Niet alleen in Afrika maar ook in Azië']).status === 'eligible');
  check('"geen exploitatiekosten voor projecten in Afrika" sluit Afrika niet uit', geo('Kumasi, Ghana', ['Afrika'], ['Geen exploitatiekosten voor projecten in Afrika.']).status === 'eligible');
  check('beperking over de aanvrager ("in Nederland gevestigd") telt niet als werkgebied', geo('Kumasi, Ghana', ['Afrika'], ['Alleen aanvragers die in Nederland gevestigd zijn.']).status === 'eligible');
}

sectie('3. Onzeker is geen match');
{
  const o = geo('Kumasi, Ghana', [], []);

  check('geen werkgebied en geen tekst: onzeker, geen bevestigde match', o.status === 'unknown' && o.sterkte === null && Boolean(o.notitie));
  check('alleen een voorbeeld in de tekst (geen beperking, geen werkgebied): onzeker, niet uitgesloten en niet bevestigd', geo('Kumasi, Ghana', [], ['Eerder gesteund: projecten in Kenia']).status === 'unknown');
  check('geen buitenlands project herkend (Nederlandse plaats): de bestaande beoordeling blijft leidend', geo('Rotterdam', ['Landelijk']) === null);
}

sectie('4. Algemeen: andere landen en regio\'s, geen hardcode');
{
  check('Kenia: Oost-Afrika en ontwikkelingslanden dekken, West-Afrika niet', geo('Nairobi, Kenia', [], ['Oost-Afrika']).status === 'eligible' && geo('Nairobi, Kenia', ['Afrika'], ['Alleen West-Afrika']).status === 'ineligible' && geo('Nairobi, Kenia', [], ['ontwikkelingslanden']).status === 'eligible');
  check('Bangladesh: Zuid-Azië, minst ontwikkelde landen en Azië dekken', geo('Dhaka, Bangladesh', [], ['Zuid-Azië']).status === 'eligible' && geo('Dhaka, Bangladesh', [], ['minst ontwikkelde landen']).status === 'eligible' && geo('Dhaka, Bangladesh', ['Azië']).status === 'eligible');
  check('Colombia: Latijns-Amerika en Zuid-Amerika dekken, Midden-Amerika niet', geo('Bogotá, Colombia', [], ['Latijns-Amerika']).status === 'eligible' && geo('Bogotá, Colombia', ['Zuid-Amerika']).status === 'eligible' && geo('Bogotá, Colombia', [], ['Alleen Midden-Amerika']).status === 'ineligible');
  check('Engelse schrijfwijzen: Ethiopia, Sub-Saharan, developing countries', geo('Addis Ababa, Ethiopia', [], ['Projects in sub-Saharan Africa']).status === 'eligible' && geo('Addis Ababa, Ethiopia', [], ['developing countries only']).status === 'eligible');
  check('Ivoorkust en Côte d\'Ivoire zijn hetzelfde land', projectGebied(['Abidjan, Côte d\'Ivoire']).landen[0]?.naam === 'Ivoorkust');
  check('Guinee-Bissau wordt niet als Guinee gelezen', projectGebied(['Bissau, Guinee-Bissau']).landen.map((l) => l.naam).join() === 'Guinee-Bissau');
  check('Niger is niet Nigeria', projectGebied(['Niamey, Niger']).landen.map((l) => l.naam).join() === 'Niger' && projectGebied(['Lagos, Nigeria']).landen.map((l) => l.naam).join() === 'Nigeria');
  check('Zuid-Soedan is niet Soedan', projectGebied(['Juba, Zuid-Soedan']).landen.map((l) => l.naam).join() === 'Zuid-Soedan');
  check('Caribisch deel van het Koninkrijk (Curaçao) is geen ontwikkelingsland maar wel dekking via het eigen label', projectGebied(['Willemstad, Curaçao']).landen[0]?.ontwikkelingsland === false && geo('Willemstad, Curaçao', ['Caribisch deel van het Koninkrijk']).status === 'eligible');
  check('meerdere landen: geschikt als één land gedekt is', beoordeelFondsVoorProject(projectGebied(['Ghana en Togo']), ['Afrika'], ['Alleen Ghana']).status === 'eligible');
  check('alleen een werelddeel bekend (Afrika): label Europa niet geschikt, Afrika wel', beoordeelFondsVoorProject(projectGebied(['Afrika']), ['Europa'], []).status === 'ineligible' && beoordeelFondsVoorProject(projectGebied(['Afrika']), ['Afrika'], []).status === 'eligible');
  check('landentabel is volledig genoeg (> 190 landen) en bevat geen dubbele namen', LANDEN.length > 190 && new Set(LANDEN.map((l) => l.naam)).size === LANDEN.length, String(LANDEN.length));
}

sectie('5. Bijdrageschatting');
{
  check('gebruikelijk bedrag uit de toelichting ("rond de €100.000")', gebruikelijkBedrag(['Gemiddelde bijdrage ligt rond de €100.000'])?.bedrag === 100000);
  check('bereik in de toelichting -> het midden', gebruikelijkBedrag(['Doorgaans tussen € 25.000 en € 75.000 per project'])?.bedrag === 50000);
  check('"maximaal €50.000" is geen gebruikelijk bedrag', gebruikelijkBedrag(['Maximaal € 50.000 per aanvraag']) === null);
  check('andere valuta wordt niet omgerekend of verzonnen', gebruikelijkBedrag(['Eerste aanvragen doorgaans CHF 40.000-100.000']) === null);
  check('percentage van de projectkosten wordt gelezen', percentageVanKosten(['Bijdrage maximaal 40% van de totale projectkosten']) === 0.4);
  const a = schatBijdrage({ min: 20000, max: 60000, teksten: [], begroting: 200000 });
  check('bandbreedte: het midden, nooit het maximum', a.bedrag === 40000 && a.grond === 'bandbreedte');
  check('alleen een bovengrens: geen schatting', schatBijdrage({ min: null, max: 25000, teksten: [], begroting: 200000 }).bedrag === null);
  check('alleen een ondergrens: geen schatting', schatBijdrage({ min: 10000, max: null, teksten: [], begroting: 200000 }).bedrag === null);
  check('geen gegevens: geen bedrag verzonnen', schatBijdrage({ min: null, max: null, teksten: [], begroting: 200000 }).bedrag === null);
  check('tegenstrijdige grenzen: geen schatting', schatBijdrage({ min: 90000, max: 10000, teksten: [], begroting: 200000 }).bedrag === null);
  check('minimum boven wat voor dit project kan: geen schatting', schatBijdrage({ min: 300000, max: 500000, teksten: [], begroting: 200000 }).bedrag === null);
  const p = schatBijdrage({ min: 20000, max: 400000, teksten: ['Maximaal 25% van de projectkosten'], begroting: 100000 });
  check('percentage van de projectkosten begrenst de schatting (25% van 100.000)', p.bedrag !== null && p.bedrag <= 25000 && p.voorbehoud.some((v) => /25%/.test(v)), JSON.stringify(p));
  const g = schatBijdrage({ min: 20000, max: 80000, teksten: ['Gemiddeld € 200.000'], begroting: 150000 });
  check('gebruikelijk bedrag boven het eigen maximum van het fonds wordt tot dat maximum begrensd', g.bedrag === 80000);
}

// ------------------------------------------------------------------------------------------------------------------------------
const kand = (naam, o = {}) => ({
  sleutel: `regeling:${naam}`, naam, funderNaam: `Funder ${naam}`, bron: 'regeling', score: 80, themaNiveau: 'kern', disciplines: ['Kinderbescherming'],
  doelgroepPositief: true, doelgroepBekend: true, doelgroepen: ['Kinderen'], werkgebied: { status: 'eligible', sterkte: 'regio', reden: 'Ghana valt onder West-Afrika', notitie: null },
  engineGeoStatus: 'eligible', engineGeoPositief: false, engineGeoLabel: null, min: null, max: null, toelichtingen: [], eigenBijdrage: null, cofinanciering: null, begrotingseisen: null, zwaktes: [], ...o,
});
const mid = (min, max) => ({ min, max });

sectie('6. Gezamenlijke beoordeling (discipline + werkgebied + doelgroep)');
{
  check('alle drie aantoonbaar: geschikt', beoordeelGezamenlijk(kand('A')).geschikt);
  check('één veld alleen (discipline) is onvoldoende', !beoordeelGezamenlijk(kand('B', { doelgroepPositief: false, werkgebied: { status: 'unknown', sterkte: null, reden: null, notitie: 'x' } })).geschikt);
  check('één veld alleen (doelgroep) is onvoldoende', !beoordeelGezamenlijk(kand('C', { themaNiveau: 'geen', doelgroepPositief: true, werkgebied: { status: 'unknown', sterkte: null, reden: null, notitie: 'x' } })).geschikt);
  check('twee van drie met één onzeker: geschikt, onzekerheid benoemd', (() => { const b = beoordeelGezamenlijk(kand('D', { doelgroepPositief: false, doelgroepBekend: false })); return b.geschikt && b.onzekerheden.some((o) => /doelgroep/.test(o)); })());
  check('geografisch uitgesloten: nooit geschikt, hoe sterk de rest ook is', !beoordeelGezamenlijk(kand('E', { werkgebied: { status: 'ineligible', sterkte: null, reden: 'Ghana is uitgesloten', notitie: null } })).geschikt);
  check('aanvragertype komt in de beoordeling niet voor', !('aanvragertype' in kand('F')) && !JSON.stringify(beoordeelGezamenlijk(kand('F'))).includes('aanvrager'));
  check('sterker werkgebied rangschikt hoger', beoordeelGezamenlijk(kand('G', { werkgebied: { status: 'eligible', sterkte: 'land', reden: '', notitie: null } })).sterkte > beoordeelGezamenlijk(kand('H', { werkgebied: { status: 'eligible', sterkte: 'wereld', reden: '', notitie: null } })).sterkte);
}

sectie('7. Korte lijst: begroting € 200.000, maximum € 240.000 (Sterke families, veilige kinderen)');
{
  const k = [
    kand('Sterkste', { score: 95, ...mid(40000, 100000), werkgebied: { status: 'eligible', sterkte: 'land', reden: 'Ghana wordt genoemd', notitie: null } }), // 70.000
    kand('Tweede', { score: 90, ...mid(30000, 90000) }), // 60.000
    kand('Derde', { score: 85, ...mid(20000, 60000), werkgebied: { status: 'eligible', sterkte: 'klasse', reden: '', notitie: null } }), // 40.000
    kand('Vierde', { score: 80, ...mid(50000, 150000), werkgebied: { status: 'eligible', sterkte: 'wereld', reden: '', notitie: null } }), // 100.000
    kand('Vijfde', { score: 78, ...mid(10000, 30000) }), // 20.000
  ];
  const r = selecteerProLijst({ kandidaten: k, begroting: 200000 });
  const namen = r.regels.map((x) => x.naam);

  check('maximum is 120% van de begroting (€ 240.000), dynamisch berekend', r.maximum === 240000 && PRO_MAX_FACTOR === 1.2);
  check('de som van de schattingen is nooit hoger dan het maximum', r.totaal <= 240000, String(r.totaal));
  check('de lijst volgt de sterkte: sterkste eerst', namen[0] === 'Sterkste', namen.join());
  check('het totaal is de som van de getoonde onderbouwde schattingen', r.totaal === r.regels.filter((x) => x.telt).reduce((t, x) => t + x.schatting, 0));
  check('dekkingspercentage en tekort kloppen met het totaal', r.dekkingPercentage === Math.round((r.totaal / 200000) * 100) && r.tekort === Math.max(0, 200000 - r.totaal));
  check('een fonds dat het maximum zou overschrijden wordt niet toegevoegd en staat als overgeslagen', r.overgeslagen.every((o) => !namen.includes(o.naam)) && (r.totaal >= 200000 || r.overgeslagen.length > 0 || r.regels.length === 5), JSON.stringify(r.overgeslagen));
  check('de schatting is niet verlaagd om te passen (elke schatting = het midden van de eigen bandbreedte)', r.regels.every((x) => ({ Sterkste: 70000, Tweede: 60000, Derde: 40000, Vierde: 100000, Vijfde: 20000 })[x.naam] === x.schatting));
  check('geen vast aantal: de lijst stopt zodra de begroting gedekt is', r.uitkomst === 'voldoende' ? r.totaal >= 200000 && r.regels.length < 5 : true, `${r.uitkomst} ${namen.join()}`);

  const klein = selecteerProLijst({ kandidaten: k, begroting: 100000 });
  check('bij een begroting van € 100.000 (maximum € 120.000) is de lijst korter en blijft ≤ € 120.000', klein.maximum === 120000 && klein.totaal <= 120000 && klein.regels.length < r.regels.length + 1, `${klein.totaal} ${klein.regels.map((x) => x.naam)}`);

  const groot = selecteerProLijst({ kandidaten: k, begroting: 1000000 });
  check('bij een begroting van € 1.000.000 komen alle geschikte fondsen in de lijst en blijft het tekort zichtbaar', groot.regels.length === 5 && groot.uitkomst === 'tekort' && groot.tekort === 1000000 - 290000, `${groot.uitkomst} ${groot.tekort}`);
  check('het maximum volgt de begroting: nergens een vast bedrag', groot.maximum === 1200000 && klein.maximum === 120000);
}

sectie('8. Onbekende bijdragen en te weinig geschikte fondsen');
{
  const k = [
    kand('MetBedrag', { score: 90, ...mid(30000, 50000) }), // 40.000
    kand('ZonderBedrag', { score: 96, werkgebied: { status: 'eligible', sterkte: 'land', reden: '', notitie: null } }),
    kand('AlleenMax', { score: 94, max: 25000, werkgebied: { status: 'eligible', sterkte: 'land', reden: '', notitie: null } }),
    kand('ZwakZonderBedrag', { score: 66, themaNiveau: 'secundair', doelgroepPositief: false, doelgroepBekend: false }),
  ];
  const r = selecteerProLijst({ kandidaten: k, begroting: 200000 });
  const n = Object.fromEntries(r.regels.map((x) => [x.naam, x]));

  check('fondsen zonder onderbouwde schatting tellen niet mee voor de berekende dekking', r.totaal === 40000 && n.ZonderBedrag?.telt === false && n.AlleenMax?.telt === false);
  check('bij een tekort worden sterke fondsen zonder bedrag genoemd om te onderzoeken, zwakke niet', Boolean(n.ZonderBedrag && n.AlleenMax) && !n.ZwakZonderBedrag);
  check('uitkomst "tekort" met het resterende tekort', r.uitkomst === 'tekort' && r.tekort === 160000 && r.dekkingPercentage === 20);
  check('onbekend bedrag staat er als onbekend, niet als nul', n.ZonderBedrag.schatting === null && /geen bedrag/i.test(n.ZonderBedrag.onderbouwing));
  check('geen geschikte fondsen: lege lijst, geen opvulling', selecteerProLijst({ kandidaten: [kand('X', { werkgebied: { status: 'ineligible', sterkte: null, reden: 'x', notitie: null } })], begroting: 200000 }).uitkomst === 'geen-geschikt');
  const blok = proPresentatieBlok(r, { begroting: 200000, disciplines: ['Kinderbescherming'], werkgebieden: ['Kumasi, Ghana'], doelgroepen: ['150 gezinnen'] });
  check('presentatieblok: opening, per fonds de punten, totaal, dekking, tekort en "geen toezeggingen"', /projectbegroting van € 200\.000/.test(blok) && /Waarom het past/.test(blok) && /totaal geschatte bijdragen € 40\.000/.test(blok) && /dekking 20%/.test(blok) && /resterend tekort € 160\.000/.test(blok) && /geen toezeggingen/.test(blok));
  check('zonder begroting: geen dekking berekend en geen bedragen opgeteld', (() => { const z = selecteerProLijst({ kandidaten: k, begroting: null }); return z.uitkomst === 'zonder-begroting' && z.dekkingPercentage === null && z.maximum === null; })());
  check('"meer tonen" (uitgebreid) geeft alle geschikte fondsen', selecteerProLijst({ kandidaten: k, begroting: 20000, uitgebreid: true }).regels.length === 4);
}

console.log(`\nrekenen: ${stand.ok} OK, ${stand.fout} FOUT`);
process.exit(stand.fout ? 1 : 0);
