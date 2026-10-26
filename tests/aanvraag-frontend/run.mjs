// Draait de tests van de schermen van de aanvraag-assistent.
//   node tests/aanvraag-frontend/run.mjs   (vanuit de repo-root)
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

let status = 0;

for (const b of ['model', 'service']) {
  await build({
    entryPoints: [`tests/aanvraag-frontend/${b}.test.mjs`],
    outfile: `tests/aanvraag-frontend/.build/${b}.bundle.mjs`,
    bundle: true, platform: 'node', format: 'esm', loader: { '.js': 'jsx' }, jsx: 'automatic',
    define: { 'import.meta.env': '{}' },
    plugins: [{ name: 'client-stub', setup(bld) {
      bld.onResolve({ filter: /client\.js$/ }, (a) => (/\.\.\//.test(a.path) ? { path: 'stub', namespace: 'stub' } : null));
      bld.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const supabase = globalThis.__supabase ?? null;', loader: 'js' }));
    } }],
    logLevel: 'warning',
  });

  const r = spawnSync('node', [`tests/aanvraag-frontend/.build/${b}.bundle.mjs`], { stdio: 'inherit' });

  status = status || (r.status ?? 1);
}

// De schermen zelf, in jsdom, tegen de echte serverregels (vereist jsdom; staat niet in package.json).
{
  const fakeClient = join(process.cwd(), 'tests', 'checkout-frontend', 'fake-client.js');

  await build({
    entryPoints: ['tests/aanvraag-frontend/schermen.test.jsx'],
    outfile: 'tests/aanvraag-frontend/.build/schermen.bundle.mjs',
    bundle: true, platform: 'node', format: 'esm', loader: { '.js': 'jsx' }, jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"test"', 'import.meta.env': '{}' },
    banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
    external: ['jsdom', 'exceljs', 'docx', 'jszip', 'pdfjs-dist', 'mammoth'],
    plugins: [
      { name: 'alias-fakes', setup(b) { b.onResolve({ filter: /\/client\.js$/ }, (a) => (a.importer.includes('/src/') ? { path: fakeClient } : null)); } },
      // De PDF-lezer importeert zijn worker als '...?url' (Vite); in de test is dat een lege tekst.
      { name: 'url-stub', setup(b) { b.onResolve({ filter: /\?url$/ }, (a) => ({ path: a.path, namespace: 'url-stub' })); b.onLoad({ filter: /.*/, namespace: 'url-stub' }, () => ({ contents: "export default 'worker.js';", loader: 'js' })); } },
    ],
    logLevel: 'error',
  });

  const r = spawnSync('node', ['tests/aanvraag-frontend/.build/schermen.bundle.mjs'], { stdio: 'inherit' });

  status = status || (r.status ?? 1);
}

process.exit(status);
