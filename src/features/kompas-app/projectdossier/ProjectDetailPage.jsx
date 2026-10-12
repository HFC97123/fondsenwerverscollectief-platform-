// Projectdossier: één project met zijn financiering, documenten en gesprekken (/kompas/projecten/<id>).
// Bewust GEEN hoofdmenu-item: u komt hier vanuit Projecten of het Dashboard.
//
// - Overzicht gebruikt uitsluitend projectgegevens uit subsidie_kompas_programs (via de store).
// - Projectfinanciering gebruikt subsidie_kompas_program_funding (via kompas_dekkingsplan) en dezelfde
//   rekenmodule als het Dashboard; er is geen tweede waarheid.
// - Documenten en Gesprekken tonen bestaande gegevens van dit project (geen nieuwe opslag).
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { Button } from '../../../shared/ui/index.js';
import { useApp } from '../useKompasApp.js';
import { useKompas } from '../KompasStore.jsx';
import { useProjectFinanciering } from '../financiering/useProjectFinanciering.js';
import { KLEUR } from '../financiering/FinancieringUi.jsx';
import { dagenTekst, dekkingVanProject, eerstvolgendeDeadline, formatDatum, formatEuro, formatTijd, periodeTekst } from '../financiering/dekkingsplan.js';
import ProjectfinancieringTab from './ProjectfinancieringTab.jsx';
import CofinanciersSectie from './CofinanciersSectie.jsx';
import ConversationsList from '../chat/ConversationsList.jsx';
import ProjectgegevensAanvullen from './ProjectgegevensAanvullen.jsx';
import { isEchtId } from '../../../data/services/projecten.js';
import KaartMenu, { CSS_KAARTMENU } from '../KaartMenu.jsx';
import { useHeeftWerkruimte } from '../werkruimteRechten.js';
import ProjectBewerkFormulier from './ProjectBewerkFormulier.jsx';
import { voortgang } from '../projectinformatie/projectinformatie.js';
import { DocumentNaam, DocumentSoortKiezer, DocumentUploadKnop, DocumentVerwijderKnop, useDocumentenBeheer } from './DocumentenBeheer.jsx';

const TEKST = "font-family: 'Mulish', sans-serif; font-size: 14.5px; line-height: 1.6; color: #4B5C58;";
const LABEL = "font-family: 'Mulish', sans-serif; font-size: 11.5px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #7B8985;";
const KAART = 'box-sizing: border-box; padding: 20px 22px; border: 1px solid #E1EAE4; border-radius: 20px; background: #FFFFFF; min-width: 0;';
const LINK = "font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 800; color: #4E9A6C; text-decoration: none; cursor: pointer; background: none; border: none; padding: 0;";

const TABS = [
  { id: 'overzicht', label: 'Overzicht' },
  { id: 'projectfinanciering', label: 'Projectfinanciering' },
  { id: 'documenten', label: 'Documenten' },
  { id: 'gesprekken', label: 'Gesprekken' },
];

const CSS_PAGINA = `
.fwk-pd-tabs { display: flex; gap: 4px; overflow-x: auto; border-bottom: 1px solid #E1EAE4; margin: 22px 0 18px; scrollbar-width: thin; }
.fwk-pd-tab { flex: none; cursor: pointer; min-height: 44px; padding: 10px 16px; border: none; border-bottom: 3px solid transparent; background: none; font-family: 'Mulish', sans-serif; font-size: 14.5px; font-weight: 800; color: #687974; }
.fwk-pd-tab[aria-selected="true"] { color: #2C4A5E; border-bottom-color: #4E9A6C; }
.fwk-pd-tab:focus-visible, .fwk-pd-pagina a:focus-visible, .fwk-pd-pagina button:focus-visible { outline: 2px solid #4E9A6C; outline-offset: 2px; }
.fwk-pd-kpis { display: grid; gap: 12px; grid-template-columns: repeat(6, minmax(0, 1fr)); }
@media (max-width: 1019px) { .fwk-pd-kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 599px) { .fwk-pd-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
`;

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

function Pagina({ children }) {
  return (
    <div className="fwk-pd-pagina" style={css('min-height: 100vh; background: #F7F9F8;')}>
      <style>{`${CSS_PAGINA}${CSS_KAARTMENU}`}</style>
      <div style={css('max-width: 1120px; margin: 0 auto; padding: clamp(20px, 3vw, 36px) clamp(16px, 4vw, 24px) 64px;')}>{children}</div>
    </div>
  );
}

function Kpi({ naam, waarde, sub, kleur }) {
  return (
    <div data-testid="detail-kpi" data-kpi={naam} style={css(`${KAART} padding: 14px 16px; border-radius: 16px;`)}>
      <div style={css(`display: flex; align-items: center; gap: 6px; ${TEKST} font-size: 12.5px; font-weight: 700; color: #7B8985;`)}>
        {kleur && <span aria-hidden="true" style={css(`display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: ${kleur}; border: 1px solid #CFDDD5; flex: none;`)} />}
        <span>{naam}</span>
      </div>
      <div style={css("margin-top: 4px; font-family: 'Newsreader', serif; font-size: 20px; font-weight: 600; color: #2C4A5E; overflow-wrap: anywhere;")}>{waarde}</div>
      {sub && <div style={css(`${TEKST} margin-top: 2px; font-size: 12.5px; color: #7B8985; overflow-wrap: anywhere;`)}>{sub}</div>}
    </div>
  );
}

function Veld({ label, children }) {
  if (children == null || children === '' || (Array.isArray(children) && !children.length)) {
    return null;
  }

  return (
    <div style={css('min-width: 0;')}>
      <div style={css(LABEL)}>{label}</div>
      <div style={css(`${TEKST} margin-top: 4px; white-space: pre-wrap; overflow-wrap: anywhere;`)}>{children}</div>
    </div>
  );
}

function OverzichtTab({ project, financiering, store, bewerk, setBewerk }) {
  const doelgroep = Array.isArray(project.doelgroep) ? project.doelgroep.join(', ') : project.doelgroep;
  const discipline = Array.isArray(project.discipline) ? project.discipline.join(', ') : project.discipline;
  const periode = periodeTekst(project.periodeVan, project.periodeTot);
  const heeftInhoud = [discipline, project.omschrijving, doelgroep, project.programma].some(Boolean);
  const pi = voortgang(project);

  return (
    <div data-testid="tab-overzicht" style={css('display: flex; flex-direction: column; gap: 18px;')}>
      <section style={css(KAART)}>
        <div style={css('display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 14px;')}>
          <h2 style={css(`${LABEL} margin: 0;`)}>Over dit project</h2>
          {!bewerk && (
            <button type="button" data-testid="overzicht-bewerken" onClick={() => setBewerk(true)} style={css(LINK)}>
              Projectgegevens bewerken
            </button>
          )}
        </div>
        {bewerk ? (
          <ProjectBewerkFormulier
            project={project}
            store={store}
            onAnnuleer={() => setBewerk(false)}
            onKlaar={(tekst) => {
              setBewerk(false, tekst);
            }}
          />
        ) : heeftInhoud || periode || project.regio ? (
          <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 16px 24px;')}>
            <Veld label="Programma of onderdeel">{project.programma}</Veld>
            <Veld label="Doelgroep">{doelgroep}</Veld>
            <Veld label="Discipline">{discipline}</Veld>
            <Veld label="Werkgebied / locatie">{project.regio}</Veld>
            <Veld label="Looptijd">{periode}</Veld>
            <div style={css('grid-column: 1 / -1; min-width: 0;')}>
              <Veld label="Projectomschrijving">{project.omschrijving}</Veld>
            </div>
          </div>
        ) : (
          <div style={css(`${TEKST} color: #7B8985;`)}>Er zijn nog geen projectgegevens ingevuld. Vul ze aan via “Projectgegevens bewerken”.</div>
        )}
      </section>

      {!bewerk && (
        <section data-testid="overzicht-projectinformatie" style={css(KAART)}>
          <div style={css('display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap;')}>
            <h2 style={css(`${LABEL} margin: 0;`)}>Projectdocumentatie</h2>
            <a href={`#/kompas/documentatie?project=${encodeURIComponent(project.id)}`} data-testid="overzicht-open-projectinformatie" style={css(LINK)}>
              Open in Documenten
            </a>
          </div>
          <p style={css(`${TEKST} margin: 8px 0 0; max-width: 640px;`)}>
            Doelstellingen, activiteiten, impact, planning en andere inhoud voor teksten en aanvragen beheert u bij Documenten.{' '}
            <span data-testid="overzicht-pi-voortgang" style={css('font-weight: 800; color: #2C4A5E;')}>
              {pi.ingevuld} van {pi.totaal} onderdelen ingevuld.
            </span>
          </p>
        </section>
      )}

      {!bewerk && <CofinanciersSectie project={project} financiering={financiering} />}
    </div>
  );
}

function DocumentenTab({ project, store }) {
  const docs = (project.docs || []).filter((d) => d && !d.vervangen);
  const beheer = useDocumentenBeheer(project, store);

  return (
    <section data-testid="tab-documenten" style={css(KAART)}>
      <div style={css('display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 14px;')}>
        <h2 style={css(`${LABEL} margin: 0;`)}>Documenten bij dit project</h2>
        <a href="#/kompas/documentatie" style={css(LINK)}>
          Naar Documentatie
        </a>
      </div>
      <p style={css(`${TEKST} margin: 0 0 14px; max-width: 640px;`)}>
        Upload projectplannen, begrotingen en concept-dekkingsplannen. Subsidie Kompas gebruikt deze documenten als achtergrondinformatie bij vragen over dit project.
      </p>
      {docs.length ? (
        <ul style={css('list-style: none; margin: 0 0 16px; padding: 0; display: flex; flex-direction: column; gap: 12px;')}>
          {docs.map((d) => (
            <li key={d.id || d.naam} data-testid="detail-document">
              <div style={css('display: flex; gap: 10px 14px; flex-wrap: wrap; align-items: center;')}>
                <div style={css('flex: 1 1 220px; min-width: 0;')}>
                  <DocumentNaam doc={d} />
                  <div style={css(`${TEKST} font-size: 13px; color: #7B8985;`)}>
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
                  onOpslaan={(tekst) =>
                    store.werkProjectBij(project.id, { vulling: {}, bijwerking: { omschrijving: tekst }, bronnen: { omschrijving: 'upload' }, conflicten: {} })
                  }
                />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div style={css(`${TEKST} margin-bottom: 16px; color: #7B8985;`)}>Nog geen documenten bij dit project. Documenten die u uploadt of in de chat opslaat, verschijnen hier.</div>
      )}
      <DocumentUploadKnop beheer={beheer} />
      <div role="status" data-testid="detail-documenten-melding" style={css(`${TEKST} margin-top: 10px; min-height: 22px; color: ${beheer.fout ? '#9E3B2C' : '#4E9A6C'}; font-weight: 700;`)}>
        {beheer.fout || beheer.melding}
      </div>
    </section>
  );
}

function GesprekkenTab({ project, gesprekken, onOpen, onBespreek }) {
  return (
    <section data-testid="tab-gesprekken" style={css(KAART)}>
      <div style={css('display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 14px;')}>
        <h2 style={css(`${LABEL} margin: 0;`)}>Gesprekken over dit project</h2>
        <button type="button" onClick={() => onBespreek(project.id)} style={css(LINK)}>
          Bespreek met Subsidie Kompas
        </button>
      </div>
      {/* Dezelfde gedeelde gesprekkenlijst als in de chatwerkruimte (Fase 4), gefilterd op dit project. */}
      <ConversationsList gesprekken={gesprekken} projectFilter={project.id} embedded compact showSearch={false} showNewConversation={false} onOpen={onOpen} />
    </section>
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
  const tabRefs = useRef({});
  const [bewerk, setBewerkState] = useState(leesBewerk);
  const [opgeslagen, setOpgeslagen] = useState('');

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

  const toetsen = (e, index) => {
    const volgende = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: TABS.length - 1 }[e.key];

    if (volgende == null) {
      return;
    }

    e.preventDefault();

    const doel = TABS[(volgende + TABS.length) % TABS.length].id;

    kies(doel);

    if (tabRefs.current[doel]) {
      tabRefs.current[doel].focus();
    }
  };

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
      <Pagina>
        <h1 style={css("margin: 0 0 8px; font-family: 'Newsreader', serif; font-size: 30px; font-weight: 600; color: #2C4A5E;")}>Projectdossier</h1>
        <p style={css(`${TEKST} max-width: 640px; margin: 0 0 16px;`)}>Met Pro en Premium legt u per project de begroting en het dekkingsplan vast en volgt u de financiering.</p>
        <Button variant="dark" onClick={app.goAbonnementen}>
          Bekijk de abonnementen
        </Button>
      </Pagina>
    );
  }

  if (!project) {
    return (
      <Pagina>
        {store.projectenKlaar ? (
          <div data-testid="project-niet-gevonden" style={css(KAART)}>
            <h1 style={css("margin: 0 0 8px; font-family: 'Newsreader', serif; font-size: 26px; font-weight: 600; color: #2C4A5E;")}>Project niet gevonden</h1>
            <p style={css(`${TEKST} margin: 0 0 14px;`)}>Dit project bestaat niet (meer) in uw account.</p>
            <a href="#/kompas/projecten" style={css(LINK)}>
              Naar Projecten
            </a>
          </div>
        ) : (
          <div data-testid="project-laden" style={css(`${TEKST} color: #7B8985;`)}>Project wordt geladen…</div>
        )}
      </Pagina>
    );
  }

  const meta = [project.regio, periodeTekst(project.periodeVan, project.periodeTot)].filter(Boolean).join(' · ');

  const bespreek = (id) => {
    store.zetChatVerzoek({ type: 'project', projectId: id });
    app.goKompas();
  };

  const openGesprek = (g) => {
    store.zetChatVerzoek({ type: 'gesprek', gesprekId: g.id, projectId: g.projectId });
    app.goKompas();
  };

  return (
    <Pagina>
      <div data-testid="project-detail" data-project-id={project.id}>
        <a href="#/kompas/projecten" style={css(LINK)}>
          ← Alle projecten
        </a>

        {/* Rustige projectkop: titel en meta; daaronder de ene aanvullende actie en het ⋯-menu. Bewerken gebeurt
            per tabblad op de plek waar de gegevens staan; export hoort bij Documenten (de exportcode blijft bestaan). */}
        <div data-testid="project-kop" style={css('margin: 10px 0 20px;')}>
          <h1 data-testid="project-detail-naam" style={css("margin: 0 0 4px; font-family: 'Newsreader', serif; font-size: clamp(26px, 3.6vw, 34px); font-weight: 600; color: #2C4A5E; overflow-wrap: anywhere;")}>
            {project.naam || 'Naamloos project'}
          </h1>
          {meta && <div data-testid="project-detail-meta" style={css(`${TEKST} color: #7B8985;`)}>{meta}</div>}
          <div style={css('display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px 12px; margin-top: 14px;')}>
            <Button onClick={() => bespreek(project.id)}>Bespreek met Subsidie Kompas</Button>
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
          </div>
        </div>

        {project.gearchiveerd && (
          <div role="status" data-testid="project-gearchiveerd" style={css(`${TEKST} margin-bottom: 14px; padding: 10px 14px; border: 1px solid #E1EAE4; border-radius: 12px; background: #EEF3F0; color: #4B5C58;`)}>
            Dit project is gearchiveerd. U kunt het terugzetten via het menu ⋯ hierboven.
          </div>
        )}

        <div className="fwk-pd-kpis">
          <Kpi naam="Totale begroting" waarde={dekking.heeftBegroting ? formatEuro(dekking.begroting) : '—'} kleur="#C5D2CB" />
          <Kpi naam="Toegekend" waarde={formatEuro(dekking.toegekend)} kleur={KLEUR.toegekend} />
          <Kpi naam="Aangevraagd" waarde={formatEuro(dekking.aangevraagd)} kleur={KLEUR.aangevraagd} />
          <Kpi naam="Eigen bijdrage" waarde={formatEuro(dekking.overige)} kleur={KLEUR.overige} />
          <Kpi
            naam="Nog te financieren"
            waarde={dekking.heeftBegroting ? (dekking.volledigGedekt ? 'Volledig gedekt' : formatEuro(dekking.nogNodig)) : '—'}
            kleur="#E1EAE4"
          />
          <Kpi
            naam="Eerstvolgende deadline"
            waarde={volgende ? formatDatum(volgende.datum) : 'Geen'}
            sub={volgende ? `${dagenTekst(volgende.dagen)} · ${volgende.naam}` : null}
          />
        </div>

        <div className="fwk-pd-tabs" role="tablist" aria-label="Projectdossier">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el;
              }}
              type="button"
              role="tab"
              id={`pd-tab-${t.id}`}
              data-testid={`tab-btn-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`pd-paneel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              className="fwk-pd-tab"
              onClick={() => kies(t.id)}
              onKeyDown={(e) => toetsen(e, i)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`pd-paneel-${tab}`} aria-labelledby={`pd-tab-${tab}`}>
          {tab === 'overzicht' && opgeslagen && !bewerk && (
            <div role="status" data-testid="overzicht-melding" style={css(`${TEKST} margin-bottom: 12px; font-weight: 700; color: #4E9A6C;`)}>{opgeslagen}</div>
          )}
          {tab === 'overzicht' && <OverzichtTab project={project} financiering={financiering} store={store} bewerk={bewerk} setBewerk={setBewerk} />}
          {tab === 'projectfinanciering' && <ProjectfinancieringTab project={project} financiering={financiering} dekking={dekking} />}
          {tab === 'documenten' && <DocumentenTab project={project} store={store} />}
          {tab === 'gesprekken' && <GesprekkenTab project={project} gesprekken={gesprekken} onOpen={openGesprek} onBespreek={bespreek} />}
        </div>
      </div>
    </Pagina>
  );
}
