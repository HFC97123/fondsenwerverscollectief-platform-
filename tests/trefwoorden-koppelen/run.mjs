// Draait de tests voor de slimme herkenning: node tests/trefwoorden-koppelen/run.mjs (vanuit de repo-root)
import { spawnSync } from 'node:child_process';

let status = 0;
const b = spawnSync(process.execPath, ['tests/voorstel-genereren/bundle.mjs', 'tests/trefwoorden-koppelen/server.test.mjs', 'tests/trefwoorden-koppelen/.build/server.mjs'], { stdio: 'inherit' });
const r = b.status === 0 ? spawnSync(process.execPath, ['tests/trefwoorden-koppelen/.build/server.mjs'], { stdio: 'inherit' }) : b;

status ||= r.status ?? 1;

const c = spawnSync(process.execPath, ['tests/trefwoorden-koppelen/client.mjs'], { stdio: 'inherit' });

status ||= c.status ?? 1;

process.exit(status);
