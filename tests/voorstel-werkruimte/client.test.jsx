import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
const g = globalThis;
g.window = dom.window; g.document = dom.window.document; g.localStorage = dom.window.localStorage;
Object.defineProperty(g, 'navigator', { value: dom.window.navigator, configurable: true });
g.HTMLElement = dom.window.HTMLElement; g.Event = dom.window.Event; g.MouseEvent = dom.window.MouseEvent;
g.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import('react')).default;
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const client = await import('../checkout-frontend/fake-client.js');
const W = await import('../../src/features/kompas-app/financiering/voorstelWerk.js');
const { vraagVoorstelGenereren, vraagVoorstelAanvullen } = await import('../../src/data/services/voorstelGenereren.js');
const { default: VoorstelWerkruimte } = await import('../../src/features/kompas-app/financiering/VoorstelWerkruimte.jsx');
const { default: VoorstelStart } = await import('../../src/features/kompas-app/financiering/VoorstelStart.jsx');

const stand = { ok: 0, fout: 0 };
const check = (naam, waar, detail = '') => { if (waar) stand.ok += 1; else { stand.fout += 1; console.log(`  FAIL: ${naam} ${detail}`); } };
const sectie = (t) => console.log(`\n== ${t}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ID1 = 'a0000000-0000-4000-8000-000000000001';
const ID2 = 'a0000000-0000-4000-8000-000000000002';
const ID3 = 'a0000000-0000-4000-8000-000000000003';
const regel = (n, id, extra = {}) => ({ sleutel: `r:regeling:${id}`, type: 'regeling', id, naam: `Regeling ${n}`, gever: `Gever ${n}`, bedrag: 30000, grenzen: { min: 5000, max: 50000 }, deadline: { status: 'geverifieerd', datum: '2026-12-01', verlopen: false }, selecteerbaar: true, staatAl: false, motivatie: 'Past.', onzekerheden: [], ...extra });
const actie = (sleutel, regelSleutel, extra = {}) => ({ sleutel, regelSleutel, titel: `Taak ${sleutel}`, financier: 'Gever', datum: '2026-11-20', prioriteit: 'normal', toelichting: 'Toelichting', ...extra });
const genereerAntwoord = (extra = {}) => ({
  ok: true, uitkomst: 'voorstel', melding: null, dekkingsdoel: 1.1,
  voorstel: { versie: 1, regels: [regel(1, ID1), regel(2, ID2), regel(3, ID3, { bedrag: null })], acties: [actie('a1', `r:regeling:${ID1}`), actie('a2', `r:regeling:${ID2}`), actie('a3', null, { titel: 'Projecttaak' })] },
  reserveSleutel: `r:regeling:${ID3}`, onlineSuggesties: [], aanvullenMogelijk: false,
  totalen: { gat: 55000, doelBedrag: 60500, som: 60000, nodig: 0, dekking: 1.09 }, opgeslagen: false, ...extra,
});
const previewAntwoord = (voorstel) => ({ ok: true, voorstel, verificaties: [], overgeslagen: [], totalen: { voorgesteld: 60000, gat: 55000, nietToegewezen: 0 }, opgeslagen: false, actiesGegenereerd: false });

function dienstenMet({ gen = genereerAntwoord(), aanv = null, prev = true, log = [] } = {}) {
  return {
    log,
    genereer: async (a) => { log.push(['genereer', a]); return gen ? { ok: true, antwoord: gen } : { ok: false, reden: 'geen-begroting', melding: 'Vul eerst de projectbegroting in.' }; },
    aanvullen: async (a) => { log.push(['aanvullen', a]); return aanv ? { ok: true, antwoord: aanv } : { ok: false, reden: 'fout', melding: 'x' }; },
    preview: async (a) => { log.push(['preview', a]); return prev ? { ok: true, antwoord: previewAntwoord(a.voorstel) } : { ok: false, reden: 'fout', melding: 'x' }; },
    voegRegelToe: async (a) => { log.push(['regel', a]); return { ok: true, id: `f-${log.length}` }; },
    voegFinancierToe: async (a) => { log.push(['financier', a]); return { ok: true, id: 'x' }; },
    voegActieToe: async (a) => { log.push(['actie', a]); return { ok: true, id: 't' }; },
  };
}

sectie('1. Flow: volgorde en niets opgeslagen');
{
  const d = dienstenMet();
  const stappen = [];
  const res = await W.draaiVoorstelFlow({ projectId: 'p1', diensten: d, onStap: (s) => stappen.push(s) });
  check('ok', res.ok === true);
  check('stappen: onderzoeken, controleren (Pro: geen aanvullen)', stappen.join() === 'onderzoeken,controleren', stappen.join());
  check('geen schrijfpad aangeroepen', d.log.every(([n]) => ['genereer', 'aanvullen', 'preview'].includes(n)));
  check('preview krijgt geen acties', d.log.find(([n]) => n === 'preview')[1].voorstel.acties.length === 0);
  const d2 = dienstenMet({ gen: genereerAntwoord({ aanvullenMogelijk: true }), aanv: { ok: true, uitkomst: 'aangevuld', onlineSuggesties: [{ gever: 'Online BV', naam: 'Fonds X', url: 'https://x.example/aanvragen' }] } });
  const s2 = [];
  const r2 = await W.draaiVoorstelFlow({ projectId: 'p1', diensten: d2, onStap: (s) => s2.push(s) });
  check('Premium: onderzoeken, aanvullen, controleren', s2.join() === 'onderzoeken,aanvullen,controleren');
  check('aanvullen krijgt het voorstel', d2.log.find(([n]) => n === 'aanvullen')[1].voorstel.regels.length === 3);
  const m2 = W.maakWerkModel(r2);
  check('suggestie uit aanvullen in model', m2.suggesties.length === 1 && m2.suggesties[0].url === 'https://x.example/aanvragen');
  const d3 = dienstenMet({ gen: genereerAntwoord({ aanvullenMogelijk: true }), aanv: null });
  const r3 = await W.draaiVoorstelFlow({ projectId: 'p1', diensten: d3 });
  check('aanvullen mislukt: voorstel blijft bruikbaar', r3.ok && r3.aanvulling === null);
  const d4 = dienstenMet({ gen: null });
  const r4 = await W.draaiVoorstelFlow({ projectId: 'p1', diensten: d4 });
  check('genereer mislukt: ok false met melding, niets verder', !r4.ok && /begroting/.test(r4.melding) && d4.log.length === 1);
  const d5 = dienstenMet({ gen: genereerAntwoord({ voorstel: null, uitkomst: 'geen-gat' }) });
  const r5 = await W.draaiVoorstelFlow({ projectId: 'p1', diensten: d5 });
  check('geen voorstel (gedekt): geen preview', r5.ok && r5.preview === null && !d5.log.some(([n]) => n === 'preview'));
  const d6 = dienstenMet({ prev: false });
  const r6 = await W.draaiVoorstelFlow({ projectId: 'p1', diensten: d6 });
  check('preview mislukt: model "niet gecontroleerd"', r6.ok && W.maakWerkModel(r6).gecontroleerd === false);
}

sectie('2. Werkmodel, totalen, buffer');
{
  const res = await W.draaiVoorstelFlow({ projectId: 'p1', diensten: dienstenMet() });
  const m = W.maakWerkModel(res);
  const sel = W.beginSelectie(m);
  const bed = W.beginBedragen(m);
  check('reserve niet standaard geselecteerd', !sel.regels.has(`r:regeling:${ID3}`) && sel.regels.size === 2);
  check('bedragen met punten', bed[`r:regeling:${ID1}`] === '30.000');
  let t = W.berekenSelectieTotaal(m, sel, bed);
  check('totaal 60.000, dekking 109%', t.voorgesteld === 60000 && Math.round(t.dekking * 100) === 109);
  check('boven gat = buffertekst', t.bovenGat && /inclusief buffer voor afwijzingen/.test(W.dekkingTekst(t, m)), W.dekkingTekst(t, m));
  check('niet boven doel (60.500)', !t.bovenDoel);
  check('bufferuitleg noemt 110%', /110%/.test(W.bufferUitleg(m)));
  t = W.berekenSelectieTotaal(m, sel, { ...bed, [`r:regeling:${ID1}`]: '45.000' });
  check('boven doel gesignaleerd', t.bovenDoel);
  t = W.berekenSelectieTotaal(m, sel, { ...bed, [`r:regeling:${ID1}`]: '4.000' });
  check('onder minimum: waarschuwing, geen blokkade', t.fouten[`r:regeling:${ID1}`] === 'onder-minimum');
  t = W.berekenSelectieTotaal(m, sel, { ...bed, [`r:regeling:${ID1}`]: 'abc' });
  check('ongeldig bedrag', t.fouten[`r:regeling:${ID1}`] === 'ongeldig');
  const minder = W.dekkingTekst({ dekking: 0.8, bovenGat: false }, m);
  check('onder het gat: geen bufferwoord', minder === '80% van het financieringsgat');
  // verlopen/onbevestigde deadline wordt nooit als geverifieerd getoond
  const mm = W.maakWerkModel({ genereer: genereerAntwoord({ voorstel: { versie: 1, regels: [regel(1, ID1, { deadline: { status: 'te-verifieren', datum: '2026-12-01' } })], acties: [] } }), aanvulling: null, preview: null });
  check('deadline zonder status geverifieerd -> null', mm.regels[0].deadline === null);
  const staatAl = W.maakWerkModel({ genereer: genereerAntwoord({ voorstel: { versie: 1, regels: [regel(1, ID1, { staatAl: true })], acties: [] } }), aanvulling: null, preview: null });
  check('staatAl niet selecteerbaar', !staatAl.regels[0].selecteerbaar && W.beginSelectie(staatAl).regels.size === 0);
  const dub = W.maakWerkModel({ genereer: genereerAntwoord({ onlineSuggesties: [{ gever: 'A' }, { gever: 'a' }, { gever: 'B', url: 'http://onveilig' }] }), aanvulling: null, preview: null });
  check('suggesties ontdubbeld, http-bron genegeerd', dub.suggesties.length === 2 && dub.suggesties[1].url === null);
}

sectie('3. Opslagplan en uitvoering');
{
  const res = await W.draaiVoorstelFlow({ projectId: 'p1', diensten: dienstenMet() });
  const m = W.maakWerkModel(res);
  const sel = W.beginSelectie(m);
  sel.regels.delete(`r:regeling:${ID2}`);
  const plan = W.bouwOpslagPlan(m, sel, W.beginBedragen(m));
  check('plan: 1 regel met zijn taak, 1 projecttaak', plan.regels.length === 1 && plan.regels[0].acties.length === 1 && plan.projectActies.length === 1);
  check('taak van afgevinkte regel niet in plan', !plan.regels.some((r) => r.acties.some((a) => a.sleutel === 'a2')));
  const d = dienstenMet();
  const uit = await W.voerOpslagUit({ projectId: 'p1', plan, diensten: d });
  const regelCall = d.log.find(([n]) => n === 'regel')[1];
  check('regel met status interesting en bedrag', regelCall.status === 'interesting' && regelCall.requested === 30000 && regelCall.schemeId === ID1 && regelCall.funderId === null);
  const acties = d.log.filter(([n]) => n === 'actie').map(([, a]) => a);
  check('taak gekoppeld aan regel (fundingId), projecttaak zonder', acties[0].fundingId && acties[1].fundingId === null);
  check('uitkomst: 1 regel, 2 taken', uit.regelsToegevoegd === 1 && uit.actiesToegevoegd === 2);
  // bestaat al: taken van die regel niet aanmaken
  const d2 = dienstenMet(); d2.voegRegelToe = async () => ({ ok: false, reden: 'bestaat-al' });
  const u2 = await W.voerOpslagUit({ projectId: 'p1', plan, diensten: d2 });
  check('bestaat al: gemeld, geen regeltaken', u2.regelsBestondAl.length === 1 && u2.actiesToegevoegd === 1);
  // suggestie: zonder bedrag, met bronnotitie
  const s = W.maakWerkModel({ genereer: genereerAntwoord({ onlineSuggesties: [{ gever: 'Online BV', naam: 'Fonds X', url: 'https://x.example/a' }] }), aanvulling: null, preview: null });
  const sl = W.beginSelectie(s); sl.suggesties.add('online:0');
  const d3 = dienstenMet();
  await W.voerOpslagUit({ projectId: 'p1', plan: W.bouwOpslagPlan(s, sl, W.beginBedragen(s)), diensten: d3 });
  const f = d3.log.find(([n]) => n === 'financier')[1];
  check('suggestie: geen bedrag, Interessant, notitie "nog niet gecontroleerd"', f.bedrag === null && f.status === 'interesting' && /nog niet gecontroleerd/.test(f.notitie) && /x\.example/.test(f.notitie));
}

sectie('4. Service');
{
  client.__reset();
  client.__zetSupabase({ functions: { invoke: async (naam, o) => { client.log.invoke.push([naam, o.body]); return { data: { ok: true, uitkomst: 'voorstel' }, error: null }; } } });
  const a = await vraagVoorstelGenereren({ projectId: 'p1' });
  check('genereren: juiste mode, geen tier/bedrag in body', a.ok && client.log.invoke[0][1].mode === 'voorstel-genereren' && Object.keys(client.log.invoke[0][1]).sort().join() === 'mode,projectId');
  const b = await vraagVoorstelAanvullen({ projectId: 'p1', voorstel: { versie: 1, regels: [], acties: [] } });
  check('aanvullen: juiste mode', b.ok && client.log.invoke[1][1].mode === 'voorstel-aanvullen');
  check('zonder projectId: fout, geen call', !(await vraagVoorstelGenereren({})).ok && client.log.invoke.length === 2);
  client.__zetSupabase({ functions: { invoke: async () => ({ data: null, error: { context: new Response(JSON.stringify({ reden: 'geen-begroting' }), { status: 422 }) } }) } });
  const c = await vraagVoorstelGenereren({ projectId: 'p1' });
  check('422 geen-begroting: nette melding', !c.ok && c.reden === 'geen-begroting' && /begroting/.test(c.melding));
  client.__zetSupabase({ functions: { invoke: async () => { throw new Error('netwerk'); } } });
  check('netwerkfout: ok false', !(await vraagVoorstelGenereren({ projectId: 'p1' })).ok);
  client.__zetSupabase({ functions: { invoke: async () => ({ data: { ok: false }, error: null }) } });
  check('ok:false van server: fout', !(await vraagVoorstelGenereren({ projectId: 'p1' })).ok);
}

// ---- component
const wortel = createRoot(document.getElementById('root'));
const q = (sel) => document.querySelector(sel);
const qa = (sel) => [...document.querySelectorAll(sel)];
async function toon(el) { await act(async () => { wortel.render(el); }); }
async function klik(el) { await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); await sleep(20); }); }
async function typ(el, waarde) {
  await act(async () => {
    const set = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
    set.call(el, waarde);
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
}
const PROJECT_OK = { id: 'p1', naam: 'Project', omschrijving: 'Sportprogramma voor jongeren in Rotterdam-Zuid', doelstellingen: 'Meer jongeren laten sporten', regio: 'Rotterdam', doelgroep: 'Jongeren', begroting: 100000 };

sectie('5. Startknop (VoorstelStart)');
{
  await toon(<VoorstelStart project={PROJECT_OK} beschikbaar opgeslagen onStart={() => {}} />);
  const knop = q('[data-testid="voorstel-start-knop"]');
  // Of PROJECT_OK volledig genoeg is voor de beoordeling hangt van de projectvelden af; we controleren de combinaties hieronder.
  const aan = !knop.disabled;
  await toon(<VoorstelStart project={PROJECT_OK} beschikbaar opgeslagen bezig onStart={() => {}} />);
  check('bezig: knop uit', q('[data-testid="voorstel-start-knop"]').disabled);
  await toon(<VoorstelStart project={PROJECT_OK} beschikbaar={false} opgeslagen onStart={() => {}} />);
  check('flow niet beschikbaar: knop uit + oude uitleg', q('[data-testid="voorstel-start-knop"]').disabled && q('[data-testid="voorstel-nog-niet"]'));
  await toon(<VoorstelStart project={PROJECT_OK} beschikbaar opgeslagen={false} onStart={() => {}} />);
  check('niet opgeslagen: knop uit', q('[data-testid="voorstel-start-knop"]').disabled);
  await toon(<VoorstelStart project={{ id: 'p1', naam: 'Leeg' }} beschikbaar opgeslagen onStart={() => {}} />);
  check('project zonder essentiële gegevens: knop uit + uitleg', q('[data-testid="voorstel-start-knop"]').disabled && q('[data-testid="voorstel-eerst-aanvullen"]'));
  console.log(`  (info) PROJECT_OK knop ${aan ? 'aan' : 'uit'}`);
  check('PROJECT_OK (volledig project): knop aan', aan);
}

sectie('6. Werkruimte (klik, bewerken, opslaan)');
{
  const log = [];
  const d = dienstenMet({ log });
  let opgeslagenAantal = 0;
  await toon(<VoorstelWerkruimte project={PROJECT_OK} beschikbaar opgeslagen diensten={d} onOpgeslagen={() => { opgeslagenAantal += 1; }} />);
  check('start: geen resultaat, niets aangeroepen', !q('[data-testid="voorstel-resultaat"]') && log.length === 0);
  await klik(q('[data-testid="voorstel-start-knop"]'));
  await act(async () => { await sleep(50); });
  check('resultaat zichtbaar', !!q('[data-testid="voorstel-resultaat"]'));
  check('"nog niets opgeslagen" zichtbaar', !!q('[data-testid="voorstel-niet-opgeslagen"]'));
  check('nog geen schrijfpad geraakt na genereren', !log.some(([n]) => ['regel', 'actie', 'financier'].includes(n)));
  check('3 rijen (2 + reserve)', qa('[data-testid="voorstel-rij"]').length === 3);
  check('dekkingstekst met buffer', /109%.*inclusief buffer voor afwijzingen/.test(q('[data-testid="voorstel-dekking"]').textContent), q('[data-testid="voorstel-dekking"]').textContent);
  check('geverifieerd-label ontbreekt (preview zonder verificaties): nergens "Geverifieerd" als vlag', !/Geverifieerd/.test(q('[data-testid="voorstel-resultaat"]').textContent));
  // afvinken tweede regel
  const kies = qa('[data-testid="voorstel-kies"]');
  await klik(kies[1]);
  check('afgevinkt: som 30.000', /30\.000/.test(q('[data-testid="voorstel-som"]').textContent), q('[data-testid="voorstel-som"]').textContent);
  // ongeldig bedrag blokkeert opslaan
  await typ(qa('[data-testid="voorstel-bedrag"]')[0], 'abc');
  check('ongeldig bedrag: opslaan uit', q('[data-testid="voorstel-opslaan"]').disabled);
  await typ(qa('[data-testid="voorstel-bedrag"]')[0], '25.000');
  check('geldig: opslaan aan', !q('[data-testid="voorstel-opslaan"]').disabled);
  await klik(q('[data-testid="voorstel-opslaan"]'));
  await act(async () => { await sleep(50); });
  const regelCalls = log.filter(([n]) => n === 'regel').map(([, a]) => a);
  check('opgeslagen: 1 regel, bedrag 25000 zoals aangepast, status interesting', regelCalls.length === 1 && regelCalls[0].requested === 25000 && regelCalls[0].status === 'interesting');
  check('onOpgeslagen aangeroepen', opgeslagenAantal === 1);
  check('samenvatting zichtbaar', !!q('[data-testid="voorstel-opgeslagen"]') && /Interessant/.test(q('[data-testid="voorstel-opgeslagen"]').textContent));
  await klik(q('[data-testid="voorstel-sluiten"]'));
  check('sluiten: terug naar start', !q('[data-testid="voorstel-opgeslagen"]'));
}
{
  // Sluiten zonder opslaan raakt niets
  const log = [];
  await toon(<VoorstelWerkruimte project={PROJECT_OK} beschikbaar opgeslagen diensten={dienstenMet({ log })} />);
  await klik(q('[data-testid="voorstel-start-knop"]'));
  await act(async () => { await sleep(50); });
  await klik(q('[data-testid="voorstel-verwerp"]'));
  check('sluiten zonder opslaan: geen schrijfpad', !log.some(([n]) => ['regel', 'actie', 'financier'].includes(n)) && !q('[data-testid="voorstel-resultaat"]'));
  // Fout van de server
  await toon(<VoorstelWerkruimte project={PROJECT_OK} beschikbaar opgeslagen diensten={dienstenMet({ gen: null })} />);
  await klik(q('[data-testid="voorstel-start-knop"]'));
  await act(async () => { await sleep(50); });
  check('serverfout: melding, geen resultaat', /begroting/.test(q('[data-testid="voorstel-fout"]').textContent) && !q('[data-testid="voorstel-resultaat"]'));
  // Niet gecontroleerd
  await toon(<VoorstelWerkruimte project={PROJECT_OK} beschikbaar opgeslagen diensten={dienstenMet({ prev: false })} />);
  await klik(q('[data-testid="voorstel-start-knop"]'));
  await act(async () => { await sleep(50); });
  check('preview mislukt: waarschuwing "niet gecontroleerd"', !!q('[data-testid="voorstel-niet-gecontroleerd"]') && q('[data-testid="voorstel-resultaat"]').dataset.gecontroleerd === 'nee');
  // Online suggestie
  await toon(<VoorstelWerkruimte project={PROJECT_OK} beschikbaar opgeslagen diensten={dienstenMet({ gen: genereerAntwoord({ onlineSuggesties: [{ gever: 'Online BV', naam: 'Fonds X', url: 'https://x.example/a' }] }) })} />);
  await klik(q('[data-testid="voorstel-start-knop"]'));
  await act(async () => { await sleep(50); });
  check('online-suggestie getoond met "nog niet gecontroleerd" en standaard uit', !!q('[data-testid="voorstel-online"]') && /nog niet gecontroleerd/.test(q('[data-testid="voorstel-online"]').textContent) && !q('[data-testid="voorstel-suggestie"] input').checked);
  check('bron-link veilig (noopener)', /noopener/.test(q('[data-testid="voorstel-online"] a').getAttribute('rel')));
}

console.log(`\n${stand.ok} geslaagd, ${stand.fout} mislukt`);
process.exit(stand.fout ? 1 : 0);
