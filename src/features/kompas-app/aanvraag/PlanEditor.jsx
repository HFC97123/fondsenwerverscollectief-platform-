// Het geschreven plan: per onderdeel de tekst, wat nog aangevuld moet worden, waarop het rust, en een knop om te kopiëren.
// Het plan is een EERSTE AANZET uit wat het lid zelf vastlegde; het lid beslist en werkt het verder bij (kopiëren of downloaden als Word of PDF).
// Hier wordt niets bewerkt of opgeslagen: de server bewaart het plan, dit scherm toont het.
import React, { useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { Button } from '../../../shared/ui/index.js';
import ExportMenu from '../../../shared/ui/ExportMenu.jsx';
import { bouwDocumentModel } from '../../../shared/export/exportModel.js';
import { Blok, Chip, Melding } from '../../../shared/ui/werkplek.jsx';
import { aantalAanvullenInPlan, planNaarTekst, planSamenvatting, splitsAanvullen } from './aanvraagModel.js';

const STATUS = { geschreven: ['Geschreven', 'groen'], aanvullen: ['Aanvullen', 'oranje'], mislukt: ['Niet gelukt', 'rood'] };

async function kopieer(tekst) {
  try {
    await navigator.clipboard.writeText(tekst);

    return true;
  } catch (e) {
    return false;
  }
}

function SectieTekst({ tekst }) {
  return (
    <div className="fwk-aa-tekst">
      {splitsAanvullen(tekst).map((s, i) =>
        s.aanvullen ? (
          <mark key={i} className="fwk-aa-markering">
            {s.tekst}
          </mark>
        ) : (
          <React.Fragment key={i}>{s.tekst}</React.Fragment>
        ),
      )}
    </div>
  );
}

function Sectie({ sectie, onMelding }) {
  const [label, toon] = STATUS[sectie.status] || STATUS.aanvullen;
  const tekens = String(sectie.tekst || '').replace(/\[aanvullen:[^\]]*\]/gi, '').replace(/\s+/g, ' ').trim().length;

  return (
    <Blok titel={sectie.titel} testid="aa-plan-sectie" actie={<Chip toon={toon}>{label}</Chip>}>
      {sectie.status === 'mislukt' ? (
        <Melding toon="waarschuwing">Dit onderdeel is niet gelukt. Er is niets verzonnen. Schrijf het zelf, of maak het plan later opnieuw.</Melding>
      ) : (
        <SectieTekst tekst={sectie.tekst} />
      )}

      {Array.isArray(sectie.vragen) && sectie.vragen.length > 0 && (
        <div style={css('margin-top: 14px;')} data-testid="aa-plan-vragen">
          <div className="fwk-aa-label">Vragen aan u</div>
          <ul style={css('margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px;')} className="fwk-aa-tekst">
            {sectie.vragen.map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="fwk-aa-chips" style={css('align-items: center; margin-top: 14px;')}>
        {(sectie.herkomst || []).map((h) => (
          <Chip key={h} toon="grijs">
            {h}
          </Chip>
        ))}
        {sectie.maxTekens ? (
          <Chip toon={sectie.overLimiet ? 'rood' : 'grijs'} testid="aa-plan-limiet">
            {sectie.overLimiet ? `Boven de limiet van het fonds: ${tekens} van ${sectie.maxTekens} tekens` : `${tekens} van ${sectie.maxTekens} tekens`}
          </Chip>
        ) : null}
        {sectie.status !== 'mislukt' && (
          <span style={css('margin-left: auto;')}>
            <Button
              variant="outline"
              size="s"
              ariaLabel={`Kopieer de tekst van ${sectie.titel}`}
              onClick={async () => onMelding((await kopieer(sectie.tekst)) ? `De tekst van "${sectie.titel}" is gekopieerd.` : 'Kopiëren lukte niet. Selecteer de tekst en kopieer hem zelf.')}
            >
              Kopieer tekst
            </Button>
          </span>
        )}
      </div>
    </Blok>
  );
}

// plan: het antwoord van de server. titel: bijvoorbeeld de projectnaam of het fonds.
export default function PlanEditor({ plan, titel, projectNaam, store, kop, onSluit, extraActies, opgeslagen = true }) {
  const [melding, setMelding] = useState('');
  const secties = plan && Array.isArray(plan.secties) ? plan.secties : [];
  const nog = aantalAanvullenInPlan(plan);
  const samen = planSamenvatting(plan);

  const bouwModel = async () =>
    bouwDocumentModel({
      tekst: planNaarTekst(plan, titel),
      soort: 'Projectplan',
      organisatieNaam: (store && store.orgProfile && store.orgProfile.name) || null,
      projectNaam: projectNaam || null,
      titel,
    });

  return (
    <div className="fwk-wp-stapel" data-testid="aa-plan">
      <Blok
        titel={kop || titel}
        testid="aa-plan-kop"
        actie={
          <span className="fwk-wp-acties">
            {extraActies}
            <ExportMenu toegestaan uitlijnen="rechts" onMelding={setMelding} ariaLabel="Plan exporteren" bouwModel={bouwModel} />
            {onSluit && (
              <Button variant="outline" size="s" onClick={onSluit}>
                Sluiten
              </Button>
            )}
          </span>
        }
      >
        <p className="fwk-aa-tekst" style={css('margin: 0 0 10px;')}>
          Dit is een eerste aanzet, geschreven uit wat u zelf heeft vastgelegd. Wat we niet wisten, staat als <mark className="fwk-aa-markering">[aanvullen]</mark> met een vraag aan u. U beslist en werkt het verder bij; kopieer de tekst of download hem als Word of PDF.
        </p>
        <div className="fwk-aa-chips">
          {samen && <Chip toon="blauw">{samen}</Chip>}
          {nog > 0 && <Chip toon="oranje">{nog === 1 ? '1 plek om in te vullen' : `${nog} plekken om in te vullen`}</Chip>}
          {plan && plan.uitFormulier && <Chip toon="grijs">Volgt de vragen uit uw formulier</Chip>}
        </div>
        {!opgeslagen && (
          <div style={css('margin-top: 12px;')}>
            <Melding toon="waarschuwing">Het plan is gemaakt, maar kon niet worden bewaard. Kopieer of download het nu, anders is het weg zodra u deze pagina verlaat.</Melding>
          </div>
        )}
        {melding && (
          <div style={css('margin-top: 12px;')}>
            <Melding toon="info">{melding}</Melding>
          </div>
        )}
      </Blok>

      {secties.map((s) => (
        <Sectie key={s.id} sectie={s} onMelding={setMelding} />
      ))}
    </div>
  );
}
