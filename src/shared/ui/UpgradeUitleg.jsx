// Herbruikbare, niet-blokkerende uitleg voor het moment dat een Free- of
// anonieme gebruiker iets probeert dat bij Pro/Premium hoort. Blokkeert
// nooit met een verplicht inlogscherm: legt in één regel uit wat de
// gebruiker mist en geeft vier gelijkwaardige vervolgstappen. Gebruikt
// bewust alleen al bestaande bouwstenen (de login/registratie-overlay via
// useAuthModal, en de bestaande abonnementenpagina) — geen nieuwe
// auth-provider, geen nieuwe pagina's, geen dubbele sessies.
import React from 'react';
import { css } from '../lib/css.js';
import { useApp } from '../../features/kompas-app/useKompasApp.js';

export default function UpgradeUitleg({ titel = 'Deze functionaliteit hoort bij Pro of Premium.', toelichting }) {
  const app = useApp();

  const knop = (nadruk) =>
    css(
      `cursor: pointer; padding: 9px 16px; border-radius: 999px; font-size: 13px; font-weight: ${nadruk ? '800' : '700'}; white-space: nowrap; ${
        nadruk ? 'background: #4E9A6C; color: #FFFFFF; border: 1px solid #4E9A6C;' : 'background: #FFFFFF; color: #2C4A5E; border: 1px solid #D6E3E9;'
      }`,
    );

  return (
    <div
      style={css(
        'display: flex; flex-wrap: wrap; align-items: center; gap: 14px; justify-content: space-between; padding: 16px 20px; border: 1px solid #D6E3E9; border-radius: 18px; background: #F4F8FB; margin-bottom: 16px;',
      )}
    >
      <div style={css('flex: 1 1 260px; min-width: 0;')}>
        <div style={css('color: #2C4A5E; font-size: 14.5px; font-weight: 800;')}>{titel}</div>
        {toelichting && <div style={css('margin-top: 4px; color: #536460; font-size: 13.5px; line-height: 1.55;')}>{toelichting}</div>}
      </div>
      <div style={css('display: flex; gap: 8px; flex-wrap: wrap;')}>
        <div onClick={() => app.openRegister()} role="button" style={knop(true)}>
          Gratis account maken
        </div>
        <div onClick={() => app.openAuth()} role="button" style={knop(false)}>
          Inloggen
        </div>
        <div onClick={() => app.goAbonnementen()} role="button" style={knop(false)}>
          Meer over Pro
        </div>
        <div onClick={() => app.goAbonnementen()} role="button" style={knop(false)}>
          Meer over Premium
        </div>
      </div>
    </div>
  );
}
