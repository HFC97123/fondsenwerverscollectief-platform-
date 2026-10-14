// Node-tests voor het actieplan (opgeslagen taken en afleiding).
//   node tests/actieplan/run.mjs   (vanuit de repo-root)
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';

let status = 0;

for (const naam of ['unit', 'samen']) {
await build({
  entryPoints: [`tests/actieplan/${naam}.test.mjs`],
  outfile: `tests/actieplan/.build/${naam}.bundle.mjs`,
  bundle: true, platform: 'node', format: 'esm', loader: { '.js': 'jsx' }, jsx: 'automatic',
  mainFields: ['browser', 'module', 'main'],
  external: ['exceljs', 'docx', 'jszip'],
  define: { 'import.meta.env': '{}' },
  banner: { js: "import {createRequire} from 'module';const require=createRequire(import.meta.url);" },
  plugins: [{ name: 'client-stub', setup(b) {
    b.onResolve({ filter: /client\.js$/ }, (a) => (a.path.endsWith('client.js') && /data|\.\.\//.test(a.path) ? { path: 'stub', namespace: 'stub' } : null));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const supabase = null; export const isConfigured = false; export async function query(fn, fb = null) { return { data: fb, error: null }; }', loader: 'js' }));
  } }],
  logLevel: 'warning',
});

const r = spawnSync('node', [`tests/actieplan/.build/${naam}.bundle.mjs`], { stdio: 'inherit' });

status = status || (r.status ?? 1);
}

process.exit(status);
