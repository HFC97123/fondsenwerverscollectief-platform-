// Component-test van de eigenaar-kaart. Gebruik: node tests/ledenlijst/eigenaar.run.mjs (vereist esbuild en jsdom)
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdirSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

const out = resolve('tests/ledenlijst/.build');
mkdirSync(out, { recursive: true });
copyFileSync('tests/ledenlijst/fake-client.mjs', `${out}/fake-client.mjs`);
const fake = resolve('tests/ledenlijst/fake-client.mjs');
await build({
  entryPoints: ['tests/ledenlijst/account.test.jsx'], outfile: `${out}/account.bundle.mjs`, bundle: true, platform: 'node', format: 'esm',
  loader: { '.js': 'jsx' }, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"test"', 'import.meta.env': '{}' }, external: ['jsdom'], logLevel: 'error',
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  plugins: [{ name: 'fake', setup(b) {
    b.onResolve({ filter: /fake-client\.mjs$/ }, () => ({ path: fake }));
    b.onResolve({ filter: /\/client\.js$/ }, () => ({ path: fake }));
  } }],
});
const r = spawnSync(process.execPath, [`${out}/account.bundle.mjs`], { stdio: 'inherit' });
process.exit(r.status ?? 1);
