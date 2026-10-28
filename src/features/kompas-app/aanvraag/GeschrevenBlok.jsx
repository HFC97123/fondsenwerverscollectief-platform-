// Indienen › Projectdocumentatie: wat Subsidie Kompas voor dit project heeft geschreven, op één plek terug te vinden.
//   - Projectplan: het plan dat in Aanvraag indienen is geschreven (en de versies per fonds). Openen, exporteren (Word, PDF) en terug naar Aanvraag indienen.
//   - Begroting en dekkingsplan: naar het tabblad Begroting en exporteren.
// Het plan zelf bewaart de server (bij de aanvraag van het project); hier wordt het alleen gelezen. Er wordt niets dubbel opgeslagen.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { Button } from '../../../shared/ui/index.js';
import ExportMenu from '../../../shared/ui/ExportMenu.jsx';
import { bouwDocumentModel } from '../../../shared/export/exportModel.js';
import { Blok, Chip, Melding, Rij, Rijen } from '../../../shared/ui/werkplek.jsx';
import { haalAanvraag, haalAanvragen } from '../../../data/services/aanvraagAssistent.js';
import { projectExport } from '../exportBronnen.js';
import { AanvraagStijl, Bezig } from './Bouwstenen.jsx';
import PlanEditor from './PlanEditor.jsx';
import { datumTekst, kortFondsLabel, planNaarTekst, splitsAanvragen } from './aanvraagModel.js';

// project: het project; assistent: de status van de aanvraag-assistent (zonder die is er geen projectplan, wel een begroting);
// openPlan: { nonce } als het plan direct geopend moet worden (net geschreven); onNaarIndienen(aanvraagId?) brengt het lid terug naar Aanvraag indienen.
export default function GeschrevenBlok({ project, store, assistent, openPlan = null, onNaarIndienen, kopMetProject = false }) {
  const projectId = project ? project.id : '';
  const metPlan = Boolean(assistent && assistent.beschikbaar);
  const [lijst, setLijst] = useState(null);
  const [fout, setFout] = useState('');
  const [open, setOpen] = useState(null); // { plan, opgeslagen, nieuw }
  const [bezig, setBezig] = useState('');
  const [melding, setMelding] = useState('');
  const huidig = useRef('');
  const laatsteOpen = useRef(null);

  huidig.current = projectId;

  const laad = useCallback(async () => {
    if (!projectId || !metPlan) return;

    const r = await haalAanvragen(projectId);

    if (huidig.current !== projectId) return;

    if (r.ok) {
      setLijst(r.antwoord.aanvragen || []);
      setFout('');
    } else {
      setLijst([]);
      setFout(r.melding || 'De plannen konden nu niet worden opgehaald.');
    }
  }, [projectId, metPlan]);

  useEffect(() => {
    setLijst(null);
    setOpen(null);
    setMelding('');
    laad();
  }, [laad]);

  const { algemeen, fondsen } = splitsAanvragen(lijst);
  const fondsMetPlan = fondsen.filter((a) => a.heeftPlan);
  const heeftAlgemeen = Boolean(algemeen && algemeen.heeftPlan);
  const titel = project ? `Concept projectplan ${project.naam || ''}`.trim() : 'Concept projectplan';

  const haalPlan = useCallback(async () => {
    if (!algemeen) return null;

    const r = await haalAanvraag(algemeen.id);

    return r.ok && r.antwoord.aanvraag && r.antwoord.aanvraag.plan ? r.antwoord.aanvraag.plan : null;
  }, [algemeen]);

  const openAlgemeen = useCallback(
    async (nieuw = false) => {
      setFout('');
      setBezig('Het plan wordt geopend.');

      const plan = await haalPlan();

      setBezig('');

      if (!plan) {
        setFout('Dit plan is niet gevonden. Probeer het opnieuw.');

        return;
      }

      setOpen({ plan, opgeslagen: true, nieuw });
    },
    [haalPlan],
  );

  // Net geschreven: het plan opent hier meteen, met de melding waar het bewaard is.
  useEffect(() => {
    if (!openPlan || openPlan === laatsteOpen.current || !algemeen || !heeftAlgemeen) return;

    laatsteOpen.current = openPlan;
    openAlgemeen(true);
  }, [openPlan, algemeen, heeftAlgemeen, openAlgemeen]);

  const exportPlan = async () => {
    const plan = await haalPlan();

    if (!plan) return null;

    return bouwDocumentModel({ tekst: planNaarTekst(plan, titel), soort: 'Projectplan', organisatieNaam: (store && store.orgProfile && store.orgProfile.name) || null, projectNaam: project && project.naam, titel });
  };

  if (!project) return null;

  if (open) {
    return (
      <div data-testid="gb-plan-open">
        <AanvraagStijl />
        {open.nieuw && (
          <div style={css('margin-bottom: 14px;')}>
            <Melding toon="succes" testid="gb-nieuw">
              Uw projectplan is geschreven en bewaard onder Projectdocumentatie › Projectplan. U vindt het hier altijd terug.
            </Melding>
          </div>
        )}
        <PlanEditor
          plan={open.plan}
          opgeslagen
          titel={titel}
          kop="Concept projectplan"
          projectNaam={project.naam}
          store={store}
          onSluit={() => setOpen(null)}
          extraActies={
            onNaarIndienen && (
              <Button variant="dark" size="s" onClick={() => onNaarIndienen()} testid="gb-naar-indienen">
                Naar Aanvraag indienen
              </Button>
            )
          }
        />
      </div>
    );
  }

  const begrotingHref = `#/kompas/documentatie?tab=begroting&project=${encodeURIComponent(projectId)}`;
  const aantalRegels = Array.isArray(project.budgetRegels) ? project.budgetRegels.length : 0;

  return (
    <div data-testid="gb-blok" style={css('display: flex; flex-direction: column; gap: 14px; margin-bottom: 22px;')}>
      <AanvraagStijl />
      {kopMetProject && <h3 style={css("margin: 0; font-family: 'Mulish', sans-serif; font-size: 15px; font-weight: 800; color: #2C4A5E;")}>{project.naam || 'Naamloos project'}</h3>}

      {metPlan && (
        <Blok titel="Projectplan" testid="gb-projectplan">
          {lijst === null && <Bezig>Uw plannen worden opgehaald.</Bezig>}
          {fout && <Melding toon="waarschuwing">{fout}</Melding>}
          {bezig && <Bezig>{bezig}</Bezig>}
          {melding && <Melding toon="info">{melding}</Melding>}

          {lijst !== null && !fout && !heeftAlgemeen && (
            <p className="fwk-aa-klein" data-testid="gb-plan-leeg" style={css('margin: 0;')}>
              Het concept projectplan is nog niet geschreven.{' '}
              {onNaarIndienen && (
                <button type="button" className="fwk-wp-link" onClick={() => onNaarIndienen()}>
                  Naar Aanvraag indienen
                </button>
              )}
            </p>
          )}

          {(heeftAlgemeen || fondsMetPlan.length > 0) && (
            <Rijen label="Projectplan en versies per fonds">
              {heeftAlgemeen && (
                <Rij
                  testid="gb-rij-plan"
                  titel="Concept projectplan"
                  sub={`Bijgewerkt op ${datumTekst(algemeen.planBijgewerkt) || 'onbekende datum'}`}
                  onOpen={() => openAlgemeen(false)}
                  eind={
                    <>
                      <Chip toon="blauw">Concept</Chip>
                      <ExportMenu toegestaan uitlijnen="rechts" onMelding={setMelding} ariaLabel="Projectplan exporteren" bouwModel={exportPlan} />
                    </>
                  }
                />
              )}
              {fondsMetPlan.map((a) => (
                <Rij
                  key={a.id}
                  testid="gb-rij-fondsversie"
                  titel={kortFondsLabel(a.fondsLabel) || 'Fonds'}
                  sub="Versie voor dit fonds"
                  onOpen={onNaarIndienen ? () => onNaarIndienen(a.id) : undefined}
                  eind={<Chip toon="blauw">Concept</Chip>}
                />
              ))}
            </Rijen>
          )}
        </Blok>
      )}

      <Blok titel="Begroting en dekkingsplan" testid="gb-begroting">
        <Rijen label="Begroting en dekkingsplan">
          <Rij
            testid="gb-rij-begroting"
            titel="Begroting en dekkingsplan"
            sub={aantalRegels > 0 ? `${aantalRegels} ${aantalRegels === 1 ? 'regel' : 'regels'} in de begroting` : 'Nog geen begroting ingevuld'}
            href={begrotingHref}
            eind={<ExportMenu toegestaan uitlijnen="rechts" onMelding={setMelding} ariaLabel="Begroting en dekkingsplan exporteren" bouwModel={projectExport({ projectId, store })} />}
          />
        </Rijen>
      </Blok>
    </div>
  );
}
