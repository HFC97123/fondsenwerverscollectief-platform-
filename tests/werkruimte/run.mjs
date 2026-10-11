// Draait de node-tests van de werkruimte (Fase 1 + 2 + 3).
//   node tests/werkruimte/run.mjs   (vanuit de repo-root)
import { spawnSync } from 'node:child_process';

let status = 0;

['tests/werkruimte/dashboard.test.mjs', 'tests/werkruimte/dekkingsplan.test.mjs', 'tests/werkruimte/fase3.test.mjs'].forEach((f) => {
  const r = spawnSync('node', [f], { stdio: 'inherit' });

  status = status || (r.status ?? 1);
});

process.exit(status);
