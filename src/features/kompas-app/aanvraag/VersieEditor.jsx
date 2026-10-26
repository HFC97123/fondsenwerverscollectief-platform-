// Een aanvraag voor één fonds bewerken: per onderdeel een tekstvak, opslaan als versie (maximaal 20), concept of definitief, en downloaden om zelf in te dienen.
// Wij dienen nooit iets in: het lid downloadt de tekst en dient zelf in bij het fonds. Versies kosten geen beoordeling van de maandruimte.
// Kan de server (nog) geen versies bewaren, dan toont dit scherm het plan zoals voorheen: alleen lezen, kopiëren of downloaden.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { Button } from '../../../shared/ui/index.js';
import ExportMenu from '../../../shared/ui/ExportMenu.jsx';
import { bouwDocumentModel } from '../../../shared/export/exportModel.js';
import { Blok, Chip, Melding } from '../../../shared/ui/werkplek.jsx';
import { bewaarVersie, haalVersie, haalVersies, verwijderVersie, wijzigVersie } from '../../../data/services/aanvraagAssistent.js';
import { Bezig } from './Bouwstenen.jsx';
import PlanEditor from './PlanEditor.jsx';
import { aantalAanvullen, datumTekst, limietenUitPlan, onderdelenGelijk, onderdelenLeeg, onderdelenNaarTekst, onderdelenUitPlan, onderdelenUitVersie, onderdeelTekens, versieNaam } from './aanvraagModel.js';

async function kopieer(tekst) {
  try {
    await navigator.clipboard.writeText(tekst);

    return true;
  } catch (e) {
    return false;
  }
}

function Onderdeel({ onderdeel, index, limiet, vragen, onTekst, onMelding }) {
  const tekens = onderdeelTekens(onderdeel.tekst);
  const over = Boolean(limiet) && tekens > limiet;
  const nog = aantalAanvullen(onderdeel.tekst);
  const veldId = `aa-onderdeel-${index}`;

  return (
    <div style={css('margin-bottom: 22px;')} data-testid="aa-onderdeel">
      <label htmlFor={veldId} className="fwk-aa-label" style={css('display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap;')}>
        <span>{onderdeel.titel || `Onderdeel ${index + 1}`}</span>
        <span data-testid="aa-onderdeel-telling" style={css(over ? 'color: inherit; font-weight: 800;' : '')}>
          {tekens === 0 ? 'Nog leeg' : limiet ? `${tekens.toLocaleString('nl-NL')} van ${limiet.toLocaleString('nl-NL')} tekens` : `${tekens.toLocaleString('nl-NL')} tekens`}
        </span>
      </label>
      <textarea id={veldId} className="fwk-aa-veld" rows={Math.max(4, Math.min(14, Math.ceil(onderdeel.tekst.length / 90) + 2))} value={onderdeel.tekst} onChange={(e) => onTekst(index, e.target.value)} />

      <div className="fwk-aa-chips" style={css('align-items: center;')}>
        {over && <Chip toon="rood">Boven de limiet van het fonds, haal {(tekens - limiet).toLocaleString('nl-NL')} tekens weg</Chip>}
        {nog > 0 && <Chip toon="oranje">{nog === 1 ? '1 plek om in te vullen' : `${nog} plekken om in te vullen`}</Chip>}
        {tekens > 0 && (
          <span style={css('margin-left: auto;')}>
            <Button variant="outline" size="s" ariaLabel={`Kopieer de tekst van ${onderdeel.titel || `onderdeel ${index + 1}`}`} onClick={async () => onMelding((await kopieer(onderdeel.tekst)) ? `De tekst van "${onderdeel.titel}" is gekopieerd.` : 'Kopiëren lukte niet. Selecteer de tekst en kopieer hem zelf.')}>
              Kopieer tekst
            </Button>
          </span>
        )}
      </div>

      {vragen.length > 0 && nog > 0 && (
        <ul style={css('margin: 8px 0 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px;')} className="fwk-aa-klein" data-testid="aa-onderdeel-vragen">
          {vragen.map((v) => (
            <li key={v}>{v}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// plan: het plan van de server (voor de eerste tekst, de limieten en de vragen aan het lid). nieuwePlan: het plan is zojuist door de AI geschreven.
export default function VersieEditor({ aanvraagId, plan, opgeslagen = true, nieuwePlan = false, titel, kop, projectNaam, store, onSluit, onGewijzigd = () => {} }) {
  const [fase, setFase] = useState('laden'); // laden | klaar | zonder
  const [versies, setVersies] = useState([]);
  const [aanvraagStatus, setAanvraagStatus] = useState('concept');
  const [definitieveId, setDefinitieveId] = useState('');
  const [maxVersies, setMaxVersies] = useState(20);
  const [huidig, setHuidig] = useState(null); // de versie waar het scherm nu op staat; null = nog niet opgeslagen
  const [onderdelen, setOnderdelen] = useState([]);
  const [basis, setBasis] = useState([]);
  const [onopgeslagen, setOnopgeslagen] = useState(false);
  const [bezig, setBezig] = useState('');
  const [fout, setFout] = useState('');
  const [melding, setMelding] = useState('');
  const [vraag, setVraag] = useState(null); // { soort: 'sluiten' | 'terugzetten' | 'verwijderen', versie? }
  const [hernoem, setHernoem] = useState(null); // string tijdens het hernoemen
  const levend = useRef(true);

  const limieten = limietenUitPlan(plan);
  const vragenPerId = {};

  for (const s of plan && Array.isArray(plan.secties) ? plan.secties : []) {
    if (s && s.id != null && Array.isArray(s.vragen)) vragenPerId[String(s.id)] = s.vragen;
  }

  useEffect(() => {
    levend.current = true;

    return () => {
      levend.current = false;
    };
  }, []);

  // Een waarschuwing van de browser als er nog niet-opgeslagen tekst is.
  useEffect(() => {
    if (!onopgeslagen) return undefined;

    const waarschuw = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', waarschuw);

    return () => window.removeEventListener('beforeunload', waarschuw);
  }, [onopgeslagen]);

  const leesLijst = useCallback(async () => {
    const r = await haalVersies(aanvraagId);

    if (!levend.current) return null;

    if (!r.ok) return null;

    const a = r.antwoord;

    setVersies(Array.isArray(a.versies) ? a.versies : []);
    setAanvraagStatus(a.aanvraagStatus === 'definitief' ? 'definitief' : 'concept');
    setDefinitieveId(typeof a.definitieveVersieId === 'string' ? a.definitieveVersieId : '');
    if (Number.isFinite(a.maxVersies)) setMaxVersies(a.maxVersies);

    return a;
  }, [aanvraagId]);

  // Start: de versies ophalen. Lukt dat niet, dan valt het scherm terug op het plan zoals voorheen.
  useEffect(() => {
    let weg = false;

    (async () => {
      const a = await leesLijst();

      if (weg || !levend.current) return;

      if (!a) {
        setFase('zonder');

        return;
      }

      const planOnderdelen = onderdelenUitPlan(plan);
      const nieuwste = Array.isArray(a.versies) && a.versies.length ? a.versies[0] : null;

      if (nieuwste && !nieuwePlan) {
        const v = await haalVersie(nieuwste.id);

        if (weg || !levend.current) return;

        if (v.ok) {
          const o = onderdelenUitVersie(v.antwoord.versie.antwoorden);

          setHuidig(v.antwoord.versie);
          setOnderdelen(o);
          setBasis(o);
          setFase('klaar');

          return;
        }
      }

      // Nog geen versie, of de AI heeft zojuist een nieuwe tekst geschreven: begin vanuit het plan. Opslaan maakt dan een nieuwe versie.
      setHuidig(null);
      setOnderdelen(planOnderdelen);
      setBasis(planOnderdelen);
      setOnopgeslagen(Boolean(nieuwePlan && nieuwste));
      setFase('klaar');
    })();

    return () => {
      weg = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aanvraagId]);

  const wijzigTekst = (i, tekst) => {
    setOnderdelen((l) => l.map((o, n) => (n === i ? { ...o, tekst } : o)));
    setOnopgeslagen(true);
    setMelding('');
  };

  const zegFout = (r) => {
    setFout(r && r.melding ? r.melding : 'Dit lukte nu niet. Probeer het later opnieuw.');
  };

  // Geeft de opgeslagen versie terug, of null als het niet lukte.
  const bewaar = async () => {
    setFout('');
    setMelding('');
    setBezig('Uw tekst wordt opgeslagen.');

    const r = await bewaarVersie({ aanvraagId, versieId: huidig ? huidig.id : '', antwoorden: onderdelen });

    if (!levend.current) return null;

    setBezig('');

    if (!r.ok) {
      zegFout(r);

      return null;
    }

    const v = r.antwoord.versie;

    setHuidig(v);
    setBasis(onderdelen);
    setOnopgeslagen(false);
    await leesLijst();
    onGewijzigd();
    setMelding(r.antwoord.nieuw ? `Opgeslagen als versie ${v.nummer}.` : `Versie ${v.nummer} is bijgewerkt.`);

    return v;
  };

  const terugNaarOpgeslagen = () => {
    setOnderdelen(basis);
    setOnopgeslagen(false);
    setMelding('');
    setFout('');
  };

  const maakDefinitief = async () => {
    let v = huidig;

    if (onopgeslagen || !v) {
      v = await bewaar();

      if (!v) return;
    }

    setBezig('De versie wordt definitief gemaakt.');
    setFout('');

    const r = await wijzigVersie({ versieId: v.id, actie: 'definitief' });

    if (!levend.current) return;

    setBezig('');

    if (!r.ok) {
      zegFout(r);

      return;
    }

    setHuidig(r.antwoord.versie);
    await leesLijst();
    onGewijzigd();
    setMelding(`Versie ${v.nummer} is nu definitief. Download hem om zelf in te dienen.`);
  };

  const terugNaarConcept = async () => {
    if (!huidig) return;

    setBezig('De aanvraag wordt weer een concept.');
    setFout('');

    const r = await wijzigVersie({ versieId: huidig.id, actie: 'concept' });

    if (!levend.current) return;

    setBezig('');

    if (!r.ok) {
      zegFout(r);

      return;
    }

    await leesLijst();
    onGewijzigd();
    setMelding('De aanvraag is weer een concept. De definitieve versie blijft bewaard.');
  };

  const slaNaamOp = async () => {
    if (!huidig || hernoem === null) return;

    setBezig('De naam wordt bewaard.');
    setFout('');

    const r = await wijzigVersie({ versieId: huidig.id, actie: 'hernoem', naam: hernoem });

    if (!levend.current) return;

    setBezig('');

    if (!r.ok) {
      zegFout(r);

      return;
    }

    setHuidig((h) => (h ? { ...h, naam: r.antwoord.versie.naam } : h));
    setHernoem(null);
    await leesLijst();
  };

  const zetTerug = async (versie) => {
    setVraag(null);
    setFout('');
    setBezig('De versie wordt geopend.');

    const r = await haalVersie(versie.id);

    if (!levend.current) return;

    setBezig('');

    if (!r.ok) {
      zegFout(r);

      return;
    }

    // De oude versie blijft ongemoeid; de tekst staat nu als nieuwe, nog niet opgeslagen versie in het scherm.
    setHuidig(null);
    setOnderdelen(onderdelenUitVersie(r.antwoord.versie.antwoorden));
    setOnopgeslagen(true);
    setMelding(`De tekst van versie ${versie.nummer} staat nu in het scherm. Sla op om er een nieuwe versie van te maken.`);
  };

  const verwijder = async (versie) => {
    setVraag(null);
    setFout('');
    setBezig('De versie wordt verwijderd.');

    const r = await verwijderVersie(versie.id);

    if (!levend.current) return;

    setBezig('');

    if (!r.ok) {
      zegFout(r);

      return;
    }

    if (huidig && huidig.id === versie.id) setHuidig(null);

    await leesLijst();
    onGewijzigd();
    setMelding(`Versie ${versie.nummer} is verwijderd.`);
  };

  const probeerSluiten = () => {
    if (onopgeslagen) {
      setVraag({ soort: 'sluiten' });

      return;
    }

    onSluit();
  };

  const bouwModel = async () =>
    bouwDocumentModel({
      tekst: onderdelenNaarTekst(onderdelen, titel),
      soort: 'Aanvraag',
      organisatieNaam: (store && store.orgProfile && store.orgProfile.name) || null,
      projectNaam: projectNaam || null,
      titel,
    });

  if (fase === 'zonder') {
    return <PlanEditor plan={plan} opgeslagen={opgeslagen} titel={titel} kop={kop} projectNaam={projectNaam} store={store} onSluit={onSluit} />;
  }

  if (fase === 'laden') {
    return (
      <div data-testid="aa-versie-laden">
        <Bezig>De aanvraag wordt geopend.</Bezig>
      </div>
    );
  }

  const definitief = aanvraagStatus === 'definitief';
  const opHuidigeDefinitief = Boolean(huidig && huidig.id === definitieveId && definitief);
  const leeg = onderdelenLeeg(onderdelen);
  const kanOpslaan = (!huidig || onopgeslagen) && !leeg && !bezig;
  const vol = versies.length >= maxVersies;

  let statusTekst = 'Alles is opgeslagen';

  if (onopgeslagen) statusTekst = 'Niet opgeslagen';
  else if (!huidig) statusTekst = leeg ? 'Nog geen tekst' : 'Nog geen versie opgeslagen';

  return (
    <div className="fwk-wp-stapel" data-testid="aa-versie-editor">
      <div style={css('display: flex; align-items: center; gap: 10px; flex-wrap: wrap;')}>
        <Button variant="outline" size="s" onClick={probeerSluiten}>
          ← Terug naar het fonds
        </Button>
        <strong style={css('font-size: 17px;')} data-testid="aa-versie-kop">
          {kop || titel}
        </strong>
        <Chip toon={definitief ? 'groen' : 'blauw'} testid="aa-versie-status">
          {definitief ? 'Definitief' : 'Concept'}
          {huidig ? ` · versie ${huidig.nummer}` : ''}
        </Chip>
      </div>

      {vraag && vraag.soort === 'sluiten' && (
        <Melding toon="waarschuwing" testid="aa-versie-vraag-sluiten">
          <span>
            Er staat tekst die nog niet is opgeslagen. Wat wilt u doen?
            <span style={css('display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;')}>
              <Button
                size="s"
                variant="dark"
                onClick={async () => {
                  if (await bewaar()) onSluit();
                  else setVraag(null);
                }}
              >
                Opslaan en sluiten
              </Button>
              <Button size="s" variant="outline" onClick={onSluit}>
                Sluiten zonder opslaan
              </Button>
              <Button size="s" variant="outline" onClick={() => setVraag(null)}>
                Verder werken
              </Button>
            </span>
          </span>
        </Melding>
      )}

      <div className="fwk-wp-kolommen">
        <div className="fwk-wp-stapel">
          <Blok titel="Uw tekst" testid="aa-versie-tekst">
            <p className="fwk-aa-klein" style={css('margin: 0 0 16px;')}>
              {nieuwePlan ? 'Dit is een nieuwe aanzet van de AI. ' : 'Dit is uw tekst. '}
              Wat we niet wisten, staat als <mark className="fwk-aa-markering">[aanvullen]</mark>. U beslist en past het aan; wij dienen niets voor u in.
            </p>

            {opHuidigeDefinitief && !onopgeslagen && <Melding toon="info">Dit is de definitieve versie. Past u iets aan en slaat u op, dan wordt dat een nieuw concept en blijft deze versie bewaard.</Melding>}
            {!opgeslagen && (
              <div style={css('margin-bottom: 14px;')}>
                <Melding toon="waarschuwing">De tekst is gemaakt, maar kon niet worden bewaard. Sla hem hieronder op of kopieer hem, anders is hij weg zodra u deze pagina verlaat.</Melding>
              </div>
            )}

            <div style={css('margin-top: 14px;')}>
              {onderdelen.length === 0 && <p className="fwk-aa-klein">Er is nog geen tekst om te bewerken. Laat eerst een versie schrijven.</p>}
              {onderdelen.map((o, i) => (
                <Onderdeel key={`${o.id || 'onderdeel'}-${i}`} onderdeel={o} index={i} limiet={o.id != null ? limieten[o.id] : undefined} vragen={o.id != null && vragenPerId[o.id] ? vragenPerId[o.id] : []} onTekst={wijzigTekst} onMelding={setMelding} />
              ))}
            </div>

            <div style={css('display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;')}>
              <span className="fwk-aa-klein" data-testid="aa-versie-opslagstatus" style={css('font-weight: 800;')}>
                {statusTekst}
              </span>
              <span style={css('display: flex; gap: 8px; flex-wrap: wrap;')}>
                <Button variant="outline" size="s" onClick={terugNaarOpgeslagen} disabled={!onopgeslagen || Boolean(bezig)}>
                  Terug naar opgeslagen
                </Button>
                <Button size="s" onClick={bewaar} disabled={!kanOpslaan} ariaLabel="Opslaan als versie">
                  Opslaan
                </Button>
              </span>
            </div>

            {vol && !huidig && (
              <div style={css('margin-top: 12px;')}>
                <Melding toon="info">U heeft {maxVersies} versies. Bij het opslaan verdwijnt de oudste concept-versie. De definitieve versie blijft altijd bewaard.</Melding>
              </div>
            )}
            {bezig && (
              <div style={css('margin-top: 14px;')}>
                <Bezig>{bezig}</Bezig>
              </div>
            )}
            {fout && (
              <div style={css('margin-top: 14px;')}>
                <Melding toon="fout" testid="aa-versie-fout">
                  {fout}
                </Melding>
              </div>
            )}
            {melding && !fout && (
              <div style={css('margin-top: 14px;')}>
                <Melding toon="succes" testid="aa-versie-melding">
                  {melding}
                </Melding>
              </div>
            )}
          </Blok>
        </div>

        <div className="fwk-wp-stapel">
          <Blok titel="Concept of definitief" testid="aa-versie-definitief" actie={<Chip toon={definitief ? 'groen' : 'blauw'}>{definitief ? 'Definitief' : 'Concept'}</Chip>}>
            <p className="fwk-aa-klein" style={css('margin: 0 0 12px;')}>
              Werkt u nog aan de tekst? Dan is het een concept. Is hij af, maak hem dan definitief: die versie blijft bewaard en u downloadt hem om zelf in te dienen. Terug naar concept kan altijd.
            </p>
            <div className="fwk-aa-acties">
              {!opHuidigeDefinitief || onopgeslagen ? (
                <Button size="s" variant="dark" onClick={maakDefinitief} disabled={leeg || Boolean(bezig)} ariaLabel="Maak definitief">
                  Maak definitief
                </Button>
              ) : null}
              <ExportMenu toegestaan formaten={['docx', 'pdf']} uitlijnen="rechts" onMelding={setMelding} ariaLabel="Download voor indienen" bouwModel={bouwModel} />
            </div>
            {opHuidigeDefinitief && !onopgeslagen && (
              <div style={css('margin-top: 10px;')}>
                <button type="button" className="fwk-wp-link" onClick={terugNaarConcept} disabled={Boolean(bezig)}>
                  Terug naar concept
                </button>
              </div>
            )}
          </Blok>

          <Blok titel="Versies" aantal={versies.length || undefined} testid="aa-versie-lijst">
            {versies.length === 0 ? (
              <p className="fwk-aa-klein" style={css('margin: 0;')}>Er zijn nog geen opgeslagen versies. Klik op Opslaan om de eerste te bewaren (maximaal {maxVersies}).</p>
            ) : (
              <ul className="fwk-wp-rijen">
                {versies.map((v) => {
                  const isHuidig = Boolean(huidig && huidig.id === v.id);
                  const isDef = v.id === definitieveId;

                  return (
                    <li key={v.id} className="fwk-wp-rij" style={css('grid-template-columns: minmax(0, 1fr) auto;')} data-testid="aa-versie-rij">
                      <div>
                        <div className="fwk-wp-rij-titel">
                          {versieNaam(v)} {isHuidig && <Chip toon="grijs">Open</Chip>} {isDef && <Chip toon="groen">Definitief</Chip>}
                        </div>
                        <div className="fwk-wp-rij-sub">
                          {datumTekst(v.bijgewerkt || v.gemaakt)}, {v.herkomst === 'ai' ? 'door de AI geschreven' : 'door u bewerkt'}
                          {v.heeftBeoordeling ? ', beoordeeld' : ''}
                        </div>
                      </div>
                      <div className="fwk-wp-rij-eind">
                        {!isHuidig && (
                          <button type="button" className="fwk-wp-link" onClick={() => (onopgeslagen ? setVraag({ soort: 'terugzetten', versie: v }) : zetTerug(v))} disabled={Boolean(bezig)}>
                            Terugzetten
                          </button>
                        )}
                        {!isDef && (
                          <button type="button" className="fwk-wp-link" onClick={() => setVraag({ soort: 'verwijderen', versie: v })} disabled={Boolean(bezig)} aria-label={`Verwijder versie ${v.nummer}`}>
                            Verwijderen
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {vraag && vraag.soort === 'terugzetten' && (
              <div style={css('margin-top: 12px;')}>
                <Melding toon="waarschuwing" testid="aa-versie-vraag-terugzetten">
                  <span>
                    Uw niet-opgeslagen tekst gaat verloren als u versie {vraag.versie.nummer} terugzet.
                    <span style={css('display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;')}>
                      <Button size="s" variant="dark" onClick={() => zetTerug(vraag.versie)}>
                        Toch terugzetten
                      </Button>
                      <Button size="s" variant="outline" onClick={() => setVraag(null)}>
                        Annuleren
                      </Button>
                    </span>
                  </span>
                </Melding>
              </div>
            )}

            {vraag && vraag.soort === 'verwijderen' && (
              <div style={css('margin-top: 12px;')}>
                <Melding toon="waarschuwing" testid="aa-versie-vraag-verwijderen">
                  <span>
                    Versie {vraag.versie.nummer} wordt voorgoed verwijderd.
                    <span style={css('display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;')}>
                      <Button size="s" variant="dark" onClick={() => verwijder(vraag.versie)}>
                        Ja, verwijder
                      </Button>
                      <Button size="s" variant="outline" onClick={() => setVraag(null)}>
                        Annuleren
                      </Button>
                    </span>
                  </span>
                </Melding>
              </div>
            )}

            {huidig && (
              <div style={css('margin-top: 14px;')}>
                {hernoem === null ? (
                  <button type="button" className="fwk-wp-link" onClick={() => setHernoem(huidig.naam && huidig.naam !== `Versie ${huidig.nummer}` ? huidig.naam : '')}>
                    Deze versie een naam geven
                  </button>
                ) : (
                  <div style={css('display: flex; gap: 8px; flex-wrap: wrap; align-items: center;')}>
                    <input className="fwk-aa-veld" style={css('flex: 1 1 160px; width: auto; min-height: 38px;')} aria-label="Naam van de versie" maxLength={120} value={hernoem} onChange={(e) => setHernoem(e.target.value)} placeholder="Bijvoorbeeld: voor het bestuur" />
                    <Button size="s" onClick={slaNaamOp} disabled={!hernoem.trim() || Boolean(bezig)}>
                      Bewaar naam
                    </Button>
                    <Button size="s" variant="outline" onClick={() => setHernoem(null)}>
                      Annuleren
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Blok>
        </div>
      </div>
    </div>
  );
}
