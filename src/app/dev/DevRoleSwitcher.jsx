// Alleen-lokale test-functie: laat tijdens het ontwikkelen snel zien hoe de
// app eruitziet als Free/Pro/Premium/Admin, zonder vier losse testaccounts.
//
// Belangrijk, en dit is bewust zo gebouwd:
// - Bestaat uitsluitend client-side. De rolwissel is React state
//   (devRolOverride/setDevRolOverride in AuthProvider) en schrijft nooit iets
//   naar de database — er verandert niets aan het echte profiel.
// - Nooit aanwezig in productie. Zowel dit bestand als de plek in App.jsx die
//   het rendert zijn gegate op `import.meta.env.DEV`. Vite vervangt die
//   uitdrukking bij een productiebuild door `false` en elimineert de hele tak
//   als dode code, dus dit paneel bestaat simpelweg niet in de gebouwde app
//   die naar Vercel gaat.
// - De echte rol (het werkelijke profiel/abonnement) blijft ondertussen
//   ongewijzigd; de override werkt alleen op de afgeleide velden (tier,
//   rechten, isBeheerder) die de rest van de app leest.
import React from 'react';
import { useAuth } from '../providers/AuthProvider.jsx';
import { css } from '../../shared/lib/css.js';
import { font, radius } from '../../shared/tokens.js';

const ROLLEN = [
  { waarde: 'free', label: 'Free' },
  { waarde: 'pro', label: 'Pro' },
  { waarde: 'premium', label: 'Premium' },
  { waarde: 'admin', label: 'Admin' },
];

export default function DevRoleSwitcher() {
  const auth = useAuth();

  // Dubbele bescherming: ook als dit component per ongeluk ergens buiten de
  // DEV-gate in App.jsx terecht zou komen, rendert het niets zodra
  // devRolOverride/setDevRolOverride niet bestaan (zoals in productie).
  if (!import.meta.env.DEV || typeof auth.setDevRolOverride !== 'function') {
    return null;
  }

  const huidig = auth.devRolOverride;

  return (
    <div
      style={css(`
        position: fixed;
        left: 14px;
        bottom: 14px;
        z-index: 2000;
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 10px 12px;
        border-radius: ${radius.m};
        background: #2A1B0A;
        border: 1px solid #5A4020;
        box-shadow: 0 10px 26px rgba(0,0,0,0.28);
        font-family: ${font.tekst};
      `)}
    >
      <div style={css('display: flex; align-items: center; gap: 8px;')}>
        <span
          style={css(`
            padding: 2px 8px;
            border-radius: 999px;
            background: #F0A93B;
            color: #2A1B0A;
            font-size: 10.5px;
            font-weight: 800;
            letter-spacing: 0.06em;
          `)}
        >
          DEV
        </span>
        <span style={css('font-size: 12px; font-weight: 700; color: #F3E4C8;')}>
          Rolwissel (alleen testen, niets wordt opgeslagen)
        </span>
      </div>

      <div style={css('display: flex; gap: 6px; flex-wrap: wrap;')}>
        {ROLLEN.map((r) => {
          const actief = huidig === r.waarde;

          return (
            <button
              key={r.waarde}
              type="button"
              onClick={() => auth.setDevRolOverride(actief ? null : r.waarde)}
              style={css(`
                cursor: pointer;
                padding: 6px 12px;
                border-radius: 999px;
                border: 1px solid ${actief ? '#F0A93B' : '#5A4020'};
                background: ${actief ? '#F0A93B' : 'transparent'};
                color: ${actief ? '#2A1B0A' : '#F3E4C8'};
                font-size: 12.5px;
                font-weight: 700;
              `)}
            >
              {r.label}
            </button>
          );
        })}

        {huidig && (
          <button
            type="button"
            onClick={() => auth.setDevRolOverride(null)}
            style={css(`
              cursor: pointer;
              padding: 6px 12px;
              border-radius: 999px;
              border: 1px solid #5A4020;
              background: transparent;
              color: #C9B48A;
              font-size: 12.5px;
              font-weight: 700;
            `)}
          >
            Werkelijke rol
          </button>
        )}
      </div>
    </div>
  );
}
