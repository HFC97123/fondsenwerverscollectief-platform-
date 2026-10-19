// Browservoorbeeld van de schermen met de nagebootste server (alleen voor het bekijken en testen in een echte browser; niet in de app).
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as client from '../../checkout-frontend/fake-client.js';
import { maakServer } from '../nepserver.mjs';
import { useAanvraagAssistent } from '../../../src/features/kompas-app/aanvraag/useAanvraagAssistent.js';
import ProjectplanTab from '../../../src/features/kompas-app/aanvraag/ProjectplanTab.jsx';
import AanvragenTab from '../../../src/features/kompas-app/aanvraag/AanvragenTab.jsx';
import { WerkPagina, PaginaKop, Tabs } from '../../../src/shared/ui/werkplek.jsx';

const server = maakServer();

client.__zetSupabase(server.supabase);
window.__server = server;

function Pagina() {
  const assistent = useAanvraagAssistent(true);
  const [tab, setTab] = useState('plan');
  const [start, setStart] = useState(null);
  const project = { id: '33333333-3333-4333-8333-333333333333', naam: 'Samen Spelen, Rotterdam-Zuid' };
  const store = { orgProfile: { name: 'Stichting Samen Spelen' } };

  if (!assistent.beschikbaar) return <p>laden</p>;

  return (
    <WerkPagina testid="documenten">
      <PaginaKop titel="Documenten" meta="3 documenten in 1 project" />
      <Tabs tabs={[{ id: 'bestanden', label: 'Bestanden', aantal: 3 }, { id: 'inhoud', label: 'Projectinhoud' }, { id: 'plan', label: 'Projectplan' }, { id: 'aanvragen', label: 'Aanvragen' }]} actief={tab} onKies={setTab} label="Documenten" />
      {tab === 'plan' && <ProjectplanTab project={project} projecten={[project]} onKiesProject={() => {}} store={store} assistent={assistent} onNieuweAanvraag={(fonds) => { setStart({ fonds, nonce: Date.now() }); setTab('aanvragen'); }} onOpenAanvraag={(id) => { setStart({ aanvraagId: id, nonce: Date.now() }); setTab('aanvragen'); }} />}
      {tab === 'aanvragen' && <AanvragenTab project={project} projecten={[project]} onKiesProject={() => {}} store={store} assistent={assistent} start={start} />}
    </WerkPagina>
  );
}

createRoot(document.getElementById('root')).render(<Pagina />);
