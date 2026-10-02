import { useEffect, useRef, useState } from 'react';
import { css } from '../../shared/lib/css.js';

// Vervolgopdracht "Verbeter UX contextpanelen rondom Subsidie Kompas chat"
// (2026-10-01): één herbruikbare lay-outcomponent voor de ondersteunende
// Pro/Premium-context (Organisatie, Projecten, Documenten, Opgeslagen
// gesprekken/context), zodat deze niet langer als los, groot blok boven de
// chat wordt getoond maar als compact, uitschuifbaar paneel met tabbladen.
//
// Dit component bepaalt UITSLUITEND de lay-out: positie, tabbladen, openen/
// sluiten, en desktop- versus mobielgedrag. De daadwerkelijke inhoud van elk
// tabblad (organisatieprofiel, projectenlijst, documentatie, gesprekken-
// historie) wordt ongewijzigd door KompasToolPage aangeleverd via de `tabs`
// prop - dezelfde bestaande componenten/state/closures als voorheen, nu
// alleen in een andere "lijst" gerenderd. Er verandert hier dus niets aan
// databronnen, rechten of rechtstreekse Supabase-aanroepen.
//
// Het mobiele "bottom sheet"-gedrag (volledige breedte, afgeronde bovenhoek,
// vaste maximumhoogte) is bewust één-op-één overgenomen van het al bestaande,
// goedgekeurde patroon in DeadlinesPage.jsx, voor visuele consistentie met de
// rest van het platform. Net als daar is er geen "klik op de achtergrond om
// te sluiten" - sluiten gaat altijd via de expliciete sluitknop, zodat een
// per ongeluk geraakte achtergrond nooit onbedoeld een paneel met ingevulde
// gegevens sluit.

const TAB_VOLGORDE = ['org', 'proj', 'doc', 'historie'];

export default function KompasContextDrawer({ active, onSelect, onClose, tabs }) {
  const [desktop, setDesktop] = useState(() => window.innerWidth >= 900);

  useEffect(() => {
    const onResize = () => setDesktop(window.innerWidth >= 900);

    window.addEventListener('resize', onResize);

    return () => window.removeEventListener('resize', onResize);
  }, []);

  const beschikbareTabs = TAB_VOLGORDE.filter((naam) => tabs && tabs[naam]);
  const open = active != null && !!(tabs && tabs[active]);

  const drawerRef = useRef(null);
  const vorigeFocusRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    vorigeFocusRef.current = document.activeElement;
    drawerRef.current?.focus();

    return () => {
      const vorigElement = vorigeFocusRef.current;

      if (vorigElement && typeof vorigElement.focus === 'function' && document.contains(vorigElement)) {
        vorigElement.focus();
      }
    };
  }, [open]);

  if (!open || beschikbareTabs.length === 0) {
    return null;
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key !== 'Tab' || !drawerRef.current) {
      return;
    }

    const focusbareElementen = drawerRef.current.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );

    if (focusbareElementen.length === 0) {
      return;
    }

    const eerste = focusbareElementen[0];
    const laatste = focusbareElementen[focusbareElementen.length - 1];

    if (event.shiftKey && document.activeElement === eerste) {
      event.preventDefault();
      laatste.focus();
    } else if (!event.shiftKey && document.activeElement === laatste) {
      event.preventDefault();
      eerste.focus();
    }
  };

  const tabKnop = (naam) => (
    <button
      key={naam}
      type="button"
      onClick={() => onSelect(naam)}
      style={css(`
        cursor: pointer;
        box-sizing: border-box;
        min-height: 40px;
        padding: 9px 12px;
        border: none;
        border-bottom: 2px solid ${active === naam ? '#4E9A6C' : 'transparent'};
        background: none;
        font-family: 'Mulish', sans-serif;
        font-size: 13.5px;
        font-weight: 800;
        color: ${active === naam ? '#2C4A5E' : '#7B8985'};
        white-space: nowrap;
      `)}
    >
      {tabs[naam].label}
      {tabs[naam].badge != null && (
        <span style={css('margin-left: 6px; font-size: 12px; font-weight: 700; opacity: 0.7;')}>{tabs[naam].badge}</span>
      )}
    </button>
  );

  const kopbalk = (
    <div
      style={css(
        'display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid #E1EAE4; padding-bottom: 2px;',
      )}
    >
      <div style={css('display: flex; align-items: center; gap: 2px; overflow-x: auto;')}>{beschikbareTabs.map(tabKnop)}</div>
      <button
        type="button"
        aria-label="Sluiten"
        onClick={onClose}
        style={css(`
          cursor: pointer;
          flex: 0 0 auto;
          width: 36px;
          height: 36px;
          border: 1px solid #E1EAE4;
          border-radius: 12px;
          background: #FFFFFF;
          color: #2C4A5E;
          font-size: 16px;
          font-weight: 700;
        `)}
      >
        ×
      </button>
    </div>
  );

  const inhoud = tabs[active].content;

  if (desktop) {
    return (
      <div
        ref={drawerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        onKeyDown={handleKeyDown}
        style={css(`
          position: fixed;
          top: 0;
          right: 0;
          height: 100vh;
          width: min(400px, 92vw);
          z-index: 120;
          background: #FFFFFF;
          border-left: 1px solid #E1EAE4;
          box-shadow: -8px 0 28px rgba(44, 74, 94, 0.12);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        `)}
      >
        <div style={css('padding: 18px 20px 0;')}>{kopbalk}</div>
        <div style={css('flex: 1 1 auto; overflow-y: auto; padding: 10px 20px 24px;')}>{inhoud}</div>
      </div>
    );
  }

  return (
    <div style={css('position: fixed; inset: 0; z-index: 120; background: rgba(44,74,94,0.32); display: flex; align-items: flex-end;')}>
      <div
        ref={drawerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        onKeyDown={handleKeyDown}
        style={css(`
          width: 100%;
          max-height: 86vh;
          overflow-y: auto;
          box-sizing: border-box;
          padding: 18px clamp(16px, 5vw, 24px) 24px;
          border-radius: 24px 24px 0 0;
          background: #FFFFFF;
          display: flex;
          flex-direction: column;
          gap: 16px;
        `)}
      >
        {kopbalk}
        {inhoud}
      </div>
    </div>
  );
}
