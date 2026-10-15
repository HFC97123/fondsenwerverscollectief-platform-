// Fase 5, server: financieringscontext in de chat, focusFundingId, kansrijke financiers, fail-safe, isolatie, downgrade.
//   node tests/fase5/server.test.mjs
// Draait de ECHTE Deno.serve-handler (harness5.mjs). Er is geen netwerk en geen echte database/OpenAI.
import * as T from './harness5.mjs';
import { berekenDekking, regelUitRpc } from '../../src/features/kompas-app/financiering/dekkingsplan.js';

T.instellingen.premiumIsExclusief = true;

let ok = 0;
let fout = 0;
const check = (naam, v, detail = '') => { if (v) ok += 1; else { fout += 1; process.stdout.write(`  FAIL: ${naam} ${detail}\n`); } };
const sectie = (t) => process.stdout.write(`\n== ${t}\n`);

const { handler } = await T.laadModule(T.FUNCTIE_PAD, 'fase5-server');
const SCAN = 'Zoek passende fondsen voor dit project.';
const msg = (c) => [{ role: 'user', content: c }];

// Standaardwereld: Hushu House 2027 met 4 regels (waarvan 1 Premium-exclusief), gebruiker A.
function wereld(tier = 'pro', { metRegels = true } = {}) {
  T.resetUuid();
  T.resetWorld5();
  const f = T.fondsenDatabase();

  T.world.regelingen = f.regelingen;
  T.world.funders = f.funders;
  T.world.fundersVolledig = f.funders;
  T.zetGebruiker(T.GEBRUIKER_A, tier);

  const p = T.maakProject();
  const c = T.maakGesprek({ programId: p.id });
  const regels = {};

  if (metRegels) {
    regels.jongeren = T.maakFundingRegel({ programId: p.id, schemeId: f.R.jongeren.regeling_id, status: 'submitted', requested_amount: 20000 });
    regels.podium = T.maakFundingRegel({ programId: p.id, funderId: f.F.podium.funder_id });
    regels.dans = T.maakFundingRegel({ programId: p.id, schemeId: f.R.dans.regeling_id, status: 'awarded', awarded_amount: 25000 });
    regels.premium = T.maakFundingRegel({ programId: p.id, schemeId: f.R.premium.regeling_id, requested_amount: 7000, eigen_deadline: '2026-11-05' });
  }

  return { f, p, c, regels };
}

// De harness telt fixture-urls op (voorbeeld.test/37): voor vergelijkingen tussen twee werelden normaliseren.
const norm = (t) => String(t).replace(/(voorbeeld|fonds)\.test\/\d+/g, '$1.test/N');
const shaLijst = (lijst) => JSON.stringify(lijst.map((t) => T.sha(norm(t))));
const vraagMet = (w, tekst, extra = {}) => T.vraag5(handler, { messages: msg(tekst), activeProgramId: w.p.id, conversationId: w.c.id, ...extra });

// ---------------------------------------------------------------------------
sectie('1. buildProjectFundingContext: inhoud en compactheid');
{
  const w = wereld('premium');
  const r = await vraagMet(w, 'Wat moet ik als eerste doen?');
  const b = T.fundingBlok(r);

  check('1a: HTTP 200 en een fundingblok', r.status === 200 && b.startsWith(T.FUNDING_KOP));
  check('1b: begroting, toegekend, aangevraagd, overige dekking en nog te financieren kloppen', /Totale begroting: € 100\.000/.test(b) && /Toegekend: € 25\.000/.test(b) && /Aangevraagd: € 20\.000/.test(b) && /Overige dekking \(eigen bijdrage\): € 10\.000/.test(b) && /Nog te financieren: € 45\.000/.test(b), b.split('\n').slice(1, 6).join('|'));
  check('1c: elke regel met status en bedrag', /Rotterdams Jongerencultuurfonds[^\n]*Aangevraagd[^\n]*gevraagd € 20\.000/.test(b) && /Dansimpuls Nederland[^\n]*Toegekend[^\n]*toegekend € 25\.000/.test(b) && /Fonds Podiumkunsten — Interessant/.test(b));
  check('1d: Premium-gebruiker ziet de Premium-bron bij naam', /Talentprogramma Premium/.test(b));
  check('1e: live deadline (regeling) en eigen deadline voorrang', /Rotterdams Jongerencultuurfonds[^\n]*deadline 12 november 2026/.test(b) && /eigen deadline 5 november 2026/.test(b));
  check('1f: eerstvolgende deadline = de eigen deadline van 5 november', /Eerstvolgende deadline: Talentprogramma Premium[^\n]*5 november 2026/.test(b));
  check('1g: compact: geen database-dump (geen website, missie, aanvraagcriteria, ids)', !/https?:\/\//.test(b) && !/Missie|Voorwaarden van|regeling_id|funder_id|[0-9a-f]{8}-[0-9a-f]{4}-/.test(b) && b.length < 3000, `len ${b.length}`);
  check('1h: regels voor het model: geen schrijfacties, alleen dit project', /nooit dat je iets hebt toegevoegd of opgeslagen/.test(b) && /geen overzicht over andere projecten/.test(b));
  check('1i: het blok staat na het projectblok en vóór de gespreksberichten', (() => { const i = r.developer.findIndex((t) => t.startsWith('ACTIEF PROJECT')); const j = r.developer.findIndex((t) => t.startsWith(T.FUNDING_KOP)); return i >= 0 && j === i + 1; })());
}
{
  const w = wereld('pro', { metRegels: false });
  const r = await vraagMet(w, 'Hoeveel financiering ontbreekt nog?');

  check('1j: project zonder financieringsregels -> geen blok (gesprek ongewijzigd)', r.status === 200 && !T.fundingBlok(r));
}

// ---------------------------------------------------------------------------
sectie('2. Pariteit rekenmodule: server = UI-module (dekkingsplan.js)');
{
  let gelijk = 0;
  let totaal = 0;
  const statussen = ['interesting', 'preparing', 'submitted', 'awarded', 'rejected', 'withdrawn'];

  for (let i = 0; i < 40; i += 1) {
    const w = wereld('premium', { metRegels: false });
    const aantal = (i % 6) + 1;

    w.p.budget_total = [0, 50000, 100000, 12345][i % 4];
    w.p.own_contribution = [0, 5000, 20000][i % 3];

    for (let k = 0; k < aantal; k += 1) {
      T.maakFundingRegel({
        programId: w.p.id,
        funderId: w.f.funders[k % w.f.funders.length].funder_id,
        status: statussen[(i + k) % statussen.length],
        requested_amount: [null, 1000, 15000, 40000][(i + k) % 4],
        awarded_amount: [null, 500, 25000][(i * 3 + k) % 3],
      });
    }

    // Een regeling per extra rij bestaat niet in de fixtures; maximaal 2 funders: zo houden we unieke bronnen.
    const unieke = new Set();

    T.db.subsidie_kompas_program_funding = T.db.subsidie_kompas_program_funding.filter((r) => (unieke.has(r.funder_id) ? false : (unieke.add(r.funder_id), true)));
    T.db.subsidie_kompas_program_funding.length;
    const r = await vraagMet(w, 'Hoeveel financiering ontbreekt nog?');
    const b = T.fundingBlok(r);
    const rpc = T.emuleerDekkingsplan(T.GEBRUIKER_A.id, w.p.id).data.map(regelUitRpc);
    const ui = berekenDekking({ begroting: w.p.budget_total, regels: rpc, overige: w.p.own_contribution });
    const getal = (re) => { const m = re.exec(b); return m ? Number(m[1].replace(/\./g, '')) : null; };

    totaal += 1;

    if (b && getal(/Toegekend: € ([\d.]+)/) === ui.toegekend && getal(/Aangevraagd: € ([\d.]+)/) === ui.aangevraagd && getal(/Overige dekking[^:]*: € ([\d.]+)/) === ui.overige && (ui.begroting > 0 ? getal(/Nog te financieren: € ([\d.]+)/) === ui.nogNodig : /Totale begroting: niet ingevuld/.test(b))) gelijk += 1;
    else process.stdout.write(`  pariteit mismatch bij ${i}: ${JSON.stringify(ui)} <> ${b.split('\n').slice(1, 6).join('|')}\n`);
  }

  check(`2a: ${totaal} willekeurige financieringsstanden geven server en UI dezelfde bedragen`, gelijk === totaal, `${gelijk}/${totaal}`);
}

// ---------------------------------------------------------------------------
sectie('3. Fail-safe: een fout in de financiering blokkeert of verandert de chat nooit');
{
  const zonder = wereld('pro', { metRegels: false });
  const rZonder = await vraagMet(zonder, SCAN);

  const gevallen = [
    ['RPC geeft een foutcode', (w) => { T.world.dekkingsplanFout = '57014'; }],
    ['RPC bestaat niet (migratie niet toegepast)', (w) => { T.world.dekkingsplanFout = 'PGRST202'; }],
    ['SUPABASE_ANON_KEY ontbreekt', (w) => { T.world.env = { SUPABASE_ANON_KEY: '' }; }],
  ];

  for (const [naam, zet] of gevallen) {
    const w = wereld('pro');

    zet(w);
    T.fouten.length = 0;
    const r = await vraagMet(w, SCAN);

    check(`3: ${naam}: HTTP 200`, r.status === 200);
    check(`3: ${naam}: geen fundingblok`, !T.fundingBlok(r));
    check(`3: ${naam}: matching-input identiek aan chat zonder funding`, shaLijst(r.developer) === shaLijst(rZonder.developer));
    check(`3: ${naam}: antwoord gelijk`, r.json.answer === rZonder.json.answer);
    check(`3: ${naam}: alleen een logcode, geen inhoud`, T.fouten.every((l) => /^\[subsidie-kompas\] [a-z_]+$/.test(l)) && T.fouten.some((l) => /fundingcontext/.test(l)), T.fouten.join('|'));
    check(`3: ${naam}: kansrijke financiers komen er nog steeds (matching onafhankelijk)`, Array.isArray(r.json.fondsMatches?.items) && r.json.fondsMatches.items.length > 0);
  }
}
{
  // De RPC antwoordt nooit (hangt): het verzoek wordt na de tijdslimiet toch beantwoord.
  const w = wereld('pro');
  const t0 = Date.now();

  T.world.dekkingsplanHang = true;

  const r = await vraagMet(w, 'Wat moet ik als eerste doen?');

  check('3x: een RPC die blijft hangen blokkeert de chat niet langer dan de tijdslimiet (±4s)', r.status === 200 && !T.fundingBlok(r) && Date.now() - t0 >= 3500 && Date.now() - t0 < 9000, `${Date.now() - t0}ms`);
}
{
  // Rommel in de rijen (ongeldige datums/bedragen/statussen) mag niet crashen.
  const w = wereld('pro', { metRegels: false });

  T.maakFundingRegel({ programId: w.p.id, funderId: w.f.F.podium.funder_id, status: 'onzin', requested_amount: -5, eigen_deadline: '2026-13-45' });
  const r = await vraagMet(w, 'Wat moet ik als eerste doen?');

  check('3y: ongeldige datum/bedrag/status geeft nog steeds een antwoord', r.status === 200 && /Interessant/.test(T.fundingBlok(r)) && !/NaN|Invalid|undefined/.test(T.fundingBlok(r)));
}

// ---------------------------------------------------------------------------
sectie('4. conversation.active_program_id is leidend; de browser kan het project niet verschuiven');
{
  const w = wereld('pro');
  const projectB = T.maakProject({ naam: 'Ander project van A', budget_total: 5000 });

  T.maakFundingRegel({ programId: projectB.id, funderId: w.f.F.jeugd.funder_id, status: 'submitted', requested_amount: 3333 });

  const goed = await vraagMet(w, 'Wat moet ik als eerste doen?');
  const bGoed = T.fundingBlok(goed);

  check('4a: gesprek bij project A + browser A -> alleen de regels van A', /Hushu House 2027/.test(bGoed) && !/Jeugd en Talent Fonds/.test(bGoed) && !/3\.333/.test(bGoed));

  T.fouten.length = 0;
  const afwijkend = await T.vraag5(handler, { messages: msg('Wat moet ik als eerste doen?'), activeProgramId: projectB.id, conversationId: w.c.id });

  check('4b: browser stuurt project B bij een gesprek van project A -> GEEN fundingcontext (ook niet van A of B)', !T.fundingBlok(afwijkend) && !/3\.333|20\.000|25\.000/.test(afwijkend.developer.join('\n')));
  check('4c: afwijking wordt gelogd (alleen code)', T.fouten.includes('[subsidie-kompas] fundingcontext_project_wijkt_af_van_gesprek'));
  check('4d: geen kansrijke-financiers-lijst bij afwijkend project', !afwijkend.json.fondsMatches);

  const nieuw = await T.vraag5(handler, { messages: msg('Wat moet ik als eerste doen?'), activeProgramId: w.p.id, conversationId: null });

  check('4e: nieuw gesprek (nog geen gesprek-id): het gevalideerde projectkeuze is de startwaarde', /Hushu House 2027/.test(T.fundingBlok(nieuw)));

  const zonderProject = await T.vraag5(handler, { messages: msg('Wat moet ik als eerste doen?'), activeProgramId: null, conversationId: w.c.id });

  check('4f: geen actief project -> geen fundingcontext', !T.fundingBlok(zonderProject));
}

// ---------------------------------------------------------------------------
sectie('5. focusFundingId: server-side gevalideerd');
{
  const w = wereld('pro');
  const andereProject = T.maakProject({ naam: 'Tweede project A' });
  const regelAnder = T.maakFundingRegel({ programId: andereProject.id, funderId: w.f.F.jeugd.funder_id });

  const geldig = await vraagMet(w, 'Help mij met deze aanvraag.', { focusFundingId: w.regels.jongeren.id });
  const bGeldig = T.fundingBlok(geldig);

  check('5a: geldige focusregel van dit project wordt als FOCUS opgenomen', /FOCUS:[^\n]*Rotterdams Jongerencultuurfonds/.test(bGeldig));

  const gemaskeerd = await vraagMet(w, 'Help mij met deze aanvraag.', { focusFundingId: w.regels.premium.id });

  check('5b: focus op een regel met verborgen bron toont alleen eigen gegevens, geen naam', /FOCUS:[^\n]*niet zichtbaar/.test(T.fundingBlok(gemaskeerd)) && !/Talentprogramma Premium|Exclusief Talentfonds/.test(gemaskeerd.developer.join('\n')));

  // "Bespreek met Subsidiekompas" per regel: bronstatus (server) en openstaande vervolgstappen in de FOCUS-context.
  {
    const regel = w.regels.jongeren;

    T.db.subsidie_kompas_bron_controles.push({ user_id: T.GEBRUIKER_A.id, program_id: w.p.id, record_type: 'regeling', record_id: regel.scheme_id, status: 'gecontroleerd', gecontroleerd_op: new Date().toISOString(), reden: null });
    T.db.subsidie_kompas_program_actions.push(
      { id: T.uuid(), user_id: T.GEBRUIKER_A.id, program_id: w.p.id, funding_id: regel.id, title: 'Voorwaarden van Rotterdams Jongerencultuurfonds vergelijken', due_date: '2026-10-25', status: 'todo', priority: 'high' },
      { id: T.uuid(), user_id: T.GEBRUIKER_A.id, program_id: w.p.id, funding_id: regel.id, title: 'Afgeronde stap', due_date: '2026-10-20', status: 'done', priority: 'normal' },
    );

    const extra = await vraagMet(w, 'Help mij met deze aanvraag.', { focusFundingId: regel.id });
    const b = T.fundingBlok(extra);

    check('5f: FOCUS bevat de bronstatus uit de server-broncontrole en benoemt dat het geen beoordeling van geschiktheid is', /BRONSTATUS: de bron is gecontroleerd op/.test(b) && /Zeg nooit dat het lid in aanmerking komt/.test(b));
    check('5g: FOCUS noemt openstaande vervolgstappen als eigen streefdata, niet de afgeronde', /OPENSTAANDE VERVOLGSTAPPEN[^\n]*Voorwaarden van Rotterdams Jongerencultuurfonds vergelijken \(streefdatum 2026-10-25\)/.test(b) && !/Afgeronde stap/.test(b));

    const elders = await vraagMet(w, 'Help mij met deze aanvraag.', { focusFundingId: w.regels.dans.id });

    check('5h: een andere regel krijgt niet de bronstatus of stappen van deze regel', !/gecontroleerd op/.test(T.fundingBlok(elders)) && !/Voorwaarden van Rotterdams Jongerencultuurfonds vergelijken/.test(T.fundingBlok(elders)));
    check('5i: zonder focusregel geen BRONSTATUS in de context', !/BRONSTATUS/.test(T.fundingBlok(await vraagMet(w, 'Help mij met deze aanvraag.'))));
  }

  for (const [naam, id] of [
    ['regel van een ander project van dezelfde gebruiker', regelAnder.id],
    ['een onbekend uuid', '00000000-0000-4000-8000-ffffffffffff'],
    ['geen uuid', 'DROP TABLE x; --'],
    ['een object', { id: 1 }],
  ]) {
    T.fouten.length = 0;
    const r = await vraagMet(w, 'Help mij met deze aanvraag.', { focusFundingId: id });

    check(`5c: ${naam}: genegeerd (geen FOCUS), blok blijft`, r.status === 200 && !/FOCUS:/.test(T.fundingBlok(r)) && T.fundingBlok(r).startsWith(T.FUNDING_KOP));
    check(`5c: ${naam}: gelogd als focus_funding_ongeldig`, T.fouten.includes('[subsidie-kompas] focus_funding_ongeldig'));
  }

  // Regel van een andere gebruiker (B) in een project van B.
  const projB = T.maakProject({ user: T.GEBRUIKER_B.id, naam: 'Project van B' });
  const regelB = T.maakFundingRegel({ user: T.GEBRUIKER_B.id, programId: projB.id, funderId: w.f.F.podium.funder_id, requested_amount: 99999 });
  const r = await vraagMet(w, 'Help mij met deze aanvraag.', { focusFundingId: regelB.id });

  check('5d: focusFundingId van gebruiker B: niets van B in de prompt', !/99\.999|Project van B/.test(r.developer.join('\n')) && !/FOCUS:/.test(T.fundingBlok(r)));
  check('5e: focus zonder fundingblok (gesprek hoort niet bij project) wordt ook genegeerd', (await T.vraag5(handler, { messages: msg('x'), activeProgramId: andereProject.id, conversationId: w.c.id, focusFundingId: regelAnder.id })).developer.every((t) => !/FOCUS:/.test(t)));
}

// ---------------------------------------------------------------------------
sectie('6. Cross-user: gebruiker B kan niets van A ophalen');
{
  const w = wereld('pro');

  T.zetGebruiker(T.GEBRUIKER_B, 'premium', T.JWT.B);
  T.db.subsidie_kompas_programs.push({ ...T.maakProject({ user: T.GEBRUIKER_B.id, naam: 'Project van B' }) });
  const projB = T.db.subsidie_kompas_programs.find((p) => p.name === 'Project van B' && p.user_id === T.GEBRUIKER_B.id);
  const gesprekB = T.maakGesprek({ user: T.GEBRUIKER_B.id, programId: projB.id });

  T.maakFundingRegel({ user: T.GEBRUIKER_B.id, programId: projB.id, funderId: w.f.F.podium.funder_id, requested_amount: 88888 });

  const cases = [
    ['gesprek van A met project van B', { activeProgramId: projB.id, conversationId: w.c.id }],
    ['gesprek van A met project van A', { activeProgramId: w.p.id, conversationId: w.c.id }],
    ['gesprek van B met project van A', { activeProgramId: w.p.id, conversationId: gesprekB.id }],
    ['project van A, geen gesprek', { activeProgramId: w.p.id, conversationId: null }],
  ];

  for (const [naam, extra] of cases) {
    T.fouten.length = 0;
    const r = await T.vraag5(handler, { messages: msg(SCAN), token: T.JWT.B, ...extra });
    const alles = r.developer.join('\n') + JSON.stringify(r.json || {});

    check(`6: B met ${naam}: niets van A (project, regels, bedragen, namen) in prompt of antwoord`, !/Hushu House 2027/.test(alles) && !/25\.000|20\.000/.test(alles) && !T.fundingBlok(r) , naam);
    check(`6: B met ${naam}: geen kansrijke financiers voor een project dat niet van B is`, !r.json?.fondsMatches || r.json.fondsMatches.projectId === projB.id);
  }

  const eigen = await T.vraag5(handler, { messages: msg('Wat moet ik als eerste doen?'), token: T.JWT.B, activeProgramId: projB.id, conversationId: gesprekB.id });

  check('6e: B met zijn eigen gesprek en project: wél zijn eigen stand en alleen die', /Project van B/.test(T.fundingBlok(eigen)) && /88\.888/.test(T.fundingBlok(eigen)) && !/Hushu/.test(eigen.developer.join('\n')));
  check('6f: de RPC werd aangeroepen met de JWT van de gebruiker (uid B), nooit met de service-role', T.world.rpcLog.filter((l) => l.naam === 'kompas_dekkingsplan').every((l) => l.uid === T.GEBRUIKER_B.id));
}
{
  // Een anoniem verzoek (geen JWT) krijgt nooit een fundingcontext.
  const w = wereld('pro');
  const r = await T.vraag5(handler, { messages: msg('Wat moet ik als eerste doen?'), token: null, activeProgramId: w.p.id, conversationId: w.c.id });

  check('6g: zonder JWT: geen project, geen fundingcontext', r.status === 200 && !T.fundingBlok(r) && !/Hushu/.test(r.developer.join('\n')));
}

// ---------------------------------------------------------------------------
sectie('7. Entitlement in de chatcontext + downgrade');
{
  const w = wereld('premium');
  const premium = await vraagMet(w, 'Welke fondsen staan in mijn dekkingsplan?');

  check('7a: Premium: de Premium-bron staat met naam in de context', /Talentprogramma Premium/.test(T.fundingBlok(premium)));

  // Downgrade naar Pro: dezelfde database, dezelfde regels.
  T.world.profile = T.profiel('pro');
  T.world.modelTekst = 'Uw dekkingsplan bevat onder andere Talentprogramma Premium van Exclusief Talentfonds en Rotterdams Jongerencultuurfonds.';
  const pro = await vraagMet(w, 'Welke fondsen staan in mijn dekkingsplan?');
  const prompt = pro.developer.join('\n');
  const antwoord = pro.json.answer;

  check('7b: Pro: fondsnaam, regelingnaam en gever van de Premium-bron staan NIET in de prompt', !/Talentprogramma Premium|Exclusief Talentfonds/.test(prompt));
  check('7c: Pro: eigen bedrag, status en eigen deadline van die regel blijven beschikbaar', /niet zichtbaar is in dit abonnement[^\n]*Interessant[^\n]*gevraagd € 7\.000[^\n]*eigen deadline 5 november 2026/.test(T.fundingBlok(pro)));
  check('7d: Pro: brondeadline van de verborgen bron lekt niet (15 december 2026 komt niet voor bij die regel)', !/15 december 2026/.test(T.fundingBlok(pro)));
  check('7e: Pro: ook als het model de verborgen naam toch noemt, haalt de uitvoercontrole hem eruit', !/Talentprogramma Premium|Exclusief Talentfonds/.test(antwoord), antwoord);
  check('7f: Pro: de zichtbare regels blijven gewoon volledig', /Rotterdams Jongerencultuurfonds[^\n]*Aangevraagd/.test(T.fundingBlok(pro)) && /Dansimpuls Nederland/.test(T.fundingBlok(pro)));

  // Downgrade naar Free: geen Projectfinanciering-context, geen projectcontext.
  T.world.profile = T.profiel('free');
  T.world.modelTekst = 'Antwoord';
  const free = await vraagMet(w, 'Welke fondsen staan in mijn dekkingsplan?');

  check('7g: Free: geen fundingcontext, geen projectcontext en geen kansrijke-financiersflow (ook niet als de browser een project meestuurt)', !T.fundingBlok(free) && !free.json.fondsMatches && !free.developer.some((t) => /^ACTIEF PROJECT|Hushu House/.test(t)));

  // Bron verwijderd: geen naam, wel eigen velden.
  T.world.profile = T.profiel('premium');
  w.regels.podium.funder_id = null;
  const weg = await vraagMet(w, 'Welke fondsen staan in mijn dekkingsplan?');

  check('7h: verwijderde bron: "niet meer beschikbaar", eigen status blijft', /niet meer beschikbaar[^\n]*Interessant/.test(T.fundingBlok(weg)));
}

// ---------------------------------------------------------------------------
sectie('8. Kansrijke financiers (fondsMatches)');
{
  const basis = JSON.parse((await import('node:fs')).readFileSync(new URL('./baseline/fase4-matching-baseline.json', import.meta.url), 'utf8')).scenarios;
  const eigenWereld = () => {
    const w = wereld('pro', { metRegels: false });

    T.maakFundingRegel({ programId: w.p.id, schemeId: w.f.R.dans.regeling_id });

    return w;
  };
  const w = eigenWereld();
  const r = await vraagMet(w, SCAN);
  const m = r.json.fondsMatches;
  const namen = (m?.items || []).map((i) => i.naam);

  const baselineKandidaten = basis['pro-scan-project'].kandidaten;

  check('8a: projectscan geeft intentie "scan" en precies de kandidaten van de bestaande engine (zelfde als de Fase 4-baseline)', m?.intentie === 'scan' && [...namen].sort().join('|') === [...baselineKandidaten].sort().join('|'), namen.join('|'));
  check('8b: Pro krijgt de Premium-exclusieve regeling niet', !namen.includes('Talentprogramma Premium'));
  check('8c: elk item heeft type, uuid, naam; geen interne velden', m.items.every((i) => /^(regeling|fonds)$/.test(i.type) && /^[0-9a-f-]{36}$/.test(i.id) && i.naam && Object.keys(i).sort().join() === 'deadline,funder,id,naam,staatAl,type,waarom'));
  check('8d: "staat al" volgt uit de bestaande regels van het project', m.items.find((i) => i.naam === 'Dansimpuls Nederland').staatAl === true && m.items.find((i) => i.naam === 'Fonds Podiumkunsten').staatAl === false);
  check('8e: projectId in het antwoord is het door de server bevestigde project', m.projectId === w.p.id);

  const p2 = wereld('premium', { metRegels: false });
  const rp = await vraagMet(p2, SCAN);

  check('8f: Premium krijgt de Premium-regeling wel', rp.json.fondsMatches.items.some((i) => i.naam === 'Talentprogramma Premium'));

  const w3 = eigenWereld();
  const s = await vraagMet(w3, SCAN, { stream: true });

  check('8g: streaming: dezelfde lijst in het done-event', s.json?.fondsMatches?.items?.length === m.items.length && s.json.fondsMatches.items.map((i) => i.naam).join('|') === namen.join('|'));

  const advies = await vraagMet(eigenWereld(), 'Welke fondsen bestaan er voor cultuur?');

  check('8h: gewoon advies: intentie "advies" (de UI slaat niets op en biedt hooguit per item een knop)', advies.json.fondsMatches?.intentie === 'advies' || !advies.json.fondsMatches);

  const expliciet = await vraagMet(eigenWereld(), 'Scan passende fondsen en zet de kansrijke in mijn dekkingsplan.');

  check('8i: expliciete opdracht: intentie "scan_en_toevoegen" met de lijst', expliciet.json.fondsMatches?.intentie === 'scan_en_toevoegen' && expliciet.json.fondsMatches.items.length === m.items.length);

  const opvolging = await vraagMet(eigenWereld(), 'Zet deze vier in mijn dekkingsplan.');

  check('8j: opvolging: intentie "toevoegen" zonder nieuwe lijst (de UI vraagt bevestiging op de vorige lijst)', opvolging.json.fondsMatches?.intentie === 'toevoegen' && opvolging.json.fondsMatches.items.length === 0);

  const w4 = eigenWereld();
  const document = await T.vraag5(handler, { messages: msg('Schrijf een projectplan inclusief financiering en dekking voor dit project.'), kompasMode: 'projectplan', activeProgramId: w4.p.id, conversationId: w4.c.id });

  check('8k: documentmodus (projectplan): geen kansrijke-financierslijst', !document.json.fondsMatches);

  const geenProject = await T.vraag5(handler, { messages: msg(SCAN), activeProgramId: null, conversationId: null });

  check('8l: zonder actief project: geen lijst om aan toe te voegen', !geenProject.json.fondsMatches);

  const w5 = eigenWereld();
  const gesprekAnder = T.maakGesprek({ programId: null });
  const zonderKoppeling = await T.vraag5(handler, { messages: msg(SCAN), activeProgramId: w5.p.id, conversationId: gesprekAnder.id });

  check('8m: gesprek zonder (of met ander) project: geen lijst om aan toe te voegen', !zonderKoppeling.json.fondsMatches);
}

// ---------------------------------------------------------------------------
sectie('9. Intentie-herkenning');
{
  const T9 = [
    ['Zoek passende fondsen voor dit project.', 'scan'],
    ['Kun je passende fondsen zoeken voor ons project?', 'scan'],
    ['Welke fondsen passen bij dit project?', 'scan'],
    ['Doe een fondsenscan voor Hushu House.', 'scan'],
    ['Scan passende fondsen en zet de kansrijke in mijn dekkingsplan.', 'scan_en_toevoegen'],
    ['Zoek geschikte fondsen en voeg ze toe aan projectfinanciering', 'scan_en_toevoegen'],
    ['Zet deze vier in mijn dekkingsplan.', 'toevoegen'],
    ['Voeg Dansimpuls toe aan de projectfinanciering', 'toevoegen'],
    ['Welke fondsen bestaan er voor cultuur?', 'advies'],
    ['Welke vier zijn het beste?', 'advies'],
    ['Wat moet ik als eerste doen?', 'advies'],
    ['Wat staat er in mijn dekkingsplan?', 'advies'],
    ['Hoeveel financiering ontbreekt nog?', 'advies'],
  ];

  for (const [tekst, verwacht] of T9) {
    const w = wereld('pro', { metRegels: false });
    const r = await vraagMet(w, tekst);
    const gekregen = r.json.fondsMatches?.intentie || 'advies';

    check(`9: "${tekst}" -> ${verwacht}`, gekregen === verwacht, `kreeg ${gekregen}`);
  }
}

// ---------------------------------------------------------------------------
sectie('10. De AI schrijft niets weg');
{
  const w = wereld('premium');
  const voor = JSON.stringify(T.db.subsidie_kompas_program_funding);
  const voorInserts = T.world.inserts.length;

  for (const t of [SCAN, 'Scan passende fondsen en zet de kansrijke in mijn dekkingsplan.', 'Zet deze vier in mijn dekkingsplan.', 'Verwijder Dansimpuls uit mijn projectfinanciering en zet het bedrag op 5000', 'Welke vier zijn het beste?']) {
    await vraagMet(w, t);
  }

  check('10a: de projectfinanciering is na alle chatverzoeken onveranderd', JSON.stringify(T.db.subsidie_kompas_program_funding) === voor);
  check('10b: de Edge Function schrijft nooit in subsidie_kompas_program_funding', !T.world.inserts.some((i) => i.tabel === 'subsidie_kompas_program_funding'));
  check('10c: de rest van het schrijfgedrag is niet toegenomen (alleen verbruik/testlog)', T.world.inserts.every((i) => ['ai_verbruik', 'kompas_matching_testlog', 'ai_usage', 'subsidie_kompas_usage'].includes(i.tabel) || /verbruik|testlog|usage/i.test(i.tabel)), [...new Set(T.world.inserts.map((i) => i.tabel))].join(','));
  void voorInserts;
}

// ---------------------------------------------------------------------------
sectie('11. Logging bevat geen inhoud');
{
  const w = wereld('premium');

  T.fouten.length = 0;
  T.world.dekkingsplanFout = '57014';
  await vraagMet(w, 'Dit is een geheime promptzin over Hushu House en 123456.');
  await vraagMet(w, 'x', { focusFundingId: 'geheim' });
  check('11a: serverlogs bestaan alleen uit codes (geen prompt, project- of fondsnamen)', T.fouten.every((l) => /^\[subsidie-kompas\] [a-z_0-9]+$/.test(l)), T.fouten.join('|'));
}

// ---------------------------------------------------------------------------
sectie('12. Ingetrokken (withdrawn): historisch, geen kans, niet gepland/aangevraagd/toegekend');
{
  const bouw = (extra = []) => {
    const w = wereld('premium', { metRegels: false });

    w.p.budget_total = 100000;
    w.p.own_contribution = 10000;
    w.ingetrokken = T.maakFundingRegel({ programId: w.p.id, schemeId: w.f.R.jongeren.regeling_id, status: 'withdrawn', requested_amount: 30000, awarded_amount: 12000 });
    extra.forEach((e) => T.maakFundingRegel({ programId: w.p.id, ...e(w) }));

    return w;
  };

  const w1 = bouw();
  const b1 = T.fundingBlok(await vraagMet(w1, 'Wat staat er in mijn financieringsplan?'));

  check('12a: de regel staat als Ingetrokken in de chatcontext', /Rotterdams Jongerencultuurfonds \(Gemeente Rotterdam\) — Ingetrokken/.test(b1), b1.split('\n').slice(5, 8).join('|'));
  check('12b: niet als Interessant, Aangevraagd of Toegekend gelezen', !/Rotterdams Jongerencultuurfonds[^\n]* — (Interessant|Aangevraagd|Toegekend|In voorbereiding)/.test(b1));
  check('12c: telt niet mee als Aangevraagd of Toegekend (ook niet met een ingevuld toegekend bedrag)', /Aangevraagd: € 0\b/.test(b1) && /Toegekend: € 0\b/.test(b1), b1.split('\n').slice(1, 6).join('|'));
  check('12d: beïnvloedt het gat niet: nog te financieren = begroting - overige dekking', /Nog te financieren: € 90\.000/.test(b1));
  check('12e: is geen komende deadline (ook niet met een toekomstige brondeadline)', /Eerstvolgende deadline: geen komende deadline/.test(b1));

  const w2 = bouw([(w) => ({ funderId: w.f.F.podium.funder_id, status: 'interesting' })]);
  const b2 = T.fundingBlok(await vraagMet(w2, 'Wat staat er in mijn financieringsplan?'));

  check('12f: een actieve regel naast een ingetrokken regel blijft de eerstvolgende kans', /Eerstvolgende deadline: Fonds Podiumkunsten|Eerstvolgende deadline: geen komende deadline/.test(b2) && !/Eerstvolgende deadline: Rotterdams Jongerencultuurfonds/.test(b2));

  const w3 = bouw([(w) => ({ schemeId: w.f.R.dans.regeling_id, status: 'awarded', awarded_amount: 25000 }), (w) => ({ funderId: w.f.F.jeugd.funder_id, status: 'submitted', requested_amount: 8000 })]);
  const b3 = T.fundingBlok(await vraagMet(w3, 'Hoeveel ontbreekt er nog?'));
  // (de wereld wordt bij elke wereld() opnieuw opgebouwd: lees de UI-kant van w3 eerst)
  const rpc = T.emuleerDekkingsplan(T.GEBRUIKER_A.id, w3.p.id).data.map(regelUitRpc);
  const ui = berekenDekking({ begroting: 100000, regels: rpc, overige: 10000 });
  const w4 = wereld('premium', { metRegels: false });

  w4.p.budget_total = 100000;
  w4.p.own_contribution = 10000;
  T.maakFundingRegel({ programId: w4.p.id, schemeId: w4.f.R.dans.regeling_id, status: 'awarded', awarded_amount: 25000 });
  T.maakFundingRegel({ programId: w4.p.id, funderId: w4.f.F.jeugd.funder_id, status: 'submitted', requested_amount: 8000 });
  const b4 = T.fundingBlok(await vraagMet(w4, 'Hoeveel ontbreekt er nog?'));
  const kop = (b) => b.split('\n').slice(1, 6).join('|');

  check('12g: dezelfde totalen met en zonder de ingetrokken regel', kop(b3) === kop(b4) && /Toegekend: € 25\.000/.test(b3) && /Aangevraagd: € 8\.000/.test(b3), `${kop(b3)} <> ${kop(b4)}`);

  check('12h: UI-module en server rekenen met een ingetrokken regel hetzelfde', ui.toegekend === 25000 && ui.aangevraagd === 8000 && ui.nogNodig === 57000 && /Nog te financieren: € 57\.000/.test(b3), JSON.stringify(ui));
  check('12i: de UI leest withdrawn als Ingetrokken (niet als Interessant)', rpc.find((r) => r.status === 'withdrawn') != null && rpc.filter((r) => r.status === 'interesting').length === 0);
}

T.herstelConsole();
process.stdout.write(`\nFASE 5 SERVER: ${ok} OK, ${fout} FAIL\n`);
process.exit(fout ? 1 : 0);
