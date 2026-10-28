// Bouwt en draait de clienttests voor de dossier-uitlezen: node tests/dossier-uitlezen/client.mjs (vanuit de repo-root; vereist esbuild en jsdom)
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const hier = dirname(fileURLToPath(import.meta.url));
const root = resolve(hier, '../..');
const out = process.env.TEST_OUT || join(root, 'tests', 'dossier-uitlezen', '.build');
mkdirSync(out, { recursive: true });
const fakeClient = join(root, 'tests', 'checkout-frontend', 'fake-client.js');

await build({
  entryPoints: [join(hier, 'client.test.jsx')],
  outfile: join(out, 'client.bundle.mjs'),
  bundle: true, platform: 'node', format: 'esm', loader: { '.js': 'jsx', '.ts': 'ts' }, jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"test"', 'import.meta.env': '{}' },
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  external: ['jsdom', 'exceljs', 'docx', 'jszip', 'pdfjs-dist', 'mammoth'],
  plugins: [
    { name: 'alias-fakes', setup(b) { b.onResolve({ filter: /\/client\.js$/ }, (a) => (a.importer.includes('/src/') ? { path: fakeClient } : null)); } },
    // De PDF-lezer importeert zijn worker als '...?url' (Vite); in de test is dat een lege tekst.
    { name: 'url-stub', setup(b) { b.onResolve({ filter: /\?url$/ }, (a) => ({ path: a.path, namespace: 'url-stub' })); b.onLoad({ filter: /.*/, namespace: 'url-stub' }, () => ({ contents: "export default 'worker.js';", loader: 'js' })); } },
  ],
  logLevel: 'error',
  absWorkingDir: root,
});

const r = spawnSync(process.execPath, [join(out, 'client.bundle.mjs')], { stdio: 'inherit', env: { ...process.env, REPO_ROOT: root } });
process.exit(r.status ?? 1);
