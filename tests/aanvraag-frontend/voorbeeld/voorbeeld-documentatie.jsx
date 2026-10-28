// Browservoorbeeld van de echte pagina Projectdocumentatie met een geschreven concept projectplan (nagebootste server; alleen om te bekijken, niet in de app).
import React from 'react';
import { createRoot } from 'react-dom/client';
import * as client from '../../checkout-frontend/fake-client.js';
import { maakServer, PROJECT, USER } from '../nepserver.mjs';
import { schrijfProjectplan } from '../../../src/data/services/aanvraagAssistent.js';
import DocumentatiePage from '../../../src/features/kompas-app/DocumentatiePage.jsx';

const server = maakServer({ tier: 'premium', dekkingsplan: [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }] });

const orgDocs = [
  { id: 'o1', file_name: 'Jaarverslag 2025.pdf', notes: 'Jaarverslag', storage_path: `${USER}/jaarverslag.pdf`, created_at: '2026-09-01T10:00:00Z' },
  { id: 'o2', file_name: 'ANBI-beschikking.pdf', notes: 'ANBI-status', storage_path: `${USER}/anbi.pdf`, created_at: '2026-09-02T10:00:00Z' },
  { id: 'o3', file_name: 'Statuten.pdf', notes: 'Statuten', storage_path: `${USER}/statuten.pdf`, created_at: '2026-09-03T10:00:00Z' },
];
const van = server.supabase.from;

server.supabase.auth = { getUser: async () => ({ data: { user: { id: USER } } }) };
server.supabase.from = (tabel) => {
  if (tabel !== 'subsidie_kompas_knowledge_items') return van(tabel);

  const q = { select: () => q, eq: () => q, is: () => q, order: async () => ({ data: orgDocs, error: null }) };

  return q;
};
client.__zetSupabase(server.supabase);
await schrijfProjectplan({ projectId: PROJECT });

const project = {
  id: PROJECT,
  naam: 'Samen Spelen',
  gearchiveerd: false,
  budgetRegels: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
  docs: [{ id: 'd1', naam: 'Aanvraagformulier Cordius.pdf', soort: 'Overig', pad: 'x/formulier.pdf', gemaakt: '2026-10-02T10:00:00Z' }],
};

globalThis.__app = { subscriptionTier: 'premium', isAdmin: false };
globalThis.__store = { projects: [project], orgProfile: { name: 'Stichting Samen Spelen' }, patch: () => {} };
window.location.hash = '#/kompas/documentatie?tab=bestanden';
createRoot(document.getElementById('root')).render(<DocumentatiePage />);
