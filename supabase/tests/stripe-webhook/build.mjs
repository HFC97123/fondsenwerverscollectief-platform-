import { build } from 'esbuild';
const here = new URL('.', import.meta.url).pathname;
await build({
  entryPoints: [here + '../../functions/stripe-webhook/index.ts'], bundle: true, platform: 'node', format: 'esm', outfile: here + 'handler.mjs', logLevel: 'error', external: ['pg','stripe'],
  plugins: [{ name: 'fakes', setup(b) {
    b.onResolve({ filter: /^npm:stripe/ }, () => ({ path: here + 'stripewrap.mjs' }));
    b.onResolve({ filter: /esm\.sh\/@supabase/ }, () => ({ path: here + 'fakesupabase.mjs' }));
  } }],
});
