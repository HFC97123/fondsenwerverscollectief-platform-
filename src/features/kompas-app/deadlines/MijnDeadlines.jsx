// Mijn deadlines (Pro/Premium): de deadlines van de projectfinanciering van het lid.
// Geen eigen bron: de regels komen uit kompas_dekkingsplan (via useDekkingsplannen), dus met dezelfde
// maskering, dezelfde effectieve deadline en dezelfde rekenmodule als Projectfinanciering en Dashboard.
import React, { useMemo } from 'react';
import { css } from '../../../shared/lib/css.js';
import { mijnDeadlines } from '../financiering/dekkingsplan.js';
import { useDekkingsplannen } from '../financiering/useProjectFinanciering.js';
import { isEchtId } from '../../../data/services/projecten.js';
import FundingDeadlineRow, { CSS_RIJ } from './FundingDeadlineRow.jsx';

const KOP = "margin: 0 0 8px; font-family: 'Mulish', sans-serif; font-size: 12.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #2C4A5E;";
const TEKST = "font-family: 'Mulish', sans-serif; font-size: 14.5px; line-height: 1.6; color: #4B5C58;";
const LEEG = 'padding: 26px 24px; border: 1px dashed #CFDDD5; border-radius: 16px; background: #FFFFFF;';

function Groep({ titel, testid, rijen, nu, onHerinnering }) {
  if (!rijen.length) return null;

  return (
    <section data-testid={testid} style={css('display: flex; flex-direction: column; gap: 10px;')}>
      <h2 style={css(KOP)}>{titel} <span style={css('color: #7B8985;')}>({rijen.length})</span></h2>
      {rijen.map((rij) => (
        <FundingDeadlineRow key={rij.regel.id} rij={rij} nu={nu} onHerinnering={onHerinnering} />
      ))}
    </section>
  );
}

export default function MijnDeadlines({ projecten, onNaarAlleRegelingen }) {
  const actief = useMemo(() => (projecten || []).filter((p) => p && !p.gearchiveerd && isEchtId(p.id)), [projecten]);
  const ids = useMemo(() => actief.map((p) => p.id), [actief]);
  const { status, perProject, wijzig } = useDekkingsplannen(ids);
  const nu = new Date();
  const groepen = useMemo(() => mijnDeadlines(actief, perProject, new Date()), [actief, perProject]);

  const wisselHerinnering = (rij) => wijzig(rij.project.id, rij.regel.id, { reminder: !rij.regel.reminder });

  return (
    <div data-testid="mijn-deadlines" style={css('display: flex; flex-direction: column; gap: 22px; min-width: 0;')}>
      <style>{CSS_RIJ}</style>

      {actief.length === 0 && (
        <div data-testid="md-geen-projecten" style={css(`${TEKST} ${LEEG}`)}>
          U heeft nog geen actief project. Maak er een aan bij <a href="#/kompas/projecten" style={css('color: #4E9A6C; font-weight: 800;')}>Projecten</a>; de deadlines van de regelingen en fondsen die u eraan toevoegt, staan dan hier.
        </div>
      )}

      {actief.length > 0 && status === 'laden' && <div style={css(`${TEKST} color: #7B8985;`)}>Uw deadlines worden geladen…</div>}

      {actief.length > 0 && status === 'fout' && (
        <div data-testid="md-fout" style={css(`${TEKST} padding: 20px 22px; border: 1px solid #EDD3CE; border-radius: 16px; background: #FDF6F5; color: #9E3B2C; font-weight: 700;`)}>
          Uw deadlines konden niet worden geladen. Probeer het later opnieuw.
        </div>
      )}

      {actief.length > 0 && status === 'klaar' && groepen.totaal === 0 && (
        <div data-testid="md-leeg" style={css(`${TEKST} ${LEEG}`)}>
          Nog geen regelingen in uw projecten.{' '}
          <button
            type="button"
            onClick={onNaarAlleRegelingen}
            style={css("cursor: pointer; border: none; background: none; padding: 0; font-family: 'Mulish', sans-serif; font-size: 14.5px; font-weight: 800; color: #4E9A6C;")}
          >
            Bekijk alle regelingen
          </button>
        </div>
      )}

      {status === 'klaar' && groepen.totaal > 0 && (
        <>
          <div style={css(`${TEKST} font-size: 13.5px; font-weight: 700; color: #687974;`)}>
            {groepen.totaal} {groepen.totaal === 1 ? 'regel' : 'regels'} in uw projectfinanciering · eerstvolgende deadline bovenaan
          </div>
          <Groep titel="Komende deadlines" testid="md-groep-komend" rijen={groepen.komend} nu={nu} onHerinnering={wisselHerinnering} />
          <Groep titel="Verstreken of afgehandeld" testid="md-groep-eerder" rijen={groepen.eerder} nu={nu} onHerinnering={wisselHerinnering} />
          <Groep titel="Zonder deadline" testid="md-groep-zonder" rijen={groepen.zonder} nu={nu} onHerinnering={wisselHerinnering} />
        </>
      )}
    </div>
  );
}
