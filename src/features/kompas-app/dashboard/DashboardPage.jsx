// Dashboard van de Pro/Premium-werkruimte: de cockpit.
//
// Uitsluitend samenvatten en doorlinken. Dit scherm heeft GEEN eigen opslag en
// geen eigen editors: projecten, gesprekken, documenten en het
// organisatieprofiel komen rechtstreeks uit de bestaande bronnen
// (useKompas -> projecten.js / gesprekken.js / organisatieprofiel.js), en alle
// berekeningen zitten in het pure bestand dashboardData.js.
// "Open gesprek" en "Bespreek met Subsidiekompas" geven alleen een eenmalige
// aanwijzing aan de chat (store.zetChatVerzoek); het Dashboard voert zelf geen
// AI-logica uit.
import React, { useMemo } from 'react';
import { css } from '../../../shared/lib/css.js';
import { Button } from '../../../shared/ui/index.js';
import { useApp } from '../useKompasApp.js';
import { useKompas } from '../KompasStore.jsx';
import { bouwDashboard, dagenTekst, formatDatum, formatEuro, formatTijd } from './dashboardData.js';
import { useDekkingsplannen } from '../financiering/useProjectFinanciering.js';
import { KLEUR, StatusChip, Voortgangsbalk } from '../financiering/FinancieringUi.jsx';

const MAX_PROJECTEN = 6;

const kaartStijl = css('box-sizing: border-box; padding: 20px 22px; border: 1px solid #E1EAE4; border-radius: 20px; background: #FFFFFF; min-width: 0;');
const labelStijl = css("font-family: 'Mulish', sans-serif; font-size: 11.5px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #7B8985;");
const linkStijl = css("font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 800; color: #4E9A6C; text-decoration: none; cursor: pointer; background: none; border: none; padding: 0;");
const tekstStijl = css("font-family: 'Mulish', sans-serif; font-size: 14.5px; line-height: 1.55; color: #4B5C58;");

function Sectie({ titel, actie, children, testid }) {
  return (
    <section data-testid={testid} style={kaartStijl}>
      <div style={css('display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 14px;')}>
        <h2 style={{ ...labelStijl, margin: 0 }}>{titel}</h2>
        {actie}
      </div>
      {children}
    </section>
  );
}

function Leeg({ children }) {
  return <div style={{ ...tekstStijl, color: '#7B8985' }}>{children}</div>;
}

function Kpi({ label, waarde, kleur }) {
  return (
    <div style={css('min-width: 0;')}>
      <div style={css("display: flex; align-items: center; gap: 6px; font-family: 'Mulish', sans-serif; font-size: 12px; font-weight: 700; color: #7B8985;")}>
        {kleur && <span aria-hidden="true" style={css(`display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: ${kleur}; flex: none;`)} />}
        <span>{label}</span>
      </div>
      <div style={css("margin-top: 2px; font-family: 'Newsreader', serif; font-size: 20px; font-weight: 600; color: #2C4A5E; white-space: nowrap;")}>{waarde}</div>
    </div>
  );
}

function ProjectKaart({ project, onBespreek }) {
  const d = project.dekking;
  const meta = [project.locatie, project.periode].filter(Boolean).join(' · ');
  const volgende = project.volgendeDeadline;

  return (
    <article data-testid="dashboard-project" data-project-id={project.id} style={{ ...kaartStijl, display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div>
        <h3 style={css("margin: 0; font-family: 'Newsreader', serif; font-size: 22px; font-weight: 600; color: #2C4A5E; overflow-wrap: anywhere;")}>{project.naam}</h3>
        {meta && <div style={{ ...tekstStijl, fontSize: '13.5px', color: '#7B8985' }}>{meta}</div>}
      </div>

      <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 12px 16px;')}>
        <Kpi label="Begroting" waarde={d.heeftBegroting ? formatEuro(d.begroting) : '—'} />
        <Kpi label="Toegekend" waarde={formatEuro(d.toegekend)} kleur={KLEUR.toegekend} />
        <Kpi label="Aangevraagd" waarde={formatEuro(d.aangevraagd)} kleur={KLEUR.aangevraagd} />
        <Kpi label="Overige dekking" waarde={formatEuro(d.overige)} kleur={KLEUR.overige} />
        <Kpi label="Nog te financieren" waarde={d.heeftBegroting ? formatEuro(d.nogNodig) : '—'} kleur="#C5D2CB" />
      </div>

      {d.heeftBegroting ? (
        <div>
          <Voortgangsbalk dekking={d} projectNaam={project.naam} />
          <div data-testid="dekking-samenvatting" style={{ ...tekstStijl, marginTop: '8px', fontSize: '13.5px', fontWeight: 700, color: d.volledigGedekt ? '#2F6D47' : '#2C4A5E' }}>
            {d.volledigGedekt ? 'Volledig gedekt' : `Nog te financieren: ${formatEuro(d.nogNodig)}`}
          </div>
        </div>
      ) : (
        <Leeg>Vul de projectbegroting in om de financieringsvoortgang te zien.</Leeg>
      )}

      <div style={{ ...tekstStijl, fontSize: '13.5px' }}>
        <strong style={css('color: #2C4A5E;')}>Eerstvolgende deadline: </strong>
        {volgende ? (
          <span data-testid="project-deadline">
            {formatDatum(volgende.datum)} ({dagenTekst(volgende.dagen)}) · {volgende.naam}
          </span>
        ) : (
          <span data-testid="project-deadline">geen komende deadline</span>
        )}
      </div>

      <div style={css('display: flex; flex-wrap: wrap; gap: 10px; margin-top: auto;')}>
        <a
          href={`#/kompas/projecten/${project.id}`}
          style={css(
            "display: inline-flex; align-items: center; min-height: 40px; box-sizing: border-box; padding: 8px 18px; border-radius: 999px; background: #4E9A6C; color: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 14px; font-weight: 800; text-decoration: none;",
          )}
        >
          Open project
        </a>
        <button
          type="button"
          onClick={() => onBespreek(project.id)}
          style={css(
            "cursor: pointer; display: inline-flex; align-items: center; min-height: 40px; box-sizing: border-box; padding: 8px 18px; border-radius: 999px; border: 1px solid #CFE0D6; background: #FFFFFF; color: #2C4A5E; font-family: 'Mulish', sans-serif; font-size: 14px; font-weight: 800;",
          )}
        >
          Bespreek met Subsidiekompas
        </button>
      </div>
    </article>
  );
}

function Pagina({ children }) {
  return (
    <div style={css('min-height: 100vh; background: #F7F9F8;')}>
      <div style={css('max-width: 1120px; margin: 0 auto; padding: clamp(20px, 3vw, 36px) clamp(16px, 4vw, 24px) 64px;')}>{children}</div>
    </div>
  );
}

function Kop({ intro, children }) {
  return (
    <div style={css('display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 14px; margin-bottom: 22px;')}>
      <div style={css('min-width: 0; flex: 1 1 320px;')}>
        <h1 style={css("margin: 0 0 6px; font-family: 'Newsreader', serif; font-size: clamp(26px, 3.6vw, 34px); font-weight: 600; color: #2C4A5E;")}>Dashboard</h1>
        <p style={{ ...tekstStijl, margin: 0, maxWidth: '640px', fontSize: '15.5px', lineHeight: 1.7 }}>{intro}</p>
      </div>
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const app = useApp();
  const store = useKompas();
  const tier = app.subscriptionTier || 'free';
  // Zelfde regel als hasPlanTools in KompasToolPage en de navigatie in KompasApp.
  const paid = app.isAdmin || tier === 'pro' || tier === 'premium';

  // Financiering: dezelfde bron (kompas_dekkingsplan) en dezelfde rekenmodule als het projectdossier.
  const projectIds = useMemo(() => (paid ? (store.projects || []).filter((p) => !p.gearchiveerd).map((p) => p.id) : []), [paid, store.projects]);
  const financiering = useDekkingsplannen(projectIds);

  const data = useMemo(
    () =>
      bouwDashboard({
        projects: store.projects,
        funding: financiering.perProject,
        conversations: store.conversations,
        orgProfile: store.orgProfile,
        nu: new Date(),
      }),
    [store.projects, financiering.perProject, store.conversations, store.orgProfile],
  );

  if (!paid) {
    return (
      <Pagina>
        <Kop intro="Met Pro en Premium ziet u hier in één oogopslag uw projecten, de financiering, komende deadlines, recente gesprekken en documenten." />
        <Button variant="dark" onClick={app.goAbonnementen}>
          Bekijk de abonnementen
        </Button>
      </Pagina>
    );
  }

  const bespreekProject = (projectId) => {
    store.zetChatVerzoek({ type: 'project', projectId });
    app.goKompas();
  };

  const openGesprek = (g) => {
    store.zetChatVerzoek({ type: 'gesprek', gesprekId: g.id, projectId: g.projectId });
    app.goKompas();
  };

  const getoond = data.projecten.slice(0, MAX_PROJECTEN);
  const org = data.organisatie;

  return (
    <Pagina>
      <Kop intro="Uw fondsenwerving in één oogopslag: projecten, financiering, deadlines, gesprekken en documenten. Beheren doet u op de pagina zelf; hier ziet u de stand van zaken.">
        <div style={css('display: flex; flex-wrap: wrap; gap: 10px;')}>
          <Button onClick={app.goKompas}>Nieuw gesprek</Button>
          <Button variant="outline" onClick={app.goProjecten}>
            Naar Projecten
          </Button>
        </div>
      </Kop>

      {financiering.status === 'fout' && (
        <div role="status" data-testid="financiering-fout" style={{ ...tekstStijl, marginBottom: '12px', padding: '10px 14px', border: '1px solid #EEDCC0', borderRadius: '12px', background: '#FBF1E3', color: '#8A5A16' }}>
          {financiering.fout === 'niet-beschikbaar'
            ? 'Projectfinanciering is nog niet beschikbaar; de financieringsbedragen staan daarom tijdelijk op nul.'
            : 'De projectfinanciering kon niet worden geladen; de financieringsbedragen zijn daarom nog niet volledig.'}
        </div>
      )}

      <Sectie
        testid="dashboard-projecten"
        titel="Projecten"
        actie={
          <a href="#/kompas/projecten" style={linkStijl}>
            {data.projecten.length > MAX_PROJECTEN ? `Alle ${data.projecten.length} projecten` : 'Naar Projecten'}
          </a>
        }
      >
        {getoond.length ? (
          <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: 16px;')}>
            {getoond.map((p) => (
              <ProjectKaart key={p.id} project={p} onBespreek={bespreekProject} />
            ))}
          </div>
        ) : (
          <Leeg>
            U heeft nog geen actief project. Maak een project aan bij Projecten; daar legt u begroting en dekkingsplan vast.{' '}
            <a href="#/kompas/projecten" style={linkStijl}>
              Naar Projecten
            </a>
          </Leeg>
        )}
      </Sectie>

      <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 330px), 1fr)); gap: 16px; margin-top: 16px;')}>
        <Sectie
          testid="dashboard-deadlines"
          titel="Mijn komende deadlines"
          actie={
            <a href="#/kompas/deadlines" style={linkStijl}>
              Alle deadlines
            </a>
          }
        >
          {data.deadlines.length ? (
            <ul style={css('list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px;')}>
              {data.deadlines.map((x) => (
                <li key={x.sleutel} data-testid="dashboard-deadline" style={css('display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: flex-start;')}>
                  <div style={css("flex: none; min-width: 88px; font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 800; color: #2C4A5E;")}>
                    {formatDatum(x.datum)}
                    <div style={css('font-size: 12px; font-weight: 700; color: #7B8985;')}>{dagenTekst(x.dagen)}</div>
                  </div>
                  <div style={css('min-width: 120px; flex: 1 1 120px;')}>
                    <div style={{ ...tekstStijl, fontWeight: 800, color: '#2C4A5E', overflowWrap: 'break-word' }}>{x.naam}</div>
                    <div style={{ ...tekstStijl, fontSize: '13px', color: '#7B8985' }}>
                      {x.funder ? `${x.funder} · ` : ''}
                      {x.projectNaam}
                    </div>
                  </div>
                  <StatusChip status={x.status} />
                </li>
              ))}
            </ul>
          ) : (
            <Leeg>Geen komende deadlines in uw dekkingsplannen. Neem een regeling op in een project om de deadline hier te volgen.</Leeg>
          )}
        </Sectie>

        <Sectie testid="dashboard-gesprekken" titel="Recente gesprekken">
          {data.gesprekken.length ? (
            <ul style={css('list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px;')}>
              {data.gesprekken.map((g) => (
                <li key={g.id} data-testid="dashboard-gesprek" style={css('display: flex; gap: 12px; align-items: center;')}>
                  <div style={css('min-width: 0; flex: 1;')}>
                    <div style={{ ...tekstStijl, fontWeight: 800, color: '#2C4A5E', overflowWrap: 'anywhere' }}>{g.titel}</div>
                    <div style={{ ...tekstStijl, fontSize: '13px', color: '#7B8985' }}>
                      {g.projectNaam || 'Geen project'}
                      {g.tijd ? ` · ${formatTijd(g.tijd, new Date())}` : ''}
                    </div>
                  </div>
                  <button type="button" onClick={() => openGesprek(g)} style={linkStijl}>
                    Open gesprek
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Leeg>
              Nog geen opgeslagen gesprekken.{' '}
              <a href="#/kompas" style={linkStijl}>
                Start een gesprek
              </a>
            </Leeg>
          )}
        </Sectie>

        <Sectie
          testid="dashboard-documenten"
          titel="Recente documenten"
          actie={
            <a href="#/kompas/documentatie" style={linkStijl}>
              Alle documenten
            </a>
          }
        >
          {data.documenten.length ? (
            <ul style={css('list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px;')}>
              {data.documenten.map((d) => (
                <li key={d.id || `${d.projectId}:${d.naam}`} data-testid="dashboard-document">
                  <div style={{ ...tekstStijl, fontWeight: 800, color: '#2C4A5E', overflowWrap: 'anywhere' }}>{d.naam}</div>
                  <div style={{ ...tekstStijl, fontSize: '13px', color: '#7B8985' }}>
                    {d.soort} · {d.projectNaam}
                    {d.gemaakt ? ` · ${formatTijd(d.gemaakt, new Date())}` : ''}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Leeg>Nog geen documenten bij uw projecten. Documenten die u in de chat opslaat, verschijnen hier.</Leeg>
          )}
        </Sectie>

        <Sectie
          testid="dashboard-organisatie"
          titel="Organisatie"
          actie={
            <a href="#/kompas/organisatie" style={linkStijl}>
              {org.pct < 100 ? 'Profiel aanvullen' : 'Bekijk profiel'}
            </a>
          }
        >
          <div style={{ ...tekstStijl, fontWeight: 800, color: '#2C4A5E', marginBottom: '10px' }}>{org.naam || 'Nog niet ingevuld'}</div>
          <div
            role="img"
            aria-label={`Organisatieprofiel ${org.pct}% compleet`}
            style={css('height: 8px; border-radius: 999px; overflow: hidden; background: #E9EFEB;')}
          >
            <span data-testid="org-voortgang" style={css(`display: block; height: 100%; width: ${org.pct}%; background: #4E9A6C;`)} />
          </div>
          <div data-testid="org-volledigheid" style={{ ...tekstStijl, marginTop: '8px', fontSize: '13.5px' }}>
            {org.pct}% compleet ({org.ingevuld} van {org.totaal} kernvelden)
            {org.ontbreekt.length ? ` · ontbreekt: ${org.ontbreekt.slice(0, 3).join(', ')}${org.ontbreekt.length > 3 ? '…' : ''}` : ''}
          </div>
        </Sectie>
      </div>
    </Pagina>
  );
}
