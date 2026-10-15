// Client-kant van de voorstelpreview (Fase C): view-model, fail-safe, read-only component (statisch) en service.
import { readFileSync } from 'node:fs';
import { bouwPreviewModel, verificatieModel, PREVIEW_FOUT } from '../../src/features/kompas-app/financiering/voorstelPreviewModel.js';
import { vraagVoorstelPreview } from '../../src/data/services/voorstelPreview.js';

const stand = { ok: 0, fout: 0 };
const check = (naam, waar, detail = '') => { if (waar) stand.ok += 1; else { stand.fout += 1; console.log(`  FAIL: ${naam} ${detail}`); } };
const sectie = (t) => console.log(`\n== ${t}`);

const velden = (o = {}) => ({
  fondsnaam: { status: 'confirmed', waarde: 'Fonds', fragment: 'Fonds Voorbeeld stichting' },
  deadline: { status: 'confirmed', waarde: '2026-11-12', fragment: 'Aanvragen kan tot 12 november 2026.' },
  bedrag_max: { status: 'confirmed', waarde: '25000', fragment: 'Maximaal € 25.000.' },
  ...o,
});
const meta = (status, v = velden(), extra = {}) => ({
  versie: 2, server_generated: true, herkomst: 'regeling', voorgesteld_op: '2026-10-14', voorgesteld_bedrag: 20000,
  verificatie: { status, gecontroleerd_op: '2026-10-14T10:00:00.000Z', bron_url: 'https://www.fonds-a.example.nl/aanvragen', eind_url: 'https://www.fonds-a.example.nl/aanvragen', pagina_sha256: 'a'.repeat(64), velden: v, ...extra },
});
const regel = (sleutel, extra = {}) => ({ sleutel, type: 'regeling', id: 'a'.repeat(8) + '-aaaa-4aaa-8aaa-aaaaaaaaaaaa', naam: 'Rotterdams Jongerencultuurfonds', gever: 'Gemeente Rotterdam', bedrag: 20000, grenzen: { min: 5000, max: 25000 }, deadline: { status: 'geverifieerd', datum: '2026-11-12', verlopen: false }, selecteerbaar: true, staatAl: false, motivatie: 'Past.', onzekerheden: [], ...extra });
const antwoord = (regels, verificaties, extra = {}) => ({ ok: true, voorstel: { versie: 1, regels, acties: [] }, verificaties, overgeslagen: [], totalen: { voorgesteld: 20000, gat: 70000, nietToegewezen: 50000 }, opgeslagen: false, actiesGegenereerd: false, ...extra });

sectie('1. De status komt van de server en wordt vertaald, niet bepaald');
{
  const m = bouwPreviewModel(antwoord([regel('r1')], [{ sleutel: 'r1', metadata: meta('geverifieerd'), categorie: 'ok', reden: null }]));

  check('ok', m.ok === true);
  check('geverifieerd getoond met het label van het contract', m.regels[0].verificatie.status === 'geverifieerd' && m.regels[0].verificatie.label === 'Geverifieerd door Subsidie Kompas');
  check('bron en datum van controle doorgegeven', m.regels[0].verificatie.bronUrl === 'https://www.fonds-a.example.nl/aanvragen' && m.regels[0].verificatie.gecontroleerdOp === '2026-10-14');
  check('velden: Fondsnaam, Deadline en Maximale bijdrage bevestigd', ['Fondsnaam', 'Deadline', 'Maximale bijdrage'].every((l) => m.regels[0].verificatie.velden.some((v) => v.label === l && v.status === 'confirmed')));
  check('niet getoonde velden samengevat als niet gecontroleerd', m.regels[0].verificatie.nietGecontroleerdOverig.includes('Voorwaarden'));
  check('telling per status', m.samenvatting.geverifieerd === 1 && m.samenvatting.conflict === 0);

  for (const s of ['gedeeltelijk', 'onzeker', 'niet_gecontroleerd']) {
    const x = bouwPreviewModel(antwoord([regel('r1')], [{ sleutel: 'r1', metadata: meta(s), categorie: 'ok', reden: null }]));

    check(`status ${s} blijft ${s} (nooit opgewaardeerd, ook niet bij bevestigde velden)`, x.regels[0].verificatie.status === s, x.regels[0].verificatie.status);
  }
}

sectie('2. Alleen neerwaarts corrigeren');
{
  const metConflict = meta('geverifieerd', velden({ bedrag_max: { status: 'conflict', waarde: '30000', db_waarde: '25000', fragment: 'Maximaal € 30.000.' } }));
  const a = bouwPreviewModel(antwoord([regel('r1')], [{ sleutel: 'r1', metadata: metConflict }]));

  check('"geverifieerd" met een conflictveld: getoond als niet gecontroleerd', a.regels[0].verificatie.status === 'niet_gecontroleerd' && a.regels[0].verificatie.afgewaardeerd === true);
  check('afgewaardeerd: geen velden en geen bron meer getoond', a.regels[0].verificatie.velden.length === 0 && a.regels[0].verificatie.bronUrl === null);

  const zonderDeadline = meta('geverifieerd', velden({ deadline: { status: 'uncertain' } }));

  check('"geverifieerd" zonder bevestigde deadline: niet gecontroleerd', bouwPreviewModel(antwoord([regel('r1')], [{ sleutel: 'r1', metadata: zonderDeadline }])).regels[0].verificatie.status === 'niet_gecontroleerd');

  const zonderBron = meta('geverifieerd'); delete zonderBron.verificatie.bron_url;

  check('"geverifieerd" zonder bron: niet gecontroleerd', bouwPreviewModel(antwoord([regel('r1')], [{ sleutel: 'r1', metadata: zonderBron }])).regels[0].verificatie.status === 'niet_gecontroleerd');

  const conflict = bouwPreviewModel(antwoord([regel('r1')], [{ sleutel: 'r1', metadata: meta('conflict', velden({ deadline: { status: 'conflict', waarde: '2026-11-30', db_waarde: '2026-11-12', fragment: 'De deadline is 30 november 2026.' } })) }]));
  const c = conflict.regels[0].verificatie;

  check('conflict: status en veld getoond met beide waarden', c.status === 'conflict' && c.velden.some((v) => v.label === 'Deadline' && v.status === 'conflict' && v.online === '2026-11-30' && v.database === '2026-11-12' && v.fragment.includes('30 november')));
}

sectie('3. Niet van de server = niet gecontroleerd');
{
  const vals = [
    ['versie 1', { ...meta('geverifieerd'), versie: 1 }],
    ['server_generated ontbreekt', { ...meta('geverifieerd'), server_generated: false }],
    ['metadata ontbreekt', null],
    ['metadata is een string', 'geverifieerd'],
    ['onbekende status', meta('super-geverifieerd')],
    ['leeg object', {}],
  ];

  for (const [naam, m] of vals) {
    const x = bouwPreviewModel(antwoord([regel('r1')], [{ sleutel: 'r1', metadata: m }]));

    check(`${naam}: niet gecontroleerd met melding`, x.ok && x.regels[0].verificatie.status === 'niet_gecontroleerd' && x.regels[0].verificatie.melding === 'Bron kon niet automatisch worden gecontroleerd.', JSON.stringify(x.regels?.[0]?.verificatie));
  }

  const zonder = bouwPreviewModel(antwoord([regel('r1')], []));

  check('geen verificatie voor de regel: niet gecontroleerd', zonder.ok && zonder.regels[0].verificatie.status === 'niet_gecontroleerd');

  // De deadline van het contract (status 'geverifieerd' = citaatcontrole) mag nooit als verificatie doorgaan.
  check('contractdeadline "geverifieerd" zonder servermetadata: nergens "geverifieerd" in de weergave', !JSON.stringify(zonder.regels[0].verificatie).toLowerCase().includes('geverifieerd door'));
  check('deadline staat als "volgens onze database"', zonder.regels[0].deadlineTekst === '12 nov 2026');

  const verkeerd = bouwPreviewModel(antwoord([regel('r1')], [{ sleutel: 'ander', metadata: meta('geverifieerd') }]));

  check('metadata van een andere regel wordt niet overgenomen', verkeerd.regels[0].verificatie.status === 'niet_gecontroleerd');
}

sectie('3b. Compacte kopregel en details');
{
  const m = bouwPreviewModel(antwoord([regel('r1', { voorwaarden: ['Rotterdamse organisatie'], onzekerheden: ['Cofinancieringseis (niet automatisch gecontroleerd): 50%', 'Een andere onzekerheid'] })], [{ sleutel: 'r1', metadata: meta('geverifieerd') }]));
  const r = m.regels[0];

  check('kop: korte status en compacte deadline', r.kop.status.sleutel === 'geverifieerd' && r.kop.status.label === 'Geverifieerd' && r.kop.samenvatting === 'deadline 12 nov 2026', JSON.stringify(r.kop));
  check('kop: gedeeltelijk heet "Gedeeltelijk geverifieerd"', bouwPreviewModel(antwoord([regel('r1')], [{ sleutel: 'r1', metadata: meta('gedeeltelijk') }])).regels[0].kop.status.label === 'Gedeeltelijk geverifieerd');
  check('kop: zonder deadline geen samenvatting en geen verzonnen "doorlopend"', bouwPreviewModel(antwoord([regel('r1', { deadline: { status: 'te-verifieren', datum: null } })], [])).regels[0].kop.samenvatting === null);
  check('details: fonds/gever en regeling gescheiden', r.fondsnaam === 'Gemeente Rotterdam' && r.regelingnaam === 'Rotterdams Jongerencultuurfonds');
  check('details: fonds heeft geen regelingnaam', bouwPreviewModel(antwoord([regel('r1', { type: 'fonds' })], [])).regels[0].regelingnaam === null);
  check('details: cofinanciering en voorwaarden apart, andere onzekerheden blijven staan', r.cofinanciering === '50%' && r.voorwaarden[0] === 'Rotterdamse organisatie' && r.onzekerheden.length === 1 && r.onzekerheden[0] === 'Een andere onzekerheid');
  check('details: doelgroep, werkgebied en type aanvrager eerlijk als niet gecontroleerd', r.extraVelden.length === 3 && r.extraVelden.every((v) => v.waarde === 'Niet gecontroleerd'));
}

sectie('4. Redenen en publiek niveau');
{
  const x = bouwPreviewModel(antwoord([regel('r1', { bedrag: null, deadline: { status: 'te-verifieren', datum: null, verlopen: false }, grenzen: { min: null, max: null } })], [{ sleutel: 'r1', metadata: { versie: 2, server_generated: true, herkomst: 'regeling', voorgesteld_op: '2026-10-14' }, categorie: 'niet_uitgevoerd', reden: 'geen_toegang_tot_details' }]));
  const r = x.regels[0];

  check('basisgegevens-melding, niet gecontroleerd', r.verificatie.status === 'niet_gecontroleerd' && r.reden.includes('basisgegevens'));
  check('geen bedrag, deadline of bijdrage getoond', r.bedragTekst === null && r.deadlineTekst === null && r.grenzenTekst === null);
  check('geen abonnementsnaam in de melding', !/premium|pro\b|abonnement/i.test(r.reden));

  const lim = bouwPreviewModel(antwoord([regel('r1')], [{ sleutel: 'r1', metadata: null, reden: 'limiet' }]));

  check('limiet: eigen tekst', lim.regels[0].reden.includes('te veel bronnen'));
  check('overgeslagen regels worden geteld', bouwPreviewModel(antwoord([regel('r1')], [], { overgeslagen: [{ index: 1, code: 'x' }, { index: 2, code: 'y' }] })).aantalOvergeslagen === 2);
}

sectie('5. Fail-safe: bij een fout nergens een verificatiestatus');
{
  const slecht = [null, undefined, 'x', 5, [], {}, { ok: false }, { ok: true }, { ok: true, voorstel: {}, verificaties: [] }, { ok: true, voorstel: { regels: [] }, verificaties: 'x' },
    { ok: 'true', voorstel: { regels: [] }, verificaties: [] },
    { get ok() { throw new Error('boem'); } },
    antwoord([regel('r1')], [{ get sleutel() { throw new Error('boem'); } }])];

  for (const [i, s] of slecht.entries()) {
    const x = bouwPreviewModel(s);

    check(`slecht antwoord ${i}: { ok: false } met vaste melding, zonder statusvelden`, x.ok === false && x.melding === PREVIEW_FOUT && !('regels' in x) && !JSON.stringify(x).toLowerCase().includes('geverifieerd'), JSON.stringify(x));
  }

  check('de melding zegt dat er niets is opgeslagen', PREVIEW_FOUT.includes('niets opgeslagen'));

  const raar = verificatieModel({ versie: 2, server_generated: true, verificatie: { status: 'geverifieerd', velden: 'x', bron_url: 'javascript:alert(1)', gecontroleerd_op: 5 } });

  check('rommelige metadata: geen throw, niet geverifieerd, geen onveilige link', raar.status === 'niet_gecontroleerd' && raar.bronUrl === null);

  const http = verificatieModel(meta('geverifieerd', velden(), { bron_url: 'http://www.fonds-a.example.nl/x' }));

  check('http-bron wordt niet als link getoond (alleen https)', http.bronUrl === null);
}

sectie('6. Het component en de service zijn read-only');
{
  const comp = readFileSync('src/features/kompas-app/financiering/VoorstelPreview.jsx', 'utf8');
  const model = readFileSync('src/features/kompas-app/financiering/voorstelPreviewModel.js', 'utf8');
  const service = readFileSync('src/data/services/voorstelPreview.js', 'utf8');
  const code = (s) => s.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

  for (const [naam, s] of [['component', comp], ['model', model]]) {
    check(`${naam}: geen schrijf- of netwerkcode`, !/fetch\(|supabase|localStorage|sessionStorage|indexedDB|XMLHttpRequest|\.insert\(|\.update\(|\.upsert\(|\.rpc\(|functions\.invoke/.test(code(s)));
    check(`${naam}: geen HTML-injectie`, !/dangerouslySetInnerHTML|innerHTML|eval\(/.test(code(s)));
  }

  const regelComp = readFileSync('src/features/kompas-app/financiering/FinancieringsRegel.jsx', 'utf8');

  check('preview-component: geen eigen knoppen of klikacties (read-only)', !/<button|onClick|onSubmit|<form|<input|<textarea|<select/.test(code(comp)));
  check('gedeelde regel: precies een knop (de kopregel) met aria-expanded en aria-controls, een onClick die alleen open/dicht wisselt', (code(regelComp).match(/<button/g) || []).length === 1 && /aria-expanded=\{open\}/.test(regelComp) && /aria-controls=\{paneelId\}/.test(regelComp) && (code(regelComp).match(/onClick/g) || []).length === 1 && /const wissel = \(\) => \{[\s\S]*?\};/.test(regelComp));
  check('gedeelde regel: geen netwerk, opslag, supabase of voorstel-/verificatielogica', !/fetch\(|supabase|localStorage|sessionStorage|\.insert\(|\.rpc\(|functions\.invoke|voorstel|verificatie|dangerouslySetInnerHTML/i.test(code(regelComp).replace(/data-testid="financieringsregel[^"]*"/g, '')));
  check('gedeelde regel: standaard ingeklapt, details in een region die verborgen is zolang dicht', /defaultOpen = false/.test(regelComp) && /role="region"/.test(regelComp) && /hidden=\{!open\}/.test(regelComp));
  check('preview gebruikt de gedeelde regel (geen eigen kaart)', /import FinancieringsRegel from '.\/FinancieringsRegel.jsx'/.test(comp) && /<FinancieringsRegel/.test(comp) && !/<article/.test(code(comp)));
  check('component: bronlink met noopener en nofollow', /rel="noopener noreferrer nofollow"/.test(comp));
  check('component en model bepalen nergens zelf de status "geverifieerd"', !/status\s*[:=]\s*['"]geverifieerd['"]/.test(code(comp) + code(model)));
  check('component importeert geen chat-, acties- of opslagcode', !/chat|actieplan|acties|useProjectFinanciering|projectActies|toevoegen/i.test(comp.split('\n').filter((l) => l.startsWith('import')).join('\n')));
  check('service: alleen mode voorstel-preview, alleen supabase.functions.invoke', (service.match(/functions\.invoke/g) || []).length === 1 && /mode: 'voorstel-preview'/.test(service) && !/\.from\(|\.insert\(|\.rpc\(/.test(code(service)));
  check('service stuurt geen token of status mee', !/token|status|verificatie/i.test(code(service).replace(/voorstel-preview/g, '')));

  const uit = await vraagVoorstelPreview({ projectId: 'x', voorstel: { regels: [] } });

  check('service zonder Supabase-verbinding: { ok: false }, geen throw', uit.ok === false && uit.antwoord === null);
  check('service met ongeldige invoer: { ok: false }', (await vraagVoorstelPreview({ projectId: '', voorstel: null })).ok === false);
}

console.log(`\nCLIENT: ${stand.ok} OK, ${stand.fout} FAIL`);
process.exit(stand.fout ? 1 : 0);
