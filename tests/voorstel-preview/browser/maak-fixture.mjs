// Genereert de fixture voor de browsertest met de ECHTE servercode (maakVoorstelPreview) en een nagebootste webwereld.
import { writeFileSync } from 'node:fs';
import { maakVoorstelPreview } from '../../../supabase/functions/_shared/voorstelVerificatie.ts';
import { berekenDekking } from '../../../supabase/functions/_shared/dekkingsplanRekenen.js';
import { omgeving, pagina, OPENBAAR } from '../../verificatie/hulp.mjs';

const UID = '11111111-1111-4111-8111-111111111111';
const PID = '22222222-2222-4222-8222-222222222222';
const id = (c) => `${c.repeat(8)}-${c.repeat(4)}-4${c.repeat(3)}-8${c.repeat(3)}-${c.repeat(12)}`;
const rec = (c, naam, host, extra = {}) => ({ type: 'regeling', id: id(c), niveau: 'volledig', naam, gever: 'Gemeente Rotterdam', website: `https://${host}/aanvragen`, deadline: '2026-11-12', min: 5000, max: 25000, ...extra });
const records = [
  rec('1', 'Rotterdams Jongerencultuurfonds', 'www.fonds-a.example.nl'),
  rec('2', 'Wijkinitiatievenfonds Zuid', 'www.fonds-b.example.nl', { deadline: '2026-12-01', max: 15000 }),
  rec('3', 'Cultuurimpuls Rotterdam', 'www.fonds-c.example.nl'),
  rec('4', 'Buurtbudget Delfshaven', 'www.fonds-d.example.nl'),
  { type: 'fonds', id: id('5'), niveau: 'publiek', naam: 'Fonds Premium Voorbeeld', website: 'https://www.premium.example.nl/' },
  { type: 'fonds', id: id('6'), niveau: 'volledig', naam: 'Stichting Voorbeeld Fonds Zuid', gever: 'Stichting Voorbeeld Fonds Zuid', website: 'https://www.fonds-f.example.nl/aanvragen', min: 500, max: 8000 },
];
const w = omgeving({
  dns: Object.fromEntries(['a', 'b', 'c', 'd', 'f'].map((x) => [`www.fonds-${x}.example.nl`, [OPENBAAR]])),
  paginas: {
    'https://www.fonds-a.example.nl/aanvragen': pagina('<h1>Rotterdams Jongerencultuurfonds</h1><p>Aanvragen kan tot 12 november 2026.</p><p>Maximaal € 25.000 per aanvraag.</p><p>Minimaal € 5.000 per project.</p>'),
    'https://www.fonds-b.example.nl/aanvragen': pagina('<h1>Wijkinitiatievenfonds Zuid</h1><p>De deadline voor aanvragen is 15 december 2026.</p><p>Maximaal € 15.000 per aanvraag.</p>'),
    'https://www.fonds-c.example.nl/aanvragen': pagina('<h1>Een andere organisatie</h1><p>Aanvragen kan tot 12 november 2026.</p>'),
    'https://www.fonds-f.example.nl/aanvragen': pagina('<h1>Stichting Voorbeeld Fonds Zuid</h1><p>Wij steunen projecten in Rotterdam-Zuid.</p>'),
  },
});
const regel = (c, type, bedrag) => ({ type, id: id(c), naam: 'Naam van het model', gever: 'Gever', motivatie: 'Past bij de doelgroep en het werkgebied van het project.', bedrag, onzekerheden: [] });
const raw = { versie: 1, projectId: PID, status: 'concept', aannames: [], acties: [], regels: [regel('1', 'regeling', 20000), regel('2', 'regeling', 12000), regel('3', 'regeling', 8000), regel('4', 'regeling', 5000), regel('5', 'fonds', 4000), regel('6', 'fonds', 3000), { type: 'online', naam: 'Online gevonden regel', bron: { url: 'https://www.nieuw.example.nl/' } }] };
const uit = await maakVoorstelPreview(
  { raw, uid: UID, projectId: PID, dekking: berekenDekking({ begroting: 200000, regels: [], overige: 20000 }), records, geheim: 'g'.repeat(40) },
  { resolveHost: w.resolveHost, fetchImpl: w.fetchImpl, datumNu: () => new Date('2026-10-14T10:00:00Z'), uuid: () => '99999999-9999-4999-8999-999999999999' },
);

writeFileSync('web/fixture.json', JSON.stringify(uit, null, 2));
console.log('fixture ok:', uit.ok, uit.ok ? uit.verificaties.map((v) => v.metadata?.verificatie?.status ?? v.reden).join(', ') : uit.reden);
