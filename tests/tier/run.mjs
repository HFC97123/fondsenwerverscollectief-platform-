// Draait de tests van de tierconfiguratie, de dekkingsmix en de kostenmeter (TIER-1 en TIER-2).
//   node tests/tier/run.mjs   (vanuit de repo-root)
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';

const bestanden = ['tierconfig', 'dekkingsmix', 'serviceclubs', 'gebruik', 'prijzen'];
let status = 0;

for (const b of bestanden) {
  await build({
    entryPoints: [`tests/tier/${b}.test.mjs`],
    outfile: `tests/tier/.build/${b}.bundle.mjs`,
    bundle: true, platform: 'node', format: 'esm', loader: { '.ts': 'ts' }, logLevel: 'warning',
  });

  const r = spawnSync('node', [`tests/tier/.build/${b}.bundle.mjs`], { stdio: 'inherit' });

  status = status || (r.status ?? 1);
}

process.exit(status);
