// node tests/member-reviews/browser/build.mjs   (vanuit de repo-root)
import { build } from 'esbuild';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cpSync, mkdirSync } from 'node:fs';

const hier = dirname(fileURLToPath(import.meta.url));
const root = resolve(hier, '../../..');

mkdirSync(`${hier}/web`, { recursive: true });
await build({
  entryPoints: [`${hier}/entry.jsx`], outfile: `${hier}/web/entry.js`, bundle: true, format: 'esm', platform: 'browser',
  loader: { '.js': 'jsx' }, jsx: 'automatic', nodePaths: [`${root}/node_modules`],
  define: { 'import.meta.env': '{}', 'process.env.NODE_ENV': '"development"' },
  plugins: [{ name: 'stub', setup(b) { b.onResolve({ filter: /client\.js$/ }, () => ({ path: `${hier}/stubclient.js` })); } }],
  logLevel: 'warning',
});
cpSync(`${hier}/index.html`, `${hier}/web/index.html`);
