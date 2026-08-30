// Navigatiebalk. Opmaak letterlijk uit het goedgekeurde ontwerp (NAV-blok in
// Het Fondsenwervers Collectief.dc.html).
import React from 'react';
import { css } from '../../shared/lib/css.js';
import { useApp } from './WebsiteProvider.jsx';

const navLink = css('font-size: clamp(13.5px, 1.2vw, 15px); font-weight: 600; color: #2C4A5E; white-space: nowrap;');

const navKnop = css(
  'padding: 10px clamp(14px, 1.6vw, 20px); background: #4E9A6C; color: #FFFFFF; border-radius: 999px; font-size: clamp(13.5px, 1.2vw, 15px); font-weight: 700; white-space: nowrap; text-align: center;',
);

const menuLink = css('padding: 13px 4px; font-size: 16px; font-weight: 600; color: #2C4A5E;');

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
  } = app;

  if (isCollectief === false) return null;

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
          <div onClick={goHome} style={css('display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 15px; font-weight: 700; color: #2C4A5E;')}>
            <span style={css('font-size: 18px;')}>←</span> Terug naar home
          </div>
        )}
      </div>
    </div>
  );
}
