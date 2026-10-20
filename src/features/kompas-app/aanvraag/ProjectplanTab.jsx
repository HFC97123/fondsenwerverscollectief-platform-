// Documenten › Projectplan: een algemeen projectplan schrijven (bruikbaar bij elk fonds) of meteen een versie toespitsen op één fonds.
// Het plan wordt door de server geschreven uit de Projectgegevens, de Projectdocumentatie en het Organisatieprofiel van dit project. Wat daar niet
// staat, wordt een [aanvullen] met een vraag; er wordt niets verzonnen. Het algemene plan wordt één keer per project geschreven, en pas als de voortgangsmeter
// op 100% staat (alle kerninformatie is ingevuld). Daarna werkt het lid het zelf verder bij (kopiëren of downloaden). Een versie voor een fonds telt bij de beoordelingen.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { color } from '../../../shared/tokens.js';
import { Button } from '../../../shared/ui/index.js';
import { Blok, Chip, Leeg, Melding, Rij, Rijen } from '../../../shared/ui/werkplek.jsx';
import { haalAanvraag, haalAanvragen, haalPlanGereedheid, schrijfProjectplan } from '../../../data/services/aanvraagAssistent.js';
import { AanvraagStijl, Bezig, Keuzekaart, ProjectKeuze, RuimteBlok } from './Bouwstenen.jsx';
import PlanEditor from './PlanEditor.jsx';
import { datumTekst, splitsAanvragen } from './aanvraagModel.js';

export default function ProjectplanTab({ project, projecten, onKiesProject, store, assistent, onNieuweAanvraag, onOpenAanvraag, onNaarProjectinhoud }) {
  const projectId = project ? project.id : '';
  const [lijst, setLijst] = useState(null);
  const [lijstFout, setLijstFout] = useState('');
  const [fonds, setFonds] = useState('');
  const [open, setOpen] = useState(null); // { plan, opgeslagen }
  const [bezig, setBezig] = useState('');
  const [fout, setFout] = useState(null); // { melding, reden }
  const [bevestig, setBevestig] = useState(false);
  const [stand, setStand] = useState(null); // { gereedheid, projectKlaar, plannen } van de server; null = nog niet bekend
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

  const laadStand = useCallback(async () => {
    if (!projectId) return;

    const r = await haalPlanGereedheid(projectId);

    if (huidig.current !== projectId) return;

    setStand(r.ok ? r.antwoord : { fout: true });
  }, [projectId]);

  useEffect(() => {
    setLijst(null);
    setStand(null);
    setOpen(null);
    setFout(null);
    setBevestig(false);
    laad();
    laadStand();
  }, [laad, laadStand]);

  const { algemeen, fondsen } = splitsAanvragen(lijst);
  const metPlan = fondsen.filter((a) => a.heeftPlan);
  const gereedheid = stand && stand.gereedheid ? stand.gereedheid : null;
  const klaarVoorPlan = Boolean(gereedheid && gereedheid.klaar);
  const planGeschreven = Boolean((stand && stand.projectKlaar) || (algemeen && algemeen.heeftPlan));
  const plannen = stand && stand.plannen ? stand.plannen : null;
  const limietBereikt = Boolean(!planGeschreven && plannen && plannen.resterend === 0);
  const isPro = assistent.status && assistent.status.tier === 'pro';

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
      laadStand();

      return;
    }

    setOpen({ plan: r.antwoord.plan, opgeslagen: r.antwoord.opgeslagen !== false });
    assistent.ververs();
    laad();
    laadStand();
  };

  // Het plan wordt maar één keer geschreven: eerst een bevestiging.
  const start = () => {
    if (!bevestig) {
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
        <PlanEditor plan={open.plan} opgeslagen={open.opgeslagen} titel={project ? `Projectplan ${project.naam || ''}`.trim() : 'Projectplan'} kop="Projectplan" projectNaam={project && project.naam} store={store} onSluit={() => setOpen(null)} />
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
            <Keuzekaart titel="Projectplan" accent testid="aa-kaart-algemeen">
              <p>Eén plan per project, geschreven door de AI.</p>

              {!planGeschreven && gereedheid && (
                <div data-testid="aa-meter" style={css('margin-top: 12px;')}>
                  <div className="fwk-aa-regel">
                    <span>Projectinformatie compleet</span>
                    <b data-testid="aa-meter-percentage">{gereedheid.percentage}%</b>
                  </div>
                  <div className="fwk-aa-balk" role="progressbar" aria-label="Projectinformatie compleet" aria-valuemin={0} aria-valuemax={100} aria-valuenow={gereedheid.percentage}>
                    <div style={{ width: `${gereedheid.percentage}%` }} />
                  </div>
                  {!gereedheid.klaar && (
                    <>
                      <div className="fwk-aa-klein" style={css('margin-bottom: 6px;')}>Nog nodig:</div>
                      <ul className="fwk-aa-lijst" data-testid="aa-meter-mist" style={css('padding: 0;')}>
                        {gereedheid.onderdelen
                          .filter((o) => !o.gevuld)
                          .map((o) => (
                            <li key={o.id} style={css('display: block; padding: 6px 0; border: none; font-size: 14.5px;')}>
                              <b>{o.label}</b> <span className="fwk-aa-klein">({o.waar})</span>
                            </li>
                          ))}
                      </ul>
                      {onNaarProjectinhoud && (
                        <button type="button" className="fwk-wp-link" onClick={onNaarProjectinhoud}>
                          Naar de projectinhoud
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

              {planGeschreven && (
                <div className="fwk-aa-klein" data-testid="aa-plan-klaar" style={css('margin-top: 10px;')}>
                  Plan geschreven. Opnieuw schrijven kan niet.
                </div>
              )}

              {limietBereikt && (
                <Melding toon="info" testid="aa-plan-limiet">
                  {isPro ? 'Pro: één project met een plan. Meer projecten kan met Premium.' : 'Maximum aantal projecten met een plan bereikt.'}
                </Melding>
              )}

              {bevestig && (
                <Melding toon="waarschuwing" testid="aa-bevestig-plan">
                  <span>
                    Het plan wordt één keer geschreven. Doorgaan?
                    <span style={css('display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;')}>
                      <Button size="s" variant="dark" onClick={schrijf}>
                        Ja, schrijf het plan
                      </Button>
                      <Button size="s" variant="outline" onClick={() => setBevestig(false)}>
                        Annuleren
                      </Button>
                    </span>
                  </span>
                </Melding>
              )}

              <div className="fwk-aa-onder">
                {planGeschreven ? (
                  <Button onClick={openAlgemeen} disabled={Boolean(bezig) || !algemeen} variant="primary" ariaLabel="Open het projectplan">
                    Open het projectplan
                  </Button>
                ) : (
                  <Button onClick={start} disabled={Boolean(bezig) || !klaarVoorPlan || limietBereikt || !projectId} variant="primary" ariaLabel="Start algemeen plan">
                    Schrijf mijn projectplan
                  </Button>
                )}
                {!planGeschreven && gereedheid && !klaarVoorPlan && !limietBereikt && <span className="fwk-aa-klein">Beschikbaar bij 100%.</span>}
              </div>
              {bezig && <Bezig>{bezig}</Bezig>}
            </Keuzekaart>

            <Keuzekaart titel="Fondsbeoordeling" testid="aa-kaart-fonds">
              <p>Beoordeel uw aanvraag voor een fonds.</p>
              <div>
                <label htmlFor="aa-fonds-plan" className="fwk-aa-label">
                  Welk fonds?
                </label>
                <input id="aa-fonds-plan" data-testid="aa-fonds-plan" className="fwk-aa-veld" type="text" value={fonds} maxLength={200} onChange={(e) => setFonds(e.target.value)} placeholder="Bijvoorbeeld Stichting Voorbeeldfonds" />
              </div>
              <div className="fwk-aa-onder">
                <Button variant="dark" onClick={naarFonds} disabled={fonds.trim().length < 2 || !projectId} ariaLabel="Kies fonds en maak criteria">
                  Kies fonds →
                </Button>
              </div>
            </Keuzekaart>
          </div>

          {fout && (
            <Melding toon={fout.reden === 'te-weinig-info' || fout.reden === 'onvolledig' || fout.reden === 'al-geschreven' ? 'info' : 'fout'} testid="aa-plan-fout">
              <span>
                {fout.melding}
                {(fout.reden === 'te-weinig-info' || fout.reden === 'onvolledig') && onNaarProjectinhoud && (
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
            {lijst !== null && !lijstFout && !algemeen?.heeftPlan && !metPlan.length && <Leeg testid="aa-plannen-leeg">Nog geen plannen.</Leeg>}
            <Rijen label="Plannen">
              {algemeen && algemeen.heeftPlan && (
                <Rij
                  testid="aa-rij-algemeen"
                  titel="Projectplan"
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
                  sub="Fondsversie"
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
