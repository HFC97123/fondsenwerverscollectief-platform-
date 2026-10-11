// Draait de database- en beveiligingstests voor projectfinanciering (Werkruimte Fase 2) tegen een
// lokale Postgres: schema-stub (live functiedefinities) + de migratie + funding.test.sql.
//   node tests/project-funding-db/run.mjs
// Gebruikt een tijdelijke eigen Postgres-instantie (initdb in een tempmap, poort 5544) als er geen
// PGHOST/PGPORT is opgegeven. Zonder Postgres-binaries: exit 0 met duidelijke SKIP-melding
// (de test draait dan in de cloud-werkomgeving waar Postgres 16 beschikbaar is).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const hier = dirname(fileURLToPath(import.meta.url));
const migratie = resolve(hier, '../../supabase/migrations/20261011104804_project_funding_fase2.sql');
const rollback = resolve(hier, '../../supabase/voorstel-niet-uitgevoerd/20261011104804_project_funding_fase2_rollback.sql');
const BIN = ['/usr/lib/postgresql/16/bin', '/usr/lib/postgresql/15/bin', '/usr/lib/postgresql/14/bin', '/opt/homebrew/bin', '/usr/local/bin'].find((d) => existsSync(join(d, 'initdb')));
const psqlBin = process.env.PSQL || (spawnSync('which', ['psql']).stdout.toString().trim() || (BIN && join(BIN, 'psql')));

if (!BIN || !psqlBin) {
  console.log('SKIP: geen Postgres-binaries gevonden; database-tests niet uitgevoerd.');
  process.exit(0);
}

const PORT = process.env.PGFUND_PORT || '5547';
const dir = mkdtempSync(join(tmpdir(), 'pgfund-'));
const asPostgres = process.getuid && process.getuid() === 0;
const run = (cmd, args, opt = {}) => spawnSync(cmd, args, { encoding: 'utf8', ...opt });
const sh = (cmd) => (asPostgres ? run('su', ['postgres', '-c', cmd]) : run('bash', ['-c', cmd]));

if (asPostgres) run('chown', ['postgres', dir]);

let r = sh(`${join(BIN, 'initdb')} -D ${dir}/data -A trust -U postgres`);
if (r.status !== 0) { console.error(r.stderr || r.stdout); process.exit(1); }
r = sh(`${join(BIN, 'pg_ctl')} -D ${dir}/data -o '-p ${PORT} -c listen_addresses=127.0.0.1 -k ${dir}' -l ${dir}/log -w start`);
if (r.status !== 0) { console.error(r.stderr || r.stdout); process.exit(1); }

const psql = (args, input) => run(psqlBin, ['-h', '127.0.0.1', '-p', PORT, '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', ...args], input ? { input } : {});
let gefaald = 0, geslaagd = 0;

try {
  psql(['-c', 'create database fundtest']);
  const stap = (naam, args) => { const x = psql(['-d', 'fundtest', '-q', ...args]); if (x.status !== 0) { console.error(`FAIL ${naam}:\n${x.stderr}`); gefaald++; return false; } return true; };
  if (stap('schema-stub', ['-f', join(hier, 'schema-stub.sql')]) && stap('migratie', ['-f', migratie])) {
    const t = psql(['-d', 'fundtest', '-f', join(hier, 'funding.test.sql')]);
    const uit = `${t.stdout}\n${t.stderr}`;
    uit.split('\n').forEach((l) => {
      const m = l.match(/NOTICE:\s+(OK|FAIL)\s+(.*)$/);
      if (m) { m[1] === 'OK' ? geslaagd++ : gefaald++; console.log(`${m[1] === 'OK' ? 'OK  ' : 'FAIL'} ${m[2].trim()}`); }
      else if (/ERROR:/.test(l)) { gefaald++; console.log(`FAIL (SQL-fout) ${l}`); }
    });
  }

  // Rollback moet schoon werken en de migratie moet opnieuw toepasbaar zijn.
  const rb = psql(['-d', 'fundtest', '-q', '-f', rollback]);
  const weg = psql(['-d', 'fundtest', '-At', '-c', "select to_regclass('public.subsidie_kompas_program_funding') is null and not exists (select 1 from pg_proc where proname='kompas_dekkingsplan') and not exists (select 1 from pg_constraint where conname='subsidie_kompas_programs_id_user_id_key')"]);
  const rbOk = rb.status === 0 && weg.stdout.trim() === 't';
  console.log(`${rbOk ? 'OK  ' : 'FAIL'} rollback verwijdert tabel, functie en composite sleutel`);
  rbOk ? geslaagd++ : gefaald++;
  const opnieuw = psql(['-d', 'fundtest', '-q', '-f', migratie]);
  console.log(`${opnieuw.status === 0 ? 'OK  ' : 'FAIL'} migratie na rollback opnieuw toepasbaar`);
  opnieuw.status === 0 ? geslaagd++ : gefaald++;
} finally {
  sh(`${join(BIN, 'pg_ctl')} -D ${dir}/data -m immediate stop`);
  try { rmSync(dir, { recursive: true, force: true }); } catch (e) { /* tijdelijke map */ }
}

console.log(`\nPROJECTFINANCIERING-DB: ${geslaagd} geslaagd, ${gefaald} mislukt`);
process.exit(gefaald ? 1 : 0);
