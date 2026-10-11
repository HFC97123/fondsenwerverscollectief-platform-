// Draait de node-tests van de werkruimte (Fase 1).
//   node tests/werkruimte/run.mjs   (vanuit de repo-root)
import { spawnSync } from 'node:child_process';

const r = spawnSync('node', ['tests/werkruimte/dashboard.test.mjs'], { stdio: 'inherit' });

process.exit(r.status ?? 1);
