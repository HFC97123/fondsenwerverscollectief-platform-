// Browservoorbeeld van het formulier met tekenlimieten, de antwoorden per vraag en de checklist met stukken (nagebootste server; alleen om te bekijken, niet in de app).
// Kies de stand met #invoer, #controle of #bevestigd in het adres.
import React from 'react';
import { createRoot } from 'react-dom/client';
import * as client from '../../checkout-frontend/fake-client.js';
import { maakServer, PROJECT, RICHTLIJN, FORMULIER } from '../nepserver.mjs';
import { useAanvraagAssistent } from '../../../src/features/kompas-app/aanvraag/useAanvraagAssistent.js';
import { WerkPagina, PaginaKop } from '../../../src/shared/ui/werkplek.jsx';
import AanvragenTab from '../../../src/features/kompas-app/aanvraag/AanvragenTab.jsx';

const stand = (window.location.hash || '#invoer').slice(1);
const server = maakServer();
const aanroep = (body) => server.supabase.functions.invoke('aanvraag-assistent', { body });

client.__zetSupabase(server.supabase);
window.__server = server;

await aanroep({ mode: 'eisen-ophalen', projectId: PROJECT, fondsLabel: 'Cultuurfonds Noord-Holland', formulierTekst: `1. Beschrijf uw project. ${RICHTLIJN}` });

const rij = [...server.s.tabel.values()].find((x) => x.soort === 'fonds');

if (stand !== 'invoer') {
  await aanroep({ mode: 'vragen-lezen', projectId: PROJECT, aanvraagId: rij.id, formulierTekst: FORMULIER });
}

if (stand === 'bevestigd' || stand === 'editor') {
  const lijst = rij.vragen.lijst.map((v, i) => (i === 1 ? { ...v, maxTekens: 1000 } : i === 2 ? { ...v, maxTekens: 800 } : v));

  await aanroep({ mode: 'vragen-bewaren', aanvraagId: rij.id, vragen: lijst, bevestig: true });
  window.__rij = rij;
}

const docs = [
  { naam: 'anbi-beschikking.pdf', soort: 'Overig', gemaakt: new Date().toISOString() },
  { naam: 'jaarrekening-2023.pdf', soort: 'Overig', gemaakt: '2024-03-01T10:00:00Z' },
];

function Pagina() {
  const assistent = useAanvraagAssistent(true);
  const project = { id: PROJECT, naam: 'Kinderkunst Zaandam', docs };

  if (!assistent.klaar) return <p>laden</p>;

  return (
    <WerkPagina testid="documenten">
      <PaginaKop titel="Indienen" meta="Kinderkunst Zaandam" />
      <AanvragenTab project={project} projecten={[project]} onKiesProject={() => {}} store={{ orgProfile: { name: 'Stichting Kinderkunst' } }} assistent={assistent} start={{ aanvraagId: rij.id, nonce: 1 }} />
    </WerkPagina>
  );
}

createRoot(document.getElementById('root')).render(<Pagina />);
