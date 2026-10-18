import { selecteerDekkingsmix, realistischBedrag, bandOndergrens, MELDING_TE_WEINIG_STERKE_MATCHES } from '../../supabase/functions/_shared/dekkingsmix.ts';
import { tierConfigVoor } from '../../supabase/functions/_shared/tierConfig.ts';
import { check, gelijk, sectie, klaar, stand } from '../verificatie/hulp.mjs';

stand.naam = 'dekkingsmix';

const PRO = tierConfigVoor('pro');
const PREMIUM = tierConfigVoor('premium');
let teller = 0;
const k = (naam, score, min, max, extra = {}) => {
  teller += 1;
  const id = `00000000-0000-4000-8000-${String(teller).padStart(12, '0')}`;

  return { sleutel: `regeling:${id}`, type: 'regeling', id, naam, niveau: 'volledig', accessTier: 'pro', relevant: true, score, min, max, ...extra };
};
const som = (r) => r.mix.reduce((t, x) => t + x.bedrag, 0);

sectie('1. Realistisch bedrag: voorzichtig, nooit het maximum als standaard');
{
  const AANDEEL = 1 / 3;
  const rb = (inv) => realistischBedrag({ maxAandeel: AANDEEL, bandOnder: null, ...inv });

  check('alleen een maximum van € 100.000, gat € 40.000: een derde van het gat, afgerond (€ 13.000)', rb({ gat: 40000, nodig: 48000, min: null, max: 100000 }).bedrag === 13000 && rb({ gat: 40000, nodig: 48000, min: null, max: 100000 }).grond === 'aandeel-van-gat');
  check('het is altijd een indicatie', rb({ gat: 40000, nodig: 48000, min: null, max: 100000 }).indicatie === true);
  gelijk('alleen een klein maximum: een derde daarvan', rb({ gat: 40000, nodig: 48000, min: null, max: 10000 }).bedrag, 3300);
  gelijk('minimum en maximum: minimum plus een derde van het bereik (€ 5.000 tot € 50.000 = € 20.000)', rb({ gat: 120000, nodig: 144000, min: 5000, max: 50000 }).bedrag, 20000);
  gelijk('grond voorzichtig-laag', rb({ gat: 120000, nodig: 144000, min: 5000, max: 50000 }).grond, 'voorzichtig-laag');
  gelijk('alleen een minimum: dat minimum (ook boven een derde van het gat)', rb({ gat: 40000, nodig: 48000, min: 25000, max: null }).bedrag, 25000);
  gelijk('alleen een bandbreedte: de laagste waarde van de band', rb({ gat: 40000, nodig: 48000, min: null, max: null, bandOnder: 10000 }).bedrag, 10000);
  gelijk('grond laagste-bandbreedte', rb({ gat: 40000, nodig: 48000, min: null, max: null, bandOnder: 10000 }).grond, 'laagste-bandbreedte');
  gelijk('een eigen minimum gaat voor de band', rb({ gat: 40000, nodig: 48000, min: 7000, max: null, bandOnder: 10000 }).bedrag, 7000);
  gelijk('laatste financier hoeft niet meer te dragen dan nodig', rb({ gat: 40000, nodig: 4000, min: null, max: 100000 }).bedrag, 4000);
  gelijk('nodig-grond', rb({ gat: 40000, nodig: 4000, min: null, max: 100000 }).grond, 'rest-tot-doel');
  gelijk('afronding < 5.000 op honderden', rb({ gat: 7777, nodig: 7777, min: null, max: 100000 }).bedrag, 2500);
  gelijk('afronden gaat nooit onder het minimum', rb({ gat: 40000, nodig: 48000, min: 20250, max: 90000 }).bedrag >= 20250, true);
  check('de rekenbasis ligt onder het bereik dat het lid ziet: nooit het maximum', rb({ gat: 120000, nodig: 144000, min: 20000, max: 70000 }).bedrag < 70000);

  gelijk('bandOndergrens: €5.000–€10.000', bandOndergrens('€5.000–€10.000'), 5000);
  gelijk('bandOndergrens: laagste band begint bij € 0, dus € 5.000', bandOndergrens('€0–€5.000'), 5000);
  gelijk('bandOndergrens: €10.000–€25.000', bandOndergrens('€10.000–€25.000'), 10000);
  gelijk('bandOndergrens: €500.000–€1.000.000', bandOndergrens('€500.000–€1.000.000'), 500000);
  gelijk('bandOndergrens: €1.000.000+', bandOndergrens('€1.000.000+'), 1000000);
  gelijk('bandOndergrens: geen band of rommel', [bandOndergrens(null), bandOndergrens(undefined), bandOndergrens('onbekend'), bandOndergrens(5)].join(), ',,,');

  for (const [naam, inv, code] of [
    ['geen grenzen bekend', { gat: 40000, nodig: 44000, min: null, max: null }, 'geen-bedragen-bekend'],
    ['minimum boven het hele gat', { gat: 40000, nodig: 44000, min: 60000, max: 90000 }, 'minimum-boven-gat'],
    ['minimum groter dan maximum (data-fout)', { gat: 40000, nodig: 44000, min: 90000, max: 10000 }, 'ongeldige-grenzen'],
    ['geen gat', { gat: 0, nodig: 0, min: 1000, max: 5000 }, 'geen-bedragen-bekend'],
    ['gat NaN', { gat: NaN, nodig: 1, min: 1000, max: 5000 }, 'geen-bedragen-bekend'],
  ]) {
    const r = realistischBedrag({ ...inv, maxAandeel: 0.5 });

    check(`geen bedrag: ${naam}`, r.bedrag === null && r.afwijsCode === code, JSON.stringify(r));
  }

  for (const rommel of ['abc', -5, NaN, Infinity, {}, [], '5000']) {
    const r = realistischBedrag({ gat: 40000, nodig: 44000, min: rommel, max: rommel, maxAandeel: 0.5 });

    check(`ongeldige grens ${JSON.stringify(rommel)} wordt als onbekend behandeld`, r.bedrag === null, JSON.stringify(r));
  }

  check('maxAandeel buiten bereik valt terug op 0,5', realistischBedrag({ gat: 40000, nodig: 44000, min: null, max: 100000, maxAandeel: 7 }).bedrag === 20000);
}

sectie('2. Voorbeeld: gat € 40.000 met bereiken, een band en alternatieven');
{
  const A = k('Fonds A', 90, 5000, 25000);
  const B = k('Fonds B', 85, 5000, 15000);
  const C = k('Fonds C', 80, 10000, 40000);
  const D = k('Fonds D', 75, 5000, 20000);
  const E = k('Fonds E', 70, null, null, { band: '€5.000–€10.000' });
  const F = k('Fonds F', 65, null, 9000);
  const G = k('Fonds G', 60, 5000, 10000);
  const H = k('Fonds H', 58, 5000, 10000);
  const I = k('Fonds I', 55, 5000, 10000);
  const J = k('Fonds J', 52, 5000, 10000);
  const alle = [A, B, C, D, E, F, G, H, I, J];
  const r = selecteerDekkingsmix({ kandidaten: alle, gat: 40000, config: PRO });

  check('Pro: doelbedrag is 120% = € 48.000', r.doelBedrag === 48000);
  check('Pro: doel bereikt met A tot en met F (de laatste krijgt alleen het restant)', r.uitkomst === 'doel-bereikt' && r.mix.map((x) => x.naam).join() === 'Fonds A,Fonds B,Fonds C,Fonds D,Fonds E,Fonds F', JSON.stringify(r.mix.map((x) => [x.naam, x.bedrag])));
  check('Pro: bedragen zijn voorzichtig (A € 11.500, B € 8.000, E laagste band € 5.000)', r.mix[0].bedrag === 11500 && r.mix[1].bedrag === 8000 && r.mix[4].bedrag === 5000 && r.mix[4].grond === 'laagste-bandbreedte');
  check('Pro: geen enkel fonds draagt meer dan een derde van het gat', r.mix.every((x) => x.bedrag <= Math.floor(40000 / 3)));
  check('Pro: som haalt het doel, en stopt daar', som(r) >= 48000 && som(r) === r.som && r.dekking >= 1.2);
  check('Pro: drie alternatieven (G, H, I), J niet meer', r.reserves.map((x) => x.naam).join() === 'Fonds G,Fonds H,Fonds I' && r.reserve.naam === 'Fonds G');
  check('de alternatieven tellen niet mee in de som en staan niet in de mix', r.som === som(r) && r.reserves.every((x) => !r.mix.some((m) => m.sleutel === x.sleutel)));
  check('minimaal drie regels nodig om een gat te dichten (geen fonds draagt meer dan een derde)', selecteerDekkingsmix({ kandidaten: [k('Groot 1', 95, 5000, 500000), k('Groot 2', 94, 5000, 500000)], gat: 40000, config: PRO }).mix.length === 2 && selecteerDekkingsmix({ kandidaten: [k('Groot 1', 95, 5000, 500000), k('Groot 2', 94, 5000, 500000)], gat: 40000, config: PRO }).som < 40000);

  const p = selecteerDekkingsmix({ kandidaten: alle, gat: 40000, config: PREMIUM });

  check('Premium: doelbedrag is 160% = € 64.000', p.doelBedrag === 64000);
  check('Premium: beste scoreband eerst (A), binnen een band de hoogste bijdrage eerst (C vóór B)', p.mix.slice(0, 3).map((x) => x.naam).join() === 'Fonds A,Fonds C,Fonds B', p.mix.map((x) => x.naam).join());
  check('Premium: meer regels en een hoger totaal dan Pro', p.mix.length > r.mix.length && p.som > r.som && p.mix.length <= PREMIUM.maxRegelsInMix, p.mix.length + ' ' + p.som);
  check('Premium: het gat is gedekt, en er staan alternatieven bij', p.som >= 40000 && p.reserves.length >= 1);
  check('Pro blijft puur op score (A, B, C): geen rangschikking op bijdrage', r.mix.slice(0, 3).map((x) => x.naam).join() === 'Fonds A,Fonds B,Fonds C');
}

sectie('3. Kwaliteit boven dekking: nooit een zwakke match toevoegen om een percentage te halen');
{
  const sterk = k('Sterk', 90, null, 15000);
  const zwak = k('Zwak', 30, null, 50000);
  const niet = k('Niet relevant', 99, null, 50000, { relevant: false });
  const r = selecteerDekkingsmix({ kandidaten: [sterk, zwak, niet], gat: 40000, config: PRO });

  check('onvoldoende: eerlijke uitkomst, niet opgevuld', r.uitkomst === 'onvoldoende-sterke-matches' && r.mix.length === 1 && r.mix[0].naam === 'Sterk');
  check('de zwakke en de niet-relevante staan niet in de mix', !r.mix.some((x) => x.naam === 'Zwak' || x.naam === 'Niet relevant'));
  check('afwijzing met reden', r.afgewezen.some((x) => x.sleutel === zwak.sleutel && x.code === 'score-te-laag') && r.afgewezen.some((x) => x.sleutel === niet.sleutel && x.code === 'niet-relevant'));
  check('eerlijke melding aan de gebruiker', r.melding === MELDING_TE_WEINIG_STERKE_MATCHES && /te weinig sterke/.test(r.melding));
  check('geen reserve als het doel niet gehaald is', r.reserve === null);
  check('een score precies op de ondergrens telt mee, daaronder niet', selecteerDekkingsmix({ kandidaten: [k('Grens', PRO.minScore, null, 15000)], gat: 10000, config: PRO }).mix.length === 1 && selecteerDekkingsmix({ kandidaten: [k('Net eronder', PRO.minScore - 0.1, null, 15000)], gat: 10000, config: PRO }).mix.length === 0);
}

sectie('4. Entitlement: Pro krijgt nooit een Premium-record, ook niet als een bovenliggende stap zich vergist');
{
  const eigen = k('Pro-fonds', 80, null, 30000, { accessTier: 'pro' });
  const vrij = k('Vrij fonds', 78, null, 30000, { accessTier: 'free' });
  const prem = k('Premium-fonds', 99, null, 30000, { accessTier: 'premium' });
  const publiek = k('Publiek niveau', 99, null, 30000, { niveau: 'publiek', accessTier: 'premium' });
  const verborgen = k('Verborgen', 99, null, 30000, { niveau: 'verborgen', accessTier: 'pro' });
  const onbekend = k('Onbekende tier', 99, null, 30000, { accessTier: 'platina' });
  const geen = k('Geen tier', 99, null, 30000, { accessTier: undefined });
  const r = selecteerDekkingsmix({ kandidaten: [prem, publiek, verborgen, onbekend, geen, eigen, vrij], gat: 40000, config: PRO });

  check('Pro: alleen eigen en vrije records in de mix', r.mix.map((x) => x.naam).sort().join() === 'Pro-fonds,Vrij fonds', JSON.stringify(r.mix.map((x) => x.naam)));
  check('Pro: Premium-record (zelfs met niveau volledig) geweigerd als tier-niet-toegestaan', r.afgewezen.some((x) => x.sleutel === prem.sleutel && x.code === 'tier-niet-toegestaan'));
  check('Pro: publiek en verborgen tellen nooit mee', r.afgewezen.some((x) => x.sleutel === publiek.sleutel && x.code === 'niet-volledig-zichtbaar') && r.afgewezen.some((x) => x.sleutel === verborgen.sleutel && x.code === 'niet-volledig-zichtbaar'));
  check('onbekende of ontbrekende access_tier: geweigerd', r.afgewezen.some((x) => x.sleutel === onbekend.sleutel && x.code === 'tier-niet-toegestaan') && r.afgewezen.some((x) => x.sleutel === geen.sleutel && x.code === 'tier-niet-toegestaan'));
  check('Premium-record staat nergens in de uitvoer', !JSON.stringify({ mix: r.mix, reserve: r.reserve }).includes('Premium-fonds'));

  const p = selecteerDekkingsmix({ kandidaten: [prem, eigen, vrij], gat: 40000, config: PREMIUM });

  check('Premium: het Premium-record mag wel (en staat bovenaan door de score)', p.mix[0]?.naam === 'Premium-fonds');
  check('Premium: publiek en verborgen blijven ook voor Premium buiten de mix', selecteerDekkingsmix({ kandidaten: [publiek, verborgen], gat: 40000, config: PREMIUM }).mix.length === 0);

  const free = selecteerDekkingsmix({ kandidaten: [vrij], gat: 40000, config: tierConfigVoor('free') });

  check('Free: geen dekkingsplan', free.uitkomst === 'niet-beschikbaar' && free.mix.length === 0);
}

sectie('5. Randgevallen');
{
  gelijk('geen gat', selecteerDekkingsmix({ kandidaten: [k('X', 90, null, 1000)], gat: 0, config: PRO }).uitkomst, 'geen-gat');
  gelijk('gat is rommel', selecteerDekkingsmix({ kandidaten: [k('X', 90, null, 1000)], gat: 'veel', config: PRO }).uitkomst, 'geen-gat');
  gelijk('geen kandidaten', selecteerDekkingsmix({ kandidaten: [], gat: 40000, config: PRO }).uitkomst, 'geen-kandidaten');
  check('geen kandidaten: eerlijke melding', selecteerDekkingsmix({ kandidaten: [], gat: 40000, config: PRO }).melding === MELDING_TE_WEINIG_STERKE_MATCHES);
  check('undefined of null als kandidaten gooit niet', selecteerDekkingsmix({ kandidaten: undefined, gat: 40000, config: PRO }).uitkomst === 'geen-kandidaten' && selecteerDekkingsmix({ kandidaten: [null, undefined, {}], gat: 40000, config: PRO }).uitkomst === 'geen-kandidaten');

  const dubbel = k('Dubbel', 80, null, 30000);
  const r = selecteerDekkingsmix({ kandidaten: [dubbel, { ...dubbel }], gat: 40000, config: PRO });

  check('dezelfde sleutel tweemaal: één keer geteld', r.mix.length === 1 && r.afgewezen.some((x) => x.code === 'dubbel'));
  check('kandidaat zonder bruikbare bijdragegrenzen telt niet mee', selecteerDekkingsmix({ kandidaten: [k('Zonder', 90, null, null), k('Met', 80, null, 30000)], gat: 40000, config: PRO }).mix.map((x) => x.naam).join() === 'Met');
  check('minimum boven het gat telt niet mee', selecteerDekkingsmix({ kandidaten: [k('Te groot', 90, 100000, 200000), k('Past', 80, null, 30000)], gat: 40000, config: PRO }).mix.map((x) => x.naam).join() === 'Past');
  check('cofinancieringstekst wordt onzekerheid, geen rekensom', selecteerDekkingsmix({ kandidaten: [k('Cof', 90, null, 30000, { cofinanciering: '50% eigen bijdrage vereist' })], gat: 40000, config: PRO }).mix[0].onzekerheden.some((o) => /Cofinancieringseis/.test(o) && /50%/.test(o)));
  check('elke regel noemt dat het een schatting is', selecteerDekkingsmix({ kandidaten: [k('S', 90, null, 30000)], gat: 40000, config: PRO }).mix[0].onzekerheden[0].includes('schatting'));

  const veel = Array.from({ length: 30 }, (_, i) => k(`Klein ${String(i).padStart(2, '0')}`, 90 - i, null, 500));
  const v = selecteerDekkingsmix({ kandidaten: veel, gat: 100000, config: PRO });

  check('mixgrootte begrensd; daarna eerlijk onvoldoende', v.mix.length === PRO.maxRegelsInMix && v.uitkomst === 'onvoldoende-sterke-matches' && v.afgewezen.some((x) => x.code === 'mix-vol'));
}

sectie('6. Deterministisch en onafhankelijk van de invoervolgorde');
{
  const lijst = Array.from({ length: 12 }, (_, i) => k(`Fonds ${String(i).padStart(2, '0')}`, 95 - i * 2, i % 3 === 0 ? 1000 : null, 5000 + i * 3000));
  const basis = JSON.stringify(selecteerDekkingsmix({ kandidaten: lijst, gat: 60000, config: PREMIUM }));
  let rng = 12345;
  const rand = () => ((rng = (rng * 1664525 + 1013904223) % 4294967296) / 4294967296);

  for (let i = 0; i < 25; i++) {
    const schud = [...lijst].sort(() => rand() - 0.5);

    check(`schudden ${i}: identiek resultaat`, JSON.stringify(selecteerDekkingsmix({ kandidaten: schud, gat: 60000, config: PREMIUM })) === basis);
  }

  check('invoer wordt niet gemuteerd', JSON.stringify(lijst) === JSON.stringify(lijst.map((x) => ({ ...x }))) && lijst.every((x, i) => i === 0 || lijst[i - 1].score >= x.score));
}

sectie('7. Eigenschappen over 3000 willekeurige gevallen');
{
  let rng = 987654321;
  const rand = () => ((rng = (rng * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const pick = (a) => a[Math.floor(rand() * a.length)];
  let fouten = 0;

  for (let n = 0; n < 3000; n++) {
    const config = pick([PRO, PREMIUM]);
    const gat = Math.round(rand() * 400000) + (rand() < 0.1 ? 0 : 1000);
    const kand = Array.from({ length: Math.floor(rand() * 14) }, (_, i) =>
      k(`F${n}-${i}`, Math.round(rand() * 100), rand() < 0.4 ? Math.round(rand() * 60000) : null, rand() < 0.8 ? Math.round(rand() * 250000) : null, {
        accessTier: pick(['free', 'pro', 'premium', 'premium', 'x']),
        niveau: pick(['volledig', 'volledig', 'volledig', 'publiek', 'verborgen']),
        relevant: rand() < 0.85,
      }),
    );
    const r = selecteerDekkingsmix({ kandidaten: kand, gat, config });
    const sleutels = r.mix.map((x) => x.sleutel);
    const byKey = new Map(kand.map((x) => [x.sleutel, x]));
    const slecht = [];

    if (new Set(sleutels).size !== sleutels.length) slecht.push('dubbel');
    if (r.reserves.some((x) => sleutels.includes(x.sleutel))) slecht.push('reserve in mix');
    if (r.reserves.length > config.alternatieven) slecht.push('te veel alternatieven');
    if (r.reserves.length && r.som < gat) slecht.push('alternatieven zonder gedekt gat');
    if (r.mix.length > config.maxRegelsInMix) slecht.push('mix te groot');
    if (r.som !== som(r)) slecht.push('som klopt niet');
    if (r.uitkomst === 'doel-bereikt' && r.som < r.doelBedrag) slecht.push('doel niet gehaald maar bereikt');
    if (r.uitkomst === 'onvoldoende-sterke-matches' && r.som >= r.doelBedrag) slecht.push('onvoldoende maar toch genoeg');
    if (r.uitkomst === 'doel-bereikt' && r.mix.length > 1 && r.som - r.mix[r.mix.length - 1].bedrag >= r.doelBedrag) slecht.push('niet gestopt zodra het doel gehaald was');

    for (const x of [...r.mix, ...r.reserves]) {
      const bron = byKey.get(x.sleutel);

      if (!bron) { slecht.push('onbekende regel'); continue; }
      if (bron.niveau !== 'volledig' || !config.toegestaneAccessTiers.includes(bron.accessTier) || !bron.relevant || bron.score < config.minScore) slecht.push('niet toegestaan');
      if (!(x.bedrag > 0) || !Number.isInteger(x.bedrag)) slecht.push('bedrag ongeldig');
      if (bron.max !== null && x.bedrag > bron.max) slecht.push('boven maximum');
      if (bron.min !== null && x.bedrag < bron.min) slecht.push('onder minimum');
      if (x.bedrag > gat) slecht.push('bedrag boven het hele gat');
      if (x.bedrag > Math.max(Math.floor(gat / 3), bron.min ?? 0)) slecht.push('meer dan een derde van het gat');
    }

    if (slecht.length) {
      fouten += 1;
      if (fouten < 4) console.log('  FAIL voorbeeld', n, slecht.join(', '), JSON.stringify({ gat, config: config.tier }));
    }
  }

  check('geen enkele schending van de eigenschappen', fouten === 0, `${fouten} gevallen`);
}


sectie('Premium: de begroting sluitend maken met de beste en hoogste bijdragen (project € 700.000)');
{
  // 6 fondsen met een groot bereik (€ 50.000 tot € 450.000) en 10 met een klein bereik (€ 5.000 tot € 30.000), allemaal in dezelfde scoreband (80-89).
  const groot = Array.from({ length: 6 }, (_, i) => k(`Groot ${i}`, 82 + i % 3, 50000, 450000));
  const klein = Array.from({ length: 10 }, (_, i) => k(`Klein ${i}`, 88 - i % 3, 5000, 30000));
  const alles = [...klein, ...groot];
  const prem = selecteerDekkingsmix({ kandidaten: alles, gat: 700000, config: PREMIUM });
  const pro = selecteerDekkingsmix({ kandidaten: alles, gat: 700000, config: PRO });

  check('Premium: doelbedrag 160% = € 1.120.000', prem.doelBedrag === 1120000);
  check('Premium: de begroting sluit (minstens 100%), met de hoogste bijdragen voorop', prem.som >= 700000 && prem.mix.slice(0, 6).every((x) => x.naam.startsWith('Groot')), prem.som + ' ' + prem.mix.map((x) => x.naam).join());
  check('Premium: nooit meer dan 9 regels, plus drie alternatieven die niet meetellen', prem.mix.length <= PREMIUM.maxRegelsInMix && prem.reserves.length <= 3 && prem.som === som(prem));
  check('Pro: dezelfde kandidaten, maximaal 6 regels', pro.mix.length <= 6);

  // Scoreband gaat voor bijdrage: een veel betere match met een kleine bijdrage staat vóór een matige match met een grote bijdrage.
  const top = k('Topmatch klein', 95, 5000, 10000);
  const matig = k('Matige match groot', 62, 20000, 500000);
  const band = selecteerDekkingsmix({ kandidaten: [matig, top], gat: 100000, config: PREMIUM });

  check('Scoreband gaat voor bijdrage: topmatch eerst, matige match daarna', band.mix[0].naam === 'Topmatch klein' && band.mix[1].naam === 'Matige match groot');
  check('Premium met te weinig sterke matches: eerlijk onvoldoende, niets opvullen', selecteerDekkingsmix({ kandidaten: [k('Enige', 80, null, 10000)], gat: 700000, config: PREMIUM }).uitkomst === 'onvoldoende-sterke-matches');
  check('Rangschikking is deterministisch bij gelijke score en bijdrage (op naam)', selecteerDekkingsmix({ kandidaten: [k('B-fonds', 80, 5000, 10000), k('A-fonds', 80, 5000, 10000)], gat: 20000, config: PREMIUM }).mix[0].naam === 'A-fonds');

  // Het voorbeeld van een klein project: twee fondsen waar je € 70.000 kunt aanvragen mogen de andere passende fondsen niet verdringen.
  const klein2 = [k('Fonds 70a', 90, 20000, 70000), k('Fonds 70b', 89, 20000, 70000), k('Fonds 40', 80, 10000, 40000), k('Fonds 25', 78, 10000, 25000), k('Fonds 30', 76, 10000, 30000), k('Fonds 20', 74, 5000, 20000), k('Fonds 25b', 72, 10000, 25000)];
  const kl = selecteerDekkingsmix({ kandidaten: klein2, gat: 120000, config: PRO });

  check('Project € 120.000: twee fondsen van € 70.000 verdringen de rest niet (minstens 5 fondsen in het plan)', kl.mix.length >= 5 && kl.mix.every((x) => x.bedrag < 40000), kl.mix.map((x) => x.naam + ':' + x.bedrag).join(' '));
}

klaar('dekkingsmix');
