// Projectplan schrijven: de zuivere regels (feiten, onderdelen, controle van het modelantwoord).
//   node tests/aanvraag-assistent/run.mjs   (vanuit de repo-root)
import { bouwFeiten, planGereedheid, sectiesUitCriteria, STANDAARD_SECTIES, verwijderOngedekteZinnen, valideerSectie, schrijfPlan, fondsSleutel, feitenVoorSectie, sectieZonderFeiten, aantalAanvullen, MIN_FEITEN, MAX_FEITEN_TEKENS } from '../../supabase/functions/_shared/projectplan.ts';
import { begrotingEnDekkingFeiten, bedragTekst } from '../../supabase/functions/_shared/begrotingFeiten.ts';
import { check, gelijk, sectie, klaar, stand } from '../verificatie/hulp.mjs';

stand.naam = 'projectplan';

const BRON = {
  project: { naam: 'Samen Spelen', doelgroep: 'Kinderen van 6 tot 12 jaar', doelstellingen: 'Kinderen bewegen meer.', begroting: 40000, gevraagd: 25000, eigenBijdrage: 0 },
  info: { aanleiding: 'Weinig veilige speelplekken in de wijk.', borging: '   ' },
  organisatie: { name: 'Naamloze organisatie', opgericht: 2015 },
};

sectie('1. Feiten: alleen wat het lid zelf heeft ingevuld');
{
  const feiten = bouwFeiten(BRON);
  check('lege velden, "0" en de plaatshouder "Naamloze organisatie" worden geen feit', !feiten.some((f) => f.tekst === '0' || f.tekst === 'Naamloze organisatie' || f.tekst === ''));
  check('getallen worden tekst; id\'s lopen door vanaf f1', feiten.find((f) => f.sleutel === 'project.begroting').tekst === '40000' && feiten[0].id === 'f1' && feiten.at(-1).id === `f${feiten.length}`);
  check('elke bron krijgt zijn eigen label', feiten.find((f) => f.sleutel === 'info.aanleiding').bron === 'projectdocumentatie' && feiten.find((f) => f.sleutel === 'organisatie.opgericht').bron === 'organisatieprofiel' && feiten[0].bron === 'projectgegevens');
  gelijk('niets ingevuld: geen feiten, ook niet bij rare invoer', bouwFeiten({ project: null, info: undefined, organisatie: 5 }).length, 0);
  check('de ondergrens voor een plan is drie feiten', MIN_FEITEN === 3);
  const lang = bouwFeiten({ project: { omschrijving: 'a'.repeat(5000) }, info: {}, organisatie: {} });
  check('een feit wordt afgekapt op 2000 tekens', lang[0].tekst.length === 2000);
  const def = { id: 't', titel: 't', vraag: 'v', feitSleutels: 'alle', vraagBijOntbreken: 'q' };
  const veel = Array.from({ length: 20 }, (_, i) => ({ id: `f${i}`, sleutel: `k${i}`, bron: 'projectgegevens', label: 'x', tekst: 'a'.repeat(1900) }));
  check('naar het model gaat nooit meer dan het totaalmaximum', feitenVoorSectie(def, veel).reduce((n, f) => n + f.tekst.length, 0) <= MAX_FEITEN_TEKENS);
}

sectie('2. Onderdelen: standaard of uit de vragen van het fonds');
{
  gelijk('standaard: 8 onderdelen', STANDAARD_SECTIES.length, 8);
  const zonder = sectiesUitCriteria([{ tekst: 'Wij letten op impact', soort: 'criterium', bronType: 'website' }]);
  check('alleen website-criteria: standaardonderdelen, de criteria worden aandachtspunten', zonder.uitFormulier === false && zonder.secties.length === 8 && zonder.aandachtspunten[0] === 'Wij letten op impact');
  const crit = [
    { tekst: 'Beschrijf het doel van uw project', soort: 'verplicht', bronType: 'lid', maxTekens: 500 },
    { tekst: 'Maximaal vijf pagina\'s', soort: 'vorm', bronType: 'lid' },
    { tekst: 'Hoe bereikt u de doelgroep?', soort: 'criterium', bronType: 'lid' },
    { tekst: 'Begroting bijvoegen', soort: 'voorwaarde', bronType: 'lid' },
  ];
  const uit = sectiesUitCriteria(crit);
  check('formuliervragen worden onderdelen in de volgorde van het formulier; vorm en voorwaarde niet', uit.uitFormulier && uit.secties.map((x) => x.titel).join('|') === 'Beschrijf het doel van uw project|Hoe bereikt u de doelgroep?');
  check('het maximum aantal tekens van de vraag blijft behouden', uit.secties[0].maxTekens === 500 && uit.secties[1].maxTekens === undefined);
  const lang = sectiesUitCriteria([{ tekst: 'Beschrijf '.repeat(40), soort: 'verplicht', bronType: 'lid' }]);
  check('een lange vraag krijgt een korte titel, de volledige vraag blijft staan', lang.secties[0].titel.length <= 91 && lang.secties[0].vraag.length > lang.secties[0].titel.length);
  check('rare invoer breekt niets', sectiesUitCriteria(null).secties.length === 8 && sectiesUitCriteria([null, 5, {}]).secties.length === 8);
  const veel = sectiesUitCriteria(Array.from({ length: 80 }, (_, i) => ({ tekst: `Vraag ${i}`, soort: 'verplicht', bronType: 'lid' })));
  gelijk('maximaal 30 onderdelen', veel.secties.length, 30);
}

sectie('3. Zinnen met een getal dat niet in de feiten staat verdwijnen');
{
  const a = verwijderOngedekteZinnen('Het project start in 2027. Wij bereiken 4500 kinderen. Daarna volgt een evaluatie.', 'Start 2027');
  check('de zin met een onbekend getal valt weg, de rest blijft', a.verwijderd === 1 && a.tekst === 'Het project start in 2027. Daarna volgt een evaluatie.', a.tekst);
  const b = verwijderOngedekteZinnen('Er is 25.000 euro nodig.', 'Gevraagd: 25000');
  gelijk('25.000 en 25000 zijn hetzelfde getal', b.verwijderd, 0);
  const c = verwijderOngedekteZinnen('Eerste alinea zonder getal.\n\nTweede alinea met 99 deelnemers.', 'niets');
  check('alinea-indeling blijft, een lege alinea valt weg', c.tekst === 'Eerste alinea zonder getal.' && c.verwijderd === 1);
  const d = verwijderOngedekteZinnen('We vragen dit. [aanvullen: het aantal deelnemers, bijvoorbeeld 50]', '');
  gelijk('een getal binnen een [aanvullen]-markering telt niet', d.verwijderd, 0);
}

sectie('4. Het modelantwoord wordt gecontroleerd');
{
  const feiten = bouwFeiten({ project: { naam: 'Samen Spelen', doelgroep: 'Kinderen van 6 tot 12 jaar', doelstellingen: 'Kinderen bewegen meer en leren samenwerken in de wijk.' }, info: {}, organisatie: {} });
  const def = { id: 'a', titel: 'Aanpak', vraag: 'Wat wil het project?', feitSleutels: 'alle', vraagBijOntbreken: 'Wat zijn de doelen?' };
  const goed = valideerSectie({ tekst: 'Het project helpt kinderen van 6 tot 12 jaar om meer te bewegen en beter samen te werken in de wijk.', gebruikt: ['f1', 'F2', 'f2', 'f99'], vragen: ['Moet niet blijven'] }, def, feiten);
  check('geschreven: gebruikte feiten zonder dubbelen, onbekend id genegeerd, geen vragen zonder markering', goed.status === 'geschreven' && goed.gebruikteFeiten.length === 2 && goed.vragen.length === 0 && goed.herkomst.join() === 'Projectgegevens');

  const geenFeiten = valideerSectie({ tekst: 'Een mooi verhaal dat nergens op rust.', gebruikt: [] }, def, feiten);
  check('tekst zonder een gebruikt feit wordt vervangen door [aanvullen] met een vraag', geenFeiten.status === 'aanvullen' && geenFeiten.tekst.startsWith('[aanvullen:') && geenFeiten.vragen.length === 1);

  const markering = valideerSectie({ tekst: 'Het project helpt kinderen om meer te bewegen. [aanvullen: hoeveel kinderen]', gebruikt: ['f1'], vragen: ['Hoeveel kinderen doen mee?'] }, def, feiten);
  check('een markering krijgt de vraag van het model', markering.aantalAanvullen === 1 && markering.vragen[0] === 'Hoeveel kinderen doen mee?');
  const markeringZonderVraag = valideerSectie({ tekst: 'Het project helpt kinderen om meer te bewegen. [aanvullen: hoeveel kinderen]', gebruikt: ['f1'] }, def, feiten);
  check('een markering zonder vraag van het model krijgt de standaardvraag', markeringZonderVraag.vragen[0] === 'Wat zijn de doelen?');

  const vies = valideerSectie({ tekst: '# Kop\n- punt een\n- punt twee\nZie https://nep.example of mail naar nep@nep.example voor **meer** informatie over kinderen.', gebruikt: ['f1'] }, def, feiten);
  check('geen links, e-mailadressen, opmaak of opsommingstekens in de uitvoer', !/https?:|@|\*|#|^-/m.test(vies.tekst), vies.tekst);

  const getal = valideerSectie({ tekst: 'Kinderen bewegen meer. Wij bereiken 4500 kinderen.', gebruikt: ['f1'] }, def, feiten);
  check('verzonnen getal: zin verwijderd en geteld', !getal.tekst.includes('4500') && getal.verwijderdeZinnen === 1);

  const alleenGetal = valideerSectie({ tekst: 'Wij bereiken 4500 kinderen.', gebruikt: ['f1'] }, def, feiten);
  check('blijft er niets over, dan staat er een [aanvullen] in plaats van niets', alleenGetal.tekst.startsWith('[aanvullen:') && alleenGetal.status === 'aanvullen');

  const beperkt = valideerSectie({ tekst: 'Het project helpt kinderen van 6 tot 12 jaar om meer te bewegen en beter samen te werken.', gebruikt: ['f1', 'f2'] }, { ...def, maxTekens: 30 }, feiten);
  check('over de limiet van het fonds: gemarkeerd, niet afgekapt', beperkt.overLimiet === true && beperkt.tekst.endsWith('werken.'));

  for (const rommel of [null, undefined, 5, 'tekst', [], { tekst: 5, gebruikt: 'x', vragen: 7 }]) {
    const r = valideerSectie(rommel, def, feiten);
    if (r.status !== 'aanvullen' || !r.tekst.startsWith('[aanvullen:')) check('rommel van het model geeft een veilige [aanvullen]', false, JSON.stringify(rommel));
  }
  check('rommel van het model geeft een veilige [aanvullen]', true);
  gelijk('aantalAanvullen telt markeringen', aantalAanvullen('a [aanvullen: x] b [Aanvullen: y]'), 2);
  check('onderdeel zonder feiten: markering met de vraag van het onderdeel', sectieZonderFeiten(def).tekst === '[aanvullen: Wat wil het project?]' && sectieZonderFeiten(def).vragen[0] === 'Wat zijn de doelen?');
}

sectie('5. schrijfPlan: parallel in groepen, storing per onderdeel');
{
  const feiten = bouwFeiten({ project: { naam: 'Samen Spelen', omschrijving: 'Sport en spel voor kinderen in de wijk.', doelgroep: 'Kinderen van 6 tot 12 jaar', doelstellingen: 'Kinderen bewegen meer en leren samenwerken in de wijk.' }, info: {}, organisatie: {} });
  const defs = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, titel: id, vraag: `Vraag ${id}`, feitSleutels: 'alle', vraagBijOntbreken: `Antwoord ${id}?` }));
  let lopend = 0, maxLopend = 0;
  const roep = async (systeem, gebruiker) => {
    lopend += 1; maxLopend = Math.max(maxLopend, lopend);
    await new Promise((r) => setTimeout(r, 5));
    lopend -= 1;
    const inv = JSON.parse(gebruiker);
    if (inv.onderdeel.titel === 'c') return null;
    if (inv.onderdeel.titel === 'd') return { inhoud: 'geen json' };
    if (inv.onderdeel.titel === 'e') throw new Error('stuk');
    return { inhoud: JSON.stringify({ tekst: 'Het project biedt sport en spel voor kinderen van 6 tot 12 jaar in de wijk.', gebruikt: inv.feiten.map((f) => f.id) }), usage: { prompt_tokens: 100, completion_tokens: 20 } };
  };
  const uit = await schrijfPlan({ secties: defs, feiten, roep });
  check('maximaal 4 onderdelen tegelijk', maxLopend <= 4 && maxLopend >= 2, `max ${maxLopend}`);
  check('mislukte onderdelen (leeg antwoord, geen json, uitzondering) blijven mislukt, de rest slaagt', uit.stat.geschreven === 3 && uit.stat.mislukt === 3 && uit.secties.map((x) => x.status).join() === 'geschreven,geschreven,mislukt,mislukt,mislukt,geschreven');
  check('volgorde van de onderdelen blijft die van het formulier', uit.secties.map((x) => x.id).join('') === 'abcdef');
  check('tokens van alle gelukte onderdelen worden opgeteld', uit.usage.prompt_tokens === 300 && uit.usage.completion_tokens === 60);

  const leeg = await schrijfPlan({ secties: defs, feiten: [], roep: async () => { throw new Error('mag niet'); } });
  check('zonder feiten: geen modelaanroep, alles [aanvullen]', leeg.modelAangeroepen === false && leeg.stat.zonderFeiten === 6 && leeg.secties.every((x) => x.status === 'aanvullen'));
}

sectie('6. Fondssleutel');
{
  gelijk('hoofdletters en spaties maken niets uit', fondsSleutel('  Fonds   Testlaan '), fondsSleutel('fonds testlaan'));
  gelijk('leestekens en accenten', fondsSleutel('Stichting Dé-Fonds!'), fondsSleutel('stichting de fonds'));
  check('verschillende fondsen blijven verschillend', fondsSleutel('Fonds A') !== fondsSleutel('Fonds B'));
  gelijk('niets geeft een lege sleutel', fondsSleutel(null), '');
  check('maximaal 120 tekens', fondsSleutel('a'.repeat(500)).length === 120);
}

sectie('Voortgangsmeter (planGereedheid)');
{
  const leeg = planGereedheid(bouwFeiten({ project: {}, info: {}, organisatie: {} }));
  gelijk('niets ingevuld: 0%, niet klaar, 11 kernvelden', [leeg.percentage, leeg.klaar, leeg.totaal, leeg.gevuld], [0, false, 11, 0]);

  const deels = planGereedheid(bouwFeiten(BRON));
  check('gedeeltelijk: tussen 0 en 100, borging (alleen spaties) en organisatie (plaatshouder) tellen niet mee', deels.percentage > 0 && deels.percentage < 100 && !deels.klaar && deels.onderdelen.find((o) => o.id === 'borging').gevuld === false && deels.onderdelen.find((o) => o.id === 'organisatie').gevuld === false);
  check('elk ontbrekend onderdeel heeft een vraag en een plek waar het ingevuld wordt', deels.onderdelen.every((o) => o.vraag.length > 5 && ['Projectgegevens', 'Projectdocumentatie', 'Organisatieprofiel'].includes(o.waar)));

  const vol = planGereedheid(bouwFeiten({
    project: { doelgroep: 'Kinderen', regio: 'Rotterdam', doelstellingen: 'Bewegen', activiteiten: 'Sport', impact: 'Gezonder', planning: '2027', begroting: 40000, gevraagd: 25000 },
    info: { aanleiding: 'Weinig plekken', borging: 'Gemeente neemt over' },
    organisatie: { name: 'Stichting X', mission: 'Spelen voor iedereen' },
  }));
  gelijk('alles ingevuld: 100% en klaar', [vol.percentage, vol.klaar, vol.gevuld], [100, true, 11]);

  const bijna = planGereedheid(bouwFeiten({ project: { doelgroep: 'K', regio: 'R', doelstellingen: 'B', activiteiten: 'S', impact: 'G', planning: '2027', begroting: 40000, gevraagd: 25000 }, info: { aanleiding: 'x', borging: 'y' }, organisatie: { name: 'S' } }));
  check('één veld mist (missie): 90% en niet klaar (nooit afgerond naar 100)', bijna.percentage === 90 && bijna.klaar === false);
  check('een alternatief veld telt mee (output i.p.v. impact)', planGereedheid(bouwFeiten({ project: {}, info: { output: '50 kinderen' }, organisatie: {} })).onderdelen.find((o) => o.id === 'resultaat').gevuld === true);
}

sectie('Begroting en dekkingsplan als feiten (de actuele stand bij elke tekst)');
{
  const BEGROTING = { versie: 1, regels: [
    { categorie: 'uitvoering', omschrijving: 'Projectleider', aantal: 120, eenheid: 'uur', tarief: 45, bedrag: 999, soort: 'geld', schatting: false },
    { categorie: 'uitvoering', omschrijving: 'Training vrijwilligers', aantal: null, tarief: null, bedrag: 2500, soort: 'geld', schatting: true },
    { categorie: 'activa', omschrijving: 'Voedselpakketten', aantal: 10, eenheid: 'pakket', tarief: 250, bedrag: null, soort: 'geld', schatting: false },
    { categorie: 'eigen:Locatie en huisvesting', omschrijving: 'Huur ruimte', aantal: null, tarief: null, bedrag: 3000, soort: 'geld', schatting: false },
    { categorie: '', omschrijving: 'Verzekering', aantal: null, tarief: null, bedrag: null, soort: 'geld', schatting: false },
  ] };
  const rij = (naam, status, requested, awarded = null, extra = {}) => ({ id: naam, program_id: 'p', bron_type: 'financier', bron_status: 'zichtbaar', bron_naam: naam, requested_amount: requested, awarded_amount: awarded, status, ...extra });
  const FIN = [
    rij('Fonds A', 'awarded', 10000, 8000),
    rij('Fonds B', 'submitted', 5000),
    rij('Fonds C', 'interesting', 3000),
    rij('Fonds D', 'rejected', 9999),
    rij('Geheim', 'preparing', 2000, null, { bron_status: 'verborgen', bron_naam: null }),
  ];
  const bron = { project: { naam: 'X', begroting: 40000, eigenBijdrage: 7500 }, info: {}, organisatie: {}, begroting: BEGROTING, financiering: FIN };
  const feiten = bouwFeiten(bron);
  const tekst = (s) => feiten.find((f) => f.sleutel === s)?.tekst ?? '';

  check('begrotingsregels worden feiten per kopje, met eigen kopjes en "Overige kosten"', feiten.some((f) => f.label === 'Begroting: Projectuitvoering') && feiten.some((f) => f.label === 'Begroting: Locatie en huisvesting') && feiten.some((f) => f.label === 'Begroting: Overige kosten'));
  check('aantal x tarief gaat voor een los bedrag: 120 uur x 45 = 5.400', /120 uur × € 45 = € 5\.400/.test(tekst('begroting.kopje.1')) && !/999/.test(tekst('begroting.kopje.1')));
  check('een schatting blijft een schatting', /Training vrijwilligers: € 2\.500 \(schatting\)/.test(tekst('begroting.kopje.1')));
  check('een regel zonder bedrag zegt dat het bedrag nog niet is ingevuld', /Verzekering: bedrag nog niet ingevuld/.test(tekst('begroting.kopje.4')));
  check('subtotaal per kopje: 5.400 + 2.500 = 7.900', /Subtotaal Projectuitvoering: € 7\.900/.test(tekst('begroting.kopje.1')));
  check('er is geen apart feit meer voor bijdragen in natura', !feiten.some((f) => /natura/i.test(f.sleutel + f.label + f.tekst)));
  check('totaal van de regels 13.400, waarvan 2.500 schatting', /€ 13\.400, waarvan € 2\.500 nog een schatting/.test(tekst('begroting.totaal')));
  check('toegekend: eigen bijdrage en toegekend bedrag (8.000, niet 10.000)', /Eigen bijdrage € 7\.500; Fonds A € 8\.000/.test(tekst('dekking.toegekend')));
  check('aangevraagd en in planning staan apart; afgewezen staat er niet in', /Fonds B € 5\.000/.test(tekst('dekking.aangevraagd')) && /Fonds C € 3\.000/.test(tekst('dekking.planning')) && !feiten.some((f) => /Fonds D|9\.999/.test(f.tekst)));
  check('een financier die het abonnement niet laat zien, krijgt geen naam', /niet zichtbaar is in uw abonnement/.test(tekst('dekking.planning')) && !feiten.some((f) => /Geheim/.test(f.tekst)));
  check('stand: begroting 40.000, gedekt 20.500, nog 19.500; met planning nog 14.500', /Totale begroting € 40\.000/.test(tekst('dekking.stand')) && /gedekt met toegekend, aangevraagd en eigen bijdrage: € 20\.500/i.test(tekst('dekking.stand')) && /Nog te dekken: € 19\.500/.test(tekst('dekking.stand')) && /blijft € 14\.500 over/.test(tekst('dekking.stand')));
  check('ids lopen door en de bron van de feiten is Begroting of Dekkingsplan', feiten.every((f, i) => f.id === `f${i + 1}`) && feiten.filter((f) => f.sleutel.startsWith('begroting.')).every((f) => f.bron === 'begroting') && feiten.filter((f) => f.sleutel.startsWith('dekking.')).every((f) => f.bron === 'dekkingsplan'));

  const leeg = bouwFeiten({ project: { naam: 'X' }, info: {}, organisatie: {}, begroting: null, financiering: null });
  check('zonder begroting en zonder dekkingsplan komen er geen extra feiten bij', leeg.length === 1);
  const kapot = bouwFeiten({ project: { naam: 'X' }, info: {}, organisatie: {}, begroting: 'rommel', financiering: [null, 5, { status: 'awarded' }] });
  check('rommel blokkeert niets', Array.isArray(kapot) && kapot.some((f) => f.sleutel === 'project.naam'));
  check('bedragTekst: 12500 -> 12.500 en 12,5 -> 12,50', bedragTekst(12500) === '12.500' && bedragTekst(12.5) === '12,50' && bedragTekst(0) === '0');

  const fin = STANDAARD_SECTIES.find((s) => s.id === 'financiering');
  check('het onderdeel Begroting en financiering krijgt de begroting en het dekkingsplan', feitenVoorSectie(fin, feiten).some((f) => f.sleutel === 'begroting.totaal') && feitenVoorSectie(fin, feiten).some((f) => f.sleutel === 'dekking.stand'));
  const aanpak = STANDAARD_SECTIES.find((s) => s.id === 'aanpak');
  check('andere onderdelen krijgen ze niet', !feitenVoorSectie(aanpak, feiten).some((f) => /^(begroting|dekking)\./.test(f.sleutel)));
  check('een tekst met een bedrag uit de feiten blijft staan, een verzonnen bedrag niet', (() => {
    const gebruikt = feitenVoorSectie(fin, feiten);
    const r = valideerSectie({ tekst: 'De totale begroting is € 40.000. Daarvan is € 20.500 gedekt. Verder vragen wij € 77.777 aan.', gebruikt: gebruikt.map((f) => f.id) }, fin, gebruikt);
    return /40\.000/.test(r.tekst) && /20\.500/.test(r.tekst) && !/77\.777/.test(r.tekst);
  })());
  check('de voortgangsmeter kent het totaal van de begrotingsregels als totale projectkosten', planGereedheid(bouwFeiten({ project: {}, info: {}, organisatie: {}, begroting: BEGROTING })).onderdelen.find((o) => o.id === 'begroting').gevuld === true);
}

klaar('projectplan');
