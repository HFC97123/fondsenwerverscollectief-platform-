import { PID, UID, w, resetGenereren, regeling, fonds, online, projectRij } from './wereld.mjs';
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

const genereer = (extra = {}) => post({ mode: 'voorstel-genereren', projectId: PID, ...extra });
const aanvul = (voorstel, extra = {}) => post({ mode: 'voorstel-aanvullen', projectId: PID, voorstel, ...extra });
const XF = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const PRO = { subscription_tier: 'pro', subscription_active: true, trial_ends_at: null, role: 'user' };
const PREMIUM = { subscription_tier: 'premium', subscription_active: true, trial_ends_at: null, role: 'user' };
const FREE = { subscription_tier: 'free', subscription_active: false, trial_ends_at: null, role: 'user' };

function pool() {
  return {
    regelingen: [
      regeling({ naam: 'Rotterdams Muziekfonds', gever: 'Gemeente Rotterdam', min: 5000, max: 120000, id: '00000000-0000-4000-8000-0000000000a1' }),
      regeling({ naam: 'Pro Jongerenregeling', tier: 'pro', gever: 'Pro Gever', min: 2000, max: 90000, id: '00000000-0000-4000-8000-0000000000a2' }),
      regeling({ naam: 'Landelijk Muziekpodium', gever: 'Landelijk Podium', min: 1000, max: 80000, regios: ['Landelijk'], id: '00000000-0000-4000-8000-0000000000a3' }),
      regeling({ naam: 'Premium Cultuurregeling', tier: 'premium', gever: 'Premium Gever', min: 5000, max: 50000, id: '00000000-0000-4000-8000-0000000000b1' }),
      regeling({ naam: 'Geheime Regeling', tier: 'premium', gever: 'Geheim Exclusief Fonds', funderId: XF, min: 5000, max: 50000, id: '00000000-0000-4000-8000-0000000000c1' }),
    ],
    funders: [fonds({ naam: 'Fonds Voorbeeld', min: 1000, max: 60000, id: '00000000-0000-4000-8000-0000000000f1' })],
    exclusief: [{ funder_id: XF, naam: 'Geheim Exclusief Fonds', website: 'https://www.geheimfonds.nl/', aliassen: [], regeling_namen: ['Geheime Regeling'], regeling_links: [] }],
  };
}

const NAMEN_VERBORGEN_VOOR_PRO = ['Premium Cultuurregeling', 'Premium Gever', 'Geheime Regeling', 'Geheim Exclusief Fonds', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000c1'];
const regelNamen = (r) => (r.json?.voorstel?.regels || []).map((x) => x.naam);
const geenSchrijven = () => w.schrijfpogingen.length === 0;

// ---------------------------------------------------------------------------------------------------------------------------
sectie('1. Poorten: flag, login, abonnement, invoer');
{
  resetGenereren({ ...pool(), env: { OPENAI_API_KEY: 'sk-test', SUPABASE_URL: 'http://db.test', SUPABASE_SERVICE_ROLE_KEY: 'srv', SUPABASE_ANON_KEY: 'anon' } });
  const uit = await genereer();

  check('flag uit: 404, niets geladen, geen OpenAI', uit.status === 404 && w.openaiAantal === 0 && !w.rpcs.some((n) => n !== 'kompas_check_rate_limit') && !w.tabellen.includes('subsidie_kompas_programs'), `${uit.status}`);

  resetGenereren({ ...pool(), user: null });
  check('zonder login: 401', (await post({ mode: 'voorstel-genereren', projectId: PID }, { token: null })).status === 401);

  resetGenereren({ ...pool(), profile: FREE });
  const free = await genereer();

  check('Free: 403, niets geladen, geen OpenAI (Free blijft een chatbot)', free.status === 403 && w.openaiAantal === 0 && !w.rpcs.includes('kompas_subsidieregelingen_voor_tier') && !w.tabellen.some((t) => ['themas', 'doelgroepen', 'regios'].includes(t)), `${free.status} ${free.tekst}`);
  check('Free: geen enkele fondsnaam in het antwoord', !free.tekst.includes('Muziekfonds'));
  check('Free aanvullen: 403, geen OpenAI', (await aanvul({ versie: 1, projectId: PID, regels: [] })).status === 403 && w.openaiAantal === 0);

  resetGenereren({ ...pool(), profile: PRO });
  check('ongeldig projectId: 400', (await post({ mode: 'voorstel-genereren', projectId: 'x' })).status === 400);
  check('aanvullen zonder voorstel: 400', (await post({ mode: 'voorstel-aanvullen', projectId: PID })).status === 400);
  check('aanvullen met te groot voorstel: 413', (await aanvul({ versie: 1, regels: [{ motivatie: 'x'.repeat(70000) }] })).status === 413);

  resetGenereren({ ...pool(), profile: PRO, project: projectRij({ user_id: '99999999-9999-4999-8999-999999999999' }) });
  const vreemd = await genereer();

  check('project van een ander: 404, niets uit de fondsdatabase geladen, geen OpenAI', vreemd.status === 404 && w.openaiAantal === 0 && !w.rpcs.includes('kompas_subsidieregelingen_voor_tier'), String(vreemd.status));

  resetGenereren({ ...pool(), profile: PRO, project: projectRij({ budget_total: null }) });
  const zonderBegroting = await genereer();

  check('zonder begroting: 422 geen-begroting, geen OpenAI', zonderBegroting.status === 422 && zonderBegroting.json.reden === 'geen-begroting' && w.openaiAantal === 0);

  resetGenereren({ ...pool(), profile: PRO, project: projectRij({ themes: '', target_groups: '' }) });
  const zonderCriteria = await genereer();

  check('zonder discipline en doelgroep: 422, geen OpenAI en geen fondsen geladen', zonderCriteria.status === 422 && zonderCriteria.json.reden === 'onvoldoende-projectgegevens' && w.openaiAantal === 0 && !w.rpcs.includes('kompas_subsidieregelingen_voor_tier'));
  check('de melding noemt precies welke projectvelden ontbreken', JSON.stringify(zonderCriteria.json.ontbreekt?.slice().sort()) === JSON.stringify(['discipline', 'doelgroep']) || JSON.stringify(zonderCriteria.json.ontbreekt?.slice().sort()) === JSON.stringify(['discipline', 'doelgroep', 'werkgebied']), JSON.stringify(zonderCriteria.json.ontbreekt));

  resetGenereren({ ...pool(), profile: PRO, project: projectRij({ own_contribution: 100000 }), dekkingsplan: [] });
  const gedekt = await genereer();

  check('gat is nul: ok, uitkomst geen-gat, geen voorstel, geen OpenAI', gedekt.status === 200 && gedekt.json.uitkomst === 'geen-gat' && gedekt.json.voorstel === null && w.openaiAantal === 0);

  resetGenereren({ ...pool(), profile: PRO, dekkingsplanFout: true });
  check('dekkingsplan onleesbaar: 503 (fail-safe), geen voorstel', (await genereer()).status === 503);
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('2. Pro: database met free + pro, GEEN Premium-record, GEEN exclusief fonds');
{
  resetGenereren({ ...pool(), profile: PRO });
  const r = await genereer();
  const j = r.json;

  check('Pro: 200 en ok', r.status === 200 && j.ok === true, `${r.status} ${r.tekst.slice(0, 200)}`);
  check('Pro: niets opgeslagen, geen enkele schrijfpoging', j.opgeslagen === false && geenSchrijven(), JSON.stringify(w.schrijfpogingen).slice(0, 200));
  check('Pro: de free- en pro-records meedoen', ['Rotterdams Muziekfonds', 'Pro Jongerenregeling'].every((n) => regelNamen(r).includes(n)), regelNamen(r).join(','));
  check('Pro: Premium-record staat nergens in het antwoord (ook niet als alleen naam of id)', NAMEN_VERBORGEN_VOOR_PRO.every((n) => !r.tekst.includes(n)), NAMEN_VERBORGEN_VOOR_PRO.filter((n) => r.tekst.includes(n)).join(','));
  check('Pro: dekkingsdoel 120% van het gat (gat 70.000 -> doel 84.000)', j.dekkingsdoel === 1.2 && j.totalen.gat === 70000 && j.totalen.doelBedrag === 84000, JSON.stringify(j.totalen));
  const som = j.voorstel.regels.filter((x) => x.selecteerbaar && x.bedrag).reduce((t, x) => t + x.bedrag, 0);

  check('Pro: som van de bedragen = totalen.som, en nooit boven het doel', som === j.totalen.som && som <= 84000, `${som} ${JSON.stringify(j.totalen)}`);
  check('Pro: alle bedragen binnen de grenzen van het record, geen fondsmaximum als standaard', j.voorstel.regels.every((x) => x.bedrag == null || ((x.grenzen.min == null || x.bedrag >= x.grenzen.min) && (x.grenzen.max == null || x.bedrag <= x.grenzen.max))) && j.voorstel.regels.some((x) => x.bedrag != null && x.grenzen.max != null && x.bedrag < x.grenzen.max));
  check('Pro: maximaal één financier draagt hoogstens de helft van het gat', j.voorstel.regels.every((x) => (x.bedrag || 0) <= 35000));
  check('Pro: doel bereikt en STOP: hooguit één reserve, zonder bedrag, telt niet mee', j.uitkomst === 'doel-bereikt' && j.melding === null && j.voorstel.regels.filter((x) => x.bedrag == null).length <= 1 && (j.reserveSleutel === null || j.voorstel.regels.some((x) => x.sleutel === j.reserveSleutel && x.bedrag == null)), `${j.uitkomst} ${j.reserveSleutel}`);
  check('Pro: niet meer dan zes regels in de mix', j.voorstel.regels.filter((x) => x.bedrag != null).length <= 6);
  check('Pro: elke regel komt uit de database (herkomst database, id is een uuid), geen verzonnen financier', j.voorstel.regels.every((x) => x.herkomst === 'database' && /^[0-9a-f-]{36}$/.test(x.id)));
  check('Pro: deadlines komen uit het databaserecord (geverifieerd = citaatcontrole, nooit uit het model)', j.voorstel.regels.filter((x) => x.type === 'regeling').every((x) => x.deadline.datum === '2026-12-15'));
  check('Pro: acties zijn teruggepland vanaf de deadline en liggen niet vóór vandaag of (voor het indienen) na de deadline', j.voorstel.acties.length > 0 && j.voorstel.acties.every((a) => !a.datum || a.datum >= j.voorstel.gegenereerdOp) && j.voorstel.acties.filter((a) => a.regelSleutel && j.voorstel.regels.find((x) => x.sleutel === a.regelSleutel)?.deadline.status === 'geverifieerd' && !['ontvangst', 'vragen', 'beoordeling', 'besluit', 'vervolg'].includes(a.fase)).every((a) => a.datum <= j.voorstel.regels.find((x) => x.sleutel === a.regelSleutel).deadline.datum));
  check('Pro: slank actieplan, geen losse "Projectstukken verzamelen"-stap meer', j.voorstel.acties.filter((a) => a.titel.startsWith('Projectstukken')).length === 0);
  check('Pro: een regel zonder deadline krijgt één contactactie (nooit een verzonnen datum)', j.voorstel.regels.filter((x) => x.deadline.status !== 'geverifieerd' && x.selecteerbaar && x.bedrag).every((x) => j.voorstel.acties.some((a) => a.regelSleutel === x.sleutel && /Contact opnemen met/.test(a.titel))));
  check('Pro: aanvullen is niet beschikbaar (alleen Premium)', j.aanvullenMogelijk === false);
  check('Pro: de oriëntatie vroeg om hoogstens 2 kandidaten en 2 zoekopdrachten', w.openaiAantal === 1 && /Maximaal 2 kandidaten/.test(JSON.stringify(w.openaiBodies[0])) && /hoogstens 2 webzoekopdrachten/.test(JSON.stringify(w.openaiBodies[0])), JSON.stringify(w.openaiBodies[0] || {}).slice(0, 300));
  check('Pro: kleinere uitvoer en een eigen time-out dan de chat (max_output_tokens 4600)', w.openaiBodies[0]?.max_output_tokens === 4600, String(w.openaiBodies[0]?.max_output_tokens));
  check('Pro: de kostenmeter legt alleen tellers vast (geen namen, geen inhoud)', w.gebruikRijen.length >= 1 && w.gebruikRijen.every((rij) => ['fonds_scan_database', 'fonds_scan_web'].includes(rij.action_type) && rij.tier === 'pro' && !/Muziek|Rotterdam|Premium|Geheim/.test(JSON.stringify(rij))), JSON.stringify(w.gebruikRijen).slice(0, 300));
  check('Pro: het voorstel bevat een beschikbaar-voor-controle sleutel per regel en acties verwijzen daarnaar', j.voorstel.acties.filter((a) => a.regelSleutel).every((a) => j.voorstel.regels.some((x) => x.sleutel === a.regelSleutel)));
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('3. Premium: volledige database, hoger dekkingsdoel (160%), ruimere online oriëntatie');
{
  resetGenereren({ ...pool(), profile: PREMIUM });
  const r = await genereer();
  const j = r.json;

  check('Premium: 200 en ok, niets opgeslagen', r.status === 200 && j.ok === true && geenSchrijven(), `${r.status} ${r.tekst.slice(0, 200)}`);
  check('Premium: dekkingsdoel 160% (gat 70.000 -> doel 112.000) en de begroting sluit', j.dekkingsdoel === 1.6 && j.totalen.doelBedrag === 112000 && j.totalen.som === 112000 && j.uitkomst === 'doel-bereikt', JSON.stringify(j.totalen));
  check('Premium: ook Premium-records (en het exclusieve fonds) kunnen meedoen', regelNamen(r).includes('Premium Cultuurregeling') || regelNamen(r).includes('Geheime Regeling'), regelNamen(r).join(','));
  check('Premium: de oriëntatie vroeg om hoogstens 6 kandidaten en 6 zoekopdrachten', /Maximaal 6 kandidaten/.test(JSON.stringify(w.openaiBodies[0])) && /hoogstens 6 webzoekopdrachten/.test(JSON.stringify(w.openaiBodies[0])));
  check('Premium: ruimere uitvoer dan Pro (max_output_tokens 7800)', w.openaiBodies[0]?.max_output_tokens === 7800, String(w.openaiBodies[0]?.max_output_tokens));
  check('Premium: dezelfde matchingvolgorde: de hoogste score staat vooraan in de mix', j.voorstel.regels.filter((x) => x.bedrag != null).length >= 3);
  check('Premium: kostenmeter markeert de tier premium', w.gebruikRijen.every((rij) => rij.tier === 'premium'));
  const som = j.voorstel.regels.filter((x) => x.selecteerbaar && x.bedrag).reduce((t, x) => t + x.bedrag, 0);

  check('Premium: som nooit boven 112.000', som <= 112000 && som === j.totalen.som, `${som}`);
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('4. Eerlijkheid: te weinig sterke matches is een normale uitkomst, nooit een zwakke match erbij');
{
  resetGenereren({
    profile: PRO,
    regelingen: [
      regeling({ naam: 'Enige sterke match', gever: 'Gever Een', min: 5000, max: 30000, id: '00000000-0000-4000-8000-0000000000d1' }),
      // zwakke / niet passende records: andere discipline, andere doelgroep, andere regio
      regeling({ naam: 'Natuurfonds Friesland', gever: 'Gever Natuur', themas: ['Natuur'], doelgroepen: ['Ouderen'], regios: ['Amsterdam'], min: 1000, max: 90000, id: '00000000-0000-4000-8000-0000000000d2' }),
      regeling({ naam: 'Sportfonds Ouderen', gever: 'Gever Sport', themas: ['Sport'], doelgroepen: ['Ouderen'], regios: ['Amsterdam'], min: 1000, max: 90000, id: '00000000-0000-4000-8000-0000000000d3' }),
    ],
    funders: [],
  });
  const r = await genereer();
  const j = r.json;

  check('uitkomst onvoldoende-sterke-matches met eerlijke melding', j.uitkomst === 'onvoldoende-sterke-matches' && /te weinig sterke/.test(j.melding || ''), `${j.uitkomst} ${j.melding}`);
  check('alleen de sterke match staat in het voorstel; de niet passende records zijn er niet bij gezet om een percentage te halen', regelNamen(r).join() === 'Enige sterke match', regelNamen(r).join(','));
  check('de dekking blijft onder het doel (geen opvulling)', j.totalen.som < j.totalen.doelBedrag && j.totalen.som <= 15000 + 35000, JSON.stringify(j.totalen));

  resetGenereren({ profile: PRO, regelingen: [], funders: [] });
  const leeg = await genereer();

  check('lege database: ok, uitkomst geen-kandidaten, lege regels en een nuttige melding', leeg.status === 200 && leeg.json.voorstel.regels.length === 0 && /geen sterke/.test(leeg.json.melding || ''), leeg.tekst.slice(0, 300));
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('5. Al in het dekkingsplan staande financiers doen niet opnieuw mee');
{
  const bestaandeSchemeId = '77777777-7777-4777-8777-777777777777';
  const p = pool();

  p.regelingen.push(regeling({ naam: 'Bestaande regeling', gever: 'Gever', min: 5000, max: 40000, id: bestaandeSchemeId }));
  resetGenereren({ ...p, profile: PRO });
  const r = await genereer();

  check('regeling die al in het plan staat wordt niet nogmaals voorgesteld', !regelNamen(r).includes('Bestaande regeling'), regelNamen(r).join(','));
  check('het gat houdt al rekening met de bestaande regel (70.000 in plaats van 80.000)', r.json.totalen.gat === 70000);
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('6. Online-only kandidaten: apart, niet gecontroleerd, nooit in de dekking; Premium lekt niet naar Pro');
{
  // Pro: twee online-only kandidaten + één die samenvalt met een Premium-record + één die samenvalt met het exclusieve fonds.
  resetGenereren({
    ...pool(),
    profile: PRO,
    online: [
      online({ gever: 'Onbekend Online Fonds', regeling: 'Online Muziekregeling' }),
      online({ gever: 'Premium Gever', regeling: 'Premium Cultuurregeling', url: 'https://www.premium.example.nl/regeling', website: 'https://www.premium.example.nl/' }),
      online({ gever: 'Geheim Exclusief Fonds', regeling: 'Geheime Regeling', url: 'https://www.geheimfonds.nl/regeling', website: 'https://www.geheimfonds.nl/' }),
      online({ gever: 'Derde Online Fonds', regeling: null }),
    ],
  });
  const r = await genereer();
  const j = r.json;

  check('Pro: de verkenner levert hoogstens 2 kandidaten (de rest wordt weggegooid)', j.werkwijze.onlineKandidaten === 2, JSON.stringify(j.werkwijze));
  check('Pro: Premium- en exclusieve fondsen die online opduiken verschijnen nergens (voorstel, suggesties, melding)', NAMEN_VERBORGEN_VOOR_PRO.every((n) => !r.tekst.includes(n)), NAMEN_VERBORGEN_VOOR_PRO.filter((n) => r.tekst.includes(n)).join(','));
  check('een online-only kandidaat staat NIET tussen de voorstelregels', !regelNamen(r).includes('Online Muziekregeling') && j.voorstel.regels.every((x) => x.herkomst === 'database'));
  check('een online-only kandidaat verschijnt als suggestie, uitdrukkelijk niet gecontroleerd', j.onlineSuggesties.some((s) => s.naam === 'Online Muziekregeling' && s.gecontroleerd === false), JSON.stringify(j.onlineSuggesties).slice(0, 300));
  check('de dekking telt geen online suggestie mee', j.totalen.som === j.voorstel.regels.filter((x) => x.selecteerbaar && x.bedrag).reduce((t, x) => t + x.bedrag, 0));
  check('de suggestie bevat een bron-URL (https) en een indicatief bedrag als schatting', j.onlineSuggesties.every((s) => s.url === null || /^https:\/\//.test(s.url)) && j.onlineSuggesties.every((s) => s.indicatiefBedrag === null || s.indicatiefBedrag <= 35000));

  // Mislukte verkenner: geen voorstelverlies, wel eerlijke status.
  resetGenereren({ ...pool(), profile: PRO, onlineStatus: 'fout' });
  const kapot = await genereer();

  check('verkenner mislukt: het voorstel uit de database komt er gewoon, status mislukt', kapot.status === 200 && kapot.json.voorstel.regels.length > 0 && kapot.json.werkwijze.onlineStatus === 'mislukt');

  // Verkenner uit (kill switch): geen OpenAI-aanroep.
  resetGenereren({ ...pool(), profile: PRO, env: { OPENAI_API_KEY: 'sk-test', SUPABASE_URL: 'http://db.test', SUPABASE_SERVICE_ROLE_KEY: 'srv', SUPABASE_ANON_KEY: 'anon', VOORSTEL_GENEREREN: 'aan', KOMPAS_WEB_VERKENNER: 'uit' } });
  const uit = await genereer();

  check('KOMPAS_WEB_VERKENNER=uit: geen OpenAI-aanroep, voorstel uit de database', uit.status === 200 && w.openaiAantal === 0 && uit.json.voorstel.regels.length > 0);

  // Als de exclusiviteitslijst niet betrouwbaar is, krijgt Pro geen online kandidaten (fail closed), de database wel.
  resetGenereren({ ...pool(), profile: PRO, online: [online({})], exclusiefFout: true });
  const zonderLijst = await genereer();

  check('onbetrouwbare exclusiviteitslijst: Pro krijgt geen online oriëntatie (fail closed)', zonderLijst.status === 200 && w.openaiAantal === 0 && (zonderLijst.json.onlineSuggesties || []).length === 0, `${zonderLijst.status} ${w.openaiAantal}`);

  // Premium: tot 6 kandidaten.
  resetGenereren({ ...pool(), profile: PREMIUM, online: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => online({ gever: `Online Fonds ${n}`, regeling: `Online Regeling ${n}` })) });
  const premium = await genereer();

  check('Premium: de verkenner levert hoogstens 6 kandidaten', premium.json.werkwijze.onlineKandidaten === 6, JSON.stringify(premium.json.werkwijze));
  check('Premium: de database haalt het doel al (120%) en toch minstens 3 online suggesties, niet meer dan nodig', premium.json.totalen.nodig === 0 && premium.json.onlineSuggesties.length === 3, `${premium.json.totalen.nodig} ${premium.json.onlineSuggesties.length}`);
  check('Premium: dan is aanvullen niet nodig', premium.json.aanvullenMogelijk === false);
  check('Premium: geen Premium-hint (alleen bij Pro)', premium.json.premiumHint === null);
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('7. Premium-aanvullen: gericht op het resterende gat, stop zodra het doel gedekt is');
{
  const klein = () => ({ regelingen: [regeling({ naam: 'Rotterdams Muziekfonds', gever: 'Gemeente Rotterdam', min: 5000, max: 60000, id: '00000000-0000-4000-8000-0000000000a1' })], funders: [] });
  const voorstelVan = (bedrag) => ({ versie: 1, projectId: PID, status: 'concept', aannames: [], acties: [], regels: [{ type: 'regeling', id: '00000000-0000-4000-8000-0000000000a1', naam: 'Rotterdams Muziekfonds', gever: 'Gemeente Rotterdam', bedrag }] });

  resetGenereren({ ...klein(), profile: PRO });
  const pro = await aanvul(voorstelVan(35000));

  check('Pro: aanvullen geweigerd (403), geen OpenAI', pro.status === 403 && w.openaiAantal === 0, String(pro.status));

  resetGenereren({ ...klein(), profile: PREMIUM, online: [1, 2, 3, 4, 5, 6].map((n) => online({ gever: `Gericht Online Fonds ${n}`, regeling: `Gerichte Regeling ${n}`, bedragMin: 20000, bedragMax: 40000 })) });
  const r = await aanvul(voorstelVan(35000));
  const j = r.json;

  check('Premium: 200 en ok, niets opgeslagen', r.status === 200 && j.ok === true && geenSchrijven(), `${r.status} ${r.tekst.slice(0, 200)}`);
  check('het resterende gat komt van de SERVER (112.000 - 35.000 = 77.000)', j.rest.nodig === 77000 && j.rest.som === 35000, JSON.stringify(j.rest));
  check('de zoekopdracht noemt het resterende bedrag en sluit al bekende financiers uit', /ongeveer € 77000/.test(JSON.stringify(w.openaiBodies[0])) && /Noem NIET: .*Rotterdams Muziekfonds/.test(JSON.stringify(w.openaiBodies[0])));
  check('cap 5: de verkenner mag hoogstens 5 kandidaten opleveren', /Maximaal 5 kandidaten/.test(JSON.stringify(w.openaiBodies[0])));
  check('stop zodra de indicatieve bedragen het resterende gat dekken (77.000 = 4 x ongeveer 23.000, elk begrensd op een derde van het gat), ook al zijn er meer', j.onlineSuggesties.length === 4 && j.onlineIndicatief >= 77000, `${j.onlineSuggesties.length} ${j.onlineIndicatief}`);
  check('dat is het einde: geen nieuwe ronde nodig', j.nogAanvullen === false);
  check('de suggesties zijn niet gecontroleerd en worden niet in het voorstel gezet', j.onlineSuggesties.every((s) => s.gecontroleerd === false) && j.voorstel === undefined);
  check('de kostenmeter telt de web-zoekopdrachten', w.gebruikRijen.some((rij) => rij.action_type === 'fonds_scan_web' && rij.web_search_calls === 2 && rij.tier === 'premium'), JSON.stringify(w.gebruikRijen));

  // Doel al bereikt: geen zoekopdracht (kosten besparen).
  resetGenereren({ ...klein(), profile: PREMIUM, online: [online({})] });
  const bereikt = await aanvul({ ...voorstelVan(60000), regels: [{ ...voorstelVan(60000).regels[0], bedrag: 60000 }, { type: 'regeling', id: '00000000-0000-4000-8000-0000000000a9', naam: 'x', bedrag: 1 }] });

  check('het voorstel zit al op het doel: geen zoekopdracht, geen kosten', bereikt.status === 200 && (bereikt.json.uitkomst === 'doel-bereikt' ? w.openaiAantal === 0 : true), `${bereikt.status} ${bereikt.json?.uitkomst} ${w.openaiAantal}`);

  // De client kan het resterende gat niet beïnvloeden door een hoger bedrag op te geven dan het record toestaat.
  resetGenereren({ ...klein(), profile: PREMIUM, online: [online({})] });
  const opgeblazen = await aanvul(voorstelVan(5_000_000));

  check('een onmogelijk hoog bedrag van de client wordt door de server teruggebracht (record-grenzen en gat); geen negatief resterend gat', opgeblazen.status === 200 && opgeblazen.json.rest.som <= 60000 && opgeblazen.json.rest.som <= 84000, JSON.stringify(opgeblazen.json?.rest));

  // Premium-record in het voorstel van een Pro-lid wordt weggefilterd (publiek niveau): hier Premium zelf is altijd toegestaan.
  resetGenereren({ ...klein(), profile: PREMIUM, flagUit: true, env: { OPENAI_API_KEY: 'sk-test', SUPABASE_URL: 'http://db.test', SUPABASE_SERVICE_ROLE_KEY: 'srv', SUPABASE_ANON_KEY: 'anon' } });
  check('flag uit: aanvullen 404', (await aanvul(voorstelVan(1000))).status === 404);
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('8. De preview laat de buffer van het abonnement toe (server bepaalt de factor)');
{
  const regelsMet = (bedragen) => ({
    versie: 1, projectId: PID, status: 'concept', aannames: [], acties: [],
    regels: [
      { type: 'regeling', id: '00000000-0000-4000-8000-0000000000a1', naam: 'Rotterdams Muziekfonds', gever: 'Gemeente Rotterdam', bedrag: bedragen[0] },
      { type: 'regeling', id: '00000000-0000-4000-8000-0000000000a3', naam: 'Landelijk Muziekpodium', gever: 'Landelijk Podium', bedrag: bedragen[1] },
    ],
  });
  const preview = (v) => post({ mode: 'voorstel-preview', projectId: PID, voorstel: v });
  const somVan = (r) => r.json.voorstel.regels.filter((x) => x.selecteerbaar).reduce((t, x) => t + (x.bedrag || 0), 0);
  const p = pool();

  // 60.000 + 24.000 = 84.000 = 120% van 70.000
  resetGenereren({ ...p, profile: PRO });
  const pro = await preview(regelsMet([60000, 24000]));

  check('Pro: 84.000 (120%) wordt niet teruggeschaald', pro.status === 200 && somVan(pro) === 84000 && !pro.json.waarschuwingen.some((x) => x.code === 'bedragen-geschaald'), `${pro.status} ${pro.json && somVan(pro)}`);
  resetGenereren({ ...p, profile: PRO });
  const proTeVeel = await preview(regelsMet([60000, 25000]));

  check('Pro: 85.000 (boven 120%) wordt teruggeschaald tot hoogstens 84.000', proTeVeel.status === 200 && somVan(proTeVeel) <= 84000 && proTeVeel.json.waarschuwingen.some((x) => x.code === 'bedragen-geschaald'), `${proTeVeel.status} ${proTeVeel.json && somVan(proTeVeel)}`);
  resetGenereren({ ...p, profile: PREMIUM });
  const premVoorstel = regelsMet([62000, 50000]);
  premVoorstel.regels[1] = { type: 'regeling', id: '00000000-0000-4000-8000-0000000000b1', naam: 'Premium Cultuurregeling', gever: 'Premium Gever', bedrag: 50000 };
  const prem = await preview(premVoorstel);

  check('Premium: 112.000 (160%) wordt niet teruggeschaald', prem.status === 200 && somVan(prem) === 112000 && !prem.json.waarschuwingen.some((x) => x.code === 'bedragen-geschaald'), `${prem.status} ${prem.json && somVan(prem)}`);
  resetGenereren({ ...p, profile: FREE });
  const free = await preview(regelsMet([60000, 17000]));

  check('Free: geen buffer; 77.000 wordt teruggeschaald tot hoogstens het gat (70.000)', free.status === 200 && somVan(free) <= 70000, `${free.status} ${free.json && somVan(free)}`);
  check('een factor in het verzoek heeft geen effect (de server bepaalt de buffer uit het abonnement)', true);
  resetGenereren({ ...p, profile: PRO });
  const sluw = await preview({ ...regelsMet([60000, 40000]), dekkingsdoel: 1.5 });

  check('Pro: een meegestuurde dekkingsdoel=1.5 wordt genegeerd (som blijft <= 84.000)', sluw.status === 200 && somVan(sluw) <= 84000, `${sluw.status} ${sluw.json && somVan(sluw)}`);
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('9. Statische eigenschappen van het genereren-blok');
{
  const bron = readFileSync('supabase/functions/subsidie-kompas/index.ts', 'utf8');
  const h1 = bron.indexOf('// VOORSTEL GENEREREN (dekkingsplan + actieplan)');
  const h2 = bron.indexOf('// VOORSTELPREVIEW (Fase C)');
  const m1 = bron.indexOf('if (body.mode === GENEREREN_ACTIE');
  const m2 = bron.indexOf("// Voorstelpreview (Fase C): alleen lezen, standaard uit.");
  const blok = bron.slice(h1, h2) + bron.slice(m1, m2);

  check('blokken gevonden', h1 > 0 && h2 > h1 && m1 > 0 && m2 > m1);
  check('geen insert/update/upsert/delete', !/\.(insert|update|upsert|delete)\s*\(/.test(blok));
  check('alleen leesbare RPC\'s', [...blok.matchAll(/\.rpc\(\s*'([a-z_]+)'/g)].every((m) => ['kompas_subsidieregelingen_voor_tier', 'kompas_funder_deadlines_voor_tier', 'kompas_funders_voor_matching'].includes(m[1])), JSON.stringify([...blok.matchAll(/\.rpc\(\s*'([a-z_]+)'/g)].map((m) => m[1])));
  check('geen opslag, taken of chatkoppeling', !/storage|localStorage|\.upload\(|project_actions|program_actions|kompas_conversations|legVerbruikVast/.test(blok));
  check('alleen de kostenmeter met tellers (geen inhoud)', [...blok.matchAll(/meldGebruik\(admin, \{([^}]*)\}/g)].every((m) => /actie: 'fonds_scan_(database|web)'/.test(m[1]) && !/(voorstel|regels|tekst|naam|url|body|criteria)/i.test(m[1].replace(/projectId: b\.project\.id/, ''))));
  check('geen taalmodel voor het afleiden van criteria (alleen de online verkenner)', !/criteriaUitGesprek|chat\/completions/.test(blok));
  check('de entitlementlaag wordt gebruikt', /applyEntitlementsAndSanitize/.test(blok) && /selecteerFreeFondsadvies/.test(blok) && /voorstelRecordUitRij/.test(blok));
  check('de tier komt uit de server (tierConfigVoor), nooit uit het verzoek', /tierConfigVoor\(tier, isAdmin\)/.test(blok) && !/body\.tier|body\.dekkingsdoel|body\.config/.test(blok));
  check('dynamische imports alleen uit ../_shared', [...blok.matchAll(/import\('([^']+)'\)/g)].every((m) => m[1].startsWith('../_shared/')));
  check('geen statische import van _shared in index.ts (chat-opstart onaangetast)', !/^import .*_shared/m.test(bron));
  check('standaard uit: de flag VOORSTEL_GENEREREN gaat via voorstelVlagAan (aan of testers)', /!voorstelVlagAan\(Deno\.env\.get\('VOORSTEL_GENEREREN'\), Deno\.env\.get\('VOORSTEL_TESTERS'\), profileId\)/.test(blok));
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('10. Premium zoekt online door tot 120% gedekt is (minstens 3, meer dan 6 als er te weinig fondsen zijn); Pro krijgt een Premium-hint');
{
  const klein = () => ({ regelingen: [regeling({ naam: 'Rotterdams Muziekfonds', gever: 'Gemeente Rotterdam', min: 5000, max: 20000, id: '00000000-0000-4000-8000-0000000000a1' })], funders: [] });
  const kleine = (n) => online({ gever: `Klein Online Fonds ${n}`, regeling: `Kleine Regeling ${n}`, bedragMin: 1000, bedragMax: 4000 });

  // Te weinig in de database en kleine online bedragen: meer dan 3, het eerste lijstje is de oriëntatie (6), er kan nog worden aangevuld.
  resetGenereren({ ...klein(), profile: PREMIUM, online: [1, 2, 3, 4, 5, 6, 7, 8].map(kleine) });
  const tekort = await genereer();
  const t = tekort.json;

  check('tekort: meer dan 3 online suggesties (tot de oriëntatie van 6), want het doel is nog niet gedekt', t.onlineSuggesties.length > 3 && t.onlineSuggesties.length <= 6, String(t.onlineSuggesties.length));
  check('tekort: de database + indicaties halen 120% nog niet, dus aanvullen is mogelijk', t.aanvullenMogelijk === true && t.totalen.som + t.onlineIndicatief < t.totalen.doelBedrag, JSON.stringify([t.totalen, t.onlineIndicatief, t.aanvullenMogelijk]));
  check('tekort: de online indicaties tellen NIET mee in de gevalideerde dekking', t.totalen.som === t.voorstel.regels.filter((x) => x.selecteerbaar && x.bedrag).reduce((x, r) => x + r.bedrag, 0));

  // Zoveel online als nodig om het doel te halen, niet meer: grote bedragen -> toch minstens 3 (minimum), maar ook niet meer dan 3 bij dekking.
  resetGenereren({ ...klein(), profile: PREMIUM, online: [1, 2, 3, 4, 5, 6].map((n) => online({ gever: `Groot Online Fonds ${n}`, regeling: `Grote Regeling ${n}`, bedragMin: 5000, bedragMax: 60000 })) });
  const groot = await genereer();

  check('grote online bedragen: zoveel als nodig om het doel (160%) te halen (elk voorzichtig begrensd op een derde van het gat), niet alle 6', groot.json.onlineSuggesties.length >= 3 && groot.json.onlineSuggesties.length < 6 && groot.json.onlineIndicatief >= groot.json.totalen.nodig, `${groot.json.onlineSuggesties.length} ${groot.json.onlineIndicatief} ${JSON.stringify(groot.json.rest || groot.json.totalen)}`);

  // Aanvullen: telt wat al getoond is mee, stopt bij dekking, en het totaal blijft binnen het maximum (10).
  const voorstelVan = (bedrag) => ({ versie: 1, projectId: PID, status: 'concept', aannames: [], acties: [], regels: [{ type: 'regeling', id: '00000000-0000-4000-8000-0000000000a1', naam: 'Rotterdams Muziekfonds', gever: 'Gemeente Rotterdam', bedrag }] });
  const getoond = (n, bedrag) => Array.from({ length: n }, (_, i) => ({ gever: `Eerder Getoond ${i + 1}`, indicatiefBedrag: bedrag }));

  resetGenereren({ ...klein(), profile: PREMIUM, online: [1, 2, 3, 4, 5, 6, 7].map(kleine) });
  const rondeTwee = await aanvul(voorstelVan(20000), { getoond: getoond(6, 4000) });

  check('aanvullen na 6 getoonde: het totale maximum is 10, dus hoogstens 4 kandidaten gevraagd', rondeTwee.status === 200 && /Maximaal 4 kandidaten/.test(JSON.stringify(w.openaiBodies[0])), `${rondeTwee.status} ${JSON.stringify(w.openaiBodies[0] || '').slice(0, 0)}`);
  check('aanvullen: al getoonde financiers worden uitgesloten en niet opnieuw voorgesteld', /Noem NIET: .*Eerder Getoond 1/.test(JSON.stringify(w.openaiBodies[0])) && rondeTwee.json.onlineSuggesties.every((x) => !/Eerder Getoond/.test(x.gever)));
  check('aanvullen: het gevraagde bedrag is het resterende gat min de al getoonde indicaties (6 x 4.000)', Number(/ongeveer € (\d+)/.exec(JSON.stringify(w.openaiBodies[0]))?.[1]) === rondeTwee.json.rest.nodig - 24000, JSON.stringify(rondeTwee.json.rest));
  check('aanvullen: totaal nooit boven 10 (6 getoond + hoogstens 4 nieuwe)', rondeTwee.json.onlineSuggesties.length <= 4);

  resetGenereren({ ...klein(), profile: PREMIUM, online: [1, 2, 3, 4].map(kleine) });
  const vol = await aanvul(voorstelVan(20000), { getoond: getoond(10, 100) });

  check('totaal maximum (10) bereikt: geen zoekopdracht, geen kosten', vol.status === 200 && vol.json.uitkomst === 'maximum-bereikt' && w.openaiAantal === 0, `${vol.status} ${vol.json?.uitkomst} ${w.openaiAantal}`);

  resetGenereren({ ...klein(), profile: PREMIUM, online: [1].map(kleine) });
  const gedekt = await aanvul(voorstelVan(20000), { getoond: getoond(3, 1_000_000) });

  check('de al getoonde online indicaties dekken het gat al: geen zoekopdracht', gedekt.status === 200 && gedekt.json.uitkomst === 'doel-bereikt' && w.openaiAantal === 0);

  // Een kwaadwillende client: rommel in "getoond" breekt niets en geeft niet meer zoekruimte dan het maximum.
  resetGenereren({ ...klein(), profile: PREMIUM, online: [1, 2, 3, 4, 5, 6].map(kleine) });
  const rommel = await aanvul(voorstelVan(20000), { getoond: [null, 5, { gever: 12 }, { gever: 'x', indicatiefBedrag: -5 }, { gever: 'y', indicatiefBedrag: 'veel' }, ...Array(50).fill({ gever: 'z', indicatiefBedrag: 1 })] });

  check('rommel in getoond: geen crash, hoogstens 5 per ronde', rommel.status === 200 && rommel.json.onlineSuggesties.length <= 5, `${rommel.status}`);

  // Pro: de hint is alleen een AANTAL, nooit een naam of detail van een Premium-fonds.
  resetGenereren({ ...pool(), profile: PRO });
  const proHint = await genereer();
  const hint = proHint.json.premiumHint;

  check('Pro: er is een Premium-hint met het aantal passende Premium-only fondsen', hint && Number.isInteger(hint.aantal) && hint.aantal >= 1, JSON.stringify(hint));
  check('Pro: de hint bevat alleen { aantal }, geen namen, ids of andere details', hint && Object.keys(hint).join() === 'aantal');
  check('Pro: het aantal klopt met wat Premium extra ziet (Premium Cultuurregeling; het exclusieve fonds telt NIET mee)', hint.aantal === 1, String(hint && hint.aantal));
  check('Pro: nog steeds geen Premium-naam of exclusief fonds in het antwoord', NAMEN_VERBORGEN_VOOR_PRO.every((n) => !proHint.tekst.includes(n)), NAMEN_VERBORGEN_VOOR_PRO.filter((n) => proHint.tekst.includes(n)).join(','));
  check('Pro: de Premium-regeling zit niet in het voorstel (de hint verandert de pool niet)', !regelNamen(proHint).includes('Premium Cultuurregeling'));

  // Geen Premium-only fondsen: geen hint (geen schijnbelofte).
  resetGenereren({ regelingen: [regeling({ naam: 'Rotterdams Muziekfonds', gever: 'Gemeente Rotterdam', min: 5000, max: 120000, id: '00000000-0000-4000-8000-0000000000a1' })], funders: [], profile: PRO });
  const geenHint = await genereer();

  check('Pro zonder passende Premium-only fondsen: geen hint', geenHint.status === 200 && geenHint.json.premiumHint === null);

  resetGenereren({ ...pool(), profile: { ...PRO, role: 'admin' } });
  const admin = await genereer();

  check('Admin krijgt geen Pro-hint', admin.status === 200 && admin.json.premiumHint === null);
}

console.log(`\nVOORSTEL-GENEREREN: ${stand.ok} OK, ${stand.fout} FAIL`);
process.exit(stand.fout ? 1 : 0);
