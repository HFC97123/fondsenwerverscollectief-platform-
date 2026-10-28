// Draait de tests voor "Projectdossier uit een document": node tests/dossier-uitlezen/run.mjs (vanuit de repo-root)
import { spawnSync } from 'node:child_process';

let status = 0;
const b = spawnSync(process.execPath, ['tests/voorstel-genereren/bundle.mjs', 'tests/dossier-uitlezen/server.test.mjs', 'tests/dossier-uitlezen/.build/server.mjs'], { stdio: 'inherit' });
const r = b.status === 0 ? spawnSync(process.execPath, ['tests/dossier-uitlezen/.build/server.mjs'], { stdio: 'inherit' }) : b;

status ||= r.status ?? 1;

const c = spawnSync(process.execPath, ['tests/dossier-uitlezen/client.mjs'], { stdio: 'inherit' });

status ||= c.status ?? 1;

process.exit(status);
