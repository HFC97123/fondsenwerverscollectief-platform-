// Startpunt van "Maak dekkingsplan en actieplan met Subsidiekompas", binnen het project (geen tweede chatbot, geen losse generator).
// De knop is ALTIJD zichtbaar, ook bij een leeg dekkingsplan. Hij is pas actief als de volledige flow werkt
// (voorstelGeneratieBeschikbaar); tot die tijd staat er duidelijk dat het maken van een voorstel nog niet beschikbaar is.
// De regel "wat heeft Subsidiekompas nog nodig" is wel al werkend: dezelfde zuivere controle (beoordeelProject) als de flow gebruikt.
import React, { useMemo } from 'react';
import { css } from '../../../shared/lib/css.js';
import { beoordeelProject } from './voorstel.js';
import { ONTBREKEND_LABEL, VOORSTEL_STAPPEN, voorstelGeneratieBeschikbaar } from './voorstelFlow.js';

const TEKST = "font-family: 'Mulish', sans-serif; font-size: 14px; line-height: 1.55; color: #4B5C58;";
const LABEL = "font-family: 'Mulish', sans-serif; font-size: 11.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #7B8985;";

function lijstTekst(items) {
  if (items.length <= 1) return items.join('');

  return `${items.slice(0, -1).join(', ')} en ${items[items.length - 1]}`;
}

export default function VoorstelStart({ project, beschikbaar = voorstelGeneratieBeschikbaar(), opgeslagen = true, onStart }) {
  const oordeel = useMemo(() => beoordeelProject({ project }), [project]);
  const essentieel = oordeel.ontbrekend.filter((o) => o.soort === 'essentieel').map((o) => ONTBREKEND_LABEL[o.veld]).filter(Boolean);
  const aanvullend = oordeel.ontbrekend.filter((o) => o.soort !== 'essentieel').map((o) => ONTBREKEND_LABEL[o.veld]).filter(Boolean);
  const actief = beschikbaar && opgeslagen;

  return (
    <section
      data-testid="voorstel-start"
      data-beschikbaar={actief ? 'ja' : 'nee'}
      style={css('box-sizing: border-box; padding: 20px 22px; border: 1px solid #CFE4D7; border-radius: 20px; background: #F3F9F5; display: flex; flex-direction: column; gap: 12px;')}
    >
      <div style={css('display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;')}>
        <div style={css('min-width: 0; flex: 1 1 280px;')}>
          <h2 style={css(`${LABEL} margin: 0 0 4px;`)}>Subsidiekompas</h2>
          <div style={css(`${TEKST} font-weight: 700; color: #2C4A5E;`)}>Laat een dekkingsplan en actieplan voor dit project voorstellen. U bekijkt en past alles aan; er wordt niets opgeslagen zonder uw klik.</div>
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
          Maak dekkingsplan en actieplan met Subsidiekompas
        </button>
      </div>

      {!actief && (
        <div role="status" data-testid="voorstel-nog-niet" style={css(`${TEKST} padding: 10px 14px; border: 1px solid #EEDCC0; border-radius: 12px; background: #FBF1E3; color: #8A5A16;`)}>
          {opgeslagen
            ? 'Het maken van een voorstel is nog niet beschikbaar. Het wordt stap voor stap opgebouwd en de knop gaat pas aan als de hele flow werkt. Uw bestaande financiering en acties hieronder werken al.'
            : 'Sla dit project eerst op (Projecten); daarna kunt u een voorstel laten maken.'}
        </div>
      )}

      <ol data-testid="voorstel-stappen" style={css(`${TEKST} margin: 0; padding-left: 20px; font-size: 13px; color: #6D7C77;`)}>
        {VOORSTEL_STAPPEN.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>

      <div data-testid="voorstel-project-controle" style={css(`${TEKST} font-size: 13px;`)}>
        {essentieel.length > 0 ? (
          <>
            Voor een voorstel heeft Subsidiekompas nog nodig: <strong>{lijstTekst(essentieel)}</strong>.{' '}
            <a href={`#/kompas/projecten/${project && project.id}?tab=overzicht`} style={css('color: #4E9A6C; font-weight: 800;')}>
              Projectgegevens aanvullen
            </a>
          </>
        ) : (
          <>Doel en uitvoeringsgebied van dit project zijn bekend.</>
        )}
        {oordeel.ontbrekend.some((o) => o.veld === 'begroting') && (
          <div data-testid="voorstel-zonder-begroting" style={css('margin-top: 4px; color: #6D7C77;')}>
            Zonder projectbegroting kan Subsidiekompas financiers verkennen, maar geen sluitend dekkingsplan met bedragen maken.
          </div>
        )}
        {aanvullend.length > 0 && essentieel.length === 0 && <div style={css('margin-top: 4px; color: #6D7C77;')}>Handig om aan te vullen: {lijstTekst(aanvullend)}.</div>}
        {oordeel.tegenstrijdigheden.length > 0 && <div style={css('margin-top: 4px; color: #8A5A16;')}>Er zijn tegenstrijdige projectgegevens; Subsidiekompas vraagt u dan welke juist is.</div>}
      </div>
    </section>
  );
}
