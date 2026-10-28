import { readFileSync, readdirSync } from 'node:fs';
import * as M from '../../src/features/kompas-app/aanvraag/aanvraagModel.js';
import { check, gelijk, sectie, klaar, stand } from '../verificatie/hulp.mjs';

stand.naam = 'aanvraag-schermen-model';

sectie('1. Labels en maandruimte');
{
  gelijk('statuslabels', [M.statusLabel('gedekt'), M.statusLabel('deels'), M.statusLabel('ontbreekt'), M.statusLabel('x')].join('|'), 'Gedekt|Deels|Ontbreekt|Niet beoordeeld');
  gelijk('uitkomst: vaste teksten, geen score', M.uitkomstLabel('eerst-aanvullen'), 'Eerst aanvullen');
  check('geen label bevat een percentage of cijfer', Object.values(M.UITKOMST_LABEL).every((t) => !/\d|%/.test(t)));
  gelijk('bron: formulier gaat voor website', [M.bronLabel({ bronType: 'lid' }), M.bronLabel({ bronType: 'website' }), M.bronLabel({ bronType: 'database' })].join('|'), 'Uw formulier|Website|Fondsgegevens');

  const r = M.ruimteRegels({ beoordelingen: { limiet: 6, gebruikt: 2, resterend: 4 }, plannen: { limiet: 1, gebruikt: 0, resterend: 1 } });
  gelijk('Pro: Beoordelingen 2 van 6, Projectplannen 0 van 1', r.map((x) => `${x.label} ${x.tekst}`).join('; '), 'Beoordelingen 2 van 6; Projectplannen 0 van 1');
  check('geen regel over criteria ophalen in de zijbalk', r.length === 2);
  const onbekend = M.ruimteRegels({ beoordelingen: { limiet: 6, gebruikt: null, resterend: null }, plannen: { limiet: 1, gebruikt: null } });
  check('onbekend gebruik blijft onbekend (niets verzonnen)', onbekend[0].tekst === 'onbekend van 6' && onbekend[0].aandeel === 0);
  gelijk('gebruik boven de limiet wordt niet hoger getoond dan de limiet', M.ruimteRegels({ beoordelingen: { limiet: 6, gebruikt: 9 } })[0].tekst, '6 van 6');
  check('rare invoer breekt niets', M.ruimteRegels(null).length === 2 && M.ruimteRegels('x')[0].tekst === '');
  check('ruimte: resterend 0 = geen ruimte; onbekend = niet geblokkeerd', M.heeftBeoordelingRuimte({ beoordelingen: { resterend: 0 } }) === false && M.heeftBeoordelingRuimte({ beoordelingen: { resterend: null } }) === true && M.heeftPlanRuimte({ plannen: { resterend: 1 } }) === true && M.heeftPlanRuimte(null) === false);
}

sectie('2. Adressen, tekst en e-mail');
{
  gelijk('adres zonder https wordt aangevuld', M.normaliseerUrl('www.fonds.nl/aanvragen'), 'https://www.fonds.nl/aanvragen');
  gelijk('http blijft http', M.normaliseerUrl('http://fonds.nl/'), 'http://fonds.nl/');
  check('ongeldige adressen: spaties, geen punt, ander protocol, te lang, leeg', [M.normaliseerUrl('geen adres'), M.normaliseerUrl('localhost'), M.normaliseerUrl('ftp://fonds.nl'), M.normaliseerUrl(`https://a.nl/${'x'.repeat(600)}`), M.normaliseerUrl(''), M.normaliseerUrl(null)].every((x) => x === null));
  check('javascript: en file: worden geweigerd', M.normaliseerUrl('javascript:alert(1)') === null && M.normaliseerUrl('file:///etc/passwd') === null);
  const s = M.schoneUrls(['fonds.nl/a', 'https://fonds.nl/a', 'kapot adres', '', 'ander.nl', 'derde.nl']);
  check('maximaal twee unieke geldige adressen, ongeldige worden geteld', s.urls.length === 2 && s.ongeldig === 1 && s.urls[0] === 'https://fonds.nl/a');

  gelijk('tekens tellen zoals de server (witruimte samengevoegd)', M.tekenTelling('  a \n\n  b\t c  '), 5);
  gelijk('te kort', M.aanvraagTekstStatus('Te kort.', 60000).reden, 'te-kort');
  gelijk('leeg', M.aanvraagTekstStatus('   ', 60000).reden, 'leeg');
  gelijk('te lang', M.aanvraagTekstStatus('a '.repeat(40000), 60000).reden, 'te-lang');
  check('goed', M.aanvraagTekstStatus('woord '.repeat(60), 60000).ok === true);

  const mail = M.mailNaarCollectief('Stichting Het Voorbeeld');
  check('mail: naar het collectief, alleen de fondsnaam, geen projectgegevens', mail.startsWith(`mailto:${M.CONTACT_EMAIL}?`) && decodeURIComponent(mail).includes('Stichting Het Voorbeeld') && M.CONTACT_EMAIL === 'info@fondsenwerverscollectief.nl');
  check('mail: het woord privéfonds komt nergens voor, wel privaatfonds of familiefonds', !/priv[eé]fonds/i.test(decodeURIComponent(mail)) && /privaatfonds of familiefonds/.test(decodeURIComponent(mail)));
  check('mail zonder fondsnaam werkt ook', M.mailNaarCollectief().includes('subject='));
}

sectie('3. Criteria aanpassen');
{
  const basis = [
    { id: 'e1', tekst: 'Een begroting', soort: 'verplicht', gewicht: 3, bronType: 'website', bronStuk: 'x', zekerheid: 'middel' },
    { id: 'e2', tekst: 'Impact aantonen', soort: 'criterium', gewicht: 2, bronType: 'lid', bronStuk: 'y', zekerheid: 'hoog' },
  ];
  const n = M.nieuweEis('  Eigen criterium  ', 'verplicht');
  check('nieuw criterium: van het lid, hoge zekerheid, bronstuk = eigen tekst', n.bronType === 'lid' && n.bronStuk === 'Eigen criterium' && n.zekerheid === 'hoog' && n.gewicht === 3);
  gelijk('leeg nieuw criterium bestaat niet', M.nieuweEis('   '), null);
  check('te lang wordt afgekapt', M.nieuweEis('a'.repeat(900)).tekst.length === 300);
  check('onbekende soort wordt "criterium"', M.nieuweEis('x', 'geheim').soort === 'criterium');
  const l2 = M.voegEisToe(basis, n);
  check('toevoegen aan het eind, zonder de rest te raken', l2.length === 3 && l2[2].tekst === 'Eigen criterium' && basis.length === 2);
  gelijk('hetzelfde criterium (andere hoofdletters) wordt niet dubbel toegevoegd', M.voegEisToe(l2, M.nieuweEis('EIGEN CRITERIUM')).length, 3);
  gelijk('niets toevoegen mag', M.voegEisToe(basis, null).length, 2);

  const w = M.wijzigEis(basis, 'e1', { tekst: ' Sluitende begroting ', soort: 'voorwaarde', gewicht: 1 });
  check('wijzigen: tekst, soort en gewicht; origineel ongemoeid', w[0].tekst === 'Sluitende begroting' && w[0].soort === 'voorwaarde' && w[0].gewicht === 1 && basis[0].tekst === 'Een begroting' && w[1] === basis[1]);
  const w2 = M.wijzigEis(basis, 'e1', { tekst: '   ', soort: 'rommel', gewicht: 9 });
  check('lege tekst, onbekende soort en rare gewichten worden niet doorgevoerd', w2[0].tekst === 'Een begroting' && w2[0].soort === 'verplicht' && w2[0].gewicht === 3);
  gelijk('weghalen', M.verwijderEis(basis, 'e1').map((e) => e.id).join(), 'e2');
  check('gewijzigd? ja bij tekst, nee bij gelijk', M.criteriaGewijzigd(basis, w) === true && M.criteriaGewijzigd(basis, [...basis]) === false && M.criteriaGewijzigd(null, []) === false);
}

sectie('4. Overzicht van aanvragen');
{
  const b = (a) => M.aanvraagBadges(a).map((x) => x.tekst).join(' | ');
  gelijk('compleet', b({ aantalCriteria: 9, heeftPlan: true, laatsteUitkomst: 'eerst-aanvullen' }), 'Criteria klaar | Versie in concept | Beoordeeld: eerst aanvullen');
  gelijk('alleen criteria', b({ aantalCriteria: 7, heeftPlan: false, laatsteUitkomst: null }), 'Criteria klaar | Nog niets geschreven');
  gelijk('niets', b({ aantalCriteria: 0 }), 'Nog geen criteria | Nog niets geschreven');
  check('beoordeeld klaar is groen, eerst aanvullen oranje', M.aanvraagBadges({ aantalCriteria: 1, laatsteUitkomst: 'klaar-om-in-te-dienen' }).at(-1).toon === 'groen' && M.aanvraagBadges({ aantalCriteria: 1, laatsteUitkomst: 'eerst-aanvullen' }).at(-1).toon === 'oranje');
  const s = M.splitsAanvragen([{ id: 'a', soort: 'fonds', bijgewerkt: '2026-10-01T00:00:00Z' }, { id: 'b', soort: 'algemeen' }, { id: 'c', soort: 'fonds', bijgewerkt: '2026-10-15T00:00:00Z' }]);
  check('algemeen plan apart, fondsen met de nieuwste eerst', s.algemeen.id === 'b' && s.fondsen.map((x) => x.id).join() === 'c,a');
  gelijk('geen algemeen plan', M.splitsAanvragen([]).algemeen, null);
  gelijk('datum in het Nederlands', M.datumTekst('2026-10-15T12:00:00Z'), '15 oktober');
  gelijk('ongeldige datum', M.datumTekst('nonsens'), '');
}

sectie('5. Plan: tekst, markeringen, samenvatting');
{
  const plan = { secties: [
    { titel: 'Aanleiding', vraag: 'Wat is de aanleiding?', tekst: 'Er zijn weinig speelplekken.', status: 'geschreven', aantalAanvullen: 0 },
    { titel: 'Doelgroep', vraag: 'Wie is de doelgroep?', tekst: 'Kinderen. [aanvullen: het aantal kinderen]', status: 'aanvullen', aantalAanvullen: 1 },
    { titel: 'Aanpak', vraag: 'Wat doet u?', tekst: '', status: 'mislukt', aantalAanvullen: 0 },
  ], statistiek: { geschreven: 1, aanvullen: 1, mislukt: 1 } };
  const t = M.planNaarTekst(plan, 'Samen Spelen');
  check('plantekst: kop, secties als kop 2, markeringen blijven zichtbaar', t.startsWith('# Samen Spelen\n\n## Aanleiding\n\nEr zijn weinig speelplekken.') && t.includes('[aanvullen: het aantal kinderen]'));
  check('een mislukt onderdeel wordt een [aanvullen], niet stilzwijgend weggelaten', t.includes('## Aanpak\n\n[aanvullen: Wat doet u?]'));
  gelijk('samenvatting', M.planSamenvatting(plan), '1 onderdeel geschreven, 1 om aan te vullen, 1 niet gelukt');
  gelijk('aantal in te vullen: markering plus mislukt', M.aantalAanvullenInPlan(plan), 2);
  const st = M.splitsAanvullen('Eerst tekst. [aanvullen: hoeveel?] Daarna meer. [aanvullen: wanneer]');
  check('markeringen worden afzonderlijk herkend', st.length === 4 && st[1].aanvullen && !st[0].aanvullen && st[3].tekst === '[aanvullen: wanneer]');
  gelijk('tekst zonder markering', M.splitsAanvullen('Gewoon.').length, 1);
  gelijk('lege tekst', M.splitsAanvullen('').length, 0);
  check('rare invoer breekt niets', M.planNaarTekst(null).startsWith('# Projectplan') && M.aantalAanvullenInPlan(undefined) === 0 && M.planSamenvatting(null) === '');
}

sectie('6. Beoordeling tonen');
{
  const eisen = [{ id: 'e1', tekst: 'A', bronStuk: 'a' }, { id: 'e2', tekst: 'B', bronStuk: 'b' }, { id: 'e3', tekst: 'C', bronStuk: 'c' }, { id: 'e4', tekst: 'D', bronStuk: 'd' }];
  const res = [
    { eisId: 'e1', status: 'gedekt', citaatAanvraag: 'staat erin', bronStuk: 'a', verbetering: '' },
    { eisId: 'e2', status: 'deels', citaatAanvraag: 'half', bronStuk: 'b', verbetering: 'Vul aan' },
    { eisId: 'e3', status: 'ontbreekt', citaatAanvraag: '', bronStuk: 'c', verbetering: 'Voeg toe' },
  ];
  const g = M.koppelOordelen(eisen, res);
  check('elk criterium krijgt een oordeel; zonder oordeel = niet beoordeeld (nooit stilzwijgend gedekt)', g.length === 4 && g[3].status === 'niet-beoordeeld' && g[0].status === 'gedekt');
  const t = M.telStatussen(g);
  check('tellingen kloppen', t.gedekt === 1 && t.deels === 1 && t.ontbreekt === 1 && t['niet-beoordeeld'] === 1);
  const eerst = M.eerstAanpakken([{ eisId: 'e3' }, { eisId: 'e4' }, { eisId: 'e2' }, { eisId: 'weg' }], g, 2);
  check('punten komen in de volgorde van de server, afgekapt, onbekende id\'s vallen weg', eerst.map((x) => x.eis.id).join() === 'e3,e4');
  check('rare invoer breekt niets', M.koppelOordelen(null, null).length === 0 && M.telStatussen(undefined).gedekt === 0 && M.eerstAanpakken(null, null).length === 0);
}

sectie('7. Statische controles op de schermen');
{
  const map = 'src/features/kompas-app/aanvraag';
  const bestanden = readdirSync(map).filter((f) => /\.(jsx?|mjs)$/.test(f));
  const alles = bestanden.map((f) => [f, readFileSync(`${map}/${f}`, 'utf8')]);
  const code = (s) => s.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

  check('geen browseropslag (localStorage, sessionStorage, indexedDB) in de schermen', alles.every(([, s]) => !/localStorage|sessionStorage|indexedDB/.test(code(s))));
  check('geen losse fetch: alles loopt via de service', alles.every(([, s]) => !/\bfetch\(/.test(code(s))));
  check('nergens "eisenlijst" of "privéfonds" in de teksten voor het lid', alles.every(([, s]) => !/eisenlijst|priv[eé]fonds/i.test(s.replace(/\/\/.*$/gm, ''))));
  check('geen woorden als score, kans of garantie in de schermen', alles.every(([, s]) => !/\b(score|slagingskans|garantie)\b/i.test(code(s))));
  check('geen dangerouslySetInnerHTML (alle tekst is tekst)', alles.every(([, s]) => !/dangerouslySetInnerHTML/.test(s)));
  check('de service gebruikt de functie aanvraag-assistent en niet subsidie-kompas', /AANVRAAG_FUNCTION = 'aanvraag-assistent'/.test(readFileSync('src/data/services/aanvraagAssistent.js', 'utf8')) && !/subsidie-kompas'/.test(readFileSync('src/data/services/aanvraagAssistent.js', 'utf8')));
}

sectie('8. Formulier: tekenlimieten en stukken');
{
  const v = (o) => ({ id: 'v1', tekst: 'Vraag', maxTekens: null, geenLimiet: false, ...o });
  check('een vraag is klaar met een limiet of met "geen limiet", anders niet', M.limietOk(v({ maxTekens: 1500 })) && M.limietOk(v({ geenLimiet: true })) && !M.limietOk(v({})) && !M.limietOk(v({ maxTekens: 0 })) && !M.limietOk(v({ maxTekens: 1.5 })) && !M.limietOk(null));
  gelijk('vragen zonder limiet worden geteld', M.vragenZonderLimiet([v({ maxTekens: 5 }), v({}), v({ geenLimiet: true }), v({})]), 2);
  check('een limiet lezen: cijfers, punten en spaties mogen; letters, nul en te groot niet', M.leesLimiet('1500') === 1500 && M.leesLimiet('1.500') === 1500 && M.leesLimiet(' 800 ') === 800 && M.leesLimiet('') === null && M.leesLimiet('abc') === null && M.leesLimiet('0') === null && M.leesLimiet('999999') === null && M.leesLimiet('12,5') === null);
  gelijk('een nieuwe vraag krijgt een vrije id, een nette tekst en begint zonder limiet', JSON.stringify(M.nieuweVraag([{ id: 'v1' }, { id: 'v3' }], '  Wat is uw plan?  ')), JSON.stringify({ id: 'v4', tekst: 'Wat is uw plan?', maxTekens: null, geenLimiet: false }));
  check('de id van een nieuwe vraag of een nieuw stuk botst nooit met een bestaande', M.nieuweVraag([{ id: 'v1' }, { id: 'v2' }, { id: 'v3' }], 'x y z').id === 'v4' && M.nieuwStuk([{ id: 's2' }], 'Brief').id === 's3' && M.nieuwStuk([], 'Brief').id === 's1');

  const lijst = { lijst: [v({ id: 'v1', tekst: 'Een', maxTekens: 100 }), v({ id: 'v2', tekst: 'Twee', geenLimiet: true }), v({ id: 'v3', tekst: 'Drie', maxTekens: 50 })] };
  gelijk('de vragen worden onderdelen van het plan, met limiet', JSON.stringify(M.planUitVragen(lijst).secties.map((s) => [s.id, s.titel, s.maxTekens ?? null])), JSON.stringify([['v1', 'Een', 100], ['v2', 'Twee', null], ['v3', 'Drie', 50]]));
  gelijk('limieten per vraag: "geen limiet" heeft er geen', JSON.stringify(M.limietenUitVragen(lijst)), JSON.stringify({ v1: 100, v3: 50 }));
  const o = M.onderdelenVoorVragen([{ id: 'v3', titel: 'oud', tekst: 'C' }, { id: 'v1', titel: 'oud', tekst: 'A' }, { id: 'weg', titel: 'x', tekst: 'Z' }], lijst);
  gelijk('opgeslagen antwoorden volgen de volgorde van de vragen; nieuwe vraag leeg, verwijderde vraag weg, titel = de vraag', JSON.stringify(o.map((x) => [x.id, x.titel, x.tekst])), JSON.stringify([['v1', 'Een', 'A'], ['v2', 'Twee', ''], ['v3', 'Drie', 'C']]));

  const nu = new Date('2026-10-26T12:00:00Z');
  const stuk = (o2) => ({ id: 's1', tekst: 'ANBI-status', bron: 'standaard', sleutel: 'anbi', maxLeeftijdMaanden: null, nietVanToepassing: false, klaar: false, documentNaam: '', ...o2 });
  const docs = M.documentenLijst([{ naam: 'anbi-beschikking.pdf', soort: 'Overig', gemaakt: '2026-03-01T00:00:00Z' }, { naam: 'oud-jaarverslag.pdf', soort: 'Overig', gemaakt: '2024-01-01T00:00:00Z', vervangen: true }], [{ naam: 'Jaarverslag 2025.pdf', soort: 'Jaarverslag', aangemaakt: '2026-09-01T00:00:00Z' }, { naam: 'jaarrekening 2023.pdf', soort: 'Overig', aangemaakt: '2024-02-01T00:00:00Z' }]);
  check('de documentenlijst voegt project en organisatie samen en laat vervangen bestanden weg', docs.length === 3 && docs.some((d) => d.bron === 'organisatie') && !docs.some((d) => /oud-jaarverslag/.test(d.naam)));
  gelijk('ANBI-status wordt herkend in de documentatie', M.stukStatus(stuk({}), docs, nu).status, 'klaar');
  gelijk('het jaarverslag wordt herkend op de soort (organisatieprofiel)', M.stukStatus(stuk({ sleutel: 'jaarverslag', maxLeeftijdMaanden: 12 }), docs, nu).status, 'klaar');
  const oud = M.stukStatus(stuk({ sleutel: 'jaarrekening', maxLeeftijdMaanden: 12 }), docs, nu);
  check('een bestand dat langer geleden is toegevoegd dan het fonds toestaat wordt "te oud" met een uitleg, niet stilzwijgend goedgekeurd', oud.status === 'te-oud' && /Controleer of het de nieuwste is/.test(oud.reden) && /jaarrekening 2023/.test(oud.reden));
  gelijk('zonder bestand en niet afgevinkt: nog nodig', M.stukStatus(stuk({ sleutel: 'statuten' }), docs, nu).status, 'nodig');
  gelijk('zelf afgevinkt: klaar', M.stukStatus(stuk({ sleutel: 'statuten', klaar: true }), docs, nu).status, 'klaar');
  gelijk('niet van toepassing: telt niet mee', M.stukStatus(stuk({ nietVanToepassing: true }), docs, nu).status, 'nvt');
  gelijk('een stuk zonder sleutel wordt niet geraden: nog nodig', M.stukStatus(stuk({ sleutel: null, tekst: 'Aanbevelingsbrief' }), docs, nu).status, 'nodig');
  gelijk('een zelf gekoppeld bestand telt als klaar', M.stukStatus(stuk({ sleutel: null, tekst: 'Aanbevelingsbrief', documentNaam: 'brief.pdf' }), docs, nu).status, 'klaar');
  const t = M.telStukken([stuk({}), stuk({ id: 's2', sleutel: 'statuten' }), stuk({ id: 's3', nietVanToepassing: true })], docs, nu);
  gelijk('tellen: niet van toepassing telt niet mee', `${t.klaar}/${t.totaal}/${t.openstaand}`, '1/2/1');
  const a = M.telAntwoorden([{ id: 'v1', tekst: 'Een goed antwoord.' }, { id: 'v2', tekst: '' }, { id: 'v3', tekst: 'Half. [aanvullen: het bedrag]' }, { id: 'v4', tekst: 'x'.repeat(60) }], { v4: 50 });
  gelijk('antwoorden tellen: beantwoord, met gat, leeg, boven de limiet', `${a.beantwoord}/${a.metGat}/${a.leeg}/${a.overLimiet}`, '2/1/1/1');
  check('de attentie over de tekenlimiet heeft de afgesproken woorden', /^Let op: veel fondsen hanteren een tekenlimiet per vraag\./.test(M.LIMIET_ATTENTIE) && /Zonder tekenlimiet kunnen wij u niet helpen\.$/.test(M.LIMIET_ATTENTIE));
  check('rare invoer breekt niets', M.telStukken(null, null).totaal === 0 && M.telAntwoorden(undefined, undefined).totaal === 0 && M.planUitVragen(null).secties.length === 0 && M.onderdelenVoorVragen(null, null).length === 0 && M.zoekDocument(null, null) === null);
}

sectie('9. De vier stappen van een aanvraag en de kaart per fonds');
{
  const nuDatum = new Date('2026-10-26T12:00:00Z');
  const leeg = M.werkbladStappen();

  gelijk('de vier stappen heten Vragenlijst, Antwoorden, Stukken en Controle', leeg.map((x) => x.naam), ['Vragenlijst', 'Antwoorden', 'Stukken', 'Controle']);
  gelijk('zonder bevestigde vragenlijst is alleen stap 1 open', leeg.map((x) => x.open), [true, false, false, false]);
  check('zonder bevestigde vragenlijst is niets klaar', leeg.every((x) => !x.klaar));

  const bezig = M.werkbladStappen({ bevestigd: true, aantalVragen: 3, beantwoord: 1, geschreven: 2, stukkenTotaal: 4, stukkenKlaar: 2 });

  gelijk('met een bevestigde lijst zijn alle stappen open', bezig.map((x) => x.open), [true, true, true, true]);
  gelijk('de tekst onder de stappen telt vragen, geschreven antwoorden en stukken', bezig.map((x) => x.sub), ['3 vragen', '2 van 3 geschreven', '2 van 4 klaar', 'Klaar om in te dienen?']);
  gelijk('stap 1 is klaar, 2 en 3 nog niet', bezig.map((x) => x.klaar), [true, false, false, false]);
  check('een vraag meervoud/enkelvoud: "1 vraag"', M.werkbladStappen({ bevestigd: true, aantalVragen: 1 })[0].sub === '1 vraag');
  check('geen stukken nodig telt als klaar', M.werkbladStappen({ bevestigd: true, aantalVragen: 1, stukkenTotaal: 0 })[2].klaar === true && M.werkbladStappen({ bevestigd: true, aantalVragen: 1 })[2].sub === 'Geen stukken nodig');

  const alles = M.werkbladStappen({ bevestigd: true, aantalVragen: 2, beantwoord: 2, stukkenTotaal: 1, stukkenKlaar: 1, definitief: true });

  check('alles klaar en definitief: ook de laatste stap is klaar', alles.every((x) => x.klaar) && alles[3].sub === 'Definitief gemaakt');
  check('de volgende stap is de eerste die nog niet klaar is', M.volgendeStap(bezig).id === 'antwoorden' && M.volgendeStap(alles).id === 'controle' && M.volgendeStap(leeg).id === 'vragenlijst' && M.volgendeStap(null) === null);
  check('definitief zonder complete antwoorden telt niet als klaar', M.werkbladStappen({ bevestigd: true, aantalVragen: 2, beantwoord: 1, definitief: true })[3].klaar === false);

  const docs = [{ naam: 'anbi-beschikking.pdf', soort: 'ANBI-status', datum: '2026-09-01', bron: 'organisatie' }];
  const voortgang = { status: 'concept', aantalVragen: 3, vragenBevestigd: true, aantalAntwoorden: 3, stukken: [{ id: 's1', tekst: 'ANBI-status', bron: 'standaard', sleutel: 'anbi', maxLeeftijdMaanden: null, nietVanToepassing: false, klaar: false, documentNaam: '' }, { id: 's2', tekst: 'Statuten', bron: 'standaard', sleutel: 'statuten', maxLeeftijdMaanden: null, nietVanToepassing: false, klaar: false, documentNaam: '' }] };
  const kaart = M.stappenUitVoortgang(voortgang, docs, nuDatum);

  gelijk('de kaart herkent stukken in de documentatie: 1 van 2 klaar', kaart.map((x) => x.sub), ['3 vragen', '3 van 3 geschreven', '1 van 2 klaar', 'Klaar om in te dienen?']);
  check('de knop op de kaart wijst naar de stukken', M.volgendeStap(kaart).id === 'stukken' && /stukken/.test(M.STAP_KNOP.stukken));
  check('zonder voortgang van de server geen stappen op de kaart', M.stappenUitVoortgang(null, docs) === null && M.stappenUitVoortgang(undefined, []) === null);
}

sectie('Alvast verzamelen: korte lijst voor de zijkant');
{
  const docsA = [{ naam: 'anbi-beschikking.pdf', soort: 'ANBI-status', datum: '2026-09-01', bron: 'organisatie' }];
  const standaard = M.alvastLijst([], docsA, new Date('2026-10-26'));

  gelijk('zonder lijst van het fonds: de vier standaardstukken, jaarverslag eerst', standaard.map((x) => x.tekst), ['Jaarverslag, niet ouder dan 1 jaar', 'ANBI-status', 'Statuten', 'Jaarrekening, niet ouder dan 1 jaar']);
  check('de ANBI-status is al herkend in de documentatie, de rest is nog nodig', standaard.find((x) => x.tekst === 'ANBI-status').status === 'klaar' && standaard.filter((x) => x.status === 'nodig').length === 3);
  gelijk('ook zonder stukken en zonder documenten (null) komt de standaardlijst terug', M.alvastLijst(null, null).length, 4);

  const eigen = [{ id: 's1', tekst: 'Aanbevelingsbrief', bron: 'formulier', nietVanToepassing: false, klaar: true }, { id: 's2', tekst: 'Statuten', bron: 'standaard', sleutel: 'statuten', nietVanToepassing: true }];
  const lijstFonds = M.alvastLijst(eigen, [], new Date('2026-10-26'));

  check('met een lijst van het fonds geldt die lijst, zonder wat niet van toepassing is', lijstFonds.length === 1 && lijstFonds[0].tekst === 'Aanbevelingsbrief' && lijstFonds[0].status === 'klaar');
}

sectie('Korte titels: alleen de naam van het fonds');
{
  gelijk('regelingnaam met stichting: alleen de stichting (Cordius)', M.kortFondsLabel('Kwartaalronde donatieaanvraag mens, natuur en cultuur Stichting Cordius'), 'Stichting Cordius');
  gelijk('regelingnaam met stichting: alleen de stichting (Pieter Bastiaan)', M.kortFondsLabel('Kwartaalronde projectaanvraag Stichting Pieter Bastiaan'), 'Stichting Pieter Bastiaan');
  gelijk('een korte naam blijft zoals hij is', M.kortFondsLabel('Stichting Cordius'), 'Stichting Cordius');
  gelijk('een naam zonder stichting of fonds blijft zoals hij is', M.kortFondsLabel('Prins Bernhard Cultuurfonds'), 'Prins Bernhard Cultuurfonds');
  gelijk('rommel geeft een lege tekst', M.kortFondsLabel(null), '');
  gelijk('titel van een fonds', M.aanvraagTitel('Kwartaalronde projectaanvraag Stichting Pieter Bastiaan'), 'Fondsaanvraag Stichting Pieter Bastiaan');
  gelijk('titel van een overheid', M.aanvraagTitel('Gemeente Rotterdam'), 'Subsidieaanvraag Gemeente Rotterdam');

  const regels = [
    { id: 'a', bronStatus: 'zichtbaar', status: 'interesting', naam: 'Kwartaalronde donatieaanvraag mens, natuur en cultuur Stichting Cordius', funder: 'Stichting Cordius', requested: 5000, awarded: null, website: '' },
    { id: 'b', bronStatus: 'zichtbaar', status: 'preparing', naam: 'Stichting Pieter Bastiaan', funder: 'Stichting Pieter Bastiaan', requested: 3000, awarded: null, website: '' },
    { id: 'c', bronStatus: 'zichtbaar', status: 'interesting', naam: 'Tweede regeling Stichting Cordius', funder: 'Stichting Cordius', requested: 1000, awarded: null, website: '' },
  ];
  const l = M.fondsenUitDekkingsplan(regels, [{ soort: 'fonds', fondsLabel: 'Kwartaalronde projectaanvraag Stichting Pieter Bastiaan' }]);

  gelijk('dekkingsplan: de aanbieder is de naam, twee regelingen van dezelfde stichting worden één fonds', l.map((x) => x.naam).join('|'), 'Stichting Cordius');
  gelijk('dekkingsplan: de regeling staat eronder als toelichting', l[0].regeling, 'Kwartaalronde donatieaanvraag mens, natuur en cultuur Stichting Cordius');
  gelijk('dekkingsplan: een fonds met een aanvraag (ook onder de lange naam) staat er niet meer in', M.fondsenUitDekkingsplan(regels, [{ soort: 'fonds', fondsLabel: 'Kwartaalronde projectaanvraag Stichting Pieter Bastiaan' }, { soort: 'fonds', fondsLabel: 'Stichting Cordius' }]).length, 0);
}

klaar('aanvraag-schermen-model');
