// Navigatiebalk. Opmaak letterlijk uit het goedgekeurde ontwerp (NAV-blok in
// Het Fondsenwervers Collectief.dc.html).
//
// Accountindicator (rechtsboven): Het Fondsenwervers Collectief en Subsidie
// Kompas delen precies hetzelfde account (dezelfde profiles-rij, dezelfde
// sessie) — dus "Inloggen" hier opent bewust dezelfde overlay
// (useAuthModal) als binnen Kompas, in plaats van een eigen tweede
// inlogscherm. Zie AccountMenu hieronder.
import React from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './WebsiteProvider.jsx';
import { useAuthModal } from '../../app/providers/AuthModalProvider.jsx';
import { naar } from '../../app/routes.js';

const navLink = css('font-size: clamp(13.5px, 1.2vw, 15px); font-weight: 600; color: #2C4A5E; white-space: nowrap;');

const navKnop = css(
  'padding: 10px clamp(14px, 1.6vw, 20px); background: #4E9A6C; color: #FFFFFF; border-radius: 999px; font-size: clamp(13.5px, 1.2vw, 15px); font-weight: 700; white-space: nowrap; text-align: center;',
);

const menuLink = css('padding: 13px 4px; font-size: 16px; font-weight: 600; color: #2C4A5E;');

const TIER_LABEL = { free: 'Free', pro: 'Pro', premium: 'Premium' };

const menuItemStijl = css('padding: 10px 12px; border-radius: 9px; font-size: 14px; font-weight: 600; color: #2C4A5E; cursor: pointer;');
const menuItemUitloggenStijl = css('padding: 10px 12px; border-radius: 9px; font-size: 14px; font-weight: 700; color: #B4453B; cursor: pointer;');

// Uitgelogd heet de trigger "Login": een tweede, bewust rustigere CTA naast
// de solide groene "Probeer Subsidie Kompas"-pil, zodat de twee samen een
// gebalanceerd paar vormen (gevuld + outline) in plaats van twee keer
// dezelfde volle groene knop. Kleur is bewust exact #4E9A6C — hetzelfde
// huisstijlgroen dat elders (o.a. HomePage.jsx) voor vetgedrukte
// tekstlinks/CTA's wordt gebruikt — en de opmaak (padding/font-size) volgt
// diezelfde clamp()-waarden als navKnop hierboven, voor gelijke hoogte en
// verticale uitlijning. Het woord "Login" zelf gebruikt het brandingslettertype
// (Newsreader, zelfde als het logo "Het Fondsenwervers Collectief") op het
// zwaarste écht geladen gewicht (600 — Google Fonts-import in app.html laadt
// voor Newsreader alleen 400/500/600/500-italic; 700 bestaat daar niet en zou
// door de browser als onechte/"faux" bold worden nagebootst, wat er minder
// verzorgd uitziet). Een subtiele -webkit-text-stroke voegt net dat beetje
// extra gewicht toe zodat het woord duidelijk dikker oogt dan gewone 600-tekst,
// zonder een nieuwe fontgewicht te hoeven laden — bewust beperkt tot déze knop,
// de rest van de site/het lettertype blijft ongemoeid. De uitklap-dropdown
// (Inloggen/Aanmelden) gebruikt bewust géén font-family hier en erft dus het
// standaard site-lettertype (Mulish), niet Newsreader. Ingelogd blijft de
// bestaande, rustigere pastelgroen/Newsreader-badge ongewijzigd (buiten scope
// van deze wijziging).
function accountBadgeStijl(compact, hover, loggedOut) {
  if (loggedOut) {
    return css(`
      all: unset; box-sizing: border-box; cursor: pointer;
      display: flex; align-items: center; gap: 6px;
      padding: 10px clamp(14px, 1.6vw, 20px); border-radius: 999px;
      background: ${hover ? 'rgba(78,154,108,0.16)' : 'rgba(78,154,108,0.08)'};
      border: 1.5px solid #4E9A6C;
      font-family: 'Newsreader', serif;
      font-size: ${compact ? '13.5px' : 'clamp(13.5px, 1.2vw, 15px)'};
      font-weight: 600;
      -webkit-text-stroke: 0.4px currentColor;
      letter-spacing: 0.1px;
      color: #4E9A6C;
      white-space: nowrap;
      text-align: center;
      transition: background 0.2s ease;
    `);
  }

  return css(`
    all: unset; box-sizing: border-box; cursor: pointer;
    display: flex; align-items: center; gap: 6px;
    padding: 8px 18px; border-radius: 999px;
    background: ${hover ? 'rgba(168,213,186,0.32)' : 'rgba(168,213,186,0.18)'};
    border: 1px solid ${hover ? 'rgba(168,213,186,0.7)' : 'rgba(168,213,186,0.4)'};
    font-family: 'Newsreader', serif;
    font-size: ${compact ? '13px' : '14px'};
    font-weight: 500;
    color: #43855D;
    white-space: nowrap;
    transition: background 0.2s ease, border-color 0.2s ease;
  `);
}

// Twee echte knoppen voor de Login-uitklap (i.p.v. losse tekstlinks):
// Inloggen gevuld (primair, meest gekozen actie), Aanmelden als outline
// (secundair) — beide in het huisstijlgroen, met genoeg witruimte en een
// duidelijke focusring voor toetsenbordgebruik.
const loginClubKnopBasis =
  'all: unset; box-sizing: border-box; display: block; width: 100%; text-align: center; cursor: pointer; padding: 11px 14px; border-radius: 10px; font-size: 14.5px; font-weight: 700;';
const loginClubKnopPrimair = css(`${loginClubKnopBasis} background: #4E9A6C; color: #FFFFFF;`);
const loginClubKnopSecundair = css(`${loginClubKnopBasis} background: transparent; color: #4E9A6C; border: 1.5px solid #4E9A6C;`);

// Compacte accountbadge + menu, zonder avatar/icoon — alleen tekst. Ingelogd:
// "Naam · Tier" met een menu (Mijn account / Mijn abonnement / Uitloggen),
// ongewijzigd. Uitgelogd: "Login" (branding-lettertype, vetgedrukt) met een
// uitklap met twee echte knoppen (Inloggen / Aanmelden, standaard
// site-lettertype) — geen verplichting, Subsidie Kompas en het Collectief
// blijven zonder account te gebruiken. Routes/acties (openLogin,
// openRegister) zijn ongewijzigd; alleen label, opmaak en knop-vorm zijn
// aangepast.
function AccountMenu({ compact }) {
  const app = useApp();
  const authModal = useAuthModal();
  const [open, setOpen] = React.useState(false);
  const [hover, setHover] = React.useState(false);

  const tierLabel = app.isAdmin ? 'Admin' : TIER_LABEL[app.subscriptionTier] || 'Free';
  const badgeLabel = app.isLoggedIn ? `${app.profileFullName} · ${tierLabel}` : 'Login';

  return (
    <div
      style={css('position: relative;')}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false);
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-haspopup="menu"
        aria-expanded={open}
        style={accountBadgeStijl(compact, hover, !app.isLoggedIn)}
      >
        <span>{badgeLabel}</span>
        <span style={css('font-size: 8px; opacity: 0.55;')}>▼</span>
      </button>

      {open && (
        <React.Fragment>
          <div onClick={() => setOpen(false)} style={css('position: fixed; inset: 0; z-index: 59;')} />
          <div
            role="menu"
            style={css(
              `position: absolute; top: calc(100% + 8px); right: 0; z-index: 60; min-width: ${
                app.isLoggedIn ? '190px' : '210px'
              }; background: #FFFFFF; border: 1px solid #E1EAE4; border-radius: 14px; box-shadow: 0 16px 40px rgba(44,74,94,0.18); padding: ${
                app.isLoggedIn ? '6px' : '10px'
              }; display: flex; flex-direction: column; gap: ${app.isLoggedIn ? '0' : '8px'};`,
            )}
          >
            {app.isLoggedIn ? (
              <React.Fragment>
                <div
                  role="button"
                  style={menuItemStijl}
                  onClick={() => {
                    setOpen(false);
                    naar('/kompas/account');
                  }}
                >
                  Mijn account
                </div>
                <div
                  role="button"
                  style={menuItemStijl}
                  onClick={() => {
                    setOpen(false);
                    naar('/hoe-het-werkt');
                  }}
                >
                  Mijn abonnement
                </div>
                <div
                  role="button"
                  style={menuItemUitloggenStijl}
                  onClick={() => {
                    setOpen(false);
                    app.logout();
                  }}
                >
                  Uitloggen
                </div>
              </React.Fragment>
            ) : (
              <React.Fragment>
                <button
                  type="button"
                  role="menuitem"
                  style={loginClubKnopPrimair}
                  onClick={() => {
                    setOpen(false);
                    authModal.openLogin();
                  }}
                >
                  Inloggen
                </button>
                <button
                  type="button"
                  role="menuitem"
                  style={loginClubKnopSecundair}
                  onClick={() => {
                    setOpen(false);
                    authModal.openRegister();
                  }}
                >
                  Aanmelden
                </button>
              </React.Fragment>
            )}
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

export default function Header() {
  const app = useApp();
  const {
    isCollectief,
    isHome,
    isSubpage,
    isWideNav,
    isNarrowNav,
    mobileMenuOpen,
    toggleMobileMenu,
    goVoorWie,
    goHome,
    goNetwerk,
    goActueel,
    goKompas,
    goAdmin,
    isAdmin,
    isLoggedIn,
    profileFullName,
    subscriptionTier,
    logout,
  } = app;

  if (isCollectief === false) return null;

  const tierLabelMobiel = isAdmin ? 'Admin' : TIER_LABEL[subscriptionTier] || 'Free';

  return (
    <div
      style={css(
        'position: sticky; top: 0; z-index: 50; background: rgba(247,249,248,0.9); backdrop-filter: blur(8px); border-bottom: 1px solid #E1EAE4;',
      )}
    >
      <div
        style={css(
          'max-width: 1180px; margin: 0 auto; padding: 14px clamp(16px, 4vw, 32px); display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;',
        )}
      >
        <div onClick={goHome} style={css('display: flex; align-items: center; gap: 10px; cursor: pointer; min-width: 0; flex: 1 1 auto;')}>
          <img
            src="/uploads/collectief-logo.png"
            alt="Het Fondsenwervers Collectief logo"
            style={css('width: clamp(40px, 4.5vw, 56px); height: clamp(40px, 4.5vw, 56px); object-fit: contain; flex-shrink: 0;')}
          />
          <div
            style={css(
              "font-family: 'Newsreader', serif; font-weight: 600; font-size: clamp(15px, 1.6vw, 20px); line-height: 1.2; color: #2C4A5E; text-wrap: balance;",
            )}
          >
            Het Fondsenwervers Collectief
          </div>
        </div>

        {isHome && isWideNav && (
          <div
            style={css(
              'display: flex; align-items: center; flex-wrap: wrap; gap: 10px clamp(12px, 1.6vw, 28px); flex: 1 1 auto; justify-content: flex-end;',
            )}
          >
            <a href="#voor-wie" style={navLink}>
              Voor wie
            </a>
            <a href="#" onClick={goNetwerk} style={navLink}>
              Collectief
            </a>
            <a href="#" onClick={goActueel} style={navLink}>
              Actueel
            </a>
            {isAdmin && (
              <div
                onClick={goAdmin}
                style={css('cursor: pointer; font-size: clamp(13.5px, 1.2vw, 15px); font-weight: 700; color: #2C4A5E; white-space: nowrap;')}
              >
                Beheer
              </div>
            )}
            <a href="#" onClick={goKompas} style={navKnop}>
              Probeer Subsidie Kompas
            </a>
            <AccountMenu />
          </div>
        )}

        {isHome && isNarrowNav && (
          <>
            <div
              onClick={toggleMobileMenu}
              role="button"
              aria-label="Menu"
              style={css(
                'width: 46px; height: 46px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; flex-shrink: 0; border: 1px solid #DCE7E1; border-radius: 14px; background: #FFFFFF; cursor: pointer;',
              )}
            >
              <span style={css('width: 20px; height: 2px; border-radius: 2px; background: #2C4A5E;')} />
              <span style={css('width: 20px; height: 2px; border-radius: 2px; background: #2C4A5E;')} />
              <span style={css('width: 20px; height: 2px; border-radius: 2px; background: #2C4A5E;')} />
            </div>

            {mobileMenuOpen && (
              <div
                style={css(
                  'flex-basis: 100%; display: flex; flex-direction: column; gap: 4px; padding-top: 12px; margin-top: 4px; border-top: 1px solid #E1EAE4;',
                )}
              >
                <div
                  style={css(
                    'display: flex; align-items: center; gap: 8px; padding: 8px 4px 13px; margin-bottom: 4px; border-bottom: 1px solid #E1EAE4; font-size: 15px; font-weight: 700; color: #2C4A5E;',
                  )}
                >
                  <span>👤</span>
                  <span>{isLoggedIn ? `${profileFullName} · ${tierLabelMobiel}` : 'Gast · Free'}</span>
                </div>
                <a href="#voor-wie" onClick={goVoorWie} style={menuLink}>
                  Voor wie
                </a>
                <a href="#" onClick={goNetwerk} style={menuLink}>
                  Collectief
                </a>
                <a href="#" onClick={goActueel} style={menuLink}>
                  Actueel
                </a>
                {isAdmin && (
                  <div onClick={goAdmin} style={css('cursor: pointer; padding: 13px 4px; font-size: 16px; font-weight: 700; color: #2C4A5E;')}>
                    Beheer
                  </div>
                )}
                {isLoggedIn ? (
                  <>
                    <div
                      onClick={() => naar('/kompas/account')}
                      style={css('cursor: pointer; padding: 13px 4px; font-size: 16px; font-weight: 600; color: #2C4A5E;')}
                    >
                      Mijn account
                    </div>
                    <div
                      onClick={() => naar('/hoe-het-werkt')}
                      style={css('cursor: pointer; padding: 13px 4px; font-size: 16px; font-weight: 600; color: #2C4A5E;')}
                    >
                      Mijn abonnement
                    </div>
                    <div
                      onClick={logout}
                      style={css('cursor: pointer; padding: 13px 4px; font-size: 16px; font-weight: 700; color: #B4453B;')}
                    >
                      Uitloggen
                    </div>
                  </>
                ) : (
                  <AccountMenu compact />
                )}
                <a
                  href="#"
                  onClick={goKompas}
                  style={css(
                    'margin-top: 8px; padding: 14px 20px; background: #4E9A6C; color: #FFFFFF; border-radius: 999px; font-size: 15.5px; font-weight: 700; text-align: center;',
                  )}
                >
                  Probeer Subsidie Kompas
                </a>
              </div>
            )}
          </>
        )}

        {isSubpage && (
          <>
            <div onClick={goHome} style={css('display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 15px; font-weight: 700; color: #2C4A5E;')}>
              <span style={css('font-size: 18px;')}>←</span> Terug naar home
            </div>
            <AccountMenu compact />
          </>
        )}
      </div>
    </div>
  );
}
