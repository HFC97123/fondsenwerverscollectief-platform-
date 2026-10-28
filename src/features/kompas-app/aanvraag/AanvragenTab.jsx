// Documenten › Aanvragen: per fonds één aanvraag. Het overzicht toont per fonds of de criteria klaar zijn, of er een versie in concept is en wat de laatste
// beoordeling was. Een nieuwe aanvraag begint bij het fonds en de bron van de criteria; daarna controleert het lid de criteria en kiest het: schrijven en/of beoordelen.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { Button } from '../../../shared/ui/index.js';
import { Blok, Chip, Leeg, Melding } from '../../../shared/ui/werkplek.jsx';
import { haalAanvragen } from '../../../data/services/aanvraagAssistent.js';
import { haalOrganisatieDocumentenOp } from '../../../data/services/organisatiedocumenten.js';
import { haalDekkingsplan } from '../../../data/services/projectFinanciering.js';
import { STATUS_LABEL as DP_STATUS, formatEuro, regelUitRpc } from '../financiering/dekkingsplan.js';
import { AanvraagStijl, Bezig, PrivaatfondsKaart, ProjectKeuze, RuimteBlok } from './Bouwstenen.jsx';
import AanvraagWerk from './AanvraagWerk.jsx';
import NieuweAanvraag from './NieuweAanvraag.jsx';
import ProjectplanTab from './ProjectplanTab.jsx';
import FondsKaart from './FondsKaart.jsx';
import { documentenLijst, fondsenUitDekkingsplan, splitsAanvragen } from './aanvraagModel.js';

// Eén tabblad "Aanvraag indienen": met metProjectplan staat het projectplan bovenaan en daaronder de fondsen waar het lid indient.
// Het lid dient zelf in bij het fonds; Subsidie Kompas helpt met de tekst en de stukken.
// start: { fonds?, aanvraagId?, nonce } (alleen nog nodig als een ander scherm direct een aanvraag wil openen).
export default function AanvragenTab({ project, projecten, onKiesProject, store, assistent, start, metProjectplan = false, onNaarProjectinhoud }) {
  const projectId = project ? project.id : '';
  // Per fonds werken (criteria, een versie voor een fonds, de aanvraag laten beoordelen) is er met Premium. Met Pro schrijft het lid het projectplan.
  // De server beslist (status.fondsbeoordeling); is die niet bekend, dan blijft het scherm zoals het was.
  const fondsToegang = !(assistent && assistent.status && assistent.status.fondsbeoordeling === false);
  const [lijst, setLijst] = useState(null);
  const [fout, setFout] = useState('');
  const [scherm, setScherm] = useState({ naam: 'lijst' });
  const [orgDocs, setOrgDocs] = useState([]);
  const [dpRegels, setDpRegels] = useState([]);
  const huidig = useRef('');
  const laatsteStart = useRef(null);

  huidig.current = projectId;

  const laad = useCallback(async () => {
    if (!projectId || !fondsToegang) return;

    const r = await haalAanvragen(projectId);

    if (huidig.current !== projectId) return;

    if (r.ok) {
      setLijst(r.antwoord.aanvragen || []);
      setFout('');
    } else {
      setLijst([]);
      setFout(r.melding);
    }
  }, [projectId, fondsToegang]);

  useEffect(() => {
    setLijst(null);
    setScherm({ naam: 'lijst' });
    laad();
  }, [laad]);

  // De bestanden uit het organisatieprofiel horen bij de stukken op de kaarten (ANBI-status, statuten, jaarverslag). Lukt dit niet, dan tellen alleen de projectbestanden.
  useEffect(() => {
    let weg = false;

    Promise.resolve()
      .then(() => haalOrganisatieDocumentenOp())
      .then((l) => {
        if (!weg && Array.isArray(l)) setOrgDocs(l);
      })
      .catch(() => undefined);

    return () => {
      weg = true;
    };
  }, []);

  // De fondsen uit het dekkingsplan van dit project staan onder de aanvragen, zodat het lid er met één klik een aanvraag voor begint. Lukt het ophalen niet, dan blijft dit blok weg.
  useEffect(() => {
    let weg = false;

    setDpRegels([]);

    if (!projectId || !fondsToegang) return undefined;

    Promise.resolve()
      .then(() => haalDekkingsplan(projectId))
      .then((r) => {
        if (!weg && r && !r.error && Array.isArray(r.regels)) setDpRegels(r.regels.map(regelUitRpc));
      })
      .catch(() => undefined);

    return () => {
      weg = true;
    };
  }, [projectId, fondsToegang]);

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
    return <AanvraagWerk key={scherm.aanvraagId || scherm.fondsLabel} project={project} startStap={scherm.stap || ''} aanvraagId={scherm.aanvraagId} fondsLabel={scherm.fondsLabel} voorlopig={scherm.voorlopig} assistent={assistent} store={store} onTerug={naarLijst} onGewijzigd={laad} />;
  }

  const { fondsen } = splitsAanvragen(lijst);
  const docsNu = documentenLijst(project.docs, orgDocs);
  const uitDekkingsplan = fondsenUitDekkingsplan(dpRegels, lijst);

  const fondsenBlok = !fondsToegang ? (
    <Blok titel={metProjectplan ? 'Fondsen waar u indient' : 'Aanvragen voor dit project'} testid="aa-fondsen-premium">
      <p className="fwk-aa-klein" style={css('margin: 0 0 12px;')}>
        Uw aanvraag per fonds laten beoordelen en een versie voor een fonds laten schrijven kan met Premium. Met Pro schrijft u uw projectplan en dient u zelf in bij het fonds.
      </p>
      <a className="fwk-wp-link" href="#/kompas/account" data-testid="aa-fondsen-premium-link">
        Bekijk Premium
      </a>
    </Blok>
  ) : (
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
      <div className="fwk-aa-kaarten" role="list" aria-label="Aanvragen">
        {fondsen.map((a) => (
          <div key={a.id} role="listitem">
            <FondsKaart aanvraag={a} docs={docsNu} onOpen={(aanvraag, stapId) => setScherm({ naam: 'werk', aanvraagId: aanvraag.id, stap: stapId || '' })} />
          </div>
        ))}
      </div>
      {lijst !== null && !fout && uitDekkingsplan.length > 0 && (
        <div data-testid="aa-uit-dekkingsplan" style={css('margin-top: 22px;')}>
          <h3 className="fwk-aa-kaart-titel">Fondsen uit uw dekkingsplan</h3>
          <p className="fwk-aa-klein" style={css('margin: 0;')}>
            Kies een fonds om de criteria in te voeren en uw aanvraag voor te bereiden.
          </p>
          <ul className="fwk-aa-dp" aria-label="Fondsen uit uw dekkingsplan">
            {uitDekkingsplan.map((f) => (
              <li key={f.id}>
                <button type="button" data-testid="aa-dp-fonds" onClick={() => setScherm({ naam: 'nieuw', fonds: f.naam, website: f.website })} aria-label={`Aanvraag voorbereiden voor ${f.naam}`}>
                  <span style={css('font-weight: 800; min-width: 0;')}>{f.naam}</span>
                  <span style={css('display: inline-flex; align-items: center; gap: 8px;')}>
                    {f.bedrag != null && <span className="fwk-aa-klein">{formatEuro(f.bedrag)}</span>}
                    <Chip toon={f.status === 'awarded' ? 'groen' : f.status === 'submitted' ? 'blauw' : 'grijs'}>{DP_STATUS[f.status]}</Chip>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
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
