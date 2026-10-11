import { readFileSync, existsSync } from 'node:fs';
import { normaliseerLedenReviews, MAX_LEDENREVIEWS, normaliseerLedenWaardering, formatGemiddeldeWaardering } from '../../src/data/services/ledenReviews.js';

let ok = 0;
let fail = 0;
const check = (naam, voorwaarde) => {
  if (voorwaarde) { ok += 1; } else { fail += 1; console.log('FAIL:', naam); }
};

// --- normalisatie van RPC-rijen
const zeven = Array.from({ length: 7 }, (_, i) => ({ rating: 5, review_text: null, display_name: null, display_role: null, x: i }));
check('maximaal 5 rijen', normaliseerLedenReviews(zeven).length === 5 && MAX_LEDENREVIEWS === 5);
check('alleen rating werkt', normaliseerLedenReviews([{ rating: '5.0', review_text: null }])[0].tekst === '');
check('rating als string -> getal', normaliseerLedenReviews([{ rating: '4.5' }])[0].rating === 4.5);
check('ongeldige rating valt weg', normaliseerLedenReviews([{ rating: 0 }, { rating: 6 }, { rating: 'x' }, null, {}]).length === 0);
check('geen array -> leeg', normaliseerLedenReviews(null).length === 0 && normaliseerLedenReviews({}).length === 0);
check('tekst/naam/functie getrimd', (() => { const r = normaliseerLedenReviews([{ rating: 5, review_text: ' Top ', display_name: ' A ', display_role: ' B ' }])[0]; return r.tekst === 'Top' && r.naam === 'A' && r.functie === 'B'; })());
check('geen extra velden (geen id/e-mail) doorgegeven', Object.keys(normaliseerLedenReviews([{ rating: 5, profile_id: 'x', email: 'e' }])[0]).sort().join() === 'functie,naam,rating,tekst');

// --- migratie (statische controles op het SQL-bestand)
const sql = readFileSync('supabase/migrations/20261010120000_member_reviews.sql', 'utf8');
const code = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
check('migratie: geen insert in member_reviews (geen backfill/auto-rating)', !/insert\s+into\s+public\.member_reviews/i.test(code));
check('migratie: RLS aan', /alter table public\.member_reviews enable row level security/i.test(code));
check('migratie: anon/authenticated tabelrechten ingetrokken', /revoke all on table public\.member_reviews from anon, authenticated/i.test(code));
check('migratie: geen policy voor anon', !/to\s+anon/i.test(code.replace(/grant execute[^;]*;/gi, '')));
check('migratie: admin-policy via private.is_admin()', /private\.is_admin\(\)/.test(code));
check('migratie: unieke rating per profiel', /member_reviews_profile_uniek unique \(profile_id\)/.test(code));
check('migratie: nieuwe rijen standaard niet goedgekeurd/publiek', /is_approved\s+boolean not null default false/.test(code) && /is_public\s+boolean not null default false/.test(code));
check('migratie: rating 1.0-5.0', /rating >= 1\.0 and rating <= 5\.0/.test(code));
check('migratie: rpc security definer + limiet 5', /security definer/i.test(code) && /least\(greatest\(coalesce\(p_limit, 5\), 1\), 5\)/.test(code));
const rpc = code.slice(code.indexOf('create or replace function public.publieke_ledenreviews'));
const selectLijst = rpc.match(/select\s+(r\.[^\n]+)\n\s+from/i)[1];
check('rpc geeft alleen rating/tekst/naam/functie', selectLijst.replace(/\s/g, '') === 'r.rating,r.review_text,r.display_name,r.display_role');
check('rpc: alleen goedgekeurd én publiek én actief lid', /where r\.is_approved\s+and r\.is_public/.test(rpc) && /p\.role = 'member'/.test(rpc) && /p\.status = 'approved'/.test(rpc));

// --- gemiddelde waardering: normalisatie van het RPC-resultaat
const n = (d) => normaliseerLedenWaardering(d);
check('waardering: array met één rij', n([{ gemiddelde: '5.0000000000000000', aantal: 31 }]).gemiddelde === 5 && n([{ gemiddelde: '5.0', aantal: 31 }]).aantal === 31);
check('waardering: object zonder array', n({ gemiddelde: 4.5, aantal: 2 }).gemiddelde === 4.5);
check('waardering: numeric als string -> getal', n([{ gemiddelde: '4.6666666666666667', aantal: 3 }]).gemiddelde > 4.66);
check('waardering: null telt niet mee (NULL, 0)', n([{ gemiddelde: null, aantal: 0 }]).gemiddelde === null);
check('waardering: lege string = geen gemiddelde (niet 0)', n([{ gemiddelde: '', aantal: 0 }]).gemiddelde === null && n([{ gemiddelde: '  ', aantal: 1 }]).gemiddelde === null);
check('waardering: undefined/ontbrekend = geen gemiddelde', n([{ aantal: 3 }]).gemiddelde === null && n([]).gemiddelde === null && n(null).gemiddelde === null && n(undefined).gemiddelde === null);
check('waardering: 0 is nooit een gemiddelde', n([{ gemiddelde: 0, aantal: 0 }]).gemiddelde === null && n([{ gemiddelde: '0', aantal: 2 }]).gemiddelde === null);
check('waardering: onzin/NaN/Infinity/buiten 1-5 valt weg', ['abc', NaN, Infinity, 7, 0.5, -3].every((x) => n([{ gemiddelde: x, aantal: 4 }]).gemiddelde === null));
check('waardering: aantal 0 of ongeldig = geen gemiddelde', n([{ gemiddelde: 5, aantal: 0 }]).gemiddelde === null && n([{ gemiddelde: 5, aantal: 'x' }]).gemiddelde === null);
check('waardering: geen extra velden doorgegeven', Object.keys(n([{ gemiddelde: 5, aantal: 3, profile_id: 'x' }])).sort().join() === 'aantal,gemiddelde');

// --- gemiddelde waardering: Nederlandse notatie met één decimaal
const f = formatGemiddeldeWaardering;
check('formaat: 5 -> 5,0', f(5) === '5,0');
check('formaat: 4,84 -> 4,8', f(4.84) === '4,8');
check('formaat: 4,3 -> 4,3 (geen 4.3)', f(4.3) === '4,3' && !f(4.3).includes('.'));
check('formaat: 4,85 -> 4,9', f(4.85) === '4,9');
check('formaat: 4,6667 -> 4,7', f(14 / 3) === '4,7');
check('formaat: nooit 5 of 5.00', f(5) !== '5' && f(5) !== '5.00' && f(5.0000) === '5,0');
check('formaat: komma, altijd één decimaal', [1, 2.5, 3.14159, 4.99, 4.96, 5].every((x) => /^\d,\d$/.test(f(x))));
check('formaat: 4,96 -> 5,0', f(4.96) === '5,0');
check('formaat: geen waarde -> streepje', [null, undefined, NaN, 0, '', 'abc', Infinity, 7].every((x) => f(x) === '—'));

// --- migratie gemiddelde waardering (statische controles)
const sql2 = readFileSync('supabase/migrations/20261011100000_publieke_ledenwaardering.sql', 'utf8');
const code2 = sql2.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
check('migratie2: alleen create function/revoke/grant/comment', !/\b(insert|update|delete|drop|alter|truncate)\b/i.test(code2));
check('migratie2: security definer + vaste search_path', /security definer/i.test(code2) && /set search_path = public/.test(code2));
check('migratie2: avg + count over rating, zelfde populatie als reviews', /avg\(r\.rating\)/.test(code2) && /r\.is_approved\s+and r\.is_public/.test(code2) && /p\.role = 'member'/.test(code2) && /p\.status = 'approved'/.test(code2));
check('migratie2: null/ongeldige ratings uitgesloten', /r\.rating is not null/.test(code2) && /r\.rating >= 1/.test(code2) && /r\.rating <= 5/.test(code2));
check('migratie2: geeft alleen gemiddelde + aantal terug', /returns table \(\s*gemiddelde numeric,\s*aantal\s+integer\s*\)/.test(code2) && !/profile_id|email|display_name|review_text/.test(code2.replace(/\bp\.id = r\.profile_id/, '')));
check('migratie2: anon/authenticated mogen alleen uitvoeren, rest ingetrokken', /revoke all on function public\.publieke_ledenwaardering\(\) from public, anon, authenticated, service_role/.test(code2) && /grant execute on function public\.publieke_ledenwaardering\(\) to anon, authenticated/.test(code2));
check('migratie2: geen backfill of afronding in de database', !/round\(/i.test(code2));

// --- homepage-integratie
const home = readFileSync('src/features/website/HomePage.jsx', 'utf8');
check('homepage: LedenWaardering één keer gebruikt', (home.match(/<LedenWaardering \/>/g) || []).length === 1);
const cijfers = home.slice(home.indexOf('{/* CIJFERS */}'), home.indexOf('{/* NIEUWS */}'));
check('homepage: LedenWaardering staat in de cijfers-rij', cijfers.includes('<LedenWaardering />') && cijfers.includes('gemiddelde waardering door leden'));
check('homepage: geen reviewsectie meer', !/LedenReviews|Wat leden van het Collectief vinden|Lid van het Collectief|WAARDERING DOOR LEDEN/.test(home));
check('homepage: "waardering door leden" niet meer als Binnenkort-label', !/'waardering door leden'/.test(home));
check('homepage: nog precies één Binnenkort (video-tegel)', (home.match(/Binnenkort/g) || []).length === 1);
check('homepage: vier tegels (FundingDatabaseCount, MemberCount, video, waardering)', cijfers.includes('<FundingDatabaseCount />') && cijfers.includes('<MemberCount />') && cijfers.includes("video's in de bibliotheek"));
const comp = readFileSync('src/shared/ui/LedenWaardering.jsx', 'utf8');
check('component: geen hardcoded waarde', !/5[,.]0|4[,.]\d|'—'/.test(comp));
check('component: gebruikt useLedenWaardering', /useLedenWaardering\(\)/.test(comp));
check('reviewkaart-component verwijderd', !existsSync('src/shared/ui/LedenReviews.jsx'));
const svc = readFileSync('src/data/services/ledenReviews.js', 'utf8');
check('service: gemiddelde via RPC, geen directe tabel', /sb\.rpc\('publieke_ledenwaardering'\)/.test(svc) && !/\.from\('member_reviews'\)/.test(svc));
check('service: geen hardcoded testwaarde', !/gemiddelde:\s*5(\.0)?\b/.test(svc));

console.log(`\nRESULTAAT: ${ok} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
