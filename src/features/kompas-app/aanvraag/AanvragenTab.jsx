// Documenten › Aanvragen: per fonds één aanvraag. Het overzicht toont per fonds of de criteria klaar zijn, of er een versie in concept is en wat de laatste
// beoordeling was. Een nieuwe aanvraag begint bij het fonds en de bron van de criteria; daarna controleert het lid de criteria en kiest het: schrijven en/of beoordelen.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { Button } from '../../../shared/ui/index.js';
import { Blok, Chip, Leeg, Melding, Rij, Rijen } from '../../../shared/ui/werkplek.jsx';
import { haalAanvragen } from '../../../data/services/aanvraagAssistent.js';
import { AanvraagStijl, Bezig, PrivaatfondsKaart, ProjectKeuze, RuimteBlok } from './Bouwstenen.jsx';
import AanvraagWerk from './AanvraagWerk.jsx';
import NieuweAanvraag from './NieuweAanvraag.jsx';
import ProjectplanTab from './ProjectplanTab.jsx';
import { aanvraagBadges, datumTekst, splitsAanvragen } from './aanvraagModel.js';

// Eén tabblad "Projectplan en indienen": met metProjectplan staat het projectplan bovenaan en daaronder de fondsen waar het lid indient.
// Het lid dient zelf in bij het fonds; Subsidie Kompas helpt met de tekst en de stukken.
// start: { fonds?, aanvraagId?, nonce } (alleen nog nodig als een ander scherm direct een aanvraag wil openen).
export default function AanvragenTab({ project, projecten, onKiesProject, store, assistent, start, metProjectplan = false, onNaarProjectinhoud }) {
  const projectId = project ? project.id : '';
  const [lijst, setLijst] = useState(null);
  const [fout, setFout] = useState('');
  const [scherm, setScherm] = useState({ naam: 'lijst' });
  const huidig = useRef('');
  const laatsteStart = useRef(null);

  huidig.current = projectId;

  const laad = useCallback(async () => {
    if (!projectId) return;

    const r = await haalAanvragen(projectId);

    if (huidig.current !== projectId) return;

    if (r.ok) {
      setLijst(r.antwoord.aanvragen || []);
      setFout('');
    } else {
      setLijst([]);
      setFout(r.melding);
    }
  }, [projectId]);

  useEffect(() => {
    setLijst(null);
    setScherm({ naam: 'lijst' });
    laad();
  }, [laad]);

  // Een verzoek vanuit het tabblad Projectplan: een nieuw fonds beginnen, of een bestaande aanvraag openen.
  useEffect(() => {
    if (!start || start === laatsteStart.current) return;

    laatsteStart.current = start;

    if (start.aanvraagId) setScherm({ naam: 'werk', aanvraagId: start.aanvraagId });
    else setScherm({ naam: 'nieuw', fonds: start.fonds || '', website: start.website || '' });
  }, [start]);

  const naarLijst = () => {
    setScherm({ naam: 'lijst' });
    laad();
  };

  if (!project) return <Leeg>Kies eerst een project.</Leeg>;

  if (scherm.naam === 'nieuw') {
    return (
      <NieuweAanvraag
        project={project}
        fondsStart={scherm.fonds}
        websiteStart={scherm.website || ''}
        assistent={assistent}
        onTerug={naarLijst}
        onKlaar={(r) => setScherm({ naam: 'werk', aanvraagId: r.aanvraagId, fondsLabel: r.fondsLabel, voorlopig: r.voorlopig })}
      />
    );
  }

  if (scherm.naam === 'werk') {
    return <AanvraagWerk key={scherm.aanvraagId || scherm.fondsLabel} project={project} aanvraagId={scherm.aanvraagId} fondsLabel={scherm.fondsLabel} voorlopig={scherm.voorlopig} assistent={assistent} store={store} onTerug={naarLijst} onGewijzigd={laad} />;
  }

  const { fondsen } = splitsAanvragen(lijst);

  const fondsenBlok = (
    <Blok
      titel={metProjectplan ? 'Fondsen waar u indient' : 'Aanvragen voor dit project'}
      aantal={lijst ? fondsen.length : undefined}
      testid="aa-aanvragen-lijst"
      actie={
        <Button size="s" onClick={() => setScherm({ naam: 'nieuw', fonds: '' })} ariaLabel="Nieuwe aanvraag">
          {metProjectplan ? '+ Fonds toevoegen' : '+ Nieuwe aanvraag'}
        </Button>
      }
    >
      <p className="fwk-aa-klein" style={css('margin: 0 0 12px;')}>
        {metProjectplan ? 'U dient zelf in bij het fonds. Wij helpen u met de tekst en de stukken. Per fonds bewaren we de criteria, uw versie en de beoordeling bij elkaar.' : 'Per fonds bewaren we de criteria, uw versie en de beoordeling bij elkaar.'}
      </p>
      {lijst === null && <Bezig>De aanvragen worden opgehaald.</Bezig>}
      {fout && <Melding toon="waarschuwing">{fout}</Melding>}
      {lijst !== null && !fout && !fondsen.length && (
        <Leeg testid="aa-aanvragen-leeg" actie={<button type="button" className="fwk-wp-link" onClick={() => setScherm({ naam: 'nieuw', fonds: '' })}>Begin met uw eerste aanvraag</button>}>
          Nog geen aanvragen voor dit project.
        </Leeg>
      )}
      <Rijen label="Aanvragen">
        {fondsen.map((a) => (
          <Rij
            key={a.id}
            testid="aa-rij-aanvraag"
            titel={a.fondsLabel || 'Fonds'}
            sub={`${a.aantalCriteria} ${a.aantalCriteria === 1 ? 'criterium' : 'criteria'} · bijgewerkt op ${datumTekst(a.bijgewerkt) || 'onbekende datum'}`}
            onOpen={() => setScherm({ naam: 'werk', aanvraagId: a.id })}
            eind={
              <span className="fwk-aa-chips" style={css('margin: 0; justify-content: flex-end;')}>
                {aanvraagBadges(a).map((b) => (
                  <Chip key={b.tekst} toon={b.toon}>
                    {b.tekst}
                  </Chip>
                ))}
              </span>
            }
          />
        ))}
      </Rijen>
    </Blok>
  );

  if (metProjectplan) {
    return (
      <ProjectplanTab
        ingebed
        project={project}
        projecten={projecten}
        onKiesProject={onKiesProject}
        store={store}
        assistent={assistent}
        onNieuweAanvraag={(fonds, website) => setScherm({ naam: 'nieuw', fonds: fonds || '', website: website || '' })}
        onOpenAanvraag={(id) => setScherm({ naam: 'werk', aanvraagId: id })}
        onNaarProjectinhoud={onNaarProjectinhoud}
        fondsenBlok={fondsenBlok}
        rechtsExtra={<PrivaatfondsKaart fondsLabel="" />}
      />
    );
  }

  return (
    <div data-testid="aa-aanvragen">
      <AanvraagStijl />
      <ProjectKeuze projecten={projecten} projectId={projectId} onKies={onKiesProject} />

      <div className="fwk-wp-kolommen">
        <div className="fwk-wp-stapel">{fondsenBlok}</div>

        <div className="fwk-wp-stapel">
          <RuimteBlok status={assistent.status} />
          <PrivaatfondsKaart fondsLabel="" />
        </div>
      </div>
    </div>
  );
}
