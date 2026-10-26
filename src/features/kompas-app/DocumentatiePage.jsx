// Documenten: alles wat Subsidie Kompas voor het lid heeft opgemaakt en bij
// een project heeft bewaard. Klik een naam om er in de chat mee verder te
// werken.
//
// RC1 stap 3C (2026-10-01): deze pagina las tot nu toe uitsluitend
// store.genDocs - een lijst die in de praktijk altijd leeg blijft, omdat de
// tabellen waar genDocs van afhangt (documentatie/documentatie_versies, zie
// data/services/workspace.js) niet bestaan. De echte, al werkende opslag van
// door Subsidie Kompas opgemaakte documenten is project.docs (bewaard via
// "Opslaan bij project" in de chat, zie KompasToolPage.jsx's
// bewaarBijProject() en KompasStore.jsx's addGeneratedDocToProject() ->
// data/services/projecten.js, tabel subsidie_kompas_knowledge_items). Deze
// pagina leest daarom nu projecten/docs in plaats van genDocs, en gebruikt
// voor het downloaden dezelfde centrale Word-generator als de chat-export
// (zie normalizeDocumentContent.js/generateWordDocument.js) - geen tweede
// documentgenerator.
//
// Wat bewust NIET is meegenomen, omdat er geen echte data voor bestaat:
// - Versiebeheer (bijgewerkt bij de organisatie/project-scheiding): documenten
//   hebben nu een soort, versienummer, aanmaakdatum en (optioneel) een fonds
//   (knowledge_items.doc_type/version/document_context). Een nieuwe generatie
//   wordt een nieuwe versie naast de vorige; bewaarProject() vervangt of
//   verwijdert bestaande documenten niet meer. Hier alleen weergegeven,
//   geen "Nieuwe versie"-knop.
// - Projectkoppeling wijzigen: een document is in de echte opslag altijd kind
//   van precies één project (afgedwongen door bewaarBijProject() in
//   KompasToolPage.jsx) en geen enkele bestaande service kan een document
//   naar een ander project verplaatsen - de projectnaam wordt daarom alleen
//   getoond, niet meer als wijzigbare keuzelijst.
// - Verwijderen: de bestaande "Verwijderen"-knop riep store.deleteDoc() aan,
//   wat uitsluitend op de dode genDocs-lijst werkt - op echte documenten zou
//   die knop dus zichtbaar niets doen. Omdat er geen bestaande functie is die
//   een document veilig uit project.docs verwijdert, is de knop hier
//   weggelaten in plaats van een knop te tonen die niets uitvoert; zie het
//   rapport (stap 3C) voor dit aandachtspunt.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './useKompasApp.js';
import { useHeeftWerkruimte } from './werkruimteRechten.js';
import { isEchtId } from '../../data/services/projecten.js';
import { DocumentUploadKnop, DocumentVerwijderKnop, openProjectBestand, useDocumentenBeheer } from './projectdossier/DocumentenBeheer.jsx';
import ProjectinformatiePaneel from './projectinformatie/ProjectinformatiePaneel.jsx';
import { DOC_SOORTEN, useKompas } from './KompasStore.jsx';
import { Button, Notice } from '../../shared/ui/index.js';
import { Blok, Leeg, Melding, PaginaKop, Tabs, WerkPagina } from '../../shared/ui/werkplek.jsx';
// Exporteren (Word / Excel / PDF): gedeeld menu en gedeelde exportlaag
// (src/shared/export/); de vroegere downloadDocument/downloadExcelDocument
// staan daar nu eenmalig, met dezelfde Word-generator en begrotings-Excel.
import ExportMenu from '../../shared/ui/ExportMenu.jsx';
import { opgeslagenDocumentExport } from './exportBronnen.js';
// Aanvraag-assistent (Pro/Premium): het tabblad Projectplan en indienen. Het verschijnt alleen als de server de functie voor dit lid aanzet.
import { useAanvraagAssistent } from './aanvraag/useAanvraagAssistent.js';
import AanvragenTab from './aanvraag/AanvragenTab.jsx';
import BegrotingTab from './begroting/BegrotingTab.jsx';
import { huidigeHash, vervangAdres } from '../../app/adres.js';

// Tot er een tweede documentgenerator bestaat (Excel/PDF, een latere stap) is
// elk echt document hier altijd een .docx - geen verzonnen Excel/PDF-variant.
const WORD_STIJL = { label: 'DOCX', bg: '#EAF1F6', color: '#2C4A5E' };

const FILTERS = [['alle', 'Alle documenten'], ...DOC_SOORTEN.map((soort) => [soort, soort])];

// Het gekozen project voor Projectinformatie staat als ?project=<id> in de hash, zodat het projectdossier er direct
// naar kan linken en een vernieuwde pagina hetzelfde project toont.
function leesProjectUitUrl() {
  const m = /[?&]project=([^&]+)/.exec(huidigeHash());

  return m ? decodeURIComponent(m[1]) : '';
}

// Indienen heeft drie tabbladen: Projectplan en indienen (het projectplan en de fondsen waar het lid indient), Projectdossier en Projectdocumentatie (de bestanden).
// ?tab=plan, inhoud of bestanden kiest het tabblad (?tab=aanvragen, de oude naam, opent ook Projectplan en indienen); zonder tab opent de pagina altijd op Projectplan en indienen (ook met ?project=<id>).
// Het projectdossier is het laatste tabblad en opent dus alleen als er expliciet om gevraagd wordt (?tab=inhoud).
function leesTabUitUrl() {
  const h = huidigeHash();
  const m = /[?&]tab=(inhoud|bestanden|plan|aanvragen|begroting)(&|$)/.exec(h);

  return !m || m[1] === 'aanvragen' ? 'plan' : m[1];
}

function zetProjectInUrl(id) {
  try {
    const basis = huidigeHash().split('?')[0];

    vervangAdres(`${basis}?project=${encodeURIComponent(id)}`);
  } catch (e) {
    /* alleen een gemak voor het delen van de link */
  }
}

export default function DocumentatiePage() {
  const app = useApp();
  const store = useKompas();
  const paid = useHeeftWerkruimte();

  const [filter, setFilter] = useState('alle');
  const [melding, setMelding] = useState('');
  const [gekozen, setGekozen] = useState(leesProjectUitUrl);
  const [tab, setTab] = useState(leesTabUitUrl);
  const [projectFilter, setProjectFilter] = useState(() => leesProjectUitUrl() || 'alle');
  const assistent = useAanvraagAssistent(paid);

  // Alleen echte, niet-gearchiveerde projecten: Projectinformatie hoort bij een bewaard project.
  const projecten = useMemo(() => (store.projects || []).filter((p) => isEchtId(p.id) && !p.gearchiveerd), [store.projects]);
  const projectId = projecten.some((p) => p.id === gekozen) ? gekozen : projecten.length ? projecten[0].id : '';

  // Een link naar Projectplan of Fondsen indienen toont, als de functie er voor dit lid niet is, het projectdossier.
  // Het tabblad Begroting bestaat alleen als de database de kolom voor begrotingsregels heeft (budgetRegels is dan een lijst, ook een lege).
  const begrotingBeschikbaar = projecten.some((p) => Array.isArray(p.budgetRegels));
  const vraagtAssistent = tab === 'plan';
  const tabActief = vraagtAssistent && assistent.klaar && !assistent.beschikbaar ? 'inhoud' : tab === 'begroting' && !begrotingBeschikbaar ? 'bestanden' : tab;

  const kiesProject = useCallback((id) => {
    setGekozen(id);
    zetProjectInUrl(id);
  }, []);

  // De balk van Subsidieadvies verandert alleen de hash (stap of project): tabblad en project volgen de URL.
  useEffect(() => {
    const volg = () => {
      const h = huidigeHash();

      if (!/^#\/kompas\/documentatie/.test(h)) return;

      setTab(leesTabUitUrl());

      const p = leesProjectUitUrl();

      if (p) {
        setGekozen(p);
        setProjectFilter(p);
      }
    };

    window.addEventListener('hashchange', volg);

    return () => window.removeEventListener('hashchange', volg);
  }, []);

  // Subsidieadvies: Begroting (stap 2) en Indienen (stap 4) zijn twee kanten van deze pagina.
  const sectie = tabActief === 'begroting' ? 'begroting' : 'indienen';

  if (!paid) {
    return (
      <WerkPagina testid="documenten">
        <PaginaKop titel="Indienen" />
        <Melding toon="info">Indienen hoort bij Pro en Premium.</Melding>
        <div style={css('margin-top: 14px;')}>
          <Button variant="dark" onClick={app.goAbonnementen}>
            Bekijk de abonnementen
          </Button>
        </div>
      </WerkPagina>
    );
  }

  // Documenten met inhoud (opgemaakt in de chat) of een bewaard bestand (upload). Nooit een lege of fictieve kaart.
  const alle = (store.projects || []).flatMap((p, pi) =>
    (p.docs || [])
      .filter((d) => (d.tekst && String(d.tekst).trim().length > 0) || d.pad)
      .map((d, di) => ({
        ...d,
        id: d.id || `${p.id || `project-${pi}`}-doc-${di}`,
        projectId: p.id || '',
        projectNaam: p.naam || 'Naamloos project',
      })),
  );
  const inProject = alle.filter((d) => projectFilter === 'alle' || d.projectId === projectFilter);
  const zichtbaar = inProject.filter((d) => filter === 'alle' || d.soort === filter);
  const filterProject = projectFilter !== 'alle' ? (store.projects || []).find((p) => p.id === projectFilter) || null : null;
  const aantalProjecten = new Set(alle.map((d) => d.projectId)).size;

  const openInChat = (doc) => {
    store.patch({ activeDoc: { id: doc.id, naam: doc.naam, soort: doc.soort, projectId: doc.projectId || '' } });
    window.location.hash = '#/subsidie-kompas';
  };

  const kiesProjectFilter = (id) => {
    setProjectFilter(id);
    setMelding('');

    if (id !== 'alle') zetProjectInUrl(id);
  };

  return (
    <WerkPagina testid="documenten">
      <PaginaKop
        titel={sectie === 'begroting' ? 'Begroting en dekkingsplan' : 'Indienen'}
        meta={sectie === 'begroting' ? null : tabActief === 'bestanden' ? `${alle.length} ${alle.length === 1 ? 'document' : 'documenten'}${aantalProjecten ? ` in ${aantalProjecten} ${aantalProjecten === 1 ? 'project' : 'projecten'}` : ''}` : null}
        help={
          sectie === 'begroting' ? (
            <p>Uw begroting per subcategorie, met de dekking door de financiers van dit project.</p>
          ) : (
            <>
              <p>Het projectdossier is de inhoud waarmee Subsidie Kompas teksten en aanvragen voor een project schrijft. Wat daar niet staat, verzint Subsidie Kompas niet.</p>
              {assistent.beschikbaar && <p>Onder Projectplan en indienen schrijft u uw projectplan en houdt u per fonds de criteria, uw versie en de beoordeling van uw eigen tekst bij elkaar. U dient zelf in bij het fonds; wij helpen met de tekst en de stukken.</p>}
              <p>Projectdocumentatie zijn de bestanden bij uw projecten: wat u uploadt en wat Subsidie Kompas voor u opmaakte.</p>
            </>
          )
        }
      />

      {sectie === 'indienen' && (
        <Tabs
          tabs={[
            ...(assistent.beschikbaar
              ? [
                  { id: 'plan', label: 'Projectplan en indienen' },
                ]
              : []),
            { id: 'inhoud', label: 'Projectdossier' },
            { id: 'bestanden', label: 'Projectdocumentatie', aantal: alle.length },
          ]}
          actief={tabActief}
          onKies={setTab}
          label="Indienen"
          testidPrefix="documenten-tab-"
        />
      )}

      {tabActief === 'plan' && !assistent.beschikbaar && <Leeg>Even laden…</Leeg>}

      {tabActief === 'plan' && assistent.beschikbaar && (projecten.length > 0 ? (
        <AanvragenTab
          metProjectplan
          project={projecten.find((p) => p.id === projectId) || null}
          projecten={projecten}
          onKiesProject={kiesProject}
          store={store}
          assistent={assistent}
          onNaarProjectinhoud={() => setTab('inhoud')}
        />
      ) : (
        <Leeg>
          Nog geen project.{' '}
          <a href="#/kompas/projecten?nieuw=1" className="fwk-wp-link">
            Project aanmaken
          </a>
        </Leeg>
      ))}

      {tabActief === 'begroting' && (
        <BegrotingTab key={projectId} project={projecten.find((p) => p.id === projectId) || null} projecten={projecten} onKiesProject={kiesProject} store={store} />
      )}

      {tabActief === 'inhoud' &&
        (projecten.length > 0 ? (
          <ProjectinformatiePaneel projecten={projecten} projectId={projectId} onKies={kiesProject} store={store} />
        ) : (
          <div data-testid="pi-geen-project">
            <Leeg>
              Nog geen project.{' '}
              <a href="#/kompas/projecten?nieuw=1" className="fwk-wp-link">
                Project aanmaken
              </a>
            </Leeg>
          </div>
        ))}

      {tabActief === 'bestanden' && (
        <Blok kaal testid="documenten-bestanden">
          <div style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; margin-bottom: 14px;')}>
            <select
              data-testid="documenten-projectfilter"
              aria-label="Toon documenten van project"
              value={projectFilter}
              onChange={(e) => kiesProjectFilter(e.target.value)}
              style={css("cursor: pointer; box-sizing: border-box; min-height: 38px; padding: 6px 12px; border: 1px solid #D5E0D9; border-radius: 999px; background: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 800; color: #2C4A5E;")}
            >
              <option value="alle">Alle projecten</option>
              {(store.projects || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.naam || 'Naamloos project'}
                  {p.gearchiveerd ? ' (gearchiveerd)' : ''}
                </option>
              ))}
            </select>
            {FILTERS.map(([value, label]) => {
              const actief = filter === value;
              const aantal = value === 'alle' ? inProject.length : inProject.filter((d) => d.soort === value).length;

              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={actief}
                  onClick={() => {
                    setFilter(value);
                    setMelding('');
                  }}
                  style={css(`cursor: pointer; box-sizing: border-box; min-height: 34px; display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border: 1px solid ${actief ? '#BFD4C6' : '#E1EAE4'}; border-radius: 999px; background: ${actief ? '#EAF4EE' : '#FFFFFF'}; color: ${actief ? '#2F6D47' : '#3D4B48'}; font-family: 'Mulish', sans-serif; font-size: 13px; font-weight: 700;`)}
                >
                  <span>{label}</span>
                  <span style={css('font-size: 12px; color: #7B8985;')}>{aantal}</span>
                </button>
              );
            })}
          </div>

          {filterProject && isEchtId(filterProject.id) && !filterProject.gearchiveerd && <UploadVoorProject project={filterProject} store={store} />}

          {zichtbaar.length > 0 && (
            <ul style={css('list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px;')}>
              {zichtbaar.map((d) => (
                <DocumentRij
                  key={d.id}
                  doc={d}
                  project={(store.projects || []).find((p) => p.id === d.projectId) || null}
                  store={store}
                  paid={paid}
                  onOpenInChat={openInChat}
                  onMelding={setMelding}
                />
              ))}
            </ul>
          )}

          {!alle.length && (
            <Leeg testid="documenten-leeg">
              Nog geen documenten. Upload ze bij een project of laat Subsidie Kompas een projectplan of begroting opmaken in de{' '}
              <a href="#/kompas" className="fwk-wp-link">
                chat
              </a>
              .
            </Leeg>
          )}

          {alle.length > 0 && !zichtbaar.length && <Leeg>Geen documenten met deze filters.</Leeg>}

          <Notice>{melding}</Notice>
        </Blok>
      )}
    </WerkPagina>
  );
}

function UploadVoorProject({ project, store }) {
  const beheer = useDocumentenBeheer(project, store);

  return (
    <div data-testid="documenten-upload" style={css('display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 14px;')}>
      <DocumentUploadKnop beheer={beheer} />
      <span role="status" style={css(`font-family: 'Mulish', sans-serif; font-size: 13px; font-weight: 700; color: ${beheer.fout ? '#9E3B2C' : '#4E9A6C'};`)}>
        {beheer.bezig ? 'Document wordt verwerkt…' : beheer.fout || beheer.melding}
      </span>
    </div>
  );
}

function DocumentRij({ doc: d, project, store, paid, onOpenInChat, onMelding }) {
  const beheer = useDocumentenBeheer(project || { id: '', docs: [] }, store);
  const kanVerwijderen = Boolean(project && isEchtId(project.id) && isEchtId(String(d.id)));
  const heeftTekst = Boolean(d.tekst && String(d.tekst).trim());

  return (
    <li data-testid="documenten-rij" data-project-id={d.projectId} style={css('display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 10px 14px; border: 1px solid #E1EAE4; border-radius: 12px; background: #FFFFFF;')}>
      <span style={css(`flex-shrink: 0; padding: 5px 9px; border-radius: 8px; background: ${WORD_STIJL.bg}; color: ${WORD_STIJL.color}; font-size: 10.5px; font-weight: 800; letter-spacing: 0.04em;`)}>
        {d.pad && !heeftTekst ? String((d.naam || '').split('.').pop() || 'BESTAND').toUpperCase().slice(0, 4) : WORD_STIJL.label}
      </span>

      <div style={css('flex: 1 1 220px; min-width: 0;')}>
        {heeftTekst ? (
          <button type="button" onClick={() => onOpenInChat(d)} style={css('cursor: pointer; border: none; background: none; padding: 0; text-align: left;')}>
            <span style={css("display: block; font-family: 'Mulish', sans-serif; font-size: 14px; font-weight: 800; color: #2C4A5E; overflow-wrap: anywhere;")}>{d.naam}</span>
          </button>
        ) : (
          <span style={css("display: block; font-family: 'Mulish', sans-serif; font-size: 14px; font-weight: 800; color: #2C4A5E; overflow-wrap: anywhere;")}>{d.naam}</span>
        )}
        <span style={css("display: block; margin-top: 2px; font-family: 'Mulish', sans-serif; font-size: 12.5px; color: #7B8985;")}>
          <strong data-testid="documenten-rij-project" style={css('color: #4B5C58;')}>
            {d.projectNaam}
          </strong>
          {'  ·  '}
          {[d.soort || 'Overig', d.versie ? `versie ${d.versie}` : '', d.context && d.context.fonds ? `voor ${d.context.fonds}` : '', d.vervangen ? 'vervangen door een nieuwere versie' : ''].filter(Boolean).join('  ·  ')}
        </span>
      </div>

      <span style={css('display: flex; align-items: center; gap: 10px; flex-shrink: 0; flex-wrap: wrap;')}>
        {d.pad && (
          <button
            type="button"
            data-testid="document-open-bestand"
            onClick={async () => {
              if (!(await openProjectBestand(d.pad))) {
                onMelding('Het bestand kon niet worden geopend. Probeer het opnieuw.');
              }
            }}
            style={css("cursor: pointer; min-height: 36px; padding: 0 4px; border: none; background: none; font-family: 'Mulish', sans-serif; font-size: 13px; font-weight: 800; color: #4E9A6C;")}
          >
            Bestand openen
          </button>
        )}
        {heeftTekst && <ExportMenu toegestaan={paid} uitlijnen="rechts" onMelding={onMelding} ariaLabel={`${d.naam} exporteren`} bouwModel={opgeslagenDocumentExport({ doc: d, store })} />}
        {kanVerwijderen && <DocumentVerwijderKnop doc={d} beheer={beheer} />}
      </span>
    </li>
  );
}
