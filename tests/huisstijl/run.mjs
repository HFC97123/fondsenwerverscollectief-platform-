// Draait de huisstijltests (eigen thema, Word/PDF/Excel met eigen logo en kleuren, opslag en rechten) in Node:
//   node tests/huisstijl/run.mjs      (vanuit de repo-root)
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const fakeClient = join(process.cwd(), 'tests', 'checkout-frontend', 'fake-client.js');

await build({
  entryPoints: ['tests/huisstijl/huisstijl.test.mjs'],
  outfile: 'tests/huisstijl/.build/huisstijl.test.bundle.mjs',
  bundle: true, platform: 'node', format: 'esm', loader: { '.js': 'jsx' }, mainFields: ['browser', 'module', 'main'],
  external: ['exceljs', 'docx', 'jszip'],
  define: { 'import.meta.env': '{}' },
  banner: { js: "import {createRequire} from 'module';const require=createRequire(import.meta.url);" },
  plugins: [{ name: 'alias-fakes', setup(b) { b.onResolve({ filter: /\/client\.js$/ }, (a) => (a.importer.includes('/src/') ? { path: fakeClient } : null)); } }],
  logLevel: 'warning',
});

let status = spawnSync('node', ['tests/huisstijl/.build/huisstijl.test.bundle.mjs'], { stdio: 'inherit' }).status ?? 1;

// Het paneel zelf, in jsdom.
await build({
  entryPoints: ['tests/huisstijl/ui.test.jsx'],
  outfile: 'tests/huisstijl/.build/ui.bundle.mjs',
  bundle: true, platform: 'node', format: 'esm', loader: { '.js': 'jsx' }, jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"test"', 'import.meta.env': '{}' },
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  external: ['jsdom', 'exceljs', 'docx', 'jszip', 'pdfjs-dist', 'mammoth'],
  plugins: [
    { name: 'alias-fakes', setup(b) { b.onResolve({ filter: /\/client\.js$/ }, (a) => (a.importer.includes('/src/') ? { path: fakeClient } : null)); } },
    { name: 'url-stub', setup(b) { b.onResolve({ filter: /\?url$/ }, (a) => ({ path: a.path, namespace: 'url-stub' })); b.onLoad({ filter: /.*/, namespace: 'url-stub' }, () => ({ contents: "export default 'worker.js';", loader: 'js' })); } },
  ],
  logLevel: 'error',
});

await build({
  entryPoints: ['tests/huisstijl/uitdocument.test.mjs'],
  outfile: 'tests/huisstijl/.build/uitdocument.bundle.mjs',
  bundle: true, platform: 'node', format: 'esm', loader: { '.js': 'jsx' }, mainFields: ['browser', 'module', 'main'],
  external: ['jszip', 'pdfjs-dist'],
  define: { 'import.meta.env': '{}' },
  banner: { js: "import {createRequire} from 'module';const require=createRequire(import.meta.url);" },
  plugins: [
    { name: 'alias-fakes', setup(b) { b.onResolve({ filter: /\/client\.js$/ }, (a) => (a.importer.includes('/src/') ? { path: fakeClient } : null)); } },
    { name: 'url-stub', setup(b) { b.onResolve({ filter: /\?url$/ }, (a) => ({ path: a.path, namespace: 'url-stub' })); b.onLoad({ filter: /.*/, namespace: 'url-stub' }, () => ({ contents: "export default 'worker.js';", loader: 'js' })); } },
  ],
  logLevel: 'error',
});

status = status || (spawnSync('node', ['tests/huisstijl/.build/uitdocument.bundle.mjs'], { stdio: 'inherit' }).status ?? 1);

status = status || (spawnSync('node', ['tests/huisstijl/.build/ui.bundle.mjs'], { stdio: 'inherit' }).status ?? 1);

process.exit(status);
