// Draait alle tests van de AI-beoordeling: node tests/fonds-beoordeling/run.mjs
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
let fout = 0;

for (const f of ['module.test.mjs', 'chat.test.mjs']) {
  const r = spawnSync(process.execPath, [path.join(here, f)], { encoding: 'utf8' });
  const regels = `${r.stdout}${r.stderr}`.split('\n').filter((l) => /FAIL|OK, \d+ FOUT/.test(l));

  console.log(regels.join('\n'));
  if (r.status !== 0) fout += 1;
}

process.exit(fout ? 1 : 0);
