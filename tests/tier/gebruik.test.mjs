import { readFileSync } from 'node:fs';
import { ACTIE_TYPES, PRIJZEN, schatKosten, tokensUitUsage, bouwGebruikRij, legGebruik, GEBRUIK_TABEL } from '../../supabase/functions/_shared/gebruikLog.ts';
import { tierConfigVoor } from '../../supabase/functions/_shared/tierConfig.ts';
import { check, gelijk, sectie, klaar, stand } from '../verificatie/hulp.mjs';

stand.naam = 'gebruik';

const U = '11111111-1111-4111-8111-111111111111';
const P = '22222222-2222-4222-8222-222222222222';
const BASIS = { userId: U, tier: 'pro', actie: 'chat' };

sectie('1. Kostenschatting: één prijslijst, bekende uitkomsten');
{
  const r = PRIJZEN.usdNaarEur;

  gelijk('1 miljoen in + 100.000 uit op gpt-5.5 = $ 5 + $ 3', schatKosten({ model: 'gpt-5.5', inputTokens: 1_000_000, outputTokens: 100_000 }), Math.round(8 * r * 10000) / 10000);
  gelijk('gecachte invoer wordt goedkoper gerekend', schatKosten({ model: 'gpt-5.5', inputTokens: 1_000_000, gecachedeInputTokens: 1_000_000 }), Math.round(0.5 * r * 10000) / 10000);
  gelijk('gecachte tokens kunnen niet groter zijn dan de invoer', schatKosten({ model: 'gpt-5.5', inputTokens: 1000, gecachedeInputTokens: 99999 }), schatKosten({ model: 'gpt-5.5', inputTokens: 1000, gecachedeInputTokens: 1000 }));
  gelijk('1.000 webzoekacties = $ 10', schatKosten({ model: 'gpt-5.5', webZoekAanroepen: 1000 }), Math.round(10 * r * 10000) / 10000);
  gelijk('gpt-4o', schatKosten({ model: 'gpt-4o', inputTokens: 1_000_000, outputTokens: 1_000_000 }), Math.round(12.5 * r * 10000) / 10000);
  gelijk('datumsuffix valt op het basismodel', schatKosten({ model: 'gpt-5.5-2026-08-01', inputTokens: 1_000_000 }), schatKosten({ model: 'gpt-5.5', inputTokens: 1_000_000 }));
  check('onbekend model met tokens: null, geen verzonnen bedrag', schatKosten({ model: 'gpt-9000', inputTokens: 5000 }) === null && schatKosten({ model: null, outputTokens: 5 }) === null);
  check('onbekend model zonder tokens maar met webzoekacties: alleen de zoekprijs', schatKosten({ model: 'nieuw-model', webZoekAanroepen: 100 }) === Math.round(1 * r * 10000) / 10000);
  check('rommel telt als 0', schatKosten({ model: 'gpt-5.5', inputTokens: -5, outputTokens: NaN, webZoekAanroepen: 'veel' }) === 0);
  check('prijslijst heeft een controledatum en een bron', /^\d{4}-\d{2}-\d{2}$/.test(PRIJZEN.gecontroleerdOp) && PRIJZEN.usdNaarEur > 0.5 && PRIJZEN.usdNaarEur < 1.5);
}

sectie('2. Tokens uit beide soorten usage-objecten');
{
  gelijk('Chat Completions', tokensUitUsage({ prompt_tokens: 120, completion_tokens: 30 }), { input: 120, output: 30, gecachte: 0 });
  gelijk('Responses API met cache', tokensUitUsage({ input_tokens: 500, output_tokens: 70, input_tokens_details: { cached_tokens: 200 } }), { input: 500, output: 70, gecachte: 200 });
  gelijk('null en rommel', [tokensUitUsage(null), tokensUitUsage('x'), tokensUitUsage({ input_tokens: 'abc' })], [{ input: 0, output: 0, gecachte: 0 }, { input: 0, output: 0, gecachte: 0 }, { input: 0, output: 0, gecachte: 0 }]);
}

sectie('3. Rij: alleen toegestane velden, nooit inhoud');
{
  const rij = bouwGebruikRij({ ...BASIS, projectId: P, model: 'gpt-5.5', inputTokens: 1000, outputTokens: 200, webZoekAanroepen: 3, externePaginas: 2, verificatiePaginas: 2, cacheHits: 1, duurMs: 4321, succes: true });

  gelijk('exacte kolommen', Object.keys(rij).sort(), ['action_type', 'cache_hits', 'duration_ms', 'estimated_cost_eur', 'external_page_fetches', 'input_tokens', 'model', 'output_tokens', 'project_id', 'success', 'tier', 'user_id', 'verification_pages', 'web_search_calls']);
  check('waarden', rij.user_id === U && rij.tier === 'pro' && rij.action_type === 'chat' && rij.project_id === P && rij.input_tokens === 1000 && rij.web_search_calls === 3 && rij.duration_ms === 4321 && rij.success === true);
  check('kosten worden geschat uit model, tokens en zoekacties', rij.estimated_cost_eur === schatKosten({ model: 'gpt-5.5', inputTokens: 1000, outputTokens: 200, webZoekAanroepen: 3 }) && rij.estimated_cost_eur > 0);

  const geheim = bouwGebruikRij({ ...BASIS, prompt: 'GEHEIME PROMPT', content: 'chattekst', url: 'https://x.example/', zoekopdracht: 'fonds voor jongeren', documenten: ['a.pdf'], email: 'a@b.nl', bericht: { role: 'user' } });

  check('extra velden (prompt, tekst, url, zoekopdracht, e-mail) vallen af', !/GEHEIME|chattekst|example|jongeren|a\.pdf|a@b|role/.test(JSON.stringify(geheim)));
  check('model wordt afgekapt op 60 tekens', bouwGebruikRij({ ...BASIS, model: 'm'.repeat(500) }).model.length === 60);
  check('ontbrekende velden worden 0 of null, success standaard waar', (() => { const r = bouwGebruikRij(BASIS); return r.input_tokens === 0 && r.model === null && r.project_id === null && r.estimated_cost_eur === 0 && r.success === true; })());
  check('succes false blijft false', bouwGebruikRij({ ...BASIS, succes: false }).success === false);
  check('negatieve, NaN en gigantische tellers worden begrensd', (() => { const r = bouwGebruikRij({ ...BASIS, inputTokens: -1, outputTokens: NaN, webZoekAanroepen: 1e12, duurMs: Infinity }); return r.input_tokens === 0 && r.output_tokens === 0 && r.web_search_calls === 10000 && r.duration_ms === 0; })());
  check('ongeldig project-id wordt null', bouwGebruikRij({ ...BASIS, projectId: 'niet-een-uuid' }).project_id === null);
  check('hoofdletters in uuid worden klein', bouwGebruikRij({ ...BASIS, userId: U.toUpperCase() }).user_id === U);

  for (const [naam, inv] of [
    ['geen gebruiker', { ...BASIS, userId: null }], ['ongeldige gebruiker', { ...BASIS, userId: 'x' }], ['onbekende tier', { ...BASIS, tier: 'enterprise' }],
    ['tier in hoofdletters', { ...BASIS, tier: 'PRO' }], ['onbekende actie', { ...BASIS, actie: 'iets_anders' }], ['geen invoer', null], ['leeg', {}],
  ]) check(`ongeldig: ${naam} geeft geen rij`, bouwGebruikRij(inv) === null);

  check('alle actietypen uit de wens zijn aanwezig', ['chat', 'fonds_scan_database', 'fonds_scan_web', 'proposal_preview', 'source_verification', 'document_generation', 'project_advice'].every((a) => ACTIE_TYPES.includes(a)));
  check('elk actietype levert een rij', ACTIE_TYPES.every((a) => bouwGebruikRij({ ...BASIS, actie: a })?.action_type === a));
  check('tier admin is toegestaan', bouwGebruikRij({ ...BASIS, tier: 'admin' })?.tier === 'admin');
}

sectie('4. Wegschrijven faalt altijd stil');
{
  const opgeslagen = [];
  const goed = { from: (t) => ({ insert: async (r) => { opgeslagen.push([t, r]); return { error: null }; } }) };

  check('schrijft naar de juiste tabel', (await legGebruik(goed, BASIS)) === true && opgeslagen[0][0] === GEBRUIK_TABEL && opgeslagen[0][1].user_id === U);
  check('ongeldige invoer: niets geschreven, geen fout', (await legGebruik(goed, { ...BASIS, tier: 'x' })) === false && opgeslagen.length === 1);

  const origineel = console.error;
  const logs = [];

  console.error = (...a) => logs.push(a.join(' '));

  const slecht = [
    { from: () => ({ insert: async () => ({ error: { message: 'relation "kompas_gebruik_log" does not exist', code: '42P01' } }) }) },
    { from: () => ({ insert: async () => { throw new Error('netwerk geheim'); } }) },
    { from: () => { throw new Error('kapot'); } },
    null, undefined, {}, { from: 5 },
  ];

  for (const [i, a] of slecht.entries()) check(`foutscenario ${i}: geeft false, gooit niet`, (await legGebruik(a, BASIS).catch(() => 'GOOIDE')) === false);

  console.error = origineel;
  check('logregels bevatten geen foutdetails of gebruikersgegevens', logs.every((l) => /^\[subsidie-kompas\] gebruik_vastleggen_(mislukt|fout)$/.test(l)) && !logs.join().includes(U) && !logs.join().includes('geheim'));
}

sectie('5. Statische contracten: wiring, privacy en migratie');
{
  const index = readFileSync('supabase/functions/subsidie-kompas/index.ts', 'utf8');
  const log = readFileSync('supabase/functions/_shared/gebruikLog.ts', 'utf8');
  const sql = readFileSync('supabase/voorstel-niet-uitgevoerd/20261015120000_kompas_gebruik_log.sql', 'utf8');
  const rollback = readFileSync('supabase/voorstel-niet-uitgevoerd/20261015120000_kompas_gebruik_log_rollback.sql', 'utf8');
  const nietZonderCommentaar = (t) => t.replace(/\/\/.*$/gm, '').replace(/^\s*--.*$/gm, '');

  check('index.ts laadt gebruikLog alleen dynamisch (opstart verandert niet)', /await import\('\.\.\/_shared\/gebruikLog\.ts'\)/.test(index) && !/^import .*gebruikLog/m.test(index));
  // 9 bestaande punten + 3 van 'voorstel-genereren' / 'voorstel-aanvullen' (database-scan, web-scan bij genereren, web-scan bij aanvullen).
  check('alle bestaande verbruikspunten melden ook aan de meter (9 + 3 van het genereren van een voorstel + 1 van de broncontrole + 1 van het zoekprofiel)', (index.match(/await meldGebruik\(admin,/g) || []).length === 14, String((index.match(/await meldGebruik\(admin,/g) || []).length));
  check('de bestaande legVerbruikVast-aanroepen zijn ongewijzigd aanwezig', (index.match(/await legVerbruikVast\(admin,/g) || []).length === 8);
  check('de meter wordt nooit afgewacht met een foutpad (alleen binnen meldGebruik met try/catch)', /async function meldGebruik[\s\S]*?try \{[\s\S]*?\} catch \(_\) \{/.test(index));
  check('geen enkele meldGebruik-aanroep geeft tekst, bericht of url mee', !/meldGebruik\(admin, \{[^}]*(berichten|tekst|prompt|content|url|query|text)/.test(index));
  check('gebruikLog heeft geen netwerk en leest geen omgeving', !/\bfetch\(|Deno\.|process\.env/.test(nietZonderCommentaar(log)));
  check('gebruikLog schrijft naar precies één tabel', (nietZonderCommentaar(log).match(/\.from\(/g) || []).length === 1 && log.includes("'kompas_gebruik_log'"));

  check('migratie: RLS aan en alle rechten voor leden ingetrokken', /enable row level security/.test(sql) && /revoke all on table public\.kompas_gebruik_log from public, anon, authenticated/.test(sql));
  check('migratie: geen enkele policy', !/create policy/i.test(sql));
  check('migratie: alleen service_role mag schrijven en lezen', /grant select, insert on table public\.kompas_gebruik_log to service_role/.test(sql) && !/grant [^;]*(update|delete)[^;]*kompas_gebruik_log/i.test(sql));
  check('migratie: beide admin-RPC\'s eisen current_user_is_admin()', (nietZonderCommentaar(sql).match(/current_user_is_admin\(\)/g) || []).length === 2 && (nietZonderCommentaar(sql).match(/security definer/g) || []).length === 2 && (nietZonderCommentaar(sql).match(/set search_path = public, pg_temp/g) || []).length === 2);
  check('migratie: geen kolom voor inhoud (prompt, tekst, url, bericht, query)', !/\b(prompt|content|tekst|message|url|query|body)\b[^,\n]*(text|jsonb|varchar)/i.test(sql.replace(/--.*$/gm, '')));
  check('migratie: observatiebudgetten staan niet in SQL (één bron: tierConfig)', !/\b(7|14)(\.0+)?\b[^\n]*(budget|pro|premium)|(budget|pro|premium)[^\n]*\b(7|14)(\.0+)?\b/i.test(sql.replace(/--.*$/gm, '')));
  check('migratie: actietypen niet vastgezet in een CHECK (centraal uitbreidbaar)', !/action_type[^\n]*\bin \(/i.test(sql.replace(/--.*$/gm, '')));
  check('migratie staat bij de niet-uitgevoerde voorstellen, niet in migrations/', !readFileSync('supabase/migrations/README.md', 'utf8').includes('kompas_gebruik_log'));
  check('rollback verwijdert tabel en functies', /drop table if exists public\.kompas_gebruik_log/.test(rollback) && (rollback.match(/drop function if exists/g) || []).length === 2);

  check('observatiebudgetten Pro 7 en Premium 14 komen uit tierConfig', tierConfigVoor('pro').maandBudgetObservatieEur === 7 && tierConfigVoor('premium').maandBudgetObservatieEur === 14);
  check('niets in de code gebruikt het budget om te blokkeren of af te remmen', !/maandBudgetObservatieEur/.test(nietZonderCommentaar(index)) && !/maandBudgetObservatieEur/.test(nietZonderCommentaar(log)));
}

klaar('gebruik');
