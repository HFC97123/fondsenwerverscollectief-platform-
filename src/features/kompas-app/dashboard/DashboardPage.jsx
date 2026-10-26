// Dashboard van de Pro/Premium-werkruimte: een werkplek met resultaten en de volgende stap.
//
// Volgorde: begroeting met de stand van zaken (vier tegels), wat nu aandacht vraagt (acties), de projecten met hun
// dekking en dossier, komende deadlines en recente documenten. Geen uitleg over de werking van het systeem;
// alleen echte gegevens uit de bestaande bronnen (useKompas, kompas_dekkingsplan, de opgeslagen taken) en de pure
// afleidingen in dashboardData.js / actiesEnDeadlines.js. Dit scherm heeft geen eigen opslag en geen eigen editors.
import React, { useMemo } from 'react';
import { css } from '../../../shared/lib/css.js';
import { Button } from '../../../shared/ui/index.js';
import { Blok, Chip, Leeg, Melding, PaginaKop, Rijen, WerkPagina } from '../../../shared/ui/werkplek.jsx';
import { useApp } from '../useKompasApp.js';
import { useKompas } from '../KompasStore.jsx';
import { bouwDashboard, dagEnMaand, dagenTekst, datumVolledig, eersteNaam, formatDatum, formatEuro, formatTijd, groet } from './dashboardData.js';
import { useDekkingsplannen } from '../financiering/useProjectFinanciering.js';
import { useActieplan } from '../financiering/useActieplan.js';
import { bouwActiesEnDeadlines } from '../financiering/actiesEnDeadlines.js';
import { StatusChip, Voortgangsbalk } from '../financiering/FinancieringUi.jsx';
import { projectFinancieringHref } from '../financiering/deeplinks.js';
import { voortgang } from '../projectinformatie/projectinformatie.js';

const MAX_PROJECTEN = 6;
const MAX_ACTIES = 4;

const CSS_DASHBOARD = `
.fwk-db-tegels { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-bottom: 26px; }
@media (max-width: 980px) { .fwk-db-tegels { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 520px) { .fwk-db-tegels { grid-template-columns: minmax(0, 1fr); } }
.fwk-db-tegel { box-sizing: border-box; min-width: 0; padding: 18px 20px; border: 1px solid #E1EAE4; border-radius: 20px; background: #FFFFFF; }
.fwk-db-tegel[data-let="1"] { background: linear-gradient(180deg, #FFFFFF 0%, #FBF1E3 100%); border-color: #EEDCC0; }
.fwk-db-tegel[data-let="1"] .fwk-db-tg { color: #8A5A16; }
.fwk-db-tl { font-family: 'Mulish', sans-serif; font-size: 10.5px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase; color: #9AA6A2; }
.fwk-db-tg { margin-top: 2px; font-family: 'Newsreader', serif; font-size: 30px; font-weight: 600; line-height: 1.15; color: #2C4A5E; overflow-wrap: anywhere; }
.fwk-db-ts { margin-top: 2px; font-family: 'Mulish', sans-serif; font-size: 13px; line-height: 1.45; color: #7B8985; }
.fwk-db-actielijst, .fwk-db-projecten { list-style: none; margin: 0; padding: 0; }
.fwk-db-actie { display: flex; align-items: center; gap: 14px; box-sizing: border-box; margin-bottom: 10px; padding: 14px 18px; border: 1px solid #E1EAE4; border-left: 5px solid #A8CBE3; border-radius: 16px; background: #FFFFFF; }
.fwk-db-actie[data-urgentie="rood"] { border-left-color: #D9776A; }
.fwk-db-actie[data-urgentie="oranje"] { border-left-color: #E2B56A; }
.fwk-db-actie[data-urgentie="grijs"] { border-left-color: #D5DDD9; }
.fwk-db-actie:hover { border-color: #A8D5BA; }
.fwk-db-actie a { color: #2C4A5E; font-family: 'Mulish', sans-serif; font-size: 15px; font-weight: 800; text-decoration: none; }
.fwk-db-actie a:hover { text-decoration: underline; }
.fwk-db-projecten { display: grid; grid-template-columns: repeat(var(--kol, 3), minmax(0, 1fr)); gap: 16px; }
.fwk-db-vul { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; box-sizing: border-box; min-width: 0; min-height: 180px; padding: 22px 24px; border: 1.5px dashed #CFE0D6; border-radius: 22px; background: #F6F8F7; text-align: center; font-family: 'Mulish', sans-serif; font-size: 13.5px; color: #7B8985; }
.fwk-db-vul:hover { border-color: #A8D5BA; background: #F1F7F3; }
.fwk-db-vul a { color: #2C4A5E; font-size: 15px; font-weight: 800; text-decoration: none; }
.fwk-db-vul a::after { content: ''; position: absolute; inset: 0; border-radius: 22px; }
.fwk-db-vul[data-desktop="0"] { display: none; }
@media (max-width: 980px) {
  .fwk-db-projecten { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .fwk-db-vul[data-desktop] { display: none; }
  .fwk-db-vul[data-tablet="1"] { display: flex; }
}
@media (max-width: 640px) {
  .fwk-db-projecten { grid-template-columns: minmax(0, 1fr); }
  .fwk-db-vul[data-desktop], .fwk-db-vul[data-tablet="1"] { display: none; }
}
/* Kaarten naast elkaar even hoog en de onderdelen (naam, dekking, dossier, fondsen, deadline, knoppen) op dezelfde hoogte. */
@supports (grid-template-rows: subgrid) {
  .fwk-db-projecten { row-gap: 0; }
  .fwk-db-project { display: grid !important; grid-row: span 7; grid-template-rows: subgrid; row-gap: 12px; margin-bottom: 16px; }
  .fwk-db-vul { grid-row: span 7; margin-bottom: 16px; }
}
.fwk-db-project { position: relative; display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; min-width: 0; padding: 22px 24px; border: 1px solid #E1EAE4; border-radius: 22px; background: #FFFFFF; }
.fwk-db-project:hover { border-color: #A8D5BA; }
.fwk-db-project h3 { margin: 0; font-family: 'Newsreader', serif; font-size: 22px; font-weight: 600; color: #2C4A5E; overflow-wrap: anywhere; }
.fwk-db-project h3 a { color: inherit; text-decoration: none; }
.fwk-db-project h3 a::after { content: ''; position: absolute; inset: 0; border-radius: 22px; }
.fwk-db-klein { font-family: 'Mulish', sans-serif; font-size: 12.5px; line-height: 1.6; color: #7B8985; }
.fwk-db-kv { display: flex; justify-content: space-between; gap: 12px; font-family: 'Mulish', sans-serif; font-size: 13.5px; color: #4B5C58; }
.fwk-db-kv b { color: #2C4A5E; text-align: right; }
.fwk-db-dossier { height: 8px; margin-top: 7px; border-radius: 999px; background: #E9EFEB; overflow: hidden; }
.fwk-db-dossier span { display: block; height: 100%; border-radius: 999px; background: #4E9A6C; }
.fwk-db-uitnodiging { display: flex; flex-direction: column; gap: 4px; padding: 14px 16px; border: 1px dashed #CFE0D6; border-radius: 14px; background: #F6F8F7; font-family: 'Mulish', sans-serif; font-size: 13.5px; color: #4B5C58; }
.fwk-db-uitnodiging b { color: #2C4A5E; }
.fwk-db-voet { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: auto; padding-top: 12px; border-top: 1px solid #EEF2EF; }
.fwk-db-voet { flex-wrap: wrap; row-gap: 8px; }
.fwk-db-voet > * { white-space: nowrap; }
.fwk-db-voet > :last-child { margin-left: auto; }
.fwk-db-boven { position: relative; z-index: 1; }
.fwk-db-dl { display: flex; align-items: center; gap: 14px; padding: 10px 0; border-bottom: 1px solid #EEF2EF; }
.fwk-db-dl:last-child { border-bottom: none; padding-bottom: 0; }
.fwk-db-dl:first-child { padding-top: 0; }
.fwk-db-dat { flex: none; width: 52px; box-sizing: border-box; padding: 5px 0; text-align: center; border: 1px solid #E1EAE4; border-radius: 14px; background: #F6F8F7; }
.fwk-db-dat b { display: block; font-family: 'Newsreader', serif; font-size: 22px; font-weight: 600; line-height: 1.1; color: #2C4A5E; }
.fwk-db-dat span { font-family: 'Mulish', sans-serif; font-size: 10.5px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase; color: #9AA6A2; }
.fwk-db-dat[data-binnenkort="1"] { background: #FBF1E3; border-color: #EEDCC0; }
.fwk-db-dat[data-binnenkort="1"] b { color: #8A5A16; }
.fwk-db-dl a { color: #2C4A5E; font-family: 'Mulish', sans-serif; font-size: 14.5px; font-weight: 800; text-decoration: none; }
.fwk-db-dl a:hover { text-decoration: underline; }
`;

const hoofdletter = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

function urgentie(dagen) {
  if (dagen == null) return 'grijs';
  if (dagen < 0) return 'rood';
  if (dagen <= 14) return 'oranje';

  return 'blauw';
}

function Tegel({ label, waarde, sub, dringend = false, testid }) {
  return (
    <div className="fwk-db-tegel" data-testid={testid} data-let={dringend ? '1' : '0'}>
      <div className="fwk-db-tl">{label}</div>
      <div className="fwk-db-tg">{waarde}</div>
      {sub && <div className="fwk-db-ts">{sub}</div>}
    </div>
  );
}

// Projecten naast elkaar, altijd als nette rechthoek: 3 naast elkaar, behalve bij 1, 2 of 4 projecten (dan 2 per rij).
// Blijft er op de laatste rij een plek leeg, dan vult een kaart 'Nieuw project' die plek op.
export function projectKolommen(aantal) {
  return aantal <= 2 || aantal === 4 ? 2 : 3;
}

function NieuwProjectKaart({ aantal }) {
  const kol = projectKolommen(aantal);
  const leegDesktop = (kol - (aantal % kol)) % kol;

  if (!leegDesktop && aantal % 2 === 0) return null;

  return (
    <li className="fwk-db-vul" data-testid="dashboard-nieuw-project-kaart" data-desktop={leegDesktop ? '1' : '0'} data-tablet={aantal % 2 ? '1' : '0'}>
      <a href="#/kompas/projecten?nieuw=1">+ Nieuw project</a>
      <span>Start een volgend project; Subsidie Kompas helpt met begroting en fondsen.</span>
    </li>
  );
}

function ProjectKaart({ project, onBespreek }) {
  const d = project.dekking;
  const meta = [project.locatie, project.periode].filter(Boolean).join(' · ');
  const volgende = project.volgendeDeadline;
  const f = project.fondsen;
  const dossier = project.dossier;
  const pct = dossier.totaal > 0 ? Math.round((dossier.ingevuld / dossier.totaal) * 100) : 0;

  return (
    <li className="fwk-db-project" data-testid="dashboard-project" data-project-id={project.id}>
      <h3>
        <a data-testid="dashboard-project-link" href={`#/kompas/projecten/${project.id}`}>
          {project.naam}
        </a>
      </h3>
      <div className="fwk-db-klein" style={css('margin-top: -8px;')}>{meta}</div>

      {d.heeftBegroting ? (
        <div>
          <div className="fwk-db-kv">
            <span>Dekking</span>
            <b data-testid="dekking-samenvatting" style={css(`color: ${d.volledigGedekt ? '#2F6D47' : '#2C4A5E'};`)}>
              {d.volledigGedekt ? 'Volledig gedekt' : `Nog te financieren: ${formatEuro(d.nogNodig)}`}
            </b>
          </div>
          <div style={css('margin: 7px 0 6px;')}>
            <Voortgangsbalk dekking={d} projectNaam={project.naam} hoogte={10} />
          </div>
          <div className="fwk-db-klein">
            van {formatEuro(d.begroting)} · toegekend {formatEuro(d.toegekend)} · aangevraagd {formatEuro(d.aangevraagd)} · eigen bijdrage {formatEuro(d.overige)}
          </div>
        </div>
      ) : (
        <div className="fwk-db-uitnodiging">
          <b>Nog geen begroting</b>
          <span>Vul de begroting in om te zien hoeveel nog gedekt moet worden.</span>
          <a href={`#/kompas/projecten/${project.id}?bewerk=1`} className="fwk-wp-link fwk-db-boven" data-testid="dashboard-begroting-invullen">
            Begroting invullen
          </a>
        </div>
      )}

      <div data-testid="dashboard-project-dossier">
        <div className="fwk-db-kv">
          <span>Projectdossier</span>
          <b>
            {dossier.ingevuld} van {dossier.totaal} · {pct}%
          </b>
        </div>
        <div className="fwk-db-dossier" role="progressbar" aria-label={`Projectdossier van ${project.naam}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <span style={css(`width: ${pct}%;`)} />
        </div>
      </div>

      <div className="fwk-db-kv">
        <span>Fondsen in het plan</span>
        <a href={projectFinancieringHref(project.id)} className="fwk-db-boven" data-testid="dashboard-project-fondsen" style={css('text-decoration: none; color: #2C4A5E; font-weight: 800;')}>
          {f.totaal === 0 ? 'nog geen' : `${f.totaal}${f.teBeoordelen ? ` · ${f.teBeoordelen} te beoordelen` : ''}`}
        </a>
      </div>
      <span data-testid="project-deadline" className="fwk-db-klein" style={css('margin-top: -6px;')}>
        {volgende ? (
          <>
            Volgende deadline <strong style={css('color: #2C4A5E;')}>{formatDatum(volgende.datum)}</strong> ({dagenTekst(volgende.dagen)}) · {volgende.naam}
          </>
        ) : (
          'geen komende deadline'
        )}
      </span>

      <div className="fwk-db-voet">
        {f.totaal === 0 ? (
          <a className="fwk-wp-link fwk-db-boven" href={`#/kompas/advies/fondsen?project=${encodeURIComponent(project.id)}`}>
            Start de fondsmatching
          </a>
        ) : volgende && volgende.dagen != null && volgende.dagen <= 14 ? (
          <Chip toon="oranje">Deadline {dagenTekst(volgende.dagen)}</Chip>
        ) : (
          <span />
        )}
        <button type="button" className="fwk-wp-link fwk-db-boven" style={css('font-size: 13.5px; text-align: right;')} data-testid="bespreek-project" onClick={() => onBespreek(project.id)}>
          Bespreek met Subsidie Kompas →
        </button>
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

  const klaar = financiering.status === 'klaar';
  const getoond = data.projecten.slice(0, MAX_PROJECTEN).map((p) => {
    const regels = financiering.perProject[p.id] || [];
    const bron = (store.projects || []).find((x) => x.id === p.id) || {};

    return {
      ...p,
      dossier: voortgang(bron),
      fondsen: { totaal: regels.length, teBeoordelen: regels.filter((r) => r.status === 'interesting' || r.status === 'preparing').length },
    };
  });
  const hoog = acties.filter((a) => a.dagen != null && a.dagen <= 14).length;

  // Totaal over alle actieve projecten met een begroting (optellen van de uitkomsten van dekkingVanProject, geen eigen rekenregel).
  const metBegroting = data.projecten.filter((p) => p.dekking.heeftBegroting);
  const totaalBegroting = metBegroting.reduce((t, p) => t + p.dekking.begroting, 0);
  const totaalNogNodig = metBegroting.reduce((t, p) => t + p.dekking.nogNodig, 0);
  const gedektPct = totaalBegroting > 0 ? Math.round(((totaalBegroting - totaalNogNodig) / totaalBegroting) * 100) : 0;
  const volledigeDossiers = getoond.filter((p) => p.dossier.totaal > 0 && p.dossier.ingevuld >= p.dossier.totaal).length;
  const eerste = data.deadlines[0] || null;
  const eersteDatum = eerste ? dagEnMaand(eerste.datum) : null;

  const voornaam = eersteNaam(app.naam);
  const projectWoord = data.projecten.length === 1 ? 'uw project' : 'uw projecten';

  return (
    <WerkPagina testid="dashboard">
      <style>{CSS_DASHBOARD}</style>
      <PaginaKop
        titel={voornaam ? `${groet(nu)}, ${voornaam}` : groet(nu)}
        titelTestid="dashboard-groet"
        meta={`Zo staat het met ${projectWoord} op ${datumVolledig(nu)}.`}
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

      <div className="fwk-db-tegels" data-testid="dashboard-tegels">
        <Tegel
          testid="tegel-projecten"
          label="Actieve projecten"
          waarde={data.projecten.length}
          sub={data.projecten.length ? `${volledigeDossiers} met een volledig dossier` : 'Maak uw eerste project aan'}
        />
        <Tegel
          testid="tegel-financieren"
          label="Nog te financieren"
          waarde={metBegroting.length ? formatEuro(totaalNogNodig) : '—'}
          sub={metBegroting.length ? `van ${formatEuro(totaalBegroting)} begroot · ${gedektPct}% gedekt` : 'Vul een begroting in'}
        />
        <Tegel
          testid="tegel-acties"
          label="Open acties"
          waarde={klaar ? acties.length : '…'}
          sub={klaar ? (hoog ? `${hoog} binnen 14 dagen` : 'Niets dat dringt') : null}
          dringend={hoog > 0}
        />
        <Tegel
          testid="tegel-deadline"
          label="Eerstvolgende deadline"
          waarde={eersteDatum ? `${eersteDatum.dag} ${eersteDatum.maand}` : '—'}
          sub={eerste ? `${eerste.naam} · ${dagenTekst(eerste.dagen)}` : 'Geen komende deadline'}
        />
      </div>

      {/* Uw projecten direct onder de tegels, over de volle breedte: kaarten naast elkaar, altijd als nette rechthoek. */}
      <div style={css('margin-bottom: 26px;')}>
        <Blok
          testid="dashboard-projecten"
          titel="Uw projecten"
          aantal={data.projecten.length}
          kaal
          actie={
            <a href="#/kompas/projecten" className="fwk-wp-link">
              {data.projecten.length > MAX_PROJECTEN ? `Alle ${data.projecten.length} projecten` : 'Alle projecten'}
            </a>
          }
        >
          {getoond.length ? (
            <ul className="fwk-db-projecten" style={{ '--kol': projectKolommen(getoond.length) }}>
              {getoond.map((p) => (
                <ProjectKaart key={p.id} project={p} onBespreek={bespreekProject} />
              ))}
              <NieuwProjectKaart aantal={getoond.length} />
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

      <div className="fwk-wp-kolommen">
        <div className="fwk-wp-stapel">
          <Blok testid="dashboard-acties" titel="Nu aan de slag" aantal={klaar ? acties.length : null} kaal>
            {financiering.status === 'laden' ? (
              <Leeg testid="dashboard-acties-laden">Acties worden geladen…</Leeg>
            ) : acties.length ? (
              <ul className="fwk-db-actielijst" aria-label="Acties">
                {acties.slice(0, MAX_ACTIES).map((a) => (
                  <li key={a.sleutel} className="fwk-db-actie" data-testid="dashboard-actie" data-urgentie={urgentie(a.dagen)}>
                    <div style={css('flex: 1; min-width: 0;')}>
                      <a href="#/kompas/deadlines">{a.titel}</a>
                      <div className="fwk-db-klein">{[a.projectNaam, a.regelNaam, a.datum ? formatDatum(a.datum) : 'Geen datum'].filter(Boolean).join(' · ')}</div>
                    </div>
                    {a.dagen != null && <Chip toon={urgentie(a.dagen)}>{a.dagen < 0 ? 'Te laat' : hoofdletter(dagenTekst(a.dagen))}</Chip>}
                  </li>
                ))}
              </ul>
            ) : (
              <Leeg>Geen openstaande acties.</Leeg>
            )}
            {acties.length > MAX_ACTIES && (
              <div style={css('margin-top: 4px;')}>
                <a href="#/kompas/deadlines" className="fwk-wp-link" data-testid="dashboard-alle-acties">
                  Alle {acties.length} acties
                </a>
              </div>
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
              <ul className="fwk-db-actielijst" aria-label="Komende deadlines">
                {data.deadlines.map((x) => {
                  const dm = dagEnMaand(x.datum);

                  return (
                    <li key={x.sleutel} data-testid="dashboard-deadline" className="fwk-db-dl">
                      <div className="fwk-db-dat" data-binnenkort={x.dagen <= 14 ? '1' : '0'}>
                        <b>{dm.dag}</b>
                        <span>{dm.maand}</span>
                      </div>
                      <div style={css('flex: 1; min-width: 0;')}>
                        <a href={projectFinancieringHref(x.projectId)} data-testid="dashboard-deadline-link">
                          {x.naam}
                        </a>
                        <div className="fwk-db-klein">
                          {formatDatum(x.datum)} · {dagenTekst(x.dagen)} · {x.projectNaam}
                        </div>
                      </div>
                      <StatusChip status={x.status} />
                    </li>
                  );
                })}
              </ul>
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
              <a href="#/kompas/documentatie?tab=bestanden" className="fwk-wp-link">
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
