// Node-tests voor de client-kant van de voorstelpreview.   node tests/voorstel-preview/run-client.mjs   (vanuit de repo-root)
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';

await build({
  entryPoints: ['tests/voorstel-preview/client.test.mjs'],
  outfile: 'tests/voorstel-preview/.build/client.bundle.mjs',
  bundle: true, platform: 'node', format: 'esm', loader: { '.js': 'jsx' }, jsx: 'automatic',
  mainFields: ['browser', 'module', 'main'],
  define: { 'import.meta.env': '{}' },
  banner: { js: "import {createRequire} from 'module';const require=createRequire(import.meta.url);" },
  plugins: [{ name: 'client-stub', setup(b) {
    b.onResolve({ filter: /client\.js$/ }, (a) => (/data|\.\.\//.test(a.path) ? { path: 'stub', namespace: 'stub' } : null));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const supabase = null; export const isConfigured = false;', loader: 'js' }));
  } }],
  logLevel: 'warning',
});

const r = spawnSync('node', ['tests/voorstel-preview/.build/client.bundle.mjs'], { stdio: 'inherit' });

process.exit(r.status ?? 1);
