// Hoofdnavigatie van de Pro/Premium-werkruimte van Subsidie Kompas:
//
//   Dashboard · Chat · Projecten · Deadlines · Documenten          Organisatie ▾
//
// Eén balk voor het hele werkgebied. De Free-ervaring en de publieke
// Kompas-pagina's houden de bestaande KompasSubnav (zie KompasApp.jsx en
// werkNavContext.js). Rechts staat het Organisatiemenu met het
// organisatieprofiel, het account, de abonnementen en uitloggen.
import React, { useEffect, useRef, useState } from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './useKompasApp.js';
import { useKompas } from './KompasStore.jsx';

export const WERKNAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', href: '#/kompas/dashboard', paden: ['/kompas/dashboard'] },
  { key: 'chat', label: 'Chat', href: '#/kompas', paden: ['/kompas', '/subsidie-kompas'] },
  { key: 'projecten', label: 'Projecten', href: '#/kompas/projecten', paden: ['/kompas/projecten'] },
  { key: 'deadlines', label: 'Deadlines', href: '#/kompas/deadlines', paden: ['/kompas/deadlines'] },
  { key: 'documenten', label: 'Documenten', href: '#/kompas/documentatie', paden: ['/kompas/documentatie'] },
];

// Welk hoofditem hoort bij deze route? (Organisatie en Account horen bij het
// menu rechts en geven hier null.)
export function actieveSleutel(pad) {
  const item = WERKNAV_ITEMS.find((i) => i.paden.indexOf(pad) !== -1);

  return item ? item.key : null;
}

export function isOrganisatieMenuPad(pad) {
  return pad === '/kompas/organisatie' || pad === '/kompas/account';
}

const TIER_LABEL = { free: 'Free', pro: 'Pro', premium: 'Premium' };

const NAV_CSS = `
.fwk-wn-link { text-decoration: none; transition: color .15s ease, border-color .15s ease; }
.fwk-wn-link:hover { color: #4E9A6C !important; }
.fwk-wn-link:focus-visible, .fwk-wn-merk:focus-visible, .fwk-wn-org:focus-visible, .fwk-wn-menu a:focus-visible, .fwk-wn-menu button:focus-visible { outline: 2px solid #4E9A6C; outline-offset: 2px; }
.fwk-wn-org:hover { background: #EAF4EE !important; border-color: #A8D5BA !important; }
.fwk-wn-menu a:hover, .fwk-wn-menu button:hover { background: #F2F6F4; }
@media (max-width: 760px) {
  .fwk-wn-merk-tekst { display: none; }
  .fwk-wn-items { order: 3; flex-basis: 100%; gap: 6px 18px !important; }
  .fwk-wn-org { max-width: 190px; }
}
`;

const linkBasis = 'font-family: \'Mulish\', sans-serif; font-size: 14.5px; font-weight: 700; white-space: nowrap; padding: 6px 0; border-bottom: 2px solid transparent;';
const menuItemStijl = css(
  "display: block; width: 100%; box-sizing: border-box; padding: 10px 14px; border: none; border-radius: 10px; background: none; text-align: left; cursor: pointer; font-family: 'Mulish', sans-serif; font-size: 14.5px; font-weight: 700; color: #2C4A5E; text-decoration: none;",
);

export default function KompasWerkNav({ pad }) {
  const app = useApp();
  const store = useKompas();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const knopRef = useRef(null);

  const actief = actieveSleutel(pad);
  const orgMenuActief = isOrganisatieMenuPad(pad);
  const tier = app.subscriptionTier || 'free';
  const tierLabel = app.isAdmin ? 'Admin' : TIER_LABEL[tier] || 'Free';
  const orgNaam = String((store.orgProfile && store.orgProfile.name) || '').trim() || 'Organisatie';

  // Sluit bij Escape (focus terug naar de knop) en bij klikken buiten het menu.
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
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  // Een routewissel sluit het menu.
  useEffect(() => {
    setOpen(false);
  }, [pad]);

  const uitloggen = () => {
    setOpen(false);
    Promise.resolve(app.logout()).finally(() => app.goHome());
  };

  return (
    <nav
      aria-label="Hoofdnavigatie Subsidie Kompas"
      data-testid="kompas-werknav"
      style={css('position: relative; z-index: 5; border-bottom: 1px solid #E1EAE4; background: rgba(247,249,248,0.96);')}
    >
      <style>{NAV_CSS}</style>
      <div
        style={css(
          'max-width: 1120px; margin: 0 auto; padding: 10px clamp(16px, 4vw, 24px); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px 22px;',
        )}
      >
        <a
          className="fwk-wn-merk"
          href="#/kompas"
          aria-label="Subsidie Kompas, naar de chat"
          style={css('display: inline-flex; align-items: center; gap: 10px; text-decoration: none; border-radius: 999px;')}
        >
          <img src="/uploads/kompas-logo.png" alt="" style={css('width: 32px; height: 32px; border-radius: 50%; object-fit: contain; display: block;')} />
          <span className="fwk-wn-merk-tekst" style={css("font-family: 'Newsreader', serif; font-size: 19px; font-weight: 600; color: #2C4A5E; white-space: nowrap;")}>
            Subsidie Kompas
          </span>
        </a>

        <div
          className="fwk-wn-items"
          style={css('display: flex; align-items: center; flex-wrap: wrap; gap: 6px 26px; margin-right: auto;')}
        >
          {WERKNAV_ITEMS.map((item) => {
            const isActief = actief === item.key;

            return (
              <a
                key={item.key}
                className="fwk-wn-link"
                href={item.href}
                aria-current={isActief ? 'page' : undefined}
                style={css(`${linkBasis} color: ${isActief ? '#4E9A6C' : '#2C4A5E'}; border-bottom-color: ${isActief ? '#4E9A6C' : 'transparent'};`)}
              >
                {item.label}
              </a>
            );
          })}
        </div>

        <div ref={wrapRef} style={css('position: relative;')}>
          <button
            ref={knopRef}
            type="button"
            className="fwk-wn-org"
            aria-expanded={open}
            aria-controls="fwk-wn-menu"
            onClick={() => setOpen((v) => !v)}
            style={css(
              `cursor: pointer; display: inline-flex; align-items: center; gap: 8px; min-height: 40px; box-sizing: border-box; padding: 6px 14px; border-radius: 999px; border: 1px solid ${orgMenuActief || open ? '#A8D5BA' : '#CFE0D6'}; background: ${orgMenuActief || open ? '#EAF4EE' : '#FFFFFF'}; font-family: 'Mulish', sans-serif; font-size: 14px; font-weight: 800; color: #2C4A5E;`,
            )}
          >
            <span style={css('overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px;')}>{orgNaam}</span>
            <span aria-hidden="true" style={css('font-size: 11px;')}>▾</span>
          </button>

          {open && (
            <div
              id="fwk-wn-menu"
              className="fwk-wn-menu"
              style={css(
                'position: absolute; right: 0; top: calc(100% + 8px); z-index: 20; min-width: 230px; max-width: min(300px, 92vw); box-sizing: border-box; padding: 8px; border: 1px solid #E1EAE4; border-radius: 16px; background: #FFFFFF; box-shadow: 0 10px 30px rgba(44,74,94,0.12);',
              )}
            >
              <div style={css("padding: 8px 14px 10px; border-bottom: 1px solid #E9EFEB; margin-bottom: 6px; font-family: 'Mulish', sans-serif; font-size: 12.5px; font-weight: 700; color: #7B8985;")}>
                {app.naam || 'Mijn account'} · {tierLabel}
              </div>
              <a href="#/kompas/organisatie" style={menuItemStijl}>Organisatieprofiel</a>
              <a href="#/kompas/account" style={menuItemStijl}>Account</a>
              <a href="#/hoe-het-werkt" style={menuItemStijl}>Abonnement</a>
              <button type="button" onClick={uitloggen} style={menuItemStijl}>Uitloggen</button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
