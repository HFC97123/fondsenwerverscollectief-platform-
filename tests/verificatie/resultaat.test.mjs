// Verificatieresultaat end-to-end (Fase B1): entitlement-contract, fail-safe, centrale status, conflictblok, logprivacy en statische contracten.
// Alles met nagebootste DNS en fetch; geen extern netwerk.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { verifieerBron, buildVerificationResult, bouwLogRegel, GEEN_BRONCONTROLE_TEKST, ONZEKER_TEKST, CONFLICT_TEKST } from '../../supabase/functions/_shared/verificationResult.ts';
import { bepaalVerificatieStatus, controleerMetadata } from '../../supabase/functions/_shared/voorstelMetadata.ts';
import { check, gelijk, sectie, klaar, stand, omgeving, pagina, OPENBAAR } from './hulp.mjs';

stand.naam = 'resultaat';

const HOST = 'www.fonds-a.example.nl';
const URL1 = `https://${HOST}/aanvragen`;
const FONDS = { naam: 'Rotterdams Jongerencultuurfonds' };
const PAG = '<h1>Rotterdams Jongerencultuurfonds</h1><p>Aanvragen kan tot 12 november 2026.</p><p>Maximaal &euro; 25.000 per aanvraag.</p>';
const NU = new Date('2026-10-14T10:00:00Z');

const wereld = (body = PAG, extra = {}) => omgeving({ dns: { [HOST]: [OPENBAAR] }, paginas: { [URL1]: pagina(body, extra) } });
const deps = (w) => ({ resolveHost: w.resolveHost, fetchImpl: w.fetchImpl, datumNu: () => NU });
const inv = (o = {}) => ({
  toegang: { zichtbaar: true }, verificatieId: 'abc-123', bronUrl: URL1, financier: FONDS,
  claims: { deadline: { waarde: '2026-11-12', fragment: 'Aanvragen kan tot 12 november 2026.', db: '2026-11-12' } },
  ...o,
});

sectie('1. Entitlement eerst: geen toegang = geen DNS, geen fetch, geen inhoud');
{
  const gevaarlijk = [
    { zichtbaar: false }, {}, null, undefined, { zichtbaar: 'true' }, { zichtbaar: 1 }, { zichtbaar: [] }, { zichtbaar: {} }, 'ja', true, { Zichtbaar: true },
  ];

  for (const t of gevaarlijk) {
    const w = wereld();
    const u = await verifieerBron(inv({ toegang: t }), deps(w));

    check(`toegang ${JSON.stringify(t)} -> niet uitgevoerd, categorie niet_zichtbaar`, u.uitgevoerd === false && u.categorie === 'niet_zichtbaar');
    check('  nul DNS-aanroepen en nul fetches', w.calls.dns.length === 0 && w.calls.fetch.length === 0);
    check('  uitkomst bevat geen inhoud van de kandidaat (geen host, naam, url, velden, tekst)',
      u.verificatie === null && u.samenvatting === null && u.velden.length === 0 && u.eindgebruikerTekst === null &&
      !JSON.stringify(u).includes(HOST) && !JSON.stringify(u).includes('Rotterdams') && !u.logRegel.includes(HOST));
  }

  // Geen invoerobject, of een invoerobject zonder toegang: ook veilig
  const w = wereld();
  const u1 = await verifieerBron(undefined, deps(w));
  const u2 = await verifieerBron({ bronUrl: URL1, financier: FONDS, claims: {} }, deps(w));

  check('ontbrekende invoer / ontbrekende toegang: niet uitgevoerd, geen netwerk', !u1.uitgevoerd && !u2.uitgevoerd && w.calls.dns.length === 0 && w.calls.fetch.length === 0);

  // Een publiek vindbare pagina met geldige bron maakt een onzichtbare kandidaat niet zichtbaar
  const w2 = wereld();
  const u3 = await verifieerBron(inv({ toegang: { zichtbaar: false } }), deps(w2));

  check('publiek vindbare pagina + geen toegang: nog steeds niets', u3.uitgevoerd === false && w2.calls.fetch.length === 0);

  // Strikte vergelijking: een getter die "waar" lijkt maar niet === true is
  const w3 = wereld();
  const u4 = await verifieerBron(inv({ toegang: { get zichtbaar() { return new Boolean(true); } } }), deps(w3));

  check('Boolean-object telt niet als true', u4.uitgevoerd === false && w3.calls.fetch.length === 0);
}

sectie('2. Met toegang: volledige keten');
{
  const w = wereld();
  const u = await verifieerBron(inv(), deps(w));

  gelijk('categorie en samenvatting', [u.uitgevoerd, u.categorie, u.samenvatting], [true, 'ok', 'geverifieerd']);
  check('exact een DNS-controle en een fetch', w.calls.dns.length === 1 && w.calls.fetch.length === 1);
  check('verificatieblok is schema-geldig (metadata v2)', controleerMetadata({ versie: 2, server_generated: true, herkomst: 'online', voorgesteld_op: '2026-10-14', verificatie: u.verificatie }).geldig === true);
  check('deadline confirmed met fragment', u.verificatie.velden.deadline.status === 'confirmed' && (u.verificatie.velden.deadline.fragment ?? '').includes('12 november 2026'), JSON.stringify(u.verificatie.velden.deadline));
  check('pagina-hash en urls staan in het blok', /^[0-9a-f]{64}$/.test(u.verificatie.pagina_sha256) && u.verificatie.bron_url === URL1 && u.verificatie.eind_url === URL1 && u.verificatie.gecontroleerd_op === NU.toISOString());
  check('geverifieerd (naam + deadline bewezen, niets onzeker): geen waarschuwingstekst', u.eindgebruikerTekst === null);

  // Een extra claim die niet bewezen wordt, verlaagt de status naar gedeeltelijk (volgt de centrale regel, geen eigen logica)
  const w2 = wereld();
  const u2 = await verifieerBron(inv({ claims: { deadline: { waarde: '2026-11-12', fragment: 'Aanvragen kan tot 12 november 2026.' }, bedrag_max: { waarde: 50000, fragment: 'Maximaal EUR 50.000' } } }), deps(w2));

  check('extra onbewezen bedragclaim: gedeeltelijk met terughoudende tekst', u2.samenvatting === 'gedeeltelijk' && u2.eindgebruikerTekst === ONZEKER_TEKST, `${u2.samenvatting}`);

  // Alleen een fondsnaam bevestigd, geen deadlineclaim: gedeeltelijk, nooit geverifieerd
  const u3 = await verifieerBron(inv({ claims: {} }), deps(wereld()));

  check('alleen naam bevestigd (geen deadline): gedeeltelijk, niet geverifieerd', u3.samenvatting === 'gedeeltelijk' && u3.eindgebruikerTekst === ONZEKER_TEKST, `${u3.samenvatting}`);
}

sectie('3. De status komt uit de centrale functie (geen tweede logica)');
{
  const w = wereld();
  const u = await verifieerBron(inv(), deps(w));

  check('samenvatting === bepaalVerificatieStatus(velden)', u.samenvatting === bepaalVerificatieStatus(u.verificatie.velden, u.verificatie), `${u.samenvatting}`);

  // Een bronpagina waarop alles voor alle negen velden bevestigd is, is nog steeds niet automatisch "geverifieerd" in B1
  // (kwalitatieve velden worden nooit bevestigd): de uitkomst volgt hoe dan ook de centrale functie.
  const w2 = omgeving({ dns: { [HOST]: [OPENBAAR] }, paginas: { [URL1]: pagina('<h1>Ander Fonds</h1><p>Aanvragen kan tot 12 november 2026.</p>') } });
  const u2 = await verifieerBron(inv(), deps(w2));

  check('financier niet gevonden: categorie financier_not_found, deadline nooit confirmed', u2.categorie === 'financier_not_found' && u2.verificatie.velden.deadline?.status !== 'confirmed');
  check('  samenvatting volgt de centrale functie', u2.samenvatting === bepaalVerificatieStatus(u2.verificatie.velden, u2.verificatie));
  check('  eindgebruikerstekst is generiek en terughoudend', [ONZEKER_TEKST, GEEN_BRONCONTROLE_TEKST].includes(u2.eindgebruikerTekst));

  // Statische controle: de module bepaalt zelf nooit het woord "geverifieerd"
  const bron = readFileSync('supabase/functions/_shared/verificationResult.ts', 'utf8').replace(/\/\/.*$/gm, '');

  check("verificationResult.ts zet 'geverifieerd' nergens zelf (alleen een vergelijking voor de tekst)", !/(status|samenvatting)\s*[:=]\s*['"]geverifieerd['"]|return\s+['"]geverifieerd['"]/.test(bron) && (bron.match(/['"]geverifieerd['"]/g) ?? []).length <= 1);
}

sectie('4. Conflict: schema-geldig blok met DB-waarde, webwaarde, fragment');
{
  const w = wereld();
  const u = await verifieerBron(inv({ claims: { deadline: { waarde: '2026-11-12', fragment: 'Aanvragen kan tot 12 november 2026.', db: '2026-12-01' } } }), deps(w));

  check('web bewijst een andere datum dan de database -> conflict', u.verificatie.velden.deadline.status === 'conflict', JSON.stringify(u.verificatie.velden.deadline));
  check('  conflictveld bevat waarde, db_waarde en fragment/hash', u.verificatie.velden.deadline.waarde === '2026-11-12' && u.verificatie.velden.deadline.db_waarde === '2026-12-01' && !!(u.verificatie.velden.deadline.fragment || u.verificatie.velden.deadline.fragment_sha256));
  check('  blok valt in het databaseschema', controleerMetadata({ versie: 2, server_generated: true, herkomst: 'online', voorgesteld_op: '2026-10-14', verificatie: u.verificatie }).geldig === true);
  check('  samenvatting conflict en conflicttekst', u.samenvatting === 'conflict' && u.eindgebruikerTekst === CONFLICT_TEKST);
  check('  databasewaarde is niet overschreven in de details', u.velden.find((v) => v.veld === 'deadline').db_waarde === '2026-12-01');

  // Conflict zonder bewijs (fragment ontbreekt): geen conflict, en nooit een ongeldig blok
  const u2 = await verifieerBron(inv({ claims: { deadline: { waarde: '2026-11-12', db: '2026-12-01' } } }), deps(wereld()));

  check('afwijkende claim zonder bewijs is geen conflict', u2.verificatie.velden.deadline?.status !== 'conflict');

  // Noodvangnet: een conflict zonder bewijs in de bouwfunctie leidt tot onzeker, niet tot een ongeldig blok
  const x = buildVerificationResult({
    verificatieId: 'x', nu: NU, duurMs: 5, bron: { bronUrl: URL1, eindUrl: URL1, hostnaam: HOST, httpStatus: 200, redirects: 0 }, fetchFout: null,
    paginaSha256: 'a'.repeat(64), financier: { gevonden: true, via: 'naam', generiek: false, domeinMatch: false, reden: 'ok' },
    vergelijkingen: [{ veld: 'deadline', status: 'conflict', reden: 'x' }],
  });

  check('conflict zonder waarde/db/fragment wordt onzeker, blok blijft schema-geldig', x.verificatie.velden?.deadline?.status !== 'conflict' && controleerMetadata({ versie: 2, server_generated: true, herkomst: 'online', voorgesteld_op: '2026-10-14', verificatie: x.verificatie }).geldig === true, JSON.stringify(x.verificatie));
}

sectie('5. Fail-safe: elke foutcategorie eindigt in niet_gecontroleerd, nooit een throw, nooit confirmed');
{
  const gevallen = {
    invalid_url: { url: 'not a url' },
    forbidden_host: { url: 'https://localhost/x' },
    forbidden_ip: { url: `https://${HOST}/aanvragen`, dns: { [HOST]: ['10.0.0.5'] } },
    dns_failed: { url: `https://${HOST}/aanvragen`, dns: {} },
    http_error: { url: URL1, dns: { [HOST]: [OPENBAAR] }, pagina: { status: 500, contentType: 'text/html', body: 'kapot' } },
    unsupported_content_type: { url: URL1, dns: { [HOST]: [OPENBAAR] }, pagina: { status: 200, contentType: 'application/pdf', body: '%PDF' } },
    empty_body: { url: URL1, dns: { [HOST]: [OPENBAAR] }, pagina: { status: 200, contentType: 'text/html', body: '' } },
    redirect_blocked: { url: URL1, dns: { [HOST]: [OPENBAAR] }, pagina: { status: 302, location: 'http://169.254.169.254/latest' } },
    timeout: { url: URL1, dns: { [HOST]: [OPENBAAR] }, pagina: { hang: true }, timeoutMs: 80 },
  };

  for (const [naam, g] of Object.entries(gevallen)) {
    const w = omgeving({ dns: g.dns ?? {}, paginas: g.pagina ? { [g.url]: g.pagina } : {} });
    let u;
    let gegooid = false;

    try {
      u = await verifieerBron(inv({ bronUrl: g.url }), { ...deps(w), ...(g.timeoutMs ? { timeoutMs: g.timeoutMs } : {}) });
    } catch {
      gegooid = true;
    }

    check(`${naam}: geen throw`, !gegooid);
    if (gegooid) continue;

    check(`  ${naam}: categorie ${naam}`, u.categorie === naam, u.categorie);
    check(`  ${naam}: niet_gecontroleerd, geen enkel veld confirmed`, u.samenvatting === 'niet_gecontroleerd' && !Object.values(u.verificatie.velden ?? {}).some((v) => v.status === 'confirmed'));
    check(`  ${naam}: generieke eindgebruikerstekst zonder details`, u.eindgebruikerTekst === GEEN_BRONCONTROLE_TEKST && !/169\.254|10\.0\.0|ssrf|dns|forbidden|localhost/i.test(u.eindgebruikerTekst));
    check(`  ${naam}: blok is schema-geldig`, controleerMetadata({ versie: 2, server_generated: true, herkomst: 'online', voorgesteld_op: '2026-10-14', verificatie: u.verificatie }).geldig === true);
  }

  // Onverwachte uitzondering diep in een afhankelijkheid
  const w = wereld();
  let gegooid = false;
  let u;

  try {
    u = await verifieerBron(inv(), { resolveHost: w.resolveHost, fetchImpl: w.fetchImpl, datumNu: () => { throw new Error('klok stuk'); } });
  } catch {
    gegooid = true;
  }

  check('onverwachte fout in een afhankelijkheid: geen throw', !gegooid);
  check('  levert onverwachte_fout met niet_gecontroleerd', !gegooid && u.categorie === 'onverwachte_fout' && u.samenvatting === 'niet_gecontroleerd' && u.eindgebruikerTekst === GEEN_BRONCONTROLE_TEKST);

  // Rare invoer
  for (const rommel of [{ bronUrl: undefined }, { bronUrl: 12345 }, { bronUrl: null }, { financier: null }, { financier: {} }, { claims: null }, { claims: { deadline: null } }, { claims: { deadline: { waarde: {} , fragment: 5 } } }]) {
    const w2 = wereld();
    let ok = true;
    let r;

    try { r = await verifieerBron(inv(rommel), deps(w2)); } catch { ok = false; }

    check(`rare invoer ${JSON.stringify(rommel)}: geen throw, nooit confirmed zonder bewijs`, ok && !Object.entries(r.verificatie?.velden ?? {}).some(([k, v]) => k === 'deadline' && v.status === 'confirmed'));
  }
}

sectie('6. Logregel: privacy- en securitybewust');
{
  const w = wereld('<h1>Rotterdams Jongerencultuurfonds</h1><p>geheimcode 12345 tot 12 november 2026</p>');
  const u = await verifieerBron(inv({ bronUrl: `${URL1}?token=GEHEIM&email=a@b.nl#frag`, verificatieId: 'id-1' }), deps(w));

  check('logregel bevat host, resultaat, status, http, redirects en ms', /^\[subsidie-kompas\] verificatie id=id-1 host=www\.fonds-a\.example\.nl resultaat=\w+ status=[\w-]+ http=\d+ redirects=\d+ ms=\d+$/.test(u.logRegel), u.logRegel);
  check('geen pad, query, fragment, e-mail, paginatekst of fondsnaam', !/aanvragen|token|GEHEIM|a@b|geheimcode|Rotterdams|frag|\?/.test(u.logRegel), u.logRegel);

  const vies = bouwLogRegel({ verificatieId: 'a b\nc<script>', hostnaam: 'Evil.com/pad?x=1\r\nINJECT', categorie: 'ok\nfout', status: 'x y', httpStatus: Number.NaN, redirects: -4, duurMs: 1e9 });

  check('logregel-injectie niet mogelijk: geen regelinvoer of speciale tekens', !/[\n\r<>?\/ ]{2}|\n|\r/.test(vies) && vies.split('\n').length === 1, vies);

  const geenToegang = await verifieerBron(inv({ toegang: { zichtbaar: false } }), deps(wereld()));

  check('zonder toegang: host=- (de kandidaat wordt niet gelogd)', /host=-/.test(geenToegang.logRegel));
}

sectie('7. Statische contracten: niets gekoppeld, niets geactiveerd');
{
  const loop = (dir, uit = []) => {
    for (const f of readdirSync(dir)) {
      if (f === 'node_modules' || f === '.build' || f.startsWith('.')) continue;

      const p = join(dir, f);

      if (statSync(p).isDirectory()) loop(p, uit);
      else if (/\.(ts|tsx|js|jsx|mjs)$/.test(f)) uit.push(p);
    }

    return uit;
  };

  const helpers = ['safeFetch', 'ipRanges', 'readableText', 'sourceEvidence', 'verificationResult'];
  const importRe = (h) => new RegExp(`(from|import)\\s*\\(?\\s*['"][^'"]*_shared/${h}(\\.ts)?['"]`);

  const index = readFileSync('supabase/functions/subsidie-kompas/index.ts', 'utf8');
  const bronnen = loop('src');

  for (const h of helpers) {
    check(`index.ts importeert ${h} niet`, !importRe(h).test(index) && !new RegExp(`\\./${h}(\\.ts)?['"]`).test(index));
    check(`geen enkel bestand in src/ importeert ${h}`, !bronnen.some((p) => importRe(h).test(readFileSync(p, 'utf8'))));
  }

  // Binnen supabase/functions importeert alleen de eigen keten de helpers
  const functies = loop('supabase/functions').filter((p) => !p.includes('/_shared/'));

  check('geen enkele Edge Function importeert de nieuwe verificatiehelpers', !functies.some((p) => helpers.some((h) => importRe(h).test(readFileSync(p, 'utf8')))));

  // De helpers zelf: geen Deno-specifieke API's, geen secrets, geen omgevingsvariabelen, geen eigen netwerkcode behalve via injectie
  for (const h of helpers) {
    const t = readFileSync(`supabase/functions/_shared/${h}.ts`, 'utf8').replace(/\/\/.*$/gm, '');

    check(`${h}.ts: geen Deno.*, geen env, geen secrets`, !/\bDeno\./.test(t) && !/Deno\.env|process\.env|SERVICE_ROLE|SECRET/i.test(t));
    check(`${h}.ts: fetch alleen als vervangbare standaard in safeFetch (anders helemaal niet)`, h === 'safeFetch' ? (t.match(/(^|[^.\w])fetch\s*\(/gm) ?? []).length === 1 && /opties\.fetchImpl \?\? \(\(url, init\) => fetch\(url, init\)\)/.test(t) : !/(^|[^.\w])fetch\s*\(|XMLHttpRequest/.test(t));
    check(`${h}.ts: geen console.log van inhoud`, !/console\.(log|info|debug)/.test(t));
  }

  // Fase C: precies een nieuwe mode ('voorstel-preview', standaard uit, alleen lezen). Geen andere voorstel-/verificatiemode.
  const modes = [...index.matchAll(/mode\s*===\s*['"]((?:voorstel|verificatie|verifieer)[a-z-]*)['"]/g)].map((m) => m[1]);

  check('index.ts kent precies een voorstel-/verificatiemode: voorstel-preview', modes.length === 1 && modes[0] === 'voorstel-preview', JSON.stringify(modes));
  check('de mode staat standaard uit (omgevingsvlag VOORSTEL_PREVIEW)', /Deno\.env\.get\('VOORSTEL_PREVIEW'\) !== 'aan'/.test(index));
}

klaar('RESULTAAT');
