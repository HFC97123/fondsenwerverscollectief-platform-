import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
const root = process.cwd();
const out = join(root, 'tests', 'begroting', '.build');

await build({ absWorkingDir: root, entryPoints: ['tests/begroting/upload.test.mjs'], outfile: join(out, 'upload.bundle.mjs'), bundle: true, platform: 'node', format: 'esm', loader: { '.ts': 'ts' }, logLevel: 'error' });
const r = spawnSync('node', [join(out, 'upload.bundle.mjs')], { stdio: 'inherit', cwd: root });
process.exit(r.status ?? 1);
