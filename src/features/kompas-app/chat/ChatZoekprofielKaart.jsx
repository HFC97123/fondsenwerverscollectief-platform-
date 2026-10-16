// Chat-ingang van het zoekprofiel: onder het laatste antwoord van Subsidiekompas kan het lid het zoekprofiel laten opstellen uit het gesprek en uit het
// actieve project, het controleren en aanpassen, en bevestigen met "Zoek passende fondsen". Er is GEEN tweede matchingflow: de kaart opent dezelfde
// werkruimte als Projectfinanciering (VoorstelWerkruimte) met dezelfde zoekprofielservice, dezelfde matching, preview en broncontrole, servervalidatie,
// dekkingsplan en actieplan. Alleen de bron van het profiel verschilt (het gesprek); er wordt niets opgeslagen of gezocht voor het lid bevestigt.
import React, { useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import VoorstelWerkruimte from '../financiering/VoorstelWerkruimte.jsx';

const TEKST = "font-family: 'Mulish', sans-serif; font-size: 13px; line-height: 1.5; color: #4B5C58;";
const KNOP_PRIMAIR = "cursor: pointer; box-sizing: border-box; min-height: 34px; padding: 4px 16px; border-radius: 999px; border: 1px solid #4E9A6C; background: #4E9A6C; color: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 13px; font-weight: 800;";

// berichten: [{ role: 'user', content }] (de server gebruikt alleen berichten van het lid, de laatste tien). diensten: alleen voor tests.
export default function ChatZoekprofielKaart({ project, berichten, diensten, onGewijzigd, uitgeschakeld = false }) {
  const [open, setOpen] = useState(false);
  const [nr, setNr] = useState(0);

  if (!project || !project.id) return null;

  const naOpslaan = (uit) => {
    if (uit && Array.isArray(uit.regels) && uit.regels.some((r) => r.status === 'opgeslagen') && typeof onGewijzigd === 'function') onGewijzigd();
  };

  return (
    <div data-testid="chat-zoekprofiel" data-open={open ? 'ja' : 'nee'} style={css(open ? 'display: flex; flex-direction: column; gap: 10px;' : 'box-sizing: border-box; padding: 14px 16px; border: 1px solid #E1EAE4; border-radius: 16px; background: #F7F9F8; display: flex; flex-direction: column; gap: 10px;')}>
      {!open && (
        <>
          <div style={css(`${TEKST} color: #2C4A5E; font-weight: 800;`)}>Passende fondsen zoeken voor {project.naam || 'dit project'}?</div>
          <div style={css(TEKST)}>
            Subsidiekompas maakt een zoekprofiel uit dit gesprek en uw project. U controleert en past het aan; er wordt pas gezocht als u op “Zoek passende fondsen” klikt.
          </div>
          <div>
            <button
              type="button"
              data-testid="chat-zoekprofiel-open"
              disabled={uitgeschakeld}
              onClick={() => {
                setNr((n) => n + 1);
                setOpen(true);
              }}
              style={css(`${KNOP_PRIMAIR}${uitgeschakeld ? ' opacity: 0.6; cursor: default;' : ''}`)}
            >
              Zoekprofiel bekijken en bevestigen
            </button>
          </div>
        </>
      )}

      {open && (
        <VoorstelWerkruimte
          key={nr}
          project={{ id: project.id, naam: project.naam }}
          profielRoute="chat"
          profielBerichten={berichten}
          metStartknop={false}
          autoStart
          {...(diensten ? { diensten } : {})}
          onOpgeslagen={naOpslaan}
          onSluit={() => setOpen(false)}
        />
      )}
    </div>
  );
}
