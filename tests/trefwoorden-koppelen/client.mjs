// Bouwt en draait de clienttests voor de trefwoorden-koppelen: node tests/trefwoorden-koppelen/client.mjs (vanuit de repo-root; vereist esbuild en jsdom)
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const hier = dirname(fileURLToPath(import.meta.url));
const root = resolve(hier, '../..');
const out = process.env.TEST_OUT || join(root, 'tests', 'trefwoorden-koppelen', '.build');
mkdirSync(out, { recursive: true });
const fakeClient = join(root, 'tests', 'checkout-frontend', 'fake-client.js');

await build({
  entryPoints: [join(hier, 'client.test.jsx')],
  outfile: join(out, 'client.bundle.mjs'),
  bundle: true, platform: 'node', format: 'esm', loader: { '.js': 'jsx', '.ts': 'ts' }, jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"test"', 'import.meta.env': '{}' },
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  external: ['jsdom', 'exceljs', 'docx', 'jszip'],
  plugins: [{ name: 'alias-fakes', setup(b) { b.onResolve({ filter: /\/client\.js$/ }, (a) => (a.importer.includes('/src/') ? { path: fakeClient } : null)); } }],
  logLevel: 'error',
  absWorkingDir: root,
});

const r = spawnSync(process.execPath, [join(out, 'client.bundle.mjs')], { stdio: 'inherit', env: { ...process.env, REPO_ROOT: root } });
process.exit(r.status ?? 1);
