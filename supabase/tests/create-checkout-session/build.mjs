// Bundelt de ECHTE Edge Function create-checkout-session naar een lokaal
// testbestand; Stripe en Supabase worden vervangen door fakes (fakestripe.mjs,
// fakesupabase.mjs). Er is geen netwerk en geen echte sleutel nodig.
// Vereist (niet in package.json): npm i --no-save esbuild
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const hier = dirname(fileURLToPath(import.meta.url));
const root = resolve(hier, '../../..');
const out = process.env.TEST_OUT || join(root, '_to_delete', 'ccs-test');
mkdirSync(out, { recursive: true });

await build({
  entryPoints: [join(root, 'supabase/functions/create-checkout-session/index.ts')],
  bundle: true, platform: 'node', format: 'esm', outfile: join(out, 'handler.mjs'),
  logLevel: 'error',
  plugins: [{ name: 'fakes', setup(b) {
    b.onResolve({ filter: /^npm:stripe/ }, () => ({ path: join(hier, 'fakestripe.mjs') }));
    b.onResolve({ filter: /esm\.sh\/@supabase/ }, () => ({ path: join(hier, 'fakesupabase.mjs') }));
  } }],
});
console.log('handler gebundeld in', out);
