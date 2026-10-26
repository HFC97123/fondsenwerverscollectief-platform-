// Browservoorbeeld van Indienen met de vier stappen per fonds (nagebootste server; alleen om te bekijken, niet in de app).
// Kies de stand met #lijst (overzicht met kaarten) of #werk (de aanvraag zelf) in het adres; daarna kunt u de stappen aanklikken.
import React from 'react';
import { createRoot } from 'react-dom/client';
import * as client from '../../checkout-frontend/fake-client.js';
import { maakServer, PROJECT, RICHTLIJN, FORMULIER } from '../nepserver.mjs';
import { useAanvraagAssistent } from '../../../src/features/kompas-app/aanvraag/useAanvraagAssistent.js';
import { WerkPagina, PaginaKop, Tabs } from '../../../src/shared/ui/werkplek.jsx';
import AanvragenTab from '../../../src/features/kompas-app/aanvraag/AanvragenTab.jsx';

const stand = (window.location.hash || '#lijst').slice(1);
const server = maakServer();
const aanroep = (body) => server.supabase.functions.invoke('aanvraag-assistent', { body });

client.__zetSupabase(server.supabase);
window.__server = server;

await aanroep({ mode: 'eisen-ophalen', projectId: PROJECT, fondsLabel: 'Cultuurfonds Noord-Holland', formulierTekst: `1. Beschrijf uw project. ${RICHTLIJN}` });

const rij = [...server.s.tabel.values()].find((x) => x.soort === 'fonds');

await aanroep({ mode: 'vragen-lezen', projectId: PROJECT, aanvraagId: rij.id, formulierTekst: FORMULIER });

const lijst = rij.vragen.lijst.map((v, i) => (i === 1 ? { ...v, maxTekens: 1000 } : i === 2 ? { ...v, maxTekens: 800 } : v));

await aanroep({ mode: 'vragen-bewaren', aanvraagId: rij.id, vragen: lijst, bevestig: true });

if (stand === 'lijst') {
  const r = await aanroep({ mode: 'antwoorden-schrijven', projectId: PROJECT, aanvraagId: rij.id, vraagIds: lijst.map((v) => v.id) });

  await aanroep({ mode: 'versie-bewaren', aanvraagId: rij.id, antwoorden: r.data.antwoorden.map((a) => ({ id: a.id, titel: a.titel, tekst: a.tekst })) });
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
      <Tabs tabs={[{ id: 'plan', label: 'Aanvraag indienen' }, { id: 'inhoud', label: 'Projectdossier' }, { id: 'bestanden', label: 'Projectdocumentatie', aantal: 12 }]} actief="plan" onKies={() => {}} label="Indienen" testidPrefix="documenten-tab-" />
      <AanvragenTab project={project} projecten={[project]} onKiesProject={() => {}} store={{ orgProfile: { name: 'Stichting Kinderkunst' } }} assistent={assistent} start={stand === 'werk' ? { aanvraagId: rij.id, nonce: 1 } : undefined} />
    </WerkPagina>
  );
}

createRoot(document.getElementById('root')).render(<Pagina />);
