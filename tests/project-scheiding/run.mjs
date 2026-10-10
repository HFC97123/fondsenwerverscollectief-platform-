// Draait de tests voor de scheiding organisatie / project / document.
// Gebruik: node tests/project-scheiding/run.mjs
// Vereist (niet in package.json): npm i --no-save esbuild jsdom
// Praat NOOIT met Supabase: src/data/client.js wordt vervangen door een nep-database
// met RLS- en foreign-key-gedrag (fakeclient.js).
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const hier = dirname(fileURLToPath(import.meta.url));
const root = process.env.REPO_ROOT ? resolve(process.env.REPO_ROOT) : resolve(hier, '../..');
const out = process.env.TEST_OUT || join(root, '_to_delete', 'project-scheiding-test');
mkdirSync(out, { recursive: true });

await build({
  entryPoints: {
    store: join(root, 'src/features/kompas-app/KompasStore.jsx'),
    projecten: join(root, 'src/data/services/projecten.js'),
    koppeling: join(root, 'src/features/kompas-app/projectKoppeling.js'),
    chat: join(root, 'src/data/services/chat.js'),
    gesprekken: join(root, 'src/data/services/gesprekken.js'),
  },
  outdir: out,
  bundle: true,
  platform: 'node',
  format: 'esm',
  outExtension: { '.js': '.mjs' },
  loader: { '.js': 'jsx' },
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"test"', 'import.meta.env.VITE_SUPABASE_URL': '"http://fake"', 'import.meta.env.VITE_SUPABASE_ANON_KEY': '"x"' },
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  external: ['react', 'react-dom', 'react-dom/test-utils', 'jsdom'],
  plugins: [{ name: 'fake-client', setup(b) { b.onResolve({ filter: /client\.js$/ }, (a) => (a.importer.includes('/src/') ? { path: join(hier, 'fakeclient.js') } : null)); } }],
  logLevel: 'error',
  absWorkingDir: root,
});

const r = spawnSync(process.execPath, [join(hier, 'scheiding.test.mjs')], {
  stdio: 'inherit',
  cwd: root,
  env: { ...process.env, PS_OUT: out },
});
process.exit(r.status ?? 1);
