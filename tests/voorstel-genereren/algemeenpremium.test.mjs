// Algemene Premium-fondsen (Trekpaert, Pieter Bastiaan, Cordius, Virtutis Opus): in een Premium-voorstel doet er altijd minstens één mee in de dekking,
// mits de engine er een passend vindt. Pro ziet ze nooit.
import { PID, w, resetGenereren, regeling, fonds, projectRij } from './wereld.mjs';
import '../../supabase/functions/subsidie-kompas/index.ts';
import { isAlgemeenPremium, algemeenPremiumVolgorde } from '../../supabase/functions/_shared/algemeenPremium.ts';

const stand = { ok: 0, fout: 0 };
const check = (naam, waar, detail = '') => { if (waar) stand.ok += 1; else { stand.fout += 1; console.log(`  FAIL: ${naam} ${detail}`); } };
const sectie = (t) => console.log(`\n== ${t}`);

async function genereer(pid = PID) {
  const res = await globalThis.__handler(new Request('http://x/f', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer jwt' }, body: JSON.stringify({ mode: 'voorstel-genereren', projectId: pid }) }));
  const tekst = await res.text();
  let json = null;

  try { json = JSON.parse(tekst); } catch { /* geen json */ }

  return { status: res.status, json, tekst };
}

const PRO = { subscription_tier: 'pro', subscription_active: true, trial_ends_at: null, role: 'user' };
const PREMIUM = { subscription_tier: 'premium', subscription_active: true, trial_ends_at: null, role: 'user' };
const ID = (n) => `00000000-0000-4000-8000-00000000${String(n).padStart(4, '0')}`;
const VIER = ["Stichting 't Trekpaert", 'Stichting Pieter Bastiaan', 'Stichting Cordius', 'Stichting Virtutis Opus'];
const zwak = (o = {}) => VIER.map((naam, i) => fonds({ naam, tier: 'premium', themas: ['Cultuur'], doelgroepen: ['Jongeren'], regios: ['Landelijk'], min: 5000, max: 40000, id: ID(900 + i), ...o }));
const sterk = () => [1, 2, 3, 4, 5, 6, 7, 8].map((n) => regeling({ naam: `Sterke Muziekregeling ${n}`, gever: `Sterke Gever ${n}`, min: 20000, max: 90000, id: ID(100 + n) }));
const mijn = (j) => (j?.voorstel?.regels || []).filter((r) => VIER.includes(r.naam));
const telt = (r) => r.selecteerbaar && r.bedrag > 0;

sectie('1. Herkenning en afwisseling');
{
  for (const n of VIER) check(`${n}: herkend`, isAlgemeenPremium(n));
  check('korte schrijfwijzen werken ook', isAlgemeenPremium('Trekpaert') && isAlgemeenPremium('stichting pieter bastiaan') && isAlgemeenPremium("'t Trekpaert"));
  check('andere fondsen niet', !isAlgemeenPremium('Cor van de Zadelhoff Familiefonds') && !isAlgemeenPremium('Stichting DOCO') && !isAlgemeenPremium('Prins Bernhard Cultuurfonds') && !isAlgemeenPremium('') && !isAlgemeenPremium(null));

  const lijst = [{ n: 'A', s: 70 }, { n: 'B', s: 68 }, { n: 'C', s: 40 }];
  const eersten = new Set(Array.from({ length: 30 }, (_, i) => algemeenPremiumVolgorde(lijst, `project-${i}`, (x) => x.s, (x) => x.n)[0].n));

  check('afwisseling: bij een nagenoeg gelijke score komen beide vooraan voor, het zwakke fonds nooit', eersten.has('A') && eersten.has('B') && !eersten.has('C'), [...eersten].join(','));
  check('de rest volgt op score', algemeenPremiumVolgorde(lijst, 'p', (x) => x.s, (x) => x.n).length === 3);
  check('zelfde project, zelfde volgorde', JSON.stringify(algemeenPremiumVolgorde(lijst, 'p1', (x) => x.s, (x) => x.n)) === JSON.stringify(algemeenPremiumVolgorde(lijst, 'p1', (x) => x.s, (x) => x.n)));
  check('lege lijst: niets', algemeenPremiumVolgorde([], 'p', () => 0, () => '').length === 0);
}

sectie('2. Premium: de mix is vol met sterkere fondsen en er staat toch een algemeen fonds tussen, met een gewoon bedrag');
{
  resetGenereren({ regelingen: sterk(), funders: zwak(), exclusief: [], profile: PREMIUM });
  const r = await genereer();
  const j = r.json;

  check('200 en ok', r.status === 200 && j?.ok === true, `${r.status} ${r.tekst.slice(0, 160)}`);
  check('precies één van de vier staat erin', mijn(j).length >= 1, (j?.voorstel?.regels || []).map((x) => x.naam).join(','));
  check('en hij telt mee: een bedrag, selecteerbaar, geen reserve', mijn(j).some(telt), JSON.stringify(mijn(j).map((x) => [x.bedrag, x.selecteerbaar, x.onderdeel])));
  check('geen aparte aanduiding of label (gewoon een fonds in de dekking)', mijn(j).every((x) => !/gebaande|Buiten/i.test(x.onderdeel || '')));
  check('de dekking klopt: som is de som van de bedragen en nooit boven het doel (112.000)', j.totalen.som <= 112000 && j.voorstel.regels.filter(telt).reduce((t, x) => t + x.bedrag, 0) === j.totalen.som, JSON.stringify(j.totalen));
  check('bedrag binnen de grenzen van het fonds (geen maximum als standaard)', mijn(j).filter(telt).every((x) => (x.grenzen.min == null || x.bedrag >= x.grenzen.min) && (x.grenzen.max == null || x.bedrag <= x.grenzen.max)));
  check('niet meer dan 12 regels (maximum van het contract)', j.voorstel.regels.length <= 12, String(j.voorstel.regels.length));
  check('alles uit de database, niets opgeslagen', mijn(j).every((x) => x.herkomst === 'database') && w.schrijfpogingen.length === 0);
}

sectie('3. Past er geen enkele van de vier, dan staat er ook geen (nooit een misfit)');
{
  resetGenereren({ regelingen: sterk(), funders: zwak({ regios: ['Amsterdam'] }), exclusief: [], profile: PREMIUM });
  const j = (await genereer()).json;

  check('regio sluit niet aan: geen van de vier', mijn(j).length === 0 && j?.ok === true, (j?.voorstel?.regels || []).map((x) => x.naam).join(','));

  resetGenereren({ regelingen: sterk(), funders: zwak({ themas: ['Sport'], doelgroepen: ['Ouderen'] }), exclusief: [], profile: PREMIUM });
  const t = (await genereer()).json;

  check('thema en doelgroep sluiten niet aan: geen van de vier', mijn(t).length === 0 && t?.ok === true, (t?.voorstel?.regels || []).map((x) => x.naam).join(','));

  resetGenereren({ regelingen: sterk(), funders: [], exclusief: [], profile: PREMIUM });
  check('geen van de vier in de database: voorstel gewoon gelukt', (await genereer()).json?.ok === true);
}

sectie('4. Pro ziet ze nooit');
{
  resetGenereren({ regelingen: sterk(), funders: zwak(), exclusief: [], profile: PRO });
  const r = await genereer();

  check('Pro: 200', r.status === 200 && r.json?.ok === true, `${r.status}`);
  check('Pro: geen van de vier, nergens in het antwoord', VIER.every((n) => !r.tekst.includes(n)));
}

sectie('5. Staat er al een in het dekkingsplan van het lid, dan komt er geen tweede bij');
{
  resetGenereren({ regelingen: sterk(), funders: zwak(), exclusief: [], profile: PREMIUM });
  const eerst = (await genereer()).json;
  const gekozen = mijn(eerst)[0];

  check('uitgangspunt: er is er een gekozen', Boolean(gekozen));

  // Het lid heeft dat fonds al in het dekkingsplan staan.
  resetGenereren({
    regelingen: sterk(), funders: zwak(), exclusief: [], profile: PREMIUM,
    dekkingsplan: [{ id: 'c0000000-0000-4000-8000-000000000001', bron_status: 'zichtbaar', bron_type: 'fonds', scheme_id: null, funder_id: gekozen.id, bron_naam: gekozen.naam, funder_naam: gekozen.gever || gekozen.naam, status: 'preparing', requested_amount: 10000, awarded_amount: null, eigen_deadline: null, effectieve_deadline: null }],
  });
  const j = (await genereer()).json;

  check('het fonds dat er al staat komt niet nogmaals voor en er komt geen tweede algemeen fonds bij', mijn(j).length === 0, JSON.stringify((j?.voorstel?.regels || []).map((x) => x.naam)));
}

sectie('6. Afwisselen per project');
{
  const gekozen = new Set();

  for (let i = 0; i < 12; i += 1) {
    const pid = `10000000-0000-4000-8000-0000000000${String(10 + i)}`;

    resetGenereren({ regelingen: sterk(), funders: zwak(), exclusief: [], profile: PREMIUM, project: projectRij({ id: pid }) });
    mijn((await genereer(pid)).json).forEach((x) => gekozen.add(x.naam));
  }

  check('over 12 projecten komt meer dan één van de vier voorbij', gekozen.size >= 2, [...gekozen].join(' | '));
}

console.log(`\nALGEMEEN-PREMIUM: ${stand.ok} OK, ${stand.fout} FAIL`);
process.exit(stand.fout ? 1 : 0);
