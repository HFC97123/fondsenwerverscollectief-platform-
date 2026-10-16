// Echte browser (Chromium) tegen de echte app-build met de voorstel-vlaggen aan, en de ECHTE Edge Function-code als server.
//   node tests/voorstel-werkruimte/browser/build.mjs  (bouwt web/)
//   WEB=<map> PLAYWRIGHT=<pad> CHROMIUM=<pad> node tests/voorstel-genereren/bundle.mjs tests/voorstel-werkruimte/browser/e2e.test.mjs tests/voorstel-werkruimte/browser/.build/e2e.mjs
// De browser praat met een nep-Supabase (zoals tests/werkruimte/browser); de aanroepen naar de Edge Function gaan naar de echte handler (Node) met
// een in-memory database. De opgeslagen staat wordt bij elke serverreactie naar de browser gespiegeld en bij verversen opnieuw ingeladen.
import http from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { PID, w, resetGenereren, regeling, fonds, online, projectRij, TAXONOMIE } from '../../voorstel-genereren/wereld.mjs';
import '../../../supabase/functions/subsidie-kompas/index.ts';

const WEB = process.env.WEB || resolve('tests/voorstel-werkruimte/browser/web');
const SHOTS = process.env.SHOTS || resolve('tests/voorstel-werkruimte/browser/shots');
mkdirSync(SHOTS, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');

const stand = { ok: 0, fout: 0 };
const check = (naam, waar, detail = '') => { if (waar) { stand.ok += 1; console.log(`  OK   ${naam}`); } else { stand.fout += 1; console.log(`  FAIL ${naam} ${detail}`); } };
const sectie = (t) => console.log(`\n== ${t}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PRO = { subscription_tier: 'pro', subscription_active: true, trial_ends_at: null, role: 'user' };
const PREMIUM = { subscription_tier: 'premium', subscription_active: true, trial_ends_at: null, role: 'user' };
const A1 = '00000000-0000-4000-8000-0000000000a1';
const A3 = '00000000-0000-4000-8000-0000000000a3';
const A4 = '00000000-0000-4000-8000-0000000000a4';
const F1 = '00000000-0000-4000-8000-0000000000f1';
const H1 = 'rotterdamsmuziekfonds.example.nl';
const GOED = '<html><head><title>x</title></head><body><h1>Rotterdams Muziekfonds</h1><p>Aanvragen kan tot 15 december 2026.</p><p>Maximaal € 60.000 per aanvraag.</p><p>Minimaal € 5.000 per project.</p></body></html>';

const pool = () => ({
  regelingen: [
    regeling({ naam: 'Rotterdams Muziekfonds', gever: 'Gemeente Rotterdam', min: 5000, max: 60000, id: A1 }),
    regeling({ naam: 'Landelijk Muziekpodium', gever: 'Landelijk Podium', min: 1000, max: 25000, regios: ['Landelijk'], id: A3, deadline: null }),
    regeling({ naam: 'Jongerencultuur Impuls', gever: 'Impuls Gever', min: 2000, max: 30000, id: A4 }),
  ],
  funders: [fonds({ naam: 'Fonds Voorbeeld', min: 1000, max: 15000, id: F1 })],
  dns: { [`www.${H1}`]: ['93.184.216.34'], 'www.landelijkmuziekpodium.example.nl': ['93.184.216.34'] },
  paginas: { [`https://www.${H1}/aanvragen`]: GOED },
});

// ------------------------------------------------------------------------------------------------------------------ server + brug
let faal = { opslaan: 0, genereren: 0 };
let aanroepen = [];
let verzoeken = []; // alle bodies die de browser naar de Edge Function stuurde (voor controle van wat er echt over de lijn ging)
let seedBegroting = { totaal: 100000, eigen: 20000 }; // de begroting van het project zoals de BROWSER het kent (de server leest zijn eigen project)

const staat = () => {
  const lid = (r) => ({ ...r, user_id: 'u1' });
  const bronnen = {};

  w.regelingen.forEach((r) => { bronnen[r.regeling_id] = { naam: r.naam, funder: r.funder_naam, website: r.funder_website, deadline: r.deadline_datum }; });
  w.funders.forEach((f) => { bronnen[f.funder_id] = { naam: f.funder_naam, funder: f.funder_naam, website: f.funder_website, deadline: null }; });

  return { funding: w.db.funding.map(lid), actions: w.db.actions.map(lid), bron: w.bron.map(lid), open: w.wachtrij.map(lid), bronnen };
};

async function serverCall(body) {
  aanroepen.push(body.mode || 'chat');
  verzoeken.push(body);

  // Gewone chatberichten (geen voorstel-mode): een vast antwoord; de chatbot zelf valt buiten deze test. Het gaat om de kaart onder het gesprek.
  if (!body.mode) {
    return { status: 200, json: { answer: 'Mooi project! Ik kijk met u mee naar passende fondsen.', sources: [] }, staat: staat() };
  }

  if (body.mode === 'voorstel-genereren' && faal.genereren > 0) {
    faal.genereren -= 1;

    return { status: 500, json: { error: 'interne fout' }, staat: staat() };
  }

  if (body.mode === 'voorstel-opslaan' && faal.opslaan > 0) {
    faal.opslaan -= 1;

    return { status: 500, json: { error: 'interne fout' }, staat: staat() };
  }

  const res = await globalThis.__handler(new Request('http://x/f', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer jwt' }, body: JSON.stringify(body) }));
  const tekst = await res.text();
  let json = null;

  try { json = JSON.parse(tekst); } catch { /* geen json */ }

  return { status: res.status, json, staat: staat() };
}

const server = http.createServer((req, res) => {
  const pad = decodeURIComponent(req.url.split('?')[0]);

  if (pad === '/' || pad === '/index.html') {
    let html = readFileSync(join(WEB, 'index.html'), 'utf8');
    const patch = `<script>window.__STAAT=${JSON.stringify(staat())};window.__SEED_PATCH=function(seed,h){var S=window.__STAAT,T=seed.tables,P=h.P2;
      Object.assign(T.subsidie_kompas_programs.find(function(p){return p.id===P}),{name:'Rotterdam Beats',description:'Een muziekproject voor jongeren in Rotterdam.',goals:'Talentontwikkeling',activities:'Workshops en optredens',location:'Rotterdam',target_groups:'Jongeren',budget_total:${JSON.stringify(seedBegroting.totaal)},own_contribution:${JSON.stringify(seedBegroting.eigen)}});
      var TX=${JSON.stringify(TAXONOMIE)};T.themas=TX.themas.map(function(n){return {naam:n}});T.doelgroepen=TX.doelgroepen.map(function(n){return {naam:n}});T.regios=TX.regios.map(function(n){return {naam:n}});
      T.subsidie_kompas_program_actions=S.actions;T.subsidie_kompas_bron_controles=S.bron;T.subsidie_kompas_actieplan_open=S.open;
      T.subsidie_kompas_program_funding=T.subsidie_kompas_program_funding.filter(function(r){return r.program_id!==P}).concat(S.funding);
      Object.assign(seed.bronnen,S.bronnen);};</script>`;

    html = html.replace('<body style="margin:0">', `<body style="margin:0">${patch}`);
    res.writeHead(200, { 'content-type': 'text/html' });

    return res.end(html);
  }

  try {
    const bestand = readFileSync(join(WEB, pad));
    const type = pad.endsWith('.js') || pad.endsWith('.mjs') ? 'text/javascript' : pad.endsWith('.css') ? 'text/css' : pad.endsWith('.png') ? 'image/png' : 'application/octet-stream';

    res.writeHead(200, { 'content-type': type });
    res.end(bestand);
  } catch {
    res.writeHead(404);
    res.end();
  }
}).listen(0);

const PORT = server.address().port;
const BASE = `http://localhost:${PORT}/index.html`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });

async function nieuwePagina(tier = 'pro', viewport = { width: 1280, height: 1000 }, { hash = `#/kompas/projecten/${PID}?tab=projectfinanciering`, wacht = '[data-testid="voorstel-start-knop"]' } = {}) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();

  page.fouten = [];
  page.on('pageerror', (e) => page.fouten.push(String(e)));
  await context.exposeFunction('__serverCall', serverCall);
  await context.addInitScript(() => {
    window.__FN = async (naam, body) => {
      const r = await window.__serverCall(body);
      const d = window.__DBL || (window.__DBL = JSON.parse(JSON.stringify(window.__SEED.tables)));
      const P = '22222222-2222-4222-8222-222222222222';

      d.subsidie_kompas_program_funding = d.subsidie_kompas_program_funding.filter((x) => x.program_id !== P).concat(r.staat.funding);
      d.subsidie_kompas_program_actions = r.staat.actions;
      d.subsidie_kompas_bron_controles = r.staat.bron;
      d.subsidie_kompas_actieplan_open = r.staat.open;
      Object.assign(window.__SEED.bronnen, r.staat.bronnen);

      if (r.status >= 200 && r.status < 300) return { data: r.json, error: null };

      return { data: null, error: { message: 'Edge Function returned a non-2xx status code', context: new Response(JSON.stringify(r.json), { status: r.status }) } };
    };
  });
  // Het onboarding-/meldingenlaagje van de testpagina mag de klikken niet afvangen.
  await context.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = 'div[style*="z-index: 2000"]{display:none !important}'; document.head.appendChild(s); }));
  // De chat probeert eerst te streamen via fetch; dat is er in deze test niet. De fallback (supabase.functions.invoke) gaat via de brug hierboven.
  await context.route('**/functions/v1/**', (r) => r.fulfill({ status: 500, body: 'geen stream' }));
  await page.goto(`${BASE}?tier=${tier}${hash}`);
  await page.waitForSelector(wacht, { timeout: 15000 });

  return { context, page };
}

const t = (page, id) => page.locator(`[data-testid="${id}"]`);

// Er is geen zoekprofielstap meer: na "Maak dekkingsplan…" zoekt Subsidiekompas meteen. Wachten tot er een voorstel of een fout is.
async function bevestigProfiel(page) {
  await page.waitForSelector('[data-testid="voorstel-resultaat"], [data-testid="voorstel-fout"], [data-testid="voorstel-voortgang"]', { timeout: 25000 });
}
const tekstVan = async (page, id) => ((await t(page, id).count()) ? (await t(page, id).first().innerText()) : '');
const namenVan = (l) => (l || []).map((x) => x.naam);
const dubbelen = () => {
  const sleutels = w.db.actions.map((a) => `${a.funding_id}|${a.title}`);

  return sleutels.length - new Set(sleutels).size;
};

// ------------------------------------------------------------------------------------------------------------------------------------
sectie('1. Pro: voorstel maken, controleren, opslaan na een fout, actieplan opnieuw na een fout, verversen');
{
  resetGenereren({ ...pool(), profile: PRO, dbActief: true });
  aanroepen = [];
  faal = { opslaan: 0 };
  const { context, page } = await nieuwePagina('pro');
  const knop = t(page, 'voorstel-start-knop');

  check('startknop is actief (vlaggen aan, project compleet)', (await knop.isEnabled()) && /Maak dekkingsplan en actieplan met Subsidiekompas/.test(await knop.innerText()));
  await page.screenshot({ path: join(SHOTS, '01-start.png'), fullPage: true });
  await knop.click();
  await bevestigProfiel(page);
  await page.waitForSelector('[data-testid="voorstel-resultaat"]', { timeout: 20000 });
  await page.waitForSelector('[data-testid="voorstel-controles-klaar"]', { timeout: 20000 }).catch(() => {});
  await sleep(400);
  const rijen = await t(page, 'voorstel-rij').count();

  check('voorstel getoond met regels, geen pageerrors', rijen >= 2 && page.fouten.length === 0, `${rijen} ${page.fouten.join('|')}`);
  check('de server legde de broncontroles vast (poging per regel), de browser schreef niets', aanroepen.includes('voorstel-genereren') && aanroepen.filter((m) => m === 'voorstel-controleer').length >= 1 && w.db.funding.length === 0 && w.bron.length >= 1, JSON.stringify(aanroepen));
  check('buffer en dekkingsdoel zichtbaar (Pro 110%)', /110/.test(await tekstVan(page, 'voorstel-buffer') + await tekstVan(page, 'voorstel-totalen')), await tekstVan(page, 'voorstel-buffer'));
  await page.screenshot({ path: join(SHOTS, '02-voorstel.png'), fullPage: true });

  // Opslaan: eerste poging faalt technisch (500). Er is niets opgeslagen en de keuzes blijven staan.
  faal.opslaan = 1;
  await t(page, 'voorstel-opslaan').click();
  await page.waitForSelector('[data-testid="voorstel-opslaan-fout"]', { timeout: 10000 });
  check('opslaan faalt: foutmelding, niets in de database, voorstel blijft zichtbaar', w.db.funding.length === 0 && w.db.actions.length === 0 && (await t(page, 'voorstel-rij').count()) === rijen, await tekstVan(page, 'voorstel-opslaan-fout'));
  await page.screenshot({ path: join(SHOTS, '03-opslaan-fout.png'), fullPage: true });

  // Tweede poging: het dekkingsplan lukt, maar het aanmaken van taken faalt.
  w.dbFout = { actions: { code: 'XX000' } };
  await t(page, 'voorstel-opslaan').click();
  await page.waitForSelector('[data-testid="voorstel-opgeslagen"]', { timeout: 15000 });
  const n = w.db.funding.length;

  check('opnieuw proberen: dekkingsplan opgeslagen, geen dubbele regels', n >= 2 && n === new Set(w.db.funding.map((f) => f.scheme_id || f.funder_id)).size);
  check('actieplan is mislukt/deels: duidelijke uitleg en knop "opnieuw proberen"', (await t(page, 'actieplan-opnieuw').count()) === 1 && /dekkingsplan is opgeslagen/i.test(await tekstVan(page, 'voorstel-actieplan')), await tekstVan(page, 'voorstel-actieplan'));
  check('Bespreek met Subsidiekompas per opgeslagen regel in de samenvatting', (await t(page, 'voorstel-opgeslagen').locator('[data-testid="bespreek-link"]').count()) === n);
  const hrefs = await t(page, 'voorstel-opgeslagen').locator('[data-testid="bespreek-link"]').evaluateAll((a) => a.map((x) => x.getAttribute('href')));

  check('de links bevatten de echte fundingIds van de opgeslagen rijen', w.db.funding.every((f) => hrefs.some((h) => h.includes(f.id))), hrefs.join(' | '));
  await page.screenshot({ path: join(SHOTS, '04-actieplan-mislukt.png'), fullPage: true });

  // Opnieuw proberen met de fout nog actief: blijft mislukt, geen dubbelen; daarna lukt het.
  await t(page, 'actieplan-opnieuw').click();
  await sleep(800);
  check('opnieuw proberen met nog steeds een fout: meldt het eerlijk, niets dubbel', w.db.actions.length === 0 && (await t(page, 'actieplan-opnieuw').count()) === 1);
  w.dbFout = null;
  await t(page, 'actieplan-opnieuw').click();
  await page.waitForFunction(() => document.querySelector('[data-testid="voorstel-actieplan"]')?.dataset.status === 'klaar', null, { timeout: 15000 });
  const aantal = w.db.actions.length;

  check('opnieuw proberen na herstel: actieplan klaar, taken aangemaakt, geen dubbele taken', aantal >= 8 && dubbelen() === 0, `${aantal} ${dubbelen()}`);
  check('elke regel heeft meerdere concrete vervolgstappen (ook zonder bekende deadline)', w.db.funding.every((f) => w.db.actions.filter((x) => x.funding_id === f.id).length >= 4));
  await page.screenshot({ path: join(SHOTS, '05-actieplan-klaar.png'), fullPage: true });
  check('nog een keer opnieuw kan niet meer (knop weg) en dubbel opslaan is onmogelijk', (await t(page, 'actieplan-opnieuw').count()) === 0);

  // Verversen: alles blijft staan, statussen komen van de server.
  await page.reload();
  await page.waitForSelector('[data-testid="pf-regel"]', { timeout: 15000 });
  await sleep(500);
  const regels = await t(page, 'pf-regel').count();

  check('na verversen: dekkingsplan toont de opgeslagen regels', regels === n, `${regels} vs ${n}`);
  const regelTekst = (await t(page, 'pf-regel').allInnerTexts()).join('\n');

  check('na verversen: bronstatus per regel uit de server (gecontroleerd / niet gecontroleerd), los van de financieringsstatus', /Interessant/.test(regelTekst) && /(Gecontroleerd|gecontroleerd)/.test(regelTekst), regelTekst.slice(0, 400));
  check('na verversen: Bespreek-link per regel in het dekkingsplan', (await t(page, 'bespreek-link').count()) >= n);
  check('na verversen: acties en deadlines tonen de opgeslagen taken', (await t(page, 'ap-taak').count()) >= 1);
  await page.screenshot({ path: join(SHOTS, '06-na-verversen.png'), fullPage: true });

  // Opnieuw starten na verversen: opgeslagen regels worden niet nogmaals voorgesteld/opgeslagen.
  await t(page, 'voorstel-start-knop').click();
  await bevestigProfiel(page);
  await page.waitForSelector('[data-testid="voorstel-resultaat"], [data-testid="voorstel-fout"], [data-testid="zp-melding"]', { timeout: 20000 });
  await sleep(500);
  await page.screenshot({ path: join(SHOTS, '07-opnieuw-starten.png'), fullPage: true });
  check('na verversen opnieuw starten: geen dubbele regels of taken in de database', w.db.funding.length === n && dubbelen() === 0);
  check('geen pageerrors in de hele sessie', page.fouten.length === 0, page.fouten.join(' | '));
  await context.close();
}

// ------------------------------------------------------------------------------------------------------------------------------------
sectie('1b. Actieplan mislukt, PAGINA VERVERST: "Actieplan opnieuw proberen" blijft beschikbaar (door de server bewaard)');
{
  resetGenereren({ ...pool(), profile: PRO, dbActief: true });
  aanroepen = [];
  faal = { opslaan: 0 };
  const { context, page } = await nieuwePagina('pro');

  check('begin: geen banner voor open taken', (await t(page, 'actieplan-open').count()) === 0);
  await t(page, 'voorstel-start-knop').click();
  await bevestigProfiel(page);
  await page.waitForSelector('[data-testid="voorstel-resultaat"]', { timeout: 20000 });
  await page.waitForSelector('[data-testid="voorstel-controles-klaar"]', { timeout: 20000 }).catch(() => {});
  w.dbFout = { actions: { code: 'XX000' } };
  await t(page, 'voorstel-opslaan').click();
  await page.waitForSelector('[data-testid="voorstel-opgeslagen"]', { timeout: 15000 });

  const n = w.db.funding.length;
  const open = w.wachtrij.length;

  check('dekkingsplan staat, geen enkele taak, de server bewaarde alle open taken', n >= 2 && w.db.actions.length === 0 && open >= 8, `${n} ${w.db.actions.length} ${open}`);

  // VERVERSEN: de browser start helemaal opnieuw; alleen de database blijft.
  await page.reload();
  await page.waitForSelector('[data-testid="actieplan-open"]', { timeout: 15000 });
  await page.screenshot({ path: join(SHOTS, '08-banner-na-verversen.png'), fullPage: true });
  check('na verversen: banner met het aantal open taken en uitleg', (await t(page, 'actieplan-open').getAttribute('data-aantal')) === String(open) && /nog niet compleet/.test(await tekstVan(page, 'actieplan-open')), await tekstVan(page, 'actieplan-open'));
  check('na verversen: de knop "Actieplan opnieuw proberen" is er', (await t(page, 'actieplan-open-opnieuw').count()) === 1);
  check('na verversen: het dekkingsplan toont de opgeslagen regels', (await t(page, 'pf-regel').count()) === n);

  // Opnieuw proberen terwijl de fout nog actief is: eerlijke melding, alles blijft staan.
  aanroepen = [];
  await t(page, 'actieplan-open-opnieuw').click();
  await page.waitForSelector('[data-testid="actieplan-open-fout"], [data-testid="actieplan-open"][data-aantal]', { timeout: 10000 });
  await sleep(600);
  check('herstel terwijl de fout nog actief is: geen taken, wachtrij en knop blijven', w.db.actions.length === 0 && w.wachtrij.length === open && (await t(page, 'actieplan-open-opnieuw').count()) === 1, `${w.db.actions.length} ${w.wachtrij.length}`);

  // Fout opgelost, nu gaat de browser alleen het project-id sturen.
  w.dbFout = null;
  await t(page, 'actieplan-open-opnieuw').dblclick();
  await page.waitForSelector('[data-testid="actieplan-open-klaar"]', { timeout: 15000 });
  await page.screenshot({ path: join(SHOTS, '09-banner-hersteld.png'), fullPage: true });
  const herstelAanroepen = aanroepen.filter((m) => m === 'voorstel-actieplan-herstel').length;

  check('dubbelklik op de knop: geen tweede gelijktijdige aanroep', herstelAanroepen <= 2, String(herstelAanroepen));
  check('taken aangemaakt, wachtrij leeg, geen dubbelen, dekkingsplan ongewijzigd', w.db.actions.length >= 8 && w.wachtrij.length === 0 && dubbelen() === 0 && w.db.funding.length === n, `${w.db.actions.length} ${w.wachtrij.length} ${dubbelen()}`);
  check('elke taak heeft de sleutel van de database (atomaire ontdubbeling)', w.db.actions.every((a) => typeof a.voorstel_sleutel === 'string' && a.voorstel_sleutel.includes('|')));
  check('elke regel heeft meerdere vervolgstappen', w.db.funding.every((f) => w.db.actions.filter((x) => x.funding_id === f.id).length >= 4));

  // Nogmaals verversen: banner weg, taken zichtbaar.
  await page.reload();
  await page.waitForSelector('[data-testid="pf-regel"]', { timeout: 15000 });
  await sleep(600);
  check('na nog een verversing: geen banner meer, taken zichtbaar in Acties & deadlines', (await t(page, 'actieplan-open').count()) === 0 && (await t(page, 'ap-taak').count()) >= 1);
  check('geen pageerrors', page.fouten.length === 0, page.fouten.join(' | '));
  await context.close();
}

// ------------------------------------------------------------------------------------------------------------------------------------
sectie('2. Premium: online suggestie met beoordelingsroute (onzekere status behouden) en Bespreek-link');
{
  const klein = { regelingen: [regeling({ naam: 'Rotterdams Muziekfonds', gever: 'Gemeente Rotterdam', min: 5000, max: 20000, id: A1 })], funders: [], dns: { [`www.${H1}`]: ['93.184.216.34'] }, paginas: { [`https://www.${H1}/aanvragen`]: GOED } };

  resetGenereren({ ...klein, profile: PREMIUM, dbActief: true, online: [1, 2, 3, 4].map((n) => online({ gever: `Online Fonds ${n}`, regeling: `Online Regeling ${n}`, bedragMin: 1000, bedragMax: 4000 })) });
  aanroepen = [];
  faal = { opslaan: 0 };
  const { context, page } = await nieuwePagina('premium');

  await t(page, 'voorstel-start-knop').click();
  await bevestigProfiel(page);
  await page.waitForSelector('[data-testid="voorstel-resultaat"]', { timeout: 30000 });
  await page.waitForSelector('[data-testid="voorstel-online"]', { timeout: 30000 });
  await sleep(500);
  const online1 = await tekstVan(page, 'voorstel-online');

  check('online suggesties staan apart, "nog niet gecontroleerd", standaard niet geselecteerd', /niet gecontroleerd/i.test(online1) && (await t(page, 'voorstel-suggestie').locator('input:checked').count()) === 0, online1.slice(0, 300));
  await page.screenshot({ path: join(SHOTS, '10-online-suggesties.png'), fullPage: true });
  await t(page, 'voorstel-suggestie').first().locator('input').check();
  await t(page, 'voorstel-opslaan').click();
  await page.waitForSelector('[data-testid="voorstel-opgeslagen"]', { timeout: 20000 });
  await sleep(500);
  const rijSug = w.db.funding.find((f) => f.financier_naam);

  check('suggestie opgeslagen als eigen regel zonder bedrag, status Interessant, "nog niet gecontroleerd" in de notitie', Boolean(rijSug) && rijSug.requested_amount === null && rijSug.status === 'interesting' && /nog niet gecontroleerd/.test(rijSug.notes), JSON.stringify(rijSug));
  check('suggestie heeft zijn eigen beoordelingsstappen (beoordelen, voorwaarden nagaan, beslissen)', Boolean(rijSug) && w.db.actions.filter((a) => a.funding_id === rijSug.id).length === 3);
  check('geen broncontrole voor de suggestie en nooit "gecontroleerd"', !w.bron.some((b) => b.record_id === rijSug?.id));
  const sam = await tekstVan(page, 'voorstel-opgeslagen');

  check('samenvatting: onzekere status en beoordelingsroute zichtbaar, Bespreek-link bij de suggestie', /niet gecontroleerd/i.test(sam) && /beoordelen of het past/.test(sam) && sam.split('Bespreek met Subsidie Kompas').length - 1 >= 2, sam.slice(0, 500));
  check('Bespreek-link van de suggestie wijst naar zijn eigen fundingId', (await t(page, 'voorstel-opgeslagen').locator('[data-testid="bespreek-link"]').evaluateAll((a) => a.map((x) => x.getAttribute('href')))).some((h) => h.includes(rijSug.id)));
  await page.screenshot({ path: join(SHOTS, '11-suggestie-opgeslagen.png'), fullPage: true });
  await page.reload();
  await page.waitForSelector('[data-testid="pf-regel"]', { timeout: 15000 });
  await sleep(500);
  const na = (await t(page, 'pf-regel').allInnerTexts()).join('\n');

  check('na verversen: de online suggestie staat in het dekkingsplan, nog steeds ongecontroleerd en zonder bedrag', new RegExp(rijSug.financier_naam.split(' - ')[0]).test(na) && /niet gecontroleerd|Bron: /i.test(na), na.slice(0, 600));
  check('na verversen: taken van de suggestie staan in Acties & deadlines', (await t(page, 'ap-taak').filter({ hasText: /beoordelen|Voorwaarden, deadline en bijdrage|Beslissen/ }).count()) >= 3);
  await page.screenshot({ path: join(SHOTS, '12-suggestie-na-verversen.png'), fullPage: true });
  check('geen dubbele regels of taken, geen pageerrors', dubbelen() === 0 && page.fouten.length === 0, page.fouten.join(' | '));
  await context.close();
}

// ------------------------------------------------------------------------------------------------------------------------------------
sectie('3. Verversen terwijl het actieplan was mislukt: wat kan het lid dan nog?');
{
  resetGenereren({ ...pool(), profile: PRO, dbActief: true, dbFout: { actions: { code: 'XX000' } } });
  aanroepen = [];
  const { context, page } = await nieuwePagina('pro');

  await t(page, 'voorstel-start-knop').click();
  await bevestigProfiel(page);
  await page.waitForSelector('[data-testid="voorstel-resultaat"]', { timeout: 20000 });
  await page.waitForSelector('[data-testid="voorstel-controles-klaar"]', { timeout: 20000 }).catch(() => {});
  await t(page, 'voorstel-opslaan').click();
  await page.waitForSelector('[data-testid="actieplan-opnieuw"]', { timeout: 20000 });
  const n = w.db.funding.length;

  check('actieplan mislukt, dekkingsplan staat', n >= 2 && w.db.actions.length === 0);
  w.dbFout = null;
  await page.reload();
  await page.waitForSelector('[data-testid="pf-regel"]', { timeout: 15000 });
  await sleep(500);
  const afgeleid = await t(page, 'ap-afgeleid-actie').count();

  check('na verversen: de regels staan er, en per regel een afgeleide actie met "Maak er een taak van" en ook de bewaarde "Actieplan opnieuw proberen" van de server', (await t(page, 'pf-regel').count()) === n && afgeleid >= n && (await t(page, 'ap-maak-taak').count()) >= n && (await t(page, 'actieplan-open-opnieuw').count()) === 1, `${afgeleid}`);
  await page.screenshot({ path: join(SHOTS, '20-na-verversen-zonder-taken.png'), fullPage: true });
  await t(page, 'voorstel-start-knop').click();
  await bevestigProfiel(page);
  await page.waitForSelector('[data-testid="voorstel-resultaat"], [data-testid="voorstel-fout"], [data-testid="zp-melding"]', { timeout: 20000 });
  await sleep(600);
  const uitleg = (await tekstVan(page, 'voorstel-fout')) + (await tekstVan(page, 'zp-melding')) + (await tekstVan(page, 'voorstel-resultaat'));

  console.log(`  INFO opnieuw starten na verversen toont: ${uitleg.replace(/\s+/g, ' ').slice(0, 300)}`);
  await page.screenshot({ path: join(SHOTS, '21-opnieuw-starten-na-mislukt.png'), fullPage: true });
  check('geen dubbele regels, geen pageerrors', w.db.funding.length === n && page.fouten.length === 0, page.fouten.join(' | '));
  await context.close();
}

// ------------------------------------------------------------------------------------------------------------------------------------
const AI_PROFIEL = { themas: ['Muziek', 'Cultuur', 'Sport', 'Hiphop'], kern_themas: ['Muziek', 'Sport'], doelgroepen: ['Jongeren', 'Ouderen'], regios: ['Rotterdam', 'Zuid-Holland'], locatie: 'Rotterdam-Zuid', trefwoorden: ['hiphop', 'talentontwikkeling'], aanvragertype: 'organisatie', periode_start: null, periode_eind: null, niet_gekoppeld: [{ soort: 'discipline', term: 'Hiphop' }] };

const LEEG_AI_PROFIEL = { themas: [], kern_themas: [], doelgroepen: [], regios: [], locatie: '', trefwoorden: [], aanvragertype: 'onbekend', periode_start: null, periode_eind: null, niet_gekoppeld: [] };

async function wachtOpVoorstel(page) {
  await page.waitForSelector('[data-testid="voorstel-resultaat"]', { timeout: 40000 });
  await page.waitForSelector('[data-testid="voorstel-controles-klaar"]', { timeout: 25000 }).catch(() => {});
  await sleep(300);
}

sectie('4. PROJECTROUTE: het project is het zoekprofiel; één klik, fout en opnieuw, preview, opslaan, actieplan');
{
  resetGenereren({ ...pool(), profile: PRO, dbActief: true, zoekprofielAi: AI_PROFIEL });
  aanroepen = [];
  verzoeken = [];
  faal = { opslaan: 0, genereren: 1 };
  seedBegroting = { totaal: 100000, eigen: 20000 };
  const { context, page } = await nieuwePagina('pro');

  // Eerste klik: het zoeken faalt technisch (500). Er is geen formulier; wel een melding, opnieuw proberen en de link naar het projectprofiel.
  await t(page, 'voorstel-start-knop').click();
  await page.waitForSelector('[data-testid="voorstel-fout"]', { timeout: 30000 });
  await sleep(200);
  await page.screenshot({ path: join(SHOTS, '30-project-fout.png'), fullPage: true });
  const profielBody = verzoeken.find((b) => b.mode === 'voorstel-zoekprofiel');

  check('geen apart zoekprofielformulier: na de klik verschijnt geen profiel om te bevestigen', (await t(page, 'zp-bevestig').count()) === 0 && (await t(page, 'zoekprofiel').count()) === 0);
  check('het profiel komt uit het project (zoekprofielservice zonder gesprek)', Boolean(profielBody) && !profielBody.berichten);
  check('bij een fout: melding, niets opgeslagen, opnieuw proberen en "Projectprofiel aanpassen" (naar het projectformulier)', w.db.funding.length === 0 && w.db.actions.length === 0 && (await t(page, 'voorstel-opnieuw').count()) === 1 && /\?bewerk=1$/.test(await t(page, 'voorstel-terug-profiel').getAttribute('href')));

  // Opnieuw: nu gaat het door, zonder tussenstap
  await t(page, 'voorstel-opnieuw').click();
  await wachtOpVoorstel(page);
  const genBody = verzoeken.filter((b) => b.mode === 'voorstel-genereren').pop();
  const zp = genBody && genBody.zoekprofiel;

  check('de server kreeg het profiel uit het project met alle waarden (niet teruggebracht tot één)', Boolean(zp) && zp.route === 'project' && namenVan(zp.disciplines).includes('Muziek') && namenVan(zp.disciplines).includes('Sport') && namenVan(zp.werkvelden).includes('Cultuur') && namenVan(zp.doelgroepen).includes('Jongeren') && namenVan(zp.doelgroepen).includes('Ouderen') && namenVan(zp.werkgebieden).includes('Rotterdam') && namenVan(zp.werkgebieden).includes('Zuid-Holland'), JSON.stringify(zp && { d: namenVan(zp.disciplines), v: namenVan(zp.werkvelden), g: namenVan(zp.doelgroepen), r: namenVan(zp.werkgebieden) }));
  check('"Hiphop" heeft geen databasecategorie en wordt niet stil gebruikt', Boolean(zp) && !JSON.stringify([zp.disciplines, zp.werkvelden]).includes('Hiphop'));
  check('financieringsbehoefte uit het project: bekend', Boolean(zp) && zp.financieringsbehoefte.bekend === true);
  check('de bestaande preview: regels met bedragen, buffer 110%, bronstatus per regel (server-eigen controle)', (await t(page, 'voorstel-rij').count()) >= 2 && /110/.test(await tekstVan(page, 'voorstel-buffer')) && aanroepen.filter((m) => m === 'voorstel-controleer').length >= 1 && w.bron.length >= 1);
  if ((await t(page, 'voorstel-profiel-aanpassen').count()) === 1) {
    check('aanpassen gaat via het projectprofiel', /\?bewerk=1$/.test(await t(page, 'voorstel-profiel-aanpassen').getAttribute('href')));
  }
  await page.screenshot({ path: join(SHOTS, '33-project-voorstel.png'), fullPage: true });

  // Opslaan en actieplan
  const rijen = await t(page, 'voorstel-rij').count();

  await t(page, 'voorstel-opslaan').click();
  await page.waitForSelector('[data-testid="voorstel-opgeslagen"]', { timeout: 25000 });
  await page.waitForFunction(() => document.querySelector('[data-testid="voorstel-actieplan"]')?.dataset.status === 'klaar', null, { timeout: 15000 });
  const opslagBody = verzoeken.filter((b) => b.mode === 'voorstel-opslaan').pop();

  check('opslaan: dezelfde server-opslag; de browser stuurt alleen type, id en bedrag (geen profiel, geen bronstatus)', opslagBody.regels.every((r) => Object.keys(r).sort().join() === 'bedrag,id,type') && !('zoekprofiel' in opslagBody));
  check('dekkingsplan opgeslagen (status Interessant) met actieplan: meerdere taken per financier, geen dubbelen', w.db.funding.length >= 2 && w.db.funding.every((f) => f.status === 'interesting') && w.db.actions.length >= 8 && dubbelen() === 0 && rijen >= 2, `${w.db.funding.length} ${w.db.actions.length}`);
  check('de taken hebben een planning (herkomst van de datums)', w.db.actions.some((a) => a.datum_herkomst));
  await page.screenshot({ path: join(SHOTS, '34-project-opgeslagen.png'), fullPage: true });
  await page.reload();
  await page.waitForSelector('[data-testid="pf-regel"]', { timeout: 15000 });
  check('na verversen: de regels staan in het dekkingsplan, taken in Acties & deadlines', (await t(page, 'pf-regel').count()) === w.db.funding.length && (await t(page, 'ap-taak').count()) >= 1);
  check('geen pageerrors in de hele projectroute', page.fouten.length === 0, page.fouten.join(' | '));
  await context.close();
}

sectie('4b. PROJECTROUTE: geen discipline en geen doelgroep -> niet zoeken, maar naar het projectprofiel');
{
  resetGenereren({ ...pool(), profile: PRO, dbActief: true, zoekprofielAi: LEEG_AI_PROFIEL, project: projectRij({ themes: null, target_groups: null }) });
  aanroepen = [];
  verzoeken = [];
  faal = { opslaan: 0, genereren: 0 };
  seedBegroting = { totaal: 100000, eigen: 20000 };
  const { context, page } = await nieuwePagina('pro');

  await t(page, 'voorstel-start-knop').click();
  await page.waitForSelector('[data-testid="voorstel-profiel-aanvullen"]', { timeout: 30000 });
  await page.screenshot({ path: join(SHOTS, '35-project-profiel-aanvullen.png'), fullPage: true });
  check('zonder discipline of doelgroep wordt er niet gezocht en niets opgeslagen', !aanroepen.includes('voorstel-genereren') && w.db.funding.length === 0, JSON.stringify(aanroepen));
  await t(page, 'voorstel-naar-projectprofiel').click();
  await page.waitForSelector('[data-testid="project-bewerk-formulier"]', { timeout: 10000 });
  check('"Projectprofiel aanvullen" opent het projectformulier op dezelfde pagina', (await t(page, 'project-bewerk-formulier').count()) === 1);
  await page.screenshot({ path: join(SHOTS, '36-projectprofiel-formulier.png'), fullPage: true });
  check('geen pageerrors', page.fouten.length === 0, page.fouten.join(' | '));
  await context.close();
}

// ------------------------------------------------------------------------------------------------------------------------------------
sectie('5. PROJECTROUTE: financieringsbehoefte nog onbekend (geen begroting): wel zoeken, zonder bedragen, opslaan zonder bedrag');
{
  resetGenereren({ ...pool(), profile: PRO, dbActief: true, zoekprofielAi: AI_PROFIEL, project: projectRij({ budget_total: null, own_contribution: null }) });
  aanroepen = [];
  verzoeken = [];
  faal = { opslaan: 0, genereren: 0 };
  seedBegroting = { totaal: null, eigen: null };
  const { context, page } = await nieuwePagina('pro');

  check('zonder begroting is de startknop toch actief', await t(page, 'voorstel-start-knop').isEnabled());
  await t(page, 'voorstel-start-knop').click();
  await wachtOpVoorstel(page);
  const gen = verzoeken.filter((b) => b.mode === 'voorstel-genereren').pop();

  check('de server kreeg een profiel met bekend=false en gaf toch een voorstel (uitkomst bedrag-onbekend)', gen.zoekprofiel.financieringsbehoefte.bekend === false && (await t(page, 'voorstel-bedrag-onbekend').count()) === 1);
  check('melding: de matching op bedrag is beperkt; geen totalen, dekking of bedragvelden', /matching op bedrag is daarom beperkt/.test(await tekstVan(page, 'voorstel-bedrag-onbekend')) && (await t(page, 'voorstel-totalen').count()) === 0 && (await t(page, 'voorstel-bedrag').count()) === 0);
  check('financiers staan aan en zijn op inhoud, doelgroep en werkgebied gekozen', (await t(page, 'voorstel-rij').count()) >= 1 && (await t(page, 'voorstel-kies').evaluateAll((l) => l.every((c) => c.checked))));
  check('geen "aanvullen" zonder bekend bedrag', !aanroepen.includes('voorstel-aanvullen'));
  await page.screenshot({ path: join(SHOTS, '41-onbekend-bedrag-voorstel.png'), fullPage: true });
  await t(page, 'voorstel-opslaan').click();
  await page.waitForSelector('[data-testid="voorstel-opgeslagen"]', { timeout: 25000 });
  await page.waitForFunction(() => document.querySelector('[data-testid="voorstel-actieplan"]')?.dataset.status === 'klaar', null, { timeout: 15000 });
  check('opgeslagen zonder bedrag (requested_amount leeg), met actieplan', w.db.funding.length >= 1 && w.db.funding.every((f) => f.requested_amount === null || f.requested_amount === undefined) && w.db.actions.length >= 4 && dubbelen() === 0, JSON.stringify(w.db.funding.map((f) => f.requested_amount)));
  await page.screenshot({ path: join(SHOTS, '42-onbekend-bedrag-opgeslagen.png'), fullPage: true });
  check('geen pageerrors', page.fouten.length === 0, page.fouten.join(' | '));
  await context.close();
}

// ------------------------------------------------------------------------------------------------------------------------------------
async function chatNaarKaart(page) {
  await t(page, 'chat-invoer').fill('Ik wil een muziekproject voor jongeren starten in Rotterdam en Zuid-Holland.');
  await t(page, 'chat-invoer').press('Enter');
  await page.waitForSelector('[data-testid="chat-zoekprofiel-open"]', { timeout: 20000 });
}

sectie('6. CHATROUTE: na het gesprek één klik; dezelfde keten tot en met het actieplan');
{
  resetGenereren({ ...pool(), profile: PRO, dbActief: true, zoekprofielAi: AI_PROFIEL });
  aanroepen = [];
  verzoeken = [];
  faal = { opslaan: 0, genereren: 1 };
  seedBegroting = { totaal: 100000, eigen: 20000 };
  const { context, page } = await nieuwePagina('pro', undefined, { hash: `#/kompas?project=${PID}`, wacht: '[data-testid="chat-invoer"]' });

  check('chat: vóór het eerste bericht is er geen zoekprofielkaart', (await t(page, 'chat-zoekprofiel').count()) === 0);
  await chatNaarKaart(page);
  await page.screenshot({ path: join(SHOTS, '50-chat-kaart.png'), fullPage: true });
  check('chat: onder het gesprek staat de kaart; er is nog niets aangeroepen', !aanroepen.includes('voorstel-zoekprofiel') && !aanroepen.includes('voorstel-genereren'), JSON.stringify(aanroepen));
  await t(page, 'chat-zoekprofiel-open').click();
  await page.waitForSelector('[data-testid="voorstel-fout"]', { timeout: 30000 });
  const pBody = verzoeken.find((b) => b.mode === 'voorstel-zoekprofiel');

  check('chat: dezelfde zoekprofielservice MET de berichten van het lid; geen formulier', Boolean(pBody) && Array.isArray(pBody.berichten) && pBody.berichten.some((m) => /muziekproject voor jongeren/.test(m.content)) && (await t(page, 'zp-bevestig').count()) === 0);
  check('chat: fout -> melding, niets opgeslagen, opnieuw proberen', w.db.funding.length === 0 && (await t(page, 'voorstel-opnieuw').count()) === 1);
  await t(page, 'voorstel-opnieuw').click();
  await wachtOpVoorstel(page);
  const gBody = verzoeken.filter((b) => b.mode === 'voorstel-genereren').pop();

  check('chat: dezelfde genereren-aanroep met het profiel (route chat, meerdere waarden)', gBody.zoekprofiel.route === 'chat' && namenVan(gBody.zoekprofiel.disciplines).length + namenVan(gBody.zoekprofiel.werkvelden).length >= 2 && namenVan(gBody.zoekprofiel.doelgroepen).length >= 2 && namenVan(gBody.zoekprofiel.werkgebieden).length >= 2);
  check('chat: zelfde preview met bedragen, buffer en bronstatus per regel', (await t(page, 'voorstel-rij').count()) >= 2 && /110/.test(await tekstVan(page, 'voorstel-buffer')) && w.bron.length >= 1 && (await t(page, 'voorstel-werkruimte').getAttribute('data-ingang')) === 'chat');
  await page.screenshot({ path: join(SHOTS, '53-chat-voorstel.png'), fullPage: true });
  await t(page, 'voorstel-opslaan').click();
  await page.waitForSelector('[data-testid="voorstel-opgeslagen"]', { timeout: 25000 });
  await page.waitForFunction(() => document.querySelector('[data-testid="voorstel-actieplan"]')?.dataset.status === 'klaar', null, { timeout: 15000 });
  check('chat: opgeslagen via dezelfde server-opslag; dekkingsplan en actieplan staan in de database, geen dubbelen', w.db.funding.length >= 2 && w.db.actions.length >= 8 && dubbelen() === 0 && w.db.actions.some((a) => a.datum_herkomst));
  await page.screenshot({ path: join(SHOTS, '54-chat-opgeslagen.png'), fullPage: true });
  check('geen pageerrors in de chatroute', page.fouten.length === 0, page.fouten.join(' | '));
  await context.close();
}

sectie('6b. CHATROUTE: financieringsbehoefte nog onbekend');
{
  resetGenereren({ ...pool(), profile: PRO, dbActief: true, zoekprofielAi: AI_PROFIEL, project: projectRij({ budget_total: null, own_contribution: null }) });
  aanroepen = [];
  verzoeken = [];
  faal = { opslaan: 0, genereren: 0 };
  seedBegroting = { totaal: null, eigen: null };
  const { context, page } = await nieuwePagina('pro', undefined, { hash: `#/kompas?project=${PID}`, wacht: '[data-testid="chat-invoer"]' });

  await chatNaarKaart(page);
  await t(page, 'chat-zoekprofiel-open').click();
  await wachtOpVoorstel(page);
  check('chat: voorstel zonder bedragen met de melding dat de matching op bedrag beperkt is', (await t(page, 'voorstel-bedrag-onbekend').count()) === 1 && (await t(page, 'voorstel-bedrag').count()) === 0);
  await page.screenshot({ path: join(SHOTS, '60-chat-onbekend-bedrag.png'), fullPage: true });
  await t(page, 'voorstel-opslaan').click();
  await page.waitForSelector('[data-testid="voorstel-opgeslagen"]', { timeout: 25000 });
  await page.waitForFunction(() => document.querySelector('[data-testid="voorstel-actieplan"]')?.dataset.status === 'klaar', null, { timeout: 15000 });
  check('chat: opgeslagen zonder bedrag, met actieplan', w.db.funding.length >= 1 && w.db.funding.every((f) => f.requested_amount === null || f.requested_amount === undefined) && w.db.actions.length >= 4);
  check('geen pageerrors', page.fouten.length === 0, page.fouten.join(' | '));
  await context.close();
}

console.log(`\nVOORSTEL-BROWSER: ${stand.ok} OK, ${stand.fout} FAIL`);
await browser.close();
server.close();
process.exit(stand.fout ? 1 : 0);
