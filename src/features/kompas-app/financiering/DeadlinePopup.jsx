// Pop-up 14 dagen voor elke concrete datum: de sluitingsdatum van een fonds in het dekkingsplan ("Aanvraag voorbereiden") en de datum van elke open actie
// uit het actieplan. Kort en schoon, wegklikbaar. Per datum komt hij één keer op 14 dagen en nog één keer als er nog 3 dagen of minder zijn.
// Alleen lezen: gebruikt dezelfde dekkingsplannen en acties als het actieplan; er wordt niets opgeslagen behalve de wegklik (localStorage, per apparaat).
import React, { useEffect, useMemo, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { isEchtId } from '../../../data/services/projecten.js';
import { useKompas } from '../KompasStore.jsx';
import { useDekkingsplannen } from './useProjectFinanciering.js';
import { useActieplan } from './useActieplan.js';
import { bouwActiesEnDeadlines, SOORT } from './actiesEnDeadlines.js';
import { ACTIEVE_STATUSSEN, dagenTot, formatDatum } from './dekkingsplan.js';

export const POPUP_DAGEN = 14;
const MAX_IN_POPUP = 3;

export function popupTekstDagen(dagen) {
  if (dagen <= 0) return 'vandaag';
  if (dagen === 1) return 'morgen';
  if (dagen >= 14) return '2 weken';

  return `${dagen} dagen`;
}

// Zuiver: welke regels krijgen een pop-up? -> [{ id, naam, datum, dagen, projectNaam }] gesorteerd op datum.
export function popupRegels({ projecten, perProject, nu }) {
  const uit = [];

  (projecten || []).forEach((p) => {
    ((perProject && perProject[p.id]) || []).forEach((r) => {
      if (!r || ACTIEVE_STATUSSEN.indexOf(r.status) === -1 || !r.deadline || r.bronStatus === 'verborgen' || r.bronStatus === 'verwijderd') return;

      const dagen = dagenTot(r.deadline, nu);

      if (dagen == null || dagen < 0 || dagen > POPUP_DAGEN) return;

      uit.push({ id: r.id, naam: r.naam || 'Financier', soort: 'fonds', datum: String(r.deadline).slice(0, 10), dagen, projectNaam: p.naam || 'Naamloos project' });
    });
  });

  return uit.sort((a, b) => a.datum.localeCompare(b.datum) || a.naam.localeCompare(b.naam, 'nl'));
}

// Open acties met een datum binnen 14 dagen. Een actie bij een fonds dat al een sluitingsdatum-melding heeft, komt er niet dubbel bij.
export function popupActies({ projecten, perProject, taken, nu, fondsMeldingen = [] }) {
  const metMelding = new Set(fondsMeldingen.map((r) => r.id));
  const uit = [];

  (projecten || []).forEach((p) => {
    bouwActiesEnDeadlines({ project: p, regels: (perProject && perProject[p.id]) || [], taken: taken ? taken(p.id) : [], nu })
      .filter((i) => i.soort === SOORT.TAAK && i.status !== 'done' && i.datum && !(i.regelId && metMelding.has(i.regelId)))
      .forEach((i) => {
        const dagen = dagenTot(i.datum, nu);

        if (dagen == null || dagen < 0 || dagen > POPUP_DAGEN) return;

        uit.push({ id: i.sleutel, naam: i.titel, soort: 'actie', datum: String(i.datum).slice(0, 10), dagen, projectNaam: p.naam || 'Naamloos project' });
      });
  });

  return uit.sort((a, b) => a.datum.localeCompare(b.datum) || a.naam.localeCompare(b.naam, 'nl'));
}

// Eén keer op 14 dagen (niveau 'w2') en één keer bij 3 dagen of minder ('w3').
const niveau = (r) => (r.dagen <= 3 ? 'w3' : 'w2');
const wegSleutel = (r) => `sk-deadlinepopup-${r.id}-${r.datum}-${niveau(r)}`;

function isWeg(r) {
  try {
    return window.localStorage.getItem(wegSleutel(r)) === '1';
  } catch (e) {
    return false;
  }
}

function zetWeg(r) {
  try {
    window.localStorage.setItem(wegSleutel(r), '1');
  } catch (e) {
    // Zonder opslag komt de pop-up bij de volgende keer openen terug; verder werkt alles.
  }
}

export default function DeadlinePopup() {
  const store = useKompas();
  const projecten = useMemo(() => (store.projects || []).filter((p) => p && !p.gearchiveerd && isEchtId(p.id)), [store.projects]);
  const ids = useMemo(() => projecten.map((p) => p.id), [projecten]);
  const { status, perProject } = useDekkingsplannen(ids);
  const plan = useActieplan(ids);
  const nu = useMemo(() => new Date(), []);
  const [weg, setWeg] = useState(0);
  const klaar = status === 'klaar' && plan.status !== 'laden';
  const alle = useMemo(() => {
    if (!klaar) return [];

    const fondsen = popupRegels({ projecten, perProject, nu });
    const acties = popupActies({ projecten, perProject, taken: (id) => plan.actieVoor(id), nu, fondsMeldingen: fondsen });

    return [...fondsen, ...acties].sort((a, b) => a.datum.localeCompare(b.datum) || a.naam.localeCompare(b.naam, 'nl'));
  }, [klaar, projecten, perProject, plan, nu]);
  const nieuw = useMemo(() => alle.filter((r) => !isWeg(r)), [alle, weg]); // eslint-disable-line react-hooks/exhaustive-deps
  const tonen = nieuw.slice(0, MAX_IN_POPUP);

  const sluit = () => {
    nieuw.forEach((r) => zetWeg(r));
    setWeg((n) => n + 1);
  };

  useEffect(() => {
    if (!tonen.length) return undefined;

    const sluitMetEsc = (e) => {
      if (e.key === 'Escape') sluit();
    };

    window.addEventListener('keydown', sluitMetEsc);

    return () => window.removeEventListener('keydown', sluitMetEsc);
  }, [tonen.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!tonen.length) return null;

  const titel = tonen.every((r) => r.soort === 'fonds') ? 'Aanvraag voorbereiden' : 'Binnenkort';

  return (
    <div data-testid="deadline-popup-achtergrond" style={css('position: fixed; inset: 0; z-index: 1500; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(44, 74, 94, 0.38);')}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="deadline-popup-titel"
        data-testid="deadline-popup"
        style={css("box-sizing: border-box; width: 100%; max-width: 420px; padding: 24px 26px; border-radius: 22px; background: #FFFFFF; box-shadow: 0 18px 50px rgba(44, 74, 94, 0.28); font-family: 'Mulish', sans-serif; color: #4B5C58;")}
      >
        <h2 id="deadline-popup-titel" style={css("margin: 0 0 14px; font-family: 'Newsreader', serif; font-size: 26px; font-weight: 600; color: #2C4A5E;")}>{titel}</h2>
        <ul style={css('list-style: none; margin: 0 0 20px; padding: 0; display: flex; flex-direction: column; gap: 12px;')}>
          {tonen.map((r) => (
            <li key={`${r.id}-${r.datum}`} data-testid="deadline-popup-regel">
              <div style={css('font-size: 15px; font-weight: 800; color: #2C4A5E;')}>{r.naam}</div>
              <div style={css('font-size: 13.5px; color: #6D7C77;')}>
                {r.soort === 'fonds' ? 'Sluit op ' : ''}
                {formatDatum(r.datum)} · nog {popupTekstDagen(r.dagen)} · {r.projectNaam}
              </div>
            </li>
          ))}
        </ul>
        <div style={css('display: flex; gap: 10px; flex-wrap: wrap;')}>
          <a
            href="#/kompas/deadlines"
            data-testid="deadline-popup-actieplan"
            onClick={sluit}
            style={css('display: inline-flex; align-items: center; min-height: 42px; padding: 0 20px; border-radius: 999px; background: #4E9A6C; color: #FFFFFF; font-size: 14px; font-weight: 800; text-decoration: none;')}
          >
            Naar het actieplan
          </a>
          <button
            type="button"
            data-testid="deadline-popup-later"
            onClick={sluit}
            style={css('cursor: pointer; min-height: 42px; padding: 0 18px; border: 1px solid #CFDDD5; border-radius: 999px; background: #FFFFFF; color: #2C4A5E; font-family: inherit; font-size: 14px; font-weight: 800;')}
          >
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
}
