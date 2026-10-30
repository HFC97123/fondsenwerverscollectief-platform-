import { readFileSync, existsSync } from 'node:fs';
import {
  valideerFoto, maakFotoPad, normaliseerBio, valideerBio, uploadProfielFoto, verwijderProfielFoto, slaBioOp, haalFotoUrl,
  MAX_FOTO_BYTES, MAX_BIO_TEKENS, FOTO_TYPES, PROFIEL_BUCKET,
} from '../../src/data/services/profielFoto.js';

let ok = 0; let fail = 0;
const check = (naam, c, extra = '') => { if (c) ok += 1; else { fail += 1; console.log('FAIL:', naam, extra); } };
const bestand = (type, size, name = 'x') => ({ type, size, name });
const UID = '53570dd6-9b3e-4541-b2b1-80c9800c6695';
const nieuw = (faal = null, objecten = []) => { globalThis.__SB = { log: [], objecten: new Set(objecten), faal }; return globalThis.__SB; };

// --- bestandscontrole
check('JPEG toegestaan', valideerFoto(bestand('image/jpeg', 1000)).ok);
check('PNG toegestaan', valideerFoto(bestand('image/png', 1000)).ok);
check('WebP toegestaan', valideerFoto(bestand('image/webp', 1000)).ok);
check('precies 5 MB toegestaan', valideerFoto(bestand('image/png', MAX_FOTO_BYTES)).ok && MAX_FOTO_BYTES === 5 * 1024 * 1024);
check('5 MB + 1 byte te groot', !valideerFoto(bestand('image/png', MAX_FOTO_BYTES + 1)).ok && /te groot/.test(valideerFoto(bestand('image/png', MAX_FOTO_BYTES + 1)).fout));
check('te groot noemt de limiet (5,0 MB)', /5,0 MB/.test(valideerFoto(bestand('image/jpeg', 9 * 1024 * 1024)).fout));
for (const t of ['image/gif', 'image/svg+xml', 'image/bmp', 'image/tiff', 'application/pdf', 'text/html', 'application/x-msdownload', '']) {
  check(`type ${t || '(leeg)'} geweigerd`, !valideerFoto(bestand(t, 1000)).ok && /bestandstype/.test(valideerFoto(bestand(t, 1000)).fout));
}
check('SVG (script-risico) geweigerd', !valideerFoto(bestand('image/svg+xml', 10)).ok);
check('leeg bestand geweigerd', !valideerFoto(bestand('image/png', 0)).ok && /leeg/.test(valideerFoto(bestand('image/png', 0)).fout));
check('geen bestand geweigerd', !valideerFoto(null).ok && !valideerFoto(undefined).ok && !valideerFoto('x').ok);
check('prototype-trucs geweigerd (toString/__proto__)', !valideerFoto(bestand('toString', 10)).ok && !valideerFoto(bestand('__proto__', 10)).ok);
check('alleen JPEG/PNG/WebP in FOTO_TYPES', Object.keys(FOTO_TYPES).sort().join() === 'image/jpeg,image/png,image/webp');

// --- pad
const pad = maakFotoPad(UID, 'image/jpeg', 1791700000000, 'abcd1234');
check('pad = <uid>/avatar-<tijd>-<willekeur>.jpg', pad === `${UID}/avatar-1791700000000-abcd1234.jpg`, pad);
check('extensie volgt type (png/webp)', maakFotoPad(UID, 'image/png').endsWith('.png') && maakFotoPad(UID, 'image/webp').endsWith('.webp'));
const re = new RegExp(`^${UID}/avatar-[0-9]{10,}-[a-z0-9]{4,12}\\.(jpg|png|webp)$`);
check('willekeurig pad voldoet aan het DB-patroon (100x)', Array.from({ length: 100 }, () => maakFotoPad(UID, 'image/webp')).every((p) => re.test(p)));
check('twee paden zijn verschillend (geen overschrijven)', maakFotoPad(UID, 'image/png') !== maakFotoPad(UID, 'image/png'));

// --- bio
check('bio getrimd', normaliseerBio('  hoi  ') === 'hoi' && normaliseerBio(null) === '' && normaliseerBio(undefined) === '' && normaliseerBio(5) === '');
check('bio 2000 tekens ok, 2001 niet', valideerBio('x'.repeat(2000)).ok && !valideerBio('x'.repeat(2001)).ok && MAX_BIO_TEKENS === 2000);
check('lege bio is toegestaan (verwijdert beschrijving)', valideerBio('   ').ok && valideerBio('   ').bio === '');
check('meerregelige bio blijft intact', valideerBio('a\n\nb').bio === 'a\n\nb');
check('te lange bio noemt aantallen', /2000/.test(valideerBio('x'.repeat(2100)).fout) && /2100/.test(valideerBio('x'.repeat(2100)).fout));

// --- upload / vervangen / verwijderen met stub-Supabase
let s = nieuw();
let res = await uploadProfielFoto({ userId: UID, file: bestand('image/jpeg', 5000), oudPad: null });
check('upload: pad teruggegeven', re.test(res.pad), res);
check('upload: bucket profile-images, geen upsert, juiste content-type', s.log[0].bucket === PROFIEL_BUCKET && PROFIEL_BUCKET === 'profile-images' && s.log[0].opties.upsert === false && s.log[0].opties.contentType === 'image/jpeg');
check('upload: daarna RPC zet_mijn_avatar met hetzelfde pad', s.log[1].op === 'rpc' && s.log[1].naam === 'zet_mijn_avatar' && s.log[1].args.p_pad === res.pad);
check('upload: geen id-parameter in RPC (alleen eigen profiel)', Object.keys(s.log[1].args).join() === 'p_pad');
check('upload: niets verwijderd zonder oude foto', !s.log.some((l) => l.op === 'remove'));

s = nieuw(null, ['oud']);
res = await uploadProfielFoto({ userId: UID, file: bestand('image/png', 5000), oudPad: 'oud' });
check('vervangen: nieuw pad, oude foto opgeruimd', re.test(res.pad) && s.log.some((l) => l.op === 'remove' && l.paden[0] === 'oud') && !s.objecten.has('oud') && s.objecten.has(res.pad));
check('vervangen: oud bestand pas verwijderd NA de RPC', s.log.findIndex((l) => l.op === 'remove') > s.log.findIndex((l) => l.op === 'rpc'));

s = nieuw();
res = await uploadProfielFoto({ userId: UID, file: bestand('image/gif', 5000) });
check('verkeerd type: geen netwerkverkeer, foutmelding', res.fout && /bestandstype/.test(res.fout) && s.log.length === 0);
res = await uploadProfielFoto({ userId: UID, file: bestand('image/png', MAX_FOTO_BYTES + 1) });
check('te groot: geen netwerkverkeer, foutmelding', res.fout && /te groot/.test(res.fout) && s.log.length === 0);

s = nieuw('upload');
res = await uploadProfielFoto({ userId: UID, file: bestand('image/jpeg', 5000), oudPad: 'oud' });
check('upload mislukt: duidelijke foutmelding, geen RPC, oude foto blijft', res.fout && /niet worden opgeslagen/.test(res.fout) && !s.log.some((l) => l.op === 'rpc' || l.op === 'remove'));

s = nieuw('rpc', []);
res = await uploadProfielFoto({ userId: UID, file: bestand('image/jpeg', 5000), oudPad: 'oud' });
check('RPC mislukt: nieuw bestand wordt weer opgeruimd, oude foto blijft', res.fout && s.objecten.size === 0 && !s.log.some((l) => l.op === 'remove' && l.paden.includes('oud')));

s = nieuw('remove', []);
res = await uploadProfielFoto({ userId: UID, file: bestand('image/jpeg', 5000), oudPad: 'oud' });
check('opruimen van oude foto mislukt: upload telt toch als geslaagd', !res.fout && re.test(res.pad));

res = await uploadProfielFoto({ userId: '', file: bestand('image/jpeg', 5000) });
check('zonder gebruiker: foutmelding', !!res.fout);

s = nieuw(null, ['p1']);
res = await verwijderProfielFoto({ oudPad: 'p1' });
check('verwijderen: RPC met null, daarna bestand weg', res.ok && s.log[0].op === 'rpc' && s.log[0].args.p_pad === null && !s.objecten.has('p1'));
s = nieuw('rpc', ['p1']);
res = await verwijderProfielFoto({ oudPad: 'p1' });
check('verwijderen mislukt: foutmelding en bestand blijft staan', res.fout && s.objecten.has('p1'));

s = nieuw();
res = await slaBioOp('  Werkzaam als zelfstandig fondsenwerver.  ');
check('bio opslaan: RPC zet_mijn_bio met getrimde tekst, zonder id', res.ok && s.log[0].naam === 'zet_mijn_bio' && s.log[0].args.p_bio === 'Werkzaam als zelfstandig fondsenwerver.' && Object.keys(s.log[0].args).join() === 'p_bio');
s = nieuw();
res = await slaBioOp('x'.repeat(2001));
check('bio te lang: geweigerd zonder RPC', res.fout && s.log.length === 0);
s = nieuw('rpc');
res = await slaBioOp('hoi');
check('bio RPC-fout: foutmelding', res.fout && /beschrijving/.test(res.fout));

// --- signed URL
s = nieuw(null, ['a/b.jpg']);
const u1 = await haalFotoUrl('a/b.jpg'); const u2 = await haalFotoUrl('a/b.jpg');
check('signed URL: tweede keer uit cache (1 aanroep)', u1 && u1 === u2 && s.log.filter((l) => l.op === 'signed').length === 1);
check('signed URL: geldigheid 1 uur', s.log.find((l) => l.op === 'signed').sec === 3600);
check('signed URL voor onbestaand/zonder pad = null', (await haalFotoUrl('niet/bestaand.jpg')) === null && (await haalFotoUrl(null)) === null && (await haalFotoUrl('')) === null);

// --- migratie (statisch)
const sql = readFileSync('supabase/migrations/20261011120000_ledenprofiel_foto_en_bio.sql', 'utf8');
const code = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
check('migratie: bucket privé, 5 MB, alleen jpeg/png/webp', /'profile-images', 'profile-images', false, 5242880, array\['image\/jpeg', 'image\/png', 'image\/webp'\]/.test(code));
check('migratie: bucket NIET publiek', !/profile-images'[^)]*true/.test(code));
check('migratie: bio max 1200 en avatar_path als tekst (geen base64-kolom)', /bio text constraint profiles_bio_lengte check \(bio is null or char_length\(bio\) <= 1200\)/.test(code) && /avatar_path text constraint/.test(code));
const sql2 = readFileSync('supabase/migrations/20261030100000_bio_2000_tekens.sql', 'utf8').split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
check('migratie 2000: constraint en functie staan allebei op 2000, niets op 1200', /char_length\(bio\) <= 2000/.test(sql2) && /char_length\(v_bio\) > 2000/.test(sql2) && !/1200/.test(sql2));
check('migratie: alleen twee kolommen toegevoegd', (code.match(/add column if not exists/g) || []).length === 2);
check('migratie: geen UPDATE-policy of -grant op profiles of storage (geen overschrijven)', !/for update/i.test(code) && !/grant\s+update/i.test(code) && !/on public\.profiles\s+for/i.test(code));
check('migratie: precies 3 storage-policies (select/insert/delete), alleen authenticated', (code.match(/create policy/g) || []).length === 3 && (code.match(/for (select|insert|delete) to authenticated/g) || []).length === 3 && !/to anon|to public/i.test(code));
check('migratie: eigen map via auth.uid()', (code.match(/\(storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)\)::text/g) || []).length === 2);
check('migratie: upload alleen in eigen map met vast bestandspatroon en alleen als goedgekeurd lid', /name ~ \('\^' \|\| \(select auth\.uid\(\)\)::text \|\| '\/avatar-\[0-9\]\{10,\}-\[a-z0-9\]\{4,12\}\\\.\(jpg\|png\|webp\)\$'\)/.test(code) && /p\.status = 'approved'/.test(code));
check('migratie: admins via private.is_admin() (lezen/verwijderen)', (code.match(/private\.is_admin\(\)/g) || []).length === 2);
check('migratie: RPC\'s security definer, auth.uid(), geen id-parameter', (code.match(/security definer/g) || []).length === 2 && /zet_mijn_bio\(p_bio text\)/.test(code) && /zet_mijn_avatar\(p_pad text\)/.test(code) && !/p_user_id|p_id\b/.test(code));
check('migratie: RPC\'s wijzigen alleen eigen rij en alleen bio/avatar_path', /update public\.profiles set bio = v_bio where id = v_uid/.test(code) && /update public\.profiles set avatar_path = v_pad where id = v_uid/.test(code) && (code.match(/update public\.profiles/g) || []).length === 2);
check('migratie: execute alleen voor authenticated, ingetrokken voor anon/public', /revoke all on function public\.zet_mijn_bio\(text\), public\.zet_mijn_avatar\(text\) from public, anon, authenticated, service_role/.test(code) && /grant execute on function public\.zet_mijn_bio\(text\), public\.zet_mijn_avatar\(text\) to authenticated/.test(code));
check('migratie: avatar-pad moet bestaand object zijn', /from storage\.objects o where o\.bucket_id = 'profile-images' and o\.name = v_pad/.test(code));
check('migratie: geen insert/seed in profiles of demodata', !/insert\s+into\s+public\./i.test(code) && !/delete from|truncate/i.test(code));

// --- code (statisch)
const svc = readFileSync('src/data/services/profielFoto.js', 'utf8');
const ui = readFileSync('src/features/website/LedenProfiel.jsx', 'utf8') + readFileSync('src/shared/ui/ProfielAvatar.jsx', 'utf8');
check('geen base64/dataURL-opslag in de code', !/readAsDataURL|toDataURL|btoa\(|;base64/.test(svc + ui));
check('geen directe profiles-update vanuit de frontend', !/from\('profiles'\)\s*\.(update|upsert|insert)/.test(svc + ui));
check('foto via private bucket + signed URL (geen getPublicUrl)', /createSignedUrl/.test(svc) && !/getPublicUrl/.test(svc + ui));
check('avatar: object-fit cover en initialen-fallback bij fout', /objectFit: 'cover'/.test(ui) && /onError=/.test(ui) && /initialen/.test(ui));
check('bio-weergave behoudt regeleindes en breekt lange woorden af', /white-space: pre-line/.test(ui) && /overflow-wrap: anywhere/.test(ui));
check('geen losse velden voor werkgever/functie/opdrachten/sectoren', !/werkgever|employer|job_title|sector\b|opdracht(en)?_type/i.test(sql + svc));
const profielSvc = readFileSync('src/data/services/profile.js', 'utf8');
check('PROFILE_FIELDS bevat bio en avatar_path', /bio, avatar_path/.test(profielSvc));
const net = readFileSync('src/features/website/NetwerkPage.jsx', 'utf8');
check('netwerk: foto/bio alleen bewerkbaar voor goedgekeurd lid met profiel', (net.match(/magBewerken=\{Boolean\(isApproved && profile\)\}/g) || []).length === 2);
check('netwerk: hardcoded nep-bio is weg', !/Fondsenwerver met hart voor maatschappelijke projecten/.test(net));
check('netwerk: nog steeds geen ledenlijst/smoelenboek (alleen eigen profiel)', !/members\.map|ledenlijst\.map|smoelenboek\.map/.test(net));
check('stub-test: bestand bestaat', existsSync('tests/ledenprofiel/stubclient.js'));

console.log(`\nRESULTAAT: ${ok} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
