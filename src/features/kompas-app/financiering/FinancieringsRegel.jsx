// Gedeelde, compacte financieringsregel: "compact dekkingsplan, details on demand". Wordt gebruikt door de voorstelpreview en is bedoeld om
// later ook de opgeslagen Projectfinanciering / Dekkingsplan-weergave te dragen. Dit bestand kent GEEN voorstel-, verificatie- of opslaglogica:
// de aanroeper levert de kopregel (titel, bedrag, status, korte samenvatting) en de details (children).
//
// Standaard ingeklapt. Elke regel klapt onafhankelijk open of dicht (geen accordion: meerdere mogen tegelijk open staan).
// Toegankelijk: de hele kopregel is één <button> met aria-expanded en aria-controls; Enter en spatie werken van nature; het detailpaneel is een
// region die gekoppeld is aan de knop en met `hidden` uit de toegankelijkheidsboom en tab-volgorde blijft zolang de regel dicht is.
// Het enige wat deze component doet met een klik is lokale open/dicht-state wisselen: geen netwerk, geen opslag.
import React, { useId, useState } from 'react';
import { css } from '../../../shared/lib/css.js';

const TEKST = "font-family: 'Mulish', sans-serif; font-size: 14px; line-height: 1.5; color: #4B5C58;";

const STIJL = `
.fwk-fr-kop { appearance: none; -webkit-appearance: none; width: 100%; box-sizing: border-box; min-height: 56px; margin: 0; padding: 10px 14px; border: 0; background: transparent; text-align: left; cursor: pointer; display: grid; grid-template-columns: minmax(0, 1fr) auto 28px; column-gap: 12px; row-gap: 2px; align-items: center; border-radius: 14px; font: inherit; color: inherit; }
.fwk-fr-kop:hover { background: #F3F9F5; }
.fwk-fr-kop:focus-visible { outline: 2px solid #4E9A6C; outline-offset: 2px; }
.fwk-fr-kop[data-extra="ja"] { grid-template-columns: minmax(0, 1fr) auto auto 28px; }
.fwk-fr-extra { text-align: left; white-space: nowrap; min-width: 190px; }
@media (max-width: 640px) { .fwk-fr-kop[data-extra="ja"] { grid-template-columns: minmax(0, 1fr) auto 28px; } .fwk-fr-extra { grid-column: 1 / span 2; grid-row: 3; text-align: left; white-space: normal; } }
.fwk-fr-chevron { grid-column: -2; grid-row: 1 / span 2; justify-self: center; transition: transform 120ms ease; display: inline-flex; }
.fwk-fr[data-open="ja"] .fwk-fr-chevron { transform: rotate(180deg); }
@media (prefers-reduced-motion: reduce) { .fwk-fr-chevron { transition: none; } }
`;

const STATUS_KLEUR = {
  geverifieerd: '#2F7A4D',
  gedeeltelijk: '#2C4A5E',
  onzeker: '#8A5A16',
  conflict: '#A3382B',
  niet_gecontroleerd: '#5D6B67',
  // Bronstatus (voorstel): de bron wordt gecontroleerd, is gecontroleerd, of de controle is mislukt. Los van de financieringsstatus.
  controleren: '#2C4A5E',
  gecontroleerd: '#2F7A4D',
  mislukt: '#A3382B',
};

const STATUS_TEKEN = { geverifieerd: '✓', gedeeltelijk: '◐', onzeker: '?', conflict: '!', niet_gecontroleerd: '–', controleren: '…', gecontroleerd: '✓', mislukt: '!' };

// props:
//   titel        string          naam van de regeling of het fonds
//   bedrag       string|null     al opgemaakt ("€ 25.000"); null toont `bedragLeeg`
//   bedragLeeg   string          tekst als er geen bedrag is
//   status       { sleutel, label } | null   compacte status naast de samenvatting (sleutel bepaalt kleur en teken)
//   samenvatting string|null     compacte tweede regel, bijvoorbeeld "deadline 12 nov"
//   defaultOpen  boolean         standaard false
//   open, onToggle   optioneel: gecontroleerde variant (de aanroeper bewaart de state)
//   extra        node|null       optionele kolom rechts naast het bedrag (bijvoorbeeld de bandbreedte van de bijdrage)
//   testId       string
//   children     de details
export default function FinancieringsRegel({ titel, bedrag, bedragLeeg = 'Geen bedrag', status = null, samenvatting = null, extra = null, defaultOpen = false, open: openProp, onToggle, testId = 'financieringsregel', children, ...rest }) {
  const [openIntern, setOpenIntern] = useState(Boolean(defaultOpen));
  const id = useId();
  const gecontroleerd = typeof openProp === 'boolean';
  const open = gecontroleerd ? openProp : openIntern;
  const kopId = `${id}-kop`;
  const paneelId = `${id}-paneel`;
  const wissel = () => {
    if (!gecontroleerd) setOpenIntern((v) => !v);
    if (typeof onToggle === 'function') onToggle(!open);
  };
  const kleur = status ? STATUS_KLEUR[status.sleutel] || STATUS_KLEUR.niet_gecontroleerd : null;

  return (
    <article className="fwk-fr" data-testid={testId} data-open={open ? 'ja' : 'nee'} style={css('border: 1px solid #E1EAE4; border-radius: 16px; background: #FFFFFF;')} {...rest}>
      <style>{STIJL}</style>
      <h3 style={css('margin: 0; font: inherit;')}>
        <button type="button" id={kopId} className="fwk-fr-kop" data-testid={`${testId}-kop`} aria-expanded={open} aria-controls={paneelId} onClick={wissel} data-extra={extra ? 'ja' : 'nee'}>
          <span data-testid="financieringsregel-titel" style={css(`${TEKST} font-weight: 800; color: #2C4A5E; font-size: 15.5px; min-width: 0; overflow-wrap: anywhere;`)}>{titel}</span>
          <span data-testid="financieringsregel-bedrag" style={css(`${TEKST} font-weight: 800; color: #2C4A5E; font-size: 15.5px; white-space: nowrap; text-align: right;${bedrag ? '' : ' font-weight: 600; font-size: 13px; color: #7B8985;'}`)}>{bedrag || bedragLeeg}</span>
          {extra && (
            <span className="fwk-fr-extra" data-testid="financieringsregel-extra" style={css(`${TEKST} font-size: 12.5px; color: #687974;`)}>
              {extra}
            </span>
          )}
          <span className="fwk-fr-chevron" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#4B5C58" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7l5 5 5-5" /></svg>
          </span>
          {(status || samenvatting) && (
            <span data-testid="financieringsregel-samenvatting" style={css(`${TEKST} grid-column: 1 / -2; font-size: 13px; color: #6D7C77; min-width: 0;`)}>
              {status && (
                <span data-testid="financieringsregel-status" data-status={status.sleutel} style={css(`color: ${kleur}; font-weight: 800;`)}>
                  <span aria-hidden="true">{STATUS_TEKEN[status.sleutel] || '–'} </span>
                  {status.label}
                </span>
              )}
              {status && samenvatting && ' · '}
              {samenvatting}
            </span>
          )}
        </button>
      </h3>
      <div id={paneelId} role="region" aria-labelledby={kopId} hidden={!open} data-testid="financieringsregel-details" style={css('padding: 2px 16px 16px;')}>
        {open && children}
      </div>
    </article>
  );
}
