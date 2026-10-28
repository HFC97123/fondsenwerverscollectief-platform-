// Projectdossier uit een document, clientkant: bestand kiezen, Claude laten lezen, voorstellen kiezen, overnemen, opslaan met herkomst, en de service.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
const g = globalThis;
g.window = dom.window; g.document = dom.window.document; g.localStorage = dom.window.localStorage;
Object.defineProperty(g, 'navigator', { value: dom.window.navigator, configurable: true });
g.HTMLElement = dom.window.HTMLElement; g.Event = dom.window.Event; g.MouseEvent = dom.window.MouseEvent; g.KeyboardEvent = dom.window.KeyboardEvent;
g.File = dom.window.File; g.FileReader = dom.window.FileReader; g.Blob = dom.window.Blob;
g.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import('react')).default;
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const client = await import('../checkout-frontend/fake-client.js');
const S = await import('../../src/data/services/dossierUitlezen.js');
const PI = await import('../../src/features/kompas-app/projectinformatie/projectinformatie.js');
const { naarKolomPatch } = await import('../../src/data/services/projecten.js');
const { extraheerTekst } = await import('../../src/data/services/documentExtractie.js');
const { default: DossierUitDocument, MELDINGEN } = await import('../../src/features/kompas-app/projectinformatie/DossierUitDocument.jsx');
const { default: ProjectinformatiePaneel } = await import('../../src/features/kompas-app/projectinformatie/ProjectinformatiePaneel.jsx');

const stand = { ok: 0, fout: 0 };
const check = (naam, waar, detail = '') => { if (waar) stand.ok += 1; else { stand.fout += 1; console.log(`  FAIL: ${naam} ${detail}`); } };
const sectie = (t) => console.log(`\n== ${t}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const q = (id) => document.querySelector(`[data-testid="${id}"]`);
const klik = async (el) => { await act(async () => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); }); await sleep(5); };
const wacht = async (fn, ms = 3000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(10); } return false; };
const kiesBestand = async (naam, inhoud = 'x') => {
  const invoer = q('dossier-bestand');
  const f = new window.File([inhoud], naam);
  Object.defineProperty(invoer, 'files', { value: [f], configurable: true });
  await act(async () => { invoer.dispatchEvent(new window.Event('change', { bubbles: true })); });
};
const toon = async (el) => { document.body.innerHTML = '<div id="root"></div>'; const root = createRoot(document.getElementById('root')); await act(async () => { root.render(el); }); return root; };

const VOORSTELLEN = [
  { key: 'aanleiding', tekst: 'Veel kinderen hebben na school geen plek om te spelen.', bewijs: 'geen plek om te spelen' },
  { key: 'doelstelling', tekst: 'Kinderen laten groeien door muziek.', bewijs: 'groeien door muziek' },
  { key: 'risicos', tekst: 'Docenten kunnen uitvallen; een vaste vervanger is afgesproken.', bewijs: 'vaste vervanger' },
];
const DOC = 'Tekst van het document over drumlessen. '.repeat(10);

// ---------------------------------------------------------------------------------------------------------------------------
sectie('1. Het dossier toont alle 22 onderdelen zodra de kolom bestaat');
{
  const zonder = { id: 'p1', naam: 'P', doelstellingen: 'x' };
  const met = { id: 'p1', naam: 'P', doelstellingen: 'x', projectInfo: { versie: 1, velden: { aanleiding: 'Bestaande aanleiding' } } };

  check('zonder kolom (projectInfo ontbreekt): alleen de 6 kolomonderdelen, zoals voorheen', PI.paneelVelden(zonder).length === 6 && !PI.heeftProjectInfo(zonder));
  check('met kolom: alle 22 onderdelen, de bestaande tekst staat erin', PI.paneelVelden(met).length === 22 && PI.paneelVelden(met).find((v) => v.key === 'aanleiding').waarde === 'Bestaande aanleiding');
  check('voortgang telt mee over 22 onderdelen', PI.voortgang(met).totaal === 22 && PI.voortgang(zonder).totaal === 6);
  check('lezen: rommel valt af, lege velden worden niet bewaard, onbekende sleutels ook niet', JSON.stringify(PI.leesProjectInfo({ velden: { aanleiding: 'Ja', bereik: '', verzonnen: 'x', risicos: 5 } })) === JSON.stringify({ versie: 1, velden: { aanleiding: 'Ja' } }));
  check('opslag: project_info gaat mee naar de database als de kolom bestaat', JSON.stringify(naarKolomPatch(met).project_info) === JSON.stringify({ versie: 1, velden: { aanleiding: 'Bestaande aanleiding' } }));
  check('opslag: zonder kolom wordt project_info niet geschreven', !('project_info' in naarKolomPatch(zonder)));
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('2. Bestand kiezen, lezen en voorstellen tonen');
{
  const aanroepen = [];
  const lees = async (f, max) => { aanroepen.push(['lees', f.name, max]); return DOC; };
  const denk = async (inv) => { aanroepen.push(['denk', inv]); return { ok: true, beschikbaar: true, reden: null, voorstellen: VOORSTELLEN }; };
  const neem = [];

  await toon(<DossierUitDocument waarden={{ doelstelling: 'Mijn eigen doelstelling.' }} onNeem={(k, t) => neem.push([k, t])} lees={lees} denk={denk} />);
  check('de knop Document kiezen staat er en er wordt niets automatisch gelezen', /Document kiezen/.test(document.body.textContent) && aanroepen.length === 0);

  await kiesBestand('plan.docx');
  await wacht(() => q('dossier-voorstellen'));
  check('de tekst wordt gelezen met een ruime grens en doorgestuurd, met wat al is ingevuld', aanroepen[0][0] === 'lees' && aanroepen[0][2] > 20000 && aanroepen[1][1].huidig.join() === 'doelstelling' && aanroepen[1][1].tekst === DOC.trim());
  check('drie voorstellen met onderdeelnaam, tekst en citaat', !!q('dossier-voorstel-aanleiding') && !!q('dossier-voorstel-risicos') && /Aanleiding/.test(q('dossier-voorstel-aanleiding').textContent) && /geen plek om te spelen/.test(q('dossier-voorstel-aanleiding').textContent));
  check('lege onderdelen staan voorgevinkt, het al ingevulde onderdeel niet', q('dossier-kies-aanleiding').checked && q('dossier-kies-risicos').checked && !q('dossier-kies-doelstelling').checked);
  check('bij het ingevulde onderdeel staat dat overnemen de eigen tekst vervangt, met die tekst erbij', /vervangt uw tekst/.test(q('dossier-vervangt-doelstelling').textContent) && /Mijn eigen doelstelling/.test(q('dossier-vervangt-doelstelling').textContent) && !q('dossier-vervangt-aanleiding'));
  check('de knop noemt het aantal gekozen onderdelen', /2 onderdelen overnemen/.test(q('dossier-neem-over').textContent));

  await klik(q('dossier-kies-doelstelling'));
  check('het lid kan er een aanvinken', /3 onderdelen overnemen/.test(q('dossier-neem-over').textContent));
  await klik(q('dossier-kies-risicos'));
  await klik(q('dossier-neem-over'));
  check('alleen de gekozen onderdelen worden overgenomen, de rest niet', neem.length === 2 && neem.map((x) => x[0]).join() === 'aanleiding,doelstelling' && neem[1][1] === 'Kinderen laten groeien door muziek.');
  check('daarna staat er een bevestiging en zijn de voorstellen weg', /2 onderdelen overgenomen/.test(q('dossier-genomen').textContent) && !q('dossier-voorstellen'));
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('3. Meldingen: niets wordt overgenomen als het misgaat');
{
  const proef = async (naam, lees, denk, verwacht, detail) => {
    await toon(<DossierUitDocument waarden={{}} onNeem={() => { throw new Error('mag niet'); }} lees={lees} denk={denk} />);
    await kiesBestand(naam);
    await wacht(() => q('dossier-melding'));
    check(detail, q('dossier-melding') && q('dossier-melding').textContent === verwacht, q('dossier-melding') ? q('dossier-melding').textContent : 'geen melding');
  };
  const lees = async () => DOC;
  const klaar = (r) => async () => ({ ok: true, beschikbaar: true, reden: null, voorstellen: [], ...r });

  await proef('plan.exe', lees, klaar({}), MELDINGEN.type, 'een onbekend bestandstype wordt vriendelijk geweigerd');
  await proef('plan.pdf', async () => '', klaar({}), MELDINGEN['geen-tekst'], 'een PDF zonder tekst (gescand): uitleg en wat te doen');
  await proef('plan.docx', lees, klaar({ beschikbaar: false, reden: 'daglimiet' }), MELDINGEN.daglimiet, 'daglimiet: rustige melding');
  await proef('plan.docx', lees, klaar({ beschikbaar: false, reden: 'storing' }), MELDINGEN.storing, 'storing: rustige melding');
  await proef('plan.docx', lees, klaar({ reden: 'niets-gevonden' }), MELDINGEN['niets-gevonden'], 'niets gevonden: duidelijke melding');
  await proef('plan.docx', lees, klaar({ beschikbaar: false, reden: 'alleen-pro' }), MELDINGEN['alleen-pro'], 'Free: uitleg dat het met Pro en Premium is');

  await toon(<DossierUitDocument waarden={{}} onNeem={() => {}} lees={lees} denk={klaar({})} />);
  const groot = new window.File(['x'], 'groot.docx');
  Object.defineProperty(groot, 'size', { value: 11 * 1024 * 1024 });
  const invoer = q('dossier-bestand');
  Object.defineProperty(invoer, 'files', { value: [groot], configurable: true });
  await act(async () => { invoer.dispatchEvent(new window.Event('change', { bubbles: true })); });
  await wacht(() => q('dossier-melding'));
  check('een te groot bestand wordt geweigerd zonder het te lezen', q('dossier-melding') && q('dossier-melding').textContent === MELDINGEN.groot);

  const lang = async () => 'x'.repeat(60001);
  await toon(<DossierUitDocument waarden={{}} onNeem={() => {}} lees={lang} denk={async () => ({ ok: true, beschikbaar: true, reden: null, voorstellen: VOORSTELLEN })} />);
  await kiesBestand('lang.pdf');
  await wacht(() => q('dossier-voorstellen'));
  check('een erg lang document: het lid hoort dat alleen het begin is gelezen', !!q('dossier-afgekapt'));
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('4. Het paneel: overnemen vult het formulier, opslaan bewaart met herkomst');
{
  const opgeslagen = [];
  const project = { id: 'p-1', naam: 'Drumlessen', doelstellingen: '', projectInfo: { versie: 1, velden: {} }, bronnen: {} };
  const store = { saveProject: async (p) => { opgeslagen.push(p); return p.id; } };

  client.__reset();
  client.__zetSupabase({ functions: { invoke: async (naam, opties) => { client.log.invoke.push({ naam, modus: opties.body.mode }); return { data: { ok: true, beschikbaar: true, reden: null, voorstellen: VOORSTELLEN }, error: null }; } } });

  await toon(<ProjectinformatiePaneel projecten={[project]} projectId="p-1" onKies={() => {}} store={store} />);
  check('het blok staat in het paneel en alle 22 onderdelen zijn bewerkbaar', !!q('dossier-uit-document') && /van 22 onderdelen ingevuld/.test(q('pi-voortgang').textContent) && !!q('pi-aanleiding') && !!q('pi-risicos'));

  await kiesBestand('plan.txt', DOC);
  await wacht(() => q('dossier-voorstellen'));
  check('de echte lezer leest het tekstbestand en de server wordt aangeroepen in de modus dossier-uitlezen', client.log.invoke.length === 1 && client.log.invoke[0].modus === 'dossier-uitlezen');

  await klik(q('dossier-neem-over'));
  check('het formulier is gevuld met de overgenomen tekst', q('pi-aanleiding').value === VOORSTELLEN[0].tekst && q('pi-doelstelling').value === VOORSTELLEN[1].tekst && q('pi-risicos').value === VOORSTELLEN[2].tekst);
  check('er is nog niets opgeslagen', opgeslagen.length === 0);

  await klik(document.querySelector('button[type="submit"]'));
  await wacht(() => opgeslagen.length === 1);
  const p = opgeslagen[0];
  check('opslaan bewaart de onderdelen: kolomonderdeel in zijn eigen veld, de rest in projectInfo', p.doelstellingen === VOORSTELLEN[1].tekst && p.projectInfo.velden.aanleiding === VOORSTELLEN[0].tekst && p.projectInfo.velden.risicos === VOORSTELLEN[2].tekst);
  check('de herkomst is "uit een document" voor alle drie', p.bronnen.doelstellingen === 'upload' && p.bronnen.aanleiding === 'upload' && p.bronnen.risicos === 'upload', JSON.stringify(p.bronnen));
  check('het patch naar de database bevat project_info en field_sources', JSON.stringify(naarKolomPatch(p).project_info.velden.aanleiding) === JSON.stringify(VOORSTELLEN[0].tekst) && naarKolomPatch(p).field_sources.aanleiding === 'upload');
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('5. Zonder de kolom blijft het scherm zoals het was');
{
  const project = { id: 'p-2', naam: 'Oud', doelstellingen: 'x' };

  await toon(<ProjectinformatiePaneel projecten={[project]} projectId="p-2" onKies={() => {}} store={{ saveProject: async () => 'p-2' }} />);
  check('geen uploadblok en alleen de 6 onderdelen met een kolom', !q('dossier-uit-document') && /van 6 onderdelen ingevuld/.test(q('pi-voortgang').textContent) && !q('pi-aanleiding'));
}

// ---------------------------------------------------------------------------------------------------------------------------
sectie('6. Service');
{
  const zet = (invoke) => client.__zetSupabase({ functions: { invoke } });

  zet(async (naam, o) => ({ data: { ok: true, beschikbaar: true, reden: null, voorstellen: [...VOORSTELLEN, { key: 5 }, null, { key: 'x', tekst: '   ' }] }, error: null }));
  let r = await S.haalDossierVoorstellen({ tekst: 'abc', huidig: ['a'] });
  check('goede antwoorden komen door, rommel valt af', r.ok && r.beschikbaar && r.voorstellen.length === 3);

  zet(async () => ({ data: null, error: { message: 'boem' } }));
  r = await S.haalDossierVoorstellen({ tekst: 'abc' });
  check('fout: geen voorstellen, reden storing', !r.ok && r.reden === 'storing' && r.voorstellen.length === 0);

  zet(async () => ({ data: null, error: { context: { status: 403, json: async () => ({ reden: 'alleen-pro' }) } } }));
  r = await S.haalDossierVoorstellen({ tekst: 'abc' });
  check('403 van de server voor Free: reden alleen-pro', r.reden === 'alleen-pro');

  zet(async () => { throw new Error('netwerk'); });
  r = await S.haalDossierVoorstellen({ tekst: 'abc' });
  check('uitzondering: geen voorstellen, geen crash', !r.ok && r.voorstellen.length === 0);

  zet(async () => ({ data: { ok: true, beschikbaar: false, reden: 'daglimiet', voorstellen: [] }, error: null }));
  r = await S.haalDossierVoorstellen({ tekst: 'abc' });
  check('daglimiet komt door als reden', r.beschikbaar === false && r.reden === 'daglimiet');

  client.__zetSupabase(null);
  r = await S.haalDossierVoorstellen({ tekst: 'abc' });
  check('zonder verbinding: storing', !r.ok && r.reden === 'storing');

  check('extraheerTekst kapt af op de gevraagde grens', (await extraheerTekst(new window.File(['a'.repeat(100)], 'a.txt'), 40)).length === 40 && (await extraheerTekst(new window.File(['a'.repeat(30000)], 'a.txt'))).length === 20000);
}

console.log(`\nDOSSIER-UITLEZEN CLIENT: ${stand.ok} OK, ${stand.fout} FOUT`);
process.exit(stand.fout ? 1 : 0);
