// Projectoverzicht rechts van de chat (Pro/Premium): verschijnt ALLEEN als het gesprek een actief project heeft
// (conversation.active_program_id, gevalideerd door de aanroeper) en toont dan een compacte samenvatting van dat ene
// project: gegevens, financiering (toegekend, aangevraagd, nog te financieren), volgende deadline en maximaal drie
// financieringsregels, met doorverwijzingen.
//
// Dit is UITLEG, geen editor: het paneel toont, vat samen en verwijst door (deeplinks). Er wordt niets bewerkt
// en er gaat niets naar het model. Elke functie houdt zijn ene primaire plek (Projecten, Projectfinanciering,
// Deadlines, Documenten, Organisatieprofiel); documenten en organisatie staan hier bewust niet meer.
//
// Fail-safe: een fout in de financieringsbron toont dat blok als leeg/foutstatus; een renderfout in het hele paneel
// wordt afgevangen door ContextFoutgrens zodat de chat nooit stuk gaat door deze weergave.
import React from 'react';
import { css } from '../../../shared/lib/css.js';
import { StatusChip, Voortgangsbalk } from '../financiering/FinancieringUi.jsx';
import { dagenTekst, formatDatumLang, formatEuro } from '../financiering/dekkingsplan.js';
import { projectFinancieringHref } from '../financiering/deeplinks.js';
import BespreekLink from '../financiering/BespreekLink.jsx'; // FASE5
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
          Het projectoverzicht kan nu niet worden getoond. U kunt gewoon verder chatten.
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

function Rij({ label, children, testid }) {
  return (
    <div style={css('display: flex; flex-direction: column; gap: 1px; min-width: 0;')}>
      <dt style={css(`${TEKST} font-size: 11.5px; font-weight: 700; color: #7B8985;`)}>{label}</dt>
      <dd data-testid={testid} style={css(`${TEKST} margin: 0; font-weight: 800; color: #2C4A5E; overflow-wrap: anywhere;`)}>{children}</dd>
    </div>
  );
}

function ProjectBlok({ project }) {
  return (
    <Blok testid="ctx-project" titel="Project">
      <div data-testid="ctx-project-naam" style={css("font-family: 'Newsreader', serif; font-size: 19px; font-weight: 600; line-height: 1.25; color: #2C4A5E; overflow-wrap: anywhere;")}>
        {project.naam}
      </div>
      {(project.locatie || project.looptijd) && (
        <dl style={css('margin: 10px 0 0; display: flex; flex-direction: column; gap: 8px;')}>
          {project.locatie && <Rij label="Locatie" testid="ctx-locatie">{project.locatie}</Rij>}
          {project.looptijd && <Rij label="Looptijd" testid="ctx-looptijd">{project.looptijd}</Rij>}
        </dl>
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
  const f = data.financiering;
  const d = project.dekking;
  const v = project.volgendeDeadline;
  const href = projectFinancieringHref(project.id);
  let regels;

  if (f.status === 'laden') {
    regels = <div data-testid="ctx-financiering-laden" style={css(`${TEKST} color: #7B8985;`)}>Projectfinanciering wordt geladen…</div>;
  } else if (f.status === 'fout') {
    regels = (
      <div data-testid="ctx-financiering-fout" role="status" style={css(`${TEKST} color: #7B8985;`)}>
        Projectfinanciering kan nu niet worden geladen. De chat werkt gewoon door.
      </div>
    );
  } else if (f.status !== 'klaar') {
    regels = <div data-testid="ctx-financiering-leeg" style={css(`${TEKST} color: #7B8985;`)}>Financiering is voor dit project nog niet beschikbaar.</div>;
  } else if (f.regels.length === 0) {
    regels = <div data-testid="ctx-financiering-leeg" style={css(`${TEKST} color: #7B8985;`)}>Nog geen financieringsregels bij dit project.</div>;
  } else {
    regels = (
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
                {/* FASE5: zelfde gesprek, alleen de focus op deze regel (de chat valideert die server-side) */}
                <BespreekLink projectId={project.id} fundingId={r.id} naam={r.naam} stijl="min-height: 28px; font-size: 12.5px;" />
              </li>
            );
          })}
        </ul>
        {f.totaal > MAX_REGELS && <div style={css(`${TEKST} margin-top: 8px; color: #7B8985;`)}>+ {f.totaal - MAX_REGELS} andere regels</div>}
      </>
    );
  }

  return (
    <Blok testid="ctx-financiering" titel="Financiering">
      {d && (
        <div data-testid="ctx-dekking">
          <dl style={css('margin: 0; display: flex; flex-direction: column; gap: 8px;')}>
            <Rij label="Toegekend" testid="ctx-toegekend">{formatEuro(d.toegekend)}</Rij>
            <Rij label="Aangevraagd" testid="ctx-aangevraagd">{formatEuro(d.aangevraagd)}</Rij>
            <Rij label="Nog te financieren" testid="ctx-nog-nodig">
              {!d.heeftBegroting ? 'Begroting nog niet ingevuld' : d.volledigGedekt ? 'Volledig gedekt' : formatEuro(d.nogNodig)}
            </Rij>
          </dl>
          {d.heeftBegroting && (
            <div style={css('margin-top: 10px;')}>
              <Voortgangsbalk dekking={d} projectNaam={project.naam} hoogte={8} />
            </div>
          )}
        </div>
      )}

      {v && (
        <div data-testid="ctx-deadline" style={css('margin-top: 12px;')}>
          <dl style={css('margin: 0;')}>
            <Rij label="Volgende deadline">
              {formatDatumLang(v.datum)} <span style={css('font-weight: 600; color: #7B8985;')}>({dagenTekst(v.dagen)})</span>
              <div style={css(`${TEKST} font-weight: 600;`)}>{v.naam}</div>
            </Rij>
          </dl>
        </div>
      )}

      <div style={css('margin-top: 12px;')}>{regels}</div>

      <a data-testid="ctx-naar-financiering" href={href} style={css(LINK)}>
        Projectfinanciering →
      </a>
    </Blok>
  );
}

function PaneelInhoud({ projectId, versie }) {
  const data = useProjectContextPanel({ projectId, versie }); // FASE5: versie = herlaadteller na een toevoeging in de chat
  const project = data.project;

  // Zonder geldig project bestaat er geen projectoverzicht (de aanroeper toont dan ook geen kolom).
  if (!project) {
    return null;
  }

  return (
    <div className="fwk-cp" data-testid="project-context-panel" data-project-id={project.id} style={css('display: flex; flex-direction: column; gap: 12px; min-width: 0;')}>
      <style>{CSS_PANEEL}</style>
      <h2 data-testid="projectoverzicht-titel" style={css(`${LABEL} margin: 2px 4px 0;`)}>Projectoverzicht</h2>
      <ProjectBlok project={project} />
      <FinancieringBlok data={data} project={project} />
    </div>
  );
}

// projectId = het gevalideerde actieve project van het geopende gesprek (de enige invoer; geen projectobject).
export default function ProjectContextPanel({ projectId = null, versie = 0 }) {
  return (
    <ContextFoutgrens key={projectId || 'geen-project'}>
      <PaneelInhoud projectId={projectId} versie={versie} />
    </ContextFoutgrens>
  );
}
