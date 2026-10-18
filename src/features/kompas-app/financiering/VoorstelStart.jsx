// Startpunt van "Maak dekkingsplan en actieplan met Subsidie Kompas", binnen het project (geen tweede chatbot, geen losse generator).
// De knop is ALTIJD zichtbaar, ook bij een leeg dekkingsplan. Hij is pas actief als de volledige flow werkt
// (voorstelGeneratieBeschikbaar); tot die tijd staat er duidelijk dat het maken van een voorstel nog niet beschikbaar is.
// De regel "wat heeft Subsidie Kompas nog nodig" is wel al werkend: dezelfde zuivere controle (beoordeelProject) als de flow gebruikt.
import React, { useMemo } from 'react';
import { css } from '../../../shared/lib/css.js';
import { beoordeelProject } from './voorstel.js';
import { ONTBREKEND_LABEL, voorstelGeneratieBeschikbaar } from './voorstelFlow.js';

const TEKST = "font-family: 'Mulish', sans-serif; font-size: 14px; line-height: 1.55; color: #4B5C58;";
const LABEL = "font-family: 'Mulish', sans-serif; font-size: 11.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #7B8985;";

function lijstTekst(items) {
  if (items.length <= 1) return items.join('');

  return `${items.slice(0, -1).join(', ')} en ${items[items.length - 1]}`;
}

// metProfielStap: de knop opent eerst het zoekprofiel (bekijken, aanvullen, bevestigen). Ontbrekende projectgegevens en een nog onbekende begroting zijn dan
// geen reden om de knop te blokkeren: het lid vult ze in het profiel aan, of zoekt zonder bedrag.
export default function VoorstelStart({ project, beschikbaar = voorstelGeneratieBeschikbaar(), opgeslagen = true, bezig = false, onStart, metProfielStap = false }) {
  const oordeel = useMemo(() => beoordeelProject({ project }), [project]);
  const essentieel = oordeel.ontbrekend.filter((o) => o.soort === 'essentieel').map((o) => ONTBREKEND_LABEL[o.veld]).filter(Boolean);
  // Knop alleen aan als de flow werkt, het project is opgeslagen, de essentiële gegevens er zijn, er een begroting is (anders valt er niets te dekken) en er niet al iets bezig is.
  const projectKlaar = oordeel.kanOnderzoeken && oordeel.bedragenToegestaan;
  const actief = beschikbaar && opgeslagen && (projectKlaar || metProfielStap) && !bezig;

  return (
    <section
      data-testid="voorstel-start"
      data-beschikbaar={beschikbaar && opgeslagen ? 'ja' : 'nee'}
      style={css('box-sizing: border-box; padding: 20px 22px; border: 1px solid #CFE4D7; border-radius: 20px; background: #F3F9F5; display: flex; flex-direction: column; gap: 12px;')}
    >
      <div style={css('display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;')}>
        <div style={css('min-width: 0; flex: 1 1 280px;')}>
          <h2 style={css(`${LABEL} margin: 0;`)}>Subsidie Kompas</h2>
        </div>
        <button
          type="button"
          data-testid="voorstel-start-knop"
          disabled={!actief}
          aria-disabled={!actief}
          onClick={actief && onStart ? onStart : undefined}
          style={css(
            `min-height: 44px; padding: 0 20px; border: none; border-radius: 999px; font-family: 'Mulish', sans-serif; font-size: 14px; font-weight: 800; ${
              actief ? 'cursor: pointer; background: #2C4A5E; color: #FFFFFF;' : 'cursor: not-allowed; background: #E1EAE4; color: #7B8985;'
            }`,
          )}
        >
          Maak dekkingsplan en actieplan met Subsidie Kompas
        </button>
      </div>

      {!actief && !bezig && !(beschikbaar && opgeslagen) && (
        <div role="status" data-testid="voorstel-nog-niet" style={css(`${TEKST} padding: 10px 14px; border: 1px solid #EEDCC0; border-radius: 12px; background: #FBF1E3; color: #8A5A16;`)}>
          {opgeslagen
            ? 'Nog niet beschikbaar.'
            : 'Sla dit project eerst op.'}
        </div>
      )}

      {beschikbaar && opgeslagen && !projectKlaar && !bezig && !metProfielStap && (
        <div role="status" data-testid="voorstel-eerst-aanvullen" style={css(`${TEKST} padding: 10px 14px; border: 1px solid #EEDCC0; border-radius: 12px; background: #FBF1E3; color: #8A5A16;`)}>
          {oordeel.kanOnderzoeken
            ? 'Vul eerst de projectbegroting in.'
            : 'Vul eerst de ontbrekende projectgegevens aan.'}
        </div>
      )}

      {!metProfielStap && essentieel.length > 0 && (
        <div data-testid="voorstel-project-controle" style={css(`${TEKST} font-size: 13px;`)}>
          Nog nodig: <strong>{lijstTekst(essentieel)}</strong>.{' '}
          <a href={`#/kompas/projecten/${project && project.id}?tab=overzicht`} style={css('color: #4E9A6C; font-weight: 800;')}>
            Aanvullen
          </a>
        </div>
      )}
    </section>
  );
}
