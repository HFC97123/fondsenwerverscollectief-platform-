// Serverkant van "Maak dekkingsplan en actieplan met Subsidiekompas": genereren/aanvullen (Pro vs Premium), opslaan, broncontrole en chat-startpunt.
//   node tests/voorstel-genereren/run.mjs
import { spawnSync } from 'node:child_process';

let status = 0;

for (const naam of ['genereren', 'opslaan', 'bron', 'actieplan', 'atomair', 'gebruiksmeter', 'planning', 'zoekprofiel', 'vlag', 'cariben', 'documenten', 'looptijd', 'doelgroepen', 'algemeenpremium']) {
  const b = spawnSync(process.execPath, ['tests/voorstel-genereren/bundle.mjs', `tests/voorstel-genereren/${naam}.test.mjs`, `tests/voorstel-genereren/.build/${naam}.mjs`], { stdio: 'inherit' });
  const r = b.status === 0 ? spawnSync(process.execPath, [`tests/voorstel-genereren/.build/${naam}.mjs`], { stdio: 'inherit' }) : b;

  status ||= r.status ?? 1;
}

process.exit(status);
