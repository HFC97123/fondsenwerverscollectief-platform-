import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
const [,, entry, uit] = process.argv;
await build({ entryPoints: [entry], outfile: uit, bundle: true, platform: 'node', format: 'esm', loader: { '.ts': 'ts' }, logLevel: 'warning', plugins: [{ name: 'supabase-stub', setup(b) { b.onResolve({ filter: /^https:\/\/esm\.sh\// }, (a) => ({ path: a.path, namespace: 'stub' })); b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const createClient = (...a) => globalThis.__createClient(...a);', loader: 'js' })); } }] });
const r = spawnSync('node', [uit], { stdio: 'inherit' });
process.exit(r.status ?? 1);
