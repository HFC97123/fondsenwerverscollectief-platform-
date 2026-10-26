// Clienttests voor de keuzekaart in de chat (FondsMatchKaart): Toevoegen / Niet / Meer info en daarna pas de actieplan-vraag.
// Gebruik: node tests/fase5/kaart.run.mjs   (vanuit de repo-root; vereist esbuild en jsdom, niet in package.json; TEST_OUT mag naar een map met jsdom)
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const hier = dirname(fileURLToPath(import.meta.url));
const root = resolve(hier, '../..');
const out = process.env.TEST_OUT || join(root, '_to_delete', 'fase5-kaart-test');
mkdirSync(out, { recursive: true });
const fake = (n) => join(hier, 'fakes', n);

await build({
  entryPoints: [join(hier, 'kaart.test.jsx')],
  outfile: join(out, 'kaart.test.bundle.mjs'),
  bundle: true, platform: 'node', format: 'esm', loader: { '.js': 'jsx' }, jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"test"' },
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  external: ['jsdom'],
  plugins: [{
    name: 'fakes',
    setup(b) {
      b.onResolve({ filter: /\/projectFinanciering\.js$/ }, (a) => (a.importer.includes('/src/') || a.importer.includes('kaart.test') ? { path: fake('projectFinanciering.js') } : null));
      b.onResolve({ filter: /\/voorstelGenereren\.js$/ }, (a) => (a.importer.includes('/src/') || a.importer.includes('kaart.test') ? { path: fake('voorstelGenereren.js') } : null));
      b.onResolve({ filter: /\/client\.js$/ }, (a) => (a.importer.includes('/src/') ? { path: join(root, 'tests', 'checkout-frontend', 'fake-client.js') } : null));
    },
  }],
  logLevel: 'error',
  absWorkingDir: root,
});

const r = spawnSync(process.execPath, [join(out, 'kaart.test.bundle.mjs')], { stdio: 'inherit' });
process.exit(r.status ?? 1);
