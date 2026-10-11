// Dialoog "Toevoegen aan projectfinanciering" (Deadlines, Pro/Premium).
// Kiezen van een eigen project, optioneel een gevraagd bedrag, opslaan met startstatus "Interessant".
// Alle logica zit in financiering/toevoegen.js (de ene use-case); deze component toont alleen.
// Er staat niets van de bron in de component-state behalve het id en de naam die al op de kaart zichtbaar was.
import React, { useEffect, useRef, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { projectFinancieringHref } from '../financiering/deeplinks.js';
import { staatAlInProjectfinanciering, toevoegbareProjecten, voegToeAanProjectfinanciering } from '../financiering/toevoegen.js';

const CSS = `
.fwk-add-overlay { position: fixed; inset: 0; z-index: 100; background: rgba(44,74,94,0.36); display: flex; align-items: flex-end; justify-content: center; }
.fwk-add-kaart { box-sizing: border-box; width: 100%; max-width: 460px; max-height: 100vh; overflow-y: auto; padding: 22px clamp(16px, 5vw, 26px) 26px; background: #FFFFFF; border-radius: 22px 22px 0 0; }
@media (min-width: 600px) { .fwk-add-overlay { align-items: center; padding: 20px; } .fwk-add-kaart { border-radius: 22px; } }
.fwk-add-kaart button:focus-visible, .fwk-add-kaart a:focus-visible, .fwk-add-kaart input:focus-visible, .fwk-add-kaart select:focus-visible { outline: 2px solid #4E9A6C; outline-offset: 2px; }
`;

const LABEL = "display: block; margin-bottom: 6px; font-family: 'Mulish', sans-serif; font-size: 12.5px; font-weight: 800; color: #2C4A5E;";
const VELD =
  "box-sizing: border-box; width: 100%; min-height: 46px; padding: 11px 14px; border: 1px solid #D5E0D9; border-radius: 12px; background: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 15px; font-weight: 700; color: #2C4A5E;";
const PRIMAIR =
  "cursor: pointer; box-sizing: border-box; min-height: 46px; padding: 12px 22px; border: none; border-radius: 999px; background: #4E9A6C; color: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 14.5px; font-weight: 800; text-decoration: none; display: inline-flex; align-items: center; justify-content: center;";
const SECUNDAIR =
  "cursor: pointer; box-sizing: border-box; min-height: 46px; padding: 12px 20px; border: 1.5px solid #A8D5BA; border-radius: 999px; background: #FFFFFF; color: #2C4A5E; font-family: 'Mulish', sans-serif; font-size: 14.5px; font-weight: 800; text-decoration: none; display: inline-flex; align-items: center; justify-content: center;";

const MELDING = {
  'ongeldig-bedrag': 'Vul een bedrag in zoals 12.500, of laat het veld leeg.',
  'geen-project': 'Kies een van uw projecten.',
  'geen-bron': 'Dit kan nu niet aan een project worden toegevoegd.',
  'geen-sessie': 'U bent niet meer ingelogd. Log opnieuw in en probeer het nog eens.',
  fout: 'Toevoegen is niet gelukt. Probeer het opnieuw.',
};

// bron: { type: 'regeling' | 'fonds', id, naam }  projecten: store.projects  onClose: sluit de dialoog
export default function AddToProjectFundingDialog({ bron, projecten, onClose }) {
  const kiesbaar = toevoegbareProjecten(projecten);
  const [projectId, setProjectId] = useState(kiesbaar.length === 1 ? kiesbaar[0].id : '');
  const [bedrag, setBedrag] = useState('');
  const [fase, setFase] = useState('formulier'); // formulier | bezig | opgeslagen
  const [bestaatAl, setBestaatAl] = useState(false);
  const [fout, setFout] = useState('');
  const eersteVeld = useRef(null);

  const project = kiesbaar.find((p) => p.id === projectId) || null;

  useEffect(() => {
    if (eersteVeld.current) eersteVeld.current.focus();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Vooraf al melden dat de bron in dit project staat; de database blijft leidend (zie opslaan).
  useEffect(() => {
    let actief = true;

    setBestaatAl(false);
    setFout('');

    if (projectId) {
      staatAlInProjectfinanciering(projectId, bron).then((al) => {
        if (actief && al === true) setBestaatAl(true);
      });
    }

    return () => {
      actief = false;
    };
  }, [projectId, bron.id, bron.type]);

  const opslaan = async () => {
    if (fase === 'bezig') return;
    setFase('bezig');
    setFout('');

    const res = await voegToeAanProjectfinanciering({ projectId, bron, bedragTekst: bedrag, projecten });

    if (res.ok) {
      setFase('opgeslagen');
    } else if (res.reden === 'bestaat-al') {
      setBestaatAl(true);
      setFase('formulier');
    } else {
      setFout(MELDING[res.reden] || MELDING.fout);
      setFase('formulier');
    }
  };

  const projectNaam = (project && project.naam) || 'uw project';
  const kop = bron.type === 'fonds' ? 'Fonds toevoegen aan projectfinanciering' : 'Toevoegen aan projectfinanciering';
  const openLink = project ? (
    <a href={projectFinancieringHref(project.id)} onClick={onClose} data-testid="open-projectfinanciering" style={css(fase === 'opgeslagen' ? PRIMAIR : SECUNDAIR)}>
      Open projectfinanciering
    </a>
  ) : null;

  return (
    <div className="fwk-add-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <style>{CSS}</style>
      <div className="fwk-add-kaart" role="dialog" aria-modal="true" aria-labelledby="fwk-add-titel" data-testid="add-dialoog">
        <div style={css('display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 14px;')}>
          <div style={css('min-width: 0;')}>
            <div id="fwk-add-titel" style={css("font-family: 'Newsreader', serif; font-size: 22px; font-weight: 600; line-height: 1.25; color: #2C4A5E;")}>
              {kop}
            </div>
            <div data-testid="add-bron" style={css("margin-top: 4px; font-family: 'Mulish', sans-serif; font-size: 14px; font-weight: 700; color: #687974; overflow-wrap: anywhere;")}>
              {bron.naam}
              {bron.funder ? ` · ${bron.funder}` : ''}
            </div>
          </div>
          <button
            type="button"
            aria-label="Sluiten"
            onClick={onClose}
            style={css('cursor: pointer; flex-shrink: 0; width: 44px; height: 44px; border: 1px solid #E1EAE4; border-radius: 14px; background: #FFFFFF; color: #2C4A5E; font-size: 18px; font-weight: 700;')}
          >
            ×
          </button>
        </div>

        {fase === 'opgeslagen' ? (
          <div data-testid="add-succes">
            <div role="status" style={css("margin-bottom: 16px; padding: 13px 16px; border: 1px solid #BFD4C6; border-radius: 12px; background: #EAF4EE; font-family: 'Mulish', sans-serif; font-size: 14.5px; font-weight: 700; line-height: 1.5; color: #2F6D47;")}>
              {bron.naam} staat nu in de projectfinanciering van {projectNaam}.
            </div>
            <div style={css('display: flex; gap: 10px; flex-wrap: wrap;')}>
              {openLink}
              <button type="button" onClick={onClose} style={css(SECUNDAIR)}>Sluiten</button>
            </div>
          </div>
        ) : kiesbaar.length === 0 ? (
          <div data-testid="add-geen-project" style={css("font-family: 'Mulish', sans-serif; font-size: 14.5px; line-height: 1.6; color: #4B5C58;")}>
            U heeft nog geen actief project. Maak er een aan bij{' '}
            <a href="#/kompas/projecten" onClick={onClose} style={css('color: #4E9A6C; font-weight: 800;')}>Projecten</a>, dan kunt u hier regelingen en fondsen aan toevoegen.
          </div>
        ) : (
          <>
            <div style={css('margin-bottom: 14px;')}>
              <label htmlFor="fwk-add-project" style={css(LABEL)}>Project</label>
              <select
                id="fwk-add-project"
                data-testid="add-project"
                ref={eersteVeld}
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                style={css(VELD)}
              >
                {kiesbaar.length > 1 && <option value="">Kies een project…</option>}
                {kiesbaar.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.naam || 'Naamloos project'}
                  </option>
                ))}
              </select>
            </div>

            <div style={css('margin-bottom: 14px;')}>
              <label htmlFor="fwk-add-bedrag" style={css(LABEL)}>Gevraagd bedrag (optioneel)</label>
              <input
                id="fwk-add-bedrag"
                data-testid="add-bedrag"
                inputMode="decimal"
                value={bedrag}
                placeholder="€"
                onChange={(e) => {
                  setBedrag(e.target.value);
                  setFout('');
                }}
                style={css(VELD)}
              />
            </div>

            {bestaatAl && (
              <div data-testid="add-bestaat-al" role="status" style={css("margin-bottom: 14px; padding: 13px 16px; border: 1px solid #EEDCC0; border-radius: 12px; background: #FBF1E3; font-family: 'Mulish', sans-serif; font-size: 14.5px; font-weight: 700; line-height: 1.5; color: #8A5A16;")}>
                Staat al in projectfinanciering
              </div>
            )}

            {fout && (
              <div data-testid="add-fout" role="alert" style={css("margin-bottom: 14px; padding: 13px 16px; border: 1px solid #EDD3CE; border-radius: 12px; background: #FDF6F5; font-family: 'Mulish', sans-serif; font-size: 14.5px; font-weight: 700; line-height: 1.5; color: #9E3B2C;")}>
                {fout}
              </div>
            )}

            <div style={css('display: flex; gap: 10px; flex-wrap: wrap;')}>
              {bestaatAl ? (
                openLink
              ) : (
                <button
                  type="button"
                  onClick={opslaan}
                  disabled={!projectId || fase === 'bezig'}
                  data-testid="add-opslaan"
                  style={css(`${PRIMAIR} ${!projectId || fase === 'bezig' ? 'opacity: 0.55; cursor: default;' : ''}`)}
                >
                  {fase === 'bezig' ? 'Bezig…' : 'Toevoegen'}
                </button>
              )}
              <button type="button" onClick={onClose} style={css(SECUNDAIR)}>Annuleren</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
