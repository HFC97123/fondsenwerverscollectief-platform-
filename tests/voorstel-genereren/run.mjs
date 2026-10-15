// Serverkant van "Maak dekkingsplan en actieplan met Subsidiekompas" (genereren/aanvullen, Pro vs Premium).   node tests/voorstel-genereren/run.mjs
import { spawnSync } from 'node:child_process';
const r = spawnSync(process.execPath, ['tests/voorstel-genereren/bundle.mjs', 'tests/voorstel-genereren/genereren.test.mjs', 'tests/voorstel-genereren/.build/genereren.mjs'], { stdio: 'inherit' });
process.exit(r.status ?? 1);
