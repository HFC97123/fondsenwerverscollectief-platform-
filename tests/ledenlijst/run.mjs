// Statische controles voor de ledenlijst (node tests/ledenlijst/run.mjs).
import { readFileSync } from 'node:fs';

let ok = 0, fail = 0;
const check = (n, c) => { if (c) ok += 1; else { fail += 1; console.log('FAIL:', n); } };
const lees = (p) => readFileSync(p, 'utf8');

const mig = lees('supabase/migrations/20261030140000_ledenlijst.sql');
const netwerk = lees('src/features/website/NetwerkPage.jsx');
const lijst = lees('src/features/website/LedenLijst.jsx');
const profiel = lees('src/features/website/LedenProfiel.jsx');
const dienst = lees('src/data/services/ledenlijst.js');
const velden = lees('src/data/services/profile.js');

// database
check('kolommen website/profiel_zichtbaar/email_zichtbaar', /add column if not exists website/.test(mig) && /profiel_zichtbaar boolean not null default false/.test(mig) && /email_zichtbaar boolean not null default false/.test(mig));
check('lijst alleen voor goedgekeurde leden', /me\.status = 'approved'/.test(mig) && /raise exception 'Alleen voor leden'/.test(mig));
check('lijst alleen zichtbare leden', /and p\.profiel_zichtbaar/.test(mig));
check('e-mail alleen als het lid dat kiest', /case when p\.email_zichtbaar then p\.email else null end/.test(mig));
check('geen anon-rechten', /revoke all on function public\.ledenlijst\(\) from public, anon/.test(mig) && /revoke all on function public\.zet_mijn_ledengegevens/.test(mig));
check('website gecontroleerd (alleen http/https)', /\^https\?:\/\//.test(mig) && /char_length\(v_site\) > 200/.test(mig));
check('foto alleen van zichtbare leden', /mag_profielfoto_zien/.test(mig) && /p\.avatar_path = p_naam and p\.status = 'approved' and p\.profiel_zichtbaar/.test(mig));

// frontend
check('profiel laadt de nieuwe velden', /website, profiel_zichtbaar, email_zichtbaar/.test(velden));
check('ledenlijst alleen voor ingelogde goedgekeurde leden', /isLoggedIn && isApproved && \(\s*<LedenLijst/.test(netwerk));
check('schakelaar en gegevens in het eigen profiel', netwerk.includes('<ZichtbaarheidSchakelaar') && netwerk.includes('<LedenGegevens'));
check('schakelaar is role=switch', /role="switch"/.test(profiel) && /aria-checked/.test(profiel));
check('website-link veilig (alleen http/https, noopener)', /veiligeWebsite/.test(lijst) && /rel="noopener noreferrer"/.test(lijst) && /\^https\?:\\\/\\\//.test(dienst));
check('RPC-namen', dienst.includes("rpc('ledenlijst')") && dienst.includes("rpc('zet_mijn_ledengegevens'"));

console.log(`\nRESULTAAT: ${ok} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
