// "Cofinanciers en andere financiering" in het projectoverzicht: een lichte ingang op dezelfde fundingtabel
// (subsidie_kompas_program_funding) als het tabblad Projectfinanciering. Hier legt u snel een bekende financier vast
// (naam, bedrag, status, eventueel deadline); het volledige dekkingsplan (alle regels, herinneringen, notities,
// voortgang) blijft bij Projectfinanciering. Er is geen tweede opslag: dezelfde regels, dezelfde rekenmodule.
import React from 'react';
import { css } from '../../../shared/lib/css.js';
import BespreekLink from '../financiering/BespreekLink.jsx';
import FinancierFormulier from '../financiering/FinancierFormulier.jsx';
import { StatusChip } from '../financiering/FinancieringUi.jsx';
import { formatDatum, formatEuro, regelBedrag } from '../financiering/dekkingsplan.js';

const TEKST = "font-family: 'Mulish', sans-serif; font-size: 14.5px; line-height: 1.6; color: #4B5C58;";
const LABEL = "font-family: 'Mulish', sans-serif; font-size: 11.5px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #7B8985;";
const KAART = 'box-sizing: border-box; padding: 20px 22px; border: 1px solid #E1EAE4; border-radius: 20px; background: #FFFFFF; min-width: 0;';
const LINK = "font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 800; color: #4E9A6C; text-decoration: none; cursor: pointer; background: none; border: none; padding: 0;";

// Het bedrag dat bij de status hoort: toegekend telt het toegekende bedrag (leeg: het aangevraagde), de rest het aangevraagde.
function bedragVan(regel) {
  const w = regel.status === 'awarded' ? (regel.awarded != null ? regel.awarded : regel.requested) : regel.requested != null ? regel.requested : regel.awarded;

  return w == null ? '—' : formatEuro(regelBedrag(w));
}

export default function CofinanciersSectie({ project, financiering }) {
  const { status, regels, laad } = financiering;
  const namen = (regels || []).filter((r) => r.bronType === 'financier');
  const overige = (regels || []).length - namen.length;

  return (
    <section data-testid="cofinanciers-sectie" style={css(KAART)}>
      <div style={css('display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px;')}>
        <h2 style={css(`${LABEL} margin: 0;`)}>Cofinanciers en andere financiering</h2>
        <a href={`#/kompas/projecten/${project.id}?tab=projectfinanciering`} data-testid="naar-projectfinanciering" style={css(LINK)}>
          Volledig dekkingsplan in Projectfinanciering
        </a>
      </div>

      {status === 'geen-database' && <div style={css(`${TEKST} color: #7B8985;`)}>Sla het project op in uw account om financiers vast te leggen.</div>}
      {status === 'fout' && (
        <div role="alert" style={css(`${TEKST} color: #8A5A16;`)}>
          De financiering kon niet worden geladen. Ververs de pagina of probeer het later opnieuw.
        </div>
      )}
      {status === 'laden' && <div style={css(`${TEKST} color: #7B8985;`)}>Financiering wordt geladen…</div>}

      {status === 'klaar' && (
        <>
          {namen.length > 0 ? (
            <ul style={css('list-style: none; margin: 0 0 14px; padding: 0; display: flex; flex-direction: column; gap: 10px;')}>
              {namen.map((r) => (
                <li
                  key={r.id}
                  data-testid="cofin-regel"
                  data-regel-id={r.id}
                  style={css('display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center; padding: 10px 12px; border: 1px solid #E1EAE4; border-radius: 12px;')}
                >
                  <div style={css('flex: 1 1 180px; min-width: 0;')}>
                    <div data-testid="cofin-naam" style={css(`${TEKST} font-weight: 800; color: #2C4A5E; overflow-wrap: anywhere;`)}>
                      {r.naam}
                    </div>
                    {r.eigenDeadline && status === 'klaar' && ['interesting', 'preparing', 'submitted'].indexOf(r.status) !== -1 && (
                      <div data-testid="cofin-deadline" style={css(`${TEKST} font-size: 12.5px; color: #7B8985;`)}>
                        Deadline {formatDatum(r.eigenDeadline)}
                      </div>
                    )}
                  </div>
                  <div data-testid="cofin-bedrag" style={css("font-family: 'Newsreader', serif; font-size: 17px; font-weight: 600; color: #2C4A5E; white-space: nowrap;")}>{bedragVan(r)}</div>
                  <StatusChip status={r.status} />
                  <div style={css('display: flex; gap: 14px; align-items: center; flex-wrap: wrap;')}>
                    <a href={`#/kompas/projecten/${project.id}?tab=projectfinanciering`} data-testid="cofin-bewerk" style={css(`${LINK} display: inline-flex; align-items: center; min-height: 44px;`)}>
                      Bewerken
                    </a>
                    <BespreekLink projectId={r.projectId || project.id} fundingId={r.id} naam={r.naam} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div data-testid="cofin-leeg" style={css(`${TEKST} margin-bottom: 12px; color: #7B8985;`)}>
              Nog geen financiers op naam. Leg hier snel vast wie al heeft toegezegd of aangevraagd, bijvoorbeeld een gemeente of een lokale sponsor.
            </div>
          )}
          {overige > 0 && (
            <div style={css(`${TEKST} margin-bottom: 12px; font-size: 13px; color: #7B8985;`)}>
              {overige === 1 ? 'Daarnaast staat er 1 fonds of regeling' : `Daarnaast staan er ${overige} fondsen of regelingen`} in het dekkingsplan (Projectfinanciering).
            </div>
          )}
          {project.id && <FinancierFormulier projectId={project.id} onKlaar={laad} />}
        </>
      )}
    </section>
  );
}
