// Voorbeeldpagina om Documenten › Begroting in een echte browser te zien (zonder server). Bouwen: zie tests/begroting/README of de esbuild-regel in de commit.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as client from '../../checkout-frontend/fake-client.js';
import { CSS_WERKPLEK } from '../../../src/shared/ui/werkplek.jsx';
import BegrotingTab from '../../../src/features/kompas-app/begroting/BegrotingTab.jsx';

const PROJECT = '33333333-3333-4333-8333-333333333333';
const q = new URLSearchParams(location.search);
const R0 = (id, categorie, omschrijving, bedrag) => ({ id, categorie, omschrijving, aantal: null, eenheid: '', tarief: null, bedrag, soort: 'geld', toelichting: '', bron: 'handmatig' });
const regels = q.get('leeg')
  ? []
  : q.get('kaal')
    ? [R0('k1', '', 'Coördinator', 8000), R0('k2', '', 'Materiaal', 3500), R0('k3', '', 'Drukwerk', 600)]
    : [
      { id: 'a', categorie: 'uitvoering', omschrijving: 'Projectleider', aantal: 120, eenheid: 'uur', tarief: 45, bedrag: null, soort: 'geld', toelichting: '', bron: 'handmatig' },
      { id: 'b', categorie: 'activa', omschrijving: 'Voedselpakketten', aantal: 400, eenheid: 'pakket', tarief: 25, bedrag: null, soort: 'geld', toelichting: '', bron: 'handmatig' },
      { id: 'c', categorie: 'activa', omschrijving: 'Educatiemateriaal', aantal: null, eenheid: 'set', tarief: null, bedrag: null, soort: 'geld', toelichting: '', bron: 'handmatig' },
      { id: 'd', categorie: 'uitvoering', omschrijving: 'Training van vrijwilligers', aantal: 12, eenheid: 'vrijwilliger', tarief: 60, bedrag: null, soort: 'geld', toelichting: '', bron: 'handmatig' },
      { id: 'f', categorie: 'communicatie', omschrijving: 'Flyers en drukwerk', aantal: null, eenheid: '', tarief: null, bedrag: 750, soort: 'geld', toelichting: '', bron: 'handmatig' },
      { id: 'g', categorie: 'eigen:Locatie en huisvesting', omschrijving: 'Zaalhuur', aantal: 10, eenheid: 'maand', tarief: 120, bedrag: null, soort: 'geld', toelichting: '', bron: 'handmatig' },
      { id: 'e', categorie: 'organisatie', omschrijving: 'Gratis zaal van de buurtvereniging', aantal: null, eenheid: '', tarief: null, bedrag: 2400, soort: 'natura', toelichting: '', bron: 'handmatig' },
    ];
const project = { id: PROJECT, naam: 'Samen Spelen', begroting: 15920, eigenBijdrage: 2000, budgetRegels: regels };

// ?upload=1: de uploadknop werkt tegen een nagebootste server (zelfde antwoordvorm als de echte).
const UPLOAD_ANTWOORD = {
  ok: true,
  regels: [
    { categorie: 'uitvoering', omschrijving: 'Projectleider', aantal: 100, eenheid: 'uur', tarief: 50, bedrag: null, soort: 'geld', schatting: false, toelichting: '' },
    { categorie: 'uitvoering', omschrijving: 'Training vrijwilligers', aantal: null, eenheid: '', tarief: null, bedrag: 2000, soort: 'geld', schatting: false, toelichting: '' },
    { categorie: 'activa', omschrijving: 'Materiaal', aantal: null, eenheid: '', tarief: null, bedrag: 300, soort: 'geld', schatting: false, toelichting: 'Let op: in het bestand staat 10 × € 25 = € 250, maar het bestand noemt € 300. Het bedrag uit het bestand is overgenomen.' },
    { categorie: 'eigen:Locatie', omschrijving: 'Zaal', aantal: null, eenheid: '', tarief: null, bedrag: 1200, soort: 'natura', schatting: false, toelichting: '' },
    { categorie: 'eigen:Locatie', omschrijving: 'Verzekering', aantal: null, eenheid: '', tarief: null, bedrag: null, soort: 'geld', schatting: false, toelichting: '' },
  ],
  controle: { waarschuwingen: [
    '“Materiaal”: aantal × tarief is € 250, het bestand noemt € 300. Het bedrag uit het bestand staat in de begroting.',
    'Het subtotaal van “Activa” in het bestand is € 250, de regels daaronder tellen op tot € 300 (verschil € 50).',
    'Het totaal in het bestand is € 9.000, de regels tellen op tot € 7.300 (verschil € 1.700). Controleer welke regel ontbreekt of niet klopt.',
    '1 regel heeft geen bedrag in het bestand. Die telt nog niet mee; vul het bedrag in.',
  ] },
  sluit: { toevoegen: { uitkomst: 'te-veel-gedekt', begroting: 7300, tekst: 'De dekking is € 6.700 hoger dan de begroting van € 7.300 (toegekend, aangevraagd en in planning samen). Kijk of een financier of een regel in de begroting niet klopt.' }, vervangen: null },
  resterend: 5,
  limiet: 6,
};

client.__zetSupabase({
  functions: { invoke: async (_naam, { body }) => (body && body.mode === 'begroting-upload' ? { data: UPLOAD_ANTWOORD, error: null } : { data: null, error: new Error('niet nagebootst') }) },
  rpc: async () => ({
    data: [
      { id: 'f1', program_id: PROJECT, bron_naam: 'Stichting Voorbeeldfonds', status: 'awarded', requested_amount: 6000, awarded_amount: 5000 },
      { id: 'f2', program_id: PROJECT, bron_naam: 'Gemeente Rotterdam', status: 'submitted', requested_amount: 4000, awarded_amount: null },
      { id: 'f3', program_id: PROJECT, bron_naam: 'Fonds Noord', status: 'preparing', requested_amount: 3000, awarded_amount: null },
    ],
    error: null,
  }),
});

function Pagina() {
  const [p, setP] = useState(project);
  const store = { orgProfile: { name: 'Stichting Samen Spelen' }, saveProject: async (x) => { setP(x); return PROJECT; } };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 28px' }}>
      <style>{CSS_WERKPLEK}</style>
      <h1 style={{ fontFamily: 'Newsreader, serif', color: '#2C4A5E' }}>Documenten</h1>
      <BegrotingTab key={p.id} project={p} projecten={[p]} onKiesProject={() => {}} store={store} />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<Pagina />);
