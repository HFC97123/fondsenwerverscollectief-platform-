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
  gelijk('Pro: Beoordelingen 2 van 6, Plannen schrijven 0 van 1', r.map((x) => `${x.label} ${x.tekst}`).join('; '), 'Beoordelingen 2 van 6; Plannen schrijven 0 van 1');
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

klaar('aanvraag-schermen-model');
