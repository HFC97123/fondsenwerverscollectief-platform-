// Stap 1 van een nieuwe aanvraag: welk fonds, en waar staan de beoordelingscriteria van het fonds? De website (tot twee pagina's) en/of de vragen uit
// het aanvraagformulier (Word-bestand of geplakt). Staan beide er, dan gaan de vragen van het lid voor de website. Voor Pro en Premium werkt dit hetzelfde.
import React, { useRef, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { Button } from '../../../shared/ui/index.js';
import { Blok, Melding } from '../../../shared/ui/werkplek.jsx';
import { haalCriteriaOp } from '../../../data/services/aanvraagAssistent.js';
import { AanvraagStijl, Bezig, PrivaatfondsKaart, RuimteBlok, Stappen } from './Bouwstenen.jsx';
import { schoneUrls, tekenTelling } from './aanvraagModel.js';
import { leesWordBestand } from './wordUpload.js';

const MIN_FORMULIER_TEKENS = 20;

export default function NieuweAanvraag({ project, fondsStart = '', websiteStart = '', assistent, onKlaar, onTerug }) {
  const [fonds, setFonds] = useState(fondsStart);
  const [urls, setUrls] = useState([websiteStart || '']);
  const [formulier, setFormulier] = useState('');
  const [plakken, setPlakken] = useState(false);
  const [bestand, setBestand] = useState('');
  const [over, setOver] = useState(false);
  const [bezig, setBezig] = useState('');
  const [fout, setFout] = useState('');
  const [waarschuwing, setWaarschuwing] = useState('');
  const invoer = useRef(null);

  const geldig = schoneUrls(urls);
  const formulierOk = tekenTelling(formulier) >= MIN_FORMULIER_TEKENS;
  const kan = fonds.trim().length >= 2 && (geldig.urls.length > 0 || formulierOk) && !bezig;

  const leesBestand = async (f) => {
    setFout('');
    setBezig('Het bestand wordt gelezen.');

    const r = await leesWordBestand(f);

    setBezig('');

    if (!r.ok) {
      setFout(r.melding);

      return;
    }

    setFormulier(r.tekst);
    setBestand(f.name);
    setPlakken(true);
  };

  const ophalen = async () => {
    setFout('');
    setWaarschuwing(geldig.ongeldig ? `${geldig.ongeldig === 1 ? 'Een adres' : `${geldig.ongeldig} adressen`} was geen geldig webadres en is overgeslagen.` : '');
    setBezig('Subsidie Kompas leest de bronnen en zet de criteria op een rij. Dit duurt even.');

    const r = await haalCriteriaOp({ projectId: project.id, fondsLabel: fonds.trim(), websiteUrls: geldig.urls, formulierTekst: formulierOk ? formulier : '' });

    setBezig('');
    assistent.ververs();

    if (!r.ok) {
      setFout(r.melding);

      return;
    }

    onKlaar({
      aanvraagId: r.antwoord.aanvraagId || '',
      fondsLabel: fonds.trim(),
      voorlopig: { eisen: r.antwoord.eisen || [], bronnen: r.antwoord.bronnen || [], inlogSignaal: Boolean(r.antwoord.inlogSignaal), beperkteLijst: Boolean(r.antwoord.beperkteLijst), opgeslagen: r.antwoord.opgeslagen !== false, formulierTekst: formulierOk ? formulier : '' },
    });
  };

  return (
    <div data-testid="aa-nieuw">
      <AanvraagStijl />
      <Stappen actief={1} />

      <div className="fwk-wp-kolommen">
        <div className="fwk-wp-stapel">
          <Blok titel="Voor welk fonds?">
            <label htmlFor="aa-fonds" className="fwk-aa-label">
              Fonds of regeling
            </label>
            <input id="aa-fonds" data-testid="aa-fonds" className="fwk-aa-veld" type="text" maxLength={200} value={fonds} onChange={(e) => setFonds(e.target.value)} placeholder="Bijvoorbeeld Stichting Voorbeeldfonds" />
          </Blok>

          <Blok titel="Waar staan de beoordelingscriteria van het fonds?">
            <p className="fwk-aa-klein" style={css('margin: 0 0 16px;')}>
              We beginnen bij de website. Staat er meer in het online formulier, laat ons dan de vragen zien.
            </p>

            <div className="fwk-aa-optie" data-accent="true">
              <h3>De website van het fonds lezen</h3>
              <p>Plak het adres van de pagina met de aanvraagvoorwaarden. U kunt er twee toevoegen.</p>
              <div style={css('display: flex; flex-direction: column; gap: 10px;')}>
                {urls.map((u, i) => (
                  <input key={i} data-testid={`aa-url-${i}`} className="fwk-aa-veld" type="url" aria-label={`Adres van pagina ${i + 1}`} value={u} placeholder="https://www.voorbeeldfonds.nl/aanvragen" onChange={(e) => setUrls((cur) => cur.map((x, j) => (j === i ? e.target.value : x)))} />
                ))}
              </div>
              {urls.length < 2 && (
                <div style={css('margin-top: 10px;')}>
                  <Button variant="outline" size="s" onClick={() => setUrls((cur) => [...cur, ''])}>
                    + Nog een pagina
                  </Button>
                </div>
              )}
            </div>

            <div className="fwk-aa-klein" style={css('text-align: center; margin: 14px 0;')}>
              en / of
            </div>

            <div className="fwk-aa-optie">
              <h3>De vragen uit het aanvraagformulier</h3>
              <p>Veel fondsen werken met een online formulier achter een inlog. Daar kan Subsidie Kompas niet in kijken. Kopieer de vragen naar een Word-bestand en upload dat hier, of plak ze. Uw vragen worden de leidraad voor het schrijven en het beoordelen.</p>

              <div
                className="fwk-aa-drop"
                data-over={over ? 'true' : 'false'}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(true);
                }}
                onDragLeave={() => setOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(false);

                  const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];

                  if (f) leesBestand(f);
                }}
              >
                <div style={css('font-weight: 800;')}>Sleep een Word-bestand hierheen</div>
                <div className="fwk-aa-klein" style={css('margin: 4px 0 12px;')}>
                  of kies een bestand van uw computer (.docx)
                </div>
                <input
                  ref={invoer}
                  type="file"
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  data-testid="aa-bestand"
                  aria-label="Word-bestand met de vragen"
                  style={css('position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none;')}
                  onChange={(e) => {
                    const f = e.target.files && e.target.files[0];

                    e.target.value = '';

                    if (f) leesBestand(f);
                  }}
                />
                <span style={css('display: inline-flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: center;')}>
                  <Button variant="outline" size="s" onClick={() => invoer.current && invoer.current.click()}>
                    Bestand kiezen
                  </Button>
                  <span className="fwk-aa-klein">of</span>
                  <Button variant="outline" size="s" onClick={() => setPlakken((v) => !v)}>
                    {plakken ? 'Tekstvak verbergen' : 'Vragen plakken'}
                  </Button>
                </span>
              </div>

              {plakken && (
                <div style={css('margin-top: 12px;')}>
                  <label htmlFor="aa-formulier" className="fwk-aa-label">
                    Vragen uit het formulier{bestand ? ` (uit ${bestand})` : ''}
                  </label>
                  <textarea id="aa-formulier" data-testid="aa-formulier" className="fwk-aa-veld" rows={8} value={formulier} onChange={(e) => setFormulier(e.target.value)} placeholder="Plak hier de vragen, bijvoorbeeld: 1. Beschrijf de aanleiding van uw project …" />
                  <div className="fwk-aa-klein" style={css('margin-top: 6px;')}>
                    {tekenTelling(formulier).toLocaleString('nl-NL')} tekens
                  </div>
                </div>
              )}
            </div>

            <div style={css('display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin-top: 22px;')}>
              <span className="fwk-aa-klein">Staan beide er, dan gaan uw formuliervragen voor de website.</span>
              <span style={css('display: inline-flex; gap: 10px; flex-wrap: wrap;')}>
                <Button variant="outline" onClick={onTerug} disabled={Boolean(bezig)}>
                  Terug
                </Button>
                <Button onClick={ophalen} disabled={!kan} ariaLabel="Criteria ophalen">
                  Criteria ophalen →
                </Button>
              </span>
            </div>
            {bezig && (
              <div style={css('margin-top: 14px;')}>
                <Bezig>{bezig}</Bezig>
              </div>
            )}
            {waarschuwing && (
              <div style={css('margin-top: 14px;')}>
                <Melding toon="waarschuwing">{waarschuwing}</Melding>
              </div>
            )}
            {fout && (
              <div style={css('margin-top: 14px;')}>
                <Melding toon="fout" testid="aa-nieuw-fout">
                  {fout}
                </Melding>
              </div>
            )}
          </Blok>
        </div>

        <div className="fwk-wp-stapel">
          <RuimteBlok status={assistent.status} />
          <Blok titel="Zo werkt het">
            <ol style={css('margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 10px;')} className="fwk-aa-tekst">
              <li>Wij maken een lijst van de criteria, met de plek waar ze staan.</li>
              <li>U controleert die lijst en past hem aan.</li>
              <li>Daarna kiest u: een versie voor dit fonds schrijven, een eigen aanvraag laten beoordelen, of allebei.</li>
            </ol>
          </Blok>
          <PrivaatfondsKaart fondsLabel={fonds} />
        </div>
      </div>
    </div>
  );
}
