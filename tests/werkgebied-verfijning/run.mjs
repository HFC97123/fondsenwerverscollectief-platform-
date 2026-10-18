// Draait alle tests voor de werkgebied-verfijning: node tests/werkgebied-verfijning/run.mjs (vanuit de repo-root)
import { spawnSync } from 'node:child_process';

let status = 0;
const b = spawnSync(process.execPath, ['tests/voorstel-genereren/bundle.mjs', 'tests/werkgebied-verfijning/server.test.mjs', 'tests/werkgebied-verfijning/.build/server.mjs'], { stdio: 'inherit' });
const r = b.status === 0 ? spawnSync(process.execPath, ['tests/werkgebied-verfijning/.build/server.mjs'], { stdio: 'inherit' }) : b;

status ||= r.status ?? 1;

const c = spawnSync(process.execPath, ['tests/werkgebied-verfijning/client.mjs'], { stdio: 'inherit' });

status ||= c.status ?? 1;

process.exit(status);
