// Collie: de hulpknop rechtsonder in de werkomgeving van Subsidie Kompas (Pro/Premium, niet in de Chat zelf).
// Geen AI en geen netwerk: veelgestelde vragen en een rondleiding uit hulpContent.js. Het paneel onthoudt niets en
// slaat niets op; elke link is een gewone link naar de pagina waar het gebeurt.
import React, { useEffect, useRef, useState } from 'react';
import { css } from '../../../shared/lib/css.js';
import { RONDLEIDING, TOON_RONDLEIDING, VRAGEN, openingsTekst, toonHulp, voorgesteldeVragen, vraagMetId } from './hulpContent.js';

const CSS_HULP = `
.fwk-hulp-knop:focus-visible, .fwk-hulp-chip:focus-visible, .fwk-hulp-link:focus-visible, .fwk-hulp-x:focus-visible { outline: 2px solid #4E9A6C; outline-offset: 2px; }
.fwk-hulp-chip { cursor: pointer; text-align: left; border: 1.5px solid #CFE0D6; background: #FFFFFF; color: #2C4A5E; border-radius: 14px; padding: 9px 12px; font-family: 'Mulish', sans-serif; font-size: 13.5px; font-weight: 700; line-height: 1.4; }
.fwk-hulp-chip:hover { background: #EAF4EE; border-color: #A8D5BA; }
.fwk-hulp-link { display: inline-block; margin: 4px 8px 0 0; padding: 6px 12px; border-radius: 999px; background: #4E9A6C; color: #FFFFFF !important; font-size: 12.5px; font-weight: 800; text-decoration: none; }
.fwk-hulp-link:hover { background: #3F8559; }
.fwk-hulp-klein { cursor: pointer; border: none; background: none; padding: 4px 2px; color: #4E9A6C; font-family: 'Mulish', sans-serif; font-size: 12.5px; font-weight: 800; }
.fwk-hulp-klein:hover { text-decoration: underline; }
@media (prefers-reduced-motion: no-preference) { .fwk-hulp-knop { animation: fwk-hulp-puls 3s ease-in-out 1; } }
@keyframes fwk-hulp-puls { 0%, 100% { box-shadow: 0 6px 20px rgba(44,74,94,0.3); } 50% { box-shadow: 0 6px 26px rgba(78,154,108,0.6); } }
`;

const BOT = "font-family: 'Mulish', sans-serif; align-self: flex-start; max-width: 92%; background: #EAF4EE; color: #2E3A38; padding: 9px 13px; border-radius: 14px 14px 14px 3px; font-size: 13.5px; line-height: 1.5;";
const GEBRUIKER = "font-family: 'Mulish', sans-serif; align-self: flex-end; max-width: 88%; background: #2C4A5E; color: #FFFFFF; padding: 9px 13px; border-radius: 14px 14px 3px 14px; font-size: 13.5px; line-height: 1.5;";

function Links({ links }) {
  if (!links || !links.length) {
    return null;
  }

  return (
    <div style={css('margin-top: 6px;')}>
      {links.map((l) => (
        <a key={l.href} className="fwk-hulp-link" href={l.href}>
          {l.tekst} →
        </a>
      ))}
    </div>
  );
}

export default function KompasHulp({ pad }) {
  const [open, setOpen] = useState(false);
  // scherm: 'start' | 'vragen' | 'antwoord' | 'tour'
  const [scherm, setScherm] = useState('start');
  const [vraagId, setVraagId] = useState(null);
  const [stap, setStap] = useState(0);
  const knopRef = useRef(null);
  const paneelRef = useRef(null);

  // Een routewissel sluit het paneel niet, maar zet het terug naar het begin zodat de voorstellen bij de pagina passen.
  useEffect(() => {
    setScherm('start');
    setVraagId(null);
  }, [pad]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);

        if (knopRef.current) {
          knopRef.current.focus();
        }
      }
    };

    document.addEventListener('keydown', onKey);

    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open && paneelRef.current) {
      paneelRef.current.scrollTop = 0;
    }
  }, [open, scherm, vraagId, stap]);

  if (!toonHulp(pad)) {
    return null;
  }

  const vraag = vraagId ? vraagMetId(vraagId) : null;
  const onderdeel = RONDLEIDING[stap] || RONDLEIDING[0];
  const voorstel = voorgesteldeVragen(pad);

  const kies = (id) => {
    setVraagId(id);
    setScherm('antwoord');
  };

  const naarStart = () => {
    setScherm('start');
    setVraagId(null);
  };

  return (
    <div data-testid="kompas-hulp" style={css("position: fixed; bottom: 20px; right: 20px; z-index: 200; font-family: 'Mulish', sans-serif;")}>
      <style>{CSS_HULP}</style>

      {open && (
        <section
          role="dialog"
          aria-label="Collie, hulp bij Subsidie Kompas"
          data-testid="kompas-hulp-paneel"
          style={css(
            "font-family: 'Mulish', sans-serif; width: 360px; max-width: calc(100vw - 40px); height: 520px; max-height: calc(100vh - 132px); background: #FFFFFF; border-radius: 20px; box-shadow: 0 14px 44px rgba(44,74,94,0.28); display: flex; flex-direction: column; overflow: hidden; position: absolute; bottom: 72px; right: 0;",
          )}
        >
          <div style={css('background: #2C4A5E; padding: 14px 16px; display: flex; align-items: center; gap: 10px; flex-shrink: 0;')}>
            <div style={css('width: 34px; height: 34px; border-radius: 50%; background: #4E9A6C; display: flex; align-items: center; justify-content: center; color: #FFFFFF; font-weight: 700; font-size: 13.5px; flex-shrink: 0;')}>C</div>
            <div style={css('flex-grow: 1; min-width: 0;')}>
              <div style={css('color: #FFFFFF; font-weight: 700; font-size: 14px;')}>Collie</div>
              <div style={css('color: #A9C9DE; font-size: 11.5px;')}>Hulp bij Subsidie Kompas</div>
            </div>
            {scherm !== 'start' && (
              <button type="button" className="fwk-hulp-x" onClick={naarStart} aria-label="Terug naar het begin" title="Terug naar het begin" style={css('cursor: pointer; border: none; background: none; color: #A9C9DE; font-size: 15px; padding: 4px 6px;')}>
                ↺
              </button>
            )}
            <button type="button" className="fwk-hulp-x" onClick={() => setOpen(false)} aria-label="Collie sluiten" style={css('cursor: pointer; border: none; background: none; color: #FFFFFF; font-size: 20px; line-height: 1; padding: 2px 6px;')}>
              ×
            </button>
          </div>

          <div ref={paneelRef} style={css('flex-grow: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 9px; background: #F7F9F8;')}>
            {scherm === 'start' && (
              <>
                <div data-testid="hulp-opening" style={css(BOT)}>{openingsTekst(pad)}</div>
                {TOON_RONDLEIDING && (
                  <button type="button" className="fwk-hulp-chip" data-testid="hulp-rondleiding" onClick={() => { setStap(0); setScherm('tour'); }}>
                    Rondleiding door Subsidie Kompas
                  </button>
                )}
                {voorstel.map((v) => (
                  <button key={v.id} type="button" className="fwk-hulp-chip" data-testid="hulp-voorstel" onClick={() => kies(v.id)}>
                    {v.vraag}
                  </button>
                ))}
                <button type="button" className="fwk-hulp-klein" data-testid="hulp-alle-vragen" onClick={() => setScherm('vragen')} style={css('align-self: flex-start;')}>
                  Alle veelgestelde vragen →
                </button>
              </>
            )}

            {scherm === 'vragen' && (
              <>
                <div style={css(BOT)}>Kies een vraag:</div>
                {VRAGEN.map((v) => (
                  <button key={v.id} type="button" className="fwk-hulp-chip" data-testid="hulp-vraag" onClick={() => kies(v.id)}>
                    {v.vraag}
                  </button>
                ))}
              </>
            )}

            {scherm === 'antwoord' && vraag && (
              <>
                <div style={css(GEBRUIKER)}>{vraag.vraag}</div>
                <div data-testid="hulp-antwoord" style={css(BOT)}>
                  {vraag.antwoord}
                  <Links links={vraag.links} />
                </div>
                <button type="button" className="fwk-hulp-klein" onClick={() => setScherm('vragen')} style={css('align-self: flex-start;')}>
                  Andere vraag →
                </button>
              </>
            )}

            {scherm === 'tour' && (
              <>
                <div style={css('font-size: 11px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase; color: #7B8985;')}>
                  Rondleiding {stap + 1} van {RONDLEIDING.length}
                </div>
                <div data-testid="hulp-tour-stap" style={css(BOT)}>
                  <strong style={css('display: block; color: #2C4A5E; font-size: 14.5px; margin-bottom: 2px;')}>{onderdeel.titel}</strong>
                  {onderdeel.tekst}
                  <Links links={onderdeel.link ? [onderdeel.link] : []} />
                </div>
                <div style={css('display: flex; justify-content: space-between; gap: 8px; margin-top: 4px;')}>
                  <button type="button" className="fwk-hulp-klein" disabled={stap === 0} onClick={() => setStap(stap - 1)} style={css(stap === 0 ? 'opacity: 0.35; cursor: default;' : '')}>
                    ← Vorige
                  </button>
                  {stap < RONDLEIDING.length - 1 ? (
                    <button type="button" className="fwk-hulp-klein" data-testid="hulp-tour-volgende" onClick={() => setStap(stap + 1)}>
                      Volgende →
                    </button>
                  ) : (
                    <button type="button" className="fwk-hulp-klein" onClick={naarStart}>
                      Klaar
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          <div style={css('padding: 8px 14px 10px; font-size: 11px; line-height: 1.4; color: #8FA09B; text-align: center; border-top: 1px solid #E1EAE4; background: #FFFFFF;')}>
            Staat uw vraag er niet bij? Stel hem aan Subsidie Kompas in de <a href="#/kompas" style={css('color: #4E9A6C; font-weight: 800;')}>Chat</a>.
          </div>
        </section>
      )}

      <button
        ref={knopRef}
        type="button"
        className="fwk-hulp-knop"
        data-testid="kompas-hulp-knop"
        aria-expanded={open}
        aria-label={open ? 'Collie sluiten' : 'Open Collie, hulp bij Subsidie Kompas'}
        onClick={() => setOpen((v) => !v)}
        style={css('width: 58px; height: 58px; border: none; border-radius: 50%; background: #4E9A6C; box-shadow: 0 6px 20px rgba(44,74,94,0.3); display: flex; align-items: center; justify-content: center; cursor: pointer;')}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M4 5.5C4 4.67 4.67 4 5.5 4h13c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5H9l-4 3.5v-3.5H5.5C4.67 15.5 4 14.83 4 14v-8.5Z" stroke="#FFFFFF" strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="8.5" cy="9.5" r="1" fill="#FFFFFF" />
          <circle cx="12" cy="9.5" r="1" fill="#FFFFFF" />
          <circle cx="15.5" cy="9.5" r="1" fill="#FFFFFF" />
        </svg>
      </button>
    </div>
  );
}
