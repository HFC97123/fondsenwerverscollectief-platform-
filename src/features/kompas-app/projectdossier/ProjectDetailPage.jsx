// Projectdossier: het project als samenhangende werkplek (/kompas/projecten/<id>).
// Kop met één regel kerngegevens, tabbladen voor Projectprofiel, Documenten en Gesprekken, en een zijkolom met de dekking
// van de begroting en de komende deadlines. Fondsen en dekkingsplan en Deadlines staan sinds Subsidieadvies bij Fondsen en Deadlines.
// Bewust GEEN hoofdmenu-item: u komt hier vanuit Projecten of het Dashboard.
//
// - Projectprofiel gebruikt uitsluitend projectgegevens uit subsidie_kompas_programs (via de store).
// - Fondsen en dekkingsplan gebruikt subsidie_kompas_program_funding (via kompas_dekkingsplan) en dezelfde
//   rekenmodule als het Dashboard; er is geen tweede waarheid.
// - Documenten en Gesprekken tonen bestaande gegevens van dit project (geen nieuwe opslag).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { Button } from '../../../shared/ui/index.js';
import { Blok, Leeg, Melding, PaginaKop, Tabs, WerkPagina } from '../../../shared/ui/werkplek.jsx';
import { useApp } from '../useKompasApp.js';
import { useKompas } from '../KompasStore.jsx';
import { useProjectFinanciering } from '../financiering/useProjectFinanciering.js';
import { KLEUR, StatusChip, Voortgangsbalk } from '../financiering/FinancieringUi.jsx';
import { dagenTekst, dagenTot, dekkingVanProject, eerstvolgendeDeadline, formatDatum, formatEuro, formatTijd, isKomendeDeadline, periodeTekst } from '../financiering/dekkingsplan.js';
import ConversationsList from '../chat/ConversationsList.jsx';
import ProjectgegevensAanvullen from './ProjectgegevensAanvullen.jsx';
import { isEchtId } from '../../../data/services/projecten.js';
import KaartMenu, { CSS_KAARTMENU } from '../KaartMenu.jsx';
import { useHeeftWerkruimte } from '../werkruimteRechten.js';
import ProjectBewerkFormulier from './ProjectBewerkFormulier.jsx';
import { adviesDoorverwijzing, stapHref } from '../advies/adviesLinks.js';
import { DocumentNaam, DocumentSoortKiezer, DocumentUploadKnop, DocumentVerwijderKnop, useDocumentenBeheer } from './DocumentenBeheer.jsx';

const TEKST = "font-family: 'Mulish', sans-serif; font-size: 14px; line-height: 1.6; color: #4B5C58;";
const LABEL = "font-family: 'Mulish', sans-serif; font-size: 10.5px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase; color: #9AA6A2;";

const TABS = [
  { id: 'overzicht', label: 'Projectprofiel' },
  { id: 'documenten', label: 'Documenten' },
  { id: 'gesprekken', label: 'Gesprekken' },
];

// ?tab=<id> in de hash, zodat een tab gedeeld/herladen kan worden.
function leesTab() {
  const m = /[?&]tab=([a-z]+)/.exec(window.location.hash || '');

  return m && TABS.some((t) => t.id === m[1]) ? m[1] : 'overzicht';
}

function zetTabInUrl(id) {
  try {
    const [pad] = String(window.location.hash || '').replace(/^#/, '').split('?');
    const nieuw = `#${pad}${id === 'overzicht' ? '' : `?tab=${id}`}`;

    // replaceState: geen hashchange, dus geen herrender van de hele route en geen extra historie-item.
    window.history.replaceState(null, '', nieuw);
  } catch (e) {
    // Zonder history API blijft de tab gewoon in de component-state.
  }
}

// ?bewerk=1 in de hash opent het bewerkformulier (tab Overzicht). Oude links (#/kompas/projecten?bewerk=<id>)
// worden door de Projecten-pagina naar hier doorgestuurd.
function leesBewerk() {
  return /[?&]bewerk=1(&|$)/.test(window.location.hash || '');
}

function zetBewerkInUrl(aan) {
  try {
    const [pad] = String(window.location.hash || '').replace(/^#/, '').split('?');

    window.history.replaceState(null, '', `#${pad}${aan ? '?bewerk=1' : ''}`);
  } catch (e) {
    // Zonder history API blijft de modus gewoon in de component-state.
  }
}

function Veld({ label, children, breed = false }) {
  const leeg = children == null || children === '' || (Array.isArray(children) && !children.length);

  return (
    <div style={css(`min-width: 0;${breed ? ' grid-column: 1 / -1;' : ''}`)}>
      <div style={css(LABEL)}>{label}</div>
      <div style={css(`${TEKST} margin-top: 3px; white-space: pre-wrap; overflow-wrap: anywhere; color: ${leeg ? '#9AA6A2' : '#2E3A38'};`)}>{leeg ? 'Nog niet ingevuld' : children}</div>
    </div>
  );
}

function ProfielTab({ project, bewerk, setBewerk, store }) {
  const doelgroep = Array.isArray(project.doelgroep) ? project.doelgroep.join(', ') : project.doelgroep;
  const discipline = Array.isArray(project.discipline) ? project.discipline.join(', ') : project.discipline;
  const periode = periodeTekst(project.periodeVan, project.periodeTot);

  return (
    <div data-testid="tab-overzicht" style={css('display: flex; flex-direction: column; gap: 18px;')}>
      <Blok
        testid="projectprofiel"
        titel="Projectprofiel"
        actie={
          !bewerk && (
            <button type="button" data-testid="overzicht-bewerken" onClick={() => setBewerk(true)} className="fwk-wp-link">
              Bewerken
            </button>
          )
        }
      >
        {bewerk ? (
          <ProjectBewerkFormulier project={project} store={store} onAnnuleer={() => setBewerk(false)} onKlaar={(tekst) => setBewerk(false, tekst)} />
        ) : (
          <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 14px 22px;')}>
            <Veld label="Disciplines">{discipline}</Veld>
            <Veld label="Doelgroep">{doelgroep}</Veld>
            <Veld label="Werkgebied / locatie">{project.regio}</Veld>
            <Veld label="Looptijd">{periode}</Veld>
            {project.programma && <Veld label="Programma of onderdeel">{project.programma}</Veld>}
            <Veld label="Totale begroting">{project.begroting !== '' && project.begroting != null ? formatEuro(Number(project.begroting)) : ''}</Veld>
            <Veld label="Projectomschrijving" breed>
              {project.omschrijving}
            </Veld>
          </div>
        )}
      </Blok>
    </div>
  );
}

function DocumentenTab({ project, store }) {
  const docs = (project.docs || []).filter((d) => d && !d.vervangen);
  const beheer = useDocumentenBeheer(project, store);

  return (
    <div data-testid="tab-documenten">
      <Blok
        titel="Documenten bij dit project"
        aantal={docs.length}
        actie={
          <a href={`#/kompas/documentatie?project=${encodeURIComponent(project.id)}&tab=bestanden`} className="fwk-wp-link">
            Naar Documenten
          </a>
        }
      >
        {docs.length ? (
          <ul style={css('list-style: none; margin: 0 0 14px; padding: 0; display: flex; flex-direction: column; gap: 8px;')}>
            {docs.map((d) => (
              <li key={d.id || d.naam} data-testid="detail-document" style={css('box-sizing: border-box; padding: 10px 14px; border: 1px solid #E1EAE4; border-radius: 12px; background: #FFFFFF;')}>
                <div style={css('display: flex; gap: 8px 14px; flex-wrap: wrap; align-items: center;')}>
                  <div style={css('flex: 1 1 220px; min-width: 0;')}>
                    <DocumentNaam doc={d} />
                    <div style={css(`${TEKST} font-size: 12.5px; color: #7B8985;`)}>
                      {[d.grootte, d.versie > 1 ? `versie ${d.versie}` : '', d.gemaakt ? formatTijd(d.gemaakt, new Date()) : ''].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <DocumentSoortKiezer doc={d} beheer={beheer} />
                  <DocumentVerwijderKnop doc={d} beheer={beheer} />
                </div>
                {isEchtId(d.id) && isEchtId(project.id) && (
                  <ProjectgegevensAanvullen
                    project={project}
                    document={d}
                    onOpslaan={(tekst) => store.werkProjectBij(project.id, { vulling: {}, bijwerking: { omschrijving: tekst }, bronnen: { omschrijving: 'upload' }, conflicten: {} })}
                  />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div style={css('margin-bottom: 14px;')}>
            <Leeg>Nog geen documenten bij dit project.</Leeg>
          </div>
        )}
        <DocumentUploadKnop beheer={beheer} />
        <div role="status" data-testid="detail-documenten-melding" style={css(`${TEKST} margin-top: 10px; min-height: 22px; color: ${beheer.fout ? '#9E3B2C' : '#4E9A6C'}; font-weight: 700;`)}>
          {beheer.fout || beheer.melding}
        </div>
      </Blok>
    </div>
  );
}

function GesprekkenTab({ project, gesprekken, onOpen, onBespreek }) {
  return (
    <div data-testid="tab-gesprekken">
      <Blok
        titel="Gesprekken over dit project"
        aantal={gesprekken.length}
        actie={
          <button type="button" onClick={() => onBespreek(project.id)} className="fwk-wp-link">
            Nieuw gesprek over dit project
          </button>
        }
      >
        {/* Dezelfde gedeelde gesprekkenlijst als in de chatwerkruimte, gefilterd op dit project. */}
        <ConversationsList gesprekken={gesprekken} projectFilter={project.id} embedded compact showSearch={false} showNewConversation={false} onOpen={onOpen} />
      </Blok>
    </div>
  );
}

function Kpi({ naam, waarde, sub, kleur }) {
  return (
    <span data-testid="detail-kpi" data-kpi={naam} className="fwk-pd-cijfer">
      {kleur && <span aria-hidden="true" className="fwk-pd-stip" style={{ background: kleur }} />}
      <span className="fwk-pd-cijfer-naam">{naam}</span> <strong>{waarde}</strong>
      {sub && <span className="fwk-pd-cijfer-sub"> · {sub}</span>}
    </span>
  );
}

const CSS_CIJFERS = `
.fwk-pd-cijfers { display: flex; flex-wrap: wrap; gap: 6px 8px; margin: -8px 0 18px; }
.fwk-pd-cijfer { display: inline-flex; align-items: center; gap: 5px; padding: 5px 11px; border: 1px solid #E1EAE4; border-radius: 999px; background: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 12.5px; color: #687974; white-space: nowrap; }
.fwk-pd-cijfer strong { color: #2C4A5E; font-weight: 800; }
.fwk-pd-cijfer-sub { color: #7B8985; }
.fwk-pd-stip { display: inline-block; width: 8px; height: 8px; border-radius: 50%; flex: none; }
@media (max-width: 600px) { .fwk-pd-cijfer { white-space: normal; } }
`;

function Zijkolom({ project, dekking, volgende, regels, financiering }) {
  const nu = new Date();
  const komend = regels
    .filter((r) => isKomendeDeadline(r, nu))
    .sort((a, b) => String(a.deadline).localeCompare(String(b.deadline)))
    .slice(0, 4);

  return (
    <div className="fwk-wp-stapel">
      <Blok
        testid="detail-dekking"
        titel="Dekking"
        actie={
          <a href={stapHref('fondsen', project.id)} className="fwk-wp-link">
            Dekkingsplan
          </a>
        }
      >
        {dekking.heeftBegroting ? (
          <>
            <Voortgangsbalk dekking={dekking} projectNaam={project.naam || 'dit project'} hoogte={8} />
            <div style={css(`${TEKST} margin-top: 8px; display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 12px; color: #7B8985;`)}>
              {[
                ['toegekend', KLEUR.toegekend],
                ['aangevraagd', KLEUR.aangevraagd],
                ['eigen bijdrage', KLEUR.overige],
              ].map(([n, k]) => (
                <span key={n} style={css('display: inline-flex; align-items: center; gap: 5px;')}>
                  <span aria-hidden="true" className="fwk-pd-stip" style={{ background: k }} />
                  {n}
                </span>
              ))}
            </div>
          </>
        ) : (
          <a href={`#/kompas/projecten/${project.id}?bewerk=1`} className="fwk-wp-link" data-testid="detail-begroting-invullen">
            Begroting invullen
          </a>
        )}
      </Blok>

      <Blok testid="detail-komende-deadlines" titel="Komende deadlines">
        {financiering.status === 'laden' ? (
          <Leeg>Wordt geladen…</Leeg>
        ) : komend.length ? (
          <ul style={css('list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px;')}>
            {komend.map((r) => (
              <li key={r.id} style={css('padding: 9px 12px; border: 1px solid #E1EAE4; border-radius: 12px; background: #F7F9F8;')}>
                <div style={css('display: flex; justify-content: space-between; gap: 8px;')}>
                  <span style={css(`${TEKST} font-size: 13px; font-weight: 800; color: #2C4A5E; overflow-wrap: anywhere;`)}>{r.naam}</span>
                  <span style={css(`${TEKST} font-size: 12.5px; font-weight: 800; white-space: nowrap; color: #2C4A5E;`)}>{dagenTekst(dagenTot(r.deadline, nu))}</span>
                </div>
                <div style={css('display: flex; justify-content: space-between; gap: 8px; margin-top: 4px; align-items: center;')}>
                  <span style={css(`${TEKST} font-size: 12px; color: #7B8985;`)}>{formatDatum(r.deadline)}</span>
                  <StatusChip status={r.status} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Leeg>Geen komende deadlines.</Leeg>
        )}
      </Blok>
    </div>
  );
}

export default function ProjectDetailPage({ projectId }) {
  const app = useApp();
  const store = useKompas();
  const paid = useHeeftWerkruimte();

  const project = (store.projects || []).find((p) => p.id === projectId) || null;
  // Altijd aanroepen (hooks); voor een onbekend of lokaal project doet dit niets.
  const financiering = useProjectFinanciering(project && paid ? projectId : null);
  const [tab, setTab] = useState(leesTab);
  const [bewerk, setBewerkState] = useState(leesBewerk);
  const [opgeslagen, setOpgeslagen] = useState('');

  // Een link binnen dezelfde pagina (bijv. "Projectprofiel aanpassen" vanuit Projectfinanciering) verandert alleen de hash:
  // tab en bewerkformulier volgen dan de URL.
  useEffect(() => {
    const volg = () => {
      const door = adviesDoorverwijzing(window.location.hash, projectId);

      if (door) {
        window.location.replace(door);

        return;
      }

      setTab(leesTab());
      setBewerkState(leesBewerk());
    };

    volg();

    window.addEventListener('hashchange', volg);

    return () => window.removeEventListener('hashchange', volg);
  }, [projectId]);

  const setBewerk = useCallback((aan, melding) => {
    setBewerkState(aan);
    zetBewerkInUrl(aan);
    setOpgeslagen(melding || '');
  }, []);

  const kies = useCallback((id) => {
    setTab(id);
    setBewerkState(false);
    zetTabInUrl(id);
  }, []);

  const regels = financiering.status === 'klaar' ? financiering.regels : [];
  const dekking = useMemo(() => dekkingVanProject(project || {}, regels), [project, regels]);
  const volgende = useMemo(() => eerstvolgendeDeadline(regels, new Date()), [regels]);

  const gesprekken = useMemo(
    () =>
      (store.conversations || [])
        .filter((g) => g && g.id && g.projectId === projectId)
        .slice()
        .sort((a, b) => String(b.tijd || '').localeCompare(String(a.tijd || ''))),
    [store.conversations, projectId],
  );

  if (!paid) {
    return (
      <WerkPagina>
        <PaginaKop titel="Projectdossier" />
        <Melding toon="info">Projecten horen bij Pro en Premium.</Melding>
        <div style={css('margin-top: 14px;')}>
          <Button variant="dark" onClick={app.goAbonnementen}>
            Bekijk de abonnementen
          </Button>
        </div>
      </WerkPagina>
    );
  }

  if (!project) {
    return (
      <WerkPagina>
        {store.projectenKlaar ? (
          <div data-testid="project-niet-gevonden" className="fwk-wp-blok">
            <h1 style={css("margin: 0 0 8px; font-family: 'Newsreader', serif; font-size: 26px; font-weight: 600; color: #2C4A5E;")}>Project niet gevonden</h1>
            <p style={css(`${TEKST} margin: 0 0 14px;`)}>Dit project bestaat niet (meer) in uw account.</p>
            <a href="#/kompas/projecten" className="fwk-wp-link">
              Naar Projecten
            </a>
          </div>
        ) : (
          <div data-testid="project-laden" style={css(`${TEKST} color: #7B8985;`)}>
            Project wordt geladen…
          </div>
        )}
      </WerkPagina>
    );
  }

  const meta = [project.regio, periodeTekst(project.periodeVan, project.periodeTot)].filter(Boolean).join(' · ');
  const docs = (project.docs || []).filter((d) => d && !d.vervangen);
  const meta2 = [
    financiering.status === 'klaar' ? `${regels.length} ${regels.length === 1 ? 'regeling of financier' : 'regelingen en financiers'} in het plan` : null,
    `${docs.length} ${docs.length === 1 ? 'document' : 'documenten'}`,
    gesprekken.length ? `${gesprekken.length} ${gesprekken.length === 1 ? 'gesprek' : 'gesprekken'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const bespreek = (id) => {
    store.zetChatVerzoek({ type: 'project', projectId: id });
    app.goKompas();
  };

  const openGesprek = (g) => {
    store.zetChatVerzoek({ type: 'gesprek', gesprekId: g.id, projectId: g.projectId });
    app.goKompas();
  };

  const tabs = TABS.map((t) => ({
    ...t,
    aantal: t.id === 'documenten' ? docs.length : t.id === 'gesprekken' ? gesprekken.length : t.id === 'projectfinanciering' && financiering.status === 'klaar' ? regels.length : null,
  }));
  const metZijkolom = true;

  return (
    <WerkPagina>
      <style>{`${CSS_KAARTMENU}${CSS_CIJFERS}`}</style>
      <div data-testid="project-detail" data-project-id={project.id}>
        <PaginaKop
          testid="project-kop"
          titelTestid="project-detail-naam"
          metaTestid="project-detail-meta"
          terug={{ href: '#/kompas/projecten', label: 'Projecten' }}
          titel={project.naam || 'Naamloos project'}
          meta={meta || null}
          meta2={meta2}
          acties={
            <>
              <Button size="s" onClick={() => bespreek(project.id)}>
                Bespreek met Subsidie Kompas
              </Button>
              <KaartMenu
                label="Meer acties voor dit project"
                testid="project-menu"
                acties={[
                  { id: 'archiveren', label: project.gearchiveerd ? 'Terugzetten' : 'Archiveren', onSelect: () => store.archiveProject(project.id, !project.gearchiveerd) },
                  {
                    id: 'verwijderen',
                    label: 'Verwijderen',
                    gevaar: true,
                    bevestig: { vraag: `Project "${project.naam || 'Naamloos project'}" definitief verwijderen? Ook de documenten van dit project worden verwijderd.`, knop: 'Definitief verwijderen' },
                    onSelect: () => {
                      store.deleteProject(project.id);
                      window.location.hash = '#/kompas/projecten';
                    },
                  },
                ]}
              />
            </>
          }
        />

        <div className="fwk-pd-cijfers" data-testid="detail-cijfers">
          <Kpi naam="Totale begroting" waarde={dekking.heeftBegroting ? formatEuro(dekking.begroting) : '—'} kleur="#C5D2CB" />
          <Kpi naam="Toegekend" waarde={formatEuro(dekking.toegekend)} kleur={KLEUR.toegekend} />
          <Kpi naam="Aangevraagd" waarde={formatEuro(dekking.aangevraagd)} kleur={KLEUR.aangevraagd} />
          <Kpi naam="Eigen bijdrage" waarde={formatEuro(dekking.overige)} kleur={KLEUR.overige} />
          <Kpi naam="Nog te financieren" waarde={dekking.heeftBegroting ? (dekking.volledigGedekt ? 'Volledig gedekt' : formatEuro(dekking.nogNodig)) : '—'} kleur="#E1EAE4" />
          <Kpi naam="Eerstvolgende deadline" waarde={volgende ? formatDatum(volgende.datum) : 'Geen'} sub={volgende ? `${dagenTekst(volgende.dagen)} · ${volgende.naam}` : null} />
        </div>

        {project.gearchiveerd && (
          <div style={css('margin-bottom: 14px;')}>
            <Melding toon="info" testid="project-gearchiveerd">
              Dit project is gearchiveerd. Terugzetten kan via het menu ⋯.
            </Melding>
          </div>
        )}

        <Tabs tabs={tabs} actief={tab} onKies={kies} label="Projectdossier" />

        <div className={metZijkolom ? 'fwk-wp-kolommen' : ''}>
          <div role="tabpanel" id={`wp-paneel-${tab}`} aria-labelledby={`wp-tab-${tab}`} style={css('min-width: 0;')}>
            {tab === 'overzicht' && opgeslagen && !bewerk && (
              <div style={css('margin-bottom: 12px;')}>
                <Melding testid="overzicht-melding">{opgeslagen}</Melding>
              </div>
            )}
            {tab === 'overzicht' && <ProfielTab project={project} bewerk={bewerk} setBewerk={setBewerk} store={store} />}
            {tab === 'documenten' && <DocumentenTab project={project} store={store} />}
            {tab === 'gesprekken' && <GesprekkenTab project={project} gesprekken={gesprekken} onOpen={openGesprek} onBespreek={bespreek} />}
          </div>
          {metZijkolom && <Zijkolom project={project} dekking={dekking} volgende={volgende} regels={regels} financiering={financiering} />}
        </div>
      </div>
    </WerkPagina>
  );
}
