// Subsidieadvies: de balk met vijf knoppen (Overzicht, 1 Fondsen, 2 Begroting, 3 Deadlines, 4 Indienen) en de projectkeuze.
// Staat onder de hoofdnavigatie op alle pagina's die bij Subsidieadvies horen. De balk bewaart zelf niets: het project staat in
// de URL (?project=<id>) en elke stap is de bestaande pagina (zie adviesLinks.js).
import React, { useEffect, useMemo, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { useKompas } from '../KompasStore.jsx';
import { isEchtId } from '../../../data/services/projecten.js';
import { STAPPEN, huidigeStap, kiesProjectId, leesProjectParam, stapHref } from './adviesLinks.js';
import { huidigeHash } from '../../../app/adres.js';

const STIJL = `
.fwk-av-stap { text-decoration: none; transition: border-color .15s ease, background .15s ease; }
.fwk-av-stap:hover { border-color: #A8D5BA !important; }
.fwk-av-stap:focus-visible, .fwk-av-project:focus-visible { outline: 2px solid #4E9A6C; outline-offset: 2px; }
`;

export function useHash() {
  const [hash, setHash] = useState(() => (typeof window === 'undefined' ? '' : huidigeHash()));

  useEffect(() => {
    const volg = () => setHash(huidigeHash());

    window.addEventListener('hashchange', volg);

    return () => window.removeEventListener('hashchange', volg);
  }, []);

  return hash;
}

// De projecten waaruit Subsidieadvies kiest: echt (bewaard) en niet gearchiveerd.
export function useAdviesProjecten() {
  const store = useKompas();

  return useMemo(() => (store.projects || []).filter((p) => p && isEchtId(p.id) && !p.gearchiveerd), [store.projects]);
}

export default function AdviesSubnav({ pad }) {
  const hash = useHash();
  const projecten = useAdviesProjecten();
  const projectId = kiesProjectId(projecten, leesProjectParam(hash));
  const stap = huidigeStap(pad, hash);

  return (
    <div data-testid="advies-subnav" style={css('border-bottom: 1px solid #E1EAE4; background: #FFFFFF;')}>
      <style>{STIJL}</style>
      <div style={css('max-width: 1120px; margin: 0 auto; padding: 10px clamp(16px, 4vw, 24px); display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px;')}>
        {projecten.length > 0 && (
          <select
            className="fwk-av-project"
            data-testid="advies-project"
            aria-label="Project"
            value={projectId}
            onChange={(e) => {
              window.location.hash = stapHref(stap || 'overzicht', e.target.value);
            }}
            style={css("max-width: 240px; font-family: 'Mulish', sans-serif; font-size: 14px; font-weight: 800; color: #2C4A5E; border: 1px solid #E1EAE4; border-radius: 12px; padding: 8px 12px; background: #FFFFFF;")}
          >
            {projecten.map((p) => (
              <option key={p.id} value={p.id}>
                {p.naam || 'Naamloos project'}
              </option>
            ))}
          </select>
        )}
        <nav aria-label="Subsidieadvies" style={css('display: flex; flex-wrap: wrap; gap: 8px;')}>
          {STAPPEN.map((s) => {
            const actief = stap === s.id;

            return (
              <a
                key={s.id}
                className="fwk-av-stap"
                data-testid={`advies-stap-${s.id}`}
                href={stapHref(s.id, projectId)}
                aria-current={actief ? 'page' : undefined}
                style={css(
                  `display: inline-flex; align-items: center; gap: 9px; padding: 6px 15px 6px 6px; border-radius: 999px; border: 1px solid ${actief ? '#4E9A6C' : '#E1EAE4'}; background: ${actief ? '#E6F2EA' : '#FFFFFF'}; font-family: 'Mulish', sans-serif; font-size: 14px; font-weight: 800; color: #2C4A5E;`,
                )}
              >
                <span
                  aria-hidden="true"
                  style={css(
                    `width: 26px; height: 26px; border-radius: 50%; display: inline-grid; place-items: center; font-family: 'Newsreader', serif; font-size: 14px; background: ${actief ? '#4E9A6C' : '#EAEFF3'}; color: ${actief ? '#FFFFFF' : '#2C4A5E'};`,
                  )}
                >
                  {s.nr}
                </span>
                {s.label}
              </a>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
