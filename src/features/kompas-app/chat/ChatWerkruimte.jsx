// Layout van de Pro/Premium-chatwerkruimte: GESPREKKEN | CHAT, en alleen bij een actief project ook PROJECTOVERZICHT.
//
// Dit bestand bepaalt UITSLUITEND de plaatsing. De chat zelf (berichten, streaming, invoer, exports,
// documentgeneratie, bevestigingen) blijft in KompasToolPage en wordt hier alleen als `children` in het
// midden gerenderd.
//
//   modus 'drie'    (>= 1200 px)  : vaste linkerkolom (gesprekken) en chat; ALLEEN als `rechts` is meegegeven
//                                    (er is een actief project) ook een vaste rechterkolom met het projectoverzicht.
//                                    Zonder `rechts` bestaat die kolom niet: geen lege kolom, de chat krijgt de ruimte.
//                                    Beide kolommen zijn in te klappen tot een smalle strook met een knop om ze weer uit te
//                                    klappen (de keuze wordt per apparaat onthouden). Ingeklapt blijft de inhoud bestaan
//                                    (alleen verborgen), dus zoekopdrachten en scrollpositie gaan niet verloren.
//                                    Geen lade (dat zou dubbele ingangen geven);
//   modus 'tablet'  (900-1199 px) : chat bijna volledige breedte; de knoppen Gesprekken en (bij een actief project)
//                                    Project openen de bestaande KompasContextDrawer;
//   modus 'mobiel'  (< 900 px)    : idem, de drawer is dan het bestaande bottom-sheet-patroon.
// Nooit een vaste zijbalk en een sheet tegelijk.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { css } from '../../../shared/lib/css.js';

export const BREAKPOINT_DRIE = 1200;
export const BREAKPOINT_MOBIEL = 900;

export function modusVoorBreedte(breedte) {
  return breedte >= BREAKPOINT_DRIE ? 'drie' : breedte >= BREAKPOINT_MOBIEL ? 'tablet' : 'mobiel';
}

export function useWerkruimteModus() {
  const lees = () => (typeof window === 'undefined' ? 'drie' : modusVoorBreedte(window.innerWidth));
  const [modus, setModus] = useState(lees);

  useEffect(() => {
    const onResize = () => setModus(lees());

    window.addEventListener('resize', onResize);
    onResize();

    return () => window.removeEventListener('resize', onResize);
  }, []);

  return modus;
}

// Breedte per kolom via variabelen: open of ingeklapt (een strook van 36 px met alleen de uitklapknop).
const CSS_WERKRUIMTE = `
.fwk-cw-drie { --cw-l: 240px; --cw-r: 300px; display: grid; grid-template-columns: var(--cw-l) minmax(0, 1fr) var(--cw-r); gap: 16px; align-items: stretch; height: calc(100vh - 92px); min-height: 560px; transition: grid-template-columns 0.18s ease; }
.fwk-cw-drie[data-kolommen="2"] { grid-template-columns: var(--cw-l) minmax(0, 1fr); }
.fwk-cw-drie[data-links="dicht"] { --cw-l: 36px; }
.fwk-cw-drie[data-rechts="dicht"] { --cw-r: 36px; }
@media (min-width: 1400px) { .fwk-cw-drie { --cw-l: 260px; --cw-r: 320px; gap: 20px; } .fwk-cw-drie[data-links="dicht"] { --cw-l: 36px; } .fwk-cw-drie[data-rechts="dicht"] { --cw-r: 36px; } }
@media (prefers-reduced-motion: reduce) { .fwk-cw-drie { transition: none; } }
.fwk-cw-inklap { display: flex; }
.fwk-cw-inklap button, .fwk-cw-strook { cursor: pointer; font-family: 'Mulish', sans-serif; font-weight: 800; color: #2C4A5E; }
.fwk-cw-inklap button { margin-left: auto; min-height: 32px; padding: 4px 10px; border: 1px solid #E1EAE4; border-radius: 999px; background: #FFFFFF; font-size: 12.5px; }
.fwk-cw-inklap button:hover, .fwk-cw-strook:hover { background: #EAF4EE; }
.fwk-cw-strook { box-sizing: border-box; width: 36px; height: 100%; min-height: 160px; display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 10px 0; border: 1px solid #E1EAE4; border-radius: 14px; background: #F7F9F8; font-size: 12.5px; }
.fwk-cw-strook span.v { writing-mode: vertical-rl; letter-spacing: 0.04em; }
.fwk-cw-kolom { min-width: 0; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; }
.fwk-cw-midden { min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.fwk-cw-midden-binnen { width: 100%; max-width: 820px; margin: 0 auto; flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
.fwk-cw-hint { }
@media (max-width: 1599px) { .fwk-cw-hint { display: none; } }
`;

const SLEUTEL = (kant) => `fwk-chat-${kant}-ingeklapt`;

function leesOpslag(kant) {
  try {
    return window.localStorage.getItem(SLEUTEL(kant)) === '1';
  } catch (e) {
    return false;
  }
}

function schrijfOpslag(kant, dicht) {
  try {
    window.localStorage.setItem(SLEUTEL(kant), dicht ? '1' : '0');
  } catch (e) {
    /* alleen een gemak: zonder opslag begint de kolom gewoon open */
  }
}

// Een zijkolom die kan inklappen. Ingeklapt: een smalle strook met een chevron en het label (uitklapknop).
function Zijkolom({ kant, testid, label, korteLabel, dicht, onToggle, children }) {
  const knop = useRef(null);
  const eerste = useRef(true);
  const chevronDicht = kant === 'links' ? '›' : '‹';
  const chevronOpen = kant === 'links' ? '‹' : '›';

  // Na het in- of uitklappen blijft de focus op de bijbehorende knop (toetsenbordgebruikers raken hem niet kwijt).
  useEffect(() => {
    if (eerste.current) {
      eerste.current = false;

      return;
    }

    window.requestAnimationFrame(() => knop.current && knop.current.focus());
  }, [dicht]);

  return (
    <aside className="fwk-cw-kolom" data-testid={testid} data-ingeklapt={dicht ? 'ja' : 'nee'} aria-label={label} style={dicht ? { overflow: 'hidden' } : undefined}>
      {dicht && (
        <button
          ref={knop}
          type="button"
          className="fwk-cw-strook"
          data-testid={`${testid}-uitklappen`}
          aria-expanded="false"
          aria-label={`${label} uitklappen`}
          title={`${label} uitklappen`}
          onClick={onToggle}
        >
          <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>{chevronDicht}</span>
          <span className="v">{korteLabel}</span>
        </button>
      )}
      <div style={dicht ? { display: 'none' } : undefined}>
        <div className="fwk-cw-inklap" style={css('margin-bottom: 8px;')}>
          <button ref={dicht ? undefined : knop} type="button" data-testid={`${testid}-inklappen`} aria-expanded="true" aria-label={`${label} inklappen`} title={`${label} inklappen`} onClick={onToggle}>
            {kant === 'links' ? `${chevronOpen} Inklappen` : `Inklappen ${chevronOpen}`}
          </button>
        </div>
        {children}
      </div>
    </aside>
  );
}

export default function ChatWerkruimte({ modus, links, rechts, children }) {
  const [linksDicht, setLinksDicht] = useState(() => leesOpslag('links'));
  const [rechtsDicht, setRechtsDicht] = useState(() => leesOpslag('rechts'));
  const wissel = useCallback(
    (kant) => () => {
      const zet = kant === 'links' ? setLinksDicht : setRechtsDicht;

      zet((nu) => {
        schrijfOpslag(kant, !nu);

        return !nu;
      });
    },
    [],
  );

  if (modus !== 'drie') {
    return (
      <div data-testid="chat-werkruimte" data-modus={modus} style={css('position: relative; z-index: 1; max-width: 1040px; margin: 0 auto; padding: 16px clamp(12px, 3vw, 24px) 60px;')}>
        <style>{CSS_WERKRUIMTE}</style>
        {children}
      </div>
    );
  }

  return (
    <div data-testid="chat-werkruimte" data-modus="drie" style={css('position: relative; z-index: 1; max-width: 1560px; margin: 0 auto; padding: 14px 20px 0; box-sizing: border-box;')}>
      <style>{CSS_WERKRUIMTE}</style>
      <div className="fwk-cw-drie" data-kolommen={rechts ? '3' : '2'} data-links={linksDicht ? 'dicht' : 'open'} data-rechts={rechts ? (rechtsDicht ? 'dicht' : 'open') : 'geen'}>
        <Zijkolom kant="links" testid="kolom-gesprekken" label="Gesprekken" korteLabel="Gesprekken" dicht={linksDicht} onToggle={wissel('links')}>
          {links}
        </Zijkolom>
        <main className="fwk-cw-midden" data-testid="kolom-chat">
          <div className="fwk-cw-midden-binnen">{children}</div>
        </main>
        {rechts && (
          <Zijkolom kant="rechts" testid="kolom-project" label="Projectoverzicht" korteLabel="Projectoverzicht" dicht={rechtsDicht} onToggle={wissel('rechts')}>
            {rechts}
          </Zijkolom>
        )}
      </div>
    </div>
  );
}
