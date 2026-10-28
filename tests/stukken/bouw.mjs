// Bouwt de module voor de test (zonder React-afhankelijkheden in de test zelf).
import { build } from 'esbuild';
await build({ entryPoints: [new URL('../../src/features/kompas-app/financiering/StukkenVoorFondsenwerving.jsx', import.meta.url).pathname], bundle: true, format: 'esm', platform: 'node', outfile: new URL('./.build/stukken.mjs', import.meta.url).pathname, loader: { '.jsx': 'jsx' }, define: { 'import.meta.env': '{"VITE_SUPABASE_URL":"https://x.test","VITE_SUPABASE_ANON_KEY":"k"}' }, logLevel: 'error' });
