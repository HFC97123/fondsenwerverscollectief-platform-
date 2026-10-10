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
import React, { useState } from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './useKompasApp.js';
import { DOC_SOORTEN, useKompas } from './KompasStore.jsx';
import { Button, EmptyState, Notice, Panel, PanelHeader } from '../../shared/ui/index.js';
// Exporteren (Word / Excel / PDF): gedeeld menu en gedeelde exportlaag
// (src/shared/export/); de vroegere downloadDocument/downloadExcelDocument
// staan daar nu eenmalig, met dezelfde Word-generator en begrotings-Excel.
import ExportMenu from '../../shared/ui/ExportMenu.jsx';
import { opgeslagenDocumentExport } from './exportBronnen.js';

// Tot er een tweede documentgenerator bestaat (Excel/PDF, een latere stap) is
// elk echt document hier altijd een .docx - geen verzonnen Excel/PDF-variant.
const WORD_STIJL = { label: 'DOCX', bg: '#EAF1F6', color: '#2C4A5E' };

const FILTERS = [['alle', 'Alle documenten'], ...DOC_SOORTEN.map((soort) => [soort, soort])];

export default function DocumentatiePage({ embedded = false } = {}) {
  const app = useApp();
  const store = useKompas();
  const paid = ['pro', 'premium'].indexOf(app.subscriptionTier || 'free') !== -1;

  const [filter, setFilter] = useState('alle');
  const [melding, setMelding] = useState('');

  if (!paid) {
    return (
      <Panel embedded={embedded}>
        {!embedded && (
          <PanelHeader title="Documenten"
            intro="Met Pro en Premium maakt Subsidie Kompas projectplannen en aanvragen in Word, begrotingen in Excel en definitieve versies in pdf. Ze komen hier terecht, gekoppeld aan uw projecten."
          />
        )}
        <Button variant="dark" onClick={app.goAbonnementen}>
          Bekijk de abonnementen
        </Button>
      </Panel>
    );
  }

  // Alleen projectdocumenten met daadwerkelijke inhoud worden getoond - nooit
  // een lege of fictieve documentkaart (zie bewaarBijProject(): tekst is de
  // letterlijke chattekst en hoort dus nooit leeg te zijn, maar deze check
  // voorkomt dat een documentkaart ooit tot een leeg Word-bestand leidt).
  const alle = (store.projects || []).flatMap((p, pi) =>
    (p.docs || [])
      .filter((d) => d.tekst && String(d.tekst).trim().length > 0)
      .map((d, di) => ({
        ...d,
        id: d.id || `${p.id || `project-${pi}`}-doc-${di}`,
        projectId: p.id || '',
        projectNaam: p.naam || 'Naamloos project',
      })),
  );
  const zichtbaar = alle.filter((d) => filter === 'alle' || d.soort === filter);

  const openInChat = (doc) => {
    store.patch({ activeDoc: { id: doc.id, naam: doc.naam, soort: doc.soort, projectId: doc.projectId || '' } });
    window.location.hash = '#/subsidie-kompas';
  };

  return (
    <Panel embedded={embedded}>
      {!embedded && (
        <PanelHeader title="Documenten"
          intro="Alles wat Subsidie Kompas voor u opmaakt en dat u bij een project heeft bewaard, komt hier terecht. Klik op een naam om er in de chat mee verder te werken, of download het als Word-bestand."
        />
      )}

      <div style={css('display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;')}>
        {FILTERS.map(([value, label]) => {
          const actief = filter === value;
          const aantal = value === 'alle' ? alle.length : alle.filter((d) => d.soort === value).length;

          return (
            <button
              key={value}
              type="button"
              aria-pressed={actief}
              onClick={() => { setFilter(value); setMelding(''); }}
              style={css(`
                cursor: pointer;
                box-sizing: border-box;
                min-height: 40px;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 10px 16px;
                border: 1px solid ${actief ? '#BFD4C6' : '#E1EAE4'};
                border-radius: 999px;
                background: ${actief ? '#EAF4EE' : '#FFFFFF'};
                color: ${actief ? '#2F6D47' : '#3D4B48'};
                font-family: 'Mulish', sans-serif;
                font-size: 13.5px;
                font-weight: 700;
              `)}
            >
              <span>{label}</span>
              <span style={css('font-size: 12px; color: #7B8985;')}>{aantal}</span>
            </button>
          );
        })}
      </div>

      {zichtbaar.length > 0 && (
        <div style={css('display: flex; flex-direction: column; gap: 10px;')}>
          {zichtbaar.map((d) => (
            <div key={d.id} style={css('display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 15px 18px; border: 1px solid #E1EAE4; border-radius: 16px; background: #F7F9F8;')}>
              <span style={css(`
                  flex-shrink: 0;
                  padding: 7px 11px;
                  border-radius: 9px;
                  background: ${WORD_STIJL.bg};
                  color: ${WORD_STIJL.color};
                  font-size: 11px;
                  font-weight: 800;
                  letter-spacing: 0.04em;
                `)}
              >
                {WORD_STIJL.label}
              </span>

              <button
                type="button"
                onClick={() => openInChat(d)}
                style={css('cursor: pointer; flex: 1 1 220px; min-width: 0; border: none; background: none; padding: 0; text-align: left;')}
              >
                <span style={css("display: block; font-family: 'Mulish', sans-serif; font-size: 14.5px; font-weight: 700; color: #2C4A5E; overflow-wrap: anywhere;")}>
                  {d.naam}
                </span>
                <span style={css("display: block; margin-top: 3px; font-family: 'Mulish', sans-serif; font-size: 12.5px; color: #7B8985;")}>
                  {[
                    d.soort || 'Overig',
                    d.versie ? `versie ${d.versie}` : '',
                    d.context && d.context.fonds ? `voor ${d.context.fonds}` : '',
                    d.vervangen ? 'vervangen door een nieuwere versie' : '',
                    d.projectNaam,
                    'openen in de chat',
                  ]
                    .filter(Boolean)
                    .join('  ·  ')}
                </span>
              </button>

              <span style={css('display: flex; align-items: center; gap: 14px; flex-shrink: 0; flex-wrap: wrap;')}>
                <ExportMenu
                  toegestaan={paid}
                  uitlijnen="rechts"
                  onMelding={(tekst) => setMelding(tekst)}
                  ariaLabel={`${d.naam} exporteren`}
                  bouwModel={opgeslagenDocumentExport({ doc: d, store })}
                />
              </span>
            </div>
          ))}
        </div>
      )}

      {!alle.length && (
        <EmptyState title="Nog geen documenten"
          text="Vraag Subsidie Kompas om een projectplan, begroting of aanvraag op te maken en sla het resultaat op bij een project. Het document komt daarna hier te staan."
        />
      )}

      {alle.length > 0 && !zichtbaar.length && (
        <div style={css('padding: 16px; border: 1px dashed #D5E0D9; border-radius: 16px; font-size: 14.5px; color: #7B8985;')}>
          Geen documenten van dit type.
        </div>
      )}

      <Notice>{melding}</Notice>
    </Panel>
  );
}
