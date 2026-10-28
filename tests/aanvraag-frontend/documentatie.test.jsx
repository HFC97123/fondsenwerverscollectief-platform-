// De echte pagina Projectdocumentatie (DocumentatiePage) in jsdom, tegen de echte serverregels met een nagebootst model: het concept projectplan,
// de begroting en het concept-dekkingsplan staan als regels in de lijst, onder de soort die erbij hoort, en tellen mee.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/#/kompas/documentatie?tab=bestanden', pretendToBeVisual: true });
const g = globalThis;
g.window = dom.window; g.document = dom.window.document;
Object.defineProperty(g, 'navigator', { value: dom.window.navigator, configurable: true });
g.HTMLElement = dom.window.HTMLElement; g.Event = dom.window.Event; g.MouseEvent = dom.window.MouseEvent;
g.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import('react')).default;
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const client = await import('../checkout-frontend/fake-client.js');
const { default: DocumentatiePage } = await import('../../src/features/kompas-app/DocumentatiePage.jsx');
const { USER, PROJECT, maakServer } = await import('./nepserver.mjs');

const stand = { ok: 0, fout: 0 };
const check = (naam, waar, detail = '') => { if (waar) stand.ok += 1; else { stand.fout += 1; console.log(`  FAIL: ${naam} ${detail}`); } };
const sectie = (t) => console.log(`\n== ${t}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const root = createRoot(document.getElementById('root'));
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const tekst = () => document.body.textContent.replace(/\s+/g, ' ');
const knop = (naam) => $$('button, a').find((b) => b.textContent.replace(/\s+/g, ' ').trim().includes(naam) || (b.getAttribute('aria-label') || '').includes(naam));
const klik = async (el) => { await act(async () => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); }); };
const typ = async (el, waarde) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(el, waarde);
    el.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
};
const wacht = async (fn, ms = 4000) => {
  const t0 = Date.now();

  while (Date.now() - t0 < ms) {
    if (fn()) return true;

    await act(async () => { await sleep(15); });
  }

  return false;
};

const project = { id: PROJECT, naam: 'Samen Spelen', gearchiveerd: false, docs: [], budgetRegels: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] };
const winkel = { projects: [project], orgProfile: { name: 'Stichting Samen Spelen' }, patch: () => {} };

const ORG_DOCS = [
  { id: 'o1', file_name: 'Jaarverslag 2025.pdf', title: null, notes: 'Jaarverslag', mime_type: 'application/pdf', storage_path: `${USER}/jaarverslag.pdf`, extracted_text: 'tekst', created_at: '2026-09-01T10:00:00Z' },
  { id: 'o2', file_name: 'ANBI-beschikking.pdf', title: null, notes: 'Overig', mime_type: 'application/pdf', storage_path: `${USER}/anbi.pdf`, extracted_text: '', created_at: '2026-09-02T10:00:00Z' },
  { id: 'o3', file_name: 'Notitie zonder bestand', title: null, notes: 'Overig', mime_type: '', storage_path: null, extracted_text: 'alleen tekst', created_at: '2026-09-03T10:00:00Z' },
];

// Een nep-tabel voor de definitieve documenten: filtert op eq/in, telt het versienummer per project en soort, en weigert Free (RLS).
function maakDefTabel({ toegestaan = true } = {}) {
  const rijen = [];
  let n = 0;

  const filter = (lijst, f) => lijst.filter((r) => f.every(([k, v, is]) => (is ? v.includes(r[k]) : r[k] === v)));
  const maak = () => {
    const st = { f: [], modus: 'select', rij: null };
    const uit = () => {
      if (st.modus === 'insert') {
        if (!toegestaan) return { data: null, error: { code: '42501' } };

        const versie = rijen.filter((r) => r.program_id === st.rij.program_id && r.soort === st.rij.soort).length + 1;
        const nieuw = { ...st.rij, id: `def${++n}`, versie, created_at: `2026-10-28T1${n}:00:00Z` };

        rijen.push(nieuw);

        return { data: { id: nieuw.id, versie }, error: null };
      }

      if (st.modus === 'delete') {
        for (const r of filter(rijen, st.f)) rijen.splice(rijen.indexOf(r), 1);

        return { error: null };
      }

      return { data: filter(rijen, st.f).slice().reverse(), error: null };
    };
    const q = {
      select: () => q,
      insert: (r) => { st.modus = 'insert'; st.rij = r; return q; },
      delete: () => { st.modus = 'delete'; return q; },
      eq: (k, v) => { st.f.push([k, v, false]); return q; },
      then: (ok, nee) => Promise.resolve(uit()).then(ok, nee),
      in: (k, v) => { st.f.push([k, v, true]); return q; },
      order: async () => uit(),
      single: async () => uit(),
      maybeSingle: async () => { const u = uit(); return { data: Array.isArray(u.data) ? u.data[0] || null : u.data, error: u.error }; },
    };

    return q;
  };

  return { rijen, maak };
}

let defTabel = maakDefTabel();

async function toon(server, tier = 'premium', orgDocs = []) {
  client.__reset();
  const van = server.supabase.from;

  server.supabase.auth = { getUser: async () => ({ data: { user: { id: USER } } }) };
  server.supabase.from = (tabel) => {
    if (tabel === 'subsidie_kompas_definitieve_documenten') return defTabel.maak();
    if (tabel !== 'subsidie_kompas_knowledge_items') return van(tabel);

    const q = { select: () => q, eq: () => q, not: () => q, order: async () => ({ data: orgDocs, error: null }) };
    q.is = () => q;

    return q;
  };
  client.__zetSupabase(server.supabase);
  globalThis.__app = { subscriptionTier: tier, isAdmin: false };
  globalThis.__store = winkel;
  window.location.hash = '#/kompas/documentatie?tab=bestanden';
  await act(async () => { root.render(<DocumentatiePage />); });
}
const chip = (soort) => $$('button[aria-pressed]').find((b) => b.textContent.replace(/\s+/g, ' ').trim().startsWith(soort));
const aantal = (soort) => { const c = chip(soort); return c ? Number(c.textContent.replace(/\D+/g, '')) : -1; };

sectie('1. Voordat er iets geschreven is: de begroting staat er, het projectplan nog niet');
{
  const S = maakServer({ tier: 'premium' });

  await toon(S);
  check('Begroting telt 1, Projectplan 0', await wacht(() => aantal('Begroting') === 1) && aantal('Projectplan') === 0);
  check('geen concept projectplan in de lijst', !$$('[data-testid="documenten-rij"]').some((r) => /Concept projectplan/.test(r.textContent)));
  await act(async () => { root.render(<div />); });
}

sectie('1b. Documenten van de hele organisatie staan bij alle projecten');
{
  const S = maakServer({ tier: 'premium' });

  await toon(S, 'premium', ORG_DOCS);
  check('de bestanden uit het organisatieprofiel staan in de lijst, zonder de notitie zonder bestand', await wacht(() => $$('[data-testid="documenten-rij"]').length === 3) && /Jaarverslag 2025/.test(tekst()) && /ANBI-beschikking/.test(tekst()) && !/Notitie zonder bestand/.test(tekst()));
  const rij = $$('[data-testid="documenten-rij"]').find((r) => /Jaarverslag 2025/.test(r.textContent));
  check('de regel zegt Hele organisatie en de soort die het lid koos, en heeft Bestand openen en een link naar het organisatieprofiel', /Hele organisatie/.test(rij.textContent) && /Jaarverslag/.test(rij.textContent) && /Bestand openen/.test(rij.textContent) && !!rij.querySelector('[data-testid="document-org-beheer"]') && !rij.querySelector('[data-testid*="verwijder"]'));
  check('het getal bij Overig telt ze mee en het tabblad ook', aantal('Overig') === 2 && /Projectdocumentatie\s*3/.test(tekst()));
  check('de kop telt de documenten en de organisatie telt niet als project', /3 documenten in 1 project/.test(tekst()));

  const kies = $('[data-testid="documenten-projectfilter"]');
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(kies, PROJECT);
    kies.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  check('ook bij een gekozen project staan de organisatiebestanden erbij', await wacht(() => $('[data-testid="documenten-projectfilter"]').value === PROJECT) && $$('[data-testid="documenten-rij"]').length >= 2 && /Jaarverslag 2025/.test(tekst()));
  await act(async () => { root.render(<div />); });
}

sectie('2. Na het schrijven: het concept projectplan staat onder Projectplan');
{
  const S = maakServer({ tier: 'premium', dekkingsplan: [{ id: 'r1' }, { id: 'r2' }] });

  await toon(S);
  check('de pagina opent op Projectdocumentatie met de filters', await wacht(() => chip('Projectplan')));
  // Schrijf het plan zoals Indienen dat doet: via de assistent van de server.
  check('het tabblad Aanvraag indienen is er (de assistent is beschikbaar)', await wacht(() => $('[data-testid="documenten-tab-plan"]')));
  await klik($('[data-testid="documenten-tab-plan"]'));
  check('tabblad Aanvraag indienen opent met het projectplan', await wacht(() => $('[data-testid="aa-projectplan"]')));
  await klik(knop('Start algemeen plan'));
  await klik(knop('Ja, schrijf het plan'));
  check('na het schrijven opent het concept onder Projectdocumentatie, met de melding', await wacht(() => $('[data-testid="gb-plan-open"]') && $('[data-testid="aa-versie-editor"]') && $('[data-testid="gb-nieuw"]')) && !$('[data-testid="aa-projectplan"]'));
  check('het tabblad Projectdocumentatie is actief', $('[data-testid="documenten-tab-bestanden"]')?.getAttribute('aria-selected') === 'true');
  check('de server heeft één algemeen plan bewaard', [...S.s.tabel.values()].length === 1 && [...S.s.tabel.values()][0].soort === 'algemeen');

  await klik(knop('Terug naar de lijst'));
  check('na sluiten staat het concept projectplan als regel in de lijst', await wacht(() => $$('[data-testid="documenten-rij"]').some((r) => /Concept projectplan/.test(r.textContent))));
  check('Projectplan telt nu 1, Begroting 1 en Dekkingsplan 1 (zonder het woord concept in de knoppen)', await wacht(() => aantal('Projectplan') === 1 && aantal('Begroting') === 1 && aantal('Dekkingsplan') === 1), `(${aantal('Projectplan')}, ${aantal('Begroting')}, ${aantal('Dekkingsplan')})`);
  check('het tabblad telt de drie geschreven documenten mee', /Projectdocumentatie\s*3/.test(tekst()));
  const rij = $$('[data-testid="documenten-rij"]').find((r) => /Concept projectplan/.test(r.textContent));
  check('de titels van de knoppen zijn Projectplan, Begroting en Dekkingsplan, zonder concept', !$$('button[aria-pressed]').some((b) => /concept/i.test(b.textContent)));
  check('de regels heten Concept projectplan, Concept begroting en Concept dekkingsplan', ['Concept projectplan', 'Concept begroting', 'Concept dekkingsplan'].every((n) => $$('[data-testid="documenten-rij"]').some((r) => r.textContent.includes(n))));
  check('de regel noemt het project, de soort en dat het een concept is, met exportmenu', /Samen Spelen/.test(rij.textContent) && /Projectplan/.test(rij.textContent) && /concept/i.test(rij.textContent) && !!rij.querySelector('[aria-label*="exporteren"]'));
  check('de regels van begroting en dekkingsplan hebben een link naar het tabblad Begroting', $$('[data-testid="gb-open-begroting"]').length === 2 && /tab=begroting&project=/.test($('[data-testid="gb-open-begroting"]').getAttribute('href')));
  check('er is geen verwijderknop bij geschreven documenten', !rij.querySelector('[data-testid*="verwijder"]'));

  await klik(chip('Projectplan'));
  check('het filter Projectplan toont alleen het concept projectplan', $$('[data-testid="documenten-rij"]').length === 1 && /Concept projectplan/.test($$('[data-testid="documenten-rij"]')[0].textContent));

  await klik($('[data-testid="gb-open-geschreven"]'));
  check('de regel opent het concept opnieuw, zonder de "net geschreven"-melding', await wacht(() => $('[data-testid="aa-versie-editor"]')) && !$('[data-testid="gb-nieuw"]') && $$('[data-testid="aa-onderdeel"]').length === 8);
  await klik($('[data-testid="gb-naar-indienen"]'));
  check('Naar Aanvraag indienen brengt het lid terug', await wacht(() => $('[data-testid="aa-projectplan"]')) && /onder Projectdocumentatie/.test($('[data-testid="aa-plan-klaar"]').textContent));
  await klik($('[data-testid="aa-open-plan"]'));
  check('Open het projectplan op Indienen gaat naar Projectdocumentatie en opent het concept', await wacht(() => $('[data-testid="gb-plan-open"]') && $('[data-testid="aa-versie-editor"]')) && !$('[data-testid="aa-projectplan"]'));
  await act(async () => { root.render(<div />); });
}

sectie('3. Maak definitief: een vaste kopie, bovenaan de lijst');
{
  const S = maakServer({ tier: 'premium', dekkingsplan: [{ id: 'r1' }, { id: 'r2' }] });

  defTabel = maakDefTabel();
  await toon(S);
  await klik($('[data-testid="documenten-tab-plan"]'));
  await wacht(() => $('[data-testid="aa-projectplan"]'));
  await klik(knop('Start algemeen plan'));
  await klik(knop('Ja, schrijf het plan'));
  await wacht(() => $('[data-testid="aa-versie-editor"]'));
  await klik(knop('Terug naar de lijst'));
  check('de concepten staan er, zonder definitieve versies', await wacht(() => aantal('Projectplan') === 1 && aantal('Begroting') === 1 && aantal('Dekkingsplan') === 1) && !$$('[data-testid="documenten-rij"]').some((r) => r.querySelector('[data-testid="definitief-verwijder"]')));

  const conceptPlan = () => $$('[data-testid="documenten-rij"]').find((r) => /Concept projectplan/.test(r.textContent));
  const conceptBegroting = () => $$('[data-testid="documenten-rij"]').find((r) => /Concept begroting/.test(r.textContent));

  check('elk concept (plan, begroting, dekkingsplan) heeft Maak definitief; de Excel staat bij begroting en dekkingsplan', $$('[data-testid="maak-definitief"]').length === 3 && $$('[data-testid="document-excel"]').length === 2 && !conceptPlan().querySelector('[data-testid="document-excel"]'));

  await klik(conceptPlan().querySelector('[data-testid="maak-definitief"]'));
  check('Maak definitief vraagt eerst om een bevestiging in de regel, zonder dat er al iets is bewaard', await wacht(() => conceptPlan().querySelector('[data-testid="maak-definitief-vraag"]')) && defTabel.rijen.length === 0 && /Wijzigingen daarna veranderen deze kopie niet/.test(conceptPlan().textContent));
  await klik(conceptPlan().querySelector('[data-testid="maak-definitief-nee"]'));
  check('Annuleren bewaart niets en zet de knop terug', !conceptPlan().querySelector('[data-testid="maak-definitief-vraag"]') && defTabel.rijen.length === 0 && !!conceptPlan().querySelector('[data-testid="maak-definitief"]'));

  await klik(conceptPlan().querySelector('[data-testid="maak-definitief"]'));
  await wacht(() => conceptPlan().querySelector('[data-testid="maak-definitief-ja"]'));
  await klik(conceptPlan().querySelector('[data-testid="maak-definitief-ja"]'));
  check('na bevestigen is er één definitief projectplan bewaard, versie 1, met het hele plan erin', await wacht(() => defTabel.rijen.length === 1) && defTabel.rijen[0].soort === 'projectplan' && defTabel.rijen[0].versie === 1 && defTabel.rijen[0].inhoud.type === 'projectplan' && defTabel.rijen[0].inhoud.plan.secties.length === 8 && defTabel.rijen[0].naam === 'Projectplan');
  check('de lijst toont het definitieve projectplan als eerste regel, zonder Concept in de naam', await wacht(() => $$('[data-testid="documenten-rij"]')[0].querySelector('[data-testid="definitief-verwijder"]')) && $$('[data-testid="documenten-rij"]')[0].querySelector('[data-testid="gb-open-geschreven"]').textContent.trim() === 'Projectplan' && /versie 1/.test($$('[data-testid="documenten-rij"]')[0].textContent));
  check('het concept blijft staan en de teller van Projectplan is 2', !!conceptPlan() && aantal('Projectplan') === 2);
  check('de definitieve regel heeft geen Maak definitief maar wel Verwijderen', !$$('[data-testid="documenten-rij"]')[0].querySelector('[data-testid="maak-definitief"]') && !!$$('[data-testid="documenten-rij"]')[0].querySelector('[data-testid="definitief-verwijder"]'));
  check('een melding zegt waar het staat', /definitief gemaakt \(versie 1\)/.test(tekst()));

  await klik(conceptPlan().querySelector('[data-testid="maak-definitief"]'));
  await wacht(() => conceptPlan().querySelector('[data-testid="maak-definitief-ja"]'));
  await klik(conceptPlan().querySelector('[data-testid="maak-definitief-ja"]'));
  check('een tweede keer geeft versie 2 en de eerste blijft bestaan', await wacht(() => defTabel.rijen.length === 2) && defTabel.rijen[1].versie === 2 && $$('[data-testid="definitief-verwijder"]').length === 2);

  await klik($$('[data-testid="documenten-rij"]')[0].querySelector('[data-testid="gb-open-geschreven"]'));
  check('de definitieve regel opent de vaste kopie, met de uitleg en zonder de "net geschreven"-melding', await wacht(() => $('[data-testid="aa-plan"]') && $('[data-testid="gb-definitief-info"]')) && !$('[data-testid="gb-nieuw"]') && /definitief/.test($('[data-testid="aa-plan-kop"]').textContent) && $$('[data-testid="aa-plan-sectie"]').length === 8);
  await klik(knop('Sluiten'));

  await klik(conceptBegroting().querySelector('[data-testid="maak-definitief"]'));
  await wacht(() => conceptBegroting().querySelector('[data-testid="maak-definitief-ja"]'));
  await klik(conceptBegroting().querySelector('[data-testid="maak-definitief-ja"]'));
  check('Begroting definitief bewaart het project (zonder documenten) en de financieringsregels', await wacht(() => defTabel.rijen.length === 3) && defTabel.rijen[2].soort === 'begroting' && defTabel.rijen[2].inhoud.project.id === PROJECT && !('docs' in defTabel.rijen[2].inhoud.project) && Array.isArray(defTabel.rijen[2].inhoud.finRegels) && defTabel.rijen[2].inhoud.finRegels.length === 2);
  check('de definitieve begroting heet Begroting, heeft een Excel en geen link naar het concept', await wacht(() => $$('[data-testid="documenten-rij"]').some((r) => r.querySelector('[data-testid="gb-definitief-naam"]'))) && !!$$('[data-testid="documenten-rij"]').find((r) => r.querySelector('[data-testid="gb-definitief-naam"]')).querySelector('[data-testid="document-excel"]'));

  // Het concept verandert, de definitieve kopie niet.
  const kopie = JSON.stringify(defTabel.rijen[2].inhoud);

  project.budgetRegels = [{ id: 'a' }];
  check('wijzigingen in het project veranderen de bewaarde kopie niet', JSON.stringify(defTabel.rijen[2].inhoud) === kopie);
  project.budgetRegels = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  const nu = defTabel.rijen.length;
  const eerste = $$('[data-testid="documenten-rij"]')[0];
  await klik(eerste.querySelector('[data-testid="definitief-verwijder"]'));
  check('Verwijderen vraagt eerst om een bevestiging', !!eerste.querySelector('[data-testid="definitief-verwijder-vraag"]') && defTabel.rijen.length === nu);
  await klik(eerste.querySelector('[data-testid="definitief-verwijder-ja"]'));
  check('na bevestigen is alleen die versie weg; het concept blijft', await wacht(() => defTabel.rijen.length === nu - 1) && !!conceptPlan() && /verwijderd/.test(tekst()));
  await act(async () => { root.render(<div />); });
}

sectie('4. Zonder Pro of Premium is er geen definitieve versie');
{
  const S = maakServer({ tier: 'premium' });

  defTabel = maakDefTabel({ toegestaan: false });
  await toon(S);
  await wacht(() => aantal('Begroting') === 1);
  const rij = $$('[data-testid="documenten-rij"]').find((r) => /Concept begroting/.test(r.textContent));

  await klik(rij.querySelector('[data-testid="maak-definitief"]'));
  await wacht(() => rij.querySelector('[data-testid="maak-definitief-ja"]'));
  await klik(rij.querySelector('[data-testid="maak-definitief-ja"]'));
  check('de database weigert het en het lid ziet een duidelijke melding, zonder dat er een regel bijkomt', await wacht(() => /hoort bij Pro en Premium/.test(tekst())) && defTabel.rijen.length === 0 && !$('[data-testid="definitief-verwijder"]'));
  await act(async () => { root.render(<div />); });
}

sectie('5. Het concept projectplan bewerken (Pro en Premium): vakken per onderdeel, opslaan, en Maak definitief neemt de eigen tekst mee');
for (const tier of ['pro', 'premium']) {
  const S = maakServer({ tier, dekkingsplan: [{ id: 'r1' }] });

  defTabel = maakDefTabel();
  await toon(S, tier);
  await klik($('[data-testid="documenten-tab-plan"]'));
  await wacht(() => $('[data-testid="aa-projectplan"]'));
  await klik(knop('Start algemeen plan'));
  await klik(knop('Ja, schrijf het plan'));
  const opent = await wacht(() => $$('[data-testid="aa-onderdeel"] textarea').length === 8);
  check(`${tier}: het concept opent met een tekstvak per onderdeel`, opent);
  check(`${tier}: de uitleg zegt dat het de eerste aanzet is en dat u de tekst zelf aanpast`, /eerste aanzet van uw projectplan/.test(tekst()) && /Pas de tekst zelf aan/.test(tekst()) && !/ontbreekt\. Wat nog ontbreekt/.test(tekst()) && /Uw projectplan voor Samen Spelen/.test($('[data-testid="aa-versie-tekst"]').textContent) && !/Uw tekst/.test($('[data-testid="aa-versie-tekst"]').textContent) && /eerste aanzet van uw projectplan/.test($('[data-testid="aa-versie-definitief"]').textContent) && !/eerste aanzet/.test($('[data-testid="aa-versie-tekst"]').textContent));
  check(`${tier}: er is een weg terug naar de lijst en naar Aanvraag indienen`, !!knop('Terug naar de lijst') && !!$('[data-testid="gb-naar-indienen"]'));
  check(`${tier}: het concept heeft Maak definitief en een exportmenu, en niet de definitieve versie van een fonds`, !!$('[data-testid="maak-definitief"]') && !!$('[aria-label="Plan exporteren"]') && !$('[aria-label="Maak definitief"]'));

  const veld = $$('[data-testid="aa-onderdeel"] textarea')[0];

  await typ(veld, 'Onze eigen aanleiding, door het lid geschreven.');
  check(`${tier}: tijdens het typen staat er "Niet opgeslagen"`, /Niet opgeslagen/.test($('[data-testid="aa-versie-opslagstatus"]').textContent));
  await klik($('[aria-label="Opslaan als versie"]'));
  check(`${tier}: opslaan maakt een versie met de eigen tekst`, await wacht(() => /Opgeslagen als versie 1/.test(tekst())) && [...S.s.versies.values()].some((v) => JSON.stringify(v.antwoorden).includes('Onze eigen aanleiding')));

  await klik($('[data-testid="maak-definitief"]'));
  await wacht(() => $('[data-testid="maak-definitief-ja"]'));
  await klik($('[data-testid="maak-definitief-ja"]'));
  check(`${tier}: Maak definitief bewaart de eigen tekst, niet de eerste tekst van de AI`, await wacht(() => defTabel.rijen.length === 1) && JSON.stringify(defTabel.rijen[0].inhoud.plan.secties[0]).includes('Onze eigen aanleiding'));
  check(`${tier}: een melding zegt dat het definitief is`, await wacht(() => $('[data-testid="gb-meld"]') && /definitief gemaakt/.test($('[data-testid="gb-meld"]').textContent)));

  await klik(knop('Terug naar de lijst'));
  check(`${tier}: de lijst toont het definitieve projectplan bovenaan`, await wacht(() => $$('[data-testid="documenten-rij"]')[0] && $$('[data-testid="documenten-rij"]')[0].querySelector('[data-testid="definitief-verwijder"]')));
  await klik($$('[data-testid="documenten-rij"]').find((r) => /Concept projectplan/.test(r.textContent)).querySelector('[data-testid="gb-open-geschreven"]'));
  check(`${tier}: het concept opent opnieuw met de bewerkte tekst`, await wacht(() => $$('[data-testid="aa-onderdeel"] textarea').length === 8) && await wacht(() => $$('[data-testid="aa-onderdeel"] textarea')[0].value.includes('Onze eigen aanleiding')));
  await act(async () => { root.render(<div />); });
}

console.log(`\ndocumentatie-geschreven: ${stand.ok} OK, ${stand.fout} FAIL`);
process.exit(stand.fout ? 1 : 0);
