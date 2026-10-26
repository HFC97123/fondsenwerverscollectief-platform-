// Plaats -> provincie (supabase/functions/_shared/plaatsen.ts) en de koppeling aan de geografie-beoordeling van de matching.
//   node tests/plaatsen/plaatsen.test.mjs
import * as P from '../../supabase/functions/_shared/plaatsen.ts';
import { laadModule, FUNCTIE_PAD } from '../fondsadvies-free/harness.mjs';

let ok = 0;
let fout = 0;
function check(naam, voorwaarde, detail = '') {
  if (voorwaarde) ok += 1; else { fout += 1; console.log('  FAIL:', naam, detail); }
}
function sectie(t) { console.log('\n== ' + t); }
const prov = (t) => P.provinciesUitTekst(t).join('|');

sectie('1. Plaatsen en hun provincie');
{
  const gevallen = [
    ['Zaandam', 'Noord-Holland'], ['Hoofddorp', 'Noord-Holland'], ['Amsterdam-Noord', 'Noord-Holland'], ['Bijlmer', 'Noord-Holland'], ['Hilversum', 'Noord-Holland'], ['IJmuiden', 'Noord-Holland'],
    ['Den Haag', 'Zuid-Holland'], ["'s-Gravenhage", 'Zuid-Holland'], ['Scheveningen', 'Zuid-Holland'], ['Spijkenisse', 'Zuid-Holland'], ['Rotterdam-Zuid', 'Zuid-Holland'], ['Delft', 'Zuid-Holland'], ['Zoetermeer', 'Zuid-Holland'],
    ['Utrecht', 'Utrecht'], ['Amersfoort', 'Utrecht'], ['Zeist', 'Utrecht'], ['Almere', 'Flevoland'], ['Almere Buiten', 'Flevoland'], ['Lelystad', 'Flevoland'], ['Emmeloord', 'Flevoland'],
    ['Zwolle', 'Overijssel'], ['Enschede', 'Overijssel'], ['Deventer', 'Overijssel'], ['Nijmegen', 'Gelderland'], ['Arnhem', 'Gelderland'], ['Apeldoorn', 'Gelderland'],
    ['Eindhoven', 'Noord-Brabant'], ['Tilburg', 'Noord-Brabant'], ['Den Bosch', 'Noord-Brabant'], ["'s-Hertogenbosch", 'Noord-Brabant'], ['Bergen op Zoom', 'Noord-Brabant'],
    ['Maastricht', 'Limburg'], ['Sittard', 'Limburg'], ['Heerlen', 'Limburg'], ['Middelburg', 'Zeeland'], ['Vlissingen', 'Zeeland'], ['Terneuzen', 'Zeeland'],
    ['Leeuwarden', 'Friesland'], ['Sneek', 'Friesland'], ['Groningen', 'Groningen'], ['Winschoten', 'Groningen'], ['Assen', 'Drenthe'], ['Emmen', 'Drenthe'], ['Hoogeveen', 'Drenthe'],
  ];

  check('alle 12 provincies zitten in de voorbeelden', P.PROVINCIES.every((p) => gevallen.some((g) => g[1] === p)));

  for (const [t, p] of gevallen) check(`${t} -> ${p}`, prov(t) === p, `kreeg "${prov(t)}"`);

  check('hoofdletters en accenten maken niet uit (SÚDWEST-FRYSLÂN)', prov('SUDWEST-FRYSLAN') === 'Friesland' && prov('Súdwest-Fryslân') === 'Friesland');
  check('"Amsterdam en Utrecht": beide provincies', prov('Amsterdam en Utrecht') === 'Noord-Holland|Utrecht');
  check('"Zaandam en Purmerend": één provincie, geen dubbelen', prov('Zaandam en Purmerend') === 'Noord-Holland');
  check('een zin met een plaats erin', prov('Het project vindt plaats in de wijk Overvecht in Utrecht.') === 'Utrecht');
  check('de naam van een provincie zelf is geen plaats', prov('Noord-Holland') === '' && prov('Zuid-Holland en Limburg') === '');
  check('een onbekende plaats geeft niets (geen gok)', prov('Kleinedorpjesveld') === '');
  check('leeg, null en undefined geven niets', prov('') === '' && prov(null) === '' && prov(undefined) === '');
  check('Zaandam hoort bij gemeente Zaanstad', P.plaatsenUitTekst('Zaandam').gevonden[0]?.gemeente === 'Zaanstad');
  check('Den Bosch wordt netjes weergegeven', P.plaatsenUitTekst('Den Bosch').gevonden[0]?.plaats === "'s-Hertogenbosch");
}

sectie('2. Dubbelzinnige namen worden niet geraden');
{
  for (const t of ['Bergen', 'Hengelo', 'Rijswijk', 'Beek', 'Laren', 'Elst', 'Velp', 'Oosterhout']) check(`${t}: geen provincie`, prov(t) === '', prov(t));

  check('Bergen wordt als vaag gemeld', P.plaatsenUitTekst('Bergen').vaag.includes('bergen'));
  check('"Bergen op Zoom" is wel eenduidig', prov('Bergen op Zoom') === 'Noord-Brabant');
  check('"Hengelo (Gld)" is wel eenduidig', prov('Hengelo (Gld)') === 'Gelderland');
  check('"Amsterdam" in een tekst met "Bergen": Amsterdam telt, Bergen niet', prov('Amsterdam en Bergen') === 'Noord-Holland');
}

sectie('3. Namen die ook een gewoon woord zijn: alleen met hoofdletter');
{
  check('"het is best leuk" is geen plaats', prov('het is best leuk') === '');
  check('"in Best" is wel een plaats', prov('Project in Best') === 'Noord-Brabant');
  check('"de buren" is geen plaats', prov('hulp van de buren') === '');
  check('"houten speelgoed" is geen plaats; "Houten" wel', prov('houten speelgoed') === '' && prov('Houten') === 'Utrecht');
  check('"huizen bouwen" is geen plaats; "Huizen" wel', prov('huizen bouwen') === '' && prov('Huizen') === 'Noord-Holland');
  check('"echt waar" is geen plaats', prov('echt waar') === '');
  check('"een monster" is geen plaats; "Monster" wel', prov('een monster') === '' && prov('in Monster') === 'Zuid-Holland');
}

sectie('4. Zinnen voor de AI en lijstintegriteit');
{
  const z = P.ligtInZinnen(['Zaandam', 'Utrecht', 'Amsterdam', '', null]);

  check('Zaandam: gemeente en provincie genoemd', z.includes('Zaandam (gemeente Zaanstad) ligt in de provincie Noord-Holland'), JSON.stringify(z));
  check('Amsterdam: ligt in Noord-Holland', z.includes('Amsterdam ligt in de provincie Noord-Holland'));
  check('Utrecht in Utrecht: geen overbodige zin', !z.some((x) => x.startsWith('Utrecht ')));
  check('hooguit 4 zinnen', P.ligtInZinnen(['Amsterdam', 'Zwolle', 'Leiden', 'Delft', 'Zaandam', 'Almere']).length === 4);
  check('provincieVanNaam: provincie zelf en plaats', P.provincieVanNaam('Noord-Holland') === 'Noord-Holland' && P.provincieVanNaam('Zaandam') === 'Noord-Holland' && P.provincieVanNaam('Afrika') === null);
  check('de lijst is groot genoeg (alle gemeenten behalve dubbelzinnige namen plus woonplaatsen)', P.AANTAL_PLAATSEN >= 550, String(P.AANTAL_PLAATSEN));
}

sectie('5. Koppeling aan de geografie-beoordeling');
{
  const { mod: M } = await laadModule(FUNCTIE_PAD, 'plaatsen');
  const crit = (o) => ({ themas: [], kernThemas: [], doelgroepen: [], regios: [], locatieTekst: '', gevraagdBedrag: null, doelTermen: [], activiteiten: [], ...o });
  const geo = (naam, regios, c, funderNaam = '') => M.beoordeelGeografie(naam, funderNaam, {}, regios, c);

  // zonder geladen lijst: het oude gedrag (Zaandam is niet bekend)
  const zaandam = crit({ locatieTekst: 'Zaandam' });
  const voor = { nh: geo('Fonds NH', ['Noord-Holland'], zaandam), zh: geo('Fonds ZH', ['Zuid-Holland'], zaandam), adam: geo('Fonds A', ['Amsterdam'], zaandam) };

  check('voor het laden: Zaandam wordt niet aan Noord-Holland gekoppeld', voor.nh.status !== 'eligible' || !voor.nh.positief);

  await M.laadPlaatsen();

  const na = { nh: geo('Fonds NH', ['Noord-Holland'], zaandam), zh: geo('Fonds ZH', ['Zuid-Holland'], zaandam), adam: geo('Fonds A', ['Amsterdam'], zaandam), land: geo('Fonds L', ['Landelijk'], zaandam), adamReg: geo('Fonds AR', ['Amsterdam', 'Regionaal'], zaandam) };

  check('Zaandam + fonds Noord-Holland: passend en lokaal', na.nh.status === 'eligible' && na.nh.positief === true && na.nh.lokaal === true, JSON.stringify(na.nh));
  check('Zaandam + fonds Zuid-Holland: niet passend (andere provincie)', na.zh.status === 'ineligible', JSON.stringify(na.zh));
  check('Zaandam + fonds Amsterdam: niet zeker afgewezen, wel te controleren (zelfde provincie)', na.adam.status === 'unknown', JSON.stringify(na.adam));
  check('Zaandam + Amsterdam + Regionaal: te controleren, niet afgewezen', na.adamReg.status === 'unknown', JSON.stringify(na.adamReg));
  check('Zaandam + landelijk fonds: passend', na.land.status === 'eligible', JSON.stringify(na.land));

  const adam = crit({ regios: ['Amsterdam'], locatieTekst: 'Amsterdam' });

  check('Amsterdam + fonds Noord-Holland: passend (zoals voorheen)', geo('F', ['Noord-Holland'], adam).status === 'eligible');
  check('Amsterdam + fonds Rotterdam: nog steeds niet passend', geo('F', ['Rotterdam'], adam).status === 'ineligible');
  check('Amsterdam + fonds Landelijk: passend', geo('F', ['Landelijk'], adam).status === 'eligible');

  const almere = crit({ locatieTekst: 'Almere Buiten' });

  check('Almere + fonds Flevoland: passend en lokaal', geo('F', ['Flevoland'], almere).status === 'eligible' && geo('F', ['Flevoland'], almere).lokaal === true);
  check('Almere + fonds Noord-Holland: niet passend', geo('F', ['Noord-Holland'], almere).status === 'ineligible');

  const onbekend = crit({ locatieTekst: 'Kleinedorpjesveld' });

  check('onbekende plaats: geen afwijzing op een gok', geo('F', ['Noord-Holland'], onbekend).status !== 'ineligible', JSON.stringify(geo('F', ['Noord-Holland'], onbekend)));

  const bergen = crit({ locatieTekst: 'Bergen' });

  check('Bergen (dubbelzinnig): geen afwijzing op een gok', geo('F', ['Zuid-Holland'], bergen).status !== 'ineligible');

  const afrika = crit({ regios: ['Afrika'], locatieTekst: 'Kenia' });

  check('project in Afrika + fonds Noord-Holland: nog steeds niet passend', geo('F', ['Noord-Holland'], afrika).status === 'ineligible');

  // fonds dat op de gemeente is gebonden: "Gemeente Zaanstad" voor een project in Zaandam
  check('Zaandam + "Gemeente Zaanstad": niet afgewezen (Zaandam ligt in die gemeente)', geo('Subsidie sociaal', ['Landelijk'], zaandam, 'Gemeente Zaanstad').status !== 'ineligible', JSON.stringify(geo('Subsidie sociaal', ['Landelijk'], zaandam, 'Gemeente Zaanstad')));
  check('Zaandam + "Provincie Noord-Holland": niet afgewezen', geo('Provinciefonds', ['Landelijk'], zaandam, 'Provincie Noord-Holland').status !== 'ineligible');
  check('Zaandam + "Gemeente Zwolle": wel afgewezen', geo('Subsidie', ['Landelijk'], zaandam, 'Gemeente Zwolle').status === 'ineligible');
}

console.log(`\n${fout ? 'FOUT' : 'OK'}: ${ok} OK, ${fout} FOUT`);
process.exit(fout ? 1 : 0);
