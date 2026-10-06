// Bouwt en draait de frontend-tests voor de aansluiting op Stripe Checkout
// (fase 2D). Gebruik: node tests/checkout-frontend/run.mjs
// Vereist (niet in package.json): npm i --no-save esbuild jsdom
// De tests praten NOOIT met Stripe of Supabase: client.js en useKompasApp.js
// worden vervangen door fakes (zie fakes.js).
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const hier = dirname(fileURLToPath(import.meta.url));
const root = resolve(hier, '../..');
// Uitvoermap: de (gitignorede) _to_delete/ van de repo, zodat jsdom daar via node_modules gevonden wordt.
const out = process.env.TEST_OUT || join(root, '_to_delete', 'checkout-frontend-test');
mkdirSync(out, { recursive: true });

const fakes = {
  client: join(hier, 'fake-client.js'),
  app: join(hier, 'fake-app.js'),
};

const alias = {
  name: 'alias-fakes',
  setup(b) {
    b.onResolve({ filter: /\/client\.js$/ }, (a) => (a.importer.includes('/src/') ? { path: fakes.client } : null));
    b.onResolve({ filter: /useKompasApp\.js$/ }, () => ({ path: fakes.app }));
  },
};

await build({
  entryPoints: [join(hier, 'checkout.test.mjs')],
  outfile: join(out, 'checkout.test.bundle.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  loader: { '.js': 'jsx' },
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"test"' },
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  external: ['jsdom'],
  plugins: [alias],
  logLevel: 'error',
  absWorkingDir: root,
});

const r = spawnSync(process.execPath, [join(out, 'checkout.test.bundle.mjs')], { stdio: 'inherit', env: { ...process.env, REPO_ROOT: root } });
process.exit(r.status ?? 1);
