// Voorbeeldpagina om Documenten › Begroting in een echte browser te zien (zonder server). Bouwen: zie tests/begroting/README of de esbuild-regel in de commit.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as client from '../../checkout-frontend/fake-client.js';
import { CSS_WERKPLEK } from '../../../src/shared/ui/werkplek.jsx';
import BegrotingTab from '../../../src/features/kompas-app/begroting/BegrotingTab.jsx';

const PROJECT = '33333333-3333-4333-8333-333333333333';
const q = new URLSearchParams(location.search);
const regels = q.get('leeg')
  ? []
  : [
      { id: 'a', categorie: 'uitvoering', omschrijving: 'Projectleider', aantal: 120, eenheid: 'uur', tarief: 45, bedrag: null, soort: 'geld', toelichting: '', bron: 'handmatig' },
      { id: 'b', categorie: 'activa', omschrijving: 'Voedselpakketten', aantal: 400, eenheid: 'pakket', tarief: 25, bedrag: null, soort: 'geld', toelichting: '', bron: 'handmatig' },
      { id: 'c', categorie: 'activa', omschrijving: 'Educatiemateriaal', aantal: null, eenheid: 'set', tarief: null, bedrag: null, soort: 'geld', toelichting: '', bron: 'handmatig' },
      { id: 'd', categorie: 'uitvoering', omschrijving: 'Training van vrijwilligers', aantal: 12, eenheid: 'vrijwilliger', tarief: 60, bedrag: null, soort: 'geld', toelichting: '', bron: 'handmatig' },
      { id: 'e', categorie: 'organisatie', omschrijving: 'Gratis zaal van de buurtvereniging', aantal: null, eenheid: '', tarief: null, bedrag: 2400, soort: 'natura', toelichting: '', bron: 'handmatig' },
    ];
const project = { id: PROJECT, naam: 'Samen Spelen', begroting: 15920, eigenBijdrage: 2000, budgetRegels: regels };

client.__zetSupabase({
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
