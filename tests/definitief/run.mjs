// Draait de definitieftests (eigen thema, Word/PDF/Excel met eigen logo en kleuren, opslag en rechten) in Node:
//   node tests/definitief/run.mjs      (vanuit de repo-root)
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const fakeClient = join(process.cwd(), 'tests', 'checkout-frontend', 'fake-client.js');

await build({
  entryPoints: ['tests/definitief/definitief.test.mjs'],
  outfile: 'tests/definitief/.build/definitief.test.bundle.mjs',
  bundle: true, platform: 'node', format: 'esm', loader: { '.js': 'jsx' }, mainFields: ['browser', 'module', 'main'],
  external: ['exceljs', 'docx', 'jszip'],
  define: { 'import.meta.env': '{}' },
  banner: { js: "import {createRequire} from 'module';const require=createRequire(import.meta.url);" },
  plugins: [{ name: 'alias-fakes', setup(b) { b.onResolve({ filter: /\/client\.js$/ }, (a) => (a.importer.includes('/src/') ? { path: fakeClient } : null)); } }],
  logLevel: 'warning',
});

const status = spawnSync('node', ['tests/definitief/.build/definitief.test.bundle.mjs'], { stdio: 'inherit' }).status ?? 1;

process.exit(status);
