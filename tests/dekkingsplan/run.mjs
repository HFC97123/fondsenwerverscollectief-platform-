// Node-tests voor het Dekkingsplan (Gepland, Nog te plannen, percentages) en het afgeleide Actieplan.
//   node tests/dekkingsplan/run.mjs   (vanuit de repo-root)
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';

await build({
  entryPoints: ['tests/dekkingsplan/unit.test.mjs'],
  outfile: 'tests/dekkingsplan/.build/unit.bundle.mjs',
  bundle: true, platform: 'node', format: 'esm', loader: { '.js': 'jsx' }, jsx: 'automatic',
  mainFields: ['browser', 'module', 'main'],
  define: { 'import.meta.env': '{}' },
  logLevel: 'warning',
});
const r = spawnSync('node', ['tests/dekkingsplan/.build/unit.bundle.mjs'], { stdio: 'inherit' });
process.exit(r.status === null ? 1 : r.status);
