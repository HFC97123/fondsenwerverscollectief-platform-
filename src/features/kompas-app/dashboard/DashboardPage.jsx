// Dashboard van de Pro/Premium-werkruimte: een werkplek met resultaten en de volgende stap.
//
// Volgorde: wat nu aandacht vraagt (acties), komende deadlines, de projecten met hun dekking, fondsen in de
// dekkingsplannen die nog een beslissing vragen en recente documenten. Geen uitleg over de werking van het systeem;
// alleen echte gegevens uit de bestaande bronnen (useKompas, kompas_dekkingsplan, de opgeslagen taken) en de pure
// afleidingen in dashboardData.js / actiesEnDeadlines.js. Dit scherm heeft geen eigen opslag en geen eigen editors.
import React, { useMemo } from 'react';
import { css } from '../../../shared/lib/css.js';
import { Button } from '../../../shared/ui/index.js';
import { Blok, Chip, Leeg, Melding, PaginaKop, Rij, Rijen, WerkPagina } from '../../../shared/ui/werkplek.jsx';
import { useApp } from '../useKompasApp.js';
import { useKompas } from '../KompasStore.jsx';
import { bouwDashboard, dagenTekst, formatDatum, formatEuro, formatTijd } from './dashboardData.js';
import { useDekkingsplannen } from '../financiering/useProjectFinanciering.js';
import { useActieplan } from '../financiering/useActieplan.js';
import { bouwActiesEnDeadlines } from '../financiering/actiesEnDeadlines.js';
import { StatusChip, Voortgangsbalk } from '../financiering/FinancieringUi.jsx';
import { projectFinancieringHref } from '../financiering/deeplinks.js';

const MAX_PROJECTEN = 6;
const MAX_ACTIES = 6;

const CSS_DASHBOARD = `
.fwk-db-project { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1.5fr) minmax(0, 1.1fr); gap: 10px 18px; align-items: center; box-sizing: border-box; padding: 14px 16px; border: 1px solid #E1EAE4; border-radius: 12px; background: #FFFFFF; position: relative; }
.fwk-db-project:hover { border-color: #A8D5BA; }
.fwk-db-project h3 { margin: 0; font-family: 'Newsreader', serif; font-size: 18px; font-weight: 600; color: #2C4A5E; overflow-wrap: anywhere; }
.fwk-db-project h3 a { color: inherit; text-decoration: none; }
.fwk-db-project h3 a::after { content: ''; position: absolute; inset: 0; border-radius: 12px; }
.fwk-db-klein { font-family: 'Mulish', sans-serif; font-size: 12.5px; line-height: 1.5; color: #7B8985; }
.fwk-db-waarde { font-family: 'Mulish', sans-serif; font-size: 13px; font-weight: 800; color: #2C4A5E; }
.fwk-db-boven { position: relative; z-index: 1; }
@media (max-width: 760px) { .fwk-db-project { grid-template-columns: minmax(0, 1fr); } }
`;

function urgentie(dagen) {
  if (dagen == null) return 'grijs';
  if (dagen < 0) return 'rood';
  if (dagen <= 14) return 'oranje';

  return 'blauw';
}

function ProjectRegel({ project, onBespreek }) {
  const d = project.dekking;
  const meta = [project.locatie, project.periode].filter(Boolean).join(' · ');
  const volgende = project.volgendeDeadline;
  const f = project.fondsen;

  return (
    <li className="fwk-db-project" data-testid="dashboard-project" data-project-id={project.id}>
      <div style={css('min-width: 0;')}>
        <h3>
          <a data-testid="dashboard-project-link" href={`#/kompas/projecten/${project.id}`}>
            {project.naam}
          </a>
        </h3>
        {meta && <div className="fwk-db-klein">{meta}</div>}
        <button type="button" className="fwk-wp-link fwk-db-boven" style={css('margin-top: 6px; font-size: 12.5px; text-align: left;')} data-testid="bespreek-project" onClick={() => onBespreek(project.id)}>
          Bespreek met Subsidie Kompas →
        </button>
      </div>

      <div style={css('min-width: 0;')}>
        {d.heeftBegroting ? (
          <>
            <Voortgangsbalk dekking={d} projectNaam={project.naam} hoogte={8} />
            <div data-testid="dekking-samenvatting" className="fwk-db-waarde" style={css(`margin-top: 6px; color: ${d.volledigGedekt ? '#2F6D47' : '#2C4A5E'};`)}>
              {d.volledigGedekt ? 'Volledig gedekt' : `Nog te financieren: ${formatEuro(d.nogNodig)}`}
            </div>
            <div className="fwk-db-klein">
              van {formatEuro(d.begroting)} · toegekend {formatEuro(d.toegekend)} · aangevraagd {formatEuro(d.aangevraagd)} · eigen bijdrage {formatEuro(d.overige)}
            </div>
          </>
        ) : (
          <a href={`#/kompas/projecten/${project.id}?bewerk=1`} className="fwk-wp-link fwk-db-boven" data-testid="dashboard-begroting-invullen">
            Begroting invullen
          </a>
        )}
      </div>

      <div style={css('min-width: 0; display: flex; flex-direction: column; gap: 4px;')}>
        <a href={projectFinancieringHref(project.id)} className="fwk-db-klein fwk-db-boven" data-testid="dashboard-project-fondsen" style={css('text-decoration: none;')}>
          <strong style={css('color: #2C4A5E;')}>
            {f.totaal} {f.totaal === 1 ? 'fonds' : 'fondsen'} in het plan
          </strong>
          {f.teBeoordelen ? ` · ${f.teBeoordelen} te beoordelen` : ''}
        </a>
        <span data-testid="project-deadline" className="fwk-db-klein">
          {volgende ? (
            <>
              Volgende deadline <strong style={css('color: #2C4A5E;')}>{formatDatum(volgende.datum)}</strong> ({dagenTekst(volgende.dagen)}) · {volgende.naam}
            </>
          ) : (
            'geen komende deadline'
          )}
        </span>
      </div>
    </li>
  );
}

export default function DashboardPage() {
  const app = useApp();
  const store = useKompas();
  const tier = app.subscriptionTier || 'free';
  // Zelfde regel als hasPlanTools in KompasToolPage en de navigatie in KompasApp.
  const paid = app.isAdmin || tier === 'pro' || tier === 'premium';

  const projectIds = useMemo(() => (paid ? (store.projects || []).filter((p) => !p.gearchiveerd).map((p) => p.id) : []), [paid, store.projects]);
  const financiering = useDekkingsplannen(projectIds);
  const actieplan = useActieplan(projectIds);
  const nu = useMemo(() => new Date(), []);

  const data = useMemo(
    () => bouwDashboard({ projects: store.projects, funding: financiering.perProject, conversations: store.conversations, orgProfile: store.orgProfile, nu }),
    [store.projects, financiering.perProject, store.conversations, store.orgProfile, nu],
  );

  // Acties: opgeslagen taken en afgeleide acties per project, dezelfde afleiding als in het project zelf.
  const acties = useMemo(() => {
    if (financiering.status !== 'klaar') return [];

    const uit = [];

    (store.projects || [])
      .filter((p) => p && !p.gearchiveerd)
      .forEach((p) => {
        bouwActiesEnDeadlines({ project: p, regels: financiering.perProject[p.id] || [], taken: actieplan.actieVoor(p.id), nu })
          .filter((i) => i.status !== 'done')
          .forEach((i) => uit.push({ ...i, projectNaam: p.naam || 'Naamloos project' }));
      });

    return uit.sort((a, b) => String(a.datum || '9999-12-31').localeCompare(String(b.datum || '9999-12-31')) || (a.prioriteit === 'high' ? -1 : 0) - (b.prioriteit === 'high' ? -1 : 0));
  }, [financiering.status, financiering.perProject, actieplan, store.projects, nu]);


  if (!paid) {
    return (
      <WerkPagina testid="dashboard">
        <PaginaKop titel="Dashboard" />
        <Melding toon="info">Het dashboard hoort bij Pro en Premium.</Melding>
        <div style={css('margin-top: 14px;')}>
          <Button variant="dark" onClick={app.goAbonnementen}>
            Bekijk de abonnementen
          </Button>
        </div>
      </WerkPagina>
    );
  }

  const bespreekProject = (projectId) => {
    store.zetChatVerzoek({ type: 'project', projectId });
    app.goKompas();
  };

  const getoond = data.projecten.slice(0, MAX_PROJECTEN).map((p) => {
    const regels = financiering.perProject[p.id] || [];

    return { ...p, fondsen: { totaal: regels.length, teBeoordelen: regels.filter((r) => r.status === 'interesting' || r.status === 'preparing').length } };
  });
  const hoog = acties.filter((a) => a.dagen != null && a.dagen <= 14).length;
  const meta = [
    `${data.projecten.length} ${data.projecten.length === 1 ? 'actief project' : 'actieve projecten'}`,
    financiering.status === 'klaar' ? `${acties.length} ${acties.length === 1 ? 'open actie' : 'open acties'}${hoog ? `, ${hoog} binnen 14 dagen` : ''}` : null,
    data.deadlines[0] ? `eerstvolgende deadline ${formatDatum(data.deadlines[0].datum)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <WerkPagina testid="dashboard">
      <style>{CSS_DASHBOARD}</style>
      <PaginaKop
        titel="Dashboard"
        meta={meta}
        acties={
          <Button
            size="s"
            onClick={() => {
              window.location.hash = '#/kompas/projecten?nieuw=1';
            }}
          >
            + Nieuw project
          </Button>
        }
        help={
          <>
            <p>Acties komen uit uw dekkingsplannen en opgeslagen taken: deadlines die naderen, aanvragen die u nog afrondt en bedragen die ontbreken.</p>
            <p>Per project ziet u hoeveel fondsen en regelingen in het dekkingsplan staan en hoeveel daarvan u nog beoordeelt (Interessant of In voorbereiding).</p>
          </>
        }
      />

      {financiering.status === 'fout' && (
        <div style={css('margin-bottom: 14px;')}>
          <Melding toon="waarschuwing" testid="financiering-fout">
            {financiering.fout === 'niet-beschikbaar'
              ? 'Projectfinanciering is nog niet beschikbaar; de bedragen staan tijdelijk op nul.'
              : 'De projectfinanciering kon niet worden geladen; de bedragen zijn nog niet volledig.'}
          </Melding>
        </div>
      )}

      <div className="fwk-wp-kolommen">
        <div className="fwk-wp-stapel">
          <Blok testid="dashboard-acties" titel="Nu aan de slag" aantal={financiering.status === 'klaar' ? acties.length : null}>
            {financiering.status === 'laden' ? (
              <Leeg testid="dashboard-acties-laden">Acties worden geladen…</Leeg>
            ) : acties.length ? (
              <Rijen label="Acties">
                {acties.slice(0, MAX_ACTIES).map((a) => (
                  <Rij
                    key={a.sleutel}
                    testid="dashboard-actie"
                    href="#/kompas/deadlines"
                    titel={a.titel}
                    sub={[a.projectNaam, a.regelNaam].filter(Boolean).join(' · ')}
                    kolommen={[{ label: 'Wanneer', waarde: a.datum ? formatDatum(a.datum) : 'Geen datum', sub: a.dagen != null ? dagenTekst(a.dagen) : null, urgent: a.dagen != null && a.dagen < 0 }]}
                    eind={a.dagen != null && a.dagen <= 14 ? <Chip toon={urgentie(a.dagen)}>{a.dagen < 0 ? 'Te laat' : 'Binnenkort'}</Chip> : null}
                  />
                ))}
              </Rijen>
            ) : (
              <Leeg>Geen openstaande acties.</Leeg>
            )}
            {acties.length > MAX_ACTIES && (
              <div style={css('margin-top: 10px;')}>
                <a href="#/kompas/deadlines" className="fwk-wp-link" data-testid="dashboard-alle-acties">
                  Alle {acties.length} acties
                </a>
              </div>
            )}
          </Blok>

          <Blok
            testid="dashboard-projecten"
            titel="Projecten"
            aantal={data.projecten.length}
            actie={
              <a href="#/kompas/projecten" className="fwk-wp-link">
                {data.projecten.length > MAX_PROJECTEN ? `Alle ${data.projecten.length} projecten` : 'Alle projecten'}
              </a>
            }
          >
            {getoond.length ? (
              <ul className="fwk-wp-rijen">
                {getoond.map((p) => (
                  <ProjectRegel key={p.id} project={p} onBespreek={bespreekProject} />
                ))}
              </ul>
            ) : (
              <Leeg>
                Nog geen actief project.{' '}
                <a href="#/kompas/projecten?nieuw=1" className="fwk-wp-link">
                  Project aanmaken
                </a>
              </Leeg>
            )}
          </Blok>
        </div>

        <div className="fwk-wp-stapel">
          <Blok
            testid="dashboard-deadlines"
            titel="Komende deadlines"
            actie={
              <a href="#/kompas/deadlines" className="fwk-wp-link">
                Alle deadlines
              </a>
            }
          >
            {data.deadlines.length ? (
              <Rijen label="Komende deadlines">
                {data.deadlines.map((x) => (
                  <li key={x.sleutel} data-testid="dashboard-deadline" className="fwk-wp-rij fwk-wp-klik" style={{ '--kol': 0, gridTemplateColumns: 'minmax(0,1fr) auto' }}>
                    <div style={css('min-width: 0;')}>
                      <div className="fwk-wp-rij-titel">
                        <a href={projectFinancieringHref(x.projectId)} data-testid="dashboard-deadline-link">
                          {x.naam}
                        </a>
                      </div>
                      <div className="fwk-wp-rij-sub">
                        <strong style={css(`color: ${x.dagen <= 14 ? '#9E3B2C' : '#2C4A5E'};`)}>{formatDatum(x.datum)}</strong> · {dagenTekst(x.dagen)} · {x.projectNaam}
                      </div>
                    </div>
                    <div className="fwk-wp-rij-eind">
                      <StatusChip status={x.status} />
                    </div>
                  </li>
                ))}
              </Rijen>
            ) : (
              <Leeg>
                Geen komende deadlines.{' '}
                <a href="#/kompas/deadlines" className="fwk-wp-link">
                  Regelingen bekijken
                </a>
              </Leeg>
            )}
          </Blok>

          <Blok
            testid="dashboard-documenten"
            titel="Recente documenten"
            actie={
              <a href="#/kompas/documentatie" className="fwk-wp-link">
                Alle documenten
              </a>
            }
          >
            {data.documenten.length ? (
              <Rijen label="Recente documenten">
                {data.documenten.map((d) => (
                  <li key={d.id || `${d.projectId}:${d.naam}`} data-testid="dashboard-document" className="fwk-wp-rij" style={{ '--kol': 0, gridTemplateColumns: 'minmax(0,1fr)' }}>
                    <div style={css('min-width: 0;')}>
                      <div className="fwk-wp-rij-titel">
                        <a href={`#/kompas/documentatie?project=${encodeURIComponent(d.projectId)}&tab=bestanden`}>{d.naam}</a>
                      </div>
                      <div className="fwk-wp-rij-sub">
                        {d.soort} · {d.projectNaam}
                        {d.gemaakt ? ` · ${formatTijd(d.gemaakt, new Date())}` : ''}
                      </div>
                    </div>
                  </li>
                ))}
              </Rijen>
            ) : (
              <Leeg>Nog geen documenten.</Leeg>
            )}
          </Blok>
        </div>
      </div>
    </WerkPagina>
  );
}
