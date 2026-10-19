// Documenten › Projectplan: een algemeen projectplan schrijven (bruikbaar bij elk fonds) of meteen een versie toespitsen op één fonds.
// Het plan wordt door de server geschreven uit de Projectgegevens, de Projectdocumentatie en het Organisatieprofiel van dit project. Wat daar niet
// staat, wordt een [aanvullen] met een vraag; er wordt niets verzonnen. Elke keer schrijven telt mee in de maandruimte van het abonnement.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { color } from '../../../shared/tokens.js';
import { Button } from '../../../shared/ui/index.js';
import { Blok, Chip, Leeg, Melding, Rij, Rijen } from '../../../shared/ui/werkplek.jsx';
import { haalAanvraag, haalAanvragen, schrijfProjectplan } from '../../../data/services/aanvraagAssistent.js';
import { AanvraagStijl, Bezig, Keuzekaart, ProjectKeuze, RuimteBlok } from './Bouwstenen.jsx';
import PlanEditor from './PlanEditor.jsx';
import { datumTekst, heeftPlanRuimte, splitsAanvragen } from './aanvraagModel.js';

export default function ProjectplanTab({ project, projecten, onKiesProject, store, assistent, onNieuweAanvraag, onOpenAanvraag, onNaarProjectinhoud }) {
  const projectId = project ? project.id : '';
  const [lijst, setLijst] = useState(null);
  const [lijstFout, setLijstFout] = useState('');
  const [fonds, setFonds] = useState('');
  const [open, setOpen] = useState(null); // { plan, opgeslagen }
  const [bezig, setBezig] = useState('');
  const [fout, setFout] = useState(null); // { melding, reden }
  const [bevestig, setBevestig] = useState(false);
  const huidig = useRef('');

  huidig.current = projectId;

  const laad = useCallback(async () => {
    if (!projectId) return;

    const r = await haalAanvragen(projectId);

    if (huidig.current !== projectId) return;

    if (r.ok) {
      setLijst(r.antwoord.aanvragen || []);
      setLijstFout('');
    } else {
      setLijst([]);
      setLijstFout(r.melding);
    }
  }, [projectId]);

  useEffect(() => {
    setLijst(null);
    setOpen(null);
    setFout(null);
    setBevestig(false);
    laad();
  }, [laad]);

  const { algemeen, fondsen } = splitsAanvragen(lijst);
  const metPlan = fondsen.filter((a) => a.heeftPlan);
  const ruimte = heeftPlanRuimte(assistent.status);

  const schrijf = async () => {
    setFout(null);
    setBevestig(false);
    setBezig('Het plan wordt geschreven. Dit kan een minuut duren.');

    const r = await schrijfProjectplan({ projectId });

    if (huidig.current !== projectId) return;

    setBezig('');

    if (!r.ok) {
      setFout({ melding: r.melding, reden: r.reden });
      assistent.ververs();

      return;
    }

    setOpen({ plan: r.antwoord.plan, opgeslagen: r.antwoord.opgeslagen !== false });
    assistent.ververs();
    laad();
  };

  const start = () => {
    if (algemeen && algemeen.heeftPlan && !bevestig) {
      setBevestig(true);

      return;
    }

    schrijf();
  };

  const openAlgemeen = async () => {
    if (!algemeen) return;

    setFout(null);
    setBezig('Het plan wordt geopend.');

    const r = await haalAanvraag(algemeen.id);

    setBezig('');

    if (!r.ok || !r.antwoord.aanvraag || !r.antwoord.aanvraag.plan) {
      setFout({ melding: r.ok ? 'Dit plan is niet gevonden.' : r.melding, reden: r.reden });

      return;
    }

    setOpen({ plan: r.antwoord.aanvraag.plan, opgeslagen: true });
  };

  const naarFonds = () => {
    onNieuweAanvraag(fonds.trim());
  };

  if (open) {
    return (
      <>
        <AanvraagStijl />
        <PlanEditor plan={open.plan} opgeslagen={open.opgeslagen} titel={project ? `Projectplan ${project.naam || ''}`.trim() : 'Projectplan'} kop="Algemeen projectplan" projectNaam={project && project.naam} store={store} onSluit={() => setOpen(null)} />
      </>
    );
  }

  return (
    <div data-testid="aa-projectplan">
      <AanvraagStijl />
      <ProjectKeuze projecten={projecten} projectId={projectId} onKies={onKiesProject} />

      <div className="fwk-wp-kolommen">
        <div className="fwk-wp-stapel">
          <div className="fwk-aa-keuzes">
            <Keuzekaart titel="Algemeen projectplan" accent testid="aa-kaart-algemeen">
              <p>Een plan dat bij elk fonds bruikbaar is. U hoeft nog geen fonds te kiezen.</p>
              <div className="fwk-aa-klein">Opbouw: aanleiding, doelgroep, aanpak, resultaat, planning, organisatie, financiering en borging.</div>

              {bevestig && (
                <Melding toon="waarschuwing" testid="aa-bevestig-plan">
                  <span>
                    U heeft al een algemeen plan. Een nieuw plan vervangt het en telt als een van uw plannen deze maand.
                    <span style={css('display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;')}>
                      <Button size="s" variant="dark" onClick={schrijf}>
                        Ja, schrijf een nieuw plan
                      </Button>
                      <Button size="s" variant="outline" onClick={() => setBevestig(false)}>
                        Annuleren
                      </Button>
                    </span>
                  </span>
                </Melding>
              )}

              <div className="fwk-aa-onder">
                <Button onClick={start} disabled={Boolean(bezig) || !ruimte || !projectId} variant="primary" ariaLabel="Start algemeen plan">
                  {algemeen && algemeen.heeftPlan ? 'Schrijf een nieuw algemeen plan' : 'Start algemeen plan'}
                </Button>
                {!ruimte && <span className="fwk-aa-klein">Deze maand is uw ruimte voor plannen op.</span>}
              </div>
              {bezig && <Bezig>{bezig}</Bezig>}
            </Keuzekaart>

            <Keuzekaart titel="Toegespitst op een fonds" testid="aa-kaart-fonds">
              <p>Het plan volgt de vragen en criteria van één fonds. We beginnen met de criteria van dat fonds op een rij te zetten.</p>
              <div>
                <label htmlFor="aa-fonds-plan" className="fwk-aa-label">
                  Welk fonds?
                </label>
                <input id="aa-fonds-plan" data-testid="aa-fonds-plan" className="fwk-aa-veld" type="text" value={fonds} maxLength={200} onChange={(e) => setFonds(e.target.value)} placeholder="Bijvoorbeeld Stichting Voorbeeldfonds" />
              </div>
              <div className="fwk-aa-onder">
                <Button variant="dark" onClick={naarFonds} disabled={fonds.trim().length < 2 || !projectId} ariaLabel="Kies fonds en maak criteria">
                  Kies fonds en maak criteria →
                </Button>
              </div>
            </Keuzekaart>
          </div>

          {fout && (
            <Melding toon={fout.reden === 'te-weinig-info' ? 'info' : 'fout'} testid="aa-plan-fout">
              <span>
                {fout.melding}
                {fout.reden === 'te-weinig-info' && onNaarProjectinhoud && (
                  <>
                    {' '}
                    <button type="button" className="fwk-wp-link" onClick={onNaarProjectinhoud}>
                      Naar de projectinhoud
                    </button>
                  </>
                )}
              </span>
            </Melding>
          )}

          <Blok titel="Uw plannen" testid="aa-plannen">
            {lijst === null && <Bezig>Uw plannen worden opgehaald.</Bezig>}
            {lijstFout && <Melding toon="waarschuwing">{lijstFout}</Melding>}
            {lijst !== null && !lijstFout && !algemeen?.heeftPlan && !metPlan.length && <Leeg testid="aa-plannen-leeg">Nog geen plannen voor dit project.</Leeg>}
            <Rijen label="Plannen">
              {algemeen && algemeen.heeftPlan && (
                <Rij
                  testid="aa-rij-algemeen"
                  titel="Algemeen projectplan"
                  sub={`Bijgewerkt op ${datumTekst(algemeen.planBijgewerkt) || 'onbekende datum'}`}
                  onOpen={openAlgemeen}
                  eind={<Chip toon="blauw">Concept</Chip>}
                />
              )}
              {metPlan.map((a) => (
                <Rij
                  key={a.id}
                  testid="aa-rij-fondsplan"
                  titel={a.fondsLabel || 'Fonds'}
                  sub="Toegespitst op dit fonds. Staat ook onder Aanvragen."
                  onOpen={() => onOpenAanvraag(a.id)}
                  eind={<Chip toon="blauw">Concept</Chip>}
                />
              ))}
            </Rijen>
          </Blok>
        </div>

        <div className="fwk-wp-stapel">
          <RuimteBlok status={assistent.status} />
          <Blok titel="Waar we het plan op baseren" testid="aa-baseren">
            <ul className="fwk-aa-lijst" style={css('padding: 0;')}>
              {['Projectgegevens', 'Projectdocumentatie', 'Organisatieprofiel'].map((t) => (
                <li key={t} style={css('display: flex; align-items: center; gap: 10px; padding: 7px 0; border: none; font-size: 15px;')}>
                  <span aria-hidden="true" style={css(`width: 22px; height: 22px; border-radius: 50%; background: ${color.vlakGroen}; color: ${color.succes}; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800;`)}>
                    ✓
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </Blok>
        </div>
      </div>
    </div>
  );
}
