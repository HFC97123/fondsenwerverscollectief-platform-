// Herbruikbaar selectiecomponent voor de vaste classificatielijsten van
// Subsidie Kompas (disciplines, doelgroepen, werkgebieden, en eventuele
// andere lange opsommingen). Vervangt het patroon van "alle opties als
// losse knoppen onder elkaar" (nam bij 80 disciplines de hele pagina in
// beslag) door één compact veld dat pas bij een klik opent.
//
// - Gesloten: neemt ongeveer evenveel ruimte in als een normaal invoerveld.
// - Open: een dropdown met (bij voldoende opties) een zoekveld bovenin, een
//   scrollbare lijst met een maximale hoogte, en - indien aangezet - een
//   "Anders"-regel met een vrij tekstveld onderaan.
// - Geselecteerde waarden staan als verwijderbare chips onder het veld,
//   ook als ze niet (meer) in de optielijst voorkomen (bijvoorbeeld een
//   eerder via "Anders" ingevoerde, of een bestaande vrije-tekstwaarde uit
//   vóór deze classificatie bestond) - zo gaat er nooit stilzwijgend data
//   verloren.
//
// waarde/onChange: bij multi={true} (standaard) is waarde een array
// strings; bij multi={false} is waarde een enkele string ('' als leeg).
import React, { useEffect, useRef, useState } from 'react';
import { css } from '../lib/css.js';
import { color, font, radius, type } from '../tokens.js';

const ZOEK_DREMPEL = 8;

function naarLijst(waarde, multi) {
  if (multi) {
    return Array.isArray(waarde) ? waarde : [];
  }

  return waarde ? [waarde] : [];
}

export default function ClassificatieSelect({
  opties,
  waarde,
  onChange,
  multi = true,
  metAnders = false,
  placeholder = 'Selecteren…',
  andersPlaceholder = 'Eigen omschrijving',
  ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const [zoekterm, setZoekterm] = useState('');
  const [andersInvoer, setAndersInvoer] = useState('');
  const [andersActief, setAndersActief] = useState(false);
  const wrapRef = useRef(null);
  const zoekRef = useRef(null);

  const gekozen = naarLijst(waarde, multi);
  const lijst = opties || [];
  const toonZoekveld = lijst.length > ZOEK_DREMPEL;

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const sluitBijBuitenklik = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setAndersActief(false);
      }
    };
    const sluitBijEscape = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setAndersActief(false);
      }
    };

    document.addEventListener('mousedown', sluitBijBuitenklik);
    document.addEventListener('keydown', sluitBijEscape);

    if (toonZoekveld && zoekRef.current) {
      zoekRef.current.focus();
    }

    return () => {
      document.removeEventListener('mousedown', sluitBijBuitenklik);
      document.removeEventListener('keydown', sluitBijEscape);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const zetWaarde = (nieuweLijst) => {
    onChange(multi ? nieuweLijst : nieuweLijst[0] || '');
  };

  const toggleOptie = (optie) => {
    if (multi) {
      const nieuw = gekozen.indexOf(optie) === -1 ? gekozen.concat([optie]) : gekozen.filter((x) => x !== optie);

      zetWaarde(nieuw);

      return;
    }

    zetWaarde([optie]);
    setOpen(false);
  };

  const verwijderChip = (optie) => {
    if (multi) {
      zetWaarde(gekozen.filter((x) => x !== optie));

      return;
    }

    zetWaarde([]);
  };

  const voegAndersToe = () => {
    const tekst = andersInvoer.trim();

    if (!tekst) {
      return;
    }

    if (multi) {
      if (gekozen.indexOf(tekst) === -1) {
        zetWaarde(gekozen.concat([tekst]));
      }
    } else {
      zetWaarde([tekst]);
      setOpen(false);
    }

    setAndersInvoer('');
    setAndersActief(false);
  };

  const gefilterd = zoekterm.trim()
    ? lijst.filter((o) => o.toLowerCase().indexOf(zoekterm.trim().toLowerCase()) !== -1)
    : lijst;

  const triggerTekst = () => {
    if (!gekozen.length) {
      return placeholder;
    }

    if (multi) {
      return `${gekozen.length} ${gekozen.length === 1 ? 'geselecteerd' : 'geselecteerd'}`;
    }

    return gekozen[0];
  };

  const rijStijl = (actief) =>
    css(`
      cursor: pointer;
      width: 100%;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-height: 40px;
      padding: 8px 12px;
      border: none;
      background: ${actief ? color.vlakGroen : 'transparent'};
      color: ${actief ? color.succes : color.tekst};
      font-family: ${font.tekst};
      font-size: ${type.klein};
      font-weight: ${actief ? '800' : '600'};
      text-align: left;
      border-radius: ${radius.s};
    `);

  return (
    <div ref={wrapRef} style={css('position: relative;')}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        style={css(`
          cursor: pointer;
          width: 100%;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          min-height: 44px;
          padding: 11px 14px;
          border: 1px solid ${open ? color.lijnGroenSterk : color.lijnInput};
          border-radius: ${radius.m};
          background: ${color.wit};
          font-family: ${font.tekst};
          font-size: ${type.bodyKlein};
          font-weight: ${gekozen.length ? '700' : '400'};
          color: ${gekozen.length ? color.tekst : color.tekstLicht};
        `)}
      >
        <span style={css('overflow: hidden; text-overflow: ellipsis; white-space: nowrap;')}>{triggerTekst()}</span>
        <span style={css(`flex-shrink: 0; font-size: 11px; color: ${color.tekstLicht};`)}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div
          style={css(`
            position: absolute;
            z-index: 40;
            top: calc(100% + 6px);
            left: 0;
            right: 0;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            border: 1px solid ${color.lijnInput};
            border-radius: ${radius.m};
            background: ${color.wit};
            box-shadow: 0 8px 24px rgba(44,74,94,0.16);
            overflow: hidden;
          `)}
        >
          {toonZoekveld && (
            <div style={css(`padding: 8px; border-bottom: 1px solid ${color.lijn};`)}>
              <input
                ref={zoekRef}
                value={zoekterm}
                onChange={(e) => setZoekterm(e.target.value)}
                placeholder="Zoeken…"
                aria-label="Zoeken in de lijst"
                style={css(`
                  width: 100%;
                  box-sizing: border-box;
                  min-height: 36px;
                  padding: 8px 10px;
                  border: 1px solid ${color.lijnInput};
                  border-radius: ${radius.s};
                  background: ${color.achtergrond};
                  font-family: ${font.tekst};
                  font-size: ${type.klein};
                  color: ${color.tekst};
                  outline: none;
                `)}
              />
            </div>
          )}

          <div style={css('max-height: 220px; overflow-y: auto; padding: 4px;')}>
            {gefilterd.length === 0 && (
              <div style={css(`padding: 10px 12px; font-size: ${type.klein}; color: ${color.tekstLicht};`)}>
                Niets gevonden.
              </div>
            )}
            {gefilterd.map((optie) => {
              const actief = gekozen.indexOf(optie) !== -1;

              return (
                <button key={optie} type="button" role="option" aria-selected={actief} onClick={() => toggleOptie(optie)} style={rijStijl(actief)}>
                  <span>{optie}</span>
                  {actief && <span aria-hidden="true">✓</span>}
                </button>
              );
            })}
          </div>

          {metAnders && (
            <div style={css(`border-top: 1px solid ${color.lijn}; padding: 6px;`)}>
              {!andersActief ? (
                <button type="button" onClick={() => setAndersActief(true)} style={rijStijl(false)}>
                  <span>+ Anders, zelf invullen…</span>
                </button>
              ) : (
                <div style={css('display: flex; gap: 6px; padding: 4px;')}>
                  <input
                    value={andersInvoer}
                    onChange={(e) => setAndersInvoer(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        voegAndersToe();
                      }
                    }}
                    placeholder={andersPlaceholder}
                    autoFocus
                    style={css(`
                      flex: 1 1 auto;
                      min-width: 0;
                      box-sizing: border-box;
                      min-height: 36px;
                      padding: 8px 10px;
                      border: 1px solid ${color.lijnGroenSterk};
                      border-radius: ${radius.s};
                      background: ${color.wit};
                      font-family: ${font.tekst};
                      font-size: ${type.klein};
                      color: ${color.tekst};
                      outline: none;
                    `)}
                  />
                  <button
                    type="button"
                    onClick={voegAndersToe}
                    style={css(`
                      cursor: pointer;
                      flex-shrink: 0;
                      min-height: 36px;
                      padding: 0 14px;
                      border: none;
                      border-radius: ${radius.s};
                      background: ${color.groen};
                      color: ${color.wit};
                      font-family: ${font.tekst};
                      font-size: ${type.klein};
                      font-weight: 800;
                    `)}
                  >
                    Toevoegen
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {gekozen.length > 0 && (
        <div style={css('display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;')}>
          {gekozen.map((optie) => (
            <span
              key={optie}
              style={css(`
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 5px 6px 5px 12px;
                border: 1px solid ${color.lijnGroenSterk};
                border-radius: ${radius.pil};
                background: ${color.vlakGroen};
                color: ${color.succes};
                font-family: ${font.tekst};
                font-size: 12.5px;
                font-weight: 700;
              `)}
            >
              {optie}
              <button
                type="button"
                onClick={() => verwijderChip(optie)}
                aria-label={`${optie} verwijderen`}
                style={css(`
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  width: 18px;
                  height: 18px;
                  padding: 0;
                  border: none;
                  border-radius: 50%;
                  background: rgba(47,109,71,0.14);
                  color: ${color.succes};
                  font-size: 12px;
                  line-height: 1;
                `)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
