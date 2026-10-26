// Organisatieprofiel: pop-up met documentsoorten en automatisch invullen na uploaden.
// Gebruik: node tests/organisatieprofiel/run.mjs (vereist esbuild en jsdom, niet in package.json; TEST_OUT mag naar een map met jsdom)
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const hier = dirname(fileURLToPath(import.meta.url));
const root = resolve(hier, '../..');
const out = process.env.TEST_OUT || join(root, '_to_delete', 'organisatieprofiel-test');
mkdirSync(out, { recursive: true });
const f = (n) => join(hier, 'fakes', n);
const vervang = { 'useKompasApp.js': f('app.js'), 'KompasStore.jsx': f('store.jsx'), 'chat.js': f('services.js'), 'documentExtractie.js': f('services.js'), 'organisatiedocumenten.js': f('services.js'), 'organisatieprofiel.js': f('services.js') };

await build({
  entryPoints: [join(hier, 'pagina.test.jsx')], outfile: join(out, 'pagina.bundle.mjs'), bundle: true, platform: 'node', format: 'esm',
  loader: { '.js': 'jsx' }, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"test"', 'import.meta.env': '{}' }, external: ['jsdom'], logLevel: 'error', absWorkingDir: root,
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  plugins: [{ name: 'fakes', setup(b) { b.onResolve({ filter: /\/(useKompasApp\.js|KompasStore\.jsx|chat\.js|documentExtractie\.js|organisatiedocumenten\.js|organisatieprofiel\.js)$/ }, (a) => (a.importer.includes('/src/') ? { path: vervang[a.path.split('/').pop()] } : null)); b.onResolve({ filter: /\/client\.js$/ }, (a) => (a.importer.includes('/src/') ? { path: join(root, 'tests', 'checkout-frontend', 'fake-client.js') } : null)); } }],
});

const r = spawnSync(process.execPath, [join(out, 'pagina.bundle.mjs')], { stdio: 'inherit' });
process.exit(r.status ?? 1);
