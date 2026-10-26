// Draait de tests van de aanvraag-assistent.
//   node tests/aanvraag-assistent/run.mjs   (vanuit de repo-root)
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';

let status = 0;

for (const b of ['module', 'handler', 'plan', 'versies', 'vragen', 'bronnen']) {
  await build({
    entryPoints: [`tests/aanvraag-assistent/${b}.test.mjs`],
    outfile: `tests/aanvraag-assistent/.build/${b}.bundle.mjs`,
    bundle: true, platform: 'node', format: 'esm', loader: { '.ts': 'ts' }, logLevel: 'warning',
  });

  const r = spawnSync('node', [`tests/aanvraag-assistent/.build/${b}.bundle.mjs`], { stdio: 'inherit' });

  status = status || (r.status ?? 1);
}

process.exit(status);
