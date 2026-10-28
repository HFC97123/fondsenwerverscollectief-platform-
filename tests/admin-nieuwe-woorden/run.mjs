// Beheer · Nieuwe woorden. Gebruik: node tests/admin-nieuwe-woorden/run.mjs (vereist esbuild en jsdom; TEST_OUT mag naar een map met jsdom)
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const hier = dirname(fileURLToPath(import.meta.url));
const root = resolve(hier, '../..');
const out = process.env.TEST_OUT || join(root, '_to_delete', 'admin-nieuwe-woorden-test');
mkdirSync(out, { recursive: true });
await build({
  entryPoints: [join(hier, 'woorden.test.jsx')], outfile: join(out, 'woorden.bundle.mjs'), bundle: true, platform: 'node', format: 'esm',
  loader: { '.js': 'jsx' }, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"test"', 'import.meta.env': '{}' }, external: ['jsdom'], logLevel: 'error', absWorkingDir: root,
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  plugins: [{ name: 'fake-client', setup(b) { b.onResolve({ filter: /\/client\.js$/ }, (a) => (a.importer.includes('/src/') ? { path: join(root, 'tests', 'checkout-frontend', 'fake-client.js') } : null)); } }],
});
const r = spawnSync(process.execPath, [join(out, 'woorden.bundle.mjs')], { stdio: 'inherit' });
process.exit(r.status ?? 1);
