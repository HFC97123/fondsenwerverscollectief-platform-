// Tests voor Subsidieadvies (navigatie en koppelingen). Pure functies plus statische controles op de bronbestanden.
//   node tests/advies/run.mjs   (vanuit de repo-root; vereist esbuild)
import { build } from 'esbuild';
import { readFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(process.cwd());
const out = join(root, '_to_delete', 'advies-test');
mkdirSync(out, { recursive: true });
await build({ entryPoints: [join(root, 'src/features/kompas-app/advies/adviesLinks.js'), join(root, 'src/features/kompas-app/financiering/deeplinks.js')], outdir: out, bundle: true, format: 'esm', platform: 'node', outExtension: { '.js': '.mjs' }, loader: { '.js': 'jsx' }, define: { 'import.meta.env': '{}' }, logLevel: 'error',
  plugins: [{ name: 'stub', setup(b) { b.onResolve({ filter: /(projecten|gesprekUrl)\.js$/ }, (a) => (a.importer.includes('deeplinks') ? { path: a.path, namespace: 'stub' } : null)); b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => ({ contents: /projecten/.test(a.path) ? "export const isEchtId = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(String(id || ''));" : 'export const chatHref = () => "#/kompas";', loader: 'js' })); } }] });
const L = await import(pathToFileURL(join(out, 'advies', 'adviesLinks.mjs')).href);
const D = await import(pathToFileURL(join(out, 'financiering', 'deeplinks.mjs')).href);

let ok = 0;
let fail = 0;
const check = (naam, cond, extra = '') => {
  if (cond) ok += 1;
  else {
    fail += 1;
    console.log('FAIL:', naam, extra);
  }
};
const P = '11111111-1111-4111-8111-111111111111';
const src = (p) => readFileSync(join(root, p), 'utf8');

// stappen en links
check('vijf stappen: Overzicht, fondsmatching, Begroting en dekkingsplan, Actieplan, Indienen', L.STAPPEN.map((s) => s.label).join('|') === 'Overzicht|Fondsmatching|Begroting en dekkingsplan|Actieplan|Indienen');
check('overzicht linkt naar /kompas/advies', L.stapHref('overzicht', P) === `#/kompas/advies?project=${P}`);
check('Fondsmatching (fondsen) linkt naar /kompas/advies/fondsen', L.stapHref('fondsen', P) === `#/kompas/advies/fondsen?project=${P}`);
check('begroting en indienen zijn de bestaande pagina Documenten met het juiste tabblad', L.stapHref('begroting', P) === `#/kompas/documentatie?tab=begroting&project=${P}` && L.stapHref('indienen', P) === `#/kompas/documentatie?tab=inhoud&project=${P}`);
check('deadlines is de bestaande pagina Deadlines (het actieplan), met het project in de link', L.stapHref('deadlines', P) === '#/kompas/deadlines?project=' + P && L.stapHref('deadlines', '') === '#/kompas/deadlines');
check('zonder project geen lege ?project=', L.stapHref('fondsen', '') === '#/kompas/advies/fondsen' && L.stapHref('begroting', '') === '#/kompas/documentatie?tab=begroting');

// huidige stap
check('Deadlines-pad -> deadlines', L.huidigeStap('/kompas/deadlines', '#/kompas/deadlines') === 'deadlines');
check('Documenten met tab=begroting -> begroting', L.huidigeStap('/kompas/documentatie', `#/kompas/documentatie?tab=begroting&project=${P}`) === 'begroting');
check('Documenten met andere tabs -> indienen', ['inhoud', 'plan', 'aanvragen', 'bestanden'].every((t) => L.huidigeStap('/kompas/documentatie', `#/kompas/documentatie?tab=${t}`) === 'indienen') && L.huidigeStap('/kompas/documentatie', '#/kompas/documentatie') === 'indienen');
check('/kompas/advies -> overzicht; /kompas/advies/fondsen -> fondsen', L.huidigeStap('/kompas/advies', '#/kompas/advies') === 'overzicht' && L.huidigeStap('/kompas/advies', `#/kompas/advies/fondsen?project=${P}`) === 'fondsen');
check('onbekend pad -> null', L.huidigeStap('/kompas/projecten', '#/kompas/projecten') === null);

// project uit de URL
check('leesProjectParam leest ?project= (ook na andere parameters)', L.leesProjectParam(`#/x?tab=begroting&project=${P}`) === P && L.leesProjectParam('#/x') === '');
const lijst = [{ id: 'a' }, { id: 'b' }];
check('kiesProjectId: bestaand project uit de URL, anders het eerste, anders leeg', L.kiesProjectId(lijst, 'b') === 'b' && L.kiesProjectId(lijst, 'zzz') === 'a' && L.kiesProjectId([], 'b') === '');

// oude links
check('oude link ?tab=projectfinanciering wijst naar de fondsmatching', L.adviesDoorverwijzing('#/kompas/projecten/x?tab=projectfinanciering', P) === `#/kompas/advies/fondsen?project=${P}`);
check('oude link ?tab=deadlines wijst naar Deadlines', L.adviesDoorverwijzing('#/kompas/projecten/x?tab=deadlines', P) === '#/kompas/deadlines?project=' + P);
check('andere tabs worden niet doorgestuurd', L.adviesDoorverwijzing('#/kompas/projecten/x?tab=documenten', P) === null && L.adviesDoorverwijzing('#/kompas/projecten/x', P) === null);
check('deeplinks: projectfinanciering staat bij de fondsmatching; ongeldig id valt terug op Projecten', D.projectFinancieringPad(P) === `/kompas/advies/fondsen?project=${P}` && D.projectFinancieringPad('lokaal-1') === '/kompas/projecten');

// hoofdnavigatie en routes (bron)
const nav = src('src/features/kompas-app/KompasWerkNav.jsx');
const volgorde = [...nav.matchAll(/\{ key: '([a-z]+)', label: '([^']+)'/g)].map((m) => m[2]);
check('hoofdnavigatie: Dashboard, Chat, Subsidieadvies (Mijn Subsidie Kompas staat alleen rechtsboven, met Projecten in het menu)', volgorde.join('|') === 'Dashboard|Chat|Subsidieadvies' && nav.includes('href="#/kompas/projecten"'), volgorde.join('|'));
check('Deadlines en Documenten zijn geen eigen hoofditems meer maar horen bij Subsidieadvies', L.ADVIES_PADEN.includes('/kompas/deadlines') && L.ADVIES_PADEN.includes('/kompas/documentatie') && !/label: 'Deadlines'|label: 'Documenten'/.test(nav));
check('Organisatie staat onder Mijn Subsidie Kompas, niet meer in het accountmenu', /MIJN_PADEN = \['\/kompas\/projecten', '\/kompas\/organisatie'\]/.test(nav) && !/>Organisatieprofiel</.test(nav));
check('route /kompas/advies bestaat (lid)', /pad: '\/kompas\/advies', area: AREA\.app, titel: 'Subsidieadvies', toegang: 'lid'/.test(src('src/app/routes.js')));
const app = src('src/features/kompas-app/KompasApp.jsx');
check('KompasApp toont de balk van Subsidieadvies en van Mijn Subsidie Kompas alleen met de werkruimte-navigatie', /heeftWerkNav && ADVIES_PADEN\.includes\(route\.pad\) && <AdviesSubnav/.test(app) && /heeftWerkNav && MIJN_PADEN\.includes\(route\.pad\) && <MijnSubnav/.test(app));

// projectpagina en Documenten
const pd = src('src/features/kompas-app/projectdossier/ProjectDetailPage.jsx');
check('projectpagina: tabbladen Projectprofiel, Documenten, Gesprekken; geen Projectdocumentatie-blok meer', /id: 'overzicht'/.test(pd) && /id: 'documenten'/.test(pd) && /id: 'gesprekken'/.test(pd) && !/id: 'projectfinanciering', label/.test(pd) && !/id: 'deadlines', label/.test(pd) && !/overzicht-projectinformatie/.test(pd));
check('projectpagina stuurt oude tab-links door', /adviesDoorverwijzing\(huidigeHash\(\), projectId\)/.test(pd));
const dp = src('src/features/kompas-app/DocumentatiePage.jsx');
check('Documenten: kop heet Begroting en dekkingsplan of Indienen; Projectinhoud heet Projectdossier', /titel=\{sectie === 'begroting' \? 'Begroting en dekkingsplan' : 'Indienen'\}/.test(dp) && /label: 'Projectdossier'/.test(dp) && !/label: 'Projectinhoud'/.test(dp));
check('Indienen: tabbladen Projectdossier, Projectplan, Aanvragen, Bestanden in deze volgorde', dp.indexOf("label: 'Projectdossier'") < dp.indexOf("label: 'Projectplan'") && dp.indexOf("label: 'Projectplan'") < dp.indexOf("label: 'Aanvragen'") && dp.indexOf("label: 'Aanvragen'") < dp.indexOf("label: 'Bestanden'"));
check('Documenten volgt de hash (stap en project uit de balk)', /addEventListener\('hashchange', volg\)/.test(dp));
const ap = src('src/features/kompas-app/advies/AdviesPage.jsx');
check('Fondsmatching: projectgegevens met Aanpassen en + Nieuw project (zelfde formulier als Projecten), daaronder de projectfinanciering', /ProjectBewerkFormulier/.test(ap) && /advies-nieuw-project/.test(ap) && /<ProjectfinancieringTab/.test(ap));
check('geen eigen opslag in Subsidieadvies', !/localStorage|sessionStorage|\.from\(|supabase/.test(ap + src('src/features/kompas-app/advies/AdviesSubnav.jsx')));

{
  const adv = readFileSync(join(root, 'src/features/kompas-app/advies/AdviesPage.jsx'), 'utf8');
  const dl = readFileSync(join(root, 'src/features/kompas-app/DeadlinesPage.jsx'), 'utf8');
  const ap = readFileSync(join(root, 'src/features/kompas-app/financiering/ActieplanBlok.jsx'), 'utf8');

  check('kaart 3 telt de acties van het actieplan (zelfde afleiding als de actieplanpagina)', /bouwActiesEnDeadlines/.test(adv) && /useActieplan/.test(adv) && /data-testid="advies-acties"/.test(adv));
  check('de actieplanpagina begint op het project uit de link en volgt de projectkeuze', /leesProjectParam\(hash\)/.test(dl) && /startProject/.test(ap));
}

console.log(`\nadvies: ${ok} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
