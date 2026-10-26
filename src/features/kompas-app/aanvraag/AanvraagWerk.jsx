// Eén aanvraag voor één fonds: de criteria controleren en aanpassen, en daarna kiezen: een versie voor dit fonds schrijven en/of een eigen aanvraag laten
// beoordelen. De server bewaart de criteria, het plan en de laatste uitkomst per fonds. De aanvraagtekst die u laat beoordelen wordt niet bewaard; de versies die u zelf opslaat wel (zie VersieEditor).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { Button } from '../../../shared/ui/index.js';
import { Blok, Chip, Leeg, Melding } from '../../../shared/ui/werkplek.jsx';
import { beoordeelAanvraag, bewaarCriteria, haalAanvraag, haalBeoordeling, schrijfProjectplan } from '../../../data/services/aanvraagAssistent.js';
import { AanvraagStijl, Bezig, Keuzekaart, PrivaatfondsKaart, RuimteBlok, Stappen } from './Bouwstenen.jsx';
import BeoordelingResultaat from './BeoordelingResultaat.jsx';
import VersieEditor from './VersieEditor.jsx';
import {
  SOORTEN_KEUZE,
  aanvraagTekstStatus,
  aantalFormulierVragen,
  bronLabel,
  criteriaGewijzigd,
  datumTekst,
  heeftBeoordelingRuimte,
  nieuweEis,
  soortLabel,
  tekenTekst,
  uitkomstLabel,
  uitkomstToon,
  verwijderEis,
  voegEisToe,
  wijzigEis,
  zekerheidTekst,
  ZEKERHEID_TOON,
} from './aanvraagModel.js';
import { leesWordBestand } from './wordUpload.js';

const BRON_REDEN = {
  'niet-bereikbaar': 'De pagina was niet bereikbaar.',
  'niet-toegestaan': 'Dit adres mogen we niet lezen.',
  'niet-leesbaar': 'Er stond geen leesbare tekst op de pagina.',
};

function BronnenBlok({ bronnen, inlogSignaal, beperkteLijst }) {
  const lijst = Array.isArray(bronnen) ? bronnen : [];

  if (!lijst.length && !inlogSignaal && !beperkteLijst) return null;

  const tel = { lid: 0, website: 0 };

  return (
    <div className="fwk-wp-stapel" data-testid="aa-bronnen">
      {lijst.length > 0 && (
        <Blok titel="Wat we hebben gelezen">
          <ul className="fwk-aa-lijst" style={css('padding: 0;')}>
            {lijst.map((b, i) => {
              tel[b.type] = (tel[b.type] || 0) + 1;

              const naam = b.type === 'lid' ? 'Uw formuliervragen' : `Website, pagina ${tel.website}`;

              return (
                <li key={i} style={css('display: flex; align-items: center; gap: 10px; padding: 8px 0; border: none; font-size: 15px;')}>
                  <Chip toon={b.gelezen ? 'groen' : 'oranje'}>{b.gelezen ? '✓' : '!'}</Chip>
                  <span>
                    <b>{naam}</b>. {b.gelezen ? (b.type === 'lid' ? 'Gelezen. Deze gaan voor.' : 'Gelezen.') : `Niet te lezen. ${BRON_REDEN[b.reden] || ''}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </Blok>
      )}
      {inlogSignaal && (
        <Melding toon="waarschuwing" testid="aa-inlog">
          <span>
            <strong>Een deel zat mogelijk achter een inlog.</strong> De website laat ons niet alles zien. Heeft u de vragen uit het formulier, voeg ze dan toe via "Nieuwe aanvraag", of voeg hieronder zelf een criterium toe.
          </span>
        </Melding>
      )}
      {beperkteLijst && (
        <Melding toon="info" testid="aa-beperkt">
          <span>
            <strong>We vonden maar weinig criteria.</strong> Er is niets aangevuld of verzonnen. Voeg zelf toe wat u weet, of plak de vragen uit het aanvraagformulier.
          </span>
        </Melding>
      )}
    </div>
  );
}

function EisRij({ eis, onWijzig, onWeg }) {
  const [bewerk, setBewerk] = useState(false);
  const [tekst, setTekst] = useState(eis.tekst);
  const [soort, setSoort] = useState(eis.soort);

  if (bewerk) {
    return (
      <li data-testid="aa-eis-bewerk">
        <label className="fwk-aa-label" htmlFor={`eis-${eis.id}`}>
          Criterium
        </label>
        <textarea id={`eis-${eis.id}`} className="fwk-aa-veld" rows={3} maxLength={300} value={tekst} onChange={(e) => setTekst(e.target.value)} />
        <div style={css('display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-top: 10px;')}>
          <select aria-label="Soort criterium" className="fwk-aa-veld" style={css('width: auto;')} value={soort} onChange={(e) => setSoort(e.target.value)}>
            {SOORTEN_KEUZE.map(([w, l]) => (
              <option key={w} value={w}>
                {l}
              </option>
            ))}
          </select>
          <Button
            size="s"
            disabled={!tekst.trim()}
            onClick={() => {
              onWijzig({ tekst, soort });
              setBewerk(false);
            }}
          >
            Opslaan
          </Button>
          <Button
            size="s"
            variant="outline"
            onClick={() => {
              setTekst(eis.tekst);
              setSoort(eis.soort);
              setBewerk(false);
            }}
          >
            Annuleren
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li data-testid="aa-eis">
      <div className="fwk-aa-eis">
        <div style={css('flex: 1 1 340px; min-width: 0;')}>
          <div className="fwk-aa-eis-tekst">{eis.tekst}</div>
          <div className="fwk-aa-chips">
            <Chip toon={eis.soort === 'verplicht' ? 'oranje' : 'blauw'}>{soortLabel(eis.soort)}</Chip>
            <Chip toon="grijs">{bronLabel(eis)}</Chip>
            <span title={zekerheidTekst(eis.zekerheid)}>
              <Chip toon={ZEKERHEID_TOON[eis.zekerheid] || 'grijs'}>Zeker: {eis.zekerheid || 'laag'}</Chip>
            </span>
          </div>
        </div>
        <div className="fwk-aa-acties">
          <Button size="s" variant="outline" ariaLabel={`Pas aan: ${eis.tekst}`} onClick={() => setBewerk(true)}>
            Aanpassen
          </Button>
          <Button size="s" variant="danger" ariaLabel={`Haal weg: ${eis.tekst}`} onClick={onWeg}>
            Weghalen
          </Button>
        </div>
      </div>
    </li>
  );
}

function CriteriaBlok({ criteria, onWijzig, onWeg, onToevoegen, gewijzigd, bewaarbaar, onBewaar, bezig }) {
  const [nieuw, setNieuw] = useState('');
  const [soort, setSoort] = useState('criterium');

  return (
    <Blok titel="Beoordelingscriteria van het fonds" aantal={criteria.length} testid="aa-criteria">
      <p className="fwk-aa-klein" style={css('margin: 0 0 8px;')}>
        Bij elk criterium zien we waar het vandaan komt en hoe zeker we ervan zijn. Klopt iets niet, pas het aan of haal het weg. Uw aanpassingen gaan voor.
      </p>
      {criteria.length === 0 && <Leeg testid="aa-criteria-leeg">Er staan geen criteria in de lijst. Voeg hieronder zelf een criterium toe.</Leeg>}
      <ul className="fwk-aa-lijst">
        {criteria.map((e) => (
          <EisRij key={e.id + e.tekst} eis={e} onWijzig={(p) => onWijzig(e.id, p)} onWeg={() => onWeg(e.id)} />
        ))}
      </ul>

      <p className="fwk-aa-klein" style={css('margin: 8px 0 0;')}>
        Een criterium van uzelf met de soort Verplicht of Criterium wordt bij het schrijven een eigen onderdeel van de versie voor dit fonds.
      </p>
      <div style={css('display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; margin-top: 8px;')}>
        <div style={css('flex: 1 1 280px;')}>
          <label className="fwk-aa-label" htmlFor="aa-nieuw-criterium">
            Criterium toevoegen
          </label>
          <input id="aa-nieuw-criterium" data-testid="aa-nieuw-criterium" className="fwk-aa-veld" type="text" maxLength={300} value={nieuw} onChange={(e) => setNieuw(e.target.value)} placeholder="Bijvoorbeeld: de aanvraag bevat een begroting" />
        </div>
        <select aria-label="Soort nieuw criterium" className="fwk-aa-veld" style={css('width: auto;')} value={soort} onChange={(e) => setSoort(e.target.value)}>
          {SOORTEN_KEUZE.map(([w, l]) => (
            <option key={w} value={w}>
              {l}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          disabled={!nieuw.trim()}
          onClick={() => {
            onToevoegen(nieuweEis(nieuw, soort));
            setNieuw('');
          }}
        >
          + Toevoegen
        </Button>
      </div>

      {gewijzigd && (
        <div style={css('margin-top: 16px;')}>
          <Melding toon="info" testid="aa-gewijzigd">
            <span style={css('display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; width: 100%;')}>
              <span>U heeft de criteria aangepast.{bewaarbaar ? '' : ' Ze worden gebruikt voor deze beoordeling, maar zijn niet bewaard.'}</span>
              {bewaarbaar && (
                <Button size="s" variant="dark" onClick={onBewaar} disabled={bezig}>
                  Wijzigingen bewaren
                </Button>
              )}
            </span>
          </Melding>
        </div>
      )}
    </Blok>
  );
}

// props: project, aanvraagId (mag leeg zijn als de criteria niet bewaard konden worden), fondsLabel, voorlopig (net opgehaald), assistent, store, onTerug
export default function AanvraagWerk({ project, aanvraagId: startId, fondsLabel: startFonds, voorlopig, assistent, store, onTerug, onGewijzigd }) {
  const [aanvraagId] = useState(startId || '');
  const [aanvraag, setAanvraag] = useState(null);
  const [laden, setLaden] = useState(Boolean(startId));
  const [laadFout, setLaadFout] = useState('');
  const [criteria, setCriteria] = useState(voorlopig ? voorlopig.eisen : []);
  const [basis, setBasis] = useState(voorlopig ? voorlopig.eisen : []);
  const [bezig, setBezig] = useState('');
  const [fout, setFout] = useState('');
  const [melding, setMelding] = useState('');
  const [plan, setPlan] = useState(null); // { plan, opgeslagen }
  const [resultaat, setResultaat] = useState(null); // { antwoord, datum }
  const [tekst, setTekst] = useState('');
  const [bevestigPlan, setBevestigPlan] = useState(false);
  const levend = useRef(true);

  useEffect(() => {
    levend.current = true;

    return () => {
      levend.current = false;
    };
  }, []);

  const laad = useCallback(async () => {
    if (!aanvraagId) return;

    const r = await haalAanvraag(aanvraagId);

    if (!levend.current) return;

    setLaden(false);

    if (!r.ok) {
      setLaadFout(r.melding);

      return;
    }

    const a = r.antwoord.aanvraag;

    setAanvraag(a);
    setCriteria(Array.isArray(a.criteria) ? a.criteria : []);
    setBasis(Array.isArray(a.criteria) ? a.criteria : []);
  }, [aanvraagId]);

  useEffect(() => {
    laad();
  }, [laad]);

  const fondsLabel = (aanvraag && aanvraag.fondsLabel) || startFonds || '';
  const gewijzigd = criteriaGewijzigd(criteria, basis);
  const bewaarbaar = Boolean(aanvraagId);
  const bronnen = (aanvraag && aanvraag.bronnen && aanvraag.bronnen.length ? aanvraag.bronnen : voorlopig && voorlopig.bronnen) || [];
  const status = assistent.status;
  const maxTekens = status && status.maxAanvraagTekens;
  const tekstStatus = aanvraagTekstStatus(tekst, maxTekens);
  const vragen = aantalFormulierVragen(criteria);

  const bewaar = async () => {
    if (!bewaarbaar) return true;

    setFout('');
    setBezig('De criteria worden bewaard.');

    const r = await bewaarCriteria({ aanvraagId, criteria });

    if (!levend.current) return false;

    setBezig('');

    if (!r.ok) {
      setFout(r.melding);

      return false;
    }

    setCriteria(r.antwoord.criteria);
    setBasis(r.antwoord.criteria);
    setMelding('De criteria zijn bewaard.');
    onGewijzigd();

    return true;
  };

  const schrijf = async () => {
    setBevestigPlan(false);
    setFout('');
    setMelding('');

    if (gewijzigd && !(await bewaar())) return;

    setBezig('Het plan voor dit fonds wordt geschreven. Dit kan een minuut duren.');

    const r = await schrijfProjectplan({ projectId: project.id, aanvraagId });

    if (!levend.current) return;

    setBezig('');
    assistent.ververs();

    if (!r.ok) {
      setFout(r.melding);

      return;
    }

    setPlan({ plan: r.antwoord.plan, opgeslagen: r.antwoord.opgeslagen !== false, nieuw: true });
    onGewijzigd();
    laad();
  };

  const startSchrijven = () => {
    if (aanvraag && aanvraag.heeftPlan && !bevestigPlan) {
      setBevestigPlan(true);

      return;
    }

    schrijf();
  };

  const openPlan = async () => {
    setBezig('Het plan wordt geopend.');

    const r = await haalAanvraag(aanvraagId);

    if (!levend.current) return;

    setBezig('');

    if (!r.ok || !r.antwoord.aanvraag.plan) {
      setFout(r.ok ? 'Dit plan is niet gevonden.' : r.melding);

      return;
    }

    setPlan({ plan: r.antwoord.aanvraag.plan, opgeslagen: true, nieuw: false });
  };

  const beoordeel = async () => {
    setFout('');
    setMelding('');

    if (gewijzigd && bewaarbaar && !(await bewaar())) return;

    setBezig('Uw aanvraag wordt beoordeeld. Dit duurt even.');

    const r = await beoordeelAanvraag({ projectId: project.id, aanvraagId, aanvraagTekst: tekst, eisen: criteria, fondsLabel });

    if (!levend.current) return;

    setBezig('');
    assistent.ververs();

    if (!r.ok) {
      setFout(r.melding);

      return;
    }

    setResultaat({ antwoord: r.antwoord, datum: 'zojuist' });
    onGewijzigd();
    laad();
  };

  const openLaatsteBeoordeling = async () => {
    setFout('');
    setBezig('De beoordeling wordt opgehaald.');

    const r = await haalBeoordeling(aanvraag.laatsteBeoordelingId);

    if (!levend.current) return;

    setBezig('');

    if (!r.ok) {
      setFout('Deze beoordeling kon niet worden opgehaald.');

      return;
    }

    const b = r.beoordeling;

    setResultaat({
      antwoord: { uitkomst: b.uitkomst, uitkomstTekst: '', eisen: b.eisen, resultaten: (b.resultaat && b.resultaat.resultaten) || [], punten: (b.resultaat && b.resultaat.punten) || [], statistiek: b.statistiek },
      datum: datumTekst(b.created_at),
    });
  };

  const leesBestand = async (f) => {
    setFout('');
    setBezig('Het bestand wordt gelezen.');

    const r = await leesWordBestand(f);

    setBezig('');

    if (!r.ok) {
      setFout(r.melding);

      return;
    }

    setTekst(r.tekst);
  };

  if (plan) {
    return (
      <>
        <AanvraagStijl />
        <VersieEditor aanvraagId={aanvraagId} plan={plan.plan} opgeslagen={plan.opgeslagen} nieuwePlan={plan.nieuw} titel={`Aanvraag voor ${fondsLabel}`} kop={`Aanvraag ${fondsLabel}`} projectNaam={project.naam} store={store} onSluit={() => setPlan(null)} onGewijzigd={onGewijzigd} />
      </>
    );
  }

  if (resultaat) {
    return (
      <>
        <AanvraagStijl />
        <BeoordelingResultaat antwoord={resultaat.antwoord} datum={resultaat.datum} onSluit={() => setResultaat(null)} />
      </>
    );
  }

  if (laden) {
    return (
      <div data-testid="aa-werk">
        <AanvraagStijl />
        <Bezig>De aanvraag wordt opgehaald.</Bezig>
      </div>
    );
  }

  if (laadFout) {
    return (
      <div data-testid="aa-werk" className="fwk-wp-stapel">
        <AanvraagStijl />
        <Melding toon="fout">{laadFout}</Melding>
        <div>
          <Button variant="outline" onClick={onTerug}>
            Terug naar de aanvragen
          </Button>
        </div>
      </div>
    );
  }

  const beoordelingRuimte = heeftBeoordelingRuimte(status);
  const planRuimte = beoordelingRuimte; // een versie voor een fonds telt bij de beoordelingen
  const klaarOmTeKiezen = criteria.length > 0;

  return (
    <div data-testid="aa-werk">
      <AanvraagStijl />
      <Stappen actief={2} />

      <div className="fwk-wp-kolommen">
        <div className="fwk-wp-stapel">
          <div style={css('display: flex; align-items: center; gap: 12px; flex-wrap: wrap;')}>
            <Button variant="outline" size="s" onClick={onTerug}>
              ← Alle aanvragen
            </Button>
            <strong data-testid="aa-fonds-naam" style={css('font-size: 17px;')}>
              {fondsLabel}
            </strong>
            {aanvraag && aanvraag.laatsteUitkomst && <Chip toon={uitkomstToon(aanvraag.laatsteUitkomst)}>Laatst beoordeeld: {uitkomstLabel(aanvraag.laatsteUitkomst).toLowerCase()}</Chip>}
          </div>

          {!aanvraagId && (
            <Melding toon="waarschuwing" testid="aa-niet-bewaard">
              De criteria konden niet worden bewaard. U kunt ze nu nog gebruiken om een aanvraag te beoordelen, maar niet om een versie te schrijven. Haal de criteria later opnieuw op.
            </Melding>
          )}

          <BronnenBlok bronnen={bronnen} inlogSignaal={voorlopig && voorlopig.inlogSignaal} beperkteLijst={voorlopig && voorlopig.beperkteLijst} />

          <CriteriaBlok
            criteria={criteria}
            gewijzigd={gewijzigd}
            bewaarbaar={bewaarbaar}
            bezig={Boolean(bezig)}
            onBewaar={bewaar}
            onWijzig={(id, p) => setCriteria((c) => wijzigEis(c, id, p))}
            onWeg={(id) => setCriteria((c) => verwijderEis(c, id))}
            onToevoegen={(eis) => setCriteria((c) => voegEisToe(c, eis))}
          />

          <Blok titel="Wat wilt u nu doen?" testid="aa-keuze">
            <p className="fwk-aa-klein" style={css('margin: 0 0 16px;')}>
              Beide kan met dezelfde criteria. U kunt later het andere ook nog doen.
            </p>

            <div className="fwk-aa-keuzes">
              <Keuzekaart titel="Schrijf een versie voor dit fonds" accent testid="aa-kaart-schrijven">
                <p>
                  {vragen > 0
                    ? (vragen === 1 ? 'Uw formulier heeft 1 vraag; die wordt 1 onderdeel. ' : `Uw ${vragen} formuliervragen worden ${vragen} onderdelen. `)
                    : 'Zonder formuliervragen gebruiken we de standaardonderdelen: aanleiding, doelgroep, aanpak, resultaat, planning, organisatie, financiering en borging. '}
                  We schrijven ze uit uw projectgegevens, documentatie en organisatieprofiel. Wat ontbreekt, zetten we als [aanvullen] met een vraag aan u.
                </p>

                {aanvraag && aanvraag.heeftPlan && (
                  <div className="fwk-aa-klein">
                    U heeft al een tekst voor dit fonds (bijgewerkt op {datumTekst(aanvraag.planBijgewerkt) || 'onbekende datum'}).{' '}
                    <button type="button" className="fwk-wp-link" onClick={openPlan}>
                      Openen
                    </button>
                  </div>
                )}

                {bevestigPlan && (
                  <Melding toon="waarschuwing" testid="aa-bevestig-versie">
                    <span>
                      De AI schrijft een nieuwe aanzet. Uw opgeslagen versies blijven bewaard, en het telt als een van uw beoordelingen deze maand.
                      <span style={css('display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;')}>
                        <Button size="s" variant="dark" onClick={schrijf}>
                          Ja, schrijf een nieuwe aanzet
                        </Button>
                        <Button size="s" variant="outline" onClick={() => setBevestigPlan(false)}>
                          Annuleren
                        </Button>
                      </span>
                    </span>
                  </Melding>
                )}

                <div className="fwk-aa-onder">
                  <Button onClick={startSchrijven} disabled={Boolean(bezig) || !aanvraagId || !planRuimte} ariaLabel="Start schrijven">
                    {aanvraag && aanvraag.heeftPlan ? 'Schrijf een nieuwe aanzet →' : 'Start schrijven →'}
                  </Button>
                  {!planRuimte && <span className="fwk-aa-klein">Deze maand is uw ruimte voor beoordelingen en versies op.</span>}
                </div>
              </Keuzekaart>

              <Keuzekaart titel="Beoordeel mijn aanvraag" testid="aa-kaart-beoordelen">
                <p>Plak uw eigen tekst of upload het Word-bestand. Per criterium ziet u: gedekt, deels of ontbreekt, met een citaat uit uw tekst. We slaan uw aanvraagtekst niet op.</p>
                <textarea data-testid="aa-aanvraagtekst" className="fwk-aa-veld" rows={7} aria-label="Uw aanvraagtekst" value={tekst} onChange={(e) => setTekst(e.target.value)} placeholder="Plak hier de tekst van uw aanvraag" />
                <div style={css('display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; align-items: center;')} className="fwk-aa-klein">
                  <label style={css('cursor: pointer; font-weight: 800;')} className="fwk-wp-link">
                    Word-bestand uploaden
                    <input
                      type="file"
                      accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      data-testid="aa-aanvraag-bestand"
                      style={css('position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none;')}
                      onChange={(e) => {
                        const f = e.target.files && e.target.files[0];

                        e.target.value = '';

                        if (f) leesBestand(f);
                      }}
                    />
                  </label>
                  <span data-testid="aa-teken-telling">{tekenTekst(tekstStatus.n, maxTekens)}</span>
                </div>
                {tekstStatus.reden === 'te-kort' && <div className="fwk-aa-klein">Dat is te kort om te beoordelen. Plak de volledige tekst.</div>}
                {tekstStatus.reden === 'te-lang' && <div className="fwk-aa-klein" style={css('color: inherit;')}>Dit is te lang om in één keer te beoordelen. Beoordeel de aanvraag in delen, bijvoorbeeld per hoofdstuk.</div>}
                <div className="fwk-aa-onder">
                  <Button variant="dark" onClick={beoordeel} disabled={Boolean(bezig) || !tekstStatus.ok || !klaarOmTeKiezen || !beoordelingRuimte} ariaLabel="Beoordeel mijn aanvraag">
                    Beoordeel →
                  </Button>
                  {!beoordelingRuimte && <span className="fwk-aa-klein">Deze maand is uw ruimte voor beoordelingen op.</span>}
                  {aanvraag && aanvraag.laatsteBeoordelingId && (
                    <button type="button" className="fwk-wp-link" onClick={openLaatsteBeoordeling}>
                      Laatste beoordeling bekijken
                    </button>
                  )}
                </div>
              </Keuzekaart>
            </div>

            {bezig && (
              <div style={css('margin-top: 16px;')}>
                <Bezig>{bezig}</Bezig>
              </div>
            )}
            {fout && (
              <div style={css('margin-top: 16px;')}>
                <Melding toon="fout" testid="aa-werk-fout">
                  {fout}
                </Melding>
              </div>
            )}
            {melding && !fout && (
              <div style={css('margin-top: 16px;')}>
                <Melding toon="succes">{melding}</Melding>
              </div>
            )}
          </Blok>
        </div>

        <div className="fwk-wp-stapel">
          <RuimteBlok status={status} />
          <Blok titel="Wat betekent “Zeker”?">
            <div style={css('display: flex; flex-direction: column; gap: 10px;')} className="fwk-aa-tekst">
              <div>
                <b>Hoog.</b> Staat in uw eigen formulier.
              </div>
              <div>
                <b>Middel.</b> Staat op de website met een duidelijk woord als “moet” of “verplicht”.
              </div>
              <div>
                <b>Laag.</b> Lijkt een wens. Controleer het even.
              </div>
            </div>
          </Blok>
          <PrivaatfondsKaart fondsLabel={fondsLabel} />
        </div>
      </div>
    </div>
  );
}
