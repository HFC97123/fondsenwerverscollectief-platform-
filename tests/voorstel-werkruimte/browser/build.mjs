// Bouwt de echte app (met de voorstel-vlaggen AAN) tegen een nagebootste Supabase in de browser (zelfde nep-client als tests/werkruimte/browser).
//   node tests/voorstel-werkruimte/browser/build.mjs   (vanuit de repo-root)
import { build } from 'esbuild';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cpSync, mkdirSync } from 'node:fs';

const hier = dirname(fileURLToPath(import.meta.url));
const root = resolve(hier, '../../..');
const werk = resolve(root, 'tests/werkruimte/browser');
const uit = process.env.OUT || `${hier}/web`;

await build({
  entryPoints: [`${root}/src/main.jsx`], outdir: uit, bundle: true, format: 'esm', splitting: true, platform: 'browser',
  loader: { '.js': 'jsx', '.png': 'dataurl', '.svg': 'dataurl' }, jsx: 'automatic',
  define: { 'import.meta.env.DEV': 'true', 'import.meta.env.VITE_SUPABASE_URL': '"https://x.supabase.co"', 'import.meta.env.VITE_SUPABASE_ANON_KEY': '"k"', 'import.meta.env': '{"VITE_SUBSIDIEKOMPAS_VOORSTEL":"aan","VITE_SUBSIDIEKOMPAS_VOORSTEL_SERVER":"aan"}', 'process.env.NODE_ENV': '"development"' },
  nodePaths: [`${root}/node_modules`],
  plugins: [{ name: 'fake', setup(b) {
    b.onResolve({ filter: /client\.js$/ }, (a) => (a.path.endsWith('data/client.js') || a.path === '../client.js' || a.path === '../../data/client.js' ? { path: `${werk}/fakeclient.browser.js` } : null));
    b.onResolve({ filter: /\?url$/ }, () => ({ path: 'stub', namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export default "/worker.js"', loader: 'js' }));
  } }],
  logLevel: 'warning',
});

cpSync(`${root}/node_modules/pdfjs-dist/build/pdf.worker.min.mjs`, `${uit}/worker.js`);
cpSync(`${werk}/index.html`, `${uit}/index.html`);
mkdirSync(`${uit}/uploads`, { recursive: true });
cpSync(`${root}/uploads/kompas-logo.png`, `${uit}/uploads/kompas-logo.png`);
