// Draait de isolatietest voor organisatiegegevens tussen accounts.
// Gebruik: node tests/organisatie-isolatie/run.mjs
// Vereist (niet in package.json): npm i --no-save esbuild jsdom
// Praat NOOIT met Supabase: src/data/client.js wordt vervangen door een
// nep-database in het geheugen met RLS-gedrag (fakeclient.js).
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const hier = dirname(fileURLToPath(import.meta.url));
const root = process.env.REPO_ROOT ? resolve(process.env.REPO_ROOT) : resolve(hier, '../..');
const out = process.env.TEST_OUT || join(root, '_to_delete', 'organisatie-isolatie-test');
mkdirSync(out, { recursive: true });

await build({
  entryPoints: {
    store: join(root, 'src/features/kompas-app/KompasStore.jsx'),
    profile: join(root, 'src/data/services/profile.js'),
  },
  outdir: out,
  bundle: true,
  platform: 'node',
  format: 'esm',
  outExtension: { '.js': '.mjs' },
  loader: { '.js': 'jsx' },
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"test"' },
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  external: ['react', 'react-dom', 'react-dom/test-utils', 'jsdom'],
  plugins: [{ name: 'fake-client', setup(b) { b.onResolve({ filter: /client\.js$/ }, (a) => (a.importer.includes('/src/') ? { path: join(hier, 'fakeclient.js') } : null)); } }],
  logLevel: 'error',
  absWorkingDir: root,
});

const r = spawnSync(process.execPath, [join(hier, 'isolatie.test.mjs')], {
  stdio: 'inherit',
  cwd: root,
  env: { ...process.env, ORG_TEST_STORE: join(out, 'store.mjs'), ORG_TEST_PROFILE: join(out, 'profile.mjs') },
});
process.exit(r.status ?? 1);
