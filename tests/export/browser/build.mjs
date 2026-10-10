// Bouwt de echte app tegen een nagebootste Supabase (fakeclient.browser.js) voor de browsertests.
//   node tests/export/browser/build.mjs   (vanuit de repo-root)
import { build } from 'esbuild';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cpSync, mkdirSync } from 'node:fs';

const hier = dirname(fileURLToPath(import.meta.url));
const root = resolve(hier, '../../..');
const fake = resolve(hier, 'fakeclient.browser.js');

await build({
  entryPoints: [`${root}/src/main.jsx`], outdir: `${hier}/web`, bundle: true, format: 'esm', splitting: true, platform: 'browser',
  loader: { '.js': 'jsx', '.png': 'dataurl', '.svg': 'dataurl' }, jsx: 'automatic',
  define: { 'import.meta.env.DEV': 'true', 'import.meta.env.VITE_SUPABASE_URL': '"https://x.supabase.co"', 'import.meta.env.VITE_SUPABASE_ANON_KEY': '"k"', 'import.meta.env': '{}', 'process.env.NODE_ENV': '"development"' },
  nodePaths: [`${root}/node_modules`],
  plugins: [{ name: 'fake', setup(b) {
    b.onResolve({ filter: /client\.js$/ }, (a) => (a.path.endsWith('data/client.js') || a.path === '../client.js' || a.path === '../../data/client.js' ? { path: fake } : null));
    b.onResolve({ filter: /\?url$/ }, () => ({ path: 'stub', namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export default "/worker.js"', loader: 'js' }));
  } }],
  logLevel: 'warning',
});

cpSync(`${hier}/index.html`, `${hier}/web/index.html`);
mkdirSync(`${hier}/web/uploads`, { recursive: true });
cpSync(`${root}/uploads/kompas-logo.png`, `${hier}/web/uploads/kompas-logo.png`);
