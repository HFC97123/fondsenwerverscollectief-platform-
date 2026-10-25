// Draait de tests van Documenten › Begroting.
//   node tests/begroting/run.mjs   (vanuit de repo-root)
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

let status = 0;

for (const b of []) {
  await build({
    entryPoints: [`tests/begroting/${b}.test.mjs`],
    outfile: `tests/begroting/.build/${b}.bundle.mjs`,
    bundle: true, platform: 'node', format: 'esm', loader: { '.js': 'jsx' }, jsx: 'automatic',
    define: { 'import.meta.env': '{}' },
    plugins: [{ name: 'client-stub', setup(bld) {
      bld.onResolve({ filter: /client\.js$/ }, (a) => (/\.\.\//.test(a.path) ? { path: 'stub', namespace: 'stub' } : null));
      bld.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const supabase = globalThis.__supabase ?? null;', loader: 'js' }));
    } }],
    logLevel: 'warning',
  });

  const r = spawnSync('node', [`tests/begroting/.build/${b}.bundle.mjs`], { stdio: 'inherit' });

  status = status || (r.status ?? 1);
}

// De schermen zelf, in jsdom, tegen de echte serverregels (vereist jsdom; staat niet in package.json).
{
  const fakeClient = join(process.cwd(), 'tests', 'checkout-frontend', 'fake-client.js');

  await build({
    entryPoints: ['tests/begroting/schermen.test.jsx'],
    outfile: 'tests/begroting/.build/schermen.bundle.mjs',
    bundle: true, platform: 'node', format: 'esm', loader: { '.js': 'jsx' }, jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"test"', 'import.meta.env': '{}' },
    banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
    external: ['jsdom', 'exceljs', 'docx', 'jszip', 'pdfjs-dist', 'mammoth'],
    plugins: [{ name: 'alias-fakes', setup(b) { b.onResolve({ filter: /\/client\.js$/ }, (a) => (a.importer.includes('/src/') ? { path: fakeClient } : null)); b.onResolve({ filter: /\?url$/ }, () => ({ path: 'worker-url', namespace: 'stub-url' })); b.onLoad({ filter: /.*/, namespace: 'stub-url' }, () => ({ contents: `export default ${JSON.stringify(pathToFileURL(join(process.cwd(), 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs')).href)};`, loader: 'js' })); } }],
    logLevel: 'error',
  });

  const r = spawnSync('node', ['tests/begroting/.build/schermen.bundle.mjs'], { stdio: 'inherit' });

  status = status || (r.status ?? 1);
}

process.exit(status);
