// Draait de Fase 5-tests (node): servercontext/fail-safe/entitlement, frontend-/ketentests en de matching-baseline.
//   node tests/fase5/run.mjs   (vanuit de repo-root)
// De baseline-vergelijking vergelijkt de huidige Edge Function met de opgeslagen Fase 4-uitkomsten
// (tests/fase5/baseline/fase4-matching-baseline.json); opnieuw opnemen kan alleen met de Fase 4-bron:
//   FASE4_BRON=<pad naar index.ts @ 3635713> node tests/fase5/baseline.mjs record
import { spawnSync } from 'node:child_process';

let status = 0;

[['tests/fase5/server.test.mjs'], ['tests/fase5/frontend.test.mjs'], ['tests/fase5/baseline.mjs', 'compare']].forEach((a) => {
  const r = spawnSync('node', a, { stdio: 'inherit' });

  status = status || (r.status ?? 1);
});

process.exit(status);
