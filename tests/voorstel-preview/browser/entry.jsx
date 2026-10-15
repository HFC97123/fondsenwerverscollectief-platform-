import React from 'react';
import { createRoot } from 'react-dom/client';
import VoorstelPreview from '../../../src/features/kompas-app/financiering/VoorstelPreview.jsx';

const scenario = (location.hash || '#mix').slice(1);

async function start() {
  let antwoord = null;

  if (scenario === 'mix') antwoord = await (await fetch('fixture.json')).json();
  else if (scenario === 'fout') antwoord = { ok: false, reden: 'onverwachte-fout', fouten: [], opgeslagen: false };
  else if (scenario === 'leeg') antwoord = null;
  else if (scenario === 'vervalst') {
    // Een client (of een tussenlaag) probeert er "geverifieerd" van te maken: alleen de servermetadata telt, en alleen neerwaarts.
    const a = await (await fetch('fixture.json')).json();
    a.verificaties.forEach((v) => { if (v.metadata) { v.metadata.server_generated = false; } });
    antwoord = a;
  }

  createRoot(document.getElementById('root')).render(<VoorstelPreview antwoord={antwoord} />);
}

start();
