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
const B = await import('../../src/features/kompas-app/financiering/bronStatus.js');
const S = await import('../../src/data/services/voorstelGenereren.js');
const { default: VoorstelWerkruimte } = await import('../../src/features/kompas-app/financiering/VoorstelWerkruimte.jsx');
const { default: FondsMatchKaart } = await import('../../src/features/kompas-app/chat/FondsMatchKaart.jsx');
const { readFileSync } = await import('node:fs');
const { join } = await import('node:path');

const ROOT = process.env.REPO_ROOT || process.cwd();
const stand = { ok: 0, fout: 0 };
const check = (naam, waar, detail = '') => { if (waar) stand.ok += 1; else { stand.fout += 1; console.log(`  FAIL: ${naam} ${detail}`); } };
const sectie = (t) => console.log(`\n== ${t}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ID1 = 'a0000000-0000-4000-8000-000000000001';
const ID2 = 'a0000000-0000-4000-8000-000000000002';
const ID3 = 'a0000000-0000-4000-8000-000000000003';
const PID = 'b0000000-0000-4000-8000-0000000000aa';
const sl = (id, type = 'regeling') => `r:${type}:${id}`;
const regel = (n, id, extra = {}) => ({ sleutel: sl(id), type: 'regeling', id, naam: `Regeling ${n}`, gever: `Gever ${n}`, bedrag: 30000, grenzen: { min: 5000, max: 50000 }, deadline: { status: 'geverifieerd', datum: '2026-12-01', verlopen: false }, selecteerbaar: true, staatAl: false, motivatie: 'Past.', onzekerheden: [], ...extra });
const actie = (sleutel, regelSleutel, extra = {}) => ({ sleutel, regelSleutel, titel: `Taak ${sleutel}`, financier: 'Gever', datum: '2026-11-20', prioriteit: 'normal', toelichting: 'Toelichting', ...extra });
const genereerAntwoord = (extra = {}) => ({
  ok: true, uitkomst: 'voorstel', melding: null, dekkingsdoel: 1.1,
  voorstel: { versie: 1, regels: [regel(1, ID1), regel(2, ID2), regel(3, ID3, { bedrag: null })], acties: [actie('a1', sl(ID1)), actie('a2', sl(ID2)), actie('a3', null, { titel: 'Projecttaak' })] },
  reserveSleutel: sl(ID3), onlineSuggesties: [], aanvullenMogelijk: false,
  totalen: { gat: 55000, doelBedrag: 60500, som: 60000, nodig: 0, dekking: 1.09 }, opgeslagen: false, ...extra,
});
// Antwoord van de chat-ingang: dezelfde vorm, maar zonder bedragen (het lid kiest zelf).
const startpuntAntwoord = (extra = {}) => ({
  ok: true, uitkomst: 'startpunt', melding: null, dekkingsdoel: 1.1,
  voorstel: { versie: 1, regels: [regel(1, ID1, { bedrag: null }), regel(2, ID2, { bedrag: null })], acties: [actie('a1', sl(ID1)), actie('a2', sl(ID2))] },
  reserveSleutel: null, onlineSuggesties: [], aanvullenMogelijk: false,
  totalen: { gat: 55000, doelBedrag: 60500, som: 0, nodig: 0, dekking: 0 }, opgeslagen: false, ...extra,
});

// ---------------------------------------------------------------------------------------------------------------------------
// Een nep-server met dezelfde AFSPRAKEN als de echte (de echte staat in tests/voorstel-genereren): de server onthoudt broncontroles per
// project+type+id, hergebruikt een geldige controle (ook na verversen), legt bij opslaan de bronstatus zelf vast en maakt taken nooit dubbel aan.
// Hier testen we de AANSLUITING van de browser; de serverregels zelf worden in de serversuites getest.
const fid = (sleutel) => { let h = 0; for (const c of String(sleutel)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return `${h.toString(16).padStart(8, '0')}-0000-4000-8000-0000000000f1`; };

function maakServer(o = {}) {
  const s = {
    log: [], checks: new Map(), fundings: new Map(), taken: new Map(), bezig: 0, maxTegelijk: 0, taakFalen: o.taakFalen || 0, opslaanFalen: o.opslaanFalen || 0,
    poort: {}, // id -> { belofte, los } : houdt een controle vast tot de test hem vrijgeeft
    uitkomst: o.uitkomst || {}, // id -> 'gecontroleerd' | 'onzeker' | 'mislukt' | 'netwerk' | 'crash'
    valideer: o.valideer || null,
    open: new Map(), // taken die de server bewaart voor opnieuw proberen (tabel subsidie_kompas_actieplan_open): overleeft verversen
    herstelFalen: o.herstelFalen || 0,
  };
  const gen = o.gen === undefined ? genereerAntwoord() : o.gen;
  const start = o.start === undefined ? startpuntAntwoord() : o.start;

  s.houdVast = (id) => { let los; const belofte = new Promise((r) => { los = r; }); s.poort[id] = { belofte, los }; };
  s.geefVrij = (id) => { if (s.poort[id]) s.poort[id].los(); };

  s.diensten = {
    genereer: async (a) => { s.log.push(['genereer', a]); return gen ? { ok: true, antwoord: gen } : { ok: false, reden: 'geen-begroting', melding: 'Vul eerst de projectbegroting in.' }; },
    aanvullen: async (a) => { s.log.push(['aanvullen', a]); return o.aanv ? { ok: true, antwoord: o.aanv } : { ok: false, reden: 'fout', melding: 'x' }; },
    startpunt: async (a) => { s.log.push(['startpunt', a]); return start ? { ok: true, antwoord: start } : { ok: false, reden: 'geen-financiers', melding: 'Geen van deze financiers kan worden voorbereid.' }; },
    controleer: async (a) => {
      s.log.push(['controleer', a]);
      s.bezig += 1; s.maxTegelijk = Math.max(s.maxTegelijk, s.bezig);

      try {
        if (s.poort[a.id]) await s.poort[a.id].belofte; else await sleep(5);
      } finally { s.bezig -= 1; }

      const uit = s.uitkomst[a.id] || 'gecontroleerd';

      if (uit === 'crash') throw new Error('boem');
      if (uit === 'netwerk') return { ok: false, reden: 'fout', melding: 'x', antwoord: null };

      const sleutel = `${a.type}:${a.id}`;
      const eerder = s.checks.get(sleutel);

      if (eerder && !a.opnieuw && eerder.status !== 'mislukt') {
        return { ok: true, antwoord: { ok: true, verificaties: [], controle: { sleutel: sl(a.id, a.type), status: eerder.status, verificatieStatus: null, reden: null, gecontroleerdOp: eerder.op, bewaard: true, hergebruikt: true } } };
      }

      const op = new Date().toISOString();

      if (uit !== 'mislukt') s.checks.set(sleutel, { status: uit, op });

      return { ok: true, antwoord: { ok: true, verificaties: [], controle: { sleutel: sl(a.id, a.type), status: uit, verificatieStatus: null, reden: uit === 'mislukt' ? 'ophalen_mislukt' : null, gecontroleerdOp: op, bewaard: uit !== 'mislukt', hergebruikt: false } } };
    },
    leesOpen: async (projectId) => { s.log.push(['leesOpen', projectId]); return { ok: true, aantal: s.open.size }; },
    herstelOpen: async (a) => {
      s.log.push(['herstelOpen', a]);

      if (s.herstelFalen > 0) { s.herstelFalen -= 1; return { ok: false, reden: 'fout', melding: 'x' }; }

      let aangemaakt = 0; let bestond = 0;

      for (const [tk, t] of s.open) {
        if (s.taken.has(tk)) bestond += 1; else { s.taken.set(tk, t); aangemaakt += 1; }
      }

      s.open.clear();

      return { ok: true, antwoord: { ok: true, actieplan: { status: aangemaakt + bestond ? 'klaar' : 'geen', aangemaakt, bestond, mislukt: 0 }, openstaand: 0 } };
    },
    opslaan: async (a) => {
      s.log.push(['opslaan', a]);

      if (s.opslaanFalen > 0) { s.opslaanFalen -= 1; return { ok: false, reden: 'fout', melding: 'Opslaan is niet gelukt (test).' }; }

      const v = s.valideer ? s.valideer(a) : null;

      if (v) return { ok: false, reden: 'validatie', melding: 'Er is niets opgeslagen.', regelFouten: v.regelFouten || null, algemeen: v.algemeen || null };

      const regels = [];
      let aangemaakt = 0; let bestond = 0; let mislukt = 0; let totaal = 0;

      for (const r of a.regels) {
        const sleutel = `${r.type}:${r.id}`;
        let status;

        if (a.alleenActies) {
          if (!s.fundings.has(sleutel)) continue;

          status = 'bestaat-al';
        } else if (s.fundings.has(sleutel)) status = 'bestaat-al';
        else { s.fundings.set(sleutel, { bedrag: r.bedrag }); status = 'opgeslagen'; }

        const c = s.checks.get(sleutel);

        regels.push({ sleutel: sl(r.id, r.type), naam: `Regeling ${r.id.slice(-1)}`, status, reden: null, fundingId: fid(sleutel), bron: c ? { status: c.status, gecontroleerdOp: c.op, beschikbaar: true } : { status: 'niet-gecontroleerd', gecontroleerdOp: null, beschikbaar: true } });

        const titel = `Taak voor ${r.id}`;
        const tk = `${sleutel}|${titel}`;

        if (a.uitgeslotenActies.includes(`a${r.id.slice(-1)}`)) continue;

        totaal += 1;

        if (s.taken.has(tk)) { bestond += 1; continue; }
        if (s.taakFalen > 0) { s.taakFalen -= 1; mislukt += 1; s.open.set(tk, { fundingId: sleutel, titel }); continue; }

        s.taken.set(tk, { fundingId: sleutel, titel });
        s.open.delete(tk);
        aangemaakt += 1;
      }

      // Online gevonden financiers: eigen financieringsrij (zonder bedrag) met drie beoordelingsstappen; dezelfde naam is nooit twee keer een rij.
      const suggesties = [];

      for (const g of (a.suggesties || [])) {
        const naam = (g.naam && g.naam !== g.gever ? `${g.gever} - ${g.naam}` : g.gever).slice(0, 200);
        const sk = `online:${naam}`;
        const bestaat = s.fundings.has(sk);

        if (!bestaat && a.alleenActies) continue;

        if (!bestaat) s.fundings.set(sk, { bedrag: null });

        suggesties.push({ naam, status: bestaat ? 'bestaat-al' : 'opgeslagen', reden: null, fundingId: fid(sk) });

        for (const stap of ['Beoordelen', 'Voorwaarden nagaan', 'Beslissen']) {
          const tk = `${sk}|${stap} ${naam}`;

          totaal += 1;

          if (s.taken.has(tk)) { bestond += 1; continue; }

          s.taken.set(tk, { fundingId: sk, titel: stap });
          aangemaakt += 1;
        }
      }

      const status = totaal === 0 ? 'geen' : mislukt === 0 ? 'klaar' : aangemaakt + bestond === 0 ? 'mislukt' : 'deels';

      return { ok: true, antwoord: { ok: true, opgeslagen: true, regels, actieplan: { status, aangemaakt, bestond, mislukt }, suggesties, dekkingsdoel: 1.1 } };
    },
  };

  return s;
}

const opslagCalls = (s) => s.log.filter(([n]) => n === 'opslaan').map(([, a]) => a);
const PROJECT_OK = { id: PID, naam: 'Project', omschrijving: 'Sportprogramma voor jongeren in Rotterdam-Zuid', doelstellingen: 'Meer jongeren laten sporten', regio: 'Rotterdam', doelgroep: 'Jongeren', begroting: 100000 };

// ===========================================================================================================================
sectie('1. Flow: project-ingang en chat-ingang, zonder preview en zonder opslaan');
{
  const s = maakServer();
  const stappen = [];
  const res = await W.draaiVoorstelFlow({ projectId: PID, diensten: s.diensten, onStap: (x) => stappen.push(x) });
  check('project-ingang ok', res.ok === true && res.genereer.uitkomst === 'voorstel');
  check('stappen: alleen onderzoeken (Pro: geen aanvullen)', stappen.join() === 'onderzoeken', stappen.join());
  check('er wordt NIET gecontroleerd binnen de flow (voorstel eerst, controles later)', !s.log.some(([n]) => n === 'controleer' || n === 'opslaan' || n === 'preview'));
  check('er is geen preview-dienst meer', !('preview' in s.diensten));

  // Chat-ingang
  const s2 = maakServer();
  const st2 = [];
  const r2 = await W.draaiVoorstelFlow({ projectId: PID, diensten: s2.diensten, onStap: (x) => st2.push(x), startpunt: { regels: [{ type: 'regeling', id: ID1 }, { type: 'regeling', id: ID2 }] } });
  check('chat-ingang: ok, uitkomst startpunt', r2.ok && r2.genereer.uitkomst === 'startpunt' && r2.aanvulling === null);
  check('chat-ingang: stap voorbereiden, geen genereren/aanvullen', st2.join() === 'voorbereiden' && s2.log.map(([n]) => n).join() === 'startpunt');
  check('chat-ingang stuurt alleen type + id', JSON.stringify(s2.log[0][1].regels) === JSON.stringify([{ type: 'regeling', id: ID1 }, { type: 'regeling', id: ID2 }]));
  const s3 = maakServer({ start: null });
  const r3 = await W.draaiVoorstelFlow({ projectId: PID, diensten: s3.diensten, startpunt: { regels: [{ type: 'regeling', id: ID1 }] } });
  check('chat-ingang: server weigert -> melding, niets verder', !r3.ok && /voorbereid/.test(r3.melding) && s3.log.length === 1);

  // Beide ingangen: hetzelfde werkmodel -> dezelfde regels, sleutels en weergave
  const mP = W.maakWerkModel(res);
  const mC = W.maakWerkModel(r2);
  check('beide ingangen: dezelfde sleutels en dezelfde regelstructuur', mP.regels.map((r) => r.sleutel).slice(0, 2).join() === mC.regels.map((r) => r.sleutel).join() && mP.regels[0].naam === mC.regels[0].naam);
  check('chat: geen bedragen, project: bedragen', mC.regels.every((r) => r.bedrag === null) && mP.regels[0].bedrag === 30000);

  // Premium: aanvullen
  const s4 = maakServer({ gen: genereerAntwoord({ aanvullenMogelijk: true }), aanv: { ok: true, uitkomst: 'aangevuld', onlineSuggesties: [{ gever: 'Online BV', naam: 'Fonds X', url: 'https://x.example/aanvragen' }] } });
  const st4 = [];
  const r4 = await W.draaiVoorstelFlow({ projectId: PID, diensten: s4.diensten, onStap: (x) => st4.push(x) });
  check('Premium: onderzoeken, aanvullen', st4.join() === 'onderzoeken,aanvullen');
  check('aanvullen krijgt het voorstel', s4.log.find(([n]) => n === 'aanvullen')[1].voorstel.regels.length === 3);
  const m4 = W.maakWerkModel(r4);
  check('suggestie uit aanvullen in model, https-url', m4.suggesties.length === 1 && m4.suggesties[0].url === 'https://x.example/aanvragen');
  const s5 = maakServer({ gen: genereerAntwoord({ aanvullenMogelijk: true }), aanv: null });
  const r5 = await W.draaiVoorstelFlow({ projectId: PID, diensten: s5.diensten });
  check('aanvullen mislukt: voorstel blijft bruikbaar', r5.ok && r5.aanvulling === null);
  const s6 = maakServer({ gen: null });
  const r6 = await W.draaiVoorstelFlow({ projectId: PID, diensten: s6.diensten });
  check('genereer mislukt: ok false met melding, niets verder', !r6.ok && /begroting/.test(r6.melding) && s6.log.length === 1);
  const s7 = maakServer({ gen: genereerAntwoord({ voorstel: null, uitkomst: 'geen-gat' }) });
  const r7 = await W.draaiVoorstelFlow({ projectId: PID, diensten: s7.diensten });
  check('al gedekt (geen voorstel): ok, geen aanvullen', r7.ok && r7.aanvulling === null && s7.log.length === 1);
}

{
  // Doorzoeken tot het doel gedekt is: maximaal 2 rondes, de server bepaalt of er een volgende ronde zin heeft.
  const s = maakServer({ gen: genereerAntwoord({ aanvullenMogelijk: true, onlineSuggesties: [{ gever: 'Eerste BV', indicatiefBedrag: 4000 }] }) });
  let n = 0;
  s.diensten.aanvullen = async (a) => { s.log.push(['aanvullen', a]); n += 1; return { ok: true, antwoord: { ok: true, uitkomst: 'aangevuld', nogAanvullen: true, onlineSuggesties: [{ gever: `Ronde ${n} BV`, indicatiefBedrag: 1000 * n }] } }; };
  const res = await W.draaiVoorstelFlow({ projectId: PID, diensten: s.diensten });
  const rondes = s.log.filter(([x]) => x === 'aanvullen');
  check('doorzoeken: hoogstens 2 rondes', rondes.length === 2, String(rondes.length));
  check('ronde 2 meldt wat in ronde 1 al getoond is', rondes[1][1].getoond.map((x) => x.gever).join() === 'Eerste BV,Ronde 1 BV');
  const mm = W.maakWerkModel(res);
  check('model: alle online suggesties, som van de schattingen (telt niet mee in dekking)', mm.suggesties.length === 3 && mm.onlineIndicatief === 7000 && mm.gat === 55000, `${mm.suggesties.length} ${mm.onlineIndicatief}`);
  const pro = W.maakWerkModel({ genereer: genereerAntwoord({ premiumHint: { aantal: 3 } }), aanvulling: null });
  check('Pro-hint is een getal', pro.premiumHint === 3);
  check('rare hint genegeerd', [{ aantal: '3' }, { aantal: -1 }, { aantal: 0 }, 'x', null].every((h) => W.maakWerkModel({ genereer: genereerAntwoord({ premiumHint: h }), aanvulling: null }).premiumHint === 0));
}

// ===========================================================================================================================
sectie('2. Werkmodel, totalen en de zichtbare buffer');
{
  const m = W.maakWerkModel(await W.draaiVoorstelFlow({ projectId: PID, diensten: maakServer().diensten }));
  const sel = W.beginSelectie(m);
  const bed = W.beginBedragen(m);
  check('reserve niet standaard geselecteerd', !sel.regels.has(sl(ID3)) && sel.regels.size === 2);
  check('bedragen met punten', bed[sl(ID1)] === '30.000');
  let t = W.berekenSelectieTotaal(m, sel, bed);
  check('totaal 60.000, dekking 109%', t.voorgesteld === 60000 && Math.round(t.dekking * 100) === 109);
  check('boven gat = buffertekst', t.bovenGat && /inclusief buffer voor afwijzingen/.test(W.dekkingTekst(t, m)));
  check('niet boven doel (60.500)', !t.bovenDoel);
  check('buffer expliciet: "Buffer voor afwijzingen: 10%" en tot 110%', /Buffer voor afwijzingen: 10%/.test(W.bufferUitleg(m)) && /110%/.test(W.bufferUitleg(m)), W.bufferUitleg(m));
  const premium = W.maakWerkModel({ genereer: genereerAntwoord({ dekkingsdoel: 1.2 }), aanvulling: null });
  check('Premium: 20% / 120%', /Buffer voor afwijzingen: 20%/.test(W.bufferUitleg(premium)) && /120%/.test(W.bufferUitleg(premium)));
  const geen = W.maakWerkModel({ genereer: genereerAntwoord({ dekkingsdoel: 1 }), aanvulling: null });
  check('geen buffer ingesteld: dat staat er ook, geen stilzwijgende buffer', /geen buffer/.test(W.bufferUitleg(geen)));
  const zonder = W.maakWerkModel({ genereer: genereerAntwoord({ dekkingsdoel: undefined }), aanvulling: null });
  check('server levert geen dekkingsdoel: client verzint er geen (factor 1)', zonder.dekkingsdoel === 1 && /geen buffer/.test(W.bufferUitleg(zonder)));
  t = W.berekenSelectieTotaal(m, sel, { ...bed, [sl(ID1)]: '45.000' });
  check('boven doel gesignaleerd', t.bovenDoel);
  t = W.berekenSelectieTotaal(m, sel, { ...bed, [sl(ID1)]: '4.000' });
  check('onder minimum: waarschuwing', t.fouten[sl(ID1)] === 'onder-minimum');
  t = W.berekenSelectieTotaal(m, sel, { ...bed, [sl(ID1)]: 'abc' });
  check('ongeldig bedrag', t.fouten[sl(ID1)] === 'ongeldig');
  check('onder het gat: geen bufferwoord', W.dekkingTekst({ dekking: 0.8, bovenGat: false }, m) === '80% van het financieringsgat');
  const mm = W.maakWerkModel({ genereer: genereerAntwoord({ voorstel: { versie: 1, regels: [regel(1, ID1, { deadline: { status: 'te-verifieren', datum: '2026-12-01' } })], acties: [] } }), aanvulling: null });
  check('deadline zonder status geverifieerd -> null', mm.regels[0].deadline === null);
  const staatAl = W.maakWerkModel({ genereer: genereerAntwoord({ voorstel: { versie: 1, regels: [regel(1, ID1, { staatAl: true })], acties: [] } }), aanvulling: null });
  check('staatAl niet selecteerbaar, niet gecontroleerd', !staatAl.regels[0].selecteerbaar && W.beginSelectie(staatAl).regels.size === 0 && W.teControleren(staatAl).length === 0);
  const dub = W.maakWerkModel({ genereer: genereerAntwoord({ onlineSuggesties: [{ gever: 'A' }, { gever: 'a' }, { gever: 'B', url: 'http://onveilig' }] }), aanvulling: null });
  check('suggesties ontdubbeld, http-bron genegeerd', dub.suggesties.length === 2 && dub.suggesties[1].url === null);
  const docs = W.maakWerkModel({ genereer: genereerAntwoord({ werkwijze: { documenten: 2 } }), aanvulling: null });
  check('aantal meegenomen documenten in model', docs.documenten === 2 && m.documenten === 0);
  const chat = W.maakWerkModel({ genereer: startpuntAntwoord(), aanvulling: null });
  const sc = W.beginSelectieChat(chat);
  check('chat-selectie: alles wat nog niet in het plan staat staat aan, zonder bedrag', sc.regels.size === 2 && W.beginBedragen(chat)[sl(ID1)] === '');
  const tc = W.berekenSelectieTotaal(chat, sc, W.beginBedragen(chat));
  check('chat zonder bedragen: voorgesteld 0, geen fouten', tc.voorgesteld === 0 && Object.keys(tc.fouten).length === 0);
}

// ===========================================================================================================================
sectie('3. Broncontrole: aparte aanroepen, statussen, mislukken, annuleren');
{
  const m = W.maakWerkModel(await W.draaiVoorstelFlow({ projectId: PID, diensten: maakServer().diensten }));
  const r1 = m.regels[0];
  const begin = W.beginControles(m);
  check('begin: alle te controleren regels staan op Controleren…', Object.keys(begin).length === 3 && Object.values(begin).every((c) => c.bron.status === 'controleren' && c.bron.label === 'Controleren…'));

  const s = maakServer({ uitkomst: { [ID2]: 'onzeker' } });
  const a = await W.controleerRegel({ projectId: PID, regel: r1, diensten: s.diensten });
  check('gecontroleerd -> label Gecontroleerd, datum erbij', a.bron.status === 'gecontroleerd' && a.bron.label === 'Gecontroleerd' && !!a.bron.gecontroleerdOp && a.bron.hergebruikt === false);
  check('controleer-aanroep: type, id, opnieuw=false; geen bedrag/naam/status', JSON.stringify(s.log[0][1]) === JSON.stringify({ projectId: PID, type: 'regeling', id: ID1, opnieuw: false }));
  const b = await W.controleerRegel({ projectId: PID, regel: m.regels[1], diensten: s.diensten });
  check('onzeker blijft onzeker', b.bron.status === 'onzeker' && b.bron.label === 'Onzeker');
  const s2 = maakServer({ uitkomst: { [ID1]: 'mislukt', [ID2]: 'netwerk', [ID3]: 'crash' } });
  const c1 = await W.controleerRegel({ projectId: PID, regel: m.regels[0], diensten: s2.diensten });
  const c2 = await W.controleerRegel({ projectId: PID, regel: m.regels[1], diensten: s2.diensten });
  const c3 = await W.controleerRegel({ projectId: PID, regel: m.regels[2], diensten: s2.diensten });
  check('server zegt mislukt / netwerkfout / uitzondering -> "Controle mislukt", nooit een throw', [c1, c2, c3].every((x) => x.bron.status === 'mislukt' && x.bron.label === 'Controle mislukt'));
  const s3 = maakServer();
  s3.diensten.controleer = async () => ({ ok: true, antwoord: { ok: true, controle: { sleutel: sl(ID3), status: 'gecontroleerd', gecontroleerdOp: new Date().toISOString() } } });
  const x = await W.controleerRegel({ projectId: PID, regel: m.regels[0], diensten: s3.diensten });
  check('antwoord over een ANDERE regel telt nooit als gecontroleerd', x.bron.status === 'mislukt');
  s3.diensten.controleer = async () => ({ ok: true, antwoord: { ok: true, controle: { sleutel: sl(ID1), status: 'toegekend' } } });
  const y = await W.controleerRegel({ projectId: PID, regel: m.regels[0], diensten: s3.diensten });
  check('onbekende status wordt nooit opgewaardeerd', y.bron.status === 'niet_gecontroleerd' && y.bron.label === 'Niet gecontroleerd');
  const o = await W.controleerRegel({ projectId: PID, regel: m.regels[0], diensten: s.diensten, opnieuw: true });
  check('opnieuw=true gaat mee naar de server', s.log[s.log.length - 1][1].opnieuw === true && o.bron.status === 'gecontroleerd');
  const h = await W.controleerRegel({ projectId: PID, regel: m.regels[0], diensten: s.diensten });
  check('tweede keer zonder opnieuw: server hergebruikt, client toont dat', h.bron.hergebruikt === true);
}
{
  // Gelijktijdigheid, één mislukking blokkeert de rest niet, annuleren
  const m = W.maakWerkModel({ genereer: genereerAntwoord({ voorstel: { versie: 1, regels: [1, 2, 3, 4, 5].map((n) => regel(n, `a0000000-0000-4000-8000-00000000010${n}`)), acties: [] } }), aanvulling: null });
  const s = maakServer({ uitkomst: { 'a0000000-0000-4000-8000-000000000102': 'crash', 'a0000000-0000-4000-8000-000000000103': 'netwerk' } });
  const upd = {};
  await W.draaiBronControles({ projectId: PID, regels: W.teControleren(m), diensten: s.diensten, onUpdate: (k, v) => { upd[k] = v.bron.status; } });
  check('alle 5 regels kregen een uitkomst', Object.keys(upd).length === 5);
  check('2 mislukt, 3 gecontroleerd: een mislukking blokkeert de rest niet', Object.values(upd).filter((x) => x === 'mislukt').length === 2 && Object.values(upd).filter((x) => x === 'gecontroleerd').length === 3, JSON.stringify(upd));
  check(`hoogstens ${W.GELIJKTIJDIGE_CONTROLES} tegelijk`, s.maxTegelijk <= W.GELIJKTIJDIGE_CONTROLES && s.maxTegelijk >= 2, String(s.maxTegelijk));

  const s2 = maakServer();
  let stop = false; const upd2 = [];
  await W.draaiBronControles({ projectId: PID, regels: W.teControleren(m), diensten: s2.diensten, geannuleerd: () => stop, onUpdate: (k) => { upd2.push(k); stop = true; } });
  check('annuleren: geen nieuwe controles gestart en geen late updates', s2.log.filter(([n]) => n === 'controleer').length <= W.GELIJKTIJDIGE_CONTROLES && upd2.length <= 1, `${s2.log.length} ${upd2.length}`);
  const s3 = maakServer();
  await W.draaiBronControles({ projectId: PID, regels: [], diensten: s3.diensten, onUpdate: () => { throw new Error('mag niet'); } });
  check('geen regels: klaar zonder aanroepen', s3.log.length === 0);
  const s4 = maakServer();
  await W.draaiBronControles({ projectId: PID, regels: W.teControleren(m).slice(0, 2), diensten: s4.diensten, opnieuw: true, onUpdate: () => {} });
  check('opnieuw wordt doorgegeven aan elke controle', s4.log.every(([, a]) => a.opnieuw === true));
}
{
  // De weergave per regel toont de BRONSTATUS in de kop, los van de financieringsstatus
  const m = W.maakWerkModel({ genereer: genereerAntwoord(), aanvulling: null });
  const w = W.bouwRegelWeergaven(m, { [sl(ID1)]: { bron: B.bronModel({ status: 'gecontroleerd', gecontroleerdOp: new Date().toISOString() }), antwoord: null }, [sl(ID2)]: { bron: B.BRON_CONTROLEREN, antwoord: null } });
  const k1 = w.find((r) => r.sleutel === sl(ID1)); const k2 = w.find((r) => r.sleutel === sl(ID2)); const k3 = w.find((r) => r.sleutel === sl(ID3));
  check('kop toont bronstatus: Gecontroleerd / Controleren… / geen', k1.kop.status.label === 'Gecontroleerd' && k2.kop.status.label === 'Controleren…' && k3.kop.status === null);
  check('"Gecontroleerd" staat nooit voor toekenning: label noemt geen toegekend/akkoord', !/toegekend|goedgekeurd|akkoord/i.test(JSON.stringify(k1.kop)) && /geen kans|niets over de kans/i.test(B.BRON_UITLEG.gecontroleerd));
  check('bron-uitleg per status aanwezig', ['controleren', 'gecontroleerd', 'onzeker', 'mislukt', 'niet_gecontroleerd'].every((k) => B.BRON_UITLEG[k] && B.BRON_LABEL[k]));
}

// ===========================================================================================================================
sectie('4. Opslagverzoek, validatie en actieplan opnieuw');
{
  const m = W.maakWerkModel(await W.draaiVoorstelFlow({ projectId: PID, diensten: maakServer().diensten }));
  const sel = W.beginSelectie(m);
  sel.regels.delete(sl(ID2));
  sel.acties.delete('a1');
  const v = W.bouwOpslagVerzoek(m, sel, { ...W.beginBedragen(m), [sl(ID1)]: '25.000' });
  check('verzoek: één regel, alleen type/id/bedrag', JSON.stringify(v.regels) === JSON.stringify([{ type: 'regeling', id: ID1, bedrag: 25000 }]));
  check('afgevinkte taak gaat als sleutel mee, de rest bepaalt de server', v.uitgeslotenActies.join() === 'a1');
  check('geen naam, deadline, bronstatus of taken in het verzoek', !/naam|deadline|bron|status|titel/i.test(JSON.stringify(v.regels)));
  const v2 = W.bouwOpslagVerzoek(m, sel, { ...W.beginBedragen(m), [sl(ID1)]: 'abc' });
  check('ongeldig bedrag: niet in verzoek, wel gemeld', v2.ongeldig.join() === sl(ID1) && v2.regels.length === 0);

  const s = maakServer();
  const uit = await W.voerOpslagUit({ projectId: PID, verzoek: v, diensten: s.diensten });
  check('opslaan ok: regel opgeslagen; de afgevinkte taak is niet aangemaakt (actieplan "geen")', uit.ok && uit.regels[0].status === 'opgeslagen' && uit.actieplan.status === 'geen' && s.taken.size === 0);
  check('bronstatus uit server in de uitkomst: niet gecontroleerd als er niets gecontroleerd is', uit.regels[0].bron.status === 'niet_gecontroleerd');
  s.checks.set(`regeling:${ID2}`, { status: 'onzeker', op: new Date().toISOString() });
  const sel2 = W.beginSelectie(m);
  const u2 = await W.voerOpslagUit({ projectId: PID, verzoek: W.bouwOpslagVerzoek(m, sel2, W.beginBedragen(m)), diensten: s.diensten });
  check('regel met onzekere bron blijft onzeker herkenbaar, bestaande regel = bestaat-al', u2.regels.find((r) => r.sleutel === sl(ID2)).bron.status === 'onzeker' && u2.regels.find((r) => r.sleutel === sl(ID1)).status === 'bestaat-al');
  check('financieringsstatus en bronstatus zijn aparte velden', u2.regels.every((r) => ['opgeslagen', 'bestaat-al', 'mislukt'].includes(r.status) && ['gecontroleerd', 'onzeker', 'mislukt', 'niet_gecontroleerd'].includes(r.bron.status)));

  // Validatie: niets opgeslagen, fouten per regel
  const s3 = maakServer({ valideer: () => ({ regelFouten: { [sl(ID1)]: { code: 'boven-maximum', melding: 'Dit bedrag is hoger dan het maximum van de financier.' } } }) });
  const vv = await W.voerOpslagUit({ projectId: PID, verzoek: v, diensten: s3.diensten });
  check('validatiefout: ok false, soort validatie, fout bij de juiste regel', !vv.ok && vv.soort === 'validatie' && vv.regelFouten[sl(ID1)].code === 'boven-maximum' && /maximum/.test(vv.regelFouten[sl(ID1)].melding));
  const s4 = maakServer({ valideer: () => ({ algemeen: { code: 'boven-financieringsgat', melding: 'Het totaal komt boven het toegestane doel.' } }) });
  const va = await W.voerOpslagUit({ projectId: PID, verzoek: v, diensten: s4.diensten });
  check('algemene validatiefout (boven doel)', !va.ok && va.soort === 'validatie' && va.algemeen.code === 'boven-financieringsgat');
  const s5 = maakServer({ opslaanFalen: 1 });
  const vf = await W.voerOpslagUit({ projectId: PID, verzoek: v, diensten: s5.diensten });
  check('technische fout: soort fout met melding', !vf.ok && vf.soort === 'fout' && /niet gelukt/.test(vf.melding));
  s5.diensten.opslaan = async () => { throw new Error('netwerk'); };
  const vt = await W.voerOpslagUit({ projectId: PID, verzoek: v, diensten: s5.diensten });
  check('uitzondering wordt een nette fout', !vt.ok && vt.soort === 'fout' && /niets dubbel/.test(vt.melding));
}
{
  // Actieplan opnieuw: dekkingsplan blijft, alleen taken, geen dubbele
  const m = W.maakWerkModel(await W.draaiVoorstelFlow({ projectId: PID, diensten: maakServer().diensten }));
  const sel = W.beginSelectie(m);
  const v = W.bouwOpslagVerzoek(m, sel, W.beginBedragen(m));
  const s = maakServer({ taakFalen: 1 });
  const uit = await W.voerOpslagUit({ projectId: PID, verzoek: v, diensten: s.diensten });
  check('deels mislukte taakgeneratie: regels opgeslagen, actieplan "deels"', uit.ok && uit.regels.every((r) => r.status === 'opgeslagen') && uit.actieplan.status === 'deels' && uit.actieplan.aangemaakt === 1 && uit.actieplan.mislukt === 1);
  const fundingsVoor = s.fundings.size;
  const h = await W.herstelActieplan({ projectId: PID, model: m, uitkomst: uit, verzoek: v, diensten: s.diensten });
  const calls = opslagCalls(s);
  const laatste = calls[calls.length - 1];
  check('herstel: alleenActies, regels zonder bedrag, alleen regels uit het plan', laatste.alleenActies === true && laatste.regels.every((r) => r.bedrag === null) && laatste.regels.length === 2 && laatste.suggesties.length === 0);
  check('herstel: dekkingsplan ongewijzigd, taken nu compleet en niet dubbel', h.ok && s.fundings.size === fundingsVoor && s.taken.size === 2 && h.actieplan.mislukt === 0);
  check('herstel: 1 nu aangemaakt, 1 bestond al (niet dubbel geteld: samen 2 taken)', h.actieplan.aangemaakt === 1 && h.actieplan.bestond === 1 && h.actieplan.aangemaakt + h.actieplan.bestond === s.taken.size, JSON.stringify(h.actieplan));
  const h2 = await W.herstelActieplan({ projectId: PID, model: m, uitkomst: uit, verzoek: v, diensten: s.diensten });
  check('nog eens herstellen: geen nieuwe taken', h2.ok && s.taken.size === 2);
  // Alles faalt
  const s2 = maakServer({ taakFalen: 99 });
  const u2 = await W.voerOpslagUit({ projectId: PID, verzoek: v, diensten: s2.diensten });
  check('alle taken mislukt: actieplan "mislukt", dekkingsplan staat', u2.actieplan.status === 'mislukt' && s2.fundings.size === 2 && s2.taken.size === 0);
  s2.diensten.opslaan = async () => ({ ok: false, reden: 'fout', melding: 'x' });
  const h3 = await W.herstelActieplan({ projectId: PID, model: m, uitkomst: u2, verzoek: v, diensten: s2.diensten });
  check('herstel mislukt: duidelijke melding dat het dekkingsplan veilig is', !h3.ok && /dekkingsplan is opgeslagen en ongewijzigd/.test(h3.melding));
  // Regels die niet zijn opgeslagen worden niet meegestuurd
  const s3 = maakServer();
  const mislukt = { ...u2, regels: u2.regels.map((r, i) => (i === 0 ? { ...r, status: 'mislukt' } : r)) };
  await W.herstelActieplan({ projectId: PID, model: m, uitkomst: mislukt, verzoek: v, diensten: s3.diensten });
  check('herstel stuurt geen regels die niet in het plan staan', opslagCalls(s3)[0].regels.length === 1);
}

// ===========================================================================================================================
sectie('5. Service: bodies en foutlezing');
{
  client.__reset();
  const inv = [];
  client.__zetSupabase({ functions: { invoke: async (naam, o) => { inv.push([naam, o.body]); return { data: { ok: true }, error: null }; } } });
  await S.vraagVoorstelStartpunt({ projectId: PID, regels: [{ type: 'regeling', id: ID1, naam: 'geheim', bedrag: 5 }, { type: 'fonds', id: ID2 }, { type: 'iets', id: ID3 }, { type: 'regeling' }] });
  check('startpunt: mode, alleen type + id, ongeldige weggelaten', inv[0][1].mode === 'voorstel-startpunt' && JSON.stringify(inv[0][1].regels) === JSON.stringify([{ type: 'regeling', id: ID1 }, { type: 'fonds', id: ID2 }]), JSON.stringify(inv[0][1]));
  check('startpunt zonder geldige regels: fout, geen call', !(await S.vraagVoorstelStartpunt({ projectId: PID, regels: [] })).ok && inv.length === 1);
  await S.vraagBronControle({ projectId: PID, type: 'regeling', id: ID1 });
  await S.vraagBronControle({ projectId: PID, type: 'fonds', id: ID2, opnieuw: true });
  check('controleer: mode, type, id; opnieuw alleen als true', inv[1][1].mode === 'voorstel-controleer' && !('opnieuw' in inv[1][1]) && inv[2][1].opnieuw === true && inv[2][1].type === 'fonds');
  check('controleer met ongeldig type: fout, geen call', !(await S.vraagBronControle({ projectId: PID, type: 'x', id: ID1 })).ok && inv.length === 3);
  await S.vraagVoorstelOpslaan({ projectId: PID, regels: [{ type: 'regeling', id: ID1, bedrag: 100, naam: 'x', deadline: '2026-01-01', status: 'gecontroleerd', bron: 'gecontroleerd' }], uitgeslotenActies: ['a1', 5], alleenActies: true });
  const ob = inv[3][1];
  check('opslaan: alleen type/id/bedrag per regel; geen bronstatus/naam/deadline uit de browser', ob.mode === 'voorstel-opslaan' && JSON.stringify(ob.regels) === JSON.stringify([{ type: 'regeling', id: ID1, bedrag: 100 }]), JSON.stringify(ob.regels));
  check('opslaan: alleenActies en uitgeslotenActies (alleen tekst) gaan mee', ob.alleenActies === true && JSON.stringify(ob.uitgeslotenActies) === '["a1"]');
  await S.vraagVoorstelOpslaan({ projectId: PID, regels: [] });
  check('opslaan zonder alleenActies: veld ontbreekt', !('alleenActies' in inv[4][1]));
  client.__zetSupabase({ functions: { invoke: async () => ({ data: null, error: { context: new Response(JSON.stringify({ reden: 'validatie', regelFouten: { [sl(ID1)]: { code: 'boven-maximum', melding: 'Te hoog.' } }, algemeen: { code: 'boven-financieringsgat', melding: 'Te veel.' } }), { status: 422 }) } }) } });
  const e = await S.vraagVoorstelOpslaan({ projectId: PID, regels: [{ type: 'regeling', id: ID1, bedrag: 1 }] });
  check('422: regelFouten en algemeen worden doorgegeven', !e.ok && e.regelFouten[sl(ID1)].code === 'boven-maximum' && e.algemeen.code === 'boven-financieringsgat' && e.status === 422);
  client.__zetSupabase({ functions: { invoke: async () => ({ data: null, error: { context: new Response(JSON.stringify({ reden: 'geen-begroting' }), { status: 422 }) } }) } });
  const c = await S.vraagVoorstelGenereren({ projectId: PID });
  check('422 geen-begroting: nette melding', !c.ok && c.reden === 'geen-begroting' && /begroting/.test(c.melding));
  client.__zetSupabase({ functions: { invoke: async () => { throw new Error('netwerk'); } } });
  check('netwerkfout: ok false', !(await S.vraagBronControle({ projectId: PID, type: 'regeling', id: ID1 })).ok);
  client.__zetSupabase({ from: () => ({ select: () => ({ eq: () => ({ limit: async () => ({ data: [{ record_type: 'regeling', record_id: ID1, status: 'gecontroleerd', gecontroleerd_op: '2026-10-01T10:00:00Z' }], error: null }) }) }) }) });
  const lb = await S.leesBronControles(PID);
  check('leesBronControles: rijen uit de tabel (RLS), alleen lezen', lb.ok && lb.rijen.length === 1);
  client.__zetSupabase({ from: () => ({ select: () => ({ eq: () => ({ limit: async () => ({ data: null, error: { code: '42P01' } }) }) }) }) });
  const lf = await S.leesBronControles(PID);
  check('tabel ontbreekt: ok false, lege lijst (alles "niet gecontroleerd")', !lf.ok && lf.rijen.length === 0);
}

// ===========================================================================================================================
sectie('6. bronVoorRegel: de status in het dekkingsplan na opslaan en verversen');
{
  const nu = new Date('2026-10-15T12:00:00Z');
  const dbRegel = { bronStatus: 'zichtbaar', bronType: 'regeling', schemeId: ID1, funderId: null, notitie: '' };
  const dbFonds = { bronStatus: 'zichtbaar', bronType: 'fonds', schemeId: null, funderId: ID2, notitie: '' };
  const rij = (type, id, status, op) => ({ record_type: type, record_id: id, status, reden: null, gecontroleerd_op: op });
  const vers = '2026-10-10T10:00:00Z';
  check('gecontroleerde rij -> Gecontroleerd', B.bronVoorRegel(dbRegel, [rij('regeling', ID1, 'gecontroleerd', vers)], nu).label === 'Gecontroleerd');
  check('onzeker -> Onzeker', B.bronVoorRegel(dbRegel, [rij('regeling', ID1, 'onzeker', vers)], nu).status === 'onzeker');
  check('mislukt -> Controle mislukt', B.bronVoorRegel(dbRegel, [rij('regeling', ID1, 'mislukt', vers)], nu).label === 'Controle mislukt');
  check('server zette verouderd -> niet opgewaardeerd (Niet gecontroleerd, verouderd-vlag)', (() => { const x = B.bronVoorRegel(dbRegel, [rij('regeling', ID1, 'verouderd', vers)], nu); return x.status === 'niet_gecontroleerd' && x.verouderd === true; })());
  check('ouder dan 14 dagen -> verouderd, ook als de rij nog "gecontroleerd" zegt', (() => { const x = B.bronVoorRegel(dbRegel, [rij('regeling', ID1, 'gecontroleerd', '2026-09-20T10:00:00Z')], nu); return x.status === 'niet_gecontroleerd' && x.verouderd === true; })());
  check('geen rij -> Niet gecontroleerd', B.bronVoorRegel(dbRegel, [], nu).status === 'niet_gecontroleerd');
  check('rij van een ander record of ander type telt niet', B.bronVoorRegel(dbRegel, [rij('fonds', ID1, 'gecontroleerd', vers), rij('regeling', ID2, 'gecontroleerd', vers)], nu).status === 'niet_gecontroleerd');
  check('fonds via funderId; hoofdletters in id maken niet uit', B.bronVoorRegel(dbFonds, [rij('fonds', ID2.toUpperCase(), 'gecontroleerd', vers)], nu).status === 'gecontroleerd');
  check('rijen kapot (null) -> niet gecontroleerd, geen throw', B.bronVoorRegel(dbRegel, null, nu).status === 'niet_gecontroleerd');
  const online = B.bronVoorRegel({ bronStatus: 'handmatig', bronType: 'financier', notitie: 'Online gevonden door Subsidiekompas; nog niet gecontroleerd.' }, [], nu);
  check('online gevonden financier: nooit gecontroleerd', online.status === 'niet_gecontroleerd' && /Online gevonden/.test(online.label));
  check('eigen handmatige regel: geen bronstatus', B.bronVoorRegel({ bronStatus: 'handmatig', bronType: 'financier', notitie: 'eigen' }, [], nu) === null && B.bronVoorRegel(null, [], nu) === null);
  check('bronstatus bevat nooit een financieringsstatus', !/toegekend|aangevraagd|interessant/i.test(JSON.stringify(Object.values(B.BRON_LABEL))));
  check('moet gelijk zijn aan de server: 14 dagen', B.BRON_MAX_LEEFTIJD_DAGEN === 14 && /BRON_MAX_LEEFTIJD_DAGEN = 14/.test(readFileSync(join(ROOT, 'supabase/functions/_shared/bronControle.ts'), 'utf8')));
}

// ===========================================================================================================================
// Component
const wortel = createRoot(document.getElementById('root'));
const q = (sel) => document.querySelector(sel);
const qa = (sel) => [...document.querySelectorAll(sel)];
const rust = (ms = 40) => act(async () => { await sleep(ms); });
async function toon(el) { await act(async () => { wortel.render(el); }); }
async function weg() { await act(async () => { wortel.render(null); }); }
async function klik(el) { await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); await sleep(20); }); }
async function typ(el, waarde) {
  await act(async () => {
    const set = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
    set.call(el, waarde);
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
}
const werkruimte = (s, extra = {}) => <VoorstelWerkruimte project={PROJECT_OK} beschikbaar opgeslagen diensten={s.diensten} {...extra} />;
const kopStatus = (n) => qa('[data-testid="voorstel-rij"]')[n].querySelector('[data-testid="financieringsregel-status"]');
const statussen = () => qa('[data-testid="voorstel-rij"]').map((r) => { const x = r.querySelector('[data-testid="financieringsregel-status"]'); return x ? x.dataset.status : '-'; });
const console_errors = [];
const origError = console.error;
console.error = (...a) => { console_errors.push(a.map(String).join(' ')); };

sectie('7. Project-ingang in het scherm: voorstel eerst, dan Controleren… per regel');
{
  const s = maakServer();
  s.houdVast(ID1); s.houdVast(ID2);
  await toon(werkruimte(s));
  check('start: niets aangeroepen (alleen het lezen van open taken van een eerdere keer)', s.log.filter(([n]) => n !== 'leesOpen').length === 0 && q('[data-testid="voorstel-werkruimte"]').dataset.ingang === 'project');
  await klik(q('[data-testid="voorstel-start-knop"]'));
  await rust();
  check('voorstel direct zichtbaar, vóór de broncontrole klaar is', !!q('[data-testid="voorstel-resultaat"]') && q('[data-testid="voorstel-resultaat"]').dataset.controles === 'bezig');
  check('"nog niets opgeslagen" zichtbaar', !!q('[data-testid="voorstel-niet-opgeslagen"]'));
  check('3 rijen: eerste twee en reserve zonder bedrag', qa('[data-testid="voorstel-rij"]').length === 3);
  check('kopstatus Controleren… bij de regels die worden gecontroleerd', statussen()[0] === 'controleren' && statussen()[1] === 'controleren', statussen().join());
  check('banner: bronnen worden gecontroleerd, u kunt verder', !!q('[data-testid="voorstel-controles-bezig"]'));
  check('geen preview-, opslaan- of schrijfaanroep tot nu', !s.log.some(([n]) => n === 'opslaan' || n === 'preview'));
  check('buffer expliciet zichtbaar bij de totalen', /Buffer voor afwijzingen: 10%/.test(q('[data-testid="voorstel-buffer"]').textContent));
  check('dekkingstekst met buffer', /109%.*inclusief buffer voor afwijzingen/.test(q('[data-testid="voorstel-dekking"]').textContent));
  // Een regel is klaar, de ander nog niet
  s.geefVrij(ID1);
  await rust();
  check('regel 1 klaar (Gecontroleerd), regel 2 nog Controleren…', statussen()[0] === 'gecontroleerd' && statussen()[1] === 'controleren', statussen().join());
  check('de reserve (zonder bedrag) wordt ook gecontroleerd', ['gecontroleerd', 'controleren'].includes(statussen()[2]));
  s.geefVrij(ID2);
  await rust(80);
  check('alles klaar: Gecontroleerd, banner weg, uitleg dat gecontroleerd niet "toegekend" is', statussen().every((x) => x === 'gecontroleerd') && q('[data-testid="voorstel-resultaat"]').dataset.controles === 'klaar' && /niet dat de financiering is toegekend/.test(q('[data-testid="voorstel-controles-klaar"]').textContent));
  check('elke regel is exact één keer gecontroleerd', s.log.filter(([n]) => n === 'controleer').length === 3);
  // Details van regel 1: bronblok met uitleg en "Opnieuw controleren"
  await klik(qa('[data-testid="voorstel-regel-kop"]')[0]);
  check('details: bronblok met label en uitleg', q('[data-testid="bron-status"]').dataset.status === 'gecontroleerd' && /geen kans|kans op toekenning/.test(q('[data-testid="bron-uitleg"]').textContent));
  await klik(q('[data-testid="bron-opnieuw"]'));
  await rust(40);
  const laatste = s.log.filter(([n]) => n === 'controleer').pop()[1];
  check('opnieuw controleren: nieuwe aanroep met opnieuw=true voor déze regel', laatste.opnieuw === true && laatste.id === ID1);
}
{
  // Mislukte en onzekere controles blijven herkenbaar; opnieuw proberen herstelt
  const s = maakServer({ uitkomst: { [ID1]: 'mislukt', [ID2]: 'onzeker' } });
  await toon(werkruimte(s));
  await klik(q('[data-testid="voorstel-start-knop"]'));
  await rust(80);
  check('mislukt en onzeker zichtbaar naast elkaar', statussen()[0] === 'mislukt' && statussen()[1] === 'onzeker' && statussen()[2] === 'gecontroleerd', statussen().join());
  check('opslaan blijft mogelijk met mislukte controle', !q('[data-testid="voorstel-opslaan"]').disabled);
  await klik(qa('[data-testid="voorstel-regel-kop"]')[0]);
  check('mislukt: knop "Opnieuw proberen"', /Opnieuw proberen/.test(q('[data-testid="bron-opnieuw"]').textContent));
  s.uitkomst[ID1] = 'gecontroleerd';
  await klik(q('[data-testid="bron-opnieuw"]'));
  await rust(60);
  check('opnieuw proberen lukt: regel 1 Gecontroleerd, rest ongewijzigd', statussen()[0] === 'gecontroleerd' && statussen()[1] === 'onzeker');
}

sectie('8. Opslaan: gewijzigde bedragen, servervalidatie per regel, dubbele klik');
{
  const s = maakServer({ valideer: (a) => (a.regels.some((r) => r.bedrag === 99000) ? { regelFouten: { [sl(ID1)]: { code: 'boven-maximum', melding: 'Dit bedrag is hoger dan het maximum van de financier.' } }, algemeen: { code: 'boven-financieringsgat', melding: 'Het totaal komt boven het toegestane doel.' } } : null) });
  let opgeslagenAantal = 0;
  await toon(werkruimte(s, { onOpgeslagen: () => { opgeslagenAantal += 1; } }));
  await klik(q('[data-testid="voorstel-start-knop"]'));
  await rust(80);
  // Bedrag aanpassen en een regel afvinken
  await klik(qa('[data-testid="voorstel-kies"]')[1]);
  check('afgevinkt: som 30.000', /30\.000/.test(q('[data-testid="voorstel-som"]').textContent));
  await typ(qa('[data-testid="voorstel-bedrag"]')[0], 'abc');
  check('ongeldig bedrag: opslaan uit', q('[data-testid="voorstel-opslaan"]').disabled);
  await typ(qa('[data-testid="voorstel-bedrag"]')[0], '99.000');
  check('boven de grens: waarschuwing, opslaan kan (server beslist)', !!q('[data-testid="voorstel-grens-waarschuwing"]') && !q('[data-testid="voorstel-opslaan"]').disabled);
  await klik(q('[data-testid="voorstel-opslaan"]'));
  await rust();
  check('server weigert: niets opgeslagen', s.fundings.size === 0 && s.taken.size === 0 && opgeslagenAantal === 0);
  check('fout staat bij de juiste regel', qa('[data-testid="voorstel-regel-fout"]').length === 1 && qa('[data-testid="voorstel-rij"]')[0].querySelector('[data-testid="voorstel-regel-fout"]') && /maximum/.test(q('[data-testid="voorstel-regel-fout"]').textContent));
  check('algemene fout zichtbaar met "uw invoer is behouden"', /toegestane doel/.test(q('[data-testid="voorstel-opslaan-algemeen"]').textContent) && /invoer is behouden/.test(q('[data-testid="voorstel-opslaan-algemeen"]').textContent));
  check('invoer behouden: bedrag en afvinking staan nog', qa('[data-testid="voorstel-bedrag"]')[0].value === '99.000' && qa('[data-testid="voorstel-kies"]')[1].checked === false);
  check('bronstatussen blijven staan na weigering', statussen().every((x) => x === 'gecontroleerd'));
  // Aangepast bedrag
  await typ(qa('[data-testid="voorstel-bedrag"]')[0], '25.000');
  const zelfdeTijd = [];
  // Dubbele klik: twee klikken direct na elkaar
  await act(async () => {
    const k = q('[data-testid="voorstel-opslaan"]');
    k.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    k.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await sleep(60);
  });
  const calls = opslagCalls(s);
  check('dubbelklik: slechts één geslaagde opslag-aanroep erbij (1 weigering + 1 opslag)', calls.length === 2, String(calls.length));
  check('opgeslagen met het AANGEPASTE bedrag (25000), alleen type/id/bedrag', JSON.stringify(calls[1].regels) === JSON.stringify([{ type: 'regeling', id: ID1, bedrag: 25000 }]) && s.fundings.get(`regeling:${ID1}`).bedrag === 25000);
  check('afgevinkte regel niet opgeslagen; zijn taak niet meegestuurd als taak', s.fundings.size === 1 && s.taken.size === 1);
  check('samenvatting zichtbaar met bronstatus per regel, los van de financieringsstatus (Interessant)', !!q('[data-testid="voorstel-opgeslagen"]') && /Interessant/.test(q('[data-testid="voorstel-opgeslagen-uitleg"]').textContent) && q('[data-testid="samenvatting-bron"]').dataset.status === 'gecontroleerd');
  check('actieplan klaar met aantal taken', q('[data-testid="voorstel-actieplan"]').dataset.status === 'klaar' && /1 taak/.test(q('[data-testid="voorstel-actieplan"]').textContent));
  check('onOpgeslagen precies één keer', opgeslagenAantal === 1);
  check('geen knop "Actieplan opnieuw" als alles klopt', !q('[data-testid="actieplan-opnieuw"]'));
  await klik(q('[data-testid="voorstel-sluiten"]'));
  check('sluiten: terug naar start', !q('[data-testid="voorstel-opgeslagen"]') && !q('[data-testid="voorstel-resultaat"]'));
}
{
  // Opslaan terwijl controles nog lopen: de server legt vast wat er op dat moment is; de rest blijft "Niet gecontroleerd"
  const s = maakServer();
  s.houdVast(ID1); s.houdVast(ID2); s.houdVast(ID3);
  await toon(werkruimte(s));
  await klik(q('[data-testid="voorstel-start-knop"]'));
  await rust();
  check('controles lopen nog', q('[data-testid="voorstel-resultaat"]').dataset.controles === 'bezig' && /Niet gecontroleerd opgeslagen|als Niet gecontroleerd/.test(q('[data-testid="voorstel-controles-bezig"]').textContent));
  await klik(q('[data-testid="voorstel-opslaan"]'));
  await rust();
  check('opgeslagen als "Niet gecontroleerd": herkenbaar na opslaan', qa('[data-testid="samenvatting-bron"]').length === 2 && qa('[data-testid="samenvatting-bron"]').every((x) => x.dataset.status === 'niet_gecontroleerd'));
  s.geefVrij(ID1); s.geefVrij(ID2); s.geefVrij(ID3);
  await rust(60);
  check('late antwoorden na opslaan veranderen het scherm niet meer', qa('[data-testid="samenvatting-bron"]').every((x) => x.dataset.status === 'niet_gecontroleerd'));
  await klik(q('[data-testid="voorstel-sluiten"]'));
}

sectie('9. Gedeeltelijk mislukt actieplan: dekkingsplan blijft, alleen taken opnieuw, geen dubbele');
{
  const s = maakServer({ taakFalen: 1 });
  let laatste = null;
  await toon(werkruimte(s, { onOpgeslagen: (u) => { laatste = u; } }));
  await klik(q('[data-testid="voorstel-start-knop"]'));
  await rust(80);
  await klik(q('[data-testid="voorstel-opslaan"]'));
  await rust();
  check('dekkingsplan opgeslagen (2 regels)', s.fundings.size === 2 && qa('[data-testid="voorstel-opgeslagen-regel"]').length === 2);
  check('actieplan "deels" met uitleg en knop', q('[data-testid="voorstel-actieplan"]').dataset.status === 'deels' && /maar deels aangemaakt/.test(q('[data-testid="voorstel-actieplan"]').textContent) && /geen dubbele taken/.test(q('[data-testid="voorstel-actieplan"]').textContent) && !!q('[data-testid="actieplan-opnieuw"]'));
  check('1 taak staat er, 1 ontbreekt', s.taken.size === 1);
  // Dubbelklik op "opnieuw proberen"
  await act(async () => {
    const k = q('[data-testid="actieplan-opnieuw"]');
    k.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    k.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await sleep(60);
  });
  const calls = opslagCalls(s);
  check('dubbelklik herstel: één herstel-aanroep (alleenActies)', calls.length === 2 && calls[1].alleenActies === true, String(calls.length));
  check('na herstel: 2 taken, 2 regels, geen duplicaten', s.taken.size === 2 && s.fundings.size === 2);
  check('scherm: actieplan klaar met 2 taken, knop weg', q('[data-testid="voorstel-actieplan"]').dataset.status === 'klaar' && /2 taken/.test(q('[data-testid="voorstel-actieplan"]').textContent) && !q('[data-testid="actieplan-opnieuw"]'));
  check('dekkingsplan in het scherm ongewijzigd (nog steeds 2 regels)', qa('[data-testid="voorstel-opgeslagen-regel"]').length === 2);
  check('onOpgeslagen kreeg het nieuwe actieplan', laatste && laatste.actieplan.status === 'klaar');
  await klik(q('[data-testid="voorstel-sluiten"]'));
}
{
  // Alle taken mislukken, ook de eerste herstelpoging; daarna lukt het
  const s = maakServer({ taakFalen: 99 });
  await toon(werkruimte(s));
  await klik(q('[data-testid="voorstel-start-knop"]'));
  await rust(80);
  await klik(q('[data-testid="voorstel-opslaan"]'));
  await rust();
  check('actieplan "mislukt", dekkingsplan staat, taken 0', q('[data-testid="voorstel-actieplan"]').dataset.status === 'mislukt' && s.fundings.size === 2 && s.taken.size === 0 && !!q('[data-testid="actieplan-opnieuw"]'));
  const echt = s.diensten.opslaan;
  s.diensten.opslaan = async () => { throw new Error('netwerk'); };
  await klik(q('[data-testid="actieplan-opnieuw"]'));
  await rust();
  check('herstel mislukt: foutmelding, dekkingsplan veilig, knop blijft', /dekkingsplan is opgeslagen en ongewijzigd/.test(q('[data-testid="voorstel-actieplan-fout"]').textContent) && !!q('[data-testid="actieplan-opnieuw"]') && s.fundings.size === 2);
  s.diensten.opslaan = echt; s.taakFalen = 0;
  await klik(q('[data-testid="actieplan-opnieuw"]'));
  await rust();
  check('tweede herstel lukt: 2 taken, klaar, foutmelding weg', s.taken.size === 2 && q('[data-testid="voorstel-actieplan"]').dataset.status === 'klaar' && !q('[data-testid="voorstel-actieplan-fout"]'));
  await klik(q('[data-testid="voorstel-sluiten"]'));
}
{
  // Technische fout bij opslaan: niets opgeslagen, invoer blijft, opnieuw proberen geeft geen dubbele regels
  const s = maakServer({ opslaanFalen: 1 });
  await toon(werkruimte(s));
  await klik(q('[data-testid="voorstel-start-knop"]'));
  await rust(80);
  await typ(qa('[data-testid="voorstel-bedrag"]')[0], '20.000');
  await klik(q('[data-testid="voorstel-opslaan"]'));
  await rust();
  check('technische fout: melding, geen samenvatting, invoer behouden', /niet gelukt/.test(q('[data-testid="voorstel-opslaan-fout"]').textContent) && !q('[data-testid="voorstel-opgeslagen"]') && qa('[data-testid="voorstel-bedrag"]')[0].value === '20.000' && s.fundings.size === 0);
  await klik(q('[data-testid="voorstel-opslaan"]'));
  await rust();
  check('opnieuw opslaan lukt, geen dubbele regels of taken', s.fundings.size === 2 && s.taken.size === 2 && !q('[data-testid="voorstel-opslaan-fout"]'));
  await klik(q('[data-testid="voorstel-sluiten"]'));
}

sectie('10. Verversen tijdens de broncontrole (sluiten en opnieuw openen)');
{
  const s = maakServer();
  s.houdVast(ID2); s.houdVast(ID3);
  await toon(werkruimte(s));
  await klik(q('[data-testid="voorstel-start-knop"]'));
  await rust(60);
  check('voor "verversen": regel 1 gecontroleerd en door de server onthouden, de rest loopt nog', statussen()[0] === 'gecontroleerd' && statussen()[1] === 'controleren' && s.checks.has(`regeling:${ID1}`) && !s.checks.has(`regeling:${ID2}`));
  const fouten0 = console_errors.length;
  // Verversen = het scherm verdwijnt midden in de controle (de browser-state is weg)
  await weg();
  const voor = s.log.filter(([n]) => n === 'controleer').length;
  s.geefVrij(ID2); s.geefVrij(ID3);
  await rust(60);
  check('de late antwoorden van het oude scherm geven geen fouten (geen state-update op weggehaald scherm)', console_errors.length === fouten0, console_errors.slice(fouten0).join(' | '));
  check('na verdwijnen worden er geen nieuwe controles meer gestart', s.log.filter(([n]) => n === 'controleer').length === voor);
  check('de server heeft ook de controles van het weggehaalde scherm vastgelegd (niet de browser)', s.checks.has(`regeling:${ID2}`) && s.checks.has(`regeling:${ID3}`));
  // Opnieuw openen: de server hergebruikt wat al gecontroleerd is
  const s2 = maakServer();
  s2.checks = s.checks;
  await toon(werkruimte(s2));
  await klik(q('[data-testid="voorstel-start-knop"]'));
  await rust(80);
  const nieuwe = s2.log.filter(([n]) => n === 'controleer').map(([, a]) => a);
  check('na verversen: elke regel nog een keer gecontroleerd-aanvraag, zonder opnieuw=true', nieuwe.length === 3 && nieuwe.every((a) => !a.opnieuw));
  check('server hergebruikte de eerdere controles (geen nieuwe bronbezoeken): "Eerder gecontroleerd"', statussen().every((x) => x === 'gecontroleerd'));
  await klik(qa('[data-testid="voorstel-regel-kop"]')[0]);
  check('details noemen dat het een eerdere controle is', /Eerder gecontroleerd op/.test(q('[data-testid="voorstel-regel-detail"]').textContent));
  await klik(q('[data-testid="voorstel-verwerp"]'));
}
{
  // Sluiten midden in de controle en direct opnieuw starten: een late uitkomst van de eerste ronde overschrijft de tweede niet
  const s = maakServer();
  s.houdVast(ID1);
  await toon(werkruimte(s));
  await klik(q('[data-testid="voorstel-start-knop"]'));
  await rust();
  await klik(q('[data-testid="voorstel-verwerp"]'));
  check('sluiten zonder opslaan: scherm weg, niets geschreven', !q('[data-testid="voorstel-resultaat"]') && !s.log.some(([n]) => n === 'opslaan'));
  s.uitkomst[ID1] = 'onzeker';
  const poort = s.poort[ID1]; delete s.poort[ID1];
  await klik(q('[data-testid="voorstel-start-knop"]'));
  await rust(80);
  s.uitkomst[ID1] = 'gecontroleerd'; s.checks.clear();
  poort.los();
  await rust(40);
  check('tweede ronde: regel 1 Onzeker; de late uitkomst van ronde 1 overschrijft dat niet', statussen()[0] === 'onzeker', statussen().join());
  await klik(q('[data-testid="voorstel-verwerp"]'));
}

sectie('11. Fouten, hint, documenten, online suggesties');
{
  const s = maakServer({ gen: null });
  await toon(werkruimte(s));
  await klik(q('[data-testid="voorstel-start-knop"]'));
  await rust();
  check('serverfout: melding, geen resultaat, geen controles', /begroting/.test(q('[data-testid="voorstel-fout"]').textContent) && !q('[data-testid="voorstel-resultaat"]') && !s.log.some(([n]) => n === 'controleer'));
  const s2 = maakServer({ gen: genereerAntwoord({ onlineSuggesties: [{ gever: 'Online BV', naam: 'Fonds X', url: 'https://x.example/a' }], werkwijze: { documenten: 2 } }) });
  await toon(werkruimte(s2));
  await klik(q('[data-testid="voorstel-start-knop"]'));
  await rust(80);
  check('online suggestie: "niet gecontroleerd", standaard uit, wordt niet gecontroleerd door de browser', !!q('[data-testid="voorstel-online"]') && /nog niet gecontroleerd/.test(q('[data-testid="voorstel-online"]').textContent) && !q('[data-testid="voorstel-suggestie"] input').checked && s2.log.filter(([n]) => n === 'controleer').length === 3);
  check('bron-link veilig', /noopener/.test(q('[data-testid="voorstel-online"] a').getAttribute('rel')));
  check('documenten: aantal en uitleg, geen inhoud', /2 geüploade projectdocumenten/.test(q('[data-testid="voorstel-documenten"]').textContent));
  const s3 = maakServer({ gen: genereerAntwoord({ premiumHint: { aantal: 4 } }) });
  await toon(werkruimte(s3));
  await klik(q('[data-testid="voorstel-start-knop"]'));
  await rust(80);
  const h = q('[data-testid="voorstel-premium-hint"]');
  check('Pro-hint: aantal, geen namen, link naar Premium', !!h && /zijn nog 4 fondsen/.test(h.textContent) && /alleen met Premium/.test(h.textContent) && /intent=PREMIUM/.test(q('[data-testid="voorstel-premium-link"]').getAttribute('href')) && !/Gever/.test(h.textContent));
  const s4 = maakServer({ gen: genereerAntwoord({ voorstel: { versie: 1, regels: [], acties: [] }, uitkomst: 'geen-gat' }) });
  await toon(werkruimte(s4));
  await klik(q('[data-testid="voorstel-start-knop"]'));
  await rust();
  check('al gedekt: uitleg, geen controles', /volledig gedekt|gedekt/.test(q('[data-testid="voorstel-fout"]').textContent) && s4.log.every(([n]) => n !== 'controleer'));
  const s5 = maakServer({ gen: genereerAntwoord({ voorstel: { versie: 1, regels: [regel(1, ID1, { staatAl: true, selecteerbaar: false })], acties: [] } }) });
  await toon(werkruimte(s5));
  await klik(q('[data-testid="voorstel-start-knop"]'));
  await rust(60);
  check('regel die al in het plan staat wordt niet opnieuw gecontroleerd', s5.log.filter(([n]) => n === 'controleer').length === 0);
}

sectie('12. Chat-ingang (FondsMatchKaart): dezelfde voorbereiding, geen directe opslag');
{
  const items = [
    { type: 'regeling', id: ID1, naam: 'Regeling 1', gever: 'Gever 1', deadline: '2026-12-01', waarom: ['Past'] },
    { type: 'regeling', id: ID2, naam: 'Regeling 2', gever: 'Gever 2', deadline: null, waarom: ['Past'] },
  ];
  const lijst = { projectId: PID, items, intentie: 'scan' };
  const s = maakServer();
  s.houdVast(ID1);
  let gewijzigd = 0;
  await toon(<FondsMatchKaart lijst={lijst} berichtId="m1" projectNaam="Project" projecten={[]} onGewijzigd={() => { gewijzigd += 1; }} voorstelAan diensten={s.diensten} />);
  check('kaart: knoppen noemen voorbereiden/controleren, niet "direct toevoegen"', /Controleren en toevoegen/.test(q('[data-testid="fm-toevoegen"]').textContent) && /voorbereiden voor het dekkingsplan/.test(q('[data-testid="fm-alles-toevoegen"]').textContent));
  await klik(q('[data-testid="fm-alles-toevoegen"]'));
  await rust(60);
  check('geen directe opslag; chat-voorbereiding geopend', !!q('[data-testid="fm-voorbereiding"]') && s.fundings.size === 0 && client.log.andere.length === 0);
  check('chat-ingang: startpunt aangeroepen met type + id, niet genereren', s.log[0][0] === 'startpunt' && !s.log.some(([n]) => n === 'genereer'));
  check('dezelfde werkruimte, ingang chat', q('[data-testid="voorstel-werkruimte"]').dataset.ingang === 'chat' && !q('[data-testid="voorstel-start-knop"]'));
  check('dezelfde preview: 2 regels met Controleren… / Gecontroleerd en dezelfde buffertekst', qa('[data-testid="voorstel-rij"]').length === 2 && statussen()[0] === 'controleren' && /Buffer voor afwijzingen: 10%/.test(q('[data-testid="voorstel-buffer"]').textContent));
  check('chat: alles aangevinkt, bedragen leeg (lid kiest zelf)', qa('[data-testid="voorstel-kies"]').every((c) => c.checked) && qa('[data-testid="voorstel-bedrag"]').every((c) => c.value === ''));
  s.geefVrij(ID1);
  await rust(60);
  check('statussen komen binnen per regel', statussen().join() === 'gecontroleerd,gecontroleerd');
  await typ(qa('[data-testid="voorstel-bedrag"]')[0], '12.000');
  await klik(q('[data-testid="voorstel-opslaan"]'));
  await rust();
  const c = opslagCalls(s)[0];
  check('opslaan via dezelfde server-opslag: type/id/bedrag, bedrag leeg = null', JSON.stringify(c.regels) === JSON.stringify([{ type: 'regeling', id: ID1, bedrag: 12000 }, { type: 'regeling', id: ID2, bedrag: null }]), JSON.stringify(c.regels));
  check('server bewaart regels en maakt taken', s.fundings.size === 2 && s.taken.size === 2 && q('[data-testid="voorstel-actieplan"]').dataset.status === 'klaar');
  check('kaart-items staan nu op "toegevoegd" en project wordt ververst', qa('[data-testid="fm-item"]').every((i) => i.dataset.status !== 'klaar') && gewijzigd >= 1, qa('[data-testid="fm-item"]').map((i) => i.dataset.status).join());
  await klik(q('[data-testid="voorstel-sluiten"]'));
  check('sluiten: voorbereiding weg', !q('[data-testid="fm-voorbereiding"]'));
  // Dezelfde regels via de project-ingang -> dezelfde opgeslagen rijen en taken
  const sP = maakServer();
  await toon(werkruimte(sP));
  await klik(q('[data-testid="voorstel-start-knop"]'));
  await rust(80);
  await typ(qa('[data-testid="voorstel-bedrag"]')[0], '12.000');
  await klik(qa('[data-testid="voorstel-kies"]')[1]);
  await klik(qa('[data-testid="voorstel-kies"]')[1]);
  await typ(qa('[data-testid="voorstel-bedrag"]')[1], '30.000');
  await klik(q('[data-testid="voorstel-opslaan"]'));
  await rust();
  check('beide ingangen: dezelfde financieringsregels en dezelfde taken in de opslag', [...sP.fundings.keys()].sort().join() === [...s.fundings.keys()].sort().join() && [...sP.taken.keys()].sort().join() === [...s.taken.keys()].sort().join());
  await klik(q('[data-testid="voorstel-sluiten"]'));
}
{
  // Chat: server weigert (alles gefilterd) -> melding + opnieuw proberen, niets opgeslagen
  const items = [{ type: 'regeling', id: ID1, naam: 'Regeling 1', gever: 'G', deadline: null, waarom: [] }];
  const s = maakServer({ start: null });
  await toon(<FondsMatchKaart lijst={{ projectId: PID, items, intentie: 'scan' }} berichtId="m2" projectNaam="Project" projecten={[]} voorstelAan diensten={s.diensten} />);
  await klik(q('[data-testid="fm-toevoegen"]'));
  await rust(60);
  check('chat-ingang mislukt: melding en knop opnieuw proberen, niets opgeslagen', /Geen van deze financiers/.test(q('[data-testid="voorstel-fout"]').textContent) && !!q('[data-testid="voorstel-opnieuw"]') && s.fundings.size === 0);
  s.diensten.startpunt = async () => ({ ok: true, antwoord: startpuntAntwoord() });
  await klik(q('[data-testid="voorstel-opnieuw"]'));
  await rust(80);
  check('opnieuw proberen werkt', qa('[data-testid="voorstel-rij"]').length === 2);
  await weg();
}

sectie('12b. Bespreek met Subsidiekompas per regel, vervolgacties voor online suggesties en herstel met suggesties');
{
  const gen = genereerAntwoord({ onlineSuggesties: [{ gever: 'Online BV', naam: 'Fonds X', url: 'https://x.example/a' }] });
  const s = maakServer({ gen, taakFalen: 99 });
  await toon(werkruimte(s));
  await klik(q('[data-testid="voorstel-start-knop"]'));
  await rust(80);
  await klik(q('[data-testid="voorstel-suggestie"] input'));
  await klik(q('[data-testid="voorstel-opslaan"]'));
  await rust();
  const links = qa('[data-testid="bespreek-link"]');
  const hrefs = links.map((l) => l.getAttribute('href'));
  check('opgeslagen: per opgeslagen regel een Bespreek-link met focus op die regel', qa('[data-testid="voorstel-opgeslagen-regel"]').length === 2 && links.length >= 3, String(links.length));
  check('de links wijzen naar de chat met project en de eigen fundingId (geen gedeelde link)', new Set(hrefs).size === hrefs.length && hrefs.every((h) => /kompas\?project=/.test(h) && /focus=/.test(h)), hrefs.join(' | '));
  check('ook de online suggestie heeft een Bespreek-link', !!q('[data-testid="voorstel-opgeslagen-suggestie"] [data-testid="bespreek-link"]') || hrefs.some((h) => h.includes(fid('online:Online BV - Fonds X'))), hrefs.join(' | '));
  check('online suggestie: onzekere status en beoordelingsroute blijven zichtbaar', /niet gecontroleerd/i.test(q('[data-testid="voorstel-opgeslagen"]').textContent) && /beoordelen of het past/.test(q('[data-testid="voorstel-opgeslagen"]').textContent));
  const eerste = opslagCalls(s)[0];
  check('suggestie gaat zonder bedrag mee in het opslagverzoek', Array.isArray(eerste.suggesties) && eerste.suggesties.length === 1 && eerste.suggesties[0].gever === 'Online BV' && eerste.suggesties[0].bedrag == null);
  check('actieplan deels (taken van de regels mislukten) maar de suggestie-stappen staan er', s.taken.size === 3 && [...s.taken.keys()].every((k) => k.startsWith('online:')));
  await act(async () => { q('[data-testid="actieplan-opnieuw"]').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); await sleep(60); });
  const herstel = opslagCalls(s)[1];
  check('herstel stuurt de reeds opgeslagen suggestie opnieuw mee, alleen acties', herstel.alleenActies === true && herstel.suggesties.length === 1 && herstel.suggesties[0].gever === 'Online BV');
  check('herstel maakt geen tweede suggestie en geen dubbele stappen', s.fundings.size === 3 && [...s.taken.keys()].filter((k) => k.startsWith('online:')).length === 3);
  await klik(q('[data-testid="voorstel-sluiten"]'));
}

sectie('9b. Na verversen: de server bewaart de open taken, "Actieplan opnieuw proberen" blijft beschikbaar');
{
  const s = maakServer({ taakFalen: 1 });
  await toon(werkruimte(s));
  await klik(q('[data-testid="voorstel-start-knop"]'));
  await rust(80);
  await klik(q('[data-testid="voorstel-opslaan"]'));
  await rust();
  check('eerste keer: actieplan deels, 1 taak bewaard door de server', q('[data-testid="voorstel-actieplan"]').dataset.status === 'deels' && s.open.size === 1 && s.taken.size === 1);
  check('geen tweede banner naast de samenvatting', !q('[data-testid="actieplan-open"]'));

  // VERVERSEN: alle schermstatus is weg, alleen de server weet nog iets.
  await weg();
  await toon(werkruimte(s));
  await rust(60);
  check('na verversen: banner met aantal en uitleg', !!q('[data-testid="actieplan-open"]') && q('[data-testid="actieplan-open"]').dataset.aantal === '1' && /nog niet compleet/.test(q('[data-testid="actieplan-open"]').textContent) && /geen dubbele taken/.test(q('[data-testid="actieplan-open"]').textContent));
  check('de knop staat er', !!q('[data-testid="actieplan-open-opnieuw"]'));

  // Mislukt: banner en knop blijven, melding zichtbaar.
  s.herstelFalen = 1;
  await klik(q('[data-testid="actieplan-open-opnieuw"]'));
  await rust();
  check('herstel mislukt: foutmelding, banner en knop blijven, taak nog open', /ongewijzigd/.test(q('[data-testid="actieplan-open-fout"]').textContent) && !!q('[data-testid="actieplan-open-opnieuw"]') && s.open.size === 1);

  // Dubbelklik: één herstel-aanroep.
  let gemeld = null;
  await weg();
  await toon(werkruimte(s, { onOpgeslagen: (u) => { gemeld = u; } }));
  await rust(60);
  const voor = s.log.filter(([n]) => n === 'herstelOpen').length;
  await act(async () => {
    const k = q('[data-testid="actieplan-open-opnieuw"]');
    k.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    k.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await sleep(60);
  });
  check('dubbelklik: één herstel-aanroep, de browser stuurt alleen het project mee', s.log.filter(([n]) => n === 'herstelOpen').length === voor + 1 && JSON.stringify(s.log.filter(([n]) => n === 'herstelOpen').pop()[1]) === JSON.stringify({ projectId: PID }));
  check('herstel lukt: 2 taken, wachtrij leeg, geen dubbelen, dekkingsplan ongewijzigd', s.taken.size === 2 && s.open.size === 0 && s.fundings.size === 2);
  check('banner toont de bevestiging, knop weg', !!q('[data-testid="actieplan-open-klaar"]') && /aangevuld/.test(q('[data-testid="actieplan-open-klaar"]').textContent) && !q('[data-testid="actieplan-open-opnieuw"]'));
  check('onOpgeslagen meldt het nieuwe actieplan (zodat de pagina herlaadt)', gemeld && gemeld.actieplan.status === 'klaar');

  // Nog een verversing: niets meer open, geen banner.
  await weg();
  await toon(werkruimte(s));
  await rust(60);
  check('opnieuw verversen: geen banner meer', !q('[data-testid="actieplan-open"]'));
}
{
  // Zonder migratie / tabel (leesOpen levert ok:false): geen banner, geen fout. Chat-ingang: nooit een banner.
  const s = maakServer();
  s.diensten.leesOpen = async () => ({ ok: false, aantal: 0 });
  await weg();
  await toon(werkruimte(s));
  await rust(60);
  check('tabel niet beschikbaar: geen banner en geen foutmelding', !q('[data-testid="actieplan-open"]') && !q('[role="alert"]'));

  const s2 = maakServer();
  s2.open.set('x|y', { titel: 'y' });
  await weg();
  await toon(werkruimte(s2, { startpunt: { regels: [{ type: 'regeling', id: ID1 }] } }));
  await rust(60);
  check('chat-ingang toont de projectbanner niet', !q('[data-testid="actieplan-open"]') && !s2.log.some(([n]) => n === 'leesOpen'));

  // Een dienst zonder leesOpen (oudere testdiensten) breekt niets.
  const s3 = maakServer();
  delete s3.diensten.leesOpen;
  await weg();
  await toon(werkruimte(s3));
  await rust(60);
  check('diensten zonder leesOpen: scherm werkt gewoon', !!q('[data-testid="voorstel-werkruimte"]') && !q('[data-testid="actieplan-open"]'));
}

// ===========================================================================================================================
// Zoekprofiel bekijken en bevestigen (beide routes): model, projectroute, chatroute
const Z = await import('../../src/features/kompas-app/financiering/zoekprofielModel.js');
const { default: ChatZoekprofielKaart } = await import('../../src/features/kompas-app/chat/ChatZoekprofielKaart.jsx');

const LIJSTEN = { themas: ['Cultuur', 'Sport', 'Jeugd', 'Welzijn', 'Educatie', 'Natuur'], doelgroepen: ['Jongeren', 'Ouderen', 'Kinderen', 'Vluchtelingen'], regios: ['Rotterdam', 'Zuid-Holland', 'Nederland'], error: null };
const profielRuw = (extra = {}) => ({
  versie: 1, route: 'project', omschrijving: 'Sportprogramma voor jongeren in Rotterdam-Zuid', trefwoorden: ['sport', 'jongeren'],
  disciplines: [{ naam: 'Sport', bron: 'project' }, { naam: 'Cultuur', bron: 'ai' }],
  werkvelden: [{ naam: 'Welzijn', bron: 'ai' }],
  doelgroepen: [{ naam: 'Jongeren', bron: 'project' }, { naam: 'Kinderen', bron: 'project' }],
  werkgebieden: [{ naam: 'Rotterdam', bron: 'project' }, { naam: 'Zuid-Holland', bron: 'project' }],
  locatie: 'Rotterdam-Zuid', periode: { start: '2027-01-01', eind: '2027-12-31', bron: 'project' },
  financieringsbehoefte: { gat: 55000, totaalBudget: 100000, eigenBijdrage: 45000, bekend: true },
  ontbrekend: [], onzeker: [{ soort: 'discipline', term: 'hiphop', reden: 'Geen discipline in de database; niet gebruikt voor het zoeken.' }], vragen: [],
  bronnen: { projectvelden: true, documenten: 2, gesprek: false, ai: 'gebruikt' }, ...extra,
});
const zonderBedragProfiel = () => profielRuw({ financieringsbehoefte: { gat: null, totaalBudget: null, eigenBijdrage: null, bekend: false }, ontbrekend: ['financieringsbehoefte'], vragen: ['Wat is de totale begroting en welk deel zoekt u bij fondsen?'] });
const onbekendAntwoord = () => genereerAntwoord({
  uitkomst: 'bedrag-onbekend', melding: 'Het bedrag dat u bij fondsen zoekt is nog niet bekend, dus de matching op bedrag is beperkt: test.', reserveSleutel: null,
  voorstel: { versie: 1, regels: [regel(1, ID1, { bedrag: null }), regel(2, ID2, { bedrag: null })], acties: [actie('a1', sl(ID1)), actie('a2', sl(ID2))] },
  totalen: { gat: 0, doelBedrag: 0, som: 0, nodig: 0, dekking: 0 }, werkwijze: { bedrag: 'onbekend', zoekprofiel: 'bevestigd-profiel', documenten: 2, profielToetsing: { gebruikt: {}, afgevallen: [{ soort: 'thema', term: 'hiphop' }] } },
});

function metProfiel(s, o = {}) {
  s.profielNu = o.profiel === undefined ? profielRuw() : o.profiel;
  s.zoekFalen = o.zoekFalen || 0;
  s.genereerFalen = o.genereerFalen || 0;

  const gen0 = s.diensten.genereer;

  s.diensten.genereer = async (a) => {
    if (s.genereerFalen > 0) { s.genereerFalen -= 1; s.log.push(['genereer', a]); return { ok: false, reden: 'fout', melding: 'Het voorstel kon nu niet worden gemaakt (test).' }; }

    return gen0(a);
  };
  s.diensten.zoekprofiel = async (a) => {
    s.log.push(['zoekprofiel', a]);

    if (s.zoekFalen > 0) { s.zoekFalen -= 1; return { ok: false, reden: 'fout', melding: 'Het zoekprofiel kon nu niet worden opgesteld (test).' }; }

    return { ok: true, antwoord: { ok: true, profiel: typeof s.profielNu === 'function' ? s.profielNu(a) : s.profielNu, opgeslagen: false } };
  };
  s.diensten.classificaties = async () => (o.lijstenFout ? { themas: [], doelgroepen: [], regios: [], error: { message: 'x' } } : LIJSTEN);

  return s;
}

const aanroepen = (s, naam) => s.log.filter(([n]) => n === naam).map(([, a]) => a);

// -------------------------------------------------------------------------------------------------------------------------
sectie('14. Zoekprofiel (model): meervoudige waarden, controle, samenvoegen en concept');
{
  const st = Z.maakProfielState(profielRuw());
  check('meerdere disciplines, doelgroepen en werkgebieden blijven staan (niets teruggebracht tot één)', st.disciplines.length === 2 && st.doelgroepen.length === 2 && st.werkgebieden.length === 2 && st.werkvelden.length === 1);
  check('bron per item blijft behouden (project, ai)', st.disciplines[0].bron === 'project' && st.disciplines[1].bron === 'ai');
  check('disciplines en werkvelden: dezelfde lijst (themas), geen eigen werkveld-tabel', Z.LIJST_VELDEN.find((v) => v.sleutel === 'disciplines').bron === 'themas' && Z.LIJST_VELDEN.find((v) => v.sleutel === 'werkvelden').bron === 'themas');

  const drie = Z.zetLijst(st, 'disciplines', ['Sport', 'Cultuur', 'Natuur']);
  check('derde discipline erbij: alle drie, bestaande houden hun herkomst, nieuwe = door u gekozen', drie.disciplines.map((i) => `${i.naam}:${i.bron}`).join() === 'Sport:project,Cultuur:ai,Natuur:gebruiker' && drie.gewijzigd.disciplines === true);
  check('de andere velden zijn onaangeroerd', drie.doelgroepen.length === 2 && !drie.gewijzigd.doelgroepen);
  const verplaatst = Z.zetLijst(st, 'disciplines', ['Sport', 'Cultuur', 'Welzijn']);
  check('een thema staat in hooguit één van disciplines en werkvelden (laatst gewijzigde lijst wint, niets verdwijnt)', verplaatst.werkvelden.length === 0 && verplaatst.disciplines.some((i) => i.naam === 'Welzijn') && verplaatst.gewijzigd.werkvelden === true);
  check('dubbele namen (hoofdletters/accenten) tellen één keer', Z.zetLijst(st, 'doelgroepen', ['Jongeren', 'jongeren', 'JONGEREN']).doelgroepen.length === 1);

  const verzoek = Z.bouwZoekprofielVerzoek(drie);
  check('verzoek: alle lijsten volledig, als {naam, bron}', verzoek.disciplines.length === 3 && verzoek.doelgroepen.length === 2 && verzoek.werkgebieden.length === 2 && verzoek.werkvelden.length === 1 && verzoek.disciplines.every((i) => Object.keys(i).sort().join() === 'bron,naam'));
  check('verzoek: periode, locatie en financieringsbehoefte meegenomen; route klopt', verzoek.periode.start === '2027-01-01' && verzoek.locatie === 'Rotterdam-Zuid' && verzoek.financieringsbehoefte.gat === 55000 && verzoek.financieringsbehoefte.bekend === true && verzoek.route === 'project');
  check('verzoek bevat geen interne toestand (gewijzigd, voorstellen, onzeker)', !('gewijzigd' in verzoek) && !('voorstellen' in verzoek) && !('onzeker' in verzoek));
  check('chatprofiel krijgt route chat', Z.bouwZoekprofielVerzoek(Z.maakProfielState(profielRuw({ route: 'chat' }), { route: 'chat' })).route === 'chat');

  // Controle
  check('volledig profiel: ok, met lijsten', Z.controleerProfiel(st, LIJSTEN).ok === true);
  const leeg = Z.zetLijst(Z.zetLijst(Z.zetLijst(st, 'disciplines', []), 'werkvelden', []), 'doelgroepen', []);
  const cLeeg = Z.controleerProfiel(leeg, LIJSTEN);
  check('zonder discipline, werkveld én doelgroep: niet ok (daarop wordt gezocht)', !cLeeg.ok && !!cLeeg.fouten.algemeen);
  check('alleen een doelgroep is genoeg om te zoeken', Z.controleerProfiel(Z.zetLijst(Z.zetLijst(Z.zetLijst(st, 'disciplines', []), 'werkvelden', []), 'doelgroepen', ['Jongeren']), LIJSTEN).ok);
  const onbekend = Z.zetLijst(st, 'disciplines', ['Sport', 'Verzonnen']);
  const cOnb = Z.controleerProfiel(onbekend, LIJSTEN);
  check('een waarde buiten de databaselijst wordt benoemd en blokkeert', !cOnb.ok && /Verzonnen/.test(cOnb.fouten.disciplines));
  check('zonder geladen lijsten: geen vals alarm', Z.controleerProfiel(onbekend, null).ok === true);
  const veel = Z.zetLijst(st, 'doelgroepen', Array.from({ length: 13 }, (_, i) => `D${i}`));
  check('meer dan 12 in één lijst: duidelijke fout (de server gebruikt er hoogstens 12)', /12/.test(Z.controleerProfiel(veel, null).fouten.doelgroepen || ''));
  check('einddatum vóór startdatum: fout', !Z.controleerProfiel(Z.zetVeld(Z.zetVeld(st, 'periodeStart', '2027-06-01'), 'periodeEind', '2027-01-01'), LIJSTEN).ok);
  check('bekende financieringsbehoefte: geen waarschuwing over het bedrag', !Z.controleerProfiel(st, LIJSTEN).waarschuwingen.some((w) => /bedrag/.test(w)));
  const onbekendBedrag = Z.maakProfielState(zonderBedragProfiel());
  const cB = Z.controleerProfiel(onbekendBedrag, LIJSTEN);
  check('onbekend bedrag: wél zoeken (ok) met de waarschuwing dat de matching op bedrag beperkt is', cB.ok === true && cB.waarschuwingen.some((w) => /matching op bedrag is dan beperkt/.test(w)));
  check('financieringTekst: bekend -> bedrag uit het project, niet opnieuw invullen', /Nog te financieren: € 55\.000/.test(Z.financieringTekst(st, (n) => `€ ${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`)) && /hoeft u niet opnieuw/.test(Z.financieringTekst(st)));
  check('financieringTekst: onbekend -> zoeken kan, geen bedragen voorgesteld', /nog niet bekend/.test(Z.financieringTekst(onbekendBedrag)) && /geen bedragen voorgesteld/.test(Z.financieringTekst(onbekendBedrag)));

  // Onzekere koppelingen
  check('onzekere term gemeld door de server staat zichtbaar in de toestand', st.onzeker.length === 1 && st.onzeker[0].term === 'hiphop');
  const gekoppeld = Z.koppelOnzeker(st, 'hiphop', 'werkvelden', 'Jeugd');
  check('onzeker koppelen aan een databasecategorie: term weg, categorie toegevoegd', gekoppeld.onzeker.length === 0 && gekoppeld.werkvelden.map((i) => i.naam).includes('Jeugd'));
  const genegeerd = Z.negeerOnzeker(st, 'hiphop');
  check('onzeker negeren: weg en onthouden', genegeerd.onzeker.length === 0 && genegeerd.genegeerd.includes('hiphop'));

  // Samenvoegen na "opnieuw opstellen": handmatige aanpassingen worden nooit stil overschreven
  const bewerkt = Z.zetVeld(Z.zetLijst(st, 'disciplines', ['Natuur']), 'omschrijving', 'Mijn eigen omschrijving');
  const vers = Z.maakProfielState(profielRuw({ omschrijving: 'Nieuwe omschrijving van de server', disciplines: [{ naam: 'Sport', bron: 'project' }, { naam: 'Educatie', bron: 'ai' }], doelgroepen: [{ naam: 'Ouderen', bron: 'ai' }] }));
  const samen = Z.voegSamen(bewerkt, vers);
  check('bewerkte omschrijving blijft staan', samen.omschrijving === 'Mijn eigen omschrijving');
  check('bewerkte disciplines blijven staan; wat de server méér voorstelt komt apart (niet automatisch toegevoegd)', samen.disciplines.map((i) => i.naam).join() === 'Natuur' && samen.voorstellen.disciplines.map((i) => i.naam).sort().join() === 'Educatie,Sport');
  check('niet-bewerkte velden worden wel ververst (doelgroepen)', samen.doelgroepen.map((i) => i.naam).join() === 'Ouderen' && !samen.voorstellen.doelgroepen);
  const overgenomen = Z.neemVoorstelOver(samen, 'disciplines', 'Educatie');
  check('voorstel overnemen: erbij als door u gekozen, uit de voorstellen', overgenomen.disciplines.map((i) => i.naam).join() === 'Natuur,Educatie' && overgenomen.voorstellen.disciplines.length === 1);
  check('samenvoegen zonder concept: het verse profiel', Z.voegSamen(null, vers) === vers);
  check('genegeerde onzekere termen komen niet terug', Z.voegSamen({ ...bewerkt, genegeerd: ['hiphop'] }, vers).onzeker.every((o) => o.term !== 'hiphop'));

  // Concept bewaren
  const mem = new Map();
  const opslag = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  check('concept bewaren lukt', Z.bewaarConcept(opslag, PID, bewerkt) === true);
  const terug = Z.leesConcept(opslag, PID, 'project');
  check('concept terug: dezelfde lijsten en omschrijving, gewijzigd-vlaggen intact', terug.disciplines.map((i) => i.naam).join() === 'Natuur' && terug.omschrijving === 'Mijn eigen omschrijving' && terug.gewijzigd.disciplines === true && terug.gewijzigd.omschrijving === true);
  check('concept is per route gescheiden (chat ziet het projectconcept niet)', Z.leesConcept(opslag, PID, 'chat') === null && Z.conceptSleutel(PID, 'chat') !== Z.conceptSleutel(PID, 'project'));
  check('concept is per project gescheiden', Z.leesConcept(opslag, ID1, 'project') === null);
  Z.wisConcept(opslag, PID, 'project');
  check('concept wissen', Z.leesConcept(opslag, PID, 'project') === null);
  const kapot = { getItem: () => { throw new Error('geblokkeerd'); }, setItem: () => { throw new Error('vol'); }, removeItem: () => { throw new Error('x'); } };
  check('opslag die faalt breekt niets (bewaren false, lezen null, wissen stil)', Z.bewaarConcept(kapot, PID, bewerkt) === false && Z.leesConcept(kapot, PID, 'project') === null && (Z.wisConcept(kapot, PID, 'project'), true));
  check('zonder opslag: geen fout', Z.bewaarConcept(null, PID, bewerkt) === false && Z.leesConcept(null, PID, 'project') === null);
  mem.set(Z.conceptSleutel(PID, 'project'), '{kapot');
  check('kapot concept wordt genegeerd', Z.leesConcept(opslag, PID, 'project') === null);
  mem.set(Z.conceptSleutel(PID, 'project'), JSON.stringify({ versie: 9, state: {} }));
  check('concept van een andere versie wordt genegeerd', Z.leesConcept(opslag, PID, 'project') === null);
  const trefw = Z.zetTrefwoorden(st, 'Sport, sport; jeugd\nWijk, ' + Array.from({ length: 15 }, (_, i) => `w${i}`).join(','));
  check('trefwoorden: ontdubbeld, kleine letters, hoogstens 10', trefw.trefwoorden.length === 10 && trefw.trefwoorden[0] === 'sport' && trefw.trefwoorden.filter((w) => w === 'sport').length === 1);
}

// -------------------------------------------------------------------------------------------------------------------------
const typTekst = async (el, waarde) => {
  await act(async () => {
    const set = Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set;
    set.call(el, waarde);
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
};
const veld = (id) => q(`[data-testid="zp-veld-${id}"]`);
const chips = (id) => [...veld(id).querySelectorAll('button[aria-label$=" verwijderen"]')].map((b) => b.getAttribute('aria-label').replace(/ verwijderen$/, ''));
const optieKnop = (id, naam) => [...veld(id).querySelectorAll('button[role="option"]')].find((b) => b.textContent.replace('✓', '').trim() === naam);
async function kiesOptie(id, naam) {
  const trigger = veld(id).querySelector('button[aria-haspopup="listbox"]');

  if (trigger.getAttribute('aria-expanded') !== 'true') await klik(trigger);

  await klik(optieKnop(id, naam));
}
const verwijderChip = (id, naam) => klik(veld(id).querySelector(`button[aria-label="${naam} verwijderen"]`));
const bevestigKnop = () => q('[data-testid="zp-bevestig"]');
const schoon = async () => { await weg(); localStorage.clear(); };

sectie('15. Projectroute: het projectprofiel is het zoekprofiel; geen tweede formulier');
{
  localStorage.clear();
  const s = metProfiel(maakServer());
  await toon(werkruimte(s));
  await klik(q('[data-testid="voorstel-start-knop"]'));
  await rust(120);
  check('geen apart zoekprofielformulier meer', !q('[data-testid="zoekprofiel"]') && !q('[data-testid="zp-bevestig"]'));
  check('het zoekprofiel is het project: de zoekprofielservice wordt niet aangeroepen', aanroepen(s, 'zoekprofiel').length === 0);
  const g = aanroepen(s, 'genereer');
  check('Subsidiekompas zoekt meteen: precies één genereren-aanroep, zonder apart profiel (de server leest het project)', g.length === 1 && g[0].projectId === PID && !g[0].zoekprofiel);
  check('daarna het voorstel-scherm; niets opgeslagen', !!q('[data-testid="voorstel-resultaat"]') && qa('[data-testid="voorstel-rij"]').length === 3 && aanroepen(s, 'opslaan').length === 0);
}
await schoon();
{
  const s = metProfiel(maakServer({ gen: genereerAntwoord({ werkwijze: { zoekprofiel: 'bevestigd-profiel', bedrag: 'bekend', documenten: 0, profielToetsing: { gebruikt: {}, afgevallen: [{ soort: 'thema', term: 'hiphop' }, { soort: 'doelgroep', term: 'tieners' }] } } }) }));
  await toon(werkruimte(s));
  await klik(q('[data-testid="voorstel-start-knop"]'));
  await rust(120);
  check('aanpassen gaat via het projectprofiel (link naar Projecten -> bewerken)', /#\/kompas\/projecten\/.+\?bewerk=1$/.test(q('[data-testid="voorstel-profiel-aanpassen"]').getAttribute('href')));
  check('termen die de server niet in de database vond worden benoemd', /hiphop, tieners/.test(q('[data-testid="voorstel-profiel-afgevallen"]').textContent));
}
await schoon();
{
  const s = metProfiel(maakServer(), { genereerFalen: 1 });
  await toon(werkruimte(s));
  await klik(q('[data-testid="voorstel-start-knop"]'));
  await rust(120);
  check('fout bij het zoeken: melding, opnieuw proberen en een link naar het projectprofiel', !!q('[data-testid="voorstel-fout"]') && !!q('[data-testid="voorstel-opnieuw"]') && /\?bewerk=1$/.test(q('[data-testid="voorstel-terug-profiel"]').getAttribute('href')));
  await klik(q('[data-testid="voorstel-opnieuw"]'));
  await rust(140);
  check('opnieuw proberen -> voorstel', !!q('[data-testid="voorstel-resultaat"]') && aanroepen(s, 'genereer').length === 2);
}
await schoon();
{
  const s = metProfiel(maakServer());
  await toon(werkruimte(s, { project: { ...PROJECT_OK, begroting: 0 } }));
  const knop = q('[data-testid="voorstel-start-knop"]');
  check('zonder begroting: de knop is uit en er staat dat de begroting (ook een richtbedrag) eerst ingevuld moet worden', knop.disabled === true && /projectbegroting/.test(q('[data-testid="voorstel-eerst-aanvullen"]').textContent) && aanroepen(s, 'genereer').length === 0 && aanroepen(s, 'zoekprofiel').length === 0);
}
await schoon();

sectie('16. Chatroute: dezelfde dienst en dezelfde keten, zonder tweede formulier');
{
  const berichten = [{ role: 'user', content: 'Ik wil een sportproject voor jongeren starten in Rotterdam.' }, { role: 'user', content: 'We zoeken ongeveer 50.000 euro.' }];
  const gesprekProfiel = (a) => profielRuw({ route: a.berichten && a.berichten.length ? 'chat' : 'project', bronnen: { projectvelden: true, documenten: 0, gesprek: true, ai: 'gebruikt' }, disciplines: [{ naam: 'Sport', bron: 'gesprek' }, { naam: 'Jeugd', bron: 'gesprek' }], doelgroepen: [{ naam: 'Jongeren', bron: 'gesprek' }] });
  const s = metProfiel(maakServer());
  s.profielNu = gesprekProfiel;
  let gewijzigd = 0;
  await toon(<ChatZoekprofielKaart project={{ id: PID, naam: 'Sportproject' }} berichten={berichten} diensten={s.diensten} onGewijzigd={() => { gewijzigd += 1; }} />);
  check('chat: ingeklapte kaart; nog niets aangeroepen', !!q('[data-testid="chat-zoekprofiel-open"]') && s.log.length === 0);
  await klik(q('[data-testid="chat-zoekprofiel-open"]'));
  await rust(160);
  check('chat: zoekprofielservice met de berichten van het lid', aanroepen(s, 'zoekprofiel').length === 1 && aanroepen(s, 'zoekprofiel')[0].berichten.length === 2);
  const g = aanroepen(s, 'genereer');
  check('chat: zoekt meteen met het profiel (route chat), geen formulier', !q('[data-testid="zoekprofiel"]') && g.length === 1 && g[0].zoekprofiel.route === 'chat' && g[0].zoekprofiel.disciplines.map((i) => i.naam).join() === 'Sport,Jeugd');
  check('chat: zelfde voorstelscherm met broncontrole per regel', !!q('[data-testid="voorstel-resultaat"]') && aanroepen(s, 'controleer').length === 3 && q('[data-testid="voorstel-werkruimte"]').dataset.ingang === 'chat');
  await klik(q('[data-testid="voorstel-opslaan"]'));
  await rust(80);
  check('chat: opslaan via dezelfde server-opslag, de chat wordt ververst', aanroepen(s, 'opslaan').length === 1 && q('[data-testid="voorstel-actieplan"]').dataset.status === 'klaar' && gewijzigd >= 1);
}
await schoon();
{
  await toon(<ChatZoekprofielKaart project={null} berichten={[]} />);
  check('chat zonder project: de kaart verschijnt niet', q('[data-testid="chat-zoekprofiel"]') === null);
}
await schoon();

sectie('17. Looptijd: "past inhoudelijk, maar het project is dan al afgelopen" staat apart, niet selecteerbaar, niet in de dekking');
{
  const na = [
    { type: 'regeling', id: 'c0000000-0000-4000-8000-000000000001', naam: 'Voorjaarsronde 2028', gever: 'Stichting Te Laat', uitleg: 'Dit fonds doet niet meer mee in de dekking, maar zou eventueel wel passend zijn geweest. Het past inhoudelijk, maar doordat het project dan al afgelopen is, komt u niet in aanmerking.', moment: '2028-03-01', momentSoort: 'deadline', projectEinde: '2027-06-30', kenmerken: { beschrijving: 'Steunt kinderprojecten.', doelgroepen: ['Kinderen'], disciplines: ['Educatie'], werkgebieden: [], bandbreedte: null, website: 'https://www.tela.example.nl/', passendheid: 'aantoonbaar', controleren: [] } },
    { type: 'fonds', id: 'c0000000-0000-4000-8000-000000000002', naam: '', gever: '', uitleg: '', moment: null },
  ];
  const s = metProfiel(maakServer({ gen: genereerAntwoord({ naAfloop: na }) }));
  await toon(werkruimte(s));
  await klik(q('[data-testid="voorstel-start-knop"]'));
  await rust(120);
  const blok = q('[data-testid="voorstel-na-afloop"]');
  check('er is een aparte lijst voor financiers die pas na afloop beslissen (een leeg item valt weg)', !!blok && qa('[data-testid="voorstel-na-afloop-regel"]').length === 1);
  check('met de afgesproken woorden', /Past inhoudelijk, maar het project is dan al afgelopen/.test(blok.textContent) && /doet niet meer mee in de dekking, maar zou eventueel wel passend zijn geweest/.test(blok.textContent) && /komt u niet in aanmerking/.test(blok.textContent));
  check('met de kenmerken uit de database', /Stichting Te Laat/.test(blok.textContent) && /Kinderen/.test(blok.textContent) && !!blok.querySelector('[data-testid="voorstel-regel-kenmerken"]'));
  check('niet selecteerbaar en niet in de dekking: geen selectievakje, het aantal regels blijft 3', !blok.querySelector('input[type="checkbox"]') && qa('[data-testid="voorstel-rij"]').length === 3);
}
await schoon();
{
  const s = metProfiel(maakServer());
  await toon(werkruimte(s));
  await klik(q('[data-testid="voorstel-start-knop"]'));
  await rust(120);
  check('zonder financiers na afloop: geen lijst', !q('[data-testid="voorstel-na-afloop"]'));
}
await schoon();

sectie('13. Statische eigenschappen van de client');
{
  const lees = (p) => readFileSync(join(ROOT, p), 'utf8');
  const bron = lees('src/features/kompas-app/financiering/VoorstelWerkruimte.jsx');
  const werk = lees('src/features/kompas-app/financiering/voorstelWerk.js');
  const service = lees('src/data/services/voorstelGenereren.js');
  const bronStatus = lees('src/features/kompas-app/financiering/bronStatus.js');
  check('geen schrijfpad naar de database in de werkruimte (alleen server-opslag)', !/\.insert\(|\.upsert\(|\.update\(|supabase|voegRegelToe|voegFinancierToe|voegActieToe/.test(bron + werk));
  check('service schrijft nooit zelf; alleen de Edge Function en een leesquery', !/\.insert\(|\.upsert\(|\.update\(|\.delete\(/.test(service) && /\.from\('subsidie_kompas_bron_controles'\)/.test(service));
  check('de client kent geen token- of geheimlogica voor de bronstatus', !/secret|hmac|jwt|VOORSTEL_TOKEN/i.test(werk + service + bronStatus));
  check('de client rekent zelf geen dekkingsfactor uit (geen 1.1/1.2/110/120)', !/\b1\.1\b|\b1\.2\b|\b110\b|\b120\b/.test(werk.replace(/\/\/.*$/gm, '')));
  check('opslagverzoek bevat nergens naam/bron/status uit de browser', /regels\.push\(\{ type: r\.type, id: r\.id, bedrag: b\.waarde \}\)/.test(werk));
  check('client markeert zelf nooit iets als gecontroleerd', !/status:\s*'gecontroleerd'/.test(werk.replace(/\/\/.*$/gm, '')));
  // Zoekprofiel: geen tweede matchingflow, geen netwerk in het model, geen directe databasetoegang in de nieuwe schermen
  const model = lees('src/features/kompas-app/financiering/zoekprofielModel.js');
  const chatKaart = lees('src/features/kompas-app/chat/ChatZoekprofielKaart.jsx');
  const toolPagina = lees('src/features/kompas-app/KompasToolPage.jsx');
  const code = (t) => t.replace(/\/\/.*$/gm, '');
  check('zoekprofielModel is zuiver: geen netwerk, geen supabase, geen React', !/fetch\(|supabase|XMLHttp|from 'react'/.test(code(model)));
  check('geen apart zoekprofielformulier in de werkruimte', !/ZoekprofielBevestigen/.test(bron));
  check('ChatZoekprofielKaart heeft geen eigen matching of service: alleen VoorstelWerkruimte (dezelfde keten)', !/supabase|fetch\(|vraag[A-Z]|\.from\(/.test(code(chatKaart)) && /VoorstelWerkruimte/.test(chatKaart));
  check('de werkruimte gebruikt voor beide routes dezelfde zoekprofielservice en dezelfde genereren-aanroep', (bron.match(/vraagZoekprofiel/g) || []).length >= 2 && (bron.match(/draaiVoorstelFlow\(/g) || []).length === 1);
  check('de chatpagina toont de zoekprofielkaart alleen met een echt project en als de flow aan staat', /ChatZoekprofielKaart/.test(toolPagina) && /isEchtId\(gekoppeldProjectId\) && voorstelGeneratieBeschikbaar\(\)/.test(toolPagina));
  check('het model noemt geen nieuwe werkveld-taxonomie: werkvelden komen uit dezelfde tabel als disciplines', /sleutel: 'werkvelden'[^}]*bron: 'themas'/.test(model) && /sleutel: 'disciplines'[^}]*bron: 'themas'/.test(model));
  check('de naam in de frontend is overal "Subsidie Kompas" (niet "Subsidiekompas")', ['src/features/kompas-app/financiering/VoorstelStart.jsx', 'src/features/kompas-app/financiering/VoorstelWerkruimte.jsx', 'src/features/kompas-app/financiering/VoorstelPreview.jsx', 'src/data/services/voorstelGenereren.js'].every((f) => !/Subsidiekompas/.test(lees(f))));
  check('het concept staat niet in de database (alleen browseropslag, geen migratie)', !/\.insert\(|\.upsert\(|subsidie_kompas_/.test(code(model)));
}

console.error = origError;
console.log(`\n${stand.ok} geslaagd, ${stand.fout} mislukt`);
process.exit(stand.fout ? 1 : 0);
