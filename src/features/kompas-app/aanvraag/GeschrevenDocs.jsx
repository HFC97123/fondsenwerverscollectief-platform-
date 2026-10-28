// Projectdocumentatie: wat Subsidie Kompas voor het project schreef, als gewone regels in de lijst van documenten.
//   - Concept projectplan en de concepten per fonds staan onder Projectplan, de begroting onder Begroting, het dekkingsplan onder Concept-dekkingsplan.
//   - Het plan zelf bewaart de server (bij de aanvraag van het project); hier wordt het alleen gelezen en getoond. Er wordt niets dubbel opgeslagen.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { Button } from '../../../shared/ui/index.js';
import ExportMenu from '../../../shared/ui/ExportMenu.jsx';
import { bouwDocumentModel } from '../../../shared/export/exportModel.js';
import { Melding } from '../../../shared/ui/werkplek.jsx';
import { haalAanvraag, haalAanvragen } from '../../../data/services/aanvraagAssistent.js';
import { haalDekkingsplan } from '../../../data/services/projectFinanciering.js';
import { haalDefinitieveDocumenten, haalDefinitiefDocument } from '../../../data/services/definitieveDocumenten.js';
import { AanvraagStijl, Bezig } from './Bouwstenen.jsx';
import PlanEditor from './PlanEditor.jsx';
import { definitieveDocsVoorLijst, geschrevenDocs, planNaarTekst, splitsAanvragen } from './aanvraagModel.js';

// Laadt per project het concept projectplan, de concepten per fonds en het aantal regels van het dekkingsplan, en maakt er regels van.
// actief: alleen laden als het tabblad Projectdocumentatie openstaat (en opnieuw bij elk bezoek, zodat een net geschreven plan er direct staat).
// metPlan: er is een aanvraag-assistent (Pro/Premium); zonder die zijn er alleen de begroting en het dekkingsplan.
export function useGeschrevenDocs({ projecten, metPlan, actief }) {
  const [docs, setDocs] = useState([]);
  const sleutel = (projecten || []).map((p) => `${p.id}:${Array.isArray(p.budgetRegels) ? p.budgetRegels.length : '-'}`).join('|');
  const teller = useRef(0);

  useEffect(() => {
    if (!actief) return undefined;

    const mijn = ++teller.current;
    let weg = false;

    Promise.all(
      (projecten || []).map(async (p) => {
        let aanvragen = null;
        let dekking = 0;

        try {
          if (metPlan) {
            const r = await haalAanvragen(p.id);

            if (r && r.ok) aanvragen = r.antwoord.aanvragen || [];
          }

          const d = await haalDekkingsplan(p.id);

          if (d && !d.error && Array.isArray(d.regels)) dekking = d.regels.length;
        } catch (e) {
          /* wat niet lukt, blijft weg; de rest van de lijst blijft staan */
        }

        return geschrevenDocs(p, aanvragen, dekking);
      }),
    ).then((rijen) => {
      if (!weg && mijn === teller.current) setDocs(rijen.flat());
    });

    return () => {
      weg = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sleutel, metPlan, actief]);

  return docs;
}

// De definitieve versies van de projecten. ververs(): opnieuw laden (na Maak definitief of Verwijderen).
export function useDefinitieveDocs({ projecten, actief }) {
  const [docs, setDocs] = useState([]);
  const [nu, setNu] = useState(0);
  const sleutel = (projecten || []).map((p) => p.id).join('|');
  const teller = useRef(0);

  useEffect(() => {
    if (!actief) return undefined;

    const mijn = ++teller.current;
    let weg = false;

    haalDefinitieveDocumenten((projecten || []).map((p) => p.id))
      .then((rijen) => {
        if (!weg && mijn === teller.current) setDocs(definitieveDocsVoorLijst(rijen, projecten));
      })
      .catch(() => undefined);

    return () => {
      weg = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sleutel, actief, nu]);

  const ververs = useCallback(() => setNu((n) => n + 1), []);

  return { docs, ververs };
}

async function leesPlan(aanvraagId) {
  const r = await haalAanvraag(aanvraagId);

  return r.ok && r.antwoord.aanvraag && r.antwoord.aanvraag.plan ? r.antwoord.aanvraag.plan : null;
}

// Het geopende concept: het plan met export, en de weg terug naar Aanvraag indienen.
// aanvraagId, of algemeen: dan zoekt dit scherm zelf het concept projectplan van het project (net geschreven). nieuw: toon de melding waar het is bewaard.
export function PlanVenster({ project, aanvraagId = '', algemeen = false, definitiefId = '', nieuw = false, store, onSluit, onNaarIndienen }) {
  const [plan, setPlan] = useState(null);
  const [versie, setVersie] = useState(0);
  const [fout, setFout] = useState('');
  const projectId = project ? project.id : '';

  useEffect(() => {
    let weg = false;

    setPlan(null);
    setFout('');
    setVersie(0);

    (async () => {
      if (definitiefId) {
        const d = await haalDefinitiefDocument(definitiefId);

        if (weg) return;

        if (d && d.inhoud && d.inhoud.plan) {
          setPlan(d.inhoud.plan);
          setVersie(d.versie);
        } else setFout('Dit document is niet gevonden. Probeer het opnieuw.');

        return;
      }

      let id = aanvraagId;

      if (!id && algemeen) {
        const l = await haalAanvragen(projectId);
        const a = l && l.ok ? splitsAanvragen(l.antwoord.aanvragen).algemeen : null;

        id = a && a.heeftPlan ? a.id : '';
      }

      const p = id ? await leesPlan(id) : null;

      if (weg) return;

      if (p) setPlan(p);
      else setFout('Dit concept is niet gevonden. Probeer het opnieuw.');
    })();

    return () => {
      weg = true;
    };
  }, [projectId, aanvraagId, algemeen, definitiefId]);

  const definitief = Boolean(definitiefId);
  const titel = `${definitief ? 'Projectplan' : 'Concept projectplan'} ${project && project.naam ? project.naam : ''}`.trim();

  return (
    <div data-testid="gb-plan-open">
      <AanvraagStijl />
      {!plan && !fout && <Bezig>Het plan wordt geopend.</Bezig>}
      {fout && (
        <div style={css('display: flex; gap: 10px; align-items: center; flex-wrap: wrap;')}>
          <Melding toon="waarschuwing">{fout}</Melding>
          <Button variant="outline" size="s" onClick={onSluit}>
            Terug naar de lijst
          </Button>
        </div>
      )}
      {plan && (
        <>
          {definitief && (
            <div style={css('margin-bottom: 14px;')}>
              <Melding toon="info" testid="gb-definitief-info">
                Dit is een vaste kopie. Wijzigingen in het concept veranderen deze versie niet.
              </Melding>
            </div>
          )}
          {nieuw && (
            <div style={css('margin-bottom: 14px;')}>
              <Melding toon="succes" testid="gb-nieuw">
                Uw projectplan is geschreven en bewaard onder Projectdocumentatie › Projectplan. U vindt het hier altijd terug.
              </Melding>
            </div>
          )}
          <PlanEditor
            plan={plan}
            opgeslagen
            titel={titel}
            kop={definitief ? `Projectplan · definitief${versie ? `, versie ${versie}` : ""}` : 'Concept projectplan'}
            projectNaam={project && project.naam}
            store={store}
            onSluit={onSluit}
            extraActies={
              onNaarIndienen && (
                <Button variant="dark" size="s" onClick={() => onNaarIndienen()} testid="gb-naar-indienen">
                  Naar Aanvraag indienen
                </Button>
              )
            }
          />
        </>
      )}
    </div>
  );
}

// De export van een geschreven document; een concept voor een fonds is er niet (die staat in Aanvraag indienen).
// De begroting en het dekkingsplan zijn Excel (zie ExcelKnop in DefinitieveDocs.jsx); alleen het plan gaat via het exportmenu.
export function geschrevenExport({ doc, store }) {
  if (doc.gegenereerd === 'plan') {
    return async () => {
      const plan = await leesPlan(doc.aanvraagId);

      if (!plan) return null;

      const titel = `Concept projectplan ${doc.projectNaam || ''}`.trim();

      return bouwDocumentModel({ tekst: planNaarTekst(plan, titel), soort: 'Projectplan', organisatieNaam: (store && store.orgProfile && store.orgProfile.name) || null, projectNaam: doc.projectNaam, titel });
    };
  }

  if (doc.gegenereerd === 'definitief' && doc.definitiefSoort === 'projectplan') {
    return async () => {
      const d = await haalDefinitiefDocument(doc.definitiefId);

      if (!d || !d.inhoud || !d.inhoud.plan) return null;

      const titel = `Projectplan ${doc.projectNaam || ''}`.trim();

      return bouwDocumentModel({ tekst: planNaarTekst(d.inhoud.plan, titel), soort: 'Projectplan', organisatieNaam: (store && store.orgProfile && store.orgProfile.name) || null, projectNaam: doc.projectNaam, titel });
    };
  }

  return null;
}

export { leesPlan };
