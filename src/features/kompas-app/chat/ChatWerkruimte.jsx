// Layout van de Pro/Premium-chatwerkruimte: GESPREKKEN | CHAT | CONTEXT.
//
// Dit bestand bepaalt UITSLUITEND de plaatsing. De chat zelf (berichten, streaming, invoer, exports,
// documentgeneratie, bevestigingen) blijft in KompasToolPage en wordt hier alleen als `children` in het
// midden gerenderd.
//
//   modus 'drie'    (>= 1200 px)  : vaste linkerkolom (gesprekken), chat midden, vaste rechterkolom (context);
//                                    geen lade (dat zou dubbele ingangen geven);
//   modus 'tablet'  (900-1199 px) : chat bijna volledige breedte; de knoppen Gesprekken en Context openen de
//                                    bestaande KompasContextDrawer;
//   modus 'mobiel'  (< 900 px)    : idem, de drawer is dan het bestaande bottom-sheet-patroon.
// Nooit een vaste zijbalk en een sheet tegelijk.
import React, { useEffect, useState } from 'react';
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

const CSS_WERKRUIMTE = `
.fwk-cw-drie { display: grid; grid-template-columns: 240px minmax(0, 1fr) 300px; gap: 16px; align-items: stretch; height: calc(100vh - 92px); min-height: 560px; }
@media (min-width: 1400px) { .fwk-cw-drie { grid-template-columns: 260px minmax(0, 1fr) 320px; gap: 20px; } }
.fwk-cw-kolom { min-width: 0; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; }
.fwk-cw-midden { min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.fwk-cw-midden-binnen { width: 100%; max-width: 820px; margin: 0 auto; flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
.fwk-cw-hint { }
@media (max-width: 1599px) { .fwk-cw-hint { display: none; } }
`;

export default function ChatWerkruimte({ modus, links, rechts, children }) {
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
      <div className="fwk-cw-drie">
        <aside className="fwk-cw-kolom" data-testid="kolom-gesprekken" aria-label="Gesprekken">
          {links}
        </aside>
        <main className="fwk-cw-midden" data-testid="kolom-chat">
          <div className="fwk-cw-midden-binnen">{children}</div>
        </main>
        <aside className="fwk-cw-kolom" data-testid="kolom-context" aria-label="Context bij dit gesprek">
          {rechts}
        </aside>
      </div>
    </div>
  );
}
