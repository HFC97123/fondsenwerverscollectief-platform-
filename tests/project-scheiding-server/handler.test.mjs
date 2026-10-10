// Draai: node tests/project-scheiding-server/handler.test.mjs
// End-to-end test van de ECHTE handler (Deno.serve) met een nagebootste database
// en nagebootste OpenAI: organisatie en actief project komen server-side uit de
// database, alleen via de geauthenticeerde user_id en active_program_id.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { world, laadModule, resetWorld, alleSysteemTeksten, FUNCTIE_PAD } from '../fondsadvies-free/harness.mjs';

// Serverbron: standaard supabase/functions/subsidie-kompas/index.ts. Staat daar de
// project-scheiding (v87) nog niet in, dan wordt deze test overgeslagen (exit 0).
// Eigen bron testen: SERVER_BRON=/pad/naar/index.ts node tests/project-scheiding-server/handler.test.mjs
const BRON = process.env.SERVER_BRON || FUNCTIE_PAD;
if (!readFileSync(BRON, 'utf8').includes('GEEN ACTIEF PROJECT')) {
  console.log('OVERGESLAGEN: ' + BRON + ' bevat de project-scheiding (v87) nog niet.');
  process.exit(0);
}
const origAdmin = globalThis.__createClient();
const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const PA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PX = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const PARC = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

const DB = {
  subsidie_kompas_organizations: [
    { id: 'o1', user_id: U1, organization_name: 'Stichting Kinderen Eerst', legal_form: 'stichting', anbi_status: 'ja', headquarters_location: 'Utrecht', mission: 'Kinderen een toekomst geven' },
    { id: 'o2', user_id: U2, organization_name: 'Het Nederlandse Rode Kruis', legal_form: 'stichting' },
  ],
  subsidie_kompas_programs: [
    { id: PA, user_id: U1, name: 'Schoolproject Ghana', target_groups: '450 kinderen in Ghana', location: 'Accra', description: 'Onderwijs', goals: 'Toegang tot onderwijs', activities: 'lesmateriaal', requested_amount: 50000, budget_total: 85000, writing_preferences: 'warm en mensgericht', archived_at: null },
    { id: PB, user_id: U1, name: 'Buurtmoestuin Noord', target_groups: 'ouderen', location: 'Utrecht', description: 'Moestuin', goals: 'Ontmoeting', requested_amount: 12000, archived_at: null },
    { id: PX, user_id: U2, name: 'Project van andere gebruiker', target_groups: 'dieren', location: 'Rotterdam', archived_at: null },
    { id: PARC, user_id: U1, name: 'Oud project', target_groups: 'jongeren', archived_at: '2026-01-01' },
  ],
  subsidie_kompas_knowledge_items: [
    { program_id: PA, user_id: U1, title: 'Plan A v2', notes: 'Projectplan', doc_type: 'Projectplan', version: 2, document_context: { fonds: 'Fonds X' }, extracted_text: 'TEKST-A-V2', superseded_at: null, created_at: '2026-10-02' },
    { program_id: PA, user_id: U1, title: 'Plan A v1', notes: 'Projectplan', doc_type: 'Projectplan', version: 1, document_context: {}, extracted_text: 'TEKST-A-V1', superseded_at: '2026-10-02', created_at: '2026-10-01' },
    { program_id: PB, user_id: U1, title: 'Plan B', notes: 'Projectplan', doc_type: 'Projectplan', version: 1, document_context: {}, extracted_text: 'TEKST-B', superseded_at: null, created_at: '2026-10-01' },
  ],
};
function bouw(tabel) {
  let rijen = DB[tabel].slice();
  const b = {
    select() { return b; }, in() { return b; }, order() { return b; },
    limit(n) { rijen = rijen.slice(0, n); return b; },
    eq(k, v) { rijen = rijen.filter((r) => r[k] === v); return b; },
    is(k, v) { rijen = rijen.filter((r) => (r[k] ?? null) === v); return b; },
    maybeSingle() { return Promise.resolve({ data: rijen[0] || null, error: null }); },
    single() { return Promise.resolve({ data: rijen[0] || null, error: rijen[0] ? null : { message: 'x' } }); },
    then(res, rej) { return Promise.resolve({ data: rijen, error: null }).then(res, rej); },
  };
  return b;
}
const mijnAdmin = { ...origAdmin, from: (t) => (DB[t] ? bouw(t) : origAdmin.from(t)), auth: { getUser: async () => ({ data: { user: world.user || null } }) }, rpc: origAdmin.rpc };
globalThis.__createClient = () => mijnAdmin;

const origFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).includes('/chat/completions')) {
    const body = JSON.parse(init.body);
    const sys = body.messages[0].content;
    world.openAi.push({ soort: 'chat', body, sys });
    const uit = world.chatAntwoord ? world.chatAntwoord(sys, body) : {};
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(uit) } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }), { status: 200 });
  }
  return origFetch(url, init);
};

const { handler } = await laadModule(BRON, 'proj');

async function vraag(body, { gebruiker = U1, tier = 'pro' } = {}) {
  resetWorld({
    user: gebruiker ? { id: gebruiker } : null,
    profile: gebruiker ? { id: gebruiker, role: 'member', subscription_tier: tier, subscription_active: true } : null,
    regelingen: [], funders: [], deadlines: [],
    chatAntwoord: world.chatAntwoord,
  });
  const res = await handler(new Request('http://x/functions/v1/subsidie-kompas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(gebruiker ? { Authorization: 'Bearer tok' } : {}) },
    body: JSON.stringify({ stream: false, ...body }),
  }));
  const json = await res.json();
  const hoofd = world.openAi.filter((c) => c.soort === 'responses');

  return { status: res.status, json, hoofd: hoofd[hoofd.length - 1]?.body, chat: world.openAi.filter((c) => c.soort === 'chat') };
}
const sys = (r) => alleSysteemTeksten(r.hoofd);
let ok = 0, fout = 0;
const check = (n, w, x = '') => { if (w) ok++; else fout++; console.log(`${w ? 'OK  ' : 'FAIL'} ${n}${!w && x ? ' — ' + x : ''}`); };

const msg = [{ role: 'user', content: 'Kun je ons helpen met een tekst voor ons project?' }];

// 1. Actief project B (eigen) + organisatie
world.chatAntwoord = () => ({});
let r = await vraag({ messages: msg, kompasMode: 'algemeen', activeProgramId: PB });
let t = sys(r);
check('H1. status 200', r.status === 200, JSON.stringify(r.json).slice(0, 200));
check('H2. ACTIEF PROJECT B staat in de prompt', /ACTIEF PROJECT: "Buurtmoestuin Noord"/.test(t) && /TEKST-B/.test(t));
check('A1. niets van project A in de prompt (naam, doelgroep, locatie, documenten, schrijfvoorkeur)', !/Ghana|Accra|Schoolproject|TEKST-A|warm en mensgericht|450 kinderen/.test(t));
check('H3. organisatieprofiel komt uit de database van deze gebruiker', /ORGANISATIEPROFIEL[^\n]*Stichting Kinderen Eerst/.test(t) && !/Rode Kruis/.test(t));
check('H4. drie-niveaus-instructie aanwezig', /DRIE NIVEAUS, STRIKT GESCHEIDEN/.test(t));

// 2. Project A (documenten alleen laatste versie)
r = await vraag({ messages: msg, kompasMode: 'algemeen', activeProgramId: PA }); t = sys(r);
check('H5. project A: laatste documentversie, niet de vervangen versie, niets van B', /TEKST-A-V2/.test(t) && !/TEKST-A-V1/.test(t) && !/Moestuin|TEKST-B/.test(t));
check('F1. schrijfvoorkeur van het project staat in de projectcontext', /Schrijfvoorkeur voor alle teksten van dit project: warm en mensgericht/.test(t));

// 3. Geen actief project, ook al heeft de gebruiker projecten
r = await vraag({ messages: msg, kompasMode: 'algemeen' }); t = sys(r);
check('C1. zonder activeProgramId: GEEN ACTIEF PROJECT en geen enkel project in de prompt', /GEEN ACTIEF PROJECT/.test(t) && !/Ghana|Moestuin|Schoolproject|TEKST-/.test(t));
check('C2. organisatie blijft wel beschikbaar', /Stichting Kinderen Eerst/.test(t));

// 4. Project van een andere gebruiker / gearchiveerd / onzin-id
for (const [naam, id] of [['andere gebruiker', PX], ['gearchiveerd', PARC], ['geen uuid', 'niet-een-uuid']]) {
  r = await vraag({ messages: msg, kompasMode: 'algemeen', activeProgramId: id }); t = sys(r);
  check(`D1. ${naam}: wordt niet als actief project geladen`, /GEEN ACTIEF PROJECT/.test(t) && !/dieren|Rotterdam|Oud project|jongeren/.test(t));
}

// 5. Een door de browser meegestuurd orgProfile/project wordt genegeerd
r = await vraag({ messages: msg, kompasMode: 'algemeen', orgProfile: { name: 'Het Nederlandse Rode Kruis' }, project: { naam: 'Nep project', doelgroep: 'NEP' } }); t = sys(r);
check('D2. meegestuurd orgProfile/project wordt genegeerd (geen Rode Kruis, geen Nep project)', !/Rode Kruis|Nep project|NEP/.test(t));
r = await vraag({ messages: msg, kompasMode: 'algemeen' }, { gebruiker: U2 }); t = sys(r);
check('D3. gebruiker 2 ziet zijn eigen organisatie en niets van gebruiker 1', /Rode Kruis/.test(t) && !/Kinderen Eerst|Ghana|Moestuin/.test(t));

// 6. Oude client-context (zonder contextVersie 2) wordt genegeerd, nieuwe wel
r = await vraag({ messages: msg, kompasMode: 'algemeen', context: 'OUDE-CONTEXT-ALLE-PROJECTEN Ghana Moestuin' }); t = sys(r);
check('H6. context zonder contextVersie 2 wordt genegeerd', !/OUDE-CONTEXT/.test(t));
r = await vraag({ messages: msg, kompasMode: 'algemeen', context: 'Het lid werkt nu verder aan het document "Plan B"', contextVersie: 2, activeProgramId: PB }); t = sys(r);
check('H7. context met contextVersie 2 (actief document) wordt wel gebruikt', /verder aan het document "Plan B"/.test(t));

// 7. Free: geen organisatie- of projectcontext
r = await vraag({ messages: msg, kompasMode: 'algemeen', activeProgramId: PB, context: 'x', contextVersie: 2 }, { tier: 'free' }); t = sys(r);
check('H8. Free krijgt geen organisatie-, project- of niveau-context', !/ORGANISATIEPROFIEL|ACTIEF PROJECT|GEEN ACTIEF PROJECT|DRIE NIVEAUS|Moestuin|Kinderen Eerst/.test(t));

// 8. Matching: criteria-extractie krijgt organisatie + (alleen) actief project
world.chatAntwoord = (s) => (s.includes('zoekcriteria') ? { themas: ['Educatie'], doelgroepen: [], regios: [], kern_themas: [], gevraagd_bedrag: null } : {});
const fm = [{ role: 'user', content: 'Welke fondsen passen bij ons project?' }];
r = await vraag({ messages: fm, kompasMode: 'fondsadvies', activeProgramId: PB });
let ext = r.chat.find((c) => c.sys.includes('zoekcriteria'));
let inv = ext ? ext.body.messages[1].content : '';
check('B1. matching: criteria-invoer bevat ORGANISATIE (rechtsvorm) en ACTIEF PROJECT B', ext && /ORGANISATIE \(blijvende gegevens\)/.test(inv) && /rechtsvorm: stichting/.test(inv) && /projectnaam: Buurtmoestuin Noord/.test(inv) && /ouderen/.test(inv), inv.slice(0, 400));
check('B2. matching: niets van project A in de criteria-invoer', !/Ghana|Accra|450|Schoolproject/.test(inv));
check('B3. matching: het systeemprompt vertelt waar organisatie vs project voor dient', ext && /Gebruik ORGANISATIE alleen voor "aanvragertype"/.test(ext.sys));
r = await vraag({ messages: fm, kompasMode: 'fondsadvies' });
ext = r.chat.find((c) => c.sys.includes('zoekcriteria')); inv = ext ? ext.body.messages[1].content : '';
check('C3. matching zonder actief project: geen projectblok, wel organisatie', ext && !/ACTIEF PROJECT/.test(inv) && /ORGANISATIE/.test(inv) && !/Ghana|Moestuin/.test(inv), inv.slice(0, 300));
check('C4. matching zonder actief project: systeemprompt zegt dat er geen project is', ext && /GEEN actief project/.test(ext.sys));
r = await vraag({ messages: fm, kompasMode: 'fondsadvies', activeProgramId: PB }, { tier: 'free' });
ext = r.chat.find((c) => c.sys.includes('zoekcriteria')); inv = ext ? ext.body.messages[1].content : '';
check('B4. Free: matching zonder organisatie- of projectblok (ongewijzigd)', ext && !/ORGANISATIE|ACTIEF PROJECT/.test(inv), inv.slice(0, 200));

// 9. Organisatievoorstel (alleen blijvend) en dossier (drie niveaus, herkomst)
const lid = 'Het project heet Jongerenlab Zuid. De doelgroep is jongeren van 12 tot 18 jaar. Voor Fonds X schrijf ik maximaal 2 pagina\'s. Wij zijn een vereniging.';
world.chatAntwoord = (s) => {
  if (s.includes('organisatieprofiel in Subsidie Kompas aan te vullen')) return { velden: { rechtsvorm: 'vereniging', regio: 'Ghana', toon: 'warm' } };
  if (s.includes('Projectdossier bij')) {
    return {
      dossier: { projectnaam: 'Jongerenlab Zuid', doelgroep: 'jongeren van 12 tot 18 jaar', documentinstructies: "maximaal 2 pagina's", fondsKeuze: 'Fonds X' },
      bronnen: {
        projectnaam: { type: 'lid', citaat: 'Het project heet Jongerenlab Zuid' },
        doelgroep: { type: 'lid', citaat: 'De doelgroep is jongeren van 12 tot 18 jaar' },
        documentinstructies: { type: 'lid', citaat: "maximaal 2 pagina's" },
        fondsKeuze: { type: 'lid', citaat: 'Voor Fonds X' },
      },
    };
  }
  return {};
};
r = await vraag({ messages: [{ role: 'user', content: lid }], kompasMode: 'projectplan', activeProgramId: PB });
const orgPrompt = r.chat.find((c) => c.sys.includes('organisatieprofiel in Subsidie Kompas aan te vullen'));
check('F2. organisatievoorstel: prompt zegt "uitsluitend blijvende organisatiegegevens"', orgPrompt && /UITSLUITEND BLIJVENDE ORGANISATIEGEGEVENS/.test(orgPrompt.sys));
check('F3. organisatievoorstel: rechtsvorm mag, projectlocatie (regio) en toon niet zonder expliciete organisatiebrede uitspraak', r.json.veldVoorstellen && r.json.veldVoorstellen.rechtsvorm === 'vereniging' && !('regio' in r.json.veldVoorstellen) && !('toon' in r.json.veldVoorstellen), JSON.stringify(r.json.veldVoorstellen));
check('N1. dossier: documentinstructies en fondsKeuze zijn eigen (document-)velden naast de projectvelden', r.json.projectDossier && r.json.projectDossier.documentinstructies === "maximaal 2 pagina's" && r.json.projectDossier.fondsKeuze === 'Fonds X');
check('N2. dossier: herkomst per veld wordt teruggegeven (lid)', r.json.projectDossierBronnen && r.json.projectDossierBronnen.doelgroep === 'lid' && r.json.projectDossierBronnen.projectnaam === 'lid', JSON.stringify(r.json.projectDossierBronnen));
const dosPrompt = r.chat.find((c) => c.sys.includes('Projectdossier bij'));
check('N3. dossier-prompt scheidt schrijfstijl (project) van documentinstructies (document)', dosPrompt && /"schrijfstijl": alleen een blijvende schrijfvoorkeur/.test(dosPrompt.sys) && /"documentinstructies": wensen die alleen voor dit ene document/.test(dosPrompt.sys));
// expliciet organisatiebrede toon mag wel
r = await vraag({ messages: [{ role: 'user', content: 'Wij schrijven altijd warm en persoonlijk, voor al onze teksten.' }], kompasMode: 'algemeen' });
check('F4. expliciet organisatiebrede toon-uitspraak mag wel als organisatievoorstel', r.json.veldVoorstellen && 'toon' in r.json.veldVoorstellen, JSON.stringify(r.json.veldVoorstellen));

// 10. Streaming-pad: zelfde velden in de afsluitende SSE
const sres = await handler(new Request('http://x/functions/v1/subsidie-kompas', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' }, body: JSON.stringify({ messages: [{ role: 'user', content: lid }], kompasMode: 'projectplan', activeProgramId: PB, stream: true }) }));
check('S1. streaming-verzoek wordt niet met een fout beantwoord', sres.status === 200, String(sres.status));

console.log(`\n${ok} OK, ${fout} FAIL`);
process.exit(fout ? 1 : 0);
