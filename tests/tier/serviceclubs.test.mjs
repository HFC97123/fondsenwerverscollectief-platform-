import { selecteerDekkingsmix, selecteerZonderBedrag } from '../../supabase/functions/_shared/dekkingsmix.ts';
import { tierConfigVoor } from '../../supabase/functions/_shared/tierConfig.ts';
import { OPTIONEEL_TEKST, OPTIONEEL_ONDERDEEL, isServiceclubVermelding, serviceclubBeoordeling } from '../../supabase/functions/_shared/serviceclubs.ts';
import { BEDRAG_INDICATIE_TEKST, BEDRAG_INDICATIE_TEKST_ZONDER_BEDRAG } from '../../supabase/functions/_shared/dekkingsmix.ts';
import { kandidaatNaarMix, bouwVoorstel } from '../../supabase/functions/_shared/voorstelGenereren.ts';
import { check, gelijk, sectie, klaar, stand } from '../verificatie/hulp.mjs';

stand.naam = 'serviceclubs';

const PRO = tierConfigVoor('pro');
const PREMIUM = tierConfigVoor('premium');
let teller = 0;
const k = (naam, score, min, max, extra = {}) => {
  teller += 1;
  const id = `00000000-0000-4000-8000-${String(teller).padStart(12, '0')}`;

  return { sleutel: `fonds:${id}`, type: 'fonds', id, naam, niveau: 'volledig', accessTier: 'pro', relevant: true, score, min, max, ...extra };
};

sectie('1. Welk record is een serviceclub-vermelding');
{
  gelijk('service_club met Regionaal: ja', isServiceclubVermelding({ funder_type: 'service_club', werkgebieden_namen: ['Landelijk', 'Regionaal'] }), true);
  gelijk('internationaal clubfonds (geen Regionaal): nee', isServiceclubVermelding({ funder_type: 'service_club', werkgebieden_namen: ['Wereld / Internationaal'] }), false);
  gelijk('ander type met Regionaal: nee', isServiceclubVermelding({ funder_type: 'fonds', werkgebieden_namen: ['Regionaal'] }), false);
  gelijk('type_gever werkt ook', isServiceclubVermelding({ type_gever: 'service_club', werkgebieden_namen: ['Regionaal'] }), true);
  gelijk('rommel geeft false', isServiceclubVermelding(null), false);
  gelijk('geen werkgebieden: nee', isServiceclubVermelding({ funder_type: 'service_club' }), false);
}

sectie('2. Poort: regionaal, onderwerp, buitenland');
{
  const basis = { themas: [], doelgroepen: ['Kinderen'], regios: ['Utrecht'], locatieTekst: '' };
  const b = (extra) => serviceclubBeoordeling({ ...basis, ...extra });

  gelijk('regionaal + kinderen: aanbieden', b({}).aanbieden, true);
  gelijk('regionaal + vrouwen en meisjes', b({ doelgroepen: ['Vrouwen en meisjes'] }).aanbieden, true);
  gelijk('regionaal + noodhulp (thema)', b({ doelgroepen: [], themas: ['Noodhulp'] }).aanbieden, true);
  gelijk('regionaal + noodhulp (activiteit)', b({ doelgroepen: [], activiteiten: ['noodhulp'] }).aanbieden, true);
  gelijk('plaats in vrije tekst telt als regionaal', b({ regios: [], locatieTekst: 'Zutphen' }).aanbieden, true);
  gelijk('landelijk project: niet aanbieden', b({ regios: ['Landelijk'] }).reden, 'niet-regionaal');
  gelijk('"heel Nederland": niet aanbieden', b({ regios: [], locatieTekst: 'Heel Nederland' }).reden, 'niet-regionaal');
  gelijk('geen werkgebied bekend: niet aanbieden', b({ regios: [], locatieTekst: '' }).reden, 'werkgebied-onbekend');
  gelijk('regionaal maar niets met kinderen, vrouwen of noodhulp: niet', b({ doelgroepen: ['Ouderen'], themas: ['Cultuur'] }).reden, 'onderwerp');
  gelijk('buitenland via regio', b({ regios: ['Afrika'] }).reden, 'buitenland');
  gelijk('buitenland via locatietekst', b({ regios: [], locatieTekst: 'Een school in Kenia' }).reden, 'buitenland');
  gelijk('Caribisch deel: buitenland', b({ regios: ['Caribisch deel van het Koninkrijk'] }).reden, 'buitenland');
  gelijk('Nederlandse plaats + buitenlandse regio: buitenland wint', b({ regios: ['Utrecht', 'Wereld / Internationaal'] }).aanbieden, false);
}

sectie('3. Telt mee in de dekking maar staat helemaal onderaan');
{
  const club = (naam, score) => k(naam, score, 500, 2000, { optioneel: true });
  const gewoon = k('Gewoon fonds', 60, 1000, 10000);
  const hoogClub = club('Soroptimisten', 95);
  const r = selecteerDekkingsmix({ kandidaten: [hoogClub, gewoon], gat: 20000, config: PREMIUM });

  gelijk('gewoon fonds eerst, ook bij lagere score', r.mix[0].naam, 'Gewoon fonds');
  gelijk('club staat onderaan', r.mix[r.mix.length - 1].naam, 'Soroptimisten');
  check('club is gemarkeerd als optioneel', r.mix[r.mix.length - 1].optioneel === true);
  check('club-onzekerheid begint met de optioneel-tekst', r.mix[r.mix.length - 1].onzekerheden[0] === OPTIONEEL_TEKST);
  check('gewoon fonds is niet optioneel', !r.mix[0].optioneel && !r.mix[0].onzekerheden.includes(OPTIONEEL_TEKST));
  check('club telt mee in de som', r.som === r.mix.reduce((t, x) => t + x.bedrag, 0) && r.mix.some((x) => x.optioneel && x.bedrag > 0));

  // Doel al gehaald door gewone fondsen: club wordt niet gebruikt en nooit de reserve.
  const gewone = [k('Groot A', 70, 1000, 100000), k('Groot B', 69, 1000, 100000), k('Groot C', 68, 1000, 100000), k('Groot D', 67, 1000, 100000), k('Groot E', 66, 1000, 100000)];
  const zonderClub = selecteerDekkingsmix({ kandidaten: gewone, gat: 10000, config: PRO });
  const r2 = selecteerDekkingsmix({ kandidaten: [hoogClub, ...gewone], gat: 10000, config: PRO });

  gelijk('uitgangspunt: gewone fondsen halen het doel alleen', zonderClub.uitkomst, 'doel-bereikt');

  check('doel gehaald zonder club: club niet in de mix', !r2.mix.some((x) => x.optioneel), JSON.stringify(r2.mix.map((x) => x.naam)));
  check('club is nooit de reserve', !(r2.reserve && r2.reserve.optioneel));

  // Volgorde van de invoer maakt niets uit.
  const a = selecteerDekkingsmix({ kandidaten: [hoogClub, gewoon], gat: 20000, config: PREMIUM });
  const bb = selecteerDekkingsmix({ kandidaten: [gewoon, hoogClub], gat: 20000, config: PREMIUM });

  gelijk('deterministisch', JSON.stringify(a.mix.map((x) => x.sleutel)), JSON.stringify(bb.mix.map((x) => x.sleutel)));

  // Zonder bedrag: ook onderaan.
  const z = selecteerZonderBedrag({ kandidaten: [hoogClub, gewoon], config: PREMIUM });

  gelijk('zonder bedrag: club onderaan', z.regels.map((x) => x.naam).join('|'), 'Gewoon fonds|Soroptimisten');
}

sectie('4. Het databaserecord wordt optioneel gemarkeerd, de internationale clubfondsen niet');
{
  const uuid = '11111111-1111-4111-8111-111111111111';
  const maak = (row) => kandidaatNaarMix({ bron: 'fonds', row: { funder_id: uuid, funder_naam: 'Test', ...row }, accessTier: 'premium', relevant: true, score: 80 }, 'volledig');

  check('Rotary-achtig record: optioneel', maak({ funder_type: 'service_club', werkgebieden_namen: ['Landelijk', 'Regionaal'] })?.optioneel === true);
  check('internationaal clubfonds: niet optioneel', maak({ funder_type: 'service_club', werkgebieden_namen: ['Wereld / Internationaal'] })?.optioneel !== true);
  check('gewoon fonds: niet optioneel', maak({ funder_type: 'vermogensfonds', werkgebieden_namen: ['Landelijk'] })?.optioneel !== true);
  check('onderdeeltekst past in het contract (200)', OPTIONEEL_ONDERDEEL.length <= 200 && OPTIONEEL_TEKST.length <= 300, `${OPTIONEEL_TEKST.length}`);
}

sectie('5. In het echte voorstel: onderaan, onderdeel en tekst, bedrag telt mee');
{
  const maak = (id, naam, extra, score, min, max) => {
    const engine = { bron: 'funder', row: { funder_id: id, funder_naam: naam, bijdrage_min: min, bijdrage_max: max, ...extra }, naam, funderNaam: naam, accessTier: 'premium', relevant: true, score, waarom: [], zwaktes: [] };

    return { mix: kandidaatNaarMix(engine, 'volledig'), engine };
  };
  const g = maak('22222222-2222-4222-8222-222222222222', 'Gewoon Fonds', { funder_type: 'vermogensfonds', werkgebieden_namen: ['Landelijk'] }, 70, 1000, 8000);
  const c = maak('33333333-3333-4333-8333-333333333333', 'Soroptimisten Nederland', { funder_type: 'service_club', werkgebieden_namen: ['Landelijk', 'Regionaal'] }, 95, 500, 2000);
  const records = [g, c].map(({ mix }) => ({ type: mix.type, id: mix.id, niveau: 'volledig', naam: mix.naam, gever: mix.naam, min: mix.min, max: mix.max }));
  const u = bouwVoorstel({
    projectId: '44444444-4444-4444-8444-444444444444',
    vandaag: '2026-10-18',
    dekking: { heeftBegroting: true, nogTePlannen: 10000 },
    bedragenToegestaan: true,
    bestaandeRegels: [],
    config: PREMIUM,
    kandidaten: [c, g],
    records,
  });
  const regels = u.ruw.regels;

  gelijk('gewoon fonds eerst', regels[0].naam, 'Gewoon Fonds');
  gelijk('serviceclub laatst', regels[regels.length - 1].naam, 'Soroptimisten Nederland');
  gelijk('serviceclub heeft onderdeel "Optioneel te onderzoeken"', regels[regels.length - 1].onderdeel, OPTIONEEL_ONDERDEEL);
  check('serviceclub heeft de uitleg over het zoeken naar een club in de regio', regels[regels.length - 1].onzekerheden.includes(OPTIONEEL_TEKST));
  check('serviceclub heeft een bedrag dat meetelt', typeof regels[regels.length - 1].bedrag === 'number' && regels[regels.length - 1].bedrag > 0);
  check('gewoon fonds heeft geen onderdeel', regels[0].onderdeel === '');
  check('voorstel blijft geldig volgens het contract', u.gevalideerd.ok === true, JSON.stringify(u.gevalideerd.fouten?.slice(0, 3)));

  check('indicatietekst staat vooraan in de aannames', u.ruw.aannames[0] === BEDRAG_INDICATIE_TEKST, JSON.stringify(u.ruw.aannames));
  check('de tekst zegt: inschatting en overleg met de donor', /inschatting/.test(BEDRAG_INDICATIE_TEKST) && /overleg altijd zelf met de donor/i.test(BEDRAG_INDICATIE_TEKST));
  check('elke regel met bedrag wijst op overleg met de donor', regels.every((x) => x.onzekerheden.some((t) => /overleg met de donor/i.test(t))));
  check('aanname past in het contract (300 tekens)', BEDRAG_INDICATIE_TEKST.length <= 300 && BEDRAG_INDICATIE_TEKST_ZONDER_BEDRAG.length <= 300);

  const z = bouwVoorstel({ projectId: '44444444-4444-4444-8444-444444444444', vandaag: '2026-10-18', dekking: {}, bedragenToegestaan: false, zonderBedrag: true, bestaandeRegels: [], config: PREMIUM, kandidaten: [g], records: records.slice(0, 1) });

  check('zonder bedrag: aparte tekst (geen bedragen voorgesteld, wel overleg met de donor)', z.ruw.aannames[0] === BEDRAG_INDICATIE_TEKST_ZONDER_BEDRAG, JSON.stringify(z.ruw.aannames));
}

klaar('serviceclubs');
