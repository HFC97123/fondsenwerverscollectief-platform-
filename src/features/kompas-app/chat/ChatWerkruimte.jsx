// Layout van de Pro/Premium-chatwerkruimte: GESPREKKEN | CHAT, en alleen bij een actief project ook PROJECTOVERZICHT.
//
// Dit bestand bepaalt UITSLUITEND de plaatsing. De chat zelf (berichten, streaming, invoer, exports,
// documentgeneratie, bevestigingen) blijft in KompasToolPage en wordt hier alleen als `children` in het
// midden gerenderd.
//
//   modus 'drie'    (>= 1200 px)  : vaste linkerkolom (gesprekken) en chat; ALLEEN als `rechts` is meegegeven
//                                    (er is een actief project) ook een vaste rechterkolom met het projectoverzicht.
//                                    Zonder `rechts` bestaat die kolom niet: geen lege kolom, de chat krijgt de ruimte.
//                                    Beide kolommen hebben een sleepgreep aan de binnenrand (zoals in ChatGPT en Claude): slepen
//                                    past de breedte aan en slepen naar de rand klapt de kolom in tot een smalle strook die u
//                                    weer uitklapt door erop te klikken of terug te slepen (alles wordt per apparaat onthouden). Ingeklapt blijft de inhoud bestaan
//                                    (alleen verborgen), dus zoekopdrachten en scrollpositie gaan niet verloren.
//                                    Geen lade (dat zou dubbele ingangen geven);
//   modus 'tablet'  (900-1199 px) : chat bijna volledige breedte; de knoppen Gesprekken en (bij een actief project)
//                                    Project openen de bestaande KompasContextDrawer;
//   modus 'mobiel'  (< 900 px)    : idem, de drawer is dan het bestaande bottom-sheet-patroon.
// Nooit een vaste zijbalk en een sheet tegelijk.
import React, { useEffect, useRef, useState } from 'react';
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

// Breedte per kolom via variabelen: open (standaard of door de gebruiker versleept) of ingeklapt (een strook van 36 px).
const CSS_WERKRUIMTE = `
.fwk-cw-drie { --cw-l: 240px; --cw-r: 300px; display: grid; grid-template-columns: var(--cw-l) minmax(0, 1fr) var(--cw-r); gap: 16px; align-items: stretch; height: calc(100vh - 92px); min-height: 560px; transition: grid-template-columns 0.18s ease; }
.fwk-cw-drie[data-kolommen="2"] { grid-template-columns: var(--cw-l) minmax(0, 1fr); }
.fwk-cw-drie[data-links="dicht"] { --cw-l: 36px; }
.fwk-cw-drie[data-rechts="dicht"] { --cw-r: 36px; }
.fwk-cw-drie[data-sleept="ja"] { transition: none; }
@media (min-width: 1400px) { .fwk-cw-drie { --cw-l: 260px; --cw-r: 320px; gap: 20px; } .fwk-cw-drie[data-links="dicht"] { --cw-l: 36px; } .fwk-cw-drie[data-rechts="dicht"] { --cw-r: 36px; } }
@media (prefers-reduced-motion: reduce) { .fwk-cw-drie { transition: none; } }
.fwk-cw-zijkant { position: relative; min-width: 0; min-height: 0; display: flex; }
.fwk-cw-strook { cursor: pointer; font-family: 'Mulish', sans-serif; font-weight: 800; color: #2C4A5E; }
.fwk-cw-strook:hover { background: #EAF4EE; }
.fwk-cw-strook { box-sizing: border-box; width: 36px; height: 100%; min-height: 160px; display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 10px 0; border: 1px solid #E1EAE4; border-radius: 14px; background: #F7F9F8; font-size: 12.5px; }
.fwk-cw-strook span.v { writing-mode: vertical-rl; letter-spacing: 0.04em; }
.fwk-cw-kolom { flex: 1 1 auto; min-width: 0; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; }
.fwk-cw-hand { position: absolute; top: 0; bottom: 0; width: 14px; cursor: col-resize; touch-action: none; z-index: 3; outline: none; }
.fwk-cw-hand::after { content: ''; position: absolute; top: 8px; bottom: 8px; left: 50%; width: 3px; margin-left: -1.5px; border-radius: 3px; background: transparent; transition: background 0.12s ease; }
.fwk-cw-hand:hover::after, .fwk-cw-hand:focus-visible::after, .fwk-cw-hand[data-actief="ja"]::after { background: #A8D5BA; }
.fwk-cw-hand:focus-visible::after { background: #4E9A6C; }
.fwk-cw-hand[data-kant="links"] { right: -15px; }
.fwk-cw-hand[data-kant="rechts"] { left: -15px; }
.fwk-cw-midden { min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.fwk-cw-midden-binnen { width: 100%; max-width: 820px; margin: 0 auto; flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
.fwk-cw-hint { }
@media (max-width: 1599px) { .fwk-cw-hint { display: none; } }
`;

export const KOLOM_MIN = 200;
export const KOLOM_MAX = 480;
export const KOLOM_DICHT_ONDER = 150; // slepen onder deze breedte klapt de kolom in
export const KOLOM_STAP = 24;

export const begrens = (px) => Math.min(KOLOM_MAX, Math.max(KOLOM_MIN, Math.round(px)));

const SLEUTEL = (kant, soort) => `fwk-chat-${kant}-${soort}`;

function leesOpslag(kant) {
  try {
    const dicht = window.localStorage.getItem(SLEUTEL(kant, 'ingeklapt')) === '1';
    const b = parseInt(window.localStorage.getItem(SLEUTEL(kant, 'breedte')), 10);

    return { dicht, breedte: Number.isFinite(b) ? begrens(b) : null };
  } catch (e) {
    return { dicht: false, breedte: null };
  }
}

function schrijfOpslag(kant, { dicht, breedte }) {
  try {
    window.localStorage.setItem(SLEUTEL(kant, 'ingeklapt'), dicht ? '1' : '0');

    if (breedte) {
      window.localStorage.setItem(SLEUTEL(kant, 'breedte'), String(breedte));
    }
  } catch (e) {
    /* alleen een gemak: zonder opslag begint de kolom gewoon op de standaardbreedte */
  }
}

// Toestand van één zijkolom: ingeklapt of open, en de zelfgekozen breedte (null = standaard). Wordt per apparaat onthouden.
function useKolomInstelling(kant) {
  const [staat, setStaat] = useState(() => leesOpslag(kant));
  const eerste = useRef(true);

  useEffect(() => {
    if (eerste.current) {
      eerste.current = false;

      return;
    }

    schrijfOpslag(kant, staat);
  }, [kant, staat]);

  return [staat, setStaat];
}

// Een zijkolom met een sleepgreep aan de binnenrand (zoals in ChatGPT en Claude): sleep naar de rand om in te klappen,
// sleep terug of klik op de smalle strook om weer uit te klappen. Zonder muis: pijltjestoetsen op de greep (Enter of
// spatie klapt in of uit).
function Zijkolom({ kant, testid, label, korteLabel, staat, setStaat, onSleep, children }) {
  const zijkant = useRef(null);
  const greep = useRef(null);
  const sleep = useRef(null);
  const [actief, setActief] = useState(false);
  const teken = kant === 'links' ? 1 : -1; // naar rechts slepen maakt de linkerkolom breder; naar links de rechterkolom
  const breedteNu = () => (zijkant.current ? zijkant.current.getBoundingClientRect().width : KOLOM_MIN);

  const zet = (rauw) => {
    if (rauw < KOLOM_DICHT_ONDER) {
      setStaat((s) => (s.dicht ? s : { ...s, dicht: true }));
    } else {
      setStaat({ dicht: false, breedte: begrens(rauw) });
    }
  };

  const klapUit = () => {
    setStaat((s) => ({ ...s, dicht: false }));
    window.requestAnimationFrame(() => greep.current && greep.current.focus());
  };

  const start = (e) => {
    if (e.button !== undefined && e.button !== 0) {
      return;
    }

    e.preventDefault();
    sleep.current = { x: e.clientX, b: breedteNu() };
    setActief(true);
    onSleep(true);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {
      /* oudere browsers: de bewegingen komen dan via de greep zelf binnen */
    }

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  };

  const beweeg = (e) => {
    if (!sleep.current) {
      return;
    }

    zet(sleep.current.b + teken * (e.clientX - sleep.current.x));
  };

  const stop = (e) => {
    if (!sleep.current) {
      return;
    }

    sleep.current = null;
    setActief(false);
    onSleep(false);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {
      /* niets */
    }
  };

  const toets = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setStaat((s) => ({ ...s, dicht: !s.dicht }));

      return;
    }

    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
      return;
    }

    e.preventDefault();
    // Uitgangspunt is de gekozen breedte (niet de meting), zodat snel achter elkaar drukken tijdens de animatie telt.
    const basis = staat.dicht ? 36 : staat.breedte || breedteNu();

    zet(basis + teken * (e.key === 'ArrowRight' ? 1 : -1) * KOLOM_STAP);
  };

  useEffect(
    () => () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    },
    [],
  );

  const dicht = staat.dicht;

  return (
    <div className="fwk-cw-zijkant" ref={zijkant}>
      <aside className="fwk-cw-kolom" data-testid={testid} data-ingeklapt={dicht ? 'ja' : 'nee'} aria-label={label} style={dicht ? { overflow: 'hidden' } : undefined}>
        {dicht && (
          <button
            type="button"
            className="fwk-cw-strook"
            data-testid={`${testid}-uitklappen`}
            aria-expanded="false"
            aria-label={`${label} uitklappen`}
            title={`${label} uitklappen`}
            onClick={klapUit}
          >
            <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>{kant === 'links' ? '›' : '‹'}</span>
            <span className="v">{korteLabel}</span>
          </button>
        )}
        <div style={dicht ? { display: 'none' } : undefined}>{children}</div>
      </aside>
      <div
        ref={greep}
        className="fwk-cw-hand"
        data-kant={kant}
        data-testid={`${testid}-handvat`}
        data-actief={actief ? 'ja' : 'nee'}
        role="separator"
        aria-orientation="vertical"
        aria-label={`Breedte van ${label}: sleep om te verbreden of smaller te maken, of sleep helemaal naar de rand om in te klappen`}
        aria-valuenow={dicht ? 0 : staat.breedte || undefined}
        tabIndex={0}
        title={dicht ? `${label} uitklappen: sleep of klik op de strook` : 'Sleep om de breedte aan te passen; sleep naar de rand om in te klappen'}
        onPointerDown={start}
        onPointerMove={beweeg}
        onPointerUp={stop}
        onPointerCancel={stop}
        onKeyDown={toets}
      />
    </div>
  );
}

export default function ChatWerkruimte({ modus, links, rechts, children }) {
  const [linksStaat, setLinksStaat] = useKolomInstelling('links');
  const [rechtsStaat, setRechtsStaat] = useKolomInstelling('rechts');
  const [sleept, setSleept] = useState(false);

  if (modus !== 'drie') {
    return (
      <div data-testid="chat-werkruimte" data-modus={modus} style={css('position: relative; z-index: 1; max-width: 1040px; margin: 0 auto; padding: 16px clamp(12px, 3vw, 24px) 60px;')}>
        <style>{CSS_WERKRUIMTE}</style>
        {children}
      </div>
    );
  }

  // Een door de gebruiker gekozen breedte wint van de standaard; ingeklapt wint van alles (strook van 36 px).
  const breedtes = {};

  if (!linksStaat.dicht && linksStaat.breedte) {
    breedtes['--cw-l'] = `${linksStaat.breedte}px`;
  }

  if (rechts && !rechtsStaat.dicht && rechtsStaat.breedte) {
    breedtes['--cw-r'] = `${rechtsStaat.breedte}px`;
  }

  return (
    <div data-testid="chat-werkruimte" data-modus="drie" style={css('position: relative; z-index: 1; max-width: 1560px; margin: 0 auto; padding: 14px 20px 0; box-sizing: border-box;')}>
      <style>{CSS_WERKRUIMTE}</style>
      <div className="fwk-cw-drie" style={breedtes} data-sleept={sleept ? 'ja' : 'nee'} data-kolommen={rechts ? '3' : '2'} data-links={linksStaat.dicht ? 'dicht' : 'open'} data-rechts={rechts ? (rechtsStaat.dicht ? 'dicht' : 'open') : 'geen'}>
        <Zijkolom kant="links" testid="kolom-gesprekken" label="Gesprekken" korteLabel="Gesprekken" staat={linksStaat} setStaat={setLinksStaat} onSleep={setSleept}>
          {links}
        </Zijkolom>
        <main className="fwk-cw-midden" data-testid="kolom-chat">
          <div className="fwk-cw-midden-binnen">{children}</div>
        </main>
        {rechts && (
          <Zijkolom kant="rechts" testid="kolom-project" label="Projectoverzicht" korteLabel="Projectoverzicht" staat={rechtsStaat} setStaat={setRechtsStaat} onSleep={setSleept}>
            {rechts}
          </Zijkolom>
        )}
      </div>
    </div>
  );
}
