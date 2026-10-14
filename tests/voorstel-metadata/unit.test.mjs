// Server-kant van de voorstelmetadata (v2) + token-/idempotentieontwerp. Zuivere functies, geen netwerk, geen database.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  controleerMetadata, bepaalVerificatieStatus, bouwMetadata, METADATA_VERSIE,
} from '../../supabase/functions/_shared/voorstelMetadata.ts';
import {
  canoniekeJson, voorstelHash, maakToken, controleerToken, opslagSleutel, MAX_GELDIGHEID_SECONDEN,
} from '../../supabase/functions/_shared/voorstelToken.ts';

let ok = 0; let fout = 0;
const check = (naam, waar) => { if (waar) ok++; else { fout++; console.log('FAIL  ' + naam); } };
const gelijk = (naam, a, b) => { const x = JSON.stringify(a); const y = JSON.stringify(b); if (x === y) ok++; else { fout++; console.log('FAIL  ' + naam + '\n  kreeg    ' + x + '\n  verwacht ' + y); } };

const H = '0123456789abcdef'.repeat(4);
const BEWIJS = { bron_url: 'https://fonds-a.example.nl/aanvragen', gecontroleerd_op: '2026-10-14T10:00:00Z', pagina_sha256: H };

// ---- 1. Pariteit met de SQL-schemacontrole: hetzelfde fixturebestand ------------------------------------------------
const fixtures = JSON.parse(readFileSync('supabase/tests/voorstel-metadata/fixtures.json', 'utf8'));
check('fixturebestand heeft voldoende gevallen', fixtures.length >= 45);
for (const f of fixtures) gelijk('schema (JS-spiegel) ' + f.naam, controleerMetadata(f.meta).geldig, f.geldig);

// ---- 2. De samenvattende status wordt AFGELEID, nooit opgegeven -----------------------------------------------------------
const vNaam = { status: 'confirmed', fragment: 'Fonds A' };
const vDl = { status: 'confirmed', waarde: '2026-11-15', fragment: 'uiterlijk 15 november 2026' };
gelijk('naam + deadline met citaat + bewijs = geverifieerd', bepaalVerificatieStatus({ fondsnaam: vNaam, deadline: vDl }, BEWIJS), 'geverifieerd');
gelijk('zonder bewijs (pagina niet opgehaald) nooit geverifieerd', bepaalVerificatieStatus({ fondsnaam: vNaam, deadline: vDl }, {}), 'niet_gecontroleerd');
gelijk('zonder paginahash nooit geverifieerd', bepaalVerificatieStatus({ fondsnaam: vNaam, deadline: vDl }, { ...BEWIJS, pagina_sha256: undefined }), 'niet_gecontroleerd');
gelijk('deadline zonder citaat: gedeeltelijk', bepaalVerificatieStatus({ fondsnaam: vNaam, deadline: { status: 'confirmed' } }, BEWIJS), 'gedeeltelijk');
gelijk('deadline onzeker: gedeeltelijk', bepaalVerificatieStatus({ fondsnaam: vNaam, deadline: { status: 'uncertain' } }, BEWIJS), 'gedeeltelijk');
gelijk('fondsnaam niet bevestigd: onzeker', bepaalVerificatieStatus({ fondsnaam: { status: 'uncertain' }, deadline: vDl }, BEWIJS), 'onzeker');
gelijk('een extra onzeker veld haalt "geverifieerd" weg', bepaalVerificatieStatus({ fondsnaam: vNaam, deadline: vDl, doelgroep: { status: 'uncertain' } }, BEWIJS), 'gedeeltelijk');
gelijk('conflict wint van alles', bepaalVerificatieStatus({ fondsnaam: vNaam, deadline: { status: 'conflict' } }, BEWIJS), 'conflict');
gelijk('alles not_checked: niet_gecontroleerd', bepaalVerificatieStatus({ fondsnaam: { status: 'not_checked' } }, BEWIJS), 'niet_gecontroleerd');
gelijk('geen velden: niet_gecontroleerd', bepaalVerificatieStatus(undefined, {}), 'niet_gecontroleerd');

// ---- 3. bouwMetadata ------------------------------------------------------------------------------------------------------
const m1 = bouwMetadata({ herkomst: 'online', vandaag: '2026-10-14', voorgesteldBedrag: 5000, verificatie: { ...BEWIJS, velden: { fondsnaam: vNaam, deadline: vDl } } });
check('server-bewijs geeft geverifieerde metadata', m1 && m1.verificatie.status === 'geverifieerd' && m1.server_generated === true && m1.versie === METADATA_VERSIE);
check('de uitkomst haalt het schema', controleerMetadata(m1).geldig);
const m2 = bouwMetadata({ herkomst: 'online', vandaag: '2026-10-14', voorgesteldBedrag: 5000 });
gelijk('online zonder enig bewijs: niet_gecontroleerd', m2.verificatie, { status: 'niet_gecontroleerd' });
const m3 = bouwMetadata({ herkomst: 'regeling', vandaag: '2026-10-14', voorgesteldBedrag: null });
check('regeling zonder verificatie: geen verificatieblok, geen claim', m3 && m3.verificatie === undefined);
const m4 = bouwMetadata({ herkomst: 'fonds', vandaag: '2026-10-14', verificatie: { ...BEWIJS, velden: { fondsnaam: vNaam, deadline: { status: 'conflict', waarde: '2026-11-15', db_waarde: '2026-11-12', fragment: 'uiterlijk 15 november 2026' } } } });
gelijk('conflict: status, beide waarden, bron en tijdstip herleidbaar', [m4.verificatie.status, m4.verificatie.velden.deadline.waarde, m4.verificatie.velden.deadline.db_waarde, m4.verificatie.bron_url, m4.verificatie.gecontroleerd_op], ['conflict', '2026-11-15', '2026-11-12', BEWIJS.bron_url, BEWIJS.gecontroleerd_op]);
check('conflict zonder databasewaarde levert geen metadata op (geen onherleidbaar conflict)', bouwMetadata({ herkomst: 'fonds', vandaag: '2026-10-14', verificatie: { ...BEWIJS, velden: { deadline: { status: 'conflict', waarde: '2026-11-15', fragment: 'x' } } } }) === null);
check('ongeldige datum van vandaag levert geen metadata op', bouwMetadata({ herkomst: 'regeling', vandaag: 'vandaag' }) === null);
check('een aanroeper kan de samenvattende status niet opgeven', (() => { const m = bouwMetadata({ herkomst: 'online', vandaag: '2026-10-14', verificatie: { ...BEWIJS, status: 'geverifieerd', velden: { fondsnaam: { status: 'uncertain' } } } }); return m && m.verificatie.status !== 'geverifieerd'; })());
check('metadata bevat geen brondata-kopieën (alleen toegestane sleutels)', Object.keys(m1).every((k) => ['versie', 'server_generated', 'herkomst', 'voorgesteld_op', 'voorgesteld_bedrag', 'verificatie'].includes(k)));
check('compact: ruim onder 8000 bytes', JSON.stringify(m1).length < 1500);

// ---- 4. Geen clientpad naar de metadata ------------------------------------------------------------------------------------
function bestanden(map) { return readdirSync(map).flatMap((n) => { const p = join(map, n); return statSync(p).isDirectory() ? bestanden(p) : [p]; }); }
const zonderCommentaar = (t) => t.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
const brontekst = bestanden('src').filter((p) => /\.(js|jsx|ts|tsx)$/.test(p));
check('geen enkel bestand onder src importeert de server-metadatabouwer of het token', !brontekst.some((p) => /voorstelMetadata|voorstelToken/.test(readFileSync(p, 'utf8'))));
check('de client schrijft nooit de kolom voorstel (geen voorstel-veld in code die de financieringstabel beschrijft)', !brontekst.some((p) => { const t = zonderCommentaar(readFileSync(p, 'utf8')); return /subsidie_kompas_program_funding/.test(t) && /\.(insert|update|upsert)\(/.test(t) && /(^|[\s{,])voorstel\s*[:,}]/.test(t); }));
check('de client schrijft nooit voorstel_sleutel of bron_deadline_bij_voorstel', !brontekst.filter((p) => !/actieplan\.js$|actiesEnDeadlines\.js$/.test(p)).some((p) => /voorstel_sleutel|bron_deadline_bij_voorstel/.test(readFileSync(p, 'utf8'))));
check('geen select("*") of select() op de financieringstabel (kolomrechten)', !brontekst.some((p) => { const t = readFileSync(p, 'utf8'); return /subsidie_kompas_program_funding['"`]\)\s*\.select\(\s*(['"`]\*['"`])?\s*\)/.test(t); }));

// ---- 4b. De migratie raakt de rekenbron en de rechten niet verkeerd aan (statische controle; de echte controle staat in de SQL-test) ----------
const mig = readFileSync('supabase/voorstel-niet-uitgevoerd/20261014120000_voorstel_metadata.sql', 'utf8').split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
check('de migratie definieert kompas_dekkingsplan niet opnieuw (enige rekenbron blijft ongewijzigd)', !/create (or replace )?function public\.kompas_dekkingsplan/i.test(mig));
check('de migratie geeft authenticated nergens een recht op voorstel', !/grant\s+(insert|update|select)\s*\([^)]*\bvoorstel\b[^)]*\)/i.test(mig) && !/grant\s+(all|select|insert|update)\s+on\s+(table\s+)?public\.subsidie_kompas_program_funding\s+to\s+authenticated/i.test(mig));
check('de migratie trekt het tabelbrede SELECT in', /revoke select on table public\.subsidie_kompas_program_funding from authenticated/i.test(mig));
check('scheme_id en funder_id zitten niet in de kolomrechten voor SELECT (bronverwijzing omzeilt de maskering niet)', (() => { const m = /grant select \(([^)]*)\)\s+on table public\.subsidie_kompas_program_funding to authenticated/i.exec(mig); return Boolean(m) && !/scheme_id|funder_id|voorstel/.test(m[1]) && /requested_amount/.test(m[1]) && /\bnotes\b/.test(m[1]); })());
check('geen enkele clientcode leest scheme_id of funder_id rechtstreeks uit de financieringstabel', !brontekst.some((p) => { const t = zonderCommentaar(readFileSync(p, 'utf8')); return /from\('subsidie_kompas_program_funding'\)[\s\S]{0,200}\.(select|eq|in|order)\([^)]*(scheme_id|funder_id)/.test(t); }));
check('de migratie geeft de nieuwe actiekolommen geen clientrecht', !/grant[^;]*voorstel_sleutel/i.test(mig) && !/grant[^;]*bron_deadline_bij_voorstel/i.test(mig));
check('de RPC is security definer met vaste search_path en niet uitvoerbaar voor anon', /security definer\s+set search_path = public, pg_temp/i.test(mig) && /revoke all on function public\.kompas_voorstel_metadata\(uuid\) from public, anon/i.test(mig));

// ---- 5. Hash ---------------------------------------------------------------------------------------------------------------
const voorstel = { regels: [{ id: 'r1', bedrag: 5000, meta: m1 }], acties: [{ sleutel: 'a', titel: 'Aanvraag' }], gat: 12000 };
const h1 = await voorstelHash(voorstel);
check('hash is 64 hex tekens', /^[0-9a-f]{64}$/.test(h1));
check('hash is deterministisch', h1 === await voorstelHash(JSON.parse(JSON.stringify(voorstel))));
check('sleutelvolgorde maakt niet uit', h1 === await voorstelHash({ gat: 12000, acties: [{ titel: 'Aanvraag', sleutel: 'a' }], regels: [{ meta: m1, bedrag: 5000, id: 'r1' }] }));
check('ander bedrag: andere hash', h1 !== await voorstelHash({ ...voorstel, regels: [{ ...voorstel.regels[0], bedrag: 5001 }] }));
check('andere verificatiestatus: andere hash', h1 !== await voorstelHash({ ...voorstel, regels: [{ ...voorstel.regels[0], meta: { ...m1, verificatie: { ...m1.verificatie, status: 'gedeeltelijk' } } }] }));
check('extra regel: andere hash', h1 !== await voorstelHash({ ...voorstel, regels: [...voorstel.regels, { id: 'r2' }] }));
check('volgorde van de regels is betekenisvol', await voorstelHash({ regels: [1, 2] }) !== await voorstelHash({ regels: [2, 1] }));
check('undefined-velden tellen niet mee', await voorstelHash({ a: 1, b: undefined }) === await voorstelHash({ a: 1 }));
check('NaN wordt geweigerd', (() => { try { canoniekeJson({ a: NaN }); return false; } catch { return true; } })());

// ---- 6. Token: binding aan gebruiker, project, voorstel en tijd ---------------------------------------------------------------
const GEHEIM = 'x'.repeat(40) + '-testgeheim-niet-voor-productie';
const NU = 1_800_000_000;
const JTI = '3f2b8c1e-5a7d-4c9e-9b1a-0d6e2f4a8c11';
const U = 'aaaaaaaa-0000-4000-8000-000000000001'; const P = '11111111-0000-4000-8000-000000000001';
const token = await maakToken({ jti: JTI, uid: U, pid: P, hash: h1, nu: NU }, GEHEIM);
const goed = await controleerToken(token, GEHEIM, { uid: U, pid: P, hash: h1, nu: NU + 10 });
check('geldig token wordt geaccepteerd en geeft jti terug', goed.ok === true && goed.claims.jti === JTI);
gelijk('verlopen token', (await controleerToken(token, GEHEIM, { uid: U, pid: P, hash: h1, nu: NU + 1800 })).reden, 'verlopen');
gelijk('net voor het verlopen nog geldig', (await controleerToken(token, GEHEIM, { uid: U, pid: P, hash: h1, nu: NU + 1799 })).ok, true);
gelijk('andere gebruiker', (await controleerToken(token, GEHEIM, { uid: 'bbbbbbbb-0000-4000-8000-000000000002', pid: P, hash: h1, nu: NU })).reden, 'andere-gebruiker');
gelijk('ander project', (await controleerToken(token, GEHEIM, { uid: U, pid: '22222222-0000-4000-8000-000000000002', hash: h1, nu: NU })).reden, 'ander-project');
const h2 = await voorstelHash({ ...voorstel, gat: 1 });
gelijk('token van voorstel A is onbruikbaar voor gewijzigd voorstel B', (await controleerToken(token, GEHEIM, { uid: U, pid: P, hash: h2, nu: NU })).reden, 'ander-voorstel');
gelijk('ander geheim', (await controleerToken(token, GEHEIM.replace('x', 'y'), { uid: U, pid: P, hash: h1, nu: NU })).reden, 'ongeldige-handtekening');
const [pl, sg] = token.split('.');
const vervalst = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(pl, 'base64url').toString()), uid: 'bbbbbbbb-0000-4000-8000-000000000002' })).toString('base64url') + '.' + sg;
gelijk('aangepaste claims met oude handtekening', (await controleerToken(vervalst, GEHEIM, { uid: 'bbbbbbbb-0000-4000-8000-000000000002', pid: P, hash: h1, nu: NU })).reden, 'ongeldige-handtekening');
gelijk('afgeknot token', (await controleerToken(token.slice(0, -4), GEHEIM, { uid: U, pid: P, hash: h1, nu: NU })).ok, false);
gelijk('geen token', (await controleerToken(undefined, GEHEIM, { uid: U, pid: P, hash: h1, nu: NU })).reden, 'ongeldig-formaat');
gelijk('rommel', (await controleerToken('abc', GEHEIM, { uid: U, pid: P, hash: h1, nu: NU })).reden, 'ongeldig-formaat');
gelijk('token uit de toekomst', (await controleerToken(await maakToken({ jti: JTI, uid: U, pid: P, hash: h1, nu: NU + 5000 }, GEHEIM), GEHEIM, { uid: U, pid: P, hash: h1, nu: NU })).reden, 'nog-niet-geldig');
const lang = await maakToken({ jti: JTI, uid: U, pid: P, hash: h1, nu: NU, geldigheidSeconden: 10 ** 9 }, GEHEIM);
gelijk('geldigheid wordt begrensd', (await controleerToken(lang, GEHEIM, { uid: U, pid: P, hash: h1, nu: NU + MAX_GELDIGHEID_SECONDEN })).reden, 'verlopen');
check('te kort geheim wordt geweigerd', await maakToken({ jti: JTI, uid: U, pid: P, hash: h1, nu: NU }, 'kort').then(() => false, () => true));
check('token bevat geen voorstelinhoud, alleen de hash', !Buffer.from(pl, 'base64url').toString().includes('Aanvraag') && Buffer.from(pl, 'base64url').toString().includes(h1));

// ---- 7. Idempotentiesleutels --------------------------------------------------------------------------------------------------
check('sleutel is deterministisch (retry/dubbelklik raakt dezelfde rij)', opslagSleutel(JTI, 'r1', 'indienen') === opslagSleutel(JTI, 'r1', 'indienen'));
check('ander voorstel: andere sleutel', opslagSleutel(JTI, 'r1', 'indienen') !== opslagSleutel('4f2b8c1e-5a7d-4c9e-9b1a-0d6e2f4a8c11', 'r1', 'indienen'));
check('andere taak: andere sleutel', opslagSleutel(JTI, 'r1', 'indienen') !== opslagSleutel(JTI, 'r1', 'stukken'));
check('sleutel past in 200 tekens en bevat geen rommel', opslagSleutel(JTI, 'x'.repeat(500), 'Rare Tekens!!') .length <= 200 && /^[a-z0-9:_.-]+$/.test(opslagSleutel(JTI, 'Rare Tekens!!', 'é')));

console.log(`voorstel-metadata (server): OK ${ok}  FAIL ${fout}`);
process.exit(fout ? 1 : 0);
