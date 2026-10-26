// De vragen uit het aanvraagformulier van een fonds. Veel formulieren zitten achter een inlog; het lid levert de tekst aan (Word, PDF of geplakt) en wij maken er een vragenlijst en
// een lijst met stukken van. Per vraag is een tekenlimiet nodig (of "dit fonds heeft geen limiet"): zonder limiet schrijven wij niet. Het bestand zelf bewaren we niet, alleen de vragen.
import React, { useEffect, useRef, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { Button } from '../../../shared/ui/index.js';
import { Blok, Chip, Melding } from '../../../shared/ui/werkplek.jsx';
import { bewaarVragen, haalVragen, leesFormulier } from '../../../data/services/aanvraagAssistent.js';
import { extraheerTekst } from '../../../data/services/documentExtractie.js';
import { Bezig } from './Bouwstenen.jsx';
import StukkenLijst from './StukkenLijst.jsx';
import { LIMIET_ATTENTIE, MAX_VRAGEN, leesLimiet, limietOk, nieuweVraag, tekenTelling, vragenZonderLimiet } from './aanvraagModel.js';

const MIN_FORMULIER_TEKENS = 20;

function VraagRij({ vraag, nummer, onWijzig, onWeg, uit }) {
  const [limiet, setLimiet] = useState(vraag.maxTekens ? String(vraag.maxTekens) : '');
  const ontbreekt = !limietOk(vraag);

  return (
    <li className="fwk-wp-rij" style={css('grid-template-columns: minmax(0, 1fr); gap: 8px;')} data-testid="aa-vraag-rij">
      <div style={css('display: flex; gap: 10px; align-items: flex-start;')}>
        <span className="fwk-aa-klein" style={css('font-weight: 800; padding-top: 10px;')}>{nummer}.</span>
        <textarea className="fwk-aa-veld" rows={2} maxLength={500} aria-label={`Vraag ${nummer}`} value={vraag.tekst} disabled={uit} onChange={(e) => onWijzig({ tekst: e.target.value })} />
      </div>
      <div style={css('display: flex; gap: 12px; flex-wrap: wrap; align-items: center; padding-left: 26px;')}>
        <label className="fwk-aa-klein" style={css('display: inline-flex; gap: 8px; align-items: center;')}>
          Tekenlimiet
          <input
            className="fwk-aa-veld"
            style={css('width: 110px; min-height: 36px;')}
            inputMode="numeric"
            aria-label={`Tekenlimiet van vraag ${nummer}`}
            placeholder="Bijv. 1500"
            value={vraag.geenLimiet ? '' : limiet}
            disabled={uit || vraag.geenLimiet}
            onChange={(e) => {
              setLimiet(e.target.value);
              onWijzig({ maxTekens: leesLimiet(e.target.value), geenLimiet: false });
            }}
          />
        </label>
        <label className="fwk-aa-klein" style={css('display: inline-flex; gap: 6px; align-items: center; cursor: pointer;')}>
          <input
            type="checkbox"
            checked={vraag.geenLimiet}
            disabled={uit}
            aria-label={`Dit fonds heeft geen limiet voor vraag ${nummer}`}
            onChange={(e) => {
              if (e.target.checked) setLimiet('');

              onWijzig({ geenLimiet: e.target.checked, maxTekens: e.target.checked ? null : leesLimiet(limiet) });
            }}
          />
          Dit fonds heeft geen limiet
        </label>
        {ontbreekt && <Chip toon="oranje">Limiet nodig</Chip>}
        <button type="button" className="fwk-wp-link" style={css('margin-left: auto;')} disabled={uit} onClick={onWeg} aria-label={`Haal vraag ${nummer} weg`}>
          Weghalen
        </button>
      </div>
    </li>
  );
}

// props: project, aanvraagId, formulierStart (tekst uit "Nieuwe aanvraag"), docs, onOpen({ vragen, stukken }), onStand({ bevestigd }), assistent
export default function FormulierBlok({ project, aanvraagId, formulierStart = '', docs = [], onOpen, onStand = () => {}, assistent, onGewijzigd = () => {} }) {
  const [fase, setFase] = useState('laden'); // laden | invoer | controle | bevestigd | weg
  const [lijst, setLijst] = useState([]);
  const [stukken, setStukken] = useState([]);
  const [tekst, setTekst] = useState(formulierStart || '');
  const [bestand, setBestand] = useState('');
  const [bezig, setBezig] = useState('');
  const [fout, setFout] = useState('');
  const [melding, setMelding] = useState('');
  const [nieuw, setNieuw] = useState('');
  const levend = useRef(true);
  const invoer = useRef(null);

  useEffect(() => {
    levend.current = true;

    return () => {
      levend.current = false;
    };
  }, []);

  useEffect(() => {
    if (!aanvraagId) {
      setFase('weg');

      return undefined;
    }

    let weg = false;

    (async () => {
      const r = await haalVragen(aanvraagId);

      if (weg || !levend.current) return;

      // Kan de server dit niet (nog niet aangezet of niet bereikbaar), dan verdwijnt dit blok en werkt de aanvraag zoals voorheen.
      if (!r.ok) {
        setFase('weg');
        onStand({ bevestigd: false });

        return;
      }

      const v = r.antwoord.vragen;

      setStukken(Array.isArray(r.antwoord.stukken) ? r.antwoord.stukken : []);

      if (v && Array.isArray(v.lijst) && v.lijst.length) {
        setLijst(v.lijst);
        setFase(v.bevestigd ? 'bevestigd' : 'controle');
        onStand({ bevestigd: Boolean(v.bevestigd) });
      } else {
        setFase('invoer');
        onStand({ bevestigd: false });
      }
    })();

    return () => {
      weg = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aanvraagId]);

  const zegFout = (r) => setFout(r && r.melding ? r.melding : 'Dit lukte nu niet. Probeer het later opnieuw.');

  const leesBestand = async (f) => {
    setFout('');
    setBezig('Het bestand wordt gelezen.');

    const t = await extraheerTekst(f);

    if (!levend.current) return;

    setBezig('');

    if (!t || tekenTelling(t) < MIN_FORMULIER_TEKENS) {
      setFout('In dit bestand kon geen tekst worden gelezen. Gebruik een Word-bestand (.docx) of een PDF met selecteerbare tekst, of plak de vragen.');

      return;
    }

    setTekst(t);
    setBestand(f.name);
  };

  const lees = async () => {
    setFout('');
    setMelding('');
    setBezig('De vragen en de stukken worden uit uw formulier gehaald. Dit duurt even.');

    const r = await leesFormulier({ projectId: project.id, aanvraagId, formulierTekst: tekst });

    if (!levend.current) return;

    setBezig('');
    assistent.ververs();

    if (!r.ok) {
      zegFout(r);

      return;
    }

    setLijst(r.antwoord.vragen.lijst);
    setStukken(r.antwoord.stukken);
    setFase('controle');
    onStand({ bevestigd: false });
    onGewijzigd();
  };

  const wijzigVraag = (i, patch) => setLijst((l) => l.map((v, n) => (n === i ? { ...v, ...patch } : v)));
  const zonder = vragenZonderLimiet(lijst);
  const kanBevestigen = lijst.length > 0 && lijst.every((v) => v.tekst.trim().length >= 3) && zonder === 0 && !bezig;

  const bewaar = async (bevestig) => {
    setFout('');
    setMelding('');
    setBezig(bevestig ? 'De vragenlijst wordt bevestigd.' : 'De vragenlijst wordt bewaard.');

    const r = await bewaarVragen({ aanvraagId, vragen: lijst, bevestig, stukken });

    if (!levend.current) return;

    setBezig('');

    if (!r.ok) {
      zegFout(r);

      return;
    }

    setLijst(r.antwoord.vragen.lijst);
    setStukken(r.antwoord.stukken);
    onGewijzigd();

    if (bevestig) {
      setFase('bevestigd');
      onStand({ bevestigd: true });
    } else {
      setMelding('De vragenlijst is bewaard.');
    }
  };

  const pasAan = async () => {
    setFout('');
    setBezig('De vragenlijst wordt weer geopend.');

    const r = await bewaarVragen({ aanvraagId, vragen: lijst, bevestig: false });

    if (!levend.current) return;

    setBezig('');

    if (!r.ok) {
      zegFout(r);

      return;
    }

    setFase('controle');
    onStand({ bevestigd: false });
  };

  const wijzigStukken = async (nieuweLijst) => {
    const vorige = stukken;

    setStukken(nieuweLijst);

    // In de bewerkstand (vóór bevestigen) bewaren we pas bij Bewaar of Bevestig; daarna meteen.
    if (fase !== 'bevestigd') return;

    const r = await bewaarVragen({ aanvraagId, stukken: nieuweLijst });

    if (!levend.current) return;

    if (!r.ok) {
      setStukken(vorige);
      zegFout(r);
    }
  };

  if (fase === 'weg') return null;

  if (fase === 'laden') {
    return (
      <Blok titel="Vragen uit het aanvraagformulier" testid="aa-formulier-blok">
        <Bezig>De vragen worden opgehaald.</Bezig>
      </Blok>
    );
  }

  const foutBlok = fout ? (
    <div style={css('margin-top: 14px;')}>
      <Melding toon="fout" testid="aa-formulier-fout">
        {fout}
      </Melding>
    </div>
  ) : null;
  const bezigBlok = bezig ? (
    <div style={css('margin-top: 14px;')}>
      <Bezig>{bezig}</Bezig>
    </div>
  ) : null;

  if (fase === 'invoer') {
    return (
      <Blok titel="De vragen uit het aanvraagformulier" testid="aa-formulier-blok">
        <p className="fwk-aa-klein" style={css('margin: 0 0 12px;')}>
          Veel formulieren zitten achter een inlog. Daar kunnen wij niet in kijken. Kopieer de vragen naar een Word-bestand of PDF en voeg dat hier toe, of plak de vragen in het tekstvak. Het bestand blijft op uw computer; alleen de tekst van de vragen gaat mee.
        </p>
        <Melding toon="waarschuwing" testid="aa-limiet-attentie">
          {LIMIET_ATTENTIE}
        </Melding>

        <div style={css('margin-top: 14px;')}>
          <label htmlFor="aa-formulier-tekst" className="fwk-aa-label">
            Vragen uit het formulier{bestand ? ` (uit ${bestand})` : ''}
          </label>
          <textarea id="aa-formulier-tekst" data-testid="aa-formulier-tekst" className="fwk-aa-veld" rows={8} value={tekst} onChange={(e) => setTekst(e.target.value)} placeholder="Plak hier de vragen, bijvoorbeeld: 1. Beschrijf de aanleiding van uw project (max. 1500 tekens) …" />
          <div style={css('display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; align-items: center; margin-top: 6px;')} className="fwk-aa-klein">
            <span>{tekenTelling(tekst).toLocaleString('nl-NL')} tekens</span>
            <span>
              <input
                ref={invoer}
                type="file"
                accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                data-testid="aa-formulier-bestand"
                aria-label="Word-bestand of PDF met de vragen"
                style={css('position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none;')}
                onChange={(e) => {
                  const f = e.target.files && e.target.files[0];

                  e.target.value = '';

                  if (f) leesBestand(f);
                }}
              />
              <Button variant="outline" size="s" onClick={() => invoer.current && invoer.current.click()} disabled={Boolean(bezig)}>
                Word of PDF kiezen
              </Button>
            </span>
          </div>
        </div>

        <div style={css('display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 16px;')}>
          <Button onClick={lees} disabled={Boolean(bezig) || tekenTelling(tekst) < MIN_FORMULIER_TEKENS} ariaLabel="Maak een vragenlijst en een lijst met stukken">
            Maak een vragenlijst en een lijst met stukken →
          </Button>
          <span className="fwk-aa-klein">Dit telt als één formulier lezen van uw maandruimte.</span>
        </div>
        {bezigBlok}
        {foutBlok}
      </Blok>
    );
  }

  if (fase === 'bevestigd') {
    return (
      <Blok titel="Vragen uit het aanvraagformulier" aantal={lijst.length} testid="aa-formulier-blok" actie={<Chip toon="groen">Tekenlimieten ingevuld</Chip>}>
        <ol style={css('margin: 0 0 14px; padding-left: 22px; display: flex; flex-direction: column; gap: 8px;')} data-testid="aa-vragen-samenvatting">
          {lijst.map((v) => (
            <li key={v.id} className="fwk-aa-tekst">
              {v.tekst} <span className="fwk-aa-klein">({v.geenLimiet ? 'geen limiet' : `${v.maxTekens.toLocaleString('nl-NL')} tekens`})</span>
            </li>
          ))}
        </ol>
        <div style={css('display: flex; gap: 10px; flex-wrap: wrap; align-items: center;')}>
          <Button onClick={() => onOpen({ lijst, stukken })} disabled={Boolean(bezig)} ariaLabel="Open uw aanvraag per vraag">
            Open uw aanvraag per vraag →
          </Button>
          <Button variant="outline" onClick={pasAan} disabled={Boolean(bezig)} ariaLabel="Vragenlijst aanpassen">
            Vragenlijst aanpassen
          </Button>
        </div>
        <p className="fwk-aa-klein" style={css('margin: 12px 0 0;')}>
          Per vraag krijgt u een eigen antwoordvak met tekenteller, en een checklist met stukken. U dient zelf in; wij dienen nooit iets voor u in.
        </p>
        {bezigBlok}
        {foutBlok}
      </Blok>
    );
  }

  // controle
  return (
    <Blok titel="Uw vragenlijst" aantal={lijst.length} testid="aa-formulier-blok" actie={<Chip toon={zonder ? 'oranje' : 'groen'}>{zonder ? `Tekenlimiet ontbreekt bij ${zonder} ${zonder === 1 ? 'vraag' : 'vragen'}` : 'Alle tekenlimieten ingevuld'}</Chip>}>
      <p className="fwk-aa-klein" style={css('margin: 0 0 10px;')}>
        Wij hebben de vragen uit uw formulier gehaald. Controleer ze, pas ze aan en vul per vraag de tekenlimiet in.
      </p>
      <Melding toon="waarschuwing" testid="aa-limiet-attentie">
        {LIMIET_ATTENTIE}
      </Melding>

      <ul className="fwk-wp-rijen" style={css('margin-top: 12px;')}>
        {lijst.map((v, i) => (
          <VraagRij key={v.id} vraag={v} nummer={i + 1} uit={Boolean(bezig)} onWijzig={(p) => wijzigVraag(i, p)} onWeg={() => setLijst((l) => l.filter((_, n) => n !== i))} />
        ))}
      </ul>
      <div style={css('display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 12px;')}>
        <input className="fwk-aa-veld" style={css('flex: 1 1 240px; width: auto; min-height: 38px;')} aria-label="Eigen vraag toevoegen" maxLength={500} value={nieuw} placeholder="Een vraag die we misten" onChange={(e) => setNieuw(e.target.value)} />
        <Button
          size="s"
          variant="outline"
          disabled={!nieuw.trim() || nieuw.trim().length < 3 || lijst.length >= MAX_VRAGEN}
          onClick={() => {
            setLijst((l) => [...l, nieuweVraag(l, nieuw)]);
            setNieuw('');
          }}
        >
          + Vraag toevoegen
        </Button>
      </div>

      <h3 style={css('margin: 22px 0 6px; font-size: 17px;')}>Stukken die het fonds vraagt</h3>
      <p className="fwk-aa-klein" style={css('margin: 0 0 8px;')}>
        Wij hebben uw formulier doorzocht naar bijlagen. Haal weg wat niet klopt of voeg iets toe. Onder uw aanvraag vinkt u ze later af.
      </p>
      <StukkenLijst stukken={stukken} docs={docs} bewerken uit={Boolean(bezig)} onWijzig={wijzigStukken} />

      <div style={css('display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 20px;')}>
        <Button onClick={() => bewaar(true)} disabled={!kanBevestigen} ariaLabel="Bevestig de vragenlijst">
          Bevestig de vragenlijst
        </Button>
        <Button variant="outline" onClick={() => bewaar(false)} disabled={Boolean(bezig) || lijst.length === 0 || lijst.some((v) => v.tekst.trim().length < 3)} ariaLabel="Bewaar voor later">
          Bewaar voor later
        </Button>
        <button type="button" className="fwk-wp-link" onClick={() => setFase('invoer')} disabled={Boolean(bezig)}>
          Een ander formulier gebruiken
        </button>
        {!kanBevestigen && zonder > 0 && <span className="fwk-aa-klein">Vul bij elke vraag de tekenlimiet in om verder te gaan.</span>}
      </div>
      {bezigBlok}
      {foutBlok}
      {melding && !fout && (
        <div style={css('margin-top: 14px;')}>
          <Melding toon="succes">{melding}</Melding>
        </div>
      )}
    </Blok>
  );
}
