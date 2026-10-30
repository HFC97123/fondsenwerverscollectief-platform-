import { readFileSync } from 'node:fs';
import { calls, zetAntwoord } from '../../src/data/client.js';
import { haalFondsOmvang, zetFondsOmvang, zetFunderPrive, OMVANG_KEUZES, haalOverigeVelden, zetOverigeVelden, gewijzigdeVelden } from '../../src/data/services/adminFondsInstellingen.js';

let ok = 0; let fout = 0;
const check = (n, w) => { if (w) ok += 1; else { fout += 1; console.log(`  FAIL: ${n}`); } };

zetAntwoord(() => ({ data: 'klein', error: null }));
let r = await haalFondsOmvang('f1');
check('omvang lezen', r.waarde === 'klein' && r.beschikbaar && calls.at(-1).naam === 'admin_fonds_omvang' && calls.at(-1).args.p_funder_id === 'f1');

zetAntwoord(() => ({ data: null, error: { message: 'function does not exist' } }));
r = await haalFondsOmvang('f1');
check('RPC ontbreekt: veld niet beschikbaar, standaard automatisch', !r.beschikbaar && r.waarde === 'auto');

zetAntwoord(() => ({ data: null, error: null }));
r = await zetFondsOmvang('f1', 'groot');
check('omvang zetten', r.ok && calls.at(-1).naam === 'admin_zet_fonds_omvang' && calls.at(-1).args.p_omvang === 'groot');

r = await zetFunderPrive('f1', { contactpersoon: false, email: true, telefoon: false });
const a = calls.at(-1);
check('privé-vlaggen zetten', r.ok && a.naam === 'admin_zet_funder_prive' && a.args.p_contactpersoon_prive === false && a.args.p_email_prive === true && a.args.p_telefoon_prive === false);

zetAntwoord(() => ({ data: null, error: { message: 'nee' } }));
r = await zetFunderPrive('f1', {});
check('fout geeft ok=false', !r.ok);
check('drie keuzes voor omvang', OMVANG_KEUZES.map((k) => k.value).join() === 'auto,groot,klein');

zetAntwoord(() => ({ data: { verified: true, data_tier: 'premium' }, error: null }));
r = await haalOverigeVelden('subsidieregelingen', 'r1');
check('overige velden lezen', r.beschikbaar && r.velden.verified === true && calls.at(-1).naam === 'admin_get_overige_velden' && calls.at(-1).args.p_tabel === 'subsidieregelingen');
zetAntwoord(() => ({ data: null, error: { message: 'x' } }));
r = await haalOverigeVelden('funders', 'f1');
check('overige velden: RPC ontbreekt -> niet beschikbaar', !r.beschikbaar);
zetAntwoord(() => ({ data: null, error: null }));
r = await zetOverigeVelden('funders', 'f1', { adres: null });
check('overige velden zetten', r.ok && calls.at(-1).args.p_velden.adres === null && calls.at(-1).naam === 'admin_zet_overige_velden');
const g = gewijzigdeVelden({ a: 'x', b: '', c: 1, d: null }, { a: 'x', b: 'y', c: 1, d: null });
check('alleen gewijzigde velden, leeg wordt null', JSON.stringify(g) === '{"b":null}');

// SQL: alleen beheerders, grants
const sql = readFileSync(new URL('../../supabase/migrations/20261030120000_beheer_funder_prive_vlaggen.sql', import.meta.url), 'utf8');
check('sql: beheerderscontrole', /current_user_is_admin\(\)/.test(sql));
check('sql: overige velden alleen voor beheerders', /admin_zet_overige_velden/.test(sql) && /admin_get_overige_velden/.test(sql));
check('sql: niet voor anon', /revoke all on function public\.admin_zet_funder_prive.*from public, anon/.test(sql));

// UI-bron: velden aanwezig
const ui = readFileSync(new URL('../../src/features/admin/AdminFunders.jsx', import.meta.url), 'utf8');
const dl = readFileSync(new URL('../../src/features/admin/AdminDeadlines.jsx', import.meta.url), 'utf8');
check('ui: overige gegevens bij fonds en regeling', ui.includes('OverigeVeldenSectie tabel="funders"') && dl.includes('OverigeVeldenSectie tabel="subsidieregelingen"'));
check('ui: privé-vinkjes en omvang-keuze', ui.includes('admin-prive-vlaggen') && ui.includes('admin-fonds-omvang') && ui.includes('zetFunderPrive'));

console.log(`${ok} goed, ${fout} fout`);
process.exit(fout ? 1 : 0);
