// Node-tests van de profielfoto/bio-service en statische controles op migratie en code.
//   node tests/ledenprofiel/run.mjs   (vanuit de repo-root)
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

mkdirSync('tests/ledenprofiel/.build', { recursive: true });
await build({
  entryPoints: ['tests/ledenprofiel/service.test.mjs'],
  outfile: 'tests/ledenprofiel/.build/service.test.bundle.mjs',
  bundle: true, platform: 'node', format: 'esm', loader: { '.js': 'jsx' },
  define: { 'import.meta.env': '{}' },
  plugins: [{ name: 'stub', setup(b) { b.onResolve({ filter: /client\.js$/ }, () => ({ path: new URL('./stubclient.js', import.meta.url).pathname })); } }],
  logLevel: 'warning',
});
writeFileSync('tests/ledenprofiel/.build/package.json', '{"type":"module"}');
const r = spawnSync('node', ['tests/ledenprofiel/.build/service.test.bundle.mjs'], { stdio: 'inherit' });

process.exit(r.status ?? 1);
