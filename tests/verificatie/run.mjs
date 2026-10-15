// Draait alle tests van de verificatielaag (Fase B1): SSRF, fetch, tekstomzetting, bewijs, resultaat, prestatie.
//   node tests/verificatie/run.mjs   (vanuit de repo-root)
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';

const bestanden = ['ssrf', 'fetch', 'tekst', 'bewijs', 'zoeker', 'orkestratie', 'resultaat', 'prestatie'];
let status = 0;

for (const b of bestanden) {
  await build({
    entryPoints: [`tests/verificatie/${b}.test.mjs`],
    outfile: `tests/verificatie/.build/${b}.bundle.mjs`,
    bundle: true, platform: 'node', format: 'esm', loader: { '.ts': 'ts' }, logLevel: 'warning',
  });

  const r = spawnSync('node', [`tests/verificatie/.build/${b}.bundle.mjs`], { stdio: 'inherit' });

  status = status || (r.status ?? 1);
}

process.exit(status);
