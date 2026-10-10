import { readFileSync } from 'node:fs';
import { normaliseerLedenReviews, MAX_LEDENREVIEWS } from '../../src/data/services/ledenReviews.js';

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

// --- homepage-integratie
const home = readFileSync('src/features/website/HomePage.jsx', 'utf8');
check('homepage: sectie tussen cijfers en nieuws', home.indexOf('{/* CIJFERS */}') < home.indexOf('<LedenReviews />') && home.indexOf('<LedenReviews />') < home.indexOf('{/* NIEUWS */}'));
check('homepage: één LedenReviews', (home.match(/<LedenReviews \/>/g) || []).length === 1);
const comp = readFileSync('src/shared/ui/LedenReviews.jsx', 'utf8');
check('component: geen hardcoded reviews', !/Lorem|Fictief|"rating":/.test(comp) && !/\[\s*\{\s*rating/.test(comp));
check('component: rendert niets zonder reviews', /if \(!reviews\.length\)\s*\{\s*return null;/.test(comp));

console.log(`\nRESULTAAT: ${ok} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
