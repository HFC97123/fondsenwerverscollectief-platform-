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

async function toon(server, tier = 'premium') {
  client.__reset();
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
  check('na het schrijven opent het concept onder Projectdocumentatie, met de melding', await wacht(() => $('[data-testid="gb-plan-open"]') && $('[data-testid="aa-plan"]') && $('[data-testid="gb-nieuw"]')) && !$('[data-testid="aa-projectplan"]'));
  check('het tabblad Projectdocumentatie is actief', $('[data-testid="documenten-tab-bestanden"]')?.getAttribute('aria-selected') === 'true');
  check('de server heeft één algemeen plan bewaard', [...S.s.tabel.values()].length === 1 && [...S.s.tabel.values()][0].soort === 'algemeen');

  await klik(knop('Sluiten'));
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
  check('de regel opent het concept opnieuw, zonder de "net geschreven"-melding', await wacht(() => $('[data-testid="aa-plan"]')) && !$('[data-testid="gb-nieuw"]') && $$('[data-testid="aa-plan-sectie"]').length === 8);
  await klik($('[data-testid="gb-naar-indienen"]'));
  check('Naar Aanvraag indienen brengt het lid terug', await wacht(() => $('[data-testid="aa-projectplan"]')) && /onder Projectdocumentatie/.test($('[data-testid="aa-plan-klaar"]').textContent));
  await klik($('[data-testid="aa-open-plan"]'));
  check('Open het projectplan op Indienen gaat naar Projectdocumentatie en opent het concept', await wacht(() => $('[data-testid="gb-plan-open"]') && $('[data-testid="aa-plan"]')) && !$('[data-testid="aa-projectplan"]'));
  await act(async () => { root.render(<div />); });
}

console.log(`\ndocumentatie-geschreven: ${stand.ok} OK, ${stand.fout} FAIL`);
process.exit(stand.fout ? 1 : 0);
