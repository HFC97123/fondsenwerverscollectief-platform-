// ⋯-menu voor secundaire en destructieve acties (Archiveren, Verwijderen, Bewerken) op projectkaarten en in de
// projectkop. Klein en rustig; een destructieve actie vraagt eerst een bevestiging IN het menu (geen native dialoog).
//
// Toegankelijkheid: knop met aria-haspopup/aria-expanded, menu met role="menu", items role="menuitem";
// pijltjestoetsen, Home/End, Escape (sluit en geeft de focus terug), klik buiten het menu sluit.
// Plaatsing: het menu ligt boven de klikbare kaart (zie klikKaart.js, .fwk-kk-boven).
import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { css } from '../../shared/lib/css.js';

const KNOP =
  "cursor: pointer; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; min-width: 44px; min-height: 44px; padding: 0; border: none; border-radius: 999px; background: transparent; color: #7B8985; font-family: 'Mulish', sans-serif; font-size: 22px; font-weight: 800; line-height: 1;";
const PANEEL =
  'position: absolute; right: 0; top: calc(100% + 2px); z-index: 20; box-sizing: border-box; min-width: 200px; max-width: min(300px, 86vw); padding: 6px; border: 1px solid #E1EAE4; border-radius: 14px; background: #FFFFFF; box-shadow: 0 10px 28px rgba(44, 74, 94, 0.16);';
const ITEM =
  "cursor: pointer; display: flex; align-items: center; width: 100%; box-sizing: border-box; min-height: 44px; padding: 8px 12px; border: none; border-radius: 10px; background: transparent; text-align: left; font-family: 'Mulish', sans-serif; font-size: 14px; font-weight: 700; color: #2C4A5E;";

export const CSS_KAARTMENU = `
.fwk-km-knop:hover, .fwk-km-knop[aria-expanded="true"] { background: #EEF3F0; color: #2C4A5E; }
.fwk-km-knop:focus-visible, .fwk-km-item:focus-visible, .fwk-km-bevestig button:focus-visible { outline: 3px solid #4E9A6C; outline-offset: 1px; }
.fwk-km-item:hover { background: #F2F6F4; }
.fwk-km-item.fwk-km-gevaar { color: #9E3B2C; }
.fwk-km-item.fwk-km-gevaar:hover { background: #FDF6F5; }
`;

// acties: [{ id, label, onSelect, gevaar?, bevestig?: { vraag, knop } }]
export default function KaartMenu({ label = 'Meer acties', acties, testid = 'kaart-menu' }) {
  const [open, setOpen] = useState(false);
  const [bevestig, setBevestig] = useState(null);
  const wortel = useRef(null);
  const knop = useRef(null);
  const items = useRef([]);
  const menuId = useId();

  const sluit = useCallback((focusTerug = true) => {
    setOpen(false);
    setBevestig(null);

    if (focusTerug && knop.current) {
      knop.current.focus();
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const buiten = (e) => {
      if (wortel.current && !wortel.current.contains(e.target)) sluit(false);
    };

    document.addEventListener('mousedown', buiten);
    document.addEventListener('touchstart', buiten);

    return () => {
      document.removeEventListener('mousedown', buiten);
      document.removeEventListener('touchstart', buiten);
    };
  }, [open, sluit]);

  // Bij het openen komt de focus op het eerste item, zodat het toetsenbord direct werkt.
  useEffect(() => {
    if (open && !bevestig && items.current[0]) items.current[0].focus();
  }, [open, bevestig]);

  const toetsen = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      sluit(true);

      return;
    }

    if (bevestig) return;

    const lijst = items.current.filter(Boolean);
    const nu = lijst.indexOf(document.activeElement);
    const volgende = { ArrowDown: nu + 1, ArrowUp: nu - 1, Home: 0, End: lijst.length - 1 }[e.key];

    if (volgende != null && lijst.length) {
      e.preventDefault();
      lijst[(volgende + lijst.length) % lijst.length].focus();
    }
  };

  const kies = (a) => {
    if (a.bevestig) {
      setBevestig(a);

      return;
    }

    sluit(false);
    a.onSelect();
  };

  return (
    <div ref={wortel} data-testid={testid} onKeyDown={open ? toetsen : undefined} style={css('position: relative; display: inline-block;')}>
      <button
        ref={knop}
        type="button"
        className="fwk-km-knop"
        data-testid={`${testid}-knop`}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? sluit(false) : setOpen(true))}
        style={css(KNOP)}
      >
        <span aria-hidden="true">⋯</span>
      </button>

      {open && (
        <div id={menuId} role="menu" aria-label={label} data-testid={`${testid}-menu`} style={css(PANEEL)}>
          {!bevestig &&
            acties.map((a, i) => (
              <button
                key={a.id}
                ref={(el) => {
                  items.current[i] = el;
                }}
                type="button"
                role="menuitem"
                className={`fwk-km-item${a.gevaar ? ' fwk-km-gevaar' : ''}`}
                data-testid={`${testid}-${a.id}`}
                onClick={() => kies(a)}
                style={css(ITEM)}
              >
                {a.label}
              </button>
            ))}

          {bevestig && (
            <div className="fwk-km-bevestig" role="group" aria-label="Bevestigen" data-testid={`${testid}-bevestig`} style={css("padding: 8px 10px 6px; font-family: 'Mulish', sans-serif;")}>
              <div style={css('font-size: 13.5px; line-height: 1.5; color: #4B5C58; margin-bottom: 10px;')}>{bevestig.bevestig.vraag}</div>
              <div style={css('display: flex; gap: 8px; flex-wrap: wrap;')}>
                <button
                  type="button"
                  autoFocus
                  data-testid={`${testid}-bevestig-ja`}
                  onClick={() => {
                    const a = bevestig;

                    sluit(false);
                    a.onSelect();
                  }}
                  style={css("cursor: pointer; min-height: 44px; padding: 8px 14px; border: none; border-radius: 999px; background: #9E3B2C; color: #FFFFFF; font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 800;")}
                >
                  {bevestig.bevestig.knop || bevestig.label}
                </button>
                <button
                  type="button"
                  data-testid={`${testid}-bevestig-nee`}
                  onClick={() => setBevestig(null)}
                  style={css("cursor: pointer; min-height: 44px; padding: 8px 14px; border: 1px solid #D5E0D9; border-radius: 999px; background: #FFFFFF; color: #2C4A5E; font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 800;")}
                >
                  Annuleren
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
