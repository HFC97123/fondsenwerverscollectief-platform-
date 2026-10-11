// "Projectgegevens aanvullen": uit een eigen projectdocument een voorstel voor de korte projectomschrijving
// laten maken. Regels:
//   - de server leest het document zelf (bestaande knowledge_items) en controleert eigenaar en project;
//   - het voorstel wordt NIET opgeslagen voordat het lid "Opslaan bij project" kiest;
//   - een bestaande omschrijving wordt nooit stil overschreven: ze blijft zichtbaar naast het voorstel en
//     de opslagknop zegt dan duidelijk dat ze wordt vervangen;
//   - alleen de korte omschrijving; andere velden volgen later.
// Bewaren gaat via dezelfde store-route als het gesprek (werkProjectBij), met herkomst "uit een document".
import React, { useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { Button } from '../../../shared/ui/index.js';
import { stelProjectOmschrijvingVoor } from '../../../data/services/chat.js';

const TEKST = "font-family: 'Mulish', sans-serif; font-size: 14.5px; line-height: 1.6; color: #4B5C58;";
const LABEL = "font-family: 'Mulish', sans-serif; font-size: 11.5px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #7B8985;";

export const MELDING_GEEN_TEKST = 'In dit document is geen tekst gevonden die we kunnen lezen. Probeer een ander document, of vul de omschrijving zelf in.';
export const MELDING_TE_WEINIG = 'Dit document bevat te weinig informatie om een verantwoorde omschrijving voor te stellen. Er is niets gewijzigd.';

export function meldingVoorReden(reden) {
  if (reden === 'geen-tekst') return MELDING_GEEN_TEKST;
  if (reden === 'te-weinig-informatie') return MELDING_TE_WEINIG;

  return '';
}

// Knop per document + het voorstelpaneel. onOpslaan(tekst) -> belofte met het id of null bij mislukken.
export default function ProjectgegevensAanvullen({ project, document, onOpslaan, analyseer = stelProjectOmschrijvingVoor }) {
  const [fase, setFase] = useState('rust'); // rust | bezig | voorstel | melding | opgeslagen
  const [voorstel, setVoorstel] = useState('');
  const [melding, setMelding] = useState('');
  const [bewerk, setBewerk] = useState(false);
  const [bezigOpslaan, setBezigOpslaan] = useState(false);

  const bestaand = String(project.omschrijving || '').trim();

  const start = async () => {
    setFase('bezig');
    setMelding('');
    setBewerk(false);

    const res = await analyseer({ projectId: project.id, documentId: document.id });

    if (res.error) {
      setMelding(res.error);
      setFase('melding');

      return;
    }

    if (!res.omschrijving) {
      setMelding(meldingVoorReden(res.reden) || MELDING_TE_WEINIG);
      setFase('melding');

      return;
    }

    setVoorstel(res.omschrijving);
    setFase('voorstel');
  };

  const sluit = () => {
    setFase('rust');
    setVoorstel('');
    setMelding('');
    setBewerk(false);
  };

  const bewaar = async () => {
    const tekst = voorstel.trim();

    if (!tekst) {
      return;
    }

    setBezigOpslaan(true);

    const id = await onOpslaan(tekst);

    setBezigOpslaan(false);

    if (id === null || id === undefined) {
      setMelding('Opslaan is niet gelukt. Uw projectgegevens zijn niet gewijzigd.');
      setFase('melding');

      return;
    }

    setFase('opgeslagen');
  };

  return (
    <div data-testid="projectgegevens-aanvullen" data-document-id={document.id} style={css('margin-top: 8px;')}>
      {fase === 'rust' && (
        <button
          type="button"
          data-testid="projectgegevens-aanvullen-knop"
          onClick={start}
          aria-label={`Projectgegevens aanvullen uit ${document.naam}`}
          style={css("cursor: pointer; min-height: 40px; padding: 0 16px; border: 1px solid #CFDDD5; border-radius: 999px; background: #FFFFFF; color: #2C4A5E; font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 800;")}
        >
          Projectgegevens aanvullen
        </button>
      )}

      {fase === 'bezig' && (
        <div role="status" data-testid="projectgegevens-bezig" style={css(`${TEKST} color: #7B8985;`)}>
          Het document wordt gelezen…
        </div>
      )}

      {fase === 'melding' && (
        <div role="status" data-testid="projectgegevens-melding" style={css(`${TEKST} padding: 12px 16px; border: 1px solid #EEDCC0; border-radius: 12px; background: #FBF1E3; color: #8A5A16;`)}>
          {melding}{' '}
          <button type="button" onClick={sluit} style={css('cursor: pointer; border: none; background: none; padding: 0; font-weight: 800; color: #4E9A6C;')}>
            Sluiten
          </button>
        </div>
      )}

      {fase === 'opgeslagen' && (
        <div role="status" data-testid="projectgegevens-opgeslagen" style={css(`${TEKST} padding: 12px 16px; border: 1px solid #CFE5D6; border-radius: 12px; background: #EEF7F1; color: #2F6D47;`)}>
          De omschrijving is bij het project opgeslagen.{' '}
          <button type="button" onClick={sluit} style={css('cursor: pointer; border: none; background: none; padding: 0; font-weight: 800; color: #4E9A6C;')}>
            Sluiten
          </button>
        </div>
      )}

      {fase === 'voorstel' && (
        <section data-testid="projectgegevens-voorstel" style={css('box-sizing: border-box; padding: 16px 18px; border: 1px solid #D6E3E9; border-radius: 16px; background: #F4F8FB;')}>
          <h3 style={css(`${LABEL} margin: 0 0 8px;`)}>Voorstel projectomschrijving</h3>
          <div style={css(`${TEKST} font-size: 13px; color: #7B8985; margin-bottom: 8px;`)}>
            Gebaseerd op “{document.naam}”. Er is nog niets opgeslagen.
          </div>

          {bewerk ? (
            <textarea
              data-testid="projectgegevens-voorstel-tekst"
              aria-label="Voorstel projectomschrijving"
              value={voorstel}
              onChange={(e) => setVoorstel(e.target.value)}
              rows={6}
              maxLength={2000}
              style={css("box-sizing: border-box; width: 100%; padding: 10px 12px; border: 1px solid #CFDDD5; border-radius: 10px; background: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 14.5px; line-height: 1.6; color: #2C4A5E; resize: vertical;")}
            />
          ) : (
            <div data-testid="projectgegevens-voorstel-tekst" style={css(`${TEKST} white-space: pre-wrap; color: #2C4A5E;`)}>{voorstel}</div>
          )}

          {bestaand && (
            <div data-testid="projectgegevens-bestaand" style={css(`${TEKST} margin-top: 12px; padding: 10px 12px; border-radius: 10px; background: #FFFFFF; border: 1px solid #E1EAE4;`)}>
              <div style={css(LABEL)}>Huidige omschrijving van het project</div>
              <div style={css('white-space: pre-wrap; margin-top: 4px;')}>{bestaand}</div>
              <div style={css('margin-top: 6px; font-size: 13px; font-weight: 700; color: #8A5A16;')}>
                Opslaan vervangt deze omschrijving. Wilt u beide houden, kies dan Aanpassen en voeg de teksten samen.
              </div>
            </div>
          )}

          <div style={css('margin-top: 14px; display: flex; gap: 10px; flex-wrap: wrap;')}>
            <Button onClick={bewaar} disabled={bezigOpslaan || !voorstel.trim()}>
              {bezigOpslaan ? 'Opslaan…' : bestaand ? 'Opslaan bij project (vervangt huidige)' : 'Opslaan bij project'}
            </Button>
            <Button variant="outline" onClick={() => setBewerk((b) => !b)}>
              {bewerk ? 'Klaar met aanpassen' : 'Aanpassen'}
            </Button>
            <Button variant="ghost" onClick={sluit}>
              Annuleren
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
