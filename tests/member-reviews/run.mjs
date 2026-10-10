import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';

await build({
  entryPoints: ['tests/member-reviews/reviews.test.mjs'],
  outfile: 'tests/member-reviews/.build/reviews.test.bundle.mjs',
  bundle: true, platform: 'node', format: 'esm', loader: { '.js': 'jsx' },
  define: { 'import.meta.env': '{}' },
  logLevel: 'warning',
});
const r = spawnSync('node', ['tests/member-reviews/.build/reviews.test.bundle.mjs'], { stdio: 'inherit' });

process.exit(r.status ?? 1);
