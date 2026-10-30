// Beheer · omvang en privé-vlaggen per fonds. Gebruik: node tests/admin-funder-velden/run.mjs
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const hier = dirname(fileURLToPath(import.meta.url));
const root = resolve(hier, '../..');
const out = process.env.TEST_OUT || join(root, '_to_delete', 'admin-funder-velden-test');
mkdirSync(out, { recursive: true });
const fake = join(out, 'client.js');
writeFileSync(fake, `export const calls = []; export let antwoord = () => ({ data: null, error: null });
export const zetAntwoord = (f) => { antwoord = f; };
export async function query(fn) { const sb = { rpc: async (naam, args) => { calls.push({ naam, args }); return antwoord(naam, args); } }; return fn(sb); }
`);
await build({
  entryPoints: [join(hier, 'velden.test.mjs')], outfile: join(out, 'velden.bundle.mjs'), bundle: true, platform: 'node', format: 'esm', logLevel: 'error', absWorkingDir: root,
  plugins: [{ name: 'fake', setup(b) { b.onResolve({ filter: /client\.js$/ }, (a) => ({ path: fake })); } }],
});
const r = spawnSync(process.execPath, [join(out, 'velden.bundle.mjs')], { stdio: 'inherit' });
process.exit(r.status ?? 1);
