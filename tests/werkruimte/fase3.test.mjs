// Fase 3: node-tests voor Mijn deadlines (groepering/sortering), de gedeelde deadline-weergave, de deeplink-helper,
// de toevoeg-use-case (validatie, geen tweede insertpad) en statische controles dat verboden onderdelen
// (askKompas, Edge Function, matching, promptconstructie, documentgeneratie) niet zijn aangeraakt.
//   node tests/werkruimte/fase3.test.mjs   (vanuit de repo-root)
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { deadlineWeergave, mijnDeadlines, regelUitRpc } from '../../src/features/kompas-app/financiering/dekkingsplan.js';
import { build } from 'esbuild';
import { tmpdir } from 'node:os';
import { mkdtempSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// toevoegen.js haalt (via de service) de echte Supabase-client binnen; die heeft Vite-omgevingsvariabelen nodig.
// Voor de node-test wordt hij gebundeld met een stub-client zonder sessie: de validatiepaden komen nooit bij de database.
const uit = mkdtempSync(join(tmpdir(), 'fase3-'));
await build({
  entryPoints: ['src/features/kompas-app/financiering/toevoegen.js', 'src/features/kompas-app/financiering/deeplinks.js'], outdir: uit, outExtension: { '.js': '.mjs' }, bundle: true, format: 'esm', platform: 'node', logLevel: 'error',
  plugins: [{ name: 'stub', setup(b) { b.onResolve({ filter: /client\.js$/ }, () => ({ path: 'stub', namespace: 'stub' })); b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const supabase = null; export const query = async () => ({ data: null, error: null });', loader: 'js' })); } }],
});
const { projectFinancieringHref, projectFinancieringPad } = await import(pathToFileURL(join(uit, 'deeplinks.mjs')).href);
const { bronUitDeadlineRij, toevoegbareProjecten, voegToeAanProjectfinanciering } = await import(pathToFileURL(join(uit, 'toevoegen.mjs')).href);

let gefaald = 0;
let aantal = 0;
const check = (naam, ok, detail = '') => {
  aantal += 1;
  if (!ok) gefaald += 1;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${naam}${!ok && detail ? ` -- ${detail}` : ''}`);
};
const lees = (f) => readFileSync(f, 'utf8');
const loop = (d) => (existsSync(d) ? readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? loop(p) : [p]; }) : []);
const zonderCommentaar = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const NU = new Date(2026, 9, 11);
const P1 = '11111111-1111-4111-8111-111111111111';
const P2 = '22222222-2222-4222-8222-222222222222';
const iso = (n) => { const d = new Date(2026, 9, 11 + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const rpc = (id, extra) => regelUitRpc({ id, program_id: P1, bron_type: 'regeling', bron_status: 'zichtbaar', bron_naam: `Regeling ${id}`, funder_naam: 'Fonds', status: 'interesting', reminder_enabled: true, ...extra });

// ---- mijnDeadlines: groepen en sortering
{
  const projecten = [{ id: P1, naam: 'Project Een' }, { id: P2, naam: 'Project Twee' }, { id: 'p3', naam: 'Archief', gearchiveerd: true }];
  const per = {
    [P1]: [
      rpc('a', { effectieve_deadline: iso(40), systeem_deadline: iso(40) }),
      rpc('b', { effectieve_deadline: iso(5), systeem_deadline: iso(5) }),
      rpc('c', {}),
      rpc('d', { effectieve_deadline: iso(-3), systeem_deadline: iso(-3) }),
      rpc('e', { status: 'awarded', effectieve_deadline: iso(10), systeem_deadline: iso(10) }),
      rpc('f', { bron_status: 'verwijderd', eigen_deadline: iso(7) }),
    ],
    [P2]: [rpc('g', { effectieve_deadline: iso(5), systeem_deadline: iso(5), bron_naam: 'A-eerste' })],
    p3: [rpc('h', { effectieve_deadline: iso(1), systeem_deadline: iso(1) })],
  };
  const g = mijnDeadlines(projecten, per, NU);
  const ids = (l) => l.map((r) => r.regel.id);

  check('1: Mijn deadlines telt alleen regels uit het dekkingsplan van niet-gearchiveerde projecten', g.totaal === 7 && !ids([...g.komend, ...g.eerder, ...g.zonder]).includes('h'));
  check('2: komend gesorteerd op eerstvolgende datum, bij gelijke datum op naam', ids(g.komend).join() === 'g,b,f,a', ids(g.komend).join());
  check('2: verstreken/afgehandeld: nieuwste eerst; afgehandelde status met toekomstdatum telt niet als komend', ids(g.eerder).join() === 'e,d', ids(g.eerder).join());
  check('6: regel zonder deadline staat in aparte groep onderaan', ids(g.zonder).join() === 'c');
  check('22: verwijderde bron met eigen deadline blijft in komend, zonder brondata', g.komend.some((r) => r.regel.id === 'f' && r.regel.bronStatus === 'verwijderd' && r.regel.deadline === iso(7) && r.regel.naam === 'Bron niet meer beschikbaar'));
  check('20/21: lege invoer en project zonder regels geven lege groepen', mijnDeadlines([], {}, NU).totaal === 0 && mijnDeadlines([{ id: P2, naam: 'X' }], {}, NU).totaal === 0 && mijnDeadlines(null, null, NU).totaal === 0);
  check('20: alleen regels zonder deadline -> alles in "zonder"', (() => { const x = mijnDeadlines([{ id: P1, naam: 'X' }], { [P1]: [rpc('a', {}), rpc('b', {})] }, NU); return x.zonder.length === 2 && !x.komend.length && !x.eerder.length; })());
}

// ---- 3/4/5: effectieve deadline en weergave
{
  const eigen = rpc('x', { eigen_deadline: iso(12), systeem_deadline: iso(20), systeem_deadline_bron: 'regeling', effectieve_deadline: iso(12) });
  const w = deadlineWeergave(eigen, NU);
  check('3: eigen deadline wint van de brondatum; beide in de vergelijking ("Uw datum / Regeling")', w.datum === iso(12) && w.vergelijking && /Uw datum/.test(`Uw datum: ${w.vergelijking.eigen}`) && w.vergelijking.bronLabel === 'Regeling');
  const live = deadlineWeergave(rpc('y', { systeem_deadline: iso(9), systeem_deadline_bron: 'regeling', effectieve_deadline: iso(9) }), NU);
  check('4: zonder eigen datum geldt de live brondatum (geen opgeslagen kopie), herkomst "Datum van de regeling"', live.datum === iso(9) && live.herkomst === 'Datum van de regeling' && !live.vergelijking);
  const fonds = deadlineWeergave(rpc('z', { bron_type: 'fonds', systeem_deadline: iso(25), systeem_deadline_bron: 'fonds', effectieve_deadline: iso(25) }), NU);
  check('5: fondsdatum: herkomst "Datum van het fonds"', fonds.datum === iso(25) && fonds.herkomst === 'Datum van het fonds');
  const geen = deadlineWeergave(rpc('q', {}), NU);
  check('6: zonder deadline: geen datum, geen fout', !geen.heeftDeadline && geen.datum === null && geen.dagen === null);
  const vers = deadlineWeergave(rpc('v', { effectieve_deadline: iso(-2) }), NU);
  check('weergave: verstreken en dringend correct afgeleid', vers.verstreken && !vers.dringend && deadlineWeergave(rpc('w', { effectieve_deadline: iso(3) }), NU).dringend);
  const gemaskeerd = deadlineWeergave(regelUitRpc({ id: 'm', bron_type: 'regeling', bron_status: 'verborgen', systeem_deadline: iso(5), eigen_deadline: null, status: 'interesting' }), NU);
  check('15: gemaskeerde bron: brondatum lekt niet door (alleen eigen datum telt)', !gemaskeerd.heeftDeadline);
}

// ---- deeplink: één conventie
{
  check('18: deeplink-pad = /kompas/projecten/<id>?tab=projectfinanciering', projectFinancieringPad(P1) === `/kompas/projecten/${P1}?tab=projectfinanciering` && projectFinancieringHref(P1) === `#/kompas/projecten/${P1}?tab=projectfinanciering`);
  check('18: ongeldig id (geen uuid, geen padinjectie) valt terug op het projectenoverzicht', projectFinancieringPad('../x?tab=1') === '/kompas/projecten' && projectFinancieringPad(null) === '/kompas/projecten' && projectFinancieringPad('abc') === '/kompas/projecten');
  const bronnen = ['src/features/kompas-app/dashboard/DashboardPage.jsx', 'src/features/kompas-app/ProjectenPage.jsx', 'src/features/kompas-app/deadlines/FundingDeadlineRow.jsx', 'src/features/kompas-app/deadlines/AddToProjectFundingDialog.jsx'];
  check('18: Dashboard, Projecten, Mijn deadlines en dialoog gebruiken de helper, geen eigen ?tab=-string', bronnen.every((f) => /projectFinancieringHref/.test(lees(f)) && !/tab=projectfinanciering/.test(zonderCommentaar(lees(f)))));
}

// ---- use-case: bron en project
{
  const veilig = { id: 'b0000000-0000-4000-8000-000000000001', naam: 'Regeling', volledigZichtbaar: true, funder: 'F' };
  check('7: zichtbare regeling -> bron {type regeling, id, naam}', JSON.stringify(bronUitDeadlineRij(veilig)) === JSON.stringify({ type: 'regeling', id: veilig.id, naam: 'Regeling', funder: 'F' }));
  const fonds = { id: 'd0000000-0000-4000-8000-000000000001', bronType: 'funder', funderId: 'e0000000-0000-4000-8000-000000000001', naam: 'Fonds', volledigZichtbaar: true };
  const bf = bronUitDeadlineRij(fonds);
  check('13: fondskaart -> bron {type fonds, funderId} (niet het datamoment-id), geen verzonnen regeling, geen verstrekkernaam', bf && bf.type === 'fonds' && bf.id === fonds.funderId && bf.funder === '');
  check('14: vergrendelde rij (Premium buiten abonnement) levert geen bron op', bronUitDeadlineRij({ ...veilig, volledigZichtbaar: false }) === null && bronUitDeadlineRij({ ...fonds, volledigZichtbaar: false }) === null);
  check('bron: rij zonder uuid (bijv. via Beheer toegevoegd) of null levert geen bron op', bronUitDeadlineRij({ ...veilig, id: 'nep-1' }) === null && bronUitDeadlineRij(null) === null && bronUitDeadlineRij({ ...fonds, funderId: null }) === null);
  const mijn = [{ id: P1, naam: 'A' }, { id: P2, naam: 'B', gearchiveerd: true }, { id: 'tmp-1', naam: 'Niet opgeslagen' }];
  check('9: alleen niet-gearchiveerde, opgeslagen projecten zijn kiesbaar', toevoegbareProjecten(mijn).map((p) => p.id).join() === P1);
  const bron = { type: 'regeling', id: veilig.id, naam: 'R' };
  check('8: project buiten de eigen kiesbare lijst (ander lid / gearchiveerd) wordt geweigerd vóór er iets de database in gaat', (await voegToeAanProjectfinanciering({ projectId: '99999999-9999-4999-8999-999999999999', bron, projecten: mijn })).reden === 'geen-project' && (await voegToeAanProjectfinanciering({ projectId: P2, bron, projecten: mijn })).reden === 'geen-project');
  check('use-case: ongeldige bron en ongeldig bedrag worden geweigerd', (await voegToeAanProjectfinanciering({ projectId: P1, bron: { type: 'regeling', id: 'x' }, projecten: mijn })).reden === 'geen-bron' && (await voegToeAanProjectfinanciering({ projectId: P1, bron: { type: 'iets', id: veilig.id }, projecten: mijn })).reden === 'geen-bron' && (await voegToeAanProjectfinanciering({ projectId: P1, bron, bedragTekst: '12abc', projecten: mijn })).reden === 'ongeldig-bedrag');
}

// ---- statische controles
{
  const dl = lees('src/features/kompas-app/DeadlinesPage.jsx');
  const dlCode = zonderCommentaar(dl);
  check('geen tweede insertlogica: DeadlinesPage schrijft niet zelf naar de database en kent voegRegelToe niet', !/voegRegelToe|\.insert\(|supabase|from\('subsidie_kompas_program_funding'\)/.test(dlCode));
  const bestanden = loop('src/features/kompas-app').filter((f) => /\.(js|jsx)$/.test(f));
  const metInsert = bestanden.filter((f) => /voegRegelToe/.test(zonderCommentaar(lees(f)))).map((f) => f.replace(/\\/g, '/'));
  check('geen tweede insertpad: voegRegelToe wordt alleen door financiering/toevoegen.js aangeroepen', metInsert.join() === 'src/features/kompas-app/financiering/toevoegen.js', metInsert.join());
  const nieuw = ['src/features/kompas-app/deadlines/MijnDeadlines.jsx', 'src/features/kompas-app/deadlines/FundingDeadlineRow.jsx', 'src/features/kompas-app/deadlines/AddToProjectFundingDialog.jsx', 'src/features/kompas-app/financiering/toevoegen.js', 'src/features/kompas-app/financiering/deeplinks.js'];
  check('geen localStorage/sessionStorage in de nieuwe Fase 3-bestanden (alleen id\'s in state)', nieuw.every((f) => !/localStorage|sessionStorage|indexedDB/.test(zonderCommentaar(lees(f)))));
  check('Bespreek met Subsidiekompas: alleen navigatie naar de bestaande Chat (goKompas), geen chatverzoek met fondsdata, geen askKompas/functions.invoke', /data-testid="detail-bespreek"[\s\S]{0,80}onClick=\{app\.goKompas\}/.test(dl) && !/zetChatVerzoek|askKompas|functions\.invoke|buildProjectFundingContext/.test(dlCode));
  check('Free: Deadlines-pagina haalt zelf geen dekkingsplannen op; Mijn deadlines en dialoog alleen voor betalende tiers', /\{paid && segment === 'mijn' &&/.test(dl) && /\{addBron && paid &&/.test(dl) && /\{paid && bronUitDeadlineRij\(detail\)/.test(dl) && /\{!paid && detail\.bronType !== 'funder'/.test(dl));
  check('entitlement: geen nieuwe entitlementlogica (geen tier-/premium-vergelijking in de nieuwe bestanden behalve de bestaande getDeadlineAccess)', nieuw.every((f) => !/subscriptionTier|current_user_has|subsidie_zichtbaar_voor_tier|premium_exclusive/.test(zonderCommentaar(lees(f)))));
  check('reminders: alleen de vlag reminder_enabled; geen e-mail/cron/push/functions in de nieuwe bestanden', [...nieuw, 'src/features/kompas-app/financiering/FinancieringUi.jsx'].every((f) => !/mailto|sendgrid|resend|cron|pushManager|Notification\(|functions\.invoke|setInterval|setTimeout/.test(zonderCommentaar(lees(f)))));
  const verboden = ['supabase/functions/subsidie-kompas/index.ts', 'src/features/kompas-app/KompasToolPage.jsx', 'src/features/kompas-app/useKompasApp.js'];
  const nieuweBron = /mijnDeadlines|toevoegen\.js|deeplinks\.js|AddToProjectFundingDialog|MijnDeadlines/;
  check('verboden onderdelen (askKompas/Edge Function/chatpagina/useApp) verwijzen niet naar Fase 3-code', verboden.every((f) => !nieuweBron.test(lees(f))));
  const matching = [...loop('src/data'), ...loop('src/shared')].filter((f) => /\.(js|jsx|ts)$/.test(f));
  check('matching/fondsadvies/export/documentgeneratie gebruiken geen Fase 3-code', matching.every((f) => !nieuweBron.test(zonderCommentaar(lees(f)))));
  check('geen migratie, geen Edge Function-wijziging, geen secrets in Fase 3-bestanden', loop('supabase/migrations').filter((f) => f.endsWith('.sql')).every((f) => !/Fase 3/i.test(lees(f))) && nieuw.every((f) => !/sk_live_|whsec_|sk_test_/.test(lees(f))));
  check('Mijn deadlines gebruikt useDekkingsplannen/mijnDeadlines (één bron, één rekenmodule)', /useDekkingsplannen/.test(lees('src/features/kompas-app/deadlines/MijnDeadlines.jsx')) && /mijnDeadlines\(/.test(lees('src/features/kompas-app/deadlines/MijnDeadlines.jsx')));
  check('Projectfinanciering-tab gebruikt dezelfde DeadlineWeergave/HerinneringKnop als Mijn deadlines', /DeadlineWeergave/.test(lees('src/features/kompas-app/projectdossier/ProjectfinancieringTab.jsx')) && /DeadlineWeergave/.test(lees('src/features/kompas-app/deadlines/FundingDeadlineRow.jsx')) && /HerinneringKnop/.test(lees('src/features/kompas-app/projectdossier/ProjectfinancieringTab.jsx')) && /HerinneringKnop/.test(lees('src/features/kompas-app/deadlines/FundingDeadlineRow.jsx')));
}

console.log(`\n${aantal - gefaald}/${aantal} geslaagd`);
process.exit(gefaald ? 1 : 0);
