// Baseline Fase 4 -> Fase 5: bewijs dat de matching/ranking/prompts niet inhoudelijk veranderen.
//   node tests/fase5/baseline.mjs record   (leg de uitkomst van de Fase 4-code vast; alleen eenmalig, vóór Fase 5)
//   node tests/fase5/baseline.mjs compare  (vergelijk de huidige code met die vastgelegde uitkomst)
// Elke vaste fondsenscan-prompt draait door de ECHTE handler (zie harness5.mjs). Vastgelegd wordt per scenario:
// HTTP-status, antwoord, bronnen, de volgorde van de kandidaten in de modelinput en een sha256 van elk
// systeembericht. Bij 'compare' mag er uitsluitend één extra systeembericht bij zijn gekomen: het blok
// "FINANCIERING VAN DIT PROJECT" (alleen bij een project met Projectfinanciering-regels).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as T from './harness5.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const BESTAND = path.join(here, 'baseline', 'fase4-matching-baseline.json');
const modus = process.argv[2] || 'compare';

const bron = modus === 'record' ? T.fase4Bron() : T.FUNCTIE_PAD;

if (modus === 'record' && T.sha(bron) !== T.FASE4_SHA256) {
  console.error('De Fase 4-bron wijkt af van de verwachte sha256; baseline niet vastgelegd.');
  process.exit(2);
}

const { handler } = await T.laadModule(bron, `baseline-${modus}`);

const SCENARIOS = [
  { id: 'pro-scan-project', tier: 'pro', project: true, tekst: 'Zoek passende fondsen voor dit project.' },
  { id: 'premium-scan-project', tier: 'premium', project: true, tekst: 'Zoek passende fondsen voor dit project.' },
  { id: 'pro-scan-met-funding', tier: 'pro', project: true, funding: true, tekst: 'Zoek passende fondsen voor dit project.' },
  { id: 'premium-scan-en-toevoegen', tier: 'premium', project: true, funding: true, tekst: 'Scan passende fondsen en zet de kansrijke in mijn dekkingsplan.' },
  { id: 'free-scan-zonder-project', tier: 'free', project: false, tekst: 'Welke fondsen passen bij ons project over cultuur en dans voor jongeren in Rotterdam?' },
  { id: 'pro-algemeen-advies-zonder-project', tier: 'pro', project: false, tekst: 'Welke fondsen bestaan er voor cultuur?' },
  { id: 'pro-vervolgvraag-met-funding', tier: 'pro', project: true, funding: true, tekst: 'Wat moet ik als eerste doen?' },
  { id: 'pro-vervolgvraag-zonder-funding', tier: 'pro', project: true, tekst: 'Hoeveel financiering ontbreekt nog?' },
  { id: 'pro-stream-scan', tier: 'pro', project: true, funding: true, stream: true, tekst: 'Zoek passende fondsen voor dit project.' },
];

async function draai(sc) {
  T.resetUuid();
  T.resetWorld5();
  T.instellingen.premiumIsExclusief = true;

  const fonds = T.fondsenDatabase();

  T.world.regelingen = fonds.regelingen;
  T.world.funders = fonds.funders;
  T.world.fundersVolledig = fonds.funders;
  T.zetGebruiker(T.GEBRUIKER_A, sc.tier);
  T.world.modelTekst = 'Antwoord van het model (baseline).';

  let programId = null;
  let conversationId = null;

  if (sc.project) {
    const p = T.maakProject();

    programId = p.id;
    conversationId = T.maakGesprek({ programId }).id;

    if (sc.funding) {
      T.maakFundingRegel({ programId, schemeId: fonds.R.jongeren.regeling_id, status: 'submitted', requested_amount: 20000 });
      T.maakFundingRegel({ programId, funderId: fonds.F.podium.funder_id });
      T.maakFundingRegel({ programId, schemeId: fonds.R.dans.regeling_id, status: 'awarded', awarded_amount: 25000 });
    }
  }

  const r = await T.vraag5(handler, {
    messages: [{ role: 'user', content: sc.tekst }],
    activeProgramId: sc.tier === 'free' ? null : programId,
    conversationId: sc.tier === 'free' ? null : conversationId,
    stream: Boolean(sc.stream),
  });

  const namen = [...fonds.regelingen.map((x) => x.naam), ...fonds.funders.map((x) => x.funder_naam)].filter((n) => !n.startsWith('Irrelevant'));
  const developer = r.developer.filter((t) => !t.startsWith(T.FUNDING_KOP));
  const alleTekst = developer.join('\n=====\n');
  const kandidaten = namen
    .map((n) => ({ n, i: alleTekst.indexOf(n) }))
    .filter((x) => x.i >= 0)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.n);

  return {
    status: r.status,
    antwoord: r.json?.answer ?? null,
    bronnen: r.json?.sources ?? null,
    aantalSysteemberichten: developer.length,
    systeemSha: developer.map((t) => T.sha(t)),
    gebruikersSha: r.input.filter((m) => m.role === 'user').map((m) => T.sha(m.content)),
    kandidaten,
    metFundingBlok: r.developer.length - developer.length,
  };
}

const uitkomst = {};

for (const sc of SCENARIOS) {
  uitkomst[sc.id] = await draai(sc);
}

if (modus === 'record') {
  fs.mkdirSync(path.dirname(BESTAND), { recursive: true });
  fs.writeFileSync(BESTAND, JSON.stringify({ bron: 'Edge Function na Fase 4', commit: T.FASE4_COMMIT, sha256: T.FASE4_SHA256, scenarios: uitkomst }, null, 2) + '\n');
  console.log(`Baseline vastgelegd: ${Object.keys(uitkomst).length} scenario's -> ${path.relative(process.cwd(), BESTAND)}`);
  process.exit(0);
}

const basis = JSON.parse(fs.readFileSync(BESTAND, 'utf8')).scenarios;
let ok = 0;
let fout = 0;
const check = (naam, v, detail = '') => { if (v) ok += 1; else { fout += 1; console.log('  FAIL:', naam, detail); } };

for (const sc of SCENARIOS) {
  const nu = uitkomst[sc.id];
  const was = basis[sc.id];

  check(`${sc.id}: status gelijk`, nu.status === was.status);
  check(`${sc.id}: antwoord gelijk`, nu.antwoord === was.antwoord);
  check(`${sc.id}: bronnen gelijk`, JSON.stringify(nu.bronnen) === JSON.stringify(was.bronnen));
  check(`${sc.id}: kandidaten (volgorde) gelijk`, JSON.stringify(nu.kandidaten) === JSON.stringify(was.kandidaten), `${nu.kandidaten} <> ${was.kandidaten}`);
  check(`${sc.id}: elk systeembericht byte-identiek (alleen het fundingblok mag erbij)`, JSON.stringify(nu.systeemSha) === JSON.stringify(was.systeemSha));
  check(`${sc.id}: gebruikersberichten gelijk`, JSON.stringify(nu.gebruikersSha) === JSON.stringify(was.gebruikersSha));
  check(`${sc.id}: fundingblok alleen bij project mét financieringsregels`, nu.metFundingBlok === (sc.project && sc.funding && sc.tier !== 'free' ? 1 : 0), `blokken: ${nu.metFundingBlok}`);
}

console.log(`\nBASELINE-VERGELIJKING: ${ok} OK, ${fout} FAIL`);
process.exit(fout ? 1 : 0);
