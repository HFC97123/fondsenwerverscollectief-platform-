// Draait de ECHTE handler van subsidie-kompas/index.ts (gebundeld, mét de dynamisch geïmporteerde _shared-modules) tegen een
// nagebootste database, DNS en webserver. Doel: mode 'voorstel-preview' (Fase C) bewijzen, en bewijzen dat hij nergens naartoe schrijft.
//   node tests/voorstel-preview/run.mjs   (vanuit de repo-root)
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';

await build({
  entryPoints: ['tests/voorstel-preview/preview.test.mjs'],
  outfile: 'tests/voorstel-preview/.build/preview.bundle.mjs',
  bundle: true, platform: 'node', format: 'esm', loader: { '.ts': 'ts' }, logLevel: 'warning',
  plugins: [{
    name: 'supabase-stub',
    setup(b) {
      b.onResolve({ filter: /^https:\/\/esm\.sh\// }, (a) => ({ path: a.path, namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const createClient = (...a) => globalThis.__createClient(...a);', loader: 'js' }));
    },
  }],
});

const r = spawnSync('node', ['tests/voorstel-preview/.build/preview.bundle.mjs'], { stdio: 'inherit' });

process.exit(r.status ?? 1);
