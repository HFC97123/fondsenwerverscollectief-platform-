// Bundelt de ECHTE Edge Function stripe-portal naar een lokaal testbestand;
// Stripe en Supabase worden vervangen door de fakes van de
// create-checkout-session-tests (../create-checkout-session/fake*.mjs).
// Vereist (niet in package.json): npm i --no-save esbuild
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const hier = dirname(fileURLToPath(import.meta.url));
const root = resolve(hier, '../../..');
const fakes = join(hier, '../create-checkout-session');
const out = process.env.TEST_OUT || join(root, '_to_delete', 'portal-test');
mkdirSync(out, { recursive: true });

await build({
  entryPoints: [join(root, 'supabase/functions/stripe-portal/index.ts')],
  bundle: true, platform: 'node', format: 'esm', outfile: join(out, 'handler.mjs'),
  logLevel: 'error',
  plugins: [{ name: 'fakes', setup(b) {
    b.onResolve({ filter: /^npm:stripe/ }, () => ({ path: join(fakes, 'fakestripe.mjs') }));
    b.onResolve({ filter: /esm\.sh\/@supabase/ }, () => ({ path: join(fakes, 'fakesupabase.mjs') }));
  } }],
});
console.log('handler gebundeld in', out);
