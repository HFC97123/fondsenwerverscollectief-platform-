// Draait de export-tests (Word/PDF/Excel/modellen/bestandsnamen) in Node:
//   node tests/export/run.mjs      (vanuit de repo-root; vereist npm install)
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';

await build({
  entryPoints: ['tests/export/export.test.mjs'],
  outfile: 'tests/export/.build/export.test.bundle.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  loader: { '.js': 'jsx' },
  mainFields: ['browser', 'module', 'main'],
  external: ['exceljs', 'docx', 'jszip'],
  define: { 'import.meta.env': '{}' },
  banner: { js: "import {createRequire} from 'module';const require=createRequire(import.meta.url);" },
  logLevel: 'warning',
});

const r = spawnSync('node', ['tests/export/.build/export.test.bundle.mjs'], { stdio: 'inherit' });

process.exit(r.status ?? 1);
