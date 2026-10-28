// De vragen uit het aanvraagformulier van een fonds. Veel formulieren zitten achter een inlog; het lid levert het formulier aan (Word, PDF, screenshot of foto, of geplakte tekst) en wij maken er een vragenlijst en
// een lijst met stukken van. Per vraag is een tekenlimiet nodig (of "dit fonds heeft geen limiet"): zonder limiet schrijven wij niet. Het bestand of de afbeelding zelf bewaren we niet, alleen de vragen.
import React, { useEffect, useRef, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { Button } from '../../../shared/ui/index.js';
import { Blok, Chip, Melding } from '../../../shared/ui/werkplek.jsx';
import { bewaarVragen, haalVragen, leesFormulier } from '../../../data/services/aanvraagAssistent.js';
import { extraheerTekst, leesPdfAlsAfbeeldingen } from '../../../data/services/documentExtractie.js';
import { MAX_AFBEELDINGEN, canvasNaarDataUrl, isAfbeelding, verkleinAfbeelding } from '../../../data/services/afbeeldingLezen.js';
import { Bezig } from './Bouwstenen.jsx';
import StukkenLijst from './StukkenLijst.jsx';
import { LIMIET_ATTENTIE, MAX_VRAGEN, leesLimiet, limietOk, nieuweVraag, tekenTelling, vragenZonderLimiet } from './aanvraagModel.js';

const MIN_FORMULIER_TEKENS = 20;

// De lezers van bestanden en afbeeldingen; los te zetten zodat de schermen zonder echte browser te testen zijn.
export const formulierHulp = {
  extraheerTekst,
  verkleinAfbeelding,
  pdfAlsAfbeeldingen: (f) => leesPdfAlsAfbeeldingen(f, { max: MAX_AFBEELDINGEN, canvasNaarDataUrl }),
};

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
  const [afbeeldingen, setAfbeeldingen] = useState([]); // [{ naam, dataUrl }]: screenshots, foto's of scanpagina's; gaan mee om te laten overtypen
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
      onStand({ bevestigd: false, weg: true });

      return undefined;
    }

    let weg = false;

    (async () => {
      const r = await haalVragen(aanvraagId);

      if (weg || !levend.current) return;

      // Kan de server dit niet (nog niet aangezet of niet bereikbaar), dan verdwijnt dit blok en werkt de aanvraag zoals voorheen.
      if (!r.ok) {
        setFase('weg');
        onStand({ bevestigd: false, weg: true });

        return;
      }

      const v = r.antwoord.vragen;

      setStukken(Array.isArray(r.antwoord.stukken) ? r.antwoord.stukken : []);

      if (v && Array.isArray(v.lijst) && v.lijst.length) {
        setLijst(v.lijst);
        setFase(v.bevestigd ? 'bevestigd' : 'controle');
        onStand({ bevestigd: Boolean(v.bevestigd), lijst: v.lijst, stukken: Array.isArray(r.antwoord.stukken) ? r.antwoord.stukken : [] });
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

  const voegAfbeeldingenToe = async (bestanden) => {
    setFout('');
    setBezig(bestanden.length > 1 ? 'De afbeeldingen worden klaargemaakt.' : 'De afbeelding wordt klaargemaakt.');

    const nieuweLijst = [];
    let eerste = '';

    for (const f of bestanden) {
      const r = await formulierHulp.verkleinAfbeelding(f);

      if (r.ok) nieuweLijst.push({ naam: r.naam, dataUrl: r.dataUrl });
      else if (!eerste) eerste = r.melding;
    }

    if (!levend.current) return;

    setBezig('');

    setAfbeeldingen((huidig) => {
      const samen = [...huidig, ...nieuweLijst];

      if (samen.length > MAX_AFBEELDINGEN) setFout(`U kunt maximaal ${MAX_AFBEELDINGEN} afbeeldingen tegelijk gebruiken. Kies de pagina's met de vragen.`);

      return samen.slice(0, MAX_AFBEELDINGEN);
    });

    if (eerste) setFout(eerste);
  };

  const leesBestand = async (f) => {
    setFout('');

    if (isAfbeelding(f)) {
      await voegAfbeeldingenToe([f]);

      return;
    }

    if (/^image\//i.test(String(f.type || ''))) {
      setFout('Kies een afbeelding als PNG, JPG of WebP.');

      return;
    }

    setBezig('Het bestand wordt gelezen.');

    const t = await formulierHulp.extraheerTekst(f);

    if (!levend.current) return;

    if (t && tekenTelling(t) >= MIN_FORMULIER_TEKENS) {
      setBezig('');
      setTekst(t);
      setBestand(f.name);

      return;
    }

    // Een PDF zonder selecteerbare tekst is meestal een scan: die lezen we als afbeeldingen.
    const isPdf = /pdf$/i.test(String(f.type || '')) || /\.pdf$/i.test(String(f.name || ''));

    if (isPdf) {
      setBezig('Dit lijkt een scan. De pagina’s worden klaargemaakt om te lezen.');

      const p = await formulierHulp.pdfAlsAfbeeldingen(f);

      if (!levend.current) return;

      setBezig('');

      if (p && p.ok) {
        setAfbeeldingen((huidig) => [...huidig, ...p.paginas.map((dataUrl, i) => ({ naam: `${f.name} (pagina ${i + 1})`.slice(0, 80), dataUrl }))].slice(0, MAX_AFBEELDINGEN));

        if (p.totaal > p.paginas.length) setFout(`Alleen de eerste ${p.paginas.length} pagina’s worden gelezen. Is er meer? Gebruik dan een uitsnede met de vragen.`);

        return;
      }
    }

    setBezig('');
    setFout('In dit bestand kon geen tekst worden gelezen. Gebruik een Word-bestand (.docx), een PDF, een screenshot of foto van de vragen, of plak de vragen.');
  };

  const plakAfbeelding = (e) => {
    const items = e.clipboardData && e.clipboardData.files ? [...e.clipboardData.files].filter(isAfbeelding) : [];

    if (!items.length) return;

    e.preventDefault();
    voegAfbeeldingenToe(items);
  };

  const lees = async () => {
    setFout('');
    setMelding('');
    setBezig(afbeeldingen.length ? 'Uw formulier wordt gelezen en de vragen en de stukken worden eruit gehaald. Dit duurt even.' : 'De vragen en de stukken worden uit uw formulier gehaald. Dit duurt even.');

    const r = await leesFormulier({ projectId: project.id, aanvraagId, formulierTekst: tekst, afbeeldingen: afbeeldingen.map((a) => a.dataUrl) });

    if (!levend.current) return;

    setBezig('');
    assistent.ververs();

    if (!r.ok) {
      zegFout(r);

      return;
    }

    setLijst(r.antwoord.vragen.lijst);
    setStukken(r.antwoord.stukken);
    setAfbeeldingen([]);
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
      onStand({ bevestigd: true, lijst: r.antwoord.vragen.lijst, stukken: r.antwoord.stukken });
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
          Veel formulieren zitten achter een inlog. Daar kunnen wij niet in kijken. Voeg het formulier hier toe als Word-bestand, PDF, screenshot of foto, of plak de vragen in het tekstvak. U kunt ook een screenshot plakken (Ctrl+V of ⌘V). Wij lezen eruit hoeveel vragen er zijn en hoeveel tekens elk antwoord mag hebben. Een Word-bestand of PDF met tekst blijft op uw computer; alleen de tekst gaat mee. Een afbeelding wordt verkleind en naar onze server gestuurd om te worden gelezen; wij bewaren die niet.
        </p>
        <Melding toon="waarschuwing" testid="aa-limiet-attentie">
          {LIMIET_ATTENTIE}
        </Melding>

        <div style={css('margin-top: 14px;')}>
          <label htmlFor="aa-formulier-tekst" className="fwk-aa-label">
            Vragen uit het formulier{bestand ? ` (uit ${bestand})` : ''}
          </label>
          <textarea id="aa-formulier-tekst" data-testid="aa-formulier-tekst" className="fwk-aa-veld" rows={8} value={tekst} onChange={(e) => setTekst(e.target.value)} onPaste={plakAfbeelding} placeholder="Plak hier de vragen, bijvoorbeeld: 1. Beschrijf de aanleiding van uw project (max. 1500 tekens) …" />
          {afbeeldingen.length > 0 && (
            <ul style={css('list-style: none; margin: 10px 0 0; padding: 0; display: flex; gap: 10px; flex-wrap: wrap;')} data-testid="aa-formulier-afbeeldingen" aria-label="Afbeeldingen van het formulier">
              {afbeeldingen.map((a, i) => (
                <li key={`${a.naam}-${i}`} style={css('display: flex; flex-direction: column; gap: 4px; width: 112px;')}>
                  <img src={a.dataUrl} alt={`Voorbeeld van ${a.naam}`} style={css('width: 112px; height: 80px; object-fit: cover; object-position: top; border: 1px solid var(--fwk-border, #D8DEE4); border-radius: 8px; background: #fff;')} />
                  <span className="fwk-aa-klein" style={css('overflow: hidden; text-overflow: ellipsis; white-space: nowrap;')} title={a.naam}>{a.naam}</span>
                  <button type="button" className="fwk-wp-link" disabled={Boolean(bezig)} onClick={() => setAfbeeldingen((l) => l.filter((_, n) => n !== i))} aria-label={`Haal ${a.naam} weg`}>
                    Weghalen
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div style={css('display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; align-items: center; margin-top: 6px;')} className="fwk-aa-klein">
            <span>{tekenTelling(tekst).toLocaleString('nl-NL')} tekens</span>
            <span>
              <input
                ref={invoer}
                type="file"
                accept=".docx,.pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                multiple
                data-testid="aa-formulier-bestand"
                aria-label="Word-bestand, PDF of afbeelding met de vragen"
                style={css('position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none;')}
                onChange={(e) => {
                  const fs = e.target.files ? [...e.target.files] : [];

                  e.target.value = '';

                  const fotos = fs.filter(isAfbeelding);

                  if (fotos.length > 1 || (fotos.length === 1 && fs.length === 1)) voegAfbeeldingenToe(fotos);
                  else if (fs[0]) leesBestand(fs[0]);
                }}
              />
              <Button variant="outline" size="s" onClick={() => invoer.current && invoer.current.click()} disabled={Boolean(bezig)}>
                Word, PDF of afbeelding kiezen
              </Button>
            </span>
          </div>
        </div>

        <div style={css('display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 16px;')}>
          <Button onClick={lees} disabled={Boolean(bezig) || (tekenTelling(tekst) < MIN_FORMULIER_TEKENS && afbeeldingen.length === 0)} ariaLabel="Maak een vragenlijst en een lijst met stukken">
            Maak een vragenlijst en een lijst met stukken →
          </Button>
          <span className="fwk-aa-klein">Dit telt als één formulier lezen van uw maandruimte, ook met meerdere afbeeldingen.</span>
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
            Ga verder met de antwoorden →
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
