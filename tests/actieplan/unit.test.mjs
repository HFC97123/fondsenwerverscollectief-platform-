import { readFileSync } from 'node:fs';
import {
  ACTIE_GROEPEN, valideerActie, patchVoorActie, pasActieWijzigingToe, actieGroep, groepeerTaken, sorteerTaken, deadlineTekst, afgeleidNaarTaak,
  verbergAlOpgeslagen, telOpenTaken, actieUitRij, isEchteDatum, MAX_TITEL, MAX_NOTITIE,
} from '../../src/features/kompas-app/financiering/actieplan.js';

let ok = 0; let fail = 0;
const check = (n, c, d = '') => { if (c) { ok += 1; console.log('OK  ', n); } else { fail += 1; console.log('FAIL', n, d); } };
const gelijk = (n, a, b) => check(n, JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} !== ${JSON.stringify(b)}`);

const NU = new Date(2026, 9, 12, 10, 0, 0); // 12 oktober 2026
const dag = (n) => { const d = new Date(2026, 9, 12 + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const taak = (o) => ({ id: 'x', projectId: 'p', fundingId: null, titel: 'T', financier: '', deadline: '', status: 'todo', prioriteit: 'normal', notitie: '', bron: 'user', gemaakt: '', ...o });

console.log('== validatie');
check('lege titel geweigerd', !valideerActie({ titel: '   ' }).ok);
check('te lange titel geweigerd', !valideerActie({ titel: 'a'.repeat(MAX_TITEL + 1) }).ok);
check('te lange notitie geweigerd', !valideerActie({ titel: 'a', notitie: 'n'.repeat(MAX_NOTITIE + 1) }).ok);
check('ongeldige datum geweigerd (31 februari, tekst)', !valideerActie({ titel: 'a', deadline: '2026-02-31' }).ok && !valideerActie({ titel: 'a', deadline: 'morgen' }).ok);
gelijk('geldige invoer wordt opgeschoond', valideerActie({ titel: '  Bellen ', financier: ' Fonds A ', deadline: '2026-11-01', prioriteit: 'high', notitie: ' n ' }), { ok: true, waarde: { titel: 'Bellen', financier: 'Fonds A', deadline: '2026-11-01', prioriteit: 'high', notitie: 'n' } });
gelijk('onbekende prioriteit valt terug op normaal', valideerActie({ titel: 'a', prioriteit: 'urgent' }).waarde.prioriteit, 'normal');
check('isEchteDatum', isEchteDatum('2026-10-12') && !isEchteDatum('2026-13-01') && !isEchteDatum('') && !isEchteDatum(null));

console.log('== groepen');
gelijk('verstreken -> te-laat', actieGroep(taak({ deadline: dag(-1) }), NU), 'te-laat');
gelijk('vandaag en 7 dagen -> week', [actieGroep(taak({ deadline: dag(0) }), NU), actieGroep(taak({ deadline: dag(7) }), NU)], ['week', 'week']);
gelijk('8 en 30 dagen -> maand', [actieGroep(taak({ deadline: dag(8) }), NU), actieGroep(taak({ deadline: dag(30) }), NU)], ['maand', 'maand']);
gelijk('31 dagen -> later; geen deadline -> zonder', [actieGroep(taak({ deadline: dag(31) }), NU), actieGroep(taak({}), NU)], ['later', 'zonder']);
gelijk('afgerond gaat altijd naar klaar, ook met verstreken deadline', actieGroep(taak({ status: 'done', deadline: dag(-5) }), NU), 'klaar');
const g = groepeerTaken([taak({ id: 'a', titel: 'B', deadline: dag(3) }), taak({ id: 'b', titel: 'A', deadline: dag(3), prioriteit: 'high' }), taak({ id: 'c', deadline: dag(1) }), taak({ id: 'd', status: 'done' })], NU);
gelijk('alle groepen aanwezig in vaste volgorde', Object.keys(g), ACTIE_GROEPEN);
gelijk('sortering: deadline, dan prioriteit, dan titel', g.week.map((t) => t.id), ['c', 'b', 'a']);
gelijk('sorteerTaken zonder deadline achteraan', sorteerTaken([taak({ id: 'z' }), taak({ id: 'y', deadline: dag(2) })]).map((t) => t.id), ['y', 'z']);
gelijk('telOpenTaken telt alleen niet-afgeronde', telOpenTaken([taak({}), taak({ status: 'doing' }), taak({ status: 'done' })]), 2);
gelijk('deadlineTekst met dagen erbij; zonder bij afgerond', [deadlineTekst(taak({ deadline: dag(3) }), NU), deadlineTekst(taak({ deadline: dag(3), status: 'done' }), NU), deadlineTekst(taak({}), NU)], ['15 okt 2026 (over 3 dagen)', '15 okt 2026', '']);

console.log('== database en afleiding');
gelijk('patchVoorActie: alleen genoemde velden; lege waarden worden null', patchVoorActie({ titel: ' X ', financier: '', deadline: '', notitie: '', status: 'done', prioriteit: 'low' }), { title: 'X', financier_label: null, due_date: null, status: 'done', priority: 'low', notes: null });
gelijk('patchVoorActie negeert onbekende status en velden', patchVoorActie({ status: 'klaar', program_id: 'x', source: 'chat' }), {});
gelijk('pasActieWijzigingToe', pasActieWijzigingToe(taak({ titel: 'A' }), { titel: 'B', status: 'doing' }).titel + pasActieWijzigingToe(taak({}), { status: 'doing' }).status, 'Bdoing');
const rij = { id: 'r', program_id: 'p1', funding_id: 'f1', title: 'T', financier_label: null, due_date: '2026-11-02T00:00:00', status: 'rommel', priority: 'rommel', notes: null, source: 'chat', proposed_at: 't', created_at: 'c' };
gelijk('actieUitRij: onbekende status/prioriteit vallen terug; datum afgekapt', [actieUitRij(rij).status, actieUitRij(rij).prioriteit, actieUitRij(rij).deadline, actieUitRij(rij).bron, actieUitRij(rij).fundingId], ['todo', 'normal', '2026-11-02', 'chat', 'f1']);
const afg = { projectId: 'p1', regelId: 'f1', regelNaam: 'Fonds A', tekst: 'Aanvraag afronden', datum: '2026-10-20', prioriteit: 'hoog', reden: 'deadline over 8 dagen' };
gelijk('afgeleidNaarTaak', afleiding(), { projectId: 'p1', fundingId: 'f1', titel: 'Aanvraag afronden', financier: 'Fonds A', deadline: '2026-10-20', prioriteit: 'high', notitie: 'Aanleiding: deadline over 8 dagen.' });
function afleiding() { return afgeleidNaarTaak(afg); }
gelijk('verbergAlOpgeslagen: verbergt alleen met openstaande taak voor dezelfde regel en titel', verbergAlOpgeslagen([afg, { ...afg, regelId: 'f2' }], [taak({ titel: 'Aanvraag afronden', fundingId: 'f1' })]).map((a) => a.regelId), ['f2']);
gelijk('een afgeronde taak verbergt de aanbeveling niet', verbergAlOpgeslagen([afg], [taak({ titel: 'Aanvraag afronden', fundingId: 'f1', status: 'done' })]).length, 1);

console.log('== grenzen');
const bron = readFileSync('src/features/kompas-app/financiering/actieplan.js', 'utf8').replace(/\/\/.*$/gm, '');
check('actieplan.js is puur: geen netwerk, database of opslag', !/fetch\(|supabase|localStorage|sessionStorage|XMLHttpRequest/.test(bron));
check('geen bedragen in een taak (geen amount/bedrag in de logica)', !/amount|bedrag/i.test(bron));
const svc = readFileSync('src/data/services/projectActies.js', 'utf8');
check('de service raakt alleen de takentabel, niet het dekkingsplan', /subsidie_kompas_program_actions/.test(svc) && !/subsidie_kompas_program_funding|kompas_dekkingsplan/.test(svc.replace(/\/\/.*$/gm, '')));
const mig = readFileSync('supabase/voorstel-niet-uitgevoerd/20261012120000_project_actions.sql', 'utf8');
check('migratie: RLS aan, geen anon, alleen eigen rijen', /enable row level security/.test(mig) && /revoke all on table public\.subsidie_kompas_program_actions from public, anon, authenticated/.test(mig) && !/to anon/.test(mig));
check('migratie bevat geen bedragkolommen', !/amount|numeric/.test(mig.replace(/--.*$/gm, '')));

console.log(`\n${ok} geslaagd, ${fail} mislukt`);
process.exit(fail ? 1 : 0);
