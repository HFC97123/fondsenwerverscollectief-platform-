// Node-tests voor de server-kant van de voorstelmetadata (versie 2) en het token-/idempotentieontwerp.
//   node tests/voorstel-metadata/run.mjs   (vanuit de repo-root)
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';

await build({
  entryPoints: ['tests/voorstel-metadata/unit.test.mjs'],
  outfile: 'tests/voorstel-metadata/.build/unit.bundle.mjs',
  bundle: true, platform: 'node', format: 'esm', loader: { '.ts': 'ts' }, logLevel: 'warning',
});

const r = spawnSync('node', ['tests/voorstel-metadata/.build/unit.bundle.mjs'], { stdio: 'inherit' });

process.exit(r.status ?? 1);
