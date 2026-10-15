// Clienttests voor "Maak dekkingsplan en actieplan met Subsidiekompas" (werkmodel, service, werkruimte-component).
// Gebruik: node tests/voorstel-werkruimte/run.mjs   (vanuit de repo-root; vereist esbuild en jsdom, niet in package.json)
// De tests praten nooit met Supabase: client.js wordt vervangen door de fake van de checkout-tests.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const hier = dirname(fileURLToPath(import.meta.url));
const root = resolve(hier, '../..');
const out = process.env.TEST_OUT || join(root, '_to_delete', 'voorstel-werkruimte-test');
mkdirSync(out, { recursive: true });
const fakeClient = join(root, 'tests', 'checkout-frontend', 'fake-client.js');

await build({
  entryPoints: [join(hier, 'client.test.jsx')],
  outfile: join(out, 'client.test.bundle.mjs'),
  bundle: true, platform: 'node', format: 'esm', loader: { '.js': 'jsx' }, jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"test"' },
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  external: ['jsdom'],
  plugins: [{ name: 'alias-fakes', setup(b) { b.onResolve({ filter: /\/client\.js$/ }, (a) => (a.importer.includes('/src/') ? { path: fakeClient } : null)); } }],
  logLevel: 'error',
  absWorkingDir: root,
});

const r = spawnSync(process.execPath, [join(out, 'client.test.bundle.mjs')], { stdio: 'inherit', env: { ...process.env, REPO_ROOT: root } });
process.exit(r.status ?? 1);
