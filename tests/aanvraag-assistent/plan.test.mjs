// Projectplan schrijven: de zuivere regels (feiten, onderdelen, controle van het modelantwoord).
//   node tests/aanvraag-assistent/run.mjs   (vanuit de repo-root)
import { bouwFeiten, sectiesUitCriteria, STANDAARD_SECTIES, verwijderOngedekteZinnen, valideerSectie, schrijfPlan, fondsSleutel, feitenVoorSectie, sectieZonderFeiten, aantalAanvullen, MIN_FEITEN, MAX_FEITEN_TEKENS } from '../../supabase/functions/_shared/projectplan.ts';
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

klaar('projectplan');
