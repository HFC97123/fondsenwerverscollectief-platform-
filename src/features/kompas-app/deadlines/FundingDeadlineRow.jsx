// Eén regel in "Mijn deadlines": effectieve deadline, fonds/regeling, project, status, gevraagd bedrag,
// herinnering en de link naar de projectfinanciering. Toont alleen wat kompas_dekkingsplan al heeft
// teruggegeven (gemaskeerd naar het abonnement); er is geen eigen bron.
import React from 'react';
import { css } from '../../../shared/lib/css.js';
import { DeadlineWeergave, HerinneringKnop, StatusChip } from '../financiering/FinancieringUi.jsx';
import { deadlineWeergave, formatEuro } from '../financiering/dekkingsplan.js';
import { projectFinancieringHref } from '../financiering/deeplinks.js';

export const CSS_RIJ = `
.fwk-md-rij { display: grid; grid-template-columns: 168px minmax(0, 1fr) auto; gap: 10px 20px; align-items: center; box-sizing: border-box; padding: 16px 20px; border: 1px solid #E1EAE4; border-radius: 16px; background: #FFFFFF; }
.fwk-md-acties { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
@media (max-width: 759px) { .fwk-md-rij { grid-template-columns: minmax(0, 1fr); padding: 14px 16px; } .fwk-md-acties { flex-direction: row; flex-wrap: wrap; align-items: center; } }
.fwk-md-rij a:focus-visible, .fwk-md-rij button:focus-visible { outline: 2px solid #4E9A6C; outline-offset: 2px; }
`;

const TEKST = "font-family: 'Mulish', sans-serif; line-height: 1.5;";

export default function FundingDeadlineRow({ rij, nu, onHerinnering }) {
  const { regel, project } = rij;
  const w = deadlineWeergave(regel, nu);
  const heeftBron = regel.bronStatus === 'zichtbaar';
  const soort = regel.bronType === 'fonds' ? 'Fonds' : 'Regeling';

  return (
    <article
      className="fwk-md-rij"
      data-testid="md-rij"
      data-regel-id={regel.id}
      data-bron-status={regel.bronStatus}
      data-deadline={w.datum || ''}
      style={css(w.verstreken ? 'background: #FBFCFB;' : '')}
    >
      <div data-testid="md-deadline" style={css(`${TEKST} font-size: 14px; font-weight: 800; color: ${w.dringend ? '#9E3B2C' : '#2C4A5E'};`)}>
        <DeadlineWeergave regel={regel} nu={nu} compact />
      </div>

      <div style={css('min-width: 0;')}>
        <div
          data-testid="md-naam"
          style={css(`${TEKST} font-size: 15.5px; font-weight: 800; overflow-wrap: anywhere; color: ${heeftBron ? '#2C4A5E' : '#7B8985'}; ${heeftBron ? '' : 'font-style: italic;'}`)}
        >
          {regel.naam}
        </div>
        <div style={css(`${TEKST} font-size: 13px; color: #687974; overflow-wrap: anywhere;`)}>
          {heeftBron && `${soort}${regel.funder && regel.bronType !== 'fonds' ? ` · ${regel.funder}` : ''} · `}
          <span data-testid="md-project">{project.naam}</span>
        </div>
        <div style={css('display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 8px;')}>
          <StatusChip status={regel.status} />
          {regel.requested != null && (
            <span data-testid="md-bedrag" style={css(`${TEKST} font-size: 13px; font-weight: 700; color: #4B5C58;`)}>
              Gevraagd {formatEuro(regel.requested)}
            </span>
          )}
        </div>
      </div>

      <div className="fwk-md-acties">
        <HerinneringKnop aan={regel.reminder} naam={regel.naam} onWissel={() => onHerinnering(rij)} />
        <a
          href={projectFinancieringHref(project.id)}
          data-testid="md-open"
          style={css("display: inline-flex; align-items: center; min-height: 44px; font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 800; color: #4E9A6C; text-decoration: none;")}
        >
          Open projectfinanciering →
        </a>
      </div>
    </article>
  );
}
