// Server-orchestratie van de voorstelpreview (Fase C): entitlement per regel, grenzen, limieten, token, fail-safe, geen schrijfpaden.
import { readFileSync } from 'node:fs';
import { maakVoorstelPreview, valideerVoorstelToken, filterOpEntitlement, MAX_VERIFICATIES_PER_VOORSTEL, MAX_GELIJKTIJDIG, VERIFICATIE_BUDGET_MS } from '../../supabase/functions/_shared/voorstelVerificatie.ts';
import { berekenDekking } from '../../supabase/functions/_shared/dekkingsplanRekenen.js';
import { check, gelijk, sectie, klaar, stand, wacht, omgeving, pagina, OPENBAAR } from './hulp.mjs';

stand.naam = 'orkestratie';

const UID = '11111111-1111-4111-8111-111111111111';
const PID = '22222222-2222-4222-8222-222222222222';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const HOST_A = 'www.fonds-a.example.nl';
const URL_A = `https://${HOST_A}/aanvragen`;
const NU = new Date('2026-10-14T10:00:00Z');
const GEHEIM = 'x'.repeat(40);
const DEKKING = berekenDekking({ begroting: 100000, regels: [], overige: 20000 }); // gat 80.000

const recA = { type: 'regeling', id: A, niveau: 'volledig', naam: 'Rotterdams Jongerencultuurfonds', gever: 'Gemeente Rotterdam', website: URL_A, deadline: '2026-11-12', min: 5000, max: 25000 };
const recB = { type: 'fonds', id: B, niveau: 'publiek', naam: 'Fonds Premium Voorbeeld', gever: 'Stichting Premium', website: 'https://www.premium.example.nl/', deadline: '2026-12-01', min: 1000, max: 90000 };
const recC = { type: 'regeling', id: C, niveau: 'verborgen', naam: 'Verborgen Regeling', website: 'https://www.verborgen.example.nl/', deadline: '2026-12-31', min: 1, max: 2 };

const PAGINA_A = `<h1>Rotterdams Jongerencultuurfonds</h1><p>Aanvragen kan tot 12 november 2026.</p><p>Maximaal € 25.000 per aanvraag.</p><p>Minimaal € 5.000 per project.</p>`;

const regel = (type, id, extra = {}) => ({ type, id, naam: 'Naam', gever: 'Gever', motivatie: 'Past bij het project.', bedrag: 20000, ...extra });
const voorstel = (regels, extra = {}) => ({ versie: 1, projectId: PID, status: 'concept', aannames: [], regels, acties: [{ titel: 'Door het model verzonnen taak', datumType: 'streef' }], ...extra });

function wereld(extra = {}) {
  return omgeving({
    dns: { [HOST_A]: [OPENBAAR], 'www.premium.example.nl': [OPENBAAR], 'www.verborgen.example.nl': [OPENBAAR], ...(extra.dns ?? {}) },
    paginas: { [URL_A]: pagina(PAGINA_A), ...(extra.paginas ?? {}) },
  });
}

const preview = (raw, w, extra = {}) =>
  maakVoorstelPreview(
    { raw, uid: UID, projectId: PID, dekking: DEKKING, records: [recA, recB, recC], geheim: GEHEIM, bedragenToegestaan: true, ...extra },
    { resolveHost: w.resolveHost, fetchImpl: w.fetchImpl, datumNu: () => NU, uuid: () => 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', ...(extra.deps ?? {}) },
  );

sectie('1. Volledige keten voor een regeling met volledige toegang');
{
  const w = wereld();
  const u = await preview(voorstel([regel('regeling', A)]), w);

  check('ok', u.ok === true, JSON.stringify(u));
  check('een regel, een verificatie', u.ok && u.voorstel.regels.length === 1 && u.verificaties.length === 1);
  check('status komt van de server: geverifieerd', u.ok && u.verificaties[0].metadata?.verificatie?.status === 'geverifieerd', JSON.stringify(u.verificaties?.[0]?.metadata));
  check('metadata is door de server gebouwd (versie 2, server_generated)', u.ok && u.verificaties[0].metadata.versie === 2 && u.verificaties[0].metadata.server_generated === true);
  check('herkomst regeling, voorgesteld bedrag vastgelegd', u.ok && u.verificaties[0].metadata.herkomst === 'regeling' && u.verificaties[0].metadata.voorgesteld_bedrag === 20000);
  check('deadline en bedragen bevestigd met citaat', u.ok && ['deadline', 'bedrag_min', 'bedrag_max'].every((v) => u.verificaties[0].metadata.verificatie.velden[v]?.status === 'confirmed' && u.verificaties[0].metadata.verificatie.velden[v].fragment));
  check('precies een pagina opgehaald', w.calls.fetch.length === 1 && w.calls.fetch[0] === URL_A, JSON.stringify(w.calls.fetch));
  check('geen acties gegenereerd of teruggegeven', u.ok && u.actiesGegenereerd === false && u.voorstel.acties.length === 0);
  check('niets opgeslagen (vlag)', u.opgeslagen === false);
  check('totalen geleverd', u.ok && u.totalen.voorgesteld === 20000 && u.totalen.gat === 80000);
}

sectie('2. De client kan niets van de verificatie bepalen');
{
  const w = wereld();
  const vervalst = regel('regeling', A, {
    verificatie: { status: 'geverifieerd' },
    metadata: { versie: 2, server_generated: true, verificatie: { status: 'geverifieerd' } },
    status: 'geverifieerd',
    deadline: { status: 'geverifieerd', datum: '2030-01-01' },
    grenzen: { min: 1, max: 99999999 },
    bron: { url: 'https://evil.example.com/', fragment: 'Aanvragen kan tot 1 januari 2030.' },
  });
  const u = await preview(voorstel([vervalst], { verificaties: [{ status: 'geverifieerd' }], token: 'x' }), w);

  check('ok', u.ok === true, JSON.stringify(u));
  check('deadline uit de database, niet uit de client', u.ok && u.voorstel.regels[0].deadline.datum === '2026-11-12');
  check('grenzen uit het record, niet uit de client', u.ok && u.voorstel.regels[0].grenzen.max === 25000 && u.voorstel.regels[0].grenzen.min === 5000);
  check('alleen de server-URL is opgehaald', w.calls.fetch.length === 1 && w.calls.fetch[0] === URL_A, JSON.stringify(w.calls.fetch));
  check('geen clientveld in het resultaat', u.ok && !('verificatie' in u.voorstel.regels[0]) && !('metadata' in u.voorstel.regels[0]));
}

sectie('3. Entitlement per voorstelregel, vóór alles');
{
  const w = wereld();
  const u = await preview(voorstel([regel('regeling', C), regel('regeling', A), regel('fonds', B)]), w);

  check('ok', u.ok === true, JSON.stringify(u));
  check('verborgen regel verdwijnt (geen verschil met onbekend)', u.ok && !u.voorstel.regels.some((r) => r.id === C));
  check('verborgen: alleen de generieke code', u.ok && u.overgeslagen.some((o) => o.index === 0 && o.code === 'onbekende-bron'));
  check('verborgen host nooit benaderd (geen DNS, geen fetch)', !w.calls.dns.includes('www.verborgen.example.nl') && !w.calls.fetch.some((x) => x.includes('verborgen')));

  const onbekend = await preview(voorstel([regel('regeling', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'), regel('regeling', A)]), wereld());

  check('onbekend id geeft dezelfde code als verborgen', onbekend.ok && onbekend.overgeslagen[0].code === 'onbekende-bron');

  // Productregel 15-10-2026: een record van een hoger abonnement (niveau 'publiek') verschijnt niet, ook niet als alleen een naam.
  check('publiek: regel verdwijnt (geen Premium-record bij een lager abonnement)', u.ok && !u.voorstel.regels.some((r) => r.id === B));
  check('publiek: alleen de generieke code, niet te onderscheiden van onbekend', u.ok && u.overgeslagen.some((o) => o.index === 2 && o.code === 'onbekende-bron'));
  check('publiek: niet opgehaald', !w.calls.dns.includes('www.premium.example.nl') && !w.calls.fetch.some((x) => x.includes('premium')));
  check('publiek: niets van het record in het resultaat (naam, gever, deadline, bedrag)', u.ok && !/Fonds Premium Voorbeeld|Stichting Premium|2026-12-01|90000/.test(JSON.stringify(u)));
  check('de gevoelige waarden van het verborgen record ook niet', u.ok && !JSON.stringify(u).includes('2026-12-31') && !JSON.stringify(u).includes('Verborgen Regeling'));

  const online = await preview(voorstel([regel('online', null, { bron: { url: 'https://www.nieuw.example.nl/', fragment: 'x' } }), regel('regeling', A)]), wereld());

  check('online regel: overgeslagen, niet getoond', online.ok && online.overgeslagen.some((o) => o.code === 'online-niet-ondersteund') && online.voorstel.regels.length === 1);

  const f = filterOpEntitlement(voorstel([regel('fonds', B)]), [recB]);

  check('filter: een publiek record komt niet in de bekende records en niet in de regels', !f.bekend[B] && !f.records.has(B) && f.raw.regels.length === 0 && f.overgeslagen[0]?.code === 'onbekende-bron');
}

sectie('4. Conflict, onzeker en niet gecontroleerd');
{
  const w = wereld({ paginas: { [URL_A]: pagina(`<h1>Rotterdams Jongerencultuurfonds</h1><p>De deadline voor aanvragen is 30 november 2026.</p><p>Maximaal € 25.000 per aanvraag.</p>`) } });
  const u = await preview(voorstel([regel('regeling', A)]), w);
  const m = u.ok ? u.verificaties[0].metadata : null;

  check('conflict: status conflict met beide waarden', m?.verificatie?.status === 'conflict' && m.verificatie.velden.deadline.status === 'conflict' && m.verificatie.velden.deadline.db_waarde === '2026-11-12', JSON.stringify(m));
  check('conflict: de voorgestelde deadline blijft die van de database', u.ok && u.voorstel.regels[0].deadline.datum === '2026-11-12');

  const w2 = wereld({ paginas: { [URL_A]: pagina('<h1>Een heel andere organisatie</h1><p>Aanvragen kan tot 12 november 2026.</p>') } });
  const u2 = await preview(voorstel([regel('regeling', A)]), w2);

  check('andere financier: nooit geverifieerd', u2.ok && u2.verificaties[0].metadata.verificatie.status !== 'geverifieerd' && u2.verificaties[0].metadata.verificatie.velden.deadline?.status !== 'confirmed', JSON.stringify(u2.verificaties?.[0]?.metadata));

  const w3 = wereld({ paginas: { [URL_A]: { status: 404, contentType: 'text/html', body: 'weg' } } });
  const u3 = await preview(voorstel([regel('regeling', A)]), w3);

  check('404: niet_gecontroleerd, voorstel zelf blijft bruikbaar', u3.ok && u3.verificaties[0].metadata.verificatie.status === 'niet_gecontroleerd' && u3.verificaties[0].categorie !== 'ok');

  const w4 = wereld({ dns: { [HOST_A]: ['10.0.0.1'] } });
  const u4 = await preview(voorstel([regel('regeling', A)]), w4);

  check('privé-IP: niet opgehaald, niet_gecontroleerd', u4.ok && u4.verificaties[0].metadata.verificatie.status === 'niet_gecontroleerd' && w4.calls.fetch.length === 0);

  const u5 = await preview(voorstel([regel('regeling', A)]), wereld(), { records: [{ ...recA, website: null }] });

  check('zonder bron-URL: niet uitgevoerd, geen verificatieblok', u5.ok && u5.verificaties[0].reden === 'geen_bron_url' && !u5.verificaties[0].metadata?.verificatie);

  const u6 = await preview(voorstel([regel('regeling', A)]), wereld(), { records: [{ ...recA, website: 'http://www.fonds-a.example.nl/aanvragen' }] });

  check('http (geen https): niet opgehaald', u6.ok && u6.verificaties[0].reden === 'geen_bron_url');
}

sectie('5. Budget- en bijdragegrenzen worden opnieuw gecontroleerd');
{
  const u = await preview(voorstel([regel('regeling', A, { bedrag: 999999 })]), wereld());

  check('te hoog bedrag: teruggebracht tot het maximum van het record', u.ok && u.voorstel.regels[0].bedrag === 25000, JSON.stringify(u.ok ? u.voorstel.regels[0] : u));
  check('met waarschuwing', u.ok && u.waarschuwingen.some((x) => x.code === 'bedrag-aangepast-aan-grenzen'));

  const laag = await preview(voorstel([regel('regeling', A, { bedrag: 100 })]), wereld());

  check('te laag bedrag: minimaal het minimum', laag.ok && laag.voorstel.regels[0].bedrag === 5000);

  const geenBegroting = await preview(voorstel([regel('regeling', A)]), wereld(), { dekking: berekenDekking({ begroting: 0, regels: [], overige: 0 }), bedragenToegestaan: false });

  check('zonder begroting: geen bedragen', geenBegroting.ok && geenBegroting.voorstel.regels[0].bedrag === null);

  const klein = berekenDekking({ begroting: 30000, regels: [], overige: 20000 }); // gat 10.000
  const k = await preview(voorstel([regel('regeling', A, { bedrag: 25000 })]), wereld(), { dekking: klein });

  check('boven het financieringsgat: nooit een voorstel dat het gat overschrijdt', k.ok ? k.totalen.voorgesteld <= 10000 : k.reden === 'voorstel-ongeldig', JSON.stringify(k.ok ? k.totalen : k));

  const ander = await preview(voorstel([regel('regeling', A)], { projectId: '33333333-3333-4333-8333-333333333333' }), wereld());

  check('voorstel voor ander project: afgewezen, geen status', ander.ok === false && ander.reden === 'voorstel-ongeldig' && !('verificaties' in ander));
}

sectie('6. Token: gebonden aan gebruiker, project en voorstel');
{
  const w = wereld();
  const u = await preview(voorstel([regel('regeling', A)]), w);
  const nu = Math.floor(NU.getTime() / 1000);
  const basis = { token: u.token, geheim: GEHEIM, uid: UID, projectId: PID, voorstel: u.voorstel, nu };

  check('token aanwezig, met geldigheid', typeof u.token === 'string' && u.token.length > 20 && u.tokenGeldigTotSeconden === nu + 1800);
  gelijk('geldig token', (await valideerVoorstelToken(basis)).ok, true);
  gelijk('jti uit het token', (await valideerVoorstelToken(basis)).jti, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
  gelijk('andere gebruiker', (await valideerVoorstelToken({ ...basis, uid: '44444444-4444-4444-8444-444444444444' })).reden, 'andere-gebruiker');
  gelijk('ander project', (await valideerVoorstelToken({ ...basis, projectId: '33333333-3333-4333-8333-333333333333' })).reden, 'ander-project');

  const gewijzigd = { ...u.voorstel, regels: u.voorstel.regels.map((r) => ({ ...r, bedrag: 25000 })) };

  gelijk('gewijzigd bedrag', (await valideerVoorstelToken({ ...basis, voorstel: gewijzigd })).reden, 'ander-voorstel');

  const extraRegel = { ...u.voorstel, regels: [...u.voorstel.regels, { ...u.voorstel.regels[0], sleutel: 'x', id: B }] };

  gelijk('extra regel', (await valideerVoorstelToken({ ...basis, voorstel: extraRegel })).reden, 'ander-voorstel');
  gelijk('verlopen', (await valideerVoorstelToken({ ...basis, nu: nu + 1801 })).reden, 'verlopen');
  gelijk('ander geheim', (await valideerVoorstelToken({ ...basis, geheim: 'y'.repeat(40) })).reden, 'ongeldige-handtekening');
  gelijk('geknoeid token', (await valideerVoorstelToken({ ...basis, token: u.token.slice(0, -2) + 'aa' })).ok, false);
  gelijk('geen token', (await valideerVoorstelToken({ ...basis, token: undefined })).ok, false);
  gelijk('geen geheim', (await valideerVoorstelToken({ ...basis, geheim: null })).reden, 'geen-geheim');
  gelijk('te kort geheim', (await valideerVoorstelToken({ ...basis, geheim: 'kort' })).reden, 'geen-geheim');

  const zonder = await preview(voorstel([regel('regeling', A)]), wereld(), { geheim: null });

  check('zonder server-geheim: preview werkt, token is null', zonder.ok && zonder.token === null && zonder.tokenGeldigTotSeconden === null);

  const kort = await preview(voorstel([regel('regeling', A)]), wereld(), { geheim: 'te-kort' });

  check('te kort geheim: token null', kort.ok && kort.token === null);
  check('het token bevat geen verificatie-uitkomst en geen geheim', !String(u.token).includes(GEHEIM) && !Buffer.from(u.token.split('.')[0], 'base64url').toString().includes('geverifieerd'));
}

sectie('7. Fail-safe: bij een fout nooit een verificatiestatus');
{
  for (const [naam, inv] of [
    ['raw ontbreekt', { raw: null }],
    ['raw is een lijst', { raw: [] }],
    ['uid ongeldig', { uid: 'x' }],
    ['project ongeldig', { projectId: 'x' }],
    ['records geen lijst', { records: 'x' }],
  ]) {
    const w = wereld();
    const u = await preview(voorstel([regel('regeling', A)]), w, inv);

    check(`${naam}: ok:false, geen statusvelden, niets opgehaald`, u.ok === false && !('verificaties' in u) && !('token' in u) && w.calls.fetch.length === 0 && w.calls.dns.length === 0, JSON.stringify(u));
  }

  const kapot = await maakVoorstelPreview({ raw: voorstel([regel('regeling', A)]), uid: UID, projectId: PID, dekking: DEKKING, records: [recA] }, { resolveHost: async () => { throw new Error('boem'); }, fetchImpl: async () => { throw new Error('boem'); }, datumNu: () => NU });

  check('resolver en fetch gooien: preview ok, regel niet_gecontroleerd', kapot.ok && kapot.verificaties[0].metadata.verificatie.status === 'niet_gecontroleerd');

  const datumKapot = await maakVoorstelPreview({ raw: voorstel([regel('regeling', A)]), uid: UID, projectId: PID, dekking: DEKKING, records: [recA] }, { datumNu: () => { throw new Error('boem'); } });

  check('onverwachte uitzondering: ok:false onverwachte-fout', datumKapot.ok === false && datumKapot.reden === 'onverwachte-fout');

  const rommel = await preview(voorstel([null, 5, 'x', { type: 'regeling' }, { type: 'regeling', id: A, bedrag: { toString() { throw new Error('x'); } } }]), wereld());

  check('rommel in regels: geen throw', typeof rommel.ok === 'boolean');
  check('nooit "geverifieerd" in een mislukte uitkomst', JSON.stringify(datumKapot).indexOf('geverifieerd') === -1);
}

sectie('8. Limieten: aantal, gelijktijdigheid en totaal budget');
{
  const ids = Array.from({ length: 8 }, (_, i) => `a${i}aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`);
  const records = ids.map((id, i) => ({ type: 'regeling', id, niveau: 'volledig', naam: `Fonds Nummer${i} Voorbeeld`, website: `https://www.f${i}.example.nl/a`, deadline: null, min: null, max: null }));
  const dns = Object.fromEntries(ids.map((_, i) => [`www.f${i}.example.nl`, [OPENBAAR]]));
  const paginas = Object.fromEntries(ids.map((_, i) => [`https://www.f${i}.example.nl/a`, pagina(`<h1>Fonds Nummer${i} Voorbeeld</h1>`)]));
  const regels = ids.map((id, i) => regel('regeling', id, { naam: `Fonds Nummer${i} Voorbeeld`, bedrag: 1000 }));

  let bezig = 0;
  let piek = 0;
  const w = omgeving({ dns, paginas: Object.fromEntries(Object.entries(paginas).map(([u, p]) => [u, async () => { bezig++; piek = Math.max(piek, bezig); await wacht(15); bezig--; return p; }])) });
  const u = await preview(voorstel(regels), w, { records });

  check('acht regels: ok', u.ok && u.voorstel.regels.length === 8, JSON.stringify(u.ok ? u.overgeslagen : u));
  check(`hoogstens ${MAX_VERIFICATIES_PER_VOORSTEL} pagina's opgehaald`, w.calls.fetch.length <= MAX_VERIFICATIES_PER_VOORSTEL, String(w.calls.fetch.length));
  check('de rest: limiet, geen verificatieclaim', u.ok && u.verificaties.filter((v) => v.reden === 'limiet').length === 8 - MAX_VERIFICATIES_PER_VOORSTEL && u.verificaties.filter((v) => v.reden === 'limiet').every((v) => v.metadata?.verificatie === undefined));
  check(`hoogstens ${MAX_GELIJKTIJDIG} gelijktijdig (piek ${piek})`, piek <= MAX_GELIJKTIJDIG && piek >= 1);

  let t = 0;
  const w2 = omgeving({ dns, paginas });
  const u2 = await preview(voorstel(regels), w2, { records, deps: { klok: () => (t += VERIFICATIE_BUDGET_MS / 2) } });

  check('budget op: resterende regels krijgen reden budget en worden niet opgehaald', u2.ok && u2.verificaties.some((v) => v.reden === 'budget') && w2.calls.fetch.length < 8, JSON.stringify(u2.ok ? u2.verificaties.map((v) => v.reden) : u2));
}

sectie('9. Statische eigenschappen: niets schrijft, niets lekt');
{
  const bron = readFileSync('supabase/functions/_shared/voorstelVerificatie.ts', 'utf8');
  const code = bron.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

  for (const [naam, patroon] of [
    ['geen supabase-client', /supabase|createClient/i],
    ['geen database-schrijven', /\.(insert|update|upsert|delete|rpc)\s*\(/],
    ['geen directe fetch', /(^|[^a-zA-Z.])fetch\s*\(/],
    ['geen Deno-API', /\bDeno\./],
    ['geen browseropslag', /localStorage|sessionStorage|indexedDB/],
    ['geen omgevingsvariabelen', /process\.env|Deno\.env/],
    ['geen console-uitvoer met inhoud', /console\.(log|error|warn)/],
    ['geen toekenning van de status geverifieerd', /status\s*[:=]\s*['"]geverifieerd['"]/],
  ]) check(naam, !patroon.test(code), patroon.toString());

  const imports = [...bron.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]).sort();

  gelijk('alleen _shared-bestanden geïmporteerd', imports, ['./fragmentZoeker.ts', './verificationResult.ts', './voorstelContract.js', './voorstelContract.js', './voorstelMetadata.ts', './voorstelMetadata.ts', './voorstelToken.ts', './voorstelToken.ts', './verificationResult.ts'].sort());
}

klaar('ORKESTRATIE');
