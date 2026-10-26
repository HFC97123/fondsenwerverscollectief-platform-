// Browservoorbeeld van het bewerkscherm met versies (nagebootste server; alleen om te bekijken, niet in de app).
import React from 'react';
import { createRoot } from 'react-dom/client';
import * as client from '../../checkout-frontend/fake-client.js';
import { maakServer, PROJECT, RICHTLIJN } from '../nepserver.mjs';
import { useAanvraagAssistent } from '../../../src/features/kompas-app/aanvraag/useAanvraagAssistent.js';
import { WerkPagina, PaginaKop } from '../../../src/shared/ui/werkplek.jsx';
import AanvragenTab from '../../../src/features/kompas-app/aanvraag/AanvragenTab.jsx';

const server = maakServer();

client.__zetSupabase(server.supabase);
window.__server = server;

await server.supabase.functions.invoke('aanvraag-assistent', { body: { mode: 'eisen-ophalen', projectId: PROJECT, fondsLabel: 'Cultuurfonds Noord-Holland', formulierTekst: `1. Beschrijf uw project. ${RICHTLIJN}` } });
const rij = [...server.s.tabel.values()].find((x) => x.soort === 'fonds');

function Pagina() {
  const assistent = useAanvraagAssistent(true);
  const project = { id: PROJECT, naam: 'Kinderkunst Zaandam' };

  if (!assistent.klaar) return <p>laden</p>;

  return (
    <WerkPagina testid="documenten">
      <PaginaKop titel="Projectplan en indienen" meta="Kinderkunst Zaandam" />
      <AanvragenTab project={project} projecten={[project]} onKiesProject={() => {}} store={{ orgProfile: { name: 'Stichting Kinderkunst' } }} assistent={assistent} start={{ aanvraagId: rij.id, nonce: 1 }} />
    </WerkPagina>
  );
}

createRoot(document.getElementById('root')).render(<Pagina />);
