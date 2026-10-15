import { PID, UID, w, resetGenereren, regeling, fonds, projectRij } from './wereld.mjs';
import '../../supabase/functions/subsidie-kompas/index.ts';
import { readFileSync } from 'node:fs';

const stand = { ok: 0, fout: 0 };
const check = (naam, waar, detail = '') => { if (waar) stand.ok += 1; else { stand.fout += 1; console.log(`  FAIL: ${naam} ${detail}`); } };
const sectie = (t) => console.log(`\n== ${t}`);

async function post(body, { token = 'jwt' } = {}) {
  const res = await globalThis.__handler(new Request('http://x/f', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }));
  const tekst = await res.text();
  let json = null;

  try { json = JSON.parse(tekst); } catch { /* geen json */ }

  return { status: res.status, json, tekst };
}

const opslaan = (regels, extra = {}) => post({ mode: 'voorstel-opslaan', projectId: PID, regels, ...extra });
const PRO = { subscription_tier: 'pro', subscription_active: true, trial_ends_at: null, role: 'user' };
const PREMIUM = { subscription_tier: 'premium', subscription_active: true, trial_ends_at: null, role: 'user' };
const FREE = { subscription_tier: 'free', subscription_active: false, trial_ends_at: null, role: 'user' };
const XF = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const A1 = '00000000-0000-4000-8000-0000000000a1';
const A3 = '00000000-0000-4000-8000-0000000000a3';
const B1 = '00000000-0000-4000-8000-0000000000b1';
const C1 = '00000000-0000-4000-8000-0000000000c1';
const F1 = '00000000-0000-4000-8000-0000000000f1';

function pool() {
  return {
    regelingen: [
      regeling({ naam: 'Rotterdams Muziekfonds', gever: 'Gemeente Rotterdam', min: 5000, max: 60000, id: A1 }),
      regeling({ naam: 'Landelijk Muziekpodium', gever: 'Landelijk Podium', min: 1000, max: 25000, regios: ['Landelijk'], id: A3 }),
      regeling({ naam: 'Premium Cultuurregeling', tier: 'premium', gever: 'Premium Gever', min: 5000, max: 50000, id: B1 }),
      regeling({ naam: 'Geheime Regeling', tier: 'premium', gever: 'Geheim Exclusief Fonds', funderId: XF, min: 5000, max: 50000, id: C1 }),
    ],
    funders: [fonds({ naam: 'Fonds Voorbeeld', min: 1000, max: 15000, id: F1 })],
    exclusief: [{ funder_id: XF, naam: 'Geheim Exclusief Fonds', website: 'https://www.geheimfonds.nl/', aliassen: [], regeling_namen: ['Geheime Regeling'], regeling_links: [] }],
  };
}

const wereld = (extra = {}) => resetGenereren({ ...pool(), profile: PRO, dbActief: true, ...extra });
const r = (type, id, bedrag) => ({ type, id, bedrag });
const geenAdminSchrijven = () => w.schrijfpogingen.length === 0;

// ---------------------------------------------------------------------------------------------------------------------------
sectie('1. Poorten');
{
  resetGenereren({ ...pool(), dbActief: true, env: { OPENAI_API_KEY: 'sk-test', SUPABASE_URL: 'http://db.test', SUPABASE_SERVICE_ROLE_KEY: 'srv', SUPABASE_ANON_KEY: 'anon' } });
  const uit = await opslaan([r('regeling', A1, 10000)]);
  check('flag uit: 404, niets geschreven', uit.status === 404 && w.dbSchrijfLog.length === 0);

  wereld({ user: null });
  check('zonder login: 401', (await post({ mode: 'voorstel-opslaan', projectId: PID, regels: [] }, { token: null })).status === 401);

  wereld({ profile: FREE });
  const free = await opslaan([r('regeling', A1, 10000)]);
  check('Free: 403, niets geschreven', free.status === 403 && w.dbSchrijfLog.length === 0, String(free.status));

  wereld();
  check('regels geen lijst: 400', (await post({ mode: 'voorstel-opslaan', projectId: PID, regels: 'x' })).status === 400);
  check('projectId geen uuid: 400', (await post({ mode: 'voorstel-opslaan', projectId: 'abc', regels: [] })).status === 400);
  check('te groot: 413', (await opslaan([r('regeling', A1, 1)], { suggesties: [{ gever: 'x'.repeat(40000) }] })).status === 413);
  check('geen regels gekozen: 422 geen-regels', (await opslaan([])).json?.algemeen?.code === 'geen-regels');

  // Andermans project: de server vindt het project niet (eigenaarsfilter), dus 404 en niets geschreven.
  wereld({ project: projectRij({ user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }) });
  const vreemd = await opslaan([r('regeling', A1, 10000)]);
  check('project van een ander: 404, niets geschreven', vreemd.status === 404 && w.dbSchrijfLog.length === 0 && w.db.funding.length === 0, String(vreemd.status));
  wereld({ project: projectRij({ archived_at: '2026-01-01T00:00:00Z' }) });
  check('gearchiveerd project: 404', (await opslaan([r('regeling', A1, 10000)])).status === 404);
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('2. Opslaan: regels, bedragen, taken (Pro)');
{
  wereld();
  const res = await opslaan([r('regeling', A1, 30000), r('regeling', A3, 20000)]);
  const j = res.json;

  check('200 en ok', res.status === 200 && j.ok === true, `${res.status} ${res.tekst.slice(0, 200)}`);
  check('twee regels opgeslagen', j.regels.length === 2 && j.regels.every((x) => x.status === 'opgeslagen'), JSON.stringify(j.regels));
  check('in de database: status Interessant, bedrag van het lid, juiste eigenaar en project', w.db.funding.length === 2 && w.db.funding.every((f) => f.status === 'interesting' && f.user_id === UID && f.program_id === PID) && w.db.funding.find((f) => f.scheme_id === A1).requested_amount === 30000 && w.db.funding.find((f) => f.scheme_id === A3).requested_amount === 20000);
  check('geschreven met de gebruikersclient: de servicerol schrijft niets', geenAdminSchrijven());
  check('taken aangemaakt, gekoppeld aan de opgeslagen regels, als voorstel van de chat', w.db.actions.length > 0 && w.db.actions.every((a) => a.user_id === UID && a.program_id === PID && a.source === 'chat' && a.status === 'todo' && a.proposed_at) && w.db.actions.some((a) => a.funding_id === w.db.funding[0].id), JSON.stringify(w.db.actions.slice(0, 2)));
  check('actieplan klaar', j.actieplan.status === 'klaar' && j.actieplan.aangemaakt === w.db.actions.length && j.actieplan.mislukt === 0, JSON.stringify(j.actieplan));
  check('geen taak zonder echte deadline: elke datum is een echte datum of leeg', w.db.actions.every((a) => a.due_date === null || /^\d{4}-\d{2}-\d{2}$/.test(a.due_date)));
  check('geen toegekende of aangevraagde status: alleen Interessant', w.db.funding.every((f) => f.status === 'interesting' && f.awarded_amount === undefined));
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('3. Herhaald opslaan en dubbele verzoeken maken niets dubbel');
{
  wereld();
  await opslaan([r('regeling', A1, 30000)]);
  const funding1 = w.db.funding.length;
  const acties1 = w.db.actions.length;
  const nogmaals = await opslaan([r('regeling', A1, 30000)]);

  check('opnieuw dezelfde regel: bestaat al, geen nieuwe rij', nogmaals.status === 200 && nogmaals.json.regels[0].status === 'bestaat-al' && w.db.funding.length === funding1);
  check('opnieuw: geen dubbele taken', w.db.actions.length === acties1, `${w.db.actions.length} ${acties1}`);

  // Twee gelijktijdige verzoeken (dubbelklik): de database weigert de tweede, dus één rij.
  wereld();
  const [a, b] = await Promise.all([opslaan([r('regeling', A1, 30000)]), opslaan([r('regeling', A1, 30000)])]);
  const statussen = [a.json.regels[0].status, b.json.regels[0].status].sort().join();

  check('gelijktijdig dubbelklikken: precies één rij in de database', w.db.funding.length === 1, String(w.db.funding.length));
  check('gelijktijdig: één opgeslagen, één bestaat al', statussen === 'bestaat-al,opgeslagen', statussen);
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('4. Servervalidatie: alles of niets, invoer blijft behouden');
{
  wereld();
  const hoog = await opslaan([r('regeling', A1, 30000), r('regeling', A3, 99999)]);

  check('bedrag boven het maximum van de financier: 422', hoog.status === 422 && hoog.json.reden === 'validatie');
  check('de fout hoort bij die regel (en alleen die)', hoog.json.regelFouten[`r:regeling:${A3}`]?.code === 'boven-maximum' && !hoog.json.regelFouten[`r:regeling:${A1}`], JSON.stringify(hoog.json.regelFouten));
  check('de melding noemt het maximum', /25\.000/.test(hoog.json.regelFouten[`r:regeling:${A3}`].melding), hoog.json.regelFouten[`r:regeling:${A3}`].melding);
  check('alles of niets: ook de goede regel is niet opgeslagen', w.db.funding.length === 0 && w.dbSchrijfLog.length === 0);

  wereld();
  const laag = await opslaan([r('regeling', A1, 1000)]);
  check('bedrag onder het minimum: 422 onder-minimum', laag.status === 422 && laag.json.regelFouten[`r:regeling:${A1}`]?.code === 'onder-minimum' && w.db.funding.length === 0);

  wereld();
  const teVeel = await opslaan([r('regeling', A1, 60000), r('regeling', A3, 25000), r('fonds', F1, 15000)]);
  check('samen boven het financieringsgat plus buffer: 422 met het toegestane totaal', teVeel.status === 422 && teVeel.json.algemeen?.code === 'boven-financieringsgat' && teVeel.json.algemeen.toegestaneSom === 88000 && w.db.funding.length === 0, JSON.stringify(teVeel.json?.algemeen));

  wereld();
  const rommel = await opslaan([r('regeling', A1, -5)]);
  const tekstBedrag = await opslaan([r('regeling', A1, 'veel')]);
  check('negatief of tekst als bedrag: 422 ongeldig-bedrag, niets opgeslagen', rommel.json.regelFouten[`r:regeling:${A1}`]?.code === 'ongeldig-bedrag' && tekstBedrag.json.regelFouten[`r:regeling:${A1}`]?.code === 'ongeldig-bedrag' && w.db.funding.length === 0);

  const nul = await opslaan([r('regeling', A1, 0)]);
  check('geen bedrag (0) is toegestaan: opgeslagen zonder bedrag', nul.status === 200 && w.db.funding[0].requested_amount === null);

  wereld();
  const online = await opslaan([{ type: 'online', id: A1, bedrag: 1000 }]);
  const kapotId = await opslaan([r('regeling', 'geen-uuid', 1000)]);
  check('onbekend type of id: 422 ongeldig, niets opgeslagen', online.status === 422 && kapotId.status === 422 && w.db.funding.length === 0);

  const veel = await opslaan(Array.from({ length: 13 }, (_, i) => r('regeling', `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, 1000)));
  check('meer dan 12 regels: geweigerd', veel.status === 422);

  // Wat de browser erbij zet (naam, deadline, grenzen, taken) wordt genegeerd: alles komt uit de server-bekende records.
  wereld();
  const vals = await opslaan([{ type: 'regeling', id: A1, bedrag: 30000, naam: 'GEHACKT', gever: 'GEHACKT', deadline: { status: 'geverifieerd', datum: '2099-01-01' }, grenzen: { min: 0, max: 99999999 }, selecteerbaar: true }], { acties: [{ titel: 'GEHACKTE TAAK', datum: '2099-01-01' }], voorstel: { regels: [] } });
  check('extra velden van de browser worden genegeerd', vals.status === 200 && !JSON.stringify(w.db).includes('GEHACKT') && !JSON.stringify(w.db).includes('2099'));
  const hoogVals = await opslaan([{ type: 'regeling', id: A3, bedrag: 99999, grenzen: { min: 0, max: 99999999 } }]);
  check('grenzen van de browser tellen niet: het maximum van het record geldt', hoogVals.status === 422 && hoogVals.json.regelFouten[`r:regeling:${A3}`]?.code === 'boven-maximum');
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('5. Abonnement: Premium-records en exclusieve fondsen zijn voor Pro onzichtbaar');
{
  wereld();
  const premium = await opslaan([r('regeling', B1, 10000)]);
  const exclusief = await opslaan([r('regeling', C1, 10000)]);
  const onbekend = await opslaan([r('regeling', '00000000-0000-4000-8000-0000000000dd', 10000)]);

  check('Pro: Premium-regeling wordt geweigerd (niet-toegestaan), niets opgeslagen', premium.status === 422 && premium.json.regelFouten[`r:regeling:${B1}`]?.code === 'niet-toegestaan' && w.db.funding.length === 0);
  const melding = (x, id) => x.json.regelFouten[`r:regeling:${id}`]?.melding;
  check('Premium, exclusief en bestaat-niet zijn niet van elkaar te onderscheiden (zelfde melding)', melding(premium, B1) === melding(exclusief, C1) && melding(exclusief, C1) === melding(onbekend, '00000000-0000-4000-8000-0000000000dd'));
  check('geen naam van een Premium- of exclusief fonds in het antwoord', !/Premium Cultuurregeling|Premium Gever|Geheime Regeling|Geheim Exclusief/.test(premium.tekst + exclusief.tekst));

  wereld({ profile: PREMIUM });
  const eigen = await opslaan([r('regeling', B1, 10000)]);
  check('Premium mag de Premium-regeling wel opslaan', eigen.status === 200 && eigen.json.regels[0].status === 'opgeslagen');
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('6. Gedeeltelijk mislukken en opnieuw proberen (actieplan)');
{
  // De database weigert de regel (geen recht): geen taken zonder regel.
  wereld({ dbFout: { funding: { code: '42501' } } });
  const geenRecht = await opslaan([r('regeling', A1, 30000)]);
  check('regel mislukt (geen recht): status mislukt met reden, geen taken', geenRecht.status === 200 && geenRecht.json.regels[0].status === 'mislukt' && geenRecht.json.regels[0].reden === 'niet-toegestaan' && w.db.actions.length === 0 && geenRecht.json.actieplan.status === 'geen');

  // Taken schrijven mislukt, regel is wel opgeslagen: duidelijk gemeld en los opnieuw te proberen.
  wereld({ dbFout: { actions: { code: 'XX000' } } });
  const takenKapot = await opslaan([r('regeling', A1, 30000)]);
  check('regel opgeslagen, taken mislukt: actieplan "mislukt"', takenKapot.json.regels[0].status === 'opgeslagen' && takenKapot.json.actieplan.status === 'mislukt' && takenKapot.json.actieplan.mislukt > 0 && w.db.funding.length === 1 && w.db.actions.length === 0, JSON.stringify(takenKapot.json.actieplan));

  w.dbFout = null;
  const opnieuw = await opslaan([r('regeling', A1, null)], { alleenActies: true });
  check('alleen acties opnieuw: taken gemaakt, regel niet nogmaals', opnieuw.status === 200 && opnieuw.json.actieplan.status === 'klaar' && w.db.actions.length > 0 && w.db.funding.length === 1 && opnieuw.json.regels.length === 0, JSON.stringify(opnieuw.json));
  check('taken hangen aan de bestaande regel', w.db.actions.some((a) => a.funding_id === w.db.funding[0].id));
  const aantal = w.db.actions.length;
  const nogEens = await opslaan([r('regeling', A1, null)], { alleenActies: true });
  check('nog een keer opnieuw: geen dubbele taken', w.db.actions.length === aantal && nogEens.json.actieplan.aangemaakt === 0 && nogEens.json.actieplan.bestond > 0);

  // Bestaande taken kunnen niet gelezen worden: liever niets schrijven dan dubbelen riskeren.
  wereld({ dbFout: { actionsLezen: true } });
  const leesKapot = await opslaan([r('regeling', A1, 30000)]);
  check('bestaande taken onleesbaar: geen taken geschreven, actieplan mislukt (regel wel opgeslagen)', leesKapot.json.regels[0].status === 'opgeslagen' && w.db.actions.length === 0 && leesKapot.json.actieplan.status === 'mislukt');

  // Opnieuw proberen voor een regel die nog niet in het dekkingsplan staat.
  wereld();
  const nietOpgeslagen = await opslaan([r('regeling', A1, null)], { alleenActies: true });
  check('alleenActies voor een regel die er niet staat: 422, geen taken', nietOpgeslagen.status === 422 && w.db.actions.length === 0 && w.db.funding.length === 0);

  // Meerdere regels, één bestaat al: nieuwe krijgt taken, de bestaande niet opnieuw.
  wereld();
  await opslaan([r('regeling', A1, 20000)]);
  const voor = w.db.actions.length;
  const mix = await opslaan([r('regeling', A1, 20000), r('regeling', A3, 15000)]);
  check('mix van bestaande en nieuwe regel: bestaande blijft ongemoeid, nieuwe krijgt taken', mix.json.regels.find((x) => x.sleutel === `r:regeling:${A1}`).status === 'bestaat-al' && mix.json.regels.find((x) => x.sleutel === `r:regeling:${A3}`).status === 'opgeslagen' && w.db.actions.length > voor && w.db.funding.length === 2);

  // Gekozen taken kunnen worden afgevinkt.
  wereld();
  const eerste = await opslaan([r('regeling', A1, 20000)]);
  const sleutelsVoor = w.db.actions.map((a) => a.title);
  wereld();
  const ruwPlan = await opslaan([r('regeling', A1, 20000)], { uitgeslotenActies: ['x'] });
  check('onbekende uitgesloten sleutel breekt niets', ruwPlan.status === 200 && w.db.actions.length === sleutelsVoor.length && eerste.status === 200);
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('7. Online gevonden financiers op naam');
{
  wereld();
  const res = await opslaan([r('regeling', A1, 20000)], { suggesties: [{ gever: 'Online Fonds BV', naam: 'Kleine Regeling', url: 'https://www.online.example.nl/aanvragen' }, { gever: 'Onveilig BV', naam: 'x', url: 'http://onveilig.example' }, { gever: '', naam: 'leeg' }, { gever: 'Online Fonds BV', naam: 'Kleine Regeling' }] });
  const op = w.db.funding.filter((f) => f.financier_naam);

  check('suggesties: zonder bedrag, Interessant, nadrukkelijk "nog niet gecontroleerd"', res.status === 200 && op.length === 2 && op.every((f) => f.requested_amount === null && f.status === 'interesting' && /nog niet gecontroleerd/.test(f.notes)), JSON.stringify(op));
  check('suggesties: https-bron bewaard, http-bron weggelaten, lege naam overgeslagen', /online\.example\.nl/.test(op[0].notes) && !/onveilig\.example/.test(op[1].notes) && res.json.suggesties.length === 3);
  check('dezelfde suggestie twee keer in één verzoek: tweede is "bestaat al"', res.json.suggesties.filter((x) => x.status === 'bestaat-al').length === 1, JSON.stringify(res.json.suggesties));
  const weer = await opslaan([r('regeling', A1, 20000)], { suggesties: [{ gever: 'Online Fonds BV', naam: 'Kleine Regeling' }] });
  check('opnieuw opslaan: suggestie bestaat al, niets dubbel', weer.json.suggesties[0].status === 'bestaat-al' && w.db.funding.filter((f) => f.financier_naam).length === 2);
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('8. Statische eigenschappen van het opslaan-blok');
{
  const bron = readFileSync('supabase/functions/subsidie-kompas/index.ts', 'utf8');
  const h1 = bron.indexOf('// VOORSTEL OPSLAAN (dekkingsplan + actieplan)');
  const h2 = bron.indexOf('// VOORSTEL GENEREREN (dekkingsplan + actieplan)');
  const m1 = bron.indexOf('// Voorstel opslaan (Pro/Premium): de enige schrijfroute');
  const m2 = bron.indexOf('// Voorstel genereren (Pro/Premium): schrijft niets');
  const blok = bron.slice(h1, h2) + bron.slice(m1, m2);

  check('blokken gevonden', h1 > 0 && h2 > h1 && m1 > 0 && m2 > m1);
  const tabellen = [...blok.matchAll(/\.from\('([a-z_]+)'\)/g)].map((m) => m[1]);
  const projectBlok = blok.replace(/admin\.from\('subsidie_kompas_bron_controles'\)[\s\S]*?;\n/g, '').replace(/await admin[\s\S]*?bron_controles[\s\S]*?;\n/g, '');
  check('schrijft alleen naar de projecttabellen en de door de server beheerde broncontroles', tabellen.every((t) => ['subsidie_kompas_programs', 'subsidie_kompas_program_funding', 'subsidie_kompas_program_actions', 'subsidie_kompas_bron_controles'].includes(t)), JSON.stringify(tabellen));
  check('de projecttabellen (regels en taken) alleen met insert, nooit update, upsert of delete', /\.insert\(/.test(blok) && !/from\('subsidie_kompas_program_(funding|actions)'\)\s*\.(update|upsert|delete)/.test(blok.replace(/\s+/g, ' ').replace(/\) \./g, ').')));
  check('regels en taken worden met de client van het lid geschreven, nooit met de servicerol (admin)', !/admin\s*\.\s*from\('subsidie_kompas_program_/.test(blok) && /gebruikersClient\(authHeader\)/.test(blok));
  check('de servicerol schrijft alleen in de broncontroles-tabel (upsert door de controle, update naar verouderd bij opslaan)', [...blok.matchAll(/admin\s*\.\s*from\('([a-z_]+)'\)\s*\.(update|upsert|insert|delete)/g)].every((m) => m[1] === 'subsidie_kompas_bron_controles') && !/\.(delete)\s*\(/.test(blok) && projectBlok.length > 0);
  check('status is altijd Interessant: geen toegekend of aangevraagd', !/status: '(awarded|submitted|preparing)'/.test(blok) && (blok.match(/status: 'interesting'/g) || []).length >= 2);
  check('de tier en het dekkingsdoel komen van de server', /tierConfigVoor|b\.config/.test(blok) && !/body\.tier|body\.dekkingsdoel|body\.config|body\.acties|body\.voorstel/.test(blok));
  check('de flag VOORSTEL_GENEREREN moet "aan" zijn', /Deno\.env\.get\('VOORSTEL_GENEREREN'\) !== 'aan'/.test(blok));
  check('dynamische imports alleen uit ../_shared', [...blok.matchAll(/import\('([^']+)'\)/g)].every((m) => m[1].startsWith('../_shared/')));
  check('geen taalmodel, geen netwerk in dit blok', !/fetch\(|chat\/completions|openai/i.test(blok));
}

console.log(`\nVOORSTEL-OPSLAAN: ${stand.ok} OK, ${stand.fout} FAIL`);
process.exit(stand.fout ? 1 : 0);
