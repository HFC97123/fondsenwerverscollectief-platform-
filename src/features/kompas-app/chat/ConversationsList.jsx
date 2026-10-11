// Eén gedeeld component voor de gesprekkenlijst van Subsidie Kompas (Pro/Premium).
// Hergebruikt op drie plekken, zonder aparte implementaties:
//   1. de vaste linkerkolom van de chatwerkruimte (desktop >= 1200 px),
//   2. de lade / bottom sheet (tablet en mobiel),
//   3. de projecttab Gesprekken (embedded, met projectFilter).
//
// Het component toont uitsluitend de bestaande gespreksdata (subsidie_kompas_conversations via de store) en
// geeft acties door aan de aanroeper (openen, nieuw, verwijderen). Het heeft geen eigen opslag; de enige
// lokale state is de tekst in het zoekveld. De groepering ("Dit project" / "Eerder") staat in
// gesprekGroepen.js: één definitie voor alle varianten.
//
// Props (varianten):
//   gesprekken            lijst uit de store: { id, titel, tijd, projectId }
//   actiefGesprekId       het geopende gesprek (wordt gemarkeerd)
//   actiefProjectId       het actieve project van het geopende gesprek ("Dit project")
//   actiefProjectNaam     alleen voor de kop van de groep
//   projectFilter         alleen gesprekken van dit project (projecttab); dan geen groepskoppen
//   compact               kleinere rijen
//   embedded              zonder eigen kader/kop (bijvoorbeeld binnen de projecttab)
//   showSearch            zoekveld tonen (standaard true)
//   showNewConversation   knop "Nieuw gesprek" tonen (standaard true)
//   onOpen(g) / onNieuw() / onVerwijder(g)   acties; ontbreekt onVerwijder dan staat er geen verwijderknop
//   laadId                id van het gesprek dat nu geladen wordt ("Laden…")
//   vergrendeld           tijdens een lopend antwoord: openen, nieuw en verwijderen staan even uit
//   renderExport(g)       optioneel: exportmenu onder het GEOPENDE gesprek (het exportmodel zelf blijft in de aanroeper)
//   projectNaamVan(id)    optioneel: toont in "Eerder" de projectnaam als subtiele regel
import React, { useMemo, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { groepeerGesprekken } from './gesprekGroepen.js';

const CSS_LIJST = `
.fwk-cl-rij { position: relative; display: block; border-radius: 12px; }
.fwk-cl-rij:hover { background: #F2F6F4; }
.fwk-cl-rij[data-actief="true"] { background: #EAF4EE; }
.fwk-cl-open { display: block; width: 100%; box-sizing: border-box; text-align: left; cursor: pointer; border: none; background: none; border-radius: 12px; font-family: 'Mulish', sans-serif; color: #2C4A5E; }
.fwk-cl-x { position: absolute; top: 4px; right: 4px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; border: none; border-radius: 8px; background: none; color: #9E3B2C; font-size: 17px; line-height: 1; opacity: 0; transition: opacity .12s ease; }
.fwk-cl-rij:hover .fwk-cl-x, .fwk-cl-rij:focus-within .fwk-cl-x { opacity: 1; }
@media (hover: none) { .fwk-cl-x { opacity: 1; } }
.fwk-cl-x:hover { background: #F9ECEA; }
.fwk-cl-lijst button:focus-visible, .fwk-cl-lijst input:focus-visible { outline: 2px solid #4E9A6C; outline-offset: 2px; }
.fwk-cl-titel { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow-wrap: anywhere; }
`;

function kortDatum(iso) {
  if (!iso) {
    return '';
  }

  try {
    const d = new Date(iso);
    const jaar = d.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' };

    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', ...jaar });
  } catch (e) {
    return '';
  }
}

const GROEPSKOP = css("margin: 0 0 4px; padding: 0 8px; font-family: 'Mulish', sans-serif; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #7B8985;");

function Rij({ g, actief, compact, laadId, vergrendeld, onOpen, onVerwijder, renderExport, subregel }) {
  return (
    <li data-testid="gesprek-rij" data-gesprek-id={g.id} style={css('list-style: none; margin: 0; padding: 0;')}>
      <div className="fwk-cl-rij" data-actief={actief ? 'true' : 'false'}>
        <button
          type="button"
          className="fwk-cl-open"
          data-testid="gesprek-open"
          aria-current={actief ? 'true' : undefined}
          disabled={vergrendeld}
          onClick={() => onOpen && onOpen(g)}
          style={css(`padding: ${compact ? '7px 8px' : '9px 10px'}; ${onVerwijder ? 'padding-right: 38px;' : ''} min-height: 44px; ${vergrendeld && !actief ? 'opacity: 0.55; cursor: default;' : ''}`)}
        >
          <span className="fwk-cl-titel" style={css(`display: -webkit-box; font-size: ${compact ? '13px' : '13.5px'}; font-weight: ${actief ? 800 : 700}; line-height: 1.35;`)}>
            {g.titel || 'Gesprek'}
          </span>
          <span style={css('display: block; margin-top: 2px; font-size: 11.5px; font-weight: 600; color: #7B8985; overflow-wrap: anywhere;')}>
            {laadId === g.id ? 'Laden…' : [kortDatum(g.tijd), subregel].filter(Boolean).join(' · ')}
          </span>
        </button>
        {onVerwijder && (
          <button
            type="button"
            className="fwk-cl-x"
            data-testid="gesprek-verwijder"
            aria-label={`Gesprek ${g.titel || 'Gesprek'} verwijderen`}
            title="Verwijderen"
            disabled={vergrendeld}
            onClick={() => onVerwijder(g)}
          >
            ×
          </button>
        )}
        {actief && renderExport && (
          <div data-testid="gesprek-acties" style={css('padding: 0 10px 8px;')}>
            {renderExport(g)}
          </div>
        )}
      </div>
    </li>
  );
}

export default function ConversationsList({
  gesprekken,
  actiefGesprekId = null,
  actiefProjectId = null,
  actiefProjectNaam = '',
  projectFilter = null,
  compact = false,
  embedded = false,
  showSearch = true,
  showNewConversation = true,
  onOpen,
  onNieuw,
  onVerwijder,
  laadId = null,
  vergrendeld = false,
  renderExport,
  projectNaamVan,
}) {
  const [zoek, setZoek] = useState('');
  const groepen = useMemo(
    () => groepeerGesprekken({ gesprekken, actiefProjectId, zoek, projectFilter }),
    [gesprekken, actiefProjectId, zoek, projectFilter],
  );
  const metKoppen = !projectFilter;
  const leeg = groepen.ditProject.length === 0 && groepen.eerder.length === 0;

  const rij = (g, subregel) => (
    <Rij
      key={g.id}
      g={g}
      actief={g.id === actiefGesprekId}
      compact={compact}
      laadId={laadId}
      vergrendeld={vergrendeld}
      onOpen={onOpen}
      onVerwijder={onVerwijder}
      renderExport={renderExport}
      subregel={subregel}
    />
  );

  return (
    <div
      className="fwk-cl-lijst"
      data-testid="conversations-list"
      data-variant={embedded ? 'embedded' : compact ? 'compact' : 'normaal'}
      style={css(`display: flex; flex-direction: column; gap: ${compact ? '10px' : '14px'}; min-width: 0;`)}
    >
      <style>{CSS_LIJST}</style>

      {showNewConversation && onNieuw && (
        <button
          type="button"
          data-testid="nieuw-gesprek"
          onClick={onNieuw}
          disabled={vergrendeld}
          style={css(
            "cursor: pointer; box-sizing: border-box; width: 100%; min-height: 44px; padding: 10px 16px; border: 1px solid #BFD4C6; border-radius: 999px; background: #EAF4EE; color: #2F6D47; font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 800;",
          )}
        >
          + Nieuw gesprek
        </button>
      )}

      {showSearch && (
        <input
          type="search"
          data-testid="gesprekken-zoek"
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
          placeholder="Zoek in gesprekken"
          aria-label="Zoek in gesprekken"
          style={css(
            "box-sizing: border-box; width: 100%; min-height: 40px; padding: 8px 14px; border: 1px solid #E1EAE4; border-radius: 12px; background: #FFFFFF; color: #2E3A38; font-family: 'Mulish', sans-serif; font-size: 13.5px;",
          )}
        />
      )}

      {vergrendeld && (
        <div data-testid="gesprekken-vergrendeld" role="status" style={css("padding: 0 8px; font-family: 'Mulish', sans-serif; font-size: 12px; color: #7B8985;")}>
          Even wachten: het antwoord wordt nog opgebouwd.
        </div>
      )}

      {metKoppen && groepen.ditProject.length > 0 && (
        <section data-testid="groep-dit-project" aria-label="Dit project">
          <h3 style={GROEPSKOP}>Dit project</h3>
          {actiefProjectNaam && (
            <div style={css('margin: 0 0 4px; padding: 0 8px; font-size: 12px; font-weight: 700; color: #4B5C58; overflow-wrap: anywhere;')}>{actiefProjectNaam}</div>
          )}
          <ul style={css('margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px;')}>{groepen.ditProject.map((g) => rij(g))}</ul>
        </section>
      )}

      {metKoppen && groepen.eerder.length > 0 && (
        <section data-testid="groep-eerder" aria-label="Eerder">
          <h3 style={GROEPSKOP}>Eerder</h3>
          <ul style={css('margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px;')}>
            {groepen.eerder.map((g) => rij(g, projectNaamVan && g.projectId ? projectNaamVan(g.projectId) : ''))}
          </ul>
        </section>
      )}

      {!metKoppen && groepen.ditProject.length > 0 && (
        <ul data-testid="groep-project" style={css('margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px;')}>{groepen.ditProject.map((g) => rij(g))}</ul>
      )}

      {leeg && (
        <div data-testid="gesprekken-leeg" style={css("padding: 12px 8px; font-family: 'Mulish', sans-serif; font-size: 13px; line-height: 1.55; color: #7B8985;")}>
          {groepen.gefilterd
            ? 'Geen gesprekken gevonden voor deze zoekopdracht.'
            : projectFilter
              ? 'Nog geen opgeslagen gesprekken over dit project.'
              : 'Nog geen bewaarde gesprekken. Zodra u een vraag stelt, bewaart Subsidie Kompas het gesprek hier.'}
        </div>
      )}
    </div>
  );
}
