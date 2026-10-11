// Rechter contextkolom van de chatwerkruimte (Pro/Premium): welke context is relevant voor dit gesprek.
//
// Dit is UITLEG, geen editor: het paneel toont, vat samen en verwijst door (deeplinks). Er wordt niets bewerkt
// en er gaat niets naar het model: de Edge Function leest project en organisatie zelf uit de database; dit
// paneel is alleen weergave. Elke functie houdt zijn ene primaire plek (Projecten, Projectfinanciering,
// Documenten, Organisatieprofiel).
//
// Fail-safe: een fout in één blok toont dat blok als leeg/foutstatus; een renderfout in het hele paneel wordt
// afgevangen door ContextFoutgrens zodat de chat nooit stuk gaat door contextweergave.
import React from 'react';
import { css } from '../../../shared/lib/css.js';
import { StatusChip, Voortgangsbalk } from '../financiering/FinancieringUi.jsx';
import { dagenTekst, formatDatum, formatEuro } from '../financiering/dekkingsplan.js';
import { projectFinancieringHref } from '../financiering/deeplinks.js';
import { MAX_REGELS } from './contextPanelData.js';
import { useProjectContextPanel } from './useProjectContextPanel.js';

const LABEL = "margin: 0 0 8px; font-family: 'Mulish', sans-serif; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #7B8985;";
const TEKST = "font-family: 'Mulish', sans-serif; font-size: 13px; line-height: 1.5; color: #4B5C58;";
const LINK = "display: inline-block; margin-top: 8px; font-family: 'Mulish', sans-serif; font-size: 12.5px; font-weight: 800; color: #4E9A6C; text-decoration: none;";
const BLOK = 'box-sizing: border-box; padding: 14px 16px; border: 1px solid #E1EAE4; border-radius: 16px; background: #FFFFFF; min-width: 0;';

const CSS_PANEEL = `
.fwk-cp a:hover { text-decoration: underline; }
.fwk-cp a:focus-visible { outline: 2px solid #4E9A6C; outline-offset: 2px; border-radius: 4px; }
`;

// Vangt renderfouten in het contextpaneel af: de chat blijft volledig bruikbaar.
export class ContextFoutgrens extends React.Component {
  constructor(props) {
    super(props);
    this.state = { fout: false };
  }

  static getDerivedStateFromError() {
    return { fout: true };
  }

  componentDidCatch() {
    // Bewust stil: contextweergave mag nooit de chat onderbreken, en er worden geen gegevens gelogd.
  }

  render() {
    if (this.state.fout) {
      return (
        <div data-testid="ctx-fout-grens" style={css(`${TEKST} ${BLOK} color: #7B8985;`)}>
          De context kan nu niet worden getoond. U kunt gewoon verder chatten.
        </div>
      );
    }

    return this.props.children;
  }
}

function Blok({ testid, titel, children }) {
  return (
    <section data-testid={testid} aria-label={titel} style={css(BLOK)}>
      <h3 style={css(LABEL)}>{titel}</h3>
      {children}
    </section>
  );
}

function ProjectBlok({ data, project }) {
  if (!project) {
    return (
      <Blok testid="ctx-project" titel="Project">
        <div data-testid="ctx-geen-project" style={css(TEKST)}>
          Geen actief project in dit gesprek. Kies een project in de kop van de chat om de financiering en documenten van dat project hier te zien.
        </div>
        <a href="#/kompas/projecten" style={css(LINK)}>
          Naar Projecten →
        </a>
      </Blok>
    );
  }

  const d = project.dekking;
  const v = project.volgendeDeadline;

  return (
    <Blok testid="ctx-project" titel="Project">
      <div data-testid="ctx-project-naam" style={css("font-family: 'Newsreader', serif; font-size: 18px; font-weight: 600; line-height: 1.25; color: #2C4A5E; overflow-wrap: anywhere;")}>
        {project.naam}
      </div>
      {project.meta && <div style={css(`${TEKST} margin-top: 2px; color: #7B8985;`)}>{project.meta}</div>}

      {d && d.heeftBegroting ? (
        <div data-testid="ctx-dekking" style={css('margin-top: 12px;')}>
          <Voortgangsbalk dekking={d} projectNaam={project.naam} hoogte={8} />
          <div style={css(`${TEKST} margin-top: 6px;`)}>
            Begroting <span style={css('white-space: nowrap;')}>{formatEuro(d.begroting)}</span> · nog te financieren <strong style={css('white-space: nowrap;')}>{formatEuro(d.nogNodig)}</strong>
          </div>
        </div>
      ) : d ? (
        <div data-testid="ctx-dekking" style={css(`${TEKST} margin-top: 10px; color: #7B8985;`)}>Nog geen begroting ingevuld.</div>
      ) : null}

      {v && (
        <div data-testid="ctx-deadline" style={css(`${TEKST} margin-top: 10px;`)}>
          Volgende deadline: <strong>{formatDatum(v.datum)}</strong> ({dagenTekst(v.dagen)}) · {v.naam}
        </div>
      )}

      <a data-testid="ctx-open-project" href={`#/kompas/projecten/${project.id}`} style={css(LINK)}>
        Open project →
      </a>
    </Blok>
  );
}

function bedragVan(regel) {
  const b = regel.status === 'awarded' && regel.awarded != null ? regel.awarded : regel.requested;

  return b == null ? '' : formatEuro(b);
}

function FinancieringBlok({ data, project }) {
  if (!project) {
    return (
      <Blok testid="ctx-financiering" titel="Projectfinanciering">
        <div style={css(`${TEKST} color: #7B8985;`)}>Zodra dit gesprek een project heeft, ziet u hier de financiering van dat project.</div>
      </Blok>
    );
  }

  const f = data.financiering;
  const href = projectFinancieringHref(project.id);
  let inhoud;

  if (f.status === 'laden') {
    inhoud = <div data-testid="ctx-financiering-laden" style={css(`${TEKST} color: #7B8985;`)}>Projectfinanciering wordt geladen…</div>;
  } else if (f.status === 'fout') {
    inhoud = (
      <div data-testid="ctx-financiering-fout" role="status" style={css(`${TEKST} color: #7B8985;`)}>
        Projectfinanciering kan nu niet worden geladen. De chat werkt gewoon door.
      </div>
    );
  } else if (f.status !== 'klaar') {
    inhoud = <div data-testid="ctx-financiering-leeg" style={css(`${TEKST} color: #7B8985;`)}>Financiering is voor dit project nog niet beschikbaar.</div>;
  } else if (f.regels.length === 0) {
    inhoud = <div data-testid="ctx-financiering-leeg" style={css(`${TEKST} color: #7B8985;`)}>Nog geen financieringsregels bij dit project.</div>;
  } else {
    inhoud = (
      <>
        <ul style={css('margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px;')}>
          {f.regels.map((r) => {
            const gemaskeerd = r.bronStatus !== 'zichtbaar';

            return (
              <li key={r.id} data-testid="ctx-regel" data-bron-status={r.bronStatus} style={css('list-style: none; margin: 0; padding: 0; min-width: 0;')}>
                <div
                  style={css(
                    `font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 800; color: #2C4A5E; overflow-wrap: anywhere; ${gemaskeerd ? 'font-style: italic; color: #7B8985; font-weight: 700;' : ''}`,
                  )}
                >
                  {r.naam}
                </div>
                <div style={css('display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 3px;')}>
                  <StatusChip status={r.status} />
                  {bedragVan(r) && <span style={css(`${TEKST} font-weight: 700; white-space: nowrap;`)}>{bedragVan(r)}</span>}
                </div>
              </li>
            );
          })}
        </ul>
        {f.totaal > MAX_REGELS && <div style={css(`${TEKST} margin-top: 8px; color: #7B8985;`)}>+ {f.totaal - MAX_REGELS} andere regels</div>}
      </>
    );
  }

  return (
    <Blok testid="ctx-financiering" titel="Projectfinanciering">
      {inhoud}
      <a data-testid="ctx-naar-financiering" href={href} style={css(LINK)}>
        Naar projectfinanciering →
      </a>
    </Blok>
  );
}

function DocumentenBlok({ data, project }) {
  const docs = data.documenten;

  return (
    <Blok testid="ctx-documenten" titel="Documenten">
      {!project ? (
        <div style={css(`${TEKST} color: #7B8985;`)}>Documenten van het actieve project verschijnen hier.</div>
      ) : docs.totaal === 0 ? (
        <div data-testid="ctx-doc-leeg" style={css(`${TEKST} color: #7B8985;`)}>Nog geen documenten bij dit project.</div>
      ) : (
        <>
          <ul style={css('margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px;')}>
            {docs.laatste.map((d) => (
              <li key={d.id} data-testid="ctx-doc" style={css('list-style: none; margin: 0; padding: 0; min-width: 0;')}>
                <div style={css("font-family: 'Mulish', sans-serif; font-size: 13px; font-weight: 700; color: #2C4A5E; overflow-wrap: anywhere;")}>{d.naam}</div>
                <div style={css(`${TEKST} font-size: 12px; color: #7B8985;`)}>
                  {d.soort}
                  {d.versie > 1 ? ` · versie ${d.versie}` : ''}
                </div>
              </li>
            ))}
          </ul>
          <div data-testid="ctx-doc-totaal" style={css(`${TEKST} margin-top: 8px; color: #7B8985;`)}>
            {docs.totaal} {docs.totaal === 1 ? 'document' : 'documenten'} bij dit project
          </div>
        </>
      )}
      <a data-testid="ctx-naar-documenten" href="#/kompas/documentatie" style={css(LINK)}>
        Documenten →
      </a>
    </Blok>
  );
}

function OrganisatieBlok({ data }) {
  const o = data.organisatie;

  return (
    <Blok testid="ctx-organisatie" titel="Organisatie">
      <div data-testid="ctx-org-naam" style={css("font-family: 'Mulish', sans-serif; font-size: 14px; font-weight: 800; color: #2C4A5E; overflow-wrap: anywhere;")}>
        {o.naam || 'Organisatienaam nog niet ingevuld'}
      </div>
      <div data-testid="ctx-org-volledigheid" style={css(`${TEKST} margin-top: 4px;`)}>
        Profiel {o.pct}% compleet ({o.ingevuld} van {o.totaal} kernvelden)
      </div>
      <div style={css('margin-top: 6px; height: 6px; border-radius: 999px; background: #E9EFEB; overflow: hidden;')} aria-hidden="true">
        <span style={css(`display: block; height: 100%; width: ${o.pct}%; background: #4E9A6C;`)} />
      </div>
      <a data-testid="ctx-naar-organisatie" href="#/kompas/organisatie" style={css(LINK)}>
        Organisatieprofiel →
      </a>
    </Blok>
  );
}

function PaneelInhoud({ projectId }) {
  const data = useProjectContextPanel({ projectId });
  const project = data.project;

  return (
    <div className="fwk-cp" data-testid="project-context-panel" data-project-id={project ? project.id : ''} style={css('display: flex; flex-direction: column; gap: 12px; min-width: 0;')}>
      <style>{CSS_PANEEL}</style>
      <ProjectBlok data={data} project={project} />
      <FinancieringBlok data={data} project={project} />
      <DocumentenBlok data={data} project={project} />
      <OrganisatieBlok data={data} />
    </div>
  );
}

// projectId = het gevalideerde actieve project van het geopende gesprek (de enige invoer; geen projectobject).
export default function ProjectContextPanel({ projectId = null }) {
  return (
    <ContextFoutgrens key={projectId || 'geen-project'}>
      <PaneelInhoud projectId={projectId} />
    </ContextFoutgrens>
  );
}
