// "Opnemen in een project" in het detailpaneel van Deadlines (Pro/Premium): project kiezen en Toevoegen, direct in het paneel.
// Alle logica zit in financiering/toevoegen.js (dezelfde use-case als voorheen); deze component toont alleen.
// Het bedrag vult het lid daarna in het dekkingsplan in (startstatus "Interessant").
import React, { useEffect, useState } from 'react';
import { projectFinancieringHref } from '../financiering/deeplinks.js';
import { staatAlInProjectfinanciering, toevoegbareProjecten, voegToeAanProjectfinanciering } from '../financiering/toevoegen.js';

const MELDING = {
  'geen-project': 'Kies een van uw projecten.',
  'geen-bron': 'Dit kan nu niet aan een project worden toegevoegd.',
  'geen-sessie': 'U bent niet meer ingelogd. Log opnieuw in en probeer het nog eens.',
  fout: 'Toevoegen is niet gelukt. Probeer het opnieuw.',
};

export const CSS_OPNEMEN = `
.fwk-po { margin-top: 20px; padding-top: 18px; border-top: 1px solid #E1EAE4; font-family: 'Mulish', sans-serif; }
.fwk-po-kop { margin: 0 0 10px; font-size: 15px; font-weight: 800; color: #2C4A5E; }
.fwk-po-rij { display: flex; gap: 10px; align-items: stretch; flex-wrap: wrap; }
.fwk-po-select { flex: 1 1 200px; min-width: 0; box-sizing: border-box; min-height: 46px; padding: 10px 14px; border: 1px solid #D5E0D9; border-radius: 12px; background: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 14.5px; font-weight: 700; color: #2C4A5E; }
.fwk-po-knop { cursor: pointer; flex: none; box-sizing: border-box; min-height: 46px; padding: 0 24px; border: none; border-radius: 999px; background: #4E9A6C; color: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 14.5px; font-weight: 800; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; transition: background .15s ease; }
.fwk-po-knop:hover { background: #43875E; }
.fwk-po-knop:disabled { opacity: 0.55; cursor: default; }
.fwk-po-knop[data-soort="licht"] { border: 1.5px solid #A8D5BA; background: #FFFFFF; color: #2C4A5E; }
.fwk-po-melding { margin-top: 10px; padding: 11px 14px; border-radius: 12px; font-size: 14px; font-weight: 700; line-height: 1.5; }
.fwk-po-melding[data-toon="ok"] { border: 1px solid #BFD4C6; background: #EAF4EE; color: #2F6D47; }
.fwk-po-melding[data-toon="let-op"] { border: 1px solid #EEDCC0; background: #FBF1E3; color: #8A5A16; }
.fwk-po-melding[data-toon="fout"] { border: 1px solid #EDD3CE; background: #FDF6F5; color: #9E3B2C; }
.fwk-po-tekst { font-size: 14px; line-height: 1.6; color: #4B5C58; }
.fwk-po-tekst a { color: #4E9A6C; font-weight: 800; }
.fwk-po-acties { margin-top: 10px; display: flex; gap: 10px; flex-wrap: wrap; }
`;

// bron: { type: 'regeling' | 'fonds', id, naam }  projecten: store.projects
export default function ProjectOpnemen({ bron, projecten }) {
  const kiesbaar = toevoegbareProjecten(projecten);
  const [projectId, setProjectId] = useState(kiesbaar.length === 1 ? kiesbaar[0].id : '');
  const [fase, setFase] = useState('formulier'); // formulier | bezig | opgeslagen
  const [bestaatAl, setBestaatAl] = useState(false);
  const [fout, setFout] = useState('');

  const project = kiesbaar.find((p) => p.id === projectId) || null;

  // Een ander fonds in hetzelfde paneel: opnieuw beginnen.
  useEffect(() => {
    setFase('formulier');
    setFout('');
  }, [bron.id, bron.type]);

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

    const res = await voegToeAanProjectfinanciering({ projectId, bron, bedragTekst: '', projecten });

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

  const openLink = (soort) =>
    project ? (
      <a href={projectFinancieringHref(project.id)} className="fwk-po-knop" data-soort={soort} data-testid="open-projectfinanciering">
        Open projectfinanciering
      </a>
    ) : null;

  return (
    <section className="fwk-po" data-testid="detail-opnemen" aria-labelledby="fwk-po-kop">
      <style>{CSS_OPNEMEN}</style>
      <h3 id="fwk-po-kop" className="fwk-po-kop">
        Opnemen in een project
      </h3>

      {kiesbaar.length === 0 ? (
        <div data-testid="add-geen-project" className="fwk-po-tekst">
          U heeft nog geen actief project. Maak er een aan bij <a href="#/kompas/projecten">Projecten</a>, dan kunt u hier regelingen en fondsen aan
          toevoegen.
        </div>
      ) : fase === 'opgeslagen' ? (
        <div data-testid="add-succes">
          <div role="status" className="fwk-po-melding" data-toon="ok">
            {bron.naam} staat nu in de projectfinanciering van {(project && project.naam) || 'uw project'}.
          </div>
          <div className="fwk-po-acties">{openLink('vol')}</div>
        </div>
      ) : (
        <>
          <div className="fwk-po-rij">
            <select
              aria-label="Project"
              data-testid="add-project"
              className="fwk-po-select"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              {kiesbaar.length > 1 && <option value="">Kies een project…</option>}
              {kiesbaar.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.naam || 'Naamloos project'}
                </option>
              ))}
            </select>
            {bestaatAl ? (
              openLink('licht')
            ) : (
              <button type="button" className="fwk-po-knop" onClick={opslaan} disabled={!projectId || fase === 'bezig'} data-testid="add-opslaan">
                {fase === 'bezig' ? 'Bezig…' : 'Toevoegen'}
              </button>
            )}
          </div>

          {bestaatAl && (
            <div data-testid="add-bestaat-al" role="status" className="fwk-po-melding" data-toon="let-op">
              Staat al in projectfinanciering
            </div>
          )}

          {fout && (
            <div data-testid="add-fout" role="alert" className="fwk-po-melding" data-toon="fout">
              {fout}
            </div>
          )}
        </>
      )}
    </section>
  );
}
