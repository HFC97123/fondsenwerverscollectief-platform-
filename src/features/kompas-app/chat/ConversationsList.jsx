// Eén gedeeld component voor de gesprekkenlijst van Subsidie Kompas (Pro/Premium).
// Hergebruikt op drie plekken, zonder aparte implementaties:
//   1. de vaste linkerkolom van de chatwerkruimte (desktop >= 1200 px),
//   2. de lade / bottom sheet (tablet en mobiel),
//   3. de projecttab Gesprekken (embedded, met projectFilter).
//
// Het component toont uitsluitend de bestaande gespreksdata (subsidie_kompas_conversations via de store) en
// geeft acties door aan de aanroeper (openen, nieuw, verwijderen). Het heeft geen eigen opslag; de enige
// lokale state is de zoektekst, welke projectgroepen zijn ingeklapt en het open rijmenu. De groepering
// (PROJECTEN op active_program_id, LOSSE GESPREKKEN) staat in gesprekGroepen.js: één definitie voor alle varianten.
//
// Props (varianten):
//   gesprekken            lijst uit de store: { id, titel, tijd, projectId }
//   projecten             de eigen projecten (store); bepaalt de projectgroepen (leeg: alles is een los gesprek)
//   actiefGesprekId       het geopende gesprek (wordt gemarkeerd)
//   actiefProjectId       het actieve project van het geopende gesprek (altijd een groep, met "+ Nieuw")
//   projectFilter         alleen gesprekken van dit project (projecttab); dan geen groepskoppen
//   compact               kleinere rijen
//   embedded              zonder eigen kader/kop (bijvoorbeeld binnen de projecttab)
//   showSearch            zoekveld tonen (standaard true)
//   showNewConversation   knop "Nieuw gesprek" tonen (standaard true)
//   onOpen(g) / onNieuw() / onVerwijder(g)   acties
//   onNieuwInProject(projectId)   "+ Nieuw" in een projectgroep (start een nieuw gesprek met dat project)
//   onHernoem(g, titel) / onVerplaats(g, projectId|null)   rijmenu: naam wijzigen, koppelen aan een project
//                         (active_program_id) of losmaken; zonder deze drie acties geen rijmenu
//   laadId                id van het gesprek dat nu geladen wordt ("Laden…")
//   vergrendeld           tijdens een lopend antwoord: openen, nieuw en verwijderen staan even uit
//   renderExport(g)       optioneel: exportmenu onder het GEOPENDE gesprek (het exportmodel zelf blijft in de aanroeper)
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { groepeerGesprekken, groepeerPerProject } from './gesprekGroepen.js';

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
.fwk-cl-menu { position: absolute; top: 38px; right: 4px; z-index: 6; min-width: 200px; max-width: calc(100% - 8px); box-sizing: border-box; padding: 6px; border: 1px solid #E1EAE4; border-radius: 14px; background: #FFFFFF; box-shadow: 0 10px 30px rgba(44,74,94,0.14); }
.fwk-cl-menu button { display: block; width: 100%; box-sizing: border-box; min-height: 40px; padding: 8px 12px; text-align: left; cursor: pointer; border: none; border-radius: 10px; background: none; font-family: 'Mulish', sans-serif; font-size: 13px; font-weight: 700; color: #2C4A5E; overflow-wrap: anywhere; }
.fwk-cl-menu button:hover { background: #F2F6F4; }
.fwk-cl-menu button[data-gevaar="true"] { color: #9E3B2C; }
.fwk-cl-menu button[aria-checked="true"] { background: #EAF4EE; }
.fwk-cl-kop { display: flex; align-items: center; gap: 4px; }
.fwk-cl-toggle { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: 6px; min-height: 36px; padding: 4px 8px; cursor: pointer; border: none; background: none; border-radius: 10px; text-align: left; font-family: 'Mulish', sans-serif; font-size: 13px; font-weight: 800; color: #2C4A5E; }
.fwk-cl-toggle:hover { background: #F2F6F4; }
.fwk-cl-plus { flex: none; min-height: 32px; padding: 4px 10px; cursor: pointer; border: 1px solid #D6E3E9; border-radius: 999px; background: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 12px; font-weight: 800; color: #2F6D47; }
.fwk-cl-plus:hover { background: #EAF4EE; }
.fwk-cl-plus:disabled { opacity: 0.55; cursor: default; }
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

function Rij({ g, actief, compact, laadId, vergrendeld, onOpen, onVerwijder, onHernoem, onVerplaats, projecten, renderExport, subregel }) {
  const [menu, setMenu] = useState(null); // null | 'menu' | 'project'
  const [bewerk, setBewerk] = useState(false);
  const [naam, setNaam] = useState('');
  const ref = useRef(null);
  const heeftMenu = Boolean(onVerwijder || onHernoem || onVerplaats);
  const kiesbaar = (projecten || []).filter((p) => p && p.id && !p.gearchiveerd).sort((a, b) => String(a.naam || '').localeCompare(String(b.naam || ''), 'nl'));

  // Menu sluit met Escape en bij een klik buiten de rij.
  useEffect(() => {
    if (!menu) {
      return undefined;
    }

    const sluit = (e) => {
      if (e.type === 'keydown' ? e.key === 'Escape' : ref.current && !ref.current.contains(e.target)) {
        setMenu(null);
      }
    };

    document.addEventListener('keydown', sluit);
    document.addEventListener('mousedown', sluit);

    return () => {
      document.removeEventListener('keydown', sluit);
      document.removeEventListener('mousedown', sluit);
    };
  }, [menu]);

  const bewaarNaam = () => {
    const nieuw = naam.trim().slice(0, 120);

    setBewerk(false);

    if (nieuw && nieuw !== (g.titel || '') && onHernoem) {
      onHernoem(g, nieuw);
    }
  };

  return (
    <li data-testid="gesprek-rij" data-gesprek-id={g.id} style={css('list-style: none; margin: 0; padding: 0;')}>
      <div className="fwk-cl-rij" data-actief={actief ? 'true' : 'false'} ref={ref}>
        {bewerk ? (
          <div style={css('padding: 6px 8px;')}>
            <input
              data-testid="gesprek-hernoem-invoer"
              autoFocus
              value={naam}
              maxLength={120}
              aria-label="Nieuwe naam van het gesprek"
              onChange={(e) => setNaam(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  bewaarNaam();
                } else if (e.key === 'Escape') {
                  setBewerk(false);
                }
              }}
              onBlur={() => setBewerk(false)}
              style={css("box-sizing: border-box; width: 100%; min-height: 38px; padding: 6px 10px; border: 1px solid #BFD4C6; border-radius: 10px; font-family: 'Mulish', sans-serif; font-size: 13px; color: #2C4A5E;")}
            />
          </div>
        ) : (
          <button
            type="button"
            className="fwk-cl-open"
            data-testid="gesprek-open"
            aria-current={actief ? 'true' : undefined}
            disabled={vergrendeld}
            onClick={() => onOpen && onOpen(g)}
            style={css(`padding: ${compact ? '7px 8px' : '9px 10px'}; ${heeftMenu ? 'padding-right: 38px;' : ''} min-height: 44px; ${vergrendeld && !actief ? 'opacity: 0.55; cursor: default;' : ''}`)}
          >
            <span className="fwk-cl-titel" style={css(`display: -webkit-box; font-size: ${compact ? '13px' : '13.5px'}; font-weight: ${actief ? 800 : 700}; line-height: 1.35;`)}>
              {g.titel || 'Gesprek'}
            </span>
            <span style={css('display: block; margin-top: 2px; font-size: 11.5px; font-weight: 600; color: #7B8985; overflow-wrap: anywhere;')}>
              {laadId === g.id ? 'Laden…' : [kortDatum(g.tijd), subregel].filter(Boolean).join(' · ')}
            </span>
          </button>
        )}
        {heeftMenu && !bewerk && (
          <button
            type="button"
            className="fwk-cl-x"
            data-testid="gesprek-menu"
            aria-label={`Acties voor gesprek ${g.titel || 'Gesprek'}`}
            aria-haspopup="menu"
            aria-expanded={menu ? 'true' : 'false'}
            title="Acties"
            disabled={vergrendeld}
            style={css('color: #4B5C58; font-size: 20px; letter-spacing: 1px;')}
            onClick={() => setMenu(menu ? null : 'menu')}
          >
            ⋯
          </button>
        )}
        {menu === 'menu' && (
          <div className="fwk-cl-menu" role="menu" data-testid="gesprek-menu-lijst" aria-label="Acties voor dit gesprek">
            {onHernoem && (
              <button
                type="button"
                role="menuitem"
                data-testid="gesprek-hernoem"
                onClick={() => {
                  setNaam(g.titel || '');
                  setBewerk(true);
                  setMenu(null);
                }}
              >
                Naam wijzigen
              </button>
            )}
            {onVerplaats && (
              <button type="button" role="menuitem" data-testid="gesprek-koppel" aria-haspopup="menu" onClick={() => setMenu('project')}>
                Koppelen aan project…
              </button>
            )}
            {onVerwijder && (
              <button
                type="button"
                role="menuitem"
                data-testid="gesprek-verwijder"
                data-gevaar="true"
                aria-label={`Gesprek ${g.titel || 'Gesprek'} verwijderen`}
                onClick={() => {
                  setMenu(null);
                  onVerwijder(g);
                }}
              >
                Verwijderen
              </button>
            )}
          </div>
        )}
        {menu === 'project' && (
          <div className="fwk-cl-menu" role="menu" data-testid="gesprek-koppel-lijst" aria-label="Koppel dit gesprek aan een project">
            <button type="button" role="menuitemradio" aria-checked={!g.projectId ? 'true' : 'false'} data-testid="koppel-geen" onClick={() => { setMenu(null); onVerplaats(g, null); }}>
              Geen project (los gesprek)
            </button>
            {kiesbaar.map((p) => (
              <button
                key={p.id}
                type="button"
                role="menuitemradio"
                aria-checked={g.projectId === p.id ? 'true' : 'false'}
                data-testid="koppel-project"
                data-project-id={p.id}
                onClick={() => {
                  setMenu(null);
                  onVerplaats(g, p.id);
                }}
              >
                {p.naam || 'Naamloos project'}
              </button>
            ))}
          </div>
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
  projecten = [],
  actiefGesprekId = null,
  actiefProjectId = null,
  projectFilter = null,
  compact = false,
  embedded = false,
  showSearch = true,
  showNewConversation = true,
  onOpen,
  onNieuw,
  onNieuwInProject,
  onVerwijder,
  onHernoem,
  onVerplaats,
  laadId = null,
  vergrendeld = false,
  renderExport,
}) {
  const [zoek, setZoek] = useState('');
  const [ingeklapt, setIngeklapt] = useState({});
  const metKoppen = !projectFilter;
  const plat = useMemo(() => (projectFilter ? groepeerGesprekken({ gesprekken, zoek, projectFilter }) : null), [gesprekken, zoek, projectFilter]);
  const perProject = useMemo(
    () => (projectFilter ? null : groepeerPerProject({ gesprekken, projecten, actiefProjectId, zoek })),
    [gesprekken, projecten, actiefProjectId, zoek, projectFilter],
  );
  const aantalZichtbaar = projectFilter ? plat.ditProject.length : perProject.los.length + perProject.groepen.reduce((n, gr) => n + gr.gesprekken.length, 0);
  const leeg = aantalZichtbaar === 0;
  const zoekt = Boolean(zoek.trim());

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
      onHernoem={onHernoem}
      onVerplaats={onVerplaats}
      projecten={projecten}
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

      {metKoppen && perProject.groepen.length > 0 && (
        <section data-testid="groep-projecten" aria-label="Projecten">
          <h3 style={GROEPSKOP}>Projecten</h3>
          <div style={css('display: flex; flex-direction: column; gap: 6px;')}>
            {perProject.groepen.map((gr) => {
              const open = zoekt || !ingeklapt[gr.project.id];
              const lijstId = `fwk-cl-groep-${gr.project.id}`;

              return (
                <div key={gr.project.id} data-testid="project-groep" data-project-id={gr.project.id} data-open={open ? 'true' : 'false'}>
                  <div className="fwk-cl-kop">
                    <button
                      type="button"
                      className="fwk-cl-toggle"
                      data-testid="groep-toggle"
                      aria-expanded={open ? 'true' : 'false'}
                      aria-controls={lijstId}
                      onClick={() => setIngeklapt((cur) => ({ ...cur, [gr.project.id]: open }))}
                    >
                      <span aria-hidden="true" style={css('flex: none; width: 12px; font-size: 11px; color: #7B8985;')}>{open ? '▾' : '▸'}</span>
                      <span style={css('min-width: 0; overflow-wrap: anywhere;')}>
                        {gr.project.naam}
                        {gr.project.gearchiveerd ? ' (gearchiveerd)' : ''}
                      </span>
                      <span data-testid="groep-aantal" style={css('flex: none; margin-left: auto; font-size: 11.5px; font-weight: 700; color: #7B8985;')}>{gr.gesprekken.length}</span>
                    </button>
                    {onNieuwInProject && !gr.project.gearchiveerd && (
                      <button
                        type="button"
                        className="fwk-cl-plus"
                        data-testid="groep-nieuw"
                        aria-label={`Nieuw gesprek in ${gr.project.naam}`}
                        title={`Nieuw gesprek in ${gr.project.naam}`}
                        disabled={vergrendeld}
                        onClick={() => onNieuwInProject(gr.project.id)}
                      >
                        + Nieuw
                      </button>
                    )}
                  </div>
                  {open &&
                    (gr.gesprekken.length ? (
                      <ul id={lijstId} style={css('margin: 2px 0 0; padding: 0 0 0 8px; display: flex; flex-direction: column; gap: 2px;')}>{gr.gesprekken.map((g) => rij(g))}</ul>
                    ) : (
                      <div id={lijstId} data-testid="groep-leeg" style={css("padding: 2px 8px 4px 22px; font-family: 'Mulish', sans-serif; font-size: 12px; color: #7B8985;")}>
                        Nog geen gesprekken in dit project.
                      </div>
                    ))}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {metKoppen && perProject.los.length > 0 && (
        <section data-testid="groep-los" aria-label="Losse gesprekken">
          <h3 style={GROEPSKOP}>Losse gesprekken</h3>
          <ul style={css('margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px;')}>{perProject.los.map((g) => rij(g))}</ul>
        </section>
      )}

      {!metKoppen && plat.ditProject.length > 0 && (
        <ul data-testid="groep-project" style={css('margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px;')}>{plat.ditProject.map((g) => rij(g))}</ul>
      )}

      {leeg && (
        <div data-testid="gesprekken-leeg" style={css("padding: 12px 8px; font-family: 'Mulish', sans-serif; font-size: 13px; line-height: 1.55; color: #7B8985;")}>
          {zoekt
            ? 'Geen gesprekken gevonden voor deze zoekopdracht.'
            : projectFilter
              ? 'Nog geen opgeslagen gesprekken over dit project.'
              : 'Nog geen bewaarde gesprekken. Zodra u een vraag stelt, bewaart Subsidie Kompas het gesprek hier.'}
        </div>
      )}
    </div>
  );
}
