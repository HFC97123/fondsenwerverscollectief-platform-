// Read-only voorstelpreview met verificatieblok per regel (Fase C). Toont wat de SERVER heeft vastgesteld; de interface bepaalt zelf niets.
// Geen knoppen die schrijven, geen opslag, geen koppeling met chat of taken. Fail-safe: bij een fout staat er alleen een melding.
import React, { useMemo } from 'react';
import { css } from '../../../shared/lib/css.js';
import { bouwPreviewModel, PREVIEW_FOUT } from './voorstelPreviewModel.js';

const TEKST = "font-family: 'Mulish', sans-serif; font-size: 14px; line-height: 1.55; color: #4B5C58;";
const LABEL = "font-family: 'Mulish', sans-serif; font-size: 11.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #7B8985;";

const STATUS_STIJL = {
  geverifieerd: { bg: '#E3F2E8', rand: '#B7DCC4', kleur: '#2F7A4D', teken: '✓' },
  gedeeltelijk: { bg: '#E6EFF6', rand: '#BFD5E6', kleur: '#2C4A5E', teken: '◐' },
  onzeker: { bg: '#FBF1E3', rand: '#EEDCC0', kleur: '#8A5A16', teken: '?' },
  conflict: { bg: '#FBE9E7', rand: '#F0C4BE', kleur: '#A3382B', teken: '!' },
  niet_gecontroleerd: { bg: '#EEF1F0', rand: '#D8DFDC', kleur: '#5D6B67', teken: '–' },
};

const VELD_STIJL = {
  confirmed: { kleur: '#2F7A4D', teken: '✓', label: 'Bevestigd' },
  uncertain: { kleur: '#8A5A16', teken: '?', label: 'Onzeker' },
  conflict: { kleur: '#A3382B', teken: '!', label: 'Conflict' },
  not_checked: { kleur: '#7B8985', teken: '–', label: 'Niet gecontroleerd' },
};

function Badge({ status, children }) {
  const s = STATUS_STIJL[status] || STATUS_STIJL.niet_gecontroleerd;

  return (
    <span
      data-testid="verificatie-status"
      data-status={status}
      style={css(`display: inline-flex; align-items: center; gap: 6px; padding: 3px 11px; border-radius: 999px; border: 1px solid ${s.rand}; background: ${s.bg}; color: ${s.kleur}; font-family: 'Mulish', sans-serif; font-size: 12.5px; font-weight: 800;`)}
    >
      <span aria-hidden="true">{s.teken}</span>
      {children}
    </span>
  );
}

function Verificatie({ v, reden, eindgebruikerTekst }) {
  const melding = reden || eindgebruikerTekst || v.melding;

  return (
    <div data-testid="verificatieblok" data-status={v.status} style={css('display: flex; flex-direction: column; gap: 8px; padding: 12px 14px; border-radius: 14px; background: #F7F9F8; border: 1px solid #E1EAE4;')}>
      <div style={css('display: flex; align-items: center; gap: 10px; flex-wrap: wrap;')}>
        <Badge status={v.status}>{v.label}</Badge>
        {v.gecontroleerdOp && <span style={css(`${TEKST} font-size: 12.5px; color: #7B8985;`)}>Gecontroleerd op {v.gecontroleerdOp}</span>}
      </div>

      {melding && (
        <div data-testid="verificatie-melding" style={css(`${TEKST} font-size: 13px;`)}>
          {melding}
        </div>
      )}

      {v.velden.length > 0 && (
        <ul data-testid="verificatie-velden" style={css('list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px;')}>
          {v.velden.map((f) => {
            const s = VELD_STIJL[f.status] || VELD_STIJL.not_checked;

            return (
              <li key={f.label} data-testid="verificatie-veld" data-veld={f.label} data-status={f.status} style={css(`${TEKST} font-size: 13px; display: flex; flex-direction: column; gap: 2px;`)}>
                <span>
                  <span aria-hidden="true" style={css(`color: ${s.kleur}; font-weight: 800; display: inline-block; width: 16px;`)}>{s.teken}</span>
                  <strong>{f.label}</strong>: <span style={css(`color: ${s.kleur}; font-weight: 700;`)}>{s.label}</span>
                </span>
                {f.status === 'conflict' && (
                  <span data-testid="verificatie-conflict" style={css('padding-left: 16px; color: #A3382B;')}>
                    Website van de financier: {f.online || 'onbekend'} · Onze database: {f.database || 'onbekend'}. Controleer de actuele gegevens bij de financier.
                    {f.fragment && <em style={css('display: block; color: #6D7C77;')}>“{f.fragment}”</em>}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {v.nietGecontroleerdOverig.length > 0 && (
        <div style={css(`${TEKST} font-size: 12.5px; color: #7B8985;`)}>Niet gecontroleerd: {v.nietGecontroleerdOverig.join(', ')}.</div>
      )}

      {v.bronUrl && (
        <div style={css(`${TEKST} font-size: 12.5px;`)}>
          Bron:{' '}
          <a data-testid="verificatie-bron" href={v.bronUrl} target="_blank" rel="noopener noreferrer nofollow" style={css('color: #4E9A6C; font-weight: 800; word-break: break-all;')}>
            {v.bronUrl}
          </a>
        </div>
      )}
    </div>
  );
}

export default function VoorstelPreview({ antwoord }) {
  const model = useMemo(() => bouwPreviewModel(antwoord), [antwoord]);

  if (!model.ok) {
    return (
      <section data-testid="voorstel-preview" data-toestand="fout" role="alert" style={css(`${TEKST} padding: 14px 18px; border: 1px solid #EEDCC0; border-radius: 16px; background: #FBF1E3; color: #8A5A16;`)}>
        {model.melding || PREVIEW_FOUT}
      </section>
    );
  }

  return (
    <section data-testid="voorstel-preview" data-toestand="ok" data-opgeslagen="nee" style={css('box-sizing: border-box; padding: 20px 22px; border: 1px solid #CFE4D7; border-radius: 20px; background: #FFFFFF; display: flex; flex-direction: column; gap: 14px;')}>
      <div>
        <h2 style={css(`${LABEL} margin: 0 0 4px;`)}>Voorstel van Subsidiekompas (voorbeeld)</h2>
        <div data-testid="voorstel-niet-opgeslagen" style={css(`${TEKST} font-weight: 700; color: #2C4A5E;`)}>
          Dit is alleen een voorbeeld. Er is niets opgeslagen en er zijn geen taken aangemaakt.
        </div>
        {model.totalen.voorgesteld && (
          <div data-testid="voorstel-totalen" style={css(`${TEKST} font-size: 13px;`)}>
            Voorgesteld: <strong>{model.totalen.voorgesteld}</strong>
            {model.totalen.gat && <> · Nog te plannen: {model.totalen.gat}</>}
            {model.totalen.nietToegewezen && <> · Nog niet toegewezen: {model.totalen.nietToegewezen}</>}
          </div>
        )}
      </div>

      {model.regels.length === 0 && <div style={css(TEKST)}>Er zijn geen regels om te tonen.</div>}

      {model.regels.map((r) => (
        <article key={r.sleutel} data-testid="voorstel-regel" data-sleutel={r.sleutel} style={css('display: flex; flex-direction: column; gap: 10px; padding: 16px; border: 1px solid #E1EAE4; border-radius: 16px;')}>
          <div style={css('display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; align-items: baseline;')}>
            <div style={css('min-width: 0;')}>
              <div style={css(LABEL)}>{r.soort}</div>
              <div data-testid="voorstel-regel-naam" style={css(`${TEKST} font-weight: 800; color: #2C4A5E; font-size: 16px;`)}>{r.naam}</div>
              {r.gever && r.gever !== r.naam && <div style={css(`${TEKST} font-size: 13px;`)}>{r.gever}</div>}
            </div>
            <div style={css('text-align: right;')}>
              <div data-testid="voorstel-regel-bedrag" style={css(`${TEKST} font-weight: 800; color: #2C4A5E; font-size: 16px;`)}>{r.bedragTekst || 'Geen bedrag voorgesteld'}</div>
              {r.bedragAangepast && <div style={css(`${TEKST} font-size: 12px; color: #8A5A16;`)}>Aangepast aan de grenzen van de regeling</div>}
            </div>
          </div>

          {(r.deadlineTekst || r.grenzenTekst) && (
            <div style={css(`${TEKST} font-size: 13px; color: #6D7C77;`)}>
              {r.deadlineTekst && <span data-testid="voorstel-regel-deadline">Deadline volgens onze database: {r.deadlineTekst}</span>}
              {r.deadlineTekst && r.grenzenTekst && ' · '}
              {r.grenzenTekst && <span>Bijdrage: {r.grenzenTekst}</span>}
            </div>
          )}

          {r.staatAl && <div style={css(`${TEKST} font-size: 13px; color: #8A5A16;`)}>Staat al in uw dekkingsplan en wordt niet opnieuw toegevoegd.</div>}
          {r.motivatie && <div style={css(`${TEKST} font-size: 13.5px;`)}>{r.motivatie}</div>}
          {r.onzekerheden.length > 0 && (
            <ul style={css(`${TEKST} font-size: 13px; margin: 0; padding-left: 18px; color: #6D7C77;`)}>
              {r.onzekerheden.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          )}

          <Verificatie v={r.verificatie} reden={r.reden} eindgebruikerTekst={r.eindgebruikerTekst} />
        </article>
      ))}

      {model.aantalOvergeslagen > 0 && (
        <div data-testid="voorstel-overgeslagen" style={css(`${TEKST} font-size: 13px; color: #7B8985;`)}>
          {model.aantalOvergeslagen === 1 ? '1 voorgestelde regel is' : `${model.aantalOvergeslagen} voorgestelde regels zijn`} niet getoond, omdat de gegevens niet beschikbaar of niet te controleren zijn.
        </div>
      )}
    </section>
  );
}
